/**
 * tests/boonPriority.test.ts — the user's boon directive as a total order.
 *
 * Two kinds of assertion. The unit tests pin the order itself and the one
 * window rule, including the `AddLifestealSword` edge that both rules touch.
 * The corpus tests pin the claims the module's own header makes about the
 * fixtures — the family matchers against the real type names, and the measured
 * 1-of-5 overlap with `boonCapture.ts` that is the reason both layers still
 * exist. If that overlap ever changes, the retire-or-keep decision should be
 * re-made rather than inherited.
 */

import { describe, expect, it } from "vitest";

import {
  BURN_MASTERY,
  choosePriorityBoon,
  DEFAULT_BOON_PRIORITY,
  EARLY_GAME_MAX_ROOM,
  isLifesteal,
  isSwordFamily,
  isVulnerableFamily,
  lifestealSightings,
  pickBoonWithPriority,
  priorityOf,
} from "../src/strategy/boonPriority.js";
import { DEFAULT_CAPTURE_TARGETS } from "../src/strategy/boonCapture.js";
import { BOON_MODELS, OBSERVED_OFFERS, type BoonOption } from "../src/sim/boons.js";
import type { Combatant } from "../src/sim/types.js";

const opt = (type: string, val1 = 1, val2 = 0): BoonOption => ({ type, val1, val2 });

const player = (hp = 40, hpMax = 40): Combatant =>
  ({ hp, hpMax, armor: 8, armorMax: 20, moves: {} }) as unknown as Combatant;

const pick = (offered: BoonOption[], room: number) =>
  pickBoonWithPriority(player(), offered, room).type;

describe("the total order", () => {
  it("ranks the five families in the directive's order", () => {
    expect(priorityOf(BURN_MASTERY, 1)).toBe(1);
    expect(priorityOf("AddMaxArmor", 1)).toBe(2);
    expect(priorityOf("AddMaxHealth", 1)).toBe(3);
    expect(priorityOf("UpgradeRock", 1)).toBe(4);
    expect(priorityOf("AddBurnSword", 1)).toBe(4);
    expect(priorityOf("VulnerableBlock", 1)).toBe(5);
    expect(priorityOf("AddLuck", 1)).toBeNull();
  });

  it("BurnMastery displaces AddMaxArmor — the one exception rule", () => {
    expect(pick([opt("AddMaxArmor"), opt(BURN_MASTERY)], 1)).toBe(BURN_MASTERY);
    // ...and MaxArmor is still the default first pick without it.
    expect(pick([opt("AddMaxHealth"), opt("AddMaxArmor"), opt("UpgradeRock")], 1)).toBe("AddMaxArmor");
  });

  it("each family beats every family below it", () => {
    expect(pick([opt("VulnerableBlock"), opt("UpgradeRock")], 1)).toBe("UpgradeRock");
    expect(pick([opt("UpgradeRock"), opt("AddMaxHealth")], 1)).toBe("AddMaxHealth");
    expect(pick([opt("AddMaxHealth"), opt("AddMaxArmor")], 1)).toBe("AddMaxArmor");
  });

  it("falls through to rankBoons when the offer holds nothing on the list", () => {
    const offered = [opt("AddLuck"), opt("AddEvasion"), opt("Heal", 10)];
    expect(choosePriorityBoon({ player: player(), offered, room: 3 })).toBeNull();
    // Still returns a real pick — the fallback is the scorer, unchanged.
    expect(offered.map((o) => o.type)).toContain(pick(offered, 3));
  });
});

describe("the Sword family is matched by suffix, not by a hand-listed set", () => {
  it("covers every *Sword type in the corpus plus UpgradeRock", () => {
    for (const type of [
      "UpgradeRock",
      "AddBurnSword",
      "AddWeakSword",
      "AddVulnerableSword",
      "AddLifestealSword",
      "CorrosiveSword",
    ]) {
      expect(isSwordFamily(type), type).toBe(true);
    }
  });

  it("covers a *Sword type that has never been offered — the point of the suffix rule", () => {
    // Synthetic: new `*Sword` types appear in this game and must be picked up
    // without a code change. Not a real corpus type, deliberately.
    expect(isSwordFamily("AddThornsSword")).toBe(true);
    expect(priorityOf("AddThornsSword", 1)).toBe(4);
  });

  it("does not match the Shield or Magic arms of the same mechanics", () => {
    for (const type of ["AddBurnShield", "AddLifestealMagic", "CorrosiveShield", "UpgradePaper"]) {
      expect(isSwordFamily(type), type).toBe(false);
    }
  });

  it("AddVulnerableSword resolves to 4, the stronger of its two families", () => {
    expect(isSwordFamily("AddVulnerableSword")).toBe(true);
    expect(isVulnerableFamily("AddVulnerableSword")).toBe(true);
    expect(priorityOf("AddVulnerableSword", EARLY_GAME_MAX_ROOM + 1)).toBe(4);
  });
});

describe("the Vulnerable family", () => {
  it("matches the marker in every position the corpus uses it", () => {
    for (const type of [
      "VulnerableEvade",
      "VulnerableBlock",
      "VulnerableMastery",
      "AddVulnerableShield",
      "AddVulnerableMagic",
      "TieVulnerable",
      "ArmorDepletedVulnerable",
    ]) {
      expect(isVulnerableFamily(type), type).toBe(true);
      expect(priorityOf(type, 1), type).toBe(5);
    }
  });
});

describe("the lifesteal demotion — rooms 1..8, user-confirmed", () => {
  it("matches all three arms of the lifesteal mechanic and nothing else", () => {
    for (const type of ["AddLifestealSword", "AddLifestealShield", "AddLifestealMagic"]) {
      expect(isLifesteal(type), type).toBe(true);
    }
    for (const type of ["AddBurnSword", "VulnerableBlock", "AddMaxArmor"]) {
      expect(isLifesteal(type), type).toBe(false);
    }
    // The shipped window is the user-confirmed 8.
    expect(DEFAULT_BOON_PRIORITY.earlyGameMaxRoom).toBe(8);
    expect(EARLY_GAME_MAX_ROOM).toBe(8);
  });

  it("is a demotion, not an exclusion: lifesteal still wins when nothing is on the list", () => {
    expect(priorityOf("AddLifestealMagic", 1)).toBeNull();
    // Falls to rankBoons, which is free to take it — the module never removes
    // an option from the offer.
    const offered = [opt("AddLifestealMagic")];
    expect(pick(offered, 1)).toBe("AddLifestealMagic");
  });

  it("loses to every listed family inside the window", () => {
    expect(pick([opt("AddLifestealSword"), opt("VulnerableBlock")], 3)).toBe("VulnerableBlock");
    expect(pick([opt("AddLifestealShield"), opt("AddMaxArmor")], 8)).toBe("AddMaxArmor");
  });

  it("AddLifestealSword is demoted through room 8 and priority 4 from room 9", () => {
    for (const room of [1, 4, EARLY_GAME_MAX_ROOM]) {
      expect(priorityOf("AddLifestealSword", room), `room ${room}`).toBeNull();
      expect(pick([opt("AddLifestealSword"), opt("VulnerableBlock")], room)).toBe("VulnerableBlock");
    }
    for (const room of [EARLY_GAME_MAX_ROOM + 1, 12]) {
      expect(priorityOf("AddLifestealSword", room), `room ${room}`).toBe(4);
      expect(pick([opt("AddLifestealSword"), opt("VulnerableBlock")], room)).toBe("AddLifestealSword");
    }
  });

  it("records every lifesteal sighting so the edge has a log either way", () => {
    const inside = lifestealSightings([opt("AddLifestealSword"), opt("AddMaxArmor")], 3);
    expect(inside).toEqual([
      { type: "AddLifestealSword", demoted: true, priorityOutsideWindow: 4 },
    ]);
    const outside = lifestealSightings([opt("AddLifestealSword")], EARLY_GAME_MAX_ROOM + 1);
    expect(outside[0]!.demoted).toBe(false);
    // A lifesteal type with no family at all reports null, not a fake rank.
    expect(lifestealSightings([opt("AddLifestealMagic")], 3)[0]!.priorityOutsideWindow).toBeNull();
  });

  it("honours a moved window rather than hard-coding 8", () => {
    const config = { earlyGameMaxRoom: 2 };
    expect(priorityOf("AddLifestealSword", 3, config)).toBe(4);
    expect(priorityOf("AddLifestealSword", 2, config)).toBeNull();
  });
});

describe("the decision object", () => {
  it("flags BurnMastery so every sighting can be logged", () => {
    const d = choosePriorityBoon({ player: player(), offered: [opt("AddMaxArmor"), opt(BURN_MASTERY)], room: 1 })!;
    expect(d.burnMastery).toBe(true);
    expect(d.priority).toBe(1);
    expect(d.index).toBe(1);
    const other = choosePriorityBoon({ player: player(), offered: [opt("AddMaxArmor")], room: 1 })!;
    expect(other.burnMastery).toBe(false);
  });

  it("breaks a within-tier tie via rankBoons, reproducibly", () => {
    const offered = [opt("AddBurnSword"), opt("UpgradeRock")];
    const first = choosePriorityBoon({ player: player(), offered, room: 2 })!;
    const again = choosePriorityBoon({ player: player(), offered, room: 2 })!;
    expect(first.priority).toBe(4);
    expect(first.option.type).toBe(again.option.type);
    expect(first.reason).toContain("rankBoons broke the tie");
    // The reported index really addresses the winner in the offer as passed.
    expect(offered[first.index]!.type).toBe(first.option.type);
  });

  it("throws on an empty offer, matching pickBoon", () => {
    expect(() => pickBoonWithPriority(player(), [], 1)).toThrow(/empty offer/);
  });
});

describe("against the corpus", () => {
  it("never returns an option that was not in the offer, on any captured offer at any HP", () => {
    for (const offer of OBSERVED_OFFERS) {
      for (const fraction of [1, 0.75, 0.5, 0.25]) {
        const p = player(Math.max(1, Math.round(40 * fraction)), 40);
        const chosen = pickBoonWithPriority(p, offer.options, offer.room);
        expect(offer.options).toContain(chosen);
      }
    }
  });

  it("the boonCapture overlap is 1 of 5 — the reason both layers still exist", () => {
    const subsumed = DEFAULT_CAPTURE_TARGETS.filter((t) => priorityOf(t, 1) !== null);
    expect(subsumed).toEqual(["VulnerableBlock"]);
  });

  it("reaches unmodelled types the scorer never could — the by-product capture", () => {
    // Session 55: `pickBoon` top-ranked an unmodelled type 0 times in 540
    // decisions. The directive is expected to break that, and if it stops
    // doing so the "capture is nearly free now" claim in the recap is stale.
    const reached = new Set<string>();
    for (const offer of OBSERVED_OFFERS) {
      const chosen = pickBoonWithPriority(player(), offer.options, offer.room);
      if (!BOON_MODELS[chosen.type]) reached.add(chosen.type);
    }
    expect(reached.size).toBeGreaterThan(0);
  });
});
