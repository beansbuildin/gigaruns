/**
 * tests/fishing/redrawCounterfactual.test.ts — [session 83, brief §5 / GATE 1]
 *
 * Pins the redraw counterfactual, the check the method rests on, and the mana
 * slack — three things that are separately falsifiable and are therefore
 * asserted separately.
 *
 * ## Why the triple reconstruction is pinned on its own
 *
 * §2's table is only meaningful if "the hand a redraw would have drawn is the
 * next triple the cast actually drew" holds. A corpus change that breaks that
 * inference would otherwise show up as a SHIFTED TABLE — a number that moved a
 * little, which is exactly the kind of change nobody investigates. Pinned
 * separately, it fails loudly and says what broke.
 *
 * ## ⚠ The brief's numbers, and what is asserted instead
 *
 * The session-83 brief computed **386 plays / 262 / 26 / 42 / 56** and a mean
 * rescue cost of **1.57**, and asked for those to be reproduced. They do not
 * reproduce. This file asserts what the corpus as committed actually yields —
 * **389 / 261 / 27 / 45 / 56** and **1.60** — and records the delta rather
 * than hiding it, because the delta is small, legible, and does not move the
 * finding:
 *
 *  - the ACTUAL arm's reach count is **288 in both**, so the availability
 *    numerator reproduces exactly and only the denominator differs;
 *  - `neitherReaches` is **56 in both**;
 *  - the rescue histogram agrees on its largest bucket (24 one-card hands);
 *  - the brief's table is not a SUBSET of this one — its `bothReach` is one
 *    higher — so the difference is not a filter alone.
 *
 * CLAUDE.md rule 9: the corpus wins. The §1c mana-slack half of the gate DOES
 * reproduce byte for byte, which is what makes the §2 delta readable as a
 * predicate difference rather than a corpus drift.
 *
 * Reads committed fixtures only. Writes nothing, touches no `data/` or `logs/`
 * path, makes no network call.
 */
import { describe, expect, it } from "vitest";

import { loadCastTraces, isCleanTrace } from "../../src/sim/fishing/castTrace.js";
import {
  assertRedrawCounterfactualSound,
  drawTriples,
  manaSlack,
  redrawCounterfactual,
  separability,
  tripleReconstruction,
} from "../../src/sim/fishing/redrawCounterfactual.js";

const TRACES = loadCastTraces();

describe("the triple reconstruction — §2a, pinned before the table that uses it", () => {
  it("advances nextCardIndex by exactly +3 on every draw that advances it, with 7 pile wraps", () => {
    const tr = tripleReconstruction(TRACES);
    expect(tr.traces).toBe(148);
    expect(tr.deltas.get(3)).toBe(137);
    expect(tr.wraps).toBe(7);
    // Session 79's wraps, by size. The cursor goes DOWN, because the server
    // wraps rather than overflows — a predicate looking for an index ABOVE
    // deck length cannot see exhaustion at all.
    expect(tr.deltas.get(-7)).toBe(3);
    expect(tr.deltas.get(-8)).toBe(4);
    // No other delta exists: every draw is a clean triple.
    expect([...tr.deltas.keys()].sort((a, b) => a - b)).toEqual([-8, -7, 3]);
  });

  it("deals at least one previously-unheld card on every single draw", () => {
    const tr = tripleReconstruction(TRACES);
    expect(tr.draws).toBe(144);
    expect(tr.drawsWithUnheldCard).toBe(144);
  });

  it("the unheld-card check is NOT vacuous — the drawing turn's own hand must be excluded", () => {
    // The state doc's `hand` on a refill turn is ALREADY the new hand, so
    // comparing against turns 0..i instead of 0..i-1 reports 0 of 144 — the
    // vacuous form, which reads like a failure rather than like a bug. This
    // asserts the two readings genuinely differ on this corpus, so the
    // 144/144 above is evidence of something.
    let vacuous = 0;
    let draws = 0;
    for (const t of TRACES) {
      for (let i = 1; i < t.turns.length; i++) {
        const nh = t.turns[i]!.newHand;
        if (!nh) continue;
        draws++;
        const heldIncludingNow = new Set<number>();
        for (let j = 0; j <= i; j++) for (const c of t.turns[j]!.hand) heldIncludingNow.add(c);
        if (nh.some((c) => !heldIncludingNow.has(c))) vacuous++;
      }
    }
    expect(draws).toBe(144);
    expect(vacuous).toBe(0);
  });

  it("every cast reveals its opening hand as the first triple", () => {
    for (const t of TRACES) {
      const triples = drawTriples(t);
      expect(triples.length).toBeGreaterThan(0);
      expect(triples[0]!.at).toBe(0);
      expect(triples[0]!.cards).toEqual(t.turns[0]!.hand);
    }
  });
});

describe("the four-cell counterfactual — §2b", () => {
  /**
   * **The predicate, in the brief's own words**, so a later reader can check
   * the filter and not only the count:
   *
   *   every play transition where exactly one card moved from hand to
   *   discard; both states carry `focusPoint` and `fishPosition`; every card
   *   in the held hand belongs to one revealed draw-triple; the NEXT triple
   *   was drawn later in the same cast; and a further play exists in that
   *   cast.
   *
   * Both arms are scored with session 81's validated semantics — resolution
   * against the post-move focus and the resulting-state cell, reachable focus
   * from `spent + remaining` (`budgetBefore`), never the stale
   * `prev.focusMeter`. The redraw arm is scored against the NEXT turn's cell,
   * because a redraw burns the fish's move.
   */
  it("reproduces the table the corpus actually yields, and the four cells partition", () => {
    const r = redrawCounterfactual(TRACES);
    assertRedrawCounterfactualSound(r);

    expect(r.plays).toBe(389); // brief: 386
    expect(r.bothReach).toBe(261); // brief: 262
    expect(r.sacrifice).toBe(27); // brief: 26
    expect(r.rescue).toBe(45); // brief: 42
    expect(r.neitherReaches).toBe(56); // brief: 56 — agrees
    expect(r.bothReach + r.sacrifice + r.rescue + r.neitherReaches).toBe(r.plays);
  });

  it("agrees with the brief EXACTLY on how many plays the held hand could reach", () => {
    // 288 on both sides. This is what makes the disagreement above readable as
    // a denominator difference rather than a scoring difference in the arm the
    // shipped bot actually plays.
    const r = redrawCounterfactual(TRACES);
    expect(r.bothReach + r.sacrifice).toBe(288);
    expect(r.actualAvailability).toBeCloseTo(288 / 389, 6);
    expect(r.redrawAvailability).toBeCloseTo(306 / 389, 6);
  });

  it("prices a rescuing redraw at one mana per card held", () => {
    const r = redrawCounterfactual(TRACES);
    expect(r.meanRescueCost).toBeCloseTo(1.6, 2); // brief: 1.57
    expect([...r.rescueCostHist.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 24], // brief: 24 — agrees
      [2, 15], // brief: 12
      [3, 6], // brief: 6 — agrees
    ]);
    // The cost is the held hand's SIZE, by construction — assert it rather
    // than trust it, since the histogram above is the only place the price
    // enters and a wrong price would look like a plausible number.
    for (const p of r.perPlay) {
      if (p.actualCanReach || !p.redrawCanReach) continue;
      expect(r.rescueCostHist.has(p.held.length)).toBe(true);
      expect(p.held.length).toBeGreaterThanOrEqual(1);
      expect(p.held.length).toBeLessThanOrEqual(3);
    }
  });

  it("scores a dead hand on a quarter of plays, and a redraw rescues 45% of those", () => {
    const r = redrawCounterfactual(TRACES);
    const dead = r.rescue + r.neitherReaches;
    expect(dead).toBe(101); // brief: 98
    expect(dead / r.plays).toBeCloseTo(0.26, 2);
    expect(r.rescue / dead).toBeCloseTo(0.446, 3);
  });

  it("every reconstructed hand is a real three-card triple of cards the cast defines", () => {
    // The soundness assertion's second invariant, exercised positively: a row
    // scored against a card `deckCardData` does not define would silently
    // score as "cannot reach" and bias the redraw arm DOWNWARD.
    const r = redrawCounterfactual(TRACES);
    const byDoc = new Map(TRACES.map((t) => [t.docId, t]));
    for (const p of r.perPlay) {
      expect(p.redrawn).toHaveLength(3);
      const t = byDoc.get(p.docId)!;
      for (const id of p.redrawn) expect(t.cards.has(id)).toBe(true);
      for (const id of p.held) expect(t.cards.has(id)).toBe(true);
    }
  });

  it("counts a card moving to the discard, NOT the hand shrinking — the two differ by 103 rows", () => {
    // The trap that decides `n`. On a REFILL turn the hand goes 1 -> 3, so
    // reading "exactly one card moved from hand to discard" as a length
    // decrement silently drops every refill turn. Both readings are the same
    // English sentence; only one of them is the measurement. Asserted so the
    // wrong reading cannot be reintroduced as a simplification.
    let byLength = 0;
    for (const t of TRACES) {
      const triples = drawTriples(t);
      for (let i = 1; i < t.turns.length; i++) {
        const cur = t.turns[i]!;
        const prev = t.turns[i - 1]!;
        if (!cur.play) continue;
        if (prev.hand.length - cur.hand.length !== 1) continue;
        if (cur.discard.length - prev.discard.length !== 1) continue;
        if (!triples.some((tr) => tr.at >= i)) continue;
        const next = t.turns[i + 1];
        if (!next || !next.play) continue;
        byLength++;
      }
    }
    expect(byLength).toBe(286);
    expect(redrawCounterfactual(TRACES).plays - byLength).toBe(103);
  });

  it("is not an artefact of the trace filter — clean-only moves it by one row", () => {
    const clean = redrawCounterfactual(TRACES.filter(isCleanTrace));
    expect(clean.plays).toBe(388);
    expect(clean.neitherReaches).toBe(56);
    expect(clean.bothReach).toBe(261);
  });
});

describe("the mana slack — §1c, GATE 2", () => {
  /**
   * **Predicate:** every RESOLVED trace (`caught || escaped`), reading
   * `playerHp` — the mana pool, not health — off the LAST recorded state.
   * `isCleanTrace` is deliberately not applied: a cast that broke position
   * continuity mid-way still ended where it ended.
   *
   * This half of the gate reproduces the brief EXACTLY, histogram included.
   */
  it("reproduces the brief's distribution byte for byte", () => {
    const m = manaSlack(TRACES);
    expect(m.casts).toBe(147);
    expect(m.mean).toBeCloseTo(5.85, 2);
    expect(m.median).toBe(7);
    expect(m.manaOut).toBe(15);
    expect([...m.hist.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [0, 15],
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 6],
      [5, 16],
      [6, 17],
      [7, 27],
      [8, 49],
      [9, 5],
    ]);
  });

  it("splits by outcome the way the brief reports", () => {
    const m = manaSlack(TRACES);
    expect(m.caught).toBe(48);
    expect(m.escaped).toBe(99);
    expect(m.meanWhenCaught).toBeCloseTo(6.73, 2);
    expect(m.meanWhenEscaped).toBeCloseTo(5.42, 2);
  });

  it("says the pool is not what ends casts: 89.8% of casts leave mana unspent", () => {
    const m = manaSlack(TRACES);
    expect(m.casts - m.manaOut).toBe(132);
    expect((m.casts - m.manaOut) / m.casts).toBeCloseTo(0.898, 3);
  });

  it("excludes unresolved casts rather than reading a truncated capture as a cast end", () => {
    // Anti-vacuity: the resolved filter must actually filter, otherwise "147"
    // is just "every trace" wearing a predicate.
    expect(TRACES.length).toBe(148);
    expect(TRACES.filter((t) => t.caught || t.escaped)).toHaveLength(147);
  });
});

describe("separability — §3, the question that decides whether §2 is actionable", () => {
  const SEP = separability(redrawCounterfactual(TRACES));

  it("finds a decision-time signal that separates dead hands from live ones", () => {
    // `heldCoverage` uses the hand, the focus point and the meter. It does NOT
    // use where the fish went, which is what makes it a candidate trigger and
    // not another oracle.
    expect(SEP.deadPlays).toBe(101);
    expect(SEP.livePlays).toBe(288);
    expect(SEP.coverageAuc).toBeCloseTo(0.922, 3);
    expect(SEP.meanCoverageDead).toBeCloseTo(5.13, 2);
    expect(SEP.meanCoverageLive).toBeCloseTo(13.32, 2);
    // A hand that can put a zone on all sixteen cells is never dead. Asserted
    // because it is the mechanism behind the AUC, not a coincidence of it.
    expect(SEP.sweep[15]!.fires).toBe(248);
    expect(SEP.sweep[16]!.fires).toBe(389);
  });

  it("finds the INVERSION: the dead hands it can find are the ones a redraw cannot fix", () => {
    const by = new Map(SEP.splits.map((s) => [s.label, s]));
    expect(by.get("coverage <= 3")).toMatchObject({ deadPlays: 46, rescued: 7 });
    expect(by.get("coverage >= 4")).toMatchObject({ deadPlays: 55, rescued: 38 });
    // The rescue rate runs the WRONG WAY against the detector: 15% where the
    // signal fires, 69% where it says the hand is fine. This is the finding,
    // and it is asserted as an inequality so it cannot silently flip.
    expect(by.get("coverage <= 3")!.rescueRate).toBeLessThan(by.get("coverage >= 4")!.rescueRate);
  });

  it("explains the inversion with the focus meter — a redraw does not restore it", () => {
    const by = new Map(SEP.splits.map((s) => [s.label, s]));
    expect(by.get("focus budget 0")).toMatchObject({ deadPlays: 74, rescued: 19 });
    expect(by.get("focus budget >= 1")).toMatchObject({ deadPlays: 27, rescued: 26 });
    expect(by.get("focus budget >= 1")!.rescueRate).toBeCloseTo(26 / 27, 3);
    // 74 of the 101 dead hands are dead because the meter is empty, and firing
    // from one fixed cell is what a fresh triple cannot fix.
    expect(by.get("focus budget 0")!.deadPlays + by.get("focus budget >= 1")!.deadPlays).toBe(SEP.deadPlays);
  });

  it("the unconditional trigger is worthless where it is confident, and the conditioned one is not", () => {
    // K <= 3 over ALL plays: 55 firings, 7 rescues, 7 sacrifices — exactly
    // break-even on the count, and 39 of the firings are dead hands the redraw
    // could not have saved either. That is the unsatisfying version.
    const all3 = SEP.sweep[3]!;
    expect(all3).toMatchObject({ fires: 55, rescues: 7, sacrifices: 7, wasted: 39 });
    expect(all3.rescues - all3.sacrifices).toBe(0);

    // The same signal, restricted to plays with a point of focus budget left.
    const b6 = SEP.sweepWithBudget[6]!;
    expect(b6).toMatchObject({ fires: 6, rescues: 6, sacrifices: 0, wasted: 0, manaSpent: 9 });
    const b10 = SEP.sweepWithBudget[10]!;
    expect(b10).toMatchObject({ fires: 44, rescues: 18, sacrifices: 3, wasted: 1, manaSpent: 60 });
    expect(b10.rescues - b10.sacrifices).toBe(15);
  });

  it("is a shape, not a tuning — the sweep is monotone in firings, so no K is an optimum to ship", () => {
    // Anti-vacuity, and the guard against the number above being read as a
    // calibrated threshold: `fires` is non-decreasing in K by construction, so
    // picking the K with the best net on this corpus is fitting to 101 oracle
    // labels with no held-out set. Asserted so nobody reads the table as one.
    for (let k = 1; k <= 16; k++) {
      expect(SEP.sweep[k]!.fires).toBeGreaterThanOrEqual(SEP.sweep[k - 1]!.fires);
      expect(SEP.sweepWithBudget[k]!.fires).toBeGreaterThanOrEqual(SEP.sweepWithBudget[k - 1]!.fires);
    }
  });
});
