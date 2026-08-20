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
| POST | `/roms/factory-claim` | claim ROM-accrued energy into the spendable pool **[CONFIRMED, session 19]** |

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
`use_item` **[CONFIRMED — see below]**, `heal_or_damage` **[VERIFY]**,
`flee` **[VERIFY]**, `cancel_run` **[VERIFY]**.

**`use_item` — CONFIRMED live, 2026-08-16, session 16 (Task 12 Stage B).**
Same combat-style envelope as `rock`/`paper`/`scissor`, with `data.itemId`
set to the item's ID (e.g. `131` for Big Heal Juice) and `data.index` set to
**how many items from THIS run's committed `consumables` loadout have
already been consumed** — NOT the item's stable id, and not a fixed 0. A
loadout of `[131, 131]` (2× Big Heal Juice) needs `index: 0` for the first
use and `index: 1` for the second; resending `index: 0` for the second use
was rejected `HTTP 400 {"message":"Item not found in index"}`, and `index:
1` then succeeded. Confirmed working two ways in the same battle:
`scripts/liveRun.ts`'s own real-time policy (first use, index 0) and a
one-off manual probe with a captured `actionToken` (second use, index 1) —
see `scripts/probeUseItemIndex1.ts`.

**Confirmed NOT to cost a combat turn.** A successful `use_item` heals HP
(flat, matching `GET /offchain/static`'s `gameItems[131].itemEffect`, capped
at `hpMax`) with the enemy's HP/ARM and the opponent model's observation
count both UNCHANGED across the call — no exchange resolves. This settles
Task 12 Stage B's open turn-cost question: a potion is a free action from
combat's perspective, not a substitute for a move.

**[2026-08-14, session 09] The last four are unconfirmed and the source is
compromised.** This whole list came from Gigaverse's published agent skill,
and two of its documented index-selecting names (`loot_one`, and the
`enemy_*` guess below) were both wrong when checked live. Treat `use_item`,
`heal_or_damage`, `flee`, `cancel_run` as hypotheses, not facts — confirm
opportunistically when a run is already being abandoned (for `flee`/
`cancel_run`) or an item is already in hand (for `use_item`), never
speculatively mid-run: CLAUDE.md §2 forbids inventing an endpoint, and a 400
in the middle of a live run costs the run.

**[2026-08-14, session 08, live] This list was incomplete, and the envelope
above is NOT universal.** Task 6 stage 3's first live run reached a
reward-path pick (three boon cards) and guessed `loot_one` for "pick option
0" — SPEC's original list has no dedicated reward/enemy-path action, and
`loot_one`…`loot_four` were the only index-selecting names it documented.
Rejected with HTTP 409. The user captured the real client's request via
DevTools: it sends **`reward_one`**, not `loot_one`. `reward_two`/`three`/
`four` are inferred by the naming pattern, not individually confirmed
**[VERIFY]**.

**The enemy-tier pick is `path_two`, CONFIRMED — the `enemy_*` hypothesis
above was wrong.** `enemy_two` failed 3/3 live in session 08 (2×HTTP 500,
1×HTTP 400 on an otherwise byte-identical retry — the 400 is the tell that
this was a wrong name, not flakiness), and the user then captured the real
client sending `path_two` via DevTools for the same pick. `path_one`/
`path_three` are inferred by the naming pattern, not individually confirmed
**[VERIFY]**. `path_two`'s `data.index` is **0 regardless of the option's
array position** (the captured request picked `enemyPathOptions[1]` but sent
`index: 0`) — unlike `reward_*`, where `data.index` tracks position exactly.
See DECISIONS 2026-08-14 (session 08, live).

**The envelope itself also differs for this action family.** The real
`reward_one` request captured live:

```json
{
  "action": "reward_one",
  "actionToken": "",
  "dungeonId": 0,
  "data": {
    "consumables": [], "devBoons": [], "expectedAmount": 0,
    "gearInstanceIds": [], "index": 0, "isJuiced": false, "itemId": 0
  }
}
```

Two differences from `start_run`'s envelope above, both real, not typos:
`dungeonId` is **0** (not the run's actual dungeon id), and `actionToken` is
an **empty string** (not a number — the anti-spam token concept in the
"Action token" section below apparently does not apply to path-selection
actions). Four `data` fields (`itemId`, `expectedAmount`, `gearInstanceIds`,
`devBoons`) were never previously observed; all zero/empty in this capture
(a reward pick with no item cost). `src/api/schemas.ts`'s
`DungeonActionRequestSchema` and `scripts/liveRun.ts`'s
`buildPathSelectionEnvelope()` reflect this; combat/start_run keep the
original envelope, unaffected.

**Sequencing, confirmed the same live run:** combat win → `rewardPathPhase`
already `true` with `rewardPathOptions` populated on the very next state
read (no separate "collect loot" action needed at the API level, whatever
the client UI shows) → reward pick resolves it → `enemyPathPhase` becomes
`true` with `enemyPathOptions` populated → tier pick resolves it → next
room's combat begins. `pathPhase` and `lootPhase` were `false` throughout;
`lootOptions` stayed empty — consistent with DECISIONS 2026-08-14 that
these are not where rewards live.

**`GET /game/dungeon/state` on top of an already-active run correctly
returned it** — attempting `start_run` again while a run is active is
rejected HTTP 400 (`"Error starting dungeon"`); `scripts/liveRun.ts` checks
for an active run before deciding whether to start one, per this finding.

**Move naming — this trips people up.** The API uses RPS names; the game uses
weapon names. Map once, at the API boundary, and use weapon names everywhere in
your own code:

| Game term | API action | Profile |
|---|---|---|
| ⚔️ Sword | `rock` | high ATK, no DEF — beats Spell |
| 🛡️ Shield | `paper` | no ATK, high DEF — beats Sword |
| ✨ Spell | `scissor` | balanced — beats Shield |

Sword > Spell > Shield > Sword.

### Action token **[CONFIRMED, corrected 2026-08-14 session 08 live]**

Every response returns a fresh `actionToken`. Always send the newest one.
`start_run` uses `0`. Stale tokens are rejected (~5s anti-spam window). On
rejection, re-sync from `GET /game/dungeon/state` rather than retrying blind.

**Except this doesn't hold for `GET /game/dungeon/state` itself.** Confirmed
3 times on one live run: that endpoint's `actionToken` field reports `0`
regardless of the run's real state — it does not echo or advance the real
sequence. Evidence: read #1 (before any action) → `0`; a `rock` POST
succeeded and returned a real token; the very next `getDungeonState()` read
→ `0` again, run state otherwise unchanged. The client blindly trusting this
(`this.actionToken = ...` on every GET) clobbered the real token the POST
had just set, and the following action was sent stale and rejected (HTTP
500). Fixed: only `POST /game/dungeon/action` responses update the tracked
token now (`src/api/client.ts`). "Every response returns a fresh
actionToken" is true for actions, not for this one read endpoint.

**Path-selection actions (`reward_*` and `path_*`) don't use a numeric token
at all** — the real client sends `actionToken: ""` (empty string) for these,
confirmed live for both `reward_one` and `path_two`. See "Dungeon action
envelope" above.

> **[CORRECTION, session 52, LIVE 2026-08-19] The empty string is REJECTED on
> first attempt, deterministically.** Every `reward_*`/`path_*` POST across two
> juiced runs — **26 of 26** — came back
> `HTTP 500 {"success":false,"message":"Error tracking action","error":"Invalid
> action token  != <the outstanding numeric token>","actionToken":""}`, and the
> **byte-identical retry ~1.5s later succeeded every time**. Combat moves,
> which send the numeric token, succeeded first time in every case.
>
> Note the doubled space in `token  != N`: the server is comparing our empty
> string against the numeric token the previous response issued.
>
> ~~This is a server-side change, not a regression here.~~
> **[SUPERSEDED, session 53 — see below. It was never a change.]**

> **[CORRECTION TO THE CORRECTION, session 53, 2026-08-20] The server did not
> change. The behaviour was always there; a logging fix made it visible.**
>
> Session 52 concluded "the 2026-08-18 logs contain 40 path-selection decisions
> and ZERO such rejections" by grepping those logs for `"Invalid action token"`.
> That string could not appear before 2026-08-19, because session 47/51's
> `serverErrorDetail` fix is what started capturing the server's body at all.
> Counting on `reason`, a field populated on BOTH sides of that fix, the
> 2026-08-18 logs contain **40 rejections in 40 decisions** — the identical
> 100% rate. **A logging fix creates a false discontinuity in your own history;
> date an effect on a field that predates the instrumentation change, or say
> plainly that you cannot.**
>
> The real mechanism is TIMING, not the envelope. The server holds exactly one
> outstanding action token and rejects any POST carrying `actionToken: ""`
> while it is still outstanding. Measured over all ten pre-fix run logs
> (`scripts/rejectionAudit.ts`), on local response timestamps:
>
> | POST class | n | 1st-attempt failures | gap since last response |
> |---|---|---|---|
> | empty token, rejected | 66 | 66 | 0.90 – 1.54 s (med 1.28) |
> | empty token, accepted | 66 | 0 | 3.40 – 4.92 s (med 4.07) |
> | numeric token | 224 | 0 | 0.90 – 1.79 s (med 1.36) |
> | `start_run` (empty) | 4 | 0 | control — no token outstanding |
>
> Zero overlap; the threshold sits in (1.54, 3.40) s **since the response**.
> `start_run` sends the same empty string and has never been rejected, which is
> the control case that fits. The retry was never what fixed it — the DELAY
> was: `postWithVerifiedRetry` calls `getDungeonState()` before looping, adding
> ~2.7 s. This also explains session 08's founding incident (2026-08-14).
>
> **The envelope is CONFIRMED and unchanged.** `actionToken: ""` is correct; it
> was only ever being sent too soon. Fixed by pacing —
> `RequestPacing.minGapSinceResponseMs = 4000` on `reward_*`/`path_*` only
> (`liveRun.ts`'s `pacingForAction`). Note the clock: `RateLimiter`'s
> `MIN_GAP_MS` is REQUEST-to-request and differs from the response clock by one
> response latency (0.72–1.78 s), so a request-clock setting cannot express
> this threshold.
>
> **VERIFIED LIVE, session 53:** two juiced Tier-3 runs, **24 path-selection
> decisions, 0 first-attempt rejections**, against a historical rate of 100%
> (66/66). See QUESTIONS.md §21.

Model this as a single owned mutable in the client with a mutex — concurrent
actions against one account will corrupt the token sequence. **One in-flight
action at a time, always.**

---

### ROM factory-claim **[CONFIRMED, session 19]**

`POST /roms/factory-claim` — user-captured via DevTools (two real request
bodies: `{romId:"7959",claimId:"energy",amount:7}` and
`{romId:"2097",claimId:"energy",amount:57}`), not probed blind (CLAUDE.md
§2). Claims energy accrued by an owned ROM NFT into the SAME spendable pool
`GET /offchain/player/energy` reports — confirmed live this session, see
below. No wallet signature or gas prompt (user-confirmed); routine
authenticated write, same tier as `loot`/`use_item`.

**Request shape, live-tested [session 19]:**

```
POST /roms/factory-claim
{ "romId": "<string>", "claimId": "energy", "amount": <number> }
```

- Omitting `amount` entirely: **HTTP 500 `{"error":{}}`** (romId 7959,
  tested twice — with and without `amount`, both 500). `amount` appears to
  be REQUIRED in some form, not optional — though see the finding below,
  which shows it doesn't control the payout even when present.
- **`amount` does NOT determine the credited amount.** romId 2097 claimed
  with `amount:57` in the request succeeded (HTTP 200, `{"success":true}`),
  but the real energy delta (via `GET /offchain/player/energy`, before/after,
  net of ~4-5s natural regen) was **~1.0 energy, not 57**. The server
  credits some amount of its own determination; the client-supplied `amount`
  either goes unused or is validated against something unrelated to the
  actual payout. This directly answers next.md session-19 brief's Q1 in the
  opposite direction from the literal reading: `amount` isn't a response
  either (it's echoed nowhere in the response body — the success response is
  a bare `{"success":true}`), it just doesn't do what its presence in the
  captured request implies.
- **Cooldown is per-ROM accrual, not a fixed timer — session 19's framing
  was wrong. [REVISED, session 20]** User-reported directly: claim-to-claim
  cooldown itself is near-zero (0-1s); what actually gates a re-claim is
  whether that specific ROM has accrued anything new since its last claim.
  This explains romId 2097's 34-second re-claim failure (nothing new
  accrued yet) and romId 7959's two failures (unrelated to a broken ROM —
  its own accrual state was simply unknown at the time).
- **A real enumeration + real-time balance endpoint exists — session 19's
  "no enumeration endpoint found" is SUPERSEDED, not merely resolved.
  [session 20, user-captured]** The user captured a response (source
  endpoint not yet confirmed by URL — ask before scripting against it)
  listing all 37 owned ROMs, each with a `factoryStats` object including
  `energyCollectable` (the CURRENT real-time claimable amount for that ROM,
  right now — not a static/cached figure) plus `secondsSinceLastEnergyClaim`,
  `percentageOfAWeekSinceLastEnergyClaim` (accrual appears to run on
  roughly a one-week cycle to `maxEnergy`, per-ROM), `baseMaxEnergy`/
  `maxEnergy` (`maxEnergy = baseMaxEnergy * (1 + totalBoost)`,
  `totalBoost = romBoost + juiceBoost`), and `tier` (Silver/Gold/Void).
  Summing `energyCollectable` across all 37 ROMs in that one snapshot:
  **~3,252 energy sitting unclaimed** — roughly 7.7x the account's own 420
  energy cap, and nowhere near the "~1 energy trickle" session 19's single
  data point suggested.
- **`energyCollectable` maps directly to real credited energy — live
  confirmed. [session 20, live]** Two verification claims, both against
  small ROMs to avoid wasting a big accrual against the 420 energy cap:
  - romId 5345 (`energyCollectable: 12` in the snapshot): claimed with
    `amount:12` (matching, coincidentally) — real energy delta was
    **exactly 12** (107 → 119).
  - romId 689 (`energyCollectable: 11` in the snapshot, captured minutes
    earlier): claimed with `amount:999` (deliberately mismatched, to
    re-confirm `amount` is ignored) — real energy delta was **12**, one
    more than the snapshot's 11, consistent with a few more seconds of
    live accrual between the snapshot and the claim (this is a real-time
    meter, not a frozen figure) rather than any relationship to the
    request's `amount`.
  Session 19's single ~1.0-energy claim (romId 2097) is now understood as
  correct but non-representative: that ROM's `energyCollectable` at the
  moment of that claim was genuinely small, not evidence of a conversion
  factor or a fixed per-claim trickle. **`amount` remains fully cosmetic —
  confirmed again this session — the server always credits the ROM's own
  accrued `energyCollectable`, not the client-supplied number.**
- Full request/response fixtures (no address/username, safe to commit):
  `fixtures/probe/roms/attempt{1,2,3,4}-*.json`,
  `claim-5345-withAmount.json`, `claim-689-withAmount.json`.
- **[session 21, live]** The endpoint is now a proper `client.ts` method
  (`claimRomEnergy`, promoted from `probeRomsFactoryClaim.ts`'s raw-fetch
  probe now that it's confirmed) with a real response schema
  (`RomClaimResponseSchema`, `src/api/schemas.ts`). `scripts/claimRoms.ts`
  claims all 4 known ROM ids in one pass, opportunistically (no batching
  logic needed — overflow past the 420 cap is confirmed non-wasting, user,
  session 21). Result: **5345 and 689 both HTTP 500** (claimed the session
  before, nothing new accrued yet — confirms the per-ROM-accrual model, not
  a broken ROM), **2097 +8 energy, 7959 +5 energy — 7959's first-ever
  successful claim** after two straight failures in session 19. Net +13
  energy from the 4 known ROMs this session.

- **[session 22] Source endpoint for the ROM-list snapshot: CONFIRMED, item
  1 below RESOLVED.** The user supplied the ROMULATOR panel's own request
  URL directly: `GET /roms/player?id=<wallet address>` (CLAUDE.md §2 — a
  user-supplied URL is not a guess). `scripts/probeRomsPlayer.ts` (new,
  read-only) hit it live: **HTTP 200, `{entities: [...37 entries]}`**. Each
  entry's `docId` is the same id `factory-claim` takes as `romId` —
  cross-checked live: all 4 previously-known ids (`7959`, `2097`, `5345`,
  `689`) appear verbatim as `docId` values in this list, and all 4 now read
  `energyCollectable: 0` (all claimed session 21, nothing new accrued
  since). The other 33 previously-unknown ROMs sum to **~3,259
  `energyCollectable`**, matching session 20's ~3,252 hand-pasted snapshot
  almost exactly (small delta is live accrual between snapshots, same
  pattern as the 689/5345 finding above). Full enumeration, descending by
  `energyCollectable`, is in `config/discovered.json`'s new `roms.allRoms`
  (gitignored — real docIds/amounts, regenerated on next probe run) and a
  redacted response sample at `fixtures/probe/roms/
  player-response-redacted.json`. Wire schema: `RomsPlayerResponseSchema`
  (`src/api/schemas.ts`), client method `getRomsPlayer(address)`.
  Top-claimable ROMs this snapshot: two Gold ROMs at 540 each
  (`docId` 2696 "Overseer", 6096 "Chobo"), then a cluster of Gold ROMs at
  315 each — the account's real remaining stockpile is concentrated in a
  small number of high-tier ROMs, not spread evenly across all 37.
- **[session 22] Live-verified against a handful before trusting all 37:**
  see the "ROM enumeration claiming" note below.

**Still open (see QUESTIONS.md and TASKS.md for tracking):**
1. ~~Source endpoint for the ROM-list snapshot~~ **RESOLVED [session 22]** —
   see above.
2. **Accrual RATE per ROM (energy/hour, not just current snapshot value)**
   — the `percentageOfAWeekSinceLastEnergyClaim` field suggests each ROM
   fills to its own `maxEnergy` over roughly a week, tier/boost-dependent,
   but this hasn't been confirmed by an independent second reading spaced
   in time. Matters for scheduling claims (how often is it worth
   re-checking the snapshot) more than for sizing the one-time stockpile,
   which is now known precisely per-ROM via `getRomsPlayer` rather than
   estimated from one hand-pasted total.
3. **Batching strategy against the 420 energy cap — REFINED [session 22,
   live].** Session 21's "non-wasting" finding is CONFIRMED, and now
   verified at the ROM-list level too: `scripts/claimAllRoms.ts --limit=5`
   claimed ROM `2696` (540 collectable) from an account starting at 88
   energy — credited exactly 332 (88+332=420, the real cap), and a
   re-probe of `2696` afterward shows `energyCollectable: 208`
   (540−332=208, the untaken remainder correctly still banked, not lost).
   The next 4 claims in the same pass (`6096`, `4586`, `2768`, `4543`, all
   with the account already at 420) each returned `{"success":true}` but
   **delta 0** — and a re-probe confirms their `energyCollectable` is
   **completely unchanged** (still 540/315/315/315). So a claim while
   already at the cap is a genuine no-op: not wasteful, but also not
   productive. **Consequence, corrected from the session-21 framing**:
   no batching logic is needed for CORRECTNESS (nothing is ever lost by
   claiming in any order at any account energy level), but claiming
   everything in one pass while near the cap wastes rate-limited request
   time on 0-delta no-ops for no benefit — the productive move is to claim
   opportunistically as energy gets spent down by normal dungeon/fishing
   play, not to force a full 33-ROM pass in one sitting while capped.

### ROM enumeration claiming **[session 22]**

`scripts/claimAllRoms.ts` (new, supersedes the hardcoded-4-id
`scripts/claimRoms.ts` for full-account claiming — `claimRoms.ts` is kept
as-is, not deleted, since it's still a valid narrower tool) reads the full
37-ROM list via `getRomsPlayer`, filters to `energyCollectable > 0`, sorts
descending, and claims in that order — same "no batching logic needed"
reasoning as `claimRoms.ts` (SPEC.md above, session 21 overflow finding),
just applied to the real full list instead of 4 hardcoded ids.

**Live-verified against the top 5 of the ranked list before assuming the
pattern holds across all 37** (`--limit=5`): all 5 returned
`{"success":true}`, one credited real energy (332, capped by the account's
420 ceiling), four were correct 0-delta no-ops because the account was
already at cap — re-probed and confirmed non-wasting on all 5, not just the
one that moved the energy counter. See the batching-strategy note above for
the full detail and STATE.md session 22 for the run transcript.

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

### 3a. Finding the fishing API — RESOLVED 2026-08-15, session 11 **[CONFIRMED]**

The HAR was captured and parsed. Full endpoint map, request/response
schemas, and the confirmed-vs-inferred breakdown live in **`SPEC-fishing.md`**
— that file is now the source of truth for the fishing wire surface,
generated by `scripts/parseHar.ts` from `fixtures/fishing-casts/fishing-cast.har`
(gitignored) rather than transcribed by hand, per the original ask below.

It is REST, not websocket, one write endpoint (`POST /api/fishing/action`),
same action-token discipline as the dungeon side. The original discovery
brief is kept below for the record; do not re-run it — a HAR already exists.

<details>
<summary>Original discovery brief (superseded)</summary>

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

</details>

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
(`inputItems: []`, `dropMultiplier: 1`); tier 2 requires one Silver Ring per
faction (items 134–140: Chobo/Crusader/Overseer/Athena/Archon/Foxglove/
Summoner Silver Ring, `dropMultiplier: 2`); tier 3 requires one Golden Ring
per faction (items 243–249, same seven factions, `dropMultiplier: 4`) — item
names confirmed against `GET /offchain/static`'s `gameItems[]`, session 42.
This is the user's own "Tier 1/2/3, silver/gold rings" terminology. Both
gated tiers carry `inputsBasedOnFactionDay: true`, so **the required item
list is not static** — re-read it per day, never cache it.

`entryData` is ordered tier 2, 1, 3 in the array as returned. **Array index
is not tier** — match `entryData[].tier` explicitly when reading this
endpoint's response.

**[CONFIRMED 2026-08-18, session 42, LIVE] `start_run`'s `data.index` field
IS this `entryData` tier — a separate axis from `isJuiced`, not a
juiced-specific value.** Two independent user captures: a Tier-3 (gold
rings) juiced start sent `index: 3`; a Tier-2 (silver rings) juiced start
sent `index: 2`. Both are juiced (`isJuiced: true`, 3x energy/reward) at
DIFFERENT entry tiers, proving `index` selects the entry tier independently
of juiced status — TASKS.md Task 14's original "index == tier, not yet
confirmed" question is settled.

**[CONFIRMED 2026-08-18, session 42, user-stated] `dropMultiplier` and the
juiced 3x do NOT stack on the same item — they govern separate reward
channels.** `dropMultiplier` (this tier system) affects Hard Core (item
845) only; the juiced 3x affects Dendren Root (item 846) only. See §3f.

**"Juice"/"juiced" is three unrelated game concepts sharing one word —
user-clarified [2026-08-17, session 23], after this ambiguity caused a real
live incident (see DECISIONS.md). Do not conflate them:**

1. **`isPlayerJuiced`** (`GET /offchain/player/energy`'s own field) is an
   **account-level purchasable buff** — increased energy, increased ROM
   output, 4x Hard Cores earned across dungeons AND fishing. Nothing to do
   with a specific dungeon run's mode. This account currently reads
   `isPlayerJuiced: true`.
2. **"Juice" as an item name** — Big Heal Juice, Mid Heal Juice, etc. —
   ordinary consumable potions, unrelated to either of the other two senses.
3. **A "Juiced" Forbidden Woods *run mode*** — the one this section is
   about. Confirmed mechanics, user-stated:
   - Costs **60 energy** (3x the normal 20) and consumes **3 of the 12
     daily run-count units**, not 1 — confirmed against the real
     `dayProgressEntities` counter this session (3 → 6 after the user
     started one).
   - Requires clearing **only 1 room's worth of fights**, same as a normal
     run — NOT 3 full runs' worth of combat.
   - Every room's reward is **3x** a normal run's (room 1's 5 Dendren Root
     → 15 juiced) — this is the real multiplier the user live-confirmed;
     `juicedMultiplier: 1` in `config/discovered.json`'s dungeon-entity
     container does NOT represent this and should not be read as the reward
     multiplier for anything.
   - Economic rationale (user's own framing): 3 Big Heal Juice spent across
     one juiced run buys the reward yield of 3 normal runs, vs. needing 9
     Big Heal Juice (3/run × 3 runs) to match it via ordinary runs.

**Real gap, checked directly rather than assumed: `start_run`'s captured
envelope has never once carried a `tier` field or sent `isJuiced: true`** —
the bot has no confirmed request shape for starting a juiced run itself.
Current workaround: the user starts the run manually in-browser (juiced
toggle, Tier 3) and the bot resumes via the standard live-loop resume path,
which costs no extra energy/run-slot and doesn't care how a run was started.
**Building a bot-initiated juiced `start_run` (TASKS.md Task 14) is blocked
on a live DevTools capture of that real request body** — CLAUDE.md §2
forbids guessing at it, and guessing here specifically is what already
caused a real incident this session (see DECISIONS.md 2026-08-17).

**The "dungeon sack" — user directive [2026-08-17, session 23]: left EMPTY
going forward.** Whatever potions are loaded into it persist across dungeon
entries and get committed at `start_run` regardless of the request's own
`consumables` field (session 23's incident). Rather than relying on the sack
being in a known state, the user will keep it empty; potion loading is the
bot's job via its own `consumables` field on a genuinely NEW `start_run`,
which already works correctly (confirmed this session: a fresh start with
`consumables: []` left Big Heal Juice balance unchanged, 70 → 70). The next
piece — equipping potions ONLY when entering a juiced run specifically — is
scoped in TASKS.md Task 14, blocked on the same capture gap above.

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

**[2026-08-15, session 09, LIVE] Tier 0 ("Safe") is not guaranteed to be
offered.** A third room-2 sample (live, this session) had three options,
tiers `{2, 1, 1}` — two DIFFERENT tier-1 ("Risky") variants, different
`enemyBuff`s (`Stalwart`, applies Weak on Shield wins; `hardy`, +3 max HP/+2
armor), plus one tier-2 (`bloodguard`, heals 4 HP on Shield wins) — no tier 0
at all. The loot table was still identical across all three (`LT_D5_Room_2`,
same item/weight/amount), so the rule above is **generalized rather than
reversed**: always take the *lowest tier actually offered*, which usually is
but is not always Safe. `src/strategy/enemyTier.ts`'s `pickLowestTier()`
implements this; `pickSafeTier()` (the old strict "must be tier 0" assertion)
is kept for a caller that wants it, but the live loop no longer uses it by
default. User-confirmed live: this is expected game behavior, not a capture
gap or a bug in the halt that caught it.

**[2026-08-15, session 09, LIVE] `rewardPathOptions[]` can also carry
`tier`/`tierName`.** Observed once, immediately following the non-Safe pick
above: all three of that room's reward options were tagged `"tier": 1,
"tierName": "Risky"` — a field never seen on this array when the preceding
enemy-tier pick was Safe. Logged in `src/sim/boons.ts`'s `OBSERVED_OFFERS`
comment; not modelled or acted on (`wireBoonToOption` still reads only
`boonTypeString`/`selectedVal1`/`selectedVal2`, per the DECISIONS
2026-08-15 rule against acting on anything short of a pickup pair). One
sample — whether reward pools actually differ by risk tier, or this is
cosmetic labeling, is unknown.

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

### 3f. Reward item crediting — **[CONFIRMED 2026-08-18, session 30]**

Both currency and loot items are credited via a top-level `gameItemBalanceChanges`
array on the response — **not** nested under `data`, and not a separate
endpoint. `[{id, amount, rarity, gearInstanceId}]`, one entry per item changed
that response. Two concrete instances, `fixtures/dungeon-runs/
run-2026-08-15-15-38-09/state-{054,079,110}.json`:

- **Hard Core** (the leaderboard-scored currency, item **845**) is credited on
  a `"Reward chosen"` response — `state-054`: `[{"id": 845, "amount": 56, ...}]`.
  Confirms the session-08 `gigusOrbItemId`/`gigusOrbAmount` hypothesis
  directly.
- The user's **"Dendren Root"** is wire item **846**, static-item `NAME_CID`
  **"Dendren Remnant"** (`GET /offchain/static`'s `gameItems[]`, `docId
  "846"`) — credited on a `"Move Used"` response landing a kill:
  `state-110`: `[{"id": 846, "amount": 5, ...}]`. The naming mismatch (the
  user's term vs. the wire `NAME_CID`) is real; it is documented here rather
  than silently reconciled to one or the other.

`src/sim/dungeonReport.ts` reads this field for its run-visibility report
(`scripts/dungeonReport.ts`); see its own header comment for the extraction.

**[CONFIRMED 2026-08-18, session 42, LIVE — juiced runs specifically] The 3x
juiced reward multiplier is implemented as THREE DUPLICATE credit entries of
the BASE amount, not one entry with a tripled amount.** On a juiced run's
kill-crediting response, `gameItemBalanceChanges` carried
`[{id:846,amount:5,...},{id:846,amount:5,...},{id:846,amount:5,...}]` — base
amount 5 (matching the user's own "5 Dendren Root" reference point,
DECISIONS 2026-08-17 session 23), credited three separate times rather than
one `amount: 15` entry. Held at every kill in the same run (9→27, 14→42,
19→57, 25→75, 31→93 — always three identical entries summing to 3x base).
Currency credits (item 845, Hard Core) on that same run's reward-pick
responses were single (non-tripled) entries. A caller that reads
`gameItemBalanceChanges` and sums by item id (as `dungeonReport.ts` does)
gets the correct 3x total either way; a caller that reads only the first
matching entry would silently undercount a juiced run by 2/3.

**[CONFIRMED 2026-08-18, session 42, user-stated] The two multipliers govern
DIFFERENT reward channels — they do not stack on the same item.** `isJuiced`
(the 3x, implemented above as triplicated entries) affects Dendren Root
(item 846) only. `entryData`'s per-tier `dropMultiplier` (§3c — 1/2/4 for
Tier 1/2/3, gated on rings) affects Hard Core (item 845) only. This resolves
the apparent puzzle in this session's own two-run comparison (Tier-2 vs
Tier-3 juiced runs showing IDENTICAL base Dendren Root progressions despite
different `dropMultiplier`s) — the two runs' Hard Core amounts differ
because of `dropMultiplier`, not despite it; Dendren Root doesn't respond to
`dropMultiplier` at all, only to `isJuiced`.

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

**Win terminal is not flat — a win with more HP/armor left scores higher than
a bare one [2026-08-16, session 10].** "Enemy dead → +1000" above is what
Task 5 built, and it has a real gap: among several move sequences that all
lead to a win within the search horizon, a flat +1000 makes the engine
indifferent between finishing at full HP and finishing one hit from death — it
scores THIS battle as if it were the last one, pricing the option value of
carried-over HP at zero. `src/strategy/utility.ts` now returns
`winValue + base` at a win, where `base` is the same continuous HP/armor term
the non-terminal case already computes (the enemy-side terms in it are always
zero at a win, since the combat model fully depletes armor before HP drops, so
a dead foe has 0 armor too) — the margin composes with the ongoing evaluation
rather than being a separate constant, and still can't override the ±1000
win/death gap. Death is deliberately NOT given the same margin: a death ends
the run regardless of leftover HP/armor, so there is nothing left to price.

**Tested and found to have no measurable effect on `meanRoomsCleared` or
room-1 win rate, even with the weight sweep amplified 10×** — see TASKS.md
Task 11's session-10 outcome for the numbers. Kept anyway (it fixes a real
inconsistency and is validated harmless), but it is not the fix for
attrition — the evidence points at single-battle lethality escalating with
room depth as the binding constraint at the corpus's observable depth, not
cross-room HP mismanagement that a margin term could price.

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

1. **Heal, but only when it is not mostly wasted.** **[UPDATED 2026-08-18,
   session 43, user directive]** Take Heal only if `hpCurrent < hpMax` AND
   the wasted overflow is ≤15% of the heal's own value:
   ```
   deficit = hpMax - hpCurrent
   wasted = max(0, healAmount - deficit)
   takeHeal = (hpCurrent < hpMax) && (wasted <= 0.15 * healAmount)
   ```
   A Heal that fails this gate scores 0 and falls through to the
   next-ranked boon (rule 2, then 3, then 4) — the old framing ("worth more
   than any stat upgrade, passing one up is choosing to end the run early")
   overstated a heal that would waste most of its value; it stays weighted
   up continuously as HP fraction falls (not a step at 0.5, session 10)
   *among heals that clear the gate*. **[CONFIRMED 2026-08-13]** this card
   is still the *only* way HP is ever restored — there is no in-combat
   healing — so the gate is about waste, not about whether healing matters.
   `src/strategy/loot.ts`'s `heal` case implements this; see
   `HEAL_OVERFLOW_GATE`.
2. **Upgrade the move you actually play most** (read it off your own logged move
   distribution, not off a guess about what's theoretically strongest) —
   **EXCEPT `UpgradeRock` (Sword), which wins whenever it's offered.**
   **[ADDED 2026-08-18, session 43, user directive]** The user's build is
   Sword-focused; this is a hard pin (`src/strategy/loot.ts`'s
   `SWORD_PIN_BONUS`), not a bigger score that a large-magnitude pool offer
   could still outscore. The play-share read above is the fallback for
   every OTHER move's upgrade (e.g. if a future build changes away from
   Sword) — `UpgradeScissor` vs `UpgradePaper` still rank by play-share,
   unaffected.
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

**[CORRECTED 2026-08-15, session 11]** This section originally said "3×3
grid" as a guess. A real Dendren capture (`SPEC-fishing.md`) shows **Dendren
is a 4×4 grid with the bobber/focus mechanic ENABLED** — card hitboxes are
relative to a movable `focusPoint`, not absolute grid cells. The simpler 3×3,
focus-disabled ponds this paragraph originally described may still exist (the
capture's own `pondEntryTiers` data hints at more than one pond), but they
are not this bot's target and were never captured. Do not build a
fixed-absolute-hitbox model for Dendren — see `SPEC-fishing.md §4`.

Fish occupies one cell. On each turn you submit one card and a **focus
point** (Dendren only — see the correction below); the server then moves the
fish per its own deterministic pattern and checks the fish's **new** cell
against the card's hitbox, translated to be centred on the focus point you
submitted.

**[session 45] The movement rule is now largely characterised — see
`SPEC-fishing.md §9`, which supersedes this section's "its own deterministic
pattern" as the description of what the fish actually does.** In one line: the
fish walks a Manhattan-`k` ring around its current cell with `k ∈ {1,2}` fixed
for the whole cast (0 counterexamples in 279 clean transitions), and within a
class the next move is strongly conditioned on the previous one in OPPOSITE
directions (`k=1` never reverses, 0/109; `k=2` reverses 39.2% of the time,
40/102). Both facts are exploitable and neither was visible to any predictor
this project shipped before session 45. That section also carries the
leave-one-cast-out evidence, the live-wiring tier order, and an explicit list
of what is NOT claimed. Cards have a mana cost, a hitbox, and a flat hit/miss effect on
the catch meter (`fishHp`).

**[CORRECTED 2026-08-15, session 12]** This paragraph previously said "Hit →
catch meter rises. Miss → catch meter falls. Fill the meter to catch. Run
out of mana, or let the meter hit zero, and the fish escapes" — backwards on
every count, refuted by replaying the real captured cast turn-by-turn
against its own wire values:

- **A hit decreases `fishHp` toward 0** (`fishHp -= hitEffects[0].amount`,
  amount positive) — reaching 0 is the catch condition (never observed in
  this one-cast corpus, inferred from the meter's own trajectory and
  `SPEC-fishing.md §4`'s field description, which had this right even
  though this section didn't).
- **A miss increases `fishHp` toward `fishMaxHp`**
  (`fishHp -= missEffects[0].amount`, amount negative, so the subtraction
  adds) — reaching `fishMaxHp` is the escape condition, **[CONFIRMED]**
  directly: the real cast's `FISH_ESCAPED` fires exactly the turn `fishHp`
  reaches `fishMaxHp` (20/20), with `playerHp` (mana) still at 5/10, not 0.
  Running out of mana may be a *separate* escape trigger — never observed,
  since this cast escaped by meter first — but "let the meter hit zero" was
  simply wrong; zero is the goal, not the failure.

`playerHp` on the wire is the mana pool, not health — **[CONFIRMED]**,
`SPEC-fishing.md §4`.

**Hitbox geometry, [CONFIRMED 2026-08-15, session 12 — TABLE CORRECTED
2026-08-19, session 47]**: zones are numbered 1–9 in a fixed 3×3 template,
row-major, centred on the submitted `focusPoint`, absolute cell =
`focusPoint + offset`, clipped to the grid (an off-grid translated zone is
simply unreachable that turn, which matters near edges).

The correct table, in `(position[0], position[1])` order:

```
1=(-1,-1) 2=(-1, 0) 3=(-1, 1)
4=( 0,-1) 5=( 0, 0) 6=( 0, 1)
7=( 1,-1) 8=( 1, 0) 9=( 1, 1)
```

i.e. `offset(z) = (floor((z-1)/3) - 1, (z-1) % 3 - 1)`.

**Session 12's table was the TRANSPOSE of this, and it shipped for eleven
sessions.** It was derived by replaying the one real cast's single genuine
hit — turn 3, card id 79, `hitZones [2,4,6,8]`, `focusPoint [3,3]`, fish at
`[3,4]`. That card's zone set is **transpose-symmetric**, so it could not
possibly have discriminated the two tables, and nothing checked the table
again as the corpus grew.

Two independent lines of evidence settle it, both session 47:

  - **282/282 vs 228/282.** `scripts/auditZoneTemplate.ts` scores a template
    against every recorded play: given the focus actually submitted, the card
    actually played, and the cell the fish actually occupied, did it predict
    the server's own hit/miss? The corrected table is exceptionless; session
    12's gets 54 plays wrong.
  - **`position[0]` is the ROW.** `doc.data.lastMovePath` carries 1-based cell
    indices, and `index === (position[0] - 1) * gridSize + position[1]` holds
    **289/289** across the corpus — row-major over `position`, which only works
    if `position[0]` indexes the row. (`lastMovePath[0]` decodes cleanly as the
    k=2 move's waypoint, a third consistency check.) The zone template is
    numbered row-major too, so zone 2 is (row − 1, col), not (row, col − 1).

**The defect was live-only, which is why it hid so long.** The sim applies
this table on BOTH sides — to place the policy's focus and to resolve the shot
— so it stayed internally consistent and its numbers never flinched. The live
server resolves with the true map while the policy aimed with the transposed
one. Off-policy replay prices it: per-turn hit rate 42.8% under the old
geometry vs 50.9% corrected, same predictor and same trajectories.

The **submitted `focusPoint`
applies to the fish's position AFTER that turn's move**, not before — you
are placing a bet on where the fish will land, not where it already is. This
is the mechanical fact `SPEC.md`'s hypothesis-elimination section already
assumed; now it's load-bearing and confirmed, not just assumed.

You may **redraw** your hand instead of casting, at 1 mana per card still
held — **[VERIFY]**, never captured; see `SPEC-fishing.md §0`. Separately
**[CONFIRMED]**: the hand refills to its starting size automatically the
moment it hits zero cards — not every turn, and not tied to hit/miss (the real
cast's `NEW_HAND` event fired the turn the hand was played down to empty, turn
3, immediately after that turn's card resolved). Confirmed corpus-wide in
session 47: 282/282 plays remove exactly one card by hand index, and 61/61
refills restore exactly 3.

**[CORRECTED 2026-08-19, session 47] The refill is NOT "drawn from `fullDeck`
via `nextCardIndex`".** That was asserted here without being checked, and it
is false: across the corpus **0 of 56 refills and 1 of 69 opening hands** match
the corresponding slice of `fullDeck`. `fullDeck` is a canonical, sorted deck
list; `nextCardIndex` counts how many cards have been drawn (and reconciles
exactly with `cardInDrawPile`), but the ORDER comes from a server-side shuffle
that never appears on the wire. There is no way to predict the next draw.

This matters for anything counterfactual: the draw order cannot be
reconstructed, so a replayed policy cannot be given "the cards it would have
drawn" in general. What CAN be reconstructed is the block structure — one card
per turn means the hand empties on the same turn whatever the policy picks, so
the recorded `NEW_HAND` is the right refill and only the ORDER within each
3-card block is free. See `src/sim/fishing/castTrace.ts`'s `newHand`.

Cast tiers cost energy: Small 12, Normal 16, Big 20. Daily cap 10 casts (20 if
juiced). **[INFERRED, corroborated by capture]** — `SPEC-fishing.md §3`
independently derived the same three energy figures and the same daily caps
from `GET /fishing/state`'s `node0/1/2Energy`/`maxPerDay(Juiced)` fields; only
tier 1 (12 energy) was actually entered, so tiers 2/3 stay unconfirmed by a
real POST. Rods grant a starting spell set. Every successful catch adds a
spell to your deck for that day.

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

**[RE-DERIVED 2026-08-15, session 12]** The formula below was originally
written for fixed hitboxes over absolute cells — wrong the moment
`SPEC-fishing.md` corrected Dendren to a 4×4 grid with the focus mechanic
enabled (session 11). With a movable focus, the action space is a **(card,
focus point) pair**, not a card alone: the same hitbox template scores
differently depending on where you centre it, so EV must be maximized over
focus placement too, not just over the card.

For each affordable card and each focus point `f` the grid allows:

```
hitSet(card, f) = { f + offset(z) : z ∈ card.hitZones, f + offset(z) ∈ grid }
critSet(card, f) = { f + offset(z) : z ∈ card.critZones, f + offset(z) ∈ grid }

P_hit(card, f)  = Σ_{c ∈ hitSet(card,f)}  P(next = c)
P_crit(card, f) = Σ_{c ∈ critSet(card,f)} P(next = c)   (only where crit adds value — see below)

EV(card, f) = P_crit · critEffect + (P_hit − P_crit) · hitEffect
            − missPenalty · (1 − P_hit)
```

where `hitEffect`/`critEffect` are each card's flat `hitEffects[0].amount` /
`critEffects[0].amount` (**[CONFIRMED]** real cards carry a single flat
amount, not a per-cell table — `fixtures/fishing-casts/cards.json`), and a
cell counted in `critSet` is excluded from the plain-hit term so it isn't
double-counted. `offset(z)` is the 1–9 zone template above. A handful of
cards (e.g. id 10/77/78) have `hitZones: []` and only a `critZones: [5]` —
for these, `P_hit` collapses to `P_crit` and the plain-hit term is zero,
which the formula already handles without a special case.

**[RE-DERIVED 2026-08-15, session 13]** The line above originally read "pick
`argmax EV(card, f) / card.manaCost` — mana is the real budget." **That's
backwards, and it cost real performance.** The one real capture escaped at
`fishHp == fishMaxHp` with mana still at 5/10 — the cast ended because the
MISS counter (the catch meter rising toward its cap) hit its ceiling first,
not because mana ran out. Mana was never the binding constraint in the one
data point available. Dividing EV by mana cost optimises against a
constraint that mostly isn't binding, and does it systematically: it prefers
cheap low-probability cards over expensive reliable ones, exactly backwards
when every miss is a step toward the escape condition.

Corrected: pick **argmax `P_anyHit(card, f)`** (`= P_hit(card,f) +
P_crit(card,f)`, both as defined above) over both card and focus placement —
**maximise hit probability, not EV/mana** — with `EV(card, f)` (raw, not
divided by mana) as the tie-break between two placements that land the same
hit probability. Mana is a **feasibility filter** (can this card be afforded
at all this turn?), not a denominator in the objective.

Mana-awareness returns only as a **late-cast correction**: when the mana on
hand genuinely can't cover finishing the fish even under optimistic
best-case play (`src/strategy/fishing/cardChoice.ts`'s `isManaConstrained` —
a lower bound: turns-needed = `⌈fishHp / bestHitEffectInHand⌉`, mana-needed
= `turnsNeeded × cheapestAffordableManaCost`), the objective falls back to
`argmax EV(card, f) / card.manaCost` for that turn. This is a correction
that fires rarely, not a blend that fires always — the ratio-as-denominator
form is retired as the *primary* objective, not deleted.

**Consequence for `shouldRedraw` — a bug this uncovered, not just a
rename.** `shouldRedraw`'s implementation compared `best.evPerMana` against
`redrawThreshold`, while this SPEC section (below) always specified raw
`ev`. That divergence was silent while `chooseCard`'s own primary objective
was also EV/mana — the two scales happened to agree often enough not to
matter. The moment `chooseCard` stopped optimising EV/mana, `evPerMana` on
the chosen card became a poor proxy for "is this hand worth keeping," and
the mismatch surfaced immediately in the 500-cast sim: redraw fired on
nearly every turn, burning `hand.length` mana per re-roll before a card was
ever played, and catch rate barely moved off the old (wrong) baseline.
Fixed by reading `best.ev` (matching this section, always), and
`REDRAW_THRESHOLD` re-tuned from `3` to `0` in the sim — see
`src/sim/fishing/castSim.ts`'s own comment for the sweep. **Net effect of
both fixes together: 500-synthetic-cast catch rate moved from 19.0%
(95/500) to 92.4% (462/500)**, against an unchanged 7.8% random baseline —
confirming the divisor (and the redraw-threshold bug it exposed) was
costing the large majority of the matcher's real edge, not a marginal
amount.

**[RE-DERIVED 2026-08-16, session 15]** Session 13's `argmax P_hit` fix
above was itself an overcorrection, not just a fix. The real bug was
dividing EV by `manaCost` — that part of the session-13 diagnosis holds.
But switching the objective away from EV *entirely*, to plain hit
probability, went further than the bug required: it discards `P_crit`
either as-is or with it built in fine, but it discards **both cards' own
damage and miss-penalty amounts** in the process. Cards genuinely differ on
both — a live hand this session showed a 2-damage card, two 5-damage cards,
and a card with a printed miss penalty of 3, all real per-card fields
(`hitEffects[0].amount`/`missEffects[0].amount`). `argmax P_hit` is
indifferent between the 2-damage and 5-damage card at equal hit chance, and
will pick a marginally safer card over one worth 2.5× the progress — an
error in the opposite direction from session 13's, but still an error.

Corrected back to **argmax raw `EV(card, f)`** (no mana divisor — that part
of session 13's fix stays) as the *primary* objective, i.e. expected net
progress in `fishHp` units:

```
EV(card, focus) = P_hit(card,f)·hitEffect + P_crit(card,f)·critEffect
                 − missPenalty·(1 − P_hit(card,f) − P_crit(card,f))
```

This is exactly the `ev` `evaluateCardAtFocus` already computed all along
(session 12's original formula, unchanged) — the fix is entirely in
`bestFocusForCard`/`chooseCard`'s SELECTION step, which stopped sorting by
it in session 13. Both cards' own real damage and miss-penalty numbers were
never thrown away by the formula, only by what was compared. `isManaConstrained`
and its late-cast `EV/mana` fallback are unchanged — mana stays a
feasibility filter, escalating to a denominator only when it's genuinely
about to bind. `src/strategy/fishing/cardChoice.ts`'s `bestFocusForCard`/
`chooseCard` updated accordingly; see `scripts/fishFocusMeter.ts`'s re-run
for the sim-rate consequence in both library-known and blind
(`matcherPool: []`) configurations.

**Re-run result [2026-08-16, session 15]:** library-known 72.8% (364/500) /
70.0% (2099/3000, independent seed) — barely moved from session 14's
71.6%/69.9% (`P_hit`-argmax). Library-blind 6.6% (33/500) / 10.4%
(311/3000) — also barely moved from 7.0%/10.3%. **The objective correction
is real (SPEC §5's derivation, not just the sim number) but doesn't show up
much in this aggregate**, because on most turns the top-`P_hit` card and the
top-EV card already coincide — the two objectives only diverge on the turns
where cards differ in both hit chance AND damage/penalty at once, which
apparently isn't most turns in this synthetic corpus. The fix is kept
because it is the theoretically correct objective per §1's derivation
(indifference between a 2-damage and 5-damage card at equal `P_hit` is a
real defect regardless of how often it bites in aggregate), not because the
sim moved.

Two overrides, unchanged in spirit from the original design:

- **Lethal check first.** If some `(card, f)` can drive `fishHp` to ≤ 0 this
  turn with certainty (or with the only nonzero-probability outcomes all
  lethal), play it and ignore efficiency entirely.
- **Uncertainty shapes the choice.** When `|H|` is large, prefer the `f` that
  maximizes `P_hit` over the *union* of live hypotheses' next-cell
  predictions — i.e. hedge by covering the spread, not by picking a wide
  hitbox in the abstract (a wide hitbox centred on the wrong focus point
  hedges nothing). When `|H| == 1`, centre `f` so the single predicted cell
  falls in `critSet` if any affordable card offers one there, else `hitSet`,
  and maximize damage. Early turns are for identifying the pattern; later
  turns are for cashing it in.

**Whether "early turns identify, late turns cash in" is even the right
policy shape depends on convergence speed vs. cast length — see the
measurement note below before assuming it.**

**Redraw** when `max EV < redrawThreshold` and mana comfortably exceeds the
redraw cost. Tune the threshold in the sim, not live.

**A third constraint on `f`, discovered live and not in the original
design: `focusMeter`.** **[CONFIRMED 2026-08-15, session 13, live]** moving
the focus costs its Manhattan distance from the CURRENT focus, out of a
3-point per-cast budget that does not regenerate — four clean data points
from this project's first live cast, the last one a server-side HTTP 400
rejection of a move it couldn't afford (see SPEC-fishing.md §4 for the
figures). The argmax over `f` above is therefore over **reachable** `f`
only (`src/sim/fishing/geometry.ts`'s `reachableCells`), not the whole
grid — `cardChoice.ts`'s `chooseCard`/`bestFocusForCard` take an optional
`FocusBudget` for this, threaded through by the live loop
(`scripts/liveFishing.ts`).

**[MODELLED 2026-08-15, session 14]** `focusMeter` is now modelled in the
sim too (`src/sim/fishing/castSim.ts` tracks a `FOCUS_METER_MAX = 3` budget
per cast, never regenerating, starting at the grid's center cell per the
one live cast's observed `[2,2]` starting `focusPoint` — see
`defaultStartFocus`). This was the session-14 brief's central question:
does `focusMeter` explain why the sim's 92.4% (500-cast, session 13) and
live's 0/6 casts disagreed so badly? **Answer: only partly.** Modelling it
alone drops the 500-cast catch rate to **69.9–71.6%** (two independent runs,
n=500 and n=3000) — real and substantial (P(0 catches in 6 live casts) at
that rate is ~0.05%, still statistically incompatible with the live
result), but nowhere near a full explanation.

**The dominant explanation turns out to be a different, larger gap: the
sim's true fish pattern is always drawn from the SAME synthetic pool the
matcher searches**, so the matcher can, in principle, always identify it —
unlike real Dendren, where the pattern library is still unknown (only one
5-move human capture and five live bot casts exist, all of which ran the
matcher on `emptyFallback`/uniform the entire session, per STATE.md
session 13, because none of them ever matched a candidate in the synthetic
stand-in library). `castSim.ts` gained a `matcherPool` option (separate
from `candidatePool`, which still controls what the TRUE pattern is drawn
from) specifically to make this condition reproducible: `matcherPool: []`
forces the matcher permanently blind. Result: catch rate collapses to
**~7–10%** (two independent runs) — statistically indistinguishable from
the random baseline (8.4%) and fully consistent with the live 0/6 result
(P(0/6) ≈ 55–65%). See `scripts/fishFocusMeter.ts` for the full comparison
and `tests/fishing/castSim.test.ts`'s "session 14" describe block for the
regression tests pinning both findings.

**Consequence for the "hedge throughout" policy shape below and for
Task 11:** the honest current expectation for live Dendren performance
under today's algorithm is close to random (~7–10%), not 92.4% or even
71.6% — because the algorithm has nothing to identify against yet. This
reframes `scripts/mineFishPatterns.ts` (Task 11) from "nice to have, mine
more data when there's time" to **the actual blocker**: until a real
pattern library exists (mined from `data/fish-patterns.jsonl`), the
hypothesis-elimination matcher cannot outperform random by more than
`focusMeter`'s own contribution, and the "hedge throughout" vs. "identify
then cash in" tradeoff below is moot — there is currently nothing to
identify. The `FocusBudget`-aware code itself needs no further rewrite:
`bestFocusForCard`'s search over `reachableCells` already degrades
correctly as the budget depletes (a near-exhausted budget naturally
narrows the search to the current focus, which is what a "commitment"
policy would do by hand) — the gap was never in this formula, it was in
the library the formula searches.

### Open question this design doesn't answer yet: does identification ever finish?

The one real capture escaped after 5 plays with `|H|` never computed (no
matcher existed yet). Whether hypothesis-elimination is even the right frame
for Dendren specifically — as opposed to a permanent hedge — depends on how
many turns convergence needs relative to how many turns a cast affords. That
ratio is measured, not assumed, in `scripts/fishConvergence.ts`
(session 12), against a synthetic stand-in pattern library (the real
pattern set is still unknown — only one 5-move cast exists, nowhere near
enough to fit one), swept over plausible library sizes (4/8/16/23
patterns, 400 trials each): the result is **bimodal**, not "usually a bit
slow" — when convergence happens it's fast (median 1–2 turns, well inside a
cast's affordance), but a share of trials **never** converge at all (18% at
the smallest pool swept, up to 58% at the largest), because some
stand-in patterns are permanently indistinguishable from each other for
certain start cells. Separately, replaying the real captured cast's actual
5-move sequence against the full synthetic pool hits `|H| == 0` at turn 4 —
expected, since the real pattern almost certainly isn't in this stand-in
set, but it's a second independent data point for the same conclusion:
the policy has to be sound when identification never completes, not only
when it does. Treat "identify then exploit" as a *bonus* the policy exploits
opportunistically when `|H|` does collapse, and "hedge throughout" (maximize
`P_hit` over the live spread every turn, never assuming eventual certainty)
as the default policy shape until real transition logs (Task 9) show
otherwise. See the script's own output for the current numbers — do not
hardcode a turn-count threshold into the
policy from this synthetic measurement alone.

**[session 14]** The six real casts to date (1 human + 5 bot) never
identified anything — `|H|` never collapsed even once, because the
synthetic stand-in library this section's own measurement used doesn't
contain the real pattern(s). This isn't a new finding so much as this
open question's own worst case turning out to be the live one: "hedge
throughout" isn't just the safe default until real patterns are known, it
is currently the ONLY policy in effect, live, right now. Task 11's
`mineFishPatterns.ts` (still unbuilt — `data/fish-patterns.jsonl` has 25
transitions from 5 casts, session 13) is what would move this project off
that default for the first time.

**[session 15] `mineFishPatterns.ts` is now BUILT** (`scripts/
mineFishPatterns.ts`) and run against the grown log (39 transitions, 9
casts, after this session's live fishing). It tests every observed cast's
full turn-by-turn trajectory against the existing synthetic primitive pool
(`src/sim/fishing/patterns.ts`) anchored at that cast's own start cell, and
promotes a primitive only once ≥3 independent casts match it exactly (a
smaller bar than the project's usual ~30-observation floor, deliberately —
see the script's own comment for why an exact multi-turn trajectory match is
a different, stronger kind of evidence than a noisy rate). At the time:
**0 primitives promoted, correctly** — not enough real casts yet — but one
genuine near-miss worth flagging: `perimeterWalk(cw)` matches **2 of 9**
real casts exactly, including that session's 5-turn catch cast
(`12925773`: `[3,4]→[2,4]→[1,4]→[1,3]→[1,2]→[1,1]`, walking the bottom edge
then turning up the left edge exactly where the ring turns — not a short,
easily-coincidental match).

**[session 44] STALE — this is no longer the corpus state.** Re-ran
`mineFishPatterns.ts` fresh against the full corpus (169 transitions, 50
casts — matching QUESTIONS.md §14's resolved count) and confirmed **2
primitives ARE now promoted**: `perimeterWalk(cw)` (support=4, casts
`12923267,12925773,12942030,12945319`) and `perimeterWalk(ccw)` (support=3,
casts `12945306,12956727,12957096`) — the same set already sitting on disk
in `data/minedFishPatterns.json` (`castCount: 50`, so not stale/local-only
either). This has been true since around session 18/28 per DECISIONS.md
2026-08-18 (session 29)'s own reference to "session 28's promotions," but
this section of SPEC.md was never updated to say so, leaving it reading
as if the corpus were still library-blind. `scripts/liveFishing.ts`
confirmed live (`runOneCast` → `loadMinedPatterns()`, default path
`data/minedFishPatterns.json`) to actually seed the matcher from this set,
not a stale in-memory default. Fresh sim re-check (N=500, this session):
matcher BLIND 7.0% (35/500) vs. matcher WITH the 2-pattern mined library
22.4% (112/500) — a real, non-trivial lift over blind, though the sim's
own honesty caveat above (session 14's "sim authority is earned per
domain") still applies: this number has not yet been checked against a
live batch played under the same 2-pattern seeding — see
`handoff/STATE.md` (session 44) for that live comparison.

**[session 45] The 22.4% figure above is not a live prediction and should not
be quoted as one.** It was measured against `patterns.ts`'s SYNTHETIC fish at
default deck and default parameters. At the account's REAL deck and real
parameters, the same configuration scores 13.3-13.6% — and against a fish
sampled from the real corpus's own movement statistics
(`src/sim/fishing/empiricalFish.ts`, session 45), with the distribution
pipeline `liveFishing.ts` actually wires, it scores ~24.8%, against a live
all-time rate of 10.1% (7/69). The empirical-fish sim over-predicts live by
roughly 2.4x and is additionally in-sample twice over (its predictor and its
fish are both fitted to the same corpus), so it too has not earned live
authority — see the rule immediately below, which session 45 re-confirmed
rather than retired. The mined library's promotion status is unchanged and the
lift over blind is real; only its magnitude was domain-specific.

Also session 45, checked directly against the seven supporting casts named
above rather than taken from the session-45 brief (which asserted eight, cw 4 /
ccw 4): **`perimeterWalk`'s support is 7 casts — cw 4, ccw 3 — and every one of
the seven is a `k=1` cast**, every hop of every one at Manhattan distance 1.
The mined library is real, but it is a strict subset of ONE step class and can
say nothing at all about the 33 `k=2` casts in the corpus. That is why the ring
model (`SPEC-fishing.md §9`) is the general predictor and the matcher is kept
above it only as a sharper special case, intersected with the ring and floored
against it.

### A standing rule: sim authority is earned per domain, never inherited

**[session 14]** This session set out to explain a 92.4%-sim-vs-0/6-live
gap and found two real, additive causes (`focusMeter`, ~21pp; the
pattern-library mismatch, the other ~60pp) rather than one clean answer —
worth stating as a standing rule because the dungeon side already had the
opposite experience and it would be easy to over-generalize from it.
Session 11's dungeon sim predicted 1.946 mean rooms cleared against a live
2.0 — close enough that trusting the dungeon sim's other conclusions was
reasonable. The fishing sim had no such check before this session, and its
92.4% headline (session 13) had already been used to gate Task 8 in. A
sim's authority to inform a design decision comes from a demonstrated
agreement with live outcomes, and that agreement is **earned separately
per domain** — the dungeon sim being trustworthy said nothing about the
fishing sim, and it wasn't. Until `castSim.ts` predicts live catch rates
(which needs a real pattern library, not just `focusMeter`), no number it
produces should be used to justify a fishing design decision on its own.

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
