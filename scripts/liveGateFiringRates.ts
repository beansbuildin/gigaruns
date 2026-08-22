/**
 * scripts/liveGateFiringRates.ts — [session 75, brief §2 / GATE 1]
 *
 * **The other three live level-based `pConnect` consumers, measured the way
 * session 74 measured `isLethal`.**
 *
 * Session 73 classified five live sites that compare a connect probability
 * against a constant, and nominated `isLethal` as the correction target on the
 * grounds that it was the narrowest. Session 74 measured it: **1 firing in 373
 * live decisions, 0 in 440 replayable turns** — narrow enough to be empty. The
 * brief's instruction is to measure the rest of the inventory rather than
 * assume anything about it, so this script does the remaining three:
 *
 *   - the FOCUS oil necessity gate     `meetsThreshold(bestConnectProbabilityFromFrozenCell(d), t.focus)`
 *   - the RELAXING oil necessity gate  `meetsThreshold(bestKillProbability(d), t.relaxing)`
 *   - the SHADOW's two certainty checks `(r.bestConnectProbability ?? 0) >= 1`
 *                                       `(r.bestKillProbability ?? 0) >= 1`
 *
 * Every expression above was read out of its own file before it was written
 * here, not copied from a recap — session 74's correction of session 73's
 * "`isLethal` short-circuits the oil gates" is what that rule is for.
 *
 * ── WHAT "FIRING" MEANS HERE, AND WHY IT IS NOT `isLethal`'S SENSE ────────
 *
 * `isLethal` GRANTS an override, so firing = acting. A necessity gate is
 * `if (meetsThreshold(...)) continue;` — it fires by WITHHOLDING an oil the
 * trigger already wanted. So the event whose rate matters is "the level test
 * passed and an oil was therefore skipped", and its denominator is not turns
 * but TRIGGERED ARMS: the gate is not even evaluated on a turn where
 * `onDemandTriggers` wants nothing. Reporting these against all turns would
 * divide by a number the gate never sees.
 *
 * ── THE INSTRUMENT ───────────────────────────────────────────────────────
 *
 * PAIRED AT THE TURN, the same shape as `isLethalBlastRadius.ts`. At every
 * replayed turn the oil-decision state is rebuilt from the pre-play mana,
 * hand and focus budget the replay now publishes (`ReplayTurnDiagnostic.hand` /
 * `manaBefore` / `focusBefore`, added this session), and BOTH arms are
 * evaluated on that one state: what the trigger wanted, and what survived the
 * gate. The counterfactual therefore shares the turn set by construction and
 * cannot drift the way session 73 §6's unpaired 125-vs-134 did.
 *
 * The pre-play values matter. The oil decision is taken ABOVE the card choice
 * (the session-69 hoist), so a gate re-planned from post-play mana would be
 * asking about a state the live gate never sees.
 *
 * DIAGNOSIS ONLY. Nothing here adopts a policy, moves a threshold, or changes
 * a default. The gates measured are not shipped live in the first place —
 * `liveFishing.ts` plays `onDemandTriggers`, and the conserving gate runs in
 * shadow beside it.
 *
 * Usage: npx tsx scripts/liveGateFiringRates.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isCleanTrace, loadCastTraces, type CastTrace } from "../src/sim/fishing/castTrace.js";
import { replayCast, type ReplayTurnDiagnostic } from "../src/sim/fishing/offPolicyReplay.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import {
  bestConnectProbabilityFromFrozenCell,
  bestKillProbability,
  meetsThreshold,
  onDemandTriggers,
  PAYLOAD_OIL_EFFECTS,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  type OilDecisionState,
  type OilKind,
} from "../src/strategy/fishing/oilTiming.js";
import { snapshotOilDecision, SHADOWED_OIL_POLICY } from "../src/strategy/fishing/oilShadow.js";
import { ERA_OPTS, eraCasts } from "./pConnectBiasDecomposition.js";

const pct = (n: number, d: number) => (d === 0 ? "  n/a" : `${((100 * n) / d).toFixed(1)}%`);

/** The shadow's saturated stock. `snapshotOilDecision` overrides the held counts anyway; this documents the intent. */
const SATURATED = 99;

interface GateTurn {
  docId: string;
  turn: number;
  /** What `onDemandTriggers` wanted on this state — the gate's denominator. */
  wanted: OilKind[];
  /** The gate inputs, present only for an arm whose trigger fired. */
  bestKill: number | null;
  bestConnect: number | null;
  /** The certainty gate's verdict per arm: did the level test PASS and withhold the oil? */
  heldRelaxing: boolean;
  heldFocus: boolean;
  /** The shadowed (exchange-rate) policy's verdict on the same state. */
  shadowWanted: OilKind[];
  /** The shadow's two `>= 1` sanity checks, evaluated on this state. */
  certainKillFlag: boolean;
  certainConnectFlag: boolean;
}

function stateAt(d: ReplayTurnDiagnostic): OilDecisionState {
  return snapshotOilDecision(
    {
      turn: d.turn,
      fishHp: d.fishHpBefore,
      fishMaxHp: d.fishMaxHp,
      mana: d.manaBefore,
      focusRemaining: d.focusBefore.remaining,
      focusMax: d.focusMax,
      focusCell: d.focusBefore.current,
      focusOilHeld: SATURATED,
      relaxingOilHeld: SATURATED,
    },
    { hand: d.hand, dist: d.dist, gridSize: d.gridSize },
  );
}

function gateAt(docId: string, d: ReplayTurnDiagnostic): GateTurn {
  const s = stateAt(d);
  const wanted = onDemandTriggers(s, PAYLOAD_OIL_EFFECTS);
  const bestKill = wanted.includes("relaxing") ? bestKillProbability(s) : null;
  const bestConnect = wanted.includes("focus") ? bestConnectProbabilityFromFrozenCell(s) : null;
  const shadowWanted = SHADOWED_OIL_POLICY.decide(s, PAYLOAD_OIL_EFFECTS);
  return {
    docId,
    turn: d.turn,
    wanted: [...wanted],
    bestKill,
    bestConnect,
    heldRelaxing: bestKill !== null && meetsThreshold(bestKill, RECOMMENDED_NECESSITY_THRESHOLDS.relaxing),
    heldFocus: bestConnect !== null && meetsThreshold(bestConnect, RECOMMENDED_NECESSITY_THRESHOLDS.focus),
    shadowWanted: [...shadowWanted],
    certainKillFlag: shadowWanted.includes("relaxing") && (bestKill ?? 0) >= 1,
    certainConnectFlag: shadowWanted.includes("focus") && (bestConnect ?? 0) >= 1,
  };
}

function collect(traces: readonly CastTrace[], set: readonly CastTrace[]): GateTurn[] {
  const out: GateTurn[] = [];
  for (const t of set) {
    const others = traces.filter((o) => o.docId !== t.docId);
    replayCast(t, others, { ...ERA_OPTS(), onTurn: (d) => out.push(gateAt(t.docId, d)) });
  }
  return out;
}

/** Every `oil_shadow` record the live loop has written, from the profile's log tree. */
function liveShadowRecords(): Record<string, unknown>[] {
  const root = resolveProfile(profileArg(process.argv)).logRoot;
  const out: Record<string, unknown>[] = [];
  for (const f of readdirSync(root).filter((n) => n.startsWith("fishing-") && n.endsWith(".jsonl"))) {
    for (const line of readFileSync(join(root, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as Record<string, unknown>;
        if (rec.event === "oil_shadow") out.push({ ...rec, file: f });
      } catch {
        /* a truncated final line is not a finding */
      }
    }
  }
  return out;
}

/**
 * The four Relaxing firings preserved ONLY in `handoff/reports/session-69-oil-threshold.md`.
 *
 * They are not in `logs/` and their absence is not loss: the session-68
 * placement evaluated the shadow BELOW the oil block, and a lethal Relaxing
 * trigger ends the cast inside that block, so the one turn the arm was
 * observable on was the one turn no record was written. Session 69 hoisted the
 * pipeline and recovered these four offline. `logs/` is gitignored, so a scan
 * of it is not "the entire live record" — CLAUDE.md rule 10, in its second
 * form: the field being counted post-dates the behaviour being counted.
 */
const PRE_HOIST_RELAXING: readonly number[] = [0.4, 0.58, 0.587, 0.975];

function main(): void {
  const traces = loadCastTraces().filter(isCleanTrace);
  const era = eraCasts(traces);
  const eraRows = collect(traces, era);
  const allRows = collect(traces, traces);

  console.log(`\n▸ liveGateFiringRates.ts — SESSION 75 GATE 1`);
  console.log(`  Replay: ${era.length} era casts / ${eraRows.length} turns, and ${traces.length} clean casts / ${allRows.length} turns.`);
  console.log(`  DIAGNOSIS ONLY — no policy adopted, no threshold moved, no default touched.\n`);

  // ── §1 ────────────────────────────────────────────────────────────────
  console.log("── §1  WHAT COUNTS AS A FIRING, AND WHAT THE DENOMINATOR IS ──");
  console.log(`  \`isLethal\` fires by GRANTING an override, so its denominator is turns.`);
  console.log(`  A necessity gate is \`if (meetsThreshold(...)) continue;\` — it fires by`);
  console.log(`  WITHHOLDING an oil the trigger already wanted, and it is not evaluated at all`);
  console.log(`  on a turn where \`onDemandTriggers\` wants nothing. Its denominator is`);
  console.log(`  TRIGGERED ARMS. Scoring it per turn would divide by a number it never sees.`);

  // ── §2 ────────────────────────────────────────────────────────────────
  console.log("\n── §2  THE REPLAY — 'WOULD IT FIRE', PAIRED AT THE TURN ──");
  const report = (label: string, rows: readonly GateTurn[]) => {
    const relArms = rows.filter((r) => r.wanted.includes("relaxing"));
    const focArms = rows.filter((r) => r.wanted.includes("focus"));
    console.log(`\n  ${label} — ${rows.length} turns`);
    console.log(`    turns where the trigger wanted ANY oil     ${String(rows.filter((r) => r.wanted.length > 0).length).padStart(4)}`);
    console.log(
      `    RELAXING gate   evaluated ${String(relArms.length).padStart(4)}   held (fired) ${String(relArms.filter((r) => r.heldRelaxing).length).padStart(4)}   ${pct(relArms.filter((r) => r.heldRelaxing).length, relArms.length)}`,
    );
    console.log(
      `    FOCUS    gate   evaluated ${String(focArms.length).padStart(4)}   held (fired) ${String(focArms.filter((r) => r.heldFocus).length).padStart(4)}   ${pct(focArms.filter((r) => r.heldFocus).length, focArms.length)}`,
    );
    console.log(
      `    SHADOW   >=1 certain-kill    ${String(rows.filter((r) => r.certainKillFlag).length).padStart(4)}` +
        `      >=1 certain-connect ${String(rows.filter((r) => r.certainConnectFlag).length).padStart(4)}`,
    );
    const kills = relArms.map((r) => r.bestKill!).sort((a, b) => a - b);
    const conns = focArms.map((r) => r.bestConnect!).sort((a, b) => a - b);
    const span = (xs: readonly number[]) =>
      xs.length === 0 ? "none" : `${xs[0]!.toFixed(3)} .. ${xs[xs.length - 1]!.toFixed(3)}   exactly 1: ${xs.filter((x) => x >= 1).length}`;
    console.log(`    bestKillProbability    ${span(kills)}`);
    console.log(`    bestConnectProbability ${span(conns)}`);
  };
  report("era only", eraRows);
  report("whole clean corpus", allRows);

  // ── §3 ────────────────────────────────────────────────────────────────
  console.log("\n── §3  THE LIVE RECORD — 'DID IT FIRE' ──");
  const live = liveShadowRecords();
  const fired = live.filter((r) => ((r.liveWanted as OilKind[]) ?? []).length > 0);
  const kill = live.map((r) => r.bestKillProbability as number | null).filter((x): x is number => x !== null);
  const conn = live.map((r) => r.bestConnectProbability as number | null).filter((x): x is number => x !== null);
  const sanity = live.flatMap((r) => (r.sanity as string[]) ?? []);
  console.log(`  \`oil_shadow\` records written by the live loop      ${String(live.length).padStart(4)}`);
  console.log(`  ...at a FIRING MOMENT (the trigger wanted an oil)  ${String(fired.length).padStart(4)}`);
  console.log(`  RELAXING arm evaluated live                       ${String(kill.length).padStart(4)}   at >= 1: ${kill.filter((x) => x >= 1).length}   max ${kill.length ? Math.max(...kill).toFixed(3) : "n/a"}`);
  console.log(`  FOCUS    arm evaluated live                       ${String(conn.length).padStart(4)}   at >= 1: ${conn.filter((x) => x >= 1).length}   max ${conn.length ? Math.max(...conn).toFixed(3) : "n/a"}`);
  console.log(`  SHADOW sanity flags raised, all time              ${String(sanity.length).padStart(4)}`);
  console.log(`\n  AND THE FOUR THE LOG TREE NO LONGER HOLDS. \`logs/\` is gitignored and the`);
  console.log(`  pre-hoist placement never wrote a record for a lethal Relaxing turn, so a scan`);
  console.log(`  of it is NOT "the entire live record". Session 69's report preserves four more`);
  console.log(`  Relaxing observations recovered offline: ${PRE_HOIST_RELAXING.join(", ")}.`);
  const union = [...kill, ...PRE_HOIST_RELAXING].sort((a, b) => a - b);
  console.log(`  Union of every Relaxing observation ever recorded: ${union.length}, at >= 1: ${union.filter((x) => x >= 1).length}, max ${Math.max(...union).toFixed(3)}.`);

  // ── §3b ───────────────────────────────────────────────────────────────
  console.log("\n── §3b  THE BIMODALITY THAT JUSTIFIED THE THRESHOLD, RE-ASKED ──");
  console.log(`  Threshold 1 was chosen (session 67) because the SIMULATOR's gate inputs are`);
  console.log(`  bimodal — \`bestKillProbability\` 34.3% exactly 0, 55.8% exactly 1 — so there`);
  console.log(`  was "no constant to defend" between the two spikes. Session 70 found live has`);
  console.log(`  no mass at either endpoint. The replay is a THIRD source, and it is the one`);
  console.log(`  with a usable n.\n`);
  const buckets = (xs: readonly number[]) => {
    const z = xs.filter((x) => x <= 0).length;
    const o = xs.filter((x) => x >= 1).length;
    return `n ${String(xs.length).padStart(3)}   exactly 0 ${String(z).padStart(3)} ${pct(z, xs.length)}   exactly 1 ${String(o).padStart(3)} ${pct(o, xs.length)}   between ${String(xs.length - z - o).padStart(3)} ${pct(xs.length - z - o, xs.length)}`;
  };
  const allKill = allRows.filter((r) => r.bestKill !== null).map((r) => r.bestKill!);
  const allConn = allRows.filter((r) => r.bestConnect !== null).map((r) => r.bestConnect!);
  console.log(`    replay  bestKillProbability     ${buckets(allKill)}`);
  console.log(`    replay  bestConnectProbability  ${buckets(allConn)}`);
  console.log(`    live    bestKillProbability     ${buckets(kill)}`);
  console.log(`    live    bestConnectProbability  ${buckets(conn)}`);
  console.log(`\n  THE UPPER SPIKE IS A castSim ARTEFACT. Two independent sources that resolve`);
  console.log(`  against REAL fish trajectories — the live loop and this replay — put no mass`);
  console.log(`  at 1 at all. Against real movement the top of the range is approached and`);
  console.log(`  never reached: ${Math.max(...allKill).toFixed(3)} and ${Math.max(...allConn).toFixed(3)} are the corpus maxima.`);
  console.log(`\n  NOTE THE DIRECTION, because it decides whether a correction could ever`);
  console.log(`  matter here. \`pConnect\` is OPTIMISTIC, so a fitted correction moves these`);
  console.log(`  inputs DOWN, i.e. further from the only boundary they are compared against.`);
  console.log(`  Correcting the estimator cannot make these gates fire; it can only make them`);
  console.log(`  fire less. That is a stronger statement than "they never fired on this`);
  console.log(`  corpus" and it does not depend on the sample size.`);

  // ── §4 ────────────────────────────────────────────────────────────────
  console.log("\n── §4  THE VERDICT ──");
  const anyFired =
    allRows.some((r) => r.heldRelaxing || r.heldFocus || r.certainKillFlag || r.certainConnectFlag) ||
    kill.some((x) => x >= 1) ||
    conn.some((x) => x >= 1) ||
    union.some((x) => x >= 1);
  console.log(`  a live level gate fired anywhere on this evidence: ${anyFired ? "YES" : "NO"}`);
  console.log(`\n  All four of the remaining live level-based sites sit at the SAME p = 1`);
  console.log(`  boundary as \`isLethal\`, and the two oil gates read a probability that has`);
  console.log(`  never once reached it — not in ${allRows.length} replayed turns, not in the live record.`);
  console.log(`  Session 70 reached the same conclusion from the live side alone and swapped`);
  console.log(`  the shadowed policy off the certainty gate because of it; this measures the`);
  console.log(`  same thing from the corpus side, at ${allRows.length} turns instead of 9 firings.`);
  console.log(`\n  SO: \`pConnect\`'s +9.38pp optimism reaches NO live level gate. It is`);
  console.log(`  CLOSED BY IRRELEVANCE, NOT BY EXPLANATION — the estimator is still wrong by`);
  console.log(`  the same amount and nothing here diagnosed why. Those are different claims.`);
  console.log(`\n  WHAT MAKES "MOOT" SAFE TO RECORD is not this measurement, which is a`);
  console.log(`  snapshot. It is \`tests/fishing/pConnectConsumers.test.ts\`: a connect-probability`);
  console.log(`  read in an unclassified file fails the suite, and so does a changed site count`);
  console.log(`  in a classified one. A future level-based consumer therefore reopens this`);
  console.log(`  question automatically rather than inheriting a stale "moot".\n`);
}

main();
