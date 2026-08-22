/**
 * scripts/shrinkageDeliveryCheck.ts — [session 74, brief §1 / GATE 1]
 *
 * **The boring explanation, checked before the alarming one.**
 *
 * Session 73 found that `pConnect`'s optimism is almost entirely one step of
 * the ladder: the ring model's corpus delta table CLAIMS +15.69pp of connect
 * mass over ring-uniform and DELIVERS +6.88pp — a 43.8% delivery ratio, and
 * 93.9% of the whole gap. The conclusion drawn there was "the prev-delta
 * conditional over-claims".
 *
 * But `shrinkageKByClass` — the knob that decides HOW MUCH that table is
 * trusted — is `{1: 0.1, 2: 8}`, swept on log loss at **88 casts**. The corpus
 * is now **128 casts, 127 of them clean** (the brief's "128" is the raw count;
 * `isCleanCast` drops the duplicate-turn-0 artifact `12923189`, and 127 is what
 * every number here is computed on). If the table is simply under-shrunk at the
 * new size, part of "the conditional is broken" dissolves into "the smoothing
 * is stale".
 *
 * This script asks that question and nothing else:
 *   §3  did the per-class optimum move between 88 casts and 128, and is it
 *       flat or sharp?
 *   §4  what is the delivery ratio AT the new optimum, next to the old 43.8%?
 *
 * DIAGNOSIS ONLY. Brief §3: no default changes, no thresholds moved, no
 * strategy behaviour altered until the `pConnect` diagnosis settles. Nothing
 * here is adopted, whatever the numbers say.
 *
 * Usage: npx tsx scripts/shrinkageDeliveryCheck.ts
 */
import { dataPath, profileArg, resolveProfile } from "../src/profile.js";
import { groupByCast, isCleanCast, loadTransitionRecords, type Cast } from "../src/sim/fishing/transitionCorpus.js";
import {
  DEFAULT_RING_MODEL_OPTIONS,
  DEFAULT_SWITCH_PROBABILITY,
  SHARED_SHRINKAGE_BASELINE,
  type RingModelOptions,
  type StepClass,
} from "../src/strategy/fishing/stepClass.js";
import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { buildFolds, clusterCI, perClassGridRows, scoreTurns, sweepClass, type ClassSweep } from "./fishingRingCV.js";
import { ERA_OPTS, allGridCells, collect, eraCasts, massOn, ringUnder, stickySupport, uniformOver } from "./pConnectBiasDecomposition.js";

/** Resolved through the profile seam — `tests/noHardcodedPaths.test.ts`: prefer the profile to adding a name to the debt list. */
const CORPUS = dataPath(resolveProfile(profileArg(process.argv)), "fish-patterns.jsonl");

/**
 * The corpus size `shrinkageKByClass` was chosen on. Session 51 recorded "88
 * clean casts, 300 scored transitions, exactly 150 per class"; §3 below
 * re-derives that table from the corpus PREFIX rather than quoting it, and
 * asserts the shape it should reproduce.
 */
const SESSION_51_CASTS = 88;
const SESSION_51_SHAPE = { turns: 300, k1: 150, k2: 150 };

/** Session 73's headline, kept as a literal so §4 prints the two side by side. */
const SESSION_73_DELIVERY_RATIO = 0.438;

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(2)}pp`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const kLabel = (K: number) => (Number.isFinite(K) ? String(K) : "Infinity");

function printSweep(sweep: ClassSweep, label: string): void {
  const min = Math.min(...sweep.rows.map((r) => r.ll));
  console.log(`  ${label} — k=${sweep.c}, n=${sweep.n} turns`);
  console.log(`    shrinkageK      top1    logLoss   Δ from min`);
  for (const r of sweep.rows) {
    const mark = r.K === sweep.pick.K ? "  <- PICK" : r.K === sweep.unconstrained.K ? "  (bare argmin)" : "";
    console.log(
      `    ${kLabel(r.K).padStart(10)}   ${r.acc.toFixed(1).padStart(5)}%    ${r.ll.toFixed(3).padStart(6)}     ${(r.ll - min).toFixed(3).padStart(6)}${mark}`,
    );
  }
}

/** The grid points whose logLoss is within `eps` of the minimum — the plateau the pick sits on. */
function plateau(sweep: ClassSweep, eps = 0.01): number[] {
  const min = Math.min(...sweep.rows.map((r) => r.ll));
  return sweep.rows.filter((r) => r.ll - min <= eps).map((r) => r.K);
}

function main(): void {
  const allCasts = groupByCast(loadTransitionRecords(CORPUS)).filter(isCleanCast);

  console.log(`\n▸ shrinkageDeliveryCheck.ts — SESSION 74 GATE 1`);
  console.log(`  ${allCasts.length} clean casts in \`${CORPUS}\` (the brief's "128" is the raw count — \`isCleanCast\``);
  console.log(`  drops the duplicate-turn-0 artifact). DIAGNOSIS ONLY — brief §3, nothing here is adopted.\n`);

  // ── §1 ────────────────────────────────────────────────────────────────
  console.log("── §1  WHY THIS POOLS ACROSS ERAS, AND WHY THAT IS NOT A CONTRADICTION ──");
  console.log(`  This repo splits fishing metrics by POLICY ERA, and the reflex to split this`);
  console.log(`  one too would be wrong. The rule (session 61 §4b, the dead-era precedent) is:`);
  console.log(`  OUTCOME metrics split by era; the MOVEMENT MODEL pools.`);
  console.log(`\n  The fish moves how fish move. A policy change alters what WE spend and where`);
  console.log(`  we aim — it does not alter the transition kernel we are estimating. Shrinkage`);
  console.log(`  is a movement-model parameter, so the CV below pools all ${allCasts.length} clean casts.`);
  console.log(`\n  Splitting it by era would be OVER-correcting — the same reflex that produced`);
  console.log(`  session 70's "session 49's numbers are stale", which was itself wrong. The era`);
  console.log(`  split earns its keep on catch rate and on \`pConnect\` calibration (§4, which is`);
  console.log(`  era-matched precisely because it IS an outcome metric). Not here.`);

  // ── §2 ────────────────────────────────────────────────────────────────
  console.log("\n── §2  THE CV DESIGN, STATED BEFORE ITS RESULT ──");
  console.log(`  Unit of cross-validation: the CAST, leave-one-out. Never the transition — turns`);
  console.log(`    inside a cast share one trajectory, so a transition-level split leaks.`);
  console.log(`  Scored under the SHIPPED path: \`stickyStepDistribution\` with \`lastStepClass\` and`);
  console.log(`    a per-fold \`estimateSwitchProbability\`, which is what \`liveFishing.ts\` calls.`);
  console.log(`  Per fold, BOTH the step table and the switch probability are re-estimated from`);
  console.log(`    the training casts only — letting the held-out cast inform either would leak.`);
  console.log(`  Scored set: hops WITH a previous displacement, so every arm sees identical turns.`);
  console.log(`  Stratification unit: the turn's \`lastK\`, not the cast's mode — that is the class`);
  console.log(`    the sticky chain conditions on at that turn.`);
  console.log(`  SELECTION RULE (\`sweepClass\`): logLoss argmin subject to top-1 no worse than the`);
  console.log(`    shared baseline K=${SHARED_SHRINKAGE_BASELINE.shrinkageK}. Not the bare argmin — session 45's gate on this model`);
  console.log(`    required BOTH columns to improve, and k=2's logLoss is flat enough that its`);
  console.log(`    bare argmin is noise picking a point on a plateau.`);
  console.log(`\n  AND THE CAVEAT THAT OUTRANKS THE RESULT: a cross-validated sweep is still a FIT.`);
  console.log(`  LOO controls for scoring a parameter on its own training row; it does not make`);
  console.log(`  the argmin over a 14-point grid an unbiased estimate of the best value. §3`);
  console.log(`  reports flatness for exactly this reason.`);

  // ── §3 ────────────────────────────────────────────────────────────────
  console.log(`\n── §3  DID THE OPTIMUM MOVE? — ${SESSION_51_CASTS} CASTS vs ${allCasts.length} ──`);
  const prefix: readonly Cast[] = allCasts.slice(0, SESSION_51_CASTS);
  const old = perClassGridRows(prefix);
  const now = perClassGridRows(allCasts);
  const shapeNow = {
    turns: old.turns.length,
    k1: old.turns.filter((t) => t.lastK === 1).length,
    k2: old.turns.filter((t) => t.lastK === 2).length,
  };
  const shapeOk = JSON.stringify(shapeNow) === JSON.stringify(SESSION_51_SHAPE);
  console.log(`  The "${SESSION_51_CASTS} casts" arm is the corpus PREFIX, not a quotation. \`fish-patterns.jsonl\` is`);
  console.log(`  append-ordered, so the first ${SESSION_51_CASTS} clean casts ARE the corpus session 51 swept on.`);
  console.log(`  Session 51 recorded ${SESSION_51_SHAPE.turns} scored transitions, ${SESSION_51_SHAPE.k1} per class; the prefix gives`);
  console.log(`  ${shapeNow.turns} / ${shapeNow.k1} / ${shapeNow.k2} — ${shapeOk ? "EXACT MATCH, so the re-derivation is sound" : "MISMATCH: the prefix is NOT session 51's corpus"}.`);
  if (!shapeOk) console.log(`  ^ read every 88-cast figure below as an approximation, not a reproduction.`);
  console.log(`  (Brief §8's rule applied: the script is the authority, the recap is a secondary source.)`);
  console.log(`\n  ${allCasts.length} casts: ${now.turns.length} scored transitions, k=1 ${now.turns.filter((t) => t.lastK === 1).length}, k=2 ${now.turns.filter((t) => t.lastK === 2).length}\n`);

  for (const c of [1, 2] as StepClass[]) {
    printSweep(old.sweeps.find((s) => s.c === c)!, `${SESSION_51_CASTS} casts`);
    console.log();
    printSweep(now.sweeps.find((s) => s.c === c)!, `${allCasts.length} casts`);
    const o = old.sweeps.find((s) => s.c === c)!;
    const n = now.sweeps.find((s) => s.c === c)!;
    const pl = plateau(n);
    console.log(
      `\n    k=${c}: PICK ${kLabel(o.pick.K)} -> ${kLabel(n.pick.K)}${o.pick.K === n.pick.K ? "  (UNMOVED)" : "  (MOVED)"}` +
        `   |   bare argmin ${kLabel(o.unconstrained.K)} -> ${kLabel(n.unconstrained.K)}`,
    );
    console.log(
      `    k=${c} FLATNESS at ${allCasts.length}: ${pl.length} of ${n.rows.length} grid points within 0.010 logLoss of the minimum` +
        ` (${kLabel(pl[0]!)}..${kLabel(pl[pl.length - 1]!)}), spread ${(Math.max(...pl.map((K) => n.rows.find((r) => r.K === K)!.ll)) - Math.min(...n.rows.map((r) => r.ll))).toFixed(3)}.`,
    );
    console.log(
      `    k=${c} the pick's logLoss margin over the SHIPPED value ${kLabel(DEFAULT_RING_MODEL_OPTIONS.shrinkageKByClass?.[c] ?? DEFAULT_RING_MODEL_OPTIONS.shrinkageK)}: ` +
        `${(n.rows.find((r) => r.K === (DEFAULT_RING_MODEL_OPTIONS.shrinkageKByClass?.[c] ?? DEFAULT_RING_MODEL_OPTIONS.shrinkageK))!.ll - n.pick.ll).toFixed(3)}\n`,
    );
  }

  // What actually moved the pick: the top-1 column, not the logLoss column.
  const o2 = old.sweeps.find((s) => s.c === 2)!;
  const n2 = now.sweeps.find((s) => s.c === 2)!;
  console.log(`  WHAT MOVED THE PICK, AND IT IS NOT THE logLOSS CURVE.`);
  console.log(`  k=2's top-1 column REVERSED DIRECTION between the two corpus sizes:`);
  console.log(`    at ${SESSION_51_CASTS}:  top-1 ${o2.rows[0]!.acc.toFixed(1)}% flat up to K=8, then FALLING to ${o2.rows[o2.rows.length - 1]!.acc.toFixed(1)}% at K=Infinity`);
  console.log(`    at ${allCasts.length}: top-1 ${n2.rows[0]!.acc.toFixed(1)}% up to K=5, then RISING to ${Math.max(...n2.rows.map((r) => r.acc)).toFixed(1)}% around K=32-64`);
  console.log(`  The selection rule's feasibility constraint (top-1 >= shared) therefore bound`);
  console.log(`  from ABOVE at ${SESSION_51_CASTS} — capping the pick at 8 — and does not bind at all at ${allCasts.length}, which`);
  console.log(`  lets the pick run out to ${kLabel(n2.pick.K)}. The logLoss argmin barely moved on a plateau`);
  console.log(`  ${kLabel(o2.unconstrained.K)} -> ${kLabel(n2.unconstrained.K)} that is worth ${(o2.rows[o2.rows.length - 1]!.ll - Math.min(...o2.rows.map((r) => r.ll))).toFixed(3)} / ${(n2.rows[n2.rows.length - 1]!.ll - Math.min(...n2.rows.map((r) => r.ll))).toFixed(3)} logLoss end to end.`);
  console.log(`\n  READ THAT AS A WARNING. A pick decided by a tiebreak column that flipped sign`);
  console.log(`  under 40 more casts is not a stable optimum, however clean the argmin looks.`);

  // The honest paired comparison: new pick vs the SHIPPED pair, not vs the shared baseline.
  const newPair: Partial<Record<StepClass, number>> = {
    1: now.sweeps.find((s) => s.c === 1)!.pick.K,
    2: now.sweeps.find((s) => s.c === 2)!.pick.K,
  };
  const shippedPair = DEFAULT_RING_MODEL_OPTIONS.shrinkageKByClass ?? {};
  const { folds, turns } = buildFolds(allCasts);
  const baseRows = scoreTurns(folds, turns, { ...SHARED_SHRINKAGE_BASELINE, shrinkageKByClass: shippedPair });
  const armRows = scoreTurns(folds, turns, { ...SHARED_SHRINKAGE_BASELINE, shrinkageKByClass: newPair });
  const diffs = armRows.map((a, i) => ({ castId: a.castId, d: a.ll - baseRows[i]!.ll }));
  const [lo, hi] = clusterCI(diffs);
  console.log(`\n  PAIRED, AGAINST WHAT ACTUALLY SHIPS. \`perClassShrinkageSweep\`'s own gate compares`);
  console.log(`  the re-fit pick against the SHARED baseline K=${SHARED_SHRINKAGE_BASELINE.shrinkageK}, which flatters it — the shared value`);
  console.log(`  has not shipped since session 51. The comparison that matters here:\n`);
  console.log(`    shipped {1:${shippedPair[1]}, 2:${shippedPair[2]}}   logLoss ${mean(baseRows.map((r) => r.ll)).toFixed(3)}   top1 ${baseRows.filter((r) => r.hit).length}/${baseRows.length} = ${((baseRows.filter((r) => r.hit).length / baseRows.length) * 100).toFixed(1)}%`);
  console.log(`    re-fit  {1:${kLabel(newPair[1]!)}, 2:${kLabel(newPair[2]!)}}  logLoss ${mean(armRows.map((r) => r.ll)).toFixed(3)}   top1 ${armRows.filter((r) => r.hit).length}/${armRows.length} = ${((armRows.filter((r) => r.hit).length / armRows.length) * 100).toFixed(1)}%`);
  console.log(
    `\n    paired ΔlogLoss (re-fit − shipped): ${mean(diffs.map((d) => d.d)) >= 0 ? "+" : ""}${mean(diffs.map((d) => d.d)).toFixed(3)}  [${lo.toFixed(3)}, ${hi.toFixed(3)}]  cluster-bootstrapped over casts (negative = re-fit better)`,
  );
  console.log(`    ...and the re-fit pair was CHOSEN on this corpus, so this interval is optimistic`);
  console.log(`    about it by construction. It is the ceiling on the improvement, not an estimate.`);

  // ── §4 ────────────────────────────────────────────────────────────────
  console.log(`\n── §4  THE DELIVERY RATIO RECOMPUTED AT THE NEW OPTIMUM — THE GATE'S NUMBER ──`);
  const traces = loadCastTraces().filter(isCleanTrace);
  const era = eraCasts(traces);
  const shipped = collect(traces, era, ERA_OPTS());
  const hits = shipped.map((r) => r.d.hit);
  const obs = hits.filter(Boolean).length / hits.length;
  const uRing = mean(shipped.map((r) => massOn(uniformOver(stickySupport(r.d.currentCell, r.d.gridSize)), r.d.connectCells)));
  const uGrid = mean(shipped.map((r) => massOn(uniformOver(allGridCells(r.d.gridSize)), r.d.connectCells)));
  const delivered = obs - uRing;

  console.log(`  Era-matched, ${era.length} casts / ${shipped.length} turns, PLACEMENT HELD FROZEN — same chosen cells,`);
  console.log(`  same actual cell, so \`hit\` cannot move and observed is pinned at ${pct(obs)} in every row.`);
  console.log(`\n  AND SAY WHAT THAT PINNING DOES TO THIS RATIO, because it is the whole reason the`);
  console.log(`  number is readable. delivery = (observed − ring-uniform) / (ring-tier − ring-uniform).`);
  console.log(`  Under frozen placement the NUMERATOR is a constant: observed ${pct(obs)} and ring-uniform`);
  console.log(`  ${pct(uRing)} both depend only on the cells and the outcomes, neither of which shrinkage`);
  console.log(`  touches. So delivery = ${pp(delivered)} / claim, and ONLY THE DENOMINATOR MOVES.`);
  console.log(`\n  Which means: a shrinkage that raises the delivery ratio has not made the model`);
  console.log(`  more RIGHT — it has made it CLAIM LESS. The ratio reaches 100% exactly when the`);
  console.log(`  tier's claim equals the ${pp(delivered)} the placements actually earn, and it can be`);
  console.log(`  driven upward by any amount of information destruction. The "conditional fully`);
  console.log(`  off" row is printed below as the reference for how far that alone gets you.\n`);

  const withPair = (byClass: Partial<Record<StepClass, number>>): RingModelOptions => ({
    ...DEFAULT_RING_MODEL_OPTIONS,
    shrinkageKByClass: byClass,
  });
  const arms: [string, RingModelOptions, string][] = [
    ["ring-uniform (the floor)", withPair(shippedPair), "geometry only, no corpus"],
    [`SHIPPED {1:${shippedPair[1]}, 2:${shippedPair[2]}}`, withPair(shippedPair), "session 51's pick, swept at 88"],
    [`re-fit  {1:${kLabel(newPair[1]!)}, 2:${kLabel(newPair[2]!)}}`, withPair(newPair), `this corpus's pick at ${allCasts.length} clean`],
    ["k=2 only -> 64, k=1 held", withPair({ ...shippedPair, 2: newPair[2]! }), "identical above BECAUSE k=1's pick did not move"],
    ["conditional fully OFF", withPair({ 1: Infinity, 2: Infinity }), "class marginal only — the reference"],
  ];

  console.log(`  arm                          predicted   gap vs obs      claim   DELIVERY   note`);
  for (const [label, opts, note] of arms) {
    const predicted = label.startsWith("ring-uniform")
      ? uRing
      : mean(shipped.map((r) => massOn(ringUnder(r.d, opts, DEFAULT_SWITCH_PROBABILITY), r.d.connectCells)));
    const claim = predicted - uRing;
    const ratio = claim === 0 ? Number.NaN : delivered / claim;
    console.log(
      `  ${label.padEnd(28)}${pct(predicted).padStart(8)}   ${pp(predicted - obs).padStart(9)}   ${pp(claim).padStart(9)}   ${(Number.isNaN(ratio) ? "     —" : pct(ratio)).padStart(8)}   ${note}`,
    );
  }
  const refit = mean(shipped.map((r) => massOn(ringUnder(r.d, withPair(newPair), DEFAULT_SWITCH_PROBABILITY), r.d.connectCells)));
  const shippedRing = mean(shipped.map((r) => massOn(ringUnder(r.d, withPair(shippedPair), DEFAULT_SWITCH_PROBABILITY), r.d.connectCells)));
  const ratioShipped = delivered / (shippedRing - uRing);
  const ratioRefit = delivered / (refit - uRing);
  console.log(`\n  (uniform grid, for the ladder's bottom rung: ${pct(uGrid)}.)`);

  console.log(`\n  ── THE ANSWER ──`);
  console.log(`  session 73's delivery ratio, SHIPPED shrinkage:      ${pct(ratioShipped)}  (recorded as ${pct(SESSION_73_DELIVERY_RATIO)})`);
  console.log(`  delivery ratio at THIS CORPUS'S re-fit optimum:      ${pct(ratioRefit)}`);
  console.log(`  movement:                                            ${pp(ratioRefit - ratioShipped)}`);
  console.log(`  the ring tier's residual gap falls ${pp(shippedRing - obs)} -> ${pp(refit - obs)}, and the`);
  console.log(`  whole \`pConnect\` gap it has to explain is ${pp(mean(shipped.map((r) => r.d.pConnect)) - obs)}.`);
  const explained = (shippedRing - refit) / (mean(shipped.map((r) => r.d.pConnect)) - obs);
  console.log(`  so re-shrinking removes ${pct(explained)} of the total gap.`);

  const verdict =
    ratioRefit >= 0.9
      ? "STALE SHRINKAGE EXPLAINS ESSENTIALLY ALL OF IT — and per the brief's own warning, be suspicious"
      : ratioRefit - ratioShipped >= 0.15
        ? "STALE SHRINKAGE EXPLAINS SOME OF IT — the conditional remains the prime suspect"
        : "STALE SHRINKAGE EXPLAINS LITTLE OF IT — the conditional remains the prime suspect";
  console.log(`\n  VERDICT: ${verdict}.`);
  console.log(`\n  NOTHING HERE IS ADOPTED (brief §3). \`DEFAULT_RING_MODEL_OPTIONS\` is untouched;`);
  console.log(`  this script reads it and never writes it. A re-fit pick sitting on a plateau,`);
  console.log(`  chosen by a top-1 tiebreak that reversed sign under 40 casts, is not a value to`);
  console.log(`  ship on the strength of one session's sweep.\n`);

  void sweepClass;
}

const isMain = process.argv[1]?.endsWith("shrinkageDeliveryCheck.ts");
if (isMain) main();
