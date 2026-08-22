/**
 * tests/requireInputs.test.ts — [session 76 §2].
 *
 * Guards `scripts/lib/requireInputs.ts`, the shared fail-closed preflight the
 * analysis scripts call. This is PROGRAM LOGIC, not author data: it ships, it
 * runs for a stranger, and the stranger is the person it exists for — they are
 * the one whose `data/` is empty. So it is tested against temp trees it builds
 * itself and never reads a real corpus path (CLAUDE.md's isolated-path rule).
 *
 * The three shapes matter separately, because each one is a way a script
 * silently degraded before: an ABSENT file (`loadTransitionRecords` returns
 * `[]`), an EMPTY file (same, one line later), and a DIRECTORY THAT EXISTS BUT
 * HOLDS NOTHING THIS SCRIPT READS — a `logs/` full of dungeon logs and no
 * `fishing-*.jsonl` produces a live column of zero and looks like a finding.
 *
 * Writes only inside `mkdtempSync`; removes it afterwards.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatMissingInputs, missingInputs } from "../scripts/lib/requireInputs.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "require-inputs-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("missingInputs", () => {
  it("passes a present, non-empty file", () => {
    const p = join(root, "corpus.jsonl");
    writeFileSync(p, '{"a":1}\n', "utf8");
    expect(missingInputs([{ path: p, what: "the corpus" }])).toEqual([]);
  });

  it("reports an absent path", () => {
    const p = join(root, "nope.jsonl");
    expect(missingInputs([{ path: p, what: "the corpus" }])).toEqual([{ path: p, what: "the corpus", reason: "absent" }]);
  });

  it("reports a present but EMPTY file — the loaders cannot tell it from an absent one", () => {
    const p = join(root, "corpus.jsonl");
    writeFileSync(p, "", "utf8");
    expect(missingInputs([{ path: p, what: "the corpus" }])[0]?.reason).toBe("empty file");
  });

  it("passes a directory holding at least one matching entry", () => {
    const d = join(root, "logs");
    mkdirSync(d);
    writeFileSync(join(d, "fishing-2026-01-01.jsonl"), "{}\n", "utf8");
    expect(missingInputs([{ path: d, what: "shadow records", matching: (n) => n.startsWith("fishing-") }])).toEqual([]);
  });

  it("reports a directory that exists but holds nothing the script reads", () => {
    // The failure mode this half exists for: a log tree full of the OTHER
    // loop's files scores zero live firings and reads as a measurement.
    const d = join(root, "logs");
    mkdirSync(d);
    writeFileSync(join(d, "dungeon-2026-01-01.jsonl"), "{}\n", "utf8");
    expect(missingInputs([{ path: d, what: "shadow records", matching: (n) => n.startsWith("fishing-") }])[0]?.reason).toBe(
      "no matching entries",
    );
  });

  it("reports every unusable input, in order — one run tells you the whole story", () => {
    const a = join(root, "a.jsonl");
    const b = join(root, "b.jsonl");
    writeFileSync(b, "", "utf8");
    const missing = missingInputs([
      { path: a, what: "first" },
      { path: b, what: "second" },
    ]);
    expect(missing.map((m) => [m.path, m.reason])).toEqual([
      [a, "absent"],
      [b, "empty file"],
    ]);
  });
});

describe("formatMissingInputs", () => {
  it("names the path and what it was for — a message that says only 'missing input' is not actionable", () => {
    const text = formatMissingInputs("someScript.ts", [{ path: "data/x.jsonl", what: "the step table", reason: "absent" }]);
    expect(text).toContain("someScript.ts");
    expect(text).toContain("data/x.jsonl");
    expect(text).toContain("the step table");
    expect(text).toContain("absent");
  });

  it("tells a stranger this is the EXPECTED state in a clone, not a bug in the code they received", () => {
    // The whole reason a script may exit non-zero on someone's first run
    // without that reading as broken software.
    const text = formatMissingInputs("someScript.ts", [{ path: "data/x.jsonl", what: "the step table", reason: "absent" }]);
    expect(text).toMatch(/gitignored and do not ship/);
    expect(text).toMatch(/not a bug in the code you received/);
  });
});
