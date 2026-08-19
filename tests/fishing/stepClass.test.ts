/**
 * tests/fishing/stepClass.test.ts — [session 45] the step-class ring movement
 * model. Facts 1 and 2 are re-derived from the real corpus by
 * `scripts/auditStepClass.ts`; these tests pin the MECHANICS that follow
 * from them (hard ring constraint, causal classification, shrinkage toward
 * the class marginal, ring intersection), not the corpus numbers themselves.
 */

import { describe, expect, it } from "vitest";

import type { Cell } from "../../src/sim/fishing/geometry.js";
import { cellKey } from "../../src/sim/fishing/geometry.js";
import type { Cast } from "../../src/sim/fishing/transitionCorpus.js";
import { groupByCast, type TransitionRecord } from "../../src/sim/fishing/transitionCorpus.js";
import {
  buildStepClassTable,
  classifyStep,
  intersectWithRing,
  ringCells,
  ringDistribution,
  ringDistributionUnknownClass,
  type Distribution,
} from "../../src/strategy/fishing/stepClass.js";

const GRID = 4;

function cast(castId: string, cells: Cell[]): Cast {
  const records: TransitionRecord[] = [];
  for (let i = 1; i < cells.length; i++) {
    records.push({
      ts: new Date().toISOString(),
      castId,
      turn: i - 1,
      from: [cells[i - 1]!.x, cells[i - 1]!.y],
      to: [cells[i]!.x, cells[i]!.y],
      gridSize: GRID,
    });
  }
  return groupByCast(records)[0]!;
}

function totalP(d: Distribution): number {
  let t = 0;
  for (const v of d.values()) t += v.p;
  return t;
}

describe("ringCells", () => {
  it("returns the in-grid Manhattan-k ring, not a disc", () => {
    const r1 = ringCells({ x: 2, y: 2 }, 1, GRID).map(cellKey).sort();
    expect(r1).toEqual(["1,2", "2,1", "2,3", "3,2"].sort());
    const r2 = ringCells({ x: 2, y: 2 }, 2, GRID).map(cellKey).sort();
    // (0,-2) leaves the grid at y=0; everything else survives
    expect(r2).toEqual(["1,1", "1,3", "2,4", "3,1", "3,3", "4,2"].sort());
  });

  it("clips to the grid at a corner", () => {
    expect(ringCells({ x: 1, y: 1 }, 1, GRID).map(cellKey).sort()).toEqual(["1,2", "2,1"]);
    expect(ringCells({ x: 1, y: 1 }, 2, GRID).map(cellKey).sort()).toEqual(["1,3", "2,2", "3,1"]);
  });

  it("never includes the cell itself", () => {
    for (const k of [1, 2]) {
      expect(ringCells({ x: 3, y: 3 }, k, GRID).map(cellKey)).not.toContain("3,3");
    }
  });
});

describe("classifyStep", () => {
  it("is null before any hop has been observed — turn 1 is an identification turn", () => {
    expect(classifyStep([])).toBeNull();
    expect(classifyStep([{ x: 2, y: 2 }])).toBeNull();
  });

  it("identifies k=1 and k=2 off a single hop", () => {
    expect(classifyStep([{ x: 2, y: 2 }, { x: 2, y: 3 }])).toBe(1);
    expect(classifyStep([{ x: 2, y: 2 }, { x: 2, y: 4 }])).toBe(2);
    expect(classifyStep([{ x: 2, y: 2 }, { x: 1, y: 1 }])).toBe(2);
  });

  it("ignores a zero-length hop rather than treating it as a class", () => {
    expect(classifyStep([{ x: 2, y: 2 }, { x: 2, y: 2 }])).toBeNull();
    expect(classifyStep([{ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }])).toBe(1);
  });

  it("takes the mode, so one anomalous record cannot pin the cast to a wrong class", () => {
    // k=2 three times, one stray k=1 first: the mode wins.
    const history = [
      { x: 2, y: 2 },
      { x: 2, y: 3 }, // stray 1
      { x: 2, y: 1 }, // 2
      { x: 4, y: 1 }, // 2
      { x: 4, y: 3 }, // 2
    ];
    expect(classifyStep(history)).toBe(2);
  });
});

describe("ringDistribution", () => {
  const table = buildStepClassTable([
    // three k=1 casts that always continue in the same direction
    cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }]),
    cast("b", [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }]),
    cast("c", [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }]),
    // two k=2 casts that always reverse
    cast("d", [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 1 }]),
    cast("e", [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 2 }, { x: 3, y: 2 }]),
  ]);

  it("puts ZERO mass off the k-ring — the class is a hard constraint, not a prior", () => {
    const d = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID);
    const legal = new Set(ringCells({ x: 2, y: 2 }, 1, GRID).map(cellKey));
    for (const key of d.keys()) expect(legal.has(key)).toBe(true);
    expect(d.get("2,2")).toBeUndefined();
    expect(d.get("1,1")).toBeUndefined(); // a k=2 cell
  });

  it("normalizes to 1", () => {
    for (const k of [1, 2] as const) {
      expect(totalP(ringDistribution({ x: 2, y: 2 }, k, null, table, GRID))).toBeCloseTo(1, 10);
      expect(totalP(ringDistribution({ x: 1, y: 1 }, k, { dx: 1, dy: 0 }, table, GRID))).toBeCloseTo(1, 10);
    }
  });

  it("favours continuing for k=1 and reversing for k=2 — the two classes pull opposite ways", () => {
    const straight = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID);
    expect(straight.get("2,3")!.p).toBeGreaterThan(straight.get("2,1")!.p);

    const reversing = ringDistribution({ x: 3, y: 1 }, 2, { dx: 2, dy: 0 }, table, GRID);
    expect(reversing.get("1,1")!.p).toBeGreaterThan(reversing.get("3,3")!.p);
  });

  it("keeps a nonzero floor on every legal ring cell, so no reachable cell is a log-loss trap", () => {
    const d = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID);
    for (const c of ringCells({ x: 2, y: 2 }, 1, GRID)) {
      expect(d.get(cellKey(c))!.p).toBeGreaterThan(0);
    }
  });

  it("ringFloor: 0 removes the floor, which is what makes the floor's effect measurable", () => {
    const d = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, { shrinkageK: 0.0001, ringFloor: 0 });
    // with essentially no shrinkage the conditional is pure "repeat the delta"
    expect(d.get("2,3")!.p).toBeCloseTo(1, 6);
  });

  it("falls back to a uniform ring where the table has nothing at all", () => {
    const empty = buildStepClassTable([]);
    const d = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, empty, GRID);
    for (const v of d.values()) expect(v.p).toBeCloseTo(0.25, 10);
  });
});

describe("ringDistributionUnknownClass", () => {
  const table = buildStepClassTable([
    cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]),
    cast("d", [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 1 }]),
  ]);

  it("spans BOTH rings when the class is still unknown", () => {
    const d = ringDistributionUnknownClass({ x: 2, y: 2 }, null, table, GRID);
    expect(d.get("2,3")).toBeDefined(); // k=1 ring
    expect(d.get("2,4")).toBeDefined(); // k=2 ring
    expect(d.get("2,2")).toBeUndefined(); // still never the current cell
    expect(totalP(d)).toBeCloseTo(1, 10);
  });

  it("weights the two rings by the observed class prior", () => {
    const lopsided = buildStepClassTable([
      cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]),
      cast("b", [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }]),
      cast("c", [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }]),
      cast("d", [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 1 }]),
    ]);
    const d = ringDistributionUnknownClass({ x: 2, y: 2 }, null, lopsided, GRID);
    let k1 = 0;
    for (const c of ringCells({ x: 2, y: 2 }, 1, GRID)) k1 += d.get(cellKey(c))?.p ?? 0;
    expect(k1).toBeCloseTo(3 / 4, 6);
  });
});

describe("intersectWithRing", () => {
  const d: Distribution = new Map([
    ["2,3", { cell: { x: 2, y: 3 }, p: 0.5 }], // on the k=1 ring of (2,2)
    ["2,2", { cell: { x: 2, y: 2 }, p: 0.3 }], // the current cell — impossible
    ["4,4", { cell: { x: 4, y: 4 }, p: 0.2 }], // far off-ring
  ]);

  it("drops off-ring mass and renormalizes over what survives", () => {
    const out = intersectWithRing(d, { x: 2, y: 2 }, 1, GRID)!;
    expect([...out.keys()]).toEqual(["2,3"]);
    expect(out.get("2,3")!.p).toBeCloseTo(1, 10);
  });

  it("returns null when a predictor is fully refuted, rather than a degenerate distribution", () => {
    expect(intersectWithRing(d, { x: 2, y: 2 }, 2, GRID)).toBeNull();
  });
});

describe("buildStepClassTable", () => {
  it("counts distinct casts per class, not transitions", () => {
    const table = buildStepClassTable([
      cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }]),
      cast("d", [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 1 }]),
    ]);
    expect(table.classCasts.get(1)).toBe(1);
    expect(table.classCasts.get(2)).toBe(1);
    // shrinkage gates on distinct casts: one 3-hop cast is still n=1
    const cond = table.conditional.get("1|0,1")!;
    expect(cond.castIds.size).toBe(1);
    expect([...cond.counts.values()].reduce((a, b) => a + b, 0)).toBe(2);
  });
});
