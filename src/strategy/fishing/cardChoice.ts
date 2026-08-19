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
import { allCells, cellKey, manhattan, reachableCells, zonesToCells } from "../../sim/fishing/geometry.js";
import { coverageCount, isCentralSquare } from "./heuristics.js";

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
  pHit: number;
  pCrit: number;
  /** True only when every non-zero-probability outcome is a guaranteed catch this turn. */
  lethal: boolean;
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
): CardFocusChoice {
  const searchSpace = focusBudget ? reachableCells(gridSize, focusBudget.current, focusBudget.remaining) : allCells(gridSize);
  let best: CardFocusChoice | null = null;
  for (const focus of searchSpace) {
    const { ev, pHit, pCrit } = evaluateCardAtFocus(card, focus, dist, gridSize, missPenaltyMultiplier);
    const evPerMana = card.manaCost > 0 ? ev / card.manaCost : ev;
    const candidate: CardFocusChoice = {
      card,
      handIndex,
      focus,
      ev,
      evPerMana,
      pHit,
      pCrit,
      lethal: isLethal(card, pHit, pCrit, fishHp),
    };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.lethal && !best.lethal) {
      best = candidate;
      continue;
    }
    if (!candidate.lethal && best.lethal) continue;
    if (candidate.ev > best.ev + EV_TIE_EPSILON) {
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
    if (Math.abs(candidate.ev - best.ev) <= EV_TIE_EPSILON) {
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
  if (!best) throw new Error("gridSize must be >= 1");
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
  const evA = useEvPerMana ? a.evPerMana : a.ev;
  const evB = useEvPerMana ? b.evPerMana : b.ev;
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
): CardFocusChoice | null {
  const options = hand
    .map((c, i) => [c, i] as const)
    .filter(([c]) => c.manaCost <= mana)
    .map(([c, i]) => bestFocusForCard(c, i, dist, gridSize, missPenaltyMultiplier, fishHp, focusBudget, heuristicsEnabled));
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
 * mix flipped from 89% `escaped_meter` to 78% `escaped_mana` at a mean of
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
