/**
 * tests/fishing/oilDoubleLethal.test.ts — [session 89 §6] the double-lethal
 * band trigger, pinned as a pure function.
 *
 * ## Status: SHIPPED LIVE [session 90 §1] — and the sweep STILL says it is a bad trade
 *
 * **Both halves are true at once and neither cancels the other.**
 * `scripts/liveFishing.ts` calls `doubleLethalTriggers` as of 2026-08-24, on
 * the account owner's explicit override (`QUESTIONS.md` §30). And
 * `handoff/OIL-DOUBLE-LETHAL.md`'s recommendation is unchanged and unretracted:
 * the trigger works, its confidence cutoff is non-degenerate, and it costs
 * **140.9 oils per extra fish** against a bar of ~12. The user is buying
 * certainty in the 3-4 `fishHp` band, which the sweep never priced.
 *
 * **Never describe this trigger as sim-recommended.** These assertions exist
 * so the derivation stays reproducible and so `doubleLethalTriggers` cannot
 * silently stop being what the memo scored — which matters MORE now that it
 * ships, not less.
 *
 * ## The load-bearing assertion is that TODAY'S CASE IS UNCHANGED
 *
 * A new trigger that quietly alters the shipped one is the failure that would
 * matter, because `onDemandTriggers` IS live. So the first block below pins
 * that `doubleLethalTriggers` agrees with `onDemandTriggers` everywhere the
 * band does not apply, rather than only checking the new branch fires.
 */
import { describe, expect, it } from "vitest";

import {
  ALWAYS_FIRES_THRESHOLD,
  NEVER_FIRES_THRESHOLD,
  PAYLOAD_OIL_EFFECTS,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  bestKillProbability,
  doubleLethal,
  doubleLethalTriggers,
  onDemandTriggers,
} from "../../src/strategy/fishing/oilTiming.js";
import { board, card, distAt, oilState } from "../helpers/oilDecisionState.js";

const E = PAYLOAD_OIL_EFFECTS; // fishDamage 2, so the band is fishHp 3..4
const FISH = { x: 2, y: 2 };

/** A board whose only affordable card cannot possibly kill: hit amount below `fishHp`. */
const cannotKill = (hp: number) =>
  board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: hp - 1 }] })], dist: distAt(FISH) });

/** A board whose affordable card kills with certainty from the marker's own cell. */
const certainKill = (hp: number) =>
  board({ hand: [card({ hitZones: [5], critZones: [], hitEffects: [{ amount: hp + 5 }] })], dist: distAt(FISH) });

describe("today's shipped case is UNCHANGED — the guard that matters", () => {
  const cases: [string, number, number][] = [
    // label, fishHp, relaxingOilHeld
    ["single-lethal, one oil", 2, 1],
    ["single-lethal, two oils", 2, 2],
    ["single-lethal at exactly fishDamage", E.fishDamage, 2],
    ["above the band", 5, 2],
    ["far above the band", 18, 2],
    ["in band but only one oil held", 3, 1],
    ["in band, no oils held", 4, 0],
  ];
  for (const [label, fishHp, relaxingOilHeld] of cases) {
    it(`${label} — identical to onDemandTriggers`, () => {
      const s = oilState({ fishHp, relaxingOilHeld, board: cannotKill(fishHp), focusRemaining: 2 });
      expect(doubleLethalTriggers(s, E)).toEqual(onDemandTriggers(s, E));
    });
  }

  it("never returns two relaxings when one would already be lethal", () => {
    // The session-68 hazard: a lethal first consume ends the cast and the
    // second is rejected against a finished one. The band's lower edge is
    // strict, and this is the assertion that keeps it strict.
    for (const fishHp of [1, 2]) {
      const s = oilState({ fishHp, relaxingOilHeld: 2, board: cannotKill(Math.max(fishHp, 2)) });
      const d = doubleLethalTriggers(s, E);
      expect(d.filter((k) => k === "relaxing")).toHaveLength(1);
    }
  });
});

describe("the new branch — the 3-4 band at the payload's +2", () => {
  it("fires twice at fishHp 3 and 4 when the bot cannot guarantee the kill", () => {
    for (const fishHp of [3, 4]) {
      const s = oilState({ fishHp, relaxingOilHeld: 2, board: cannotKill(fishHp), focusRemaining: 2 });
      expect(bestKillProbability(s)).toBe(0);
      expect(doubleLethalTriggers(s, E).filter((k) => k === "relaxing")).toHaveLength(2);
    }
  });

  it("two oils really are enough in the band, and one really is not — the arithmetic the rule rests on", () => {
    for (const fishHp of [3, 4]) {
      expect(fishHp - E.fishDamage).toBeGreaterThan(0); // one oil leaves it alive
      expect(fishHp - 2 * E.fishDamage).toBeLessThanOrEqual(0); // two finish it
    }
  });

  it("withholds both when the bot's own best card already guarantees the kill", () => {
    for (const fishHp of [3, 4]) {
      const s = oilState({ fishHp, relaxingOilHeld: 2, board: certainKill(fishHp), focusRemaining: 0, focusCell: FISH });
      expect(bestKillProbability(s)).toBe(1);
      expect(doubleLethalTriggers(s, E)).toEqual(onDemandTriggers(s, E));
    }
  });

  it("tracks fishDamage rather than the literal 3-4, so a different oil moves the band", () => {
    const strong = { focusRestore: 2, fishDamage: 4 }; // band becomes 5..8
    const s = (hp: number) => oilState({ fishHp: hp, relaxingOilHeld: 2, board: cannotKill(hp), focusRemaining: 2 });
    expect(doubleLethalTriggers(s(3), strong)).toEqual(["relaxing"]); // now single-lethal
    expect(doubleLethalTriggers(s(6), strong).filter((k) => k === "relaxing")).toHaveLength(2);
    expect(doubleLethalTriggers(s(9), strong).filter((k) => k === "relaxing")).toHaveLength(0);
  });

  it("keeps the focus trigger alongside, and puts the relaxings first", () => {
    // Order is not cosmetic: `liveFishing.ts` sends these in sequence, and a
    // focus consume between the two relaxings would be sent against a state
    // the second then acts on.
    const s = oilState({ fishHp: 3, relaxingOilHeld: 2, focusOilHeld: 1, focusRemaining: 0, board: cannotKill(3) });
    expect(doubleLethalTriggers(s, E)).toEqual(["relaxing", "relaxing", "focus"]);
  });
});

describe("the confidence cutoff is a CHOICE between two behaviours, not an asserted number", () => {
  const inBand = () => oilState({ fishHp: 3, relaxingOilHeld: 2, board: cannotKill(3), focusRemaining: 2 });

  it("at NEVER_FIRES_THRESHOLD the new branch is inert — the arm degenerates to on-demand", () => {
    const s = inBand();
    expect(doubleLethalTriggers(s, E, NEVER_FIRES_THRESHOLD)).toEqual(onDemandTriggers(s, E));
  });

  it("at ALWAYS_FIRES_THRESHOLD it fires regardless of how certain the bot is", () => {
    const s = oilState({ fishHp: 3, relaxingOilHeld: 2, board: certainKill(3), focusRemaining: 0, focusCell: FISH });
    expect(bestKillProbability(s)).toBe(1);
    expect(doubleLethalTriggers(s, E, ALWAYS_FIRES_THRESHOLD).filter((k) => k === "relaxing")).toHaveLength(2);
  });

  it("the recommended value is strictly between those two behaviours", () => {
    const uncertain = inBand();
    const certain = oilState({ fishHp: 3, relaxingOilHeld: 2, board: certainKill(3), focusRemaining: 0, focusCell: FISH });
    const t = RECOMMENDED_NECESSITY_THRESHOLDS.relaxing;
    expect(doubleLethalTriggers(uncertain, E, t).filter((k) => k === "relaxing")).toHaveLength(2);
    expect(doubleLethalTriggers(certain, E, t).filter((k) => k === "relaxing")).toHaveLength(0);
    // And it is the SAME constant the necessity gate uses — no second number.
    expect(t).toBe(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing);
    expect(t).toBeGreaterThan(NEVER_FIRES_THRESHOLD);
    expect(t).toBeLessThan(ALWAYS_FIRES_THRESHOLD);
  });
});

describe("the policy wrapper respects stock POSITIONALLY, not just by kind", () => {
  it("drops the second relaxing when only one is held", () => {
    const p = doubleLethal(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing);
    // One oil held: the band condition already refuses, so this is on-demand.
    const one = oilState({ fishHp: 3, relaxingOilHeld: 1, board: cannotKill(3), focusRemaining: 2, focusOilHeld: 0 });
    expect(p.decide(one, E)).toEqual([]);
  });

  it("emits both when two are held, and never more than are held", () => {
    const p = doubleLethal(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing);
    const two = oilState({ fishHp: 3, relaxingOilHeld: 2, board: cannotKill(3), focusRemaining: 2, focusOilHeld: 0 });
    const d = p.decide(two, E);
    expect(d).toEqual(["relaxing", "relaxing"]);
    expect(d.filter((k) => k === "relaxing").length).toBeLessThanOrEqual(two.relaxingOilHeld);
  });
});

describe("it IS wired live — [session 90 §1b] the guard, turned around rather than deleted", () => {
  /**
   * **This assertion used to say the opposite, and that is the point.**
   * From session 89 to session 90 it read `expect(src).not.toContain(
   * "doubleLethalTriggers(")` — a text grep whose whole job was to stop this
   * feature shipping by accident while the memo recommended against it.
   *
   * The user's override (`QUESTIONS.md` §30) made it fail BY DESIGN. Deleting
   * it would have been the easy move and the wrong one: the guard's real job
   * is to make the wiring status of this trigger a thing a test knows, in
   * whichever direction it currently points. Inverted, it catches a silent
   * revert — someone "cleaning up" the live call site back to
   * `onDemandTriggers` and quietly withdrawing a decision the account owner
   * made.
   *
   * **A grep is a weak instrument and is not carrying this alone.**
   * `tests/fishing/oilDoubleLethalLive.test.ts` runs the actual consume loop
   * and fails if the wiring is reverted — verified by mutation, not assumed.
   * This one exists so the FAILURE MESSAGE names the decision.
   */
  it("liveFishing.ts calls doubleLethalTriggers, and still falls back to onDemandTriggers", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("scripts/liveFishing.ts", "utf8");
    expect(src).toContain("oilWanted = doubleLethalTriggers(");
    // `onDemandTriggers` must STILL be called — it is the throw fallback, and
    // the reason every out-of-band behaviour is preserved. Its disappearance
    // would mean the degrade path went with it.
    expect(src).toContain("oilWanted = onDemandTriggers(oilTimingState, PAYLOAD_OIL_EFFECTS)");
  });

  it("the sim's own recommendation is still AGAINST, and the memo still says so", async () => {
    const { readFileSync } = await import("node:fs");
    const memo = readFileSync("handoff/OIL-DOUBLE-LETHAL.md", "utf8");
    // Wiring it did NOT make it a good trade on the sweep's own terms. If a
    // future session softens the memo to match the shipped behaviour, that is
    // the record being rewritten to agree with the code, and this catches it.
    expect(memo).toContain("140.9");
    expect(memo).toContain("the recommendation is DO NOT SHIP");
  });
});
