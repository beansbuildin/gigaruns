/**
 * src/strategy/config.ts — every tunable the dungeon engine reads, in one place.
 *
 * Nothing here is fitted. These are the SPEC §4b starting values with the two
 * corrections session 03 and session 05 forced, and Task 11 is where they get
 * swept against a real opponent model. Treat any number below as a hypothesis
 * with a comment attached, not as a result.
 */

/**
 * HP and armor are scored in POINTS, both normalised by `hpMax` — deliberately
 * not each by its own maximum.
 *
 * SPEC §4b asks that "losing 8 HP through an empty armor pool should score
 * strictly worse than losing 8 armor". The spec's own form cannot deliver that:
 * with `w1·(hp/hpMax) + w3·(armor/armorMax)` and the real loadout (hpMax 32,
 * armorMax 15), 8 HP is 0.25·w1 = 0.250 and 8 armor is 0.53·w3 = 0.427, so at
 * the suggested weights losing ARMOR scores worse — backwards, and by 70%.
 * Sharing one denominator makes `w1 > w3` mean exactly what it reads as: a point
 * of HP is worth more than a point of armor.
 */
export interface Weights {
  /** Our HP, per point. The unit everything else is priced against. */
  hp: number;
  /** Enemy HP, per point. Below `hp`: SPEC §4b weights survival over damage. */
  foeHp: number;
  /**
   * Our armor, per point. Renewable in combat (a won or tied move regenerates
   * its own DEF) where HP is not renewable at all, so it is worth real but
   * strictly less than a point of HP.
   *
   * SPEC §4b's `w3 = 0.3` is too low and says so itself. It is not raised to the
   * suggested 0.8 either: at 0.8 a point of armor is nearly a point of HP, and
   * armor caps and wastes excess regen where HP never does.
   */
  armor: number;
  /**
   * Enemy armor, per point. Present because without it a one-ply evaluation
   * cannot see progress: chipping a 12-armor pool moves no HP, so an engine
   * blind to enemy armor scores a landed hit and a whiffed one identically —
   * and, worse, scores the §4b stall (Shield mirrored into DEF 8, zero net
   * damage forever) as neutral rather than as the trap it is.
   */
  foeArmor: number;
}

export interface StrategyConfig {
  weights: Weights;
  /** Utility of a state where the enemy is dead and we are not. */
  winValue: number;
  /**
   * Utility of a state where we are dead, at room 1. Scaled deeper by
   * `depthBonus` — dying in room 4 forfeits far more invested energy than dying
   * in room 1 (SPEC §4b "depth bonus"). Scaling the DEATH side rather than both
   * is what makes the bonus bite: multiplying both terminals by one constant
   * would leave every argmax unchanged.
   */
  deathValue: number;
  /** Fractional increase in the death penalty per room beyond the first. */
  depthBonus: number;
  /**
   * Search depth in exchanges. 1 = score the state after our move resolves.
   * Higher plies see lethality and stalls coming; cost is 9^depth leaves, so 3
   * is 729 and already free at our tempo.
   */
  depth: number;
  /**
   * Ambiguity aversion, in [0, 1]. See `decide.ts`: this is the mass an
   * adversary is allowed to move inside the ε-contamination set around the
   * opponent model, which makes "maximin over the uncertainty set" (SPEC §4a's
   * fallback) exactly `(1-λ)·EV + λ·worstCase` rather than a separate code path.
   */
  ambiguity: number;
  /** `ambiguity` used when the opponent model reports `confidence: "low"`. */
  ambiguityWhenUnsure: number;
  /** SPEC §4a / DECISIONS 2026-08-15. Threaded, never baked. */
  chargesAreHardLimit: boolean;
}

export const DEFAULT_WEIGHTS: Weights = {
  hp: 1.0,
  foeHp: 0.8,
  armor: 0.55,
  foeArmor: 0.45,
};

export const DEFAULT_CONFIG: StrategyConfig = {
  weights: DEFAULT_WEIGHTS,
  winValue: 1000,
  deathValue: -1000,
  depthBonus: 0.35,
  depth: 2,
  // Not zero even at full confidence: the opponent model is a frequency count of
  // a server we do not control, and SPEC §4a warns that a fixed response to a
  // read is maximally exploitable if it ever adapts to us.
  ambiguity: 0.15,
  ambiguityWhenUnsure: 0.5,
  chargesAreHardLimit: true,
};
