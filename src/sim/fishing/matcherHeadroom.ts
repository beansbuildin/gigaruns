/**
 * src/sim/fishing/matcherHeadroom.ts — [session 81 §1b, GATE 2] what the
 * matcher is worth, bracketed between a floor and a ceiling.
 *
 * ## The question this answers
 *
 * Session 80 localised the whole fishery gap to the HIT RATE: per-card damage
 * and heal amounts are right to within a tenth on every arm, and the hit rate
 * carries 96% of the drift discrepancy (`damageEconomy.ts`). Session 81 then
 * eliminated the other half of the hit rate — the zone geometry resolves the
 * server's own hit/miss on 612 of 612 recorded plays, exceptionless
 * (`zoneAudit.ts`). What is left is PREDICTION: the fish moves first and the
 * card resolves against the cell it moved to, so every point of the residual
 * belongs to guessing that cell.
 *
 * "The matcher could be better" is not actionable. This file makes it a
 * number, by scoring four policies on the SAME 612 plays with the SAME cards
 * and the SAME focus budget — only the choice of where to aim differs:
 *
 *  - **RANDOM** — uniform over the reachable focus set. The floor: what the
 *    board's geometry alone yields with no prediction whatsoever. Computed as
 *    the exact expectation (fraction of reachable cells that would have hit),
 *    not sampled, so it carries no seed and no noise.
 *  - **STAY-PUT** — never move the focus at all. Isolates how much of the
 *    matcher's work is *movement* rather than the zones being large.
 *  - **ACTUAL** — what the shipped bot did, straight off the corpus.
 *  - **ORACLE, same card** — the best reachable focus, knowing where the fish
 *    will be. The ceiling for prediction alone.
 *  - **ORACLE, best card in hand** — also free to pick the card. The extra
 *    over the previous row is what card SELECTION is worth, which is a
 *    different subsystem (`cardChoice.ts`).
 *
 * The oracles use knowledge no policy has at decision time. **They are a
 * ceiling to score against, never a policy to ship** — CLAUDE.md rule 4.
 *
 * ## The focus budget, and the thing that was wrong about the obvious model
 *
 * The reachable set is every cell within the focus budget's Manhattan reach of
 * the focus point the turn started on (`geometry.reachableCells`, confirmed
 * live session 13). The obvious budget is the pre-play state's `focusMeter` —
 * and it is WRONG on 12 of 612 plays, which move the focus FURTHER than that
 * meter allows. Under it the oracle calls 6 plays unhittable that the server
 * scored as HITS, i.e. a ceiling below the observed floor.
 *
 * The cause is not a rule violation, it is an OIL. `castTrace.ts` skips
 * `use_fishing_item` responses (they re-report their predecessor's state and
 * counting them breaks position continuity), so a Focus Oil restores the meter
 * between two consecutive recorded turns and the trace shows it rise with no
 * local cause — that file's header says so explicitly, and this is what it
 * costs downstream.
 *
 * So the budget is reconstructed from the transition itself, exactly:
 *
 *     budgetBefore = manhattan(a.focusPoint, b.focusPoint) + b.focusMeter
 *                    (what the move spent)  +  (what remained after it)
 *
 * This holds on **591 of 591** non-oil plays, and on the 21 oil plays it
 * recovers the restored budget rather than the stale one. It also makes the
 * measurement self-consistent by construction — the focus the bot actually
 * fired from is always inside the reachable set — and
 * `assertHeadroomSelfConsistent` THROWS if either invariant breaks, in the
 * spirit of `damageEconomy.ts`'s `assertShotsAccountedFor`. A ceiling that
 * sits below its own floor is exactly the kind of number that gets quoted for
 * three sessions before anyone re-derives it.
 *
 * ## ⚠ What the oil turns do NOT settle
 *
 * All 21 oil consumes recover an implied budget of exactly 2, and on all 21
 * the pre-play meter read 0. **The CORPUS alone cannot distinguish restore-to-2
 * from add-2**, because a restore to 2 and an addition of 2 are the same event
 * at a meter of 0, and no oil has yet been consumed at a non-zero meter.
 *
 * The STATIC TABLE breaks the tie, and points at add-2: SPEC-fishing §4a's
 * `gameItems[]` effect list declares `FishingRestoreFocus` as an AMOUNT per
 * tier — Lil 1 / Mid 2 / Big 3 — and `config/bot.json` spends item 942, the
 * MID Focus Oil, whose amount is exactly the 2 observed. Under restore-to-2
 * the tiering would be meaningless. So add-2 is the reading consistent with
 * both sources, and it is recorded rather than encoded: nothing here needs to
 * know, because the budget is read OFF the transition instead of predicted.
 * A Lil or Big consume, or any consume at a non-zero meter, confirms it
 * outright. (Same shape as session 80's `mana -= card.manaCost`, still open
 * for the same reason — one arm of a distinction has never been exercised.)
 *
 * ## A thing this measurement found rather than assumed
 *
 * `aimError` is `null` when every zone of the played card translated OFF the
 * board — the shot had no on-grid footprint and could not have hit wherever
 * the fish went. That is not a mispredicted shot, it is a structurally wasted
 * one, and it happens on **23 of 612 plays (3.8%)**, all of them misses. Card
 * 1's `hitZones` are `[1,2,3]`, the whole top row of the 3×3 template, so
 * firing it from row 1 of the grid puts all three zones at row 0. In **6** of
 * the 23 a different reachable focus would have hit with the SAME card, so
 * these are not forced.
 *
 * Reported, not fixed: this is a live-policy change and rule 4 puts it behind
 * a gate of its own. It is called out because a wasted play is invisible in
 * the hit rate — it looks exactly like a bad prediction, and it is not one.
 *
 * Pure: reads committed fixtures, writes nothing, no network, no `data/`.
 */

import type { CastTrace, CastTurn, TraceCard } from "./castTrace.js";
import { cellKey, manhattan, reachableCells, zonesToCells, type Cell } from "./geometry.js";

/**
 * Would this card, fired from this focus point, land on this cell? Crit zones
 * count as hits — a crit fires an ordinary `HIT` event and there is no `CRIT`
 * event type (session 47), which is the same convention `zoneAudit.ts` scores
 * under and `castSim.ts` resolves under.
 */
export function cardCovers(focus: Cell, card: Pick<TraceCard, "hitZones" | "critZones">, cell: Cell, gridSize: number): boolean {
  const key = cellKey(cell);
  for (const c of zonesToCells(focus, card.hitZones, gridSize)) if (cellKey(c) === key) return true;
  for (const c of zonesToCells(focus, card.critZones, gridSize)) if (cellKey(c) === key) return true;
  return false;
}

/**
 * The focus budget available before this play, reconstructed from the
 * transition rather than read off the stale pre-play meter. See the header for
 * why the obvious reading is wrong on the oil turns.
 */
export function budgetBefore(a: CastTurn, b: CastTurn): number {
  return manhattan(a.focusPoint, b.focusPoint) + b.focusMeter;
}

/** One scored play, kept so the aggregate can be audited rather than trusted. */
export interface HeadroomPlay {
  docId: string;
  turn: number;
  cardId: number;
  /** Reachable focus cells, given the reconstructed budget. Never empty — distance 0 is always reachable. */
  reachable: number;
  budget: number;
  /** True when the pre-play meter disagrees with the reconstructed budget, i.e. an oil landed between the states. */
  oilRestored: boolean;
  actualHit: boolean;
  /** Exact P(hit) if the focus were placed uniformly at random over `reachable`. */
  randomHitProb: number;
  stayPutHit: boolean;
  oracleSameCardHit: boolean;
  oracleBestCardHit: boolean;
  /**
   * Manhattan distance from the cell the shot's footprint came closest with,
   * to the fish's actual cell. 0 on a hit. `null` when every zone of the card
   * translated off-grid, so there was no footprint to measure from.
   */
  aimError: number | null;
}

export interface HeadroomResult {
  plays: number;
  casts: number;
  /** Plays where an oil restored the meter mid-transition. */
  oilRestored: number;
  random: number;
  stayPut: number;
  actual: number;
  oracleSameCard: number;
  oracleBestCard: number;
  /** (actual − random) / (oracleSameCard − random): the share of available prediction headroom the matcher captures. */
  capturedFraction: number;
  /** Percentage points of hit rate left on the table with today's cards and budget. */
  headroomRemaining: number;
  /** oracleBestCard − oracleSameCard: what card SELECTION is worth on top. */
  cardSelectionValue: number;
  /** aim error -> count, over every scored play. The §5 distribution. */
  aimErrorHist: Map<number, number>;
  /** aim error -> count, over MISSES only. */
  missAimErrorHist: Map<number, number>;
  /**
   * Plays whose card had NO on-grid footprint at all — every zone translated
   * off the board, so the shot could not hit whatever the fish did. A
   * structurally guaranteed miss, not a mispredicted one.
   */
  noFootprint: number;
  /**
   * Of those, the ones a different reachable focus would have turned into a
   * hit WITH THE SAME CARD — i.e. wasted plays that were not forced.
   */
  noFootprintAvoidable: number;
  perPlay: HeadroomPlay[];
}

/**
 * Scores the four policies over every play in the corpus.
 *
 * **The predicate, stated in full** (CLAUDE.md rule 6 — session 80 was sent
 * chasing a count whose filter lived only in a brief's scratch buffer, and
 * session 81's brief was sent chasing another): every state-to-state
 * transition whose resulting state carries a `play`, whose `play.handIndex`
 * resolves to a card id in the PRE-play hand, and whose id is present in the
 * cast's `deckCardData`. Nothing else is filtered — not clean traces, not
 * terminal plays, not oil casts. That is the identical predicate
 * `zoneAudit.ts` scores under, deliberately, so the two reports share a
 * denominator; on the committed corpus it is **612** plays.
 *
 * Card identification is by `play.handIndex` into the pre-play hand. Session
 * 81 cross-validated that against the independent discard set-difference —
 * which card newly appears in `discard` — and they agreed on 583 of the 590
 * plays then committed and disagreed on **none**, the remaining 7 being turns
 * where the discard moved by something other than exactly one card (a refill
 * boundary).
 */
export function matcherHeadroom(traces: readonly CastTrace[]): HeadroomResult {
  const perPlay: HeadroomPlay[] = [];
  const casts = new Set<string>();

  for (const t of traces) {
    for (let i = 1; i < t.turns.length; i++) {
      const cur = t.turns[i]!;
      const prev = t.turns[i - 1]!;
      if (!cur.play) continue;
      const cardId = prev.hand[cur.play.handIndex];
      if (cardId === undefined) continue;
      const card = t.cards.get(cardId);
      if (!card) continue;

      const g = cur.gridSize;
      const fish = cur.fishPosition;
      const budget = budgetBefore(prev, cur);
      const reach = reachableCells(g, prev.focusPoint, budget);

      let covering = 0;
      for (const f of reach) if (cardCovers(f, card, fish, g)) covering++;

      const hand: TraceCard[] = [];
      for (const id of prev.hand) {
        const c = t.cards.get(id);
        if (c) hand.push(c);
      }
      let bestCardHit = false;
      for (const c of hand) {
        if (reach.some((f) => cardCovers(f, c, fish, g))) {
          bestCardHit = true;
          break;
        }
      }

      // Aim error is measured from the focus the shot was ACTUALLY fired from
      // — it asks "how far off was this shot", not "how far off could it have
      // been". Crit zones included, same convention as `cardCovers`.
      const footprint = [
        ...zonesToCells(cur.focusPoint, card.hitZones, g),
        ...zonesToCells(cur.focusPoint, card.critZones, g),
      ];
      let aimError: number | null = null;
      for (const c of footprint) {
        const d = manhattan(c, fish);
        if (aimError === null || d < aimError) aimError = d;
      }

      casts.add(t.docId);
      perPlay.push({
        docId: t.docId,
        turn: i,
        cardId,
        reachable: reach.length,
        budget,
        oilRestored: budget !== prev.focusMeter,
        actualHit: cur.play.hit,
        randomHitProb: reach.length === 0 ? 0 : covering / reach.length,
        stayPutHit: cardCovers(prev.focusPoint, card, fish, g),
        oracleSameCardHit: covering > 0,
        oracleBestCardHit: bestCardHit,
        aimError,
      });
    }
  }

  const n = perPlay.length;
  const rate = (f: (p: HeadroomPlay) => number) => (n === 0 ? 0 : perPlay.reduce((s, p) => s + f(p), 0) / n);
  const random = rate((p) => p.randomHitProb);
  const actual = rate((p) => (p.actualHit ? 1 : 0));
  const oracleSameCard = rate((p) => (p.oracleSameCardHit ? 1 : 0));
  const oracleBestCard = rate((p) => (p.oracleBestCardHit ? 1 : 0));

  const aimErrorHist = new Map<number, number>();
  const missAimErrorHist = new Map<number, number>();
  for (const p of perPlay) {
    if (p.aimError === null) continue;
    aimErrorHist.set(p.aimError, (aimErrorHist.get(p.aimError) ?? 0) + 1);
    if (!p.actualHit) missAimErrorHist.set(p.aimError, (missAimErrorHist.get(p.aimError) ?? 0) + 1);
  }

  const noFootprintPlays = perPlay.filter((p) => p.aimError === null);

  return {
    plays: n,
    casts: casts.size,
    noFootprint: noFootprintPlays.length,
    noFootprintAvoidable: noFootprintPlays.filter((p) => p.oracleSameCardHit).length,
    oilRestored: perPlay.filter((p) => p.oilRestored).length,
    random,
    stayPut: rate((p) => (p.stayPutHit ? 1 : 0)),
    actual,
    oracleSameCard,
    oracleBestCard,
    capturedFraction: oracleSameCard === random ? 0 : (actual - random) / (oracleSameCard - random),
    headroomRemaining: oracleSameCard - actual,
    cardSelectionValue: oracleBestCard - oracleSameCard,
    aimErrorHist,
    missAimErrorHist,
    perPlay,
  };
}

/**
 * The two invariants the ceiling depends on, asserted rather than assumed.
 * Throws, in the spirit of `damageEconomy.ts`'s `assertShotsAccountedFor`:
 *
 *  1. the focus the bot actually fired from is inside the reachable set — if
 *     it is not, the budget model is wrong and every row is scored against a
 *     set the bot was not confined to;
 *  2. no play the server scored as a HIT is called unhittable by the
 *     same-card oracle — a ceiling below its own observed floor is not a
 *     ceiling.
 *
 * Both fail under the naive `prev.focusMeter` budget (10 and 5 respectively),
 * which is how the oil restore was found.
 */
export function assertHeadroomSelfConsistent(traces: readonly CastTrace[], result: HeadroomResult): void {
  const byKey = new Map<string, HeadroomPlay>();
  for (const p of result.perPlay) byKey.set(`${p.docId}#${p.turn}`, p);

  const outside: string[] = [];
  for (const t of traces) {
    for (let i = 1; i < t.turns.length; i++) {
      const p = byKey.get(`${t.docId}#${i}`);
      if (!p) continue;
      const cur = t.turns[i]!;
      const prev = t.turns[i - 1]!;
      if (manhattan(prev.focusPoint, cur.focusPoint) > p.budget) outside.push(`${t.docId}#${i}`);
    }
  }
  if (outside.length > 0) {
    throw new Error(
      `matcherHeadroom: ${outside.length} plays fired from a focus point outside the modelled reachable set ` +
        `(${outside.slice(0, 5).join(", ")}${outside.length > 5 ? ", …" : ""}). The focus-budget model is wrong — ` +
        `fix the predicate, do not adjust the number.`,
    );
  }

  const impossible = result.perPlay.filter((p) => p.actualHit && !p.oracleSameCardHit);
  if (impossible.length > 0) {
    throw new Error(
      `matcherHeadroom: the same-card oracle calls ${impossible.length} server-scored HITS unhittable ` +
        `(${impossible.slice(0, 5).map((p) => `${p.docId}#${p.turn}`).join(", ")}). A ceiling below its own floor ` +
        `means the reachable set is too small — see this file's header on the oil restore.`,
    );
  }
}
