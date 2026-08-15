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
import { allCells, cellKey, reachableCells, zonesToCells } from "../../sim/fishing/geometry.js";

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
 * signature) so the sim, which doesn't model this mechanic at all yet, is
 * unaffected: omit it and the full grid is searched, exactly as before.
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
 * argmax `P_hit` (`pHit + pCrit`) over every focus placement the grid
 * allows, for one card — accuracy, not efficiency, is what a focus
 * placement controls (SPEC.md §5, re-derived session 13: mana is a
 * per-card feasibility filter, not a per-focus one, so it plays no part
 * here). `ev` is the tie-break when two placements land the same hit
 * probability (e.g. a crit-heavy vs. plain-hit split of the same cells).
 */
export function bestFocusForCard(
  card: FishingCardLike,
  handIndex: number,
  dist: Distribution,
  gridSize: number,
  missPenaltyMultiplier: number,
  fishHp: number,
  focusBudget?: FocusBudget,
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
    const candAnyHit = candidate.pHit + candidate.pCrit;
    const bestAnyHit = best.pHit + best.pCrit;
    if (candAnyHit > bestAnyHit || (candAnyHit === bestAnyHit && candidate.ev > best.ev)) {
      best = candidate;
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
 * **[RE-DERIVED session 13]** Lethal overrides everything else — SPEC.md
 * §5's "lethal check first". Otherwise the primary objective is **argmax
 * hit probability** (`pHit + pCrit`, `ev` as tie-break): the real cast that
 * grounds this design escaped with half its mana unspent, because the MISS
 * counter capped it, not mana — dividing by mana cost optimises against a
 * constraint that mostly isn't binding, and systematically prefers cheap
 * low-probability cards over expensive reliable ones, exactly backwards
 * when every miss is a step toward losing the cast. `argmax EV/mana` is
 * kept only as the late-cast correction, gated by `isManaConstrained`: once
 * mana genuinely can't cover finishing the fish even under optimistic play,
 * efficiency starts mattering again.
 */
export function chooseCard(
  hand: readonly FishingCardLike[],
  mana: number,
  dist: Distribution,
  gridSize: number,
  missPenaltyMultiplier: number,
  fishHp: number,
  focusBudget?: FocusBudget,
): CardFocusChoice | null {
  const options = hand
    .map((c, i) => [c, i] as const)
    .filter(([c]) => c.manaCost <= mana)
    .map(([c, i]) => bestFocusForCard(c, i, dist, gridSize, missPenaltyMultiplier, fishHp, focusBudget));
  if (options.length === 0) return null;

  const lethalOption = options.find((o) => o.lethal);
  if (lethalOption) return lethalOption;

  if (isManaConstrained(hand, mana, fishHp)) {
    return options.reduce((best, o) => (o.evPerMana > best.evPerMana ? o : best));
  }
  return options.reduce((best, o) => {
    const oAnyHit = o.pHit + o.pCrit;
    const bestAnyHit = best.pHit + best.pCrit;
    return oAnyHit > bestAnyHit || (oAnyHit === bestAnyHit && o.ev > best.ev) ? o : best;
  });
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
