/**
 * src/strategy/fishing/oilPolicy.ts — [session 43] heuristic (c): always
 * hold at least one Mid Focus Oil and one Mid Relaxing Oil in reserve; a
 * fish at low HP with no sure card-based kill in the next few cards is a
 * legitimate case to spend Mid Relaxing Oil. See SPEC-fishing.md §8.
 *
 * A JUDGMENT CALL, per the session-43 brief's own framing — not forced into
 * `cardChoice.ts`'s single scoring formula. This module names the reserve
 * floor and the low-fish-HP threshold as config, and exposes a pure
 * RECOMMENDATION function; it does NOT send anything itself.
 *
 * [session 44] `shouldConsiderRelaxingOil`'s recommendation now HAS a live
 * call site: `scripts/liveFishing.ts`'s `runOneCast`, gated the same as
 * everywhere else in this file — only fires when the account actually
 * holds a Relaxing Oil, never invents a positive balance. This was blocked
 * on the request shape (CLAUDE.md §2, "never invent an endpoint") until a
 * user DevTools capture confirmed `use_fishing_item` (QUESTIONS.md §16,
 * DECISIONS.md 2026-08-18 session 44) — the capture used a different item
 * (821, Lil Mana Oil), so the live call site's `slotIndex:0` for item 937
 * is a stated, fail-closed hypothesis, not an independently confirmed
 * value; see `src/api/fishing.ts`'s `FishingActionSchema` doc comment.
 * Mid Focus Oil's `aboveReserveFloor` gate has no analogous trigger
 * condition specified (only "keep one in reserve"), so it stays
 * recommendation-only — wiring a spend rule for it now would be inventing
 * behavior, not implementing a captured one.
 *
 * Item ids resolved against `fixtures/fishing-casts/item-metadata-sample.json`
 * (SPEC-fishing.md §4a addendum): Mid Focus Oil (942, `FishingRestoreFocus`
 * +2), Mid Relaxing Oil (937, `FishingDamageFish` +2 — a direct fish-damage
 * effect despite the name, not the "calming"/mana effect it suggests).
 */

export const MID_FOCUS_OIL_ITEM_ID = 942;
export const MID_RELAXING_OIL_ITEM_ID = 937;

/**
 * Never spend below this many held, of either oil — the standing reserve
 * floor. A count strictly above the floor is free to spend; AT the floor,
 * only `shouldConsiderRelaxingOil`'s low-fish-HP exception applies.
 */
export const OIL_RESERVE_FLOOR = 1;

/**
 * "Low fish HP" for the Relaxing Oil exception — user's own example was "2
 * HP with no sure kill in the next few cards." Expressed as a FRACTION of
 * `fishMaxHp` (not a flat HP count) since no two fish share a max HP across
 * the corpus (SPEC-fishing.md §4's `fishHp`/`fishMaxHp` table) — a flat
 * threshold calibrated to one fish's pool would misfire on a bigger one. Not
 * fitted to real data (this project has one live catch and a handful of
 * escapes, nowhere near enough to fit a threshold) — a legible, deliberately
 * conservative round number, same "a handful, not derived" honesty as
 * `contextualFallback.ts`'s retired `DEFAULT_MIN_INDEPENDENT_CASTS` was
 * before it got real evidence behind it (session 38). Revisit once real
 * Relaxing-Oil-use outcomes exist to check it against.
 */
export const LOW_FISH_HP_FRACTION = 0.15;

/**
 * True when spending the reserve Mid Relaxing Oil is a legitimate call:
 * fish HP is low relative to its own max AND there is still at least one
 * held beyond nothing (spending the very last one is always allowed at low
 * HP — the reserve floor gates ORDINARY spend, not a genuine save-the-catch
 * moment, which is the entire reason heuristic (c) names an exception in
 * the first place). Recommendation only — see the module header.
 */
export function shouldConsiderRelaxingOil(fishHp: number, fishMaxHp: number, relaxingOilHeld: number): boolean {
  if (relaxingOilHeld <= 0) return false;
  if (fishMaxHp <= 0) return false;
  return fishHp / fishMaxHp <= LOW_FISH_HP_FRACTION;
}

/**
 * True when spending a held oil of either kind is fine WITHOUT the low-HP
 * exception — i.e. holding more than the standing reserve floor. Ordinary
 * gate for Mid Focus Oil (heuristic (c) draws no low-fish-HP exception for
 * it, unlike Relaxing Oil) and for a Relaxing Oil spend outside the
 * low-HP case.
 */
export function aboveReserveFloor(held: number): boolean {
  return held > OIL_RESERVE_FLOOR;
}

// ───────────────────────────────────────────────────────────────────────────
// [session 61 §4c] THE OIL SPEND GATE
//
// ## What the payloads actually say — VERIFIED, not assumed (CLAUDE.md rule 9)
//
// The session-61 brief supplied the oils' effects as a table and flagged them
// as a user description needing verification. They were verified against
// `fixtures/fishing-casts/item-metadata-sample.json`, and the brief is right
// in every particular:
//
//   Mid Focus Oil    942  itemEffect.effects[0].effects[0]
//                         { type: "FishingRestoreFocus", amount: 2 }
//                         triggerType "OnUseFishing", durabilityChange 0
//   Mid Relaxing Oil 937  { type: "FishingDamageFish",   amount: 2 }
//                         triggerType "OnUseFishing", durabilityChange 0
//
// Both `+2`, both one-shot on consume (`durabilityChange: 0`, a single effect
// entry, no duration/turns field anywhere in the payload). Note these were
// captured back in session 43 — the mapping has been in SPEC-fishing §4a's
// addendum since 2026-08-18. This was a re-verification, not a new capture.
//
// ## The question the payload CANNOT answer: does consuming an oil cost a turn?
//
// It does not say, and the corpus cannot answer it either — but NOT for the
// reason the session-61 brief gave. The brief says "the corpus contains zero
// oil casts"; it contains ONE. Cast 12975152 (2026-08-19) carries
// `consumablesUsed: 1` with slot 0 marked on its FIRST captured state, so a
// consumable was spent at or before cast start by someone other than this bot
// (no `use_fishing_item` in its log, and our balance read has never returned a
// positive count). It cannot answer the turn-cost question anyway: the spend
// happened before capture began, and the board state names no item — both oil
// boost percents read 0, which rules out only the Fintuition and Dual Yield
// families. See `tests/sim/fishingCorpus.test.ts`. What IS known:
//
//   - `use_fishing_item` is its own `action`, distinct from `play_cards`
//     (SPEC-fishing §4a, confirmed 2026-08-18 from a user DevTools capture of
//     item 821). A separate action is suggestive of a free consume but proves
//     nothing — the server could still advance the fish on it.
//   - `consumablesUsed` and `fishingConsumableSlotUsed[3]` are counters
//     separate from any turn counter, which is again suggestive and again not
//     proof.
//
// **So it stays unanswered, and it is the single most valuable thing the first
// oil cast can measure.** A one-shot +2 damage that spends an action is a net
// LOSS whenever an ordinary attack deals more than 2 — the oil would only pay
// when the TURN budget binds, not when damage does. If consumption is free,
// both oils are close to strictly positive and only timing is in question.
// `scripts/oilTimingSweep.ts` therefore derives the policy in BOTH branches
// and neither is treated as the default.
//
// ## Why the gate is shaped like this
//
// The brief said: do not copy `resolvePotionLoadout`'s bug — a resolver that
// gated on `config.potions` alone while its caller gated on two conditions,
// with a comment claiming they matched. (That function was deleted in session
// 54; the lesson survives it, the referent does not.)
//
// A comment cannot enforce that. So `mayConsumeOil` takes EVERY condition as a
// REQUIRED field of a single context object: a caller that knows about a
// condition and forgets to pass it does not compile, and a caller that gates
// on something the resolver has never heard of is the only remaining way to
// desync the two — which a test can then check by construction rather than by
// reading. Same trick as `LiveFishingIsolatedPaths`, for the same reason.
//
// `policyApproved` is the one that matters today: CLAUDE.md rule 4 and the
// session-61 brief both say no oil is consumed live until the user has
// approved a derived timing policy. That is a HARD gate here, defaulting off,
// so the existing Relaxing-Oil call site in `liveFishing.ts` cannot start
// firing by itself the moment the user finishes crafting.

/** The `dendren.oils` block in `config/bot.json`. Absent means NO oil may be spent — silence is not authorization. */
export interface OilBudgetConfig {
  /** Item ids the user has authorized. An id not on this list is never spent, whatever the balance. */
  allowedItemIds: number[];
  /** Ceiling per cast. The game exposes 3 consumable slots (SPEC-fishing §4a); this may be lower, never higher. */
  maxPerCast: number;
  /**
   * The user's approval of a derived consumption policy (CLAUDE.md rule 4,
   * session-61 brief §4d). FALSE until they have seen the policy and said yes.
   * Authorising the BUDGET is not authorising the TIMING.
   */
  policyApproved: boolean;
}

/** Hard ceiling: the board state exposes exactly three consumable slots. */
export const MAX_CONSUMABLE_SLOTS = 3;

/**
 * Every condition a live oil spend depends on. All REQUIRED — see the section
 * header on why this is a shape and not a list of optional arguments.
 */
export interface OilSpendContext {
  /** `config/bot.json`'s `dendren.oils`. `undefined` = no block = no spend. */
  configured: OilBudgetConfig | undefined;
  /** The oil being considered. */
  itemId: number;
  /** The account's REAL balance, read live. Never assumed positive. */
  heldBalance: number;
  /** How many consumables this cast has already spent. */
  usedThisCast: number;
  /** True on a `--dry-run`: decide, report, spend nothing. */
  dryRun: boolean;
  /** Set by the caller when a previous `use_fishing_item` failed this cast — do not retry blind. */
  spendFailedThisCast: boolean;
}

export interface OilSpendDecision {
  allowed: boolean;
  /** Which condition refused, in the rule's own words. Always populated, including on `allowed`. */
  reason: string;
}

/**
 * Fails CLOSED on every condition (CLAUDE.md rule 5). The order is deliberate:
 * the reasons a reader most needs to see first — no config, no approval — are
 * checked first, so the message names the real blocker rather than whichever
 * incidental condition happened to be checked earliest.
 */
export function mayConsumeOil(ctx: OilSpendContext): OilSpendDecision {
  const c = ctx.configured;
  if (!c) {
    return {
      allowed: false,
      reason:
        "no `dendren.oils` block in config/bot.json — silence is not authorization (the session-24 lesson, " +
        "applied before it can happen a second time on a hand-crafted item).",
    };
  }
  if (!c.policyApproved) {
    return {
      allowed: false,
      reason:
        "`dendren.oils.policyApproved` is false. CLAUDE.md rule 4 and the session-61 brief §4d: the consumption " +
        "policy is derived in sim and APPROVED BY THE USER before any oil is consumed live. Authorising the " +
        "budget is not authorising the timing.",
    };
  }
  if (!c.allowedItemIds.includes(ctx.itemId)) {
    return { allowed: false, reason: `itemId ${ctx.itemId} is not in dendren.oils.allowedItemIds ${JSON.stringify(c.allowedItemIds)}.` };
  }
  if (ctx.spendFailedThisCast) {
    return { allowed: false, reason: "a use_fishing_item call already failed this cast — not retrying blind." };
  }
  if (ctx.dryRun) {
    return { allowed: false, reason: "dry run — the decision stands, nothing is spent." };
  }
  if (ctx.heldBalance <= 0) {
    return { allowed: false, reason: "balance is 0 — never invent a positive balance." };
  }
  const cap = Math.min(c.maxPerCast, MAX_CONSUMABLE_SLOTS);
  if (ctx.usedThisCast >= cap) {
    return { allowed: false, reason: `per-cast budget reached (${ctx.usedThisCast}/${cap}).` };
  }
  return { allowed: true, reason: `within budget (${ctx.usedThisCast + 1}/${cap}), ${ctx.heldBalance} held, policy approved.` };
}
