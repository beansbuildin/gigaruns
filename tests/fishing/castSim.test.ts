/**
 * tests/fishing/castSim.test.ts — Task 8's gate: "Sim over 500 synthetic
 * casts beats random card choice on catch rate."
 *
 * The true fish pattern is drawn from the same synthetic pool the matcher
 * searches (`src/sim/fishing/patterns.ts`'s header explains why that's the
 * right internal-consistency scope for this gate — it tests the algorithm,
 * not real Dendren, which stays unknown until Task 9's live logging).
 */

import { describe, expect, it } from "vitest";

import { matcherFishPolicy, randomFishPolicy, simulateCast, simulateCasts } from "../../src/sim/fishing/castSim.js";

describe("Task 8 gate — matcher-driven card choice vs random", () => {
  it("beats random card choice on catch rate over 500 synthetic casts", () => {
    const runs = 500;
    const random = simulateCasts(runs, { policy: randomFishPolicy }, 1);
    const matcher = simulateCasts(runs, { policy: matcherFishPolicy }, 1);

    expect(matcher.catchRate).toBeGreaterThan(random.catchRate);
    // Not a razor's-edge win — the matcher should be meaningfully better,
    // not just noise at n=500.
    expect(matcher.caught).toBeGreaterThan(random.caught * 1.2);
  });

  it("never exceeds maxTurns and always resolves to a real outcome", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulateCast({ policy: matcherFishPolicy, maxTurns: 40, seed });
      expect(["caught", "escaped_meter", "escaped_mana", "stalled"]).toContain(r.outcome);
      expect(r.turns).toBeLessThanOrEqual(40);
      expect(r.turns).toBeGreaterThan(0);
      expect(r.finalFishHp).toBeGreaterThanOrEqual(0);
    }
  });
});
