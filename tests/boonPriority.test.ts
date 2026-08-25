/**
 * tests/boonPriority.test.ts — the user's boon directive as a total order.
 *
 * Two kinds of assertion. The unit tests pin the order itself and the one
 * window rule, including the `AddLifestealSword` edge that both rules touch.
 * The corpus tests pin the claims the module's own header makes about the
 * fixtures — the family matchers against the real type names.
 *
 * [session 96] A third corpus test used to pin the overlap between this layer
 * and a second, gated capture layer, because that overlap was the reason both
 * existed. The capture layer was deleted (QUESTIONS.md §37), so the
 * retire-or-keep decision it guarded has been made and the test is gone with
 * it. `boonPriority.ts`'s header keeps the measurement itself.
 */

import { describe, expect, it } from "vitest";

import {
  chooseOrbFallback,
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

describe("the Hard Core orb tie-break (user directive, 2026-08-20 — session 57)", () => {
  const sword = [opt("AddBurnSword"), opt("UpgradeRock")]; // both priority 4

  it("takes the richer option when two tie at the same priority rank", () => {
    const d = choosePriorityBoon({ player: player(), offered: sword, room: 2, orbs: [16, 23] })!;
    expect(d.priority).toBe(4);
    expect(d.index).toBe(1);
    expect(d.orbTieBreak).toBe(true);
    expect(d.orbs).toBe(23);
    expect(d.reason).toContain("Hard Core payout 23 narrowed it");
  });

  it("NEVER overrides a higher-priority boon, however large the payout", () => {
    // The whole directive in one assertion: priority 2 with 1 orb beats
    // priority 4 with 99. Orbs are a tie-break and nothing else.
    const offered = [opt("AddMaxArmor"), opt("AddBurnSword")];
    const d = choosePriorityBoon({ player: player(), offered, room: 2, orbs: [1, 99] })!;
    expect(d.priority).toBe(2);
    expect(d.index).toBe(0);
    expect(d.orbTieBreak).toBe(false);
  });

  it('the PRIORITY LAYER itself still never fires without a family — both orb rules', () => {
    // Unchanged by session 58 and worth keeping separate from what the FALLBACK
    // does: `choosePriorityBoon` is the priority layer, and an offer with no
    // family on it has no rank for orbs to break a tie within, under either
    // rule. Policy C is a sibling of this function, not a loosening of it.
    const offered = [opt("AddEvasion"), opt("AddTenacity")];
    for (const orbRule of ["tie-break", "wide"] as const) {
      const config = { ...DEFAULT_BOON_PRIORITY, orbRule };
      expect(choosePriorityBoon({ player: player(), offered, room: 2, config, orbs: [1, 99] })).toBeNull();
    }
  });

  it('orbRule "tie-break" leaves an unranked offer to rankBoons — the session-57 control arm', () => {
    // This WAS the shipped rule and is now the control arm `scripts/
    // orbDepthExperiment.ts` measures against, so it stays pinned. It is also
    // what the account plays if the user reverses session 58's change.
    const offered = [opt("AddEvasion"), opt("AddTenacity")];
    const config = { ...DEFAULT_BOON_PRIORITY, orbRule: "tie-break" as const };
    const picked = pickBoonWithPriority(player(), offered, 2, config, {}, [1, 99]);
    const ranked = pickBoonWithPriority(player(), offered, 2, config);
    expect(picked.type).toBe(ranked.type);
  });

  it('orbRule "wide" (session 58, DEFAULT) takes the richest when no family is offered', () => {
    // The change the depth experiment bought: -0.002 rooms, paired 95% CI
    // [-0.018, +0.014] at n=8000, against a pre-registered 0.15-room bar, for
    // +6.3 Hard Core per run. Do not narrow this back without a user directive
    // — the same standing this rule replaced.
    const offered = [opt("AddEvasion"), opt("AddTenacity")];
    expect(DEFAULT_BOON_PRIORITY.orbRule).toBe("wide");
    const picked = pickBoonWithPriority(player(), offered, 2, DEFAULT_BOON_PRIORITY, {}, [1, 99]);
    expect(picked.type).toBe("AddTenacity");

    const d = chooseOrbFallback({ player: player(), offered, room: 2, orbs: [1, 99] })!;
    expect(d.index).toBe(1);
    expect(d.orbs).toBe(99);
    expect(d.narrowed).toBe(true);
  });

  it('orbRule "wide" still NEVER overrides a priority family', () => {
    // The directive's one hard constraint, re-asserted against the wide rule:
    // the fallback is only reachable when the priority layer returned null, so
    // a 99-orb unranked option cannot beat a 1-orb AddMaxArmor.
    const offered = [opt("AddMaxArmor"), opt("AddEvasion")];
    const picked = pickBoonWithPriority(player(), offered, 2, DEFAULT_BOON_PRIORITY, {}, [1, 99]);
    expect(picked.type).toBe("AddMaxArmor");
  });

  it('orbRule "wide" refuses a PARTIAL capture and reports a same-payout offer as not narrowed', () => {
    // Same guard as the tie-break's, for the same reason: an absent payout is
    // "not captured", never zero.
    const offered = [opt("AddEvasion"), opt("AddTenacity")];
    expect(chooseOrbFallback({ player: player(), offered, room: 2, orbs: [undefined, 99] })).toBeNull();
    expect(chooseOrbFallback({ player: player(), offered, room: 2 })).toBeNull();

    const flat = chooseOrbFallback({ player: player(), offered, room: 2, orbs: [7, 7] })!;
    expect(flat.narrowed).toBe(false);
    expect(flat.option.type).toBe(pickBoonWithPriority(player(), offered, 2, { ...DEFAULT_BOON_PRIORITY, orbRule: "tie-break" }).type);
  });

  it("refuses to fire on a PARTIAL capture rather than read an absent payout as zero", () => {
    // The failure this guards: option 0 has no recorded payout, option 1 pays
    // 5. Treating the absence as 0 would hand the pick to option 1 on no
    // evidence at all — a silent wrong answer in the direction the field was
    // added to improve.
    const d = choosePriorityBoon({ player: player(), offered: sword, room: 2, orbs: [undefined, 5] })!;
    expect(d.orbTieBreak).toBe(false);
    expect(d.reason).toContain("rankBoons broke the tie");
  });

  it("leaves rankBoons in charge when the tied options pay the SAME", () => {
    const d = choosePriorityBoon({ player: player(), offered: sword, room: 2, orbs: [20, 20] })!;
    expect(d.orbTieBreak).toBe(false);
    expect(d.reason).toContain("rankBoons broke the tie");
  });

  it("is inert when no payouts are supplied at all — every historical caller", () => {
    const withOut = choosePriorityBoon({ player: player(), offered: sword, room: 2 })!;
    expect(withOut.orbTieBreak).toBe(false);
    expect(withOut.orbs).toBeNull();
  });

  it("still hands three-way ties to rankBoons once orbs narrow them to two", () => {
    const offered = [opt("AddBurnSword"), opt("UpgradeRock"), opt("AddWeakSword")];
    const d = choosePriorityBoon({ player: player(), offered, room: 2, orbs: [23, 23, 9] })!;
    expect(d.orbTieBreak).toBe(true);
    expect(d.orbs).toBe(23);
    expect(d.index).toBeLessThan(2);
    expect(d.reason).toContain("rankBoons broke the tie");
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
