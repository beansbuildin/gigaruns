/**
 * src/sim/fishing/zoneAudit.ts — [session 47]
 *
 * Scores a zone→offset template against the recorded corpus. Extracted out of
 * `scripts/auditZoneTemplate.ts` so `tests/fishing/zoneTemplate.test.ts` can
 * pin the result without shelling out to a script, and so the transposed
 * table has exactly one definition rather than a copy in each.
 *
 * See `geometry.ts`'s header for the finding this exists to guard.
 */

import { cellKey, zonesToCells, inGrid, type Cell } from "./geometry.js";
import type { CastTrace, CastTurn } from "./castTrace.js";

/** zone (1-9) -> offset, as a function so an alternative template can be scored without touching `geometry.ts`. */
export type ZoneOffsetFn = (zone: number) => readonly [number, number];

/**
 * The transpose of the live template — i.e. the table this project shipped
 * from session 05 to session 47. Kept so the audit can show the two side by
 * side; a future regression then reads as the two swapping places rather than
 * as an unmoored count.
 */
export const TRANSPOSED_ZONE_OFFSET: ZoneOffsetFn = (z) => [((z - 1) % 3) - 1, Math.floor((z - 1) / 3) - 1];

/**
 * **[session 81 §3] WHICH TWO STATES RESOLVE A SHOT.** A play is a transition
 * between two consecutive states, and both of them carry a `focusPoint` and a
 * `fishPosition` — so "did this card hit" has four defensible readings and
 * only one of them is the server's. The audit has always used the right one;
 * nothing until now *said* it was a choice, and a reading that is merely
 * implicit in a call site is one nobody can check.
 *
 * `a` is the state BEFORE the play, `b` the state after. The server's reading
 * is `b.focusPoint` + `b.fishPosition` and it scores exceptionless; the other
 * three land between 62% and 79%, which is the range in which a convention
 * error looks like a working model. `previousFishPosition` is the trap
 * specifically: it reads as "where the fish was when you aimed", it is 62.1%
 * accurate, and `movePathAudit.ts` uses it correctly for a different purpose.
 *
 * The fish moves FIRST and the card resolves against the cell it moved TO
 * (`castTrace.ts`'s header: FISH_MOVED -> CARD_PLAYED -> HIT). That is what
 * makes this a one-step-ahead PREDICTION problem, and therefore what makes
 * `matcherHeadroom.ts`'s oracle a ceiling below 100% rather than at it.
 */
export interface ResolutionReading {
  name: string;
  focus: (a: CastTurn, b: CastTurn) => Cell;
  fish: (a: CastTurn, b: CastTurn) => Cell;
}

/** The server's reading, and the three plausible wrong ones, scored side by side. */
export const RESOLUTION_READINGS = {
  /** ✔ The truth: post-move focus, resulting fish cell. */
  truth: { name: "b.focusPoint + b.fishPosition", focus: (_a, b) => b.focusPoint, fish: (_a, b) => b.fishPosition },
  /** Aims with the focus point the player started the turn on. */
  focusBefore: { name: "a.focusPoint + b.fishPosition", focus: (a) => a.focusPoint, fish: (_a, b) => b.fishPosition },
  /** Resolves the whole shot against the pre-play state. */
  stateBefore: { name: "a.focusPoint + a.fishPosition", focus: (a) => a.focusPoint, fish: (a) => a.fishPosition },
  /** The trap — "where the fish was when you aimed". */
  previousFishPosition: {
    name: "b.focusPoint + b.previousFishPosition",
    focus: (_a, b) => b.focusPoint,
    fish: (_a, b) => b.previousFishPosition,
  },
} as const satisfies Record<string, ResolutionReading>;

export interface ZoneMismatch {
  docId: string;
  turn: number;
  cardId: number;
  hitZones: number[];
  focus: Cell;
  fish: Cell;
  predicted: boolean;
  actual: boolean;
}

export interface ZoneAuditResult {
  scored: number;
  correct: number;
  mismatches: ZoneMismatch[];
}

function cellsVia(off: ZoneOffsetFn, focus: Cell, zones: readonly number[], gridSize: number): Set<string> {
  const out = new Set<string>();
  for (const z of zones) {
    const [dx, dy] = off(z);
    const c: Cell = { x: focus.x + dx, y: focus.y + dy };
    if (inGrid(c, gridSize)) out.add(cellKey(c));
  }
  return out;
}

/**
 * `offset` omitted scores the LIVE `geometry.ts` template (via `zonesToCells`,
 * so the audit exercises the real call path rather than a reimplementation of
 * it). Supplying one scores that alternative instead.
 *
 * `reading` omitted scores the server's own state-pair semantics
 * (`RESOLUTION_READINGS.truth`). The two parameters are independent axes: the
 * template says where a zone lands, the reading says which two states the shot
 * is resolved between, and either can be wrong on its own.
 *
 * **The predicate, stated in full because a count without one is unmeetable**
 * (CLAUDE.md rule 6, and session 80's 543-vs-548): every state-to-state
 * transition whose resulting state carries a `play`, whose `play.handIndex`
 * resolves to a card id in the PRE-play hand, and whose id is present in the
 * cast's `deckCardData`. Nothing else is filtered — not clean traces, not
 * terminal plays, not oil casts. On the committed corpus that is **612**
 * plays, of which 609 lie in clean traces and 3 in session 45's resumed cast.
 */
export function auditZoneTemplate(
  traces: readonly CastTrace[],
  offset?: ZoneOffsetFn,
  reading: ResolutionReading = RESOLUTION_READINGS.truth,
): ZoneAuditResult {
  let scored = 0;
  let correct = 0;
  const mismatches: ZoneMismatch[] = [];

  for (const t of traces) {
    for (let i = 1; i < t.turns.length; i++) {
      const cur = t.turns[i]!;
      const prev = t.turns[i - 1]!;
      if (!cur.play) continue;
      const cardId = prev.hand[cur.play.handIndex];
      if (cardId === undefined) continue;
      const card = t.cards.get(cardId);
      if (!card) continue;

      // The focus that resolved the shot is the one in THIS response: the
      // player moves the focus and plays in the same request, and the doc
      // reflects the post-move focus. Selectable since session 81 so the
      // alternatives can be scored rather than assumed away — see
      // `ResolutionReading`.
      const focus = reading.focus(prev, cur);
      const fish = reading.fish(prev, cur);
      const hitKeys = offset
        ? cellsVia(offset, focus, card.hitZones, cur.gridSize)
        : new Set(zonesToCells(focus, card.hitZones, cur.gridSize).map(cellKey));
      const critKeys = offset
        ? cellsVia(offset, focus, card.critZones, cur.gridSize)
        : new Set(zonesToCells(focus, card.critZones, cur.gridSize).map(cellKey));

      const key = cellKey(fish);
      const predicted = hitKeys.has(key) || critKeys.has(key);
      scored++;
      if (predicted === cur.play.hit) correct++;
      else
        mismatches.push({
          docId: t.docId,
          turn: i,
          cardId,
          hitZones: card.hitZones,
          focus,
          fish,
          predicted,
          actual: cur.play.hit,
        });
    }
  }
  return { scored, correct, mismatches };
}
