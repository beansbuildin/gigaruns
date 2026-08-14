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
 * The user's loadout as recorded. HP/armor maxima sit above the base 30/12
 * because of gear, so these are the live values, not the class defaults.
 */
export const PLAYER: Combatant = {
  id: "player",
  hp: 32,
  hpMax: 32,
  armor: 15,
  armorMax: 15,
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
    unmodelled: ["ROLLED_STATS"],
    enemy: {
      id: "Enemy Room 65",
      hp: 38,
      hpMax: 38,
      armor: 15,
      armorMax: 15,
      moves: { rock: mv(10, 5), paper: mv(15, 6), scissor: mv(12, 4) },
      // Innate, not boon-granted — which is why room 3 is unscorable no matter
      // how well boons are modelled. [session 05]
      rolled: rolled({ evasion: 2, block: 2, lck: 1 }),
    },
  },
  {
    room: 4,
    // Observed carrying `statusEffects [{Burn, 3}]`, and the run carried an
    // `activeEnemyBuff` (shatterblade: applies Vulnerable on Sword wins).
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
