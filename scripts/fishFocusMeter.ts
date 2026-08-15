/**
 * scripts/fishFocusMeter.ts — session 14 measurement, per TASKS.md Task 11 /
 * SPEC.md §5: re-run the 500-cast sim with `focusMeter` modelled (session-13
 * live confirmed it: 3-point non-regenerating budget, Manhattan-distance
 * cost — `src/sim/fishing/geometry.ts`'s `reachableCells`), and separately
 * with the matcher's search library disjoint from the true pattern (`
 * matcherPool: []`, forcing permanent `emptyFallback`/uniform belief) —
 * approximating what the 5 real live casts actually experienced, per
 * STATE.md session 13 ("the matcher ran on emptyFallback the whole
 * session since the real pattern library is still unknown").
 *
 * Read together, these answer the session-14 brief's question: does
 * `focusMeter` explain the sim's 92.4% vs. live's 0/6? See the printed
 * output and SPEC.md §5 / handoff/DECISIONS.md for the conclusion.
 */
import { simulateCasts, matcherFishPolicy, randomFishPolicy } from "../src/sim/fishing/castSim.js";

const N = 500;

function pZero(catchRate: number, casts: number): number {
  return Math.pow(1 - catchRate, casts);
}

const withFocus = simulateCasts(N, { policy: matcherFishPolicy });
const randomWithFocus = simulateCasts(N, { policy: randomFishPolicy });
const blind = simulateCasts(N, { policy: matcherFishPolicy, matcherPool: [] });

console.log(`matcher-ev, focusMeter modelled, library known:  ${withFocus.caught}/${N} = ${(withFocus.catchRate * 100).toFixed(1)}%  (P(0/6 live) ≈ ${(pZero(withFocus.catchRate, 6) * 100).toFixed(3)}%)`);
console.log(`random,     focusMeter modelled:                 ${randomWithFocus.caught}/${N} = ${(randomWithFocus.catchRate * 100).toFixed(1)}%  (P(0/6 live) ≈ ${(pZero(randomWithFocus.catchRate, 6) * 100).toFixed(1)}%)`);
console.log(`matcher-ev, focusMeter modelled, library BLIND:  ${blind.caught}/${N} = ${(blind.catchRate * 100).toFixed(1)}%  (P(0/6 live) ≈ ${(pZero(blind.catchRate, 6) * 100).toFixed(1)}%)`);
console.log();
console.log(`for reference, session 13's figure (no focusMeter, library known): 92.4% (P(0/6 live) ≈ ${(pZero(0.924, 6) * 100).toFixed(5)}%)`);

const N2 = 3000;
const withFocus2 = simulateCasts(N2, { policy: matcherFishPolicy }, 10000);
const blind2 = simulateCasts(N2, { policy: matcherFishPolicy, matcherPool: [] }, 10000);
console.log();
console.log(`[N=${N2}, independent seed] library known: ${withFocus2.caught}/${N2} = ${(withFocus2.catchRate * 100).toFixed(1)}%`);
console.log(`[N=${N2}, independent seed] library blind: ${blind2.caught}/${N2} = ${(blind2.catchRate * 100).toFixed(1)}%`);
