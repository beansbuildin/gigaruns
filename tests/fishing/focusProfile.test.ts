/**
 * tests/fishing/focusProfile.test.ts — [session 70 §2a, GATE 1]
 *
 * Two things, and the first is the one that makes the second worth anything.
 *
 * **1. `observeTurn` is INERT.** It was added so the sim's focus-meter profile
 * could be compared with the corpus's, and a measurement hook that perturbs the
 * thing it measures is worse than no measurement. Session 68's oil shadow set
 * the standard here: byte-identity against a run without it, plus a companion
 * that proves the observer really ran, because byte-identity alone passes
 * gloriously on a hook that never fires.
 *
 * **2. The states it emits are the ones a corpus trace records** — one at the
 * start of each turn, plus the terminal state — because `focusProfileCheck.ts`
 * averages the two side by side and calls the result a comparison. If the sim
 * emitted only pre-play states while `castTrace.ts` includes the terminal one,
 * the profiles would differ by an artefact of the instrumentation and the gate
 * would be measuring its own bookkeeping. That is CLAUDE.md rule 10's trap in
 * yet another costume, so the shape is pinned rather than trusted.
 */

import { describe, expect, it } from "vitest";

import { simulateCast, makeMatcherFishPolicy, REDRAW_THRESHOLD, FOCUS_METER_MAX } from "../../src/sim/fishing/castSim.js";

const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;
const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, true);

describe("observeTurn is inert", () => {
  it("is byte-identical to a run without it, over many seeds", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const without = simulateCast({ policy, ...REAL_PARAMS, seed });
      const with_ = simulateCast({ policy, ...REAL_PARAMS, seed, observeTurn: () => {} });
      expect(JSON.stringify(with_)).toBe(JSON.stringify(without));
    }
  });

  it("really runs — the anti-vacuity companion, so byte-identity is not passing on a dead hook", () => {
    let calls = 0;
    const r = simulateCast({ policy, ...REAL_PARAMS, seed: 7, observeTurn: () => calls++ });
    expect(calls).toBeGreaterThan(0);
    // One state per turn taken, plus the terminal one.
    expect(calls).toBe(r.turns + 1);
  });

  it("hands out a fresh object, so an observer cannot reach back into the sim's state", () => {
    // A caller that mutated the state it was handed must not be able to change
    // the cast. `record()` builds a new object each call, which this pins.
    const seen: { turn: number; focusRemaining: number }[] = [];
    const mutating = simulateCast({
      policy,
      ...REAL_PARAMS,
      seed: 11,
      observeTurn: (s) => {
        seen.push({ turn: s.turn, focusRemaining: s.focusRemaining });
        s.focusRemaining = -999;
        s.mana = -999;
        s.fishHp = -999;
      },
    });
    const clean = simulateCast({ policy, ...REAL_PARAMS, seed: 11 });
    expect(JSON.stringify(mutating)).toBe(JSON.stringify(clean));
    expect(seen.length).toBeGreaterThan(1);
  });
});

describe("the emitted states are the ones a trace records", () => {
  it("starts at a full meter on turn 0, exactly like every corpus trace's first state", () => {
    // The corpus profile's turn-0 value is 3.00 in every recomputation ever
    // run. If the sim's first emitted state were POST-play the two columns
    // would be offset by one and the gate's Δ row would be meaningless.
    const states: { turn: number; focusRemaining: number }[] = [];
    simulateCast({ policy, ...REAL_PARAMS, seed: 3, observeTurn: (s) => states.push({ turn: s.turn, focusRemaining: s.focusRemaining }) });
    expect(states[0]).toEqual({ turn: 0, focusRemaining: FOCUS_METER_MAX });
  });

  it("emits consecutive turn indices with no gap and no repeat", () => {
    for (const seed of [2, 5, 13, 21, 34]) {
      const turns: number[] = [];
      simulateCast({ policy, ...REAL_PARAMS, seed, observeTurn: (s) => turns.push(s.turn) });
      expect(turns).toEqual(turns.map((_, i) => i));
    }
  });

  it("never reports a meter above the max or below zero", () => {
    for (let seed = 1; seed <= 40; seed++) {
      simulateCast({
        policy,
        ...REAL_PARAMS,
        seed,
        observeTurn: (s) => {
          expect(s.focusRemaining).toBeGreaterThanOrEqual(0);
          expect(s.focusRemaining).toBeLessThanOrEqual(FOCUS_METER_MAX);
        },
      });
    }
  });
});
