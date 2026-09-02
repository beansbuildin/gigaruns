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
  const newestOpening = () => {
    const runs = loadCorpus().filter((r) => r.states.length > 0);
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
      // [session 106] FIVE new combos from the four juiced runs of 2026-08-28,
      // and — the part that matters — **NOT ONE is a new starting loadout.**
      // All four runs opened on `50/17` with `pickedBoons: []`, byte-identical
      // to session 103 run 4's start, read off each run's OWN `start_run`
      // response rather than inferred from one of them.
      //
      // That is the first positive confirmation of DECISIONS 2026-08-27's
      // ruling that the loadout would HOLD STEADY going forward — the ruling
      // that also made "a new census combo is a SIGNAL to chase" rather than
      // expected drift. The signal was chased and came back clean: every combo
      // below is ordinary mid-run growth off 50/17.
      //
      //   run 2  state-044  50/17 -> 50/25  AddMaxArmor(+8)
      //   run 2  state-076  50/25 -> 50/27  AddMaxArmor(+2)
      //   run 3  state-056  50/17 -> 58/17  AddMaxHealth(+8)
      //   run 3  state-088  58/17 -> 58/27  AddMaxArmor(+10)
      //   run 4  state-070  50/17 -> 50/27  AddMaxArmor(+10)
      //   run 4  state-084  50/27 -> 64/27  AddMaxHealth(+14)
      //
      // ⚠ **`AddMaxArmor` is not a flat +2.** The entries above it were written
      // around +2 pickups (sessions 95, 103); +8 and +10 both appear here. The
      // boon's own `selectedVal1` carries the amount — read it, never assume
      // the size. `AddMaxHealth` shows +8 and +14 the same way.
      //
      // All four runs are ONE ARM (50/17, 3/3 potions, juiced, Tier-1 entry),
      // which is what makes their Hard Core poolable — handoff/log/session-106.md.
      // [session 103] NINE new combos from the four juiced runs of 2026-08-27,
      // and **TWO of them are new starting loadouts** — the first session since
      // 75 where the census caught the account changing under it, and the first
      // ever to catch it changing TWICE in one day:
      //
      //   45/20  runs 1-3's start (was 40/22 on 2026-08-26)
      //   50/17  run 4's start, changed again between runs 3 and 4
      //
      // Both steps trade armor for health, and `src/sim/enemies.ts`'s PLAYER is
      // updated to the newer (50/17, the newest unbooned capture). ⚠ **Runs 1-3
      // and run 4 are therefore not one arm**, and neither group is one arm
      // with 2026-08-26's four runs — the session-75 trap, twice over. Nothing
      // may read depth or Hard Core across those boundaries as a strategy
      // effect.
      //
      // The other seven are ordinary mid-run states, every one accounted for:
      // 50/19 is run 4's start plus AddMaxArmor(+2). 59/20 and 59/22 are run
      // 3's AddMaxHealth(**val1 14** — the largest this table has seen; 45+14)
      // then AddMaxArmor(+2). 53/20 is run 1's AddMaxHealth(+8) off 45/20 with
      // armor untouched.
      //
      // 53/17, 53/19 and 53/22 are one trace in run 2 and it is the corrode
      // mechanic again, described at the top of this block and re-confirmed at
      // the documented size: 45/20 + AddMaxHealth(+8) = 53/20, corrode takes it
      // to 53/17 (**exactly -3**), AddMaxArmor(+2) rebuilds to 53/19, and the 3
      // comes back at the next path choice for 53/22. Session 90 predicted the
      // decrease would land on the corrode amount; on this trace it does, and
      // the restore is visible in the same run.
      // [session 82] ONE new combo from the four juiced runs of 2026-08-23,
      // and it is NOT a new starting loadout: 48/22 is run 4 mid-run, after a
      // single AddMaxHealth took hpMax 40 -> 48 on an unchanged armorMax 22.
      //
      // **The starting loadout is byte-identical to session 75's** — rock
      // 25/8, paper 10/15, scissor 12/8, 40/22, block 10, read off run 1's own
      // `start_run` and diffed against `enemies.ts` before run 2 as the brief
      // required. So unlike session 75, all four runs here are ONE arm and may
      // be read against each other. That is the useful output of this census
      // on a session where nothing drifted: a stated negative, not silence.
      // [session 75] FIVE new combos from the four juiced runs of 2026-08-22,
      // and only ONE of them is a new starting loadout. 40/22 is the user's
      // armor re-spec, stated in chat between runs 3 and 4 and captured from
      // run 4's own `start_run` (armorMax 17 -> 22). The other four are
      // MID-RUN states after AddMaxArmor / AddMaxHealth pickups, the same
      // shape as 34/20 and 36/18 above: 40/21 and 40/27 and 40/30 from runs
      // 1-3 on the OLD 40/17 loadout, and 54/25 / 54/27 / 54/30 / 54/32 after
      // AddMaxHealth took hpMax to 54. 62/32 is run 4's deepest state, two
      // AddMaxHealth and two AddMaxArmor pickups on the NEW loadout.
      //
      // **The re-spec means runs 1-3 and run 4 are not comparable**, and any
      // baseline quoted across that boundary needs re-measuring — which is
      // exactly what this census exists to make visible.
      // [session 90] SIX new combos across sessions 83-89's runs, and — checked
      // rather than assumed — **not one of them is a new starting loadout.**
      // The starting set is unchanged at ten (32/15, 32/16, 34/16, 36/16,
      // 38/16, 38/17, 40/17, 40/22, 42/16, 43/17), 40/22 is still the newest,
      // and NO combo left the list. So this whole batch is one arm and may be
      // read against session 82's, which is the useful output of a census on a
      // session where the loadout did not drift.
      //
      // **Two of the six are DECREASES, and they land exactly on the corrode
      // amount.** 40/19 is 40/22 minus 3 — one `onEnemyWinExchange_corrode`
      // application at the documented amount 3 — and 40/16 is minus 6, two of
      // them within a room. That is the mechanic described at the top of this
      // block reproducing on new data at the right size, which is stronger
      // evidence for the model than the original observation was.
      //
      // The other four are ordinary max pickups on the 40/22 loadout: 40/32
      // (AddMaxArmor), 48/32 and 54/22 and 54/26 (AddMaxHealth, alone or with
      // armor) — the same shape as 34/20 above.
      "32/15", "32/16", "34/16", "34/20", "36/16", "36/18", "36/20", "38/16", "38/17", "40/11", "40/14",
      "40/16",
      "40/17",
      "40/19",
      "40/21",
      "40/22",
      "40/24", // [session 95] mid-run, 1x AddMaxArmor off the 40/22 loadout
      "40/25",
      "40/26", // [session 95] mid-run, 1x AddMaxArmor off the 40/22 loadout
      "40/27",
      "40/28", // [session 95] mid-run, 2x AddMaxArmor off the 40/22 loadout
      "40/30",
      "40/32",
      "42/16", "42/18", "42/26", "43/17", "43/25",
      "45/20", // [session 103] runs 1-3's STARTING loadout
      "48/22",
      "48/32",
      "50/14",
      "50/16",
      "50/17", // [session 103] run 4's STARTING loadout
      "50/19", // [session 103] run 4 mid-run, 1x AddMaxArmor off 50/17
      "50/25", // [session 106] run 2 mid-run, AddMaxArmor(+8) off 50/17
      "50/27", // [session 106] run 2 (50/25 +2) and run 4 (50/17 +10), same combo twice
      "53/17", // [session 103] run 2 mid-run, 53/20 after corrode -3
      "53/19", // [session 103] run 2 mid-run, 53/17 + AddMaxArmor
      "53/20", // [session 103] run 1 mid-run, 1x AddMaxHealth off 45/20
      "53/22", // [session 103] run 2 mid-run, 53/19 with the corrode 3 restored
      "54/17",
      "54/22",
      "54/25",
      "54/26",
      "54/27",
      "54/30",
      "54/32",
      // [session 99] ONE new combo from the four juiced runs of 2026-08-26,
      // and — as in session 82 — it is NOT a new starting loadout. The start
      // is still 40/22, byte-identical to session 75's, so all four runs are
      // one arm. 54/40 is mid-run in `run-2026-08-26-03-27-11`, the room-10
      // run: armorMax 40 is the highest this census has ever recorded, which
      // is what reaching room 10 buys rather than a change in the account.
      "54/40",
      "58/17", // [session 106] run 3 mid-run, AddMaxHealth(+8) off 50/17
      // [session 112] THREE new combos, all from the first Tier-2 ENTRY run
      // (25215982, the room-13 run), and **NOT ONE is a new starting
      // loadout** — it opened on `50/17`, unchanged, so the session-104 user
      // directive's "a new combo is a signal to chase" is NOT triggered.
      // These are ordinary mid-run maxima: 58/25 and 58/33 off 50/17 via
      // AddMaxHealth(+8) then AddMaxArmor, and 72/33 after a second
      // AddMaxHealth(+14).
      //
      // 72 hpMax and 33 armorMax are both the highest this census has ever
      // recorded for HP; 33 sits below session 103's 54/40 on armor. That is
      // what reaching room 13 buys — depth compounding boon pickups — not a
      // change in the account.
      "58/25",
      "58/27", // [session 106] run 3 mid-run, 58/17 + AddMaxArmor(+10)
      "58/33",
      "59/20", // [session 103] run 3 mid-run, AddMaxHealth val1 14 off 45/20
      "59/22", // [session 103] run 3 mid-run, 59/20 + AddMaxArmor
      "62/32",
      "64/27", // [session 106] run 4 mid-run, 50/27 + AddMaxHealth(+14)
      // [session 118, runs 2-4] ONE new combo from the three remaining
      // day-20698 runs, PURELY ADDITIVE: one added, ZERO removed.
      //
      // **Not a new starting loadout.** Runs 3 and 4 each opened on `50/17`
      // with `pickedBoons: []`, read off their OWN state-000, matching run 1
      // and the session 106/116 starts — four runs, one day, one start.
      //
      //   run 3  state-056  hpMax 50 -> 58   AddMaxHealth(8), room 3
      //   run 4  state-074  hpMax 50 -> 58   AddMaxHealth(8), room 5
      //   run 4  state-124  hpMax 58 -> 66   AddMaxHealth(8), room 8  <- 66/17
      //
      // Ordinary stacked AddMaxHealth growth, and unlike run 1 there is NO
      // corrode excursion in either trace — armMax never leaves 17.
      "66/17",
      "72/33", // [session 112] room-13 run, 58/33 + AddMaxHealth(+14)
      // [session 109] SIX new combos, all from run 2 (the deep run that reached
      // room 11), and **NOT ONE is a new starting loadout.** Both runs opened
      // on `50/17` with `pickedBoons: []` — rock 16/0, paper 6/12, scissor 12/8
      // — byte-identical to session 108's four, read off each run's OWN
      // start_run response rather than inferred from the other's.
      //
      // That confirmation is stronger than session 108's and worth the extra
      // sentence. Session 108 noted that chaining had "removed the only window
      // a re-spec could have occurred in"; this session HAD that window — two
      // separate invocations with a user-facing pause between them, which is
      // exactly where rule 11 expects skill points to be allocated — and the
      // loadout still held. DECISIONS 2026-08-27's "holds steady" ruling now
      // has the test it was previously missing. Both runs are ONE ARM.
      //
      // All six are ordinary mid-run states from a single trace, every one
      // accounted for:
      //
      //   state-040  50/17 -> 74/17  AddMaxHealth(**val1 24**)
      //   state-090  74/17 -> 74/14  corrode, exactly -3
      //   state-094  74/14 -> 74/11  corrode again, exactly -3
      //   state-108  74/11 -> 74/13  AddMaxArmor(+2)
      //   state-110  74/13 -> 74/19  +6 restore at the next path choice
      //   state-120  74/19 -> 88/19  AddMaxHealth(+14)
      //
      // ⚠ **AddMaxHealth val1 24 is the largest this table has ever recorded**,
      // beating the 14 session 103 flagged. The warning above stands and just
      // got a bigger example: read `selectedVal1`, never assume the size.
      //
      // The corrode trace re-confirms session 103's reading at a new depth —
      // -3 exactly, twice, and the 6 comes back in one +6 step at the next
      // path choice rather than in two.
      "74/11",
      "74/13",
      "74/14",
      "74/17",
      "74/19",
      // [session 118] TWO new combos from the day-20698 Tier-2 run of
      // 2026-09-02 (run 25289721), and the drift is again PURELY ADDITIVE:
      // two added, ZERO removed, checked against the corpus.
      //
      // **Neither is a new starting loadout.** The run opened on `50/17` with
      // `pickedBoons: []`, byte-identical to the session 106 and 116 starts,
      // read off this run's OWN `start_run` response (state-000) rather than
      // inferred from an earlier one — the session-103 "loadout holds steady"
      // ruling confirmed rather than assumed, for the third session running.
      //
      // Both are fully accounted for by boons this run actually picked, and
      // the trace separates the two mechanics cleanly:
      //
      //   state-024  hpMax  50 -> 74   AddMaxHealth(24) taken in room 2 (+24)
      //   state-106  armMax 17 -> 25   AddMaxArmor(8)  taken in room 8 (+8)
      //   state-114  armMax 25 -> 22   CORRODE shred on an enemy win (-3)
      //   state-120  armMax back to 25 (room boundary)
      //
      // So `74/25` is ordinary AddMaxArmor growth and `74/22` is the
      // session-61/62 corrode mechanic surfacing in this table again, with the
      // same shed-then-restore shape session 108 recorded for `50/14`.
      "74/22",
      "74/25",
      "88/19",
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
