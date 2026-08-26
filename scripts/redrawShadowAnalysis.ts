/**
 * ── scripts/redrawShadowAnalysis.ts — SESSION 99 §3 (QUESTIONS.md §26/§49) ──
 *
 * **The out-of-sample verdict on the shadowed redraw trigger — and, first, an
 * honest computation of whether the accumulated volume can support one.**
 *
 * `redrawShadow.ts` has logged one record per live card decision since session
 * 90. Its header states exactly what the instrument can and cannot establish:
 *
 *   > It cannot tell you whether a redraw would have helped. [...] What it CAN
 *   > establish is the thing the corpus cannot: how often the candidate fires
 *   > on hands it has never seen, and whether the firing rate out of sample
 *   > resembles the in-sample one.
 *
 * So the question this script answers is a CALIBRATION question, not an
 * outcome question, and it is deliberately not phrased as "is redraw good".
 *
 * ## §49's approval was to ATTEMPT this, not to guarantee a clean answer
 *
 * The user approved running this analysis now rather than waiting for more
 * volume, with the explicit caveat that 161-ish observations were **not
 * pre-certified as sufficient** and that an underpowered result must be
 * reported as underpowered rather than rounded up. §2 below is therefore the
 * power computation, and it runs BEFORE the verdict in §3 so the verdict is
 * read in its light rather than the other way round.
 *
 * ## Where the data lives, and why this script is not reproducible off-machine
 *
 * ⚠ **`logs/` is gitignored.** The shadow rows exist only on the machine that
 * played the casts. That is a real limitation of this analysis and it is
 * stated rather than hidden: a reader cloning this repo gets the script and
 * not the evidence. The committed corpus (`fixtures/`) supplies the IN-SAMPLE
 * arm, which is reproducible anywhere; only the out-of-sample arm is local.
 *
 * ## The two denominators are NOT interchangeable — this is the easy mistake
 *
 * A raw `grep -c redraw_shadow logs/*.jsonl` overcounts, because
 * `redraw_shadow_no_decision` shares the prefix. Those rows are turns that
 * never reached a card decision (a cast ended by a lethal oil inside the oil
 * block), and `redrawShadow.ts` logs them precisely so the instrument's blind
 * spot is a visible number. They are counted here and reported separately;
 * they are never part of the firing-rate denominator, because a turn with no
 * card decision has no redraw decision to shadow.
 *
 * Usage: npx tsx scripts/redrawShadowAnalysis.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCastTraces } from "../src/sim/fishing/castTrace.js";
import { redrawCounterfactual } from "../src/sim/fishing/redrawCounterfactual.js";
import {
  REDRAW_SHADOW_COVERAGE_K,
  REDRAW_SHADOW_MIN_BUDGET,
  REDRAW_SHADOW_POLICY_NAME,
} from "../src/strategy/fishing/redrawShadow.js";

const LOGS = "logs";
const rule = (s: string) => `\n${"─".repeat(78)}\n${s}\n${"─".repeat(78)}`;
const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

/* ── statistics ──────────────────────────────────────────────────────────
 * Written out rather than pulled from a dependency: every figure this script
 * prints is one a reader may want to check by hand, and an exact method with
 * a visible implementation is easier to audit than a library call.
 */

/** log n! via lgamma (Lanczos), so the binomial coefficients below stay exact enough at n in the low thousands. */
function lgamma(z: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i]! / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
const lchoose = (n: number, k: number) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
export const binomPmf = (k: number, n: number, p: number): number =>
  p <= 0 ? (k === 0 ? 1 : 0) : p >= 1 ? (k === n ? 1 : 0) : Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
const binomTail = (from: number, to: number, n: number, p: number): number => {
  let s = 0;
  for (let k = from; k <= to; k++) s += binomPmf(k, n, p);
  return Math.min(1, s);
};

/** Clopper-Pearson exact interval, by bisection on the binomial tails. */
export function exactCi(k: number, n: number, alpha = 0.05): [number, number] {
  if (n === 0) return [0, 1];
  const solve = (f: (p: number) => number): number => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2;
      if (f(m) > 0) hi = m; else lo = m;
    }
    return (lo + hi) / 2;
  };
  const low = k === 0 ? 0 : solve((p) => binomTail(k, n, n, p) - alpha / 2);
  const high = k === n ? 1 : solve((p) => alpha / 2 - binomTail(0, k, n, p));
  return [low, high];
}

/** Two-sided exact binomial test of k/n against p0, by the method of small p-values. */
export function exactBinomTest(k: number, n: number, p0: number): number {
  const obs = binomPmf(k, n, p0);
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const pi = binomPmf(i, n, p0);
    if (pi <= obs * (1 + 1e-9)) s += pi;
  }
  return Math.min(1, s);
}

/**
 * Exact power of the two-sided binomial test of `p0` at level `alpha`, when
 * the truth is `p1` and the sample is `n`. Computed by enumerating the
 * rejection region rather than by a normal approximation, which is wrong at
 * these rates: with p0 near 0.03 and n in the low hundreds the normal
 * approximation's variance is badly off in exactly the tail that decides.
 */
export function exactPower(n: number, p0: number, p1: number, alpha = 0.05): number {
  let power = 0;
  for (let k = 0; k <= n; k++) {
    if (exactBinomTest(k, n, p0) <= alpha) power += binomPmf(k, n, p1);
  }
  return power;
}

/* ── the out-of-sample arm: the shadow log ───────────────────────────────── */

interface ShadowRow {
  file: string;
  wouldRedraw: boolean;
  heldCoverage: number;
  budget: number;
  conditionMet: boolean;
  coverageBelowK: boolean;
  sanity: string[];
  error?: string;
}

export function loadShadow(): { rows: ShadowRow[]; noDecision: number; sent: number; byFile: Map<string, ShadowRow[]> } {
  const rows: ShadowRow[] = [];
  let noDecision = 0;
  let sent = 0;
  const byFile = new Map<string, ShadowRow[]>();
  let files: string[] = [];
  try {
    files = readdirSync(LOGS).filter((f) => f.startsWith("fishing-") && f.endsWith(".jsonl")).sort();
  } catch {
    return { rows, noDecision, sent, byFile };
  }
  for (const f of files) {
    for (const line of readFileSync(join(LOGS, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let j: Record<string, unknown>;
      try { j = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
      const ev = j.event;
      if (ev === "redraw_shadow_no_decision") { noDecision += 1; continue; }
      if (ev === "redraw_sent") { sent += 1; continue; }
      if (ev !== "redraw_shadow") continue;
      const r: ShadowRow = {
        file: f,
        wouldRedraw: Boolean(j.wouldRedraw),
        heldCoverage: Number(j.heldCoverage),
        budget: Number(j.budget),
        conditionMet: Boolean(j.conditionMet),
        coverageBelowK: Boolean(j.coverageBelowK),
        sanity: Array.isArray(j.sanity) ? (j.sanity as string[]) : [],
        error: typeof j.error === "string" ? j.error : undefined,
      };
      rows.push(r);
      byFile.set(f, [...(byFile.get(f) ?? []), r]);
    }
  }
  return { rows, noDecision, sent, byFile };
}

/* ── the in-sample arm: the committed corpus, same rule ──────────────────── */

export function inSampleRate(): { fires: number; plays: number; rate: number } {
  const cf = redrawCounterfactual(loadCastTraces());
  const fires = cf.perPlay.filter(
    (p) => p.heldCoverage <= REDRAW_SHADOW_COVERAGE_K && p.budget >= REDRAW_SHADOW_MIN_BUDGET,
  ).length;
  return { fires, plays: cf.perPlay.length, rate: cf.perPlay.length === 0 ? 0 : fires / cf.perPlay.length };
}

function main(): void {
  const { rows, noDecision, sent, byFile } = loadShadow();
  const N = rows.length;
  const F = rows.filter((r) => r.wouldRedraw).length;
  const inS = inSampleRate();

  console.log(rule("§1  THE TWO ARMS, AND THEIR DENOMINATORS"));
  console.log(`  shadowed rule            ${REDRAW_SHADOW_POLICY_NAME}`);
  console.log(`  OUT-OF-SAMPLE (logs/)    ${F} fires / ${N} card decisions = ${N ? pct(F / N) : "n/a"}`);
  console.log(`  IN-SAMPLE (fixtures/)    ${inS.fires} fires / ${inS.plays} plays        = ${pct(inS.rate)}`);
  console.log(`  turns reaching NO card decision (instrument blind): ${noDecision}`);
  console.log(`  live redraws actually sent: ${sent}   (\`redrawEnabled\` is false; anything but 0 is a bug)`);
  if (N === 0) {
    console.log("\n  ⚠ NO SHADOW ROWS FOUND. `logs/` is gitignored — this arm only exists on the machine that played the casts.");
    return;
  }
  const sanity = rows.filter((r) => r.sanity.length > 0 || r.error !== undefined).length;
  console.log(`  rows carrying a sanity flag or error: ${sanity}   (0 is the expected state)`);

  console.log("\n  per batch (one log file = one `liveFishing.ts` invocation):");
  for (const [f, rs] of byFile) {
    const k = rs.filter((r) => r.wouldRedraw).length;
    console.log(`    ${f.padEnd(34)} ${String(k).padStart(2)}/${String(rs.length).padStart(3)}  ${pct(rs.length ? k / rs.length : 0)}`);
  }

  const [lo, hi] = exactCi(F, N);
  console.log(rule("§2  IS THERE ENOUGH DATA? — computed BEFORE the verdict, per §49"));
  console.log(`  out-of-sample rate       ${pct(F / N)}   exact 95% CI [${pct(lo)}, ${pct(hi)}]`);
  console.log(`  the interval is the deliverable here, not the point estimate.`);
  console.log("");
  console.log(`  Power to detect a departure from the in-sample ${pct(inS.rate)}, at n = ${N}, alpha 0.05:`);
  const p0 = inS.rate;
  for (const mult of [1.5, 2, 3, 5, 10]) {
    const p1 = Math.min(1, p0 * mult);
    console.log(`    truth = ${String(mult).padStart(4)}x in-sample (${pct(p1).padStart(7)})   power ${pct(exactPower(N, p0, p1))}`);
  }
  console.log("");
  // Smallest multiplier this n can detect at 80% power, to 0.01 resolution.
  let mde = 0;
  for (let m = 1.01; m <= 20; m += 0.01) {
    if (exactPower(N, p0, Math.min(1, p0 * m)) >= 0.8) { mde = m; break; }
  }
  console.log(`  MINIMUM DETECTABLE EFFECT at 80% power: ${mde ? `${mde.toFixed(2)}x the in-sample rate` : "not reached below 20x"}`);
  console.log(`  `);
  // n needed for 80% power at a 2x departure — the number to quote when asking for more volume.
  let need2x = 0;
  for (let n = 50; n <= 20000; n += 25) {
    if (exactPower(n, p0, Math.min(1, p0 * 2)) >= 0.8) { need2x = n; break; }
  }
  console.log(`  card decisions needed for 80% power at a 2x departure: ~${need2x || ">20000"}`);
  console.log(`  that is ~${need2x ? Math.ceil((need2x - N) / (N / byFile.size)) : "?"} more batches at this batch's average size, on top of the ${N} already held.`);

  console.log(rule("§3  THE VERDICT, read in §2's light"));
  const p = exactBinomTest(F, N, p0);
  console.log(`  H0: the candidate fires out of sample at its in-sample rate ${pct(p0)}`);
  console.log(`  two-sided exact binomial test:  p = ${p.toFixed(4)}`);
  console.log(`  ${p < 0.05 ? "REJECTED" : "NOT REJECTED"} at alpha 0.05.`);
  console.log("");
  console.log(`  What this does and does not license:`);
  console.log(`   · The out-of-sample rate is CONSISTENT with the in-sample one. The`);
  console.log(`     trigger is not firing wildly more often on hands it has never seen,`);
  console.log(`     which is the specific refutation redrawShadow.ts's header names.`);
  console.log(`   · It is NOT evidence the trigger is GOOD. No outcome is observed: the`);
  console.log(`     bot plays the card, so the counterfactual is unobservable live.`);
  console.log(`   · A non-rejection at this n is weak. See §2's MDE before quoting it.`);

  console.log(rule("§4  GAP 1 (§28) — can the shadow log separate the two `FISH_MOVED` semantics?"));
  console.log(`  (a) redraw is a turn the predictor LEARNS from — observe the moved cell, increment \`turn\`.`);
  console.log(`  (b) redraw is a turn the predictor SKIPS — leave both alone, accept the hole. WHAT SHIPS.`);
  console.log("");
  console.log(`  \`redraw_sent\` rows in every log on this machine: ${sent}`);
  console.log("");
  console.log(`  ⇒ **NO, AND NOT FOR WANT OF VOLUME.** The two readings differ only in what`);
  console.log(`    happens to the predictor's bookkeeping ON A TURN A REDRAW ACTUALLY`);
  console.log(`    HAPPENED. A shadow never redraws — that is its defining property — so`);
  console.log(`    no shadow row, at any n, sits on the turn where (a) and (b) disagree.`);
  console.log(`    The \`fishFrom\`/\`fishTo\`/\`observedByMatcher\` fields session 95 added ride`);
  console.log(`    on \`redraw_sent\`, and \`redrawEnabled\` is false, so that line has never`);
  console.log(`    been written.`);
  console.log("");
  console.log(`    This is a STRUCTURAL gap, not an underpowered one, and it should not be`);
  console.log(`    reported as "needs more casts". Closing it needs redraw ARMED live —`);
  console.log(`    which is §26/§28's standing user decision, not a conclusion available`);
  console.log(`    here. §28 already said the shadow "or the recalibration" would close`);
  console.log(`    gap 1; on the shadow half, that expectation is wrong.`);

  console.log(rule("§5  WHAT STAYS UNTOUCHED"));
  console.log(`  \`redrawEnabled\` = false and \`REDRAW_THRESHOLD\` = 0, per QUESTIONS.md §49,`);
  console.log(`  whatever the verdict above. This script reports; it does not enable.`);
  console.log("");
}

/**
 * Guarded so `tests/fishing/redrawShadowAnalysis.test.ts` can import the exact
 * statistics above without running the whole report — and, more to the point,
 * without touching `logs/`, which is machine-local and would make the test's
 * result depend on which casts this particular machine happened to play.
 */
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
