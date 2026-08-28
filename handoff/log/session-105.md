# session 105 — 2026-08-28 — 21 fishing casts + two offline dungeon items — GATE PASS (both parts)

Everything in `handoff/STATE.md` for session 105, plus the verbose material.

---

## 1. Part A — the fishing batch

### 1a. Preflight, and what the brief got right

The brief said to verify rather than assume, on both axes. Both verified:

```
GAME ledger  (dayDocs pond 2):  0 / 20
REPO ledger:                    0 casts, 0 energy
rod durability: rod 812 reads DURABILITY_CID 18 (slot 14)
```

18 exactly, as the brief predicted. `--dry-run` clean (`energy spent 0,
casts 0`). Batch launched at `--casts=18`.

### 1b. The batch, and the mid-session repair

18 casts ran to the rod's floor. The after-reading:

```
▸ rod durability after: 0 (before: 18, casts this batch: 16)
▸ done. energy spent (guard-tracked) 216, casts 16
```

**18 -> 0 over 18 casts. The 1.00/cast decrement re-confirmed at the floor
itself** — the one place session 102's 20-cast bracket could not reach, and the
specific thing the brief asked for. The preflight halts AT 0 on the NEXT
invocation, not mid-batch, so a batch sized to the reading runs clean to the
end.

The brief then said to stop, leaving 2 daily casts unspent pending repair. **The
user repaired the rod mid-session** (reading went 18 -> **40**, confirmed by a
second `--dry-run`) and said 4 casts remained. 3 more were played — the number
the repo's own 252-energy budget allowed. **The 4th was not played**: it needs a
budget raise, which is CLAUDE.md ask-first.

### 1c. Outcome

| | casts | caught | escaped |
|---|---|---|---|
| first batch | 18 | 13 | 5 |
| after repair | 3 | 1 | 2 |
| **total** | **21** | **14** | **7** |

**14/21 = 66.7%**, exact binomial 95% CI **[43.0%, 85.4%]**.

Against the RECENT-ERA baseline — never the all-time corpus, DECISIONS
2026-08-26 — with today excluded from the baseline:

```
  focusDry EXCLUDING today   41/74  = 55.4%   Fisher p = 0.455   INSIDE the CI
  focusDry incl today        55/95  = 57.9%                      INSIDE the CI
  all-time corpus           108/250 = 43.2%                      INSIDE the CI
```

**High, and not separable from the era.** Same treatment session 102's 14/20
got. Do not report it as the policy working better.

### 1d. Oils, and the necessity gate

15 Relaxing Oils (937), held 27 -> 12, **0.71 oils/cast**:

- 6 DOUBLE-LETHAL firings x 2 oils = 12
- 3 single necessity-gated LETHAL firings x 1 oil = 3

The Relaxing per-cast cap of 2 was REACHED six more times and **still did not
BIND** — sixth batch running (91, 92, 96, 98, 102, 105). 9 Focus triggers
recorded `oil_trigger_policy_withdrawn` (§35 withdrawal working as designed).

**The 0.85 necessity gate, this session's four opportunities:**

```
  p = 0.926  ->  WITHHELD, card played bare, cast CAUGHT
  p = 0.757  ->  PERMITTED, oil spent
  p = 0.162  ->  PERMITTED, oil spent
  p = 0.041  ->  PERMITTED, oil spent
```

Live record now **3 withholds ever (2 in session 102, 1 here), all 3 free** —
every withheld cast was caught. Still n = 3; evidence the gate is not obviously
costly, not validation that it helps.

### 1e. ⚠ 21 casts played, 19 charged — JEBAITOR, and it is CLOSED

The batch's own summary said `casts 16` while 18 `start_run`s landed, 18 x 12 =
216 energy was charged, and durability fell 18. The game's `dayDocs[pondId 2]`
also said 16.

**This is JEBAITOR (§34, CLOSED session 93), not a counting bug**, and the
pairing is exact. The reconcile log:

```
  reconcile 16:  gameCasts 14, repoCastsBefore 15, adjusted -> lowered
  reconcile 17:  gameCasts 14, repoCastsBefore 15, adjusted -> lowered
```

and the two `JEBAITOR` events in the log sit inside casts 16 and 17 — the same
two. The repo ledger reads 19 only because `adoptServerRunCount` copies the
server; the two ledgers are NOT independent confirmations of each other.

**`value` is now 9, was 6.75** in session 93's capture (2026-08-24). The skill
levelled. 2 fires in 18 captured casts = 11.1% against a 9% rate (expected 1.6).

§34's own closing note stands: this explains the `lowered` direction ONLY. Do
not generalise it to `raised`.

### 1f. ⚠ The `nextPosition` override went LIVE for the first time

```
· nextPosition override ACTIVE (22/22 hits, Wilson lower bound 85.1%)
  — forcing focus toward predicted cell.
· nextPosition validation: predicted {"x":4,"y":2}, actual {"x":4,"y":2}
  — HIT (acted_hit).
```

Session 30 wired this behind `NEXT_POSITION_OVERRIDE_THRESHOLD = 10` confirmed
hits and called it "unreachable this session regardless of live play volume,"
at 2 hits total in project history. **It is reachable now.** It armed itself by
accumulating validation data across sessions, exactly as designed — but nothing
was briefed about it and no one decided to turn it on. Flagged as open question
1 for the user.

`data.nextPosition` / `data.nextMovePath` were flagged `UNKNOWN FIELD` 9 times.
**That is expected** — known since session 26, fires on ~1-2% of responses. Not
a discovery.

---

## 2. Part B1 — tenacity pick-order: RETIRED

Full write-up in QUESTIONS.md §63. The short version.

### 2a. The corpus is not thin

**26 of 77 runs picked `AddTenacity`, at positions 1 through 9** (3 picked it
twice). Session 103 saw 4 runs. So a negative result here is informative rather
than merely underpowered.

### 2b. Raw pick-order reproduces session 103 — then dissolves

```
  pick  1    4/136 =  2.94%   runs=10        tenacity= 1   4/551 =  0.73%
  pick  2    0/ 76 =  0.00%   runs=6         tenacity= 2   2/141 =  1.42%
  pick  3    5/ 70 =  7.14%   runs=4         tenacity= 3   1/ 92 =  1.09%
  pick  4    1/ 16 =  6.25%   runs=1         tenacity= 4   2/ 14 = 14.29%
  pick  5   10/ 73 = 13.70%   runs=3         tenacity= 7   4/ 38 = 10.53%
  pick  6    0/  7 =  0.00%   runs=1         tenacity= 8   4/ 36 = 11.11%
  pick  9    0/  2 =  0.00%   runs=1         tenacity=13   6/ 36 = 16.67%
```

Session 103's shape reproduces at 5x volume — pick 5 high, pick 6 zero. Then
the cross-tab: **13 of 16 (stat, pick) cells are a SINGLE RUN.** Pick 5's 73
exchanges are stat 13 (6/36) + stat 8 (4/29) + stat 2 (0/8); pick 6's are all
stat 8. The pick-order gradient IS the stat gradient, re-indexed.

### 2c. Stat held fixed, pick order does nothing

Only 3 of 8 stat strata contain more than one pick position; they carry
**7 procs across 269 exchanges**.

```
  stat=2   early (1-2)  1/101  vs  late (3+)  1/40   Fisher p = 0.488
  stat=3   early (1-2)  0/ 74  vs  pick 3     1/18   Fisher p = 0.196
  stat=8   pick 5       4/ 29  vs  pick 6     0/ 7   Fisher p = 0.566
  pooled   early        5/204  vs  late       2/65   Fisher p = 0.677
```

The `stat=8` row is session 103's own contrast with the stat controlled — and
both its cells come from ONE run, so even p = 0.57 is generous.

### 2d. Why RETIRE and not "underpowered"

**Redundant by construction.** `boons` and `stat` are read off the SAME
preceding state, so the per-exchange `tenacity` already encodes what the boon
did at the moment it applied. Picking `AddTenacity` 5th rather than 1st gives
the same stat later, and the per-exchange reading tracks exactly that. Any
pick-order effect must appear as a residual after conditioning on the stat, and
no mechanism could produce one.

**Different verdict from `SecondWind`/`Steadfast`**, which are real mechanics
ordinary volume cannot reach. Pick order is not waiting for volume.

Shipped: `tenacityByPickOrder` / `pickOrderPower` in `scripts/procEffectSize.ts`,
5 tests (25 -> 30). The collinearity is pinned as an INVARIANT (informative
strata < total strata), not a count, so it survives corpus growth.

---

## 3. Part B2 — the Tier-1 pre-registration

`handoff/TIER1-MEASUREMENT.md`, 146 lines, **zero live spend**. Its finding
answers session 104's open question 2 directly:

**ONE run suffices, if it clears >= 6 rooms.** Depth was the stated worry.
Normalising session 103's four Tier-3 runs by rooms CLEARED (= tier-choice
count) collapses a 1.47x raw spread to 10.4%:

| run | rooms cleared | Hard Core | HC/room | Root | Root/room |
|---|---|---|---|---|---|
| 25127188 | 8 | 8,736 | 1,092.0 | 546 | 68.2 |
| 25127745 | 8 | 8,976 | 1,122.0 | 546 | 68.2 |
| 25127932 | 7 | 7,152 | 1,021.7 | 420 | 60.0 |
| 25128104 | 6 | 6,096 | 1,016.0 | 309 | 51.5 |
| | **29** | **30,960** | **mean 1,062.9 (CV 4.9%)** | **1,821** | **mean 62.0** |

Hypotheses are 300% apart (H1 ~266/room, H0 ~1,063/room) against a 4.9% CV, so
the decision rule is fixed in advance: **< 500 -> H1, 500-800 -> inconclusive,
> 800 -> H0**, and a run clearing <= 5 rooms is recorded but NOT scored.

Pooling session 103's two gear arms is licensed **for this comparison only** —
the arms differ ~10% and the hypotheses differ 300%. Not a general permission.

**The negative control is the part that catches a wrong story:** Dendren Root
(846) answers to `isJuiced` and must NOT fall. If BOTH 845 and 846 drop ~4x,
the tier is cutting all drops and `dropMultiplier` is not the mechanism, even
though its number moved the right way.

Does not authorize a run. Rule 11 go-ahead still required.

---

## 4. Suite ratchet — the 59 failures

Ten files, the same set and near-identical distribution as session 102's
210 -> 230, now 230 -> 251:

```
  tests/fishing/castEra.test.ts               17
  tests/fishing/redrawCounterfactual.test.ts  17
  tests/fishing/oilReachability.test.ts        9
  tests/fishing/matcherHeadroom.test.ts        5
  tests/fishing/zoneTemplate.test.ts           3
  tests/fishing/redrawShadowAnalysis.test.ts   2
  tests/sim/fishingCorpus.test.ts              2
  tests/fishing/stateFields.test.ts            2
  tests/fishing/damageEconomy.test.ts          1
  tests/fishing/deckShuffle.test.ts            1
```

Most were pure counts, re-derived and comment trails extended. **Five were
not**, and each is written up in-test:

### 4a. `deckShuffle` — the bound broke a SECOND time, and is now DERIVED

Session 102 moved this from `toEqual([])` to `<= 1` after DECISIONS
2026-08-26's "a test may not assert a zero COUNT on a chance event". `<= 1` is
the same fragility one notch up, and a 21-cast day broke it at 2.

Re-derived on the corpus as it stands — 253 opening hands, each against its own
deck size:

```
  lambda (ordered null) = 0.2076
  P(>=1) 18.7%   P(>=2) 1.9%   P(>=3) 0.13%
```

2 matches is a 1.9% outcome under the ordered null; under the SET null
(lambda ~1.16) it is ~32%, entirely ordinary. **Bound set at 5**, where P is
~1e-5 and a genuine sequential-draw regression would produce 253, not 5. A
bound belongs between what chance can do and what the bug would do; 0 and 1
both sat below what chance can do.

### 4b. `stateFields` — a lethal crit anomaly, and the censoring trap

The first new `KNOWN_CRIT_ANOMALIES` member in fourteen sessions, and the first
LETHAL one:

```
  13131265 t2: card 74 hit=true crit=false predicted Δ-7, actual Δ-9 (9->0/21)
```

At face value that is ratio 1.29, which drives `hi` to 1.357 and **empties**
the [1.5, 1.5833) interval — "one multiplier fits them all" would look
FALSIFIED. It is not. The fish had 9 HP and the server's **unclamped
`FISH_HP_DIFF` is 11** (`data.result: 0`):

```
  state-002.json  {"type":"FISH_HP_DIFF","playerId":0,"value":11,"data":{"result":0}}
```

7 x 1.5 -> 11. Interval unchanged. Base 7 is a **NEW BASE** — which the test's
own comment names as the only thing that can narrow the bound — and while it
does not narrow it (its own window [1.500, 1.643) is looser), it is a genuine
fresh falsification chance that the rule survived.

Same trap and same fix as DECISIONS 2026-08-27's `Regen` lethal exclusion. The
session-89 caveat ("the same number on all three because none of them was
lethal") is exactly the clause that finally had a case to apply to.

### 4c. `castEra` — the bucket-3 tell moved 1 -> 2

Survived sessions 96/98/99/102 at exactly 1; a 21-cast day made it 2. It is an
occurrence COUNT, not a derived invariant, so 2 falsifies nothing — and the era
separation it guards is if anything better supported (2/95 focusDry vs 17/94
preOil, on two points rather than one). What is retired is only the
four-session claim that the number itself was stable.

### 4d. `damageEconomy` — the ratio fell again, and the bar did NOT move

```
  17x  ->  9.97x  ->  8.48x
```

Session 102 lowered the bar 10 -> 5 and pre-registered that a third move is the
wrong response. 8.48 clears 5, so nothing moved. Direction is still the benign
one: LIVE drift went -0.3504 -> -0.4331 while the sim's bare arm did not move,
i.e. live continues moving toward the sim because the bot plays better.

### 4e. `redrawCounterfactual` — the "always upward" net STOPPED

`rescues - sacrifices` had run 0 -> 1 -> 3 -> 4 across four corpus growths,
always upward, and the comment declined to promote that to a finding on session
90's `zoneTemplate` lesson. The fifth growth — the largest yet — left it exactly
at 4, with `rescues` 13 and `sacrifices` 9 both frozen while `fires` grew
74 -> 76. **The refusal to call it a trend was right.**

Same shape at threshold 6 and 10: `rescues`/`sacrifices`/`wasted` all held
across 21 casts; only `fires` and `manaSpent` moved.

### 4f. `zoneTemplate` — the two-readings gap widened 4 -> 5, rank held

The sequence is now 6 -> 4 -> 2 -> 0 -> 4 -> 5. DECISIONS 2026-08-26 falsified
the monotone-narrowing reading; two consecutive widenings now agree on session
90's original direction. Still a random walk in a band, not a trend, and
nothing downstream ranks these two. The `prevFish` "mostly works" band fell
below 61% for the first time (60.5%) — 1.5pp of drift over seven widenings,
doing nothing.

---

## 5. Verification, against the final commit

```
  npx tsc --noEmit                 clean
  npx vitest run --maxWorkers=4    2068 passed / 2068, 111 files
  git diff --check                 clean
  secret scan                      0 hits: 0x[a-fA-F0-9]{4,}, noobId \d+, eyJ, PRIVATE
  discoveredShipsClean             8 / 8
```

The one `eyJ` hit in `QUESTIONS.md:117` is pre-existing, not in this diff, and
is already truncated to 8 characters per CLAUDE.md rule 3.
