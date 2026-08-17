/**
 * src/orchestrator/guards.ts — hard stops, centralized (SPEC §6, CLAUDE.md §5).
 * "A stopped bot costs nothing. A confused bot costs energy and items."
 *
 * Every method here throws `GuardTrip` rather than returning a boolean —
 * CLAUDE.md §5 says stop the loop on any of these, not degrade gracefully, so
 * there is no legitimate caller that wants to inspect a false and continue.
 * Pure state tracking, no network, no `process.exit` — the caller (a script)
 * owns logging the response body and picking the exit code, so this stays
 * testable without a live process to kill.
 *
 * Two of SPEC §6's six guards aren't here:
 *  - "unknown enum in any response" is enforced by zod schema validation in
 *    `src/api/client.ts` (`UnexpectedResponseError`) for the shape of GET
 *    responses. `assertKnownEnum` below covers enum-like fields a live loop
 *    reads out of a passthrough schema that zod itself won't constrain.
 *  - "JWT rejected" is `TokenExpiredError`, already thrown by the client —
 *    the live loop should let it propagate rather than catching and retrying.
 */

export class GuardTrip extends Error {
  constructor(
    public readonly reason: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(`Guard tripped: ${reason}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
    this.name = "GuardTrip";
  }
}

export interface SessionBudget {
  dailyEnergyBudget: number;
  maxRunsPerSession: number;
  maxConsecutiveActionFailures: number;
}

/**
 * Prior spend to seed a fresh `GuardState` from — e.g. energy/runs already
 * spent today by an earlier process invocation. [session 09] A guard rebuilt
 * fresh per `npm run live` invocation enforced nothing across invocations:
 * the daily budget reset to zero every time the process restarted, even
 * though CLAUDE.md lists it as a hard rule. Persisting and reloading this is
 * `src/orchestrator/guardPersistence.ts`'s job — kept separate so this class
 * stays fs-free and trivially testable, per its own header comment.
 */
export interface GuardSeed {
  energySpent?: number;
  runsStarted?: number;
}

export class GuardState {
  private energySpent: number;
  private runsStarted: number;
  private consecutiveFailures = 0;
  private lastStateKey: string | null = null;

  constructor(
    private readonly budget: SessionBudget,
    seed: GuardSeed = {},
  ) {
    this.energySpent = seed.energySpent ?? 0;
    this.runsStarted = seed.runsStarted ?? 0;
  }

  get spentEnergy(): number {
    return this.energySpent;
  }

  get runCount(): number {
    return this.runsStarted;
  }

  /** Call before sending the action that starts a new dungeon run. */
  assertCanStartRun(estimatedEnergyCost: number): void {
    if (this.runsStarted + 1 > this.budget.maxRunsPerSession) {
      throw new GuardTrip("session run cap reached", {
        attemptedRun: this.runsStarted + 1,
        cap: this.budget.maxRunsPerSession,
      });
    }
    if (this.energySpent + estimatedEnergyCost > this.budget.dailyEnergyBudget) {
      throw new GuardTrip("daily energy budget would be exceeded", {
        spent: this.energySpent,
        estimatedEnergyCost,
        budget: this.budget.dailyEnergyBudget,
      });
    }
  }

  /** Call once, when the run-starting action is actually sent. */
  recordRunStarted(): void {
    this.runsStarted++;
  }

  /**
   * Call after a run ends with the OBSERVED energy delta (live energy
   * before minus after), never an assumed constant — CLAUDE.md §1,
   * "discover, don't assume."
   */
  recordEnergySpent(amount: number): void {
    this.energySpent += amount;
    if (this.energySpent > this.budget.dailyEnergyBudget) {
      throw new GuardTrip("daily energy budget exceeded", {
        spent: this.energySpent,
        budget: this.budget.dailyEnergyBudget,
      });
    }
  }

  /** Call after every dungeon action attempt, success or failure. */
  recordActionResult(ok: boolean): void {
    if (ok) {
      this.consecutiveFailures = 0;
      return;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.budget.maxConsecutiveActionFailures) {
      throw new GuardTrip("consecutive action failures", {
        failures: this.consecutiveFailures,
        limit: this.budget.maxConsecutiveActionFailures,
      });
    }
  }

  /**
   * SPEC §6: "HP-zero loop detected (same state twice in a row)". Pass a
   * cheap fingerprint of the polled state — the parts that should always
   * change turn to turn (room, HP, armor, phase flags, actionToken). Two
   * identical fingerprints back to back means the loop is stalled, not that
   * nothing happened: a live dungeon state always advances on a successful
   * action.
   */
  checkStateProgress(stateKey: string): void {
    if (this.lastStateKey !== null && this.lastStateKey === stateKey) {
      throw new GuardTrip("same state observed twice in a row", { stateKey });
    }
    this.lastStateKey = stateKey;
  }
}

/**
 * Fails closed on a value outside a known set — for enum-like fields a
 * passthrough zod schema won't constrain (e.g. exchange outcome, phase name).
 * CLAUDE.md §5: "unknown enum" is a hard stop, not a value to coerce or
 * ignore.
 */
export function assertKnownEnum<T extends string>(value: string, allowed: readonly T[], context: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new GuardTrip("unknown enum value", { context, value, allowed });
  }
  return value as T;
}

/**
 * Task 10: the orchestrator runs both dungeon and fishing loops and must
 * not let one mode's designed, expected stop (its daily budget or run/cast
 * cap) take the other mode down with it — that's a policy boundary working
 * as intended, not the kind of "unexpected state" CLAUDE.md §5 says to fail
 * closed on. A GENUINE anomaly (consecutive action failures, a stalled
 * state, an unknown enum) must still propagate and halt the whole process —
 * this is deliberately a narrow allowlist of the reason strings that mean
 * "this mode is done for today," not a blanket "any GuardTrip is fine."
 */
const BUDGET_GUARD_REASONS: ReadonlySet<string> = new Set([
  "session run cap reached",
  "daily energy budget would be exceeded",
  "daily energy budget exceeded",
]);

export function isBudgetGuardTrip(trip: GuardTrip): boolean {
  return BUDGET_GUARD_REASONS.has(trip.reason);
}
