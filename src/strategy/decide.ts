/**
 * src/strategy/decide.ts — SPEC §4's decision procedure. Pure; no I/O.
 *
 *   1. legal moves, ours and (via charges) the enemy's
 *   2. predict P(enemy move)              — opponentModel.ts
 *   3. resolve all 9 outcomes with the live ATK/DEF numbers
 *   4. score each resulting state          — utility.ts
 *   5. play argmax
 *
 * Two things this does that the spec's sketch does not, both forced by the
 * corpus:
 *
 * **Net damage is never read off raw ATK.** Step 3 resolves through
 * `src/sim/combat.ts`, so the tie threshold is structural rather than
 * approximated: on a tie both sides regenerate their own move's DEF before both
 * deal, and a move whose ATK sits at or below the opponent's move DEF makes
 * exactly zero progress, forever. `netDamageOnWin`/`netDamageOnTie` appear in
 * the EV table so that the log shows the number the choice actually turned on
 * (SPEC §4b, "Task 5's EV engine must score by netDamageOnTie, not raw ATK").
 *
 * **Maximin is not a separate branch.** SPEC §4a asks for a maximin fallback
 * "over the uncertainty set" when the model is uninformative. Taking the
 * uncertainty set to be the ε-contamination neighbourhood of the model —
 * `{(1-λ)·P̂ + λ·q : q any distribution}` — the worst case over that set is
 * exactly `(1-λ)·EV + λ·min`, so one formula covers both regimes and λ is just
 * larger when confidence is low. One code path, no cliff at the floor.
 */

import {
  chargesAfterPlay,
  chargesAfterRest,
  legalMoves,
  netDamageOnTie,
  netDamageOnWin,
  resolveExchange,
  compare,
} from "../sim/combat.js";
import { isDead, MOVES, type BattleState, type MoveKey, type Outcome } from "../sim/types.js";
import type { StrategyConfig } from "./config.js";
import type { OpponentModel, Prediction } from "./opponentModel.js";
import { utility } from "./utility.js";

/** Matches `cardChoice.ts`'s `EV_TIE_EPSILON` — same purpose, same value. */
const SCORE_TIE_EPSILON = 1e-9;

/**
 * ATK-weighted charge reserve we'd carry forward if we played `played` now.
 *
 * Exact, not an expectation: `applyCharges` in combat.ts decrements the
 * played move and rests the other two based only on which move WE played,
 * never on the enemy's reply, so our own post-exchange charges don't depend
 * on `theirs` at all.
 *
 * Weighted by each move's own ATK rather than counted blind — a charge
 * sitting in a depleted high-ATK move costs more to the rooms ahead than one
 * in a low-ATK move (CODEXIMPROVE #4 stage 2). ATK is play-share's cheaper
 * alternative here: `playCounts` (the project's other move-value signal,
 * `opponentModel.ts`/`loot.ts`) lives in the stateful `strategyPolicy`
 * adapter, and threading it into `decide()` would break the pure-function
 * contract DECISIONS 2026-08-16 records for this module.
 */
function chargeReserve(state: BattleState, played: MoveKey): number {
  let reserve = 0;
  for (const m of MOVES) {
    const ms = state.me.moves[m];
    const charges = m === played ? chargesAfterPlay(ms.charges) : chargesAfterRest(ms.charges, ms.maxCharges);
    reserve += Math.max(0, charges) * ms.atk;
  }
  return reserve;
}

export interface EvCell {
  foeMove: MoveKey;
  /** P(enemy plays this), from the model after pruning. */
  p: number;
  outcome: Outcome;
  /**
   * HP+armor damage our move lands against this reply — full ATK on a win,
   * `max(0, ourATK - theirMoveDEF)` on a tie, 0 on a loss. The number the tie
   * asymmetry lives in; see the header.
   */
  netDamage: number;
  /** True when mirroring this reply can never reduce the enemy's HP. */
  stalls: boolean;
  /** Value of the resulting state, at the configured depth. */
  value: number;
}

export interface EvRow {
  move: MoveKey;
  charges: number;
  /** Σ P(e)·value — the expectation under the model. */
  ev: number;
  /** min over legal replies — the adversarial corner of the uncertainty set. */
  worst: number;
  /** `(1-λ)·ev + λ·worst`. What the argmax is taken over. */
  score: number;
  cells: EvCell[];
}

export interface Decision {
  move: MoveKey;
  table: EvRow[];
  prediction: Prediction;
  /** The ambiguity weight actually applied, after reading `confidence`. */
  lambda: number;
}

/**
 * Expected value of `state` for us, `depth` exchanges deep.
 *
 * Us: max. Enemy: expectation under the model, contaminated by λ toward its
 * worst reply. Depth 0 or a terminal state falls through to `utility`.
 */
function value(
  state: BattleState,
  model: OpponentModel,
  cfg: StrategyConfig,
  depth: number,
  prev: MoveKey | null,
): number {
  if (depth <= 0 || isDead(state.me) || isDead(state.foe)) return utility(state, cfg);

  const mine = legalMoves(state.me, cfg.chargesAreHardLimit);
  const theirs = legalMoves(state.foe, cfg.chargesAreHardLimit);
  // Neither side can act. The sim marks this CHARGES_ALL_LOCKED and halts, and
  // nothing in the corpus shows what the server does, so score the state as it
  // stands rather than inventing a continuation.
  if (mine.length === 0 || theirs.length === 0) return utility(state, cfg);

  const pred = model.predict(state.foe, state.room, {
    prev,
    chargesAreHardLimit: cfg.chargesAreHardLimit,
  });
  const lambda = pred.confidence === "low" ? cfg.ambiguityWhenUnsure : cfg.ambiguity;

  let best = -Infinity;
  for (const m of mine) {
    let ev = 0;
    let worst = Infinity;
    for (const e of theirs) {
      const next = resolveExchange(state, m, e).state;
      const v = value(next, model, cfg, depth - 1, e);
      ev += pred.p[e] * v;
      if (v < worst) worst = v;
    }
    const score = (1 - lambda) * ev + lambda * worst;
    if (score > best) best = score;
  }
  return best;
}

/**
 * Choose a move. Deterministic given (state, model, config) — no RNG, so a
 * disagreement between two runs is a state difference, never noise.
 *
 * `prev` is the enemy's previous move IN THIS BATTLE, for the first-order
 * model. Pass null on the opening exchange; a fresh entity's first move has no
 * predecessor and feeding it one across a room boundary would invent evidence.
 */
export function decide(
  state: BattleState,
  model: OpponentModel,
  cfg: StrategyConfig,
  prev: MoveKey | null = null,
): Decision {
  const mine = legalMoves(state.me, cfg.chargesAreHardLimit);
  if (mine.length === 0) throw new Error("decide() called with no legal move — caller must handle this");

  const prediction = model.predict(state.foe, state.room, {
    prev,
    chargesAreHardLimit: cfg.chargesAreHardLimit,
  });
  const lambda = prediction.confidence === "low" ? cfg.ambiguityWhenUnsure : cfg.ambiguity;
  const theirs = MOVES.filter((m) => !prediction.pruned.includes(m));

  const table: EvRow[] = mine.map((m) => {
    const cells: EvCell[] = theirs.map((e) => {
      const outcome = compare(m, e);
      const next = resolveExchange(state, m, e).state;
      return {
        foeMove: e,
        p: prediction.p[e],
        outcome,
        netDamage:
          outcome > 0
            ? netDamageOnWin(state.me.moves[m].atk)
            : outcome === 0
              ? netDamageOnTie(state.me.moves[m].atk, state.foe.moves[e].def)
              : 0,
        stalls: outcome === 0 && netDamageOnTie(state.me.moves[m].atk, state.foe.moves[e].def) === 0,
        value: value(next, model, cfg, cfg.depth - 1, e),
      };
    });

    const ev = cells.reduce((a, c) => a + c.p * c.value, 0);
    const worst = Math.min(...cells.map((c) => c.value));
    return {
      move: m,
      charges: state.me.moves[m].charges,
      ev,
      worst,
      score: (1 - lambda) * ev + lambda * worst,
      cells,
    };
  });

  // Ties broken first by ATK-weighted charge reserve (CODEXIMPROVE #4 stage
  // 1: two otherwise-equal decisions should prefer the one that leaves a
  // better move charged for the room ahead), then by the order in MOVES, so
  // the choice stays reproducible. `chargeReserve` never fires on a strict
  // comparison — it only resolves cases already tied within
  // SCORE_TIE_EPSILON on the primary score, so this can't override a real
  // decision, only break a real tie.
  const best = table.reduce((a, b) => {
    if (b.score > a.score + SCORE_TIE_EPSILON) return b;
    if (a.score > b.score + SCORE_TIE_EPSILON) return a;
    const reserveB = chargeReserve(state, b.move);
    const reserveA = chargeReserve(state, a.move);
    return reserveB > reserveA + SCORE_TIE_EPSILON ? b : a;
  });
  return { move: best.move, table, prediction, lambda };
}

/** Human-readable EV table — SPEC §4 asks that one full battle be eyeballed. */
export function formatDecision(state: BattleState, d: Decision): string {
  const lines: string[] = [];
  lines.push(
    `room ${state.room}  me HP ${state.me.hp}/${state.me.hpMax} ARM ${state.me.armor}` +
      `  |  ${state.foe.id} HP ${state.foe.hp}/${state.foe.hpMax} ARM ${state.foe.armor}`,
  );
  lines.push(
    `  model: ${d.prediction.source} n=${d.prediction.observations}` +
      ` confidence=${d.prediction.confidence} lambda=${d.lambda.toFixed(2)}` +
      (d.prediction.pruned.length ? `  pruned ${d.prediction.pruned.join(",")}` : ""),
  );
  for (const r of d.table) {
    const mark = r.move === d.move ? "▶" : " ";
    const cells = r.cells
      .map(
        (c) =>
          `${c.foeMove.slice(0, 2)} p${c.p.toFixed(2)} dmg${String(c.netDamage).padStart(2)}` +
          `${c.stalls ? "!" : " "} u${c.value.toFixed(1)}`,
      )
      .join("  ");
    lines.push(
      `  ${mark} ${r.move.padEnd(7)} x${String(r.charges).padStart(2)}` +
        `  score ${r.score.toFixed(2).padStart(8)}  ev ${r.ev.toFixed(2).padStart(8)}` +
        `  worst ${r.worst.toFixed(2).padStart(8)}   ${cells}`,
    );
  }
  return lines.join("\n");
}
