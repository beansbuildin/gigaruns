# BRIEF — session 48 (fishing)

Session 47 delivered all six items and then found something that was not on
the list: `ZONE_OFFSET` — the card hitbox template, marked CONFIRMED since
session 12 — was the **transpose** of the truth, and had been for eleven
sessions. Corrected template scores **282/282** against recorded plays; session
12's scored 228/282. `lastMovePath`'s row-major index identity holds 289/289.
Every live cast in this project's history aimed with the wrong map.

That is a genuinely excellent piece of work and it changes what the next batch
means. It also comes with two corrections to my own briefs, taken first.

---

## 0. Corrections to me

**The `fullDeck` draw-reconstruction premise was false, and it was mine.** The
session-47 brief's §1b said "draws are deterministic — `fullDeck` plus
`nextCardIndex` reconstructs the exact sequence." Session 47 measured **0 of
56 refills and 1 of 69 opening hands** matching a `fullDeck` slice. `fullDeck`
is a canonical sorted list; the draw order is a hidden server shuffle. That
premise was the whole basis of the harness I proposed, and it is CLAUDE.md
§9's third recorded instance. The session worked around it and the replay still
landed — but the design I handed over was built on a fact I asserted and never
checked.

**On the zone transpose: my §0 analysis survives, and the reason it survives is
the same reason session 12 missed the bug.** Worth stating explicitly so nobody
re-derives it nervously. The argument in the session-45 brief rests on three
zone sets:

| set | under either table |
|---|---|
| `{2,4,6,8}` | the four orthogonal neighbours — **transpose-symmetric** |
| `{1,3,7,9}` | the four diagonals — **transpose-symmetric** |
| `{1..9}\{5}`, `{1..9}` | the full ring / block — **transpose-symmetric** |

So "the plus card *is* the k=1 ring" and "the X card is the diagonal half of the
k=2 ring" hold under both tables, unchanged. **FACT 1 and FACT 2 are also
untouched** — ring membership is Manhattan distance, which is transpose-
invariant, as are "never reverses" and the k=2 diagonal preference. What *was*
wrong in my §0 table is the row/column triples (`{1,2,3}`, `{1,4,7}`, …), which
swap roles under transpose; any "best card" row naming one of those should be
re-derived. Session 12 fell into exactly this trap from the other direction: it
derived the table from one hit with card 79, `hitZones [2,4,6,8]`, a set that
could not discriminate the two hypotheses.

---

## 1. The 5-cast batch — and it is now materially more informative

Standing policy from session 47 §0a/§0b is unchanged and in force: **ROM energy
is claimable on demand** (preflight now reads pool + bank and claims to the
deficit, `src/orchestrator/energyPreflight.ts`), and **batches are 5 casts,
maximum, with a mandatory checkpoint between**.

What has changed is that the batch now carries a real prior instead of a hope,
and it tests two things at once: the ring model's live transfer, and the
corrected zone map's first live use.

### 1a. Add per-turn hit rate as a first-class checkpoint metric

Session 47's open question 1 asks for this and it is right. Here is the power
calculation, so it can be gated rather than merely reported.

The replay's prior is **50.9% per-turn hit rate** [44.3%, 57.5%] against a
historical realized **27.5%** (60/218). At one 5-cast batch (~50 scored turns):

- 95% CI on a 50-turn hit rate at the predicted 50.9%: **±13.9pp → [37%, 65%]**,
  comfortably clear of 27.5%.
- Two-proportion test against the 218-turn historical baseline: **z ≈ 3.0,
  p ≈ 0.002**.

**One batch is decisive for hit rate**, and hit rate is the statistic the zone
fix moves most directly. It also accumulates ~10× faster than catch rate.

Paired ΔLL is likewise already powered at one batch. Using session 47's own
measured figures (mean 2.115, CI [1.364, 2.866] at n=218, implying sd ≈ 5.7),
at n=50 the CI is roughly **[0.55, 3.69]** — excludes zero.

### 1b. Checkpoint order after every batch — unchanged, with hit rate inserted

1. **FACT 1 violations** — any off-ring move or class-inconsistent cast on the
   `isCleanCast`-filtered corpus (carry cast `12923189`'s duplicate turn-0
   exclusion). **Any violation → stop immediately and report.** Standing: 0/279.
2. **Per-turn hit rate**, with its CI, against the 27.5% historical baseline
   and the 50.9% replay prior. Landing near 50% confirms the zone fix live.
   Landing near 27.5% means the fix did not transfer and something else is
   wrong — stop and report.
3. **Paired ΔLL with 95% CI.** Positive and excluding 0 → the model transfers.
   Includes 0 after two batches (~100 turns) → stop and report.
4. **Calibration curve** — realized hit vs. the `pHitPredicted` the policy
   assigned to the shot it actually played.
5. **Catch rate**, reported separately from the all-time 7/69 = 10.1% and
   explicitly flagged as underpowered at n=5. **Compare it against the replay's
   27.9% as a floor, not a point prediction** — 29 of 68 replayed casts were
   truncated while still live at a mean 43.3% of max fish HP, so the replay is
   conservative by construction.

### 1c. Hard stops between batches

A FACT 1 violation; a guard trip or crash; a `start_run` rejection whose body
you have not read and classified; hit rate not distinguishable from 27.5%;
ΔLL CI containing 0 after two batches. Otherwise continue, up to the server's
20/day (4 batches), resetting 11:00 Pacific.

---

## 2. The `[CONFIRMED]` falsifiability audit — do this in the same session

Session 47's open question 3 proposes it and it should happen now, while the
lesson is fresh and before a fourth instance. The batch itself takes minutes;
this is what fills the session.

**The failure mode, now three times over:** heuristic (d)'s displacement-vs-
class guard, the `.message` server-cap classifier, the zone table. Each had a
real mechanism and an evidence base structurally blind to the specific error.
More care at derivation time would not have caught any of them.

**The method — one pass, one table.** For every `[CONFIRMED]` claim in SPEC.md
and SPEC-fishing.md, record four columns:

| claim | establishing sample | what alternative would that sample have failed to distinguish? | re-scorable against the corpus now? |

The third column is the whole point, and it is the question session 12 did not
ask. Prioritise by two flags:

- **n = 1**, or established before the corpus existed.
- **The sample is symmetric / degenerate with respect to the claim** — the zone
  table's `{2,4,6,8}` is the canonical case. A claim tested only on inputs
  invariant under the competing hypothesis is untested.

Then act on the fourth column: **anything re-scorable, re-score.**
`scripts/auditZoneTemplate.ts` is the template — score the claim against every
recorded instance and report the count, not a spot check. Where a claim is
re-scorable, add the audit script and a corpus-pinned regression test the way
`tests/fishing/zoneTemplate.test.ts` now guards the zone map. Where it is not,
say what capture would make it so and put that in QUESTIONS.md.

This is the guard session 47 identified — *"re-scoring against the corpus once
it is big enough to bite"* — turned into a repeatable pass rather than an
accident.

---

## 3. Two smaller decisions

- **Mark the 20 pre-fix `data/ringPrediction.jsonl` rows.** Session 47 left
  them untouched as a deliberate, reversible choice. Recommend marking rather
  than deleting: add a `zoneMapVersion` field, defaulting existing rows to the
  pre-fix value. Their *predictions* remain valid (movement is zone-independent)
  but any hit or EV field on them reflects mis-aimed shots, and a future session
  will otherwise pool them into a hit-rate figure and quietly drag it down. One
  field, no data loss.
- **Name the replay as the new primary offline gate.** This is the durable
  methodological upgrade from session 47 and it deserves to be stated as
  policy, not left as one script among forty.
  `src/sim/fishing/offPolicyReplay.ts` evaluates a policy change against 68
  real trajectories, leave-one-cast-out, with real decks and real mana curves.
  That is strictly better evidence than the in-sample empirical-fish sim, whose
  own §9 calibration discount exists because it over-predicts live by 2.5-3×.
  **Standing rule to write into SPEC-fishing.md §9: any future strategy change
  is gated on the replay first; the sim is a debugging tool, not evidence.**
  Session 47's own "do not conclude the sim is fine from the sim being
  self-consistent" is the same point — the zone bug was invisible in-sim for
  eleven sessions because the sim applies the table on both sides.

---

## 4. Batch continuation while unattended

The user is away for roughly two hours. Standing policy is 5 casts per batch
with a mandatory checkpoint between, and that does not change — the checkpoint
is the point, not the batch size.

**Authorized: up to 3 batches (15 casts), each preceded by a full checkpoint
evaluation of the previous one, and only while every check in §1b passes.**
Anything in §1c fires → stop, do not start another batch, write it up. Hold the
remaining 5 casts of the day's 20 in reserve so the user has a batch available
when they return. This is my judgment call under the unattended window, stated
so it can be overridden; if in doubt, run one batch and spend the rest of the
session on §2 and §5.

Report each batch separately, never pooled, and keep the running per-class
top-1 as a running figure.

## 5. Extra work for the unattended window, in priority order

The batch takes minutes. §2's audit fills some of the rest. These are the
highest-value remaining items, all offline, all safe to run unattended.

### 5a. Re-derive the best-card table under the corrected zone map

My session-45 §0 Fact 3 table (best card by focus offset, per step class,
scored against the corpus) is valid for the symmetric zone sets and **wrong for
every row/column triple**. Rebuild it with the corrected `ZONE_OFFSET`, scored
against the real transition corpus, and put the corrected table in
SPEC-fishing.md §9. It is the reference anyone reasoning about card choice will
reach for, and right now it half-contradicts the fixed geometry.

### 5b. Use the replay as the gate it now is — A/B the knobs that were never testable

This is the best use of the unattended window. Every one of these was
previously evidenced only by the in-sample sim that needs a 2.5-3× discount;
all are now testable against 68 real trajectories, leave-one-cast-out:

- `focusReserveWeight` — re-sweep **on the replay**, not the sim. `w=3` is a
  sim-derived constant that has never been checked against real trajectories.
- the mined-matcher tier intersected on/off (sim says +5pp; does it survive?)
- `REDRAW_THRESHOLD` — untouched since session 21 and never replay-tested.
- `missPenaltyMultiplier` — SPEC §5 calls it "the ONE tunable knob" and it has
  sat at 1 since it was written.

Report each as a paired difference against the current default on the same
trajectories, with a CI. Change a default only where the CI excludes zero, and
say so; a null result on any of these is a real and publishable finding.

### 5c. Decompose the remaining loss — where did the constraint move?

The replay puts per-turn hit at 50.9% but catch at only 27.9%. That gap is the
next model question and the replay can answer it directly. Per replayed cast,
report the terminal reason (meter / mana / truncated) and the focus-meter
profile by turn. Three candidate constraints, and the decomposition
distinguishes them:

| if | the constraint is |
|---|---|
| meter-outs dominate and focus hits 0 early | the focus budget, still |
| meter-outs dominate with focus intact | the damage economy — hits land but don't out-pace misses |
| mana-outs dominate | cast length / redraw policy |

Whichever it is becomes session 49's §1. Do not fix it this session — measure
it and hand it over.

### 5d. `chooseNewCard`, if time remains

Its own doc comment flags `max(hit,crit)/manaCost` as an unvalidated
placeholder, and with correct geometry it can finally be scored properly:
expected hit rate against the k=1 and k=2 rings at the placements the policy
actually reaches, times damage, minus miss penalty × (1 − p). Gate it on the
replay's marginal sweep (real deck + 1 card), not the sim. Session 46 measured
that marginal effect at ~0-3pp in-sim, so expect small — but it is the one deck
decision the bot actually gets to make.

---

## Your task

1. Preflight per §0a (pool + ROM bank), then run **one 5-cast batch**. Stop.
2. Run `scripts/ringPredictionReport.ts --since=<batch start>` and evaluate
   §1b's checkpoint **in order**. Continue to a second batch only if nothing in
   §1c fired.
3. Report per batch, separately from all-time: FACT 1 violations, **per-turn
   hit rate with CI vs. both 27.5% and 50.9%**, paired ΔLL with CI, per-class
   top-1 as a running figure, the calibration curve, and the batch catch rate
   flagged as underpowered and compared against 27.9% as a floor.
4. §4 — continue to batch 2 and 3 only while every checkpoint passes. Hold 5
   casts in reserve.
5. §2 — the `[CONFIRMED]` falsifiability audit, one table, with re-scoring
   scripts and corpus-pinned regression tests for everything re-scorable.
6. §3 — the `zoneMapVersion` field, and the replay-as-primary-gate rule into
   SPEC-fishing.md §9.
7. §5 — in order: 5a (corrected card table), 5b (replay A/B of the four
   knobs), 5c (loss decomposition — measure, don't fix), 5d if time remains.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit.

Honest expectation. The replay predicts ~51% per-turn hit against 27.5%
historical, and that is the number to watch — it is powered at one batch and it
is the direct consequence of the zone fix. Catch rate at n=5 will be noise
whichever way it falls; do not let a 0/5 or a 3/5 be written up as a verdict.
The outcome worth flagging loudly is hit rate landing near 51% while catch rate
stays low: that would mean aiming is now solved and the binding constraint has
moved to the focus budget or the damage economy, and §1b's calibration curve
plus the replay's own decomposition would be the tools to find out which.
