/**
 * src/sim/boons.ts — boons as state deltas, derived from before/after pairs.
 *
 * Task 4.5. The rule from the session-05 brief §3, held to strictly:
 *
 *   A boon is modelled ONLY if the corpus contains a state pair bracketing its
 *   pickup. Nothing is inferred from the option text.
 *
 * `UpgradePaper` was this rule's original illustrative example — its name
 * and `selectedVal2` field made its effect an obvious guess, and it stayed
 * unmodelled anyway because nobody had picked it. [session 43, LIVE] That
 * guess turned out to be wrong in the specific detail (it drew the ATK-variant
 * roll, not the DEF one the guess assumed) — the rule earned its keep, not
 * just held as a formality. See `UpgradePaper` below for the real pair.
 *
 * A boon pickup is the pair (`rewardPathPhase` state → `enemyPathPhase` state).
 * All four in the corpus add exactly one entry to `pickedBoons`, so each pair
 * isolates a single boon with no attribution ambiguity.
 *
 * `tests/boons.test.ts` re-derives every delta below from the fixtures, so this
 * table cannot drift from the responses it claims to come from.
 *
 * Values come from `selectedVal1`/`selectedVal2`, NEVER `val1Min`/`val1Max`
 * (DECISIONS 2026-08-14). Heal's range is 8 and its `selectedVal1` is 16;
 * reading the range halves every boon.
 */

import type { Reason } from "./coverage.js";
import { cloneCombatant, type Combatant, type MoveKey, type RolledStat } from "./types.js";

/** One entry of `rewardPathOptions[].boon`, reduced to what the sim needs. */
export interface BoonOption {
  type: string;
  val1: number;
  val2: number;
  /**
   * **[session 58]** This option's Hard Core payout
   * (`rewardPathOptions[].gigusOrbAmount`, itemId 845), when it is known.
   *
   * `OBSERVED_OFFERS` below does NOT carry it — that table is hand-transcribed
   * and holds only what the boon MODEL needs. It is attached by
   * `src/sim/orbOffers.ts`, which joins the payouts on from the corpus by
   * `source`, so a sim arm can exercise the live orb rule.
   *
   * `undefined` means **not captured**, never "zero orbs" — the same
   * distinction `boonPriority.ts`'s partial-capture guard is built around.
   * Nothing in `applyBoon` reads this: it is a payout, not an effect.
   */
  orbs?: number;
}

export type BoonEffect =
  /** `rolled[stat] += val1`. */
  | { kind: "rolled"; stat: RolledStat }
  /** `hp = min(hpMax, hp + val1)`. */
  | { kind: "heal" }
  /** `moves[move].atk += val1; moves[move].def += val2`. [session 09] */
  | { kind: "moveDelta"; move: MoveKey }
  /** `armorMax += val1`, current armor unchanged. [session 11, LIVE] */
  | { kind: "maxArmor" }
  /** `hpMax += val1; hp += val1` — unlike maxArmor, current HP moves WITH the ceiling. [session 23, LIVE] */
  | { kind: "maxHealth" }
  /** Verified to change nothing at pickup. The effect is latent, in combat. */
  | { kind: "latent" };

export interface BoonModel {
  effect: BoonEffect;
  /**
   * Mechanics that taking this boon drags into the run. A boon can be perfectly
   * modelled at pickup and still make everything after it unscorable — that is
   * exactly what the two rolled-stat boons do, and it is the reason Task 4.5
   * does not move `deepestScorableRoom`.
   */
  contaminates: Reason[];
  /** The corpus pair this was read off. Asserted by tests/boons.test.ts. */
  evidence: string;
  /** What the pair actually showed, for the reader. */
  observed: string;
}

export const BOON_MODELS: Record<string, BoonModel> = {
  AddLuck: {
    effect: { kind: "rolled", stat: "lck" },
    // Modelled at pickup, useless in combat: `lck`'s effect on damage is
    // unexplained, so every exchange after this one is unscorable.
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-13-23-29-39 state-008→state-009",
    observed: "selectedVal1 1 → lck.current 0 → 1",
  },
  AddEvasion: {
    effect: { kind: "rolled", stat: "evasion" },
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-14-01-00-08 state-021→state-022",
    observed: "selectedVal1 1 → evasion.current 0 → 1",
  },
  AddIntuition: {
    // [session 06] Fourth rolled-stat boon with a pair, and its val1 is 5 — so
    // across AddEvasion(1), AddLuck(1), AddTenacity(2) and this, "adds
    // selectedVal1" is now confirmed at three distinct values. The additive
    // reading is no longer the only one that fits by coincidence.
    effect: { kind: "rolled", stat: "intuition" },
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-14-03-26-57 state-028→state-029",
    observed: "selectedVal1 5 → intuition.current 0 → 5",
  },
  AddTenacity: {
    // [session 06] Third rolled-stat boon with a pair, and the first whose
    // val1 is not 1 — so "rolled boons add selectedVal1" is now distinguishable
    // from "rolled boons add 1", which the two earlier samples could not
    // separate. It adds 2.
    effect: { kind: "rolled", stat: "tenacity" },
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-14-03-26-57 state-005→state-006",
    observed: "selectedVal1 2 → tenacity.current 0 → 2",
  },
  AddBlock: {
    // [session 08, LIVE] Fifth rolled-stat boon with a pair, and the first
    // captured by the bot's own live play (not a supervised human capture) —
    // picked via scripts/liveRun.ts's postWithVerifiedRetry(), room 4,
    // reward_three. Adds 7, consistent with every other rolled-stat boon's
    // "adds selectedVal1" reading.
    effect: { kind: "rolled", stat: "block" },
    contaminates: ["ROLLED_STATS"],
    evidence: "run-2026-08-14-22-02-31 state-000→state-001",
    observed: "selectedVal1 7 → block.current 0 → 7",
  },
  Heal: {
    // The only fully clean boon in the corpus.
    effect: { kind: "heal" },
    contaminates: [],
    evidence: "run-2026-08-14-01-00-08 state-027→state-028",
    observed: "selectedVal1 16 → health.current 15 → 31 (hpMax 32)",
  },
  UpgradeScissor: {
    // [session 09, LIVE] First `moveDelta` boon with a pair — the bot's own
    // loot ranking picked it (room 2 offer), not a supervised capture.
    // val1 0 / val2 4: ATK unchanged, DEF +4. `contaminates: []` — this lands
    // on the same plain ATK/DEF numbers gear already modifies, and this
    // session's own +4/+4 gear change confirmed the clean model holds
    // through exactly that kind of shift.
    //
    // `Upgrade*` boons are NOT fixed to one stat: the corpus also has an
    // UNPICKED room-2 UpgradeScissor offer (session 02) whose raw fixture
    // shows val1Min/Max 2/2, val2Min/Max 0/0, selectedVal1 4 — the ATK
    // variant, not this DEF one. Which of val1/val2 rolls non-zero varies per
    // instance; the generic `atk += val1; def += val2` handles both without
    // a special case, same additive reading every other boon here uses.
    effect: { kind: "moveDelta", move: "scissor" },
    contaminates: [],
    evidence: "run-2026-08-15-01-53-36 state-031→state-032",
    observed: "selectedVal1 0 / selectedVal2 4 → scissor.currentATK unchanged (16), currentDEF 12 → 16",
  },
  UpgradeRock: {
    // [session 09, LIVE] Second `moveDelta` boon with a pair, same session
    // (room 1 offer, a different run) — a THIRD independent hole in Wall 1,
    // and the first NON-Heal one (Heal, above, is the other two). Same shape
    // as UpgradeScissor: val1 0 / val2 4, ATK unchanged, DEF +4 (0 → 4 here
    // since Sword's base DEF is 0). Confirms the reading generalizes across
    // two of the three `Upgrade*` types, not a one-off coincidence. Also has
    // an ATK-variant sighting (session 08, room 3, val1 4/val2 0, not picked
    // there either) — same two-variant shape as UpgradeScissor.
    effect: { kind: "moveDelta", move: "rock" },
    contaminates: [],
    evidence: "run-2026-08-15-01-58-13 state-046→state-047",
    observed: "selectedVal1 0 / selectedVal2 4 → rock.currentATK unchanged (16), currentDEF 0 → 4",
  },
  AddBurnSword: {
    // A zero delta is a RESULT here, not a gap: the pair proves the pickup
    // changes no stat. What it does is arm Burn on our Sword wins, and Burn is
    // behind a default-off flag (see `BURN_PER_EXCHANGE`), so taking it makes
    // the run unscorable for STATUS_EFFECT.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-14-01-00-08 state-038→state-039",
    observed: "selectedVal1 3 → no change to any player field",
  },
  AddMaxArmor: {
    // [session 11, LIVE] First pair for the boon QUESTIONS.md §5b called "the
    // highest-value single action left in the project" — captured at room 2,
    // not room 1 (the ask was for either), by the bot's own loot ranking.
    // FOURTH clean+modelled boon overall (after Heal, UpgradeRock,
    // UpgradeScissor), and the first that grows a max pool rather than
    // touching current HP/armor or a move's ATK/DEF. `armor` itself did NOT
    // jump to the new max (14/16 → 14/20, not 20/20) — same "current stat
    // doesn't auto-fill" pattern every rolled-stat boon already showed.
    effect: { kind: "maxArmor" },
    contaminates: [],
    evidence: "run-2026-08-15-15-38-09 state-090→state-091",
    observed: "selectedVal1 4 → armorMax 16 → 20, armor unchanged (14/14)",
  },
  CorrosiveShield: {
    // [session 11, LIVE] First pair — offered at room 1 as far back as
    // session 03 (run-2026-08-13-23-29-39) but never picked until this
    // session's bot-driven room-2 offer. Same shape as AddBurnSword: zero
    // change to any player field at pickup, so whatever "corrosive" does
    // (most likely a status armed on a Shield/paper win, mirroring
    // AddBurnSword arming Sword) is latent in combat and unconfirmed —
    // unscorable for the same STATUS_EFFECT reason, not modelled as a no-op.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-15-15-38-09 state-029→state-030",
    observed: "selectedVal1 2 → no change to any player field",
  },
  CorrosiveMagic: {
    // [session 14, LIVE] First pair — offered since session 09 (room 3,
    // never picked) but landed for the first time this session, resuming
    // the run left stuck at the end of session 13 (STATE.md). Same shape as
    // AddBurnSword/CorrosiveShield: zero change to any player field at
    // pickup. Per DECISIONS 2026-08-15, effect is never inferred from name
    // — this is NOT assumed to be Scissor/Spell's analogue of AddBurnSword
    // just because the naming pattern suggests it; it is latent and
    // unconfirmed like the other two, for the same STATUS_EFFECT reason.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-15-22-50-38 state-010→state-011",
    observed: "selectedVal1 2 → no change to any player field",
  },
  AddLifestealShield: {
    // [session 75, LIVE] First pair — the orb fallback took it at room 1 of
    // the first of four juiced runs. Offered six times since session 03 and
    // never picked until now; it is the most-offered unmodelled type on the
    // record, so this closes the largest single hole in `boonCoverage`.
    // Same shape as the other four lifesteal/corrosive latents: zero change
    // to any player field at pickup.
    //
    // THE ZERO IS MEASURED, NOT A BLIND SPOT. Three boons in the SAME run
    // moved a field under the identical diff — AddEvasion evasion 0→1,
    // AddIntuition intuition 0→1, AddMaxArmor shield.currentMax 17→21 — so
    // the instrument was demonstrably live when it recorded nothing here.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-22-03-51-44 state-005→state-006",
    observed: "selectedVal1 2 → no change to any player field",
  },
  CorrosiveSword: {
    // [session 75, LIVE] First pair — taken TWICE in one run (rooms 2 and 3),
    // both times by the BOON-PRIORITY Sword-family rule rather than the orb
    // fallback. Zero change to any player field at pickup, both times.
    //
    // This completes the corrode BOON triple at pickup: CorrosiveShield
    // (session 11), CorrosiveMagic (session 14) and now CorrosiveSword all
    // measure latent. Note that is the BOON table and says nothing about the
    // ENEMY-BUFF `corrosive*` family, which is modelled separately and read
    // off the buff. Per DECISIONS 2026-08-15 the effect is not inferred from
    // the name: this is NOT assumed to be Sword's analogue of AddBurnSword.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-22-04-00-32 state-005→state-006",
    observed: "selectedVal1 2 → no change to any player field (twice in one run)",
  },
  AddWeakSword: {
    // [session 75, LIVE] First pair — BOON-PRIORITY 4 took it at room 7 of
    // the deepest run of the session, and again in the fourth run. Zero
    // change to any player field at pickup on BOTH observations, which is
    // worth more than one: a single zero can be a capture that missed a
    // field, two independent ones on different runs cannot.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-22-04-12-49 state-105→state-106",
    observed: "selectedVal1 2 → no change to any player field",
  },
  AddVulnerableShield: {
    // [session 75, LIVE] First pair — BOON-PRIORITY 5 (Vulnerable family)
    // took it at room 9, the deepest reward this corpus has recorded. Same
    // shape as the rest of the Vulnerable family: zero change at pickup.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-22-04-12-49 state-135→state-136",
    observed: "selectedVal1 2 → no change to any player field",
  },
  AddMaxHealth: {
    // [session 23, LIVE] First pair — picked at room 3 during this session's
    // live batch (bot's own reward-pick logic, not a supervised choice).
    // Grows a max pool like AddMaxArmor, but current HP moved WITH the new
    // ceiling instead of staying put — a genuine mechanical difference, not
    // an inconsistency to paper over. See the `maxHealth` case in
    // `applyBoon` above.
    effect: { kind: "maxHealth" },
    contaminates: [],
    evidence: "run-2026-08-17-17-03-45 state-196→state-197",
    observed: "selectedVal1 8 → hpMax 42 → 50, hp 15 → 23 (both +8)",
  },
  VulnerableEvade: {
    // [session 25, LIVE] First pair — Task 10's 2-hour orchestrator gate run
    // picked it at room 1. Same shape as AddBurnSword/CorrosiveShield/
    // CorrosiveMagic: zero change to any player field at pickup, so whatever
    // it arms (most plausibly a Vulnerable debuff on an Evasion-triggering
    // move, per DECISIONS 2026-08-15's rule) is latent in combat and
    // unconfirmed — not assumed from the name.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-17-20-37-00 state-009→state-010",
    observed: "selectedVal1 4 → no change to any player field",
  },
  AddLifestealMagic: {
    // [session 25, LIVE] First pair — same run batch, picked at room 3. Same
    // shape again: zero change to any player field at pickup. Offered (not
    // picked) as far back as session 11; this is the first time it was
    // taken.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-17-21-14-12 state-035→state-036",
    observed: "selectedVal1 2 → no change to any player field",
  },
  ArmorDepletedWeak: {
    // [session 42, LIVE] First pair — the second manually-started juiced run
    // (Tier-2, silver rings) picked it at room 2. Same shape as
    // AddBurnSword/CorrosiveShield/CorrosiveMagic/VulnerableEvade/
    // AddLifestealMagic: zero change to any player field at pickup —
    // health, shield, all three moves, and every rolled stat identical
    // before/after. Whatever it does (name suggests a Weak debuff armed
    // once the player's own armor is depleted) is latent in combat and
    // unconfirmed, not assumed from the name.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-18-21-15-25 state-026→state-027",
    observed: "selectedVal1 2 → no change to any player field",
  },
  UpgradePaper: {
    // [session 43, LIVE] First pair — bot-initiated juiced Tier-3 run 2
    // (session-43 brief §0/§1), room-4 reward, the bot's own loot ranking
    // picked it. This module's own header comment (session 05) used
    // `UpgradePaper` as the canonical example of a boon withheld despite a
    // near-certain guess from its name/`selectedVal2`; that guess is now
    // moot — this pair settles it directly rather than confirming the guess.
    // selectedVal1 8 / selectedVal2 0: paper.currentATK 6 → 14 (+8),
    // currentDEF unchanged at 12 — the ATK-variant roll, same generic
    // `atk += val1; def += val2` reading UpgradeRock/UpgradeScissor already
    // established (both of which happened to draw the DEF-variant roll
    // first). All three `Upgrade*` types are now modelled.
    effect: { kind: "moveDelta", move: "paper" },
    contaminates: [],
    evidence: "run-2026-08-18-22-07-14 state-061→state-062",
    observed: "selectedVal1 8 / selectedVal2 0 → paper.currentATK 6 → 14, currentDEF unchanged (12)",
  },
  WeakeningTenacity: {
    // [session 60, LIVE] First pair — and the first two entries here that the
    // WIDE ORB RULE produced rather than the ranked policy. Room 2 offered no
    // priority family, so the rule took the richest Hard Core payout
    // (WeakeningTenacity at 20 orbs over 14/14), which is a boon the ranked
    // policy had never once picked in 134 corpus offers. Worth naming as a
    // mechanism: taking boons for orb payout explores boon types the ranked
    // policy structurally avoids, so the corpus grows sideways rather than
    // deeper. Both this and `BurningBlock` are `Rare` (RARITY_CID 2).
    //
    // Same shape as the six latent boons above: the pair's ONLY difference is
    // the boon appearing in `pickedBoons`, with health, shield, all three
    // moves and every rolled stat byte-identical. Per DECISIONS 2026-08-15 the
    // effect is NOT inferred from the name — "Weak applied on a
    // tenacity-linked trigger" is a plausible reading and it stays a reading.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-18-19-07 state-005→state-006",
    observed: "selectedVal1 4 → no change to any player field",
  },
  BurningBlock: {
    // [session 60, LIVE] First pair — the wide orb rule again, room 4, taking
    // BurningBlock at 24 orbs over 22/21. Same latent shape: zero change to
    // any player field at pickup. The name suggests Burn armed on a
    // Shield/paper win, which would make it the paper analogue of
    // `AddBurnSword` — exactly the inference `CorrosiveShield` and
    // `CorrosiveMagic` were both denied, so it is denied here too.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-18-19-07 state-033→state-034",
    observed: "selectedVal1 8 → no change to any player field",
  },
  TieVulnerable: {
    // [session 61, LIVE] First pair, after being OFFERED and declined since
    // session 12 — nine sessions as a sighting with no pickup.
    //
    // **And it was NOT the orb rule that got it**, which matters because the
    // two entries above were, and it would be easy to write a tidy story in
    // which the orb rule is steadily clearing `UNMODELLED_TYPES`. Room 5
    // offered TieVulnerable at 16 orbs against UpgradePaper at 25; the orb
    // rule would have taken the 25. The BOON-PRIORITY directive took this one
    // instead, because `TieVulnerable` is in the Vulnerable family — the
    // load-bearing case where the orb rule correctly declines to override a
    // priority match. So this coverage gain belongs to the priority rule, and
    // session 61's §5 instrumentation records the two mechanisms separately
    // rather than crediting whichever rule is currently interesting.
    //
    // Same latent shape as the six above and the two beside it: the pair's
    // ONLY difference is the boon appearing in `pickedBoons` — health, shield,
    // all three moves and every rolled stat byte-identical. Per DECISIONS
    // 2026-08-15 the effect is NOT inferred from the name; "Vulnerable applied
    // on a tie" is a plausible reading and it stays a reading. `Uncommon`
    // (RARITY_CID 1), unlike the two Rares above.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-20-04-37 state-063→state-064",
    observed: "selectedVal1 1 → no change to any player field",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // [session 82, LIVE] TWO first pairs from the day's four juiced runs, and
  // they split across the two mechanisms exactly the way session 62's §5
  // instrumentation asks them to be recorded.
  //
  // `TieWeak` came from the ORB FALLBACK (14 Hard Core out of [14, 12, 13],
  // overriding ranked `AddIntuition`); `VulnerableBlock` came from BOON
  // PRIORITY 5, the Vulnerable family, over ranked `AddEvasion`. Running total
  // across sessions 60-82: **orb 8, priority 6.**
  //
  // `TieWeak` is the one worth naming. It was the most-offered unmodelled type
  // on the entire record — 11 offers since session 03 and never once taken —
  // so it had spent longer at the top of `boonCoverage`'s gap list than any
  // other type. It then landed TWICE in one day (runs 2 and 4), which is the
  // ordinary way a long-standing gap closes: not because anything sought it
  // out, but because enough offers eventually went through the same rule.
  TieWeak: {
    // Same latent shape as every entry above it: the pair's ONLY difference is
    // the boon appearing in `pickedBoons` — health, shield, all three moves and
    // every rolled stat byte-identical across both recorded pickups. Per
    // DECISIONS 2026-08-15 the effect is NOT inferred from the name; "Weak
    // applied on a tie" is a plausible reading and it stays a reading.
    // `Uncommon` (RARITY_CID 1), `selectedVal1` 1 on both pickups.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-23-05-35-28 state-005→state-006",
    observed: "selectedVal1 1 → no change to any player field",
  },

  VulnerableBlock: {
    // Latent on the same evidence, and the name is a two-part reading rather
    // than one: neither "applies Vulnerable" nor "on a block" is confirmed.
    // Note `block` was already 10 from gear before the pickup and stayed 10
    // after, so `selectedVal1` 4 is NOT a flat add to the rolled `block` stat
    // — the one reading the pair actually rules OUT. `Rare` (RARITY_CID 2).
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-23-05-45-51 state-005→state-006",
    observed: "selectedVal1 4 → no change to any player field, block 10 → 10",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // [session 62, LIVE] FIVE first pairs in one session, from two juiced runs.
  //
  // This is the largest single-session coverage gain this table has had, and
  // the mechanism split matters more than the count — it is what §5 is
  // instrumenting. FOUR came from the ORB FALLBACK rule (WeakeningCrit,
  // AddBurnMagic, SecondWind, Vengeance: no priority family was on offer, so
  // the richest Hard Core payout decided, and the payout happened to sit on an
  // unmodelled type). ONE came from the BOON-PRIORITY rule
  // (AddVulnerableMagic, Vulnerable family).
  //
  // Running total across sessions 60-62: orb 6, priority 2. **That is still
  // not a coverage argument for the orb rule** — the brief's §2f and STATE's
  // open question 6 both say so, and three sessions of data pointing one way
  // is exactly when it becomes tempting to stop saying it. The orb rule fires
  // where NO priority family matched, which is structurally the same place
  // rare unmodelled types live, so the association is expected and does not
  // make it a coverage instrument.
  //
  // ALL FIVE ARE LATENT, and that is measured rather than assumed: for each
  // pair the ONLY difference between the before and after states is the boon
  // appearing in `pickedBoons` — health, shield, all three moves, and every
  // rolled stat are byte-identical. The same diff run against AddLuck,
  // AddEvasion and Heal on the same corpus does show their changes, so the
  // comparison is not silently broken.
  //
  // Per DECISIONS 2026-08-15 the effect is NOT inferred from the name. Every
  // one of these names suggests a mechanic — "Vengeance", "SecondWind",
  // "AddBurnMagic" as a sibling of the modelled `AddBurnSword` — and none of
  // those readings is recorded here as anything but a reading.
  //
  // `contaminates: ["STATUS_EFFECT"]` on all five follows the convention every
  // one of the nine existing latent models uses, and it is the conservative
  // direction rather than a claim: a boon that provably does nothing AT PICKUP
  // does something LATER, and marking it as contaminating says only that this
  // project cannot score the exchanges after it. Claiming `[]` would assert
  // the opposite — that it affects no combat — which no pair here shows.
  WeakeningCrit: {
    // Offered since session 61 (declined then); first pair here.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-22-41-47 state-005→state-006",
    observed: "selectedVal1 1 → no change to any player field",
  },
  AddBurnMagic: {
    // The Magic-move sibling of the already-modelled `AddBurnSword`, and it
    // behaves identically at pickup: nothing. Worth naming explicitly because
    // `AddBurnSword` is the one model a reader would be most tempted to copy a
    // damage number from — it does not carry one either.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-22-41-47 state-047→state-048",
    observed: "selectedVal1 3 → no change to any player field",
  },
  SecondWind: {
    // val1 10 and a name that reads as a heal — and the pair shows `health`
    // completely unchanged, current and max alike. If it heals, it heals on
    // some later trigger, not on pickup. This is the clearest case in the five
    // of a name that would have produced a wrong model.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-22-46-26 state-005→state-006",
    observed: "selectedVal1 10 → no change to any player field (health identical, current and max)",
  },
  AddVulnerableMagic: {
    // The one of the five taken by the PRIORITY rule rather than the orb rule
    // — room 5 offered it at 2 against CorrosiveShield and AddLuck, and the
    // Vulnerable family matched.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-22-46-26 state-065→state-066",
    observed: "selectedVal1 2 → no change to any player field",
  },
  Vengeance: {
    // val1 15, the largest of the five, taken by the orb rule at 26 Hard Core
    // against two AddTenacity options. A large val1 with a zero delta is a
    // useful reminder that val1 is the OFFER's number, not an applied one.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-20-22-46-26 state-087→state-088",
    observed: "selectedVal1 15 → no change to any player field",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // [session 89] THREE first-ever pairs, from sessions 87 and 88, modelled
  // OFFLINE at zero live cost — every source state was already on disk.
  //
  // All three are `latent`, and that is a MEASURED result rather than a
  // fallback. The check run here was stricter than the one `tests/boons.test.ts`
  // applies: a recursive diff of the ENTIRE raw `players[0]` object across each
  // pair, not just the fields `toCombatant` projects. On all three the only
  // difference in the whole object is the boon's own append to `pickedBoons` —
  // health, shield, armor, all three moves, every rolled stat and every field
  // this repo does not model, byte-identical. A zero delta found that way is a
  // finding; a zero delta found by checking six fields would not have been.
  //
  // Per DECISIONS 2026-08-15 the effect is NOT inferred from the name, and two
  // of these three are exactly the trap that rule exists for: `AddBurnShield`
  // reads as the Shield sibling of the modelled `AddBurnSword`, and
  // `AddVulnerableSword` as the Sword sibling of the modelled
  // `AddVulnerableShield`. Neither model is copied across — they land here for
  // the same reason their siblings did, because their own pair says so.
  // `VulnerableBlock` (session 82) is the standing warning: its `selectedVal1`
  // of 4 was NOT a flat add to the rolled `block` stat, and only reading the
  // pair caught it.
  //
  // `contaminates: ["STATUS_EFFECT"]` on all three, the convention every latent
  // model uses, and conservative rather than a claim: it says this project
  // cannot score the exchanges after the pickup, not that the boon does nothing.
  WeakeningMastery: {
    // [session 87, LIVE] `Rare` (RARITY_CID 2), val1 10 — the largest val1 of
    // the three, and the pair moves nothing at all. First sighted session 12,
    // room 1, offered and declined; picked 75 sessions later.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-24-00-14-01 state-059→state-060",
    observed: "selectedVal1 10 → no change to any player field (whole-object diff: pickedBoons append only)",
  },
  AddVulnerableSword: {
    // [session 88, LIVE] `Rare` (RARITY_CID 2), val1 2. The Sword member of the
    // Vulnerable family, whose Shield, Magic and Evade members are all already
    // modelled latent at val1 2 — so this is the fourth independent pair
    // agreeing, not a fourth copy of one reading. First sighted session 25,
    // room 1, declined.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-24-01-04-21 state-105→state-106",
    observed: "selectedVal1 2 → no change to any player field (whole-object diff: pickedBoons append only)",
  },
  AddBurnShield: {
    // [session 88, LIVE] `Uncommon` (RARITY_CID 1), val1 3 — the only Uncommon
    // of the three. Same run as `AddVulnerableSword`, 18 states later. Reads as
    // the Shield sibling of `AddBurnSword` (val1 3, also latent) and the numbers
    // even match; the model still comes from this pair, because agreeing with a
    // sibling is not the same as being derived from one.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-24-01-04-21 state-123→state-124",
    observed: "selectedVal1 3 → no change to any player field (whole-object diff: pickedBoons append only)",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // [session 95] THREE first-ever pairs, all from session 94's run 4
  // (`run-2026-08-25-03-30-48`), modelled OFFLINE at zero live cost.
  //
  // MODELLED FROM n=1 BY EXPLICIT USER DIRECTIVE (session-95 brief §A). The
  // cautious default this repo would otherwise take — leave the wall test red
  // until a SECOND pickup of each type confirms the reading — was considered
  // and declined by the account owner. Recorded that way in DECISIONS so a
  // later reader does not mistake it for an oversight. If any of these three
  // is ever observed moving a field on a second pickup, THIS is the block to
  // revisit first.
  //
  // All three are `latent`, and that is a MEASURED result, not a fallback. The
  // check was session 89's stricter one: a recursive diff of the ENTIRE raw
  // `players[0]` object across each pair, not just the fields `toCombatant`
  // projects. On all three the only difference in the whole object is the
  // boon's own append to `pickedBoons` — `health` and `shield` (current,
  // starting, currentMax, startingMax alike), all three moves, every rolled
  // stat, `statusEffects`, `activeEffects`, `triggeredBoons`, `gearBoons` and
  // `focusBuffs` byte-identical before and after.
  //
  // Per DECISIONS 2026-08-15 the effect is NOT inferred from the name, and
  // `Regen` below is the sharpest case of that rule this table has had since
  // `SecondWind`.
  //
  // `contaminates: ["STATUS_EFFECT"]` on all three — the convention all 23
  // existing latent models use, and conservative rather than a claim: it says
  // this project cannot score the exchanges AFTER the pickup, not that the
  // boon does nothing. The alternative `Reason` codes were checked rather than
  // skipped past: `UNKNOWN_EFFECT` is defined as
  // activeEffects/triggeredBoons/gearBoons/focusBuffs being NON-EMPTY, and all
  // four are empty across all three pairs, so it would be a false statement
  // about the state; `ROLLED_STATS` is for non-zero evasion/block/lck/tenacity,
  // which is a property of the combatant and not of a pickup; and
  // `BOON_UNMODELLED` is precisely what these entries stop being. No existing
  // reason describes "a per-turn heal of unknown tick rate" more honestly than
  // `STATUS_EFFECT`, whose own detail string already covers an unknown tick
  // rate. Adding a new reason code for one boon was not worth the churn.
  AddWeakMagic: {
    // [session 94, LIVE] `Rare` (RARITY_CID 2), val1 2. Room-1 pickup, the
    // first reward of the run. The Magic member of the Weak family, whose
    // Sword member (`AddWeakSword`, session 75) is already modelled latent at
    // val1 2 — a second independent pair agreeing, not a copy of the first.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-25-03-30-48 state-009→state-010",
    observed: "selectedVal1 2 → no change to any player field (whole-object diff: pickedBoons append only)",
  },
  VulnerableCrit: {
    // [session 94, LIVE] `Rare` (RARITY_CID 2), val1 1. The Crit member of the
    // Vulnerable family; `VulnerableEvade`, `AddVulnerableShield`,
    // `AddVulnerableMagic` and `AddVulnerableSword` are all already latent, so
    // this is the fifth of that family to measure the same way. Note the val1
    // of 1 rather than the family's usual 2 — and `VulnerableBlock`
    // (session 82) is the standing warning that a family's val1 is NOT a flat
    // add to anything, so the difference is recorded, not interpreted.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-25-03-30-48 state-055→state-056",
    observed: "selectedVal1 1 → no change to any player field (whole-object diff: pickedBoons append only)",
  },
  Regen: {
    // [session 94, LIVE] `Uncommon` (RARITY_CID 1), val1 1 — taken by the WIDE
    // ORB rule at room 7 for 28 Hard Core over the ranked `AddBlock`, i.e. at
    // zero deliberate quality cost (DECISIONS 2026-08-24; third recorded
    // occurrence of that known mechanism, not a discovery).
    //
    // THE NAME IS NOT THE MODEL, AND THIS PAIR IS UNUSUALLY GOOD EVIDENCE OF
    // THAT. "Regen" reads as a heal, and the pickup happened at
    // `health.current` = 1 out of a currentMax of 40 — about as much headroom
    // as this game can offer. An on-pickup heal of any size would have been
    // impossible to miss. `health` is byte-identical across the pair anyway.
    // Same shape as `SecondWind` (val1 10, name reads as a heal, moved
    // nothing), which is the closest precedent in the table.
    //
    // WHAT THIS ENTRY DOES NOT SETTLE, stated so that shipping a
    // confident-looking model does not silently close the question: if `Regen`
    // ticks health per turn, this repo has not observed it and could not
    // represent it if it had — `BoonEffect` has no per-turn kind, and the boon
    // model covers the PICKUP INSTANT only (Task 4.5: modelled only from a
    // state pair bracketing the pickup, nothing inferred from the option text).
    // Confirming or refuting a per-turn tick needs its own multi-turn capture
    // across a battle after a `Regen` pickup, and probably a new `BoonEffect`
    // kind. Unconfirmed, and deliberately left that way — the same treatment
    // `CorrosiveShield` gives its own unconfirmed mechanism.
    effect: { kind: "latent" },
    contaminates: ["STATUS_EFFECT"],
    evidence: "run-2026-08-25-03-30-48 state-105→state-106",
    observed: "selectedVal1 1 → no change to any player field (whole-object diff: pickedBoons append only); picked at hp 1/40, so an on-pickup heal would have been visible",
  },
};

/**
 * Burn, as the corpus shows it — kept here rather than in `combat.ts` because
 * it is NOT part of the confirmed clean model.
 *
 * Evidence (enemy 66, the three exchanges the replay flags as unexplained):
 *   045→046  predicted HP 28, actual 25
 *   046→047  predicted 25/2, actual 24/0  → 9 taken = 6 ATK + 3
 *   047→048  predicted 24/2, actual 23/0  → 9 taken = 6 ATK + 3
 * `statusEffects` is `[{Burn, amount: 3}]` and the amount does NOT decrement
 * across all three. Burn first appears immediately after the player's first
 * Sword win of that battle, which is what `AddBurnSword` should do.
 *
 * Why this stays OFF by default despite fitting 3/3: the boon's `selectedVal1`,
 * the status `amount` and the damage are all the number 3, from a single status
 * instance at a single value, and it is never observed expiring — so "ticks for
 * `amount`" and "ticks for 3" and "ticks for the boon's val1" are the same
 * observation, and the duration is unknown. Same treatment as
 * `chargesAreHardLimit`: implemented, flagged, defaulted to the side that
 * refuses to score rather than the side that guesses.
 *
 * Turning it on buys nothing today — the only enemy ever seen burning is in
 * room 4, which is unscorable for ENEMY_BUFF regardless.
 */
export const BURN_PER_EXCHANGE = {
  /** Damage per exchange to the afflicted side, after the exchange's own damage. */
  perExchange: (amount: number): number => amount,
  decrements: false,
  observedSamples: 3,
  unknownDuration: true,
} as const;

export interface BoonApplication {
  player: Combatant;
  /** Empty only for a boon that is both modelled AND clean — i.e. Heal. */
  reasons: Reason[];
  /** Null when the type has no model. */
  model: BoonModel | null;
}

/**
 * Apply a boon to the player, fail-closed.
 *
 * An unmodelled type returns the player UNCHANGED plus `BOON_UNMODELLED`. The
 * unchanged state is not a claim that the boon does nothing — it is a state
 * that no reported number is ever allowed to depend on, because the reason code
 * makes everything downstream unscorable.
 */
export function applyBoon(player: Combatant, option: BoonOption): BoonApplication {
  const model = BOON_MODELS[option.type];
  if (!model) {
    return { player: cloneCombatant(player), reasons: ["BOON_UNMODELLED"], model: null };
  }

  const next = cloneCombatant(player);
  switch (model.effect.kind) {
    case "rolled":
      // Additive. Both samples went 0 → val1, so `+= val1` and `= val1` fit
      // equally; additive is the reading the "Add*" names support and the only
      // one that composes if two rolled-stat boons are ever taken in one run.
      next.rolled[model.effect.stat] += option.val1;
      break;
    case "heal":
      // The cap is UNVERIFIED: the one sample healed 15 → 31 against an hpMax
      // of 32, so it never reached the ceiling. Capping is the conservative
      // choice — HP has never been recorded above `currentMax` anywhere.
      next.hp = Math.min(next.hpMax, next.hp + option.val1);
      break;
    case "moveDelta":
      // [session 09] Additive on the specific move's ATK/DEF, same reading as
      // every other numeric boon here. Not a rolled proc-stat — this lands on
      // fields combat.ts already treats as plain numbers (gear does the same
      // thing, and the clean model held through this session's own gear
      // change) — so it contaminates nothing.
      next.moves[model.effect.move].atk += option.val1;
      next.moves[model.effect.move].def += option.val2;
      break;
    case "maxArmor":
      // [session 11] Additive on the pool ceiling, current armor untouched —
      // matches Heal's "cap, don't autofill" discipline in spirit but in the
      // opposite direction: Heal raises `hp` toward an unchanged `hpMax`,
      // this raises `armorMax` and leaves `armor` exactly where it was.
      next.armorMax += option.val1;
      break;
    case "maxHealth":
      // [session 23] The one recorded pair moved BOTH fields by the same
      // amount: hpMax 42→50, hp 15→23 (selectedVal1 8). This is NOT the same
      // shape as maxArmor's "ceiling only" pattern — current HP rose with the
      // ceiling here, unprompted by any heal. One sample; if a future pair
      // ever shows hp NOT moving, that would falsify this and need its own
      // fix, not a silent revert.
      next.hpMax += option.val1;
      next.hp += option.val1;
      break;
    case "latent":
      break;
  }

  return { player: next, reasons: [...model.contaminates], model };
}

/** A recorded `rewardPathOptions` triple, with the room it was offered in. */
export interface BoonOffer {
  room: number;
  source: string;
  options: BoonOption[];
}

const opt = (type: string, val1: number, val2 = 0): BoonOption => ({ type, val1, val2 });

/**
 * Every reward offer the corpus contains. [Stale count corrected session 11 —
 * this said "four triples" through session 05's Task 4.5 era; the corpus has
 * grown with every live session since. Read the length below, not this
 * comment, for the current total.] [session 20, LIVE] A room-4 offer now
 * exists — the potion-orchestrator-wiring smoke test cleared room 4 and
 * reached room 5, the corpus's first run ever to do either.
 *
 * The sim draws from these and does not synthesise offers. A generated offer
 * distribution would be inventing the single thing that decides how a run
 * develops, off a small, non-random sample.
 *
 * What these showed at the end of Task 4.5 (session 05): of the 6 distinct
 * options then offered at room 1, ZERO were both modelled and clean. That was
 * Wall 1 (`handoff/scratch-session-05.md`) and why that task's gate could not
 * be met. It no longer holds — see "Wall 1" in tests/boons.test.ts.
 */
export const OBSERVED_OFFERS: BoonOffer[] = [
  {
    room: 1,
    source: "run-2026-08-13-23-29-39/state-008",
    options: [opt("AddLuck", 1), opt("CorrosiveShield", 2), opt("UpgradePaper", 0, 4)],
  },
  {
    room: 1,
    source: "run-2026-08-14-01-00-08/state-021",
    options: [opt("AddEvasion", 1), opt("AddTenacity", 2), opt("AddBlock", 2)],
  },
  {
    room: 1,
    source: "run-2026-08-14-03-26-57/state-005",
    options: [opt("AddTenacity", 2), opt("AddLuck", 2), opt("AddBlock", 2)],
  },
  {
    // [session 06] The first room-1 offer containing a boon that is neither a
    // rolled stat nor an upgrade. `AddMaxArmor` was NOT taken, so it has no
    // pair and stays unmodelled — but it is the strongest candidate yet for a
    // clean room-1 boon, since a max-pool change is something combat.ts already
    // models. See QUESTIONS §5b.
    room: 1,
    source: "run-2026-08-14-03-26-57/state-016",
    options: [opt("AddMaxArmor", 2), opt("AddLuck", 1), opt("UpgradeScissor", 0, 4)],
  },
  {
    // [session 06] `Regen` is a type the corpus had never seen before. Offered
    // at room 1, not taken, so it has no pair and is not modelled — and its
    // name is exactly the kind of thing the DECISIONS 2026-08-15 rule exists to
    // stop us acting on. It is also, on its name alone, the most interesting
    // unmodelled boon in the corpus: HP is the one resource combat cannot renew
    // (§4b), so a regeneration effect would change the shape of the utility
    // function rather than just its weights. Worth taking a run to capture.
    room: 1,
    source: "run-2026-08-14-03-26-57/state-028",
    options: [opt("AddIntuition", 5), opt("AddLuck", 1), opt("Regen", 2)],
  },
  {
    // [session 09, LIVE] Second room-1 offer from the bot's own live play.
    // AddEvasion (picked) already had a pair from session 06 — this adds a
    // second, val1 5 here vs val1 1 there (rarity varies the roll: this one
    // was "Epic" vs the earlier "Common"). Confirms the additive rule holds
    // across different roll magnitudes, not just the one previously seen.
    room: 1,
    source: "run-2026-08-15-01-16-03/state-011",
    options: [opt("AddEvasion", 5), opt("AddTenacity", 2), opt("Heal", 16)],
  },
  {
    // [session 09, LIVE] Room-1 offer, a fresh dungeon attempt (Run B, this
    // session). First sighting of `WeakeningBlock` (offered, not picked —
    // stays unmodelled). AddBlock (picked) already modelled.
    room: 1,
    source: "run-2026-08-15-01-53-36/state-007",
    options: [opt("WeakeningBlock", 4), opt("AddBlock", 2), opt("AddIntuition", 1)],
  },
  {
    // [session 09, LIVE] Room-1 offer, a THIRD distinct dungeon attempt (Run
    // C, same fixture directory as the one above — one process invocation
    // spanned two runs). `WeakeningBlock` seen again, still not picked.
    room: 1,
    source: "run-2026-08-15-01-53-36/state-072",
    options: [opt("AddIntuition", 1), opt("WeakeningBlock", 4), opt("AddLuck", 1)],
  },
  {
    // [session 09, LIVE] Room-1 offer, Run D. Second distinct room-1 offer
    // containing Heal, and this time Heal is the one PICKED (the session-09
    // discovery above had AddEvasion picked instead, with Heal merely on
    // offer) — a second, independent confirmation that Wall 1 has a hole.
    room: 1,
    source: "run-2026-08-15-01-58-13/state-021",
    options: [opt("AddIntuition", 1), opt("AddBlock", 2), opt("Heal", 16)],
  },
  {
    // [session 09, LIVE] Room-1 offer, Run E. `UpgradeRock` (picked) now has
    // a pair — see BOON_MODELS above. `val1`/`val2` here (0, 4) are the
    // DEF-roll variant; the SAME type at room 3 below rolled the ATK variant
    // (4, 0) — `Upgrade*` boons are not fixed to one stat, which val*Min/Max
    // is non-zero on the specific roll decides which. `moveDelta`'s generic
    // `atk += val1; def += val2` already handles both without a special
    // case. A THIRD independent hole in Wall 1, and the first NON-Heal one:
    // `UpgradeRock` is clean and modelled, and it is offered (and was taken)
    // at room 1.
    room: 1,
    source: "run-2026-08-15-01-58-13/state-046",
    options: [opt("AddBlock", 3), opt("AddTenacity", 2), opt("UpgradeRock", 0, 4)],
  },
  {
    room: 2,
    source: "run-2026-08-14-01-00-08/state-027",
    options: [opt("Heal", 16), opt("UpgradeScissor", 4), opt("AddIntuition", 1)],
  },
  {
    // [session 09, LIVE] First room-2 offer following a NON-Safe enemy-tier
    // pick (session 09: no Safe tier was offered for this room's fight, see
    // enemyTier.ts). All three options here carry `tier`/`tierName: "Risky"`
    // on the wire (new fields, never seen on `rewardPathOptions[]` before —
    // reward offers apparently inherit the risk tier of the fight just won,
    // not just the enemy-path offer itself). Logged, not modelled or acted
    // on (DECISIONS 2026-08-15) — `wireBoonToOption` still reads only
    // boonTypeString/selectedVal1/selectedVal2. Also the corpus's first
    // sighting of `TieWeak` (offered, not picked — stays unmodelled).
    room: 2,
    source: "run-2026-08-15-01-42-35/state-022",
    options: [opt("CorrosiveShield", 2), opt("AddLuck", 1), opt("TieWeak", 1)],
  },
  {
    // [session 09, LIVE] Room-2 offer, Run B. `UpgradeScissor` (picked) now
    // has a pair — see BOON_MODELS above. DEF-roll variant (0, 4); the
    // room-2 offer above rolled the ATK variant (4, 0) for the same type.
    room: 2,
    source: "run-2026-08-15-01-53-36/state-031",
    options: [opt("UpgradeScissor", 0, 4), opt("AddBlock", 2), opt("AddIntuition", 1)],
  },
  {
    // [session 09, LIVE] Room-2 offer, Run E (the room2->3 transition). Same
    // rolled-stat pattern as every other AddTenacity sighting.
    room: 2,
    source: "run-2026-08-15-02-03-23/state-004",
    options: [opt("AddBurnSword", 5), opt("AddTenacity", 2), opt("AddEvasion", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-14-01-00-08/state-038",
    options: [opt("AddBurnSword", 3), opt("TieDamageReduction", 8), opt("AddEvasion", 1)],
  },
  {
    // [session 08, LIVE] Second room-3 offer, first from the bot's own live
    // play. AddBlock (picked) now has a pair — see BOON_MODELS above.
    room: 3,
    source: "run-2026-08-14-21-30-55/state-015",
    options: [opt("UpgradeRock", 4), opt("WeakeningMastery", 10), opt("AddBlock", 7)],
  },
  {
    // [session 09, LIVE] Room-3 offer, Run B. First sighting of
    // `CorrosiveMagic` (offered, not picked here — see session 14's offer
    // below for its first pickup and BOON_MODELS above for the resulting
    // model). AddBlock (picked) already modelled.
    room: 3,
    source: "run-2026-08-15-01-53-36/state-047",
    options: [opt("TieWeak", 1), opt("CorrosiveMagic", 2), opt("AddBlock", 2)],
  },
  {
    // [session 11, LIVE] Room-1 offer, Run A (this session's 3-run stage,
    // retuned config). Two DISTINCT `UpgradePaper` rolls in the same offer —
    // an ATK variant (4,0) and a DEF variant (0,4), same two-variant shape
    // `UpgradeRock`/`UpgradeScissor` already showed. Neither picked.
    room: 1,
    source: "run-2026-08-15-15-38-09/state-009",
    options: [opt("AddIntuition", 1), opt("UpgradePaper", 4), opt("UpgradePaper", 0, 4)],
  },
  {
    // [session 11, LIVE] Room-2 offer, Run A. `CorrosiveShield` (picked) now
    // has a pair — see BOON_MODELS above. First sighting of `VulnerableEvade`
    // (offered, not picked — stays unmodelled).
    room: 2,
    source: "run-2026-08-15-15-38-09/state-029",
    options: [opt("CorrosiveShield", 2), opt("Regen", 1), opt("VulnerableEvade", 4)],
  },
  {
    room: 3,
    source: "run-2026-08-15-15-38-09/state-053",
    options: [opt("AddLuck", 1), opt("AddIntuition", 1), opt("AddIntuition", 2)],
  },
  {
    // [session 11, LIVE] Room-1 offer, Run B. First sighting of
    // `AddWeakSword` (offered, not picked — stays unmodelled).
    room: 1,
    source: "run-2026-08-15-15-38-09/state-078",
    options: [opt("AddEvasion", 1), opt("AddBlock", 5), opt("AddWeakSword", 2)],
  },
  {
    // [session 11, LIVE] Room-2 offer, Run B. `AddMaxArmor` (picked) now has
    // a pair — see BOON_MODELS above. The highest-value single capture
    // QUESTIONS.md §5b asked for, though it landed at room 2, not room 1.
    room: 2,
    source: "run-2026-08-15-15-38-09/state-090",
    options: [opt("Regen", 2), opt("AddMaxArmor", 4), opt("AddBlock", 7)],
  },
  {
    // [session 11, LIVE] Room-1 offer, Run C (third distinct dungeon attempt
    // this session's stage). First sighting of `AddLifestealShield` and
    // `BurnMastery` (both offered, not picked — stay unmodelled).
    room: 1,
    source: "run-2026-08-15-15-38-09/state-111",
    options: [opt("AddLifestealShield", 3), opt("BurnMastery", 1), opt("AddTenacity", 3)],
  },
  {
    // [session 12, LIVE] Room-1 offer, run reached room 3 before dying.
    // First sighting of `WeakeningMastery` (offered, not picked — unmodelled).
    room: 1,
    source: "run-2026-08-15-18-10-21/state-013",
    options: [opt("UpgradePaper", 0, 6), opt("WeakeningMastery", 10), opt("AddLuck", 1)],
  },
  {
    // [session 12, LIVE] Room-2 offer, same run.
    room: 2,
    source: "run-2026-08-15-18-10-21/state-027",
    options: [opt("AddTenacity", 2), opt("AddIntuition", 1), opt("UpgradeScissor", 0, 4)],
  },
  {
    // [session 12, LIVE] Room-1 offer, run reached room 4 before dying. First
    // sighting of `AddBurnMagic` (offered, not picked — unmodelled).
    room: 1,
    source: "run-2026-08-15-18-10-21/state-050",
    options: [opt("AddEvasion", 10), opt("AddBurnSword", 5), opt("AddBurnMagic", 3)],
  },
  {
    // [session 12, LIVE] Room-2 offer, same run. First sighting of
    // `VulnerableMastery` (offered, not picked — unmodelled).
    room: 2,
    source: "run-2026-08-15-18-10-21/state-072",
    options: [opt("VulnerableMastery", 10), opt("AddLuck", 5), opt("AddBlock", 2)],
  },
  {
    // [session 12, LIVE] Room-3 offer, same run. First sighting of
    // `TieVulnerable` (offered, not picked — unmodelled).
    room: 3,
    source: "run-2026-08-15-18-10-21/state-088",
    options: [opt("TieVulnerable", 1), opt("TieWeak", 1), opt("UpgradeScissor", 12)],
  },
  {
    // [session 13, LIVE] Room-1 offer, the run carrying Task 12 Stage A's
    // use_item probe (not this session's focus). No new boon type.
    room: 1,
    source: "run-2026-08-15-20-44-28/state-011",
    options: [opt("UpgradeScissor", 4), opt("AddBlock", 2), opt("AddTenacity", 2)],
  },
  {
    // [session 13, LIVE] Room-2 offer, same run. No new boon type.
    room: 2,
    source: "run-2026-08-15-20-44-28/state-033",
    options: [opt("UpgradeRock", 8), opt("AddTenacity", 2), opt("AddEvasion", 5)],
  },
  {
    // [session 14, LIVE] Room-3 offer, same underlying attempt (cid
    // 24811259) resumed after the stuck-run recovery per this session's
    // brief §4 — the run that carried the use_item probe survived room 3
    // this time. `CorrosiveMagic` picked here for the first time (offered
    // twice before, session 09, never picked) — first pair, now modelled
    // (`{kind:"latent"}`, zero delta at pickup — see BOON_MODELS above).
    room: 3,
    source: "run-2026-08-15-22-50-38/state-010",
    options: [opt("CorrosiveMagic", 2), opt("TieWeak", 1), opt("AddLifestealShield", 2)],
  },
  {
    // [session 14, LIVE] Room-1 offer, Task 12 Stage B's `--probe-consumables`
    // run (brief §3 — a real Big Heal Juice, itemId 131, sent in
    // `consumables` at `start_run`; see DECISIONS.md for the field-shape
    // finding, not this session's boon focus). First sighting of
    // `ArmorDepletedWeak` (offered, not picked — stays unmodelled).
    // AddTenacity (picked) already modelled.
    room: 1,
    source: "run-2026-08-15-23-02-36/state-011",
    options: [opt("AddTenacity", 2), opt("AddBlock", 3), opt("ArmorDepletedWeak", 2)],
  },
  {
    // [session 16, LIVE] Room-1 offer, Task 12 Stage B's first real live
    // potion-timing run (--potions=2 --potion-threshold=0.5). First sighting
    // of `CorrosiveMagic`, `BurningTenacity`, `AddLifestealMagic` as a room-1
    // triple (CorrosiveMagic already modelled as latent, session 14 — first
    // pair was room 3). Picked CorrosiveMagic.
    room: 1,
    source: "run-2026-08-16-15-30-03/state-003",
    options: [opt("CorrosiveMagic", 2), opt("BurningTenacity", 8), opt("AddLifestealMagic", 2)],
  },
  {
    // [session 16, LIVE] Room-2 offer, same run. AddMaxArmor (picked)
    // already modelled, clean (session 11). UpgradeScissor already modelled.
    room: 2,
    source: "run-2026-08-16-15-30-03/state-019",
    options: [opt("UpgradeScissor", 4), opt("AddIntuition", 1), opt("AddMaxArmor", 2)],
  },
  {
    // [session 16, LIVE] Room-3 offer, same run — the first Safe-tier clear
    // of enemy 65 (room 3) to also carry a live potion-timing use_item mid-
    // battle (see DECISIONS.md). AddLuck (picked) and AddEvasion already
    // modelled/pipelined. First sighting of `SecondWind`.
    room: 3,
    source: "run-2026-08-16-15-30-03/state-033",
    options: [opt("AddLuck", 1), opt("AddEvasion", 1), opt("SecondWind", 10)],
  },
  {
    // [session 16, LIVE] Room-1 offer, second live potion-timing run this
    // session — the FIXED `usePotionLive` index handling confirmed working
    // end-to-end for both uses in one run, with no manual intervention. Both
    // options already modelled; AddMaxArmor (picked) already clean.
    room: 1,
    source: "run-2026-08-16-15-38-58/state-012",
    options: [opt("UpgradeScissor", 0, 4), opt("AddMaxArmor", 2), opt("AddBlock", 2)],
  },
  {
    // [session 16, LIVE] Room-2 offer, same run.
    room: 2,
    source: "run-2026-08-16-15-38-58/state-040",
    options: [opt("AddBlock", 3), opt("AddIntuition", 1), opt("AddMaxArmor", 2)],
  },
  {
    // [live, 2026-08-16/17] Room-1 offer, the takeover run (started outside
    // any session, resumed and completed via liveRun.ts — STATE.md session
    // 17). First sighting of `VulnerableBlock` and `CorrosiveShield` seen
    // together (CorrosiveShield already known; VulnerableBlock is new,
    // offered not picked — stays unmodelled). AddBlock (picked) already clean.
    room: 1,
    source: "run-2026-08-16-17-55-45/state-008",
    options: [opt("VulnerableBlock", 4), opt("CorrosiveShield", 2), opt("AddBlock", 2)],
  },
  {
    // [live, 2026-08-16/17] Room-2 offer, same takeover run. All three
    // options already modelled/seen; AddTenacity (picked) already clean.
    room: 2,
    source: "run-2026-08-16-17-55-45/state-032",
    options: [opt("UpgradeScissor", 0, 4), opt("AddTenacity", 2), opt("AddBlock", 2)],
  },
  {
    // [live, 2026-08-16/17] Room-3 offer, same takeover run — the run died in
    // room 4, so this stays the deepest offer in the corpus. First sighting
    // of `AddVulnerableShield` (offered, not picked — stays unmodelled).
    // AddLuck (picked) already clean.
    room: 3,
    source: "run-2026-08-16-17-55-45/state-054",
    options: [opt("AddVulnerableShield", 2), opt("AddLuck", 2), opt("AddBlock", 2)],
  },
  {
    // [live, session 19, orchestrator smoke test] First sighting of
    // `AddBurnShield` (offered, not picked — stays unmodelled). AddTenacity
    // (picked) and AddBlock (offered) both already modelled.
    room: 1,
    source: "run-2026-08-17-01-23-21/state-006",
    options: [opt("AddTenacity", 2), opt("AddBlock", 2), opt("AddBurnShield", 5)],
  },
  {
    // [session 20, LIVE] Room-2 offer, the resumed session-19 smoke-test run
    // (played to completion this session — died room 3). First sighting of
    // `LossBlockUp` (offered, not picked — stays unmodelled). AddIntuition
    // (picked) already modelled.
    room: 2,
    source: "run-2026-08-17-04-35-58/state-014",
    options: [opt("WeakeningBlock", 4), opt("AddIntuition", 1), opt("LossBlockUp", 5)],
  },
  {
    // [session 20, LIVE] Room-1 offer, potion-orchestrator-wiring smoke test,
    // Run A (first of two dungeon runs this smoke test triggered). Second
    // distinct AddTenacity roll (val1 3) offered alongside a DEF-variant
    // UpgradeRock (picked) — both already modelled/clean.
    room: 1,
    source: "run-2026-08-17-04-45-33/state-007",
    options: [opt("AddTenacity", 2), opt("UpgradeRock", 0, 8), opt("AddTenacity", 3)],
  },
  {
    // [session 20, LIVE] Room-2 offer, same run. All three options already
    // modelled; AddIntuition (picked) already clean.
    room: 2,
    source: "run-2026-08-17-04-45-33/state-019",
    options: [opt("Heal", 16), opt("AddIntuition", 1), opt("AddEvasion", 1)],
  },
  {
    // [session 20, LIVE] Room-3 offer, same run. First sighting of
    // `AddLifestealMagic` alongside a DEF-variant UpgradeRock (picked,
    // already clean/modelled) — same type, different roll variant from the
    // room-1 ATK-variant UpgradeRock seen elsewhere in the corpus.
    room: 3,
    source: "run-2026-08-17-04-45-33/state-031",
    options: [opt("UpgradeRock", 0, 4), opt("AddLifestealMagic", 4), opt("AddLuck", 2)],
  },
  {
    // [session 20, LIVE] Room-4 offer, same run — the corpus's first-ever
    // room-4 offer (every prior run either died in room 4 or never reached
    // it; this run cleared room 4 and reached room 5, also a first). First
    // sighting of `CorrosiveSword` (offered, not picked — stays unmodelled).
    // AddBlock (picked) already clean.
    room: 4,
    source: "run-2026-08-17-04-45-33/state-049",
    options: [opt("AddBlock", 2), opt("AddLuck", 1), opt("CorrosiveSword", 2)],
  },
  {
    // [session 20, LIVE] Room-1 offer, Run B (second dungeon run this smoke
    // test triggered, immediately after Run A above). UpgradeRock (picked,
    // DEF-variant) already clean/modelled; AddBlock/UpgradePaper already
    // known.
    room: 1,
    source: "run-2026-08-17-04-47-48/state-007",
    options: [opt("AddBlock", 2), opt("UpgradePaper", 4), opt("UpgradeRock", 0, 8)],
  },
  {
    // [session 20, LIVE] Room-2 offer, same run. All three options already
    // modelled/seen; AddIntuition (picked) already clean.
    room: 2,
    source: "run-2026-08-17-04-47-48/state-021",
    options: [opt("AddIntuition", 1), opt("AddLuck", 1), opt("AddEvasion", 1)],
  },
  // [session 23, LIVE] 13 new offers from this session's live batch (9
  // dungeon runs, see STATE.md/handoff/log for the incident this batch was
  // part of). All options already modelled/seen except AddMaxHealth, its
  // own first-ever pair — see BOON_MODELS above.
  {
    room: 1,
    source: "run-2026-08-17-17-03-45/state-010",
    options: [opt("AddBurnSword", 5), opt("AddEvasion", 1), opt("AddIntuition", 1)],
  },
  {
    room: 1,
    source: "run-2026-08-17-17-03-45/state-027",
    options: [opt("UpgradeRock", 0, 4), opt("AddIntuition", 2), opt("AddEvasion", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-17-17-03-45/state-047",
    options: [opt("AddBurnShield", 3), opt("AddBlock", 2), opt("AddWeakSword", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-17-17-03-45/state-063",
    options: [opt("AddIntuition", 1), opt("AddLuck", 1), opt("AddLifestealShield", 4)],
  },
  {
    room: 1,
    source: "run-2026-08-17-17-03-45/state-086",
    options: [opt("AddTenacity", 2), opt("AddBlock", 2), opt("AddLifestealShield", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-17-17-03-45/state-100",
    options: [opt("AddEvasion", 2), opt("AddBlock", 2), opt("AddBlock", 5)],
  },
  {
    room: 1,
    source: "run-2026-08-17-17-03-45/state-125",
    options: [opt("UpgradeScissor", 0, 4), opt("AddIntuition", 1), opt("TieWeak", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-17-17-03-45/state-139",
    options: [opt("UpgradeScissor", 0, 6), opt("AddBurnShield", 3), opt("AddTenacity", 2)],
  },
  {
    room: 1,
    source: "run-2026-08-17-17-03-45/state-162",
    options: [opt("AddIntuition", 1), opt("AddIntuition", 4), opt("UpgradeRock", 0, 4)],
  },
  {
    room: 2,
    source: "run-2026-08-17-17-03-45/state-180",
    options: [opt("UpgradeScissor", 4), opt("Regen", 1), opt("AddEvasion", 1)],
  },
  {
    // First-ever AddMaxHealth pickup pair — see BOON_MODELS above.
    room: 3,
    source: "run-2026-08-17-17-03-45/state-196",
    options: [opt("AddLuck", 2), opt("AddTenacity", 2), opt("AddMaxHealth", 8)],
  },
  {
    room: 1,
    source: "run-2026-08-17-17-03-45/state-211",
    options: [opt("AddTenacity", 2), opt("AddBlock", 2), opt("AddEvasion", 1)],
  },
  {
    room: 1,
    source: "run-2026-08-17-17-44-38/state-011",
    options: [opt("UpgradeScissor", 0, 4), opt("AddTenacity", 2), opt("AddEvasion", 1)],
  },
  {
    // [session 24] Task 10's live orchestrator gate run — 4 offers landed
    // before the user Ctrl-C'd it over the potions incident (see DECISIONS.md
    // 2026-08-17 session 24). All 3 types here are prior-seen unmodelled
    // types; none picked, so no new pair.
    room: 1,
    source: "run-2026-08-17-18-54-04/state-015",
    options: [opt("AddEvasion", 1), opt("AddLifestealShield", 2), opt("CorrosiveShield", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-17-18-54-04/state-033",
    options: [opt("AddBurnShield", 3), opt("AddIntuition", 1), opt("AddEvasion", 4)],
  },
  {
    room: 3,
    source: "run-2026-08-17-18-54-04/state-051",
    options: [opt("AddTenacity", 2), opt("AddLifestealMagic", 2), opt("AddLuck", 1)],
  },
  {
    room: 4,
    source: "run-2026-08-17-18-54-04/state-069",
    options: [opt("UpgradeRock", 4), opt("IntuitionArmor", 7), opt("UpgradeRock", 12)],
  },
  // [session 25, LIVE] Task 10's real 2-hour orchestrator gate, retried after
  // session 24's potions leak was closed — 12 real dungeon runs, 25 reward
  // offers. `VulnerableEvade` and `AddLifestealMagic` were PICKED here for
  // the first time (both prior-seen offer-only types) and are now modelled
  // above (latent, zero pickup delta, same shape as AddBurnSword). Six
  // genuinely new types first sighted this batch, all offered-not-picked and
  // left unmodelled per the standing name-inference rule: `BurningEvade`,
  // `AddVulnerableSword`, `ArmorDepletedVulnerable`, `AddWeakMagic`,
  // `WeakeningCrit`, `AddVulnerableMagic`.
  {
    room: 1,
    source: "run-2026-08-17-20-33-23/state-009",
    options: [opt("UpgradeScissor", 0, 4), opt("BurningEvade", 8), opt("AddLuck", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-17-20-33-23/state-025",
    options: [opt("AddLuck", 1), opt("VulnerableBlock", 4), opt("AddLifestealMagic", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-17-20-33-23/state-043",
    options: [opt("AddBurnShield", 3), opt("AddEvasion", 1), opt("Heal", 50)],
  },
  {
    room: 4,
    source: "run-2026-08-17-20-33-23/state-059",
    options: [opt("AddEvasion", 1), opt("AddBlock", 2), opt("AddLuck", 1)],
  },
  {
    // First pickup pair for VulnerableEvade — see BOON_MODELS.
    room: 1,
    source: "run-2026-08-17-20-37-00/state-009",
    options: [opt("VulnerableEvade", 4), opt("UpgradePaper", 0, 4), opt("UpgradeScissor", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-17-20-37-00/state-027",
    options: [opt("VulnerableMastery", 10), opt("UpgradePaper", 0, 4), opt("AddMaxArmor", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-17-20-37-00/state-041",
    options: [opt("AddEvasion", 1), opt("AddTenacity", 2), opt("AddIntuition", 1)],
  },
  {
    room: 4,
    source: "run-2026-08-17-20-37-00/state-055",
    options: [opt("UpgradePaper", 4), opt("AddBlock", 2), opt("TieWeak", 1)],
  },
  {
    room: 1,
    source: "run-2026-08-17-20-39-09/state-013",
    options: [opt("VulnerableBlock", 4), opt("AddIntuition", 1), opt("AddLuck", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-17-20-39-09/state-029",
    options: [opt("AddMaxArmor", 2), opt("UpgradeScissor", 4), opt("UpgradeRock", 8)],
  },
  {
    room: 3,
    source: "run-2026-08-17-20-39-09/state-043",
    options: [opt("CorrosiveMagic", 2), opt("AddLuck", 1), opt("UpgradePaper", 0, 4)],
  },
  {
    // First sighting of `AddVulnerableSword`.
    room: 1,
    source: "run-2026-08-17-21-08-10/state-007",
    options: [opt("AddBlock", 2), opt("AddTenacity", 2), opt("AddVulnerableSword", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-17-21-08-10/state-029",
    options: [opt("AddBlock", 2), opt("AddBurnSword", 5), opt("UpgradeRock", 0, 6)],
  },
  {
    // First sighting of `ArmorDepletedVulnerable`.
    room: 1,
    source: "run-2026-08-17-21-09-37/state-011",
    options: [opt("ArmorDepletedVulnerable", 2), opt("AddBlock", 2), opt("AddTenacity", 5)],
  },
  {
    room: 1,
    source: "run-2026-08-17-21-10-32/state-007",
    options: [opt("UpgradeScissor", 0, 4), opt("AddTenacity", 2), opt("AddBlock", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-17-21-10-32/state-031",
    options: [opt("AddIntuition", 2), opt("AddMaxArmor", 2), opt("UpgradeScissor", 0, 4)],
  },
  {
    room: 1,
    source: "run-2026-08-17-21-12-02/state-013",
    options: [opt("AddBlock", 2), opt("AddIntuition", 1), opt("AddEvasion", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-17-21-12-02/state-027",
    options: [opt("CorrosiveMagic", 2), opt("AddBlock", 2), opt("AddLuck", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-17-21-12-02/state-039",
    options: [opt("AddEvasion", 2), opt("AddMaxArmor", 10), opt("CorrosiveMagic", 2)],
  },
  {
    // First sighting of `AddWeakMagic`.
    room: 1,
    source: "run-2026-08-17-21-14-12/state-011",
    options: [opt("AddBlock", 2), opt("AddEvasion", 1), opt("AddWeakMagic", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-17-21-14-12/state-025",
    options: [opt("AddLuck", 1), opt("AddIntuition", 1), opt("UpgradeScissor", 4)],
  },
  {
    // First pickup pair for AddLifestealMagic — see BOON_MODELS. First
    // sighting of `WeakeningCrit`.
    room: 3,
    source: "run-2026-08-17-21-14-12/state-035",
    options: [opt("AddLifestealMagic", 2), opt("Heal", 16), opt("WeakeningCrit", 1)],
  },
  {
    // First sighting of `AddVulnerableMagic`.
    room: 1,
    source: "run-2026-08-17-21-16-02/state-007",
    options: [opt("AddVulnerableMagic", 2), opt("AddBlock", 2), opt("UpgradePaper", 0, 4)],
  },
  {
    room: 2,
    source: "run-2026-08-17-21-16-02/state-021",
    options: [opt("AddTenacity", 2), opt("AddIntuition", 1), opt("LossBlockUp", 5)],
  },
  {
    room: 1,
    source: "run-2026-08-17-21-17-23/state-013",
    options: [opt("AddIntuition", 1), opt("SecondWind", 5), opt("UpgradePaper", 0, 4)],
  },
  // [session 42] The user's resumed juiced Tier-3 run (TASKS.md Task 14 §0)
  // reached room 7 before dying — this run's own five new room-1..5 offers,
  // in order.
  {
    room: 1,
    source: "run-2026-08-18-19-50-14/state-019",
    options: [opt("AddLuck", 1), opt("AddBlock", 2), opt("AddLuck", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-18-19-50-14/state-035",
    options: [opt("AddBlock", 2), opt("AddEvasion", 1), opt("AddMaxArmor", 8)],
  },
  {
    // Largest `Heal` val1 seen in the corpus to date (50, vs. the next
    // highest 16) — offered, not modelled differently; `BOON_MODELS["Heal"]`
    // already reads `selectedVal1` directly rather than a hardcoded amount.
    room: 3,
    source: "run-2026-08-18-19-50-14/state-055",
    options: [opt("Heal", 50), opt("TieWeak", 1), opt("UpgradePaper", 4)],
  },
  {
    room: 4,
    source: "run-2026-08-18-19-50-14/state-069",
    options: [opt("AddBurnSword", 3), opt("AddEvasion", 1), opt("AddTenacity", 2)],
  },
  {
    room: 5,
    source: "run-2026-08-18-19-50-14/state-085",
    options: [opt("BurningEvade", 8), opt("AddIntuition", 1), opt("AddBurnSword", 3)],
  },
  {
    // First-ever room-6 offer — unblocked by this session's new
    // `ROOM_ENEMIES` room-6 entry (`roomOf("Enemy Room 68")` was previously
    // -1, so `boonPickups` silently excluded this pickup; see
    // src/sim/enemies.ts).
    room: 6,
    source: "run-2026-08-18-19-50-14/state-109",
    options: [opt("AddVulnerableMagic", 2), opt("UpgradeScissor", 4), opt("AddLuck", 1)],
  },
  // [session 42, same session] The user's SECOND manually-started juiced
  // run (this one Tier-2, silver rings — TASKS.md Task 14's `index==tier`
  // question, settled by the user's own second live capture) — five new
  // room-1..5 offers, in order. First-ever pickup pair for
  // `ArmorDepletedWeak` (picked at room 2) — see BOON_MODELS.
  {
    room: 1,
    source: "run-2026-08-18-21-15-25/state-003",
    options: [opt("IntuitionArmor", 10), opt("AddIntuition", 1), opt("TieWeak", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-18-21-15-25/state-025",
    options: [opt("ArmorDepletedWeak", 2), opt("BurningBlock", 8), opt("UpgradePaper", 0, 4)],
  },
  {
    // Content-identical to an earlier room-3 offer (AddEvasion(1)/
    // AddTenacity(2)/AddIntuition(1)) — a genuine independent repeat, not a
    // duplicate entry error; `OBSERVED_OFFERS` records every corpus sighting,
    // not a deduplicated set.
    room: 3,
    source: "run-2026-08-18-21-15-25/state-039",
    options: [opt("AddEvasion", 1), opt("AddTenacity", 2), opt("AddIntuition", 1)],
  },
  {
    room: 4,
    source: "run-2026-08-18-21-15-25/state-047",
    options: [opt("AddTenacity", 2), opt("AddEvasion", 1), opt("AddEvasion", 4)],
  },
  {
    room: 5,
    source: "run-2026-08-18-21-15-25/state-083",
    options: [opt("TieVulnerable", 1), opt("AddLuck", 1), opt("AddVulnerableShield", 2)],
  },
  // [session 43] Run 1 of the brief's two authorized bot-initiated juiced
  // Tier-3 start_run calls (TASKS.md Task 14's actual gate — the first
  // JUICED start this project's own process ever sent, not a resume) — five
  // new room-1..5 offers, in order. Died room 6.
  {
    room: 1,
    source: "run-2026-08-18-22-00-28/state-004",
    options: [opt("Heal", 50), opt("AddLifestealSword", 2), opt("AddTenacity", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-18-22-00-28/state-020",
    options: [opt("UpgradeScissor", 8), opt("AddMaxArmor", 2), opt("AddIntuition", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-18-22-00-28/state-030",
    options: [opt("AddBlock", 2), opt("AddIntuition", 1), opt("AddTenacity", 7)],
  },
  {
    room: 4,
    source: "run-2026-08-18-22-00-28/state-046",
    options: [opt("AddTenacity", 2), opt("AddLuck", 1), opt("AddEvasion", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-18-22-00-28/state-056",
    options: [opt("AddIntuition", 1), opt("WeakeningCrit", 1), opt("UpgradePaper", 0, 8)],
  },
  // [session 43] Run 2 of 2, sent after the user's own manual level-up
  // between the two runs (brief §1) — four new room-1..4 offers, in order.
  // Died room 5. First-ever pickup pair for `UpgradePaper` (picked at room
  // 4, the ATK-variant roll) — see BOON_MODELS.
  {
    room: 1,
    source: "run-2026-08-18-22-07-14/state-004",
    options: [opt("AddLuck", 1), opt("AddIntuition", 1), opt("AddMaxArmor", 8)],
  },
  {
    room: 2,
    source: "run-2026-08-18-22-07-14/state-016",
    options: [opt("CritHeal", 6), opt("AddLuck", 5), opt("AddIntuition", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-18-22-07-14/state-040",
    options: [opt("AddBlock", 2), opt("LossLuckUp", 5), opt("AddTenacity", 2)],
  },
  {
    room: 4,
    source: "run-2026-08-18-22-07-14/state-060",
    options: [opt("UpgradePaper", 8), opt("AddBlock", 2), opt("AddBlock", 7)],
  },
  // [session 52] Seven offers from a single juiced Tier-3 run that reached
  // room 8 — the first corpus sighting of a room-5, room-6 or room-7 offer
  // in one continuous run, and the first `AddMaxHealth` roll above 8.
  // Six new boon TYPES appear here with no before/after pair between them
  // (`AddBurnMagic`, `VulnerableBlock`, `BurningCrit`, `LossIntuitionUp`,
  // `AddBurnShield`, `UpgradeScissor`); per SPEC §4d they stay unmodelled and
  // fail closed rather than being inferred from their option text.
  {
    room: 1,
    source: "run-2026-08-20-00-30-50/state-007",
    options: [opt("AddBlock", 2), opt("AddMaxHealth", 14), opt("AddTenacity", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-20-00-30-50/state-019",
    options: [opt("AddBurnMagic", 5), opt("UpgradeScissor", 0, 4), opt("AddLuck", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-20-00-30-50/state-031",
    options: [opt("AddIntuition", 1), opt("AddBurnShield", 3), opt("VulnerableBlock", 4)],
  },
  {
    room: 4,
    source: "run-2026-08-20-00-30-50/state-043",
    options: [opt("UpgradeRock", 4), opt("AddBlock", 2), opt("UpgradePaper", 0, 8)],
  },
  {
    room: 5,
    source: "run-2026-08-20-00-30-50/state-059",
    options: [opt("UpgradeRock", 0, 8), opt("BurningCrit", 3), opt("AddBlock", 2)],
  },
  {
    room: 6,
    source: "run-2026-08-20-00-30-50/state-079",
    options: [opt("AddBlock", 2), opt("AddTenacity", 2), opt("AddLuck", 5)],
  },
  {
    room: 7,
    source: "run-2026-08-20-00-30-50/state-095",
    options: [opt("LossIntuitionUp", 5), opt("AddLuck", 1), opt("AddEvasion", 1)],
  },
  // [session 52] Six more offers from the SECOND juiced Tier-3 run of the
  // session (started after the user's manual level-up; died room 7). Four
  // more unmodelled types with no pair — `TieVulnerable`, `TieWeak`,
  // `Thorns`, `WeakeningTenacity` — which stay unmodelled per SPEC §4d.
  // Note room 6's `AddMaxHealth(24)`: 24 is now the largest max-HP roll in
  // the corpus, beating the 14 seen at room 1 eight hours earlier. Both were
  // offered; the room-1 one was taken.
  {
    room: 1,
    source: "run-2026-08-20-00-45-21/state-005",
    options: [opt("AddBurnSword", 5), opt("UpgradeRock", 8), opt("AddLuck", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-20-00-46-48/state-016",
    options: [opt("AddEvasion", 1), opt("TieVulnerable", 1), opt("UpgradeRock", 4)],
  },
  {
    room: 3,
    source: "run-2026-08-20-00-46-48/state-042",
    options: [opt("UpgradeScissor", 0, 6), opt("UpgradePaper", 4), opt("TieWeak", 1)],
  },
  {
    room: 4,
    source: "run-2026-08-20-00-46-48/state-052",
    options: [opt("AddLuck", 1), opt("UpgradeRock", 4), opt("TieWeak", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-20-00-46-48/state-070",
    options: [opt("Thorns", 5), opt("AddTenacity", 2), opt("AddEvasion", 1)],
  },
  {
    room: 6,
    source: "run-2026-08-20-00-46-48/state-086",
    options: [opt("WeakeningTenacity", 4), opt("UpgradeRock", 12), opt("AddMaxHealth", 24)],
  },
  // [session 53, LIVE] Twelve new offers from the two juiced Tier-3 runs.
  // Run 2 reached ROOM 10, the deepest this corpus has ever gone (prior best
  // room 8, session 52), producing this project's FIRST offers at rooms 8 and
  // 9. Rooms 8 and 9 are both entirely new depths for the boon corpus.
  {
    room: 1,
    source: "run-2026-08-20-01-34-30/state-008",
    options: [opt("AddLuck", 2), opt("AddMaxArmor", 2), opt("AddLifestealMagic", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-20-01-34-30/state-030",
    options: [opt("AddBurnShield", 3), opt("AddLifestealMagic", 2), opt("AddTenacity", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-20-01-34-30/state-048",
    options: [opt("AddBlock", 2), opt("AddWeakMagic", 2), opt("UpgradeRock", 6)],
  },
  {
    room: 1,
    source: "run-2026-08-20-01-38-22/state-006",
    options: [opt("AddLifestealMagic", 2), opt("Heal", 16), opt("AddIntuition", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-20-01-38-22/state-014",
    options: [opt("WeakeningMastery", 10), opt("UpgradeScissor", 0, 4), opt("UpgradeRock", 4)],
  },
  {
    room: 3,
    source: "run-2026-08-20-01-38-22/state-030",
    options: [opt("AddWeakShield", 2), opt("UpgradeRock", 6), opt("Vengeance", 15)],
  },
  {
    room: 4,
    source: "run-2026-08-20-01-38-22/state-040",
    options: [opt("AddBurnShield", 5), opt("RegenMastery", 1), opt("AddEvasion", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-20-01-38-22/state-048",
    options: [opt("AddBlock", 2), opt("AddTenacity", 2), opt("AddEvasion", 2)],
  },
  {
    room: 6,
    source: "run-2026-08-20-01-38-22/state-060",
    options: [opt("AddLifestealSword", 2), opt("AddLuck", 1), opt("CorrosiveMagic", 2)],
  },
  {
    room: 7,
    source: "run-2026-08-20-01-38-22/state-084",
    options: [opt("AddLuck", 1), opt("CorrosiveMagic", 2), opt("AddLifestealSword", 2)],
  },
  {
    room: 8,
    source: "run-2026-08-20-01-38-22/state-096",
    options: [opt("UpgradeScissor", 4), opt("TieWeak", 1), opt("TieVulnerable", 1)],
  },
  {
    room: 9,
    source: "run-2026-08-20-01-38-22/state-118",
    options: [opt("AddTenacity", 2), opt("AddEvasion", 1), opt("AddIntuition", 5)],
  },
  // [session 60, LIVE] The first run played under rule 8's highest-tier flip
  // and the wide orb rule. Two of these four offers produced first-ever
  // pickup pairs (`WeakeningTenacity`, `BurningBlock` — see BOON_MODELS), both
  // because the orb rule took the richest Hard Core payout where no priority
  // family was on offer. The ranked policy had passed over both for 134 offers.
  {
    room: 1,
    source: "run-2026-08-20-18-19-07/state-005",
    options: [opt("AddIntuition", 1), opt("UpgradeScissor", 0, 6), opt("WeakeningTenacity", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-20-18-19-07/state-013",
    options: [opt("AddIntuition", 1), opt("CorrosiveMagic", 2), opt("AddBurnSword", 3)],
  },
  {
    room: 3,
    source: "run-2026-08-20-18-19-07/state-033",
    options: [opt("AddEvasion", 5), opt("AddBlock", 7), opt("BurningBlock", 8)],
  },
  {
    room: 4,
    source: "run-2026-08-20-18-19-07/state-041",
    options: [opt("UpgradePaper", 0, 8), opt("AddLuck", 1), opt("AddIntuition", 2)],
  },
  // [session 61, LIVE] Four offers from the session's one juiced Tier-3 run
  // (24945829, died room 5). Room 4's is the one that matters: `TieVulnerable`
  // at 16 orbs was taken over `UpgradePaper` at 25, because the boon-priority
  // directive's Vulnerable family outranks the orb rule — the load-bearing
  // case where the wide orb rule correctly declines to override a priority
  // match, and the pickup that finally gave `TieVulnerable` a pair after nine
  // sessions as an offered-but-declined sighting. Room 2's `AddLifestealShield`
  // was demoted by the early-game lifesteal window (rooms 1..8) and `AddLuck`
  // took it on orbs, 23 over 16/18.
  {
    room: 1,
    source: "run-2026-08-20-20-04-37/state-008",
    options: [opt("UpgradePaper", 6), opt("AddIntuition", 1), opt("AddEvasion", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-20-20-04-37/state-024",
    options: [opt("AddLifestealShield", 2), opt("AddLuck", 1), opt("WeakeningCrit", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-20-20-04-37/state-042",
    options: [opt("UpgradeRock", 0, 8), opt("WeakeningMastery", 10), opt("AddBurnMagic", 3)],
  },
  {
    room: 4,
    source: "run-2026-08-20-20-04-37/state-062",
    options: [opt("TieVulnerable", 1), opt("AddIntuition", 1), opt("UpgradePaper", 0, 8)],
  },
  // ---- [session 62, LIVE] run 1 of 2, 24949925, died room 7 ---------------
  // Six offers, rooms 1-6. Two of them (WeakeningCrit room 1, AddBurnMagic
  // room 4) produced this corpus's FIRST pickup pairs for those types, both
  // via the ORB FALLBACK rule.
  {
    room: 1,
    source: "run-2026-08-20-22-41-47/state-005",
    options: [opt("WeakeningCrit", 1), opt("AddLuck", 1), opt("AddTenacity", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-20-22-41-47/state-017",
    options: [opt("AddBurnShield", 3), opt("WeakeningTenacity", 4), opt("UpgradeRock", 6)],
  },
  {
    room: 3,
    source: "run-2026-08-20-22-41-47/state-033",
    options: [opt("AddMaxArmor", 8), opt("AddLuck", 1), opt("Regen", 3)],
  },
  {
    room: 4,
    source: "run-2026-08-20-22-41-47/state-047",
    options: [opt("AddBurnMagic", 3), opt("Regen", 1), opt("AddIntuition", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-20-22-41-47/state-069",
    options: [opt("AddBurnSword", 3), opt("AddEvasion", 1), opt("AddLuck", 1)],
  },
  {
    room: 6,
    source: "run-2026-08-20-22-41-47/state-085",
    options: [opt("UpgradeScissor", 0, 4), opt("AddTenacity", 2), opt("UpgradePaper", 4)],
  },
  // ---- [session 62, LIVE] run 2 of 2, 24949982, died room 7 ---------------
  // Six more, rooms 1-6. Three FIRST pairs: SecondWind and Vengeance via the
  // ORB FALLBACK rule, AddVulnerableMagic via the BOON-PRIORITY rule (Vulnerable
  // family) — the same split §5 is instrumenting, and it landed 4-orb/1-priority
  // across the two runs.
  {
    room: 1,
    source: "run-2026-08-20-22-46-26/state-005",
    options: [opt("SecondWind", 10), opt("LossBlockUp", 5), opt("AddBlock", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-20-22-46-26/state-027",
    options: [opt("UpgradePaper", 0, 6), opt("AddIntuition", 10), opt("Heal", 16)],
  },
  {
    room: 3,
    source: "run-2026-08-20-22-46-26/state-035",
    options: [opt("AddTenacity", 2), opt("AddBurnSword", 3), opt("LossBlockUp", 5)],
  },
  {
    room: 4,
    source: "run-2026-08-20-22-46-26/state-051",
    options: [opt("UpgradeRock", 4), opt("AddEvasion", 1), opt("AddIntuition", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-20-22-46-26/state-065",
    options: [opt("CorrosiveShield", 2), opt("AddLuck", 1), opt("AddVulnerableMagic", 2)],
  },
  {
    room: 6,
    source: "run-2026-08-20-22-46-26/state-087",
    options: [opt("AddTenacity", 2), opt("AddTenacity", 7), opt("Vengeance", 15)],
  },
  // ── [session 75, LIVE] the four juiced runs of 2026-08-22 ──────────────
  //
  // 26 new offers across four runs, the largest single-session addition this
  // table has had. GENERATED from the fixtures rather than transcribed by hand
  // — the entries above were hand-written and the count had reached the size
  // where transcription is the likelier error source than the capture is.
  // Run 3 reached room 9, so the deepest offer in the table moves with it.
  {
    room: 1,
    source: "run-2026-08-22-03-51-44/state-005",
    options: [opt("AddLifestealShield", 2), opt("AddLuck", 1), opt("CorrosiveMagic", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-22-03-51-44/state-023",
    options: [opt("AddEvasion", 1), opt("AddIntuition", 1), opt("AddLuck", 5)],
  },
  {
    room: 3,
    source: "run-2026-08-22-03-51-44/state-043",
    options: [opt("AddIntuition", 1), opt("RegenMastery", 1), opt("AddTenacity", 2)],
  },
  {
    room: 4,
    source: "run-2026-08-22-03-51-44/state-057",
    options: [opt("AddMaxArmor", 4), opt("AddLifestealSword", 2), opt("LossBlockUp", 5)],
  },
  {
    room: 5,
    source: "run-2026-08-22-03-51-44/state-077",
    options: [opt("AddLuck", 1), opt("CorrosiveMagic", 2), opt("AddEvasion", 2)],
  },
  {
    room: 1,
    source: "run-2026-08-22-04-00-32/state-005",
    options: [opt("CorrosiveSword", 2), opt("CorrosiveMagic", 2), opt("AddIntuition", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-22-04-00-32/state-023",
    options: [opt("LossIntuitionUp", 5), opt("CorrosiveSword", 2), opt("UpgradePaper", 4)],
  },
  {
    room: 3,
    source: "run-2026-08-22-04-00-32/state-035",
    options: [opt("AddLuck", 1), opt("AddLifestealShield", 2), opt("AddTenacity", 3)],
  },
  {
    room: 4,
    source: "run-2026-08-22-04-00-32/state-043",
    options: [opt("AddBurnMagic", 5), opt("AddMaxArmor", 8), opt("UpgradeScissor", 12)],
  },
  {
    room: 5,
    source: "run-2026-08-22-04-00-32/state-061",
    options: [opt("AddLifestealMagic", 2), opt("AddMaxHealth", 14), opt("CorrosiveShield", 2)],
  },
  {
    room: 6,
    source: "run-2026-08-22-04-00-32/state-075",
    options: [opt("WeakeningEvade", 4), opt("AddLuck", 1), opt("AddBlock", 7)],
  },
  {
    room: 1,
    source: "run-2026-08-22-04-12-49/state-009",
    options: [opt("AddTenacity", 2), opt("AddBlock", 2), opt("AddIntuition", 1)],
  },
  {
    room: 2,
    source: "run-2026-08-22-04-12-49/state-023",
    options: [opt("AddIntuition", 10), opt("UpgradePaper", 4), opt("UpgradeRock", 0, 4)],
  },
  {
    room: 3,
    source: "run-2026-08-22-04-12-49/state-039",
    options: [opt("AddBlock", 2), opt("UpgradeRock", 0, 8), opt("AddIntuition", 1)],
  },
  {
    room: 4,
    source: "run-2026-08-22-04-12-49/state-057",
    options: [opt("WeakeningTenacity", 4), opt("AddBlock", 2), opt("UpgradePaper", 6)],
  },
  {
    room: 5,
    source: "run-2026-08-22-04-12-49/state-073",
    options: [opt("CorrosiveSword", 2), opt("AddWeakMagic", 2), opt("AddMaxHealth", 14)],
  },
  {
    room: 6,
    source: "run-2026-08-22-04-12-49/state-105",
    options: [opt("AddWeakSword", 2), opt("AddEvasion", 5), opt("Heal", 16)],
  },
  {
    room: 7,
    source: "run-2026-08-22-04-12-49/state-123",
    options: [opt("AddBlock", 2), opt("SecondWind", 10), opt("AddIntuition", 5)],
  },
  {
    room: 8,
    source: "run-2026-08-22-04-12-49/state-135",
    options: [opt("AddLuck", 1), opt("AddVulnerableShield", 2), opt("Vengeance", 25)],
  },
  {
    room: 1,
    source: "run-2026-08-22-04-27-03/state-005",
    options: [opt("UpgradeRock", 4), opt("UpgradePaper", 6), opt("AddBlock", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-22-04-27-03/state-021",
    options: [opt("AddWeakSword", 2), opt("AddLuck", 1), opt("Thorns", 4)],
  },
  {
    room: 3,
    source: "run-2026-08-22-04-27-03/state-031",
    options: [opt("Regen", 2), opt("AddMaxArmor", 8), opt("UpgradeRock", 4)],
  },
  {
    room: 4,
    source: "run-2026-08-22-04-27-03/state-053",
    options: [opt("BurningCrit", 3), opt("AddEvasion", 2), opt("AddMaxHealth", 14)],
  },
  {
    room: 5,
    source: "run-2026-08-22-04-27-03/state-073",
    options: [opt("AddEvasion", 10), opt("AddMaxArmor", 2), opt("AddLifestealShield", 3)],
  },
  {
    room: 6,
    source: "run-2026-08-22-04-27-03/state-089",
    options: [opt("AddMaxHealth", 8), opt("AddEvasion", 10), opt("AddBurnShield", 3)],
  },
  {
    room: 7,
    source: "run-2026-08-22-04-27-03/state-115",
    options: [opt("UpgradeRock", 4), opt("Heal", 16), opt("AddEvasion", 1)],
  },

  // [session 82, LIVE] 21 offers from the day's FOUR juiced runs, taking the
  // table 181 -> 202. Deaths at rooms 8, 3, 7 and 7, so no offer here is
  // deeper than room 7 and the room-9 ceiling below is untouched.
  //
  // Two of these produced first-ever PICKUP pairs (TieWeak, VulnerableBlock —
  // see BOON_MODELS), and one carries a first-ever TYPE: LossEvasionUp, which
  // had never appeared in any offer at any depth before run 1.
  {
    room: 1,
    source: "run-2026-08-23-05-18-39/state-007",
    options: [opt("AddLuck", 1), opt("AddTenacity", 2), opt("AddMaxArmor", 8)],
  },
  {
    room: 2,
    source: "run-2026-08-23-05-18-39/state-017",
    options: [opt("AddTenacity", 5), opt("UpgradeRock", 0, 8), opt("CorrosiveSword", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-23-05-18-39/state-031",
    options: [opt("AddBlock", 12), opt("AddBlock", 3), opt("AddWeakShield", 2)],
  },
  {
    room: 4,
    source: "run-2026-08-23-05-18-39/state-051",
    options: [opt("CorrosiveMagic", 2), opt("AddEvasion", 1), opt("AddLuck", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-23-05-18-39/state-077",
    options: [opt("AddBurnMagic", 3), opt("AddLuck", 5), opt("WeakeningMastery", 10)],
  },
  {
    room: 6,
    source: "run-2026-08-23-05-18-39/state-089",
    options: [opt("AddLuck", 10), opt("BurningEvade", 8), opt("AddLuck", 1)],
  },
  {
    room: 7,
    source: "run-2026-08-23-05-18-39/state-105",
    options: [opt("AddEvasion", 2), opt("LossEvasionUp", 5), opt("AddLifestealShield", 4)],
  },
  {
    room: 1,
    source: "run-2026-08-23-05-35-28/state-005",
    options: [opt("TieWeak", 1), opt("AddIntuition", 1), opt("SecondWind", 5)],
  },
  {
    room: 2,
    source: "run-2026-08-23-05-35-28/state-039",
    options: [opt("CorrosiveShield", 2), opt("UpgradePaper", 0, 4), opt("AddLifestealShield", 4)],
  },
  {
    room: 1,
    source: "run-2026-08-23-05-45-51/state-005",
    options: [opt("WeakeningBlock", 4), opt("AddEvasion", 1), opt("VulnerableBlock", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-23-05-45-51/state-023",
    options: [opt("AddLifestealShield", 2), opt("AddLuck", 1), opt("UpgradePaper", 8)],
  },
  {
    room: 3,
    source: "run-2026-08-23-05-45-51/state-045",
    options: [opt("AddEvasion", 1), opt("UpgradeScissor", 0, 4), opt("AddTenacity", 7)],
  },
  {
    room: 4,
    source: "run-2026-08-23-05-45-51/state-079",
    options: [opt("Vengeance", 25), opt("AddLuck", 5), opt("Heal", 50)],
  },
  {
    room: 5,
    source: "run-2026-08-23-05-45-51/state-097",
    options: [opt("AddIntuition", 1), opt("AddTenacity", 2), opt("AddLuck", 4)],
  },
  {
    room: 6,
    source: "run-2026-08-23-05-45-51/state-119",
    options: [opt("SecondWind", 10), opt("AddIntuition", 2), opt("AddLifestealShield", 2)],
  },
  {
    room: 1,
    source: "run-2026-08-23-05-53-49/state-013",
    options: [opt("AddLuck", 1), opt("AddIntuition", 1), opt("LossLuckUp", 5)],
  },
  {
    room: 2,
    source: "run-2026-08-23-05-53-49/state-021",
    options: [opt("AddBurnMagic", 3), opt("SecondWind", 10), opt("AddEvasion", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-23-05-53-49/state-039",
    options: [opt("AddLuck", 1), opt("AddMaxHealth", 8), opt("AddBlock", 2)],
  },
  {
    room: 4,
    source: "run-2026-08-23-05-53-49/state-055",
    options: [opt("TieWeak", 1), opt("CorrosiveShield", 2), opt("AddIntuition", 1)],
  },
  {
    room: 5,
    source: "run-2026-08-23-05-53-49/state-071",
    options: [opt("AddBurnShield", 3), opt("AddBlock", 2), opt("AddLuck", 1)],
  },
  {
    room: 6,
    source: "run-2026-08-23-05-53-49/state-085",
    options: [opt("BurningEvade", 8), opt("AddLuck", 2), opt("AddBlock", 12)],
  },
  // ── [session 93 §3] TWENTY-FIVE OFFERS, FROM FOUR RUNS ON 2026-08-24 ─────
  //
  // Regenerated from the corpus, not typed: `tests/boons.test.ts`'s
  // `OBSERVED_OFFERS` assertion had been red since session 89 and was declined
  // as inert by sessions 89, 90 and 91 — correctly, each time, since nothing
  // downstream of this table was wrong. What none of those declines noted is
  // that it had become the SOLE blocker on `scripts/assertionCoverage.ts` and
  // `scripts/preflight.ts`, both of which fail closed on a red suite. That is
  // why it is landed now.
  //
  // ⚠ **The drift is purely ADDITIVE and the depth claim is UNCHANGED.** The
  // diff against the corpus was 25 rows in the corpus and absent here, and
  // ZERO rows here and absent from the corpus — so nothing was ever wrong,
  // only incomplete. The deepest offer is still room 9 (session 53's run), the
  // deepest of these is room 8, and the invariant the pin encodes — offers
  // stop one room short of the deepest death — was re-checked before
  // regenerating rather than assumed. Runs: `run-2026-08-24-00-14-01`,
  // `-00-49-12`, `-00-56-03`, `-01-04-21`.
  {
    room: 1,
    source: "run-2026-08-24-00-14-01/state-005",
    options: [opt("AddLuck", 1), opt("AddBlock", 2), opt("Thorns", 5)],
  },
  {
    room: 2,
    source: "run-2026-08-24-00-14-01/state-027",
    options: [opt("AddBurnShield", 3), opt("UpgradeScissor", 0, 6), opt("AddIntuition", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-24-00-14-01/state-041",
    options: [opt("AddMaxHealth", 8), opt("AddLuck", 4), opt("AddMaxArmor", 10)],
  },
  {
    room: 4,
    source: "run-2026-08-24-00-14-01/state-059",
    options: [opt("AddEvasion", 4), opt("WeakeningMastery", 10), opt("AddLifestealShield", 2)],
  },
  {
    room: 5,
    source: "run-2026-08-24-00-14-01/state-075",
    options: [opt("AddMaxHealth", 8), opt("Regen", 2), opt("BurningBlock", 8)],
  },
  {
    room: 6,
    source: "run-2026-08-24-00-14-01/state-095",
    options: [opt("AddIntuition", 1), opt("AddIntuition", 10), opt("VulnerableEvade", 4)],
  },
  {
    room: 7,
    source: "run-2026-08-24-00-14-01/state-119",
    options: [opt("AddVulnerableMagic", 2), opt("AddBlock", 2), opt("UpgradeScissor", 8)],
  },
  {
    room: 1,
    source: "run-2026-08-24-00-49-12/state-005",
    options: [opt("AddIntuition", 1), opt("AddTenacity", 2), opt("WeakeningMastery", 10)],
  },
  {
    room: 2,
    source: "run-2026-08-24-00-49-12/state-021",
    options: [opt("UpgradeScissor", 12), opt("AddEvasion", 10), opt("CorrosiveMagic", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-24-00-49-12/state-037",
    options: [opt("AddBlock", 7), opt("Vengeance", 25), opt("AddIntuition", 2)],
  },
  {
    room: 4,
    source: "run-2026-08-24-00-49-12/state-051",
    options: [opt("SecondWind", 5), opt("AddEvasion", 5), opt("VulnerableBlock", 4)],
  },
  {
    room: 5,
    source: "run-2026-08-24-00-49-12/state-073",
    options: [opt("AddLuck", 2), opt("AddBurnMagic", 5), opt("AddLifestealSword", 2)],
  },
  {
    room: 6,
    source: "run-2026-08-24-00-49-12/state-101",
    options: [opt("AddBlock", 2), opt("CorrosiveSword", 2), opt("AddTenacity", 2)],
  },
  {
    room: 1,
    source: "run-2026-08-24-00-56-03/state-009",
    options: [opt("CorrosiveMagic", 2), opt("AddIntuition", 2), opt("AddBlock", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-24-00-56-03/state-033",
    options: [opt("AddLuck", 1), opt("AddIntuition", 5), opt("AddWeakSword", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-24-00-56-03/state-059",
    options: [opt("TieVulnerable", 1), opt("AddBlock", 3), opt("AddIntuition", 4)],
  },
  {
    room: 4,
    source: "run-2026-08-24-00-56-03/state-081",
    options: [opt("CorrosiveSword", 2), opt("VulnerableBlock", 4), opt("UpgradeScissor", 4)],
  },
  {
    room: 1,
    source: "run-2026-08-24-01-04-21/state-005",
    options: [opt("AddBlock", 2), opt("AddLifestealShield", 3), opt("UpgradeRock", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-24-01-04-21/state-017",
    options: [opt("RegenMastery", 1), opt("AddBlock", 2), opt("AddMaxHealth", 14)],
  },
  {
    room: 3,
    source: "run-2026-08-24-01-04-21/state-031",
    options: [opt("UpgradeScissor", 0, 6), opt("AddBurnMagic", 3), opt("AddIntuition", 5)],
  },
  {
    room: 4,
    source: "run-2026-08-24-01-04-21/state-043",
    options: [opt("UpgradeScissor", 0, 8), opt("BurningTenacity", 8), opt("AddIntuition", 5)],
  },
  {
    room: 5,
    source: "run-2026-08-24-01-04-21/state-053",
    options: [opt("AddTenacity", 7), opt("AddBlock", 2), opt("SecondWind", 10)],
  },
  {
    room: 6,
    source: "run-2026-08-24-01-04-21/state-075",
    options: [opt("AddMaxArmor", 4), opt("UpgradeScissor", 4), opt("UpgradeRock", 0, 8)],
  },
  {
    room: 7,
    source: "run-2026-08-24-01-04-21/state-105",
    options: [opt("AddLuck", 1), opt("AddBurnShield", 3), opt("AddVulnerableSword", 2)],
  },
  {
    room: 8,
    source: "run-2026-08-24-01-04-21/state-123",
    options: [opt("AddBurnShield", 3), opt("BurningBlock", 8), opt("AddLifestealShield", 3)],
  },
  // ── [session 95 §B] TWENTY-TWO OFFERS, FROM FOUR JUICED RUNS ON 2026-08-25 ─
  //
  // Generated from the corpus and APPENDED, not typed and not regenerated
  // wholesale — session 93's precedent, for its reason: this table carries
  // per-entry historical annotations going back to session 03, and a wholesale
  // rewrite would throw them away to save nothing.
  //
  // ⚠ **ADDITIVITY WAS VERIFIED BEFORE THE APPEND, NOT ASSUMED FROM IT.** The
  // multiset diff against the corpus was **22 rows in the corpus and absent
  // here, and ZERO rows here and absent from the corpus** — the table was
  // incomplete, never wrong. Session 94 handed this off explicitly UNVERIFIED
  // and said so; the check is cheap and is the whole reason a stale table can
  // be trusted to be stale rather than corrupt.
  //
  // **The room-max pin is UNCHANGED at 9.** The deepest of these 22 is room 7
  // (the four runs died at rooms 8, 4, 7, 7), well short of session 53's
  // room-9 offer, so `Math.max(...OBSERVED_OFFERS.map(o => o.room))` still
  // reads 9 and the "offers stop one room short of the deepest death"
  // invariant is untouched. Re-checked against the corpus rather than assumed.
  //
  // Runs: `run-2026-08-25-03-07-57`, `-03-14-16`, `-03-25-26`, `-03-30-48`.
  {
    room: 1,
    source: "run-2026-08-25-03-07-57/state-005",
    options: [opt("AddIntuition", 1), opt("AddEvasion", 1), opt("CorrosiveMagic", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-25-03-07-57/state-025",
    options: [opt("TieWeak", 1), opt("WeakeningCrit", 1), opt("AddTenacity", 2)],
  },
  {
    room: 3,
    source: "run-2026-08-25-03-07-57/state-041",
    options: [opt("AddLuck", 2), opt("VulnerableEvade", 4), opt("UpgradePaper", 4)],
  },
  {
    room: 4,
    source: "run-2026-08-25-03-07-57/state-057",
    options: [opt("RegenMastery", 1), opt("AddMaxArmor", 4), opt("AddIntuition", 5)],
  },
  {
    room: 5,
    source: "run-2026-08-25-03-07-57/state-073",
    options: [opt("AddLuck", 1), opt("AddBlock", 2), opt("UpgradePaper", 0, 4)],
  },
  {
    room: 6,
    source: "run-2026-08-25-03-07-57/state-095",
    options: [opt("Regen", 2), opt("CorrosiveSword", 2), opt("Heal", 50)],
  },
  {
    room: 7,
    source: "run-2026-08-25-03-07-57/state-107",
    options: [opt("AddTenacity", 2), opt("AddBlock", 7), opt("AddBurnMagic", 3)],
  },
  {
    room: 1,
    source: "run-2026-08-25-03-14-16/state-005",
    options: [opt("AddBurnShield", 3), opt("SecondWind", 5), opt("AddBlock", 2)],
  },
  {
    room: 2,
    source: "run-2026-08-25-03-14-16/state-021",
    options: [opt("UpgradeRock", 0, 4), opt("AddMaxArmor", 2), opt("BurningEvade", 8)],
  },
  {
    room: 3,
    source: "run-2026-08-25-03-14-16/state-055",
    options: [opt("AddIntuition", 1), opt("AddEvasion", 2), opt("AddMaxArmor", 4)],
  },
  {
    room: 1,
    source: "run-2026-08-25-03-25-26/state-009",
    options: [opt("AddTenacity", 3), opt("AddIntuition", 1), opt("UpgradeScissor", 4)],
  },
  {
    room: 2,
    source: "run-2026-08-25-03-25-26/state-021",
    options: [opt("SecondWind", 5), opt("RegenMastery", 1), opt("AddIntuition", 10)],
  },
  {
    room: 3,
    source: "run-2026-08-25-03-25-26/state-039",
    options: [opt("SecondWind", 10), opt("AddEvasion", 4), opt("AddEvasion", 5)],
  },
  {
    room: 4,
    source: "run-2026-08-25-03-25-26/state-051",
    options: [opt("LossBlockUp", 5), opt("AddLuck", 5), opt("AddMaxArmor", 2)],
  },
  {
    room: 5,
    source: "run-2026-08-25-03-25-26/state-069",
    options: [opt("RegenMastery", 1), opt("CorrosiveSword", 2), opt("Vengeance", 25)],
  },
  {
    room: 6,
    source: "run-2026-08-25-03-25-26/state-081",
    options: [opt("AddEvasion", 1), opt("AddVulnerableSword", 2), opt("UpgradeRock", 0, 8)],
  },
  {
    room: 1,
    source: "run-2026-08-25-03-30-48/state-009",
    options: [opt("AddWeakMagic", 2), opt("AddBlock", 2), opt("UpgradePaper", 0, 4)],
  },
  {
    room: 2,
    source: "run-2026-08-25-03-30-48/state-021",
    options: [opt("CorrosiveMagic", 2), opt("AddTenacity", 2), opt("AddEvasion", 1)],
  },
  {
    room: 3,
    source: "run-2026-08-25-03-30-48/state-035",
    options: [opt("Vengeance", 25), opt("TieVulnerable", 1), opt("AddBurnShield", 3)],
  },
  {
    room: 4,
    source: "run-2026-08-25-03-30-48/state-055",
    options: [opt("AddLifestealSword", 2), opt("VulnerableCrit", 1), opt("UpgradePaper", 4)],
  },
  {
    room: 5,
    source: "run-2026-08-25-03-30-48/state-073",
    options: [opt("UpgradeScissor", 4), opt("AddLuck", 1), opt("WeakeningCrit", 1)],
  },
  {
    room: 6,
    source: "run-2026-08-25-03-30-48/state-105",
    options: [opt("AddBlock", 2), opt("Regen", 1), opt("AddLuck", 2)],
  },
];

export const offersForRoom = (room: number): BoonOffer[] =>
  OBSERVED_OFFERS.filter((o) => o.room === room);

/** Boon types the corpus has offered but never shows the effect of. */
export const UNMODELLED_TYPES: string[] = [
  ...new Set(
    OBSERVED_OFFERS.flatMap((o) => o.options.map((x) => x.type)).filter((t) => !BOON_MODELS[t]),
  ),
].sort();
