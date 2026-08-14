/**
 * scripts/depthAblation.ts — session-06 brief §8 / next.md §8.
 *
 * The Task 5 gate measured depth 1/2/3 at 1000 runs and found depth 3 ~2pp
 * better than depth 2 (84.2% vs 82.0%) but with OVERLAPPING confidence
 * intervals — the difference wasn't established, so depth stayed at 2.
 *
 * The reason given for not adopting depth 3 anyway ("costs 7x the time") does
 * not apply live: the bot has a 1200ms rate-limit floor between actions, and
 * seven times a few milliseconds of local search is still free. So the only
 * real question is whether the gap is real. Re-run at enough N to separate
 * the CIs, or establish that they can't be separated at a sample size this
 * sim can produce in a reasonable time.
 *
 * Nothing here touches the network.
 *
 *   npx tsx scripts/depthAblation.ts [runsPerDepth=20000]
 */

import { simulate, randomPolicy } from "../src/sim/dungeonSim.js";
import { strategyPolicy } from "../src/strategy/policy.js";

const RUNS = Number(process.argv[2] ?? 20000);
const DEPTHS = [1, 2, 3, 4];

console.log(`\n${RUNS} runs per depth, room-1 battle win rate on the scored subset, seed 1\n`);

interface Row {
  depth: number;
  winRate: number;
  ci95: number;
  scored: number;
  ms: number;
}

const rows: Row[] = [];

for (const depth of DEPTHS) {
  const policy = strategyPolicy({ config: { depth }, name: `depth${depth}` });
  const t0 = Date.now();
  const s = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true }, 1);
  const ms = Date.now() - t0;
  const r = s.battlesByRoom.get(1)!;
  rows.push({ depth, winRate: r.winRate ?? 0, ci95: r.ci95 ?? 0, scored: r.scored, ms });
  console.log(
    `depth ${depth}  ${(100 * (r.winRate ?? 0)).toFixed(2)}% ± ${(100 * (r.ci95 ?? 0)).toFixed(2)}` +
      `  [${(100 * ((r.winRate ?? 0) - (r.ci95 ?? 0))).toFixed(2)}, ${(100 * ((r.winRate ?? 0) + (r.ci95 ?? 0))).toFixed(2)}]` +
      `  (${r.won}/${r.scored} scored)  ${ms}ms`,
  );
}

console.log(`\nPairwise separation (non-overlapping 95% CI):`);
for (let i = 0; i < rows.length - 1; i++) {
  const a = rows[i]!;
  const b = rows[i + 1]!;
  const aHi = a.winRate + a.ci95;
  const bLo = b.winRate - b.ci95;
  const bHi = b.winRate + b.ci95;
  const aLo = a.winRate - a.ci95;
  const separated = bLo > aHi || aLo > bHi;
  console.log(
    `  depth ${a.depth} vs depth ${b.depth}: ` +
      `${separated ? "SEPARATED" : "overlap — not established"}` +
      `  (gap ${(100 * (b.winRate - a.winRate)).toFixed(2)}pp)`,
  );
}

console.log(`\nTime per decision scales with depth as expected (9^depth leaves):`);
for (const r of rows) console.log(`  depth ${r.depth}: ${r.ms}ms total for ${RUNS} runs`);
console.log(
  `\nLive-play framing: at the 1200ms rate-limit floor, one decision's search time is\n` +
    `irrelevant up to several hundred ms — compare the per-run ms above against\n` +
    `${RUNS} decisions worth of budget to judge whether any depth here is actually free.`,
);
