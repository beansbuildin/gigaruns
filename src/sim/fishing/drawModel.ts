/**
 * src/sim/fishing/drawModel.ts — [session 79 §1] **how the draw pile is
 * ordered, and the corpus measurement that settles it.**
 *
 * ── WHAT WAS WRONG ────────────────────────────────────────────────────────
 *
 * `castSim`'s `drawHand` walks `deck[idx % deck.length]` starting at index 0.
 * That makes the deck's ROSTER order the pile order: the simulated bot always
 * opens on the same three cards, always draws the same next three, and a card
 * at the end of a long deck is never reached inside a ~5-turn cast.
 *
 * Session 78 measured that faithfully (80 appended candidates, all byte-
 * identical to baseline) and then generalised it one step too far — into
 * STATE.md's claim that on the real 23-card deck "only the first ~8 cards are
 * ever seen — an appended card is unreachable by construction". That is a
 * property of `drawHand`. It is not a property of Dendren.
 *
 * ── WHAT THE CORPUS SAYS ──────────────────────────────────────────────────
 *
 * Measured over every committed live fishing state (`openingHands` below,
 * re-derived on every test run rather than pasted in):
 *
 *     opening hands examined                        129
 *     hand === fullDeck[0..2]                         0   ← sequential predicts 129
 *     states with nextCardIndex > fullDeck.length      0   ← the pile never exhausts
 *
 * On the single most-played deck `[1,2,3,4,5,6,7,76,77,79]`, 31 opening hands
 * by roster position:
 *
 *     pos          0    1    2    3    4    5    6    7    8    9
 *     in opening  13    8    5   16    6   10    7   13    7    6    / 31
 *
 * The tail positions 7/8/9 appear 13, 7 and 6 times. There is no positional
 * decay of any kind, and a uniform shuffle is not rejected (chi-square 13.5 on
 * 9 df against a 16.92 critical value — see `chiSquareUniform` for why that
 * statistic is a consistency check and not a proof).
 *
 * **The server shuffles.** `fullDeck` is a roster; `nextCardIndex` indexes a
 * hidden shuffled pile that is never put on the wire.
 *
 * ── WHAT IS AND IS NOT MEASURED ───────────────────────────────────────────
 *
 * - **Per-cast vs per-draw shuffle is NOT distinguished by this corpus.** Both
 *   reproduce the opening-hand statistics above. Per-cast is the simpler
 *   hypothesis and is the one that matches `nextCardIndex` advancing 3, 6, 9
 *   through a pile rather than re-randomising each draw, so that is what is
 *   implemented — but it was chosen, not measured.
 * - **The pile DOES exhaust, and the cursor WRAPS — corrected the same day it
 *   was written.** The first draft of this file said "the pile never exhausts"
 *   on the evidence that `nextCardIndex` never exceeds `fullDeck.length` in the
 *   corpus. That predicate cannot see the event: the server wraps the cursor
 *   rather than letting it overflow, so exhaustion shows up as `nextCardIndex`
 *   going DOWN. It does so in **7 of 131 casts** — 9 -> 2 on a 10-card deck,
 *   9 -> 1 on an 11-card one — which is exactly `(idx + handSize) %
 *   deck.length`, `drawHand`'s own arithmetic. So the wraparound is validated
 *   in FORM and it fires on real decks. `pileWraps` re-derives it.
 *
 *   This is CLAUDE.md rule 10 in miniature: counting a field that cannot
 *   express the event and reading the zero as an answer. What is still
 *   unobserved is narrower — whether the pile is RE-SHUFFLED at the wrap or
 *   continues in the same order. Nothing here models that either way.
 * - **Where a LOOTED card lands in the roster is unobserved.** It does not
 *   matter to the pile order under a shuffle, which is exactly why session
 *   78's CAPTURE-3 could be closed rather than spent on.
 */

import type { Rng } from "../rng.js";
import type { FishingCast } from "../fishingCorpus.js";

/**
 * Fisher-Yates, in place, from a seeded `Rng`. Returned for call-site
 * convenience; the array passed in IS the shuffled one.
 *
 * In place and unbiased both matter here: `simulateCast` shuffles the pile it
 * is about to draw from, and a biased shuffle (the sort-by-random idiom, say)
 * would leave a positional signature that the validation test is specifically
 * built to detect.
 */
export function shuffleInPlace<T>(xs: T[], rng: Rng): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = xs[i]!;
    xs[i] = xs[j]!;
    xs[j] = tmp;
  }
  return xs;
}

/** One live observation of a cast's opening hand: the roster, and what was held. */
export interface OpeningHand {
  docId: string;
  file: string;
  fullDeck: number[];
  hand: number[];
}

/**
 * Every state in the corpus that is a cast's OPENING hand, i.e. the pile has
 * been read exactly as far as the hand is wide (`nextCardIndex === hand.length`).
 *
 * Why this predicate and not "the first state of a cast": a cast's responses
 * are not guaranteed to start at turn 0 (a killed-and-resumed process writes
 * later turns into a different directory — `fishingCorpus.ts`'s header), and
 * the opening hand is the only draw whose composition can be compared against
 * the roster without knowing what was discarded first. `nextCardIndex` is the
 * server's own read cursor, so it identifies the opening draw exactly.
 */
export function openingHands(casts: readonly FishingCast[]): OpeningHand[] {
  const out: OpeningHand[] = [];
  for (const cast of casts) {
    for (const r of cast.responses) {
      const d = r.deck;
      if (!d || d.hand.length === 0) continue;
      if (d.nextCardIndex !== d.hand.length) continue;
      out.push({ docId: cast.docId, file: r.file, fullDeck: d.fullDeck, hand: d.hand });
    }
  }
  return out;
}

/**
 * Does this hand match what a sequential-from-index-0 pile would have dealt?
 *
 * This is the discriminating predicate, and it is a SUPPORT test rather than a
 * distributional one: the sequential model assigns probability 1 to exactly
 * one opening hand per deck and probability 0 to every other, so a single
 * counterexample falsifies it outright. The shuffled model assigns positive
 * probability to every sub-multiset of the roster, so it survives all 129 —
 * which is a weaker claim, honestly stated, and the reason the position
 * distribution below is checked as well.
 */
export function matchesSequentialDraw(h: OpeningHand): boolean {
  const head = h.fullDeck.slice(0, h.hand.length);
  return head.length === h.hand.length && head.every((c, i) => c === h.hand[i]);
}

/**
 * Counts, per roster position, how often that position's card appeared in an
 * opening hand — grouped by deck, since positions only mean something within
 * one roster.
 *
 * Duplicate card ids (real decks hold three copies of card 11, and the 23-card
 * deck repeats 36/38/74/75/76) are consumed position-by-position: each held
 * card claims the first unclaimed matching position. That under-counts nothing
 * and cannot manufacture a tail hit, which is the direction that matters — a
 * spurious tail hit is what would falsely rescue the shuffle hypothesis.
 */
export interface DeckPositionCounts {
  fullDeck: number[];
  hands: number;
  handSize: number;
  counts: number[];
}

export function openingPositionCounts(hands: readonly OpeningHand[]): DeckPositionCounts[] {
  const byDeck = new Map<string, DeckPositionCounts>();
  for (const h of hands) {
    const key = h.fullDeck.join(",");
    let rec = byDeck.get(key);
    if (!rec) {
      rec = { fullDeck: h.fullDeck, hands: 0, handSize: h.hand.length, counts: new Array(h.fullDeck.length).fill(0) };
      byDeck.set(key, rec);
    }
    rec.hands++;
    const claimed = new Set<number>();
    for (const card of h.hand) {
      for (let i = 0; i < h.fullDeck.length; i++) {
        if (h.fullDeck[i] === card && !claimed.has(i)) {
          claimed.add(i);
          rec.counts[i]!++;
          break;
        }
      }
    }
  }
  return [...byDeck.values()].sort((a, b) => b.hands - a.hands);
}

/**
 * Pearson chi-square of observed position counts against the flat expectation
 * a uniform shuffle gives (`hands * handSize / deckLength` per position).
 *
 * **Stated limit, because the number gets quoted:** the three cards of one
 * opening hand are drawn WITHOUT replacement, so the per-position counts
 * within a hand are not independent and this statistic is not exactly
 * chi-square distributed. It is used as a consistency check — "is there a
 * positional gradient of the size sequential draw would produce" — not as a
 * significance test. The falsification of sequential draw rests on
 * `matchesSequentialDraw`'s 0/129, which needs no distributional assumption.
 */
export function chiSquareUniform(c: DeckPositionCounts): number {
  const expected = (c.hands * c.handSize) / c.fullDeck.length;
  if (expected <= 0) return Number.NaN;
  let x2 = 0;
  for (const o of c.counts) x2 += ((o - expected) ** 2) / expected;
  return x2;
}

/**
 * Pearson chi-square of observed position counts against a model's predicted
 * SHARE per position (shares must sum to 1).
 *
 * `Infinity` when the model gives a position zero probability and the data has
 * a card there. That is not a numerical guard — it is the result: a model that
 * assigns probability zero to something that happened is refuted outright, and
 * this is the value the sequential draw pile returns against every live deck
 * with a hand outside its first `handSize` positions.
 *
 * Same stated limit as `chiSquareUniform`: draws within one hand are without
 * replacement and therefore not independent, so this is a consistency
 * statistic, not a significance test.
 */
export function chiSquareAgainst(counts: readonly number[], expectedShares: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  let x2 = 0;
  for (let i = 0; i < counts.length; i++) {
    const e = (expectedShares[i] ?? 0) * total;
    const o = counts[i]!;
    if (e === 0) {
      if (o > 0) return Number.POSITIVE_INFINITY;
      continue;
    }
    x2 += ((o - e) ** 2) / e;
  }
  return x2;
}

/**
 * The share of drawn cards that came from roster positions at or beyond
 * `handSize` — i.e. from outside the block a sequential-from-zero pile would
 * deal on the opening hand.
 *
 * The sharpest single number separating the two draw models, and the one with
 * the least distributional baggage: a sequential pile scores exactly 0 by
 * construction, a uniform shuffle scores `1 - handSize/deckLength`, and the
 * live corpus scores what it scores.
 */
export function tailShare(c: DeckPositionCounts): number {
  const total = c.counts.reduce((a, b) => a + b, 0);
  if (total === 0) return Number.NaN;
  let tail = 0;
  for (let i = c.handSize; i < c.counts.length; i++) tail += c.counts[i]!;
  return tail / total;
}

/** One observed exhaustion of the draw pile: the server's cursor wrapping. */
export interface PileWrap {
  docId: string;
  deckLength: number;
  from: number;
  to: number;
}

/**
 * Every point in the corpus where `nextCardIndex` DECREASED inside one cast.
 *
 * The right detector, and the reason matters more than the function. Exhaustion
 * does not appear as `nextCardIndex > fullDeck.length` — the server wraps the
 * cursor instead of overflowing it — so a scan for overflow returns zero on a
 * corpus that contains seven wraps, and reads as "the pile never exhausts".
 * That reading survived one draft of this file. Check what the field can
 * express before believing what it reports (CLAUDE.md rule 10).
 *
 * Ordered by `updatedAt`, the server's own stamp: a cast's responses are not
 * guaranteed to arrive in turn order (`fishingCorpus.ts`'s header), and a
 * decrease is only meaningful along real time.
 */
export function pileWraps(casts: readonly FishingCast[]): PileWrap[] {
  const out: PileWrap[] = [];
  for (const cast of casts) {
    const rows = cast.responses
      .filter((r) => r.deck !== null)
      .slice()
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.deck!;
      const cur = rows[i]!.deck!;
      if (cur.nextCardIndex < prev.nextCardIndex) {
        out.push({ docId: cast.docId, deckLength: cur.fullDeck.length, from: prev.nextCardIndex, to: cur.nextCardIndex });
      }
    }
  }
  return out;
}
