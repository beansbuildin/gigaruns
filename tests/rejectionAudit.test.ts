/**
 * [session 53, brief §0d] Pins the historical first-attempt rejection split so
 * a regression in request pacing fails the suite rather than sitting in a log
 * nobody reads — which is exactly how it survived thirty-nine sessions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { auditRunLog, summarize, defaultLogFiles, classify, PRE_SESSION_53_LOGS } from "../scripts/rejectionAudit.js";

function load(files: readonly string[]) {
  return files.flatMap((f) => auditRunLog(f, readFileSync(f, "utf8")));
}

/**
 * The corpus grows every session. These assertions are written as ">= the
 * historical count" for the classes that only accumulate, and as exact
 * statements about the SHAPE (zero overlap, zero numeric failures) that must
 * hold at any corpus size.
 */
describe("rejectionAudit — the pre-session-53 regime", () => {
  // Scoped to the ten pre-fix logs on purpose — see PRE_SESSION_53_LOGS.
  const byLabel = new Map(summarize(load(PRE_SESSION_53_LOGS)).map((s) => [s.label, s]));

  it("classifies start_run separately from the other empty-token actions", () => {
    // start_run is the CONTROL case for the timing model: same empty token, no
    // outstanding token at that moment, never rejected. Folding it into the
    // empty-token class would dilute exactly the number the gate reads.
    expect(classify({ action: "start_run", tokenClass: "empty" } as never)).toBe("start_run (empty)");
    expect(classify({ action: "reward_one", tokenClass: "empty" } as never)).toBe("empty token");
    expect(classify({ action: "rock", tokenClass: "numeric" } as never)).toBe("numeric token");
  });

  it("pins the 66 / 66 / 224 split", () => {
    const empty = byLabel.get("empty token")!;
    const numeric = byLabel.get("numeric token")!;
    expect(empty.decisions).toBe(66);
    expect(empty.firstAttemptFailures).toBe(66); // 100%, every decision, every log
    expect(numeric.decisions).toBe(227);
    expect(numeric.acceptedBand.n).toBe(224);
  });

  it("NEVER rejected a numeric-token POST or a start_run on its first attempt", () => {
    expect(byLabel.get("numeric token")!.firstAttemptFailures).toBe(0);
    expect(byLabel.get("start_run (empty)")!.firstAttemptFailures).toBe(0);
  });

  it("shows zero overlap between the rejected and accepted empty-token gap bands", () => {
    // The mechanism: the threshold sits in (1.54, 3.40) s measured since the
    // last RESPONSE. This is the evidence the 4000ms override rests on.
    const empty = byLabel.get("empty token")!;
    expect(empty.rejectedBand.maxMs!).toBeLessThan(empty.acceptedBand.minMs!);
    expect(empty.rejectedBand.maxMs!).toBeLessThanOrEqual(1540);
    expect(empty.acceptedBand.minMs!).toBeGreaterThanOrEqual(3400);
  });

  it("counts a retry as part of its decision, not as a second decision", () => {
    const empty = byLabel.get("empty token")!;
    expect(empty.n).toBe(empty.decisions + empty.firstAttemptFailures);
  });
});

describe("rejectionAudit — after the session-53 pacing fix", () => {
  const preFix = new Set(PRE_SESSION_53_LOGS);
  const postFixFiles = defaultLogFiles().filter((f) => !preFix.has(f));
  const records = load(postFixFiles).filter((r) => r.action !== "start_run");

  it("has post-fix logs to read at all", () => {
    expect(postFixFiles.length).toBeGreaterThan(0);
    expect(records.length).toBeGreaterThan(0);
  });

  it("rejects ZERO empty-token first attempts — the session-53 gate", () => {
    const empty = records.filter((r) => r.tokenClass === "empty" && r.isFirstAttempt);
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.filter((r) => r.failed)).toEqual([]);
  });

  it("actually paces the empty-token POSTs, and ONLY those", () => {
    // post -> outcome includes the rate limiter's sleep, so it is the measure
    // that shows the override landing. Numeric POSTs must be untouched.
    const empty = records.filter((r) => r.tokenClass === "empty" && r.postToOutcomeMs !== null);
    const numeric = records.filter((r) => r.tokenClass === "numeric" && r.postToOutcomeMs !== null);
    expect(Math.min(...empty.map((r) => r.postToOutcomeMs!))).toBeGreaterThanOrEqual(3600);
    expect(Math.max(...numeric.map((r) => r.postToOutcomeMs!))).toBeLessThan(2500);
  });
});

describe("rejectionAudit — parsing", () => {
  it("does not advance the response clock across a rejected attempt", () => {
    // A rejected POST issues no new token, so the outstanding one still dates
    // from the last SUCCESSFUL response. Getting this wrong is what makes the
    // accepted band look like ~1.4s instead of ~4.1s.
    const log = [
      { ts: "2026-08-20T00:00:00.000Z", event: "post_response", resp: "{}" },
      { ts: "2026-08-20T00:00:01.300Z", event: "post", body: { action: "reward_one", actionToken: "" } },
      { ts: "2026-08-20T00:00:01.600Z", event: "post_attempt_failed", reason: "reward selection rejected" },
      { ts: "2026-08-20T00:00:04.100Z", event: "post", body: { action: "reward_one", actionToken: "" } },
      { ts: "2026-08-20T00:00:05.500Z", event: "post_response", resp: "{}" },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");

    const recs = auditRunLog("mem", log);
    expect(recs).toHaveLength(2);
    expect(recs[0]!.failed).toBe(true);
    expect(recs[0]!.isFirstAttempt).toBe(true);
    expect(recs[0]!.sinceLastResponseMs).toBe(1300);
    expect(recs[1]!.failed).toBe(false);
    expect(recs[1]!.isFirstAttempt).toBe(false);
    expect(recs[1]!.sinceLastResponseMs).toBe(4100); // NOT 2500 from the failure
    expect(recs[1]!.sinceLastRequestMs).toBe(2500);
  });

  it("survives a truncated final line rather than losing the whole log", () => {
    const log =
      JSON.stringify({ ts: "2026-08-20T00:00:00.000Z", event: "post", body: { action: "rock", actionToken: 1 } }) + '\n{"ts":"2026-';
    expect(auditRunLog("mem", log)).toHaveLength(1);
  });

  it("reads the legacy stringified body shape the older logs use", () => {
    const log = JSON.stringify({
      ts: "2026-08-20T00:00:00.000Z",
      event: "use_item_post",
      body: "{'action': 'use_item', 'dungeonId': 5, 'actionToken': 1787185960756, 'data': {}}",
    });
    const r = auditRunLog("mem", log)[0]!;
    expect(r.action).toBe("use_item");
    expect(r.tokenClass).toBe("numeric");
  });
});
