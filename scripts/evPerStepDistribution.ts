/**
 * scripts/evPerStepDistribution.ts — [session 98 §C] **THE ΔEV-PER-STEP
 * DISTRIBUTION.** QUESTIONS.md §27, scoped by session 95 §G and unstarted
 * since.
 *
 * ## The question, and why it is exactly this quantity
 *
 * `bestFocusForCard` ranks every reachable placement by
 *
 *     score = ev + focusReserveWeight * focusReserveFraction(focusBudget, focus)
 *
 * Session 95 §G proved that term's ENTIRE ranking effect reduces to a linear
 * movement tax. `reachableCells` guarantees `d <= remaining`, so the
 * `Math.max(0, …)` clamp never fires (0 of 1912 candidates across grids 4/5/6),
 * and with the clamp unreachable
 *
 *     w * (remaining - d) / MAX  =  (w * remaining / MAX)  -  (w / MAX) * d
 *
 * whose first half is constant within a decision and cancels in the argmax. So
 * the term is **exactly `w / FOCUS_METER_MAX` EV-units per manhattan step —
 * 1.00 at the shipped weight of 3**.
 *
 * A tax of that shape changes the winner **if and only if**
 *
 *     ΔEV(best moving placement, best stay-put placement)  <  TAX * Δd
 *
 * i.e. iff `ΔEV / d < 1.00`. That ratio is the whole object of this report:
 * where it is large the tax is INERT and the reserve weight cannot matter;
 * where it is small the tax BINDS and the weight is deciding turns.
 *
 * ## What is reported, and what is deliberately NOT
 *
 * The full DISTRIBUTION, not a mean — the mean of a ratio like this is the
 * least informative summary available. What matters is the fraction of
 * decision points below 1.00, and how that fraction varies with `d`.
 *
 * ⚠ **This report does NOT recommend a `DEFAULT_FOCUS_RESERVE_WEIGHT`.** The
 * session-98 brief forbids it explicitly and it is the right call: a binding
 * fraction says how often the term is live, not whether its price is right.
 * Changing the weight is a separate decision with its own evidence.
 *
 * ⚠ **`castSim` is not touched.** `handoff/OIL-POLICY.md` §0a suspends it for
 * this fishery, and it applies here exactly as much as anywhere else. Every
 * number below comes from the live corpus under leave-one-cast-out replay.
 *
 * ## The measurement, and the discipline it inherits
 *
 * OUT OF SAMPLE, by the same construction `offPolicyReplay.ts`'s callers use:
 * each cast is replayed against a model built from **every other clean cast**
 * (`traces.filter((o) => o.docId !== t.docId)`). An in-sample number here would
 * repeat the mistake sessions 47/49 already documented for logloss.
 *
 * Per turn, from `ReplayTurnDiagnostic`'s pre-play state (`hand`, `manaBefore`,
 * `focusBefore`, `dist`, `gridSize` — the identical inputs `chooseCard` saw):
 *
 *   - enumerate every (affordable card × reachable placement) candidate,
 *   - take the best RAW `ev` at `d = 0` (the stayer) and the best at `d > 0`
 *     (the mover, and its own `d`),
 *   - report `ΔEV / d`.
 *
 * Turns with no `d > 0` candidate are EXCLUDED rather than counted as zero:
 * with the meter empty there is nothing to compare and no tax to pay, so
 * including them would report a binding fraction for decisions the term cannot
 * reach. That exclusion is itself a headline number here, because the tax is
 * structurally a first-turns-only effect (session 95 §G).
 *
 * `evCandidatesAt` is exported and pinned in `tests/fishing/evPerStep.test.ts`
 * — including a drift guard that its argmax is what `chooseCard` actually
 * picks at `focusReserveWeight = 0`, so the report and the shipped chooser
 * cannot silently diverge.
 *
 * Usage: npx tsx scripts/evPerStepDistribution.ts [--mpm=1]
 */
import { isCleanTrace, loadCastTraces, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { replayCast, type ReplayTurnDiagnostic } from "../src/sim/fishing/offPolicyReplay.js";
import { FOCUS_METER_MAX, manhattan, reachableCells } from "../src/sim/fishing/geometry.js";
import {
  DEFAULT_FOCUS_RESERVE_WEIGHT,
  evaluateCardAtFocus,
  type Distribution,
  type FishingCardLike,
  type FocusBudget,
} from "../src/strategy/fishing/cardChoice.js";
import { ERA_OPTS, eraCasts } from "./pConnectBiasDecomposition.js";

/**
 * The movement tax, in EV-units per manhattan step, at the shipped weight.
 * Derived here rather than written as `1` so that a change to either constant
 * moves the report's threshold with it — session 95 §G's identity is
 * `w / FOCUS_METER_MAX`, and a hard-coded 1.00 would silently outlive it.
 */
export const MOVEMENT_TAX_PER_STEP = DEFAULT_FOCUS_RESERVE_WEIGHT / FOCUS_METER_MAX;

/** Float slack for "the same EV", matching `cardChoice.ts`'s own tie epsilon in spirit. */
const EV_EPS = 1e-9;

/**
 * The pre-play state this measurement needs — a structural subset of
 * `ReplayTurnDiagnostic`, so the replay's diagnostics satisfy it directly and a
 * test can build one by hand without inventing thirty irrelevant fields.
 */
export interface EvPerStepInput {
  hand: readonly FishingCardLike[];
  manaBefore: number;
  dist: Distribution;
  gridSize: number;
  focusBefore: FocusBudget;
}

export interface EvPerStepPoint {
  /** Best raw `ev` among placements that spend nothing. */
  stayEv: number;
  /** Best raw `ev` among placements that spend at least one point, and its distance. */
  moverEv: number;
  moverD: number;
  /** `(moverEv - stayEv) / moverD` — the quantity the tax is compared against. */
  deltaPerStep: number;
  /** Best raw `ev` at EXACTLY distance `d`, for every reachable `d > 0`. */
  bestByD: ReadonlyMap<number, number>;
  /** The meter entering the turn, so the report can say where the tax can reach. */
  remaining: number;
}

/**
 * Enumerate the candidate surface `bestFocusForCard` ranks, and reduce it to
 * the stayer/mover pair.
 *
 * `null` means there is nothing to compare — no affordable card, or no
 * placement at `d > 0` (an empty meter). Both are EXCLUSIONS, not zeros.
 *
 * The mover tie-break prefers the SMALLER `d` at equal EV, which is
 * `bestFocusForCard`'s own final tie-break. Taking the farther one would
 * understate `ΔEV / d` and overstate how often the tax binds.
 */
export function evCandidatesAt(s: EvPerStepInput, missPenaltyMultiplier = 1): EvPerStepPoint | null {
  const affordable = s.hand.filter((c) => c.manaCost <= s.manaBefore);
  if (affordable.length === 0) return null;
  const remaining = Math.max(0, s.focusBefore.remaining);
  const cells = reachableCells(s.gridSize, s.focusBefore.current, remaining);

  let stayEv = Number.NEGATIVE_INFINITY;
  let moverEv = Number.NEGATIVE_INFINITY;
  let moverD = 0;
  const bestByD = new Map<number, number>();

  for (const card of affordable) {
    for (const focus of cells) {
      const { ev } = evaluateCardAtFocus(card, focus, s.dist, s.gridSize, missPenaltyMultiplier);
      const d = manhattan(s.focusBefore.current, focus);
      if (d === 0) {
        if (ev > stayEv) stayEv = ev;
        continue;
      }
      const atD = bestByD.get(d);
      if (atD === undefined || ev > atD) bestByD.set(d, ev);
      if (ev > moverEv + EV_EPS || (Math.abs(ev - moverEv) <= EV_EPS && (moverD === 0 || d < moverD))) {
        moverEv = ev;
        moverD = d;
      }
    }
  }
  if (moverD === 0 || stayEv === Number.NEGATIVE_INFINITY) return null;
  return { stayEv, moverEv, moverD, deltaPerStep: (moverEv - stayEv) / moverD, bestByD, remaining };
}

// ── reporting ──────────────────────────────────────────────────────────────

const q = (xs: readonly number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const i = (xs.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? xs[lo]! : xs[lo]! + (xs[hi]! - xs[lo]!) * (i - lo);
};
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const pct = (k: number, n: number): string => (n === 0 ? "  n/a" : `${((100 * k) / n).toFixed(1)}%`);
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : "n/a");

interface Row {
  docId: string;
  turn: number;
  point: EvPerStepPoint;
}

function collectPoints(traces: readonly CastTrace[], set: readonly CastTrace[], mpm: number): {
  rows: Row[];
  turnsSeen: number;
  excludedNoMover: number;
} {
  const rows: Row[] = [];
  let turnsSeen = 0;
  let excludedNoMover = 0;
  for (const t of set) {
    const others = traces.filter((o) => o.docId !== t.docId);
    replayCast(t, others, {
      ...ERA_OPTS(),
      onTurn: (d: ReplayTurnDiagnostic) => {
        turnsSeen++;
        const point = evCandidatesAt(d, mpm);
        if (!point) {
          excludedNoMover++;
          return;
        }
        rows.push({ docId: t.docId, turn: d.turn, point });
      },
    });
  }
  return { rows, turnsSeen, excludedNoMover };
}

function describe(label: string, rows: readonly Row[], turnsSeen: number, excluded: number): void {
  const xs = rows.map((r) => r.point.deltaPerStep).sort((a, b) => a - b);
  const binds = xs.filter((x) => x < MOVEMENT_TAX_PER_STEP).length;
  console.log(`\n  ${label}`);
  console.log(
    `    turns replayed ${turnsSeen}   comparable ${xs.length}   excluded (no d>0 candidate) ${excluded} ${pct(excluded, turnsSeen)}`,
  );
  if (xs.length === 0) return;
  console.log(
    `    ΔEV/step   min ${f2(xs[0]!)}   p25 ${f2(q(xs, 0.25))}   median ${f2(q(xs, 0.5))}   p75 ${f2(q(xs, 0.75))}   max ${f2(xs[xs.length - 1]!)}   mean ${f2(mean(xs))}`,
  );
  console.log(
    `    TAX BINDS (< ${MOVEMENT_TAX_PER_STEP.toFixed(2)}): ${binds} of ${xs.length} = ${pct(binds, xs.length)}` +
      `   |   INERT (>= ${MOVEMENT_TAX_PER_STEP.toFixed(2)}): ${xs.length - binds} = ${pct(xs.length - binds, xs.length)}`,
  );

  // ── by manhattan distance, on the SAME turns ──────────────────────────
  //
  // `bestByD` holds the best ev at each exact distance, so this is a
  // within-turn comparison against the same stayer rather than a re-selection
  // of turns — the shape question ("is the ratio flat in d?") needs the paired
  // form or it answers a different one.
  console.log(`    by manhattan distance (best placement at EXACTLY d, same stayer):`);
  for (const d of [1, 2, 3]) {
    const at = rows
      .filter((r) => r.point.bestByD.has(d))
      .map((r) => (r.point.bestByD.get(d)! - r.point.stayEv) / d)
      .sort((a, b) => a - b);
    if (at.length === 0) {
      console.log(`      d=${d}   n 0`);
      continue;
    }
    const b = at.filter((x) => x < MOVEMENT_TAX_PER_STEP).length;
    console.log(
      `      d=${d}   n ${String(at.length).padStart(4)}   median ${f2(q(at, 0.5))}   p75 ${f2(q(at, 0.75))}   max ${f2(at[at.length - 1]!)}   binds ${String(b).padStart(4)} ${pct(b, at.length)}`,
    );
  }

  // Where the tax can reach at all. It is bounded by `remaining`, so a turn
  // with an empty meter pays nothing however small its ΔEV/step is.
  const byRemaining = new Map<number, number[]>();
  for (const r of rows) {
    const k = Math.min(r.point.remaining, 3);
    if (!byRemaining.has(k)) byRemaining.set(k, []);
    byRemaining.get(k)!.push(r.point.deltaPerStep);
  }
  console.log(`    by meter remaining entering the turn:`);
  for (const k of [...byRemaining.keys()].sort((a, b) => a - b)) {
    const at = byRemaining.get(k)!;
    const b = at.filter((x) => x < MOVEMENT_TAX_PER_STEP).length;
    console.log(`      remaining ${k}   n ${String(at.length).padStart(4)}   median ${f2(q([...at].sort((x, y) => x - y), 0.5))}   binds ${String(b).padStart(4)} ${pct(b, at.length)}`);
  }
}

function main(): void {
  const mpmArg = process.argv.find((a) => a.startsWith("--mpm="));
  const mpm = mpmArg ? Number(mpmArg.slice("--mpm=".length)) : 1;
  if (!Number.isFinite(mpm)) throw new Error(`--mpm must be a number, got ${mpmArg}`);

  const traces = loadCastTraces().filter(isCleanTrace);
  const era = eraCasts(traces);

  console.log(`\n▸ evPerStepDistribution.ts — QUESTIONS.md §27, session 98 §C`);
  console.log(`  The movement tax is w / FOCUS_METER_MAX = ${DEFAULT_FOCUS_RESERVE_WEIGHT} / ${FOCUS_METER_MAX} = ${MOVEMENT_TAX_PER_STEP.toFixed(2)} EV-units per manhattan step`);
  console.log(`  (session 95 §G — the reserve term's ENTIRE ranking effect). It can change the`);
  console.log(`  argmax exactly when ΔEV/step < ${MOVEMENT_TAX_PER_STEP.toFixed(2)}.`);
  console.log(`  Leave-one-cast-out replay over ${traces.length} clean casts. DIAGNOSIS ONLY —`);
  console.log(`  no weight is recommended from this and no default is touched.`);
  console.log(`  missPenaltyMultiplier ${mpm} (the live call site's value is 1).`);

  console.log(`\n── §1  THE DISTRIBUTION ──`);
  const all = collectPoints(traces, traces, mpm);
  describe(`whole clean corpus — ${traces.length} casts`, all.rows, all.turnsSeen, all.excludedNoMover);
  const eraOut = collectPoints(traces, era, mpm);
  describe(`today's era — ${era.length} casts`, eraOut.rows, eraOut.turnsSeen, eraOut.excludedNoMover);

  console.log(`\n── §2  HOW TO READ IT ──`);
  console.log(`  SHARP (most mass well above ${MOVEMENT_TAX_PER_STEP.toFixed(2)}) means the tax is mostly inert: the EV`);
  console.log(`  surface separates placements by more than a step is priced at, so the`);
  console.log(`  reserve weight rarely decides anything and its exact value matters little.`);
  console.log(`  FLAT (much mass below ${MOVEMENT_TAX_PER_STEP.toFixed(2)}) means the opposite — the tax is choosing`);
  console.log(`  placements on a large share of turns, and the weight is a live policy knob`);
  console.log(`  rather than a refinement.`);
  console.log(`\n  Note the EXCLUDED column before reading either. A turn with an empty meter`);
  console.log(`  has no d>0 candidate, pays no tax however flat its surface is, and is not`);
  console.log(`  part of this question. The tax is structurally a first-turns-only effect.`);
  console.log("");
}

main();
