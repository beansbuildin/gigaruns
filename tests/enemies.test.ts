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
import { PLAYER, ROOM_ENEMIES } from "../src/sim/enemies.js";
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
    expect(ROOM_ENEMIES.map((p) => p.enemy.id).sort()).toEqual([...sightings.keys()].sort());
  });
});

describe("player loadout matches the fixtures", () => {
  /**
   * Pinned to the NEWEST capture, not a named one. The user changes gear between
   * sessions — `armorMax` was 15 through sessions 03–05 and is 16 as of
   * run-2026-08-14-03-26-57 — so a test pinned to one run keeps passing while
   * the sim quietly models a loadout that no longer exists.
   */
  const newestOpening = () => {
    const runs = loadCorpus().filter((r) => r.states.length > 0);
    return runs[runs.length - 1]!.states[0]!;
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
    expect([...seen].sort()).toEqual(["32/15", "32/16"]);
  });
});

describe("unmodelled annotations match what the corpus actually shows", () => {
  it("marks room 1 clean and rooms 3 and 4 contaminated", () => {
    const byRoom = new Map(ROOM_ENEMIES.map((p) => [p.room, p]));
    expect(byRoom.get(1)!.unmodelled).toEqual([]);
    expect(byRoom.get(2)!.unmodelled).toEqual([]);
    expect(byRoom.get(3)!.unmodelled).toContain("ROLLED_STATS");
    expect(byRoom.get(4)!.unmodelled).toContain("STATUS_EFFECT");
  });

  it("confirms enemy 65 really does carry non-zero rolled stats somewhere in the corpus", () => {
    const runs = loadCorpus();
    const hit = runs
      .flatMap((r) => r.states)
      .find((s) => s.run.players[1]!.id === "Enemy Room 65" && (s.run.players[1]!.block?.current ?? 0) > 0);
    expect(hit, "enemy 65 with non-zero block").toBeDefined();
  });
});
