/**
 * scripts/reversalDispersion.ts — [session 51 §6] is the k=2 reversal rate
 * HETEROGENEOUS across casts, or is the spread just binomial noise?
 *
 * This is the one-line measurement SPEC-fishing.md's "per-cast reversal
 * parameter" section says to take before anyone builds an adaptive-per-cast
 * parameter. The rule it enforces: an adaptive-per-unit parameter is only
 * worth building once the between-unit variance EXCEEDS the within-unit
 * sampling variance.
 *
 * Committed rather than run once and thrown away because the session-51 brief
 * killed the idea on numbers that did not replicate at 88 casts (its 0.80
 * dispersion ratio measured 1.452 here, and its "no cast never reverses"
 * measured 3). A claim that decides whether to build something should be
 * re-runnable by the next reader, on the corpus they actually have.
 *
 * The statistic is Pearson's dispersion: chi2 = sum_c (rev_c - n_c p)^2 /
 * (n_c p (1-p)) over casts, divided by df = casts - 1. A ratio of 1 is exactly
 * binomial; below 1 is under-dispersed (nothing to model); above 1 means real
 * between-cast spread. The p-value is the upper tail of chi2 on df.
 *
 * Scored set: casts whose step class is 2, restricted to hops where BOTH the
 * hop and its predecessor are 2-steps — the only pairs on which "reversal"
 * is defined — and to casts with at least 2 such pairs, since a single hop
 * carries no within-cast information about its own rate.
 *
 * Usage: npx tsx scripts/reversalDispersion.ts [path-to-fish-patterns.jsonl]
 */

import { join } from "node:path";

import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { castHops } from "../src/strategy/fishing/contextualFallback.js";
import { classifyStep } from "../src/strategy/fishing/stepClass.js";

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");

/** Upper tail of the chi-square distribution — regularized incomplete gamma Q(k/2, x/2). */
export function chiSquareUpperTail(x: number, k: number): number {
  if (x <= 0) return 1;
  const a = k / 2;
  const xx = x / 2;
  const lgamma = (z: number): number => {
    // Lanczos approximation, sufficient for the df this script ever sees.
    const g = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    const zz = z - 1;
    let s = 0.99999999999980993;
    for (let i = 0; i < g.length; i++) s += g[i]! / (zz + i + 1);
    const t = zz + g.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(s);
  };
  if (xx < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let i = 0; i < 1000; i++) {
      ap += 1;
      del *= xx / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-xx + a * Math.log(xx) - lgamma(a));
  }
  let b = xx + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const de = d * c;
    h *= de;
    if (Math.abs(de - 1) < 1e-15) break;
  }
  return Math.exp(-xx + a * Math.log(xx) - lgamma(a)) * h;
}

export interface DispersionResult {
  casts: number;
  reversals: number;
  pairs: number;
  rate: number;
  chi2: number;
  df: number;
  ratio: number;
  pValue: number;
  alwaysReverse: number;
  neverReverse: number;
}

export function reversalDispersion(records = loadTransitionRecords(DEFAULT_PATH)): DispersionResult {
  const casts = groupByCast(records).filter(isCleanCast);
  const per: { n: number; rev: number }[] = [];
  for (const c of casts) {
    const hops = castHops(c);
    if (classifyStep([c.start, ...hops.map((h) => h.to)]) !== 2) continue;
    let n = 0;
    let rev = 0;
    for (const h of hops) {
      if (!h.prev) continue;
      const d = { dx: h.to.x - h.from.x, dy: h.to.y - h.from.y };
      // "Reversal" is only defined when BOTH hops are 2-steps.
      if (Math.abs(d.dx) + Math.abs(d.dy) !== 2) continue;
      if (Math.abs(h.prev.dx) + Math.abs(h.prev.dy) !== 2) continue;
      n++;
      if (d.dx === -h.prev.dx && d.dy === -h.prev.dy) rev++;
    }
    if (n >= 2) per.push({ n, rev });
  }
  const pairs = per.reduce((a, b) => a + b.n, 0);
  const reversals = per.reduce((a, b) => a + b.rev, 0);
  const rate = pairs > 0 ? reversals / pairs : 0;
  const chi2 =
    rate > 0 && rate < 1 ? per.reduce((a, c) => a + (c.rev - c.n * rate) ** 2 / (c.n * rate * (1 - rate)), 0) : 0;
  const df = Math.max(1, per.length - 1);
  return {
    casts: per.length,
    reversals,
    pairs,
    rate,
    chi2,
    df,
    ratio: chi2 / df,
    pValue: chiSquareUpperTail(chi2, df),
    alwaysReverse: per.filter((c) => c.rev === c.n).length,
    neverReverse: per.filter((c) => c.rev === 0).length,
  };
}

function main() {
  const path = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? DEFAULT_PATH;
  const r = reversalDispersion(loadTransitionRecords(path));
  console.log(`\n▸ reversalDispersion.ts — ${path}`);
  console.log(`  k=2 casts with >= 2 comparable hop pairs: ${r.casts}`);
  console.log(`  pooled reversal: ${r.reversals}/${r.pairs} = ${(r.rate * 100).toFixed(1)}%`);
  console.log(`  casts that ALWAYS reverse: ${r.alwaysReverse}   NEVER reverse: ${r.neverReverse}`);
  console.log(
    `  dispersion ratio (chi2/df): ${r.ratio.toFixed(3)}   (chi2 = ${r.chi2.toFixed(2)}, df = ${r.df}, p = ${r.pValue.toFixed(4)})`,
  );
  console.log(
    r.ratio <= 1
      ? "  => UNDER-dispersed: the spread is at or below binomial. Nothing to model per cast."
      : r.pValue < 0.05
        ? "  => OVER-dispersed at p < 0.05: real between-cast heterogeneity. A per-cast parameter is a live candidate."
        : "  => over-dispersed but NOT significant. Suggestive only — do not build on it, re-run as the corpus grows.",
  );
  console.log("");
}

const isMain = process.argv[1]?.endsWith("reversalDispersion.ts");
if (isMain) main();
