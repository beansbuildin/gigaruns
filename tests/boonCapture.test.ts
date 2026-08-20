/**
 * tests/boonCapture.test.ts — the boon-capture override.
 *
 * Two kinds of assertion here, and the second kind is the one that matters.
 * The unit tests pin the three limits (room 1 only, one per run, retire once
 * modelled) and the two-condition gate. The CORPUS tests pin the claim the
 * whole module rests on — that `pickBoon` can never reach an unmodelled boon
 * on its own — because that claim is what makes a deliberately worse pick
 * worth paying for, and if it ever stops holding the module should be deleted
 * rather than left running.
 */

import { describe, expect, it } from "vitest";

import {
  BOON_CAPTURE_OFF,
  chooseCaptureBoon,
  DEFAULT_CAPTURE_ROOMS,
  DEFAULT_CAPTURE_TARGETS,
  type BoonCaptureConfig,
} from "../src/strategy/boonCapture.js";
import { BOON_MODELS, OBSERVED_OFFERS, UNMODELLED_TYPES, type BoonOption } from "../src/sim/boons.js";
import { categorise, rankBoons } from "../src/strategy/loot.js";
import type { Combatant } from "../src/sim/types.js";

const opt = (type: string, val1 = 1, val2 = 0): BoonOption => ({ type, val1, val2 });

const ON: BoonCaptureConfig = {
  enabled: true,
  targets: DEFAULT_CAPTURE_TARGETS,
  rooms: DEFAULT_CAPTURE_ROOMS,
};

const never = () => false;

const call = (
  offered: BoonOption[],
  room: number,
  over: Partial<Parameters<typeof chooseCaptureBoon>[0]> = {},
) =>
  chooseCaptureBoon({
    offered,
    room,
    config: ON,
    alreadyCaptured: false,
    isModelled: never,
    ...over,
  });

/** A plausible mid-run player. The ranker's HP-sensitive branches are swept in the corpus test below. */
const player = (hp: number, hpMax: number): Combatant =>
  ({ hp, hpMax, armor: 8, armorMax: 20, moves: {} }) as unknown as Combatant;

describe("chooseCaptureBoon — the gate", () => {
  it("returns null when disabled, even on an offer full of targets", () => {
    expect(call([opt("TieWeak"), opt("Regen")], 1, { config: BOON_CAPTURE_OFF })).toBeNull();
  });

  it("BOON_CAPTURE_OFF is off but still carries the real target list, so an armed caller cannot forget it", () => {
    expect(BOON_CAPTURE_OFF.enabled).toBe(false);
    expect(BOON_CAPTURE_OFF.targets).toEqual(DEFAULT_CAPTURE_TARGETS);
  });
});

describe("chooseCaptureBoon — the three limits", () => {
  it("limit 1: fires in room 1", () => {
    const d = call([opt("AddLuck"), opt("TieWeak")], 1);
    expect(d?.option.type).toBe("TieWeak");
    expect(d?.index).toBe(1);
  });

  it("limit 1: does NOT fire in rooms 2+, where a bad boon costs more", () => {
    for (const room of [2, 3, 4, 9]) {
      expect(call([opt("AddLuck"), opt("TieWeak")], room)).toBeNull();
    }
  });

  it("limit 2: does not fire twice in one run", () => {
    expect(call([opt("TieWeak")], 1, { alreadyCaptured: true })).toBeNull();
  });

  it("limit 3: a target that already has a model retires itself", () => {
    const d = call([opt("TieWeak"), opt("Regen")], 1, { isModelled: (t) => t === "TieWeak" });
    expect(d?.option.type).toBe("Regen");
  });

  it("limit 3: when every target is modelled it stops firing entirely", () => {
    expect(call([opt("TieWeak"), opt("Regen")], 1, { isModelled: () => true })).toBeNull();
  });
});

describe("chooseCaptureBoon — selection", () => {
  it("returns null when the offer holds no target", () => {
    expect(call([opt("AddLuck"), opt("Heal", 10), opt("UpgradeRock")], 1)).toBeNull();
  });

  it("prefers the more frequently offered target when an offer holds two", () => {
    // TieWeak (11 corpus offers) outranks VulnerableBlock (4) because it is
    // earlier in DEFAULT_CAPTURE_TARGETS — modelling the common one first.
    const d = call([opt("VulnerableBlock"), opt("TieWeak")], 1);
    expect(d?.option.type).toBe("TieWeak");
  });

  it("reports the position within the offered array, and returns the offer's own object", () => {
    // `liveRun.ts` finds the wire index by matching the returned object by
    // IDENTITY against the array it passed in, so returning a copy would
    // silently break the pick.
    const offered = [opt("AddLuck"), opt("Heal", 10), opt("Regen")];
    const d = call(offered, 1);
    expect(d?.index).toBe(2);
    expect(d?.option).toBe(offered[2]);
  });

  it("the reason names rule 8 explicitly, so a later reader does not 'fix' this as a rule-8 violation", () => {
    expect(call([opt("TieWeak")], 1)?.reason).toMatch(/rule 8 does not apply/i);
  });
});

describe("the blind spot this module exists to break — measured against the corpus", () => {
  it("every unmodelled type falls into loot.ts's lowest-scoring category", () => {
    expect(UNMODELLED_TYPES.length).toBeGreaterThan(0);
    for (const type of UNMODELLED_TYPES) expect(categorise(type)).toBe("unknown");
  });

  it("pickBoon never top-ranks an unmodelled boon on ANY captured offer, at any HP", () => {
    // Sweeping HP matters: `heal`'s gate and the pool weighting both move with
    // it, so a single HP value could hide a case where an unmodelled option
    // wins by default.
    let topRankedUnmodelled = 0;
    for (const offer of OBSERVED_OFFERS) {
      for (const fraction of [1, 0.75, 0.5, 0.25]) {
        const p = player(Math.max(1, Math.round(40 * fraction)), 40);
        const top = rankBoons(p, offer.options, offer.room)[0]!;
        if (!BOON_MODELS[top.option.type]) topRankedUnmodelled++;
      }
    }
    expect(topRankedUnmodelled).toBe(0);
  });

  it("no captured offer is entirely unmodelled — the one escape hatch has never occurred", () => {
    const allUnmodelled = OBSERVED_OFFERS.filter((o) => o.options.every((x) => !BOON_MODELS[x.type]));
    expect(allUnmodelled).toEqual([]);
  });

  it("every default target is a real corpus type that is still unmodelled", () => {
    // Guards against a typo'd target silently making the override dead code,
    // and against the list going stale once a target gets a pair.
    const offeredTypes = new Set(OBSERVED_OFFERS.flatMap((o) => o.options.map((x) => x.type)));
    for (const target of DEFAULT_CAPTURE_TARGETS) {
      expect(offeredTypes.has(target), `${target} is not a type the corpus has ever offered`).toBe(true);
    }
    // If this fails because a target got modelled, that is SUCCESS: drop it
    // from DEFAULT_CAPTURE_TARGETS and add the next-ranked type.
    for (const target of DEFAULT_CAPTURE_TARGETS) {
      expect(BOON_MODELS[target], `${target} now has a model — retire it from the target list`).toBeUndefined();
    }
  });

  it("every default target is genuinely offered in a permitted room, or the override can never fire", () => {
    for (const target of DEFAULT_CAPTURE_TARGETS) {
      const reachable = OBSERVED_OFFERS.some(
        (o) => DEFAULT_CAPTURE_ROOMS.includes(o.room) && o.options.some((x) => x.type === target),
      );
      expect(reachable, `${target} has never been offered in rooms ${DEFAULT_CAPTURE_ROOMS.join("/")}`).toBe(true);
    }
  });
});
