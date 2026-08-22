/**
 * tests/helpers/assertionCount.ts — [session 77 §1] a vitest SETUP file, not a
 * test. Loaded only by `vitest.assertions.config.ts`, which
 * `scripts/assertionCoverage.ts` runs.
 *
 * ## What it measures and why nothing else could
 *
 * `tests/helpers/authorData.ts` guards one way for a test to stop testing: the
 * author's data is missing, so the file goes red (session 68) or an early
 * `return` makes it silently green (session 76). Sessions 68 and 76 both scoped
 * that class to SHIPPING — "can a stranger clone this and get a green suite".
 * That was the visible cause, not the class.
 *
 * **The class is an assertion that does not run**, and a missing file is only
 * one way to get there. A conditional whose branch is never taken is another,
 * and it is invisible to every detector built so far: no `existsSync` to grep
 * for, and the test count is IDENTICAL in the export and at home because the
 * test runs and passes in both. `tests/dungeonSim.test.ts:177` was exactly
 * that, green and empty since the day it was written.
 *
 * So this measures the thing itself rather than a proxy for it: after every
 * test, how many `expect()` calls did it actually make? Zero is a test whose
 * name claims something no assertion supports. There are no false positives by
 * construction — a static "the only expect sits behind an if" grep returns
 * three candidates in this repo, and two of them do assert.
 *
 * Skipped tests never run `afterEach`, so declared author-data skips do not
 * appear here and cannot dilute the count.
 *
 * Writes one JSON line per test to `$ASSERTION_COUNT_OUT`, which the script
 * sets to a temp path. Never a real data path.
 */
import { afterEach, expect } from "vitest";
import { appendFileSync } from "node:fs";

afterEach((ctx) => {
  const out = process.env.ASSERTION_COUNT_OUT;
  if (!out) return;
  const task = ctx.task as { name?: string; mode?: string; file?: { name?: string } } | undefined;
  const calls = (expect.getState() as { assertionCalls?: number }).assertionCalls ?? 0;
  appendFileSync(
    out,
    `${JSON.stringify({ file: task?.file?.name ?? "?", name: task?.name ?? "?", mode: task?.mode ?? "?", calls })}\n`,
    "utf8",
  );
});
