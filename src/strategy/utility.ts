/**
 * src/strategy/utility.ts — SPEC §4b. Score a battle state from our side.
 *
 * Pure. Takes a `BattleState`, returns a number. Every caller of the EV engine
 * bottoms out here, so this is where the asymmetries the corpus proved actually
 * get expressed:
 *
 *   - HP is not renewable in combat; armor is (a won or tied move regenerates
 *     its own DEF). So armor is worth real but strictly less than HP per point.
 *   - Armor does NOT refill at a room boundary (REVERSAL 2026-08-15), so it is a
 *     run-long resource that depletes across all 16 rooms, not a per-room budget
 *     that is free to spend late.
 *   - Enemy armor is scored, because without it a landed hit into a full armor
 *     pool and a whiffed one are the same number, and the §4b stall reads as
 *     neutral instead of as a trap.
 */

import { isDead, type BattleState } from "../sim/types.js";
import type { StrategyConfig } from "./config.js";

/**
 * Room-scaled death penalty. Dying in room 4 forfeits three rooms of invested
 * energy plus everything ahead; dying in room 1 forfeits a fifth of a run.
 *
 * Only the death side scales. Scaling both terminals by one constant would
 * change every utility and no argmax.
 */
export function deathPenalty(room: number, cfg: StrategyConfig): number {
  return cfg.deathValue * (1 + cfg.depthBonus * Math.max(0, room - 1));
}

/**
 * Terminal-aware state value, from our point of view.
 *
 * Mutual death scores as death: a dead player ends the run whatever happened to
 * the enemy, so the room's loot is forfeit either way. The sim can produce this
 * — Sword mirrored at low HP kills both sides on one exchange — and an engine
 * that scored it as a win would walk into it.
 */
export function utility(state: BattleState, cfg: StrategyConfig): number {
  const { me, foe, room } = state;

  if (isDead(me)) return deathPenalty(room, cfg);
  if (isDead(foe)) return cfg.winValue;

  const w = cfg.weights;
  // Both pools normalised by the side's OWN hpMax, so `w.hp > w.armor` means
  // what it reads as: a point of HP is worth more than a point of armor. See
  // config.ts for why normalising armor by armorMax gets this backwards.
  return (
    w.hp * (me.hp / me.hpMax) +
    w.armor * (me.armor / me.hpMax) -
    w.foeHp * (foe.hp / foe.hpMax) -
    w.foeArmor * (foe.armor / foe.hpMax)
  );
}
