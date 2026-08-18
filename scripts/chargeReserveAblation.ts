/**
 * scripts/chargeReserveAblation.ts — CODEXIMPROVE #4 stage 3.
 *
 * Stage 1-2 (decide.ts's tie-break) shipped already, provably non-regressive
 * because it only resolves cases already tied on the primary score. This
 * script asks the separate, riskier question stage 3 raises: does adding a
 * small ATK-weighted charge-reserve term to utility() ITSELF — not just a
 * tie-break — change what `decide()` picks on non-tied states, and if so,
 * does it help?
 *
 * Same discipline as `depthAblation.ts`, which is what got depth 3 adopted
 * for live play: report mean rooms cleared ± 95% CI (the brief's stated
 * target metric, CLAUDE.md §6/§9) for several `chargeReserveWeight` values
 * against the `chargeReserveWeight: 0` control, and only call a candidate a
 * win if its CI does not overlap the control's AND sits above it.
 *
 * [session 34 RESULT] At N=20000/weight, two seeds (1, 9001): 0.2/0.4/0.8 all
 * separate above the 0 control — unlike the session-06 HP/armor weight
 * sweep's documented null result, this axis is real. A follow-up sweep (not
 * reproduced by this coarse WEIGHTS list — re-run with a finer step to see
 * it) found an inverted-U: 0.8 drops back toward 0.3's level in both seeds,
 * and 0.4/0.5/0.6 form a plateau, mutually indistinguishable but each
 * separated above 0.2/0.3/0.8. `chargeReserveWeight` now ships at 0.4 in
 * `DEFAULT_CONFIG` (config.ts) — the plateau's low-risk edge.
 *
 * Nothing here touches the network.
 *
 *   npx tsx scripts/chargeReserveAblation.ts [runsPerWeight=20000] [seed=1]
 */

import { simulate, randomPolicy } from "../src/sim/dungeonSim.js";
import { strategyPolicy } from "../src/strategy/policy.js";

const RUNS = Number(process.argv[2] ?? 20000);
const SEED = Number(process.argv[3] ?? 1);
const WEIGHTS = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8];

console.log(`\n${RUNS} runs per weight, mean rooms cleared, seed ${SEED}\n`);

interface Row {
  weight: number;
  mean: number;
  ci95: number;
  scoredBattleWinRate: number | null;
  ms: number;
}

const rows: Row[] = [];

for (const weight of WEIGHTS) {
  const policy = strategyPolicy({ config: { chargeReserveWeight: weight }, name: `charge${weight}` });
  const t0 = Date.now();
  const s = simulate(RUNS, { policy, opponent: randomPolicy, chargesAreHardLimit: true }, SEED);
  const ms = Date.now() - t0;
  rows.push({ weight, mean: s.meanRoomsCleared, ci95: s.roomsClearedCi95, scoredBattleWinRate: s.scoredBattleWinRate, ms });
  console.log(
    `weight ${weight.toFixed(2).padStart(4)}  rooms ${s.meanRoomsCleared.toFixed(4)} ± ${s.roomsClearedCi95.toFixed(4)}` +
      `  [${(s.meanRoomsCleared - s.roomsClearedCi95).toFixed(4)}, ${(s.meanRoomsCleared + s.roomsClearedCi95).toFixed(4)}]` +
      `  battleWinRate ${s.scoredBattleWinRate === null ? "n/a" : (100 * s.scoredBattleWinRate).toFixed(2) + "%"}` +
      `  ${ms}ms`,
  );
}

const control = rows[0]!;
console.log(`\nSeparation from control (weight 0), non-overlapping 95% CI:`);
for (const r of rows.slice(1)) {
  const controlHi = control.mean + control.ci95;
  const controlLo = control.mean - control.ci95;
  const rLo = r.mean - r.ci95;
  const rHi = r.mean + r.ci95;
  const separatedAbove = rLo > controlHi;
  const separatedBelow = rHi < controlLo;
  const verdict = separatedAbove ? "IMPROVEMENT (separated above control)" : separatedBelow ? "REGRESSION (separated below control)" : "overlap — not established";
  console.log(`  weight ${r.weight.toFixed(2)} vs control: ${verdict}  (gap ${(r.mean - control.mean).toFixed(4)})`);
}

const cleared = rows.slice(1).filter((r) => r.mean - r.ci95 > control.mean + control.ci95);
const best: Row | undefined = cleared.length === 0 ? undefined : cleared.reduce((a, b) => (b.mean > a.mean ? b : a));
console.log(
  best
    ? `\nVERDICT: weight ${best.weight} has the highest mean among candidates separated above the zero` +
        ` control. Check whether its neighbors are also separated from IT (not just from control) before` +
        ` picking a single number — session 34 found a plateau, not a single peak, at this WEIGHTS spacing.`
    : `\nVERDICT: no candidate weight separates from the zero control. Same shape as the session-06 HP/armor` +
        ` weight sweep's null result — keep chargeReserveWeight at 0, report this honestly, do not ship a` +
        ` weight that only looks better inside noise.`,
);
