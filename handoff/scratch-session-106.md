# scratch — session 106

## Part A — fishing cast: BLOCKED by the repo's own 252 budget (expected, brief §A.1)
- guard day 2026-08-27 (rollover 11:00 PT), 1.72h to reset at time of check
- GAME ledger dayDocs[pond 2] = 19/20 -> 1 cast available
- REPO ledger data/guard-budget-fishing.json = 19 casts / 252 energy
- config/bot.json dendren.dailyEnergyBudget = 252 -> EXHAUSTED
- `--dry-run --casts=1`: `Guard tripped: daily energy budget would be exceeded
  {"spent":252,"estimatedEnergyCost":12,"budget":252}`
- rod durability read live: **37** (repaired to 40 in s105, 3 casts played after) — NOT 40
- nextPosition override: "ARMED (no miss on record)" — still live, still unsigned-off (OQ1)
- This is open question 2 (JEBAITOR vs the 252 budget) firing for real. ASK-FIRST. Not bumped.
- Also seen: `data.nextPosition, data.nextMovePath` UNKNOWN FIELD on the terminal doc —
  EXPECTED per STATE.md, known since s26. Not a find.

## Part B — dungeon ledger before run 1
- `checkDungeonToday.ts`: dungeonId 5 dayProgressEntities = **null** -> 0 run-units today
- The only row present is `Dungeon#3` UINT256_CID 9, TIMESTAMP_CID 20692 — the USER's
  manual play in another dungeon (cap 9), NOT our allowance. DECISIONS 2026-08-27 (s103).

## Part B — RUN 1 (the first live Tier-1 entry this bot has ever sent)

run id **25165690**, log `logs/run-2026-08-28-16-24-40.jsonl`,
fixtures `fixtures/dungeon-runs/run-2026-08-28-16-24-42`

### start_run body — VERBATIM
```json
{"action":"start_run","dungeonId":5,"actionToken":"",
 "data":{"consumables":[131,131,131],"isJuiced":true,"index":1,
         "itemId":0,"expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}}
```
- `index: 1` ✓  `isJuiced: true` ✓  3x131 ✓
- **`inputItems` IS NOT A REQUEST FIELD.** The brief/TIER1-MEASUREMENT §6.3 asked to
  confirm `inputItems: []` in the body; there is no such key. It lives on
  `entryData[].inputItems` (the tier's COST): Tier 1 `[]`, Tier 2 and Tier 3 both 7 ids.
  Zero rings is a consequence of selecting tier 1, and is confirmed the right way:
  **no negative `gameItemBalanceChanges` anywhere in the run — nothing was debited.**
- **`dropMultiplier` is NOT returned on any run response** (0 occurrences in the log).
  It exists only on `entryData` in `config/discovered.json`: T1=1, T2=2, T3=4.
  §6.4's "don't assume 1 because the flag said 1" cannot be satisfied from the run;
  it is satisfied from the entry table + the payout itself (below).

### Ledger / gear / spend
- ledger `Dungeon#5`: **absent (0) -> 3**. Exactly +3 units. 9 remain (3 runs).
- gear at start_run, unbooned: **health currentMax 50 / shield currentMax 17** =
  the **50/17 arm**, i.e. session 103's RUN 4 arm. Same arm, not a new one.
- energy 142 -> 82, observed delta 60 = committed 60, no drift.
- potions 3/3 used. 34 POSTs (+1 start_run = 35), **0 first-attempt failures**.
- outcome: **death @ room 5**, so **rooms cleared r = 4** (tier-choice count = 4 = boon count = 4).

### PRE-REGISTERED VERDICT: **NOT SCORED**
`r = 4 < 6`, so TIER1-MEASUREMENT.md §4's validity condition FAILS. H/r = 1152/4 = 288
would read H1, and it is NOT being read that way. Recorded, not scored, not argued into one.

### Post-hoc, and it is STRONGER than the pre-registered statistic: ROOM-INDEX MATCHING
Hard Core is paid per room and the per-room amount is depth-dependent, so comparing
matched room INDICES removes the depth confound outright rather than normalising it.

| room | T3 r1 | T3 r2 | T3 r3 | T3 r4 | **T1 (today)** |
|---|---|---|---|---|---|
| 1 | 960 | 1152 | 1008 | 864 | **264** |
| 2 | 1152 | 1104 | 1200 | 912 | **300** |
| 3 | 1248 | 768 | 1248 | 1344 | **300** |
| 4 | 1152 | 1344 | 768 | 1104 | **288** |
| **1-4 sum** | 4512 | 4368 | 4224 | 4224 | **1152** |

- Tier-3 rooms 1-4 mean **4,332**; Tier-1 **1,152**; ratio **3.76**.
- The 16 Tier-3 room values and the 4 Tier-1 values are **completely disjoint**
  (T3 min 768, T1 max 300).
- **The quantum is the clean part.** Every Tier-3 room amount is divisible by **48**;
  every Tier-1 amount by **12** and none by 48. 48/12 = **exactly 4**.
  Bases (amount/quantum) are drawn from the same range: T3 rooms1-4 bases
  20,24,26,24 / 24,23,16,28 / 21,25,26,16 / 18,19,28,23 (mean 22.56);
  T1 bases 22,25,25,24 (mean 24.0).
  Model: **HC_room = base x 12 x dropMultiplier**. The 3.76 is base-sampling noise
  around an exact 4.

### NEGATIVE CONTROL (Dendren Root 846): PASSES, exactly
Per-room amounts, ALL FIVE runs, T3 and T1 alike: **5, 9, 14, 19, 25, 31, 37, 42**
— credited 3x per room (that x3 is how s103's table got 546 = 3 x 182).
Tier-1 rooms 1-4 = 3 x (5+9+14+19) = **141**, byte-identical to every Tier-3 run's
rooms 1-4. **Root did not move at all.** So the cut is specific to `dropMultiplier`,
not a general Tier-1 drop cut.

### CORRECTION to handoff/TIER1-MEASUREMENT.md §5
It fixed the control as "Root flat at ~62/room". **Root per room is NOT flat — it
GROWS with room index** (5,9,14,19,25,31,37,42, x3). The 62 was a depth-average of
session 103's runs and is confounded exactly the way §2 warned Hard Core per run was.
The control still passes, and passes far more sharply than the plan asked for, because
matched room indices are identical. Fix the ~62 rather than quoting it.

### Rule 8 audit, 4 tier choices
perpetualOffered 2/4; avoided at no cost 1; cost a tier 1; none at the final room
(died at 5 of 16). Boons taken: AddLuck, TieVulnerable, UpgradeScissor, AddIntuition
(the last via ORB FALLBACK, 24 HC of [24,13,18], ranker agreed).

### STOPPED HERE — rule 11. Run 2 needs its own go-ahead.

## Part B — RUN 2

run id **25165963**, log `logs/run-2026-08-28-16-47-35.jsonl`,
fixtures `fixtures/dungeon-runs/run-2026-08-28-16-47-36`

- `start_run` body IDENTICAL to run 1: `index: 1`, `isJuiced: true`, `consumables [131,131,131]`.
  Again **no `inputItems` key**, again **zero negative balance changes** — nothing debited.
- ledger `Dungeon#5` **3 -> 6**. +3. 6 units left (2 runs).
- gear unbooned **50/17** — UNCHANGED from run 1. Same arm across the batch, as briefed.
- energy 88 -> 29, **committed 60 vs observed 59** — the same 1-unit drift all four of
  session 103's runs reported, script's own regen explanation, guard enforced off committed.
- potions 3/3. 50 POSTs. **0 first-attempt failures.**
- outcome **death @ room 6 -> r = 5**. Boons 5, tier choices 5.
- boons: TieWeak, AddBlock, AddMaxArmor, AddMaxArmor, UpgradePaper.
  Rule 8: perpetual offered 1/5, cost a tier 1. **3 UNMODELLED types were OFFERED**
  (none picked); UNMODELLED_TYPES still 15.

### PRE-REGISTERED VERDICT: **NOT SCORED AGAIN** (r = 5 < 6)
H/r = 1452/5 = **290.4**, agreeing closely with run 1's 288 — and still not scored.
**Two runs, r = 4 and r = 5, both one and two rooms short of the validity bar.**

### Room-index matched, rooms 1-5
HC per room, T1 run 2: **288, 312, 228, 300, 324** = **1,452**
T3 rooms 1-5 sums: 5280 / 5712 / 5232 / 5376, mean **5,400**. Ratio **3.72**.
Quantum holds: all five divide by 12 (bases 24, 26, 19, 25, 27); four of five do NOT
divide by 48.
Pooled T1 bases now n=9: 22,25,25,24,24,26,19,25,27 -> mean **24.11**
against T3 rooms1-5 n=20 -> mean **22.5**. Same draw, different multiplier.

### NEGATIVE CONTROL: PASSES AGAIN, exactly
Root per room **5, 9, 14, 19, 25** (x3) = **216** — byte-identical to every Tier-3
run's rooms 1-5. Two for two.

## Part B — RUN 3 — **THE VALID ONE. r = 6. SCORED.**

run id **25166186**, log `logs/run-2026-08-28-17-10-27.jsonl`,
fixtures `fixtures/dungeon-runs/run-2026-08-28-17-10-28`

- `start_run` body identical again: `index: 1`, `isJuiced: true`, `[131,131,131]`,
  no `inputItems` key, **zero negative balance changes**.
- ledger `Dungeon#5` **6 -> 9**. +3. 3 units left (1 run).
- gear unbooned **50/17**, `pickedBoons` [] at start — THREE FOR THREE, one arm.
- energy preflight: pool **35 < 60 required -> claimed 1 ROM doc for 352 -> pool 387**.
  CLAUDE.md rule 12 working exactly as written; a raw endpoint read would have called
  this blocked.
- energy 387 -> 328, committed 60 / observed 59 (same 1-unit regen drift).
- potions 3/3. 58 POSTs. **0 first-attempt failures.**
- outcome **death @ room 7 -> r = 6**. Boons 6, tier choices 6.
- boons: AddEvasion, AddLuck, UpgradeRock, AddMaxHealth, AddMaxArmor, AddLuck.
  Rule 8: perpetual offered **5 of 6**, avoided at no cost 2, **cost a tier 3**.

### PRE-REGISTERED VERDICT: **H1 CONFIRMED**
`r = 6` meets TIER1-MEASUREMENT.md §4's validity condition.
Hard Core **1,560** / 6 rooms = **H/r = 260.0**.
Rule: **< 500 -> H1**. Predicted H1 centre was 266/room. **Observed 260.0.**
Nowhere near the 500-800 inconclusive band, nowhere near H0's 1,063.

### THE MATCHED PAIR — this is the cleanest comparison in the whole batch
Session 103's **run 4** cleared **exactly 6 rooms**, on the **same 50/17 gear arm**,
same 3/3 potions, same juiced status, differing ONLY in entry tier:

| | s103 run 4 (Tier 3) | s106 run 3 (Tier 1) | ratio |
|---|---|---|---|
| rooms cleared | 6 | 6 | — |
| gear (unbooned) | 50/17 | 50/17 | — |
| **Hard Core (845)** | **6,096** | **1,560** | **3.908** |
| H / room | 1,016.0 | 260.0 | 3.908 |
| **Dendren Root (846)** | **309** | **309** | **1.000** |

Root is identical **to the unit**. Hard Core falls **3.91x**. That is the negative
control and the effect in one paired observation.

### Per-room detail
HC: **252, 312, 276, 204, 240, 276** = 1,560. All divide by 12 (bases 21,26,23,17,20,23);
**five of six do NOT divide by 48.**
Root: **5, 9, 14, 19, 25, 31** (x3) = 309 — the same sequence for the fifth time.

Pooled Tier-1 bases across the 3 runs, n=15: mean **23.13**.
Tier-3 rooms 1-6 across the 4 s103 runs, n=24: mean **22.67**. Same draw.

## Part B — RUN 4 — also VALID (r = 9), and the DEEPEST run in the corpus arm

run id **25166314**, log `logs/run-2026-08-28-17-23-11.jsonl`,
fixtures `fixtures/dungeon-runs/run-2026-08-28-17-23-12`

- `start_run` identical: `index: 1`, `isJuiced: true`, `[131,131,131]`, no `inputItems`,
  **0 negative balance changes.**
- ledger `Dungeon#5` **9 -> 12. DAY FULLY SPENT (12/12).**
- gear unbooned **50/17** — FOUR FOR FOUR. One arm across the whole batch.
- energy 331 -> 272, committed 60 / observed 59.
- potions 3/3. 69 POSTs. **0 first-attempt failures — 0/208 across all four runs.**
- outcome **death @ room 10 -> r = 9**. Deeper than ANY of session 103's Tier-3 runs
  (max 8 cleared). Boons 9: CorrosiveShield, AddBurnSword, AddIntuition, AddBlock,
  AddMaxArmor, AddMaxHealth, AddEvasion, UpgradeRock, **BurnMastery** (priority rank 1).
  Rule 8: perpetual offered 4/9, cost a tier 2.
- HC per room **168, 180, 264, 264, 264, 264, 276, 300, 288** = **2,268**
  (bases 14,15,22,22,22,22,23,25,24; **8 of 9 NOT divisible by 48**)
- Root per room **5, 9, 14, 19, 25, 31, 37, 42, 47** (x3) = **687**.
  Rooms 1-8 = 546, byte-identical to s103 runs 1 and 2. **Room 9's 47 EXTENDS the
  sequence one room beyond anything Tier-3 ever captured.**

### PRE-REGISTERED VERDICT: **H1 CONFIRMED, second valid run**
H/r = 2268/9 = **252.0**. Rule: < 500 -> H1.

---

# BATCH SUMMARY — 4 runs, 12/12 units, 240 energy, 0 rings, 0 failures

| run | id | death | **r** | HC | H/r | Root | valid? | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | 25165690 | 5 | 4 | 1,152 | 288.0 | 141 | NO (r<6) | not scored |
| 2 | 25165963 | 6 | 5 | 1,452 | 290.4 | 216 | NO (r<6) | not scored |
| 3 | 25166186 | 7 | **6** | 1,560 | **260.0** | 309 | **YES** | **H1** |
| 4 | 25166314 | 10 | **9** | 2,268 | **252.0** | 687 | **YES** | **H1** |
| tot | | | 24 | 6,432 | | 1,353 | | |

## Pooling the two valid runs — legitimate, and stated as the plan required
H/r 260.0 vs 252.0: spread **3.1%**, against an H1/H0 gap of **300%**. Orders of
magnitude apart, so pooling is safe by the same argument §3 used for the gear arms.
**Pooled valid H/r = 3828/15 = 255.2.** Predicted H1 centre **266**. 

## The definitive statement — ALL rooms, and it removes depth entirely
Payout is `base x 12 x dropMultiplier`, so divide out the multiplier and compare BASES:

|  | rooms | HC total | quantum | base units | **mean base** |
|---|---|---|---|---|---|
| **Tier 3** (s103, 4 runs) | 29 | 30,960 | 48 | 645 | **22.24** |
| **Tier 1** (s106, 4 runs) | 24 | 6,432 | 12 | 536 | **22.33** |

**The base draw is the same to within 0.4%. The whole difference is the multiplier.**
Naive HC/room: 1,067.6 (T3) vs 268.0 (T1) -> ratio **3.984**.
30960 = 48 x 645 exactly; 6432 = 12 x 536 exactly.

## NEGATIVE CONTROL — passes on all four runs, and it is EXACT not approximate
Root per room is the SAME depth-indexed sequence in every run of both tiers:
**5, 9, 14, 19, 25, 31, 37, 42, 47**, credited 3x. Matched by room index it is
identical to the unit, T1 and T3 alike. Root did not move. So the cut is SPECIFIC
to `dropMultiplier`, not a general Tier-1 drop cut — the exact discrimination
TIER1-MEASUREMENT.md §5 was built to make.

## The single cleanest observation: the MATCHED PAIR
s103 run 4 and s106 run 3 — both r=6, both gear 50/17, both 3/3 potions, both juiced,
differing ONLY in entry tier:
**HC 6,096 -> 1,560 (3.908x down). Root 309 -> 309 (unchanged, to the unit).**
