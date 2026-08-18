/**
 * tests/fishing/heuristics.test.ts — session 43's four user-sourced fishing
 * heuristics concrete enough to implement directly (session-43 brief §3
 * a/d/e/f). All synthetic — none of these has a live cast fixture that
 * happens to exercise it yet (see each function's own header in
 * `heuristics.ts` for which claims are corpus-backed vs. purely geometric/
 * user-stated).
 */

import { describe, expect, it } from "vitest";

import type { Cell } from "../../src/sim/fishing/geometry.js";
import { cellKey } from "../../src/sim/fishing/geometry.js";
import type { Distribution, FishingCardLike } from "../../src/strategy/fishing/cardChoice.js";
import { candidateCellCount, coverageCount, isCentralSquare, pruneReturnToPrevious } from "../../src/strategy/fishing/heuristics.js";

function dist(entries: Array<[Cell, number]>): Distribution {
  const m = new Map<string, { cell: Cell; p: number }>();
  for (const [cell, p] of entries) m.set(cellKey(cell), { cell, p });
  return m;
}

describe("isCentralSquare — heuristic (a)", () => {
  it("is true for exactly the central 2x2 of a 4x4 grid (Dendren's confirmed gridSize)", () => {
    const central = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];
    for (const c of central) expect(isCentralSquare(c, 4), `${c.x},${c.y}`).toBe(true);
  });

  it("is false for every edge/corner cell of a 4x4 grid", () => {
    const edges = [
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 4, y: 3 },
    ];
    for (const c of edges) expect(isCentralSquare(c, 4), `${c.x},${c.y}`).toBe(false);
  });
});

describe("pruneReturnToPrevious — heuristic (d), NOT corpus-validated (see heuristics.ts header)", () => {
  it("zeroes the forbidden return cell after a 1-cell move and renormalizes the rest", () => {
    // Fish was at (2,2), moved 1 cell to (3,2) -- prev = {dx:1, dy:0}. The
    // forbidden return cell is (3,2) - (1,0) = (2,2), the cell it just left.
    const d = dist([
      [{ x: 2, y: 2 }, 0.4],
      [{ x: 3, y: 3 }, 0.3],
      [{ x: 4, y: 2 }, 0.3],
    ]);
    const pruned = pruneReturnToPrevious(d, { x: 3, y: 2 }, { dx: 1, dy: 0 });
    expect(pruned.has(cellKey({ x: 2, y: 2 }))).toBe(false);
    expect(pruned.get(cellKey({ x: 3, y: 3 }))!.p).toBeCloseTo(0.3 / 0.6);
    expect(pruned.get(cellKey({ x: 4, y: 2 }))!.p).toBeCloseTo(0.3 / 0.6);
    const total = [...pruned.values()].reduce((s, v) => s + v.p, 0);
    expect(total).toBeCloseTo(1);
  });

  it("leaves the distribution untouched after a 2-cell move — the rule only applies to 1-cell moves", () => {
    const d = dist([
      [{ x: 2, y: 2 }, 0.5],
      [{ x: 3, y: 3 }, 0.5],
    ]);
    const pruned = pruneReturnToPrevious(d, { x: 4, y: 2 }, { dx: 2, dy: 0 });
    expect(pruned).toBe(d);
  });

  it("leaves the distribution untouched on a cast's first hop (prev === null)", () => {
    const d = dist([[{ x: 2, y: 2 }, 1]]);
    const pruned = pruneReturnToPrevious(d, { x: 2, y: 2 }, null);
    expect(pruned).toBe(d);
  });

  it("leaves the distribution untouched if the forbidden cell has no probability mass to prune", () => {
    const d = dist([
      [{ x: 3, y: 3 }, 0.6],
      [{ x: 4, y: 2 }, 0.4],
    ]);
    const pruned = pruneReturnToPrevious(d, { x: 3, y: 2 }, { dx: 1, dy: 0 });
    expect(pruned).toBe(d);
  });

  it("refuses to prune down to an empty distribution — returns the input unchanged", () => {
    // Degenerate: the ENTIRE distribution sits on the forbidden cell. Pruning
    // it would leave an empty Distribution, which breaks every downstream
    // consumer — refuse rather than produce one.
    const d = dist([[{ x: 2, y: 2 }, 1]]);
    const pruned = pruneReturnToPrevious(d, { x: 3, y: 2 }, { dx: 1, dy: 0 });
    expect(pruned).toBe(d);
  });
});

describe("candidateCellCount — heuristic (e)'s narrow geometric claim, NOT a probabilistic one (see heuristics.ts header)", () => {
  it("is strictly smaller from a corner than from the center, at the same radius, on a 4x4 grid", () => {
    const corner = candidateCellCount({ x: 1, y: 1 }, 4, 2);
    const center = candidateCellCount({ x: 2, y: 2 }, 4, 2); // one of the central 2x2 cells
    expect(corner).toBeLessThan(center);
  });

  it("is strictly smaller from an edge (non-corner) than from the center, at the same radius", () => {
    const edge = candidateCellCount({ x: 1, y: 2 }, 4, 2);
    const center = candidateCellCount({ x: 2, y: 2 }, 4, 2);
    expect(edge).toBeLessThan(center);
  });

  it("matches a hand count for both cases, pinned so the comparison above is checked against real numbers, not just an inequality", () => {
    // From (1,1) on a 4x4 grid, radius 2: every cell with |dx|+|dy| <= 2 and
    // in [1,4]x[1,4]. By hand: (1,1) d0; (1,2)(2,1) d1; (1,3)(2,2)(3,1) d2 —
    // the rest of the Manhattan diamond falls off-grid. Total 6.
    expect(candidateCellCount({ x: 1, y: 1 }, 4, 2)).toBe(6);
    // From (2,2), radius 2: the diamond is clipped by the x=1/y=1 edges (a
    // full unclipped radius-2 diamond has 13 cells; y=-1/x=-1-direction
    // cells fall off-grid here) — 11.
    expect(candidateCellCount({ x: 2, y: 2 }, 4, 2)).toBe(11);
  });
});

describe("coverageCount — heuristic (f)", () => {
  const wideCard: FishingCardLike = {
    id: 1,
    manaCost: 1,
    hitZones: [1, 2, 3, 4, 6, 7, 8, 9], // every zone but center (5)
    critZones: [],
    hitEffects: [{ amount: 5 }],
    missEffects: [{ amount: -4 }],
    critEffects: [],
  };
  const narrowCard: FishingCardLike = {
    id: 2,
    manaCost: 1,
    hitZones: [5],
    critZones: [],
    hitEffects: [{ amount: 10 }],
    missEffects: [{ amount: -4 }],
    critEffects: [],
  };

  it("counts distinct distribution-support cells the card's zones cover, unweighted by probability", () => {
    // Distribution spread across 3 cells, one with almost all the mass.
    const d = dist([
      [{ x: 2, y: 2 }, 0.9], // focus itself, zone 5
      [{ x: 1, y: 1 }, 0.05], // zone 1
      [{ x: 3, y: 3 }, 0.05], // zone 9
    ]);
    // wideCard covers zones 1 and 9 (2 support cells) but NOT zone 5 (the
    // 0.9-probability cell) — a naive probability-weighted read would favor
    // narrowCard here, but coverage counts hedge-breadth, not weight.
    expect(coverageCount(wideCard, { x: 2, y: 2 }, d, 4)).toBe(2);
    expect(coverageCount(narrowCard, { x: 2, y: 2 }, d, 4)).toBe(1);
  });

  it("returns 0 when none of the card's zones intersect the distribution's support", () => {
    const d = dist([[{ x: 4, y: 4 }, 1]]);
    expect(coverageCount(narrowCard, { x: 1, y: 1 }, d, 4)).toBe(0);
  });
});
