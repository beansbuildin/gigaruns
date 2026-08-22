/**
 * scripts/lib/requireInputs.ts — [session 76 §2] CLAUDE.md rule 5, extended
 * from the live loop to the ANALYSIS scripts.
 *
 * ## Why this exists
 *
 * Rule 5 says: on any unexpected state, stop, log, exit non-zero — *"never
 * guess an action to keep going."* It was written for the loop that spends
 * energy, and the analysis scripts were never held to it. Session 76 measured
 * what that cost, in a clone with no `data/` and no `logs/`:
 *
 *   - `scripts/redrawBlastRadius.ts` **ran to completion and printed a full,
 *     confident report** — `catch 0.0%` on both arms, the §4 prose about the
 *     mechanism unchanged beneath it, no warning anywhere. Every loader it
 *     depends on (`loadTransitionRecords`, `loadMinedPatterns`,
 *     `loadRingPredictions`) opens with `if (!existsSync(path)) return [];`,
 *     which is right for the live loop — a first-ever run has no corpus and
 *     must still fish — and wrong for a script whose entire output is a
 *     statistic computed on that corpus.
 *   - `scripts/liveGateFiringRates.ts` died at §3 with a raw `ENOENT: scandir
 *     'logs'` stack — but only AFTER publishing a §2 computed on a degraded
 *     corpus (420 turns instead of 440, 0 era casts instead of 134).
 *
 * Two scripts, one session, opposite failure modes, neither one right. A
 * degraded number that announces itself as a number is worse than a crash,
 * because the crash is at least honest about what it does not know.
 *
 * ## What this does, and deliberately does not
 *
 * It checks EXISTENCE and EMPTINESS of the named inputs before any work
 * starts, and exits non-zero naming what is missing and what it was for. It
 * does not validate contents, and it is not a substitute for a script knowing
 * its own domain — it is the one check that separates "this number is wrong"
 * from "this number was never computed".
 *
 * Callers pass paths they resolved through the profile, so nothing here needs
 * a path literal (see `tests/noHardcodedPaths.test.ts`).
 */
import { existsSync, readdirSync, statSync } from "node:fs";

export interface RequiredInput {
  /** The path, already resolved through the profile by the caller. */
  path: string;
  /** What the script computes from it. Printed on failure — name the statistic, not the file. */
  what: string;
  /**
   * For a directory: only entries matching this are counted, so a `logs/` that
   * exists but holds nothing this script can read still fails.
   */
  matching?: (entry: string) => boolean;
}

export interface MissingInput extends RequiredInput {
  /** Which of the three ways it failed, so the message can say something true. */
  reason: "absent" | "empty file" | "no matching entries";
}

/**
 * The pure half: which inputs are unusable, in the order given. Never throws
 * on a permission or race error — an unreadable path is reported as missing,
 * because the script cannot compute on it either way.
 */
export function missingInputs(inputs: readonly RequiredInput[]): MissingInput[] {
  const out: MissingInput[] = [];
  for (const input of inputs) {
    if (!existsSync(input.path)) {
      out.push({ ...input, reason: "absent" });
      continue;
    }
    try {
      const st = statSync(input.path);
      if (st.isDirectory()) {
        const entries = readdirSync(input.path).filter(input.matching ?? (() => true));
        if (entries.length === 0) out.push({ ...input, reason: "no matching entries" });
      } else if (st.size === 0) {
        out.push({ ...input, reason: "empty file" });
      }
    } catch {
      out.push({ ...input, reason: "absent" });
    }
  }
  return out;
}

/** The report, as text, so a test can assert on it without capturing stderr. */
export function formatMissingInputs(script: string, missing: readonly MissingInput[]): string {
  const lines = [
    ``,
    `✗ ${script} cannot run — ${missing.length} required input(s) unusable:`,
    ``,
  ];
  for (const m of missing) {
    lines.push(`    ${m.path}  (${m.reason})`);
    lines.push(`        needed for: ${m.what}`);
  }
  lines.push(``);
  lines.push(`  These are the AUTHOR'S accumulated captures. \`data/\` and \`logs/\` are`);
  lines.push(`  gitignored and do not ship, so this is the expected state in any clone —`);
  lines.push(`  it is not a bug in the code you received.`);
  lines.push(``);
  lines.push(`  This script exits rather than degrading because every figure it prints is`);
  lines.push(`  computed on those captures, and its loaders return \`[]\` for a missing file`);
  lines.push(`  rather than failing. A report on an empty corpus looks exactly like a`);
  lines.push(`  report on a real one. CLAUDE.md rule 5.`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Fail closed. Prints the report to stderr and exits 2 — distinct from 1, which
 * these scripts use for an ordinary error, so a caller can tell "I have no data"
 * from "the analysis went wrong".
 */
export function requireInputs(script: string, inputs: readonly RequiredInput[]): void {
  const missing = missingInputs(inputs);
  if (missing.length === 0) return;
  process.stderr.write(formatMissingInputs(script, missing));
  process.exit(2);
}
