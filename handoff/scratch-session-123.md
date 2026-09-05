# SCRATCH — session 123 — PRE-REGISTRATION, written BEFORE any `start_run`

**This file is committed before the first `start_run` of day 20701 and its
entire value is being a tamper-evident timestamp. It is not to be amended
afterwards; corrections go forward into the recap.**

No addresses, no usernames, no JWT fragments appear below — session 122 leaked
both an address and a username into its own pre-registration and the secret scan
caught them after the commit existed.

---

## Step 0 — token runway (session 122 dropped this number)

`scripts/doctor.ts`, read live at 2026-09-05T19:5xZ:

- **token valid for another 164.8h** (~6.9 days, expiry ≈ 2026-09-12T~14:00Z).
- The old runway figure `2026-09-04T18:48:43Z` belongs to the retired token and
  is dead. Do not quote it.

## Step 1 — the live readings, all taken BEFORE any spend

| # | brief's claim | live reading | verdict |
|---|---|---|---|
| A | day **20701**, `dayOfWeek 2` | day 20701, week 87, dayOfWeek 2, next day in 22:03:08 | **PASS** |
| B | seven balances, total **234** | total **243** — see below | **FAIL** |
| C | run-units **0 of 12** | dungeon 5 `dayProgressEntities` = `null` (0 used) | **PASS** |
| D | fishing **0/20 charged** | GAME `dayDocs[pond 2]` 0/20, repo ledger 0, caps agree | **PASS** |
| E | rod **812** (slot 14) durability **5** | **rod 812 is NOT EQUIPPED.** Slot 14 holds item **923**, durability **40** | **FAIL** |
| F | slot 11 (item 640) at or near **70** | **70** exactly | **PASS** |

### Claim B — the two movers, and what they change

Silver rings, read live:

| faction | item | name | brief said | **live** | delta |
|---|---|---|---|---|---|
| 3 | 137 | Athena   | 21 | **21** | — |
| 4 | 138 | Archon   | 18 | **24** | **+6** |
| 1 | 135 | Crusader | 27 | **27** | — |
| 7 | 134 | Chobo    | 30 | **30** | — |
| 6 | 140 | Summoner | 42 | **42** | — |
| 5 | 139 | Foxglove | 45 | **45** | — |
| 2 | 136 | Overseer | 51 | **54** | **+3** |

Total **243**, not 234. Two balances ROSE between sessions; five are unmoved.
Rings were acquired out of band — **nothing was spent** by this bot since the
session-122 close, and the run-unit ledger at 0/12 is consistent with that.

Two consequences, both load-bearing for this session:

1. **The prediction's numbers change: Overseer is at 54, so the predicted
   charge is 54 -> 51, not 51 -> 48.** The FACTION prediction is untouched.
2. **Athena (21) is now the scarcest silver ring, not Archon.** Any runway
   sentence naming Archon as the binding faction is stale.

### Claim E — the rod was SWAPPED, and the user said so in chat

Golkan rod **812** is gone from the equipped set entirely (consistent with the
schema's documented behaviour: an unequipped instance reads
`EQUIPPED_TO_SLOT_CID: -1`). Slot 14 now holds **item 923 at durability 40** —
the **Dendren Rod**. The user also stated the **base deck casting spells will be
different**.

**Pre-registered consequence, so it is not discovered as a bug later: fishing
corpus records from before this swap are a DIFFERENT ARM**, the same shape as
session 122's gear-durability arm split. Any fishing deck pin that moves is to
be read as the swap, not as drift, and verified live rather than re-pinned.

**STATE's "rod has 5 durability, five casts exhaust it" plan is DEAD.** It
described instance 812. The new rod reads 40.

### Full equipped-gear census, read before run 1

```
slot  item   durability
   2   109           10
   3   110           32
   6   227            2
   6   227            0   <- ZERO
   8    50            0   <- ZERO
  11   640           70
  12   641           48
  13   905            6
  13   901           14
  14   923           40   <- the new Dendren Rod
  15   954           25
  15   954           25
```

**Two pieces were ALREADY at 0 before run 1**, which the ratified [USER] gear
halt does not cover — it was written for a piece that reaches 0 *during* a
session. Put to the user before spending; both answers recorded below.

## [USER] decisions taken 2026-09-05, before any spend

1. **The two pre-existing zeros are GRANDFATHERED.** Item 227 (slot 6) and item
   50 (slot 8) were at 0 at session start and are EXCLUDED from the halt
   trigger. **The halt fires only on a piece that reaches 0 DURING this
   session** — which is the failure the rule was written for. All four
   authorized runs proceed. This does not weaken the rule: a run in progress is
   still NEVER aborted for durability, and a piece newly reaching 0 still stops
   the session after the run it broke in.
2. **Slot 8 MATTERS for fishing: hold the batch until item 50 is repaired.**
   Fishing does not run this session until the user repairs it and durability is
   **re-read live** — not assumed. The dungeon runs are unaffected.

---

## THE PREDICTION — day 20701 is dow 2, and this is CONFIRMATION, not discovery

The rotation is **SOLVED**: six cells measured, the seventh (**dow 2**) FORCED by
elimination under hypothesis (a) and **never observed**. Day 20701 is the free
confirmatory test of exactly that cell.

```
dow1 Crusader(135)  MEASURED     dow2 Overseer(136)  FORCED — this is the one
dow3 Foxglove(139)  MEASURED     dow4 Summoner(140)  MEASURED
dow5 Chobo(134)     MEASURED     dow6 Athena(137)    MEASURED
dow7 Archon(138)    MEASURED
```

> **PREDICTION: the first juiced Tier-2 `start_run` of day 20701 charges
> Overseer (item 136) and NOTHING ELSE, by exactly 3: 54 -> 51.**

Asymmetric value, stated in advance:

- **PASS** -> the last cell moves from *forced* to *measured*. All seven cells
  observed; **the rotation then needs no further runs at all.** No eighth
  rotation run is to be scheduled.
- **FAIL** -> far more consequential than it looks. The dow-2 cell was derived
  by elimination *from* hypothesis (a); if it fails, **(a) fails**, and every
  other cell's status is downgraded with it. The six measurements would survive
  as observations; the PERMUTATION claim binding them would not. **Stop
  immediately, spend nothing further, report.**

### Falsifiers, stated in advance

1. **The ORDER claim dies** if the sole mover is any faction other than
   Overseer (136).
2. **The SHAPE claim dies SEPARATELY** — currently **21/21** — if more than one
   faction moves, or if the amount is anything other than exactly 3. Order and
   shape are independent; one can die without the other.
3. **No prediction is made about run-to-run variance, death depth, or income.**
   Those are not what this run is for and must not be reported as if predicted.

### Gear wear rate — pre-registered as UNKNOWN

Durability is read before and after every run this session. The per-run wear
rate, per slot, is **currently unknown and is NOT guessed here.** Whatever the
four bracketed reads show is the first measurement of it. Same shape as the rod
rate session 121 bought by fixing a denominator.

### Also pre-registered: what is NOT being spent

- Fishing: **0 casts**, held on the user's slot-8 decision above.
- Dungeon: **4 juiced Tier-2 runs, 12 of 12 run-units**, authorized in advance,
  one at a time with a report between each (rule 11 is not repealed by advance
  authorization).
