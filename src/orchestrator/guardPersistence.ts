/**
 * src/orchestrator/guardPersistence.ts — makes `GuardState`'s budget actually
 * hold across separate `npm run live` invocations, not just within one.
 *
 * [session 09] `GuardState` is deliberately fs-free (see guards.ts's header
 * comment) so it stays trivially testable — but that means a fresh process
 * builds a fresh `GuardState`, and the CLAUDE.md-mandated daily energy budget
 * enforced nothing across the several separate `npm run live` calls a real
 * session actually uses (STATE.md, session 08: "each `npm run live`
 * invocation builds a fresh `GuardState`, so the 60-energy session budget
 * isn't tracked across the several separate invocations this session
 * actually used"). Session-09 brief §2: "a guard which silently doesn't work
 * is worse than no guard, because it gets trusted."
 *
 * Keyed by date (UTC calendar day) rather than accumulating forever — a new
 * day gets a fresh budget, matching `config/bot.json`'s `dailyEnergyBudget`
 * naming. `maxRunsPerSession` is, in this bot's actual usage pattern (several
 * short-lived process invocations across a day), functionally a per-day cap
 * too; this file carries `runsStarted` forward on the same date key so that
 * holds in practice, not just in name.
 *
 * [session 28, CODEXREVIEW #2] Three fixes, all in the direction of
 * CLAUDE.md §5 (fail CLOSED on unexpected state):
 *  1. `loadGuardBudget` used to swallow a genuinely CORRUPT existing file
 *     (bad JSON, wrong shape) the same way it treats "nothing on disk yet" —
 *     silently returning a zero budget. That's failing OPEN: a corrupted
 *     record of real spend gets forgotten and the day's budget effectively
 *     resets, letting a restart spend past the real daily cap. A missing
 *     file is still a legitimate zero seed (first run of the day); a file
 *     that EXISTS but won't parse/validate now throws `GuardPersistenceError`
 *     instead.
 *  2. `saveGuardBudget` used to `writeFileSync` the real path directly — a
 *     crash mid-write (or two writers racing) could leave a truncated or
 *     interleaved file. Now writes a sibling temp file and renames it into
 *     place, which is atomic on the same filesystem: the real path always
 *     either holds the old complete state or the new complete state, never a
 *     partial one.
 *  3. Nothing prevented two live processes from both loading the same seed,
 *     both passing their guards, and overwriting each other's update —
 *     silently exceeding the configured daily budget. `acquireGuardLock`
 *     below enforces one live writer per guard-state file for the life of
 *     the process, not just around one write.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

export class GuardPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardPersistenceError";
  }
}

const PersistedGuardBudgetSchema = z.object({
  date: z.string(),
  energySpent: z.number().nonnegative(),
  runsStarted: z.number().int().nonnegative(),
});

export type PersistedGuardBudget = z.infer<typeof PersistedGuardBudgetSchema>;

export const DEFAULT_GUARD_STATE_PATH = join("data", "guard-budget.json");

/** Pacific-local calendar date + hour, via Intl (America/Los_Angeles) — DST-aware, no hardcoded offset. */
function pacificParts(date: Date): { year: number; month: number; day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // hour12:false can render midnight as "24" in some ICU builds
  return { year: get("year"), month: get("month"), day: get("day"), hour };
}

/**
 * [session 29, CODEXREVIEW #6] The guard-budget "day" rolls over at 11am
 * Pacific (`America/Los_Angeles`), not UTC midnight — user-confirmed real
 * server-side reset boundary for BOTH dungeon and fishing daily caps
 * (QUESTIONS.md §13). A UTC-midnight local key produced two confirmed
 * mismatches where the local guard read "fresh day" while the server hadn't
 * actually rolled over: session 24's dungeon-run-count drift and session
 * 27's wasted fishing `start_run` attempt (rejected "Player has reached max
 * runs for fishing" against a guard that showed 0/20 used).
 *
 * Timezone-aware via `Intl`, not a hardcoded UTC offset — Pacific alternates
 * between UTC-7 (PDT) and UTC-8 (PST) twice a year, and a hardcoded offset
 * would silently drift wrong across each transition.
 */
export function todayKey(now: Date = new Date()): string {
  const p = pacificParts(now);
  if (p.hour < 11) {
    // Before today's 11am Pacific rollover — still counts as "yesterday" in
    // the guard's calendar. Subtracting a day from an already-Pacific-local
    // Y/M/D via UTC calendar arithmetic avoids any DST edge case in the
    // subtraction itself (there's no timezone conversion left to do — we
    // already have the correct Pacific date).
    const prior = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
    const yyyy = prior.getUTCFullYear();
    const mm = String(prior.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(prior.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Loads today's already-spent energy/runs, or `{0, 0}` if nothing is on disk
 * yet (first run of the day — a legitimate zero seed) or the persisted date
 * is a prior day (a fresh budget starts each day, same as
 * `config/bot.json`'s `dailyEnergyBudget` intends). A file that EXISTS but
 * fails to parse as JSON or doesn't match the expected shape throws
 * `GuardPersistenceError` instead of silently returning a zero seed — see
 * this file's header comment, fix 1.
 */
export function loadGuardBudget(path: string = DEFAULT_GUARD_STATE_PATH): { energySpent: number; runsStarted: number } {
  if (!existsSync(path)) return { energySpent: 0, runsStarted: 0 };

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new GuardPersistenceError(`guard state file ${path} exists but could not be read: ${(e as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new GuardPersistenceError(
      `guard state file ${path} exists but is not valid JSON — refusing to silently treat this as a zero budget (CLAUDE.md §5, fail closed). ${(e as Error).message}`,
    );
  }

  const result = PersistedGuardBudgetSchema.safeParse(json);
  if (!result.success) {
    throw new GuardPersistenceError(
      `guard state file ${path} exists but doesn't match the expected shape — refusing to silently zero the budget. ${result.error.message}`,
    );
  }

  const parsed = result.data;
  if (parsed.date !== todayKey()) return { energySpent: 0, runsStarted: 0 }; // a stale PRIOR day is a fresh budget, not corruption
  return { energySpent: parsed.energySpent, runsStarted: parsed.runsStarted };
}

/**
 * Overwrites today's persisted spend. Call after every `GuardState` mutation
 * that changes `spentEnergy`/`runCount` (`recordEnergySpent`,
 * `recordRunStarted`) so a crash mid-run loses at most the in-flight action,
 * never previously-completed accounting. Writes through a sibling temp file
 * and renames it into place (atomic on the same filesystem) — see this
 * file's header comment, fix 2.
 */
export function saveGuardBudget(energySpent: number, runsStarted: number, path: string = DEFAULT_GUARD_STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: PersistedGuardBudget = { date: todayKey(), energySpent, runsStarted };
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmp, JSON.stringify(body, null, 2));
  renameSync(tmp, path);
}

// ---------------------------------------------------------------------------
// One live writer per guard-state file — see this file's header, fix 3.
// ---------------------------------------------------------------------------

function lockPath(path: string): string {
  return `${path}.lock`;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquires an exclusive, whole-process-lifetime lock on `path`'s guard
 * state. Chosen over a lock scoped to a single load->assert->increment->save
 * call (CODEXREVIEW #2's other option) because those four steps are not
 * contiguous in this codebase — `assertCanStartRun` happens in memory,
 * `recordRunStarted`/`recordEnergySpent` + `saveGuardBudget` happen later,
 * sometimes after a whole dungeon run's worth of network calls — so a lock
 * that isn't held continuously across that gap wouldn't actually close the
 * race between two processes. Holding it for the whole process instead
 * means only one `liveRun.ts`/`liveFishing.ts`/`orchestrator.ts` invocation
 * can be writing a given guard file at a time, full stop.
 *
 * A lockfile left behind by a crashed process is not trusted forever: if the
 * PID it names is no longer running, the lock is stale and gets reclaimed
 * automatically rather than requiring a human to delete it by hand. Returns
 * a release function; call it once, on the way out (success or failure).
 */
export function acquireGuardLock(path: string = DEFAULT_GUARD_STATE_PATH): () => void {
  const lp = lockPath(path);
  mkdirSync(dirname(path), { recursive: true });
  for (;;) {
    try {
      writeFileSync(lp, String(process.pid), { flag: "wx" }); // exclusive create — fails if the file already exists
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          rmSync(lp);
        } catch {
          // already gone — nothing to clean up
        }
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let heldPid = NaN;
      try {
        heldPid = Number(readFileSync(lp, "utf8").trim());
      } catch {
        continue; // the lock vanished between our failed create and this read — retry
      }
      if (!isProcessAlive(heldPid)) {
        try {
          rmSync(lp);
        } catch {
          // someone else already reclaimed it — retry
        }
        continue;
      }
      throw new GuardPersistenceError(
        `guard lock ${lp} is held by live process ${heldPid} — refusing to start a second concurrent writer against ${path}. ` +
          `If that process is actually gone (e.g. the machine restarted without a clean exit), delete ${lp} by hand.`,
      );
    }
  }
}
