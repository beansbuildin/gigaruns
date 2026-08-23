/**
 * tests/corrode.test.ts — [session 63 §2] the corrode mechanic, and the two
 * negative controls the session gate is set on.
 *
 * The model is not asserted from the buff's DESCRIPTION text. It was measured
 * against `fixtures/dungeon-runs/` first — 4 firings on 4 qualifying exchanges,
 * 0 across 52 non-qualifying pairs, all three base ids represented. See
 * `corrodeOnEnemyWin`'s doc comment for the contingency table.
 *
 * TWO of these tests are the gate, and each is aimed at a specific wrong
 * implementation that would otherwise pass everything else:
 *
 *   1. "fires on the enemy's MATCHING move only" fails if the `moveType` gate
 *      is dropped and corrode fires on any enemy win.
 *   2. "reads `amount` off the buff" fails if the shred is hard-coded to 3,
 *      which every corpus observation would otherwise permit — all four live
 *      firings happen to be amount 3, so the corpus alone cannot distinguish
 *      "reads the field" from "always 3". The test supplies amount 5.
 */

import { describe, expect, it } from "vitest";

import { buildBattleState } from "../scripts/liveRun.js";
import { resolveExchange } from "../src/sim/combat.js";
import { CORRODE_KIND, ENEMY_BUFFS, corrodeOnEnemyWin } from "../src/sim/enemyBuffs.js";
import { bestKnownProfile, PLAYER } from "../src/sim/enemies.js";
import { cloneCombatant, type BattleState } from "../src/sim/types.js";

/** A live-shaped buff envelope: an id plus the `effects[]` the wire carries. */
const corrodeBuff = (moveType: string, amount: number, id = "corrosiveSword") => ({
  id,
  effects: [{ kind: CORRODE_KIND, amount, moveType }],
});

const state = (): BattleState => ({
  me: cloneCombatant(PLAYER),
  foe: cloneCombatant(bestKnownProfile(1)!.enemy),
  room: 1,
});

describe("corrodeOnEnemyWin — the model", () => {
  it("fires on the enemy's MATCHING move only", () => {
    const buff = corrodeBuff("rock", 3);
    // The enemy won all three. Only the declared move corrodes.
    expect(corrodeOnEnemyWin(buff, "rock", true)).toBe(3);
    expect(corrodeOnEnemyWin(buff, "paper", true)).toBe(0);
    expect(corrodeOnEnemyWin(buff, "scissor", true)).toBe(0);
  });

  it("fires only when the enemy WON", () => {
    const buff = corrodeBuff("rock", 3);
    expect(corrodeOnEnemyWin(buff, "rock", true)).toBe(3);
    expect(corrodeOnEnemyWin(buff, "rock", false)).toBe(0);
  });

  it("reads `amount` off the buff rather than assuming the corpus's 3", () => {
    expect(corrodeOnEnemyWin(corrodeBuff("rock", 5), "rock", true)).toBe(5);
    expect(corrodeOnEnemyWin(corrodeBuff("rock", 1), "rock", true)).toBe(1);
    expect(corrodeOnEnemyWin(corrodeBuff("rock", 0), "rock", true)).toBe(0);
  });

  it("sums multiple corrode effects on one buff", () => {
    const two = {
      id: "corrosiveSword",
      effects: [
        { kind: CORRODE_KIND, amount: 3, moveType: "rock" },
        { kind: CORRODE_KIND, amount: 2, moveType: "rock" },
      ],
    };
    expect(corrodeOnEnemyWin(two, "rock", true)).toBe(5);
  });

  it("is inert for a null buff, a non-corrode buff, and a nonsense value", () => {
    expect(corrodeOnEnemyWin(null, "rock", true)).toBe(0);
    expect(corrodeOnEnemyWin(undefined, "rock", true)).toBe(0);
    expect(corrodeOnEnemyWin(ENEMY_BUFFS["bloodthirsty"], "rock", true)).toBe(0);
    expect(corrodeOnEnemyWin("corrosiveSword", "rock", true)).toBe(0);
  });

  it("falls back to the stored table when the wire carries no effects[]", () => {
    // The live wire always inlines `effects[]` (verified: run-2026-08-20-20-04-37
    // state-030 carries the full effect array on `activeEnemyBuff`), so this
    // fallback is for id-only inputs — tests and older captures — not the
    // live path. The live path never depends on the table being complete.
    for (const [id, move] of [
      ["corrosiveSword", "rock"],
      ["corrosiveShield", "paper"],
      ["corrosiveMagic", "scissor"],
    ] as const) {
      expect(corrodeOnEnemyWin({ id }, move, true), id).toBe(3);
    }
    expect(corrodeOnEnemyWin({ id: "perpetual_corrosiveSword" }, "rock", true)).toBe(3);
  });

  it("does NOT assume a perpetual twin exists for every corrode id", () => {
    // [session 63] The table is a TRANSCRIPT of the wire, not a symmetry:
    // 24 base ids against 22 perpetual twins, and the two missing twins are
    // exactly the two corrode ids below. `perpetual_corrosiveSword` appears 24
    // times across `fixtures/`; `perpetual_corrosiveShield` and
    // `perpetual_corrosiveMagic` appear ZERO times and are therefore absent
    // rather than inferred (CLAUDE.md rule 1). This test pins that gap so a
    // future reader tidying the table into a neat 3x2 has to justify it with a
    // capture. Should one ever land on the wire, it will arrive with its own
    // `effects[]` inline and be handled correctly on sight — which is why the
    // absence is safe as well as honest.
    //
    // [session 82] **One of them landed, and the prediction held.** Run
    // `25011957` offered `perpetual_corrosiveShield` in room 2 — the first of
    // 4 appearances in `fixtures/`, against zero before. It arrived inline
    // with `{ kind: CORRODE_KIND, amount: 3, moveType: "paper" }`, which is
    // field-for-field the synthetic case written below on a guess in session
    // 63. The assertions are UNCHANGED and still pass: the table entry is
    // still absent, and the buff still classifies correctly without it. That
    // is the point — a capture that licenses completing the table is the same
    // capture showing the entry would add nothing. `perpetual_corrosiveMagic`
    // is still at zero.
    expect(ENEMY_BUFFS["perpetual_corrosiveShield"]).toBeUndefined();
    expect(ENEMY_BUFFS["perpetual_corrosiveMagic"]).toBeUndefined();
    expect(corrodeOnEnemyWin({ id: "perpetual_corrosiveShield" }, "paper", true)).toBe(0);
    // ...but present it as the wire would and it works with no table entry.
    expect(
      corrodeOnEnemyWin(
        { id: "perpetual_corrosiveShield", effects: [{ kind: CORRODE_KIND, amount: 3, moveType: "paper" }] },
        "paper",
        true,
      ),
    ).toBe(3);
  });
});

describe("resolveExchange — corrode in the combat core", () => {
  it("shreds armorMax when the enemy wins with the matching move", () => {
    const s = state();
    const before = s.me.armorMax;
    // Enemy plays rock, we play scissor: rock beats scissor, the enemy wins.
    const r = resolveExchange(s, "scissor", "rock", corrodeBuff("rock", 3));
    expect(r.outcome).toBe(-1);
    expect(r.corroded).toBe(3);
    expect(r.state.me.armorMax).toBe(before - 3);
  });

  it("leaves armorMax alone when the enemy wins on a NON-matching move", () => {
    const s = state();
    const before = s.me.armorMax;
    // Enemy plays paper (buff is rock), we play rock: the enemy still wins.
    const r = resolveExchange(s, "rock", "paper", corrodeBuff("rock", 3));
    expect(r.outcome).toBe(-1);
    expect(r.corroded).toBe(0);
    expect(r.state.me.armorMax).toBe(before);
  });

  it("leaves armorMax alone when we win on the buff's own move", () => {
    const s = state();
    const before = s.me.armorMax;
    // Enemy plays rock (matching), but we play paper and win.
    const r = resolveExchange(s, "paper", "rock", corrodeBuff("rock", 3));
    expect(r.outcome).toBe(1);
    expect(r.corroded).toBe(0);
    expect(r.state.me.armorMax).toBe(before);
  });

  it("reads the amount from the buff in the combat core too", () => {
    const s = state();
    const before = s.me.armorMax;
    const r = resolveExchange(s, "scissor", "rock", corrodeBuff("rock", 5));
    expect(r.corroded).toBe(5);
    expect(r.state.me.armorMax).toBe(before - 5);
  });

  it("takes the buff off the state when no override is passed, and carries it forward", () => {
    const s = { ...state(), foeBuff: corrodeBuff("rock", 3) };
    const r = resolveExchange(s, "scissor", "rock");
    expect(r.corroded).toBe(3);
    // The buff survives into the next state, or a multi-exchange room would
    // corrode exactly once.
    expect(r.state.foeBuff).toBe(s.foeBuff);
  });

  it("accumulates across exchanges within a room, and floors at 0", () => {
    let s: BattleState = { ...state(), foeBuff: corrodeBuff("rock", 3) };
    s.me.armorMax = 7;
    s.me.hp = 500; // survive long enough to corrode past the floor
    for (let i = 0; i < 4; i++) s = resolveExchange(s, "scissor", "rock").state;
    expect(s.me.armorMax).toBe(0);
  });

  it("is byte-identical to the clean model when no buff is present", () => {
    const clean = resolveExchange(state(), "scissor", "rock");
    const buffed = resolveExchange(state(), "scissor", "rock", ENEMY_BUFFS["bloodthirsty"]);
    expect(clean.corroded).toBe(0);
    expect(buffed.state.me).toEqual(clean.state.me);
    expect(buffed.state.foe).toEqual(clean.state.foe);
  });

  it("lowers the cap the player can regen back to — the effect that actually bites", () => {
    // Corrode's whole cost is downstream: the loser regenerates nothing, so
    // the shred cannot bind in the exchange that inflicts it. It shows up at
    // the next win or tie, as a lower ceiling on regen.
    let s: BattleState = { ...state(), foeBuff: corrodeBuff("rock", 3) };
    s.me.armorMax = 10;
    s.me.armor = 0;
    s.me.hp = 500;
    s.me.moves.paper.def = 20; // regen would overshoot; the cap is what binds
    s.foe.moves.paper.atk = 0; // isolate regen from incoming damage
    s = resolveExchange(s, "scissor", "rock").state; // lose to rock, max 10 -> 7
    expect(s.me.armorMax).toBe(7);
    s = resolveExchange(s, "paper", "paper").state; // tie: regen own DEF, capped
    expect(s.me.armor).toBe(7); // capped at the CORRODED max, not the original 10
  });
});

describe("buildBattleState — the live lookahead sees the buff", () => {
  // A minimal wire-shaped run. `toCombatant` reads the shield/health/move
  // blocks; everything else on the real envelope is irrelevant here.
  const side = () => ({
    health: { current: 30, currentMax: 30 },
    shield: { current: 12, currentMax: 12 },
    rock: { currentATK: 10, currentDEF: 5, currentCharges: 1, maxCharges: 1 },
    paper: { currentATK: 10, currentDEF: 5, currentCharges: 1, maxCharges: 1 },
    scissor: { currentATK: 10, currentDEF: 5, currentCharges: 1, maxCharges: 1 },
  });

  it("attaches activeEnemyBuff to the state it hands the decision engine", () => {
    const buff = { id: "corrosiveSword", effects: [{ kind: CORRODE_KIND, amount: 3, moveType: "rock" }] };
    const run = { players: [side(), side()], activeEnemyBuff: buff } as never;
    const st = buildBattleState(run, 3);
    expect(st.foeBuff).toBe(buff);
    // ...and it actually bites through the normal (no-override) call path.
    const r = resolveExchange(st, "scissor", "rock");
    expect(r.corroded).toBe(3);
    expect(r.state.me.armorMax).toBe(9);
  });

  it("leaves foeBuff undefined when the enemy carries none", () => {
    const run = { players: [side(), side()] } as never;
    expect(buildBattleState(run, 1).foeBuff).toBeUndefined();
    expect(resolveExchange(buildBattleState(run, 1), "scissor", "rock").corroded).toBe(0);
  });
});
