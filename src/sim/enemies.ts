/**
 * src/sim/enemies.ts — combatant profiles observed in the corpus.
 *
 * Every number here was read off a recorded `/game/dungeon/state` response, not
 * from SPEC. `tests/enemies.test.ts` re-derives them from the fixtures and
 * fails if this file drifts.
 *
 * Rooms 1-4 of Forbidden Woods (dungeon 5, `maxRoom` 16). Enemy names are
 * `"Enemy Room 63"` etc, where 63 is `ENEMY_CID` — NOT the room number
 * (SPEC §3c). Room 5+ has never been reached, so the sim marks any run that
 * gets there DEPTH_BEYOND_CORPUS rather than extrapolating the scaling curve.
 */

import type { Reason } from "./coverage.js";
import { noRolled, type Combatant, type RolledStats } from "./types.js";

const mv = (atk: number, def: number, maxCharges = 3) => ({
  atk,
  def,
  charges: maxCharges,
  maxCharges,
});

/** Rolled stats read from `.current`. `.starting` is 0 even when current is 2. */
const rolled = (r: Partial<RolledStats> = {}): RolledStats => ({ ...noRolled(), ...r });

/**
 * The user's loadout as recorded in the MOST RECENT capture. HP/armor maxima sit
 * above the base 30/12 because of gear, so these are the live values, not the
 * class defaults.
 *
 * **This drifts.** `armorMax` was 15 through sessions 03–05 and is 16 as of
 * run-2026-08-14-03-26-57 — the user changed gear. The corpus therefore contains
 * more than one loadout, and `tests/enemies.test.ts` pins this to the newest
 * one and reports how many distinct loadouts it can see, so the drift is visible
 * rather than silently biasing every armor-fraction number in the sim.
 *
 * Consequence for cross-session comparisons: a baseline measured at armorMax 15
 * is not strictly comparable to one measured at 16. Re-measure both sides of any
 * comparison in the same run rather than quoting a number from an old recap.
 */
export const PLAYER: Combatant = {
  id: "player",
  hp: 32,
  hpMax: 32,
  armor: 16,
  armorMax: 16,
  moves: {
    rock: mv(16, 0), // Sword
    paper: mv(6, 12), // Shield
    scissor: mv(12, 8), // Spell
  },
  // The player starts every run with all rolled stats at zero; the only way
  // they become non-zero is a boon (src/sim/boons.ts).
  rolled: rolled(),
};

export interface EnemyProfile {
  enemy: Combatant;
  /** 1-based room this enemy was observed in. */
  room: number;
  /**
   * Mechanics observed on this enemy that the clean model does not cover. Any
   * battle against it is UNSCORABLE for these reasons — see src/sim/coverage.ts.
   */
  unmodelled: Reason[];
}

export const ROOM_ENEMIES: EnemyProfile[] = [
  {
    room: 1,
    // Clean in every capture: no boons, no status, all rolled stats zero.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 63",
      hp: 30,
      hpMax: 30,
      armor: 12,
      armorMax: 12,
      moves: { rock: mv(12, 6), paper: mv(8, 2), scissor: mv(16, 4) },
      rolled: rolled(),
    },
  },
  {
    room: 2,
    unmodelled: [],
    enemy: {
      id: "Enemy Room 64",
      hp: 35,
      hpMax: 35,
      armor: 14,
      armorMax: 14,
      moves: { rock: mv(14, 7), paper: mv(10, 4), scissor: mv(8, 3) },
      rolled: rolled(),
    },
  },
  {
    room: 3,
    // Observed with evasion 2 / block 2 / lck 1 (read from `.current`;
    // `.starting` is 0). This is the enemy that took 8 damage from a 16-ATK
    // Sword win by a rule nothing explains.
    //
    // [CORRECTED session 06] These stats are NOT innate. `enemyPathOptions[]`
    // carries `rolledEnemyStats` PER TIER, and tier 0 ("Safe") is all zeros
    // while both tier-2 ("Dangerous") options carry non-zero rolls. So this
    // profile is a Dangerous-tier INSTANCE of enemy 65, recorded because the
    // user was picking high tiers — not a property of the enemy. Session 05
    // read it as innate and built "wall 2" of the Task 4.5 analysis on it.
    // A Safe-tier enemy 65 should be clean, and this profile should be split
    // by tier once a Safe capture exists to derive it from.
    unmodelled: ["ROLLED_STATS"],
    enemy: {
      id: "Enemy Room 65",
      hp: 38,
      hpMax: 38,
      armor: 15,
      armorMax: 15,
      moves: { rock: mv(10, 5), paper: mv(15, 6), scissor: mv(12, 4) },
      // Not boon-granted, and — as of session 06 — not innate either: granted
      // by the Dangerous tier the user chose. See the note above.
      rolled: rolled({ evasion: 2, block: 2, lck: 1 }),
    },
  },
  {
    room: 4,
    // Observed carrying `statusEffects [{Burn, 3}]`, and the run carried an
    // `activeEnemyBuff` (shatterblade: applies Vulnerable on Sword wins).
    //
    // [session 06] Same suspicion as room 3: `enemyBuff` is a per-tier field on
    // `enemyPathOptions[]` and is `null` on tier 0, so shatterblade is very
    // likely a Dangerous-tier buff rather than a property of enemy 66. Not
    // corrected in the data, only flagged — no Safe-tier capture of this enemy
    // exists yet, and the rule here is that the recording wins over the theory.
    unmodelled: ["STATUS_EFFECT", "ENEMY_BUFF"],
    enemy: {
      id: "Enemy Room 66",
      hp: 40,
      hpMax: 40,
      armor: 16,
      armorMax: 16,
      moves: { rock: mv(16, 4), paper: mv(8, 8), scissor: mv(14, 4) },
      rolled: rolled(),
    },
  },
];

/** Deepest room the corpus can vouch for. */
export const MAX_OBSERVED_ROOM = ROOM_ENEMIES.length;

/** Forbidden Woods `maxRoom`, from config/discovered.json. */
export const MAX_ROOM = 16;
