/**
 * src/strategy/fishing/cardChoice.ts — (card, focus) EV per SPEC.md §5
 * "Card choice" (re-derived session 12 for the confirmed movable-focus
 * mechanic — see the spec for the full derivation and why this collapses
 * "hedge when |H| is large" and "cash in when |H| == 1" into one formula
 * rather than two branches: summing P(next=c) over every cell a hitbox
 * covers already rewards a focus placement that spans multiple live
 * hypotheses, and collapses naturally to "aim at the one known cell" once
 * only one hypothesis survives).
 *
 * Pure functions — no network, per CLAUDE.md's strategy/API separation.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { allCells, cellKey,
  FOCUS_METER_MAX, manhattan, reachableCells, zonesToCells } from "../../sim/fishing/geometry.js";
import { coverageCount, isCentralSquare } from "./heuristics.js";
import { UNCONSTRAINED, type FocusSpendConstraint } from "./focusBudget.js";

/**
 * [session 31, CODEXIMPROVE #2] Two EV values within this of each other are
 * treated as tied for tie-break purposes (focus movement cost, then mana
 * cost) rather than compared for strict inequality — floating-point EV sums
 * over a probability distribution can differ by a rounding-noise amount that
 * isn't a real preference. Never widens which candidate has the higher raw
 * EV; only decides when two are close enough to fall through to a tie-break
 * that conserves the scarce, non-regenerating focus-movement budget instead.
 */
const EV_TIE_EPSILON = 1e-9;

export interface FishingCardLike {
  id: number;
  manaCost: number;
  hitZones: readonly number[];
  critZones: readonly number[];
  hitEffects: readonly { amount: number }[];
  missEffects: readonly { amount: number }[];
  critEffects: readonly { amount: number }[];
}

export type Distribution = ReadonlyMap<string, { cell: Cell; p: number }>;

/**
 * **[CONFIRMED 2026-08-15, session 13, live]** Moving the focus point costs
 * its Manhattan distance from the CURRENT focus out of a per-cast budget
 * that does not regenerate within a cast — `geometry.ts`'s `reachableCells`
 * doc comment has the four data points. Optional here (and last in every
 * signature) so a caller with no budget to track (a test, an old call site)
 * is unaffected: omit it and the full grid is searched. `castSim.ts` DOES
 * supply this now (session 14) — see its own `FOCUS_METER_MAX` for the
 * sim-side tracking.
 */
export interface FocusBudget {
  current: Cell;
  remaining: number;
}

export interface CardFocusChoice {
  card: FishingCardLike;
  /** Index into the hand this card was chosen from — hands can hold duplicate ids. */
  handIndex: number;
  focus: Cell;
  ev: number;
  evPerMana: number;
  /**
   * [session 45, brief §3] `ev` plus the focus-reserve continuation term —
   * the value actually maximized by `bestFocusForCard`/`isPreferred`. With
   * `focusReserveWeight` at 0 (the default, and every pre-session-45 caller)
   * this is exactly `ev`. Raw `ev` is deliberately kept alongside it and is
   * what `isLethal`, `isManaConstrained` and all reporting still use — the
   * reserve term prices a FUTURE option, and letting it leak into a lethality
   * or mana-sufficiency test would be a category error.
   */
  score: number;
  pHit: number;
  pCrit: number;
  /** True only when every non-zero-probability outcome is a guaranteed catch this turn. */
  lethal: boolean;
}

/**
 * [session 45, brief §3] The focus-reserve continuation term.
 *
 * THE PROBLEM (SPEC-fishing.md §4c, found live session 44 by the user):
 * `bestFocusForCard`'s objective is purely single-turn-greedy. The 3-point
 * focus budget does not regenerate within a cast, but nothing in the scoring
 * charges for spending it — movement cost is consulted only inside the
 * `EV_TIE_EPSILON = 1e-9` tie-break, which real EV differences essentially
 * never hit. Result, confirmed 16/16 live and in 43% of N=300 sim casts by a
 * median of turn 2: the whole budget is gone within 2-4 turns and the rest of
 * the cast is played from a frozen focus point while the fish drifts away.
 *
 * THE SHAPE: reward the budget a placement LEAVES, normalized to [0,1] by
 * `FOCUS_METER_MAX` so the weight is expressed in fishHp-damage units and can
 * be sanity-checked against real card `hitEffect` magnitudes (3-11). This
 * mirrors the dungeon side's `chargeReserveWeight` precedent (DECISIONS.md
 * 2026-08-18, session 34) rather than inventing a new mechanism.
 *
 * A 2-ply focus lookahead was tested by the session-45 brief against this
 * flat term at matched N and lost (32.4% vs 33.6%) at a large constant factor
 * in the inner loop — so this stays flat on purpose, not for lack of trying
 * the richer form.
 */
/**
 * [session 45] Picked from `scripts/focusReserveAblation.ts`'s sweep against
 * the EMPIRICAL fish (`src/sim/fishing/empiricalFish.ts`) at the real deck
 * and real parameters, N=12000, two far-apart seeds. The arm that matters is
 * the configuration that actually ships live — ring model plus the mined
 * matcher, ring-intersected:
 *
 *   w:        0      0.5      1      2      3      4      6      8     12
 *   seed 1  38.6%  38.4%  38.6%  39.5%  40.0%  39.6%  39.9%  38.4%  35.3%
 *   seed 2  37.4%  37.5%  37.9%  38.7%  39.2%  38.8%  39.3%  37.9%  35.4%
 *
 * The same inverted-U with a plateau the dungeon side's `chargeReserveWeight`
 * found (DECISIONS.md 2026-08-18, session 34): a broad optimum across 2-6,
 * peaking at 3 on BOTH seeds, collapsing past 8. 3 also sits inside the real
 * deck's `hitEffect` magnitudes (3-6), which is the sanity check the fix's
 * original proposal asked for — a weight worth more than a whole hit would be
 * buying a future option at an obviously wrong price.
 *
 * **The lift is +1.6pp (38.6->40.0, 37.4->39.2), not the ~+5pp the session-45
 * brief projected.** Reported as measured. The ring-model rows this is swept
 * on are themselves optimistic by construction (the policy shares its
 * movement model with the fish generator), so the honest reading is an
 * ordering of levers: the movement model is the large one and this is a small
 * real refinement on top of it, not a second large one.
 *
 * NOT the default of `bestFocusForCard`/`chooseCard` — those default to `0`
 * so every pre-session-45 caller, test and sim script stays byte-for-byte
 * unchanged. `scripts/liveFishing.ts` is what passes this.
 */
export const DEFAULT_FOCUS_RESERVE_WEIGHT = 3;

/**
 * ⚠ [session 95 §G] **WHAT THIS TERM DOES IN THE RANKING IS NOT WHAT THE
 * COMMENTS ABOVE SAY.** They describe the formula correctly and its behaviour
 * incorrectly, and the difference is worth stating where the function is.
 *
 * `bestFocusForCard` searches `reachableCells(gridSize, current, remaining)`,
 * so every candidate already satisfies `d <= remaining` and the `Math.max(0, …)`
 * below NEVER CLAMPS — 0 of 1912 candidates over grids 4/5/6, every current
 * cell and every remaining 0–3. With the clamp unreachable the term is linear,
 * and within one decision `remaining` is fixed, so
 *
 *     w * (remaining - d) / MAX  =  (w * remaining / MAX)  -  (w / MAX) * d
 *
 * whose first half is a per-decision CONSTANT and cancels in an argmax.
 *
 * So this does not "reward the budget a placement LEAVES" in any way that
 * affects which placement wins. It is **exactly a linear movement tax of
 * `w / FOCUS_METER_MAX` EV-units per manhattan step** — 1.00 per step at the
 * shipped weight of 3. Its RATE is constant; its REACH is bounded by
 * `remaining`, so it is structurally a first-turns-only effect and is inert
 * once the meter empties.
 *
 * That reconciles session 48's "w=0 and w=3 indistinguishable over 73 whole
 * traces" with session 85's "w=3 lands 0.004 outside the opening-spend
 * interval, w=0 0.207": they measure different turns of a term that only lives
 * on the early ones. See QUESTIONS.md §27 UPDATE and the pins in
 * `tests/fishing/cardChoice.test.ts`.
 *
 * The formula is NOT changed on the strength of this — the reading is, and
 * `DEFAULT_FOCUS_RESERVE_WEIGHT` keeps its swept value.
 */
export function focusReserveFraction(focusBudget: FocusBudget | undefined, focus: Cell): number {
  if (!focusBudget) return 0;
  const left = focusBudget.remaining - manhattan(focusBudget.current, focus);
  return Math.max(0, left) / FOCUS_METER_MAX;
}

const amountOf = (effects: readonly { amount: number }[]): number => effects[0]?.amount ?? 0;

/**
 * EV(card, f) for one specific focus placement, per SPEC.md §5.
 *
 * `missPenaltyMultiplier` is the ONE tunable knob (SPEC.md §5: "tune ... in
 * the sim, not live") — the miss penalty ITSELF is each card's own real,
 * confirmed `missEffects[0].amount` (`fixtures/fishing-casts/cards.json`
 * shows this varies per card, -3 to -10; a global constant would throw that
 * signal away). The multiplier scales risk-aversion around that real value,
 * default 1.
 */
export function evaluateCardAtFocus(
  card: FishingCardLike,
  focus: Cell,
  dist: Distribution,
  gridSize: number,
  missPenaltyMultiplier: number,
): { ev: number; pHit: number; pCrit: number } {
  const critCells = new Set(zonesToCells(focus, card.critZones, gridSize).map(cellKey));
  const hitCells = zonesToCells(focus, card.hitZones, gridSize).filter((c) => !critCells.has(cellKey(c)));

  let pCrit = 0;
  for (const key of critCells) pCrit += dist.get(key)?.p ?? 0;
  let pHit = 0;
  for (const c of hitCells) pHit += dist.get(cellKey(c))?.p ?? 0;

  const hitEffect = amountOf(card.hitEffects);
  const critEffect = card.critZones.length > 0 ? amountOf(card.critEffects) : hitEffect;
  const missEffect = Math.abs(amountOf(card.missEffects));

  const pAnyHit = pHit + pCrit;
  const ev = pCrit * critEffect + pHit * hitEffect - missPenaltyMultiplier * missEffect * (1 - pAnyHit);
  return { ev, pHit, pCrit };
}

/**
 * `fishHp` driven to <= 0 is the catch (SPEC.md §5, corrected session 12).
 * Lethal means every outcome with nonzero probability is a hit or crit, and
 * even the SMALLER of the two effect amounts (hit, since crit is a bonus)
 * finishes the fish from its current `fishHp`.
 */
function isLethal(card: FishingCardLike, pHit: number, pCrit: number, fishHp: number): boolean {
  const pAnyHit = pHit + pCrit;
  if (pAnyHit < 0.999999) return false; // some non-hit outcome remains possible
  const hitEffect = amountOf(card.hitEffects);
  const critEffect = card.critZones.length > 0 ? amountOf(card.critEffects) : hitEffect;
  const worstCase = Math.min(hitEffect, critEffect || hitEffect);
  return fishHp - worstCase <= 0;
}

// ───────────────────────────────────────────────────────────────────────────
// [session 74 §2] THE LETHALITY PREDICATE, MADE INJECTABLE
//
// ## Why this seam exists
//
// `lethal` is not a label — it is an OVERRIDE, and session 73 identified it as
// the most consequential live consumer of `pConnect`'s LEVEL (as opposed to
// its ranking, which a uniform optimism cannot disturb). Everything else that
// reads a connect probability live either ranks with it or reports it. This
// grants exemptions:
//
//   1. `bestFocusForCard` — a lethal placement is exempt from
//      `spendConstraint.maxMoveCost` ("A LETHAL placement is never blocked").
//   2. `bestFocusForCard` — a lethal candidate beats a non-lethal one whatever
//      the scores say, and
//   3. skips the `moveEvThreshold` stay-put comparison entirely.
//   4. `chooseCard` — if ANY option is lethal, the pick is made among lethal
//      options only (SPEC.md §5's "lethal check first").
//   5. `offPolicyReplay` — the coverage re-ranking is skipped for a lethal
//      choice, deliberately, so coverage never overrides a catch.
//
// And it reads the worst-calibrated end of the range: the [0.50, 1.01) bucket
// predicts 72.2% and observes 60.3% (session 73).
//
// **CORRECTION, session 74.** Session 73 recorded — in `STATE.md`, in the
// session-74 brief, and in `tests/fishing/pConnectConsumers.test.ts`'s own
// rationale — that a lethal claim "short-circuits the oil gates". IT DOES NOT.
// `isLethal` has exactly ONE call site (below), the shipped oil trigger
// `onDemandTriggers` is `fishHp <= fishDamage` with no estimator input at all,
// and the derived necessity gates read `bestKillProbability` /
// `bestConnectProbabilityFromFrozenCell`, which are their own functions. The
// two senses of "lethal" — card-play lethality and oil lethality — were
// conflated. The five paths above are the complete list.
//
// ## Why the seam and not an edit
//
// The tightening is NOT adopted (session-74 brief §3: ship nothing while the
// `pConnect` diagnosis is open). `DEFAULT_LETHALITY` is the shipped predicate
// byte for byte and is the default of every parameter below, so no existing
// caller changes. `tests/fishing/lethalOverride.test.ts` fails if that stops
// being true.

/**
 * Everything a lethality rule may look at. Wider than the shipped predicate
 * needs, because the tightening below needs `currentCell` and a positional
 * parameter list that already runs to twelve arguments is not the place to
 * add a thirteenth.
 */
export interface LethalityContext {
  card: FishingCardLike;
  focus: Cell;
  dist: Distribution;
  gridSize: number;
  pHit: number;
  pCrit: number;
  fishHp: number;
  /**
   * The cell the fish occupied when `dist` was built. OPTIONAL, and the
   * optionality is load-bearing: most callers of `bestFocusForCard` do not
   * have it in scope, and a rule that needs it must FAIL CLOSED when it is
   * absent — declining to certify is the safe direction for an override.
   */
  currentCell?: Cell;
}

/** One lethality rule. */
export interface LethalityPolicy {
  readonly name: string;
  isLethal(ctx: LethalityContext): boolean;
}

/** The SHIPPED predicate. The default everywhere; changing this ships a behaviour change. */
export const DEFAULT_LETHALITY: LethalityPolicy = {
  name: "certainty",
  isLethal: (c) => isLethal(c.card, c.pHit, c.pCrit, c.fishHp),
};

/**
 * **The tightening — BUILT, DEFAULTED OFF, NOT ADOPTED.**
 *
 * ## The shipped predicate cannot be tightened on its THRESHOLD, and that is
 * the first thing to understand about it
 *
 * `pAnyHit < 0.999999` looks unfalsifiably strict: nothing is above 1, so
 * there is no number to raise it to. Discounting `pAnyHit` by any calibration
 * haircut sends it below the threshold ALWAYS, collapsing the predicate to
 * never-lethal. So the obvious "apply the measured bias" correction is not
 * available here — it is degenerate, not conservative.
 *
 * ## The optimism enters through the SUPPORT, not the threshold
 *
 * `pAnyHit` reaches 1.0 exactly when the card's hit+crit cells cover every
 * cell `dist` gives mass to, and the ring model gives mass only to Manhattan
 * distance EXACTLY 1 and EXACTLY 2 from the fish's current cell. Two outcome
 * classes therefore carry probability zero by CONSTRUCTION rather than by
 * evidence:
 *
 *   - the fish does not move (`actual == currentCell`), and
 *   - the fish lands off both rings.
 *
 * So "certain" means "certain GIVEN the fish moves exactly 1 or 2 cells". The
 * claim is conditional; the five override paths spend it as unconditional.
 *
 * ## The tightening
 *
 * Require the certainty to survive the one structural escape a PLACEMENT can
 * be made robust to: the card's connect cells must also cover the fish's
 * CURRENT cell. An off-ring landing is not coverable by any single placement,
 * so demanding that too would collapse the predicate to never-lethal — the
 * degenerate reading again, not a fix.
 *
 * Damage is unchanged: still the worst case of hit and crit.
 *
 * Fails closed without `currentCell`: a caller that cannot say where the fish
 * is cannot be granted an override on the strength of where it is not.
 *
 * ## What it costs, stated honestly
 *
 * Session 73 measured no-move turns at **0 of 134** on today's era, so on the
 * corpus this repo has, this is very nearly inert — and
 * `scripts/isLethalBlastRadius.ts` reports exactly how nearly. An inert
 * tightening is a real result: it says the override's optimism is NOT being
 * spent on the no-move escape, which narrows where a correction could
 * usefully go. It is not an argument for shipping it.
 */
export const STRICT_LETHALITY: LethalityPolicy = {
  name: "strict-covers-current-cell",
  isLethal: (c) => {
    if (!isLethal(c.card, c.pHit, c.pCrit, c.fishHp)) return false;
    if (!c.currentCell) return false; // fail closed — see the doc comment
    const covered = new Set([
      ...zonesToCells(c.focus, c.card.critZones, c.gridSize).map(cellKey),
      ...zonesToCells(c.focus, c.card.hitZones, c.gridSize).map(cellKey),
    ]);
    return covered.has(cellKey(c.currentCell));
  },
};

/**
 * **Diagnostic only — never a shipping candidate.** Disables the override
 * entirely, which is how `scripts/isLethalBlastRadius.ts` gets a PAIRED
 * counterfactual: the same turn, same state, same distribution, replanned with
 * every exemption withdrawn. Running it as a policy would throw away catches
 * on purpose.
 */
export const NEVER_LETHAL: LethalityPolicy = {
  name: "never (diagnostic)",
  isLethal: () => false,
};

/**
 * **[RE-DERIVED 2026-08-16, session 15]** argmax raw `EV(card, f)` over
 * every focus placement the grid allows, for one card. Session 13's
 * argmax-`P_hit` primary objective is an OVERCORRECTION, not just a fix to
 * the `/manaCost` divisor — the session-15 brief's own screenshot evidence:
 * cards differ in both damage (2 vs. 5 in the observed hand) and miss
 * penalty (3), and `argmax P_hit` is blind to both, indifferent between a
 * 2-damage and a 5-damage card at equal hit chance. `ev` (already computed
 * below as `P_hit·hitEffect + P_crit·critEffect − missPenalty·(1−P_hit)`,
 * i.e. expected net progress in `fishHp` units) already encodes exactly what
 * SPEC.md §5 originally specified before the session-13 correction went
 * further than the bug required — the mana divisor was the defect, not the
 * EV-vs-P_hit choice. `pHit`/`pCrit` are still computed and carried for
 * `isLethal`/the mana-constrained fallback below, just no longer the primary
 * sort key.
 */
export function bestFocusForCard(
  card: FishingCardLike,
  handIndex: number,
  dist: Distribution,
  gridSize: number,
  missPenaltyMultiplier: number,
  fishHp: number,
  focusBudget?: FocusBudget,
  /**
   * [session 44] Gates heuristics (a)/(f) below, default `true` to preserve
   * this project's already-shipped live behavior byte-for-byte for every
   * existing caller. Added so `scripts/fishingHeuristicAblation.ts` can
   * measure their sim effect against the SAME matcher/matcherPool with one
   * flag, instead of duplicating this function's tie-break logic.
   */
  heuristicsEnabled: boolean = true,
  /**
   * [session 45, brief §3] Weight on `focusReserveFraction` above. Default
   * `0` — with no weight the score IS the EV and every pre-session-45 caller
   * behaves byte-for-byte as before. `DEFAULT_FOCUS_RESERVE_WEIGHT` carries
   * the value picked from `scripts/focusReserveAblation.ts`'s sweep and is
   * what the live loop and the sim policy actually pass.
   */
  focusReserveWeight: number = 0,
  /**
   * [session 49, brief §3] The turn's focus SPEND constraint
   * (`focusBudget.ts`). Defaults to `UNCONSTRAINED`, so every pre-session-49
   * caller, test and sim script behaves byte-for-byte as before — the same
   * convention `heuristicsEnabled` and `focusReserveWeight` were added under.
   *
   * Applied as an eligibility filter over placements, NOT as another score
   * term. That is the whole point: session 48 proved a score term cannot
   * encode an opportunity cost that changes with the turn index.
   */
  spendConstraint: FocusSpendConstraint = UNCONSTRAINED,
  /**
   * [session 50, brief §2] Restrict the placement search to these cells.
   * Default `undefined` — the full reachable set, byte-for-byte the
   * pre-session-50 behavior for every existing caller.
   *
   * This is how the expected-COVERAGE objective
   * (`src/strategy/fishing/coverageFocus.ts`) is composed with EV card
   * choice without touching either one's scoring: coverage picks WHERE to
   * aim, then this function picks the best card to play from there. The
   * alternative — folding a coverage term into `score` — would repeat
   * session 48's mistake of encoding a horizon-dependent quantity as a flat
   * penalty, and would also make the two objectives inseparable at report
   * time.
   */
  focusCandidates?: readonly Cell[],
  /**
   * [session 74 §2] The lethality rule. Defaults to the SHIPPED predicate, so
   * every existing caller behaves byte-for-byte as before — the same
   * convention `heuristicsEnabled`, `focusReserveWeight` and `spendConstraint`
   * were added under. `currentCell` is threaded alongside because
   * `STRICT_LETHALITY` needs it and fails closed without it.
   */
  lethality: LethalityPolicy = DEFAULT_LETHALITY,
  currentCell?: Cell,
): CardFocusChoice {
  const searchSpace =
    focusCandidates ?? (focusBudget ? reachableCells(gridSize, focusBudget.current, focusBudget.remaining) : allCells(gridSize));
  const moveCostOf = (focus: Cell): number => (focusBudget ? manhattan(focusBudget.current, focus) : 0);
  // The best placement that spends NOTHING — the reference point the EV
  // threshold is measured against, and the guaranteed-eligible fallback that
  // makes it impossible for any policy to empty the search space.
  let bestStay: CardFocusChoice | null = null;
  let best: CardFocusChoice | null = null;
  /**
   * [session 50] Any evaluated placement at all. Only ever consulted when the
   * search space contains no cost-0 cell — impossible for the default
   * `reachableCells` space, possible for an explicit `focusCandidates` list —
   * so this cannot change any pre-session-50 result. Without it a restricted
   * search space whose only member is blocked by `spendConstraint` would
   * throw.
   */
  let anyCandidate: CardFocusChoice | null = null;
  for (const focus of searchSpace) {
    const { ev, pHit, pCrit } = evaluateCardAtFocus(card, focus, dist, gridSize, missPenaltyMultiplier);
    const evPerMana = card.manaCost > 0 ? ev / card.manaCost : ev;
    const score = ev + focusReserveWeight * focusReserveFraction(focusBudget, focus);
    const candidate: CardFocusChoice = {
      card,
      handIndex,
      focus,
      ev,
      evPerMana,
      score,
      pHit,
      pCrit,
      lethal: lethality.isLethal({ card, focus, dist, gridSize, pHit, pCrit, fishHp, currentCell }),
    };
    if (!anyCandidate) anyCandidate = candidate;
    const moveCost = moveCostOf(focus);
    if (moveCost === 0 && (!bestStay || candidate.score > bestStay.score + EV_TIE_EPSILON)) bestStay = candidate;
    // A LETHAL placement is never blocked — no schedule gets to talk the bot
    // out of landing the catch. Everything else respects the cap.
    if (!candidate.lethal && moveCost > spendConstraint.maxMoveCost) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.lethal && !best.lethal) {
      best = candidate;
      continue;
    }
    if (!candidate.lethal && best.lethal) continue;
    if (candidate.score > best.score + EV_TIE_EPSILON) {
      best = candidate;
      continue;
    }
    // [session 31, CODEXIMPROVE #2] Equal EV (within EV_TIE_EPSILON) used to
    // resolve by grid enumeration order — meaning the bot could spend
    // scarce, non-regenerating focus-movement budget (geometry.ts's
    // reachableCells) for zero immediate benefit. This cannot reduce EV, it
    // only breaks a real tie in favor of the cheaper placement.
    //
    // [session 43] Two more EV-tied tie-break tiers, same "cannot reduce EV,
    // only breaks a real tie" discipline, inserted BEFORE movement cost —
    // heuristic (f) (coverage of the distribution's support, hedging
    // against being wrong about exactly which cell the fish lands on) then
    // heuristic (a) (the central 2×2, so the next Focus move has more of
    // the board within its 3-point reach). See `heuristics.ts`.
    if (Math.abs(candidate.score - best.score) <= EV_TIE_EPSILON) {
      if (heuristicsEnabled) {
        const candidateCoverage = coverageCount(candidate.card, candidate.focus, dist, gridSize);
        const bestCoverage = coverageCount(best.card, best.focus, dist, gridSize);
        if (candidateCoverage !== bestCoverage) {
          if (candidateCoverage > bestCoverage) best = candidate;
          continue;
        }
        const candidateCentral = isCentralSquare(candidate.focus, gridSize);
        const bestCentral = isCentralSquare(best.focus, gridSize);
        if (candidateCentral !== bestCentral) {
          if (candidateCentral) best = candidate;
          continue;
        }
      }
      if (focusBudget) {
        const candidateCost = manhattan(focusBudget.current, candidate.focus);
        const bestCost = manhattan(focusBudget.current, best.focus);
        if (candidateCost < bestCost) best = candidate;
      }
    }
  }
  // A cost-0 placement is always in `reachableCells`, so `bestStay` is only
  // null when the grid itself is degenerate — the same condition `best` was
  // already guarding.
  if (!best) best = bestStay ?? anyCandidate;
  if (!best) throw new Error("gridSize must be >= 1");
  // The EV threshold: a non-lethal move has to clear the best stay-put
  // placement by more than `moveEvThreshold` to be worth a focus point.
  if (
    spendConstraint.moveEvThreshold > 0 &&
    bestStay &&
    !best.lethal &&
    moveCostOf(best.focus) > 0 &&
    best.ev - bestStay.ev <= spendConstraint.moveEvThreshold
  ) {
    return bestStay;
  }
  return best;
}

/**
 * Rough lower bound on whether the fish can plausibly be finished with the
 * mana on hand — SPEC.md §5, session-13 correction: **misses are the real
 * budget** (the one real cast escaped at half its mana unspent, meter-capped
 * by misses, not mana-capped), so mana only needs to gate the LATE-cast case
 * where it's genuinely about to run out before the fish could be finished
 * even under optimistic play. `bestHitAmong`/`cheapestMana` are both
 * best-case bounds (the best card in THIS hand, not a guaranteed future
 * draw), so this only trips when mana is truly tight, never speculatively.
 */
function isManaConstrained(hand: readonly FishingCardLike[], mana: number, fishHp: number): boolean {
  if (hand.length === 0 || fishHp <= 0) return false;
  const bestHitAmong = Math.max(...hand.map((c) => Math.max(amountOf(c.hitEffects), amountOf(c.critEffects))));
  if (bestHitAmong <= 0) return false;
  const turnsNeeded = Math.ceil(fishHp / bestHitAmong);
  const cheapestMana = Math.min(...hand.map((c) => c.manaCost));
  return mana < turnsNeeded * cheapestMana;
}

/**
 * Choose the best (card, focus) among affordable cards.
 *
 * **[RE-DERIVED 2026-08-16, session 15]** Lethal overrides everything else —
 * SPEC.md §5's "lethal check first". Otherwise the primary objective is
 * **argmax raw `EV(card, f)`** — expected net progress in `fishHp` units,
 * `P_hit·damage − (1−P_hit)·missPenalty`, using each card's own real
 * `hitEffects[0].amount`/`missEffects[0].amount` rather than a global
 * constant. Session 13's `argmax P_hit` was itself an overcorrection to the
 * real session-13 bug (dividing by `manaCost`): switching the objective
 * away from EV entirely threw out card damage/miss-penalty information that
 * `argmax P_hit` cannot see, and per the session-15 brief's screenshot
 * evidence, real cards vary 2.5x in damage and vary in miss penalty too —
 * `argmax P_hit` is indifferent between them at equal hit chance, which is
 * exactly wrong. `argmax EV/mana` is kept only as the late-cast correction,
 * gated by `isManaConstrained`: once mana genuinely can't cover finishing
 * the fish even under optimistic play, efficiency starts mattering again.
 */
/**
 * [session 31, CODEXIMPROVE #2; extended session 43] True when `a` should be
 * preferred over `b` under the deterministic tie-break order: higher EV (or
 * EV/mana, per `useEvPerMana`) first; on an EV tie, HIGHER coverage of the
 * distribution's support (session-43 heuristic (f), `heuristics.ts`'s
 * `coverageCount` — hedges against being wrong about exactly which cell the
 * fish lands on); on a further tie, the placement in the central 2×2
 * (session-43 heuristic (a), `isCentralSquare` — avoids sitting on an edge
 * without a real EV/coverage reason to); on a further tie, lower focus
 * movement cost from the current focus; on a further tie, lower mana cost;
 * otherwise keep the existing hand/grid order (i.e. `a` does NOT win a full
 * tie — `.reduce`'s strict `>` semantics below preserve first-seen order).
 * Deliberately does not compare `lethal` — callers partition lethal from
 * non-lethal options before calling this, per SPEC.md §5's "lethal check
 * first" (session 15). `dist`/`gridSize` are optional so an existing caller
 * that has neither (there is none left in this codebase, but future tests
 * calling this directly stay unaffected) simply skips the coverage tier.
 */
function isPreferred(
  a: CardFocusChoice,
  b: CardFocusChoice,
  focusBudget: FocusBudget | undefined,
  useEvPerMana: boolean,
  dist?: Distribution,
  gridSize?: number,
  heuristicsEnabled: boolean = true,
): boolean {
  // [session 45] `score` (EV + focus reserve) is the primary key on the
  // ordinary path; the mana-constrained path stays on raw `evPerMana`, since
  // once mana genuinely cannot cover finishing the fish, per-mana efficiency
  // is the question and a future focus option is not.
  const evA = useEvPerMana ? a.evPerMana : a.score;
  const evB = useEvPerMana ? b.evPerMana : b.score;
  if (evA > evB + EV_TIE_EPSILON) return true;
  if (evB > evA + EV_TIE_EPSILON) return false;
  if (heuristicsEnabled && dist && gridSize) {
    const coverageA = coverageCount(a.card, a.focus, dist, gridSize);
    const coverageB = coverageCount(b.card, b.focus, dist, gridSize);
    if (coverageA !== coverageB) return coverageA > coverageB;
    const centralA = isCentralSquare(a.focus, gridSize);
    const centralB = isCentralSquare(b.focus, gridSize);
    if (centralA !== centralB) return centralA;
  }
  if (focusBudget) {
    const costA = manhattan(focusBudget.current, a.focus);
    const costB = manhattan(focusBudget.current, b.focus);
    if (costA !== costB) return costA < costB;
  }
  if (a.card.manaCost !== b.card.manaCost) return a.card.manaCost < b.card.manaCost;
  return false;
}

export function chooseCard(
  hand: readonly FishingCardLike[],
  mana: number,
  dist: Distribution,
  gridSize: number,
  missPenaltyMultiplier: number,
  fishHp: number,
  focusBudget?: FocusBudget,
  /** [session 44] See `bestFocusForCard`'s doc comment — same flag, threaded through. */
  heuristicsEnabled: boolean = true,
  /** [session 45] See `bestFocusForCard`'s doc comment — same weight, threaded through. */
  focusReserveWeight: number = 0,
  /** [session 49, brief §3] See `bestFocusForCard`'s doc comment — same constraint, threaded through. */
  spendConstraint: FocusSpendConstraint = UNCONSTRAINED,
  /** [session 50, brief §2] See `bestFocusForCard`'s doc comment — same restriction, threaded through. */
  focusCandidates?: readonly Cell[],
  /** [session 74 §2] See `bestFocusForCard` — same policy, threaded through. */
  lethality: LethalityPolicy = DEFAULT_LETHALITY,
  currentCell?: Cell,
): CardFocusChoice | null {
  const options = hand
    .map((c, i) => [c, i] as const)
    .filter(([c]) => c.manaCost <= mana)
    .map(([c, i]) =>
      bestFocusForCard(
        c,
        i,
        dist,
        gridSize,
        missPenaltyMultiplier,
        fishHp,
        focusBudget,
        heuristicsEnabled,
        focusReserveWeight,
        spendConstraint,
        focusCandidates,
        lethality,
        currentCell,
      ),
    );
  if (options.length === 0) return null;

  const pickBest = (candidates: readonly CardFocusChoice[], useEvPerMana: boolean): CardFocusChoice =>
    candidates.reduce((best, o) => (isPreferred(o, best, focusBudget, useEvPerMana, dist, gridSize, heuristicsEnabled) ? o : best));

  const lethalOptions = options.filter((o) => o.lethal);
  if (lethalOptions.length > 0) return pickBest(lethalOptions, false);

  if (isManaConstrained(hand, mana, fishHp)) {
    return pickBest(options, true);
  }
  return pickBest(options, false);
}

/**
 * Session 17: which of the 3 `cardsToAdd` offers to keep after a catch
 * (QUESTIONS.md §10 — the `loot` action, confirmed live this session).
 * This is a ONE-TIME permanent deck addition, not an in-cast tactical
 * pick, so `chooseCard`'s EV-against-a-live-distribution machinery doesn't
 * apply — there's no fish position to aim at yet. Simple, defensible
 * placeholder: argmax raw hit-power per mana (`max(hitEffect, critEffect)
 * / manaCost`), the same "damage efficiency" intuition `chooseCard` uses
 * when mana-constrained. Not sim-validated against a full-deck-composition
 * objective — that's a real question (does this card's grid coverage,
 * miss penalty, rarity synergy with the rest of the deck matter more than
 * raw damage/mana?) deliberately left open rather than guessed at.
 */
/**
 * ── [session 112, TASKS.md §13] POSITIONAL REACHABILITY ────────────────────
 *
 * **The fraction of focus placements from which this card can land ANY zone
 * on the board.** Pure geometry over `hitZones ∪ critZones` and `gridSize`:
 * no fish model, no probability, no estimator. A card scoring 1 can be fired
 * from anywhere; a card scoring 6/9 whiffs BY CONSTRUCTION from three of the
 * nine focus cells, whatever the fish is doing.
 *
 * ## Why this exists, and what it is NOT
 *
 * `chooseNewCard` below scores `max(hitEffect, critEffect) / manaCost` and is
 * blind to this entirely. That blindness has a recorded cost: session 92's
 * offer `{35, 30, 31}` went to **card 35**, whose 8 comes from a crit on a
 * SINGLE zone `[2]`, over cards 30 and 31 whose 6 covers five zones each —
 * a one-zone crit and a five-zone hit compared as if they were the same
 * event. The bot had already played card 35 into a guaranteed miss, and then
 * took a second copy of it.
 *
 * ⚠ **CORRECTION, and it changes what a fix may do** [session 112]. STATE.md
 * carried this as *"card 84 has no on-grid footprint"*. Checked against
 * `fixtures/fishing-casts/cards.json`, card 84 is `hitZones: [7,8,9]`, hit 6,
 * mana 1 — an ordinary card, strictly better than card 3 (same zones, hit 5).
 * `matcherHeadroom`'s set is PER PLAY and POSITIONAL: "could not hit **from
 * the cell it was fired from**". Nothing in the catalog is footprint-less.
 * So a rule of the form "never take a card with no footprint" would be a rule
 * about the empty set, and the real quantity is this fraction.
 *
 * ## NOT WIRED INTO `chooseNewCard`, deliberately
 *
 * TASKS.md §13's gate requires a candidate to beat the current heuristic on
 * sim catch rate or turns-to-catch with non-overlapping 95% CI, and §13 is
 * parked on a DATA floor — real card choices reaching double digits — not on
 * missing code. Per CLAUDE.md rule 6 that gate is not meetable by working
 * harder offline, so this ships as a measured, tested quantity that §13 can
 * score when it unparks, and changes no live decision today.
 */
export function positionalReachability(card: FishingCardLike, gridSize: number): number {
  const zones = [...card.hitZones, ...card.critZones];
  if (zones.length === 0) return 0;
  const cells = allCells(gridSize);
  const reachable = cells.filter((f) => zonesToCells(f, zones, gridSize).length > 0).length;
  return reachable / cells.length;
}

/**
 * [session 112] The mean number of on-grid cells this card covers, averaged
 * over every focus placement — the finer-grained sibling of
 * `positionalReachability`.
 *
 * Reachability answers "can it hit at all from here", which is the question
 * the guaranteed-miss set asks. This answers "how much board does it cover",
 * which is the user's own manual-play heuristic as recorded in TASKS.md §13
 * ("pick the offered card with the most hit/catch spots"). They disagree:
 * a card reaching from every cell but covering one zone scores 1.0 here and
 * 1.0 there, while a five-zone card that whiffs from one row scores lower on
 * reachability and much higher on coverage. Both are reported rather than
 * blended, because §13's gate has to be able to tell them apart.
 *
 * Same standing: measured, tested, NOT wired live.
 */
export function meanZoneCoverage(card: FishingCardLike, gridSize: number): number {
  const zones = [...card.hitZones, ...card.critZones];
  if (zones.length === 0) return 0;
  const cells = allCells(gridSize);
  const total = cells.reduce((a, f) => a + zonesToCells(f, zones, gridSize).length, 0);
  return total / cells.length;
}

export function chooseNewCard(offers: readonly FishingCardLike[]): FishingCardLike {
  if (offers.length === 0) throw new Error("chooseNewCard: no offers");
  const valueOf = (c: FishingCardLike): number => {
    const power = Math.max(amountOf(c.hitEffects), amountOf(c.critEffects));
    return c.manaCost > 0 ? power / c.manaCost : power;
  };
  return offers.reduce((best, c) => (valueOf(c) > valueOf(best) ? c : best));
}

/**
 * SPEC.md §5: "Redraw when max EV < redrawThreshold and mana comfortably
 * exceeds the redraw cost." Redraw cost is 1 mana per card still held —
 * [VERIFY], SPEC-fishing.md §0.
 *
 * **[FIXED session 13]** This read `best.evPerMana`, not `best.ev` as SPEC
 * always specified — a real divergence, not a rename. It surfaced as a bug
 * (not just an inconsistency) the moment `chooseCard`'s primary objective
 * stopped being EV/mana (§1's fix, same session): the chosen card is now
 * picked for hit probability, so its EV/mana can be legitimately low even
 * when it's the right pick, and comparing that number against a threshold
 * calibrated for "is EV/mana bad" triggered redraw almost every turn —
 * confirmed live in the 500-cast sim, where the matcher policy's outcome
 * mix flipped from 89% `escaped_fish_full` to 78% `escaped_mana` at a mean of
 * 1.29 turns/cast (repeated redraws burning mana before a card was ever
 * played). Reading raw `ev` against a re-tuned threshold (`REDRAW_THRESHOLD`,
 * `src/sim/fishing/castSim.ts`) fixes it.
 */
export function shouldRedraw(
  best: CardFocusChoice | null,
  handSize: number,
  mana: number,
  redrawThreshold: number,
): boolean {
  const redrawCost = handSize;
  const bestEv = best?.ev ?? -Infinity;
  return bestEv < redrawThreshold && mana > redrawCost;
}

/**
 * ── [session 72 §2] THE RE-DERIVED REDRAW TRIGGER ──────────────────────────
 *
 * **This is not a re-tune of `shouldRedraw`'s number. It is a different
 * question asked of the hand**, and the brief was explicit that re-tuning the
 * old constant was the failure mode to avoid.
 *
 * THE POSTMORTEM, in one line: §5 above records that the one prior calibration
 * fired almost every turn, flipping the loss mix from 89% `escaped_fish_full` to
 * 78% `escaped_mana` at a mean of **1.29 turns per cast**. Its stated cause is
 * a mismatch of currency — the trigger tests `ev`, but `chooseCard` stopped
 * maximizing EV in session 13 and now picks for hit probability, so a card can
 * be the right pick and carry a legitimately low EV. A threshold calibrated to
 * catch bad cards fires on good ones. **Tuning that constant cannot fix a
 * currency mismatch; it can only move where the mismatch bites.**
 *
 * SO ASK THE RIGHT QUESTION. A redraw is worth its cost when the hand CANNOT
 * CONNECT, not when the hand scores poorly per mana. The quantity that says so
 * is the connect probability of the play the policy is about to make —
 * `pHit + pCrit` — measured under the policy's own distribution, in the same
 * currency the objective is already denominated in.
 *
 * **THE THRESHOLD IS DERIVED, NOT TUNED, AND THAT IS THE WHOLE POINT.** What
 * you get by redrawing is a FRESH HAND, so the only defensible bar is the
 * connect probability a fresh hand delivers. Redraw when this hand is worse
 * than a fresh one by more than the mana is worth:
 *
 *     fire  <=>  pConnect  <  pFresh - manaPrice
 *
 * `pFresh` is measurable on real recorded turns (`scripts/
 * redrawTriggerCalibration.ts` reads it off the era-matched replay; it is the
 * mean `pConnect` on hands the server had just dealt). `manaPrice` is the
 * margin that pays for `handSize` mana out of a 10-mana cast. Neither is a
 * free parameter fitted to an outcome — which is exactly what the old
 * threshold was, and why nobody could say what it meant.
 *
 * **Both degeneracies are reachable by construction and pinned by
 * `tests/fishing/redrawTrigger.test.ts`**, mirroring `oilTiming.ts`'s
 * `NEVER_FIRES_THRESHOLD` / `ALWAYS_FIRES_THRESHOLD` precedent. Since
 * `pConnect` is a probability in [0, 1], a threshold of 0 can never fire and a
 * threshold above 1 always fires — so the failure mode ON RECORD (fires every
 * turn) is a specific, testable value rather than a thing to be careful about.
 *
 * NOT WIRED LIVE. `liveFishing.ts` still calls `shouldRedraw`, and redraw is
 * still off. Shipping this is a live-policy change and the user's call.
 */
export function shouldRedrawOnConnect(
  best: CardFocusChoice | null,
  handSize: number,
  mana: number,
  connectThreshold: number,
): boolean {
  const redrawCost = handSize;
  // A hand with no affordable/legal play connects with probability 0 — it is
  // the strongest possible case for a redraw, not a case to skip. `-Infinity`
  // (what `shouldRedraw` uses for `ev`) is not available to a probability, and
  // 0 is both correct and in-range.
  const pConnect = best ? best.pHit + best.pCrit : 0;
  return pConnect < connectThreshold && mana > redrawCost;
}

/**
 * A threshold `shouldRedrawOnConnect` can never fire at: `pConnect >= 0`
 * always, so `pConnect < 0` is unsatisfiable. The never-redraw degeneracy.
 */
export const NEVER_REDRAW_CONNECT_THRESHOLD = 0;

/**
 * A threshold `shouldRedrawOnConnect` always fires at whenever the mana check
 * passes: `pConnect <= 1` always, so `pConnect < 2` is unsatisfiable to
 * violate. The always-redraw degeneracy — the failure mode on record.
 */
export const ALWAYS_REDRAW_CONNECT_THRESHOLD = 2;
