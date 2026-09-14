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

import { readdirSync, readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  burnMasterySplit,
  inertAtZero,
  loadStatusExchanges,
  regenRule,
  scaleRule,
  secondWindRule,
  unexplainedHeals,
  vengeanceRules,
  VULNERABLE_MULTIPLIER,
  WEAK_MULTIPLIER,
} from "../scripts/statusEffects.js";
import { vengeanceAfter, vengeanceDamage, vengeanceMultiplier } from "../src/sim/vengeance.js";
import { dealtDamage } from "../scripts/procEffectSize.js";
import { BOON_MODELS } from "../src/sim/boons.js";

const RUN_DIRS_SCANNED = 30;
const ex = loadStatusExchanges({ maxRunDirs: RUN_DIRS_SCANNED });

/**
 * [session 114] **The corpus-wide claims run on the WHOLE corpus.**
 *
 * `maxRunDirs` takes `allDirs.slice(-maxRunDirs)` — the LAST N run dirs — so
 * every count keyed on it silently depends on WHICH runs are in the window,
 * not just how many. Session 114 added four runs and the window slid four,
 * which broke assertions without the corpus losing anything. The same slide
 * hit `procEvidence.test.ts` harder, and that file's header now carries the
 * general lesson.
 *
 * The specific defect here was narrower and worse: the Weak-exception test's
 * own comment read *"exactly one miss on the whole corpus"* while `full` was
 * a 30-dir slice. It was not measuring what it said. On the actual corpus the
 * claim is TRUE and better supported — 95/96, exactly one miss — so this
 * change strengthens the assertion rather than rescuing it.
 *
 * The slice stays for everything whose subject is a population sample rather
 * than a universal claim.
 */
const exAll = loadStatusExchanges({});

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
    // ⚠ [session 122] **Runs on `exAll`, not the 30-dir slice, and the switch
    // FIXED a red assertion without touching the pinned set.** Session 122's
    // four runs sled the `maxRunDirs: 30` window forward and pushed the runs
    // carrying `6/3` and `10/5` out of it, so the slice-derived set collapsed
    // to `{4/2, 8/4}` and this assertion went red. **The corpus lost nothing** —
    // this is precisely the sliding-window trap the file header documents from
    // session 114, firing again on a different assertion.
    //
    // The tell that the SLICE was wrong rather than the pin: the doc comment on
    // `burnMasterySplit` cites `3` at n=18 and `5` at n=4, and those are
    // FULL-CORPUS counts (full: `{6/3: 18, 4/2: 38, 8/4: 4, 10/5: 4}`, n=64).
    // The rationale had been written against the whole corpus while the
    // assertion ran on a 12-observation slice of it.
    //
    // "Which pairs has BurnMastery EVER produced" is a universal claim, so by
    // this file's own stated policy — the slice stays only for population
    // samples — it belongs on `exAll`. Strictly stronger: n 12 -> 64, and
    // `mastery.ok` is 0 on both, so total separation is unweakened.
    const { mastery, pairs } = burnMasterySplit(exAll);
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
    // would be new information again — it would test x2 at a fresh amount.
    //
    // ⚠ [session 116] **The old rationale for this pin named a capture that
    // cannot exist, and it is retired.** It read: *"An odd plain amount, for
    // instance, would say whether the doubling floors or rounds."* Both halves
    // are wrong. Odd plain amounts are already HERE — `6/3` (n=18) and `10/5`
    // (n=4) — so the capture was never missing; and floor-vs-round is not a
    // separable pair of hypotheses at all, because every Burn amount and tick
    // in the corpus is an integer and `floor(2p) === round(2p) === 2p` for
    // every integer `p`. The pin stays, on the live rationale above; the dead
    // sub-question does not. See scripts/statusEffects.ts and DECISIONS.
    // ⭐ [session 123] **A FIFTH PAIR, `14/7`, from day 20701's four runs — and
    // it is the largest Burn amount this rule has ever been tested at.** The
    // set GREW; this is NOT the session-114 sliding-window trap that shrank it
    // in session 122, and the distinction was checked rather than assumed
    // (a window loss REMOVES keys; this diff only ADDS one). `14 = 7 * 2`, so
    // the x2 multiplier now holds over base ticks {2,3,4,5,7} — the first test
    // of it at a base above 5, and it survived.
    // ⭐ [session 125] **A SIXTH PAIR, `16/8`, from day 20703's four runs — and
    // it takes over from `14/7` as the largest Burn amount the rule has been
    // tested at.** The set GREW again (an ADD, not the session-114 sliding-
    // window loss that REMOVES keys — checked, not assumed). `16 = 8 * 2`, so
    // the x2 multiplier now holds over base ticks {2,3,4,5,7,8}.
    expect(Object.keys(pairs).sort()).toEqual(["10/5", "14/7", "16/8", "4/2", "6/3", "8/4"]);  /* [session 125] was ["10/5", "14/7", "4/2", "6/3", "8/4"] */  /* [session 123] was ["10/5", "4/2", "6/3", "8/4"] */  /* [session 116] Set UNCHANGED by the 2026-09-01 Tier-2 run, which added no new pair but raised n 52 total; x2 now holds over {2,3,4,5}. [session 114] was ["4/2", "6/3"] — 10/5 and 8/4 arrived together in the room-14 run; BOTH satisfy x2 (10 = 5*2, 8 = 4*2), so the multiplier survives a doubling of the pair set. That entry also claimed "NO odd plain amount" while listing 10/5 and 6/3, which are odd — corrected above. */
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
const noUnmodelledStatusOf = (xs: typeof ex) =>
  xs.filter(
    (e) => ![0, 1].some((s) => Object.keys(e.beforeStatus[s as 0 | 1]).some((k) => !MODELLED_STATUSES.has(k))),
  );
/** [session 114] The whole-corpus clean set — see `exAll`. Weak 83/83, Vulnerable 45/45. */
const noUnmodelledStatusAll = noUnmodelledStatusOf(exAll);

/**
 * ⭐ [session 126] The corpus's ONLY exception to the floor-multiplier rules,
 * on either status, and it arrived this session.
 *
 * `run-2026-09-09-17-28-53/state-120.json`, room 9 of the day's first juiced
 * Tier-2 run: `atk` 39 against a victim carrying `Vulnerable` 1 and NOTHING
 * else, every proc flag false. The rule predicts `floor(39 * 1.25)` = **48**.
 * The server dealt **52**.
 *
 * **Why it is a BOON and not a status.** The run had picked
 * `VulnerableMastery(10)` at room 5 (state-067), well before this exchange.
 * Splitting the whole corpus on "was VulnerableMastery active for this victim"
 * separates it perfectly:
 *
 *     VulnerableMastery ABSENT   84/84 obey 1.25   (exceptionless)
 *     VulnerableMastery ACTIVE    0/1  obey 1.25
 *
 * ⛔ **It is NOT modelled, and this file does not name the mechanic.**
 * `VulnerableMastery` is one of the types held in `AWAITING_MODEL_DIRECTIVE`
 * (tests/boons.test.ts), and CLAUDE.md's standing rule is that a new boon
 * effect from n=1 needs a USER DIRECTIVE. n here is exactly 1.
 *
 * ⚠ **And n=1 cannot separate the candidates even if it were allowed to.**
 * At `atk` 39 the observed 52 is reproduced by AT LEAST three different rules:
 *   floor(39 * 4/3)  = 52      floor(39 * 1.35) = 52      floor(39 * 1.25) + 4 = 52
 * `VulnerableMastery` has `val1Min === val1Max === 10`, so its value never
 * rolls and no future pickup will vary it — separating these needs exchanges
 * at DIFFERENT `atk` values, not more pickups. Do not fit one of them.
 */
/**
 * ⭐ [session 128] THE SECOND EXCEPTION, AND IT IS A DIFFERENT BOON — so this
 * table is no longer about `VulnerableMastery` alone and has been renamed.
 *
 * `run-2026-09-10-17-46-14/state-074.json`: `atk` 15 against an attacker
 * carrying `Weak` 5, every proc flag false. The rule predicts
 * `floor(15 * 0.75)` = **11**. The server dealt **9**.
 *
 * **Why it is `TieDamageReduction` and not a hole in the Weak rule.** The run
 * picked `TieDamageReduction(8)` at state-065 -> state-066, and it is the
 * ONLY corpus run that has ever picked that type. Three exchanges in that run
 * come in UNDER prediction and all three are **ties** (`outcome === 0`) whose
 * victim is the boon holder (player 0):
 *
 *     state-074  atk 15, Weak 5 on the attacker  predicted 11  dealt  9   -2
 *     state-082  atk 14, status-clean            predicted 14  dealt 12   -2
 *     state-090  atk 18, status-clean            predicted 18  dealt 16   -2
 *
 * Every NON-tie exchange in the same stretch lands exactly on prediction, and
 * so does the OTHER side of those same tie exchanges (state-074 and state-090
 * both deal a full 27 to player 1). So the effect is scoped to ties, to the
 * holder, and it composes AFTER the Weak multiplier rather than replacing it.
 *
 * ⛔ **It is NOT modelled and this file does not name the mechanic.**
 * `TieDamageReduction` is held in `AWAITING_MODEL_DIRECTIVE`
 * (tests/boons.test.ts) and CLAUDE.md's standing rule is that a new boon type
 * needs a USER DIRECTIVE. There is exactly ONE pickup.
 *
 * ⚠ **And the magnitude does NOT match the boon's own value.** The pick drew
 * `selectedVal1` **8** while the observed reduction is **2**, 3/3. Whatever
 * the 8 governs, it is not the flat amount subtracted here — so "reduce by
 * val1" is already falsified, and a directive to model this would still need
 * a second pickup at a different roll (it rolls 7-10) to say what 8 does.
 */
const UNMODELLED_BOON_EXCEPTIONS = { Weak: 1, Vulnerable: 1 } as const;

describe("Weak and Vulnerable are exact floor multipliers", () => {
  it.each([
    ["Weak", WEAK_MULTIPLIER],
    ["Vulnerable", VULNERABLE_MULTIPLIER],
  ] as const)("%s scales damage by %s, floored", (status, _mult) => {
    const r = scaleRule(noUnmodelledStatusAll, status);
    // ⭐ [session 126] THE FIRST-EVER `Vulnerable` EXCEPTION. Until this
    // session both statuses were exceptionless on the clean set. Weak still
    // is; Vulnerable is now 77/78, and the single miss is named and bounded by
    // the test below rather than tolerated by a loosened rule here.
    expect(r.n - r.ok).toBe(UNMODELLED_BOON_EXCEPTIONS[status]);
    expect(r.n).toBeGreaterThan(10);
  });

  it("⚠ BOTH Weak exceptions are unmodelled effects — the exclusion cannot widen", () => {
    const full = scaleRule(exAll, "Weak");
    const clean = scaleRule(noUnmodelledStatusAll, "Weak");
    // ⚠ [session 128] THIS TEST'S TITLE USED TO SAY "the ONLY Weak exception"
    // and its clean count used to be 0. Both changed, and NEITHER by relaxing
    // the rule. There are now exactly TWO Weak misses on the whole corpus and
    // they have DIFFERENT causes, which is why the counts differ:
    //   run-2026-08-31-03-26-52/state-116  atk 30, an unmodelled STATUS
    //     — excluded by the clean filter, so it is in `full` and not `clean`.
    //   run-2026-09-10-17-46-14/state-074  atk 15, an unmodelled BOON
    //     (`TieDamageReduction`, see UNMODELLED_BOON_EXCEPTIONS above)
    //     — the clean filter CANNOT see it, because `scaleRule` reads `flags`
    //     and `beforeStatus` and knows nothing about `pickedBoons`. So it
    //     survives into the clean set, and that is the whole reason the clean
    //     count moved off zero for the first time.
    expect(full.n - full.ok).toBe(2); // [session 128] was 1
    expect(clean.n - clean.ok).toBe(1); // [session 128] was 0 — the boon-caused miss
    // ⚠ [session 126] THIS LINE USED TO READ "Vulnerable has no exception at
    // all, clean or not". THAT IS NO LONGER TRUE — it now has exactly one, and
    // unlike the Weak exception it is NOT explained by an unmodelled STATUS.
    // It is explained by an unmodelled BOON, which `scaleRule` cannot see:
    // it filters on `flags` and `beforeStatus` and knows nothing about
    // `pickedBoons`. See the dedicated test below for the measurement.
    expect(scaleRule(exAll, "Vulnerable").n - scaleRule(exAll, "Vulnerable").ok).toBe(1); // 84/85
  });

  it.each(["Weak", "Vulnerable"] as const)(
    "%s: the multiplier does NOT depend on `amount` — the field is a countdown, not a magnitude",
    (status) => {
      // The trap: `amount` IS the magnitude for Burn, Regen and SecondWind, so
      // reading it that way here is the natural mistake. Amounts 1-4 all give
      // the same multiplier. If a future corpus ever splits by amount, this
      // fails and the rule above needs re-deriving rather than patching.
      const r = scaleRule(noUnmodelledStatusAll, status);
      // [session 126] The one Vulnerable exception sits at `amount` 1 (62/63).
      // It does NOT split this rule: the exception is a boon effect, not an
      // amount effect, and every other bucket is still exceptionless. Counting
      // misses per bucket rather than asserting zero keeps the amount claim
      // testable instead of deleting it.
      const misses = Object.values(r.byAmount).reduce((a, t) => a + (t.n - t.ok), 0);
      expect(misses).toBe(UNMODELLED_BOON_EXCEPTIONS[status]);
    },
  );
});

describe("⭐ the ONLY Vulnerable exception is a BOON effect, and it stays unmodelled", () => {
  /** Runs that ever picked `VulnerableMastery`, and the state index it first appears at. */
  const firstVulnerableMasteryState = (): Map<string, number> => {
    const base = "fixtures/dungeon-runs";
    const out = new Map<string, number>();
    for (const run of readdirSync(base)) {
      const dir = `${base}/${run}`;
      if (!statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir).filter((x) => /^state-\d+\.json$/.test(x)).sort()) {
        let picked: unknown;
        try {
          picked = (JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as never as {
            data?: { run?: { players?: { pickedBoons?: { boonTypeString?: string }[] }[] } };
          }).data?.run?.players?.[0]?.pickedBoons;
        } catch {
          continue;
        }
        if (!Array.isArray(picked)) continue;
        if (picked.some((b) => b?.boonTypeString === "VulnerableMastery")) {
          if (!out.has(run)) out.set(run, Number(f.slice(6, 9)));
          break;
        }
      }
    }
    return out;
  };

  it("splits the corpus perfectly: 84/84 without the boon, 0/1 with it", () => {
    const vmAt = firstVulnerableMasteryState();
    let vmN = 0;
    let vmOk = 0;
    let plainN = 0;
    let plainOk = 0;

    for (const ex of exAll) {
      if (Object.values(ex.flags).some(Boolean)) continue;
      for (const victim of [0, 1] as const) {
        const attacker = (1 - victim) as 0 | 1;
        const atk = ex.atk[attacker];
        if (!dealtDamage(ex, attacker) || typeof atk !== "number" || atk <= 0) continue;
        if (ex.beforeStatus[attacker].Weak !== undefined) continue;
        if (ex.beforeStatus[attacker].Vulnerable !== undefined) continue;
        if (ex.beforeStatus[victim].Weak !== undefined) continue;
        const amount = ex.beforeStatus[victim].Vulnerable;
        if (amount === undefined || amount === 0) continue;

        const run = String(ex.label).split("/")[0]!;
        const idx = Number(/state-(\d+)/.exec(String(ex.label))?.[1] ?? -1);
        const at = vmAt.get(run);
        // The PLAYER holds the boon, so it can only apply when the enemy (1) is the victim.
        const vmActive = at !== undefined && idx >= at && victim === 1;
        const obeys = ex.taken[victim] === Math.floor(atk * VULNERABLE_MULTIPLIER);
        if (vmActive) {
          vmN++;
          if (obeys) vmOk++;
        } else {
          plainN++;
          if (obeys) plainOk++;
        }
      }
    }

    // Without the boon the rule is EXCEPTIONLESS — this is the claim that
    // matters, and the session-126 exception did not dent it.
    expect(plainOk).toBe(plainN);
    expect(plainN).toBe(117 /* [session 131, day 20709] was 106 */ /* [session 128, day 20706] was 90 — +2 more VulnerableMastery-ABSENT observations; `plainOk === plainN` still holds, so the split is STILL PERFECT */ /* [session 128] was 84 — +6 VulnerableMastery-ABSENT observations from day 20705's runs; `plainOk === plainN` still holds, so the split is STILL PERFECT and this is a corpus-growth pin, not a weakening */); /* [session 129, day 20707] was 92 — the 4-run dungeon day + the first 17-cast PUPPETEER (924) batch */ /* [session 130, day 20708] was 99 */

    // With it, the single observation misses. n === 1 is the whole point: it
    // is why this is recorded and NOT modelled.
    expect(vmN).toBe(1);
    expect(vmOk).toBe(0);
  });

  it("⛔ stays out of the model until a user directive lands", () => {
    // CLAUDE.md: a new boon effect from n=1 needs a USER DIRECTIVE. If someone
    // models `VulnerableMastery`, this fails and they must come back here and
    // re-read the three-candidate note above before deciding it is safe.
    expect(BOON_MODELS.VulnerableMastery, "modelled without a directive").toBeUndefined();
  });
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
/**
 * [session 114] **A SECOND heal source entered the corpus, and the exclusion is
 * now a two-member CENSUS rather than a one-member one.**
 *
 * Session 113 excluded co-present `Regen` and explained the held arm fully.
 * Session 114's room-14 run broke it again — 12 held-arm misses, all
 * player-side, all carrying `Intimidating: 2`, all healing exactly 2:
 *
 * ```
 * held-arm misses by co-present status:  { Regen: 4, Intimidating: 12 }
 * ```
 *
 * Identical on the 30-dir slice and on the whole corpus, so it is not a window
 * artifact. Excluding both, BOTH arms are exceptionless on the full corpus —
 * spent 19/19, held 44/44 — which is a larger clean sample than session 113
 * had, not a rescued one.
 *
 * ⚠ **`Intimidating` is NOT modelled here and this file does not claim it
 * heals.** What is recorded is that a side carrying it healed on 12 of 12
 * occasions and that the amount matched the status's own `amount` (2) every
 * time — which at a SINGLE amount cannot separate "heals its amount" from
 * "heals a flat 2", the same trap `BurnMastery` sat in at 6/3 for five
 * sessions. It is a candidate heal source awaiting a user directive
 * (QUESTIONS.md §68), exactly as `CritHeal` and `LossBlockUp` were.
 *
 * **Why this is a census and not the exclusion "widening".** DECISIONS
 * 2026-08-30 forbids fixing an exception by dropping whatever fails. The guard
 * against that is the composition assertion below: the excluded set must be
 * EXACTLY {Regen: 4, Intimidating: 12} and the full-corpus miss count must
 * equal the excluded count. A third source cannot be quietly absorbed — it
 * turns this red, which is how `Intimidating` itself was found.
 */
const CO_PRESENT_HEAL_SOURCES = ["Regen", "Intimidating"] as const;

const withoutCoPresentHeal = exAll.filter((e) =>
  [0, 1].every((s) => {
    const st = e.beforeStatus[s as 0 | 1];
    if (st.SecondWind === undefined) return true;
    return CO_PRESENT_HEAL_SOURCES.every((k) => st[k] === undefined || st[k] === 0);
  }),
);

/** The held-arm misses, decomposed by which other status the side was carrying. */
function heldMissCensus(xs: typeof exAll): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of xs) {
    for (const s of [0, 1] as const) {
      if (!e.beforeStatus[s].SecondWind) continue;
      if (e.afterStatus[s].SecondWind === 0) continue;
      if (e.heal[s] === undefined) continue;
      for (const k of Object.keys(e.beforeStatus[s])) {
        if (k === "SecondWind") continue;
        out[k] = (out[k] ?? 0) + 1;
      }
    }
  }
  return out;
}

describe("SecondWind", () => {
  it("heals exactly its stored amount when spent, and spends to 0", () => {
    const r = secondWindRule(withoutCoPresentHeal);
    expect(r.spentHealsFullAmount.ok).toBe(r.spentHealsFullAmount.n);
    expect(r.spentHealsFullAmount.n).toBe(26);  /* [session 121] was 19 — +6 from the four day-20699 Tier-2 runs. The `ok === n` assertion above HELD across all six, so this is the rule reproducing on new observations, not a pin loosened to fit. */  /* [session 114] was 9 (30-dir slice, Regen-only exclusion) */ /* [session 130, day 20708] was 25 */
  });

  it("does nothing at all while it is held", () => {
    const r = secondWindRule(withoutCoPresentHeal);
    expect(r.heldDoesNothing.ok).toBe(r.heldDoesNothing.n);
    expect(r.heldDoesNothing.n).toBe(52);  /* [session 121] was 44 — +8 from the four day-20699 Tier-2 runs, `ok === n` again HELD across all eight. */  /* [session 114] was 16 */
  });

  it("⚠ the exceptions are EXACTLY two co-present heal sources — pinned so the exclusion cannot widen", () => {
    // The exclusion is only honest if it is exactly the undefined-measurement
    // set. Asserted three ways: the census names the sources and their counts,
    // the excluded observation counts match, and the full-corpus miss count
    // equals the excluded count — so nothing that PASSES is thrown away and
    // nothing that FAILS remains.
    expect(heldMissCensus(exAll)).toEqual({ Regen: 4, Intimidating: 12 });

    const full = secondWindRule(exAll);
    const filtered = secondWindRule(withoutCoPresentHeal);
    expect(full.spentHealsFullAmount.n - filtered.spentHealsFullAmount.n).toBe(11); /* [session 130, day 20708] was 7 */
    expect(full.heldDoesNothing.n - filtered.heldDoesNothing.n).toBe(48); /* [session 130, day 20708] was 40 */

    const misses =
      full.spentHealsFullAmount.n - full.spentHealsFullAmount.ok +
      (full.heldDoesNothing.n - full.heldDoesNothing.ok);
    expect(misses).toBe(17);  /* [session 114] was 5 — +12 Intimidating */
  });

  it("⚠ every `Intimidating` held-arm miss healed exactly the status's own amount", () => {
    // The observation, stated at the strength it actually has. NOT a model:
    // every occurrence is at amount 2, so "heals its amount" and "heals a flat
    // 2" are indistinguishable here. A single observation at any other amount
    // separates them, and turns this red rather than sliding a number.
    const seen: { amount: number; heal: number }[] = [];
    for (const e of exAll) {
      for (const s of [0, 1] as const) {
        const st = e.beforeStatus[s];
        if (!st.SecondWind || e.afterStatus[s].SecondWind === 0) continue;
        if (e.heal[s] === undefined || st.Intimidating === undefined) continue;
        seen.push({ amount: st.Intimidating, heal: e.heal[s]! });
      }
    }
    expect(seen.length).toBe(12);
    for (const o of seen) expect(o.heal).toBe(o.amount);
    expect(new Set(seen.map((o) => o.amount))).toEqual(new Set([2]));
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

/**
 * [session 130, [USER] "Model it" 2026-09-13] `Vengeance`. Runs on `exAll`:
 * every claim here is universal ("of what was observed, all obeyed"), and the
 * population lives in eight runs that a sliding window would drop.
 *
 * The n are pinned EXACTLY, not as floors, so corpus growth reddens this file
 * and forces the next session to re-read the rule on new data — the same
 * bargain every pin in this repo makes. Update the n; never loosen `ok === n`.
 */
describe("Vengeance", () => {
  const vg = vengeanceRules(exAll);

  it("⭐ an ARMED attacker deals floor(x * 1.25), crit before it, Weak / Vulnerable / block after — 29 of 29", () => {
    expect(vg.damage.n).toBe(29);
    expect(vg.damage.ok).toBe(vg.damage.n);
  });

  it("⭐ ARMS on a loss, HOLDS on a loss, is CONSUMED when the holder deals — 164 of 164", () => {
    expect(vg.trigger.n).toBe(166 /* [session 131, day 20709] was 164 */);
    expect(vg.trigger.ok).toBe(vg.trigger.n);
  });

  it("does nothing to the holder as VICTIM — 8 of 8", () => {
    expect(vg.victimInert.n).toBe(8);
    expect(vg.victimInert.ok).toBe(vg.victimInert.n);
  });

  it("separates the composition order where the corpus can — the two rejected orders fail on real exchanges", () => {
    // run-2026-08-29-17-53-12/state-094: ATK 25, attacker Weak 1, took 23.
    // Vengeance-first: floor(floor(25*1.25)*0.75) = floor(31*0.75) = 23.
    // Weak-first would be floor(floor(25*0.75)*1.25) = floor(18*1.25) = 22.
    expect(vengeanceDamage({ atk: 25, crit: false, vengeance: 25, weak: true, vulnerable: false, block: false })).toBe(23);
    // run-2026-08-31-03-26-52/state-116: ATK 30, Weak 1, took 27 — the session-113
    // "+5 residue". One floor over the product would give floor(28.125) = 28.
    expect(vengeanceDamage({ atk: 30, crit: false, vengeance: 25, weak: true, vulnerable: false, block: false })).toBe(27);
    // run-2026-09-09-17-33-58/state-130: crit, ATK 39, took 97 = floor(78*1.25).
    expect(vengeanceDamage({ atk: 39, crit: true, vengeance: 25, weak: false, vulnerable: false, block: false })).toBe(97);
  });

  it("⛔ refuses to extrapolate an armed amount the corpus has never shown", () => {
    // Every armed status reads 25. "+amount%" is the natural reading of a
    // val1-15 pickup and it is NOT a measurement — fail closed instead.
    expect(vengeanceMultiplier(25)).toBe(1.25);
    expect(vengeanceMultiplier(15)).toBeUndefined();
    expect(vengeanceDamage({ atk: 20, crit: false, vengeance: 15, weak: false, vulnerable: false, block: false })).toBeUndefined();
  });

  it("the trigger is a LOSS, not taking damage, and a tie consumes it like a win", () => {
    expect(vengeanceAfter(undefined, -1, false)).toBe(25);
    expect(vengeanceAfter(25, -1, false)).toBe(25);
    expect(vengeanceAfter(undefined, 1, true)).toBeUndefined();
    expect(vengeanceAfter(undefined, 0, true)).toBeUndefined();
    expect(vengeanceAfter(25, 0, true)).toBeUndefined();
    expect(vengeanceAfter(25, 1, true)).toBeUndefined();
  });
});
