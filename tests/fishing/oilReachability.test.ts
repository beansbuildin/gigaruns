/**
 * tests/fishing/oilReachability.test.ts — [session 64 §1, GATE HALF 1] pins
 * the DEFINITIONS the reachability report is computed under.
 *
 * ## Why the definitions get a test and the numbers are almost incidental
 *
 * The brief's question — can the shipped `on-demand` policy fire in live play
 * at all — turns entirely on one clause: **"with a turn remaining."** A cast
 * ends when its focus budget runs out, so *almost every* cast finishes with
 * `focusMeter` at zero. An analysis that counts those terminal states reports a
 * Focus trigger that looks abundantly reachable while describing a moment the
 * policy could never have spent into. That is not a subtle bias: on the real
 * corpus it moves Focus reachability from **58.9% to 73.7%** (14 casts), and
 * the direction of the error is the flattering one.
 *
 * So `requireTurnRemaining: false` is kept as an option purely so the wrong
 * reading is EXECUTABLE and can be shown to disagree, rather than warned about
 * in a comment nobody re-reads. The first test below is the gate case the brief
 * asked for: a cast that the lax definition calls Focus-reachable and the
 * correct one does not.
 *
 * Every fixture here is hand-built in memory. Nothing reads or writes a data
 * path, and the two corpus tests only READ `fixtures/`.
 */

import { describe, expect, it } from "vitest";

import type { FishingCast, FishingCorpusResponse } from "../../src/sim/fishingCorpus.js";
import { loadFishingCorpus } from "../../src/sim/fishingCorpus.js";
import { castReachability, orderedResponses, reachabilityReport } from "../../src/sim/fishing/oilReachability.js";

let stamp = 0;
/** One captured board state. `updatedAt` auto-increments so declaration order IS chronological order unless a test overrides it. */
function state(
  board: { fishHp: number; focusMeter: number },
  opts: { kind?: FishingCorpusResponse["kind"]; complete?: boolean; updatedAt?: string } = {},
): FishingCorpusResponse {
  stamp++;
  return {
    file: `s${stamp}`,
    kind: opts.kind ?? "play_cards",
    completeCid: opts.complete ?? false,
    successCid: null,
    caughtFish: null,
    board: { fishHp: board.fishHp, fishMaxHp: 15, focusMeter: board.focusMeter, focusMeterMax: 3 },
    updatedAt: opts.updatedAt ?? `2026-08-21T00:00:${String(stamp).padStart(2, "0")}.000Z`,
  };
}

function cast(responses: FishingCorpusResponse[]): FishingCast {
  return { docId: "test-cast", responses, consumablesUsed: 0, oilEra: false, slotsUsed: [false, false, false] };
}

describe("the 'with a turn remaining' clause", () => {
  /**
   * THE GATE CASE — and it is an ESCAPED cast, not a caught one, because that
   * is the shape the clause actually has to defend against.
   *
   * A cast ends when the focus budget is spent, so an escape's final state is
   * `focusMeter: 0` with the fish STILL ALIVE. The alive clause therefore does
   * not exclude it; only "with a turn remaining" does. This is the 14-cast
   * population the two definitions disagree on in the real corpus, and 79 of
   * the 95 committed casts escaped, so it is the common case rather than an
   * edge one.
   */
  const meterZeroOnlyAtTheEnd = cast([
    state({ fishHp: 12, focusMeter: 3 }, { kind: "start_run" }),
    state({ fishHp: 9, focusMeter: 2 }),
    state({ fishHp: 7, focusMeter: 1 }),
    state({ fishHp: 7, focusMeter: 0 }, { complete: true }), // escaped: fish alive, budget gone
  ]);

  it("does NOT call the Focus trigger reachable when the meter zeroes only as the cast ends", () => {
    const r = castReachability(meterZeroOnlyAtTheEnd);
    expect(r.focusReachable).toBe(false);
    expect(r.focusPoints).toBe(0);
  });

  it("the LAX definition wrongly calls that same cast reachable — which is why the clause is not optional", () => {
    const lax = castReachability(meterZeroOnlyAtTheEnd, { requireTurnRemaining: false });
    expect(lax.focusReachable).toBe(true);
    expect(lax.focusPoints).toBe(1);
  });

  /**
   * Session 63's actual cast, in shape — a CATCH. Both definitions agree it is
   * unreachable, because the fish is dead on the terminal state and the alive
   * clause alone excludes it. Kept beside the gate case to show the two clauses
   * are not redundant: each is load-bearing on a different cast outcome.
   */
  it("excludes session 63's catch under BOTH definitions, via the alive clause", () => {
    const catchCast = cast([
      state({ fishHp: 12, focusMeter: 3 }, { kind: "start_run" }),
      state({ fishHp: 9, focusMeter: 1 }),
      state({ fishHp: 4, focusMeter: 1 }),
      state({ fishHp: 0, focusMeter: 0 }, { complete: true }),
    ]);
    expect(castReachability(catchCast).focusReachable).toBe(false);
    expect(castReachability(catchCast, { requireTurnRemaining: false }).focusReachable).toBe(false);
    // and neither trigger: the fish went 4 -> dead, skipping the lethal band.
    expect(castReachability(catchCast).relaxingReachable).toBe(false);
  });

  it("counts a meter-zero state that DID have a turn after it", () => {
    const r = castReachability(
      cast([
        state({ fishHp: 12, focusMeter: 3 }, { kind: "start_run" }),
        state({ fishHp: 9, focusMeter: 0 }), // zero here, and two turns still follow
        state({ fishHp: 5, focusMeter: 0 }),
        state({ fishHp: 0, focusMeter: 0 }, { complete: true }),
      ]),
    );
    expect(r.focusReachable).toBe(true);
    expect(r.focusPoints).toBe(2); // the terminal state is still excluded — the fish is dead there
    expect(r.decisionPoints).toBe(3);
  });
});

describe("the alive clause", () => {
  it("does not count a state where the fish is already dead, however the meter reads", () => {
    const r = castReachability(
      cast([
        state({ fishHp: 3, focusMeter: 0 }, { kind: "start_run" }),
        state({ fishHp: 0, focusMeter: 0 }),
        state({ fishHp: 0, focusMeter: 0 }, { complete: true }),
      ]),
    );
    // Only the opening state is alive, and a play_cards follows it.
    expect(r.decisionPoints).toBe(1);
    expect(r.focusPoints).toBe(1);
    expect(r.relaxingPoints).toBe(0); // fishHp 3 > the oil's 2 damage: NOT lethal
  });

  it("fires the Relaxing trigger only at LETHAL hp, not merely low hp", () => {
    const low = castReachability(
      cast([state({ fishHp: 3, focusMeter: 3 }, { kind: "start_run" }), state({ fishHp: 0, focusMeter: 1 })]),
    );
    expect(low.relaxingReachable).toBe(false);

    const lethal = castReachability(
      cast([state({ fishHp: 2, focusMeter: 3 }, { kind: "start_run" }), state({ fishHp: 0, focusMeter: 1 })]),
    );
    expect(lethal.relaxingReachable).toBe(true);
  });

  it("treats an unparsable board scalar as unknown rather than as zero", () => {
    // NaN must not read as a dead fish or an empty meter — see `numOr`.
    const broken = cast([
      { ...state({ fishHp: 0, focusMeter: 0 }, { kind: "start_run" }), board: { fishHp: Number.NaN, fishMaxHp: 15, focusMeter: Number.NaN, focusMeterMax: 3 } },
      state({ fishHp: 5, focusMeter: 2 }),
    ]);
    const r = castReachability(broken);
    expect(r.decisionPoints).toBe(0); // the NaN state is skipped, not counted as a firing
    expect(r.focusPoints).toBe(0);
  });
});

describe("ordering", () => {
  it("orders by the server's updatedAt, not by filesystem walk order", () => {
    // A killed-and-resumed process writes the later turn into a different
    // directory, so it can be walked FIRST. Only `updatedAt` recovers the order.
    const later = state({ fishHp: 2, focusMeter: 0 }, { updatedAt: "2026-08-21T00:09:00.000Z" });
    const earlier = state({ fishHp: 9, focusMeter: 3 }, { kind: "start_run", updatedAt: "2026-08-21T00:01:00.000Z" });
    const ordered = orderedResponses(cast([later, earlier]));
    expect(ordered.map((r) => r.updatedAt)).toEqual([earlier.updatedAt, later.updatedAt]);
  });
});

describe("the committed corpus", () => {
  /**
   * The session's headline finding, pinned so a later change to the loader or
   * the trigger cannot move it silently. If a future session adds casts these
   * numbers MUST be updated, not reverted — same convention as the census in
   * `tests/sim/fishingCorpus.test.ts`.
   *
   * [session 64] Updated twice by this session's own live casts: 95 -> 102,
   * Focus 56 -> 58 (58.9% -> 56.9%), Relaxing 9 -> 10. The headline conclusion
   * is unmoved — the Focus trigger is reachable in most casts and the +17.74pp
   * it carries is not a sim artifact. The session's oil cast is itself a
   * confirmation: its meter hit zero at turn 7 with three turns still to play,
   * the trigger fired, and the oil was consumed.
   *
   * [session 65] Updated by the seven-cast batch: 102 -> 109, Focus 58 -> 60
   * (56.9% -> 55.0%), Relaxing 10 -> 12 (9.8% -> 11.0%). **The Relaxing rate
   * is the one worth reading.** Session 64 measured it at ~10% and the
   * session-65 brief priced a seven-cast batch as a ~51% shot at seeing it
   * fire once. It fired on cast ONE, and the corpus rate then moved UP rather
   * than down — the estimate was not optimistic, it was slightly low.
   */
  it("reports reachability over all 109 casts", () => {
    const r = reachabilityReport(loadFishingCorpus());
    expect(r.casts).toBe(109);
    expect(r.totalDecisionPoints).toBe(474);
    expect(r.relaxingReachable).toBe(12);
    expect(r.focusReachable).toBe(60);
    expect(r.eitherReachable).toBe(65);
    expect(r.neitherReachable).toBe(44);
    expect(r.totalRelaxingPoints).toBe(14);
    expect(r.totalFocusPoints).toBe(191);
  });

  it("shows the lax definition inflating Focus reachability on the real corpus", () => {
    const strict = reachabilityReport(loadFishingCorpus());
    const lax = reachabilityReport(loadFishingCorpus(), { requireTurnRemaining: false });
    expect(lax.focusReachable).toBe(74);
    // 14 real casts whose only meter-zero state is the one the policy could
    // never have acted on. The error is in the flattering direction.
    // [session 64] Unchanged at 14 after the 6-cast batch: the batch added one
    // cast to each side, so the GAP is the stable quantity, not the endpoints.
    // [session 65] Still 14 after the seven-cast batch — 72 -> 74 lax against
    // 58 -> 60 strict.
    //
    // ── [session 66 §3] THE "STRUCTURAL, NOT SAMPLING NOISE" CLAIM IS
    //    WITHDRAWN AS STATED. ──────────────────────────────────────────────
    //
    // This comment used to end: "Three independent batches now, and the gap
    // has not moved once. That is worth more than any of the endpoints: it
    // says the lax definition's error is a stable structural feature of how
    // casts end, not sampling noise that might wash out with more data."
    //
    // The arithmetic does not support that. Between the last two readings the
    // corpus grew by SEVEN casts. At the observed gap rate 14/102 = 13.7%,
    // those seven were expected to add ~0.96 members, and adding ZERO has
    // probability 0.863^7 = 0.36. A one-in-three outcome is the single most
    // ordinary thing that could have happened; it is not evidence of anything.
    //
    // Worse, the "same 14 casts" reading is not evidence either — it is
    // arithmetic. Gap membership is a PER-CAST property (`castReachability`
    // reads one cast and nothing else) and the corpus only ever grows, so
    // gap(109) is necessarily a superset of gap(102). Equal counts therefore
    // FORCE equal membership. Nothing was learned by observing it.
    //
    // The membership check below is what actually settles the question, and
    // the shared property it finds is real but is not a finding about the
    // meter's dynamics: it is the definition of clause 2 restated.
    expect(lax.focusReachable - strict.focusReachable).toBe(14);
    // ── [session 64] THIS CLAIM WAS WRONG, AND LIVE PLAY FALSIFIED IT ──────
    //
    // It read: "The Relaxing trigger is unaffected: a lethal fish is never the
    // last state." That held across 101 casts and then broke on the 102nd.
    // Cast 13019015 ESCAPED with `fishHp: 1` — the fish was alive, at lethal
    // range, on the terminal state, with no turn left to spend a Relaxing Oil
    // into. The lax definition calls that reachable; it was not.
    //
    // So the clause now demonstrably defends BOTH triggers on real data, not
    // just the Focus one.
    //
    // [session 65] **IT HAPPENED AGAIN — the gap is 1 -> 2.** A second cast in
    // the seven-cast batch ended with a live fish at lethal range and no turn
    // left. One occurrence was a counter-example to a claim; two in
    // consecutive batches make it an ordinary way for a cast to end, and the
    // "with a turn remaining" clause is load-bearing for the Relaxing trigger
    // rather than incidentally correct there. Note the direction: each such
    // cast makes the LAX definition look better than reality, which is the
    // flattering direction and therefore the dangerous one.
    expect(lax.relaxingReachable - strict.relaxingReachable).toBe(2);
    expect(strict.relaxingReachable).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// [session 66 §2] THE EXPECTED COST OF ZERO RELAXING STOCK
//
// Pinned here so the report cannot drift from the corpus.
// `handoff/reports/session-66-relaxing-cost.md`,
// `npx tsx scripts/oilReachability.ts --relaxing-cost`.
// ---------------------------------------------------------------------------

describe("what holding zero Mid Relaxing Oil costs — EXPECTED, not observed", () => {
  const rows = loadFishingCorpus().map((c) => castReachability(c, { requireTurnRemaining: true }));
  const reachable = rows.filter((r) => r.relaxingReachable);

  it("finds the lethal trigger reachable on 12 of 109 casts, over 14 decision points", () => {
    expect(rows).toHaveLength(109);
    expect(reachable).toHaveLength(12);
    expect(rows.reduce((n, r) => n + r.relaxingPoints, 0)).toBe(14);
  });

  it("THE FINDING: ten of the twelve were caught anyway, so only two casts could have been converted", () => {
    // This is the number that makes the estimate small, and it is the one a
    // dry-trigger COUNT hides completely. The trigger fires at `fishHp <= 2`
    // with a turn to play, and a fish that low usually dies to the next card,
    // which deals far more than the oil's 2. The oil earns only in the residue
    // where that card misses.
    expect(reachable.filter((r) => r.caught)).toHaveLength(10);
    expect(reachable.filter((r) => !r.caught).map((r) => r.docId).sort()).toEqual(["12975713", "12991353"]);
  });

  it("prices it per oil, which is where the corpus and the sim actually agree", () => {
    const gained = reachable.filter((r) => !r.caught).length;
    const oils = reachable.length; // on-demand spends at the FIRST lethal point
    expect(gained / oils).toBeCloseTo(0.167, 3);
    // The sim's `lethal-relaxing-only` arm: +4.47pp for 1821 oils over 8000
    // casts = 0.196 extra catches per oil. Close. The HEADLINE pp is not close
    // — 4.47 vs 1.83 — because the sim reaches the lethal band on 22.8% of
    // casts against this corpus's 11.0%. Trigger RATE, not oil value, and it
    // is why +4.47pp must not be quoted as the live cost of zero stock.
    expect((100 * reachable.length) / rows.length).toBeCloseTo(11.0, 1);
    expect((100 * 1821) / 8000).toBeCloseTo(22.8, 1);
  });

  it("and the numerator is two casts, so the interval is the thing to quote", () => {
    // +1.83pp point estimate, 95% Wilson [0.5pp, 6.4pp] — 0.10 to 1.29 extra
    // fish a day at the 20-cast cap. Reported as expected, never as observed:
    // this corpus was played with zero Relaxing Oil in stock, and the single
    // live consume on record (session 65, fishHp 1 -> 0, CAUGHT) confirms the
    // mechanism and calibrates no rate.
    const gained = reachable.filter((r) => !r.caught).length;
    expect(gained).toBe(2);
    expect((100 * gained) / rows.length).toBeCloseTo(1.83, 2);
  });
});

// ---------------------------------------------------------------------------
// [session 66 §3] THE MEMBERSHIP CHECK — settled by cast id, not by count
//
// `npx tsx scripts/oilReachability.ts --gap` prints all of this.
// ---------------------------------------------------------------------------

describe("the 14-cast gap, answered by MEMBERSHIP", () => {
  const corpus = loadFishingCorpus();
  const gap = corpus.filter(
    (c) =>
      castReachability(c, { requireTurnRemaining: false }).focusReachable &&
      !castReachability(c, { requireTurnRemaining: true }).focusReachable,
  );

  it("is these exact 14 casts, and NONE of them is one of the seven added in session 65", () => {
    // The ids are the answer to "are they the same 14 at both corpus sizes?".
    // They are — necessarily, see the withdrawn claim above — and every one of
    // them predates the last batch.
    expect(gap.map((c) => c.docId).sort()).toEqual([
      "12923189",
      "12942026",
      "12942155",
      "12944922",
      "12945306",
      "12945313",
      "12956660",
      "12956727",
      "12957029",
      "12957061",
      "12957129",
      "12975708",
      "12975724",
      "12991326",
    ]);
    const newest7 = new Set(
      corpus
        .map((c) => ({ docId: c.docId, first: orderedResponses(c)[0]?.updatedAt ?? "" }))
        .sort((a, b) => a.first.localeCompare(b.first))
        .slice(-7)
        .map((c) => c.docId),
    );
    expect(gap.filter((c) => newest7.has(c.docId))).toHaveLength(0);
  });

  it("shares a property, and it is clause 2 restated rather than a fact about the meter", () => {
    // Every member is a cast that ESCAPED with the fish alive, whose focus
    // meter reached zero for the first and ONLY time on the state that ended
    // the cast. Hence: exactly one extra decision point under the lax reading,
    // and exactly one lax focus point.
    for (const c of gap) {
      const lax = castReachability(c, { requireTurnRemaining: false });
      const strict = castReachability(c, { requireTurnRemaining: true });
      expect(lax.caught).toBe(false);
      expect(lax.decisionPoints).toBe(strict.decisionPoints + 1);
      expect(lax.focusPoints).toBe(1);
    }
  });

  it("a CAUGHT cast can never be in the gap, which is why all 14 escaped", () => {
    // Not a property of the 14 — a property of the definition. A caught cast's
    // terminal state has `fishHp: 0`, so it fails clause 1 (alive) and the lax
    // reading adds nothing to it. 23 of the 109 casts are caught and all 23 are
    // excluded structurally.
    const caught = corpus.filter((c) => c.responses.some((r) => r.caughtFish !== null));
    expect(caught).toHaveLength(23);
    expect(caught.filter((c) => gap.some((g) => g.docId === c.docId))).toHaveLength(0);
  });

  it("and the gap is NOT simply 'escaped with an empty meter at the end' — that set is 66", () => {
    // This is the measurement that stops the shared property from being
    // overstated. 66 escaped casts end alive with the meter at zero; 52 of them
    // had ALREADY hit zero with a turn still to play, so the strict reading
    // calls them reachable too and they are not in the gap. The gap is the
    // residue: 66 - 52 = 14.
    const escaped = corpus.filter((c) => !c.responses.some((r) => r.caughtFish !== null));
    expect(escaped).toHaveLength(86);
    const terminalMeterZero = escaped.filter((c) => {
      const ordered = orderedResponses(c);
      const last = ordered[ordered.length - 1];
      return !!last && last.board.fishHp > 0 && last.board.focusMeter <= 0;
    });
    expect(terminalMeterZero).toHaveLength(66);
    const alreadyStrict = terminalMeterZero.filter((c) => castReachability(c, { requireTurnRemaining: true }).focusReachable);
    expect(alreadyStrict).toHaveLength(52);
    expect(terminalMeterZero.length - alreadyStrict.length).toBe(gap.length);
  });
});
