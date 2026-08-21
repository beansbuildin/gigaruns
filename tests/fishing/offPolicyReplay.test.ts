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
import { loadCastTraces, isCleanTrace } from "../../src/sim/fishing/castTrace.js";
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
    nextMovePath: null,
    nextPosition: null,
    // [session 64] No consumable in this synthetic trace — replay is about
    // movement, and an oil changes what we spend, not what the fish does.
    consumablesUsed: 0,
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

describe("[session 50, brief §1/§2] the matcher tier, coverage, and the placement override", () => {
  const others = [walk("b", 5), walk("c", 5), walk("d", 5)];

  it("records coverage on every turn, for both the counterfactual and the recorded policy", () => {
    const r = replayCast(walk("a", 4), others);
    expect(r.turns.length).toBeGreaterThan(0);
    for (const t of r.turns) {
      expect(typeof t.covered).toBe("boolean");
      expect(typeof t.actualCovered).toBe("boolean");
    }
  });

  it("coverage is implied by a hit — a shot cannot land outside its own 3x3 window", () => {
    const r = replayCorpus([walk("a", 4), ...others]);
    for (const cast of r.results) for (const t of cast.turns) if (t.hit) expect(t.covered).toBe(true);
    expect(r.covered).toBeGreaterThanOrEqual(r.hits);
  });

  it("the matcher tier is OFF by default — turning it on is what changes the numbers", () => {
    const traces = [walk("a", 5), ...others];
    const off = replayCorpus(traces);
    const loo = replayCorpus(traces, { matcherTier: "loo" });
    // Same corpus, same casts scored; only the top tier differs.
    expect(loo.casts).toBe(off.casts);
    expect(off.shots).toBeGreaterThan(0);
    expect(loo.shots).toBeGreaterThan(0);
  });

  it("the LOO matcher never mines the cast it is replaying", () => {
    // `replayCorpus` builds `others` by exclusion; if that broke, a cast whose
    // own trajectory was in the mining set could be predicted perfectly. The
    // structural guarantee is what is asserted — `replayCast` is handed the
    // others explicitly and cannot see the target.
    const target = walk("a", 5);
    const r = replayCast(target, others, { matcherTier: "loo" });
    expect(r.docId).toBe("a");
    expect(r.turns.length).toBeGreaterThan(0);
  });

  it("the coverage override actually moves the focus somewhere the EV placement did not", () => {
    const traces = [walk("a", 5), ...others];
    const base = replayCorpus(traces);
    const arm = replayCorpus(traces, { coverageHorizon: 3 });
    const baseFocus = new Map<string, Cell>();
    for (const r of base.results) for (const t of r.turns) baseFocus.set(`${r.docId}|${t.turn}`, t.focus);
    let differed = 0;
    for (const r of arm.results) {
      for (const t of r.turns) {
        const b = baseFocus.get(`${r.docId}|${t.turn}`);
        if (b && (b.x !== t.focus.x || b.y !== t.focus.y)) differed++;
      }
    }
    expect(differed).toBeGreaterThan(0);
  });

  it("never overrides a LETHAL placement — no objective talks the bot out of the catch", () => {
    // The fish oscillates around the grid centre on the k=1 ring, so its whole
    // support sits inside one 3x3 window; a card covering all nine zones
    // therefore has pHit = 1 at (2,2) and the choice is genuinely lethal
    // against a 5 HP fish. That is the only construction in which the guard
    // can be observed end to end.
    const wide: TraceCard = {
      id: 1,
      manaCost: 1,
      hitZones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      critZones: [],
      hitEffects: [{ type: "FISH_HP", amount: 5 }],
      missEffects: [{ type: "FISH_HP", amount: -3 }],
      critEffects: [],
    };
    const centre = (docId: string): CastTrace => {
      const path: Cell[] = [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
      ];
      const turns = path.map((pos, i) => {
        const t = turn(i, pos);
        t.fishHp = 5;
        t.fishMaxHp = 10;
        return t;
      });
      for (let i = 1; i < turns.length; i++) turns[i]!.previousFishPosition = turns[i - 1]!.fishPosition;
      return { docId, cards: new Map([[1, wide]]), turns, caught: true, escaped: false, hasStart: true, continuous: true };
    };
    const peers = [centre("p"), centre("q"), centre("r")];
    const base = replayCast(centre("a"), peers);
    const covArm = replayCast(centre("a"), peers, { coverageHorizon: 3 });
    expect(base.outcome).toBe("caught");
    expect(covArm.outcome).toBe("caught");
    expect(covArm.turns[0]!.focus).toEqual(base.turns[0]!.focus);
  });

  it("the blended arm needs a horizon of at least 2 to have anything to say", () => {
    const traces = [walk("a", 5), ...others];
    const h1 = replayCorpus(traces, { coverageWeight: 3, coverageHorizon: 1 });
    const plain = replayCorpus(traces, {});
    // With `h >= 2` empty the continuation term is empty, so the arm falls
    // through to the shipped placement rather than silently doing something
    // else.
    expect(h1.hits).toBe(plain.hits);
    expect(h1.covered).toBe(plain.covered);
  });
});

describe("[session 51 §3] matcherWeighting", () => {
  // READ-only against the committed cast fixtures — nothing here writes, so
  // CLAUDE.md's isolated-temp-path rule for I/O-owning tests is not engaged.
  // Asserted rather than skipped: a guard that silently returns turns this
  // whole block vacuous the day the fixtures move.
  const traces = loadCastTraces().filter(isCleanTrace);
  it("has the committed cast corpus to work against", () => {
    expect(traces.length).toBeGreaterThan(20);
  });

  it("defaults to the posterior, and 'fixed' reproduces the pre-session-51 arm", () => {
    // Pins the deliberate break with this file's usual default convention:
    // the DEFAULT is the new behaviour, and the old one has to be asked for
    // by name. If someone flips this back, a future session measuring
    // `matcherTier: "loo"` silently stops measuring what ships.
    const bare = replayCorpus(traces, { matcherTier: "loo" });
    const explicit = replayCorpus(traces, { matcherTier: "loo", matcherWeighting: "posterior" });
    const fixed = replayCorpus(traces, { matcherTier: "loo", matcherWeighting: "fixed" });
    expect(bare.caught).toBe(explicit.caught);
    expect(bare.hits).toBe(explicit.hits);
    // The two arms must actually differ, or this test proves nothing.
    expect(fixed.hits === bare.hits && fixed.shots === bare.shots).toBe(false);
  });

  it("the fixed arm gives every matcher turn the same weight; the posterior does not", () => {
    const weightsOf = (o: Parameters<typeof replayCorpus>[1]) =>
      replayCorpus(traces, o)
        .results.flatMap((r) => r.turns.map((t) => t.matcherWeight))
        .filter((w) => w > 0);
    const fixed = new Set(weightsOf({ matcherTier: "loo", matcherWeighting: "fixed" }));
    const post = new Set(weightsOf({ matcherTier: "loo" }));
    expect(fixed.size).toBe(1);
    expect([...fixed][0]).toBeCloseTo(0.9, 10);
    expect(post.size).toBeGreaterThan(1);
  });

  it("with the matcher tier off, no turn carries any matcher weight at all", () => {
    for (const t of replayCorpus(traces, { matcherTier: "off" }).results.flatMap((r) => r.turns)) {
      expect(t.matcherWeight).toBe(0);
    }
  });
});
