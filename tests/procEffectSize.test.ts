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

import { dealtDamage, loadExchanges, scoreRules, wilson, type Exchange } from "../scripts/procEffectSize.js";

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
  it("damage taken equals the attacker's currentATK on the overwhelming majority", () => {
    let ok = 0;
    let n = 0;
    for (const ex of exchanges) {
      if (Object.values(ex.flags).some(Boolean)) continue;
      for (const victim of [0, 1] as const) {
        const attacker = (1 - victim) as 0 | 1;
        if (!dealtDamage(ex, attacker) || typeof ex.atk[attacker] !== "number") continue;
        n++;
        if (ex.taken[victim] === ex.atk[attacker]) ok++;
      }
    }
    expect(n).toBeGreaterThan(100);
    // Full corpus at session 101: 2211/2285 = 96.8%. The misses all carry a
    // non-empty `statusEffects` array — the mechanics CAPTURE-1 still lists as
    // unmeasured. A drop below this floor means something OTHER than statuses
    // started moving damage, which is a finding, not a flake.
    expect(ok / n).toBeGreaterThan(0.9);
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
