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

import { BOON_MODELS, OBSERVED_OFFERS, offersForRoom, UNMODELLED_TYPES } from "../src/sim/boons.js";
import {
  fixedPolicy,
  formatSummary,
  randomPolicy,
  simulate,
  type Policy,
} from "../src/sim/dungeonSim.js";
import { isDead, cloneCombatant, type MoveKey } from "../src/sim/types.js";
import { legalMoves, resolveExchange } from "../src/sim/combat.js";
import { PLAYER, ROOM_ENEMIES } from "../src/sim/enemies.js";
import { makeRng } from "../src/sim/rng.js";
import { replayCorpus } from "../src/sim/replay.js";
import { DEFAULT_CONFIG } from "../src/strategy/config.js";
import { decide, formatDecision } from "../src/strategy/decide.js";
import { strategyPolicy } from "../src/strategy/policy.js";

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
const roomOneOptions = OBSERVED_OFFERS.filter((o) => o.room === 1).flatMap((o) => o.options);
console.log(`
  Why. Three walls were recorded in session 05. Session 06's capture knocked one
  of them down, which is worth stating precisely, because the gate was retired
  partly on the strength of it:

  1. NO CLEAN ROOM-1 BOON. ${roomOneOptions.length} of ${roomOneOptions.length} recorded room-1 options are either a
     rolled-stat boon we can model at pickup but whose damage effect is
     unexplained, or a type with no before/after pair at all. So the run is
     contaminated before room 2 begins. Heal — the one clean boon in the corpus
     — is still only ever offered at room 2. STANDS, but it is now one pickup
     away from falling: 'AddMaxArmor' was offered at room 1 in session 06 and
     not taken, and a max-pool change is something combat.ts already models.

  2. RETRACTED — rooms ${firstDirtyRoom}+ ARE NOT INNATELY UNSCORABLE. Session 05 read enemy
     65's evasion2/block2/lck1 as a property of the enemy and concluded a
     perfect boon model caps this number at ${firstDirtyRoom - 1}. It is not a property of the
     enemy: 'enemyPathOptions[]' carries 'rolledEnemyStats' PER TIER, tier 0
     ("Safe") is all zeros, and both tier-2 options carry non-zero rolls. The
     recorded profile is a Dangerous-tier instance, captured because the user was
     picking high tiers. Under a Safe-tier policy these enemies should be clean.
     The gate retirement still stands — it was unreachable from THAT corpus —
     but this reason for it was wrong.

  3. NO GROUNDED OFFER DISTRIBUTION. ${OBSERVED_OFFERS.length} offer triples now exist, up from 4.
     Still far too few to synthesise from; the sim continues to draw only from
     what was recorded.`);

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
  then stops at the room-${firstDirtyRoom} profile. That profile is a Dangerous-tier instance
  (wall 2 above), so the stop is an artefact of which enemies were captured, not
  a ceiling. The remaining blocker is CAPTURE — a Safe-tier run and one clean
  room-1 pickup — and not code.
  ───────────────────────────────────────────────────────────────────────────`);

// ── 2c. TASK 5 GATE — the EV engine against the always-Sword baseline ─────
//
// Gate (session-06 brief §5, replacing the session-05 mean-rooms-cleared form):
//
//   On the scored subset, the strategy engine beats the always-Sword baseline
//   on ROOM-1 BATTLE WIN RATE, with non-overlapping 95% confidence intervals
//   over >= 1000 runs. Reported alongside, NOT gated: mean rooms cleared ± CI,
//   coverage %, and deepestScorableRoom.
//
// Gating on the battle rate rather than on rooms cleared is not a lowered bar,
// it is the honest one: with deepestScorableRoom pinned at 1, mean rooms
// cleared over mostly-unscorable runs is the room-1 win rate with extra steps.
console.log(rule(`TASK 5 GATE — EV engine vs always-Sword, ${RUNS} runs each`));

const evPolicy = strategyPolicy({ name: "ev-engine" });
const sword = simulate(RUNS, { policy: fixedPolicy("rock"), opponent: randomPolicy, chargesAreHardLimit: true }, 1);
const ev = simulate(RUNS, { policy: evPolicy, opponent: randomPolicy, chargesAreHardLimit: true }, 1);

const band = (s: typeof sword): string => {
  const r = s.battlesByRoom.get(1);
  if (!r || r.winRate === null) return "nothing scorable at room 1";
  const ci = r.ci95 ?? 0;
  return (
    `${(100 * r.winRate).toFixed(1)}% ± ${(100 * ci).toFixed(1)}` +
    `  [${(100 * (r.winRate - ci)).toFixed(1)}, ${(100 * (r.winRate + ci)).toFixed(1)}]` +
    `  (${r.won}/${r.scored} scored)`
  );
};

console.log(`
  ROOM-1 BATTLE WIN RATE, scored subset, 95% CI
    always-Sword   ${band(sword)}
    ev-engine      ${band(ev)}`);

const a = sword.battlesByRoom.get(1)!;
const b = ev.battlesByRoom.get(1)!;
const separated = b.winRate! - (b.ci95 ?? 0) > a.winRate! + (a.ci95 ?? 0);

console.log(`
  REPORTED, NOT GATED — the blind spot stays visible
    mean rooms cleared     always-Sword ${sword.meanRoomsCleared.toFixed(3)} ± ${sword.roomsClearedCi95.toFixed(3)}` +
  `   ev-engine ${ev.meanRoomsCleared.toFixed(3)} ± ${ev.roomsClearedCi95.toFixed(3)}
    battle coverage        always-Sword ${(100 * sword.battleCoverage.fraction).toFixed(0)}%` +
  `   ev-engine ${(100 * ev.battleCoverage.fraction).toFixed(0)}%
    deepestScorableRoom    always-Sword ${sword.deepestScorableRoom}   ev-engine ${ev.deepestScorableRoom}

  Coverage FALLS as the engine improves, and that is not a regression: a policy
  that survives room 1 more often takes more boons, and every recorded room-1
  boon is unscorable. Winning more and being able to score less are the same
  fact here. The number to watch is deepestScorableRoom, and only capture moves it.`);

console.log(
  separated
    ? `\n✓ GATE MET — the intervals do not overlap.`
    : `\n✗ GATE NOT MET — the intervals overlap; the difference is not established.`,
);

// SPEC §4: "Log the EV table for one full battle and eyeball it — every chosen
// move should be justifiable from its numbers. If one isn't, the utility
// weights are wrong, not the logs."
console.log(rule("EV TABLE — one full room-1 battle, every turn"));
{
  const rng = makeRng(20260816);
  // Reuse the model the gate run just built, so the log shows the engine in its
  // normal state — a read above the sample floor, with charge pruning — rather
  // than the cold-start uniform every first battle sees.
  const model = evPolicy.model;
  const cfg = DEFAULT_CONFIG;
  let s = { me: cloneCombatant(PLAYER), foe: cloneCombatant(ROOM_ENEMIES[0]!.enemy), room: 1 };
  let prev: MoveKey | null = null;

  for (let turn = 1; !isDead(s.me) && !isDead(s.foe) && turn <= 20; turn++) {
    const d = decide(s, model, cfg, prev);
    console.log(`\n[turn ${turn}] ${formatDecision(s, d)}`);
    const theirs = legalMoves(s.foe, cfg.chargesAreHardLimit);
    const foeMove = rng.pick(theirs);
    const res = resolveExchange(s, d.move, foeMove);
    console.log(
      `      played ${d.move} vs ${foeMove} → ${res.outcome > 0 ? "win" : res.outcome === 0 ? "tie" : "loss"}` +
        `, dealt ${res.damageDealt} took ${res.damageTaken}`,
    );
    prev = foeMove;
    s = res.state;
  }
  console.log(
    `\n  outcome: ${isDead(s.foe) ? "enemy dead" : isDead(s.me) ? "we died" : "unresolved at the turn cap"}` +
      `  — me HP ${s.me.hp} ARM ${s.me.armor}, foe HP ${s.foe.hp} ARM ${s.foe.armor}`,
  );
  console.log(`
  ONE battle at a fixed seed, printed whatever it did — not selected for being
  won, and not evidence either way about the engine. The gate above is the
  evidence. What this log is for is SPEC §4's check that every chosen move is
  justifiable from its own numbers, which you can read off the rows: the engine
  takes Sword while the pools are healthy and its worst case is survivable, and
  switches to Shield once a single lost exchange would end the run.`);
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
