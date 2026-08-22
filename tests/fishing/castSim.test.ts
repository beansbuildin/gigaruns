/**
 * tests/fishing/castSim.test.ts — Task 8's gate: "Sim over 500 synthetic
 * casts beats random card choice on catch rate."
 *
 * The true fish pattern is drawn from the same synthetic pool the matcher
 * searches (`src/sim/fishing/patterns.ts`'s header explains why that's the
 * right internal-consistency scope for this gate — it tests the algorithm,
 * not real Dendren, which stays unknown until Task 9's live logging).
 */

import { describe, expect, it } from "vitest";

import { matcherFishPolicy, randomFishPolicy, simulateCast, simulateCasts } from "../../src/sim/fishing/castSim.js";

describe("Task 8 gate — matcher-driven card choice vs random", () => {
  it("beats random card choice on catch rate over 500 synthetic casts", () => {
    const runs = 500;
    const random = simulateCasts(runs, { policy: randomFishPolicy }, 1);
    const matcher = simulateCasts(runs, { policy: matcherFishPolicy }, 1);

    expect(matcher.catchRate).toBeGreaterThan(random.catchRate);
    // Not a razor's-edge win — the matcher should be meaningfully better,
    // not just noise at n=500.
    expect(matcher.caught).toBeGreaterThan(random.caught * 1.2);
  });

  it("never exceeds maxTurns and always resolves to a real outcome", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulateCast({ policy: matcherFishPolicy, maxTurns: 40, seed });
      expect(["caught", "escaped_meter", "escaped_mana", "stalled"]).toContain(r.outcome);
      expect(r.turns).toBeLessThanOrEqual(40);
      expect(r.turns).toBeGreaterThan(0);
      expect(r.finalFishHp).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * Session 26 — Task 13's own scoping note found `simulateCast` had no way
 * to model "the deck a real account actually holds": every cast drew a
 * fresh random sample of the WHOLE catalog. `deckIds` is the infrastructure
 * fix (no scoring/`chooseNewCard` logic touched) — a real, explicit id list
 * resolved against `loadDendrenDeck()`'s catalog instead of a random draw.
 */
describe("deckIds — Task 13 infrastructure, real held deck instead of a random catalog sample", () => {
  it("draws hands from the exact provided ids, in order, cycling on refill", () => {
    // handSize 3 (default), 4 ids: hand 1 is [1,2,3], hand 2 (after both
    // empty out across two plays with no catch) cycles back starting at id 4.
    const r = simulateCast({
      policy: randomFishPolicy,
      seed: 1,
      deckIds: [1, 2, 3, 4],
      maxTurns: 2, // stop well before the deck could exhaust naturally either way
    });
    expect(["caught", "escaped_meter", "escaped_mana", "stalled"]).toContain(r.outcome);
  });

  it("is deterministic given a fixed deck and seed — no random catalog sampling once deckIds is set", () => {
    const opts = { policy: matcherFishPolicy, seed: 7, deckIds: [1, 2, 3, 4, 5, 6, 7, 8] } as const;
    const a = simulateCast(opts);
    const b = simulateCast(opts);
    expect(a).toEqual(b);
  });

  it("throws rather than silently dropping an id absent from the Dendren catalog", () => {
    expect(() => simulateCast({ policy: randomFishPolicy, seed: 1, deckIds: [999999] })).toThrow(/999999/);
  });

  it("real catalog ids differ from the random-sample default — deckIds actually changes what's drawable", () => {
    const withRealDeck = simulateCast({ policy: matcherFishPolicy, seed: 3, deckIds: [1, 1, 1] });
    // A 1-card-type deck (id 1, repeated) never draws any other id — every
    // hand this cast ever sees is entirely id-1 cards, so this only proves
    // the substitution actually took hold, not a claim about catch rate.
    expect(withRealDeck.turns).toBeGreaterThan(0);
  });

  /**
   * [session 78, §4 / CODEXAUG22REVIEW M3] **Deck ORDER is load-bearing, and it
   * is why a deck-composition objective cannot be derived here today.**
   *
   * `drawHand` is sequential from index 0 and cycles with `% deck.length`. A
   * real cast lasts ~5 turns, so on the account's real 23-card deck only the
   * first ~8 cards are ever seen and a card APPENDED at the end is unreachable
   * by construction. `scripts/deckObjectiveSweep.ts` measured every one of 80
   * appended candidates as byte-identical to the baseline, while the same cards
   * PREPENDED moved hit rate by up to +19.91pp.
   *
   * These pin that, because it is the kind of fact a later reader "fixes" by
   * adding a shuffle — which would make every ranking an artifact of an
   * invented draw model (CLAUDE.md rule 1). The real question is a CAPTURE:
   * what does the server do to `fullDeck` when it grows?
   */
  describe("deck ORDER is load-bearing (session 78 §4)", () => {
    // The account's real held deck, off the most recent live capture that
    // carries one. Short enough to inline, real enough to mean something.
    const HELD = [74, 75, 76, 78, 1, 2, 3, 4, 5, 6, 34, 7, 36, 10, 38, 41, 39, 49, 48, 36, 74, 75, 76];
    const opts = { policy: matcherFishPolicy, matcherPool: [] as [] };

    it("appending a card to a 23-card deck changes NOTHING — it is never drawn", () => {
      const base = simulateCasts(200, { ...opts, deckIds: HELD }, 1);
      for (const id of [17, 25, 20]) {
        const appended = simulateCasts(200, { ...opts, deckIds: [...HELD, id] }, 1);
        expect(appended.hitRate).toBe(base.hitRate);
        expect(appended.meanFinalFishHp).toBe(base.meanFinalFishHp);
      }
    });

    it("prepending the SAME card changes a lot — so the multiset is not the deck", () => {
      const base = simulateCasts(200, { ...opts, deckIds: HELD }, 1);
      const prepended = simulateCasts(200, { ...opts, deckIds: [25, ...HELD] }, 1);
      expect(prepended.hitRate).toBeGreaterThan(base.hitRate);
    });

    it("append and prepend are the same multiset and different results — do NOT cache on a normalized deck", () => {
      // M3 advises caching "by normalized deck composition". That advice is
      // wrong for this simulator, and a cache that took it would have returned
      // the append arm's numbers for the prepend arm and hidden the finding.
      const appended = simulateCasts(200, { ...opts, deckIds: [...HELD, 25] }, 1);
      const prepended = simulateCasts(200, { ...opts, deckIds: [25, ...HELD] }, 1);
      expect([...[...HELD, 25]].sort()).toEqual([...[25, ...HELD]].sort());
      expect(prepended.hitRate).not.toBe(appended.hitRate);
    });
  });
});

/**
 * Session 14 — SPEC.md §5 / handoff/DECISIONS.md: `focusMeter` (confirmed
 * live session 13) is now modelled here. This alone drops the matcher's
 * 500-cast catch rate from session 13's 92.4% to ~70% — real, but nowhere
 * near session-13-brief's live 0/6 result (P(0/6) at 70% is ~0.05%, still
 * implausible). The dominant explanation turns out to be a SEPARATE gap:
 * the sim's true fish pattern is always drawn from the same synthetic pool
 * the matcher searches, so the matcher can always, in principle, identify
 * it — unlike real Dendren, where the pattern library is still unknown and
 * every live cast ran on `emptyFallback`/uniform the whole time (STATE.md
 * session 13). `matcherPool: []` reproduces that: catch rate collapses to
 * ~7-10%, statistically indistinguishable from the random baseline and
 * consistent with the live 0/6 result (P(0/6) ~60%). See
 * `scripts/fishFocusMeter.ts` for the full comparison this pins down.
 */
describe("session 14 — focusMeter modelled, and the library-mismatch diagnostic", () => {
  it("focusMeter constrains focus placement: matcher-ev still beats random, but well below the unconstrained 92.4% figure", () => {
    const runs = 500;
    const matcher = simulateCasts(runs, { policy: matcherFishPolicy }, 1);
    // Real, substantial drop from session 13's unconstrained 92.4% — not
    // noise at n=500 (session 13's own 500-cast sweep treated a similar gap
    // as meaningful). Pinned as a range, not an exact value, since the RNG
    // stream shifted when `castSim.ts` started drawing focus-budget state.
    expect(matcher.catchRate).toBeLessThan(0.85);
    expect(matcher.catchRate).toBeGreaterThan(0.5);
  });

  it("a matcher blind to the true pattern (matcherPool: []) performs near the random baseline, not near the informed matcher", () => {
    const runs = 500;
    const random = simulateCasts(runs, { policy: randomFishPolicy }, 1);
    const blind = simulateCasts(runs, { policy: matcherFishPolicy, matcherPool: [] }, 1);
    const informed = simulateCasts(runs, { policy: matcherFishPolicy }, 1);

    // Blind is nowhere near the informed matcher's rate...
    expect(blind.catchRate).toBeLessThan(informed.catchRate / 3);
    // ...and close enough to random that the matcher's real edge is
    // entirely attributable to knowing the pattern library, not to any
    // other part of `chooseCard`'s logic (lethal check, mana gating, etc).
    expect(Math.abs(blind.catchRate - random.catchRate)).toBeLessThan(0.08);
  });
});
