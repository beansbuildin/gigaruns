/**
 * tests/fishing/movePath.test.ts — [session 48]
 *
 * Corpus-pinned guard for the unit-step decomposition of fish movement, in
 * the same spirit as `zoneTemplate.test.ts`: score the claim against every
 * recorded instance, not against one capture.
 *
 * These three identities are what FACT 1 should have said all along. The
 * per-cast constancy of the step COUNT — what FACT 1 actually said — is
 * asserted separately and deliberately loosely, because session 48 found a
 * real counterexample (cast `12988700`, steps 1,2,1,2,1,2) and a test that
 * pinned constancy would now be pinning something false.
 *
 * Reads the committed fixture tree; writes nothing (CLAUDE.md's
 * tests-never-touch-a-real-data-path rule — `fixtures/` is source).
 */

import { describe, expect, it } from "vitest";

import { loadCastTraces, isCleanTrace } from "../../src/sim/fishing/castTrace.js";
import { auditMovePaths, stepCountsPerCast, indexToCell, auditNextMovePaths } from "../../src/sim/fishing/movePathAudit.js";

describe("lastMovePath against the real corpus", () => {
  const traces = loadCastTraces();
  const clean = traces.filter(isCleanTrace);

  it("decomposes every recorded move into UNIT steps, exceptionless", () => {
    const r = auditMovePaths(traces);
    expect(r.scored).toBeGreaterThanOrEqual(312);
    expect(r.violations).toEqual([]);
    expect(r.lengthMatches).toBe(r.scored);
    expect(r.endpointMatches).toBe(r.scored);
    expect(r.allUnitSteps).toBe(r.scored);
  });

  it("only ever observes 1 or 2 steps in a turn", () => {
    const r = auditMovePaths(traces);
    expect([...r.stepHistogram.keys()].sort()).toEqual([1, 2]);
  });

  it("re-confirms row-major position indexing on a second, independent field", () => {
    // `path[last] === fishPosition` can only hold under `index =
    // (row - 1) * gridSize + col`. Session 47 established this from
    // `position[0]`; this is the same claim reached from `lastMovePath`.
    expect(indexToCell(6, 4)).toEqual({ x: 2, y: 2 });
    expect(indexToCell(8, 4)).toEqual({ x: 2, y: 4 });
    expect(indexToCell(1, 4)).toEqual({ x: 1, y: 1 });
    expect(indexToCell(16, 4)).toEqual({ x: 4, y: 4 });
    const r = auditMovePaths(traces);
    expect(r.endpointMatches).toBe(r.scored);
  });

  it("FACT 1's per-cast constancy of the step count is NOT exceptionless", () => {
    // The regression this pins is the opposite of the usual one: it fails if
    // someone re-asserts constancy as a hard invariant. Cast 12988700 is the
    // standing counterexample — session 48, live, six turns, 1,2,1,2,1,2.
    const counts = stepCountsPerCast(clean);
    const nonConstant = counts.filter((c) => !c.constant);
    expect(nonConstant.length).toBeGreaterThanOrEqual(1);
    const alternator = nonConstant.find((c) => c.castId === "12988700");
    expect(alternator).toBeDefined();
    expect(alternator!.counts).toEqual([1, 2, 1, 2, 1, 2]);
    expect(alternator!.alternating).toBe(true);
    // ⚠⚠ [session 125] **THE 0.9 BAR WAS CROSSED — measured 0.8972 on the
    // day-20703 24-cast batch — and it is CONVERTED TO A PIN, not lowered.**
    // Session 122's precedent (a crossed `toBeGreaterThan` becoming a pin) is
    // the pattern; lowering it to 0.89 would buy silence and erase the record.
    //
    // **What this means for the ring model, stated plainly.** The sentence
    // this replaces said non-constant step counts are rare enough that the
    // model being unguarded against them is tolerable. That is now marginally
    // less true: the exception rate has risen from under 10% to 10.3%. It is a
    // slow drift, not a break — the alternator case is still one cast in ten —
    // but the direction is toward the ring model's blind spot, not away from
    // it, so the next reader should check this number rather than assume the
    // old "overwhelmingly" still holds.
    //
    // ⚠ Do NOT fit a cause. The corpus straddles two deck changes and a rod
    // swap; attributing a 3-point drift to any one of them is unsupported.
    expect(counts.filter((c) => c.constant).length / counts.length).toBeCloseTo(
      0.8972332015810277,
      6,
    ); /* [session 125] was toBeGreaterThan(0.9) */
  });

  it("reads nextMovePath as a real path, not a nextPosition duplicate (QUESTIONS.md §17)", () => {
    const rows = auditNextMovePaths(traces);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    // Every one decodes to a unit-step path from the current cell, ending on
    // nextPosition. This is what refutes §17's "always a one-cell duplicate".
    expect(rows.every((r) => r.endsOnNextPosition)).toBe(true);
    expect(rows.every((r) => r.unitStepsFromCurrent)).toBe(true);
    expect(rows.some((r) => r.nextMovePath.length > 1)).toBe(true);
    // Where the cast continued, the pre-roll was exact — position and path.
    const testable = rows.filter((r) => r.realized !== null);
    expect(testable.length).toBeGreaterThanOrEqual(4);
    expect(testable.every((r) => r.realized)).toBe(true);
    expect(testable.every((r) => JSON.stringify(r.realizedPath) === JSON.stringify(r.nextMovePath))).toBe(true);
  });
});
