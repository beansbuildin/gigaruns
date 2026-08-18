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
 */
export const PLAYER: Combatant = {
  id: "player",
  hp: 38,
  hpMax: 38,
  armor: 17,
  armorMax: 17,
  moves: {
    rock: mv(26, 9), // Sword — NEW gear boost, session 42 second update (was 16/0)
    paper: mv(6, 12), // Shield
    scissor: mv(12, 8), // Spell — boost gone, session 42 second update (was 18/15)
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
