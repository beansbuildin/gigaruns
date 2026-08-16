/**
 * scripts/potionSweep.ts — session-15 brief §addendum: benefit side of the
 * potion-commit trade. Committing N Big Heal Juice (flat +20 HP,
 * DECISIONS.md 2026-08-15 session 11) is modelled as extra starting HP —
 * the sim cannot yet time a mid-battle `use_item` call (Task 12 Stage B's
 * policy is still unbuilt), so this is a deliberate UPPER BOUND: perfectly-
 * timed heals that are always available exactly when needed, never wasted
 * on overheal. Real live performance will be at or below these numbers.
 * Reuses gearSweep.ts's `upgradeMaxHp` shape (same real PLAYER baseline,
 * same ev-engine policy) — same kind of question, same method.
 *
 * Usage: npx tsx scripts/potionSweep.ts [runs=2000]
 */

import { simulate, randomPolicy } from "../src/sim/dungeonSim.js";
import { PLAYER } from "../src/sim/enemies.js";
import { cloneCombatant, type Combatant } from "../src/sim/types.js";
import { strategyPolicy } from "../src/strategy/policy.js";

const RUNS = Number(process.argv[2] ?? 2000);
const BIG_HEAL = 20; // flat, DECISIONS.md 2026-08-15 (session 11) — GET /offchain/static gameItems[131].itemEffect
const rule = (s: string) => `\n${"═".repeat(78)}\n${s}\n${"═".repeat(78)}`;

const policy = strategyPolicy({ name: "ev-engine" });

function withExtraHp(n: number): Combatant {
  const p = cloneCombatant(PLAYER);
  const bonus = n * BIG_HEAL;
  p.hpMax += bonus;
  p.hp += bonus; // upper bound: available from turn 1, as if pre-healed — see header
  return p;
}

console.log(rule(`POTION COMMIT SWEEP — ${RUNS} runs each, ev-engine policy, upper bound (perfectly-timed heals)`));
console.log(
  `\nBaseline PLAYER (src/sim/enemies.ts): hp ${PLAYER.hp}/${PLAYER.hpMax}, armor ${PLAYER.armor}/${PLAYER.armorMax}`,
);

interface Row {
  n: number;
  meanRoomsCleared: number;
  ci95: number;
  scored: number;
  delta: number;
}

const rows: Row[] = [];
let baselineMean = 0;
for (let n = 0; n <= 3; n++) {
  const s = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true, player: withExtraHp(n) }, 1);
  if (n === 0) baselineMean = s.meanRoomsCleared;
  rows.push({
    n,
    meanRoomsCleared: s.meanRoomsCleared,
    ci95: s.roomsClearedCi95,
    scored: s.battleCoverage.scored,
    delta: s.meanRoomsCleared - baselineMean,
  });
}

console.log(`\n${"potions".padEnd(10)} mean rooms cleared          delta vs 0-potion baseline`);
for (const r of rows) {
  console.log(
    `  ${String(r.n).padEnd(8)} ${r.meanRoomsCleared.toFixed(3)} ± ${r.ci95.toFixed(3)}` +
      `          ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}`,
  );
}

console.log(
  `\nUPPER BOUND — the sim has no use_item timing model yet (Task 12 Stage B), so this` +
  `\nis "if every heal always landed exactly when it mattered," not a live prediction.` +
  `\nConfidence intervals printed beside every number; overlapping intervals are a tie.`,
);
