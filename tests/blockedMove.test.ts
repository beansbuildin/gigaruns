/**
 * [session 129] The measurement that answers DECISIONS 2026-09-08's open
 * scope question on `blockedMove`, pinned so corpus growth updates it rather
 * than silently rotting. See `src/sim/blockedMove.ts` for the full reasoning.
 *
 * These are OBSERVATION pins, not a model. `blockedMove` is still consumed
 * nowhere in the strategy path and this file does not change that — it records
 * WHY the proposed wiring (a hard exclusion) is falsified, so the next session
 * does not re-propose it.
 */

import { describe, expect, it } from "vitest";

import { blockedMoveScope } from "../src/sim/blockedMove.js";

const scope = blockedMoveScope();

describe("blockedMove — what an intuition proc actually excludes", () => {
  it("finds the procs at all — a corpus that stopped yielding them would pass every assertion below vacuously", () => {
    expect(scope.observations.length).toBe(27 /* [session 131, day 20709] was 23 */); /* [session 130, day 20708] was 20 */
    for (const o of scope.observations) expect(["rock", "paper", "scissor"]).toContain(o.blocked);
  });

  it("measures the NULL rather than assuming 1/3 — the enemy's own move distribution is flat", () => {
    // If the enemy were skewed, the current-exchange result below would be the
    // one at risk, so this is a precondition of the finding and not a detail.
    expect(scope.enemyExchanges).toBe(5489 /* [session 131, day 20709] was 5288 */); /* [session 130, day 20708] was 5067 */
    const pct = (m: string) => (100 * (scope.enemyMoveCounts[m] ?? 0)) / scope.enemyExchanges;
    expect(pct("paper")).toBeCloseTo(33.7 /* [session 131, day 20709] was 33.5 */, 1); /* [session 130, day 20708] was 33.7 */
    expect(pct("rock")).toBeCloseTo(33.0 /* [session 131, day 20709] was 33.2 */, 1); /* [session 130, day 20708] was 33.1 */
    expect(pct("scissor")).toBeCloseTo(33.3, 1); /* [session 130, day 20708] was 33.2 */
  });

  it("⭐ does NOT bind the CURRENT exchange — 8 of 27 against 9.01 expected [session 131; was 6 of 23 / 7.67]", () => {
    // [session 131] P(X <= 8 | n 27, p 9.01/27) ≈ 0.43 — still chance.
    expect(scope.currentHits).toBe(8 /* [session 131, day 20709] was 6 */);
    expect(scope.currentN).toBe(27 /* [session 131, day 20709] was 23 */); /* [session 130, day 20708] was 20 */
    expect(scope.currentExpected).toBeCloseTo(9.01 /* [session 131, day 20709] was 7.67 */, 1); /* [session 130, day 20708] was 6.67 */
  });

  it("⭐ DEPRESSES the NEXT exchange without EXCLUDING it — 2 of 27 against 9.01 expected [session 131; was 2 of 23 / 7.67]", () => {
    // [session 131] P(X <= 2 | n 27, p 9.01/27) ≈ 0.0018 (was ≈ 0.0067 at n 23) — four new procs, zero next-exchange hits.
    expect(scope.nextHits).toBe(2);
    expect(scope.nextN).toBe(27 /* [session 131, day 20709] was 23 */); /* [session 130, day 20708] was 20 */
    expect(scope.nextExpected).toBeCloseTo(9.01 /* [session 131, day 20709] was 7.67 */, 1); /* [session 130, day 20708] was 6.67 */
  });

  it("⛔ keeps the falsifier explicit: the blocked move IS played next, twice — so a hard exclusion is wrong", () => {
    // This is the assertion that kills "remove blockedMove from the enemy's
    // distribution". A hard exclusion assigns probability ZERO to these two.
    // If this ever reaches 0 on a much larger n, the exclusion becomes live
    // again — but it must be re-argued, not assumed.
    const counterexamples = scope.observations.filter((o) => o.next === o.blocked);
    expect(counterexamples.length).toBeGreaterThan(0);
    expect(counterexamples.length).toBe(2);
  });

  it("is NOT wired into the strategy path, and this test does not wire it", () => {
    // Rule 4: a live strategy change is simulated against fixtures first, and
    // the reweighting this measurement implies needs a magnitude n=20 cannot
    // support (95% interval on 2/20 still touches the base rate).
    expect(scope.nextHits / scope.nextN).toBeLessThan(
      scope.nextExpected / scope.nextN,
    );
  });
});
