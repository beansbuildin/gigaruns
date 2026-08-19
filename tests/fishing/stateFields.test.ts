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

  it("never regenerates the focus meter within a cast", () => {
    expect(auditFocusMeter(traces).regenObserved).toBe(0);
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
    expect(corrected.crits).toBe(4);
    expect(transposed.agree).toBeLessThan(transposed.scored);
    expect(transposed.crits).toBeLessThan(corrected.crits);
  });
});
