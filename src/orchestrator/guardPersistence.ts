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
 *
 * [session 111, QUESTIONS §65] Fix 4 — the DAY-KEY STRADDLE. `saveGuardBudget`
 * evaluated `todayKey()` at WRITE time and wrote the process's CUMULATIVE
 * counters under it. Those counters are seeded at PROCESS START, so a process
 * that crosses 11:00 Pacific stamped the whole invocation's totals — including
 * everything spent before the rollover — onto the new day. Session 108's single
 * `--runs=4` invocation started 10:53 PT and crossed 11:00 between runs 2 and 3;
 * the new day inherited two runs it never saw, and session 109's first dry run
 * fail-closed with `{"attemptedRun":15,"cap":12}` against a server reading 6.
 *
 * The fix is the day-boundary memo below (`DAY_MEMO`): the counters are rebased
 * at the boundary, so the pre-rollover spend stays on the day that spent it.
 * Naive rebasing does NOT work and was rejected in §65 — on a fresh process on a
 * new day `loadGuardBudget` already discards the stale file and seeds `{0,0}`,
 * so subtracting the file's prior-day totals would go negative.
 *
 * WHAT THIS DOES NOT FIX, stated so it is not mistaken for solved: only the
 * PERSISTED ledger is rebased. `GuardState`'s in-memory counters are still
 * cumulative across the boundary, so the straddling process itself keeps
 * counting the old day's spend against the new day's cap and stops early. That
 * direction is fail-SAFE (it blocks; it can never over-spend), and the next
 * process reads a correct ledger. Fixing the in-memory half means re-seeding a
 * live `GuardState` mid-batch, which is a larger change than §65 asked for.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { atomicWriteJson } from "./atomicWrite.js";

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

// ---------------------------------------------------------------------------
// The day-boundary memo — see this file's header, fix 4 (QUESTIONS §65).
// ---------------------------------------------------------------------------

type DayMemoEntry = {
  /** The guard day the in-memory counters are currently being attributed to. */
  day: string;
  /** Cumulative totals belonging to PREVIOUS days; subtracted from every write. */
  baselineEnergy: number;
  baselineRuns: number;
  /** Cumulative totals as of the last write — what the baseline becomes at a rollover. */
  lastCumulativeEnergy: number;
  lastCumulativeRuns: number;
};

/**
 * Keyed by guard-state PATH, because one process can legitimately account for
 * two arms at once (`guard-budget.json` and `guard-budget-fishing.json`) and
 * they roll over independently of each other's write timing.
 *
 * Module state rather than a parameter, deliberately: the counters this rebases
 * live in a `GuardState` that is handed around by reference across a whole
 * batch, and threading a boundary token through every call site is exactly the
 * shape that produced the potion-policy bug (a policy built once outside a
 * `--runs=N` loop, mutated inside it). Tests reset it with
 * `__resetGuardDayMemo`.
 */
const DAY_MEMO = new Map<string, DayMemoEntry>();

function seedMemoEntry(path: string, seed: { energySpent: number; runsStarted: number }, day: string): DayMemoEntry {
  const entry: DayMemoEntry = {
    day,
    // The seed came from THIS day's file (or is a zero seed), so none of it
    // belongs to a previous day — baseline starts at zero and the first write
    // persists the cumulative total unchanged. That is the pre-fix behaviour,
    // preserved exactly for the overwhelmingly common non-straddling case.
    baselineEnergy: 0,
    baselineRuns: 0,
    lastCumulativeEnergy: seed.energySpent,
    lastCumulativeRuns: seed.runsStarted,
  };
  DAY_MEMO.set(path, entry);
  return entry;
}

/**
 * Records what day a freshly-loaded seed belongs to, and returns the seed so
 * `loadGuardBudget` can stay a one-expression return.
 *
 * FIRST LOAD WINS. A second `loadGuardBudget` on the same path mid-process must
 * NOT re-seed: `liveRun.ts` and `liveFishing.ts` both load twice (a status/
 * preflight read and then the real one), and re-seeding after a rollover would
 * reset the baseline to zero and reintroduce the exact bug this memo exists to
 * fix. Read-only callers (`doctor.ts`, `checkFishingCaps.ts`) go through the
 * same path and must likewise not disturb a live writer's accounting.
 */
function seedDayMemo(
  path: string,
  seed: { energySpent: number; runsStarted: number },
  now: Date,
): { energySpent: number; runsStarted: number } {
  if (!DAY_MEMO.has(path)) seedMemoEntry(path, seed, todayKey(now));
  return seed;
}

/** Test-only: clears the memo so cases can share a path without leaking state between them. */
export function __resetGuardDayMemo(): void {
  DAY_MEMO.clear();
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
export function loadGuardBudget(
  path: string = DEFAULT_GUARD_STATE_PATH,
  now: Date = new Date(),
): { energySpent: number; runsStarted: number } {
  if (!existsSync(path)) return seedDayMemo(path, { energySpent: 0, runsStarted: 0 }, now);

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
  // A stale PRIOR day is a fresh budget, not corruption.
  if (parsed.date !== todayKey(now)) return seedDayMemo(path, { energySpent: 0, runsStarted: 0 }, now);
  return seedDayMemo(path, { energySpent: parsed.energySpent, runsStarted: parsed.runsStarted }, now);
}

/**
 * Overwrites today's persisted spend. Call after every `GuardState` mutation
 * that changes `spentEnergy`/`runCount` (`recordEnergySpent`,
 * `recordRunStarted`) so a crash mid-run loses at most the in-flight action,
 * never previously-completed accounting. Writes through `atomicWrite.ts`'s
 * shared `atomicWriteJson` — sibling temp file, fsynced, renamed into place
 * — see this file's header comment, fix 2, and CODEXAUDIT #5 (session 37).
 */
export function saveGuardBudget(
  energySpent: number,
  runsStarted: number,
  path: string = DEFAULT_GUARD_STATE_PATH,
  now: Date = new Date(),
): void {
  const day = todayKey(now);
  const memo = DAY_MEMO.get(path) ?? seedMemoEntry(path, { energySpent, runsStarted }, day);

  if (memo.day !== day) {
    // The rollover happened between the last save and this one. Everything up
    // to `lastCumulative` was spent on the OLD day and must not follow the
    // counters across — rebase onto it. Using `lastCumulative` rather than the
    // values being written now is what keeps the boundary exact: spend since
    // the last save belongs to the new day.
    memo.baselineEnergy = memo.lastCumulativeEnergy;
    memo.baselineRuns = memo.lastCumulativeRuns;
    memo.day = day;
  }

  if (energySpent < memo.baselineEnergy || runsStarted < memo.baselineRuns) {
    // The counters moved BACKWARDS past the baseline. Within a process they are
    // monotonic under ordinary play, so this means they were re-seeded from an
    // authority — which is a real, live path, not a corruption: `liveFishing.ts`
    // calls `guards.adoptServerRunCount()` after `reconcileFishingLedger`, and
    // that setter assigns the server's own count ABSOLUTELY and can lower it.
    //
    // The first draft of this fix threw here. That was wrong in the one
    // direction that matters — a straddling autonomous fishing batch whose
    // reconciler had just corrected it downward would have CRASHED instead of
    // healing. The baseline is what no longer applies once the counters are
    // re-seeded, so it is dropped, and the raw cumulative is written.
    //
    // Safe by construction: the raw cumulative is always >= the rebased value
    // (the baseline is non-negative), so this errs toward over-counting, which
    // BLOCKS runs and can never authorize a spend. And in the adopt case it is
    // not merely conservative but exactly right — `reconcileFishingLedger`
    // guarantees the adopted count equals the game's own.
    memo.baselineEnergy = 0;
    memo.baselineRuns = 0;
  }

  const dayEnergy = energySpent - memo.baselineEnergy;
  const dayRuns = runsStarted - memo.baselineRuns;

  memo.lastCumulativeEnergy = energySpent;
  memo.lastCumulativeRuns = runsStarted;

  const body: PersistedGuardBudget = { date: day, energySpent: dayEnergy, runsStarted: dayRuns };
  atomicWriteJson(path, body);
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
