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
  /**
   * [session 112] True when the SERVER has already said this mode's daily cap
   * is spent — carried across invocations so a later process on the same
   * persisted day fails closed instead of eating a second real rejection.
   *
   * This used to be encoded by writing `maxRunsPerSession` into `runsStarted`.
   * See `recordServerCapReached` for why that was wrong.
   */
  serverCapReached?: boolean;
}

export class GuardState {
  private energySpent: number;
  private runsStarted: number;
  private serverCapReached: boolean;
  private consecutiveFailures = 0;
  private lastStateKey: string | null = null;

  constructor(
    private readonly budget: SessionBudget,
    seed: GuardSeed = {},
  ) {
    this.energySpent = seed.energySpent ?? 0;
    this.runsStarted = seed.runsStarted ?? 0;
    this.serverCapReached = seed.serverCapReached ?? false;
  }

  get spentEnergy(): number {
    return this.energySpent;
  }

  get runCount(): number {
    return this.runsStarted;
  }

  /**
   * [session 112] Whether the server has declared this mode exhausted for the
   * persisted day. Kept beside the count rather than folded into it — see
   * `recordServerCapReached`.
   */
  get capReachedByServer(): boolean {
    return this.serverCapReached;
  }

  /**
   * Call before sending the action that starts a new dungeon run.
   * `runUnits` defaults to 1 (an ordinary run) — [session 42, Task 14] a
   * juiced Forbidden Woods run consumes 3 of the 12 daily run-count units,
   * not 1 (SPEC.md's Juiced run-mode section, user-confirmed against the
   * real `dayProgressEntities` counter moving 3→6 after one juiced start).
   * Passing 3 here is what makes the run-count half of that cost real to
   * this guard instead of silently under-counted.
   */
  assertCanStartRun(estimatedEnergyCost: number, runUnits = 1): void {
    // [session 112] The server's own verdict outranks the local count, and is
    // checked FIRST so the trip names the real reason. Before this flag
    // existed the same protection was obtained by inflating `runsStarted` to
    // the cap, which tripped this very line — the behaviour is preserved, the
    // corruption of the count is not.
    if (this.serverCapReached) {
      throw new GuardTrip("server daily cap reached", {
        runsStarted: this.runsStarted,
        cap: this.budget.maxRunsPerSession,
        source: "server rejection recorded earlier this persisted day",
      });
    }
    if (this.runsStarted + runUnits > this.budget.maxRunsPerSession) {
      throw new GuardTrip("session run cap reached", {
        attemptedRun: this.runsStarted + runUnits,
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

  /** Call once, when the run-starting action is actually sent. `runUnits` — see `assertCanStartRun`'s doc comment. */
  recordRunStarted(runUnits = 1): void {
    this.runsStarted += runUnits;
  }

  /**
   * [session 29, CODEXREVIEW #6] Call when the SERVER (not local tracking)
   * has confirmed this mode's daily cap is exhausted — a start_run/cast
   * rejection whose message names the real cap (e.g. fishing's "Player has
   * reached max runs for fishing", session 27). Marks this mode exhausted for
   * the rest of the persisted day, so a LATER invocation on the same day
   * (once saved via `saveGuardBudget`) fails closed locally instead of
   * attempting and eating a second real rejection.
   *
   * ── [session 112] IT NO LONGER FORGES A COUNT, AND THAT WAS A REAL BUG ──
   *
   * This method used to be `this.runsStarted = Math.max(this.runsStarted,
   * this.budget.maxRunsPerSession)`. That encoded a BOOLEAN ("the server says
   * we are done") by writing a POLICY CONSTANT into a counter whose persisted
   * meaning is "how many casts the GAME has counted today" — the quantity
   * `fishingLedgerReconcile.ts` reconciles against `dayDocs`. Two different
   * measurement systems, one field.
   *
   * Session 107 is what it looks like from outside: a batch of **22 casts
   * played, 20 charged by the game**, whose reconciler trace ended *agreed at
   * 20*, left `guard-budget-fishing.json` reading **`runsStarted: 25`** —
   * because `dendren.maxCastsPerSession` is 25. `liveRun.ts --status` then
   * printed "25/25 used -> 0 remaining" and `checkFishingCaps.ts` printed
   * "repo over-counted by 5". The 5 was not a miscount; it was the gap
   * between a config knob and a server ledger.
   *
   * **Failure direction: SAFE.** An inflated count can only refuse casts, never
   * authorize one. And on the fishing path it was not even protective —
   * `reconcileFishingLedger` runs before the next batch and `adoptServerRunCount`
   * is deliberately non-monotonic, so it lowered the forged 25 straight back to
   * the game's 20. The sentinel therefore bought nothing live and cost the
   * accuracy of every surface that reads the file WITHOUT reconciling
   * (`--status`, `checkFishingCaps`). That is the whole harm, and it is why
   * the flag now travels beside the count instead of inside it.
   *
   * **This is NOT the session-111 day-key straddle resurfacing.** That bug was
   * about WHEN a counter is stamped (the 11:00 PT boundary); this one is about
   * WHAT value is stamped. `guardPersistence.ts`'s `DAY_MEMO` fix is unrelated
   * and unaffected.
   *
   * Monotonic: once set, never cleared. Only a new persisted day clears it,
   * which is `loadGuardBudget`'s job, not this one's.
   */
  recordServerCapReached(): void {
    this.serverCapReached = true;
  }

  /**
   * [session 70 §4] Sets the tracked run count to what the SERVER's own daily
   * ledger says — for fishing, `dayDocs[pondId].UINT256_CID`; see
   * `src/orchestrator/fishingLedgerReconcile.ts` for why this is needed at all.
   *
   * **Deliberately NOT monotonic**, which is the whole difference between this
   * and `recordServerCapReached` above. That method is a one-way backstop and
   * must never lower a count. This one exists precisely because the local
   * counter has drifted in BOTH directions against the server's on a single day
   * (game 14 / repo 15, then game 16 / repo 15), and a `Math.max` would fix
   * only the direction that plans a batch the server rejects while leaving the
   * direction that refuses casts the account still has.
   *
   * The server is the authority on how many runs were started. This method is
   * the only place that is allowed to say so.
   */
  adoptServerRunCount(serverRunCount: number): void {
    this.runsStarted = serverRunCount;
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
  // [session 112] The server's own daily cap, split out of the line above.
  // Until this session a server-cap rejection was recorded by inflating
  // `runsStarted` to the configured maximum, so it surfaced as "session run
  // cap reached" — already in this set, which is why the split has to add the
  // new reason HERE and not only in `assertCanStartRun`. Missing it would turn
  // a designed daily stop into an anomaly and, per
  // `runWithAccounting.ts`, take the whole orchestrator down over one
  // exhausted mode — the exact failure session 29 added this classifier to
  // prevent.
  "server daily cap reached",
  "daily energy budget would be exceeded",
  "daily energy budget exceeded",
]);

export function isBudgetGuardTrip(trip: GuardTrip): boolean {
  return BUDGET_GUARD_REASONS.has(trip.reason);
}
