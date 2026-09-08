# SESSION 125 — 2026-09-08 — day 20703 (dow 4, Summoner)

Full detail. STATE.md carries the summary; this file carries the dumps.

# SCRATCH — session 125 — day 20703 (dow 4, Summoner)

Pre-registration. Written and committed BEFORE anything is spent.
Live reads at 2026-09-08T05:50–05:52Z. All numbers below are computed from the
LIVE read, never from the brief.

---

## Step 0 — JWT (the brief's THIRD ask; two sessions dropped it)

`scripts/doctor.ts`: **token valid for another 106.8h** (~4.45 days), 1728 chars.
Authenticated as `<USER>`. Runway is not short; no need to warn the user before
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

---

## RUN 1 — died room 9. All forecasts held.

`dayProgressEntities` **3** (0 -> 3 of 12). **0/57 first-attempt failures.**
Energy 155 -> 96 (committed 60, observed 59; the usual in-run passive-regen drift).

- **P1 HELD:** Summoner **42 -> 39**, sole mover, exactly -3. Six untouched
  (Athena 21, Archon 24, Crusader 27, Chobo 30, Foxglove 33, Overseer 42).
- **P3 HELD:** 640 46->43, 641 24->21, 901 17->14, 905 24->21. All exactly -3.
- **Disjoint wear sets re-confirmed a 5th time:** rod 923 still **30**,
  slot-15 pair still **25 / 30**. A dungeon run moves no fishing gear.
- Rule 8 fired on all 8 rooms; no Perpetual filter this run.

### The "1 UNMODELLED boon picked" flag resolves to nothing new
The run banner said *"8 type(s) picked, 1 of them still UNMODELLED (first-ever
candidates)"*. Resolved by checking the 8 picks against `BOON_MODELS`: it is
**`VulnerableMastery`**, already a KNOWN held boon (STATE open question 5).
`UNMODELLED_TYPES` is **unchanged at 13**. **No new boon type, so no new user
directive is needed** — the banner's "first-ever candidate" wording is about
this RUN, not about the corpus.

---

## ⭐ USER STATEMENT, and the CORPUS CONFIRMS IT — intuition is an INFORMATION
## effect, not a mitigation, and THE SERVER NAMES THE BLOCKED MOVE

**User, in chat, 2026-09-08 (ground truth, not derived):** *"there is also now a
0.5% chance to proc Intuition which rules out one of the enemies moves for the
next turn."*

Checked against `fixtures/dungeon-runs` immediately (rule 9). It holds, and the
corpus adds the mechanism the statement did not have to give:

```
files with intuitionProc0:true AND blockedMove   18
files with intuitionProc0:true ONLY               0
files with blockedMove ONLY                       0
```

**PERFECT 18/18 co-occurrence, zero on either side alone.** The event is:

```json
{ "type": "intuition_block", "value": "rock", "playerId": 1,
  "data": { "blockedMove": "rock" } }
```

- **`playerId` is 1 on all 18 — never 0.** It is the ENEMY's move that is
  removed, exactly as the user said.
- **The server NAMES the move**: `blockedMove` = rock 8 / scissor 6 / paper 4
  (18 total).

### ⭐ THIS EXPLAINS SESSION 124'S FINDING RATHER THAN CONTRADICTING IT
Session 124 established *"intuition never mitigates on its own"* and treated it
as a durable claim with no counterexample. That is now **explained**: intuition
is not a mitigation mechanic at all, so there was never damage reduction to
find. The old claim and the new mechanism are the same fact seen from two sides.

### The proc RATE — do not read a contradiction into it
Corpus: **18 true / 8148 `intuitionProc0` rows = 0.221%.** The user says it is
**0.5% NOW**. These are consistent with the rate having been RAISED recently
(the JEBAITOR precedent: a skill `value` climbing 2.25 -> 6.75 -> 15.75 across
sessions). **The corpus rate is historical and must not be quoted as current.**

### ⚠ ACTIONABLE, BUT NOT THIS SESSION — rule 4
`blockedMove` is consumed **NOWHERE** in `src/`. Verified: the only mentions of
intuition machinery outside the sim are `scripts/procEvidence.ts` (which counts
`intuition_block` events but ignores the payload) and `scripts/procEffectSize.ts`.
**The opponent model does not zero out a move the server has told us the enemy
cannot play.** That is a real, free EV improvement sitting unused.

**It is NOT being implemented live today.** Changing live move selection is
exactly CLAUDE.md rule 4 — sim against fixtures first. Two caveats for whoever
picks it up:

1. **Scope the duration.** The user says "for the NEXT turn". The event is
   emitted in the same batch as the current exchange's `OnDamage`, so whether
   the exclusion applies to the current resolution or only the following one is
   **NOT settled by the fixtures** and must be measured, not assumed.
2. **The EV is small by construction.** At 0.22–0.5% of exchanges this can
   change at most a handful of decisions per session. Worth doing for
   correctness; **not worth spending a run to measure.**

---

## RUNS 2–4 and the DUNGEON ARM CLOSE — 12/12, every forecast held EXACTLY

| run | death room | first-attempt failures | perpetual filter fired | Summoner |
|---|---|---|---|---|
| 1 | 9  | 0/57 | 0 | 42 -> 39 |
| 2 | 11 | 0/88 | 1 (room 9) | 39 -> 36 |
| 3 | 7  | 0/49 | 4 | 36 -> 33 |
| 4 | 13 | 0/90 | 3 | 33 -> 30 |

**TOTAL 0/284 first-attempt action failures.** `dayProgressEntities` 12/12.
Energy 240 guard-tracked.

### Forecast scorecard — dungeon
- **P1 HELD 4/4.** Summoner sole mover every run, exactly -3, six untouched.
  Charge shape now confirmed on four more runs.
- **P2 HELD.** Athena stays scarcest at **21**. Summoner ends at **30**, tied
  with Chobo, exactly as predicted. Total **219 -> 207**.
- **P3 HELD 4/4, including the reversal of the brief.** Final: 640 **34**,
  641 **12**, 905 **12**, 901 **5** (lowest, exactly the predicted value).
  **NO dungeon piece broke and the gear halt did NOT fire** — which is what
  P3 predicted against the brief's "905 breaks on run 2".
- **Disjoint wear sets, 4 more confirmations.** Rod 923 read **30** after every
  single run; slot-15 pair read **25 / 30** after every single run. Four dungeon
  runs moved zero fishing durability.

Closing balances: Athena 21, Archon 24, Crusader 27, Chobo 30, **Summoner 30**,
Foxglove 33, Overseer 42 = **207**.

---

## FISHING — 24 PLAYED / 20 CHARGED. The CHARGED CAP bound, NOT a server refusal.

13 `--oil-batch` invocations, `castCap: 2` each, run as repeated small batches
exactly as the brief required. **The user stopped the session at the cap; a 13th
batch was NOT run** (verified against the ledger — see below).

```
casts PLAYED   24        catch rate 13/24 = 54.2%
casts CHARGED  20/20     Hard Core 6,400   Dendren Root 0
JEBAITOR spared 4 (16.7%)
rod 923:  30 -> 6   (-1.00/cast over 24 casts, EXACT, every batch)
slot 15:  25 -> 1  and  30 -> 6
oils: Relaxing 34 -> 29 (5 consumed), Focus 0 throughout (policy-withdrawn)
```

Fish: Infused Sediment (Epic) x8, Finley x2, Jelloid x2, Barnaboo x1.

### Forecast scorecard — fishing. P4/P5 RATES exact; P6/P7 NOT TESTED.

- **P4 (rod -1.00/played cast) HELD EXACTLY**, on all 12 batches, no drift.
  30 - 24 = **6**, which is what the server reads. The rod did **not** reach 0;
  the day ended 6 casts short of it.
- **P5 (slot 15 wears at the same rate and breaks 5 casts BEFORE the rod)** —
  the **RATE is confirmed exactly** (25 - 24 = **1**, 30 - 24 = **6**), so the
  slot-15 piece sits **one cast** from 0 with the rod still at 6. The **BREAK
  EVENT was not reached**, so P5's ordering claim is **un-falsified but not yet
  demonstrated**. It will fire on the first cast of the next fishing day.
- **⚠ P6 / P7 FAILED TO BE TESTABLE, and this is the session's one real miss.**
  Both predicted the **server's refusal** would land in casts 24–29 and end the
  batch. **No refusal occurred.** The **GAME's charged ledger hit exactly 20/20
  at 24 played**, and `checkFishingCaps.ts` returned `BLOCKED — cap spent`
  BEFORE any refusable cast was attempted. **There is NO fourth data point on
  the refusal boundary this session.** The boundary sequence stays 24, 25, 27.

### ⭐ WHY the refusal did not appear, and it is JEBAITOR, not a change

The refusal is only reachable when JEBAITOR spares enough casts that PLAYED runs
ahead of CHARGED far enough to attempt a 21st+ charged cast. This session
JEBAITOR spared **4 of 24 = 16.7%**, so 24 played landed on exactly 20 charged
with nothing left over. Prior sessions spared more and therefore probed past the
cap. **A session with no refusal is NOT evidence the refusal moved or went
away** — it means the spare rate was too low to reach it. Do not read the
missing data point as a change in the boundary.

### ⚠ A LEDGER FIELD THAT READS WRONG IF SKIMMED
`checkFishingCaps.ts` prints `REPO ledger: 20 casts, 288 energy`. **288 / 12 =
24, not 20.** The repo's cast counter tracks **CHARGED** casts while its energy
counter tracks **PLAYED** ones. Both are correct; they count different things.
Anyone dividing that energy by 12 to cross-check the cast count will think the
ledger is broken. Noted, not changed.

### Rule 13 discharge — the interrupted 13th batch
The user interrupted batch 13 before execution. **Per rule 13 the ledger was
read rather than trusted:** `dayDocs` still **20/20**, repo ledger still 20 casts
/ 288 energy, rod still **6**, slot-15 still **1**, `dayProgressEntities` still
**12**. **Nothing ran.** The denial and reality agree this time.

---

## ECONOMY — the day

```
DUNGEON  4 juiced Tier-2 runs, 12/12 run-units, 240 energy
         Hard Core 19,608   Dendren Root 2,874
         death rooms 9 / 11 / 7 / 13
         cid 25422936 (r9, HC 4512) 25434003 (r11, 5736)
             25434376 (r7,  2904)   25435344 (r13, 6456)
FISHING  24 played / 20 charged, 288 energy
         Hard Core 6,400    catch 13/24 = 54.2%
DAY      Hard Core 26,008   Dendren Root 2,874   energy 528
```

## Final gear — for the next session's forecast
```
slot 11  640  34   (11 runs)      slot 14  923   6   <- 6 casts
slot 12  641  12   (4 runs)       slot 15  954   1   <- ⚠ BREAKS ON CAST 1
slot 13  901   5   (1 run)  <- ⚠  slot 15  954   6   <- 6 casts
slot 13  905  12   (4 runs)       slot  8   50   0   grandfathered
```
**901 at 5 breaks on run 2 next session** (5 -> 2 -> 0 at -3/run). **The
slot-15 piece at 1 breaks on the FIRST played cast.** Both are repairs worth
raising with the user BEFORE the next day starts.

---

## RECAP-TIME WORK — the corpus re-pin, in detail

The day's 4 runs and 24 casts moved the corpus **125 -> 129 dungeon attempts**
and **483 -> 507 fishing casts**, which broke **64 assertions across 14 files**.
Pinning was done ONLY after 12/12 run-units and the 20/20 cast cap were spent,
per the standing rule.

**Method, recorded because it is reusable.** A throwaway Node script parsed
vitest's own failure output (`expected X to be Y`, `to be close to`, `to have a
length of`, and array `to deeply equal`) and rewrote the literal at the reported
`file:line`. Run in a loop it converged 64 -> 40 -> 23 -> 16 -> 5. Two details
mattered:

- **`chaiConfig.truncateThreshold: 0`** via a temporary `vitest.full.config.ts`
  (deleted at the end) — without it vitest truncates arrays to `…(613)` and the
  received values cannot be recovered from the output.
- **The auto-repin only fires when the old literal appears EXACTLY ONCE on the
  line.** Every ambiguous case was left for a human. That is what surfaced the
  three crossed bounds and the two crit anomalies instead of silently
  overwriting them.

**Twelve edits were made by hand** because they were not pins:

1. `procEffectSize` — the intuition FILTER, completed (below).
2. `stateFields` — two crit anomalies registered, plus the `observed` ratio rows
   and the `corrected.crits` 110 -> 113.
3. `damageEconomy` — two crossed bounds converted to pins.
4. `movePath` — one crossed bound converted to a pin.
5. `statusEffects` — the sixth BurnMastery pair `16/8`.
6. `redrawCounterfactual` — the K=10 / all3 margin block.
7. `liveFishing.ts` — `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` 2.4 -> 2.3.
8. `boons.ts` — 36 new `OBSERVED_OFFERS` rows.
9-12. Four sorted-census list appends (boons, enemies, oilReachability,
   fishingCorpus), inserted in sorted position so the attached per-entry
   comments survived.

---

## THE INTUITION FILTER, COMPLETED A THIRD TIME — full working

The failing assertion was `expect(ex.taken[0]).toBe(ex.atk[1])` — "intuition
never mitigates damage on its own". The counterexample:

```
atk [12, 33]   taken [24, 12]   moves [scissor, scissor]   outcome 0 (TIE)
flags: intuitionProc0   <- the ONLY flag set
```

33 ATK landing as 24. Before touching the claim, the whole no-block/no-evade
population was scored:

```
taken === atk                      241
taken === floor(atk * 0.75)         73    <- the 33 -> 24 row lives here
neither                             13    <- 11 of them crits (taken > atk)
```

Split by whether intuition fired:

```
TIES     + intuition   full=3   reduced=1
TIES,   no intuition   full=118 reduced=47
NON-TIES (no i/b/e)    full=120 reduced=38
```

**The 25% reduction is everywhere and has nothing to do with intuition** — it
fires 73 times, 72 of them with no intuition proc. The claim survives; the
filter was incomplete for the third time (session 124 completed it for
`evadeProc0`; CLAUDE.md rule 9 says to expect a third).

The assertion is now STRICTLY STRONGER than before: an intuition exchange must
land in one of the same buckets a non-intuition exchange lands in, i.e. it never
opens a mitigation bucket of its own. The population itself is pinned alongside
so a future corpus cannot quietly reclassify the middle bucket as an intuition
effect.

⚠ **The 25% mitigator carries NO proc flag and is UNIDENTIFIED.** It is not
fitted here. 73 unexplained exchanges is the largest single regularity left in
the combat corpus and it is answerable offline.

---

## THE INTUITION MECHANIC — user statement and corpus confirmation

See the scratch section above for the full working. Summary:

```
files with intuitionProc0:true AND blockedMove   18
files with intuitionProc0:true ONLY               0
files with blockedMove ONLY                       0
intuition_block events by playerId            {"1": 18}
blockedMove values          rock 8, scissor 6, paper 4
```

Event shape:

```json
{ "type": "intuition_block", "value": "rock", "playerId": 1,
  "data": { "blockedMove": "rock" } }
```

`blockedMove` is referenced **nowhere in `src/`**. `scripts/procEvidence.ts`
counts `intuition_block` events and discards the payload;
`scripts/procEffectSize.ts` reads only the boolean flag. **The opponent model
therefore keeps a full three-way distribution over a move the server has already
said cannot be played.**

---

## GEAR — every reading of the day

```
                open   r1   r2   r3   r4    after fishing (24 casts)
slot 11  640      46    43   40   37   34            34
slot 12  641      24    21   18   15   12            12
slot 13  901      17    14   11    8    5             5
slot 13  905      24    21   18   15   12            12
slot 14  923      30    30   30   30   30             6
slot 15  954      25    25   25   25   25             1
slot 15  954      30    30   30   30   30             6
slot  8   50       0     0    0    0    0             0   (grandfathered)
```

The two columns are the whole disjointness finding in one table: the dungeon
block is flat across the fishing batch and the fishing block is flat across all
four runs.

---

## THE 12 FISHING BATCHES

Every one exited on `cast_cap` (the intended exit), 2 casts each, rod delta
exactly -2 per batch:

```
batch  rod after  charged total
  1       28            1
  2       26            3
  3       24            4     (2 oils)
  4       22            6     (1 oil)
  5       20            8
  6       18            9     (1 oil)
  7       16           11
  8       14           13
  9       12           15     (1 oil)
 10       10           16     (1 oil)
 11        8           18
 12        6           20     <- cap reached exactly
```

24 played, 20 charged, 4 spared by JEBAITOR (16.7%). `checkFishingCaps.ts` then
returned `BLOCKED — cap spent`. A 13th batch was interrupted by the user before
execution and the ledger confirmed nothing ran.
