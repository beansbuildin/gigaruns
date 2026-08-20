/**
 * tests/enemyTier.test.ts — the STRICT Safe-tier selector and the plain
 * lowest/highest accessors. The live rule (CLAUDE.md rule 8, highest tier
 * among non-Perpetual options) is exercised in tests/enemyBuffs.test.ts,
 * where the buff fixtures it needs already live.
 */

import { describe, expect, it } from "vitest";

import { SAFE_TIER } from "../src/sim/enemies.js";
import {
  assertSafeTier,
  highestTierOption,
  lowestTierOption,
  pickSafeTier,
  UnsafeTierError,
} from "../src/strategy/enemyTier.js";

describe("lowestTierOption", () => {
  it("picks the lowest tier regardless of offer order", () => {
    expect(lowestTierOption([{ tier: 2 }, { tier: 0 }, { tier: 1 }])).toEqual({ tier: 0 });
    expect(lowestTierOption([{ tier: 1 }, { tier: 1 }, { tier: 0 }])).toEqual({ tier: 0 });
  });

  it("throws on an empty offer rather than returning undefined", () => {
    expect(() => lowestTierOption([])).toThrow();
  });

  it("preserves the whole option, not just the tier", () => {
    const options = [
      { tier: 2, enemyId: 64, lootTable: "x" },
      { tier: 0, enemyId: 64, lootTable: "x" },
    ];
    expect(lowestTierOption(options)).toBe(options[1]);
  });
});

describe("highestTierOption", () => {
  it("picks the highest tier regardless of offer order", () => {
    expect(highestTierOption([{ tier: 2 }, { tier: 0 }, { tier: 1 }])).toEqual({ tier: 2 });
    expect(highestTierOption([{ tier: 1 }, { tier: 1 }, { tier: 0 }])).toEqual({ tier: 1 });
  });

  it("resolves a tie on offer order, matching lowestTierOption's reduce", () => {
    const options = [{ tier: 2, enemyId: 64 }, { tier: 2, enemyId: 65 }];
    expect(highestTierOption(options)).toBe(options[0]);
  });

  it("throws on an empty offer rather than returning undefined", () => {
    expect(() => highestTierOption([])).toThrow();
  });
});

describe("assertSafeTier", () => {
  it("passes silently on SAFE_TIER", () => {
    expect(() => assertSafeTier(SAFE_TIER)).not.toThrow();
  });

  it("halts on any non-Safe tier", () => {
    expect(() => assertSafeTier(1)).toThrow(UnsafeTierError);
    expect(() => assertSafeTier(2)).toThrow(UnsafeTierError);
  });
});

describe("pickSafeTier", () => {
  it("returns the Safe option when one is offered", () => {
    const options = [{ tier: 2 }, { tier: 0 }, { tier: 1 }];
    expect(pickSafeTier(options)).toEqual({ tier: 0 });
  });

  it("halts rather than silently taking a non-Safe tier when Safe isn't offered", () => {
    // Never observed live, but CLAUDE.md §5 says fail closed on the
    // unexpected rather than guess — this is that guard under test.
    const options = [{ tier: 2 }, { tier: 1 }];
    expect(() => pickSafeTier(options)).toThrow(UnsafeTierError);
  });
});
