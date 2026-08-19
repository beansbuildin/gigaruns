/**
 * scripts/auditMovementIndependence.ts — [session 47, brief §1b precondition]
 *
 * **The off-policy replay is only valid if the fish's movement is independent
 * of whether your shot hit.** If a hit changes what the fish does next, then
 * replaying a different policy against a recorded trajectory is replaying a
 * trajectory that would not have occurred, and every counterfactual number
 * downstream is fiction. This script tests that directly and is the gate on
 * `scripts/offPolicyReplay.ts` — run it first, do not skip it.
 *
 * **Why the test is even coherent.** Within one turn the event order is
 * `FISH_MOVED -> CARD_PLAYED -> HIT`: the fish moves before the card resolves,
 * so turn t's card provably cannot affect turn t's move. The only channel a
 * dependence could use is turn t's hit affecting turn t+1's move. That is what
 * is measured here.
 *
 * **Design.** Hit/miss is NOT randomly assigned — a hit happens because the
 * fish moved somewhere the focus/card could reach, so raw hit-vs-miss movement
 * distributions are confounded by exactly the thing (the previous move) that
 * FACT 2 says predicts the next one. Everything below therefore conditions on
 * the step class `k` and the previous displacement, per the brief:
 *
 *  1. **Stratified permutation test.** Strata are `(k, prevDelta)`; a
 *     likelihood-ratio G statistic for hit-label x next-delta is summed across
 *     strata, and the null is built by shuffling the hit labels WITHIN each
 *     stratum. This is exact under the null and needs no asymptotics, which
 *     matters at these counts — a chi-square p-value on tables this sparse
 *     would be meaningless. A second, stricter pass adds the from-cell to the
 *     stratum key, since the grid edge truncates the legal ring.
 *  2. **The two FACT 2 effects, split by hit.** P(repeat prev delta) and
 *     P(exact reversal) are where a dependence would most plausibly show,
 *     they are single scalars rather than a whole table, and they therefore
 *     have far more power than (1). Reported per class with Wilson intervals
 *     and their own within-stratum permutation p-value on the difference.
 *
 * A large p-value is not proof of independence — it is failure to detect
 * dependence at this corpus size, which is the most the corpus can say. The
 * report prints the achievable precision so that is legible rather than
 * implied.
 *
 * Usage: npx tsx scripts/auditMovementIndependence.ts [--iters=20000] [--seed=1]
 */

import { join } from "node:path";

import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { classifyStep, type StepClass } from "../src/strategy/fishing/stepClass.js";
import type { Cell } from "../src/sim/fishing/geometry.js";

interface Obs {
  castId: string;
  k: StepClass;
  /** The displacement the fish made on turn t (the move BEFORE the one being predicted). */
  prevDelta: string;
  /** The displacement the fish made on turn t+1 — the outcome. */
  nextDelta: string;
  /** Did the card played on turn t hit? The treatment. */
  hit: boolean;
  /** The cell the fish was standing on when it made `nextDelta`. */
  from: Cell;
  isRepeat: boolean;
  isReversal: boolean;
}

function deltaOf(from: Cell, to: Cell): string {
  return `${to.x - from.x},${to.y - from.y}`;
}

function negate(d: string): string {
  const [dx, dy] = d.split(",").map(Number);
  return `${-dx!},${-dy!}`;
}

/** Mulberry32 — same tiny deterministic PRNG shape used elsewhere in the sim. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collect(traces: CastTrace[]): Obs[] {
  const out: Obs[] = [];
  for (const t of traces) {
    const positions = t.turns.map((x) => x.fishPosition);
    const k = classifyStep(positions);
    if (k === null) continue;
    // turn i's move is positions[i-1] -> positions[i]; turn i's card outcome
    // is t.turns[i].play. The pair we need is (hit on turn i, move on turn
    // i+1), with the move on turn i as the conditioning previous delta.
    for (let i = 1; i + 1 < t.turns.length; i++) {
      const play = t.turns[i]!.play;
      if (!play) continue;
      const prevDelta = deltaOf(positions[i - 1]!, positions[i]!);
      const nextDelta = deltaOf(positions[i]!, positions[i + 1]!);
      if (prevDelta === "0,0" || nextDelta === "0,0") continue; // a non-move carries no direction
      out.push({
        castId: t.docId,
        k,
        prevDelta,
        nextDelta,
        hit: play.hit,
        from: positions[i]!,
        isRepeat: nextDelta === prevDelta,
        isReversal: nextDelta === negate(prevDelta),
      });
    }
  }
  return out;
}

// ── stratified permutation test on the full next-delta table ───────────────

function gStatistic(rows: { hit: boolean; nextDelta: string }[]): number {
  // Likelihood-ratio G for a 2 x m table. Zero cells contribute zero.
  const n = rows.length;
  if (n === 0) return 0;
  const byLabel = new Map<boolean, Map<string, number>>([
    [true, new Map()],
    [false, new Map()],
  ]);
  const colTotals = new Map<string, number>();
  const rowTotals = new Map<boolean, number>([
    [true, 0],
    [false, 0],
  ]);
  for (const r of rows) {
    const m = byLabel.get(r.hit)!;
    m.set(r.nextDelta, (m.get(r.nextDelta) ?? 0) + 1);
    colTotals.set(r.nextDelta, (colTotals.get(r.nextDelta) ?? 0) + 1);
    rowTotals.set(r.hit, rowTotals.get(r.hit)! + 1);
  }
  let g = 0;
  for (const label of [true, false]) {
    const rowTotal = rowTotals.get(label)!;
    if (rowTotal === 0) continue;
    for (const [col, colTotal] of colTotals) {
      const obs = byLabel.get(label)!.get(col) ?? 0;
      if (obs === 0) continue;
      const exp = (rowTotal * colTotal) / n;
      g += 2 * obs * Math.log(obs / exp);
    }
  }
  return g;
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

interface PermResult {
  observed: number;
  pValue: number;
  strata: number;
  informativeStrata: number;
  n: number;
}

/**
 * Sums a per-stratum statistic and permutes the hit labels WITHIN stratum.
 * `stat` receives one stratum's rows. Strata whose labels are all identical
 * contribute a constant under every permutation and are counted but carry no
 * information; they are reported so a p-value built on three real strata
 * cannot be mistaken for one built on thirty.
 */
function stratifiedPermutation(
  obs: Obs[],
  key: (o: Obs) => string,
  stat: (rows: Obs[]) => number,
  iters: number,
  seed: number,
): PermResult {
  const strata = new Map<string, Obs[]>();
  for (const o of obs) {
    const s = strata.get(key(o)) ?? [];
    s.push(o);
    strata.set(key(o), s);
  }
  const groups = [...strata.values()];
  const informative = groups.filter((g) => g.some((o) => o.hit) && g.some((o) => !o.hit));
  const observed = groups.reduce((s, g) => s + stat(g), 0);

  const rand = rng(seed);
  const labelPools = groups.map((g) => g.map((o) => o.hit));
  let atLeast = 0;
  for (let it = 0; it < iters; it++) {
    let total = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const pool = labelPools[gi]!;
      shuffleInPlace(pool, rand);
      const permuted = groups[gi]!.map((o, idx) => ({ ...o, hit: pool[idx]! }));
      total += stat(permuted);
    }
    if (total >= observed - 1e-9) atLeast++;
  }
  return {
    observed,
    // +1/+1 is the standard unbiased permutation p-value — never reports 0.
    pValue: (atLeast + 1) / (iters + 1),
    strata: groups.length,
    informativeStrata: informative.length,
    n: obs.length,
  };
}

// ── the two FACT 2 scalars ────────────────────────────────────────────────

function rateDiff(rows: Obs[], pick: (o: Obs) => boolean): number {
  let hitN = 0;
  let hitK = 0;
  let missN = 0;
  let missK = 0;
  for (const r of rows) {
    if (r.hit) {
      hitN++;
      if (pick(r)) hitK++;
    } else {
      missN++;
      if (pick(r)) missK++;
    }
  }
  if (hitN === 0 || missN === 0) return 0;
  return Math.abs(hitK / hitN - missK / missN);
}

function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c / d - half), Math.min(1, c / d + half)];
}

function pct(x: number): string {
  return `${(100 * x).toFixed(1)}%`;
}

function report(label: string, rows: Obs[], pick: (o: Obs) => boolean, iters: number, seed: number): number {
  const hit = rows.filter((r) => r.hit);
  const miss = rows.filter((r) => !r.hit);
  const hk = hit.filter(pick).length;
  const mk = miss.filter(pick).length;
  const [hl, hh] = wilson(hk, hit.length);
  const [ml, mh] = wilson(mk, miss.length);
  const perm = stratifiedPermutation(rows, (o) => `${o.k}|${o.prevDelta}`, (g) => rateDiff(g, pick) * g.length, iters, seed);
  console.log(
    `    ${label.padEnd(26)} after HIT  ${String(hk).padStart(3)}/${String(hit.length).padEnd(3)} = ${pct(hit.length ? hk / hit.length : 0).padStart(6)} [${pct(hl)}, ${pct(hh)}]`,
  );
  console.log(
    `    ${" ".repeat(26)} after MISS ${String(mk).padStart(3)}/${String(miss.length).padEnd(3)} = ${pct(miss.length ? mk / miss.length : 0).padStart(6)} [${pct(ml)}, ${pct(mh)}]`,
  );
  console.log(`    ${" ".repeat(26)} stratified permutation p = ${perm.pValue.toFixed(4)}  (${perm.informativeStrata}/${perm.strata} informative strata)`);
  return perm.pValue;
}

function main() {
  const itersArg = process.argv.find((a) => a.startsWith("--iters="));
  const iters = itersArg ? Number(itersArg.split("=")[1]) : 20000;
  const seedArg = process.argv.find((a) => a.startsWith("--seed="));
  const seed = seedArg ? Number(seedArg.split("=")[1]) : 1;

  const all = loadCastTraces(join("fixtures", "fishing-casts"));
  const clean = all.filter(isCleanTrace);
  const obs = collect(clean);

  console.log(`\n▸ movement-independence audit — is the fish's next move affected by whether your shot hit?\n`);
  console.log(`  corpus: ${all.length} casts, ${clean.length} clean (start_run present + position-continuous)`);
  console.log(`  usable (hit_t, move_{t+1}) pairs with a known previous displacement: ${obs.length}`);
  const hits = obs.filter((o) => o.hit).length;
  console.log(`    after a HIT: ${hits}    after a MISS: ${obs.length - hits}\n`);

  const scalarP: { label: string; p: number }[] = [];
  for (const k of [1, 2] as StepClass[]) {
    const rows = obs.filter((o) => o.k === k);
    const kh = rows.filter((r) => r.hit).length;
    console.log(`  ── class k=${k} — ${rows.length} pairs (${kh} after a hit, ${rows.length - kh} after a miss)`);
    if (rows.length === 0) {
      console.log(`    (no observations)\n`);
      continue;
    }
    scalarP.push({ label: `k=${k} P(repeat)`, p: report("P(repeat prev delta)", rows, (o) => o.isRepeat, iters, seed) });
    scalarP.push({ label: `k=${k} P(reversal)`, p: report("P(exact reversal)", rows, (o) => o.isReversal, iters, seed + 1) });
    console.log("");
  }

  console.log(`  ── full next-delta table, stratified permutation G-test (${iters} iters, seed ${seed})`);
  const coarse = stratifiedPermutation(obs, (o) => `${o.k}|${o.prevDelta}`, (g) => gStatistic(g), iters, seed);
  console.log(
    `    strata = (k, prevDelta)            G = ${coarse.observed.toFixed(3)}   p = ${coarse.pValue.toFixed(4)}   ` +
      `(${coarse.informativeStrata}/${coarse.strata} informative strata, n = ${coarse.n})`,
  );
  const fine = stratifiedPermutation(obs, (o) => `${o.k}|${o.prevDelta}|${o.from.x},${o.from.y}`, (g) => gStatistic(g), iters, seed + 2);
  console.log(
    `    strata = (k, prevDelta, fromCell)  G = ${fine.observed.toFixed(3)}   p = ${fine.pValue.toFixed(4)}   ` +
      `(${fine.informativeStrata}/${fine.strata} informative strata, n = ${fine.n})`,
  );

  console.log(`\n  ── verdict`);
  // Six tests were run (4 scalars + 2 tables). Reading the smallest raw
  // p-value as if it were the only one is exactly how a null corpus produces
  // a "finding"; the family-wise correction is applied here rather than left
  // for the reader to remember.
  const family = [...scalarP, { label: "table (k,prevDelta)", p: coarse.pValue }, { label: "table (k,prevDelta,fromCell)", p: fine.pValue }];
  const smallest = family.reduce((a, b) => (b.p < a.p ? b : a));
  const adjusted = Math.min(1, smallest.p * family.length);
  console.log(`    ${family.length} tests run; smallest raw p = ${smallest.p.toFixed(4)} (${smallest.label}); Bonferroni-adjusted p = ${adjusted.toFixed(4)}.`);
  if (adjusted < 0.05) {
    console.log(`    DEPENDENCE DETECTED. The movement model needs a hit/miss term it does not have, and the`);
    console.log(`    off-policy replay is INVALID as designed. This is the finding, not a setback — stop and report it.\n`);
    process.exitCode = 2;
    return;
  }
  console.log(`    No dependence detected at n = ${obs.length}.`);
  console.log(`    This is failure to detect, not proof of independence — read the Wilson intervals above for what`);
  console.log(`    size of effect this corpus could actually have ruled out. Replay is licensed to proceed.\n`);
}

main();
