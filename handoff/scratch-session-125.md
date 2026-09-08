# SCRATCH — session 125 — day 20703 (dow 4, Summoner)

Pre-registration. Written and committed BEFORE anything is spent.
Live reads at 2026-09-08T05:50–05:52Z. All numbers below are computed from the
LIVE read, never from the brief.

---

## Step 0 — JWT (the brief's THIRD ask; two sessions dropped it)

`scripts/doctor.ts`: **token valid for another 106.8h** (~4.45 days), 1728 chars.
Authenticated as `coinpie`. Runway is not short; no need to warn the user before
spending. **Recorded here so the third silent pass does not happen.**

## Step 1 — live state, and where the brief was WRONG

Day **20703**, week 87, **dayOfWeek 4**, next day in **12:08**. dow4 -> f6
**Summoner (140)** per the measured permutation. Ledgers both fresh: dungeon
**0/12** run-units, fishing **0/20** charged.

### Claims A–G

| # | Claim | Result |
|---|---|---|
| A | day 20703, dow 4, Summoner | **PASS** |
| B | ring total 213 | **FAIL — live total is 219. See below.** |
| C | run-units fresh 0/12 | **PASS** |
| D | fishing fresh 0/20 | **PASS** |
| E | rod 923 = 30 | **PASS** |
| F | 905=6, 901=17, 641=24, 640=46 | **FAIL on 905 — it reads 24, not 6.** Other three PASS. |
| G | slot-15 pair reads 0/0 | **FAIL — reads 25 and 30.** |

### Claim B RESOLVED — it is (b), an arithmetic slip in STATE 124, not a movement

Live silver balances, all seven read this session:

```
137 Athena    21      138 Archon    24      135 Crusader  27
134 Chobo     30      139 Foxglove  33      136 Overseer  42
140 Summoner  42                            ---------------- total 219
```

Session 123 closed at **231**. Session 124 spent **12 Foxglove** (45 -> 33, sole
mover). 231 - 12 = **219**, which is exactly what the server says. Every
COMPONENT number in STATE 124 is correct — Foxglove 33, Athena 21, Archon 24,
and the untouched four at 27/30/42/42 = 141. Only the **total** is wrong.
**No rings are missing; no out-of-band movement occurred.** STATE 124's
"Silver rings 213" is a slip and is corrected in place this session.

### BOTH repairs the brief asked me to raise are ALREADY DONE

The brief's Step "FIRST" asked the user for two repairs. The live read says the
user did both out of band, before this session opened:

- **905 (slot 13): 6 -> 24.** New docId `..._1788846409_10d821c4`. The brief's
  headline forecast — *"905 breaks on run 2, the halt stops the dungeon arm"* —
  is **VOID**. At -3/run, 24 covers 8 runs. No dungeon halt this session.
- **Slot-15 fishing pair (item 954 x2): 0/0 -> 25 and 30.** So the question
  "what does a broken slot-15 piece do to a cast" **cannot be answered this
  session** — there is no broken slot-15 piece any more. Do not manufacture one.

**Full gear census, read 2026-09-08T05:51:44Z:**

```
slot  item  dur   slot  item  dur
   2   109   64     13   901   17
   3   110   14     13   905   24
   6   204    1     14   923   30   <- rod
   6   208   12     15   954   25
   8    50    0     15   954   30
  11   640   46
  12   641   24
```

Item **50 (slot 8) at 0** is the settled superseded Stone Rod — **[USER]
GRANDFATHERED, not a repairable piece.** It does not gate either arm.

---

## Step 2 — PRE-REGISTERED FORECASTS

### P1 — charge shape and the Summoner walk (bookkeeping, not discovery)
Each of the 4 runs charges **exactly ONE faction, exactly 3, six untouched**.
Summoner 140: **42 -> 39 -> 36 -> 33 -> 30**. Total **219 -> 207**.

### P2 — scarcest ring at close
**Athena stays scarcest at 21.** Summoner ends at 30, tied with Chobo.
(The brief's "Chobo could become scarcest" applies only if the day had rolled.)

### P3 — dungeon wear, -3 per run, and NO BREAK THIS SESSION
```
905  24 -> 21 -> 18 -> 15 -> 12
901  17 -> 14 -> 11 ->  8 ->  5     <- lowest at close
641  24 -> 21 -> 18 -> 15 -> 12
640  46 -> 43 -> 40 -> 37 -> 34
```
**The dungeon gear halt will NOT fire.** Explicitly reversing the brief.

### P4 — rod 923, -1.00 per PLAYED cast
30 -> reaches **0 after the 30th played cast**.

### P5 — ⭐ THE SLOT-15 PIECE BREAKS BEFORE THE ROD DOES
Slot 15 wears at the same **-1.00 per played cast**. The pair is at **25 and
30**. So the piece at 25 reaches **0 after the 25th played cast** — **five casts
EARLIER than the rod.** The brief only tracked the rod and would have been
surprised by this.

**Forecast: the FIRST fishing-arm gear break is the slot-15 piece at cast 25,
not the rod at cast 30.** If the batch reaches 25 played casts, the per-arm gear
halt fires there and hands back.

### P6 — the server's cast refusal
Landed at **24, 25, 27** on the last three days — drifting up, not fixed.
**Pre-registered RANGE: casts 24–29**, point estimate 27–28.

### P7 — which of P5 / P6 binds first
Three events cluster: refusal (24–29), slot-15 break (25), rod zero (30).
**Forecast: the refusal or the slot-15 break binds; the rod does NOT reach 0.**

### P8 — run mechanics
Rule 8 tier picks route through `src/strategy/enemyTier.ts`; the Perpetual
filter is expected to fire on roughly a third of offers. Entry is
`--juiced --juiced-index=2 --runs=1`, 60 energy, 3x Big Heal Juice (131).

---

## Surprises log (appended live)
- **[05:52Z]** The brief's two headline asks were both already satisfied by the
  user out of band. A brief's gear forecasts go stale the moment the user
  repairs; **read gear live before quoting any forecast built on it.**
- **[05:52Z]** Claim B's "6 missing rings" was a subtraction error in a recap,
  not a game event. The components were all right; only the sum was wrong.
