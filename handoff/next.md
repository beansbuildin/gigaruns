# BRIEF — session 49 (fishing)

Session 48 ran the batch and found that FACT 1 — my claim, the foundation of
the last five briefs — is wrong. It also produced the first real live readout
in the project's history. Both are taken below, my error first.

---

## 0. FACT 1 was wrong, and the way it was wrong is my error, not the corpus's

`data.lastMovePath` shows the fish always walks **unit steps**. What I called a
"step class `k`, fixed per cast" is a **step count per turn**, 1 or 2,
**constant in 72 of 73 casts — not universally**. Cast `12988700` locked to
k=1 and then landed off-ring three times, producing a log loss of 11.316 with
three zero-probability events against a corpus LOO of 0.803.

The specific failure is precise and worth naming, because it is the same one
that hid the zone transpose for eleven sessions. I derived the claim from
`data/fish-patterns.jsonl`, which projects each turn to its `from`/`to`
endpoints and discards the path between them. **That corpus view cannot
represent a two-unit-step path.** It was structurally incapable of falsifying
"unit steps with a per-turn count" versus "a single jump of fixed size" — so
the 263/263 and 65/65 I reported were not evidence for the second reading over
the first. They were evidence the two are indistinguishable in that projection.

I also asserted "100%, zero counterexamples" from 65 casts. At 73 there is one.
That is the third recorded instance of CLAUDE.md §9 landing on a brief of mine,
and the pattern is now clear enough to state as a rule for my own output:
**an exceptionless count is a claim about the sample's power, not about the
mechanism, until something in the sample could have come out the other way.**

What survives: the fish walks unit steps; the per-turn step count is 1 or 2;
Manhattan displacement has the same parity as the step count; the count is
strongly sticky within a cast. Everything downstream that depends only on
"the next cell is near the current one" is unaffected. What does **not**
survive is treating the ring as a hard constraint — §2.

---

## 1. The live/offline gap — three explanations eliminated, and one that fits exactly

Live top-1 was **4/29 = 13.8%** against an offline LOO of **46.4%**. Session
48's open question 4 calls this unexplained. I tested the three obvious
explanations against the corpus and all three fail:

| hypothesis | test | result |
|---|---|---|
| day-level leakage (fish drawn per day; LOO leaks within a day) | leave-one-**day**-out vs leave-one-cast-out | **47.4% vs 47.4%** — no leakage |
| temporal drift (model stale) | train on all days before the last, test on the last | **45.5%** — no drift |
| turns within a cast are correlated, so CIs are too narrow | intra-cast correlation from the corpus | **ρ = 0.006, design effect 1.01** — clustering changes nothing |

Per-day top-1 under leave-one-day-out is 45.5–60.0% across four days. A
cast-level bootstrap — drawing 5-cast batches from the corpus itself — gives a
median of 47.4% with a 90% interval of **[23.1%, 68.4%]** and
**P(top-1 ≤ 13.8%) = 1.5%**. So the gap is real at roughly the 1.5% tail, and
it is not sampling noise, day effects, drift, or clustering.

**What does fit — exactly.** Scoring uninformed null models on the real corpus:

| model | expected top-1 |
|---|---|
| uniform over the whole 4×4 grid | 6.2% |
| **uniform over the UNION of both rings** | **13.9%** |
| uniform over the legal k-ring, k known | 29.3% |
| ring + conditional model (LOO) | 47.4% |
| **LIVE, session 48** | **13.8%** |

The live number lands on the union-of-both-rings null to within 0.1pp. That is
the score of a model that knows the fish moves one or two steps **and nothing
else** — no step count, no conditional. A model can lose its conditional edge
and fall back to the k-known prior at 29.3%; it cannot systematically score
*below* its own prior unless the step-count information is not reaching the
distribution being scored, or the distribution being scored is not the one the
policy used.

At n=29 this could still be coincidence. It is cheap to settle, and the recent
history argues for settling it: session 48 fixed a `ringPredictionReport.ts`
bug where `argv[2]` silently swallowed `--since` and printed "nothing logged
yet" as an answer — the same defect family as the dead `.message` guard.

**Diagnostic, in order, before any new casts:**

1. **Recompute live top-1 by hand from the raw logged rows**, independently of
   `ringPredictionReport.ts`. If it disagrees with 13.8%, the finding is a
   reporting bug and stops there.
2. **Score all three null models on the same 29 live turns.** If the ring model
   ties the union-null and loses to the k-known-null, the class information is
   not reaching the scoring path — that is a wiring bug, not a modelling one.
3. **Check how many of the 5 casts alternated step count.** One is known
   (`12988700`). If two or three did, the ring lock was wrong for most of the
   batch and §2's fix largely explains the gap on its own.
4. **Verify the logged predicted cell and the actual cell use the same
   coordinate convention** end to end. `position[0]` is the ROW; the zone
   transpose was live for eleven sessions; a second orientation mismatch in the
   logging path is exactly the kind of thing that survives a passing test suite.

---

## 2. The ring hard-zero fix — model the step count per turn, as a sticky latent

Session 48 offers three options: (a) floor off-ring probabilities, (b) model
step count per turn, (c) reclassify on an off-ring observation. **Recommend (b),
implemented as a sticky two-state latent, because done properly it subsumes
both others.**

Model the per-turn step count `n_t ∈ {1,2}` as a two-state Markov chain with a
switch probability `s`, and predict by marginalising:

```
P(next cell) = Σ_n P(n_t = n | history) · P(next cell | current cell, n, prevDelta)
```

- **`s` is estimable**: one switch observed across ~309 transitions. With
  Laplace smoothing that is roughly **0.5–0.7%**. Sweep it on the replay
  rather than fixing it by hand.
- **The floor falls out for free.** Off-"ring" cells get the small mass that
  the count switched — about `s` spread over the alternate ring's ~4 cells,
  so ~0.15% each, capping a surprise at ~6.5 nats instead of the 11.3 seen or
  the ∞ that a true zero implies. **No arbitrary floor constant to justify**,
  which is why this beats (a).
- **Reclassification is automatic.** An off-ring observation updates the
  posterior on `n_t` by Bayes on the next turn, which is (c) without a special
  case — and unlike (c) it acts *before* the damage rather than after.

Gate it on the replay as a paired difference against the current hard-zero
model, and report log loss **and** the count of zero-probability events. The
second number should go to zero by construction; if it does not, the
implementation is wrong.

---

## 3. Focus is the binding constraint, and the reserve term was the wrong instrument

The decomposition is unambiguous and it is the most valuable thing session 48
produced: **80.8% of casts escape by meter-out** at a mean final `focusMeter`
of 0.25; **50.4% of all turns (192/381) are played at zero focus**; 56 of 73
casts empty the meter. The focus profile by turn is

```
3.00 → 1.38 → 0.72 → 0.36 → 0.14 → 0.04 → 0.00 → 0.00 → 0.00
```

**The first move alone spends 1.62 of 3 points on average.** That is the entire
problem in one number, and it is the same finding session 44 made — but now
measured on real trajectories rather than in a sim, and now with the knowledge
that `focusReserveWeight` is **inert**: w=0 and w=3 are indistinguishable on
73 real traces, w≥4 is monotonically worse.

**Why the reserve term was always going to be inert**, and this is worth
writing down so it is not retried in another form: it adds a *fixed penalty*
proportional to budget retained. But the policy's problem is not that it
undervalues retention — it is that it has no representation of **how many
turns remain and what a point will be worth in them**. A constant penalty
either loses to a real EV gain every turn (w small: inert) or blocks moves that
are genuinely correct (w large: worse). There is no value of a constant that
encodes an opportunity cost that changes with the turn index. Session 45's
brief proposed the secondary refinement of tapering the weight by remaining
turns and it was never built; that instinct was right and the flat version was
the part that could not work.

**Replace the penalty with a budget schedule, and A/B the family on the
replay** — which is exactly what the replay is good for, since these are
differences on fixed trajectories:

- **cost cap**: refuse any move costing more than 1 unless lethal or the only
  affordable option (spreads 3 points over ≥3 turns; directly attacks the
  1.62-point first move). This is the cheapest thing to try and it has been
  proposed twice without ever being run.
- **threshold**: move only when the EV gain over the best stay-put option
  exceeds θ; sweep θ.
- **schedule**: allow at most ⌈3 · t / expectedTurns⌉ cumulative spend by turn
  t; sweep the expected-turns estimate (`isManaConstrained`'s
  `⌈fishHp / bestHitEffect⌉` is the existing building block).
- **shadow price**: charge each move the estimated marginal value of a focus
  point, from a short rollout. Most principled, most expensive; only build it
  if the cheap three all fail.

One caveat on interpretation: the only cast that caught a fish held reserve
throughout. That is a single cast and proves nothing — do not let it become a
premise the way "17/20" nearly did.

---

## 4. Standing: the replay is for differences, never absolutes

Session 48 established this the hard way. The replay's 50.9% per-turn hit rate
matched the mean `pHitPredicted` (0.515) the policy assigned to the same shots,
because resolution and aiming share a movement model fitted to the same corpus.
Live refuted the absolute at p=0.012. The replay remains the best offline
evidence this project has for **paired comparisons on fixed trajectories** —
§2 and §3 both depend on it — but no absolute rate from it should ever appear
in a brief or a gate again, including mine. Record that in SPEC-fishing.md §9
next to the existing calibration discount.

---

## 5. Small decisions

- **`nextMovePath` backfill (open question 3): do it, with provenance.** The
  fourth observation (`12956718` t1, predicted/realized `[2,4]`) is verifiable
  from the fixture, so this is recovering a record that was always true, not
  inventing one. Add a `backfilled: true` field so the gate's audit trail shows
  exactly which rows were not written by the live path. Lower bound moves to
  0.51, still under the 10-attempt threshold — which is the honest outcome.
- **Worth raising, as your decision, not mine to take:** the 10-attempt Wilson
  gate was designed when the field's *meaning* was unknown. It is now known —
  six of six decode to valid unit-step paths ending on `nextPosition` under the
  confirmed row-major identity, four of four realized exactly including the
  path. That is structural evidence the hit count does not capture. At ~1-2% of
  turns and ~6 turns per cast, reaching 10 attempts takes roughly 80-160 more
  casts. Consider a two-armed gate — structural decode valid **and** Wilson
  lower bound ≥ 0.5 at n ≥ 5 — rather than waiting a month for a threshold set
  under different information. Do not change it unilaterally.
- **Unspent casts (open question 5): 15 remain today.** Under §0b they are
  three batches, each behind a checkpoint. But §1's diagnostic is free and
  strictly ordered before them — if live top-1 is a reporting bug, a batch
  spent before finding that out is a batch spent measuring the wrong thing.
  **Run §1's diagnostic first, then batch.**

## 6. A standing guard that would have caught §1 immediately

**Report the null-model comparators alongside every live prediction metric,
every time.** Uniform-over-grid, uniform-over-union-of-rings, uniform-over-
k-ring. They cost nothing to compute and they turn "13.8%, which seems low"
into "13.8%, which is exactly the no-information score" — a statement that
diagnoses itself. Add them to `scripts/ringPredictionReport.ts`'s output.

This is the reporting-side analogue of the audit discipline session 47 and 48
built on the derivation side, and it closes the same loop: **a number is not
interpretable until you know what it would be if nothing worked.**

---

## Your task

1. §1's four diagnostics, **before spending any cast.** Report which of the
   four explains the gap, or report plainly that none does.
2. §2 — implement the sticky step-count latent, gate on the replay as a paired
   difference, and report zero-probability-event count alongside log loss.
3. §3 — build and A/B the three cheap focus-budget policies on the replay
   (cost cap, threshold, schedule). Shadow price only if all three fail.
4. Then, and only then, batch under §0b's checkpoint discipline — with §6's
   null comparators in the readout.
5. §5 — the backfill with its provenance flag. Raise the gate question, do not
   decide it.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit.

Honest expectation: §1 resolves to either a wiring bug or the step-count lock,
and both are fixable. §3 is where the catch rate actually lives now — 80.8%
meter-out with an empty meter is not a prediction problem, and no further
improvement to the movement model will move it. If the cost cap alone
recovers a meaningful slice of the replay's catch rate, that is the session's
result and it will have cost almost nothing to find.
