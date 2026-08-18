/**
 * scripts/fishingContextualAblation.ts — [session 33, CODEXIMPROVE #3]
 * simulator catch-rate ablation for the previous-direction contextual
 * fallback, run AFTER `scripts/fishingContextualCV.ts`'s offline held-out
 * evaluation looked good against the real corpus — this project's own
 * standing rule (CLAUDE.md, restated in both Codex docs) is not to treat
 * simulator output as live evidence until it's calibrated in the same
 * domain (DECISIONS.md 2026-08-15, session 14: "sim authority is earned PER
 * DOMAIN... never inherited from another domain's sim").
 *
 * What this DOES answer: when the matcher is blind (`matcherPool: []` —
 * session 14's own stand-in for "matcher never identifies the real
 * pattern," which is what happened on every one of this project's real live
 * casts to date) and the true fish movement genuinely has previous-
 * direction structure (drawn from `buildPatternPool()`, the same
 * distribution a synthetic "mined corpus" is built from here), does the
 * hierarchical backoff algorithm correctly exploit that structure when it's
 * present, without hurting the blind baseline when it isn't gated properly.
 *
 * What this does NOT answer: whether real Dendren fish actually have
 * previous-direction structure, or what the real catch-rate lift would be —
 * that question is closed until a live corpus is large enough to answer it
 * directly (the offline CV script is the honest current best answer, and
 * it's explicit about being an accuracy/log-loss table, not a catch rate).
 * Frame this script's numbers as "does this look like a real improvement in
 * the model that already exists," never as a live catch-rate promise.
 *
 * Usage: npx tsx scripts/fishingContextualAblation.ts
 */

import type { Cell } from "../src/sim/fishing/geometry.js";
import { buildPatternPool } from "../src/sim/fishing/patterns.js";
import { simulateCasts, makeMatcherFishPolicy, REDRAW_THRESHOLD } from "../src/sim/fishing/castSim.js";
import { makeRng } from "../src/sim/rng.js";
import type { Cast } from "../src/sim/fishing/transitionCorpus.js";
import { buildCellOnlyMap, buildContextualMap, DEFAULT_MIN_INDEPENDENT_CASTS } from "../src/strategy/fishing/contextualFallback.js";

const GRID_SIZE = 4;
const TRAINING_CASTS = 3000;
const TRAINING_MIN_TURNS = 3;
const TRAINING_MAX_TURNS = 12;
const N = 2000;

/** Builds a synthetic "mined transition corpus" the same statistical shape as `data/fish-patterns.jsonl` — drawn from the sim's own true pattern pool, so any lift measured here is about the ALGORITHM, not a claim about real Dendren (see this file's header). */
function buildSyntheticTrainingCasts(seed: number): Cast[] {
  const rng = makeRng(seed);
  const pool = buildPatternPool();
  const casts: Cast[] = [];
  for (let i = 0; i < TRAINING_CASTS; i++) {
    const start: Cell = { x: rng.int(GRID_SIZE) + 1, y: rng.int(GRID_SIZE) + 1 };
    const pattern = pool[rng.int(pool.length)]!;
    const turns = TRAINING_MIN_TURNS + rng.int(TRAINING_MAX_TURNS - TRAINING_MIN_TURNS + 1);
    const trajectory = pattern.path(start, GRID_SIZE, turns + 1);
    const byTurn = new Map<number, Cell>();
    for (let t = 0; t < turns; t++) byTurn.set(t, trajectory[t + 1]!);
    casts.push({
      castId: `synthetic-${i}`,
      gridSize: GRID_SIZE,
      start,
      byTurn,
      maxTurn: turns - 1,
      duplicateTurns: [],
      hasGaps: false,
    });
  }
  return casts;
}

function main() {
  console.log(`\n▸ fishingContextualAblation.ts — matcher-blind catch-rate ablation (N=${N} synthetic casts/config)\n`);

  const training = buildSyntheticTrainingCasts(9001);
  const contextMap = buildContextualMap(training);
  const cellOnlyMap = buildCellOnlyMap(training);
  console.log(`  training corpus: ${training.length} synthetic casts, ${contextMap.size} distinct context keys, ${cellOnlyMap.size} distinct cell-only keys\n`);

  const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD);
  const baseOpts = { policy, matcherPool: [], gridSize: GRID_SIZE };

  const baselineUniform = simulateCasts(N, baseOpts);
  const cellOnly = simulateCasts(N, {
    ...baseOpts,
    blindFallback: { contextMap: new Map(), cellOnlyMap, minIndependentCasts: DEFAULT_MIN_INDEPENDENT_CASTS },
  });
  const hierarchical = simulateCasts(N, {
    ...baseOpts,
    blindFallback: { contextMap, cellOnlyMap, minIndependentCasts: DEFAULT_MIN_INDEPENDENT_CASTS },
  });

  console.log(`  matcher BLIND, fallback UNIFORM (today's actual live/default behavior):      ${baselineUniform.caught}/${N} = ${(baselineUniform.catchRate * 100).toFixed(1)}%`);
  console.log(`  matcher BLIND, fallback CELL-ONLY (real-style empirical, no context tier):    ${cellOnly.caught}/${N} = ${(cellOnly.catchRate * 100).toFixed(1)}%`);
  console.log(`  matcher BLIND, fallback CONTEXTUAL (this session's hierarchical backoff):     ${hierarchical.caught}/${N} = ${(hierarchical.catchRate * 100).toFixed(1)}%`);
  console.log(`\n  (framing per this file's header: this measures whether the ALGORITHM exploits genuine`);
  console.log(`  previous-direction structure when it's present in the ground truth — not a live Dendren catch-rate estimate.)\n`);
}

main();
