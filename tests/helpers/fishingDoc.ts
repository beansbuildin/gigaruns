/**
 * tests/helpers/fishingDoc.ts — [session 67 §2] the ONE builder for a fake
 * `FISHING_GAME` doc in tests.
 *
 * ## Why this exists, and why the consolidation is not the point
 *
 * Six divergent copies of this mock lived in four test files. It was flagged
 * in six consecutive recaps as a tidiness item, and then session 65 proved it
 * was not one: two of the copies omitted `fishingConsumableSlotUsed`, which
 * `nextConsumableSlot` reads to choose a slot. With the field missing the live
 * path fails closed and sends no consume at all — so every *"it consumes the
 * oil"* assertion in those files was **vacuously true and green**.
 *
 * **So the deliverable is not one copy instead of six. A single copy that
 * omits a field the live path reads is the same bug with better ergonomics.**
 * The deliverable is the guard: `LIVE_PATH_FIELDS` names what the live
 * decision path actually reads, `omit` makes removing one of them a
 * first-class operation rather than a hack, and
 * `tests/fishing/fishingDocGuard.test.ts` proves that removing any of them is
 * OBSERVABLE — i.e. that the list is not decoration.
 *
 * ## `omit` is a real parameter, on purpose
 *
 * A guard that has to reach in and `delete` a key is testing the test harness
 * as much as the mock. Making omission part of the builder's own API means the
 * guard exercises the same construction path every other test uses, and means
 * a future field can be added to `LIVE_PATH_FIELDS` and immediately checked.
 *
 * ## The values are the SERVER's, not convenient ones
 *
 * Carried over verbatim from the copies that had already been corrected, with
 * their reasons, because those corrections were paid for in live captures:
 *
 *   - `focusPoint: [2, 2]` — `geometry.ts`'s `allCells` is ONE-indexed, so the
 *     `[0, 0]` two of the copies used is OFF the board. Harmless at a full
 *     meter and fatal at `focusMeter: 0` (`reachableCells` returns empty and
 *     `bestFocusForCard` throws), which is exactly the state the Focus Oil
 *     trigger fires on. `[2, 2]` is what the live wire reports on a gridSize-4
 *     board (session 63 §4).
 *   - `previousFishPosition` defaults to `fishPosition` — on-grid BY
 *     CONSTRUCTION however the caller moves the fish, and a state the server
 *     really sends (the fish stays put in 94 of 522 committed states). Session
 *     64 §4 established this against a brief that had generalised `[4,4]` from
 *     one observation.
 */

/**
 * **Every field the LIVE decision path reads off a fishing doc.** Removing any
 * one of them must be observable — pinned in
 * `tests/fishing/fishingDocGuard.test.ts`, which is the half of this file that
 * does the work.
 *
 * If a field here turns out NOT to be observable, the guard fails and the
 * answer is one of two things, both of which need a human: the field is no
 * longer read and should leave this list, or the guard has gone blind. It is
 * never "loosen the assertion".
 */
export const LIVE_PATH_FIELDS = [
  "deckCardData",
  "fishHp",
  "fishMaxHp",
  "fishPosition",
  "gridSize",
  "focusPoint",
  "focusMeter",
  "focusMeterMax",
  "hand",
  "fishingConsumableSlotUsed",
] as const;

export type LivePathField = (typeof LIVE_PATH_FIELDS)[number];

export interface FakeCardOptions {
  id?: number;
  hitAmount?: number;
  missAmount?: number;
}

export function fakeCard(o: FakeCardOptions = {}) {
  return {
    id: o.id ?? 1,
    manaCost: 1,
    hitZones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    critZones: [],
    hitEffects: [{ type: "FISH_HP", amount: o.hitAmount ?? 5 }],
    missEffects: [{ type: "FISH_HP", amount: -(o.missAmount ?? 3) }],
    critEffects: [],
    earnable: false,
    rarity: 0,
    isDayCard: false,
    foundInPonds: [1],
  };
}

/**
 * **A card that CANNOT finish a fish sitting in the Relaxing Oil's lethal
 * band** — the hand every oil-LOOP test needs as of session 97.
 *
 * ## Why this exists
 *
 * `fakeCard`'s default is a FULL 3x3 template (`hitZones: [1..9]`) dealing 5,
 * so against the `fishHp: 2` these tests use to arm the lethal trigger it
 * kills with probability exactly 1 — a hit is certain by construction when the
 * template covers every reachable cell. Session 68 hit the same property with
 * the same shape on the live shadow harness.
 *
 * That was harmless while `scripts/liveFishing.ts` played `onDemandTriggers`,
 * which reads scalars and never looks at the hand. As of session 97 §1d the
 * live trigger is `necessityGatedDoubleLethalTriggers`, and a certain kill is
 * precisely the state the necessity gate WITHHOLDS the oil on. So a fixture
 * built to exercise the consume loop, the per-cast cap, or the dry path stops
 * exercising any of them: no oil is ever requested.
 *
 * **Using this card is not weakening those tests to match new code — it
 * isolates them from a gate they were never about**, the same way
 * `conservingTriggers` reuses `onDemandTriggers` rather than restating it so
 * two changes cannot be confounded. Each of those files pins downstream
 * machinery GIVEN a trigger fires; which trigger fires is
 * `oilNecessityComposition.test.ts`'s question, not theirs.
 *
 * **And it is the LIVE-REPRESENTATIVE case, not a convenient one.** Session 97
 * §1a measured `bestKillProbability` across every cast ever recorded: 18
 * replayed evaluations and 24 live observations, maximum **0.991**, never once
 * reaching 1. A fixture whose kill is certain describes a board the real
 * fishery has never produced; this one describes the board it always produces.
 */
export const CANNOT_FINISH_CARD = fakeCard({ hitAmount: 1 });

export interface FakeDocOptions {
  docId?: string;
  fishPosition?: [number, number];
  previousFishPosition?: [number, number];
  complete?: boolean;
  /** `SUCCESS_CID`. Defaults to the escape case (`false` when complete), which is what the copies all encoded. */
  success?: boolean;
  fishHp?: number;
  fishMaxHp?: number;
  focusMeter?: number;
  focusPoint?: [number, number];
  slotUsed?: boolean[];
  cards?: ReturnType<typeof fakeCard>[];
  /** Merged over `data`, last. The escape hatch the older copies spelled `extraData`. */
  extraData?: Record<string, unknown>;
  /** Fields to DELETE from `data` — see this file's header. The guard's instrument. */
  omit?: readonly string[];
}

export function fakeDoc(o: FakeDocOptions = {}) {
  const fishPosition = o.fishPosition ?? [1, 1];
  const slotUsed = o.slotUsed ?? [false, false, false];
  const complete = o.complete ?? false;
  const data: Record<string, unknown> = {
    deckCardData: o.cards ?? [fakeCard()],
    playerMaxHp: 10,
    playerHp: 10,
    fishHp: o.fishHp ?? 10,
    fishMaxHp: o.fishMaxHp ?? 10,
    fishPosition,
    previousFishPosition: o.previousFishPosition ?? fishPosition,
    gridSize: 4,
    focusPoint: o.focusPoint ?? [2, 2],
    focusMeter: o.focusMeter ?? 3,
    focusMeterMax: 3,
    focusMechanicEnabled: true,
    patternIndex: 0,
    fullDeck: [1],
    nextCardIndex: 1,
    cardInDrawPile: 0,
    hand: [1],
    discard: [],
    // [session 65] The consumable slot ledger is on EVERY live state, and
    // `nextConsumableSlot` READS it to pick a slot. Two of the six copies
    // omitted it, and that is the bug this whole helper exists because of.
    fishingConsumableSlotUsed: [...slotUsed],
    consumablesUsed: slotUsed.filter(Boolean).length,
    ...(o.extraData ?? {}),
  };
  for (const f of o.omit ?? []) delete data[f];
  return {
    docId: o.docId ?? "99999999",
    docType: "FISHING_GAME",
    data,
    COMPLETE_CID: complete,
    SUCCESS_CID: complete ? (o.success ?? false) : undefined,
    IS_JUICED_CID: false,
    MULTIPLIER_CID: 1,
  };
}
