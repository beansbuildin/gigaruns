/**
 * src/sim/fishing/fishMaxHp.ts — [session 80 §3] the fish's max HP, as the
 * corpus actually reports it.
 *
 * `castSim` has always used a single `fishMaxHp` for every cast (21 at
 * `REAL_PARAMS`, 20 by default). Live it is a DISTRIBUTION. Over the 131
 * committed casts:
 *
 *     14:12  15:13  16:12  17:21  18:17  19:10  20:18  21:19  23:2  25:2  26:5
 *     eleven distinct values, mean 18.27, and CONSTANT within a cast (0 of 131
 *     casts see it change between turns)
 *
 * **The centre was never the problem; the spread is.** The opening ratio the
 * simulator uses is right to three digits — live 0.6286 against `REAL_PARAMS`'
 * 13/21 = 0.6190 — so a fixed-HP sim gets the average fish about right and has
 * no fish that are unusually easy or unusually hard. Catch is a THRESHOLD
 * outcome, so that missing spread is understated on both tails at once.
 *
 * ## ⚠ What this file is NOT
 *
 * It is not an answer to `OIL-POLICY.md` §0a. The session-80 brief said so in
 * advance and the measurement agrees: §0a's gap is a per-play `fishHp` drift of
 * −3.437 against a live +0.192, carried 96% by the hit rate
 * (`scripts/damageEconomy.ts`). Sampling the max HP does not move a drift — it
 * is a per-play quantity and this is a per-cast one. **Adding the distribution
 * is right, and it is not the mechanism.**
 *
 * Reads committed fixtures only: no network, no `data/`, nothing written.
 */

import type { CastTrace } from "./castTrace.js";
import type { Rng } from "../rng.js";

/**
 * `fishMaxHp` per cast, off the cast's FIRST state.
 *
 * The first state and not any state, because the value is constant within a
 * cast (verified: 0 of 131 casts change it) and pooling every turn would weight
 * long casts more heavily than short ones — turning a distribution over FISH
 * into a distribution over TURNS, which is a different quantity that nothing
 * here wants.
 */
export function fishMaxHpCounts(traces: readonly CastTrace[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const t of traces) {
    const first = t.turns[0];
    if (first === undefined) continue;
    counts.set(first.fishMaxHp, (counts.get(first.fishMaxHp) ?? 0) + 1);
  }
  return counts;
}

/** True when no cast in the corpus changes its own `fishMaxHp` between turns. */
export function fishMaxHpIsConstantWithinCast(traces: readonly CastTrace[]): boolean {
  return traces.every((t) => new Set(t.turns.map((x) => x.fishMaxHp)).size <= 1);
}

export function meanFishMaxHp(traces: readonly CastTrace[]): number {
  let total = 0;
  let n = 0;
  for (const [value, count] of fishMaxHpCounts(traces)) {
    total += value * count;
    n += count;
  }
  return n === 0 ? 0 : total / n;
}

/** The mean of `fishHp / fishMaxHp` on each cast's opening state. */
export function meanOpeningRatio(traces: readonly CastTrace[]): number {
  const ratios: number[] = [];
  for (const t of traces) {
    const first = t.turns[0];
    if (first === undefined || first.fishMaxHp === 0) continue;
    ratios.push(first.fishHp / first.fishMaxHp);
  }
  return ratios.length === 0 ? 0 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

/**
 * A sampler for `CastOptions.fishMaxHpSampler`: draws a `fishMaxHp` in
 * proportion to how often the corpus saw it.
 *
 * The EMPIRICAL distribution rather than a fitted one, deliberately. A fitted
 * family would smooth across values the corpus has never produced, and at
 * n=131 the shape is not established well enough to justify the values a fit
 * would invent — this repo's habit is to model what was observed and say when
 * it is thin. It is thin: five of the eleven values rest on five casts or
 * fewer.
 *
 * Throws on an empty corpus rather than defaulting, because a sampler that
 * silently returns a constant is exactly the failure this option exists to
 * remove.
 */
export function buildFishMaxHpSampler(traces: readonly CastTrace[]): (rng: Rng) => number {
  const values: number[] = [];
  for (const [value, count] of fishMaxHpCounts(traces)) {
    for (let i = 0; i < count; i++) values.push(value);
  }
  if (values.length === 0) throw new Error("buildFishMaxHpSampler: no traces carry a fishMaxHp");
  values.sort((a, b) => a - b);
  return (rng: Rng) => rng.pick(values);
}
