/**
 * tests/fishing/redrawTrigger.test.ts — [session 72 §2] the two pins.
 *
 * **The gate this file exists for.** The session-72 brief: "a threshold that
 * redraws every turn and one that never redraws must both fail a test, the way
 * session 67 pinned the oil gate. A recalibrated number without both pins does
 * not meet this gate, because the failure mode on record is exactly the
 * always-fire degeneracy."
 *
 * **The failure on record, so the pins are not abstract.** `cardChoice.ts` §5:
 * the one prior calibration of `REDRAW_THRESHOLD` fired almost every turn and
 * flipped the loss mix from 89% `escaped_meter` to 78% `escaped_mana` at a
 * mean of 1.29 turns per cast. Nothing caught it before it was played. These
 * tests are what "caught before it is played" looks like.
 *
 * Two levels, because a degeneracy can hide at either:
 *
 *   1. THE PREDICATE. `shouldRedrawOnConnect` must actually fire at
 *      `ALWAYS_REDRAW_CONNECT_THRESHOLD` and never at
 *      `NEVER_REDRAW_CONNECT_THRESHOLD`, for every reachable `pConnect`.
 *      A pin on the predicate alone would pass a policy that ignored it.
 *   2. THE OUTCOME. A cast simulated under the always-threshold must show the
 *      recorded failure — mana exhaustion, ~1 turn — and one under the
 *      never-threshold must not. This is what makes the pin load-bearing
 *      rather than a restatement of the inequality.
 *
 * Pure: `castSim` takes a seed and a deck, touches no data path, writes
 * nothing (CLAUDE.md's tests-never-write-a-real-data-path rule).
 */

import { describe, expect, it } from "vitest";
import {
  ALWAYS_REDRAW_CONNECT_THRESHOLD,
  NEVER_REDRAW_CONNECT_THRESHOLD,
  shouldRedrawOnConnect,
  type CardFocusChoice,
} from "../../src/strategy/fishing/cardChoice.js";
import { makeConnectRedrawFishPolicy, simulateCast } from "../../src/sim/fishing/castSim.js";
import { REAL_DECK } from "../../src/sim/fishing/rodDeck.js";

/** A choice carrying a given connect probability; nothing else is read by the predicate. */
function choiceWithPConnect(p: number): CardFocusChoice {
  return {
    card: { id: 1, manaCost: 1, hitZones: [], critZones: [], hitEffects: [], missEffects: [], critEffects: [] },
    handIndex: 0,
    focus: { x: 0, y: 0 },
    ev: 0,
    evPerMana: 0,
    score: 0,
    pHit: p,
    pCrit: 0,
    lethal: false,
  };
}

/** Every reachable connect probability, ends included — 0 and 1 are the ones a bound can slip past. */
const P_GRID = [0, 0.01, 0.1, 0.25, 0.3428, 0.5, 0.75, 0.99, 1];

const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

describe("the redraw trigger's two degeneracies are pinned at the PREDICATE", () => {
  it("NEVER: a threshold of 0 cannot fire, at any connect probability", () => {
    for (const p of P_GRID) {
      expect(
        shouldRedrawOnConnect(choiceWithPConnect(p), 3, 10, NEVER_REDRAW_CONNECT_THRESHOLD),
        `pConnect ${p} fired at the never-threshold`,
      ).toBe(false);
    }
    // The empty-hand case takes a different branch (`best` is null, pConnect
    // 0), and 0 < 0 is false — so it must not fire either. A `<=` in the
    // predicate would pass every test above and fail exactly here.
    expect(shouldRedrawOnConnect(null, 3, 10, NEVER_REDRAW_CONNECT_THRESHOLD)).toBe(false);
  });

  it("ALWAYS: a threshold of 2 fires at every connect probability, mana permitting", () => {
    for (const p of P_GRID) {
      expect(
        shouldRedrawOnConnect(choiceWithPConnect(p), 3, 10, ALWAYS_REDRAW_CONNECT_THRESHOLD),
        `pConnect ${p} did not fire at the always-threshold`,
      ).toBe(true);
    }
  });

  it("the mana guard outranks BOTH — a redraw it cannot afford is never taken", () => {
    // mana == handSize is not enough: the cast would spend its last mana on a
    // hand it then cannot play. `> redrawCost`, not `>=`.
    expect(shouldRedrawOnConnect(choiceWithPConnect(0), 3, 3, ALWAYS_REDRAW_CONNECT_THRESHOLD)).toBe(false);
    expect(shouldRedrawOnConnect(choiceWithPConnect(0), 3, 4, ALWAYS_REDRAW_CONNECT_THRESHOLD)).toBe(true);
  });

  it("a derived threshold sits strictly between the two degeneracies", () => {
    // Not a tautology about the constants: it is the property that makes them
    // useful as bounds. A "derived" number that landed on or outside either
    // end would be a degeneracy wearing a derivation.
    const derived = 0.3428; // scripts/redrawTriggerCalibration.ts §3, today's era
    expect(derived).toBeGreaterThan(NEVER_REDRAW_CONNECT_THRESHOLD);
    expect(derived).toBeLessThan(ALWAYS_REDRAW_CONNECT_THRESHOLD);
    // and it must actually discriminate — fire below, hold above
    expect(shouldRedrawOnConnect(choiceWithPConnect(derived - 0.05), 3, 10, derived)).toBe(true);
    expect(shouldRedrawOnConnect(choiceWithPConnect(derived + 0.05), 3, 10, derived)).toBe(false);
  });
});

describe("the two degeneracies are pinned at the OUTCOME, in the simulator", () => {
  const run = (threshold: number) => {
    const runs = 300;
    let escapedMana = 0;
    let turns = 0;
    let redrawMana = 0;
    for (let i = 0; i < runs; i++) {
      const r = simulateCast({
        ...REAL_PARAMS,
        deckIds: [...REAL_DECK],
        policy: makeConnectRedrawFishPolicy(threshold),
        seed: 1 + i,
      });
      if (r.outcome === "escaped_mana") escapedMana++;
      turns += r.turns;
      redrawMana += r.redrawMana;
    }
    return { escapedMana: escapedMana / runs, turnsPerCast: turns / runs, redrawMana: redrawMana / runs };
  };

  it("ALWAYS reproduces the recorded failure: mana exhaustion at ~1 turn per cast", () => {
    const a = run(ALWAYS_REDRAW_CONNECT_THRESHOLD);
    // `cardChoice.ts` §5's recorded disaster was 78% escaped_mana at 1.29
    // turns/cast. The always-threshold is strictly more aggressive than the
    // threshold that produced those, so it must be at least as bad — if this
    // assertion ever relaxes, the harness has stopped exercising the failure
    // and every other pin here is decorative.
    expect(a.escapedMana).toBeGreaterThan(0.78);
    expect(a.turnsPerCast).toBeLessThan(1.29);
    expect(a.redrawMana).toBeGreaterThan(0);
  });

  it("NEVER spends no mana on redraws at all, and does not exhaust mana", () => {
    const n = run(NEVER_REDRAW_CONNECT_THRESHOLD);
    expect(n.redrawMana).toBe(0);
    // The shipped arm's own loss mix: meter-out dominates, mana exhaustion is
    // the minority. The point of the pin is the CONTRAST with the row above.
    expect(n.escapedMana).toBeLessThan(0.5);
    expect(n.turnsPerCast).toBeGreaterThan(3);
  });

  it("the two arms are separated by the thing under test and nothing else", () => {
    // Same deck, same seeds, same board, same policy factory — only the
    // threshold differs. Without this, the contrast above could be any two
    // unrelated configurations.
    const a = run(ALWAYS_REDRAW_CONNECT_THRESHOLD);
    const n = run(NEVER_REDRAW_CONNECT_THRESHOLD);
    expect(a.escapedMana).toBeGreaterThan(n.escapedMana);
    expect(a.turnsPerCast).toBeLessThan(n.turnsPerCast);
  });
});
