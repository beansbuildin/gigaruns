/**
 * STATUS EFFECT MECHANICS — the residual §B could not explain.
 *
 * [session 101 §D, QUESTIONS.md §59]
 *
 * ## Why this exists
 *
 * Session 101 §B (`scripts/procEffectSize.ts`, QUESTIONS.md §58) measured what
 * the rolled stats DO when they proc, and found that its entire error term was
 * one thing: every exchange that missed the null, and every proc exchange that
 * missed its rule, carried a non-empty `statusEffects` array. Status-clean, the
 * rules held 72/72. So the statuses are not a separate curiosity — they are the
 * remaining unknown in the damage number, and CAPTURE-1 has listed them as
 * uncaptured since it was written.
 *
 * They were never uncaptured. They are on every player object in the corpus.
 *
 * ## What the corpus actually contains
 *
 * Six statuses, not the four CAPTURE-1 names:
 *
 *     Burn 1388   Weak 477   Vulnerable 427   SecondWind 223
 *     Regen 176   Steadfast 65
 *
 * **`SecondWind` and `Steadfast` are not in CAPTURE-1's list at all**, and
 * **`lifesteal` — which IS in that list — does not exist as a status.** There is
 * no proportional heal anywhere in the corpus; see `unexplainedHeals()`.
 *
 * ## The one field that misleads
 *
 * Every entry is `{type, amount}`, and `amount` does NOT mean the same thing
 * across types. Read as magnitude everywhere, it is wrong three times out of six:
 *
 * - **`Burn`** — magnitude. The tick equals it exactly.
 * - **`Regen`** — magnitude, spent down. Heals its value, then decrements by 1.
 * - **`SecondWind`** — magnitude, stored. Heals its value ONCE, then sits at 0.
 * - **`Weak` / `Vulnerable`** — NOT magnitude. The multiplier is fixed and
 *   identical at amount 1, 2, 3 and 4; the number is a countdown.
 * - **`amount: 0` means INERT, not absent-and-cleared.** A `Weak` at 0 leaves
 *   damage at exactly 1.000x, indistinguishable from having no `Weak` at all —
 *   and 0 is the single most common value on `Weak`, `Vulnerable`, `SecondWind`
 *   and `Steadfast`. Anything that tests `"Weak" in statusEffects` rather than
 *   the amount will be wrong on the majority of occurrences.
 *
 * ## What this does NOT do
 *
 * It writes nothing into the simulator. CAPTURE-1's prohibition stands, and it
 * still binds: `tenacity` and `intuition` have no mechanic, `SecondWind`'s
 * trigger is unknown, and `Steadfast` is unmeasured at n=11. This is evidence,
 * not authorisation.
 *
 * Re-runnable as volume accumulates:  `npx tsx scripts/statusEffects.ts`
 */

import { loadExchanges, dealtDamage, wilson, type Exchange, type LoadOptions } from "./procEffectSize.js";

/** Every status type observed. `SecondWind`/`Steadfast` are additions to CAPTURE-1's list. */
export const STATUS_TYPES = ["Burn", "Weak", "Vulnerable", "SecondWind", "Regen", "Steadfast"] as const;
export type StatusType = (typeof STATUS_TYPES)[number];

/** `Weak` scales damage DEALT by the afflicted; `Vulnerable` scales damage TAKEN. Both floor. */
export const WEAK_MULTIPLIER = 0.75;
export const VULNERABLE_MULTIPLIER = 1.25;

export interface Tally {
  ok: number;
  n: number;
}

/**
 * `Burn` deals its amount as damage every exchange, on an `OnDamage` row with
 * `source: "burn"`.
 *
 * The tick matches the AFTER-state amount, not the before-state one — a burn
 * applied this exchange ticks the same exchange (161 of 522 had no prior burn
 * at all). Measured against before-state it looks like a 303/522 rule with two
 * families of exception; measured against after-state it is exact.
 */
export function burnRule(exchanges: Exchange[]): Tally {
  let ok = 0;
  let n = 0;
  for (const ex of exchanges) {
    for (const side of [0, 1] as const) {
      const after = ex.afterStatus[side].Burn;
      const tick = ex.burn[side];
      if (after === undefined && tick === 0) continue;
      n++;
      if (tick === (after ?? 0)) ok++;
    }
  }
  return { ok, n };
}

/**
 * [session 108] **`BurnMastery` amplifies the TICK without touching the
 * recorded AMOUNT**, which is why `burnRule` above suddenly acquired
 * exceptions when session 108's batch landed.
 *
 * The split is total and has no off-diagonal cell. On the full corpus:
 *
 * ```
 *   attacker holds BurnMastery = false   tick === after   719/719
 *   attacker holds BurnMastery = true    tick === after     0/12   (all 6/3)
 * ```
 *
 * So `burnRule`'s invariant was never wrong — it was INCOMPLETE, and stating
 * it over the whole population hid a real mechanic inside an "exception rate".
 * Split out, the no-mastery arm is exceptionless at a LARGER n than the
 * combined rule ever managed.
 *
 * **What is NOT determined, and needs a capture rather than more of the same:**
 * every one of the 12 observations is `after: 3` -> `tick: 6`, all from a
 * single run (`run-2026-08-29-17-53-12`). A x2 multiplier and a flat +3 fit
 * that data identically. Separating them needs a BurnMastery burn tick at any
 * amount other than 3 — do not quote "BurnMastery doubles burn" as settled
 * until one exists.
 */
export function burnMasterySplit(exchanges: Exchange[]): { plain: Tally; mastery: Tally; pairs: Record<string, number> } {
  const plain: Tally = { ok: 0, n: 0 };
  const mastery: Tally = { ok: 0, n: 0 };
  const pairs: Record<string, number> = {};
  for (const ex of exchanges) {
    for (const side of [0, 1] as const) {
      const after = ex.afterStatus[side].Burn;
      const tick = ex.burn[side];
      if (after === undefined && tick === 0) continue;
      // The burn was applied by the OTHER side, so that is whose boons matter.
      const held = (ex.boons?.[1 - side] ?? []).includes("BurnMastery");
      const t = held ? mastery : plain;
      t.n++;
      if (tick === (after ?? 0)) t.ok++;
      else if (held) pairs[`${tick}/${after ?? 0}`] = (pairs[`${tick}/${after ?? 0}`] ?? 0) + 1;
    }
  }
  return { plain, mastery, pairs };
}

/**
 * `Weak` and `Vulnerable` as exact floor multipliers on the damage number.
 *
 * Isolated deliberately: no proc may have fired, the OTHER side must carry
 * neither `Weak` nor `Vulnerable`, and this side must carry only the one being
 * measured. Without that isolation the two compose and neither is measurable.
 *
 * `amount` is excluded from the prediction on purpose — it does not enter it.
 */
export function scaleRule(exchanges: Exchange[], status: "Weak" | "Vulnerable"): Tally & { byAmount: Record<number, Tally> } {
  const onAttacker = status === "Weak";
  const mult = onAttacker ? WEAK_MULTIPLIER : VULNERABLE_MULTIPLIER;
  const byAmount: Record<number, Tally> = {};
  let ok = 0;
  let n = 0;

  for (const ex of exchanges) {
    if (Object.values(ex.flags).some(Boolean)) continue;
    for (const victim of [0, 1] as const) {
      const attacker = (1 - victim) as 0 | 1;
      const atk = ex.atk[attacker];
      if (!dealtDamage(ex, attacker) || typeof atk !== "number" || atk <= 0) continue;

      const side = onAttacker ? attacker : victim;
      const other = onAttacker ? victim : attacker;
      if (ex.beforeStatus[other].Weak !== undefined || ex.beforeStatus[other].Vulnerable !== undefined) continue;
      const otherOne = status === "Weak" ? "Vulnerable" : "Weak";
      if (ex.beforeStatus[side][otherOne] !== undefined) continue;

      const amount = ex.beforeStatus[side][status];
      if (amount === undefined || amount === 0) continue; // 0 is inert — measured separately

      const hit = ex.taken[victim] === Math.floor(atk * mult);
      n++;
      if (hit) ok++;
      const bucket = (byAmount[amount] ??= { ok: 0, n: 0 });
      bucket.n++;
      if (hit) bucket.ok++;
    }
  }
  return { ok, n, byAmount };
}

/**
 * The claim that `amount: 0` is INERT — damage lands at exactly the attacker's
 * ATK, indistinguishable from the status being absent.
 *
 * This is the finding most likely to be coded wrong by someone reading the
 * field for the first time, because 0 is the MOST COMMON amount on four of the
 * six types.
 */
export function inertAtZero(exchanges: Exchange[], status: StatusType): Tally {
  const onAttacker = status === "Weak";
  let ok = 0;
  let n = 0;
  for (const ex of exchanges) {
    if (Object.values(ex.flags).some(Boolean)) continue;
    for (const victim of [0, 1] as const) {
      const attacker = (1 - victim) as 0 | 1;
      const atk = ex.atk[attacker];
      if (!dealtDamage(ex, attacker) || typeof atk !== "number" || atk <= 0) continue;
      const side = onAttacker ? attacker : victim;
      const other = onAttacker ? victim : attacker;
      if (ex.beforeStatus[other].Weak !== undefined || ex.beforeStatus[other].Vulnerable !== undefined) continue;
      if (ex.beforeStatus[side][status] !== 0) continue;
      if (status !== "Weak" && ex.beforeStatus[side].Weak) continue;
      if (status !== "Vulnerable" && ex.beforeStatus[side].Vulnerable) continue;
      n++;
      if (ex.taken[victim] === atk) ok++;
    }
  }
  return { ok, n };
}

/**
 * `Regen` heals its CURRENT amount, then decays by 1 within the same exchange.
 *
 * **The heal is skipped for a unit that DIED this exchange, and the decay is
 * not.** All 7 apparent exceptions to the heal rule were lethal exchanges —
 * incoming damage at or above the unit's HP — and excluding them makes the rule
 * exact rather than 53/60. A dead unit does not regenerate; its counter still
 * ticks down. Found by checking the residual rather than reporting 88.3%.
 */
export function regenRule(exchanges: Exchange[]): { healed: Tally; decayed: Tally } {
  const healed: Tally = { ok: 0, n: 0 };
  const decayed: Tally = { ok: 0, n: 0 };
  for (const ex of exchanges) {
    for (const side of [0, 1] as const) {
      const before = ex.beforeStatus[side].Regen;
      if (before === undefined || before === 0) continue;
      if (!ex.died[side]) {
        healed.n++;
        if (ex.heal[side] === before) healed.ok++;
      }
      const after = ex.afterStatus[side].Regen;
      decayed.n++;
      if (after === before - 1) decayed.ok++;
    }
  }
  return { healed, decayed };
}

/**
 * `SecondWind` is a one-shot stored heal: it holds `amount` HP, and when it
 * triggers it heals EXACTLY that and drops to 0.
 *
 * The MAGNITUDE is exact. The TRIGGER is not determined — it is not lethality
 * and it is not a fixed HP threshold: it fired at 40/40 HP against 10 incoming
 * and held at 40/40 against 14. n = 10 fires. Reported as undetermined rather
 * than fitted.
 */
export function secondWindRule(exchanges: Exchange[]): { spentHealsFullAmount: Tally; heldDoesNothing: Tally } {
  const spent: Tally = { ok: 0, n: 0 };
  const held: Tally = { ok: 0, n: 0 };
  for (const ex of exchanges) {
    for (const side of [0, 1] as const) {
      const before = ex.beforeStatus[side].SecondWind;
      if (!before) continue;
      const after = ex.afterStatus[side].SecondWind;
      if (after === 0) {
        spent.n++;
        if (ex.heal[side] === before) spent.ok++;
      } else {
        held.n++;
        if (ex.heal[side] === undefined) held.ok++;
      }
    }
  }
  return { spentHealsFullAmount: spent, heldDoesNothing: held };
}

/**
 * Heals that no status explains — the test for lifesteal, which CAPTURE-1 lists
 * and which does NOT exist.
 *
 * Returns each heal with the damage its side dealt. If lifesteal were real these
 * would sit at a constant ratio; they do not (0.2 to 0.8, and one heals with 0
 * damage dealt). They are instead constant WITHIN a run — one value per run per
 * side — which is the signature of a flat per-exchange effect, not a proportional one.
 */
export function unexplainedHeals(exchanges: Exchange[]): { heal: number; dealt: number; label: string; side: 0 | 1 }[] {
  const out: { heal: number; dealt: number; label: string; side: 0 | 1 }[] = [];
  for (const ex of exchanges) {
    for (const side of [0, 1] as const) {
      const heal = ex.heal[side];
      if (heal === undefined) continue;
      if (ex.beforeStatus[side].Regen !== undefined) continue;
      if (ex.beforeStatus[side].SecondWind) continue;
      if (ex.flags[`tenacityProc${side}`]) continue;
      out.push({ heal, dealt: ex.taken[(1 - side) as 0 | 1], label: ex.label, side });
    }
  }
  return out;
}

export function loadStatusExchanges(options: LoadOptions = {}): Exchange[] {
  return loadExchanges(options);
}

function main(): void {
  const ex = loadExchanges();
  const pct = (t: Tally) => (t.n === 0 ? "n/a" : `${((100 * t.ok) / t.n).toFixed(1)}%`);
  console.log(`\n▸ status effect mechanics — ${ex.length} exchanges\n`);

  const counts: Record<string, number> = {};
  for (const e of ex) for (const s of [0, 1] as const) for (const k of Object.keys(e.beforeStatus[s])) counts[k] = (counts[k] ?? 0) + 1;
  console.log(`  types present: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  (SecondWind and Steadfast are NOT in CAPTURE-1's list; lifesteal is in it and does not exist)\n`);

  const burn = burnRule(ex);
  console.log(`  Burn        tick === after-state amount            ${burn.ok}/${burn.n}  ${pct(burn)}`);
  // [session 108] The combined rule above now carries exceptions, and every
  // one of them is a BurnMastery tick. Printed split so the headline number
  // is not read as a decaying invariant — see `burnMasterySplit`.
  const bms = burnMasterySplit(ex);
  console.log(`              without BurnMastery                     ${bms.plain.ok}/${bms.plain.n}  ${pct(bms.plain)}`);
  console.log(
    `              with BurnMastery (amplified)            ${bms.mastery.ok}/${bms.mastery.n}` +
      `  pairs ${JSON.stringify(bms.pairs)} — x2 vs +3 UNSEPARATED (only after=3 ever seen)`,
  );

  for (const s of ["Weak", "Vulnerable"] as const) {
    const r = scaleRule(ex, s);
    const mult = s === "Weak" ? WEAK_MULTIPLIER : VULNERABLE_MULTIPLIER;
    const [lo, hi] = wilson(r.ok, r.n);
    console.log(
      `  ${s.padEnd(11)} damage === floor(ATK * ${mult})           ${r.ok}/${r.n}  95% CI [${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}%]` +
        `\n              independent of amount: ${Object.entries(r.byAmount).map(([a, t]) => `${a}: ${t.ok}/${t.n}`).join(", ")}`,
    );
  }

  const rg = regenRule(ex);
  console.log(`  Regen       heals its amount (if it survived)     ${rg.healed.ok}/${rg.healed.n}  ${pct(rg.healed)}`);
  console.log(`              then decays by 1, same exchange       ${rg.decayed.ok}/${rg.decayed.n}  ${pct(rg.decayed)}`);

  const sw = secondWindRule(ex);
  console.log(`  SecondWind  when spent, heals exactly its amount   ${sw.spentHealsFullAmount.ok}/${sw.spentHealsFullAmount.n}  ${pct(sw.spentHealsFullAmount)}`);
  console.log(`              while held, does nothing              ${sw.heldDoesNothing.ok}/${sw.heldDoesNothing.n}  ${pct(sw.heldDoesNothing)}`);
  console.log(`              TRIGGER CONDITION: undetermined (n=${sw.spentHealsFullAmount.n})`);

  console.log(`\n  amount === 0 is INERT (damage lands at exactly 1.00x ATK):`);
  for (const s of ["Weak", "Vulnerable", "SecondWind"] as const) {
    const t = inertAtZero(ex, s);
    if (t.n > 0) console.log(`    ${s.padEnd(11)} ${t.ok}/${t.n}  ${pct(t)}`);
  }

  const heals = unexplainedHeals(ex);
  const ratios = heals.filter((h) => h.dealt > 0).map((h) => h.heal / h.dealt);
  console.log(
    `\n  lifesteal   DOES NOT EXIST. ${heals.length} heals no status explains, ratios to damage dealt ` +
      `${Math.min(...ratios).toFixed(2)}-${Math.max(...ratios).toFixed(2)} — not proportional.` +
      `\n              Values are 2 or 4 and constant WITHIN a run: a flat effect, not lifesteal.\n`,
  );
}

const isMain = process.argv[1] && process.argv[1].endsWith("statusEffects.ts");
if (isMain) main();
