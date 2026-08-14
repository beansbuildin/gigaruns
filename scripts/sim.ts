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

import { BOON_MODELS, offersForRoom, UNMODELLED_TYPES } from "../src/sim/boons.js";
import {
  fixedPolicy,
  formatSummary,
  randomPolicy,
  simulate,
  type Policy,
} from "../src/sim/dungeonSim.js";
import { ROOM_ENEMIES } from "../src/sim/enemies.js";
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

// ── 2b. TASK 4.5 GATE — how deep can the sim score now boons are modelled ──
console.log(rule("TASK 4.5 — boon model, and the ceiling it runs into"));

const gate = simulate(RUNS, { policy: randomPolicy, opponent: randomPolicy, chargesAreHardLimit: true }, 1);

console.log(`
  boon types with a before/after pair in the corpus: ${Object.keys(BOON_MODELS).length}`);
for (const [type, m] of Object.entries(BOON_MODELS)) {
  const tag = m.contaminates.length ? `drags in ${m.contaminates.join("+")}` : "CLEAN";
  console.log(`    ${type.padEnd(15)} ${m.observed.padEnd(46)} ${tag}`);
}
console.log(`
  offered but never shown to do anything (no pair, not inferred from the name):
    ${UNMODELLED_TYPES.join(", ")}`);

console.log(`
  DEEPEST SCORABLE ROOM: ${gate.deepestScorableRoom}   (gate asked for >= 4)`);

// The ceiling is a property of the ENEMIES, not of the boon model. Compute it
// from the profiles rather than asserting it, so it updates itself when the
// corpus grows.
const firstDirtyRoom = ROOM_ENEMIES.find((p) => p.unmodelled.length > 0)?.room ?? Infinity;
console.log(`
  Why. Three independent walls, any one of which alone holds the number down:

  1. NO CLEAN ROOM-1 BOON. Both recorded room-1 offers are one rolled-stat boon
     we can model at pickup but whose effect on damage is unexplained, plus two
     types with no pair at all. 6 of 6 room-1 options are unscorable, so the run
     is contaminated before room 2 begins. Heal — the one clean boon in the
     corpus — is only ever offered at room 2, by which point it is too late.

  2. ROOMS ${firstDirtyRoom}+ ARE UNSCORABLE FOR REASONS BOONS HAVE NOTHING TO DO WITH.
     Enemy 65 carries evasion2/block2/lck1 innately; enemy 66 carries Burn and
     the run carries shatterblade. So a PERFECT boon model caps this number at
     ${firstDirtyRoom - 1}. The gate value of 4 was never reachable from this corpus — that
     is a fact about the enemies, and no amount of boon work changes it.

  3. NO GROUNDED OFFER DISTRIBUTION. Four offer triples exist (two at room 1,
     one each at rooms 2 and 3). Synthesising more would be inventing the single
     thing that decides how a run develops, off a sample of four.`);

// A counterfactual, kept strictly separate from every reported number. It
// answers an engineering question the walls above obscure: is the boon
// PLUMBING correct, and where exactly does the ceiling bite?
console.log(`
  ─── HYPOTHETICAL — NOT A RESULT ───────────────────────────────────────────
  The room-1 offer below did not happen. Substituting Heal (the one boon that
  is both modelled and clean) into room 1 isolates whether the boon machinery
  actually raises the number when a clean choice exists:`);

const hypothetical = simulate(
  RUNS,
  {
    policy: randomPolicy,
    opponent: randomPolicy,
    chargesAreHardLimit: true,
    offers: (room) =>
      room === 1
        ? [{ room: 1, source: "HYPOTHETICAL — not recorded", options: [{ type: "Heal", val1: 16, val2: 0 }] }]
        : offersForRoom(room),
  },
  1,
);
console.log(`
    deepest scorable room under the hypothetical: ${hypothetical.deepestScorableRoom}
    battles scored: ${hypothetical.battleCoverage.scored}/${hypothetical.battleCoverage.total}

  So the plumbing works — a clean room-1 boon does move the number, to ${hypothetical.deepestScorableRoom}, and
  then stops dead at wall 2. This is the strongest evidence that the remaining
  blocker is CAPTURE (rolled-stat semantics and a clean room-1 offer), not code.
  ───────────────────────────────────────────────────────────────────────────`);

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
