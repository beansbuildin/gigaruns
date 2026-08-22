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
 *  3. **The pattern-matcher tier is off by default, and can be run
 *     leave-one-cast-out instead.** Live it sits above the ring model, but its
 *     candidates are mined FROM this corpus. Session 47 dropped it outright;
 *     session 49 measured what that costs, and it is not a mild
 *     understatement. With the matcher off the distribution is flat, EV
 *     differences between focus placements shrink, `chooseCard`'s
 *     movement-cost tie-break dominates, and the replayed policy barely moves
 *     its focus — 0.64 points on the opening move against live's 1.80. Every
 *     focus-budget A/B run on that arm was therefore measuring a system that
 *     does not spend.
 *
 *     `matcherTier: "loo"` re-mines the promoted library from the OTHER casts
 *     only (`patternMining.ts`'s `promotePatterns`, at the same threshold
 *     `mineFishPatterns.ts` promotes at), so cast X's matcher never saw cast
 *     X — the identical discipline already applied to the ring table and the
 *     contextual maps. The default stays `"off"` so every number published
 *     before session 50 remains reproducible from this file.
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
  type Displacement,
} from "../../strategy/fishing/contextualFallback.js";
import {
  buildStepClassTable,
  classifyStep,
  intersectWithRing,
  lastStepClass,
  ringDistribution,
  ringDistributionUnknownClass,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  type RingModelOptions,
  type Distribution,
  type StepClass,
  type StepClassTable,
  DEFAULT_SWITCH_PROBABILITY,
} from "../../strategy/fishing/stepClass.js";
import {
  initMatcher,
  mixDistributions,
  observe,
  predictDistribution,
  type MatcherState,
} from "../../strategy/fishing/matcher.js";
import { promotedSupport, supportingCastCount } from "./patternMining.js";
import {
  initMatcherPosterior,
  matcherPriorFromSupport,
  matcherWeight,
  probabilityOf,
  updateMatcherPosterior,
  DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  type MatcherPosterior,
  type MatcherPosteriorOptions,
} from "../../strategy/fishing/matcherPosterior.js";
import { toCandidate, type Pattern } from "./patterns.js";
import type { Cast } from "./transitionCorpus.js";
import type { CastTrace, TraceCard } from "./castTrace.js";
import { cellKey, manhattan, reachableCells, zonesToCells, type Cell } from "./geometry.js";
import {
  NO_FOCUS_POLICY,
  expectedRemainingTurns,
  spendConstraint,
  type FocusBudgetPolicy,
} from "../../strategy/fishing/focusBudget.js";
import {
  chooseCoverageFocus,
  coverageHorizon as clampHorizon,
  covers,
  expectedCoverage,
  forwardCellDistributions,
} from "../../strategy/fishing/coverageFocus.js";

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
  /** [session 49, §3] Focus-meter points spent on this turn's move. */
  moveCost: number;
  /** [session 49, §3] Points left on the meter AFTER this turn's move. */
  focusRemaining: number;
  /**
   * [session 50, brief §2] Did the chosen focus's 3×3 window contain the cell
   * the fish actually moved to? Recorded on EVERY arm, not just the coverage
   * one — `hit = coverage × conversion`, and the decomposition is only
   * readable if both halves are measured on the same turns.
   */
  covered: boolean;
  /** [session 50] Same question for the RECORDED policy's focus on this turn. */
  actualCovered: boolean;
  /**
   * [session 72 §2] P(connect) of the play the policy is about to make —
   * `choice.pHit + choice.pCrit`, under the policy's own distribution.
   *
   * **This is the currency the redraw trigger should be denominated in, and
   * the reason is a postmortem, not a preference.** `shouldRedraw` tests
   * `best.ev < REDRAW_THRESHOLD`. EV stopped being what `chooseCard`
   * maximizes in session 13 — cards are picked for hit probability now — so a
   * card can be the right pick and still carry a legitimately low EV. The one
   * prior calibration of that threshold fired almost every turn and flipped
   * the loss mix from 89% `escaped_meter` to 78% `escaped_mana` at a mean of
   * 1.29 turns/cast (`cardChoice.ts` §5). A redraw is worth its cost when the
   * hand CANNOT CONNECT, and this is that quantity, measured on real
   * recorded turns rather than assumed.
   *
   * Recorded on every arm. It costs nothing — `chooseCard` already computes
   * `pHit`/`pCrit` for the choice it returns — and it is inert unless a
   * calibration reads it.
   */
  pConnect: number;
  /**
   * [session 72 §2] Cards in hand BEFORE this turn's play. A redraw costs one
   * mana per card held, so this is the trigger's price, and a hand of 3 is
   * also what marks a freshly-dealt hand. Recorded rather than inferred from
   * `turn % 3` — the mod-3 rule follows from the "one card per turn, refill at
   * empty" invariant and is true of every recorded play, but a derived
   * quantity that could silently stop being true is not what a calibration
   * should rest on.
   */
  handSize: number;
  /**
   * [session 72 §2] THE CEILING: the best `pConnect` any card in the cast's
   * whole deck could reach on this turn's distribution, at any legal focus.
   *
   * **This is the confound check that decides whether a redraw trigger is
   * worth anything at all**, and without it the calibration is circular. A low
   * `pConnect` has two possible causes and they call for opposite actions:
   *
   *   (a) the HAND is bad — its cards' hitboxes are the wrong shape for where
   *       the fish probably is. A fresh hand fixes this. Redraw.
   *   (b) the DISTRIBUTION is flat — the policy does not know where the fish
   *       is, so no card in any hand connects well. A fresh hand fixes
   *       nothing and the redraw is 3 mana burned for the same shot.
   *
   * `pConnect` alone cannot tell them apart, and a trigger that fires on (b)
   * is the 1.29-turns-per-cast failure again with a different number on it.
   * The ceiling separates them: `ceiling - pConnect` is the headroom a perfect
   * redraw could actually buy. Near zero, the turn is case (b).
   *
   * Computed by running the SAME `chooseCard` over the whole deck instead of
   * the hand — an upper bound a real 3-card redraw would rarely reach, which
   * is the conservative direction for a trigger that wants to fire.
   */
  pConnectCeiling: number;
  /**
   * [session 51 §3] The weight the matcher tier actually received on this
   * turn — the fixed `1 - ringFloor` under the shipped arm, the posterior
   * under `matcherPosterior`, and 0 when there was no matcher distribution
   * at all. Recorded so the mixture can be READ, not just scored: a posterior
   * that never leaves its prior and one that swings to 0.9 on a real
   * perimeter walker produce the same mean log loss for very different
   * reasons.
   */
  matcherWeight: number;
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
  /** [session 50, brief §2] Turns whose chosen focus window contained the fish. */
  covered: number;
  /** [session 50] Same for the recorded policy, over the same turns. */
  actualCovered: number;
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

/**
 * [session 73 §1b] One turn's PREDICTOR INTERNALS, handed to
 * `ReplayOptions.onTurn` for offline diagnosis. Nothing here feeds a decision
 * — the replay's behaviour is byte-for-byte identical whether the hook is
 * supplied or not.
 *
 * **Why a hook and not a return field.** The bias decomposition
 * (`scripts/pConnectBiasDecomposition.ts`) needs to re-score the SAME chosen
 * cell set under a DIFFERENT tier's distribution — hold the placement fixed,
 * swap one component, and watch the predicted mass move while the observed
 * outcome cannot. That is the only form of "toggle one thing" available here:
 * re-planning under a different distribution also changes WHICH cells get
 * chosen, which confounds the estimator's calibration with the policy's
 * choices. Carrying every tier's full distribution on `ReplayTurn` would put
 * megabytes of Maps on a struct that four scripts and six tests already
 * serialise; a callback hands them over at the one instant they exist.
 */
export interface ReplayTurnDiagnostic {
  turn: number;
  /** The cell the fish occupied when the prediction was made. */
  currentCell: Cell;
  /** The cell it actually moved to — the outcome every tier is scored against. */
  actual: Cell;
  gridSize: number;
  /** `lastStepClass` under the sticky default, `classifyStep` under `hardRing`. */
  stepClass: StepClass | null;
  /**
   * The two inputs the ring model was built from on this turn, handed over so
   * a diagnostic can rebuild `ringDistribution`/`stickyStepDistribution` under
   * DIFFERENT `RingModelOptions` against the identical leave-one-out table.
   * Without them a knob sweep would have to re-derive the table itself and
   * would silently be measuring a second thing.
   */
  prevDelta: Displacement | null;
  stepTable: StepClassTable;
  /** The mixed distribution `chooseCard` actually consulted. */
  dist: Distribution;
  /** The ring-model tier alone, before any matcher mass is mixed in. */
  ringDist: Distribution;
  /** The matcher tier AFTER `intersectWithRing`; `null` when the tier is off or empty. */
  matcherOnRing: Distribution | null;
  /** The matcher tier BEFORE the ring intersection — the renormalisation's input. */
  matcherRaw: Distribution | null;
  /** The mass the matcher tier received in the mixture; 0 when it had none. */
  matcherWeight: number;
  /** The contextual fallback, i.e. the predictor the ring model replaced. */
  baseline: Distribution;
  /**
   * The hit+crit cells of the chosen (card, focus) — EXACTLY the set
   * `pConnect` sums `dist` over. Re-summing another distribution over this
   * same set is the single-toggle measurement.
   */
  connectCells: readonly Cell[];
  pConnect: number;
  /** Whether `actual` landed in `connectCells`. Fixed across every toggle. */
  hit: boolean;
  handSize: number;
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
  /**
   * [session 49, brief §2] The sticky step-count latent's switch probability;
   * defaults to the shipped `DEFAULT_SWITCH_PROBABILITY`. Ignored under
   * `hardRing`.
   *
   * `0` is NOT the pre-session-49 model: it is the sticky arm's degenerate
   * case, which uses the LAST observed count rather than the cast-wide mode
   * and is measurably worse on its own (`scripts/stickyStepSweep.ts` — logLoss
   * 1.576 vs the mode's 1.407). The win is the marginalisation, not the switch
   * from mode to last. Use `hardRing` for the real before-arm.
   */
  stickySwitchProbability?: number;
  /**
   * Restore the pre-session-49 hard-zero ring (cast-wide mode, off-ring cells
   * at exactly zero). Exists only as the A/B's before-arm.
   */
  hardRing?: boolean;
  /**
   * [session 50, brief §1] The pattern-matcher tier — the top tier of the live
   * stack, and the one session 47 disabled here. See conservatism #3 in this
   * file's header.
   *
   *  - `"off"` (default): the pre-session-50 behavior, byte for byte.
   *  - `"loo"`: re-mine the promoted pattern library from the OTHER casts and
   *    run the tier exactly as `scripts/liveFishing.ts` does — ring
   *    intersection, then the `ringFloor` mix — so the arm's behaviour regime
   *    matches live rather than a flattened version of it.
   */
  matcherTier?: "off" | "loo";
  /**
   * [session 52 §4] Run the matcher tier against a FIXED library instead of
   * re-mining one per fold.
   *
   * This exists because the session-52 brief asked for a gate the replay could
   * not run as specified. `matcherTier: "loo"` re-mines from `otherCasts`
   * every fold and never reads `data/minedFishPatterns.json` — so every
   * session-50/51 replay figure describes whatever LOO mining promotes at
   * n-1, NOT the library `scripts/liveFishing.ts` actually loads. "Paired
   * against the current 2-pattern library" had no arm to be paired against.
   *
   * With `matcherLibrary` set, the patterns are held fixed (exactly as live
   * holds them fixed between re-mines) and only the PRIOR is re-derived per
   * fold, via `supportingCastCount` on the held-out casts. That is the honest
   * analogue of the live regime: live's library is stale-by-construction
   * relative to any given cast; its support rate is not.
   *
   * Ignored unless `matcherTier` is `"loo"`.
   */
  matcherLibrary?: readonly Pattern[];
  /**
   * [session 51 §2] Ring-model options for this arm. Defaults to what ships
   * (`DEFAULT_RING_MODEL_OPTIONS`, per-class shrinkage since session 51);
   * pass `SHARED_SHRINKAGE_BASELINE` for the pre-session-51 before-arm so the
   * per-class change is A/B-able on fixed trajectories rather than only on
   * held-out log loss.
   */
  ringModelOptions?: RingModelOptions;
  /**
   * [session 51 §3] How much of the mass the matcher tier gets when it has a
   * live candidate set. Only meaningful with `matcherTier: "loo"` — with the
   * tier off there is no matcher distribution to weight.
   *
   *  - `"posterior"` (DEFAULT, and what ships live since session 51): the
   *    posterior that this fish is drawn from the mined library, updated by
   *    the likelihood ratio the two tiers assign to what actually happened.
   *  - `"fixed"`: the pre-session-51 constant `1 - ringFloor` = 0.9. This is
   *    the BEFORE-ARM, kept so the change stays A/B-able and so every
   *    session-50 `matcherTier: "loo"` figure is reproducible from the file.
   *
   * The default is the posterior rather than the old constant DELIBERATELY,
   * against this file's usual "defaults preserve old numbers" convention. The
   * convention exists so a stale default cannot silently invalidate published
   * figures; here the competing risk is worse and this repo has been bitten by
   * it repeatedly — a future session runs `matcherTier: "loo"`, believes it is
   * measuring live behaviour, and is actually measuring a weighting live no
   * longer uses. Reproducibility is preserved by naming the old arm, not by
   * making it the default.
   */
  matcherWeighting?: "posterior" | "fixed";
  /**
   * [session 50, brief §2] Place the focus by maximising EXPECTED COVERAGE
   * over the next `coverageHorizon` turns instead of this turn's EV
   * (`src/strategy/fishing/coverageFocus.ts`). Card choice stays
   * EV-maximising given the chosen focus.
   *
   * `undefined` (default) leaves placement exactly as it ships. A LETHAL
   * placement is never overridden — the same invariant `focusBudget.ts`'s
   * constraints hold, and for the same reason: no objective gets to talk the
   * bot out of landing the catch.
   */
  coverageHorizon?: number;
  /**
   * [session 50, brief §2] The BLENDED form: instead of letting coverage
   * override EV outright, price the coverage of the turns AFTER this one as a
   * continuation term and maximise `ev + coverageWeight * futureCoverage`
   * over the reachable placements.
   *
   * This exists because the hard override loses: it raises coverage a long
   * way (75.9% -> 89.6%, p < 0.001) and conversion falls further
   * (62.3% -> 48.5%), because a window chosen with no regard for the card's
   * zone shape contains the fish more often and fits it worse. The blend is
   * the obvious repair — keep this turn's EV, which already prices
   * conversion, and add only what the pure objective was contributing that
   * EV cannot see: where the fish will be NEXT.
   *
   * Only the `h >= 2` terms enter, deliberately. `h = 1` is this turn, and
   * `ev` already integrates the same distribution over it; including it would
   * double-count. Requires `coverageHorizon >= 2` to have anything to say.
   *
   * Units: `ev` is in fishHp-damage, so the weight is too — the same
   * convention `DEFAULT_FOCUS_RESERVE_WEIGHT` is expressed in, and it can be
   * sanity-checked the same way against real card `hitEffect` magnitudes
   * (3-11).
   */
  coverageWeight?: number;
  /**
   * [session 49, brief §3] The focus-meter spend policy
   * (`src/strategy/fishing/focusBudget.ts`). Defaults to `NO_FOCUS_POLICY`,
   * which is byte-for-byte today's behavior.
   */
  focusPolicy?: FocusBudgetPolicy;
  /**
   * [session 73 §1b] Diagnostic tap — called once per replayed turn with the
   * predictor internals (`ReplayTurnDiagnostic`), after the choice is made and
   * the actual cell is known. Purely observational: the replay never reads
   * anything back, so supplying it cannot change a single replayed decision.
   */
  onTurn?: (d: ReplayTurnDiagnostic) => void;
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

  // [session 50, brief §1] The leave-one-cast-out matcher tier. The library is
  // re-mined from `others` — which `replayCorpus` guarantees excludes this
  // cast — so the candidates anchored here have never seen the trajectory they
  // are about to be scored on.
  let matcher: MatcherState | null = null;
  // [session 51 §3] The prior is the mined library's OWN support rate on the
  // held-out training set — the fraction of those casts some promoted
  // primitive explains exactly — so it is re-derived per fold like everything
  // else here rather than carried in as a constant.
  let posterior: MatcherPosterior | null = null;
  const posteriorOpts: MatcherPosteriorOptions = {
    prior: 0.5,
    ...DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  };
  if ((opts.matcherTier ?? "off") === "loo") {
    const { patterns, supportingCasts, totalCasts } = opts.matcherLibrary
      ? { patterns: opts.matcherLibrary, ...supportingCastCount(otherCasts, opts.matcherLibrary) }
      : promotedSupport(otherCasts);
    matcher = initMatcher(
      patterns.map((pat) => toCandidate(pat, t0.fishPosition, gridSize, target.turns.length + 1)),
      t0.fishPosition,
    );
    posteriorOpts.prior = matcherPriorFromSupport(supportingCasts, totalCasts);
    posterior = initMatcherPosterior(posteriorOpts.prior);
  }

  const turns: ReplayTurn[] = [];
  let outcome: ReplayOutcome = "truncated";

  for (let i = 1; i < target.turns.length; i++) {
    const rec = target.turns[i]!;
    if (!rec.play) break;

    const currentCell = history[history.length - 1]!;
    const prevDelta = previousDisplacement(history);
    // [session 49, brief §2] Sticky by default, matching what now ships in
    // `liveFishing.ts` and `castSim.ts`. `hardRing: true` restores the old
    // hard-zero arm so the A/B stays runnable from `stickyStepSweep.ts`.
    // Each arm keeps its OWN notion of the step class — `classifyStep`'s
    // cast-wide mode under `hardRing`, `lastStepClass` under the sticky
    // default — so the ring intersection below never mixes the two.
    const ringOpts = opts.ringModelOptions ?? DEFAULT_RING_MODEL_OPTIONS;
    const stepClass = opts.hardRing ? classifyStep(history) : lastStepClass(history);
    const ringDist = opts.hardRing
      ? stepClass === null
        ? ringDistributionUnknownClass(currentCell, prevDelta, table, gridSize)
        : ringDistribution(currentCell, stepClass, prevDelta, table, gridSize)
      : stickyStepDistribution(
          currentCell,
          stepClass,
          prevDelta,
          table,
          gridSize,
          ringOpts,
          opts.stickySwitchProbability ?? DEFAULT_SWITCH_PROBABILITY,
        );
    // [session 50] Tier 0, mirroring `scripts/liveFishing.ts` exactly: the
    // matcher's distribution is intersected with the legal step-class ring
    // (an off-ring candidate is provably wrong), a candidate set that survives
    // nothing hands the turn back to the ring model, and whatever comes out is
    // mixed with the ring at `ringFloor` so a converged candidate can never
    // assign probability zero to the cell the fish actually reached.
    const matcherDist = matcher && matcher.candidates.length > 0 ? predictDistribution(matcher) : null;
    const matcherOnRing = matcherDist
      ? stepClass !== null
        ? (intersectWithRing(matcherDist, currentCell, stepClass, gridSize) ?? ringDist)
        : matcherDist
      : null;
    // [session 51 §3] The mixture weight. `1 - ringFloor` is the shipped
    // FIXED weight; under `matcherPosterior` it is the posterior that this
    // fish is drawn from the mined library, so the tier earns its mass from
    // its own record within the cast instead of being handed 0.9 on turn 1.
    const matcherWeightHere =
      (opts.matcherWeighting ?? "posterior") === "posterior" && posterior
        ? matcherWeight(posterior, posteriorOpts)
        : 1 - ringOpts.ringFloor;
    const dist = matcherOnRing ? mixDistributions(matcherOnRing, ringDist, matcherWeightHere) : ringDist;
    const baseline = contextualFallback(currentCell, prevDelta, contextMap, cellOnlyMap, gridSize, {
      shrinkageK: DEFAULT_SHRINKAGE_K,
    });

      const cards = hand.map((id) => toCardLike(target.cards.get(id)!));
    // [session 49, brief §3] The turn's focus spend constraint. `bestHitEffect`
    // is read off the hand actually held, matching `isManaConstrained`'s
    // estimator rather than inventing a second one.
    const bestHitEffect = cards.length
      ? Math.max(...cards.map((c) => Math.max(c.hitEffects[0]?.amount ?? 0, c.critEffects[0]?.amount ?? 0)))
      : 0;
    const constraint = spendConstraint(opts.focusPolicy ?? NO_FOCUS_POLICY, {
      turn: i - 1,
      spent: t0.focusMeter - focus.remaining,
      meterMax: t0.focusMeter,
      remaining: focus.remaining,
      fishHp,
      bestHitEffect,
    });
    const chooseAt = (focusCandidates?: readonly Cell[]) =>
      chooseCard(
        cards,
        mana,
        dist,
        gridSize,
        missPenaltyMultiplier,
        fishHp,
        focus,
        true,
        focusReserveWeight,
        constraint,
        focusCandidates,
      );
    let choice = chooseAt();
    if (!choice) {
      outcome = "no_affordable_card";
      break;
    }
    // [session 72 §2] The ceiling — see `ReplayTurn.pConnectCeiling`. Same
    // call, whole deck instead of the hand, so hand quality is the only thing
    // that differs between it and `choice`.
    const deckCards = [...target.cards.values()].map(toCardLike);
    const deckBest = chooseCard(
      deckCards,
      mana,
      dist,
      gridSize,
      missPenaltyMultiplier,
      fishHp,
      focus,
      true,
      focusReserveWeight,
      constraint,
    );
    const pConnectCeiling = deckBest ? deckBest.pHit + deckBest.pCrit : 0;
    // [session 50, brief §2] The expected-coverage placement, applied AFTER
    // the unconstrained EV pick so a lethal placement is never overridden.
    // Re-running `chooseCard` restricted to the coverage cell is what keeps
    // card choice EV-maximising GIVEN the focus, rather than blending two
    // objectives into one score.
    const coverageWeight = opts.coverageWeight ?? 0;
    // `coverageWeight` SELECTS the blended form. A blend asked for at horizon
    // 1 has no continuation term to add, so it is a no-op — it must not
    // silently fall through to the hard override, which is a different policy.
    if (coverageWeight > 0 && (opts.coverageHorizon ?? 0) >= 2 && !choice.lethal) {
      const h = clampHorizon(opts.coverageHorizon!, expectedRemainingTurns(fishHp, bestHitEffect));
      // `h >= 2` only — `ev` already integrates this turn's distribution.
      const future = forwardCellDistributions(
        currentCell,
        stepClass,
        prevDelta,
        table,
        gridSize,
        h,
        ringOpts,
        opts.stickySwitchProbability ?? DEFAULT_SWITCH_PROBABILITY,
      ).slice(1);
      if (future.length > 0) {
        let bestChoice = choice;
        let bestValue = choice.ev + coverageWeight * expectedCoverage(choice.focus, future);
        for (const f of reachableCells(gridSize, focus.current, focus.remaining)) {
          if (manhattan(focus.current, f) > constraint.maxMoveCost) continue;
          const c = chooseAt([f]);
          if (!c) continue;
          const value = c.ev + coverageWeight * expectedCoverage(f, future);
          if (c.lethal && !bestChoice.lethal) {
            bestChoice = c;
            bestValue = value;
            continue;
          }
          if (!c.lethal && bestChoice.lethal) continue;
          if (value > bestValue + 1e-9) {
            bestChoice = c;
            bestValue = value;
          }
        }
        choice = bestChoice;
      }
    } else if (coverageWeight <= 0 && opts.coverageHorizon && opts.coverageHorizon > 0 && !choice.lethal) {
      const h = clampHorizon(opts.coverageHorizon, expectedRemainingTurns(fishHp, bestHitEffect));
      const forward = forwardCellDistributions(
        currentCell,
        stepClass,
        prevDelta,
        table,
        gridSize,
        h,
        ringOpts,
        opts.stickySwitchProbability ?? DEFAULT_SWITCH_PROBABILITY,
      );
      const cov = chooseCoverageFocus(focus, gridSize, forward);
      // Respect the spend constraint the same way the EV path does: a
      // placement the constraint forbids is simply not offered.
      if (cov.moveCost <= constraint.maxMoveCost) {
        const covChoice = chooseAt([cov.focus]);
        if (covChoice) choice = covChoice;
      }
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
      moveCost,
      focusRemaining: focus.remaining,
      covered: covers(choice.focus, actual),
      actualCovered: covers(rec.focusPoint, actual),
      matcherWeight: matcherOnRing ? matcherWeightHere : 0,
      pConnect: choice.pHit + choice.pCrit,
      handSize: hand.length,
      pConnectCeiling,
    });

    // [session 73 §1b] The diagnostic tap. Nothing below is read back, so the
    // hook cannot move a decision — it fires after the turn is fully resolved.
    // `connectCells` is the TRUE zone geometry, so `actual ∈ connectCells`
    // equals `hit` exactly when `mismatchedZones` is off; under that arm the
    // replay resolves against a reflection and the two deliberately diverge.
    if (opts.onTurn) {
      const connectCells = [
        ...zonesToCells(choice.focus, choice.card.critZones, gridSize),
        ...zonesToCells(choice.focus, choice.card.hitZones, gridSize),
      ];
      const seen = new Set<string>();
      opts.onTurn({
        turn: i,
        currentCell,
        actual,
        gridSize,
        stepClass,
        prevDelta,
        stepTable: table,
        dist,
        ringDist,
        matcherOnRing,
        matcherRaw: matcherDist,
        matcherWeight: matcherOnRing ? matcherWeightHere : 0,
        baseline,
        connectCells: connectCells.filter((c) => {
          const k = cellKey(c);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }),
        pConnect: choice.pHit + choice.pCrit,
        hit,
        handSize: hand.length,
      });
    }

    history.push(actual);
    // Update the posterior BEFORE narrowing the candidate set: the likelihood
    // ratio is what the two tiers said about this move while it was still
    // unknown, and `observe()` is the thing that consumes the answer.
    if (posterior && matcherOnRing) {
      posterior = updateMatcherPosterior(posterior, probabilityOf(matcherOnRing, actual), probabilityOf(ringDist, actual), posteriorOpts);
    }
    if (matcher) matcher = observe(matcher, actual);
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
    covered: 0,
    actualCovered: 0,
    results,
  };
  for (const r of results) {
    for (const t of r.turns) {
      report.shots++;
      if (t.hit) report.hits++;
      report.actualShotsOnReplayedTurns++;
      if (t.actualHit) report.actualHits++;
      if (t.covered) report.covered++;
      if (t.actualCovered) report.actualCovered++;
      report.logLossDiffs.push(t.baselineLogLoss - t.logLoss);
    }
  }
  return report;
}
