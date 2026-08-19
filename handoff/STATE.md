# STATE — session 49 — 2026-08-19 — commit 2b7cce3

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
