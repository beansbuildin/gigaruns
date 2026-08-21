# BRIEF — session 68

## STOP — the JWT is expired. Nothing live works until the user refreshes it.

*Source: session 67, decoded locally without printing the token.* `exp` =
**2026-08-21 17:54:17 UTC = 10:54 PT**, six minutes before today's rollover.
Session 67's ledger read returned **HTTP 401**, so **today's `dayDocs` and
`dayProgressEntities` are UNKNOWN.**

**First action, before anything else:**

```
npx tsx scripts/doctor.ts
```

It decodes `exp` locally and answers this in about a second. **If the token is
still expired, stop and tell the user** — do not attempt a cast, do not retry,
and do not treat a 401 as a transient error. Rule 13's converse applies: a
credential failure is not a ledger reading, and an unknown ledger is not an
empty one.

**Make `doctor.ts` the standing first command of every session** (session 67
open question 3). It would have caught this in one second instead of at the
first live call.

*Environment note, sessions 66–67: `npx tsx` and `git` both fail under the
command sandbox on this machine (`EPERM …tsx-501/*.pipe`; `unable to access
'~/.gitconfig'`). Run both unsandboxed. Not a repo problem.*

---

## 1. The conserving oil policy — SHADOW ONLY. Do not ship it.

**User decision, 2026-08-21:** hold `conserve(r=1,f=1)`. Keep `onDemandTriggers`
live, run the conserving gate in **shadow**, log what it *would* have skipped,
and switch only after seeing it against live casts.

`policyApproved` stays **false**. `liveFishing.ts` keeps playing
`onDemandTriggers`. The conserving code is written and tested (session 67) and
stays unwired.

### 1a. Shadow must be provably inert, not intended to be inert

This is gate 1 and it is the whole risk. A shadow evaluator that touches the live
decision is worse than no shadow at all, because it changes the thing it is
measuring while looking like an observer.

- The live decision must be **byte-identical with shadow on and shadow off.**
- **Demonstrate the test failing** when the shadow path is allowed to influence
  the decision, then restore. Session 66's lesson stands: a source-text pin
  proves a line exists, not that it runs.
- Shadow evaluation must not consume, must not mutate stock, and must not write
  anything the live path reads back.

### 1b. What shadow can and cannot establish — state this in the recap, not after

**It cannot tell you whether skipping would have cost a fish.** The oil is
actually spent by the live policy, so the counterfactual outcome is
unobservable. A cast where on-demand spent, shadow said skip, and the fish was
caught does **not** confirm the saving — the oil was in play.

What it genuinely validates, and these are the things that break on contact:

- **Firing rate.** Does the necessity condition fire at the rate the sim
  predicted — *sim-derived: 55.8% of lethal triggers occur when a card already
  kills with probability exactly 1*?
- **Input distribution.** Are `bestKillProbability` and `bestConnectProbability`
  bimodal live as they are in the corpus (*corpus-measured: 34.3% at 0, 55.8% at
  1, 9.9% between*)? If they are smooth live, the "no constant to defend"
  argument for the threshold weakens and should be reported as weakened.
- **Sanity.** Does the gate ever produce a nonsense decision — skip with no card
  in hand, fire with a certain kill available, throw, or disagree with itself
  across two evaluations of the same state?

### 1c. Five casts is a smoke test, not a validation — say so up front

*Corpus-measured:* the Focus trigger is reachable in ~55% of casts, so **five
casts yields roughly two or three shadow decision points.** That is enough to
catch a gross error and nowhere near enough to estimate a rate.

*Live-measured, session 65:* stock is **Relaxing 0, Focus 18.** So the
**Relaxing arm of the gate cannot be exercised live at all** this session — every
lethal trigger goes OIL-POLICY-DRY. Only the Focus arm meets real inputs.
**Do not report the gate as validated on the strength of the Focus arm alone.**

---

## 2. Five live casts

**User decision, 2026-08-21: five casts to start**, after the JWT is refreshed.

- Policy is **unchanged** — `onDemandTriggers`, never force a consume.
- Halt on: five casts done; the ledger short of five; or the 15-cast zero-streak
  tripwire. **Do not stop on an oil consume** — the shape is session 65's, not
  session 64's.
- **If the ledger reads fewer than five casts remaining, cast what remains and
  say so.** Do not wait for a rollover and do not exceed the count.
- Per-cast instrumentation as established: `oilCastState` first, trigger
  reachability by the pinned definitions, full `fishHp` and `focusMeter`
  trajectories, turns, outcome, focus spend — plus §1's shadow record.
- Rule 13 after the batch: read the ledger, confirm it moved by exactly the casts
  sent.

---

## 3. Make the test suite portable — split by what each file is actually testing

**User decision, 2026-08-21.** *Source: session 67 clean-export run —* **4 failed
| 1264 passed, and 11 that never ran.**

The four files are doing different jobs and one blanket policy would be wrong for
at least one of them. Decide each on what it tests:

| file | reads | what it is really testing |
|---|---|---|
| `matcherVerdict.test.ts` | `data/ringPrediction.jsonl` | **program logic** — it pins §19's closed rule |
| `reversalDispersion.test.ts` | `data/fish-patterns.jsonl` | mined-pattern analysis over the author's corpus |
| `rejectionAudit.test.ts` | `logs/` | the author's own captures |
| `redact.test.ts` | `handoff/` | the redaction function, applied to the author's docs |

- **Program logic ships with synthetic fixtures and always runs.**
  `matcherVerdict.test.ts` guards a rule that is now closed and load-bearing; it
  should not stop shipping with the code it guards, and it should not depend on
  the author's accumulated predictions to assert a rule.
- **`redact.test.ts` is probably two tests wearing one hat** — the redaction
  *function* is program logic and deserves synthetic input; the sweep over
  `handoff/` is an author-data check. Split it rather than skipping both halves.
- **Author-data tests get a LOUD skip-guard**, or leave the ships list. A silent
  skip is the same failure mode as a vacuous assertion: green, and testing
  nothing. Whatever you choose, it must be visibly different at home from a pass.

### 3a. Fix the collection-time throw regardless of the portability decision

`rejectionAudit.test.ts` throws **at collection**, so it contributes **0 tests
instead of 11**, and the drop is only findable by diffing JSON reporters. That is
a suite-integrity bug independent of portability, and it is the same family this
repo keeps catching — a green-looking suite asserting less than it appears to.

**The fix is structural: move the data load inside `beforeAll` or the test body,
never at module top level.** A file that cannot be collected cannot report that
it was skipped.

---

## 4. Two small things worth doing while offline work is open

- **`scripts/preflight.ts`** (session 67 open question 4). The distribution
  rehearsal currently lives as an eleven-command incantation inside a report.
  Make it a script so step 5 is repeatable **before every invite**, not once.
  `dist-preflight/` is already gitignored.
- **`fixtures/fishing-casts/live/` holds 110 `cast-*` directories and the corpus
  loads 109.** *Source: session 67, verified with `oilReachability.ts --gap`.*
  One cast does not load. Find out which and why. It is probably nothing — a
  partial capture, an aborted write — but a silently-dropped fixture is a corpus
  statistic quietly computed on a different denominator than anyone thinks, and
  `ls | wc -l` disagreeing with the loader is exactly the kind of gap this repo
  has been punished for.

---

## 5. Carried

- **Do not ship `conserve(r=1,f=1)`** (§1). Do not set `policyApproved: true`.
- **Do not budget casts for the `nextPosition` tripwire.** It fires on ~1–2% of
  turns; five casts buys perhaps one armed turn and most likely none. It sits
  armed until it fires on its own.
- **Do not tune the necessity thresholds.** A tuned pair buys ~0.08pp on a sim
  whose control arm catches 68.71% against the real fishery's 25.9%.
- **Do not quote the sim's ±0.01pp CIs as decision intervals** — they are the
  sim's repeatability, not uncertainty about the fishery. Session 66's corpus
  interval for the Relaxing trigger is ~1.5–20 oils per extra fish.
- **Do not read the per-cast sim tables as answering "conserve for future
  casts."** `runArm` hands every cast a fresh oil; the finite-stock table is a
  separate instrument.
- **Do not loosen the `fakeDoc` observability guard** to a key-set assertion —
  session 67 wrote and rejected exactly that, because it passes for a field
  nothing reads. Widen the observable or drop the field deliberately.
- Distribution steps 3–6 remain the user's; an agent must not create or push the
  repo. §19, rule 8, and corrode-in-`dungeonSim` are **CLOSED** — do not reopen.
- Carried and deliberate: 25 analysis scripts hold hardcoded paths (ratcheted).
- `boonCapture` is settled OFF. **Stop listing it.**

---

## 6. Gate

Both halves are offline and deterministic; neither depends on the batch.

1. **Shadow is provably inert** — the live decision is byte-identical with shadow
   on and off, **demonstrated failing** when the shadow path is permitted to
   influence the decision, then restored.
2. **`rejectionAudit.test.ts` can no longer contribute zero tests silently** —
   the data load moves out of module scope, and the file either runs its 11 or
   reports a visible skip. **Demonstrate the old failure mode is gone** by making
   the data source absent and showing the suite says so.

---

## 7. Do not

- **Do not cast, or run anything live, on an expired JWT.** Stop and report.
- Do not treat a 401 as a transient error or an empty ledger.
- Do not ship the conserving policy, or let shadow touch the live decision.
- Do not claim shadow validated the gate's *outcome* (§1b), or that the gate is
  validated when only the Focus arm was exercised (§1c).
- Do not stop the batch on an oil consume; do not force a consume.
- Do not exceed five casts, or wait for a rollover to reach five.
- Do not fix the four test files by loosening their assertions — the point is a
  stranger's suite asserting *correctly*, not asserting *less*.
- Do not leave a skip silent.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me

- **My §1a instruction to "re-rank first and skip the gate design if that settles
  it" nearly cost the better policy.** The re-rank did reverse the ranking —
  `focus-when-empty-only` at 2.48 oils/fish beats `on-demand` at 3.59 — and if
  the session had stopped there, as I invited it to, it would have shipped a
  policy that **discards 1.9pp of catch rate for nothing.** The conserving gate
  gets 88.38% for 2.42.
- **The error was treating a cheaper answer as a sufficient one.** Re-ranking
  existing arms under a new objective was worth doing and I was right that it was
  free. What was wrong was the sentence licensing the session to stop there:
  **a re-ranking of options someone else chose cannot find an option nobody
  scored.** The directive changed what counts as good, which means the option set
  should have been reopened, not just re-sorted. "Check the cheap thing first" is
  sound; "and stop if it answers" only holds when the cheap thing could have
  produced the best answer.
- **Session 67 was right to keep going**, and its decomposition is why the result
  is trustworthy rather than lucky: Relaxing-gate-only is byte-identical to
  on-demand for 1,182 fewer oils, because 55.8% of lethal triggers fire when a
  card already kills with certainty. That is a mechanism, not a score.

---

## Your task (session 68)

1. **`doctor.ts` first.** If the JWT is expired, stop and tell the user. Nothing
   below §3 runs without it.
2. **§1 / gate 1** — shadow evaluation of `conserve(r=1,f=1)`, provably inert.
   **Do not ship it.**
3. **§2** — five casts under the unchanged policy, with shadow recording.
4. **§1b–1c** — report what shadow established and, explicitly, what it did not.
5. **§3 / gate 2** — split the four test files by what each tests; fix the
   collection-time throw structurally.
6. **§4** — `scripts/preflight.ts`, and find the 110th cast.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** The session's outcome depends on something outside it: if
the JWT is not refreshed, §1's shadow and §2's casts do not happen and the
session is §3 and §4 alone — which is a fine session, and better than a rushed
live one. **The item most likely to be over-claimed is §1.** Shadow mode feels
like validation and is not; it can show the gate's inputs and firing rate survive
contact with a real server, on two or three observations, with half the gate
unexercisable for want of Relaxing stock. Say that plainly, and the next decision
about shipping stays honest.
