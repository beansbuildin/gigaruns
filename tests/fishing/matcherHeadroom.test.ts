/**
 * tests/fishing/matcherHeadroom.test.ts — [session 81, GATE 2]
 *
 * Pins the matcher scoreboard. The floor, the two ceilings and the shipped
 * bot's own rate, over the committed corpus.
 *
 * **Why this is a ratchet and not a snapshot.** The ACTUAL row is the only one
 * a code change can move — RANDOM, STAY-PUT and both ORACLE rows depend on the
 * cards, the board and the focus budget, not on any decision the bot makes. So
 * a matcher change that improves the hit rate shows up here as exactly one
 * number moving, and a change that moves a ceiling is a bug in the harness
 * rather than an improvement to the bot.
 *
 * Reads the committed fixture tree; writes nothing (CLAUDE.md's
 * tests-never-touch-a-real-data-path rule — `fixtures/` is source, not a data
 * path).
 */

import { describe, expect, it } from "vitest";

import { loadCastTraces } from "../../src/sim/fishing/castTrace.js";
import {
  assertHeadroomSelfConsistent,
  budgetBefore,
  cardCovers,
  matcherHeadroom,
} from "../../src/sim/fishing/matcherHeadroom.js";
import { manhattan, reachableCells } from "../../src/sim/fishing/geometry.js";

const traces = loadCastTraces();
const result = matcherHeadroom(traces);

describe("matcher headroom — the scoreboard the matcher is scored against", () => {
  it("scores the stated predicate, and the predicate is the one zoneAudit uses", () => {
    // Stated in full so this count is meetable by someone who does not have
    // the session's scratch buffer — CLAUDE.md rule 6. Every state-to-state
    // transition whose resulting state carries a `play`, whose
    // `play.handIndex` resolves to a card id in the PRE-play hand, and whose
    // id is present in the cast's `deckCardData`. Nothing else is filtered:
    // not clean traces, not terminal plays, not oil casts.
    //
    // [session 81] Recount after this session's EIGHT-cast batch: 590 -> 612
    // plays, 140 -> 148 casts. For orientation, the neighbouring counts this
    // is NOT: 609 is the play total over CLEAN traces only
    // (`zoneTemplate.test.ts`), and the remaining 3 lie in session 45's
    // resumed cast, which has no `start_run` but whose plays resolve fine.
    // [session 90] 612 -> 699 plays, 148 -> 168 casts. The neighbouring count
    // this is still NOT: 696 is the play total over CLEAN traces only
    // (`zoneTemplate.test.ts`), the remaining 3 in session 45's resumed cast.
    // [session 91] 699 -> 751 plays, 168 -> 178 casts.
    // [session 96] 777 -> 820 plays, 189 -> 199 casts.
    expect(result.plays).toBe(1226); // [session 96] was 777; [session 92] was 751  // [session 98] was 820  /* [session 99] was 860 */ /* [session 102] was 869 */ /* [session 105] was 939 */  /* [session 107] was 989 */  /* [session 110] was 1058 */  /* [session 110b] was 1125 */  /* [session 113] was 1147 */
    expect(result.casts).toBe(315); // [session 96] was 189; [session 92] was 178  // [session 98] was 199  /* [session 99] was 208 */ /* [session 102] was 210 */ /* [session 105] was 230 */  /* [session 107] was 251 */  /* [session 110] was 273 */  /* [session 110b] was 288 */  /* [session 113] was 295 */
  });

  it("reproduces the four rates — floor, actual, and both ceilings", () => {
    // [session 81] The figures gate 2 exists to reproduce. Recount these when
    // the corpus grows; a change here with a static corpus is a real change.
    // [session 81] Re-measured after the eight-cast batch. The instrument is
    // notably STABLE across +22 plays — 20.4->20.3, 35.4->36.3, 65.6->66.3,
    // 70.5->71.1 — which is what a ceiling that depends on the board rather
    // than on the bot should do.
    // [session 90] Re-measured at 168 casts, and the STABILITY claim above
    // holds a second time on a much bigger step (+87 plays, not +22): the two
    // ceilings moved by less than 0.002 (0.663 -> 0.662, 0.711 -> 0.710) and
    // the floor by 0.004. **What moved is `actual`, 0.363 -> 0.375** — the
    // bot's own rate, which is the one number here that is supposed to be able
    // to move. A board-dependent ceiling holding still while the bot's rate
    // climbs is exactly the shape this instrument was built to show.
    // [session 91] The ceilings held AGAIN across ten more casts — `random`
    // 0.199 -> 0.200, `stayPut` 0.239 -> 0.245, the two oracle ceilings
    // 0.662 -> 0.666 and 0.710 -> 0.711 — every one inside two thirds of a
    // point. Third consecutive widening with the board-dependent floor and
    // both ceilings effectively unmoved. **`actual` did NOT climb this time**
    // (0.375 -> 0.374): the bot's own rate is the one number here that is
    // supposed to move, and over these ten casts it did not.
    // [session 96] Fourth consecutive widening with the ceilings effectively
    // unmoved: `random` 0.198 -> 0.199, `stayPut` 0.243 -> 0.243, the two
    // oracle ceilings 0.665 -> 0.670 and 0.710 -> 0.713 — every one inside
    // half a point. **`actual` did not climb again** (0.375 -> 0.373), a
    // second consecutive batch where the bot's own rate did not move. This is
    // the first batch played against the 11-pattern matcher library
    // (QUESTIONS.md §36); ten casts pooled into 199 cannot resolve a matcher
    // change either way, so do NOT read the flat `actual` as evidence about
    // it in either direction.
    expect(result.random).toBeCloseTo(0.20908843739186309, 3); // [session 96] was 0.198; [session 92] was 0.200  // [session 98] was 0.199 /* [session 102] was 0.20033121916842866 */ /* [session 105] was 0.20151353793526328 */  /* [session 107] was 0.2029016147317462 */  /* [session 110] was 0.20130320215386371 */  /* [session 113] was 0.20623501683501677 */
    expect(result.stayPut).toBeCloseTo(0.26916802610114193, 3); // [session 93] was 0.244; [session 92] was 0.245  // [session 98] was 0.243  /* [session 99] was 0.24069767441860465 */ /* [session 102] was 0.24165707710011508 */ /* [session 105] was 0.24813631522896698 */  /* [session 107] was 0.2527805864509606 */  /* [session 110] was 0.2580340264650284 */  /* [session 110b] was 0.264 */  /* [session 113] was 0.2632955536181343 */
    expect(result.actual).toBeCloseTo(0.4094616639477977, 3); // [session 96] was 0.375; was 0.374  // [session 98] was 0.373  /* [session 99] was 0.3767441860465116 */ /* [session 102] was 0.37744533947065595 */ /* [session 105] was 0.3855165069222577 */  /* [session 107] was 0.39332659251769464 */  /* [session 110] was 0.3960302457466919 */  /* [session 110b] was 0.4026666666666667 */  /* [session 113] was 0.40540540540540543 */
    expect(result.oracleSameCard).toBeCloseTo(0.6896251089799477, 3); // [session 96] was 0.665; was 0.662  // [session 98] was 0.67  /* [session 99] was 0.6686046511627907 */ /* [session 102] was 0.6708860759493671 */ /* [session 105] was 0.6773162939297125 */  /* [session 107] was 0.6855409504550051 */  /* [session 110] was 0.6880907372400756 */  /* [session 110b] was 0.6906666666666667 */
    expect(result.oracleBestCard).toBeCloseTo(0.7306666666666667, 3); // [session 96] was 0.710  // [session 98] was 0.713  /* [session 99] was 0.7104651162790697 */ /* [session 102] was 0.713463751438435 */ /* [session 105] was 0.7199148029818956 */  /* [session 107] was 0.7269969666329625 */  /* [session 110] was 0.7287334593572778 */

    // The derived readings the report prints, pinned so a change to the
    // arithmetic is caught rather than the inputs alone.
    expect(result.capturedFraction).toBeCloseTo(0.41661056494010407, 3); // [session 96] was 0.378; [session 92] was 0.373  // [session 98] was 0.37 /* [session 102] was 0.3767306766193111 */ /* [session 105] was 0.38672110799867043 */  /* [session 107] was 0.39454922898190053 */  /* [session 110] was 0.400024712133069 */  /* [session 110b] was 0.4054888855835782 */  /* [session 113] was 0.41173012750495225 */
    expect(result.headroomRemaining).toBeCloseTo(0.28058727569331154, 3); // [session 96] was 0.291; [session 91] was 0.288 // was 0.301  // [session 98] was 0.296  /* [session 99] was 0.29186046511627906 */ /* [session 102] was 0.29344073647871116 */  /* [session 110] was 0.2917997870074548 */  /* [session 110b] was 0.288 */  /* [session 113] was 0.28421970357454224 */
    expect(result.cardSelectionValue).toBeCloseTo(0.04097646033129909, 3); // [session 96] was 0.045; [session 92] was 0.045; 0.047 before that  // [session 98] was 0.044  /* [session 99] was 0.041860465116279055 */ /* [session 105] was 0.04257767548906788 */  /* [session 107] was 0.041456016177957467 */  /* [session 110] was 0.04064272211720221 */  /* [session 110b] was 0.040000000000000036 */
  });

  it("orders floor <= stay-put <= actual <= same-card oracle <= best-card oracle", () => {
    // Not decoration: each inequality is a different way the harness could be
    // wrong. actual > oracle would mean the reachable set is too small;
    // oracleBestCard < oracleSameCard would mean the played card was excluded
    // from the hand it is supposedly chosen out of.
    expect(result.random).toBeLessThanOrEqual(result.stayPut);
    expect(result.stayPut).toBeLessThanOrEqual(result.actual);
    expect(result.actual).toBeLessThanOrEqual(result.oracleSameCard);
    expect(result.oracleSameCard).toBeLessThanOrEqual(result.oracleBestCard);
  });

  it("holds both self-consistency invariants", () => {
    expect(() => assertHeadroomSelfConsistent(traces, result)).not.toThrow();
    // Restated directly rather than only through the assert, so the test still
    // says what it means if the assert is ever loosened.
    expect(result.perPlay.filter((p) => p.actualHit && !p.oracleSameCardHit)).toEqual([]);
  });
});

describe("the focus budget, reconstructed rather than read off the stale meter", () => {
  it("spent + remaining recovers the pre-play meter on every non-oil play", () => {
    // The identity: what the move cost, plus what was left after it, is what
    // was available before it. [session 81] 591 plays hold it exactly
    // (572 before this session's eight-cast batch).
    let holds = 0;
    const fails: { docId: string; turn: number; consumed: boolean }[] = [];
    for (const t of traces) {
      for (let i = 1; i < t.turns.length; i++) {
        const cur = t.turns[i]!;
        const prev = t.turns[i - 1]!;
        if (!cur.play) continue;
        if (budgetBefore(prev, cur) === prev.focusMeter) holds++;
        else fails.push({ docId: t.docId, turn: i, consumed: cur.consumablesUsed > prev.consumablesUsed });
      }
    }
    expect(holds).toBe(1202); // [session 96] was 753; [session 92] was 727  // [session 98] was 796  /* [session 99] was 836 */ /* [session 102] was 845 */ /* [session 105] was 915 */  /* [session 107] was 965 */  /* [session 110] was 1034 */  /* [session 110b] was 1101 */  /* [session 113] was 1123 */
    // **Every** failure is an oil consume — not most, all. This is the
    // assertion that makes the reconstruction legitimate rather than a fudge
    // that happens to fit: if a play ever breaks the identity WITHOUT an oil,
    // the focus-budget model is wrong in a way nobody has diagnosed.
    // 18 -> 21 across the batch, and the "every failure is an oil" claim
    // survived three NEW oil consumes with no residue. That is the assertion
    // doing work, not the count.
    // [session 90] 21 -> 24, and **the claim survived a FOURTH time**: all
    // three new failures are oil consumes and there is still no residue.
    // Verified, not carried over.
    expect(fails.length).toBe(24); // was 21
    expect(fails.filter((f) => !f.consumed)).toEqual([]);
  });

  it("every oil consume recovers a budget of exactly 2, from a meter reading 0", () => {
    // [session 81] 21/21, up from 18/18 across this session's batch — every
    // one of the three new consumes fired at meter 0 again. **The corpus does
    // not settle restore-to-2 vs
    // add-2** — every observed consume happened at meter 0, where the two are
    // the same event. SPEC-fishing §4a's static effect table points at add-2:
    // `FishingRestoreFocus` is an AMOUNT per tier (Lil 1 / Mid 2 / Big 3) and
    // the bot spends the MID oil (942), whose amount is exactly the 2 seen
    // here. Neither reading is encoded — the budget is read off the
    // transition. Pinned so that a Lil/Big consume, or any consume at a
    // non-zero meter, is recognised as the answer when it lands instead of
    // quietly widening these numbers.
    const oil: { budget: number; prevMeter: number }[] = [];
    for (const t of traces) {
      for (let i = 1; i < t.turns.length; i++) {
        const cur = t.turns[i]!;
        const prev = t.turns[i - 1]!;
        if (!cur.play) continue;
        if (cur.consumablesUsed > prev.consumablesUsed) {
          oil.push({ budget: budgetBefore(prev, cur), prevMeter: prev.focusMeter });
        }
      }
    }
    // [session 90] 24/24, up from 21/21. **Every one of the three new consumes
    // fired at meter 0 again**, so the corpus STILL does not separate
    // restore-to-2 from add-2 — the standing capture request (an oil consumed
    // at a NON-ZERO meter) is unmet across 24 observations now, and cannot be
    // met while Focus Oil stock is 0.
    expect(oil.length).toBe(24); // was 21
    expect(oil.every((o) => o.budget === 2)).toBe(true); // STRUCTURAL, still true
    expect(oil.every((o) => o.prevMeter === 0)).toBe(true); // STRUCTURAL, still true
  });

  it("the naive prev.focusMeter budget breaks BOTH invariants — which is how the oil restore was found", () => {
    // A pin that does not fail the wrong model has not tested anything. This
    // scores the model this file rejects and shows it producing a ceiling
    // below its own observed floor.
    let outsideReach = 0;
    let impossibleHits = 0;
    for (const t of traces) {
      for (let i = 1; i < t.turns.length; i++) {
        const cur = t.turns[i]!;
        const prev = t.turns[i - 1]!;
        if (!cur.play) continue;
        const cardId = prev.hand[cur.play.handIndex];
        if (cardId === undefined) continue;
        const card = t.cards.get(cardId);
        if (!card) continue;
        if (manhattan(prev.focusPoint, cur.focusPoint) > prev.focusMeter) outsideReach++;
        const reach = reachableCells(cur.gridSize, prev.focusPoint, prev.focusMeter);
        const hittable = reach.some((f) => cardCovers(f, card, cur.fishPosition, cur.gridSize));
        if (cur.play.hit && !hittable) impossibleHits++;
      }
    }
    expect(outsideReach).toBe(14); // was 12
    expect(impossibleHits).toBe(6); // UNCHANGED across +87 plays
  });
});

describe("the aim-error distribution — is the miss structured or diffuse?", () => {
  it("is concentrated near the footprint rather than flat", () => {
    // [session 81 §5] The single most informative plot the corpus offers. A
    // spike at distance 1 means the matcher is nearly right and a better
    // tie-break scores points; a flat distribution would mean it is not
    // tracking the fish at all and the hit rate comes from the card zones
    // being large. It is the former: 172 of 358 misses land ONE cell off.
    const h = result.missAimErrorHist;
    const total = [...h.values()].reduce((a, b) => a + b, 0);
    // [session 81] 358 -> 367 misses across the batch, and the SHAPE is
    // unmoved: distance 1 held at exactly 48.0%.
    // [session 90] 367 -> 412, and the shape is unmoved a THIRD time:
    // distance 1 at 48.3% (199/412), against 48.0% and 48.0% before it. The
    // spike is the finding and it has now survived two corpus widenings.
    // [session 91] 412 -> 445, and the shape is unmoved a FOURTH time:
    // distance 1 at 49.4% (220/445), against 48.3%, 48.0% and 48.0%. Three
    // corpus widenings and the spike has not shifted more than 1.4 points.
    // [session 96] 459 -> 487, and the shape is unmoved a FIFTH time:
    // distance 1 at 49.9% (243/487). ⚠ **The stated drift bound above is now
    // stale and is corrected here rather than restated:** the full spread
    // across five widenings is 48.0% -> 49.9%, i.e. **1.9 points, not 1.4**.
    // The spike is still the finding — half of all misses land one cell away,
    // across a corpus that has nearly doubled — but the drift is monotone
    // upward and worth watching rather than describing as flat.
    expect(total).toBe(694); // [session 96] was 459; [session 92] was 445  // [session 98] was 487  /* [session 99] was 509 */ /* [session 102] was 514 */ /* [session 105] was 550 */  /* [session 107] was 573 */  /* [session 110] was 612 */  /* [session 110b] was 644 */  /* [session 113] was 653 */
    expect(h.get(1)).toBe(360); // [session 96] was 226; [session 92] was 220  // [session 98] was 243  /* [session 99] was 251 */ /* [session 102] was 254 */ /* [session 105] was 274 */  /* [session 107] was 287 */  /* [session 110] was 314 */  /* [session 110b] was 333 */  /* [session 113] was 339 */
    expect(h.get(2)).toBe(250); // [session 96] was 171; [session 92] was 164  // [session 98] was 180  /* [session 99] was 194 */ /* [session 102] was 196 */ /* [session 105] was 208 */  /* [session 107] was 216 */  /* [session 110] was 224 */  /* [session 110b] was 233 */  /* [session 113] was 235 */
    expect(h.get(3)).toBe(68); // [session 96] was 50; [session 91] was 46 /* [session 102] was 52 */  /* [session 107] was 55 */  /* [session 110] was 59 */  /* [session 113] was 63 */
    expect(h.get(4)).toBe(15); // was 9 /* [session 102] was 11 */ /* [session 105] was 12 */  /* [session 110b] was 14 */
    // Nothing further out, and nothing at 0 — a footprint containing the fish
    // is a hit by definition, so a 0 here would mean the resolver and this
    // measurement disagree about what a hit is.
    expect(h.get(0)).toBeUndefined(); // STRUCTURAL, still true
    // 86.2%, down from 86.1%... i.e. unmoved. Still comfortably over the bound.
    expect((h.get(1)! + h.get(2)!) / total).toBeGreaterThan(0.85);
  });

  it("counts the plays with NO on-grid footprint — a guaranteed miss, not a bad prediction", () => {
    // [session 81] Found by this test failing an assumption rather than by
    // anyone looking for it. `aimError` is null when every zone of the played
    // card translated off the board, so the shot could not have hit whatever
    // the fish did: 23 of 612 plays, 3.8%, and **all 23 are misses** — which
    // they must be, since a shot with no footprint cannot land. The eight-cast
    // batch added NONE, and no new offending card.
    // [session 90] 23 -> 25 of 699 plays (3.6%, was 3.8%), and every
    // structural half held: all 25 are misses, the AVOIDABLE count is
    // UNCHANGED at 6, and **no new offending card appeared** — still exactly
    // cards 1, 3, 4 and 6. Two more instances of a known shape, not a new one.
    const none = result.perPlay.filter((p) => p.aimError === null);
    expect(none.length).toBe(30); // [session 92] was 25  /* [session 110] was 27 */  /* [session 110b] was 28 */  /* [session 113] was 29 */
    expect(result.noFootprint).toBe(30); // [session 92] was 25  /* [session 110] was 27 */  /* [session 110b] was 28 */  /* [session 113] was 29 */
    expect(none.filter((p) => p.actualHit)).toEqual([]); // STRUCTURAL, still true
    // 6 of the 25 were AVOIDABLE: a different reachable focus would have hit
    // with the same card. So this is not a forced cost of the hand.
    expect(result.noFootprintAvoidable).toBe(6); // UNCHANGED
    // Card 1's hitZones are the whole top row of the template ([1,2,3]), so
    // firing it from grid row 1 puts every zone off-board. Pinned to the
    // cards actually implicated, so a new offender is a visible change.
    //
    // ⚠⚠ [session 92] **A NEW OFFENDER APPEARED — CARD 35 — AND THIS PIN IS
    // WHAT CAUGHT IT.** It is a finding, not census drift, and it is the first
    // one of a new SHAPE. Card 35's `hitZones` are `[1, 4, 7]`, the left
    // COLUMN of the template, where every previously implicated card was a row
    // or partial-row case. Fired from grid column 0 every zone translates
    // off-board, so the shot is a guaranteed miss — the column analogue of
    // card 1's row problem, and the reason the set is pinned by id rather than
    // by count.
    //
    // One instance so far: cast `13071774` turn 5, `actualHit` false, and
    // NOT avoidable (`noFootprintAvoidable` is unchanged at 6 below).
    //
    // ⚠ **The bot then took a SECOND copy of card 35 as loot**, in cast 8 of
    // the same batch (offer 35/30/31 -> chose 35), because `chooseNewCard` has
    // no deck-composition term — TASKS.md §13, still NOT STARTED. That is the
    // concrete cost of the missing term, recorded here rather than inferred:
    // the deck acquired more of a card that cannot hit from one whole column.
    // Do NOT read one guaranteed miss as a quantified cost; read it as the
    // first observed instance of a shape §13 exists to price.
    expect([...new Set(none.map((p) => p.cardId))].sort((a, b) => a - b)).toEqual([1, 3, 4, 6, 35, 84, 87]);  /* ⭐ [session 113] card 87 JOINED, and it is a CENSUS addition rather than a new defect — VERIFIED, not assumed from the pattern. Card 87 is `hitZones: [3,6,9]`, crit `[]`, positional reachability 6/9 = 0.667: the single-COLUMN band, byte-identical zones to card 6 which has been a member since the set was first pinned. Per DECISIONS 2026-08-30 (session 112) this set is a census of low-reachability cards, not a list of defective ones, and 16 of the 80 catalog cards sit in that band — so a new member means "one of those was fired from a dead cell", never "a new bug". Six of the seven members are now in the 0.667 band; card 35 (0.889) remains the one exception, and it is there for the CURRENCY reason §13 exists to price, not the reachability one. */  /* [session 110] was [1, 3, 4, 6, 35] — card 84 JOINED */  /* superseded trail: card 84 JOINED the no-on-grid-footprint set this batch */
    // The histogram therefore covers 699 - 25 plays, and the miss histogram
    // 437 - 25. Asserted so a silent change in what gets counted is caught,
    // and as identities rather than literals so the relationship is the pin.
    expect([...result.aimErrorHist.values()].reduce((a, b) => a + b, 0)).toBe(1196); // [session 96] was 750; [session 92] was 726  // [session 98] was 793  /* [session 99] was 833 */ /* [session 102] was 842 */ /* [session 105] was 912 */  /* [session 107] was 962 */  /* [session 110] was 1031 */  /* [session 110b] was 1097 */  /* [session 113] was 1118 */
    expect([...result.aimErrorHist.values()].reduce((a, b) => a + b, 0)).toBe(result.plays - result.noFootprint);
    expect(result.perPlay.filter((p) => !p.actualHit).length).toBe(724); // [session 96] was 486; [session 92] was 470  // [session 98] was 514  /* [session 99] was 536 */ /* [session 102] was 541 */ /* [session 105] was 577 */  /* [session 107] was 600 */  /* [session 110] was 639 */  /* [session 110b] was 672 */  /* [session 113] was 682 */
  });
});
