# SPEC — Gigaverse Autoplay Bot

Target: autonomous **Forbidden Woods** dungeon runs and **Dendren fishing** casts.
Base URL: `https://gigaverse.io/api` · Chain: Abstract (chainId 2741)

Legend: **[CONFIRMED]** verified against official docs/agent skill ·
**[VERIFY]** plausible but unproven — `probe.ts` must confirm before use.

---

## 0. Policy context

Gigaverse's Fair Play Rules explicitly permit bots, automation, and AI agents,
and permit multi-accounting. Exploiting bugs is prohibited. Practical reading:
play the game fast, don't play a broken version of it. If a response looks like
a bug in your favour (negative energy cost, infinite charges), stop and report
it rather than farm it — the rules reward responsible disclosure and penalise
abuse retroactively.

When authenticating, send the `agent_metadata` field. Identifying as an agent is
what keeps this in the sanctioned lane.

---

## 1. Authentication

### 1a. Which wallet? — DECIDE THIS FIRST

This is the most common way to waste a day on this project.

If the user plays through **Abstract Global Wallet** (the normal browser
onboarding), their Noob, items, and energy belong to a *smart contract* account.
A raw EOA signature from a private key will authenticate a **different, empty
account** — the bot will log in successfully and find no character. Everything
will look like it works and nothing will be there.

Two paths:

- **Path A — borrow the browser session (recommended to start).** The user opens
  gigaverse.io logged in, opens DevTools → Network, plays one action, and copies
  the `Authorization: Bearer …` header. Paste into `~/.secrets/gigaverse-jwt.txt`.
  No signing code needed. Downside: the JWT expires, so the bot needs a clean
  "token expired, please refresh" halt. Build this first — it unblocks all
  discovery work immediately.
- **Path B — bot-owned EOA.** Generate a fresh wallet, fund it, mint its own Noob.
  Fully autonomous and renewable. This is the right end state, but it is a
  *separate account* from the user's, so it starts from zero progression.

Implement Path A first. Add Path B behind `AUTH_MODE=eoa` once the rest works.

### 1b. Signature flow (Path B) **[CONFIRMED]**

Message format is exact — any deviation fails:

```
Login to Gigaverse at <unixMillis>
```

`POST /user/auth` with:

```json
{
  "signature": "0x...",
  "address": "0x...",
  "message": "Login to Gigaverse at 1730000000000",
  "timestamp": 1730000000000,
  "agent_metadata": { "type": "custom-bot", "model": "claude-opus-4-5" }
}
```

The timestamp must be identical in `message` and `timestamp`. Sign with
EIP-191 personal_sign (`account.signMessage({ message })` in viem).

Verify the session with `GET /user/me`. **[CONFIRMED]**

---

## 2. Confirmed API surface

All authenticated calls take `Authorization: Bearer <jwt>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/user/me` | session check **[CONFIRMED]** |
| GET | `/game/account/{address}` | noob, username **[CONFIRMED]** |
| GET | `/offchain/player/energy/{address}` | energy balance **[CONFIRMED]** |
| GET | `/game/dungeon/today` | today's dungeons, costs, run caps **[CONFIRMED]** |
| GET | `/game/dungeon/state` | current run state / resync **[CONFIRMED]** |
| POST | `/game/dungeon/action` | every dungeon action **[CONFIRMED]** |
| GET | `/items/balances` | inventory **[CONFIRMED]** |
| GET | `/offchain/skills/progress/{noobId}` | levels **[CONFIRMED]** |
| GET | `/gigajuice/player/{address}` | juice status **[CONFIRMED]** |
| GET | `/contracts` | contract addresses, unauthenticated **[CONFIRMED]** |

**[2026-08-14, session 08, live] `/game/dungeon/state`'s "no active run" has TWO
wire shapes, not one.** DECISIONS 2026-08-14 recorded the first: a run that
just ended returns HTTP 500 with an HTML error page. Task 6's first live read
(an account with no run started at all this session) found a second: **HTTP
200** with `{success:true, actionToken:0, data:{run:null, entity:null}}`. The
original `DungeonStateSchema` required `data.run` to be a full run object and
threw a zod validation error on this — CLAUDE.md §1, the live response is
right and the schema was wrong. Fixed: `src/api/schemas.ts`'s
`DungeonStateOrIdleSchema` allows `run`/`entity` to be `null`; the client
parses against that and returns `null` from `getDungeonState()` on EITHER
shape, so every caller still sees one "no active run" signal.

### Dungeon action envelope **[CONFIRMED]**

```json
{
  "action": "start_run",
  "dungeonId": 1,
  "actionToken": 0,
  "data": { "consumables": [], "isJuiced": false, "index": 0 }
}
```

Actions: `start_run`, `rock`, `paper`, `scissor`, `loot_one`…`loot_four`,
`use_item`, `heal_or_damage`, `flee`, `cancel_run`.

**Move naming — this trips people up.** The API uses RPS names; the game uses
weapon names. Map once, at the API boundary, and use weapon names everywhere in
your own code:

| Game term | API action | Profile |
|---|---|---|
| ⚔️ Sword | `rock` | high ATK, no DEF — beats Spell |
| 🛡️ Shield | `paper` | no ATK, high DEF — beats Sword |
| ✨ Spell | `scissor` | balanced — beats Shield |

Sword > Spell > Shield > Sword.

### Action token **[CONFIRMED]**

Every response returns a fresh `actionToken`. Always send the newest one.
`start_run` uses `0`. Stale tokens are rejected (~5s anti-spam window). On
rejection, re-sync from `GET /game/dungeon/state` rather than retrying blind.

Model this as a single owned mutable in the client with a mutex — concurrent
actions against one account will corrupt the token sequence. **One in-flight
action at a time, always.**

---

## 3. Unknowns — resolve via `scripts/probe.ts`

`Forbidden Woods` and `Dendren` do not appear in public documentation as of this
writing. They are newer or seasonal content. **Do not hardcode IDs.**

| Unknown | How to resolve |
|---|---|
| ~~Forbidden Woods `dungeonId`~~ | **RESOLVED 2026-08-13 — see §3c.** |
| ~~Its energy cost, room count, entry tier~~ | **RESOLVED — §3c.** |
| ~~Whether entry needs `entryData` / an item~~ | **RESOLVED — tiers 2 and 3 are item-gated, tier 1 is free. §3c.** |
| ~~Move **charges**~~ | **RESOLVED — they exist, 3/3 per move. §3d.** |
| ~~Enemy stat visibility~~ | **RESOLVED — fully visible, both sides. §3d.** |
| ~~Whether enemy's *current* move charges are visible~~ | **RESOLVED — YES. §3d. This is the edge; build §4a pruning.** |
| Fishing endpoints entirely | Not documented, and **confirmed absent** from all seven probed endpoints (2026-08-13). See §3a — the HAR is the only path. |
| Dendren node ID, cast tiers, bait item IDs | Same. Zero hits for `/dendren|fish|cast|bait/i` anywhere in probe output. |

### 3a. Finding the fishing API

There is no published fishing endpoint. Get it the honest way — observe the
official client:

1. User opens gigaverse.io, DevTools → Network, filters to `Fetch/XHR`.
2. Plays **one** fishing cast at Dendren by hand, start to finish.
3. Saves the HAR (right-click → Save all as HAR) to `fixtures/fishing-cast.har`.

Then parse the HAR to extract paths, request bodies, and response shapes, and
generate `src/api/fishing.ts` plus fixtures from it. Everything about fishing —
endpoints, enums, card schema — comes from this artifact. Write a HAR parser;
don't transcribe by hand.

Note the shape you expect by analogy with the dungeon: likely a `start_cast`
equivalent, a per-turn "play card" action, an action-token discipline, and a
state endpoint. If fishing turns out to be websocket-based rather than REST, say
so immediately in `QUESTIONS.md` — that changes the client design and is worth a
human decision.

### 3b. `probe.ts` requirements

Read-only. Never starts a run. Must:

1. Auth, print truncated JWT, confirm `/user/me`.
2. GET each confirmed endpoint, write **raw unmodified JSON** to
   `fixtures/probe/<endpoint>.json`.
3. Search every response for `/forbidden|woods|dendren/i` and print matches with
   their full parent object and JSON path.
4. Write resolved IDs to `config/discovered.json`.
5. Print a diff of observed field names vs. those referenced in `SPEC.md`, so
   spec drift is visible immediately.

### 3c. Forbidden Woods — RESOLVED 2026-08-13 **[CONFIRMED]**

From `GET /game/dungeon/today` → `dungeonDataEntities[3]`:

| Field | Value |
|---|---|
| `ID_CID` | **5** ← this is the dungeon id |
| `NAME_CID` | `Forbidden Woods` |
| `ENERGY_CID` | **20** |
| `maxRoom` | **16** |
| `UINT256_CID` | 12 (appears to be base max runs/day) |
| `juicedMaxRunsPerDay` | 12 |
| `minLevelForInvader` | 79 |
| `basicBoonMultiplier` | 2 (only dungeon with 2) |

Three tiers in `entryData`, gated on **items, not energy**. Tier 1 is free
(`inputItems: []`, `dropMultiplier: 1`); tier 2 and tier 3 each consume 7
distinct items (`dropMultiplier` 2 and 4). Both gated tiers carry
`inputsBasedOnFactionDay: true`, so **the required item list is not static** —
re-read it per day, never cache it.

`entryData` is ordered tier 2, 1, 3. **Array index is not tier.** Match on
`tier`.

**Two traps in the id layer:**

- `entity.ID_CID` is the dungeon *type* (`"5"`, **a string**), while
  `dungeonDataEntities[].ID_CID` is a *number* (`5`). Coerce at the boundary.
- `DUNGEON_ID_CID` (on both `run` and `entity`, e.g. `24754733`) is the **run
  instance id**, not the dungeon id. The field named "dungeon id" is not the
  dungeon id.
- `players[1].id` is a name string like `"Enemy Room 63"`. The 63 is
  `entity.ENEMY_CID`, **not** the room. Room is `entity.ROOM_NUM_CID`.

There is **no floor field**. Only `ROOM_NUM_CID`. Any "Floor N" in the UI is a
presentation grouping over room number.

### 3d. Battle state shape — RESOLVED 2026-08-13 **[CONFIRMED]**

`GET /game/dungeon/state` → `data.run.players[]`: `[0]` is the user, `[1]` the
enemy, **identical schema**. Every move on both sides exposes:

```json
"rock": { "startingATK": 16, "startingDEF": 0, "currentATK": 16,
          "currentDEF": 0, "currentCharges": 3, "maxCharges": 3 }
```

So enemy ATK, DEF, and remaining charges are **fully visible before deciding**.
There is no hidden information in the move layer.

`health` and `shield` (= armor) are parallel `{current, starting, currentMax,
startingMax}` pools. Armor is **not** a minor term — it is modelled exactly like
HP. Observed maxima above base (HP 32 vs starting 30, armor 15 vs 12), so gear
and boons raise both.

Phase flags are explicit booleans with matching option arrays: `lootPhase`,
`pathPhase`, `rewardPathPhase`, `enemyPathPhase`. Read the state machine
directly; do not infer it.

**[CORRECTED 2026-08-14] `lootPhase` / `lootOptions` are NOT the reward
surface.** Across 4 captures and 5 dungeon attempts — including runs that
demonstrably awarded loot, a boon, and a heal — `lootPhase` was `false` and
`lootOptions` was `[]` **every single time**. Nothing is known to populate them.
The two phases that actually fire after a win are:

| phase flag | options array | what it is |
|---|---|---|
| `rewardPathPhase` | `rewardPathOptions[]` | the boon / buff cards |
| `enemyPathPhase`  | `enemyPathOptions[]`  | next-room enemy choice — **carries the loot table** |

`enemyPathOptions[]` entries are a risk/reward tier pick:
`{index, tier, tierName: "Safe"|"Risky"|"Dangerous", enemyId, enemyBuff,
lootTable, rolledEnemyStats}`. `lootTable` is
`{NAME_CID: "LT_D5_Room_2", ID_CID, GAME_ITEM_ID_CID_array,
WEIGHT_CID_array, LOOT_AMOUNT_CID_array}`. In the one sample captured, all
three tiers shared an identical loot table, so the higher tiers were pure added
risk — **verify this before treating tier as a reward lever.**

`rolledEnemyStats` (`evasion`, `block`, `lck`, `tenacity`) are **live and affect
damage** — see §4 for the unexplained enemy-65 case. They are no longer safe to
treat as zero.

**Boon values: read `selectedVal1` / `selectedVal2`, never `val1Min`/`val1Max`.**
The `selected*` fields are the *applied* values, already multiplied by the
dungeon's `basicBoonMultiplier` (2 for Forbidden Woods). Observed: `Heal` with
`val1Min/Max: 8` applied as `selectedVal1: 16` (HP 15 → 31); `UpgradePaper` with
`val2: 2` applied as `selectedVal2: 4`. Ranking boons off the raw range
undervalues every one of them by half.

Present but **semantics still unknown**: `intuition`, `battleArmorReduction`,
`activeEffects`, `triggeredBoons`, `gearBoons`, `focusBuffs`.
Now observed non-zero and partially understood: `evasion`, `block`, `lck`,
`tenacity` (rolled per enemy), `statusEffects` (`[{type: "Burn", amount: 3}]`),
`pickedBoons` (full boon objects, accumulates across the run).

Energy is stored scaled (`ENERGY_CID: 332247916021`). Always read
`parsedData.energyValue`, never the raw CID.

### 3e. `enemyPathOptions[]` — the tier choice **[CONFIRMED 2026-08-16]**

After the boon phase, `enemyPathPhase` offers three options for the next enemy.
Session 05 recorded this as "a real strategic decision with no spec" and left it
open (QUESTIONS §6). It is now the **most consequential known decision in the
run**, because each option carries its own enemy modifiers:

```json
{ "index": 0, "tier": 0, "tierName": "Safe", "enemyId": 64,
  "enemyBuff": null,
  "rolledEnemyStats": { "evasion": 0, "block": 0, "lck": 0, "tenacity": 0 },
  "lootTable": { "NAME_CID": "LT_D5_Room_2", "ID_CID": 95,
                 "GAME_ITEM_ID_CID_array": [846], "WEIGHT_CID_array": [1],
                 "LOOT_AMOUNT_CID_array": [9] } }
```

The other two options in that offer were both `tier: 2` ("Dangerous"), same
`enemyId: 64`, with `rolledEnemyStats` `{1,2,1,1}` and `{1,1,3,3}` and a non-null
`enemyBuff` each.

**The loot table is IDENTICAL across all three tiers** — same table, same item,
same weight, same amount 9. Two independent samples now agree (session 05 saw
the same, at the same room). So:

> **Rule: always pick tier 0 ("Safe").** Higher tiers are pure added risk with
> zero loot upside, *and* they are the sole source of enemy rolled stats and
> enemy buffs — the two mechanics that make a battle unscorable. The strategic
> choice and the coverage-preserving choice are the same choice.

Caveat: two samples, both at room 2. If a deeper room shows a tier premium in
`LOOT_AMOUNT_CID_array`, this reverses into a real risk/reward tradeoff. Re-check
whenever a capture reaches a new depth.

**`enemyBuff` is machine-readable, not prose.** Two observed:

```json
{ "id": "perpetual_firebrand", "name": "Perpetual Firebrand", "minTier": 2,
  "perpetual": true, "description": "Applies 2 Burn on Sword wins",
  "effects": [{ "kind": "onEnemyWinExchange_applyStatus",
                "statusType": "Burn", "amount": 2, "moveType": "rock" }] }

{ "id": "corrosiveShield", "name": "Miasmaguard", "minTier": 2,
  "description": "Reduces 3 max armor on Shield wins",
  "effects": [{ "kind": "onEnemyWinExchange_corrode",
                "amount": 3, "moveType": "paper" }] }
```

Three things follow, none of them modelled yet because none has a before/after
pair:

1. **Burn's `amount` is 2 here, not 3** — which breaks the coincidence §4f is
   held hostage by. See §4f.
2. `corrosiveShield` is the same id as the room-1 **boon** `CorrosiveShield`
   (`val1: 2`, unmodelled). Same effect kind, player side. A pointer for where
   to look, **not** a model — the DECISIONS 2026-08-15 rule stands and it stays
   unmodelled until a pickup pair exists.
3. `battleArmorReduction` ("semantics unknown" in `src/sim/coverage.ts`) is very
   likely the Miasmaguard counter.

**[CORRECTED session 07] `src/sim/enemies.ts`'s room-3 and room-4 profiles were
mislabelled "Dangerous-tier instances".** Re-matching each captured enemy state
against the `enemyPathOptions[]` that preceded it (comparing `rolledEnemyStats`
of the option to the resulting state) gives the ACTUAL tier of each capture:

| room | enemy | tier captured | rolled stats | buff |
|---|---|---|---|---|
| 1 | 63 | n/a — never offered via `enemyPathOptions[]`, a fixed first encounter | all zero | none |
| 2 | 64 | 0 Safe, 1 Risky, and 2 Dangerous all captured (three offers across the corpus) | zero / zero / `{1,2,1,1}` | none / `bloodthirsty` (+4 ATK all moves) / `corrosiveShield` |
| 3 | 65 | **1 Risky** (not 2 Dangerous as previously written) | `{evasion:2,block:2,lck:1}` | `shatterblade` ("Applies 1 Vulnerable on Sword wins") |
| 4 | 66 | **0 Safe** (not Dangerous) | all zero | **null** |

Room 4's `activeEnemyBuff` is `null` for the entire recorded battle, matching
the Safe pick exactly. The Burn status effect seen on that enemy mid-battle is
**not** an enemy or tier mechanic — the player's own `pickedBoons` for that run
includes `AddBurnSword`, taken at the preceding reward phase, and Burn is that
boon landing on a Sword win. The room-4 Safe-tier capture is therefore CLEAN;
`src/sim/enemies.ts`'s `ROOM_ENEMIES` reflects this.

**Consequence for `deepestScorableRoom`:** under the Safe-tier hard rule above,
rooms 1, 2, and 4 all have a clean Safe-tier capture. The *only* remaining
capture gap is room 3 — no Safe-tier capture of enemy 65 exists anywhere in the
corpus. `src/sim/enemies.ts`'s `lookupEnemy(3, SAFE_TIER)` is deliberately
absent rather than invented, and `src/sim/dungeonSim.ts`'s `simulateRun` fails
closed there with `NO_TIER_CAPTURE` — a capture gap, not a claim that the enemy
is unscorable in general. One Safe-tier room-3 capture is the whole remaining
blocker on this number, not a code or model change.

---

## 4. Dungeon strategy

### The core mistake to avoid

Forbidden Woods is *not* rock-paper-scissors. Treating it as RPS gets you a 33%
guess. It is a **damage race with asymmetric payoffs and (probably) constrained
move availability**, and that's where the edge is.

Two things make it beatable:

**(a) Payoffs are asymmetric.** Winning with Sword and winning with Shield are
not the same outcome — Sword deals high damage and takes none, Shield deals none
and blocks. So the right question is never "which move most likely wins," it's
"which move maximises expected value given what the enemy is likely to play."
When you're at 3 HP and the enemy is at 20, a 60%-likely Shield beats a
70%-likely Sword, because losing the Sword exchange ends the run.

**(b) Charges exist and are public information [CONFIRMED 2026-08-13].** Both
sides' `currentCharges`/`maxCharges` are visible every turn. But see the
**charge caveat** below before building pruning on top of it — the naive rule
"zero charges ⇒ cannot play" is *not* yet established.

### Combat resolution **[CONFIRMED 2026-08-13]**

Verify any change to this section with `npx vitest run tests/replay.test.ts`,
which replays it against every recorded exchange through `src/sim/combat.ts` —
the single implementation everything else uses. `npx tsx scripts/sim.ts` prints
the same replay with coverage attached. Currently **127/132 side-updates, and
0 failures inside the clean model**: every one of the 5 mismatches falls on an
exchange coverage has already marked unscorable. `scripts/verifyCombatModel.ts`
is the older standalone check and does not apply the phase filter (see the
charge-recount correction below), so prefer the test.

Per exchange, for each side independently:

1. **A side that WINS or TIES regenerates armor** equal to **its own move's
   `currentDEF`**, capped at `shield.currentMax`. Excess is wasted — at 4/10,
   a winning move with 8 DEF takes you to 10/10, not 12.
2. **That same side then deals its full `currentATK`.**
3. **A side that LOSES gains nothing and deals nothing.**
4. Armor regen resolves **before** incoming damage.
5. **Damage depletes armor first; the overflow carries to HP** in the same
   exchange.

**Every move regenerates — not just Shield.** Regen is the DEF of whichever
move won. Winning with Spell (DEF 8) restores 8 armor; winning with Sword
(DEF 0) restores none.

A tie behaves as *both sides winning*: both regenerate and both deal full ATK.

Worked example (observed 003→004, Spell vs Spell tie): my armor 0 +8 (my Spell
DEF) = 8, then −16 (their Spell ATK) = −8 → armor **0**, 8 overflow to HP,
31 → **23** ✓. Their armor 2 +4 = 6, then −12 (my Spell ATK) = −6 → armor **0**,
6 overflow, 22 → **16** ✓.

> **Superseded model — do not reintroduce.** An earlier reading of this data had
> *only Shield* granting armor, ties dealing `ATK − opponent DEF`, and a special
> case exempting Shield ties from DEF reduction. It also scores 14/14, because
> the two are algebraically identical while armor is 0 and the cap is slack, and
> because **every observed win was either Sword (DEF 0) or the enemy's Shield** —
> no win with a DEF-bearing non-Shield move was ever recorded. It diverges, and
> is wrong, the moment you win with Spell: it grants 0 armor instead of 8. Two
> models fitting the same fixtures is not agreement; prefer the one with no
> special cases.

**There is no healing in combat.** HP is only restored by a card offered
*after* a won fight (§4c). Armor is therefore the only renewable defensive
resource inside a battle, and regenerating it is the whole defensive game.
`w₃ = 0.3` badly undervalues it — see §4b.

**[RETRACTED 2026-08-15 — armor does NOT refill at room transitions.]** Session
03 recorded "armor refills to `currentMax` at every room transition; HP does
not", observed at "all three room boundaries of the deepest run". The corpus at
the time contained four room boundaries (pairs where `players[1].id` changes
under one `DUNGEON_ID_CID`), and three of them crossed with the player already
**at the armor cap**, where "refilled to max" and "unchanged" are the same
observation:

```
run-23-29-39  009->010  63->64  me ARM  4/15 ->  4/15   <- the only informative one
run-01-00-08  022->023  63->64  me ARM 15/15 -> 15/15
run-01-00-08  028->029  64->65  me ARM 15/15 -> 15/15
run-01-00-08  039->040  65->66  me ARM 15/15 -> 15/15
```

The one boundary that carries information crossed at **4/15 and stayed at
4/15**. HP, armor and charges all persist across a room transition unchanged.
What refills is the **enemy**, because the transition swaps in a new entity at
full pools (`HP 40/40 ARM 16/16`) — session 03 read the enemy's fresh pools as a
global rule and applied it to the player.

**[STRENGTHENED session 07]** The corpus now has **seven** room boundaries, and
every one of them — including four that cross well below either cap — confirms
the same rule for HP specifically, which is the fact the original three-of-four
sample couldn't establish:

```
run-23-29-39  009->010  63->64  HP  2/32 ->  2/32   ARM  4/15 ->  4/15
run-01-00-08  022->023  63->64  HP 15/32 -> 15/32   ARM 15/15 -> 15/15
run-01-00-08  028->029  64->65  HP 31/32 -> 31/32   ARM 15/15 -> 15/15
run-01-00-08  039->040  65->66  HP 22/32 -> 22/32   ARM 15/15 -> 15/15
run-03-26-57  006->007  63->64  HP 12/32 -> 12/32   ARM  0/16 ->  0/16
run-03-26-57  017->018  63->64  HP  4/32 ->  4/32   ARM 16/16 -> 16/16
run-03-26-57  029->030  63->64  HP 28/32 -> 28/32   ARM  8/16 -> 8/16
```

Four of these cross with HP below max (2, 15, 22, 12, 4, 28 — six, not one),
each unchanged across the boundary. **HP persists across room transitions; it
does not reset.** This settles session-06 brief §4's open question about
`Regen` ("start each battle with 2 regen, decreasing by 1 per turn until 0"):
since HP carries between rooms, a per-battle regenerating resource compounds
across a run rather than resetting with it — roughly 3 HP/battle × up to 16
rooms is a large cumulative refund against a 30 HP pool, *if* it fires every
room. This is reported as a capture finding, not modelled: `Regen`'s actual
in-combat mechanic is still unconfirmed (no pickup pair exists), and §4b is not
re-derived on the strength of a hypothesis about its size — see session-06
brief §4 and DECISIONS 2026-08-16.

**Consequence for §4b: the guidance built on this was backwards.** Armor is not
a per-room budget that is wasted if unspent, and spending it late in a room is
not free. It is a run-long resource that happens to be *renewable in combat*
(via a won or tied move's DEF), while HP is a run-long resource that is not
renewable at all. The asymmetry §4b needs is renewable-vs-not, not
per-room-vs-per-run.

> **This rests on ONE observation.** Three of the four boundaries are
> uninformative, so the entire correction hangs on `run-23-29-39 009->010`.
> That is enough to retract the old rule — a single counterexample refutes a
> universal — but it is *not* enough to be confident in the replacement.
> **Re-check this whenever the corpus grows**, and specifically whenever a run
> crosses a boundary below the armor cap. A capture that crosses two or three
> boundaries at partial armor would settle it. [session 05]

**Downstream consequence worth stating explicitly: armor depletes across all 16
rooms.** Since it does not reset at a boundary and only regenerates through a
won or tied move's DEF, a run that reaches room 10 arrives with whatever it has
managed to bank. That makes late rooms structurally harder than early ones in a
way §4b's flat weights never modelled, and it raises the value of armor and heal
boons considerably relative to a per-room reading. [session 05]

**The armor threshold — net damage is not ATK. [CONFIRMED 2026-08-15]**

Because a side that loses regenerates nothing, damage lands differently
depending on how the exchange resolved:

| exchange | our net damage |
|---|---|
| we win outright | **full ATK** — the loser regenerates nothing |
| we tie | `max(0, ourATK − theirMoveDEF)` — both regenerate before both deal |
| we lose | 0 |

The tie row is a **threshold, not a gradient**, and it is exact. A move whose
ATK is at or below the opponent's move DEF makes *literally zero* progress in a
mirror, forever. Verified in sim across all four observed enemies, our Shield
(6/12) mirrored against theirs:

```
enemy 63  Shield DEF 2  net 4  -> clears 100/100
enemy 64  Shield DEF 4  net 2  -> clears 100/100
enemy 65  Shield DEF 6  net 0  -> clears   0/100  (we die; its Shield ATK 15 > our 12 regen)
enemy 66  Shield DEF 8  net 0  -> clears   0/100  (true stall; neither side can finish)
```

One point of DEF separates a winnable grind from an unwinnable one. §4b's smooth
`w₂·(enemyHP/enemyMaxHP)` term cannot express this — it scores 6 damage as 75%
of 8 damage when one may be worth nothing and the other everything. **Task 5
must compute net damage per §4's table, not read raw ATK.**

> **[CORRECTION 2026-08-15]** The session-04 brief proposed a single rule,
> `effective damage = max(0, ATK − armorRestoredPerWin)`, applied to *every*
> exchange, and the session-03 recap explained the lost run as "enemy 63's 12
> armor fully restores on any enemy win". Both are wrong. Regen is the **played
> move's DEF, capped** — never a restore to full. Enemy 63's armor was recorded
> going `6 -> 12` on a Sword win whose DEF is exactly 6, and `12 + 2` capped
> back to 12 on a Shield tie. And the offset applies only on a tie, because a
> loser gains nothing. The lost run was not a flat threshold: it was a **rate
> race** the player lost, 6 damage per landed hit against a 12-armor pool being
> topped up 2–6 at a time.

**[UNRESOLVED 2026-08-14] The model above is exact only for clean exchanges.**
It holds **127/132** side-updates across four captures, and — the number that
matters — **41/41 on the clean subset, with zero failures there.** All 5 misses
sit on exchanges already flagged with a reason code. Every miss involves a
mechanic outside the model, and two are not yet explained by any rule:

- Enemy 65 (`block: 2`, `evasion: 2`) took **8 damage from a 16-ATK Sword win**.
  Neither stat explains 8 arithmetically (not `16−2`, not `16−4`); it is exactly
  half. One sample. Do not guess — capture more.
- With `Burn` up, the enemy lost **1 HP/turn and regenerated no armor**, though
  the applied burn amount was 3. Tick rate and the burn/armor-regen interaction
  are both unknown.

Anything built on the clean model is correct for room 1 and increasingly wrong
after it, because boons and rolled enemy stats compound with depth.

### Charges — mechanics and the caveat **[PARTIAL]**

**[CONFIRMED 2026-08-14, recounted 2026-08-15]** over **132 played moves** across
4 captures and 5 dungeon attempts, by `scripts/chargeRecount.ts`:

- A played move costs **−1**, *except* a move played from **exactly 1 charge,
  which lands on −1, skipping 0.* 116/132 were −1; **all 14 exceptions were
  plays from exactly 1, with no residue.**
- Every move *not* played regenerates **+1 per exchange, capped at
  `maxCharges`**. 160/160 already at max stayed; 104/104 below max gained +1;
  nothing ever exceeded max. **264/264 unplayed transitions, no exceptions.**

> **[CORRECTION 2026-08-15]** The earlier count (134 moves, 118 at −1, 16
> exceptions) was inflated by one phantom exchange. `scripts/chargeTable.ts`
> admitted the pair `run-01-00-08 027→028`, which is the **boon pickup** that
> follows a kill: `lastMove` still names the killing blow on both sides, the
> enemy id has not changed yet, and a `Heal` boon moved the player's HP 15 → 31,
> so a "did anything change?" test passes. It is the sole source of the two
> `2 → 2 (delta 0)` played moves, and therefore of the claim that the 16
> exceptions were "all plays from exactly 1" — two of them were not plays at
> all. With the pair excluded the rule holds with **zero** unexplained deltas.
>
> The fix, now in `src/sim/corpus.ts` and required of any future analysis
> script: an exchange requires **both sides alive in the `before` state** and
> **no `rewardPathPhase`/`enemyPathPhase` active on it**. Read the phase flags
> directly; do not infer the state machine from what moved.
- Regeneration ticks on **combat exchanges only** — not across reward/enemy path
  phases or room transitions.

This supersedes session 02's "unexplained decrement of two": it was never two
collapsed turns or a hidden second cost, but a last-charge rule. Reproduced
independently on both sides in three separate runs.

**Legality: still not proven, but the evidence now leans hard one way.**
No move at ≤0 has ever been *observed being played*, and none has been observed
being *refused* either. What changed on 2026-08-15 is how the absence is read.

The session-03 reading was "23 firings, 0 forced ⇒ non-discriminating". That
counted the wrong thing. The informative quantity is not how often a play was
*forced*; it is how often a non-positive move was **available and declined**.
`scripts/chargeRecount.ts` splits this by actor, because the two actors are not
equal evidence:

| actor | opportunities | non-positive move played | expected if uniform | P(0 \| soft cost) |
|---|---|---|---|---|
| player | 12 | 0 | 4.00 | 7.7e-3 |
| **enemy** | **11** | **0** | 3.67 | **1.2e-2** |

**Only the enemy rows are evidence about the rule.** The player rows are
contaminated: the user was following a written guide that avoided low-charge
moves *by policy*, so a zero there is equally consistent with either hypothesis.
The enemy has no such policy, and across 11 clean opportunities it never once
took a move it was holding at ≤0.

That is `p ≈ 0.012` under the soft-cost null with uniform selection — suggestive,
not conclusive, and an order of magnitude weaker than the `1e-4` the session-04
brief estimated (the brief assumed every opportunity offered all three moves;
most offer only one non-positive move, so the per-turn avoidance probability is
2/3, not 1/3).

**[2026-08-15] Keep the `chargesAreHardLimit` flag, and default it to `true`.**
The evidence is one-sided and the cost asymmetry runs the same way: wrongly
pruning costs one option in the EV table, while wrongly permitting assigns
probability mass to a move the enemy *cannot* make, which corrupts every
prediction against that enemy. Threaded through `legalMoves(combatant, hardLimit)`
in `src/sim/combat.ts`, so flipping it touches no engine code.

Do NOT treat this as settled. The cheapest decisive test still costs no energy:
drive a move to −1 in the client and try to select it. Until then, log every
case where an enemy plays a move at ≤0 — one such observation flips the flag.

The session-03 brief's discriminator — *"a side held a move at ≤0 and played a
different one ⇒ illegal"* — remains **rejected as stated**: on its own it is
exactly what a free choice looks like. It is the *aggregate* zero across many
opportunities that carries the signal, not any single instance.

### Decision procedure

Each turn:

1. **Legal moves** — mine and (via charges) the enemy's.
2. **Predict** `P(enemy move)` — §4a.
3. **Simulate** all 9 (my move × enemy move) outcomes using the actual ATK/DEF
   numbers from live state, producing resulting HP/armor for both sides.
4. **Score** each resulting state with utility `U` — §4b.
5. **Play** `argmax_m Σ_e P(e) · U(outcome(m, e))`.

Pure function: `decide(state, model) → move`. No I/O. Test it against fixtures.

### 4a. Opponent model

Key counts by `(enemyId, roomIndex)`, Laplace-smoothed, persisted to
`data/opponent-model.json` so it improves across sessions.

```
P(e) = (count[e] + α) / (Σ count + 3α)     α = 1.0
```

Then handle moves the enemy has no charges for, per `chargesAreHardLimit`
(§4 charges): **default `true` — prune to zero and renormalise.** With the flag
`false`, down-weight instead of zeroing. One flag, read in one place; never two
code paths.

**Sample floor — a hard gate, not a blend. [2026-08-15]**

Below **30 observations for a key**, the model must return **uniform** and set
`confidence: "low"`. It must not emit a read at all. Above 30, blend toward
uniform in proportion to sample size as before.

This replaces the old "with fewer than ~20 observations, mix 50/50 with uniform"
because that guidance was in the spec *and was still not enough*: enemy 63 was
called "Shield-biased 57%" off 14 exchanges and play advice was given from it;
over 39 exchanges it is uniform (31/38/31). A 50/50 blend of a wrong read is
still a wrong read, just quieter. The floor has to be structural — downstream
code cannot be allowed to receive a thin read at all, and the `confidence` flag
exists so it cannot silently treat one as strong.

Check for determinism explicitly: after ~200 observations of an enemy, test
whether its move is predictable from the previous turn (a first-order Markov
chain). If any transition exceeds ~80%, log it loudly — you've found a scripted
enemy and can beat it nearly every turn. Store first-order transition counts
from the start so this analysis is available for free.

**Fallback when the model is uninformative:** don't just play Sword every time.
If the server ever adapts to you, a fixed move is maximally exploitable. Play
the maximin move over the uncertainty set instead — the one whose *worst case*
across plausible enemy distributions is best.

### 4b. Utility function

Terminal cases dominate; get these right and the rest is tuning:

- Enemy dead → `+1000`
- I'm dead → `-1000`
- Otherwise → `w₁·(myHP/myMaxHP) − w₂·(enemyHP/enemyMaxHP) + w₃·(myArmor/myMaxArmor)`

Start at `w₁=1.0, w₂=0.8, w₃=0.3`. Survival is weighted above damage on purpose:
a dead run forfeits every remaining room's loot, so the downside is much larger
than the upside of a fast kill.

**Revised 2026-08-13 — `w₃` is too low, and HP/armor are not the same currency.**

Armor absorbs before HP and is **renewable**: every won or tied exchange
regenerates the played move's DEF. HP is **not renewable in combat at all** —
only a post-fight card restores it (§4 combat resolution). So:

- **Armor spent is nearly free** if you expect to win or tie soon; it comes back.
- **HP spent is gone for the rest of the run**, unless a heal card shows up.

A utility function that adds them into one effective-HP pool erases exactly this
asymmetry, so treat that form as a baseline to beat, not the default:

```
w₁·((myHP + myArmor) / (myMaxHP + myMaxArmor)) − w₂·(enemy equivalent)
```

Prefer keeping the terms split, with `w₃` raised to about `0.8` and, better, an
explicit penalty on *HP* loss above and beyond the armor term — losing 8 HP
through an empty armor pool should score strictly worse than losing 8 armor.
Sweep both in Task 11 against the real opponent model.

A concrete consequence to sanity-check any candidate weighting against: at
`HP 7 / ARM 0` versus an enemy on `HP 4`, Shield (6/12) regenerates 12 armor
*before* damage lands, which converts two of the three enemy replies from lethal
into survivable and wins the third. Any weighting that does not pick Shield
there is wrong.

Add a **depth bonus**: later rooms are worth more, so raise `w₁` as room index
climbs — dying in room 4 wastes far more invested energy than dying in room 1.

**Tie-value asymmetry — a Task 5 input the current form cannot express.
[2026-08-15]**

Ties are not neutral, and their value depends entirely on *which move* ties.
From the corrected damage rules above, a tie deals `max(0, myATK − theirDEF)`,
so with our loadout:

| our move | ATK | tie vs enemy 66's Shield (DEF 8) | tie vs enemy 63's Shield (DEF 2) |
|---|---|---|---|
| Sword  | 16 | 8 damage | 14 damage |
| Spell  | 12 | 4 damage | 10 damage |
| Shield |  6 | **0 — literally nothing, forever** | 4 damage |

So **under genuine uncertainty, tying with a high-ATK move strictly dominates
tying with a low-ATK one.** The `w₂·(enemyHP/enemyMaxHP)` term has no way to say
this: it scores 6 ATK as 75% of 8 ATK when one may be worth nothing at all and
the other everything. Task 5's EV engine must score a candidate move by
`netDamageOnTie` against each possible reply, not by raw ATK.

`scripts/sim.ts` asserts the threshold directly against all four observed
enemies and it holds exactly — our Shield's 6 ATK clears DEF 2 and 4, and makes
zero progress at DEF 6 and 8.

### 4c. Loot selection

**[CORRECTED 2026-08-14]** This section was written against zero evidence and
against the wrong fields. Boons arrive as `rewardPathOptions[]` during
`rewardPathPhase`, **not** `lootOptions`/`lootPhase` — see §3. Three options
were offered (not "up to four"). Read applied values from `selectedVal1` /
`selectedVal2`.

Boon shapes actually observed (all `RestrictedToDungeons: ["5"]` unless noted):
`AddLuck` (Common, 1), `CorrosiveShield` (Uncommon, 2), `UpgradePaper`
(Uncommon, val2 2 → 4, `MaxRoom: 12`), `AddEvasion` (Common, 1), `Heal`
(Uncommon, 8 → **16**, `MaxRoom: 12`), `AddBurnSword` (Uncommon, 3).

A separate decision follows immediately: `enemyPathOptions[]`, choosing the next
enemy by tier. That choice is **not** covered by the ranking below and is
currently unspecified.

After each win you pick one of three boons. Rank by:

1. **Heal**, if HP fraction < 0.5 and rooms remain. Survival compounds; nothing
   else matters if the run ends. **[CONFIRMED 2026-08-13]** this card is the
   *only* way HP is ever restored — there is no in-combat healing — so a heal
   offered at low HP is worth more than any stat upgrade, and passing one up is
   effectively choosing to end the run early.
2. **Upgrade the move you actually play most** (read it off your own logged move
   distribution, not off a guess about what's theoretically strongest).
3. **Max HP / armor**, weighted up in early rooms where a long run is still ahead.
4. Raw ATK on a move you rarely play — last.

Log every boon offered and taken to `data/loot-log.jsonl`, so this ranking can
later be replaced with something fitted to actual run outcomes rather than
intuition.

### 4d. Boon effects — the model **[Task 4.5, 2026-08-15]**

Implemented in `src/sim/boons.ts`; every delta below is re-derived from the
fixtures by `tests/boons.test.ts`, so this table cannot drift from the responses
it claims to come from.

**A boon is modelled only if the corpus contains a state pair bracketing its
pickup.** A pickup pair is a `rewardPathPhase` state followed by one where
`pickedBoons` has grown by exactly one; all four in the corpus add exactly one
boon, so each isolates a single effect with no attribution ambiguity.

| boon | selectedVal1 | observed delta | evidence |
|---|---|---|---|
| `AddLuck` | 1 | `lck.current` 0 → 1 | run-23-29-39 008→009 |
| `AddEvasion` | 1 | `evasion.current` 0 → 1 | run-01-00-08 021→022 |
| `Heal` | 16 | `health.current` 15 → 31 (hpMax 32) | run-01-00-08 027→028 |
| `AddBurnSword` | 3 | **nothing** — latent, fires in combat | run-01-00-08 038→039 |

`AddBurnSword`'s empty delta is a **result**, not a gap: the pair proves the
pickup changes no stat.

Two things are deliberately *not* modelled:

- **Seven offered types have no pair**: `AddBlock`, `AddIntuition`,
  `AddTenacity`, `CorrosiveShield`, `TieDamageReduction`, `UpgradePaper`,
  `UpgradeScissor`. `UpgradePaper` almost certainly adds 4 to Shield — its name
  says so and its `selectedVal2` is 4 — and it stays unmodelled anyway, because
  nobody picked it and no recorded state shows what moved.
- **Additive vs assignment for the rolled-stat boons.** Both samples went
  `0 → val1`, so `+= val1` and `= val1` fit equally. `boons.ts` uses additive;
  one capture of a second rolled-stat boon in the same run settles it.
- **Heal's cap is unverified.** The one sample healed 15 → 31 against an hpMax
  of 32, so it never reached the ceiling. `boons.ts` caps at `hpMax` as the
  conservative reading.

#### Why this did not raise `deepestScorableRoom`

The task's gate asked for ≥ 4. It stayed at **1**, for three independent
reasons — and the second one means the gate was never reachable at all:

1. **No clean room-1 boon exists in the corpus.** Both recorded room-1 offers
   are `AddLuck | CorrosiveShield | UpgradePaper` and
   `AddEvasion | AddTenacity | AddBlock`. Every one is either unmodelled or
   grants a rolled stat whose effect on damage is unexplained. **6 of 6 room-1
   options are unscorable**, so a run is contaminated before room 2 begins.
   `Heal` — the only clean boon anywhere in the corpus — is only ever offered at
   room 2, by which point it is too late to help coverage.
2. **Rooms 3+ are unscorable for reasons boons have nothing to do with.** Enemy
   65 carries `evasion 2 / block 2 / lck 1` **innately**, and enemy 66 carries
   Burn while the run carries `shatterblade`. A *perfect* boon model therefore
   caps `deepestScorableRoom` at **2**. This is a fact about the enemies.
3. **There is no grounded offer distribution.** Four offer triples exist (two at
   room 1, one each at rooms 2 and 3). The sim draws only from these and does
   not synthesise offers — generating them would invent the single thing that
   decides how a run develops, off a sample of four.

`scripts/sim.ts` prints a clearly-labelled counterfactual that substitutes
`Heal` into room 1: `deepestScorableRoom` rises to **2** and stops. That
confirms the boon machinery is correct and that the remaining blocker is
capture, not code.

### 4e. Rolled stats — audited, still unexplained **[2026-08-15]**

`evasion / block / lck / tenacity / intuition` are read from `.current`, never
`.starting`. `src/sim/combat.ts` does not read them at all: any non-zero value
makes the surrounding unit unscorable.

> **[2026-08-16] ROLLED STATS ARE PERCENTAGES, and this rewrites the audit
> below.** The client renders the boons as `+5% intuition` and `+1% luck`
> (user-reported from the in-game option text, run 3's room-1 offer), and
> `AddIntuition`'s `selectedVal1` of 5 landed as `intuition.current = 5`. So
> `current` is a **percent proc chance**, not a count of points.
>
> Every sample-size argument in this section was calibrated to the wrong number.
> "n = 9 with one miss is the shape a ~10% dodge proc produces" assumed evasion 1
> meant something like 10%; it means **1%**. At 1%, nine damage-taking
> opportunities produce a dodge 8.6% of the time, and even the 30-observation
> floor is nowhere near enough — reading a 1–5% proc needs *hundreds* of
> observations.
>
> Two consequences, pulling opposite ways:
>
> - The decision NOT to narrow `ROLLED_STATS` was right, and is now much more
>   strongly right. It was held on a floor of ~30; the real requirement is an
>   order of magnitude beyond that.
> - But the reason recorded for it is wrong, and so is the conclusion drawn just
>   above about 037→038. See the note there.
>
> Source discipline: this is **option text**, which DECISIONS 2026-08-15 forbids
> modelling from. It is recorded here because it tells us what to *look for* and
> what sample size a capture would need. It does not license modelling a proc.

> **[2026-08-16] Enemy rolled stats are a CHOICE, not a property of the enemy.**
> `enemyPathOptions[]` carries `rolledEnemyStats` per tier — tier 0 ("Safe") is
> all zeros, tier 2 ("Dangerous") is not. See §3e. So on the enemy side this
> whole section describes a *tier the user picked*, and the bot can avoid the
> mechanic entirely by picking Safe. It remains genuinely open on the **player**
> side, where a rolled stat arrives via a boon.

Counted in **damage-taking opportunities** (side-updates flatter the numbers,
because a side that wins outright takes nothing and gives the stat no chance to
fire):

```
player evasion1      8/9   exact      <- side-update count inflates this to 20/21
player lck1          2/2   exact
player none         29/29  exact
enemy  ev2+bl2+lk1   6/7   exact
enemy  none         34/37  exact      <- all 3 misses are Burn
```

It is tempting to conclude "evasion 1 does nothing" and unlock room 2. **Do
not.** n = 9 with one miss is exactly the shape a ~10% dodge proc produces, and
the enemy-63 "Shield-biased 57% off 14 exchanges" mistake is the same shape.
Per the 2026-08-15 decision on the opponent model, ~30 observations is the floor
for reading a rate.

**The enemy-65 anomaly (029→030): our Sword's 16 ATK dealt exactly 8.** The same
matchup at 032→033 dealt the full 16 against the same enemy with the same stats,
so it is **not a function of (moves, stats) alone**. Tested and rejected:

- *block halves damage landing on armor* — rejected by 030→031, where our
  Shield's 6 ATK landed in full on armor 7 → 1.
- *a flat reduction* — rejected; every other enemy-65 exchange takes full ATK.
- *damage to a target at full armor is halved* — fits both samples and is not
  rejected by any enemy-65 row, but enemy 63 at full armor took full damage, so
  it would have to be conditional on `block > 0`. One positive sample. Not
  modellable.

**The player-side miss (037→038) was perfectly confounded — and session 06 broke
the confound.** The player took 0 from a 10-ATK tie. Either `evasion 1` dodged,
**or a side that dies on an exchange deals no damage** — and 037→038 was the only
exchange in the corpus where a side died on a *tie*, so the two were
indistinguishable. The session-06 brief preferred the second on parsimony.

**[REFUTED 2026-08-16.]** `run-2026-08-14-03-26-57 004→005` is a second
death-on-a-tie, and it is inside the clean model:

```
before  me HP 20/32 ARM 0/16   foe HP  4/30 ARM 0/12
after   me HP 12/32 ARM 0/16   foe HP  0/30 ARM 0/12    me=Spell foe=Spell, tie

foe: tie -> regen own DEF 4 -> armor 4; takes our ATK 12 -> 4-12 = -8 -> HP 4-8 -> 0, DEAD
me:  tie -> regen own DEF 8 -> armor 8; takes foe ATK 16 -> 8-16 = -8 -> HP 20-8 = 12 ✓
```

The enemy **died on that tie and dealt its full 16 anyway**. So "a side that dies
deals no damage" is false, and the surviving explanation for 037→038 is
`evasion`. Do **not** implement the die-on-a-tie flag the session-06 brief §4
asked for; it would be modelling a rule the corpus refutes.

Note which way this cuts: the parsimonious hypothesis was the wrong one, and the
player-side evasion evidence stays **8/9, not 9/9**.

**[CORRECTED later the same day, by the percentage finding above.]** The first
reading of this was "so `evasion` probably does something" — i.e. evasion
explains the miss now that die-on-a-tie cannot. That does not survive the units.
At `evasion 1` = **1%**, a dodge inside nine opportunities is an 8.6% event, so
evasion is a *poor* explanation of 037→038, not a good one.

**037→038 is therefore explained by neither hypothesis**, and is back to being
genuinely unexplained. That is a worse position than the confound was, and an
honest one: two candidate rules have been eliminated and nothing has replaced
them. Do not attribute it to evasion in a future session on the strength of it
being the last hypothesis standing — it is the last hypothesis standing largely
because nobody has proposed a third.

**[2026-08-14, session 08] `intuition` — corpus checked for a rare-field
signature, found nothing.** The hypothesis (session-08 brief addendum §7): if
`intuition` reveals the enemy's next move, it likely shows as an occasional
EXTRA field rather than a permanent one, and ~92 exchanges at a 5% proc "should
have produced a few fires if the stat was active in those runs." `scripts/
fieldFrequency.ts` enumerates every key path across all 230 captured
player/enemy side-observations in the corpus:

- **Every top-level key is present on 100% of sides**, rolled stats included —
  `intuition.current`/`.starting` are there whether the stat is 0 or not, so a
  proc cannot show up as a key appearing or disappearing. This rules out the
  "extra field" form of the hypothesis as stated.
- The plausible alternative — a proc showing up as CONTENT inside a normally-
  empty array — also comes back empty: `activeEffects` and `triggeredBoons` are
  non-empty in **0/230** sides, `gearBoons` 0/230, `statusEffects` 3/230 (all
  three are the known Burn instance, §4f). `battleArmorReduction` is `0` in
  every single observation.
- `intuition.current` is non-zero (i.e. the boon was carried) in only 6/230
  side-observations. Even restricted to those 6, nothing above fires — but 6
  carrying-observations is far below the "hundreds of observations" floor
  §4e's percentage finding already established for reading a 1–5% proc, so this
  is not strong evidence intuition does nothing. It is evidence the corpus has
  never had enough exposure to see it, which is what a supervised human capture
  was always going to struggle to produce.

**Consequence:** per the brief's own addendum, this doesn't license modelling
`intuition` either way — it narrows the next move to check 2 (log the full raw
state whenever an unexpected key appears, live, at machine speed) rather than
anything a corpus re-audit can settle. `intuition` stays unmodelled.

### 4f. Burn — a strong hypothesis, held behind a flag **[2026-08-15]**

Burn deals a **flat 3 damage per exchange**, applied after the exchange's own
damage, and its `amount` does not decrement over three consecutive exchanges:

```
045->046  rock/scissor   predicted enemy HP 28, actual 25          (+3)
046->047  paper/paper    predicted 25/2, actual 24/0  -> 9 = 6+3   (+3)
047->048  paper/paper    predicted 24/2, actual 23/0  -> 9 = 6+3   (+3)
```

`statusEffects` reads `[{Burn, amount: 3}]`, and Burn first appears immediately
after the player's first Sword win of that battle — which is what `AddBurnSword`
should do. Fits 3/3.

It stays **default-off** (`BURN_PER_EXCHANGE` in `src/sim/boons.ts`) because the
boon's `selectedVal1`, the status `amount` and the damage are all the number 3,
from a single status instance at a single value, so "ticks for `amount`", "ticks
for 3" and "ticks for the boon's val1" are the same observation — and it is
never seen expiring, so the duration is unknown.

> **[2026-08-16] The coincidence is now breakable.** §3e records a
> `perpetual_firebrand` enemy buff whose declared Burn `amount` is **2**, not 3.
> One capture of a Firebrand enemy actually burning separates "ticks for
> `amount`" from "ticks for 3" in a single observation. The duration question is
> untouched by this and still needs a Burn seen expiring. The flag stays off
> until both land. Same treatment as
`chargesAreHardLimit`: implemented, flagged, defaulted to the side that refuses
to score rather than the side that guesses. Turning it on buys nothing today,
since the only enemy ever seen burning is in room 4, which is unscorable for
`ENEMY_BUFF` regardless.

**Also worth recording: `shatterblade` fired twice and did nothing observable.**
The run-level `activeEnemyBuff` ("Applies 1 Vulnerable on Sword wins") was live
from state-029 on. The enemy won with Sword at 042→043 and 043→044; the player's
`statusEffects` stayed `[]` both times and the player took exactly the predicted
damage. `ENEMY_BUFF` stays as a reason code — n = 2 settles nothing — but 2
opportunities with 0 observed effects is worth knowing.

---

## 5. Fishing strategy

### Confirmed mechanics

3×3 grid. Fish occupies one cell. You play a spell card from your hand; the
fish then moves to a different cell. Cards have a mana cost, a **hitbox** (set of
grid cells), and damage. Hit → catch meter rises. Miss → catch meter falls. Fill
the meter to catch. Run out of mana, or let the meter hit zero, and the fish
escapes and the cast is over.

You may **redraw** your hand instead of casting, at 1 mana per card still held.

Cast tiers cost energy: Small 12, Normal 16, Big 20. Daily cap 10 casts (20 if
juiced). Rods grant a starting spell set. Every successful catch adds a spell to
your deck for that day.

Relevant skills: **Fintuition** (chance to reveal the fish's next move — check
state for a reveal field and *use it*, it makes that turn deterministic),
**Stamana** (starting mana), **Jebaitor**, **Dual Yielding**.

### The whole game is one sentence

The docs say: *fish have a variety of different patterns; use the first move to
note the pattern.* That means movement is drawn from a **finite library of
deterministic patterns**, not from noise. So this isn't a prediction problem,
it's an **identification** problem — Mastermind, not roulette. Once you know
which pattern you're facing, you know exactly where the fish will be, and you
hit it every remaining turn.

### Hypothesis elimination

Maintain a candidate set of patterns. Each observed move eliminates every
candidate inconsistent with it. Prediction is the distribution over survivors:

```
H = all known patterns
observe (fromCell → toCell) at turn t:
    H ← { h ∈ H : h.predict(fromCell, t) == toCell }
P(next = c) = |{h ∈ H : h.predict(current, t+1) == c}| / |H|
```

When `|H| == 1`, prediction is certain — play max damage into that single cell.

Represent a pattern as `(state, turnIndex) → nextCell` so it covers both
stateless rules (fixed delta cycles, mirrors, clockwise walks) and cyclic
sequences. Seed the library from observed data rather than guessing: log every
transition to `data/fish-patterns.jsonl` from the very first cast, then mine
recurring cycles offline and promote them to named patterns. **The bot gets
sharper the longer it runs** — that's the whole design, so get the logging right
in the first version even before the matcher is smart.

If `|H|` ever hits zero, your library is incomplete: fall back to the empirical
distribution over all logged transitions from that cell, and flag the cast for
offline pattern mining.

### Card choice

For each affordable card:

```
EV(card) = Σ_{c ∈ card.hitbox} P(next = c) · card.damage
         − missPenalty · (1 − Σ_{c ∈ card.hitbox} P(next = c))
```

Then pick `argmax EV(card) / card.manaCost` — mana is the real budget, and a
cheap reliable hit usually beats an expensive gamble.

Two overrides:

- **Lethal check first.** If a card can fill the catch meter this turn, play it
  and ignore efficiency entirely.
- **Uncertainty shapes the choice.** When `|H|` is large, prefer wide hitboxes —
  they hedge. When `|H| == 1`, prefer maximum damage into the known cell. Early
  turns are for identifying the pattern; later turns are for cashing it in.

**Redraw** when `max EV < redrawThreshold` and mana comfortably exceeds the
redraw cost. Tune the threshold in the sim, not live.

---

## 6. Architecture

```
src/
  api/          client.ts (auth, rate limit, action-token mutex, retries)
                dungeon.ts, fishing.ts, player.ts    ← no game logic
  strategy/     dungeon/  decide.ts, utility.ts, opponentModel.ts, loot.ts
                fishing/  patterns.ts, hypothesis.ts, cardChoice.ts
                          ← pure functions, no network
  sim/          types.ts, combat.ts, coverage.ts, corpus.ts, enemies.ts,
                rng.ts, scenarios.ts, dungeonSim.ts, replay.ts
                fishingSim.ts (Task 8)
  orchestrator/ loop.ts, budget.ts, guards.ts
scripts/        probe.ts, parseHar.ts, mineFishPatterns.ts
fixtures/       probe/, dungeon-runs/, fishing-casts/
config/         bot.json (user-editable), discovered.json (generated)
data/           opponent-model.json, fish-patterns.jsonl, loot-log.jsonl
logs/
```

The `api` ↔ `strategy` split is what makes everything testable. Strategy takes a
state object and returns a decision; it never knows the network exists.

### The sim's coverage contract **[2026-08-15]**

`src/sim/` never approximates a mechanic it does not understand and never
hardcodes one to zero. Anything outside the clean exchange model becomes a
**reason code** (`src/sim/coverage.ts`), the surrounding unit is marked
UNSCORABLE, and it is excluded from every rate the sim reports.

- **Any claim about win rate must state coverage beside it.** A win rate
  without its coverage is not a result.
- `src/sim/corpus.ts` is the only module that knows the wire shape. Analysis
  scripts go through it rather than re-deriving the pair-walking rules — two
  scripts have now shipped bugs those rules exist to prevent.
- `src/sim/enemies.ts` is checked against the fixtures by `tests/enemies.test.ts`,
  so a hand-edited stat cannot drift from the response it claims to come from.
- The sim reports `deepestScorableRoom`. **It is currently 1.** That is the
  headline blind spot, and it is the number that should climb every session.

Where coverage stands today, on 1000 synthetic runs (random vs random):

```
runs:    394 / 1000 scored          battles: 1000 / 1858 scored
  606 BOON_TAKEN                      858 BOON_TAKEN
  205 ROLLED_STATS                    252 ROLLED_STATS
   47 STATUS_EFFECT / ENEMY_BUFF       47 STATUS_EFFECT / ENEMY_BUFF
```

The wall is sharp rather than gradual: **room 1 is clean in every capture, and
every contaminant enters at the first `rewardPathPhase`.** Clearing a room
means taking a boon, so a scored *run* is by construction one that died in room
1 — which is why the run-level win rate is 0% and carries no information. The
battle-level rate over room 1 is the number with content in it.

### Orchestrator loop

```
while within daily budget:
    energy = getEnergy()
    if energy ≥ dungeonCost and dungeonRunsLeft > 0:  runDungeon()
    elif energy ≥ castCost and castsLeft > 0:         runFishingCast()
    else:  sleep until energy regen threshold (10/hr, 17.5/hr juiced)
```

Prefer whichever loop the user ranks higher in `config/bot.json`; default to
draining dungeon runs first since they cap at 10/day and carry progression.

### Guards — enforced in `guards.ts`, not scattered

Hard stop on: daily energy budget exceeded · daily run/cast cap reached · 3
consecutive action failures · unknown enum in any response · HP-zero loop
detected (same state twice in a row) · JWT rejected.

Every stop writes the full response body to `logs/` and exits non-zero.

---

## 7. Observability

Structured JSONL to `logs/run-<timestamp>.jsonl`, one line per action:
timestamp, action, request body, response summary, decision inputs, chosen move,
and *why* (the EV table). The EV table is what lets you debug a strategy that's
losing without re-running it live.

Per-run summary: result, rooms cleared, final HP, boons taken, items gained
(inventory diff before/after), energy spent, wall-clock duration.

Daily rollup: win rate, average rooms cleared, items/energy, fish caught by
rarity, seaweed earned, opponent-model confidence per enemy.

Track **items per energy spent** as the headline metric. Win rate alone is
misleading — a cautious bot that survives every run but clears few rooms can
easily be worse than an aggressive one that dies sometimes.
