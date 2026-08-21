/**
 * tests/fishing/oilBatch.test.ts — [session 64 §2b, GATE HALF 2] each halt
 * condition, tested on its own.
 *
 * The gate asks for more than "the logic works": it asks that removing any one
 * halt makes a test fail. So every condition below is exercised by a state in
 * which ONLY that condition holds — a test that fired on two conditions at once
 * would still pass with one of them deleted, which is precisely the failure
 * mode the gate is aimed at.
 *
 * Pure module, pure test: no file is read or written, so no data path can leak.
 */

import { describe, expect, it } from "vitest";

import type { BatchState } from "../../src/strategy/fishing/oilBatch.js";
import { SESSION_64_LIMITS, batchVerdict } from "../../src/strategy/fishing/oilBatch.js";

/** A healthy mid-batch state: nothing consumed, ledger and stock ample, no streak. */
function base(): BatchState {
  return {
    castsPlayed: 2,
    oilsConsumed: 0,
    cleanCasts: 2,
    ledgerCastsRemaining: 12,
    focusOilHeld: 23,
    relaxingOilHeld: 1,
    zeroStreak: 3,
  };
}

describe("batchVerdict — continues", () => {
  it("keeps casting when no condition holds", () => {
    expect(batchVerdict(base())).toEqual({ stop: false, reason: null, detail: "batch continues" });
  });

  it("does not stop at five clean casts — the cap is six", () => {
    expect(batchVerdict({ ...base(), castsPlayed: 5, cleanCasts: 5 }).stop).toBe(false);
  });

  it("does not stop when ONE oil is dry but the other is held", () => {
    // The intended exit is still reachable through the Focus Oil, which is the
    // realistic shape of this batch: Relaxing 1, Focus 23.
    expect(batchVerdict({ ...base(), relaxingOilHeld: 0 }).stop).toBe(false);
    expect(batchVerdict({ ...base(), focusOilHeld: 0 }).stop).toBe(false);
  });
});

describe("batchVerdict — each halt, in isolation", () => {
  it("halts on the first consumed oil", () => {
    const v = batchVerdict({ ...base(), castsPlayed: 1, cleanCasts: 0, oilsConsumed: 1 });
    expect(v.stop).toBe(true);
    expect(v.reason).toBe("oil_consumed");
  });

  it("halts at the six-cast clean cap", () => {
    const v = batchVerdict({ ...base(), castsPlayed: 6, cleanCasts: 6 });
    expect(v.stop).toBe(true);
    expect(v.reason).toBe("clean_cast_cap");
    // The message must not read as a budget — §2c's whole point.
    expect(v.detail).toContain("DO NOT extend");
  });

  it("halts when the day's cast ledger is exhausted", () => {
    const v = batchVerdict({ ...base(), ledgerCastsRemaining: 0 });
    expect(v.stop).toBe(true);
    expect(v.reason).toBe("ledger_exhausted");
  });

  it("halts when BOTH oils are dry, because the exit is then unreachable", () => {
    const v = batchVerdict({ ...base(), focusOilHeld: 0, relaxingOilHeld: 0 });
    expect(v.stop).toBe(true);
    expect(v.reason).toBe("stock_dry");
  });

  it("halts on the zero-streak tripwire", () => {
    const v = batchVerdict({ ...base(), zeroStreak: SESSION_64_LIMITS.zeroStreakCap });
    expect(v.stop).toBe(true);
    expect(v.reason).toBe("zero_streak");
  });
});

describe("batchVerdict — precedence when conditions collide", () => {
  it("reports a consume as the intended exit even if the ledger also emptied", () => {
    // A batch that did exactly what was asked must not be recapped as an
    // exhaustion. This is the case a naive if-order gets backwards.
    const v = batchVerdict({ ...base(), oilsConsumed: 1, ledgerCastsRemaining: 0, cleanCasts: 6, zeroStreak: 20 });
    expect(v.reason).toBe("oil_consumed");
  });

  it("reports an exhausted ledger rather than the clean-cast tripwire", () => {
    // Running out of casts says nothing about the trigger model, so it must not
    // be dressed up as the ~1-in-900 finding.
    const v = batchVerdict({ ...base(), cleanCasts: 6, ledgerCastsRemaining: 0 });
    expect(v.reason).toBe("ledger_exhausted");
  });
});
