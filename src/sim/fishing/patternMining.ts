/**
 * src/sim/fishing/patternMining.ts — [session 50, brief §1] the pattern
 * PROMOTION logic, extracted verbatim out of `scripts/mineFishPatterns.ts`
 * (where it originated, session 15/29) so a second caller can re-mine the
 * library without shelling out to a script.
 *
 * The second caller is `offPolicyReplay.ts`'s leave-one-cast-out matcher tier.
 * Session 47 disabled the matcher in the replay entirely because its mined
 * candidates come FROM the replayed corpus (conservatism #3), and session 49
 * discovered the cost of that: with the matcher off the distribution is flat,
 * EV differences between focus placements shrink, the movement-cost tie-break
 * dominates, and the replayed policy barely moves its focus — 0.64 points on
 * the opening move against live's 1.80. So the replay was measuring a system
 * that does not spend, which made session 49's focus-budget A/B uninformative
 * by construction.
 *
 * Re-mining the library with the replayed cast held out fixes that without
 * reintroducing the leak: the promotion decision for cast X is made from the
 * other 82 casts only, exactly like the ring table and the contextual maps
 * already are. It costs one `testPrimitives` pass per cast, which is
 * milliseconds — the pool is ~23 primitives and the corpus is ~360
 * transitions.
 *
 * Behavior is byte-for-byte unchanged from the version this replaces; only
 * the location moved, and `scripts/mineFishPatterns.ts` re-exports these so
 * every existing import site (including `tests/mineFishPatterns.test.ts`) is
 * untouched.
 */

import { cellsEqual } from "./geometry.js";
import { buildPatternPool, type Pattern } from "./patterns.js";
import type { Cast } from "./transitionCorpus.js";

/**
 * **Not the same statistical regime as the project's ~30-observation rate
 * floor (DECISIONS.md 2026-08-15/16), and this constant is deliberately
 * smaller — say so explicitly rather than silently reusing "30" out of
 * habit.** That floor bounds how many samples it takes to read a NOISY RATE
 * (a proc chance, an opponent's move mix) without overfitting a small
 * sample — the enemy-63 mistake, made twice. An exact multi-turn trajectory
 * match against one of ~23 candidate primitives is a different kind of
 * evidence: if a fish's movement were NOT drawn from this primitive set at
 * all, the chance of even ONE real cast exactly matching a primitive across
 * every one of its turns by coincidence is already small, and two
 * independent real casts matching the SAME primitive from different start
 * cells by pure coincidence is smaller still (roughly 1-in-23 squared if
 * primitives were hit uniformly at random, ignoring that a short cast has
 * few turns to be wrong about). Three independent matches is used here as a
 * conservative promotion bar for THIS kind of evidence — not a claim that it
 * is equally strong evidence as 30 rate observations, just that requiring 30
 * EXACT independent trajectory matches before ever promoting anything would
 * make this miner permanently inert at any live-play volume this project
 * could plausibly reach in one project's lifetime.
 */
export const PROMOTION_THRESHOLD = 3;

export interface PrimitiveSupport {
  pattern: Pattern;
  matchingCasts: string[];
}

export interface ExcludedCast {
  castId: string;
  reason: string;
}

export interface PrimitiveTestResult {
  supports: PrimitiveSupport[];
  excluded: ExcludedCast[];
}

/**
 * [session 29, CODEXREVIEW #5] A cast with duplicate/conflicting turn
 * numbers or a gap before its own last turn is excluded from exact-match
 * testing entirely — it is REJECTED, not silently patched around. The old
 * behavior skipped gaps mid-loop and still called the remaining turns an
 * "exact full-trajectory match," which is exactly the shape of false
 * confidence CODEXREVIEW #5 flagged (and duplicate/conflicting turns are the
 * resumed-cast numbering bug's direct fingerprint — see
 * `scripts/liveFishing.ts`'s `lastRecordForCast` doc comment).
 */
export function testPrimitives(casts: Cast[]): PrimitiveTestResult {
  const pool = buildPatternPool();
  const results: PrimitiveSupport[] = pool.map((pattern) => ({ pattern, matchingCasts: [] }));
  const excluded: ExcludedCast[] = [];

  for (const cast of casts) {
    if (cast.maxTurn < 0) continue;
    if (cast.duplicateTurns.length > 0) {
      excluded.push({
        castId: cast.castId,
        reason: `duplicate/conflicting record(s) at turn(s) ${cast.duplicateTurns.join(",")} — likely a resumed-process numbering collision (CODEXREVIEW #5)`,
      });
      continue;
    }
    if (cast.hasGaps) {
      excluded.push({
        castId: cast.castId,
        reason: `gapped trajectory (a turn before maxTurn ${cast.maxTurn} is missing) — cannot be an exact FULL-trajectory match`,
      });
      continue;
    }
    for (const support of results) {
      const trajectory = support.pattern.path(cast.start, cast.gridSize, cast.maxTurn + 2);
      let matches = true;
      for (let t = 0; t <= cast.maxTurn; t++) {
        const observed = cast.byTurn.get(t)!; // no gaps at this point — guaranteed present
        const predicted = trajectory[t + 1];
        if (!predicted || !cellsEqual(predicted, observed)) {
          matches = false;
          break;
        }
      }
      if (matches) support.matchingCasts.push(cast.castId);
    }
  }
  return { supports: results.filter((s) => s.matchingCasts.length > 0), excluded };
}

/**
 * [session 50] The promotion decision itself, as `mineFishPatterns.ts`'s
 * `main` has always made it: every primitive with at least
 * `PROMOTION_THRESHOLD` independent exact-matching casts, in the pool's own
 * order. Factored out so the replay's leave-one-cast-out arm promotes by the
 * identical rule rather than a lookalike.
 */
export function promotePatterns(casts: Cast[], threshold: number = PROMOTION_THRESHOLD): Pattern[] {
  return testPrimitives(casts)
    .supports.filter((s) => s.matchingCasts.length >= threshold)
    .map((s) => s.pattern);
}

/**
 * [session 51 §3] The promoted library together with the DISTINCT casts it
 * explains — the prior for `matcherPosterior.ts`'s mixture weight.
 *
 * The union, not the sum: two primitives that each match the same cast (a
 * cw and a ccw perimeter walk agree on a cast too short to tell them apart)
 * are one piece of evidence that this fish is a perimeter walker, not two.
 * Summing `matchingCasts.length` over promoted patterns double-counts exactly
 * those casts and would inflate the prior.
 */
export function promotedSupport(
  casts: Cast[],
  threshold: number = PROMOTION_THRESHOLD,
): { patterns: Pattern[]; supportingCasts: number; totalCasts: number } {
  const supports = testPrimitives(casts).supports.filter((s) => s.matchingCasts.length >= threshold);
  const union = new Set<string>();
  for (const s of supports) for (const id of s.matchingCasts) union.add(id);
  return { patterns: supports.map((s) => s.pattern), supportingCasts: union.size, totalCasts: casts.length };
}

/**
 * [session 51 §3] How many DISTINCT casts in `casts` a given set of patterns
 * explains exactly — the live prior for `matcherPosterior.ts`.
 *
 * Deliberately takes the patterns rather than re-mining: live loads its
 * library from `data/mined-patterns.json`, which can be older than the
 * corpus, and the prior must describe the library actually in use. Mining a
 * fresh one here to count its support would give the right number for the
 * wrong library.
 *
 * Applies the same exclusions `testPrimitives` does — a duplicate-turn or
 * gapped cast cannot be an exact full-trajectory match — so the numerator and
 * the denominator are counted on the same footing.
 */
export function supportingCastCount(casts: Cast[], patterns: readonly Pattern[]): { supportingCasts: number; totalCasts: number } {
  let supporting = 0;
  let total = 0;
  for (const cast of casts) {
    if (cast.maxTurn < 0 || cast.duplicateTurns.length > 0 || cast.hasGaps) continue;
    total++;
    for (const pattern of patterns) {
      const trajectory = pattern.path(cast.start, cast.gridSize, cast.maxTurn + 2);
      let matches = true;
      for (let t = 0; t <= cast.maxTurn; t++) {
        const predicted = trajectory[t + 1];
        if (!predicted || !cellsEqual(predicted, cast.byTurn.get(t)!)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        supporting++;
        break; // DISTINCT casts — two patterns agreeing on one cast is one piece of evidence
      }
    }
  }
  return { supportingCasts: supporting, totalCasts: total };
}
