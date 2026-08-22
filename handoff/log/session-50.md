# session 50 — 2026-08-19 — fishing: the coverage reframe, built and rejected

Commit at handoff: `bba0bdc` (this recap commit; the code and SPEC work is
`7d03fea`, `b529002`, `0e206f6`, `d99c9f6`). Suite 750/750, `tsc --noEmit` clean,
`git diff --check` clean, all at the final commit.

STATE.md carries the summary. This file carries the tables, the mechanism, and
the things that will not fit there.

---

## 0. What the brief asked, and what each item returned

| # | ask | result |
|---|---|---|
| 1 | LOO the matcher in the replay; verify opening spend ≈ live 1.80 | **PASS** — 0.71 → 1.40, inside live's [1.16, 2.44] |
| 2 | re-derive the coverage ceilings at 83 casts | **PASS** — premise reproduces |
| 3 | build horizon-H expected coverage, gate on coverage→hit→catch | **FAIL** — wins coverage, loses hits |
| 4 | turn-0 dual-logging; `s` estimated at load; leave §18 alone | done, done, done (and §18 cleared itself) |
| 5 | live batch under the 5-cast discipline, coverage in the readout | 5 casts, 1 caught |
| 6 | two standing guards into SPEC-fishing.md §9 | done |
| 7 | recap with full verification at the final commit | this |

The honest expectation in the brief was right about the order: the ceiling
table was one command and it could have killed the direction. It did not. The
sweep did, one step later.

---

## 1. The ceiling table (§2)

`npx tsx scripts/focusCoverage.ts` — a dynamic program over (turn, focus cell,
budget spent) per cast, pooled over clean casts. Coverage = the fish's recorded
next cell lies within Chebyshev 1 of the chosen focus. No predictor anywhere in
the scoring path.

At **83 clean casts / 364 scored turns**:

```
| frozen at (2,2), never moves — budget 0             |    61.3% |       223/364 |
| best FIXED placement, hindsight, reachable within 3 |    92.3% |       336/364 |
| optimal schedule at budget 1, hindsight             |    88.5% |       322/364 |
| optimal schedule at budget 2, hindsight             |    97.0% |       353/364 |
| optimal schedule at budget 3, hindsight             |    99.7% |       363/364 |
| optimal schedule at budget 6, hindsight             |   100.0% |       364/364 |
| optimal schedule at budget 12, hindsight            |   100.0% |       364/364 |
cast length: mean 4.39 turns, max 10
```

At **88 clean casts / 388 turns** (after this session's batch): 60.6 / 91.2 /
87.4 / 96.4 / **99.5** / 100.0 / 100.0, mean 4.41 turns.

The brief's figures were 59.7 / 94.7 / 100.0 on a 67-cast snapshot. Same
shape, and it does not matter that the third digit moved.

**A note on the verdict line.** My first version tested `cap3 === capInf`
exactly and printed "budget 3 IS scarce" off a one-turn difference. That is a
threshold error, not a finding — fixed to report the gap in pp with the
threshold stated in the code (1pp) so a future reader can argue with the number
instead of guessing at it.

---

## 2. The LOO matcher (§1)

`src/sim/fishing/patternMining.ts` holds `PROMOTION_THRESHOLD`,
`testPrimitives` and a new `promotePatterns`, moved verbatim out of
`scripts/mineFishPatterns.ts` and re-exported from it, so
`tests/mineFishPatterns.test.ts` and every other import site is untouched.
Re-running the miner reproduces its output exactly (2 promoted:
`perimeterWalk(cw)` at 4 casts, `perimeterWalk(ccw)` at 4 — **8** supporting
casts, not the brief's 7).

`ReplayOptions.matcherTier: "loo"` re-mines from `others` per replayed cast
and runs tier 0 exactly as `liveFishing.ts` does: ring intersection first
(an off-ring candidate is provably wrong), fall through to the ring model if
nothing survives, then mix at `1 - ringFloor`.

Spend profile, 83 traces:

```
matcher OFF   opening 0.71  total 1.89  turns at zero 23.4%  meter-out 28/83
matcher LOO   opening 1.40  total 2.39  turns at zero 45.2%  meter-out 49/83
  by turn OFF: 0.71 0.66 0.49 0.60 0.26 0.30 0 0 0 0
  by turn LOO: 1.40 0.51 0.50 0.37 0.23 0.08 0 0 0 0
```

Live's own opening spend, read off `ringPrediction.jsonl`'s `focusMoveCost`
rather than quoted: `[3,2,2,1,1,0,3,3,2,1]`, mean **1.80**, n=10 casts,
95% CI **[1.16, 2.44]**. The LOO arm's 1.40 is inside it; the off arm's 0.71
is not. `focusBudgetSweep.ts` now states the precondition this way instead of
as a percentage ratio.

### The three spend policies, re-run on the harness that spends

```
  costCap(0)                   11/83 =  13.3%    74/245 =  30.2%   +5 / -18   p=0.011
  costCap(1)                   24/83 =  28.9%   138/297 =  46.5%   +5 / -5    p=1.000
  costCap(2)                   25/83 =  30.1%   142/298 =  47.7%   +1 / -0    p=1.000
  threshold(0.1 .. 1)          24/83 =  28.9%   137/299 =  45.8%   +0 / -0    p=1.000
  threshold(2)                 24/83 =  28.9%   135/297 =  45.5%   +0 / -0    p=1.000
  schedule(ceil(fishHp/best))  24/83 =  28.9%   137/293 =  46.8%   +2 / -2    p=1.000
  schedule(3) / (4)            23/83 =  27.7%   141/301 =  46.8%   +4 / -5    p=1.000
  schedule(6)                  19/83 =  22.9%   125/297 =  42.1%   +6 / -11   p=0.332
  schedule(8)                  21/83 =  25.3%   129/298 =  43.3%   +8 / -11   p=0.648
```

Session 49 could not read its version of this table because the harness did not
spend. Now it does, and the answer is unchanged. The finding moved from
"uninformative" to "informative and null", which is worth something.

---

## 3. The expected-coverage objective (§2/§3) — FAILED

`src/strategy/fishing/coverageFocus.ts`. Forward-simulates the sticky step
model over the joint belief `(cell, lastK, prevDelta)` — the marginal over
cells alone is not enough, because the model conditions on both the last step
count and the previous displacement. At horizon 1 it reproduces
`stickyStepDistribution` exactly, which the test asserts to 12 decimal places;
that assertion is the load-bearing one, because without it every coverage
number would be measuring a second undocumented movement model.

One subtlety found by that test: on the seed step of an unknown-class cast the
switch must **not** fire. The class prior already IS the marginal over both
counts, so applying the chain on top mixes the prior with itself reversed.
Fixed; it changed no sweep result.

Composition with card choice: `chooseCard`/`bestFocusForCard` take an optional
`focusCandidates` list. Coverage picks WHERE, then `chooseCard` restricted to
that one cell picks WHAT. Folding coverage into `score` was rejected on
principle — it would repeat session 48's mistake of encoding a
horizon-dependent quantity as a flat penalty, and it would make the two
objectives inseparable at report time.

### The gate, 83 traces, matcher LOO, paired on 270 (cast, turn) pairs

```
  base (EV placement):  coverage 220/299 = 73.6%   hit 137/299 = 45.8%   conversion 62.3%   caught 24/83
  deck structure: mean 3.57 of 9 zones on the cards the base arm played = 39.7%
  RECORDED policy, same turns: coverage 183/299 = 61.2%   hit 89/299 = 29.8%

  arm             coverage Δ (paired)              hit-rate Δ (paired)              conv    caught
  override H=1    75.2%→89.4% (+45/-6, p=0.000)    46.4%→44.2% (+34/-40, p=0.561)   49.3%   17/83 +5/-12
  override H=2    75.9%→89.6% (+42/-5, p=0.000)    47.0%→43.7% (+32/-41, p=0.349)   48.5%   18/83 +5/-11
  override H=3..5 identical to H=2 — the horizon SATURATES at 2
  blend w=0.5 H=2 74.0%→73.4% (+6/-8,  p=0.791)    46.0%→44.6% (+3/-7,  p=0.344)    60.8%   25/83 +1/-0
  blend w=1 H=3   74.2%→73.5% (+6/-8,  p=0.791)    46.3%→44.6% (+3/-8,  p=0.227)    60.7%   25/83 +1/-0
  blend w=3 H=3   74.2%→75.3% (+7/-4,  p=0.549)    46.3%→44.9% (+3/-7,  p=0.344)    59.7%   24/83 +0/-0
  blend w=6 H=3   72.9%→75.9% (+12/-3, p=0.035)    45.7%→45.7% (+7/-7,  p=1.000)    60.3%   25/83 +1/-0
```

At 88 casts: base 70.6% × 63.9% → hit 45.1%, caught 19/88; override H=2
87.5% (+57/−11, p<0.001) × 46.9% → hit 42.0%, caught 16/88. Same sign.

### The mechanism, measured rather than asserted

The cards actually played average **3.57 of 9 zones**. So **39.7%** is the
conversion a covering window yields with no aiming inside it at all.

- EV placement: conversion 62.3% — **+22.6pp of aiming** over the structure.
- Coverage placement: conversion 48.5% — **+8.8pp**.

It buys window and spends aim, and the product goes down. The card mix is
identical across arms (3.6 zones both), so this is placement quality, not a
card-selection shift.

**Why the blend is inert.** `ev` differences dominate the continuation term at
small `w`; at `w=6` placement starts to move (+12/−3 coverage turns, p=0.035)
and the hit rate still does not budge (+7/−7). There is no weight at which the
trade turns favourable.

---

## 4. The live batch (§5)

5 casts, 1 caught (`12992267`, a Barnaboo, 2 turns). Casts: escaped 6t /
escaped 10t / **CAUGHT 2t** / escaped 3t / escaped 3t. Energy 303→243, 12/cast,
observed delta matched committed 5/5. Guard clean at 240/240, 20/20.

```
── overall ──
  ALL tiers          n=24  top1= 20.8%  logLoss=2.220  zeroP=0
── by predictor tier ──
  matcher            n= 5  top1= 20.0%  logLoss=3.910  zeroP=0
  matcher_ring       n= 1  top1=  0.0%  logLoss=1.325  zeroP=0
  ring               n=18  top1= 22.2%  logLoss=1.800  zeroP=0
── ring tier, by step class ──
  k=1                n= 2  top1=  0.0%  logLoss=1.135   [offline LOO 53.6% / 0.803]
  k=2                n=17  top1= 23.5%  logLoss=1.850   [offline LOO 33.9% / 1.455]
── NULL COMPARATORS (n=19 consecutive-turn pairs) ──
  grid 6.3% | union-of-rings 14.9% | k-ring 26.3% | SHIPPED 21.1%
  => beats the union null, LOSES to the k-ring null.
── CALIBRATION ──
  OVERALL  n=24  mean predicted 0.562  realized 25.0% [12.0%, 44.9%]
── COVERAGE / CONVERSION ──
  coverage 9/24 = 37.5% [21.2%, 57.3%]   conversion 6/9 = 66.7%   product 25.0% = realized
── SHADOW RING TIER ──
  n=6 matcher-overridden turns; top-1 shipped 1/6 vs ring alone 0/6
  paired ΔlogLoss (shipped − ring alone) = +1.300 nats [0.006, 2.593]
```

**The reversal.** Offline the EV placement is 73.6% coverage × 62.3%
conversion, and pushing coverage costs aim — so conversion looked binding.
Live, conversion **held** at 66.7% (above the pooled live 54.5%) and coverage
collapsed to 37.5%. Which half binds is not a property of the policy; it
tracks the movement model's accuracy on the batch. Coverage is downstream of
prediction: when the model is right the window contains the fish and only aim
is left; when it is wrong the window simply misses. A placement objective
cannot rescue the second case — it can only redistribute a window that was
already going to miss.

This is why SPEC-fishing.md §9's section is titled REGIME-DEPENDENT. I
committed it as "conversion is the binding half" first and corrected it an hour
later, once the batch was in. The correction is in the history deliberately.

**The batch's composition.** 17 of 19 scored turns were k=2 — exactly the trap
Guard 1 was written for. Its 21.1% must not be read against the class-mixed
offline 42.6%; read against the class-matched k=2 LOO 33.9% it is 23.5% at
n=17, which is a bad batch rather than an inexplicable one.

**One thing worth watching.** Cast 5 turn 1 played a card at `P_hit 0.00,
ev -3.0` — the hand held nothing that could reach the distribution's support
from a reachable focus. Not a bug (the policy correctly took the least-bad
option), but it is the shape of a turn where the focus meter had already run
out and the model had drifted.

---

## 5. §18 — the `nextPosition` override gate cleared itself

Two more validated attempts this batch (`12992261` turns 3 and 8, both exact).
Ledger **10 attempts / 10 hits / Wilson lower bound 0.7225 / READY = true**.
Both halves of the existing gate are met. Nothing was re-specified, no
threshold was touched, and the two-armed redesign proposed in §18 is moot —
the brief's "wait one batch" was right and it took exactly one batch.

**The override arms on the next live cast and nobody has seen it fire.** It
replaces the whole movement distribution with a point mass
(`certainDistribution`), so it does not nudge the focus — it removes the ring
model from that turn entirely. Its rows carry `tier: "override"` and drop out
of every ring-tier comparator, so a batch dominated by override turns will
produce a much thinner ring readout. §18 records this.

I did not disarm it. Doing so would silently reverse a settled design, which
CLAUDE.md forbids. How to *observe* the first armed batch is a question for
Claude (STATE.md open question 4).

---

## 6. `s`, estimated at load

`estimateSwitchProbability(casts, floor)` in `stepClass.ts`;
`SWITCH_PROBABILITY_FLOOR = 0.025` (the value the corpus itself supported at 73
casts). `liveFishing.ts` calls it and logs the estimate, its `n`, whether the
floor bound it, and the shipped constant it replaces, on every cast:

```
· sticky switch probability s = 4.75% (estimated: 14/295 consecutive hop pairs
  = 4.75%; shipped constant 5.00%)
```

Two corrections to the record:

1. The 83-cast figure was written as **14/284 = 5.25%**. It is **14/281 =
   4.98%** — the denominator is consecutive classifiable hop PAIRS, which is
   what the two-state chain models. Arithmetic, not a change of finding.
2. **It went DOWN**: 4.98% at 83 casts → **4.67% at 88** (14/300; the five new
   casts contributed 19 pairs and zero switches). The brief's "it has risen at
   every single count" is no longer true. Estimating it is still the right
   call — the swept optimum agreed a third time (still 0.050 at 88 casts,
   logLoss 1.368, zero-prob 0) — but the monotone-trend argument for it is
   weaker than the brief stated, and the next brief should not repeat it.

---

## 7. Surprises, in the order they happened

- The ceiling table's own verdict line was wrong before the table was
  (exact-equality threshold on a one-turn gap).
- The horizon **saturates at 2**. H=3, 4 and 5 are byte-for-byte identical to
  H=2. Casts are short (mean 4.4 turns) and a unit-stepping fish does not get
  far; there is nothing for a longer horizon to see.
- The `hit = coverage × conversion` identity held to the decimal on 85
  already-logged live shots (64.7% × 54.5% = 35.3% = 30/85). Nothing needed to
  be captured to get it — `playedFocus` and `actual` have been in the log all
  along.
- The shadow tier produced a CI excluding zero **on its first batch at n=6**,
  landing within 0.04 nats of session 49's independent +1.337. Two
  measurements, different comparators, same sign and magnitude.
- The live batch contradicting the offline conclusion **inside the same
  session** is the one I did not see coming, and it is the most useful thing
  here.
