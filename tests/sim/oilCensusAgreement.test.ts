/**
 * tests/sim/oilCensusAgreement.test.ts — [session 93 §2, QUESTIONS.md §33 ANSWERED]
 *
 * **Two readers, one number.** `src/sim/fishingCorpus.ts` and
 * `src/sim/fishing/castTrace.ts` both walk the same fixture tree and both
 * report how many consumables a cast spent. Until this session they disagreed,
 * and the trace-side reader was the wrong one: it took the first-to-last delta
 * across `turns`, and `turns` deliberately excludes the `use_fishing_item`
 * response, so an oil that fires on a cast's CLOSING turn was invisible to it.
 * The double-lethal trigger fires exactly there by construction — the census
 * read **15 casts / 24 oils against a truth of 21 / 35**.
 *
 * §33 was answered with option (b): point the trace-side count at the reader
 * that was already right, rather than write a third one. **This test is what
 * keeps that true.** A future change to either reader that moves one and not
 * the other fails here, on real fixtures, rather than three sessions later in
 * a published rate.
 *
 * It is deliberately an agreement test and not a pin on a literal: the corpus
 * grows every batch, so a number written here would go stale by design.
 */

import { describe, expect, it } from "vitest";

import { loadCastTraces } from "../../src/sim/fishing/castTrace.js";
import { loadFishingCorpus } from "../../src/sim/fishingCorpus.js";
import { oilsConsumed, firedOil } from "../../src/sim/fishing/castEra.js";

describe("[§33] the trace-side oil count agrees with the corpus reader on every cast", () => {
  const traces = loadCastTraces();
  const corpus = new Map(loadFishingCorpus().map((c) => [c.docId, c]));

  it("has a corpus entry for every trace — the two loaders see the same casts", () => {
    expect(traces.length).toBeGreaterThan(100);
    const missing = traces.filter((t) => !corpus.has(t.docId)).map((t) => t.docId);
    expect(missing).toEqual([]);
  });

  it("reports the SAME consumable count as `fishingCorpus.ts` for every cast", () => {
    const disagreements = traces
      .filter((t) => oilsConsumed(t) !== corpus.get(t.docId)!.consumablesUsed)
      .map((t) => `${t.docId}: trace ${oilsConsumed(t)} vs corpus ${corpus.get(t.docId)!.consumablesUsed}`);
    expect(disagreements).toEqual([]);
  });

  it("agrees with the corpus's own `oilEra` predicate on which casts fired an oil", () => {
    // ⚠ Not quite identical by construction: `oilEra` also counts a used SLOT
    // with a zero count (`slotsUsed.some(...)`), which is the more permissive
    // of the two. So `firedOil` may never be true where `oilEra` is false —
    // the direction that would mean the trace reader is over-counting — and
    // any gap the other way is listed, not tolerated silently.
    const overcounts = traces.filter((t) => firedOil(t) && !corpus.get(t.docId)!.oilEra).map((t) => t.docId);
    expect(overcounts).toEqual([]);
    const slotOnly = traces.filter((t) => !firedOil(t) && corpus.get(t.docId)!.oilEra).map((t) => t.docId);
    // Recorded rather than asserted-away: if this ever grows, a slot is being
    // marked without the count moving, and that is worth a look.
    expect(slotOnly.length).toBeLessThanOrEqual(1);
  });

  it("sees the closing-turn oils that the OLD trace-delta reader was blind to", () => {
    // The old reader's number, recomputed here from the same traces. This is
    // the regression guard with teeth: if someone reverts `oilsConsumed` to the
    // turn delta, this test says so in the language of the defect.
    const oldReader = (t: (typeof traces)[number]) => {
      const first = t.turns[0];
      const last = t.turns[t.turns.length - 1];
      if (!first || !last) return 0;
      return last.consumablesUsed - first.consumablesUsed;
    };
    const blind = traces.filter((t) => oldReader(t) < oilsConsumed(t));
    // Session 92 named six such casts; the corpus only grows, so this is a
    // floor rather than an equality.
    expect(blind.length).toBeGreaterThanOrEqual(6);
    // Every one of them is a cast the old reader UNDER-counted. It never
    // over-counted, which is why nothing already published was inflated.
    expect(traces.filter((t) => oldReader(t) > oilsConsumed(t))).toEqual([]);
  });
});
