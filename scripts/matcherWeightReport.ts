/**
 * scripts/matcherWeightReport.ts — QUESTIONS.md §19, reduced from "a session's
 * project" to twenty casts and one command.
 *
 * ## Why this exists
 *
 * §19 asks whether the matcher tier should be DROPPED rather than mixed. It
 * has been open since session 51 and unmeasured for FOUR sessions, and the
 * reason is not only scheduling: it has been treated as work that needs a
 * session with room for a project, so it loses to whatever felt more urgent at
 * minute five. Everything except the twenty live casts is offline, so all of
 * it is built here, in advance, against the existing corpus. On the day, the
 * live half is: cast, then run this.
 *
 * ## What the session-55 brief got wrong about this, and what changed
 *
 * The brief says to "read `matcherWeight` off `ringPrediction.jsonl` rows".
 * The field is real — `liveFishing.ts` has written it since session 51 — but
 * **not one of the 129 rows on disk carries it.** Every row predates the
 * instrumentation. So the report cannot be validated on live data today, and,
 * more importantly, a naive version of it would produce a CONFIDENT WRONG
 * ANSWER rather than no answer: `matcherWeightOf()` back-fills an absent field
 * with the fixed 0.9 that really was in force before session 51, and 0.9 on
 * every turn reads as "pi is high", which is precisely the conclusion §19
 * exists to test. That is CLAUDE.md rule 10 exactly — a field first appearing
 * at date D, counted as though it described the period before D.
 *
 * `src/strategy/fishing/matcherVerdict.ts` therefore reads the raw field and
 * treats absence as NOT MEASURED, never as 0.9, and this script prints the
 * measured/unmeasured split before it prints anything else.
 *
 * ## What it reports
 *
 *  1. Provenance — measured vs pre-instrumentation turns. Read this first.
 *  2. The LOADED library's support counts, computed at run time from the same
 *     clean corpus live computes them from, so the verdict is pinned to the
 *     library that actually ran rather than to a number quoted from a recap.
 *  3. The full pi distribution, not merely whether it crossed 0.5 — the replay
 *     median was 0.135 with 70.5% of active turns at or below 0.15, and
 *     whether live looks like that is itself the finding.
 *  4. Opening focus spend with its n and CI. Session 50 measured 0.71
 *     replayed vs 1.80 live with the matcher OFF, so the tier is entangled
 *     with spending, not only with prediction. A batch where pi never moves
 *     should still say whether spending looked normal — that is the half the
 *     replay cannot see.
 *  5. The verdict, from `matcherVerdict.ts`. The rule is CODE, deliberately:
 *     the honest answer may be "drop the thing two sessions built", and a rule
 *     written as prose is a rule that can be renegotiated once the numbers are
 *     visible.
 *
 * Usage:
 *   npx tsx scripts/matcherWeightReport.ts                 # every row on disk
 *   npx tsx scripts/matcherWeightReport.ts --since=2026-08-20T18:00:00Z
 *   npx tsx scripts/matcherWeightReport.ts --last-casts=20  # the §19 batch
 */

import {
  DEFAULT_TRANSITIONS_PATH,
  DEFAULT_RING_PREDICTION_LOG_PATH,
  loadMinedPatterns,
  loadRingPredictions,
  type RingPredictionRecord,
} from "./liveFishing.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { supportingCastCount } from "../src/sim/fishing/patternMining.js";
import { matcherPriorFromSupport } from "../src/strategy/fishing/matcherPosterior.js";
import {
  buildMatcherWeightReport,
  PI_DECISION_THRESHOLD,
  REPLAY_REFERENCE,
  type MatcherWeightRow,
} from "../src/strategy/fishing/matcherVerdict.js";

export interface ReportArgs {
  since?: string;
  lastCasts?: number;
  logPath: string;
  transitionsPath: string;
}

export function parseReportArgs(argv: readonly string[]): ReportArgs {
  const value = (flag: string) => argv.find((a) => a.startsWith(`${flag}=`))?.split("=").slice(1).join("=");
  const lastRaw = value("--last-casts");
  const lastCasts = lastRaw === undefined ? undefined : Number(lastRaw);
  if (lastCasts !== undefined && (!Number.isInteger(lastCasts) || lastCasts <= 0)) {
    throw new Error(`--last-casts must be a positive integer, got ${JSON.stringify(lastRaw)}`);
  }
  const since = value("--since");
  if (since !== undefined && Number.isNaN(Date.parse(since))) {
    throw new Error(`--since must be an ISO timestamp, got ${JSON.stringify(since)}`);
  }
  return {
    since,
    lastCasts,
    logPath: value("--log") ?? DEFAULT_RING_PREDICTION_LOG_PATH,
    transitionsPath: value("--transitions") ?? DEFAULT_TRANSITIONS_PATH,
  };
}

/**
 * The batch. `--since` filters by row timestamp; `--last-casts=N` takes the N
 * most recently STARTED casts — by first appearance in file order, which is
 * append order, so a cast whose turns interleave with another's is still
 * counted once. Both may be combined; `--since` applies first.
 */
export function selectBatch(rows: readonly RingPredictionRecord[], args: ReportArgs): RingPredictionRecord[] {
  let out = [...rows];
  if (args.since) {
    const cutoff = Date.parse(args.since);
    out = out.filter((r) => typeof r.ts === "string" && Date.parse(r.ts) >= cutoff);
  }
  if (args.lastCasts !== undefined) {
    const order: string[] = [];
    for (const r of out) if (!order.includes(r.castId)) order.push(r.castId);
    const keep = new Set(order.slice(-args.lastCasts));
    out = out.filter((r) => keep.has(r.castId));
  }
  return out;
}

const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x: number) => (Number.isNaN(x) ? "n/a" : x.toFixed(3));

function main() {
  const args = parseReportArgs(process.argv.slice(2));
  const all = loadRingPredictions(args.logPath);
  const batch = selectBatch(all, args);

  console.log(`▸ matcher weight report — QUESTIONS.md §19`);
  console.log(`  log:   ${args.logPath} (${all.length} rows on disk, ${batch.length} in batch)`);
  if (args.since) console.log(`  since: ${args.since}`);
  if (args.lastCasts) console.log(`  last:  ${args.lastCasts} cast(s)`);

  // ── 2. the LOADED library, at run time ────────────────────────────────────
  const patterns = loadMinedPatterns();
  const casts = groupByCast(loadTransitionRecords(args.transitionsPath)).filter(isCleanCast);
  const support = supportingCastCount(casts, patterns);
  const prior = matcherPriorFromSupport(support.supportingCasts, support.totalCasts);
  console.log(`\n── loaded library (what the verdict is pinned to) ──`);
  console.log(`  patterns:  ${patterns.length} — ${patterns.map((p) => p.name).join(", ") || "(none)"}`);
  console.log(`  support:   ${support.supportingCasts}/${support.totalCasts} clean casts explained exactly`);
  console.log(`  prior pi0: ${num(prior)} (Laplace +1/+2)`);

  const rows: MatcherWeightRow[] = batch.map((r) => ({
    castId: r.castId,
    turn: r.turn,
    tier: r.tier,
    hit: r.hit,
    matcherWeight: r.matcherWeight,
    focusMoveCost: r.focusMoveCost,
  }));
  const report = buildMatcherWeightReport(rows);

  // ── 1. provenance, printed before any statistic ───────────────────────────
  console.log(`\n── provenance (read this before the numbers) ──`);
  console.log(`  matcher turns with a REAL matcherWeight: ${report.activeTurns}`);
  console.log(`  matcher turns predating the field:       ${report.unmeasuredTurns}`);
  if (report.unmeasuredTurns > 0) {
    console.log(
      `  ! those ${report.unmeasuredTurns} are NOT counted. matcherWeightOf() would fill them with the fixed 0.9\n` +
        `    in force before session 51 — a constant, not a measurement (CLAUDE.md rule 10).`,
    );
  }

  // ── 3. the distribution ───────────────────────────────────────────────────
  console.log(`\n── pi distribution over matcher turns ──`);
  if (!report.distribution) {
    console.log(`  (nothing measured)`);
  } else {
    const d = report.distribution;
    console.log(`  n=${d.n}  min ${num(d.min)}  p25 ${num(d.p25)}  median ${num(d.median)}  p75 ${num(d.p75)}  max ${num(d.max)}`);
    console.log(`  at or below ${REPLAY_REFERENCE.belowThreshold}: ${pct(d.fractionBelowReference)}   above ${PI_DECISION_THRESHOLD}: ${pct(d.fractionAboveDecisionThreshold)}`);
    console.log(
      `  REPLAY reference (session 50/51, NOT live): median ${REPLAY_REFERENCE.medianPi}, ` +
        `${pct(REPLAY_REFERENCE.fractionBelow)} at or below ${REPLAY_REFERENCE.belowThreshold}`,
    );
  }

  console.log(`\n── per cast (ranked by max pi) ──`);
  console.log(`  base hit rate over the batch: ${pct(report.baseHitRate)} (${report.baseHitTurns} turns)`);
  for (const c of report.casts.slice(0, 25)) {
    console.log(
      `  ${c.castId}  turns ${String(c.turns).padStart(3)}  maxPi ${num(c.maxPi).padStart(6)}  ` +
        `hit ${pct(c.hitRate).padStart(6)}${c.maxPi > PI_DECISION_THRESHOLD ? "  ← crossed" : ""}`,
    );
  }

  // ── 4. opening focus spend ────────────────────────────────────────────────
  console.log(`\n── opening focus spend (turn 0) ──`);
  if (!report.openingFocus) {
    console.log(`  (no turn-0 row carries focusMoveCost)`);
  } else {
    const f = report.openingFocus;
    console.log(`  n=${f.n}  mean ${num(f.mean)}  95% CI [${num(f.lo)}, ${num(f.hi)}]`);
    console.log(
      `  reference (session 50): ${REPLAY_REFERENCE.openingFocusReplayed} replayed vs ` +
        `${REPLAY_REFERENCE.openingFocusLiveMatcherOff} live with the matcher OFF`,
    );
  }

  // ── 5. the verdict ────────────────────────────────────────────────────────
  console.log(`\n── VERDICT: ${report.verdict} ──`);
  console.log(`  ${report.rationale}`);
  console.log("");
}

const isMain = process.argv[1] && process.argv[1].endsWith("matcherWeightReport.ts");
if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  }
}
