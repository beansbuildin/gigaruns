/**
 * src/strategy/enemyTier.ts — the Safe-tier hard rule (CLAUDE.md, DECISIONS
 * 2026-08-16). Pure; no network calls.
 *
 * `enemyPathOptions[]`'s `lootTable` is identical across all three tiers in
 * every sample captured so far (SPEC §3e) — same table, same item, same
 * weight, same amount. Higher tiers add `rolledEnemyStats` and `enemyBuff`
 * with zero loot upside, and they are the sole source of the mechanics that
 * make a battle unscorable. There is no risk/reward tradeoff to weigh: always
 * take the lowest tier offered.
 *
 * This is deliberately NOT a preference scored alongside other options the
 * way `src/strategy/loot.ts` ranks boons — it is a hard rule with a guard,
 * because it is exactly the kind of thing that gets "optimised away" later by
 * someone reasoning about risk/reward in the abstract (CLAUDE.md §3, session
 * 06 brief §3).
 */

import { SAFE_TIER } from "../sim/enemies.js";

export interface TierOption {
  tier: number;
}

/** Picks the lowest `tier` in the offer. Throws on an empty offer — no recorded offer is empty. */
export function chooseTier<T extends TierOption>(options: readonly T[]): T {
  if (options.length === 0) throw new Error("chooseTier() called with an empty offer");
  return options.reduce((lowest, o) => (o.tier < lowest.tier ? o : lowest));
}

export class UnsafeTierError extends Error {
  constructor(public readonly tier: number) {
    super(
      `Hard rule violated: picked enemy tier ${tier}, expected Safe tier ${SAFE_TIER} ` +
        `(CLAUDE.md, DECISIONS 2026-08-16). Halting rather than proceeding on a bad pick.`,
    );
    this.name = "UnsafeTierError";
  }
}

/** Fails closed (CLAUDE.md §5) rather than proceeding on an unexpected tier. */
export function assertSafeTier(tier: number): void {
  if (tier !== SAFE_TIER) throw new UnsafeTierError(tier);
}

/** Chooses AND verifies the choice — the one call site Task 6's orchestrator should use. */
export function pickSafeTier<T extends TierOption>(options: readonly T[]): T {
  const chosen = chooseTier(options);
  assertSafeTier(chosen.tier);
  return chosen;
}
