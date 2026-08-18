/**
 * src/orchestrator/playCountsPersistence.ts — CODEXIMPROVE #5 (session 35).
 *
 * `scripts/liveRun.ts`'s `runOnce()` has always tracked `playCounts` as a
 * plain local object, zeroed at the top of the function — the move
 * distribution `loot.ts`'s `"upgrade"` case ranks a boon offer against. That
 * means resuming an active run (a process restart mid-run, the same
 * `runOnce()` re-entry path already used for `getDungeonState()` returning an
 * existing run) forgets every move played earlier in the SAME run, right
 * before a boon decision that is supposed to rank against exactly that
 * distribution.
 *
 * This module owns that persistence so `loot.ts` stays pure and
 * `scripts/liveRun.ts` stays the only place that talks to `data/`, the same
 * split `guardPersistence.ts` and `opponentModelPersistence.ts` already
 * established. Three requirements, each mirroring a fix those two files
 * already made for the same class of bug:
 *
 *  1. **Schema versioning.** A zod `z.literal`, same as
 *     `opponentModelPersistence.ts` — nothing to migrate from yet at version 1.
 *  2. **Atomic save.** Sibling temp file + rename, byte-for-byte the same
 *     pattern as `guardPersistence.ts`'s `saveGuardBudget` — reused, not
 *     reinvented.
 *  3. **Fail closed on corruption.** A file that EXISTS but won't parse or
 *     doesn't match the schema throws rather than silently resetting to zero
 *     — same fail-OPEN bug class CODEXREVIEW #2 fixed for guard-budget
 *     persistence.
 *
 * Keyed by the real dungeon-attempt identity, `DUNGEON_ID_CID` — the same
 * field `src/sim/corpus.ts`'s `exchanges()`/`deathRooms.ts` already use to
 * split one capture directory into distinct attempts (DECISIONS 2026-08-14),
 * so this reuses an existing identity scheme rather than inventing a second
 * one. Loading against a DIFFERENT `runId` than what's on disk is treated as
 * a fresh run — not corruption — the same way `guardPersistence.ts` treats a
 * persisted PRIOR day as a legitimate fresh budget rather than a stale error.
 *
 * This is per-run state, not a running total: `deletePlayCounts` is called
 * the moment a run ends (win, death, or flee — anywhere `scripts/liveRun.ts`
 * already treats the run as over), so a finished run never leaves a stale
 * seed behind for whatever attempt starts next.
 *
 * Locking reuses `guardPersistence.ts`'s `acquireGuardLock` against this
 * file's own path — same "no new locking mechanism" discipline
 * `opponentModelPersistence.ts` already followed.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import type { MoveKey } from "../sim/types.js";

export class PlayCountsPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayCountsPersistenceError";
  }
}

export const PLAY_COUNTS_SCHEMA_VERSION = 1;
export const DEFAULT_PLAY_COUNTS_PATH = join("data", "play-counts.json");

const CountsSchema = z.object({
  rock: z.number().int().nonnegative(),
  paper: z.number().int().nonnegative(),
  scissor: z.number().int().nonnegative(),
});

const PersistedPlayCountsSchema = z.object({
  schemaVersion: z.literal(PLAY_COUNTS_SCHEMA_VERSION),
  runId: z.number(),
  counts: CountsSchema,
});

export type PersistedPlayCounts = z.infer<typeof PersistedPlayCountsSchema>;

const zeroCounts = (): Record<MoveKey, number> => ({ rock: 0, paper: 0, scissor: 0 });

/**
 * Loads the persisted counts for `runId`, or a fresh zeroed record if
 * nothing is on disk yet, or if what IS on disk belongs to a different run
 * (a prior attempt's leftover, e.g. from a process that crashed before its
 * own `deletePlayCounts` call — a legitimate "this run starts fresh" case,
 * not corruption). A file that EXISTS but fails to parse or doesn't match
 * `PersistedPlayCountsSchema` throws `PlayCountsPersistenceError` instead —
 * CLAUDE.md §5, fail closed.
 */
export function loadPlayCounts(runId: number, path: string = DEFAULT_PLAY_COUNTS_PATH): Record<MoveKey, number> {
  if (!existsSync(path)) return zeroCounts();

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new PlayCountsPersistenceError(`play-counts file ${path} exists but could not be read: ${(e as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new PlayCountsPersistenceError(
      `play-counts file ${path} exists but is not valid JSON — refusing to silently reset to zero (CLAUDE.md §5, fail closed). ${(e as Error).message}`,
    );
  }

  const result = PersistedPlayCountsSchema.safeParse(json);
  if (!result.success) {
    throw new PlayCountsPersistenceError(
      `play-counts file ${path} exists but doesn't match the expected schema (version ${PLAY_COUNTS_SCHEMA_VERSION}) — refusing to silently discard. ${result.error.message}`,
    );
  }

  if (result.data.runId !== runId) return zeroCounts(); // a different dungeon attempt — this run's own counts start fresh
  return { ...result.data.counts };
}

/**
 * Overwrites the persisted counts for `runId`. Call after every increment —
 * same "persist immediately" discipline as `guardPersistence.ts`'s
 * `saveGuardBudget` and `opponentModelPersistence.ts`'s
 * `saveOpponentModelAtomically`, so a crash mid-run loses at most the
 * in-flight play, never previously-logged ones. Writes through a sibling
 * temp file and renames it into place (atomic on the same filesystem) — same
 * pattern as the other two persistence modules, reused rather than
 * reinvented.
 */
export function savePlayCounts(runId: number, counts: Record<MoveKey, number>, path: string = DEFAULT_PLAY_COUNTS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: PersistedPlayCounts = {
    schemaVersion: PLAY_COUNTS_SCHEMA_VERSION,
    runId,
    counts: { rock: counts.rock, paper: counts.paper, scissor: counts.scissor },
  };
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmp, JSON.stringify(body, null, 2));
  renameSync(tmp, path);
}

/**
 * Deletes the persisted counts — call the moment a run ends (win, death, or
 * flee). This is per-run state, not a running total across runs, so a
 * finished run must not leave a seed behind for the next attempt to
 * mistakenly inherit (the `runId` mismatch check in `loadPlayCounts` would
 * catch a genuinely different next run anyway, but deleting is the documented
 * behavior, not an incidental side effect of that check). A no-op, not an
 * error, if nothing is on disk.
 */
export function deletePlayCounts(path: string = DEFAULT_PLAY_COUNTS_PATH): void {
  try {
    rmSync(path);
  } catch {
    // already gone — nothing to clean up
  }
}
