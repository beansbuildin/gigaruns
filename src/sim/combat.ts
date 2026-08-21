/**
 * src/sim/combat.ts — the confirmed clean exchange model. Pure; no I/O.
 *
 * This is the single implementation of the rules verified in
 * `scripts/verifyCombatModel.ts` (128/134 side-updates across four captures).
 * The six misses all involve mechanics outside this model — see
 * `src/sim/coverage.ts`, which refuses to score them rather than approximating.
 *
 * DECISIONS 2026-08-13 (machine-verified):
 *   Sword > Spell > Shield > Sword   (rock > scissor > paper > rock)
 *   WIN or TIE: regenerate armor = YOUR OWN move's DEF, capped at armorMax
 *               (excess wasted), then deal your full ATK.
 *   LOSE:       gain nothing, deal nothing.
 *   Regen resolves BEFORE incoming damage.
 *   Damage depletes armor first, overflow carries to HP in the same exchange.
 */

import {
  MOVES,
  cloneCombatant,
  type BattleState,
  type Combatant,
  type MoveKey,
  type Outcome,
} from "./types.js";
import { corrodeOnEnemyWin } from "./enemyBuffs.js";

/** rock > scissor > paper > rock. */
const BEATS: Record<MoveKey, MoveKey> = {
  rock: "scissor",
  scissor: "paper",
  paper: "rock",
};

export function compare(a: MoveKey, b: MoveKey): Outcome {
  if (a === b) return 0;
  return BEATS[a] === b ? 1 : -1;
}

/**
 * Charge cost of playing a move, from `before` charges.
 *
 * CONFIRMED 2026-08-14 over 134 played moves: -1 per play, **except a play from
 * exactly 1 charge, which lands on -1, skipping 0** (118/134 were -1; all 16
 * exceptions were plays from exactly 1). This is what session 02 recorded as an
 * "unexplained decrement of two".
 */
export function chargesAfterPlay(before: number): number {
  return before === 1 ? -1 : before - 1;
}

/**
 * Charge regeneration for a move that was NOT played: +1, capped at maxCharges.
 * Ticks on combat exchanges only — not on reward/enemy path phases, and not on
 * room transitions (verified: charges cross a room boundary unchanged).
 */
export function chargesAfterRest(before: number, max: number): number {
  return Math.min(max, before + 1);
}

/**
 * Is `move` playable given its charge count?
 *
 * UNRESOLVED — see DECISIONS 2026-08-14. `hardLimit` is the flag the whole
 * question hangs on, threaded rather than baked so the answer can be swapped in
 * without touching the engine. Callers pass it explicitly; there is no default
 * here on purpose.
 */
export function isPlayable(charges: number, hardLimit: boolean): boolean {
  return hardLimit ? charges >= 1 : true;
}

export function legalMoves(c: Combatant, hardLimit: boolean): MoveKey[] {
  const legal = MOVES.filter((m) => isPlayable(c.moves[m].charges, hardLimit));
  // Under a hard limit every move can in principle be locked at once. Nothing
  // in the corpus shows what the server does then, so refuse to invent a rule:
  // callers must handle the empty set (the sim marks the run UNSCORABLE).
  return legal;
}

/**
 * Net damage on an exchange we WIN outright: the full ATK.
 *
 * [CORRECTED session 04] The session-04 brief §1 proposed a single rule,
 * `effective damage = max(0, ATK - armorRestoredPerWin)`, applied to every
 * exchange. That is wrong, and the corpus shows why: **a loser regenerates
 * nothing.** When we win outright the opponent gains no armor on that exchange,
 * so our full ATK lands. The offset only exists when the opponent also
 * regenerates on the same exchange — which means a TIE.
 */
export function netDamageOnWin(atk: number): number {
  return atk;
}

/**
 * Net damage on a TIE, where both sides regenerate before both deal.
 *
 * THIS is the threshold, and it is a real one: on a tie the opponent restores
 * its own move's DEF and then takes our ATK, so a move whose ATK is at or below
 * the opponent's move DEF makes **exactly zero** progress, forever. Our Shield
 * (ATK 6) mirrored against enemy 66's Shield (8/8) is the clean case: the
 * opponent's armor settles at a fixed value and its HP never moves.
 *
 * §4b's smooth `w2 * (enemyHP / enemyMaxHP)` term cannot express this — it
 * scores 6 damage as 75% of 8 damage when one may be worth nothing and the
 * other everything. Task 5 must use this, not raw ATK.
 */
export function netDamageOnTie(atk: number, opponentMoveDef: number): number {
  return Math.max(0, atk - opponentMoveDef);
}

/**
 * True when mirroring `move` against `foeMove` can never reduce the opponent's
 * HP: the tie regenerates at least as much armor as the exchange removes.
 */
export function stallsOnTie(myAtk: number, foeDef: number): boolean {
  return netDamageOnTie(myAtk, foeDef) === 0;
}

/**
 * The most armor an opponent can restore in one exchange — the DEF of its
 * best defensive move. Note this is NOT "restores to full": regen is the
 * played move's DEF, capped at armorMax. Session 03 recorded enemy 63 as
 * "fully restoring 12 armor on any win"; what the corpus actually shows is
 * `6 -> 12` on a Sword win whose DEF is exactly 6, and `12 + 2` capped back to
 * 12 on a Shield tie.
 */
export function maxRestore(c: Combatant): number {
  return Math.max(...MOVES.map((m) => c.moves[m].def));
}

/** One side's post-exchange pools. Regen first, then absorb. */
function applyOutcome(
  side: Combatant,
  move: MoveKey,
  outcome: Outcome,
  incoming: number,
): { hp: number; armor: number } {
  let armor = side.armor;
  let hp = side.hp;

  // Winner and both tie-ers regenerate their own move's DEF. Excess is wasted.
  if (outcome >= 0) {
    armor = Math.min(side.armorMax, armor + side.moves[move].def);
  }

  armor -= incoming;
  if (armor < 0) {
    hp += armor; // overflow carries to HP in the same exchange
    armor = 0;
  }
  // The server reports a dead side as 0, never negative.
  if (hp < 0) hp = 0;

  return { hp, armor };
}

function applyCharges(side: Combatant, played: MoveKey): Combatant {
  const next = cloneCombatant(side);
  for (const m of MOVES) {
    const ms = next.moves[m];
    ms.charges =
      m === played ? chargesAfterPlay(ms.charges) : chargesAfterRest(ms.charges, ms.maxCharges);
  }
  return next;
}

export interface ExchangeResult {
  state: BattleState;
  /** From our point of view: 1 we won, 0 tie, -1 we lost. */
  outcome: Outcome;
  myMove: MoveKey;
  foeMove: MoveKey;
  damageDealt: number;
  damageTaken: number;
  /**
   * Max armor the enemy's corrode buff shredded off the PLAYER this exchange.
   * `0` on every clean exchange, so existing readers see no change.
   */
  corroded: number;
}

/**
 * Resolve one exchange. Pure: returns a new BattleState, mutates nothing.
 *
 * `foeBuff` defaults to `state.foeBuff`, so the caller that already carries the
 * buff on the state (the normal path) needs no change, and a test can override
 * it per exchange. Undefined on both = the clean model, byte for byte.
 */
export function resolveExchange(
  state: BattleState,
  myMove: MoveKey,
  foeMove: MoveKey,
  foeBuff: unknown = state.foeBuff,
): ExchangeResult {
  const outcome = compare(myMove, foeMove);

  // A side deals its full ATK only if it won or tied.
  const damageDealt = outcome >= 0 ? state.me.moves[myMove].atk : 0;
  const damageTaken = outcome <= 0 ? state.foe.moves[foeMove].atk : 0;

  const mePools = applyOutcome(state.me, myMove, outcome, damageTaken);
  const foePools = applyOutcome(state.foe, foeMove, (-outcome) as Outcome, damageDealt);

  const me = applyCharges(state.me, myMove);
  const foe = applyCharges(state.foe, foeMove);
  me.hp = mePools.hp;
  me.armor = mePools.armor;
  foe.hp = foePools.hp;
  foe.armor = foePools.armor;

  // ---- [session 63] CORRODE ------------------------------------------------
  //
  // The enemy's max armor shred, applied AFTER the pools resolve. Ordering is
  // observably free this exchange — corrode needs the enemy to WIN, and the
  // loser regenerates nothing, so the lowered cap cannot bind until the next
  // win or tie — but it is written after rather than before so the exchange's
  // own arithmetic stays the clean model verified at 128/134.
  //
  // Deliberately NOT clamping `me.armor` to the new max: unobserved, see
  // `corrodeOnEnemyWin`'s doc comment. The `Math.min` in `applyOutcome` makes
  // an over-max pool converge down at the next regen rather than persist.
  const corroded = corrodeOnEnemyWin(foeBuff, foeMove, outcome === -1);
  if (corroded > 0) me.armorMax = Math.max(0, me.armorMax - corroded);

  return {
    state: { me, foe, room: state.room, foeBuff: state.foeBuff },
    outcome,
    myMove,
    foeMove,
    damageDealt,
    damageTaken,
    /** Max armor shredded off the player this exchange. 0 on the clean model. */
    corroded,
  };
}

/**
 * Carry the player into the next room against a fresh enemy.
 *
 * [CORRECTED 2026-08-15] The player carries HP, armor and charges across
 * **unchanged**. Session 03's "armor refills to currentMax at every room
 * transition" was drawn from three boundaries where the player was already at
 * the armor cap (15/15), where "refilled" and "unchanged" are the same
 * observation. The one informative boundary in the corpus — run-23-29-39
 * 009->010 — crossed at ARM 4/15 and stayed at 4/15. What refills is the
 * *enemy*, because a room transition swaps in a new entity at full pools.
 */
export function enterRoom(
  player: Combatant,
  freshFoe: Combatant,
  room: number,
  foeBuff?: unknown,
): BattleState {
  // [session 63] `foeBuff` is per-ROOM by default: a new room swaps in a new
  // entity, so an omitted buff clears the previous room's. The exception the
  // wire models separately is `perpetualBuffs`, which persist across rooms —
  // a caller carrying one must pass it in again here rather than rely on it
  // sticking, because nothing in this function knows the difference.
  return { me: cloneCombatant(player), foe: cloneCombatant(freshFoe), room, foeBuff };
}
