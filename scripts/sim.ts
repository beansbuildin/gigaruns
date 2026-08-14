/**
 * scripts/sim.ts — the Task 4 gate runner.
 *
 * 1. Replays every recorded exchange through the combat model (ground truth).
 * 2. Runs N synthetic runs against a random-move opponent.
 * 3. Reports win rate ONLY over the scored subset, with coverage beside it.
 *
 * Nothing here touches the network.
 *
 *   npx tsx scripts/sim.ts [runs=1000]
 */

import {
  fixedPolicy,
  formatSummary,
  randomPolicy,
  simulate,
  type Policy,
} from "../src/sim/dungeonSim.js";
import { replayCorpus } from "../src/sim/replay.js";

const RUNS = Number(process.argv[2] ?? 1000);
const rule = (s: string) => `\n${"═".repeat(74)}\n${s}\n${"═".repeat(74)}`;

// ── 1. ground truth ───────────────────────────────────────────────────────
console.log(rule("REPLAY — combat model vs every recorded exchange"));
const replay = replayCorpus();
console.log(`\nexchanges replayed: ${replay.checks.length}`);
console.log(`side-updates matched: ${replay.matched}/${replay.sideUpdates}`);
console.log(`mismatches inside the clean model: ${replay.cleanFailures.length}`);
console.log(`mismatches on unscorable exchanges: ${replay.unscorableFailures.length}`);
console.log(`\n${replay.coverage.format("exchanges")}`);

if (replay.unscorableFailures.length) {
  console.log(`\nevery mismatch, with the mechanic that explains it:`);
  for (const f of replay.unscorableFailures) {
    console.log(`  ${f.run} ${f.label}  ${f.myMove}/${f.foeMove}  [${f.reasons.join(", ")}]`);
    for (const s of f.sides.filter((s) => !s.ok)) {
      console.log(
        `      ${s.who}: predicted HP ${s.predictedHp} ARM ${s.predictedArmor}` +
          ` — actual HP ${s.actualHp} ARM ${s.actualArmor}`,
      );
    }
  }
}

if (replay.cleanFailures.length) {
  console.error(`\n✗ the model fails on ${replay.cleanFailures.length} CLEAN exchange(s).`);
  process.exit(1);
}

// ── 2. synthetic runs ─────────────────────────────────────────────────────
const policies: Policy[] = [randomPolicy, fixedPolicy("rock"), fixedPolicy("paper")];

for (const policy of policies) {
  console.log(rule(`SIM — ${RUNS} runs — ${policy.name} vs random`));
  const summary = simulate(
    RUNS,
    { policy, opponent: randomPolicy, chargesAreHardLimit: true },
    1,
  );
  console.log(`\n${formatSummary(summary, { policy: policy.name, opponent: "random" })}`);
}

// ── 3. the §1 threshold case, stated as a number ──────────────────────────
//
// CORRECTED. The brief's rule — effective damage = max(0, ATK - restore) on
// every exchange — is wrong: a loser regenerates nothing, so an outright win
// lands full ATK. The offset exists only on a TIE, and there it is exact.
//
// The true zero-progress case is a tie against a move whose DEF >= our ATK. If
// any of these resolves against the prediction, the armor model is wrong and
// that matters more than the gate.
console.log(rule("THRESHOLD CHECK — Shield mirrors against every observed enemy (brief §1, corrected)"));
// Each enemy's Shield, mirrored against ours (6/12), one room in isolation.
// `netDamageOnTie(6, foeShieldDEF)` predicts the outcome exactly: 0 means the
// battle can never end, anything positive means it resolves.
const mirrors = [
  { room: 1, enemy: "63", def: 2 },
  { room: 2, enemy: "64", def: 4 },
  { room: 3, enemy: "65", def: 6 },
  { room: 4, enemy: "66", def: 8 },
];

let thresholdHolds = true;
for (const { room, enemy, def } of mirrors) {
  const s = simulate(
    100,
    {
      policy: fixedPolicy("paper"),
      opponent: fixedPolicy("paper"),
      chargesAreHardLimit: false, // isolate the armor threshold from charge decay
      startRoom: room,
      maxRooms: room,
    },
    99,
  );
  // The claim is "cannot kill it", not "stalls". Zero net damage means the
  // battle never ends in a clear — but it can still end in OUR death when the
  // opponent's ATK outruns our own regen, as enemy 65's Shield (15 ATK vs our
  // 12 DEF) does. Both are no-clear; only the clear count tests the threshold.
  const net = Math.max(0, 6 - def);
  const canClear = net > 0;
  const cleared = s.outcomes.cleared;
  const ok = canClear ? cleared === 100 : cleared === 0;
  if (!ok) thresholdHolds = false;
  console.log(
    `\n  enemy ${enemy}  Shield DEF ${def}  net-on-tie ${net}` +
      `  → predicted ${canClear ? "clears" : "NEVER clears"}` +
      `, actual ${JSON.stringify(s.outcomes)}  ${ok ? "✓" : "✗"}`,
  );
}

console.log(
  thresholdHolds
    ? `\n✓ the threshold is exact: our Shield's 6 ATK stalls at DEF >= 6 and resolves below it.\n` +
        `  One point of DEF separates a winnable grind from an unwinnable one — which is\n` +
        `  precisely what a smooth utility term cannot express.`
    : `\n✗ the threshold does not hold. The armor model is wrong; investigate before` +
        ` trusting anything above.`,
);
console.log();
