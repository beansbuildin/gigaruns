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

// ───────────────────────────────────────────────────────────────────────────
// [session 61] THE IN-LOOP TIER GATE — rule 8's flip, checked while the run
// can still be stopped.
//
// Rule 8's failure mode is SILENT. A run in which the highest-tier flip never
// fired comes back looking exactly like the fifty lowest-tier runs before it:
// same shape, same fields, same depth distribution. Session 60 audited its
// tier choices AFTER the run finished, which is a different thing wearing the
// same name — a check that runs after the run is over cannot stop anything,
// and by then 3 run-units are spent on a data point that looks like evidence
// and isn't.
//
// So the check re-derives the answer from the RAW OFFER, independently of
// whichever code path produced the choice, and halts the run when they
// disagree (CLAUDE.md rule 5). `auditTierChoice` deliberately does NOT call
// `pickTierForRoom` — a checker that calls the thing it is checking can only
// ever agree with it.
//
// **The cost is real and accepted.** Halting mid-run can waste 3 of the day's
// 12 run-units. That is the intended trade, stated in the session-61 brief: a
// run that silently took the lowest tier is worth LESS than no run at all.
//
// **Why `final-room-unreadable` is a violation rather than a warning.** It is
// the shape in which the flip goes inert: session 56 found `ROOM_NUM_CID`
// lives on `data.entity`, not `data.entity.data`, and `scripts/liveRun.ts`
// defaults an unreadable room to 0 — so every room would take the final-room
// clause and quietly pick the LOWEST tier all run long, indistinguishable
// from "the rule is on and the offers were all like that". `maxRoom` cannot
// be the unreadable half (liveRun falls back to a literal), so an unreadable
// rule always means the ROOM number moved. Against that, the legitimate
// reading — "we genuinely reached the final room AND lost the room number in
// the same instant" — needs room 16, and the deepest run ever recorded is
// room 10. Halting is the right call on those odds.
//
// Note the asymmetry with `pickFinalRoomTier`, which fails OPEN on the same
// label: the PICKER still degrades gracefully so that its own unit tests and
// any non-live caller keep working. It is the LIVE LOOP that refuses to spend
// a run on an unreadable board.

/** An independent re-derivation of what rule 8 should have produced for one room. */
export interface TierChoiceAudit {
  room: number | null | undefined;
  maxRoom: number | null | undefined;
  rule: TierRule;
  /** The tier actually taken by the caller. */
  chosenTier: number;
  /** Every tier in the offer, in offer order. */
  tiersOffered: number[];
  /** Highest tier among NON-Perpetual options — rule 8's clause 1 target. `null` if none survive. */
  eligibleTop: number | null;
  /** Highest tier on offer, ignoring the Perpetual clause. */
  topTierOffered: number;
  /** True when the Perpetual clause cost a tier: the top tier was entirely perpetual. */
  perpetualFilteredTop: boolean;
  /** Empty when the audit passes; one line per violation otherwise. */
  violations: string[];
}

/**
 * Re-derives rule 8's answer from the raw offer and compares it with what was
 * taken. Pure, no throw — the caller decides whether to halt (`assertTierChoiceOk`)
 * or merely log (`formatTierCheckLine`), which keeps the audit usable from a
 * report script that must not blow up.
 */
export function auditTierChoice<T extends TierOption>(
  options: readonly T[],
  chosenTier: number,
  room: number | null | undefined,
  maxRoom: number | null | undefined,
): TierChoiceAudit {
  const rule = tierRuleFor(room, maxRoom);
  const tiersOffered = options.map((o) => o.tier);
  const eligible = options.filter((o) => !isPerpetualBuff(o.enemyBuff));
  const eligibleTop = eligible.length > 0 ? Math.max(...eligible.map((o) => o.tier)) : null;
  const topTierOffered = options.length > 0 ? Math.max(...tiersOffered) : Number.NaN;
  const violations: string[] = [];

  if (options.length === 0) {
    violations.push("empty enemy path offer — nothing to choose from");
  }
  if (rule === "final-room-unreadable") {
    violations.push(
      `room (${room}) or maxRoom (${maxRoom}) is UNREADABLE, so rule 8's highest-tier clause is ` +
        `INERT and this room silently took the conservative lowest-tier path. Room 16 has never been ` +
        `reached (deepest ever: room 10), so this is ROOM_NUM_CID having moved, not a real final room. ` +
        `See enemyTier.ts's session-61 note.`,
    );
  }
  if (rule === "highest" && eligibleTop !== null && chosenTier !== eligibleTop) {
    violations.push(
      `rule 8 clause 1 violated: took tier ${chosenTier} but the highest NON-PERPETUAL tier on offer ` +
        `is ${eligibleTop} (offered ${JSON.stringify(tiersOffered)}). The flip did not fire.`,
    );
  }
  if (rule === "final-room" && typeof room === "number" && typeof maxRoom === "number" && room < maxRoom) {
    violations.push(`final-room clause applied at room ${room}, which is below maxRoom ${maxRoom}`);
  }

  return {
    room,
    maxRoom,
    rule,
    chosenTier,
    tiersOffered,
    eligibleTop,
    topTierOffered,
    perpetualFilteredTop: eligibleTop !== null && eligibleTop < topTierOffered,
    violations,
  };
}

/**
 * ONE greppable stdout line per room. Session 60's brief asked the agent to
 * "check the first `tier_choice` before letting it continue" against a channel
 * that carried the room index nowhere — the readable line that did print
 * ("taking the HIGHEST offered tier 2 of 2") named neither the room nor the
 * tiers on offer, so it could not answer the question being asked of it.
 * Everything needed to adjudicate the decision is on this line.
 */
export function formatTierCheckLine(a: TierChoiceAudit): string {
  return (
    `TIER-CHECK room=${a.room}/${a.maxRoom} rule=${a.rule} offered=${JSON.stringify(a.tiersOffered)} ` +
    `taken=${a.chosenTier} eligibleTop=${a.eligibleTop} perpetualFilteredTop=${a.perpetualFilteredTop} ` +
    `${a.violations.length === 0 ? "OK" : `VIOLATION(${a.violations.length})`}`
  );
}

/** Thrown by `assertTierChoiceOk` — halts a live run rather than spending it on an inert flip. */
export class TierRuleViolationError extends Error {
  constructor(public readonly audit: TierChoiceAudit) {
    super(
      `Hard rule violated (CLAUDE.md rule 8) at room ${audit.room}: ${audit.violations.join(" | ")} ` +
        `Halting the run — see enemyTier.ts's session-61 in-loop tier gate note for why this stops ` +
        `rather than warns.`,
    );
    this.name = "TierRuleViolationError";
  }
}

/** Fails closed on any violation. The live loop's gate; see the section header. */
export function assertTierChoiceOk(audit: TierChoiceAudit): void {
  if (audit.violations.length > 0) throw new TierRuleViolationError(audit);
}
