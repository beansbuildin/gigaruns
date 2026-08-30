# scratch — session 113 — 2026-08-30

Surprises logged as they happened. Recap draws from here.

## Step 1 — the Tier-2 faction-day model

### The brief's Step 4 premise about "a different faction day" is FALSE for today

`GET /offchain/static` at 23:16 UTC reads `currentDay: 20695`,
`secondsTillNextDay: 67375` (18h38m). **That is the same faction day session
112 ran on.** The brief's 1.5 expected "Foxglove (same calendar day) or a
different faction (if it has rolled over)" — it has not, and cannot before
2026-08-31 18:00 UTC.

**Consequence, and it was knowable before spending anything:** every run
authorized this session must debit Foxglove again, so **this session cannot
pin the rotation order.** Three same-day runs do confirm that the amount is a
stable 3 and exactly one faction moves (n 1 → 4). They cannot produce a second
point on the day→faction map. Fitting an offset to one point would be
manufacturing a result — with one day observed, EVERY candidate formula fits
for exactly one choice of offset.

### The advance faction indicator does not exist — completed search

Checked, not assumed absent:
- `GET /game/dungeon/today` — top-level keys are only
  `dungeonDataEntities, dayProgressEntities, entryWarnings`. Dungeon 5's
  record has 18 keys, none faction-related. `entryData`'s `startDay: 20675` /
  `endDay: 20731` are the OFFERING WINDOW, not a selector.
- `GET /account`, `GET /user/me` — **zero** `/faction/i` matches. Notable in
  its own right: there is no player-faction field, so the competing hypothesis
  "the charged faction is the PLAYER's faction and does not rotate" has no
  supporting field anywhere.
- `GET /offchain/static`, all ~900KB — the only `/faction/i` KEY in the entire
  payload is `recipes[].FACTION_CID_array`.

### What the search DID find, and it is better than nothing

**(a) The day clock.** `/offchain/static` publishes `currentDay` (20695 —
identical to `dayProgressEntities[].TIMESTAMP_CID`), `currentDayOfWeek` (3),
`currentWeek` (86), `secondsTillNextDay`, `readableTimeTillNextDay`. So the
faction DAY is now readable without spending a run. Wired in as
`client.getGameDay()`. Observed identity: `currentDayOfWeek === currentDay % 7`
(20695 % 7 = 3). Recorded as observed, not assumed.

**(b) The faction↔ring table, published by the server itself.** Seven
"Hatchard Kit" recipes share id `500006` and differ only in
`FACTION_CID_array` and their input ring:

```
1 Crusader 135 · 2 Overseer 136 · 3 Athena 137 · 4 Archon 138
5 Foxglove 139 · 6 Summoner 140 · 7 Chobo 134        (gold = +109)
```

Two sibling families (`500007`, `500008`) carry the same seven factions
against rings shifted +2 and +4 — which is how `500006` is identifiable as the
IDENTITY family rather than as one rotation among three. Distinct
`FACTION_CID_array` values across all 543 recipes: `[]` ×228 and `[1]`…`[7]`
×45 each, exactly seven factions.

⚠ **Foxglove is faction 5 and today's `currentDayOfWeek` is 3.** They do not
match, under any of the obvious orderings (`inputItems` order puts 139 at
index 5; ascending id order also puts it at 5). So there is no trivial
`dayOfWeek → faction` identity, and the offset stays unfitted at n=1.

### The runway roughly DOUBLES, and the old number was wrong in the safe direction

Old: `min(balance)/3` = 30 runs / 7.5 days.
New: a faction is drained only on ITS active days, so at 4 runs/day it loses
12 rings per active day. Scarcest is 30 → 2 full cycles = **14 days / ~56
runs**. Tier-2 window runs to day 20731 (~36 days out), so the shortfall is
real but half what was feared.

## Step 2 — disabling the double-lethal override

### Three existing tests went red, which is the guard working

Adding the flag broke exactly 3 tests, all expected:
`oilDoubleLethalLive.test.ts` ×2 (band no longer fires) and
`oilDoubleLethal.test.ts` ×1 (source pin). None were loosened — the live file
now ARMS the flag explicitly, and the source pin now asserts THREE strings
(the call, the flag read, the disarmed fallback).

### The wiring guard has now pointed three different directions

`oilDoubleLethal.test.ts`'s assertion history: "must NOT be wired" (session
89, memo recommended against) → "must be wired" (session 90, user override
§30) → "must be wired BEHIND THE FLAG" (now). **Each turn was a user decision.**

### First draft of the new test asserted nothing, and the control caught it

Lock 1's `cannotKill` used `fakeCard` (a DOC-shaped card for the mock server)
where it needed `card` (hit zones + effects). `bestKillProbability` returned 0
for the wrong reason and the ARMED control came back empty — so the "disarmed
wants ≤1 relaxing" assertion would have passed against a state the band would
have declined anyway. **Only the deliberate armed-control test caught this.**
A second bug on the same line: `...cannotKill(hp)` spread `{hand,dist,gridSize}`
at the top level of `oilState`, leaving `board` at its killable default.

### Mutation-verified rather than assumed

Flipping the live comparison from `=== true` to `!== false` fails locks 2 and
3 (2 of 8). Restoring passes all 8.

### `tests/clientSurface.test.ts` fired on `getGameDay` — as designed

The client-surface allowlist is the repo's safety story ("the worst it can do
is play the game badly"). Adding ANY method breaks the build. `getGameDay` was
added to the allowlist as the conscious act the file's header demands, with
the reasoning written next to it: no address, no account state, the same bytes
every player gets. `README.md`'s claim is untouched, so no README change.

## Step 3 — fishing

- Caps read live BEFORE sizing: **0/20 used, both ledgers agree at 0**, server
  cap flag "not set". That is the **first live exercise of session 112's guard
  over-count fix** (STATE.md open question 4) and it reads correctly.
- Rod durability **33** (rod 812, slot 14) — so the CAST CAP binds first at
  20, not durability. Repo budget is 25 casts / 300 energy; game cap is 20.
- Oil stock: **937 Mid Relaxing = 62**, **942 Mid Focus = 0**. Focus is both
  out of stock AND off `allowedItemIds` — the directive's untouched half.
- Dry-run spent nothing and cleared every guard. ⚠ It could NOT confirm the
  oil-policy change, because it stops at `start_run` before any decision turn
  exists. The wiring is confirmed instead by lock 3, which drives `runOneCast`
  through the band and asserts zero POSTs — a stronger instrument than a
  dry-run line would have been.

## Step 3 — the fishing batch, and the directive INVERTED the oil source

**20 casts played, 19 charged** (the known JEBAITOR gap, 1/20 = 5%, inside the
measured ~9%). Energy 240, guard-tracked. Rod durability **33 → 13**.

### THE HEADLINE: the approved on-demand policy fired, for the first time ever

Session 112 measured **14 of 14 oils from the override, 0 from the approved
policy**. This batch, with the override disarmed:

**2 of 2 oils from the approved policy, 0 from the override.** A complete
inversion, and it is exactly what the directive was for.

Both firings, from the log (`use_fishing_item`, itemId 937, slot 0):

```
line 288  turn 1  fishHp 1  bestKillProbability 0.5795  liveWanted [relaxing]
line 316  turn 2  fishHp 1  bestKillProbability 0.6298  liveWanted [relaxing, focus]
```

Both at **`fishHp` 1** — squarely inside the approved band (`fishHp <= 2`),
the band session 112 proved was being starved by the override killing at 3-4.
Both `bestKillProbability` **below the 0.85 necessity threshold**, so the gate
correctly did NOT withhold them. This is the approved policy working end to
end for the first time on live data.

`oil_double_lethal_fired`: **0**. `oil_double_lethal_fired_while_disarmed`
(the new anomaly siren): **0**.

### Oil spend collapsed 6.4x, and that is the "not wasted" half of the target

- session 110 (override armed): 14 oils / 22 casts = **0.64 per cast**
- this batch (override disarmed): 2 oils / 20 casts = **0.10 per cast**

Relaxing stock 62 → 60. Focus 0 held AND off `allowedItemIds` — 30
`oil_trigger_policy_withdrawn` events, every one a Focus trigger dying at the
config filter exactly as session 112 described.

### Catch rate is 60.0%, at the BOTTOM EDGE of the user's target

```
this batch   12/20 = 60.0%   Wilson 95% CI [38.7%, 78.1%]
session 110  14/22 = 63.6%   Wilson 95% CI [43.0%, 80.3%]
```

⚠ **The intervals overlap almost entirely and n is tiny on both sides — these
are NOT distinguishable.** Do not read 60.0 vs 63.6 as a decline caused by the
directive; at n=20 the CI is 40 points wide. What CAN be said is that the
catch rate stayed inside the 60-70% target band while oil spend fell 6.4x.
Two batches is not a trend; the next batch is the third point.

### The guard over-count fix passed its first live exercise EXACTLY

STATE.md open question 4. Post-batch: **GAME ledger 19/20, REPO ledger 19
casts / 240 energy, "ledgers agree at 19"**, server cap flag "not set". Under
the session-107 bug the repo would have forged `maxCastsPerSession` (25) into
that counter. It reads the game's own number.

### Other numbers

- Hard Core (845): **+2480** across the batch, ~207 per catch — consistent
  with the rarity-tracked base (0→80 … 4→480), not a constant.
- Other drops: 935 ×29, 514 ×5, 516 ×2, 523 ×2, 519 ×2, 515 ×1, 518 ×1.
- Deck grew to 21 cards; 12 `loot` resolutions, all card choices taken.
- 1 cast remains on today's game ledger. Not spent — the batch was sized to
  the cap and the last cast was the JEBAITOR gap reopening it, not headroom
  the batch declined.
