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
    expect(result.plays).toBe(612);
    expect(result.casts).toBe(148);
  });

  it("reproduces the four rates — floor, actual, and both ceilings", () => {
    // [session 81] The figures gate 2 exists to reproduce. Recount these when
    // the corpus grows; a change here with a static corpus is a real change.
    // [session 81] Re-measured after the eight-cast batch. The instrument is
    // notably STABLE across +22 plays — 20.4->20.3, 35.4->36.3, 65.6->66.3,
    // 70.5->71.1 — which is what a ceiling that depends on the board rather
    // than on the bot should do.
    expect(result.random).toBeCloseTo(0.203, 3);
    expect(result.stayPut).toBeCloseTo(0.242, 3);
    expect(result.actual).toBeCloseTo(0.363, 3);
    expect(result.oracleSameCard).toBeCloseTo(0.663, 3);
    expect(result.oracleBestCard).toBeCloseTo(0.711, 3);

    // The derived readings the report prints, pinned so a change to the
    // arithmetic is caught rather than the inputs alone.
    expect(result.capturedFraction).toBeCloseTo(0.346, 3);
    expect(result.headroomRemaining).toBeCloseTo(0.301, 3);
    expect(result.cardSelectionValue).toBeCloseTo(0.047, 3);
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
    expect(holds).toBe(591);
    // **Every** failure is an oil consume — not most, all. This is the
    // assertion that makes the reconstruction legitimate rather than a fudge
    // that happens to fit: if a play ever breaks the identity WITHOUT an oil,
    // the focus-budget model is wrong in a way nobody has diagnosed.
    // 18 -> 21 across the batch, and the "every failure is an oil" claim
    // survived three NEW oil consumes with no residue. That is the assertion
    // doing work, not the count.
    expect(fails.length).toBe(21);
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
    expect(oil.length).toBe(21);
    expect(oil.every((o) => o.budget === 2)).toBe(true);
    expect(oil.every((o) => o.prevMeter === 0)).toBe(true);
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
    expect(outsideReach).toBe(12);
    expect(impossibleHits).toBe(6);
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
    expect(total).toBe(367);
    expect(h.get(1)).toBe(176);
    expect(h.get(2)).toBe(140);
    expect(h.get(3)).toBe(42);
    expect(h.get(4)).toBe(9);
    // Nothing further out, and nothing at 0 — a footprint containing the fish
    // is a hit by definition, so a 0 here would mean the resolver and this
    // measurement disagree about what a hit is.
    expect(h.get(0)).toBeUndefined();
    expect((h.get(1)! + h.get(2)!) / total).toBeGreaterThan(0.85);
  });

  it("counts the plays with NO on-grid footprint — a guaranteed miss, not a bad prediction", () => {
    // [session 81] Found by this test failing an assumption rather than by
    // anyone looking for it. `aimError` is null when every zone of the played
    // card translated off the board, so the shot could not have hit whatever
    // the fish did: 23 of 612 plays, 3.8%, and **all 23 are misses** — which
    // they must be, since a shot with no footprint cannot land. The eight-cast
    // batch added NONE, and no new offending card.
    const none = result.perPlay.filter((p) => p.aimError === null);
    expect(none.length).toBe(23);
    expect(result.noFootprint).toBe(23);
    expect(none.filter((p) => p.actualHit)).toEqual([]);
    // 6 of the 23 were AVOIDABLE: a different reachable focus would have hit
    // with the same card. So this is not a forced cost of the hand.
    expect(result.noFootprintAvoidable).toBe(6);
    // Card 1's hitZones are the whole top row of the template ([1,2,3]), so
    // firing it from grid row 1 puts every zone off-board. Pinned to the
    // cards actually implicated, so a new offender is a visible change.
    expect([...new Set(none.map((p) => p.cardId))].sort((a, b) => a - b)).toEqual([1, 3, 4, 6]);
    // The histogram therefore covers 612 - 23 plays, and the miss histogram
    // 390 - 23. Asserted so a silent change in what gets counted is caught.
    expect([...result.aimErrorHist.values()].reduce((a, b) => a + b, 0)).toBe(589);
    expect(result.perPlay.filter((p) => !p.actualHit).length).toBe(390);
  });
});
