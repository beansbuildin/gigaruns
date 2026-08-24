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
    // [session 81] 18 -> 21 across the eight-cast batch.
    // [session 89] 21 -> 24 across session 87's twenty-cast batch. Attributed,
    // not assumed: re-running this audit with those 20 traces excluded returns
    // 21 exactly, so the whole move is new corpus and none of it is drift.
    expect(r.oilSkipped).toBe(24);
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
   * exception should fail loudly here rather than be absorbed into a count.
   *
   * ## [session 81] THE THIRD ANOMALY LANDED, AND IT FALSIFIES `floor(hit × 5/3)`
   *
   * Cast `13041474` turn 2, on this session's eight-cast batch — found exactly
   * the way the exact-list pin was built to find it.
   *
   *     13041474 t2   card 38, CRIT zone hit, base 9   server FISH_HP_DIFF 14
   *
   *     ×1.5 round-half-up   9 -> 14 ✓
   *     ×1.6 rounded         9 -> 14 ✓
   *     floor(9 × 5/3)       9 -> 15 ✗   FALSIFIED
   *
   * **Two rules survive, not three.** Two details make this observation usable
   * where a naive reading would have thrown it away:
   *
   *  - **It is LETHAL** (12 HP -> 0), so the clamped state delta is 12 and says
   *    only "≥ 12", which separates nothing. The unclamped truth comes from the
   *    server's own `FISH_HP_DIFF`, which reads **14**. The uncensored field is
   *    what carries the information here.
   *  - **The base is the card's CRIT amount, not its hit amount.** Card 38 hits
   *    for 3 and crits for 9, and the shot landed in its `critZones`. Session
   *    80 looked for a card whose HIT amount is 9, found none in the deck, and
   *    concluded more casting could not settle this. The multiplier applies to
   *    whatever the shot's base damage would have been — `hitEffects` on an
   *    ordinary hit, `critEffects` on a crit-zone hit — so the reachable pool
   *    was always much larger than the one being searched.
   *
   * **The remaining separator: a base of 6, 8 or 10** (9 vs 10, 12 vs 13, 15 vs
   * 16). **Card 10 crits for 10 and is in the deck this account is playing**,
   * so the last two rules are separable by ordinary casting. Still do not
   * encode a multiplier until one of them is eliminated.
   *
   * ## [session 89] THE BASE-6 SEPARATOR ARRIVED, AND ×1.6 IS FALSIFIED
   *
   * Session 87's 20-cast batch produced three more exceptions, and — this is
   * the part that matters — **they are not three unrelated one-offs. All six
   * fit ONE rule**, and one of them is exactly the separator asked for above:
   *
   *     13055873 t3   card 5, hit 5   FISH_HP_DIFF 8    not lethal
   *     13055892 t1   card 7, hit 6   FISH_HP_DIFF 9    not lethal   <- base 6
   *     13055941 t5   card 9, hit 2   FISH_HP_DIFF 3    not lethal
   *
   *     base 6:   ×1.5 round-half-up -> 9  ✓
   *               ×1.6 rounded       -> 10 ✗   FALSIFIED
   *               floor(6 × 5/3)     -> 10 ✗   (already dead, re-falsified)
   *
   * **One of the three candidate rules now survives: ×1.5, round half up.** It
   * fits all six observations, hit-based and crit-based, lethal and not.
   *
   * **It is a narrowed FAMILY, not a proven constant** — and saying otherwise
   * is the mistake this docblock has avoided twice already. Solving
   * `actual − 0.5 ≤ base × m < actual + 0.5` on all six pins the multiplier to
   * **m ∈ [1.5, 1.5833)**. 1.5 sits exactly on the lower endpoint, which is
   * suggestive and is not a proof; 1.55 also survives. What is eliminated,
   * cleanly, is 1.6 and everything at or above 1.5833.
   *
   * **The next separator is a base of 12 or more** (12 → 18 under 1.5, 19 under
   * 1.55). No card in any known deck has a base that large, so this is where
   * ordinary casting stops paying and only a `/offchain/static` read of the
   * lure would settle it.
   *
   * ⚠ **Card 7 exists only in `BASE_DECK`.** The base-6 observation was
   * reachable at all because the account spent session 87's tail in a
   * base-deck window (`rodDeck.ts`, `QUESTIONS.md` §29) — the Shroom grant
   * has no base-6 card. The window that broke `rodDeck.test.ts` is the same
   * window that paid for this.
   *
   * **Still do not encode the multiplier in live card choice.** SPEC §4d and
   * rule 4 both bar it, `cardChoice.ts` models only the card's half, and one
   * surviving family member is not a measured constant.
   */
  const KNOWN_CRIT_ANOMALIES = [
    "13022874 t4: card 76 hit=true crit=false predicted Δ-3, actual Δ-5 (5->0/19)",
    "13041046 t9: card 2 hit=true crit=false predicted Δ-5, actual Δ-8 (17->9/20)",
    "13041474 t2: card 38 hit=true crit=true predicted Δ-9, actual Δ-12 (12->0/14)",
    // [session 89] Session 87's batch. Δ here is the CLAMPED state delta; the
    // arithmetic below runs on the server's unclamped `FISH_HP_DIFF`, which is
    // the same number on all three because none of them was lethal.
    "13055873 t3: card 5 hit=true crit=false predicted Δ-5, actual Δ-8 (10->2/28)",
    "13055892 t1: card 7 hit=true crit=false predicted Δ-6, actual Δ-9 (19->10/30)",
    "13055941 t5: card 9 hit=true crit=false predicted Δ-2, actual Δ-3 (9->6/17)",
    // [session 91] Session 91's 10-cast batch. Two more, and both are the SAME
    // family rather than anything new — `crit=false` with the actual damage
    // exceeding the card's own effect, i.e. the lure's half firing alone. The
    // first is pattern-identical to `13022874` at the top of this list: card
    // 76, Δ-3 predicted, Δ-5 actual. Ratios across all eight now run 1.33–1.67
    // (−9→−12, −6→−9, −5→−8, −3→−5, −2→−3), which is consistent with the ~1.55
    // the docblock above cites and still short of pinning a multiplier.
    "13068154 t4: card 76 hit=true crit=false predicted Δ-3, actual Δ-5 (12->7/18)",
    "13068176 t8: card 6 hit=true crit=false predicted Δ-5, actual Δ-8 (17->9/21)",
  ];

  it("fishHp moves by exactly the played card's FISH_HP effect — six documented exceptions", () => {
    const r = auditFishHp(traces);
    expect(r.scored).toBeGreaterThanOrEqual(308);
    expect(r.violations).toEqual(KNOWN_CRIT_ANOMALIES);
    expect(r.agree).toBe(r.scored - KNOWN_CRIT_ANOMALIES.length);
  });

  /**
   * [session 81] The falsification, as arithmetic rather than prose, on the
   * UNCLAMPED server figure. The clamped delta in the list above is 12; the
   * `FISH_HP_DIFF` the server reported is 14, and only the latter separates.
   */
  it("the third crit eliminates floor(hit x 5/3) — on the server's unclamped FISH_HP_DIFF", () => {
    const trace = traces.find((t) => t.docId === "13041474");
    expect(trace).toBeDefined();
    const turn = trace!.turns[2]!;
    // Positive on a hit: this is damage dealt, before the clamp at 0.
    expect(turn.play?.fishHpDiff).toBe(14);
    // The clamped view really does lose the information — asserted so nobody
    // "simplifies" this test onto the state delta.
    expect(trace!.turns[1]!.fishHp - turn.fishHp).toBe(12);

    const card = trace!.cards.get(38)!;
    const base = card.critEffects.find((e) => e.amount > 0)!.amount;
    expect(base).toBe(9);
    // The shot landed in the crit zone, so the base is critEffects, not hitEffects.
    expect(card.hitEffects.find((e) => e.amount > 0)!.amount).toBe(3);

    const roundHalfUp = (x: number) => Math.floor(x + 0.5);
    expect(roundHalfUp(base * 1.5)).toBe(14); // survives
    expect(Math.round(base * 1.6)).toBe(14); // survives
    expect(Math.floor((base * 5) / 3)).toBe(15); // FALSIFIED — 15 != 14
    expect(Math.floor((base * 5) / 3)).not.toBe(turn.play!.fishHpDiff);
  });

  it("the base-6 hit eliminates x1.6 — and pins the multiplier to [1.5, 1.5833)", () => {
    // [session 89] The separator the docblock above asked for, delivered by a
    // card that only exists in BASE_DECK. Not lethal (19 -> 10 of 30), so the
    // state delta is the true damage and no unclamped read is needed — but it
    // is taken off `FISH_HP_DIFF` anyway, because that is the field that
    // carries the truth in general and a test should exercise the general path.
    const trace = traces.find((t) => t.docId === "13055892");
    expect(trace, "cast 13055892 is the base-6 observation; without it this proves nothing").toBeDefined();
    const turn = trace!.turns.find((t) => t.index === 1)!;
    expect(turn.play?.fishHpDiff).toBe(9);
    expect(turn.fishHp).toBeGreaterThan(0); // not lethal, so nothing is clamped

    const card = trace!.cards.get(7)!;
    const base = card.hitEffects.find((e) => e.type === "FISH_HP" && e.amount > 0)!.amount;
    expect(base).toBe(6);

    const roundHalfUp = (x: number) => Math.floor(x + 0.5);
    expect(roundHalfUp(base * 1.5)).toBe(9); // survives
    expect(Math.round(base * 1.6)).toBe(10); // FALSIFIED — 10 != 9
    expect(Math.round(base * 1.6)).not.toBe(turn.play!.fishHpDiff);
    expect(Math.floor((base * 5) / 3)).not.toBe(turn.play!.fishHpDiff);
  });

  it("all eight exceptions fit ONE multiplier, and that interval is STILL [1.5, 1.5833)", () => {
    // The claim the SPEC-fishing §4 rule text now rests on: these are not eight
    // one-offs, they are one rule seen eight times. Solved as an interval rather
    // than asserted as a constant — round-half-up(base x m) == actual is
    // equivalent to actual - 0.5 <= base * m < actual + 0.5.
    //
    // **[session 91] Two new observations moved the interval by NOTHING**, and
    // that is the result worth reading. The batch added a (3 -> 5) and a
    // (5 -> 8); both shapes were already present, so each independently
    // re-confirms the rule without tightening it. Two more chances to falsify
    // "one multiplier fits them all", both survived. The bounds are still set
    // by the same two rows they always were — `lo` by every 1.5 row, `hi` by
    // the lone base-6 separator — so the way to NARROW this is still a new
    // base, not more of the bases already seen.
    const observed: { base: number; actual: number }[] = [
      { base: 3, actual: 5 },
      { base: 5, actual: 8 },
      { base: 9, actual: 14 }, // crit base
      { base: 5, actual: 8 },
      { base: 6, actual: 9 }, // the separator
      { base: 2, actual: 3 },
      { base: 3, actual: 5 }, // [session 91] 13068154, card 76 — same shape as row 1
      { base: 5, actual: 8 }, // [session 91] 13068176, card 6
    ];
    expect(observed).toHaveLength(KNOWN_CRIT_ANOMALIES.length);

    let lo = -Infinity;
    let hi = Infinity;
    for (const o of observed) {
      lo = Math.max(lo, (o.actual - 0.5) / o.base);
      hi = Math.min(hi, (o.actual + 0.5) / o.base);
    }
    expect(lo).toBeCloseTo(1.5, 6);
    expect(hi).toBeCloseTo(19 / 12, 6); // 1.58333..., set by the base-6 row
    expect(lo).toBeLessThan(hi); // a non-empty interval IS the "one rule" claim

    const fits = (m: number) => observed.every((o) => Math.floor(o.base * m + 0.5) === o.actual);
    expect(fits(1.5)).toBe(true);
    expect(fits(1.55)).toBe(true); // still not a proven constant
    expect(fits(1.6)).toBe(false);
    expect(fits(5 / 3)).toBe(false);
    expect(fits(1.4)).toBe(false);
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
   * the answer is NOT only 9 — and the search space was wrong too.** Session
   * 80 concluded that separating `hit×1.5` round-half-up, `hit×1.6` rounded and
   * `floor(hit×5/3)` needs a crit on a hit-9 card, and DECISIONS then recorded
   * that no Shroom-deck card deals 9, so "more casting alone will not get
   * there". Both halves were too narrow:
   *
   *  - **more amounts separate than 9.** A base of 6 or 8 splits `×1.5` from
   *    the other two (9 vs 10, 12 vs 13), where 9 splits `floor(5/3)` off;
   *  - **and the base is not restricted to `hitEffects`.** The lure scales
   *    whatever the shot's damage would have been, so a crit-zone hit is scaled
   *    from `critEffects` — and base-9 crits are common (cards 38, 39, 40).
   *
   * A base-9 crit duly landed on session 81's batch and eliminated
   * `floor(hit × 5/3)`. **Two rules survive**, and the remaining separator is a
   * base of 6, 8 or 10; card 10 crits for 10 and is in the deck being played.
   *
   * Pinned as arithmetic so a reader cannot re-derive the wrong conclusion from
   * prose, and so the useful targets stay visible when the next crit lands.
   */
  it("several bases separate the crit rules, and critEffects counts as a base", () => {
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

    // **The reachability claim, and the correction that made it true.** Session
    // 80 searched `hitEffects` for a 9, found none, and concluded casting could
    // not settle this. The multiplier applies to the shot's base damage from
    // WHICHEVER source resolved it, so `critEffects` counts too — and there,
    // 9s are common. The base-9 crit duly landed on this session's batch.
    const hitAmounts = new Set<number>();
    const critAmounts = new Set<number>();
    for (const t of traces) {
      for (const c of t.cards.values()) {
        const hit = c.hitEffects.find((e) => e.amount > 0)?.amount;
        if (hit !== undefined) hitAmounts.add(hit);
        const crit = c.critEffects.find((e) => e.amount > 0)?.amount;
        if (crit !== undefined) critAmounts.add(crit);
      }
    }
    // The half of DECISIONS' claim that stands: no card HITS for 9.
    expect(hitAmounts.has(9)).toBe(false);
    // The half that did not: cards CRIT for 9, and one of them settled it.
    expect(critAmounts.has(9)).toBe(true);
    // The next separator, between the two survivors: a base of 6, 8 or 10.
    // Card 10 crits for 10 and is in the deck being played.
    expect(critAmounts.has(10)).toBe(true);
    expect(predictions(10).slice(0, 2)).toEqual([15, 16]);
  });

  it("identifies crits by critZone geometry — and that test discriminates the zone table", () => {
    // This is the point: `critEffects` damage at a `critZones` cell is a
    // second, independent check on session 47's ZONE_OFFSET correction, on a
    // zone set and an observable the hit/miss audit never touches. If the
    // transpose scored equally here, this test would be worthless — so the
    // inequality is asserted, not just the pass.
    const corrected = auditFishHp(traces, correctedZoneOffset);
    const transposed = auditFishHp(traces, transposedZoneOffset);
    // Same THREE exceptions as above. The first two are not crits BY GEOMETRY
    // (card 76 has no `critZones` at all, and card 2's hit was not at a crit
    // cell) — they come from the lure, not the card.
    //
    // **[session 81] The third is BOTH, and that is the new information.**
    // Card 38's shot landed inside its translated `critZones`, so the card's
    // own crit fired for 9 — and the lure then scaled THAT to 14. The two crit
    // sources compose rather than exclude, which is why the multiplier's base
    // is "whatever this shot's damage would have been" and not "the card's hit
    // amount". `cardChoice.ts` still models only the card's half.
    // [session 89] 3 -> 6: this subtrahend IS `KNOWN_CRIT_ANOMALIES.length`, not
    // an independent constant, so it moves with that list by construction.
    expect(corrected.agree).toBe(corrected.scored - KNOWN_CRIT_ANOMALIES.length);
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
    // [session 81] 26 -> 30 across the eight-cast batch, same pattern again:
    // each is `critEffects` at a cell inside the card's TRANSLATED `critZones`.
    // [session 89] 30 -> 36 across session 87's twenty-cast batch — same
    // attribution as `oilSkipped` above: excluding those 20 traces returns 30.
    expect(corrected.crits).toBe(39);  /* [session 92] was 36 */
    expect(transposed.agree).toBeLessThan(transposed.scored);
    expect(transposed.crits).toBeLessThan(corrected.crits);
  });
});
