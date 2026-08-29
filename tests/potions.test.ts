import { describe, expect, it } from "vitest";

import { shouldUsePotion } from "../src/strategy/potions.js";
import { runPotionPolicyFor } from "../scripts/liveRun.js";

describe("shouldUsePotion", () => {
  it("fires at or below the threshold", () => {
    expect(shouldUsePotion(16, 32, 1, 0.5)).toBe(true); // exactly 0.5
    expect(shouldUsePotion(15, 32, 1, 0.5)).toBe(true); // below
  });

  it("does not fire above the threshold", () => {
    expect(shouldUsePotion(17, 32, 1, 0.5)).toBe(false);
  });

  it("never fires with no potions remaining, regardless of HP", () => {
    expect(shouldUsePotion(1, 32, 0, 0.5)).toBe(false);
  });
});

/**
 * [session 108] The chaining regression. `--runs=N` shares one policy object
 * across every run unless it is rebuilt, and `runOnce` mutates that object.
 * Session 108's live batch is the evidence: 4 runs, 12 Big Heal Juice
 * committed and debited at `start_run`, 3 actually fired, 9 wasted.
 */
describe("runPotionPolicyFor", () => {
  const base = { itemId: 131, threshold: 0.5, remaining: 3, used: 0 };

  it("returns undefined when no policy is configured", () => {
    expect(runPotionPolicyFor(undefined, 3, 0, 0)).toBeUndefined();
  });

  it("rearms a policy that a previous run drained to zero", () => {
    const drained = { ...base, remaining: 0, used: 3 };
    const next = runPotionPolicyFor(drained, 3, 1, 0)!;
    expect(next.remaining).toBe(3);
    // `used` indexes THIS run's freshly committed consumables array.
    expect(next.used).toBe(0);
    // The bug in one assertion: a drained policy must not disarm the next run.
    expect(shouldUsePotion(1, 50, next.remaining, next.threshold)).toBe(true);
  });

  it("honours --potions-used only on iteration 0, the only possible resume", () => {
    expect(runPotionPolicyFor(base, 3, 0, 2)!.used).toBe(2);
    expect(runPotionPolicyFor(base, 3, 1, 2)!.used).toBe(0);
  });

  it("hands each run its own object, so mutation cannot leak across runs", () => {
    const first = runPotionPolicyFor(base, 3, 0, 0)!;
    first.remaining--;
    first.used++;
    const second = runPotionPolicyFor(base, 3, 1, 0)!;
    expect(second.remaining).toBe(3);
    expect(second.used).toBe(0);
    expect(base.remaining).toBe(3); // the shared base is never mutated
  });
});
