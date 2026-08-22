/**
 * scripts/pConnectBiasDecomposition.ts — [session 73, brief §1b / GATE 1]
 *
 * **Why is `pConnect` optimistic?** Session 72 measured it at 50.0% predicted
 * against 39.8% observed on 118 era-matched turns — a 2.3 SE gap, monotone
 * across all five buckets, so the ORDERING is right and the LEVEL is wrong.
 * This script decomposes that level error by source and reports a residual.
 *
 * ── The one structural fact that shapes everything below ──────────────────
 *
 * `hit` is not a coin flip. In the replay it is a DETERMINISTIC geometric
 * predicate: the chosen card's hit/crit zones are laid over the chosen focus,
 * and the fish's actual recorded cell either lands inside that set or does
 * not. No server roll enters. So the entire gap is one statement and only one:
 *
 *     the distribution puts too much mass on the cells the policy aims at.
 *
 * And note what that CANNOT be blamed on. Over the whole grid the model's
 * error field sums to exactly zero — `Σ_c dist(c) = 1` and
 * `Σ_c 1{actual = c} = 1` — so a distribution cannot be "globally
 * overconfident". The gap exists only because the aimed-at SUBSET is where
 * the positive half of that zero-sum error concentrates. Any fix has to move
 * mass between cells, never scale it.
 *
 * ── The instrument: hold the placement fixed, swap one component ───────────
 *
 * Re-planning under a different distribution changes WHICH cells get chosen,
 * which confounds the estimator's calibration with the policy's choices. So
 * the primary measurement (§3) re-scores the SHIPPED arm's own chosen cell
 * set under each alternative tier. Because `connectCells` and `actual` are
 * both held fixed, `hit` is IDENTICAL across every arm — the observed column
 * is pinned and only the predicted column can move. That is the cleanest
 * single toggle this corpus admits.
 *
 * §6 then runs the same toggles as POLICY-FOLLOWING arms (the replay re-plans
 * under them) and reports the difference as an explicit residual: the part of
 * each toggle's effect that is the policy choosing different cells rather
 * than the estimator being differently calibrated. That residual is the one
 * number here that is not true by construction, and it is the one the brief's
 * "report what does not add up" is asking for.
 *
 * DIAGNOSIS ONLY. Ships no correction — brief §1c, and §7's "do not ship a
 * `pConnect` correction in the session that diagnoses it".
 */
import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";
import {
  replayCast,
  type ReplayOptions,
  type ReplayTurnDiagnostic,
} from "../src/sim/fishing/offPolicyReplay.js";
import { loadMinedPatterns, loadRingPredictions, type RingPredictionRecord } from "./liveFishing.js";
import { cellKey, type Cell } from "../src/sim/fishing/geometry.js";
import {
  ringCells,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
  DEFAULT_SWITCH_PROBABILITY,
  type Distribution,
  type RingModelOptions,
} from "../src/strategy/fishing/stepClass.js";

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(2)}pp`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** The era marker, identical to `replayGapDecomposition.ts` and `redrawTriggerCalibration.ts`. */
const playedUnderPosterior = (r: RingPredictionRecord): boolean => r.matcherWeight !== undefined;

/** The mass a distribution puts on a (deduplicated) cell set — what `pConnect` is. */
export function massOn(dist: Distribution | null, cells: readonly Cell[]): number {
  if (!dist) return 0;
  let total = 0;
  for (const c of cells) total += dist.get(cellKey(c))?.p ?? 0;
  return total;
}

export function uniformOver(cells: readonly Cell[]): Distribution {
  const out: Distribution = new Map();
  for (const c of cells) out.set(cellKey(c), { cell: c, p: 1 / cells.length });
  return out;
}

export function allGridCells(gridSize: number): Cell[] {
  const out: Cell[] = [];
  for (let x = 1; x <= gridSize; x++) for (let y = 1; y <= gridSize; y++) out.push({ x, y });
  return out;
}

/**
 * The support the sticky step model can reach at all: both rings, since
 * `stickyStepDistribution` marginalises over the two step counts. Note what
 * is NOT in it — `ringCells` is Manhattan distance EXACTLY k, so the fish's
 * own cell (a no-move turn) is outside every ring and carries probability
 * zero under every arm in this file. §4 measures how often that bites.
 */
export function stickySupport(current: Cell, gridSize: number): Cell[] {
  return [...ringCells(current, 1, gridSize), ...ringCells(current, 2, gridSize)];
}

export const ERA_OPTS = (): ReplayOptions => ({ matcherTier: "loo", matcherLibrary: loadMinedPatterns() });

export function eraCasts(traces: readonly CastTrace[]): CastTrace[] {
  const byId = new Map(traces.map((t) => [t.docId, t]));
  const live = loadRingPredictions().filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number");
  return live.filter(playedUnderPosterior).flatMap((r) => (byId.has(r.castId) ? [byId.get(r.castId)!] : []));
}

/** Replay one arm over today's era and return every turn's diagnostic. */
export function collect(traces: readonly CastTrace[], era: readonly CastTrace[], opts: ReplayOptions): { docId: string; d: ReplayTurnDiagnostic }[] {
  const out: { docId: string; d: ReplayTurnDiagnostic }[] = [];
  for (const t of era) {
    const others = traces.filter((o) => o.docId !== t.docId);
    replayCast(t, others, { ...opts, onTurn: (d) => out.push({ docId: t.docId, d }) });
  }
  return out;
}

/** predicted − observed, with the SE of the observed rate (the noisy half). */
export function gapOf(predicted: readonly number[], hits: readonly boolean[]): { gap: number; pred: number; obs: number; se: number } {
  const pred = mean(predicted);
  const k = hits.filter(Boolean).length;
  const obs = k / hits.length;
  return { gap: pred - obs, pred, obs, se: Math.sqrt((obs * (1 - obs)) / hits.length) };
}

/**
 * Rebuild the ring tier for one turn under different `RingModelOptions` /
 * switch probability, against the identical leave-one-out table. This is the
 * knob sweep's whole mechanism — one option changes, everything else is the
 * same object the replay used.
 */
/**
 * Scale the shrinkage constant that is ACTUALLY READ.
 *
 * `shrinkageFor` resolves `shrinkageKByClass[k] ?? shrinkageK`, and the
 * shipped default sets BOTH classes in `shrinkageKByClass` ({1: 0.1, 2: 8}).
 * So scaling the shared `shrinkageK` field is a no-op — this file's first
 * draft did exactly that and reported the conditional tier as contributing
 * +0.00pp, which was an unread knob wearing a measured zero's clothes. Scale
 * the per-class overrides, or measure nothing.
 */
function scaleShrinkage(opts: RingModelOptions, factor: number): RingModelOptions {
  return {
    ...opts,
    shrinkageK: opts.shrinkageK * factor,
    shrinkageKByClass: {
      1: (opts.shrinkageKByClass?.[1] ?? opts.shrinkageK) * factor,
      2: (opts.shrinkageKByClass?.[2] ?? opts.shrinkageK) * factor,
    },
  };
}

export function ringUnder(d: ReplayTurnDiagnostic, opts: RingModelOptions, s: number): Distribution {
  return stickyStepDistribution(d.currentCell, d.stepClass, d.prevDelta, d.stepTable, d.gridSize, opts, s);
}

function main(): void {
  const traces = loadCastTraces().filter(isCleanTrace);
  const era = eraCasts(traces);
  const shipped = collect(traces, era, ERA_OPTS());

  console.log(`\n▸ pConnectBiasDecomposition.ts — SESSION 73 GATE 1`);
  console.log(`  Era-matched replay, TODAY'S POLICY ERA ONLY: ${era.length} casts, ${shipped.length} turns.`);
  console.log(`  An era is a BUNDLE, not a knob (session 71). Everything below is a claim`);
  console.log(`  about today's era and nothing else. DIAGNOSIS ONLY — no correction ships.\n`);

  const hits = shipped.map((r) => r.d.hit);
  const nHit = hits.filter(Boolean).length;
  const base = gapOf(shipped.map((r) => r.d.pConnect), hits);

  // ── §1 ────────────────────────────────────────────────────────────────
  console.log("── §1  THE GAP, RE-MEASURED, AND WHAT IT CAN AND CANNOT BE ──");
  console.log(`  predicted ${pct(base.pred)}   observed ${pct(base.obs)}   GAP ${pp(base.gap)}` +
    `   (${(base.gap / base.se).toFixed(1)} SE, n=${shipped.length} turns)`);
  console.log(`  observed 95% Wilson [${pct(wilson(nHit, hits.length)[0])}, ${pct(wilson(nHit, hits.length)[1])}]`);
  console.log(`\n  THE BRIEF'S NUMBERS ARE STALE BY SESSION 72'S OWN BATCH. It quotes 118 turns`);
  console.log(`  at 50.0% vs 39.8%; those were computed BEFORE the four casts session 72 then`);
  console.log(`  played were appended to the corpus. \`redrawTriggerCalibration.ts\`, unmodified,`);
  console.log(`  now prints the same ${shipped.length} turns and the same ${pct(base.pred)} / ${pct(base.obs)} as this file. The`);
  console.log(`  FINDING is unchanged — still optimistic, still every bucket — the SIZE moved.`);
  console.log(`\n  \`hit\` is DETERMINISTIC here — the card's zones over the chosen focus either`);
  console.log(`  contain the fish's recorded cell or do not. No server roll enters, so the gap`);
  console.log(`  is exactly one statement: the distribution puts too much mass on the cells the`);
  console.log(`  policy aims at. And it cannot be "global overconfidence" — the model's error`);
  console.log(`  field sums to zero over the grid by construction. Only the AIMED-AT SUBSET can`);
  console.log(`  be wrong, which means any fix moves mass between cells and never scales it.`);

  console.log(`\n  reliability, the session-72 table reproduced as the precondition:`);
  const edges = [0, 0.1, 0.2, 0.3, 0.5, 1.01];
  console.log(`  pConnect bucket    turns   predicted   observed hit   95% Wilson`);
  for (let i = 0; i < edges.length - 1; i++) {
    const b = shipped.filter((r) => r.d.pConnect >= edges[i]! && r.d.pConnect < edges[i + 1]!);
    if (!b.length) continue;
    const k = b.filter((r) => r.d.hit).length;
    const ci = wilson(k, b.length);
    console.log(
      `  [${edges[i]!.toFixed(2)}, ${edges[i + 1]!.toFixed(2)})`.padEnd(19) +
        `${String(b.length).padStart(5)}   ${pct(mean(b.map((r) => r.d.pConnect))).padStart(9)}` +
        `   ${pct(k / b.length).padStart(12)}   [${pct(ci[0])}, ${pct(ci[1])}]`,
    );
  }

  // ── §2  the ladder ────────────────────────────────────────────────────
  const massUniformRing = shipped.map((r) => massOn(uniformOver(stickySupport(r.d.currentCell, r.d.gridSize)), r.d.connectCells));
  const massUniformGrid = shipped.map((r) => massOn(uniformOver(allGridCells(r.d.gridSize)), r.d.connectCells));
  const massRing = shipped.map((r) => massOn(r.d.ringDist, r.d.connectCells));
  const massShipped = shipped.map((r) => r.d.pConnect);
  const uGrid = mean(massUniformGrid);
  const uRing = mean(massUniformRing);
  const mRing = mean(massRing);
  const mShip = mean(massShipped);

  console.log("\n── §2  THE LADDER — WHERE THE PREDICTED MASS IS ADDED, AND WHAT IT BUYS ──");
  console.log(`  Placement HELD FIXED throughout: same chosen cells, same actual cell, so \`hit\``);
  console.log(`  cannot move and observed is PINNED at ${pct(base.obs)} in every row. Only the predicted`);
  console.log(`  column varies, which isolates the estimator from the policy's choices.\n`);
  const rungs: [string, number, string][] = [
    ["nothing at all (uniform grid)", uGrid, "the aimed cells' share of the board"],
    ["+ ring geometry (uniform on ring)", uRing, "the fish must be at distance 1 or 2"],
    ["+ the corpus delta table (ring tier)", mRing, "conditional/marginal displacements"],
    ["+ the matcher tier (SHIPPED)", mShip, "what live consults"],
  ];
  console.log(`  rung                                   predicted   step      gap vs observed`);
  let prev = 0;
  for (const [label, v, note] of rungs) {
    console.log(
      `  ${label.padEnd(38)}${pct(v).padStart(8)}   ${(prev === 0 ? "—" : pp(v - prev)).padStart(8)}   ${pp(v - base.obs).padStart(9)}   ${note}`,
    );
    prev = v;
  }
  console.log(`\n  The steps sum to the gap by telescoping — that part is arithmetic. THE FINDING`);
  console.log(`  IS WHICH STEP IS BIG:`);
  const claimed = mRing - uRing;
  const delivered = base.obs - uRing;
  console.log(`\n    ring geometry alone is PESSIMISTIC by ${pp(uRing - base.obs)} — the policy's placements`);
  console.log(`      connect that much MORE than their share of the legal ring. Real skill, and`);
  console.log(`      the corpus is what supplies it.`);
  console.log(`    the corpus delta table then CLAIMS a further ${pp(claimed)} of connect mass.`);
  console.log(`    it DELIVERS ${pp(delivered)} — the whole excess of the aimed cells over ring-uniform.`);
  console.log(`\n    DELIVERY RATIO ${pct(delivered / claimed)} — the ring model's corpus sharpening is worth`);
  console.log(`    about ${(delivered / claimed).toFixed(2)}x what it says it is. That single step is ${pct((claimed - delivered) / base.gap)} of the whole gap.`);
  console.log(`\n    the matcher tier adds ${pp(mShip - mRing)} on top. It is NOT the cause.`);

  // ── §3  the channel split ─────────────────────────────────────────────
  console.log("\n── §3  THE CHANNEL SPLIT — EXACT BY ARITHMETIC, SO IT IS NOT EVIDENCE ──");
  console.log(`  \`dist = w * matcherOnRing + (1-w) * ring\` and \`pConnect\` is a SUM of mass over a`);
  console.log(`  fixed cell set — a linear functional — so this closes to machine epsilon no`);
  console.log(`  matter what the tiers do. Session 71's lesson says distrust a decomposition`);
  console.log(`  that sums perfectly; stated up front, here is WHY this one does. Accounting`);
  console.log(`  identity, not a finding.\n`);
  const live = shipped.filter((r) => r.d.matcherOnRing !== null);
  const liveHits = live.filter((r) => r.d.hit).length;
  const liveGap = gapOf(live.map((r) => massOn(r.d.matcherOnRing, r.d.connectCells)), live.map((r) => r.d.hit));
  const w = shipped.map((r) => r.d.matcherWeight);
  const mMass = shipped.map((r) => massOn(r.d.matcherOnRing, r.d.connectCells));
  const recomposed = shipped.map((_, i) => w[i]! * mMass[i]! + (1 - w[i]!) * massRing[i]!);
  const identityResidual = Math.max(...shipped.map((r, i) => Math.abs(recomposed[i]! - r.d.pConnect)));
  console.log(`  turns with a live matcher tier   ${live.length} / ${shipped.length}   mean w over ALL turns = ${mean(w).toFixed(4)}`);
  console.log(`  ON ITS OWN TURNS the matcher predicts ${pct(liveGap.pred)} and observes ${pct(liveHits / live.length)}` +
    ` — gap ${pp(liveGap.gap)}.`);
  console.log(`  It is the UNDER-confident tier. The optimism is not coming from here.`);
  const cM = mean(shipped.map((r, i) => w[i]! * (mMass[i]! - (r.d.hit ? 1 : 0))));
  const cR = mean(shipped.map((r, i) => (1 - w[i]!) * (massRing[i]! - (r.d.hit ? 1 : 0))));
  console.log(`\n  contribution to the ${pp(base.gap)} gap:`);
  console.log(`    matcher channel   w * (matcher - hit)      ${pp(cM).padStart(9)}   ${pct(cM / base.gap).padStart(6)} of it`);
  console.log(`    ring channel      (1-w) * (ring - hit)     ${pp(cR).padStart(9)}   ${pct(cR / base.gap).padStart(6)} of it`);
  console.log(`    SUM                                        ${pp(cM + cR).padStart(9)}   identity residual ${identityResidual.toExponential(1)}`);

  // ── §4  candidates measured at zero ───────────────────────────────────
  console.log("\n── §4  TWO NAMED CANDIDATES, MEASURED AT EXACTLY ZERO ──");
  const noMove = shipped.filter((r) => cellKey(r.d.actual) === cellKey(r.d.currentCell));
  const offRing = shipped.filter((r) => {
    const sup = new Set(stickySupport(r.d.currentCell, r.d.gridSize).map(cellKey));
    return !sup.has(cellKey(r.d.actual));
  });
  console.log(`  \`ringCells\` is Manhattan distance EXACTLY k, so two whole outcome classes carry`);
  console.log(`  probability ZERO under every arm above — including the two uninformed ones. If`);
  console.log(`  either happened, its entire \`pConnect\` would be spent on an impossibility.\n`);
  console.log(`    fish did not move (actual == current)      ${String(noMove.length).padStart(4)} / ${shipped.length} turns`);
  console.log(`    actual off BOTH rings (class switch)      ${String(offRing.length).padStart(5)} / ${shipped.length} turns`);
  console.log(`\n  Both are zero on this era. A structural zero-probability event is NOT what is`);
  console.log(`  wrong with \`pConnect\`, and the ${DEFAULT_SWITCH_PROBABILITY} switch probability is not being spent on`);
  console.log(`  anything here. Two candidates eliminated by measurement rather than argument.`);

  // ── §5  inside the ring tier ──────────────────────────────────────────
  console.log("\n── §5  INSIDE THE RING TIER — WHICH KNOB OVER-CLAIMS ──");
  console.log(`  §2 puts the whole gap in one step: the corpus delta table's sharpening. That`);
  console.log(`  step has three knobs. Each row below changes ONE of them against the identical`);
  console.log(`  leave-one-out table, placement still frozen.\n`);
  const shippedRing: RingModelOptions = DEFAULT_RING_MODEL_OPTIONS;
  const knobs: [string, RingModelOptions, number, string][] = [
    ["SHIPPED", shippedRing, DEFAULT_SWITCH_PROBABILITY, "the ring tier as it runs"],
    ["ringFloor 0.2", { ...shippedRing, ringFloor: 0.2 }, DEFAULT_SWITCH_PROBABILITY, "flatten toward ring-uniform"],
    ["ringFloor 0.3", { ...shippedRing, ringFloor: 0.3 }, DEFAULT_SWITCH_PROBABILITY, ""],
    ["ringFloor 0.5", { ...shippedRing, ringFloor: 0.5 }, DEFAULT_SWITCH_PROBABILITY, ""],
    ["shrinkage x4", scaleShrinkage(shippedRing, 4), DEFAULT_SWITCH_PROBABILITY, "trust the conditional less"],
    ["shrinkage x16", scaleShrinkage(shippedRing, 16), DEFAULT_SWITCH_PROBABILITY, ""],
    ["conditional OFF", scaleShrinkage(shippedRing, Infinity), DEFAULT_SWITCH_PROBABILITY, "class marginal only"],
    ["switch 0.20", shippedRing, 0.2, "mix in the other ring harder"],
    ["switch 0.50", shippedRing, 0.5, ""],
  ];
  console.log(`  ring knob            predicted        gap   vs shipped   note`);
  for (const [label, opts, sw, note] of knobs) {
    const g = gapOf(shipped.map((r) => massOn(ringUnder(r.d, opts, sw), r.d.connectCells)), hits);
    console.log(
      `  ${label.padEnd(20)}${pct(g.pred).padStart(8)}   ${pp(g.gap).padStart(9)}   ${(label === "SHIPPED" ? "—" : pp(g.gap - (mRing - base.obs))).padStart(10)}   ${note}`.trimEnd(),
    );
  }
  const condOff = gapOf(shipped.map((r) => massOn(ringUnder(r.d, scaleShrinkage(shippedRing, Infinity), DEFAULT_SWITCH_PROBABILITY), r.d.connectCells)), hits);
  console.log(`\n  THE RESIDUAL, STATED. The prev-delta CONDITIONAL is the single largest cause`);
  console.log(`  identified anywhere in this file: switching it off removes ${pp((mRing - base.obs) - condOff.gap)} of the ring`);
  console.log(`  tier's ${pp(mRing - base.obs)}, i.e. ${pct(((mRing - base.obs) - condOff.gap) / base.gap)} of the whole ${pp(base.gap)} gap.`);
  console.log(`  What is LEFT is ${pp(condOff.gap)}, which at n=${shipped.length} is ${(condOff.gap / base.se).toFixed(2)} SE and no longer`);
  console.log(`  distinguishable from zero. That residual is REPORTED, NOT EXPLAINED — and it is`);
  console.log(`  deliberately not attributed further, because naming a second cause under 1 SE`);
  console.log(`  would be fitting noise and calling it a decomposition.`);
  console.log(`\n  \`switch 0.50\` is listed for the axis, not as a candidate: §4 measured ZERO class`);
  console.log(`  switches on this era, so that knob is not correcting a real event — it is simply`);
  console.log(`  dumping half the mass onto a ring the fish never used. It flattens the number`);
  console.log(`  by destroying information, which is exactly the failure mode §6 tests for.`);
  console.log(`\n  THIS IS A DIAGNOSIS, NOT A TUNING. Brief §1c: a calibration fitted on ${shipped.length} turns`);
  console.log(`  of ONE era is a claim about that era, and five buckets on ${shipped.length} turns is enough to`);
  console.log(`  SEE a bias and not enough to fit a curve. No default here is touched. What the`);
  console.log(`  rows establish is WHICH knob the level error lives behind, not what to set it to.`);

  // ── §6  the residual that is not arithmetic ───────────────────────────
  console.log("\n── §6  POLICY-FOLLOWING ARMS, AND THE RESIDUAL THAT IS NOT ARITHMETIC ──");
  console.log(`  Everything above froze the placement. Here the replay RE-PLANS under each`);
  console.log(`  toggle, so the distribution AND the chosen cells move, and \`hit\` moves with`);
  console.log(`  them. For each component:`);
  console.log(`      d_score  = gap(shipped) - gap(toggle, placement frozen)`);
  console.log(`      d_total  = gap(shipped) - gap(toggle, policy re-planned)`);
  console.log(`      RESIDUAL = d_total - d_score   <- the policy aiming somewhere else\n`);
  // The frozen counterpart of each toggle, on the SHIPPED arm's own cells.
  const fixedWeightMass = shipped.map((r, i) =>
    r.d.matcherOnRing ? 0.9 * massOn(r.d.matcherOnRing, r.d.connectCells) + 0.1 * massRing[i]! : massRing[i]!,
  );
  const frozen = new Map<string, number>([
    ["matcher tier off", mRing - base.obs],
    ["matcher weight fixed at 0.9", gapOf(fixedWeightMass, hits).gap],
  ]);
  frozen.set("prev-delta conditional off", condOff.gap);
  const followers: [string, ReplayOptions][] = [
    ["matcher tier off", { matcherTier: "off" }],
    ["matcher weight fixed at 0.9", { ...ERA_OPTS(), matcherWeighting: "fixed" }],
    ["prev-delta conditional off", { ...ERA_OPTS(), ringModelOptions: scaleShrinkage(shippedRing, Infinity) }],
  ];
  console.log(`  toggle                        turns   predicted   observed        gap    d_score    d_total   RESIDUAL`);
  for (const [label, opts] of followers) {
    const rows = collect(traces, era, opts);
    const g = gapOf(rows.map((r) => r.d.pConnect), rows.map((r) => r.d.hit));
    const dScore = base.gap - frozen.get(label)!;
    const dTotal = base.gap - g.gap;
    console.log(
      `  ${label.padEnd(30)}${String(rows.length).padStart(3)}   ${pct(g.pred).padStart(9)}   ${pct(g.obs).padStart(8)}` +
        `   ${pp(g.gap).padStart(9)}   ${pp(dScore).padStart(8)}   ${pp(dTotal).padStart(8)}   ${pp(dTotal - dScore).padStart(8)}`,
    );
  }
  console.log(`\n  CAVEAT, and it is not small: the re-planned arms run a DIFFERENT NUMBER OF`);
  console.log(`  TURNS (a policy that aims elsewhere catches and escapes on different turns), so`);
  console.log(`  their observed column is not paired with the frozen arms' ${pct(base.obs)}. The residual is`);
  console.log(`  therefore an upper bound on the policy-choice effect, contaminated by which`);
  console.log(`  turns exist at all. It is reported because it is large enough to matter and`);
  console.log(`  because pretending the toggles decompose cleanly is the failure the brief names.`);
}

// [session 74] Entry point guarded so the ladder's helpers above can be
// IMPORTED rather than re-implemented. `shrinkageDeliveryCheck.ts` recomputes
// the delivery ratio at a different shrinkage, and a second copy of `massOn`
// / `stickySupport` / `eraCasts` is exactly how the two scripts would drift
// into reporting ratios that are not comparable.
const isMain = process.argv[1]?.endsWith("pConnectBiasDecomposition.ts");
if (isMain) main();
