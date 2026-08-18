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

import { isDead, MOVES, type BattleState, type Combatant } from "../sim/types.js";
import type { StrategyConfig } from "./config.js";

/**
 * ATK-weighted charge reserve, normalised to [0,1] by its own max (every
 * move sitting at `maxCharges`). CODEXIMPROVE #4 stage 3: charges persist
 * across room transitions the same way HP and armor do (SPEC.md:829), but
 * unlike them a charge's value depends on WHICH move it sits in, so this
 * reuses `decide.ts`'s tie-break weighting rather than counting charges
 * blind. Gated by `cfg.chargeReserveWeight`, default 0 — see config.ts for
 * why this must clear an ablation bar before shipping non-zero.
 */
function chargeReserveFraction(me: Combatant): number {
  let reserve = 0;
  let max = 0;
  for (const m of MOVES) {
    const ms = me.moves[m];
    reserve += Math.max(0, ms.charges) * ms.atk;
    max += ms.maxCharges * ms.atk;
  }
  return max === 0 ? 0 : reserve / max;
}

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
 * that scored it as a win would walk into it. Death is a flat `deathPenalty`
 * with no margin: the run is over, so leftover HP/armor buys nothing.
 *
 * A win is NOT flat. [session 10] `winValue` used to be returned bare, so among
 * winning lines the engine was indifferent between finishing a kill at full HP
 * and finishing it one hit from death — it was scoring THIS battle as if it
 * were the last one, exactly the attrition bug the brief identified: HP that
 * survives a room has option value for the rooms after it, and a flat win
 * score prices that at zero. A win's value is now `winValue + base`, where
 * `base` is the same continuous HP/armor term the non-terminal case uses (the
 * enemy-side terms in it are always zero at a win — the combat model fully
 * depletes armor before HP ever drops, so a dead foe has armor 0 too) — the
 * margin composes smoothly with the ongoing evaluation instead of being a
 * separate constant, and a win still strictly dominates every non-terminal and
 * every loss because `winValue`/`deathPenalty` (±1000) dwarf `base`'s ±~2
 * range.
 */
export function utility(state: BattleState, cfg: StrategyConfig): number {
  const { me, foe, room } = state;

  if (isDead(me)) return deathPenalty(room, cfg);

  const w = cfg.weights;
  // Both pools normalised by the side's OWN hpMax, so `w.hp > w.armor` means
  // what it reads as: a point of HP is worth more than a point of armor. See
  // config.ts for why normalising armor by armorMax gets this backwards.
  const base =
    w.hp * (me.hp / me.hpMax) +
    w.armor * (me.armor / me.hpMax) -
    w.foeHp * (foe.hp / foe.hpMax) -
    w.foeArmor * (foe.armor / foe.hpMax) +
    cfg.chargeReserveWeight * chargeReserveFraction(me);

  if (isDead(foe)) return cfg.winValue + base;
  return base;
}
