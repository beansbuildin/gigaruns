/**
 * src/strategy/fishing/contextualFallback.ts — [session 33, CODEXIMPROVE #3]
 * conditions `matcher.ts`'s `emptyFallback` on the fish's PREVIOUS movement
 * displacement, not just its current cell. Codex's offline leave-one-cast-out
 * ablation on the real corpus (49 clean casts / 165 transitions) found
 * current-cell-only top-1 accuracy of 16.4%, and current-cell +
 * previous-direction more than doubling it to 33.9% — see this session's
 * brief (`handoff/next.md`) for the full table. `scripts/
 * fishingContextualCV.ts` re-runs that ablation against the live corpus
 * before this module is trusted; see its own header for the reproduced
 * numbers and CLAUDE.md §9's standing rule that a brief's numbers are a
 * hypothesis to verify, not a fact to implement.
 *
 * Pure, no I/O, no network — per CLAUDE.md's working-style split, this module
 * takes already-grouped `Cast[]` (see `src/sim/fishing/transitionCorpus.ts`)
 * and returns distributions; loading `data/fish-patterns.jsonl` and calling
 * this stays the caller's job (`scripts/liveFishing.ts`,
 * `scripts/fishingContextualCV.ts`).
 *
 * Hierarchical distributional backoff, most-specific first (brief's own
 * spec, requirement 3). [session 38, CODEXAUDIT #2] Tier 1 no longer
 * hard-switches: it is CONTINUOUSLY SHRUNK toward tier 2 by
 * `n / (n + shrinkageK)`, where `n` is the distinct-cast support at that
 * exact `(cell, displacement)` key (not just raw transition count — one
 * cast revisiting the same combo on a short cycle must not look like
 * independent evidence, same reasoning as the retired hard threshold).
 *   1. current cell + previous displacement, mixed with tier 2 by
 *      `matcher.ts`'s `mixDistributions()` at weight `n / (n + shrinkageK)`.
 *   2. current cell only (`matcher.ts`'s existing `emptyFallback`,
 *      unchanged) — used both when there's no previous displacement (a
 *      cast's first hop) and as the other half of tier 1's mix (at `n = 0`
 *      the mix collapses to pure cell-only, so the two tiers are
 *      continuous with each other rather than a cliff).
 *   3. uniform over the grid (`emptyFallback`'s own last resort, unchanged).
 *
 * Turn number is deliberately NOT part of the context key — Codex's own
 * ablation found it added nothing to top-1 accuracy while sharply cutting
 * coverage (100% -> 82.4% -> 49.1% as cell-only -> +turn -> +turn+prevdir
 * stack more features), so this module never reads a turn number at all.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { cellKey } from "../../sim/fishing/geometry.js";
import type { Cast } from "../../sim/fishing/transitionCorpus.js";
import { distributionFromMultiset, emptyFallback, mixDistributions } from "./matcher.js";

export interface Displacement {
  dx: number;
  dy: number;
}

function displacementKey(d: Displacement): string {
  return `${d.dx},${d.dy}`;
}

export function contextKey(fromCell: Cell, prev: Displacement): string {
  return `${cellKey(fromCell)}|${displacementKey(prev)}`;
}

export interface Hop {
  turn: number;
  from: Cell;
  to: Cell;
  /** Displacement of the PRIOR hop in the same cast; `null` for a cast's first hop (turn 0). */
  prev: Displacement | null;
}

/**
 * Walks one cast's trajectory into its ordered hops, each carrying the
 * displacement of the hop immediately before it (within the SAME cast —
 * CODEXIMPROVE #3's requirement 1, and `Cast.start`/`byTurn` already come
 * from `groupByCast`'s own turn-sorted-per-cast grouping, so this never
 * crosses a cast boundary). Assumes `cast` has already passed
 * `isCleanCast` — a gapped cast simply stops at the first missing turn
 * rather than throwing, since callers that need the guarantee already
 * filter with `isCleanCast` before reaching here.
 */
export function castHops(cast: Cast): Hop[] {
  const hops: Hop[] = [];
  let from = cast.start;
  let prevDisplacement: Displacement | null = null;
  for (let t = 0; t <= cast.maxTurn; t++) {
    const to = cast.byTurn.get(t);
    if (!to) break;
    hops.push({ turn: t, from, to, prev: prevDisplacement });
    prevDisplacement = { dx: to.x - from.x, dy: to.y - from.y };
    from = to;
  }
  return hops;
}

export interface ContextStats {
  /** Every `to` cell observed at this (cell, previous-displacement) key, across casts. */
  observations: Cell[];
  /** Distinct casts contributing at least one observation to this key — the gating unit, not raw transition count. */
  castIds: Set<string>;
}

/** Builds the contextual empirical map: `${cellKey(from)}|${dx},${dy}` -> observed next cells + contributing cast ids. Turn-0 hops (no previous displacement) contribute nothing here — see this file's header. */
export function buildContextualMap(casts: readonly Cast[]): Map<string, ContextStats> {
  const map = new Map<string, ContextStats>();
  for (const cast of casts) {
    for (const hop of castHops(cast)) {
      if (!hop.prev) continue;
      const key = contextKey(hop.from, hop.prev);
      const stats = map.get(key) ?? { observations: [], castIds: new Set<string>() };
      stats.observations.push(hop.to);
      stats.castIds.add(cast.castId);
      map.set(key, stats);
    }
  }
  return map;
}

/** Builds the cell-only empirical map (`matcher.ts`'s `emptyFallback` log shape) directly from grouped casts — every hop counts, including turn-0 hops that the contextual map above excludes. */
export function buildCellOnlyMap(casts: readonly Cast[]): Map<string, Cell[]> {
  const map = new Map<string, Cell[]>();
  for (const cast of casts) {
    for (const hop of castHops(cast)) {
      const key = cellKey(hop.from);
      const arr = map.get(key) ?? [];
      arr.push(hop.to);
      map.set(key, arr);
    }
  }
  return map;
}

/**
 * [session 38, CODEXAUDIT #2] `DEFAULT_MIN_INDEPENDENT_CASTS`'s hard
 * threshold is RETIRED — leave-one-cast-out CV against the real corpus
 * showed it regressing log loss versus cell-only-forever (6.151 vs. 5.860,
 * DECISIONS.md 2026-08-18/session 36) despite winning on top-1/Brier,
 * because a hard switch assigns exactly zero probability to any cell
 * outside a thin sample the instant the threshold clears, and `chooseCard`
 * consumes the whole distribution, not just top-1. Continuous shrinkage
 * (below) REPLACES it rather than sitting alongside it as a second gate —
 * one smoothing mechanism, not two overlapping ones — per this session's
 * brief.
 *
 * `1` is picked from `scripts/fishingContextualCV.ts`'s leave-one-cast-out
 * sweep over shrinkageK in {0.25 .. 1000} against the real corpus (49
 * clean casts / 165 hops, same corpus session 33/36 measured against):
 * logLoss and Brier both bottom out in a flat plateau across roughly
 * [0.6, 1.5] (logLoss 5.700-5.707, Brier 0.851-0.858), with `shrinkageK=1`
 * landing at the logLoss minimum (5.700) and within 0.001 of the Brier
 * minimum (0.852 vs. 0.851 at 1.1) — `n / (n + 1)` is also the simplest
 * value in that plateau to reason about (the classic add-one/Laplace
 * shrinkage weight), so there is no reason to pick a less legible number
 * a few thousandths better on one metric and worse on the other. This
 * CLEARS the session's gate with room to spare: logLoss 5.700 and Brier
 * 0.852 both beat the cell-only baseline (5.860 / 0.932) — not a
 * best-of-a-bad-set pick the way `DEFAULT_MIN_INDEPENDENT_CASTS=3` was.
 * Every value from 0.4 through 3 in the sweep also clears both baselines;
 * only past shrinkageK≈3 does top-1 start giving up ground, and past ~30
 * the mixed distribution converges back to indistinguishable-from-cell-only
 * (by construction: weight → 0 as shrinkageK → ∞ for any realistic n).
 * See that script's printed table for the full sweep.
 */
export const DEFAULT_SHRINKAGE_K = 1;

export interface ContextualFallbackOptions {
  /**
   * Shrinkage strength: the context tier's weight at `n` supporting casts
   * is `n / (n + shrinkageK)`, so it starts near 0 at `n = 1` and rises
   * toward 1 as `n` grows, never hard-switching. A very large value (or
   * `Number.POSITIVE_INFINITY`) makes the weight ~0 for any realistic `n`,
   * i.e. disables the context tier's live contribution entirely — the
   * explicit escape hatch this session's gate requires if no finite
   * `shrinkageK` beats the cell-only baseline on the real corpus.
   */
  shrinkageK: number;
}

export const DEFAULT_CONTEXTUAL_FALLBACK_OPTIONS: ContextualFallbackOptions = {
  shrinkageK: DEFAULT_SHRINKAGE_K,
};

/**
 * The displacement of the most recent hop in a position history (e.g.
 * `MatcherState.history`), or `null` before any hop has happened. Shared by
 * `src/sim/fishing/castSim.ts` (the simulator ablation) and
 * `scripts/liveFishing.ts` (live wiring) — both need "what was the previous
 * displacement" from the same kind of `Cell[]` history, so this lives here
 * once rather than twice.
 */
export function previousDisplacement(history: readonly Cell[]): Displacement | null {
  if (history.length < 2) return null;
  const a = history[history.length - 2]!;
  const b = history[history.length - 1]!;
  return { dx: b.x - a.x, dy: b.y - a.y };
}

/**
 * The hierarchical backoff itself (this file's header, tiers 1-3). `prev`
 * is `null` for a cast's first hop — that turn skips straight to tier 2
 * (cell-only), same as brief requirement 7's turn-0 regression test asks
 * for. When there IS a previous displacement and the context key has any
 * support at all (`n >= 1`), the context and cell-only distributions are
 * mixed by `n / (n + shrinkageK)` rather than the old hard threshold — at
 * `n = 0` (no support for this exact key) this collapses to pure cell-only,
 * same as before shrinkage existed.
 */
export function contextualFallback(
  fromCell: Cell,
  prev: Displacement | null,
  contextMap: ReadonlyMap<string, ContextStats>,
  cellOnlyLog: ReadonlyMap<string, readonly Cell[]>,
  gridSize: number,
  opts: ContextualFallbackOptions = DEFAULT_CONTEXTUAL_FALLBACK_OPTIONS,
): Map<string, { cell: Cell; p: number }> {
  const cellOnlyDist = emptyFallback(fromCell, cellOnlyLog, gridSize);
  if (!prev) return cellOnlyDist;
  const stats = contextMap.get(contextKey(fromCell, prev));
  const n = stats?.castIds.size ?? 0;
  if (n === 0) return cellOnlyDist;
  const contextDist = distributionFromMultiset(stats!.observations);
  const weight = n / (n + opts.shrinkageK);
  return mixDistributions(contextDist, cellOnlyDist, weight);
}
