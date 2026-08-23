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
    // [session 72] 11 -> 13 across the four-cast batch. Three oils were spent
    // across two casts (two Focus on `13025987`, one Relaxing on `13025990`),
    // but only two contribute a skipped transition: the lethal Relaxing ended
    // its cast and so has no following card play to skip, exactly as the
    // session-69 note describes.
    // [session 80] 13 -> 18 across this session's eight-cast batch. Same
    // mechanism, more oils spent: the on-demand policy fired its focus trigger
    // repeatedly once the meter emptied. The CLAIM — regen 0 — is unmoved at
    // 569/569.
    expect(r.oilSkipped).toBe(18);
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
   * ## [session 80 §4] **n = 2, AND THE MECHANISM SEPARATED — EXACTLY AS THIS
   * PIN WAS BUILT TO DO.**
   *
   * The paragraph this replaces said: *"n = 1, so the damage rule stays open:
   * `hit + 2`, a flat 5, or 'lethal, and the server reports the fish's
   * remaining HP' (also exactly 5) all fit. Do not pick one."* It then said a
   * second exception would fail loudly rather than be absorbed, and that if it
   * happened the mechanism might become separable.
   *
   * It happened, on this session's eighth live cast, and **all three of those
   * candidate rules are now FALSIFIED:**
   *
   *     13022874 t4   card 76, hit 3   actual Δ5   (5 -> 0 / 19)   LETHAL
   *     13041046 t9   card 2,  hit 5   actual Δ8   (17 -> 9 / 20)  NOT lethal
   *
   *     hit + 2                  3->5 ✓   5->7 ✗   FALSIFIED
   *     flat 5                   3->5 ✓   5->5 ✗   FALSIFIED
   *     lethal, remaining HP     ✓        ✗ (the second is not lethal)   FALSIFIED
   *
   * **What survives is MULTIPLICATIVE**, and three members of that family fit
   * both observations exactly:
   *
   *     hit × 1.5, round half up   3->5 ✓   5->8 ✓
   *     hit × 1.6, rounded         3->5 ✓   5->8 ✓
   *     floor(hit × 5/3)           3->5 ✓   5->8 ✓
   *
   * **Do not pick one of THOSE either** — n=2 separates the families, not the
   * members. What it does settle is the shape: the Steady Lure's crit SCALES
   * the card's damage, it does not add a constant to it, and a model that adds
   * one is wrong for every card whose hit amount is not 3.
   *
   * The corpus rate must still not be read against the lure's stated 3%: the
   * corpus spans ~60 sessions and the lure's equip date is unknown, so most of
   * these plays predate it.
   *
   * Pinned as an EXACT list, for the same reason it was before: a THIRD, novel
   * exception should fail loudly here rather than be absorbed into a count. A
   * third observation on a card with a hit amount that is not 3 or 5 would
   * separate the three surviving rules — 4 gives 6/6/6, but 7 gives 11/11/11
   * and 9 gives 14/14/15, so `floor(hit × 5/3)` separates first at hit 9.
   */
  const KNOWN_CRIT_ANOMALIES = [
    "13022874 t4: card 76 hit=true crit=false predicted Δ-3, actual Δ-5 (5->0/19)",
    "13041046 t9: card 2 hit=true crit=false predicted Δ-5, actual Δ-8 (17->9/20)",
  ];

  it("fishHp moves by exactly the played card's FISH_HP effect — two documented exceptions", () => {
    const r = auditFishHp(traces);
    expect(r.scored).toBeGreaterThanOrEqual(308);
    expect(r.violations).toEqual(KNOWN_CRIT_ANOMALIES);
    expect(r.agree).toBe(r.scored - KNOWN_CRIT_ANOMALIES.length);
  });

  it("THE SEPARATION: an additive crit rule cannot fit both, a multiplicative one does", () => {
    // The finding above, as arithmetic rather than as prose, so it fails if a
    // future reader edits the comment's numbers without re-deriving them.
    const observed: { hit: number; actual: number }[] = [
      { hit: 3, actual: 5 },
      { hit: 5, actual: 8 },
    ];
    const additive = (h: number) => h + 2;
    const flat = () => 5;
    const multiplicative = (h: number) => Math.round(h * 1.5 + 1e-9);
    expect(observed.every((o) => additive(o.hit) === o.actual)).toBe(false);
    expect(observed.every((o) => flat() === o.actual)).toBe(false);
    expect(observed.every((o) => multiplicative(o.hit) === o.actual)).toBe(true);
  });

  /**
   * [session 81] **Which hit amount would separate the three survivors — and
   * the answer is NOT only 9.** Session 80 concluded that separating
   * `hit×1.5` round-half-up, `hit×1.6` rounded and `floor(hit×5/3)` needs a
   * crit on a hit-9 card, and DECISIONS then recorded that no Shroom-deck card
   * deals 9, so "more casting alone will not get there".
   *
   * The first half of that was too narrow. Enumerated over every hit amount
   * the corpus's cards actually carry, **hit 6 and hit 8 also separate** — they
   * split `×1.5` from the other two (9 vs 10, and 12 vs 13), where hit 9 splits
   * `floor(5/3)` from the other two (15 vs 14).
   *
   * That matters because **card 75 deals 6 and is in the deck the account is
   * playing right now** (as is card 7; card 21 deals 8). So a crit that
   * eliminates one of the three IS reachable by ordinary casting, which is what
   * the earlier conclusion said it was not. It does not finish the job — fully
   * separating all three still needs a hit-9 crit as well — but it halves it
   * with cards already in hand.
   *
   * Pinned as arithmetic so a reader cannot re-derive the wrong conclusion from
   * prose, and so the useful targets stay visible when the next crit lands.
   */
  it("hit 6 and hit 8 separate the surviving crit rules — not only hit 9", () => {
    const roundHalfUp = (x: number) => Math.floor(x + 0.5);
    const rules = {
      "x1.5 round-half-up": (h: number) => roundHalfUp(h * 1.5),
      "x1.6 rounded": (h: number) => Math.round(h * 1.6),
      "floor(h*5/3)": (h: number) => Math.floor((h * 5) / 3),
    };
    const predictions = (h: number) => Object.values(rules).map((f) => f(h));
    const separates = (h: number) => new Set(predictions(h)).size > 1;

    // The two observed crits cannot separate anything — all three rules agree
    // on them, which is exactly why n=2 settled the FAMILY and not the member.
    expect(separates(3)).toBe(false);
    expect(separates(5)).toBe(false);
    expect(predictions(3)).toEqual([5, 5, 5]);
    expect(predictions(5)).toEqual([8, 8, 8]);

    // Hit 7 is useless too — session 80 said so and it holds.
    expect(separates(7)).toBe(false);

    // These three do separate. 6 and 8 isolate x1.5; 9 isolates floor(5/3).
    expect(predictions(6)).toEqual([9, 10, 10]);
    expect(predictions(8)).toEqual([12, 13, 13]);
    expect(predictions(9)).toEqual([14, 14, 15]);
    expect([6, 8, 9].every(separates)).toBe(true);

    // And the reachability claim, checked against the corpus rather than
    // asserted: a card dealing 6 is present in the decks actually played.
    const hitAmounts = new Set<number>();
    for (const t of traces) {
      for (const c of t.cards.values()) {
        const amount = c.hitEffects.find((e) => e.amount > 0)?.amount;
        if (amount !== undefined) hitAmounts.add(amount);
      }
    }
    expect(hitAmounts.has(6)).toBe(true);
    expect(hitAmounts.has(8)).toBe(true);
    // Still no card dealing 9 anywhere in the corpus — DECISIONS' half that stands.
    expect(hitAmounts.has(9)).toBe(false);
  });

  it("identifies crits by critZone geometry — and that test discriminates the zone table", () => {
    // This is the point: `critEffects` damage at a `critZones` cell is a
    // second, independent check on session 47's ZONE_OFFSET correction, on a
    // zone set and an observable the hit/miss audit never touches. If the
    // transpose scored equally here, this test would be worthless — so the
    // inequality is asserted, not just the pass.
    const corrected = auditFishHp(traces, correctedZoneOffset);
    const transposed = auditFishHp(traces, transposedZoneOffset);
    // Same TWO exceptions as above — neither is a crit BY GEOMETRY (card 76 has
    // no `critZones` at all, and card 2's hit was not at a crit cell), which is
    // exactly what makes them interesting: both come from the lure, not the card.
    expect(corrected.agree).toBe(corrected.scored - 2);
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
    // [session 72] 22 -> 24 across the four-cast batch.
    // [session 79] 24 -> 25 across the three-cast batch.
    // [session 80] 25 -> 26 across the eight-cast batch.
    expect(corrected.crits).toBe(26);
    expect(transposed.agree).toBeLessThan(transposed.scored);
    expect(transposed.crits).toBeLessThan(corrected.crits);
  });
});
