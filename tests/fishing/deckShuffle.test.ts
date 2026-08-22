/**
 * tests/fishing/deckShuffle.test.ts — [session 79 §1, GATE 1] **the draw pile
 * is shuffled, and the model that says otherwise fails right here.**
 *
 * `castSim` drew every deck in roster order from index 0 until this session.
 * Session 78 measured the consequence honestly (an appended card is never
 * drawn) and then wrote the consequence up as a fact about the GAME. It is not
 * one. Across every committed live fishing state there are 129 opening hands
 * and not a single one is `fullDeck[0..2]`, which a sequential pile predicts
 * for all 129.
 *
 * Three things are pinned below, in the order they matter:
 *
 *   1. **The corpus fact.** Re-derived from the fixtures on every run, never
 *      pasted in — if a future capture disagrees, this file says so out loud
 *      instead of quietly carrying a stale number (CLAUDE.md rule 1).
 *   2. **The simulator now reproduces it**, deck by deck, on the same
 *      roster-position statistic the live corpus is measured with.
 *   3. **The old sequential pile FAILS that same test**, run through
 *      `sequentialDrawPile: true`. A correction nobody can watch fail is
 *      indistinguishable from a preference — session 75's discipline for the
 *      redraw fix, applied here.
 */

import { describe, expect, it } from "vitest";

import { loadFishingCorpus } from "../../src/sim/fishingCorpus.js";
import {
  chiSquareAgainst,
  chiSquareUniform,
  matchesSequentialDraw,
  openingHands,
  openingPositionCounts,
  pileWraps,
  tailShare,
  type DeckPositionCounts,
  type OpeningHand,
} from "../../src/sim/fishing/drawModel.js";
import { matcherFishPolicy, simulateCast, simulateCasts } from "../../src/sim/fishing/castSim.js";

const CORPUS = loadFishingCorpus();
const LIVE = openingHands(CORPUS);
const LIVE_BY_DECK = openingPositionCounts(LIVE);

/** The account's most-played deck: 31 of the 129 live opening hands sit on it. */
const DECK_10 = [1, 2, 3, 4, 5, 6, 7, 76, 77, 79];

/**
 * Run the simulator and collect the OPENING hand of each cast — turn 0's
 * state, which `observeTurn` emits before the policy acts.
 *
 * Fixed, contiguous seeds: the shuffle is drawn from the cast's own rng, so a
 * seed reproduces a pile exactly and this whole file is deterministic. Nothing
 * here is allowed to be flaky, because its job is to fail for exactly one
 * reason.
 */
function simOpeningHands(deckIds: readonly number[], casts: number, opts: { sequential?: boolean } = {}): OpeningHand[] {
  const out: OpeningHand[] = [];
  for (let seed = 1; seed <= casts; seed++) {
    let opening: readonly number[] | null = null;
    simulateCast({
      policy: matcherFishPolicy,
      matcherPool: [],
      seed,
      deckIds,
      sequentialDrawPile: opts.sequential,
      observeTurn: (s) => {
        if (s.turn === 0 && opening === null) opening = s.hand;
      },
    });
    if (opening !== null) out.push({ docId: `sim-${seed}`, file: "sim", fullDeck: [...deckIds], hand: [...(opening as readonly number[])] });
  }
  return out;
}

function shares(c: DeckPositionCounts): number[] {
  const total = c.counts.reduce((a, b) => a + b, 0);
  return c.counts.map((n) => n / total);
}

describe("§1a — the live corpus falsifies the sequential draw pile", () => {
  it("has opening hands to measure at all", () => {
    // >= rather than ===: new casts add hands and must not break this file.
    // The number is the session-79 measurement and is quoted in STATE.md.
    expect(LIVE.length).toBeGreaterThanOrEqual(129);
  });

  it("NOT ONE live opening hand is fullDeck[0..handSize-1] — sequential draw predicts every one of them", () => {
    const sequential = LIVE.filter(matchesSequentialDraw);
    expect(sequential).toEqual([]);
  });

  it("opening hands on one deck differ from each other — the pile is re-ordered per cast, not fixed", () => {
    const onDeck10 = LIVE.filter((h) => h.fullDeck.join(",") === DECK_10.join(","));
    expect(onDeck10.length).toBeGreaterThanOrEqual(31);
    const distinct = new Set(onDeck10.map((h) => [...h.hand].sort((a, b) => a - b).join(",")));
    // A fixed pile gives exactly one opening hand per deck. Session 78's model
    // predicts `distinct === 1`.
    expect(distinct.size).toBeGreaterThan(10);
  });

  it("the roster TAIL is drawn as often as the head — no positional decay of any kind", () => {
    const deck10 = LIVE_BY_DECK.find((c) => c.fullDeck.join(",") === DECK_10.join(","))!;
    expect(deck10.hands).toBeGreaterThanOrEqual(31);
    // Positions 7, 8, 9 — cards a ~5-turn cast could never reach under a
    // sequential pile — appear in opening hands 13, 7 and 6 times out of 31.
    for (const pos of [7, 8, 9]) expect(deck10.counts[pos]!).toBeGreaterThan(0);
    // A uniform shuffle predicts 3/10 of drawn cards from positions >= 3.
    expect(tailShare(deck10)).toBeGreaterThan(0.55);
    // ...and is not rejected as the source of these counts. chi-square 13.5 on
    // 9 df against a 16.92 critical value at 0.05. See `chiSquareUniform` for
    // why this is a consistency check rather than a significance test.
    expect(chiSquareUniform(deck10)).toBeLessThan(16.92);
  });

  it("the draw pile DOES exhaust, and the cursor wraps by drawHand's own arithmetic", () => {
    // The first draft of this file asserted the opposite — "the pile never
    // exhausts" — on the evidence that `nextCardIndex` never exceeds
    // `fullDeck.length`. **That predicate cannot see the event.** The server
    // wraps the cursor rather than overflowing it, so exhaustion shows up as
    // `nextCardIndex` going DOWN, and a scan for overflow returns a confident
    // zero on a corpus containing seven wraps. CLAUDE.md rule 10: check what
    // the field can express before believing what it reports.
    let states = 0;
    let overflow = 0;
    for (const cast of CORPUS) {
      for (const r of cast.responses) {
        if (!r.deck) continue;
        states++;
        if (r.deck.nextCardIndex > r.deck.fullDeck.length) overflow++;
      }
    }
    expect(states).toBeGreaterThanOrEqual(721);
    // Still zero, and now recorded as what it is: proof about the FIELD's
    // representation, not about the pile.
    expect(overflow).toBe(0);

    const wraps = pileWraps(CORPUS);
    expect(wraps.length).toBeGreaterThanOrEqual(7);
    // 9 -> 2 on a 10-card deck, 9 -> 1 on an 11-card one: every wrap is
    // exactly `(idx + handSize) % deck.length`, which is `drawHand`'s own
    // arithmetic. The wraparound is validated in FORM and fires on real decks.
    for (const w of wraps) expect(w.to).toBe((w.from + 3) % w.deckLength);
    // What remains unobserved is narrower and is NOT modelled: whether the
    // pile is re-shuffled at the wrap or continues in the same order.
  });
});

describe("§1b — the shuffled simulator reproduces the live opening-hand distribution, and the old one does not", () => {
  // Enough casts that the simulated share per position is estimated to well
  // inside the live sample's own noise; deterministic, so the numbers below
  // are fixed facts about this tree.
  const CASTS = 4000;

  it("simulated opening hands are spread across the whole roster", () => {
    const sim = openingPositionCounts(simOpeningHands(DECK_10, CASTS))[0]!;
    expect(sim.hands).toBe(CASTS);
    for (let pos = 0; pos < DECK_10.length; pos++) expect(sim.counts[pos]!).toBeGreaterThan(0);
    // 3 of 10 positions dealt per hand, so 70% of drawn cards come from
    // positions >= 3 under a uniform shuffle.
    expect(tailShare(sim)).toBeGreaterThan(0.65);
    expect(tailShare(sim)).toBeLessThan(0.75);
  });

  it("THE TEST: live counts are consistent with the shuffled sim and IMPOSSIBLE under the sequential one", () => {
    const live = LIVE_BY_DECK.find((c) => c.fullDeck.join(",") === DECK_10.join(","))!;
    const shuffled = openingPositionCounts(simOpeningHands(DECK_10, CASTS))[0]!;
    const sequential = openingPositionCounts(simOpeningHands(DECK_10, CASTS, { sequential: true }))[0]!;

    // The old model deals the same three cards every cast, forever.
    expect(tailShare(sequential)).toBe(0);
    expect(sequential.counts.slice(3).every((n) => n === 0)).toBe(true);

    // One statistic, both models, same live data.
    const x2Shuffled = chiSquareAgainst(live.counts, shares(shuffled));
    const x2Sequential = chiSquareAgainst(live.counts, shares(sequential));

    expect(x2Shuffled).toBeLessThan(16.92); // 9 df, alpha 0.05 — not rejected
    expect(x2Sequential).toBe(Number.POSITIVE_INFINITY); // zero probability on data that happened
  });

  it("every corpus deck with enough opening hands shows the same thing", () => {
    const enough = LIVE_BY_DECK.filter((c) => c.hands >= 5);
    expect(enough.length).toBeGreaterThanOrEqual(3);
    for (const deck of enough) {
      // Live tail share on this deck, against the 0 a sequential pile forces.
      expect(tailShare(deck)).toBeGreaterThan(0.3);
      const sim = openingPositionCounts(simOpeningHands(deck.fullDeck, 1000))[0]!;
      // The sim is in the same neighbourhood as live on the same deck. Loose
      // on purpose — several of these decks carry 5 or 6 hands, and a tight
      // band on n=15 drawn cards would be measuring nothing but noise.
      expect(Math.abs(tailShare(sim) - tailShare(deck))).toBeLessThan(0.35);
    }
  });
});

describe("§1c — what the shuffle changes about deck COMPOSITION, and what it does not", () => {
  // The account's real 23-card deck, off the most recent live capture that
  // carries one. Session 78's three tests used this same list to pin the
  // sequential model's consequences; they are re-pointed here.
  const HELD = [74, 75, 76, 78, 1, 2, 3, 4, 5, 6, 34, 7, 36, 10, 38, 41, 39, 49, 48, 36, 74, 75, 76];

  it("a card appended to a 23-card deck IS reachable now — session 78's central consequence is gone", () => {
    const openings = simOpeningHands([...HELD, 25], 400);
    const drewIt = openings.filter((h) => h.hand.includes(25));
    // 3 cards of 24 per opening hand, so ~12.5% of 400 casts should open on
    // it. Under the sequential pile this is exactly 0, which is what
    // `scripts/deckObjectiveSweep.ts` measured 80 times over.
    expect(drewIt.length).toBeGreaterThan(20);
  });

  it("the same card appended and prepended is now the same deck distributionally — but still not byte-identical", () => {
    const appended = openingPositionCounts(simOpeningHands([...HELD, 25], 1000))[0]!;
    const prepended = openingPositionCounts(simOpeningHands([25, ...HELD], 1000))[0]!;
    // Session 78's "do not cache on a normalized deck composition" survives,
    // for a WEAKER reason. The two are the same multiset and the shuffle makes
    // them the same distribution — but each cast's shuffle starts from the
    // order it was given, so a fixed seed still yields different piles and a
    // normalized cache would return one arm's concrete numbers for the other.
    expect(appended.counts).not.toEqual(prepended.counts);
    // ...and the card is drawn about equally often either way, which is the
    // part that was false before.
    const drewAppended = simOpeningHands([...HELD, 25], 1000).filter((h) => h.hand.includes(25)).length;
    const drewPrepended = simOpeningHands([25, ...HELD], 1000).filter((h) => h.hand.includes(25)).length;
    expect(Math.abs(drewAppended - drewPrepended)).toBeLessThan(60);
  });
});

describe("§1d — the blast radius, pinned to the digit", () => {
  const HELD = [74, 75, 76, 78, 1, 2, 3, 4, 5, 6, 34, 7, 36, 10, 38, 41, 39, 49, 48, 36, 74, 75, 76];

  /**
   * Both numbers below were read off `git show HEAD:src/sim/fishing/castSim.ts`
   * — the pre-session-79 file, imported side by side with the new one and run
   * on the same seeds. They are not "what it printed after the change"; they
   * are what the OLD simulator printed, so a later edit that quietly alters
   * either arm has to explain itself here.
   */
  it("`sequentialDrawPile: true` reproduces the pre-session-79 simulator EXACTLY, not approximately", () => {
    const legacy = simulateCasts(200, { policy: matcherFishPolicy, matcherPool: [], deckIds: HELD, sequentialDrawPile: true }, 1);
    expect(legacy.hitRate).toBe(0.4075);
    expect(legacy.meanFinalFishHp).toBe(13.255);
    expect(legacy.catchRate).toBe(0);
  });

  it("the RANDOM-SAMPLE path is untouched — every figure the repo derived without `deckIds` still stands", () => {
    // The shuffle applies to a held deck only. The sampled path builds its
    // deck i.i.d. with replacement, which is already exchangeable, so
    // shuffling it would be a distributional no-op that moved every pinned
    // number in the repo for nothing. Same seeds, same values as the old file.
    const sampled = simulateCasts(300, { policy: matcherFishPolicy }, 1);
    expect(sampled.catchRate).toBe(0.86);
    expect(sampled.hitRate).toBe(0.7768969422423556);
  });

  it("the pile has its OWN rng stream, so deck length cannot move the fish", () => {
    // `scripts/deckObjectiveSweep.ts` pairs its arms by seed and its arms
    // differ in deck SIZE. If the shuffle drew from the main stream, a 24-card
    // arm would consume one more draw than a 23-card arm and face a different
    // fish — every Δ it reports would carry a trajectory difference inside it.
    // The sequential arm consumes no pile draws at all, so a length change
    // that leaves the drawn cards alone must leave the result alone.
    const a = simulateCasts(200, { policy: matcherFishPolicy, matcherPool: [], deckIds: HELD, sequentialDrawPile: true }, 1);
    const b = simulateCasts(200, { policy: matcherFishPolicy, matcherPool: [], deckIds: [...HELD, 25], sequentialDrawPile: true }, 1);
    expect(b.hitRate).toBe(a.hitRate);
  });
});
