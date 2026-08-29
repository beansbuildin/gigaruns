/**
 * tests/fishing/redrawShadowAnalysis.test.ts — [session 99 §3] the arithmetic
 * behind the §26 shadow verdict, and the guard that keeps its two arms honest.
 *
 * **Deliberately does NOT read `logs/`.** The out-of-sample arm exists only on
 * the machine that played the casts (`logs/` is gitignored), so a test that
 * asserted anything about it would pass or fail depending on whose checkout it
 * ran in. What IS reproducible anywhere is the exact statistics and the
 * in-sample arm, and those are what is pinned here.
 *
 * The statistics are the part worth testing: the whole §3 deliverable is a
 * power computation, and a power computation that is quietly wrong reads
 * exactly like one that is right.
 */
import { describe, expect, it } from "vitest";

import {
  binomPmf,
  exactBinomTest,
  exactCi,
  exactPower,
  inSampleRate,
} from "../../scripts/redrawShadowAnalysis.js";
import {
  REDRAW_SHADOW_COVERAGE_K,
  REDRAW_SHADOW_MIN_BUDGET,
} from "../../src/strategy/fishing/redrawShadow.js";
import { REDRAW_SHADOW_IN_SAMPLE_RATE_PCT } from "../../scripts/liveFishing.js";

describe("the exact statistics — checked against values computable by hand", () => {
  it("binomPmf is a probability mass function", () => {
    for (const [n, p] of [[10, 0.3], [25, 0.05], [170, 0.0307]] as const) {
      let s = 0;
      for (let k = 0; k <= n; k++) s += binomPmf(k, n, p);
      expect(s).toBeCloseTo(1, 9);
    }
    // Closed forms, so a broken lgamma cannot hide behind a plausible curve.
    expect(binomPmf(0, 5, 0.5)).toBeCloseTo(1 / 32, 12);
    expect(binomPmf(2, 4, 0.5)).toBeCloseTo(6 / 16, 12);
    expect(binomPmf(3, 3, 0.25)).toBeCloseTo(1 / 64, 12);
  });

  it("Clopper-Pearson reproduces the textbook interval, and its endpoints are exact", () => {
    // 0/10 has the closed form [0, 1 - (alpha/2)^(1/n)] on the upper side.
    const [lo0, hi0] = exactCi(0, 10);
    expect(lo0).toBe(0);
    expect(hi0).toBeCloseTo(1 - Math.pow(0.025, 1 / 10), 6);
    // n/n mirrors it.
    const [lo1, hi1] = exactCi(10, 10);
    expect(hi1).toBe(1);
    expect(lo1).toBeCloseTo(Math.pow(0.025, 1 / 10), 6);
    // The standard worked example: 2 of 20.
    const [lo, hi] = exactCi(2, 20);
    expect(lo).toBeCloseTo(0.0123, 3);
    expect(hi).toBeCloseTo(0.3170, 3);
  });

  it("the interval always covers the point estimate, and widens as n shrinks", () => {
    for (const [k, n] of [[6, 170], [3, 40], [1, 2]] as const) {
      const [lo, hi] = exactCi(k, n);
      expect(lo).toBeLessThanOrEqual(k / n);
      expect(hi).toBeGreaterThanOrEqual(k / n);
    }
    const wide = exactCi(1, 2);
    const narrow = exactCi(85, 170);
    expect(wide[1] - wide[0]).toBeGreaterThan(narrow[1] - narrow[0]);
  });

  it("the exact binomial test is symmetric under relabelling and sane at the extremes", () => {
    expect(exactBinomTest(5, 10, 0.5)).toBeCloseTo(1, 9);
    expect(exactBinomTest(5, 10, 0.5)).toBeCloseTo(exactBinomTest(5, 10, 0.5), 12);
    expect(exactBinomTest(0, 20, 0.5)).toBeCloseTo(2 * Math.pow(0.5, 20), 9);
    expect(exactBinomTest(0, 10, 0.001)).toBeGreaterThan(0.5);
  });

  it("power rises with n and with the effect size, and equals alpha at no effect", () => {
    const p0 = 0.0307;
    // At p1 = p0 the "power" is just the test's realised size, which for an
    // exact test is at or below alpha — never above it. This is the assertion
    // that catches a power function computing the wrong tail.
    expect(exactPower(170, p0, p0)).toBeLessThanOrEqual(0.05);
    expect(exactPower(170, p0, 3 * p0)).toBeGreaterThan(exactPower(170, p0, 2 * p0));
    expect(exactPower(400, p0, 2 * p0)).toBeGreaterThan(exactPower(170, p0, 2 * p0));
  });

  it("REPRODUCES §3's HEADLINE NUMBERS — the ones the recap quotes", () => {
    const p0 = 0.030741410488245932; // the in-sample rate, pinned below
    // 6 of 170 is not distinguishable from the in-sample rate.
    expect(exactBinomTest(6, 170, p0)).toBeGreaterThan(0.05);
    expect(exactBinomTest(6, 170, p0)).toBeCloseTo(0.65, 1);
    const [lo, hi] = exactCi(6, 170);
    expect(lo).toBeCloseTo(0.0131, 3);
    expect(hi).toBeCloseTo(0.0752, 3);
    // ⚠ THE LOAD-BEARING HALF: n=170 is underpowered against anything short of
    // a ~2.4x departure. A future reader quoting the non-rejection without
    // this number is quoting an absence of evidence as evidence of absence.
    expect(exactPower(170, p0, 2 * p0)).toBeLessThan(0.8);
    expect(exactPower(170, p0, 2 * p0)).toBeCloseTo(0.60, 1);
    expect(exactPower(170, p0, 2.38 * p0)).toBeGreaterThanOrEqual(0.8);
    expect(exactPower(350, p0, 2 * p0)).toBeGreaterThanOrEqual(0.8);
  });
});

describe("the in-sample arm — reproducible from the committed corpus", () => {
  it("computes the shadowed rule's firing rate on the corpus, both clauses", () => {
    const r = inSampleRate();
    expect(REDRAW_SHADOW_COVERAGE_K).toBe(6);
    expect(REDRAW_SHADOW_MIN_BUDGET).toBe(1);
    expect(r.plays).toBe(643); // [session 99] the 210-cast corpus /* [session 102] was 553 */ /* [session 105] was 592 */  /* [session 107] was 605 */
    expect(r.fires).toBe(19); /* [session 102] was 17 */ /* [session 105] was 18 */
    expect(r.rate).toBeCloseTo(0.029548989113530325, 12); /* [session 102] was 0.030741410488245932 (17/553) */ /* [session 105] was 0.030405405405405407 */  /* [session 107] was 0.03140495867768595 */
  });

  it("⚠ the live loop's PRINTED in-sample rate is this number, not a stale one", () => {
    // scripts/liveFishing.ts prints "in-sample X%" beside every batch's shadow
    // line as an operator hint. It was hard-coded at 2.7% in session 90 and the
    // corpus has grown by 42 casts since, so it had drifted to 3.07% by the
    // time anyone compared the two. Pinned here so the next drift is loud.
    // [session 102] Asserted against the CONSTANT rather than a second
    // literal. The session-99 version wrote `3.1` here too, so the pin and the
    // thing it pins had to be edited together by hand — one more place to go
    // stale. Now the only number in the loop is the one the loop prints.
    expect((100 * inSampleRate().rate).toFixed(1)).toBe(REDRAW_SHADOW_IN_SAMPLE_RATE_PCT);
  });
});
