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
  "action": "start_run" | "play_cards",
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
| `FISH_MOVED` | every turn | `data.path`: array of the cell(s) traversed |
| `CARD_PLAYED` | every turn | `value`: 0 (miss) or 1 (hit), `data.result`: new catch meter |
| `HIT` | on a hit only | `value`: damage dealt, `data.result`: catch meter after |
| `FISH_HP_DIFF` | every turn | `value`: signed delta to the catch meter, `data.result`: meter after |
| `NEW_HAND` | when the hand changes | `value`: the new hand array |
| `FISH_ESCAPED` | cast-ending escape | no payload |

**Not observed, so [VERIFY]:** a catch-ending event (presumably
`FISH_CAUGHT` or similar, by naming symmetry with `FISH_ESCAPED` — do not
hardcode this name without a captured catch).

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
| `focusMeter`/`focusMeterMax` | bobber move budget, both `3` throughout this capture — **[CONFIRMED]** present, un-spent-looking (never dropped below 3), so the actual spend rule is **[VERIFY]**. |
| `focusMechanicEnabled` | `true` for this (Dendren) cast. **[CONFIRMED]**. The community note says this is `false` on the simpler 3×3 ponds — not independently verified here (no second-pond capture), but consistent with the `gridSize`/`pondId` split above. |
| `hand`/`discard`/`fullDeck`/`nextCardIndex`/`cardInDrawPile` | **[CONFIRMED]** — `hand` shrinks by the played index and `discard` grows by the played card's id every turn, exactly as needed to implement `cards: [handIndex]`. |
| `deckCardData` | the card catalog **as it applies to this cast** — see §6 for a live finding about `isDayCard` entries here. |

**Card hitboxes are bobber-relative, not absolute, on this grid.** Not
independently re-derived from the capture (would need the fish to sit inside
a played card's hitbox on a non-centred `focusPoint` and confirm the hit/miss
outcome against the offset template) — flagged here as **[VERIFY, but very
likely correct]** because it follows directly from `focusMechanicEnabled:
true` plus every card's `hitZones` being defined in the same fixed 1-9
numbering used when `focusPoint` was still `[2,2]`. Do not build a
fixed-absolute-zone model for Dendren; the community note explicitly warns
this "looks right on 3×3 and breaks on 4×4."

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
