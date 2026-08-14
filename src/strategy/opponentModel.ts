/**
 * src/strategy/opponentModel.ts — SPEC §4a. Pure: counts in, distribution out.
 *
 * No I/O of any kind, including disk. `toJSON`/`fromJSON` hand a plain object to
 * whoever owns persistence (the orchestrator, Task 10) so that
 * `data/opponent-model.json` can improve across sessions without this module
 * ever knowing a file exists.
 *
 * The two rules that matter here are both scar tissue:
 *
 * 1. **The 30-observation floor is structural, not advisory.** Below it this
 *    returns uniform and `confidence: "low"`, and there is no way to ask it for
 *    the raw read. SPEC's older guidance ("below ~20, mix 50/50 with uniform")
 *    was already in the spec when enemy 63 was called "Shield-biased 57%" off 14
 *    exchanges and play advice was given from it — over 39 exchanges it is
 *    uniform (31/38/31). A blended wrong read is still a wrong read.
 *
 * 2. **Charge pruning happens in exactly one place** — here, gated on
 *    `chargesAreHardLimit` (DECISIONS 2026-08-15, default true). Never two code
 *    paths; the flag is one observation of an enemy playing at <= 0 away from
 *    flipping.
 */

import { legalMoves } from "../sim/combat.js";
import { MOVES, type Combatant, type MoveKey } from "../sim/types.js";

/** Laplace smoothing constant, SPEC §4a. */
export const ALPHA = 1.0;

/**
 * Observations required before a key may emit a read at all. Below this the
 * model returns uniform — see the header. SPEC §4a, DECISIONS 2026-08-15.
 */
export const SAMPLE_FLOOR = 30;

/**
 * Above the floor, the empirical read is blended toward uniform by
 * `n / (n + BLEND_K)`. At `n = SAMPLE_FLOOR` that is exactly half empirical,
 * so the model does not jump discontinuously from "uniform" to "trust it".
 */
export const BLEND_K = 30;

/**
 * Observations of an enemy before its first-order transitions may be used for
 * prediction, and the transition strength that counts as scripted. SPEC §4a:
 * "after ~200 observations, test whether its move is predictable from the
 * previous turn ... if any transition exceeds ~80%, log it loudly."
 */
export const MARKOV_FLOOR = 200;
export const DETERMINISM_THRESHOLD = 0.8;

export type Distribution = Record<MoveKey, number>;

export interface Prediction {
  /** Sums to 1 over `legal`; exactly 0 on every pruned move. */
  p: Distribution;
  /** "low" means the caller must not treat this as a read. */
  confidence: "low" | "high";
  /** Observations behind the key this came from. */
  observations: number;
  /** Which evidence produced it — for the EV log, and for debugging a bad call. */
  source: "uniform-below-floor" | "marginal" | "first-order";
  /** Moves pruned for want of charges. Empty when `chargesAreHardLimit` is off. */
  pruned: MoveKey[];
}

const zeroes = (): Distribution => ({ rock: 0, paper: 0, scissor: 0 });

const uniformOver = (legal: readonly MoveKey[]): Distribution => {
  const p = zeroes();
  for (const m of legal) p[m] = 1 / legal.length;
  return p;
};

interface Counts {
  /** Marginal move counts for a key. */
  total: Distribution;
  /** `prev -> next` counts. Stored from the first observation, per SPEC §4a. */
  transitions: Record<MoveKey, Distribution>;
}

const emptyCounts = (): Counts => ({
  total: zeroes(),
  transitions: { rock: zeroes(), paper: zeroes(), scissor: zeroes() },
});

const sum = (d: Distribution): number => MOVES.reduce((a, m) => a + d[m], 0);

/** SPEC §4a keys counts by `(enemyId, roomIndex)`. */
export const modelKey = (enemyId: string, room: number): string => `${enemyId}|room${room}`;

export interface DeterministicTransition {
  key: string;
  from: MoveKey;
  to: MoveKey;
  p: number;
  observations: number;
}

export class OpponentModel {
  private readonly keys = new Map<string, Counts>();

  /**
   * Record one enemy move. `prev` is the enemy's own previous move in this
   * battle, or null on its first move of a battle — never carried across a
   * battle boundary, since a fresh entity's first move has no predecessor.
   */
  observe(key: string, move: MoveKey, prev: MoveKey | null = null): void {
    const c = this.keys.get(key) ?? emptyCounts();
    c.total[move]++;
    if (prev) c.transitions[prev][move]++;
    this.keys.set(key, c);
  }

  observations(key: string): number {
    const c = this.keys.get(key);
    return c ? sum(c.total) : 0;
  }

  /**
   * `P(enemy move)` for one turn.
   *
   * Order of operations matters and is not interchangeable: smooth, then blend
   * toward uniform, then prune illegal moves, then renormalise. Pruning last
   * means a pruned move's smoothed mass is redistributed in proportion to what
   * the model believes about the moves that remain, rather than the model being
   * fitted to a legality that changes every turn.
   */
  predict(
    foe: Combatant,
    room: number,
    opts: { prev?: MoveKey | null; chargesAreHardLimit: boolean },
  ): Prediction {
    const legal = legalMoves(foe, opts.chargesAreHardLimit);
    if (legal.length === 0) {
      // The sim marks this CHARGES_ALL_LOCKED and stops; nothing in the corpus
      // shows what the server does, so refuse to invent a distribution for it.
      throw new Error("predict() called with no legal enemy move — caller must handle this");
    }
    const pruned = MOVES.filter((m) => !legal.includes(m));

    const key = modelKey(foe.id, room);
    const counts = this.keys.get(key);
    const n = counts ? sum(counts.total) : 0;

    if (!counts || n < SAMPLE_FLOOR) {
      return {
        p: uniformOver(legal),
        confidence: "low",
        observations: n,
        source: "uniform-below-floor",
        pruned,
      };
    }

    // A first-order row is used only when the enemy is well observed overall AND
    // the row itself clears the same floor every other key must clear. Both
    // conditions, because a scripted enemy is a large claim: it converts the
    // whole battle into near-certain wins, so a thin row must not be able to
    // make it.
    const prevRow = opts.prev ? counts.transitions[opts.prev] : null;
    const rowN = prevRow ? sum(prevRow) : 0;
    const useRow = prevRow !== null && n >= MARKOV_FLOOR && rowN >= SAMPLE_FLOOR;

    const from = useRow ? prevRow! : counts.total;
    const fromN = useRow ? rowN : n;

    // Laplace, then blend toward uniform in proportion to sample size.
    const w = fromN / (fromN + BLEND_K);
    const denom = fromN + 3 * ALPHA;
    const p = zeroes();
    for (const m of MOVES) {
      const smoothed = (from[m] + ALPHA) / denom;
      p[m] = w * smoothed + (1 - w) * (1 / 3);
    }

    for (const m of pruned) p[m] = 0;
    const mass = sum(p);
    for (const m of MOVES) p[m] = mass === 0 ? (legal.includes(m) ? 1 / legal.length : 0) : p[m] / mass;

    return {
      p,
      confidence: "high",
      observations: fromN,
      source: useRow ? "first-order" : "marginal",
      pruned,
    };
  }

  /**
   * Every first-order transition strong enough to call scripted. SPEC §4a wants
   * this logged loudly: an enemy with an >80% transition can be beaten nearly
   * every turn, which is a far larger edge than any weight tuning.
   *
   * Returns empty until a key clears `MARKOV_FLOOR`, so it cannot report the
   * enemy-63 error in a new form.
   */
  determinism(
    threshold = DETERMINISM_THRESHOLD,
    floor = MARKOV_FLOOR,
  ): DeterministicTransition[] {
    const out: DeterministicTransition[] = [];
    for (const [key, c] of this.keys) {
      if (sum(c.total) < floor) continue;
      for (const from of MOVES) {
        const row = c.transitions[from];
        const rowN = sum(row);
        if (rowN < SAMPLE_FLOOR) continue;
        for (const to of MOVES) {
          const p = row[to] / rowN;
          if (p >= threshold) out.push({ key, from, to, p, observations: rowN });
        }
      }
    }
    return out.sort((a, b) => b.p - a.p);
  }

  /** Plain data, for whoever owns `data/opponent-model.json`. */
  toJSON(): Record<string, Counts> {
    return Object.fromEntries(this.keys);
  }

  static fromJSON(raw: Record<string, Counts>): OpponentModel {
    const m = new OpponentModel();
    for (const [k, v] of Object.entries(raw)) m.keys.set(k, v);
    return m;
  }
}
