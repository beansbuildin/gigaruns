/**
 * scripts/gearSweep.ts — session-12 brief §5: which single-stat gear
 * upgrade is worth the most, offline, at zero energy cost.
 *
 * Motivation from the corpus: session 11's Sword ATK 16→20 moved mean rooms
 * cleared from 1.632 to 2.103 (always-Sword baseline) — bigger than every
 * strategy-weight intervention tried across sessions 10-11 combined. This
 * sweep answers "which of the other plausible upgrades is worth that much,
 * or more" using the real PLAYER baseline (`src/sim/enemies.ts`) and the
 * live-confirmed EV-engine policy, so the ranking reflects the game as
 * currently played, not a hypothetical strategy change.
 *
 * Every upgrade below is a single stat, +4 (matching the one real gear
 * delta observed this project — Sword ATK 16→20, session 11) — a
 * consistent unit for ranking, not a claim about what's actually purchasable.
 *
 * Usage: npx tsx scripts/gearSweep.ts [runs=1000]
 */

import { simulate } from "../src/sim/dungeonSim.js";
import { PLAYER } from "../src/sim/enemies.js";
import { randomPolicy } from "../src/sim/dungeonSim.js";
import { cloneCombatant, type Combatant, type MoveKey } from "../src/sim/types.js";
import { strategyPolicy } from "../src/strategy/policy.js";

const RUNS = Number(process.argv[2] ?? 1000);
const DELTA = 4;
const rule = (s: string) => `\n${"═".repeat(74)}\n${s}\n${"═".repeat(74)}`;

const policy = strategyPolicy({ name: "ev-engine" });

function upgradeMove(move: MoveKey, stat: "atk" | "def", delta: number): Combatant {
  const p = cloneCombatant(PLAYER);
  p.moves[move] = { ...p.moves[move], [stat]: p.moves[move][stat] + delta };
  return p;
}

function upgradeMaxHp(delta: number): Combatant {
  const p = cloneCombatant(PLAYER);
  p.hpMax += delta;
  p.hp += delta; // a real gear upgrade would be equipped before the run starts, at full pools
  return p;
}

function upgradeMaxArmor(delta: number): Combatant {
  const p = cloneCombatant(PLAYER);
  p.armorMax += delta;
  p.armor += delta;
  return p;
}

interface Candidate {
  label: string;
  player: Combatant;
}

const candidates: Candidate[] = [
  { label: `rock (Sword) ATK +${DELTA}`, player: upgradeMove("rock", "atk", DELTA) },
  { label: `rock (Sword) DEF +${DELTA}`, player: upgradeMove("rock", "def", DELTA) },
  { label: `paper (Shield) ATK +${DELTA}`, player: upgradeMove("paper", "atk", DELTA) },
  { label: `paper (Shield) DEF +${DELTA}`, player: upgradeMove("paper", "def", DELTA) },
  { label: `scissor (Spell) ATK +${DELTA}`, player: upgradeMove("scissor", "atk", DELTA) },
  { label: `scissor (Spell) DEF +${DELTA}`, player: upgradeMove("scissor", "def", DELTA) },
  { label: `max HP +${DELTA}`, player: upgradeMaxHp(DELTA) },
  { label: `max armor +${DELTA}`, player: upgradeMaxArmor(DELTA) },
];

console.log(rule(`GEAR SWEEP — ${RUNS} runs each, ev-engine policy, +${DELTA} single-stat upgrades`));
console.log(
  `\nBaseline PLAYER (src/sim/enemies.ts): hp ${PLAYER.hp}/${PLAYER.hpMax}, armor ${PLAYER.armor}/${PLAYER.armorMax},` +
    ` rock ${PLAYER.moves.rock.atk}/${PLAYER.moves.rock.def}, paper ${PLAYER.moves.paper.atk}/${PLAYER.moves.paper.def},` +
    ` scissor ${PLAYER.moves.scissor.atk}/${PLAYER.moves.scissor.def}`,
);

const baseline = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true }, 1);
console.log(
  `\nbaseline mean rooms cleared: ${baseline.meanRoomsCleared.toFixed(3)} ± ${baseline.roomsClearedCi95.toFixed(3)}` +
    ` (battle coverage ${(100 * baseline.battleCoverage.fraction).toFixed(0)}%)`,
);

interface Result {
  label: string;
  meanRoomsCleared: number;
  ci95: number;
  delta: number;
}

const results: Result[] = candidates.map(({ label, player }) => {
  const s = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true, player }, 1);
  return {
    label,
    meanRoomsCleared: s.meanRoomsCleared,
    ci95: s.roomsClearedCi95,
    delta: s.meanRoomsCleared - baseline.meanRoomsCleared,
  };
});

results.sort((a, b) => b.delta - a.delta);

console.log(`\nRANKED BY MEAN ROOMS CLEARED, DESCENDING (${RUNS} runs each, ev-engine policy)`);
console.log(`  ${"upgrade".padEnd(28)} mean rooms cleared        delta vs baseline`);
for (const r of results) {
  console.log(
    `  ${r.label.padEnd(28)} ${r.meanRoomsCleared.toFixed(3)} ± ${r.ci95.toFixed(3)}` +
      `        ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}`,
  );
}

console.log(
  `\nThis is a REPORTED metric for the user's own progression decisions (session-12 brief §5), not a` +
    `\ngate — no threshold to pass or fail. Confidence intervals are printed beside every number;` +
    `\ntreat rankings whose intervals overlap as a tie, not a real ordering.`,
);
