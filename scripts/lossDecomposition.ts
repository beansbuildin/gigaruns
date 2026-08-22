/**
 * scripts/lossDecomposition.ts — [session 48, brief §5c]
 *
 * The replay puts per-turn hit at 50.9% but catch at only 27.9%, and live
 * batch 1 put per-turn hit at 27.6% with 1 catch in 5. Either way there is a
 * gap between "shots land" and "fish caught", and the brief's question is
 * which constraint the gap sits behind.
 *
 * The brief's own decision table:
 *
 *   meter-outs dominate, focus hits 0 early   -> the focus budget, still
 *   meter-outs dominate, focus intact          -> the damage economy
 *   mana-outs dominate                         -> cast length / redraw policy
 *
 * This measures it on the REAL corpus rather than the replay, deliberately:
 * session 48's batch showed the replay's absolute rates are not trustworthy
 * (SPEC-fishing.md §9, "What gates a strategy change"). Terminal reasons and
 * focus profiles are observations, not model output, so the corpus answers
 * this directly and the replay adds nothing here.
 *
 *   npx tsx scripts/lossDecomposition.ts
 */

import { loadCastTraces, isCleanTrace, type CastTrace } from "../src/sim/fishing/castTrace.js";

type Reason = "caught" | "escaped (fish at full HP)" | "mana out" | "truncated / unresolved";

function terminalReason(t: CastTrace): Reason {
  const last = t.turns[t.turns.length - 1]!;
  if (t.caught) return "caught";
  if (last.fishHp >= last.fishMaxHp) return "escaped (fish at full HP)";
  if (last.mana <= 0) return "mana out";
  return "truncated / unresolved";
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function main() {
  const traces = loadCastTraces().filter(isCleanTrace);
  console.log(`\n▸ lossDecomposition.ts — ${traces.length} clean cast(s)\n`);

  const byReason = new Map<Reason, CastTrace[]>();
  for (const t of traces) {
    const r = terminalReason(t);
    byReason.set(r, [...(byReason.get(r) ?? []), t]);
  }

  console.log("── terminal reason ──");
  for (const [reason, ts] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const pct = ((ts.length / traces.length) * 100).toFixed(1);
    const lastFocus = mean(ts.map((t) => t.turns[t.turns.length - 1]!.focusMeter));
    const lastMana = mean(ts.map((t) => t.turns[t.turns.length - 1]!.mana));
    console.log(
      `  ${reason.padEnd(24)} ${String(ts.length).padStart(3)}/${traces.length}  (${pct.padStart(5)}%)` +
        `   mean final focusMeter ${lastFocus.toFixed(2)}   mean final mana ${lastMana.toFixed(2)}` +
        `   mean turns ${mean(ts.map((t) => t.turns.length - 1)).toFixed(1)}`,
    );
  }

  console.log("\n── focus-meter profile by turn (mean over casts still alive at that turn) ──");
  const maxTurn = Math.max(...traces.map((t) => t.turns.length));
  console.log(`  turn : ${Array.from({ length: Math.min(maxTurn, 11) }, (_, i) => String(i).padStart(5)).join("")}`);
  const focusRow: string[] = [];
  const manaRow: string[] = [];
  const aliveRow: string[] = [];
  for (let i = 0; i < Math.min(maxTurn, 11); i++) {
    const alive = traces.filter((t) => t.turns.length > i);
    focusRow.push(mean(alive.map((t) => t.turns[i]!.focusMeter)).toFixed(2).padStart(5));
    manaRow.push(mean(alive.map((t) => t.turns[i]!.mana)).toFixed(1).padStart(5));
    aliveRow.push(String(alive.length).padStart(5));
  }
  console.log(`  focus: ${focusRow.join("")}`);
  console.log(`  mana : ${manaRow.join("")}`);
  console.log(`  n    : ${aliveRow.join("")}`);

  console.log("\n── how often is the focus budget actually the binding thing? ──");
  let turnsAtZero = 0;
  let totalTurns = 0;
  let castsEverZero = 0;
  for (const t of traces) {
    let ever = false;
    for (const turn of t.turns) {
      totalTurns++;
      if (turn.focusMeter === 0) {
        turnsAtZero++;
        ever = true;
      }
    }
    if (ever) castsEverZero++;
  }
  console.log(`  turns spent at focusMeter 0: ${turnsAtZero}/${totalTurns} (${((turnsAtZero / totalTurns) * 100).toFixed(1)}%)`);
  console.log(`  casts that ever reached focusMeter 0: ${castsEverZero}/${traces.length}`);
  console.log("");
}

main();
