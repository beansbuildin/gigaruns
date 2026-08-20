/**
 * [session 53, brief §1] The blind spot in one sentence: a per-class SUCCESS
 * rate that scores the retry as the outcome reports 100% for a class that was
 * rejected on every single first attempt.
 */
import { describe, it, expect } from "vitest";
import { AttemptTelemetry, FIRST_ATTEMPT_FAILURE_WARN_RATE } from "../../src/orchestrator/attemptTelemetry.js";

describe("AttemptTelemetry", () => {
  it("counts a first-attempt failure even when the retry succeeded", () => {
    const t = new AttemptTelemetry();
    for (let i = 0; i < 5; i++) t.record("reward_one", true); // all five retried successfully
    const [r] = t.report();
    expect(r!.attempts).toBe(5);
    expect(r!.firstAttemptFailures).toBe(5);
    expect(r!.rate).toBe(1);
    expect(r!.warn).toBe(true);
  });

  it("keeps classes separate and sorts worst-rate first", () => {
    const t = new AttemptTelemetry();
    for (let i = 0; i < 10; i++) t.record("rock", false);
    for (let i = 0; i < 4; i++) t.record("path_one", true);
    const rows = t.report();
    expect(rows.map((r) => r.actionClass)).toEqual(["path_one", "rock"]);
    expect(rows[1]!.rate).toBe(0);
    expect(rows[1]!.warn).toBe(false);
  });

  it("warns at the threshold, not merely above it", () => {
    const t = new AttemptTelemetry();
    // exactly 20% — the boundary case, which is the one a `>` would miss
    t.record("path_one", true);
    for (let i = 0; i < 4; i++) t.record("path_one", false);
    expect(t.report()[0]!.rate).toBe(FIRST_ATTEMPT_FAILURE_WARN_RATE);
    expect(t.report()[0]!.warn).toBe(true);
  });

  it("totals across classes", () => {
    const t = new AttemptTelemetry();
    t.record("rock", false);
    t.record("path_one", true);
    expect(t.totals()).toEqual({ attempts: 2, firstAttemptFailures: 1 });
  });

  it("formats a WARN line naming the class and the count", () => {
    const t = new AttemptTelemetry();
    for (let i = 0; i < 3; i++) t.record("reward_two", true);
    const out = t.format();
    expect(out).toContain("reward_two");
    expect(out).toContain("3/3");
    expect(out).toContain("100.0%");
    expect(out).toMatch(/⚠/);
  });

  it("says so plainly when nothing was recorded", () => {
    expect(new AttemptTelemetry().format()).toContain("none recorded");
  });

  it("reports a clean class without a warning", () => {
    const t = new AttemptTelemetry();
    for (let i = 0; i < 30; i++) t.record("path_one", false);
    expect(t.format()).not.toMatch(/⚠/);
    expect(t.report()[0]!.warn).toBe(false);
  });
});
