/**
 * tests/fishing/geometry.test.ts — zone/focus geometry against the one real
 * captured Dendren cast (`fixtures/fishing-casts/cast.json`), not prose.
 */

import { describe, expect, it } from "vitest";

import { inGrid, manhattan, reachableCells, zoneToCell, zonesToCells } from "../../src/sim/fishing/geometry.js";

describe("zoneToCell", () => {
  it("centres zone 5 on the focus point", () => {
    expect(zoneToCell({ x: 3, y: 3 }, 5, 4)).toEqual({ x: 3, y: 3 });
  });

  it("reproduces the real cast's one genuine hit (turn 3: card 79, focus [3,3], hit [3,4])", () => {
    // card id 79: hitZones [2,4,6,8]. focusPoint [3,3]. fish landed at [3,4]
    // after the move — zone 8 is offset (0,1). SPEC.md §5 / SPEC-fishing.md §4.
    const focus = { x: 3, y: 3 };
    const cells = zonesToCells(focus, [2, 4, 6, 8], 4);
    expect(cells).toContainEqual({ x: 3, y: 4 });
  });

  it("does not count the pre-move fish cell as a hit for that same turn", () => {
    // Pre-move cell was [4,4] — confirms the focus scores the POST-move
    // position, not the pre-move one (SPEC.md §5's confirmed timing note).
    const focus = { x: 3, y: 3 };
    const cells = zonesToCells(focus, [2, 4, 6, 8], 4);
    expect(cells).not.toContainEqual({ x: 4, y: 4 });
  });

  it("drops off-grid zones instead of clamping", () => {
    // focus at a corner — several zones point off-grid.
    const cell = zoneToCell({ x: 1, y: 1 }, 1, 4); // offset (-1,-1) -> (0,0), off-grid
    expect(cell).toBeNull();
    expect(inGrid({ x: 0, y: 0 }, 4)).toBe(false);
  });

  it("throws on an unknown zone rather than guessing", () => {
    expect(() => zoneToCell({ x: 2, y: 2 }, 10, 4)).toThrow();
  });
});

describe("reachableCells / manhattan — focusMeter budget [CONFIRMED session 13, live]", () => {
  // The four data points from this project's first-ever live cast:
  // (2,2)->(2,2) dist 0, meter 3->3; (2,2)->(1,2) dist 1, meter 3->2;
  // (1,2)->(1,1) dist 1, meter 2->1; (1,1)->(2,2) dist 2, meter=1 -> REJECTED.
  it("matches the live cast's own move-cost sequence", () => {
    expect(manhattan({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
    expect(manhattan({ x: 2, y: 2 }, { x: 1, y: 2 })).toBe(1);
    expect(manhattan({ x: 1, y: 2 }, { x: 1, y: 1 })).toBe(1);
    expect(manhattan({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(2);
  });

  it("excludes a cell the live server rejected (distance 2, only 1 meter left)", () => {
    const cells = reachableCells(4, { x: 1, y: 1 }, 1);
    expect(cells).not.toContainEqual({ x: 2, y: 2 });
  });

  it("always includes the current cell even at zero remaining meter", () => {
    const cells = reachableCells(4, { x: 2, y: 3 }, 0);
    expect(cells).toEqual([{ x: 2, y: 3 }]);
  });

  it("matches allCells' count when remaining meter is large enough to reach the whole grid", () => {
    expect(reachableCells(4, { x: 1, y: 1 }, 6).length).toBe(16);
  });
});
