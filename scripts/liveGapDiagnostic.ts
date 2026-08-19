/**
 * scripts/liveGapDiagnostic.ts — [session 49, brief §1] the four diagnostics
 * for the live/offline movement-prediction gap: live top-1 4/29 = 13.8%
 * against an offline leave-one-cast-out 46.4%.
 *
 * The session-49 brief eliminates day-leakage, drift and intra-cast
 * clustering as explanations and proposes that the live number lands exactly
 * on a "uniform over the union of both rings" null — i.e. the step-class
 * information never reached the distribution the policy scored. Those are
 * hypotheses (CLAUDE.md §9): Claude (chat) has no fixture access and could
 * not have computed them. This script computes them here.
 *
 * The four diagnostics, in the brief's order:
 *   1. recompute live top-1 BY HAND from `data/ringPrediction.jsonl`,
 *      independent of `ringPredictionReport.ts`;
 *   2. score three null models on the SAME live turns, plus an offline
 *      re-derivation of the very distribution live claims to have used —
 *      if the two disagree, it is a wiring bug, not a modelling one;
 *   3. count how many of the batch's casts alternated step count;
 *   4. verify the logged predicted and actual cells share one coordinate
 *      convention end to end.
 *
 * Read-only. Takes no live action and spends no energy.
 *
 * Usage: npx tsx scripts/liveGapDiagnostic.ts [ringPrediction.jsonl] [fish-patterns.jsonl]
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Cell } from "../src/sim/fishing/geometry.js";
import { cellKey, inGrid, manhattan } from "../src/sim/fishing/geometry.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { castHops, type Displacement } from "../src/strategy/fishing/contextualFallback.js";
import {
  buildStepClassTable,
  classifyStep,
  ringCells,
  ringDistribution,
  ringDistributionUnknownClass,
  DEFAULT_RING_MODEL_OPTIONS,
  type StepClass,
} from "../src/strategy/fishing/stepClass.js";

const DEFAULT_RING_LOG = join("data", "ringPrediction.jsonl");
const DEFAULT_PATTERNS = join("data", "fish-patterns.jsonl");

type Dist = Map<string, { cell: Cell; p: number }>;

interface RingRow {
  castId: string;
  turn: number;
  tier: string;
  stepClass: number | null;
  predicted: [number, number];
  pPredicted: number;
  pActual: number;
  actual: [number, number];
  hit: boolean;
  gridSize: number;
  zoneMapVersion?: string;
  baselinePActual?: number;
  baselineHit?: boolean;
}

function loadRingRows(path: string): RingRow[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as RingRow);
}

/** Absent `zoneMapVersion` means the row predates the field, i.e. the transposed map. Same rule as `ringPredictionReport.ts`. */
function zoneMapVersionOf(r: RingRow): string {
  return r.zoneMapVersion ?? "transposed";
}

function toCell(a: readonly number[]): Cell {
  return { x: a[0]!, y: a[1]! };
}

/** Same deterministic tie-break as `fishingRingCV.ts` / `fishingContextualCV.ts`. */
function top1(dist: Dist): { cell: Cell; p: number } | undefined {
  const values = [...dist.values()];
  if (values.length === 0) return undefined;
  const maxP = Math.max(...values.map((v) => v.p));
  const tied = values.filter((v) => Math.abs(v.p - maxP) < 1e-9);
  tied.sort((a, b) => a.cell.x - b.cell.x || a.cell.y - b.cell.y);
  return tied[0];
}

function uniformOver(cells: readonly Cell[]): Dist {
  const out: Dist = new Map();
  if (cells.length === 0) return out;
  for (const c of cells) out.set(cellKey(c), { cell: c, p: 1 / cells.length });
  return out;
}

function allGridCells(gridSize: number): Cell[] {
  const out: Cell[] = [];
  for (let x = 1; x <= gridSize; x++) for (let y = 1; y <= gridSize; y++) out.push({ x, y });
  return out;
}

/** The union of the k=1 and k=2 rings around `cell` — the support of "moves one or two steps, nothing else known". */
function unionRingCells(cell: Cell, gridSize: number): Cell[] {
  const seen = new Map<string, Cell>();
  for (const k of [1, 2]) for (const c of ringCells(cell, k, gridSize)) seen.set(cellKey(c), c);
  return [...seen.values()];
}

interface Acc {
  name: string;
  n: number;
  correct: number;
  logLossSum: number;
  zeroProb: number;
}
const newAcc = (name: string): Acc => ({ name, n: 0, correct: 0, logLossSum: 0, zeroProb: 0 });

function score(acc: Acc, dist: Dist, actual: Cell) {
  acc.n++;
  const best = top1(dist);
  if (best && cellKey(best.cell) === cellKey(actual)) acc.correct++;
  const p = dist.get(cellKey(actual))?.p ?? 0;
  if (p <= 0) acc.zeroProb++;
  acc.logLossSum += p > 0 ? -Math.log(p) : -Math.log(1e-9);
}

function reportAcc(a: Acc) {
  const pct = a.n > 0 ? (a.correct / a.n) * 100 : 0;
  const ll = a.n > 0 ? a.logLossSum / a.n : 0;
  console.log(
    `  ${a.name.padEnd(46)} n=${String(a.n).padStart(3)}  top1=${a.correct}/${a.n} = ${pct.toFixed(1).padStart(5)}%  logLoss=${ll.toFixed(3).padStart(6)}  zeroP=${a.zeroProb}`,
  );
  return { pct, ll };
}

/** Wilson 95% interval, the project's standard binomial interval. */
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959963985;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}

function main() {
  const ringLogPath = process.argv[2] ?? DEFAULT_RING_LOG;
  const patternsPath = process.argv[3] ?? DEFAULT_PATTERNS;

  const rows = loadRingRows(ringLogPath);
  const records = loadTransitionRecords(patternsPath);
  const allCasts = groupByCast(records);
  const cleanCasts = allCasts.filter(isCleanCast);
  const gridSize = cleanCasts[0]?.gridSize ?? 4;

  // `from` for a live row: the corpus transition at the same (castId, turn).
  const fromAt = new Map<string, { from: Cell; to: Cell }>();
  for (const r of records) {
    fromAt.set(`${r.castId}|${r.turn}`, { from: toCell(r.from), to: toCell(r.to) });
  }

  const live = rows.filter((r) => zoneMapVersionOf(r) === "corrected");
  const castIds = [...new Set(live.map((r) => r.castId))];

  console.log(`\n▸ liveGapDiagnostic.ts — ${ringLogPath} + ${patternsPath}`);
  console.log(
    `  ${rows.length} logged prediction rows total; ${live.length} on the CORRECTED zone map across ${castIds.length} cast(s).`,
  );
  console.log(`  corpus: ${records.length} transitions, ${allCasts.length} casts, ${cleanCasts.length} clean.\n`);

  // ── DIAGNOSTIC 1: recompute top-1 by hand ────────────────────────────────
  console.log("── §1.1 live top-1, recomputed by hand from the raw rows ──");
  const handCorrect = live.filter((r) => r.predicted[0] === r.actual[0] && r.predicted[1] === r.actual[1]).length;
  const loggedCorrect = live.filter((r) => r.hit).length;
  const disagreements = live.filter(
    (r) => (r.predicted[0] === r.actual[0] && r.predicted[1] === r.actual[1]) !== r.hit,
  ).length;
  const [lo, hi] = wilson(handCorrect, live.length);
  console.log(`  by hand (predicted === actual): ${handCorrect}/${live.length} = ${((handCorrect / live.length) * 100).toFixed(1)}%  [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`);
  console.log(`  the rows' own \`hit\` field:      ${loggedCorrect}/${live.length}`);
  console.log(`  rows where the two disagree:    ${disagreements}  ${disagreements === 0 ? "→ no aggregation bug" : "→ REPORTING BUG"}`);

  // The offline LOO figure excludes hops with no previous displacement. Live
  // turn 0 is exactly that hop, so the comparable live subset is turns >= 1.
  const scored = live.filter((r) => r.turn >= 1);
  const scoredCorrect = scored.filter((r) => r.hit).length;
  console.log(
    `  turn>=1 only (the offline LOO's scored set): ${scoredCorrect}/${scored.length} = ${((scoredCorrect / scored.length) * 100).toFixed(1)}%`,
  );
  console.log(
    `  NOTE: the headline 13.8% pools 5 turn-0 rows the offline 46.4% never scores (it skips hops with no prevDelta).\n`,
  );

  // ── DIAGNOSTIC 4 (done early — it gates the rest): coordinate convention ──
  console.log("── §1.4 coordinate convention, end to end ──");
  let missingFrom = 0;
  let actualMatchesCorpus = 0;
  let predOnOwnRing = 0;
  let predOffOwnRing = 0;
  for (const r of live) {
    const rec = fromAt.get(`${r.castId}|${r.turn}`);
    if (!rec) {
      missingFrom++;
      continue;
    }
    if (cellKey(rec.to) === cellKey(toCell(r.actual))) actualMatchesCorpus++;
    if (r.stepClass !== null) {
      if (manhattan(rec.from, toCell(r.predicted)) === r.stepClass) predOnOwnRing++;
      else predOffOwnRing++;
    }
  }
  console.log(`  rows with a corpus \`from\`:                       ${live.length - missingFrom}/${live.length}`);
  console.log(`  logged \`actual\` === corpus \`to\`:                 ${actualMatchesCorpus}/${live.length - missingFrom}`);
  console.log(
    `  logged \`predicted\` sits on its OWN declared k-ring: ${predOnOwnRing}/${predOnOwnRing + predOffOwnRing}  ${predOffOwnRing === 0 ? "→ one convention throughout" : "→ ORIENTATION MISMATCH"}`,
  );
  console.log("  (a transposed predicted cell would land off the ring around the untransposed `from` — this test is what would catch it.)\n");

  // ── DIAGNOSTIC 3: how many casts alternated step count ───────────────────
  console.log("── §1.3 per-cast step-count alternation in the batch ──");
  let alternating = 0;
  for (const id of castIds) {
    const cast = allCasts.find((c) => c.castId === id);
    if (!cast) continue;
    const hops = castHops(cast);
    const lens = hops.map((h) => manhattan(h.from, h.to)).filter((l) => l > 0);
    const distinct = [...new Set(lens)];
    const alt = distinct.length > 1;
    if (alt) alternating++;
    console.log(
      `  ${id}  steps=[${lens.join(",")}]  ${alt ? "ALTERNATES" : `constant k=${distinct[0] ?? "-"}`}${isCleanCast(cast) ? "" : "  (not clean)"}`,
    );
  }
  console.log(`  ${alternating} of ${castIds.length} casts alternated.\n`);

  // ── DIAGNOSTIC 2: null models + an offline re-derivation of the same turns ─
  console.log("── §1.2 null models and an offline re-derivation, on the SAME live turns ──");
  const nullGrid = newAcc("null: uniform over the whole grid");
  const nullUnion = newAcc("null: uniform over the UNION of both rings");
  const nullKRing = newAcc("null: uniform over the legal k-ring (k causal)");
  const offlineRing = newAcc("ring+conditional, re-derived offline (LOO)");
  const loggedLive = newAcc("the LOGGED live distribution (what shipped)");
  const loggedBase = newAcc("the logged paired baseline (contextual)");

  for (const r of live) {
    const rec = fromAt.get(`${r.castId}|${r.turn}`);
    if (!rec) continue;
    const from = rec.from;
    const actual = rec.to;
    const g = r.gridSize || gridSize;

    // Causal history for this turn, straight from the corpus: the cells the
    // fish occupied up to and including `from`. Same construction live used.
    const cast = allCasts.find((c) => c.castId === r.castId)!;
    const hops = castHops(cast);
    const history: Cell[] = [cast.start, ...hops.slice(0, r.turn).map((h) => h.to)];
    const k = classifyStep(history);
    const prevDelta: Displacement | null =
      history.length >= 2
        ? { dx: from.x - history[history.length - 2]!.x, dy: from.y - history[history.length - 2]!.y }
        : null;

    score(nullGrid, uniformOver(allGridCells(g).filter((c) => inGrid(c, g))), actual);
    score(nullUnion, uniformOver(unionRingCells(from, g)), actual);
    score(nullKRing, uniformOver(k === null ? unionRingCells(from, g) : ringCells(from, k as StepClass, g)), actual);

    // Leave-this-cast-out training set — the offline protocol, applied to the
    // exact turns live scored.
    const training = cleanCasts.filter((c) => c.castId !== r.castId);
    const table = buildStepClassTable(training);
    const dist =
      k === null
        ? ringDistributionUnknownClass(from, prevDelta, table, g, DEFAULT_RING_MODEL_OPTIONS)
        : ringDistribution(from, k as StepClass, prevDelta, table, g, DEFAULT_RING_MODEL_OPTIONS);
    score(offlineRing, dist, actual);

    // The logged live numbers, replayed into the same accumulator shape.
    loggedLive.n++;
    if (r.hit) loggedLive.correct++;
    if (r.pActual <= 0) loggedLive.zeroProb++;
    loggedLive.logLossSum += r.pActual > 0 ? -Math.log(r.pActual) : -Math.log(1e-9);
    if (r.baselineHit !== undefined) {
      loggedBase.n++;
      if (r.baselineHit) loggedBase.correct++;
      const bp = r.baselinePActual ?? 0;
      if (bp <= 0) loggedBase.zeroProb++;
      loggedBase.logLossSum += bp > 0 ? -Math.log(bp) : -Math.log(1e-9);
    }
  }

  console.log(`  all ${live.length} live turns (turn 0 included):`);
  reportAcc(nullGrid);
  reportAcc(nullUnion);
  reportAcc(nullKRing);
  const off = reportAcc(offlineRing);
  const shipped = reportAcc(loggedLive);
  reportAcc(loggedBase);

  // ── §1.2b the composition-matched expectation ────────────────────────────
  // `fishingRingCV.ts`'s own header warns that a k=2-heavy live batch read
  // against the class-MIXED corpus figure "would flatter or damn the model for
  // the wrong reason". That warning was written in session 45 and not applied
  // to session 48's readout. Applying it here.
  console.log("\n── §1.2b what should this batch's composition have scored? ──");

  // Per-cast leave-one-out top-1 over the whole corpus, scored on hops WITH a
  // previous displacement — the offline protocol exactly.
  const perCast = new Map<string, { correct: number; n: number; alternating: boolean; k: number | null }>();
  for (const held of cleanCasts) {
    const training = cleanCasts.filter((c) => c.castId !== held.castId);
    const table = buildStepClassTable(training);
    const hops = castHops(held);
    const lens = hops.map((h) => manhattan(h.from, h.to)).filter((l) => l > 0);
    const distinct = [...new Set(lens)];
    let correct = 0;
    let n = 0;
    for (let h = 0; h < hops.length; h++) {
      const hop = hops[h]!;
      if (!hop.prev) continue;
      const history: Cell[] = [held.start, ...hops.slice(0, h).map((x) => x.to)];
      const k = classifyStep(history);
      const dist =
        k === null
          ? ringDistributionUnknownClass(hop.from, hop.prev, table, gridSize, DEFAULT_RING_MODEL_OPTIONS)
          : ringDistribution(hop.from, k as StepClass, hop.prev, table, gridSize, DEFAULT_RING_MODEL_OPTIONS);
      const best = top1(dist);
      n++;
      if (best && cellKey(best.cell) === cellKey(hop.to)) correct++;
    }
    perCast.set(held.castId, {
      correct,
      n,
      alternating: distinct.length > 1,
      k: distinct.length === 1 ? distinct[0]! : null,
    });
  }

  const strata = new Map<string, { correct: number; n: number; casts: number }>();
  for (const [, v] of perCast) {
    const key = v.alternating ? "alternating" : `k=${v.k}`;
    const s = strata.get(key) ?? { correct: 0, n: 0, casts: 0 };
    s.correct += v.correct;
    s.n += v.n;
    s.casts++;
    strata.set(key, s);
  }
  console.log("  corpus leave-one-cast-out top-1, stratified:");
  for (const [key, s] of [...strata.entries()].sort()) {
    console.log(
      `    ${key.padEnd(12)} ${String(s.casts).padStart(2)} cast(s)  ${s.correct}/${s.n} = ${s.n ? ((s.correct / s.n) * 100).toFixed(1) : "-"}%`,
    );
  }

  // Expected hits for THIS batch, weighting each live cast's scored turns by
  // its own stratum's corpus rate.
  let expected = 0;
  let batchN = 0;
  console.log("\n  the batch, cast by cast (turn>=1, matching the offline scored set):");
  for (const id of castIds) {
    const v = perCast.get(id);
    const liveRows = live.filter((r) => r.castId === id && r.turn >= 1);
    const key = v ? (v.alternating ? "alternating" : `k=${v.k}`) : "?";
    // Rate from the stratum EXCLUDING this cast, so the expectation is not
    // partly built from the observations it is being compared against.
    let sc = 0;
    let sn = 0;
    for (const [cid, w] of perCast) {
      if (cid === id) continue;
      const wk = w.alternating ? "alternating" : `k=${w.k}`;
      if (wk === key) {
        sc += w.correct;
        sn += w.n;
      }
    }
    const rate = sn > 0 ? sc / sn : 0;
    expected += rate * liveRows.length;
    batchN += liveRows.length;
    const got = liveRows.filter((r) => r.hit).length;
    console.log(
      `    ${id}  ${key.padEnd(12)} ${liveRows.length} turn(s)  stratum rate ${(rate * 100).toFixed(1)}%  expected ${(rate * liveRows.length).toFixed(2)}  observed ${got}`,
    );
  }
  const observedHits = live.filter((r) => r.turn >= 1 && r.hit).length;
  const [blo, bhi] = wilson(observedHits, batchN);
  console.log(
    `\n  composition-matched expectation: ${expected.toFixed(2)}/${batchN} = ${((expected / batchN) * 100).toFixed(1)}%`,
  );
  console.log(
    `  observed:                        ${observedHits}/${batchN} = ${((observedHits / batchN) * 100).toFixed(1)}%  [${(blo * 100).toFixed(1)}%, ${(bhi * 100).toFixed(1)}%]`,
  );
  const inside = expected / batchN >= blo && expected / batchN <= bhi;
  console.log(
    `  the composition-matched expectation is ${inside ? "INSIDE" : "OUTSIDE"} the observed 95% interval` +
      `${inside ? " → no gap left to explain." : " → a real residual gap."}`,
  );
  console.log(
    `  (for contrast, the class-MIXED corpus average — the number session 48 compared against — is the wrong comparator here.)`,
  );

  console.log("\n── VERDICT ──");
  const delta = off.pct - shipped.pct;
  if (Math.abs(delta) < 1e-9) {
    console.log("  The offline re-derivation reproduces the shipped numbers EXACTLY on these turns.");
    console.log("  => not a wiring bug. The live distribution IS the model's distribution;");
    console.log("     the batch simply drew turns this model predicts badly.");
  } else {
    console.log(
      `  Offline re-derivation top-1 ${off.pct.toFixed(1)}% vs shipped ${shipped.pct.toFixed(1)}% — a ${delta.toFixed(1)}pp gap on IDENTICAL turns.`,
    );
    console.log("  => the distribution the policy scored is NOT the one the model produces. Wiring.");
  }
  console.log("");
}

const isMain = process.argv[1]?.endsWith("liveGapDiagnostic.ts");
if (isMain) main();
