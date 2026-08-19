/**
 * src/sim/fishing/castSim.ts — synthetic Dendren casts, mirroring
 * `src/sim/dungeonSim.ts`'s shape (pluggable policy, seeded rng, no network).
 *
 * The confirmed mechanics (mana pool, catch-meter direction, hit/crit
 * geometry, hand refill-on-empty) come from the one real capture — see
 * SPEC.md §5 / SPEC-fishing.md §4.
 *
 * The fish's movement rule has TWO modes:
 *
 *  - default, and every caller before session 45: drawn from the SYNTHETIC
 *    pattern pool (`patterns.ts`), for internal consistency with the matcher
 *    under test. Answers "does the algorithm work, and does an EV-informed
 *    policy beat random card choice", not "what does Dendren actually do" —
 *    see `patterns.ts`'s header for why that was the right scope for Task 8's
 *    gate.
 *  - `empiricalFish` [session 45]: drawn from the REAL corpus's movement
 *    statistics (`empiricalFish.ts`). This is the mode that answers the
 *    second question, and it changes the answers materially — at the real
 *    deck and real parameters, today's live configuration scores 13.3-13.6%
 *    against the synthetic fish and 5.5% against the empirical one, and the
 *    live figure it is trying to predict is 7/67 = 10.4% all-time (0/16 on
 *    session 44's batch). It also reverses session 44's heuristic-(d)
 *    verdict; see `scripts/fishingEmpiricalAblation.ts` and
 *    SPEC-fishing.md §8.
 */

import { chooseCard, shouldRedraw, type FishingCardLike, type FocusBudget } from "../../strategy/fishing/cardChoice.js";
import {
  emptyFallback,
  initMatcher,
  mixDistributions,
  observe,
  predictDistribution,
  type MatcherState,
} from "../../strategy/fishing/matcher.js";
import {
  contextualFallback,
  previousDisplacement,
  DEFAULT_SHRINKAGE_K,
  type ContextStats,
} from "../../strategy/fishing/contextualFallback.js";
import {
  classifyStep,
  intersectWithRing,
  ringDistribution,
  ringDistributionUnknownClass,
  DEFAULT_RING_MODEL_OPTIONS,
  type RingModelOptions,
  type StepClassTable,
} from "../../strategy/fishing/stepClass.js";
import type { Cell } from "./geometry.js";
import { cellKey, FOCUS_METER_MAX, manhattan, reachableCells, zonesToCells } from "./geometry.js";
import { loadDendrenDeck } from "./deck.js";
import { buildPatternPool, toCandidate, type Pattern } from "./patterns.js";
import { sampleEmpiricalTrajectory, type EmpiricalFishOptions } from "./empiricalFish.js";
import { makeRng, type Rng } from "../rng.js";

export type CastOutcome = "caught" | "escaped_meter" | "escaped_mana" | "stalled";

export interface CastResult {
  outcome: CastOutcome;
  turns: number;
  finalFishHp: number;
}

export interface FishPolicyContext {
  hand: FishingCardLike[];
  mana: number;
  dist: ReadonlyMap<string, { cell: Cell; p: number }>;
  gridSize: number;
  fishHp: number;
  focusBudget: FocusBudget;
}

/**
 * [session 45] `FOCUS_METER_MAX` now lives in `geometry.ts` (alongside
 * `reachableCells`, which documents the spend rule it belongs to) so
 * `src/strategy/fishing/cardChoice.ts` can normalize its focus-reserve term
 * against it without a strategy->sim import. Re-exported here so every
 * existing `from "./castSim.js"` import site is unchanged.
 */
export { FOCUS_METER_MAX };

/**
 * **[CONFIRMED 2026-08-15, session 13, live]** The one real cast's
 * `focusPoint` before any move was `[2,2]` on the confirmed 4×4 grid
 * (SPEC-fishing.md §4) — the grid's center cell, not a corner or (1,1).
 * `Math.ceil(gridSize/2)` reproduces `[2,2]` at `gridSize=4` and generalizes
 * sanely to other sizes without inventing a new mechanic.
 */
export function defaultStartFocus(gridSize: number): Cell {
  const c = Math.ceil(gridSize / 2);
  return { x: c, y: c };
}

export type FishAction =
  | { type: "play"; handIndex: number; focus: Cell }
  | { type: "redraw" }
  | { type: "pass" };

export interface FishPolicy {
  name: string;
  act(ctx: FishPolicyContext, rng: Rng): FishAction;
}

export const randomFishPolicy: FishPolicy = {
  name: "random",
  act(ctx, rng) {
    const affordable = ctx.hand
      .map((_, i) => i)
      .filter((i) => ctx.hand[i]!.manaCost <= ctx.mana);
    if (affordable.length === 0) return { type: "pass" };
    const handIndex = rng.pick(affordable);
    const cells = reachableCells(ctx.gridSize, ctx.focusBudget.current, ctx.focusBudget.remaining);
    return { type: "play", handIndex, focus: rng.pick(cells) };
  },
};

/**
 * **[RE-TUNED session 13]** Was `3`, calibrated back when `shouldRedraw`
 * compared against `evPerMana` (a bug — SPEC.md §5 always said raw `ev`;
 * fixed in `cardChoice.ts` this session). Under the corrected hit-
 * probability-first `chooseCard`, `ev` is on a different scale and a hand's
 * best card is almost always genuinely worth playing — a 500-cast sweep of
 * {-∞, 0, 1, 2, 3, 5, 8} found catch rate falls monotonically as the
 * threshold rises (92.8% at -∞, 92.4% at 0, down to 0.4% at 8): every extra
 * redraw burns `hand.length` mana for a re-roll that's rarely needed once
 * card choice targets hit probability, and mana is scarce enough now that
 * the burn matters. `0` (redraw only when even the best card has negative
 * EV) is 462/500 vs -∞'s 464/500 — inside noise at n=500 — and matches
 * SPEC's literal "max EV < threshold" more honestly than disabling redraw
 * outright.
 */
export const REDRAW_THRESHOLD = 0;

/**
 * Factory, not a hardcoded policy — added session 21 so
 * `scripts/redrawThresholdSweep.ts` can sweep the threshold against the sim
 * without duplicating `matcherFishPolicy`'s decision logic. `matcherFishPolicy`
 * below is just `makeMatcherFishPolicy(REDRAW_THRESHOLD)`, unchanged behavior.
 *
 * [session 44] `heuristicsEnabled` (default `true`, matching `chooseCard`'s
 * own default) threads through to heuristics (a)/(f) inside `chooseCard`
 * itself — see `scripts/fishingHeuristicAblation.ts`, which is the only
 * caller that ever passes `false`.
 */
export function makeMatcherFishPolicy(
  redrawThreshold: number,
  heuristicsEnabled: boolean = true,
  /** [session 45] Weight on `cardChoice.ts`'s focus-reserve continuation term. Default 0 = the pre-session-45 greedy policy, unchanged. Swept by `scripts/focusReserveAblation.ts`. */
  focusReserveWeight: number = 0,
): FishPolicy {
  return {
    name: `matcher-ev(redraw=${redrawThreshold},w=${focusReserveWeight})`,
    act(ctx) {
      const missPenaltyMultiplier = 1;
      const best = chooseCard(ctx.hand, ctx.mana, ctx.dist, ctx.gridSize, missPenaltyMultiplier, ctx.fishHp, ctx.focusBudget, heuristicsEnabled, focusReserveWeight);
      if (!best) {
        if (ctx.mana >= ctx.hand.length && ctx.hand.length > 0) return { type: "redraw" };
        return { type: "pass" };
      }
      if (shouldRedraw(best, ctx.hand.length, ctx.mana, redrawThreshold) && ctx.mana >= ctx.hand.length) {
        return { type: "redraw" };
      }
      return { type: "play", handIndex: best.handIndex, focus: best.focus };
    },
  };
}

export const matcherFishPolicy: FishPolicy = makeMatcherFishPolicy(REDRAW_THRESHOLD);

export interface CastOptions {
  seed: number;
  policy: FishPolicy;
  gridSize?: number;
  handSize?: number;
  startMana?: number;
  fishMaxHp?: number;
  startFishHpRatio?: number;
  maxTurns?: number;
  /** Pool the TRUE fish pattern is drawn from. Defaults to the full synthetic pool. */
  candidatePool?: Pattern[];
  /**
   * **[ADDED session 14]** Pool the MATCHER searches when identifying the
   * fish — defaults to `candidatePool` (i.e. the matcher can always, in
   * principle, identify the true pattern; the corpus's own 92.4% figure
   * assumed this). Set to `[]` to force the matcher permanently blind
   * (`emptyFallback`/uniform every turn) regardless of the true pattern —
   * this is what actually happened on all 5 real live casts (STATE.md
   * session 13: the real Dendren pattern isn't in this synthetic library at
   * all), and separating the two pools is what makes that condition
   * reproducible in the sim instead of conflated with "matcher searches
   * correctly but hasn't converged yet."
   */
  matcherPool?: Pattern[];
  /**
   * **[ADDED session 26, Task 13 infrastructure]** A real held deck — card
   * ids resolved against `loadDendrenDeck()`'s catalog, e.g. straight off a
   * live `doc.data.fullDeck` read — instead of a fresh random sample of the
   * WHOLE catalog on every single cast (the prior, and still-default,
   * behavior: `deck.push(rng.pick(catalog))`, sized to `catalog.length`,
   * with no concept of "the deck this specific account actually has").
   * Order matters — `drawHand` draws sequentially off this array, cycling
   * with `% deck.length`, same as the random-sample path always has.
   * Infrastructure only: nothing yet calls this with a real deck, and
   * `chooseNewCard`'s own scoring logic is unchanged — see TASKS.md Task
   * 13's own scoping note on why the scoring half stays unbuilt this
   * session.
   */
  deckIds?: readonly number[];
  /**
   * **[ADDED session 33, CODEXIMPROVE #3]** When the matcher is blind
   * (`matcherPool: []`, the condition session 14 established as
   * representative of real live Dendren play — STATE.md session 13: the
   * matcher has never once identified the real pattern), this sim has
   * always fallen back to UNIFORM regardless of any real transition data
   * (`emptyFallback(..., new Map(), gridSize)`, hardcoded) — deliberately,
   * per session 14's framing that the sim's synthetic ground truth and any
   * real corpus are different domains that shouldn't be conflated. This
   * option is opt-in and additive: omitted, behavior is byte-for-byte
   * unchanged (still hardcoded uniform). Supplying it lets an ablation ask
   * a narrower, still-honest question — "when the true movement genuinely
   * has previous-direction structure (drawn from the same candidatePool a
   * mined empirical map was built from), does the contextual backoff
   * algorithm correctly exploit it" — which is what `scripts/
   * fishingContextualAblation.ts` uses this for. This is NOT a live
   * catch-rate promise about real Dendren; see that script's header.
   */
  blindFallback?: {
    contextMap: ReadonlyMap<string, ContextStats>;
    cellOnlyMap: ReadonlyMap<string, readonly Cell[]>;
    shrinkageK?: number;
  };
    /**
   * [session 45, brief §2] Draw the TRUE fish from the real corpus's
   * movement statistics (`empiricalFish.ts`) instead of from `patterns.ts`'s
   * synthetic primitive pool. Opt-in and additive: omitted, the sim is
   * byte-for-byte the synthetic-pool sim it has always been.
   *
   * When supplied, `matcherPool` defaults to `[]` (permanently blind) rather
   * than to the true pool — an empirically-sampled fish is not a member of
   * the synthetic library, so defaulting the matcher to "can always identify
   * the truth in principle" would be false by construction. Pass the mined
   * `perimeterWalk` candidates explicitly if you want them searched; they
   * match 8 of 67 real casts, so that is a legitimate configuration, just
   * not the default.
   */
  empiricalFish?: {
    table: StepClassTable;
    options?: EmpiricalFishOptions;
  };
  /**
   * [session 45, brief §1 design note 3] Use the step-class RING model as the
   * policy's predictor. Tier 0 stays the pattern matcher while live
   * candidates survive — but its output is INTERSECTED with the legal
   * `k`-ring, since a surviving candidate predicting an off-ring cell is
   * provably wrong (FACT 1, 259/259) and its mass should never reach
   * `chooseCard`. If nothing survives that intersection the candidate set is
   * fully refuted and the ring model takes over for that turn. Tier 1 is the
   * ring model itself; `blindFallback`/`emptyFallback` drop to tier 2.
   *
   * Opt-in: omitted, the distribution pipeline is unchanged.
   */
  ringModel?: {
    table: StepClassTable;
    options?: RingModelOptions;
  };
}

function drawHand(deck: FishingCardLike[], drawIdx: number, handSize: number): { hand: FishingCardLike[]; nextIdx: number } {
  const hand: FishingCardLike[] = [];
  let idx = drawIdx;
  for (let i = 0; i < handSize; i++) {
    hand.push(deck[idx % deck.length]!);
    idx++;
  }
  return { hand, nextIdx: idx };
}

export function simulateCast(opts: CastOptions): CastResult {
  const rng = makeRng(opts.seed);
  const gridSize = opts.gridSize ?? 4;
  const handSize = opts.handSize ?? 3;
  const maxTurns = opts.maxTurns ?? 40;
  const fishMaxHp = opts.fishMaxHp ?? 20;
  let mana = opts.startMana ?? 10;
  let fishHp = Math.round(fishMaxHp * (opts.startFishHpRatio ?? 0.65));

  const catalog = loadDendrenDeck();
  let deck: FishingCardLike[];
  if (opts.deckIds) {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    deck = opts.deckIds.map((id) => {
      const c = byId.get(id);
      if (!c) throw new Error(`deckIds: card id ${id} not found in Dendren catalog — a wire assumption just broke`);
      return c;
    });
  } else {
    deck = [];
    for (let i = 0; i < catalog.length; i++) deck.push(rng.pick(catalog));
  }

  let { hand, nextIdx: drawIdx } = drawHand(deck, 0, handSize);

  const truePool = opts.candidatePool ?? buildPatternPool();
  const startCell: Cell = { x: rng.int(gridSize) + 1, y: rng.int(gridSize) + 1 };
  let trueTrajectory: Cell[];
  if (opts.empiricalFish) {
    trueTrajectory = sampleEmpiricalTrajectory(
      opts.empiricalFish.table,
      startCell,
      gridSize,
      maxTurns + 2,
      rng,
      opts.empiricalFish.options,
    ).cells;
  } else {
    const truePattern = truePool[rng.int(truePool.length)]!;
    trueTrajectory = truePattern.path(startCell, gridSize, maxTurns + 2);
  }

  const matcherPool = opts.matcherPool ?? (opts.empiricalFish ? [] : truePool);
  const candidates = matcherPool.map((p) => toCandidate(p, startCell, gridSize, maxTurns + 1));
  let matcher: MatcherState = initMatcher(candidates, startCell);

  let focus: FocusBudget = { current: defaultStartFocus(gridSize), remaining: FOCUS_METER_MAX };

  let turn = 0;
  while (turn < maxTurns) {
    if (mana <= 0) return { outcome: "escaped_mana", turns: turn, finalFishHp: fishHp };
    if (hand.length === 0) ({ hand, nextIdx: drawIdx } = drawHand(deck, drawIdx, handSize));

    const ringOpts: RingModelOptions = opts.ringModel?.options ?? DEFAULT_RING_MODEL_OPTIONS;
    const currentCell = matcher.history[matcher.history.length - 1]!;
    const stepClass = opts.ringModel ? classifyStep(matcher.history) : null;
    const ringDist = opts.ringModel
      ? stepClass === null
        ? ringDistributionUnknownClass(currentCell, previousDisplacement(matcher.history), opts.ringModel.table, gridSize, ringOpts)
        : ringDistribution(currentCell, stepClass, previousDisplacement(matcher.history), opts.ringModel.table, gridSize, ringOpts)
      : null;

    const matcherDist = matcher.candidates.length > 0 ? predictDistribution(matcher) : null;
    const rawDist =
      matcherDist
        ? opts.ringModel
          ? mixDistributions(
              stepClass !== null
                ? (intersectWithRing(matcherDist, currentCell, stepClass, gridSize) ?? ringDist!)
                : matcherDist,
              ringDist!,
              1 - ringOpts.ringFloor,
            )
          : matcherDist
        : ringDist
          ? ringDist
          : opts.blindFallback
          ? contextualFallback(
              matcher.history[matcher.history.length - 1]!,
              previousDisplacement(matcher.history),
              opts.blindFallback.contextMap,
              opts.blindFallback.cellOnlyMap,
              gridSize,
              { shrinkageK: opts.blindFallback.shrinkageK ?? DEFAULT_SHRINKAGE_K },
            )
          : emptyFallback(currentCell, new Map(), gridSize);
    // [session 46, brief §2] Heuristic (d) `pruneReturnToPrevious` used to
    // sit here, between the fallback and the policy. Retired as subsumed by
    // SPEC-fishing.md §9's conditional table — see `heuristics.ts`'s
    // tombstone for why it could never fire on `k=2` and was redundant on
    // `k=1`. The distribution now reaches the policy unmodified.
    const dist = rawDist;

    const action = opts.policy.act({ hand, mana, dist, gridSize, fishHp, focusBudget: focus }, rng);

    if (action.type === "pass") {
      return { outcome: "stalled", turns: turn, finalFishHp: fishHp };
    }
    if (action.type === "redraw") {
      mana -= hand.length;
      ({ hand, nextIdx: drawIdx } = drawHand(deck, drawIdx, handSize));
      continue;
    }

    const card = hand[action.handIndex]!;
    mana -= card.manaCost;
    hand = hand.filter((_, i) => i !== action.handIndex);

    // focusMeter never regenerates within a cast [CONFIRMED session 13] — a
    // policy that ignores its budget (or a bug) is clamped here rather than
    // trusted, since exceeding it is the one thing the live server rejects
    // outright (HTTP 400).
    const moveCost = manhattan(focus.current, action.focus);
    focus = { current: action.focus, remaining: Math.max(0, focus.remaining - moveCost) };

    const actualCell = trueTrajectory[matcher.turn]!;
    matcher = observe(matcher, actualCell);
    turn++;

    const zoneOffsets = zoneToOffsets(card.hitZones, card.critZones, action.focus, gridSize);
    const outcome = resolveOutcome(zoneOffsets, actualCell);

    if (outcome === "crit" || outcome === "hit") {
      const amount = outcome === "crit" ? (card.critEffects[0]?.amount ?? card.hitEffects[0]?.amount ?? 0) : (card.hitEffects[0]?.amount ?? 0);
      fishHp = Math.max(0, fishHp - amount);
    } else {
      const amount = card.missEffects[0]?.amount ?? 0;
      fishHp = Math.min(fishMaxHp, fishHp - amount);
    }

    if (fishHp <= 0) return { outcome: "caught", turns: turn, finalFishHp: fishHp };
    if (fishHp >= fishMaxHp) return { outcome: "escaped_meter", turns: turn, finalFishHp: fishHp };
  }
  return { outcome: "stalled", turns: turn, finalFishHp: fishHp };
}

function zoneToOffsets(
  hitZones: readonly number[],
  critZones: readonly number[],
  focus: Cell,
  gridSize: number,
): { hitKeys: Set<string>; critKeys: Set<string> } {
  const hitKeys = new Set(zonesToCells(focus, hitZones, gridSize).map(cellKey));
  const critKeys = new Set(zonesToCells(focus, critZones, gridSize).map(cellKey));
  return { hitKeys, critKeys };
}

function resolveOutcome(
  zones: { hitKeys: Set<string>; critKeys: Set<string> },
  actualCell: Cell,
): "hit" | "crit" | "miss" {
  const key = cellKey(actualCell);
  if (zones.critKeys.has(key)) return "crit";
  if (zones.hitKeys.has(key)) return "hit";
  return "miss";
}

export interface CastSummary {
  runs: number;
  caught: number;
  catchRate: number;
  meanTurns: number;
  /**
   * [session 45] Outcome mix and mean final fish HP, added additively (every
   * existing field above is unchanged). Needed because against the empirical
   * fish (`empiricalFish.ts`) a blind policy's catch rate is 0.0% — matching
   * live — and a metric that is zero in both arms cannot measure anything.
   * Mean final fish HP still separates "nearly had it" from "never close",
   * so an ablation has something to move even where no cast is ever won.
   */
  escapedMeter: number;
  escapedMana: number;
  stalled: number;
  meanFinalFishHp: number;
}

export function simulateCasts(runs: number, opts: Omit<CastOptions, "seed">, seed = 1): CastSummary {
  let caught = 0;
  let totalTurns = 0;
  let escapedMeter = 0;
  let escapedMana = 0;
  let stalled = 0;
  let totalFinalHp = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateCast({ ...opts, seed: seed + i });
    if (r.outcome === "caught") caught++;
    else if (r.outcome === "escaped_meter") escapedMeter++;
    else if (r.outcome === "escaped_mana") escapedMana++;
    else stalled++;
    totalTurns += r.turns;
    totalFinalHp += r.finalFishHp;
  }
  return {
    runs,
    caught,
    catchRate: caught / runs,
    meanTurns: totalTurns / runs,
    escapedMeter,
    escapedMana,
    stalled,
    meanFinalFishHp: totalFinalHp / runs,
  };
}
