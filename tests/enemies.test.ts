/**
 * tests/enemies.test.ts — re-derive every profile in src/sim/enemies.ts from
 * the fixtures.
 *
 * The sim is only as trustworthy as its stat block. This test exists so a
 * hand-edited number in `enemies.ts` cannot quietly diverge from the recorded
 * responses it claims to come from.
 */

import { describe, expect, it } from "vitest";

import { loadCorpus, type WireSide } from "../src/sim/corpus.js";
import { lookupEnemy, PLAYER, ROOM_ENEMIES, SAFE_TIER, RISKY_TIER, DANGEROUS_TIER } from "../src/sim/enemies.js";
import { MOVES } from "../src/sim/types.js";

/** First recorded appearance of each enemy, by name. */
function firstSightings(): Map<string, WireSide> {
  const seen = new Map<string, WireSide>();
  for (const run of loadCorpus()) {
    for (const s of run.states) {
      const foe = s.run.players[1]!;
      if (!seen.has(foe.id)) seen.set(foe.id, foe);
    }
  }
  return seen;
}

const sightings = firstSightings();

describe("enemy profiles match the fixtures", () => {
  for (const profile of ROOM_ENEMIES) {
    it(`${profile.enemy.id} (room ${profile.room})`, () => {
      const wire = sightings.get(profile.enemy.id);
      expect(wire, `${profile.enemy.id} never appears in the corpus`).toBeDefined();

      expect(profile.enemy.hpMax).toBe(wire!.health.currentMax);
      expect(profile.enemy.armorMax).toBe(wire!.shield.currentMax);
      for (const m of MOVES) {
        expect(profile.enemy.moves[m].atk, `${m} ATK`).toBe(wire![m].startingATK);
        expect(profile.enemy.moves[m].def, `${m} DEF`).toBe(wire![m].startingDEF);
        expect(profile.enemy.moves[m].maxCharges, `${m} charges`).toBe(wire![m].maxCharges);
      }
    });
  }

  it("covers every enemy the corpus contains, and no invented ones", () => {
    // Multiple (room, tier) entries can share an enemy id now (enemy 64 has
    // three captured tiers) — dedupe before comparing to the corpus's set of
    // distinct enemies.
    const ids = new Set(ROOM_ENEMIES.map((p) => p.enemy.id));
    expect([...ids].sort()).toEqual([...sightings.keys()].sort());
  });

  it("every (room, tier) pair is unique — no duplicate capture of the same encounter", () => {
    const keys = ROOM_ENEMIES.map((p) => `${p.room}:${p.tier}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("player loadout matches the fixtures", () => {
  /**
   * Pinned to the NEWEST capture, not a named one. The user changes gear between
   * sessions — `armorMax` was 15 through sessions 03–05 and is 16 as of
   * run-2026-08-14-03-26-57 — so a test pinned to one run keeps passing while
   * the sim quietly models a loadout that no longer exists.
   *
   * [session 09] "First state of the last directory" broke the moment a
   * fixture directory could start mid-run: `scripts/liveRun.ts` resuming an
   * already-active run (session 09's stranded-run fix) writes its first
   * fixture from wherever the run already was, boons and all, not a fresh
   * room-1 opening. Gear itself only changes BETWEEN sessions, not mid-run,
   * so any state with an empty `pickedBoons` reads the current loadout
   * correctly — this takes the chronologically LAST such state across the
   * whole corpus, not just the last directory's first file.
   */
  /**
   * ⚠ [session 122] **Runs whose opening was taken with BROKEN GEAR, excluded
   * by name. The premise directly above — "gear itself only changes BETWEEN
   * sessions" — is FALSIFIED, and this is the correction.**
   *
   * Gear has DURABILITY, and a piece that reaches 0 stops granting its bonus
   * MID-SESSION, between one run and the next. On day 20700 the four juiced
   * runs opened 50/50, 50/50, 50/50, **45/45**, `pickedBoons: []` on all four.
   *
   * ⚠ It is NOT only `hpMax` that moved — the run-4 opening lost move ATK too:
   *
   *   runs 1-3  rock 26/10  paper 11/17  scissor 12/8  hpMax 50
   *   run 4     rock 16/10  paper  6/17  scissor 12/8  hpMax 45
   *
   * Sword ATK -10, Shield ATK -5, max HP -5, with every DEF and Spell
   * untouched. The `startingATK`/`startingDEF` fields are identical across all
   * four (rock 16/0, paper 6/12, scissor 12/8) — it is the CURRENT values,
   * which carry the gear bonus, that collapsed toward the class base.
   *
   * The cause was chased, not guessed, per the standing rule that a new census
   * combo is a SIGNAL: `GET /gear/instances/{address}` shows **item 640,
   * "Golkan Eradicator Head" (Epic, Forbidden Woods), slot 11, DURABILITY_CID
   * 0** — its body counterpart 641 in slot 12 still reads 48. It wore to 0
   * during run 3, so run 4 opened without its bonuses — **+10 Sword ATK,
   * +5 Shield ATK and +5 max HP**, which is what the run-3-to-run-4 delta
   * gives once it is read off `currentATK` rather than `startingATK`.
   *
   * **[USER 2026-09-05] `PLAYER.hpMax` HOLDS AT 50 and this run is excluded**,
   * because 45 is a transient broken-gear state and the head is to be
   * repaired — the same treatment the fishing rod already gets. Re-pinning to
   * 45 would have made every simulation model a degraded character and then
   * needed reverting on repair.
   *
   * ⚠ **Delete this exclusion when the head is repaired**, and do NOT extend it
   * to a run that merely looks inconvenient. The test of whether an entry
   * belongs here is a gear row at `DURABILITY_CID: 0`, read live — not a
   * surprising number in the census.
   *
   * The attribution is INFERRED from the run-3-to-run-4 delta and item 640
   * being the one equipped piece at 0 durability; the static catalog publishes
   * the item's name and rarity but no stat block, so it is not confirmed
   * directly. Item 50 also reads 0, but it is the superseded "Stone Rod", a
   * FISHING item in slot 8 — not dungeon gear, and not a candidate.
   */
  /**
   * ▸ **[session 123] THE HEAD IS REPAIRED, so this exclusion is DISCHARGED as
   * a live gate and RETAINED only as a record of which run is a degraded
   * arm.** Item 640 read **70** durability at the start of day 20701 — the
   * user repaired it between sessions, which is the exact condition the note
   * above names for lifting this ("Delete this exclusion when the head is
   * repaired"). It is kept in the set rather than removed because the run it
   * names IS still a degraded-arm capture and nothing is served by forgetting
   * that; it simply no longer selects anything, since every later run is
   * newer.
   *
   * ⚠ **A SECOND partial-degradation arm exists from day 20701 and is
   * deliberately NOT added here.** Item 905 (slot 13) stood at 3 with the wear
   * rate measured at exactly −3 per run, so it reached 0 **during** run 2 —
   * predicted in advance for the first time rather than discovered afterwards,
   * and the user chose to run knowing it. Run 2's `state-000` is captured
   * BEFORE that break, so it is a valid clean opening and the selector below
   * may use it; only its later states are partially degraded. Adding the whole
   * run here would throw away a good opening to exclude states this selector
   * never looks at.
   */
  const DEGRADED_GEAR_RUNS = new Set<string>(["run-2026-09-05-17-22-39"]);

  const newestOpening = () => {
    const runs = loadCorpus().filter((r) => r.states.length > 0 && !DEGRADED_GEAR_RUNS.has(r.name));
    const unboonedStates = runs.flatMap((r) => r.states).filter((s) => !(s.run.players[0]!.pickedBoons ?? []).length);
    return unboonedStates[unboonedStates.length - 1]!;
  };

  it("uses the live values, not the class base of HP 30 / armor 12", () => {
    const wire = newestOpening().run.players[0]!;

    expect(PLAYER.hpMax).toBe(wire.health.currentMax);
    expect(PLAYER.armorMax).toBe(wire.shield.currentMax);
    // Gear raises both above the starting values — this is the trap SPEC §3d
    // warns about, asserted so nobody "corrects" these back down to 30/12.
    expect(PLAYER.hpMax).toBeGreaterThan(wire.health.startingMax);
    expect(PLAYER.armorMax).toBeGreaterThan(wire.shield.startingMax);

    for (const m of MOVES) {
      expect(PLAYER.moves[m].atk).toBe(wire[m].currentATK);
      expect(PLAYER.moves[m].def).toBe(wire[m].currentDEF);
    }
  });

  /**
   * Not an assertion that the corpus is consistent — it is NOT, and that is the
   * point. This records how many distinct loadouts are in there, so a loadout
   * change is a visible number instead of a silent bias on every armor fraction
   * the sim reports. Update the count when it changes, and re-measure any
   * baseline you were about to quote from an older session.
   *
   * [session 104, user directive] **The loadout is expected to HOLD STEADY from
   * here.** This census used to be framed as tracking expected "drift"; the
   * account owner has since said the gear is settled, so a new combo appearing
   * is now a SIGNAL to chase — a re-spec the recap must flag — rather than
   * routine noise to record and move past.
   *
   * This does not retroactively repair the historical corpus. Session 103's
   * four runs still straddle two mid-batch re-specs (40/22 -> 45/20 -> 50/17),
   * so runs 1-3 and run 4 are NOT one arm and neither group is one arm with
   * 2026-08-26's runs. That caveat stands on the data already captured.
   */
  it("records how many distinct loadouts the corpus contains", () => {
    const seen = new Set(
      loadCorpus().flatMap((r) =>
        r.states.map((s) => {
          const w = s.run.players[0]!;
          return `${w.health.currentMax}/${w.shield.currentMax}`;
        }),
      ),
    );
    // [session 11] Two new combos: 34/16 is the new starting loadout (hpMax
    // 32→34, a level-up or gear change); 34/20 is 34/16 mid-run AFTER an
    // AddMaxArmor pickup (armorMax 16→20) — a real in-run state, not a
    // fourth distinct starting loadout. See src/sim/enemies.ts's PLAYER doc.
    // [session 13] One new combo: 36/16 is the new starting loadout (hpMax
    // 34→36, armorMax and every move's ATK/DEF unchanged this time).
    // [session 16] Two new combos, both mid-run AFTER an AddMaxArmor pickup
    // (armorMax +2 each), not new starting loadouts, same shape as 34/20
    // above: 36/18 is 36/16 + one pickup (first potion-timing run, room 2);
    // 36/20 is 36/16 + TWO pickups (second run, rooms 1 and 2 both offered
    // AddMaxArmor and both were taken).
    // [session 19] One new combo: 38/16 is the new starting loadout (hpMax
    // 36→38, armorMax and every move's ATK/DEF unchanged — orchestrator
    // live smoke test's own real run).
    // [session 23] Two new combos: 42/16 is the new starting loadout (hpMax
    // 38→42, a real gear re-spec — see src/sim/enemies.ts's PLAYER doc);
    // 50/16 is 42/16 mid-run AFTER an AddMaxHealth pickup (hpMax +8, room 3),
    // not a fifth starting loadout — same shape as 34/20 above.
    // [session 25] Two new combos, both mid-run AFTER an AddMaxArmor pickup
    // from the 42/16 starting loadout (Task 10's real 2-hour gate run, 12
    // dungeon runs): 42/18 is +2 armorMax (three independent runs each took
    // a +2 AddMaxArmor offer); 42/26 is +10 armorMax (one run's room-3 offer
    // was AddMaxArmor val1 10, a bigger roll than any prior sighting).
    // Neither is a new starting loadout.
    // [session 42] Two new combos, from the resumed juiced Tier-3 run
    // (TASKS.md Task 14 §0): 43/17 is the new starting loadout (hpMax
    // 42→43, armorMax 16→17 — see src/sim/enemies.ts's PLAYER doc); 43/25 is
    // 43/17 mid-run AFTER an AddMaxArmor(8) pickup at room 2 (armorMax +8),
    // not a second new starting loadout — same shape as 34/20 above.
    // [session 42, same session] One more new combo, from the user's SECOND
    // manually-started juiced run (Tier-2, silver rings): 38/17 is a THIRD
    // starting loadout captured this session — hpMax dropped 43→38, armorMax
    // stayed at 17. User-confirmed armor re-spec between the two manual
    // starts, not a tier effect — see enemies.ts's PLAYER doc.
    // [session 52] One new combo, from this session's single bot-initiated
    // juiced Tier-3 run: 54/17 is 40/17 mid-run AFTER the room-1
    // AddMaxHealth(14) pickup (hpMax +14, the largest max-HP roll in the
    // corpus), not a new starting loadout — same shape as 34/20 above. The
    // starting loadout is unchanged at 40/17.
    // [session 43] Two new combos, from this session's two bot-initiated
    // juiced Tier-3 runs: 40/17 is the new starting loadout (hpMax 38→40,
    // armorMax unchanged — the user's own manual level-up, see enemies.ts's
    // PLAYER doc); 40/25 is 40/17 mid-run AFTER run 2's room-1 AddMaxArmor(8)
    // pickup (armorMax +8), not a fourth starting loadout — same shape as
    // 34/20 above.
    // [session 61] TWO new combos, and they are the FIRST in this list that
    // are DECREASES rather than increases: 40/14 and 40/11, from run 24945829.
    // Every prior new combo was a starting-loadout change or an AddMaxArmor /
    // AddMaxHealth pickup adding to a max. These subtract.
    //
    // Cause, read off the run's own `tier_choice` rows rather than inferred:
    // the enemy buff **`corrosiveSword` ("Miasmablade")**, effect kind
    // `onEnemyWinExchange_corrode`, **amount 3**, description "Reduces 3 max
    // armor on Sword wins". Two of the four paths taken carried a corrode buff
    // (the fourth was `corrosiveMagic`/"Miasmagem", the Magic analogue). The
    // trace matches exactly: 17 -> 14 at state-032 and 14 -> 11 at state-036,
    // then restored to 17 at the room boundary (state-046) — so it is a
    // WITHIN-ROOM shred, not a permanent loss.
    //
    // **This is a direct and previously unobserved consequence of CLAUDE.md
    // rule 8**, and worth naming as such: `corrosiveSword` carries
    // `minTier: 2`, so it is STRUCTURALLY unreachable under the lowest-tier
    // rule that stood from session 06 to session 56. The flip to highest-tier
    // is what put this mechanic in front of the player for the first time. It
    // is the first MECHANICAL cost of rule 8 anyone has observed, as opposed
    // to a statistical one.
    //
    // [session 62] A THIRD variant and — more useful — the corpus's first
    // NEGATIVE control for the mechanic. Run 24949982 met `corrosiveShield`
    // ("Miasmaguard", `onEnemyWinExchange_corrode`, amount 3, **moveType
    // "paper"**, minTier 2) at room 5. The trace:
    //
    //   state-056  currentMax 17 -> 14   enemy won the exchange with PAPER
    //   state-062  currentMax 14 -> 14   enemy won the exchange with SCISSOR
    //   state-068  currentMax back to 17 (room boundary)
    //
    // The second row is the new evidence. Sessions 61 and 62 between them have
    // three corrode APPLICATIONS, but until this run there had never been an
    // enemy win that should NOT have triggered one — so the `moveType` gate was
    // declared in the payload and never tested against a case that could have
    // falsified it. It now is. That is what makes the mechanic safe to model as
    // "read the buff's own amount and moveType" rather than as a flat shred on
    // any enemy win; see handoff/reports/session-62-comparison.md §2f.
    //
    // This adds no new hp/armor combo — 40/14 was already on the list from
    // session 61, which is why the assertion below is unchanged. The evidence
    // is in the SEQUENCE, not in a new pair of numbers.
    // [session 95] THREE new combos from session 94's four juiced runs of
    // 2026-08-25 — `40/24`, `40/26`, `40/28` — and the drift is PURELY
    // ADDITIVE: three added, ZERO removed, checked against the corpus rather
    // than taken on trust from the handoff note that claimed it.
    //
    // **None of the three is a new starting loadout.** hpMax is 40 in all
    // three, the starting loadout is still 40/22, and every one is armorMax
    // growth mid-run after an `AddMaxArmor` pickup — the same reading as
    // sessions 11, 16 and 82:
    //
    //   run-...-03-14-16  state-022  40/22 -> 40/24  (1x AddMaxArmor)
    //   run-...-03-14-16  state-056  40/24 -> 40/28  (2x AddMaxArmor)
    //   run-...-03-07-57  state-058  40/22 -> 40/26  (1x AddMaxArmor)
    //
    // ⚠ One trace is worth reading twice: `run-...-03-25-26` reaches 40/24 from
    // **40/21**, not 40/22 — that run met a corrode enemy buff, so its armorMax
    // was mid-shred when the AddMaxArmor landed. It contributes no combo the
    // other two runs did not already, but it is the session-61/62 corrode
    // mechanic surfacing in THIS table for the first time.
    // [session 108] ONE new combo from the four chained Tier-1 runs of
    // 2026-08-29 — `50/14` — and the drift is again PURELY ADDITIVE: one
    // added, ZERO removed, checked against the corpus.
    //
    // **It is not a new starting loadout, and it is not a re-spec.** The
    // starting loadout was byte-identical on all four `start_run` responses
    // (rock 16/0, paper 6/12, scissor 12/8), which is what the session-103
    // "loadout holds steady" ruling asks to be confirmed rather than assumed —
    // and chaining the runs removed the only window in which a re-spec could
    // have happened. `50/14` is the session-61/62 CORRODE mechanic again,
    // with the same shape as that section's trace:
    //
    //   state-175  currentMax 17 -> 14   corrode shred on an enemy win
    //   state-183  currentMax back to 17 (room boundary)
    expect([...seen].sort()).toEqual([
      // ⭐ [session 124] +5 combos from the four Tier-2 runs of 2026-09-06:
      // 51/16, 51/25, 51/27, 65/25, 75/27. Census updated ONCE, after the day
      // was fully spent (12/12 run-units), for the session-123 reason below.
      // The new HP values 51/65/75 come from the DEEP rooms run 1 reached —
      // it died in room 14, the deepest in the corpus's history — so these are
      // enemies the bot had never met, not a restatement of known ones.
      // [session 123] The census is updated ONCE, after the day's four runs
      // stopped writing fixtures. An earlier attempt mid-session watched
      // this number move 560 -> 562 between two test invocations: a corpus
      // pin cannot be settled while live runs are still appending to the
      // corpus. Verified PURELY ADDITIVE by multiset diff BOTH WAYS at each
      // step: 8 added then 6 added, 0 removed either time, 76 -> 84 -> 90.
      // All fourteen trace to one cause — `hpMax` 50 -> 51 on repaired gear
      // (see PLAYER's session-123 note) — so these are that base plus its
      // usual AddMaxArmor pickups and mid-run booned states off it.

      "32/15",
      "32/16",
      "34/16",
      "34/20",
      "36/16",
      "36/18",
      "36/20",
      "38/16",
      "38/17",
      "40/11",
      "40/14",
      "40/16",
      "40/17",
      "40/19",
      "40/21",
      "40/22",
      "40/24",
      "40/25",
      "40/26",
      "40/27",
      "40/28",
      "40/30",
      "40/32",
      "42/16",
      "42/18",
      "42/26",
      "43/17",
      "43/25",
      "45/14",
      "45/17",
      "45/20",
      "48/22",
      "48/32",
      // ⭐ [session 129, day 20707] +2 combos from the four Tier-2 runs of
      // 2026-09-12: 50/11 and 50/13. Census updated ONCE, after the day was
      // fully spent (12/12 run-units). The HP 50 is the SAME −1 recorded in
      // `src/sim/enemies.ts` this session (hpMax 51 → 50 on every opening);
      // these are the shredded-armor variants of it.
      "50/11", "50/13",
      "50/14",
      "50/16",
      "50/17",
      "50/19",
      "50/21", // [session 130, day 20708] +2 MID-RUN combos (50/21, 58/14) from the first four Tier-3 runs — starting loadout 50/17 on all four start states, so NOT a re-spec; ADDITIVE, 0 removals
      "50/25",
      "50/27",
      "50/29",
      "50/35",
      "50/37", // [session 133, day 20711]
      "51/11", // [session 125] day-20703
      "51/13", // [session 125] day-20703
      "51/14", // [session 125] day-20703
      "51/16",
      "51/17",
      "51/18",
      "51/19",
      "51/21",
      "51/25",
      "51/26",
      "51/27",
      "51/29",
      "53/17",
      "53/19",
      "53/20",
      "53/22",
      "54/17",
      "54/22",
      "54/25",
      "54/26",
      "54/27",
      "54/30",
      "54/32",
      "54/40",
      "58/14", // [session 130, day 20708] +2 MID-RUN combos (50/21, 58/14) from the first four Tier-3 runs — starting loadout 50/17 on all four start states, so NOT a re-spec; ADDITIVE, 0 removals
      "58/17",
      "58/19", // [session 133, day 20711]
      "58/21", // [session 133, day 20711]
      "58/25",
      "58/27",
      "58/29",
      "58/32",
      "58/33",
      "58/35",
      "59/17",
      "59/19",
      "59/20",
      "59/21", // ⭐ [session 126] +1 combo, and ONLY 1, from the four Tier-2 runs of game day 20704 — against +5 last session. Census updated ONCE, after the run-units were spent.
      "59/22",
      "59/27", // [session 128] +6 combos from day 20705's four Tier-2 runs — ADDITIVE, multiset diff shows 0 removals
      "62/32",
      "64/11", // [session 133, day 20711]
      "64/14", // [session 133, day 20711]
      "64/17",
      "64/25",
      "64/27",
      "65/14",
      "65/16",
      "65/17", // [session 125] day-20703
      "65/19",
      "65/24",
      "65/25",
      "65/27",
      "65/29", // [session 125] day-20703
      "66/17",
      "72/33",
      "73/17", // [session 128, day 20706] +1 combo — ADDITIVE, multiset diff shows 0 removals
      "73/24",
      "73/27",
      "73/29", // [session 125] day-20703
      "74/11",
      "74/13",
      "74/14",
      "74/17",
      "74/19",
      // [session 131, day 20709] +3 combos 74/21, 74/24, 74/27, CHASED to their pickup per the session-104
      // directive — ADDITIVE, multiset diff 3 added / 0 removed. Run 4 (run-2026-09-14-17-12-41) opens 50/17,
      // takes AddMaxArmor(10) -> 27 and then AddMaxHealth(**24**) -> 74/27 at state-084 — a NEW AddMaxHealth
      // size (prior +8, +14). 74/24 (state-134) and 74/21 (state-140) are mid-run armor shred off 74/27,
      // restored to 74/27 by state-146. Not a re-spec: all four openings read 50/17.
      "74/21",
      "74/22",
      "74/24",
      "74/25",
      "74/27",
      "75/16",
      "75/19",
      "75/27",
      "78/27", // [session 133, day 20711]
      // [session 134] session 133's +6 (50/37, 58/19, 58/21, 64/11, 64/14, 78/27) CHASED, all benign pickups:
      //   78/27  run-09-15-17-19-24: 50/17 -AddMaxArmor(10)-> 50/27 -AddMaxHealth(14)-> 64/27 -AddMaxHealth(14)-> 78/27
      //   64/14, 64/11  run-09-15-17-28-04: 50/17 -AddMaxHealth(14)-> 64/17, then mid-run armor shred, back to 64/17
      //   50/37  run-09-15-17-46-40 = session 132's --resume-existing of run 4, so its state-000 is MID-RUN
      //          (50/25, four boons already picked); AddMaxArmor(2) -> 50/27, AddMaxArmor(10) -> 50/37
      //   58/19, 58/21  run-09-16-17-22-55: AddMaxHealth(8) -> 58/17, then two AddMaxArmor picks at selectedVal1 2 (states 108, 122)
      // No re-spec. A resumed run's first capture is not an opening loadout.
      "88/19",
      "89/14",
      "89/17",
    ]);
  });
});

describe("unmodelled annotations match what the corpus actually shows, PER TIER", () => {
  // [session 07] Tier is a property of the encounter (SPEC §3e), not the
  // room or the enemy — session 06's "rooms 3 and 4 are contaminated" was a
  // per-room claim that doesn't survive re-deriving tier from
  // `enemyPathOptions[]`. Room 4's Safe capture is clean; room 3 has no Safe
  // capture at all.
  it("room 1 is clean (no tier choice ever precedes it)", () => {
    expect(lookupEnemy(1, SAFE_TIER)!.unmodelled).toEqual([]);
  });

  it("room 2's Safe capture is clean; Risky and Dangerous are not", () => {
    expect(lookupEnemy(2, SAFE_TIER)!.unmodelled).toEqual([]);
    expect(lookupEnemy(2, RISKY_TIER)!.unmodelled).toContain("ENEMY_BUFF");
    expect(lookupEnemy(2, DANGEROUS_TIER)!.unmodelled).toEqual(
      expect.arrayContaining(["ROLLED_STATS", "ENEMY_BUFF"]),
    );
  });

  it("[session 08, LIVE] room 3's Safe-tier capture exists now and is clean — the gap session 06/07 left open", () => {
    expect(lookupEnemy(3, SAFE_TIER)!.unmodelled).toEqual([]);
    expect(lookupEnemy(3, SAFE_TIER)!.enemy.rolled).toEqual({
      evasion: 0,
      block: 0,
      lck: 0,
      tenacity: 0,
      intuition: 0,
    });
    // The Risky-tier diagnostic capture is unaffected — still there, still dirty.
    expect(lookupEnemy(3, RISKY_TIER)!.unmodelled).toEqual(
      expect.arrayContaining(["ROLLED_STATS", "ENEMY_BUFF"]),
    );
  });

  it("room 4's Safe capture is clean — the Burn seen in that run is the player's own boon, not this profile", () => {
    expect(lookupEnemy(4, SAFE_TIER)!.unmodelled).toEqual([]);
  });

  it("confirms enemy 65 really does carry non-zero rolled stats somewhere in the corpus", () => {
    const runs = loadCorpus();
    const hit = runs
      .flatMap((r) => r.states)
      .find((s) => s.run.players[1]!.id === "Enemy Room 65" && (s.run.players[1]!.block?.current ?? 0) > 0);
    expect(hit, "enemy 65 with non-zero block").toBeDefined();
  });

  it("confirms room 4's Safe-tier battle carries Burn on the enemy but activeEnemyBuff stays null", () => {
    const runs = loadCorpus();
    // Scoped to the three pre-session-11 Safe-tier captures — see the next
    // test for why this can no longer say "every room4 state".
    const safeDirs = ["run-2026-08-14-01-00-08", "run-2026-08-14-22-13-30", "run-2026-08-15-01-53-36"];
    const room4States = runs
      .filter((r) => safeDirs.includes(r.name))
      .flatMap((r) => r.states)
      .filter((s) => s.run.players[1]!.id === "Enemy Room 66");
    expect(room4States.length).toBeGreaterThan(0);
    expect(room4States.some((s) => (s.run.players[1]!.statusEffects?.length ?? 0) > 0)).toBe(true);
    expect(room4States.every((s) => (s.run.activeEnemyBuff ?? null) === null)).toBe(true);
  });

  it("[session 11, LIVE] room 4's RISKY-tier capture carries a real activeEnemyBuff — Withering", () => {
    // No Safe tier was offered for the room-3→4 transition this session
    // (pickLowestTier() — deleted session 57 — resolved to Risky, per the
    // then-current CLAUDE.md §8 generalized
    // rule) — the FIRST room-4 capture at a non-Safe tier, and the first
    // time `activeEnemyBuff` has ever been non-null in this corpus. Logged
    // only, per DECISIONS 2026-08-15's rule against acting on anything but a
    // verified pair — this enemy instance is not added to ROOM_ENEMIES.
    const runs = loadCorpus();
    const withBuff = runs
      .flatMap((r) => r.states)
      .filter((s) => s.run.players[1]!.id === "Enemy Room 66" && (s.run.activeEnemyBuff ?? null) !== null);
    expect(withBuff.length).toBeGreaterThan(0);
    expect((withBuff[0]!.run.activeEnemyBuff as { id: string }).id).toBe("withering");
  });
});
