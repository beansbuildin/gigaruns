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
import { isPerpetualBuff } from "../sim/enemyBuffs.js";

export interface TierOption {
  tier: number;
  /**
   * [session 56] The path's own buff, when the caller has it. Read ONLY to
   * break a tie between options that already share the chosen tier — see
   * `pickLowestTier`. Optional so every existing caller and test compiles
   * unchanged and behaves identically.
   */
  enemyBuff?: unknown;
  /** [session 56] `{evasion, block, lck, tenacity}`. Read only by `isUnmodified`. */
  rolledEnemyStats?: Record<string, number>;
}

/**
 * "No modifiers": no `enemyBuff` and every rolled stat zero. This is what the
 * user's final-room exception asks for, and it is a STRICTER condition than
 * "lowest tier" — the corpus has tier-1 paths with a buff and zero rolled
 * stats, and tier 0 is the only tier that is reliably both.
 */
export function isUnmodified(o: TierOption): boolean {
  if ((o.enemyBuff ?? null) !== null) return false;
  return Object.values(o.rolledEnemyStats ?? {}).every((v) => v === 0);
}

/**
 * **[USER DIRECTIVE, 2026-08-20]** "At room 16 (floor 4, room 4) always take
 * no-modifiers, because there are no upgrades after the final boss."
 *
 * ── THE INDEX SCHEME, CHECKED BEFORE ENCODING (brief §5 asked for this) ────
 *
 * The brief warned that "room 16 = floor 4 room 4" implies a flat index over
 * four floors of four rooms and that the mapping was unverified. Checked:
 *
 *   - There is **no `floor` field anywhere in the corpus.** Nothing to cross-
 *     check a two-part index against, and nothing that needs one.
 *   - The server DOES publish the room count directly: `dungeon-today`'s
 *     container carries **`maxRoom`**, and for Forbidden Woods (ID_CID 5) it
 *     is **16** — the user's number exactly, from the server rather than
 *     inferred. `config/discovered.json` already records it.
 *   - It is PER DUNGEON, so 16 must never be hard-coded: Void Dungeon's
 *     `maxRoom` is 17. The caller passes the configured value.
 *   - Battle state carries a flat `ROOM_NUM_CID` (1..10 observed), consistent
 *     with a flat 1..`maxRoom` index. 4 x 4 = 16 is consistent with it, but
 *     nothing depends on the floor decomposition being true.
 *
 * ── FAILURE DIRECTION, DELIBERATELY ASYMMETRIC ─────────────────────────────
 *
 * Taking no-modifiers at the wrong room costs a little reward. Taking the
 * hardest card at the ACTUAL final room costs the boss fight. So the test is
 * `room >= maxRoom`, not `room === maxRoom`: if the index ever runs past the
 * configured count, this stays on rather than silently switching off at the
 * one room it exists to protect.
 *
 * ── THIS IS INERT TODAY, AND THAT IS CORRECT ───────────────────────────────
 *
 * Under CLAUDE.md rule 8 the bot already takes the lowest tier everywhere, so
 * at the final room this can only differ from `pickLowestTier` by preferring an
 * unmodified card among options that already share the lowest tier. It is
 * encoded now as cheap insurance and as the hook a rule-8 reversal needs.
 * **Nothing is gated on it** (CLAUDE.md rule 6): the corpus has never seen
 * room 16 — the deepest run ever is room 10 (session 53) — so it cannot be
 * tested live and will not fire for a long time.
 */
export function pickFinalRoomTier<T extends TierOption>(options: readonly T[]): T {
  if (options.length === 0) throw new Error("pickFinalRoomTier() called with an empty offer");
  const lowest = chooseTier(options).tier;
  const clean = options.filter((o) => o.tier === lowest && isUnmodified(o));
  if (clean.length > 0) return clean[0]!;
  // No unmodified card at the lowest tier. Widen to an unmodified card at ANY
  // tier ONLY if it is not higher than the lowest — which it cannot be — so in
  // practice this falls through to the ordinary rule. Stated as a fallthrough
  // rather than a search so it can never promote a tier to find a clean card.
  return pickLowestTier(options);
}

/**
 * The tier choice for a room, applying the final-room exception when the room
 * is the dungeon's last. `maxRoom` comes from `config/discovered.json`'s
 * `forbiddenWoods.maxRoom` (server-published), never a literal.
 */
export function pickTierForRoom<T extends TierOption>(
  options: readonly T[],
  room: number,
  maxRoom: number,
): T {
  return room >= maxRoom ? pickFinalRoomTier(options) : pickLowestTier(options);
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
  const chosen = chooseTier(options);
  return preferNonPerpetual(options, chosen);
}

/**
 * **[USER DIRECTIVE, 2026-08-20]** "If the red/hardest/highest-risk enemy card
 * contains the condition `Perpetual`, do NOT select that — go with the next
 * best option based on existing criteria."
 *
 * Applied here as a strict TIE-BREAK: among the options that already share the
 * tier `chooseTier` selected, one without a `perpetual_` buff is preferred.
 *
 * **This cannot change which tier is fought, and that is the point.** CLAUDE.md
 * rule 8 is in force and untouched — `chooseTier` still returns the minimum
 * tier on offer, and this only reorders equals. A perpetual buff on a HIGHER
 * tier is already unreachable under rule 8, so today the directive can only
 * bite in the case where every option shares one tier, which `chooseTier`
 * previously resolved on array order alone.
 *
 * Measured on the corpus (134 distinct enemy offers, `scripts/enemyBuffAudit.ts`):
 *
 *   - 47 offers (35%) put a `perpetual_` buff on the highest tier — so after a
 *     rule-8 reversal this directive would fire on about a third of rooms. It
 *     is a substantial carve-out, not an edge case.
 *   - 4 offers have EVERY option at one tier with a perpetual among them —
 *     the only shape that reaches this code under rule 8 — and all 4 have a
 *     non-perpetual alternative at that same tier.
 *   - **0 offers are entirely perpetual**, so a fallback has always existed.
 *
 * If one ever is entirely perpetual, this keeps `chooseTier`'s pick rather
 * than halting. Fail-OPEN is right for a tie-break and only for a tie-break:
 * there is no lower-risk option to take instead, and stranding a 60-energy
 * run mid-combat for a preference among equals would cost far more than it
 * saves — the same reasoning session 09 used to generalize `pickSafeTier` into
 * `pickLowestTier`. The tier rule itself still fails closed.
 */
function preferNonPerpetual<T extends TierOption>(options: readonly T[], chosen: T): T {
  if (!isPerpetualBuff(chosen.enemyBuff)) return chosen;
  const alternative = options.find((o) => o.tier === chosen.tier && !isPerpetualBuff(o.enemyBuff));
  return alternative ?? chosen;
}
