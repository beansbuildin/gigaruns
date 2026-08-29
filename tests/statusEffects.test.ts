/**
 * [session 101 §D, QUESTIONS.md §59] Status effect mechanics.
 *
 * §B (`tests/procEffectSize.test.ts`) measured the proc mechanics and found
 * that its ENTIRE residual was statuses. This file pins the statuses, and with
 * them the last of the damage number that was unaccounted for.
 *
 * The assertion that matters most here is not any single rule — it is
 * **`amount: 0` is inert**. Zero is the most common amount on four of the six
 * types, and any consumer that tests for a status's PRESENCE rather than its
 * amount will be wrong on the majority of occurrences. That is the mistake this
 * file exists to make expensive.
 *
 * **Scans a BOUNDED slice**, for the reason `procEvidence.test.ts` gives: the
 * corpus is append-only. Full-corpus totals belong to
 * `npx tsx scripts/statusEffects.ts` and QUESTIONS.md §59.
 *
 * Assertions are slice-safe: `Steadfast` occurs 23 times in the whole corpus
 * and `SecondWind` fires 10 times, so nothing asserts "this was observed" —
 * only "of what was observed, all obeyed the rule", which holds on an empty set.
 */

import { describe, expect, it } from "vitest";

import {
  burnMasterySplit,
  inertAtZero,
  loadStatusExchanges,
  regenRule,
  scaleRule,
  secondWindRule,
  unexplainedHeals,
  VULNERABLE_MULTIPLIER,
  WEAK_MULTIPLIER,
} from "../scripts/statusEffects.js";

const RUN_DIRS_SCANNED = 30;
const ex = loadStatusExchanges({ maxRunDirs: RUN_DIRS_SCANNED });

describe("Burn", () => {
  /**
   * [session 108] This assertion used to run over the WHOLE population and be
   * exceptionless. Session 108's batch broke it 384/396, and the 12 exceptions
   * were not noise: every one is an exchange whose attacker held
   * `BurnMastery`, and every one ticks 6 against a recorded amount of 3.
   *
   * The rule was incomplete, not wrong. Scoped to the population it actually
   * describes it is exceptionless at a LARGER n than it ever reached combined
   * (719/719 full corpus), and the amplified arm is pinned separately below.
   * Do NOT "repair" this by lowering the expected count back onto the mixed
   * population — that hides a mechanic inside an exception rate.
   */
  it("ticks for the AFTER-state amount, without exception, absent BurnMastery", () => {
    const r = burnMasterySplit(ex).plain;
    expect(r.n).toBeGreaterThan(50);
    expect(r.ok).toBe(r.n);
  });

  it("is AMPLIFIED by BurnMastery, which never changes the recorded amount", () => {
    const { mastery, pairs } = burnMasterySplit(ex);
    // Total separation: no BurnMastery exchange ever ticks its plain amount.
    expect(mastery.ok).toBe(0);
    expect(mastery.n).toBeGreaterThan(0);
    // **The open question, pinned so it cannot quietly be forgotten.** Every
    // observation is 6-against-3, so a x2 multiplier and a flat +3 are
    // indistinguishable. This assertion fails the moment a burn tick at any
    // other amount lands — which is exactly the capture that would separate
    // them. When it goes red, that is data arriving, not a regression.
    expect(Object.keys(pairs)).toEqual(["6/3"]);
  });
});

describe("Weak and Vulnerable are exact floor multipliers", () => {
  it.each([
    ["Weak", WEAK_MULTIPLIER],
    ["Vulnerable", VULNERABLE_MULTIPLIER],
  ] as const)("%s scales damage by %s, floored", (status, _mult) => {
    const r = scaleRule(ex, status);
    expect(r.ok).toBe(r.n);
  });

  it.each(["Weak", "Vulnerable"] as const)(
    "%s: the multiplier does NOT depend on `amount` — the field is a countdown, not a magnitude",
    (status) => {
      // The trap: `amount` IS the magnitude for Burn, Regen and SecondWind, so
      // reading it that way here is the natural mistake. Amounts 1-4 all give
      // the same multiplier. If a future corpus ever splits by amount, this
      // fails and the rule above needs re-deriving rather than patching.
      const r = scaleRule(ex, status);
      for (const [, t] of Object.entries(r.byAmount)) expect(t.ok).toBe(t.n);
    },
  );
});

describe("amount === 0 is INERT, not merely small", () => {
  it.each(["Weak", "Vulnerable", "SecondWind"] as const)(
    "%s at 0 leaves damage at exactly the attacker's ATK",
    (status) => {
      const r = inertAtZero(ex, status);
      expect(r.ok).toBe(r.n);
    },
  );

  it("zero is common enough that a presence check would be wrong most of the time", () => {
    let zero = 0;
    let nonZero = 0;
    for (const e of ex) {
      for (const side of [0, 1] as const) {
        for (const status of ["Weak", "Vulnerable"] as const) {
          const a = e.beforeStatus[side][status];
          if (a === undefined) continue;
          if (a === 0) zero++;
          else nonZero++;
        }
      }
    }
    expect(zero + nonZero).toBeGreaterThan(20);
    expect(zero).toBeGreaterThan(nonZero * 0.5);
  });
});

describe("Regen", () => {
  it("heals its current amount whenever the unit survived the exchange", () => {
    const r = regenRule(ex);
    expect(r.healed.ok).toBe(r.healed.n);
  });

  it("decays by exactly 1 within the same exchange, dead or alive", () => {
    const r = regenRule(ex);
    expect(r.decayed.ok).toBe(r.decayed.n);
  });
});

describe("SecondWind", () => {
  it("heals exactly its stored amount when spent, and spends to 0", () => {
    expect(secondWindRule(ex).spentHealsFullAmount.ok).toBe(secondWindRule(ex).spentHealsFullAmount.n);
  });

  it("does nothing at all while it is held", () => {
    const r = secondWindRule(ex);
    expect(r.heldDoesNothing.ok).toBe(r.heldDoesNothing.n);
  });

  // Deliberately no test of the TRIGGER condition. It fired at 40/40 HP against
  // 10 incoming and held at 40/40 against 14, so it is neither lethality nor a
  // fixed threshold, and n=10 cannot separate the alternatives. QUESTIONS.md
  // §59 records it as undetermined; a test here would pin a guess.
});

describe("lifesteal does not exist", () => {
  it("no heal is proportional to the damage its side dealt", () => {
    const heals = unexplainedHeals(ex).filter((h) => h.dealt > 0);
    if (heals.length < 4) return; // slice-safe
    const ratios = heals.map((h) => h.heal / h.dealt);
    // A real lifesteal would be a constant ratio. Full corpus: 0.20 to 0.80.
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.1);
  });

  it("the heals it leaves unexplained are small flat values, not a fraction of a big hit", () => {
    for (const h of unexplainedHeals(ex)) expect(h.heal).toBeLessThanOrEqual(10);
  });
});
