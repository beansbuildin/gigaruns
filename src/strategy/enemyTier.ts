/**
 * src/strategy/enemyTier.ts — the lowest-tier hard rule (CLAUDE.md §8,
 * DECISIONS 2026-08-16, generalized session 09). Pure; no network calls.
 *
 * `enemyPathOptions[]`'s `lootTable` is identical across every offered
 * option in every sample captured so far (SPEC §3e) — same table, same item,
 * same weight, same amount, confirmed again live session 09 on an offer with
 * NO Safe (tier 0) option at all. Higher tiers add `rolledEnemyStats` and
 * `enemyBuff` with zero loot upside, and they are the sole source of the
 * mechanics that make a battle unscorable. There is no risk/reward tradeoff
 * to weigh among whatever is actually offered: always take the lowest tier
 * present.
 *
 * [session 09, live] The rule was originally written as "always pick Safe"
 * because every sample through session 08 offered exactly one option per
 * tier {0, 1, 2}. Room 2's first live encounter this session broke that
 * assumption: three options, tiers {2, 1, 1} (two DIFFERENT tier-1 variants,
 * different `enemyBuff`s), no tier 0 at all. `pickSafeTier` correctly halted
 * on it (fail-closed, CLAUDE.md §5) rather than picking a non-Safe tier — a
 * genuine unhandled case, not a bug. User-confirmed: this is expected game
 * behavior, not a capture gap, and the fix is to generalize the rule rather
 * than treat the absence of tier 0 as an error. `pickLowestTier` is the
 * result: same zero-tradeoff reasoning, just no longer assuming the minimum
 * is always 0. This DOES mean the live loop will now sometimes fight a
 * contaminated (ROLLED_STATS / ENEMY_BUFF) battle when Safe isn't on offer —
 * accepted, since there is no lower-risk option available to take instead.
 *
 * `pickSafeTier`/`assertSafeTier`/`UnsafeTierError` are kept for any caller
 * that wants the stricter "must be tier 0" assertion; the live loop's
 * default path no longer uses them.
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

/**
 * Chooses AND verifies the choice is exactly Safe (tier 0) — the STRICT
 * variant. Throws `UnsafeTierError` whenever tier 0 isn't offered, even
 * though that's now a known, expected shape of the offer rather than a
 * surprise (session 09). Kept for a caller that specifically wants "never
 * fight anything but Safe, halt otherwise"; the live loop uses
 * `pickLowestTier` instead.
 */
export function pickSafeTier<T extends TierOption>(options: readonly T[]): T {
  const chosen = chooseTier(options);
  assertSafeTier(chosen.tier);
  return chosen;
}

/**
 * Chooses the lowest tier actually on offer, Safe or not — the generalized
 * rule (session 09) and the one call site Task 6's orchestrator should use.
 * Never asserts tier === SAFE_TIER; a caller that needs to know whether Safe
 * was available can check `chosen.tier === SAFE_TIER` itself (liveRun.ts
 * logs this for visibility). Throws only on an empty offer, same as
 * `chooseTier` — that would be a genuinely new kind of surprise, not this
 * one.
 */
export function pickLowestTier<T extends TierOption>(options: readonly T[]): T {
  return chooseTier(options);
}
