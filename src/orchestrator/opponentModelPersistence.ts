/**
 * src/orchestrator/opponentModelPersistence.ts — CODEXIMPROVE #1 (session 32).
 *
 * `OpponentModel` (src/strategy/opponentModel.ts) has always exposed
 * `toJSON`/`fromJSON` for exactly this purpose, and SPEC.md has named
 * `data/opponent-model.json` as the intended location since Task 10 — but
 * neither live entry point (`scripts/liveRun.ts`, `scripts/orchestrator.ts`)
 * ever actually persisted it; both constructed a blank model every launch.
 * Predictions stay uniform until 30 observations accumulate for a given
 * `(enemyId, room)` key (`SAMPLE_FLOOR`), so every restart threw away exactly
 * the evidence that matters most in deeper, sparser rooms.
 *
 * This module owns ALL of that I/O so `opponentModel.ts` stays pure — same
 * API/strategy separation CLAUDE.md's working-style section requires, and the
 * same split `guardPersistence.ts` already draws for `GuardState`. Four
 * requirements, each mirroring a fix `guardPersistence.ts` already made for
 * the exact same class of bug (session 28, CODEXREVIEW #2):
 *
 *  1. **Schema versioning.** `schemaVersion` is a zod `z.literal`, so a
 *     mismatch is REJECTED (throws `OpponentModelPersistenceError`), not
 *     silently misread. There is nothing to migrate from yet at version 1 —
 *     when a version 2 ships, this is the file that gains the migration.
 *  2. **Atomic save.** Sibling temp file + rename, byte-for-byte the same
 *     pattern as `guardPersistence.ts`'s `saveGuardBudget` — reused, not
 *     reinvented.
 *  3. **Single writer.** No new locking mechanism — callers reuse
 *     `guardPersistence.ts`'s `acquireGuardLock` directly against this file's
 *     own path, exactly the way `scripts/orchestrator.ts` already takes two
 *     separate guard locks (dungeon + fishing) for the process lifetime.
 *  4. **Fail closed on corruption.** A file that EXISTS but won't parse or
 *     doesn't match the schema throws rather than silently resetting to a
 *     blank model — the same fail-OPEN bug class CODEXREVIEW #2 fixed for
 *     guard-budget persistence (a corrupted record of real learned evidence
 *     quietly forgotten is worse than no record, because it gets trusted).
 *     A genuinely missing file is still a legitimate "nothing learned yet"
 *     seed — that is the only case that returns a blank model without
 *     throwing.
 *
 * Bootstrap (requirement 5, CODEXIMPROVE #1): `bootstrapFromCorpus` folds
 * clean historical dungeon exchanges from the fixture corpus into the model,
 * gated by `bootstrapImportedIds` — a per-exchange identity
 * (`${run}::${label}`, the same qualification DECISIONS 2026-08-15 already
 * requires for a corpus exchange label, which is not unique on its own)
 * persisted alongside the model. Calling it again after the corpus has grown
 * (a later session's live play added new fixtures) imports only the NEW
 * exchanges — already-imported ones are skipped by identity, so it is safe
 * (and intended) to call on every launch, not just the first one ever.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { exchanges, loadCorpus, type CorpusRun, type WireSide } from "../sim/corpus.js";
import { ROOM_ENEMIES } from "../sim/enemies.js";
import { type MoveKey } from "../sim/types.js";
import { modelKey, OpponentModel, type Counts } from "../strategy/opponentModel.js";

export class OpponentModelPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpponentModelPersistenceError";
  }
}

export const OPPONENT_MODEL_SCHEMA_VERSION = 1;
export const DEFAULT_OPPONENT_MODEL_PATH = join("data", "opponent-model.json");

const DistributionSchema = z.object({ rock: z.number(), paper: z.number(), scissor: z.number() });
const CountsSchema = z.object({
  total: DistributionSchema,
  transitions: z.object({ rock: DistributionSchema, paper: DistributionSchema, scissor: DistributionSchema }),
});

const PersistedOpponentModelSchema = z.object({
  schemaVersion: z.literal(OPPONENT_MODEL_SCHEMA_VERSION),
  keys: z.record(z.string(), CountsSchema),
  bootstrapImportedIds: z.array(z.string()),
});

export type PersistedOpponentModel = z.infer<typeof PersistedOpponentModelSchema>;

export interface LoadedOpponentModel {
  model: OpponentModel;
  /** Exchange identities already folded in by a prior `bootstrapFromCorpus` call — mutated in place by later calls. */
  bootstrapImportedIds: Set<string>;
}

/**
 * Loads the persisted model, or a fresh blank one if nothing is on disk yet
 * (a legitimate "nothing learned across sessions yet" seed, same convention
 * as `guardPersistence.ts`'s `loadGuardBudget`). A file that EXISTS but
 * fails to parse, or doesn't match `PersistedOpponentModelSchema` (including
 * a `schemaVersion` mismatch), throws `OpponentModelPersistenceError`
 * instead — CLAUDE.md §5, fail closed.
 */
export function loadOpponentModel(path: string = DEFAULT_OPPONENT_MODEL_PATH): LoadedOpponentModel {
  if (!existsSync(path)) return { model: new OpponentModel(), bootstrapImportedIds: new Set() };

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new OpponentModelPersistenceError(`opponent model file ${path} exists but could not be read: ${(e as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new OpponentModelPersistenceError(
      `opponent model file ${path} exists but is not valid JSON — refusing to silently reset to a blank model (CLAUDE.md §5, fail closed). ${(e as Error).message}`,
    );
  }

  const result = PersistedOpponentModelSchema.safeParse(json);
  if (!result.success) {
    throw new OpponentModelPersistenceError(
      `opponent model file ${path} exists but doesn't match the expected schema (version ${OPPONENT_MODEL_SCHEMA_VERSION}, or a legitimately older/newer schemaVersion this code doesn't know how to migrate) — refusing to silently discard learned evidence. ${result.error.message}`,
    );
  }

  return {
    model: OpponentModel.fromJSON(result.data.keys as Record<string, Counts>),
    bootstrapImportedIds: new Set(result.data.bootstrapImportedIds),
  };
}

/**
 * Overwrites the persisted model. Call after every `model.observe()` from a
 * real game — CLAUDE.md's working-style precedent (`guardPersistence.ts`'s
 * `saveGuardBudget`, called after every guard mutation) is "persist
 * immediately," not "persist at exit," so a crash mid-run loses at most the
 * in-flight observation. Writes through a sibling temp file and renames it
 * into place (atomic on the same filesystem) — same pattern as
 * `guardPersistence.ts`'s `saveGuardBudget`, reused rather than reinvented.
 */
export function saveOpponentModelAtomically(
  model: OpponentModel,
  bootstrapImportedIds: Set<string>,
  path: string = DEFAULT_OPPONENT_MODEL_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: PersistedOpponentModel = {
    schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION,
    keys: model.toJSON(),
    bootstrapImportedIds: [...bootstrapImportedIds].sort(),
  };
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmp, JSON.stringify(body, null, 2));
  renameSync(tmp, path);
}

interface BootstrapObservation {
  /** `${run}::${exchange label}` — a corpus exchange label alone is not unique across runs (DECISIONS 2026-08-15), so this qualifies it. */
  id: string;
  key: string;
  move: MoveKey;
  prevMove: MoveKey | null;
}

const roomOf = (enemyId: string): number => ROOM_ENEMIES.find((p) => p.enemy.id === enemyId)?.room ?? -1;

/**
 * Walks the corpus's clean (unmodelled-mechanic-free — `reasons.length === 0`)
 * exchanges in recorded order and turns each into an observation the model
 * can learn from, resetting the "enemy's previous move" tracking at every
 * battle boundary (a run/foe-id change) — the exact same rule
 * `src/strategy/policy.ts`'s `onBattleStart` and `scripts/liveRun.ts`'s live
 * loop already apply to real play, so a bootstrapped key and a live-learned
 * key are evidentially identical, not two different kinds of data.
 *
 * An enemy id absent from `ROOM_ENEMIES` (an unrecognized/uncatalogued
 * capture) is skipped rather than guessing a room — CLAUDE.md §1, discover
 * don't assume.
 */
function collectBootstrapObservations(runs: CorpusRun[]): BootstrapObservation[] {
  const out: BootstrapObservation[] = [];
  let lastRun: string | null = null;
  let lastFoeId: string | null = null;
  let prevMove: MoveKey | null = null;

  for (const x of exchanges(runs)) {
    if (x.reasons.length > 0) continue; // unmodelled mechanic present — not clean evidence

    const foeId = (x.before.run.players[1] as WireSide).id;
    if (x.run !== lastRun || foeId !== lastFoeId) prevMove = null;

    const room = roomOf(foeId);
    if (room >= 0) {
      out.push({ id: `${x.run}::${x.label}`, key: modelKey(foeId, room), move: x.foeMove, prevMove });
    }

    prevMove = x.foeMove;
    lastRun = x.run;
    lastFoeId = foeId;
  }
  return out;
}

/**
 * Folds every not-yet-imported clean corpus exchange into `model`, mutating
 * `bootstrapImportedIds` in place with the identities it just imported.
 * Idempotent across repeated calls (including across process restarts, via
 * the persisted `bootstrapImportedIds`) — see this file's header.
 */
export function bootstrapFromCorpus(
  model: OpponentModel,
  bootstrapImportedIds: Set<string>,
  runs: CorpusRun[] = loadCorpus(),
): { imported: number } {
  let imported = 0;
  for (const o of collectBootstrapObservations(runs)) {
    if (bootstrapImportedIds.has(o.id)) continue;
    model.observe(o.key, o.move, o.prevMove);
    bootstrapImportedIds.add(o.id);
    imported++;
  }
  return { imported };
}
