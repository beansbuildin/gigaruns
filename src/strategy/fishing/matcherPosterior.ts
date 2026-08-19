/**
 * src/strategy/fishing/matcherPosterior.ts — [session 51, brief §3] the
 * matcher tier as a POSTERIOR MIXTURE rather than a fixed-weight override.
 *
 * ## What was there before, stated accurately
 *
 * The brief calls the shipped matcher tier "an override". It is not literally
 * a switch — `liveFishing.ts` and `offPolicyReplay.ts` both mix the
 * ring-intersected matcher distribution with the ring model at a FIXED weight
 * of `1 - ringFloor = 0.9`. The distinction matters for what the fix is: the
 * defect is not a missing floor (session 45 added that), it is that **0.9 is
 * a constant where a belief belongs**. The tier commits 90% of the mass to
 * the perimeter-walk hypothesis on turn 1, before that hypothesis has
 * survived a single prediction, and it keeps committing exactly 90% however
 * well or badly the hypothesis has done since.
 *
 * The mined library is supported by a small minority of casts. Assigning it
 * 0.9 on turn 1 is assigning a ~9% prior a 90% weight.
 *
 * ## The mixture
 *
 *   P(next) = pi * P_matcher(next) + (1 - pi) * P_ring(next)
 *   pi      = P(this fish is drawn from the mined library | hops so far)
 *
 * updated in log-odds by the sequential likelihood ratio the two tiers assign
 * to what actually happened:
 *
 *   logit(pi_t) = logit(pi_0) + sum_t [ log P_matcher(obs_t) - log P_ring(obs_t) ]
 *
 * `pi_0` is the mined library's own support rate — the fraction of clean
 * corpus casts some promoted primitive explains exactly — so the prior is
 * read off the same corpus the library is mined from rather than invented.
 *
 * Three properties, and the third is the reason this does not need more live
 * turns to justify itself:
 *
 *  - **pi -> 1 reduces to the old tier, pi -> 0 to the pure ring model.** Both
 *    former arms are interior points of the new one.
 *  - **Refutation is automatic.** `observe()` already kills candidates that
 *    mispredict; when the last one dies `P_matcher(obs) = 0`, the log-odds go
 *    to `-inf`, and the weight is 0 from then on. The old tier had no way to
 *    express "this hypothesis has been doing badly but is not dead".
 *  - **It is scored on its own predictions.** The weight moves only on
 *    evidence the two tiers actually disagreed about, so a matcher that
 *    tracks the fish earns weight and one that does not loses it, on the same
 *    turns, within the same cast.
 *
 * ## What is deliberately NOT claimed
 *
 * The brief argues the mixture "cannot lose to either arm, so the measurement
 * stops being decision-relevant". That is true of a mixture whose posterior is
 * CORRECT, and this posterior rests on two approximations: the per-turn
 * likelihoods are treated as independent given the hypothesis (they are not —
 * a surviving candidate constrains its own future), and `pi_0` is a point
 * estimate from 88 casts. So this is gated empirically like everything else in
 * this repo, and the gate is in the commit message, not assumed from the
 * algebra.
 *
 * Pure — no I/O, no network, per CLAUDE.md's strategy/API split.
 */

import type { Cell } from "../../sim/fishing/geometry.js";
import { cellKey } from "../../sim/fishing/geometry.js";
import type { Distribution } from "./stepClass.js";

export interface MatcherPosteriorOptions {
  /**
   * `pi_0` — the prior that a fresh fish is drawn from the mined library.
   * Pass the library's own support rate (`matcherPriorFromSupport`), not a
   * guess.
   */
  prior: number;
  /**
   * Clamp on ONE turn's log likelihood ratio. Without it a single turn where
   * the ring model happened to assign near-zero to the observed cell can move
   * the posterior further than the whole rest of the cast, which is exactly
   * the unbounded-influence failure the mixture exists to remove — putting it
   * back one level up would be an embarrassing way to lose.
   *
   * 3 nats caps one turn at a ~20x odds move. Refutation is NOT clamped: a
   * dead candidate set is a logical impossibility, not a surprising
   * observation, and it sets the weight to zero outright.
   */
  maxLogRatioPerTurn: number;
  /**
   * Hard ceiling on the weight. The matcher distribution can be a point mass,
   * and a point mass at weight 1 has unbounded loss — the same reason
   * `ringFloor` exists. Capping at `1 - ringFloor` keeps the old tier's floor
   * guarantee intact at the top of the range.
   */
  maxWeight: number;
}

export const DEFAULT_MATCHER_POSTERIOR_OPTIONS: Omit<MatcherPosteriorOptions, "prior"> = {
  maxLogRatioPerTurn: 3,
  maxWeight: 0.9,
};

export interface MatcherPosterior {
  /** log(pi / (1 - pi)). `-Infinity` once the hypothesis is refuted. */
  logOdds: number;
  /** Turns whose likelihood ratio has been folded in — for logging with its n. */
  updates: number;
  /** True once the candidate set died; the weight is pinned at 0 thereafter. */
  refuted: boolean;
}

const logit = (p: number) => Math.log(p / (1 - p));

export function initMatcherPosterior(prior: number): MatcherPosterior {
  const p = Math.min(Math.max(prior, 1e-6), 1 - 1e-6);
  return { logOdds: logit(p), updates: 0, refuted: false };
}

/**
 * Fold in one turn's evidence: the probability each tier assigned to the cell
 * the fish ACTUALLY reached, both read from the distributions computed BEFORE
 * that move was seen.
 *
 * `pMatcher <= 0` means the hypothesis assigned the observed outcome zero
 * probability — it is refuted, permanently, and no clamp applies.
 */
export function updateMatcherPosterior(
  post: MatcherPosterior,
  pMatcher: number,
  pRing: number,
  opts: MatcherPosteriorOptions,
): MatcherPosterior {
  if (post.refuted) return { ...post, updates: post.updates + 1 };
  if (pMatcher <= 0) return { logOdds: Number.NEGATIVE_INFINITY, updates: post.updates + 1, refuted: true };
  if (pRing <= 0) return { ...post, updates: post.updates + 1 };
  const raw = Math.log(pMatcher) - Math.log(pRing);
  const clamped = Math.min(Math.max(raw, -opts.maxLogRatioPerTurn), opts.maxLogRatioPerTurn);
  return { logOdds: post.logOdds + clamped, updates: post.updates + 1, refuted: false };
}

/** The mixture weight `pi` in [0, maxWeight]. */
export function matcherWeight(post: MatcherPosterior, opts: MatcherPosteriorOptions): number {
  if (post.refuted || !Number.isFinite(post.logOdds)) return 0;
  const pi = 1 / (1 + Math.exp(-post.logOdds));
  return Math.min(Math.max(pi, 0), opts.maxWeight);
}

/**
 * `pi_0` from the mined library's own support: the fraction of corpus casts
 * that some PROMOTED primitive explains exactly.
 *
 * Laplace-smoothed (+1/+2) so a library supported by zero casts in a tiny
 * corpus gets a small prior rather than exactly 0 — a 0 prior is unrecoverable
 * in log-odds no matter what the fish then does, which is the same
 * "we have not seen one yet is not never" mistake `SWITCH_PROBABILITY_FLOOR`
 * exists to prevent.
 */
export function matcherPriorFromSupport(supportingCasts: number, totalCasts: number): number {
  return (supportingCasts + 1) / (totalCasts + 2);
}

/** Convenience: read `p` off a distribution for the cell the fish actually reached. */
export function probabilityOf(dist: Distribution | null, cell: Cell): number {
  return dist?.get(cellKey(cell))?.p ?? 0;
}
