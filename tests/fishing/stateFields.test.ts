/**
 * tests/fishing/stateFields.test.ts — [session 48, brief §2]
 *
 * Corpus-pinned guards for the two SPEC-fishing.md §4 claims re-scored by the
 * `[CONFIRMED]` falsifiability pass. Both were marked CONFIRMED against
 * samples that could not have falsified them; both survive re-scoring, and
 * these tests are what stops that from drifting again.
 *
 * Reads the committed fixture tree; writes nothing (CLAUDE.md's
 * tests-never-touch-a-real-data-path rule — `fixtures/` is source).
 */

import { describe, expect, it } from "vitest";

import { loadCastTraces, isCleanTrace } from "../../src/sim/fishing/castTrace.js";
import {
  auditFocusMeter,
  auditFishHp,
  correctedZoneOffset,
  transposedZoneOffset,
} from "../../src/sim/fishing/stateFieldAudit.js";

describe("SPEC-fishing §4 state-field claims, re-scored against the corpus", () => {
  const traces = loadCastTraces().filter(isCleanTrace);

  it("focusMeter falls by exactly the Manhattan distance moved, exceptionless", () => {
    const r = auditFocusMeter(traces);
    expect(r.scored).toBeGreaterThanOrEqual(308);
    expect(r.violations).toEqual([]);
    expect(r.agree).toBe(r.scored);
  });

  /**
   * [session 64] Still exceptionless — but the claim is now explicitly about
   * CARD PLAY, and it took the first live oil to make that distinction real.
   *
   * A Mid Focus Oil restored the meter 0 -> 2 mid-cast (13019015, between
   * turns 7 and 8), which is a regeneration by design. `auditFocusMeter` skips
   * transitions spanning a consumable and counts them in `oilSkipped`, so the
   * exception is VISIBLE rather than absorbed. Asserting `oilSkipped` here is
   * the point: a skip that nobody counts is how a denominator quietly stops
   * meaning anything.
   */
  it("never regenerates the focus meter within a cast — across CARD PLAY", () => {
    const r = auditFocusMeter(traces);
    expect(r.regenObserved).toBe(0);
    // [session 65] 1 -> 5 across the seven-cast batch. The claim is unmoved and
    // the mechanism is unchanged; what grew is the number of transitions that
    // are VISIBLY excluded rather than silently averaged in. 464/464 agree with
    // regen 0 — every consumable transition accounted for and none of them
    // quietly counted as card play.
    expect(r.oilSkipped).toBe(5);
  });

  it("fishHp moves by exactly the played card's FISH_HP effect, exceptionless", () => {
    const r = auditFishHp(traces);
    expect(r.scored).toBeGreaterThanOrEqual(308);
    expect(r.violations).toEqual([]);
    expect(r.agree).toBe(r.scored);
  });

  it("identifies crits by critZone geometry — and that test discriminates the zone table", () => {
    // This is the point: `critEffects` damage at a `critZones` cell is a
    // second, independent check on session 47's ZONE_OFFSET correction, on a
    // zone set and an observable the hit/miss audit never touches. If the
    // transpose scored equally here, this test would be worthless — so the
    // inequality is asserted, not just the pass.
    const corrected = auditFishHp(traces, correctedZoneOffset);
    const transposed = auditFishHp(traces, transposedZoneOffset);
    expect(corrected.agree).toBe(corrected.scored);
    // [session 50] 8 → 10 across this session's live batch, every one again
    // exactly `critEffects` at a cell inside the card's TRANSLATED
    // `critZones`. The discrimination is now 391/391 with 10 crits for the
    // corrected table against 383/391 with 2 for the transposed one — the
    // inequalities below are what assert that gap rather than just the pass.
    // [session 64] 10 -> 13 across this session's 7 live casts, same pattern:
    // each new crit is `critEffects` at a cell inside the card's TRANSLATED
    // `critZones`. The discriminating inequalities below are what carry the
    // claim; the count is a census figure and moves with the corpus.
    // [session 65] 13 -> 17 across the seven-cast batch, same pattern again.
    expect(corrected.crits).toBe(17);
    expect(transposed.agree).toBeLessThan(transposed.scored);
    expect(transposed.crits).toBeLessThan(corrected.crits);
  });
});
