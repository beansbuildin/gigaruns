/**
 * tests/boons.test.ts — re-derive every entry of `BOON_MODELS` and
 * `OBSERVED_OFFERS` from the fixtures.
 *
 * Same contract as `tests/enemies.test.ts`: the boon table is a claim about
 * recorded responses, so a hand-edited value in `boons.ts` must fail here. This
 * matters more for boons than for enemy stats, because a boon delta is the one
 * thing in the sim that is genuinely tempting to infer from a name.
 */

import { describe, expect, it } from "vitest";

import {
  applyBoon,
  BOON_MODELS,
  OBSERVED_OFFERS,
  UNMODELLED_TYPES,
  type BoonOption,
} from "../src/sim/boons.js";
import { boonPickups, loadCorpus, toCombatant } from "../src/sim/corpus.js";
import { ROOM_ENEMIES } from "../src/sim/enemies.js";
import { ROLLED } from "../src/sim/types.js";

const roomOf = (enemyId: string): number =>
  ROOM_ENEMIES.find((p) => p.enemy.id === enemyId)?.room ?? -1;

const pickups = boonPickups(loadCorpus(), roomOf);

describe("the corpus supports a boon model at all", () => {
  it("contains before/after pairs, each adding exactly one boon", () => {
    // [session 20] Floor, not an exact literal — see tests/replay.test.ts's
    // matching comment. pickups only grows as the append-only corpus grows.
    expect(pickups.length).toBeGreaterThanOrEqual(41);
    for (const p of pickups) {
      const before = p.before.run.players[0]!.pickedBoons ?? [];
      const after = p.after.run.players[0]!.pickedBoons ?? [];
      expect(after.length - before.length, p.label).toBe(1);
    }
  });

  it("offers exactly three options at every pickup", () => {
    for (const p of pickups) expect(p.offered.length, p.label).toBe(3);
  });

  it("picks a boon that was actually on the table", () => {
    for (const p of pickups) {
      expect(p.offered.map((o) => o.boonTypeString), p.label).toContain(
        p.picked.boonTypeString,
      );
    }
  });
});

describe("every modelled boon reproduces its recorded delta", () => {
  for (const p of pickups) {
    it(`${p.picked.boonTypeString} — ${p.run} ${p.label}`, () => {
      const model = BOON_MODELS[p.picked.boonTypeString];
      expect(model, `${p.picked.boonTypeString} has a pair but no model`).toBeDefined();

      const before = toCombatant(p.before.run.players[0]!);
      const after = toCombatant(p.after.run.players[0]!);
      const option: BoonOption = {
        type: p.picked.boonTypeString,
        val1: p.picked.selectedVal1,
        val2: p.picked.selectedVal2,
      };

      const predicted = applyBoon(before, option).player;

      // The full player state must land where the server put it — not just the
      // one field the model touches. A boon that also moved something else
      // would slip through a field-specific assertion.
      expect(predicted.hp, "hp").toBe(after.hp);
      expect(predicted.hpMax, "hpMax").toBe(after.hpMax);
      expect(predicted.armor, "armor").toBe(after.armor);
      expect(predicted.armorMax, "armorMax").toBe(after.armorMax);
      for (const s of ROLLED) expect(predicted.rolled[s], s).toBe(after.rolled[s]);
    });
  }

  it("covers every boon type the corpus has a pair for, and models no others", () => {
    const withPairs = [...new Set(pickups.map((p) => p.picked.boonTypeString))].sort();
    expect(Object.keys(BOON_MODELS).sort()).toEqual(withPairs);
  });
});

describe("boon values come from selectedVal1, not the range", () => {
  it("Heal's applied value is double its val1Min — DECISIONS 2026-08-14", () => {
    const heal = pickups.find((p) => p.picked.boonTypeString === "Heal");
    expect(heal).toBeDefined();
    // `basicBoonMultiplier` is 2. Reading val1Min here would heal 8 instead of
    // 16 and every boon in the game would be silently halved.
    expect(heal!.picked.val1Min).toBe(8);
    expect(heal!.picked.selectedVal1).toBe(16);

    const before = toCombatant(heal!.before.run.players[0]!);
    const after = toCombatant(heal!.after.run.players[0]!);
    expect(after.hp - before.hp).toBe(heal!.picked.selectedVal1);
  });
});

describe("AddBurnSword's empty delta is a result, not an omission", () => {
  it("changes no player field at pickup", () => {
    const burn = pickups.find((p) => p.picked.boonTypeString === "AddBurnSword")!;
    const before = toCombatant(burn.before.run.players[0]!);
    const after = toCombatant(burn.after.run.players[0]!);

    expect(after.hp).toBe(before.hp);
    expect(after.armor).toBe(before.armor);
    expect(after.hpMax).toBe(before.hpMax);
    expect(after.armorMax).toBe(before.armorMax);
    for (const s of ROLLED) expect(after.rolled[s], s).toBe(before.rolled[s]);
  });
});

describe("recorded offers match the fixtures", () => {
  it("OBSERVED_OFFERS is exactly what the corpus recorded, room and all", () => {
    const fromCorpus = pickups
      .map((p) => `${p.room}: ${p.offered.map((o) => `${o.boonTypeString}(${o.selectedVal1},${o.selectedVal2})`).join(" | ")}`)
      .sort();
    const fromTable = OBSERVED_OFFERS.map(
      (o) => `${o.room}: ${o.options.map((x) => `${x.type}(${x.val1},${x.val2})`).join(" | ")}`,
    ).sort();
    expect(fromTable).toEqual(fromCorpus);
  });

  it("has no offer past room 4 — the deepest run cleared room 4 and reached room 5", () => {
    // [session 20, LIVE] Was `toBe(3)` through session 19 — the potion-
    // orchestrator-wiring smoke test cleared room 4 for the first time,
    // producing this corpus's first room-4 offer (see ROOM_ENEMIES' new
    // room-5 entry, src/sim/enemies.ts).
    expect(Math.max(...OBSERVED_OFFERS.map((o) => o.room))).toBe(4);
  });
});

describe("fail-closed on unmodelled types", () => {
  it("leaves the player untouched and flags BOON_UNMODELLED", () => {
    const before = toCombatant(pickups[0]!.before.run.players[0]!);
    const r = applyBoon(before, { type: "UpgradePaper", val1: 0, val2: 4 });

    expect(r.model).toBeNull();
    expect(r.reasons).toEqual(["BOON_UNMODELLED"]);
    // UpgradePaper almost certainly adds 4 to Shield. We do not act on that.
    expect(r.player.moves.paper.def).toBe(before.moves.paper.def);
    expect(r.player.moves.paper.atk).toBe(before.moves.paper.atk);
  });

  it("names the types the corpus offered but never showed the effect of", () => {
    expect(UNMODELLED_TYPES).toEqual([
      // AddBlock moved OUT — session 08 gave it a live pickup pair, now modelled.
      // UpgradeRock/UpgradeScissor moved OUT — session 09 gave both live
      // pickup pairs (moveDelta), now modelled.
      // AddMaxArmor/CorrosiveShield moved OUT — session 11 gave both live
      // pickup pairs (maxArmor / latent), now modelled.
      // CorrosiveMagic moved OUT — session 14 gave it a live pickup pair
      // (latent, same shape as AddBurnSword/CorrosiveShield), now modelled.
      "AddBurnMagic", // session 12: first sighting, live room-1 offer, not picked
      "AddBurnShield", // session 19: first sighting, live room-1 offer (orchestrator smoke test), not picked
      "AddLifestealMagic", // session 16: first sighting, live room-1 offer (Task 12 Stage B potion-timing run), not picked
      "AddLifestealShield", // session 11: first sighting, room-1 offer, not picked; offered again session 14, still not picked
      "AddVulnerableShield", // live [2026-08-16/17]: first sighting, the takeover run's room-3 offer, not picked
      "AddWeakSword", // session 11: first sighting, room-1 offer, not picked
      "ArmorDepletedWeak", // session 14: first sighting, room-1 offer (Task 12 Stage B probe run), not picked
      "BurnMastery", // session 11: first sighting, room-1 offer, not picked
      "BurningTenacity", // session 16: first sighting, live room-1 offer (Task 12 Stage B potion-timing run), not picked
      "CorrosiveSword", // session 20: first sighting, the corpus's first-ever room-4 offer, not picked
      "LossBlockUp", // session 20: first sighting, live room-2 offer, not picked
      "Regen",
      "SecondWind", // session 16: first sighting, live room-3 offer, not picked
      "TieDamageReduction",
      "TieVulnerable", // session 12: first sighting, live room-3 offer, not picked
      "TieWeak", // session 09: first sighting, offered in the new room-2 (non-Safe-tier) offer, not picked
      "UpgradePaper",
      "VulnerableBlock", // live [2026-08-16/17]: first sighting, the takeover run's room-1 offer, not picked
      "VulnerableEvade", // session 11: first sighting, room-2 offer, not picked
      "VulnerableMastery", // session 12: first sighting, live room-2 offer, not picked
      "WeakeningBlock", // session 09: first sighting, room-1 offers, not picked
      "WeakeningMastery", // session 08: same offer, not picked
    ]);
  });
});

describe("Wall 1 — HELD through session 08, THREE holes by end of session 09 LIVE", () => {
  // [session 09, LIVE] This describe block used to assert "no room-1 option
  // is both modelled and clean" outright — true through session 08's corpus,
  // false now. Session 09's five-run live stage captured, independently: a
  // second room-1 Heal offer (this time PICKED, not just offered) and a
  // room-1 UpgradeRock offer (picked) — `moveDelta` is `contaminates: []`,
  // same reasoning as Heal (see BOON_MODELS). `UpgradeScissor` also turns out
  // to be offered at room 1 (session 06's AddMaxArmor/AddLuck/UpgradeScissor
  // offer, not picked there — its own pair came from a room-2 pick this
  // session). `deepestScorableRoom` moved 1 -> 4 (MAX_OBSERVED_ROOM, the
  // corpus's absolute depth ceiling) this session (tests/dungeonSim.test.ts,
  // "the Task 4 gate") — not from a single lucky pick, but three independent
  // clean room-1 options now.
  it("has clean+modelled room-1 options — Heal, UpgradeRock, UpgradeScissor and AddMaxArmor", () => {
    // [session 11] +3 room-1 offers (9 options), none of them newly clean —
    // AddMaxArmor's own first pair landed at room 2 this session (see
    // below), but the corpus already had an UNPICKED room-1 AddMaxArmor
    // offer since session 06 (run-2026-08-14-03-26-57/state-016) that was
    // unmodelled until now. Modelling a type retroactively makes every past
    // offer containing it clean too — a fourth room-1 hole, discovered here
    // rather than by a fresh room-1 capture.
    // [session 12] +2 more room-1 offers (6 options: UpgradePaper/
    // WeakeningMastery/AddLuck and AddEvasion/AddBurnSword/AddBurnMagic),
    // none newly clean either — all either rolled-stat (contaminated) or
    // still-unmodelled types.
    // [session 13] +1 more room-1 offer (3 options: UpgradeScissor/AddBlock/
    // AddTenacity — Task 12 Stage A probe's run, not this session's focus).
    // UpgradeScissor is clean, adding a SECOND clean UpgradeScissor entry.
    // [session 14] +1 more room-1 offer (3 options: AddTenacity/AddBlock/
    // ArmorDepletedWeak — Task 12 Stage B's consumables probe run). All
    // three are rolled-stat or still-unmodelled; the clean set is unchanged.
    // [session 16] +2 more room-1 offers (3 options each): CorrosiveMagic/
    // BurningTenacity/AddLifestealMagic (first potion-timing run) and
    // UpgradeScissor/AddMaxArmor/AddBlock (second run, confirming the fixed
    // index handling). CorrosiveMagic is modelled but latent (non-empty
    // `contaminates`); the other five options are already-known clean or
    // unmodelled types, so the clean set is unchanged.
    // [live, 2026-08-16/17] +1 more room-1 offer (3 options: VulnerableBlock/
    // CorrosiveShield/AddBlock — the takeover run). VulnerableBlock is newly
    // unmodelled; CorrosiveShield and AddBlock are already-known
    // modelled-but-contaminated types, so the clean set is unchanged.
    // [live, session 19] +1 more room-1 offer (3 options: AddTenacity/
    // AddBlock/AddBurnShield — the orchestrator smoke test's real run).
    // AddBurnShield is newly unmodelled; AddTenacity and AddBlock are
    // already-known rolled-stat (contaminated) types, so the clean set is
    // unchanged.
    // [session 20] +2 more room-1 offers (3 options each): AddTenacity/
    // UpgradeRock/AddTenacity and AddBlock/UpgradePaper/UpgradeRock (the
    // potion-orchestrator-wiring smoke test's two runs). Both UpgradeRock
    // entries are the DEF-variant, already known clean/modelled — TWO new
    // clean picks join the set below (the first NEW room-1 clean type since
    // AddMaxArmor, session 06). UpgradePaper stays unmodelled.
    const roomOne = OBSERVED_OFFERS.filter((o) => o.room === 1).flatMap((o) => o.options);
    expect(roomOne.length).toBe(69);

    const clean: string[] = [];
    for (const option of roomOne) {
      const { reasons } = applyBoon(toCombatant(pickups[0]!.before.run.players[0]!), option);
      if (reasons.length === 0) clean.push(option.type);
      else expect(reasons.length, `${option.type} came back clean`).toBeGreaterThan(0);
    }
    expect(clean.sort()).toEqual([
      "AddMaxArmor",
      "AddMaxArmor",
      "Heal",
      "Heal",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
    ]);
  });

  it("Heal, UpgradeScissor, UpgradeRock and AddMaxArmor are the only clean boons in the corpus", () => {
    // [session 11] AddMaxArmor joined this session — captured at room 2, not
    // room 1, so it doesn't move the room-1-scoped test above.
    const clean = Object.entries(BOON_MODELS)
      .filter(([, m]) => m.contaminates.length === 0)
      .map(([t]) => t);
    expect(clean).toEqual(["Heal", "UpgradeScissor", "UpgradeRock", "AddMaxArmor"]);

    const healRooms = OBSERVED_OFFERS.filter((o) =>
      o.options.some((x) => x.type === "Heal"),
    ).map((o) => o.room);
    // [session 20] +1 room-2 Heal offer (potion-orchestrator-wiring smoke
    // test, Run A) — a second independent room-2 sighting, not new depth.
    expect(healRooms).toEqual([1, 1, 2, 2]);
  });
});
