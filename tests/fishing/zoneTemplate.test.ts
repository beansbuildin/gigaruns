/**
 * tests/fishing/zoneTemplate.test.ts — [session 47]
 *
 * The regression guard for the transpose. `geometry.ts`'s `ZONE_OFFSET` went
 * eleven sessions marked CONFIRMED while being wrong, because the only thing
 * that ever checked it was one capture whose cards are transpose-symmetric,
 * and exactly one test in the whole suite depended on a non-symmetric zone
 * set. This pins it against the real corpus instead: the server's own
 * hit/miss verdict on all 282 recorded plays.
 *
 * Reads the committed fixture tree; writes nothing (CLAUDE.md's
 * tests-never-touch-a-real-data-path rule — this is a read of `fixtures/`,
 * which is source, not a data path).
 */

import { describe, expect, it } from "vitest";

import { loadCastTraces, isCleanTrace } from "../../src/sim/fishing/castTrace.js";
import { auditZoneTemplate, TRANSPOSED_ZONE_OFFSET } from "../../src/sim/fishing/zoneAudit.js";
import { zonesToCells, zoneToCell, cellKey } from "../../src/sim/fishing/geometry.js";

describe("ZONE_OFFSET against the real corpus", () => {
  const traces = loadCastTraces();

  it("predicts the server's hit/miss on every recorded play, exceptionless", () => {
    const r = auditZoneTemplate(traces);
    expect(r.scored).toBeGreaterThanOrEqual(282);
    expect(r.mismatches).toEqual([]);
    expect(r.correct).toBe(r.scored);
  });

  it("the transposed template — what shipped until session 47 — is measurably worse", () => {
    // Not a tautology: if someone re-transposes ZONE_OFFSET, this flips and
    // the test above fails, so the pair localizes the regression.
    const r = auditZoneTemplate(traces, TRANSPOSED_ZONE_OFFSET);
    expect(r.correct).toBeLessThan(r.scored);
  });

  it("zone numbering is row-major with x as the ROW", () => {
    // Closed form the header states: dx = floor((z-1)/3) - 1, dy = ((z-1)%3) - 1.
    const focus = { x: 2, y: 2 };
    for (let z = 1; z <= 9; z++) {
      const expected = { x: 2 + Math.floor((z - 1) / 3) - 1, y: 2 + ((z - 1) % 3) - 1 };
      expect(zoneToCell(focus, z, 4)).toEqual(expected);
    }
    // Zone 2 is directly "above" in row terms — the single cell the old table got backwards.
    expect(zonesToCells(focus, [2], 4).map(cellKey)).toEqual(["1,2"]);
    expect(zonesToCells(focus, [4], 4).map(cellKey)).toEqual(["2,1"]);
  });
});

describe("cast-trace corpus reconciliation", () => {
  const traces = loadCastTraces();

  it("matches the figures the other two corpus views report", () => {
    const clean = traces.filter(isCleanTrace);
    // [session 50] Recount after this session's 5-cast batch (1 caught).
    // Old figures 84/83/364/12; before that 74/73/308/8.
    // [session 60] Recount after this session's 5-cast batch (1 caught).
    // Old figures 89/88/388/13.
    // [session 63] Recount after this session's ONE cast (caught, 3 turns).
    // Old figures 94/93/407/14.
    expect(traces.length).toBe(95);
    expect(clean.length).toBe(94);
    // 410 play turns across the clean traces — the same 410 as
    // auditStepClass.ts's off-ring denominator and auditStateFields.ts's, and
    // the same 15 catches as the all-time 15/95.
    expect(clean.reduce((s, t) => s + t.turns.length - 1, 0)).toBe(410);
    expect(traces.filter((t) => t.caught).length).toBe(15);
  });

  it("the one non-clean trace is session 45's resumed cast, which has no start_run", () => {
    const notClean = traces.filter((t) => !isCleanTrace(t));
    expect(notClean.map((t) => t.docId)).toEqual(["12975152"]);
    expect(notClean[0]!.hasStart).toBe(false);
    // Its positions are still continuous — it is missing a beginning, not corrupt.
    expect(notClean[0]!.continuous).toBe(true);
  });
});
