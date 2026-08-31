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
    // ⭐⭐ [session 113] **THE OPEN QUESTION IS ANSWERED, AND THIS ASSERTION
    // GOING RED IS HOW.** The note this replaces read: *"Every observation is
    // 6-against-3, so a x2 multiplier and a flat +3 are indistinguishable.
    // This assertion fails the moment a burn tick at any other amount lands —
    // which is exactly the capture that would separate them. When it goes red,
    // that is data arriving, not a regression."*
    //
    // It went red. A **4-against-2** tick landed in this session's Tier-2 runs,
    // and it separates the two hypotheses cleanly:
    //
    //   plain 2  ->  x2 gives 4 ✅   |   flat +3 gives 5 ❌ (observed 4)
    //   plain 3  ->  x2 gives 6 ✅   |   flat +3 gives 6 ✅ (both fit; why 6/3
    //                                    could never separate them)
    //
    // **BurnMastery is a x2 MULTIPLIER. The flat-+3 reading is FALSIFIED.**
    //
    // The pair set is still asserted exactly rather than loosened to "contains
    // 4/2", for the same reason it was exact before: a THIRD distinct pair
    // would be new information again — it would test x2 at a fresh amount, and
    // an amount where x2 and the (now-dead) +3 disagree is no longer the only
    // interesting case. An odd plain amount, for instance, would say whether
    // the doubling floors or rounds.
    expect(Object.keys(pairs).sort()).toEqual(["4/2", "6/3"]);
    // The multiplier, asserted against every observed pair rather than against
    // the two literals above — so it is the RELATIONSHIP that is pinned, not
    // the sample. This is what a future pair has to keep satisfying.
    for (const k of Object.keys(pairs)) {
      const [amplified, plain] = k.split("/").map(Number) as [number, number];
      expect(amplified, `BurnMastery pair ${k} is not x2`).toBe(plain * 2);
    }
  });
});

/**
 * ── [session 113] ONE Weak EXCEPTION, AND IT CARRIES AN UNMODELLED STATUS ───
 *
 * `Weak` had held 100% until the 2026-08-31 Tier-2 runs. It now reads **58/59**
 * on the shipped filter, and the single miss is
 * `run-2026-08-31-03-26-52/state-116`: ATK 30, `floor(30 * 0.75) = 22`
 * predicted, **27 taken** — with the attacker carrying `Vengeance: 25`
 * alongside `Weak: 1`.
 *
 * **`scaleRule`'s exclusion list is incomplete, and that is the defect — not
 * the multiplier.** It excludes the other side's Weak/Vulnerable and this
 * side's opposite scaler, but nothing else, so an exchange carrying any
 * UNMODELLED damage-affecting status is scored as though the multiplier were
 * the only thing acting. Restricting to exchanges where neither combatant
 * carries an unmodelled status (`Vengeance`, `Intimidating`, `Steadfast` are
 * the three the corpus has) restores **54/54 — 100%**.
 *
 * ⚠ **This is NOT licence to drop inconvenient observations**, which is why the
 * exclusion is asserted to be exactly the unmodelled-status set and why the
 * full-corpus miss count is asserted to equal it. The +5 over the Weak
 * prediction is left as evidence ABOUT `Vengeance` rather than discarded: it
 * is the first quantitative observation of that status, and it is recorded in
 * QUESTIONS.md §67 rather than modelled from n=1.
 */
const MODELLED_STATUSES = new Set(["Weak", "Vulnerable", "Burn", "Regen", "SecondWind"]);
const noUnmodelledStatus = ex.filter(
  (e) => ![0, 1].some((s) => Object.keys(e.beforeStatus[s as 0 | 1]).some((k) => !MODELLED_STATUSES.has(k))),
);

describe("Weak and Vulnerable are exact floor multipliers", () => {
  it.each([
    ["Weak", WEAK_MULTIPLIER],
    ["Vulnerable", VULNERABLE_MULTIPLIER],
  ] as const)("%s scales damage by %s, floored", (status, _mult) => {
    const r = scaleRule(noUnmodelledStatus, status);
    expect(r.ok).toBe(r.n);
    expect(r.n).toBeGreaterThan(10);
  });

  it("⚠ the ONLY Weak exception carries an unmodelled status — the exclusion cannot widen", () => {
    const full = scaleRule(ex, "Weak");
    const clean = scaleRule(noUnmodelledStatus, "Weak");
    expect(full.n - full.ok).toBe(1); // exactly one miss on the whole corpus
    expect(clean.n - clean.ok).toBe(0); // and it is not in the clean set
    // Vulnerable has no exception at all, clean or not — asserted so the
    // filter is not silently carrying it.
    expect(scaleRule(ex, "Vulnerable").ok).toBe(scaleRule(ex, "Vulnerable").n);
  });

  it.each(["Weak", "Vulnerable"] as const)(
    "%s: the multiplier does NOT depend on `amount` — the field is a countdown, not a magnitude",
    (status) => {
      // The trap: `amount` IS the magnitude for Burn, Regen and SecondWind, so
      // reading it that way here is the natural mistake. Amounts 1-4 all give
      // the same multiplier. If a future corpus ever splits by amount, this
      // fails and the rule above needs re-deriving rather than patching.
      const r = scaleRule(noUnmodelledStatus, status);
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

/**
 * ── [session 113] BOTH SecondWind RULES GAINED EXCEPTIONS, AND ALL FIVE ARE
 *    THE SAME SHAPE: `Regen` CO-PRESENT ─────────────────────────────────────
 *
 * The 2026-08-31 Tier-2 runs produced the corpus's first exchanges where a
 * combatant carries `Regen` and `SecondWind` at the same time. Both rules were
 * derived on a corpus where that never happened, and both break on it:
 *
 *   shipped        spent  9/10   held 16/20
 *   without Regen  spent  9/9    held 16/16     <-- 100%, unchanged
 *   with Regen     spent  1      held  4        <-- exactly the 5 exceptions
 *
 * **The held arm is fully explained.** Its rule is `heal === undefined`, and
 * these four exchanges heal **1** — which is `Regen: 1`'s heal, not
 * SecondWind's. SecondWind did nothing; the rule simply cannot tell "this side
 * healed" from "SecondWind healed".
 *
 * **The spent arm's single exception is NOT fully explained, and is not
 * papered over.** `run-2026-08-31-03-26-52/state-128`: SecondWind 10 -> 0,
 * `Regen` 1 -> 0, and the recorded `heal` is 1, not 10 or 11. HP moved
 * **26 -> 35 (+9)** across the exchange, which is consistent with 10 + 1
 * healed against 2 taken — so the HP arithmetic supports the full spend and it
 * is the `heal` FIELD that under-reports when two heals land in one exchange.
 * That is a statement about the capture, not about the mechanic, and it is
 * recorded as unresolved rather than asserted.
 *
 * **Why the exceptions are excluded rather than the bound loosened.** A rule
 * that reads a single `heal` field cannot be evaluated on an exchange with two
 * heal sources — the measurement is undefined there, not merely noisy. The
 * exclusion is asserted to be EXACTLY the co-present-Regen set below, so it
 * cannot quietly widen into "drop whatever fails".
 */
const withoutRegen = ex.filter((e) =>
  [0, 1].every((s) => {
    const st = e.beforeStatus[s as 0 | 1];
    return st.SecondWind === undefined || st.Regen === undefined || st.Regen === 0;
  }),
);

describe("SecondWind", () => {
  it("heals exactly its stored amount when spent, and spends to 0", () => {
    const r = secondWindRule(withoutRegen);
    expect(r.spentHealsFullAmount.ok).toBe(r.spentHealsFullAmount.n);
    expect(r.spentHealsFullAmount.n).toBe(9);
  });

  it("does nothing at all while it is held", () => {
    const r = secondWindRule(withoutRegen);
    expect(r.heldDoesNothing.ok).toBe(r.heldDoesNothing.n);
    expect(r.heldDoesNothing.n).toBe(16);
  });

  it("⚠ the ONLY exceptions are co-present Regen — pinned so the exclusion cannot widen", () => {
    // The exclusion above is only honest if it is exactly the undefined-
    // measurement set. Asserted both ways: the full corpus has 5 more
    // observations than the filtered one, and every one of them carries Regen.
    const full = secondWindRule(ex);
    const filtered = secondWindRule(withoutRegen);
    expect(full.spentHealsFullAmount.n - filtered.spentHealsFullAmount.n).toBe(1);
    expect(full.heldDoesNothing.n - filtered.heldDoesNothing.n).toBe(4);
    // ...and the full-corpus miss count equals the excluded count exactly, so
    // nothing that PASSES is being thrown away and nothing that FAILS remains.
    const misses =
      full.spentHealsFullAmount.n - full.spentHealsFullAmount.ok +
      (full.heldDoesNothing.n - full.heldDoesNothing.ok);
    expect(misses).toBe(5);
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
