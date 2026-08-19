/**
 * scripts/fishingHeuristicAblation.ts — [session 44, brief §1]
 *
 * Two questions, both against the SAME real mined pattern library
 * (`data/minedFishPatterns.json`, whatever `mineFishPatterns.ts` currently
 * has promoted — see that script and SPEC.md §5 for today's real count),
 * so today's live batch (brief §2) has an honest number to be judged
 * against instead of the stale 6.6%→16.2% comparison from DECISIONS.md
 * 2026-08-17 (session 18), which predates both of today's real promoted
 * patterns.
 *
 *  1. Baseline: matcher BLIND vs. matcher seeded with the real mined
 *     library, at N=500 and N=3000 (two independent seeds).
 *  2. Heuristic ablation: session-43 heuristics (a) center-bias, (d)
 *     prune-return-to-previous, (f) coverage-max, all-on vs. all-off,
 *     against the SAME mined-seeded matcherPool, at N=2000 (two seeds).
 *     Heuristic (e) (`candidateCellCount`) is NOT included — per
 *     SPEC-fishing.md §8's own writeup, it was implemented as a geometric
 *     fact only and was never wired to any decision anywhere in this
 *     codebase (confirmed by grep before writing this script), so there is
 *     nothing to toggle for it.
 *
 * Per CLAUDE.md §9 / the standing "sim authority is earned per domain"
 * rule (DECISIONS.md 2026-08-15, session 14): this reports what the
 * ALGORITHM does in the sim's own synthetic domain, not a live catch-rate
 * promise about real Dendren — none of these four heuristics are
 * corpus-validated (SPEC-fishing.md §8). A null or even negative result
 * here is reported plainly, not discarded.
 *
 * Usage: npx tsx scripts/fishingHeuristicAblation.ts
 */

import { simulateCasts, makeMatcherFishPolicy, REDRAW_THRESHOLD } from "../src/sim/fishing/castSim.js";
import { loadMinedPatterns } from "./liveFishing.js";

const minedPool = loadMinedPatterns();
console.log(`\n▸ fishingHeuristicAblation.ts`);
console.log(`  mined library: ${minedPool.length} pattern(s) — ${minedPool.map((p) => p.name).join(", ") || "(none)"}\n`);

function report(label: string, N: number, seed: number, heuristicsEnabled: boolean, pruneReturnToPrevious: boolean) {
  const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, heuristicsEnabled);
  const result = simulateCasts(N, { policy, matcherPool: minedPool, pruneReturnToPrevious }, seed);
  console.log(
    `  ${label.padEnd(38)} N=${N} seed=${seed}  ${result.caught}/${N} = ${(result.catchRate * 100).toFixed(1)}%`,
  );
  return result;
}

// [session 44] `simulateCasts(runs, opts, seed)` internally draws seeds
// `seed + i` for `i` in `[0, runs)` — two seed BASES closer together than
// the larger N would silently overlap almost entirely (seed=1/seed=2 at
// N=3000 share 2999 of 3000 draws, confirmed the hard way: they returned
// byte-identical catch counts on the first version of this script). Using
// far-apart bases (1 and 50000) gives a genuinely independent second draw.
console.log("1. Baseline: BLIND vs. MINED library (today's real promoted set)\n");
for (const [N, seed] of [[500, 1], [3000, 1], [3000, 50000]] as const) {
  const blindPolicy = makeMatcherFishPolicy(REDRAW_THRESHOLD);
  const blind = simulateCasts(N, { policy: blindPolicy, matcherPool: [] }, seed);
  console.log(`  ${"matcher BLIND".padEnd(38)} N=${N} seed=${seed}  ${blind.caught}/${N} = ${(blind.catchRate * 100).toFixed(1)}%`);
  report("matcher w/ MINED library", N, seed, true, false);
  console.log();
}

console.log("2. Heuristic ablation (a)/(d)/(f), all-on vs. all-off, against the MINED library\n");
for (const [N, seed] of [[2000, 1], [2000, 50000], [20000, 1], [20000, 50000]] as const) {
  report("heuristics ALL-ON  (a,d,f)", N, seed, true, true);
  report("heuristics ALL-OFF (a,d,f)", N, seed, false, false);
  console.log();
}

console.log("2b. Breakdown — which of (a)/(f) [cardChoice.ts tie-breaks] vs. (d) [dist pruning] drives the delta above\n");
for (const [N, seed] of [[20000, 1], [20000, 50000]] as const) {
  report("(a,f) ON,  (d) OFF", N, seed, true, false);
  report("(a,f) OFF, (d) ON ", N, seed, false, true);
  report("(a,f) OFF, (d) OFF (= all-off)", N, seed, false, false);
  console.log();
}

console.log("Heuristic (e) candidateCellCount: not included above — confirmed unwired to any decision, geometric-fact-only per SPEC-fishing.md §8.\n");
