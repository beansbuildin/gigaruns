/**
 * scripts/assertionCoverage.ts — [session 77 §1] **does every test actually
 * assert something?**
 *
 * ## Why this exists
 *
 * Three sessions built guards for tests that go quiet when a file is missing
 * (`tests/helpers/authorData.ts`, sessions 68 and 76). The one test in this
 * repo that was actually silent went quiet for a reason none of those guards
 * can see: `tests/dungeonSim.test.ts:177` asserted only inside
 * `if (r.outcome === "halted")`, and the simulated run cleared the room on
 * every seed tried, so the branch never ran. No missing file, no `existsSync`,
 * and the test count identical in a clone and at home — invisible to the
 * shipping-shaped detectors and to `scripts/preflight.ts` alike, because it
 * PASSED in both.
 *
 * **The class is "an assertion that does not run".** A missing author file is
 * one cause; an untaken branch is another; an empty loop body is a third. This
 * measures the class directly instead of enumerating its causes.
 *
 * ## Why a runtime count and not a grep
 *
 * The static version — every `it` whose only `expect` sits behind an `if` —
 * returns three candidates here, and two of them do assert on every run. A
 * ratchet pinned at 3 would ratchet two false positives into permanence and
 * train the next reader to ignore the alarm. The runtime count has no false
 * positives by construction: it counts `expect()` calls that happened.
 *
 * ## What a failure means, and what it does NOT mean
 *
 * A zero-assertion test is a test whose NAME claims something no assertion
 * supports. The fix is to make the claim true — construct the state the name
 * describes and assert unconditionally — **or to delete the test and record the
 * coverage gap.** It is never to make an unreachable assertion unconditional:
 * that trades a vacuous pass for a false failure and tests nothing either way.
 *
 * Skipped tests never run `afterEach`, so a declared author-data skip
 * (`describe.skipIf`) is absent from the tally rather than counted as vacuous.
 * That is correct: it announced itself, which is the whole point of the guard.
 *
 * Usage:  npx tsx scripts/assertionCoverage.ts [--verbose]
 * Exit:   0 = every test asserted at least once. 1 = at least one did not.
 *         2 = the run itself failed (a red suite, or vitest did not start).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Row {
  file: string;
  name: string;
  mode: string;
  calls: number;
}

function main(): void {
  const verbose = process.argv.includes("--verbose");
  // Isolated temp path, never a real data path — the setup file writes here.
  const dir = mkdtempSync(join(tmpdir(), "assertion-coverage-"));
  const out = join(dir, "counts.jsonl");
  writeFileSync(out, "", "utf8");

  console.log("▸ assertionCoverage — running the suite with an assertion counter attached.\n");

  let suiteFailed = false;
  try {
    execFileSync("npx", ["vitest", "run", "--config", "vitest.assertions.config.ts"], {
      encoding: "utf8",
      env: { ...process.env, ASSERTION_COUNT_OUT: out },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // A red suite is a different failure from a vacuous test, and it must not
    // be reported as one — the counts from a partial run mean nothing.
    suiteFailed = true;
    /**
     * [session 78, §5 / CODEXAUG22REVIEW L1] Print what vitest said.
     *
     * This script is now CI's ONLY suite run (the plain `npx vitest run` step
     * was removed — it was the second of three full runs of the same 1489
     * tests). That makes swallowing the output a real regression rather than a
     * tidiness question: without this, a red CI job would report "the suite did
     * not pass" and not one word about WHICH test, and the operator's next move
     * would be to re-run the suite locally to find out.
     *
     * The brief for this change said "nothing is lost" by dropping the plain
     * step. That was true of the pass/fail SIGNAL and not of the diagnostics;
     * this is the difference, closed rather than accepted.
     */
    const captured = e as { stdout?: string; stderr?: string };
    const text = `${captured.stdout ?? ""}${captured.stderr ?? ""}`.trim();
    if (text) console.log(`${text}\n`);
  }

  const rows: Row[] = readFileSync(out, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Row);
  rmSync(dir, { recursive: true, force: true });

  if (suiteFailed) {
    console.log("  ★★★ the suite did not pass. Fix that first — counts from a partial run mean nothing.");
    process.exit(2);
  }

  const zero = rows.filter((r) => r.calls === 0);
  console.log(`  ${rows.length} test(s) ran and were counted.`);
  if (verbose) {
    const byFile = new Map<string, number>();
    for (const r of rows) byFile.set(r.file, (byFile.get(r.file) ?? 0) + r.calls);
    for (const [f, c] of [...byFile.entries()].sort()) console.log(`    ${String(c).padStart(5)}  ${f}`);
  }

  if (zero.length === 0) {
    console.log("  ✓ every one of them called expect() at least once.\n");
    process.exit(0);
  }

  console.log(`\n  ★★★ ${zero.length} test(s) asserted NOTHING:\n`);
  for (const r of zero) {
    console.log(`    ${r.file}`);
    console.log(`      "${r.name}"`);
  }
  console.log(
    "\n  A test that asserts nothing passes for free and its name claims coverage\n" +
      "  it does not have. Construct the state the name describes and assert\n" +
      "  unconditionally, or delete it and record the gap. Do NOT simply remove the\n" +
      "  guard around the assertion — an unreachable assertion made unconditional is\n" +
      "  a false failure, not a test.\n",
  );
  process.exit(1);
}

main();
