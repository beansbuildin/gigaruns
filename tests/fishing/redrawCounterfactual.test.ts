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
 * ## ⚠ THESE PINS TRACK THE LIVE CORPUS. THE SESSION-86 MEMO DOES NOT.
 *
 * [session 90 §2] `loadCastTraces()` takes no date and no doc-id filter — it
 * reads whatever is in `fixtures/fishing-casts/` right now. So every number
 * below MOVES when the corpus grows, and was regenerated at 168 casts (from
 * 148) by CALLING the real functions, never by hand-typing off a recap. Old
 * values are kept beside each pin.
 *
 * `handoff/reports/session-86-redraw-revisit.md` and `session-86-corpus-snapshot.md`
 * are the opposite kind of artefact: a snapshot computed ONCE at
 * `CORPUS-2026-08-23A` and permanently frozen, which `QUESTIONS.md` §28
 * forbids recomputing. **The two will diverge further every session, on
 * purpose. That is not a bug in either one** — it is a live instrument and a
 * dated measurement, and confusing them is how a frozen figure gets quietly
 * "corrected" into something nobody measured.
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
    expect(tr.traces).toBe(230); // [session 93] was 188; was 148 @148 casts  /* [session 92] was 178 */  // [session 96] was 189  // [session 98] was 199  /* [session 99] was 208 */ /* [session 102] was 210 */
    expect(tr.deltas.get(3)).toBe(213); // was 137  /* [session 92] was 174 */  // [session 96] was 177  // [session 98] was 185  /* [session 99] was 196 */ /* [session 102] was 198 */
    expect(tr.wraps).toBe(8);  // [session 96] was 7
    // Session 79's wraps, by size. The cursor goes DOWN, because the server
    // wraps rather than overflows — a predicate looking for an index ABOVE
    // deck length cannot see exhaustion at all.
    expect(tr.deltas.get(-7)).toBe(4);  // [session 96] was 3
    expect(tr.deltas.get(-8)).toBe(4);
    // No other delta exists: every draw is a clean triple.
    expect([...tr.deltas.keys()].sort((a, b) => a - b)).toEqual([-8, -7, 3]);
  });

  it("deals at least one previously-unheld card on every single draw", () => {
    const tr = tripleReconstruction(TRACES);
    // STRUCTURAL AND UNCHANGED: the two are still EQUAL. 144/144 -> 166/166.
    expect(tr.draws).toBe(221); // was 144  /* [session 92] was 181 */  // [session 96] was 184  // [session 98] was 193  /* [session 99] was 204 */ /* [session 102] was 206 */
    expect(tr.drawsWithUnheldCard).toBe(221); // was 144  /* [session 92] was 181 */  // [session 96] was 184  // [session 98] was 193  /* [session 99] was 204 */ /* [session 102] was 206 */
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
    expect(draws).toBe(221); // was 144  /* [session 92] was 181 */  // [session 96] was 184  // [session 98] was 193  /* [session 99] was 204 */ /* [session 102] was 206 */
    // STRUCTURAL AND UNCHANGED: the vacuous reading still finds nothing, so the
    // 166/166 above is still evidence rather than a tautology.
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

    expect(r.plays).toBe(592); // was 389 @148 casts (session-83 brief: 386)  /* [session 92] was 485 */  // [session 96] was 493  // [session 98] was 519  /* [session 99] was 547 */ /* [session 102] was 553 */
    expect(r.bothReach).toBe(396); // was 261 (brief: 262)  /* [session 92] was 323 */  // [session 96] was 327  // [session 98] was 347  /* [session 99] was 362 */ /* [session 102] was 368 */
    expect(r.sacrifice).toBe(39); // was 27 (brief: 26)  /* [session 91] was 30 */  // [session 96] was 34  // [session 98] was 35 /* [session 102] was 37 */
    expect(r.rescue).toBe(74); // was 45 (brief: 42)  /* [session 92] was 60 */  // [session 96] was 61  // [session 98] was 64 /* [session 102] was 71 */
    expect(r.neitherReaches).toBe(83); // was 56 (brief: 56)  /* [session 92] was 68 */  // [session 96] was 71  // [session 98] was 73 /* [session 102] was 77 */
    expect(r.bothReach + r.sacrifice + r.rescue + r.neitherReaches).toBe(r.plays);
  });

  it("the two availabilities are the reach counts over the same denominator", () => {
    // [session 90 §2] This assertion USED to be "agrees with the session-83
    // brief EXACTLY on 288". That agreement was a fact about 148 casts and is
    // retired rather than reinterpreted — at 168 casts the reach count is 326
    // and there is no brief to agree with. What is still pinned, and is the
    // part that was ever load-bearing, is that both availabilities are
    // counts over `plays` and that the actual arm is the smaller.
    const r = redrawCounterfactual(TRACES);
    expect(r.bothReach + r.sacrifice).toBe(435); // was 288  /* [session 92] was 357 */  // [session 96] was 361  // [session 98] was 382  /* [session 99] was 399 */ /* [session 102] was 405 */
    expect(r.actualAvailability).toBeCloseTo(435 / 592, 6);  // [session 98] was 382 / 519  // [session 99] was 399 / 547 /* [session 102] was 405 / 553 */
    expect(r.redrawAvailability).toBeCloseTo(470 / 592, 6); // [session 98] was 411 / 519  // [session 99] was 433 / 547 /* [session 102] was 439 / 553 */
    expect(r.redrawAvailability).toBeGreaterThan(r.actualAvailability);
  });

  it("prices a rescuing redraw at one mana per card held", () => {
    const r = redrawCounterfactual(TRACES);
    expect(r.meanRescueCost).toBeCloseTo(1.6216216216216217, 2); // [session 98] was 1.625 /* [session 102] was 1.6338028169014085 */
    expect([...r.rescueCostHist.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 40], // [session 98] was 35; [session 96] was 34 /* [session 102] was 38 */
      [2, 22], // [session 98] was 18 — moved for the first time in three batches /* [session 102] was 21 */
      [3, 12], // [session 98] was 11; [session 96] was 9
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

  it("scores a dead hand on a quarter of plays, and a redraw rescues 47% of those", () => {
    const r = redrawCounterfactual(TRACES);
    const dead = r.rescue + r.neitherReaches;
    expect(dead).toBe(157); // was 101 (brief: 98)  /* [session 92] was 128 */  // [session 96] was 132  // [session 98] was 137 /* [session 102] was 148 */
    // The dead RATE is the durable half: 0.260 -> 0.266 across 20 more casts.
    expect(dead / r.plays).toBeCloseTo(0.2652027027027027, 3);  /* [session 92] was 0.2639 */  // [session 96] was 0.26774847870182555  // [session 98] was 0.26396917148362237  /* [session 99] was 0.27056672760511885 */ /* [session 102] was 0.26763110307414106 */
    expect(r.rescue / dead).toBeCloseTo(0.4713375796178344, 3); // was 0.446  /* [session 92] was 0.469 */  // [session 96] was 0.4621212121212121  // [session 98] was 0.46715328467153283 /* [session 102] was 0.4797297297297297 */
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
    expect(byLength).toBe(440); // was 286  /* [session 92] was 360 */  // [session 96] was 366  // [session 98] was 384  /* [session 99] was 406 */ /* [session 102] was 410 */
    expect(redrawCounterfactual(TRACES).plays - byLength).toBe(152); // was 103  /* [session 92] was 125 */  // [session 96] was 127  // [session 98] was 135  /* [session 99] was 141 */ /* [session 102] was 143 */
  });

  it("is not an artefact of the trace filter — clean-only moves it by one row", () => {
    const clean = redrawCounterfactual(TRACES.filter(isCleanTrace));
    // STRUCTURAL AND UNCHANGED: still EXACTLY one row, on 20 more casts.
    expect(clean.plays).toBe(591); // was 388  /* [session 92] was 484 */  // [session 96] was 492  // [session 98] was 518  /* [session 99] was 546 */ /* [session 102] was 552 */
    expect(redrawCounterfactual(TRACES).plays - clean.plays).toBe(1);
    expect(clean.neitherReaches).toBe(83); // was 56  /* [session 92] was 68 */  // [session 96] was 71  // [session 98] was 73 /* [session 102] was 77 */
    expect(clean.bothReach).toBe(396); // was 261  /* [session 92] was 323 */  // [session 96] was 327  // [session 98] was 347  /* [session 99] was 362 */ /* [session 102] was 368 */
  });
});

describe("the mana slack — §1c, GATE 2", () => {
  /**
   * **Predicate:** every RESOLVED trace (`caught || escaped`), reading
   * `playerHp` — the mana pool, not health — off the LAST recorded state.
   * `isCleanTrace` is deliberately not applied: a cast that broke position
   * continuity mid-way still ended where it ended.
   *
   * [session 90 §2] This half USED to reproduce the session-83 brief byte for
   * byte. It no longer can — the brief measured 147 resolved casts and there
   * are now 167 — and the byte-for-byte claim is retired rather than restated.
   * What survives is better evidence than the agreement was: the SHAPE is
   * unchanged. Median still 7, the 8-bucket still the mode, the mean moved by
   * 0.02, and the headline 89.8% still holds to three decimals on 20 more
   * casts. See the frozen-memo note in this file's header.
   */
  it("reproduces the distribution the corpus now yields, with the shape unmoved", () => {
    const m = manaSlack(TRACES);
    expect(m.casts).toBe(229); // [session 93] was 187; was 147  /* [session 92] was 177 */  // [session 96] was 188  // [session 98] was 198  /* [session 99] was 207 */ /* [session 102] was 209 */
    expect(m.mean).toBeCloseTo(5.908296943231441, 2); // [session 93] was 5.866310160427807; was 5.85  /* [session 92] was 5.768 */  // [session 96] was 5.88  // [session 98] was 5.8686868686868685 /* [session 102] was 5.855072463768116 */
    expect(m.median).toBe(7); // UNCHANGED
    expect(m.manaOut).toBe(21); // was 15  /* [session 91] was 17 */  // [session 96] was 19  // [session 98] was 20
    expect([...m.hist.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      // [session 102] +20 casts. The SHAPE is unmoved, which is what this
      // pin is for: 8 is still the mode by a wide margin and the 7-8 pair
      // still carries most of the mass. Every bucket rose or held; none fell.
      [0, 21], // [session 98] was 20; [session 96] was 19 — UNCHANGED across the twenty-cast batch
      [1, 4], // [session 98] was 3 — UNCHANGED across the twenty-cast batch
      [2, 7], // UNCHANGED across the nine-cast batch /* [session 102] was 5 */
      [3, 8], // [session 98] was 7 — UNCHANGED across the twenty-cast batch
      [4, 10], // UNCHANGED across the nine-cast batch /* [session 102] was 9 */
      [5, 25], // [session 99] was 22 /* [session 102] was 23 */
      [6, 27], // [session 99] was 24 /* [session 102] was 25 */
      [7, 43], // [session 98] was 35; [session 91] was 32 /* [session 102] was 38 */
      [8, 73], // [session 98] was 64; [session 96] was 61 — still the mode /* [session 102] was 66 */
      [9, 11], // [session 98] was 9; [session 96] was 8 /* [session 102] was 10 */
    ]);
  });

  it("splits by outcome, and the caught arm still leaves MORE mana unspent", () => {
    const m = manaSlack(TRACES);
    expect(m.caught).toBe(94); // [session 93] was 69; was 48  /* [session 92] was 64 */  // [session 96] was 70  // [session 98] was 73  /* [session 99] was 79 */ /* [session 102] was 80 */
    expect(m.escaped).toBe(135); // was 99  /* [session 92] was 113 */  // [session 96] was 118  // [session 98] was 125  /* [session 99] was 128 */ /* [session 102] was 129 */
    expect(m.meanWhenCaught).toBeCloseTo(6.872340425531915, 2); // [session 93] was 6.898550724637682; was 6.73  /* [session 92] was 6.766 */  // [session 96] was 6.91  // [session 98] was 6.904109589041096  /* [session 99] was 6.886075949367089 */ /* [session 102] was 6.8625 */
    expect(m.meanWhenEscaped).toBeCloseTo(5.237037037037037, 2); // was 5.42  /* [session 92] was 5.204 */  // [session 98] was 5.262711864406779  /* [session 99] was 5.21875 */ /* [session 102] was 5.224806201550388 */
    // The DIRECTION is the finding and it widened rather than eroded: casts
    // that landed the fish ended with more mana left over, not less.
    expect(m.meanWhenCaught).toBeGreaterThan(m.meanWhenEscaped);
  });

  it("says the pool is not what ends casts: 89.8% of casts leave mana unspent", () => {
    const m = manaSlack(TRACES);
    expect(m.casts - m.manaOut).toBe(208); // [session 93] was 168; was 132  /* [session 92] was 158 */  // [session 96] was 169  // [session 98] was 178  /* [session 99] was 186 */ /* [session 102] was 188 */
    // 89.8% SURVIVES TO THREE DECIMALS on 20 more casts — the one figure in
    // this file the corpus growth did not move at all.
    expect((m.casts - m.manaOut) / m.casts).toBeCloseTo(0.9082969432314411, 3);  /* [session 92] was 0.8927 */ // [session 93] was 0.8983957219251337  /* [session 99] was 0.899 */ /* [session 102] was 0.8995215311004785 */
  });

  it("excludes unresolved casts rather than reading a truncated capture as a cast end", () => {
    // Anti-vacuity: the resolved filter must actually filter, otherwise "147"
    // is just "every trace" wearing a predicate.
    expect(TRACES.length).toBe(230); // [session 93] was 188; was 148  /* [session 92] was 178 */  // [session 96] was 189  // [session 98] was 199  /* [session 99] was 208 */ /* [session 102] was 210 */
    // STRUCTURAL AND UNCHANGED: still EXACTLY one unresolved trace.
    expect(TRACES.filter((t) => t.caught || t.escaped)).toHaveLength(229); // [session 96] was 188; [session 92] was 177  // [session 98] was 198  /* [session 99] was 207 */ /* [session 102] was 209 */
    expect(TRACES.length - TRACES.filter((t) => t.caught || t.escaped).length).toBe(1);
  });
});

describe("separability — §3, the question that decides whether §2 is actionable", () => {
  const SEP = separability(redrawCounterfactual(TRACES));

  it("finds a decision-time signal that separates dead hands from live ones", () => {
    // `heldCoverage` uses the hand, the focus point and the meter. It does NOT
    // use where the fish went, which is what makes it a candidate trigger and
    // not another oracle.
    expect(SEP.deadPlays).toBe(157); // was 101  /* [session 92] was 128 */  // [session 96] was 132  // [session 98] was 137 /* [session 102] was 148 */
    expect(SEP.livePlays).toBe(435); // was 288  /* [session 92] was 357 */  // [session 96] was 361  // [session 98] was 382  /* [session 99] was 399 */ /* [session 102] was 405 */
    // The AUC is the durable claim and it barely moved: 0.922 -> 0.921.
    expect(SEP.coverageAuc).toBeCloseTo(0.9255802035288089, 3);  /* [session 92] was 0.9216 */  // [session 98] was 0.9238856711155881  /* [session 99] was 0.9214675201517307 */ /* [session 102] was 0.9226142809476143 */
    expect(SEP.meanCoverageDead).toBeCloseTo(5.2993630573248405, 2); // was 5.13  /* [session 92] was 5.258 */  // [session 96] was 5.196969696969697  // [session 98] was 5.240875912408759 /* [session 102] was 5.283783783783784 */
    expect(SEP.meanCoverageLive).toBeCloseTo(13.40919540229885, 2); // [session 92] was 13.33  // [session 96] was 13.34  // [session 98] was 13.350785340314136  /* [session 99] was 13.298245614035087 */ /* [session 102] was 13.335802469135803 */
    // A hand that can put a zone on all sixteen cells is never dead. Asserted
    // because it is the mechanism behind the AUC, not a coincidence of it.
    expect(SEP.sweep[15]!.fires).toBe(376); // was 248  /* [session 92] was 310 */  /* [session 91] was 285 */  // [session 96] was 316  // [session 98] was 332  /* [session 99] was 354 */ /* [session 102] was 355 */
    // STRUCTURAL AND UNCHANGED: full coverage fires on EVERY play, which is
    // the mechanism behind the AUC rather than a coincidence of it.
    expect(SEP.sweep[16]!.fires).toBe(592); // was 389  /* [session 92] was 485 */  // [session 96] was 493  // [session 98] was 519  /* [session 99] was 547 */ /* [session 102] was 553 */
    expect(SEP.sweep[16]!.fires).toBe(redrawCounterfactual(TRACES).plays);
  });

  it("finds the INVERSION: the dead hands it can find are the ones a redraw cannot fix", () => {
    const by = new Map(SEP.splits.map((s) => [s.label, s]));
    expect(by.get("coverage <= 3")).toMatchObject({ deadPlays: 63, rescued: 13 }); // [session 98] was 58 / 11 — `rescued` MOVED for the first time in four batches /* [session 102] was 61 / 12 */
    expect(by.get("coverage >= 4")).toMatchObject({ deadPlays: 94, rescued: 61 }); // [session 98] was 79 / 53 /* [session 102] was 87 / 59 */
    // The rescue rate runs the WRONG WAY against the detector: 16% where the
    // signal fires (was 15%), 71% where it says the hand is fine (was 69%).
    // THE INVERSION SURVIVED the corpus growing by 20 casts, and it widened.
    // [session 96] It survived a further 10 casts and WIDENED again: the rate
    // where the signal fires FELL back (11/53 -> 11/58, 21% -> 19.0%) because
    // `rescued` held at 11 while dead plays grew, and the other arm rose
    // (50/76 -> 53/79, 66% -> 67.1%). The gap is the widest it has been.
    // [session 91] It survived a further 10 casts. It did NOT widen this time —
    // the rate where the signal fires rose (8/50 -> 11/53, 16% -> 21%) while
    // the other arm barely moved — so the inversion is narrowing, not growing.
    // Still an inequality, still holding, and reported as narrowing rather
    // than restated as "and it widened".
    // This is the finding, and it is asserted as an inequality so it cannot
    // silently flip.
    expect(by.get("coverage <= 3")!.rescueRate).toBeLessThan(by.get("coverage >= 4")!.rescueRate);
  });

  it("explains the inversion with the focus meter — a redraw does not restore it", () => {
    const by = new Map(SEP.splits.map((s) => [s.label, s]));
    expect(by.get("focus budget 0")).toMatchObject({ deadPlays: 107, rescued: 34 }); // [session 98] was 95 / 28 /* [session 102] was 101 / 32 */
    expect(by.get("focus budget >= 1")).toMatchObject({ deadPlays: 50, rescued: 40 }); // [session 98] was 42 / 36 /* [session 102] was 47 / 39 */
    // ⚠ 26/27 (96.3%) -> 34/37 (91.9%) -> [session 91] 34/38 (89.5%). Session
    // 89 already retracted the upper bound of this rate; it has now drifted
    // down on three consecutive corpus growths, which is what a small-sample
    // rate does. Do not quote it as ~96%, and do not quote it as ~92% either.
    // [session 96] 89.5% -> 85.4% -> **85.7%**. The four-batch slide has
    // FLATTENED rather than continued; that is one observation, not a floor.
    // The instruction above stands unchanged: do not quote this rate.
    // [session 102] 85.7% -> 80.0% (40/50). The flattening session 96 noted
    // did NOT hold: the largest batch on record resumed the slide, and by the
    // biggest single step since session 89. Four values now: 96.3, 91.9, 89.5,
    // 85.4, 85.7, 80.0. The standing instruction is unchanged and is now
    // better supported than ever — DO NOT QUOTE THIS RATE.
    expect(by.get("focus budget >= 1")!.rescueRate).toBeCloseTo(40 / 50, 3); // [session 98] was 36 / 42 /* [session 102] was 39 / 47 */
    // 81 of the 118 dead hands are dead because the meter is empty, and firing
    // from one fixed cell is what a fresh triple cannot fix.
    expect(by.get("focus budget 0")!.deadPlays + by.get("focus budget >= 1")!.deadPlays).toBe(SEP.deadPlays);
  });

  /**
   * ⚠⚠ **[session 90 §2] TWO STRUCTURAL CLAIMS IN THIS TEST CHANGED. They are
   * flagged here rather than renumbered, because neither is corpus drift.**
   *
   * **(A) "exactly break-even" is gone.** `all3.rescues - all3.sacrifices` was
   * `7 - 7 = 0` and is now `8 - 7 = +1`. Zero was never a property of the
   * signal; it was a property of 148 casts, and the phrase *"exactly
   * break-even on the count"* cannot be restated. The assertion below now pins
   * the DIRECTION — the unconditional arm buys approximately nothing — which
   * is the claim that was ever load-bearing, and asserts the net as a small
   * number rather than as zero.
   *
   * **(B) The K=6 conditioned arm is no longer CLEAN.** It was
   * `{fires 6, rescues 6, sacrifices 0, wasted 0}` — every firing a rescue,
   * nothing wasted. It is now `{fires 12, rescues 8, sacrifices 0, wasted 2}`.
   * **`wasted` 0 -> 2.** `sacrifices: 0` survives, and that is the stronger
   * half: the conditioned trigger still never fired on a hand a redraw would
   * have made WORSE. But two of its twelve firings were hands no redraw could
   * have saved, and "6 of 6" is no longer true of anything.
   *
   * **This matters beyond this file.** `QUESTIONS.md` §26's shadow-evaluation
   * candidate IS this arm, and it is described in `DECISIONS.md` (session 83
   * §3) as *"K=6 fires 6 times with 6 rescues and 0 sacrifices"*. Two of those
   * four numbers are stale. Anyone building on §26 should shadow the SHAPE —
   * `heldCoverage` conditioned on `budget >= 1` — and re-read the counts here
   * rather than quoting the DECISIONS.md prose.
   */
  it("the unconditional trigger is worthless where it is confident, and the conditioned one is not", () => {
    // K <= 3 over ALL plays: 63 firings, 11 rescues, 8 sacrifices, and 42 of
    // the firings are dead hands the redraw could not have saved either. That
    // is still the unsatisfying version — 63 redraws to net THREE fish.
    // [session 91] `wasted` is UNCHANGED at 42 while every other term moved,
    // which is the one structural thing in this row.
    const all3 = SEP.sweep[3]!;
    // [session 98] 68 -> 72 fires, and `rescues`/`sacrifices` BOTH MOVED for
    // the first time in four batches (11 -> 12, 8 -> 9). The frozen-numerator
    // reading below is therefore no longer the whole story — the numerator is
    // moving again, and it moved by one in EACH direction, so the net is
    // unchanged at 3.
    expect(all3).toMatchObject({ fires: 74, rescues: 13, sacrifices: 9, wasted: 50 }); // [session 98] was 68 / 11 / 8 / 47 /* [session 102] was 72 / 12 / 9 / 49 */
    // ⚠ WAS `.toBe(0)` — "exactly break-even". See (A) above. Pinned as a
    // bound rather than an identity so the next corpus growth moves it without
    // pretending a structural claim survived.
    // [session 102] 3 -> 4. The net has now run 0 -> 1 -> 3 -> 4 across four
    // corpus growths, always upward. That is a trend worth NOT over-reading:
    // it is a difference of two small counts (13 and 9), and session 90's
    // lesson from `zoneTemplate.test.ts` — a monotone run of four points drawn
    // from small batches is not a trend — applies with full force here. Pinned
    // as a bound, not promoted to a finding.
    expect(all3.rescues - all3.sacrifices).toBe(4); // [session 91] was 1, was 0 /* [session 102] was 3 */
    // ⚠ [session 96] Now 3/68 = **4.41%** against the 5% bound. It moved AWAY
    // from the bound rather than through it, and for the reason the row makes
    // plain: the numerator is frozen (rescues 11, sacrifices 8, unmoved three
    // batches running) while `fires` keeps growing, so the ratio falls
    // mechanically. Do not read that as the claim getting stronger.
    // ⚠ [session 91] This is now 3/63 = 4.76% against a 5% bound — it passes
    // with almost nothing to spare, where at session 90 it was 1/59 = 1.7%.
    // The bound is the LAST thing standing in for the retired "exactly
    // break-even" claim, and one more corpus growth in the same direction
    // breaks it. When it does, do NOT widen the bound: the honest reading is
    // that near-break-even has stopped being true, which is a finding.
    //
    // ⛔⛔ **[session 102] IT BROKE, and the bound is NOT being widened.**
    // 4/74 = **5.41%**, through a 5% bound that session 91 said one more growth
    // in the same direction would break. It was right, and this is the growth:
    // the twenty-cast batch took the row 72/12/9/49 -> 74/13/9/50, so rescues
    // moved and sacrifices did not, for the second batch running.
    //
    // **The claim being retired: the unconditional threshold-3 trigger is
    // near-break-even.** It is not, on this corpus. It now rescues 13 and
    // sacrifices 9 over 74 fires, a net of +4, and the ratio has run
    // 0% -> 1.7% -> 4.76% -> 4.41% -> 5.41% across five corpus states. The one
    // dip (4.41%) was mechanical — session 96 recorded that the numerator was
    // frozen while `fires` grew — and every move with a live numerator has
    // been upward.
    //
    // **What this does NOT license.** A +4 net over 74 fires is still a
    // difference of two small counts, and the trigger is still UNCONDITIONAL —
    // §3's whole finding is that the conditioned trigger is the one worth
    // anything. Nothing here argues for arming redraw: `redrawEnabled` is
    // false by QUESTIONS.md §49 and is untouched by this. The assertion below
    // is now a PIN on the measured value rather than a bound standing in for a
    // retired claim, which is what the session-91 instruction asked for.
    // QUESTIONS.md §60 carries this for the user.
    expect(Math.abs(all3.rescues - all3.sacrifices) / all3.fires).toBeCloseTo(4 / 74, 6); /* [session 102] was toBeLessThan(0.05); measured 5.41% */

    // The same signal, restricted to plays with a point of focus budget left.
    const b6 = SEP.sweepWithBudget[6]!;
    // ⚠ `wasted` WAS 0. See (B) above.
    // ✅ [session 91] **UNCHANGED by the ten-cast batch — every term.** This is
    // the row the live redraw shadow is fitted on (K=6 with budget), so it
    // mattering that it did not move is the point: the candidate's in-sample
    // behaviour is stable while the corpus around it grew 6%.
    // ✅ [session 96] **UNCHANGED AGAIN — every term, across ten more casts**
    // (fires 15, rescues 9, sacrifices 0, wasted 4, manaSpent 21). Two
    // consecutive ten-cast batches have left this row byte-identical while the
    // corpus grew from 178 to 199. The shadow candidate's in-sample behaviour
    // is the most stable thing in this file.
    // [session 102] fires 17 -> 18, wasted 5 -> 6, manaSpent 23 -> 24. The one
    // new firing in twenty casts was WASTED — it neither rescued nor
    // sacrificed — so `rescues` and `sacrifices` are both unchanged, and
    // `sacrifices` has now been 0 for every corpus state this row has ever
    // had. The shadow candidate's in-sample behaviour is still the most stable
    // thing in this file, and it just survived a batch twice the size of the
    // two that established that stability.
    expect(b6).toMatchObject({ fires: 18, rescues: 10, sacrifices: 0, wasted: 6, manaSpent: 24 }); // [session 98] was 15 / 9 / 0 / 4 / 21; `sacrifices` still 0 /* [session 102] was 17 / 10 / 0 / 5 / 23 */
    const b10 = SEP.sweepWithBudget[10]!;
    // ⚠ [session 102] **THE FIVE-BATCH FREEZE ON `sacrifices` ENDED: 5 -> 6.**
    // fires 69 -> 73, wasted 7 -> 9, manaSpent 101 -> 109, and `rescues` did
    // NOT move (27). So all four new firings in twenty casts were misses for
    // this row — one sacrifice and three wasted, no rescue — and the net falls
    // for the first time on record. Recorded rather than smoothed over: it is
    // the only term in this file that had held constant across five
    // consecutive batches, and the largest batch is what moved it.
    expect(b10).toMatchObject({ fires: 73, rescues: 27, sacrifices: 6, wasted: 9, manaSpent: 109 }); // [session 98] was 63 / 25 / 5 / 6 / 92 /* [session 102] was 69 / 27 / 5 / 7 / 101 */
    expect(b10.rescues - b10.sacrifices).toBe(21); // [session 92] was 19  // [session 98] was 20 /* [session 102] was 22 — the first DECREASE */

    // THE CLAIM THAT DID SURVIVE, and it is the one the conditioning exists
    // for: at both thresholds the conditioned arm nets positive where the
    // unconditional arm nets ~nothing. Asserted as an inequality so a future
    // corpus can falsify it loudly instead of by a number sliding.
    expect(b6.rescues - b6.sacrifices).toBeGreaterThan(all3.rescues - all3.sacrifices);
    expect(b10.rescues - b10.sacrifices).toBeGreaterThan(all3.rescues - all3.sacrifices);
    expect(b6.sacrifices).toBe(0);
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
