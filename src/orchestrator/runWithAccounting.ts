/**
 * src/orchestrator/runWithAccounting.ts — [session 28, CODEXREVIEW #3]
 *
 * `scripts/orchestrator.ts`'s dungeon and fishing branches both used to
 * `throw e` for any error that wasn't a recognized budget stop BEFORE
 * reaching the after-energy read and `saveGuardBudget` call below it. If
 * `start_run`/fishing's own start action had already spent real energy and
 * something failed afterward (an unexpected response shape, a genuine
 * anomaly per CLAUDE.md §5), the restart forgot that real spend ever
 * happened — a fail-closed violation by omission, since the NEXT process
 * would seed its guard from a budget that undercounts what was truly spent.
 * `scripts/liveRun.ts`/`scripts/liveFishing.ts` already had the correct
 * shape (capture the error, always account, rethrow last); this extracts
 * that shape into one place so both orchestrator branches share the same
 * guarantee instead of two copies that can drift apart, and so the
 * guarantee is testable on its own without spinning up the whole
 * orchestrator loop (client, config, model, real energy reads, ...).
 */

export interface RunWithGuaranteedAccountingOpts {
  /** The real dungeon run / fishing cast. May throw. */
  action: () => Promise<void>;
  /** True for a recognized daily-budget stop (e.g. `isBudgetGuardTrip`) — a designed, expected stop, not an anomaly. */
  isBudgetTrip: (e: unknown) => boolean;
  /** Called (not thrown) when `action` fails with a budget trip. */
  onBudgetTrip: (e: unknown) => void;
  /** The after-energy read + guard persist — must run whether `action` succeeded, budget-tripped, or threw a genuine anomaly. */
  account: () => Promise<void>;
}

/**
 * Runs `action`, then UNCONDITIONALLY runs `account` before this function
 * ever lets an anomaly propagate. A recognized budget trip is swallowed
 * (after `onBudgetTrip` runs) since it's a designed stop, not a failure. Any
 * other error is captured, accounting still runs, and only then is the
 * original error rethrown — so a caller-visible exception never means
 * "accounting was skipped."
 */
export async function runWithGuaranteedAccounting(opts: RunWithGuaranteedAccountingOpts): Promise<void> {
  let anomalyError: unknown = null;
  try {
    await opts.action();
  } catch (e) {
    if (opts.isBudgetTrip(e)) {
      opts.onBudgetTrip(e);
    } else {
      anomalyError = e;
    }
  }
  await opts.account();
  if (anomalyError) throw anomalyError;
}
