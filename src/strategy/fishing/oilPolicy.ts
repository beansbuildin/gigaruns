/**
 * src/strategy/fishing/oilPolicy.ts — [session 43] heuristic (c): always
 * hold at least one Mid Focus Oil and one Mid Relaxing Oil in reserve; a
 * fish at low HP with no sure card-based kill in the next few cards is a
 * legitimate case to spend Mid Relaxing Oil. See SPEC-fishing.md §8.
 *
 * A JUDGMENT CALL, per the session-43 brief's own framing — not forced into
 * `cardChoice.ts`'s single scoring formula. This module names the reserve
 * floor and the low-fish-HP threshold as config, and exposes a pure
 * RECOMMENDATION function. It does NOT send anything: per CLAUDE.md §2
 * ("never invent an endpoint"), no request shape for consuming a fishing
 * oil mid-cast has ever been captured — SPEC-fishing.md §4a already flags
 * this as an open gap (`itemId`/`slotIndex` on the existing envelope are
 * "very likely" the mechanism, not confirmed). See TASKS.md/QUESTIONS.md
 * for the standing capture blocker. Once a real oil-use envelope is
 * captured, a live call site can consume this function's recommendation —
 * building that call site now would be guessing at the one thing CLAUDE.md
 * §2 forbids guessing at.
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
