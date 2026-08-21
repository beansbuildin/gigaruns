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
import { resolveProfile, profileArg, dataPath, fixturePath } from "../src/profile.js";
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
  estimateSwitchProbability,
  SWITCH_PROBABILITY_FLOOR,
  intersectWithRing,
  lastStepClass,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  DEFAULT_SWITCH_PROBABILITY,
} from "../src/strategy/fishing/stepClass.js";
import {
  mayConsumeOil,
  MID_RELAXING_OIL_ITEM_ID,
  MID_FOCUS_OIL_ITEM_ID,
  type OilBudgetConfig,
} from "../src/strategy/fishing/oilPolicy.js";
import {
  appendOilCastState,
  DEFAULT_OIL_CAST_STATE_PATH,
} from "../src/strategy/fishing/oilCastState.js";
import {
  classifyPredictionOutcome,
  describeArmState,
  disarmOverride,
  readArmState,
  tripsWire,
  DEFAULT_NEXT_POSITION_ARM_STATE_PATH,
  type OverrideDisarmRecord,
} from "../src/strategy/fishing/nextPositionArm.js";
import {
  onDemandTriggers,
  PAYLOAD_OIL_EFFECTS,
  type OilKind,
} from "../src/strategy/fishing/oilTiming.js";
import {
  evaluateOilShadow,
  snapshotOilDecision,
  type OilShadowRecord,
} from "../src/strategy/fishing/oilShadow.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { supportingCastCount } from "../src/sim/fishing/patternMining.js";
import {
  initMatcherPosterior,
  matcherPriorFromSupport,
  matcherWeight,
  probabilityOf,
  updateMatcherPosterior,
  DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  type MatcherPosteriorOptions,
} from "../src/strategy/fishing/matcherPosterior.js";
import { cellKey, cellsEqual, inGrid, manhattan, type Cell } from "../src/sim/fishing/geometry.js";
import { REDRAW_THRESHOLD } from "../src/sim/fishing/castSim.js";
import { resolvePatternsByName, toCandidate, type Pattern } from "../src/sim/fishing/patterns.js";
import type { ShutdownSignal } from "../src/orchestrator/shutdown.js";
import { redactNoobToken } from "../src/api/redact.js";
import { dendrenCastsRemaining } from "../src/api/fishingLedger.js";
import { SESSION_64_LIMITS, SESSION_65_LIMITS, batchVerdict } from "../src/strategy/fishing/oilBatch.js";
import { castOutcomesChronological, loadFishingCorpus } from "../src/sim/fishingCorpus.js";
import { evaluateZeroStreak } from "../src/strategy/fishing/zeroStreak.js";

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
  // [session 53 §4] Resolves through the de-aliasing map, so a library mined
  // before the pool was deduped still loads — a retired name maps onto the
  // primitive it is provably identical to, and the duplicate collapses rather
  // than handing one hypothesis two shares of the matcher's prior mass.
  const { patterns, unresolved } = resolvePatternsByName(names);
  if (unresolved.length > 0) {
    console.warn(`  ⚠ ${path}: ${unresolved.length} pattern name(s) match nothing in the pool and were dropped: ${unresolved.join(", ")}`);
  }
  return patterns;
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

/**
 * [session 65 §1] **The first UNUSED consumable slot, read off the server's own
 * ledger.** `null` means there is no slot to use and no consume may be sent.
 *
 * ## Why this exists — MEASURED, live, session 65 cast 13019682
 *
 * `slotIndex` was hard-coded to 0 at this call site since session 44. That is
 * correct for the FIRST consume of a cast and wrong for every one after it:
 * the server marks the slot used and rejects a second consume aimed at it.
 *
 *   state-003  consumablesUsed 1  fishingConsumableSlotUsed [T,F,F]   (942 accepted)
 *   state-004  consumablesUsed 1  fishingConsumableSlotUsed [T,F,F]
 *   → second `use_fishing_item` at slotIndex 0 → **HTTP 400**
 *
 * This is the open question session 64 recorded as "`slotIndex` for a SECOND
 * consume within one cast is UNCONFIRMED". It is now confirmed, and the answer
 * is that the index is not a constant at all — it is a cursor over the
 * server's own three-slot ledger.
 *
 * Fails CLOSED (rule 5) in both directions: an absent field returns `null`
 * rather than guessing 0, and a full ledger returns `null` rather than
 * wrapping around onto a used slot.
 */
export function nextConsumableSlot(slotUsed: boolean[] | undefined): number | null {
  if (!Array.isArray(slotUsed) || slotUsed.length === 0) return null;
  const idx = slotUsed.findIndex((used) => !used);
  return idx === -1 ? null : idx;
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
  /**
   * [session 49, brief §5] True for a record RECOVERED from a committed
   * fixture rather than written by the live loop as it happened.
   *
   * The gate this ledger feeds (`NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND`
   * over `NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS`) decides whether the bot
   * trusts the server's own pre-rolled next cell over its own model. Moving
   * a live gate with rows its author never sanctioned needs an audit trail,
   * so the provenance is in the row rather than in a comment: absent means
   * "the live path wrote this", `true` means "reconstructed from a fixture,
   * and here is the fixture" in `source`.
   */
  backfilled?: boolean;
  /** Fixture path a `backfilled` record was recovered from. Absent on live rows. */
  source?: string;
  /**
   * [session 66 §1] Whether the override actually STEERED card choice on this
   * turn, as opposed to the prediction merely being watched. Optional because
   * the 12 rows written before this field existed cannot be re-attributed —
   * and absence must be read as UNKNOWN, never as "acted on". Nothing gates on
   * this field; the tripwire fires from the live classification at the moment
   * of the miss, not from a replay of the ledger.
   */
  overrideActive?: boolean;
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
    backfilled: z.boolean().optional(),
    source: z.string().optional(),
    overrideActive: z.boolean().optional(),
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

  // ---- [session 49, brief §3] the focus SPEND, measured live ---------------
  // Session 48's §5c decomposition — 80.8% meter-out, 50.4% of turns at focus
  // zero, 1.62 of 3 points on the opening move — was measured on the RECORDED
  // corpus, i.e. on what the pre-session-47 policy did while aiming with the
  // transposed zone map. In the replay TODAY's policy spends 0.62 on the
  // opening move, 38% of that (`scripts/focusBudgetSweep.ts`), which is why
  // all three of the brief's cheap spend policies came back inert or worse.
  //
  // The replay runs with the matcher tier OFF, so it cannot settle whether
  // live spends 0.62 or 1.62. These two fields make the next batch settle it
  // directly instead of inferring it.
  /** Focus-meter points spent moving to `playedFocus` this turn. */
  focusMoveCost?: number;
  /** Points left on the meter BEFORE this turn's move. */
  focusRemainingBefore?: number;

  // ---- [session 61 §4b] which oils this cast had spent by this turn --------
  // The CAST-level oil flag is derived from the capture itself
  // (`fishingCorpus.ts`'s `oilEra`, off the server's own `consumablesUsed`),
  // which is why it cannot be forgotten. What the board state does NOT carry
  // is item IDENTITY — it counts consumables and marks slots without naming
  // them — and identity is what separates "+2 focus" from "+2 fish damage"
  // when the two arms are eventually compared. Only the spend site knows it,
  // so only the spend site can record it.
  //
  // Absent means no oil had been spent by this turn. Absent on every row
  // written before session 61, which is correct rather than merely tolerated:
  // no cast on record has ever spent one.
  /** Item ids consumed in this cast up to and including this turn, in spend order. */
  oilItemIdsUsed?: number[];

  // ---- [session 50, brief §3 / open question 2] the SHADOW ring tier -------
  // Session 49 found the turn-0 tier scoring WORSE than the plain baseline:
  // pooled n=15, shipped 2/15 at logLoss 3.410 against the baseline's 2.073,
  // ΔLL +1.337 [+0.429, +2.245]. The interval excludes zero but the batches
  // disagree sharply (b1 +1.745, b2 +2.291, b3 −0.025), so it is real but not
  // settled — and turn 0 is 22% of scored turns, which makes it worth settling
  // properly rather than quickly.
  //
  // The cheapest possible test, and it costs nothing and changes no policy:
  // whenever the MATCHER tier produced the row, also record what the pure ring
  // model underneath it would have said, and score both on the same turn. On
  // turn 0 that is `ringDistributionUnknownClass`, which is exactly the
  // comparison in question. Absent on rows where the matcher did not fire —
  // there the shipped distribution already IS the ring model.
  /** The ring model's own top-1, on a turn the matcher tier overrode it. */
  shadowRingPredicted?: [number, number];
  /** Probability the ring model assigned to its own top-1. */
  shadowRingPPredicted?: number;
  /** Probability the ring model assigned to the cell the fish actually reached. */
  shadowRingPActual?: number;
  /** Did the ring model's top-1 match the realized cell? */
  shadowRingHit?: boolean;
  /**
   * [session 51 §3] The weight the matcher tier actually received on this
   * turn. Absent on rows written before session 51, where it was always the
   * fixed `1 - ringFloor` = 0.9 whenever `tier` is `matcher`/`matcher_ring`;
   * `matcherWeightOf()` supplies that so old rows stay readable.
   *
   * Logged because the tier LABEL stopped being sufficient the moment the
   * weight became a belief: a `matcher_ring` row at weight 0.13 and one at
   * 0.58 are different predictions, and pooling them would repeat exactly the
   * mistake session 49 catalogued — a comparator read at a composition that
   * is not the composition of the thing it is compared to.
   */
  matcherWeight?: number;
  /** [session 51 §3] Turns of evidence folded into the posterior when this row was written. */
  matcherPosteriorUpdates?: number;
  /**
   * [session 51 §4] Present exactly on the turns the armed `nextPosition`
   * override fired, carrying the floor weight it fired at. A `tier:
   * "override"` row without it predates the floor.
   */
  overrideWeight?: number;
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

/**
 * [session 51 §3] The matcher weight a row was written under, defaulting a
 * pre-session-51 row to the fixed weight that was in force when it was
 * written. Same discipline as `zoneMapVersionOf` — the default encodes the
 * historical fact, so an old row is never silently read as a new one.
 */
export function matcherWeightOf(rec: RingPredictionRecord): number {
  if (rec.matcherWeight !== undefined) return rec.matcherWeight;
  return rec.tier === "matcher" || rec.tier === "matcher_ring" ? 1 - DEFAULT_RING_MODEL_OPTIONS.ringFloor : 0;
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
  /**
   * [session 66 §1] The first-miss tripwire's verdict — true once a validated
   * miss has been recorded on a turn the override actually steered. Kept
   * SEPARATE from `ready` rather than folded into it so a reader can tell
   * "the evidence is thin" from "the evidence was good and then it was
   * wrong", which are opposite situations that a single boolean hides.
   */
  disarmed: boolean;
  /** Whether the override should arm: enough attempts AND the lower bound clears the bar AND no miss has ever tripped the wire. */
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
export function nextPositionOverrideStats(
  path: string = DEFAULT_NEXT_POSITION_LOG_PATH,
  // [session 66 §1] REQUIRED, deliberately, where every other path in this
  // file has a real default. Two defaulted real data paths on one function is
  // how a caller silently reads production state from a test — and this
  // particular caller decides whether the bot overrides its own model, so the
  // one thing it must not do is consult a file nobody meant it to.
  armStatePath: string,
): NextPositionOverrideStats {
  const validations = loadNextPositionValidations(path);
  const attempts = validations.length;
  const hits = validations.filter((v) => v.hit).length;
  const lowerBound = wilsonLowerBound(hits, attempts);
  // [session 66 §1] The tripwire is a VETO over the Wilson gate, not a term in
  // it. A miss folded into hits/attempts would lower the bound by a few points
  // and be swamped by the next handful of hits — the override would re-arm
  // itself within a cast or two, which is precisely the "a safeguard that
  // resets is a log line" failure this exists to avoid.
  const disarmed = readArmState(armStatePath).disarmed;
  const ready =
    !disarmed &&
    attempts >= NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS &&
    lowerBound >= NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND;
  return { attempts, hits, lowerBound, disarmed, ready };
}

/** A `Distribution` certain the fish is at `cell` — the override's effect on `chooseCard`, once `nextPositionOverrideStats` reports `ready`. Kept as a pure, directly testable function separate from the live wiring. */
export function certainDistribution(cell: Cell): Map<string, { cell: Cell; p: number }> {
  return new Map([[cellKey(cell), { cell, p: 1 }]]);
}

/**
 * [session 51 §4] The mass the armed `nextPosition` override keeps for the
 * server's pre-rolled cell; the remainder goes back to the ring model.
 *
 * The ledger stands at 10/10 with a Wilson lower bound of 0.7225, so the
 * field is very likely right — but "very likely right" and "certain" differ
 * by an UNBOUNDED amount in log loss, and nobody has yet watched this
 * override fire. A point mass that is wrong once collapses that turn to
 * `-log(1e-9)` = 20.7 nats and, worse, aims the shot at a cell the fish is
 * not in. 0.99 costs ~0.01 nats when the field is right, which is nothing
 * against a 72%+ lower bound.
 *
 * **What the floor does and does not bound, stated precisely rather than
 * quoted.** The residual 0.01 is spread by the RING model, so the worst case
 * is `-log(0.01 * p_ring(actual))`: with `ringFloor = 0.1` over a ring of at
 * most 8 cells, a legal cell gets at least ~0.0125 from the ring, capping a
 * wrong override at about 9 nats. It does NOT rescue a cell the ring model
 * itself assigns zero — the sticky chain covers both step rings, so that is
 * the same residual exposure the ring model already carries alone, and it has
 * produced 0 zero-probability events across five live batches (session 50).
 * The floor removes the override's OWN unbounded failure mode; it does not
 * claim to remove every one.
 *
 * This does not reverse QUESTIONS.md §18's settled arming decision. It makes
 * the armed behaviour survive its first miss.
 */
export const NEXT_POSITION_OVERRIDE_WEIGHT = 0.99;

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
  s = s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
  // [session 54] See src/api/redact.ts.
  return redactNoobToken(s);
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


/**
 * **[session 68 §2] Resolve a caught cast's pending `cardsToAdd` offer.**
 *
 * QUESTIONS.md §10 (CONFIRMED, session 17): a catch leaves three new-card
 * offers unresolved until `loot` picks one by real card id, and until then the
 * account rejects every future `start_run` with *"Player is already in a
 * game"*. That stuck state blocked all of session 15/16's further fishing.
 *
 * ## Why this is a shared function and not the inline block it used to be
 *
 * **LIVE-FOUND, 2026-08-21, and it cost a second cast on top of the first.**
 * The resolution used to live on `runOneCast`'s NORMAL exit path only, with a
 * comment saying it meant "the bot's OWN catches never leave the account stuck
 * for a human to notice". That was true only of casts that reach the end.
 *
 * Session 68's cast 13022748 caught the fish with a lethal Relaxing Oil and
 * then tripped a guard on the very next action (see the `COMPLETE_CID` check
 * in the oil loop). The GuardTrip unwound `runOneCast` before this block, so
 * the catch was never resolved and the NEXT invocation died on
 * *"Player is already in a game"* — a self-inflicted stuck account, which is
 * the exact outcome the original comment claimed was impossible.
 *
 * So it is called from TWO places: the normal end of a cast, and — the new
 * one — just before `start_run`, where a terminal successful doc with an
 * unresolved offer is exactly the state to clear rather than to fail on.
 * Calling it at start makes recovery automatic for EVERY abort path, not only
 * for the one that was found.
 *
 * A no-op unless there is really something pending, so it is safe to call
 * unconditionally.
 */
async function resolvePendingCardOffer(
  doc: FishingGameDoc,
  ctx: {
    client: GigaverseClient;
    guards: GuardState;
    log: RunLog;
    fixtures: FixtureWriter;
    logsDir: string;
    dryRun: boolean;
    turn: number;
    where: string;
  },
): Promise<boolean> {
  if (!doc.SUCCESS_CID || !doc.data.cardsToAdd || doc.data.cardsToAdd.length === 0 || doc.data.cardChosenId != null) {
    return false;
  }
  const chosen = chooseNewCard(doc.data.cardsToAdd);
  console.log(
    `  ★ caught! resolving cardsToAdd offer (${doc.data.cardsToAdd.map((c) => c.id).join(", ")}) -> chose id ${chosen.id}` +
      `${ctx.where === "cast end" ? "" : ` [${ctx.where}]`}`,
  );
  const lootBody = buildFishingEnvelope("loot", ctx.client.getFishingActionToken(), { cards: [chosen.id] });
  ctx.log.write({ event: "post", body: lootBody, where: ctx.where });
  if (ctx.dryRun) return false;
  try {
    const lootResp = await ctx.client.postFishingAction(lootBody);
    ctx.guards.recordActionResult(true);
    ctx.log.write({ event: "post_response", resp: lootResp });
    ctx.fixtures.write(lootResp);
    checkPossibleDualYield(lootResp, ctx.log, ctx.turn, "loot", ctx.logsDir);
    const resolvedDeck = lootResp.data.doc.data.fullDeck.length;
    console.log(`  ✓ loot sent — fullDeck now ${resolvedDeck} card(s), cardChosenId ${lootResp.data.doc.data.cardChosenId ?? "still null?"}`);
    return true;
  } catch (e) {
    if (e instanceof TokenExpiredError) throw e;
    ctx.guards.recordActionResult(false);
    const lootDetail = serverErrorDetail(e);
    ctx.log.write({ event: "action_failed", reason: "loot rejected", error: lootDetail.message, body: lootDetail.body });
    console.log(`  ✗ loot rejected — account may be left in the stuck-until-resolved state; see QUESTIONS.md §10.`);
    throw new GuardTrip("fishing loot rejected", { error: lootDetail.message });
  }
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
  /**
   * [session 61 §4c] `config/bot.json`'s `dendren.oils`. **Absent means NO
   * oil is ever spent** — silence is not authorization, the session-24
   * lesson. Deliberately not a path field, so it is not in
   * `LiveFishingIsolatedPaths`: omitting it writes nothing anywhere, it only
   * makes the loop more conservative.
   */
  oilBudget?: OilBudgetConfig;
  /**
   * [session 62 §1b] Sidecar the THIRD cast state is recorded to — a cast in
   * which an on-demand trigger fired and the account held none of that oil.
   * Real data path, so tests MUST override it (CLAUDE.md working-style,
   * "tests must never write to a real data path").
   */
  oilCastStatePath?: string;
  transitionsPath?: string;
  guardStatePath?: string;
  /** [session 30] Validation-only recording of predicted vs. actual `nextPosition` — see this file's "nextPosition validation" section. */
  nextPositionLogPath?: string;
  /**
   * [session 66 §1] Where the first-miss tripwire persists its DISARM (see
   * `src/strategy/fishing/nextPositionArm.ts`). Real data path, so tests MUST
   * override it — and it went into `LiveFishingIsolatedPaths` in the same
   * commit as this field, which is the whole point of that list: session 62
   * did exactly this for `oilCastStatePath` and it failed all 8 call sites at
   * compile time. The bug class has shipped four times when it was skipped.
   */
  nextPositionArmStatePath?: string;
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
   * [session 68 §1] Evaluate the CONSERVING oil gate in shadow beside every
   * live oil decision, and log what it would have skipped. **Purely
   * observational** — see `src/strategy/fishing/oilShadow.ts`. Defaults ON so
   * live casts accumulate the record; the flag exists so
   * `tests/fishing/oilShadowInert.test.ts` can run the same cast with it on
   * and off and require the POST sequence to be byte-identical.
   *
   * This is NOT the conserving policy being shipped. `config/bot.json`'s
   * `dendren.oils.policyApproved` is still false and the live loop still plays
   * `onDemandTriggers`; nothing below reads a shadow record back.
   */
  shadowOil?: boolean;
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
  /**
   * [session 62 §1b] Turns on which an on-demand trigger fired and the account
   * held NONE of that oil. Non-empty makes this cast the THIRD state: it is
   * not an oil cast (nothing was consumed) and it is not a clean non-oil cast
   * either, because the policy that played it was the oil policy running dry.
   * Kept out of BOTH outcome arms — see `classifyOilArm` in
   * `src/sim/fishingCorpus.ts` and the dead era, which is the precedent for
   * what an unflagged policy change does to a rate.
   */
  oilTriggerNoStock: OilTriggerNoStock[];
  /**
   * [session 68 §1] What the CONSERVING gate would have done at each of this
   * cast's oil decisions. **Observational.** Nothing in `runOneCast` reads
   * this; `main()` only prints a summary of it. It is on the result rather
   * than only in the log so a batch can report a firing rate without parsing
   * its own log back — and `tests/fishing/oilShadowInert.test.ts` compares the
   * two arms' results with this field stripped, because it is the one field
   * that is SUPPOSED to differ between shadow-on and shadow-off.
   */
  oilShadowRecords: OilShadowRecord[];
  /**
   * [session 64 §2b] Oils actually consumed on this cast. Already tracked
   * internally (`oilsUsedThisCast`) for the OIL-POLICY-DRY record; surfaced
   * here because the batch's INTENDED exit is "the first cast that uses an
   * oil", and `main()` had no way to see that. Deliberately NOT derived from
   * `oilTriggerNoStock`, which records the opposite event.
   */
  oilsConsumed: number;
}

/** One turn on which an on-demand trigger fired against zero stock. */
export interface OilTriggerNoStock {
  turn: number;
  kind: OilKind;
  itemId: number;
  /**
   * WHY there was nothing to spend, kept distinct because the two are not the
   * same fact. `"empty"` — the balance was read and the account holds none.
   * `"balance_unknown"` — the balance read itself failed, so the count is a
   * conservative 0 rather than an observed one. `"per_cast_cap"` [session 69
   * §4] — the account HELD one and a user ceiling withheld it, which is a fact
   * about policy and not about stock.
   *
   * All three exclude the cast from both outcome arms, for the same reason: it
   * was played by the oil policy running dry on that arm. Only `"empty"` is
   * evidence about the user's stock, and `"per_cast_cap"` is specifically NOT
   * — reading a cap as an empty bag would understate the account's holdings in
   * exactly the reports that exist to track them.
   */
  reason: "empty" | "balance_unknown" | "per_cast_cap";
}

/** Safety cap only — SPEC.md §5 names no real max-turns figure; this exists solely to guard against an infinite-loop bug, not to model the game. */
const MAX_TURNS = 60;

export async function runOneCast(deps: LiveFishingDeps): Promise<CastRunResult> {
  const { client, config, guards, fixtures, log, address, dryRun } = deps;
  const transitionsPath = deps.transitionsPath ?? DEFAULT_TRANSITIONS_PATH;
  const nextPositionLogPath = deps.nextPositionLogPath ?? DEFAULT_NEXT_POSITION_LOG_PATH;
  const nextPositionArmStatePath = deps.nextPositionArmStatePath ?? DEFAULT_NEXT_POSITION_ARM_STATE_PATH;
  const ringPredictionLogPath = deps.ringPredictionLogPath ?? DEFAULT_RING_PREDICTION_LOG_PATH;
  const logsDir = deps.logsDir ?? "logs";
  const ringModelEnabled = deps.ringModelEnabled ?? true;
  const focusReserveWeight = deps.focusReserveWeight ?? DEFAULT_FOCUS_RESERVE_WEIGHT;
  // [session 68 §1] Shadow defaults ON. It cannot change a decision — see
  // `oilShadow.ts` and `tests/fishing/oilShadowInert.test.ts`.
  const shadowOilEnabled = deps.shadowOil ?? true;
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

  // [session 68 §2] **Clear a stuck account before trying to start.** A
  // terminal SUCCESSFUL doc with an unresolved `cardsToAdd` offer is precisely
  // the state that makes `start_run` fail with "Player is already in a game",
  // and it is resolvable rather than fatal. Doing it HERE — not only at the
  // end of a cast — is what makes recovery automatic after ANY abort path,
  // including a guard trip taken between the catch and the resolution. See
  // `resolvePendingCardOffer`.
  if (existing.gameState && existing.gameState.COMPLETE_CID) {
    const cleared = await resolvePendingCardOffer(existing.gameState, {
      client, guards, log, fixtures, logsDir, dryRun, turn: 0, where: "pre-start recovery",
    });
    if (cleared) {
      console.log(`  · account was left stuck by an earlier cast's catch — offer resolved, starting normally.`);
      log.write({ event: "pre_start_stuck_recovered", docId: existing.gameState.docId });
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
    return { outcome: "dry_run", turns: 0, oilTriggerNoStock: [], oilsConsumed: 0, oilShadowRecords: [] };
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
  // [session 50, brief §3 / open question 4] The sticky chain's switch
  // probability is ESTIMATED from this same clean corpus at load, not taken
  // from the shipped constant. `s` has risen at every count (~0.6% -> 2.50%
  // -> 4.98%) and the swept optimum has tracked the estimator at both corpus
  // sizes, so a constant is stale by construction under a monotone trend. The
  // floor stops a thin corpus from collapsing it to the degenerate hard-ring
  // case. Logged with its `n` on every run — the brief's §0 rule.
  const switchEstimate = estimateSwitchProbability(contextCasts);
  // [session 51 §3] The matcher tier's mixture weight is now a POSTERIOR, not
  // the fixed `1 - ringFloor = 0.9` it has been since session 45. The prior is
  // the loaded library's own support rate on this same clean corpus — the
  // fraction of casts `perimeterWalk(cw)`/`(ccw)` explain exactly — so it is
  // read off the data rather than invented, and it describes the library
  // actually in use rather than a freshly mined one.
  const matcherSupport = supportingCastCount(contextCasts, minedPatterns);
  const matcherPosteriorOpts: MatcherPosteriorOptions = {
    prior: matcherPriorFromSupport(matcherSupport.supportingCasts, matcherSupport.totalCasts),
    ...DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  };
  let matcherPosterior = initMatcherPosterior(matcherPosteriorOpts.prior);
  if (matcherCandidates.length > 0) {
    console.log(
      `  · matcher posterior: prior ${(matcherPosteriorOpts.prior * 100).toFixed(1)}% ` +
        `(${matcherSupport.supportingCasts}/${matcherSupport.totalCasts} clean casts explained exactly by the loaded library, Laplace +1/+2); ` +
        `was a FIXED ${((1 - DEFAULT_RING_MODEL_OPTIONS.ringFloor) * 100).toFixed(0)}% before session 51`,
    );
  }
  if (ringModelEnabled) {
    console.log(
      `  · ring model ON: class prior k=1 ${stepClassTable.classCasts.get(1) ?? 0} / k=2 ${stepClassTable.classCasts.get(2) ?? 0} cast(s), ` +
        `${stepClassTable.conditional.size} (class, prev-delta) key(s); focusReserveWeight ${focusReserveWeight}`,
    );
    console.log(
      `  · sticky switch probability s = ${(switchEstimate.s * 100).toFixed(2)}% ` +
        `(estimated: ${switchEstimate.switches}/${switchEstimate.n} consecutive hop pairs = ${(switchEstimate.raw * 100).toFixed(2)}%` +
        `${switchEstimate.floored ? `, FLOORED at ${(SWITCH_PROBABILITY_FLOOR * 100).toFixed(2)}%` : ""}; ` +
        `shipped constant ${(DEFAULT_SWITCH_PROBABILITY * 100).toFixed(2)}%)`,
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

  // [session 62 §1] BOTH oils' balances — `on-demand` spends the Focus Oil too,
  // where session 43's heuristic (c) only ever considered the Relaxing Oil.
  //
  // Read once per cast (not per turn): a second live call every turn just to
  // check counts that only ever go DOWN within a cast would be wasteful, so
  // `oilHeld` is decremented locally on each confirmed use instead.
  //
  // Best-effort. A failed balance read leaves BOTH counts at 0, which disables
  // spending for this cast rather than guessing a positive balance — and note
  // what that now implies: a trigger firing against those zeros records the
  // third state (§1b), so a read failure marks the cast rather than silently
  // pooling it into the non-oil arm. `oilBalanceKnown` keeps the two apart on
  // the record — "the account holds none" and "we never found out" exclude the
  // cast identically but are not the same fact, and only the first is evidence
  // about the user's remaining stock.
  const oilHeld: Record<OilKind, number> = { relaxing: 0, focus: 0 };
  /** False until a balance read succeeds — separates "holds none" from "we do not know". */
  let oilBalanceKnown = false;
  if (!dryRun) {
    try {
      const balances = await client.getItemsBalances();
      const balanceOf = (id: number) =>
        Number(balances.entities.find((e) => e.ID_CID === String(id))?.BALANCE_CID ?? 0);
      oilHeld.relaxing = balanceOf(MID_RELAXING_OIL_ITEM_ID);
      oilHeld.focus = balanceOf(MID_FOCUS_OIL_ITEM_ID);
      oilBalanceKnown = true;
      if (oilHeld.relaxing > 0 || oilHeld.focus > 0) {
        console.log(`  · oils held: Relaxing ${oilHeld.relaxing}, Focus ${oilHeld.focus} (on-demand policy)`);
      }
    } catch (e) {
      log.write({ event: "oil_balance_read_failed", error: (e as Error).message });
    }
  }
  // Set once a `use_fishing_item` POST is rejected, so a still-unconfirmed
  // `slotIndex` guess (see the schema's doc comment) doesn't get retried
  // every remaining turn of the same cast — one rejection is informative
  // enough without spamming the same failing request.
  const oilUseFailedThisCast: Record<OilKind, boolean> = { relaxing: false, focus: false };
  // [session 62 §1b] The third cast state, accumulated across the cast.
  const oilTriggerNoStock: OilTriggerNoStock[] = [];
  // [session 68 §1] Shadow records, one per turn a shadow evaluation ran.
  // Write-only from the loop's point of view — nothing in `runOneCast` reads
  // this back, which is half of what makes the shadow inert.
  const oilShadowRecords: OilShadowRecord[] = [];
  // [session 61 §4c] Consumables spent this cast, for `mayConsumeOil`'s
  // per-cast budget, and the itemIds spent, for the per-turn record. The
  // board state's own `consumablesUsed` counts them too and is what
  // `fishingCorpus.ts` derives the oil-era flag from — this local count is the
  // BUDGET's, checked before each spend rather than read back after one.
  let oilsUsedThisCast = 0;
  // [session 69 §4] Per-KIND tally, because the caps bind independently: the
  // user's directive is a ceiling on Relaxing Oils specifically, not on
  // consumables in general. Derived nowhere else — `oilItemIdsUsedThisCast`
  // below records the same events for the fixture, but a count the gate reads
  // must not be recovered by filtering a log.
  const oilsUsedThisCastOf: Record<OilKind, number> = { relaxing: 0, focus: 0 };
  const oilItemIdsUsedThisCast: number[] = [];

  while (turn < MAX_TURNS) {
    if (doc.COMPLETE_CID) break;

    if (deps.shutdownSignal?.requested) {
      log.write({ event: "shutdown_requested", turn });
      console.log(`  ▸ SIGINT — stopping before the next card (turn boundary), cast left in progress at turn ${turn}.`);
      return { outcome: "shutdown", turns: turn, oilTriggerNoStock, oilsConsumed: oilsUsedThisCast, oilShadowRecords };
    }

    // ---- [session 62 §1] THE OIL DECISION -----------------------------------
    //
    // **USER-APPROVED 2026-08-20: `on-demand` replaces session 43's heuristic
    // (c).** `handoff/OIL-POLICY.md` is the derivation; the short version is
    // that (c) is dominated on this repo's own numbers — +4.51pp for 2630 oils
    // against the lethal trigger's +4.47pp for 1821, i.e. statistically
    // indistinguishable benefit for 44% more oil. The two rules differ only on
    // fish where 15% of max exceeds 2 HP, and on exactly those fish (c) spends
    // the oil WITHOUT securing the kill.
    //
    // THREE gates, and they answer three different questions:
    //
    //   1. `onDemandTriggers` — is now the MOMENT? Evaluated with no reference
    //      to stock, deliberately (see its doc comment), so that a trigger
    //      firing against an empty bag is observable rather than silent.
    //   2. `mayConsumeOil`    — is spending AUTHORIZED at all? Budget,
    //      approval, balance, per-cast cap. Every condition passed IN, so this
    //      call site and the resolver cannot drift apart.
    //   3. stock              — is there one to spend? An empty bag is an
    //      EXPECTED state, not an unexpected one, so it degrades to ordinary
    //      play (CLAUDE.md rule 5 governs the unexpected; this is not that).
    //
    // The user has a few oils, fewer than a batch needs, and the sweep spends
    // ~0.70 oils per cast — so stock runs out MID-batch, not between batches.
    // That path is the one that has to be right, and it is exercised in
    // `tests/fishing/oilStockExhaustion.test.ts` rather than merely written.
    //
    // MANA: **RESOLVED, user-stated 2026-08-20** — `use_fishing_item` does NOT
    // consume mana; only playing cards does. This was the load-bearing
    // assumption under OIL-POLICY.md's +19.40pp, carried as an explicit
    // assumption since session 61, and the account owner has now confirmed it
    // directly. The sim modelled it as free and was right to.
    // ---- [session 69 §1] THE DISTRIBUTION PIPELINE, HOISTED -----------------
    //
    // This ran BELOW the oil block until session 69. It was moved above it so
    // the oil shadow can be evaluated at the moment the oil decision is
    // actually taken — see the shadow block below for why that placement is
    // the whole point, and `tests/fishing/hoistInvariant.test.ts` for the
    // byte-level capture that proves the move changed no live decision.
    //
    // **Nothing here reads the doc.** Every input (`matcher.history`,
    // `pendingPrediction`, `switchEstimate`, and the mined tables built once
    // before the loop) is untouched by the oil block, which writes only `doc`,
    // `oilHeld` and its own tallies. `hand`, `mana` and `fishHp` deliberately
    // did NOT move: those are read off the POST-consume doc and are the card
    // policy's inputs, not this pipeline's.
    // [session 30, gate rebuilt session 39 CODEXAUDIT #4] Override gated
    // behind a Wilson-score confidence bound on hits/attempts, not a raw hit
    // count (see this file's "nextPosition validation" section).
    //
    // **[session 65] IT ARMED, for the first time.** This comment used to end
    // "this override has never armed live yet regardless of how many casts run
    // this session", and that stopped being true during the seven-cast batch:
    // 10/10 hits, Wilson lower bound 72.2%, and it fired on the turns where
    // the server had volunteered a `nextPosition`. It then went on hitting —
    // the validation log's every entry is a HIT.
    //
    // Two things follow, and neither is a change to make here. The override is
    // now a LIVE input to card choice rather than a dormant safeguard, so it
    // belongs in any account of why a cast played the way it did. And its
    // gate has never yet been tested by a MISS, so the Wilson bound has only
    // ever been observed climbing; do not read 72.2% as a measured accuracy
    // ceiling.
    //
    // **[session 66 §1] AND IT NOW HAS A TRIPWIRE THAT CAN FIRE.** The Wilson
    // bound cannot: computed from an unbroken streak it only ever climbs
    // (12/12 ≈ 0.76, 20/20 ≈ 0.84, 50/50 ≈ 0.93), so it can never fire while
    // the override behaves. `overrideStats.ready` now also requires that no
    // validated miss has ever been recorded on a turn the override STEERED —
    // see `src/strategy/fishing/nextPositionArm.ts`.
    const overrideStats = nextPositionOverrideStats(nextPositionLogPath, nextPositionArmStatePath);
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
    // [session 49, brief §2] The ring is no longer a HARD constraint. The
    // step count is sticky, not constant (session 48 falsified the constant
    // half of FACT 1), so the distribution marginalises over a two-state
    // chain on the LAST observed count — see `stickyStepDistribution`. Cast
    // `12988700` drew three probability-ZERO outcomes under the old reading;
    // this construction cannot produce one. `lastStepClass` replaces
    // `classifyStep`'s cast-wide mode for the same reason.
    const stepClass = ringModelEnabled ? lastStepClass(matcher.history) : null;
    const ringDist = ringModelEnabled
      ? stickyStepDistribution(
          currentCell,
          stepClass,
          prevDelta,
          stepClassTable,
          gridSize,
          DEFAULT_RING_MODEL_OPTIONS,
          switchEstimate.s,
        )
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
    // [session 51 §3] The matcher tier is a MIXTURE weighted by belief, not a
    // fixed 0.9. Measured on the 88-cast replay, the old constant handed 90%
    // of the mass to the perimeter-walk hypothesis on EVERY cast in the corpus
    // (88/88 casts, 134 turns, weight 0.900 on all of them); the posterior
    // exceeds 0.5 on 4 casts and sits at a median 0.135. Refutation is
    // automatic — a dead candidate set drives the weight to 0 for the rest of
    // the cast, which the constant had no way to express.
    const matcherOnRing = matcherDist
      ? ringModelEnabled
        ? stepClass !== null
          ? (intersectWithRing(matcherDist, currentCell, stepClass, gridSize) ?? ringDist!)
          : matcherDist
        : matcherDist
      : null;
    const matcherMixWeight = matcherOnRing ? matcherWeight(matcherPosterior, matcherPosteriorOpts) : 0;
    const rawDist = matcherOnRing
      ? ringModelEnabled
        ? mixDistributions(matcherOnRing, ringDist!, matcherMixWeight)
        : matcherOnRing
      : (ringDist ??
        contextualFallback(
          currentCell,
          prevDelta,
          contextMap,
          transitionLog,
          gridSize,
          { shrinkageK: DEFAULT_SHRINKAGE_K },
        ));
    // [session 51 §4] The override is FLOORED, not absolute — see
    // `NEXT_POSITION_OVERRIDE_WEIGHT`. `rawDist` is the fallback for the
    // residual mass when the ring model is off, so the floor exists on every
    // configuration rather than only the one that ships.
    const dist = nextPositionOverrideActive
      ? mixDistributions(certainDistribution(pendingPrediction!.cell), ringDist ?? rawDist, NEXT_POSITION_OVERRIDE_WEIGHT)
      : rawDist;

    // ---- [session 68 §1, RE-PLACED session 69 §1] THE OIL SHADOW ------------
    //
    // The conserving gate is asked what it WOULD have done at this turn's oil
    // decision, on exactly the state that decision is about to be taken on.
    //
    // **It is evaluated HERE, above the oil block, and the placement is the
    // deliverable.** Session 68 evaluated it in the card-choice phase below,
    // because that is where `dist` first existed. The cost was measured rather
    // than predicted: over five live casts the shadow produced 13 records,
    // exactly ONE at a firing moment, and `bestKillProbability` was `null` on
    // all thirteen. The reason is structural — the Relaxing trigger fires only
    // on a lethal fish, a lethal Relaxing Oil ENDS the cast inside the oil
    // block, and the `if (doc.COMPLETE_CID) continue;` below meant that the one
    // turn the Relaxing arm was observable on was the one turn no record was
    // written. The same gap swallowed any turn whose oil block threw, which is
    // again precisely a turn on which a trigger had fired.
    //
    // Because it now runs BEFORE the block, no snapshot needs to be carried:
    // `doc` here IS the pre-consume doc. `snapshotOilDecision` is still what
    // builds the state, so the freezing and deep-copy guarantees are unchanged
    // — it is simply called at the moment it describes.
    //
    // Inertness, unchanged and still the three properties the file's header
    // sets out: the gate is handed a frozen DEEP COPY (the copy is what gets
    // frozen — freezing the live `deckCardData` in place would itself be a side
    // effect on the live path), `evaluateOilShadow` cannot throw, and
    // `OilShadowRecord` has no field the live loop reads. Nothing between here
    // and the `play_cards` POST reads `shadowRecord`.
    // `tests/fishing/oilShadowInert.test.ts` is the proof, and
    // `tests/fishing/oilShadowRelaxingArm.test.ts` proves the move actually
    // bought the observation rather than merely relocating a line.
    if (shadowOilEnabled) {
      const shadowRecord = evaluateOilShadow(
        snapshotOilDecision(
          {
            turn,
            fishHp: doc.data.fishHp,
            fishMaxHp: doc.data.fishMaxHp,
            mana: doc.data.playerHp,
            focusRemaining: doc.data.focusMeter,
            focusMax: doc.data.focusMeterMax,
            focusCell: { x: doc.data.focusPoint[0] ?? 1, y: doc.data.focusPoint[1] ?? 1 },
            focusOilHeld: oilHeld.focus,
            relaxingOilHeld: oilHeld.relaxing,
          },
          { hand: buildHand(doc), dist, gridSize },
        ),
        PAYLOAD_OIL_EFFECTS,
        { focus: oilHeld.focus, relaxing: oilHeld.relaxing },
      );
      oilShadowRecords.push(shadowRecord);
      log.write({ event: "oil_shadow", ...shadowRecord });
      if (shadowRecord.error) {
        console.log(`  · oil shadow THREW (recorded, cast unaffected): ${shadowRecord.error}`);
      } else if (shadowRecord.sanity.length > 0) {
        console.log(`  ★★★ oil shadow SANITY VIOLATION on turn ${turn}: ${shadowRecord.sanity.join(", ")}`);
      } else if (shadowRecord.liveWanted.length > 0) {
        const p =
          shadowRecord.bestKillProbability !== null
            ? `bestKill ${shadowRecord.bestKillProbability.toFixed(3)}`
            : `bestConnect ${(shadowRecord.bestConnectProbability ?? 0).toFixed(3)}`;
        console.log(
          `  · shadow(${shadowRecord.shadowPolicy}) on turn ${turn}: on-demand wanted ` +
            `[${shadowRecord.liveWanted.join(",")}], shadow would take [${shadowRecord.shadowWanted.join(",") || "none"}]` +
            `${shadowRecord.wouldSkip.length > 0 ? ` — WOULD SKIP ${shadowRecord.wouldSkip.join(",")}` : ""} (${p}). ` +
            `Observational only; the live decision below is taken by \`on-demand\` regardless.`,
        );
      }
    }

    const oilWanted = onDemandTriggers(
      {
        turn,
        fishHp: doc.data.fishHp,
        fishMaxHp: doc.data.fishMaxHp,
        mana: doc.data.playerHp,
        focusRemaining: doc.data.focusMeter,
        focusMax: doc.data.focusMeterMax,
        focusOilHeld: oilHeld.focus,
        relaxingOilHeld: oilHeld.relaxing,
      },
      PAYLOAD_OIL_EFFECTS,
    );
    for (const kind of oilWanted) {
      // ---- [session 68 §2] A LETHAL CONSUME ENDS THE CAST MID-LOOP --------
      //
      // **LIVE-FOUND, and it cost a cast.** `oilWanted` is evaluated ONCE for
      // the turn, but a consume inside this loop replaces `doc`. The Relaxing
      // Oil's whole thesis is that at `fishHp <= fishDamage` it ENDS the cast
      // — so when both triggers fire on the same turn, the Focus consume that
      // follows is sent against a cast the server already considers finished.
      //
      // Live, 2026-08-21, cast 13024xxx turn 3: fish 2/18, meter 0/3, both
      // triggers fired. `use_fishing_item(937, slot 0)` took the fish to 0/18;
      // `use_fishing_item(942, slot 1)` was then rejected HTTP 400, and per the
      // session-65 finding a rejected consume still ADVANCES the server's
      // action token — so the cast was unrecoverable and the batch stopped on
      // its first cast with 4 unspent.
      //
      // The check has to be HERE and not after the loop (where it already was,
      // and where it never saw this): the damage is done by the second
      // iteration, not by the next turn.
      if (doc.COMPLETE_CID) {
        log.write({ event: "oil_skipped_cast_complete", turn, kind });
        console.log(`  · cast already complete — not sending the ${kind} oil that this turn also triggered.`);
        break;
      }
      const itemId = kind === "focus" ? MID_FOCUS_OIL_ITEM_ID : MID_RELAXING_OIL_ITEM_ID;
      const held = oilHeld[kind];
      const auth = mayConsumeOil({
        configured: deps.oilBudget,
        itemId,
        heldBalance: held,
        usedThisCast: oilsUsedThisCast,
        usedThisCastOfItem: oilsUsedThisCastOf[kind],
        dryRun,
        spendFailedThisCast: oilUseFailedThisCast[kind],
      });
      if (!auth.allowed) {
        // [session 69 §4] **A per-item cap hit is the THIRD STATE too, not an
        // ordinary refusal.** The policy wanted the oil, the account held one,
        // and a user ceiling withheld it — so the cast was played by the oil
        // policy running dry on that arm, exactly the shape session 62 §1b
        // invented `oilTriggerNoStock` for. Folding it into the plain
        // `oil_spend_refused` line would leave the cast averaged into the OIL
        // arm while it was in fact partly unoiled, which is the mistake that
        // poisoned a rate for 40 casts.
        //
        // The cast CONTINUES and the batch does NOT halt. A ceiling reached is
        // an expected state, not a rule-5 unexpected one.
        const capReached = held > 0 && auth.reason.includes(`per-cast cap for item ${itemId}`);
        if (capReached) {
          oilTriggerNoStock.push({ turn, kind, itemId, reason: "per_cast_cap" });
          log.write({ event: "oil_trigger_no_stock", turn, kind, itemId, held, reason: "per_cast_cap", detail: auth.reason });
          console.log(
            `  · on-demand wanted the ${kind === "focus" ? "Mid Focus" : "Mid Relaxing"} Oil here ` +
              `(turn ${turn}) — PER-CAST CAP REACHED (${held} held, so this is a user ceiling and not an empty bag), ` +
              `playing on without it. This cast is flagged out of both arms.`,
          );
          continue;
        }
        if (held <= 0) {
          // ---- THE THIRD STATE (§1b) -------------------------------------
          // The policy WANTED an oil and the bag was empty. This is not a
          // failure and it does not stop the cast — it is recorded so this
          // cast can be kept out of BOTH outcome arms. A cast the oil policy
          // played while dry is not an oil cast, and it is not a clean non-oil
          // cast either. The dead era is why: an unflagged policy change gets
          // averaged into a rate that then means nothing, and it took 40 casts
          // to notice.
          const reason = oilBalanceKnown ? "empty" : "balance_unknown";
          oilTriggerNoStock.push({ turn, kind, itemId, reason });
          log.write({ event: "oil_trigger_no_stock", turn, kind, itemId, held, reason });
          console.log(
            `  · on-demand wanted the ${kind === "focus" ? "Mid Focus" : "Mid Relaxing"} Oil here ` +
              `(turn ${turn}) — ${oilBalanceKnown ? "NONE HELD" : "BALANCE UNKNOWN (read failed)"}, ` +
              `playing on without it. This cast is flagged out of both arms.`,
          );
        } else {
          // Logged, not silent: the trigger fired and policy said no. A
          // refusal nobody can see is indistinguishable from a trigger that
          // never fired.
          log.write({ event: "oil_spend_refused", turn, kind, itemId, reason: auth.reason });
          console.log(`  · on-demand wanted a ${kind} oil here — NOT spending: ${auth.reason}`);
        }
        continue;
      }
      console.log(
        kind === "relaxing"
          ? `  ★ on-demand LETHAL trigger: fish at ${doc.data.fishHp}/${doc.data.fishMaxHp} HP (${held} Relaxing Oil held) — using one.`
          : `  ★ on-demand METER trigger: focus meter at ${doc.data.focusMeter}/${doc.data.focusMeterMax} (${held} Focus Oil held) — using one.`,
      );
      // [session 65] THE SLOT IS A CURSOR, NOT A CONSTANT. Read off the live
      // doc's own `fishingConsumableSlotUsed`; `null` means every slot is
      // spent (or the server stopped sending the field), and the correct
      // response is to not send the consume at all rather than aim at a used
      // slot. See `nextConsumableSlot` for the measurement that established
      // this — a hard-coded 0 cost cast 13019682 its remaining turns.
      const slotIndex = nextConsumableSlot(doc.data.fishingConsumableSlotUsed);
      if (slotIndex === null) {
        log.write({ event: "oil_no_free_slot", turn, kind, itemId, slotUsed: doc.data.fishingConsumableSlotUsed });
        console.log(
          `  · on-demand wanted a ${kind} oil here — NO FREE CONSUMABLE SLOT ` +
            `(${JSON.stringify(doc.data.fishingConsumableSlotUsed ?? null)}), not sending.`,
        );
        continue;
      }
      const oilBody = buildFishingEnvelope("use_fishing_item", client.getFishingActionToken(), {
        itemId,
        slotIndex,
      });
      log.write({ event: "post", body: oilBody });
      try {
        const oilResp = await client.postFishingAction(oilBody);
        log.write({ event: "post_response", resp: oilResp });
        fixtures.write(oilResp);
        const manaBefore = doc.data.playerHp;
        doc = oilResp.data.doc;
        oilHeld[kind] -= 1;
        oilsUsedThisCast += 1;
        oilsUsedThisCastOf[kind] += 1;
        oilItemIdsUsedThisCast.push(itemId);
        console.log(
          `  ✓ use_fishing_item (${itemId}): fish now ${doc.data.fishHp}/${doc.data.fishMaxHp}, ` +
            `focus ${doc.data.focusMeter}/${doc.data.focusMeterMax}, mana ${manaBefore} -> ${doc.data.playerHp}`,
        );
        // The mana question is user-RESOLVED (no cost), so this is a check on
        // a settled answer rather than a measurement of an open one — cheap,
        // and it is the one place a contradiction would show up first.
        if (doc.data.playerHp !== manaBefore) {
          log.write({ event: "oil_mana_changed", turn, itemId, before: manaBefore, after: doc.data.playerHp });
          console.log(
            `  ★★★ use_fishing_item CHANGED MANA ${manaBefore} -> ${doc.data.playerHp} — contradicts the ` +
              `user-stated "oils do not consume mana". Worth reporting; OIL-POLICY.md's +19.40pp assumes free.`,
          );
        }
        const unknown = unknownDocKeys(doc as unknown as Record<string, unknown>);
        if (unknown.length > 0) {
          const path = dumpUnknownTerminal(oilResp, unknown, "midcast", logsDir);
          log.write({ event: "unknown_fields", source: "use_fishing_item", turn, keys: unknown, dump: path });
          console.log(`  ★★★ UNKNOWN FIELD(S) on use_fishing_item's returned doc: ${unknown.join(", ")}`);
        }
      } catch (e) {
        oilUseFailedThisCast[kind] = true;
        if (e instanceof TokenExpiredError) throw e;
        const message = (e as Error).message;
        log.write({ event: "action_failed", reason: "use_fishing_item rejected", itemId, slotIndex, error: message });
        // [session 65] **A REJECTED CONSUME IS NOT FREE.** The comment that
        // stood here said this "fails closed via the catch block, not a
        // GuardTrip: this action is an optional rescue, not a required step in
        // playing the cast." Live play falsified that on cast 13019682: the
        // server ADVANCED ITS ACTION TOKEN on the rejected request
        // (`Invalid action token 1787330936730 != 1787330937735`), the client
        // never saw the new value because the error path throws before
        // `postFishingAction` assigns it, and the NEXT `play_cards` died on a
        // token mismatch — surfacing as a confusing guard trip one turn away
        // from its real cause.
        //
        // There is no resync: `GET /fishing/state` carries no `actionToken`
        // (see `client.ts`), so the chain cannot be recovered without
        // inventing an endpoint. The cast is therefore unplayable from here,
        // and the honest thing is to stop AT the cause with the cause named.
        throw new GuardTrip("use_fishing_item was rejected — the action token is now desynced and the cast cannot continue", {
          itemId,
          slotIndex,
          kind,
          turn,
          error: message,
          note:
            "the server advances its action token even on a rejected use_fishing_item, and GET /fishing/state " +
            "carries no actionToken to resync from. Stopping here rather than one turn later on a token mismatch.",
        });
      }
    }
    // A lethal Relaxing Oil ends the cast outright. Re-check before spending a
    // turn on a fish that is already dead.
    if (doc.COMPLETE_CID) continue;

    const hand = buildHand(doc);
    const mana = doc.data.playerHp;
    const fishHp = doc.data.fishHp;
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
    // [session 50, §3 / Q2] The shadow ring row — recorded only when the
    // matcher tier actually overrode the ring model, since otherwise the two
    // are the same distribution and the comparison would be vacuous.
    // [session 51 §4] Widened from "matcher overrode the ring" to "ANYTHING
    // overrode the ring", which now includes the armed `nextPosition`
    // override. That is the brief's §4 point: dual-logging what the ring
    // would have said on the same turn gives the override a paired
    // before/after on the SAME fish, instead of two batches on different
    // ones. Still skipped when the shipped distribution IS the ring
    // distribution, where the comparison would be vacuous.
    const shadowRingTop = ringDist && (matcherOnRing || nextPositionOverrideActive) ? topCellOf(ringDist) : null;

    // [session 49, §3] Bound once so the record below reports the SAME budget
    // the choice was made against, rather than re-reading a doc that has since
    // been replaced by the response.
    const turnFocusBudget = focusBudget(doc);
    const best = chooseCard(hand, mana, dist, gridSize, 1, fishHp, turnFocusBudget, true, focusReserveWeight);
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
      return { outcome: "dry_run", turns: turn, oilTriggerNoStock, oilsConsumed: oilsUsedThisCast, oilShadowRecords };
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
    //
    // [session 66 §1] The THREE cases are classified here rather than inferred
    // from a bare `hit` boolean, because "no prediction" and "prediction
    // correct" look identical at this call site (nothing to complain about)
    // and conflating them is how 12/12 stays 12/12 forever. Only
    // `acted_miss` — present, STEERED, and wrong — trips the wire.
    const predictionOutcome = classifyPredictionOutcome({
      predicted: pendingPrediction ? pendingPrediction.cell : null,
      actual: toCell,
      actedOn: nextPositionOverrideActive,
    });
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
        // The record has to carry this or the ledger cannot distinguish a
        // prediction the bot ACTED on from one it merely watched — and the
        // 12 rows written before this field existed are exactly the ones a
        // future reader would otherwise mis-attribute. Absent means unknown,
        // never "acted on".
        overrideActive: nextPositionOverrideActive,
      };
      appendNextPositionValidation(validation, nextPositionLogPath);
      log.write({ event: "next_position_validation", ...validation, outcome: predictionOutcome.kind });
      console.log(
        `  · nextPosition validation: predicted ${JSON.stringify(pendingPrediction.cell)}, actual ${JSON.stringify(toCell)} — ` +
          `${hit ? "HIT" : "miss"} (${predictionOutcome.kind}).`,
      );
      if (tripsWire(predictionOutcome)) {
        const disarmRecord: OverrideDisarmRecord = {
          at: new Date().toISOString(),
          castId,
          turn,
          predicted: [pendingPrediction.cell.x, pendingPrediction.cell.y],
          actual: [toCell.x, toCell.y],
          gridSize,
          streakHits: overrideStats.hits,
          streakAttempts: overrideStats.attempts,
          lowerBound: overrideStats.lowerBound,
        };
        const written = disarmOverride(disarmRecord, nextPositionArmStatePath);
        log.write({ event: "next_position_override_disarmed", written, ...disarmRecord });
        console.log(`  ★★★ nextPosition override TRIPWIRE FIRED — first validated miss on a turn it steered.`);
        console.log(`  ★★★ cast ${castId}, turn ${turn}, predicted [${disarmRecord.predicted.join(",")}], actual [${disarmRecord.actual.join(",")}].`);
        console.log(`  ★★★ the streak it ended: ${disarmRecord.streakHits}/${disarmRecord.streakAttempts}, Wilson lower bound ${(disarmRecord.lowerBound * 100).toFixed(1)}%.`);
        console.log(`  ★★★ ${describeArmState(readArmState(nextPositionArmStatePath), nextPositionArmStatePath)}`);
        console.log(`  ★★★ the cast CONTINUES without the override — it is an optimisation, not a required input.`);
      }
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
        focusMoveCost: manhattan(turnFocusBudget.current, best.focus),
        focusRemainingBefore: turnFocusBudget.remaining,
        shadowRingPredicted: shadowRingTop ? [shadowRingTop.cell.x, shadowRingTop.cell.y] : undefined,
        shadowRingPPredicted: shadowRingTop?.p,
        shadowRingPActual: shadowRingTop ? (ringDist!.get(cellKey(toCell))?.p ?? 0) : undefined,
        shadowRingHit: shadowRingTop ? cellsEqual(toCell, shadowRingTop.cell) : undefined,
        overrideWeight: nextPositionOverrideActive ? NEXT_POSITION_OVERRIDE_WEIGHT : undefined,
        matcherWeight: matcherOnRing ? matcherMixWeight : undefined,
        matcherPosteriorUpdates: matcherOnRing ? matcherPosterior.updates : undefined,
        pHitPredicted: best.pHit + best.pCrit,
        realizedHit,
        zoneMapVersion: CURRENT_ZONE_MAP_VERSION,
        // [session 61 §4b] Copied, not aliased — the array keeps mutating as
        // the cast spends more, and a shared reference would retroactively
        // rewrite every earlier turn's record to the cast's final loadout.
        oilItemIdsUsed: oilItemIdsUsedThisCast.length > 0 ? [...oilItemIdsUsedThisCast] : undefined,
      };
      appendRingPrediction(rec, ringPredictionLogPath);
      log.write({ event: "ring_prediction", ...rec });
      console.log(
        `  · predictors: ring p(actual)=${rec.pActual.toFixed(3)} ${hit ? "TOP1" : "    "}` +
          ` | baseline p(actual)=${(rec.baselinePActual ?? 0).toFixed(3)} ${rec.baselineHit ? "TOP1" : "    "}` +
          ` | shot P_hit ${(rec.pHitPredicted ?? 0).toFixed(2)} → ${realizedHit ? "HIT" : "miss"}` +
          (rec.matcherWeight !== undefined
            ? ` | matcher π=${rec.matcherWeight.toFixed(3)} (n=${rec.matcherPosteriorUpdates ?? 0})`
            : ""),
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

    // [session 51 §3] Fold this turn's evidence into the matcher posterior
    // BEFORE `observe()` narrows the candidate set: the likelihood ratio is
    // what the two tiers said about this move while it was still unknown.
    if (matcherOnRing && ringDist) {
      matcherPosterior = updateMatcherPosterior(
        matcherPosterior,
        probabilityOf(matcherOnRing, toCell),
        probabilityOf(ringDist, toCell),
        matcherPosteriorOpts,
      );
    }
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
  await resolvePendingCardOffer(doc, { client, guards, log, fixtures, logsDir, dryRun, turn, where: "cast end" });

  // [session 62 §1b] Record the THIRD state, if this cast hit it. Written only
  // when a trigger actually fired dry — an empty file is the normal state and
  // a row per cast would drown the signal. `oilsConsumed > 0` alongside
  // `dryTriggers > 0` is the half-oiled cast the brief warned about: the bag
  // ran dry PART-way through, which is neither arm and is the case partial
  // stock makes likely rather than exotic.
  if (oilTriggerNoStock.length > 0 && !dryRun) {
    appendOilCastState(
      {
        castId,
        at: new Date().toISOString(),
        dryTriggers: oilTriggerNoStock.length,
        reasons: [...new Set(oilTriggerNoStock.map((r) => r.reason))],
        oilsConsumed: oilsUsedThisCast,
      },
      deps.oilCastStatePath ?? DEFAULT_OIL_CAST_STATE_PATH,
    );
    console.log(
      `  ▸ cast ${castId} flagged OIL-POLICY-DRY (${oilTriggerNoStock.length} trigger(s) with no stock, ` +
        `${oilsUsedThisCast} oil(s) actually spent) — excluded from BOTH outcome arms (§1b).`,
    );
  }

  return { outcome, turns: turn, oilTriggerNoStock, oilsConsumed: oilsUsedThisCast, oilShadowRecords };
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
  // [session 64 §2] The BATCH. Casts under the live on-demand policy until one
  // of `oilBatch.ts`'s five halt conditions fires — the intended exit being the
  // first cast that actually consumes an oil. Without this flag the loop is
  // byte-for-byte what it has always been: `--casts=N` runs N casts and stops.
  const oilBatch = argv.includes("--oil-batch");
  return { dryRun, status, casts, noRomClaim, oilBatch };
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

  // [session 59] See liveRun.ts's main() — same seam, same guarantee: with no
  // --profile every path below is byte-for-byte what this script has always
  // used. Resolved before the --status branch so `--status --profile=x` reports
  // x's ledgers rather than the default's.
  const profile = resolveProfile(profileArg(process.argv));
  const fishingGuardPath = dataPath(profile, "guard-budget-fishing.json");

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
  const client = new GigaverseClient({ jwt: await profile.getJwt() });
  if (profile.name !== "default") {
    console.log(`  · profile: ${profile.name} — data ${profile.dataRoot}, logs ${profile.logRoot}, jwt ${profile.jwtPath}`);
  }

  // [session 28, CODEXREVIEW #2] Same discipline as liveRun.ts — one live
  // writer per guard-state file for the whole process lifetime.
  process.once("exit", acquireGuardLock(fishingGuardPath));

  const seed = loadGuardBudget(fishingGuardPath);
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
  const log = new RunLog(profile.logRoot);

  const me = await client.getMe();
  console.log(`  account <USER>`);

  // [session 66 §1] Surface the tripwire's state BEFORE any cast runs. A
  // safeguard nobody can see the state of is one that gets rediscovered by
  // accident three sessions later — which is what happened to the override
  // itself, arming live in session 65 without a decision being taken. Printed
  // every invocation, armed or not, so "it is still armed" is an observation
  // rather than an assumption.
  const nextPositionArmStatePath = dataPath(profile, "nextPositionOverrideDisarm.json");
  const armState = readArmState(nextPositionArmStatePath);
  console.log(`  ${armState.disarmed ? "★★★ " : "· "}${describeArmState(armState, nextPositionArmStatePath)}`);

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

  // [session 65 §1b] The batch's ceiling is now the CAST CAP and that cap is
  // the INTENDED EXIT, which inverts session 64's arrangement: there the loop
  // expected to exit early on a consume and the ceiling was the clean-cast
  // tripwire; here every cast is wanted for its instrumented turns and a
  // consume is a capture, so the batch runs the full seven. An explicit
  // --casts= still wins downward only, so the cap can be lowered for a probe
  // but never silently raised past the authorized batch size.
  //
  // **[session 66 §4] THE OBJECTIVE THIS SHAPE WAS CHOSEN FOR IS CLOSED.**
  // Session 65 ran seven casts to accumulate instrumented matcher turns for
  // §19, and §19 landed a POWERED KEEP at n=35 of 32. The shape is left in
  // place because it is a working, tested batch shape and nothing about it is
  // wrong — but the seven is no longer justified by anything, so a session
  // that runs `--oil-batch` should be running it for a reason stated in its
  // own brief. Do not read this line as a standing authorization for seven
  // casts, and do not budget casts for §19.
  const batchLimits = SESSION_65_LIMITS;
  const authorizedCasts = batchLimits.castCap ?? args.casts;
  const batchCeiling = Math.min(args.casts > 1 ? args.casts : authorizedCasts, authorizedCasts);
  const targetCasts = args.dryRun ? 1 : args.oilBatch ? batchCeiling : args.casts;

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
  // [session 64 §2b] Batch tallies. Only read when --oil-batch is set.
  let batchOilsConsumed = 0;
  let batchCleanCasts = 0;
  // The zero-streak tripwire, seeded from the committed corpus and extended by
  // this batch's own casts. Seeded rather than started at zero because the
  // streak spans sessions by design (`zeroStreak.ts`: it deliberately does not
  // reset on a policy change), so a batch that starts counting from scratch
  // could never trip it — the failure its header calls "a sentence about" a
  // safeguard. `castOutcomesChronological` drops incomplete casts, per that
  // function's contract.
  const batchOutcomes: boolean[] = args.oilBatch ? [...castOutcomesChronological(loadFishingCorpus())] : [];
  if (args.oilBatch) {
    const seeded = evaluateZeroStreak(batchOutcomes);
    console.log(`  · zero-streak at batch start: ${seeded.rationale}`);
  }
  for (let i = 0; i < targetCasts; i++) {
    if (shutdownSignal.requested) {
      console.log(`\n▸ stopped by SIGINT before cast ${i + 1}/${targetCasts}.`);
      break;
    }
    console.log(`\n▸ cast ${i + 1}/${targetCasts}`);
    // [session 28, CODEXREVIEW #1] Fresh per cast, not once per invocation —
    // one directory must correspond to exactly one docId. See FixtureWriter's
    // own doc comment.
    const fixtures = new FixtureWriter(me.address, (text) => client.redactSecrets(text), fixturePath(profile, "fishing-casts", "live"));
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
        guardStatePath: fishingGuardPath,
        shutdownSignal,
        // ── [session 64] THE WIRE THAT WAS NEVER CONNECTED ──────────────────
        //
        // `oilBudget` is optional on `LiveFishingDeps` and `main()` never set
        // it, so `mayConsumeOil` saw `configured: undefined` on every live
        // cast and refused with "no `dendren.oils` block in config/bot.json".
        // The block has been present and `policyApproved: true` since session
        // 62; the loop simply never handed it over.
        //
        // That is why `on-demand` had "never consumed an oil live" across
        // sessions 62, 63 and this one's first six casts. It was read as bad
        // luck and then as a possible flaw in the trigger model. It was
        // neither: the triggers fired (three times in cast 1 alone) and the
        // policy was refused by a dependency nobody passed.
        //
        // The field's own doc comment is what hid it — "omitting it writes
        // nothing anywhere, it only makes the loop more conservative" is true,
        // and it makes the permanently-omitted case look like a safe default
        // rather than a dead feature. `tests/fishing/oilPolicy.test.ts` pinned
        // the INNER hop (`runOneCast` -> `mayConsumeOil`) and passed the whole
        // time; nothing pinned this outer one. It is pinned now.
        oilBudget: config.dendren?.oils,
        // ── [session 66 §1] THE POPULATE SIDE OF THE TRIPWIRE ───────────────
        //
        // Handed over explicitly, profile-scoped, rather than left to
        // `runOneCast`'s default. Session 64's headline was a config block
        // that existed, was approved, was tested at the inner hop, and was
        // never populated by `main()` — inert for three sessions while looking
        // shipped. A test of the read path alone would pass identically on a
        // permanently-armed override and a permanently-disarmed one, so what
        // gets pinned is THIS line and the write that fills the file.
        nextPositionArmStatePath,
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

    // ── [session 64 §2b] THE BATCH'S HALT CHECK ──────────────────────────────
    //
    // Between casts only. Stop condition 1 is "a cast consumes an oil — finish
    // that cast completely, then stop", so this deliberately runs AFTER
    // `runOneCast` has returned rather than interrupting the cast a consume
    // happened in.
    //
    // Both inputs are read LIVE rather than inferred. The ledger is the
    // server's own `dayDocs`, per rule 13's principle that the ledger is the
    // only authority on what was spent; the balances are re-read because a
    // consume during the cast just changed them, and the pre-cast read is
    // stale by exactly the amount that matters.
    if (args.oilBatch) {
      batchOilsConsumed += result?.oilsConsumed ?? 0;
      if ((result?.oilsConsumed ?? 0) === 0) batchCleanCasts++;
      // `turn_cap` is not an outcome about the fishery any more than an
      // incomplete cast is, so only a real terminal result extends the streak.
      if (result?.outcome === "caught" || result?.outcome === "escaped") {
        batchOutcomes.push(result.outcome === "caught");
      }

      let ledgerRemaining: number | null = null;
      let focusHeld = 0;
      let relaxingHeld = 0;
      try {
        const fishingState = await client.getFishingState(me.address);
        ledgerRemaining = dendrenCastsRemaining(fishingState as never);
        const balances = await client.getItemsBalances();
        const balanceOf = (id: number) => Number(balances.entities.find((e) => e.ID_CID === String(id))?.BALANCE_CID ?? 0);
        focusHeld = balanceOf(MID_FOCUS_OIL_ITEM_ID);
        relaxingHeld = balanceOf(MID_RELAXING_OIL_ITEM_ID);
      } catch (e) {
        // Rule 5, fail closed. A batch that cannot see the ledger or the bag
        // must not keep spending casts on the assumption that both are fine.
        throw new GuardTrip("batch halt check could not read the ledger or oil balances", {
          error: (e as Error).message,
        });
      }
      if (ledgerRemaining === null) {
        throw new GuardTrip("batch halt check: dayDocs gave no Dendren entry — cannot tell casts remaining from zero", {});
      }

      const verdict = batchVerdict({
        castsPlayed: i + 1,
        oilsConsumed: batchOilsConsumed,
        cleanCasts: batchCleanCasts,
        ledgerCastsRemaining: ledgerRemaining,
        focusOilHeld: focusHeld,
        relaxingOilHeld: relaxingHeld,
        zeroStreak: evaluateZeroStreak(batchOutcomes).streak,
      }, batchLimits);
      console.log(
        `  · batch state: cast ${i + 1}, oils consumed ${batchOilsConsumed}, clean ${batchCleanCasts}, ` +
          `ledger ${ledgerRemaining} left, held Focus ${focusHeld} / Relaxing ${relaxingHeld}`,
      );
      log.write({ event: "batch_verdict", cast: i + 1, oilsConsumed: batchOilsConsumed, cleanCasts: batchCleanCasts, ledgerRemaining, focusHeld, relaxingHeld, verdict });
      if (verdict.stop) {
        console.log(`\n▸ BATCH HALT (${verdict.reason}) — ${verdict.detail}`);
        break;
      }
    }
  }
  uninstallSigint();

  // [session 65 §1b] §2c REPORTS EVEN THOUGH IT NO LONGER HALTS. Session 64's
  // recap kept the six-clean-casts interpretation pre-registered for a batch
  // against FIXED code, and this is that batch; setting `cleanCastCap` to null
  // suppresses the halt, not the pre-registration. Printing it here is what
  // makes "reports without halting" true rather than a claim in a comment.
  if (args.oilBatch) {
    const tripwire = SESSION_64_LIMITS.cleanCastCap ?? Infinity;
    console.log(
      `\n▸ §2c clean-cast tripwire: ${batchCleanCasts} clean cast(s) of ${targetCasts}, ` +
        `${batchOilsConsumed} oil(s) consumed. Pre-registered threshold ${tripwire} — ` +
        (batchCleanCasts >= tripwire
          ? `REACHED. Under the sim's ~0.70 oils/cast this is a ~1-in-900 event: report it as evidence ` +
            `the trigger model does not describe live play. The batch was NOT extended and NOT cut short.`
          : `not reached.`),
    );
  }

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
