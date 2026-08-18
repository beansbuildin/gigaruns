/**
 * tests/strategy.test.ts — Task 5. The EV engine, the opponent model, §4b's
 * utility and §4c's ranking.
 *
 * What is worth defending here is NOT "the win rate is X" — that is the gate,
 * and it lives in `scripts/sim.ts` where it can be reported with its coverage.
 * These tests defend the claims the win rate would otherwise hide:
 *
 *   - the 30-observation floor cannot be talked around
 *   - charge pruning happens, and the distribution still sums to 1
 *   - the tie threshold changes a decision, rather than merely being computed
 *   - SPEC §4b's own worked sanity check picks the move §4b says it must
 *   - nothing in the engine is room-1-specific
 */

import { describe, expect, it } from "vitest";

import { legalMoves, resolveExchange } from "../src/sim/combat.js";
import { bestKnownProfile, PLAYER } from "../src/sim/enemies.js";
import { cloneCombatant, isDead, MOVES, type BattleState, type Combatant } from "../src/sim/types.js";
import { DEFAULT_CONFIG, LIVE_CONFIG, type StrategyConfig } from "../src/strategy/config.js";
import { decide } from "../src/strategy/decide.js";
import { categorise, rankBoons, upgradeTarget } from "../src/strategy/loot.js";
import {
  modelKey,
  OpponentModel,
  SAMPLE_FLOOR,
  MARKOV_FLOOR,
} from "../src/strategy/opponentModel.js";
import { deathPenalty, utility } from "../src/strategy/utility.js";

/** Whichever tier is captured for the room — rooms 1/2/4 are Safe, room 3 is Risky. */
const enemy = (room: number): Combatant => cloneCombatant(bestKnownProfile(room)!.enemy);

const state = (over: Partial<Combatant> = {}, room = 1, foeOver: Partial<Combatant> = {}): BattleState => ({
  me: { ...cloneCombatant(PLAYER), ...over },
  foe: { ...enemy(room), ...foeOver },
  room,
});

const cfg = (over: Partial<StrategyConfig> = {}): StrategyConfig => ({ ...DEFAULT_CONFIG, ...over });

describe("opponent model — the sample floor", () => {
  it("returns uniform and confidence:low below the floor, however lopsided the counts", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    // As lopsided as it gets: every observation is the same move.
    for (let i = 0; i < SAMPLE_FLOOR - 1; i++) m.observe(modelKey(foe.id, 1), "paper");

    const p = m.predict(foe, 1, { chargesAreHardLimit: true });
    expect(p.confidence).toBe("low");
    expect(p.source).toBe("uniform-below-floor");
    for (const mv of MOVES) expect(p.p[mv]).toBeCloseTo(1 / 3, 10);
  });

  it("emits a read only once the floor is cleared", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    for (let i = 0; i < SAMPLE_FLOOR; i++) m.observe(modelKey(foe.id, 1), "paper");

    const p = m.predict(foe, 1, { chargesAreHardLimit: true });
    expect(p.confidence).toBe("high");
    expect(p.p.paper).toBeGreaterThan(1 / 3);
  });

  it("keys separately by room, so one room's read cannot leak into another", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    for (let i = 0; i < 100; i++) m.observe(modelKey(foe.id, 1), "paper");

    expect(m.predict(foe, 1, { chargesAreHardLimit: true }).confidence).toBe("high");
    expect(m.predict(foe, 2, { chargesAreHardLimit: true }).confidence).toBe("low");
  });

  it("blends toward uniform, so a cleared floor is not the same as certainty", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    for (let i = 0; i < SAMPLE_FLOOR; i++) m.observe(modelKey(foe.id, 1), "paper");
    const thin = m.predict(foe, 1, { chargesAreHardLimit: true }).p.paper;

    for (let i = 0; i < 1000; i++) m.observe(modelKey(foe.id, 1), "paper");
    const thick = m.predict(foe, 1, { chargesAreHardLimit: true }).p.paper;

    expect(thin).toBeLessThan(thick);
    expect(thin).toBeLessThan(0.75);
    expect(thick).toBeGreaterThan(0.9);
  });
});

describe("opponent model — charges", () => {
  it("prunes a move at <= 0 charges to exactly zero and renormalises", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    foe.moves.rock.charges = 0;
    for (let i = 0; i < 200; i++) m.observe(modelKey(foe.id, 1), "rock");

    const p = m.predict(foe, 1, { chargesAreHardLimit: true });
    expect(p.p.rock).toBe(0);
    expect(p.pruned).toEqual(["rock"]);
    expect(p.p.paper + p.p.scissor).toBeCloseTo(1, 10);
  });

  it("does not prune when chargesAreHardLimit is off — one flag, one code path", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    foe.moves.rock.charges = -1;

    const p = m.predict(foe, 1, { chargesAreHardLimit: false });
    expect(p.pruned).toEqual([]);
    expect(p.p.rock).toBeGreaterThan(0);
  });

  it("refuses to invent a distribution when every enemy move is locked", () => {
    const foe = enemy(1);
    for (const mv of MOVES) foe.moves[mv].charges = 0;
    expect(() => new OpponentModel().predict(foe, 1, { chargesAreHardLimit: true })).toThrow();
  });
});

describe("opponent model — first-order transitions", () => {
  it("reports nothing scripted below the Markov floor, however clean the pattern", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    // A perfectly deterministic rock -> paper chain, just not enough of it.
    for (let i = 0; i < MARKOV_FLOOR - 1; i++) m.observe(modelKey(foe.id, 1), "paper", "rock");
    expect(m.determinism()).toEqual([]);
  });

  it("finds a scripted transition once there is enough of it", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    for (let i = 0; i < MARKOV_FLOOR + 50; i++) m.observe(modelKey(foe.id, 1), "paper", "rock");

    const found = m.determinism();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ from: "rock", to: "paper" });
    expect(found[0]!.p).toBeGreaterThan(0.8);

    // And it is actually used for prediction, not merely reported.
    const p = m.predict(foe, 1, { prev: "rock", chargesAreHardLimit: true });
    expect(p.source).toBe("first-order");
    expect(p.p.paper).toBeGreaterThan(0.9);
  });

  it("survives a JSON round trip", () => {
    const m = new OpponentModel();
    const foe = enemy(1);
    for (let i = 0; i < 100; i++) m.observe(modelKey(foe.id, 1), "scissor", "rock");

    const back = OpponentModel.fromJSON(JSON.parse(JSON.stringify(m.toJSON())));
    expect(back.predict(foe, 1, { chargesAreHardLimit: true }).p).toEqual(
      m.predict(foe, 1, { chargesAreHardLimit: true }).p,
    );
  });
});

describe("utility — SPEC §4b's asymmetries", () => {
  it("scores losing 8 HP strictly worse than losing 8 armor", () => {
    // The requirement §4b states in words, and which its own suggested form
    // gets backwards by 70% once the real loadout's maxima are substituted in.
    const lostHp = state({ hp: PLAYER.hp - 8, armor: PLAYER.armor });
    const lostArmor = state({ hp: PLAYER.hp, armor: PLAYER.armor - 8 });
    expect(utility(lostHp, cfg())).toBeLessThan(utility(lostArmor, cfg()));
  });

  it("scores mutual death as death, not as a win", () => {
    const both = state({ hp: 0 }, 1, { hp: 0 });
    expect(utility(both, cfg())).toBe(deathPenalty(1, cfg()));
  });

  it("penalises death more deeply in later rooms", () => {
    expect(deathPenalty(4, cfg())).toBeLessThan(deathPenalty(1, cfg()));
  });

  it("counts enemy armor, so chipping a full pool beats whiffing", () => {
    const chipped = state({}, 1, { armor: 4 });
    const full = state({}, 1, { armor: 12 });
    expect(utility(chipped, cfg())).toBeGreaterThan(utility(full, cfg()));
  });
});

describe("decide — SPEC §4b's worked sanity check", () => {
  /**
   * §4b states this case and its answer outright: "at HP 7 / ARM 0 versus an
   * enemy on HP 4, Shield (6/12) regenerates 12 armor *before* damage lands,
   * which converts two of the three enemy replies from lethal into survivable
   * and wins the third. Any weighting that does not pick Shield there is wrong."
   */
  it("picks Shield at HP 7 / ARM 0 against an enemy on 4 HP", () => {
    const s = state({ hp: 7, armor: 0 }, 1, { hp: 4, armor: 0 });
    expect(decide(s, new OpponentModel(), cfg()).move).toBe("paper");
  });

  /**
   * The case is decided on EXPECTATION, not on the worst case: every one of our
   * three moves loses to some reply that kills us from 7 HP, so all three share
   * the same worst case and λ cannot separate them.
   *
   * §4b's stated reasoning is also slightly off, worth recording since the
   * conclusion is right and the mechanism is what a reader will copy. It says
   * Shield "converts two of the three enemy replies from lethal into survivable
   * and wins the third". Resolved against the real numbers, Shield *kills* on
   * two of the three: their Sword loses to it (we deal 6 into 4 HP), and their
   * Shield ties, where they regenerate 2 and still take 6 — which is also fatal
   * from 4 HP. Only their Spell beats us. Two kills and a death, not two
   * survivals and a kill.
   */
  it("decides that case on expectation — every move there shares a lethal worst case", () => {
    const s = state({ hp: 7, armor: 0 }, 1, { hp: 4, armor: 0 });
    const d = decide(s, new OpponentModel(), cfg());
    const row = Object.fromEntries(d.table.map((r) => [r.move, r]));

    for (const mv of MOVES) expect(row[mv]!.worst).toBe(deathPenalty(1, cfg()));
    expect(row.paper!.ev).toBeGreaterThan(row.rock!.ev);
    // [session 09] Spell's DEF rose from 8 to 12 (+4 gear), which is now
    // enough to survive the Spell-tie cell too — Spell goes from "1 kill, 1
    // survivable tie, 1 death" to "2 kills (one via the tie), 1 death",
    // exactly mirroring Shield's cell shape, so their EV is now genuinely
    // tied (333.33 == 333.33), not just close. `decide()` still resolves the
    // tie to paper deterministically (asserted below via `d.move`) — the
    // conclusion SPEC §4b states is unchanged, only the EV margin is gone.
    expect(row.paper!.ev).toBeGreaterThanOrEqual(row.scissor!.ev);
    expect(d.move).toBe("paper");

    // Two of Shield's three replies end with the enemy dead and us alive — one
    // via an outright win (rock), one via a lethal tie (paper, per the comment
    // above). [session 10] Checked by actually resolving the exchange, not via
    // `.value === cfg().winValue` or `.outcome > 0`: a win's value is now
    // `winValue + base` (the HP/armor margin utility.ts adds so the engine can
    // tell a comfortable win from a bare one), so the exact constant no longer
    // identifies a win — and `outcome` alone would miss the lethal TIE.
    const kills = row.paper!.cells.filter((c) => {
      const result = resolveExchange(s, "paper", c.foeMove).state;
      return isDead(result.foe) && !isDead(result.me);
    });
    expect(kills.map((c) => c.foeMove).sort()).toEqual(["paper", "rock"]);
  });
});

describe("decide — the tie threshold, not raw ATK", () => {
  /**
   * SPEC §4b: our Shield's ATK 6 against enemy 66's Shield DEF 8 makes literally
   * zero progress, forever. A raw-ATK engine scores that 6 damage as 75% of an
   * 8-damage move; this one has to see it as nothing.
   */
  it("marks the zero-progress mirror as a stall in the EV table", () => {
    const s = state({}, 4);
    const d = decide(s, new OpponentModel(), cfg());
    const shieldRow = d.table.find((r) => r.move === "paper")!;
    const mirror = shieldRow.cells.find((c) => c.foeMove === "paper")!;
    expect(mirror.netDamage).toBe(0);
    expect(mirror.stalls).toBe(true);
  });

  it("does not mark a mirror that makes progress", () => {
    // Enemy 63's Shield is DEF 2, so our 6 clears it by 4.
    const d = decide(state({}, 1), new OpponentModel(), cfg());
    const mirror = d.table.find((r) => r.move === "paper")!.cells.find((c) => c.foeMove === "paper")!;
    expect(mirror.netDamage).toBe(4);
    expect(mirror.stalls).toBe(false);
  });

  it("never plays into a certain stall when a scoring move is available", () => {
    // Enemy 66 locked into Shield: mirroring it is the zero-progress trap.
    const foe = enemy(4);
    foe.moves.rock.charges = 0;
    foe.moves.scissor.charges = 0;
    const m = new OpponentModel();
    for (let i = 0; i < 200; i++) m.observe(modelKey(foe.id, 4), "paper");

    const d = decide({ me: cloneCombatant(PLAYER), foe, room: 4 }, m, cfg());
    expect(d.prediction.p.paper).toBeCloseTo(1, 10);
    expect(d.move).not.toBe("paper");
  });
});

describe("decide — contract", () => {
  it("is deterministic: same state, same model, same config, same move", () => {
    const m = new OpponentModel();
    const s = state({ hp: 19, armor: 3 }, 2);
    const first = decide(s, m, cfg());
    for (let i = 0; i < 5; i++) expect(decide(s, m, cfg()).move).toBe(first.move);
  });

  it("mutates neither the state nor the model", () => {
    const m = new OpponentModel();
    const s = state({ hp: 11, armor: 6 }, 2);
    const before = JSON.stringify({ s, m: m.toJSON() });
    decide(s, m, cfg());
    expect(JSON.stringify({ s, m: m.toJSON() })).toBe(before);
  });

  it("only ever returns a move the sim agrees is legal", () => {
    const m = new OpponentModel();
    for (let hp = 1; hp <= 32; hp += 3) {
      for (let armor = 0; armor <= 16; armor += 4) {
        for (const locked of MOVES) {
          const me = cloneCombatant(PLAYER);
          me.hp = hp;
          me.armor = armor;
          me.moves[locked].charges = 0;
          const s: BattleState = { me, foe: enemy(1), room: 1 };
          const legal = legalMoves(me, true);
          expect(legal).toContain(decide(s, m, cfg()).move);
        }
      }
    }
  });

  it("is room-agnostic: the same pools at a deeper room still decide", () => {
    // Not an assertion about WHICH move — only that nothing hardcodes room 1
    // and depth changes the answer through the death penalty, as designed.
    const m = new OpponentModel();
    for (const room of [1, 2, 3, 4]) {
      const s = state({ hp: 9, armor: 0 }, room);
      expect(MOVES).toContain(decide(s, m, cfg()).move);
    }
  });

  it("avoids the move that can kill us when a safe one scores nearly as well", () => {
    // HP 8, armor 0, against enemy 63. Sword loses to their Shield for 8 —
    // exactly lethal. An engine that ignored terminal states would still play
    // Sword here for the damage.
    const s = state({ hp: 8, armor: 0 }, 1, { hp: 30, armor: 12 });
    const d = decide(s, new OpponentModel(), cfg());
    const rock = d.table.find((r) => r.move === "rock")!;
    const lethal = rock.cells.find((c) => c.foeMove === "paper")!;
    expect(resolveExchange(s, "rock", "paper").state.me.hp).toBe(0);
    expect(lethal.value).toBe(deathPenalty(1, cfg()));
    expect(d.move).not.toBe("rock");
  });
});

describe("decide — charge-reserve tie-break (CODEXIMPROVE #4 stage 1)", () => {
  // Every weight and terminal value zeroed: `utility()` returns exactly 0 for
  // any state, so every leaf of the search tree is 0 and all three moves'
  // table rows tie on `.score` by construction — the cleanest possible way to
  // isolate the tie-break from the primary EV comparison it must never touch.
  const zeroCfg = cfg({
    weights: { hp: 0, foeHp: 0, armor: 0, foeArmor: 0 },
    winValue: 0,
    deathValue: 0,
    // Stage 3's continuation term defaults non-zero (session 34) — zeroed
    // here too so this block still isolates stage 1's tie-break alone.
    chargeReserveWeight: 0,
  });

  it("picks the higher ATK-weighted charge reserve when scores are genuinely tied", () => {
    // Spending a charge on the lowest-ATK move (scissor) leaves the most
    // ATK-weighted reserve behind: rock=20, paper=5, scissor=1, all starting
    // at 3/3 charges. Playing scissor leaves 3*20 + 3*5 + 2*1 = 77, the
    // highest of the three candidates (rock: 58, paper: 73).
    const moves = {
      rock: { atk: 20, def: 1, charges: 3, maxCharges: 3 },
      paper: { atk: 5, def: 1, charges: 3, maxCharges: 3 },
      scissor: { atk: 1, def: 1, charges: 3, maxCharges: 3 },
    };
    const s = state({ moves }, 1);
    const d = decide(s, new OpponentModel(), zeroCfg);
    expect(d.table.every((r) => r.score === 0)).toBe(true); // confirms this really is a tie, not a coincidence
    expect(d.move).toBe("scissor");
  });

  it("never lets charge reserve override a real score difference", () => {
    // SPEC §4b's own worked case: paper strictly beats rock on EV here (see
    // "decide — SPEC §4b's worked sanity check" above). Give rock a wildly
    // inflated charge reserve — if the tie-break fired here it would flip the
    // choice to rock. ATK is left untouched so the combat outcome, and thus
    // the real score gap, is unchanged; only the charge COUNT is biased.
    const s = state({ hp: 7, armor: 0 }, 1, { hp: 4, armor: 0 });
    const me = cloneCombatant(s.me);
    me.moves.rock = { ...me.moves.rock, charges: 1000, maxCharges: 1000 };
    const biased: BattleState = { ...s, me };
    const d = decide(biased, new OpponentModel(), cfg());
    expect(d.move).toBe("paper");
  });
});

describe("utility — charge-reserve continuation term (CODEXIMPROVE #4 stage 3)", () => {
  const depleted = () =>
    state({
      moves: {
        rock: { ...PLAYER.moves.rock, charges: 0 },
        paper: { ...PLAYER.moves.paper, charges: 0 },
        scissor: { ...PLAYER.moves.scissor, charges: 0 },
      },
    });

  it("ships at 0.4 — the value scripts/chargeReserveAblation.ts's plateau cleared", () => {
    expect(DEFAULT_CONFIG.chargeReserveWeight).toBe(0.4);
  });

  it("is a no-op on utility() at weight 0, whatever the charges", () => {
    const zeroCfg = cfg({ chargeReserveWeight: 0 });
    expect(utility(depleted(), zeroCfg)).toBe(utility(state({}), zeroCfg));
  });

  it("rewards a higher ATK-weighted charge reserve once the weight is non-zero", () => {
    const withCfg = cfg({ chargeReserveWeight: 1 });
    expect(utility(state({}), withCfg)).toBeGreaterThan(utility(depleted(), withCfg));
  });

  it("rewards it at the shipped default too", () => {
    expect(utility(state({}), cfg())).toBeGreaterThan(utility(depleted(), cfg()));
  });
});

describe("loot ranking — §4c, unvalidated by construction", () => {
  it("categorises the types the corpus has actually offered", () => {
    expect(categorise("Heal")).toBe("heal");
    expect(categorise("UpgradePaper")).toBe("upgrade");
    expect(categorise("AddEvasion")).toBe("rolled");
    expect(categorise("AddMaxArmor")).toBe("pool");
    expect(categorise("CorrosiveShield")).toBe("unknown");
    expect(upgradeTarget("UpgradeScissor")).toBe("scissor");
    expect(upgradeTarget("AddLuck")).toBeNull();
  });

  it("puts Heal first at low HP — §4c rank 1", () => {
    const hurt = { ...cloneCombatant(PLAYER), hp: 8 };
    const ranked = rankBoons(hurt, [
      { type: "AddEvasion", val1: 1, val2: 0 },
      { type: "Heal", val1: 16, val2: 0 },
      { type: "UpgradeScissor", val1: 4, val2: 0 },
    ], 2);
    expect(ranked[0]!.option.type).toBe("Heal");
  });

  it("does not rank Heal first at full HP, where none of it is usable", () => {
    const ranked = rankBoons(cloneCombatant(PLAYER), [
      { type: "Heal", val1: 16, val2: 0 },
      { type: "UpgradeScissor", val1: 4, val2: 0 },
    ], 2);
    expect(ranked.find((r) => r.option.type === "Heal")!.score).toBe(0);
  });

  it("prefers upgrading the move actually played most", () => {
    const ranked = rankBoons(cloneCombatant(PLAYER), [
      { type: "UpgradePaper", val1: 0, val2: 4 },
      { type: "UpgradeScissor", val1: 4, val2: 0 },
    ], 2, { playCounts: { rock: 5, paper: 90, scissor: 5 } });
    expect(ranked[0]!.option.type).toBe("UpgradePaper");
  });

  it("does NOT prefer a boon for being modelled — that would tune the metric", () => {
    // `Heal` is the only modelled-and-clean boon. At full HP it must not win on
    // the strength of being scorable; coverage is a measurement, not a payoff.
    const ranked = rankBoons(cloneCombatant(PLAYER), [
      { type: "Heal", val1: 16, val2: 0 },
      { type: "AddEvasion", val1: 1, val2: 0 },
    ], 1);
    expect(ranked[0]!.option.type).toBe("AddEvasion");
  });

  /**
   * The actual room-1 offer from run-2026-08-14-03-26-57/state-016, and the
   * user's read from playing it: max armor over a stat boon. §4c ranked it that
   * way from the start; the implementation missed it only because `AddMaxArmor`
   * had never been seen before session 06 and fell through to `unknown`.
   */
  it("ranks AddMaxArmor above rolled stats — §4c rank 3, and the recorded offer", () => {
    const ranked = rankBoons(cloneCombatant(PLAYER), [
      { type: "AddMaxArmor", val1: 2, val2: 0 },
      { type: "AddLuck", val1: 1, val2: 0 },
      { type: "UpgradeScissor", val1: 0, val2: 4 },
    ], 1);
    expect(ranked[0]!.option.type).toBe("AddMaxArmor");
  });

  it("still puts a usable Heal above a max pool — HP is the resource combat cannot renew", () => {
    const hurt = { ...cloneCombatant(PLAYER), hp: 8 };
    const ranked = rankBoons(hurt, [
      { type: "AddMaxArmor", val1: 2, val2: 0 },
      { type: "Heal", val1: 16, val2: 0 },
    ], 1);
    expect(ranked[0]!.option.type).toBe("Heal");
  });

  it("is a stable sort, so an offer of equals is reproducible", () => {
    const offer = [
      { type: "AddLuck", val1: 1, val2: 0 },
      { type: "AddEvasion", val1: 1, val2: 0 },
      { type: "AddBlock", val1: 2, val2: 0 },
    ];
    const a = rankBoons(cloneCombatant(PLAYER), offer, 1).map((r) => r.option.type);
    expect(a).toEqual(["AddLuck", "AddEvasion", "AddBlock"]);
  });
});

describe("config — depth 2 for sim throughput, depth 3 for live play [session 07]", () => {
  it("keeps DEFAULT_CONFIG at depth 2 — scripts/sim.ts runs thousands of iterations per invocation", () => {
    expect(DEFAULT_CONFIG.depth).toBe(2);
  });

  it("LIVE_CONFIG is depth 3 and otherwise identical to DEFAULT_CONFIG — the ablation's only established gap is the depth", () => {
    expect(LIVE_CONFIG.depth).toBe(3);
    expect(LIVE_CONFIG).toEqual({ ...DEFAULT_CONFIG, depth: 3 });
  });
});
