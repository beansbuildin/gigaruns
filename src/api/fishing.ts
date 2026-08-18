/**
 * src/api/fishing.ts — Task 7. Zod schemas for the fishing API surface,
 * written against `fixtures/fishing-casts/*.json` (redacted, from
 * `scripts/parseHar.ts`), never against SPEC-fishing.md prose — same rule as
 * `schemas.ts`'s header comment.
 *
 * Every object uses `.passthrough()` for the same reason: CLAUDE.md §1, a
 * live field the schema doesn't name should ride along, not get stripped.
 *
 * CONFIRMED (this file's schemas are built to accept exactly what was
 * captured) vs INFERRED — see SPEC-fishing.md for the full breakdown. The
 * short version: everything here matched one live capture of one complete
 * cast (`start_run` + 5 `play_cards`, ending `FISH_ESCAPED`). Field
 * *presence* is confirmed; field *range* (e.g. `hand`'s length, `events[]`
 * ordering under a catch instead of an escape) is not — there was only one
 * cast to observe, and it never caught anything.
 */

import { z } from "zod";

// ── deck / card definitions (GET /api/fishing/cards, and echoed in every
//    fishing/action response as `doc.data.deckCardData`) ────────────────────

const CardEffectSchema = z.object({ type: z.string(), amount: z.number() }).passthrough();

export const FishingCardSchema = z
  .object({
    id: z.number(),
    // Nullable AND optional — LIVE FINDING (CLAUDE.md §1, spec guess was
    // wrong): `isDayCard: true` cards in `deckCardData` (mid-cast) carry
    // `startingAmount: null`/`unlockLevel: null` explicitly (ids 39, 40); the
    // same fields are entirely ABSENT (not even `null`) on many entries of
    // the full GET /fishing/cards catalog. Two different wire shapes for
    // "this card has no fixed starting amount / unlock level", not one.
    startingAmount: z.number().nullable().optional(),
    manaCost: z.number(),
    hitZones: z.array(z.number()),
    critZones: z.array(z.number()),
    hitEffects: z.array(CardEffectSchema),
    missEffects: z.array(CardEffectSchema),
    critEffects: z.array(CardEffectSchema),
    unlockLevel: z.number().nullable().optional(),
    earnable: z.boolean(),
    rarity: z.number(),
    isDayCard: z.boolean(),
    foundInPonds: z.array(z.number()),
  })
  .passthrough();
export type FishingCard = z.infer<typeof FishingCardSchema>;

export const FishingCardsSchema = z.object({ entities: z.array(FishingCardSchema) }).passthrough();
export type FishingCards = z.infer<typeof FishingCardsSchema>;

// ── board state — the identical shape rides under two different wrappers:
//    GET /fishing/state → { gameState: {...} }, POST /fishing/action →
//    { data: { doc: {...} } }. Normalise both to this one schema. ───────────

const FishingBoardDataSchema = z
  .object({
    deckCardData: z.array(FishingCardSchema),
    playerMaxHp: z.number(),
    playerHp: z.number(),
    fishHp: z.number(),
    fishMaxHp: z.number(),
    fishPosition: z.array(z.number()),
    previousFishPosition: z.array(z.number()),
    gridSize: z.number(),
    focusPoint: z.array(z.number()),
    focusMeter: z.number(),
    focusMeterMax: z.number(),
    focusMechanicEnabled: z.boolean(),
    patternIndex: z.number(),
    fullDeck: z.array(z.number()),
    nextCardIndex: z.number(),
    cardInDrawPile: z.number(),
    hand: z.array(z.number()),
    discard: z.array(z.number()),
    // Catch-resolution fields — CONFIRMED live, session 17 (QUESTIONS.md
    // §10). Present on a terminal `SUCCESS_CID: true` doc: `cardsToAdd` is
    // the 3 new-card offers (same shape as `deckCardData`); `cardChosenId`
    // is null/absent until the `loot` action (below) sets it to one of
    // `cardsToAdd[].id`, at which point `fullDeck` grows by one and the
    // account stops rejecting `start_run`.
    cardsToAdd: z.array(FishingCardSchema).optional(),
    cardChosenId: z.number().nullable().optional(),
  })
  .passthrough();

export const FishingGameDocSchema = z
  .object({
    docId: z.string(),
    docType: z.literal("FISHING_GAME"),
    data: FishingBoardDataSchema,
    COMPLETE_CID: z.boolean(),
    // Absent on GET /fishing/state before a cast resolves; present (bool) on
    // every POST /fishing/action response, including mid-cast (false).
    SUCCESS_CID: z.boolean().optional(),
    IS_JUICED_CID: z.boolean(),
    MULTIPLIER_CID: z.number(),
  })
  .passthrough();
export type FishingGameDoc = z.infer<typeof FishingGameDocSchema>;

// ── GET /fishing/state/:address ─────────────────────────────────────────────

const PondEntryTierSchema = z
  .object({
    name: z.string(),
    tier: z.number(),
    pondId: z.number(),
    inputItems: z.array(z.number()),
    inputAmounts: z.array(z.number()),
    dropMultiplier: z.number(),
  })
  .passthrough();

export const FishingStateSchema = z
  .object({
    gameState: FishingGameDocSchema.nullable(),
    pondEntryTiers: z.array(PondEntryTierSchema),
    maxPerDay: z.number(),
    maxPerDayJuiced: z.number(),
    // node0/1/2 — INFERRED to be per-tier energy cost within the ONE pond
    // this capture saw (Dendren, pondId 2: 12/16/20 energy for tier 1/2/3,
    // matching the dungeon side's per-tier cost pattern). Never independently
    // confirmed against a second pond — see SPEC-fishing.md §3.
    node0Energy: z.number(),
    node1Energy: z.number(),
    node2Energy: z.number(),
  })
  .passthrough();
export type FishingState = z.infer<typeof FishingStateSchema>;

// ── POST /fishing/action ────────────────────────────────────────────────────

/**
 * `loot` — CONFIRMED live, session 17 (QUESTIONS.md §10, three sessions
 * open): resolves a caught cast's `cardsToAdd` offer. `data.cards: [id]`
 * — the chosen card's real id from `cardsToAdd[].id`, NOT a hand-relative
 * index like `play_cards` uses (the captured payload sent `cards: [22]`,
 * far too large to be a hand position). User-captured via DevTools,
 * one real payload: `{action:"loot", actionToken:"<string>",
 * data:{cards:[22], nodeId:"", focusPoint:[], itemId:0, slotIndex:0,
 * tierId:0}}` — same envelope shape as `play_cards`, only `cards` differs
 * in what it addresses. Verified end to end: `GET /fishing/state`
 * afterward showed `fullDeck` grown 10 -> 11 and the account no longer
 * rejecting `start_run`.
 *
 * `use_fishing_item` — CONFIRMED live, session 44, user-captured DevTools
 * payload while using one "Lil Mana Oil" (itemId 821, `FishingRestoreMana`
 * +1 per `GET /offchain/static`'s `gameItems[]`) mid-cast: `{action:
 * "use_fishing_item", actionToken:"1787094007859", data:{cards:[],
 * nodeId:"", focusPoint:[], itemId:821, slotIndex:0, tierId:0}}` — same
 * six-field envelope shape as every other fishing action, `itemId`/
 * `slotIndex` are what actually address the item (matching SPEC-fishing.md
 * §4a's "very likely" hypothesis, now confirmed). `slotIndex:0` is
 * confirmed ONLY for this one item/slot combination — whether a different
 * held item (e.g. Mid Relaxing Oil, itemId 937) also lives at slot 0 is
 * UNCONFIRMED and stays a stated hypothesis at its one live call site
 * (`scripts/liveFishing.ts`), same "fails closed on a wrong guess rather
 * than corrupting state" discipline as the session-08 `enemy_one` guess.
 * QUESTIONS.md §16 resolved by this capture; see DECISIONS.md 2026-08-18
 * (session 44).
 */
export const FishingActionSchema = z.enum(["start_run", "play_cards", "loot", "use_fishing_item"]);
export type FishingAction = z.infer<typeof FishingActionSchema>;

/**
 * `nodeId`/`tierId` only meaningful on `start_run` (nodeId "5" resolved
 * this cast to Dendren Pond — see SPEC-fishing.md §3 for why that's
 * CONFIRMED-BY-CAPTURE, not confirmed by an explicit name field). `cards`/
 * `focusPoint` only meaningful on `play_cards`/`loot`. Sent as `""`/`[]`/`0`
 * respectively when not applicable — CONFIRMED literal envelope, not
 * inferred; all three action types were captured.
 */
export interface FishingActionRequest {
  action: FishingAction;
  actionToken: string;
  data: {
    cards: number[];
    nodeId: string;
    focusPoint: number[];
    itemId: number;
    slotIndex: number;
    tierId: number;
  };
}

const FishingEventSchema = z
  .object({
    type: z.string(),
    playerId: z.number(),
    batch: z.number(),
  })
  .passthrough();

export const FishingActionResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    data: z
      .object({
        doc: FishingGameDocSchema,
        events: z.array(FishingEventSchema),
      })
      .passthrough(),
    actionToken: z.number(),
  })
  .passthrough();
export type FishingActionResponse = z.infer<typeof FishingActionResponseSchema>;

// ── item metadata (GET /offchain/static's `gameItems[]`) — resolves the
//    bare numeric IDs in GET /items/balances into names/effects. Confirmed
//    the same capture: item 845 → "Hard Core", 131/151/155 → the three heal
//    potions with flat OnUseBattle heal amounts (20/4/8). See
//    SPEC-fishing.md §5. ───────────────────────────────────────────────────

const ItemEffectStepSchema = z
  .object({
    type: z.string(),
    amount: z.number(),
    playerType: z.string(),
    statusType: z.string(),
  })
  .passthrough();

const ItemEffectTriggerSchema = z
  .object({
    triggerType: z.string(),
    effects: z.array(ItemEffectStepSchema),
    durabilityChange: z.number(),
    playerType: z.string(),
  })
  .passthrough();

export const GameItemSchema = z
  .object({
    docId: z.string(),
    NAME_CID: z.string(),
    DESCRIPTION_CID: z.string().optional(),
    TYPE_CID: z.string().optional(),
    RARITY_CID: z.number().optional(),
    RARITY_NAME: z.string().optional(),
    itemEffect: z.object({ effects: z.array(ItemEffectTriggerSchema) }).passthrough().optional(),
  })
  .passthrough();
export type GameItem = z.infer<typeof GameItemSchema>;

export const GameItemsSampleSchema = z.array(GameItemSchema);
