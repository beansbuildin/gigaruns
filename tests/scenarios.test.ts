/**
 * tests/scenarios.test.ts — the hand-built state set required by TASKS.md
 * Task 4, and the behaviour each one exists to pin down.
 */

import { describe, expect, it } from "vitest";

import { legalMoves, resolveExchange } from "../src/sim/combat.js";
import { SCENARIOS } from "../src/sim/scenarios.js";
import { isDead, MOVES, type MoveKey } from "../src/sim/types.js";

const byName = new Map(SCENARIOS.map((s) => [s.name, s]));
const get = (name: string) => {
  const s = byName.get(name);
  if (!s) throw new Error(`no scenario ${name}`);
  return s;
};

describe("the scenario set", () => {
  it("has the 20 states Task 4 asks for", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
  });

  it("uses unique names", () => {
    expect(new Set(SCENARIOS.map((s) => s.name)).size).toBe(SCENARIOS.length);
  });

  it("covers every branch Task 4 names", () => {
    const names = SCENARIOS.map((s) => s.name).join(" ");
    expect(names).toMatch(/opening/); // full HP opening
    expect(names).toMatch(/low-hp/); // low HP
    expect(names).toMatch(/enemy-one-hit-from-death/); // enemy one hit from death
    expect(names).toMatch(/self-one-hit-from-death/); // self one hit from death
    expect(names).toMatch(/zero-charge-enemy/); // zero-charge enemy
  });

  it("holds internally consistent states", () => {
    for (const { name, state } of SCENARIOS) {
      for (const side of [state.me, state.foe]) {
        expect(side.hp, name).toBeGreaterThanOrEqual(0);
        expect(side.hp, name).toBeLessThanOrEqual(side.hpMax);
        expect(side.armor, name).toBeGreaterThanOrEqual(0);
        expect(side.armor, name).toBeLessThanOrEqual(side.armorMax);
        for (const m of MOVES) {
          expect(side.moves[m].charges, `${name} ${m}`).toBeLessThanOrEqual(
            side.moves[m].maxCharges,
          );
        }
      }
    }
  });

  it("resolves all nine move pairs from every scenario without throwing", () => {
    for (const { name, state } of SCENARIOS) {
      for (const mine of MOVES) {
        for (const theirs of MOVES) {
          expect(() => resolveExchange(state, mine, theirs), `${name} ${mine}/${theirs}`).not.toThrow();
        }
      }
    }
  });
});

describe("terminal cases", () => {
  it("enemy-one-hit-from-death: any won or tied exchange ends it", () => {
    const { state } = get("enemy-one-hit-from-death");
    expect(state.foe.hp).toBe(1);
    expect(state.foe.armor).toBe(0);

    // Sword beats Spell -> we win -> full 16 lands on a 1 HP, 0 armor enemy.
    expect(isDead(resolveExchange(state, "rock", "scissor").state.foe)).toBe(true);
    // A tie also deals full ATK.
    expect(isDead(resolveExchange(state, "rock", "rock").state.foe)).toBe(true);
    // But losing deals nothing.
    expect(isDead(resolveExchange(state, "scissor", "rock").state.foe)).toBe(false);
  });

  it("enemy-one-hit-but-armored: armor makes 'one hit from death' false", () => {
    const { state } = get("enemy-one-hit-but-armored");
    expect(state.foe.hp).toBe(1);
    // Our biggest hit is 16 against 12 armor: 4 overflows, which is still lethal.
    expect(isDead(resolveExchange(state, "rock", "scissor").state.foe)).toBe(true);
    // Our Shield's 6 does not get through the 12 at all.
    const chip = resolveExchange(state, "paper", "rock").state.foe;
    expect(chip.hp).toBe(1);
    expect(chip.armor).toBe(6);
  });

  it("self-one-hit-from-death: any lost exchange kills us", () => {
    const { state } = get("self-one-hit-from-death");
    expect(state.me.armor).toBe(0);
    for (const [mine, theirs] of [
      ["rock", "paper"],
      ["paper", "scissor"],
      ["scissor", "rock"],
    ] as [MoveKey, MoveKey][]) {
      expect(isDead(resolveExchange(state, mine, theirs).state.me), `${mine}/${theirs}`).toBe(true);
    }
  });

  it("mutual-one-hit-from-death: a tie kills BOTH — never score it as a win", () => {
    const { state } = get("mutual-one-hit-from-death");
    const { state: next } = resolveExchange(state, "rock", "rock");
    expect(isDead(next.me)).toBe(true);
    expect(isDead(next.foe)).toBe(true);
  });
});

describe("charge scenarios", () => {
  it("zero-charge-enemy-spell: a hard limit removes its 16-ATK move", () => {
    const { state } = get("zero-charge-enemy-spell");
    expect(legalMoves(state.foe, true)).toEqual(["rock", "paper"]);
    expect(legalMoves(state.foe, false)).toHaveLength(3);
  });

  it("enemy-two-moves-locked: its move is known exactly under a hard limit", () => {
    const { state } = get("enemy-two-moves-locked");
    expect(legalMoves(state.foe, true)).toEqual(["paper"]);
  });

  it("negative-charge-enemy: below zero is a real state, not a clamp", () => {
    const { state } = get("negative-charge-enemy");
    expect(state.me.moves.rock.charges).toBe(-1);
    // It still regenerates from -1 to 0 when rested.
    const { state: next } = resolveExchange(state, "paper", "scissor");
    expect(next.me.moves.rock.charges).toBe(0);
  });

  it("all-my-moves-locked: yields an empty legal set, never a guessed fallback", () => {
    const { state } = get("all-my-moves-locked");
    expect(legalMoves(state.me, true)).toEqual([]);
  });
});

describe("armor scenarios", () => {
  it("armor-cap-waste: excess regen does not bank", () => {
    const { state } = get("armor-cap-waste");
    // Against the loadout's cap rather than a literal — gear drifts between
    // sessions and the claim is about waste, not about a particular ceiling.
    expect(state.me.armor).toBe(state.me.armorMax - 2);
    const { state: next } = resolveExchange(state, "scissor", "paper"); // win, DEF 8
    expect(next.me.armor).toBe(state.me.armorMax);
  });

  it("overflow-armor-to-hp: absorbed then carried, in one exchange", () => {
    const { state } = get("overflow-armor-to-hp");
    expect(state.me.armor).toBe(4);
    // Spell (enemy, 16 ATK) beats our Shield.
    const { state: next } = resolveExchange(state, "paper", "scissor");
    expect(next.me.armor).toBe(0);
    expect(next.me.hp).toBe(state.me.hp - 12); // 16 - 4 absorbed
  });

  it("the-lost-run-position: our Shield cannot dent enemy 63's HP from here", () => {
    const { state } = get("the-lost-run-position");
    expect(state.foe.hp).toBe(30);
    // Even winning with Shield, the 6 goes into 8 armor and leaves HP untouched.
    const { state: next } = resolveExchange(state, "paper", "rock");
    expect(next.foe.hp).toBe(30);
    expect(next.foe.armor).toBe(2);
  });
});
