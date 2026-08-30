/**
 * scripts/secretScan.ts — session 111. The recap-time secret scan, as an
 * instrument instead of an ad-hoc shell pipeline reinvented every session.
 *
 * ## Why this exists
 *
 * CLAUDE.md rule 3 makes "no secret enters the repo" a non-negotiable, and
 * every recap has verified it — differently each time. The history:
 *
 *  - session 108 reported "0 hits including the WIDENED 0x pattern" by a
 *    method nobody can now reconstruct.
 *  - session 109 piped `git ls-files -z | xargs -0 cat` into grep, got 0/4,
 *    and only found by accident that the pipeline had read NOTHING. It added
 *    the rule that a scan must prove its file count (DECISIONS 2026-08-29).
 *  - session 110 obeyed that rule and printed `files in session diff: 117`.
 *
 * Session 110's scan was not broken. But "117 files" in a recap reads as
 * coverage of the repository, and it was coverage of ONE SESSION'S DIFF —
 * 1.3% of the 9,116 tracked files. **A diff-scoped scan cannot see a secret
 * that landed in an earlier session**, which is exactly the gap that let
 * session 108's unreconstructable method go unchecked for two sessions. The
 * defect was never a broken pipe or a lazy scan; it was that SCOPE WAS
 * IMPLICIT. So this file's first job is to make scope a named, printed thing.
 *
 * ## Two controls, because there are two ways to measure nothing
 *
 * Session 109's failure was "the reader read no bytes". A wrong regex is the
 * other failure with the identical symptom — a comforting zero — and no
 * session has ever checked for it. Both are checked here, and either one
 * failing fails the scan (CLAUDE.md rule 5, fail closed):
 *
 *  - **Control A — did we read anything?** A token known to be everywhere in
 *    this corpus (`docId`) must be found in more than zero files.
 *  - **Control B — do the matchers match?** Every rule is run against a
 *    synthetic positive sample and must hit, and against the redactor's
 *    placeholder and must not.
 *
 * ## The rules are the inverse of src/api/redact.ts
 *
 * `redact.ts` is the prevention side; this is the verification side, and each
 * rule below is the un-redacted form of one of its placeholders. They are
 * deliberately described in terms of that module so the pair cannot drift the
 * way six copies of `redact()` did before session 54 consolidated them.
 *
 * ## Synthetic samples are BUILT AT RUNTIME, never written as literals
 *
 * A scanner containing literal example secrets flags itself, and the obvious
 * fix (allowlist the scanner) is the dishonest one — it creates a file where
 * a real secret could hide behind a legitimate exemption. Every sample below
 * is concatenated at runtime so no matchable literal exists in this source.
 * `tests/secretScan.test.ts` asserts this file and itself both come back
 * clean under their own scanner.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// -- rules ----------------------------------------------------------------

export type ScanRule = {
  /** Stable id — the allowlist keys on it, so renaming one invalidates its exemptions on purpose. */
  name: string;
  /** Must be global; `scanText` relies on `matchAll`. */
  pattern: RegExp;
  /** What a hit would mean, in the recap's own terms. */
  why: string;
  /** Built at runtime (see header) — control B asserts the rule matches this. */
  positive: () => string;
  /** The redactor's placeholder for this identifier — control B asserts the rule does NOT match it. */
  negative: () => string;
};

/** Assembled so the literal never appears in this file. */
const j = (...parts: string[]) => parts.join("");

export const RULES: ScanRule[] = [
  {
    name: "jwt",
    // Three dot-separated base64url segments opening with a JOSE header. The
    // only secret this project actually has (CLAUDE.md rule 3).
    pattern: /ey[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g,
    why: "a JSON Web Token — the account's session credential",
    positive: () => j("ey", "JhbGciOiJIUzI1NiJ9", ".", "cGF5bG9hZHBheWxvYWQ", ".", "c2ln"),
    negative: () => "<JWT>",
  },
  {
    name: "addressBare",
    // A full 40-hex EVM address anywhere, label or no label. `redactProse`
    // deliberately requires the word "address" so it cannot eat commit SHAs;
    // the scan does not need that constraint because 40 hex digits is already
    // unambiguous, and this is the rule that would catch a leak in captured
    // JSON, which the prose redactor never looks at.
    pattern: /0x[a-fA-F0-9]{40}\b/g,
    why: "a full EVM address — the player's wallet",
    positive: () => j("0x", "0123456789abcdef0123456789abcdef01234567"),
    negative: () => "0xUSER",
  },
  {
    name: "addressLabelled",
    // The TRUNCATED form, which the bare rule above cannot see. This is the
    // shape that sat in three tracked handoff documents for fifty sessions
    // (redact.ts, session 55) — an address with its tail cut off.
    pattern: /\baddress\s*:?\s*0x[0-9a-fA-F]{2,40}/gi,
    why: "a labelled wallet address, possibly truncated",
    positive: () => j("address ", "0x", "4a1b2c3d"),
    negative: () => "address 0xUSER",
  },
  {
    name: "noobTokenJson",
    // `NOOB_TOKEN_CID` is a stable on-chain identifier for the same account
    // the address redaction hides — `ownerOf(tokenId)` is a public call, so
    // leaking it leaks the address (redact.ts, session 54 user decision).
    pattern: /"NOOB_TOKEN_CID"\s*:\s*\d+/g,
    why: "an unredacted NOOB_TOKEN_CID — resolves to the wallet via ownerOf()",
    positive: () => j('"NOOB_TOKEN', '_CID"', ": ", "424242"),
    negative: () => '"NOOB_TOKEN_CID": "<NOOB_TOKEN>"',
  },
  {
    name: "noobIdProse",
    pattern: /\bnoob\s*id\s*:?\s*\d+/gi,
    why: "an unredacted noob id in prose",
    positive: () => j("noobId ", "424242"),
    negative: () => "noobId <NOOB_TOKEN>",
  },
  {
    name: "usernameQuoted",
    // Three tightenings, each from a false positive this rule actually
    // produced over the tracked tree on the day it was written:
    //
    //  1. `username"?` — in JSON the field is `"username": "<USER>"`, and
    //     without consuming the key's own CLOSING quote the rule read that
    //     quote as the value's OPENING one and matched the nonsense string
    //     `username": "`. It then never tested the real value against the
    //     placeholder lookahead, so a correctly-redacted fixture flagged.
    //  2. The value must START ALPHANUMERIC, which drops documentation
    //     ellipses (`username "..."`) that describe this rule in prose.
    //  3. The value must be at least TWO characters, which drops the
    //     one-letter stand-ins in redact.ts's own doc comment. The accepted
    //     cost: a real one-character username would not be caught.
    //
    // The lookahead excludes the placeholder, a `<name>` stand-in and `${...}`
    // template expressions — all descriptions of the redaction, never values.
    pattern: /\busername"?\s*:?\s*(["'`])(?!<USER>|<name>|\$\{)[A-Za-z0-9][^"'`\n]+?\1/gi,
    why: "an unredacted account username",
    positive: () => j('username "', "somebodyreal", '"'),
    negative: () => 'username "<USER>"',
  },
  {
    name: "privateKeyPem",
    // CLAUDE.md rule 3: there is no private key and there is not going to be
    // one — the account is an Abstract Global Wallet and nothing in src/
    // signs. A hit here means that sentence stopped being true.
    pattern: /BEGIN\s+[A-Z ]*PRIVATE\s+KEY/g,
    why: "a PEM private key — rule 3 says none can exist in this project",
    positive: () => j("BEGIN ", "RSA ", "PRIVATE", " KEY"),
    negative: () => "BEGIN … PRIVATE KEY",
  },
  {
    name: "privateKeyHex",
    // 32 bytes of hex with an 0x prefix. Narrow on purpose: a bare 64-hex run
    // with no prefix is a SHA-256 and this corpus is full of them.
    pattern: /0x[a-fA-F0-9]{64}\b/g,
    why: "a 32-byte hex secret key",
    positive: () => j("0x", "0123456789abcdef".repeat(4)),
    negative: () => "0xUSER",
  },
];

/** Token known to be pervasive in this corpus; control A proves the reader read bytes. */
export const CONTROL_TOKEN = "docId";

// -- allowlist ------------------------------------------------------------

/**
 * Known-benign hits, each pinned to ONE rule and ONE path with its reason.
 *
 * Allowlisted is not invisible: `formatReport` prints every exempted hit with
 * its matched text, so an exemption that starts covering something new shows
 * up in the same output rather than being silently absorbed. An entry that
 * stops matching anything is reported as STALE — a dead exemption is how a
 * real hit eventually slips through a file that "was always allowed".
 */
export type Exemption = { rule: string; path: string; why: string };

export const ALLOWLIST: Exemption[] = [
  {
    rule: "jwt",
    path: "handoff/log/session-78.md",
    why: "quotes the synthetic token from the redaction test, describing how truncation was verified",
  },
  {
    rule: "noobTokenJson",
    path: "src/api/redact.ts",
    why: "a doc comment showing the FIELD SHAPE the redactor keys on, not a value",
  },
  {
    rule: "addressLabelled",
    path: "tests/api/redact.test.ts",
    why: "the redactor's own synthetic vector for a truncated address",
  },
  {
    rule: "noobIdProse",
    path: "tests/api/redact.test.ts",
    why: "the redactor's own synthetic vector, FAKE_NOOB",
  },
  {
    rule: "usernameQuoted",
    path: "tests/api/redact.test.ts",
    why: "the redactor's own synthetic username vector",
  },
  {
    rule: "usernameQuoted",
    path: "tests/capture.test.ts",
    why: "synthetic capture-redaction vectors, the same fake name redact.test.ts uses; the address beside it is the non-hex '0xSECRET' for the same reason",
  },
];

// -- the pure core --------------------------------------------------------

export type Hit = { rule: string; path: string; line: number; text: string };
export type ScanFile = { path: string; content: string };

/** Truncated so a real leak is identifiable in the report without being reprinted in full. */
export function preview(text: string, max = 48): string {
  return text.length <= max ? text : `${text.slice(0, max)}...(+${text.length - max})`;
}

export function scanText(path: string, content: string, rules: ScanRule[] = RULES): Hit[] {
  const hits: Hit[] = [];
  const lines = content.split("\n");
  for (const rule of rules) {
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i]!.matchAll(rule.pattern)) {
        hits.push({ rule: rule.name, path, line: i + 1, text: m[0] });
      }
    }
  }
  return hits;
}

export type ScanReport = {
  scope: string;
  filesScanned: number;
  filesSkippedBinary: number;
  controlAHits: number;
  controlBFailures: string[];
  unexplained: Hit[];
  exempted: Hit[];
  /**
   * Only meaningful on an EXHAUSTIVE scope. On a narrow one every exemption
   * looks stale simply because its file is not in the diff, and acting on that
   * would delete live exemptions — so it is left empty rather than computed.
   */
  staleExemptions: Exemption[];
  staleChecked: boolean;
  ok: boolean;
};

/**
 * Control B — every rule must hit its own positive sample and miss the
 * redactor's placeholder. Returns a list of failures; empty means healthy.
 */
export function verifyMatchers(rules: ScanRule[] = RULES): string[] {
  const failures: string[] = [];
  for (const rule of rules) {
    if (!rule.pattern.global) {
      // Recorded and then SKIPPED, not recorded and then exercised: `matchAll`
      // throws on a non-global RegExp, so falling through turns a reportable
      // failure into a crash that takes the whole scan down with it. Rule 5
      // wants a scan that stops and says why, not one that dies mid-sweep.
      failures.push(`${rule.name}: pattern is not global — matchAll would throw`);
      continue;
    }
    if (scanText("<sample>", rule.positive(), [rule]).length === 0) {
      failures.push(`${rule.name}: did NOT match its own positive sample — the rule is measuring nothing`);
    }
    if (scanText("<sample>", rule.negative(), [rule]).length !== 0) {
      failures.push(`${rule.name}: matched the redactor's placeholder — it would flag correctly-redacted files`);
    }
  }
  return failures;
}

export function scanFiles(
  files: ScanFile[],
  opts: {
    scope: string;
    rules?: ScanRule[];
    allowlist?: Exemption[];
    filesSkippedBinary?: number;
    /** True only when `files` is the whole committable tree — see `staleExemptions`. */
    exhaustive?: boolean;
  },
): ScanReport {
  const rules = opts.rules ?? RULES;
  const allowlist = opts.allowlist ?? ALLOWLIST;
  const unexplained: Hit[] = [];
  const exempted: Hit[] = [];
  const used = new Set<string>();
  let controlAHits = 0;

  for (const file of files) {
    if (file.content.includes(CONTROL_TOKEN)) controlAHits++;
    for (const hit of scanText(file.path, file.content, rules)) {
      const exemption = allowlist.find((e) => e.rule === hit.rule && e.path === hit.path);
      if (exemption) {
        used.add(`${exemption.rule} ${exemption.path}`);
        exempted.push(hit);
      } else {
        unexplained.push(hit);
      }
    }
  }

  const controlBFailures = verifyMatchers(rules);
  const exhaustive = opts.exhaustive ?? false;
  const staleExemptions = exhaustive ? allowlist.filter((e) => !used.has(`${e.rule} ${e.path}`)) : [];

  return {
    scope: opts.scope,
    filesScanned: files.length,
    filesSkippedBinary: opts.filesSkippedBinary ?? 0,
    controlAHits,
    controlBFailures,
    unexplained,
    exempted,
    staleExemptions,
    staleChecked: exhaustive,
    // A scan of zero files, or one whose controls failed, is NOT a pass — it
    // is a scan that did not happen. That distinction is the whole point.
    ok: unexplained.length === 0 && controlBFailures.length === 0 && controlAHits > 0 && files.length > 0,
  };
}

export function formatReport(r: ScanReport): string {
  const out: string[] = [];
  out.push(``);
  out.push(`> secret scan — scope: ${r.scope}`);
  out.push(`  files scanned:        ${r.filesScanned}`);
  if (r.filesSkippedBinary > 0) out.push(`  skipped (binary):     ${r.filesSkippedBinary}`);
  out.push(
    `  CONTROL A (read):     ${r.controlAHits} file(s) contain ${JSON.stringify(CONTROL_TOKEN)}` +
      `${r.controlAHits > 0 ? "" : "   [X] THE SCAN READ NOTHING"}`,
  );
  out.push(
    `  CONTROL B (matchers): ${
      r.controlBFailures.length === 0 ? "all rules verified against synthetic samples" : "[X] FAILED"
    }`,
  );
  for (const f of r.controlBFailures) out.push(`      [X] ${f}`);
  out.push(``);
  for (const rule of RULES) {
    const un = r.unexplained.filter((h) => h.rule === rule.name).length;
    const ex = r.exempted.filter((h) => h.rule === rule.name).length;
    const mark = un === 0 ? "   " : "[X]";
    out.push(
      `  ${mark} ${rule.name.padEnd(16)} ${String(un).padStart(4)} unexplained${ex > 0 ? `   (${ex} allowlisted)` : ""}`,
    );
  }
  if (r.unexplained.length > 0) {
    out.push(``);
    out.push(`  [X] UNEXPLAINED HITS — do not commit; if any is real, rotate the JWT (CLAUDE.md rule 3):`);
    for (const h of r.unexplained.slice(0, 40)) {
      out.push(`      [${h.rule}] ${h.path}:${h.line}  ${preview(h.text)}`);
    }
    if (r.unexplained.length > 40) out.push(`      ...and ${r.unexplained.length - 40} more`);
  }
  if (r.exempted.length > 0) {
    out.push(``);
    out.push(`  allowlisted hits, printed so an exemption cannot quietly widen:`);
    for (const h of r.exempted) out.push(`      [${h.rule}] ${h.path}:${h.line}  ${preview(h.text)}`);
  }
  if (r.staleChecked && r.staleExemptions.length > 0) {
    out.push(``);
    out.push(`  [!] STALE allowlist entries — they matched nothing this run; delete them:`);
    for (const e of r.staleExemptions) out.push(`      [${e.rule}] ${e.path}`);
  } else if (!r.staleChecked) {
    out.push(``);
    out.push(`  (allowlist staleness not checked — only an exhaustive scope can tell stale from out-of-scope)`);
  }
  out.push(``);
  out.push(r.ok ? `> PASS — no unexplained hits, both controls healthy.` : `> FAIL`);
  out.push(``);
  return out.join("\n");
}

// -- git plumbing + I/O (the impure half) ---------------------------------

const REPO_ROOT = join(import.meta.dirname, "..");

/**
 * `tracked` is the default and the one a recap should quote: every file git
 * would commit. Gitignored paths are OUT of scope BY DESIGN — session 109
 * found the wallet address living under a gitignored `raw/` fixture dir and
 * concluded correctly that a file git will never commit cannot leak through a
 * commit. Say which scope you ran; that is the entire lesson.
 */
export type Scope = "tracked" | "staged" | "diff";

export function listFiles(scope: Scope, ref: string): string[] {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      // `-z` on every command below, so records are NUL-separated: a path
      // containing a space or a newline must not split into two files, and a
      // scan that silently loses files is the exact failure this file exists
      // to make impossible. Written as an escape, never as a literal NUL —
      // a NUL byte in this source would make git and grep treat the scanner
      // as binary, and it would skip its own file.
      .split("\x00")
      .filter((s) => s.length > 0);
  if (scope === "tracked") return git(["ls-files", "-z"]);
  if (scope === "staged") return git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]);
  return git(["diff", "--name-only", "-z", "--diff-filter=ACMR", ref]);
}

/** Returns null for a binary file or one that has gone missing since `git ls-files`. */
function readTextFile(abs: string): string | null {
  try {
    if (!statSync(abs).isFile()) return null;
    const buf = readFileSync(abs);
    // Same heuristic as `grep -I`: a NUL byte near the head means binary.
    if (buf.subarray(0, 8000).includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const scopeArg = argv.find((a) => a.startsWith("--scope="))?.split("=")[1] ?? "tracked";
  const ref = argv.find((a) => a.startsWith("--ref="))?.split("=")[1] ?? "HEAD";
  if (scopeArg !== "tracked" && scopeArg !== "staged" && scopeArg !== "diff") {
    console.error(`unknown --scope=${scopeArg} — expected tracked | staged | diff`);
    process.exit(2);
  }
  const scope: Scope = scopeArg;

  const paths = listFiles(scope, ref);
  const files: ScanFile[] = [];
  let skipped = 0;
  for (const rel of paths) {
    const content = readTextFile(join(REPO_ROOT, rel));
    if (content === null) skipped++;
    else files.push({ path: rel, content });
  }

  const label = scope === "diff" ? `diff vs ${ref}` : scope;
  const report = scanFiles(files, { scope: label, filesSkippedBinary: skipped, exhaustive: scope === "tracked" });
  console.log(formatReport(report));
  if (!report.ok) process.exit(1);
}

const isMain = process.argv[1] && process.argv[1].endsWith("secretScan.ts");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
