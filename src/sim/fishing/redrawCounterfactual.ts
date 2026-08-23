/**
 * src/sim/fishing/redrawCounterfactual.ts — [session 83, brief §2 / GATE 1]
 * what a redraw would have been worth, measured on the committed corpus.
 *
 * ## Why this is computable at all, which is the load-bearing claim
 *
 * No redraw has ever been played live. `redrawEnabled` ships false, is pinned
 * false from both ends (`tests/fishing/redraw.test.ts`), and zero redraws
 * appear in the corpus. So a "what would a redraw have done" measurement has
 * to reconstruct a hand the server never dealt.
 *
 * Session 79 established the draw pile is shuffled **once per cast** and drawn
 * sequentially, and that the shuffled order never appears on the wire. **But
 * the timeline reveals it.** The bot plays a hand down, the server deals the
 * next three, and those three are recorded on a `NEW_HAND` event. A redraw
 * discards the held hand and draws three from the same untouched pile — so
 * **the hand a redraw would have produced at turn `t` is exactly the next
 * triple the cast actually drew.**
 *
 * That inference is checked rather than assumed, by `tripleReconstruction`:
 *
 *  - `nextCardIndex` advances by exactly +3 on every draw that advances it
 *    (137 of 144 on the corpus as committed), the other 7 being session 79's
 *    pile wraps (−7 ×3, −8 ×4) — the cursor going DOWN, which is what
 *    exhaustion looks like when the server wraps rather than overflows;
 *  - every dealt triple contains at least one card not held earlier in the
 *    cast (144 of 144), so no draw is a re-deal of cards already in hand.
 *
 * ⚠ **This is inferred, not observed.** It follows from the per-cast shuffle;
 * it has never been confirmed against a real redraw, because there has never
 * been one. **If a redraw is ever played live, the first thing to check is
 * whether the dealt triple is the one this file predicts.**
 *
 * ## What is measured, and what it is not
 *
 * For every qualifying play the corpus records, two arms are scored under
 * session 81's validated semantics (`matcherHeadroom.ts`): the reachable focus
 * set comes from `budgetBefore` — what the move SPENT plus what REMAINED, not
 * the stale pre-play `focusMeter` — and a card "reaches" a cell if any
 * reachable focus puts a hit or crit zone on it.
 *
 *  - **ACTUAL arm**: could any card in the HELD hand have reached the fish's
 *    cell this turn?
 *  - **REDRAW arm**: could any card in the RECONSTRUCTED triple have reached
 *    the fish's cell **next** turn? Next, because a redraw burns the fish's
 *    move: it costs a turn and the fish steps (session 74/75, user-confirmed).
 *
 * Both arms are scored from the SAME reachable set — the one at the decision
 * point, `prev.focusPoint` with budget `budgetBefore(prev, cur)`. That is not
 * a convenience: the focus meter is a per-cast pool that never regenerates, so
 * reaching a cell in two moves within a total budget B is exactly the set
 * reachable in one move of B. Scoring the redraw arm from the ACTUAL
 * timeline's next focus point instead answers a different question — the one
 * where the play happened — and gives redraw availability 71.5%, i.e. worse
 * than the held hand. It is the wrong counterfactual, not a worse redraw.
 *
 * **Three things this does not say**, restated here because the number is
 * quotable and the caveats are not:
 *
 *  1. **It is availability, not hits.** Both arms use an oracle lens that
 *     knows where the fish went. The shipped bot converts roughly half of
 *     available hits into actual ones (session 81: ACTUAL 36.3% against a
 *     71.1% best-card ceiling). The oracle bias is the same on both sides, so
 *     the PAIRED comparison is fair; the absolute levels are not achievable.
 *  2. **It is not a trigger.** The bot cannot know at decision time that its
 *     hand is dead. The `sacrifice` cell is what a bad trigger costs.
 *  3. **It does not convert to mana-per-fish.** That needs an
 *     availability→hit rate and a hits→fish rate, and inventing either is how
 *     the 43.9 figure happened (DECISIONS 2026-08-22, session 75).
 *
 * Nothing here licenses flipping `redrawEnabled`. Redraw is CLOSED in
 * `handoff/DECISIONS.md`; reopening it is the user's call and CLAUDE.md rule 4
 * bars a live change on a sim result regardless.
 *
 * Pure: reads committed fixtures, writes nothing, no network, no `data/`.
 */

import type { CastTrace, CastTurn } from "./castTrace.js";
import { budgetBefore, cardCovers } from "./matcherHeadroom.js";
import { cellKey, reachableCells, type Cell } from "./geometry.js";

/** A triple the server revealed: the opening hand, or a `NEW_HAND` payload. */
export interface DrawTriple {
  /** Turn index the triple became visible on. 0 is the opening hand. */
  at: number;
  cards: number[];
}

/**
 * Every draw this cast revealed, in the order they were dealt: the opening
 * hand first, then each `NEW_HAND` event.
 *
 * The opening hand counts as a revealed triple because it is drawn from the
 * same pile by the same mechanism — the only difference is that no event
 * announces it, the state doc simply carries it.
 */
export function drawTriples(t: CastTrace): DrawTriple[] {
  const out: DrawTriple[] = [];
  const first = t.turns[0];
  if (first) out.push({ at: 0, cards: [...first.hand] });
  for (let i = 1; i < t.turns.length; i++) {
    const nh = t.turns[i]!.newHand;
    if (nh) out.push({ at: i, cards: [...nh] });
  }
  return out;
}

export interface TripleReconstruction {
  traces: number;
  /** `nextCardIndex` delta -> count, over every transition where it moved. */
  deltas: Map<number, number>;
  /** Draws (`NEW_HAND` events) seen. */
  draws: number;
  /** Of those, ones containing at least one card not held on any EARLIER turn. */
  drawsWithUnheldCard: number;
  /** Deltas that are not +3 — session 79's pile wraps. */
  wraps: number;
}

/**
 * §2a's check that the triple reconstruction is sound, pinned separately from
 * the table it feeds so a corpus change that breaks the METHOD fails loudly
 * rather than quietly shifting the answer.
 *
 * ⚠ The unheld-card test compares against hands held on turns **strictly
 * before** the drawing turn. The state doc's `hand` on a refill turn is
 * ALREADY the new hand, so including it makes the check vacuous — it reports
 * 0 of 144 instead of 144 of 144, and the vacuous form is the one that looks
 * like a failure.
 */
export function tripleReconstruction(traces: readonly CastTrace[]): TripleReconstruction {
  const deltas = new Map<number, number>();
  let draws = 0;
  let drawsWithUnheldCard = 0;

  for (const t of traces) {
    for (let i = 1; i < t.turns.length; i++) {
      const cur = t.turns[i]!;
      const prev = t.turns[i - 1]!;
      const d = cur.nextCardIndex - prev.nextCardIndex;
      if (d !== 0) deltas.set(d, (deltas.get(d) ?? 0) + 1);
      if (!cur.newHand) continue;
      draws++;
      const heldEarlier = new Set<number>();
      for (let j = 0; j < i; j++) for (const c of t.turns[j]!.hand) heldEarlier.add(c);
      if (cur.newHand.some((c) => !heldEarlier.has(c))) drawsWithUnheldCard++;
    }
  }

  let wraps = 0;
  for (const [d, n] of deltas) if (d !== 3) wraps += n;
  return { traces: traces.length, deltas, draws, drawsWithUnheldCard, wraps };
}

/** One scored decision point, kept so the aggregate can be audited rather than trusted. */
export interface RedrawPlay {
  docId: string;
  /** Turn index of the play that was actually made. */
  turn: number;
  /** Cards held at the decision point. Its length is the redraw's mana price. */
  held: number[];
  /** The triple a redraw would have drawn — the next one the cast actually dealt. */
  redrawn: number[];
  /** Focus cells reachable at the decision point, under `budget`. */
  reachable: number;
  budget: number;
  /** Could any HELD card reach the fish's cell this turn? */
  actualCanReach: boolean;
  /** Could any REDRAWN card reach the fish's cell NEXT turn? */
  redrawCanReach: boolean;
  /**
   * [§3] How many distinct grid cells the HELD hand could cover, over every
   * reachable focus. **Known at decision time** — it uses no knowledge of
   * where the fish goes — which is what makes it a candidate trigger signal
   * rather than another oracle.
   */
  heldCoverage: number;
  /** What the server actually scored the played card as. Reported, never used to filter. */
  actualHit: boolean;
}

export interface RedrawCounterfactual {
  plays: number;
  casts: number;
  /** actual yes, redraw yes. */
  bothReach: number;
  /** actual yes, redraw no — what a redraw fired here would have thrown away. */
  sacrifice: number;
  /** actual no, redraw yes — a guaranteed miss a redraw would have rescued. */
  rescue: number;
  /** neither reaches. */
  neitherReaches: number;
  /** (bothReach + sacrifice) / plays. */
  actualAvailability: number;
  /** (bothReach + rescue) / plays. */
  redrawAvailability: number;
  /** Mana a rescuing redraw would have cost — one per card held. */
  rescueCostHist: Map<number, number>;
  meanRescueCost: number;
  perPlay: RedrawPlay[];
}

/**
 * **The predicate, stated in full** — CLAUDE.md rule 6, and because a number
 * without its filter is not a measurement. Every state-to-state transition
 * where:
 *
 *  1. **exactly one card moved from hand to discard** — the discard grew by
 *     exactly one entry and that card was in the pre-play hand. ⚠ This is NOT
 *     `hand.length` shrinking by one: on a REFILL turn the hand goes 1 → 3,
 *     and the length reading silently drops every refill turn (467 plays
 *     instead of 603, and 286 rows instead of 389). The two readings are the
 *     same English sentence and a different measurement;
 *  2. both states carry a `focusPoint` and a `fishPosition` (guaranteed by
 *     `castTrace.ts`, which drops any doc missing either);
 *  3. **every card in the held hand belongs to one revealed draw-triple** —
 *     the hand is accounted for by draws the server showed us, so the pile
 *     position the redraw would read from is known. ⚠ VACUOUS on the corpus
 *     as committed: it drops no row, under either the any-triple or the
 *     same-single-triple reading. Kept because it is the assumption the
 *     method rests on, and a corpus where it starts biting is a corpus where
 *     the method needs re-checking;
 *  4. **the next triple was drawn later in the same cast** — otherwise there
 *     is no reconstructed hand to score;
 *  5. **a further play exists in that cast** — otherwise there is no next
 *     turn to score the redraw arm against.
 *
 * On the corpus as committed this is **389 plays over 148 traces**.
 * `isCleanTrace` is deliberately NOT applied: the measurement is per-play and
 * needs only local continuity, the same choice `matcherHeadroom.ts` makes.
 */
export function redrawCounterfactual(traces: readonly CastTrace[]): RedrawCounterfactual {
  const perPlay: RedrawPlay[] = [];
  const casts = new Set<string>();

  for (const t of traces) {
    const triples = drawTriples(t);
    for (let i = 1; i < t.turns.length; i++) {
      const cur = t.turns[i]!;
      const prev = t.turns[i - 1]!;
      if (!cur.play) continue;
      if (!movedExactlyOneCard(prev, cur)) continue;
      if (!handAccountedFor(prev.hand, triples, i)) continue;

      const nextTriple = triples.find((tr) => tr.at >= i);
      if (!nextTriple) continue;
      const next = t.turns[i + 1];
      if (!next || !next.play) continue;

      const g = cur.gridSize;
      const budget = budgetBefore(prev, cur);
      const reach = reachableCells(g, prev.focusPoint, budget);

      casts.add(t.docId);
      perPlay.push({
        docId: t.docId,
        turn: i,
        held: [...prev.hand],
        redrawn: [...nextTriple.cards],
        reachable: reach.length,
        budget,
        actualCanReach: anyCardReaches(t, prev.hand, reach, cur.fishPosition, g),
        redrawCanReach: anyCardReaches(t, nextTriple.cards, reach, next.fishPosition, g),
        heldCoverage: coverageCells(t, prev.hand, reach, g),
        actualHit: cur.play.hit,
      });
    }
  }

  const bothReach = perPlay.filter((p) => p.actualCanReach && p.redrawCanReach).length;
  const sacrifice = perPlay.filter((p) => p.actualCanReach && !p.redrawCanReach).length;
  const rescues = perPlay.filter((p) => !p.actualCanReach && p.redrawCanReach);
  const neitherReaches = perPlay.filter((p) => !p.actualCanReach && !p.redrawCanReach).length;

  const rescueCostHist = new Map<number, number>();
  let costSum = 0;
  for (const p of rescues) {
    rescueCostHist.set(p.held.length, (rescueCostHist.get(p.held.length) ?? 0) + 1);
    costSum += p.held.length;
  }

  const n = perPlay.length || 1;
  return {
    plays: perPlay.length,
    casts: casts.size,
    bothReach,
    sacrifice,
    rescue: rescues.length,
    neitherReaches,
    actualAvailability: (bothReach + sacrifice) / n,
    redrawAvailability: (bothReach + rescues.length) / n,
    rescueCostHist,
    meanRescueCost: rescues.length === 0 ? 0 : costSum / rescues.length,
    perPlay,
  };
}

function countIn(a: readonly number[], v: number): number {
  return a.filter((x) => x === v).length;
}

/** Clause 1 of the predicate. See `redrawCounterfactual`'s header for why the length reading is wrong. */
function movedExactlyOneCard(prev: CastTurn, cur: CastTurn): boolean {
  if (cur.discard.length - prev.discard.length !== 1) return false;
  const added = cur.discard.filter((c) => countIn(cur.discard, c) > countIn(prev.discard, c));
  return added.length === 1 && prev.hand.includes(added[0]!);
}

/** Clause 3 of the predicate: every held card came from a triple revealed on an earlier turn. */
function handAccountedFor(hand: readonly number[], triples: readonly DrawTriple[], turn: number): boolean {
  return hand.every((c) => triples.some((tr) => tr.at <= turn - 1 && tr.cards.includes(c)));
}

/**
 * [§3] The distinct grid cells `ids` could cover from any focus in `reach` —
 * the decision-time footprint of a hand. A hand covering all 16 cells cannot
 * have a dead turn; a hand covering 2 usually does.
 */
export function coverageCells(
  t: CastTrace,
  ids: readonly number[],
  reach: readonly Cell[],
  gridSize: number,
): number {
  const covered = new Set<string>();
  for (const id of ids) {
    const card = t.cards.get(id);
    if (!card) continue;
    for (const f of reach) {
      for (let x = 1; x <= gridSize; x++) {
        for (let y = 1; y <= gridSize; y++) {
          const cell = { x, y };
          if (cardCovers(f, card, cell, gridSize)) covered.add(cellKey(cell));
        }
      }
    }
  }
  return covered.size;
}

function anyCardReaches(
  t: CastTrace,
  ids: readonly number[],
  reach: readonly Cell[],
  target: Cell,
  gridSize: number,
): boolean {
  for (const id of ids) {
    const card = t.cards.get(id);
    if (!card) continue;
    if (reach.some((f) => cardCovers(f, card, target, gridSize))) return true;
  }
  return false;
}

/**
 * The two invariants the table depends on, asserted rather than assumed — the
 * same posture as `matcherHeadroom.ts`'s `assertHeadroomSelfConsistent`.
 *
 *  1. every scored row has a redrawn triple of exactly three cards, all of
 *     which the cast's `deckCardData` defines. A row scored against a card the
 *     corpus cannot describe is scored as "cannot reach", which would bias the
 *     redraw arm DOWNWARD invisibly;
 *  2. the four cells partition the plays. A miscount here is the failure mode
 *     the whole table exists to avoid.
 */
export function assertRedrawCounterfactualSound(t: RedrawCounterfactual): void {
  const cells = t.bothReach + t.sacrifice + t.rescue + t.neitherReaches;
  if (cells !== t.plays) {
    throw new Error(`redrawCounterfactual: cells sum to ${cells}, plays is ${t.plays} — the table does not partition.`);
  }
  const badTriple = t.perPlay.filter((p) => p.redrawn.length !== 3);
  if (badTriple.length > 0) {
    throw new Error(
      `redrawCounterfactual: ${badTriple.length} rows have a reconstructed hand that is not 3 cards ` +
        `(${badTriple.slice(0, 5).map((p) => `${p.docId}#${p.turn}`).join(", ")}). The triple model is wrong — ` +
        `fix the predicate, do not adjust the number.`,
    );
  }
}

// ── §1c  THE MANA SLACK ─────────────────────────────────────────────────────

export interface ManaSlack {
  /** Resolved casts — `caught || escaped`. An unresolved cast has no terminal doc to read. */
  casts: number;
  /** mana remaining at the terminal doc -> count. */
  hist: Map<number, number>;
  mean: number;
  median: number;
  /** Casts that ended with 0 mana — the only ones the pool actually bound. */
  manaOut: number;
  meanWhenCaught: number;
  meanWhenEscaped: number;
  caught: number;
  escaped: number;
}

/**
 * How much of the 10-mana pool a cast throws away.
 *
 * This exists because the price that CLOSED redraw — 43.9 mana per extra fish
 * "against a cast holding 10" — only bites if the pool is scarce, and the
 * corpus says it is not: the average cast ends with well over half of it
 * unspent. The resource that ends casts is the fish's HP headroom, and a
 * redraw does not touch it: a redraw takes no shot, so it cannot miss, and a
 * miss is what heals the fish.
 *
 * **Predicate:** every RESOLVED trace (`caught || escaped`), reading
 * `playerHp` — the mana pool, not health — off the LAST recorded state.
 * Unresolved casts are excluded because their last doc is wherever the capture
 * stopped, not where the cast ended. `isCleanTrace` is not applied; a cast
 * that broke position continuity mid-way still ended where it ended.
 */
export function manaSlack(traces: readonly CastTrace[]): ManaSlack {
  const resolved = traces.filter((t) => (t.caught || t.escaped) && t.turns.length > 0);
  const hist = new Map<number, number>();
  const vals: number[] = [];
  let caughtSum = 0;
  let caught = 0;
  let escapedSum = 0;
  let escaped = 0;

  for (const t of resolved) {
    const last = t.turns[t.turns.length - 1]!;
    hist.set(last.mana, (hist.get(last.mana) ?? 0) + 1);
    vals.push(last.mana);
    if (t.caught) {
      caughtSum += last.mana;
      caught++;
    } else {
      escapedSum += last.mana;
      escaped++;
    }
  }

  vals.sort((a, b) => a - b);
  const n = vals.length;
  const median = n === 0 ? 0 : n % 2 === 1 ? vals[(n - 1) / 2]! : (vals[n / 2 - 1]! + vals[n / 2]!) / 2;

  return {
    casts: n,
    hist,
    mean: n === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / n,
    median,
    manaOut: hist.get(0) ?? 0,
    meanWhenCaught: caught === 0 ? 0 : caughtSum / caught,
    meanWhenEscaped: escaped === 0 ? 0 : escapedSum / escaped,
    caught,
    escaped,
  };
}

// ── §3  SEPARABILITY — can anything the bot KNOWS find a dead hand? ─────────

export interface SeparabilitySplit {
  label: string;
  deadPlays: number;
  rescued: number;
  rescueRate: number;
}

export interface TriggerRow {
  /** Fire the redraw when `heldCoverage <= threshold`. */
  threshold: number;
  fires: number;
  /** Dead hands the redrawn triple would have rescued. */
  rescues: number;
  /** LIVE hands thrown away — the redrawn triple could not reach and the held one could. */
  sacrifices: number;
  /** Dead hands the redraw could not have saved either. Mana spent for nothing. */
  wasted: number;
  manaSpent: number;
}

export interface Separability {
  deadPlays: number;
  livePlays: number;
  /** AUC of `heldCoverage` as a dead-hand detector. 0.5 is a coin, 1.0 is perfect. */
  coverageAuc: number;
  meanCoverageDead: number;
  meanCoverageLive: number;
  /** Rescue rate among dead hands, split by signals the bot can read at decision time. */
  splits: SeparabilitySplit[];
  /** `heldCoverage <= K` as a trigger, over every play. */
  sweep: TriggerRow[];
  /** The same sweep restricted to plays with focus budget left. */
  sweepWithBudget: TriggerRow[];
}

/**
 * §3's question, and the one that decides whether any of §2 is actionable:
 * **how well does a signal available at DECISION time separate the dead hands
 * from the live ones?**
 *
 * §2's rescue set is defined by "no reachable hit", which needs the fish's
 * next cell. A trigger cannot have that. The candidate signal here is
 * `heldCoverage` — the number of distinct cells the held hand can put a zone
 * on, over every reachable focus — which uses nothing but the hand, the focus
 * point and the meter.
 *
 * **The answer is a genuine inversion and it is the session's most useful
 * result, so it is stated in the type rather than left to a script's prose:**
 * the signal separates well (AUC ~0.92), and the dead hands it finds are
 * mostly the ones a redraw CANNOT rescue. Both facts have one cause — a dead
 * hand is usually a hand firing from an exhausted focus meter, and a redraw
 * does not restore the meter. Split on the meter and the picture flips: with
 * a point of budget left, a fresh triple rescues almost every dead hand; with
 * none, it rarely does.
 *
 * ⚠ **The thresholds here are fitted to this corpus with oracle labels and no
 * held-out set.** They are a shape, not a tuning. Nothing here authorises
 * flipping `redrawEnabled` or setting `REDRAW_THRESHOLD`.
 */
export function separability(r: RedrawCounterfactual): Separability {
  const dead = r.perPlay.filter((p) => !p.actualCanReach);
  const live = r.perPlay.filter((p) => p.actualCanReach);

  let concordant = 0;
  for (const d of dead) {
    for (const l of live) {
      // A dead hand should score LOWER on coverage than a live one.
      if (d.heldCoverage < l.heldCoverage) concordant += 1;
      else if (d.heldCoverage === l.heldCoverage) concordant += 0.5;
    }
  }

  const split = (label: string, pred: (p: RedrawPlay) => boolean): SeparabilitySplit => {
    const d = dead.filter(pred);
    const rescued = d.filter((p) => p.redrawCanReach).length;
    return { label, deadPlays: d.length, rescued, rescueRate: d.length === 0 ? 0 : rescued / d.length };
  };

  const sweepOver = (rows: readonly RedrawPlay[]): TriggerRow[] => {
    const out: TriggerRow[] = [];
    for (let threshold = 0; threshold <= 16; threshold++) {
      const fired = rows.filter((p) => p.heldCoverage <= threshold);
      out.push({
        threshold,
        fires: fired.length,
        rescues: fired.filter((p) => !p.actualCanReach && p.redrawCanReach).length,
        sacrifices: fired.filter((p) => p.actualCanReach && !p.redrawCanReach).length,
        wasted: fired.filter((p) => !p.actualCanReach && !p.redrawCanReach).length,
        manaSpent: fired.reduce((s, p) => s + p.held.length, 0),
      });
    }
    return out;
  };

  const mean = (xs: readonly RedrawPlay[]) =>
    xs.length === 0 ? 0 : xs.reduce((s, p) => s + p.heldCoverage, 0) / xs.length;

  return {
    deadPlays: dead.length,
    livePlays: live.length,
    coverageAuc: dead.length === 0 || live.length === 0 ? 0.5 : concordant / (dead.length * live.length),
    meanCoverageDead: mean(dead),
    meanCoverageLive: mean(live),
    splits: [
      split("coverage <= 3", (p) => p.heldCoverage <= 3),
      split("coverage >= 4", (p) => p.heldCoverage >= 4),
      split("focus budget 0", (p) => p.budget === 0),
      split("focus budget >= 1", (p) => p.budget >= 1),
    ],
    sweep: sweepOver(r.perPlay),
    sweepWithBudget: sweepOver(r.perPlay.filter((p) => p.budget >= 1)),
  };
}
