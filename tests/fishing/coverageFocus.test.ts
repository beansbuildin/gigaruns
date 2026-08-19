/**
 * tests/fishing/coverageFocus.test.ts — [session 50, brief §2]
 *
 * The expected-coverage focus objective. The load-bearing assertion is the
 * first one: the forward simulation at horizon 1 must reproduce
 * `stickyStepDistribution` EXACTLY. If it does not, every coverage number the
 * sweep prints is measuring a second, undocumented movement model rather than
 * the one that ships — which is precisely the class of error session 49 spent
 * a session diagnosing.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_COVERAGE_HORIZON,
  chooseCoverageFocus,
  coverageHorizon,
  covers,
  expectedCoverage,
  forwardCellDistributions,
} from "../../src/strategy/fishing/coverageFocus.js";
import {
  buildStepClassTable,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  type StepClassTable,
} from "../../src/strategy/fishing/stepClass.js";
import { cellKey, type Cell } from "../../src/sim/fishing/geometry.js";
import type { Cast } from "../../src/sim/fishing/transitionCorpus.js";

const GRID = 4;

function cast(castId: string, cells: readonly [number, number][]): Cast {
  const byTurn = new Map<number, Cell>();
  for (let i = 1; i < cells.length; i++) byTurn.set(i - 1, { x: cells[i]![0], y: cells[i]![1] });
  return {
    castId,
    gridSize: GRID,
    start: { x: cells[0]![0], y: cells[0]![1] },
    byTurn,
    maxTurn: cells.length - 2,
    duplicateTurns: [],
    hasGaps: false,
  };
}

/** A small k=1 corpus with a real prev-delta conditional, so the table is not degenerate. */
function table(): StepClassTable {
  return buildStepClassTable([
    cast("a", [
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 4],
    ]),
    cast("b", [
      [3, 1],
      [3, 2],
      [3, 3],
      [2, 3],
    ]),
    cast("c", [
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2],
    ]),
  ]);
}

describe("covers — the 3x3 zone window", () => {
  it("is the Chebyshev-1 neighbourhood, diagonals included", () => {
    const f: Cell = { x: 2, y: 2 };
    expect(covers(f, { x: 2, y: 2 })).toBe(true);
    expect(covers(f, { x: 1, y: 1 })).toBe(true);
    expect(covers(f, { x: 3, y: 3 })).toBe(true);
    expect(covers(f, { x: 2, y: 4 })).toBe(false);
    expect(covers(f, { x: 4, y: 2 })).toBe(false);
  });
});

describe("forwardCellDistributions", () => {
  it("reproduces stickyStepDistribution exactly at horizon 1", () => {
    const t = table();
    const cell: Cell = { x: 2, y: 2 };
    const prevDelta = { dx: 0, dy: 1 };
    const sticky = stickyStepDistribution(cell, 1, prevDelta, t, GRID, DEFAULT_RING_MODEL_OPTIONS, 0.05);
    const forward = forwardCellDistributions(cell, 1, prevDelta, t, GRID, 1, DEFAULT_RING_MODEL_OPTIONS, 0.05);
    expect(forward).toHaveLength(1);
    const got = forward[0]!;
    // Compared over the UNION of keys. `mixDistributions` keeps explicit
    // zero-probability entries for cells present in only one of the mixed
    // maps; the forward sim drops zero-weight branches. Same distribution,
    // different bookkeeping — so compare the values, not the key sets.
    for (const key of new Set([...sticky.keys(), ...got.keys()])) {
      expect(got.get(key)?.p ?? 0).toBeCloseTo(sticky.get(key)?.p ?? 0, 12);
    }
  });

  it("reproduces the unknown-class case at horizon 1 too", () => {
    const t = table();
    const cell: Cell = { x: 2, y: 2 };
    const sticky = stickyStepDistribution(cell, null, null, t, GRID, DEFAULT_RING_MODEL_OPTIONS, 0.05);
    const got = forwardCellDistributions(cell, null, null, t, GRID, 1, DEFAULT_RING_MODEL_OPTIONS, 0.05)[0]!;
    for (const key of new Set([...sticky.keys(), ...got.keys()])) {
      expect(got.get(key)?.p ?? 0).toBeCloseTo(sticky.get(key)?.p ?? 0, 12);
    }
  });

  it("returns one normalized distribution per horizon step", () => {
    const t = table();
    const out = forwardCellDistributions({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, t, GRID, 3);
    expect(out).toHaveLength(3);
    for (const d of out) {
      const total = [...d.values()].reduce((a, v) => a + v.p, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it("spreads mass further out as the horizon grows", () => {
    const t = table();
    const out = forwardCellDistributions({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, t, GRID, 3);
    expect(out[2]!.size).toBeGreaterThan(out[0]!.size);
  });

  it("returns nothing at horizon 0", () => {
    expect(forwardCellDistributions({ x: 2, y: 2 }, 1, null, table(), GRID, 0)).toEqual([]);
  });
});

describe("expectedCoverage", () => {
  it("sums over the horizon rather than averaging — two covered turns beat one", () => {
    const d = new Map([[cellKey({ x: 2, y: 2 }), { cell: { x: 2, y: 2 }, p: 1 }]]);
    expect(expectedCoverage({ x: 2, y: 2 }, [d])).toBeCloseTo(1, 12);
    expect(expectedCoverage({ x: 2, y: 2 }, [d, d])).toBeCloseTo(2, 12);
  });

  it("is zero for a focus whose window excludes all the mass", () => {
    const d = new Map([[cellKey({ x: 4, y: 4 }), { cell: { x: 4, y: 4 }, p: 1 }]]);
    expect(expectedCoverage({ x: 1, y: 1 }, [d])).toBe(0);
  });
});

describe("chooseCoverageFocus", () => {
  it("picks the reachable window containing the most forward mass", () => {
    const d = new Map([[cellKey({ x: 4, y: 4 }), { cell: { x: 4, y: 4 }, p: 1 }]]);
    const choice = chooseCoverageFocus({ current: { x: 2, y: 2 }, remaining: 3 }, GRID, [d]);
    expect(covers(choice.focus, { x: 4, y: 4 })).toBe(true);
    expect(choice.coverage).toBeCloseTo(1, 12);
  });

  it("never exceeds the meter — an unreachable optimum is simply not offered", () => {
    const d = new Map([[cellKey({ x: 4, y: 4 }), { cell: { x: 4, y: 4 }, p: 1 }]]);
    const choice = chooseCoverageFocus({ current: { x: 1, y: 1 }, remaining: 1 }, GRID, [d]);
    expect(Math.abs(choice.focus.x - 1) + Math.abs(choice.focus.y - 1)).toBeLessThanOrEqual(1);
  });

  it("breaks coverage ties toward the CHEAPER move", () => {
    // A flat distribution over the whole grid: every placement in the central
    // 2x2 covers the same mass, so only the move cost separates them.
    const d = new Map<string, { cell: Cell; p: number }>();
    for (let x = 1; x <= GRID; x++) for (let y = 1; y <= GRID; y++) d.set(cellKey({ x, y }), { cell: { x, y }, p: 1 / 16 });
    const choice = chooseCoverageFocus({ current: { x: 2, y: 2 }, remaining: 3 }, GRID, [d]);
    expect(choice.moveCost).toBe(0);
  });

  it("always has a placement — staying put is in the search space at zero budget", () => {
    const choice = chooseCoverageFocus({ current: { x: 3, y: 1 }, remaining: 0 }, GRID, [new Map()]);
    expect(choice.focus).toEqual({ x: 3, y: 1 });
    expect(choice.moveCost).toBe(0);
  });
});

describe("coverageHorizon", () => {
  it("clamps the cap by how many turns the cast plausibly has left", () => {
    expect(coverageHorizon(DEFAULT_COVERAGE_HORIZON, 1)).toBe(1);
    expect(coverageHorizon(DEFAULT_COVERAGE_HORIZON, 10)).toBe(DEFAULT_COVERAGE_HORIZON);
    expect(coverageHorizon(3, 0)).toBe(1);
  });
});
