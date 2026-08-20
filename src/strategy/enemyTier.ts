/**
 * src/strategy/enemyTier.ts — the enemy-tier hard rule (CLAUDE.md rule 8).
 * Pure; no network calls. This is the ONE call site that may choose a tier.
 *
 * ── THE RULE, AS OF 2026-08-20 ─────────────────────────────────────────────
 *
 * **Take the HIGHEST tier offered — except the final room, and never a
 * Perpetual.** User directive, replacing the lowest-tier rule that stood from
 * session 06 to session 56. Three clauses:
 *
 *   1. **Highest tier among NON-PERPETUAL options.** Reward offers inherit the
 *      tier of the fight just won — measured 87/87 = 100% (session 56 §4) —
 *      so a higher-tier win unlocks better upgrade cards and a larger Hard
 *      Core payout. Filter perpetuals FIRST, then take the max; "max, then
 *      check perpetual" would raise a fallback question on every offer whose
 *      top tier is perpetual, which is 35% of them.
 *   2. **Never a `Perpetual` card as the hardest option** (user directive,
 *      session 56). Near-inert under the old rule (4 offers of 134); fires on
 *      **47 of 134 (35%)** under this one. Load-bearing, not a footnote.
 *   3. **At the final room, take no modifiers** — the lowest tier offered,
 *      preferring a card with no buff and no rolled stats. There are no
 *      upgrades after the final boss, so the entire reason for the risk is
 *      gone. Keyed on the SERVER's per-dungeon `maxRoom` (Forbidden Woods 16,
 *      Void Dungeon 17), never a literal.
 *
 * ── WHY THE OLD RULE WAS NOT WRONG ─────────────────────────────────────────
 *
 * The lowest-tier rule rested on `lootTable` being byte-identical across every
 * offered tier — 440/440, still true and re-verified. But that measured the
 * loot table IN THE ENEMY OFFER, while reward quality and orb payout are
 * downstream of WINNING. The two claims are orthogonal; the old evidence was
 * never evidence against this rule. It was reversed by the account owner on
 * new evidence, and the original warning now applies in the other direction:
 * **do not revert to lowest-tier without a new user directive.**
 *
 * ── THE ACCEPTED COST ──────────────────────────────────────────────────────
 *
 * Higher tiers carry `rolledEnemyStats` on 617 of 622 non-Safe paths, and
 * SPEC §4e establishes those are 1–5% proc chances needing hundreds of
 * observations. So the simulator now scores almost nothing. That was accepted
 * knowingly (CLAUDE.md rule 8) — do not "fix" the falling coverage metrics.
 *
 * ── FAIL-CLOSED vs FAIL-OPEN, AND WHY THEY DIFFER BY CLAUSE ────────────────
 *
 * `pickHighestTier` fails CLOSED on an all-Perpetual offer (CLAUDE.md rule 8
 * and rule 5). `pickFinalRoomTier` fails OPEN on the same shape. This is a
 * deliberate reversal of session 56's fail-open decision for the highest-tier
 * path, and the asymmetry is the reason:
 *
 *   - Choosing the HARDEST card is an act of deliberately taking on risk. If
 *     the only way to do that is to accept a run-long perpetual buff the user
 *     has forbidden, there is no safe reading of the directive left, and the
 *     branch has never once executed (0 of 134 corpus offers). A never-taken
 *     branch that quietly does the wrong thing on a 60-energy run is the worst
 *     available outcome; it must halt loudly.
 *   - At the FINAL room the rule is already reaching for the least dangerous
 *     card. There is nothing safer to fall back to, and stranding the boss
 *     room over a preference among the only options offered costs the whole
 *     run. It takes the lowest tier and moves on.
 */

import { SAFE_TIER } from "../sim/enemies.js";
import { isPerpetualBuff } from "../sim/enemyBuffs.js";

export interface TierOption {
  tier: number;
  /**
   * The path's own buff, when the caller has it. Read to apply the Perpetual
   * clause and by `isUnmodified`. Optional so a caller that has not captured
   * it still compiles — but note that under rule 8 an offer supplied WITHOUT
   * buffs cannot have the Perpetual clause applied to it, so the live loop
   * must always pass it (`scripts/liveRun.ts` does).
   */
  enemyBuff?: unknown;
  /** `{evasion, block, lck, tenacity}`. Read only by `isUnmodified`. */
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

/** The lowest `tier` in the offer. Throws on an empty offer — no recorded offer is empty. */
export function lowestTierOption<T extends TierOption>(options: readonly T[]): T {
  if (options.length === 0) throw new Error("lowestTierOption() called with an empty offer");
  return options.reduce((best, o) => (o.tier < best.tier ? o : best));
}

/** The highest `tier` in the offer, ignoring the Perpetual clause. Throws on an empty offer. */
export function highestTierOption<T extends TierOption>(options: readonly T[]): T {
  if (options.length === 0) throw new Error("highestTierOption() called with an empty offer");
  return options.reduce((best, o) => (o.tier > best.tier ? o : best));
}

/**
 * Every option in the offer carries a `perpetual_` buff, so rule 8's
 * "highest tier among non-Perpetual options" has nothing to select. Halts the
 * run (CLAUDE.md rule 5) rather than taking a card the user forbade.
 *
 * **This branch has never executed.** 0 of 134 corpus offers are entirely
 * perpetual. It exists because a branch that has never run and quietly does
 * the wrong thing is worse than one that stops.
 */
export class PerpetualOnlyOfferError extends Error {
  constructor(public readonly tiers: readonly number[]) {
    super(
      `Hard rule violated: every option in this enemy offer carries a "perpetual_" buff ` +
        `(tiers ${JSON.stringify(tiers)}), so CLAUDE.md rule 8's "highest tier among non-Perpetual ` +
        `options" has nothing to choose. 0 of 134 corpus offers had this shape. Halting rather than ` +
        `taking a Perpetual card the user directive forbids.`,
    );
    this.name = "PerpetualOnlyOfferError";
  }
}

/**
 * **The live rule for every room but the last.** Filters Perpetual options
 * out FIRST, then takes the maximum tier among what remains. Ties at that tier
 * resolve on offer order, which keeps the decision reproducible.
 *
 * Throws `PerpetualOnlyOfferError` when nothing survives the filter, and a
 * plain `Error` on an empty offer.
 */
export function pickHighestTier<T extends TierOption>(options: readonly T[]): T {
  if (options.length === 0) throw new Error("pickHighestTier() called with an empty offer");
  const eligible = options.filter((o) => !isPerpetualBuff(o.enemyBuff));
  if (eligible.length === 0) throw new PerpetualOnlyOfferError(options.map((o) => o.tier));
  const top = highestTierOption(eligible).tier;
  return eligible.find((o) => o.tier === top)!;
}

/**
 * The lowest tier on offer, preferring a non-Perpetual card among equals.
 * Used only as `pickFinalRoomTier`'s fallback — see the header on why that
 * path fails OPEN where `pickHighestTier` fails closed.
 */
export function pickLowestNonPerpetualTier<T extends TierOption>(options: readonly T[]): T {
  const chosen = lowestTierOption(options);
  if (!isPerpetualBuff(chosen.enemyBuff)) return chosen;
  const alternative = options.find((o) => o.tier === chosen.tier && !isPerpetualBuff(o.enemyBuff));
  return alternative ?? chosen;
}

/**
 * **[USER DIRECTIVE, 2026-08-20]** "At room 16 (floor 4, room 4) always take
 * no-modifiers, because there are no upgrades after the final boss."
 *
 * ── THE INDEX SCHEME, CHECKED BEFORE ENCODING ──────────────────────────────
 *
 *   - There is **no `floor` field anywhere in the corpus**, so "floor 4 room
 *     4" cannot be cross-checked — and does not need to be.
 *   - The server publishes the room count directly: `dungeon-today`'s
 *     container carries **`maxRoom`**, and Forbidden Woods (ID_CID 5)
 *     publishes **16**, the user's number exactly.
 *   - It is PER DUNGEON (Void Dungeon publishes 17), so the caller passes it.
 *   - **[session 57] Verified against a live response**, not just the corpus:
 *     `scripts/checkMaxRoom.ts` reads it from `dungeon-today` and diffs it
 *     against `config/discovered.json`. Live on 2026-08-19 23:2x PT: Forbidden
 *     Woods 16, Void Dungeon 17, Dungetron 16, Underhaul 16 — matching. Re-run
 *     that script before trusting this path if anything looks off; the corpus
 *     has never reached room 16, so it still has zero live exercise.
 *
 * ── FAILURE DIRECTION, DELIBERATELY ASYMMETRIC ─────────────────────────────
 *
 * Taking no-modifiers at the wrong room costs a little reward. Taking the
 * hardest card at the ACTUAL final room costs the boss fight. So the test is
 * `room >= maxRoom`, not `room === maxRoom` (see `pickTierForRoom`), and an
 * UNREADABLE room or `maxRoom` resolves to this function rather than to
 * `pickHighestTier`.
 *
 * This never raises a tier to find a clean card: it starts from the lowest
 * tier on offer and only chooses among cards already at it.
 */
export function pickFinalRoomTier<T extends TierOption>(options: readonly T[]): T {
  if (options.length === 0) throw new Error("pickFinalRoomTier() called with an empty offer");
  const lowest = lowestTierOption(options).tier;
  const clean = options.filter((o) => o.tier === lowest && isUnmodified(o));
  if (clean.length > 0) return clean[0]!;
  // No unmodified card at the lowest tier. Stated as a fallthrough rather than
  // a search so it can never promote a tier to find a clean one.
  return pickLowestNonPerpetualTier(options);
}

/** Which clause of rule 8 governs this room. Exported so the caller can LOG the reason. */
export type TierRule = "highest" | "final-room" | "final-room-unreadable";

/**
 * Resolves which clause applies. `room` or `maxRoom` being absent, non-finite,
 * or non-positive resolves to the final-room clause — the conservative
 * direction, per the asymmetry above.
 *
 * **`final-room-unreadable` is reported separately on purpose.** Session 56
 * found `ROOM_NUM_CID` lives on `data.entity`, NOT `data.entity.data`, where
 * it reads `undefined` silently; `scripts/liveRun.ts` defaults it to 0. If
 * that field ever moves again, every room would take the final-room clause and
 * the flip would be silently inert — indistinguishable from "the rule is on
 * and the offers were all like that". The caller logs this label loudly.
 */
export function tierRuleFor(room: number | null | undefined, maxRoom: number | null | undefined): TierRule {
  const roomOk = typeof room === "number" && Number.isFinite(room) && room >= 1;
  const maxOk = typeof maxRoom === "number" && Number.isFinite(maxRoom) && maxRoom >= 1;
  if (!roomOk || !maxOk) return "final-room-unreadable";
  return room >= maxRoom ? "final-room" : "highest";
}

/**
 * The tier choice for a room. `maxRoom` comes from the server-published
 * `config/discovered.json` `forbiddenWoods.maxRoom`, never a literal.
 */
export function pickTierForRoom<T extends TierOption>(
  options: readonly T[],
  room: number | null | undefined,
  maxRoom: number | null | undefined,
): T {
  return tierRuleFor(room, maxRoom) === "highest" ? pickHighestTier(options) : pickFinalRoomTier(options);
}

export class UnsafeTierError extends Error {
  constructor(public readonly tier: number) {
    super(
      `Picked enemy tier ${tier}, expected Safe tier ${SAFE_TIER}. Halting rather than ` +
        `proceeding on a bad pick.`,
    );
    this.name = "UnsafeTierError";
  }
}

/** Fails closed (CLAUDE.md rule 5) rather than proceeding on an unexpected tier. */
export function assertSafeTier(tier: number): void {
  if (tier !== SAFE_TIER) throw new UnsafeTierError(tier);
}

/**
 * Chooses AND verifies the choice is exactly Safe (tier 0) — the STRICT
 * variant from session 07, kept for a caller that specifically wants "never
 * fight anything but Safe, halt otherwise". **No live path uses it**, and
 * under rule 8 as of 2026-08-20 none should: it is the exact opposite of the
 * standing directive. Retained because it and `UnsafeTierError` are cited
 * across SPEC.md, DECISIONS.md and the session logs, and deleting them would
 * make that history unreadable.
 */
export function pickSafeTier<T extends TierOption>(options: readonly T[]): T {
  const chosen = lowestTierOption(options);
  assertSafeTier(chosen.tier);
  return chosen;
}
