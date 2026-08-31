/**
 * src/sim/enemies.ts — combatant profiles observed in the corpus, keyed by
 * (room, tier).
 *
 * Every number here was read off a recorded `/game/dungeon/state` response, not
 * from SPEC. `tests/enemies.test.ts` re-derives them from the fixtures and
 * fails if this file drifts.
 *
 * Rooms 1-5 of Forbidden Woods (dungeon 5, `maxRoom` 16). Enemy names are
 * `"Enemy Room 63"` etc, where 63 is `ENEMY_CID` — NOT the room number
 * (SPEC §3c). Room 6+ has never been reached, so the sim marks any run that
 * gets there DEPTH_BEYOND_CORPUS rather than extrapolating the scaling curve.
 * [session 20, LIVE] Room 5 (enemy 67) is a first-ever capture — the
 * orchestrator's own potion-wiring smoke test cleared rooms 1-4 and reached
 * room 5 for the first time in this project's history. Safe-tier, clean.
 *
 * **Tier is a property of the ENCOUNTER, not the enemy (SPEC §3e).** Base
 * combat stats (hp/armor/move ATK/DEF/charges) are identical across tiers of
 * the same enemy id — confirmed here across all three captured tiers of enemy
 * 64. Only `rolledEnemyStats` and `enemyBuff` vary by tier, and tier 0
 * ("Safe") is the only one ever observed with both empty.
 *
 * [session 07] `ROOM_ENEMIES` was previously a flat array, one profile per
 * room, with rooms 3 and 4 commented as "Dangerous-tier instances" on the
 * theory that the user was picking high tiers. Re-deriving tier from the
 * corpus (matching each room's `enemyPathOptions[]` against the resulting
 * post-pick state) shows that comment was wrong on the specifics for BOTH
 * rooms:
 *
 *   - Room 3 (enemy 65)'s one capture is tier 1 ("Risky"), not tier 2.
 *   - Room 4 (enemy 66)'s one capture is tier 0 ("Safe"), not Dangerous — its
 *     `enemyBuff` is `null` throughout, matching the Safe pick exactly.
 *
 * The `shatterblade` buff ("Applies 1 Vulnerable on Sword wins") belongs to
 * the room-3 pick, not room 4 as previously written. And room 4's recorded
 * Burn status effect is NOT an enemy-side mechanic at all: `activeEnemyBuff`
 * is `null` for the whole battle, but the player's `pickedBoons` for that run
 * include `AddBurnSword` (picked at the room-3->4 reward phase) — the Burn is
 * the PLAYER's own boon landing on the enemy, already the concern of
 * `src/sim/boons.ts` / the `BURN_PER_EXCHANGE` flag, not a property of this
 * enemy or this tier. The room-4 Safe-tier profile below is therefore CLEAN.
 *
 * [session 08, LIVE] Room 3's Safe-tier gap — the one thing session 06/07
 * left open — is closed. The bot played room 3 live (not a supervised human
 * capture) and the resulting enemy-65 state has all rolled stats zero and
 * both buff fields null. `MAX_SAFE_ROOM` is now 4, not 2.
 */

import type { Reason } from "./coverage.js";
import { noRolled, type Combatant, type RolledStats } from "./types.js";

const mv = (atk: number, def: number, maxCharges = 3) => ({
  atk,
  def,
  charges: maxCharges,
  maxCharges,
});

/** Rolled stats read from `.current`. `.starting` is 0 even when current is 2. */
const rolled = (r: Partial<RolledStats> = {}): RolledStats => ({ ...noRolled(), ...r });

/** `enemyPathOptions[].tier` values, named per SPEC §3e's `tierName`. */
export const SAFE_TIER = 0;
export const RISKY_TIER = 1;
export const DANGEROUS_TIER = 2;

/**
 * The user's loadout as recorded in the MOST RECENT capture. HP/armor maxima sit
 * above the base 30/12 because of gear, so these are the live values, not the
 * class defaults.
 *
 * **This drifts.** `armorMax` was 15 through sessions 03–05, 16 as of
 * run-2026-08-14-03-26-57, and `hpMax` moved 32 → 34 as of session 11's
 * newest capture (run-2026-08-15-15-38-09), then 34 → 36 as of session 13's
 * (run-2026-08-15-20-44-28), then 36 → 38 as of session 19's
 * (run-2026-08-17-01-23-21) — the user leveled again; `armorMax` (16) and
 * every move's ATK/DEF held steady this time, same as the 34→36 move. The
 * corpus therefore contains more than one loadout, and
 * `tests/enemies.test.ts` pins this to the newest one and reports how many
 * distinct loadouts it can see, so the drift is visible rather than silently
 * biasing every armor-fraction number in the sim.
 *
 * [session 11, live] `rock` (Sword) moved from ATK 16/DEF 0 to ATK 20/DEF 4;
 * `scissor` (Spell) moved from ATK 16/DEF 12 BACK DOWN to ATK 12/DEF 8 — a
 * gear re-spec from Spell-favoring to Sword-favoring between session 09 and
 * this session, not monotonic growth. `paper` (Shield) unchanged at 6/12.
 * Confirmed against the newest unbooned capture's `currentATK`/`currentDEF`
 * (run-2026-08-15-15-38-09/state-000.json). This only updates the OFFLINE
 * sim's baseline (`scripts/sim.ts`) — the live loop itself never used this
 * constant; `buildBattleState`/`toCombatant` already read `currentATK`/
 * `currentDEF` straight off each poll's wire response, so live play picked
 * up the gear change automatically, with no code change needed there.
 *
 * Consequence for cross-session comparisons: a baseline measured at one
 * loadout is not strictly comparable to another — scissor in particular
 * moved non-monotonically (12/8 → 16/12 → 12/8). Re-measure both sides of any
 * comparison in the same run rather than quoting a number from an old recap.
 */
/**
 * [session 23] Updated to the newest unbooned capture
 * (run-2026-08-17-17-03-45's chronologically-last empty-`pickedBoons` state):
 * hpMax 38 → 42 (+4, matches two `IncreaseMaxHealth amount 2` OnStartDungeon
 * gear effects now present), rock (Sword) 20/4 → 16/0 (the +4/+4 gear boost
 * is GONE — a real re-spec, not a regression), scissor (Spell) 12/8 → 18/13
 * (a NEW +6 ATK / +5 DEF OnStartDungeon gear boost, matching
 * `IncreaseDamage_Spell`/`IncreaseArmor_Spell` effects in the wire capture).
 * `paper` (Shield) and `armorMax` unchanged. Same non-monotonic gear-respec
 * pattern as session 15 — re-measure any cross-session comparison rather
 * than quoting an older number.
 *
 * [session 42, first update] Updated to the newest unbooned capture (the
 * resumed juiced Tier-3 run's own state-000, `pickedBoons: []`, TASKS.md
 * Task 14 §0): hpMax 42 → 43 (+1), armorMax 16 → 17 (+1), scissor (Spell)
 * DEF 13 → 15 (+2, ATK unchanged at 18) — a gear change between sessions,
 * not a regen/boon effect (this state has zero picked boons). `rock`/
 * `paper` unchanged.
 *
 * [session 42, SECOND update, same session] A second manually-started
 * juiced run (Tier-2, silver rings) captured minutes later shows hpMax
 * 43 → 38, armorMax unchanged at 17, rock (Sword) ATK 16 → 26 / DEF 0 → 9
 * (a NEW gear boost), scissor (Spell) ATK/DEF 18/15 → 12/8 (the boost from
 * the FIRST update is GONE — back to its unboosted base). CONFIRMED
 * user-stated: an ordinary armor re-spec between the two manual starts, NOT
 * anything tied to the entry tier — same non-monotonic gear-respec pattern
 * as sessions 15/23, just compressed to within one session.
 *
 * [session 43] Updated to the newest unbooned capture (the second
 * bot-initiated juiced Tier-3 run's own state-000, TASKS.md Task 14 §0/§1):
 * hpMax 38 → 40 (+2), armorMax and every move's ATK/DEF unchanged from
 * session 42's second update. Session-43 brief §1's plan was a level-up
 * BETWEEN run 1 and run 2, using run 1's own Dendren Root — but run 1's own
 * state-000 (run-2026-08-18-22-00-28) already reads hpMax 40, the SAME as
 * run 2's, meaning the level-up had already landed before this session's
 * run 1 even started (most plausibly using Dendren Root left over from
 * session 42's two runs), not between this session's two runs as the brief
 * anticipated. Recorded as observed fact, not silently folded into the
 * brief's assumed narrative — see the session-43 recap.
 */
export const PLAYER: Combatant = {
  id: "player",
  // [session 103] TWO gear changes on 2026-08-27, updated to the newest
  // unbooned capture (run 4's own state-000, cid 25128104, `pickedBoons: []`).
  // Read off the wire, never inferred:
  //
  //   before run 1  hpMax 40 -> 45, armorMax 22 -> 20, Sword DEF 8 -> 9,
  //                 Shield DEF 15 -> 16 (Spell untouched)
  //   between run 3 and run 4  hpMax 45 -> 50, armorMax 20 -> 17 (every move
  //                 untouched)
  //
  // Both steps trade ARMOR for HEALTH, which is the first time this table has
  // recorded a re-spec moving consistently in one direction across two steps.
  // The account also carried 11,111 unspent skill XP at level 15 all session
  // (`entryWarnings.unspentSkillXp`), so a level-up is a plausible cause of the
  // second step and is NOT asserted here — hpMax +5 with armorMax -3 is not
  // the shape a pure level-up makes, and nothing in the capture distinguishes
  // gear from level.
  //
  // ⚠ **Runs 1-3 and run 4 of 2026-08-27 are therefore NOT the same arm**, and
  // neither is any of them the same arm as 2026-08-26's four runs. Nothing may
  // read depth or Hard Core across those groups as a strategy effect. Exactly
  // the trap the session-75 note below records, and the sessions 42/43 one
  // below that.
  hp: 50,
  hpMax: 50,
  // [session 75] ARMOR RE-SPEC, user-stated in chat between run 3 and run 4 of
  // 2026-08-22 and captured from run 4's own `start_run` (cid 24983279). Read
  // off the wire, not inferred: armorMax 17 -> 22, block 8 -> 10, Shield gains
  // (+4 ATK, +3 DEF) and Sword gives back one of each. Spell is untouched.
  //
  // **Runs 1-3 and run 4 of that session are therefore NOT the same arm**, and
  // nothing may read run 4's depth or Hard Core against the other three as a
  // strategy effect. Same trap as the sessions 42/43 re-spec recorded below.
  armor: 17,
  armorMax: 17,
  // ── [session 113] GEAR/LEVEL CHANGE, and its TIMING IS PINNED TO WITHIN
  //    ONE RUN — which is the useful part, not the numbers ──────────────────
  //
  // Read off the wire from every unbooned `state-000` on record, not inferred:
  //
  //   run-2026-08-30-18-30-25 (session 112)  rock 25/9  paper 10/16
  //   run-2026-08-31-02-47-41 (today, #1)    rock 25/9  paper 10/16
  //   run-2026-08-31-03-04-33 (today, #2)    rock 25/9  paper 10/16
  //   run-2026-08-31-03-26-52 (today, #3)    rock 26/9  paper 11/16   <-- moved
  //
  // So the change landed **between run 2 and run 3 of 2026-08-31**, in the
  // ~22-minute gap between them. `hpMax` 50, `armorMax` 17 and Spell are all
  // untouched; only Sword and Shield ATK moved, +1 each.
  //
  // **+1 ATK on two moves with nothing else touched is the shape of a SKILL
  // POINT, not of the armor-for-health re-specs recorded above** — those moved
  // hpMax and armorMax in opposite directions. It is not asserted as one:
  // nothing in the capture distinguishes gear from level, the same limit
  // session 103's note records. What IS worth stating is that CLAUDE.md rule
  // 11 exists precisely because the user allocates between runs, and this is
  // the first time that allocation has been caught in the act, bounded to a
  // single inter-run gap rather than to a whole session.
  //
  // ⚠⚠ **RUNS 1-2 AND RUN 3 OF 2026-08-31 ARE NOT THE SAME ARM.** Run 3 went
  // deepest of the three (room 9 against 7 and 6) and paid the most Hard Core
  // (+8800 against +2976 and +2496) — and **none of that may be read as a
  // strategy or tier effect**, because the loadout changed underneath it. Nor
  // may run 3 be compared to session 112's room-13 run. Same trap as every
  // re-spec note above; it is simply the first one that lands mid-session.
  moves: {
    rock: mv(26, 9), // Sword — ATK 25 -> 26 between runs 2 and 3 of session 113; DEF 8 -> 9 before run 1 of session 103
    paper: mv(11, 16), // Shield — ATK 10 -> 11 between runs 2 and 3 of session 113; DEF 15 -> 16 before run 1 of session 103
    scissor: mv(12, 8), // Spell — unchanged since session 42 second update
  },
  // The player starts every run with all rolled stats at zero; the only way
  // they become non-zero is a boon (src/sim/boons.ts).
  rolled: rolled(),
};

export interface EnemyProfile {
  enemy: Combatant;
  /** 1-based room this enemy was observed in. */
  room: number;
  /**
   * The `enemyPathOptions[].tier` this specific instance was captured at.
   *
   * Room 1 has no tier choice at all — `enemyId 63` never appears in any
   * recorded `enemyPathOptions[]`, so it is a fixed first encounter, not a
   * pick. It is tagged `SAFE_TIER` here only because its rolled stats and
   * buff are empty, matching the SHAPE a Safe pick produces elsewhere — this
   * is a convenience for `lookupEnemy(1, SAFE_TIER)`, not a claim that room 1
   * was ever offered as a tier choice.
   */
  tier: number;
  /**
   * Mechanics observed on this instance that the clean model does not cover.
   * Any battle against it is UNSCORABLE for these reasons — see
   * src/sim/coverage.ts. Property of the CAPTURED INSTANCE (room + tier), not
   * of the enemy id — the same enemy is clean at one tier and contaminated at
   * another (enemy 64, rooms below).
   */
  unmodelled: Reason[];
}

export const ROOM_ENEMIES: EnemyProfile[] = [
  {
    room: 1,
    tier: SAFE_TIER,
    // Clean in every capture: no boons, no status, all rolled stats zero, and
    // no tier choice ever precedes it.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 63",
      hp: 30,
      hpMax: 30,
      armor: 12,
      armorMax: 12,
      moves: { rock: mv(12, 6), paper: mv(8, 2), scissor: mv(16, 4) },
      rolled: rolled(),
    },
  },
  {
    room: 2,
    tier: SAFE_TIER,
    // rolledEnemyStats all zero, enemyBuff null — the pick this room's
    // default profile should be fought at under the Safe-tier hard rule.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 64",
      hp: 35,
      hpMax: 35,
      armor: 14,
      armorMax: 14,
      moves: { rock: mv(14, 7), paper: mv(10, 4), scissor: mv(8, 3) },
      rolled: rolled(),
    },
  },
  {
    room: 2,
    tier: RISKY_TIER,
    // Diagnostic only — the sim never fights this by default. rolledEnemyStats
    // all zero, but enemyBuff "bloodthirsty" ("+4 ATK on all moves") is set,
    // which the clean model does not evaluate.
    unmodelled: ["ENEMY_BUFF"],
    enemy: {
      id: "Enemy Room 64",
      hp: 35,
      hpMax: 35,
      armor: 14,
      armorMax: 14,
      moves: { rock: mv(14, 7), paper: mv(10, 4), scissor: mv(8, 3) },
      rolled: rolled(),
    },
  },
  {
    room: 2,
    tier: DANGEROUS_TIER,
    // Diagnostic only. rolledEnemyStats evasion1/block2/lck1/tenacity1, plus
    // enemyBuff "corrosiveShield".
    unmodelled: ["ROLLED_STATS", "ENEMY_BUFF"],
    enemy: {
      id: "Enemy Room 64",
      hp: 35,
      hpMax: 35,
      armor: 14,
      armorMax: 14,
      moves: { rock: mv(14, 7), paper: mv(10, 4), scissor: mv(8, 3) },
      rolled: rolled({ evasion: 1, block: 2, lck: 1, tenacity: 1 }),
    },
  },
  {
    room: 3,
    tier: SAFE_TIER,
    // [session 08, LIVE] The capture this project has been missing since
    // session 06/07: a Safe-tier (tier 0) instance of enemy 65. Played live
    // by the bot itself (not a supervised human capture) — 8 exchanges,
    // matched the clean combat model EXACTLY (0 clean failures on replay).
    // rolledEnemyStats all zero, activeEnemyBuff/enemyStartingBuff both
    // null for the whole battle — genuinely clean, not inferred. This is
    // what unblocks `deepestScorableRoom` past 2.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 65",
      hp: 38,
      hpMax: 38,
      armor: 15,
      armorMax: 15,
      moves: { rock: mv(10, 5), paper: mv(15, 6), scissor: mv(12, 4) },
      rolled: rolled(),
    },
  },
  {
    room: 3,
    tier: RISKY_TIER,
    // [CORRECTED session 07] Was labelled "Dangerous-tier instance" — the
    // corpus match is tier 1 ("Risky"), not tier 2. rolledEnemyStats
    // evasion2/block2/lck1, plus enemyBuff "shatterblade" ("Applies 1
    // Vulnerable on Sword wins"). Diagnostic only — the Safe-tier hard rule
    // means this tier is never fought by default; see the SAFE_TIER entry
    // above for the one the sim actually uses.
    unmodelled: ["ROLLED_STATS", "ENEMY_BUFF"],
    enemy: {
      id: "Enemy Room 65",
      hp: 38,
      hpMax: 38,
      armor: 15,
      armorMax: 15,
      moves: { rock: mv(10, 5), paper: mv(15, 6), scissor: mv(12, 4) },
      rolled: rolled({ evasion: 2, block: 2, lck: 1 }),
    },
  },
  {
    room: 4,
    tier: SAFE_TIER,
    // [CORRECTED session 07] Was labelled "Dangerous-tier instance" and
    // marked STATUS_EFFECT + ENEMY_BUFF. The corpus match is tier 0 ("Safe"):
    // rolledEnemyStats all zero, activeEnemyBuff null for the whole battle.
    // The recorded Burn status on this enemy is the PLAYER's own AddBurnSword
    // boon (present in that run's pickedBoons) landing on a Sword win, not an
    // enemy or tier mechanic — src/sim/boons.ts and BURN_PER_EXCHANGE own
    // that concern independently of this profile. This instance is CLEAN.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 66",
      hp: 40,
      hpMax: 40,
      armor: 16,
      armorMax: 16,
      moves: { rock: mv(16, 4), paper: mv(8, 8), scissor: mv(14, 4) },
      rolled: rolled(),
    },
  },
  {
    room: 5,
    tier: SAFE_TIER,
    // [session 20, LIVE] First-ever room-5 capture — the orchestrator's
    // potion-wiring smoke test cleared rooms 1-4 and reached room 5, a depth
    // this corpus had never touched before. `enemyPathOptions[0]` (the Safe
    // pick, taken per CLAUDE.md §8): rolledEnemyStats all zero, enemyBuff
    // null. `pickSafeTier()` correctly took it over two Dangerous
    // alternatives (firebrand / perpetual_hemomancer buffs, both with
    // non-zero rolled stats). Clean, single exchange sequence, no unmodelled
    // mechanics.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 67",
      hp: 45,
      hpMax: 45,
      armor: 18,
      armorMax: 18,
      moves: { rock: mv(15, 8), paper: mv(12, 6), scissor: mv(18, 4) },
      rolled: rolled(),
    },
  },
  {
    room: 6,
    tier: RISKY_TIER,
    // [session 42, LIVE] First-ever room-6 capture — the resumed juiced
    // Tier-3 run (TASKS.md Task 14 §0) cleared rooms 1-5 and reached room 6.
    // `enemyPathOptions[]` offered NO Safe (tier 0) option at all here
    // (`{2, 2, 1}` — Dangerous, Dangerous, Risky), same "not guaranteed"
    // behavior DECISIONS 2026-08-15 (session 09) already documented —
    // `pickLowestTierOption` correctly took the lowest offered, tier 1
    // ("withering": "Applies 1 Weak on Magic wins"). rolledEnemyStats
    // evasion2/block3/lck2/tenacity1, confirmed against the actual captured
    // battle state (fixtures/dungeon-runs/run-2026-08-18-19-50-14/
    // state-089.json), not just the pre-pick offer. Diagnostic only — no
    // Safe-tier capture of this enemy exists yet.
    unmodelled: ["ROLLED_STATS", "ENEMY_BUFF"],
    enemy: {
      id: "Enemy Room 68",
      hp: 48,
      hpMax: 48,
      armor: 20,
      armorMax: 20,
      moves: { rock: mv(18, 6), paper: mv(14, 8), scissor: mv(12, 6) },
      rolled: rolled({ evasion: 2, block: 3, lck: 2, tenacity: 1 }),
    },
  },
  {
    room: 7,
    tier: SAFE_TIER,
    // [session 42, LIVE] First-ever room-7 capture, same run as room 6 above
    // — this is the deepest room this corpus has ever reached (the run died
    // here, room-7 HP 0/43, per STATE.md). `enemyPathOptions[0]` (Safe, taken
    // per CLAUDE.md §8): rolledEnemyStats all zero, enemyBuff null, confirmed
    // against the actual battle state (state-113.json). Clean.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 69",
      hp: 50,
      hpMax: 50,
      armor: 22,
      armorMax: 22,
      moves: { rock: mv(20, 5), paper: mv(16, 10), scissor: mv(14, 7) },
      rolled: rolled(),
    },
  },
  {
    room: 8,
    tier: SAFE_TIER,
    // [session 52, LIVE] First-ever room-8 capture, superseding room 7 above
    // as the deepest this corpus has reached. Same shape as room 7's:
    // `enemyPathOptions[0]` (Safe, taken per CLAUDE.md §8), rolledEnemyStats
    // all zero, enemyBuff null. Clean.
    //
    // The run entered room 8 at 11/54 HP and died on the first exchange, so
    // this is the enemy's OPENING state and nothing else — no post-exchange
    // sample, and no Risky/Dangerous capture for this room at all.
    // `lookupEnemy` fails closed on those, which is the correct answer.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 70",
      hp: 52,
      hpMax: 52,
      armor: 20,
      armorMax: 20,
      moves: { rock: mv(22, 4), paper: mv(12, 12), scissor: mv(18, 4) },
      rolled: rolled(),
    },
  },
  {
    room: 9,
    tier: RISKY_TIER,
    // [session 53, LIVE] First-ever room-9 capture. NOT clean, and the reason
    // matters: room 9 offered tiers [1,1,1] — no Safe at all — so
    // `pickLowestTier()` (deleted session 57; see enemyTier.ts) took a
    // Risky with `bloodthirsty` (+4 ATK on all
    // moves) and non-zero rolled stats (evasion 3, block 1, lck 2, tenacity
    // 2). This is CLAUDE.md §8's generalized rule doing exactly what session
    // 09 added it for; the STRICT `pickSafeTier()` would have halted a
    // 60-energy entry here for zero loot benefit.
    //
    // The move numbers below therefore INCLUDE the buff and cannot be used as
    // a clean baseline for this enemy. A Safe room-9 capture would supersede it.
    //
    // [session 56] RE-CHECKED after `bloodthirsty` was modelled, and the answer
    // is NO — room 9 does not become scorable. `ENEMY_BUFF` is dropped, because
    // `bloodthirsty` is `statOnly`: its whole effect (+4 ATK on all moves) is
    // already inside the ATK numbers below, verified 30/30 against clean
    // baselines elsewhere in the corpus (`src/sim/enemyBuffs.ts`). But
    // `ROLLED_STATS` remains and it is the harder blocker — evasion 3, block 1,
    // lck 2, tenacity 2, which SPEC §4e says are 1-5% PROC CHANCES needing
    // hundreds of observations to read. So this battle stays unscorable, and
    // the reason list is now honest about which of the two walls is standing.
    //
    // Worth recording for whoever revisits this: `bloodthirsty` being exactly
    // +4 ATK means the CLEAN baseline for this enemy is derivable — rock(20,8),
    // paper(18,7), scissor(17,10). Deliberately NOT applied. The stats below
    // are what this instance was actually fought with, which is what replay
    // needs; a derived baseline belongs in a Safe capture, not here.
    unmodelled: ["ROLLED_STATS"],
    enemy: {
      id: "Enemy Room 71",
      hp: 55,
      hpMax: 55,
      armor: 25,
      armorMax: 25,
      moves: { rock: mv(24, 8), paper: mv(22, 7), scissor: mv(21, 10) },
      rolled: rolled({ evasion: 3, block: 1, lck: 2, tenacity: 2 }),
    },
  },
  {
    room: 10,
    tier: SAFE_TIER,
    // [session 53, LIVE] First-ever room-10 capture, superseding room 8 as the
    // deepest this corpus has reached. Clean: `enemyPathOptions` offered
    // [0,1,2], the Safe was taken, rolledEnemyStats all zero, enemyBuff null.
    //
    // The run entered room 10 and died here, so this is the enemy's OPENING
    // state only — no post-exchange sample, and no Risky/Dangerous capture for
    // this room. `lookupEnemy` fails closed on those, which is correct.
    unmodelled: [],
    enemy: {
      id: "Enemy Room 72",
      hp: 58,
      hpMax: 58,
      armor: 28,
      armorMax: 28,
      moves: { rock: mv(22, 6), paper: mv(20, 10), scissor: mv(16, 12) },
      rolled: rolled(),
    },
  },
  {
    room: 11,
    tier: RISKY_TIER,
    // [session 109, LIVE] First-ever room-11 capture, superseding room 10 as
    // the deepest this corpus has reached. The run entered room 11 and died
    // here, so this is the enemy's OPENING state only — no post-exchange
    // sample, and no Safe/Dangerous capture for this room.
    //
    // The enemy carried the `withering` buff. That does NOT contaminate the
    // stat block: `withering` is `kind: "mechanic"` in `src/sim/enemyBuffs.ts`
    // (applies 1 Weak on Scissor wins) and modifies no hp/armor/move number,
    // so the figures below are the enemy's unmodified base — unlike room 9's
    // `bloodthirsty`, which is `statOnly` and IS baked into that entry's ATK.
    // `ENEMY_BUFF` is therefore deliberately absent from `unmodelled`.
    //
    // `ROLLED_STATS` remains and is the blocker: evasion 4, block 2, lck 3,
    // tenacity 4 are 1-5% proc chances (SPEC §4e), so this battle is not
    // scorable. That is rule 8's documented, accepted cost — highest-tier
    // selection means deep captures arrive with rolled stats — not a
    // regression to repair.
    unmodelled: ["ROLLED_STATS"],
    enemy: {
      id: "Enemy Room 73",
      hp: 60,
      hpMax: 60,
      armor: 30,
      armorMax: 30,
      moves: { rock: mv(24, 8), paper: mv(18, 12), scissor: mv(20, 10) },
      rolled: rolled({ evasion: 4, block: 2, lck: 3, tenacity: 4 }),
    },
  },
  {
    room: 12,
    tier: RISKY_TIER,
    // [session 112, LIVE] First-ever room-12 capture, from the first Tier-2
    // ENTRY run this project has played (run 25215982). Note the two tiers are
    // unrelated: the Tier-2 *entry* is CLAUDE.md rule 11's `--juiced-index=2`,
    // while this `tier: RISKY_TIER` is the in-room `enemyPathOptions` pick
    // rule 8 governs. Rule 8 took the highest offered, and the highest offered
    // here was 1.
    //
    // The enemy carried the `warden` buff. That does NOT contaminate the stat
    // block: `warden` is `kind: "mechanic"` in `src/sim/enemyBuffs.ts`
    // (applies 1 Vulnerable on Shield wins) and modifies no hp/armor/move
    // number, so the figures below are the enemy's unmodified base — the same
    // reasoning room 11's entry records for `withering`. `ENEMY_BUFF` is
    // therefore deliberately absent from `unmodelled`.
    //
    // `ROLLED_STATS` remains and is the blocker: evasion 4, block 2, lck 2,
    // tenacity 2 are 1-5% proc chances (SPEC §4e), so this battle is not
    // scorable. Rule 8's documented, accepted cost, not a regression.
    unmodelled: ["ROLLED_STATS"],
    enemy: {
      id: "Enemy Room 74",
      hp: 62,
      hpMax: 62,
      armor: 28,
      armorMax: 28,
      moves: { rock: mv(20, 10), paper: mv(24, 8), scissor: mv(18, 10) },
      rolled: rolled({ evasion: 4, block: 2, lck: 2, tenacity: 2 }),
    },
  },
  {
    room: 13,
    tier: DANGEROUS_TIER,
    // [session 112, LIVE] First-ever room-13 capture and the deepest this
    // corpus has reached, superseding room 11. The run entered room 13 and
    // died here, so this is the enemy's OPENING state only — no post-exchange
    // sample, and no Safe/Risky capture for this room.
    //
    // `vampiric` is likewise `kind: "mechanic"` (heals 4 HP on Sword wins) and
    // bakes nothing into the numbers below. `ENEMY_BUFF` deliberately absent.
    //
    // ⚠ The rolled stats here are the HEAVIEST the corpus has ever recorded —
    // evasion 8, block 8, lck 7, tenacity 3, roughly double room 11's. Worth
    // naming because it is the shape rule 8 predicts: taking the highest tier
    // at every room means the deepest captures arrive with the largest rolled
    // stats, so coverage falls fastest exactly where new depth is gained.
    unmodelled: ["ROLLED_STATS"],
    enemy: {
      id: "Enemy Room 75",
      hp: 65,
      hpMax: 65,
      armor: 35,
      armorMax: 35,
      moves: { rock: mv(25, 10), paper: mv(20, 12), scissor: mv(22, 13) },
      rolled: rolled({ evasion: 8, block: 8, lck: 7, tenacity: 3 }),
    },
  },
];

/**
 * Fails closed: no synthesized fallback across tiers or rooms. If the exact
 * (room, tier) pair has never been captured, returns `undefined` — the caller
 * decides what that means (see `dungeonSim.ts`'s `NO_TIER_CAPTURE` reason)
 * rather than silently substituting a different tier's numbers.
 */
export function lookupEnemy(room: number, tier: number): EnemyProfile | undefined {
  return ROOM_ENEMIES.find((p) => p.room === room && p.tier === tier);
}

/**
 * The lowest-tier profile captured for a room, preferring Safe. For
 * diagnostics and hand-built scenarios that need SOME real numbers for a room
 * and say so explicitly (`src/sim/scenarios.ts`) — never for a reported
 * result, which must go through `lookupEnemy` and fail closed like
 * `simulateRun` does.
 */
export function bestKnownProfile(room: number): EnemyProfile | undefined {
  return ROOM_ENEMIES.filter((p) => p.room === room).sort((a, b) => a.tier - b.tier)[0];
}

/** Deepest room the corpus has ANY tier captured for. */
export const MAX_OBSERVED_ROOM = Math.max(...ROOM_ENEMIES.map((p) => p.room));

/**
 * Deepest room a Safe-tier run starting at room 1 can reach without hitting a
 * missing capture. [session 08, LIVE] Now 4 — the room-3 Safe-tier capture
 * gap (session 06/07 finding) is closed, live, by the bot's own play. Room
 * 4's Safe-tier capture was already clean (session 07), so a Safe-tier run
 * starting at room 1 now has an unbroken chain of real captures through
 * room 4. Room 5 has never been reached by anything, human or bot.
 */
export const MAX_SAFE_ROOM = (() => {
  let room = 1;
  while (lookupEnemy(room, SAFE_TIER)) room++;
  return room - 1;
})();

/** Forbidden Woods `maxRoom`, from config/discovered.json. */
export const MAX_ROOM = 16;
