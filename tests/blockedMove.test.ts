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
    expect(scope.observations.length).toBe(23); /* [session 130, day 20708] was 20 */
    for (const o of scope.observations) expect(["rock", "paper", "scissor"]).toContain(o.blocked);
  });

  it("measures the NULL rather than assuming 1/3 — the enemy's own move distribution is flat", () => {
    // If the enemy were skewed, the current-exchange result below would be the
    // one at risk, so this is a precondition of the finding and not a detail.
    expect(scope.enemyExchanges).toBe(5288); /* [session 130, day 20708] was 5067 */
    const pct = (m: string) => (100 * (scope.enemyMoveCounts[m] ?? 0)) / scope.enemyExchanges;
    expect(pct("paper")).toBeCloseTo(33.5, 1); /* [session 130, day 20708] was 33.7 */
    expect(pct("rock")).toBeCloseTo(33.2, 1); /* [session 130, day 20708] was 33.1 */
    expect(pct("scissor")).toBeCloseTo(33.3, 1); /* [session 130, day 20708] was 33.2 */
  });

  it("⭐ does NOT bind the CURRENT exchange — 6 of 23 against 7.67 expected [session 130; was 6 of 20 / 6.67]", () => {
    expect(scope.currentHits).toBe(6);
    expect(scope.currentN).toBe(23); /* [session 130, day 20708] was 20 */
    expect(scope.currentExpected).toBeCloseTo(7.67, 1); /* [session 130, day 20708] was 6.67 */
  });

  it("⭐ DEPRESSES the NEXT exchange without EXCLUDING it — 2 of 23 against 7.67 expected [session 130; was 2 of 20 / 6.67]", () => {
    expect(scope.nextHits).toBe(2);
    expect(scope.nextN).toBe(23); /* [session 130, day 20708] was 20 */
    expect(scope.nextExpected).toBeCloseTo(7.67, 1); /* [session 130, day 20708] was 6.67 */
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
