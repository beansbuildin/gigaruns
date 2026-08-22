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

import { chooseCard, shouldRedraw, shouldRedrawOnConnect, type FishingCardLike, type FocusBudget } from "../../strategy/fishing/cardChoice.js";
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
  intersectWithRing,
  lastStepClass,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  type RingModelOptions,
  type StepClassTable,
} from "../../strategy/fishing/stepClass.js";
import type { Cell } from "./geometry.js";
import { cellKey, FOCUS_METER_MAX, manhattan, reachableCells, zonesToCells } from "./geometry.js";
import { loadDendrenDeck } from "./deck.js";
import { shuffleInPlace } from "./drawModel.js";
import { buildPatternPool, toCandidate, type Pattern } from "./patterns.js";
import { sampleEmpiricalTrajectory, type EmpiricalFishOptions } from "./empiricalFish.js";
import { makeRng, type Rng } from "../rng.js";
import {
  PAYLOAD_OIL_EFFECTS,
  type OilEffects,
  type OilKind,
  type OilTimingPolicy,
} from "../../strategy/fishing/oilTiming.js";

/**
 * How a cast ended.
 *
 * ## ⚠ `escaped_fish_full` WAS CALLED `escaped_meter` UNTIL SESSION 80
 *
 * Renamed because the old name pointed every reader at the wrong subsystem.
 * It never meant "the focus meter ran out" — it means **the fish healed back
 * to full HP**, `if (fishHp >= fishMaxHp)` below, and that is the dominant
 * live loss mode at 80 of 130 committed casts.
 *
 * The distinction is not pedantic, it is the difference between two different
 * diagnoses of the same number:
 *
 *  - **This simulator has no focus terminal condition at all**, and it is
 *    right not to. Live, `focusMeter` hits 0 and the cast CONTINUES — one
 *    corpus cast runs eight more plays after the meter empties — and **53% of
 *    CAUGHT casts end with the meter at 0.** Focus exhaustion is a STATE, not
 *    a loss.
 *  - Reading "the sim escapes on 0.6% of casts against a live 63.0%" under the
 *    old name suggests a focus-budget problem. The measured cause is a DAMAGE
 *    problem: `scripts/damageEconomy.ts` puts the live per-play `fishHp` drift
 *    at +0.192 and this arm's at −3.437, with the hit rate carrying 96% of it.
 *
 * The arithmetic never disagreed — `focusProfileCheck.ts` and
 * `lossDecomposition.ts` both defined the corpus side as *fish reached full
 * HP*, so every comparison drawn under the old name is still apples-to-apples
 * and its figures still stand. **The name was the hazard, not the numbers.**
 * `scripts/focusBudgetSweep.ts`'s `focusZeroCasts` was renamed in the same
 * pass, in the other direction, for the same reason.
 */
export type CastOutcome = "caught" | "escaped_fish_full" | "escaped_mana" | "stalled";

export interface CastResult {
  outcome: CastOutcome;
  turns: number;
  finalFishHp: number;
  /**
   * [session 46, brief §3] Shots that CONNECTED (hit or crit) and shots
   * taken, per cast.
   *
   * Per-turn hit rate is very nearly a pure function of card zones and focus
   * placement — independent of the HP arithmetic, the mana curve, and the
   * sequential-`drawHand` confound (session 79 fixed that confound for held
   * decks — the pile shuffles per cast — which removes one of the things this
   * instrument was insuring against rather than weakening it). That makes it
   * the right instrument for
   * telling a genuine geometry difference apart from a harness bug when two
   * deck arms disagree on catch rate, which is exactly what the session-45
   * deck measurement and its independent re-run did (a ~20pp inversion).
   */
  hits: number;
  shots: number;
  /** [session 61 §4d] Oils consumed this cast, in spend order. Empty when the sim ran without oils. */
  oilsUsed: OilKind[];
  /**
   * [session 72 §2] Mana burned on redraws this cast — one per card held, at
   * each redraw. Zero on every arm whose policy never redraws, which is all of
   * them today.
   *
   * Recorded so a redraw trigger can be priced in MANA PER EXTRA FISH rather
   * than in catch rate alone. A trigger that buys +2pp catch for a third of
   * the cast's mana budget is not obviously good, and catch rate on its own
   * cannot say so — which is how the 1.29-turns-per-cast calibration passed
   * whatever look it got at the time.
   */
  redrawMana: number;
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

/**
 * [session 72 §2] The same policy with the RE-DERIVED redraw trigger — see
 * `cardChoice.ts`'s `shouldRedrawOnConnect`. Identical in every other respect
 * to `makeMatcherFishPolicy`, so an A/B between them isolates the trigger and
 * nothing else.
 *
 * **This exists because the replay cannot score a redraw's consequence.** The
 * corpus has no draw pile — `fullDeck` is a canonical sorted list and 0 of 56
 * refills match a slice of it — so only a simulator can deal the replacement
 * cards. `scripts/redrawTriggerCalibration.ts` §5 is the one caller, and it
 * labels the result as the simulator's claim rather than the replay's.
 *
 * NOT WIRED LIVE and not the default. `liveFishing.ts` still calls
 * `shouldRedraw`, and `redrawEnabled` is still false.
 */
export function makeConnectRedrawFishPolicy(
  connectThreshold: number,
  heuristicsEnabled: boolean = true,
  focusReserveWeight: number = 0,
): FishPolicy {
  return {
    name: `matcher-connect(redraw=${connectThreshold},w=${focusReserveWeight})`,
    act(ctx) {
      const missPenaltyMultiplier = 1;
      const best = chooseCard(ctx.hand, ctx.mana, ctx.dist, ctx.gridSize, missPenaltyMultiplier, ctx.fishHp, ctx.focusBudget, heuristicsEnabled, focusReserveWeight);
      if (!best) {
        if (ctx.mana >= ctx.hand.length && ctx.hand.length > 0) return { type: "redraw" };
        return { type: "pass" };
      }
      if (shouldRedrawOnConnect(best, ctx.hand.length, ctx.mana, connectThreshold) && ctx.mana >= ctx.hand.length) {
        return { type: "redraw" };
      }
      return { type: "play", handIndex: best.handIndex, focus: best.focus };
    },
  };
}

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
   * **[session 79 §1] Order does NOT matter any more, and that is a fix, not
   * a loosening.** This comment used to end "Order matters — `drawHand` draws
   * sequentially off this array". It did, and that was the bug: the roster
   * order is not the pile order. The pile is now SHUFFLED once per cast from
   * this cast's own seed (`shuffleInPlace`, below), which is what the live
   * corpus shows at 129/129 opening hands — see `drawModel.ts`. Two decks
   * with the same multiset are now the same deck distributionally, and the
   * per-seed results still differ because the shuffle starts from the order
   * given.
   * Infrastructure only: nothing yet calls this with a real deck, and
   * `chooseNewCard`'s own scoring logic is unchanged — see TASKS.md Task
   * 13's own scoping note on why the scoring half stays unbuilt this
   * session.
   */
  deckIds?: readonly number[];
  /**
   * ── [session 79 §1] THE FALSIFIED DRAW MODEL, KEPT ONLY TO BE FAILED ─────
   *
   * Draw `deckIds` in roster order from index 0 — the model every figure this
   * simulator produced before session 79 was computed under.
   *
   * It is FALSE. The live corpus has 129 opening hands and not one of them is
   * `fullDeck[0..2]`; a sequential pile predicts all 129. This option exists
   * so `tests/fishing/deckShuffle.test.ts` can demonstrate the old model
   * failing the same validation the new one passes — session 75's discipline
   * for the redraw fix, where a correction that nobody can see fail is
   * indistinguishable from a preference.
   *
   * **Do not use it to produce a result.** Anything measured under it is a
   * measurement of a draw order the server does not use.
   */
  sequentialDrawPile?: boolean;
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
  /**
   * [session 70 §2a] PER-TURN STATE OBSERVER. Purely observational: it is
   * called with a copy of the state and its return value is discarded, so a
   * sim run with it set is byte-for-byte a sim run without it. Omitted, nothing
   * is called at all.
   *
   * It exists to answer one question the sim could not previously be asked —
   * **does the simulator's focus-meter profile match the corpus's?** —
   * because `CastResult` reports only end-of-cast aggregates, and a per-turn
   * profile cannot be reconstructed from them. The states it emits mirror
   * `castTrace.ts`'s: one per turn taken at the START of that turn (before the
   * policy acts), plus the terminal state, which is exactly what
   * `scripts/lossDecomposition.ts` averages over the real corpus. Anything
   * else and the two profiles would not be the same measurement.
   */
  observeTurn?: (state: {
    turn: number;
    focusRemaining: number;
    mana: number;
    fishHp: number;
    /**
     * [session 79 §1] The card ids held at the START of this turn, in the
     * order they were drawn. Additive — a callback that ignores it is
     * assignable exactly as before.
     *
     * Here because the DRAW MODEL is now a claim that has to be validated
     * against the live corpus, and a claim about which cards a cast opens on
     * cannot be checked through `CastResult`'s end-of-cast aggregates. Turn 0's
     * state carries the opening hand — `tests/fishing/deckShuffle.test.ts`
     * compares its roster-position distribution against 129 live opening
     * hands, and fails the pre-session-79 sequential pile on the same test.
     */
    hand: readonly number[];
  }) => void;
  /**
   * [session 61 §4d] Oils. **Opt-in and additive** — omitted, the sim is
   * byte-for-byte the sim it has always been, and every historical number
   * stays comparable.
   *
   * MODELLED, NOT OBSERVED. No cast in the corpus supplies an oil outcome (see
   * `src/strategy/fishing/oilTiming.ts`'s header), so this encodes the item
   * PAYLOADS — `FishingRestoreFocus` +2, `FishingDamageFish` +2 — and nothing
   * measured. `effects` is a parameter rather than a constant precisely so the
   * sensitivity of any conclusion to those amounts can be swept.
   *
   * `costsTurn` carries the mechanic the payload cannot answer, in both
   * directions. When true, a consume advances the fish one step and burns a
   * turn WITHOUT taking a shot; it still costs no mana, because nothing in the
   * `use_fishing_item` envelope or the item payload suggests it would.
   */
  oils?: {
    policy: OilTimingPolicy;
    effects?: OilEffects;
    /** How many of each the cast starts holding. */
    focusOilHeld?: number;
    relaxingOilHeld?: number;
    /** The unresolved mechanic — see `oilPolicy.ts`. No default: the caller must state which branch it is scoring. */
    costsTurn: boolean;
    /**
     * Does `FishingRestoreFocus` cap at `FOCUS_METER_MAX`? Unknown; nothing
     * says either way. Defaults to TRUE (capped), the conservative reading —
     * an uncapped restore would make the Focus Oil strictly better and is the
     * assumption that flatters it.
     */
    capFocusRestore?: boolean;
  };
}

/**
 * [session 79 §1] Salt for the draw pile's own rng stream, so shuffling cannot
 * shift the stream the fish is drawn from. Any fixed odd constant does; this
 * is the golden-ratio one mulberry32 itself uses, for no deeper reason than
 * that it is already in this file's neighbourhood.
 */
const PILE_SEED_SALT = 0x9e3779b9;

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
    // ── [session 79 §1] THE PILE IS SHUFFLED, ONCE, PER CAST ───────────────
    //
    // Measured, not invented: across every committed live fishing state, 129
    // opening hands and ZERO equal to `fullDeck[0..2]`, with roster tail
    // positions turning up as often as the head (`drawModel.ts` carries the
    // table). The server deals from a shuffled pile that it never puts on the
    // wire; `fullDeck` is a roster and `nextCardIndex` is a cursor into the
    // pile.
    //
    // Once per cast, so a seed still reproduces a cast exactly. Per-cast and
    // per-draw shuffles are indistinguishable in this corpus; per-cast is the
    // simpler hypothesis and the one that matches `nextCardIndex` advancing
    // 3, 6, 9 through a pile. `drawHand` is unchanged — only the order of what
    // it walks.
    //
    // **From a SEPARATE stream, and that is load-bearing.** Fisher-Yates
    // consumes `deck.length - 1` draws, so shuffling off the main `rng` would
    // make every later draw — the start cell, the whole fish trajectory — a
    // function of how many cards the deck holds. That silently destroys the
    // exact pairing `scripts/deckObjectiveSweep.ts` is built on: its arms
    // differ by one card, so a 23-card arm and a 24-card arm would face
    // DIFFERENT fish at the same seed, and every Δ it reports would carry a
    // trajectory difference inside it. With the pile on its own stream, the
    // main stream is untouched by deck size and each seed still pins one fish
    // for every arm.
    if (!opts.sequentialDrawPile) shuffleInPlace(deck, makeRng(opts.seed ^ PILE_SEED_SALT));
  } else {
    // ── AND THE SAMPLED PATH IS DELIBERATELY NOT SHUFFLED ─────────────────
    //
    // Not an oversight and not an exemption on grounds of churn. This path
    // builds `catalog.length` cards i.i.d. uniform WITH REPLACEMENT, so the
    // array is already exchangeable: reading it sequentially yields i.i.d.
    // uniform draws, which is exactly what shuffling it would yield. The
    // shuffle is a distributional no-op here, and applying it would move every
    // seeded figure in the repo while changing nothing about what is modelled.
    //
    // What this path is NOT is a model of a held deck — it has no fixed
    // composition to be dealt without replacement, which is the mechanic the
    // `deckIds` branch above now gets right. That difference is the same one
    // it has always had; session 79 did not introduce it.
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
  // [session 46, brief §3] Per-turn shot accounting — see `CastResult`.
  let hits = 0;
  let shots = 0;
  // [session 61 §4d] Oils. All inert when `opts.oils` is absent.
  const oilEffects: OilEffects = opts.oils?.effects ?? PAYLOAD_OIL_EFFECTS;
  const capFocus = opts.oils?.capFocusRestore ?? true;
  let focusOilHeld = opts.oils?.focusOilHeld ?? 0;
  let relaxingOilHeld = opts.oils?.relaxingOilHeld ?? 0;
  const oilsUsed: OilKind[] = [];
  let redrawMana = 0;
  // [session 70 §2a] See `observeTurn`. Reads the live locals at the moment it
  // is called and hands out a fresh object, so no caller can reach back in.
  //
  // ONE STATE PER TURN INDEX, which is not the same as one per loop iteration:
  // a redraw and a turn-free oil consume both `continue` WITHOUT advancing
  // `turn`, so a naive top-of-loop recorder emits `0 1 2 2 2 3` and every
  // profile built from it is silently shifted from that point on. A corpus
  // trace has exactly one doc state per turn, so this matches it by suppressing
  // the repeats rather than by hoping they do not happen. Found by the test,
  // not by reading — `tests/fishing/focusProfile.test.ts`.
  let lastRecordedTurn = -1;
  const record = opts.observeTurn
    ? () => {
        if (turn === lastRecordedTurn) return;
        lastRecordedTurn = turn;
        opts.observeTurn!({ turn, focusRemaining: focus.remaining, mana, fishHp, hand: hand.map((c) => c.id) });
      }
    : () => {};
  while (turn < maxTurns) {
    // Before the mana check, so a mana-out cast records its terminal state the
    // same way a corpus trace does.
    record();
    if (mana <= 0) return { outcome: "escaped_mana", turns: turn, finalFishHp: fishHp, hits, shots, oilsUsed, redrawMana };
    if (hand.length === 0) ({ hand, nextIdx: drawIdx } = drawHand(deck, drawIdx, handSize));

    const ringOpts: RingModelOptions = opts.ringModel?.options ?? DEFAULT_RING_MODEL_OPTIONS;
    const currentCell = matcher.history[matcher.history.length - 1]!;
    // [session 49, brief §2] `lastStepClass`, not `classifyStep`'s cast-wide
    // mode: under the sticky chain the LAST observed count is the sufficient
    // statistic, and the two only disagree on a cast that alternates — which
    // is exactly the case the hard ring got catastrophically wrong.
    const stepClass = opts.ringModel ? lastStepClass(matcher.history) : null;
    const ringDist = opts.ringModel
      ? stickyStepDistribution(
          currentCell,
          stepClass,
          previousDisplacement(matcher.history),
          opts.ringModel.table,
          gridSize,
          ringOpts,
        )
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

    // [session 61 §4d] OIL CONSUMPTION, before the card decision — the oils
    // change the state the card decision is made against (focus reachability,
    // and whether the fish is already dead), so consuming after would score a
    // decision taken under the wrong state.
    if (opts.oils) {
      const decision = opts.oils.policy.decide(
        {
          turn,
          fishHp,
          fishMaxHp,
          mana,
          focusRemaining: focus.remaining,
          focusMax: FOCUS_METER_MAX,
          focusOilHeld,
          relaxingOilHeld,
          focusCell: focus.current,
          // [session 67 §1] The board the NECESSITY GATE reads. Deliberately
          // the SAME `hand`, `dist` and `gridSize` that are handed to
          // `opts.policy.act` five lines below, so the gate's estimate of
          // "could a card do this without the oil" is taken against the play
          // the card policy would actually be choosing from — not against a
          // separately-modelled board that could drift from it.
          //
          // Note the direction of the dependency: the gate reads the card
          // policy's inputs, and the card policy never sees the gate's output
          // or any oil state at all. That asymmetry is what makes "mana first"
          // structural rather than aspirational — see `oilTiming.ts`.
          board: { hand, dist, gridSize },
        },
        oilEffects,
      );
      let consumedThisTurn = 0;
      for (const kind of decision) {
        if (kind === "focus" && focusOilHeld > 0) {
          focusOilHeld--;
          consumedThisTurn++;
          oilsUsed.push("focus");
          const restored = focus.remaining + oilEffects.focusRestore;
          focus = { current: focus.current, remaining: capFocus ? Math.min(FOCUS_METER_MAX, restored) : restored };
        } else if (kind === "relaxing" && relaxingOilHeld > 0) {
          relaxingOilHeld--;
          consumedThisTurn++;
          oilsUsed.push("relaxing");
          fishHp = Math.max(0, fishHp - oilEffects.fishDamage);
        }
      }
      // A lethal Relaxing Oil ends the cast HERE, before any card is played —
      // which is exactly why the lethal trigger is indifferent to `costsTurn`:
      // there is no next turn to lose.
      if (fishHp <= 0) return { outcome: "caught", turns: turn, finalFishHp: fishHp, hits, shots, oilsUsed, redrawMana };
      if (consumedThisTurn > 0 && opts.oils.costsTurn) {
        // The turn-cost branch: the fish moves and the turn burns, but no shot
        // is taken and NO MANA is spent — nothing in the payload or the
        // `use_fishing_item` envelope suggests a consume costs mana.
        matcher = observe(matcher, trueTrajectory[matcher.turn]!);
        turn++;
        continue;
      }
    }

    const action = opts.policy.act({ hand, mana, dist, gridSize, fishHp, focusBudget: focus }, rng);

    if (action.type === "pass") {
      return { outcome: "stalled", turns: turn, finalFishHp: fishHp, hits, shots, oilsUsed, redrawMana };
    }
    if (action.type === "redraw") {
      // [session 74 §5a] AUDITED AGAINST THE REAL MECHANIC, and two of three
      // charges are right. User confirmation, 2026-08-21, from their own play:
      // a redraw costs 1 mana per card HELD, always returns 3, **does not
      // damage or heal the fish**, and **the fish MOVES**.
      //
      //   mana  -= hand.length   ✓ correct
      //   fishHp  untouched      ✓ correct — no damage AND no heal
      //   drawHand(.., 3)        ✓ correct
      //   the fish's position    ✗ WRONG — see below
      //
      // `continue` skips `matcher = observe(...)` and the `turn++` beneath it,
      // so `trueTrajectory[matcher.turn]` yields the SAME cell on the next
      // iteration. A redraw here is time-free: the sim's fish stands still
      // while the real one steps.
      //
      // **[session 75 §3] FIXED — the fish now steps and the turn burns.** User
      // decision, 2026-08-22: this is outside the ship-nothing freeze, because
      // redraw is disabled live (`redrawEnabled` false) so the correction
      // cannot move live behaviour.
      //
      // The step is charged EXACTLY the way the turn-costing oil branch above
      // charges it — `observe` the true cell, then `turn++` — rather than by a
      // second mechanism, so there is one way a non-shooting turn advances
      // time in this file and not two.
      //
      // **[session 76 §3] The direction of the old error was predicted here, and
      // the prediction was BACKWARDS.** This comment used to say a free step
      // made the sim's redraw strictly CHEAPER than the real one, so session
      // 72's "263 mana per extra fish" and its `escaped_mana` 18.8% -> 39.8%
      // were UNDERSTATEMENTS. Measured under the fix, same harness, n=4000/arm:
      // **263.0 -> 43.9** mana per extra fish, catch 26.2% -> 32.5%, turns/cast
      // 4.38 -> 6.07. The cost went DOWN by a factor of six, and the
      // `escaped_mana` pair that was called an understatement re-reads
      // 18.5% -> 39.4% (session 75 §3's table), i.e. essentially unmoved.
      //
      // The reasoning priced the missing `turn++` and forgot the missing
      // `observe()` beside it. **A `continue` skips everything below it, not
      // the one thing you were thinking about.** The old branch was not merely
      // time-free, it was INFORMATION-free — a real redraw moves the fish and
      // the bot SEES where it went, so it buys an observation for the price of
      // the mana, and that term is the larger one. Hit rate per shot
      // 35.6% -> 45.4% between the arms under the fix.
      //
      // **Redraw stays CLOSED, but on PRICE, not on effect** — 43.9 mana
      // against a cast holding 10 in total is unaffordable at either figure,
      // and CLAUDE.md rule 4 bars a live change on a sim result regardless.
      // What is retracted is the old recorded REASON: the gain was written up
      // as "not distinguishable from zero", true at |t| = 1.4 and false at
      // |t| = 7.6. SPEC-fishing §7a carries the retraction and the full table.
      // `tests/fishing/redrawFishStep.test.ts` fails against the old
      // `continue`.
      //
      // NOTE what this is NOT. The session-74 brief read a DevTools capture
      // (`FISH_HP_DIFF: -3`, `result: 10`) as a redraw HEALING the fish 3 and
      // asked whether the sim was missing that. It is not, and there is no
      // heal — see SPEC-fishing §7a. Mana and damage were always right; the
      // fish step is the only thing that was wrong.
      mana -= hand.length;
      redrawMana += hand.length;
      ({ hand, nextIdx: drawIdx } = drawHand(deck, drawIdx, handSize));
      matcher = observe(matcher, trueTrajectory[matcher.turn]!);
      turn++;
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

    shots++;
    if (outcome === "crit" || outcome === "hit") {
      hits++;
      const amount = outcome === "crit" ? (card.critEffects[0]?.amount ?? card.hitEffects[0]?.amount ?? 0) : (card.hitEffects[0]?.amount ?? 0);
      fishHp = Math.max(0, fishHp - amount);
    } else {
      const amount = card.missEffects[0]?.amount ?? 0;
      fishHp = Math.min(fishMaxHp, fishHp - amount);
    }

    // The cast ends ON a play, so the post-play state is terminal and the loop
    // never comes back around to record it.
    if (fishHp <= 0) {
      record();
      return { outcome: "caught", turns: turn, finalFishHp: fishHp, hits, shots, oilsUsed, redrawMana };
    }
    if (fishHp >= fishMaxHp) {
      record();
      return { outcome: "escaped_fish_full", turns: turn, finalFishHp: fishHp, hits, shots, oilsUsed, redrawMana };
    }
  }
  return { outcome: "stalled", turns: turn, finalFishHp: fishHp, hits, shots, oilsUsed, redrawMana };
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
  escapedFishFull: number;
  escapedMana: number;
  stalled: number;
  meanFinalFishHp: number;
  /**
   * [session 46, brief §3] Pooled per-turn hit rate across the batch —
   * connected shots / shots taken. See `CastResult.hits` for why this is the
   * right instrument for a deck comparison: it isolates card geometry and
   * focus placement from the HP arithmetic, the mana curve, and the
   * sequential-`drawHand` confound.
   */
  hitRate: number;
  hits: number;
  shots: number;
}

export function simulateCasts(runs: number, opts: Omit<CastOptions, "seed">, seed = 1): CastSummary {
  let caught = 0;
  let totalTurns = 0;
  let escapedFishFull = 0;
  let escapedMana = 0;
  let stalled = 0;
  let totalFinalHp = 0;
  let hits = 0;
  let shots = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateCast({ ...opts, seed: seed + i });
    hits += r.hits;
    shots += r.shots;
    if (r.outcome === "caught") caught++;
    else if (r.outcome === "escaped_fish_full") escapedFishFull++;
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
    escapedFishFull,
    escapedMana,
    stalled,
    meanFinalFishHp: totalFinalHp / runs,
    hitRate: shots > 0 ? hits / shots : 0,
    hits,
    shots,
  };
}
