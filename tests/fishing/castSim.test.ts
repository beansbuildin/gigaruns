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

/**
 * Session 14 — SPEC.md §5 / handoff/DECISIONS.md: `focusMeter` (confirmed
 * live session 13) is now modelled here. This alone drops the matcher's
 * 500-cast catch rate from session 13's 92.4% to ~70% — real, but nowhere
 * near session-13-brief's live 0/6 result (P(0/6) at 70% is ~0.05%, still
 * implausible). The dominant explanation turns out to be a SEPARATE gap:
 * the sim's true fish pattern is always drawn from the same synthetic pool
 * the matcher searches, so the matcher can always, in principle, identify
 * it — unlike real Dendren, where the pattern library is still unknown and
 * every live cast ran on `emptyFallback`/uniform the whole time (STATE.md
 * session 13). `matcherPool: []` reproduces that: catch rate collapses to
 * ~7-10%, statistically indistinguishable from the random baseline and
 * consistent with the live 0/6 result (P(0/6) ~60%). See
 * `scripts/fishFocusMeter.ts` for the full comparison this pins down.
 */
describe("session 14 — focusMeter modelled, and the library-mismatch diagnostic", () => {
  it("focusMeter constrains focus placement: matcher-ev still beats random, but well below the unconstrained 92.4% figure", () => {
    const runs = 500;
    const matcher = simulateCasts(runs, { policy: matcherFishPolicy }, 1);
    // Real, substantial drop from session 13's unconstrained 92.4% — not
    // noise at n=500 (session 13's own 500-cast sweep treated a similar gap
    // as meaningful). Pinned as a range, not an exact value, since the RNG
    // stream shifted when `castSim.ts` started drawing focus-budget state.
    expect(matcher.catchRate).toBeLessThan(0.85);
    expect(matcher.catchRate).toBeGreaterThan(0.5);
  });

  it("a matcher blind to the true pattern (matcherPool: []) performs near the random baseline, not near the informed matcher", () => {
    const runs = 500;
    const random = simulateCasts(runs, { policy: randomFishPolicy }, 1);
    const blind = simulateCasts(runs, { policy: matcherFishPolicy, matcherPool: [] }, 1);
    const informed = simulateCasts(runs, { policy: matcherFishPolicy }, 1);

    // Blind is nowhere near the informed matcher's rate...
    expect(blind.catchRate).toBeLessThan(informed.catchRate / 3);
    // ...and close enough to random that the matcher's real edge is
    // entirely attributable to knowing the pattern library, not to any
    // other part of `chooseCard`'s logic (lethal check, mana gating, etc).
    expect(Math.abs(blind.catchRate - random.catchRate)).toBeLessThan(0.08);
  });
});
