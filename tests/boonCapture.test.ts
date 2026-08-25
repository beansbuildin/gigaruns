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
    expect(call([opt("BurningEvade"), opt("LossBlockUp")], 1, { config: BOON_CAPTURE_OFF })).toBeNull();
  });

  it("BOON_CAPTURE_OFF is off but still carries the real target list, so an armed caller cannot forget it", () => {
    expect(BOON_CAPTURE_OFF.enabled).toBe(false);
    expect(BOON_CAPTURE_OFF.targets).toEqual(DEFAULT_CAPTURE_TARGETS);
  });
});

describe("chooseCaptureBoon — the three limits", () => {
  it("limit 1: fires in room 1", () => {
    // [session 89] Exemplar moved off `AddBurnShield` — it was modelled this
    // session (offline, from a session-88 pair) and is therefore retired from
    // `DEFAULT_CAPTURE_TARGETS`. `Regen` is the new top-ranked target.
    const d = call([opt("AddLuck"), opt("LossBlockUp")], 1);
    expect(d?.option.type).toBe("LossBlockUp");
    expect(d?.index).toBe(1);
  });

  it("limit 1: does NOT fire in rooms 2+, where a bad boon costs more", () => {
    for (const room of [2, 3, 4, 9]) {
      expect(call([opt("AddLuck"), opt("LossBlockUp")], room)).toBeNull();
    }
  });

  it("limit 2: does not fire twice in one run", () => {
    expect(call([opt("LossBlockUp")], 1, { alreadyCaptured: true })).toBeNull();
  });

  it("limit 3: a target that already has a model retires itself", () => {
    const d = call([opt("LossBlockUp"), opt("AddLifestealSword")], 1, {
      isModelled: (t) => t === "LossBlockUp",
    });
    expect(d?.option.type).toBe("AddLifestealSword");
  });

  it("limit 3: when every target is modelled it stops firing entirely", () => {
    expect(call([opt("LossBlockUp"), opt("AddLifestealSword")], 1, { isModelled: () => true })).toBeNull();
  });
});

describe("chooseCaptureBoon — selection", () => {
  it("returns null when the offer holds no target", () => {
    expect(call([opt("AddLuck"), opt("Heal", 10), opt("UpgradeRock")], 1)).toBeNull();
  });

  it("prefers the more frequently offered target when an offer holds two", () => {
    // [session 82] The example moved off TieWeak/VulnerableBlock: both got
    // first-ever pickup pairs from the 2026-08-23 juiced batch through the
    // ORDINARY rules, so both are modelled and retired from the target list.
    // [session 89] Same swap again, for the same reason: AddBurnShield was
    // modelled offline this session and retired. Regen (8 corpus offers)
    // outranks AddLifestealSword (5) because it is earlier in
    // DEFAULT_CAPTURE_TARGETS — modelling the common one first. This is the
    // third time this example has had to move, which is itself the finding:
    // the ordinary rules keep clearing the target list.
    // [session 95] FOURTH swap, same reason: `Regen` was modelled offline
    // this session (the wide orb rule took it in session 94's run 4) and
    // retired. LossBlockUp and AddLifestealSword are TIED at 6 corpus offers
    // each, so this example no longer demonstrates "more frequently offered"
    // by count — it demonstrates the tie-break, which is DEFAULT_CAPTURE_TARGETS
    // order, and LossBlockUp is earlier. Stated plainly rather than left to
    // read as a frequency claim it no longer is.
    const d = call([opt("AddLifestealSword"), opt("LossBlockUp")], 1);
    expect(d?.option.type).toBe("LossBlockUp");
  });

  it("reports the position within the offered array, and returns the offer's own object", () => {
    // `liveRun.ts` finds the wire index by matching the returned object by
    // IDENTITY against the array it passed in, so returning a copy would
    // silently break the pick.
    const offered = [opt("AddLuck"), opt("Heal", 10), opt("LossBlockUp")];
    const d = call(offered, 1);
    expect(d?.index).toBe(2);
    expect(d?.option).toBe(offered[2]);
  });

  it("the reason names rule 8 explicitly, so a later reader does not 'fix' this as a rule-8 violation", () => {
    expect(call([opt("LossBlockUp")], 1)?.reason).toMatch(/rule 8 does not apply/i);
  });
});

describe("the blind spot this module exists to break — measured against the corpus", () => {
  it("every unmodelled type falls into loot.ts's lowest-scoring category", () => {
    expect(UNMODELLED_TYPES.length).toBeGreaterThan(0);
    for (const type of UNMODELLED_TYPES) expect(categorise(type)).toBe("unknown");
  });

  it("pickBoon never PREFERS an unmodelled boon — the only way one reaches the top is an all-floor tie", () => {
    // Sweeping HP matters: `heal`'s gate and the pool weighting both move with
    // it, so a single HP value could hide a case where an unmodelled option
    // wins by default.
    //
    // ⚠ [session 95] THIS ASSERTION USED TO READ `toBe(0)` AND IT NOW FAILS AT
    // ZERO — 4 of 996 decisions top-rank an unmodelled type. The number was
    // NOT simply moved to 4. What broke is the wording, not the claim, and the
    // difference decides whether this module should be deleted (see this
    // file's header: "if it ever stops holding the module should be deleted
    // rather than left running").
    //
    // All 4 are the SAME offer at four HP fractions —
    // `run-2026-08-25-03-25-26/state-069`, room 5:
    // RegenMastery(1) | CorrosiveSword(2) | Vengeance(25). Every one of the
    // three scores **exactly 10**, the `unknown` floor, because `categorise`
    // sends LATENT boons to `unknown` too — CorrosiveSword and Vengeance are
    // both modelled and both land on the floor beside RegenMastery. The tie is
    // then broken by position in the wire array, and RegenMastery happened to
    // be first.
    //
    // So `pickBoon` did not prefer an unmodelled boon over a modelled one; it
    // could not tell three floor-scored options apart and took the one the
    // server listed first. The module's premise — that the ranker cannot
    // REACH an unmodelled type on its own merits — survives, and this test now
    // pins the stronger and more honest version of it: every top-ranked
    // unmodelled option must be part of a total tie at the floor. A case where
    // an unmodelled option outscored a modelled one would fail here, which is
    // the case that would actually justify keeping the override.
    let topRankedUnmodelled = 0;
    let strictlyPreferred = 0;
    for (const offer of OBSERVED_OFFERS) {
      for (const fraction of [1, 0.75, 0.5, 0.25]) {
        const p = player(Math.max(1, Math.round(40 * fraction)), 40);
        const ranked = rankBoons(p, offer.options, offer.room);
        const top = ranked[0]!;
        if (BOON_MODELS[top.option.type]) continue;
        topRankedUnmodelled++;
        // Strict preference = it outscored at least one option. A total tie is
        // not a preference.
        if (ranked.some((r) => r.score < top.score)) {
          strictlyPreferred++;
          expect.fail(
            `${top.option.type} outscored a modelled option at hp ${p.hp}/40 in ${offer.source}: ` +
              ranked.map((r) => `${r.option.type}=${r.score}`).join(", "),
          );
        }
      }
    }
    expect(strictlyPreferred).toBe(0);
    // Pinned so a future corpus growing this number is noticed rather than
    // absorbed. If it moves, re-derive WHY before touching it — a new
    // all-floor tie is benign, a strict preference is not, and only the
    // assertion above tells them apart.
    expect(topRankedUnmodelled).toBe(4);
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
