/**
 * tests/fishing/reversalDispersion.test.ts — [session 51 §6]
 *
 * The chi-square tail is hand-rolled numerical code whose output decides
 * whether a per-cast reversal parameter gets built, so it is pinned against
 * values from a standard table rather than trusted.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { chiSquareUpperTail, reversalDispersion } from "../../scripts/reversalDispersion.js";
import { loadTransitionRecords } from "../../src/sim/fishing/transitionCorpus.js";
import { existsSync } from "node:fs";
import { announceMissingAuthorData, probeAuthorData } from "../helpers/authorData.js";

const CORPUS = join("data", "fish-patterns.jsonl");
const corpusProbe = probeAuthorData(CORPUS, () => {
  if (!existsSync(CORPUS)) throw new Error("absent (not shipped — it is the author's mined corpus)");
  if (loadTransitionRecords(CORPUS).length === 0) throw new Error("present but empty");
});
announceMissingAuthorData("tests/fishing/reversalDispersion.test.ts", corpusProbe);
import { join } from "node:path";

describe("chiSquareUpperTail", () => {
  it("matches standard-table critical values", () => {
    // p = 0.05 critical values: chi2(1) = 3.841, chi2(10) = 18.307, chi2(23) = 35.172
    expect(chiSquareUpperTail(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquareUpperTail(18.307, 10)).toBeCloseTo(0.05, 3);
    expect(chiSquareUpperTail(35.172, 23)).toBeCloseTo(0.05, 3);
    // The median of chi2(k) is ~k - 2/3
    expect(chiSquareUpperTail(23 - 2 / 3, 23)).toBeCloseTo(0.5, 2);
  });

  it("is monotone decreasing in x, and bounded to [0, 1]", () => {
    let prev = 1;
    for (const x of [0, 1, 5, 10, 23, 50, 200]) {
      const p = chiSquareUpperTail(x, 23);
      expect(p).toBeLessThanOrEqual(prev + 1e-12);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      prev = p;
    }
  });
});

/**
 * **[session 68 §3] AUTHOR DATA.** `data/fish-patterns.jsonl` is the author's
 * mined movement corpus and is correctly not shipped. `chiSquareUpperTail`
 * above is program logic and always runs; this block is a finding ABOUT the
 * corpus and can only mean something when the corpus is there.
 *
 * The load moved out of the describe body for the reason §3a gives: a describe
 * body runs at COLLECTION, so a throw there deletes the tests rather than
 * skipping them.
 */
describe.skipIf(!corpusProbe.ok)("reversalDispersion on the committed corpus", () => {
  // READ-only against `data/fish-patterns.jsonl`; nothing is written.
  let r: ReturnType<typeof reversalDispersion>;
  beforeAll(() => {
    r = reversalDispersion(loadTransitionRecords(CORPUS));
  });

  it("is internally consistent", () => {
    expect(r.pairs).toBeGreaterThan(0);
    expect(r.reversals).toBeLessThanOrEqual(r.pairs);
    expect(r.rate).toBeCloseTo(r.reversals / r.pairs, 12);
    expect(r.df).toBe(Math.max(1, r.casts - 1));
    expect(r.ratio).toBeCloseTo(r.chi2 / r.df, 12);
    expect(r.alwaysReverse + r.neverReverse).toBeLessThanOrEqual(r.casts);
  });

  it("REFUTES the session-51 brief's under-dispersion claim — the number is above 1, not 0.80", () => {
    // Deliberately an inequality against the DIRECTION, not an equality
    // against today's 1.452: the corpus grows and the figure will move. What
    // must not silently revert is the finding that the brief's "at or below
    // binomial, nothing to exploit" does not hold on the real corpus. If this
    // ever fails, the conclusion changed and SPEC-fishing.md's section needs
    // rewriting — which is exactly what should happen.
    expect(r.ratio).toBeGreaterThan(1);
    expect(r.neverReverse).toBeGreaterThan(0);
  });
});
