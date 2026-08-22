/**
 * tests/fishing/fishMaxHp.test.ts — [session 80 §3] the fish's max HP is a
 * DISTRIBUTION live, the simulator can now sample it, and **the default has not
 * moved.**
 *
 * The last part is the point of most of this file. An opt-in that quietly
 * changes the default is how a repo's whole figure set gets rebased without
 * anyone deciding to, and this simulator's figures are quoted in
 * `OIL-POLICY.md`, `SPEC-fishing.md` and four scripts' headers. So the default
 * path is pinned byte-for-byte against values recorded before the option
 * existed.
 *
 * What this is NOT: an answer to §0a. §1 measured that gap as a per-play drift
 * carried by the hit rate; `fishMaxHp` is a per-cast quantity and does not
 * touch it. Adding the distribution is right and it is a different repair.
 */

import { describe, expect, it } from "vitest";

import {
  buildFishMaxHpSampler,
  fishMaxHpCounts,
  fishMaxHpIsConstantWithinCast,
  meanFishMaxHp,
  meanOpeningRatio,
} from "../../src/sim/fishing/fishMaxHp.js";
import { loadCastTraces } from "../../src/sim/fishing/castTrace.js";
import { matcherFishPolicy, simulateCasts } from "../../src/sim/fishing/castSim.js";
import { makeRng } from "../../src/sim/rng.js";
import { REAL_DECK } from "../../src/sim/fishing/rodDeck.js";

const ALL = loadCastTraces();

describe("the corpus fact, re-derived on every run", () => {
  it("reports many distinct fishMaxHp values, not the simulator's one", () => {
    const counts = fishMaxHpCounts(ALL);
    expect(counts.size).toBeGreaterThanOrEqual(8);
    // A band rather than a pin: the corpus grows. What must not change is that
    // this is a distribution and that its centre sits below the sim's 21.
    expect(meanFishMaxHp(ALL)).toBeGreaterThan(16);
    expect(meanFishMaxHp(ALL)).toBeLessThan(20);
  });

  it("holds fishMaxHp constant within a cast — which is why the sampler fires once per cast", () => {
    expect(fishMaxHpIsConstantWithinCast(ALL)).toBe(true);
  });

  it("already agrees with the simulator on the opening RATIO — the centre was never the problem", () => {
    // `REAL_PARAMS.startFishHpRatio` is 13/21 = 0.6190.
    expect(Math.abs(meanOpeningRatio(ALL) - 13 / 21)).toBeLessThan(0.03);
  });
});

describe("buildFishMaxHpSampler", () => {
  it("draws only values the corpus produced, in roughly their observed proportion", () => {
    const counts = fishMaxHpCounts(ALL);
    const sampler = buildFishMaxHpSampler(ALL);
    const rng = makeRng(7);
    const drawn = new Map<number, number>();
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const v = sampler(rng);
      expect(counts.has(v)).toBe(true);
      drawn.set(v, (drawn.get(v) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    for (const [value, count] of counts) {
      if (count < 10) continue; // thin cells carry too little to check at this N
      expect(Math.abs((drawn.get(value) ?? 0) / N - count / total)).toBeLessThan(0.03);
    }
  });

  it("throws rather than quietly returning a constant when there is nothing to sample", () => {
    expect(() => buildFishMaxHpSampler([])).toThrow(/no traces carry a fishMaxHp/);
  });
});

describe("the option is OPT-IN, and the default is pinned", () => {
  const board = { startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;
  const opts = { policy: matcherFishPolicy, deckIds: [...REAL_DECK], matcherPool: [] as [], ...board };

  it("leaves the default path byte-for-byte where it was before the option existed", () => {
    // MEASURED at commit abf1aaf9, before `fishMaxHpSampler` was added, on the
    // blind arm at the real board — not transcribed from a script run at a
    // different n. Full precision on purpose: a rounded pin cannot fail on a
    // change small enough to be interesting.
    const s = simulateCasts(2000, { ...opts, fishMaxHp: 21 }, 1);
    expect(s.hitRate).toBe(0.4249543200208823);
    expect(s.catchRate).toBe(0);
    expect(s.meanFinalFishHp).toBe(13.609);
    expect(s.meanTurns).toBe(4.9155);
  });

  it("moves the outcome when it IS supplied — otherwise the option would be inert", () => {
    // An option nobody can watch change something is indistinguishable from a
    // no-op: session 75's discipline for the redraw fix, applied to a feature.
    const fixed = simulateCasts(2000, { ...opts, fishMaxHp: 21 }, 1);
    const sampled = simulateCasts(2000, { ...opts, fishMaxHpSampler: buildFishMaxHpSampler(ALL) }, 1);
    expect(sampled.meanFinalFishHp).not.toBe(fixed.meanFinalFishHp);
    // The measured distribution's mean sits below 21, so the sampled arm faces
    // easier fish on average. Direction, not magnitude.
    expect(sampled.meanFinalFishHp).toBeLessThan(fixed.meanFinalFishHp);
    // And the movement is in the loss MIX, which is the interesting part: this
    // arm cannot produce a single fish-at-full escape at a fixed 21 and
    // produces 392 of 2000 once the max HP varies. A simulator whose fish are
    // all identically tough cannot lose the way the fishery loses.
    expect(fixed.escapedFishFull).toBe(0);
    expect(sampled.escapedFishFull).toBeGreaterThan(300);
  });

  it("draws from its OWN rng stream — the fish and the card choices do not move", () => {
    // The load-bearing scoping decision, and the same one session 79 made for
    // the draw pile. Taking one number off the main stream would shift every
    // later draw, so enabling this would change the fish's trajectory AND its
    // HP, and no A/B could separate the two. Byte-for-byte equality on two
    // quantities that depend on the trajectory is the proof.
    const fixed = simulateCasts(2000, { ...opts, fishMaxHp: 21 }, 1);
    const sampled = simulateCasts(2000, { ...opts, fishMaxHpSampler: buildFishMaxHpSampler(ALL) }, 1);
    expect(sampled.hitRate).toBe(fixed.hitRate);
    expect(sampled.meanTurns).toBe(fixed.meanTurns);
  });
});
