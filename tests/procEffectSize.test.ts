/**
 * [session 101 §B, QUESTIONS.md §58] What the rolled stats DO when they proc.
 *
 * Session 100 pinned the RATES (`tests/procEvidence.test.ts`). This file pins
 * the MECHANICS, and the invariant that makes them measurements rather than
 * correlations: on every rule, the matched control — the same stat non-zero,
 * the flag NOT fired — must match the rule ZERO times. A control that starts
 * matching means the rule is describing something other than the proc.
 *
 * **Scans a BOUNDED slice**, for the same reason `procEvidence.test.ts` does:
 * the corpus is append-only and a test that re-parses all of it re-parses more
 * every session, forever, for an invariant a slice establishes just as well.
 * The FULL-CORPUS totals belong to `npx tsx scripts/procEffectSize.ts` and to
 * QUESTIONS.md §58; the INVARIANTS belong here.
 *
 * **The assertions are slice-safe on purpose.** `evadeProc0` fires 6 times in
 * the whole 1919-exchange corpus and `intuitionProc0` 6 times; any slice can
 * honestly contain zero of either. So nothing here asserts "this flag fired" —
 * it asserts "of those that fired, all obeyed the rule", which is true of an
 * empty set and stays true as volume grows. That is the same discipline
 * session 100 applied after nearly shipping a test that a legitimate slice
 * would have failed.
 */

import { describe, expect, it } from "vitest";

import {
  dealtDamage,
  loadExchanges,
  pickOrderPower,
  scoreRules,
  tenacityByBoon,
  tenacityByPickOrder,
  wilson,
  type Exchange,
  type PickOrderCell,
} from "../scripts/procEffectSize.js";

/** Enough runs to carry hundreds of exchanges and a control in the hundreds, well under a second. */
const RUN_DIRS_SCANNED = 20;

const exchanges = loadExchanges({ maxRunDirs: RUN_DIRS_SCANNED });
const rules = scoreRules(exchanges);

describe("the corpus slice this rests on", () => {
  it("carries exchanges, each with two moves and a preceding state", () => {
    expect(exchanges.length).toBeGreaterThan(100);
    for (const ex of exchanges) {
      expect(ex.moves[0]).not.toBe("");
      expect(ex.moves[1]).not.toBe("");
      expect([-1, 0, 1]).toContain(ex.outcome);
    }
  });

  it("only ever counts combat damage — burn ticks are a status mechanic, not a proc one", () => {
    // `data.source` is `""` for combat and `"burn"` for a burn tick. If a burn
    // row were being summed into `taken`, the null below could not hold at the
    // rate it does, so this is pinned by consequence as well as by construction.
    const withDamage = exchanges.filter((e) => e.taken[0] > 0 || e.taken[1] > 0);
    expect(withDamage.length).toBeGreaterThan(50);
  });
});

describe("the null — what an exchange does when nothing procs", () => {
  // [session 106] **This assertion was RE-DERIVED, not bumped.** It used to be
  // `ok / n > 0.9` over ALL no-proc exchanges, justified by "the misses all
  // carry a non-empty `statusEffects` array". Session 106's four juiced runs
  // dropped that mixed rate to **604/688 = 87.8%** in this slice and failed it.
  //
  // Nothing had changed about the mechanic. The stated justification was
  // already the whole story, and measuring it directly proves it: on
  // status-CLEAN exchanges the null holds at **280/280 = 100.0%** in this slice
  // and **1645/1645 = 100.0%** on the full corpus — ZERO misses, ever. Every
  // single miss is status-carrying, exactly as the old comment claimed.
  //
  // So the old number was measuring SLICE COMPOSITION, not the rule. The
  // status-dirty share of this bounded slice rose (408/688 = 59.3%, against
  // 1004/2649 = 37.9% on the full corpus) because session 106's runs took
  // status-heavy boons — CorrosiveShield, AddBurnSword, BurnMastery, TieWeak,
  // TieVulnerable. A mixed-population rate is a function of that mix and will
  // keep drifting with whatever the last 20 runs happened to pick.
  //
  // The fix is the session-105 `deckShuffle` lesson applied to a different
  // shape: assert the invariant on the population it actually holds over, and
  // make it EXACT. `cleanMisses === 0` is strictly stronger than `> 0.9` and
  // cannot be satisfied by a favourable mix. The mixed rate stays computed and
  // is reported below as an observation, deliberately NOT asserted.
  it("damage taken equals the attacker's currentATK on EVERY status-clean exchange", () => {
    let ok = 0;
    let n = 0;
    let cleanOk = 0;
    let cleanN = 0;
    const cleanMisses: string[] = [];
    for (const ex of exchanges) {
      if (Object.values(ex.flags).some(Boolean)) continue;
      for (const victim of [0, 1] as const) {
        const attacker = (1 - victim) as 0 | 1;
        if (!dealtDamage(ex, attacker) || typeof ex.atk[attacker] !== "number") continue;
        n++;
        const hit = ex.taken[victim] === ex.atk[attacker];
        if (hit) ok++;
        if (!ex.statusClean) continue;
        cleanN++;
        if (hit) cleanOk++;
        else cleanMisses.push(`${ex.label} victim=${victim} taken=${ex.taken[victim]} atk=${ex.atk[attacker]}`);
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(cleanN).toBeGreaterThan(100);
    // THE INVARIANT. A single clean miss means something other than a status
    // moved damage — a finding, not a flake, and it names the exchange.
    expect(cleanMisses).toEqual([]);
    expect(cleanOk).toBe(cleanN);
    // Observation only, not an assertion: the mixed rate is composition-bound.
    expect(ok / n).toBeGreaterThan(0.5);
  });
});

describe("the three damage rules", () => {
  it.each(["blockProc0", "blockProc1", "evadeProc0", "evadeProc1", "critProc0", "critProc1"])(
    "%s obeys its rule on every status-clean exchange where it fired",
    (flag) => {
      const r = rules.find((x) => x.flag === flag)!;
      expect(r).toBeDefined();
      // Slice-safe: vacuously true when this slice happens to contain no fire.
      expect(r.ok).toBe(r.n);
    },
  );

  it.each(["blockProc0", "blockProc1", "evadeProc0", "evadeProc1", "critProc0", "critProc1"])(
    "%s: the matched control NEVER matches the rule — this is what separates mechanic from correlation",
    (flag) => {
      const r = rules.find((x) => x.flag === flag)!;
      // Same stat non-zero, flag unfired. Full corpus at session 101: 0 of
      // 149-1041 per flag. A non-zero here means the rule is describing
      // something that also happens without the proc.
      //
      // No per-flag floor on `controlN`: `evasion` is 0 on the player side for
      // most of a run, so a 20-run slice gives `evadeProc0` a control of ~14.
      // A floor here would be a gate set on something the slice does not
      // control (CLAUDE.md rule 6). The denominator is asserted in aggregate
      // below instead, where it is stable.
      expect(r.controlMatched).toBe(0);
    },
  );

  it("the matched controls are collectively large enough to mean something", () => {
    const total = rules.reduce((sum, r) => sum + r.controlN, 0);
    // Full corpus at session 101: 3577 across the six. Any slice worth
    // scanning clears a few hundred.
    expect(total).toBeGreaterThan(200);
    expect(rules.reduce((sum, r) => sum + r.controlMatched, 0)).toBe(0);
  });
});

describe("what tenacity and intuition are NOT", () => {
  it("intuition never mitigates damage on its own", () => {
    const fired = exchanges.filter((e) => e.flags.intuitionProc0 && !e.flags.blockProc0);
    for (const ex of fired) {
      if (!dealtDamage(ex, 1) || typeof ex.atk[1] !== "number") continue;
      // Full ATK taken. The one corpus exchange that looked mitigated also
      // carried `blockProc0` and took exactly floor(ATK/2) — that is block.
      expect(ex.taken[0]).toBe(ex.atk[1]);
    }
  });

  it("tenacity does not follow any of the three damage rules", () => {
    // Deliberately NOT asserting what tenacity does — at 17/19 fires and 6
    // heals total it cannot be bounded, and QUESTIONS.md §58 records it as
    // undetermined rather than rounding an association into a mechanic.
    const fired = exchanges.filter((e) => e.flags.tenacityProc0 && e.statusClean);
    const negated = fired.filter(
      (e: Exchange) => dealtDamage(e, 1) && typeof e.atk[1] === "number" && e.taken[0] === 0,
    );
    expect(negated.length).toBe(0);
  });
});

describe("tenacity, split by the AddTenacity boon [session 104, QUESTIONS.md §62]", () => {
  const cells = tenacityByBoon(exchanges);

  it("the ENEMY side is a structurally boon-free arm — enemies never pick boons at all", () => {
    // 0 of 5820 states carrying a players[] have a non-empty `pickedBoons` on
    // players[1], whole corpus. This is what makes the split a control rather
    // than a re-labelling: side 1's tenacity is always the bare stat, so any
    // effect surviving there cannot be the boon's doing.
    //
    // Asserting a zero COUNT is normally forbidden (DECISIONS 2026-08-26, the
    // `deckShuffle` finding), and it is allowed here because this is not a
    // chance event — no capture path exists by which an enemy acquires a boon.
    for (const ex of exchanges) expect(ex.boons[1]).toEqual([]);
    for (const c of cells) if (c.side === 1 && c.withBoon) expect(c.n).toBe(0);
  });

  it("the player side does carry boons, so the split has both arms populated", () => {
    expect(exchanges.some((e) => e.boons[0].length > 0)).toBe(true);
  });

  it("tenacity mitigates no damage in EITHER arm — the §58 verdict survives the split", () => {
    // The concern the split exists to rule out is that pooling mixed two
    // populations. On the damage question it did not: with the boon and
    // without it, a status-clean tenacity fire with no other proc takes the
    // attacker's plain currentATK. Vacuously true on a slice containing none,
    // which is why it is safe to scan a bounded slice.
    for (const side of [0, 1] as const) {
      const attacker = (1 - side) as 0 | 1;
      const fired = exchanges.filter(
        (e) =>
          e.flags[`tenacityProc${side}`] &&
          e.statusClean &&
          !["block", "evade", "crit"].some((f) => e.flags[`${f}Proc${side}`] || e.flags[`${f}Proc${attacker}`]),
      );
      for (const ex of fired) {
        if (!dealtDamage(ex, attacker) || typeof ex.atk[attacker] !== "number") continue;
        expect(ex.taken[side]).toBe(ex.atk[attacker]);
      }
    }
  });

  it("counts every tenacity>0 exchange exactly once across the eight cells", () => {
    // The cells partition — side x boon x fired. A double-count here would
    // inflate whichever arm it landed in, which is exactly the error the
    // split is meant to detect elsewhere.
    for (const side of [0, 1] as const) {
      const direct = exchanges.filter((e) => (e.stat[side].tenacity ?? 0) > 0).length;
      const summed = cells.filter((c) => c.side === side).reduce((a, c) => a + c.n, 0);
      expect(summed).toBe(direct);
    }
  });

  it("never reports more heals than exchanges in a cell", () => {
    for (const c of cells) expect(c.healed).toBeLessThanOrEqual(c.n);
  });
});

describe("tenacity by AddTenacity PICK ORDER [session 105, QUESTIONS.md §63]", () => {
  const cells = tenacityByPickOrder(exchanges);

  it("only ever reports an exchange whose side actually holds the boon and the stat", () => {
    // The cell key is (stat, pick), so a row that included a no-boon exchange
    // would silently pool the two arms session 104 spent a whole part
    // separating. Checked by reconstructing the denominator independently.
    const direct = exchanges.filter(
      (e) => (e.stat[0].tenacity ?? 0) > 0 && e.boons[0].includes("AddTenacity"),
    ).length;
    expect(cells.reduce((a, c) => a + c.n, 0)).toBe(direct);
  });

  it("reports the pick position 1-based, and never one the boon list cannot supply", () => {
    for (const c of cells) {
      expect(c.pick).toBeGreaterThanOrEqual(1);
      expect(c.stat).toBeGreaterThan(0);
      expect(c.fired).toBeLessThanOrEqual(c.n);
      expect(c.runs).toBeGreaterThanOrEqual(1);
      expect(c.runs).toBeLessThanOrEqual(c.n);
    }
  });

  it("pick order is COLLINEAR with the stat — most strata hold a single pick position", () => {
    // This is the session-105 finding itself, stated as an invariant rather
    // than a number: a run contributes ONE pick position, so a (stat, pick)
    // cell is usually one run and pick order cannot be separated from the stat
    // there at all. Asserted as a majority rather than an exact count, because
    // the corpus is append-only and the exact split moves every session.
    const power = pickOrderPower(cells);
    expect(power.totalStrata).toBeGreaterThan(0);
    expect(power.informativeStrata).toBeLessThan(power.totalStrata);
  });

  it("pickOrderPower counts ONLY multi-position strata, and counts them exactly", () => {
    // Synthetic, so the arithmetic is pinned independently of the corpus.
    const cell = (stat: number, pick: number, fired: number, n: number): PickOrderCell => ({
      side: 0, stat, pick, n, fired, runs: 1,
    });
    const power = pickOrderPower([
      cell(2, 1, 1, 10),
      cell(2, 3, 0, 5), // stat 2 varies in position -> informative
      cell(7, 3, 4, 38), // stat 7 does not -> excluded whatever its procs
    ]);
    expect(power).toEqual({
      informativeStrata: 1,
      totalStrata: 2,
      firedInInformativeStrata: 1,
      nInInformativeStrata: 15,
    });
  });

  it("is empty of side-1 rows by construction — enemies hold no boons to order", () => {
    expect(tenacityByPickOrder(exchanges, 1)).toEqual([]);
  });
});

describe("wilson", () => {
  it("brackets the point estimate and stays inside [0,1]", () => {
    for (const [k, n] of [
      [0, 10],
      [9, 9],
      [2, 2],
      [33, 33],
      [1, 100],
    ] as const) {
      const [lo, hi] = wilson(k, n);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(1);
      expect(lo).toBeLessThanOrEqual(k / n);
      expect(hi).toBeGreaterThanOrEqual(k / n);
    }
  });

  it("does not claim certainty from a small perfect sample", () => {
    // 2/2 is not 100%. This is the guard against the failure the brief named:
    // presenting a point estimate as precise when n cannot support it.
    const [lo] = wilson(2, 2);
    expect(lo).toBeLessThan(0.5);
  });
});
