/**
 * scripts/focusReserveAblation.ts — [session 45, brief §3] sweeps
 * `focusReserveWeight` (`src/strategy/fishing/cardChoice.ts`'s
 * `focusReserveFraction` term) against the EMPIRICAL fish, mirroring
 * `scripts/chargeReserveAblation.ts`'s structure for the dungeon side's
 * equivalent knob.
 *
 * The defect being priced is SPEC-fishing.md §4c: the 3-point,
 * non-regenerating focus budget is spent within the first 2-4 turns of every
 * cast (16/16 live, session 44) because the objective is single-turn-greedy
 * and movement cost only ever breaks an exact EV tie.
 *
 * Swept against `empiricalFish` (a fish drawn from the real corpus's own
 * movement statistics), NOT `patterns.ts`'s synthetic pool — session 45 §2
 * showed the synthetic fish gives materially different, and in at least one
 * case sign-reversed, answers. Both a ring-model policy and today's live
 * mined-matcher policy are swept, because the two have very different amounts
 * of information to spend focus on and there is no reason to assume one
 * weight suits both.
 *
 * Also reports the exhaustion diagnostic the defect was found by: the median
 * turn at which the focus budget first hits 0, and the share of casts that
 * exhaust it at all.
 *
 * Real parameters throughout (`fixtures/fishing-casts/live/
 * cast-2026-08-19-00-55-15/state-000.json`): deck [1,2,3,4,5,6,7,76,77,79],
 * fishHp 13/21, mana 10, focus 3, hand 3.
 *
 * Usage: npx tsx scripts/focusReserveAblation.ts [N]
 */

import { join } from "node:path";

import {
  makeMatcherFishPolicy,
  simulateCasts,
  simulateCast,
  REDRAW_THRESHOLD,
  type CastOptions,
  type FishPolicy,
  type FishPolicyContext,
} from "../src/sim/fishing/castSim.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { loadMinedPatterns } from "./liveFishing.js";

const REAL_DECK = [1, 2, 3, 4, 5, 6, 7, 76, 77, 79];
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

const records = loadTransitionRecords(join("data", "fish-patterns.jsonl"));
const casts = groupByCast(records).filter(isCleanCast);
const table = buildStepClassTable(casts);
const minedPool = loadMinedPatterns();

/**
 * The distribution tiers `scripts/liveFishing.ts` ACTUALLY wires today
 * (lines ~1009-1025): mined matcher first, then `contextualFallback` over the
 * real corpus maps — NOT the hardcoded-uniform `emptyFallback` the sim
 * defaults to when `blindFallback` is omitted. Without this a "today's live
 * config" row is not today's live config: a uniform distribution makes every
 * focus placement EV-identical, so the tie-break never moves the focus point
 * and the focus budget is never spent, which is the exact opposite of what
 * live does.
 */
const LIVE_FALLBACK = { contextMap: buildContextualMap(casts), cellOnlyMap: buildCellOnlyMap(casts) };

const N = Number(process.argv[2] ?? 8000);
const SEEDS = [1, 500000];
const WEIGHTS = [0, 0.5, 1, 2, 3, 4, 6, 8, 12];

console.log(`\n▸ focusReserveAblation.ts — N=${N} per cell, seeds ${SEEDS.join(" / ")}`);
console.log(`  corpus: ${casts.length} clean casts; card hitEffect magnitudes in the real deck are 3-6, so a weight much past that is buying a future option at the price of a whole hit\n`);

function sweep(label: string, base: Omit<CastOptions, "seed" | "policy">) {
  console.log(`  ${label}`);
  console.log(`  ${"weight".padStart(8)} ${SEEDS.map((s) => `seed ${s}`.padStart(16)).join("  ")}`);
  console.log(`  ${"".padStart(8)} ${SEEDS.map(() => "catch% / fishHP".padStart(16)).join("  ")}`);
  for (const w of WEIGHTS) {
    const cells: string[] = [];
    for (const seed of SEEDS) {
      const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, true, w);
      const r = simulateCasts(N, { policy, ...REAL_PARAMS, ...base }, seed);
      cells.push(`${(r.catchRate * 100).toFixed(1)}% / ${r.meanFinalFishHp.toFixed(2)}`);
    }
    console.log(`  ${String(w).padStart(8)} ${cells.map((c) => c.padStart(16)).join("  ")}`);
  }
  console.log("");
}

/**
 * Instrumented policy: wraps the real `chooseCard` so nothing about the
 * decision changes, and records the turn at which the focus budget first
 * reaches 0. This is the same measurement session 44 used to establish the
 * defect (43% of N=300 by median turn 2), re-run here so the sweep can show
 * the mechanism moving, not just the outcome.
 */
function instrumentedPolicy(focusReserveWeight: number, log: { exhaustedAtTurn: number | null }): FishPolicy {
  const inner = makeMatcherFishPolicy(REDRAW_THRESHOLD, true, focusReserveWeight);
  let turn = 0;
  return {
    name: inner.name,
    act(ctx: FishPolicyContext, rng) {
      const action = inner.act(ctx, rng);
      turn++;
      if (log.exhaustedAtTurn === null && ctx.focusBudget.remaining > 0 && action.type === "play") {
        const cost = Math.abs(action.focus.x - ctx.focusBudget.current.x) + Math.abs(action.focus.y - ctx.focusBudget.current.y);
        if (ctx.focusBudget.remaining - cost <= 0) log.exhaustedAtTurn = turn;
      }
      return action;
    },
  };
}

function exhaustionReport(label: string, base: Omit<CastOptions, "seed" | "policy">, weights: readonly number[]) {
  console.log(`  focus-budget exhaustion — ${label}`);
  console.log(`  ${"weight".padStart(8)}  ${"% casts exhausting".padStart(20)}  ${"median turn".padStart(12)}`);
  for (const w of weights) {
    const turns: number[] = [];
    let exhausted = 0;
    const runs = Math.min(N, 3000);
    for (let i = 0; i < runs; i++) {
      const log = { exhaustedAtTurn: null as number | null };
      simulateCast({ ...REAL_PARAMS, ...base, policy: instrumentedPolicy(w, log), seed: 1 + i });
      if (log.exhaustedAtTurn !== null) {
        exhausted++;
        turns.push(log.exhaustedAtTurn);
      }
    }
    turns.sort((a, b) => a - b);
    const median = turns.length > 0 ? turns[Math.floor(turns.length / 2)]! : NaN;
    console.log(
      `  ${String(w).padStart(8)}  ${`${((exhausted / runs) * 100).toFixed(1)}%`.padStart(20)}  ${String(Number.isNaN(median) ? "-" : median).padStart(12)}`,
    );
  }
  console.log("");
}

const ring: Omit<CastOptions, "seed" | "policy"> = {
  empiricalFish: { table },
  matcherPool: [],
  ringModel: { table },
  deckIds: [...REAL_DECK],
};
const liveToday: Omit<CastOptions, "seed" | "policy"> = {
  empiricalFish: { table },
  matcherPool: minedPool,
  blindFallback: LIVE_FALLBACK,
  deckIds: [...REAL_DECK],
};
const ringPlusMined: Omit<CastOptions, "seed" | "policy"> = {
  empiricalFish: { table },
  matcherPool: minedPool,
  ringModel: { table },
  deckIds: [...REAL_DECK],
};

sweep("A. RING model (the §1 policy) vs empirical fish", ring);
sweep("B. RING model + mined matcher, ring-intersected", ringPlusMined);
sweep("C. today's live config (mined matcher, no ring) vs empirical fish", liveToday);

exhaustionReport("RING model", ring, [0, 3, 8]);
exhaustionReport("today's live config", liveToday, [0, 3, 8]);
