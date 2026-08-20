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
  PI_DECISION_THRESHOLD,
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
    expect(r.verdict).toBe("DROP");
  });
});

describe("buildMatcherWeightReport — the two verdicts session 51 named", () => {
  it("DROP when pi never exceeds the threshold on any cast", () => {
    const rows = [
      row({ castId: "a", turn: 0, matcherWeight: 0.12, hit: true }),
      row({ castId: "a", turn: 1, matcherWeight: 0.49 }),
      row({ castId: "b", turn: 0, matcherWeight: 0.5 }), // exactly at the threshold is NOT above it
    ];
    const r = buildMatcherWeightReport(rows);
    expect(r.verdict).toBe("DROP");
    expect(r.crossingCastIds).toEqual([]);
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
  it("§19 is MEASURED: the live batch produced real matcherWeights and the verdict is DROP", () => {
    // [session 60] The good news this test was waiting for arrived. It used to
    // assert `activeTurns === 0` — "today's log is ENTIRELY pre-instrumentation"
    // — with a note saying to update it only once a live batch existed. The
    // first 5-cast batch played under instrumentation produced **7** matcher
    // turns, so §19 is measurable after nine sessions of waiting.
    //
    // The pinned values below are DELIBERATELY inequalities, not literals.
    // Every future live cast moves these counts, and the thing worth pinning is
    // session 51's pre-registered RULE — pi never crossing 0.5 means DROP —
    // which cannot be renegotiated now that the numbers are visible. Pinning
    // `activeTurns === 7` would just be a tripwire that fires on the next batch
    // and teaches whoever hits it to edit the number, which is how a rule
    // erodes.
    const rows = loadRingPredictions().map((r) => ({
      castId: r.castId,
      turn: r.turn,
      tier: r.tier,
      hit: r.hit,
      matcherWeight: r.matcherWeight,
      focusMoveCost: r.focusMoveCost,
    }));
    const report = buildMatcherWeightReport(rows);
    // Instrumented turns exist now, and the pre-instrumentation ones are still
    // excluded rather than backfilled with the old fixed 0.9 (CLAUDE.md rule 10
    // — a constant is not a measurement).
    expect(report.activeTurns).toBeGreaterThan(0);
    expect(report.unmeasuredTurns).toBeGreaterThan(0);
    expect(report.activeTurns + report.unmeasuredTurns).toBeLessThanOrEqual(rows.length);
    // Session 51's rule, applied to real data for the first time: pi never
    // exceeded 0.5 (max observed 0.255 over the first instrumented batch), so
    // the tier is DROPped. If a future batch pushes pi past 0.5 this flips to
    // KEEP on its own — that is the rule working, not this test breaking.
    expect(report.distribution!.max).toBeLessThan(0.5);
    expect(report.crossingCastIds).toEqual([]);
    expect(report.verdict).toBe("DROP");
    // The parts that never depended on the field still work, which is what
    // makes this an end-to-end validation rather than a smoke test.
    expect(report.baseHitTurns).toBe(rows.length);
    expect(report.openingFocus!.n).toBeGreaterThan(0);
  });
});
