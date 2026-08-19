# BRIEF — session 50 (fishing)

4 catches in 10 casts, the best day on record, all-time 10.8% → **14.3%**. The
movement model transferred (batch 2 ring top-1 41.7% against an offline 42.6%,
beating both null comparators), the sticky latent did exactly what it was
supposed to (zero-probability events 8 → 0, live and offline), and session 49
correctly identified that the blocker is now evaluation, not modelling.

My corrections first, then the answer to open question 1 — which turns out to
change what the focus policy should even be optimising.

---

## 0. Corrections to me

**The union-of-rings "exact fit" was wrong, and the error is embarrassing in a
specific way.** I scored the null models as corpus-wide averages over 263 turns
and compared them to a 29-turn batch with a different cell composition and a
k=2-heavy class mix. Null-model accuracy depends on the actual cells — legal
ring sizes vary from cell to cell — so the two numbers were never comparable.
On those 29 turns the union null is 10.3% and the ring model **beats** it; the
k-ring null is 20.7%, not 29.3%. That is precisely the composition error
session 49 diagnosed, committed in the same brief where I recommended null
comparators as a guard against exactly this. The recommendation was right; my
own use of it was the wrong way round.

Three more, all the same shape:

- **`s` ≈ 0.6%** — about 4× too small. Counted at 73 casts it was 2.50%, at 83
  it is 5.25%, and it has risen at every count.
- **The 1.62 opening focus spend** was a transposed-era figure (68 of 73
  casts). Era split: transposed 1.66, corrected 1.40, live newest **1.80**.
- **Offline LOO 46.4%** was the 68-cast figure quoted against a 73-cast world;
  it is 42.6% at 73 and 42.3% at 83.

**The generalized rule, and it should go in SPEC-fishing.md §9:** *no corpus
statistic may be quoted without its corpus size, and no comparator may be quoted
without being re-derived at the composition of the thing it is being compared
to.* Every one of these four errors is that rule violated. Session 49's
refreshed pins with a printed "these move" warning is the right mechanism; the
rule is what makes it non-optional.

---

## 1. Open question 1 — how to evaluate a focus policy

Session 49 offers four options. Taking them in turn:

- **(b) held-out day — reject.** I tested this directly on the corpus:
  leave-one-**day**-out scores 47.4% against leave-one-cast-out's 47.4%, and a
  train-on-earlier-days temporal split scores 45.5%. Day is not the leak axis,
  and the days are badly imbalanced (40 of 73 casts on one day). It costs most
  of the data to control something that isn't there.
- **(c) within-batch A/B — reject on power.** At 5 casts a 2-versus-3 split
  cannot resolve anything; catch-rate variance alone is enormous.
- **(d) live-only at n=5 — reject as a gate.** That is the failure mode the
  5-cast rule was introduced to prevent.
- **(a) leave-one-cast-out the matcher too — take it, and the cost objection
  does not survive inspection.** The matcher's mined library is
  `perimeterWalk(cw/ccw)`, promoted from 7 supporting casts by a miner that is
  a pattern match over the corpus. Re-mining 83 times is seconds of compute,
  not a research project. It is also the only option that fixes the actual
  defect: with the matcher off, the distribution is flat, EV differences shrink,
  the movement-cost tie-break dominates and focus never moves (replay spends
  0.64); with the matcher leaking, it is over-confident and moves too much. LOO
  gives the honest middle, and it is the only arm whose *behaviour regime*
  matches live.

**And add a fifth thing they didn't list, because it does most of the work.**

---

## 2. The reframe: measure COVERAGE, and the budget is not the constraint

Define **coverage** = P(the fish's actual next cell lands inside the 3×3 window
around the focus you chose). It is the thing a focus policy actually controls,
it is scored geometrically against a recorded trajectory with **no predictor in
the scoring path at all**, and it bounds everything downstream:

```
hit rate = coverage × conversion
```

— the window must contain the fish before the card's zones can. Live hit rate
is 22/56 = 39.3%, so coverage and conversion are both well under 1 and it
matters enormously which one is binding.

I computed the coverage ceilings by dynamic programming over the 67-cast /
263-transition corpus I have (the pre-session-48 snapshot — **re-derive at 83
casts before acting on it**, per §0's own rule):

| focus policy | coverage |
|---|---|
| frozen at (2,2), never moves — budget 0 | **59.7%** |
| best FIXED placement, hindsight, reachable within 3 | **94.7%** |
| optimal schedule at budget 3, hindsight | **100.0%** |
| optimal schedule at budget 6 or infinite | 100.0% |

**Budget 3 is not scarce.** It is enough for a hindsight-perfect schedule, and
more budget buys literally nothing. One well-chosen *static* placement gets
94.7%. Casts are short (mean 3.9 turns) and a unit-stepping fish does not get
far.

This explains three inert results in a row. `focusReserveWeight`, `costCap` and
`threshold` all regulate **how much** budget to spend. The corpus says how much
was never the problem — **where** is. A policy that spends nothing scores 59.7%
and a policy that spends optimally scores 100%, and the entire gap is placement
quality, not spend quantity.

### The policy that follows, and what it scores

Replace the objective. Focus placement should maximise **expected coverage over
the remaining cast**, not this turn's EV. Card choice stays EV-maximising given
the focus — that separation is clean and keeps `cardChoice.ts` intact.

Concretely: at each turn, choose the reachable focus `f` maximising
`Σ_{h=1..H} P(fish at a cell within Chebyshev 1 of f, h turns ahead)`, forward-
simulating the sticky step model, `H = min(3, estimated turns remaining)`,
ties broken by cheaper move.

| | coverage |
|---|---|
| frozen at (2,2) | 59.7% |
| **horizon-3 expected-coverage policy, in-sample** | **79.1%** |
| **horizon-3 expected-coverage policy, leave-one-cast-out** | **77.2%** |
| best fixed placement, hindsight | 94.7% |

Leave-one-cast-out costs 1.9pp, so it is not an artefact. It captures a bit
over half the headroom between doing nothing and hindsight, and it is perhaps
forty lines against the existing `stickyStepDistribution`.

**Why this also solves the evaluation blocker.** Coverage is scored against the
recorded trajectory geometrically; the predictor enters only through the
*decision*, and that is held constant across arms in a paired comparison. So
coverage A/Bs are far less sensitive to the matcher leak than catch-rate A/Bs —
and combined with §1's LOO-the-matcher fix, the replay becomes usable for focus
work. Coverage is also per-turn and low-variance: ~280 paired turns gives real
power where 78 cast outcomes do not.

**Caveats, stated rather than buried.** The hindsight rows are hindsight and
not achievable. My numbers are on the 67-cast snapshot, not the current 83. And
coverage deliberately ignores conversion — a policy that maximises coverage
while sitting where the deck's zone shapes fit badly could gain coverage and
lose hits. Report both, and report the decomposition.

---

## 3. The other open questions

- **Q2, is the turn-0 tier finding real?** Their proposed test is right and
  costs nothing: log what the ring-unknown-class tier *would* have predicted on
  turn 0 alongside the matcher, and score both. Do that; do not change the
  policy on ΔLL +1.337 [+0.429, +2.245] at n=15 with batch 3 at −0.025. Turn 0
  is 22% of scored turns, so it is worth settling properly rather than quickly.
- **Q3, the `nextPosition` gate.** Their read is right and mine was wrong: I
  estimated 80-160 casts to reach n=10 by treating sightings as independent,
  and the field **clusters** — this session's 10 casts produced 4 attempts.
  At 8/8 with a Wilson bound of 0.6756, **wait one batch**. Do not re-specify a
  gate that is about to clear on its own; that is the expensive answer to a
  problem that solves itself in five casts.
- **Q4, estimate `s` at load time — yes.** It has risen at every single count
  (0.6% → 2.50% → 5.25%) and the swept optimum has tracked the estimator at
  both corpus sizes. A shipped constant is guaranteed stale by construction.
  Estimate from the corpus at load, log the estimate and its `n` on every run,
  and keep a floor so a small corpus cannot drive it to zero. **Do not** treat
  the current value as converged — the trend is monotone and nobody knows where
  it stops.
- **Q5, 5 casts unspent**, cap resets 11:00 Pacific.

## 4. Standing guards, updated

1. **No corpus statistic without its `n`.** No comparator without re-derivation
   at the compared thing's composition. (§0.)
2. **Report coverage alongside hit rate** on every live readout, with the
   `hit = coverage × conversion` decomposition. It says which half to fix, and
   right now nobody knows.
3. Replay for differences only, never absolutes (session 48, standing).

---

## Your task

1. §1 — implement leave-one-cast-out for the **matcher** in the replay, and
   verify the precondition: the LOO arm's opening focus spend should land near
   live's 1.80, not the current 0.64. If it does not, say so and stop before
   A/Bing anything on it.
2. §2 — re-derive the coverage ceiling table at 83 casts. If budget 3 is again
   sufficient for a hindsight-optimal schedule, that settles the focus question:
   **the lever is placement, not spend.**
3. §2 — build the horizon-H expected-coverage focus objective, sweep `H`, and
   gate it on the replay as a paired difference in **coverage first**, then hit
   rate, then catch. Report all three; a coverage gain that does not convert is
   itself a finding about the deck's zone shapes.
4. §3 — the free turn-0 dual-logging (Q2), `s` estimated at load with a floor
   and logged (Q4). Leave the `nextPosition` gate alone (Q3).
5. Then batch under the 5-cast checkpoint discipline, with coverage in the
   readout.
6. §4 — the two new standing guards into SPEC-fishing.md §9.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit.

Honest expectation. The coverage ceiling table is the thing to run first
because it is cheap and it can kill this whole direction in one command: if
budget 3 turns out **not** to be sufficient at 83 casts, then spend quantity
matters after all and §2's reframe is wrong. If it confirms, the last three
inert results stop being three separate null findings and become one
explanation — the code has been tuning the wrong dimension since session 44 —
and the horizon-coverage objective is the first thing built that addresses the
right one.
