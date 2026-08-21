/**
 * scripts/preflight.ts — [session 68 §4] DISTRIBUTION step 5, as a script.
 *
 * ## Why this exists
 *
 * Session 67 rehearsed the export by hand and the procedure ended up as an
 * eleven-command incantation inside a report. That is a thing you do once. The
 * check it performs — *does a stranger's clone actually work?* — is a thing
 * worth doing **before every invite**, because the answer changes silently:
 * a new test that reads `data/`, a new dependency, a secret that lands in a
 * shipped doc. All three have happened in this repo.
 *
 * ## What it does
 *
 *   1. Exports the SHIPS list to `dist-preflight/` with `git checkout-index`,
 *      then prunes the does-not-ship paths. Both lists are `handoff/
 *      DISTRIBUTION.md`'s, transcribed here as data (`DOES_NOT_SHIP`) so the
 *      export and the document cannot silently disagree.
 *   2. Runs `doctor.ts` in that tree with a HOME that has no `~/.secrets`, so
 *      it takes the path a friend takes. Expects exactly one `✗`, the JWT.
 *   3. Runs the test suite there, and reports pass/fail/SKIP counts.
 *   4. Scans the exported tree for secrets — the EXPORT, not the working tree,
 *      which is the distinction session 67 drew and the only one that matters
 *      for what leaves the machine.
 *
 * ## What it deliberately does NOT do
 *
 * **It never creates a repo, never adds a remote, and never pushes.** Steps 3,
 * 4 and 6 of `handoff/DISTRIBUTION.md` are the user's, by standing decision —
 * an agent must not publish this. This script only rehearses locally, in a
 * gitignored directory, and prints what it found.
 *
 * Usage:  npx tsx scripts/preflight.ts [--keep]
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "dist-preflight";

/**
 * `handoff/DISTRIBUTION.md`'s "Does not ship" table, as data.
 *
 * Kept here rather than derived from `.gitignore`: several of these ARE
 * tracked (`handoff/`, `TASKS.md`, `QUESTIONS.md`) and are excluded by
 * editorial decision, not by ignore rules. That distinction is the whole
 * reason the table exists.
 */
const DOES_NOT_SHIP = [
  "handoff",
  ".claude",
  "TASKS.md",
  "QUESTIONS.md",
  "CODEXAUDIT",
  "CODEXIMPROVE",
  "CODEXREVIEW",
  join("config", ".gitkeep"),
  OUT,
];

/** Patterns that must never appear in anything that leaves the machine. */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: "hex private key", re: /\b0x[0-9a-fA-F]{64}\b/ },
  { name: "wallet address", re: /\b0x[0-9a-fA-F]{40}\b/ },
  { name: "NOOB_TOKEN_CID", re: /"NOOB_TOKEN_CID"\s*:\s*(?!0\b)[0-9]/ },
];

const SKIP_SCAN_DIRS = new Set(["node_modules", ".git", "fixtures"]);

/**
 * Files a pattern is allowed to appear in, with the reason.
 *
 * **The redaction module has to contain the thing it redacts.** `redact.ts`
 * carries `NOOB_TOKEN_CID` as a literal because that is the field it strips,
 * and its test carries it for the same reason. Flagging them is a false
 * positive that would train a reader to ignore this scan — which is worse than
 * not running it. Keyed by pattern name so an allowance stays narrow: a JWT in
 * `redact.ts` would still be a hit.
 */
const SCAN_ALLOW: { pattern: string; path: string }[] = [
  { pattern: "NOOB_TOKEN_CID", path: "src/api/redact.ts" },
  { pattern: "NOOB_TOKEN_CID", path: "tests/api/redact.test.ts" },
];

function sh(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Run a command and capture output even when it exits non-zero — a red suite is data, not a crash. */
function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): { out: string; code: number } {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    return { out, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { out: `${err.stdout ?? ""}${err.stderr ?? ""}`, code: err.status ?? 1 };
  }
}

function walk(dir: string, onFile: (p: string) => void): void {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP_SCAN_DIRS.has(e)) continue;
    if (statSync(p).isDirectory()) walk(p, onFile);
    else onFile(p);
  }
}

function main(): void {
  const keep = process.argv.includes("--keep");
  console.log("▸ preflight — DISTRIBUTION step 5, rehearsed locally. Nothing is created, pushed or shared.\n");

  // ---- 1. export ---------------------------------------------------------
  rmSync(OUT, { recursive: true, force: true });
  sh(`mkdir -p ${OUT}`);
  sh(`git checkout-index -a --prefix=${OUT}/`);
  const pruned: string[] = [];
  for (const p of DOES_NOT_SHIP) {
    const target = join(OUT, p);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
      pruned.push(p);
    }
  }
  let shipped = 0;
  walk(OUT, () => shipped++);
  console.log(`  ✓ exported ${shipped} tracked file(s) to ${OUT}/`);
  console.log(`    pruned: ${pruned.join(", ") || "(nothing — check DOES_NOT_SHIP against DISTRIBUTION.md)"}\n`);

  // ---- 2. doctor, as a friend sees it ------------------------------------
  // A HOME with no `~/.secrets` is the whole point: it forces the no-token path.
  const doctor = run("npx", ["tsx", "scripts/doctor.ts"], OUT, { HOME: "/nonexistent-friend-home" });
  // Count ✗ at the start of a CHECK line only. A naive `match(/✗/g)` also
  // catches doctor's own summary sentence ("Fix the items marked ✗ above"),
  // which reported 2 failures where there was 1 — the first version of this
  // script did exactly that and cried wolf on a clean export.
  const crosses = doctor.out.split("\n").filter((l) => /^\s*✗/.test(l)).length;
  console.log(`▸ doctor.ts with an empty HOME — ${crosses} ✗`);
  for (const line of doctor.out.split("\n").filter((l) => l.includes("✗") || l.includes("✓"))) {
    console.log(`    ${line.trim()}`);
  }
  console.log(
    crosses === 1
      ? "  ✓ exactly one ✗, which should be the JWT. That is the expected state.\n"
      : `  ★★★ EXPECTED EXACTLY ONE ✗ (the JWT). Got ${crosses}. Something changed since session 67.\n`,
  );

  // ---- 3. the suite ------------------------------------------------------
  console.log("▸ npm install + vitest in the exported tree (this is the slow part)…");
  const install = run("npm", ["install", "--no-audit", "--no-fund"], OUT);
  if (install.code !== 0) console.log("  ★★★ npm install FAILED — a friend cannot even start.");
  const suite = run("npx", ["vitest", "run"], OUT);
  const tally = suite.out.match(/Tests\s+.*$/m)?.[0]?.trim() ?? "(no Tests line — the run did not get that far)";
  const files = suite.out.match(/Test Files\s+.*$/m)?.[0]?.trim() ?? "";
  console.log(`  ${files}`);
  console.log(`  ${tally}`);
  // A SKIP is the DESIGNED outcome for an author-data test (session 68 §3), so
  // it gets its own number rather than being folded into "not failing". Read
  // off vitest's own tally, not off the stderr banners — the banners are
  // written to stderr by `announceMissingAuthorData` and do not reliably
  // survive capture, which made the first version of this line report 0 while
  // 13 tests were skipped.
  const skipped = Number(suite.out.match(/(\d+)\s+skipped/)?.[1] ?? 0);
  console.log(`  author-data tests skipped: ${skipped}${skipped === 0 ? "  ★ expected some — see tests/helpers/authorData.ts" : ""}`);
  console.log(
    suite.code === 0
      ? "  ✓ green in a stranger's tree.\n"
      : "  ★★★ RED in a stranger's tree. Fix it or tell friends before they run it — a red suite on\n" +
        "      first contact is the single most likely reason someone quietly gives up.\n",
  );

  // ---- 4. secret scan of the EXPORT --------------------------------------
  console.log("▸ secret scan of the exported tree (not the working tree)");
  const hits: string[] = [];
  walk(OUT, (p) => {
    if (/\.(png|jpg|jpeg|gif|ico|woff2?|zip|gz)$/i.test(p)) return;
    let text: string;
    try {
      text = readFileSync(p, "utf8");
    } catch {
      return;
    }
    const rel = relative(OUT, p).split("\\").join("/");
    for (const { name, re } of SECRET_PATTERNS) {
      if (!re.test(text)) continue;
      if (SCAN_ALLOW.some((a) => a.pattern === name && a.path === rel)) continue;
      hits.push(`${name} in ${rel}`);
    }
  });
  if (hits.length === 0) console.log("  ✓ clean.\n");
  else {
    console.log("  ★★★ HITS — DO NOT SHARE THIS EXPORT:");
    for (const h of hits.slice(0, 40)) console.log(`      ${h}`);
    console.log();
  }

  // ---- verdict -----------------------------------------------------------
  const ok = crosses === 1 && suite.code === 0 && hits.length === 0 && install.code === 0;
  console.log(ok ? "▸ PREFLIGHT PASSED — the export behaves for a stranger." : "▸ PREFLIGHT FAILED — see the ★★★ lines above.");
  console.log(
    "\n  Steps 3, 4 and 6 of handoff/DISTRIBUTION.md — create the repo, commit, push — are YOURS.\n" +
      "  This script deliberately does none of them.",
  );
  if (!keep) rmSync(OUT, { recursive: true, force: true });
  else console.log(`\n  ${OUT}/ kept (--keep).`);
  process.exit(ok ? 0 : 1);
}

main();
