# session 106 — 2026-08-28 — 1 fishing cast (BLOCKED) + 4 juiced Tier-1 dungeon runs (GATE PASS)

Brief: `handoff/next.md`, session 106. Two parts. **Part A did not run and was
right not to. Part B is a GATE PASS and answers the pre-registered question.**

Live spend: **4 juiced Tier-1 dungeon runs, 12/12 run-units, 240 energy
committed, 0 gold or silver rings, 0 fishing casts, 0 oils.**

---

## 0. Headline

**H1 CONFIRMED: `dropMultiplier` governs Hard Core (845) and only Hard Core, at
an exact 4:1 quantum. Dendren Root (846) does not move.** Full write-up in
`handoff/TIER1-RESULT.md`; this log carries the operational detail.

This answers session 105's open question 3 ("should the first live Tier-1 run be
run") — yes, and one valid run settled it, exactly as
`handoff/TIER1-MEASUREMENT.md` predicted it would.

**The "~quarter of Tier-3" figure is now MEASURED and may be quoted as observed.**
That constraint (DECISIONS 2026-08-27; TIER1-MEASUREMENT §7) lifts here and
nowhere earlier. The honest number is **4x exactly**.

---

## 1. Part A — the fishing cast, blocked

Checked all three axes the brief asked for rather than carrying session 105's
numbers forward, and the third one moved:

- `checkFishingCaps.ts`: guard day 2026-08-27, 1.72 h to rollover.
  **GAME `dayDocs[pond 2]` = 19/20 -> 1 cast available.**
- Repo ledger `data/guard-budget-fishing.json`: 19 casts / **252 energy**
  against `dendren.dailyEnergyBudget` **252**. Exhausted.
- **Rod durability read 37, not the 40 the digest recorded.** Repaired to 40 in
  session 105, then three casts were played after the repair. Worth having
  actually read.

`--dry-run --casts=1`, per rule-4 discipline:

```
✗ Guard tripped: daily energy budget would be exceeded
  {"spent":252,"estimatedEnergyCost":12,"budget":252}
```

**Correct fail-closed behaviour, surfaced and not bypassed.** Raising the budget
is on CLAUDE.md's ask-first list; the brief said so explicitly and it was not
self-approved. This is session 105's open question 2 costing a real cast — see
§7.

Also seen and NOT reported as a find: `data.nextPosition` / `data.nextMovePath`
flagged `UNKNOWN FIELD` on the terminal doc. Known since session 26, ~1-2% of
responses, already in STATE.md.

The `nextPosition` override still prints **ARMED**. No fishing happened, so
nothing new was learned about it; it is carried unchanged as open question 1.

---

## 2. Part B — the four runs

Each was authorised individually. The user was asked four separate times and
said yes four times. Rule 11's "approval for one run is never approval for the
next" was honoured literally: the session stopped and reported after every run.

| # | run id | outcome | **r** | Hard Core | Dendren Root | POSTs | 1st-attempt failures | potions | boons | tier choices |
|---|--------|---------|---|-----------|--------------|-------|----------------------|---------|-------|--------------|
| 1 | 25165690 | death @ room 5 | 4 | 1,152 | 141 | 35 | 0 | 3/3 | 4 | 4 |
| 2 | 25165963 | death @ room 6 | 5 | 1,452 | 216 | 50 | 0 | 3/3 | 5 | 5 |
| 3 | 25166186 | death @ room 7 | **6** | 1,560 | 309 | 58 | 0 | 3/3 | 6 | 6 |
| 4 | 25166314 | death @ room 10 | **9** | 2,268 | 687 | 69 | 0 | 3/3 | 9 | 9 |
| | | **4 deaths** | **24** | **6,432** | **1,353** | **212** | **0** | **12/12** | **24** | **24** |

**Ledger read before run 1 and after every run: 0 -> 3 -> 6 -> 9 -> 12.** Exactly
+3 each, and the day ended at the 12/12 ceiling.

**Energy: every run reported 60 committed, and runs 2, 3, 4 observed 59** — the
same 1-unit gap all four of session 103's runs reported, with the script's own
in-run-regen explanation. Run 1 observed 60. Guard enforced off committed spend.

### 2a. The `start_run` body, identical on all four

```json
{"action":"start_run","dungeonId":5,"actionToken":"",
 "data":{"consumables":[131,131,131],"isJuiced":true,"index":1,
         "itemId":0,"expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}}
```

`index: 1` ✓ `isJuiced: true` ✓ 3x131 ✓ — read off the logged request, not
inferred from the flag.

**`inputItems` is not a field here.** See TIER1-RESULT §"§6's capture list".
Zero rings is confirmed the sound way instead: **zero negative
`gameItemBalanceChanges` across all four runs — nothing was debited.**

### 2b. Ledger trap re-confirmed

At session start `dungeonId 5` read `null` while a `Dungeon#3` row sat at
**9**. That is the user's manual play in a different dungeon (cap 9), not our
allowance — DECISIONS 2026-08-27, session 103. `findRealRunsToday` keys on
`#Dungeon#5` and was right.

### 2c. Rule 12 exercised for real

Run 3's energy preflight: **pool 35 against 60 required -> claimed 1 ROM doc for
352 -> pool 387**, then ran. A raw `GET /offchain/player/energy` read would have
called this blocked, which is the session-58 failure the rule exists to prevent.

### 2d. Rule 8 audit, all 24 choices

Perpetual offered on **12 of 24 (50.0%)** — above rule 8's stated 35% and above
session 103's 41.4%. Avoided at no tier cost 5 times; **cost a tier 7 times**.
Run 3 alone was offered a Perpetual in 5 of its 6 rooms.

### 2e. Loadout: the "steady going forward" ruling, confirmed

**All four runs opened on `50/17` with `pickedBoons: []`**, read off each run's
own `start_run` response. Byte-identical to session 103 run 4's start. This is
the first positive confirmation of DECISIONS 2026-08-27's ruling, and it makes
the four runs **one arm** — which is what licenses pooling their payouts.

Five new census combos appeared and every one was chased, because that same
ruling made a new combo a signal rather than expected drift:

```
run 2  state-044  50/17 -> 50/25  AddMaxArmor(+8)
run 2  state-076  50/25 -> 50/27  AddMaxArmor(+2)
run 3  state-056  50/17 -> 58/17  AddMaxHealth(+8)
run 3  state-088  58/17 -> 58/27  AddMaxArmor(+10)
run 4  state-070  50/17 -> 50/27  AddMaxArmor(+10)
run 4  state-084  50/27 -> 64/27  AddMaxHealth(+14)
```

All boon growth off an unchanged start. **⚠ `AddMaxArmor` is not a flat +2** —
the table's earlier entries were written around +2 pickups; +8 and +10 both
appear here, and `AddMaxHealth` shows +8 and +14. Read `selectedVal1`.

---

## 3. The measurement

Full treatment in `handoff/TIER1-RESULT.md`. In brief:

- **Scored: runs 3 and 4 only.** H/r **260.0** and **252.0** against a
  pre-registered `< 500 -> H1` and a predicted H1 centre of **266**.
- **Runs 1 and 2 gave the same answer (288.0, 290.4) and were not scored**,
  because `r >= 6` was fixed in advance.
- **Pooling checked before use**: the two valid runs are 3.1% apart against a
  300% hypothesis gap. Pooled **255.2**.
- **The exact result.** Tier-3's per-room amounts all divide by 48, Tier-1's all
  by 12. `30,960 = 48 x 645` (mean base 22.24) and `6,432 = 12 x 536` (mean base
  **22.33**). **Same base draw to within 0.4%; the whole difference is the
  multiplier.**
- **Matched pair** (s103 run 4 vs s106 run 3, both r=6, both 50/17):
  **HC 6,096 -> 1,560; Root 309 -> 309.**
- **Negative control passes exactly** and TIER1-MEASUREMENT §5's "~62/room flat"
  is corrected: Root grows with room index (5, 9, 14, 19, 25, 31, 37, 42, 47,
  x3) and matches to the unit across tiers.

---

## 4. Suite: three failures, all re-derived rather than bumped

Final: **2092 passed / 2092, 111 files.** `tsc --noEmit` clean.

### 4a. `procEffectSize` — the one that was a real question

`the null — damage taken equals the attacker's currentATK on the overwhelming
majority` failed at **604/688 = 87.79%** against `> 0.9`.

**The mechanic is fine and the old comment already contained the whole
explanation** ("the misses all carry a non-empty `statusEffects` array"). Nobody
had measured it directly. Measured:

```
slice (20 run dirs, 663 exchanges)
  overall      604/688  = 87.79%
  statusCLEAN  280/280  = 100.00%   <- zero misses
  statusDIRTY  324/408  = 79.41%
FULL corpus (2263 exchanges)
  overall      2514/2649 = 94.90%
  statusCLEAN  1645/1645 = 100.00%  <- zero misses, ever
  statusDIRTY   869/1004 = 86.55%
```

So the old figure was measuring **slice composition**, not the rule. The
status-dirty share of the bounded 20-run slice rose to **59.3%** (against 37.9%
full-corpus) because this session's boons were status-heavy — CorrosiveShield,
AddBurnSword, BurnMastery, TieWeak, TieVulnerable.

Fix, and it is the session-105 `deckShuffle` lesson in a different shape: assert
the invariant on the population it actually holds over, and make it **exact**.
`expect(cleanMisses).toEqual([])` is strictly stronger than `> 0.9` and cannot be
satisfied by a favourable mix. The mixed rate is still computed and reported,
deliberately **not** asserted at a meaningful threshold.

### 4b. `boons.test.ts` — +24 offers, one new unmodelled type

`OBSERVED_OFFERS` gained the corpus's **first-ever Tier-1 offers**, 24 of them
(4+5+6+9). Offer SHAPE is unchanged by the entry tier: still exactly 3 options,
one offer per cleared room, rooms 1..9, `Math.max(room)` still 9.

`UNMODELLED_TYPES` **15 -> 16**: **`VulnerableTenacity`** moved IN, offered for
the first time in run 4's room-3 offer (`AddMaxArmor(8) | VulnerableTenacity(4) |
UpgradeRock(0,4)`) and not picked. None moved out. The four runs offered
already-listed unmodelled types 6 times between them — **the entry tier does not
appear to narrow the reward pool**, which is worth knowing given it changes the
payout.

`roomOne.length` **231 -> 243** (+12 = 4 runs x 3 room-1 options). The clean TYPE
set assertion was left untouched and still passes — so "this table is closed
under the only mechanism feeding it" now holds through a change of ENTRY TIER,
the first time it has been tested against one.

### 4c. `tests/enemies.test.ts` — +5 combos, no new starting loadout

Covered in §2e. The important half is the negative: the census caught nothing.

---

## 5. Surprises worth keeping

- **The Root sequence is depth-indexed and triple-credited.** `5, 9, 14, 19, 25,
  31, 37, 42, 47`, three identical entries per room. That x3 is how session
  103's table got 546 = 3 x 182 — a reader summing distinct entries gets a third
  of the truth.
- **Hard Core has a visible quantum.** It is not a continuous roll: 48 at Tier
  3, 12 at Tier 1. This was not predicted and is what turns a noisy ratio into
  an exact one.
- **Session 103's four Tier-3 runs cleared 8, 8, 7, 6 rooms; this session's four
  Tier-1 runs cleared 4, 5, 6, 9.** Deeper on the best run, shallower on the
  worst. Nothing here separates that from variance and **no depth claim is
  made** — entry tier is not asserted to affect difficulty.
- **`dropMultiplier` is returned nowhere in a run.** It lives only on
  `entryData` in `config/discovered.json`.

## 6. Dead ends

- **Do not re-run the Tier-1 measurement.** Two valid runs agreeing to 3.1%,
  an exact quantum, and a matched pair. More runs add corpus, not evidence.
- **Do not "fix" a falling MIXED-population null rate.** It is composition-bound
  by construction. The clean-population invariant is the real one and it is
  exact at 1645/1645.
- **Do not score a run with `r <= 5`,** even when it gives the right answer.
- **Do not read `Dungeon#3` at 9 as our spend.**
- **Do not quote a Tier-3/Tier-1 ratio (3.72, 3.91, 3.98, 4.47) as the effect
  size.** Quote the quantum: exactly 4.

## 7. Open questions

1. **`nextPosition` override live with no sign-off.** Unchanged from session
   105; no fishing this session, so no new evidence either way.
2. **The 252-energy fishing budget cost a real cast today.** 252 = 21 x 12 was
   chosen so it could "never buy a cast the server would not already refuse";
   JEBAITOR (~9% of casts free) breaks that premise, and the game offered a 20th
   cast the repo could not fund. Raise it or accept the loss? Ask-first, not
   touched.
3. **Is Tier-1 now the baseline for everything downstream?** Session 103's
   Tier-3 payout numbers are no longer comparable, and several reports still
   quote them. Nothing was rewritten this session.
4. Deferred, unchanged: session 100's open question 2.
