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
import { auditZoneTemplate, RESOLUTION_READINGS, TRANSPOSED_ZONE_OFFSET } from "../../src/sim/fishing/zoneAudit.js";
import { zonesToCells, zoneToCell, cellKey } from "../../src/sim/fishing/geometry.js";

describe("ZONE_OFFSET against the real corpus", () => {
  const traces = loadCastTraces();

  it("predicts the server's hit/miss on every recorded play, exceptionless", () => {
    const r = auditZoneTemplate(traces);
    // [session 81] **The predicate, in the test, in words** — CLAUDE.md rule
    // 6, and the lesson of session 80's 543-vs-548 chase: a pinned count whose
    // filter lives only in someone's scratch buffer is unmeetable by
    // construction. This scores *every state-to-state transition whose
    // resulting state carries a `play`, whose `play.handIndex` resolves to a
    // card id in the PRE-play hand, and whose id is present in the cast's
    // `deckCardData`* — nothing else filtered: not clean traces, not terminal
    // plays, not oil casts.
    //
    // The count was `>= 282` for thirty-four sessions, which could not
    // distinguish "the corpus grew" from "the predicate silently narrowed".
    // Now exact: 612 plays, of which 609 lie in clean traces and 3 in session
    // 45's resumed cast. Recount on a corpus change, and say which.
    // [session 81] 590 -> 612 across this session's eight-cast batch, and the
    // resolver stayed exceptionless over the 22 new plays — the ratchet
    // holding on data it has never seen, which is the point of it.
    expect(r.scored).toBe(612);
    expect(r.mismatches).toEqual([]);
    expect(r.correct).toBe(r.scored);
  });

  it("the transposed template — what shipped until session 47 — is measurably worse", () => {
    // Not a tautology: if someone re-transposes ZONE_OFFSET, this flips and
    // the test above fails, so the pair localizes the regression.
    const r = auditZoneTemplate(traces, TRANSPOSED_ZONE_OFFSET);
    expect(r.correct).toBeLessThan(r.scored);
  });

  /**
   * [session 81 §3] The OTHER axis, which nothing checked until now. The zone
   * template says where a zone lands; the READING says which two states a shot
   * is resolved between. Both can be wrong independently, and the corpus
   * separates them cleanly: only one of the four readings is exceptionless and
   * the rest sit at 62–79%, which is exactly the band where a convention error
   * looks like a working model and survives review.
   */
  it("resolves against the POST-move focus and the RESULTING fish cell — and no other reading fits", () => {
    const truth = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.truth);
    expect(truth.correct).toBe(612);
    expect(truth.scored).toBe(612);

    // The three wrong readings, pinned at their exact scores. `toBeLessThan`
    // alone would pass if a refactor made them all 589.
    const focusBefore = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.focusBefore);
    const stateBefore = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.stateBefore);
    const prevFish = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.previousFishPosition);
    expect(focusBefore.correct).toBe(480);
    expect(stateBefore.correct).toBe(385);
    expect(prevFish.correct).toBe(380);

    // **The demonstration the gate asks for: the pin FAILS under the
    // `previousFishPosition` reading.** A pin that does not fail the wrong
    // reading has not tested anything. 380/612 is 62.1% — a "mostly works"
    // number, which is the danger.
    expect(prevFish.correct).not.toBe(prevFish.scored);
    expect(prevFish.mismatches.length).toBe(232);

    // All four score the same denominator: the reading changes which cells are
    // compared, never which plays are eligible.
    for (const r of [truth, focusBefore, stateBefore, prevFish]) expect(r.scored).toBe(612);
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
    // [session 64] Recount after the §2 oil batch — 6 casts, 3 caught — and
    // then the §2 re-run, 1 cast (escaped) which is the corpus's first real
    // OIL cast. Old figures 95/94/410/15.
    // [session 65] Recount after the seven-cast batch (5 caught, 2 escaped —
    // four of the seven consumed an oil). Old figures 102/101/439/18. Note the
    // clean count still trails traces by exactly ONE, the same long-standing
    // incomplete cast: the four new OIL casts all stayed clean, which is the
    // ITEM_MESSAGE skip doing its job across a much bigger oil sample than the
    // single cast it was built on.
    // [session 68] 109 -> 114 across the five-cast batch; clean still trails
    // traces by exactly ONE, the same long-standing incomplete cast.
    // [session 69] 114 -> 124 across the ten-cast batch; clean STILL trails
    // traces by exactly one, the same long-standing incomplete cast, now
    // across three consecutive oil batches.
    // [session 80] 131 -> 140 across a NINE-cast batch (eight authorised plus
    // one spent by an unguarded `--help` — see tests/cliArgs.test.ts). Clean
    // STILL trails traces by exactly one, the same long-standing incomplete
    // cast, now across four consecutive oil batches.
    // [session 81] 140 -> 148 across an eight-cast batch (all authorised; the
    // full remaining daily allowance). Clean STILL trails traces by exactly
    // one, the same long-standing incomplete cast, now across five
    // consecutive oil batches.
    expect(traces.length).toBe(148);
    expect(clean.length).toBe(147);
    // 480 play turns across the clean traces.
    //
    // [session 68] **The catch count now RECONCILES with the corpus view, and
    // did not before.** It read 22 here against the corpus's 23, and the
    // one-cast difference was accepted as the known incomplete cast. That was
    // a coincidence: `castTrace` dropped `use_fishing_item` responses before
    // reading their events, so a fish killed by a lethal Relaxing Oil was
    // never marked caught in a trace. The five-cast batch made the gap 23 vs
    // 26 and thereby visible. With the ITEM_MESSAGE branch fixed both views
    // say 26 — the reconciliation is the evidence, which is why it is asserted
    // against the corpus figure rather than against a literal.
    expect(clean.reduce((s, t) => s + t.turns.length - 1, 0)).toBe(609); // [session 81] 587 -> 609 (+22 play turns over eight casts).
    // Still asserted against the corpus figure rather than a literal — the
    // reconciliation is the evidence, and it holds at 38.
    expect(traces.filter((t) => t.caught).length).toBe(48); // [session 81] 42 -> 48 (+6 catches in eight casts — a 75% catch rate on the batch).
  });

  /**
   * [session 64] The first live oil cast (13019015) exposed this, and it would
   * have applied to every oil cast after it.
   *
   * `use_fishing_item`'s response is not a turn — it carries
   * `FOCUS_STAMINA_DIFF` and no `FISH_MOVED`, and repeats the preceding turn's
   * `previousFishPosition`. Counted as a turn it breaks position continuity,
   * `continuous` goes false, and `isCleanTrace` drops the ENTIRE cast from the
   * movement corpus. That inverts §4b, which pools movement quantities across
   * the oil arm precisely because an oil changes what we spend and not what the
   * fish does.
   *
   * The assertion is on the oil cast specifically rather than on the clean
   * count alone, because the clean count moves for many reasons and this one
   * has to stay pinned to its cause.
   */
  it("keeps an OIL cast in the movement corpus — the item response is not a turn", () => {
    const oilCast = traces.find((t) => t.docId === "13019015");
    expect(oilCast).toBeDefined();
    expect(isCleanTrace(oilCast!)).toBe(true);
    expect(oilCast!.continuous).toBe(true);
    // 11 real turns: state-000 start + 10 play_cards. The item response between
    // turns 6 and 7 is skipped, so it must NOT contribute a 12th.
    expect(oilCast!.turns.length).toBe(11);
  });

  it("the one non-clean trace is session 45's resumed cast, which has no start_run", () => {
    const notClean = traces.filter((t) => !isCleanTrace(t));
    expect(notClean.map((t) => t.docId)).toEqual(["12975152"]);
    expect(notClean[0]!.hasStart).toBe(false);
    // Its positions are still continuous — it is missing a beginning, not corrupt.
    expect(notClean[0]!.continuous).toBe(true);
  });
});
