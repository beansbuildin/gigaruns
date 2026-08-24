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
    expect(result.plays).toBe(751); // was 699
    expect(result.casts).toBe(178); // was 168
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
    expect(result.random).toBeCloseTo(0.2, 3); // was 0.199
    expect(result.stayPut).toBeCloseTo(0.245, 3); // was 0.239
    expect(result.actual).toBeCloseTo(0.374, 3); // was 0.375
    expect(result.oracleSameCard).toBeCloseTo(0.666, 3); // was 0.662
    expect(result.oracleBestCard).toBeCloseTo(0.711, 3); // was 0.710

    // The derived readings the report prints, pinned so a change to the
    // arithmetic is caught rather than the inputs alone.
    expect(result.capturedFraction).toBeCloseTo(0.373, 3); // [session 91] was 0.380
    expect(result.headroomRemaining).toBeCloseTo(0.292, 3); // [session 91] was 0.288 // was 0.301
    expect(result.cardSelectionValue).toBeCloseTo(0.045, 3); // [session 91] was 0.047 — held to 3dp across three widenings before this
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
    expect(holds).toBe(727); // [session 91] was 675
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
    expect(total).toBe(445); // [session 91] was 412
    expect(h.get(1)).toBe(220); // [session 91] was 199
    expect(h.get(2)).toBe(164); // [session 91] was 156
    expect(h.get(3)).toBe(50); // [session 91] was 46
    expect(h.get(4)).toBe(11); // was 9
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
    expect(none.length).toBe(25); // was 23
    expect(result.noFootprint).toBe(25); // was 23
    expect(none.filter((p) => p.actualHit)).toEqual([]); // STRUCTURAL, still true
    // 6 of the 25 were AVOIDABLE: a different reachable focus would have hit
    // with the same card. So this is not a forced cost of the hand.
    expect(result.noFootprintAvoidable).toBe(6); // UNCHANGED
    // Card 1's hitZones are the whole top row of the template ([1,2,3]), so
    // firing it from grid row 1 puts every zone off-board. Pinned to the
    // cards actually implicated, so a new offender is a visible change.
    expect([...new Set(none.map((p) => p.cardId))].sort((a, b) => a - b)).toEqual([1, 3, 4, 6]);
    // The histogram therefore covers 699 - 25 plays, and the miss histogram
    // 437 - 25. Asserted so a silent change in what gets counted is caught,
    // and as identities rather than literals so the relationship is the pin.
    expect([...result.aimErrorHist.values()].reduce((a, b) => a + b, 0)).toBe(726); // [session 91] was 674
    expect([...result.aimErrorHist.values()].reduce((a, b) => a + b, 0)).toBe(result.plays - result.noFootprint);
    expect(result.perPlay.filter((p) => !p.actualHit).length).toBe(470); // [session 91] was 437
  });
});
