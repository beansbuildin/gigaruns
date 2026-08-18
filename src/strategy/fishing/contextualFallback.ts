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
 * spec, requirement 3):
 *   1. current cell + previous displacement, gated on
 *      `minIndependentCasts` distinct casts contributing to that exact key
 *      (not just raw transition count — one cast revisiting the same
 *      (cell, displacement) combo on a short cycle must not look like
 *      independent evidence).
 *   2. current cell only (`matcher.ts`'s existing `emptyFallback`,
 *      unchanged) — used both when there's no previous displacement (a
 *      cast's first hop) and when the context tier lacks support.
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
import { distributionFromMultiset, emptyFallback } from "./matcher.js";

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
 * Minimum distinct casts required before the context tier is trusted over
 * cell-only. [session 33] Chosen empirically via `scripts/
 * fishingContextualCV.ts`'s leave-one-cast-out sweep over {2, 3, 4} against
 * the real corpus — see that script's printed comparison for the actual
 * numbers this value was picked from. Same reasoning shape as
 * `mineFishPatterns.ts`'s `PROMOTION_THRESHOLD`: this is evidence for a
 * SPECIFIC (cell, displacement) combination reappearing across independent
 * casts, not a noisy proc-chance rate, so it does not need the project's
 * usual ~30-observation floor (DECISIONS.md 2026-08-15/16) — but it does
 * need more than "it happened once," which is what raw transition-count
 * gating would allow a single repeating cast to fake.
 */
export const DEFAULT_MIN_INDEPENDENT_CASTS = 3;

export interface ContextualFallbackOptions {
  minIndependentCasts: number;
}

export const DEFAULT_CONTEXTUAL_FALLBACK_OPTIONS: ContextualFallbackOptions = {
  minIndependentCasts: DEFAULT_MIN_INDEPENDENT_CASTS,
};

/**
 * The hierarchical backoff itself (this file's header, tiers 1-3). `prev`
 * is `null` for a cast's first hop — that turn skips straight to tier 2
 * (cell-only), same as brief requirement 7's turn-0 regression test asks
 * for.
 */
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

export function contextualFallback(
  fromCell: Cell,
  prev: Displacement | null,
  contextMap: ReadonlyMap<string, ContextStats>,
  cellOnlyLog: ReadonlyMap<string, readonly Cell[]>,
  gridSize: number,
  opts: ContextualFallbackOptions = DEFAULT_CONTEXTUAL_FALLBACK_OPTIONS,
): Map<string, { cell: Cell; p: number }> {
  if (prev) {
    const stats = contextMap.get(contextKey(fromCell, prev));
    if (stats && stats.castIds.size >= opts.minIndependentCasts) {
      return distributionFromMultiset(stats.observations);
    }
  }
  return emptyFallback(fromCell, cellOnlyLog, gridSize);
}
