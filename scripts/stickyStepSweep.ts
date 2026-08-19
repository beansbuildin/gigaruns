/**
 * scripts/stickyStepSweep.ts — [session 49, brief §2] the paired
 * leave-one-cast-out gate on the sticky step-count latent
 * (`stickyStepDistribution`) against the shipped hard-zero ring model.
 *
 * The brief's gate has two columns and the second one is the point:
 *   - mean log loss, as a PAIRED difference on identical transitions;
 *   - the count of zero-probability events, which "should go to zero by
 *     construction; if it does not, the implementation is wrong."
 *
 * Methodology is `fishingRingCV.ts`'s, deliberately, so the two are readable
 * side by side: the CV unit is the CAST, `isCleanCast` filtering, the scored
 * set is hops with a previous displacement, the same top-1 tie-break, and
 * the step count derived CAUSALLY from the held-out cast's own hops strictly
 * before the scored one.
 *
 * The one difference from `fishingRingCV.ts` is the pairing: both arms score
 * the SAME transition inside one loop, so the difference is per-transition
 * and a bootstrap over CASTS gives it an interval. Session 48's standing
 * finding — the replay is for DIFFERENCES, never absolutes — applies to this
 * script too.
 *
 * Usage: npx tsx scripts/stickyStepSweep.ts [path-to-fish-patterns.jsonl]
 */

import { join } from "node:path";

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { replayCorpus } from "../src/sim/fishing/offPolicyReplay.js";

import type { Cell } from "../src/sim/fishing/geometry.js";
import { cellKey } from "../src/sim/fishing/geometry.js";
import { groupByCast, isCleanCast, loadTransitionRecords, type Cast } from "../src/sim/fishing/transitionCorpus.js";
import { castHops } from "../src/strategy/fishing/contextualFallback.js";
import {
  buildStepClassTable,
  classifyStep,
  lastStepClass,
  ringDistribution,
  ringDistributionUnknownClass,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  DEFAULT_SWITCH_PROBABILITY,
} from "../src/strategy/fishing/stepClass.js";

const DEFAULT_PATH = join("data", "fish-patterns.jsonl");
const LOG_FLOOR = 1e-9;

type Dist = Map<string, { cell: Cell; p: number }>;

function top1(dist: Dist): { cell: Cell; p: number } | undefined {
  const values = [...dist.values()];
  if (values.length === 0) return undefined;
  const maxP = Math.max(...values.map((v) => v.p));
  const tied = values.filter((v) => Math.abs(v.p - maxP) < 1e-9);
  tied.sort((a, b) => a.cell.x - b.cell.x || a.cell.y - b.cell.y);
  return tied[0];
}

interface TurnScore {
  castId: string;
  shippedLl: number;
  stickyLl: number;
  shippedHit: boolean;
  stickyHit: boolean;
  shippedZero: boolean;
  stickyZero: boolean;
}

function scoreAll(casts: readonly Cast[], gridSize: number, s: number): TurnScore[] {
  const out: TurnScore[] = [];
  for (let i = 0; i < casts.length; i++) {
    const held = casts[i]!;
    const training = casts.filter((_, j) => j !== i);
    const table = buildStepClassTable(training);
    const hops = castHops(held);
    for (let h = 0; h < hops.length; h++) {
      const hop = hops[h]!;
      if (!hop.prev) continue;
      const history: Cell[] = [held.start, ...hops.slice(0, h).map((x) => x.to)];

      // Arm A — what ships today: the cast-wide MODE, ring as a hard constraint.
      const modeK = classifyStep(history);
      const shipped =
        modeK === null
          ? ringDistributionUnknownClass(hop.from, hop.prev, table, gridSize, DEFAULT_RING_MODEL_OPTIONS)
          : ringDistribution(hop.from, modeK, hop.prev, table, gridSize, DEFAULT_RING_MODEL_OPTIONS);

      // Arm B — the proposal: the LAST observed count, marginalised over the
      // sticky chain.
      const lastK = lastStepClass(history);
      const sticky = stickyStepDistribution(hop.from, lastK, hop.prev, table, gridSize, DEFAULT_RING_MODEL_OPTIONS, s);

      const key = cellKey(hop.to);
      const pA = shipped.get(key)?.p ?? 0;
      const pB = sticky.get(key)?.p ?? 0;
      const tA = top1(shipped);
      const tB = top1(sticky);
      out.push({
        castId: held.castId,
        shippedLl: pA > 0 ? -Math.log(pA) : -Math.log(LOG_FLOOR),
        stickyLl: pB > 0 ? -Math.log(pB) : -Math.log(LOG_FLOOR),
        shippedHit: !!tA && cellKey(tA.cell) === key,
        stickyHit: !!tB && cellKey(tB.cell) === key,
        shippedZero: pA <= 0,
        stickyZero: pB <= 0,
      });
    }
  }
  return out;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Cluster bootstrap over CASTS, not turns — turns inside a cast share the
 * cast's step count, which is exactly the thing under test, so resampling
 * turns would understate the interval.
 */
function bootstrapCI(scores: readonly TurnScore[], stat: (s: TurnScore) => number, iters = 4000): [number, number] {
  const byCast = new Map<string, TurnScore[]>();
  for (const s of scores) {
    const arr = byCast.get(s.castId) ?? [];
    arr.push(s);
    byCast.set(s.castId, arr);
  }
  const groups = [...byCast.values()];
  // Deterministic PRNG so a committed number is reproducible.
  let seed = 20260819;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const means: number[] = [];
  for (let it = 0; it < iters; it++) {
    const pooled: number[] = [];
    for (let g = 0; g < groups.length; g++) {
      for (const s of groups[Math.floor(rnd() * groups.length)]!) pooled.push(stat(s));
    }
    means.push(mean(pooled));
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * iters)]!, means[Math.floor(0.975 * iters)]!];
}

function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const records = loadTransitionRecords(path);
  const allCasts = groupByCast(records);
  const casts = allCasts.filter(isCleanCast);
  const gridSize = casts[0]?.gridSize ?? 4;

  console.log(`\n▸ stickyStepSweep.ts — ${path}`);
  console.log(`  ${records.length} transitions, ${allCasts.length} casts, ${casts.length} clean.\n`);

  console.log("── the sweep over the switch probability s (leave-one-cast-out) ──");
  console.log("       s     sticky top1   sticky logLoss   sticky zeroP");
  for (const s of [0, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2]) {
    const sc = scoreAll(casts, gridSize, s);
    const hit = sc.filter((x) => x.stickyHit).length;
    console.log(
      `  ${s.toFixed(3).padStart(6)}   ${((hit / sc.length) * 100).toFixed(1).padStart(6)}%      ${mean(sc.map((x) => x.stickyLl)).toFixed(3).padStart(7)}          ${sc.filter((x) => x.stickyZero).length}`,
    );
  }

  const s = DEFAULT_SWITCH_PROBABILITY;
  const scores = scoreAll(casts, gridSize, s);
  const n = scores.length;

  console.log(`\n── the GATE, paired at the shipped default s=${s} (n=${n} transitions) ──`);
  const shippedLl = mean(scores.map((x) => x.shippedLl));
  const stickyLl = mean(scores.map((x) => x.stickyLl));
  const shippedZero = scores.filter((x) => x.shippedZero).length;
  const stickyZero = scores.filter((x) => x.stickyZero).length;
  const shippedHit = scores.filter((x) => x.shippedHit).length;
  const stickyHit = scores.filter((x) => x.stickyHit).length;

  console.log(`  shipped (mode + hard ring):  logLoss ${shippedLl.toFixed(3)}   top1 ${shippedHit}/${n} = ${((shippedHit / n) * 100).toFixed(1)}%   zeroP ${shippedZero}`);
  console.log(`  sticky  (last + marginal):   logLoss ${stickyLl.toFixed(3)}   top1 ${stickyHit}/${n} = ${((stickyHit / n) * 100).toFixed(1)}%   zeroP ${stickyZero}`);

  const dLl = mean(scores.map((x) => x.stickyLl - x.shippedLl));
  const [lo, hi] = bootstrapCI(scores, (x) => x.stickyLl - x.shippedLl);
  console.log(`\n  paired ΔlogLoss (sticky − shipped): ${dLl.toFixed(3)}  [${lo.toFixed(3)}, ${hi.toFixed(3)}]  (negative = sticky better)`);
  const dHit = mean(scores.map((x) => (x.stickyHit ? 1 : 0) - (x.shippedHit ? 1 : 0)));
  const [hlo, hhi] = bootstrapCI(scores, (x) => (x.stickyHit ? 1 : 0) - (x.shippedHit ? 1 : 0));
  console.log(`  paired Δtop-1   (sticky − shipped): ${(dHit * 100).toFixed(2)}pp  [${(hlo * 100).toFixed(2)}pp, ${(hhi * 100).toFixed(2)}pp]  (positive = sticky better)`);

  console.log("\n  the structural check — zero-probability events must go to ZERO by construction:");
  console.log(`    shipped ${shippedZero}  →  sticky ${stickyZero}   ${stickyZero === 0 ? "PASS" : "FAIL — the implementation is wrong"}`);

  console.log("\n  where the log loss actually moves (per cast, |Δ| > 0.05):");
  const byCast = new Map<string, { d: number; n: number; zero: number }>();
  for (const x of scores) {
    const e = byCast.get(x.castId) ?? { d: 0, n: 0, zero: 0 };
    e.d += x.stickyLl - x.shippedLl;
    e.n++;
    if (x.shippedZero) e.zero++;
    byCast.set(x.castId, e);
  }
  const rows = [...byCast.entries()].map(([id, e]) => ({ id, mean: e.d / e.n, n: e.n, zero: e.zero }));
  rows.sort((a, b) => a.mean - b.mean);
  for (const r of rows.filter((r) => Math.abs(r.mean) > 0.05)) {
    console.log(`    ${r.id}  n=${String(r.n).padStart(2)}  ΔlogLoss ${r.mean >= 0 ? "+" : ""}${r.mean.toFixed(3)}${r.zero ? `   (${r.zero} shipped zero-prob event(s))` : ""}`);
  }
  const unchanged = rows.length - rows.filter((r) => Math.abs(r.mean) > 0.05).length;
  console.log(`    ...and ${unchanged} cast(s) moved by less than 0.05 — the bounded cost on the constant casts.\n`);

  replayArm();
}

/**
 * The second half of the §2 gate: the same comparison on the REPLAY, paired
 * per cast on fixed trajectories. Session 48's standing rule applies —
 * absolutes from this harness are not forecasts, only the DIFFERENCE is.
 */
function replayArm() {
  const traces = loadCastTraces().filter(isCleanTrace);
  console.log(`── the replay arm, paired per cast on ${traces.length} clean traces ──`);
  const shipped = replayCorpus(traces, { hardRing: true });
  console.log(
    `  before (hard ring):  caught ${shipped.caught}/${shipped.casts} = ${((shipped.caught / shipped.casts) * 100).toFixed(1)}%   per-turn hit ${shipped.hits}/${shipped.shots} = ${((shipped.hits / shipped.shots) * 100).toFixed(1)}%`,
  );
  console.log("\n       s     caught         per-turn hit      Δcaught (paired, casts)   Δhit turns (b/c)");
  for (const s of [0, 0.005, 0.01, 0.025, 0.05, 0.1]) {
    const arm = replayCorpus(traces, { stickySwitchProbability: s });
    // Paired at the CAST level for the catch outcome, and at the TURN level
    // for the hit indicator (a McNemar pair), because those are the units the
    // two outcomes are actually measured on.
    const byId = new Map(shipped.results.map((r) => [r.docId, r]));
    let gained = 0;
    let lost = 0;
    for (const r of arm.results) {
      const base = byId.get(r.docId);
      if (!base) continue;
      const a = r.outcome === "caught" ? 1 : 0;
      const b = base.outcome === "caught" ? 1 : 0;
      if (a > b) gained++;
      else if (a < b) lost++;
    }
    let hb = 0;
    let hc = 0;
    for (const r of arm.results) {
      const base = byId.get(r.docId);
      if (!base) continue;
      const n = Math.min(r.turns.length, base.turns.length);
      for (let i = 0; i < n; i++) {
        const x = r.turns[i]!.hit;
        const y = base.turns[i]!.hit;
        if (x && !y) hb++;
        else if (!x && y) hc++;
      }
    }
    console.log(
      `  ${s.toFixed(3).padStart(6)}   ${String(arm.caught).padStart(2)}/${arm.casts} = ${((arm.caught / arm.casts) * 100).toFixed(1).padStart(5)}%   ${String(arm.hits).padStart(3)}/${String(arm.shots).padStart(3)} = ${((arm.hits / arm.shots) * 100).toFixed(1).padStart(5)}%      +${gained} / -${lost}                    +${hb} / -${hc}`,
    );
  }
  console.log("");
}

const isMain = process.argv[1]?.endsWith("stickyStepSweep.ts");
if (isMain) main();
