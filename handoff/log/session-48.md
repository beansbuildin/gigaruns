# session 48 — 2026-08-19 — recap commit 5f698c5 — live fishing batch + the `[CONFIRMED]` falsifiability audit

**Outcome: BATCH GATE FAILED (correctly — two independent §1c stop conditions
fired). All offline work delivered.**

---

## 1. The batch, and why it stopped after one

Preflight read the real pool at 47, short of the planned 60, read the ROM bank
(37 ROMs, 27 with `energyCollectable > 0`, 2656 claimable), claimed one ROM,
and measured the pool at 420. Five casts, one caught.

| cast | turns | outcome |
|---|---|---|
| `12988700` | 6 | escaped |
| `12988705` | 4 | **CAUGHT** — chose card 36 from the offer (36, 16, 33) |
| `12988708` | 8 | escaped |
| `12988710` | 9 | escaped |
| `12988717` | 2 | escaped |

### Checkpoint, in the brief's §1b order

**1. FACT 1 violations — VIOLATED.** `scripts/auditStepClass.ts` on the
`isCleanCast`-filtered corpus: **3/308 off-ring** and **70/71 class-consistent**
casts, against a standing 0/279 and 66/66. All four are cast `12988700`. See §2.

(The unrestricted run also shows one distance-0 "move". That is the known
duplicate turn-0 in cast `12923189`, excluded by `isCleanTrace` — pre-existing,
not from this batch, and it disappears in the clean-only rerun.)

**2. Per-turn hit rate — FAILED the brief's own test.**

| | n | rate | 95% Wilson |
|---|---|---|---|
| batch 1 | 29 | **27.6%** (8/29) | [14.7%, 45.7%] |
| batch 1 minus cast `12988700` | 23 | 30.4% (7/23) | [15.6%, 50.9%] |

- vs. the historical 27.5% baseline: **z = +0.01, p = 0.99** — indistinguishable.
- vs. the replay's 50.9% prior: **z = −2.51, p = 0.012** — prior OUTSIDE the CI.
- Excluding the alternating cast does not rescue it: p = 0.050 against the prior.

The brief: *"Landing near 27.5% means the fix did not transfer and something
else is wrong — stop and report."* It landed on 27.5% to two significant
figures.

**3. Paired ΔLL — inconclusive at one batch, as expected.**

```
              n   ring top1  base top1   ring LL  base LL  paired ΔLL, 95% CI
k=1           8      12.5%      25.0%     8.567    3.934  +4.633 [-1.540, 10.805] inconclusive
k=2          16      18.8%      18.8%     1.733    9.091  -7.358 [-11.960, -2.756] ring better
unknown k     5       0.0%      20.0%     3.469    1.724  +1.745 [0.249, 3.241]  ring WORSE
ALL          29      13.8%      20.7%     3.917    6.398  -2.481 [-6.098, 1.136] inconclusive
```

**Note for the next brief: the sign convention is inverted from §1b(3).** The
tool reports `ring − base`, so NEGATIVE favours the ring model. §1b(3) says
"positive and excluding 0 → the model transfers". That is backwards relative to
the tool that produces the number.

**4. Calibration — realized well BELOW predicted.**

```
bucket          n   mean pred   realized  95% CI (Wilson)
0.00–0.20       6       0.005       0.0%  [0.0%, 39.0%]
0.20–0.40       3       0.303      33.3%  [6.1%, 79.2%]
0.40–0.60       7       0.485      14.3%  [2.6%, 51.3%]
0.60–0.80       6       0.674      33.3%  [9.7%, 70.0%]
0.80–1.00       7       0.937      57.1%  [25.0%, 84.2%]
OVERALL        29       0.515      27.6%  [14.7%, 45.7%]
```

**5. Catch rate — 1/5, underpowered, reported as noise.** All-time moves
7/69 = 10.1% → **8/74 = 10.8%**. The replay's 27.9% floor is not contradicted
or supported by n=5; do not let this be written up either way.

**Per-class movement top-1 as a running figure**: live k=1 12.5% (n=8),
k=2 18.8%–23.5%, all-classes 13.8% (n=29) — against an offline
leave-one-cast-out of **46.4%**. That gap is bigger than FACT 1 explains and
is open question 4.

**Two stop conditions fired (1 and 2), so batches 2 and 3 were not started.**
15 of the day's 20 casts are unspent, well beyond the 5 the brief asked to be
held in reserve.

---

## 2. FACT 1 is wrong — the session's headline

Cast `12988700`'s six moves ran **k = 1, 2, 1, 2, 1, 2**. A perfect
alternation, on a clean cast, not a logging artifact.

`data.lastMovePath` explains it, and it had been on the wire since the first
capture with nothing ever reading it. It is the server's own account of the
move: 1-based **row-major** cell indices, **one per unit step**, ending on
`fishPosition`.

```
state-001  prev [1,2] -> pos [2,2]  lastMovePath [6]      1 step
state-002  prev [2,2] -> pos [2,4]  lastMovePath [7,8]    2 steps: [2,3] then [2,4]
state-003  prev [2,4] -> pos [2,3]  lastMovePath [7]      1 step
state-004  prev [2,3] -> pos [1,4]  lastMovePath [3,4]    2 steps: [1,3] then [1,4]
state-005  prev [1,4] -> pos [1,3]  lastMovePath [3]      1 step
state-006  prev [1,3] -> pos [2,2]  lastMovePath [7,6]    2 steps: [2,3] then [2,2]
```

`scripts/auditMovePaths.ts`, whole corpus:

```
                                     ALL casts     clean casts
len(lastMovePath) == manhattan(...)   312/312        308/308
lastMovePath[last] == fishPosition    312/312        308/308
every hop is a UNIT step              312/312        308/308
steps-per-turn histogram              1:155  2:157
constant step count per cast          72/73    ·  strictly alternating: 1/73
```

**So the exceptionless fact is the unit-step decomposition. The per-cast
constancy of the step COUNT is merely very common.** Identity 2 also
re-confirms session 47's row-major reading of `position` from a second,
independent field.

**Why it was invisible for the whole project.** `data/fish-patterns.jsonl` —
the corpus view the movement model is fit from — projects each turn down to
`from`/`to` and **discards the path between them**. The evidence that refutes
the strong form of FACT 1 was in every capture from the beginning; the view
used to fit the model could not represent it. Fourth instance of this shape
(heuristic (d), the `.message` classifier, the zone table, now this).

**Consequence, unfixed and deliberately so.** The ring model treats step class
as a hard constraint — off-ring cells get probability exactly zero. Cast
`12988700` locked k=1 off its first move and then landed off that ring three
times: logLoss **11.316** with 3 zero-probability events against a corpus LOO
of 0.803 for k=1. One cast in 73 cannot choose between the candidate fixes, so
it is handed over as open question 1 rather than patched on a hunch.

---

## 3. §2 — the `[CONFIRMED]` falsifiability audit

Full table in `handoff/CONFIRMED-AUDIT.md`. The method: for each CONFIRMED
claim, ask not "is it true" but **"could its establishing sample have shown it
false?"** Everything re-scorable was re-scored.

**focus-meter spend rule** — was n=1 (session 13), and the establishing sample
was moves of distance **0, 1, 1**, under which "cost = Manhattan distance" and
"cost = 1 per move" predict IDENTICALLY. (The rejected distance-2 move does
discriminate them, so the claim was not baseless; the no-regen half rested on a
cast that never had the budget to show regeneration either way.)
→ **308/308**, within-cast regeneration **0/308**.

**`fishHp` arithmetic** — was CONFIRMED on sign agreement alone, which cannot
distinguish the card's own amount from any rule with the right sign.
→ **308/308** on amounts. Scoring the amounts turned up what sign-agreement
structurally could not see: **crits**. Four hits deal strictly more than their
card's `hitEffects`, and all four are exactly `critEffects` at a fish cell
inside the translated `critZones`.

**That makes the crit test a second, INDEPENDENT confirmation of session 47's
`ZONE_OFFSET` correction** — different zone set (`critZones`, not `hitZones`),
different observable (damage magnitude, not the server's hit/miss verdict) —
and it **discriminates**:

```
corrected  table: 308/308   crits flagged: 4
transposed table: 305/308   crits flagged: 1
```

**`enemyPathOptions[].lootTable` identical across tiers** — the claim
**CLAUDE.md §8** rests on, stated as "every sample captured so far" and never
quantified. → **440/440** observations, byte-identical across all three tiers.

**Not re-scorable**: `use_fishing_item`. One user DevTools capture, and this
project has never sent one. Flagged in `handoff/CONFIRMED-AUDIT.md` as the one
to watch.

**Exemplary, worth copying**: the ROM-overflow claim. Session 22 claimed 540
into an 88 pool, saw +332, then **re-probed the ROM** and read 208 banked — the
re-probe is precisely the observation that could have refuted it. Re-tested
this session: 540 claimed into a 47 pool, +373 measured, ROM `6096` re-probed
at **168** (predicted 167; the 1 is accrual in the intervening ~20 minutes).

---

## 4. QUESTIONS.md §17 ANSWERED — and it was a type confusion

§17 had one non-null observation, read `nextMovePath [1,2]` beside
`nextPosition [1,2]`, and concluded the fields were identical and the field was
a single cell "despite the name". **They are different types.** `[1,2]` as a
path is two row-major INDICES decoding to `[1,1]` then `[1,2]`; `[1,2]` as a
position is row 1, column 2. The identity was a formatting coincidence.

```
decoded path ends exactly on nextPosition:          6/6
decoded path is unit steps from the current cell:   6/6
multi-cell (length > 1), NOT a duplicate:           2/6
fish actually went there (4 casts that continued):  4/4
next turn's lastMovePath equals it byte-for-byte:   4/4
```

Four of the six are **mid-cast** (`COMPLETE_CID: false`), so it is not a
terminal-doc artifact. Its LENGTH is the next move's step count — the quantity
FACT 1 got wrong.

**Not a new exploit.** `scripts/liveFishing.ts` already validates each
prediction into `data/nextPositionValidation.jsonl` and gates
`certainDistribution` on ≥10 attempts with a Wilson lower bound ≥0.5. It stands
at **3 attempts / 3 hits / bound 0.438 — not ready**, working exactly as
designed. Cast `12956718` t1 is a fourth validated observation predating the
ledger; **not backfilled**, because that would move a live gate with data its
author never sanctioned. Left as a decision for a human.

---

## 5. §5c — where the loss actually sits. Answer: the FOCUS BUDGET.

`scripts/lossDecomposition.ts`, 73 clean casts. Measured on the real corpus
rather than the replay, deliberately — terminal reasons and focus profiles are
observations, and this session showed the replay's absolute rates are not
trustworthy.

```
escaped (meter out)    59/73 (80.8%)   mean final focusMeter 0.25   mean turns 3.9
caught                  8/73 (11.0%)   mean final focusMeter 1.13   mean turns 3.0
mana out                5/73 ( 6.8%)   mean final focusMeter 0.00   mean turns 10.0
truncated               1/73 ( 1.4%)

turn :     0    1    2    3    4    5    6    7    8    9   10
focus:  3.00 1.38 0.72 0.36 0.14 0.04 0.00 0.00 0.00 0.00 0.00
mana :  10.0  9.0  8.0  7.0  6.0  5.0  4.0  3.0  2.0  1.0  0.0
n    :    73   73   71   45   37   28   16   15   11    7    5

turns spent at focusMeter 0: 192/381 (50.4%)
casts that ever reached focusMeter 0: 56/73
```

**Against the brief's own decision table: meter-outs dominate AND focus hits 0
early ⇒ the constraint is the focus budget, still.** Not the damage economy,
not cast length. Mana-outs are 6.8% and are the *long* casts, not the failing
ones.

Confirmed live on all five of this session's casts, under `focusReserveWeight: 3`:

```
12988700  3 3 3 1 0 0 0
12988705  3 1 1 1 1 1        <- the one CATCH
12988708  3 2 1 1 0 0 0 0 0
12988710  3 2 1 0 0 0 0 0 0 0
12988717  3 2 1
```

Suggestive but n=1: the only cast that caught anything is the only one that
stopped spending and held a point in reserve for the whole cast.

**Measured, not fixed** — the brief asked for the measurement, and changing the
utility on the strength of one batch is exactly the move this project keeps
having to undo.

---

## 6. §5b — both reachable knobs are INERT

73 real trajectories, leave-one-cast-out. **No defaults changed.**

`focusReserveWeight` (ships at 3):

| w | catch | per-turn hit |
|---|---|---|
| 0 | 30.1% [20.8, 41.4] | 50.8% [44.5, 57.1] |
| 1 | 28.8% | 51.4% |
| 2 | 30.1% | 51.7% |
| **3 (shipped)** | **30.1%** | **51.1%** |
| 4 | 27.4% | 49.4% |
| 6 | 26.0% | 47.3% |
| 8 | 26.0% | 44.0% |
| 12 | 26.0% | 41.8% [35.8, 48.2] |

**w = 0 through 3 indistinguishable; above 3 it monotonically HURTS.** The
striking half is w=0: removing the focus-reserve term entirely performs
identically to the shipped value. **The term is inert — and it is the knob
built for §5c's constraint. Session 49 should not spend a session on it.**

`missPenaltyMultiplier` (ships at 1 — SPEC.md §5's "the ONE tunable knob",
untouched since written; `ReplayOptions` already carried it but nothing on the
CLI could reach it, so `--miss-penalty=` was added):

| m | catch | per-turn hit |
|---|---|---|
| 0 | 26.0% | 47.8% |
| 0.5 | 28.8% | 49.2% |
| **1 (shipped)** | **30.1%** | **51.1%** |
| 2 | 30.1% | 51.5% |
| 3 | 31.5% | 52.0% |
| 5 | 28.8% | 50.2% |

Flat 0.5–5; only m=0 is worse. **1 stands.**

**Stated honestly: these are UNPAIRED point estimates with Wilson intervals,
not the paired differences the brief asked for.** The arms score different turn
counts (233–253), so a paired CI is not derivable from the harness as it
stands. The intervals overlap so completely that the null is safe regardless,
but a paired harness is what would make a *small* real effect visible.

**Not swept:** `REDRAW_THRESHOLD` and the mined-matcher tier are not on
`ReplayOptions`; plumbing them is real surgery on `replayCast`, and tuning
either against a replay whose absolute level was just refuted live is
low-value while the constraint sits on the focus budget. Handed over, not done.

**§5d (`chooseNewCard`) not attempted** — lowest priority in the brief, and the
session's findings reframe what matters.

---

## 7. §5a — FACT 3's best-card table under the corrected map

The session-45 brief warned any "best card" row naming a row/column zone triple
(`{1,2,3}`, `{1,4,7}`, …) had to be re-derived, since those swap roles under
the transpose. **Checked: no row of FACT 3 names one.** Every set it rests on —
`{2,4,6,8}`, `{1,3,7,9}`, the ring-8 block — is transpose-symmetric, so FACT 3's
*structure* was never at risk. Only its numbers needed refreshing; full 5×5
tables for both classes are now in SPEC-fishing.md §9, with `dx` labelled as the
ROW offset so the corrected convention is explicit.

Two old absolutes moved, and one cast explains both: k=1 at (0,0) 100.0% → 99.4%,
and diagonal-2 (+2,−2) 0.0% → 3.2%. Both are cast `12988700`, classified k=1 off
its first move so its 2-step turns fall outside the k=1 ring. FACT 1's
correction propagating, not a change in the card templates.

---

## 8. §3 — `zoneMapVersion`, and the replay-gating rule with its caveat

`zoneMapVersion` (`"transposed" | "corrected"`) marks which `ZONE_OFFSET` table
a row's shot was AIMED with; absent means `"transposed"` via `zoneMapVersionOf()`.
`ringPredictionReport.ts` prints a loud split whenever a selection mixes the two.

The 29 batch-1 rows predate the field but ran AFTER the fix, so defaulting them
to `"transposed"` would mislabel them — backfilled additively (verified 49 rows
in, 49 out, 0 rows differing in anything but the new key).

**Small correction to the brief's premise:** the 20 pre-fix rows carry no
`realizedHit` at all (that field landed in session 46; those rows are session
45's), so they could never have dragged a hit rate down. The label is still
worth having; the risk was already moot.

**The gating rule, adopted WITH a caveat this session's data forces.** The
replay is the primary offline gate and the sim is a debugging tool — but the
replay's absolute levels are not trustworthy:

| | replay prior | live, batch 1 |
|---|---|---|
| per-turn hit rate | 50.9% [44.3, 57.5] | **27.6%** (8/29) [14.7, 45.7] |

And 50.9% is numerically ~the mean `pHitPredicted` (**0.515**) the policy
assigned to those same shots — the same movement model on both sides of the
comparison. **Use the replay for DIFFERENCES, never for levels.**

---

## 9. Defect found in the checkpoint tooling itself

`scripts/ringPredictionReport.ts` took `process.argv[2]` as the log path
unconditionally. The brief's own checkpoint invocation —
`ringPredictionReport.ts --since=<batch start>` — therefore treated the flag as
a filename, read a nonexistent file, got an empty array, and printed
**"nothing logged yet — run a live batch first."** Immediately after a live
batch.

Same defect class as the dead `.message` server-cap guard (session 46) and
heuristic (d): **a silent empty result that reads as a legitimate answer.**
Fixed — only a non-`--` argument is taken as the path.

---

## 10. Verification at the final commit

```
npx tsc --noEmit          clean
npx vitest run            697/697 passed, 41 files
git diff --check          clean
```

Suite 688 → 697 (+5 `movePath.test.ts`, +4 `stateFields.test.ts`).

**Data-path integrity re-checked** (CLAUDE.md's tests-never-write-a-real-data-
path rule): md5 of `data/fish-patterns.jsonl` and `data/ringPrediction.jsonl`
captured before and after a full suite run — **both unchanged**.

Two exact-equality corpus-size pins moved because the batch added 5 real casts
(`traces 69→74`, `clean 68→73`, `clean play turns 279→308`, `caught 7→8`;
`responseDocs 357→392`, `playTurns 283→312`, `escaped 61→65`). That is the
intended fix per `fishingCorpus.test.ts`'s own comment — update the numbers,
don't revert the loader.

**Secret scan**: `0x[a-fA-F0-9]{4,}`, `noobId\s*\d+`, `eyJ`, `PRIVATE` over the
whole session diff — no matches. 35 new cast fixtures committed, redaction
confirmed (`0xUSER`), no `raw/` files tracked.
