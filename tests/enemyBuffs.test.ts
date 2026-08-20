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
import {
  isUnmodified,
  pickFinalRoomTier,
  pickHighestTier,
  pickLowestNonPerpetualTier,
  pickTierForRoom,
  PerpetualOnlyOfferError,
  tierRuleFor,
} from "../src/strategy/enemyTier.js";
import { MAX_ROOM } from "../src/sim/enemies.js";
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

describe("the perpetual directive (user, 2026-08-20), under rule 8's HIGHEST-tier rule", () => {
  const opt = (tier: number, id?: string) => ({ tier, enemyBuff: id ? ENEMY_BUFFS[id] ?? { id } : null });

  it("recognises the prefix and nothing else", () => {
    expect(isPerpetualBuff(ENEMY_BUFFS["perpetual_mangleblade"])).toBe(true);
    expect(isPerpetualBuff(ENEMY_BUFFS["mangleblade"])).toBe(false);
    expect(isPerpetualBuff(null)).toBe(false);
  });

  it("takes the highest tier when nothing on it is perpetual", () => {
    const options = [opt(0), opt(1, "armored"), opt(2, "overgrown")];
    expect(pickHighestTier(options)).toBe(options[2]);
  });

  it("FILTERS perpetuals first, then takes the max — so the clause now LOWERS the tier", () => {
    // This is the shape session 56 measured at 47 of 134 offers (35%): a
    // perpetual sitting on the top tier. Under the old lowest-tier rule the
    // directive was a within-tier tie-break and could not move the tier; under
    // rule 8 it drops the whole top tier when that tier is entirely perpetual.
    const options = [opt(2, "perpetual_ferocious"), opt(1, "armored"), opt(0)];
    expect(pickHighestTier(options)).toBe(options[1]);
  });

  it("prefers a clean card AT the top tier over dropping a tier", () => {
    const options = [opt(2, "perpetual_ferocious"), opt(2, "overgrown"), opt(1)];
    expect(pickHighestTier(options)).toBe(options[1]);
  });

  it("resolves a tie at the chosen tier on offer order, so the decision is reproducible", () => {
    const options = [opt(2, "overgrown"), opt(2, "armored")];
    expect(pickHighestTier(options)).toBe(options[0]);
  });

  it("FAILS CLOSED when every option is perpetual — CLAUDE.md rule 8", () => {
    // 0 of 134 corpus offers have this shape, which is exactly why it must
    // halt loudly rather than quietly pick one. This REVERSES session 56's
    // fail-open tie-break: that decision was made when the clause could not
    // change a tier, and choosing the hardest card is a deliberate act of
    // taking on risk the user has forbidden in this form.
    const options = [opt(2, "perpetual_mangleblade"), opt(1, "perpetual_withering")];
    expect(() => pickHighestTier(options)).toThrow(PerpetualOnlyOfferError);
  });

  it("leaves an offer with no buff information alone and still takes the highest", () => {
    const options = [{ tier: 1 }, { tier: 0 }, { tier: 2 }];
    expect(pickHighestTier(options)).toBe(options[2]);
  });

  it("throws on an empty offer", () => {
    expect(() => pickHighestTier([])).toThrow(/empty offer/);
  });
});

describe("pickLowestNonPerpetualTier (the final-room fallback only)", () => {
  const opt = (tier: number, id?: string) => ({ tier, enemyBuff: id ? ENEMY_BUFFS[id] ?? { id } : null });

  it("takes the lowest tier and prefers a clean card among equals", () => {
    const options = [opt(0, "perpetual_ferocious"), opt(0, "overgrown"), opt(2)];
    expect(pickLowestNonPerpetualTier(options)).toBe(options[1]);
  });

  it("fails OPEN when every option at the lowest tier is perpetual", () => {
    // Deliberately the opposite of pickHighestTier. At the final room the rule
    // is already reaching for the least dangerous card; there is nothing safer
    // to fall back to, and halting would strand the boss room.
    const options = [opt(1, "perpetual_mangleblade"), opt(1, "perpetual_withering")];
    expect(pickLowestNonPerpetualTier(options)).toBe(options[0]);
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

describe("the final-room exception (user, 2026-08-20)", () => {
  const opt = (tier: number, buffId?: string, rolled?: Record<string, number>) => ({
    tier,
    enemyBuff: buffId ? ENEMY_BUFFS[buffId] ?? { id: buffId } : null,
    rolledEnemyStats: rolled ?? { evasion: 0, block: 0, lck: 0, tenacity: 0 },
  });

  it("MAX_ROOM is the server-published maxRoom for Forbidden Woods", () => {
    // Verified live from `dungeon-today`'s container: Forbidden Woods (ID_CID
    // 5) publishes maxRoom 16. Void Dungeon publishes 17, which is why the
    // selector takes it as a parameter rather than hard-coding it.
    expect(MAX_ROOM).toBe(16);
  });

  it("isUnmodified means no buff AND every rolled stat zero", () => {
    expect(isUnmodified(opt(0))).toBe(true);
    expect(isUnmodified(opt(0, "bloodthirsty"))).toBe(false);
    expect(isUnmodified(opt(1, undefined, { evasion: 2, block: 0, lck: 0, tenacity: 0 }))).toBe(false);
    // A stat-only buff is still a MODIFIER for this rule. The directive is
    // about the card, not about whether the sim can score it.
    expect(isUnmodified(opt(0, "hardy"))).toBe(false);
  });

  it("prefers an unmodified card among options at the lowest tier", () => {
    const options = [opt(0, "bloodthirsty"), opt(0), opt(2)];
    expect(pickFinalRoomTier(options)).toBe(options[1]);
  });

  it("NEVER raises a tier to find a clean card — that would be the expensive mistake", () => {
    // The only unmodified option sits at tier 2. The rule must still fight
    // tier 0, because taking the hardest card at the real final room is the
    // failure the directive exists to prevent.
    const options = [opt(0, "bloodthirsty"), opt(2)];
    expect(pickFinalRoomTier(options).tier).toBe(0);
  });

  it("applies at the final room and not before, and stays on past it", () => {
    const options = [opt(0, "bloodthirsty"), opt(0)];
    // Before the final room: rule 8's highest-tier clause. Both options are
    // tier 0 here, so it resolves on offer order — and NOT on isUnmodified,
    // which is the distinction this test exists to pin.
    expect(pickTierForRoom(options, 15, MAX_ROOM)).toBe(options[0]);
    expect(pickTierForRoom(options, MAX_ROOM, MAX_ROOM)).toBe(options[1]);
    // `>=`, not `===`: if the index ever runs past the configured count this
    // must not silently switch off at the one room it exists to protect.
    expect(pickTierForRoom(options, MAX_ROOM + 1, MAX_ROOM)).toBe(options[1]);
  });

  it("falls through to the ordinary rule when nothing at the tier is clean", () => {
    const options = [opt(1, "bloodthirsty"), opt(1, "shatterblade")];
    expect(pickFinalRoomTier(options).tier).toBe(1);
  });

  it("throws on an empty offer, like every other selector here", () => {
    expect(() => pickFinalRoomTier([])).toThrow(/empty offer/);
  });
});

describe("tierRuleFor — which clause of rule 8 governs, and what an unreadable field does", () => {
  it("names the ordinary clause everywhere before the final room", () => {
    expect(tierRuleFor(1, 16)).toBe("highest");
    expect(tierRuleFor(15, 16)).toBe("highest");
  });

  it("names the final-room clause at maxRoom and past it", () => {
    expect(tierRuleFor(16, 16)).toBe("final-room");
    expect(tierRuleFor(17, 16)).toBe("final-room");
  });

  it("resolves an UNREADABLE room or maxRoom to the conservative clause, labelled separately", () => {
    // Session 56 found `ROOM_NUM_CID` lives on `data.entity`, NOT
    // `data.entity.data`, where it reads `undefined` silently; liveRun.ts
    // defaults it to 0. If that field moves again every room would take the
    // final-room clause and the flip would be silently inert — so the label is
    // distinct from a genuine final room and liveRun.ts logs it loudly.
    expect(tierRuleFor(0, 16)).toBe("final-room-unreadable");
    expect(tierRuleFor(undefined, 16)).toBe("final-room-unreadable");
    expect(tierRuleFor(null, 16)).toBe("final-room-unreadable");
    expect(tierRuleFor(NaN, 16)).toBe("final-room-unreadable");
    expect(tierRuleFor(4, undefined)).toBe("final-room-unreadable");
    expect(tierRuleFor(4, 0)).toBe("final-room-unreadable");
  });

  it("pickTierForRoom takes NO MODIFIERS when the room is unreadable, not the hardest card", () => {
    const options = [
      { tier: 2, enemyBuff: null, rolledEnemyStats: { evasion: 0, block: 0, lck: 0, tenacity: 0 } },
      { tier: 0, enemyBuff: null, rolledEnemyStats: { evasion: 0, block: 0, lck: 0, tenacity: 0 } },
    ];
    expect(pickTierForRoom(options, 4, 16)).toBe(options[0]); // readable: highest
    expect(pickTierForRoom(options, 0, 16)).toBe(options[1]); // unreadable: no modifiers
    expect(pickTierForRoom(options, 4, undefined)).toBe(options[1]);
  });
});
