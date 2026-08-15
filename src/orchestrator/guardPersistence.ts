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
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const PersistedGuardBudgetSchema = z.object({
  date: z.string(),
  energySpent: z.number().nonnegative(),
  runsStarted: z.number().int().nonnegative(),
});

export type PersistedGuardBudget = z.infer<typeof PersistedGuardBudgetSchema>;

export const DEFAULT_GUARD_STATE_PATH = join("data", "guard-budget.json");

/** UTC calendar date — deterministic and independent of the host's local timezone. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Loads today's already-spent energy/runs, or `{0, 0}` if nothing is on disk
 * yet, the file is corrupt, or the persisted date is a prior day (a fresh
 * budget starts each day, same as `config/bot.json`'s `dailyEnergyBudget`
 * intends). Never throws — a missing or corrupt guard-state file should fail
 * open to a zero seed, not block startup; the actual budget enforcement
 * still happens in `GuardState` itself once seeded.
 */
export function loadGuardBudget(path: string = DEFAULT_GUARD_STATE_PATH): { energySpent: number; runsStarted: number } {
  if (!existsSync(path)) return { energySpent: 0, runsStarted: 0 };
  let parsed: PersistedGuardBudget;
  try {
    parsed = PersistedGuardBudgetSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return { energySpent: 0, runsStarted: 0 };
  }
  if (parsed.date !== todayKey()) return { energySpent: 0, runsStarted: 0 };
  return { energySpent: parsed.energySpent, runsStarted: parsed.runsStarted };
}

/**
 * Overwrites today's persisted spend. Call after every `GuardState` mutation
 * that changes `spentEnergy`/`runCount` (`recordEnergySpent`,
 * `recordRunStarted`) so a crash mid-run loses at most the in-flight action,
 * never previously-completed accounting.
 */
export function saveGuardBudget(energySpent: number, runsStarted: number, path: string = DEFAULT_GUARD_STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: PersistedGuardBudget = { date: todayKey(), energySpent, runsStarted };
  writeFileSync(path, JSON.stringify(body, null, 2));
}
