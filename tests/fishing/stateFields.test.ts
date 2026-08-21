/**
 * tests/fishing/stateFields.test.ts — [session 48, brief §2]
 *
 * Corpus-pinned guards for the two SPEC-fishing.md §4 claims re-scored by the
 * `[CONFIRMED]` falsifiability pass. Both were marked CONFIRMED against
 * samples that could not have falsified them; both survive re-scoring, and
 * these tests are what stops that from drifting again.
 *
 * Reads the committed fixture tree; writes nothing (CLAUDE.md's
 * tests-never-touch-a-real-data-path rule — `fixtures/` is source).
 */

import { describe, expect, it } from "vitest";

import { loadCastTraces, isCleanTrace } from "../../src/sim/fishing/castTrace.js";
import {
  auditFocusMeter,
  auditFishHp,
  correctedZoneOffset,
  transposedZoneOffset,
} from "../../src/sim/fishing/stateFieldAudit.js";

describe("SPEC-fishing §4 state-field claims, re-scored against the corpus", () => {
  const traces = loadCastTraces().filter(isCleanTrace);

  it("focusMeter falls by exactly the Manhattan distance moved, exceptionless", () => {
    const r = auditFocusMeter(traces);
    expect(r.scored).toBeGreaterThanOrEqual(308);
    expect(r.violations).toEqual([]);
    expect(r.agree).toBe(r.scored);
  });

  /**
   * [session 64] Still exceptionless — but the claim is now explicitly about
   * CARD PLAY, and it took the first live oil to make that distinction real.
   *
   * A Mid Focus Oil restored the meter 0 -> 2 mid-cast (13019015, between
   * turns 7 and 8), which is a regeneration by design. `auditFocusMeter` skips
   * transitions spanning a consumable and counts them in `oilSkipped`, so the
   * exception is VISIBLE rather than absorbed. Asserting `oilSkipped` here is
   * the point: a skip that nobody counts is how a denominator quietly stops
   * meaning anything.
   */
  it("never regenerates the focus meter within a cast — across CARD PLAY", () => {
    const r = auditFocusMeter(traces);
    expect(r.regenObserved).toBe(0);
    // [session 65] 1 -> 5 across the seven-cast batch. The claim is unmoved and
    // the mechanism is unchanged; what grew is the number of transitions that
    // are VISIBLY excluded rather than silently averaged in. 464/464 agree with
    // regen 0 — every consumable transition accounted for and none of them
    // quietly counted as card play.
    expect(r.oilSkipped).toBe(11); // [session 69] 6 -> 11: ten oils consumed in the ten-cast batch (one was the lethal Relaxing that ends the cast, so it contributes no skipped transition).
  });

  /**
   * **[session 68 §2] NO LONGER EXCEPTIONLESS. One documented exception, and
   * it is a real refutation, not a bookkeeping artefact.**
   *
   * Live, 2026-08-21, cast 13022874 turn 4: the server emitted a **`CRIT_HIT`
   * on a card with `critZones: []` AND `critEffects: []`** (card 76, hit
   * amount 3) and took the fish from 5 HP to 0 — a delta of 5 where the card's
   * only damage effect says 3.
   *
   * Two separate things were wrong and only ONE of them was a bug:
   *
   *   - `castTrace.ts` scored `CRIT_HIT` as a MISS, because it matched only
   *     `type === "HIT"`. Fixed there. That fix alone made the ZONE_OFFSET
   *     audit exceptionless again — the geometry was never in question.
   *   - The damage itself is genuinely unexplained. With the hit correctly
   *     classified the prediction is still Δ3 and the observation is still Δ5.
   *
   * **The SOURCE is now known and the DAMAGE RULE is not.** *User-stated,
   * 2026-08-21:* a **"Steady Lure" is equipped, giving a 3% chance of a
   * critical hit.* That explains a crit owing nothing to `critZones` — it did
   * not come from the card — and means `cardChoice.ts`'s crit model covers
   * only one of the two crit sources in play.
   *
   * **n = 1**, so the damage rule stays open: `hit + 2`, a flat 5, or "lethal,
   * and the server reports the fish's remaining HP" (also exactly 5) all fit.
   * **Do not pick one.** Nor should the 1-in-484 corpus rate be read against
   * the lure's 3%: the corpus spans ~60 sessions and the lure's equip date is
   * unknown, so most of those plays predate it. SPEC-fishing carries both.
   *
   * This is pinned as an EXACT expected list rather than relaxed to a count or
   * a `toBeLessThan`, so a SECOND, different exception fails loudly instead of
   * being absorbed into a tolerance. If that happens there will be n=2 and the
   * mechanism may become separable — which is the point.
   */
  const KNOWN_CRIT_ANOMALY = "13022874 t4: card 76 hit=true crit=false predicted Δ-3, actual Δ-5 (5->0/19)";

  it("fishHp moves by exactly the played card's FISH_HP effect — one documented exception", () => {
    const r = auditFishHp(traces);
    expect(r.scored).toBeGreaterThanOrEqual(308);
    expect(r.violations).toEqual([KNOWN_CRIT_ANOMALY]);
    expect(r.agree).toBe(r.scored - 1);
  });

  it("identifies crits by critZone geometry — and that test discriminates the zone table", () => {
    // This is the point: `critEffects` damage at a `critZones` cell is a
    // second, independent check on session 47's ZONE_OFFSET correction, on a
    // zone set and an observable the hit/miss audit never touches. If the
    // transpose scored equally here, this test would be worthless — so the
    // inequality is asserted, not just the pass.
    const corrected = auditFishHp(traces, correctedZoneOffset);
    const transposed = auditFishHp(traces, transposedZoneOffset);
    // Same single exception as above — it is not a crit BY GEOMETRY (the card
    // has no `critZones` at all), which is exactly what makes it interesting.
    expect(corrected.agree).toBe(corrected.scored - 1);
    // [session 50] 8 → 10 across this session's live batch, every one again
    // exactly `critEffects` at a cell inside the card's TRANSLATED
    // `critZones`. The discrimination is now 391/391 with 10 crits for the
    // corrected table against 383/391 with 2 for the transposed one — the
    // inequalities below are what assert that gap rather than just the pass.
    // [session 64] 10 -> 13 across this session's 7 live casts, same pattern:
    // each new crit is `critEffects` at a cell inside the card's TRANSLATED
    // `critZones`. The discriminating inequalities below are what carry the
    // claim; the count is a census figure and moves with the corpus.
    // [session 65] 13 -> 17 across the seven-cast batch, same pattern again.
    // [session 69] 17 -> 22 across the ten-cast batch. **Note what this count
    // does NOT include:** the lure crit (SPEC-fishing, `CRIT_HIT` with
    // `critZones: []`) is invisible to a zone-geometry audit by construction,
    // so `corrected.crits` counts CARD crits only and always will. The two
    // crit sources need two instruments; do not read this as the crit rate.
    expect(corrected.crits).toBe(22);
    expect(transposed.agree).toBeLessThan(transposed.scored);
    expect(transposed.crits).toBeLessThan(corrected.crits);
  });
});
