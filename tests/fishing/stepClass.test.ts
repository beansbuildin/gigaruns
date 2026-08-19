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
  estimateSwitchProbability,
  intersectWithRing,
  lastStepClass,
  stickyStepDistribution,
  DEFAULT_SWITCH_PROBABILITY,
  ringCells,
  ringDistribution,
  ringDistributionUnknownClass,
  shrinkageFor,
  DEFAULT_RING_MODEL_OPTIONS,
  SHARED_SHRINKAGE_BASELINE,
  SWITCH_PROBABILITY_FLOOR,
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

// ── [session 49, brief §2] the sticky step-count latent ────────────────────

describe("lastStepClass", () => {
  it("is null before any nonzero hop resolves", () => {
    expect(lastStepClass([])).toBeNull();
    expect(lastStepClass([{ x: 2, y: 2 }])).toBeNull();
    expect(lastStepClass([{ x: 2, y: 2 }, { x: 2, y: 2 }])).toBeNull();
  });

  it("reads the MOST RECENT hop, not the cast-wide mode", () => {
    // Three k=1 hops then one k=2: the mode is 1, the last is 2. This is the
    // whole difference between the two, and it is the alternating cast's case.
    const history = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 1, y: 4 },
      { x: 3, y: 4 },
    ];
    expect(classifyStep(history)).toBe(1);
    expect(lastStepClass(history)).toBe(2);
  });

  it("skips a zero-length hop to reach the last real move", () => {
    const history = [{ x: 2, y: 2 }, { x: 2, y: 4 }, { x: 2, y: 4 }];
    expect(lastStepClass(history)).toBe(2);
  });
});

describe("stickyStepDistribution", () => {
  const table = buildStepClassTable([
    cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }]),
    cast("b", [{ x: 1, y: 1 }, { x: 1, y: 3 }, { x: 1, y: 1 }, { x: 1, y: 3 }]),
  ]);

  it("gives the OFF-ring cells nonzero mass — the session-48 failure cannot recur", () => {
    // Cast `12988700` locked k=1 and then landed two steps away three times,
    // each at probability exactly zero. Under the sticky chain that cell is
    // reachable with roughly `s` of the mass.
    const d = stickyStepDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID);
    const offRing = d.get(cellKey({ x: 2, y: 4 })); // Manhattan 2 from (2,2)
    expect(offRing).toBeDefined();
    expect(offRing!.p).toBeGreaterThan(0);
    expect(offRing!.p).toBeLessThan(DEFAULT_SWITCH_PROBABILITY);
  });

  it("puts NO cell at exactly zero across the union of both rings", () => {
    for (const lastK of [1, 2] as const) {
      const d = stickyStepDistribution({ x: 2, y: 2 }, lastK, { dx: 0, dy: 1 }, table, GRID);
      for (const k of [1, 2]) {
        for (const c of ringCells({ x: 2, y: 2 }, k, GRID)) {
          expect(d.get(cellKey(c))?.p ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("still sums to 1", () => {
    for (const lastK of [1, 2] as const) {
      expect(totalP(stickyStepDistribution({ x: 2, y: 2 }, lastK, { dx: 0, dy: 1 }, table, GRID))).toBeCloseTo(1, 10);
      expect(totalP(stickyStepDistribution({ x: 1, y: 1 }, lastK, null, table, GRID))).toBeCloseTo(1, 10);
    }
  });

  it("keeps the stay-class dominant — stickiness is preserved, not discarded", () => {
    const d = stickyStepDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID);
    let onRing = 0;
    for (const c of ringCells({ x: 2, y: 2 }, 1, GRID)) onRing += d.get(cellKey(c))?.p ?? 0;
    expect(onRing).toBeGreaterThan(0.9);
  });

  it("collapses to the hard ring at s = 0", () => {
    const hard = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID);
    const sticky = stickyStepDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, undefined, 0);
    expect([...sticky.keys()].sort()).toEqual([...hard.keys()].sort());
    for (const [k, v] of hard) expect(sticky.get(k)!.p).toBeCloseTo(v.p, 12);
  });

  it("hands over to the class prior when no hop has resolved yet", () => {
    const prior = ringDistributionUnknownClass({ x: 2, y: 2 }, null, table, GRID);
    const sticky = stickyStepDistribution({ x: 2, y: 2 }, null, null, table, GRID);
    for (const [k, v] of prior) expect(sticky.get(k)!.p).toBeCloseTo(v.p, 12);
  });
});

describe("[session 50, open question 4] estimateSwitchProbability", () => {
  const GRID_S = 4;

  function castOf(castId: string, cells: readonly [number, number][]) {
    const byTurn = new Map<number, { x: number; y: number }>();
    for (let i = 1; i < cells.length; i++) byTurn.set(i - 1, { x: cells[i]![0], y: cells[i]![1] });
    return {
      castId,
      gridSize: GRID_S,
      start: { x: cells[0]![0], y: cells[0]![1] },
      byTurn,
      maxTurn: cells.length - 2,
      duplicateTurns: [] as number[],
      hasGaps: false,
    };
  }

  it("counts a switch per consecutive hop PAIR, not per cast", () => {
    // 1,1,1: two pairs, no switch.
    const constant = castOf("c", [
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    const e = estimateSwitchProbability([constant], 0);
    expect(e.n).toBe(2);
    expect(e.switches).toBe(0);
    expect(e.raw).toBe(0);
  });

  it("sees an alternating cast as a switch on every pair", () => {
    // steps 1,2,1: two pairs, both switches.
    const alternating = castOf("a", [
      [1, 1],
      [1, 2],
      [1, 4],
      [2, 4],
    ]);
    const e = estimateSwitchProbability([alternating], 0);
    expect(e.n).toBe(2);
    expect(e.switches).toBe(2);
    expect(e.raw).toBe(1);
  });

  it("applies the floor, and says so, when the corpus has seen no switch", () => {
    const constant = castOf("c", [
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
    const e = estimateSwitchProbability([constant]);
    expect(e.raw).toBe(0);
    expect(e.s).toBe(SWITCH_PROBABILITY_FLOOR);
    expect(e.floored).toBe(true);
  });

  it("does not floor an estimate that already exceeds it", () => {
    const alternating = castOf("a", [
      [1, 1],
      [1, 2],
      [1, 4],
      [2, 4],
    ]);
    const e = estimateSwitchProbability([alternating]);
    expect(e.s).toBe(1);
    expect(e.floored).toBe(false);
  });

  it("is empty-corpus safe — the floor, not a NaN", () => {
    const e = estimateSwitchProbability([]);
    expect(e.n).toBe(0);
    expect(e.s).toBe(SWITCH_PROBABILITY_FLOOR);
  });
});

describe("[session 51 §2] per-class shrinkageK", () => {
  // The table the other suites use has each class's conditional EQUAL to its
  // own marginal (every k=1 cast walks the same way, every k=2 cast always
  // reverses), which makes shrinkage a no-op by construction and would let
  // these tests pass against a version that ignored the knob entirely. This
  // table deliberately separates the two tiers: within each class the
  // conditional given a specific prevDelta is pure, while the class MARGINAL
  // is mixed, so any change in shrinkage weight has to show up.
  const table = buildStepClassTable([
    // k=1: three casts walking +y, one walking +x -> marginal is mixed,
    // conditional on prev (0,1) is pure (0,1).
    cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }]),
    cast("b", [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }]),
    cast("c", [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }]),
    cast("f", [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]),
    // k=2: two casts reversing along x, one walking +y twice a turn ->
    // marginal is mixed, conditional on prev (2,0) is pure (-2,0).
    cast("d", [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 1 }]),
    cast("e", [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 2 }, { x: 3, y: 2 }]),
    cast("g", [{ x: 1, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 1 }]),
  ]);

  it("resolves the per-class override, and falls back to the shared value for a class with no entry", () => {
    const opts = { shrinkageK: 3, shrinkageKByClass: { 2: 8 }, ringFloor: 0.1 };
    expect(shrinkageFor(1, opts)).toBe(3);
    expect(shrinkageFor(2, opts)).toBe(8);
  });

  it("omitting shrinkageKByClass entirely is byte-for-byte the pre-session-51 behaviour", () => {
    // Back-compat is the whole reason the field is optional rather than a
    // required record: every caller written before session 51 must be unchanged.
    for (const k of [1, 2] as const) {
      const before = ringDistribution({ x: 2, y: 2 }, k, { dx: 0, dy: 1 }, table, GRID, { shrinkageK: 3, ringFloor: 0.1 });
      const after = ringDistribution({ x: 2, y: 2 }, k, { dx: 0, dy: 1 }, table, GRID, {
        shrinkageK: 3,
        shrinkageKByClass: {},
        ringFloor: 0.1,
      });
      expect([...after.entries()].map(([key, v]) => [key, v.p])).toEqual([...before.entries()].map(([key, v]) => [key, v.p]));
    }
  });

  it("a per-class override moves ONLY its own class", () => {
    const shared = { shrinkageK: 3, ringFloor: 0.1 };
    const k2Only = { ...shared, shrinkageKByClass: { 2: 64 } };
    const a1 = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, shared);
    const b1 = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, k2Only);
    expect(b1.get("2,3")!.p).toBeCloseTo(a1.get("2,3")!.p, 12);

    const a2 = ringDistribution({ x: 3, y: 1 }, 2, { dx: 2, dy: 0 }, table, GRID, shared);
    const b2 = ringDistribution({ x: 3, y: 1 }, 2, { dx: 2, dy: 0 }, table, GRID, k2Only);
    // more shrinkage on k=2 pulls its conditional back toward the class marginal
    expect(b2.get("1,1")!.p).toBeLessThan(a2.get("1,1")!.p);
  });

  it("lower shrinkage trusts the conditional harder — the direction the k=1 sweep picked", () => {
    const high = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, { shrinkageK: 3, ringFloor: 0.1 });
    const low = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, {
      shrinkageK: 3,
      shrinkageKByClass: { 1: 0.1 },
      ringFloor: 0.1,
    });
    expect(low.get("2,3")!.p).toBeGreaterThan(high.get("2,3")!.p);
  });

  it("the shipped default carries the swept pair; the baseline comparator carries neither", () => {
    // Pins BOTH sides of the gate. If someone moves the default, the baseline
    // must stay put or `perClassShrinkageSweep` silently compares it to itself.
    expect(DEFAULT_RING_MODEL_OPTIONS.shrinkageKByClass).toEqual({ 1: 0.1, 2: 8 });
    expect(SHARED_SHRINKAGE_BASELINE.shrinkageKByClass).toBeUndefined();
    expect(SHARED_SHRINKAGE_BASELINE.shrinkageK).toBe(3);
    expect(SHARED_SHRINKAGE_BASELINE.ringFloor).toBe(DEFAULT_RING_MODEL_OPTIONS.ringFloor);
  });

  it("the floor still guarantees no zero on a legal ring cell at every per-class value", () => {
    for (const K of [0.1, 8, Number.POSITIVE_INFINITY]) {
      const d = ringDistribution({ x: 2, y: 2 }, 1, { dx: 0, dy: 1 }, table, GRID, {
        shrinkageK: 3,
        shrinkageKByClass: { 1: K },
        ringFloor: 0.1,
      });
      for (const c of ringCells({ x: 2, y: 2 }, 1, GRID)) expect(d.get(cellKey(c))!.p).toBeGreaterThan(0);
      expect(totalP(d)).toBeCloseTo(1, 10);
    }
  });
});
