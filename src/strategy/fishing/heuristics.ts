/**
 * src/strategy/fishing/heuristics.ts — [session 43] four user-sourced
 * fishing heuristics, concrete enough to implement directly (session-43
 * brief §3 a/d/e/f). Kept as a sibling of `cardChoice.ts` rather than folded
 * into it, per the brief's own suggestion, since these are distribution- and
 * geometry-shaping concerns rather than the (card, focus) EV formula itself.
 *
 * Pure functions — no network, per CLAUDE.md's strategy/API separation.
 * `(b)` (deliberately play a losing card / redraw to let the fish drift
 * closer) and `(c)` (oil reserve floor) are NOT here — the brief itself
 * calls them judgment calls, not pure functions; see `cardChoice.ts`'s
 * `chooseCard`/`shouldRedraw` doc comments and `oilPolicy.ts` respectively.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { cellKey, reachableCells, zonesToCells } from "../../sim/fishing/geometry.js";
import type { Displacement } from "./contextualFallback.js";
import type { Distribution, FishingCardLike } from "./cardChoice.js";

/**
 * (a) "Bias toward keeping FocusPoint in the central 2×2 square of the
 * grid; avoid sitting on the field's edges without urgent need — from an
 * edge position, the 3-charge Focus budget may not be enough to reach the
 * fish if she jumps to the opposite side of the grid."
 *
 * User-stated, session 43. NOT corpus-validated — no live cast has yet
 * measured whether staying central actually improves catch rate; this
 * encodes the user's own stated reasoning (a real, checkable geometric
 * fact — a corner-to-corner jump costs `2*(gridSize-1)` Focus, always more
 * than the 3-point budget on a grid ≥ 3, and only the central square keeps
 * every cell within reach of a single 3-point move) as a TIE-BREAK, not a
 * primary objective — see `cardChoice.ts`'s `isPreferred`. It can only ever
 * decide between options already tied on EV and coverage ("urgent need" —
 * a real EV/coverage advantage elsewhere — always wins first).
 *
 * Generalises `gridSize` even though Dendren's confirmed value is 4
 * (SPEC-fishing.md §4); assumes an even `gridSize` so the "central 2×2" is
 * well-defined (a odd grid has a single central cell, not a square — not
 * hit in practice since Dendren is the only confirmed board, flagged here
 * rather than silently producing a 1-cell "square" for one).
 */
export function isCentralSquare(cell: Cell, gridSize: number): boolean {
  const lo = Math.floor(gridSize / 2);
  const hi = lo + 1;
  return cell.x >= lo && cell.x <= hi && cell.y >= lo && cell.y <= hi;
}

/**
 * (d) "A fish that just made a 1-cell move never returns to the cell it
 * just came from on its next move — usable to prune the predicted next-move
 * set."
 *
 * User-stated, session 43. NOT corpus-validated — no capture has confirmed
 * this rule against real fish trajectories yet (`data/fish-patterns.jsonl`
 * has never been audited for a same-turn-adjacent 1-cell move followed by
 * an immediate reversal); implemented as stated because it is concrete and
 * cheap to apply, but treated as an unverified prune, not a proven one — a
 * future audit against the transition log could falsify it and should
 * remove this call rather than "explain around" a counterexample.
 *
 * Zeroes the probability mass at the one cell the rule forbids (the cell
 * `fromCell - prev` — where the fish would have to step back to) and
 * renormalises the remainder. Only applies after a 1-cell previous move
 * (`|prev.dx| + |prev.dy| === 1`); a 2-cell move or a cast's first hop
 * (`prev === null`) leaves the distribution untouched, since the rule says
 * nothing about either case. Refuses to prune down to an empty
 * distribution — returns the input unchanged if the forbidden cell was the
 * ENTIRE remaining probability mass (a matcher/fallback distribution
 * degenerate enough to be wrong about that would be a bigger problem than
 * this prune could fix, and an empty `Distribution` breaks every downstream
 * consumer).
 */
export function pruneReturnToPrevious(dist: Distribution, fromCell: Cell, prev: Displacement | null): Distribution {
  if (!prev) return dist;
  if (Math.abs(prev.dx) + Math.abs(prev.dy) !== 1) return dist;
  const forbidden: Cell = { x: fromCell.x - prev.dx, y: fromCell.y - prev.dy };
  const key = cellKey(forbidden);
  const removed = dist.get(key);
  if (!removed) return dist;
  const remaining = 1 - removed.p;
  if (remaining <= 1e-9) return dist;
  const out = new Map<string, { cell: Cell; p: number }>();
  for (const [k, v] of dist) {
    if (k === key) continue;
    out.set(k, { cell: v.cell, p: v.p / remaining });
  }
  return out;
}

/**
 * (e) "A fish that just made a 2-cell move is easier to predict when she's
 * on the edge of the field and the player is centered in the middle 2×2."
 *
 * User-stated, session 43. Encoded narrowly, as the one piece of this claim
 * that is a geometric fact rather than a probabilistic one: the number of
 * grid cells within a `radius`-cell move of an edge/corner position is
 * strictly smaller than from a central position (some directions run off
 * the board), so an edge position is more constrained — a smaller candidate
 * set is "easier to predict" in the narrow information-theoretic sense of
 * fewer live hypotheses, independent of whatever the fish's real movement
 * distribution turns out to be. This does NOT claim the fish is more likely
 * to land in any particular one of those cells — that would need corpus
 * evidence this project doesn't have yet (see the module header). The
 * "player centered" half of the claim is exactly heuristic (a) above: it is
 * only a genuine reasoning link (an edge fish is both more constrained AND
 * within the centered player's 3-point Focus reach) if both heuristics are
 * applied together, which `isCentralSquare`'s bias and this function's
 * narrower reach do independently.
 */
export function candidateCellCount(fromCell: Cell, gridSize: number, radius: number): number {
  return reachableCells(gridSize, fromCell, radius).length;
}

/**
 * (f) "When choosing the next card, prefer whichever covers the maximum
 * number of cells the fish could plausibly move to next (a
 * coverage-maximizing heuristic over the predicted move set), over just the
 * highest single-cell expected value."
 *
 * User-stated, session 43. `cardChoice.ts`'s EV formula already sums
 * PROBABILITY-WEIGHTED outcomes across every cell a card's zones intersect
 * with the distribution's support (`evaluateCardAtFocus`) — a more rigorous
 * generalisation of "single-cell EV" than the heuristic's own framing
 * describes, so this does not replace EV as the primary objective (that
 * would throw away real probability information the matcher/fallback
 * already computed). What it adds: an unweighted COUNT of distinct
 * distribution-support cells a (card, focus) placement's hit ∪ crit zones
 * cover, as a tie-break ahead of the existing focus-movement-cost one
 * (`cardChoice.ts`'s `isPreferred`) — among EV-tied options, prefer the one
 * that stays live across more of the surviving hypothesis set, hedging
 * against being wrong about which cell the fish actually lands on.
 */
export function coverageCount(card: FishingCardLike, focus: Cell, dist: Distribution, gridSize: number): number {
  const cells = new Set([...zonesToCells(focus, card.hitZones, gridSize), ...zonesToCells(focus, card.critZones, gridSize)].map(cellKey));
  let count = 0;
  for (const key of cells) if (dist.has(key)) count++;
  return count;
}
