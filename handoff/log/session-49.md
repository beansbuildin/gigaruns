# Session 49 — 2026-08-19 — fishing: the gap that was not a gap, the ring hard-zero, and the focus budget confirmed live

## Status
Session-49 brief: **all six items delivered. §1 and §3 both came back the
OPPOSITE of what the brief predicted, and the live batches settled both.**

Two 5-cast live batches ran, **2 catches each — 4 in 10, the best day on
record.** All-time 8/74 = 10.8% → **12/84 = 14.3%**. No guard trips. 5 of
today's 20 casts deliberately left unspent.

Next: **the focus budget is confirmed as the binding constraint, and the
blocker is that NO HARNESS CAN EVALUATE A FIX.** See "What's broken" #1.

## What works
- **§1 — the live/offline movement gap was never a gap.**
  `scripts/liveGapDiagnostic.ts` runs the brief's four diagnostics. Live top-1
  recomputed by hand = 13.8%, 0 disagreements with the logged `hit` field.
  Predicted sits on its own declared k-ring 24/24 — one coordinate convention.
  1 of 5 casts alternated. **The offline LOO re-derivation of the exact same
  29 turns reproduces the shipped 13.8% exactly** — not a wiring bug.
  It was three compounding comparison errors: turn-0 rows pooled into a figure
  that never scores them (13.8% pooled vs 16.7% comparable); a k=2-heavy batch
  read against a class-MIXED average (k=1 53.6% / k=2 33.9%); and one
  alternating cast whose only corpus peer scores 0/5. Composition-matched
  expectation 30.0% vs observed 16.7% [6.7%, 35.9%] — **INSIDE**.
- **§2 — the ring hard-zero is gone.** `stickyStepDistribution` marginalises a
  two-state Markov chain over the per-turn step count. Gate at 83 clean casts /
  281 transitions: logLoss 1.689 → **1.337**, **zero-prob events 8 → 0 PASS**,
  paired ΔLL −0.351 [−0.982, +0.051]. Shipped as default in `liveFishing.ts`,
  `castSim.ts`, `offPolicyReplay.ts`. **Zero zero-probability events in 56
  live turns.**
- **§3 — all three focus policies built** (`focusBudget.ts`: costCap /
  threshold / schedule) and A/B'd. Invariants tested: a cost-0 placement always
  survives, a LETHAL placement is never blocked.
- **§5 — the backfill, verified from the fixture first.** Ledger now
  **8 attempts / 8 hits / Wilson lower bound 0.6756** (4 new live hits arrived
  in this session's batches). `backfilled`/`source` provenance fields round-trip.
- **§6 — null comparators print on every live readout.** They immediately
  discriminated: batch 1 lost to the k-ring null, batches 2 and 3 beat both.
- Live focus spend instrumented: `focusMoveCost`, `focusRemainingBefore`.
- Suite **718/718**, `tsc --noEmit` clean, `git diff --check` clean, all at the
  final commit. No test writes to a real data path.

## What's broken
1. **THE BLOCKER: no harness can evaluate a focus-budget fix.** The replay
   disables the matcher tier (its own conservatism #3), and that is exactly the
   tier that pulls focus a long way. Opening spend: **live 1.80 of 3** (batch 2
   = 1.80, batch 3 = 1.80, replicated) against the **replay's 0.64**. So the
   §3 A/B measured a system that does not spend: `costCap(2)` and
   `threshold(≤1)` are byte-for-byte inert (+0/−0 casts, identical hit counts)
   and cannot fire. **The null result is uninformative about the policies.**
   The finding is the precondition failure, not the A/B.
2. **The focus budget IS the binding constraint, measured live** (n=56 turns):
   | | turns | realized hit | policy's OWN P(hit) |
   |---|---|---|---|
   | meter EMPTY on entry | 29 (51.8%) | 9/29 = 31.0% | 0.286 |
   | meter has points left | 27 (48.2%) | 13/27 = 48.1% | 0.706 |
   Cast `12991359`: focus moved 3 on turn 0, then sat at `[4,1]` for nine turns
   at `P_hit 0.00, 0.00, 0.01, 0.00, 0.00, 0.00`. **NOT causal** — long casts
   accumulate empty-meter turns AND are the casts going badly.
3. **The turn-0 tier is worse than the plain baseline**, pooled n=15:
   shipped 2/15 LL 3.410, baseline 2/15 LL 2.073, ΔLL **+1.337 [+0.429,
   +2.245]** — excludes zero but heterogeneous (b1 +1.745, b2 +2.291, b3
   −0.025). Real, not settled. Turn 0 is 22% of scored turns.
4. Sticky costs **3 near-tied argmaxes of 281** (Δtop-1 −1.07pp [−3.38, 0.00])
   and +0.051 nats on every constant cast. Small, real, reported not buried.

## Corrections to SPEC.md
- **`DEFAULT_SWITCH_PROBABILITY` 0.025 → 0.05.** A SECOND alternating cast
  appeared (`12991364`: 2,1,2,1,2,1,2,1,2,1) in the very next ten casts.
  Counted: brief "one in ~309" ~0.6% → 73 casts **5/238 = 2.50%** → 83 casts
  **14/284 = 5.25%**. Upward every single time it has been counted. The swept
  optimum tracks the estimator at both sizes. **Do not assume it has settled.**
- **The brief's §1 table does not survive the fixtures** (Claude-chat had no
  fixture access): "live lands on the union-of-rings null to within 0.1pp" is
  FALSE — on those turns the union null is 10.3% and the ring model BEATS it;
  the k-ring null is 20.7%, not 29.3%; offline LOO is 42.6% at 73 casts, not
  the 46.4% quoted (that was the 68-cast figure).
- **The brief's `s` estimate was ~4x too small** — see above.
- **§5c's 1.62 opening spend is a TRANSPOSED-ERA figure** (68 of 73 casts).
  `lossDecomposition.ts` measures the RECORDED corpus, correctly for its own
  question. Era split: transposed 1.66, corrected 1.40, live newest 1.80.
  **The zone fix did NOT fix the overspend** — my own mid-session claim that it
  had was based on n=5 reading 1.00, and the next 5 casts came in at 1.80.
- `scripts/focusBudgetSweep.ts` hard-coded its corrected-map cast list and went
  stale one batch later; now derived from `ringPrediction.jsonl`'s own
  `zoneMapVersion`.
- `ringPredictionReport.ts`'s pinned offline comparators were the 68-cast ones;
  refreshed to 73-cast with a printed warning that they move.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon play, seventh session running).

## Dead ends
- **Do not build the shadow-price focus policy yet.** The brief says "only if
  the cheap three fail." They failed, but they failed because the harness is
  blind to the target (What's broken #1). Building the most expensive
  instrument against an unmeasurable target is the wrong move.
- **Do not A/B any focus policy on the replay** until the matcher tier is in it
  without leaking. The replay's arm spends 36% of what live spends.
- **Do not quote a replay ABSOLUTE as a forecast** (session 48, still standing).
- **Do not re-sweep `focusReserveWeight` or `missPenaltyMultiplier`** (session 48).
- `s = 0` is NOT the pre-session-49 model — it is the sticky arm's degenerate
  case and is *worse* than the mode alone. Use `ReplayOptions.hardRing`.

## Metrics
- **Live, today: 10 casts, 4 caught (40%).** All-time **12/84 = 14.3%**.
  Batch 2: escaped 2t / **CAUGHT 2t** / escaped 3t / **CAUGHT 5t** / escaped 5t.
  Batch 3: escaped 10t / **CAUGHT 6t** / escaped 10t / **CAUGHT 3t** / escaped 10t.
- **The movement model transferred.** Batch 2 ring tier top-1 **41.7%** against
  an offline **42.6%**. Batch 3 30.0%. Zero-prob events across both: **0**.
- **Null comparators, batch 2**: grid 6.3% | union-of-rings 13.3% | k-ring
  26.4% | **SHIPPED MODEL 41.7%** — beats both. Batch 3: 6.3 / 13.4 / 23.3 /
  **26.5%** — beats both. (Batch 1 lost to the k-ring null.)
- **Calibration is fine and improving**: batch 3 predicted 0.415 vs realized
  41.0%; pooled 0.497 vs 35.3% (n=85). Per the brief's own §1d rule this means
  the movement model is fine and the constraint is focus/deck/mana.
- Offline LOO (`fishingRingCV.ts`, hard-ring arm) **at 83 clean casts / 281
  transitions**: k=1 52.1%, k=2 31.9%, all 42.3%. **At 73 casts these were
  53.6 / 33.9 / 42.6** — those are the numbers §1's diagnostic and the report's
  pins use. They move with the corpus; always re-derive before comparing.
- Replay (differences only): shipped caught 22/78, per-turn hit 124/249.
- FACT 1 at 83 clean: 81 constant, 2 alternating, 0 neither. Unit steps 368/368.
- Crits 4 → **8**; discrimination 364/364 corrected vs 357/364 transposed.
- Suite 697 → **718** (+9 sticky, +11 focusBudget, +1 backfill provenance).
- Energy 407 → 288, 120 spent, 12/cast, observed delta matched committed 10/10.
  Guard 15/20 casts, 180/240 energy today.

## Open questions for Claude
1. **How should a focus policy be evaluated?** This is the whole blocker. The
   replay cannot include the matcher tier without leaking (its candidates are
   mined from the same corpus). Options: (a) leave-one-cast-out the MATCHER too
   and accept the cost, (b) a held-out day, (c) an A/B split across live casts
   within a batch, (d) accept live-only evaluation at n=5/batch. **Pick one and
   say why** — no focus work can be gated until this exists.
2. **Is the turn-0 tier finding real?** ΔLL +1.337 [+0.429, +2.245] at n=15,
   but batch 3 alone was −0.025. Cheapest test: log what the ring-unknown-class
   tier WOULD have predicted on turn 0 alongside the matcher, and score both.
   That is free and needs no policy change.
3. **QUESTIONS.md §18 — the `nextPosition` override gate.** Ledger is 8/8,
   bound 0.6756, threshold is 10 attempts. **It is now TWO short, and the field
   clusters** — this session's 10 casts produced 4 attempts, so ~5 more casts
   reaches n=10. My own first draft of §18 said 80-160 casts; that was wrong.
   The cheapest answer is probably "wait one batch," not "re-specify the gate."
4. **`DEFAULT_SWITCH_PROBABILITY` has risen every time it was counted.** Should
   it be estimated at load time from the corpus rather than shipped as a
   constant? The estimator and the sweep have agreed at both corpus sizes.
5. 5 of today's 20 casts unspent. Cap resets 11:00 Pacific.

## Files changed
```
 90 files changed, 44277 insertions(+), 48 deletions(-)
 (57 of those are the two batches' new redacted cast fixtures)

     scripts/liveGapDiagnostic.ts        | 420  (§1's four diagnostics)
     scripts/stickyStepSweep.ts          | 262  (§2's paired gate + replay arm)
     scripts/focusBudgetSweep.ts         | 229  (§3's A/B + the precondition check)
     tests/fishing/focusBudget.test.ts   | 169
     src/strategy/fishing/focusBudget.ts | 143  (§3's three policies)
     scripts/ringPredictionReport.ts     | 124  (§6's null comparators)
     src/strategy/fishing/stepClass.ts   |  98  (§2's sticky latent)
     tests/fishing/stepClass.test.ts     |  88
     src/sim/fishing/offPolicyReplay.ts  |  85  (sticky default + hardRing arm)
     scripts/liveFishing.ts              |  61  (sticky wiring, focus spend, §5)
     src/strategy/fishing/cardChoice.ts  |  54  (FocusSpendConstraint)
     tests/liveFishing.test.ts           |  32
     src/sim/fishing/castSim.ts          |  22
     SPEC-fishing.md, QUESTIONS.md       (FACT 1's fix, §3's correction, §18)
```

---

# Appendix — full outputs

## §1 — `scripts/liveGapDiagnostic.ts`, verbatim

```
▸ liveGapDiagnostic.ts — data/ringPrediction.jsonl + data/fish-patterns.jsonl
  49 logged prediction rows total; 29 on the CORRECTED zone map across 5 cast(s).
  corpus: 312 transitions, 74 casts, 73 clean.

── §1.1 live top-1, recomputed by hand from the raw rows ──
  by hand (predicted === actual): 4/29 = 13.8%  [5.5%, 30.6%]
  the rows' own `hit` field:      4/29
  rows where the two disagree:    0  → no aggregation bug
  turn>=1 only (the offline LOO's scored set): 4/24 = 16.7%

── §1.4 coordinate convention, end to end ──
  rows with a corpus `from`:                       29/29
  logged `actual` === corpus `to`:                 29/29
  logged `predicted` sits on its OWN declared k-ring: 24/24  → one convention throughout

── §1.3 per-cast step-count alternation in the batch ──
  12988700  steps=[1,2,1,2,1,2]  ALTERNATES
  12988705  steps=[1,1,1,1]      constant k=1
  12988708  steps=[2,2,2,2,2,2,2,2]    constant k=2
  12988710  steps=[2,2,2,2,2,2,2,2,2]  constant k=2
  12988717  steps=[2,2]          constant k=2
  1 of 5 casts alternated.

── §1.2 null models and an offline re-derivation, on the SAME live turns ──
  null: uniform over the whole grid              n= 29  top1=1/29 =   3.4%  logLoss= 2.773  zeroP=0
  null: uniform over the UNION of both rings     n= 29  top1=3/29 =  10.3%  logLoss= 2.011  zeroP=0
  null: uniform over the legal k-ring (k causal) n= 29  top1=6/29 =  20.7%  logLoss= 3.482  zeroP=3
  ring+conditional, re-derived offline (LOO)     n= 29  top1=4/29 =  13.8%  logLoss= 3.555  zeroP=3
  the LOGGED live distribution (what shipped)    n= 29  top1=4/29 =  13.8%  logLoss= 3.917  zeroP=3
  the logged paired baseline (contextual)        n= 29  top1=6/29 =  20.7%  logLoss= 6.398  zeroP=7

── §1.2b what should this batch's composition have scored? ──
  corpus leave-one-cast-out top-1, stratified:
    alternating   1 cast(s)  0/5 = 0.0%
    k=1          36 cast(s)  60/112 = 53.6%
    k=2          36 cast(s)  40/118 = 33.9%

  the batch, cast by cast (turn>=1, matching the offline scored set):
    12988700  alternating  5 turn(s)  stratum rate  0.0%  expected 0.00  observed 0
    12988705  k=1          3 turn(s)  stratum rate 54.1%  expected 1.62  observed 1
    12988708  k=2          7 turn(s)  stratum rate 35.1%  expected 2.46  observed 1
    12988710  k=2          8 turn(s)  stratum rate 34.5%  expected 2.76  observed 2
    12988717  k=2          1 turn(s)  stratum rate 34.2%  expected 0.34  observed 0

  composition-matched expectation: 7.19/24 = 30.0%
  observed:                        4/24 = 16.7%  [6.7%, 35.9%]
  the composition-matched expectation is INSIDE the observed 95% interval → no gap left to explain.

── VERDICT ──
  The offline re-derivation reproduces the shipped numbers EXACTLY on these turns.
  => not a wiring bug. The live distribution IS the model's distribution.
```

**The most useful single sentence from §1**: `fishingRingCV.ts`'s own
session-45 header already warned that reading a k=2-heavy live batch against
the class-MIXED figure "would flatter or damn the model for the wrong reason."
That warning was written in session 45 and not applied to session 48's readout.
The fix was in the repo the whole time.

## §2 — `scripts/stickyStepSweep.ts` at 83 clean casts

```
── the sweep over the switch probability s (leave-one-cast-out) ──
       s     sticky top1   sticky logLoss   sticky zeroP
   0.000     41.3%        2.106          14
   0.005     41.3%        1.408          0
   0.010     41.3%        1.378          0
   0.020     41.3%        1.354          0
   0.025     41.3%        1.347          0
   0.050     41.3%        1.337          0   <- shipped, and the estimator's value
   0.100     41.3%        1.354          0
   0.200     41.3%        1.432          0

── the GATE, paired at the shipped default s=0.05 (n=281 transitions) ──
  shipped (mode + hard ring):  logLoss 1.689   top1 119/281 = 42.3%   zeroP 8
  sticky  (last + marginal):   logLoss 1.337   top1 116/281 = 41.3%   zeroP 0

  paired ΔlogLoss (sticky − shipped): -0.351  [-0.982, 0.051]
  paired Δtop-1   (sticky − shipped): -1.07pp [-3.38pp, 0.00pp]

  zero-probability events: shipped 8 → sticky 0   PASS

  where the log loss actually moves (per cast, |Δ| > 0.2):
    12988700  n=5  ΔlogLoss -8.337   (3 shipped zero-prob event(s))
    12991364  n=9  ΔlogLoss -7.853   (5 shipped zero-prob event(s))
    ...and 79 cast(s) moved by less than 0.2 — the bounded cost on the constant casts.

── the replay arm, paired per cast (73-cast run, before the batches) ──
  before (hard ring):  caught 22/73 = 30.1%   per-turn hit 119/233 = 51.1%
  s = 0 .. 0.05:       identical on both, +0/-0 casts, +0/-0 turns
  s = 0.100:           119/234 = 50.9%, +1/-2 turns
```

The CI's upper end of +0.051 is exactly the per-constant-cast cost at s=0.05 —
a useful sanity check that the cluster bootstrap is doing what it should.

## §3 — `scripts/focusBudgetSweep.ts`, the A/B and the precondition

```
  shipped: caught 22/78 = 28.2%   per-turn hit 124/249 = 49.8%

  ── PRECONDITION: does the replay reproduce the meter-out dynamics at all? ──
    the RECORDED policy, measured off the same traces:
      casts that ever hit focus 0: 61/78 = 78.2%   turns at focus 0: 201/325 = 61.8%
      mean spend on the FIRST move: 1.63 of 3
    ...split by ZONE-MAP ERA:
      transposed map, 68 casts: first move 1.66
      CORRECTED map,  10 casts: first move 1.40
    TODAY's policy in the replay (matcher tier OFF):
      casts that ever hit focus 0: 26/78 = 33.3%   turns at focus 0: 58/249 = 23.3%
      mean spend on the FIRST move: 0.64 of 3
    => the replay's policy spends 39% of what the recorded one did on the opening move.

  policy                       caught          per-turn hit      Δcaught       McNemar p
  costCap(0)                    8/73 =  11.0%    61/212 =  28.8%   +2 / -16      0.001
  costCap(1)                   20/73 =  27.4%   111/227 =  48.9%   +1 / -3       0.625
  costCap(2)                   22/73 =  30.1%   119/233 =  51.1%   +0 / -0       1.000
  threshold(0.1 .. 1)          22/73 =  30.1%   119/233 =  51.1%   +0 / -0       1.000
  threshold(2)                 19/73 =  26.0%   119/242 =  49.2%   +0 / -3       0.250
  schedule(auto)               22/73 =  30.1%   118/230 =  51.3%   +0 / -0       1.000
  schedule(3)/(4)              20/73 =  27.4%                       +0 / -2       0.500
  schedule(6)                  19/73 =  26.0%   110/236 =  46.6%   +2 / -5       0.453
  schedule(8)                  19/73 =  26.0%   108/237 =  45.6%   +3 / -6       0.508
```

**The A/B is void.** Live opening spend is 1.80; the replay's is 0.64. A
harness whose arm does not spend cannot test a policy that constrains spending.
Nothing shipped; the default stays `NO_FOCUS_POLICY`.

## §4 — the two live batches

### Batch 2 (2026-08-19T21:26:58Z)
```
12991310  escaped, 2 turns    12991312  CAUGHT,  2 turns
12991317  escaped, 3 turns    12991320  CAUGHT,  5 turns
12991326  escaped, 5 turns

  ring tier          n=12  top1= 41.7%  logLoss= 1.255  zeroP=0
    k=1              n= 4  top1= 75.0%  logLoss= 0.873   [offline LOO 53.6% / 0.803]
    k=2              n= 8  top1= 25.0%  logLoss= 1.446   [offline LOO 33.9% / 1.455]

  NULL COMPARATORS (n=12 consecutive-turn pairs)
    uniform over the whole grid            6.3%
    uniform over the UNION of both rings  13.3%
    uniform over the legal k-ring         26.4%
    THE SHIPPED MODEL                     41.7%   (5/12)   → beats BOTH
```

### Batch 3 (2026-08-19T21:32:00Z)
```
12991353  escaped, 10 turns   12991355  CAUGHT,  6 turns
12991359  escaped, 10 turns   12991361  CAUGHT,  3 turns
12991364  escaped, 10 turns   <- the SECOND alternating cast: 2,1,2,1,2,1,2,1,2,1

  ring tier          n=30  top1= 30.0%  logLoss= 1.920  zeroP=0

  NULL COMPARATORS (n=34)
    grid 6.3% | union-of-rings 13.4% | k-ring 23.3% | SHIPPED MODEL 26.5% (9/34)  → beats BOTH

  CALIBRATION — near exact
    bucket          n   mean pred   realized
    0.00–0.20      16       0.030       6.3%
    0.20–0.40       4       0.314      50.0%
    0.40–0.60       5       0.484      60.0%
    0.60–0.80       4       0.662      25.0%
    0.80–1.00      10       0.938      90.0%
    OVERALL        39       0.415      41.0%
```

### The focus-spend measurement, both batches
```
  batch2 12991310  moveCost=[3, 0]
  batch2 12991312  moveCost=[2, 1]                    <- CAUGHT
  batch2 12991317  moveCost=[2, 1, 0]
  batch2 12991320  moveCost=[1, 1, 1, 0, 0]           <- CAUGHT
  batch2 12991326  moveCost=[1, 0, 1, 0, 1]
    first move 1.80
  batch3 12991353  moveCost=[0, 2, 0, 1, 0, 0, 0, 0, 0, 0]
  batch3 12991355  moveCost=[3, 0, 0, 0, 0, 0]        <- CAUGHT
  batch3 12991359  moveCost=[3, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  batch3 12991361  moveCost=[2, 0, 1]                 <- CAUGHT
  batch3 12991364  moveCost=[1, 0, 0, 0, 2, 0, 0, 0, 0, 0]
    first move 1.80

  POOLED n=10 casts: first move 1.80 of 3
  by turn: 1.80 0.50 0.38 0.17 0.50 0.00 0.00 0.00 0.00 0.00
  turns entered with EMPTY meter: 29/56 = 51.8%  (recorded corpus 61.8%)
  realized hit at EMPTY meter:  9/29 = 31.0%   vs meter>0: 13/27 = 48.1%
  mean predicted P(hit) at EMPTY: 0.286        vs meter>0: 0.706
```

`12991359` is the failure mode in one line: spend 3 on turn 0, then sit at
`[4,1]` for nine turns playing `P_hit 0.00, 0.00, 0.01, 0.00, 0.00, 0.00`.

### Turn-0 tier, by batch
```
  b1      n= 5  shipped 0/5 LL 3.469 | baseline 1/5 LL 1.724 | ΔLL +1.745 [+0.249, +3.241]
  b2      n= 5  shipped 0/5 LL 4.761 | baseline 1/5 LL 2.470 | ΔLL +2.291 [+1.959, +2.623]
  b3      n= 5  shipped 2/5 LL 1.999 | baseline 0/5 LL 2.023 | ΔLL -0.025 [-1.892, +1.843]
  pooled  n=15  shipped 2/15 LL 3.410| baseline 2/15 LL 2.073| ΔLL +1.337 [+0.429, +2.245]
```
Positive = the shipped turn-0 tier is WORSE than the plain contextual baseline.
Excludes zero pooled, but b3 alone is neutral — real, not settled.

### Calibration by batch
```
  b1      n=29  predicted 0.515  realized  8/29 = 27.6%
  b2      n=17  predicted 0.656  realized  6/17 = 35.3%
  b3      n=39  predicted 0.415  realized 16/39 = 41.0%
  pooled  n=85  predicted 0.497  realized 30/85 = 35.3%
```
Batch 2's apparent miscalibration did not replicate. The residual pooled gap is
plausibly the optimizer's curse — the policy argmaxes a SUM of estimated cell
probabilities, so the placement it picks is the one whose estimate ran high —
but that is a hypothesis, not a finding, and nothing was changed on it.

## §5 — the validation ledger, end of session
```
rows 8, hits 8, Wilson lower bound 0.6756  (threshold: 10 attempts AND bound >= 0.5)
  12975724 t1 [3,4] [3,4] true
  12975728 t3 [3,2] [3,2] true
  12978003 t8 [1,2] [1,2] true
  12956718 t1 [2,4] [2,4] true [backfilled]
  12991353 t3 [4,3] [4,3] true   <- new, batch 3
  12991353 t9 [1,2] [1,2] true   <- new, batch 3
  12991355 t1 [2,3] [2,3] true   <- new, batch 3
  12991355 t5 [3,4] [3,4] true   <- new, batch 3
```
Override still correctly OFF — two attempts short, not six. The field CLUSTERS:
two of ten casts carried it on most turns, eight carried none.

## Surprises, in the order they happened
1. §1 resolved to "no bug anywhere" — the offline model reproduces the live
   number exactly on the same turns. The gap was three comparison errors.
2. The brief's §1 comparator table was wrong in every specific, because its
   author has no fixture access. The eliminations it reported (day leakage,
   drift, clustering) were uncomputable by it and turned out to be unnecessary.
3. `s` was ~4x the brief's estimate at 73 casts, and ~9x by 83 casts.
4. The replay's focus dynamics are nothing like live's (0.64 vs 1.80). I
   concluded mid-session that the zone fix had already fixed the overspend;
   the very next batch refuted that at 1.80.
5. A second alternating cast turned up in the ten casts immediately following
   the first one's discovery, taking the hard ring's zero-prob count 3 → 8.
6. `focusBudgetSweep.ts`'s hard-coded cast list went stale within the same
   session that wrote it — one batch later.
