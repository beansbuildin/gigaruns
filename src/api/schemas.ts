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

export const DungeonTodaySchema = z
  .object({
    dungeonDataEntities: z.array(DungeonEntitySchema),
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

export const JuiceSchema = z
  .object({
    juiceData: z.object({ isJuiced: z.boolean() }).passthrough(),
  })
  .passthrough();
export type Juice = z.infer<typeof JuiceSchema>;

/**
 * The dungeon action response envelope. Never observed live — this session's
 * gate is read-only (CLAUDE.md, `next.md` §Task 2) — so this is a
 * [VERIFY] guess from SPEC §2's confirmed request envelope, not a fixture.
 * `.passthrough()` and a permissive `data` mean a real response will validate
 * even if this guess is wrong in the parts nothing here reads; Task 6 must
 * re-derive this schema from a live response before trusting it further.
 */
export const DungeonActionResponseSchema = z
  .object({
    success: z.boolean(),
    actionToken: z.number().optional(),
    data: z
      .object({
        run: RunSchema.optional(),
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
 */
export const DUNGEON_ACTIONS = [
  "start_run",
  "rock",
  "paper",
  "scissor",
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

export const DungeonActionRequestSchema = z.object({
  action: z.enum(DUNGEON_ACTIONS),
  dungeonId: z.number(),
  actionToken: z.number(),
  data: z
    .object({
      consumables: z.array(z.number()),
      isJuiced: z.boolean(),
      index: z.number(),
    })
    .passthrough(),
});
export type DungeonActionRequest = z.infer<typeof DungeonActionRequestSchema>;
