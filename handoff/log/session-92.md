# SESSION 92 LOG — 2026-08-24 (PT) — GATE PASS

## Status
**GATE PASS — both items delivered.** §1 (the §32 ruling: era predicate
re-specified, all era-conditioned numbers recomputed, the red assertion
rewritten) and §2 (the 10-cast batch with `--oil-batch`, all three reports).
One live spend, the authorized one: **10 fishing casts, 7 Relaxing Oils, 120
energy, ZERO dungeon runs.**

**Suite went 2 failed → 1 failed** (1744 → 1749 passed; 1746 → 1750 tests).
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean,
`discoveredShipsClean` 8/8, no `raw/` committed.

**The one remaining failure is the carried `boons.test.ts` staleness** that
sessions 89, 90 and 91 each verified inert and declined. Not re-opened. It is
now the SOLE blocker on `assertionCoverage` and `preflight` — see below.

## What works
- **§1 — `QUESTIONS.md` §32 is ANSWERED. The era predicate is a CONSUMABLE
  SUPPLY boundary, not a policy date.** `Era` is now
  `preOil | oilSupplied | focusDry`. New `FOCUS_DRY_BOUNDARY =
  2026-08-24T00:02:57.148Z` — the first `oil_trigger_no_stock` for Focus Oil
  (942), **5.6 seconds** after the last 942 POST that succeeded. Focus Oil is
  the meter-restoring half of the oil policy, so when stock hit zero the
  budget-zero rate reverted toward the pre-oil regime with policy, code and deck
  unchanged. Dose-response, Focus POSTs → budget-zero rate:
  ```
    preOil (no oil policy)     0 POSTs   184/410   44.9%
    2026-08-21                13 POSTs     2/110    1.8%
    2026-08-22                 7 POSTs     1/70     1.4%
    2026-08-23                 3 POSTs     0/22     0.0%
    2026-08-24 00:0x (dries)   3 POSTs    17/87    19.5%
    2026-08-24 19:1x (dry)     0 POSTs    19/52    36.5%
    2026-08-24 22:3x (dry)     0 POSTs     2/24     8.3%
  ```
  **Deck-controlled**, because 12 of `focusDry`'s 32 casts are §29 base-deck
  casts: rod-dealt only, `oilSupplied` 3/215 (**1.4%**) vs `focusDry` 21/76
  (**27.6%**). ⚠ **Day precision cannot express this boundary** — it falls
  inside one 20-cast batch and splits it **8/12** — so `eraOf` compares the FULL
  timestamp here and keeps day precision for the first boundary, whose 20.3h
  empty gap makes any literal inside it equivalent. Both pinned.
- **§1 — the brief's TWO candidate boundaries were REJECTED on measurement.**
  Both anchored on the double-lethal wiring; that change concerns *Relaxing* oil
  (937) and has no bearing on the focus budget, which is what all four degrading
  claims are about. The corpus named a different cut.
- **§1 — all four §32 claims REVERSE. They were diluted, not dying:**
  ```
    claim                 s84/86   s89     s91      s92 (corrected)
    budget-zero ratio      ~30x    6.48x   3.92x         26.37x
    rescue rate           15/15   26/32   30/42    21/22 (95.5%)
    neitherReaches            0       6      12              1
    wasted                  {0}  {0,3,4,5,6}  {0,3,6..12}   {0,1}
  ```
  Rescue-rate Wilson lower bound **0.782**, within 0.001 of session 84's 0.78
  for 15/15. ⚠ Sessions 89/91 were **not wrong to retract** — the two-era model
  was the defect and neither could see it from one batch. `neither` is 1, not 0,
  so the retraction is **not fully rescinded**.
- **§1 — the `meanOptimal` bound was a SECOND, SEPARATE defect that the split
  does NOT fix** (still 0.0108 on the corrected arms). SE of the difference is
  **0.112**, so the 0.01 bound was one tenth of one standard error — session
  89's 0.0062 was a coincidence (~7% chance), not a measurement. Replaced by
  `meanOptimalGap()`: 1.96 SE off the arms' own dispersion. **Not a widened
  bound** — not a constant, tightens as the corpus grows, and a half-move
  divergence fails at gap/SE ≈ 2.7, asserted non-vacuously in the test.
- **§2 — the batch ran to completion**, halting on `cast_cap` (the intended
  exit). Ledger checked before spending (rule 13) and a `--dry-run` first.
- **§2c-1 — THE DOUBLE-LETHAL FIRED THREE TIMES, ALL THREE CAUGHT.** Each sent
  two `use_fishing_item(937)` POSTs in one turn at distinct slots 0 and 1, plus
  one ordinary on-demand lethal (1 POST) = 7 oils. **The per-cast Relaxing cap
  of 2 was REACHED on all three and still did not BIND** — the policy wanted
  exactly two, never three. Second consecutive batch to reach without binding.
- **§2c-3 — ZERO base-deck casts.** All 10 rod-dealt; the rod repair holds. ~20
  of the user's ~40-cast estimate now spent.
- **✅ THE ERA RULING CONFIRMED OUT OF SAMPLE.** All ten new casts classified
  `focusDry`, and **every figure §1 rests on is byte-identical afterwards** —
  ratio still 26.3659x, `oilSupplied` still [62, 235, 4], rescue still 21/22,
  `neither` still 1, `wasted` still {0,1}, gap still 0.01075 at gap/SE 0.096.
  Under the two-era model they would have diluted `today` a **fourth** time.

## What's broken
- **`boons.test.ts` — 1 failure, `OBSERVED_OFFERS` stale.** Carried since
  session 89, verified inert three times, declined again here (a dungeon-boons
  pin, unrelated to this session). ⚠ **It is now the ONLY thing blocking
  `assertionCoverage` and `preflight`** — a stronger statement than in any prior
  recap, and the cheapest available unblock.
- **`scripts/assertionCoverage.ts` STILL CANNOT RUN** — fails closed on a red
  suite. The "zero vacuous" check is **BLOCKED, not passed**, now by 1 failure.
- **`scripts/preflight.ts` STILL FAILS, same single cause:** 1 failed / 1733
  passed / 16 skipped (1750) in the exported tree, one expected `✗` (missing JWT
  in the empty-HOME `doctor.ts` run), **secret scan clean**.
- ⚠ **`focusDry` IS ITSELF HETEROGENEOUS** — 36.5% (19:1x) vs 8.3% (22:3x)
  budget-zero under **identical zero Focus supply**. The difference is cast
  LENGTH (5.2 vs 2.4 decisions/cast) because three of the second batch's casts
  were killed early by the double-lethal. **Focus-dry sets the CEILING on
  budget-zero, not its level.** The test bound is `oilSupplied.rate * 10`, not a
  point, for exactly this reason. A low `focusDry` rate is NOT evidence supply
  returned — check the 942 POST count.
- ⚠ **The double-lethal trigger has now broken TWO instruments by one
  mechanism.** It is the first policy that sends two `use_fishing_item` POSTs in
  one turn, so a cast can end with TWO un-actionable trailing states where every
  earlier shape appended at most one. (1) `oilsConsumed`/`firedOil` go blind
  (§33). (2) `oilReachability`'s `lax.decisionPoints === strict + 1` /
  `focusPoints === 1` is FALSE on `13071770` (reads +2 and 2) — exempted
  explicitly, not loosened. **Any instrument that walks the END of a cast must
  be checked against a double-lethal cast.**
- Carried, untouched: the gate-1 re-audit; the two unpaid redraw correctness
  gaps (`liveFishing.ts:2471`, `:1526`); the pacing term's cause; H2's proc
  model; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**; Focus Oil stock **0**.

## Corrections to SPEC.md
- **None this session.** No live response contradicted the spec; `SPEC.md` and
  `SPEC-fishing.md` are untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Rule 9 — the brief's §1b was wrong on the merits and it was checked, not
  implemented.** It offered two boundary resolutions, both anchored on the
  double-lethal wiring, and told this session not to force either. Neither
  holds: that policy concerns Relaxing oil and does not touch the focus budget.
  The brief also framed §32 as "the premise is falsified"; the premise is
  **confirmed** across all three eras (gap/SE 0.10, 0.46, 0.35) and the
  *assertion* was the defect.

## Dead ends
- **Widening the 0.01 `meanOptimal` bound — REFUSED again**, as sessions 89 and
  91 refused it. Replaced with a dispersion-derived interval instead; the
  distinction is written out at the assertion so it is not mistaken for a bump.
- **Re-tightening the budget-zero ratio bound to `> 28` — REFUSED.** The point
  estimate is 26.37 on **4** budget-zero plays of 235; a denominator that small
  moves a lot per play. Left at `> 15`.
- **Bulk-regenerating the pin files the batch moved — REFUSED** (session 91's
  precedent). Each checked individually; **three were findings**, below.
- **Fixing `castTrace` for §33 in passing — REFUSED.** It would move numbers in
  several pinned files at once. Pinned the defect at its wrong-but-actual value
  so a repair fails loudly.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model.

## Metrics
- **Live: 10 fishing casts, 5 caught (50%), 7 Relaxing Oils, 120 energy. ZERO
  dungeon runs.** Focus stock 0 throughout (2 `oil_trigger_no_stock` for 942);
  Relaxing 53 → 46. Ledger `dayDocs[pond 2]` 10 → **19**; 1 cast remains.
- **§2c-2 — redraw shadow, WITH the batch summary session 91's command skipped:
  24 decisions, 4 fires, 4 blind, 0 sanity/error — 16.7% against the in-sample
  2.7%** (P(≥4 | p=.027) = **0.0037**). **Session 91's anti-correlation does NOT
  persist**: it saw `coverageBelowK` and `conditionMet` never true together, all
  14 low-coverage turns at `budget: 0`; this batch has 6 low-coverage turns,
  only 2 at budget 0, and 4 fires. The two batches differ at **Fisher p =
  0.008**, so 0/52 and 4/24 are not one population. The mechanism was long
  grinding casts, not structure. `liveRedrawEnabled` false on all 24 rows.
- Suite **2 failed / 1744 passed (1746) → 1 failed / 1749 passed (1750)**.
- Corpus: **178 → 188 casts**. `preOil` 94 and `oilSupplied` 62 both FROZEN;
  all growth in `focusDry` 22 → 32.
- **Three pin files were FINDINGS, not drift:** `matcherHeadroom` — **a new
  guaranteed-miss card, 35** (`hitZones [1,4,7]`, a COLUMN where every earlier
  offender was a row case), and **the bot took a SECOND copy as loot in cast
  8**, first firing of that by-id pin since session 81; `oilReachability` — the
  `+1` structural claim broken by the double-lethal tail, **and** the relaxing
  numerator **STILL 13** across a FOURTH batch with `gained` **STILL 2** across
  a NINTH; `fishingCorpus` — **it reads all six §33-blind oils correctly**.

## Open questions for Claude
1. **§33 has effectively answered itself — option (b).** `fishingCorpus.ts`
   already reads every closing-turn oil correctly (2/2/2/1/2/2) while
   `castEra.ts`'s trace-derived `oilsConsumed` reads 0 on all six. So the fix is
   "point `oilsConsumed` at the reader that is already right", not "write a new
   reader". Census is **15 casts / 24 oils where the truth is 21 / 35**, and the
   incidence is **40% of casts** in the current regime. Needs a go-ahead, not a
   design.
2. **`boons.test.ts` is one pin away from unblocking two verification tools.**
   Three sessions declined it as inert; none of them noted it had become the
   sole blocker. Worth a brief that says explicitly whether to fix or keep
   deferring.
3. **The redraw shadow now has a real signal and a real puzzle.** 4/24 (16.7%)
   against 0/52, Fisher p = 0.008. The candidate fires far more often in short
   casts than long ones, which is the opposite of what a "dead hand" trigger
   should do. Worth one more batch aimed at that, not at the fire rate.
4. **Card 35 is a concrete, observed cost of TASKS.md §13 being unstarted** —
   the bot acquired more of a card that cannot hit from one whole column. One
   instance; do not quote it as a quantified cost.
5. **§34 (10 POSTs, 9 charged) needs nothing unless it recurs.** If it does,
   capture the `start_run` RESPONSE body for the uncharged cast.
6. **The rod: ~20 of the user's ~40-cast horizon from 2026-08-24 is now spent.**
   `rodDeck.test.ts` goes red when it runs dry; that is designed.

## Files changed
```
 2 commits, 58 files (+33452 / -164), 10 new cast fixtures.

  M  src/sim/fishing/castEra.ts             §1 three-era model, FOCUS_DRY_BOUNDARY,
                                            meanOptimalGap, OverspendArm.optimalSd
  M  tests/fishing/castEra.test.ts          §1 rewritten; red assertion replaced
  M  scripts/redrawCounterfactual.ts        §1 three-arm reporting
  M  scripts/focusProfileCheck.ts           §1 gate keyed on `!== "preOil"`
  M  QUESTIONS.md                           §32 ANSWERED; §33 OPENED + UPDATE; §34
  M  handoff/DECISIONS.md                   10 entries
  M  tests/fishing/{oilReachability,matcherHeadroom,zoneTemplate}.test.ts
  M  tests/fishing/{redrawCounterfactual,stateFields}.test.ts
  M  tests/sim/fishingCorpus.test.ts
  A  fixtures/fishing-casts/live/cast-2026-08-24-22-3*  (10 new casts)
  M  handoff/reports/{fishing-casts,dungeon-runs}.md
  M  handoff/STATE.md, handoff/log/session-92.md
```

---

# Verbose appendix

## §1 — how the boundary was actually found (the path, not just the answer)

The brief proposed two boundaries, both anchored on the double-lethal wiring,
and explicitly said not to force either. The route to rejecting them was:

1. **`openingOverspendByDay` already existed** (session 85) and gave the daily
   series immediately. `meanOptimal` bounces 0.400 → 1.000 across days with no
   trend — the first sign that a 0.01 bound on a difference of two such means
   was measuring nothing.
2. **Computing the standard error settled the `meanOptimal` half in one step.**
   sd ≈ 0.65, n = 93 and 62 → SE(diff) = 0.112. The 0.01 bound is 1/10 of one
   SE. Session 89's 0.0062 is gap/SE = 0.06; session 91's 0.0250 is 0.25. Both
   consistent with identical difficulty. The premise was never falsified.
3. **The budget-zero rate by DAY is what broke the era open:**
   `08-21 1.8% / 08-22 1.4% / 08-23 0.0% / 08-24 25.9%`. One day, inside
   "today's era", reading twenty times the rest.
4. **Splitting 08-24 by deck nearly sent this the wrong way.** The 00:0x cluster
   is 17 base-deck / 3 rod, and base read 23.0% against rod's 0.0% — which looks
   exactly like the §29 durability window explaining everything. It does not:
   the 19:1x cluster is **all rod-dealt** and reads **36.5%**.
5. **`oil_trigger_no_stock` carries `itemId`.** 36 refusals on 08-24, **all
   942**. That named the mechanism. Cross-checked against
   `use_fishing_item` POSTs per day: Focus 13 / 7 / 3 / 3, then zero.
6. **The instant is bracketed to 5.6 seconds** — last 942 POST
   `00:02:51.543Z`, first refusal `00:02:57.148Z`.

**What made this findable was field-level log data, not reasoning.** Neither
proposed boundary could have been rejected from the summary tables alone.

## §1 — the exact three-era recomputation (188-cast corpus)

```
  arm           casts plays  bz    rate    1stSpend max frozen  res/caught
  preOil          94   410  184  0.4488     1.5532   3     56      93/14
  oilSupplied     62   235    4  0.0170     0.8065   2      3      62/39
  focusDry        32   130   37  0.2846     0.9063   3     10      32/16
  all            188   775  225  0.2903     1.1968   3     69     187/69

  ratio preOil/oilSupplied = 26.3659    absolute drop = 0.4318
  rod-dealt: oilSupplied 3/215 (1.40%)   focusDry 21/76 (27.6%)

  decomposition: before 0.4488  standardised 0.3933  noRestore 0.2128
                 today 0.0170   length 0.0555 (12.9% of the drop)  unmatched 0

  redrawCounterfactual   plays both  sac  rescue neither  cost  aAvail rAvail
    preOil                 262  152   24      30      56  1.73   0.672  0.695
    oilSupplied            149  124    3      21       1  1.43   0.852  0.973
    focusDry                82   51    7      10      14  1.50   0.707  0.744
  wilson(21, 22) = [0.7820, 0.9919]

  overspend      casts scored   fp    actual optimal    sd   overspend
    preOil          94     93  7.383  1.5532  0.6559  0.651   0.8973
    oilSupplied     62     62  7.194  0.8065  0.6452  0.704   0.1613
    focusDry        32     32  7.094  0.9063  0.6250  0.660   0.2813

  meanOptimalGap(preOil, oilSupplied): gap 0.01075  SE 0.11198  gap/SE 0.096
  pairwise gap/SE: preOil~oilSupplied 0.10, preOil~focusDry 0.46,
                   oilSupplied~focusDry 0.35   — all indistinguishable
  overspend gap 0.7360, i.e. 68.4x the difficulty gap
```

## §2 — the batch, cast by cast

```
  docId      created                   deck era       turns caught lastHp oils(trace)
  13071770   2026-08-24T22:33:48.871Z  rod  focusDry     2   true      4   0  <- DL #1
  13071774   2026-08-24T22:34:03.717Z  rod  focusDry     6   false    20   0
  13071780   2026-08-24T22:34:20.690Z  rod  focusDry     3   true      0   0
  13071782   2026-08-24T22:34:34.887Z  rod  focusDry     7   false    14   0
  13071784   2026-08-24T22:34:52.933Z  rod  focusDry     3   false    17   0
  13071790   2026-08-24T22:35:06.099Z  rod  focusDry     2   true      4   0  <- DL #2
  13071792   2026-08-24T22:35:22.174Z  rod  focusDry     3   false    17   0
  13071794   2026-08-24T22:35:34.372Z  rod  focusDry     3   true      4   0  <- DL #3
  13071800   2026-08-24T22:35:50.831Z  rod  focusDry     3   false    17   0  <- §34, uncharged
  13071804   2026-08-24T22:36:03.790Z  rod  focusDry     2   true      2   0  <- on-demand lethal
```

`lastHp` 4 / 4 / 4 / 2 with `caught: true` and `oils 0` is §33 visible in one
column: the trace ends before the oil that landed the kill. `13071780` is the
one genuine card kill (lastHp 0).

### The seven `use_fishing_item` POSTs

```
  22:33:51.520  item 937 slot 0   \ DL #1  (fish 4 -> 2 -> 0, CAUGHT)
  22:33:52.911  item 937 slot 1   /
  22:35:08.923  item 937 slot 0   \ DL #2
  22:35:10.402  item 937 slot 1   /
  22:35:38.683  item 937 slot 0   \ DL #3
  22:35:39.985  item 937 slot 1   /
  22:36:06.648  item 937 slot 0     on-demand lethal (single)
```

Events: `oil_double_lethal_fired` × 3, `oil_trigger_no_stock` (942) × 2,
`oil_skipped_cast_complete` × 1, `oil_shadow` × 28. Zero `oil_trigger_threw`.

### §2c-2 — the redraw shadow, per-turn

```
  per-turn records                     24
  coverageBelowK true                   6/24
  conditionMet   true                  22/24
  BOTH true (a fire)                    4/24  = 16.7%   in-sample 2.7%
  budget == 0                           2/24
  coverageBelowK AND budget 0           2/6    <- session 91 had 14/14
  liveRedrawEnabled                     false on all 24

  budget among coverageBelowK turns:  {1: 4, 0: 2}
  budget overall:                     {3: 13, 1: 6, 2: 3, 0: 2}

  P(>= 4 fires in 24 | p = 0.027) = 0.0037
  P(0 fires in 52   | p = 0.027) = 0.241     <- session 91 could not refute
  combined 4/76 = 5.3%
  Fisher exact, 4/24 vs 0/52: p = 0.0083
```

Session 91's anti-correlation was a property of long grinding casts (5.2
decisions/cast), not of the candidate. At 2.4 decisions/cast the meter rarely
empties, so `conditionMet` (which needs budget > 0) is true on 22 of 24 turns
and the conjunction can fire. **The candidate fires MORE in short casts than
long ones, which is backwards for a dead-hand trigger** — that, not the rate,
is the thing worth the next batch.

### The batch summary event session 91 never ran

`redraw_shadow_batch` fired after every cast (cumulative):
```
  cast  1: decisions  1 fires 0 blind 1     cast  6: decisions 17 fires 4 blind 2
  cast  2: decisions  6 fires 3 blind 1     cast  7: decisions 19 fires 4 blind 2
  cast  3: decisions  8 fires 3 blind 1     cast  8: decisions 21 fires 4 blind 3
  cast  4: decisions 14 fires 4 blind 1     cast  9: decisions 23 fires 4 blind 3
  cast  5: decisions 16 fires 4 blind 1     cast 10: decisions 24 fires 4 blind 4
```
All three fires landed in casts 2–4; nothing fired in the last six.

## §34 — the uncharged cast, in full

```
  fishing_ledger_reconciled, taken BEFORE each cast:
    22:33:47  game 10  repo 10  agreed
    22:34:02  game 11  repo 11  agreed
    22:34:19  game 12  repo 12  agreed
    22:34:33  game 13  repo 13  agreed
    22:34:51  game 14  repo 14  agreed
    22:35:04  game 15  repo 15  agreed
    22:35:20  game 16  repo 16  agreed
    22:35:32  game 17  repo 17  agreed
    22:35:49  game 18  repo 18  agreed
    22:36:02  game 18  repo 19  LOWERED   <- cast 9 (13071800) never charged
```
10 `start_run` POSTs, 10 distinct docIds, 10 fixture dirs, 0 `action_failed`.
Post-batch ledger check minutes later: **game 19 / repo 19, agreeing**. Not lag.

## Card 35 — the new guaranteed-miss card

```
  noFootprint plays by card: 1:10  3:5  4:7  6:4  35:1
  card 35 zones: hitZones [1,4,7]  critZones [2]      <- the LEFT COLUMN
  instance: cast 13071774, turn 5, reachable 3, budget 1,
            actualHit false, aimError null, NOT avoidable
  noFootprintAvoidable UNCHANGED at 6
```
Cast 8's loot offer was `(35, 30, 31)` and `chooseNewCard` picked **35** — a
second copy. `TASKS.md` §13 (deck-composition scoring) is NOT STARTED.

## Verification at the final commit

```
  npx tsc --noEmit                 clean
  npx vitest run                   1 failed | 1749 passed (1750)
                                   session start: 2 failed | 1744 passed (1746)
  git diff --check                 clean
  secret scan (diff + exported)    clean
  tests/discoveredShipsClean       8 passed (8)
  raw/ files committed             0
  scripts/preflight.ts             FAILS — 1 failed | 1733 passed | 16 skipped,
                                   one expected JWT ✗, secret scan clean
  scripts/assertionCoverage.ts     BLOCKED — fails closed on a red suite
```
Sole failure: `tests/boons.test.ts > OBSERVED_OFFERS is exactly what the corpus
recorded, room and all`. Carried since session 89, verified inert three times.
