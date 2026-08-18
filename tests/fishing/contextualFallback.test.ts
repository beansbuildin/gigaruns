/**
 * tests/fishing/contextualFallback.test.ts — [session 33, CODEXIMPROVE #3]
 * regression coverage for the previous-direction contextual fallback tier;
 * [session 38, CODEXAUDIT #2] rewritten for continuous shrinkage, which
 * replaced the original hard `minIndependentCasts` threshold. Built entirely
 * from in-memory `Cast` objects (no real `data/fish-patterns.jsonl` reads) —
 * same discipline as `tests/mineFishPatterns.test.ts`: this is gitignored
 * real live-play data, not a fixture, and CLAUDE.md's working-style rule
 * requires tests to never touch a real `data/` path, so nothing here does.
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
import { emptyFallback, mixDistributions } from "../../src/strategy/fishing/matcher.js";

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

describe("mixDistributions", () => {
  it("mixes two distributions with disjoint keys by the given weight", () => {
    const a = new Map([["1,1", { cell: { x: 1, y: 1 }, p: 1 }]]);
    const b = new Map([["2,2", { cell: { x: 2, y: 2 }, p: 1 }]]);
    const mixed = mixDistributions(a, b, 0.3);
    expect(mixed.get("1,1")?.p).toBeCloseTo(0.3);
    expect(mixed.get("2,2")?.p).toBeCloseTo(0.7);
  });

  it("renormalizes when the inputs don't individually sum to 1", () => {
    // Neither map is a complete distribution on its own (each sums to 0.5) —
    // the raw mix at weight 0.5 would sum to 0.5, not 1.
    const a = new Map([["1,1", { cell: { x: 1, y: 1 }, p: 0.5 }]]);
    const b = new Map([["2,2", { cell: { x: 2, y: 2 }, p: 0.5 }]]);
    const mixed = mixDistributions(a, b, 0.5);
    const total = [...mixed.values()].reduce((sum, { p }) => sum + p, 0);
    expect(total).toBeCloseTo(1);
    expect(mixed.get("1,1")?.p).toBeCloseTo(0.5);
    expect(mixed.get("2,2")?.p).toBeCloseTo(0.5);
  });
});

describe("continuous shrinkage — weight scales with support (n) and shrinkageK", () => {
  // Two groups of casts both pass through (2,2), but from opposite prior
  // directions, and each group is perfectly consistent about what it does
  // next. Cell-only at (2,2) can only see the 50/50 blend of both groups;
  // the context tier resolves each group's continuation exactly. With a
  // hard threshold this either fires fully or not at all; with shrinkage it
  // nudges the cell-only 50/50 split toward whichever group's continuation
  // matches, by an amount that grows with support and shrinks with
  // `shrinkageK`.
  function groupCasts(nEach: number): Cast[] {
    const casts: Cast[] = [];
    for (let i = 0; i < nEach; i++) {
      // Group A: arrives at (2,2) moving +1x (from (1,2)), always continues to (3,2).
      casts.push(cast(`groupA-${i}`, 4, { x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]));
      // Group B: arrives at (2,2) moving +1y (from (2,1)), always goes back to (2,1).
      casts.push(cast(`groupB-${i}`, 4, { x: 2, y: 1 }, [{ x: 2, y: 2 }, { x: 2, y: 1 }]));
    }
    return casts;
  }

  it("buildContextualMap gates support by DISTINCT CASTS, not raw transition count", () => {
    const map = buildContextualMap(groupCasts(3));
    const keyA = contextKey({ x: 2, y: 2 }, { dx: 1, dy: 0 });
    const statsA = map.get(keyA);
    expect(statsA).toBeDefined();
    expect(statsA!.castIds.size).toBe(3);
    expect(statsA!.observations.every((c) => cellKey(c) === "3,2")).toBe(true);
  });

  it("cell-only alone can only see the blended 50/50 ambiguity", () => {
    const casts = groupCasts(3);
    const cellMap = buildCellOnlyMap(casts);
    const cellOnlyDist = emptyFallback({ x: 2, y: 2 }, cellMap, 4);
    expect(cellOnlyDist.get("3,2")?.p).toBeCloseTo(0.5);
    expect(cellOnlyDist.get("2,1")?.p).toBeCloseTo(0.5);
  });

  it("small n relative to shrinkageK leans the mix toward cell-only, not the context tier", () => {
    // n = 3, shrinkageK = 27 -> weight = 3/30 = 0.1. Mixed p(3,2) should sit
    // close to the cell-only 0.5, only slightly nudged toward the context
    // tier's 1.0 — nowhere near the old hard-threshold's "resolves fully".
    const casts = groupCasts(3);
    const contextMap = buildContextualMap(casts);
    const cellMap = buildCellOnlyMap(casts);
    const dist = contextualFallback({ x: 2, y: 2 }, { dx: 1, dy: 0 }, contextMap, cellMap, 4, { shrinkageK: 27 });
    expect(dist.get("3,2")?.p).toBeCloseTo(0.1 * 1 + 0.9 * 0.5); // 0.55
    expect(dist.get("2,1")?.p).toBeCloseTo(0.9 * 0.5); // 0.45
  });

  it("large n relative to shrinkageK leans the mix toward the context distribution, for EACH direction independently", () => {
    // n = 20, shrinkageK = 1 (the shipped default) -> weight = 20/21 ≈ 0.952.
    const casts = groupCasts(20);
    const contextMap = buildContextualMap(casts);
    const cellMap = buildCellOnlyMap(casts);
    const distA = contextualFallback({ x: 2, y: 2 }, { dx: 1, dy: 0 }, contextMap, cellMap, 4, { shrinkageK: 1 });
    const weight = 20 / 21;
    expect(distA.get("3,2")?.p).toBeCloseTo(weight * 1 + (1 - weight) * 0.5);
    expect(distA.get("3,2")?.p).toBeGreaterThan(0.9);

    const distB = contextualFallback({ x: 2, y: 2 }, { dx: 0, dy: 1 }, contextMap, cellMap, 4, { shrinkageK: 1 });
    expect(distB.get("2,1")?.p).toBeCloseTo(weight * 1 + (1 - weight) * 0.5);
    expect(distB.get("2,1")?.p).toBeGreaterThan(0.9);
  });

  it("a single supporting cast (n=1) gets a soft nudge, not a full override", () => {
    // n = 1, shrinkageK = 1 (default) -> weight = 1/2 = 0.5, exactly halfway
    // between the cell-only 50/50 split and the context tier's certainty.
    const casts = groupCasts(1);
    const contextMap = buildContextualMap(casts);
    const cellMap = buildCellOnlyMap(casts);
    const dist = contextualFallback({ x: 2, y: 2 }, { dx: 1, dy: 0 }, contextMap, cellMap, 4, { shrinkageK: 1 });
    expect(dist.get("3,2")?.p).toBeCloseTo(0.75);
    expect(dist.get("2,1")?.p).toBeCloseTo(0.25);
  });
});

describe("no support at all (n=0) — collapses to cell-only regardless of shrinkageK", () => {
  // Each cast visits a DIFFERENT (cell, previous-displacement) combination
  // exactly once — every key's support is exactly 1 cast for ITS OWN key,
  // but querying a key with zero observed casts must fall straight through
  // to cell-only, same as before shrinkage existed.
  const casts: Cast[] = [
    cast("solo-1", 4, { x: 1, y: 1 }, [{ x: 2, y: 1 }, { x: 3, y: 1 }]),
    cast("solo-2", 4, { x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 2, y: 3 }]),
    cast("solo-3", 4, { x: 1, y: 3 }, [{ x: 2, y: 3 }, { x: 2, y: 4 }]),
  ];

  it("a context key with no observations at all falls through to cell-only, byte-for-byte", () => {
    const contextMap = buildContextualMap(casts);
    const cellMap = buildCellOnlyMap(casts);
    // (9,9) with displacement (5,5) was never observed anywhere in this corpus.
    const hierarchical = contextualFallback({ x: 9, y: 9 }, { dx: 5, dy: 5 }, contextMap, cellMap, 4, {
      shrinkageK: 1,
    });
    const cellOnly = emptyFallback({ x: 9, y: 9 }, cellMap, 4);
    expect([...hierarchical.entries()]).toEqual([...cellOnly.entries()]);
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
    const dist = contextualFallback({ x: 1, y: 1 }, null, contextMap, cellMap, 4);
    // 2/3 to (2,1), 1/3 to (1,2) — exactly the cell-only empirical split.
    expect(dist.get("2,1")?.p).toBeCloseTo(2 / 3);
    expect(dist.get("1,2")?.p).toBeCloseTo(1 / 3);
  });
});

describe("uniform last-resort tier is unaffected when both cell-only and context are empty", () => {
  it("an unvisited cell with no context and no cell-only data falls all the way to uniform", () => {
    const dist = contextualFallback({ x: 4, y: 4 }, { dx: 1, dy: 0 }, new Map(), new Map(), 2, {
      shrinkageK: 3,
    });
    expect(dist.size).toBe(4); // 2x2 grid
    for (const { p } of dist.values()) expect(p).toBeCloseTo(0.25);
  });
});
