/**
 * tests/helpers/authorData.ts — [session 68 §3] the ONE way a test declares
 * that it asserts over the AUTHOR'S accumulated data rather than over program
 * logic.
 *
 * ## The problem this exists for
 *
 * Four shipped test files assert against data that is correctly excluded from
 * the repo — `logs/`, `data/ringPrediction.jsonl`, `data/fish-patterns.jsonl`,
 * `handoff/`. A stranger who clones this and runs `npx vitest run` gets a red
 * suite on their first command, for reasons that are nothing to do with the
 * code they just received. Session 67's clean-export run measured it:
 * **4 failed | 1264 passed, and 11 more that never ran at all.**
 *
 * ## Two rules, and the second is the one that is easy to get wrong
 *
 * **1. The probe must not run at module or `describe` scope.** A file that
 * throws while being COLLECTED cannot report that it was skipped — it reports
 * nothing, and its tests silently stop existing. `rejectionAudit.test.ts` was
 * contributing 0 tests instead of 11 for exactly this reason, and the drop was
 * only findable by diffing JSON reporters. So a probe returns a verdict, it
 * never throws, and the actual load happens inside `beforeAll`.
 *
 * **2. A skip must be LOUD.** A silent skip is the same failure mode as a
 * vacuous assertion: green, and testing nothing. `announceMissingAuthorData`
 * prints to stderr at collection time, and `describe.skipIf` marks the tests
 * skipped rather than passed — so the run is visibly different from a run
 * where the data was there. Do not replace either half with a loosened
 * assertion; the point is a stranger's suite asserting CORRECTLY, not
 * asserting less.
 *
 * ## What does NOT belong here
 *
 * Program logic. If a test pins a rule the code must obey, it ships with
 * synthetic fixtures and always runs — see `matcherVerdict.test.ts`, which
 * guards a closed and load-bearing rule and must not stop shipping with the
 * code it guards.
 */

export interface AuthorDataProbe {
  /** True when the author's data is present and the assertions can mean something. */
  ok: boolean;
  /** Human-readable, printed on skip. Names what was missing, not merely that something was. */
  reason: string;
}

/**
 * Run `check` and convert any failure into a verdict. **Never throws** — that
 * is the entire contract, because the caller is at module scope.
 *
 * `check` should be cheap: existence and shape, not a full parse.
 */
export function probeAuthorData(label: string, check: () => void): AuthorDataProbe {
  try {
    check();
    return { ok: true, reason: "" };
  } catch (e) {
    return { ok: false, reason: `${label}: ${(e as Error).message}` };
  }
}

/**
 * Print the skip so it cannot pass for a pass. Called at module scope, beside
 * the probe, so it lands whether or not the suite gets as far as running.
 */
export function announceMissingAuthorData(file: string, probe: AuthorDataProbe): void {
  if (probe.ok) return;
  process.stderr.write(
    `\n  ⚠ SKIPPED (author data absent) — ${file}\n` +
      `    ${probe.reason}\n` +
      `    These assertions describe the author's own captures, not this code's behaviour.\n` +
      `    They are skipped, NOT passed. See tests/helpers/authorData.ts.\n\n`,
  );
}
