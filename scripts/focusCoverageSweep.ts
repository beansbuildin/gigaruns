/**
 * scripts/focusCoverageSweep.ts — [session 50, brief §2/§3] the gate on the
 * expected-COVERAGE focus objective (`src/strategy/fishing/coverageFocus.ts`).
 *
 * Read `scripts/focusCoverage.ts` first: at 83 clean casts the hindsight
 * ceilings say the 3-point focus budget is NOT the binding constraint
 * (budget 3 reaches 363/364, budget 12 reaches 364/364), while a frozen focus
 * scores 223/364. The ~38pp gap between doing nothing and hindsight is
 * placement quality, not spend quantity — which is why three consecutive
 * spend-quantity knobs came back inert.
 *
 * This script measures whether an ONLINE policy captures any of that gap, and
 * it reports the decomposition rather than a single headline:
 *
 *     hit rate = coverage x conversion
 *
 * **Coverage first, then hit rate, then catch** — the brief's ordering, and
 * the right one. Coverage is scored geometrically against the recorded
 * trajectory with no predictor in the scoring path, so it is the least
 * leak-sensitive of the three; a coverage gain that does NOT convert is itself
 * a finding about the deck's zone shapes, not a failure to report.
 *
 * Every arm is paired against the same base arm on the same (cast, turn)
 * pairs, per session 48's standing rule that the replay is for DIFFERENCES and
 * never absolutes. The base arm runs the matcher tier leave-one-cast-out
 * (`--matcher=loo`, the default here) because with the matcher OFF the replay
 * does not spend focus at all and cannot see a placement effect — see
 * `offPolicyReplay.ts` conservatism #3.
 *
 * Usage: npx tsx scripts/focusCoverageSweep.ts [--matcher=loo|off]
 */

import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { replayCorpus, type ReplayReport } from "../src/sim/fishing/offPolicyReplay.js";

/** Exact binomial two-sided p for a McNemar discordant pair under H0: p = 0.5. */
function exactMcNemarP(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const logChoose = (nn: number, kk: number) => {
    let t = 0;
    for (let i = 1; i <= kk; i++) t += Math.log(nn - kk + i) - Math.log(i);
    return t;
  };
  const pmf = (k: number) => Math.exp(logChoose(n, k) - n * Math.LN2);
  const target = pmf(Math.min(b, c));
  let p = 0;
  for (let k = 0; k <= n; k++) {
    const v = pmf(k);
    if (v <= target * (1 + 1e-9)) p += v;
  }
  return Math.min(1, p);
}

interface Paired {
  /** Turns present in BOTH arms, keyed by (cast, turn index). */
  n: number;
  armWins: number;
  baseWins: number;
  armRate: number;
  baseRate: number;
  p: number;
}

/**
 * Pairs on (docId, turn). The arms diverge — a different focus changes the
 * hit, which changes fish HP, which changes how long the cast runs — so the
 * turn sets are NOT identical and pooling their separate rates would compare
 * two different denominators. Only turns both arms actually played are
 * counted.
 */
function pairedTurns(arm: ReplayReport, base: ReplayReport, field: "covered" | "hit"): Paired {
  const baseTurns = new Map<string, boolean>();
  for (const r of base.results) for (const t of r.turns) baseTurns.set(`${r.docId}|${t.turn}`, t[field]);
  let n = 0;
  let armWins = 0;
  let baseWins = 0;
  let armYes = 0;
  let baseYes = 0;
  for (const r of arm.results) {
    for (const t of r.turns) {
      const b = baseTurns.get(`${r.docId}|${t.turn}`);
      if (b === undefined) continue;
      n++;
      if (t[field]) armYes++;
      if (b) baseYes++;
      if (t[field] && !b) armWins++;
      else if (!t[field] && b) baseWins++;
    }
  }
  return {
    n,
    armWins,
    baseWins,
    armRate: n ? armYes / n : 0,
    baseRate: n ? baseYes / n : 0,
    p: exactMcNemarP(armWins, baseWins),
  };
}

function pairedCasts(arm: ReplayReport, base: ReplayReport): { gained: number; lost: number; p: number } {
  const byId = new Map(base.results.map((r) => [r.docId, r]));
  let gained = 0;
  let lost = 0;
  for (const r of arm.results) {
    const b = byId.get(r.docId);
    if (!b) continue;
    const a = r.outcome === "caught" ? 1 : 0;
    const c = b.outcome === "caught" ? 1 : 0;
    if (a > c) gained++;
    else if (a < c) lost++;
  }
  return { gained, lost, p: exactMcNemarP(gained, lost) };
}

function pp(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/**
 * Mean distinct zones (of 9) on the cards an arm actually played — the
 * STRUCTURAL half of conversion. A card covers only a subset of the 3x3
 * window, so `conversion <= zones/9` is not a bound the policy can beat by
 * placement alone; the gap between `zones/9` and realized conversion is how
 * much the placement is aiming WITHIN the window rather than merely covering
 * it. Printed per arm because a placement change can silently shift which
 * cards get played.
 */
function meanPlayedZones(report: ReplayReport, cardsByDoc: Map<string, CastTrace>): number {
  let total = 0;
  let n = 0;
  for (const r of report.results) {
    const trace = cardsByDoc.get(r.docId);
    if (!trace) continue;
    for (const t of r.turns) {
      const card = trace.cards.get(t.cardId);
      if (!card) continue;
      total += new Set([...card.hitZones, ...card.critZones]).size;
      n++;
    }
  }
  return n ? total / n : 0;
}

function main(): void {
  const traces = loadCastTraces().filter(isCleanTrace);
  const matcherArg = process.argv.find((a) => a.startsWith("--matcher="))?.split("=")[1];
  const matcherTier: "off" | "loo" = matcherArg === "off" ? "off" : "loo";
  const byDoc = new Map(traces.map((t) => [t.docId, t]));
  const base = replayCorpus(traces, { matcherTier });

  console.log(`\n▸ focusCoverageSweep.ts — ${traces.length} clean recorded traces — matcher tier ${matcherTier.toUpperCase()}`);
  console.log(`  every arm paired against the shipped placement on the SAME (cast, turn) pairs.`);
  console.log(`  ABSOLUTES ARE NOT FORECASTS (session 48) — read the Δ columns.\n`);
  console.log(
    `  base (EV placement):  coverage ${base.covered}/${base.shots} = ${pp(base.covered / base.shots)}   ` +
      `per-turn hit ${base.hits}/${base.shots} = ${pp(base.hits / base.shots)}   ` +
      `conversion ${pp(base.covered ? base.hits / base.covered : 0)}   caught ${base.caught}/${base.casts}`,
  );
  const baseZones = meanPlayedZones(base, byDoc);
  console.log(
    `  deck structure: mean ${baseZones.toFixed(2)} of 9 zones on the cards the base arm played = ${pp(baseZones / 9)} — ` +
      `the conversion a covering window would give with NO aiming inside it.`,
  );
  console.log(
    `  RECORDED policy, same turns: coverage ${base.actualCovered}/${base.shots} = ${pp(base.actualCovered / base.shots)}   ` +
      `per-turn hit ${base.actualHits}/${base.actualShotsOnReplayedTurns} = ${pp(base.actualHits / base.actualShotsOnReplayedTurns)}`,
  );
  console.log("");
  console.log("  arm             coverage Δ (paired)              hit-rate Δ (paired)              conv/zones   caught        McNemar p");
  console.log("  --------------  -------------------------------  -------------------------------  -----------  ------------  ---------");

  const arms: { label: string; opts: Parameters<typeof replayCorpus>[1] }[] = [];
  for (const H of [1, 2, 3, 4, 5]) arms.push({ label: `override H=${H}`, opts: { matcherTier, coverageHorizon: H } });
  for (const w of [0.5, 1, 2, 3, 6]) {
    for (const H of [2, 3]) {
      arms.push({ label: `blend w=${w} H=${H}`, opts: { matcherTier, coverageHorizon: H, coverageWeight: w } });
    }
  }
  for (const { label, opts } of arms) {
    const arm = replayCorpus(traces, opts);
    const cov = pairedTurns(arm, base, "covered");
    const hit = pairedTurns(arm, base, "hit");
    const cast = pairedCasts(arm, base);
    const conv = arm.covered ? arm.hits / arm.covered : 0;
    console.log(
      `  ${label.padEnd(14)}  ` +
        `${pp(cov.baseRate)}→${pp(cov.armRate)} (+${cov.armWins}/-${cov.baseWins}, p=${cov.p.toFixed(3)})`.padEnd(33) +
        `${pp(hit.baseRate)}→${pp(hit.armRate)} (+${hit.armWins}/-${hit.baseWins}, p=${hit.p.toFixed(3)})`.padEnd(33) +
        `${pp(conv).padStart(6)}/${meanPlayedZones(arm, byDoc).toFixed(1)}z  ` +
        `${String(arm.caught).padStart(2)}/${arm.casts} +${cast.gained}/-${cast.lost}`.padEnd(14) +
        `${cast.p.toFixed(3)}`,
    );
  }
  console.log(`\n  paired turn n = ${pairedTurns(replayCorpus(traces, { matcherTier, coverageHorizon: 3 }), base, "covered").n}`);
  console.log("");
}

const isMain = process.argv[1]?.endsWith("focusCoverageSweep.ts");
if (isMain) main();
