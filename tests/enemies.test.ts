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
    expect([...seen].sort()).toEqual([
      "32/15", "32/16", "34/16", "34/20", "36/16", "36/18", "36/20", "38/16", "42/16", "42/18", "42/26", "50/16",
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
    // (pickLowestTier() resolved to Risky, per CLAUDE.md §8's generalized
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
