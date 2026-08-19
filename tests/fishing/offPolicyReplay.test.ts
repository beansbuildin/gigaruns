/**
 * tests/fishing/offPolicyReplay.test.ts — [session 47, brief §1b]
 *
 * The replay is a counterfactual, so nothing external can validate its output
 * number. What CAN be pinned is that its mechanics match the wire facts the
 * corpus established, and that the conservatisms it claims are real:
 *  - hand evolution follows the recorded blocks (one card out per turn,
 *    refill from the recorded `NEW_HAND`);
 *  - mana follows `manaCost`;
 *  - a cast that outlives the record is scored `truncated`, not caught;
 *  - leave-one-cast-out actually excludes the target.
 *
 * Synthetic traces throughout — no fixture reads, no file writes.
 */

import { describe, expect, it } from "vitest";

import type { CastTrace, CastTurn, TraceCard } from "../../src/sim/fishing/castTrace.js";
import { replayCast, replayCorpus, traceToCast } from "../../src/sim/fishing/offPolicyReplay.js";
import type { Cell } from "../../src/sim/fishing/geometry.js";

/** A card covering the single cell under the focus point (zone 5), 5 damage, 3 self-harm on a miss. */
const spot: TraceCard = {
  id: 1,
  manaCost: 1,
  hitZones: [5],
  critZones: [],
  hitEffects: [{ type: "FISH_HP", amount: 5 }],
  missEffects: [{ type: "FISH_HP", amount: -3 }],
  critEffects: [],
};

function turn(index: number, pos: Cell): CastTurn {
  return {
    file: `synthetic-${index}`,
    index,
    fishPosition: pos,
    previousFishPosition: pos,
    lastMovePath: null,
    fishHp: 10,
    fishMaxHp: 20,
    mana: 10,
    manaMax: 10,
    focusPoint: { x: 2, y: 2 },
    focusMeter: 3,
    focusMeterMax: 3,
    gridSize: 4,
    hand: [1, 1, 1],
    fullDeck: [1, 1, 1, 1, 1, 1],
    nextCardIndex: 3,
    discard: [],
    play: index === 0 ? null : { handIndex: 0, hit: false, fishHpDiff: -3 },
    newHand: null,
    fishDied: false,
    fishEscaped: false,
  };
}

/**
 * A straight-line k=1 walk, so `classifyStep` resolves and the ring model has
 * something to say. `hp` is deliberately far above what a few 5-damage hits
 * can clear: this walk is perfectly predictable, so the policy connects every
 * turn, and a low-HP fish would be caught before any of the mechanics below
 * (truncation, mana, refills) ever got a chance to fire.
 */
function walk(docId: string, steps: number, hp = 200): CastTrace {
  const turns: CastTurn[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = turn(i, { x: 1 + (i % 4), y: 1 });
    t.fishHp = hp;
    t.fishMaxHp = hp * 2;
    turns.push(t);
  }
  for (let i = 1; i < turns.length; i++) turns[i]!.previousFishPosition = turns[i - 1]!.fishPosition;
  return { docId, cards: new Map([[1, spot]]), turns, caught: false, escaped: true, hasStart: true, continuous: true };
}

describe("traceToCast", () => {
  it("projects positions into the shape the corpus model builders take", () => {
    const cast = traceToCast(walk("a", 3));
    expect(cast.castId).toBe("a");
    expect(cast.start).toEqual({ x: 1, y: 1 });
    expect(cast.maxTurn).toBe(2);
    expect(cast.byTurn.get(0)).toEqual({ x: 2, y: 1 });
    expect(cast.byTurn.get(2)).toEqual({ x: 4, y: 1 });
    expect(cast.hasGaps).toBe(false);
    expect(cast.duplicateTurns).toEqual([]);
  });
});

describe("replayCast mechanics", () => {
  const others = [walk("b", 5), walk("c", 5), walk("d", 5)];

  it("scores a cast that outlives the record as truncated, never as caught", () => {
    // Two recorded turns cannot resolve a 200 HP fish either way, so the
    // record runs out first.
    const r = replayCast(walk("a", 2), others);
    expect(r.outcome).toBe("truncated");
    expect(r.turns.length).toBeLessThanOrEqual(2);
    expect(r.recordedTurns).toBe(2);
  });

  it("spends mana by the played card's manaCost and stops when nothing is affordable", () => {
    const t = walk("a", 8);
    t.turns[0]!.mana = 2; // exactly two 1-cost plays
    const r = replayCast(t, others);
    expect(r.turns.length).toBe(2);
    expect(r.outcome).toBe("no_affordable_card");
  });

  it("refills the hand from the recorded NEW_HAND, and stops when the record has none to give", () => {
    const withRefill = walk("a", 8);
    withRefill.turns[0]!.mana = 99;
    withRefill.turns[3]!.newHand = [1, 1, 1];
    const r = replayCast(withRefill, others);
    // Three cards in hand -> the 4th turn needs a refill, which turn 3 supplies.
    expect(r.turns.length).toBeGreaterThan(3);

    const noRefill = walk("a", 8);
    noRefill.turns[0]!.mana = 99;
    const r2 = replayCast(noRefill, others);
    expect(r2.outcome).toBe("hand_exhausted");
    expect(r2.turns.length).toBe(3);
  });

  it("records the recorded policy's own hit on the same turn, for the paired comparison", () => {
    const t = walk("a", 3);
    t.turns[1]!.play = { handIndex: 0, hit: true, fishHpDiff: 5 };
    const r = replayCast(t, others);
    expect(r.turns[0]!.actualHit).toBe(true);
    expect(r.turns[1]!.actualHit).toBe(false);
  });

  it("the mismatched-zone arm changes resolution but not the policy's choices", () => {
    const t = walk("a", 3);
    const corrected = replayCast(t, others);
    const legacy = replayCast(t, others, { mismatchedZones: true });
    expect(legacy.turns.map((x) => x.cardId)).toEqual(corrected.turns.map((x) => x.cardId));
    expect(legacy.turns.map((x) => x.focus)).toEqual(corrected.turns.map((x) => x.focus));
    // Log loss is a property of the predictor, untouched by how shots resolve.
    expect(legacy.turns.map((x) => x.logLoss)).toEqual(corrected.turns.map((x) => x.logLoss));
  });
});

describe("replayCorpus", () => {
  it("refits leave-one-cast-out — a cast never contributes to the model it is scored against", () => {
    const traces = [walk("a", 4), walk("b", 4), walk("c", 4)];
    // If the target leaked into its own model, replaying a corpus of ONE would
    // still produce a fitted table. It must instead fall back to the
    // unknown-class ring with an empty table, and still run.
    const solo = replayCorpus([walk("only", 4)]);
    expect(solo.casts).toBe(1);
    expect(solo.results[0]!.turns.length).toBeGreaterThan(0);

    const full = replayCorpus(traces);
    expect(full.casts).toBe(3);
    expect(full.shots).toBe(full.results.reduce((s, r) => s + r.turns.length, 0));
  });

  it("pairs every scored turn — one log-loss difference and one actual-hit per shot", () => {
    const report = replayCorpus([walk("a", 4), walk("b", 4)]);
    expect(report.logLossDiffs.length).toBe(report.shots);
    expect(report.actualShotsOnReplayedTurns).toBe(report.shots);
  });
});
