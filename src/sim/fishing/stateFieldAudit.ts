/**
 * src/sim/fishing/stateFieldAudit.ts — [session 48, brief §2]
 *
 * Re-scoring for two SPEC-fishing.md §4 state-field claims that were marked
 * [CONFIRMED] against samples too small or too degenerate to have falsified
 * them. Both now hold exceptionlessly against the whole corpus — but that is
 * a result, not something that was ever checked before this pass.
 *
 * **The focus-meter spend rule** (SPEC-fishing.md §4, session 13, live).
 * Established on ONE cast: `3/3 -> 3/3 (dist 0) -> 2/3 (dist 1) -> 1/3
 * (dist 1)`, then a distance-2 move with 1 point left rejected HTTP 400.
 * Those three accepted moves have distances 0, 1, 1 — under which "cost =
 * Manhattan distance" and "cost = 1 per move that actually moves" make
 * IDENTICAL predictions. The rejection discriminates them, so the claim was
 * not baseless; but the "does not regenerate within a cast" half rested on a
 * cast that never had the budget to show regeneration either way.
 *
 * **The `fishHp` damage arithmetic** (SPEC-fishing.md §4). Marked [CONFIRMED]
 * on sign agreement alone — misses heal, hits damage — which cannot
 * distinguish "the card's own FISH_HP amount" from any other rule with the
 * right sign.
 *
 * Scoring the amounts turns up the one thing sign-agreement structurally
 * could not see: **crits**. Four hits in the corpus deal strictly more than
 * their card's `hitEffects` amount, and all four are exactly the card's
 * `critEffects` amount at a fish cell inside the card's translated
 * `critZones`. That makes this a second, INDEPENDENT confirmation of session
 * 47's `ZONE_OFFSET` correction — different zone set (`critZones`, not
 * `hitZones`), different observable (damage magnitude, not the server's
 * hit/miss verdict). It discriminates: see `scripts/auditStateFields.ts`,
 * corrected 81/81 with 4 crits flagged vs. the transpose's 78/81 with 1.
 */

import type { CastTrace, CastTurn, TraceCard } from "./castTrace.js";
import { zonesToCells, cellKey } from "./geometry.js";

export interface AuditCount {
  scored: number;
  agree: number;
  violations: string[];
}

/**
 * `focusMeter` falls by exactly the Manhattan distance the focus point moved,
 * and never rises within a cast.
 *
 * [session 64] Both claims are about CARD PLAY and are scoped to it explicitly:
 * a transition across a consumable is skipped and counted in `oilSkipped`. The
 * first live Mid Focus Oil (+2 at meter zero) is a deliberate exception to both
 * and does not falsify either — see the body.
 */
export function auditFocusMeter(
  traces: readonly CastTrace[],
): AuditCount & { regenObserved: number; oilSkipped: number } {
  let scored = 0;
  let agree = 0;
  let regenObserved = 0;
  let oilSkipped = 0;
  const violations: string[] = [];
  for (const t of traces) {
    for (let i = 0; i + 1 < t.turns.length; i++) {
      const a = t.turns[i]!;
      const b = t.turns[i + 1]!;
      // ── [session 64] AN OIL TRANSITION IS NOT A COUNTEREXAMPLE ──────────
      //
      // Both claims below describe what CARD PLAY does to the meter. A Mid
      // Focus Oil restores +2 by design, so a transition spanning a consume
      // breaks them by doing exactly what it is for. Scoring it as a violation
      // would report the oil as a defect in the model of the board.
      //
      // Detected off the server's own `consumablesUsed`, not off a flag this
      // repo writes — the same reasoning as `fishingCorpus.ts`'s `oilEra`: it
      // cannot be forgotten, and it applies retroactively to any capture.
      //
      // Counted, not silently dropped. A count that quietly shrinks is how a
      // denominator stops meaning anything, so `oilSkipped` is reported and the
      // caller can see how much of the corpus this removed.
      if (b.consumablesUsed > a.consumablesUsed) {
        oilSkipped++;
        continue;
      }
      const dist = Math.abs(a.focusPoint.x - b.focusPoint.x) + Math.abs(a.focusPoint.y - b.focusPoint.y);
      const spent = a.focusMeter - b.focusMeter;
      scored++;
      if (spent === dist) agree++;
      else violations.push(`${t.docId} t${a.index}->${b.index}: moved ${dist}, meter spent ${spent}`);
      if (b.focusMeter > a.focusMeter) regenObserved++;
    }
  }
  return { scored, agree, violations, regenObserved, oilSkipped };
}

function playedCard(trace: CastTrace, before: CastTurn, after: CastTurn): TraceCard | undefined {
  const idx = after.play?.handIndex;
  if (idx === undefined) return undefined;
  return trace.cards.get(before.hand[idx] ?? -1);
}

/**
 * `fishHp` moves by exactly the played card's FISH_HP effect amount —
 * `critEffects` when the fish's post-move cell is inside the card's
 * translated `critZones`, `hitEffects` on any other hit, `missEffects` on a
 * miss — clamped to `[0, fishMaxHp]`.
 *
 * `zoneOffset` is injectable purely so the audit script can score the
 * corrected table against session 12's transpose on the same turns.
 */
export function auditFishHp(
  traces: readonly CastTrace[],
  zoneOffset?: (zone: number) => readonly [number, number],
): AuditCount & { crits: number } {
  let scored = 0;
  let agree = 0;
  let crits = 0;
  const violations: string[] = [];
  for (const t of traces) {
    for (let i = 0; i + 1 < t.turns.length; i++) {
      const a = t.turns[i]!;
      const b = t.turns[i + 1]!;
      const play = b.play;
      if (!play) continue;
      const card = playedCard(t, a, b);
      if (!card) continue;
      scored++;

      const critZones = Array.isArray(card.critZones) ? card.critZones : [];
      const critCells = zoneOffset
        ? critZones.map((z) => {
            const [dx, dy] = zoneOffset(z);
            return { x: b.focusPoint.x + dx, y: b.focusPoint.y + dy };
          })
        : zonesToCells(b.focusPoint, critZones, b.gridSize);
      const isCrit = play.hit && critCells.some((c) => cellKey(c) === cellKey(b.fishPosition));
      if (isCrit) crits++;

      const eff = play.hit ? (isCrit ? card.critEffects : card.hitEffects) : card.missEffects;
      const amount = eff.find((e) => e.type === "FISH_HP")?.amount ?? 0;
      const predicted = -amount;
      const delta = b.fishHp - a.fishHp;
      const clampedAtZero = b.fishHp === 0 && delta >= predicted;
      const clampedAtMax = b.fishHp === b.fishMaxHp && delta <= predicted;
      if (delta === predicted || clampedAtZero || clampedAtMax) agree++;
      else
        violations.push(
          `${t.docId} t${b.index}: card ${card.id} hit=${play.hit} crit=${isCrit} predicted Δ${predicted}, actual Δ${delta} (${a.fishHp}->${b.fishHp}/${b.fishMaxHp})`,
        );
    }
  }
  return { scored, agree, violations, crits };
}

/** Session 12's table, kept here so the crit test can be shown to discriminate. */
export function transposedZoneOffset(zone: number): readonly [number, number] {
  return [((zone - 1) % 3) - 1, Math.floor((zone - 1) / 3) - 1];
}

/** The corrected table, as an injectable function. */
export function correctedZoneOffset(zone: number): readonly [number, number] {
  return [Math.floor((zone - 1) / 3) - 1, ((zone - 1) % 3) - 1];
}
