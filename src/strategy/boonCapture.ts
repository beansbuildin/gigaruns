/**
 * src/strategy/boonCapture.ts — a DELIBERATELY SUBOPTIMAL boon pick, taken to
 * buy the one thing the corpus cannot otherwise get: a pickup pair for a boon
 * nobody has ever picked. Pure; no network, no fs.
 *
 * ── WHY A SUBOPTIMAL PICK IS THE POINT, AND WHY IT IS NOT A BUG ────────────
 *
 * `src/sim/boons.ts` can only model a boon it has seen taken — a `BoonModel`'s
 * `evidence` is a state pair, `state-NNN → state-NNN+1`, and `val1`/`val2` are
 * read off the delta between them. 36 boon types have been OFFERED in captured
 * runs and none of them has such a pair.
 *
 * Session 55 measured why, and the answer is a closed loop:
 *
 *   - `loot.ts`'s `categorise()` is NAME-based and knows five shapes (`Heal`,
 *     the `AddMax*` prefix, the `Upgrade*` suffix, a five-name `ROLLED_TYPES`
 *     set, else `unknown`). **All 36 unmodelled types land in `unknown`**,
 *     which scores 10 — the lowest of the five categories.
 *   - Swept over the whole corpus — 135 captured offers × 4 HP fractions, 540
 *     decisions — `pickBoon` top-ranked an unmodelled type **0 times**. And
 *     **0 of 135 offers have every option unmodelled**, so the one escape
 *     hatch (an all-`unknown` offer, where an unmodelled type must win on the
 *     index tie-break) has never occurred either.
 *
 * So an unmodelled boon is never picked because it scores lowest, and it
 * scores lowest because it is unmodelled. Nothing about playing more runs
 * breaks that loop; only an override does.
 *
 * **This is a score floor, not an exclusion** — `pickBoon` never reads
 * `BOON_MODELS` at all, and `loot.ts`'s header says so on purpose ("what is
 * deliberately NOT in the ranking: whether a boon is modelled", because
 * preferring modelled boons would tune the coverage metric rather than the
 * game). That distinction is why this module can be a small override instead
 * of surgery on the ranker: the ranker is not wrong, it is just uninformed,
 * and it stays uninformed until a pair exists.
 *
 * ── CLAUDE.md RULE 8 IS NOT IN PLAY HERE ───────────────────────────────────
 *
 * Rule 8 governs `enemyPathOptions` tier choice and nothing else — as of
 * 2026-08-20 it reads "take the HIGHEST tier offered, except the final room,
 * and never a Perpetual" (it said "lowest" when this module was written; the
 * reversal changes nothing here). A boon pick does not touch the loot table,
 * does not choose a tier, and is not routed through `pickHighestTier()`. A
 * future reader who reads this module as "someone optimised away rule 8"
 * should stop here: it is a different decision about a different thing, and
 * the cost it pays is run quality, knowingly, for a measurement.
 *
 * ── WHAT MAKES THE COST WORTH PAYING, AND WHAT MAKES IT WASTED ─────────────
 *
 * A pick that does not produce a usable pair costs run quality and buys
 * nothing — the worst outcome available here. The caller therefore owes this
 * module a captured state immediately BEFORE the pick and immediately AFTER
 * it; `scripts/liveRun.ts` already writes both (`beforeTag`/`afterTag`) and
 * logs them together as `boon_capture_pair`.
 *
 * ── THE THREE LIMITS, AND WHY EACH ONE ──────────────────────────────────────
 *
 *  1. **ROOM 1 ONLY** (`DEFAULT_CAPTURE_ROOMS`). A bad room-1 boon costs the
 *     least, because the run has taken the least damage and has the most room
 *     to recover. It also happens to be where all five targets are first
 *     offered.
 *  2. **ONE TARGET PER RUN.** Two picks in one run compound the quality cost
 *     and buy no extra information about EITHER boon — each still yields
 *     exactly one pair. The caller passes `alreadyCaptured`.
 *  3. **A TARGET RETIRES ITSELF ONCE MODELLED.** `isModelled` is injected, and
 *     a type that has a `BOON_MODELS` entry is skipped even if it is still
 *     listed as a target. Without this, a stale config keeps paying run
 *     quality forever for a pair that already exists.
 *
 * ── EXPECTED RATE, MEASURED, SO NOBODY PLANS OFF AN OPTIMISTIC GUESS ───────
 *
 * Only **9 of 49 room-1 offers (18.4%)** in the 135-offer corpus contain one
 * of the five targets, and only **8 of 43 captured runs** had one at all. At
 * one target per run that is roughly **27 runs to model five boons** — about
 * seven days at CLAUDE.md rule 11's four juiced runs per day. The session-55
 * brief's "five boons is five runs" is optimistic by ~5x. Widening to rooms
 * 1-3 barely moves the rate (23.6%) while tripling the number of offers the
 * override could damage, which is why it stays at room 1.
 */

import type { BoonOption } from "../sim/boons.js";

/**
 * Ranked by offer frequency in the 135-offer corpus, shallowest room first
 * (`scripts/boonCoverage.ts`, session 54): TieWeak 11 offers, AddBurnShield 8,
 * AddLifestealShield 5, Regen 4, VulnerableBlock 4 — all first offered in
 * room 1. Order is meaningful: when an offer holds two targets, the earlier
 * entry wins, so the most frequently offered type gets modelled soonest.
 */
/**
 * [session 75] `AddLifestealShield` RETIRED — it got its first-ever pickup pair
 * from the 2026-08-22 juiced batch (the orb fallback took it at room 1), so it
 * is modelled and no longer a capture target. `tests/boonCapture.test.ts` calls
 * that outcome SUCCESS in as many words, and the replacement is the
 * next-ranked unmodelled type still offered in a permitted room:
 * `LossBlockUp`, 5 offers, all room 1.
 *
 * The rest of the list is unchanged and the ordering is still by offer
 * frequency over `OBSERVED_OFFERS` (TieWeak 11, AddBurnShield 10, Regen 7,
 * LossBlockUp 5, VulnerableBlock 4).
 *
 * [session 82] **TWO MORE RETIRED — `TieWeak` and `VulnerableBlock` — and
 * neither was captured by this module.** Both got their first-ever pickup
 * pairs from the 2026-08-23 juiced batch through the ordinary rules: the orb
 * fallback took TieWeak at room 1 (14 Hard Core out of [14, 12, 13]) and the
 * BOON-PRIORITY Vulnerable family took VulnerableBlock at room 3. That is
 * three of the original five targets now modelled without `boonCapture` ever
 * being switched on, which is worth stating plainly: the shipped rules are
 * clearing this list on their own, and the 27-runs-to-model-five estimate
 * above was measuring the wrong mechanism's cost.
 *
 * Replacements follow the same rule as session 75's — next-ranked unmodelled
 * types still offered in a permitted room: `WeakeningMastery` (5 offers, all
 * room 1) and `AddLifestealSword` (4 offers, all room 1). Order remains offer
 * frequency over `OBSERVED_OFFERS`: AddBurnShield 11, Regen 7, LossBlockUp 5,
 * WeakeningMastery 5, AddLifestealSword 4.
 *
 * **This changes nothing that runs.** `boonCapture` is settled OFF and needs
 * both a config flag and an explicit `--boon-capture` argument; keeping the
 * list coherent is bookkeeping so the module is not quietly dead code the day
 * someone turns it on.
 */
export const DEFAULT_CAPTURE_TARGETS: readonly string[] = [
  "AddBurnShield",
  "Regen",
  "LossBlockUp",
  "WeakeningMastery",
  "AddLifestealSword",
];

/** See limit 1 above. */
export const DEFAULT_CAPTURE_ROOMS: readonly number[] = [1];

export interface BoonCaptureConfig {
  /**
   * Off by default and never inferred. `scripts/liveRun.ts` requires BOTH this
   * flag AND an explicit `--boon-capture` argument before a single override
   * happens — the same two-condition shape as the potion gate, which exists
   * because session 24's potion loadout auto-derived from a config block
   * ALONE and consumed a user's limited item on a run they had not authorized.
   */
  enabled: boolean;
  targets: readonly string[];
  rooms: readonly number[];
}

export const BOON_CAPTURE_OFF: BoonCaptureConfig = {
  enabled: false,
  targets: DEFAULT_CAPTURE_TARGETS,
  rooms: DEFAULT_CAPTURE_ROOMS,
};

export interface BoonCaptureDecision {
  /** The option to take INSTEAD of `pickBoon`'s choice. */
  option: BoonOption;
  /** Position within the `offered` array as passed in. */
  index: number;
  /** Human-readable, for the console line and the run summary. */
  reason: string;
}

export interface BoonCaptureInput {
  offered: readonly BoonOption[];
  room: number;
  config: BoonCaptureConfig;
  /** Limit 2 — one target per run. */
  alreadyCaptured: boolean;
  /** Limit 3 — injected rather than imported so a test needs no fixture. */
  isModelled: (type: string) => boolean;
}

/**
 * The override, or `null` to leave the decision to `pickBoon`. Null is by far
 * the common case: on the corpus this fires on ~18% of room-1 offers and never
 * anywhere else.
 */
export function chooseCaptureBoon(input: BoonCaptureInput): BoonCaptureDecision | null {
  const { offered, room, config, alreadyCaptured, isModelled } = input;

  if (!config.enabled) return null;
  if (alreadyCaptured) return null;
  if (!config.rooms.includes(room)) return null;

  for (const target of config.targets) {
    // Already has a pickup pair — capturing it again buys nothing (limit 3).
    if (isModelled(target)) continue;
    const index = offered.findIndex((o) => o.type === target);
    if (index === -1) continue;
    return {
      option: offered[index]!,
      index,
      reason:
        `boon-capture override: taking unmodelled "${target}" at room ${room} to record a pickup pair ` +
        `(deliberate run-quality cost — src/strategy/boonCapture.ts; CLAUDE.md rule 8 does not apply to boon picks)`,
    };
  }
  return null;
}
