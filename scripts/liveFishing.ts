/**
 * scripts/liveFishing.ts — Task 9, staged like scripts/liveRun.ts:
 *
 *   npx tsx scripts/liveFishing.ts --dry-run     # one decision, log it, POST nothing
 *   npx tsx scripts/liveFishing.ts --casts=1     # one full cast
 *   npx tsx scripts/liveFishing.ts --casts=5     # five casts
 *
 * **What's CONFIRMED vs INFERRED**, CLAUDE.md §2 ("never invent an
 * endpoint"):
 *  - `start_run`/`play_cards` on `POST /api/fishing/action` — CONFIRMED,
 *    SPEC-fishing.md §2.
 *  - `data.hand` holds card **ids**, and the request's `data.cards: [i]` is
 *    the hand-relative **index** played, not an id — CONFIRMED, re-derived
 *    directly against `fixtures/fishing-casts/cast.json` (`hand[i]` equals
 *    the id that lands in `discard[]` that same turn, all 5 real plays).
 *  - **Redraw is UNCONFIRMED** (SPEC-fishing.md §7: "genuinely uncaptured,
 *    wire shape stays [VERIFY] until a live cast produces one"). This loop
 *    never sends one. `shouldRedraw` firing is logged, not acted on — the
 *    loop always plays the best affordable card instead of guessing at an
 *    action name.
 *  - **A catch's terminal shape is UNCONFIRMED** — never observed in the
 *    one real capture (SPEC-fishing.md §0). The full raw response is always
 *    fixture-written, so the first real live catch settles what "logged
 *    with rarity" (TASKS.md Task 9's gate) actually looks like on the wire.
 *
 * **`focusMeter` genuinely constrains focus movement — [CONFIRMED live,
 * session 13].** The one prior capture (`fixtures/fishing-casts/cast.json`)
 * never moved the meter off 3/3, leaving the spend rule `[VERIFY]`
 * (SPEC-fishing.md §4). This project's first-ever live cast moved it 3/3 →
 * 3/3 → 2/3 → 1/3 across three focus moves of Manhattan distance 0/1/1, then
 * a 4th move of distance 2 was REJECTED (HTTP 400) with only 1 meter left —
 * four clean data points, the cost is Manhattan distance, and it does not
 * regenerate within a cast. `cardChoice.ts`'s `chooseCard`/`bestFocusForCard`
 * take an optional `FocusBudget` to respect this; this script always passes
 * one, built from `doc.data.focusPoint`/`focusMeter`. The sim
 * (`src/sim/fishing/castSim.ts`) does **not** model this yet — its 92.4%
 * catch-rate figure assumes unconstrained focus movement every turn, so it's
 * an optimistic ceiling relative to what real Dendren actually allows.
 *
 * The matcher's candidate pool starts **EMPTY every cast**, deliberately —
 * `src/sim/fishing/patterns.ts`'s library is a synthetic stand-in built for
 * Task 8's gate, explicitly NOT a claim about real Dendren (SPEC.md §5).
 * Every turn therefore runs through the fallback hierarchy, seeded from
 * whatever `data/fish-patterns.jsonl` has accumulated so far (empty on this
 * project's first-ever live cast) — SPEC.md §5's "the bot gets sharper the
 * longer it runs" starts genuinely from zero here, not from borrowed
 * synthetic structure. Task 11's `mineFishPatterns.ts` is what eventually
 * promotes real recurring cycles out of this log into named candidates.
 *
 * **[session 33, CODEXIMPROVE #3] The fallback is now conditioned on the
 * fish's PREVIOUS movement displacement, not just its current cell.**
 * `contextualFallback()` tries `${cell}|${prevDx},${prevDy}` first, mixed
 * with the existing cell-only `emptyFallback` distribution by continuous
 * shrinkage (`n / (n + shrinkageK)` on `n` distinct real casts supporting
 * that exact key — never just raw transition count, which one short
 * repeating cast could fake), collapsing to pure cell-only when there's no
 * previous displacement yet (a cast's first hop) or `n = 0`, and from there
 * to uniform as before. Shipped only after `scripts/fishingContextualCV.ts`'s
 * leave-one-cast-out held-out evaluation reproduced Codex's core finding on
 * the real corpus (previous direction roughly doubling top-1 accuracy over
 * cell-only) and `scripts/fishingContextualAblation.ts`'s simulator ablation
 * confirmed the hierarchical backoff correctly exploits genuine
 * previous-direction structure when present — see both scripts' headers for
 * the actual numbers and the CLAUDE.md §9 caveats on what a simulator
 * result is and isn't evidence of.
 *
 * **[session 38, CODEXAUDIT #2] The hard `minIndependentCasts` threshold
 * this tier originally shipped with is RETIRED and replaced by the
 * continuous shrinkage above** — leave-one-cast-out CV showed the hard
 * switch regressing log loss versus cell-only-forever (thin support gets
 * zero probability on every cell outside it, and `chooseCard` consumes the
 * whole distribution, not just top-1). `DEFAULT_SHRINKAGE_K = 1` clears the
 * gate this session's brief set: it beats the cell-only baseline's real-
 * corpus log loss AND Brier score, not just top-1/the synthetic ablation —
 * see `contextualFallback.ts`'s own doc comment and `fishingContextualCV.ts`'s
 * printed sweep for the numbers.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { GigaverseClient } from "../src/api/client.js";
import { TokenExpiredError, UnexpectedResponseError, serverErrorDetail } from "../src/api/errors.js";
// [session 47, brief §1e] `serverErrorDetail` moved to src/api/errors.ts — it is a
// property of the error type, and keeping it here is what let the dungeon side go
// three sessions with the same swallowed-body bug. Re-exported so every existing
// `from "./liveFishing.js"` import site is unchanged.
export { serverErrorDetail };
import type { FishingActionRequest, FishingActionResponse, FishingGameDoc } from "../src/api/fishing.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip } from "../src/orchestrator/guards.js";
import { acquireGuardLock, loadGuardBudget, saveGuardBudget, todayKey } from "../src/orchestrator/guardPersistence.js";
import { reconcileEnergyAccounting, describeEnergyAccounting } from "../src/orchestrator/energyAccounting.js";
import { ensureEnergyFor, clientEnergyPreflightDeps, EnergyPreflightError } from "../src/orchestrator/energyPreflight.js";
import { regenerateRunReports } from "./regenerateReports.js";
import { createShutdownSignal, installProcessSigintHandler } from "../src/orchestrator/shutdown.js";
import {
  chooseCard,
  chooseNewCard,
  shouldRedraw,
  DEFAULT_FOCUS_RESERVE_WEIGHT,
  type FishingCardLike,
  type FocusBudget,
} from "../src/strategy/fishing/cardChoice.js";
import {
  initMatcher,
  mixDistributions,
  observe,
  predictDistribution,
  type MatcherState,
} from "../src/strategy/fishing/matcher.js";
import {
  buildContextualMap,
  contextualFallback,
  previousDisplacement,
  DEFAULT_SHRINKAGE_K,
} from "../src/strategy/fishing/contextualFallback.js";
import {
  buildStepClassTable,
  classifyStep,
  intersectWithRing,
  ringDistribution,
  ringDistributionUnknownClass,
  DEFAULT_RING_MODEL_OPTIONS,
} from "../src/strategy/fishing/stepClass.js";
import { shouldConsiderRelaxingOil, MID_RELAXING_OIL_ITEM_ID } from "../src/strategy/fishing/oilPolicy.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { cellKey, cellsEqual, inGrid, type Cell } from "../src/sim/fishing/geometry.js";
import { REDRAW_THRESHOLD } from "../src/sim/fishing/castSim.js";
import { buildPatternPool, toCandidate, type Pattern } from "../src/sim/fishing/patterns.js";
import type { ShutdownSignal } from "../src/orchestrator/shutdown.js";

// ---------------------------------------------------------------------------
// Pure(ish) helpers — no network, unit-testable directly.
// ---------------------------------------------------------------------------

/** `deckCardData` entries carry everything `FishingCardLike` needs, keyed by id. */
export function cardsById(deckCardData: FishingGameDoc["data"]["deckCardData"]): Map<number, FishingCardLike> {
  const m = new Map<number, FishingCardLike>();
  for (const c of deckCardData) {
    m.set(c.id, {
      id: c.id,
      manaCost: c.manaCost,
      hitZones: c.hitZones,
      critZones: c.critZones,
      hitEffects: c.hitEffects,
      missEffects: c.missEffects,
      critEffects: c.critEffects,
    });
  }
  return m;
}

/** `doc.data.hand` holds card ids (confirmed — see this file's header); resolve each against `deckCardData`. */
export function buildHand(doc: FishingGameDoc): FishingCardLike[] {
  const byId = cardsById(doc.data.deckCardData);
  return doc.data.hand.map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`hand card id ${id} not found in deckCardData — a wire assumption just broke`);
    return c;
  });
}

/**
 * Session 17: every key seen on the real captured cast
 * (`fixtures/fishing-casts/cast.json`), NOT just `FishingBoardDataSchema`'s
 * declared fields — CLAUDE.md §1, "if a field you expected is missing from
 * a live response, the spec is wrong and the live response is right." The
 * schema's own `.passthrough()` already carries these fields through
 * untyped; the first version of this allowlist only listed the schema's
 * declared subset and immediately flagged 16 real, boring, already-known
 * fields (`LEVEL_CID`, `data.day`/`week`, etc.) as "unknown" on every
 * single doc — noise that would have buried the one signal this exists to
 * catch. Mirrors `scripts/liveRun.ts`'s `KNOWN_SIDE_KEYS` pattern: a
 * hand-maintained allowlist so a GENUINELY new field is a loud signal.
 */
export const KNOWN_DOC_DATA_KEYS: ReadonlySet<string> = new Set([
  "deckCardData",
  "playerMaxHp",
  "playerHp",
  "fishHp",
  "fishMaxHp",
  "fishPosition",
  "previousFishPosition",
  "gridSize",
  "focusPoint",
  "focusMeter",
  "focusMeterMax",
  "focusMechanicEnabled",
  "patternIndex",
  "fullDeck",
  "nextCardIndex",
  "cardInDrawPile",
  "hand",
  "discard",
  "jebaitorTriggered",
  "consumablesUsed",
  "fishingConsumableSlotUsed",
  "fintuitionOilBoostPercent",
  "dualYieldOilBoostPercent",
  "day",
  "week",
  // Found live, session 17's first real cast this session (escaped, 2
  // turns) — boring, present on every response, unrelated to the
  // catch-resolution mystery below.
  "lastMovePath",
  "activeFintuitionTurns",
  "activeCritBoostTurns",
  // `caughtFish`/`cardsToAdd`/`cardChosenId` — QUESTIONS.md §10, RESOLVED
  // later this same session: `loot` (user-captured via DevTools) is the
  // real action that sets `cardChosenId`, now sent automatically by
  // `runOneCast` the moment a catch's `cardsToAdd` offer needs resolving
  // (see below). Known now, not flagged.
  "caughtFish",
  "cardsToAdd",
  "cardChosenId",
]);

/** `data` handled separately via `KNOWN_DOC_DATA_KEYS` — see that constant's doc comment. */
export const KNOWN_DOC_TOP_KEYS: ReadonlySet<string> = new Set([
  "docId",
  "docType",
  "data",
  "COMPLETE_CID",
  "SUCCESS_CID",
  "IS_JUICED_CID",
  "MULTIPLIER_CID",
  "LEVEL_CID",
  "ID_CID",
  "PLAYER_CID",
  "FACTION_CID",
  "GEAR_CID_array",
  "DAY_CID",
  "_id",
  "createdAt",
  "updatedAt",
  "__v",
]);

/** Any key on `doc` or `doc.data` not in the allowlists above — e.g. `cardsToAdd`/`caughtFish` (QUESTIONS.md §10), reported prefixed `data.`. */
export function unknownDocKeys(doc: Record<string, unknown>): string[] {
  const topUnknown = Object.keys(doc).filter((k) => k !== "data" && !KNOWN_DOC_TOP_KEYS.has(k));
  const dataObj = (doc.data ?? {}) as Record<string, unknown>;
  const dataUnknown = Object.keys(dataObj).filter((k) => !KNOWN_DOC_DATA_KEYS.has(k));
  return [...topUnknown, ...dataUnknown.map((k) => `data.${k}`)];
}

export function fishCell(doc: FishingGameDoc): Cell {
  const [x, y] = doc.data.fishPosition;
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error(`doc.data.fishPosition malformed: ${JSON.stringify(doc.data.fishPosition)}`);
  }
  return { x, y };
}

const MINED_PATTERNS_PATH = join("data", "minedFishPatterns.json");

/**
 * Reads scripts/mineFishPatterns.ts's output (pattern names that hit the
 * PROMOTION_THRESHOLD of independent exact-matching real casts) and resolves
 * each name back against the synthetic pool it was tested against. Missing
 * file, unparseable file, or an unrecognised name are all treated the same
 * as "nothing mined yet" — never a crash — since a stale/absent mined file
 * just means the matcher starts empty, exactly like every session before
 * this wiring existed.
 */
export function loadMinedPatterns(path: string = MINED_PATTERNS_PATH): Pattern[] {
  if (!existsSync(path)) return [];
  let parsed: { patterns?: unknown };
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as { patterns?: unknown };
  } catch {
    return [];
  }
  const names = Array.isArray(parsed.patterns) ? parsed.patterns.filter((n): n is string => typeof n === "string") : [];
  const byName = new Map(buildPatternPool().map((p) => [p.name, p]));
  return names.map((n) => byName.get(n)).filter((p): p is Pattern => p !== undefined);
}

/**
 * **[CONFIRMED session 13, live]** `focusPoint`/`focusMeter` off the doc,
 * as a `FocusBudget` for `chooseCard` — see `cardChoice.ts`'s `FocusBudget`
 * doc comment for the discovery (Manhattan-distance cost, no regen observed
 * within a cast). Without this, `chooseCard` searches the WHOLE grid every
 * turn and the live server rejects a move it can't afford (HTTP 400) —
 * confirmed the hard way, turn 4 of this project's first-ever live cast.
 */
export function focusBudget(doc: FishingGameDoc): FocusBudget {
  const [x, y] = doc.data.focusPoint;
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error(`doc.data.focusPoint malformed: ${JSON.stringify(doc.data.focusPoint)}`);
  }
  return { current: { x, y }, remaining: doc.data.focusMeter };
}

export function buildFishingEnvelope(
  action: "start_run" | "play_cards" | "loot" | "use_fishing_item",
  actionToken: string,
  data: Partial<FishingActionRequest["data"]>,
): FishingActionRequest {
  return {
    action,
    actionToken,
    data: {
      cards: data.cards ?? [],
      nodeId: data.nodeId ?? "",
      focusPoint: data.focusPoint ?? [],
      itemId: data.itemId ?? 0,
      slotIndex: data.slotIndex ?? 0,
      tierId: data.tierId ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// data/fish-patterns.jsonl — the transition log SPEC.md §5 asks for "from
// the very first cast", read back in as `emptyFallback`'s empirical source.
// ---------------------------------------------------------------------------

export const DEFAULT_TRANSITIONS_PATH = join("data", "fish-patterns.jsonl");

export interface TransitionRecord {
  ts: string;
  castId: string;
  turn: number;
  from: [number, number];
  to: [number, number];
  gridSize: number;
}

/** Builds the `emptyFallback` empirical map from every transition ever logged, across all casts — malformed lines are skipped, never fatal. */
export function loadTransitionLog(path: string = DEFAULT_TRANSITIONS_PATH): Map<string, Cell[]> {
  const map = new Map<string, Cell[]>();
  if (!existsSync(path)) return map;
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as TransitionRecord;
      const from: Cell = { x: rec.from[0], y: rec.from[1] };
      const to: Cell = { x: rec.to[0], y: rec.to[1] };
      const key = cellKey(from);
      const arr = map.get(key) ?? [];
      arr.push(to);
      map.set(key, arr);
    } catch {
      // one bad line shouldn't lose the whole log
    }
  }
  return map;
}

export function appendTransition(rec: TransitionRecord, path: string = DEFAULT_TRANSITIONS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec) + "\n", { flag: "a" });
}

/**
 * [session 29, CODEXREVIEW #5] Finds the highest-turn record already logged
 * for a specific `castId` — used to resume numbering correctly on a resumed
 * cast instead of always restarting at turn 0. Concrete proof this was
 * needed: cast `12923189` in the real `data/fish-patterns.jsonl` has two
 * distinct turn-0 records ~5 minutes apart — the second is a resumed
 * process relabeling wherever the fish actually was (turn 3's real position)
 * as "turn 0" again, which silently overwrote the true turn-0 record in
 * `mineFishPatterns.ts`'s per-turn `Map`.
 */
export function lastRecordForCast(castId: string, path: string = DEFAULT_TRANSITIONS_PATH): TransitionRecord | null {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  let last: TransitionRecord | null = null;
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as TransitionRecord;
      if (rec.castId !== castId) continue;
      if (!last || rec.turn > last.turn) last = rec;
    } catch {
      // one bad line shouldn't lose the whole log — same convention as loadTransitionLog
    }
  }
  return last;
}

// ---------------------------------------------------------------------------
// `nextPosition` validation — [session 30, brief §2]. QUESTIONS.md §12/
// DECISIONS.md found `nextPosition`/`nextMovePath` firing on ~1-2% of real
// turns (2/169 confirmed non-null occurrences at last count), statistically
// compatible with (not confirming, not rejecting) a 3% Fintuition proc.
// Rare-and-unconfirmed is not the same as wrong — user directive this
// session: reposition focus on it when it fires, but do the validation-only
// pass first (log predicted vs. actual for more sightings) before letting it
// override the matcher, so a wrong field-meaning guess is caught before it
// steers focus placement.
//
// [session 39, CODEXAUDIT #4] The original gate (`NEXT_POSITION_OVERRIDE_THRESHOLD`,
// a raw all-time hit COUNT with zero record validation) had two real bugs:
// it never looked at ATTEMPTS, so ten hits buried in ninety interleaved
// misses satisfied it exactly as well as ten hits with zero misses, and
// `loadNextPositionValidations` trusted a bare `JSON.parse(line) as
// NextPositionValidation` type assertion — a well-formed-but-wrong record
// (a string `hit`, an out-of-grid coordinate) parsed clean and counted.
// Neither bug had fired live (this override has never armed for real; see
// this file's git history / handoff/STATE.md for the corpus-pollution
// incident that DID make it look armed, which was test data, not gameplay),
// but a threshold this permissive would silently arm the day the corpus
// grew enough to clear it by accident.
//
// Replaced with a Wilson-score lower-bound gate on hits/ATTEMPTS, per the
// audit's own suggested improvement over its minimum-safe "every hit ever"
// snippet: "every hit, ever, forever" means one early miss — which this
// rare, noisy signal WILL eventually produce — permanently disables the
// override for the rest of the project's history, even after years of
// subsequent perfect hits. A Wilson bound (unlike the normal-approximation
// CI `src/sim/dungeonSim.ts`'s `roomStats` already uses for room win rates)
// stays well-behaved at small n and at p near 0/1 — exactly this gate's
// shape, since the evidence is a handful of rare-field sightings by design
// (CLAUDE.md §7's rate limits alone bound how fast this log can grow). Same
// "don't trust a raw rate without accounting for sample size" instinct this
// project already applies elsewhere (boon-ranking CI gating, the
// charge-reserve ablation's 95% CI bar).
// ---------------------------------------------------------------------------

export const DEFAULT_NEXT_POSITION_LOG_PATH = join("data", "nextPositionValidation.jsonl");

/** Minimum TOTAL attempts (hits + misses) before the gate will even look at the rate — same numeral as the old (broken) hit-only threshold, now applied to the denominator the audit says it should have been applied to all along. */
export const NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS = 10;

/**
 * The 95%-confidence Wilson lower bound on hit rate must clear this before
 * the override arms. 0.5 is chosen as a round, legible bar deliberately far
 * above chance at any real grid size this project has seen (a 4x4 grid's
 * blind-guess rate is 1/16 ≈ 6.25%) rather than derived from a formal power
 * calculation — same "a handful, not a power calculation" honesty the
 * retired threshold's own comment had, carried forward rather than dressed
 * up as more rigorous than it is.
 */
export const NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND = 0.5;

export interface NextPositionValidation {
  ts: string;
  castId: string;
  /** The turn the prediction was checked against (the turn AFTER the one that revealed it). */
  turn: number;
  predicted: [number, number];
  actual: [number, number];
  hit: boolean;
  /**
   * The grid this prediction/actual pair was checked against — recorded per
   * record (not assumed global) because `gridSize` is read live off each
   * doc (`src/api/fishing.ts`), same "don't assume a fixed value where the
   * wire carries a real one" discipline `TransitionRecord` already applies.
   */
  gridSize: number;
}

function inBoundsTuple([x, y]: [number, number], gridSize: number): boolean {
  return inGrid({ x, y }, gridSize);
}

/** Schema for one persisted validation record. A record failing this — wrong type, non-integer turn, or a predicted/actual coordinate outside `[1, gridSize]` — is corruption or a stale wire-shape guess, not data, and is skipped by the loader rather than trusted (CODEXAUDIT #4). */
const NextPositionValidationSchema = z
  .object({
    ts: z.string(),
    castId: z.string(),
    turn: z.number().int().nonnegative(),
    predicted: z.tuple([z.number(), z.number()]),
    actual: z.tuple([z.number(), z.number()]),
    hit: z.boolean(),
    gridSize: z.number().int().positive(),
  })
  .refine((v) => inBoundsTuple(v.predicted, v.gridSize) && inBoundsTuple(v.actual, v.gridSize), {
    message: "predicted/actual must be within [1, gridSize]",
  });

/**
 * Reads `data.nextPosition` off a raw fishing response — not in
 * `FishingGameDocSchema` (QUESTIONS.md §12: real but rare, cause
 * unconfirmed), so this reads the untyped wire object directly rather than
 * widening the schema for a field this project can't yet explain. Returns
 * `null` for a missing key, a `null` value (the common case once the key has
 * appeared once in a cast — QUESTIONS.md §12 session 26), a malformed
 * (non-2-number-array) value, or [session 39, CODEXAUDIT #4] a coordinate
 * outside `[1, doc.data.gridSize]` when that field is itself present and
 * numeric — defense in depth so an out-of-range sighting never reaches the
 * validation log in the first place, rather than relying solely on the
 * loader's schema check to catch it after the fact.
 */
export function extractNextPosition(doc: unknown): Cell | null {
  const d = doc as { data?: { nextPosition?: unknown; gridSize?: unknown } } | undefined;
  const raw = d?.data?.nextPosition;
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const [x, y] = raw;
  if (typeof x !== "number" || typeof y !== "number") return null;
  const gridSize = d?.data?.gridSize;
  if (typeof gridSize === "number" && !inGrid({ x, y }, gridSize)) return null;
  return { x, y };
}

/**
 * [session 45, brief §5.4] Per-turn record of THIS project's OWN next-cell
 * prediction against what the fish actually did.
 *
 * Deliberately separate from `nextPositionValidation.jsonl`, which validates
 * the API's own occasional `nextPosition` field (2 rows in the whole corpus)
 * — a different, much rarer signal. This one fires on EVERY turn, so a live
 * batch produces a realized top-1 accuracy that can be compared directly
 * against the 48.2% `scripts/fishingRingCV.ts` measured out-of-sample on the
 * corpus. That single number says whether the ring model transferred to live,
 * independently of how the catch-rate coin flips landed on a handful of
 * casts — which at n=5-10 they cannot possibly settle.
 *
 * `tier` records WHICH predictor produced the row, so a mixed batch can be
 * split by tier rather than averaged into a number that describes nothing.
 */
export interface RingPredictionRecord {
  ts: string;
  castId: string;
  turn: number;
  tier: "matcher" | "matcher_ring" | "ring" | "ring_unknown_class" | "contextual" | "override";
  stepClass: 1 | 2 | null;
  predicted: [number, number];
  pPredicted: number;
  /** Probability the distribution assigned to the cell the fish ACTUALLY moved to — the calibration half, not just top-1. */
  pActual: number;
  actual: [number, number];
  hit: boolean;
  gridSize: number;

  // ---- [session 46, brief §1b] the PAIRED baseline ------------------------
  // The shipped pre-session-45 predictor (`contextualFallback`, the
  // "cell + prev-displacement (shipped backoff)" arm of
  // `scripts/fishingRingCV.ts`, offline logLoss 3.536) scored on the SAME
  // turn, against the SAME fish, from the SAME history. Comparing the ring
  // model's live number against an offline CONSTANT throws away the fact
  // that some fish are simply harder than others; scoring both predictors
  // on the same turns removes that variance entirely and makes the
  // difference a paired statistic with a real CI.
  //
  // Optional, so the 20 rows session 45 already wrote still parse (
  // `loadRingPredictions` is a plain JSON.parse) — a row without these is a
  // pre-session-46 row and the report drops it from the paired arm rather
  // than treating a missing baseline as a zero.
  /** Baseline's top-1 cell. */
  baselinePredicted?: [number, number];
  /** Probability the baseline assigned to its own top-1. */
  baselinePPredicted?: number;
  /** Probability the baseline assigned to the cell the fish ACTUALLY reached. */
  baselinePActual?: number;
  /** Did the baseline's top-1 match the realized cell? */
  baselineHit?: boolean;

  // ---- [session 46, brief §1d] predicted vs. realized HIT ------------------
  // `chooseCard` returns the probability it believes the chosen (card, focus)
  // pair will connect. Logging that beside whether the shot actually landed
  // is what separates the three ways a low catch rate can be caused —
  // see the brief's §1d table. Without it a low catch rate is uninterpretable
  // and the temptation is to tune something at random.
  /** The card actually played. */
  playedCardId?: number;
  /** The focus cell actually played. */
  playedFocus?: [number, number];
  /** `pHit + pCrit` for the played (card, focus) — the model's own belief it connects. */
  pHitPredicted?: number;
  /** Did it actually connect? Read off `fishHp` DECREASING across the turn (a miss pushes `fishHp` toward `fishMaxHp`, QUESTIONS.md §15). */
  realizedHit?: boolean;

  // ---- [session 48, brief §3] which zone map the shot was AIMED with -------
  // Session 47 found `ZONE_OFFSET` had been the transpose of the truth for
  // eleven sessions. Every row written before that fix was logged by a policy
  // aiming with the wrong map. The row's PREDICTIONS are unaffected — fish
  // movement is zone-independent — but `pHitPredicted` and `realizedHit`
  // describe mis-aimed shots, and pooling them into a hit-rate figure silently
  // drags it down.
  //
  // Optional, and absent means `"transposed"`: that is what a row without the
  // field IS, since the field only exists after the fix. Marked, not deleted —
  // one field, no data loss, reversible.
  zoneMapVersion?: ZoneMapVersion;
}

/**
 * [session 48] Which `ZONE_OFFSET` table the aiming decision on a row was made
 * with. `"transposed"` is session 12's table, wrong and shipped for eleven
 * sessions; `"corrected"` is session 47's fix.
 */
export type ZoneMapVersion = "transposed" | "corrected";

/** The map every shot is aimed with from session 47 onward. */
export const CURRENT_ZONE_MAP_VERSION: ZoneMapVersion = "corrected";

/**
 * A row's zone map, defaulting an absent field to `"transposed"` — see
 * `RingPredictionRecord.zoneMapVersion`. Use this rather than reading the
 * field directly, so the default lives in exactly one place.
 */
export function zoneMapVersionOf(rec: RingPredictionRecord): ZoneMapVersion {
  return rec.zoneMapVersion ?? "transposed";
}

/** Deterministic top-1 of a distribution — highest p, ties by lowest x then lowest y, the same rule `scripts/fishingRingCV.ts` scores with so live and offline numbers are comparable. */
function topCellOf(dist: ReadonlyMap<string, { cell: Cell; p: number }>): { cell: Cell; p: number } | null {
  const values = [...dist.values()];
  if (values.length === 0) return null;
  const maxP = Math.max(...values.map((v) => v.p));
  const tied = values.filter((v) => Math.abs(v.p - maxP) < 1e-9);
  tied.sort((a, b) => a.cell.x - b.cell.x || a.cell.y - b.cell.y);
  return tied[0] ?? null;
}

export const DEFAULT_RING_PREDICTION_LOG_PATH = join("data", "ringPrediction.jsonl");

/** Append-one-line writer, same never-fatal convention as `appendTransition`. */
export function appendRingPrediction(rec: RingPredictionRecord, path: string = DEFAULT_RING_PREDICTION_LOG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(rec)}\n`, "utf8");
}

export function loadRingPredictions(path: string = DEFAULT_RING_PREDICTION_LOG_PATH): RingPredictionRecord[] {
  if (!existsSync(path)) return [];
  const out: RingPredictionRecord[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as RingPredictionRecord);
    } catch {
      continue; // one bad line shouldn't lose the whole log
    }
  }
  return out;
}

export function appendNextPositionValidation(rec: NextPositionValidation, path: string = DEFAULT_NEXT_POSITION_LOG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec) + "\n", { flag: "a" });
}

/**
 * [session 39, CODEXAUDIT #4] Each line is now schema-validated, not merely
 * JSON-parsed — a line that parses as JSON but fails `NextPositionValidationSchema`
 * (wrong field type, out-of-grid coordinate) is skipped exactly like a
 * literally-malformed line, same "one bad line shouldn't lose the whole
 * log" convention `loadTransitionLog` already established. This does NOT
 * throw on a bad record (unlike `opponentModelPersistence.ts`'s fail-closed
 * whole-file schema check) — that module protects a single cumulative
 * counts object where one corrupt read poisons everything downstream; this
 * is an append-only line log where a bad line is naturally isolated to
 * itself.
 */
export function loadNextPositionValidations(path: string = DEFAULT_NEXT_POSITION_LOG_PATH): NextPositionValidation[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const out: NextPositionValidation[] = [];
  for (const line of lines) {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      continue; // one bad line shouldn't lose the whole log — same convention as loadTransitionLog
    }
    const result = NextPositionValidationSchema.safeParse(json);
    if (!result.success) continue; // well-formed JSON, wrong shape — corruption, not data; don't trust it
    out.push(result.data);
  }
  return out;
}

/** Raw hit count across every validation ever logged — a diagnostic for the console line, NOT the gate signal (that bug is exactly what CODEXAUDIT #4 fixed). See `nextPositionOverrideStats` for the actual gate. */
export function confirmedHitCount(path: string = DEFAULT_NEXT_POSITION_LOG_PATH): number {
  return loadNextPositionValidations(path).filter((v) => v.hit).length;
}

/**
 * Wilson score lower bound for a binomial proportion at 95% confidence
 * (z = 1.96) — well-behaved at small n and at p near 0 or 1, unlike a
 * normal-approximation interval (which degenerates to zero width at p=1).
 * `n = 0` returns 0 (no evidence, no confidence), matching this file's
 * existing "empty history / missing file" conventions elsewhere.
 */
export function wilsonLowerBound(hits: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return (center - margin) / denom;
}

export interface NextPositionOverrideStats {
  attempts: number;
  hits: number;
  /** Wilson lower bound on hit rate at 95% confidence; 0 when `attempts` is 0. */
  lowerBound: number;
  /** Whether the override should arm: enough attempts AND the lower bound clears the bar. */
  ready: boolean;
}

/**
 * [session 39, CODEXAUDIT #4] The real gate, replacing the old raw-hit-count
 * threshold. Requires BOTH a minimum sample size (total attempts, not just
 * hits — the audit's core finding: ten hits and ninety interleaved misses
 * must NOT satisfy this) and a 95%-confidence lower bound on the hit rate
 * clearing `NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND`. A single early miss
 * lowers the bound but does not zero it out — see this function's doc-comment
 * header above for the "permanently disables the override" failure mode
 * this is built to avoid.
 */
export function nextPositionOverrideStats(path: string = DEFAULT_NEXT_POSITION_LOG_PATH): NextPositionOverrideStats {
  const validations = loadNextPositionValidations(path);
  const attempts = validations.length;
  const hits = validations.filter((v) => v.hit).length;
  const lowerBound = wilsonLowerBound(hits, attempts);
  const ready = attempts >= NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS && lowerBound >= NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND;
  return { attempts, hits, lowerBound, ready };
}

/** A `Distribution` certain the fish is at `cell` — the override's effect on `chooseCard`, once `nextPositionOverrideStats` reports `ready`. Kept as a pure, directly testable function separate from the live wiring. */
export function certainDistribution(cell: Cell): Map<string, { cell: Cell; p: number }> {
  return new Map([[cellKey(cell), { cell, p: 1 }]]);
}

// ---------------------------------------------------------------------------
// Fixture writing — same shape as scripts/liveRun.ts's FixtureWriter.
// ---------------------------------------------------------------------------

/**
 * [session 28, CODEXREVIEW #7] `redactSecrets` removes the FULL jwt — see
 * `GigaverseClient.redactSecrets`'s doc comment. Callers pass that method
 * bound to a real client; nothing here ever sees or stores the raw token.
 */
function redact(raw: string, address: string, redactSecrets: (text: string) => string): string {
  let s = raw;
  for (const form of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (form) s = s.split(form).join("0xUSER");
  }
  s = redactSecrets(s);
  return s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
}

function stamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

/**
 * [session 28, CODEXREVIEW #1] One directory is one CAST — a fresh
 * `FixtureWriter` must be constructed per cast (see `main()`'s loop below).
 * Session 26/27's own corpus counts used directories as if they were casts,
 * which broke the moment a single invocation's writer got reused across
 * casts, or a resumed process wrote a second `docId` into the same
 * directory a prior process had started. `src/sim/fishingCorpus.ts`'s
 * `loadFishingCorpus()` groups by the real identity (`data.doc.docId`)
 * instead of trusting directory boundaries, but a fresh writer per cast
 * keeps the two back in 1:1 correspondence for anyone reading the
 * filesystem directly.
 */
export class FixtureWriter {
  private n = 0;
  private readonly out: string;
  private readonly raw: string;

  constructor(
    private readonly address: string,
    private readonly redactSecrets: (text: string) => string,
    root: string = join("fixtures", "fishing-casts", "live"),
  ) {
    this.out = join(root, `cast-${stamp()}`);
    this.raw = join(this.out, "raw");
    mkdirSync(this.raw, { recursive: true });
  }

  write(body: unknown): void {
    const tag = String(this.n).padStart(3, "0");
    const text = JSON.stringify(body, null, 2);
    writeFileSync(join(this.raw, `state-${tag}.json`), text);
    writeFileSync(join(this.out, `state-${tag}.json`), redact(text, this.address, this.redactSecrets));
    this.n++;
  }

  get dir(): string {
    return this.out;
  }
}

export class RunLog {
  private readonly path: string;
  constructor(dir: string = "logs") {
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, `fishing-${stamp()}.jsonl`);
  }
  write(entry: Record<string, unknown>): void {
    writeFileSync(this.path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n", { flag: "a" });
  }
  get filePath(): string {
    return this.path;
  }
}

/**
 * Session 17, QUESTIONS.md §10: the account got stuck after this project's
 * first-ever live catch (session 15) because the terminal `play_cards`
 * response carries fields (`cardsToAdd`, per that capture) this loop never
 * modelled or acted on. `fixtures.write()` already saves every raw response
 * regardless, but that's easy to miss buried in `fixtures/fishing-casts/`.
 * This writes a SEPARATE, loudly-named dump the moment a terminal
 * (`COMPLETE_CID: true`) response carries any field outside
 * `KNOWN_DOC_DATA_KEYS`/`KNOWN_DOC_TOP_KEYS` — turning the next catch (or
 * any future new terminal mechanic) into an automatic capture instead of
 * something that needs a human to notice mid-session, per the session-17
 * brief §4.
 */
function dumpUnknownTerminal(resp: unknown, keys: string[], tag: string = "terminal", dir: string = "logs"): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `fishing-unknown-${tag}-${stamp()}.json`);
  writeFileSync(path, JSON.stringify({ ts: new Date().toISOString(), unknownKeys: keys, response: resp }, null, 2));
  return path;
}

// ---------------------------------------------------------------------------
// Dual Yield — forward detection only [session 30, brief §3]. User-reported
// skill (level 2, ~4% stated chance to catch 2 fish at once), added to the
// account AFTER the existing corpus was captured — DECISIONS 2026-08-17
// (session 27) checked every real catch already on record and found none
// with a second fish (single `caughtFish` object every time, the largest
// `gameItemBalanceChanges` seen has exactly 2 entries: one fish + one
// currency credit), consistent with ~4%-per-catch and too few real catches
// to expect a hit yet — not evidence the skill doesn't work. Nothing to
// backfill; this detects the next live occurrence instead.
//
// Two independent signals, either is enough to flag a possible event — this
// project doesn't know which shape a real double-catch takes (two separate
// `loot`-eligible offers, one response with two `FISH_DIED` events, or an
// `itemId 845` "Hard Core" wire item ("A core of ontological hardware...")
// shape this project hasn't seen yet), so it watches for anything that
// looks like MORE than one fish landing in a single response rather than
// betting on one specific shape:
//  1. `data.events[]` containing 2+ `FISH_DIED` entries in one response.
//  2. The top-level `gameItemBalanceChanges` array crediting 2+ DISTINCT
//     item ids that are NOT the known currency id (845, "Hard Core") — a
//     normal single catch already credits one fish item + one currency
//     amount together (DECISIONS 2026-08-17 session 27), so this excludes
//     that id specifically rather than flagging every ordinary catch.
// ---------------------------------------------------------------------------

/** Wire item id, `NAME_CID: "Hard Core"` — see `src/sim/dungeonReport.ts`'s `ITEM_HARD_CORE` for the dungeon-side capture; duplicated here rather than imported to keep this fishing script decoupled from the dungeon report module for one constant. */
const ITEM_HARD_CORE = 845;

export function detectPossibleDualYield(raw: unknown): { reason: string } | null {
  const body = raw as
    | { data?: { events?: { type?: string }[] | null }; gameItemBalanceChanges?: { id: number }[] | null }
    | undefined;

  const fishDiedCount = (body?.data?.events ?? []).filter((e) => e?.type === "FISH_DIED").length;
  if (fishDiedCount >= 2) return { reason: `${fishDiedCount} FISH_DIED events in one response` };

  const nonCurrencyIds = new Set(
    (body?.gameItemBalanceChanges ?? []).map((c) => c.id).filter((id) => id !== ITEM_HARD_CORE),
  );
  if (nonCurrencyIds.size >= 2) {
    return { reason: `${nonCurrencyIds.size} distinct non-currency items credited in one response: ${[...nonCurrencyIds].join(", ")}` };
  }

  return null;
}

/** Runs `detectPossibleDualYield` against a response and, if it fires, dumps the full raw response and logs loudly — same pattern as the unknown-terminal-field detector. */
function checkPossibleDualYield(raw: unknown, log: RunLog, turn: number, source: string, logsDir: string): void {
  const hit = detectPossibleDualYield(raw);
  if (!hit) return;
  const path = dumpUnknownTerminal(raw, [`possible_dual_yield: ${hit.reason}`], "dual-yield", logsDir);
  log.write({ event: "possible_dual_yield_event", source, turn, reason: hit.reason, dump: path });
  console.log(`  ★★★ POSSIBLE DUAL YIELD EVENT (${source}, turn ${turn}): ${hit.reason}`);
  console.log(`  ★★★ full response dumped to ${path} — QUESTIONS.md, needs a human look before treating this as confirmed.`);
}

// ---------------------------------------------------------------------------
// The live cast loop.
// ---------------------------------------------------------------------------

export interface LiveFishingDeps {
  client: GigaverseClient;
  config: BotConfig;
  guards: GuardState;
  fixtures: FixtureWriter;
  log: RunLog;
  address: string;
  dryRun: boolean;
  transitionsPath?: string;
  guardStatePath?: string;
  /** [session 30] Validation-only recording of predicted vs. actual `nextPosition` — see this file's "nextPosition validation" section. */
  nextPositionLogPath?: string;
  /** [session 45] Path for the per-turn ring-prediction log (see `appendRingPrediction`). Tests MUST override this — CLAUDE.md working-style, "tests must never write to a real data path". */
  ringPredictionLogPath?: string;
  /** Directory `dumpUnknownTerminal`/`checkPossibleDualYield` write surprise-field dumps into. Defaults to the real `logs/` — tests must override this, same as every other I/O path here (CLAUDE.md working-style, "tests must never write to a real data path"). */
  logsDir?: string;
  /**
   * Task 10: graceful SIGINT, same contract as `LiveRunDeps.shutdownSignal`
   * (`scripts/liveRun.ts`) — checked once per turn, after confirming the
   * cast isn't already complete and BEFORE the next card is chosen/sent.
   */
  shutdownSignal?: ShutdownSignal;
  /**
   * [session 45, brief §1/§5] Use the step-class RING movement model
   * (`src/strategy/fishing/stepClass.ts`) as the predictor. Threaded as a
   * real parameter rather than hardcoded, same pattern as
   * `heuristicsEnabled` in sessions 43/44, so a live batch can be run with
   * and without it and the sim ablations can address the same switch.
   *
   * Default `true`: the model cleared its leave-one-cast-out gate on the real
   * corpus by a wide margin on BOTH axes it was gated on (log loss 1.074 vs.
   * the cell+prev baseline's 3.733, top-1 48.2% vs. 42.0% —
   * `scripts/fishingRingCV.ts`), and unlike every other fishing heuristic
   * shipped so far it rests on an exceptionless corpus fact (FACT 1, 259/259)
   * rather than on an unvalidated plausibility argument.
   */
  ringModelEnabled?: boolean;
  /**
   * [session 45, brief §3] Weight on `cardChoice.ts`'s focus-reserve
   * continuation term — the fix for SPEC-fishing.md §4c's focus-budget
   * exhaustion. See `DEFAULT_FOCUS_RESERVE_WEIGHT` for where the value comes
   * from and `scripts/focusReserveAblation.ts` for the sweep.
   */
  focusReserveWeight?: number;
}

export type CastOutcome = "dry_run" | "caught" | "escaped" | "turn_cap" | "shutdown";

export interface CastRunResult {
  outcome: CastOutcome;
  turns: number;
}

/** Safety cap only — SPEC.md §5 names no real max-turns figure; this exists solely to guard against an infinite-loop bug, not to model the game. */
const MAX_TURNS = 60;

export async function runOneCast(deps: LiveFishingDeps): Promise<CastRunResult> {
  const { client, config, guards, fixtures, log, address, dryRun } = deps;
  const transitionsPath = deps.transitionsPath ?? DEFAULT_TRANSITIONS_PATH;
  const nextPositionLogPath = deps.nextPositionLogPath ?? DEFAULT_NEXT_POSITION_LOG_PATH;
  const ringPredictionLogPath = deps.ringPredictionLogPath ?? DEFAULT_RING_PREDICTION_LOG_PATH;
  const logsDir = deps.logsDir ?? "logs";
  const ringModelEnabled = deps.ringModelEnabled ?? true;
  const focusReserveWeight = deps.focusReserveWeight ?? DEFAULT_FOCUS_RESERVE_WEIGHT;
  // [session 30] Set when the PRIOR turn's response revealed a non-null
  // `nextPosition` — validated against the NEXT turn's actual position, then
  // cleared. Reset per cast (not carried across a resume): attributing a
  // prediction across a process boundary risks validating against the wrong
  // turn if the resumed doc's position doesn't line up exactly.
  let pendingPrediction: { turn: number; cell: Cell } | null = null;

  if (!config.dendren) {
    throw new Error(
      "config/bot.json and config/discovered.json need a `dendren` block before fishing can run — Task 7's discovery.",
    );
  }
  const dendren = config.dendren;

  const existing = await client.getFishingState(address);
  let doc: FishingGameDoc;

  if (existing.gameState && existing.gameState.COMPLETE_CID) {
    // A terminal doc with an unrecognized field is worth dumping — that is
    // how QUESTIONS.md §10's CATCH shape (a pending `cardsToAdd` triple) was
    // first characterized, and it is genuinely resolvable, by `loot`.
    //
    // **[session 47, brief §1d] It is NOT a prediction that `start_run` will
    // reject, and this warning used to say it was.** It fired on every run
    // that saw any terminal doc and caused two consecutive misdiagnoses:
    // sessions 45 and 46 both attributed a `start_run` HTTP 400 to "the
    // account is stuck" when the server's own body said
    // `"Player has reached max runs for fishing"` — the daily cap, which no
    // doc state predicts. Session 46's misdiagnosis then propagated into the
    // session-47 brief as its first instruction.
    //
    // The condition this fires on is not the condition that rejects
    // `start_run`, so it now reports only what was observed. Diagnose a 400
    // from its BODY (`serverErrorDetail`, logged at the throw site below),
    // never from the doc.
    const unknown = unknownDocKeys(existing.gameState as unknown as Record<string, unknown>);
    if (unknown.length > 0) {
      const path = dumpUnknownTerminal(existing, unknown, "terminal", logsDir);
      log.write({ event: "unknown_terminal_fields", source: "pre_start_state_check", keys: unknown, dump: path });
      console.log(`  ★★★ UNKNOWN FIELD(S) on the existing completed-but-unresolved doc: ${unknown.join(", ")}`);
      console.log(`  ★★★ full response dumped to ${path}.`);
      console.log(`      A terminal doc is present. This does NOT by itself predict a start_run rejection —`);
      console.log(`      if start_run does fail below, read the 400's BODY, which is logged (session 46).`);
      console.log(`      QUESTIONS.md §10's stuck shape is the CATCH one (pending cardsToAdd), resolved by \`loot\`.`);
    }
  }

  if (existing.gameState && !existing.gameState.COMPLETE_CID) {
    console.log(`  · active cast already in progress — resuming rather than starting a new one`);
    log.write({ event: "resuming_existing_cast", docId: existing.gameState.docId });
    doc = existing.gameState;
  } else if (dryRun) {
    guards.assertCanStartRun(dendren.energyCostPerCast);
    log.write({ event: "dry_run_start_run_intended", nodeId: dendren.nodeId, tierId: dendren.tierId });
    console.log(`  [dry-run] would POST start_run (nodeId ${dendren.nodeId}, tierId ${dendren.tierId})`);
    console.log(`  · no active cast — nothing further to decide against, stopping.`);
    return { outcome: "dry_run", turns: 0 };
  } else {
    guards.assertCanStartRun(dendren.energyCostPerCast);
    const body = buildFishingEnvelope("start_run", client.getFishingActionToken(), {
      nodeId: dendren.nodeId,
      tierId: dendren.tierId,
    });
    log.write({ event: "post", body });
    let resp: FishingActionResponse;
    try {
      resp = await client.postFishingAction(body);
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      guards.recordActionResult(false);
      // [session 46] `.message` alone never carries the server's own text —
      // see `serverErrorDetail`. Both the classifier below and the log line
      // need the BODY, or the classifier is dead and the log is undiagnosable.
      const detail = serverErrorDetail(e);
      const message = detail.message;
      // [session 29, CODEXREVIEW #6] Fishing has no authoritative "today"
      // read endpoint to proactively check (unlike dungeon's GET
      // /game/dungeon/today), so this stays fail-closed on the real
      // rejection — but a CONFIRMED server-cap rejection (session 27's exact
      // real message) is now classified as a budget trip and marks the mode
      // exhausted for the rest of the persisted day, rather than propagating
      // as a generic anomaly that could take the whole orchestrator down
      // over one exhausted mode.
      if (/reached max runs/i.test(message)) {
        guards.recordServerCapReached();
        saveGuardBudget(guards.spentEnergy, guards.runCount, deps.guardStatePath);
        log.write({ event: "server_cap_reached", mode: "fishing", message });
        throw new GuardTrip("session run cap reached", { source: "server start_run rejection", message });
      }
      log.write({ event: "action_failed", reason: "start_run rejected", error: message, body: detail.body });
      throw new GuardTrip("fishing start_run rejected", { error: message, body: detail.body });
    }
    guards.recordActionResult(true);
    guards.recordRunStarted();
    // [session 31, CODEXREVIEW #8] Committed spend, recorded the moment
    // start_run succeeds — independent of whatever the account balance does
    // afterward. This is now the guard's ledger of record; the before/after
    // read in `main()` is a diagnostic only. See src/orchestrator/energyAccounting.ts.
    guards.recordEnergySpent(dendren.energyCostPerCast);
    saveGuardBudget(guards.spentEnergy, guards.runCount, deps.guardStatePath);
    log.write({ event: "post_response", resp });
    fixtures.write(resp);
    doc = resp.data.doc;
    console.log(`  ✓ start_run sent — fishing actionToken now ${client.getFishingActionToken()}`);
    if (doc.COMPLETE_CID) {
      const unknown = unknownDocKeys(doc as unknown as Record<string, unknown>);
      if (unknown.length > 0) {
        const path = dumpUnknownTerminal(resp, unknown, "terminal", logsDir);
        log.write({ event: "unknown_terminal_fields", keys: unknown, dump: path });
        console.log(`  ★★★ UNKNOWN TERMINAL FIELD(S) on start_run's returned doc: ${unknown.join(", ")}`);
        // [session 47, brief §1d] Same reword as the pre-start check above:
        // report what was seen, do not assert a mechanic. A start_run that
        // SUCCEEDED and came back terminal is a different and more
        // interesting event than the account being stuck.
        console.log(`  ★★★ full response dumped to ${path} — start_run succeeded but returned a terminal doc; look here first.`);
      }
    }
  }

  const castId = doc.docId;
  const gridSize = doc.data.gridSize;
  const startCell = fishCell(doc);
  const minedPatterns = loadMinedPatterns();
  const matcherCandidates = minedPatterns.map((p) => toCandidate(p, startCell, gridSize, MAX_TURNS));
  if (matcherCandidates.length > 0) {
    console.log(`  · matcher seeded with ${matcherCandidates.length} mined pattern(s): ${minedPatterns.map((p) => p.name).join(", ")}`);
  }
  let matcher: MatcherState = initMatcher(matcherCandidates, startCell);
  const transitionLog = loadTransitionLog(transitionsPath);
  // [session 33, CODEXIMPROVE #3] The context tier reads the SAME log file
  // but grouped by cast and filtered to `isCleanCast` (CODEXREVIEW #5's
  // resumed-numbering/gap exclusion, same discipline `mineFishPatterns.ts`
  // already applies before exact-match testing) — a corrupted cast must not
  // poison the (cell, previous-displacement) evidence. `transitionLog` above
  // is passed through UNCHANGED as the tier-2 cell-only fallback, so nothing
  // about the existing fallback's behavior when the context tier misses is
  // touched by this addition.
  const contextCasts = groupByCast(loadTransitionRecords(transitionsPath)).filter(isCleanCast);
  const contextMap = buildContextualMap(contextCasts);
  // [session 45] Same clean-cast corpus, a different summary of it — the
  // per-class delta table the ring model predicts from.
  const stepClassTable = buildStepClassTable(contextCasts);
  if (ringModelEnabled) {
    console.log(
      `  · ring model ON: class prior k=1 ${stepClassTable.classCasts.get(1) ?? 0} / k=2 ${stepClassTable.classCasts.get(2) ?? 0} cast(s), ` +
        `${stepClassTable.conditional.size} (class, prev-delta) key(s); focusReserveWeight ${focusReserveWeight}`,
    );
  }
  if (contextMap.size > 0) {
    console.log(`  · contextual fallback: ${contextMap.size} (cell, previous-direction) key(s) from ${contextCasts.length} clean logged cast(s)`);
  }

  // [session 29, CODEXREVIEW #5] Resume-numbering fix: derive the next turn
  // to log from whatever this castId already has on disk, instead of always
  // starting a resumed cast back at turn 0 (see lastRecordForCast's doc
  // comment for the concrete bug this caused). Before trusting the log
  // enough to keep appending to it, validate that its last logged position
  // actually matches where the resumed doc says the fish is right now — a
  // mismatch means this cast's on-disk history is untrustworthy, and
  // CLAUDE.md §1 says the live response wins: stop writing to the log for
  // THIS cast rather than risk compounding a numbering error, while still
  // playing the cast normally (the in-memory matcher above already anchors
  // on the live position regardless).
  const priorForCast = lastRecordForCast(castId, transitionsPath);
  let turn = priorForCast ? priorForCast.turn + 1 : 0;
  let trustTransitionLog = true;
  if (priorForCast) {
    const loggedPos: Cell = { x: priorForCast.to[0], y: priorForCast.to[1] };
    if (!cellsEqual(loggedPos, startCell)) {
      trustTransitionLog = false;
      log.write({ event: "resume_position_mismatch", castId, loggedPos, resumedPos: startCell, priorTurn: priorForCast.turn });
      console.log(
        `  ★★★ resume position mismatch for cast ${castId}: log says ${JSON.stringify(loggedPos)} at turn ${priorForCast.turn}, ` +
          `server says ${JSON.stringify(startCell)} — not appending further transitions for this cast this run.`,
      );
    } else {
      console.log(`  · resuming cast ${castId} at turn ${turn} (${priorForCast.turn + 1} prior transition(s) already logged)`);
    }
  }

  // [session 44] heuristic (c), QUESTIONS.md §16 now resolved by a live
  // capture of `use_fishing_item`. Read once per cast (not per turn) — a
  // second live call every turn just to check a count that only ever goes
  // DOWN within this cast would be wasteful; `relaxingOilHeld` is decremented
  // locally on each confirmed use instead. Best-effort: a failed balance
  // read leaves the count at 0, which safely disables the heuristic for this
  // cast rather than guessing a positive count.
  let relaxingOilHeld = 0;
  if (!dryRun) {
    try {
      const balances = await client.getItemsBalances();
      relaxingOilHeld = Number(
        balances.entities.find((e) => e.ID_CID === String(MID_RELAXING_OIL_ITEM_ID))?.BALANCE_CID ?? 0,
      );
      if (relaxingOilHeld > 0) {
        console.log(`  · Mid Relaxing Oil held: ${relaxingOilHeld} (heuristic (c) reserve floor applies)`);
      }
    } catch (e) {
      log.write({ event: "oil_balance_read_failed", error: (e as Error).message });
    }
  }
  // Set once a `use_fishing_item` POST is rejected, so a still-unconfirmed
  // `slotIndex` guess (see the schema's doc comment) doesn't get retried
  // every remaining turn of the same cast — one rejection is informative
  // enough without spamming the same failing request.
  let relaxingOilUseFailedThisCast = false;

  while (turn < MAX_TURNS) {
    if (doc.COMPLETE_CID) break;

    if (deps.shutdownSignal?.requested) {
      log.write({ event: "shutdown_requested", turn });
      console.log(`  ▸ SIGINT — stopping before the next card (turn boundary), cast left in progress at turn ${turn}.`);
      return { outcome: "shutdown", turns: turn };
    }

    if (
      !dryRun &&
      !relaxingOilUseFailedThisCast &&
      shouldConsiderRelaxingOil(doc.data.fishHp, doc.data.fishMaxHp, relaxingOilHeld)
    ) {
      console.log(
        `  ★ heuristic (c): fish at ${doc.data.fishHp}/${doc.data.fishMaxHp} HP (${relaxingOilHeld} Relaxing Oil held) — using one.`,
      );
      const oilBody = buildFishingEnvelope("use_fishing_item", client.getFishingActionToken(), {
        itemId: MID_RELAXING_OIL_ITEM_ID,
        // [session 44] slotIndex:0 is confirmed for item 821 only (the one
        // real capture) — unconfirmed for item 937. A wrong guess fails
        // closed via the catch block below, not a GuardTrip: this action is
        // an optional rescue, not a required step in playing the cast.
        slotIndex: 0,
      });
      log.write({ event: "post", body: oilBody });
      try {
        const oilResp = await client.postFishingAction(oilBody);
        log.write({ event: "post_response", resp: oilResp });
        fixtures.write(oilResp);
        doc = oilResp.data.doc;
        relaxingOilHeld -= 1;
        console.log(`  ✓ use_fishing_item (Mid Relaxing Oil): fish now ${doc.data.fishHp}/${doc.data.fishMaxHp}`);
        const unknown = unknownDocKeys(doc as unknown as Record<string, unknown>);
        if (unknown.length > 0) {
          const path = dumpUnknownTerminal(oilResp, unknown, "midcast", logsDir);
          log.write({ event: "unknown_fields", source: "use_fishing_item", turn, keys: unknown, dump: path });
          console.log(`  ★★★ UNKNOWN FIELD(S) on use_fishing_item's returned doc: ${unknown.join(", ")}`);
        }
      } catch (e) {
        relaxingOilUseFailedThisCast = true;
        if (e instanceof TokenExpiredError) throw e;
        const message = (e as Error).message;
        log.write({ event: "action_failed", reason: "use_fishing_item rejected", error: message });
        console.log(`  ✗ use_fishing_item rejected (${message}) — continuing cast without it (unconfirmed slotIndex hypothesis), not retrying this cast.`);
      }
    }

    const hand = buildHand(doc);
    const mana = doc.data.playerHp;
    const fishHp = doc.data.fishHp;
    // [session 30, gate rebuilt session 39 CODEXAUDIT #4] Override gated
    // behind a Wilson-score confidence bound on hits/attempts, not a raw hit
    // count (see this file's "nextPosition validation" section) — this
    // override has never armed live yet regardless of how many casts run
    // this session.
    const overrideStats = nextPositionOverrideStats(nextPositionLogPath);
    const nextPositionOverrideActive = pendingPrediction?.turn === turn && overrideStats.ready;
    if (nextPositionOverrideActive) {
      console.log(
        `  · nextPosition override ACTIVE (${overrideStats.hits}/${overrideStats.attempts} hits, ` +
          `Wilson lower bound ${(overrideStats.lowerBound * 100).toFixed(1)}%) — forcing focus toward predicted cell.`,
      );
    }
    // [session 46, brief §2] Heuristic (d) `pruneReturnToPrevious` used to
    // wrap the chosen distribution here. Retired as subsumed by
    // SPEC-fishing.md §9's conditional table — see `heuristics.ts`'s
    // tombstone. The tier pipeline below is now the whole story.
    // [session 45, brief §1 design note 3] Tier order with the ring model on:
    //   0. the mined-pattern matcher, while live candidates survive — but
    //      INTERSECTED with the legal step-class ring, since FACT 1 (259/259,
    //      `scripts/auditStepClass.ts`) makes an off-ring prediction provably
    //      wrong, and `chooseCard` consumes the whole distribution, so that
    //      mass would distort both the card pick and the focus placement. A
    //      candidate set that survives nothing after intersection is fully
    //      refuted and hands over to tier 1 for that turn.
    //   1. the ring model itself (class-aware, prev-delta conditional).
    //   2. `contextualFallback` — unchanged, now the tier-2 fallback.
    //   3. uniform, inside `emptyFallback`, unchanged.
    // With `ringModelEnabled: false` this collapses to exactly the
    // pre-session-45 two-tier pipeline.
    const currentCell = matcher.history[matcher.history.length - 1]!;
    const prevDelta = previousDisplacement(matcher.history);
    const stepClass = ringModelEnabled ? classifyStep(matcher.history) : null;
    const ringDist = ringModelEnabled
      ? stepClass === null
        ? ringDistributionUnknownClass(currentCell, prevDelta, stepClassTable, gridSize)
        : ringDistribution(currentCell, stepClass, prevDelta, stepClassTable, gridSize)
      : null;
    // [session 45, live-batch finding] The matcher tier gets the ring FLOOR
    // too, not just the ring intersection. Two turn-0 rows in this session's
    // own live batch had a fully-converged mined candidate assign p=1 to a
    // cell the fish did not reach and p=0 to the cell it did — an unbounded
    // log-loss event (`-log(1e-9)`) that the ring model's own floor exists
    // precisely to prevent, and which tier 0 was bypassing. Mixing the (
    // possibly ring-intersected) matcher distribution with the ring model at
    // `ringFloor` bounds it. Sim catch-rate effect is neutral within noise;
    // the justification is calibration, and it is a live observation, not a
    // sim one.
    const matcherDist = matcher.candidates.length > 0 ? predictDistribution(matcher) : null;
    const rawDist = matcherDist
      ? ringModelEnabled
        ? mixDistributions(
            stepClass !== null
              ? (intersectWithRing(matcherDist, currentCell, stepClass, gridSize) ?? ringDist!)
              : matcherDist,
            ringDist!,
            1 - DEFAULT_RING_MODEL_OPTIONS.ringFloor,
          )
        : matcherDist
      : (ringDist ??
        contextualFallback(
          currentCell,
          prevDelta,
          contextMap,
          transitionLog,
          gridSize,
          { shrinkageK: DEFAULT_SHRINKAGE_K },
        ));
    const dist = nextPositionOverrideActive ? certainDistribution(pendingPrediction!.cell) : rawDist;

    // [session 46, brief §1b] The paired baseline, computed on this same
    // turn but NEVER consumed by the policy — it exists only to be scored
    // against the live distribution above. This is deliberately the plain
    // `contextualFallback` call, matching `fishingRingCV.ts`'s
    // "cell + prev-displacement (shipped backoff)" arm exactly, so the live
    // paired difference is on the same footing as the offline 3.536.
    const baselineDist = contextualFallback(
      currentCell,
      prevDelta,
      contextMap,
      transitionLog,
      gridSize,
      { shrinkageK: DEFAULT_SHRINKAGE_K },
    );
    const baselineTop = topCellOf(baselineDist);

    // [session 45, brief §5.4] Remember what we predicted, to be scored
    // against the fish's real move once this turn's response comes back.
    const predictionTier: RingPredictionRecord["tier"] = nextPositionOverrideActive
      ? "override"
      : matcherDist
        ? ringModelEnabled && stepClass !== null
          ? "matcher_ring"
          : "matcher"
        : ringDist
          ? stepClass === null
            ? "ring_unknown_class"
            : "ring"
          : "contextual";
    const predictedTop = topCellOf(dist);

    const best = chooseCard(hand, mana, dist, gridSize, 1, fishHp, focusBudget(doc), true, focusReserveWeight);
    if (best && shouldRedraw(best, hand.length, mana, REDRAW_THRESHOLD)) {
      log.write({ event: "redraw_indicated_not_sent", turn, reason: "redraw action unconfirmed, SPEC-fishing.md §7" });
    }
    if (!best) {
      log.write({ event: "no_affordable_card", turn, hand, mana });
      console.log(`  ✗ no affordable card in hand (mana ${mana}) — halting per CLAUDE.md §5.`);
      throw new GuardTrip("fishing: no affordable card in hand", { hand, mana });
    }

    console.log(
      `  ▸ turn ${turn}: card ${best.card.id} @ focus [${best.focus.x},${best.focus.y}]` +
        ` (P_hit ${(best.pHit + best.pCrit).toFixed(2)}, ev ${best.ev.toFixed(1)}${best.lethal ? ", LETHAL" : ""})`,
    );
    log.write({
      event: "decision",
      turn,
      cardId: best.card.id,
      handIndex: best.handIndex,
      focus: best.focus,
      pHit: best.pHit,
      pCrit: best.pCrit,
      ev: best.ev,
      lethal: best.lethal,
    });

    if (dryRun) {
      console.log(`  [dry-run] would POST play_cards`);
      return { outcome: "dry_run", turns: turn };
    }

    const body = buildFishingEnvelope("play_cards", client.getFishingActionToken(), {
      cards: [best.handIndex],
      focusPoint: [best.focus.x, best.focus.y],
    });
    log.write({ event: "post", body });
    let resp: FishingActionResponse;
    try {
      resp = await client.postFishingAction(body);
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      guards.recordActionResult(false);
      const detail = serverErrorDetail(e);
      log.write({ event: "action_failed", reason: "play_cards rejected", error: detail.message, body: detail.body });
      throw new GuardTrip("fishing play_cards rejected", { error: detail.message, body: detail.body });
    }
    guards.recordActionResult(true);
    log.write({ event: "post_response", resp });
    fixtures.write(resp);
    checkPossibleDualYield(resp, log, turn, "play_cards", logsDir);

    const newDoc = resp.data.doc;
    // Session 26: widened from terminal-only (COMPLETE_CID) to EVERY turn —
    // QUESTIONS.md §12 found nextPosition/nextMovePath firing on a non-
    // terminal turn in the existing fixture corpus, which the old
    // terminal-only check could never have surfaced live. Data is already
    // captured every turn via fixtures.write() above; this only adds an
    // immediate console/log signal so a rare field doesn't wait for a
    // fixture-corpus audit to be noticed.
    {
      const unknown = unknownDocKeys(newDoc as unknown as Record<string, unknown>);
      if (unknown.length > 0) {
        const tag = newDoc.COMPLETE_CID ? "terminal" : "midcast";
        const path = dumpUnknownTerminal(resp, unknown, tag, logsDir);
        log.write({ event: "unknown_fields", source: newDoc.COMPLETE_CID ? "play_cards_terminal" : "play_cards_midcast", turn, keys: unknown, dump: path });
        console.log(`  ★★★ UNKNOWN ${newDoc.COMPLETE_CID ? "TERMINAL " : ""}FIELD(S) on turn ${turn}'s doc: ${unknown.join(", ")}`);
        console.log(`  ★★★ full response dumped to ${path}.`);
      }
    }
    const fromCell = matcher.history[matcher.history.length - 1]!;
    const toCell = fishCell(newDoc);

    // [session 30] nextPosition validation-only pass — see this file's
    // "nextPosition validation" section. Checks the PRIOR turn's prediction
    // (if any) against this turn's real position, then records whatever
    // THIS turn's response reveals for the next iteration to check.
    if (pendingPrediction) {
      const hit = cellsEqual(toCell, pendingPrediction.cell);
      const validation: NextPositionValidation = {
        ts: new Date().toISOString(),
        castId,
        turn,
        predicted: [pendingPrediction.cell.x, pendingPrediction.cell.y],
        actual: [toCell.x, toCell.y],
        hit,
        gridSize,
      };
      appendNextPositionValidation(validation, nextPositionLogPath);
      log.write({ event: "next_position_validation", ...validation });
      console.log(`  · nextPosition validation: predicted ${JSON.stringify(pendingPrediction.cell)}, actual ${JSON.stringify(toCell)} — ${hit ? "HIT" : "miss"}.`);
      pendingPrediction = null;
    }
    const predictedNext = extractNextPosition(newDoc);
    if (predictedNext) pendingPrediction = { turn: turn + 1, cell: predictedNext };

    if (predictedTop) {
      const hit = cellsEqual(toCell, predictedTop.cell);
      // [session 46, brief §1d] A miss pushes `fishHp` toward `fishMaxHp`
      // (the confirmed catch-meter direction, QUESTIONS.md §15), so a
      // DECREASE is the unambiguous signal that the played card connected —
      // read off the doc rather than parsed out of the event list, which is
      // one fewer wire shape to be wrong about.
      const realizedHit = newDoc.data.fishHp < fishHp;
      const rec: RingPredictionRecord = {
        ts: new Date().toISOString(),
        castId,
        turn,
        tier: predictionTier,
        stepClass,
        predicted: [predictedTop.cell.x, predictedTop.cell.y],
        pPredicted: predictedTop.p,
        pActual: dist.get(cellKey(toCell))?.p ?? 0,
        actual: [toCell.x, toCell.y],
        hit,
        gridSize,
        baselinePredicted: baselineTop ? [baselineTop.cell.x, baselineTop.cell.y] : undefined,
        baselinePPredicted: baselineTop?.p,
        baselinePActual: baselineDist.get(cellKey(toCell))?.p ?? 0,
        baselineHit: baselineTop ? cellsEqual(toCell, baselineTop.cell) : undefined,
        playedCardId: best.card.id,
        playedFocus: [best.focus.x, best.focus.y],
        pHitPredicted: best.pHit + best.pCrit,
        realizedHit,
        zoneMapVersion: CURRENT_ZONE_MAP_VERSION,
      };
      appendRingPrediction(rec, ringPredictionLogPath);
      log.write({ event: "ring_prediction", ...rec });
      console.log(
        `  · predictors: ring p(actual)=${rec.pActual.toFixed(3)} ${hit ? "TOP1" : "    "}` +
          ` | baseline p(actual)=${(rec.baselinePActual ?? 0).toFixed(3)} ${rec.baselineHit ? "TOP1" : "    "}` +
          ` | shot P_hit ${(rec.pHitPredicted ?? 0).toFixed(2)} → ${realizedHit ? "HIT" : "miss"}`,
      );
    }

    const transitionRec: TransitionRecord = {
      ts: new Date().toISOString(),
      castId,
      turn,
      from: [fromCell.x, fromCell.y],
      to: [toCell.x, toCell.y],
      gridSize,
    };
    if (trustTransitionLog) appendTransition(transitionRec, transitionsPath);
    const arr = transitionLog.get(cellKey(fromCell)) ?? [];
    arr.push(toCell);
    transitionLog.set(cellKey(fromCell), arr); // later turns in THIS cast benefit too, not just future casts

    matcher = observe(matcher, toCell);
    doc = newDoc;
    turn++;

    const stateKey = JSON.stringify({ turn, fishHp: doc.data.fishHp, mana: doc.data.playerHp, hand: doc.data.hand });
    guards.checkStateProgress(stateKey);
  }

  const outcome: CastOutcome = !doc.COMPLETE_CID ? "turn_cap" : doc.SUCCESS_CID ? "caught" : "escaped";
  log.write({ event: "cast_over", outcome, turns: turn, success: doc.SUCCESS_CID ?? null, complete: doc.COMPLETE_CID });
  console.log(`  ▸ cast over: ${outcome} after ${turn} turns${doc.SUCCESS_CID ? " — CAUGHT!" : ""}`);

  // Session 17, QUESTIONS.md §10 (CONFIRMED): a catch leaves `cardsToAdd`
  // (3 new-card offers) unresolved until `loot` picks one by real card id
  // — until then the account rejects every future `start_run` ("Player is
  // already in a game"), the exact stuck state that blocked all of session
  // 15/16's further fishing. Resolving it immediately here means the bot's
  // OWN catches never leave the account stuck for a human to notice.
  if (doc.SUCCESS_CID && doc.data.cardsToAdd && doc.data.cardsToAdd.length > 0 && doc.data.cardChosenId == null) {
    const chosen = chooseNewCard(doc.data.cardsToAdd);
    console.log(`  ★ caught! resolving cardsToAdd offer (${doc.data.cardsToAdd.map((c) => c.id).join(", ")}) -> chose id ${chosen.id}`);
    const lootBody = buildFishingEnvelope("loot", client.getFishingActionToken(), { cards: [chosen.id] });
    log.write({ event: "post", body: lootBody });
    if (!dryRun) {
      try {
        const lootResp = await client.postFishingAction(lootBody);
        guards.recordActionResult(true);
        log.write({ event: "post_response", resp: lootResp });
        fixtures.write(lootResp);
        checkPossibleDualYield(lootResp, log, turn, "loot", logsDir);
        const resolvedDeck = lootResp.data.doc.data.fullDeck.length;
        console.log(`  ✓ loot sent — fullDeck now ${resolvedDeck} card(s), cardChosenId ${lootResp.data.doc.data.cardChosenId ?? "still null?"}`);
      } catch (e) {
        if (e instanceof TokenExpiredError) throw e;
        guards.recordActionResult(false);
        const lootDetail = serverErrorDetail(e);
        log.write({ event: "action_failed", reason: "loot rejected", error: lootDetail.message, body: lootDetail.body });
        console.log(`  ✗ loot rejected — account may be left in the stuck-until-resolved state; see QUESTIONS.md §10.`);
        throw new GuardTrip("fishing loot rejected", { error: lootDetail.message });
      }
    }
  }

  return { outcome, turns: turn };
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const status = argv.includes("--status");
  const castsArg = argv.find((a) => a.startsWith("--casts="));
  const casts = castsArg ? Number(castsArg.split("=")[1]) : 1;
  // [session 47, brief §1a] Opt OUT of the ROM-claim preflight. The default is
  // to claim, per the brief's §0a lifting of the session-19/20 ask-first
  // instruction; this flag exists for the case where the operator wants the
  // pool left exactly as it is (e.g. measuring regen).
  const noRomClaim = argv.includes("--no-rom-claim");
  return { dryRun, status, casts, noRomClaim };
}

/**
 * [session 15, brief §5] Mirrors scripts/liveRun.ts's `--status` — local
 * state only (`config/bot.json`/`config/discovered.json` +
 * `data/guard-budget-fishing.json`), no network call.
 */
function printStatus(config: BotConfig): void {
  console.log(`\n▸ liveFishing.ts --status (${todayKey()})\n`);
  if (!config.dendren) {
    console.log(`  fishing: no dendren block in config — Task 7 not configured\n`);
    return;
  }
  const seed = loadGuardBudget(FISHING_GUARD_STATE_PATH);
  const castsRemaining = Math.max(0, config.dendren.maxCastsPerSession - seed.runsStarted);
  const energyRemaining = Math.max(0, config.dendren.dailyEnergyBudget - seed.energySpent);
  console.log(`  fishing casts:   ${seed.runsStarted}/${config.dendren.maxCastsPerSession} used  ->  ${castsRemaining} remaining`);
  console.log(`  fishing energy:  ${seed.energySpent}/${config.dendren.dailyEnergyBudget} used  ->  ${energyRemaining} remaining\n`);
}

async function currentEnergy(client: GigaverseClient, address: string): Promise<number> {
  const energy = await client.getEnergy(address);
  const value = energy.entities[0]?.parsedData?.energyValue;
  if (typeof value !== "number") {
    throw new Error("GET /offchain/player/energy — entities[0].parsedData.energyValue missing or not a number");
  }
  return value;
}

export const FISHING_GUARD_STATE_PATH = join("data", "guard-budget-fishing.json");

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.status) {
    printStatus(loadBotConfig());
    return;
  }

  console.log(`\n▸ liveFishing.ts — ${args.dryRun ? "dry-run" : `${args.casts} cast(s)`}\n`);

  const config = loadBotConfig();
  if (!config.dendren) {
    console.error(`✗ config/bot.json or config/discovered.json has no dendren block — run Task 7's discovery first.`);
    process.exit(1);
  }
  const client = new GigaverseClient();

  // [session 28, CODEXREVIEW #2] Same discipline as liveRun.ts — one live
  // writer per guard-state file for the whole process lifetime.
  process.once("exit", acquireGuardLock(FISHING_GUARD_STATE_PATH));

  const seed = loadGuardBudget(FISHING_GUARD_STATE_PATH);
  if (seed.energySpent > 0 || seed.runsStarted > 0) {
    console.log(`  · resuming today's fishing budget: ${seed.energySpent} energy / ${seed.runsStarted} casts already spent`);
  }
  const guards = new GuardState(
    {
      dailyEnergyBudget: config.dendren.dailyEnergyBudget,
      maxRunsPerSession: config.dendren.maxCastsPerSession,
      maxConsecutiveActionFailures: config.maxConsecutiveActionFailures,
    },
    seed,
  );
  const log = new RunLog();

  const me = await client.getMe();
  console.log(`  account <USER>`);

  // [session 45, TASKS.md Task 10] Graceful SIGINT, wired into this direct-CLI
  // entry point's own `main()` — `runOneCast` has accepted a `shutdownSignal`
  // since Task 10, but only `scripts/orchestrator.ts` ever constructed and
  // installed one, so `kill -INT` on a `npx tsx scripts/liveFishing.ts`
  // process fell through to Node's default immediate termination instead of
  // the documented "stop before the next card" path. Found live in session 44
  // (harmless that time, by circumstance rather than by the mechanism), and
  // hit again in session 45's own batch. Same construction as
  // `orchestrator.ts`'s, including the between-casts check below: a second
  // press force-exits.
  const shutdownSignal = createShutdownSignal();
  const uninstallSigint = installProcessSigintHandler(shutdownSignal);

  const targetCasts = args.dryRun ? 1 : args.casts;

  // [session 47, brief §1a] Energy preflight — reads the REAL pool and, if it
  // is short of what this batch costs, tops it up from the ROM bank before
  // spending a single request on `start_run`.
  //
  // Session 46 planned a batch off `data/guard-budget-fishing.json` (which
  // said 2 casts were available; the server said zero) and then reported the
  // batch blocked on a 12.5-hour regen wait while 2,603 energy sat claimable
  // across 27 ROMs. Both halves of that are addressed here: the pool is read
  // live, and the ROM bank is read live rather than inferred.
  //
  // This does NOT raise any ceiling — `guards` still enforces
  // `config/bot.json`'s daily budget and the per-session cast cap below, and
  // spending above the configured daily budget remains on CLAUDE.md's
  // ask-first list. It only ensures the account pool can fund a batch the
  // guards have already authorized.
  if (!args.dryRun && !args.noRomClaim) {
    const requiredEnergy = targetCasts * config.dendren.energyCostPerCast;
    const preflight = await ensureEnergyFor(requiredEnergy, clientEnergyPreflightDeps(client, me.address, (line) => console.log(line)));
    log.write({ event: "energy_preflight", ...preflight });
  } else if (args.noRomClaim) {
    console.log(`  · --no-rom-claim: skipping the energy preflight; the pool is used exactly as-is.`);
  }

  let lastFixturesDir = "";
  for (let i = 0; i < targetCasts; i++) {
    if (shutdownSignal.requested) {
      console.log(`\n▸ stopped by SIGINT before cast ${i + 1}/${targetCasts}.`);
      break;
    }
    console.log(`\n▸ cast ${i + 1}/${targetCasts}`);
    // [session 28, CODEXREVIEW #1] Fresh per cast, not once per invocation —
    // one directory must correspond to exactly one docId. See FixtureWriter's
    // own doc comment.
    const fixtures = new FixtureWriter(me.address, (text) => client.redactSecrets(text));
    lastFixturesDir = fixtures.dir;
    const before = args.dryRun ? null : await currentEnergy(client, me.address);
    // [session 31, CODEXREVIEW #8] Captured before `runOneCast` so the diff
    // against `guards.spentEnergy` afterward isolates exactly what THIS
    // iteration committed (0 on a resume — no new start_run sent).
    const committedBefore = guards.spentEnergy;
    let castError: unknown = null;
    let result: CastRunResult | null = null;
    try {
      result = await runOneCast({
        client,
        config,
        guards,
        fixtures,
        log,
        address: me.address,
        dryRun: args.dryRun,
        guardStatePath: FISHING_GUARD_STATE_PATH,
        shutdownSignal,
      });
    } catch (e) {
      castError = e;
    }
    if (before !== null) {
      // [session 31, CODEXREVIEW #8] Diagnostic only — the guard was already
      // enforced off the COMMITTED spend inside `runOneCast`. This
      // before/after read is reconciled against it, not fed back in.
      const after = await currentEnergy(client, me.address);
      const committedDelta = guards.spentEnergy - committedBefore;
      const report = reconcileEnergyAccounting(before, after, committedDelta);
      log.write({ event: "energy_accounting", ...report });
      console.log(describeEnergyAccounting(report));
    }
    if (castError) throw castError;
    if (result?.outcome === "dry_run") break;
    if (result?.outcome === "shutdown") {
      console.log(`\n▸ stopped by SIGINT mid-cast — the cast is left resumable, not force-completed.`);
      break;
    }
  }
  uninstallSigint();

  console.log(`\n▸ done. energy spent (guard-tracked) ${guards.spentEnergy}, casts ${guards.runCount}`);
  console.log(`▸ log: ${log.filePath}`);
  console.log(`▸ fixtures: fixtures/fishing-casts/live/ (${targetCasts} cast dir(s), last: ${lastFixturesDir})`);
  console.log(`▸ transitions: ${DEFAULT_TRANSITIONS_PATH}\n`);

  // [session 31] Standalone invocations (Task 9) now regenerate the
  // committed run-visibility reports too, same as orchestrator.ts's
  // end-of-session rollup — see regenerateReports.ts.
  regenerateRunReports(config);
}

const isMain = process.argv[1] && process.argv[1].endsWith("liveFishing.ts");
if (isMain) {
  main().catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    if (e instanceof GuardTrip) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof EnergyPreflightError) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof UnexpectedResponseError) console.error(`  status ${e.status}  path ${e.path}\n  body: ${e.body}`);
    process.exit(1);
  });
}
