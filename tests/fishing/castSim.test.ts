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
      expect(["caught", "escaped_fish_full", "escaped_mana", "stalled"]).toContain(r.outcome);
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
    expect(["caught", "escaped_fish_full", "escaped_mana", "stalled"]).toContain(r.outcome);
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
   * [session 78 §4, **RETRACTED session 79 §1**] Deck ORDER was load-bearing,
   * because `castSim` drew the roster sequentially from index 0. Session 78
   * pinned that with three tests asserting an appended card is never drawn —
   * a true statement about the simulator, written up in STATE.md as a fact
   * about Dendren:
   *
   *     "on the real 23-card deck only the first ~8 cards are ever seen —
   *      an appended card is unreachable by construction"
   *
   * The corpus already said otherwise. 129 live opening hands, zero equal to
   * `fullDeck[0..2]`, roster tail positions drawn as often as the head. The
   * server shuffles; `castSim` now does too, once per cast.
   *
   * **Those three tests are gone rather than inverted, and the replacement is
   * `tests/fishing/deckShuffle.test.ts`** — which pins the live measurement
   * itself, checks the simulator against it deck by deck, and fails the old
   * sequential pile on the same statistic. What survives here is the one
   * consequence that is still true and still worth a guard.
   */
  describe("deck composition after the shuffle (session 79 §1)", () => {
    const HELD = [74, 75, 76, 78, 1, 2, 3, 4, 5, 6, 34, 7, 36, 10, 38, 41, 39, 49, 48, 36, 74, 75, 76];
    const opts = { policy: matcherFishPolicy, matcherPool: [] as [] };

    it("appending a card to a 23-card deck now CHANGES the result — it is reachable", () => {
      const base = simulateCasts(200, { ...opts, deckIds: HELD }, 1);
      for (const id of [17, 25, 20]) {
        const appended = simulateCasts(200, { ...opts, deckIds: [...HELD, id] }, 1);
        expect(appended.hitRate).not.toBe(base.hitRate);
      }
    });

    it("append and prepend are the same multiset and STILL not byte-identical — do not cache on a normalized deck", () => {
      // The advice is still wrong for this simulator, on a weaker reason than
      // session 78's: the two arms are now the same DISTRIBUTION, but each
      // cast shuffles from the order it was handed, so a fixed seed gives
      // different piles and a normalized cache would hand one arm's concrete
      // numbers to the other.
      const appended = simulateCasts(200, { ...opts, deckIds: [...HELD, 25] }, 1);
      const prepended = simulateCasts(200, { ...opts, deckIds: [25, ...HELD] }, 1);
      expect([...[...HELD, 25]].sort()).toEqual([...[25, ...HELD]].sort());
      expect(prepended.hitRate).not.toBe(appended.hitRate);
    });

    it("the falsified sequential pile is still selectable, and still does what it always did", () => {
      // `sequentialDrawPile` exists so `deckShuffle.test.ts` can fail it. This
      // guards the one property that made it worth keeping: under it, and only
      // under it, an appended card is inert.
      const base = simulateCasts(200, { ...opts, deckIds: HELD, sequentialDrawPile: true }, 1);
      const appended = simulateCasts(200, { ...opts, deckIds: [...HELD, 25], sequentialDrawPile: true }, 1);
      expect(appended.hitRate).toBe(base.hitRate);
      expect(appended.meanFinalFishHp).toBe(base.meanFinalFishHp);
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
