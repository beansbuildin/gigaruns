/**
 * tests/fishing/matcherPosterior.test.ts — [session 51 §3] the matcher tier's
 * posterior mixture weight.
 *
 * The properties pinned here are the ones the design rests on: the two former
 * arms are limiting cases, refutation is absorbing, one turn cannot dominate,
 * and the prior can never be exactly 0.
 */

import { describe, expect, it } from "vitest";

import {
  initMatcherPosterior,
  matcherPriorFromSupport,
  matcherWeight,
  probabilityOf,
  updateMatcherPosterior,
  DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  type MatcherPosteriorOptions,
} from "../../src/strategy/fishing/matcherPosterior.js";
import type { Distribution } from "../../src/strategy/fishing/stepClass.js";

const opts = (prior: number): MatcherPosteriorOptions => ({ prior, ...DEFAULT_MATCHER_POSTERIOR_OPTIONS });

describe("[session 51 §3] matcherPriorFromSupport", () => {
  it("is the support rate, Laplace-smoothed", () => {
    expect(matcherPriorFromSupport(8, 88)).toBeCloseTo(9 / 90, 12);
  });

  it("never returns exactly 0, even with no supporting cast at all", () => {
    // A 0 prior is unrecoverable in log-odds no matter what the fish then
    // does — the same "we have not seen one yet is not never" failure
    // SWITCH_PROBABILITY_FLOOR exists to prevent.
    expect(matcherPriorFromSupport(0, 0)).toBeGreaterThan(0);
    expect(matcherPriorFromSupport(0, 1000)).toBeGreaterThan(0);
  });
});

describe("[session 51 §3] the posterior weight", () => {
  it("starts at the prior", () => {
    expect(matcherWeight(initMatcherPosterior(0.1), opts(0.1))).toBeCloseTo(0.1, 10);
  });

  it("rises when the matcher outpredicts the ring and falls when it does not", () => {
    const o = opts(0.1);
    let up = initMatcherPosterior(0.1);
    let down = initMatcherPosterior(0.1);
    for (let i = 0; i < 3; i++) {
      up = updateMatcherPosterior(up, 0.8, 0.2, o);
      down = updateMatcherPosterior(down, 0.2, 0.8, o);
    }
    expect(matcherWeight(up, o)).toBeGreaterThan(0.1);
    expect(matcherWeight(down, o)).toBeLessThan(0.1);
  });

  it("REFUTATION is absorbing — a zero-probability observation pins the weight at 0 forever", () => {
    const o = opts(0.9);
    let post = updateMatcherPosterior(initMatcherPosterior(0.9), 0, 0.2, o);
    expect(post.refuted).toBe(true);
    expect(matcherWeight(post, o)).toBe(0);
    // ...and no amount of later agreement resurrects it.
    for (let i = 0; i < 20; i++) post = updateMatcherPosterior(post, 1, 0.01, o);
    expect(matcherWeight(post, o)).toBe(0);
    expect(post.updates).toBe(21);
  });

  it("caps ONE turn's influence — an extreme ratio cannot outweigh the rest of the cast", () => {
    const o = opts(0.1);
    const extreme = updateMatcherPosterior(initMatcherPosterior(0.1), 1, 1e-12, o);
    const capped = updateMatcherPosterior(initMatcherPosterior(0.1), 1, Math.exp(-o.maxLogRatioPerTurn), o);
    expect(extreme.logOdds).toBeCloseTo(capped.logOdds, 10);
  });

  it("never exceeds maxWeight — a point-mass matcher at weight 1 has unbounded loss", () => {
    const o = opts(0.5);
    let post = initMatcherPosterior(0.5);
    for (let i = 0; i < 50; i++) post = updateMatcherPosterior(post, 0.99, 0.01, o);
    expect(matcherWeight(post, o)).toBeLessThanOrEqual(o.maxWeight);
    expect(matcherWeight(post, o)).toBeCloseTo(o.maxWeight, 10);
  });

  it("a turn the ring model called impossible does not move the posterior", () => {
    // pRing <= 0 makes the ratio undefined rather than infinitely favourable.
    const o = opts(0.1);
    const before = initMatcherPosterior(0.1);
    const after = updateMatcherPosterior(before, 0.5, 0, o);
    expect(after.logOdds).toBe(before.logOdds);
    expect(after.updates).toBe(1);
  });

  it("both former arms are limiting cases of the mixture", () => {
    // pi -> maxWeight is the pre-session-51 fixed tier (0.9 = 1 - ringFloor);
    // pi -> 0 is the pure ring model. Anything in between is new behaviour,
    // and neither endpoint is unreachable.
    const o = opts(0.5);
    let hi = initMatcherPosterior(0.5);
    for (let i = 0; i < 40; i++) hi = updateMatcherPosterior(hi, 0.99, 0.01, o);
    expect(matcherWeight(hi, o)).toBeCloseTo(0.9, 6);
    expect(matcherWeight(updateMatcherPosterior(initMatcherPosterior(0.5), 0, 0.5, o), o)).toBe(0);
  });
});

describe("[session 51 §3] probabilityOf", () => {
  it("reads the cell's mass, and treats a missing cell or a null distribution as zero", () => {
    const d: Distribution = new Map([["2,3", { cell: { x: 2, y: 3 }, p: 0.4 }]]);
    expect(probabilityOf(d, { x: 2, y: 3 })).toBeCloseTo(0.4, 12);
    expect(probabilityOf(d, { x: 1, y: 1 })).toBe(0);
    expect(probabilityOf(null, { x: 2, y: 3 })).toBe(0);
  });
});
