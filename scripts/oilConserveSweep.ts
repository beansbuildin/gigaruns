/**
 * scripts/oilConserveSweep.ts — [session 67 §1] score the oil policies under
 * the CONSERVE objective, which is a different objective from the one
 * `scripts/oilTimingSweep.ts` was built for.
 *
 * ## Why this is a new script and not an edit to the old one
 *
 * `oilTimingSweep.ts` ranks arms by **catch-rate delta**, and its table is
 * quoted verbatim in `handoff/OIL-POLICY.md` as the evidence for the shipped
 * policy. Those numbers are still correct and were re-verified byte-for-byte
 * this session at n=8000. What changed is not the measurement but the
 * QUESTION: the user's 2026-08-21 directive ranks arms by how few oils they
 * burn for the fish they win.
 *
 *   > "use oils only on an as-needed basis. If the autofisher believes it can
 *   > catch the fish without oil, don't use the oil — conserve inventory for
 *   > future casts. The priority is to use mana to get the fish as close as
 *   > possible to caught, with the oils as a backup to guarantee a catch if
 *   > need be."
 *
 * Editing the old script's headline would silently restate a settled
 * recommendation under a new objective, which is exactly the move CLAUDE.md
 * rule 9 is about. So: same `runArm`, same seeds, same control — new metric,
 * new file.
 *
 * ## THE METRIC, and the degenerate answer it has to be protected from
 *
 * The headline is **oils per extra fish** = `oilsSpent / (Δcatch × n)`, the
 * directive's own currency and the one session 66 priced the Relaxing trigger
 * in (~6 oils per extra fish from the corpus).
 *
 * Taken alone that metric has a trivial optimum: `never` spends zero oils and
 * catches zero extra fish, so its ratio is 0/0 and every argument from "fewest
 * oils per fish" ends at "use no oils". The directive does not say that — it
 * says use them as a BACKUP. So `never` is reported as the control it is, and
 * the ranking is over arms that actually spend, with the MARGINAL cost of each
 * step up shown beside the average. The marginal column is where the answer
 * actually lives; see §2 of the output.
 *
 * ## MODELLED, NOT OBSERVED
 *
 * Unchanged from `oilTimingSweep.ts`, and it bounds everything below: the
 * corpus has one fully-captured oil cast, which confirms the mechanics and
 * cannot score an effect. `dendren.oils.policyApproved` ships false and
 * nothing here is shipped (session-67 brief §1d).
 */

import {
  simulateCast,
  matcherFishPolicy,
} from "../src/sim/fishing/castSim.js";
import { runArm, pairedDelta, type PairedDelta } from "./oilTimingSweep.js";
import {
  PAYLOAD_OIL_EFFECTS,
  MEASURED_CONSUME_COSTS_TURN,
  OIL_TIMING_POLICIES,
  conservingOil,
  neverOil,
  onDemand,
  focusWhenEmptyOnly,
  bestKillProbability,
  bestConnectProbabilityFromFrozenCell,
  NEVER_FIRES_THRESHOLD,
  ALWAYS_FIRES_THRESHOLD,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  type OilTimingPolicy,
} from "../src/strategy/fishing/oilTiming.js";

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}pp`;

/**
 * Oils per extra fish, with the interval carried through from the paired
 * catch-rate CI. `hi` on the delta is the CHEAPEST end (more fish for the same
 * oils), so the ratio interval inverts — reported low-to-high so it reads as
 * an interval rather than as two numbers in policy order.
 */
export function oilsPerExtraFish(d: PairedDelta, oils: number, n: number): { point: number; lo: number; hi: number } | null {
  const fish = d.deltaCatchRate * n;
  if (oils === 0 || fish <= 0) return null;
  const fLo = d.lo * n;
  const fHi = d.hi * n;
  return {
    point: oils / fish,
    lo: fHi > 0 ? oils / fHi : Number.POSITIVE_INFINITY,
    hi: fLo > 0 ? oils / fLo : Number.POSITIVE_INFINITY,
  };
}

const fmtRatio = (r: ReturnType<typeof oilsPerExtraFish>) =>
  r === null ? "—" : `${r.point.toFixed(2)} [${r.lo.toFixed(2)}, ${Number.isFinite(r.hi) ? r.hi.toFixed(2) : "∞"}]`;

interface Row {
  policy: OilTimingPolicy;
  catchRate: number;
  oils: number;
  delta: PairedDelta;
  ratio: ReturnType<typeof oilsPerExtraFish>;
}

function scoreArms(runs: number, amount: number, arms: readonly OilTimingPolicy[]): Row[] {
  const control = runArm(runs, neverOil, MEASURED_CONSUME_COSTS_TURN, amount);
  const rows: Row[] = [];
  for (const p of arms) {
    const arm = p.name === neverOil.name ? control : runArm(runs, p, MEASURED_CONSUME_COSTS_TURN, amount);
    const delta = pairedDelta(p.name, arm.caughtBySeed, control.caughtBySeed);
    rows.push({
      policy: p,
      catchRate: arm.summary.catchRate,
      oils: arm.summary.oilsSpent,
      delta,
      ratio: oilsPerExtraFish(delta, arm.summary.oilsSpent, runs),
    });
  }
  return rows;
}

function printRows(rows: readonly Row[]): void {
  console.log(
    `  ${"policy".padEnd(30)} ${"catch".padStart(8)} ${"Δ vs never".padStart(11)} ${"oils".padStart(6)} ` +
      `${"OILS PER EXTRA FISH [95% CI]".padStart(30)}`,
  );
  for (const r of rows) {
    console.log(
      `  ${r.policy.name.padEnd(30)} ${pct(r.catchRate).padStart(8)} ${pp(r.delta.deltaCatchRate).padStart(11)} ` +
        `${String(r.oils).padStart(6)} ${fmtRatio(r.ratio).padStart(30)}`,
    );
  }
}

/**
 * **THE FINITE-STOCK ARM — the only place "conserve inventory for FUTURE
 * CASTS" is actually modelled.**
 *
 * Every per-cast number above hands each cast a fresh oil, so a policy that
 * spends twice as many oils is never punished for running dry. That is the
 * right frame for pricing a trigger and the wrong frame for the directive,
 * whose whole premise is that the stock is shared across a day's casts.
 *
 * Here the stock is a single pool drawn down across `casts` casts in order,
 * and the score is TOTAL FISH — no ratios, no deltas, just how many the day
 * caught. A conserving policy wins here if and only if the oils it saved
 * bought a catch on a later cast that the spendthrift policy had already run
 * out for.
 *
 * The default shape is the real one: **20 casts, the server's daily cap**, and
 * a stock the user actually holds.
 */
export function runFiniteStock(
  policy: OilTimingPolicy,
  casts: number,
  focusStock: number,
  relaxingStock: number,
  amount: number,
  seed = 1,
): { caught: number; oilsSpent: number; castsDry: number } {
  let focus = focusStock;
  let relaxing = relaxingStock;
  let caught = 0;
  let oilsSpent = 0;
  let castsDry = 0;
  for (let i = 0; i < casts; i++) {
    if (focus <= 0 && relaxing <= 0) castsDry++;
    const r = simulateCast({
      policy: matcherFishPolicy,
      seed: seed + i,
      oils: {
        policy,
        costsTurn: MEASURED_CONSUME_COSTS_TURN,
        effects: { focusRestore: amount, fishDamage: amount },
        focusOilHeld: focus,
        relaxingOilHeld: relaxing,
      },
    });
    if (r.outcome === "caught") caught++;
    for (const k of r.oilsUsed) {
      if (k === "focus") focus--;
      else relaxing--;
      oilsSpent++;
    }
  }
  return { caught, oilsSpent, castsDry };
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 8000);
  const amount = PAYLOAD_OIL_EFFECTS.fishDamage;
  console.log("▸ oilConserveSweep — session 67 §1, the CONSERVE objective");
  console.log("  MODELLED, NOT OBSERVED. Nothing here is shipped; liveFishing.ts still plays onDemandTriggers.");
  console.log(`  costsTurn=${MEASURED_CONSUME_COSTS_TURN} (measured, session 64/65), amount=${amount}, n=${runs}/arm, paired on seed.`);

  // ── §1. THE FREE RE-RANK, which the brief asked for before anything is built.
  console.log("\n── §1  THE EXISTING ARMS, RE-RANKED UNDER THE NEW OBJECTIVE ──");
  console.log("  No new code in this table. Same six policies, same seeds, same numbers — a different sort key.");
  const existing = OIL_TIMING_POLICIES.filter((p) => !p.name.startsWith("conserve"));
  const base = scoreArms(runs, amount, existing);
  printRows([...base].sort((a, b) => (a.ratio?.point ?? Infinity) - (b.ratio?.point ?? Infinity)));

  const onD = base.find((r) => r.policy.name === onDemand.name)!;
  const fwe = base.find((r) => r.policy.name === focusWhenEmptyOnly.name)!;
  const marginalOils = onD.oils - fwe.oils;
  const marginalFish = (onD.delta.deltaCatchRate - fwe.delta.deltaCatchRate) * runs;
  console.log(
    `\n  THE MARGINAL STEP, which the average column hides:\n` +
      `    on-demand over focus-when-empty-only costs ${marginalOils} extra oils for ${marginalFish.toFixed(1)} extra fish\n` +
      `    = ${(marginalOils / marginalFish).toFixed(2)} OILS PER EXTRA FISH at the margin, against ` +
      `${fmtRatio(fwe.ratio)} for the focus arm on average.\n` +
      `    That margin IS the Relaxing trigger, and it is what the directive is asking about.`,
  );

  // ── §2. THE NECESSITY GATE, and the two degeneracies it sits between.
  console.log("\n── §2  THE NECESSITY GATE ──");
  console.log("  The gate fires when the bot's own best chance is BELOW the threshold, so the dial's endpoints ARE");
  console.log("  the two failure modes: 0 = never fires, >1 = always fires (i.e. exactly on-demand).");
  const dials: OilTimingPolicy[] = [
    conservingOil({ relaxing: ALWAYS_FIRES_THRESHOLD, focus: ALWAYS_FIRES_THRESHOLD }),
    conservingOil({ relaxing: 0.9, focus: 0.9 }),
    // The ZERO-PARAMETER reading of the directive, and the one §2b says is
    // available: fire unless the bot can GUARANTEE the outcome without the oil.
    conservingOil({ relaxing: 1, focus: 1 }),
    conservingOil(RECOMMENDED_NECESSITY_THRESHOLDS),
    conservingOil({ relaxing: 0.5, focus: 0.5 }),
    conservingOil({ relaxing: 0.25, focus: 0.25 }),
    conservingOil({ relaxing: NEVER_FIRES_THRESHOLD, focus: NEVER_FIRES_THRESHOLD }),
    conservingOil({ relaxing: NEVER_FIRES_THRESHOLD, focus: RECOMMENDED_NECESSITY_THRESHOLDS.focus }),
    // The decomposition: gate ONE oil at a time, leaving the other on
    // on-demand's ungated trigger. This is what separates "the gate saves oil"
    // from "the gate saves oil AND catches more", and attributes each half.
    conservingOil({ relaxing: ALWAYS_FIRES_THRESHOLD, focus: RECOMMENDED_NECESSITY_THRESHOLDS.focus }),
    conservingOil({ relaxing: RECOMMENDED_NECESSITY_THRESHOLDS.relaxing, focus: ALWAYS_FIRES_THRESHOLD }),
  ];
  printRows(scoreArms(runs, amount, dials));

  // ── §2b. WHY THE THRESHOLD BARELY MATTERS — the diagnostic that turns a
  // fitted-looking number into a robust one.
  console.log("\n── §2b  IS THE THRESHOLD A FITTED PARAMETER? ──");
  const killPs: number[] = [];
  const connectPs: number[] = [];
  const probe: OilTimingPolicy = {
    name: "probe",
    thesis: "records the gate's own input at every moment on-demand's triggers fire, then plays on-demand exactly.",
    decide: (s, e) => {
      const wanted = onDemand.decide(s, e);
      if (wanted.includes("relaxing")) killPs.push(bestKillProbability(s));
      if (wanted.includes("focus")) connectPs.push(bestConnectProbabilityFromFrozenCell(s));
      return wanted;
    },
  };
  runArm(runs, probe, MEASURED_CONSUME_COSTS_TURN, amount);
  const histogram = (xs: readonly number[], label: string) => {
    const bins = [0, 0.001, 0.25, 0.5, 0.75, 0.999, 1.0001];
    const counts = new Array(bins.length - 1).fill(0);
    for (const x of xs) for (let i = 0; i < bins.length - 1; i++) if (x >= bins[i]! && x < bins[i + 1]!) counts[i]++;
    console.log(`  ${label} (n=${xs.length})`);
    const names = ["exactly 0", "(0, 0.25)", "[0.25, 0.5)", "[0.5, 0.75)", "[0.75, 1)", "exactly 1"];
    for (let i = 0; i < counts.length; i++) {
      console.log(`    ${names[i]!.padEnd(13)} ${String(counts[i]).padStart(6)}  ${((counts[i]! / xs.length) * 100).toFixed(1)}%`);
    }
  };
  histogram(killPs, "bestKillProbability, at every turn the LETHAL trigger fired");
  histogram(connectPs, "bestConnectProbabilityFromFrozenCell, at every turn the METER trigger fired");

  // ── §3. THE FINITE-STOCK DAY.
  const casts = 20;
  console.log(`\n── §3  A REAL DAY: ${casts} casts (the server cap), ONE shared stock ──`);
  console.log("  This is the only table where 'conserve inventory for future casts' is a real constraint.");
  console.log("  Stock is drawn down in cast order; a policy that empties it early plays the rest of the day dry.");
  const stocks: [number, number][] = [[18, 0], [8, 8], [4, 4], [2, 2], [40, 40]];
  const dayArms: OilTimingPolicy[] = [neverOil, onDemand, focusWhenEmptyOnly, conservingOil(RECOMMENDED_NECESSITY_THRESHOLDS)];
  const reps = 400;
  console.log(`  ${"stock (focus,relax)".padEnd(22)} ${dayArms.map((a) => a.name.slice(0, 20).padStart(21)).join("")}`);
  for (const [f, r] of stocks) {
    const cells = dayArms.map((a) => {
      let caught = 0;
      let oils = 0;
      for (let k = 0; k < reps; k++) {
        const out = runFiniteStock(a, casts, f, r, amount, 1 + k * casts);
        caught += out.caught;
        oils += out.oilsSpent;
      }
      return `${(caught / reps).toFixed(2)}f/${(oils / reps).toFixed(1)}o`.padStart(21);
    });
    console.log(`  ${`${f} focus, ${r} relaxing`.padEnd(22)} ${cells.join("")}`);
  }
  console.log(`  (mean fish caught / mean oils spent per ${casts}-cast day, ${reps} days per cell)`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) main();
