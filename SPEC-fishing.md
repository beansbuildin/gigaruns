# SPEC-fishing — the fishing API surface

Task 7. Derived from `fixtures/fishing-casts/*.json` (redacted, produced by
`scripts/parseHar.ts` from a single real Dendren cast the user captured and
placed at `fixtures/fishing-casts/fishing-cast.har`, gitignored) — never
transcribed from documentation or from the community notes referenced below.

Legend, same as `SPEC.md`: **[CONFIRMED]** verified against a captured
request/response · **[INFERRED]** consistent with what was captured but not
independently verified · **[VERIFY]** still a guess.

A community research note (`FISHING-NOTES-SHAREABLE.md`, user-supplied, not
part of this repo) claims a broader API surface and mechanics than this one
capture can verify. Per CLAUDE.md §9, its claims are treated as hypotheses:
kept where this capture corroborates them, flagged where it can't, and
corrected where this capture contradicts them outright. Each item below says
which.

---

## 0. What this capture covers, and what it doesn't

One complete cast at Dendren Pond: `start_run` → 5× `play_cards` → cast ends
`COMPLETE_CID: true, SUCCESS_CID: false` (the fish escaped; nothing was ever
caught). Consequently:

- The full **request/response envelope**, the **action-token chain**, the
  **board-state shape**, and **one terminal outcome (escape)** are
  **[CONFIRMED]**.
- A **catch** (`SUCCESS_CID: true`) was never observed. Whatever changes on a
  catch — reward fields, a different terminal shape — is **[VERIFY]**.
- A **redraw** action was never sent. Its request shape is **[VERIFY]** —
  matches the community note's own "still uncaptured" list.
- Only **one pond** (Dendren, `pondId: 2`) was observed. `pondEntryTiers`
  shows two more pond-1 tier defs and `node0/1/2Energy` fields suggesting a
  second/third pond or tier family exists, but nothing about them is
  independently confirmed — see §3.
- **No Authorization header appears anywhere in this HAR** (checked
  programmatically — 0 matches across 80 entries, including authenticated
  GETs like `/api/user/me`). Chrome's DevTools has an "omit sensitive data"
  HAR export option that scrubs exactly this; that is the likely explanation,
  but it is not confirmed. Practical consequence: this capture cannot show
  how the fishing endpoints authenticate. Assume the same `Authorization:
  Bearer <jwt>` scheme as the dungeon client (`src/api/client.ts`) until
  proven otherwise.

---

## 1. Endpoint map

Everything the browser called in this capture, filtered to what's relevant —
the full HAR also contains marketplace, faction, analytics, and third-party
beacon traffic not reproduced here.

**Public (no auth header observed on any endpoint in this HAR — including the
authenticated-looking ones, per §0):**

```
GET  /api/fishing/cards                  full card catalog (all ponds)
GET  /api/fishing/state/{address}        live fishing state + pond metadata
GET  /api/offchain/static                full game data dump (enemies,
                                          recipes, gameItems, checkpoints,
                                          lootTables, ...) — item metadata
                                          lives here, see §5
GET  /api/indexer/gameitems              lighter item list: docId → NAME_CID
                                          only (no description/effect) —
                                          see §5
GET  /api/items/balances                 the player's holdings, bare
                                          numeric IDs + balances, no names
```

**Write:**

```
POST /api/fishing/action                 start a cast AND play cards —
                                          same action name family as the
                                          dungeon side, see §2
```

**[CONFIRMED]** all of the above — each was captured with a real
request/response pair or (for the GETs) a real 200 response in this HAR.

**[VERIFY]** — named in the community note, not seen in this capture:
`GET /gear/items`, `GET /gear/instances/{address}` (unrelated to fishing but
listed there), and any endpoint specific to a second pond.

---

## 2. `POST /api/fishing/action` — the one write endpoint

Same envelope shape as the dungeon's `POST /game/dungeon/action`
(`src/api/client.ts`), a different path and action-name family.

### Request **[CONFIRMED]**

```json
{
  "action": "start_run" | "play_cards" | "loot",
  "actionToken": "<string, from the previous response's actionToken>",
  "data": {
    "cards": [0],
    "nodeId": "5",
    "focusPoint": [2, 2],
    "itemId": 0,
    "slotIndex": 0,
    "tierId": 1
  }
}
```

- **`action: "start_run"`** — the SAME action name the dungeon side uses for
  its own run-start. The community note lists "cast-start POST" as
  uncaptured; it is not a different action, it is this one. Fields used:
  `nodeId` and `tierId` (see §3); `cards`/`focusPoint` sent empty (`[]`).
- **`action: "play_cards"`** — one card per call in this capture (`cards`
  always length 1), though the field is an array, so multi-card plays may be
  legal — **[VERIFY]**. `cards` holds **hand-relative indices, not card
  ids** — confirmed by watching `hand[]` shrink and `discard[]` grow by
  exactly the played id at that position across all 5 plays. This matches
  the community note's claim exactly. `nodeId`/`tierId` sent as `""`/`0` on
  this action (not applicable once the run exists); `focusPoint` carries the
  bobber's new position (see §4).
- **`action: "loot"` [CONFIRMED 2026-08-16, session 17, live]** — resolves a
  catch's `cardsToAdd` offer (§4a below). `cards` holds **the chosen card's
  real id from `cardsToAdd[].id`**, the OPPOSITE convention from
  `play_cards`'s hand-relative index — a genuine trap for pattern-matching
  the two actions as identical. All other fields empty/zero, same as
  `play_cards`.
- `itemId`/`slotIndex` were `0` on every call in this capture —
  **[VERIFY]** for their actual meaning (the community note guesses
  "consumable slot", untested here).
- **Token chain [CONFIRMED]**: identical discipline to the dungeon side —
  every response's top-level `actionToken` (a **number**) becomes the next
  request's `actionToken` (a **string**). Verified across all 6 calls in
  this cast, no gaps, no going stale within the ~75s the cast took.

### Response **[CONFIRMED]**

```json
{
  "success": true,
  "message": "Cards played successfully.",
  "data": {
    "doc": { "...": "board state, see §4" },
    "events": [ { "...": "see below" } ]
  },
  "actionToken": 1786764592240
}
```

`actionToken` is a **top-level** field on the response (`response.actionToken`,
NOT `response.data.actionToken` — an easy mistake, since `src/api/schemas.ts`'s
`DungeonActionResponseSchema` puts it in the same place but the fishing shape
differs on this one point). `gameItemBalanceChanges: []` also rides at
`response.data` on every `play_cards` call (absent on `start_run`) — always
empty in this capture, meaning content unverified — **[VERIFY]**.

### Events **[CONFIRMED shapes, VERIFY exhaustiveness]**

Observed types, one array per response, describing what happened that turn:

| type | seen when | payload |
|---|---|---|
| `FISH_MOVED` | every turn | `data.path`: array of the cell(s) traversed, encoded as a single 1-based **column-major** index over the grid (`(x-1)*gridSize + y`, verified against `fishPosition` on every turn of the real cast — e.g. `[4,3]` on a 4×4 grid ⇒ `(4-1)*4+3 = 15`, matching the captured `value` exactly) |
| `CARD_PLAYED` | every turn | `value`: **the hand index played** (**[CORRECTED 2026-08-15, session 12]** — NOT "0 (miss) or 1 (hit)" as this row previously said; refuted directly by the real cast, where the one genuine hit has `value: 0` and three of the four misses have `value: 1`, tracking the played hand index exactly), `data.result`: **1 on a hit, 0 on a miss** (this is the actual hit/miss flag this row's `value` was wrongly assumed to be) |
| `HIT` | on a hit only | `value`: damage dealt, `data.result`: catch meter after |
| `FISH_HP_DIFF` | every turn | `value`: the effect amount applied this turn (`hitEffects[0].amount`, positive, on a hit; `missEffects[0].amount`, negative, on a miss) — **[CORRECTED]** applied as `fishHp -= value`, not `fishHp += value`: a hit's positive value *subtracts* (meter falls toward 0, the catch condition), a miss's negative value *subtracts a negative* (meter rises toward `fishMaxHp`, the escape condition). Verified turn-by-turn against the real cast's own `fishHp` field: `13→16→19→14→17→20`, exactly matching `old − value` at every step. `data.result`: meter after. |
| `NEW_HAND` | when the hand is played down to empty | `value`: the new hand array (**[CORRECTED]** not "when the hand changes" generally — in the real cast this fired exactly once, the turn the hand reached 0 cards, not on every card played; the hand refills to its starting size from `fullDeck` via `nextCardIndex` on empty, not per turn and not tied to hit/miss) |
| `FISH_ESCAPED` | cast-ending escape | no payload. **[CORRECTED]** fires when `fishHp` reaches `fishMaxHp` (confirmed: the real cast escaped at `fishHp 20/20`, `playerHp` still 5/10) — not when mana reaches zero, which `SPEC.md §5` wrongly claimed before this session; see `SPEC.md §5`'s own correction. |
| `FISH_DIED` | cast-ending catch — **[CONFIRMED 2026-08-16, session 15, live]**, resolves the row below | fires the turn `fishHp` reaches 0. `value`: the caught fish's `gameItemId`. `data.fish`: the full `caughtFish` object (see below) duplicated. **NOT** `FISH_CAUGHT` as the naming-symmetry guess below assumed — corrected now that a catch has actually been observed. |

**[RESOLVED 2026-08-16, session 15, live] A catch's terminal shape**, this
project's first-ever live catch (cast `12925773`, fish "Zombo," item 521,
`rarity: 2`, `fixtures/fishing-casts/live/cast-2026-08-16-01-57-01/`):

- `doc.data.caughtFish`: `{gameItemId, name, moveDistances, rarity, size,
  sizes:{weight,length,girth}, quality, plusOneRarity, plusOneQuality,
  doubled, amountToCatch, findexResult:{newFish,newLength,newGirth,newWeight,
  newQuality,totalCaught}, seaweedEarned, xpItemId}`.
- `doc.data.cardsToAdd`: an array of **3 full card objects** (ids 23, 14, 7 in
  this capture) — the first live confirmation of the session-15 brief's
  screenshot hypothesis ("choose one of three new spells on catch"). **Not
  yet resolved which/how many actually get added** — see the blocker below.
- `response.data.gameItemBalanceChanges`: fires immediately, same response —
  `[{id:521 (the fish), amount:1}, {id:845 ("Hard Core"), amount:320}]`. Loot
  is credited synchronously with the catch; it is NOT gated behind whatever
  blocks the account below.

**[RESOLVED 2026-08-16, session 17, live] The catch-resolution action is
`loot`.** User-captured via DevTools, one real payload:

```json
{
  "action": "loot",
  "actionToken": "1786897508188",
  "data": { "cards": [22], "nodeId": "", "focusPoint": [], "itemId": 0, "slotIndex": 0, "tierId": 0 }
}
```

Same envelope shape as `play_cards`/`start_run`, only `data.cards` differs
in what it addresses: **the chosen card's real id from `cardsToAdd[].id`**,
NOT a hand-relative index (`22` is far too large to be a hand position — the
hand is 3-5 cards; `play_cards`'s `cards: [i]` is unambiguously a small
index by contrast). Verified end to end: `GET /fishing/state` afterward
showed `fullDeck` grown 10 → 11 and the account no longer rejecting
`start_run`. `doc.data.cardChosenId` (new field, `[CONFIRMED]`) is null/
absent on an unresolved catch and set to the chosen id once `loot` lands —
this, not `fullDeck` length or `COMPLETE_CID`/`SUCCESS_CID`, is the
reliable "is this catch resolved" signal (the two-session-old guesses
`select_card`/`claim` were both cleanly rejected by the server's own
action whitelist — wrong names, informative rejections, not brute-forcing).
`scripts/liveFishing.ts`'s `runOneCast` now sends this automatically the
moment a catch's `cardsToAdd` offer needs resolving, via
`chooseNewCard` (`src/strategy/fishing/cardChoice.ts`, argmax hit-power per
mana — a placeholder heuristic, not sim-validated against full deck
composition). See QUESTIONS.md §10 and DECISIONS.md 2026-08-16 (session 17)
for the full history.

---

## 4a. Fishing oils — a full consumable layer, confirmed via `GET
/offchain/static` [2026-08-16, session 15]

Session-15 brief §2 flagged "fishing oils" from a live screenshot as
unmodelled. `gameItems[]` (same source as the heal-potion table in §5)
carries a complete, structured effect table for every oil, `triggerType:
"OnUseFishing"`, three tiers each (Lil/Mid/Big):

| effect | type | Lil / Mid / Big amount |
|---|---|---|
| draw extra cards | `FishingDrawCards` | 1 / 2 / 3 |
| direct fish damage | `FishingDamageFish` | 1 / 2 / 3 |
| restore mana (`playerHp`) | `FishingRestoreMana` | 1 / 2 / 3 |
| boost Fintuition chance | `FishingFintuitionBoost` | 3 / 6 / 10 |
| boost crit chance | `FishingCritBoost` | 1 / 2 / 3 |
| **restore `focusMeter`** | `FishingRestoreFocus` | 1 / 2 / 3 |
| boost Dual Yield chance | `FishingDualYieldBoost` | 20 (Lil) / 40 (Mid) / 60 (Big), no Big listed as of this capture |

**`FishingRestoreFocus` directly answers part of DECISIONS.md 2026-08-15
(session 13)'s open `focusMeter` regeneration question**: the meter does NOT
regenerate on its own within a cast (still true, unchanged), but a Focus Oil
is the mechanism to restore it mid-cast on purpose — not a bug or an
unmodelled passive regen, a consumable choice.

Corroborating live fields already present in every captured board state but
previously unexplained: `fintuitionOilBoostPercent`, `dualYieldOilBoostPercent`
(both 0 in every capture so far — no oil equipped), `consumablesUsed: 0`,
`fishingConsumableSlotUsed: [false,false,false]` — **three consumable slots**,
matching the dungeon side's 3-potion loadout cap (DECISIONS.md 2026-08-15,
session 11) structurally, though not confirmed to be the same number for the
same reason. `itemId`/`slotIndex` on the `play_cards`/`start_run` envelope
(SPEC-fishing.md §2, previously "[VERIFY], community guesses consumable
slot") are now very likely this — not independently confirmed by a captured
oil-use request, but the field names and the 3-slot shape line up exactly.

**Not modelled in the sim or the live loop** — this is a capture finding
only, per this session's read-only-except-fishing-casts scope. `Rod`
equipment (checked the same session, see below) does NOT carry oil slots or
effects in `GET /gear/items`; oils are a separate consumable layer, matching
the brief's framing.

**Item-name -> effect mapping [session 43]**: the table above resolves
effect *types* but not which real item name maps to which — checked
directly against `fixtures/fishing-casts/item-metadata-sample.json`'s
`gameItems[]` while implementing §8's oil-reserve heuristic, since acting on
a name (per DECISIONS 2026-08-15's "don't infer from the name" discipline)
first needs the name resolved to a real effect, not assumed from what it
sounds like:

| item name | docId | `itemEffect` |
|---|---|---|
| Mid Focus Oil | 942 | `FishingRestoreFocus`, amount 2 |
| Mid Relaxing Oil | 937 | `FishingDamageFish`, amount 2 |

Confirms "Mid Relaxing Oil" is a **direct fish-damage** consumable, not a
calming/mana effect the name alone would suggest — this matches the
session-43 brief's own use case for it exactly (a fish at low HP with no
sure card-based kill is a legitimate spend), so the name is misleading but
the mechanic is right where the brief expected it. "Mid Mana Oil" (docId
939, not "Relaxing Oil") is the actual `FishingRestoreMana` item.

## 4b. Rod equipment — checked, found no encoded spell-set effect
[2026-08-16, session 15]

SPEC.md §5 has carried "Rods grant a starting spell set" as **[INFERRED,
corroborated by capture]** since session 11. This session checked it directly
against `GET /gear/items` (public, no auth) for all 8 rod entries
(`GEAR_TYPE_CID: 9`, including "Dendren Rod" id 923 and the account's
currently-equipped "Makeshift Rod" id 922, per `GEAR_CID_array` on the live
fishing doc) — every rod's `itemEffects[].effects[].effects` array is
**empty** at every one of its 4 durability tiers, `triggerType:
"OnStartFishing"` with no listed effect. Whatever a rod's starting-spell-set
effect is (if it's real), it is not encoded in this endpoint's `itemEffects`
the way dungeon gear's stat bonuses are (§4a's oils and CLAUDE.md §1
comparison: dungeon head gear like id 12 carries real
`IncreaseDamage_Shield` effects in the identical field shape). **Stays
[VERIFY]** — checked and found nothing, not narrowed to "no effect," same
epistemic status as session 08's `intuition` rare-field check
(DECISIONS.md 2026-08-14).

---

## 3. Dendren's identity — resolved with one caveat

**Task 7's gate asks for Dendren's node ID resolved into
`config/discovered.json`. Done, with the caveat below stated plainly.**

Two different identifiers appear, and they do **not** obviously agree:

- **`nodeId: "5"`** — the literal value sent in the `start_run` request that
  produced this (Dendren) cast. **[CONFIRMED-BY-CAPTURE]**: this is the value
  that actually worked, for the cast the user was asked to play at Dendren
  Pond specifically (session-11 brief checklist). It is NOT confirmed by any
  wire field that names it "Dendren" — no response ever echoes `nodeId` back
  with a label attached.
- **`pondId: 2`** — appears in `GET /fishing/state`'s `pondEntryTiers[]`,
  whose three entries are literally named `"dendrenpond-tier1"`,
  `"dendrenpond-tier2"`, `"dendrenpond-tier3"`, all three carrying
  `pondId: 2`. **[CONFIRMED]** by name, unambiguously: pond 2 is Dendren
  Pond.

These may be the same underlying concept under two different field names on
two different endpoints (`nodeId` on the action request, `pondId` on the
state read), or `nodeId` may be something else entirely that happens to
equal 5 in this one capture (the response's own `gameState.ID_CID` is also
`5`, but that field is populated by the SERVER after `start_run`, so it
cannot be what the client sent nodeId to select — it's more likely the run's
own instance id, matching `DUNGEON_ID_CID`'s role on the dungeon side, than
proof `nodeId` means "5 = Dendren"). **Do not assume `nodeId` and `pondId`
are interchangeable without a second pond's `start_run` capture to test it
against.**

`config/discovered.json`'s `dendren` block records both values distinctly,
not collapsed into one "the ID" field — see the file itself.

`tierId: 1` on the captured `start_run` — cross-referencing
`pondEntryTiers`, tier 1 (`dendrenpond-tier1`) has `inputItems: []`, i.e. the
free tier. **[CONFIRMED]** this is what tier 1 means; tiers 2/3 (item-gated,
`dropMultiplier` 2/4) were never captured being entered, same pattern as the
dungeon side's `entryData` tiers.

`node0Energy: 12`, `node1Energy: 16`, `node2Energy: 20` on `GET
/fishing/state` — **[INFERRED]** these are the energy cost of tier 1/2/3
*within Dendren specifically* (index 0/1/2 matching `pondEntryTiers`'
tier 1/2/3), by naming pattern and because they match the community note's
independently-sourced "Small 12, Normal 16, Big 20" figures almost exactly.
Not independently confirmed — only tier 1 (12 energy, by this reading) was
ever actually entered in this capture. `maxPerDay: 10` / `maxPerDayJuiced:
20` similarly match the note's daily-cap figures.

---

## 4. Board state (`doc.data` on a POST response, `gameState.data` on the
GET) — one shape, two wrappers

**[CONFIRMED]** `POST /fishing/action`'s `data.doc` and `GET
/fishing/state`'s `gameState` are the identical shape (`docId`, `data`,
`COMPLETE_CID`, `IS_JUICED_CID`, `MULTIPLIER_CID`, `SUCCESS_CID`) —
`src/api/fishing.ts`'s `FishingGameDocSchema` covers both.

Field-by-field, from the captured board (`doc.data`):

| field | meaning | confirmed how |
|---|---|---|
| `playerMaxHp`/`playerHp` | **mana**, not health — every play cost exactly 1 (10→9→8→7→6→5 across 5 plays), matching `manaCost: 1` on every card in this capture's hand. **[CONFIRMED]**. Corroborates the community note's "playerHp is actually mana" claim exactly. |
| `fishHp`/`fishMaxHp` | the catch meter — driven toward 0 to land the fish, driven UP by a miss. **[CONFIRMED]**: `missEffects` amounts are negative (heal the meter), `hitEffects` positive (damage it), matching every observed `FISH_HP_DIFF` sign. |
| `fishPosition`/`previousFishPosition` | `[x, y]`, 1-indexed. **[CONFIRMED]** present and changing every turn. The specific movement RULE (fixed pattern per cast) is **[VERIFY]** — 5 moves is not enough to fit a pattern library against; see §6. |
| `gridSize` | **4** in this capture (Dendren). **[CONFIRMED]**. Contradicts `SPEC.md §5`'s "3×3 grid" — that description is the SIMPLER ponds' shape (pond 1), not Dendren's. Corrected in `SPEC.md`. |
| `focusPoint` | the bobber's cell. **[CONFIRMED]** moved mid-cast (`[2,2]` → `[3,3]`), carried on the NEXT `play_cards` request — a move and a card play are one action on this grid, matching the community note. |
| `focusMeter`/`focusMeterMax` | bobber move budget, both `3` throughout this capture — present, but un-spent-looking here since the original capture never moved the focus point more than a couple cells. **Spend rule [CONFIRMED 2026-08-15, session 13, live]**: costs the Manhattan distance from the CURRENT focus point, out of a 3-point budget that does **not** regenerate within a cast (regeneration ACROSS turns is still `[VERIFY]` — no cast has ever tested it). This project's first live cast moved it `3/3 → 3/3 (dist 0) → 2/3 (dist 1) → 1/3 (dist 1)`, then a 4th move of distance 2 with only 1 point left was REJECTED outright (`HTTP 400`) — the cap is enforced server-side, not just a display number. `src/strategy/fishing/cardChoice.ts`'s `chooseCard`/`bestFocusForCard` take an optional `FocusBudget` to respect this. **[MODELLED 2026-08-15, session 14]** `src/sim/fishing/castSim.ts` now tracks this budget too (`FOCUS_METER_MAX`, `defaultStartFocus`) — modelling it alone drops the 500-cast catch rate from 92.4% to ~70%, real but not the dominant explanation for the sim-vs-live gap. See `SPEC.md §5` for the fuller finding (the pattern-library mismatch is the bigger cause) and `scripts/fishFocusMeter.ts` for the measurement. |
| `focusMechanicEnabled` | `true` for this (Dendren) cast. **[CONFIRMED]**. The community note says this is `false` on the simpler 3×3 ponds — not independently verified here (no second-pond capture), but consistent with the `gridSize`/`pondId` split above. |
| `hand`/`discard`/`fullDeck`/`nextCardIndex`/`cardInDrawPile` | **[CONFIRMED]** — `hand` shrinks by the played index and `discard` grows by the played card's id every turn, exactly as needed to implement `cards: [handIndex]`. |
| `deckCardData` | the card catalog **as it applies to this cast** — see §6 for a live finding about `isDayCard` entries here. |

**Card hitboxes are bobber-relative, not absolute, on this grid — [CONFIRMED
2026-08-15, session 12]**, upgraded from "[VERIFY, but very likely correct]"
by independently re-deriving it from the capture: turn 3 is the cast's one
genuine hit (card id 79, `hitZones [2,4,6,8]`, submitted `focusPoint [3,3]`),
and the fish's post-move cell `[3,4]` equals `focusPoint + offset(zone 8) =
[3,3]+(0,1)`, matching the 1–9 template exactly — no other reading of
"absolute cell 8" produces a hit here. The submitted `focusPoint` scores
against the fish's position **after** that turn's move, not before (you're
betting on where it lands, not where it already is) — also confirmed by this
same replay, since the fish's *pre*-move cell `[4,4]` is not in the
translated hit set. Full derivation and the zone-offset table in
`SPEC.md §5`. Do not build a fixed-absolute-zone model for Dendren; the
community note explicitly warns this "looks right on 3×3 and breaks on
4×4," and this capture confirms it rather than just corroborating it.

---

## 5. Item metadata — resolves `QUESTIONS.md §3`'s other half

`GET /items/balances` returns **only** `ID_CID` + `BALANCE_CID` — no names,
confirmed directly (`fixtures/fishing-casts/cast.json` isn't it; see the raw
capture). Two endpoints resolve an ID to something readable:

- **`GET /api/indexer/gameitems`** — `entities[]`, each `{docId, NAME_CID,
  ...}`. Name only, no description or effect. **[CONFIRMED]**: `docId "845"`
  → `NAME_CID "Hard Core"` (the leaderboard-scored item — corroborates the
  community note's "Cores = item #845" claim exactly).
- **`GET /api/offchain/static`**'s `gameItems[]` — the richer source. Same
  `docId`/`NAME_CID` plus `DESCRIPTION_CID`, `TYPE_CID`, `RARITY_CID`, and
  (the genuinely new find) **`itemEffect`** — a structured effect
  description, not prose. **[CONFIRMED]**, directly answering session-11
  brief §7's open question about the pre-committed heal potions:

  | item | docId | `itemEffect` |
  |---|---|---|
  | Lil Heal Juice | 151 | `OnUseBattle` → `Heal` **flat +4** |
  | Mid Heal Juice | 155 | `OnUseBattle` → `Heal` **flat +8** |
  | Big Heal Juice | 131 | `OnUseBattle` → `Heal` **flat +20** |

  All three: `durabilityChange: -1`, `playerType: "ThisPlayer"`,
  `statusType: "None"`. **Flat heals, not percentage** — settles one branch
  of the brief's open question outright.

  **Still open, and this capture cannot settle it**: `triggerType:
  "OnUseBattle"` names WHEN the effect is eligible to fire (during a
  battle), not HOW it gets triggered — an automatic proc on some condition
  (e.g. an HP threshold) versus a client-side manual `use_item` action are
  both consistent with this string. This fishing capture contains no
  dungeon battle where a potion was consumed, so the trigger mechanism
  is **[VERIFY]** regardless. Needs either a live dungeon run where
  `consumables` is non-empty in `start_run` and a heal is observed firing
  mid-battle, or a direct answer from the user.

`fixtures/fishing-casts/item-metadata-sample.json` holds a size-bounded,
redacted subset of `gameItems[]` (every `TYPE_CID: "Consumable"` entry, item
845, and everything the capturing account held) rather than the full
~625-entry catalog — `scripts/parseHar.ts`'s header explains why.

---

## 6. Live finding: `isDayCard` entries carry `null`, not a number

**[CONFIRMED, session 11]** Every `deckCardData` entry with `isDayCard:
true` in this capture's mid-cast board state had `startingAmount: null` AND
`unlockLevel: null` — every non-day card had both as plain numbers. On the
full `GET /fishing/cards` catalog, the same two fields are sometimes
**absent entirely** (not even `null`) rather than explicitly `null`, on a
different subset of entries. `src/api/fishing.ts`'s `FishingCardSchema`
types both fields `z.number().nullable().optional()` to cover both wire
shapes — a plain `z.number()` (the naive guess) would reject roughly a
third of the catalog. Per CLAUDE.md §1: the live response is right, the
naive schema was wrong, corrected here rather than silently loosened.

---

## 7. Not attempted this session

- **Fish movement pattern identification** (`SPEC.md §5`'s hypothesis-set
  matcher). One 5-move cast is not enough signal to confirm or refute the
  community note's four-pattern taxonomy (`step1`/`diag1`/`line2`/`jump2`).
  Logging real casts to `data/fish-patterns.jsonl` from the first live
  fishing run (Task 9) is still the right mechanism per `SPEC.md §5` — this
  capture doesn't shortcut that.
- **A second pond's `start_run`**, to settle whether `nodeId`/`pondId` are
  the same concept (§3).
- **A catch** (`SUCCESS_CID: true`) and a **redraw** — both genuinely
  uncaptured; their wire shapes stay `[VERIFY]` until a live cast produces
  one.

---

## 8. Strategy heuristics — user-stated, 2026-08-18, session 43

**Terminology note**: what has informally been called the "bobber"/"bobble"/
"center point" elsewhere in this project's own scratch discussion is the
`focusPoint` field documented in §3/§4 above — the internal name was already
correct; this section (and the code implementing it) writes "FocusPoint"
consistently.

Six heuristics from the user's own manual play. Four are concrete enough to
implement directly as pure functions (`src/strategy/fishing/heuristics.ts`);
two are judgment calls encoded as documented decision points instead of a
single scoring formula, per the user's own framing of them.

**(a) Center bias.** Bias FocusPoint toward the grid's central 2×2 square;
avoid sitting on an edge without urgent need — from an edge, the 3-charge
Focus budget may not reach the fish if she jumps to the opposite side.
**Implemented** as a tie-break (`isCentralSquare`), inserted between the
coverage tie-break (f) and the existing focus-movement-cost tie-break in
both `bestFocusForCard` (within one card's own focus search) and
`chooseCard`'s cross-card `isPreferred`. Deliberately a tie-break, not a
scored term added to EV — it can only ever decide between options already
equal on real EV/coverage ("urgent need" always wins first), matching the
user's own "without urgent need" qualifier exactly. NOT corpus-validated:
no live cast has measured whether staying central actually raises catch
rate, only that the reasoning (corner-to-corner costs `2*(gridSize-1)` >
the 3-point budget on any grid ≥ 3) is geometrically real.

**(b) Deliberate non-scoring play.** It can be correct to play a
losing/non-scoring card, or redraw the hand, purely to let the fish drift
closer to FocusPoint first — not always taking the best-looking immediate
card. **A judgment call, not encoded as a function** — `chooseCard`'s EV
formula already looks one turn ahead (the current distribution), not
several turns of fish drift, and modelling "drift toward FocusPoint over N
future turns" would need a multi-turn lookahead this project doesn't have
(the sim's `castSim.ts` plays turn-by-turn but `chooseCard` itself is
single-turn-greedy). Documented as a known limitation in `cardChoice.ts`'s
`chooseCard`/`shouldRedraw` header comments rather than forced into the
existing single-turn EV formula.

**(c) Oil reserve floor.** Always hold at least one Mid Focus Oil (itemId
942) and one Mid Relaxing Oil (itemId 937, see §4a's addendum above — a
direct fish-damage oil, not the "calming" effect its name suggests) in
reserve; they don't need to fire every cast, but a fish at low HP with no
sure card-based kill in the next few cards is a legitimate case to spend
Mid Relaxing Oil. **A judgment call, encoded as a documented decision
point, not a firing function**: `src/strategy/fishing/oilPolicy.ts` names
the reserve floor (1 of each) and a low-fish-HP threshold as config
constants, and a pure `shouldConsiderRelaxingOil(fishHp, fishMaxHp,
relaxingOilHeld)` helper that returns whether the *situation* qualifies —
it does NOT send anything. **This cannot go further than a recommendation
yet**: per CLAUDE.md §2 ("never invent an endpoint"), no request shape for
actually consuming a fishing oil mid-cast has ever been captured — §4a
above already flags this exact gap (`itemId`/`slotIndex` on the existing
envelope are "very likely" the mechanism, not confirmed). Recorded as an
open capture blocker in `TASKS.md`/`QUESTIONS.md`, not guessed past.

**(d) No immediate return after a 1-cell move.** A fish that just made a
1-cell move never returns to the cell it just came from on its next move.
**Implemented** as `pruneReturnToPrevious` — zeroes the forbidden cell's
probability mass in whichever distribution the matcher/fallback pipeline
produced and renormalizes the rest, applied in `scripts/liveFishing.ts`
right before `chooseCard` (skipped when the `nextPosition` override is
active — that branch is already a single-cell certainty from a separately-
gated, previously higher-confidence mechanism). **NOT corpus-validated**:
no audit of `data/fish-patterns.jsonl` has confirmed this against real
1-cell-move-then-reversal sequences yet — implemented because it is
concrete and cheap to apply, not because it has been checked. A future
audit that finds a counterexample should remove the call, not explain it
away.

**(e) Edge positions are more predictable after a 2-cell move.** A fish
that just made a 2-cell move is easier to predict when she's on the edge
of the field and the player is centered in the middle 2×2. **Implemented
narrowly** — `candidateCellCount(cell, gridSize, radius)` is the one piece
of this claim that is a geometric fact rather than a probabilistic one: an
edge/corner position has strictly fewer in-grid cells within a given
Manhattan radius than a central position does (some directions run off the
board), so it has a smaller candidate set — "easier to predict" in the
narrow sense of fewer live hypotheses, independent of which specific cell
among them the fish actually favors. Does NOT claim a probability skew
toward any particular cell in that smaller set — that would need corpus
evidence this project doesn't have. The "player centered" half of the
claim is heuristic (a) itself; the two are only a genuine combined
advantage (an edge fish is both more constrained AND within the centered
player's 3-point reach) when applied together, which they are, but
independently, not through any shared mechanism.

**(f) Coverage-maximizing card choice.** When choosing the next card,
prefer whichever covers the maximum number of cells the fish could
plausibly move to next, over just the highest single-cell expected value.
**Implemented** as `coverageCount` — an unweighted count of distinct
distribution-support cells a (card, focus) placement's hit ∪ crit zones
touch, inserted as a tie-break immediately after the EV comparison (ahead
of the centering tie-break (a) and the existing movement-cost one) in both
`bestFocusForCard` and `chooseCard`'s `isPreferred`. Framed as a tie-break
rather than the primary objective because `evaluateCardAtFocus`'s EV
formula already sums PROBABILITY-WEIGHTED outcomes across every cell a
card's zones intersect with the distribution's support — a more rigorous
generalisation of "single-cell EV" than the heuristic's own framing
describes (the user's own manual-play heuristic is a simplification of
what the EV formula already does more precisely), so coverage is added as
a hedge-breadth signal among EV-tied options, not a replacement for EV.

Tests: `tests/fishing/heuristics.test.ts` (all four implemented functions,
synthetic — no live cast fixture happens to exercise any of them yet) and
`tests/fishing/cardChoice.test.ts`'s new "coverage and centering
tie-breaks" block (confirms the tie-breaks actually fire, with a real EV
tie proven by direct `evaluateCardAtFocus` calls, not just asserted).
