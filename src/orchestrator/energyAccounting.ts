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
  /**
   * True when the observed delta doesn't match what was committed.
   *
   * ⚠ [session 95] This used to say "e.g. a ROM claim landed mid-run", and on
   * the evidence that is the WRONG default reading — see
   * `describeEnergyAccounting` below. Drift is the normal case on any run of
   * nontrivial length, not an anomaly.
   */
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

/**
 * One human-readable line for the diagnostic — same message shape at every call
 * site.
 *
 * ## [session 95 §C2] The warning used to name the wrong cause
 *
 * It read *"Possible external balance change (e.g. a ROM claim) landed
 * mid-run"*, and that pointed every future reader at an actor that was not
 * there. Session 94 fired this on **4 of 4** juiced runs — observed 59 against
 * a committed 60, every time — and **no ROM claim happened during any of
 * them**; the only claim preceded run 1 by about two minutes. Between-run
 * readings rose unaided (256→257, 198→200, 141→142), which is passive regen at
 * 18/hr ≈ 0.3/min across a ~6-minute run.
 *
 * So drift of roughly this size is the EXPECTED state of a run of nontrivial
 * length, not an anomaly, and the message now says so.
 *
 * ⚠ **In-run passive regen is named as the LEADING CANDIDATE, not asserted**,
 * matching the hedge DECISIONS 2026-08-23 (session 87 §3) already settled on
 * for the closely-related `tightDelta -60` probe: regen against an integer pool
 * is the leading candidate there too, and was explicitly NOT asserted. Do not
 * upgrade this wording to a certainty without a probe that isolates it.
 *
 * **The enforcement is unchanged and was never wrong.** The guard spends off
 * the committed cost (CODEXREVIEW #8), which is the conservative direction —
 * §23 said not to "fix" the underlying drift, and this change does not. Only
 * the diagnostic text moved.
 */
export function describeEnergyAccounting(report: EnergyAccountingReport): string {
  const base = `energy: ${report.before} -> ${report.after}  (observed delta ${report.observedDelta}; committed ${report.committedDelta})`;
  if (!report.drifted) return `  ▸ ${base}`;
  return (
    `  ▸ ${base}\n` +
    `  ⚠ energy accounting drift — committed ${report.committedDelta} vs observed ${report.observedDelta}; ` +
    `guard enforced off committed spend (CODEXREVIEW #8), not the observed delta. Leading candidate is ` +
    `in-run passive regen (18/hr) crediting back part of the charge — expected on any run of nontrivial ` +
    `length, and not asserted. A gap far larger than regen could account for would instead suggest an ` +
    `external balance change; check the ROM/claim history before assuming one.`
  );
}
