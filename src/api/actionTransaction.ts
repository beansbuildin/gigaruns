/**
 * src/api/actionTransaction.ts — [session 78, §2 / CODEXAUG22REVIEW H1] one
 * protocol for every irreversible write.
 *
 * **The fact this exists to handle is measured, not theoretical.**
 * `scripts/liveRun.ts`'s `postWithVerifiedRetry` header, session 08, live:
 * `reward_one` returned HTTP 500 twice on an otherwise byte-identical request —
 * *once where the pick had silently applied server-side anyway (`pickedBoons`
 * had grown despite the error), once where it hadn't.* **The API applies writes
 * while returning errors.** An error is therefore not evidence that nothing
 * happened, and neither is a timeout (see `RequestTimeoutError`), and neither is
 * a Claude Code permission denial (CLAUDE.md rule 13).
 *
 * The protection built for that guarded exactly two call sites — the reward pick
 * and the path pick. `start_run` did not have it, and `start_run` is the call
 * where it costs something that cannot be recovered: on an error the caller
 * throws BEFORE `recordRunStarted`/`recordEnergySpent`/`saveGuardBudget`, so an
 * applied-but-lost start leaves the local ledger reading zero runs while the
 * server has spent 3 of the day's 12 run-units — *"the scarce thing"*
 * (CLAUDE.md rule 4).
 *
 * **This module is CLAUDE.md rule 13 executed in code, at the moment of
 * failure, instead of by a person afterwards.** The rule tells a human to read
 * the server's ledger before believing a denial. That is exactly what
 * `reconcile` does.
 *
 * **No game logic lives here** (CLAUDE.md working style: the API layer knows
 * HTTP, not strategy). Every game-shaped judgement — what authoritative state
 * is, what "it landed" looks like, what the spend is — arrives as a callback.
 */

/**
 * What actually happened to a write. Returned rather than thrown, because the
 * whole failure this module addresses is a caller reading a thrown error as
 * "did not apply".
 */
export type ActionOutcome<TResp, TState = unknown> =
  /**
   * It landed. `response` is null when it landed but the response was lost.
   * `after` is present only on that reconciled path — on the ordinary success
   * there was never a reason to re-read.
   */
  | { outcome: "applied"; response: TResp | null; after?: TState | null }
  /**
   * Authoritative state PROVES it did not land. Safe to retry or to report,
   * and `after` carries the state that proved it — so a caller retrying does
   * not have to spend a second request re-reading what this one already read.
   */
  | { outcome: "not_applied"; error: unknown; after: TState | null }
  /**
   * Neither could be proven. **Fail closed** (CLAUDE.md rule 5): log the state
   * pair, exit non-zero, let a human read it. Never invent a recovery, and
   * never retry — this is the branch where a retry double-spends. `after` is
   * absent when the read itself is what failed, and `readError` is present in
   * exactly that case — a caller reporting this must be able to say WHY the
   * server was unreadable, not just that it was.
   */
  | { outcome: "unknown"; error: unknown; after?: TState | null; readError?: unknown };

/**
 * How one write reconciles itself. `TState` is whatever the caller treats as
 * authoritative — a dungeon run, a fishing doc, a day ledger.
 */
export interface ActionTransaction<TState, TResp> {
  /** For the log only — `"start_run"`, `"reward_one"`, `"play_cards"`. */
  action: string;

  /**
   * Authoritative state read BEFORE the send. May be null when there is
   * genuinely nothing yet (no active run), which is a real reading, not a
   * failure.
   */
  before: TState | null;

  /** The write. */
  send: () => Promise<TResp>;

  /**
   * Re-read authoritative state after a failure. Throwing here is allowed and
   * is what produces `unknown` — an unreadable server is exactly the case where
   * nothing can be proven.
   */
  readState: () => Promise<TState | null>;

  /**
   * Did it land? Called only on the failure path, with the freshly-read state.
   * Return `true` only for a transition the write itself would cause.
   */
  didApply: (before: TState | null, after: TState | null) => boolean;

  /**
   * Does the fresh state PROVE it did not land? Deliberately separate from
   * `!didApply` — "I cannot see that it applied" and "I can see that it did
   * not" are different claims, and collapsing them is what turns an ambiguous
   * write into a confident wrong answer. Anything neither predicate accepts is
   * `unknown`.
   */
  provesNotApplied: (before: TState | null, after: TState | null) => boolean;

  /**
   * Move the local ledger. Called **exactly once**, on `applied`, whether or not
   * a response came back — an applied action with a lost response must still
   * move the ledger, or the server and the ledger disagree silently. Enforced
   * here, not trusted to the caller.
   */
  commitSpend?: () => void;

  /**
   * Errors for which reconciliation is pointless, rethrown untouched instead of
   * being classified. The only member today is `TokenExpiredError` (SPEC §6
   * never retries one): a rejected credential means the write never ran, AND
   * the reconciling read would be rejected identically — so routing it through
   * here would spend an extra request to turn a precise, actionable error
   * ("your JWT expired") into `unknown` ("something happened, a human must
   * look"). That is a strictly worse report.
   *
   * Keep this predicate narrow. Anything that could plausibly have applied does
   * NOT belong here — that is the whole class this module exists for.
   */
  rethrow?: (error: unknown) => boolean;

  /** Structured logging, one line per decision. */
  log?: (event: Record<string, unknown>) => void;
}

/**
 * Run one write under the reconciliation protocol.
 *
 * Never throws for a transport or server failure — that is the point. It DOES
 * propagate a throw from `send` only in the sense of classifying it; a throw
 * from `commitSpend` or `log` is the caller's own bug and is not caught.
 */
export async function runActionTransaction<TState, TResp>(
  tx: ActionTransaction<TState, TResp>,
): Promise<ActionOutcome<TResp, TState>> {
  let committed = false;
  const commitOnce = () => {
    if (committed) return;
    committed = true;
    tx.commitSpend?.();
  };

  let response: TResp;
  try {
    response = await tx.send();
  } catch (error) {
    if (tx.rethrow?.(error)) throw error;
    tx.log?.({ event: "action_failed_reconciling", action: tx.action });

    let after: TState | null;
    try {
      after = await tx.readState();
    } catch (readError) {
      // Cannot read the server, so nothing can be proven either way. This is
      // the fail-closed branch and it must NOT be collapsed into not_applied
      // just because the read is the thing that broke.
      tx.log?.({
        event: "action_outcome_unknown",
        action: tx.action,
        why: "authoritative state could not be read after the failure",
        readError: String(readError),
      });
      return { outcome: "unknown", error, readError };
    }

    if (tx.didApply(tx.before, after)) {
      // Session 08's case: applied server-side despite the error response.
      commitOnce();
      tx.log?.({ event: "action_applied_despite_error", action: tx.action });
      return { outcome: "applied", response: null, after };
    }

    if (tx.provesNotApplied(tx.before, after)) {
      tx.log?.({ event: "action_not_applied", action: tx.action });
      return { outcome: "not_applied", error, after };
    }

    tx.log?.({
      event: "action_outcome_unknown",
      action: tx.action,
      why: "state showed neither the transition nor proof it did not happen",
    });
    return { outcome: "unknown", error, after };
  }

  commitOnce();
  tx.log?.({ event: "action_applied", action: tx.action });
  return { outcome: "applied", response };
}
