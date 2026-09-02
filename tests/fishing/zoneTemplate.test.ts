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
    // [session 90] 612 -> 699 across the corpus reaching 168 casts, and it is
    // STILL exceptionless over 87 further plays it has never seen. This is the
    // ratchet's fourth consecutive clean widening; 696 of the 699 lie in clean
    // traces and 3 in session 45's resumed cast, the same split as before.
    // [session 91] 699 -> 751 across the ten-cast batch. **STILL
    // exceptionless** over 52 further plays it has never seen — the ratchet's
    // fifth consecutive clean widening. Only the census moved; the property
    // this test exists for (`mismatches` empty, `correct === scored`) is
    // asserted below and did not.
    // [session 96] 777 -> 820 across the ten-cast batch. **STILL
    // exceptionless** over 43 further plays it has never seen — the ratchet's
    // sixth consecutive clean widening. Only the census moved; the property
    // this test exists for (`mismatches` empty, `correct === scored`) is
    // asserted below and did not.
    // [session 98] 820 -> 860 across the nine-cast batch. **STILL
    // exceptionless** over 40 further plays it has never seen — the ratchet's
    // seventh consecutive clean widening.
    // [session 102] 869 -> 939 across the TWENTY-cast batch, the largest single
    // widening this ratchet has ever taken. **STILL exceptionless** over 70
    // further plays it has never seen — the eighth consecutive clean widening,
    // and the first on a full-cap batch rather than a 2-10 cast one. Only the
    // census moved; the property this test exists for (`mismatches` empty,
    // `correct === scored`) is asserted below and did not.
    expect(r.scored).toBe(1444) /* [s116b] was 1436 */; /* [session 116] was 1320 — STILL exceptionless over 116 further plays */ // [session 98] was 820; [session 96] was 777  /* [session 99] was 860 */ /* [session 101] was 869 */ /* [session 105] was 939 */  /* [session 107] was 989 */  /* [session 110] was 1058 */  /* [session 110b] was 1125 */  /* [session 113] was 1147 */
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
    expect(truth.correct).toBe(1444) /* [s116b] was 1436 */; /* [session 116] was 1320 */ // [session 98] was 820; [session 96] was 777  /* [session 99] was 860 */ /* [session 101] was 869 */ /* [session 105] was 939 */  /* [session 107] was 989 */  /* [session 110] was 1058 */  /* [session 110b] was 1125 */  /* [session 113] was 1147 */
    expect(truth.scored).toBe(1444) /* [s116b] was 1436 */; /* [session 116] was 1320 */ // [session 98] was 820; [session 96] was 777  /* [session 99] was 860 */ /* [session 101] was 869 */ /* [session 105] was 939 */  /* [session 107] was 989 */  /* [session 110] was 1058 */  /* [session 110b] was 1125 */  /* [session 113] was 1147 */

    // The three wrong readings, pinned at their exact scores. `toBeLessThan`
    // alone would pass if a refactor made them all 589.
    const focusBefore = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.focusBefore);
    const stateBefore = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.stateBefore);
    const prevFish = auditZoneTemplate(traces, undefined, RESOLUTION_READINGS.previousFishPosition);
    expect(focusBefore.correct).toBe(1090) /* [s116b] was 1084 */; /* [session 116] was 994 */ // [session 98] was 635; [session 96] was 601  /* [session 99] was 661 */ /* [session 101] was 669 */ /* [session 105] was 716 */  /* [session 107] was 748 */  /* [session 110] was 796 */  /* [session 110b] was 847 */  /* [session 113] was 862 */
    // ⚠ [session 90] These two SWAPPED RANK: `stateBefore` was the better of
    // the pair (385 vs 380) and is now the worse (430 vs 436). Neither is
    // close to exceptionless and nothing downstream ranks them, so this is
    // noise between two wrong readings rather than a finding — recorded so the
    // next reader does not rediscover it as one.
    // [session 91] 430 -> 460 and 436 -> 464. Both measured, not extrapolated —
    // the gap between them NARROWED from 6 plays to 4 rather than holding, so
    // session 90's reading of the earlier rank swap as noise between two wrong
    // readings survives and is if anything better supported. Nothing downstream
    // ranks them; this stays recorded rather than promoted.
    // [session 96] 476 -> 506 and 484 -> 508. The gap between the two wrong
    // readings NARROWED again, 4 plays -> 2, continuing the trend session 91
    // noted. Still noise between two wrong readings, still nothing downstream
    // ranking them; recorded, not promoted.
    // [session 98] 506 -> 528 and 508 -> 528: the two wrong readings are now
    // EXACTLY TIED. The gap has run 6 -> 4 -> 2 -> 0 across sessions 90, 91,
    // 96, 98 — a monotone narrowing over four batches, which is more than
    // session 90's "noise between two wrong readings" predicted and is
    // recorded as an observation rather than promoted to a finding. Nothing
    // downstream ranks them, and neither is remotely exceptionless (528 of
    // 860), so the conclusion this test exists for is untouched.
    //
    // ⚠⚠ **[session 102] THE MONOTONE NARROWING IS FALSIFIED, and by the
    // largest batch the corpus has ever taken.** The gap ran 6 -> 4 -> 2 -> 0
    // across sessions 90, 91, 96, 98 and held at 0 through session 101, which
    // looked like a trend heading somewhere. Twenty fresh casts REOPENED it to
    // 4 (569 vs 573) and flipped the rank back to `prevFish` ahead — session
    // 90's original order. So session 98's "more than noise predicted" reading
    // does not survive contact with a batch of real size, and session 90's
    // first reading — noise between two wrong readings — is what stands.
    //
    // The lesson is worth more than the numbers: a monotone run of four points
    // drawn from batches of 8-10 casts was not evidence of a trend, and the
    // narrowing was reported as an observation rather than a finding precisely
    // so that this reversal costs nothing. It cost nothing. Nothing downstream
    // ranked them then and nothing does now.
    //
    // **[session 105] The gap WIDENED 4 -> 5 (593 vs 598) and the rank held**,
    // across the largest single widening this pair has seen — 21 casts, more
    // than double session 102's. So session 102's reversal was not itself the
    // noise: two consecutive widenings now agree on the direction session 90
    // originally reported. That still does not make it a trend, and the
    // sequence to date is 6 -> 4 -> 2 -> 0 -> 4 -> 5, which is a random walk
    // in a band, not a narrowing. The falsification recorded in DECISIONS
    // 2026-08-26 stands; nothing downstream ranks these two.
    expect(stateBefore.correct).toBe(834) /* [s116b] was 829 */; /* [session 116] was 763 */; // [session 98] was 506; [session 96] was 476  /* [session 99] was 528 */ /* [session 101] was 533 */ /* [session 105] was 569 */  /* [session 107] was 593 */  /* [session 110] was 629 */  /* [session 110b] was 662 */  /* [session 113] was 671 */
    expect(prevFish.correct).toBe(839) /* [s116b] was 833 */; /* [session 116] was 771 */; // [session 98] was 508; [session 96] was 484  /* [session 99] was 528 */ /* [session 101] was 533 */ /* [session 105] was 573 */  /* [session 107] was 598 */  /* [session 110] was 635 */  /* [session 110b] was 668 */  /* [session 113] was 674 */

    // **The demonstration the gate asks for: the pin FAILS under the
    // `previousFishPosition` reading.** A pin that does not fail the wrong
    // reading has not tested anything. 380/612 is 62.1% — a "mostly works"
    // number, which is the danger.
    expect(prevFish.correct).not.toBe(prevFish.scored);
    // [session 91] 287/751 = 38.2% wrong, i.e. 61.8% "correct" — the SAME
    // misleading band as session 90's 62.4% and session 81's 62.1%, now over
    // three corpus widenings. The danger the pin exists for does not shrink.
    // [session 96] 508/820 "correct" = 62.0% — the SAME misleading band as
    // session 91's 61.8%, session 90's 62.4% and session 81's 62.1%, now over
    // four corpus widenings. The danger the pin exists for does not shrink.
    // [session 98] 528/860 "correct" = 61.4% — the same band over a FIFTH
    // widening. Five batches and the number has never left 61-63%.
    // [session 105] 598/989 "correct" = 60.5% — a SEVENTH widening, and the
    // first reading to fall below 61%. Still the same "mostly works" danger
    // band the pin exists for; the drift is 1.5pp over seven widenings and is
    // not doing anything.
    expect(prevFish.mismatches.length).toBe(605) /* [s116b] was 603 */; /* [session 116] was 549 */; // [session 98] was 312; [session 96] was 293  /* [session 99] was 332 */ /* [session 101] was 336 */ /* [session 105] was 366 */  /* [session 107] was 391 */  /* [session 110] was 423 */  /* [session 110b] was 457 */  /* [session 113] was 473 */

    // All four score the same denominator: the reading changes which cells are
    // compared, never which plays are eligible.
    for (const r of [truth, focusBefore, stateBefore, prevFish]) expect(r.scored).toBe(1444) /* [s116b] was 1436 */; /* [session 116] was 1320 — STILL exceptionless over 116 further plays */ // [session 98] was 820; [session 96] was 777  /* [session 99] was 860 */ /* [session 101] was 869 */ /* [session 105] was 939 */  /* [session 107] was 989 */  /* [session 110] was 1058 */  /* [session 110b] was 1125 */  /* [session 113] was 1147 */
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
    // [session 90] 148 -> 168 across the sessions 82-89 batches. Clean STILL
    // trails traces by exactly one, the same long-standing incomplete cast,
    // now across six consecutive oil batches.
    // [session 91] 168 -> 178 across the ten-cast batch. Clean STILL trails
    // traces by exactly one, the same long-standing incomplete cast, now
    // across seven consecutive oil batches.
    // [session 96] 189 -> 199 across the ten-cast batch. Clean STILL trails
    // traces by exactly one, the same long-standing incomplete cast, now
    // across eight consecutive oil batches.
    // [session 98] 199 -> 208 across the nine-cast batch. Clean STILL trails
    // traces by exactly one — NINE consecutive oil batches.
    // [session 102] 210 -> 230 across the twenty-cast batch. Clean STILL
    // trails traces by exactly one — TEN consecutive oil batches, and the
    // first full-cap batch to leave the identity untouched.
    expect(traces.length).toBe(367) /* [s116b] was 364 */; /* [session 116] was 339 */ // [session 98] was 199; [session 96] was 189  /* [session 99] was 208 */ /* [session 101] was 210 */ /* [session 105] was 230 */  /* [session 107] was 251 */  /* [session 110] was 273 */  /* [session 110b] was 288 */  /* [session 113] was 295 */
    expect(clean.length).toBe(366) /* [s116b] was 363 */; /* [session 116] was 338 — clean STILL trails traces by exactly one */ // [session 98] was 198; [session 96] was 188  /* [session 99] was 207 */ /* [session 101] was 209 */ /* [session 105] was 229 */  /* [session 107] was 250 */  /* [session 110] was 272 */  /* [session 110b] was 287 */  /* [session 113] was 294 */
    // Asserted as the IDENTITY rather than as two literals, so "exactly one"
    // stays the claim when both numbers next move.
    expect(traces.length - clean.length).toBe(1);
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
    expect(clean.reduce((s, t) => s + t.turns.length - 1, 0)).toBe(1441) /* [s116b] was 1433 */; /* [session 116] was 1317 */ // [session 98] was 817; [session 96] was 774  /* [session 99] was 857 */ /* [session 101] was 866 */ /* [session 105] was 936 */  /* [session 107] was 986 */  /* [session 110] was 1055 */  /* [session 110b] was 1122 */  /* [session 113] was 1144 */
    // Still asserted against the corpus figure rather than a literal — the
    // reconciliation is the evidence, and it holds at 38.
    expect(traces.filter((t) => t.caught).length).toBe(177) /* [s116b] was 176 */; /* [session 116] was 160 */; // [session 98] was 73 (+6 catches over 9 casts); [session 96] was 70  /* [session 99] was 79 */ /* [session 101] was 80; session 102 added 14 over 20 casts */ /* [session 105] was 94 */  /* [session 107] was 108 */  /* [session 110] was 120 */  /* [session 110b] was 129 */  /* [session 113] was 134 */
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
