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
slot") are these — **CONFIRMED 2026-08-18, session 44**, by a user DevTools
capture of a real `use_fishing_item` action (item 821, Lil Mana Oil):
`{action:"use_fishing_item", actionToken:"<string>", data:{cards:[],
nodeId:"", focusPoint:[], itemId:821, slotIndex:0, tierId:0}}`. Resolves
QUESTIONS.md §16. `slotIndex:0` is confirmed only for THIS item; whether
Mid Relaxing Oil (937) also sits at slot 0 is an unconfirmed, fail-closed
hypothesis at its live call site (`scripts/liveFishing.ts`) — see
`src/api/fishing.ts`'s `FishingActionSchema` doc comment and DECISIONS.md
2026-08-18 (session 44).

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

**[CORRECTED 2026-08-19, session 47] The bobber-relative FINDING above is
right; session 12's zone-offset TABLE was the transpose of the truth and
shipped that way for eleven sessions.** Card 79's `hitZones [2,4,6,8]` is
transpose-symmetric, so the one capture this was derived from could not
discriminate the two tables — and nothing re-checked the table against the 68
casts that accumulated afterwards. Against all 282 recorded plays the
corrected table predicts the server's hit/miss **282/282**; session 12's gets
54 wrong. `position[0]` is the ROW, established independently from
`lastMovePath`'s cell indices (289/289). The corrected table and both lines of
evidence are in `SPEC.md §5` and `src/sim/fishing/geometry.ts`'s header;
`scripts/auditZoneTemplate.ts` re-scores it as the corpus grows, and
`tests/fishing/zoneTemplate.test.ts` is the regression guard that did not
exist before.

The generalized lesson, which is the same one heuristic (d) and the
`.message` server-cap classifier each taught (§8, session 46): **a fact
confirmed against a sample that could not have falsified it is not
confirmed.** All three cases had a real mechanism, a plausible derivation, and
an evidence base blind to the specific way the claim was wrong. The cheap
guard is not more care at derivation time — it is re-scoring the claim against
the corpus once the corpus is big enough to bite.

## 4c. `chooseCard`/`bestFocusForCard` chronically overspend the focus
budget in the first 2-4 turns of a cast, then play blind for the rest of
it — [session 44, live AND sim-confirmed, THE dominant finding of this
session]

The user's own live observation, mid-diagnosis of a 0/16-caught session
(`handoff/log/session-44.md`, live batch below): reviewing the account's
real mid-cast state directly showed `7/10 mana, 0/3 focus` — the ENTIRE
non-regenerating 3-point focus budget (§4 above) already spent, this early
in the cast. Checked directly against this session's own live log
(`logs/fishing-2026-08-19-00-52-19.jsonl`, 16 completed casts): **every
single cast reaches `focusMeter: 0` within turns 1-4** (never later), and
from that turn onward the bot is aiming from a FROZEN `focusPoint` for
however many turns remain — several casts (4, 5, 8, 9, 10, 12, 13, 14, 15)
played 5-9+ MORE turns after going blind, and the `fishHp` trajectory
during those turns is almost pure misses (the meter climbing back toward
`fishMaxHp`/escape) rather than progress toward a catch. Cast 4 got the
fish to HP 2 (one hit from a kill) at turn 4, immediately before focus ran
out, then missed 5 turns straight and escaped.

**This is not a live-only surprise — the exact same behavior is already
baked into the sim's own numbers.** A direct instrumentation of
`castSim.ts`'s own `simulateCast` decision loop (same `chooseCard`/
`bestFocusForCard` code, N=300, matcherPool seeded from the real mined
library) found **129/300 (43%) of simulated casts exhaust the full 3-point
budget by a median of turn 2** (mean 1.93, min 1, max 6) — yet the sim
still nets a 72/300 (24%) catch rate despite this, because a card's hit
zone can still cover several OFFSET cells around a frozen focus, so some
catches still land by luck even blind. `scripts/fishFocusMeter.ts`'s
session-14 finding ("modelling the budget alone drops 92.4%→~70%") already
showed the budget MATTERS; this session's finding is sharper — it isn't
just that the budget constrains movement, it's that the current EV formula
has no notion of PACING that spend across a cast of unknown remaining
length, so it burns the whole budget almost immediately whenever doing so
looks even marginally better in THIS turn's single-turn EV.

**Root cause**: `bestFocusForCard`/`isPreferred` (`cardChoice.ts`) are
purely single-turn-greedy — they maximize EV *this turn* within
`reachableCells(gridSize, focusBudget.current, focusBudget.remaining)`,
with zero cost assigned to spending down a scarce, non-regenerating,
multi-turn resource. The existing focus-movement tie-break
(`DECISIONS.md` 2026-08-18 session 31, CODEXIMPROVE #2) only conserves
budget on a genuine EV TIE — it does nothing when there's ANY positive EV
edge to moving, however small, which is nearly always true early in a cast
before the matcher has converged.

**Not fixed this session, by explicit user direction** (asked directly:
document-only vs. design-and-validate-a-fix-now; user chose document-only)
— this project's own hard rule (CLAUDE.md §4, "simulate first") means an
unvalidated fix has no business shipping live regardless. **The clear next
step, and the dungeon side of this project already has the exact template
for it**: `src/strategy/utility.ts` hit an almost identical problem
(players spending a resource greedily with no value on holding some in
reserve) and fixed it with a continuation term pricing the VALUE of
retained resource (`chargeReserveWeight`, DECISIONS.md 2026-08-18 session
34) — sim-ablated at N=20000-60000 across multiple weights before shipping
non-zero. The same shape almost certainly applies here: a term in
`bestFocusForCard`'s scoring (or a new pacing rule) that prices remaining
`focusBudget.remaining` against expected remaining cast length, ablated in
the sim exactly the way `scripts/chargeReserveAblation.ts` did for the
dungeon side, BEFORE any live wiring. See TASKS.md Task 11's fishing
section for this scoped as the clear top priority.

---

**[session 45] FIXED — the focus-reserve continuation term.**
`cardChoice.ts` gains `focusReserveFraction` and a `focusReserveWeight`
parameter on `bestFocusForCard`/`chooseCard`:

```
reserveFraction = max(0, focusBudget.remaining − manhattan(current, focus)) / FOCUS_METER_MAX
score(card, focus)  = ev(card, focus) + focusReserveWeight * reserveFraction
```

`score` is the new primary sort key in both `bestFocusForCard` and
`isPreferred`; raw `ev` is kept alongside it and is still what `isLethal`,
`isManaConstrained` and all reporting use — the reserve term prices a FUTURE
option, and letting it into a lethality or mana-sufficiency test would be a
category error. The parameter defaults to `0`, so every pre-session-45 caller,
test and sim script is byte-for-byte unchanged; `DEFAULT_FOCUS_RESERVE_WEIGHT
= 3` is what `scripts/liveFishing.ts` passes. `FOCUS_METER_MAX` moved
`castSim.ts` → `geometry.ts` (already the shared strategy/sim dependency, and
already the home of the spend rule's documentation) so strategy does not
import from the simulator; `castSim.ts` re-exports it.

Swept by `scripts/focusReserveAblation.ts` against the EMPIRICAL fish (§9),
real deck and real parameters, N=12000, two far-apart seeds, on the arm that
ships — ring model plus mined matcher:

| w | 0 | 0.5 | 1 | 2 | **3** | 4 | 6 | 8 | 12 |
|---|---|---|---|---|---|---|---|---|---|
| seed 1 | 38.6% | 38.4% | 38.6% | 39.5% | **40.0%** | 39.6% | 39.9% | 38.4% | 35.3% |
| seed 2 | 37.4% | 37.5% | 37.9% | 38.7% | **39.2%** | 38.8% | 39.3% | 37.9% | 35.4% |

The same inverted-U-with-plateau the dungeon side's `chargeReserveWeight`
found, peaking at 3 on both seeds and collapsing past 8. 3 also sits inside the
real deck's `hitEffect` magnitudes (3-6), which is the intended sanity check: a
weight worth more than a whole hit would be buying a future option at an
obviously wrong price.

**The lift is +1.6pp, not the ~+5pp the session-45 brief projected.** Stated as
measured. A 2-ply focus lookahead was tested by that brief against this flat
term at matched N and lost (32.4% vs 33.6%) at a large constant factor, so the
flat form is deliberate, not a shortcut.

The mechanism does move, which is the part that generalizes beyond the sim's
optimism: share of casts exhausting the focus budget, N=3000,

| arm | w=0 | w=3 | w=8 |
|---|---|---|---|
| live config | 79.5% (median turn 4) | 69.5% (turn 4) | 50.5% (turn 5) |
| ring model | 73.9% (turn 5) | 60.9% (turn 5) | 13.0% (turn 7) |

Note the live-config w=0 figure of 79.5% at median turn 4: that DOES reproduce
session 44's live 16/16 at turns 1-4, and is the check that the simulated
defect is the same defect. An earlier version of `focusReserveAblation.ts`
showed 1.6% here — that arm was mis-specified (it omitted the contextual
fallback tier `liveFishing.ts` really wires, leaving the sim on a uniform
distribution where every focus placement is EV-identical and the tie-break
therefore never moves the focus at all). Worth remembering as a failure mode:
a sim arm labelled "today's live config" is worth exactly as much as the care
taken to make it one.

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
relaxingOilHeld)` helper that returns whether the *situation* qualifies.
**[session 44] Now HAS a live call site**: a user DevTools capture
confirmed `use_fishing_item` (§4a above, QUESTIONS.md §16 RESOLVED),
and `scripts/liveFishing.ts`'s `runOneCast` now spends Mid Relaxing Oil
when `shouldConsiderRelaxingOil` says so, reading the account's real
balance via `GET /items/balances` once per cast. The captured request
used a different item (821), so `slotIndex:0` for item 937 is a stated,
fail-closed hypothesis (a rejection is caught, logged, and skipped —
does not halt the cast), not an independently confirmed value. Mid Focus
Oil's `aboveReserveFloor` gate has no captured trigger condition of its
own and stays recommendation-only.

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

**[session 44] Two new, independent checks — neither found a live counterexample, but one found a real sim-domain regression worth flagging honestly.**
`scripts/auditPruneCounterexample.ts` (new) walks every clean cast in the
real corpus (169 transitions, 50 casts) for a literal instance of this
heuristic's exact failure case: **0 counterexamples found**. Not proof the
heuristic is right — merely that it hasn't been caught wrong yet, same
epistemic status the rest of this section already states.

Separately, `scripts/fishingHeuristicAblation.ts` (new) found this
heuristic causes a REAL, reproducible ~2 percentage point catch-rate
REGRESSION in the sim's own synthetic domain (N=20000, two independent
seeds, matcherPool seeded from the real 2-pattern mined library):
21.9%/22.1% (heuristic on) vs. 23.8%/24.2% (off) — non-overlapping 95%
CIs (±~0.6pp each), and isolating (d) from heuristics (a)/(f) (which
showed no measurable effect either way, exactly as their "provably
EV-neutral" tie-break design predicts) confirms (d) alone accounts for the
entire gap. The mechanism is identifiable and sim-specific: `patterns.ts`'s
`bounceDelta` (a billiard-style wall reflection, part of the 23-primitive
synthetic pool this sim's true patterns are drawn from) literally DOES
return to its predecessor cell on the exact turn it bounces off a wall —
that is the correct move for that pattern, and this heuristic actively
zeroes it out. Per the standing "sim authority is earned per domain" rule
(DECISIONS.md 2026-08-15, session 14), this is evidence about the SIM's
own synthetic domain (specifically, that domain's literal billiard-bounce
mechanic), not live evidence about real Dendren — the real-corpus audit
above found no matching failure, and whether real Dendren has a genuine
"bounce" mechanic at all is unconfirmed (the real corpus's own `bounce(...)`
near-misses, §0 above, are partial trajectory matches, not exact ones).
Not acted on this session (no removal, no gating) — flagged here per this
heuristic's own "don't explain it away" instruction, as a real, monitored
finding rather than a null result, and specifically as the mechanism a
future audit should watch for if real Dendren ever turns out to have a
reflection-style movement pattern.

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

**[session 45] The (d) verdict above is CORRECTED: it was measured against a
fish this game does not have.** The trace to `bounceDelta` was right; the
conclusion drawn from it was backwards. The real corpus has **0 reversals in
109 k=1 observations** (§9, FACT 2), so `bounceDelta`'s billiard bounce models
behavior real Dendren never shows — the SIM was wrong, not the heuristic.
`src/sim/fishing/empiricalFish.ts` (new) replaces the sim's synthetic
ground-truth fish with a sampler over the real corpus's ring/conditional
statistics, and `scripts/fishingEmpiricalAblation.ts` re-runs the ablation
against it. At N=20000, two far-apart seeds, real deck and real parameters,
with the distribution pipeline `liveFishing.ts` ACTUALLY wires (mined matcher →
`contextualFallback`, not the hardcoded uniform an earlier version of that
script mis-specified):

| arm | (d) OFF | (d) ON |
|---|---|---|
| empirical fish, live config | 24.8% / 24.6% | 24.6% / 24.6% |
| synthetic fish, live config | 14.3% / 15.1% | 14.0% / 14.8% |
| empirical fish, ring model | 33.2% / 32.9% | 33.1% / 32.7% |

So: **NEUTRAL against a realistic fish**, a ~0.3pp synthetic regression once
the live fallback tier is modelled (down from the ~2pp session 44 reported
against a mis-specified arm), and **redundant** once the ring model ships,
which is where it ends up. No code change — it is neither helping nor hurting.

Session 45 also confirmed the mechanical claim that (d) is gated on the wrong
thing: a k=2-only fish gives **byte-identical** numbers with (d) on and off
(45.8% / 45.6% in both arms), because the guard tests
`|prev.dx| + |prev.dy| === 1` — the DISPLACEMENT's Manhattan length, not the
step CLASS — so for a k=2 fish it is never true. It silently no-ops on exactly
the class where reversal is the single most likely move (39.2%). §9's
conditional table expresses both directions correctly and is the preferred end
state; (d) is left in place as a harmless no-op rather than removed, so the
change that retires it can be made deliberately rather than as a side effect.

**[session 46] (d) is now RETIRED — that deliberate change, made.** The
function, its `castSim.ts` option, its `liveFishing.ts` call site, its five
unit tests, its ablation arms, and `scripts/auditPruneCounterexample.ts` are
all removed. `src/strategy/fishing/heuristics.ts` carries a tombstone comment
in its place.

The reason for deleting rather than keeping a no-op: **a dead guard that looks
like it encodes a movement rule is worse than either enforcing the rule or
removing it.** The next reader sees a function named `pruneReturnToPrevious`,
assumes reversal is handled there, and stops looking for §9's conditional
table — which is where it is actually handled, and handled correctly in both
directions.

This whole arc is kept here as a worked example, because the shape of it
recurs: **user-proposed → implemented unverified → measured as a regression
against a synthetic fish the game does not have → corrected to NEUTRAL against
the empirical fish → retired as subsumed by a measured rule.** Sim authority is
earned per domain, not assumed; and a heuristic's *stated* claim can be right
in spirit while the *implemented* guard tests the wrong field entirely.

That second failure mode is not hypothetical or confined to (d). Session 46
found the identical shape in production code the same day: `runOneCast`'s
server-cap classifier tested `/reached max runs/i` against an Error's
`.message`, a string the server's text can never appear in (it lives in
`UnexpectedResponseError.body`), so that branch had been dead since session 29.
It was found only because a live HTTP 400 needed diagnosing. **When a guard's
condition names a fact, check which field it actually reads.**

Tests: `tests/fishing/heuristics.test.ts` (all four implemented functions,
synthetic — no live cast fixture happens to exercise any of them yet) and
`tests/fishing/cardChoice.test.ts`'s new "coverage and centering
tie-breaks" block (confirms the tie-breaks actually fire, with a real EV
tie proven by direct `evaluateCardAtFocus` calls, not just asserted).

---

## 9. The step-class ring movement model **[session 45]**

The largest single finding about Dendren this project has made. Derived and
re-derivable with `scripts/auditStepClass.ts`; implemented in
`src/strategy/fishing/stepClass.ts`; gated by `scripts/fishingRingCV.ts`.

### FACT 1 — the fish walks a fixed Manhattan-`k` ring, and `k` is per-cast

Every move of a cast lands on the Manhattan-`k` ring around the fish's
CURRENT cell, and `k` is fixed for the whole cast. On the 68 clean casts /
279 transitions of `data/fish-patterns.jsonl` as of session 45's live batch:

| | |
|---|---|
| transitions at Manhattan distance 1 | 144 |
| transitions at Manhattan distance 2 | 135 |
| transitions at **any other distance** | **0** |
| multi-move casts whose every move has the same `k` | **66 / 66** |
| moves landing off the legal in-grid `k`-ring | **0 / 279** |

Only `k = 1` (35 casts) and `k = 2` (33 casts) are ever observed. This is the
user's own "1 box per move or 2 box per move, established on the first move",
confirmed exceptionlessly by the project's own corpus.

**Read the exclusion carefully.** The exceptionless claim holds on
`isCleanCast`-filtered casts. The RAW log contains one zero-length "move", two
off-ring moves and one `k`-inconsistent cast — all four from a single cast,
`12923189`, whose turn 0 carries two disagreeing records. That is the session-29
CODEXREVIEW #5 duplicate-turn artifact, a logging failure, not fish behavior,
and every trajectory analysis in this project already excludes it. Any future
restatement of FACT 1 must carry this exclusion; without it the fact reads as
having counterexamples when it does not.

FACT 1 was established on 66 casts and has since survived contact with 2 new
live casts (20 transitions) that were out-of-sample for it. It is treated as a
HARD CONSTRAINT: once `k` is known, every off-ring cell gets probability
exactly zero.

**[CORRECTED 2026-08-19, session 48 — the "`k` is per-cast" half is FALSE, and
`lastMovePath` says what is really true.]** Session 48's first live cast
(`12988700`) ran `k = 1, 2, 1, 2, 1, 2` across all six turns — a perfect
alternation, on a clean cast, not a logging artifact. That is 3 off-ring moves
and 1 `k`-inconsistent cast on the `isCleanCast`-filtered corpus, where the
standing figure was 0/279 and 66/66.

The field that explains it was on the wire from the first capture and nothing
had ever read it. `data.lastMovePath` is the server's own account of the move:
1-based row-major cell indices, **one per unit step**, ending on
`fishPosition`. Three identities, scored over every recorded turn by
`scripts/auditMovePaths.ts` and pinned by `tests/fishing/movePath.test.ts`:

| identity | ALL casts | clean casts |
|---|---|---|
| `lastMovePath.length == manhattan(previousFishPosition, fishPosition)` | **312/312** | **308/308** |
| `lastMovePath[last]` decodes to `fishPosition` | **312/312** | **308/308** |
| every hop along `prev -> ...path` is a **unit** step | **312/312** | **308/308** |

Steps-per-turn is only ever 1 or 2 (155 / 157 across all casts). So:

- **What is exceptionless** is the unit-step decomposition. The fish only ever
  walks one cell at a time; what varies is how many cells it walks in a turn.
  The quantity FACT 1 calls a "step class" is a **step COUNT**.
- **What is merely very common** is that the count is constant within a cast:
  **72 / 73 clean casts**. One alternates.

The `k`-as-hard-constraint treatment is therefore unsafe as written, and it
failed live in exactly the predicted way: the ring model locked `k = 1` from
cast `12988700`'s first move and then assigned ~0 probability to three
subsequent landings, giving that one cast a log-loss of **11.316** with 3
zero-probability events against a corpus LOO of 0.803 for `k = 1`.

The generalized lesson is session 47's, for the fourth time: **the refuting
evidence was in every capture from the beginning.** `data/fish-patterns.jsonl`
projects each turn down to `from`/`to` and discards the path between them, so
the corpus view used to FIT the movement model could not represent the thing
that breaks it.

#### [session 49] The fix: a sticky two-state count, not a hard ring

`src/strategy/fishing/stepClass.ts`'s `stickyStepDistribution` replaces the
hard constraint. The count is **observed** the moment a hop resolves, so
nothing here is a hidden-state filter — the only unknown is the NEXT turn's
count, and a two-state Markov chain on the last observed one is its whole
sufficient statistic:

```
P(next cell) = (1 - s) * P(cell | lastK) + s * P(cell | the other count)
```

- **`s` measured, not assumed** — `DEFAULT_SWITCH_PROBABILITY`. And the
  measurement has moved every time anyone has counted it, always upward:

  | counted at | switches / pairs | Laplace(+1) |
  |---|---|---|
  | session-49 brief, from memory | "one in ~309" | ~0.5-0.7% |
  | 73 clean casts | 5 / 238 | 2.50% |
  | **83 clean casts** | **14 / 281** | **4.98%** |

  (The 83-cast row read `14 / 284 = 5.25%` when session 49 wrote it; the
  denominator is 281 consecutive classifiable hop PAIRS, which is what the
  two-state chain actually models. The estimate is 4.98%, not 5.25% — a
  correction of the arithmetic, not of the finding.)

  The swept optimum tracks the estimator at every corpus size (0.02-0.025 at
  73 casts, 0.050 at 83), which is the check that the two are measuring the
  same thing.

  **[session 50] It is no longer a shipped constant.**
  `estimateSwitchProbability(casts, floor)` reads it off the clean corpus at
  load; `scripts/liveFishing.ts` calls it and logs the estimate, its `n`, and
  the shipped constant it is replacing on every run. A monotone trend
  (~0.6% → 2.50% → 4.98%) makes a constant stale by construction, and nobody
  knows where the trend stops. `SWITCH_PROBABILITY_FLOOR = 0.025` (the value
  the corpus itself supported at 73 casts) stops a thin corpus from collapsing
  it to zero — which is not "the fish never switches", it is the degenerate
  hard-ring case the sticky latent was built to remove.
  `DEFAULT_SWITCH_PROBABILITY = 0.05` stays as the default argument for
  callers with no corpus in hand, and at 83 casts it is right to 0.02pp.
  **Re-run `scripts/stickyStepSweep.ts` whenever the corpus grows and do not
  assume this has settled** — CLAUDE.md §9, an exceptionless count is a claim
  about the sample's power.
- **`lastStepClass` replaces `classifyStep`'s cast-wide mode** at every ring
  call site. The two agree on all 72 constant casts and disagree on every
  turn of the alternating one.
- The floor is **free** — no constant to justify. Off-count cells get about
  `s` spread over the alternate ring, capping a surprise at ~5 nats instead
  of the `-log(1e-9)` = 20.7 a true zero collapses to.
- Reclassification is automatic AND prompt: an off-ring landing changes
  `lastStepClass` for the very next prediction.

Measured, leave-one-cast-out on 73 clean casts / 235 scored transitions
(`scripts/stickyStepSweep.ts`):

Measured leave-one-cast-out at **83 clean casts / 281 scored transitions**,
after the two live batches this session added:

| arm | top-1 | logLoss | zero-prob events |
|---|---|---|---|
| shipped: cast-wide mode + hard ring | 42.3% | 1.689 | **8** |
| sticky: last count + marginal, s=0.05 | 41.3% | **1.337** | **0** |

Paired ΔlogLoss (sticky − shipped) **−0.351 [−0.982, +0.051]**, cluster-
bootstrapped over casts. Paired Δtop-1 **−1.07pp [−3.38pp, 0.00pp]** — the
mixture flips three near-tied argmaxes out of 281, a small real cost reported
rather than buried. All of the log-loss movement is the two alternating casts
(`12988700` −8.337, `12991364` −7.853); **79 of 83 casts move by less than
0.2**, which is the bounded cost of being wrong about the mechanism. The
CI's upper end of +0.051 is exactly that per-constant-cast cost, which is a
useful sanity check on the bootstrap.

**The zero-prob column is why this shipped when it did.** At 73 casts the
hard ring had 3 such events; ten casts later it has **8**, because
`12991364` — the second-ever alternating cast — turned up in the very next
batch and contributed 5 on its own.

`s = 0` is NOT the pre-session-49 model — it is the sticky arm's degenerate
case, using the last count rather than the mode, and it is *worse* on its own
(logLoss 1.576, 5 zero-prob events). **The win is the marginalisation, not
the switch from mode to last.** `ReplayOptions.hardRing` is the real
before-arm.

**On the replay the change is behaviorally INERT**: paired per cast on 73
clean traces, catch 22/73 and per-turn hit 119/233 are *identical* for every
`s` from 0 to 0.05 (+0/−0 casts, +0/−0 turns); only at s=0.1 does one turn's
card choice move. This is a calibration and robustness fix that removes an
unbounded-loss failure mode. **It does not raise the catch rate and was never
going to** — see §5c, the focus budget.

**Also newly readable, `data.nextMovePath` / `data.nextPosition`
(QUESTIONS.md §17):** 6 non-null observations, all on TERMINAL docs, and in
all 6 `nextMovePath` decodes to exactly `nextPosition` under the same
row-major rule. The server pre-rolls the next move; it is exposed only once
the cast is over and the move will never happen, so it is not an exploitable
mid-cast oracle. It does confirm the movement draw is server-side and
precomputed at least one turn ahead.

### FACT 2 — within a class, the next move is conditioned on the previous one, in OPPOSITE directions

| class | P(repeat previous delta) | P(exact reversal) | n |
|---|---|---|---|
| k=1 | 28.4% | **0.0% — 0 of 109** | 109 |
| k=2 | 3.9% | **39.2% — 40 of 102** | 102 |

A 1-step fish never backtracks. A 2-step fish backtracks more than it does
anything else. Both are large and neither was visible to any predictor this
project shipped before session 45, all of which were class-blind.

### FACT 3 — the deck's zone templates are built around the rings

`fixtures/fishing-casts/cards.json`'s hit-zone templates are not arbitrary:

- `{2,4,6,8}` (ids 8, 14, 27, 75, 79, 88, 98, 108) is exactly the Manhattan-1
  ring. Focus on the fish's own cell + one of these = **100.0% hit vs a k=1
  fish** (n=144), by construction.
- `{1,3,7,9}` (ids 7, 13, 19, 38, 74, 97, 107) is the diagonal subset of the
  Manhattan-2 ring: **71.3% vs a k=2 fish** (n=115) at the same placement.
- ring-8 `{1,2,3,4,6,7,8,9}` (ids 9, 12, 15, 18, 24, 25, 76, 89, 99, 109)
  covers both rings' intersection with the 3×3 window, at lower damage.

Focus co-location is worth 25-60 points of hit rate. The **diagonal-2** focus
offsets (±2,±2) are a near-**guaranteed miss vs a k=1 fish**. Note this is the
diagonal-2 offsets specifically, NOT all offsets at Chebyshev distance 2:
(2,0) is Chebyshev 2 and scores 40.3%.

**[RE-DERIVED 2026-08-19, session 48, brief §5a — under the corrected
`ZONE_OFFSET` and the current corpus.]** The session-45 brief warned that any
"best card" row naming a row/column zone triple (`{1,2,3}`, `{1,4,7}`, …)
had to be re-derived, because those triples swap roles under the transpose.
**No row of FACT 3 names one.** Every set it rests on — `{2,4,6,8}` (the
orthogonal neighbours), `{1,3,7,9}` (the diagonals), and the ring-8 block —
is **transpose-symmetric**, so FACT 3's structure was never at risk. Only its
numbers needed refreshing, and they are now (`scripts/auditStepClass.ts`,
n=154 per class):

Best hit rate over all card templates, by focus offset from the fish's
current cell — rows are `dx` (ROW offset), columns `dy` (COLUMN offset):

**class k=1**

| | dy=−2 | dy=−1 | dy=0 | dy=+1 | dy=+2 |
|---|---|---|---|---|---|
| **dx=−2** | 0.0% | 21.6% | 29.3% | 29.3% | 0.0% |
| **dx=−1** | 32.2% | 53.9% | 74.4% | 54.1% | 25.8% |
| **dx=0** | 34.7% | **82.7%** | **99.4%** | 73.9% | 26.6% |
| **dx=+1** | 29.1% | 70.5% | **80.2%** | 59.1% | 27.9% |
| **dx=+2** | 3.2% | 43.4% | 40.3% | 34.1% | 0.0% |

Best at (0,0): **99.4%** via template `{1,2,3,4,6,7,8,9}`.

**class k=2**

| | dy=−2 | dy=−1 | dy=0 | dy=+1 | dy=+2 |
|---|---|---|---|---|---|
| **dx=−2** | 12.9% | 44.6% | 62.3% | 42.6% | 30.4% |
| **dx=−1** | 42.0% | 47.8% | 55.0% | 45.3% | 40.0% |
| **dx=0** | **64.2%** | 60.7% | **72.1%** | 51.2% | 52.9% |
| **dx=+1** | 48.2% | 47.3% | 52.4% | 41.8% | 32.4% |
| **dx=+2** | 33.3% | 45.9% | **64.9%** | 41.9% | 19.5% |

Best at (0,0): **72.1%** via template `{1,3,7,9}`.

**Two figures moved off their old absolutes, and the same single cast explains
both.** k=1 at (0,0) was 100.0% and is now 99.4%; the diagonal-2 offsets were
0.0% everywhere and (+2,−2) is now 3.2%. Both are cast `12988700`, whose step
count alternated 1,2,1,2,1,2 — it is classified k=1 off its first move, so its
2-step turns land outside the k=1 ring and show up here as the exceptions.
This is FACT 1's correction propagating, not a change in the card templates.

### What the model does with this

`stepClass.ts`:

- `classifyStep(history)` → `1 | 2 | null`. `null` before any hop resolves —
  **turn 1 of a cast is an identification turn** and the honest answer is
  "unknown", not a guess. Uses the mode of observed nonzero step lengths so a
  single anomalous record cannot pin a cast to the wrong class; with FACT 1
  holding that is the same answer as "the first hop".
- `ringCells(cell, k, gridSize)` — the legal in-grid ring. Not to be confused
  with `geometry.ts`'s `reachableCells`, which is the FOCUS point's movement
  budget (distance ≤ max); this is the fish's next-cell support (distance
  exactly `k`).
- `ringDistribution(...)` — the (class, previous-delta) conditional, shrunk
  toward the class marginal by `n / (n + shrinkageK)` (the same continuous
  mechanism `contextualFallback.ts` uses — one smoothing scheme, not two),
  then mixed with a uniform-over-ring `ringFloor`. Defaults
  `{shrinkageK: 3, ringFloor: 0.1}`, from the plateau interior of
  `fishingRingCV.ts`'s sweep.
- `ringDistributionUnknownClass(...)` — before the first hop, mixes the two
  rings by the observed class prior. The one place the class stops being a
  hard constraint, and only because there is no evidence yet.
- `intersectWithRing(dist, ...)` — restricts any other predictor to the legal
  ring, returning `null` if nothing survives (a fully refuted predictor).

### The evidence that justifies it

Leave-one-cast-out on the real corpus (68 clean casts, 211 scored
transitions — hops with a previous displacement), same tie-break and
`-log(1e-9)` zero-probability convention `fishingContextualCV.ts` has always
used:

| predictor | top-1 | log loss | zero-prob events |
|---|---|---|---|
| cell-only (the old tier 2) | 19.4% | 3.912 | 23 |
| cell + prev-displacement, raw | 39.3% | 6.791 | 63 |
| cell + prev-displacement, shipped backoff | 42.7% | 3.536 | 23 |
| ring, class-aware (FACT 1 only) | 26.1% | 1.287 | **0** |
| **ring + class-aware prev-delta (FACTS 1+2)** | **46.4%** | **1.118** | **0** |
| …on k=1 casts only | 54.1% | 0.803 | 0 |
| …on k=2 casts only | 38.2% | 1.455 | 0 |

The log-loss column is the one that matters most: `chooseCard` integrates over
the whole distribution, so calibration dominates top-1. The ring model's zero
count of zero-probability events is structural, not lucky — the ring floor
guarantees it.

**k=1 is the EASIER class** (4 ring cells, never reverses), k=2 the harder one
(up to 8 ring cells). A live batch that draws one class must be scored against
that class's row, not the mixed one.

### Live wiring and the tier order

`scripts/liveFishing.ts`, `ringModelEnabled` (default `true`) and
`focusReserveWeight` (default `DEFAULT_FOCUS_RESERVE_WEIGHT`), threaded as real
parameters:

0. the mined-pattern matcher while candidates survive, **intersected** with the
   legal ring and then **mixed with the ring model at `ringFloor`**;
1. the ring model itself;
2. `contextualFallback` (unchanged, demoted from tier 1);
3. uniform.

Tier 0's floor was added after this session's own live batch: two turn-0 rows
had a fully-converged mined candidate assign p=1 to a cell the fish did not
reach and p=0 to the one it did — an unbounded log-loss event that the ring
model's floor prevents everywhere except the tier that was bypassing it.

### Live transfer, so far

Session 45's batch was 2 casts (the day's remaining budget), 20 scored turns,
both casts k=2. Ring tier: top-1 **27.8%** (5/18), log loss **1.594**, against
the class-matched offline figures of 38.2% / 1.455. The 95% CI on 5/18 is
roughly [12%, 51%] and contains 38.2%, so this neither confirms nor refutes
transfer. `scripts/ringPredictionReport.ts` re-runs this as
`data/ringPrediction.jsonl` grows; the next batch should be judged the same
way, per class.

### The log-loss smoothing convention **[session 46]**

Pin this before comparing any two log-loss numbers in this project, because a
2.070-vs-3.536 discrepancy between the session-45 brief and the measured
baseline turned out to be **entirely** a convention difference, with both
numbers correct under their own rule.

**This project's convention: no smoothing. A zero-probability event is charged
`-log(1e-9)` ≈ 20.7 nats.** `scripts/fishingRingCV.ts`,
`scripts/fishingContextualCV.ts` and `scripts/ringPredictionReport.ts` all use
this floor, and it is stated in each.

The alternative the brief used was ε=0.02 uniform smoothing applied to every
predictor, which charges ~6.7 nats for the same event. The reconciliation is
exact: the shipped baseline had **23 zero-probability events in 211
transitions**, so 23/211 × (20.7 − 6.7) ≈ **1.5 nats** against a measured gap of
**1.47**.

Two things follow.

1. The convention only ever moves the **baseline's** number. The ring model has
   **0** zero-probability events by construction — the ring floor guarantees
   every legal ring cell carries mass — so its log loss is identical under
   either rule. The ring model's advantage is therefore **robust to the choice
   of convention**, which is a stronger claim than the headline gap alone.
2. Quoting a log loss without its convention is quoting half a number.

### The in-sample calibration discount **[session 46]** — a standing rule

Two independent in-sample projections have now over-predicted live by roughly
**2.5-3x**:

| projection | in-sample | live |
|---|---|---|
| SPEC.md §5's standing sim figure | 22.4% | 10.1% |
| session-45 brief's focus-reserve gain | ~+5pp | +1.6pp measured |

The **shape** of these projections transfers well — `w=3` landed exactly on the
predicted plateau, and the ring model's log loss came in slightly *better* than
projected. The **magnitudes** do not.

So: any brief or recap quoting an in-sample catch rate should carry this
discount explicitly rather than rediscovering it a third time. An in-sample
number is evidence about ordering and shape, not about the level.

### Where the loss actually sits **[session 48, brief §5c — measured, not fixed]**

The replay puts per-turn hit at 50.9% and catch at 27.9%; live batch 1 put
per-turn hit at 27.6% with 1 catch in 5. Either way there is a gap between
"shots land" and "fish caught". `scripts/lossDecomposition.ts` measures which
constraint it sits behind, on the real corpus rather than the replay —
terminal reasons and focus profiles are observations, not model output.

**73 clean casts, terminal reason:**

| reason | n | mean final focusMeter | mean final mana | mean turns |
|---|---|---|---|---|
| **escaped (meter out)** | **59 (80.8%)** | **0.25** | 6.08 | 3.9 |
| caught | 8 (11.0%) | 1.13 | 7.00 | 3.0 |
| mana out | 5 (6.8%) | 0.00 | 0.00 | 10.0 |
| truncated / unresolved | 1 (1.4%) | 0.00 | 7.00 | 3.0 |

**Focus-meter profile, mean over casts still alive at that turn:**

| turn | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| focus | 3.00 | 1.38 | 0.72 | 0.36 | 0.14 | 0.04 | 0.00 | 0.00 | 0.00 |
| mana | 10.0 | 9.0 | 8.0 | 7.0 | 6.0 | 5.0 | 4.0 | 3.0 | 2.0 |
| n alive | 73 | 73 | 71 | 45 | 37 | 28 | 16 | 15 | 11 |

**The verdict, against the brief's own decision table: meter-outs dominate AND
focus hits 0 early, so the binding constraint is the FOCUS BUDGET, still.**
Not the damage economy, not cast length. **50.4% of all turns (192/381) are
played at `focusMeter` 0** — the bobber cannot move at all — and **56 of 73
casts reach 0**. Mana-outs are 6.8% and are the *long* casts, not the failing
ones.

This holds under `focusReserveWeight: 3`, which is the current default and was
supposed to address exactly this. Session 48's five live casts, focus meter by
turn:

```
12988700  3 3 3 1 0 0 0
12988705  3 1 1 1 1 1        <- the one CATCH
12988708  3 2 1 1 0 0 0 0 0
12988710  3 2 1 0 0 0 0 0 0 0
12988717  3 2 1
```

The reserve weight is not preventing exhaustion; it is at most delaying it by
a turn. Suggestive but n=1: the only cast that caught anything is the only one
that stopped spending and held a point in reserve for the whole cast.

SPEC-fishing.md §4c has flagged "chronically overspend the focus" since
session 45. This quantifies it and confirms it survived the fix aimed at it.
**This is session 49's §1.** Not fixed here — the brief asked for the
measurement, and changing the utility on the strength of one batch is exactly
the move this project keeps having to undo.

### The focus-budget policies **[session 49, brief §3 — the premise is STALE; nothing shipped]**

> **[session 50 update — the precondition is now MET and the answer does not
> change.]** Session 49 could not interpret this table: the replay ran with the
> matcher tier OFF, spent 0.64-0.71 on the opening move against live's 1.80,
> and so measured a system that does not spend. `matcherTier: "loo"` fixes that
> (opening spend **1.40**, inside live's 95% interval [1.16, 2.44] at n=10
> casts), and re-run on the now-spending harness at 83 traces the arms are
> **still inert or worse**: every `threshold(theta)` is +0/−0 byte for byte,
> `costCap(2)` is +1/−0, `costCap(0)` is +5/−18 (p = 0.011), and every
> `schedule` arm is negative or null. The null result has gone from
> uninformative to informative, and it agrees with the coverage ceilings below:
> spend QUANTITY was never the binding dimension. Run it with
> `npx tsx scripts/focusBudgetSweep.ts --matcher=loo`.

Session 49 built all three of the brief's cheap spend policies
(`src/strategy/fishing/focusBudget.ts`: `costCap`, `threshold`, `schedule`)
and A/B'd them on the replay, paired per cast
(`scripts/focusBudgetSweep.ts`). **All three are inert or worse. None ships;
the default stays `NO_FOCUS_POLICY`.**

| policy | caught | per-turn hit | Δcaught (casts) | McNemar p |
|---|---|---|---|---|
| shipped | 22/73 = 30.1% | 119/233 = 51.1% | — | — |
| costCap(0) | 8/73 = 11.0% | 61/212 = 28.8% | +2 / −16 | **0.001** |
| costCap(1) | 20/73 = 27.4% | 111/227 = 48.9% | +1 / −3 | 0.625 |
| costCap(2) | 22/73 = 30.1% | 119/233 = 51.1% | +0 / −0 | 1.000 |
| threshold(0.1 … 1) | 22/73 = 30.1% | 119/233 = 51.1% | +0 / −0 | 1.000 |
| threshold(2) | 19/73 = 26.0% | 119/242 = 49.2% | +0 / −3 | 0.250 |
| schedule(auto) | 22/73 = 30.1% | 118/230 = 51.3% | +0 / −0 | 1.000 |
| schedule(3 … 8) | 19–20/73 | 108–118 hits | +0/−2 … +3/−6 | ≥ 0.45 |

**But the null result is not the finding — the PRECONDITION check is.** The
sweep measures whether the replay reproduces the meter-out dynamics these
policies target, and it does not:

| | casts ever at focus 0 | turns at focus 0 | spend on the FIRST move |
|---|---|---|---|
| recorded corpus, pooled | 56/73 = 76.7% | 192/308 = 62.3% | **1.62** |
| … transposed-map era, 68 casts | | | **1.66** |
| … CORRECTED-map era, 5 casts | | | **1.00** |
| today's policy in the replay | 22/73 = 30.1% | 52/233 = 22.3% | **0.62** |

#### The batch settled it, and it goes AGAINST the replay

`RingPredictionRecord` gained `focusMoveCost`/`focusRemainingBefore` for
exactly this, and session 49's own five-cast batch measured it directly:

```
12991310  moveCost [3, 0]              meterBefore [3, 0]
12991312  moveCost [2, 1]              meterBefore [3, 1]        <- CAUGHT
12991317  moveCost [2, 1, 0]           meterBefore [3, 1, 0]
12991320  moveCost [1, 1, 1, 0, 0]     meterBefore [3, 2, 1, 0, 0]  <- CAUGHT
12991326  moveCost [1, 0, 1, 0, 1]     meterBefore [3, 2, 2, 1, 1]
```

**Live opening spend: 1.80 of 3, replicated exactly in a second batch
(1.80 and 1.80, n=10 casts / 56 turns).** Not 0.62. The full picture:

| measured on | opening-move spend |
|---|---|
| recorded, transposed-map era (68 casts) | 1.66 |
| recorded, CORRECTED-map era (10 casts) | **1.40** |
| … the newest 5 casts alone | **1.80** |
| today's policy in the REPLAY | **0.64** |

**So the focus overspend is real, current, and undiminished — and the replay
understates it by roughly 3x.** The cause is named in the replay's own header
conservatism #3: the matcher tier is disabled there, and the matcher produces
the sharpest distributions the live stack has, so it is precisely the tier that
pulls the focus a long way. The replay is blind to the phenomenon these
policies exist to fix.

**Therefore the three-policy null result above is UNINFORMATIVE about the
policies.** It measures a harness in which `costCap(2)` and `threshold(≤1)`
can never fire, because the arm being constrained does not spend. The result
that stands is the *precondition failure*, not the A/B.

Two things this does correct in the brief, both real:

- **§5c's pooled 1.62 is a transposed-era figure** (68 of 73 casts).
  `lossDecomposition.ts` measures the RECORDED corpus, correctly for its own
  question ("why did those casts fail"). Reading such a number as a statement
  about what the bot does *now* needs the era split first.
- **The zone fix did NOT fix the overspend.** 1.66 → 1.40 is a modest move,
  and the n=5 reading of 1.00 that suggested otherwise mid-session was noise —
  the next 5 casts came in at 1.80.

#### The mechanism, measured live — and this is the strongest evidence the project has

Pooled over both instrumented batches (n=56 turns, 10 casts):

| | turns | realized hit | the model's OWN predicted P(hit) |
|---|---|---|---|
| meter **empty** on entry | 29 (51.8%) | **9/29 = 31.0%** | **0.286** |
| meter has points left | 27 (48.2%) | **13/27 = 48.1%** | **0.706** |

**51.8% of live turns are played with a bobber that cannot move**, against
61.8% in the recorded corpus — barely improved. And the collapse is visible in
the policy's own belief before the shot resolves: predicted P(hit) more than
halves, 0.706 → 0.286. The bot is not making bad shots at an empty meter; it
is making the only shot available from wherever it got stranded.

Cast `12991359` is the whole failure mode in one trace: focus moved 3 on turn
0, then sat at `[4,1]` for the next nine turns, playing cards at
`P_hit 0.00, 0.00, 0.01, 0.00, 0.00, 0.00` until the cast ran out.

**Do not read the table as causal.** Long casts accumulate empty-meter turns
AND are the casts going badly, so the two columns are confounded by cast
length. What it establishes is that the constraint is REAL and CURRENT — not
that spending less early would fix it. Establishing that needs an A/B, and the
harness for one does not exist yet (above).

Calibration, by contrast, is fine and improving: pooled predicted P(hit)
0.497 vs realized 35.3% (n=85), and batch 3 alone was 0.415 vs 41.0% —
near-exact. Per the brief's own §1d decision rule, **"realized ≈ predicted
with a low catch rate means the movement model is fine and the binding
constraint is focus budget / deck / mana."** That is now the live verdict.

**What session 50 needs before re-testing any spend policy:** an evaluation
harness that includes the matcher tier without leaking. Until then a replay
A/B of a focus policy is measuring the wrong system, and that — not the null
result — is the finding.

**Standing correction, generalised:** a decomposition measured on the recorded
corpus describes the policy that RECORDED it, and an A/B run on the replay
describes the replay's policy, which is not the live one. Before treating
either figure as a target, check that the harness reproduces the phenomenon —
the same discipline as `zoneMapVersion` on the prediction log, applied to the
evaluation harness itself.

### The two tunable knobs are INERT **[session 48, brief §5b — null results, no defaults changed]**

Both were previously evidenced only by the in-sample sim that needs a 2.5-3×
discount. Swept on the replay instead — 73 real trajectories, leave-one-cast-
out. **Neither shows a detectable effect over its plausible range, and neither
default changes.**

`focusReserveWeight` (ships at 3):

| w | catch | per-turn hit |
|---|---|---|
| 0 | 30.1% [20.8, 41.4] | 50.8% [44.5, 57.1] |
| 1 | 28.8% | 51.4% |
| 2 | 30.1% | 51.7% |
| **3 (shipped)** | **30.1%** | **51.1%** |
| 4 | 27.4% | 49.4% |
| 6 | 26.0% | 47.3% |
| 8 | 26.0% | 44.0% [37.9, 50.3] |
| 12 | 26.0% | 41.8% [35.8, 48.2] |

**w = 0 through 3 are indistinguishable; above 3 it monotonically HURTS.**
The striking half is w=0: removing the focus-reserve term entirely performs
identically to the shipped value on 73 real trajectories. The term is not
wrong, it is inert — which matters, because §5c's finding is that the focus
budget IS the binding constraint and this is the knob that was supposed to
address it. **It is not the lever. Session 49 should not spend a session on
it.**

`missPenaltyMultiplier` (ships at 1 — SPEC.md §5's "the ONE tunable knob",
untouched since it was written):

| m | catch | per-turn hit |
|---|---|---|
| 0 | 26.0% | 47.8% |
| 0.5 | 28.8% | 49.2% |
| **1 (shipped)** | **30.1%** | **51.1%** |
| 2 | 30.1% | 51.5% |
| 3 | 31.5% [22.0, 42.9] | 52.0% |
| 5 | 28.8% | 50.2% |

Flat from 0.5 to 5; only m=0 (ignoring misses entirely) is worse. **1 stands.**

**Stated honestly: these are UNPAIRED point estimates with Wilson intervals,
not the paired differences the brief asked for.** `scripts/offPolicyReplay.ts`
reports each arm independently and the arms score different turn counts
(233-253), so a paired CI is not derivable from its output. The intervals
overlap so completely across w ∈ [0,3] and m ∈ [0.5,5] that the null is safe
regardless, but a paired harness is what would make a *small* real effect
visible, and it does not exist yet.

**Not swept, and why:** `REDRAW_THRESHOLD` and the mined-matcher tier are not
on `ReplayOptions` and plumbing them through is real surgery on
`replayCast`. Given §5c's finding — the constraint is the focus budget, and
the knob aimed at it is inert — tuning either against a replay whose absolute
level was just refuted live is low-value work. Handed over, not done.

### What gates a strategy change **[session 48, brief §3 — adopted WITH a caveat this session's own data forces]**

**The rule.** Any future fishing strategy change is gated on the off-policy
replay (`src/sim/fishing/offPolicyReplay.ts`, `scripts/offPolicyReplay.ts`)
first, as a paired difference against the current default on the same
trajectories, with a CI. Change a default only where the CI excludes zero.
**The in-sample sim is a debugging tool, not evidence** — its own §9
calibration discount exists because it over-predicts live by 2.5-3×, and
session 47's zone bug was invisible in-sim for eleven sessions precisely
because the sim applies the zone table on both sides of the comparison.

**The caveat, and it is not small.** The replay is BETTER evidence than the
sim. It is not yet evidence of an absolute rate. Session 48's batch is the
first live test of a replay prediction and the prediction failed:

| | replay prior | live, batch 1 |
|---|---|---|
| per-turn hit rate | **50.9%** [44.3%, 57.5%] | **27.6%** (8/29) [14.7%, 45.7%] |

The prior sits **outside** the live 95% interval (two-proportion z = −2.51,
**p = 0.012**), while the live figure is indistinguishable from the historical
27.5% baseline it was supposed to beat (z = +0.01, p = 0.99). Excluding the
one FACT-1-violating cast does not rescue it (30.4%, p = 0.050 against the
prior).

Note also what the replay's 50.9% is numerically close to: the mean
`pHitPredicted` the policy assigned to the shots it actually played that
batch, **0.515**. Both numbers come from the same movement model, so the
replay's absolute rate is substantially the model marking its own homework —
whereas the realized 27.6% is not.

**So use the replay for the difference, never for the level.** A paired ΔLL or
a paired hit-rate difference between two policies on the same 68 trajectories
is the thing it is good for, because the model error is common to both arms
and differences it out. Its absolute predictions are, on the one test that
exists, wrong by nearly a factor of two. Quote them as an ordering, not as a
forecast.

### Two standing reporting guards **[session 50, brief §4]**

**Guard 1 — no corpus statistic without its `n`, and no comparator without
re-derivation at the composition of the thing it is compared to.**

Four separate errors in the session-49 brief were this one rule violated, and
one of them was committed in the same brief that recommended null comparators
as a defence against it:

| claim | as quoted | as measured |
|---|---|---|
| live lands on the union-of-rings null | "to within 0.1pp" | union null 10.3% on those turns; **the model beats it** |
| the k-ring null | 29.3% (corpus-wide) | **20.7%** at that batch's composition |
| offline leave-one-cast-out top-1 | 46.4% | 42.6% at 73 casts, **42.3% at 83** |
| the sticky switch probability `s` | ~0.6% | 2.50% at 73, **4.98% at 83** (n = 281 hop pairs) |
| opening focus spend | 1.62 | transposed era 1.66, corrected 1.40, **live 1.80 (n=10)** |

Null-model accuracy depends on the actual cells — legal ring sizes vary cell to
cell — so a corpus-wide average and a 29-turn batch are never comparable
numbers, whichever way round they are put. The mechanism that makes this
non-optional is already in place: `scripts/ringPredictionReport.ts` re-derives
its offline pins and prints a warning that they move. The rule is what makes
using it mandatory rather than diligent.

**Guard 2 — report COVERAGE alongside hit rate on every live readout, with the
decomposition.**

    hit rate = coverage x conversion

where **coverage** = P(the fish's actual next cell landed inside the 3x3 zone
window around the focus that was played), and **conversion** = P(hit |
covered). Coverage is what focus PLACEMENT controls; conversion is what the
card's zone subset and the aim inside the window control. Both are computed
from fields `data/ringPrediction.jsonl` has always carried (`playedFocus`,
`actual`, `realizedHit`), so this needed no new capture.

It is printed on every readout because without it a low hit rate does not say
which half to fix — and three sessions were spent tuning a third quantity
(spend volume) that turned out to be neither.

**What it said the first time it was run** (session 50, n=85 live shots,
corrected zone map): coverage **64.7%** [54.1%, 74.0%], conversion **54.5%**,
product **35.3%** — which is the realized hit rate to the decimal.

### Coverage vs conversion — which half binds is REGIME-DEPENDENT **[session 50, brief §2/§3 — the objective was built, swept, and REJECTED]**

The session-50 brief's reframe was that the 3-point focus budget is not scarce
and the lever is placement quality. **The premise reproduced and the policy
built on it failed its own gate.**

The hindsight ceilings (`scripts/focusCoverage.ts`, 83 clean casts / 364 scored
turns) confirm the premise exactly:

| focus policy | coverage |
|---|---|
| frozen at (2,2), never moves — budget 0 | 223/364 = **61.3%** |
| best FIXED placement, hindsight, reachable within 3 | 336/364 = **92.3%** |
| optimal schedule at budget 3, hindsight | 363/364 = **99.7%** |
| optimal schedule at budget 6 or 12, hindsight | 364/364 = **100.0%** |

Budget 3 is one turn short of a hindsight-perfect schedule; more budget buys
0.27pp. So `focusReserveWeight` (session 48), `costCap` and `threshold`
(session 49) were all regulating a dimension that was never binding.

But the objective that follows from that does not work
(`scripts/focusCoverageSweep.ts`, 83 traces, matcher tier leave-one-cast-out,
paired on 270 common (cast, turn) pairs):

| arm | coverage | conversion | per-turn hit | caught |
|---|---|---|---|---|
| EV placement (shipped) | 73.6% | **62.3%** | 45.8% | 24/83 |
| expected-coverage override, H = 2..5 | **89.6%** (+42/−5, p < 0.001) | 48.5% | 43.7% (+32/−41, p = 0.35) | 18/83 (+5/−11) |
| blended `ev + w * futureCoverage`, w 0.5-6, H 2-3 | ~flat | ~60% | ~44.6% | 24-25/83 |

**The objective wins decisively and does not convert.** The mechanism, measured
rather than asserted: the cards actually played average **3.57 of 9 zones**, so
**39.7%** is the conversion a covering window yields with no aiming inside it.
The EV placement earns 62.3% — 22.6pp of aiming on top of the structure. The
coverage placement earns 48.5% — 8.8pp. It buys window and spends aim, and the
product goes down. Card mix is identical across arms (3.6 zones both), so this
is placement quality, not a card-selection shift.

**It replicates at 88 clean casts** (the corpus after session 50's own batch):
ceilings 235/388 = 60.6% frozen, 386/388 = 99.5% at budget 3, 388/388
unlimited; sweep base coverage 70.6% x conversion 63.9%, override coverage
87.5% (+57/−11, p < 0.001) x conversion 46.9%, hit 46.1% → 42.0%, caught
19/88 → 16/88. Same ordering, same sign, five casts of fresh data.

Nothing shipped. `coverageFocus.ts` and the two replay options
(`coverageHorizon`, `coverageWeight`) stay in the tree as the measuring
instrument and the arms; the live default is unchanged.

**And then the live batch reversed it, in the same session. Read both.**

Session 50's own five casts, scored by the same decomposition:

| | coverage | conversion | hit |
|---|---|---|---|
| replay, EV placement, 83 casts / 299 turns | 73.6% | 62.3% | 45.8% |
| live, pooled, n=85 shots | 64.7% | 54.5% | 35.3% |
| **live, session-50 batch, n=24 shots** | **37.5%** [21.2%, 57.3%] | **66.7%** | **25.0%** |

Conversion **held** on that batch — 66.7%, above the pooled live figure and
comparable to the replay's. Coverage **collapsed** to 37.5%.

**So which half binds is not a fixed property of the policy. It tracks the
movement model's accuracy on the batch.** In the replay the model is fitted to
the corpus, predicts well, the window usually contains the fish, and
conversion is what is left over — which is why forcing coverage higher there
only trades away aim. Live, on a batch the model reads badly, the window
simply misses and coverage is the whole loss. Session 50's batch was
k=2-heavy (17 of 19 scored turns), scored live k=2 top-1 23.5% against an
offline LOO 33.9%, and **lost to the k-ring null** (21.1% vs 26.3%).

Two consequences, and they are the durable ones:

1. **Do not read "conversion is binding" as a standing fact.** It is the
   replay's regime. Anyone acting on it should first check the coverage number
   on the batch in front of them — which is exactly why Guard 2 puts it on
   every readout.
2. **Coverage is downstream of prediction quality**, so a placement objective
   cannot rescue a batch where the movement model is wrong; it can only
   redistribute a window that was already going to miss. The expected-coverage
   objective is rejected for the replay's regime AND is not the answer to the
   live one.

### What is NOT claimed

The catch-rate numbers from `scripts/fishingEmpiricalAblation.ts` are
**optimistic by construction** — the policy shares its movement model with the
fish generator, and the contextual-fallback arm additionally trains on the same
corpus the fish is sampled from. The empirical-fish sim puts today's live
configuration at ~25% against a live all-time rate of 10.1%; it over-predicts
by roughly 2.4x and is not calibrated to live. The leave-one-cast-out table
above is the only out-of-sample evidence in this section, and it is what the
gate was set on.

### The deck-composition thread — CLOSED **[session 46]**

Session 45 refuted the session-45 brief's deck-composition claim (projected
shape-matched decks at 55.5%/79.0% against the real deck's 32.2%; measured the
opposite ordering). An independent re-run of the same three cards then reported
the *inverse* — MID ~20pp above the real deck — and two harnesses cannot both
be describing the same card geometry. The session-46 brief asked for one
diagnostic to settle it: re-run the deck arms printing **per-turn hit rate**
beside catch rate. Hit rate is very nearly a pure function of card zones and
focus placement, independent of the HP arithmetic, the mana curve, and the
sequential-`drawHand` confound.

Measured, `scripts/fishingEmpiricalAblation.ts` §3, empirical fish + ring
model, N=20000 × 2 far-apart seeds, **after (d)'s retirement**:

| deck | catch% | **per-turn hit%** | mean turns |
|---|---|---|---|
| real `[1,2,3,4,5,6,7,76,77,79]` | 32.5 / 32.3 | **48.8 / 48.7** | 4.6 |
| shape-matched MID `[7,79,76]` | 17.8 / 17.2 | **42.2 / 41.8** | 4.1 |
| shape-matched HIGH `[107,108,25]` | 22.6 / 22.5 | **38.0 / 38.1** | 2.3 |

**Verdict: the geometry claim is wrong and session 45's refutation stands
unqualified.** MID's per-turn hit rate is genuinely *lower* than the real
deck's — −6.6pp, consistent across both seeds — which is the brief's own
"geometry claim is wrong" branch, not its "harness bug in the draw path"
branch. Had this been a draw-path defect, MID's hit rate would have sat at or
above the real deck's while only its catch rate lagged. It does not. The
~20pp inversion in the independent re-run was measuring a different
configuration, not exposing a bug in this one.

The HIGH arm is worth reading too, as it validates the instrument: it has the
**lowest** hit rate (38.0%) yet a **higher** catch rate than MID (22.6% vs
17.8%), because it does far more damage per connect and ends casts in 2.3 turns
instead of 4.1. Hit rate and catch rate are genuinely separable axes, and a
deck comparison that reports only the latter cannot tell coverage apart from
damage.

(These figures sit slightly below session 45's — real deck 32.5 vs 33.2, MID
17.8 vs 15.2 — because heuristic (d) was retired in between, which changes the
distribution reaching the policy. The ordering, which is the result, is
unchanged.)

**The thread is closed and should not be reopened without a new premise.** The
practical reason is independent of all of the above: **you gain one card per
catch**, so wholesale deck replacement is unreachable at any catch rate this
project can achieve. The only regime available is marginal — the real deck plus
exactly one added card, 16 candidates — and that moves catch rate by ~0-3pp,
inside noise. The deck lever is small precisely where it can actually be
pulled.
