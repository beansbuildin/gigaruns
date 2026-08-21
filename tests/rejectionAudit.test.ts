/**
 * [session 53, brief §0d] Pins the historical first-attempt rejection split so
 * a regression in request pacing fails the suite rather than sitting in a log
 * nobody reads — which is exactly how it survived thirty-nine sessions.
 *
 * ## [session 68 §3/§3a] This file used to contribute ZERO tests, silently
 *
 * Both `describe` blocks loaded their corpus in the DESCRIBE BODY, which vitest
 * executes at COLLECTION. `logs/` is correctly excluded from the repo, so on
 * any clone the `readFileSync`/`readdirSync` threw before a single test was
 * registered — and a file that cannot be collected cannot report that it was
 * skipped. It reported nothing. The eleven tests below stopped existing, and
 * the drop was only findable by diffing the JSON reporters.
 *
 * That is a suite-integrity bug independent of portability, and it is the
 * family this repo keeps catching: a green-looking suite asserting less than
 * it appears to.
 *
 * **The fix is structural, not a try/catch.** The probe below returns a
 * verdict and never throws; the actual load happens in `beforeAll`, which only
 * runs if the suite is not skipped. So the file always collects, and the
 * outcome is one of exactly two visible states — eleven tests run, or eleven
 * tests are reported SKIPPED with a reason on stderr. Never zero, never green
 * for the wrong reason.
 *
 * `GIGA_TEST_LOGS_DIR` exists so the absent-data path can be exercised without
 * touching the author's real `logs/` — see the §3a demonstration in the
 * session-68 recap.
 */
import { beforeAll, describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { auditRunLog, summarize, defaultLogFiles, classify, PRE_SESSION_53_LOGS } from "../scripts/rejectionAudit.js";
import { announceMissingAuthorData, probeAuthorData } from "./helpers/authorData.js";

/** Redirectable so a test run can point at an empty directory instead of the author's captures. */
const LOGS_DIR = process.env.GIGA_TEST_LOGS_DIR ?? "logs";

/** The ten pre-fix logs, resolved against `LOGS_DIR` rather than hard-coded to `logs/`. */
const preFixLogs = PRE_SESSION_53_LOGS.map((f) => join(LOGS_DIR, basename(f)));

/**
 * **AUTHOR DATA.** These assertions describe captures accumulated across
 * ~60 sessions of real play. They are not statements about this code's
 * behaviour and cannot be reconstructed from the repo.
 */
const logsProbe = probeAuthorData(`run logs under ${LOGS_DIR}/`, () => {
  const missing = preFixLogs.filter((f) => !existsSync(f));
  if (missing.length > 0) {
    throw new Error(`${missing.length} of ${preFixLogs.length} pre-session-53 run logs absent (first: ${missing[0]})`);
  }
  if (!existsSync(LOGS_DIR)) throw new Error(`${LOGS_DIR}/ does not exist`);
  const postFix = defaultLogFiles(LOGS_DIR).filter((f) => !new Set(preFixLogs).has(f));
  if (postFix.length === 0) throw new Error(`no post-session-53 run logs in ${LOGS_DIR}/`);
});
announceMissingAuthorData("tests/rejectionAudit.test.ts", logsProbe);

function load(files: readonly string[]) {
  return files.flatMap((f) => auditRunLog(f, readFileSync(f, "utf8")));
}

/**
 * The corpus grows every session. These assertions are written as ">= the
 * historical count" for the classes that only accumulate, and as exact
 * statements about the SHAPE (zero overlap, zero numeric failures) that must
 * hold at any corpus size.
 */
describe.skipIf(!logsProbe.ok)("rejectionAudit — the pre-session-53 regime", () => {
  // Scoped to the ten pre-fix logs on purpose — see PRE_SESSION_53_LOGS.
  // Loaded in `beforeAll`, NOT here: a describe body runs at collection, and a
  // throw there deletes the tests instead of skipping them (§3a).
  let byLabel = new Map<string, ReturnType<typeof summarize>[number]>();
  beforeAll(() => {
    byLabel = new Map(summarize(load(preFixLogs)).map((s) => [s.label, s]));
  });

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

describe.skipIf(!logsProbe.ok)("rejectionAudit — after the session-53 pacing fix", () => {
  // Same reason as above: `defaultLogFiles()` calls `readdirSync`, which threw
  // at collection on any clone without the author's `logs/`.
  let postFixFiles: string[] = [];
  let records: ReturnType<typeof load> = [];
  beforeAll(() => {
    const preFix = new Set(preFixLogs);
    postFixFiles = defaultLogFiles(LOGS_DIR).filter((f) => !preFix.has(f));
    records = load(postFixFiles).filter((r) => r.action !== "start_run");
  });

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
