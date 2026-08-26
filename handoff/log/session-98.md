# STATE — session 98 — 2026-08-25 (PT) — code at commit 21b2fa27

## Status
Brief items **§A, §B, §C, §D: ALL DONE. GATE PASS.** §E was a note to carry
forward, not a task, and it is carried in "Open questions" below.

Suite **1936 passed / 1936, 106 files**. `tsc --noEmit` clean,
`git diff --check` clean, secret scan **0 hits on all four patterns**,
`discoveredShipsClean` 8/8.

**Live spend: 9 fishing casts, 108 energy, 8 Mid Relaxing Oils. 0 dungeon
runs.** 9 new cast fixtures committed and redacted (`0xUSER`).

Per-item, as the brief demanded up front: §A done (**and the measurement is
much bigger than expected**); §B done; §C done (**verdict: FLAT, not sharp**);
§D done (**6/9 caught, and the gate had no opportunity to be observed**).

## What works
- **§A — the necessity gate ships at the user's 0.85** (QUESTIONS.md §43/§46).
  Re-derived on the LIVE corpus, not the suspended sim, via a new §3c block in
  `scripts/liveGateFiringRates.ts`: on the **union of every Relaxing
  observation ever recorded, 9 of 24 (37.5%) are now HELD against 0 at
  threshold 1.** Live loop's own record 8/20 (40.0%); replay corpus 4/18
  (22.2%). The nine newly-held values are 0.857 … 0.991. **The gate went from a
  measured no-op to withholding ~3 of every 8 Relaxing spends.**
- **§B — the §2c clean-cast tripwire is RETIRED** (QUESTIONS.md §44). Its only
  evaluating site (`scripts/liveFishing.ts`'s post-batch report) is gone, and
  the live batch output confirms it. Tombstones at `oilBatch.ts`'s
  `cleanCastCap`, its module header, `SESSION_64_LIMITS`, the `clean_cast_cap`
  message, and `eraCatchRate.ts` §5.
- **§C — `scripts/evPerStepDistribution.ts` is new** and answers §27's
  remaining measurement out-of-sample (leave-one-cast-out, no `castSim`).
- **§D — 9 live casts, capped by the ROD not the ledger.** New
  `SESSION_98_LIMITS` (castCap 9) with its nine casts justified at the constant
  per session 66 §4; the cap is structural so a mistyped flag cannot spend a
  tenth. Halted on `cast_cap`, the intended exit.

## What's broken
- ⚠ **§C's verdict is FLAT, not sharp — the movement tax binds on 48.9% of
  decision points.** The reserve term's whole ranking effect is a tax of
  1.00 EV-units per manhattan step (session 95 §G), and it flips the argmax
  when `ΔEV/d < 1.00`. Median is **1.05** — sitting ON the tax. By distance:
  d=1 binds 53.0%, d=2 67.8%, **d=3 90.8% with a median ΔEV/step of −0.01**.
  The term effectively removes long moves from the policy's reach. **No weight
  change is recommended from this and none should be inferred.**
- ⚠ **SESSION 97'S EPSILON TEST WAS VACUOUS.** `almostCertain` summed three
  thirds, which in this summation order is **exactly 1** — so it asserted only
  that a certain kill is certain. It would have stayed green with session 97's
  own bare-`>=` fix reverted. Now `0.7 + 0.2 + 0.1 = 0.9999999999999999`; the
  ORDER is load-bearing (ascending re-sums to exactly 1) and is documented.
- ⚠ **`liveGateFiringRates.ts` §4's standing verdict DOES NOT SURVIVE for the
  Relaxing arm.** *"`pConnect`'s +9.38pp optimism reaches NO live level gate —
  CLOSED BY IRRELEVANCE"* held because every gate sat at `p = 1` and nothing
  reached it. The corpus has mass on **both sides** of 0.85, so correcting an
  optimistic estimator now moves observations across the boundary and changes
  verdicts. Unchanged for the FOCUS arm. `OIL-CONSERVE.md` §7's direction
  argument flips with it: a safety argument at `1`, a risk argument at `0.85`.
- ⚠ **`NECESSITY_EPSILON` is now INERT on the Relaxing arm.** Kept (Focus is
  still `1`; `meetsThreshold` takes arbitrary thresholds), and every assertion
  that exercises it was re-pointed at an explicit threshold of `1`.
- **The 0.85 gate has never been OBSERVED live.** §D gave it 4 opportunities
  and it withheld 0 — see Metrics for why that is not a contradiction.
- Carried, untouched: H2's proc model still blocked on capture (`TASKS.md`
  CAPTURE-1); §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED**;
  §26's shadow ANALYSIS still unwritten (the instrument has run since session
  90 — see Open questions 3).

## Corrections to SPEC.md
- **None this session.** Nine live casts ran and nothing in their responses
  contradicted the spec. `SPEC.md` and `SPEC-fishing.md` untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Corrections to REPO DOCS, which did happen:** `handoff/OIL-CONSERVE.md` now
  has a **§8** recording the threshold move and superseding §7's "no-op"; its
  title and status block were rewritten. `oilTiming.ts`'s doc comments no
  longer call this a "certainty gate" — at 0.85 it withholds on confidence.

## Dead ends
- **Do NOT re-run `scripts/oilConserveSweep.ts`.** `OIL-POLICY.md` §0a forbids
  it by name. **This is the THIRD consecutive brief to ask for it** (97's §1a,
  98's §A named it only to forbid it). Refused again; re-derived live instead.
- **Do not read §D's "gate withheld 0 of 4" as the gate being inert.** Those
  four were double-lethal-band turns at mana 9/8/7/1; the single-lethal arm the
  corpus figure measures never arose at all this batch (every
  `bestKillProbability` in the live record is null).
- **Do not try to separate the shadow from the live policy on the RELAXING arm
  — it is now provably a tie.** At 0.85 the shadowed exchange arm (0.8333) and
  the live gate return the same verdict on every Relaxing observation ever
  recorded; nothing has ever landed in `[0.8333, 0.85)`.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; `dendren.dailyEnergyBudget`
  252 STANDING; `castSim` suspended for this fishery; `costCap` retired.

## Metrics
- **Live: 9 casts, 6 caught = 66.7%, exact 95% CI [29.9%, 92.5%].** 8 oils, 4
  double-lethal firings. That interval contains **every** baseline including
  session 96's 3/10 = 30.0%; **Fisher's exact on the two batches p = 0.179.**
  Neither batch is evidence the autofisher changed.
- **Era, after folding these 9 in:** `focusDry` **26/52 = 50.0%** [36.9, 63.1]
  (was 20/43 = 46.5%) vs `oilSupplied` 62.9% — −12.9pp, intervals OVERLAP,
  still NOT SUPPORTED. `preOil` 14/93 = 15.1%. ALL 79/207 = 38.2%.
- **The gate at 0.85, live:** 4 opportunities, 0 withheld — **all four in the
  double-lethal band, zero single-lethal turns all batch.**
- **§C:** 583 comparable decision points of 723 replayed (140 excluded, 19.4%);
  median ΔEV/step 1.05, mean 1.38, p25 0.13, p75 2.28; **binds 48.9%**.
  Today's era 334 points, binds 47.9%.
- **Opening focus spend: 0.83** [0.69, 0.97] at n=119 (was 0.82 at n=110) —
  unmoved. **§2e's reopening condition NOT met:** turns-at-focus-zero **24.3%**
  against the ~40% bar; fish-at-full 37.0%.
- **Redraw shadow, cumulative:** 0/52, 4/24, 0/2, 0/43, 2/40 = **6 fires in 161
  shadow card decisions (3.7%)**, plus 12 turns reaching no card decision.
- Suite **1890 → 1936**, 105 → 106 files. Corpus 199 → 208 casts.
- **Oils held after the batch: 35 Relaxing (937), 0 Focus (942).**

## Open questions for Claude
1. **THE ROD SWAP IS THE NEXT EVENT, and nothing here can detect it.**
   `rodDeck.ts`: no durability field exists live, so the account owner is the
   only sensor. **Ask the user whether the swap happened before treating
   `REAL_DECK` as changed**, and expect every corpus number keyed to the
   current deck to need a fresh baseline (the Makeshift/Shroom break is the
   precedent). This session cannot claim the rod is healthy — only that all 9
   casts completed.
2. **Does the 48.9% binding fraction warrant revisiting
   `DEFAULT_FOCUS_RESERVE_WEIGHT`?** This session deliberately did not
   recommend one: a binding fraction says how often the term is live, not
   whether its price is right, and session 85's opening-spend evidence points
   the other way. The d=3 result (binds 91%, median ΔEV/step −0.01) is the part
   that might justify a follow-up. **User's call, not an agent's.**
3. **§26's shadow ANALYSIS is the natural next offline task, and the volume is
   now countable: 161 shadow decisions, 6 fires.** Session 95's early
   Fisher's-exact framing (0/52, 4/24, 0/2) is now (…, 0/43, 2/40) on top.
   Whether 161 is enough for an out-of-sample verdict has not been computed —
   compute it before briefing it, the way session 97 priced the matcher
   question at 87–122 turns rather than leaving it vague. `redrawEnabled` and
   `REDRAW_THRESHOLD` stay untouched regardless.
4. **The matcher-library question is unchanged and still expensive** — 87–122
   matcher-active turns. This batch contributed; nothing is settled, and no
   matcher claim was made from it.
5. **Should the 0.85 gate be given an opportunity to be observed?** It has now
   shipped through a full batch without one single-lethal turn arising. If the
   user wants a live read on it specifically, that is a batch-shape question
   (the arm fires at `fishHp <= 2`), not a threshold question.

## Files changed
```
 2 commits (this recap makes 3). 63 new fixture files — 9 live casts.

  M  QUESTIONS.md                     +240  §27 UPDATE (ΔEV/step) and §46
  M  handoff/OIL-CONSERVE.md          +76   §8 = the threshold move
  A  scripts/evPerStepDistribution.ts +300  §C's report
  A  tests/fishing/evPerStep.test.ts  +196  arithmetic + the DRIFT GUARD
  M  scripts/liveGateFiringRates.ts   +69   §3c, and §4's corrected verdict
  M  src/strategy/fishing/oilTiming.ts +147 the 0.85 constant and its docs
  M  src/strategy/fishing/oilBatch.ts +125  SESSION_98_LIMITS, tripwire tombstones
  M  scripts/liveFishing.ts           +43   tripwire removed, new batch shape
  M  scripts/eraCatchRate.ts          +48   §5 marked retired
  M  tests/fishing/oilNecessityComposition.test.ts +143  re-derived at 0.85 (91 -> 120)
  M  tests/fishing/{oilShadowExchangeArm,oilExchangeRate,oilNecessity,oilBatch}.test.ts
  M  tests/fishing/{castEra,matcherHeadroom,oilReachability,redrawCounterfactual,
       stateFields,zoneTemplate}.test.ts, tests/sim/fishingCorpus.test.ts
                                            corpus pins re-blessed, 199 -> 208
```

---

# APPENDIX — session 98, the verbose half

## A1. The §A measurement in full — `npx tsx scripts/liveGateFiringRates.ts` §3c

```
── §3c  THE SHIPPED RELAXING THRESHOLD, ON THE SAME OBSERVATIONS ──
  shipped `RELAXING_ONLY_NECESSITY_THRESHOLDS.relaxing` = 0.85
  live loop's own record             n  20   held at 0.85:   8 40.0%   held at 1:   0   NEWLY held:   8   [0.964, 0.925, 0.961, 0.991, 0.945, 0.914, 0.971, 0.857]
  pre-hoist, recovered offline       n   4   held at 0.85:   1 25.0%   held at 1:   0   NEWLY held:   1   [0.975]
  UNION — every observation ever     n  24   held at 0.85:   9 37.5%   held at 1:   0   NEWLY held:   9   [0.857, 0.914, 0.925, 0.945, 0.961, 0.964, 0.971, 0.975, 0.991]
  replay, whole clean corpus         n  18   held at 0.85:   4 22.2%   held at 1:   0   NEWLY held:   4   [0.990, 0.856, 0.964, 0.868]
```

And the replay's own gate rows moved with the constant, from 0 held to:

```
  era only — 405 turns:            RELAXING gate evaluated  6   held 1   16.7%
  whole clean corpus — 684 turns:  RELAXING gate evaluated 18   held 4   22.2%
```

The §4 verdict line is now SPLIT in two, because folding the two boundaries
together would have silently turned it into "YES" while its own sentence still
said "p = 1":

```
  a level gate at the p = 1 boundary fired anywhere on this evidence: NO
  the RELAXING gate at its shipped 0.85 fired on this evidence:            YES
```

## A2. The §D batch, cast by cast

```
cast 1/9   9 turns   CAUGHT    DOUBLE-LETHAL at fish 3/21, 2 oils
cast 2/9   1 turn    CAUGHT    DOUBLE-LETHAL at fish 3/15, 2 oils
cast 3/9   7 turns   escaped   clean
cast 4/9   3 turns   escaped   clean
cast 5/9   2 turns   CAUGHT    clean
cast 6/9   3 turns   CAUGHT    clean
cast 7/9   2 turns   CAUGHT    DOUBLE-LETHAL at fish 3/15, 2 oils
cast 8/9   3 turns   CAUGHT    DOUBLE-LETHAL at fish 4/18, 2 oils
cast 9/9  10 turns   escaped   clean
▸ BATCH HALT (cast_cap) — 9 of 9 casts completed — the intended exit.
   8 oil(s) consumed along the way; a consume is a capture here, not an exit.
▸ energy: guard-tracked 228 spent, 18 casts this guard-day
```

Preflight, all read before the first POST: game ledger 9/20 spent → 11
available; repo ledger agrees at 9; **43** Mid Relaxing Oil (937) held, 0 Mid
Focus Oil (942); `--dry-run` passed every guard. Oils after: 35.

### The gate's four opportunities, from the batch's own `oil_shadow` records

```
turns recorded (oil_shadow):                    44
single-lethal turns (0 < fishHp <= 2):           0
double-lethal BAND turns with >= 2 held:         4
  of which the pair FIRED:                       4
  => gate WITHHELD the pair:                     0

   turn  9  fishHp 3  mana 1  focusRem 0  hand 3   fired
   turn  1  fishHp 3  mana 9  focusRem 2  hand 2   fired
   turn  2  fishHp 3  mana 8  focusRem 1  hand 1   fired
   turn  3  fishHp 4  mana 7  focusRem 2  hand 3   fired
```

**A withhold is not logged anywhere** — `liveFishing.ts` emits
`oil_double_lethal_fired` on a firing and nothing on a skip, and
`bestKillProbability` lands on the `oil_shadow` record only when the ON-DEMAND
shadow wanted a relaxing. The count above is therefore reconstructed from
`oil_shadow`'s `fishHp` + `heldAtDecision.relaxing`, which every turn carries.
**If a future session wants the withhold rate directly, that event has to be
added.**

### Catch rate, with the arithmetic

```
6/9  = 66.7%   exact (Clopper-Pearson) 95% CI [29.9%, 92.5%]
3/10 = 30.0%   exact 95% CI [6.7%, 65.2%]      (session 96)
Fisher exact, two-sided, 3/10 vs 6/9:  p = 0.179
```

Every baseline sits inside the 6/9 interval: focusDry 50.0%, oilSupplied 62.9%,
all-time 38.2%, today's policy era 55.5%, and session 96's own 30.0%.

## A3. §C's full output

```
  whole clean corpus — 207 casts
    turns replayed 723   comparable 583   excluded (no d>0 candidate) 140 19.4%
    ΔEV/step   min -9.26   p25 0.13   median 1.05   p75 2.28   max 13.19   mean 1.38
    TAX BINDS (< 1.00): 285 of 583 = 48.9%   |   INERT (>= 1.00): 298 = 51.1%
    by manhattan distance (best placement at EXACTLY d, same stayer):
      d=1   n  583   median 0.83   p75 2.25   max 13.19   binds  309 53.0%
      d=2   n  460   median 0.48   p75 1.20   max 4.61   binds  312 67.8%
      d=3   n  316   median -0.01   p75 0.40   max 3.56   binds  287 90.8%
    by meter remaining entering the turn:
      remaining 1   n  123   median 0.46   binds   73 59.3%
      remaining 2   n  144   median 1.39   binds   62 43.1%
      remaining 3   n  316   median 1.06   binds  150 47.5%

  today's era — 119 casts
    turns replayed 444   comparable 334   excluded (no d>0 candidate) 110 24.8%
    ΔEV/step   min -9.26   p25 0.12   median 1.06   p75 2.19   max 13.19   mean 1.34
    TAX BINDS (< 1.00): 160 of 334 = 47.9%   |   INERT (>= 1.00): 174 = 52.1%
      d=1   n  334   median 0.76   binds  181 54.2%
      d=2   n  253   median 0.40   binds  177 70.0%
      d=3   n  185   median -0.02   binds  169 91.4%
```

The two corpora agree to within a percentage point, so this is not an era
artefact.

## A4. The corpus re-blessing, and the two movements worth naming

199 → 208 casts broke 52 assertions across 7 files. All were corpus-size
statistics and all moved in the direction +9 casts / +40 plays implies. Two are
worth reading rather than burying:

- **`zoneTemplate.test.ts`: the two WRONG readings are now exactly tied.**
  `stateBefore` and `previousFishPosition` both score **528 of 860**. The gap
  has run 6 → 4 → 2 → **0** across sessions 90, 91, 96, 98 — a monotone
  narrowing over four batches, which is more than session 90's "noise between
  two wrong readings" predicted. Recorded as an observation, not promoted:
  nothing downstream ranks them and neither is remotely exceptionless. The
  "misleading band" pin is 61.4%, its fifth widening inside 61–63%.
- **`redrawCounterfactual.test.ts`: `sweep[3]`'s numerator un-froze.** Three
  consecutive batches had `rescues` 11 and `sacrifices` 8 unmoved while `fires`
  grew, which earlier recaps read as a frozen numerator. Both moved this batch
  (11→12, 8→9) — by one in each direction, so the net stays 3. The
  frozen-numerator reading is no longer the whole story.

Also re-blessed: corpus 199→208 / 1149→1212 responseDocs / 821→861 playTurns /
73→79 caught / 125→128 escaped, `incomplete` **UNCHANGED at 1 for the ninth
consecutive batch**; four new oil casts `13088831`, `13088834`, `13088849`,
`13088850`, all two-Relaxing double-lethal firings across slots 0 and 1 — the
most double-lethal firings in any single batch on record (previous high was
session 92's three), and the fourth batch running in which the per-cast cap of
2 was REACHED and still did not BIND.

## A5. Surprises, in the order they were found

1. The composition test's epsilon case was vacuous (A/§A above). Found only
   because tightening `expect(p).toBeLessThanOrEqual(1)` to
   `toBeLessThan(1)` failed.
2. At 0.85 the shadow's Relaxing arm can only ever tie the live policy on this
   corpus — no observation has landed in `[0.8333, 0.85)`.
3. `liveGateFiringRates.ts` §4's "CLOSED BY IRRELEVANCE" verdict does not
   survive the move for the Relaxing arm, and the direction argument in
   `OIL-CONSERVE.md` §7 flips from safety to risk.
4. The live batch writes fixtures as it runs, so an analysis script run
   mid-batch reads a growing corpus. §C was re-run after the batch finished;
   the numbers were identical apart from `turns replayed` (721 → 723).
5. Test cells are **1-indexed** (`1..gridSize`); `(0,0)` is off-grid and makes
   `reachableCells` empty. Cost one round of red tests in `evPerStep.test.ts`.
