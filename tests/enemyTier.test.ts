/**
 * tests/enemyTier.test.ts — the Safe-tier hard rule.
 */

import { describe, expect, it } from "vitest";

import { SAFE_TIER } from "../src/sim/enemies.js";
import { assertSafeTier, chooseTier, pickSafeTier, UnsafeTierError } from "../src/strategy/enemyTier.js";

describe("chooseTier", () => {
  it("picks the lowest tier regardless of offer order", () => {
    expect(chooseTier([{ tier: 2 }, { tier: 0 }, { tier: 1 }])).toEqual({ tier: 0 });
    expect(chooseTier([{ tier: 1 }, { tier: 1 }, { tier: 0 }])).toEqual({ tier: 0 });
  });

  it("throws on an empty offer rather than returning undefined", () => {
    expect(() => chooseTier([])).toThrow();
  });

  it("preserves the whole option, not just the tier", () => {
    const options = [
      { tier: 2, enemyId: 64, lootTable: "x" },
      { tier: 0, enemyId: 64, lootTable: "x" },
    ];
    expect(chooseTier(options)).toBe(options[1]);
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
