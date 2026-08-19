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
import type { CastTrace } from "./castTrace.js";

/** zone (1-9) -> offset, as a function so an alternative template can be scored without touching `geometry.ts`. */
export type ZoneOffsetFn = (zone: number) => readonly [number, number];

/**
 * The transpose of the live template — i.e. the table this project shipped
 * from session 05 to session 47. Kept so the audit can show the two side by
 * side; a future regression then reads as the two swapping places rather than
 * as an unmoored count.
 */
export const TRANSPOSED_ZONE_OFFSET: ZoneOffsetFn = (z) => [((z - 1) % 3) - 1, Math.floor((z - 1) / 3) - 1];

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
 */
export function auditZoneTemplate(traces: readonly CastTrace[], offset?: ZoneOffsetFn): ZoneAuditResult {
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
      // reflects the post-move focus.
      const hitKeys = offset
        ? cellsVia(offset, cur.focusPoint, card.hitZones, cur.gridSize)
        : new Set(zonesToCells(cur.focusPoint, card.hitZones, cur.gridSize).map(cellKey));
      const critKeys = offset
        ? cellsVia(offset, cur.focusPoint, card.critZones, cur.gridSize)
        : new Set(zonesToCells(cur.focusPoint, card.critZones, cur.gridSize).map(cellKey));

      const key = cellKey(cur.fishPosition);
      const predicted = hitKeys.has(key) || critKeys.has(key);
      scored++;
      if (predicted === cur.play.hit) correct++;
      else
        mismatches.push({
          docId: t.docId,
          turn: i,
          cardId,
          hitZones: card.hitZones,
          focus: cur.focusPoint,
          fish: cur.fishPosition,
          predicted,
          actual: cur.play.hit,
        });
    }
  }
  return { scored, correct, mismatches };
}
