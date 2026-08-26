/**
 * [session 100 §B, QUESTIONS.md §57] The proc-evidence channel.
 *
 * Two claims are pinned here, and they are the two the CAPTURE-1 verdict rests
 * on. Both are computed from the committed corpus, so they move only when the
 * corpus moves — and when it does, the direction is what matters, not the
 * exact number.
 *
 *  1. **`triggeredBoons` has never populated.** Not once, on either side, in
 *     the whole recorded history. This is the field session 99 was waiting on.
 *  2. **`data.events[]` is the channel that DID populate**, and its `use_move`
 *     proc booleans map to the five rolled stats — evidenced by a zero-stat
 *     control that must stay exactly zero.
 *
 * The zero-stat control is the load-bearing assertion. A `blockProc0: true`
 * recorded while the actor's `block` was 0 would mean the flag is not reading
 * the stat this repo thinks it is, and every downstream proc-rate estimate
 * would be measuring the wrong thing.
 * **Scans a BOUNDED slice**, to bound what this test pays as the corpus grows:
 * it is append-only, already ~5300 states, and a test that re-parses all of it
 * re-parses more every session for an invariant a slice establishes just as
 * well. The FULL-CORPUS totals belong to `npx tsx scripts/procEvidence.ts` and
 * QUESTIONS.md §57; the INVARIANTS belong here.
 *
 * **A warning about the timing claims that were nearly written here.** Two
 * different "the full scan times out other test files" rationales were drafted
 * for this comment and both were withdrawn. The full-suite runs they rested on
 * were taken on a machine with a load average of 17 and 49 stray node
 * processes from unrelated sessions, and one comparison also had two vitest
 * processes running at once. Nothing measured under that is evidence about
 * this scan. The slice is here for the growth reason above and no other; do
 * not re-derive a performance justification from this file's history.
 */

import { describe, expect, it } from "vitest";

import { buildProcEvidenceReport, PROC_FLAG_TO_STAT } from "../scripts/procEvidence.js";

/**
 * Enough runs to give every flag hundreds of observations and the zero-stat
 * control a real denominator, while staying well under a second.
 */
const RUN_DIRS_SCANNED = 20;

const report = buildProcEvidenceReport({ maxRunDirs: RUN_DIRS_SCANNED });

describe("triggeredBoons — the field that gates nothing", () => {
  it("has never been non-empty, on any player, in any captured state", () => {
    // Full corpus at session 100: 0 of 10,616. This slice re-proves the zero
    // on a few thousand of them; the total is QUESTIONS.md §57's to report.
    expect(report.triggeredBoonsSeen).toBeGreaterThan(1_000);
    expect(report.triggeredBoonsNonEmpty).toBe(0);
  });

  it("is not an absent-field artifact — it is present on every player object it is counted on", () => {
    // Two players per state, so the occurrence count must be exactly twice the
    // state count. If it ever isn't, the field started being omitted rather
    // than being empty, which is a DIFFERENT finding and must not be read as
    // this one.
    expect(report.triggeredBoonsSeen).toBe(report.states * 2);
  });
});

describe("data.events — the channel that actually carries proc evidence", () => {
  it("populates on the corpus, on a large minority of states", () => {
    expect(report.statesWithEventsKey).toBeGreaterThan(300);
    expect(report.useMoveEvents).toBeGreaterThan(600);
  });

  it("carries a boolean for every one of the five rolled stats CAPTURE-1 is blocked on", () => {
    const stats = new Set(
      Object.keys(report.procs).map((flag) => PROC_FLAG_TO_STAT[flag.replace(/[01]$/, "")]),
    );
    expect([...stats].sort()).toEqual(["block", "evasion", "intuition", "lck", "tenacity"]);
  });

  it("is a channel that actually fires — not another silent field", () => {
    // Every flag is well-observed on the slice...
    for (const [flag, tally] of Object.entries(report.procs)) {
      expect(tally.n, `${flag} observations`).toBeGreaterThan(300);
    }
    // ...but "every flag fires at least once" is a FULL-CORPUS claim and must
    // not be asserted on a slice. The rarest two — `evadeProc0` and
    // `intuitionProc0` — fire 6 times each across all 1919 exchanges (0.31%),
    // so a 20-run slice legitimately contains zero of them. Asserting
    // otherwise would be a test that fails on honest data. (It does hold on
    // the full corpus; `scripts/procEvidence.ts` prints it.)
    //
    // What a slice CAN carry is that the channel is alive: several distinct
    // flags fire, which is exactly the property `triggeredBoons` lacks.
    const flagsThatFired = Object.values(report.procs).filter((t) => t.fired > 0).length;
    expect(flagsThatFired, "no proc flag fired anywhere on the slice").toBeGreaterThanOrEqual(3);
  });

  it("★ zero-stat control: no flag has EVER fired while its own stat read 0", () => {
    // This is the assertion that turns a naming coincidence into a mapping.
    for (const [flag, ctl] of Object.entries(report.zeroStatControl)) {
      expect(ctl.n, `${flag} zero-stat observations`).toBeGreaterThan(50);
      expect(ctl.firedAtZero, `${flag} fired while its stat was 0`).toBe(0);
    }
  });

  it("cross-checks intuition against its own visible consequence", () => {
    // An intuition proc emits a separate `intuition_block` event naming the
    // move it blocked. The two counts agreeing is independent corroboration
    // that `intuitionProc0` means what the name says.
    expect(report.intuitionBlockEvents).toBe(report.procs.intuitionProc0!.fired);
  });

  it("records no intuitionProc1 — the enemy side never rolls intuition", () => {
    // Consistent with the enemy's `intuition` being 0 in every captured state.
    // If an `intuitionProc1` ever appears, enemies gained a mechanic and the
    // opponent model needs to know.
    expect(report.procs.intuitionProc1).toBeUndefined();
  });
});
