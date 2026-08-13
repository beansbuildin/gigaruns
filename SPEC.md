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

Present but **semantics still unknown** (all zero/empty in the observed run):
`tenacity`, `evasion`, `lck`, `intuition`, `block`, `battleArmorReduction`,
`activeEffects`, `statusEffects`, `pickedBoons`, `triggeredBoons`, `gearBoons`,
`focusBuffs`.

Energy is stored scaled (`ENERGY_CID: 332247916021`). Always read
`parsedData.energyValue`, never the raw CID.

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

Derived from 7 live exchanges in Forbidden Woods room 1 (14 side-updates, no
mismatches). Order of operations per exchange:

1. **Shield grants armor first.** Playing Shield (`paper`) adds armor equal to
   that move's own `currentDEF`, capped at `shield.currentMax`. This happens
   *before* incoming damage is applied.
2. **Damage.**
   - **Win/loss:** the winner deals its **full `currentATK`**. The loser's DEF
     does **not** reduce it. The loser deals **zero**.
   - **Tie (same move):** *both* sides deal `ATK − opponent's DEF`, floored at 0.
   - **Exception:** in a Shield-vs-Shield tie, Shield's DEF is spent on the
     armor grant and does **not** also reduce incoming damage.
3. **Damage hits armor first, overflow carries to HP.** Armor floors at 0 and
   the remainder is subtracted from HP in the same exchange.

Worked example (observed 004→005, Shield vs Shield tie): my armor 0 +12 (Shield
DEF) = 12, then −8 (their Shield ATK, no DEF reduction) = **4** ✓. Their armor
0 +2 = 2, then −6 (my Shield ATK) = −4 → armor **0**, 4 overflow to HP,
16 → **12** ✓.

This makes Shield a **resource-regeneration move**, not a stall: a won or tied
Shield converts DEF straight into a fresh armor pool. `w₃ = 0.3` badly
undervalues it — see §4b.

### Charges — mechanics and the caveat **[PARTIAL]**

A played move costs 1 charge; every move *not* played regenerates +1 per
exchange, capped at `maxCharges`. Confirmed across 14 transitions.

**One exception, and it matters.** The enemy played `paper` at
`currentCharges: 1` and it went to **−1**, not 0. Every other transition moved
by exactly ±1. Charges therefore **can go negative**, and we have *not* observed
whether a move at 0 or below can still be played.

So: **do not prune a move purely because its charge count is ≤ 0** until this is
settled. Treat a non-positive charge as *evidence of reduced likelihood*, not as
proof of illegality, and log every case where an enemy plays a move at ≤ 0 so
the question resolves itself with data. Getting this wrong assigns probability
zero to a move the enemy can actually play, which is exactly the kind of
confident-and-wrong that loses runs.

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

Then **down-weight moves the enemy has no charges for** — but do not zero them
outright. See the charge caveat in §4: a move at ≤ 0 charges has been observed
to exist, and has not been shown to be unplayable. Zeroing and renormalising is
only correct once that is confirmed.

Blend toward uniform when the sample is thin: with fewer than ~20 observations
for a key, mix 50/50 with uniform. This stops one lucky read from driving
confident bad decisions.

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

**Revised 2026-08-13 — `w₃` is too low.** Armor is a full damage pool that
absorbs before HP, and Shield actively refills it (§4 combat resolution). In the
observed run, armor soaked 27 of the 51 damage taken. Effective HP is
`HP + armor`, so armor deserves a weight near `w₁`, not a third of it. Start at
`w₃ = 0.8` and sweep it in Task 11. Better still, replace the split terms with
effective HP:

```
w₁·((myHP + myArmor) / (myMaxHP + myMaxArmor)) − w₂·(enemy equivalent)
```

Both forms are worth testing in sim before either is trusted.

Add a **depth bonus**: later rooms are worth more, so raise `w₁` as room index
climbs — dying in room 4 wastes far more invested energy than dying in room 1.

### 4c. Loot selection

After each win you pick one of up to four boons. Rank by:

1. **Heal**, if HP fraction < 0.5 and rooms remain. Survival compounds; nothing
   else matters if the run ends.
2. **Upgrade the move you actually play most** (read it off your own logged move
   distribution, not off a guess about what's theoretically strongest).
3. **Max HP / armor**, weighted up in early rooms where a long run is still ahead.
4. Raw ATK on a move you rarely play — last.

Log every boon offered and taken to `data/loot-log.jsonl`, so this ranking can
later be replaced with something fitted to actual run outcomes rather than
intuition.

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
  sim/          dungeonSim.ts, fishingSim.ts, replay.ts
  orchestrator/ loop.ts, budget.ts, guards.ts
scripts/        probe.ts, parseHar.ts, mineFishPatterns.ts
fixtures/       probe/, dungeon-runs/, fishing-casts/
config/         bot.json (user-editable), discovered.json (generated)
data/           opponent-model.json, fish-patterns.jsonl, loot-log.jsonl
logs/
```

The `api` ↔ `strategy` split is what makes everything testable. Strategy takes a
state object and returns a decision; it never knows the network exists.

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
