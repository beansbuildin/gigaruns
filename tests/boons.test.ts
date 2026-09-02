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
import { boonCoverage } from "../scripts/boonCoverage.js";
import { ROOM_ENEMIES } from "../src/sim/enemies.js";
import { ROLLED } from "../src/sim/types.js";
import { summarizeBoonRunCoverage } from "../src/sim/boonRunCoverage.js";

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

/**
 * [session 108] Types with a live pickup pair that are deliberately NOT in
 * `BOON_MODELS` yet, because modelling a type from n=1 needs an explicit user
 * directive — the precedent is `LossIntuitionUp`, which session 99 measured,
 * put to the account owner with its evidence, and only then modelled.
 *
 * **[session 112] The set is EMPTY, and that is the state to keep it in.**
 * `LossBlockUp` was its only member for four sessions; the user gave the
 * directive on 2026-08-30 (QUESTIONS.md §64 ANSWERED, DECISIONS 2026-08-30)
 * and it is now modelled `latent` on the `LossIntuitionUp` precedent. Its
 * measured pickup delta is no longer pinned here — it is pinned by the
 * parametrized suite below, which now runs the FULL model assertion against
 * it, and by `LossBlockUp is latent at pickup` further down.
 *
 * **The mechanism stays because it is not about `LossBlockUp`.** An empty set
 * still subtracts nothing from the exhaustiveness assertion, so an unlisted
 * type that gains a pair and no model still fails — which is the property
 * this construction exists for. The next n=1 type awaiting a directive is
 * added here, and the branch below is what keeps its gap explicit rather than
 * letting a red wall test be the only signal.
 */
const AWAITING_MODEL_DIRECTIVE = new Set<string>([
  // ⭐ [session 113] `CritHeal` — FIRST PAIR, from run-2026-08-31-03-04-33
  // state-011 -> state-012. Held back for a user directive on the
  // `LossIntuitionUp` (session 99) / `LossBlockUp` (session 112) precedent:
  // modelling a boon type from n=1 has twice required an explicit directive,
  // and an agent deciding it alone is exactly what that precedent forbids.
  //
  // **The pickup is a verified LATENT no-op**, checked against the fixture
  // rather than assumed from the family: `health` {50/30/50/30},
  // `armor` null, and all three of `rock`/`paper`/`scissor` are BYTE-IDENTICAL
  // across the pair; `pickedBoons` grows by exactly one; `selectedVal1` 6,
  // `Rarity` "Rare", `TokenId` 95.
  //
  // ⚠ **Its NAME says "heal on crit" and that is not evidence.** DECISIONS
  // 2026-08-14/15: the effect is never inferred from the name. What is
  // established is the pickup delta (nothing) — the conditional the name
  // gestures at is unobserved, and would need crit-landing exchanges after
  // the pickup to measure. QUESTIONS.md §66.
  "CritHeal",

  // ⭐ [session 114] `BurningTenacity` — FIRST PAIR, from run-2026-08-31-19-12-22
  // state-051 -> state-052 (the room-14 run). Same precedent chain as
  // `CritHeal` above: `LossIntuitionUp` (99), `LossBlockUp` (112), `CritHeal`
  // (113). Modelling a boon type from n=1 has now required an explicit user
  // directive three times, and an agent deciding it alone is what that
  // precedent forbids.
  //
  // **The pickup is a verified LATENT no-op**, checked against the fixture:
  // hp/hpMax/armor/armorMax unchanged, all five ROLLED stats unchanged, and
  // `rock`/`paper`/`scissor` BYTE-IDENTICAL across the pair. `selectedVal1` 8,
  // `selectedVal2` 0, Rarity "Rare", TokenId 119.
  //
  // ⚠ **The name is not evidence** (DECISIONS 2026-08-14/15). It gestures at
  // Burn and at `tenacity`, and BOTH gestures are actively misleading here:
  // `tenacity` as damage mitigation was RULED OUT (§58/§62/§63), and this
  // repo has already had one boon whose name described an effect it does not
  // have. What is established is the pickup delta, which is nothing.
  //
  // ⚠ It is ALSO not to be generalised from `BurnMastery` being solved this
  // session. `BurnMastery` is a status the corpus measures directly; this is a
  // boon whose only observation is a no-op pickup. QUESTIONS.md §69.
  "BurningTenacity",
]);

describe("every modelled boon reproduces its recorded delta", () => {
  for (const p of pickups) {
    it(`${p.picked.boonTypeString} — ${p.run} ${p.label}`, () => {
      const model = BOON_MODELS[p.picked.boonTypeString];
      if (AWAITING_MODEL_DIRECTIVE.has(p.picked.boonTypeString)) {
        // Pin the measurement that IS established, so the gap cannot quietly
        // become a model: latent at pickup, whole-object diff.
        expect(model, `${p.picked.boonTypeString} was modelled without a directive`).toBeUndefined();
        const b = toCombatant(p.before.run.players[0]!);
        const a = toCombatant(p.after.run.players[0]!);
        expect(a.hp).toBe(b.hp);
        expect(a.hpMax).toBe(b.hpMax);
        expect(a.armor).toBe(b.armor);
        expect(a.armorMax).toBe(b.armorMax);
        for (const s of ROLLED) expect(a.rolled[s], s).toBe(b.rolled[s]);
        return;
      }
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
    // [session 108] Minus the types held back for a user directive — see
    // `AWAITING_MODEL_DIRECTIVE`. Subtracting here rather than loosening the
    // equality keeps this assertion exact: an unlisted type with a pair and
    // no model still fails, which is the whole point of it.
    const withPairs = [...new Set(pickups.map((p) => p.picked.boonTypeString))]
      .filter((t) => !AWAITING_MODEL_DIRECTIVE.has(t))
      .sort();
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

describe("LossBlockUp is latent at pickup — modelled from n=1 by directive", () => {
  // [session 112] The regression case every single-pair boon model in this
  // repo carries. The parametrized suite above already asserts that
  // `applyBoon` reproduces the recorded delta; this pins the MEASUREMENT that
  // the directive was granted on, so that if a future pickup shows this boon
  // moving a field, the failure names `LossBlockUp` rather than arriving as a
  // generic model mismatch.
  //
  // QUESTIONS.md §64 is the ask, DECISIONS 2026-08-30 the ruling. n=1: this is
  // the corpus's only pickup of this type.
  it("changes no player field at pickup — and the n=1 directive now HOLDS OUT OF SAMPLE at n=2", () => {
    // ⭐ [session 114] A SECOND pickup arrived (run-2026-08-31-18-38-03
    // state-073 -> state-074) and reproduces the first exactly: same
    // `selectedVal1` 5, same TokenId 116, same latent no-op on every field.
    //
    // This is the first time one of this repo's directive-granted n=1 boon
    // models has been tested against a fresh observation, and it survived.
    // That is evidence about the PRECEDENT as much as about `LossBlockUp`:
    // the `latent` reading was not an artifact of the single pair it was
    // granted on. It does NOT retroactively license modelling the other n=1
    // types without a directive — `CritHeal` and `BurningTenacity` are still
    // held — because what was confirmed is one type's reading, not the
    // inference rule.
    const picks = pickups.filter((p) => p.picked.boonTypeString === "LossBlockUp");
    expect(picks.length, "was n=1 when the directive was granted; a third is new information").toBe(2);
    for (const pick of picks) expect(pick.picked.selectedVal1).toBe(5);

    for (const pick of picks) {
      const before = toCombatant(pick.before.run.players[0]!);
      const after = toCombatant(pick.after.run.players[0]!);
      expect(after.hp).toBe(before.hp);
      expect(after.armor).toBe(before.armor);
      expect(after.hpMax).toBe(before.hpMax);
      expect(after.armorMax).toBe(before.armorMax);
    }
    const pick = picks[0]!;
    const before = toCombatant(pick.before.run.players[0]!);
    const after = toCombatant(pick.after.run.players[0]!);
    for (const s of ROLLED) expect(after.rolled[s], s).toBe(before.rolled[s]);
  });

  it("is modelled latent, and still contaminates — the pickup is known, the loss conditional is not", () => {
    const model = BOON_MODELS.LossBlockUp;
    expect(model, "the directive landed; see DECISIONS 2026-08-30").toBeDefined();
    expect(model!.effect).toEqual({ kind: "latent" });
    // Per DECISIONS 2026-08-15 the name is not evidence. Modelling the pickup
    // must NOT silently score the run after it as if the boon were inert.
    expect(model!.contaminates).toContain("STATUS_EFFECT");
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

  it("has no offer past room 7 — the deepest run cleared room 7 and reached room 8", () => {
    // [session 20, LIVE] Was `toBe(3)` through session 19 — the potion-
    // orchestrator-wiring smoke test cleared room 4 for the first time,
    // producing this corpus's first room-4 offer (see ROOM_ENEMIES' new
    // room-5 entry, src/sim/enemies.ts).
    // [session 42] The resumed juiced Tier-3 run (TASKS.md Task 14 §0)
    // cleared rooms 5 and 6 (first-ever offers at both depths) and died at
    // room 7 — the deepest recorded death yet. `ROOM_ENEMIES` now has
    // room-6/7 entries (this session added both, from the same run's real
    // captured battles), so the room-6 offer is no longer excluded by
    // `boonPickups`'s `room <= 0` guard the way it briefly was mid-session.
    // [session 52] The juiced Tier-3 run CLEARED room 7 (first-ever room-7
    // offer) and died in room 8 — one room deeper than session 42's death.
    // The test's own title is now one room stale in the same way it was
    // before session 42; the invariant it encodes is "offers stop one room
    // short of the deepest death", and that still holds at 7 vs 8.
    // [session 53] Run 2 reached ROOM 10 — the deepest this corpus has gone —
    // clearing rooms 8 and 9 and producing the first-ever offers at both.
    // The title is now two rooms stale; the invariant it encodes ("offers stop
    // one room short of the deepest death") still holds at 9 vs 10.
    // [session 109] Run 2 of the two standalone Tier-1 juiced runs reached
    // ROOM 11, superseding room 10, and produced the first-ever room-10 offer.
    // The title is now four rooms stale; the invariant it encodes ("offers
    // stop one room short of the deepest death") still holds at 10 vs 11.
    //
    // [session 112] The first Tier-2 ENTRY run reached ROOM 13, superseding
    // room 11, and produced the first-ever room-11 AND room-12 offers. The
    // title is now SIX rooms stale; the invariant it encodes ("offers stop one
    // room short of the deepest death") still holds at 12 vs 13.
    //
    // The invariant is not a coincidence — you are offered a reward for
    // CLEARING a room, so the room you die in never yields one. It will keep
    // holding until a run first clears its deepest room, which for a corpus of
    // 85 deaths and 0 clears has never happened.
    // [session 114] 12 -> 13. Run run-2026-08-31-19-12-22 reached ROOM 14, the
    // deepest in this corpus's history across 101 attempts (previous best was
    // session 112's room 13). The invariant this assertion encodes — offers
    // stop exactly one room short of the deepest death — is UNCHANGED and has
    // now held from session 20 through eight successive depth records.
    expect(Math.max(...OBSERVED_OFFERS.map((o) => o.room))).toBe(13);
  });
});

describe("fail-closed on unmodelled types", () => {
  it("leaves the player untouched and flags BOON_UNMODELLED", () => {
    // [session 43] UpgradePaper used to be this test's example — it got its
    // own live pickup pair this session (see BOON_MODELS) and is no longer
    // unmodelled, so the example moved to TieDamageReduction, still genuinely
    // unmodelled (UNMODELLED_TYPES below).
    const before = toCombatant(pickups[0]!.before.run.players[0]!);
    const r = applyBoon(before, { type: "TieDamageReduction", val1: 1, val2: 0 });

    expect(r.model).toBeNull();
    expect(r.reasons).toEqual(["BOON_UNMODELLED"]);
    expect(r.player).toEqual(before);
  });

  it("names the types the corpus offered but never showed the effect of", () => {
    expect(UNMODELLED_TYPES).toEqual([
      // [session 106] ONE moved IN and NONE moved out: `VulnerableTenacity`,
      // offered for the first time in run 4's room-3 offer
      // (`AddMaxArmor(8) | VulnerableTenacity(4) | UpgradeRock(0,4)`) and not
      // picked, so no pair exists to model it from. The list grows 15 -> 16.
      //
      // Worth stating because it is the FIRST new unmodelled type sighted from
      // a Tier-1 entry, and it is evidence the entry tier does not narrow the
      // offer pool: the four runs also OFFERED 6 already-listed unmodelled
      // types across them (run 2 offered 3, run 3 one, run 4 two) at the same
      // sort of rate Tier-3 did. Rule 8 governs which enemy tier is fought and
      // the ENTRY tier governs the payout; neither appears to gate what the
      // reward table can show.
      // [session 103] THREE moved OUT — `BurningEvade`, `BurnMastery` and
      // `ArmorDepletedVulnerable` all got first-ever pickup pairs from this
      // session's four juiced runs, all three LATENT (see `boons.ts`). These
      // were old gaps, not fresh sightings: `BurnMastery` had been on this
      // list since **session 11** — longer than any type ever removed from it,
      // including session 82's TieWeak — and the other two since session 25.
      // `BurningEvade` got TWO pairs in one day, from runs 1 and 4.
      // NONE moved in: 29 offers across four runs produced no type this list
      // did not already carry, so 18 -> 15 is a clean decrement — the same
      // shape as session 99's, unlike sessions 75 and 82 where a new type
      // arrived alongside the ones explained.
      // [session 99 §4] ONE moved OUT: `LossIntuitionUp`, modelled LATENT from
      // its first-ever pickup in run 2 of 2026-08-26 (see `boons.ts`). It had
      // been sighted since session 52 — a room-7 offer, the corpus's first
      // room-7 offer at all — and went 47 sessions without being taken.
      // NONE moved in: the four runs offered no type this list did not
      // already carry, so 19 -> 18 is a clean decrement.
      // [session 82] TWO moved OUT — TieWeak and VulnerableBlock both got
      // first-ever pickup pairs from this session's four juiced runs, both
      // LATENT. TieWeak had been the most-offered unmodelled type on the
      // whole record — 11 offers since session 03 and never once taken — so
      // it had sat at the top of boonCoverage's gap list longer than any
      // other type here, and then landed TWICE in one day (runs 2 and 4).
      // ONE moved IN: LossEvasionUp, a first-ever TYPE that had never
      // appeared in an offer at any depth before run 1, offered and not
      // picked. Net −1 — the same shape session 75 recorded below, where a
      // deeper corpus finds new types about as fast as it explains old ones.
      // [session 75] FOUR moved OUT — AddLifestealShield, CorrosiveSword,
      // AddWeakSword and AddVulnerableShield all got first-ever pickup pairs
      // from this session's four juiced runs, all four LATENT.
      // AddLifestealShield was the most-offered unmodelled type on the record
      // (6 offers since session 03), so this is the largest hole the table has
      // closed in one session.
      // ONE moved IN: `WeakeningEvade`, offered for the first time this session
      // and not picked. The list shrinks by three, not four — a deeper corpus
      // finds new types about as fast as it explains old ones, which is the
      // honest shape of this metric rather than a regression.
      // AddBlock moved OUT — session 08 gave it a live pickup pair, now modelled.
      // UpgradeRock/UpgradeScissor moved OUT — session 09 gave both live
      // pickup pairs (moveDelta), now modelled.
      // AddMaxArmor/CorrosiveShield moved OUT — session 11 gave both live
      // pickup pairs (maxArmor / latent), now modelled.
      // CorrosiveMagic moved OUT — session 14 gave it a live pickup pair
      // (latent, same shape as AddBurnSword/CorrosiveShield), now modelled.
      // AddLifestealMagic/VulnerableEvade moved OUT — session 25's Task 10
      // 2-hour gate run gave both their first live pickup pairs (latent,
      // same shape), now modelled.
      // ArmorDepletedWeak moved OUT — session 42's second manually-started
      // juiced run (Tier-2, silver rings) gave it its first live pickup
      // pair (latent, same shape), now modelled.
      // UpgradePaper moved OUT — session 43's second bot-initiated juiced
      // Tier-3 run gave it its first live pickup pair (moveDelta, the
      // ATK-variant roll), now modelled.
      // [session 62] FIVE moved OUT at once, the largest single-session
      // coverage gain this list has had: AddBurnMagic, AddVulnerableMagic,
      // SecondWind, Vengeance and WeakeningCrit all got their first live
      // pickup pairs from the session's two juiced runs (four via the orb
      // fallback, AddVulnerableMagic via the priority rule). All five are
      // LATENT — measured, not assumed; see `BOON_MODELS`.
      // Note how long some of them waited: SecondWind was first SIGHTED in
      // session 16 and AddBurnMagic in session 12, so a sighting is not a
      // pair and the gap between them can be dozens of sessions.
      // [session 89] THREE moved OUT, and none of them cost a run-unit —
      // WeakeningMastery (session 87's run), AddVulnerableSword and
      // AddBurnShield (session 88's third run) all arrived with their pairs
      // already on disk and were modelled offline, all three LATENT and all
      // three checked by a whole-object diff rather than a field list. NONE
      // moved IN: session 87 and 88 together offered no type this list had
      // never seen, which is the first time in five recorded sessions that a
      // coverage gain was not partly offset. Their waits were the longest yet
      // — AddBurnShield first sighted session 19, AddVulnerableSword session
      // 25, WeakeningMastery session 08.
      // [session 95 §A] TWO moved OUT — `AddWeakMagic` (first sighted session
      // 25, room 1, declined) and `Regen` (first sighted session 82) both got
      // first-ever pickup pairs from session 94's run 4, and both are LATENT.
      // `VulnerableCrit` also gained a pair in that run but never appears in
      // this list at all: its only recorded OFFER arrived in the same batch of
      // 22 rows (§B) that its model landed with, so it was modelled before it
      // was ever unmodelled-and-offered. NONE moved IN — the four runs offered
      // no type this list had never seen, the second such session in a row
      // after sessions 87/88, and the pattern of a coverage gain being partly
      // offset has now not held twice running.
      // [session 109] ONE moved OUT and NONE moved in: `AddLifestealSword` got
      // its first-ever pickup pair (run 1, room 4, taken by the orb fallback)
      // and is modelled LATENT in `boons.ts`. The list shrinks 16 -> 15.
      //
      // It had been on this list since **session 43** — offered again and
      // again and never picked — and it closes the lifesteal triple, joining
      // the already-modelled AddLifestealShield and AddLifestealMagic. That
      // family precedent is what separated it from `LossBlockUp`, which stayed
      // in AWAITING_MODEL_DIRECTIVE precisely because its own siblings
      // (LossEvasionUp/LossLuckUp) are still unmodelled.
      //
      // The two runs offered no type this list had never seen — the third such
      // session in a row after 106 and 108.
      //
      // [session 112b] A SECOND type moved OUT in the same session, and by a
      // DIFFERENT route: `VulnerableTenacity` got its first-ever pickup pair
      // on the room-12 offer of the Tier-2 entry run (taken by BOON PRIORITY
      // 5) and is modelled LATENT. Unlike `LossBlockUp` it needed no user
      // directive — six Vulnerable-family members are already modelled, so it
      // follows the `AddLifestealSword` family precedent above. The list
      // shrinks 14 -> 13.
      //
      // [session 112] ONE moved OUT and NONE moved in: `LossBlockUp` is
      // modelled `latent` by explicit user directive (QUESTIONS.md §64
      // ANSWERED, DECISIONS 2026-08-30), on the `LossIntuitionUp` precedent
      // rather than on a family precedent — its siblings `LossEvasionUp` and
      // `LossLuckUp` are STILL unmodelled and still on this list, which is the
      // asymmetry the session-109 note above describes. The list shrinks
      // 15 -> 14. **No new measurement**: the pickup pair is session 108's,
      // unchanged; what arrived is the directive.
      "AddWeakShield", // session 53: first sighting, live room-3 offer (juiced run 2), not picked // session 11: first sighting, room-1 offer, not picked
      "BurningCrit", // session 52: first sighting, live room-5 offer, not picked
      "BurningTenacity", // session 16: first sighting, live room-1 offer (Task 12 Stage B potion-timing run), not picked // session 20: first sighting, the corpus's first-ever room-4 offer, not picked
      "CritHeal", // session 43: first sighting, live room-2 offer (bot-initiated juiced run 2), not picked
      "IntuitionArmor", // session 24: first sighting, live room-4 offer (Task 10 orchestrator gate run), not picked
      "LossEvasionUp", // session 82: FIRST-EVER TYPE, live room-4 offer on run 1, not picked
      "LossLuckUp", // session 43: first sighting, live room-3 offer (bot-initiated juiced run 2), not picked
      "RegenMastery", // session 53: first sighting, live room-4 offer (juiced run 2), not picked
      "Thorns", // session 52: first sighting, live room-5 offer (juiced run 2), not picked
      "TieDamageReduction",
      "VulnerableMastery", // session 12: first sighting, live room-2 offer, not picked
 // session 106: first sighting, live room-3 offer (Tier-1 juiced run 4), not picked
      "WeakeningBlock",
      "WeakeningEvade", // session 09: first sighting, room-1 offers, not picked
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
    // [session 23] +7 more room-1 offers (3 options each, this session's
    // 9-run live batch). Two contain UpgradeRock (DEF-variant) and two
    // contain UpgradeScissor (DEF-variant) — four more already-known clean
    // picks; every other option is a rolled stat or still-unmodelled.
    // [session 24] +1 more room-1 offer (3 options: AddEvasion/
    // AddLifestealShield/CorrosiveShield — Task 10's orchestrator gate run,
    // stopped early by the user over the potions incident). All three
    // already-known types, none newly clean.
    // [session 25] +10 more room-1 offers (30 options, Task 10's real 2-hour
    // gate run). Three contain the DEF-variant UpgradeScissor — three more
    // already-known clean picks join the set below. Every other option is a
    // rolled stat, a newly-modelled-but-latent type (VulnerableEvade), or
    // still unmodelled (six of them first sightings this session — see
    // UNMODELLED_TYPES above); none of those are newly clean.
    // [session 42] +1 more room-1 offer (3 options: AddLuck/AddBlock/AddLuck
    // — the resumed juiced Tier-3 run's own first reward pick). Neither type
    // is in the clean set, so the clean array is unchanged.
    // [session 42, same session] +1 more room-1 offer (3 options:
    // IntuitionArmor/AddIntuition/TieWeak — the second manually-started
    // juiced run's, Tier-2). None of the three is in the clean set either.
    // [session 43] Modelling UpgradePaper (a live pair from this session's
    // second bot-initiated juiced run, offered at room 4, not room 1) makes
    // EIGHT already-recorded-but-unpicked room-1 UpgradePaper offers clean
    // retroactively — same "modelling a type retroactively cleans past
    // offers" mechanic session 11 first documented for AddMaxArmor. +2 new
    // room-1 offers ALSO landed this session (one from each of the two
    // bot-initiated juiced runs), +6 options, 129 -> 135 — neither new
    // room-1 offer contains a newly-clean type itself (Heal/AddLifestealSword/
    // AddTenacity and AddLuck/AddIntuition/AddMaxArmor — all already-known
    // clean-or-not types), so the retroactive UpgradePaper effect above is
    // the only thing moving the clean set.
    // [session 60] +3: ONE room-1 offer, from the single juiced run this
    // session — AddIntuition / UpgradeScissor(0,6) / WeakeningTenacity(4).
    // One run rather than two because rule 11 now stops the loop after every
    // run for human approval, so the per-session offer yield halved.
    // Note what this one offer did: the wide orb rule PICKED WeakeningTenacity,
    // which had been offered-and-passed since session 52. Two types
    // (WeakeningTenacity, BurningBlock) therefore left UNMODELLED_TYPES above
    // this session — the first time the offered-only list has SHRUNK by two at
    // once, and a direct consequence of choosing boons by orb payout rather
    // than by rank. It is not a wall-1 hole: both are latent, so neither
    // became clean.
    const roomOne = OBSERVED_OFFERS.filter((o) => o.room === 1).flatMap((o) => o.options);
    // [session 52] +6: this session's TWO juiced runs contributed one room-1
    // offer each (AddBlock / AddMaxHealth(14) / AddTenacity, and
    // AddBurnSword / UpgradeRock(8) / AddLuck).
    // [session 53] +6, same shape: one room-1 offer per juiced run
    // (AddLuck / AddMaxArmor / AddLifestealMagic, and
    // AddLifestealMagic / Heal(16) / AddIntuition). Both DO contain an
    // already-clean type — a fourth AddMaxArmor and a fourth Heal — so the
    // clean list below grows by two. This is NOT a sixth wall-1 hole: no type
    // became clean at room 1 that was not already, and `scripts/boonCoverage.ts`
    // now reports that ZERO modelled boons remain unoffered in room 1.
    // [session 61] 150 -> 153: run 24945829 added three room-1 options
    // (UpgradePaper/AddIntuition/AddEvasion). A count, deliberately, not an
    // inequality — unlike the pre-registered rules in matcherVerdict.ts this
    // is a corpus census, and a census that silently grows is how a fixture
    // deletion goes unnoticed. It SHOULD need editing when the corpus grows.
    // [session 62] 153 -> 159: TWO juiced runs this session, one room-1 offer
    // each — WeakeningCrit/AddLuck/AddTenacity (24949925) and
    // SecondWind/LossBlockUp/AddBlock (24949982). Both of the leading types
    // got their FIRST pickup pairs here and are now modelled, but both are
    // LATENT, so neither becomes clean and the clean list below is unchanged.
    // That is the same pattern session 60 recorded for WeakeningTenacity: the
    // orb rule keeps converting offered-only types into modelled ones without
    // converting any of them into CLEAN ones, because what it reaches are
    // status-effect boons.
    // [session 75] 159 -> 171: FOUR juiced runs, twelve room-1 options across
    // them. Same pattern a fourth time — the four types that gained first-ever
    // pickup pairs this session (AddLifestealShield, CorrosiveSword,
    // AddWeakSword, AddVulnerableShield) are ALL LATENT, so the clean list
    // below is again unchanged. Three sessions of this now: what the orb and
    // priority rules reach are status-effect boons, and status-effect boons
    // never become clean.
    // [session 82] 171 -> 183: FOUR juiced runs again, twelve more room-1
    // options. **Fifth session of the same pattern, and it is now worth
    // stating as a claim rather than a tally.** Both types that gained
    // first-ever pickup pairs here (TieWeak, VulnerableBlock) are LATENT, so
    // the clean list below is unchanged for the fourth consecutive session.
    // Every type the orb and priority rules have converted since session 60 —
    // eleven of them — has been a status-effect boon, and a status-effect boon
    // cannot become clean. The clean set is not slowly growing; it is closed
    // under the only mechanism that has been feeding this table.
    // [session 93 §3] 183 -> 195: FOUR juiced runs on 2026-08-24, twelve more
    // room-1 options, landed as part of regenerating this table (see
    // `OBSERVED_OFFERS`' own session-93 note for why the regeneration happened
    // now). **Sixth consecutive session of the same pattern.** The twelve new
    // options are AddLuck/AddBlock/Thorns, AddIntuition/AddTenacity/
    // WeakeningMastery, CorrosiveMagic/AddIntuition/AddBlock and
    // AddBlock/AddLifestealShield/UpgradeRock — every one of them either a
    // status-effect boon or an already-clean type recurring. The clean TYPE
    // set is unchanged for the fifth consecutive session.
    // [session 95 §B] 195 -> 207: FOUR juiced runs on 2026-08-25, twelve more
    // room-1 options, APPENDED (not regenerated) after the additivity check —
    // 22 rows in the corpus and absent from the table, ZERO the other way.
    // **Seventh consecutive session of the same pattern.** The twelve new
    // options are AddBurnShield/SecondWind/AddBlock,
    // AddIntuition/AddEvasion/CorrosiveMagic,
    // AddTenacity/AddIntuition/UpgradeScissor and
    // AddWeakMagic/AddBlock/UpgradePaper. The only two of the twelve that come
    // back clean are `UpgradeScissor` and `UpgradePaper`, both already-clean
    // types recurring — NOT new holes, the session-53/60 distinction.
    // `AddWeakMagic` gained a model this session and it is LATENT, so it does
    // not enter the clean set either. The clean TYPE set is unchanged for the
    // sixth consecutive session, and the claim above — that this table is
    // closed under the only mechanism feeding it — holds again.
    // [session 103] 219 -> 231: FOUR juiced runs on 2026-08-27, twelve more
    // room-1 options, APPENDED (not regenerated) — 29 rows in the corpus and
    // absent from the table, ZERO the other way. The twelve are
    // AddEvasion/AddIntuition/TieVulnerable, AddLifestealShield/AddLuck/
    // AddEvasion, AddTenacity/AddIntuition/AddEvasion and BurningEvade/
    // AddLuck/WeakeningCrit. NONE of the twelve comes back clean: eight are
    // rolled-stat boons (ROLLED_STATS), three are latent (STATUS_EFFECT —
    // `BurningEvade` among them, modelled this session), and `WeakeningCrit`
    // is still unmodelled. So the clean TYPE set is unchanged again and the
    // claim above — that this table is closed under the only mechanism feeding
    // it — holds. No ordinal is attached to that: the two counters this
    // comment already carries ("sixth consecutive session of the same pattern"
    // vs "clean TYPE set unchanged for the fifth/sixth") were both left
    // un-narrated by session 99, so continuing either would be a guess about
    // what that session counted.
    // [session 106] 231 -> 243: +12, exactly the four Tier-1 runs' room-1
    // offers at 3 options each. The clean TYPE set is unchanged again — the
    // twelve are AddEvasion/AddLuck/AddBlock/AddIntuition/TieWeak-family and
    // CorrosiveShield/BurningEvade sightings this table already carries — so
    // the "closed under the only mechanism feeding it" claim holds through a
    // change of ENTRY TIER, which is the first time it has been tested against
    // one. Still no ordinal attached, for the reason the paragraph above gives.
    // [session 108] 243 -> 255: +12 again, and again exactly four runs x 3
    // room-1 options — this time from a single `--runs=4` invocation rather
    // than four separate ones, so the count is the same shape for a different
    // batching. The clean TYPE set is unchanged once more.
    // [session 109] 255 -> 261: +6, exactly two runs x 3 room-1 options. The
    // two runs were separate `--runs=1` invocations under standard rule 11,
    // where session 108's +12 came from one `--runs=4` batch — so the count
    // now scales with RUNS rather than with invocations, which is the same
    // claim session 108 made from the opposite batching.
    // [session 112] 261 -> 264: +3, exactly ONE run x 3 room-1 options, under
    // rule 11's `--runs=1`. Consistent with the per-RUN scaling above at the
    // smallest possible increment, and the first datum for it at a Tier-2
    // ENTRY — the room-1 offer is AddIntuition/Regen/Thorns, all three of them
    // types this table already carries, so the clean TYPE set is unchanged and
    // the "closed under the only mechanism feeding it" claim survives a second
    // change of entry tier.
    // [session 116] 285 -> 288: +3, exactly ONE run x 3 room-1 options, the
    // same smallest-increment shape session 112 recorded and the second datum
    // for per-RUN scaling at a Tier-2 ENTRY. The room-1 offer is
    // UpgradeRock(0,4)/UpgradePaper(6)/TieVulnerable(1); `TieVulnerable` is
    // not clean and was already known not to be, so the clean TYPE set is
    // unchanged (the assertion below) and these are already-clean types
    // RECURRING, not new holes.
    // [session 116, run 2] 288 -> 291: +3 again, the second single-run
    // increment of the same session and the third datum for per-RUN scaling at
    // a Tier-2 entry. The offer is AddBlock(2)/Regen(3)/UpgradeScissor(0,4);
    // `UpgradeScissor` is already clean, so the clean SET is again unchanged.
    expect(roomOne.length).toBe(291);  /* [session 116 run 2] was 288 */  /* [session 116] was 285 */  /* [session 114] was 273 — four new room-1 offers x3 options; the clean SET is unchanged, still the same six types (the assertion below), so this is already-clean types RECURRING, not new holes */  /* [session 113] was 264 */

    const clean: string[] = [];
    for (const option of roomOne) {
      const { reasons } = applyBoon(toCombatant(pickups[0]!.before.run.players[0]!), option);
      if (reasons.length === 0) clean.push(option.type);
      else expect(reasons.length, `${option.type} came back clean`).toBeGreaterThan(0);
    }
    // [session 52] AddMaxHealth enters the room-1 clean list for the first
    // time. It has been in `BOON_MODELS` since session 23 (a room-3 pair), so
    // this is not a new model — it is the first time a room-1 offer has
    // CONTAINED it. Wall 1 gains a fifth hole, same mechanic as session 11's
    // AddMaxArmor and session 43's UpgradePaper.
    // [session 60] +1 `UpgradeScissor` (ninth), from this session's single
    // room-1 offer. An already-clean type appearing again, like session 53's
    // fourth AddMaxArmor and fourth Heal — NOT a sixth hole. The other two
    // options in that offer were AddIntuition (never clean) and
    // WeakeningTenacity, which gained a model this session but a LATENT one,
    // so it cannot join this list.
    // [session 61] +1 `UpgradePaper` (sixth), from run 24945829's room-1
    // offer. Again an already-clean type recurring, NOT a new hole — the
    // other two options were AddIntuition and AddEvasion, neither clean.
    // `TieVulnerable` gained a model this session but a LATENT one, so like
    // WeakeningTenacity it cannot join this list either.
    // [session 75] +1 `UpgradePaper` (tenth) and +1 `UpgradeRock` (seventh),
    // from this session's four runs. Both are already-clean types recurring —
    // NOT new holes, the same distinction sessions 60 and 61 drew. Wall 1
    // still has exactly six clean types, unchanged since session 52, even
    // though the corpus grew by 26 offers and four models.
    // [session 95 §B] +1 `UpgradePaper` (eleventh) and +1 `UpgradeScissor`
    // (ninth), from this session's four appended runs. Both already-clean
    // types recurring — NOT new holes, the same distinction sessions 60, 61,
    // 75 and 93 drew. Wall 1 still has exactly SIX clean types, unchanged
    // since session 52 and now across a corpus that has grown by 48 offers and
    // seven models since.
    // [session 99 §4] +1 `Heal` (fifth), +1 `UpgradePaper` (twelfth) and +1
    // `UpgradeScissor` (tenth), from this session's four juiced runs of
    // 2026-08-26. All three are already-clean types RECURRING — NOT new
    // holes, the same distinction sessions 60, 61, 75, 93 and 95 drew. Wall 1
    // still has exactly SIX clean types, unchanged since session 52 and now
    // across a corpus that has grown by 71 offers since.
    // [session 108] +1 `UpgradeRock` (eighth) and +1 `UpgradeScissor`
    // (eleventh), from this session's four chained Tier-1 runs. Both are
    // already-clean types RECURRING — NOT new holes, the same distinction
    // sessions 60, 61, 75, 93, 95 and 99 drew. Wall 1 still has exactly SIX
    // clean types, unchanged since session 52 across a corpus now grown by
    // 94 offers since.
    // [session 113] +1 `UpgradeRock` (ninth) and +1 `UpgradePaper` (thirteenth),
    // from this session's three Tier-2 runs of 2026-08-31. Both are
    // already-clean types RECURRING — NOT new holes, the same distinction
    // sessions 60, 61, 75, 93, 95, 99 and 108 drew. **Wall 1 still has exactly
    // SIX clean types, unchanged since session 52** across a corpus now grown
    // by 113 offers since. ⚠ Note this pools runs 1-2 and run 3, which are
    // NOT the same arm (a +1 ATK change landed between them) — sound here
    // because a clean-OPTION census is about what the server offered at room
    // 1, which the player's loadout does not enter.
    expect(clean.sort()).toEqual([
      "AddMaxArmor", // [session 82] run 1's room-1 offer carried AddMaxArmor(8) — one more clean OPTION, and the clean TYPE set is still the same six.
      "AddMaxArmor",
      "AddMaxArmor",
      "AddMaxArmor",
      "AddMaxArmor",
      "AddMaxArmor", // [session 114] already-clean type RECURRING — the clean SET is still the same SIX, unchanged since session 52, now over a corpus grown by 33 offers
      "AddMaxHealth",
      "Heal",
      "Heal",
      "Heal",
      "Heal",
      "Heal",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",
      "UpgradePaper",  /* [session 113] +1, thirteenth */
      "UpgradePaper",
      "UpgradePaper", // [session 114] already-clean type RECURRING — the clean SET is still the same SIX, unchanged since session 52, now over a corpus grown by 33 offers
      "UpgradePaper", // [session 116] already-clean type RECURRING from the single Tier-2 run of 2026-09-01 — the clean SET is still the same SIX, unchanged since session 52
      "UpgradeRock",  /* [session 113] +1, ninth */
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock",
      "UpgradeRock", // [session 114] already-clean type RECURRING — the clean SET is still the same SIX, unchanged since session 52, now over a corpus grown by 33 offers
      "UpgradeRock", // [session 116] already-clean type RECURRING from the single Tier-2 run of 2026-09-01 — the clean SET is still the same SIX, unchanged since session 52
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor",
      "UpgradeScissor", // [session 116, run 2] already-clean type RECURRING — the clean SET is still the same SIX, unchanged since session 52
    ]);
  });

  it("Heal, UpgradeScissor, UpgradeRock, AddMaxArmor, AddMaxHealth and UpgradePaper are the only clean boons in the corpus", () => {
    // [session 11] AddMaxArmor joined this session — captured at room 2, not
    // room 1, so it doesn't move the room-1-scoped test above.
    // [session 23] AddMaxHealth joined — captured at room 3, so it doesn't
    // move the room-1-scoped test above either.
    // [session 43] UpgradePaper joined — captured at room 4, so it doesn't
    // move the room-1-scoped test above directly, but DOES retroactively
    // clean eight already-recorded room-1 UpgradePaper offers (see above).
    const clean = Object.entries(BOON_MODELS)
      .filter(([, m]) => m.contaminates.length === 0)
      .map(([t]) => t);
    expect(clean).toEqual(["Heal", "UpgradeScissor", "UpgradeRock", "AddMaxArmor", "AddMaxHealth", "UpgradePaper"]);

    const healRooms = OBSERVED_OFFERS.filter((o) =>
      o.options.some((x) => x.type === "Heal"),
    ).map((o) => o.room);
    // [session 20] +1 room-2 Heal offer (potion-orchestrator-wiring smoke
    // test, Run A) — a second independent room-2 sighting, not new depth.
    // [session 25] +2 room-3 Heal offers (Task 10's real 2-hour gate run) —
    // Heal's first sighting past room 2.
    // [session 42] +1 room-3 Heal offer, val1 50 — the largest Heal value in
    // the corpus to date (the resumed juiced Tier-3 run's third reward pick).
    // [session 43] +1 room-1 Heal offer, val1 50 — the first bot-initiated
    // juiced run's own first reward offer (Heal/AddLifestealSword/
    // AddTenacity, AddTenacity picked — see OBSERVED_OFFERS). Appended at
    // the array's end (insertion order, not sorted), so the new "1" lands
    // last, not with the other two room-1 sightings.
    // [session 53] +1 room-1 Heal offer, val1 16 — run 2's own first reward
    // offer (AddLifestealMagic/Heal(16)/AddIntuition). Appended at the array's
    // end by insertion order, same as session 43's.
    // [session 62] +1 room-2 Heal offer, val1 16 — run 24949982's room-2 reward
    // (UpgradePaper(0,6)/AddIntuition(10)/Heal(16)), and Heal WAS the pick:
    // the orb fallback took it at 25 Hard Core against [19, 19, 25]. Appended
    // at the array's end by insertion order, same as sessions 43 and 53, so
    // the new "2" lands last rather than beside the other twos.
    // [session 75] +2, a room-6 and a room-7 Heal offer — Heal's first
    // sightings past room 3, from the two deepest runs of the session (rooms 9
    // and 8). Neither was picked: BOON-PRIORITY 4 took AddWeakSword over
    // Heal at room 7. Appended at the array's end by insertion order, same as
    // sessions 43, 53 and 62.
    // [session 82] +1 Heal offer at room 4 — run 3's room-4 reward, where the
    // orb fallback took Heal for 27 Hard Core out of [25, 25, 27]. Appended at
    // the array's end by insertion order, same as sessions 43, 53 and 62.
    // [session 95 §B] +1 room 6 — run-2026-08-25-03-25-26/state-085 offered
    // Regen / CorrosiveSword / Heal(50) and the ORB rule took `Regen` for its
    // payout, so this is a Heal OFFER at room 6, not a pickup. Appended at the
    // array's end by insertion order, same as sessions 43, 53, 60 and 93.
    // [session 99 §4] +2 Heal offers from the four juiced runs of 2026-08-26,
    // at rooms 1 and 3. Appended at the array's end by insertion order, same
    // as sessions 43, 53, 60, 61 and 95.
    // [session 103] +3 Heal offers from the four juiced runs of 2026-08-27,
    // at rooms 2, 7 and 4 — two of them from run 2 alone. Appended at the
    // array's end by insertion order, same as sessions 43, 53, 60, 61, 95
    // and 99.
    // [session 112] +2 Heal offers from the single Tier-2 entry run, at rooms
    // 2 and 9 — both `Heal(50)`, and NEITHER was picked (BOON PRIORITY and the
    // orb rule took other options). Room 9 is Heal's second-deepest sighting,
    // behind the two room-7s. Appended at the array's end by insertion order,
    // same as every session since 43.
    // [session 116] +1 Heal offer from the single Tier-2 run of 2026-09-01, at
    // room 8 — `Heal(50)`, Epic. Appended at the array's end by insertion
    // order, same as every session since 43.
    //
    // ⭐ **It was PICKED**, which the two session-112 Heals were not: it is the
    // 8th entry of `pickedBoons` in `run-2026-09-01-22-35-10/state-108`. Room 8
    // is now Heal's second-deepest sighting, between the room-9 offer session
    // 112 recorded and the two room-7s.
    expect(healRooms).toEqual([1, 1, 2, 2, 3, 3, 3, 1, 1, 2, 6, 7, 4, 6, 1, 3, 2, 7, 4, 2, 9, 8]);
  });
});

/**
 * [session 54, brief §5] The room-1 gap is empty and the real untested
 * surface is the opposite one. Modelling stays opportunistic, so what this
 * pins is the RANKING the opportunism is supposed to run off — not a
 * decision to model anything.
 */
describe("boonCoverage ranks the unmodelled gap by what it costs", () => {
  it("detail covers exactly the unmodelled set, sorted by offer frequency", () => {
    const c = boonCoverage();
    expect(c.unmodelledDetail.map((u) => u.type).sort()).toEqual(c.offeredButUnmodelled);
    for (const u of c.unmodelledDetail) {
      expect(u.offers, u.type).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(u.shallowestRoom), u.type).toBe(true);
    }
    const offers = c.unmodelledDetail.map((u) => u.offers);
    expect(offers).toEqual([...offers].sort((a, b) => b - a));
  });

  it("counts a type once per OFFER, not once per option", () => {
    // An offer holding the same type twice must not read as two offers —
    // that would inflate exactly the number the ranking is built on.
    const c = boonCoverage();
    for (const u of c.unmodelledDetail) {
      const containing = OBSERVED_OFFERS.filter((o) => o.options.some((x) => x.type === u.type)).length;
      expect(u.offers, u.type).toBe(containing);
    }
  });

  it("the shallow (rooms 1-3) subset dominates, which is why it has leverage", () => {
    // [session 54] 30 of 36 today. Pinned as a DIRECTION, not a value — this
    // grows with the corpus, and the claim worth failing on is that the
    // unmodelled gap is concentrated where the sim's deepestScorableRoom
    // actually chokes, not that it is exactly 30.
    const c = boonCoverage();
    const shallow = c.unmodelledDetail.filter((u) => u.shallowestRoom <= 3);
    expect(shallow.length).toBeGreaterThan(c.unmodelledDetail.length / 2);
    // The most-offered unmodelled type is a room-1 type — the reason "once
    // every forty runs" undersells this gap.
    expect(c.unmodelledDetail[0]!.shallowestRoom).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// [session 61 §5] Per-run boon coverage — INSTRUMENTATION ONLY.
//
// The brief is explicit: make the "is coverage a reason for the wide orb rule
// or a side effect of it" question answerable, and do NOT decide it. These
// tests pin the recording, and deliberately assert nothing about whether the
// orb rule is good.
// ---------------------------------------------------------------------------

describe("summarizeBoonRunCoverage", () => {
  // [session 95] Was a LIST of unmodelled types; is now a PREDICATE, because
  // deciding unmodelled-ness by list membership undercounted. See the
  // regression test at the end of this block and the module header.
  const UNMOD = ["TieWeak", "AddBurnShield", "Regen"];
  const isModelled = (t: string) => !UNMOD.includes(t);

  it("counts a picked-but-unmodelled type as a first-ever candidate", () => {
    const c = summarizeBoonRunCoverage(["AddMaxHealth", "TieWeak"], ["TieWeak"], isModelled);
    expect(c.unmodelledPicked).toEqual(["TieWeak"]);
    expect(c.firstEverCandidates).toBe(1);
  });

  it("distinguishes OFFERED-unmodelled from PICKED-unmodelled — the pool from the draw", () => {
    // Two unmodelled types on offer, neither taken: the run had the chance and
    // did not convert it. Collapsing these two counts would make a run that
    // never sees an unmodelled boon look the same as one that declines two.
    const c = summarizeBoonRunCoverage(["TieWeak", "Regen", "AddMaxHealth"], ["AddMaxHealth"], isModelled);
    expect(c.unmodelledOffered).toEqual(["Regen", "TieWeak"]);
    expect(c.firstEverCandidates).toBe(0);
  });

  it("collapses duplicates — a type offered in four rooms is one type", () => {
    const c = summarizeBoonRunCoverage(["Regen", "Regen", "Regen"], ["Regen", "Regen"], isModelled);
    expect(c.typesOffered).toEqual(["Regen"]);
    expect(c.typesPicked).toEqual(["Regen"]);
    expect(c.firstEverCandidates).toBe(1);
  });

  it("records the UNMODELLED_TYPES size, which is the 'before' of the before/after pair", () => {
    expect(summarizeBoonRunCoverage([], [], isModelled, UNMOD.length).unmodelledTypesAtRunStart).toBe(3);
    // Against the live list, asserted as a shape rather than a number: the
    // count legitimately falls every time a boon is modelled, and pinning a
    // literal would make ordinary progress fail the suite.
    const live = summarizeBoonRunCoverage([], []);
    expect(live.unmodelledTypesAtRunStart).toBe(UNMODELLED_TYPES.length);
    expect(live.unmodelledTypesAtRunStart).toBeGreaterThan(0);
  });

  it("is empty and harmless on a run that reached no reward phase", () => {
    const c = summarizeBoonRunCoverage([], [], isModelled);
    expect(c).toMatchObject({ typesOffered: [], typesPicked: [], firstEverCandidates: 0 });
  });

  // ─── [session 95 §C1] REGRESSION: the undercount that shipped ────────────
  //
  // Session 94's run 4 printed "2 of them still UNMODELLED" against three
  // real first-ever pickup pairs. The missing one was `VulnerableCrit`, and
  // the reason it was missing is the whole point of this test.

  it("counts a first-ever type the OFFER TABLE has never recorded — the session-94 undercount", () => {
    // Reconstructs the exact shape. At the session-94 handoff commit,
    // `UNMODELLED_TYPES` (derived from OBSERVED_OFFERS) held `AddWeakMagic`
    // and `Regen` but NOT `VulnerableCrit` — the string did not appear
    // anywhere in boons.ts, because its first offer row only arrived with
    // session 95's +22 append. Under the old list-membership logic this run
    // reported 2. All three types genuinely had no model.
    const tableDerivedList = ["AddWeakMagic", "Regen"]; // what UNMODELLED_TYPES could see
    const picked = ["AddWeakMagic", "VulnerableCrit", "Regen"];
    const noneModelled = () => false;

    const wrong = summarizeBoonRunCoverage(picked, picked, (t) => !tableDerivedList.includes(t));
    expect(wrong.firstEverCandidates, "the old list-membership logic").toBe(2);

    const right = summarizeBoonRunCoverage(picked, picked, noneModelled);
    expect(right.firstEverCandidates, "the model predicate").toBe(3);
    expect(right.unmodelledPicked).toEqual(["AddWeakMagic", "Regen", "VulnerableCrit"]);
  });

  it("the live default predicate reads BOON_MODELS, not UNMODELLED_TYPES", () => {
    // The specific defect: a type absent from OBSERVED_OFFERS but genuinely
    // unmodelled must still count. `__NeverOfferedNeverModelled__` is in
    // neither table, which is precisely `VulnerableCrit`'s position on
    // 2026-08-25.
    const c = summarizeBoonRunCoverage([], ["__NeverOfferedNeverModelled__"]);
    expect(UNMODELLED_TYPES).not.toContain("__NeverOfferedNeverModelled__");
    expect(c.firstEverCandidates).toBe(1);

    // And the converse, so the predicate is not just "always true": a type
    // that IS modelled must not be counted, whether or not it is in the
    // offer table. `Regen` is modelled as of session 95.
    expect(summarizeBoonRunCoverage([], ["Regen"]).firstEverCandidates).toBe(0);
  });
});
