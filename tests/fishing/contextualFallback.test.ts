/**
 * tests/fishing/contextualFallback.test.ts — [session 33, CODEXIMPROVE #3]
 * regression coverage for the previous-direction contextual fallback tier.
 * Built entirely from in-memory `Cast` objects (no real
 * `data/fish-patterns.jsonl` reads) — same discipline as
 * `tests/mineFishPatterns.test.ts`: this is gitignored real live-play data,
 * not a fixture, and CLAUDE.md's working-style rule requires tests to never
 * touch a real `data/` path, so nothing here does.
 */

import { describe, expect, it } from "vitest";

import type { Cell } from "../../src/sim/fishing/geometry.js";
import { cellKey } from "../../src/sim/fishing/geometry.js";
import type { Cast } from "../../src/sim/fishing/transitionCorpus.js";
import {
  buildCellOnlyMap,
  buildContextualMap,
  castHops,
  contextKey,
  contextualFallback,
} from "../../src/strategy/fishing/contextualFallback.js";
import { emptyFallback } from "../../src/strategy/fishing/matcher.js";

function cast(castId: string, gridSize: number, start: Cell, path: Cell[]): Cast {
  const byTurn = new Map<number, Cell>();
  path.forEach((c, i) => byTurn.set(i, c));
  return { castId, gridSize, start, byTurn, maxTurn: path.length - 1, duplicateTurns: [], hasGaps: false };
}

describe("castHops", () => {
  it("a cast's first hop (turn 0) has no previous displacement", () => {
    const c = cast("c1", 4, { x: 1, y: 1 }, [{ x: 1, y: 2 }, { x: 2, y: 2 }]);
    const hops = castHops(c);
    expect(hops[0]!.prev).toBeNull();
    expect(hops[1]!.prev).toEqual({ dx: 0, dy: 1 }); // turn 0 moved (1,1) -> (1,2), i.e. dy=+1
  });
});

describe("contextual backoff — genuinely predictive previous direction", () => {
  // Two groups of casts both pass through (2,2), but from opposite prior
  // directions, and each group is perfectly consistent about what it does
  // next. Cell-only at (2,2) can only see the 50/50 blend of both groups;
  // the context tier resolves each group's continuation exactly — this is
  // precisely the ambiguity CODEXIMPROVE #3 is meant to break.
  const casts: Cast[] = [
    // Group A: arrives at (2,2) moving +1x (from (1,2)), always continues to (3,2).
    cast("groupA-1", 4, { x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]),
    cast("groupA-2", 4, { x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]),
    cast("groupA-3", 4, { x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]),
    // Group B: arrives at (2,2) moving +1y (from (2,1)), always goes back to (2,1).
    cast("groupB-1", 4, { x: 2, y: 1 }, [{ x: 2, y: 2 }, { x: 2, y: 1 }]),
    cast("groupB-2", 4, { x: 2, y: 1 }, [{ x: 2, y: 2 }, { x: 2, y: 1 }]),
    cast("groupB-3", 4, { x: 2, y: 1 }, [{ x: 2, y: 2 }, { x: 2, y: 1 }]),
  ];

  it("buildContextualMap gates support by DISTINCT CASTS, not raw transition count", () => {
    const map = buildContextualMap(casts);
    const keyA = contextKey({ x: 2, y: 2 }, { dx: 1, dy: 0 });
    const statsA = map.get(keyA);
    expect(statsA).toBeDefined();
    expect(statsA!.castIds.size).toBe(3);
    expect(statsA!.observations.every((c) => cellKey(c) === "3,2")).toBe(true);
  });

  it("cell-only alone can only see the blended 50/50 ambiguity", () => {
    const cellMap = buildCellOnlyMap(casts);
    const cellOnlyDist = emptyFallback({ x: 2, y: 2 }, cellMap, 4);
    expect(cellOnlyDist.get("3,2")?.p).toBeCloseTo(0.5);
    expect(cellOnlyDist.get("2,1")?.p).toBeCloseTo(0.5);
  });

  it("the hierarchical backoff resolves the ambiguity once support clears the threshold, for EACH direction independently", () => {
    const contextMap = buildContextualMap(casts);
    const cellMap = buildCellOnlyMap(casts);
    const distA = contextualFallback({ x: 2, y: 2 }, { dx: 1, dy: 0 }, contextMap, cellMap, 4, {
      minIndependentCasts: 3,
    });
    expect(distA.size).toBe(1);
    expect(distA.get("3,2")?.p).toBeCloseTo(1);

    const distB = contextualFallback({ x: 2, y: 2 }, { dx: 0, dy: 1 }, contextMap, cellMap, 4, {
      minIndependentCasts: 3,
    });
    expect(distB.size).toBe(1);
    expect(distB.get("2,1")?.p).toBeCloseTo(1);
  });
});

describe("contextual backoff — no genuine signal (support never clears threshold)", () => {
  // Each cast visits a DIFFERENT (cell, previous-displacement) combination
  // exactly once — no key ever gets more than 1 independent cast of support,
  // so the context tier must never fire regardless of what it "would" predict.
  const casts: Cast[] = [
    cast("solo-1", 4, { x: 1, y: 1 }, [{ x: 2, y: 1 }, { x: 3, y: 1 }]),
    cast("solo-2", 4, { x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 2, y: 3 }]),
    cast("solo-3", 4, { x: 1, y: 3 }, [{ x: 2, y: 3 }, { x: 2, y: 4 }]),
  ];

  it("stays below threshold for every key, so the shipped predictor never uses the context tier", () => {
    const contextMap = buildContextualMap(casts);
    for (const stats of contextMap.values()) {
      expect(stats.castIds.size).toBeLessThan(3);
    }
  });

  it("contextualFallback falls through to cell-only, byte-for-byte identical to emptyFallback directly", () => {
    const contextMap = buildContextualMap(casts);
    const cellMap = buildCellOnlyMap(casts);
    for (const c of casts) {
      for (const hop of castHops(c)) {
        if (!hop.prev) continue;
        const hierarchical = contextualFallback(hop.from, hop.prev, contextMap, cellMap, 4, { minIndependentCasts: 3 });
        const cellOnly = emptyFallback(hop.from, cellMap, 4);
        expect([...hierarchical.entries()]).toEqual([...cellOnly.entries()]);
      }
    }
  });
});

describe("turn-0 hops skip straight to the cell-only tier", () => {
  const casts: Cast[] = [
    cast("a", 4, { x: 1, y: 1 }, [{ x: 2, y: 1 }]),
    cast("b", 4, { x: 1, y: 1 }, [{ x: 1, y: 2 }]),
    cast("c", 4, { x: 1, y: 1 }, [{ x: 2, y: 1 }]),
  ];

  it("a turn-0 hop has prev = null and never queries the context map, regardless of support elsewhere", () => {
    const contextMap = buildContextualMap(casts); // empty — no hop in this corpus has a previous displacement
    expect(contextMap.size).toBe(0);
    const cellMap = buildCellOnlyMap(casts);
    const dist = contextualFallback({ x: 1, y: 1 }, null, contextMap, cellMap, 4, { minIndependentCasts: 1 });
    // 2/3 to (2,1), 1/3 to (1,2) — exactly the cell-only empirical split.
    expect(dist.get("2,1")?.p).toBeCloseTo(2 / 3);
    expect(dist.get("1,2")?.p).toBeCloseTo(1 / 3);
  });
});

describe("uniform last-resort tier is unaffected when both cell-only and context are empty", () => {
  it("an unvisited cell with no context and no cell-only data falls all the way to uniform", () => {
    const dist = contextualFallback({ x: 4, y: 4 }, { dx: 1, dy: 0 }, new Map(), new Map(), 2, {
      minIndependentCasts: 3,
    });
    expect(dist.size).toBe(4); // 2x2 grid
    for (const { p } of dist.values()) expect(p).toBeCloseTo(0.25);
  });
});
