/**
 * src/sim/fishing/offPolicyReplay.ts — [session 47, brief §1b]
 *
 * **Predict a batch's outcome before spending it.** Re-runs today's policy
 * stack against the 68 real casts already recorded, taking the fish's actual
 * trajectory as ground truth and re-simulating everything the policy controls:
 * focus placement, card choice, mana, fish HP, focus meter.
 *
 * ── Why this is licensed ──────────────────────────────────────────────────
 *
 * The replay is valid only if the fish's movement is independent of whether
 * your shot hit. Two things establish that:
 *
 *  1. **Within a turn the fish moves FIRST.** Event order is
 *     `FISH_MOVED -> CARD_PLAYED -> HIT`, so turn t's card provably cannot
 *     affect turn t's move.
 *  2. **Across turns, no dependence is detectable.**
 *     `scripts/auditMovementIndependence.ts` conditions on step class and
 *     previous displacement and finds nothing at n = 211 (6 tests, smallest
 *     raw p = 0.021, Bonferroni-adjusted 0.13). That is failure to detect at
 *     this corpus size, not proof — run it again as the corpus grows.
 *
 * ── What the corpus can and cannot supply ─────────────────────────────────
 *
 * The draw pile is a hidden server-side shuffle: `fullDeck` is a canonical
 * sorted list and does NOT reconstruct draws (0/56 refills match a slice of
 * it). See `CastTurn.newHand` for the full correction and for why the replay
 * does not need it — one card per turn means a counterfactual empties the hand
 * on the same turn as the record, so the recorded `NEW_HAND` is exactly the
 * right refill. Order within a 3-card block is free; the blocks are pinned.
 *
 * ── The three conservatisms, stated rather than buried ────────────────────
 *
 *  1. **Truncation at the recorded length.** A cast that would have run longer
 *     than the record is scored as NOT caught. The recorded cast ended when
 *     the OLD policy's misses drove the fish's HP to max, so a better policy
 *     would genuinely have had more turns — this bound bites in the right
 *     direction and `ReplayReport.truncated` says how often.
 *  2. **Leave-one-cast-out.** Every model the policy consults (the step-class
 *     ring table, the contextual fallback's two maps) is rebuilt with the cast
 *     being replayed excluded. Without that the number is in-sample and
 *     worthless.
 *  3. **The pattern-matcher tier is disabled.** Live it sits above the ring
 *     model, but its candidates are mined FROM this corpus, and leave-one-out
 *     on the ring table would not undo that leakage. Dropping it removes the
 *     policy's strongest tier, so the replay understates the live stack.
 *
 * Pure — corpus in, numbers out, no I/O and no network (CLAUDE.md's sim/api
 * split). Loading the traces is the caller's job.
 */

import {
  chooseCard,
  DEFAULT_FOCUS_RESERVE_WEIGHT,
  type FishingCardLike,
  type FocusBudget,
} from "../../strategy/fishing/cardChoice.js";
import {
  buildContextualMap,
  buildCellOnlyMap,
  contextualFallback,
  previousDisplacement,
  DEFAULT_SHRINKAGE_K,
} from "../../strategy/fishing/contextualFallback.js";
import {
  buildStepClassTable,
  classifyStep,
  ringDistribution,
  ringDistributionUnknownClass,
} from "../../strategy/fishing/stepClass.js";
import type { Cast } from "./transitionCorpus.js";
import type { CastTrace, TraceCard } from "./castTrace.js";
import { cellKey, manhattan, zonesToCells, type Cell } from "./geometry.js";

export type ReplayOutcome =
  | "caught"
  | "escaped_meter"
  /** The recorded trajectory ran out before the cast resolved — scored as not caught. */
  | "truncated"
  /** No affordable card; the live loop halts here (CLAUDE.md §5), so the replay does too. */
  | "no_affordable_card"
  /** The record had no refill to supply when the counterfactual emptied its hand. */
  | "hand_exhausted";

export interface ReplayTurn {
  turn: number;
  /** Did the counterfactual policy connect? */
  hit: boolean;
  /** Did the recorded policy connect on this same turn, against this same fish? */
  actualHit: boolean;
  cardId: number;
  focus: Cell;
  /** −log p assigned to the cell the fish actually moved to, by the policy's own distribution. */
  logLoss: number;
  /** Same, by the shipped `contextualFallback` baseline — the paired comparison. */
  baselineLogLoss: number;
}

export interface ReplayCastResult {
  docId: string;
  outcome: ReplayOutcome;
  /** True in the record. */
  actuallyCaught: boolean;
  turns: ReplayTurn[];
  finalFishHp: number;
  fishMaxHp: number;
  /** Recorded turns available; `turns.length` reaching this means the bound bit. */
  recordedTurns: number;
}

export interface ReplayReport {
  casts: number;
  caught: number;
  actuallyCaught: number;
  truncated: number;
  noAffordableCard: number;
  handExhausted: number;
  hits: number;
  shots: number;
  actualHits: number;
  /** Recorded hits over the SAME turns the replay scored — the paired denominator, not the corpus total. */
  actualShotsOnReplayedTurns: number;
  /** Paired per-turn (baseline − policy) log-loss differences; positive favours the policy. */
  logLossDiffs: number[];
  results: ReplayCastResult[];
}

/** Projects a trace's positions into the `Cast` shape the corpus model builders take. */
export function traceToCast(t: CastTrace): Cast {
  const byTurn = new Map<number, Cell>();
  for (let i = 1; i < t.turns.length; i++) byTurn.set(i - 1, t.turns[i]!.fishPosition);
  return {
    castId: t.docId,
    gridSize: t.turns[0]!.gridSize,
    start: t.turns[0]!.fishPosition,
    byTurn,
    maxTurn: t.turns.length - 2,
    duplicateTurns: [],
    hasGaps: false,
  };
}

function toCardLike(c: TraceCard): FishingCardLike {
  return {
    id: c.id,
    manaCost: c.manaCost,
    hitZones: c.hitZones,
    critZones: c.critZones,
    hitEffects: c.hitEffects,
    missEffects: c.missEffects,
    critEffects: (c as unknown as { critEffects?: { amount: number }[] }).critEffects ?? [],
  };
}

const FLOOR = 1e-9;

function lossOn(dist: ReadonlyMap<string, { cell: Cell; p: number }>, actual: Cell): number {
  return -Math.log(Math.max(FLOOR, dist.get(cellKey(actual))?.p ?? 0));
}

export interface ReplayOptions {
  /** Defaults to the shipped `DEFAULT_FOCUS_RESERVE_WEIGHT`. */
  focusReserveWeight?: number;
  /** `chooseCard`'s miss-penalty multiplier; the live call site passes 1. */
  missPenaltyMultiplier?: number;
  /**
   * Resolve shots under a TRANSPOSED zone template while the policy plans
   * under the correct one — the regime every recorded cast was actually
   * played in, before session 47 fixed `ZONE_OFFSET`.
   *
   * The implementation is a reflection of the fish's cell about the focus
   * point's diagonal, which is exact rather than approximate: the two
   * templates differ by `swap`, an involution, so "plan with `swap∘true`,
   * resolve with `true`" and "plan with `true`, resolve with `swap∘true`"
   * are the same mismatch with the sign flipped, and identical in magnitude.
   * Using the reflection avoids threading an alternative zone map through
   * `chooseCard`/`bestFocusForCard` — i.e. avoids surgery on shipped strategy
   * code for the sake of a diagnostic.
   *
   * This arm exists to answer the obvious question about the headline number:
   * how much of the lift is the zone fix, and how much is the predictor?
   */
  mismatchedZones?: boolean;
}

/** Reflect `c` about the diagonal through `focus` — see `ReplayOptions.mismatchedZones`. */
function reflectAbout(focus: Cell, c: Cell): Cell {
  return { x: focus.x + (c.y - focus.y), y: focus.y + (c.x - focus.x) };
}

/**
 * Replays ONE cast against models built from `others` (which must not contain
 * it — `replayCorpus` enforces that).
 */
export function replayCast(target: CastTrace, others: readonly CastTrace[], opts: ReplayOptions = {}): ReplayCastResult {
  const focusReserveWeight = opts.focusReserveWeight ?? DEFAULT_FOCUS_RESERVE_WEIGHT;
  const missPenaltyMultiplier = opts.missPenaltyMultiplier ?? 1;

  const otherCasts = others.map(traceToCast);
  const table = buildStepClassTable(otherCasts);
  const contextMap = buildContextualMap(otherCasts);
  const cellOnlyMap = buildCellOnlyMap(otherCasts);

  const t0 = target.turns[0]!;
  const gridSize = t0.gridSize;
  const fishMaxHp = t0.fishMaxHp;

  let fishHp = t0.fishHp;
  let mana = t0.mana;
  let focus: FocusBudget = { current: t0.focusPoint, remaining: t0.focusMeter };
  let hand = [...t0.hand];
  const history: Cell[] = [t0.fishPosition];

  const turns: ReplayTurn[] = [];
  let outcome: ReplayOutcome = "truncated";

  for (let i = 1; i < target.turns.length; i++) {
    const rec = target.turns[i]!;
    if (!rec.play) break;

    const currentCell = history[history.length - 1]!;
    const prevDelta = previousDisplacement(history);
    const stepClass = classifyStep(history);
    const dist =
      stepClass === null
        ? ringDistributionUnknownClass(currentCell, prevDelta, table, gridSize)
        : ringDistribution(currentCell, stepClass, prevDelta, table, gridSize);
    const baseline = contextualFallback(currentCell, prevDelta, contextMap, cellOnlyMap, gridSize, {
      shrinkageK: DEFAULT_SHRINKAGE_K,
    });

    const cards = hand.map((id) => toCardLike(target.cards.get(id)!));
    const choice = chooseCard(cards, mana, dist, gridSize, missPenaltyMultiplier, fishHp, focus, true, focusReserveWeight);
    if (!choice) {
      outcome = "no_affordable_card";
      break;
    }

    // The fish moves before the card resolves — this is the cell it moved to.
    const actual = rec.fishPosition;

    const moveCost = manhattan(focus.current, choice.focus);
    focus = { current: choice.focus, remaining: Math.max(0, focus.remaining - moveCost) };
    mana -= choice.card.manaCost;

    const resolveAgainst = opts.mismatchedZones ? reflectAbout(choice.focus, actual) : actual;
    const key = cellKey(resolveAgainst);
    const critKeys = new Set(zonesToCells(choice.focus, choice.card.critZones, gridSize).map(cellKey));
    const hitKeys = new Set(zonesToCells(choice.focus, choice.card.hitZones, gridSize).map(cellKey));
    const crit = critKeys.has(key);
    const hit = crit || hitKeys.has(key);
    const amount = crit
      ? (choice.card.critEffects[0]?.amount ?? choice.card.hitEffects[0]?.amount ?? 0)
      : hit
        ? (choice.card.hitEffects[0]?.amount ?? 0)
        : (choice.card.missEffects[0]?.amount ?? 0);
    fishHp = hit ? Math.max(0, fishHp - amount) : Math.min(fishMaxHp, fishHp - amount);

    turns.push({
      turn: i,
      hit,
      actualHit: rec.play.hit,
      cardId: choice.card.id,
      focus: choice.focus,
      logLoss: lossOn(dist, actual),
      baselineLogLoss: lossOn(baseline, actual),
    });

    history.push(actual);
    hand = hand.filter((_, idx) => idx !== choice.handIndex);

    if (fishHp <= 0) {
      outcome = "caught";
      break;
    }
    if (fishHp >= fishMaxHp) {
      outcome = "escaped_meter";
      break;
    }
    if (hand.length === 0) {
      if (!rec.newHand) {
        // The record refilled at a different point, or ended here. Either way
        // the corpus cannot say what would have been drawn.
        outcome = "hand_exhausted";
        break;
      }
      hand = [...rec.newHand];
    }
  }

  return {
    docId: target.docId,
    outcome,
    actuallyCaught: target.caught,
    turns,
    finalFishHp: fishHp,
    fishMaxHp,
    recordedTurns: target.turns.length - 1,
  };
}

/** Replays every trace, each against a model refit without it. */
export function replayCorpus(traces: readonly CastTrace[], opts: ReplayOptions = {}): ReplayReport {
  const results = traces.map((t, i) =>
    replayCast(
      t,
      traces.filter((_, j) => j !== i),
      opts,
    ),
  );

  const report: ReplayReport = {
    casts: results.length,
    caught: results.filter((r) => r.outcome === "caught").length,
    actuallyCaught: results.filter((r) => r.actuallyCaught).length,
    truncated: results.filter((r) => r.outcome === "truncated").length,
    noAffordableCard: results.filter((r) => r.outcome === "no_affordable_card").length,
    handExhausted: results.filter((r) => r.outcome === "hand_exhausted").length,
    hits: 0,
    shots: 0,
    actualHits: 0,
    actualShotsOnReplayedTurns: 0,
    logLossDiffs: [],
    results,
  };
  for (const r of results) {
    for (const t of r.turns) {
      report.shots++;
      if (t.hit) report.hits++;
      report.actualShotsOnReplayedTurns++;
      if (t.actualHit) report.actualHits++;
      report.logLossDiffs.push(t.baselineLogLoss - t.logLoss);
    }
  }
  return report;
}
