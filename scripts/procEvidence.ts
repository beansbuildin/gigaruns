/**
 * PROC EVIDENCE — where the five rolled stats actually publish their rolls.
 *
 * [session 100 §B, QUESTIONS.md §54 / §57]
 *
 * ## The question this answers
 *
 * Session 99 ran a full 4-run day, 214 POSTs, and `triggeredBoons` — the field
 * that would evidence a boon actually procing — was EMPTY on every recorded
 * state. That gates `TASKS.md` CAPTURE-1: a proc-evidence channel that
 * silently never fires would make the five-rolled-stats model unreachable by
 * ordinary play, however many runs get spent chasing it.
 *
 * ## The answer
 *
 * `triggeredBoons` has never been non-empty, anywhere, ever — and it does not
 * matter, because it is not the channel. **`data.events[]` is.** Every dungeon
 * ACTION response carries an event log, and its `use_move` rows carry a
 * per-exchange, per-side boolean for each of the five rolled stats:
 *
 *     {"type":"use_move","value":"rock","playerId":0,"batch":0,
 *      "data":{"blockProc0":false,"evadeProc0":false,"critProc0":false,
 *              "intuitionProc0":false,"tenacityProc0":false}}
 *
 * `src/api/schemas.ts` has kept this field since session 08, as
 * `z.array(z.unknown())`, with a comment predicting exactly this: *"worth
 * watching: a structured event log of what an action caused is a much better
 * signal than diffing `run` before/after, if later actions populate it"*. They
 * populate. Nothing followed up for 92 sessions, and the fishing side
 * (`src/sim/fishing/castTrace.ts`) has been reading its own `data.events[]`
 * the whole time.
 *
 * ## What this script does, and does not
 *
 * It MEASURES the channel and validates the field-to-stat mapping. It builds
 * no proc model and writes nothing into the simulator — CAPTURE-1 forbids
 * stubbing or defaulting those branches, and this script's output is the
 * evidence a future session would need before doing it properly, not a
 * shortcut past it.
 *
 * Re-runnable as volume accumulates:  `npx tsx scripts/procEvidence.ts`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The five rolled stats CAPTURE-1 is blocked on, mapped to the flag prefix that reports them. */
export const PROC_FLAG_TO_STAT: Readonly<Record<string, string>> = {
  blockProc: "block",
  evadeProc: "evasion",
  critProc: "lck",
  tenacityProc: "tenacity",
  intuitionProc: "intuition",
};

export interface ProcTally {
  /** Exchanges in which this flag was present. */
  n: number;
  /** Exchanges in which it read true. */
  fired: number;
}

export interface ProcEvidenceReport {
  runDirs: number;
  /** Canonical (non-`raw/`) state files carrying a player array. */
  states: number;
  /** States carrying the `data.events` key at all. */
  statesWithEventsKey: number;
  /** `use_move` events seen — one per side per exchange. */
  useMoveEvents: number;
  /** Occurrences of `triggeredBoons` on a player object, and how many were non-empty. */
  triggeredBoonsSeen: number;
  triggeredBoonsNonEmpty: number;
  /** Per-flag firing tallies, e.g. `blockProc0`. */
  procs: Record<string, ProcTally>;
  /**
   * The control that makes the mapping more than a naming coincidence:
   * exchanges in which the actor's stat was ZERO, and how many of those fired.
   * A non-zero `firedAtZero` for any flag falsifies the mapping.
   */
  zeroStatControl: Record<string, ProcTally & { firedAtZero: number }>;
  /** `intuition_block` events — the observable consequence of an intuition proc. */
  intuitionBlockEvents: number;
}

interface PlayerLike {
  [k: string]: unknown;
  triggeredBoons?: unknown[];
}

const statValue = (player: PlayerLike, stat: string): number | null => {
  const raw = player[stat];
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { current?: unknown }).current === "number") {
    return (raw as { current: number }).current;
  }
  return null;
};

export interface ProcEvidenceOptions {
  runsRoot?: string;
  /**
   * Scan only the N most recent run dirs. Omitted = the whole corpus, which is
   * what the CLI does and what QUESTIONS.md §57's totals come from.
   *
   * `tests/procEvidence.test.ts` passes a small number, to bound what a TEST
   * pays as the corpus grows. The corpus is append-only and already ~5300
   * states; a test that re-parses all of it re-parses more of it every
   * session, forever, for an invariant that any large slice establishes just
   * as well. Same reasoning session 99 applied to `tests/rejectionAudit.ts`'s
   * numeric arm: a statistic taken over an ever-growing local corpus fails
   * eventually for reasons unrelated to what it checks.
   *
   * **It is NOT here because the full scan was measured as too slow.** That
   * was claimed twice while writing this and neither claim survived: the
   * timeouts seen on unrelated test files were on a machine carrying a load
   * average of 17 and 49 stray node processes from other sessions, which makes
   * every before/after comparison taken that day worthless. The full scan
   * costs ~0.9s. If a future session wants the totals in CI, the honest way to
   * decide is to measure it on a quiet machine, not to inherit this note.
   */
  maxRunDirs?: number;
}

export function buildProcEvidenceReport(options: ProcEvidenceOptions | string = {}): ProcEvidenceReport {
  const { runsRoot = join("fixtures", "dungeon-runs"), maxRunDirs } =
    typeof options === "string" ? { runsRoot: options, maxRunDirs: undefined } : options;
  const report: ProcEvidenceReport = {
    runDirs: 0,
    states: 0,
    statesWithEventsKey: 0,
    useMoveEvents: 0,
    triggeredBoonsSeen: 0,
    triggeredBoonsNonEmpty: 0,
    procs: {},
    zeroStatControl: {},
    intuitionBlockEvents: 0,
  };

  // Dir names are `run-<ISO-ish timestamp>`, so a lexical sort is chronological.
  const allDirs = readdirSync(runsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("run-"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const dirs = maxRunDirs === undefined ? allDirs : allDirs.slice(-maxRunDirs);
  for (const d of dirs) {
    report.runDirs++;
    // Only the canonical copies. Each run dir also holds a `raw/` mirror, and
    // counting both would double every denominator in here.
    let files: string[] = [];
    try {
      files = readdirSync(join(runsRoot, d.name)).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files) {
      let body: { data?: { run?: { players?: PlayerLike[] }; events?: unknown } };
      try {
        body = JSON.parse(readFileSync(join(runsRoot, d.name, f), "utf8"));
      } catch {
        continue;
      }
      const players = body.data?.run?.players;
      if (!Array.isArray(players)) continue;
      report.states++;

      for (const p of players) {
        if (!("triggeredBoons" in p)) continue;
        report.triggeredBoonsSeen++;
        const tb = p.triggeredBoons;
        if (Array.isArray(tb) ? tb.length > 0 : tb != null) report.triggeredBoonsNonEmpty++;
      }

      if (!body.data || !("events" in body.data)) continue;
      report.statesWithEventsKey++;
      const events = body.data.events;
      if (!Array.isArray(events)) continue;

      for (const raw of events) {
        const ev = raw as { type?: string; playerId?: number; data?: Record<string, unknown> };
        if (ev.type === "intuition_block") report.intuitionBlockEvents++;
        if (ev.type !== "use_move") continue;
        report.useMoveEvents++;
        const actor = typeof ev.playerId === "number" ? players[ev.playerId] : undefined;
        for (const [flag, value] of Object.entries(ev.data ?? {})) {
          if (typeof value !== "boolean") continue;
          const tally = (report.procs[flag] ??= { n: 0, fired: 0 });
          tally.n++;
          if (value) tally.fired++;

          const stat = PROC_FLAG_TO_STAT[flag.replace(/[01]$/, "")];
          if (!stat || !actor) continue;
          const v = statValue(actor, stat);
          if (v !== 0) continue;
          const ctl = (report.zeroStatControl[flag] ??= { n: 0, fired: 0, firedAtZero: 0 });
          ctl.n++;
          if (value) {
            ctl.fired++;
            ctl.firedAtZero++;
          }
        }
      }
    }
  }
  return report;
}

function main(): void {
  const r = buildProcEvidenceReport();
  const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${((100 * a) / b).toFixed(2)}%`);

  console.log(`\n▸ proc evidence — ${r.runDirs} run dirs, ${r.states} canonical states\n`);

  console.log(`  triggeredBoons occurrences        ${r.triggeredBoonsSeen}`);
  console.log(`  triggeredBoons NON-EMPTY          ${r.triggeredBoonsNonEmpty}   <- the field session 99 was waiting on`);
  console.log(`  states carrying data.events       ${r.statesWithEventsKey} / ${r.states}`);
  console.log(`  use_move events (1 per side)      ${r.useMoveEvents}`);
  console.log(`  intuition_block events            ${r.intuitionBlockEvents}\n`);

  console.log(`  flag              stat        fired /     n           rate    fired when stat==0`);
  for (const flag of Object.keys(r.procs).sort()) {
    const t = r.procs[flag]!;
    const stat = PROC_FLAG_TO_STAT[flag.replace(/[01]$/, "")] ?? "?";
    const ctl = r.zeroStatControl[flag];
    const ctlText = ctl ? `${ctl.firedAtZero} / ${ctl.n}` : "—";
    console.log(
      `  ${flag.padEnd(17)} ${stat.padEnd(10)} ${String(t.fired).padStart(5)} / ${String(t.n).padStart(5)}   ${pct(t.fired, t.n).padStart(8)}   ${ctlText}`,
    );
  }

  const violations = Object.entries(r.zeroStatControl).filter(([, c]) => c.firedAtZero > 0);
  console.log(
    violations.length === 0
      ? `\n  ✓ zero-stat control CLEAN: no flag ever fired while its stat was 0. The flag-to-stat mapping holds.\n`
      : `\n  ★★★ zero-stat control VIOLATED by ${violations.map(([f]) => f).join(", ")} — the mapping is wrong.\n`,
  );
}

const isMain = process.argv[1] && process.argv[1].endsWith("procEvidence.ts");
if (isMain) main();
