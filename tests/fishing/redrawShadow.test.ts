/**
 * tests/fishing/redrawShadow.test.ts — [session 90 §4] the redraw shadow as a
 * pure function: its three structural properties, and the one claim that
 * makes it a shadow of the RIGHT thing.
 *
 * `redrawShadowInert.test.ts` proves the live loop is unaffected. This file
 * proves the evaluator itself is what it says it is. Both are needed: an inert
 * evaluator that measures the wrong quantity is inert and useless.
 *
 * Reads committed fixtures only. Writes nothing, touches no `data/` or `logs/`
 * path, makes no network call.
 */
import { describe, expect, it } from "vitest";

import { loadCastTraces } from "../../src/sim/fishing/castTrace.js";
import { redrawCounterfactual } from "../../src/sim/fishing/redrawCounterfactual.js";
import {
  REDRAW_SHADOW_COVERAGE_K,
  REDRAW_SHADOW_MIN_BUDGET,
  evaluateRedrawShadow,
  snapshotRedrawDecision,
  type RedrawDecisionState,
} from "../../src/strategy/fishing/redrawShadow.js";
import type { FishingCardLike } from "../../src/strategy/fishing/cardChoice.js";

const card = (o: Partial<FishingCardLike> = {}): FishingCardLike => ({
  id: 1,
  manaCost: 1,
  hitZones: [5],
  critZones: [],
  hitEffects: [{ amount: 5 }],
  missEffects: [{ amount: 3 }],
  critEffects: [],
  ...o,
});

describe("property 2 — it CANNOT throw, because a throw would abort a live cast", () => {
  it("degrades a poisoned board to a record with an error and a shadow_threw sanity flag", () => {
    // A card whose zone array throws on access. Constructed as a state
    // directly rather than through `snapshotRedrawDecision`, because the
    // snapshot would touch it first — and it is the EVALUATOR whose
    // non-throwing guarantee the live loop depends on.
    const poison = {
      ...card(),
      get hitZones(): number[] {
        throw new Error("simulated board corruption");
      },
    } as unknown as FishingCardLike;
    const state = {
      turn: 2,
      budget: 2,
      focusCell: { x: 2, y: 2 },
      mana: 5,
      fishHp: 10,
      board: { hand: [poison], gridSize: 4 },
    } as RedrawDecisionState;

    let rec!: ReturnType<typeof evaluateRedrawShadow>;
    expect(() => {
      rec = evaluateRedrawShadow(state, false);
    }).not.toThrow();
    expect(rec.error).toBe("simulated board corruption");
    expect(rec.sanity).toContain("shadow_threw");
    // And it degrades to the SAFE verdict, not to a firing one.
    expect(rec.wouldRedraw).toBe(false);
  });
});

describe("property 1 — the snapshot is a frozen DEEP COPY, holding no live reference", () => {
  it("survives the caller mutating the hand it was built from", () => {
    const hand: FishingCardLike[] = [card({ hitZones: [5] })];
    const snap = snapshotRedrawDecision(
      { turn: 1, budget: 1, focusCell: { x: 2, y: 2 }, mana: 5, fishHp: 10 },
      { hand, gridSize: 4 },
    );
    const before = evaluateRedrawShadow(snap, false).heldCoverage;

    // Mutate every level the live path could plausibly mutate.
    hand.push(card({ id: 2, hitZones: [1, 2, 3, 4, 5, 6, 7, 8, 9] }));
    hand[0]!.hitZones = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    expect(evaluateRedrawShadow(snap, false).heldCoverage).toBe(before);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.board)).toBe(true);
    expect(Object.isFrozen(snap.board.hand)).toBe(true);
    expect(Object.isFrozen(snap.board.hand[0])).toBe(true);
    expect(Object.isFrozen(snap.board.hand[0]!.hitZones)).toBe(true);
    expect(Object.isFrozen(snap.focusCell)).toBe(true);
    // The copy really is a copy: same values, different identity.
    expect(snap.board.hand[0]).not.toBe(hand[0]);
    expect(snap.board.hand).toHaveLength(1);
  });
});

describe("it shadows the SAME signal the corpus analysis validated", () => {
  /**
   * **The claim this whole instrument rests on.** The candidate was fitted on
   * `separability`'s `heldCoverage`. If the live shadow computed a
   * near-miss version of that quantity, every out-of-sample number it produced
   * would be about a different rule and no test would notice.
   *
   * `coverageOfCards` is the one shared implementation (`redrawCounterfactual.ts`),
   * and this reproduces real corpus plays through the LIVE path — snapshot and
   * evaluator — to show the two agree exactly rather than approximately.
   */
  it("reproduces the corpus's own heldCoverage on every play it can reconstruct", () => {
    const traces = loadCastTraces();
    const byDoc = new Map(traces.map((t) => [t.docId, t]));
    const plays = redrawCounterfactual(traces).perPlay;
    let checked = 0;
    for (const p of plays) {
      const t = byDoc.get(p.docId)!;
      const prev = t.turns[p.turn - 1]!;
      const hand = p.held.map((id) => t.cards.get(id)).filter(Boolean) as unknown as FishingCardLike[];
      if (hand.length !== p.held.length) continue;
      const rec = evaluateRedrawShadow(
        snapshotRedrawDecision(
          { turn: p.turn, budget: p.budget, focusCell: prev.focusPoint, mana: 5, fishHp: 10 },
          { hand, gridSize: t.turns[p.turn]!.gridSize },
        ),
        false,
      );
      expect(rec.error).toBeUndefined();
      expect(rec.heldCoverage).toBe(p.heldCoverage);
      expect(rec.reachable).toBe(p.reachable);
      checked++;
    }
    // Anti-vacuity: the loop must actually have checked the corpus, not
    // `continue`d past all of it.
    expect(checked).toBeGreaterThan(400);
  });

  it("its firing verdict matches the sweep row the candidate was published from", () => {
    // The K=6-with-budget arm, recomputed through the live evaluator on the
    // same plays. Pinned as an IDENTITY against the offline sweep rather than
    // as a count, so the corpus growing does not make it stale — and so a
    // divergence between the two implementations fails loudly.
    const traces = loadCastTraces();
    const byDoc = new Map(traces.map((t) => [t.docId, t]));
    const plays = redrawCounterfactual(traces).perPlay;
    let offline = 0;
    let shadow = 0;
    for (const p of plays) {
      const t = byDoc.get(p.docId)!;
      const prev = t.turns[p.turn - 1]!;
      const hand = p.held.map((id) => t.cards.get(id)).filter(Boolean) as unknown as FishingCardLike[];
      if (hand.length !== p.held.length) continue;
      if (p.heldCoverage <= REDRAW_SHADOW_COVERAGE_K && p.budget >= REDRAW_SHADOW_MIN_BUDGET) offline++;
      const rec = evaluateRedrawShadow(
        snapshotRedrawDecision(
          { turn: p.turn, budget: p.budget, focusCell: prev.focusPoint, mana: 5, fishHp: 10 },
          { hand, gridSize: t.turns[p.turn]!.gridSize },
        ),
        false,
      );
      if (rec.wouldRedraw) shadow++;
    }
    expect(shadow).toBe(offline);
    expect(shadow).toBeGreaterThan(0);
  });
});

describe("the raw signal is recorded, so any other K is reconstructable offline", () => {
  it("records heldCoverage and the two clauses separately, not just the verdict", () => {
    // This is why the shadow pins ONE K rather than sweeping: the sweep is
    // recoverable from the rows for free, exactly as `oilShadow.ts` argued
    // when it replaced its certainty arm instead of adding a second one.
    const snap = snapshotRedrawDecision(
      { turn: 1, budget: 0, focusCell: { x: 2, y: 2 }, mana: 5, fishHp: 10 },
      { hand: [card({ hitZones: [5] })], gridSize: 4 },
    );
    const rec = evaluateRedrawShadow(snap, false);
    // Budget 0: the coverage clause holds, the condition does not, and the row
    // says WHICH refused rather than only that it refused.
    expect(rec.coverageBelowK).toBe(true);
    expect(rec.conditionMet).toBe(false);
    expect(rec.wouldRedraw).toBe(false);
    expect(rec.heldCoverage).toBe(1); // budget 0 reaches only the focus cell, one zone
    // Any K is answerable from the recorded number alone.
    expect(rec.heldCoverage <= 0).toBe(false);
    expect(rec.heldCoverage <= 10).toBe(true);
  });

  it("flags a live-enabled redraw as a sanity violation — the one failure that would end the shadow", () => {
    const snap = snapshotRedrawDecision(
      { turn: 1, budget: 2, focusCell: { x: 2, y: 2 }, mana: 5, fishHp: 10 },
      { hand: [card()], gridSize: 4 },
    );
    expect(evaluateRedrawShadow(snap, true).sanity).toContain(
      "live_redraw_is_ENABLED_this_is_no_longer_a_shadow",
    );
    expect(evaluateRedrawShadow(snap, false).sanity).toEqual([]);
  });
});
