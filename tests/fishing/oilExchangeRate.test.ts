/**
 * tests/fishing/oilExchangeRate.test.ts — [session 69 §3, GATE 2]
 *
 * **The probabilistic hold threshold, pinned as a DERIVATION rather than as a
 * number.**
 *
 * The user asked for a probabilistic threshold on top of the certainty gate.
 * Standing guidance says not to tune one: session 67 measured every threshold
 * from 0.25 to 1 landing on the same plateau, and a constant fitted on a
 * simulator whose control arm catches 68.71% against a real fishery's 25.9% is
 * a constant somebody later has to defend. The resolution is that this
 * threshold is not fitted — it is `1 - v`, where `v` is what one oil is worth
 * in fish, and `v` was MEASURED (session 66: ~6 oils per extra fish).
 *
 * So the assertions below are about the derivation holding, not about 0.8333
 * being written down somewhere. Change the measured rate and the threshold
 * must move with it; change the threshold without the rate and this file goes
 * red.
 *
 * ## The gate must fail at BOTH degeneracies — and the sim cannot show it
 *
 * `oilNecessity.test.ts` pins the certainty gate by running 2000 seeded casts
 * and requiring it to sit strictly between never-fire and always-fire. **That
 * instrument does not work here, and the reason is itself the session's most
 * important negative result:**
 *
 *     never                  oils     0   caught 68.71%
 *     on-demand              oils  5578   caught 88.11%
 *     conserve{1,1}          oils  3809   caught 88.38%
 *     exchange{0.833,1}      oils  3809   caught 88.38%     <-- IDENTICAL
 *     exchange-lo{0.333,1}   oils  3618   caught 88.33%
 *     exchange-hi{0.95,1}    oils  3809   caught 88.38%
 *
 * (n=8000/arm, paired on seed, `MEASURED_CONSUME_COSTS_TURN=false`.)
 *
 * In the SIMULATOR the derived threshold is byte-identical to the certainty
 * gate, because the sim's `bestKillProbability` puts no mass at all in
 * `[0.833, 1)`. **Live it does**: of the four Relaxing firings on the whole
 * live record, the values are 0.400, 0.580, 0.587 and 0.975 — not one of them
 * exactly 0 or exactly 1, and the last one sits in precisely the band the sim
 * says is empty. The threshold's entire effect lives in a band the simulator
 * cannot see.
 *
 * That has a consequence for how it must be tested, and one for how it must be
 * reported. The degeneracy pins below are STATE-LEVEL, on states with a
 * controlled kill probability, because an aggregate over a distribution with a
 * hole in it proves nothing about the hole. And **no sim-derived saving may be
 * quoted for this threshold** — there isn't one; the last test in this file
 * pins that absence so a future report cannot invent it.
 */

import { describe, expect, it } from "vitest";

import {
  ALWAYS_FIRES_THRESHOLD,
  NEVER_FIRES_THRESHOLD,
  MEASURED_CONSUME_COSTS_TURN,
  MEASURED_RELAXING_OILS_PER_EXTRA_FISH,
  MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL,
  PAYLOAD_OIL_EFFECTS,
  PREREGISTERED_EXCHANGE_THRESHOLDS,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  bestKillProbability,
  conserving,
  conservingByExchangeRate,
  conservingOil,
  holdThresholdFromExchangeRate,
  onDemandTriggers,
  type OilTimingPolicy,
} from "../../src/strategy/fishing/oilTiming.js";
import { matcherFishPolicy, simulateCast } from "../../src/sim/fishing/castSim.js";
import { board, card, distAt, oilState } from "../helpers/oilDecisionState.js";

const E = PAYLOAD_OIL_EFFECTS;
const MASS_CELL = { x: 2, y: 2 };

/**
 * A lethal-band state whose `bestKillProbability` is exactly `p`.
 *
 * The construction, because it is the instrument every degeneracy claim below
 * reads: one card covering only the centre zone, the whole distribution's mass
 * `p` on the focus cell itself, and damage well above the fish's HP — so the
 * card kills iff it connects, and it connects with probability `p`. A meter of
 * 1 keeps the FOCUS trigger from firing, so the state exercises the Relaxing
 * arm alone and a change here cannot be confounded with the other oil.
 */
function stateWithKillProbability(p: number) {
  return oilState({
    fishHp: E.fishDamage,
    focusRemaining: 1,
    focusCell: MASS_CELL,
    board: board({ hand: [card({ hitZones: [5], hitEffects: [{ amount: 9 }] })], dist: distAt(MASS_CELL, p) }),
  });
}

/** Oils spent and fish caught by a policy over a fixed seeded block — the same instrument `oilNecessity.test.ts` uses. */
function oilsOver(p: OilTimingPolicy, casts = 2000): { oils: number; caught: number } {
  let oils = 0;
  let caught = 0;
  for (let i = 0; i < casts; i++) {
    const r = simulateCast({
      policy: matcherFishPolicy,
      seed: 1 + i,
      oils: { policy: p, costsTurn: MEASURED_CONSUME_COSTS_TURN, effects: E, focusOilHeld: 1, relaxingOilHeld: 1 },
    });
    oils += r.oilsUsed.length;
    if (r.outcome === "caught") caught++;
  }
  return { oils, caught };
}

describe("the instrument is real before anything is concluded from it", () => {
  it("builds states whose kill probability is exactly what was asked for", () => {
    for (const p of [0, 0.25, 0.5, 0.9, 1]) {
      expect(bestKillProbability(stateWithKillProbability(p))).toBeCloseTo(p, 12);
    }
  });

  it("and every one of them is a moment the LETHAL trigger really fires on", () => {
    // Otherwise the gate is never consulted and each assertion below is about
    // a decision that was not taken — the vacuity route session 68 named.
    for (const p of [0, 0.5, 0.9, 1]) {
      expect(onDemandTriggers(stateWithKillProbability(p), E)).toEqual(["relaxing"]);
    }
  });
});

describe("GATE 2 — the threshold is DERIVED from the measured exchange rate", () => {
  it("is `1 - 1/rate`, computed from the rate rather than written down", () => {
    expect(PREREGISTERED_EXCHANGE_THRESHOLDS.relaxing).toBe(
      holdThresholdFromExchangeRate(MEASURED_RELAXING_OILS_PER_EXTRA_FISH),
    );
    expect(PREREGISTERED_EXCHANGE_THRESHOLDS.relaxing).toBeCloseTo(1 - 1 / 6, 12);
  });

  it("TRACKS the rate — a re-measurement moves the threshold, which is the point", () => {
    expect(holdThresholdFromExchangeRate(2)).toBeCloseTo(0.5, 12);
    expect(holdThresholdFromExchangeRate(4)).toBeCloseTo(0.75, 12);
    expect(holdThresholdFromExchangeRate(20)).toBeCloseTo(0.95, 12);
    // A cheaper oil is held less readily; a dearer one more. Monotone, so the
    // derivation cannot be satisfied by a lookup table that happens to fit.
    expect(holdThresholdFromExchangeRate(3)).toBeLessThan(holdThresholdFromExchangeRate(10));
  });

  it("an oil worth more than a whole fish degenerates to the NAMED endpoint, not to a negative threshold", () => {
    expect(holdThresholdFromExchangeRate(0.5)).toBe(NEVER_FIRES_THRESHOLD);
    expect(() => holdThresholdFromExchangeRate(0)).toThrow();
  });

  it("the measurement's INTERVAL spans two genuinely different policies — so the point estimate never travels alone", () => {
    const [lo, hi] = MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL;
    const tLo = holdThresholdFromExchangeRate(lo);
    const tHi = holdThresholdFromExchangeRate(hi);
    expect(tLo).toBeCloseTo(1 / 3, 12);
    expect(tHi).toBeCloseTo(0.95, 12);
    // At p = 0.5 the two ends disagree about the same decision. That is what
    // makes quoting 0.83 without [0.33, 0.95] an overstatement rather than a
    // rounding.
    const s = stateWithKillProbability(0.5);
    expect(conservingOil({ relaxing: tLo, focus: 1 }).decide(s, E)).toEqual([]);
    expect(conservingOil({ relaxing: tHi, focus: 1 }).decide(s, E)).toEqual(["relaxing"]);
  });
});

describe("GATE 2 — it fails at BOTH degeneracies", () => {
  const alwaysHold = conservingOil({ relaxing: NEVER_FIRES_THRESHOLD, focus: NEVER_FIRES_THRESHOLD });
  const alwaysFire = conservingOil({ relaxing: ALWAYS_FIRES_THRESHOLD, focus: ALWAYS_FIRES_THRESHOLD });

  it("is NOT always-hold: below the threshold it really spends the oil", () => {
    const s = stateWithKillProbability(0.5);
    expect(conservingByExchangeRate.decide(s, E)).toEqual(["relaxing"]);
    expect(alwaysHold.decide(s, E)).toEqual([]);
  });

  it("is NOT always-fire: above the threshold it really holds the oil", () => {
    const s = stateWithKillProbability(0.9);
    expect(conservingByExchangeRate.decide(s, E)).toEqual([]);
    expect(alwaysFire.decide(s, E)).toEqual(["relaxing"]);
  });

  it("and it is not the CERTAINTY gate either — 0.9 is the case the two disagree on", () => {
    // This is the whole delta the user asked for: `conserve{1,1}` spends here
    // because 0.9 is not certainty; the exchange rate says a 10% loss is not
    // worth an oil valued at 17% of a fish.
    const s = stateWithKillProbability(0.9);
    expect(conserving.decide(s, E)).toEqual(["relaxing"]);
    expect(conservingByExchangeRate.decide(s, E)).toEqual([]);
    expect(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing).toBe(1);
  });

  it("the boundary is exactly the derived value, checked from both sides", () => {
    const t = PREREGISTERED_EXCHANGE_THRESHOLDS.relaxing;
    expect(conservingByExchangeRate.decide(stateWithKillProbability(t + 1e-6), E)).toEqual([]);
    expect(conservingByExchangeRate.decide(stateWithKillProbability(t - 1e-6), E)).toEqual(["relaxing"]);
  });
});

describe("GATE 2 — the FOCUS arm is deliberately not given this threshold", () => {
  it("stays at 1, because the derivation prices a lethal oil and a Focus Oil is not one", () => {
    // `(1 - p)` is a number of FISH only for an oil that converts an uncertain
    // catch into a certain one. The Focus Oil restores meter; no corpus-measured
    // oils-per-extra-fish exists for its trigger. Borrowing the Relaxing number
    // would be the fitted constant this construction exists to avoid.
    expect(PREREGISTERED_EXCHANGE_THRESHOLDS.focus).toBe(1);
    expect(PREREGISTERED_EXCHANGE_THRESHOLDS.focus).not.toBe(PREREGISTERED_EXCHANGE_THRESHOLDS.relaxing);
  });
});

describe("the SIMULATOR cannot see this threshold, and that absence is pinned", () => {
  it("is byte-identical to the certainty gate over 2000 seeded casts — so no sim saving may be quoted", () => {
    // If this ever fails, the sim's `bestKillProbability` has gained mass in
    // [0.833, 1) and the negative result in this file's header is stale. That
    // is a finding to report, not a test to relax.
    const gate = oilsOver(conserving);
    const exch = oilsOver(conservingByExchangeRate);
    expect(exch.oils).toBe(gate.oils);
    expect(exch.caught).toBe(gate.caught);
  });

  it("but the dial is still live in the sim at the interval's LOW end — the code is not inert", () => {
    // Distinguishes "the sim has no mass in this particular band" from "the
    // threshold does nothing", which are very different claims about the same
    // green test above.
    const lo = oilsOver(conservingOil({ relaxing: holdThresholdFromExchangeRate(MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL[0]), focus: 1 }));
    const gate = oilsOver(conserving);
    expect(lo.oils).toBeLessThan(gate.oils);
  });
});
