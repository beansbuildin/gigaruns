/**
 * src/strategy/fishing/matcher.ts — hypothesis-elimination pattern matcher.
 *
 * Implements SPEC.md §5's "Hypothesis elimination": pure functions, no
 * network, no game logic beyond narrowing a candidate set and reading off a
 * distribution. Strategy modules stay free of network calls per CLAUDE.md's
 * working-style rule — this is why `Candidate` is deliberately abstract
 * (a turn -> Cell function), not tied to `src/sim/fishing/patterns.ts`'s
 * synthetic library: the real matcher (Task 9) plugs in real named patterns
 * mined from `data/fish-patterns.jsonl` through the exact same interface.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { cellKey } from "../../sim/fishing/geometry.js";

export interface Candidate {
  id: string;
  /** Deterministic position at turn `t` (0 = the cast's starting cell). */
  predict(turn: number): Cell;
}

export interface MatcherState {
  /** Hypotheses still consistent with every observation so far. */
  readonly candidates: readonly Candidate[];
  /** Next turn index to be resolved — candidates already match turns [0, turn). */
  readonly turn: number;
  readonly history: readonly Cell[];
}

export function initMatcher(candidates: readonly Candidate[], startCell: Cell): MatcherState {
  return { candidates, turn: 1, history: [startCell] };
}

/**
 * Narrow the candidate set with a new observation (the fish's actual cell
 * at `state.turn`). Pure: returns a new state, never mutates.
 *
 * Per SPEC.md §5, narrowing is monotonic — `candidates` can only shrink or
 * stay the same size turn over turn, and it can reach zero (see
 * `emptyFallback`).
 */
export function observe(state: MatcherState, observedCell: Cell): MatcherState {
  const survivors = state.candidates.filter(
    (c) => cellKey(c.predict(state.turn)) === cellKey(observedCell),
  );
  return {
    candidates: survivors,
    turn: state.turn + 1,
    history: [...state.history, observedCell],
  };
}

/** P(next = c) over the live candidate set, as counts / |H|. Empty map if |H| == 0. */
export function predictDistribution(state: MatcherState): Map<string, { cell: Cell; p: number }> {
  const n = state.candidates.length;
  const out = new Map<string, { cell: Cell; p: number }>();
  if (n === 0) return out;
  for (const c of state.candidates) {
    const cell = c.predict(state.turn);
    const key = cellKey(cell);
    const existing = out.get(key);
    out.set(key, { cell, p: (existing?.p ?? 0) + 1 / n });
  }
  return out;
}

export function isConverged(state: MatcherState): boolean {
  return state.candidates.length === 1;
}

/**
 * `H` hit zero: the library is incomplete for this cast (SPEC.md §5). Fall
 * back to the empirical distribution over every logged transition FROM the
 * given cell, across all casts ever recorded — not just this one. `log`
 * maps a cell key to the multiset of cells the fish was observed moving to
 * from there. Uniform-over-grid is the last resort when even that is empty,
 * clearly worse than a real distribution but never a crash.
 */
export function emptyFallback(
  fromCell: Cell,
  log: ReadonlyMap<string, readonly Cell[]>,
  gridSize: number,
): Map<string, { cell: Cell; p: number }> {
  const observed = log.get(cellKey(fromCell));
  const out = new Map<string, { cell: Cell; p: number }>();
  if (observed && observed.length > 0) {
    for (const cell of observed) {
      const key = cellKey(cell);
      const existing = out.get(key);
      out.set(key, { cell, p: (existing?.p ?? 0) + 1 / observed.length });
    }
    return out;
  }
  const cells: Cell[] = [];
  for (let x = 1; x <= gridSize; x++) for (let y = 1; y <= gridSize; y++) cells.push({ x, y });
  for (const cell of cells) out.set(cellKey(cell), { cell, p: 1 / cells.length });
  return out;
}
