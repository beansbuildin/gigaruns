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
  assertTierChoiceOk,
  auditTierChoice,
  formatTierCheckLine,
  highestTierOption,
  lowestTierOption,
  pickSafeTier,
  TierRuleViolationError,
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

// ---------------------------------------------------------------------------
// [session 61 §1] auditTierChoice — the in-loop gate's pure half.
//
// The integration half lives in tests/liveRun.test.ts and injects the ONE
// fault reality can produce on its own (a missing ROOM_NUM_CID). These cover
// the shapes reality could produce but this corpus has not yet, including the
// clause-1 mismatch that no unmodified picker can generate — an audit that
// only ever agrees with the picker would be worthless, so it is checked
// against a hand-built disagreement.
// ---------------------------------------------------------------------------

describe("auditTierChoice", () => {
  const clean = { evasion: 0, block: 0, lck: 0, tenacity: 0 };
  const offer = [
    { tier: 0, enemyBuff: null, rolledEnemyStats: clean },
    { tier: 1, enemyBuff: { id: "armored" } },
    { tier: 2, enemyBuff: { id: "ferocious" } },
  ];

  it("passes the ordinary case: highest non-Perpetual tier taken mid-dungeon", () => {
    const a = auditTierChoice(offer, 2, 3, 16);
    expect(a.violations).toEqual([]);
    expect(a.rule).toBe("highest");
    expect(a.eligibleTop).toBe(2);
    expect(a.perpetualFilteredTop).toBe(false);
  });

  it("FIRES on a clause-1 mismatch — the shape no unmodified picker can produce", () => {
    const a = auditTierChoice(offer, 0, 3, 16);
    expect(a.violations).toHaveLength(1);
    expect(a.violations[0]).toMatch(/The flip did not fire/);
  });

  it("re-derives eligibleTop independently of the Perpetual filter, and flags when it cost a tier", () => {
    const perpTop = [
      { tier: 0, enemyBuff: null, rolledEnemyStats: clean },
      { tier: 2, enemyBuff: { id: "perpetual_ferocious" } },
    ];
    const a = auditTierChoice(perpTop, 0, 3, 16);
    expect(a.eligibleTop).toBe(0);
    expect(a.topTierOffered).toBe(2);
    expect(a.perpetualFilteredTop).toBe(true);
    expect(a.violations).toEqual([]); // tier 0 IS correct here — the top tier was all-Perpetual
  });

  it("treats an unreadable room as a violation, not a warning — the silent-inertness shape", () => {
    const a = auditTierChoice(offer, 0, 0, 16);
    expect(a.rule).toBe("final-room-unreadable");
    expect(a.violations[0]).toMatch(/UNREADABLE/);
  });

  it("passes a GENUINE final room, where the lowest tier is the rule rather than a failure", () => {
    const a = auditTierChoice(offer, 0, 16, 16);
    expect(a.rule).toBe("final-room");
    expect(a.violations).toEqual([]);
  });

  it("flags an empty offer", () => {
    expect(auditTierChoice([], 0, 3, 16).violations[0]).toMatch(/empty enemy path offer/);
  });

  it("formatTierCheckLine carries room, offer, choice and verdict on ONE greppable line", () => {
    const line = formatTierCheckLine(auditTierChoice(offer, 2, 3, 16));
    expect(line).toContain("room=3/16");
    expect(line).toContain("offered=[0,1,2]");
    expect(line).toContain("taken=2");
    expect(line).toContain("OK");
    expect(line.split("\n")).toHaveLength(1);
  });

  it("assertTierChoiceOk throws only on a violation", () => {
    expect(() => assertTierChoiceOk(auditTierChoice(offer, 2, 3, 16))).not.toThrow();
    expect(() => assertTierChoiceOk(auditTierChoice(offer, 0, 3, 16))).toThrow(TierRuleViolationError);
  });
});
