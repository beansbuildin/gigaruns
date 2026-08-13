# scratch — session 02 surprises (raw, for recap)

## THE LESSON OF THE SESSION: two models fit, one was wrong

I derived a combat model from the 7 recorded exchanges and it scored 14/14. The
user then supplied the actual rule, which ALSO scores 14/14 — and is different.

Mine: only Shield grants armor; ties deal `ATK − opponent DEF`; special case
exempting Shield ties from DEF reduction.
Correct: **any** side that wins *or ties* regenerates its own move's DEF as
armor (capped), then deals full ATK; a loser gains and deals nothing.

They coincide while armor is 0 and the cap is slack, because "gain DEF then take
full ATK" reduces to "take ATK − DEF". And critically, **every observed win was
either my Sword (DEF 0) or the enemy's Shield** — so no win with a DEF-bearing
non-Shield move ever appeared. My special case covered every observed win by
accident.

Where it would have broken: winning with Spell grants 8 armor; my model granted
0. A silent, systematic undervaluation of Spell inside every EV calculation,
invisible to the fixtures.

Takeaway for future sessions: a model fitting 100% of recorded data is not
confirmation when the data never exercises the branch that distinguishes it.
Ask what observation would separate two candidate rules, and check whether the
corpus actually contains one. Prefer the model with no special cases.
`scripts/verifyCombatModel.ts` now re-checks this on every change.

## No in-combat healing

HP is only restored by a card offered after a won fight. Armor is renewable
every winning/tying exchange; HP is not renewable at all inside a run. These are
different currencies and §4b should not merge them into one effective-HP pool.

## The big one: charges are real AND the enemy's are fully visible

`/game/dungeon/state` → `data.run.players[]`. Two entries: `[0]` = user (id is
the wallet address), `[1]` = enemy (id is a *name string*, `"Enemy Room 63"`).

Every move on BOTH sides carries the identical shape:

```json
"rock":    { "startingATK": 16, "startingDEF": 0,  "currentATK": 16, "currentDEF": 0,  "currentCharges": 3, "maxCharges": 3 }
"paper":   { "startingATK": 6,  "startingDEF": 12, "currentATK": 6,  "currentDEF": 12, "currentCharges": 3, "maxCharges": 3 }
"scissor": { "startingATK": 12, "startingDEF": 8,  "currentATK": 12, "currentDEF": 8,  "currentCharges": 3, "maxCharges": 3 }
```

So SPEC §4a charge pruning is buildable at full strength — we see enemy ATK,
DEF, and remaining charges per move before committing. No hidden information in
the move layer at all.

`starting*` vs `current*` split exists on ATK/DEF too, not just charges — so
buffs/debuffs mutate stats mid-run and the delta is observable.

## TRAP: "Enemy Room 63" is not room 63

`players[1].id = "Enemy Room 63"` and `entity.ENEMY_CID = 63`. The room is
`entity.ROOM_NUM_CID = 1`. The enemy's *name* embeds its enemy id, not the room
number. Anything parsing that string for position will be wrong.

## TRAP: two different things are called DUNGEON_ID_CID

- `entity.ID_CID = "5"` — the dungeon TYPE (Forbidden Woods). **A string.**
- `entity.DUNGEON_ID_CID = 24754733` — the run INSTANCE id. Also `docId:
  "Dungeon#24754733"`.
- `run.DUNGEON_ID_CID = 24754733` — same instance id.

The field literally named "dungeon id" is the run instance, and the dungeon id
proper is `ID_CID`, as a string, while `dungeonDataEntities[].ID_CID` is a
number (5). Type coercion needed at the boundary.

## Armor is `shield`, and it is a first-class pool

`health: { current, starting, currentMax, startingMax }` and
`shield: { current, starting, currentMax, startingMax }` — parallel structures.
Player observed at `health 32/32` (starting max 30) and `shield 15/15`
(starting max 12), so boons/gear raise both maxima above base.

SPEC §4b treating armor as a minor utility term is wrong on shape alone — it is
modelled exactly like HP.

Also present and unmodelled by SPEC: `tenacity`, `evasion`, `lck`, `intuition`,
`block`, `battleArmorReduction`, `activeEffects`, `statusEffects`,
`pickedBoons`, `triggeredBoons`, `gearBoons`, `focusBuffs`. All zero/empty at
room 1 on this run, so their semantics are still unknown.

## Floor is ABSENT

Only `ROOM_NUM_CID`. No floor field anywhere in the state. The brief's "Floor 1,
Room 2" reading from the UI does not correspond to two API fields — floor is
probably a UI grouping over room number, or lives in a response we haven't seen.

## Phase flags are explicit

`lootPhase`, `pathPhase`, `rewardPathPhase`, `enemyPathPhase` booleans, each
with a matching `*Options` array. All false/empty mid-combat. This is the state
machine and it is directly readable — no inference needed.

## Forbidden Woods resolved

`dungeonDataEntities[3]`: `ID_CID: 5`, `NAME_CID: "Forbidden Woods"`,
`ENERGY_CID: 20`, `maxRoom: 16`, `UINT256_CID: 12`, `juicedMaxRunsPerDay: 12`,
`minLevelForInvader: 79`, `basicBoonMultiplier: 2` (only dungeon with 2).

`UINT256_CID` looks like base max runs/day: Dungetron 10 (juiced 12), Underhaul
8 (juiced 9), Void 9999 (juiced 9999), Woods 12 (juiced 12).

Three tiers via `entryData`, gated on input items, NOT on energy:
- Tier 1: `inputItems: []` — free entry, `dropMultiplier: 1`
- Tier 2: items [134,137,138,135,136,139,140] x1, `dropMultiplier: 2`
- Tier 3: items [245,244,243,246,248,247,249] x1, `dropMultiplier: 4`
Both gated tiers carry `inputsBasedOnFactionDay: true` — entry cost depends on
the day/faction, so the item list is not static. Current run is `TIER_CID: 1`.

Tier ordering in the array is 2,1,3 — NOT sorted. Index is not tier.

## Dendren: zero hits

No match for /dendren|fish|cast|bait|node/i in ANY of the seven probed
endpoints. Fishing is genuinely on an undiscovered surface. Task 7 stays blocked
on the HAR; nothing more to do without it.

## Account facts

username `<USER>`, noobId 72946, `LEVEL_CID: 1` on the noob NFT but
`LEVEL_CID: 6` on the dungeon entity (two different level concepts).
Energy 332/420, `regenPerHour: 18`, `isPlayerJuiced: true`.

Energy is stored scaled: `ENERGY_CID: 332247916021` vs
`parsedData.energyValue: 332`. Always read `parsedData`, never the raw CID.

## Probe defects found and fixed

1. `discovered.json` was being written with `id: null`. "Forbidden Woods"
   matches the entity NAME_CID *and* all three entryData tier names; the entity
   is not last, so last-write-wins clobbered id 5 with the tier hit's null.
   Fixed: never overwrite a real id with a null one.
2. SPEC §3b requirement 5 (spec-drift diff) was never implemented. Added.
3. Raw dumps carry the real wallet address and were not gitignored. Split:
   raw → `fixtures/probe/raw/` (gitignored), redacted → `fixtures/probe/`.

## Spec drift output

157 observed keys absent from SPEC.md (the spec documents almost none of the
`*_CID` layer). One SPEC-quoted identifier never seen: `dungeonId`.

CAVEAT — do not overclaim this. `dungeonId` is a *request* field in the §2
action envelope. GET responses can't confirm or refute it. It stays unverified
until Task 6 sends a real action.
