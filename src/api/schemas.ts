/**
 * src/api/schemas.ts — zod schemas for the confirmed GET surface (SPEC §2),
 * written against the committed fixtures in `fixtures/probe/*.json`, never
 * against SPEC prose.
 *
 * Every object schema uses `.passthrough()`. CLAUDE.md §1: "if a field you
 * expected is missing from a live response, the spec is wrong and the live
 * response is right" — a strict schema would silently strip fields future
 * code might need instead of surfacing spec drift. These schemas assert only
 * what the client actually reads; everything else rides along unmodified.
 */

import { z } from "zod";

export const UserMeSchema = z
  .object({
    address: z.string(),
    canEnterGame: z.boolean(),
  })
  .passthrough();
export type UserMe = z.infer<typeof UserMeSchema>;

export const NoobSchema = z
  .object({
    docId: z.string(),
    LEVEL_CID: z.number(),
    OWNER_CID: z.string(),
  })
  .passthrough();

export const AccountSchema = z
  .object({
    address: z.string(),
    noob: NoobSchema.optional(),
    username: z.string().optional(),
    lastNoobId: z.number().optional(),
  })
  .passthrough();
export type Account = z.infer<typeof AccountSchema>;

const EnergyEntitySchema = z
  .object({
    docId: z.string(),
    ENERGY_CID: z.number(),
    parsedData: z
      .object({
        energyValue: z.number(),
        maxEnergy: z.number(),
        regenPerHour: z.number(),
        isPlayerJuiced: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough();

export const EnergySchema = z
  .object({
    entities: z.array(EnergyEntitySchema),
  })
  .passthrough();
export type Energy = z.infer<typeof EnergySchema>;

const EntryTierSchema = z
  .object({
    name: z.string(),
    tier: z.number(),
    inputItems: z.array(z.number()),
    inputAmounts: z.array(z.number()),
    dropMultiplier: z.number(),
    inputsBasedOnFactionDay: z.boolean().optional(),
  })
  .passthrough();

const DungeonEntitySchema = z
  .object({
    ID_CID: z.number(),
    NAME_CID: z.string(),
    ENERGY_CID: z.number(),
    maxRoom: z.number(),
    juicedMaxRunsPerDay: z.number(),
    UINT256_CID: z.number(),
    entryData: z.array(EntryTierSchema),
    basicBoonMultiplier: z.number(),
  })
  .passthrough();

/**
 * The server's own per-day run counter — `docId` is `DayCount#<address>#Dungeon#<id>`,
 * `UINT256_CID` is the real count of attempts today for that dungeon. This is
 * the authoritative source for "runs used today": it counts every attempt
 * regardless of who or what started it (bot or manual browser play), unlike
 * `GuardState`'s local counter, which only sees actions this process itself
 * sent. Session 23 found the two can drift — the local guard read 8/12 while
 * this field read 11/12, because a user-started juiced run was invisible to
 * local tracking.
 */
const DayProgressEntitySchema = z
  .object({
    docId: z.string(),
    UINT256_CID: z.number(),
  })
  .passthrough();

export const DungeonTodaySchema = z
  .object({
    dungeonDataEntities: z.array(DungeonEntitySchema),
    dayProgressEntities: z.array(DayProgressEntitySchema).optional(),
  })
  .passthrough();
export type DungeonToday = z.infer<typeof DungeonTodaySchema>;

/** SPEC §3d. Player and enemy share this schema exactly. */
const MoveSchema = z
  .object({
    startingATK: z.number(),
    startingDEF: z.number(),
    currentATK: z.number(),
    currentDEF: z.number(),
    currentCharges: z.number(),
    maxCharges: z.number(),
  })
  .passthrough();

const PoolSchema = z
  .object({
    current: z.number(),
    starting: z.number(),
    currentMax: z.number(),
    startingMax: z.number(),
  })
  .passthrough();

const RolledStatSchema = z.object({ current: z.number(), starting: z.number() }).passthrough();

const PlayerSideSchema = z
  .object({
    id: z.string(),
    rock: MoveSchema,
    paper: MoveSchema,
    scissor: MoveSchema,
    health: PoolSchema,
    shield: PoolSchema,
    lastMove: z.string(),
    statusEffects: z.array(z.unknown()),
    evasion: RolledStatSchema.optional(),
    block: RolledStatSchema.optional(),
    lck: RolledStatSchema.optional(),
    tenacity: RolledStatSchema.optional(),
  })
  .passthrough();

const RunSchema = z
  .object({
    DUNGEON_ID_CID: z.number(),
    players: z.array(PlayerSideSchema),
    lootPhase: z.boolean(),
    pathPhase: z.boolean(),
    rewardPathPhase: z.boolean(),
    enemyPathPhase: z.boolean(),
  })
  .passthrough();

export const DungeonStateSchema = z
  .object({
    success: z.boolean(),
    /** Top level, not under `data` — verified against fixtures/probe/dungeon-state.json. */
    actionToken: z.number(),
    data: z
      .object({
        run: RunSchema,
        entity: z.object({ ROOM_NUM_CID: z.number() }).passthrough().optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type DungeonState = z.infer<typeof DungeonStateSchema>;

/**
 * [session 08, live] The "no active run" shape is NOT only the 500-HTML page
 * the client already special-cases — a genuinely idle account (no run ever
 * started, as opposed to one that just ended) returns HTTP 200 with
 * `{success:true, data:{run:null, entity:null}, actionToken:0}`. The old
 * `DungeonStateSchema` required `data.run` to be a full `RunSchema` object
 * and rejected this as a zod failure. CLAUDE.md §1: the live response is
 * right, the schema was wrong. This schema is what the client actually
 * parses against; `DungeonStateSchema` above stays the stricter "a run IS
 * present" shape everything downstream of `getDungeonState()`'s non-null
 * return continues to rely on.
 */
export const DungeonStateOrIdleSchema = z
  .object({
    success: z.boolean(),
    actionToken: z.number(),
    data: z
      .object({
        run: RunSchema.nullable(),
        entity: z.object({ ROOM_NUM_CID: z.number() }).passthrough().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ItemBalanceSchema = z
  .object({
    PLAYER_CID: z.string(),
    ID_CID: z.string(),
    BALANCE_CID: z.number(),
  })
  .passthrough();

export const ItemsBalancesSchema = z
  .object({
    entities: z.array(ItemBalanceSchema),
  })
  .passthrough();
export type ItemsBalances = z.infer<typeof ItemsBalancesSchema>;

/**
 * One row of `GET /gear/instances/{address}` — CONFIRMED, not guessed.
 *
 * Shape taken from the real 200 captured in
 * `fixtures/fishing-casts/fishing-cast.har` (148 rows), and cross-read
 * against the same object as it rides along on a dungeon action response at
 * `data.entity.data.gearInstances[]`.
 *
 * **This is the endpoint `src/sim/fishing/rodDeck.ts` spent three sessions
 * (89-91) not asking.** Rod durability was looked for in the FISHING doc and
 * in the fixtures, found absent, and declared unobservable; it was here the
 * whole time, one endpoint over — the session-70 `/gear/items` vs
 * `/offchain/static` mistake repeated exactly. Session 99 §1 corrected the
 * claim, QUESTIONS.md §52 authorised the wiring, and this schema is the
 * wiring's first half.
 *
 * Only the four fields anything reads are asserted; `.passthrough()` keeps the
 * rest (`RARITY_CID`, `REPAIR_COUNT_CID`, `OWNER_CID`, `createdAt`, ...)
 * intact per this file's header rule.
 *
 * `EQUIPPED_TO_SLOT_CID` is **-1 when the instance is not equipped** — that is
 * what Shroom (811) read after it was swapped out, alongside
 * `DURABILITY_CID: 0`. A non-negative value is a real slot (the rod sat in 14
 * on both the 2026-08-26 read and the HAR's older Makeshift 922).
 */
const GearInstanceSchema = z
  .object({
    docId: z.string(),
    GAME_ITEM_ID_CID: z.number(),
    DURABILITY_CID: z.number(),
    EQUIPPED_TO_SLOT_CID: z.number(),
  })
  .passthrough();
export type GearInstance = z.infer<typeof GearInstanceSchema>;

export const GearInstancesResponseSchema = z
  .object({
    entities: z.array(GearInstanceSchema),
  })
  .passthrough();
export type GearInstancesResponse = z.infer<typeof GearInstancesResponseSchema>;

export const JuiceSchema = z
  .object({
    juiceData: z.object({ isJuiced: z.boolean() }).passthrough(),
  })
  .passthrough();
export type Juice = z.infer<typeof JuiceSchema>;

/**
 * `POST /roms/factory-claim` response — CONFIRMED session 19/20 (SPEC.md
 * "ROM factory-claim"). Bare `{success: true}` on a real credit, no echoed
 * amount (the server determines the payout from the ROM's own accrued
 * `energyCollectable`, ignoring the request's `amount` field entirely).
 */
export const RomClaimResponseSchema = z.object({ success: z.boolean() }).passthrough();
export type RomClaimResponse = z.infer<typeof RomClaimResponseSchema>;

/**
 * `GET /roms/player?id=<address>` response — CONFIRMED session 22, the user
 * captured this request URL directly from the ROMULATOR panel (CLAUDE.md
 * §2: a user-supplied URL is not a guess). `docId` is the same id
 * `POST /roms/factory-claim` takes as `romId` — cross-checked live against
 * all 4 previously-known ROM ids, which appear verbatim in this list's
 * `docId` field. `factoryStats.energyCollectable` is the real per-ROM
 * claimable amount (the 4 known ROMs, all just claimed session 21, read 0
 * here; the other 33 sum to ~3,259, matching session 20's ~3,252 stockpile
 * snapshot).
 */
const RomFactoryStatsSchema = z
  .object({
    tier: z.string(),
    faction: z.string(),
    energyCollectable: z.number(),
  })
  .passthrough();

const RomEntitySchema = z
  .object({
    docId: z.string(),
    factoryStats: RomFactoryStatsSchema,
  })
  .passthrough();

export const RomsPlayerResponseSchema = z
  .object({
    entities: z.array(RomEntitySchema),
  })
  .passthrough();
export type RomsPlayerResponse = z.infer<typeof RomsPlayerResponseSchema>;

/**
 * The dungeon action response envelope.
 *
 * **`start_run` CONFIRMED live 2026-08-14 (session 08, Task 6 stage 2)** —
 * the original shape below was a [VERIFY] guess from the request envelope
 * and validated against the real response unchanged (`.passthrough()` meant
 * a wrong guess in an unread part would have validated anyway, but the
 * fields this file actually asserts — `success`, `actionToken`, `data.run`
 * — are all exactly as guessed). Every OTHER action
 * (`rock`/`paper`/`scissor`/`loot_*`/etc.) remains unverified; re-derive
 * from a live response before trusting this further for those.
 *
 * Two things the live response had that the guess didn't, both added:
 *  - top-level `message` (human-readable, e.g. `"Dungeon run started"`)
 *  - `data.events`, an array of `{type, data}` — `[{"type":"dungeon_started",
 *    "data":{"dungeonId":<runId>}}]` on `start_run`. Untyped for now
 *    (`z.unknown()`), but worth watching: a structured event log of what an
 *    action caused is a much better signal than diffing `run` before/after,
 *    if later actions populate it for room clears, kills, boon picks, etc.
 */
export const DungeonActionResponseSchema = z
  .object({
    success: z.boolean(),
    actionToken: z.number().optional(),
    message: z.string().optional(),
    data: z
      .object({
        run: RunSchema.optional(),
        events: z.array(z.unknown()).optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type DungeonActionResponse = z.infer<typeof DungeonActionResponseSchema>;

/**
 * The request envelope, SPEC §2 "Dungeon action envelope [CONFIRMED]" — the
 * request side has been observed (it's what the official client sends), only
 * the RESPONSE (`DungeonActionResponseSchema` above) is unverified. Move
 * names are the API's RPS names (`rock`/`paper`/`scissor`), mapped to weapon
 * names (Sword/Shield/Spell) only at the strategy boundary — SPEC §2.
 *
 * **[session 08, live, Task 6 stage 3] `loot_one`..`loot_four` is the WRONG
 * family for a reward-path pick.** The real client sends `reward_one` for
 * that (captured live via DevTools by the user, after `loot_one` was
 * rejected with HTTP 409 — a wrong action name, not a state/sequencing
 * issue). `reward_two`/`reward_three`/`reward_four` are inferred by the same
 * naming pattern, individually confirmed for `reward_three` (this client's
 * own successful `AddBlock` pick, room 4).
 *
 * **The enemy-tier pick is `path_<n>`, NOT `enemy_<n>`.** `enemy_two` was
 * tried live 3 times (2× HTTP 500, 1× HTTP 400 on an otherwise identical
 * retry — a 400 on a retry is a strong signal of a genuinely wrong name, not
 * flakiness) before the user captured the real client sending `path_two` for
 * the same pick via DevTools. `path_one`/`path_three` inferred by the same
 * pattern, not individually confirmed. **Its `data.index` is also NOT the
 * option's array position** — the captured `path_two` (picking
 * `enemyPathOptions[1]`) sent `data.index: 0`, not `1`, unlike `reward_*`
 * where `index` matches the position. One sample; treated as the literal
 * behavior to reproduce (`buildPathSelectionEnvelope`'s caller passes `0`
 * for this family) rather than a pattern to extrapolate further.
 *
 * `loot_one`..`loot_four` are LEFT IN the enum (still SPEC-listed, still
 * possibly real for an actual loot-phase pick, which the corpus has simply
 * never observed populated — DECISIONS 2026-08-14) but are no longer used by
 * `scripts/liveRun.ts`.
 */
export const DUNGEON_ACTIONS = [
  "start_run",
  "rock",
  "paper",
  "scissor",
  "reward_one",
  "reward_two",
  "reward_three",
  "reward_four",
  "path_one",
  "path_two",
  "path_three",
  "loot_one",
  "loot_two",
  "loot_three",
  "loot_four",
  "use_item",
  "heal_or_damage",
  "flee",
  "cancel_run",
] as const;
export type DungeonAction = (typeof DUNGEON_ACTIONS)[number];

/**
 * **[session 08, live] `actionToken` is NOT always a number.** `start_run`
 * and combat moves (`rock`/`paper`/`scissor`) use a real numeric token from
 * `getActionToken()`. The real client's `reward_one` request captured live
 * used `actionToken: ""` (empty STRING) and `dungeonId: 0`, not the run's
 * real dungeon id — a completely different envelope convention for
 * path-selection actions than for combat/start actions. `data` also carried
 * fields this schema never declared: `itemId`, `expectedAmount`,
 * `gearInstanceIds`, `devBoons` (all zero/empty in the capture — a reward
 * pick with no item cost). All added as optional; combat/start_run keep
 * sending only the original four `data` fields, unaffected.
 */
export const DungeonActionRequestSchema = z.object({
  action: z.enum(DUNGEON_ACTIONS),
  dungeonId: z.number(),
  actionToken: z.union([z.number(), z.string()]),
  data: z
    .object({
      consumables: z.array(z.number()),
      isJuiced: z.boolean(),
      index: z.number(),
      itemId: z.number().optional(),
      expectedAmount: z.number().optional(),
      gearInstanceIds: z.array(z.union([z.number(), z.string()])).optional(),
      devBoons: z.array(z.unknown()).optional(),
    })
    .passthrough(),
});
export type DungeonActionRequest = z.infer<typeof DungeonActionRequestSchema>;
