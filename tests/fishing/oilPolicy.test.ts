/**
 * tests/fishing/oilPolicy.test.ts — session 43 heuristic (c). Synthetic
 * throughout: no live oil-use outcome exists yet to check against (see
 * oilPolicy.ts's own header on `LOW_FISH_HP_FRACTION`'s "a handful, not
 * derived" status).
 */

import { describe, expect, it } from "vitest";

import {
  aboveReserveFloor,
  LOW_FISH_HP_FRACTION,
  MID_FOCUS_OIL_ITEM_ID,
  MID_RELAXING_OIL_ITEM_ID,
  OIL_RESERVE_FLOOR,
  shouldConsiderRelaxingOil,
} from "../../src/strategy/fishing/oilPolicy.js";

describe("item ids — resolved against fixtures/fishing-casts/item-metadata-sample.json, SPEC-fishing.md §4a", () => {
  it("are the real docIds, not placeholders", () => {
    expect(MID_FOCUS_OIL_ITEM_ID).toBe(942);
    expect(MID_RELAXING_OIL_ITEM_ID).toBe(937);
  });
});

describe("config constants", () => {
  it("LOW_FISH_HP_FRACTION is the user's stated ballpark (2/20 = 10%, the brief's own example), not tuned to a knife's edge", () => {
    expect(LOW_FISH_HP_FRACTION).toBe(0.15);
  });
});

describe("shouldConsiderRelaxingOil", () => {
  it("recommends spending at low fish HP fraction, with one held", () => {
    expect(shouldConsiderRelaxingOil(2, 20, 1)).toBe(true); // 10% <= 15%
  });

  it("does not recommend spending when fish HP fraction is comfortably above the threshold", () => {
    expect(shouldConsiderRelaxingOil(10, 20, 1)).toBe(false); // 50%
  });

  it("is exactly true at the threshold boundary — inclusive", () => {
    expect(shouldConsiderRelaxingOil(3, 20, 1)).toBe(true); // exactly 15%
  });

  it("is false just above the threshold boundary", () => {
    expect(shouldConsiderRelaxingOil(3.01, 20, 1)).toBe(false); // 15.05%
  });

  it("never recommends spending when none is held, however low the fish HP", () => {
    expect(shouldConsiderRelaxingOil(0, 20, 0)).toBe(false);
  });

  it("refuses on a degenerate zero fishMaxHp rather than dividing by zero", () => {
    expect(shouldConsiderRelaxingOil(0, 0, 1)).toBe(false);
  });
});

describe("aboveReserveFloor", () => {
  it("is false at exactly the reserve floor", () => {
    expect(aboveReserveFloor(OIL_RESERVE_FLOOR)).toBe(false);
  });

  it("is true one above the reserve floor", () => {
    expect(aboveReserveFloor(OIL_RESERVE_FLOOR + 1)).toBe(true);
  });

  it("is false at zero", () => {
    expect(aboveReserveFloor(0)).toBe(false);
  });
});
