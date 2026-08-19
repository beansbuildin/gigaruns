/**
 * src/orchestrator/scheduler.ts — Task 10: budget-aware loop, energy-regen
 * sleeps. Pure decision logic only — no network, no fs, no timers, mirroring
 * `guards.ts`'s own testability contract. The caller (`scripts/orchestrator.ts`)
 * owns actually sleeping, calling `runOnce`/`runOneCast`, and persisting
 * guard state; this module only decides WHAT to do next given the numbers.
 */

export interface EnergyState {
  /** Real current energy, from `GET /offchain/player/energy`. */
  value: number;
  max: number;
  regenPerHour: number;
}

/** One mode's (dungeon or fishing) policy budget, mirroring `GuardState`'s own two caps. */
export interface ModeBudget {
  /** Real energy cost of one action in this mode (a run's `energyCost`, a cast's tier cost). */
  costPerAction: number;
  dailyEnergyBudget: number;
  energySpentToday: number;
  maxActionsPerSession: number;
  actionsToday: number;
}

export type SchedulerDecision =
  | { kind: "dungeon" }
  | { kind: "fishing" }
  | {
      kind: "sleep";
      seconds: number;
      reason: string;
      /**
       * [session 47, brief §1f] The energy level being waited for — the
       * cheaper still-eligible mode's `costPerAction`.
       *
       * Every `sleep` this module returns is an energy shortfall, and since
       * session 22 an energy shortfall has been a CLAIM, not a wait: the ROM
       * bank routinely holds thousands. Session 25 hit this live — the loop
       * computed a ~1600s sleep at 4/420 energy, the user topped up from ROMs
       * out-of-band, and the running process had no way to notice. Exposing
       * the target lets `scripts/orchestrator.ts` try `ensureEnergyFor` before
       * honouring the sleep, without parsing it back out of `reason`.
       *
       * This module stays pure and network-free — it reports the number, it
       * does not claim anything.
       */
      targetEnergy: number;
    }
  | { kind: "done"; reason: string };

/** Same two-check shape as `GuardState.assertCanStartRun` — a mode is policy-affordable only if BOTH the run/cast cap and the energy budget have room. */
function policyAffordable(mode: ModeBudget): boolean {
  return mode.actionsToday < mode.maxActionsPerSession && mode.energySpentToday + mode.costPerAction <= mode.dailyEnergyBudget;
}

function realAffordable(energy: EnergyState, mode: ModeBudget): boolean {
  return energy.value >= mode.costPerAction;
}

/** Headroom ratio: 1.0 = nothing spent yet, 0.0 = at the daily cap. Used to balance the two loops across a long session rather than always favoring one. */
function headroom(mode: ModeBudget): number {
  if (mode.dailyEnergyBudget <= 0) return 0;
  return 1 - mode.energySpentToday / mode.dailyEnergyBudget;
}

/**
 * Decide the next action. `dungeon`/`fishing` are `null` when that mode
 * isn't configured at all (e.g. fishing's `config/discovered.json.dendren`
 * block absent) — treated as permanently unavailable, never as "sleep and
 * wait for it."
 */
export function nextAction(energy: EnergyState, dungeon: ModeBudget | null, fishing: ModeBudget | null): SchedulerDecision {
  const dungeonPolicyOk = dungeon !== null && policyAffordable(dungeon);
  const fishingPolicyOk = fishing !== null && policyAffordable(fishing);

  if (!dungeonPolicyOk && !fishingPolicyOk) {
    return { kind: "done", reason: "both modes' daily policy budget/cap exhausted (or neither is configured)" };
  }

  const dungeonReadyNow = dungeonPolicyOk && realAffordable(energy, dungeon!);
  const fishingReadyNow = fishingPolicyOk && realAffordable(energy, fishing!);

  if (dungeonReadyNow && fishingReadyNow) {
    // Prefer whichever mode has relatively MORE of its own daily budget
    // left unspent — balances the two loops across a long session instead
    // of always draining one first. Ties go to dungeon (arbitrary, stable).
    return headroom(dungeon!) >= headroom(fishing!) ? { kind: "dungeon" } : { kind: "fishing" };
  }
  if (dungeonReadyNow) return { kind: "dungeon" };
  if (fishingReadyNow) return { kind: "fishing" };

  // Neither affordable RIGHT NOW, but at least one is policy-affordable —
  // sleep until real energy regens enough for the CHEAPER of the two
  // still-eligible modes, so the wait is never longer than necessary.
  const waitingCosts: number[] = [];
  if (dungeonPolicyOk) waitingCosts.push(dungeon!.costPerAction);
  if (fishingPolicyOk) waitingCosts.push(fishing!.costPerAction);
  const targetCost = Math.min(...waitingCosts);
  const needed = targetCost - energy.value;

  if (energy.regenPerHour <= 0) {
    return { kind: "done", reason: "not enough real energy and regenPerHour is 0 — would sleep forever" };
  }
  const regenPerSecond = energy.regenPerHour / 3600;
  const seconds = Math.ceil(needed / regenPerSecond);
  return { kind: "sleep", seconds, targetEnergy: targetCost, reason: `waiting for real energy to reach ${targetCost} (currently ${energy.value})` };
}
