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
   * point. This records how many distinct loadouts are in there, so gear drift
   * is a visible number instead of a silent bias on every armor fraction the sim
   * reports. Update the count when it changes, and re-measure any baseline you
   * were about to quote from an older session.
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
    expect([...seen].sort()).toEqual([
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
      "32/15", "32/16", "34/16", "34/20", "36/16", "36/18", "36/20", "38/16", "38/17", "40/11", "40/14", "40/17",
      "40/21",
      "40/22", "40/25",
      "40/27",
      "40/30", "42/16", "42/18", "42/26", "43/17", "43/25", "50/16", "54/17",
      "54/25",
      "54/27",
      "54/30",
      "54/32",
      "62/32",
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
