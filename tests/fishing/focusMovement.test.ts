/**
 * tests/fishing/focusMovement.test.ts — [session 86, brief §1 / GATE 1]
 *
 * Pins the fact that `damageEconomy.ts`'s `SIM blind` arm never moves its
 * focus point — not once in 1,963 turns, at either focus-reserve weight — and
 * pins the BARE arm's 752 moves / 1047 points in the same file, because a
 * zero from an instrument that has never been shown to read non-zero is not
 * evidence of anything.
 *
 * ## Why the control is not optional
 *
 * The claim being pinned is an absence. Every way this test could be wrong
 * produces the same zero: a probe wired to the wrong field, a policy wrapper
 * whose `act` is never called, an arm that plays no cards at all. The bare
 * arm runs through the identical code path with one option changed
 * (`matcherPool: []` removed) and reads 752/1047, so a regression that
 * silences the probe fails the control rather than passing the pin.
 *
 * ## The two probes agree, and that is asserted rather than assumed
 *
 * `turnsThatMoved` (from the meter, via `observeTurn`) and `playsThatAimed`
 * (from the decision, via the wrapped policy) are independent readings of the
 * same event. They agree on all four arms here. Asserted so that if an oil
 * arm or a cost-model change ever separates them, this file says so instead of
 * quietly reporting the friendlier of the two.
 *
 * Pure sim. No `data/`, no `logs/`, no fixtures, no network — the blind and
 * bare arms need none of them, which is exactly why they are the arms a fresh
 * clone can run.
 */
import { describe, expect, it } from "vitest";

import { measureFocusMovement, type FocusMovementProbe } from "../../src/sim/fishing/focusMovement.js";
import { CORPUS_DECK } from "../../src/sim/fishing/rodDeck.js";
import type { Cast } from "../../src/sim/fishing/transitionCorpus.js";
import { buildStepClassTable } from "../../src/strategy/fishing/stepClass.js";

/** The two arms exactly as `scripts/damageEconomy.ts` §3 writes them. */
const blindArm = () => ({ deckIds: [...CORPUS_DECK], matcherPool: [] });
const bareArm = () => ({ deckIds: [...CORPUS_DECK] });

const blind0 = measureFocusMovement("BLIND (matcherPool: [])", blindArm(), 0);
const blind3 = measureFocusMovement("BLIND (matcherPool: [])", blindArm(), 3);
const bare0 = measureFocusMovement("BARE  (default pool)", bareArm(), 0);
const bare3 = measureFocusMovement("BARE  (default pool)", bareArm(), 3);

const ALL: FocusMovementProbe[] = [blind0, blind3, bare0, bare3];

describe("the blind arm never aims — GATE 1", () => {
  it("moves focus on 0 of 1963 turns and spends 0 points, at BOTH weights", () => {
    for (const p of [blind0, blind3]) {
      expect(p.turns).toBe(1963);
      expect(p.turnsThatMoved).toBe(0);
      expect(p.focusSpent).toBe(0);
    }
  });

  it("fires all 763 of its plays from the opening cell (2,2), at BOTH weights", () => {
    for (const p of [blind0, blind3]) {
      expect(p.plays).toBe(763);
      expect(p.playsThatAimed).toBe(0);
      // ONE cell in 400 casts. `defaultStartFocus(4)` is (2,2) — the arm sits
      // where the cast opens and never leaves.
      expect(p.focusCells).toEqual(["2,2"]);
    }
  });

  it("is byte-identical at w=0 and w=3 — the invariance session 85 asked about", () => {
    // The whole probe, not a selected field: a term that prices focus movement
    // has nothing to price on a policy that never moves, so NOTHING about the
    // arm may differ between the weights. This is why the invariance is a
    // tautology and not a wiring bug.
    expect({ ...blind3, weight: 0 }).toEqual(blind0);
  });
});

describe("the bare arm as the control — the probe can see movement", () => {
  it("moves focus on 752 of 1823 turns for 1047 points at w=0", () => {
    expect(bare0.turns).toBe(1823);
    expect(bare0.turnsThatMoved).toBe(752);
    expect(bare0.focusSpent).toBe(1047);
    expect(bare0.plays).toBe(1328);
  });

  it("moves focus on 713 turns for 913 points at w=3 — the weight BINDS here", () => {
    expect(bare3.turns).toBe(1669);
    expect(bare3.turnsThatMoved).toBe(713);
    expect(bare3.focusSpent).toBe(913);
    expect(bare3.plays).toBe(1284);
    // The weight is a reserve term: raising it should hold focus back, and it
    // does — fewer moves, fewer points, on the same seeds.
    expect(bare3.focusSpent).toBeLessThan(bare0.focusSpent);
  });

  it("uses 15 of the grid's 16 cells at both weights, against the blind arm's 1", () => {
    expect(bare0.focusCells.length).toBe(15);
    expect(bare3.focusCells.length).toBe(15);
  });
});

describe("the two probes are independent readings of the same event", () => {
  it("meter moves equal aimed plays on every arm", () => {
    for (const p of ALL) expect(p.playsThatAimed).toBe(p.turnsThatMoved);
  });

  it("no arm restores focus — none of them supply oils", () => {
    for (const p of ALL) expect(p.turnsThatRestored).toBe(0);
  });

  it("states are turns plus one terminal state per cast — the brief's denominator", () => {
    // The session-86 brief reports these arms' turn counts as 2363 / 2223 /
    // 2069. Those are STATE counts: `observeTurn` emits one per turn taken
    // plus the terminal state. Pinned so the offset is a documented identity
    // rather than a discrepancy someone rediscovers.
    for (const p of ALL) expect(p.states).toBe(p.turns + p.casts);
    expect(blind0.states).toBe(2363);
    expect(bare0.states).toBe(2223);
    expect(bare3.states).toBe(2069);
  });
});

describe("the condition is UNIFORM, not BLIND — the boundary that stops the overclaim", () => {
  /**
   * A synthetic corpus, deliberately not the real one: a committed test may not
   * read `data/fish-patterns.jsonl` (gitignored, absent from a fresh clone).
   * Every cast walks +x one cell per turn on the 4x4 grid, so the table has a
   * single step class with a single outcome — as far from uniform as a
   * distribution gets, which is the whole point of the arm.
   */
  function oneDirectionTable() {
    const casts: Cast[] = [];
    for (let c = 0; c < 20; c++) {
      const byTurn = new Map<number, { x: number; y: number }>();
      const y = (c % 4) + 1;
      let x = 1;
      for (let t = 0; t < 3; t++) {
        x = (x % 4) + 1;
        byTurn.set(t, { x, y });
      }
      casts.push({ castId: `s${c}`, gridSize: 4, start: { x: 1, y }, byTurn, maxTurn: 2, duplicateTurns: [], hasGaps: false });
    }
    return buildStepClassTable(casts);
  }

  it("a blind matcher WITH a ring model aims on a third of its turns", () => {
    // `scripts/focusReserveAblation.ts`'s arm A is exactly this shape, so this
    // is the assertion that its session-45 sweep is not vacuous. `matcherPool:
    // []` is necessary for the no-aim behaviour and NOT sufficient — what
    // suppresses aiming is having no distribution at all.
    const table = oneDirectionTable();
    for (const w of [0, 3]) {
      const p = measureFocusMovement("blind + ringModel", { deckIds: [...CORPUS_DECK], matcherPool: [], ringModel: { table } }, w);
      expect(p.turnsThatMoved).toBeGreaterThan(0.25 * p.turns);
      expect(p.focusCells.length).toBeGreaterThan(1);
      expect(p.playsThatAimed).toBe(p.turnsThatMoved);
    }
  });
});
