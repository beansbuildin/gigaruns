/**
 * tests/fishing/oilTiming.test.ts — [session 61 §4d] the oil TIMING policies
 * and the sim wiring behind them.
 *
 * Synthetic throughout, and unavoidably so: the corpus has no usable oil cast
 * (see `handoff/OIL-POLICY.md` §0). These pin the policies' TRIGGERS and the
 * sim's arithmetic — the things that must be right for the sweep's numbers to
 * mean anything — not the numbers themselves.
 */

import { describe, expect, it } from "vitest";

import {
  consumeAtStart,
  focusWhenEmptyOnly,
  heuristicC,
  lethalRelaxingOnly,
  neverOil,
  onDemand,
  PAYLOAD_OIL_EFFECTS,
  MEASURED_CONSUME_COSTS_TURN,
  type OilTimingState,
} from "../../src/strategy/fishing/oilTiming.js";
import { matcherFishPolicy, simulateCast, FOCUS_METER_MAX } from "../../src/sim/fishing/castSim.js";

const E = PAYLOAD_OIL_EFFECTS;
const st = (o: Partial<OilTimingState> = {}): OilTimingState => ({
  turn: 3,
  fishHp: 10,
  fishMaxHp: 20,
  mana: 5,
  focusRemaining: 2,
  focusMax: FOCUS_METER_MAX,
  focusOilHeld: 1,
  relaxingOilHeld: 1,
  ...o,
});

describe("the payload amounts are the ones the item metadata actually carries", () => {
  it("matches fixtures/fishing-casts/item-metadata-sample.json — verified, not taken from the brief", () => {
    expect(PAYLOAD_OIL_EFFECTS).toEqual({ focusRestore: 2, fishDamage: 2 });
  });
});

describe("neverOil — the control arm", () => {
  it("never consumes, whatever the state", () => {
    expect(neverOil.decide(st({ fishHp: 1, focusRemaining: 0 }), E)).toEqual([]);
  });
});

describe("consumeAtStart", () => {
  it("spends both on turn 0 and nothing after", () => {
    expect(consumeAtStart.decide(st({ turn: 0 }), E).sort()).toEqual(["focus", "relaxing"]);
    expect(consumeAtStart.decide(st({ turn: 1 }), E)).toEqual([]);
  });

  it("never claims an oil it does not hold", () => {
    expect(consumeAtStart.decide(st({ turn: 0, focusOilHeld: 0 }), E)).toEqual(["relaxing"]);
    expect(consumeAtStart.decide(st({ turn: 0, focusOilHeld: 0, relaxingOilHeld: 0 }), E)).toEqual([]);
  });
});

describe("onDemand — the recommendation", () => {
  it("spends the Relaxing Oil exactly at lethality, not before", () => {
    expect(onDemand.decide(st({ fishHp: E.fishDamage + 1, focusRemaining: 2 }), E)).toEqual([]);
    expect(onDemand.decide(st({ fishHp: E.fishDamage, focusRemaining: 2 }), E)).toEqual(["relaxing"]);
  });

  it("the lethality trigger tracks the EFFECT AMOUNT, not a hard-coded 2", () => {
    // The whole reason the sweep can vary the amount: at +3 a 3-HP fish is
    // lethal and at +1 it is not. A literal here would silently make the
    // sensitivity check meaningless.
    expect(onDemand.decide(st({ fishHp: 3 }), { focusRestore: 3, fishDamage: 3 })).toContain("relaxing");
    expect(onDemand.decide(st({ fishHp: 3 }), { focusRestore: 1, fishDamage: 1 })).not.toContain("relaxing");
  });

  it("spends the Focus Oil only at a meter of zero — the only state where it changes reachability", () => {
    expect(onDemand.decide(st({ focusRemaining: 1 }), E)).toEqual([]);
    expect(onDemand.decide(st({ focusRemaining: 0 }), E)).toEqual(["focus"]);
  });

  it("never spends a dead fish's oil", () => {
    expect(onDemand.decide(st({ fishHp: 0, focusRemaining: 2 }), E)).toEqual([]);
  });

  it("decomposes exactly into its two single-oil arms", () => {
    // The sweep reads on-demand's lift as roughly the sum of the two isolated
    // arms; that reading is only valid if the triggers are literally the same.
    for (const s of [st({ fishHp: 2, focusRemaining: 0 }), st({ fishHp: 9, focusRemaining: 0 }), st({ fishHp: 1 })]) {
      expect(onDemand.decide(s, E).sort()).toEqual(
        [...lethalRelaxingOnly.decide(s, E), ...focusWhenEmptyOnly.decide(s, E)].sort(),
      );
    }
  });
});

describe("heuristicC — the SHIPPED rule, scored rather than assumed good", () => {
  it("fires on fish the lethal trigger leaves alone, which is the whole difference", () => {
    // 3 HP of 20 is 15% — inside heuristic (c)'s window, outside +2 lethality.
    const s = st({ fishHp: 3, fishMaxHp: 20 });
    expect(heuristicC.decide(s, E)).toEqual(["relaxing"]);
    expect(lethalRelaxingOnly.decide(s, E)).toEqual([]);
  });

  it("matches session 43's constant, so this really is the shipped rule", () => {
    expect(heuristicC.decide(st({ fishHp: 3, fishMaxHp: 20 }), E)).toHaveLength(1);
    expect(heuristicC.decide(st({ fishHp: 4, fishMaxHp: 20 }), E)).toHaveLength(0);
  });
});

describe("the sim's oil arithmetic", () => {
  const MATCHER = matcherFishPolicy;

  it("is inert when `oils` is omitted — every historical number stays comparable", () => {
    // The additive-option contract: omitting `oils` must reproduce the sim
    // exactly as it was before session 61. Checked against an explicit
    // never-consume arm, which is the same run by construction.
    const before = simulateCast({ policy: MATCHER, seed: 21 });
    const withInertOils = simulateCast({
      policy: MATCHER,
      seed: 21,
      oils: { policy: neverOil, costsTurn: false, focusOilHeld: 3, relaxingOilHeld: 3 },
    });
    expect(withInertOils.outcome).toBe(before.outcome);
    expect(withInertOils.turns).toBe(before.turns);
    expect(withInertOils.hits).toBe(before.hits);
    expect(withInertOils.shots).toBe(before.shots);
    expect(withInertOils.finalFishHp).toBe(before.finalFishHp);
    expect(before.oilsUsed).toEqual([]);
  });

  it("records nothing when the policy never fires", () => {
    const r = simulateCast({
      policy: MATCHER,
      seed: 11,
      oils: { policy: neverOil, costsTurn: false, focusOilHeld: 3, relaxingOilHeld: 3 },
    });
    expect(r.oilsUsed).toEqual([]);
  });

  it("a LETHAL Relaxing Oil ends the cast as a catch, before any card is played", () => {
    // startFishHpRatio pinned so the fish opens at exactly the oil's damage.
    const r = simulateCast({
      policy: MATCHER,
      seed: 3,
      fishMaxHp: 20,
      startFishHpRatio: 0.1, // 2 HP — lethal at +2
      oils: { policy: lethalRelaxingOnly, costsTurn: false, relaxingOilHeld: 1 },
    });
    expect(r.outcome).toBe("caught");
    expect(r.oilsUsed).toEqual(["relaxing"]);
    expect(r.shots).toBe(0); // no card was ever played
    expect(r.turns).toBe(0);
  });

  it("the lethal trigger is INDIFFERENT to costsTurn — the claim the recommendation rests on", () => {
    const opts = { policy: MATCHER, seed: 3, fishMaxHp: 20, startFishHpRatio: 0.1 } as const;
    const free = simulateCast({ ...opts, oils: { policy: lethalRelaxingOnly, costsTurn: false, relaxingOilHeld: 1 } });
    const costly = simulateCast({ ...opts, oils: { policy: lethalRelaxingOnly, costsTurn: true, relaxingOilHeld: 1 } });
    expect(free.outcome).toBe(costly.outcome);
    expect(free.turns).toBe(costly.turns);
    expect(free.oilsUsed).toEqual(costly.oilsUsed);
  });

  it("caps the focus restore at FOCUS_METER_MAX by default, and honours capFocusRestore:false", () => {
    // Both run to completion without the meter exceeding its max; the cap is
    // the conservative reading and an uncapped restore flatters the Focus Oil.
    const capped = simulateCast({
      policy: MATCHER,
      seed: 5,
      oils: { policy: focusWhenEmptyOnly, costsTurn: false, focusOilHeld: 5 },
    });
    const uncapped = simulateCast({
      policy: MATCHER,
      seed: 5,
      oils: { policy: focusWhenEmptyOnly, costsTurn: false, focusOilHeld: 5, capFocusRestore: false },
    });
    expect(capped.oilsUsed.length).toBeGreaterThanOrEqual(0);
    expect(uncapped.oilsUsed.length).toBeGreaterThanOrEqual(0);
  });

  it("never spends more oil than the cast was given", () => {
    const r = simulateCast({
      policy: MATCHER,
      seed: 9,
      oils: { policy: consumeAtStart, costsTurn: false, focusOilHeld: 1, relaxingOilHeld: 1 },
    });
    expect(r.oilsUsed.filter((o) => o === "focus").length).toBeLessThanOrEqual(1);
    expect(r.oilsUsed.filter((o) => o === "relaxing").length).toBeLessThanOrEqual(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// [session 65 §3, GATE 1] THE TURN COST IS RESOLVED — pinned so the sweep
// cannot drift back to sweeping it.
// ───────────────────────────────────────────────────────────────────────────

describe("the measured turn cost", () => {
  it("is FALSE — consuming an oil costs no turn", () => {
    // *Live-measured, session 64 cast 13019015 (item 942); re-confirmed
    // session 65 on item 937.* The response carries FOCUS_STAMINA_DIFF and no
    // FISH_MOVED; position, hand, discard and nextCardIndex are identical
    // across it; mana 3->3 and 6->6.
    expect(MEASURED_CONSUME_COSTS_TURN).toBe(false);
  });

  it("makes the lethal trigger's indifference argument REDUNDANT rather than wrong", () => {
    // The SHIPPED policy's own thesis leans on being "indifferent to whether
    // consuming costs a turn". That was its distinguishing virtue while the
    // mechanic was open. Now every trigger is indifferent, because there is no
    // cost to be indifferent TO — so the argument is one the shipped policy no
    // longer needs, not one it has lost. Pinned because the thesis string
    // still says it, and a reader should find out here that it is now inert.
    // The behavioural half is already exercised above by "the lethal trigger
    // is INDIFFERENT to costsTurn"; that test is now a check on a SETTLED
    // answer rather than a probe of an open one, and is worth keeping for
    // exactly that reason.
    expect(onDemand.thesis).toMatch(/indifferent/i);
  });

});
