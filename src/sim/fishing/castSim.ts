/**
 * src/sim/fishing/castSim.ts — synthetic Dendren casts, mirroring
 * `src/sim/dungeonSim.ts`'s shape (pluggable policy, seeded rng, no network).
 *
 * The confirmed mechanics (mana pool, catch-meter direction, hit/crit
 * geometry, hand refill-on-empty) come from the one real capture — see
 * SPEC.md §5 / SPEC-fishing.md §4. The fish's actual movement rule is drawn
 * from the SYNTHETIC pattern pool (`patterns.ts`) for internal consistency
 * with the matcher under test — this sim answers "does the algorithm work,
 * and does an EV-informed policy beat random card choice", not "what does
 * Dendren actually do". See `patterns.ts`'s header for why that's the right
 * scope for Task 8's gate.
 */

import { chooseCard, shouldRedraw, type FishingCardLike } from "../../strategy/fishing/cardChoice.js";
import {
  emptyFallback,
  initMatcher,
  observe,
  predictDistribution,
  type MatcherState,
} from "../../strategy/fishing/matcher.js";
import type { Cell } from "./geometry.js";
import { cellKey, zonesToCells } from "./geometry.js";
import { loadDendrenDeck } from "./deck.js";
import { buildPatternPool, toCandidate, type Pattern } from "./patterns.js";
import { makeRng, type Rng } from "../rng.js";

export type CastOutcome = "caught" | "escaped_meter" | "escaped_mana" | "stalled";

export interface CastResult {
  outcome: CastOutcome;
  turns: number;
  finalFishHp: number;
}

export interface FishPolicyContext {
  hand: FishingCardLike[];
  mana: number;
  dist: ReadonlyMap<string, { cell: Cell; p: number }>;
  gridSize: number;
  fishHp: number;
}

export type FishAction =
  | { type: "play"; handIndex: number; focus: Cell }
  | { type: "redraw" }
  | { type: "pass" };

export interface FishPolicy {
  name: string;
  act(ctx: FishPolicyContext, rng: Rng): FishAction;
}

export const randomFishPolicy: FishPolicy = {
  name: "random",
  act(ctx, rng) {
    const affordable = ctx.hand
      .map((_, i) => i)
      .filter((i) => ctx.hand[i]!.manaCost <= ctx.mana);
    if (affordable.length === 0) return { type: "pass" };
    const handIndex = rng.pick(affordable);
    const cells: Cell[] = [];
    for (let x = 1; x <= ctx.gridSize; x++) for (let y = 1; y <= ctx.gridSize; y++) cells.push({ x, y });
    return { type: "play", handIndex, focus: rng.pick(cells) };
  },
};

export const REDRAW_THRESHOLD = 3;

export const matcherFishPolicy: FishPolicy = {
  name: "matcher-ev",
  act(ctx) {
    const missPenaltyMultiplier = 1;
    const best = chooseCard(ctx.hand, ctx.mana, ctx.dist, ctx.gridSize, missPenaltyMultiplier, ctx.fishHp);
    if (!best) {
      if (ctx.mana >= ctx.hand.length && ctx.hand.length > 0) return { type: "redraw" };
      return { type: "pass" };
    }
    if (shouldRedraw(best, ctx.hand.length, ctx.mana, REDRAW_THRESHOLD) && ctx.mana >= ctx.hand.length) {
      return { type: "redraw" };
    }
    return { type: "play", handIndex: best.handIndex, focus: best.focus };
  },
};

export interface CastOptions {
  seed: number;
  policy: FishPolicy;
  gridSize?: number;
  handSize?: number;
  startMana?: number;
  fishMaxHp?: number;
  startFishHpRatio?: number;
  maxTurns?: number;
  /** Override the candidate pool the matcher searches. Defaults to the full synthetic pool. */
  candidatePool?: Pattern[];
}

function drawHand(deck: FishingCardLike[], drawIdx: number, handSize: number): { hand: FishingCardLike[]; nextIdx: number } {
  const hand: FishingCardLike[] = [];
  let idx = drawIdx;
  for (let i = 0; i < handSize; i++) {
    hand.push(deck[idx % deck.length]!);
    idx++;
  }
  return { hand, nextIdx: idx };
}

export function simulateCast(opts: CastOptions): CastResult {
  const rng = makeRng(opts.seed);
  const gridSize = opts.gridSize ?? 4;
  const handSize = opts.handSize ?? 3;
  const maxTurns = opts.maxTurns ?? 40;
  const fishMaxHp = opts.fishMaxHp ?? 20;
  let mana = opts.startMana ?? 10;
  let fishHp = Math.round(fishMaxHp * (opts.startFishHpRatio ?? 0.65));

  const catalog = loadDendrenDeck();
  const deck: FishingCardLike[] = [];
  for (let i = 0; i < catalog.length; i++) deck.push(rng.pick(catalog));

  let { hand, nextIdx: drawIdx } = drawHand(deck, 0, handSize);

  const pool = opts.candidatePool ?? buildPatternPool();
  const startCell: Cell = { x: rng.int(gridSize) + 1, y: rng.int(gridSize) + 1 };
  const truePattern = pool[rng.int(pool.length)]!;
  const trueTrajectory = truePattern.path(startCell, gridSize, maxTurns + 2);

  const candidates = pool.map((p) => toCandidate(p, startCell, gridSize, maxTurns + 1));
  let matcher: MatcherState = initMatcher(candidates, startCell);

  let turn = 0;
  while (turn < maxTurns) {
    if (mana <= 0) return { outcome: "escaped_mana", turns: turn, finalFishHp: fishHp };
    if (hand.length === 0) ({ hand, nextIdx: drawIdx } = drawHand(deck, drawIdx, handSize));

    const dist =
      matcher.candidates.length > 0
        ? predictDistribution(matcher)
        : emptyFallback(matcher.history[matcher.history.length - 1]!, new Map(), gridSize);

    const action = opts.policy.act({ hand, mana, dist, gridSize, fishHp }, rng);

    if (action.type === "pass") {
      return { outcome: "stalled", turns: turn, finalFishHp: fishHp };
    }
    if (action.type === "redraw") {
      mana -= hand.length;
      ({ hand, nextIdx: drawIdx } = drawHand(deck, drawIdx, handSize));
      continue;
    }

    const card = hand[action.handIndex]!;
    mana -= card.manaCost;
    hand = hand.filter((_, i) => i !== action.handIndex);

    const actualCell = trueTrajectory[matcher.turn]!;
    matcher = observe(matcher, actualCell);
    turn++;

    const zoneOffsets = zoneToOffsets(card.hitZones, card.critZones, action.focus, gridSize);
    const outcome = resolveOutcome(zoneOffsets, actualCell);

    if (outcome === "crit" || outcome === "hit") {
      const amount = outcome === "crit" ? (card.critEffects[0]?.amount ?? card.hitEffects[0]?.amount ?? 0) : (card.hitEffects[0]?.amount ?? 0);
      fishHp = Math.max(0, fishHp - amount);
    } else {
      const amount = card.missEffects[0]?.amount ?? 0;
      fishHp = Math.min(fishMaxHp, fishHp - amount);
    }

    if (fishHp <= 0) return { outcome: "caught", turns: turn, finalFishHp: fishHp };
    if (fishHp >= fishMaxHp) return { outcome: "escaped_meter", turns: turn, finalFishHp: fishHp };
  }
  return { outcome: "stalled", turns: turn, finalFishHp: fishHp };
}

function zoneToOffsets(
  hitZones: readonly number[],
  critZones: readonly number[],
  focus: Cell,
  gridSize: number,
): { hitKeys: Set<string>; critKeys: Set<string> } {
  const hitKeys = new Set(zonesToCells(focus, hitZones, gridSize).map(cellKey));
  const critKeys = new Set(zonesToCells(focus, critZones, gridSize).map(cellKey));
  return { hitKeys, critKeys };
}

function resolveOutcome(
  zones: { hitKeys: Set<string>; critKeys: Set<string> },
  actualCell: Cell,
): "hit" | "crit" | "miss" {
  const key = cellKey(actualCell);
  if (zones.critKeys.has(key)) return "crit";
  if (zones.hitKeys.has(key)) return "hit";
  return "miss";
}

export interface CastSummary {
  runs: number;
  caught: number;
  catchRate: number;
  meanTurns: number;
}

export function simulateCasts(runs: number, opts: Omit<CastOptions, "seed">, seed = 1): CastSummary {
  let caught = 0;
  let totalTurns = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateCast({ ...opts, seed: seed + i });
    if (r.outcome === "caught") caught++;
    totalTurns += r.turns;
  }
  return { runs, caught, catchRate: caught / runs, meanTurns: totalTurns / runs };
}
