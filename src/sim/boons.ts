/**
 * src/sim/boons.ts — boons as state deltas, derived from before/after pairs.
 *
 * Task 4.5. The rule from the session-05 brief §3, held to strictly:
 *
 *   A boon is modelled ONLY if the corpus contains a state pair bracketing its
 *   pickup. Nothing is inferred from the option text. `UpgradePaper` almost
 *   certainly adds 4 to Shield — its name says so and its `selectedVal2` is 4 —
 *   and it is NOT modelled here, because nobody ever picked it and no recorded
 *   state shows what moved.
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
 * comment, for the current total.] No room-4+ offer exists — the deepest run
 * has died in room 4 without clearing it, so there is nothing past room 3.
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
];

export const offersForRoom = (room: number): BoonOffer[] =>
  OBSERVED_OFFERS.filter((o) => o.room === room);

/** Boon types the corpus has offered but never shows the effect of. */
export const UNMODELLED_TYPES: string[] = [
  ...new Set(
    OBSERVED_OFFERS.flatMap((o) => o.options.map((x) => x.type)).filter((t) => !BOON_MODELS[t]),
  ),
].sort();
