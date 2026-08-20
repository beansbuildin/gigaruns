/**
 * src/orchestrator/attemptTelemetry.ts — counts FIRST-ATTEMPT failures per
 * action class, whether or not a retry later succeeded.
 *
 * [session 53, brief §1] This exists because of a blind spot that hid a real
 * bug for thirty-nine sessions. Every `reward_*`/`path_*` POST this project
 * has ever sent was rejected on its first attempt — 66 of 66 across ten run
 * logs, 100% — and every one of those runs reported success, because
 * `postWithVerifiedRetry` absorbed the failure and the retry landed. A
 * per-class SUCCESS rate that scores the retry as the outcome reports 100%
 * and says nothing. The only statistic that could have surfaced this is the
 * first-attempt failure rate, which is what this module counts.
 *
 * Generalising past that one bug: any retry loop that succeeds is a place
 * where a persistent server-side disagreement can hide indefinitely.
 *
 * Pure bookkeeping — no I/O, no network, no clock. The caller decides what a
 * "class" is and where the summary goes.
 */

/** Fraction of first attempts that may fail before a class is worth warning about. */
export const FIRST_ATTEMPT_FAILURE_WARN_RATE = 0.2;

export interface AttemptClassStats {
  /** Logical actions of this class — one per decision, NOT one per HTTP request. */
  attempts: number;
  /** Of those, how many were rejected on their FIRST attempt (retry outcome irrelevant). */
  firstAttemptFailures: number;
}

export interface AttemptClassReport extends AttemptClassStats {
  actionClass: string;
  /** `firstAttemptFailures / attempts`; 0 when `attempts` is 0. */
  rate: number;
  /** True once `rate` is at or above `FIRST_ATTEMPT_FAILURE_WARN_RATE`. */
  warn: boolean;
}

export class AttemptTelemetry {
  private readonly classes = new Map<string, AttemptClassStats>();

  /**
   * Record one logical action. `firstAttemptFailed` is about the FIRST POST
   * only — pass `true` even when a retry subsequently succeeded, because that
   * is precisely the case this module exists to make visible.
   */
  record(actionClass: string, firstAttemptFailed: boolean): void {
    const cur = this.classes.get(actionClass) ?? { attempts: 0, firstAttemptFailures: 0 };
    cur.attempts += 1;
    if (firstAttemptFailed) cur.firstAttemptFailures += 1;
    this.classes.set(actionClass, cur);
  }

  /** Sorted worst-rate-first, then by class name, so the output is stable. */
  report(warnRate: number = FIRST_ATTEMPT_FAILURE_WARN_RATE): AttemptClassReport[] {
    return [...this.classes.entries()]
      .map(([actionClass, s]) => {
        const rate = s.attempts === 0 ? 0 : s.firstAttemptFailures / s.attempts;
        return { actionClass, ...s, rate, warn: s.attempts > 0 && rate >= warnRate };
      })
      .sort((a, b) => b.rate - a.rate || a.actionClass.localeCompare(b.actionClass));
  }

  totals(): AttemptClassStats {
    let attempts = 0;
    let firstAttemptFailures = 0;
    for (const s of this.classes.values()) {
      attempts += s.attempts;
      firstAttemptFailures += s.firstAttemptFailures;
    }
    return { attempts, firstAttemptFailures };
  }

  /**
   * Human-readable block for the RUN SUMMARY — brief §1's point is that this
   * belongs where someone reads it, not only in the JSONL where it sat
   * unnoticed in seven runs across nine sessions.
   */
  format(warnRate: number = FIRST_ATTEMPT_FAILURE_WARN_RATE): string {
    const rows = this.report(warnRate);
    if (rows.length === 0) return "▸ first-attempt failures: none recorded (no actions posted)";
    const t = this.totals();
    const lines = [
      `▸ first-attempt failures by action class (retries NOT counted as success):`,
      ...rows.map(
        (r) =>
          `    ${r.warn ? "WARN " : "     "}${r.actionClass.padEnd(16)} ` +
          `${String(r.firstAttemptFailures).padStart(3)}/${String(r.attempts).padEnd(3)} ` +
          `= ${(r.rate * 100).toFixed(1)}%`,
      ),
      `    ${"".padEnd(5)}${"TOTAL".padEnd(16)} ${String(t.firstAttemptFailures).padStart(3)}/${String(t.attempts).padEnd(3)} ` +
        `= ${(t.attempts === 0 ? 0 : (t.firstAttemptFailures / t.attempts) * 100).toFixed(1)}%`,
    ];
    for (const r of rows.filter((x) => x.warn)) {
      lines.push(
        `  ⚠ ${r.actionClass}: ${(r.rate * 100).toFixed(1)}% of first attempts rejected ` +
          `(${r.firstAttemptFailures}/${r.attempts}) — above the ${(warnRate * 100).toFixed(0)}% threshold. ` +
          `A retry loop that succeeds can hide a persistent server-side disagreement indefinitely.`,
      );
    }
    return lines.join("\n");
  }
}
