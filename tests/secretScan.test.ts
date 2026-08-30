/**
 * tests/secretScan.test.ts — session 111.
 *
 * `scripts/secretScan.ts` is a verification instrument, so the thing worth
 * testing is not "does it find a secret" but "can it report a pass while
 * measuring nothing". That is the failure this project has actually had:
 * session 109's scan read zero bytes and reported 0/4, and session 110's read
 * 1.3% of the tree and printed a bare file count that reads as full coverage.
 *
 * Every case below is built from strings concatenated at runtime, for the same
 * reason the scanner itself is: a test file containing literal example secrets
 * would flag under the scanner, and the last assertion here is that neither
 * this file nor the scanner does.
 *
 * No real path is read or written. The one filesystem case uses `mkdtempSync`,
 * per CLAUDE.md's rule that a test must never touch a real data path.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

import {
  ALLOWLIST,
  CONTROL_TOKEN,
  RULES,
  formatReport,
  preview,
  scanFiles,
  scanText,
  verifyMatchers,
  type ScanFile,
  type ScanRule,
} from "../scripts/secretScan.js";

const j = (...parts: string[]) => parts.join("");

/** A file that trips exactly one rule, plus the control token so control A is healthy. */
const withSecret = (path: string, secret: string): ScanFile => ({
  path,
  content: `{"${CONTROL_TOKEN}": "Thing#1", "note": "${secret}"}`,
});

/** A clean file — carries the control token and nothing else. */
const clean = (path: string): ScanFile => ({ path, content: `{"${CONTROL_TOKEN}": "Thing#1"}` });

describe("secretScan — control B, the matchers verify themselves", () => {
  it("every rule matches its own positive sample and misses the redactor's placeholder", () => {
    expect(verifyMatchers()).toEqual([]);
  });

  it("reports a rule that has been broken into matching nothing", () => {
    const broken: ScanRule = { ...RULES[0]!, pattern: /this-will-never-appear-anywhere/g };
    const failures = verifyMatchers([broken]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/did NOT match its own positive sample/);
  });

  it("reports a rule that would flag correctly-redacted content", () => {
    // A rule so loose it matches the placeholder itself — the false-positive
    // direction, which would train a reader to ignore the scan's output.
    const loose: ScanRule = { ...RULES[1]!, pattern: /0x[A-Za-z0-9]+/g };
    const failures = verifyMatchers([loose]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/matched the redactor's placeholder/);
  });

  it("a non-global pattern is a failure, not a crash", () => {
    const nonGlobal: ScanRule = { ...RULES[0]!, pattern: /ey[A-Za-z0-9_-]{6,}\./ };
    expect(verifyMatchers([nonGlobal]).some((f) => /not global/.test(f))).toBe(true);
  });
});

describe("secretScan — control A, a scan that read nothing is not a pass", () => {
  it("fails on zero files rather than reporting a clean sweep", () => {
    const r = scanFiles([], { scope: "empty" });
    expect(r.filesScanned).toBe(0);
    expect(r.unexplained).toEqual([]);
    // The whole point: no hits, and still NOT ok.
    expect(r.ok).toBe(false);
  });

  it("fails when the files read contain none of the control token", () => {
    const r = scanFiles([{ path: "a.txt", content: "nothing of interest here" }], { scope: "t" });
    expect(r.controlAHits).toBe(0);
    expect(r.ok).toBe(false);
  });

  it("passes on clean files that do carry the control token", () => {
    const r = scanFiles([clean("a.json"), clean("b.json")], { scope: "t", allowlist: [] });
    expect(r.controlAHits).toBe(2);
    expect(r.ok).toBe(true);
  });
});

describe("secretScan — each rule catches its own shape", () => {
  const cases: { rule: string; secret: () => string }[] = [
    { rule: "jwt", secret: () => j("ey", "JhbGciOiJIUzI1NiJ9", ".", "cGF5bG9hZHg", ".", "c2lnbg") },
    { rule: "addressBare", secret: () => j("0x", "abcdef0123456789abcdef0123456789abcdef01") },
    { rule: "addressLabelled", secret: () => j("address ", "0x", "abcd1234") },
    { rule: "noobTokenJson", secret: () => j('"NOOB_TOKEN', '_CID"', ": ", "999111") },
    { rule: "noobIdProse", secret: () => j("noobId ", "999111") },
    // The LABEL is split too, not just the value. Passing the whole label as
    // one argument leaves the label followed by a quote, comma and quote
    // sitting in this very file — which is itself a match, and which the
    // self-check at the bottom caught twice while this case was being written.
    // A rule keyed on a label is matched by the code that builds the label.
    { rule: "usernameQuoted", secret: () => j("user", "name ", "'", "realperson", "'") },
    { rule: "privateKeyPem", secret: () => j("-----BEGIN ", "EC ", "PRIVATE", " KEY-----") },
    { rule: "privateKeyHex", secret: () => j("0x", "fedcba9876543210".repeat(4)) },
  ];

  it("covers every shipped rule — a new rule with no case here fails this", () => {
    expect(cases.map((c) => c.rule).sort()).toEqual(RULES.map((r) => r.name).sort());
  });

  for (const { rule, secret } of cases) {
    it(`flags ${rule}`, () => {
      const r = scanFiles([withSecret("leak.json", secret())], { scope: "t", allowlist: [] });
      expect(r.unexplained.map((h) => h.rule)).toContain(rule);
      expect(r.ok).toBe(false);
    });
  }

  it("reports the line number, so a hit is findable without re-grepping", () => {
    const content = ["clean", `{"${CONTROL_TOKEN}": "x"}`, j("noobId ", "999111")].join("\n");
    const hits = scanText("f.md", content);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.line).toBe(3);
  });

  it("does not flag a commit SHA quoted in a session log", () => {
    // `redactProse` requires the word "address" precisely so it cannot eat
    // these; the scan must be no more trigger-happy than the redactor.
    const content = `${CONTROL_TOKEN}: commit f5a925d0, git diff 72fc229b..6da45f2f`;
    expect(scanText("log.md", content)).toEqual([]);
  });

  it("does not flag a bare 64-hex hash with no 0x prefix", () => {
    const sha = "a".repeat(64);
    expect(scanText("h.txt", `${CONTROL_TOKEN} ${sha}`)).toEqual([]);
  });
});

describe("secretScan — the allowlist is an explanation, not a mute button", () => {
  const secret = () => j("noobId ", "999111");

  it("moves an exempted hit out of unexplained but still reports it", () => {
    const r = scanFiles([withSecret("tests/api/redact.test.ts", secret())], {
      scope: "t",
      allowlist: [{ rule: "noobIdProse", path: "tests/api/redact.test.ts", why: "synthetic vector" }],
    });
    expect(r.unexplained).toEqual([]);
    expect(r.exempted).toHaveLength(1);
    expect(r.ok).toBe(true);
    // Visible in the printed report — an exemption that starts covering
    // something new must not be silent.
    expect(formatReport(r)).toContain("allowlisted hits");
  });

  it("is keyed on rule AND path — the same path does not excuse a different rule", () => {
    const r = scanFiles([withSecret("tests/api/redact.test.ts", j("0x", "b".repeat(40)))], {
      scope: "t",
      allowlist: [{ rule: "noobIdProse", path: "tests/api/redact.test.ts", why: "synthetic vector" }],
    });
    expect(r.unexplained.map((h) => h.rule)).toEqual(["addressBare"]);
    expect(r.ok).toBe(false);
  });

  it("reports an exemption that matched nothing as STALE, on an exhaustive scope", () => {
    const r = scanFiles([clean("a.json")], {
      scope: "t",
      exhaustive: true,
      allowlist: [{ rule: "jwt", path: "gone.md", why: "file deleted three sessions ago" }],
    });
    expect(r.staleChecked).toBe(true);
    expect(r.staleExemptions).toHaveLength(1);
    expect(formatReport(r)).toContain("STALE");
    // Stale is a warning, not a failure — a dead exemption is untidy, not unsafe.
    expect(r.ok).toBe(true);
  });

  it("does NOT call an exemption stale on a narrow scope, where out-of-scope looks identical", () => {
    // The bug this pins: on `--scope=diff` every exemption's file is usually
    // absent from the diff, so a naive staleness check flags all of them and
    // tells the reader to delete live exemptions. Suppressed, not guessed at.
    const r = scanFiles([clean("a.json")], {
      scope: "diff vs HEAD~1",
      allowlist: [{ rule: "jwt", path: "handoff/log/session-78.md", why: "synthetic token in a session log" }],
    });
    expect(r.staleChecked).toBe(false);
    expect(r.staleExemptions).toEqual([]);
    expect(formatReport(r)).toContain("staleness not checked");
    expect(formatReport(r)).not.toContain("delete them");
  });

  it("every shipped allowlist entry names a rule that exists", () => {
    const names = new Set(RULES.map((r) => r.name));
    for (const e of ALLOWLIST) expect(names, `allowlist entry for ${e.path}`).toContain(e.rule);
  });

  it("every shipped allowlist entry carries a reason", () => {
    for (const e of ALLOWLIST) expect(e.why.length, `${e.rule} ${e.path}`).toBeGreaterThan(20);
  });
});

describe("secretScan — reporting", () => {
  it("names the scope, because a bare file count reads as full coverage", () => {
    // Session 110's `files in session diff: 117` is the case in point.
    const out = formatReport(scanFiles([clean("a.json")], { scope: "diff vs HEAD~1" }));
    expect(out).toContain("scope: diff vs HEAD~1");
    expect(out).toContain("files scanned:");
  });

  it("says outright when the scan read nothing", () => {
    expect(formatReport(scanFiles([], { scope: "tracked" }))).toContain("THE SCAN READ NOTHING");
  });

  it("truncates a matched secret rather than reprinting it in full", () => {
    const long = "z".repeat(200);
    expect(preview(long)).toHaveLength(48 + "...(+152)".length);
    expect(preview(long)).not.toContain(long);
  });
});

describe("secretScan — the scanner and this test are clean under their own rules", () => {
  // The discipline that makes the allowlist trustworthy: neither file may need
  // an exemption, because a file exempted from the scan is a place a real
  // secret could sit unnoticed.
  for (const rel of ["scripts/secretScan.ts", "tests/secretScan.test.ts"]) {
    it(`${rel} contains no matchable literal`, () => {
      const abs = join(import.meta.dirname, "..", rel);
      const r = scanFiles([{ path: rel, content: readFileSync(abs, "utf8") }], { scope: "self", allowlist: [] });
      expect(r.unexplained, `${rel} would need an allowlist entry`).toEqual([]);
    });
  }

  it("neither file contains a literal NUL, which would make git treat it as binary", () => {
    // The scanner splits `-z` output on "\\x00" written as an escape for
    // exactly this reason — a NUL byte in the source would make the scanner
    // skip its own file as binary.
    for (const rel of ["scripts/secretScan.ts", "tests/secretScan.test.ts"]) {
      const buf = readFileSync(join(import.meta.dirname, "..", rel));
      expect(buf.includes(0), `${rel} contains a NUL byte`).toBe(false);
    }
  });
});

describe("secretScan — over real files on disk, in an isolated temp dir", () => {
  const dir = mkdtempSync(join(tmpdir(), "gigaverse-secretscan-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads content off disk and flags a planted secret", () => {
    const file = join(dir, "planted.json");
    writeFileSync(file, `{"${CONTROL_TOKEN}": "x", "jwt": "${j("ey", "JhbGciOiJIUzI1NiJ9", ".", "cGF5bG9hZHg", ".", "c2ln")}"}`);
    const r = scanFiles([{ path: "planted.json", content: readFileSync(file, "utf8") }], {
      scope: "temp",
      allowlist: [],
    });
    expect(r.unexplained.map((h) => h.rule)).toEqual(["jwt"]);
    expect(r.ok).toBe(false);
  });
});
