/**
 * scripts/focusBudgetSweep.ts — [session 49, brief §3] the A/B of the three
 * cheap focus-budget policies against the shipped "spend whatever EV says"
 * behavior, on the off-policy replay's 73 real trajectories.
 *
 * The brief's ordering, and its reasoning, is that the binding constraint is
 * the FOCUS BUDGET and not the movement model: 80.8% of casts escape by
 * meter-out, 50.4% of turns are played at focus zero, and the first move
 * alone spends 1.62 of the meter's 3 points. `focusReserveWeight` — the knob
 * built for exactly this — is inert (session 48, DECISIONS.md).
 *
 * Session 48's standing rule is enforced by how this reads: **the replay is
 * for DIFFERENCES, never absolutes.** Its per-turn hit rate matched the mean
 * `pHitPredicted` the policy assigned to the same shots, because resolution
 * and aiming share a movement model fitted to the same corpus, and live
 * refuted the absolute at p=0.012. So every arm below is reported as a PAIRED
 * difference against the shipped arm on the same casts, and the absolute
 * columns are context, not forecasts.
 *
 * **[session 50, brief §1] The precondition FAILED as this script originally
 * ran it, and the failure is now fixable rather than merely reported.** The
 * replay disabled the matcher tier (`offPolicyReplay.ts` conservatism #3), and
 * that tier is exactly what pulls focus a long way; with it off the replayed
 * policy spent 0.64-0.71 on the opening move against live's 1.80, so
 * `costCap(2)` and `threshold(<=1)` were byte-for-byte inert and the A/B said
 * nothing about the policies. `--matcher=loo` runs the tier leave-one-cast-out
 * instead of dropping it, which is the arm whose behaviour regime actually
 * matches live. Read the precondition block before reading any arm.
 *
 * Usage: npx tsx scripts/focusBudgetSweep.ts [--matcher=loo|off]
 */

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { replayCorpus, type ReplayReport } from "../src/sim/fishing/offPolicyReplay.js";
import { manhattan } from "../src/sim/fishing/geometry.js";
import { loadRingPredictions, zoneMapVersionOf } from "./liveFishing.js";
import { describePolicy, type FocusBudgetPolicy } from "../src/strategy/fishing/focusBudget.js";

/**
 * [session 50] Live's own opening focus spend, read off `ringPrediction.jsonl`'s
 * `focusMoveCost` rather than quoted — per the brief's §0 rule that no corpus
 * statistic may be cited without its `n`. Returns the per-cast turn-0 spends,
 * so the precondition can be a real interval comparison instead of an
 * eyeballed one.
 */
function liveOpeningSpends(): number[] {
  return loadRingPredictions()
    .filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number")
    .map((r) => r.focusMoveCost as number);
}

function meanAndCi(xs: number[]): { mean: number; lo: number; hi: number; n: number } {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
  if (n < 2) return { mean, lo: mean, hi: mean, n };
  const varr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(varr / n);
  return { mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se, n };
}

function pairedCasts(arm: ReplayReport, base: ReplayReport): { gained: number; lost: number } {
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
  return { gained, lost };
}

/**
 * Exact binomial two-sided p for a McNemar-style discordant pair under
 * H0: p = 0.5. Exact rather than the chi-square approximation because the
 * discordant counts here are small enough that the approximation is not safe.
 */
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

/**
 * The focus-spend profile — the PRECONDITION check for this whole sweep. If
 * the replay does not reproduce session 48's meter-out dynamics (80.8% of
 * casts empty the meter, 50.4% of turns played at zero, 1.62 points on the
 * first move), then a null result here says nothing about the policies; it
 * says the harness cannot see the phenomenon they target.
 */
function focusStats(report: ReplayReport) {
  let turns = 0;
  let meterOutCasts = 0;
  let zeroFocusTurns = 0;
  const spendByTurn: number[] = [];
  const countByTurn: number[] = [];
  for (const r of report.results) {
    turns += r.turns.length;
    if (r.turns.some((t) => t.focusRemaining <= 0)) meterOutCasts++;
    for (let i = 0; i < r.turns.length; i++) {
      const t = r.turns[i]!;
      if (t.focusRemaining <= 0) zeroFocusTurns++;
      spendByTurn[i] = (spendByTurn[i] ?? 0) + t.moveCost;
      countByTurn[i] = (countByTurn[i] ?? 0) + 1;
    }
  }
  return {
    meanTurns: turns / Math.max(1, report.results.length),
    meterOutCasts,
    zeroFocusTurns,
    totalTurns: turns,
    firstMoveSpend: countByTurn[0] ? spendByTurn[0]! / countByTurn[0]! : 0,
    spendByTurn: spendByTurn.map((v, i) => v / countByTurn[i]!),
  };
}

function main() {
  const traces = loadCastTraces().filter(isCleanTrace);
  const matcherArg = process.argv.find((a) => a.startsWith("--matcher="))?.split("=")[1];
  const matcherTier: "off" | "loo" = matcherArg === "loo" ? "loo" : "off";
  const armOpts = { matcherTier } as const;
  const base = replayCorpus(traces, armOpts);

  console.log(`\n▸ focusBudgetSweep.ts — ${traces.length} clean recorded traces — matcher tier ${matcherTier.toUpperCase()}`);
  console.log(`  every arm paired against the shipped arm on the SAME casts.`);
  console.log(`  ABSOLUTES ARE NOT FORECASTS (session 48, DECISIONS.md) — read the Δ columns.\n`);
  const b0 = focusStats(base);
  console.log(
    `  shipped: caught ${base.caught}/${base.casts} = ${((base.caught / base.casts) * 100).toFixed(1)}%   ` +
      `per-turn hit ${base.hits}/${base.shots} = ${((base.hits / base.shots) * 100).toFixed(1)}%   ` +
      `mean replayed turns/cast ${b0.meanTurns.toFixed(2)}`,
  );

  // The RECORDED policy's own spend, straight off the traces — the profile
  // session 48's §5c measured and the brief's §3 is built on. Computed here so
  // the comparison below is self-contained rather than quoted.
  const recSpend: number[] = [];
  const recCount: number[] = [];
  let recZero = 0;
  let recTurns = 0;
  let recEverZero = 0;
  for (const t of traces) {
    let sawZero = false;
    for (let i = 1; i < t.turns.length; i++) {
      const cost = manhattan(t.turns[i - 1]!.focusPoint, t.turns[i]!.focusPoint);
      recSpend[i - 1] = (recSpend[i - 1] ?? 0) + cost;
      recCount[i - 1] = (recCount[i - 1] ?? 0) + 1;
      recTurns++;
      if (t.turns[i]!.focusMeter <= 0) {
        recZero++;
        sawZero = true;
      }
    }
    if (sawZero) recEverZero++;
  }
  const recProfile = recSpend.map((v, i) => v / recCount[i]!);

  // Split the recorded corpus by ZONE-MAP ERA. Session 47's `ZONE_OFFSET` fix
  // landed mid-corpus, and the five session-48 casts are the only ones played
  // under the corrected map. Pooling them with the 68 that aimed with the
  // transpose produces a profile that describes neither policy.
  // Derived from `data/ringPrediction.jsonl`'s own `zoneMapVersion`, not
  // hard-coded: that field IS the authoritative record of which map a cast was
  // aimed with (session 48), and a hard-coded list silently goes stale the
  // next time a batch runs — which it did, once, within this same session.
  const CORRECTED_MAP_CASTS = new Set(
    loadRingPredictions()
      .filter((r) => zoneMapVersionOf(r) === "corrected")
      .map((r) => r.castId),
  );
  const eraProfile = (ids: (id: string) => boolean) => {
    const sp: number[] = [];
    const ct: number[] = [];
    let n = 0;
    for (const t of traces) {
      if (!ids(t.docId)) continue;
      n++;
      for (let i = 1; i < t.turns.length; i++) {
        const cost = manhattan(t.turns[i - 1]!.focusPoint, t.turns[i]!.focusPoint);
        sp[i - 1] = (sp[i - 1] ?? 0) + cost;
        ct[i - 1] = (ct[i - 1] ?? 0) + 1;
      }
    }
    return { casts: n, profile: sp.map((v, i) => v / ct[i]!) };
  };
  const transposedEra = eraProfile((id) => !CORRECTED_MAP_CASTS.has(id));
  const correctedEra = eraProfile((id) => CORRECTED_MAP_CASTS.has(id));

  console.log("\n  ── PRECONDITION: does the replay reproduce the meter-out dynamics at all? ──");
  console.log("    the RECORDED policy, measured off the same traces (transposed zone map, matcher tier ON):");
  console.log(
    `      casts that ever hit focus 0: ${recEverZero}/${traces.length} = ${((recEverZero / traces.length) * 100).toFixed(1)}%   ` +
      `turns at focus 0: ${recZero}/${recTurns} = ${((recZero / Math.max(1, recTurns)) * 100).toFixed(1)}%`,
  );
  console.log(`      mean spend on the FIRST move: ${(recProfile[0] ?? 0).toFixed(2)} of 3`);
  console.log(`      mean spend by turn:           ${recProfile.map((v) => v.toFixed(2)).join(" ")}`);
  console.log("\n    ...split by ZONE-MAP ERA, since session 47's fix landed mid-corpus:");
  console.log(
    `      transposed map, ${String(transposedEra.casts).padStart(2)} casts: first move ${(transposedEra.profile[0] ?? 0).toFixed(2)}   by turn ${transposedEra.profile.map((v) => v.toFixed(2)).join(" ")}`,
  );
  console.log(
    `      CORRECTED map,  ${String(correctedEra.casts).padStart(2)} casts: first move ${(correctedEra.profile[0] ?? 0).toFixed(2)}   by turn ${correctedEra.profile.map((v) => v.toFixed(2)).join(" ")}`,
  );
  console.log(`\n    TODAY's policy in the replay (corrected zone map, matcher tier ${matcherTier.toUpperCase()}):`);
  console.log(
    `      casts that ever hit focus 0: ${b0.meterOutCasts}/${base.casts} = ${((b0.meterOutCasts / base.casts) * 100).toFixed(1)}%   ` +
      `turns at focus 0: ${b0.zeroFocusTurns}/${b0.totalTurns} = ${((b0.zeroFocusTurns / Math.max(1, b0.totalTurns)) * 100).toFixed(1)}%`,
  );
  console.log(`      mean spend on the FIRST move: ${b0.firstMoveSpend.toFixed(2)} of 3`);
  console.log(`      mean spend by turn:           ${b0.spendByTurn.map((v) => v.toFixed(2)).join(" ")}`);
  console.log(
    `\n    => the replay's policy spends ${((b0.firstMoveSpend / Math.max(1e-9, recProfile[0] ?? 0)) * 100).toFixed(0)}% of what the recorded one did on the opening move.`,
  );
  // [session 50] The precondition, stated as an interval rather than a
  // ratio. The reference is LIVE's own opening spend — the newest casts,
  // played by today's stack under the corrected map — not the pooled corpus,
  // whose transposed-era majority answers a different question.
  const live = meanAndCi(liveOpeningSpends());
  console.log(
    `    LIVE opening spend (ringPrediction.jsonl, n=${live.n} casts): ${live.mean.toFixed(2)} of 3, 95% CI [${live.lo.toFixed(2)}, ${live.hi.toFixed(2)}]`,
  );
  const inside = b0.firstMoveSpend >= live.lo && b0.firstMoveSpend <= live.hi;
  console.log(
    inside
      ? `    => PRECONDITION MET: the replay's ${b0.firstMoveSpend.toFixed(2)} is INSIDE live's interval. The arms below are measuring a system that spends.`
      : `    => PRECONDITION FAILED: the replay's ${b0.firstMoveSpend.toFixed(2)} is OUTSIDE live's interval. A null result below says nothing about the policies — it says the harness cannot see the phenomenon they target.`,
  );
  console.log("");

  const arms: FocusBudgetPolicy[] = [
    { kind: "costCap", cap: 0 },
    { kind: "costCap", cap: 1 },
    { kind: "costCap", cap: 2 },
    { kind: "threshold", theta: 0.1 },
    { kind: "threshold", theta: 0.25 },
    { kind: "threshold", theta: 0.5 },
    { kind: "threshold", theta: 1 },
    { kind: "threshold", theta: 2 },
    { kind: "schedule" },
    { kind: "schedule", expectedTurns: 3 },
    { kind: "schedule", expectedTurns: 4 },
    { kind: "schedule", expectedTurns: 6 },
    { kind: "schedule", expectedTurns: 8 },
  ];

  console.log("  policy                       caught          per-turn hit      Δcaught (casts)   turns/cast   McNemar p");
  for (const policy of arms) {
    const arm = replayCorpus(traces, { ...armOpts, focusPolicy: policy });
    const { gained, lost } = pairedCasts(arm, base);
    const p = exactMcNemarP(gained, lost);
    const st = focusStats(arm);
    console.log(
      `  ${describePolicy(policy).padEnd(28)} ${String(arm.caught).padStart(2)}/${arm.casts} = ${((arm.caught / arm.casts) * 100).toFixed(1).padStart(5)}%   ` +
        `${String(arm.hits).padStart(3)}/${String(arm.shots).padStart(3)} = ${((arm.hits / arm.shots) * 100).toFixed(1).padStart(5)}%   ` +
        `+${gained} / -${lost}`.padEnd(18) +
        `${st.meanTurns.toFixed(2).padStart(6)}       ${p.toFixed(3)}`,
    );
  }
  console.log("");
}

const isMain = process.argv[1]?.endsWith("focusBudgetSweep.ts");
if (isMain) main();
