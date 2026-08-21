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
   */
  it("reports reachability over all 95 casts", () => {
    const r = reachabilityReport(loadFishingCorpus());
    expect(r.casts).toBe(95);
    expect(r.totalDecisionPoints).toBe(413);
    expect(r.relaxingReachable).toBe(9);
    expect(r.focusReachable).toBe(56);
    expect(r.eitherReachable).toBe(60);
    expect(r.neitherReachable).toBe(35);
    expect(r.totalRelaxingPoints).toBe(9);
    expect(r.totalFocusPoints).toBe(184);
  });

  it("shows the lax definition inflating Focus reachability on the real corpus", () => {
    const strict = reachabilityReport(loadFishingCorpus());
    const lax = reachabilityReport(loadFishingCorpus(), { requireTurnRemaining: false });
    expect(lax.focusReachable).toBe(70);
    // 14 real casts whose only meter-zero state is the one the policy could
    // never have acted on. The error is in the flattering direction.
    expect(lax.focusReachable - strict.focusReachable).toBe(14);
    // The Relaxing trigger is unaffected: a lethal fish is never the last state.
    expect(lax.relaxingReachable).toBe(strict.relaxingReachable);
  });
});
