# PRE-REGISTRATION — session 124 — written BEFORE any spend

Committed before the first `start_run` and before the first cast. Game day
**20702**, `dayOfWeek` **3**, read live. Rollover in 18:30:55.

No addresses, no usernames, no JWT fragments in this file.

---

## Step 0 — the JWT, recorded as a number (second ask, now discharged)

`scripts/doctor.ts`: **token valid for another 137.2h ≈ 5.7 days**. Runway is
not a constraint for this session and no chat warning is owed.

## Step 1 — the live reads, and Claims A–F

| # | claim | verdict |
|---|---|---|
| A | day 20702, dow 3 → **Foxglove (139)** | **PASS** |
| B | balances are session 123's close, total 231 | **PASS** (did not rise this time) |
| C | run-units a fresh 0 of 12 | **PASS** (`dayProgressEntities` null) |
| D | fishing a fresh 0/20 charged | **PASS** (both ledgers agree at 0) |
| E | rod is Dendren (923), slot 14 | **PASS** (durability 16) |
| F | item 50 (slot 8) is the superseded Stone Rod, at 0, grandfathered | **PASS** |

Balances read live: Athena 21, Archon 24, Crusader 27, Chobo 30, Overseer 42,
Summoner 42, **Foxglove 45**. Total **231**.

---

## PREDICTION 1 — the gear-break forecast. HIGH confidence, and it CUTS THE
## DUNGEON ARM FROM FOUR RUNS TO ONE.

Wear rate, measured n=4 last session: **−3 per run on exactly four pieces**
(slots 11, 12, 13×2), six unmoved.

| slot | item | durability now | runs to zero = floor(d/3) |
|---|---|---|---|
| 11 | 640 | 58 | 19 |
| 12 | 641 | 36 | 12 |
| 13 | 905 | 18 | 6 |
| 13 | **901** | **2** | **0 — breaks on RUN 1** |

**I predict item 901 (slot 13) reads 0 after dungeon run 1**, exactly as item
905 went 3 → 0 during session 123's run 2. Under the [USER] gear halt that
**stops the dungeon arm after run 1**, so this session plays **1 of the 4
authorised runs**, not 4.

Falsifiable three ways, and each would be a finding about the rate at n=4:
- 901 reads 2 → 0 after run 1 → **forecast holds**;
- 901 reads something other than 0 → the −3 rate or the wearing set is wrong;
- a piece outside {640, 641, 905, 901} moves → the wearing set is wrong.

**Interpretation flagged, not assumed:** the halt stops the DUNGEON arm only.
The four wearing pieces are dungeon slots; fishing uses 8/14/15. Fishing
proceeds after a dungeon gear halt. Stated so the user can correct it.

## PREDICTION 2 — the rod-break forecast. The fish-to-zero halt has NEVER been
## exercised and I predict it fires this session, at played cast 16.

Rod **923, slot 14, durability 16**. Rate **1.00 per PLAYED cast**, and today's
read corroborates it independently: session 123 recorded the rod at **40 and
unmoved across all four dungeon runs**, then played 24 casts; 40 − 24 = **16**.

**I predict the rod reaches 0 on played cast 16**, and the [USER] fish-to-zero
halt fires there.

Consequence worth stating in advance: 16 played < the server's 20-charge cap,
so **this session will NOT reach the server refusal** and will NOT produce a
third data point on where that refusal lands (24, then 25). That is a cost of
the halt, not a failure.

## PREDICTION 3 — the charge SHAPE, currently 25/25

Per run: **exactly one faction moves, exactly −3, the other six untouched.**
Today's faction is **Foxglove (139)**, read off the measured rotation table —
bookkeeping, not a discovery. One run takes the shape count to **26/26** and
Foxglove **45 → 42**.

---

## PREDICTION 4 — §71, and ⚠ THE GATE WAS ALREADY ANSWERABLE FROM COMMITTED
## FIXTURES. It cost zero casts, and §71's dichotomy is FALSE.

`scripts/redrawDeckSlice.ts` (new) slices the corpus by the deck the server
actually dealt — Dendren ids 91–100, Golkan 80–90, and a **third, earlier deck**
(base ids 1–7 + loot) that §71 does not know about. **The corpus straddles at
least TWO deck changes, not one.**

Computed on the corpus as committed, before this session's casts:

```
POOLED (all decks)   457 traces   b10 net 32   all3 net 32   MARGIN  0
LEGACY only          126 traces   b10 net  8   all3 net  1   MARGIN +7
GOLKAN only          307 traces   b10 net 23   all3 net 28   MARGIN -5
DENDREN only          24 traces   b10 net  1   all3 net  3   MARGIN -2
```

**§71 assumes the pre-swap corpus carried a positive margin that the rod swap
may or may not have destroyed. It did not.** The largest single-deck slice —
Golkan, 307 traces, 673 plays — is already **negative**. So both branches of
§71's dichotomy are mis-specified, and its nominated Dendren-only discriminator
would have returned "margin ≤ 0" and been read as "the collapse is the thesis"
for the wrong reason.

**Deck and policy era are confounded, so the decks were compared at CONSTANT
era.** The `focusDry` era is the one cell containing all three decks:

```
focusDry x legacy    12 traces   MARGIN  -1
focusDry x golkan   265 traces   MARGIN -16
focusDry x dendren   24 traces   MARGIN  -2
```

**Every deck is ≤ 0 at constant era.** The positive margin lives in the two
OLDER ERAS instead (preOil +6, oilSupplied +13, focusDry −19). So the K=10
separation tracks the POLICY ERA, not the rod.

**A mechanism was hypothesised and MEASURED AND REJECTED, recorded so nobody
re-proposes it.** I guessed the K=10 arm (`sweepWithBudget`, conditioned on
`budget >= 1`) collapsed because budget-zero plays became rare. Measured
budget-zero rates by era are **preOil 41.2%, oilSupplied 0.7%, focusDry 30.2%**
against margins **+6 / +13 / −19** — no monotone relation, and the era with
essentially no budget-zero plays has the LARGEST positive margin. **The
mechanism is NOT established and no explanation is offered.**

⚠ **Power.** The Dendren and legacy cells fire only 4–7 times; those margins are
not distinguishable from zero. **Only the Golkan −16 at 265 traces carries
weight.** The two arms are overlapping subsets of the same plays, so no p-value
is quoted.

⚠ **The pinned thresholds are K=10-with-budget and K=3-unconditional, fitted on
the POOLED corpus with oracle labels.** Slicing does not re-fit them. The claim
is "these pinned thresholds do not separate within any single deck", NOT "no
threshold separates".

**The forward prediction, which is what is actually pre-registered here:** this
session's casts take the Dendren slice from 24 to roughly 40 traces. **I predict
the Dendren-only margin stays ≤ 0** and does not reopen. If it goes positive at
n≈40 that contradicts the Golkan result at n=307 and is a finding.

⚠ **This resolves the DISCRIMINATOR; it does NOT retire the claim.** §71 needs a
**USER decision**, exactly as §70 did. The pinned assertion stays pinned.

---

## Standing constraints acknowledged

- Rule 11: one run, then stop and hand back. The brief's "4 runs authorised"
  does not repeal per-run approval; each `start_run` is asked in chat.
- Rule 8 governs in-room tier picks; entry tier is `--juiced-index=2`.
- Rule 13: any denied / blocked / interrupted live command is checked against
  the server ledger before it is believed, and never retried on a denial.
- Oils Relaxing-only; double-lethal disabled; Focus Oil off the allowlist.
- Catch rate is NOT raised as a concern and no study is commissioned.
- Corpus pins are updated only after the LAST fixture lands, never between runs.

---

# VERIFICATION — written AFTER the spend, against the pre-registration above

## PREDICTION 1 — the gear-break forecast: **HELD, exactly.**

Bracketed around the one dungeon run:

```
slot item   before  after  delta   forecast
  11  640      58     55     -3    -3  ✓
  12  641      36     33     -3    -3  ✓
  13  905      18     15     -3    -3  ✓
  13  901       2      0     -2*   BREAKS ON RUN 1  ✓   (* clamped at 0, not -1)
   2  109       1      1      0    unmoved ✓
   3  110      23     23      0    unmoved ✓
   6  204      10     10      0    unmoved ✓
   6  208      21     21      0    unmoved ✓
   8   50       0      0      0    grandfathered ✓
  15  954     4 / 9  4 / 9    0    unmoved by the DUNGEON ✓
```

**The gear halt fired on the forecast run.** No piece outside {640, 641, 905,
901} moved, so the wearing set is re-confirmed at n=5 runs. The only detail the
forecast did not state: **901 CLAMPS at 0 rather than going to −1**, so the
last step is −2, not −3. Recorded because `floor(d/3)` predicts the BREAK RUN
correctly either way but would mis-predict a durability READING.

## PREDICTION 2 — the rod-break forecast: **HELD, exactly.**

Rod 923: **16 → 0 over exactly 16 played casts**, −1.00/cast at all eight
checkpoints (16→14→12→10→8→6→4→2→0). The **fish-to-zero halt then FIRED for the
first time in this project's history** — `liveFishing.ts` exits 1 on the
preflight with *"rod 923 reads DURABILITY_CID 0 — it has RUN DRY"*, before any
POST.

The consequence stated in advance also held: **the rod bound before the server
cap.** 16 played / **12 charged** — JEBAITOR spared 4 — so the day still had 8
charged casts left when the rod ran out.

⚠ **BUT THE FURTHER CLAIM I DREW FROM THAT WAS WRONG, AND IS CORRECTED HERE.**
I wrote that this session would therefore get **"no third data point on where
the server refusal lands"**. It did. The user repaired the rod (0 → 40) and
authorised spending the remaining charged casts, and the day ran to the
server's own refusal after all:

```
▸ played cast 27 — HTTP 400
  {"success":false,"message":"Player has reached max runs for fishing"}
```

**The refusal now has three observations: cast 24 (s122), 25 (s123), 27 (s124)**
— it is not a fixed cast number, which is what JEBAITOR predicts, since the
refusal is keyed to 20 CHARGED casts and the played count floats above it.
The guard tripped closed on the rejection and nothing was retried.

**The lesson is about the forecast, not the number.** The forecast was right
about the rod and right that the rod would bind first; the error was treating
a halt as the end of the day rather than as a hand-back. Do not fold a
"therefore we cannot learn X" onto a correct prediction — the halt was a
question for the user, and the user answered it.

## PREDICTION 3 — the charge SHAPE: **HELD, exactly.**

```
139 Foxglove 45 -> 42   <-- the ONLY mover, -3
137 Athena   21 -> 21   138 Archon   24 -> 24   135 Crusader 27 -> 27
134 Chobo    30 -> 30   136 Overseer 42 -> 42   140 Summoner 42 -> 42
```

One faction, exactly 3, six untouched. **Shape count 25/25 -> 26/26.** The
faction matched the measured rotation table for dow 3, as bookkeeping.

## PREDICTION 4 — §71: the forward prediction **HELD**, and the user ruled HOLD.

Predicted: adding ~16 Dendren casts leaves the Dendren-only margin **≤ 0**.
Measured at n=40: **−4** (was −2 at n=24). It did not reopen.

**USER DECISION 2026-09-06: HOLD.** §71 stays OPEN and UNCHANGED — not retired,
not rescoped. The evidence is recorded in QUESTIONS.md as an addendum under the
open question. The pinned assertion stays a pin.

---

## What the forecasts did NOT cover, and had to be measured

**NEW: the FISHING wear set is slots 14 AND 15 — three pieces, all −1.00 per
PLAYED cast.** Over the first 16 casts: rod 923 16→0, 954(a) 20→4, 954(b) 25→9
— **−16 each**. Session 123 recorded slot 15 as "unmoved", but that bracket was
around DUNGEON runs, where it genuinely does not move.

**The two wear sets are DISJOINT and neither touches the other:**

```
DUNGEON  slots 11, 12, 13x2   -3 per RUN     (n=5 runs)
FISHING  slots 14, 15x2       -1 per CAST    (n=16 casts)
```

This is the half that makes a repair plan possible: **a rod-only repair does
not reopen a full fishing day**, because 954(a) sits at 4.

## Deviations from the brief, and why

- **The brief's Step 5 asked for four dungeon runs.** The gear forecast said
  the halt fires after run 1, and it did. **One run played, 3 of 12 run-units.**
  The user approved run 1 only, in chat, per rule 11.
- **`--casts=N` is silently overridden by `--oil-batch`** (`castCap: 2`), so the
  batch was run as repeated 2-cast invocations rather than one long batch. This
  was not a workaround but the safe shape: **the per-cast halt check does NOT
  read rod durability**, so a single long batch would have played past zero onto
  a dry rod, dealing `BASE_DECK` and injecting a third deck into the corpus
  mid-batch — precisely the confound §71 is about.
- **Fishing resumed after the halt on an explicit user go-ahead**, once the rod
  was repaired externally (0 → 40) during the dungeon run. Not assumed.

---

# RUN 2 — pre-registered BEFORE the spend (user go-ahead, "dungeon run 2 ready")

Fresh live read taken first, per the halt rule. **Item 901 repaired 0 → 26.**

⚠ **NEW OBSERVATION: a repair MINTS A NEW docId.** Item 901 went
`GearInstance#901_1788535524_cffcabf3` → `GearInstance#901_1788535524_373feb7b`.
**Anything keyed on docId across a repair will mis-track the piece** as a new
one. Recorded because `checkGear.ts` prints docIds and the durability ledger
writes them.

**Halt interpretation acted on, flagged for correction rather than assumed:**
three pieces read 0 — item 50 (grandfathered), and 954 ×2 in **slot 15**. Slot
15 is a FISHING slot, measured unmoved by dungeon runs in session 123 and again
today, and the pair broke doing the fishing the user authorised knowing they
would. **So they do not block the dungeon arm.** The dungeon-wearing set
(11, 12, 13×2) is whole.

## Predictions for run 2

1. **Gear.** −3 on the four dungeon pieces, nothing else moves, **no break**:
   `640 55→52`, `641 33→30`, `905 15→12`, `901 26→23`.
   Runs-to-zero after this run: 17 / 10 / 4 / 7 — so **905 is next to break,
   in 4 more runs**, and nothing breaks inside this one.
2. **Shape.** Foxglove (139) sole mover, **42 → 39**; other six unchanged.
   Shape count **26/26 → 27/27**.
3. **Ledger.** `dayProgressEntities` **3 → 6** of 12.
4. **Slot 15 stays at 0** and slot 14 stays at 30 — the dungeon does not touch
   fishing slots. This is the disjointness claim, tested a second time.

---

# RUN 2 — VERIFIED. All four predictions HELD exactly.

```
                    forecast          measured
gear 11 640         55 -> 52          52  ✓
gear 12 641         33 -> 30          30  ✓
gear 13 905         15 -> 12          12  ✓
gear 13 901         26 -> 23          23  ✓   (no break, as forecast)
rings   139         42 -> 39          39  ✓   sole mover, six unchanged
ledger              3 -> 6 of 12      6   ✓
slot 15 / slot 14   0 / 30 unmoved    0 / 30  ✓  DISJOINTNESS, 2nd test
```

Run 2: deepest room **8**, **0/57** first-attempt failures. Session dungeon
total so far: 2 runs, 6/12 run-units, **0/165** first-attempt failures.
Shape count **26/26 -> 27/27**.

# RUN 3 — pre-registered BEFORE the spend (user go-ahead: "Run 3, then ask again")

1. **Gear, −3 each, NO break:** `640 52→49`, `641 30→27`, `905 12→9`,
   `901 23→20`. After this run 905 sits at 9 = **3 more runs to zero**, so it
   still does not break inside run 4 either.
2. **Shape:** Foxglove (139) sole mover **39 → 36**; six unchanged.
   **27/27 → 28/28.**
3. **Ledger:** `dayProgressEntities` **6 → 9** of 12.
4. **Disjointness, third test:** slot 15 stays at **0**, slot 14 stays at **30**.

---

# RUN 3 — VERIFIED. 4/4 again.

```
gear 640 52→49 ✓   641 30→27 ✓   905 12→9 ✓   901 23→20 ✓   (no break, as forecast)
rings 139 39→36 ✓ sole mover, six unchanged        ledger 6→9 of 12 ✓
slot 15 = 0, slot 14 = 30 — unmoved ✓  (DISJOINTNESS, 3rd test)
```

Run 3: deepest room **7**, **0/58** first-attempt failures. Shape **27/27 → 28/28**.
Session dungeon: 3 runs, 9/12 run-units, **0/223** first-attempt failures.

# RUN 4 — pre-registered BEFORE the spend (user go-ahead: "go ahead run 4")

1. **Gear, −3 each, NO break:** `640 49→46`, `641 27→24`, `905 9→6`,
   `901 20→17`. 905 lands on 6 — **still two runs from breaking**, so the gear
   halt should NOT fire and the day should end on the run cap instead.
2. **Shape:** Foxglove (139) sole mover **36 → 33**; six unchanged.
   **28/28 → 29/29.**
3. **Ledger:** `dayProgressEntities` **9 → 12 of 12** — the day fully spent,
   and the SERVER should refuse any further run.
4. **Disjointness, fourth test:** slot 15 stays **0**, slot 14 stays **30**.
