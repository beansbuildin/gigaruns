/**
 * src/strategy/policy.ts — adapter that plugs the EV engine into the sim.
 *
 * The engine itself (`decide.ts`) is a pure function of (state, model, config).
 * Everything stateful a real run needs — remembering the enemy's last move for
 * the first-order model, counting its moves, counting our own for §4c — lives
 * here, in one object, so the pure core stays trivially testable.
 *
 * **Room-agnostic by construction** (session-06 brief §5): nothing in this file
 * or in `decide.ts` mentions room 1. `state.room` is read only as an opponent-
 * model key and as the depth scale on the death penalty. When coverage climbs
 * past room 1 this works deeper with no rewrite.
 *
 * No network, no disk. `model` is exposed so the caller can persist it.
 */

import type { BoonOption } from "../sim/boons.js";
import type { ExchangeResult } from "../sim/combat.js";
import type { Policy } from "../sim/dungeonSim.js";
import type { Rng } from "../sim/rng.js";
import { MOVES, type BattleState, type Combatant, type MoveKey } from "../sim/types.js";
import { DEFAULT_CONFIG, type StrategyConfig } from "./config.js";
import { decide, type Decision } from "./decide.js";
import { pickBoon as rankAndPick } from "./loot.js";
import { OpponentModel } from "./opponentModel.js";

export interface StrategyPolicyOptions {
  config?: Partial<StrategyConfig>;
  /** Share a model across policies, or hand in one loaded from disk. */
  model?: OpponentModel;
  /**
   * Update the model from what the enemy plays. True is the honest default —
   * a real bot observes `lastMove` on every state it polls. Set false to
   * measure the engine on a frozen model.
   */
  learn?: boolean;
  name?: string;
}

export interface StrategyPolicy extends Policy {
  readonly model: OpponentModel;
  readonly config: StrategyConfig;
  /** Our own move counts, which §4c ranks upgrades against. */
  readonly playCounts: Record<MoveKey, number>;
  /** The most recent decision, with its full EV table. For the §4 eyeball log. */
  lastDecision: Decision | null;
}

export function strategyPolicy(opts: StrategyPolicyOptions = {}): StrategyPolicy {
  const config: StrategyConfig = { ...DEFAULT_CONFIG, ...opts.config };
  const model = opts.model ?? new OpponentModel();
  const learn = opts.learn ?? true;
  const playCounts: Record<MoveKey, number> = { rock: 0, paper: 0, scissor: 0 };

  // The enemy's previous move IN THE CURRENT BATTLE. Reset at every battle
  // start: a fresh entity's first move has no predecessor, and carrying one
  // across a room boundary would feed the first-order model evidence that does
  // not exist.
  let prevFoeMove: MoveKey | null = null;

  const policy: StrategyPolicy = {
    name: opts.name ?? "ev-engine",
    model,
    config,
    playCounts,
    lastDecision: null,

    onBattleStart() {
      prevFoeMove = null;
    },

    pick(state: BattleState, legal: MoveKey[], _rng: Rng): MoveKey {
      const d = decide(state, model, config, prevFoeMove);
      policy.lastDecision = d;
      // `decide` prunes by the same rule the sim used to build `legal`, so this
      // should never fire. Assert rather than trust: a silent disagreement here
      // would show up as an unexplained win-rate drift, which is the hardest
      // kind of bug to find in a stochastic harness.
      if (!legal.includes(d.move)) {
        throw new Error(`decide() returned ${d.move}, which the sim says is illegal`);
      }
      playCounts[d.move]++;
      return d.move;
    },

    observe(result: ExchangeResult, room: number) {
      if (learn) model.observe(`${result.state.foe.id}|room${room}`, result.foeMove, prevFoeMove);
      prevFoeMove = result.foeMove;
    },

    pickBoon(player: Combatant, offered: BoonOption[], room: number, _rng: Rng): BoonOption {
      // `roomsRemaining` defaults to the real dungeon's 16 rooms, not the
      // shorter stretch the sim can play — the ranking is about the game.
      return rankAndPick(player, offered, room, { playCounts });
    },
  };

  return policy;
}

/** Total moves played, for reporting. */
export const totalPlays = (p: StrategyPolicy): number =>
  MOVES.reduce((a, m) => a + p.playCounts[m], 0);
