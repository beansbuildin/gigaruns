/**
 * tests/fishing/matcher.test.ts — hypothesis elimination, per SPEC.md §5.
 *
 * The oracle candidate below reproduces the real captured cast's exact
 * position sequence (`fixtures/fishing-casts/cast.json`, decoded via
 * SPEC-fishing.md §4's column-major cell encoding): start [4,2], then
 * [4,3] [4,4] [3,4] [3,3] [4,3]. Real data, not invented — the decoys
 * around it are synthetic, standing in for "the library has other
 * hypotheses too."
 */

import { describe, expect, it } from "vitest";

import type { Cell } from "../../src/sim/fishing/geometry.js";
import { cellKey } from "../../src/sim/fishing/geometry.js";
import {
  emptyFallback,
  initMatcher,
  isConverged,
  observe,
  predictDistribution,
  type Candidate,
} from "../../src/strategy/fishing/matcher.js";

const REAL_SEQUENCE: Cell[] = [
  { x: 4, y: 2 },
  { x: 4, y: 3 },
  { x: 4, y: 4 },
  { x: 3, y: 4 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
];

function oracle(): Candidate {
  return { id: "oracle", predict: (t) => REAL_SEQUENCE[t] ?? REAL_SEQUENCE[REAL_SEQUENCE.length - 1]! };
}

/** A decoy that agrees with the oracle for `agreeUntil` turns, then diverges forever. */
function decoy(name: string, agreeUntil: number): Candidate {
  return {
    id: name,
    predict: (t) => {
      if (t < agreeUntil) return REAL_SEQUENCE[t]!;
      return { x: 1, y: 1 }; // a cell the real sequence never visits at any turn >= agreeUntil
    },
  };
}

describe("hypothesis elimination", () => {
  it("narrows monotonically and never grows", () => {
    const candidates = [oracle(), decoy("d1", 1), decoy("d2", 2), decoy("d3", 3), decoy("d4", 4)];
    let state = initMatcher(candidates, REAL_SEQUENCE[0]!);
    let prevSize = state.candidates.length;
    for (let t = 1; t < REAL_SEQUENCE.length; t++) {
      state = observe(state, REAL_SEQUENCE[t]!);
      expect(state.candidates.length).toBeLessThanOrEqual(prevSize);
      prevSize = state.candidates.length;
    }
    // The oracle matches every real turn by construction — it must survive.
    expect(state.candidates.some((c) => c.id === "oracle")).toBe(true);
  });

  it("converges to |H| == 1 and then predicts the real next cell correctly", () => {
    // Decoys diverge at turn 1 — H should collapse to {oracle} immediately.
    const candidates = [oracle(), decoy("d1", 1), decoy("d2", 1)];
    let state = initMatcher(candidates, REAL_SEQUENCE[0]!);
    state = observe(state, REAL_SEQUENCE[1]!);
    expect(isConverged(state)).toBe(true);

    const dist = predictDistribution(state);
    expect(dist.size).toBe(1);
    const only = [...dist.values()][0]!;
    expect(only.p).toBeCloseTo(1);
    expect(only.cell).toEqual(REAL_SEQUENCE[2]);

    // And it keeps being right for the rest of the real cast.
    for (let t = 2; t < REAL_SEQUENCE.length; t++) {
      const d = predictDistribution(state);
      const predicted = [...d.values()][0]!.cell;
      expect(predicted).toEqual(REAL_SEQUENCE[t]);
      state = observe(state, REAL_SEQUENCE[t]!);
    }
  });

  it("hits |H| == 0 when every candidate is wrong, and falls back cleanly", () => {
    const candidates = [decoy("d1", 0), decoy("d2", 0)];
    let state = initMatcher(candidates, REAL_SEQUENCE[0]!);
    state = observe(state, REAL_SEQUENCE[1]!); // neither decoy predicts this
    expect(state.candidates.length).toBe(0);
    expect(predictDistribution(state).size).toBe(0);

    // Empty log -> uniform fallback over the grid, still a valid distribution.
    const fallback = emptyFallback(REAL_SEQUENCE[1]!, new Map(), 4);
    expect(fallback.size).toBe(16);
    let total = 0;
    for (const { p } of fallback.values()) total += p;
    expect(total).toBeCloseTo(1);

    // A non-empty log narrows the fallback to what was actually observed.
    const log = new Map([[cellKey(REAL_SEQUENCE[1]!), [REAL_SEQUENCE[2]!, REAL_SEQUENCE[2]!]]]);
    const informed = emptyFallback(REAL_SEQUENCE[1]!, log, 4);
    expect(informed.size).toBe(1);
    expect([...informed.values()][0]!.p).toBeCloseTo(1);
  });
});
