/**
 * scripts/potionTimingSweep.ts — Task 12 Stage B, sim half. Supersedes
 * `scripts/potionSweep.ts`'s all-committed-at-room-1 model (kept unchanged,
 * for the record — see its own header) with the real threshold-triggered
 * mechanism now in `dungeonSim.ts`'s `SimOptions.potions`: a potion fires
 * the instant own HP fraction drops to/below a threshold, not before.
 *
 * STILL AN UPPER BOUND, and still an explicit assumption about the one
 * thing this project cannot yet confirm from the sim alone: whether a live
 * `use_item` costs a turn. This sweep models it as free (see
 * `dungeonSim.ts`'s `PotionPlan` doc comment) — the timing question (WHEN
 * to fire, i.e. which threshold) is answered here; the cost question needs
 * a live run (Task 12 Stage B's live half).
 *
 * Usage: npx tsx scripts/potionTimingSweep.ts [runs=2000]
 */

import { simulate, randomPolicy } from "../src/sim/dungeonSim.js";
import { strategyPolicy } from "../src/strategy/policy.js";

const RUNS = Number(process.argv[2] ?? 2000);
const BIG_HEAL = 20; // flat, DECISIONS.md 2026-08-15 (session 11) — GET /offchain/static gameItems[131].itemEffect
const rule = (s: string) => `\n${"═".repeat(84)}\n${s}\n${"═".repeat(84)}`;

const policy = strategyPolicy({ name: "ev-engine" });

console.log(rule(`POTION TIMING SWEEP — ${RUNS} runs each, ev-engine policy, real PLAYER baseline`));
console.log(
  `\nHeal fires the instant own HP fraction drops to/below the threshold — not pre-loaded at\n` +
  `room 1 (that was scripts/potionSweep.ts's model; kept for the record, not the current best\n` +
  `answer). Still free (no exchange/charges cost) — UNCONFIRMED live, see the live half.\n`,
);

const baseline = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true }, 1);

interface Row {
  n: number;
  threshold: number;
  meanRoomsCleared: number;
  ci95: number;
  meanPotionsUsed: number;
  delta: number;
}

const THRESHOLDS = [0.2, 0.34, 0.5];
const rows: Row[] = [];
for (const threshold of THRESHOLDS) {
  for (let n = 1; n <= 3; n++) {
    const s = simulate(
      RUNS,
      {
        policy,
        opponent: randomPolicy,
        chargesAreHardLimit: true,
        potions: { heals: Array(n).fill(BIG_HEAL), threshold },
      },
      1,
    );
    rows.push({
      n,
      threshold,
      meanRoomsCleared: s.meanRoomsCleared,
      ci95: s.roomsClearedCi95,
      meanPotionsUsed: s.meanPotionsUsed,
      delta: s.meanRoomsCleared - baseline.meanRoomsCleared,
    });
  }
}

console.log(`0-potion baseline: mean rooms cleared ${baseline.meanRoomsCleared.toFixed(3)} ± ${baseline.roomsClearedCi95.toFixed(3)}`);
console.log(
  `\n${"threshold".padEnd(10)}${"potions".padEnd(9)}mean rooms cleared          delta          mean potions used/run`,
);
for (const r of rows) {
  console.log(
    `  ${String(r.threshold).padEnd(8)} ${String(r.n).padEnd(8)} ${r.meanRoomsCleared.toFixed(3)} ± ${r.ci95.toFixed(3)}` +
      `          ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)}          ${r.meanPotionsUsed.toFixed(3)}`,
  );
}

console.log(
  `\nStill an upper bound: heal application is modelled free (no turn/charges cost) because that half of\n` +
  `the mechanic is UNCONFIRMED live (TASKS.md Task 12 Stage B). The THRESHOLD choice is real, though —\n` +
  `every row here reflects a heal that only fires when actually needed, unlike the old preload model.`,
);
