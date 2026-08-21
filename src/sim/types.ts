/**
 * src/sim/types.ts — the sim's internal battle representation.
 *
 * Deliberately NOT the wire shape. `src/sim/corpus.ts` adapts recorded
 * `/game/dungeon/state` responses into these types; everything downstream
 * (combat, coverage, strategy) sees only this. Keeping the two apart is what
 * lets the combat model be tested without a fixture and the fixtures be
 * replayed without a network.
 */

export const MOVES = ["rock", "paper", "scissor"] as const;
export type MoveKey = (typeof MOVES)[number];

/** In-game names. The API uses rock/paper/scissor; the UI uses these. */
export const WEAPON: Record<MoveKey, string> = {
  rock: "Sword",
  paper: "Shield",
  scissor: "Spell",
};

export interface MoveState {
  atk: number;
  def: number;
  charges: number;
  maxCharges: number;
}

/**
 * The rolled stats, as named on the wire. Read from `.current`, never
 * `.starting` — `starting` stays 0 even when `current` is 2 (enemy 65).
 *
 * `src/sim/combat.ts` does not read these AT ALL, and that is the point: their
 * effect on damage is unexplained, so any non-zero value makes the surrounding
 * unit UNSCORABLE rather than being quietly approximated. They live on the
 * Combatant so that a boon which grants one produces a real state change we can
 * see, instead of a delta applied to nothing.
 */
export const ROLLED = ["evasion", "block", "lck", "tenacity", "intuition"] as const;
export type RolledStat = (typeof ROLLED)[number];

export type RolledStats = Record<RolledStat, number>;

export const noRolled = (): RolledStats => ({
  evasion: 0,
  block: 0,
  lck: 0,
  tenacity: 0,
  intuition: 0,
});

export const anyRolled = (r: RolledStats): boolean => ROLLED.some((s) => r[s] !== 0);

export interface Combatant {
  id: string;
  hp: number;
  hpMax: number;
  armor: number;
  armorMax: number;
  moves: Record<MoveKey, MoveState>;
  rolled: RolledStats;
}

export interface BattleState {
  /** `players[0]` — us. */
  me: Combatant;
  /** `players[1]` — the enemy. */
  foe: Combatant;
  /** 1-based room number within the run. */
  room: number;
  /**
   * The enemy's active buff, as the wire reports it — `activeEnemyBuff`, or a
   * `perpetualBuffs` entry still in force. OPTIONAL and undefined by default,
   * so every state built before [session 63] behaves exactly as it did.
   *
   * Read by `resolveExchange` for `onEnemyWinExchange_corrode` and NOTHING
   * else. In particular a STAT buff must not be applied from here: the wire
   * already reports buffed stats and applying them again double-counts, which
   * is the whole finding in `enemyBuffs.ts`'s header.
   */
  foeBuff?: unknown;
}

/** 1 = `a` beats `b`, -1 = `b` beats `a`, 0 = tie. */
export type Outcome = -1 | 0 | 1;

export const isDead = (c: Combatant): boolean => c.hp <= 0;

/** Structural clone. Every combat function is pure and returns fresh state. */
export function cloneCombatant(c: Combatant): Combatant {
  return {
    ...c,
    moves: {
      rock: { ...c.moves.rock },
      paper: { ...c.moves.paper },
      scissor: { ...c.moves.scissor },
    },
    rolled: { ...c.rolled },
  };
}
