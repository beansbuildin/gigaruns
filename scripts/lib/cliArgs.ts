/**
 * scripts/lib/cliArgs.ts — [session 80 §5] **an unrecognised flag must stop the
 * script, not be ignored.** CLAUDE.md rule 5, applied to the command line.
 *
 * ## Why this exists, and it is not hypothetical
 *
 * Session 80, 2026-08-22: an agent ran `npx tsx scripts/liveFishing.ts --help`
 * to read the script's usage. There is no `--help`. `parseArgs` looked for
 * `--casts=`, did not find it, **defaulted to 1**, ignored the flag it did not
 * recognise, and played a real cast — spending one of a capped daily allowance
 * that nobody had authorised. It was found only by reading the server ledger
 * afterwards (rule 13) and noticing a fixture directory timestamped after the
 * batch had finished.
 *
 * **The same defect was live in `scripts/liveRun.ts`, where it is worse.**
 * There `--runs=` defaults to 1, so a mistyped or unrecognised flag starts a
 * DUNGEON RUN — burning a run-unit of twelve, and doing it as a plain
 * 20-energy entry, which CLAUDE.md rule 11 forbids outright ("there is no such
 * thing as a plain dungeon run any more").
 *
 * ## The shape of the fix
 *
 * A script that spends something declares every token it understands. Anything
 * else is an unexpected state, and rule 5's answer to an unexpected state is to
 * stop before acting rather than to pick the most plausible action. **The
 * check runs before any network call**, so the failure costs nothing.
 *
 * `--help` is handled here too, for the reason the incident gives: an operator
 * asking a spending script what its flags are should never be answered by the
 * script spending something. It prints usage and exits 0.
 *
 * ## What this deliberately does NOT do
 *
 * It does not validate flag VALUES — `--casts=banana` is a different bug with
 * a different fix, and each script already handles its own numeric parsing.
 * This guards the one failure mode where an argument the script cannot see
 * leaves it running its default as though nothing were wrong.
 */

/**
 * The pure half: which tokens the script does not understand, and whether help
 * was asked for.
 *
 * Separated from `rejectUnknownArgs` ONLY so it can be tested — the wrapper
 * calls `process.exit`, which a test cannot exercise without taking the runner
 * down with it. The classification is the part with a decision in it; the
 * wrapper is printing and an exit code.
 */
export function classifyArgs(
  argv: readonly string[],
  known: readonly string[],
): { help: boolean; unknown: string[] } {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true, unknown: [] };
  const exact = new Set(known.filter((k) => !k.endsWith("=")));
  const prefixes = known.filter((k) => k.endsWith("="));
  return { help: false, unknown: argv.filter((a) => !exact.has(a) && !prefixes.some((p) => a.startsWith(p))) };
}

/**
 * Exits non-zero on any argv token the caller did not declare, and exits 0 on
 * `--help` / `-h` after printing `usage`.
 *
 * `known` lists exact flags (`"--dry-run"`) and value-flag PREFIXES ending in
 * `=` (`"--casts="`). A bare `--casts` with no `=` is unknown, deliberately:
 * it is the shape that silently becomes the default.
 *
 * @param argv the arguments AFTER the script path, i.e. `process.argv.slice(2)`
 * @param known every flag the script understands
 * @param usage the usage text, printed on `--help` and on a rejection
 */
export function rejectUnknownArgs(argv: readonly string[], known: readonly string[], usage: string): void {
  const { help, unknown } = classifyArgs(argv, known);
  if (help) {
    console.log(usage);
    process.exit(0);
  }
  if (unknown.length === 0) return;
  console.error(`\n✖ unrecognised argument(s): ${unknown.join(", ")}`);
  console.error(`\n  Refusing to run. A script that spends energy, casts or run-units does not`);
  console.error(`  guess what you meant — CLAUDE.md rule 5. Nothing was sent.\n`);
  console.error(usage);
  process.exit(1);
}
