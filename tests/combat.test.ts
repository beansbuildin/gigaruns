/**
 * tests/combat.test.ts — the clean exchange model, including the worked
 * examples recorded in SPEC §4 and the rejected model it must diverge from.
 */

import { describe, expect, it } from "vitest";

import {
  chargesAfterPlay,
  chargesAfterRest,
  compare,
  enterRoom,
  legalMoves,
  maxRestore,
  netDamageOnTie,
  netDamageOnWin,
  resolveExchange,
  stallsOnTie,
} from "../src/sim/combat.js";
import { bestKnownProfile, PLAYER } from "../src/sim/enemies.js";
import { cloneCombatant, MOVES, type BattleState, type Combatant } from "../src/sim/types.js";

const roomEnemy = (room: number) => cloneCombatant(bestKnownProfile(room)!.enemy);
const e63 = () => roomEnemy(1);
const me = () => cloneCombatant(PLAYER);

describe("compare — rock > scissor > paper > rock", () => {
  it("resolves the cycle", () => {
    expect(compare("rock", "scissor")).toBe(1);
    expect(compare("scissor", "paper")).toBe(1);
    expect(compare("paper", "rock")).toBe(1);
    expect(compare("scissor", "rock")).toBe(-1);
    expect(compare("paper", "scissor")).toBe(-1);
    expect(compare("rock", "paper")).toBe(-1);
  });

  it("ties on identical moves", () => {
    for (const m of MOVES) expect(compare(m, m)).toBe(0);
  });
});

describe("resolveExchange", () => {
  it("reproduces the recorded Spell-vs-Spell tie from SPEC §4 (state 003→004)", () => {
    // Both sides regenerate their own Spell DEF, then both deal full ATK.
    const state: BattleState = {
      me: { ...me(), hp: 31, armor: 0 },
      foe: { ...e63(), hp: 22, armor: 2 },
      room: 1,
    };
    const { state: next, outcome } = resolveExchange(state, "scissor", "scissor");

    expect(outcome).toBe(0);
    // me: armor 0 +8 = 8, then -16 -> armor 0, 8 overflow, HP 31 -> 23
    expect(next.me.armor).toBe(0);
    expect(next.me.hp).toBe(23);
    // foe: armor 2 +4 = 6, then -12 -> armor 0, 6 overflow, HP 22 -> 16
    expect(next.foe.armor).toBe(0);
    expect(next.foe.hp).toBe(16);
  });

  it("gives the loser nothing: no regen, no damage", () => {
    const state: BattleState = { me: { ...me(), hp: 31, armor: 0 }, foe: e63(), room: 1 };
    // Shield loses to Spell. We regenerate nothing despite Shield's DEF 12.
    const { state: next, outcome } = resolveExchange(state, "paper", "scissor");

    expect(outcome).toBe(-1);
    expect(next.me.armor).toBe(0);
    expect(next.me.hp).toBe(31 - 16);
    // The enemy won with Spell: regen its own DEF 4, take nothing.
    expect(next.foe.armor).toBe(Math.min(e63().armorMax, e63().armor + 4));
    expect(next.foe.hp).toBe(e63().hp);
  });

  it("regenerates on ANY winning move, not just Shield — the branch that kills the rejected model", () => {
    // Winning with Spell (DEF 8) must restore 8. The superseded model restored 0.
    const state: BattleState = {
      me: { ...me(), armor: 4 },
      foe: { ...e63(), charges: 3 } as Combatant,
      room: 1,
    };
    const { state: next } = resolveExchange(state, "scissor", "paper"); // Spell beats Shield
    expect(next.me.armor).toBe(12); // 4 + 8, well under the cap of 15
  });

  it("wastes armor regenerated above the cap", () => {
    // Asserted against the loadout's own cap, not a literal: the user's gear
    // changes between sessions (armorMax went 15 -> 16 in session 06) and the
    // claim under test is "excess regen is wasted", not any particular ceiling.
    const start = { ...me(), armor: me().armorMax - 2 };
    const state: BattleState = { me: start, foe: e63(), room: 1 };
    const { state: next } = resolveExchange(state, "scissor", "paper"); // win, DEF 8
    expect(next.me.armor).toBe(me().armorMax); // capped, not armorMax - 2 + 8
  });

  it("overflows armor into HP within the same exchange", () => {
    const state: BattleState = { me: { ...me(), hp: 20, armor: 4 }, foe: e63(), room: 1 };
    // Sword loses to Shield? No — Shield beats Sword. Enemy Shield ATK is 8.
    const { state: next, outcome } = resolveExchange(state, "rock", "paper");
    expect(outcome).toBe(-1);
    // armor 4 (no regen, we lost) - 8 -> 0 armor, 4 overflow
    expect(next.me.armor).toBe(0);
    expect(next.me.hp).toBe(16);
  });

  it("floors HP at zero rather than reporting negative", () => {
    const state: BattleState = { me: { ...me(), hp: 3, armor: 0 }, foe: e63(), room: 1 };
    const { state: next } = resolveExchange(state, "paper", "scissor"); // take 16
    expect(next.me.hp).toBe(0);
  });

  it("is pure — the input state is not mutated", () => {
    const state: BattleState = { me: { ...me(), hp: 31, armor: 0 }, foe: e63(), room: 1 };
    const before = JSON.stringify(state);
    resolveExchange(state, "rock", "scissor");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("charges", () => {
  it("costs -1 per play, except from exactly 1 which lands on -1", () => {
    expect(chargesAfterPlay(3)).toBe(2);
    expect(chargesAfterPlay(2)).toBe(1);
    expect(chargesAfterPlay(1)).toBe(-1); // skips 0 — the last-charge rule
    expect(chargesAfterPlay(0)).toBe(-1);
    expect(chargesAfterPlay(-1)).toBe(-2);
  });

  it("regenerates unplayed moves by +1, capped at max, never above", () => {
    expect(chargesAfterRest(2, 3)).toBe(3);
    expect(chargesAfterRest(3, 3)).toBe(3);
    expect(chargesAfterRest(-1, 3)).toBe(0);
  });

  it("applies both rules across one exchange", () => {
    const state: BattleState = {
      me: { ...me(), moves: { ...me().moves } },
      foe: e63(),
      room: 1,
    };
    state.me.moves.rock.charges = 1;
    state.me.moves.paper.charges = 2;
    state.me.moves.scissor.charges = 3;

    const { state: next } = resolveExchange(state, "rock", "rock");
    expect(next.me.moves.rock.charges).toBe(-1); // played from 1
    expect(next.me.moves.paper.charges).toBe(3); // rested, +1
    expect(next.me.moves.scissor.charges).toBe(3); // rested, already at max
  });

  it("prunes non-positive moves only when chargesAreHardLimit is set", () => {
    const c = me();
    c.moves.rock.charges = 0;
    c.moves.paper.charges = -1;
    expect(legalMoves(c, true)).toEqual(["scissor"]);
    expect(legalMoves(c, false)).toEqual(["rock", "paper", "scissor"]);
  });

  it("returns an empty legal set rather than inventing a fallback", () => {
    const c = me();
    for (const m of MOVES) c.moves[m].charges = 0;
    expect(legalMoves(c, true)).toEqual([]);
  });
});

describe("net damage against restoring armor — session-04 brief §1, corrected", () => {
  it("lands FULL ATK on an outright win, because the loser regenerates nothing", () => {
    // The brief proposed `max(0, ATK - armorRestoredPerWin)` for every
    // exchange. On a win that offset does not exist.
    const state: BattleState = { me: me(), foe: { ...e63(), armor: 0 }, room: 1 };
    const { state: next } = resolveExchange(state, "paper", "rock"); // Shield beats Sword
    expect(next.foe.armor).toBe(0); // loser regenerates nothing
    expect(next.foe.hp).toBe(e63().hp - PLAYER.moves.paper.atk); // full 6 lands
    expect(netDamageOnWin(PLAYER.moves.paper.atk)).toBe(6);
  });

  it("offsets damage by the opponent's move DEF on a TIE — the real threshold", () => {
    expect(netDamageOnTie(6, 8)).toBe(0); // our Shield vs enemy 66's Shield (8/8)
    expect(netDamageOnTie(6, 2)).toBe(4); // our Shield vs enemy 63's Shield (8/2)
    expect(netDamageOnTie(16, 4)).toBe(12);
  });

  it("is a threshold, not a gradient: 6 ATK is worth 0% of 8 ATK against DEF 6, not 75%", () => {
    expect(netDamageOnTie(6, 6)).toBe(0);
    expect(netDamageOnTie(8, 6)).toBe(2);
    // The §4b term `w2 * enemyHP/enemyMaxHP` cannot express this gap.
  });

  it("makes literally zero progress in a stalling tie loop, forever", () => {
    // Our Shield (6/12) mirrored against enemy 66's Shield (8/8).
    let state: BattleState = { me: me(), foe: roomEnemy(4), room: 4 };
    const startHp = state.foe.hp;
    expect(stallsOnTie(PLAYER.moves.paper.atk, state.foe.moves.paper.def)).toBe(true);

    for (let i = 0; i < 50; i++) {
      // Refresh charges so the loop tests the armor threshold, not charge decay.
      for (const m of MOVES) {
        state.me.moves[m].charges = 3;
        state.foe.moves[m].charges = 3;
      }
      state = resolveExchange(state, "paper", "paper").state;
    }
    expect(state.foe.hp).toBe(startHp); // never moved
    expect(state.foe.armor).toBeGreaterThan(0); // armor never broke either
  });

  it("does NOT stall when the opponent's regen is below our ATK", () => {
    // Enemy 63's Shield is 8/2 — our Shield's 6 clears the 2 and progresses.
    expect(stallsOnTie(PLAYER.moves.paper.atk, e63().moves.paper.def)).toBe(false);
    expect(maxRestore(e63())).toBe(6); // its Sword DEF, not "restores to full 12"
  });
});

describe("room transition", () => {
  it("carries the player's HP, armor and charges over UNCHANGED", () => {
    // [CORRECTED session 04] Session 03 claimed armor refills to currentMax.
    // The one informative boundary in the corpus (run-23-29-39 009→010)
    // crossed at ARM 4/15 and stayed at 4/15.
    const carried = { ...me(), hp: 2, armor: 4 };
    carried.moves.paper.charges = 0;

    const next = enterRoom(carried, bestKnownProfile(2)!.enemy, 2);

    expect(next.me.hp).toBe(2);
    expect(next.me.armor).toBe(4);
    expect(next.me.armor).not.toBe(next.me.armorMax);
    expect(next.me.moves.paper.charges).toBe(0);
  });

  it("gives the incoming enemy full pools, because it is a new entity", () => {
    const next = enterRoom(me(), bestKnownProfile(4)!.enemy, 4);
    expect(next.foe.hp).toBe(next.foe.hpMax);
    expect(next.foe.armor).toBe(next.foe.armorMax);
    for (const m of MOVES) {
      expect(next.foe.moves[m].charges).toBe(next.foe.moves[m].maxCharges);
    }
  });
});
