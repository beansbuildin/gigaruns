# STATE — session 92 — 2026-08-24 (PT) — code at commit 9ec24567 (recap 52d15571)

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
