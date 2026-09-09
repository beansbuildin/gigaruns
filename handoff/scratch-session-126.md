# PRE-REGISTRATION — session 126 — day 20704 (dow 5, CHOBO), before any spend

Written 2026-09-09T17:20Z. **Nothing has been spent at the time of this commit:**
dungeon `dayProgressEntities` = null (0/12 run-units), fishing `dayDocs[pond 2]`
= 0/20, both read live at 17:14–17:18Z.

---

## Step 0 — JWT (recorded, per the brief's third ask)

`scripts/doctor.ts` at 17:15Z: **valid for another 71.4h** → expiry
≈ **2026-09-12T16:40Z**. Matches session 125's projection exactly. Authenticated
as the expected account; `dungeon 5, 20 energy/run, budget 240/day, 12 runs`.

---

## Step 1 — live reads, and the brief's six claims scored

Game day **20704**, week 87, **dayOfWeek 5 → Chobo (134)**, next day in 00:44
(rollover **2026-09-09T18:00Z**).

| # | Brief's claim | Live | Verdict |
|---|---|---|---|
| A | day 20705 / dow 6 / Athena — **or 20704 / dow 5 / Chobo if before 18:00Z** | 20704, dow 5, Chobo | **PASS** (alternate branch) |
| B | rings total 207; Athena 21 scarcest, Archon 24, Crusader 27, Chobo 30, Summoner 30, Foxglove 33, Overseer 42 | identical, sum 207 | **PASS** |
| C | run-units fresh 0/12 | `dayProgressEntities` null | **PASS** |
| D | fishing fresh 0/20 charged | `dayDocs[2]` 0/20 | **PASS** |
| E | rod 923 = 6; slot-15 pair = 1 and 6 | rod **6**; slot-15 pair **20 / 20** | **FAIL** (pair repaired) |
| F | 901 = 5; 641 = 12; 905 = 12; 640 = 34 | **901 = 26**; 641 = 12; 905 = 12; 640 = 34 | **FAIL** (901 repaired) |

**Four pass, two fail. Both failures are OUT-OF-BAND USER REPAIRS, not spec
errors** — the same failure mode session 125 hit, which the brief predicted
would recur. This is the rule-9 check working.

Full gear census read 2026-09-09T17:14:57.819Z (12 equipped pieces):

```
slot  2  109   55      slot 11  640   34      slot 14  923    6
slot  3  110    5      slot 12  641   12      slot 15  954   20
slot  6  204   40      slot 13  901   26      slot 15  954   20
slot  6  208    3      slot 13  905   12
slot  8   50    0   <- ZERO, GRANDFATHERED (at 0 at session open; slot 8 is in
                       neither wear set — dungeon is 11/12/13, fishing is 14/15)
```

---

## Step 2 — the forecasts, from the LIVE read, not the brief's table

### Dungeon, −3 per RUN (slots 11, 12, 13×2)

| slot | piece | now | r1 | r2 | r3 | r4 |
|---|---|---|---|---|---|---|
| 11 | 640 | 34 | 31 | 28 | 25 | 22 |
| 12 | 641 | 12 | 9 | 6 | 3 | **0** |
| 13 | 901 | 26 | 23 | 20 | 17 | 14 |
| 13 | 905 | 12 | 9 | 6 | 3 | **0** |

**PREDICTION: a full 4-run day is possible with NO dungeon repair.** 641 and 905
land on exactly 0 at the END of run 4, so the [USER] gear halt fires after run 4
— coinciding with the 12/12 run-unit cap, costing nothing. **The brief's "the
dungeon day is TWO runs without a repair" is dead**, killed by the 901 repair.

### Fishing, −1.00 per PLAYED cast (slots 14, 15×2)

| slot | piece | now | breaks on played cast |
|---|---|---|---|
| 14 | **923 (rod)** | **6** | **6** |
| 15 | 954 A | 20 | 20 |
| 15 | 954 B | 20 | 20 |

**PREDICTION: without a rod repair the fishing day is SIX played casts, not 30.**
The rod is now the SOLE binding piece — the slot-15 pair was repaired to 20 and
no longer binds first. If the rod is repaired to ≥20, the binding constraints
become the slot-15 pair at 20 played and the server's 20 CHARGED cap.

### Rod path
6 → 5 → 4 → 3 → 2 → 1 → **0** on played cast 6. Delta exactly −1.00 per played
cast (12/12 batches last session).

### Charge shape
Currently **33/33** — one faction, exactly 3, six untouched. Four runs takes it
to **37/37**.

**Branch, pre-registered because the rollover lands mid-session:**
- Runs completed **before 2026-09-09T18:00Z** → day 20704, dow 5 → **Chobo (134)**:
  30 → 27 → 24 → 21 → **18**.
- Runs completed **after** → day 20705, dow 6 → **Athena (137)**:
  21 → 18 → 15 → 12 → **9**.

Not a discovery — the rotation is fully measured (session 123, all seven cells).
This is bookkeeping, and it is written down only because WHICH branch fires is a
user timing decision that has not been made at the time of this commit.

**⭐ THE TIMING FINDING, and it inverts the brief's headline.** The brief warned
this would be an Athena day and Athena is the scarcest ring at 21. It is not one
yet: for the next ~40 minutes it is a **Chobo** day, and Chobo holds **30**.
Four runs started before 18:00Z spend Chobo 30→18 instead of Athena 21→9 — the
same four runs, off the third-most-plentiful faction instead of the scarcest.
**Raised to the user before the first go-ahead, per the brief's own instruction.**

---

## Step 3 — the GATE: the Dendren catch-rate tripwire

**Pre-registered rule, stated before the reading so it is not re-litigated
after it:**

- **Below ~50% pooled Dendren-only at n ≈ 100 → a REAL SIGNAL.** Report it and
  **put it to the user as a decision. An agent may not act on it alone.**
- **50–65% → NOISE.** Report and move on.
- **⛔ No live study either way.** The sim settled the deck question (Dendren
  BETTER, +3.23pp [2.92, 3.55] at n=40k/arm); detecting 3pp live needs ~87
  sessions.

Baseline carried from the brief: Dendren-only pooled **37/74 = 50.0%** (24/50
through session 124, plus session 125's 13/24). **Recomputed with
`scripts/fishBatchReport.ts` at evaluation time, not hand-counted** — and the
brief's 37/74 is itself a rule-9 claim, verified then, not now.

⚠ At a 6-cast rod ceiling the corpus reaches **n ≈ 80**, NOT the ~100 the
tripwire arms at. **If the rod is not repaired the gate does not arm this
session, and that is a legitimate outcome to report rather than a failure.**

`LIVE.drift` and `damageHist` mode to be quoted **POOLED AND DENDREN-ONLY**
(session 125 gave pooled only).

---

## Step 4/5 — shape

Fishing: repeated `--oil-batch` at `castCap: 2`, never one long batch. Played
and charged reported SEPARATELY. Cast-refusal boundary stands at 24, 25, 27 —
a fourth point only if a refusal actually occurs; a missing refusal is not
evidence it moved.

Dungeon: `--dry-run` first, then `--runs=1 --juiced --juiced-index=2`, **one
go-ahead per run**, all seven balances re-read after each, the four wearing
pieces re-read after each against the table above. Rule 8 governs in-room picks.
Rule 13 on any denial: read the ledger before believing it.
