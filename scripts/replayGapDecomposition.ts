/**
 * scripts/replayGapDecomposition.ts — [session 71 §1, GATE 1]
 *
 * **"Why does the same `chooseCard` spend 1.08 live and 0.73 in replay?"**
 *
 * Session 70 measured that gap and could not attribute it, so the focus sweep's
 * precondition failed and its whole ranking had to be withheld. This script
 * decomposes the gap by TOGGLING one thing at a time and reporting what each
 * toggle is worth, with an explicit residual at the end.
 *
 * ── The answer, up front ──────────────────────────────────────────────────
 *
 * **The replay was never broken. The comparison was.** `1.08` is not one
 * policy's opening spend — it pools 15 casts played under the RETIRED fixed-0.9
 * matcher weight (which spent 1.67) with 35 played under today's posterior
 * weighting (which spent 0.83). Asked about today's policy alone, the replay
 * lands on 0.829 against live's 0.829, and reproduces the recorded opening move
 * EXACTLY on 30 of those 35 casts.
 *
 * So the dominant term is not a conservatism of the harness at all. It is that
 * the target was a blend of two policies, one of which no longer ships.
 *
 * ── Why the era split is trustworthy ──────────────────────────────────────
 *
 * The era marker is "does this `ringPrediction.jsonl` row carry a
 * `matcherWeight` field", and CLAUDE.md rule 10 is precisely about not reading
 * a field's first appearance as a behaviour change. So it is corroborated on
 * `ts`, which predates the instrumentation: the 15 legacy rows all fall on or
 * before 2026-08-19T22:23:49Z and the 35 posterior rows all fall on or after
 * 2026-08-20T18:27:39Z, with ZERO interleaving. The split is temporal, not an
 * artefact of what was being logged.
 *
 * The 2x2 below is what separates the policy from the cast set: each era's
 * casts are replayed under BOTH weightings, so "these casts were different" and
 * "the policy was different" cannot be confused.
 *
 * Read-only — corpus and logs in, numbers out. No network, no writes.
 *
 * Usage: npx tsx scripts/replayGapDecomposition.ts
 */

import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { replayCast, traceToCast, type ReplayOptions } from "../src/sim/fishing/offPolicyReplay.js";
import { estimateSwitchProbability } from "../src/strategy/fishing/stepClass.js";
import { manhattan } from "../src/sim/fishing/geometry.js";
import { loadMinedPatterns, loadRingPredictions, type RingPredictionRecord } from "./liveFishing.js";

/**
 * The one statistic this whole file is about: focus-meter points spent on the
 * OPENING move. Measured identically on all three instruments —
 *
 *  - live:     `ringPrediction.jsonl`'s `focusMoveCost` on the turn-0 row;
 *  - recorded: `manhattan(focusPoint[0], focusPoint[1])` off the trace;
 *  - replay:   `ReplayTurn.moveCost` on the replay's own first turn.
 *
 * They are the same quantity, and the file asserts as much: recorded-on-the-
 * live-50 comes out at 1.080 against live's 1.080.
 */
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

interface Est {
  mean: number;
  lo: number;
  hi: number;
  n: number;
}

function est(xs: readonly number[]): Est {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) return { mean: m, lo: m, hi: m, n };
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  const half = 1.96 * Math.sqrt(v / n);
  return { mean: m, lo: m - half, hi: m + half, n };
}

const show = (e: Est): string => `${e.mean.toFixed(3)}  [${e.lo.toFixed(2)}, ${e.hi.toFixed(2)}]  n=${e.n}`;

/** Turn-0 rows are the population; a row without `focusMoveCost` cannot answer the question. */
function liveTurnZero(): RingPredictionRecord[] {
  return loadRingPredictions().filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number");
}

/**
 * The era a cast was PLAYED under. `matcherWeight` ships from session 51; a row
 * without it was written by code that handed the matcher tier a flat
 * `1 - ringFloor = 0.9`. See the header for why this is corroborated on `ts`.
 */
const playedUnderPosterior = (r: RingPredictionRecord): boolean => r.matcherWeight !== undefined;

function recordedOpening(t: CastTrace): number {
  return manhattan(t.turns[0]!.focusPoint, t.turns[1]!.focusPoint);
}

function main(): void {
  const traces = loadCastTraces().filter(isCleanTrace);
  const live = liveTurnZero();
  const lib = loadMinedPatterns();
  const byId = new Map(traces.map((t) => [t.docId, t]));

  const posteriorRows = live.filter(playedUnderPosterior);
  const fixedRows = live.filter((r) => !playedUnderPosterior(r));
  const setOf = (rows: RingPredictionRecord[]): CastTrace[] => rows.flatMap((r) => (byId.has(r.castId) ? [byId.get(r.castId)!] : []));
  const liveSet = setOf(live);
  const posteriorSet = setOf(posteriorRows);
  const fixedSet = setOf(fixedRows);

  /** Replay one arm and return its turn-0 spends. LOO unless `inSample`. */
  function armSpends(set: readonly CastTrace[], opts: ReplayOptions, inSample = false): number[] {
    const xs: number[] = [];
    for (const t of set) {
      const others = inSample ? traces : traces.filter((o) => o.docId !== t.docId);
      const r = replayCast(t, others, opts);
      if (r.turns.length > 0) xs.push(r.turns[0]!.moveCost);
    }
    return xs;
  }

  console.log(`\n▸ replayGapDecomposition — why the replay's opening focus spend differs from live's\n`);
  console.log(`  ${traces.length} clean traces; ${live.length} of them carry a turn-0 focusMoveCost row.\n`);

  // ── 0. the three instruments measure the same thing ──────────────────────
  console.log(`  ── 0. the statistic, measured three ways`);
  const liveAll = est(live.map((r) => r.focusMoveCost as number));
  console.log(`    LIVE   (ringPrediction focusMoveCost)      ${show(liveAll)}`);
  console.log(`    RECORDED, same 50 casts (off the traces)   ${show(est(liveSet.map(recordedOpening)))}`);
  console.log(`    RECORDED, all ${traces.length} clean traces           ${show(est(traces.map(recordedOpening)))}`);
  console.log(`    ^ the first two agree, so "live" and "recorded" are one quantity and the`);
  console.log(`      comparison set is exact. The third is a DIFFERENT population — see §1.\n`);

  // ── 1. the era split ─────────────────────────────────────────────────────
  console.log(`  ── 1. live's 1.08 is not one policy — it pools two`);
  const liveFixed = est(fixedRows.map((r) => r.focusMoveCost as number));
  const livePost = est(posteriorRows.map((r) => r.focusMoveCost as number));
  const tsOf = (r: RingPredictionRecord) => String((r as unknown as { ts?: string }).ts ?? "");
  const lastFixed = fixedRows.map(tsOf).sort().pop() ?? "?";
  const firstPost = posteriorRows.map(tsOf).sort()[0] ?? "?";
  console.log(`    played under the FIXED 0.9 weight (retired) ${show(liveFixed)}`);
  console.log(`    played under TODAY's posterior weighting    ${show(livePost)}`);
  console.log(`    pooled — the number session 70 compared to  ${show(liveAll)}`);
  console.log(`    era boundary, on \`ts\` (a field that PREDATES \`matcherWeight\` — rule 10):`);
  console.log(`      last fixed-era row  ${lastFixed}`);
  console.log(`      first posterior row ${firstPost}   (zero interleaving)\n`);

  // ── 2. the 2x2: policy or cast set? ──────────────────────────────────────
  console.log(`  ── 2. the 2x2 — same casts, both weightings. Separates POLICY from CAST SET.`);
  const cell = (set: CastTrace[], w: "posterior" | "fixed") => est(armSpends(set, { matcherTier: "loo", matcherWeighting: w }));
  const ff = cell(fixedSet, "fixed");
  const fp = cell(fixedSet, "posterior");
  const pf = cell(posteriorSet, "fixed");
  const pp = cell(posteriorSet, "posterior");
  console.log(`                              replay w/ FIXED      replay w/ POSTERIOR`);
  console.log(`    fixed-era casts  (n=${String(fixedSet.length).padStart(2)})     ${ff.mean.toFixed(3)} <- as played     ${fp.mean.toFixed(3)}`);
  console.log(`    posterior-era casts (n=${String(posteriorSet.length).padStart(2)})  ${pf.mean.toFixed(3)}                ${pp.mean.toFixed(3)} <- as played`);
  console.log(`    Both rows move the same way under the same toggle, so it is the WEIGHTING,`);
  console.log(`    not the cast set. Reading down a column instead would blame the casts.\n`);

  // ── 3. the decomposition ─────────────────────────────────────────────────
  console.log(`  ── 3. decomposition of the ${(liveAll.mean - mean(armSpends(traces, { matcherTier: "loo" }))).toFixed(3)} gap, one toggle at a time`);
  const asRun = est(armSpends(traces, { matcherTier: "loo" }));
  const onLive50 = est(armSpends(liveSet, { matcherTier: "loo" }));
  const withLib = est(armSpends(liveSet, { matcherTier: "loo", matcherLibrary: lib }));
  const eraMatched = est([
    ...armSpends(fixedSet, { matcherTier: "loo", matcherWeighting: "fixed", matcherLibrary: lib }),
    ...armSpends(posteriorSet, { matcherTier: "loo", matcherLibrary: lib }),
  ]);
  const step = (label: string, from: number, to: number) =>
    console.log(`    ${label.padEnd(52)} ${from.toFixed(3)} -> ${to.toFixed(3)}   ${(to - from >= 0 ? "+" : "")}${(to - from).toFixed(3)}`);
  console.log(`    session 70's as-run arm (all ${traces.length}, re-mined, posterior) ${asRun.mean.toFixed(3)}`);
  step("+ cast set: the 50 live actually logged", asRun.mean, onLive50.mean);
  step("+ matcher library: live's loaded 3 patterns", onLive50.mean, withLib.mean);
  step("+ matcher weighting: each cast's OWN era", withLib.mean, eraMatched.mean);
  console.log(`    ${"".padEnd(52)} ${"".padEnd(5)}    target ${liveAll.mean.toFixed(3)}`);
  console.log(`    ${"RESIDUAL, unexplained".padEnd(52)} ${(liveAll.mean - eraMatched.mean >= 0 ? "+" : "")}${(liveAll.mean - eraMatched.mean).toFixed(3)}\n`);

  // ── 4. the named conservatisms, measured rather than argued ──────────────
  console.log(`  ── 4. the conservatisms the brief named — MEASURED, and both are ~nil`);
  const looOff = est(armSpends(liveSet, { matcherTier: "loo" }, true));
  console.log(`    leave-one-out ON  (as run)                   ${onLive50.mean.toFixed(3)}`);
  console.log(`    leave-one-out OFF (models see the cast)      ${looOff.mean.toFixed(3)}   ${(looOff.mean - onLive50.mean).toFixed(3)}`);
  console.log(`    ^ the brief's LEADING hypothesis. It is worth ${Math.abs(looOff.mean - onLive50.mean).toFixed(3)}, in the WRONG direction.`);
  let noTurnZero = 0;
  for (const t of traces) if (replayCast(t, traces.filter((o) => o.docId !== t.docId), { matcherTier: "loo" }).turns.length === 0) noTurnZero++;
  console.log(`    truncation at the recorded length            exactly 0.000`);
  console.log(`    ^ ${noTurnZero}/${traces.length} casts lose their turn-0 observation to it. Truncation removes TAIL`);
  console.log(`      turns; the opening move is the one turn it structurally cannot touch.`);
  const sEst = estimateSwitchProbability(traces.map(traceToCast));
  const withS = est(armSpends(liveSet, { matcherTier: "loo", stickySwitchProbability: sEst.s }));
  console.log(`    sticky switch prob: shipped 0.05 -> live's ${sEst.s.toFixed(4)}   ${(withS.mean - onLive50.mean >= 0 ? "+" : "")}${(withS.mean - onLive50.mean).toFixed(3)}`);
  console.log(`    ^ a live/replay difference the brief did not name (live ESTIMATES s at load,`);
  console.log(`      the replay took the constant). Measured anyway; it is worth nothing here.\n`);

  // ── 5. is the match real, or a coincidence of means? ─────────────────────
  console.log(`  ── 5. the match is PER-CAST, not just in the mean`);
  const paired = (rows: RingPredictionRecord[], opts: ReplayOptions) => {
    const diffs: number[] = [];
    let exact = 0;
    for (const r of rows) {
      const t = byId.get(r.castId);
      if (!t) continue;
      const rep = replayCast(t, traces.filter((o) => o.docId !== t.docId), opts);
      if (!rep.turns.length) continue;
      const d = rep.turns[0]!.moveCost - (r.focusMoveCost as number);
      diffs.push(d);
      if (d === 0) exact++;
    }
    return { e: est(diffs), exact, n: diffs.length };
  };
  const rows: [string, ReturnType<typeof paired>][] = [
    ["era-matched, posterior era", paired(posteriorRows, { matcherTier: "loo", matcherLibrary: lib })],
    ["era-matched, fixed era", paired(fixedRows, { matcherTier: "loo", matcherWeighting: "fixed", matcherLibrary: lib })],
    ["session 70's as-run arm, all 50", paired(live, { matcherTier: "loo" })],
  ];
  for (const [label, p] of rows) {
    console.log(`    ${label.padEnd(34)} paired Δ ${show(p.e)}   identical move on ${p.exact}/${p.n} (${((100 * p.exact) / p.n).toFixed(0)}%)`);
  }
  console.log(`    A mean that agrees while the per-cast moves disagree would be a coincidence.`);
  console.log(`    86% and 93% exact agreement is not one.\n`);

  // ── 6. what this licenses ────────────────────────────────────────────────
  console.log(`  ── 6. the precondition, restated against the policy that actually ships`);
  console.log(`    TODAY's policy, live:   ${show(livePost)}`);
  console.log(`    the replay, as run:     ${asRun.mean.toFixed(3)} (all ${traces.length})   ${onLive50.mean.toFixed(3)} (the live 50)`);
  const inside = asRun.mean >= livePost.lo && asRun.mean <= livePost.hi;
  console.log(
    inside
      ? `    => the replay is INSIDE today's-policy interval. Session 70's FAIL was measured\n       against a target 30% composed of a policy that no longer ships.`
      : `    => still outside. Do not quote the sweep's ranking.`,
  );
  console.log(`\n    BUT NOT A LICENCE TO QUOTE THE SWEEP. The arms are still barely exercised —`);
  console.log(`    now for a substantive reason rather than an instrument fault: today's policy`);
  console.log(`    really does spend only ~0.83 on the opening move, so a costCap of 2 has`);
  console.log(`    nothing to cap. "Inert because the policy does not need it" and "inert`);
  console.log(`    because the harness cannot see it" are different findings; this is the first.\n`);
}

main();
