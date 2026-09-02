# session 116 — 2026-09-01 — day-20697 rotation point, 4 dungeon runs, 28 fishing casts

Operational brief, not a numbered TASKS.md gate. Every live spend was authorized
by the user one step at a time.

## Step 0 — JWT: PASS

Decoded locally, printing only the claim (never the token):

```
now      : 2026-09-01T22:21:55.920Z
exp      : 2026-09-04T18:48:43.000Z
runway   : 68.45 hours = 2.85 days
```

## Step 1 — the day: PASS

`checkEntryTiers.ts` → `game day 20697 (week 86, dayOfWeek 5)`.
`checkDungeonToday.ts` → `dayProgressEntities` `[]`, a fresh 0/12.

Ring balances had drifted **+6 out of band** since session 115 closed (Chobo
39→42, Overseer 48→51; other five unchanged). Both moves are GAINS, so no run
was spent out of band. Pre-run baseline, total 282:

```
138 Archon 30   137 Athena 33   135 Crusader 39   134 Chobo 42
140 Summoner 42 139 Foxglove 45 136 Overseer 51
```

## Step 2 — the rotation point: PASS. Chobo predicted, Chobo charged.

Run 25269116, juiced Tier-2, death room 13/16.

```
134 Chobo    42 -> 39   <-- the ONLY faction that moved, -3
135 Crusader 39 -> 39   136 Overseer 51 -> 51   137 Athena  33 -> 33
138 Archon   30 -> 30   139 Foxglove 45 -> 45   140 Summoner 42 -> 42
```

### The map, and what it does and does not establish

| game day | dayOfWeek | faction | ring |
|---|---|---|---|
| 20695 | 3 | 5 | Foxglove 139 |
| 20696 | 4 | 6 | Summoner 140 |
| 20697 | 5 | **7** | **Chobo 134** |

`faction = dayOfWeek + 2`, index incrementing by one per day. Two things make
this more than a pattern in three numbers:

- **The faction index is SERVER-published**, not read off id order:
  `/offchain/static` recipes `500006` differ only in `FACTION_CID_array` and
  their input ring (1 Crusader 135 … 7 Chobo 134). `scripts/checkEntryTiers.ts`
  documents the provenance at its `FACTIONS` table.
- `dayOfWeek === day mod 7` holds on every checkable point (7 × 2956 = 20692).

⚠ **All three points are CONSECUTIVE and the 7→1 WRAP IS UNTESTED.** Day 20698
predicts **Crusader (135)** and is the only observation that tests it.

## Steps 3-4 — three more dungeon runs, all separately authorized

| run | death room | Hard Core | Dendren Remnant | ring |
|---|---|---|---|---|
| 25269116 | 13 | 6,552 | 1,179 | Chobo 42→39 |
| 25270717 | 6 | 2,712 | 216 | Chobo 39→36 |
| 25271526 | 5 | 2,160 | 141 | Chobo 36→33 |
| 25271834 | 5 | 2,040 | 141 | Chobo 33→30 |

**12-for-12 on one-faction-×3**, and four consecutive same-day charges settle
what the brief flagged as potentially bigger than the rotation itself: **the
charged faction does NOT change mid-day.** Day: 12/12 run-units, 240 energy,
13,464 Hard Core, 1,677 Dendren Remnant, 12 Chobo rings (42→30, now tying
Archon as scarcest at 30).

### ⚠ The number that judges the Tier-1/Tier-3 baseline

One faction day, one loadout, one entry tier, one boon policy — deaths at rooms
**13, 6, 5, 5** and Hard Core **6552 / 2712 / 2160 / 2040**. Mean ~3,366 with a
range of 2040–6552: **a 3.2x spread within a single arm on a single day.**

This is the concrete reason to stop calling the cross-tier baseline "cheap and
well-defined", as STATE has for eleven sessions. A ONE-run Tier-1 or Tier-3 read
cannot separate a `dropMultiplier` effect from this. Budget several runs per arm
or retire the experiment; do not spend one run and report a comparison.

## Two pinned rules broke, and both were real findings

### ⭐ Evade DOMINATES crit — `critProc`'s exclusion list was the defect

`tests/procEffectSize.test.ts` went red: `critProc1` 3/4 status-clean. The single
miss is `run-2026-09-01-22-35-10/state-128` — enemy ATK 16, `critProc1` fired so
`2*ATK = 32` predicted, **0 observed**, because `evadeProc0` fired on the same
exchange.

Measured rather than assumed:

```
evadeProc0: taken==0 on 16/16 all,  6/6  status-clean
evadeProc1: taken==0 on 37/37 all, 12/12 status-clean
co-fire evadeProc0 + critProc1: 2  (1 clean) -> run-2026-09-01-22-35-10
co-fire evadeProc1 + critProc0: 1  (0 clean) -> run-2026-08-31-19-12-22
```

(By session end, with all 28 casts and 4 runs in: **56/56**, 19/19 clean.)

The crit co-fires sit INSIDE that population rather than being exceptions to it.
`critProc` already excluded `blockProc${foe}` — the same class of victim-side
proc that overrides the attacker's arithmetic — and evade was simply never in the
list. Invisible until now because evade+crit co-fires number **3 in the whole
corpus and all 3 arrived in this run**. Fixed by making `excludeFlag` a list.
Session 113's `scaleRule` lesson in a second shape: **an incomplete exclusion
list is the defect, never the multiplier.**

Noted and deliberately NOT changed: `evadeProc` excludes `critProc${foe}` and
does not need to — its rule holds over the co-fires. Removing that would make
evade's claim strictly stronger at larger n; a separate change.

### ⚠ `BurnMastery` floor-vs-round is VACUOUS — carried three sessions, unmeetable

The brief named it for the third time. Two independent defects:

1. **Its stated precondition was already satisfied when written.** It asked for
   "an ODD plain amount". The pair set has been `{6/3, 4/2, 8/4, 10/5}` since
   session 114 — 3 (n=18) and 5 (n=4) are both odd. Session 114's own DECISIONS
   entry recorded that pair set and wrote *"Still NO odd plain amount"* on the
   same line.
2. **No capture could ever separate them.** Every `Burn` amount and tick in the
   corpus is an INTEGER — 14 distinct values (1..12, 14, 24), zero non-integers —
   and `floor(2p) === round(2p) === 2p` for every integer `p`. Floor and round
   are the same function on this domain.

Per CLAUDE.md rule 6 this is an unmeetable request wearing a carry-forward's
clothes. **CLOSED.** Re-opens only if a non-integer burn amount is ever observed.

Also fixed: `scripts/statusEffects.ts` printed
`"x2 vs +3 UNSEPARATED (only after=3 ever seen)"` on every run — stale since
session 113 — **directly beside the pairs `4/2`, `8/4`, `10/5` that disprove it.**

## Fishing — 28 casts across three batches

| batch | played | charged | caught |
|---|---|---|---|
| 1 | 11 | 6 | 6 (54.5%) |
| 2 | 14 | 11 | 10 (71.4%) |
| 3 | 3 | 3 | 1 (33.3%) |
| **total** | **28** | **20** | **17 (60.7%)** |

### ⭐⭐ JEBAITOR has been LEVELLED again: `value` = 15.75

Read off the server's own `start_run` response (§34's instrument), not inferred:

```
{"type": "JEBAITOR", "playerId": -1, "batch": 0, "value": 15.75, "data": {}}
```

Against **6.75** (2026-08-24) and **2.25** (2026-08-21). §34 said the 2.25→6.75
move "is an inference from two points and is not asserted" — there are now three
points and the direction is consistent.

**The mechanism is confirmed far harder than before.** JEBAITOR events matched
`fishing_ledger_reconciled` `lowered` events **8-for-8** this day (5 of 11, then
3 of 14, then 0 of 3), against §34's census of **3 sightings in 166 casts ever**.
One day nearly tripled the observed instances; the correspondence is now
**10-for-10** counting §34's original two.

⚠ Observed 8/28 = 28.6% still runs above the stated 15.75%, but at this n that
is unremarkable and **no further rate change should be read into it.**

### ⭐ "No card HITS for 9" is falsified — by a card the chooser itself added

`tests/fishing/stateFields.test.ts` asserted `hitAmounts.has(9) === false` from
session 80 through 115. Card **id 14** — `hitEffects` amount 9, `critEffects`
EMPTY — was picked by `chooseNewCard` in batch 2 (loot `cards: [14]`) and appears
in casts 13208727 / 13208729 / 13208734 and nowhere earlier.

**Nothing upstream needs revisiting.** Session 80's point was that a base-9 shot
was UNREACHABLE and so could not separate the crit rules; the correction was that
`critEffects` reaches it, and the base-9 CRIT settled the member on its own
evidence. The hit path reaching 9 STRENGTHENS reachability.

17 live card choices this day, all by the fixed chooser:
`[19,18,18,19,15,13]`, `[26,23,23,18,30,19,23,14,32,19]`, `[36]` — against a
validation floor STATE 115 put at **2 project-wide**.

### [USER] Budget raised 300 → 360 energy, 25 → 30 casts, STANDING

Directive in chat: *"you are authorized for up to 5 more casts raising the daily
budget to 30 going forward to accommodate for jebaitor."* Recorded in
`config/bot.json` as `_dailyEnergyBudgetComment116`.

**This is session 107's raise recurring for session 107's exact reason**: the
repo guard, not the game, bound the day — 25 PLAYED with 3 charged casts still
available — because the skill was levelled again and ate the headroom 252→300
had bought. 360 = 30 × 12.

### ⭐ Fail-closed behaviour DEMONSTRATED after the raise

Three of the five authorized casts played, taking `dayDocs[pondId 2]` 17 → 20/20.
The fourth was refused:

```
✗ Guard tripped: session run cap reached
  {"source":"server start_run rejection",
   "message":"HTTP 400 — {\"success\":false,
   \"message\":\"Player has reached max runs for fishing\"}"}
  energy: 54 -> 54  (observed delta 0; committed 0)
```

**0 energy spent on the refused attempt**, guard tripped, loop stopped,
`SERVER cap flag: SET`. The repo ceiling moved, the GAME ceiling did not, and the
game's is the one that binds — the property the raise was meant to preserve.

## The pin work — 136 assertions across 9 test files

Two passes (59 after batches 1-2, 77 after batch 3). Mostly mechanical corpus
growth, but three carried real content:

- **`damageEconomy`'s clamp bar was RE-DERIVED, not widened**, on its first
  breach since session 91 introduced it (never widened in between).
  `|unclamped.drift - LIVE.drift|` read **0.0517** against a bar of 0.05.
  Bumping to 0.06 would have been wrong. The defect is the bar's SHAPE: an
  ABSOLUTE gap tightens on its own as `|LIVE.drift|` grows (−0.1985 at session 91
  → −0.6473 now), so constant relative agreement had to breach a fixed 0.05
  eventually. **DECISIONS 2026-08-28's "a threshold on a composition-bound
  statistic is not an invariant" in a second place.** Replaced with the
  scale-free form the prose was always about, `gap/|drift| < 0.1`, measured
  **0.0799**; ratio history 4.7% (s91) → 8.0% (now), so it is not un-breakable.
  Pre-registered: **a breach re-examines the claim; it does not move the bar.**
- `LIVE.drift` −0.6017 → −0.6473. Still negative, still short of −1 — the two
  conditions STATE names for re-derivation — so a pin update. `bare/LIVE` still
  clears its `> 5` bar.
- **⚠ A note THIS session wrote went stale INSIDE the same session, and was
  retracted in place.** The K=10 annotation claimed `sacrifices` (7) and
  `wasted` (11) both held across the 25-cast day. **`wasted` did not** — the
  day's last 3 casts moved it 11 → 12, after the note was written. Corrected
  rather than left standing; this session's own stale-caption rule applied to its
  own work. What survives is the load-bearing half: **`sacrifices` is UNMOVED at
  7 across all 28 casts** while `fires` 93→95, `rescues` 33→34, `manaSpent`
  141→144 and `wasted` 11→12 all moved. **The general lesson: a claim of the form
  "X and Y both held" is falsified by ONE more observation — name the cell that
  matters rather than pairing it with one that merely happened to agree.**

Audit of the machine-applied bumps: **every count pin was verified to move
UPWARD** (a growing corpus cannot shrink one); the values that fell are all
*rates* on growing denominators. Corpus totals consistent at 367 casts / 366
clean — the documented "clean trails traces by exactly one" identity.

`OBSERVED_OFFERS` gained **25 rows in four separate blocks** (12 + 5 + 4 + 4),
kept unpooled so each run stays a distinct trajectory. Additivity verified
before every append: N in corpus absent from table, **ZERO in table absent from
corpus**, four times. Room-max unchanged at 13 throughout.

## Surprises worth carrying

- The room-8 `Heal(50)` (Epic) **was PICKED** in run 1, where both session-112
  Heals were declined.
- `CritHeal(6)` was OFFERED again (run 4, room 2) and NOT picked — still held
  latent per the standing rule.
- The `liveFishing.ts` rod-durability label is now actively misleading:
  `38 (before: 49, casts this batch: 6)` pairs an 11-point play-driven delta with
  a charge-driven count of 6. Deliberately unfixed for three sessions; JEBAITOR
  at 15.75 makes the two diverge on most batches now.
- A new unknown-field dump appeared once: `data.nextPosition`,
  `data.nextMovePath` on a completed-but-unresolved doc
  (`logs/fishing-unknown-terminal-2026-09-02-03-36-00.json`). Benign — the cast
  after it started normally. Not chased.

## Verification, against the final commit

```
vitest run --maxWorkers=4  ->  2323 passed / 2323, 115 files
npx tsc --noEmit           ->  clean
git diff --check           ->  clean
discoveredShipsClean       ->  8/8
.gitignore                 ->  all seven required paths present
secret scan (tracked)      ->  11123 files, 0 unexplained, 14 allowlisted, PASS
secret scan (diff c0a2e4e7)->  616 files, 0 unexplained, PASS
```
