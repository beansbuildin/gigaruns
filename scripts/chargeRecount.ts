/**
 * scripts/chargeRecount.ts — the actor-split charge recount (session-04 brief §2).
 *
 * `scripts/chargeTable.ts` asked whether anyone was ever *forced* to play a move
 * at <=0 charges, found zero, and recorded the question as unresolved. The brief
 * argues the interesting number is not the forced count but the plain zero: 23
 * opportunities to play a non-positive move, taken 0 times. Under a soft-cost
 * model with anything like uniform selection you would expect ~7-8.
 *
 * One confound has to be cleared first. The player rows are contaminated — the
 * user was following a written guide that avoided low-charge moves *by policy*.
 * Only the ENEMY's rows are clean evidence about the *rule*. So this script
 * splits every count by actor and runs the binomial only on the enemy's.
 *
 * Read-only. No network.
 *
 *   npx tsx scripts/chargeRecount.ts
 */

import { exchanges, loadCorpus } from "../src/sim/corpus.js";
import { MOVES, WEAPON, type MoveKey } from "../src/sim/types.js";

type Actor = "me" | "foe";

interface Play {
  run: string;
  label: string;
  actor: Actor;
  played: MoveKey;
  /** charges of each move BEFORE the exchange */
  before: Record<MoveKey, number>;
  after: Record<MoveKey, number>;
  max: Record<MoveKey, number>;
}

const corpus = loadCorpus();
const xs = exchanges(corpus);
const plays: Play[] = [];

for (const x of xs) {
  for (const [actor, idx] of [
    ["me", 0],
    ["foe", 1],
  ] as const) {
    const b = x.before.run.players[idx]!;
    const a = x.after.run.players[idx]!;
    const grab = (s: typeof b, f: "currentCharges" | "maxCharges") =>
      Object.fromEntries(MOVES.map((m) => [m, s[m][f]])) as Record<MoveKey, number>;
    plays.push({
      run: x.run,
      label: x.label,
      actor,
      played: actor === "me" ? x.myMove : x.foeMove,
      before: grab(b, "currentCharges"),
      after: grab(a, "currentCharges"),
      max: grab(b, "maxCharges"),
    });
  }
}

// ── Q1. delta distribution, split by actor ────────────────────────────────
console.log(`\n${"═".repeat(74)}`);
console.log(`CHARGE RECOUNT — ${xs.length} exchanges, ${plays.length} played moves`);
console.log("═".repeat(74));

console.log(`\nQ1a. delta of the PLAYED move, by actor and by charges-before\n`);
const deltaHist = new Map<string, number>();
for (const p of plays) {
  const d = p.after[p.played] - p.before[p.played];
  const k = `${p.actor}|before=${p.before[p.played]}|delta=${d}`;
  deltaHist.set(k, (deltaHist.get(k) ?? 0) + 1);
}
console.log(`  ${"actor".padEnd(7)}${"before".padEnd(8)}${"delta".padEnd(7)}count`);
for (const k of [...deltaHist.keys()].sort()) {
  const [actor, b, d] = k.split("|");
  const flag = d === "delta=-1" ? "" : "   <-- not -1";
  console.log(
    `  ${actor!.padEnd(7)}${b!.slice(7).padEnd(8)}${d!.slice(6).padEnd(7)}${deltaHist.get(k)}${flag}`,
  );
}

console.log(`\nQ1b. delta of UNPLAYED moves\n`);
let restAtMax = 0;
let restAtMaxHeld = 0;
let restBelow = 0;
let restBelowPlus1 = 0;
let overCap = 0;
const restOther: string[] = [];
for (const p of plays) {
  for (const m of MOVES) {
    if (m === p.played) continue;
    const d = p.after[m] - p.before[m];
    if (p.after[m] > p.max[m]) overCap++;
    if (p.before[m] >= p.max[m]) {
      restAtMax++;
      if (d === 0) restAtMaxHeld++;
      else restOther.push(`${p.run} ${p.label} ${p.actor} ${WEAPON[m]} at max, delta ${d}`);
    } else {
      restBelow++;
      if (d === 1) restBelowPlus1++;
      else restOther.push(`${p.run} ${p.label} ${p.actor} ${WEAPON[m]} below max, delta ${d}`);
    }
  }
}
console.log(`  already at max:  ${restAtMax}   (delta 0: ${restAtMaxHeld})`);
console.log(`  below max:       ${restBelow}   (delta +1: ${restBelowPlus1})`);
console.log(`  ever exceeded max: ${overCap}`);
for (const s of restOther) console.log(`    EXCEPTION ${s}`);

// ── Q2. the zero, split by actor ──────────────────────────────────────────
//
// An "opportunity" is a turn on which the actor held at least one move at <=0
// charges. The question is how often it took one.
console.log(`\n${"═".repeat(74)}`);
console.log(`Q2. opportunities to play a non-positive move, and how many were taken`);
console.log("═".repeat(74));

interface Tally {
  opportunities: number;
  taken: number;
  forced: number;
  /** sum over opportunities of (non-positive moves / total moves available) */
  expectedIfUniform: number;
  detail: string[];
}
const tally: Record<Actor, Tally> = {
  me: { opportunities: 0, taken: 0, forced: 0, expectedIfUniform: 0, detail: [] },
  foe: { opportunities: 0, taken: 0, forced: 0, expectedIfUniform: 0, detail: [] },
};

for (const p of plays) {
  const nonPositive = MOVES.filter((m) => p.before[m] <= 0);
  if (nonPositive.length === 0) continue;
  const t = tally[p.actor];
  t.opportunities++;
  t.expectedIfUniform += nonPositive.length / MOVES.length;
  if (p.before[p.played] <= 0) {
    t.taken++;
    t.detail.push(
      `${p.run} ${p.label} PLAYED ${WEAPON[p.played]} at ${p.before[p.played]}  <-- soft cost`,
    );
  } else if (nonPositive.length === MOVES.length - 1) {
    t.forced++;
    t.detail.push(
      `${p.run} ${p.label} played ${WEAPON[p.played]}@${p.before[p.played]} — FORCED (all others <=0)`,
    );
  }
}

/** P(X = 0) under independent per-turn selection probabilities. */
function pAllAvoided(perTurn: number[]): number {
  return perTurn.reduce((acc, p) => acc * (1 - p), 1);
}

const perTurn: Record<Actor, number[]> = { me: [], foe: [] };
for (const p of plays) {
  const nonPositive = MOVES.filter((m) => p.before[m] <= 0).length;
  if (nonPositive === 0) continue;
  perTurn[p.actor].push(nonPositive / MOVES.length);
}

for (const actor of ["me", "foe"] as const) {
  const t = tally[actor];
  const label = actor === "me" ? "PLAYER (contaminated — followed a guide)" : "ENEMY (clean)";
  console.log(`\n  ${label}`);
  console.log(`    opportunities (held a move at <=0):      ${t.opportunities}`);
  console.log(`    times a non-positive move was played:    ${t.taken}`);
  console.log(`    times the play was forced:               ${t.forced}`);
  console.log(`    expected plays if selection were uniform: ${t.expectedIfUniform.toFixed(2)}`);
  if (t.opportunities > 0 && t.taken === 0) {
    const p = pAllAvoided(perTurn[actor]);
    console.log(`    P(0 plays | soft cost + uniform selection): ${p.toExponential(2)}`);
  }
  for (const d of t.detail) console.log(`      ${d}`);
}

// ── verdict ───────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(74)}\nVERDICT`);
const foe = tally.foe;
if (foe.taken > 0) {
  console.log("  H2 (soft cost) CONFIRMED — the enemy played a move at <=0 charges.");
} else if (foe.opportunities >= 10) {
  console.log(`  H1 (hard prune) SUPPORTED — ${foe.opportunities} clean enemy opportunities,`);
  console.log(`  0 taken, p = ${pAllAvoided(perTurn.foe).toExponential(2)} under the soft-cost null.`);
  console.log("  Write §4a as a hard prune; default chargesAreHardLimit to true.");
} else {
  console.log(`  WEAK — only ${foe.opportunities} clean enemy opportunities (need >=10).`);
  console.log(`  p = ${foe.opportunities ? pAllAvoided(perTurn.foe).toExponential(2) : "n/a"}.`);
  console.log("  Keep the flag. The brief's asymmetry argument still favours defaulting");
  console.log("  to prune: wrongly pruning costs one option, wrongly permitting assigns");
  console.log("  probability to a move the enemy cannot make.");
}
console.log();
