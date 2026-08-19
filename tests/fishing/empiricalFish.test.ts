/**
 * tests/fishing/empiricalFish.test.ts — [session 45] the corpus-sampled fish
 * generator. What matters here is that a sampled fish obeys the same FACT 1
 * constraint the real one does (fixed step class, never off-grid, never
 * standing still) — a generator that violated it would recreate exactly the
 * `patterns.ts` problem it exists to fix.
 */

import { describe, expect, it } from "vitest";

import { makeRng } from "../../src/sim/rng.js";
import type { Cell } from "../../src/sim/fishing/geometry.js";
import { inGrid } from "../../src/sim/fishing/geometry.js";
import { groupByCast, type Cast, type TransitionRecord } from "../../src/sim/fishing/transitionCorpus.js";
import { sampleEmpiricalTrajectory, sampleStepClass } from "../../src/sim/fishing/empiricalFish.js";
import { buildStepClassTable } from "../../src/strategy/fishing/stepClass.js";

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

const k1 = cast("a", [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }]);
const k1b = cast("b", [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }]);
const k2 = cast("c", [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 1 }]);
const table = buildStepClassTable([k1, k1b, k2]);

function step(a: Cell, b: Cell): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

describe("sampleEmpiricalTrajectory", () => {
  it("holds the step class constant for the whole cast — FACT 1, the thing patterns.ts violated", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const traj = sampleEmpiricalTrajectory(table, { x: 2, y: 2 }, GRID, 12, makeRng(seed));
      expect(traj.stepClass).not.toBeNull();
      let prev: Cell = { x: 2, y: 2 };
      for (const c of traj.cells) {
        expect(step(prev, c)).toBe(traj.stepClass);
        prev = c;
      }
    }
  });

  it("never leaves the grid", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const traj = sampleEmpiricalTrajectory(table, { x: 1, y: 1 }, GRID, 12, makeRng(seed));
      for (const c of traj.cells) expect(inGrid(c, GRID)).toBe(true);
    }
  });

  it("is deterministic for a seed", () => {
    const a = sampleEmpiricalTrajectory(table, { x: 2, y: 3 }, GRID, 8, makeRng(42));
    const b = sampleEmpiricalTrajectory(table, { x: 2, y: 3 }, GRID, 8, makeRng(42));
    expect(b).toEqual(a);
  });

  it("draws both classes across seeds, weighted by the corpus's cast counts", () => {
    const seen = new Map<number, number>();
    for (let seed = 1; seed <= 600; seed++) {
      const k = sampleStepClass(table, makeRng(seed))!;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    expect(seen.get(1)).toBeGreaterThan(0);
    expect(seen.get(2)).toBeGreaterThan(0);
    // 2 of the 3 training casts are k=1 — the draw should lean that way
    expect(seen.get(1)!).toBeGreaterThan(seen.get(2)!);
  });

  it("reproduces the training conditional: a k=2 fish that only ever reversed keeps reversing", () => {
    const reverseOnly = buildStepClassTable([k2]);
    const traj = sampleEmpiricalTrajectory(reverseOnly, { x: 1, y: 1 }, GRID, 6, makeRng(7));
    expect(traj.stepClass).toBe(2);
    expect(traj.cells.map((c) => `${c.x},${c.y}`)).toEqual(["3,1", "1,1", "3,1", "1,1", "3,1", "1,1"]);
  });

  it("holds position rather than inventing a move when the table is empty", () => {
    const empty = buildStepClassTable([]);
    const traj = sampleEmpiricalTrajectory(empty, { x: 2, y: 2 }, GRID, 4, makeRng(1));
    expect(traj.stepClass).toBeNull();
    expect(traj.cells).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 2 },
    ]);
  });
});
