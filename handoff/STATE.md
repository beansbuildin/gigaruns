# STATE — session 50 — 2026-08-19 — commit d39468c

## Status
Session-50 brief: **all seven items delivered.** The brief's §2 premise
REPRODUCED and the policy built on it **FAILED its own gate** — reported as a
finding, not buried. Then the live batch **reversed the offline conclusion in
the same session**, which is the thing to read first.

5 casts, 1 caught. All-time 12/84 = 14.3% → **13/89 = 14.6%**.

Next: **conversion vs coverage is REGIME-DEPENDENT, and the `nextPosition`
override arms on the next cast without anyone having seen it fire.**

## What works
- **§2 ceiling table — PASS, the premise holds.** `scripts/focusCoverage.ts`,
  83 clean casts / 364 turns: frozen (2,2) **61.3%**, best fixed hindsight
  **92.3%**, budget-3 optimal **99.7%**, budget 6/12 **100.0%**. Budget 3 is
  one turn short of hindsight-perfect; more buys 0.27pp. **Spend quantity was
  never the binding dimension.** Replicates at 88 casts (60.6 / 91.2 / 99.5 /
  100.0).
- **§1 LOO matcher — PASS, precondition MET.** `patternMining.ts` extracts the
  promotion rule out of `mineFishPatterns.ts` verbatim (re-exported; its test
  untouched). `ReplayOptions.matcherTier: "loo"` re-mines from the other casts
  and runs the tier exactly as `liveFishing.ts` does. Opening focus spend
  **0.71 → 1.40** against **live 1.80, 95% CI [1.16, 2.44] at n=10 casts** —
  INSIDE; the matcher-off arm is outside. `focusBudgetSweep.ts --matcher=loo`.
- **Re-running session 49's three spend policies on the now-spending harness:
  still inert or worse.** Every `threshold(θ)` +0/−0 byte for byte,
  `costCap(2)` +1/−0, `costCap(0)` +5/−18 (p=0.011). The null went from
  *uninformative* to *informative*, and it agrees with the ceilings.
- **§3 free items.** `s` estimated at load with a floor, logged with its `n` on
  every cast. Shadow ring tier dual-logged on every matcher-overridden turn.
- **§6 two standing guards in SPEC-fishing.md §9**, plus the coverage
  decomposition printed on every live readout.
- Suite **750/750** (was 718), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final commit. No test writes to a real data path.

## What's broken
1. **§3's gate FAILED. The expected-coverage objective does not ship.**
   `focusCoverageSweep.ts`, 83 traces, matcher LOO, paired on 270 (cast, turn):

   | arm | coverage | conversion | hit | caught |
   |---|---|---|---|---|
   | EV placement (shipped) | 73.6% | **62.3%** | 45.8% | 24/83 |
   | coverage override H=2..5 | **89.6%** (+42/−5, p<0.001) | 48.5% | 43.7% (+32/−41, p=0.35) | 18/83 |
   | blend `ev + w·futureCoverage`, w 0.5–6 | ~flat | ~60% | ~44.6% | 24–25/83 |

   It wins its own objective decisively and does not convert. Mechanism,
   measured: cards played average **3.57 of 9 zones**, so **39.7%** is the
   conversion a covering window gives with NO aiming. EV earns 62.3% (+22.6pp
   of aiming); coverage earns 48.5% (+8.8pp). It buys window and spends aim.
   Card mix identical (3.6z both arms). Replicates at 88 casts.
2. **THE LIVE BATCH REVERSED IT.** n=24 shots: coverage **9/24 = 37.5%**
   [21.2%, 57.3%], conversion **6/9 = 66.7%**, product 25.0% = realized hit
   exactly. Conversion HELD *above* the pooled live 54.5%; coverage collapsed.
   **Which half binds is not a property of the policy — it tracks the movement
   model's accuracy on the batch.** Coverage is downstream of prediction.
3. **The movement model had a bad batch, and it was k=2-heavy** (17 of 19
   scored turns). Live k=2 top-1 **23.5%** (n=17) vs offline LOO 33.9%; k=1
   0/2. Nulls: grid 6.3 | union 14.9 | k-ring **26.3** | **SHIPPED 21.1** —
   beats the union, **LOSES to the k-ring null**. Calibration predicted 0.562
   vs realized 25.0%. Zero-probability events **0** (sticky holding, 5 batches).
4. **The `nextPosition` override arms on the next cast and nobody has seen it
   fire.** Ledger **10/10, Wilson lower bound 0.7225, READY=true**. It replaces
   the whole distribution with a point mass; its rows are `tier: "override"`
   and drop out of every ring comparator.

## Corrections to SPEC.md
- **"Conversion is the binding half" is WRONG as a standing fact** — it is the
  replay's regime only. SPEC-fishing.md §9's section is retitled
  "REGIME-DEPENDENT" and carries both readings; the report's own reference
  block was corrected too, so the readout cannot restate the superseded claim.
  I committed the un-corrected version first and fixed it an hour later.
- **`s` is no longer a shipped constant.** `estimateSwitchProbability(casts,
  floor)`, `SWITCH_PROBABILITY_FLOOR = 0.025`. **The 83-cast figure was
  14/284 = 5.25%; it is 14/281 = 4.98%** — the denominator is consecutive
  classifiable hop PAIRS, which is what the chain models. Arithmetic fix.
- **`s` went DOWN this session: 4.98% (83 casts) → 4.67% (88).** The brief's
  "risen at every single count" is **no longer true**. The swept optimum still
  agrees (0.050 at 88, logLoss 1.368), so estimating it is still right — but
  the monotone-trend argument for it is weaker than the brief stated.
- The mined library is **8** supporting casts (`perimeterWalk(cw)` 4 + `(ccw)`
  4), not the brief's 7.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon play, eighth session running).

## Dead ends
- **Do not rebuild the expected-coverage focus objective.** Override and
  blended forms both built, swept over H∈{1..5} and w∈{0.5,1,2,3,6}, gated on
  coverage→hit→catch, and rejected on two corpus sizes. H saturates at 2.
- **Do not tune spend quantity again.** `focusReserveWeight` (48), `costCap` /
  `threshold` / `schedule` (49, and re-run this session on a harness that DOES
  spend). Three knobs, one dimension, no effect. The ceilings say why.
- **Do not act on the shadow-tier signal yet** — n=6.
- Standing: replay for DIFFERENCES never absolutes (48); do not re-sweep
  `focusReserveWeight` / `missPenaltyMultiplier` (48); `s = 0` is the sticky
  arm's degenerate case, use `ReplayOptions.hardRing` for the real before-arm.

## Metrics
- **Live, this batch: 5 casts, 1 caught (20%)** — `12992267`, a Barnaboo.
  All-time **13/89 = 14.6%**. Today 20/20 casts, 240/240 energy, guard clean,
  observed energy delta matched committed 5/5.
- **Live coverage decomposition, first ever run** (pooled, n=85 shots):
  coverage 64.7% [54.1%, 74.0%] × conversion 54.5% = **35.3%** = realized.
- **Shadow ring tier, first batch**: n=6 matcher-overridden turns, top-1
  shipped 1/6 vs ring alone 0/6, paired **ΔLL +1.300 nats [0.006, 2.593]** —
  CI excludes zero, barely. Lands within 0.04 nats of session 49's +1.337
  turn-0 finding, now against the RIGHT comparator (the ring beneath the tier).
- Replay at 88 casts, matcher LOO: coverage 70.6%, hit 147/326 = 45.1%,
  conversion 63.9%, caught 19/88. Recorded policy same turns: 60.1% / 28.5%.
- Corpus: traces 84→**89**, clean 83→**88**, clean play turns 364→**388**,
  catches 12→**13**, responseDocs 462→**492**, playTurns 368→**392**,
  escaped 71→**75**, crits 8→**10** (discrimination 391/391 corrected vs
  383/391 transposed).
- Suite 718 → **750** (+13 coverageFocus, +6 replay, +5 `s` estimator,
  +3 promotePatterns, +4 focusCandidates, +1 net).

## Open questions for Claude
1. **Coverage or conversion — you now have both answers and they disagree.**
   Replay says conversion (73.6% × 62.3%, and forcing coverage costs aim); the
   live batch says coverage (37.5% × 66.7%). My reading is that coverage is
   downstream of prediction quality, so neither is a lever on its own and the
   real lever is the movement model on k=2. **Is that right, or is there a
   conversion-side change worth making that I dismissed too fast?**
2. **The model lost to the k-ring null on this batch** (21.1% vs 26.3%) — the
   conditional tier not paying for itself. Session 49's batch 1 did this too,
   batches 2 and 3 did not. Is this k=2 composition, or is the conditional
   tier's shrinkage wrong at 88 casts? `fishingRingCV.ts` can sweep it.
3. **The shadow tier says the matcher costs +1.300 nats [0.006, 2.593] at
   n=6**, agreeing with session 49's +1.337 at n=15 against a different
   comparator. Two independent measurements, same sign, same magnitude. **How
   many more turns before this is worth acting on**, and what is the action —
   drop the matcher tier, or floor it harder than `ringFloor` already does?
4. **The `nextPosition` override arms on the next cast.** Should the first
   armed batch be run at 5 casts as usual, or should the ledger keep scoring
   with the override still OFF for one more batch so there is a paired
   before/after? I did not disarm it — that would silently reverse a settled
   design (§18) — but the choice of how to observe it is yours.
5. Today's cap is fully spent (20/20). Next window resets 11:00 Pacific.

## Files changed
```
 53 files changed, 22048 insertions(+), 150 deletions(-)
 (31 of those are the batch's 5 new redacted cast fixtures)

     src/strategy/fishing/coverageFocus.ts   | 268  (§2's objective + forward sim)
     src/sim/fishing/offPolicyReplay.ts      | 249  (LOO matcher, coverage arms)
     scripts/focusCoverageSweep.ts           | 200  (§3's gate)
     scripts/focusCoverage.ts                | 169  (§2's ceiling table)
     tests/fishing/coverageFocus.test.ts     | 180
     src/sim/fishing/patternMining.ts        | 131  (extracted, verbatim)
     scripts/ringPredictionReport.ts         | 114  (coverage + shadow sections)
     tests/fishing/offPolicyReplay.test.ts   | 107
     scripts/mineFishPatterns.ts             | 103  (net −, moved out)
     tests/fishing/stepClass.test.ts         |  78
     src/strategy/fishing/stepClass.ts       |  72  (estimateSwitchProbability)
     tests/fishing/cardChoice.test.ts        |  70
     scripts/focusBudgetSweep.ts             |  61  (--matcher, interval check)
     scripts/liveFishing.ts                  |  58  (estimated s, shadow rows)
     src/strategy/fishing/cardChoice.ts      |  33  (focusCandidates)
     SPEC-fishing.md, QUESTIONS.md           (§9 guards + findings, §18 RESOLVED)
```
