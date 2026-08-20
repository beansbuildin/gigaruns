/**
 * tests/fishing/matcherVerdict.test.ts — QUESTIONS.md §19's decision rule.
 *
 * The rule is code specifically so it cannot be renegotiated once the live
 * numbers are visible, and that only holds if every branch is pinned BEFORE
 * the batch runs. The live corpus cannot exercise the pi branches at all
 * today (0 of 129 rows carry `matcherWeight`), so the branch coverage here is
 * synthetic by necessity — which is fine, because the rule is a function of
 * the rows and nothing else.
 */

import { describe, expect, it } from "vitest";

import {
  buildMatcherWeightReport,
  DETECTABLE_CROSSING_RATE,
  MIN_INSTRUMENTED_TURNS,
  PI_DECISION_THRESHOLD,
  REPLAY_REFERENCE,
  SESSION_51_VERDICT,
  type MatcherWeightRow,
} from "../../src/strategy/fishing/matcherVerdict.js";
import { parseReportArgs, selectBatch } from "../../scripts/matcherWeightReport.js";
import { loadRingPredictions } from "../../scripts/liveFishing.js";
import type { RingPredictionRecord } from "../../scripts/liveFishing.js";

const row = (o: Partial<MatcherWeightRow> & { castId: string; turn: number }): MatcherWeightRow => ({
  tier: "matcher_ring",
  hit: false,
  ...o,
});

describe("buildMatcherWeightReport — CLAUDE.md rule 10, the trap this rule must not fall into", () => {
  it("returns INSUFFICIENT_DATA, not a verdict, when every matcher row predates the instrumentation", () => {
    const rows = [row({ castId: "a", turn: 0 }), row({ castId: "a", turn: 1 }), row({ castId: "b", turn: 0 })];
    const r = buildMatcherWeightReport(rows);
    expect(r.verdict).toBe("INSUFFICIENT_DATA");
    expect(r.activeTurns).toBe(0);
    expect(r.unmeasuredTurns).toBe(3);
    expect(r.distribution).toBeNull();
    // The 0.9 default is the whole hazard — it must appear nowhere.
    expect(r.casts.every((c) => Number.isNaN(c.maxPi))).toBe(true);
  });

  it("distinguishes 'the tier never fired' from 'it fired but was not measured'", () => {
    const r = buildMatcherWeightReport([row({ castId: "a", turn: 0, tier: "ring" })]);
    expect(r.verdict).toBe("INSUFFICIENT_DATA");
    expect(r.unmeasuredTurns).toBe(0);
    expect(r.rationale).toMatch(/never fired/);
  });

  it("counts a measured row even when its weight is 0 — a refuted matcher is data, not absence", () => {
    const r = buildMatcherWeightReport([row({ castId: "a", turn: 0, matcherWeight: 0 })]);
    expect(r.activeTurns).toBe(1);
    // [session 61] The point of this test is the COUNT — that pi = 0 is a
    // measurement and not a missing field. The verdict at n=1 is now
    // INSUFFICIENT_DATA rather than DROP (the minimum-n clause), which does not
    // weaken the thing being asserted: `activeTurns` is 1, so the row was
    // counted, and the rule 10 hazard it guards against is untouched.
    expect(r.verdict).toBe("INSUFFICIENT_DATA");
    expect(r.unmeasuredTurns).toBe(0);
  });
});

describe("buildMatcherWeightReport — the two verdicts session 51 named", () => {
  it("DROP when pi never exceeds the threshold on any cast AND the minimum is reached", () => {
    // [session 61] Padded to the minimum. Under session 51's rule these three
    // rows alone returned DROP; under the rule now in force they return
    // INSUFFICIENT_DATA, which is the test immediately below. Built from
    // `MIN_INSTRUMENTED_TURNS` rather than from 32, so raising N never silently
    // turns this into a test of a different branch.
    const rows = [
      row({ castId: "a", turn: 0, matcherWeight: 0.12, hit: true }),
      row({ castId: "a", turn: 1, matcherWeight: 0.49 }),
      row({ castId: "b", turn: 0, matcherWeight: 0.5 }), // exactly at the threshold is NOT above it
      ...Array.from({ length: MIN_INSTRUMENTED_TURNS }, (_, i) =>
        row({ castId: "pad", turn: i, matcherWeight: 0.1 }),
      ),
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.activeTurns).toBeGreaterThanOrEqual(MIN_INSTRUMENTED_TURNS);
    expect(r.verdict).toBe("DROP");
    expect(r.crossingCastIds).toEqual([]);
    expect(r.verdictIsPowered).toBe(true);
    expect(r.turnsRemaining).toBe(0);
  });

  it("KEEP when pi crosses AND that cast hits above the batch base rate", () => {
    const rows = [
      // cast a: crosses, and hits on both its turns (100% vs a base rate of 50%)
      row({ castId: "a", turn: 0, matcherWeight: 0.8, hit: true }),
      row({ castId: "a", turn: 1, matcherWeight: 0.9, hit: true }),
      // cast b: never crosses, misses both — drags the base rate down
      row({ castId: "b", turn: 0, matcherWeight: 0.1 }),
      row({ castId: "b", turn: 1, matcherWeight: 0.1 }),
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.baseHitRate).toBe(0.5);
    expect(r.crossingCastIds).toEqual(["a"]);
    expect(r.verdict).toBe("KEEP");
  });
});

describe("buildMatcherWeightReport — the third case, named rather than folded in", () => {
  it("EARNED_BUT_UNPAID when pi crosses but no crossing cast beats the base rate", () => {
    const rows = [
      // cast a crosses but hits 0 of 2
      row({ castId: "a", turn: 0, matcherWeight: 0.9 }),
      row({ castId: "a", turn: 1, matcherWeight: 0.95 }),
      // cast b never crosses and hits 2 of 2, so the base rate is 50%
      row({ castId: "b", turn: 0, matcherWeight: 0.1, hit: true }),
      row({ castId: "b", turn: 1, matcherWeight: 0.1, hit: true }),
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.verdict).toBe("EARNED_BUT_UNPAID");
    expect(r.rationale).toMatch(/third case/);
  });

  it("a crossing cast merely EQUAL to the base rate does not count as paying", () => {
    const rows = [
      row({ castId: "a", turn: 0, matcherWeight: 0.9, hit: true }),
      row({ castId: "a", turn: 1, matcherWeight: 0.9 }),
      row({ castId: "b", turn: 0, matcherWeight: 0.1, hit: true }),
      row({ castId: "b", turn: 1, matcherWeight: 0.1 }),
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.baseHitRate).toBe(0.5);
    expect(r.verdict).toBe("EARNED_BUT_UNPAID");
  });
});

describe("buildMatcherWeightReport — the distribution, which is the finding even when the verdict is not", () => {
  it("reports quartiles and both reference fractions, not just the crossing", () => {
    const weights = [0.05, 0.1, 0.14, 0.2, 0.6];
    const rows = weights.map((w, i) => row({ castId: "a", turn: i, matcherWeight: w }));
    const d = buildMatcherWeightReport(rows).distribution!;
    expect(d.n).toBe(5);
    expect(d.min).toBe(0.05);
    expect(d.max).toBe(0.6);
    expect(d.median).toBe(0.14);
    expect(d.fractionBelowReference).toBeCloseTo(3 / 5); // <= 0.15
    expect(d.fractionAboveDecisionThreshold).toBeCloseTo(1 / 5);
  });

  it("reports opening focus spend with an interval, from turn-0 rows only", () => {
    const rows = [
      row({ castId: "a", turn: 0, matcherWeight: 0.1, focusMoveCost: 2 }),
      row({ castId: "a", turn: 1, matcherWeight: 0.1, focusMoveCost: 99 }), // not turn 0 — must be ignored
      row({ castId: "b", turn: 0, matcherWeight: 0.1, focusMoveCost: 0 }),
    ];
    const f = buildMatcherWeightReport(rows).openingFocus!;
    expect(f.n).toBe(2);
    expect(f.mean).toBe(1);
  });

  it("the threshold is a single named constant, so the rule has exactly one number in it", () => {
    expect(PI_DECISION_THRESHOLD).toBe(0.5);
  });
});

describe("batch selection", () => {
  const rec = (castId: string, ts: string, turn = 0): RingPredictionRecord =>
    ({ castId, ts, turn, tier: "ring", hit: false }) as unknown as RingPredictionRecord;

  it("--since filters on row timestamp, inclusive", () => {
    const rows = [rec("a", "2026-08-19T00:00:00Z"), rec("b", "2026-08-20T12:00:00Z")];
    const args = parseReportArgs(["--since=2026-08-20T12:00:00Z"]);
    expect(selectBatch(rows, args).map((r) => r.castId)).toEqual(["b"]);
  });

  it("--last-casts takes the N most recently started casts, counting a cast once however its turns interleave", () => {
    const rows = [
      rec("a", "2026-08-20T00:00:00Z", 0),
      rec("b", "2026-08-20T00:00:01Z", 0),
      rec("a", "2026-08-20T00:00:02Z", 1),
      rec("c", "2026-08-20T00:00:03Z", 0),
    ];
    const args = parseReportArgs(["--last-casts=2"]);
    expect([...new Set(selectBatch(rows, args).map((r) => r.castId))]).toEqual(["b", "c"]);
  });

  it("rejects a malformed --last-casts / --since rather than silently reporting on the wrong batch", () => {
    expect(() => parseReportArgs(["--last-casts=0"])).toThrow(/positive integer/);
    expect(() => parseReportArgs(["--last-casts=abc"])).toThrow(/positive integer/);
    expect(() => parseReportArgs(["--since=not-a-date"])).toThrow(/ISO timestamp/);
  });

  it("defaults to the real log and transitions paths", () => {
    const args = parseReportArgs([]);
    expect(args.logPath).toMatch(/ringPrediction\.jsonl$/);
    expect(args.transitionsPath).toMatch(/fish-patterns\.jsonl$/);
    expect(args.since).toBeUndefined();
  });
});

describe("against the real corpus — end to end, so the only untested thing on the day is the data", () => {
  it("§19 is UNDER-POWERED, not settled: the live batch is real but below the minimum, so the verdict is INSUFFICIENT_DATA", () => {
    // [session 61] THE GATE. This test used to assert DROP — session 51's rule,
    // applied to the 7 instrumented turns session 60 produced, returned exactly
    // that. The user's decision of 2026-08-20 was to gather more turns first,
    // encoded here as `MIN_INSTRUMENTED_TURNS`. Session 51's verdict is not
    // erased; it is preserved in `SESSION_51_VERDICT` and asserted below, so
    // the renegotiation is visible in the test suite rather than only in prose.
    //
    // **Pinned on `n < N`, never on the literal 7.** Session 60's own lesson
    // from rewriting this file: `activeTurns === 7` fires on the very next batch
    // and teaches whoever hits it to edit the number, which is how a
    // pre-registered rule erodes. Every assertion below is an inequality or a
    // reference to the constant. When the corpus finally crosses N this test
    // starts asserting DROP-or-KEEP on its own, which is the rule working.
    const rows = loadRingPredictions().map((r) => ({
      castId: r.castId,
      turn: r.turn,
      tier: r.tier,
      hit: r.hit,
      matcherWeight: r.matcherWeight,
      focusMoveCost: r.focusMoveCost,
    }));
    const report = buildMatcherWeightReport(rows);
    // Instrumented turns exist, and the pre-instrumentation ones are still
    // excluded rather than backfilled with the old fixed 0.9 (CLAUDE.md rule 10
    // — a constant is not a measurement).
    expect(report.activeTurns).toBeGreaterThan(0);
    expect(report.unmeasuredTurns).toBeGreaterThan(0);
    expect(report.activeTurns + report.unmeasuredTurns).toBeLessThanOrEqual(rows.length);
    // The state the corpus is actually in, expressed as the rule's condition
    // and not as a count.
    expect(report.activeTurns).toBeLessThan(MIN_INSTRUMENTED_TURNS);
    expect(report.verdict).toBe("INSUFFICIENT_DATA");
    expect(report.verdictIsPowered).toBe(false);
    expect(report.turnsRemaining).toBe(MIN_INSTRUMENTED_TURNS - report.activeTurns);
    expect(report.turnsRemaining).toBeGreaterThan(0);
    // The measurement itself is unchanged and still points the way session 51's
    // rule read it — this is a power problem, not a data problem.
    expect(report.distribution!.max).toBeLessThan(PI_DECISION_THRESHOLD);
    expect(report.crossingCastIds).toEqual([]);
    // The parts that never depended on the field still work, which is what
    // makes this an end-to-end validation rather than a smoke test.
    expect(report.baseHitTurns).toBe(rows.length);
    expect(report.openingFocus!.n).toBeGreaterThan(0);
  });
});

describe("the session-61 rule — the renegotiation, pinned so it cannot happen twice unnoticed", () => {
  it("preserves session 51's DROP verdict verbatim rather than erasing it", () => {
    expect(SESSION_51_VERDICT.verdict).toBe("DROP");
    expect(SESSION_51_VERDICT.activeTurns).toBe(7);
    expect(SESSION_51_VERDICT.maxPi).toBeLessThan(PI_DECISION_THRESHOLD);
    expect(SESSION_51_VERDICT.fractionAboveDecisionThreshold).toBe(0);
    expect(SESSION_51_VERDICT.supersededBy).toMatch(/renegotiation/i);
  });

  it("N is consistent with its own stated derivation: 80% power against the assumed crossing rate", () => {
    // The derivation, re-run as arithmetic rather than trusted from the comment:
    // N = ln(0.20)/ln(1 - p) at p = DETECTABLE_CROSSING_RATE, rounded up.
    const required = Math.ceil(Math.log(0.2) / Math.log(1 - DETECTABLE_CROSSING_RATE));
    expect(MIN_INSTRUMENTED_TURNS).toBeGreaterThanOrEqual(required);
    // And the power N actually buys is at least the 80% claimed.
    expect(1 - (1 - DETECTABLE_CROSSING_RATE) ** MIN_INSTRUMENTED_TURNS).toBeGreaterThanOrEqual(0.8);
    // The rate is the repo's own floor of measurability (SPEC §4e's 1-5% procs),
    // not a number invented for this rule.
    expect(DETECTABLE_CROSSING_RATE).toBe(0.05);
  });

  it("the minimum gates the DROP arm ONLY — an existence verdict fires at any n", () => {
    // Two turns. Session 51's rule and this one agree on KEEP here, and the
    // minimum is deliberately not consulted: a crossing that happened is not
    // made less real by a small sample.
    const rows = [
      row({ castId: "a", turn: 0, matcherWeight: 0.8, hit: true }),
      row({ castId: "b", turn: 0, matcherWeight: 0.1 }),
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.activeTurns).toBeLessThan(MIN_INSTRUMENTED_TURNS);
    expect(r.verdict).toBe("KEEP");
    // ...but it is reported UNPOWERED, because the payoff half is sampled.
    expect(r.verdictIsPowered).toBe(false);
    expect(r.rationale).toMatch(/UNPOWERED/);
  });

  it("EARNED_BUT_UNPAID is likewise an existence verdict and needs no minimum", () => {
    const rows = [
      row({ castId: "a", turn: 0, matcherWeight: 0.8 }),
      row({ castId: "b", turn: 0, matcherWeight: 0.1, hit: true }),
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.activeTurns).toBeLessThan(MIN_INSTRUMENTED_TURNS);
    expect(r.verdict).toBe("EARNED_BUT_UNPAID");
    expect(r.verdictIsPowered).toBe(false);
  });

  it("below the minimum with no crossing is INSUFFICIENT_DATA — the branch session 51 called DROP", () => {
    const rows = Array.from({ length: MIN_INSTRUMENTED_TURNS - 1 }, (_, i) =>
      row({ castId: `c${i}`, turn: 0, matcherWeight: 0.2 }),
    );
    const r = buildMatcherWeightReport(rows);
    expect(r.verdict).toBe("INSUFFICIENT_DATA");
    expect(r.turnsRemaining).toBe(1);
    // One more instrumented turn flips it to a real verdict — the boundary is
    // asserted from both sides so an off-by-one in the comparison cannot hide.
    const r2 = buildMatcherWeightReport([...rows, row({ castId: "last", turn: 0, matcherWeight: 0.2 })]);
    expect(r2.verdict).toBe("DROP");
    expect(r2.verdictIsPowered).toBe(true);
  });

  it("progress is denominated in TURNS and never divided by a cast rate", () => {
    // Ten turns spread over two casts and over five report the SAME remaining
    // count: what accrues is turns. Oils shorten casts, so a cast-denominated
    // count would drift the moment they land (session 61 §4b).
    const twoCasts = Array.from({ length: 10 }, (_, i) =>
      row({ castId: i < 5 ? "a" : "b", turn: i % 5, matcherWeight: 0.2 }),
    );
    const fiveCasts = Array.from({ length: 10 }, (_, i) =>
      row({ castId: `c${i % 5}`, turn: Math.floor(i / 5), matcherWeight: 0.2 }),
    );
    expect(buildMatcherWeightReport(twoCasts).turnsRemaining).toBe(MIN_INSTRUMENTED_TURNS - 10);
    expect(buildMatcherWeightReport(fiveCasts).turnsRemaining).toBe(MIN_INSTRUMENTED_TURNS - 10);
  });

  it("the replay reference the derivation rests on is unchanged, so N stays checkable", () => {
    expect(REPLAY_REFERENCE.medianPi).toBe(0.135);
    expect(REPLAY_REFERENCE.fractionBelow).toBe(0.705);
    expect(REPLAY_REFERENCE.belowThreshold).toBe(0.15);
  });
});
