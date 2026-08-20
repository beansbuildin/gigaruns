/**
 * tests/enemyBuffs.test.ts — the enemy-buff table, its fail-closed boundary,
 * and the user's perpetual directive.
 *
 * The assertion that carries the most weight is the CORPUS one: the buff's own
 * declared `effects[]` must predict the buffed stats a clean baseline turns
 * into. That is the entire justification for `coverage.ts` no longer raising
 * `ENEMY_BUFF` on a stat-only buff, and if it stops holding, that change must
 * be reverted rather than patched.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyStatBuff,
  classifyBuff,
  ENEMY_BUFFS,
  isPerpetualBuff,
  isScorableBuff,
  MECHANIC_KINDS,
  PERPETUAL_PREFIX,
  STAT_ONLY_KINDS,
  type BuffableStats,
} from "../src/sim/enemyBuffs.js";
import { probeRun } from "../src/sim/coverage.js";
import { pickLowestTier } from "../src/strategy/enemyTier.js";
import { CORPUS_DIR } from "../src/sim/corpus.js";

const base: BuffableStats = {
  atk: { rock: 14, paper: 10, scissor: 8 },
  def: { rock: 3, paper: 4, scissor: 5 },
  hp: 35,
  shield: 14,
};

describe("classification", () => {
  it("splits the 46 corpus ids into 12 stat-only and 34 mechanic", () => {
    const ids = Object.keys(ENEMY_BUFFS);
    expect(ids).toHaveLength(46);
    const statOnly = ids.filter((id) => classifyBuff(ENEMY_BUFFS[id]) === "statOnly");
    expect(statOnly).toHaveLength(12);
    expect(ids.filter((id) => classifyBuff(ENEMY_BUFFS[id]) === "mechanic")).toHaveLength(34);
  });

  it("every effect kind in the table is one we recognise", () => {
    for (const buff of Object.values(ENEMY_BUFFS)) {
      for (const e of buff.effects) {
        expect(STAT_ONLY_KINDS.has(e.kind) || MECHANIC_KINDS.has(e.kind), `${buff.id}: ${e.kind}`).toBe(true);
      }
    }
  });

  it("each perpetual_ twin has the same effects as its base id", () => {
    const twins = Object.keys(ENEMY_BUFFS).filter((id) => id.startsWith(PERPETUAL_PREFIX));
    expect(twins.length).toBeGreaterThan(0);
    for (const id of twins) {
      const bare = ENEMY_BUFFS[id.slice(PERPETUAL_PREFIX.length)];
      if (!bare) continue; // a perpetual with no captured base twin is legal
      expect(ENEMY_BUFFS[id]!.effects, id).toEqual(bare.effects);
      expect(classifyBuff(ENEMY_BUFFS[id]), id).toBe(classifyBuff(bare));
    }
  });
});

describe("fail-closed boundary", () => {
  it("an unknown id is unknown, not silently inert", () => {
    expect(classifyBuff({ id: "notARealBuff", effects: [{ kind: "flatAtk", amount: 4 }] })).toBe("unknown");
    expect(isScorableBuff({ id: "notARealBuff" })).toBe(false);
    expect(applyStatBuff(base, { id: "notARealBuff" })).toBeNull();
  });

  it("a KNOWN id carrying an unrecognised effect kind still fails closed", () => {
    // The line is the effect kind, not the id — a server-side redefinition of
    // a familiar buff must not be waved through on its name.
    const mutated = { ...ENEMY_BUFFS["bloodthirsty"]!, effects: [{ kind: "someNewMechanic", amount: 1 }] };
    expect(classifyBuff(mutated)).toBe("unknown");
    expect(applyStatBuff(base, mutated)).toBeNull();
  });

  it("a buff with no effects at all is unknown, not stat-only", () => {
    expect(classifyBuff({ id: "bloodthirsty", effects: [] })).toBe("unknown");
  });

  it("null means no buff, which is scorable", () => {
    expect(classifyBuff(null)).toBe("statOnly");
    expect(probeRun({ activeEnemyBuff: null })).toEqual([]);
  });
});

describe("coverage — ENEMY_BUFF is raised for a RULE, not for numbers", () => {
  it("a stat-only buff no longer makes the battle unscorable", () => {
    expect(probeRun({ activeEnemyBuff: ENEMY_BUFFS["bloodthirsty"] })).toEqual([]);
    expect(probeRun({ activeEnemyBuff: ENEMY_BUFFS["hardy"] })).toEqual([]);
    expect(probeRun({ activeEnemyBuff: ENEMY_BUFFS["overgrown"] })).toEqual([]);
  });

  it("a mechanic buff still does", () => {
    expect(probeRun({ activeEnemyBuff: ENEMY_BUFFS["shatterblade"] })).toEqual(["ENEMY_BUFF"]);
    expect(probeRun({ activeEnemyBuff: ENEMY_BUFFS["bloodguard"] })).toEqual(["ENEMY_BUFF"]);
    expect(probeRun({ perpetualBuffs: [ENEMY_BUFFS["perpetual_withering"]] })).toEqual(["ENEMY_BUFF"]);
  });

  it("an unknown buff still does", () => {
    expect(probeRun({ activeEnemyBuff: { id: "brandNew" } })).toEqual(["ENEMY_BUFF"]);
  });

  it("one mechanic buff among stat-only ones is enough to block", () => {
    expect(
      probeRun({
        activeEnemyBuff: ENEMY_BUFFS["bloodthirsty"],
        perpetualBuffs: [ENEMY_BUFFS["perpetual_crushing"]],
      }),
    ).toEqual(["ENEMY_BUFF"]);
  });
});

describe("applyStatBuff — verification only", () => {
  it("adds a flat ATK to every move", () => {
    expect(applyStatBuff(base, ENEMY_BUFFS["bloodthirsty"])!.atk).toEqual({ rock: 18, paper: 14, scissor: 12 });
  });

  it("rounds percentages UP — 14 * 1.3 = 18.2 lands on 19, ruling out floor and round-half", () => {
    const out = applyStatBuff(base, ENEMY_BUFFS["overgrown"])!;
    expect(out.hp).toBe(46); // 35 * 1.3 = 45.5
    expect(out.shield).toBe(19); // 14 * 1.3 = 18.2
  });

  it("a mechanic buff moves no stat", () => {
    expect(applyStatBuff(base, ENEMY_BUFFS["shatterblade"])).toEqual(base);
  });
});

describe("the perpetual directive (user, 2026-08-20)", () => {
  const opt = (tier: number, id?: string) => ({ tier, enemyBuff: id ? ENEMY_BUFFS[id] ?? { id } : null });

  it("recognises the prefix and nothing else", () => {
    expect(isPerpetualBuff(ENEMY_BUFFS["perpetual_mangleblade"])).toBe(true);
    expect(isPerpetualBuff(ENEMY_BUFFS["mangleblade"])).toBe(false);
    expect(isPerpetualBuff(null)).toBe(false);
  });

  it("skips a perpetual card in favour of another at the SAME tier", () => {
    const options = [opt(2, "perpetual_ferocious"), opt(2, "overgrown"), opt(2, "perpetual_mangleblade")];
    expect(pickLowestTier(options)).toBe(options[1]);
  });

  it("NEVER changes the tier — rule 8 is untouched", () => {
    // The perpetual sits on the lowest tier and the alternatives are higher.
    // The directive must not promote a higher tier to escape it.
    const options = [opt(0, "perpetual_mangleblade"), opt(1, "armored"), opt(2, "overgrown")];
    expect(pickLowestTier(options).tier).toBe(0);
  });

  it("keeps the original pick when every option at the tier is perpetual", () => {
    // Fail-OPEN, and only for the tie-break: there is no lower-risk option to
    // take instead, and halting would strand a 60-energy run over a preference
    // among equals. The corpus has never actually produced this shape.
    const options = [opt(1, "perpetual_mangleblade"), opt(1, "perpetual_withering")];
    expect(pickLowestTier(options)).toBe(options[0]);
  });

  it("leaves an offer with no buff information alone", () => {
    const options = [{ tier: 1 }, { tier: 0 }, { tier: 2 }];
    expect(pickLowestTier(options)).toBe(options[1]);
  });
});

describe("the natural experiment, against the corpus", () => {
  interface WireMove { startingATK: number; startingDEF: number }
  interface WireFoe {
    id: string;
    rock: WireMove; paper: WireMove; scissor: WireMove;
    health: { starting: number }; shield: { starting: number };
  }

  const statsOf = (f: WireFoe): BuffableStats => ({
    atk: { rock: f.rock.startingATK, paper: f.paper.startingATK, scissor: f.scissor.startingATK },
    def: { rock: f.rock.startingDEF, paper: f.paper.startingDEF, scissor: f.scissor.startingDEF },
    hp: f.health.starting,
    shield: f.shield.starting,
  });

  it("declared effects predict the buffed stats exactly, on every enemy with a clean baseline", () => {
    const baseline = new Map<string, BuffableStats>();
    const buffed: Array<{ enemy: string; buff: unknown; observed: BuffableStats }> = [];

    for (const dir of readdirSync(CORPUS_DIR)) {
      const full = join(CORPUS_DIR, dir);
      if (!statSync(full).isDirectory()) continue;
      for (const f of readdirSync(full)) {
        if (!f.startsWith("state-") || !f.endsWith(".json")) continue;
        const doc = JSON.parse(readFileSync(join(full, f), "utf8")) as {
          data?: { run?: { players?: WireFoe[] }; entity?: { data?: { activePath?: { enemyBuff?: unknown } } } };
        };
        const ap = doc.data?.entity?.data?.activePath;
        if (!ap || !("enemyBuff" in ap)) continue;
        const players = doc.data?.run?.players ?? [];
        if (players.length < 2) continue;
        const foe = players[1]!;
        const stats = statsOf(foe);
        if ((ap.enemyBuff ?? null) === null) baseline.set(foe.id, stats);
        else buffed.push({ enemy: foe.id, buff: ap.enemyBuff, observed: stats });
      }
    }

    expect(baseline.size).toBeGreaterThan(0);
    let compared = 0;
    for (const { enemy, buff, observed } of buffed) {
      const b = baseline.get(enemy);
      if (!b) continue;
      const predicted = applyStatBuff(b, buff);
      expect(predicted, `${enemy} carries an unmodellable buff`).not.toBeNull();
      expect(predicted, `${enemy} + ${(buff as { id: string }).id}`).toEqual(observed);
      compared++;
    }
    // If this floor is ever not met the sweep found nothing and the assertion
    // above passed vacuously — the failure mode this test exists to avoid.
    expect(compared).toBeGreaterThanOrEqual(30);
  });
});
