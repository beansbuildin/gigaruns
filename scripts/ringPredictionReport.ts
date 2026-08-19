/**
 * scripts/ringPredictionReport.ts — [session 45, brief §5.4] realized
 * predicted-vs-actual accuracy of this project's OWN next-cell predictor on
 * live play, read off `data/ringPrediction.jsonl` (written one row per turn
 * by `scripts/liveFishing.ts`).
 *
 * Why this and not catch rate. A live fishing batch small enough to afford is
 * far too small to settle a catch rate — at n=8 anything from 0 to 4 catches
 * is consistent with a 30% true rate. Per-TURN prediction accuracy accrues
 * 8-12 rows per cast instead of 1, so a 2-cast batch already yields ~20
 * scored predictions, and it answers the question that actually matters
 * after §1: did the movement model transfer out of the corpus and onto the
 * live board.
 *
 * Compares against `scripts/fishingRingCV.ts`'s leave-one-cast-out figures —
 * and does so PER STEP CLASS, because the two classes are very different
 * prediction problems (k=1: 4 ring cells and never reverses, LOO top-1 54.1%;
 * k=2: up to 8 ring cells, LOO top-1 38.2%). A live batch that happens to
 * draw one class must not be scored against the class-mixed number.
 *
 * [session 46, brief §1b/§1d] Three additions, all read off the same log:
 *
 *  1. **The paired comparison.** Rows now carry the shipped
 *     `contextualFallback` baseline's own numbers, scored on the SAME turn
 *     against the SAME fish. The decisive statistic is the paired mean
 *     log-loss DIFFERENCE (ring − baseline) with a CI, not two independent
 *     rates compared by eye — pairing removes between-fish variance
 *     entirely, and the offline gap of 2.4 nats is overwhelming at n≈200 if
 *     it transfers at all.
 *  2. **Per-class top-1 for BOTH predictors**, never pooled. Session 45's
 *     live batch drew two `k=2` casts, which is exactly why a pooled
 *     comparator misled.
 *  3. **A calibration curve** (§1d): the hit probability `chooseCard`
 *     assigned to the shot it actually played, bucketed, against the
 *     realized hit rate. This is the diagnostic that distinguishes "the
 *     model is fine, the binding constraint moved" from "focus placement is
 *     the defect" from "the model didn't generalize".
 *
 * Read-only.
 *
 * Usage: npx tsx scripts/ringPredictionReport.ts [path]
 */

import { loadRingPredictions, DEFAULT_RING_PREDICTION_LOG_PATH, zoneMapVersionOf, type RingPredictionRecord } from "./liveFishing.js";

/**
 * Log loss of one row under one predictor, with the ZERO-PROBABILITY
 * convention pinned to `-log(1e-9)` ≈ 20.7 nats — the same floor
 * `fishingRingCV.ts` and `fishingContextualCV.ts` use, so live and offline
 * numbers are directly comparable. See SPEC-fishing.md §9's smoothing note:
 * an ε-smoothed convention charges ~6.7 nats for the same event instead, and
 * the choice moves the BASELINE's number by ~1.5 nats while leaving the ring
 * model's untouched (it has no zero-probability events by construction —
 * the ring floor). Stating the convention is what makes the comparison mean
 * something.
 */
function nats(p: number | undefined): number {
  return -Math.log(p !== undefined && p > 0 ? p : 1e-9);
}

/** Rows that carry a paired baseline — pre-session-46 rows are dropped from the paired arm rather than scored as a zero. */
function paired(rows: readonly RingPredictionRecord[]): RingPredictionRecord[] {
  return rows.filter((r) => r.baselinePActual !== undefined);
}

/**
 * Mean and normal-approximation 95% CI of the per-row difference. Paired, so
 * the SD is of the differences themselves — between-fish variance never
 * enters. Returns null below 2 rows, where an SD is undefined rather than
 * merely noisy.
 */
function meanDiffCI(diffs: readonly number[]): { mean: number; lo: number; hi: number; n: number } | null {
  const n = diffs.length;
  if (n < 2) return null;
  const mean = diffs.reduce((a, d) => a + d, 0) / n;
  const variance = diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / (n - 1);
  const half = 1.96 * Math.sqrt(variance / n);
  return { mean, lo: mean - half, hi: mean + half, n };
}

/** Wilson 95% interval — the same rule `liveFishing.ts`'s nextPosition override gate uses, rather than a normal approximation that misbehaves at small n or extreme p. */
function wilson(hits: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 0 };
  const z = 1.96;
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (centre - spread) / d), hi: Math.min(1, (centre + spread) / d) };
}

function summarize(label: string, rows: readonly RingPredictionRecord[], reference?: string) {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(34)} (no rows)`);
    return;
  }
  const hits = rows.filter((r) => r.hit).length;
  const logLoss = rows.reduce((a, r) => a + -Math.log(r.pActual > 0 ? r.pActual : 1e-9), 0) / rows.length;
  const zeroP = rows.filter((r) => r.pActual <= 0).length;
  console.log(
    `  ${label.padEnd(34)} n=${String(rows.length).padStart(4)}  top1=${((hits / rows.length) * 100).toFixed(1).padStart(5)}%  logLoss=${logLoss.toFixed(3).padStart(7)}  zeroP=${zeroP}${reference ? `   [offline LOO: ${reference}]` : ""}`,
  );
}


/**
 * [session 49, brief §6] The no-information comparators, printed alongside
 * every live prediction metric.
 *
 * The standing guard session 49 was asked to install: **a number is not
 * interpretable until you know what it would be if nothing worked.** Session
 * 48 reported live top-1 13.8% against an offline 46.4% and called the gap
 * unexplained; three of the comparators below plus the turn-0 note would have
 * diagnosed it on sight.
 *
 * Scored on turn >= 1 ONLY, and that restriction is half the point. The
 * offline leave-one-cast-out figures skip hops with no previous displacement,
 * so a turn-0 row has no offline counterpart — pooling them into a number
 * compared against 42.6% understates it, which is exactly what session 48's
 * headline did (13.8% pooled vs 16.7% on the comparable set).
 *
 * `from` is reconstructed within the cast — turn t's starting cell is turn
 * t-1's `actual` — so this stays self-contained on one log file, with no
 * second corpus to fall out of sync with.
 */
function nullComparators(rows: readonly RingPredictionRecord[]) {
  const byCast = new Map<string, RingPredictionRecord[]>();
  for (const r of rows) {
    const arr = byCast.get(r.castId) ?? [];
    arr.push(r);
    byCast.set(r.castId, arr);
  }

  interface Scored {
    from: [number, number];
    actual: [number, number];
    stepClass: 1 | 2 | null;
    gridSize: number;
    modelHit: boolean;
  }
  const scored: Scored[] = [];
  for (const [, arr] of byCast) {
    arr.sort((a, b) => a.turn - b.turn);
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1]!;
      const cur = arr[i]!;
      if (cur.turn !== prev.turn + 1) continue; // a gap makes `from` unrecoverable
      scored.push({
        from: prev.actual,
        actual: cur.actual,
        stepClass: cur.stepClass,
        gridSize: cur.gridSize,
        modelHit: cur.hit,
      });
    }
  }

  console.log("\n── NULL COMPARATORS (turn >= 1 only — the offline LOO's scored set) ──");
  if (scored.length === 0) {
    console.log("  no consecutive-turn pairs yet.\n");
    return;
  }

  const inGrid = (c: [number, number], g: number) => c[0] >= 1 && c[0] <= g && c[1] >= 1 && c[1] <= g;
  const ring = (from: [number, number], k: number, g: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let dx = -k; dx <= k; dx++) {
      const rem = k - Math.abs(dx);
      for (const dy of rem === 0 ? [0] : [-rem, rem]) {
        const c: [number, number] = [from[0] + dx, from[1] + dy];
        if (inGrid(c, g)) out.push(c);
      }
    }
    return out;
  };
  const key = (c: [number, number]) => `${c[0]},${c[1]}`;
  const union = (from: [number, number], g: number) => {
    const m = new Map<string, [number, number]>();
    for (const k of [1, 2]) for (const c of ring(from, k, g)) m.set(key(c), c);
    return [...m.values()];
  };

  // A uniform model's top-1 is a tie among all its cells, so its EXPECTED
  // top-1 is 1/|support| when the actual is in support and 0 otherwise —
  // reported as an expectation rather than picking a tie-break winner, which
  // would make the comparator depend on an arbitrary ordering rule.
  let eGrid = 0;
  let eUnion = 0;
  let eKRing = 0;
  let modelHits = 0;
  for (const s of scored) {
    const g = s.gridSize;
    const gridCells = g * g;
    eGrid += 1 / gridCells;
    const u = union(s.from, g);
    if (u.some((c) => key(c) === key(s.actual))) eUnion += 1 / u.length;
    const kr = s.stepClass === null ? u : ring(s.from, s.stepClass, g);
    if (kr.some((c) => key(c) === key(s.actual))) eKRing += 1 / kr.length;
    if (s.modelHit) modelHits++;
  }
  const n = scored.length;
  const pc = (v: number) => `${((v / n) * 100).toFixed(1).padStart(5)}%`;
  console.log(`  n = ${n} consecutive-turn pair(s)`);
  console.log(`    uniform over the whole grid          ${pc(eGrid)}`);
  console.log(`    uniform over the UNION of both rings ${pc(eUnion)}`);
  console.log(`    uniform over the legal k-ring        ${pc(eKRing)}`);
  console.log(`    THE SHIPPED MODEL                    ${pc(modelHits)}   (${modelHits}/${n})`);
  const beatsUnion = modelHits > eUnion;
  const beatsKRing = modelHits > eKRing;
  console.log(
    `  => the model ${beatsUnion ? "beats" : "does NOT beat"} the union-of-rings null and ${beatsKRing ? "beats" : "does NOT beat"} the k-ring null.`,
  );
  if (!beatsKRing) {
    console.log("     Losing to the k-ring null means the CONDITIONAL tier is not paying for itself on these turns.");
  }
  console.log("");
}


/**
 * [session 50, brief §4 standing guard 2] The coverage / conversion
 * decomposition, computed from rows this log has always carried
 * (`playedFocus` + `actual`) — no new field and no new capture needed.
 *
 *     hit rate = coverage x conversion
 *
 * coverage   = P(the fish's actual cell landed inside the 3x3 window around
 *              the focus that was played) — what focus PLACEMENT controls.
 * conversion = P(hit | covered) — what the CARD's zone subset and the aim
 *              inside the window control.
 *
 * It is printed on every readout because without it a low hit rate does not
 * say which half to fix, and three sessions were spent tuning the half that
 * turned out not to be binding.
 */
function coverageDecomposition(rows: readonly RingPredictionRecord[]) {
  const scored = rows.filter((r) => r.playedFocus && typeof r.realizedHit === "boolean");
  let covered = 0;
  let coveredHits = 0;
  let hits = 0;
  for (const r of scored) {
    const [fx, fy] = r.playedFocus!;
    const [ax, ay] = r.actual;
    const isCovered = Math.abs(fx - ax) <= 1 && Math.abs(fy - ay) <= 1;
    if (isCovered) covered++;
    if (r.realizedHit) {
      hits++;
      if (isCovered) coveredHits++;
    }
  }
  return { n: scored.length, covered, hits, coveredHits };
}

/**
 * [session 50, brief §3 / open question 2] The shadow ring tier: on turns
 * where the MATCHER overrode the ring model, what would the ring model alone
 * have said? Scored as a paired log-loss difference (shipped - shadow) on
 * exactly those turns, so a positive mean means the matcher tier COST nats.
 *
 * Session 49 measured the turn-0 tier at ΔLL +1.337 [+0.429, +2.245] against
 * the plain baseline at n=15, with the three batches disagreeing sharply.
 * This is the comparison that settles it, and it needed no policy change to
 * collect — only rows written after session 50 carry it.
 */
function shadowRingTier(rows: readonly RingPredictionRecord[]) {
  const scored = rows.filter((r) => typeof r.shadowRingPActual === "number");
  const diffs = scored.map((r) => nats(r.pActual) - nats(r.shadowRingPActual));
  return {
    rows: scored,
    diffs,
    shippedHits: scored.filter((r) => r.hit).length,
    shadowHits: scored.filter((r) => r.shadowRingHit).length,
  };
}


/**
 * [session 51 §4] The ring model's OWN accuracy on EVERY scored turn,
 * including the ones something overrode it on.
 *
 * The defect this closes, named in the session-51 brief §3: a turn where the
 * `nextPosition` override fired is written as `tier: "override"`, and every
 * ring comparator in this report filters on `tier`, so those turns silently
 * left the ring model's sample. That is selection on the outcome-adjacent
 * variable — the override fires precisely on the turns the server told us the
 * answer, which are not a random subset — and it makes the ring's live figure
 * a figure about "turns nothing else had an opinion on".
 *
 * The fix is NOT to relabel an override row as a ring row. It is to use the
 * SHADOW row: since session 50 (matcher) and session 51 (override) every
 * overridden turn dual-logs what the ring model alone would have predicted on
 * that same turn. So the ring's real sample is `ring` rows scored on their own
 * prediction, plus overridden rows scored on their shadow — the same model,
 * every turn, one number.
 *
 * Rows written before that dual-logging existed cannot be recovered and are
 * counted as missing rather than quietly dropped.
 */
function ringOnEveryTurn(rows: readonly RingPredictionRecord[]) {
  const ringNative = rows.filter((r) => r.tier === "ring" || r.tier === "ring_unknown_class");
  const overridden = rows.filter((r) => r.tier === "matcher" || r.tier === "matcher_ring" || r.tier === "override");
  const recoverable = overridden.filter((r) => typeof r.shadowRingPActual === "number");
  const unrecoverable = overridden.length - recoverable.length;

  const hits = ringNative.filter((r) => r.hit).length + recoverable.filter((r) => r.shadowRingHit).length;
  const lls =
    ringNative.reduce((a, r) => a + nats(r.pActual), 0) + recoverable.reduce((a, r) => a + nats(r.shadowRingPActual), 0);
  const n = ringNative.length + recoverable.length;

  console.log("\n── the RING MODEL on every turn (override rows re-entered via their shadow) ──");
  console.log(
    `  ${ringNative.length} row(s) where the ring model shipped, + ${recoverable.length} overridden row(s) recovered from their shadow` +
      `${unrecoverable > 0 ? `, ${unrecoverable} row(s) NOT recoverable (written before dual-logging)` : ""}`,
  );
  if (n === 0) {
    console.log("  (no rows)\n");
    return;
  }
  console.log(
    `  ring model, ALL turns              n=${String(n).padStart(4)}  top1=${((hits / n) * 100).toFixed(1).padStart(5)}%  logLoss=${(lls / n).toFixed(3).padStart(7)}`,
  );
  if (unrecoverable > 0) {
    console.log(`  NOTE: ${unrecoverable} overridden turn(s) are still missing from this figure — pre-dual-logging rows.`);
  }
  console.log("");
}

function main() {
  // [session 48] Positional path only — a leading `--since=...` used to be
  // taken as the log path, so `ringPredictionReport.ts --since=<t>` (the
  // session-48 brief's own checkpoint invocation) read a nonexistent file,
  // got back an empty array, and printed "nothing logged yet". A silent empty
  // result that reads as a legitimate answer is the same defect class as the
  // dead `.message` guard (session 46) and heuristic (d): the code names a
  // real thing while reading somewhere that thing never appears.
  const positional = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const path = positional ?? DEFAULT_RING_PREDICTION_LOG_PATH;
  const all = loadRingPredictions(path);
  const sinceArg = process.argv.find((a) => a.startsWith("--since="));
  const since = sinceArg ? sinceArg.slice("--since=".length) : null;
  const rows = since ? all.filter((r) => r.ts >= since) : all;
  console.log(`\n▸ ringPredictionReport.ts — ${path}${since ? `  (--since=${since})` : ""}`);
  console.log(`  ${rows.length} scored turn(s) across ${new Set(rows.map((r) => r.castId)).size} cast(s)\n`);
  if (rows.length === 0) {
    console.log("  nothing logged yet — run a live batch first.\n");
    return;
  }

  console.log("── overall ──");
  summarize("ALL tiers", rows);

  console.log("\n── by predictor tier ──");
  for (const tier of [...new Set(rows.map((r) => r.tier))].sort()) {
    summarize(tier, rows.filter((r) => r.tier === tier));
  }

  console.log("\n── ring tier, by step class (the class-matched comparison) ──");
  console.log("  offline comparators re-derived at 73 clean casts (scripts/fishingRingCV.ts);");
  console.log("  they MOVE as the corpus grows — session 48 compared live against the 68-cast 46.4%.");
  const ringRows = rows.filter((r) => r.tier === "ring" || r.tier === "matcher_ring");
  summarize("k=1", ringRows.filter((r) => r.stepClass === 1), "top1 53.6%, logLoss 0.803");
  summarize("k=2", ringRows.filter((r) => r.stepClass === 2), "top1 33.9%, logLoss 1.455");
  summarize("all classes", ringRows, "top1 42.6%, logLoss 1.418");

  ringOnEveryTurn(rows);

  nullComparators(rows);

  // ---- [session 46, brief §1b] the paired comparison -----------------------
  const pairedRows = paired(rows);
  console.log("\n── PAIRED: ring vs. the shipped contextualFallback baseline ──");
  console.log(`  (same turns, same fish, same history — ${pairedRows.length} of ${rows.length} row(s) carry a baseline)`);
  if (pairedRows.length === 0) {
    console.log("  no paired rows yet — every row predates session 46's instrumentation.\n");
  } else {
    console.log("");
    console.log(`  ${"".padEnd(14)} ${"n".padStart(4)}  ${"ring top1".padStart(10)}  ${"base top1".padStart(10)}  ${"ring LL".padStart(8)}  ${"base LL".padStart(8)}  paired ΔLL (ring − base), 95% CI`);
    const classRow = (label: string, rs: readonly RingPredictionRecord[]) => {
      if (rs.length === 0) {
        console.log(`  ${label.padEnd(14)} ${"0".padStart(4)}  (no rows)`);
        return;
      }
      const ringTop1 = rs.filter((r) => r.hit).length / rs.length;
      const baseTop1 = rs.filter((r) => r.baselineHit).length / rs.length;
      const ringLL = rs.reduce((a, r) => a + nats(r.pActual), 0) / rs.length;
      const baseLL = rs.reduce((a, r) => a + nats(r.baselinePActual), 0) / rs.length;
      const ci = meanDiffCI(rs.map((r) => nats(r.pActual) - nats(r.baselinePActual)));
      const ciStr = ci
        ? `${ci.mean >= 0 ? "+" : ""}${ci.mean.toFixed(3)}  [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]${ci.hi < 0 ? "  ✓ ring better" : ci.lo > 0 ? "  ✗ ring WORSE" : "  — inconclusive"}`
        : "(n<2)";
      console.log(
        `  ${label.padEnd(14)} ${String(rs.length).padStart(4)}  ${(ringTop1 * 100).toFixed(1).padStart(9)}%  ${(baseTop1 * 100).toFixed(1).padStart(9)}%  ${ringLL.toFixed(3).padStart(8)}  ${baseLL.toFixed(3).padStart(8)}  ${ciStr}`,
      );
    };
    classRow("k=1", pairedRows.filter((r) => r.stepClass === 1));
    classRow("k=2", pairedRows.filter((r) => r.stepClass === 2));
    classRow("unknown k", pairedRows.filter((r) => r.stepClass === null));
    classRow("ALL", pairedRows);
    console.log("");
    console.log("  Offline leave-one-cast-out comparators, per class — never the pooled 46.4%:");
    console.log("    k=1  ring top1 54.1% / LL 0.803      k=2  ring top1 38.2% / LL 1.455");
    console.log("    baseline (all classes) top1 42.7% / LL 3.536, 23 zero-probability events in 211");
    console.log(`  Zero-probability events here: ring ${pairedRows.filter((r) => r.pActual <= 0).length}, baseline ${pairedRows.filter((r) => (r.baselinePActual ?? 0) <= 0).length} (of ${pairedRows.length}).`);
  }

  // ---- [session 46, brief §1d] calibration --------------------------------
  const shots = rows.filter((r) => r.pHitPredicted !== undefined && r.realizedHit !== undefined);
  // [session 48, brief §3] Rows written before session 47's ZONE_OFFSET fix
  // were logged by a policy AIMING with the transposed map. Their movement
  // predictions are unaffected (movement is zone-independent), but every
  // hit-flavoured field on them describes a mis-aimed shot. Pooling the two
  // eras into one hit rate quietly drags it down, so the split is printed
  // whenever both are present rather than left for someone to notice.
  const byZoneMap = new Map<string, RingPredictionRecord[]>();
  for (const r of rows) {
    const v = zoneMapVersionOf(r);
    byZoneMap.set(v, [...(byZoneMap.get(v) ?? []), r]);
  }
  if (byZoneMap.size > 1) {
    console.log("\n── ⚠ MIXED ZONE MAPS in this selection — do not pool the hit rates ──");
    for (const [version, rs] of [...byZoneMap.entries()].sort()) {
      const shots = rs.filter((r) => r.realizedHit !== undefined);
      const landed = shots.filter((r) => r.realizedHit).length;
      console.log(
        `  ${version.padEnd(11)} n=${String(rs.length).padStart(4)}  shots scored=${String(shots.length).padStart(4)}` +
          `  realized hit=${shots.length ? `${((landed / shots.length) * 100).toFixed(1)}%` : "  n/a"}`,
      );
    }
    console.log("  'transposed' rows aimed with session 12's wrong table (SPEC-fishing.md §9).");
  }

  console.log("\n── CALIBRATION: predicted P(hit) of the shot actually played vs. realized ──");
  if (shots.length === 0) {
    console.log("  no rows carry a played-shot probability yet.\n");
  } else {
    const buckets: Array<[string, (p: number) => boolean]> = [
      ["0.00–0.20", (p) => p < 0.2],
      ["0.20–0.40", (p) => p >= 0.2 && p < 0.4],
      ["0.40–0.60", (p) => p >= 0.4 && p < 0.6],
      ["0.60–0.80", (p) => p >= 0.6 && p < 0.8],
      ["0.80–1.00", (p) => p >= 0.8],
    ];
    console.log(`  ${"bucket".padEnd(12)} ${"n".padStart(4)}  ${"mean pred".padStart(10)}  ${"realized".padStart(9)}  95% CI (Wilson)`);
    for (const [label, test] of buckets) {
      const rs = shots.filter((r) => test(r.pHitPredicted!));
      if (rs.length === 0) continue;
      const meanPred = rs.reduce((a, r) => a + r.pHitPredicted!, 0) / rs.length;
      const hits = rs.filter((r) => r.realizedHit).length;
      const w = wilson(hits, rs.length);
      console.log(
        `  ${label.padEnd(12)} ${String(rs.length).padStart(4)}  ${meanPred.toFixed(3).padStart(10)}  ${((hits / rs.length) * 100).toFixed(1).padStart(8)}%  [${(w.lo * 100).toFixed(1)}%, ${(w.hi * 100).toFixed(1)}%]`,
      );
    }
    const meanPred = shots.reduce((a, r) => a + r.pHitPredicted!, 0) / shots.length;
    const hits = shots.filter((r) => r.realizedHit).length;
    const w = wilson(hits, shots.length);
    console.log(
      `  ${"OVERALL".padEnd(12)} ${String(shots.length).padStart(4)}  ${meanPred.toFixed(3).padStart(10)}  ${((hits / shots.length) * 100).toFixed(1).padStart(8)}%  [${(w.lo * 100).toFixed(1)}%, ${(w.hi * 100).toFixed(1)}%]`,
    );
    console.log("");
    console.log("  Reading this (brief §1d): realized ≈ predicted with a low catch rate means the");
    console.log("  movement model is fine and the binding constraint is focus budget / deck / mana.");
    console.log("  Realized well BELOW predicted means focus placement is the defect — the policy is");
    console.log("  aiming at cells the model likes but cannot actually cover.");
  }

  console.log("\n── COVERAGE / CONVERSION (brief §4 guard 2 — hit = coverage x conversion) ──");
  const cov = coverageDecomposition(rows);
  if (cov.n === 0) {
    console.log("  no rows carry a played focus yet.");
  } else {
    const coverage = cov.covered / cov.n;
    const conversion = cov.covered > 0 ? cov.coveredHits / cov.covered : 0;
    const wc = wilson(cov.covered, cov.n);
    console.log(`  n = ${cov.n} scored shot(s)`);
    console.log(
      `    coverage   (fish inside the played 3x3 window)  ${cov.covered}/${cov.n} = ${(coverage * 100).toFixed(1)}%  [${(wc.lo * 100).toFixed(1)}%, ${(wc.hi * 100).toFixed(1)}%]`,
    );
    console.log(`    conversion (hit | covered)                     ${cov.coveredHits}/${cov.covered} = ${(conversion * 100).toFixed(1)}%`);
    console.log(`    product                                        ${(coverage * conversion * 100).toFixed(1)}%   realized hit ${cov.hits}/${cov.n} = ${((cov.hits / cov.n) * 100).toFixed(1)}%`);
    console.log("");
    // Split by zone map, per the brief's §0 rule: the transposed-era rows were
    // aimed with the wrong table, so pooling their conversion with the
    // corrected era's describes neither policy. Coverage is affected only
    // indirectly (the 3x3 window is map-independent; which cell got chosen as
    // the focus is not), conversion directly.
    for (const era of ["transposed", "corrected"] as const) {
      const rs = rows.filter((r) => zoneMapVersionOf(r) === era);
      const c = coverageDecomposition(rs);
      if (c.n === 0) continue;
      console.log(
        `    ${era.padEnd(11)} n=${String(c.n).padStart(3)}  coverage ${((c.covered / c.n) * 100).toFixed(1).padStart(5)}%  ` +
          `conversion ${(c.covered ? (c.coveredHits / c.covered) * 100 : 0).toFixed(1).padStart(5)}%  ` +
          `hit ${((c.hits / c.n) * 100).toFixed(1).padStart(5)}%`,
      );
    }
    console.log("");
    console.log("  Offline reference (scripts/focusCoverageSweep.ts, 83 clean casts / 299 replayed");
    console.log("  turns, matcher LOO): the shipped EV placement scores coverage 73.6% x conversion");
    console.log("  62.3%, and pushing coverage to 89.6% dropped conversion to 48.5% and hits with it.");
    console.log("  But session 50's live batch inverted that (coverage 37.5%, conversion 66.7%), so");
    console.log("  WHICH HALF BINDS IS REGIME-DEPENDENT — it tracks the movement model's accuracy on");
    console.log("  the batch. Read the numbers above, not the reference. These pins move with the");
    console.log("  corpus; re-derive before comparing (SPEC-fishing.md §9, Guard 1).");
  }

  console.log("\n── SHADOW RING TIER (open question 2 — is the matcher tier worth its place?) ──");
  const shadow = shadowRingTier(rows);
  if (shadow.rows.length === 0) {
    console.log("  no rows carry a shadow ring prediction yet — only turns logged from session 50");
    console.log("  onward, on which the matcher tier actually overrode the ring model, carry one.");
  } else {
    const ci = meanDiffCI(shadow.diffs);
    console.log(`  n = ${shadow.rows.length} matcher-overridden turn(s)`);
    console.log(`    top-1: SHIPPED (matcher) ${shadow.shippedHits}/${shadow.rows.length} vs ring alone ${shadow.shadowHits}/${shadow.rows.length}`);
    if (ci) {
      console.log(
        `    paired ΔlogLoss (shipped − ring alone) = ${ci.mean >= 0 ? "+" : ""}${ci.mean.toFixed(3)} nats [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]`,
      );
      console.log("    POSITIVE means the matcher tier is COSTING nats over the ring model beneath it.");
    }
  }

  console.log("\n── by cast ──");
  for (const castId of [...new Set(rows.map((r) => r.castId))]) {
    const rs = rows.filter((r) => r.castId === castId);
    const classes = [...new Set(rs.map((r) => r.stepClass).filter((c) => c !== null))];
    summarize(`cast ${castId} (k=${classes.join("/") || "?"})`, rs);
  }
  console.log("");
}

const isMain = process.argv[1]?.endsWith("ringPredictionReport.ts");
if (isMain) main();
