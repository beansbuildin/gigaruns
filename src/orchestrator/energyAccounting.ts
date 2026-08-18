/**
 * src/orchestrator/energyAccounting.ts — [session 31, CODEXREVIEW #8]
 *
 * Before this, the daily-budget guard was enforced off the raw before/after
 * account-energy delta (`GuardState.recordEnergySpent(delta)`, computed in
 * `scripts/liveRun.ts`/`liveFishing.ts`/`orchestrator.ts` after a run/cast
 * finished). In-run regen already partially masked the entry cost by
 * clamping any negative delta to 0; an external top-up (a ROM claim landing
 * mid-run) could mask it entirely, letting persisted spend drift below what
 * was actually committed — a real gap in the guard, not a cosmetic one.
 *
 * The fix: `runOnce`/`runOneCast` now call `guards.recordEnergySpent()` with
 * the CONFIRMED `energyCost` the moment `start_run` succeeds (independent of
 * what the account balance does afterward), right alongside the existing
 * `guards.recordRunStarted()` call. The guard is enforced off that committed
 * number from then on. The before/after account read is kept ONLY as a
 * diagnostic for spotting drift — this module reconciles the two and reports
 * a mismatch, but never mutates the guard itself.
 */

export interface EnergyAccountingReport {
  before: number;
  after: number;
  /** Raw account delta, clamped at 0 — never negative, same as the guard's old ledger-of-record number. */
  observedDelta: number;
  /** What the guard actually recorded and enforced this iteration (0 on a resume — no new start_run sent). */
  committedDelta: number;
  /** True when the observed delta doesn't match what was committed — e.g. a ROM claim landed mid-run. */
  drifted: boolean;
}

/**
 * Pure reconciliation, no guard mutation. `committedDelta` is the caller's
 * own before/after read of `guards.spentEnergy` around the run/cast call —
 * see the call sites in `scripts/liveRun.ts`, `scripts/liveFishing.ts`, and
 * `scripts/orchestrator.ts` for how it's captured.
 */
export function reconcileEnergyAccounting(before: number, after: number, committedDelta: number): EnergyAccountingReport {
  const observedDelta = Math.max(0, before - after);
  return { before, after, observedDelta, committedDelta, drifted: observedDelta !== committedDelta };
}

/** One human-readable line for the diagnostic — same message shape at every call site. */
export function describeEnergyAccounting(report: EnergyAccountingReport): string {
  const base = `energy: ${report.before} -> ${report.after}  (observed delta ${report.observedDelta}; committed ${report.committedDelta})`;
  if (!report.drifted) return `  ▸ ${base}`;
  return (
    `  ▸ ${base}\n` +
    `  ⚠ energy accounting drift — committed ${report.committedDelta} vs observed ${report.observedDelta}; ` +
    `guard enforced off committed spend (CODEXREVIEW #8), not the observed delta. Possible external balance ` +
    `change (e.g. a ROM claim) landed mid-run.`
  );
}
