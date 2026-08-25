> **SUPERSEDED 2026-08-25.** Folded into `handoff/next.md` §2 as a firm part
> of session 97's assignment — per the user's explicit instruction, this is
> no longer a "whenever convenient" document. Kept here only as the
> detailed derivation reference `next.md` §2 points back to. **Work from
> `handoff/next.md`, not this file.**

# BRIEF — diagnose the 30% catch-rate batch: sampling noise, the focusDry era, or a real regression? zero live spend

**This is a third, independent offline document**, alongside
`handoff/next.md` (session 96's brief, already executed),
`handoff/next-ev-per-step.md` (§27, still unstarted), and
`handoff/next-oil-conserve.md` (QUESTIONS.md §39, still unstarted). Run this
whenever it's next convenient. **Read `next-oil-conserve.md`'s §3 before
writing up this brief's §4** — the necessity-gate wiring it derives may
resolve or reframe the §2c oil-trigger tripwire this brief's §4 also asks
about. Whichever of the two sessions runs first should leave a pointer for
the other rather than both re-deriving the same finding independently.

**Zero live spend.** Every question below is answerable from the existing
corpus (`fixtures/fishing-casts/`, `data/run-reports/fishing.jsonl`) and the
existing `handoff/` record. No `start_run`, no `use_fishing_item`, nothing
POSTed to the game.

---

## Where this came from

The user read `handoff/STATE.md` (session 96, commit `8e85487b`) and its §4
line — **3 caught / 7 escaped, 43 shots, 15 hits (34.9%)** — and reacted:
catch rate is "DOWN to 30%," was "~60% on previous sessions," and the
autofisher is "garage now." The instruction was to prep offline work to find
out why, rather than assume a bug and start changing strategy code.

**Do not start this session by looking for a bug to fix.** The user's "~60%"
figure does not match anything in the live-measured record this repo has
written down — the closest candidate is one specific, datable, superseded
number (§1 below) — and the honest all-time live baseline has never been
close to 60% on any real volume. Whether session 96's 30% is actually
abnormal is the first thing to establish, not the last.

---

## 1. Nail down where "~60%" actually comes from — this is a fact-finding step, not an assumption

`handoff/OIL-POLICY.md` line 14 (§0a, session 71, 2026-08-21) is the only
place in the entire `handoff/` tree a "60%" live catch figure appears:

> the real fishery reads meter-out **64.2%** and catch **27.6%** (and **34.3%
> / 60.0%** on the era today's policy actually played)

Read this in context (§0a and §0a-i in full) and confirm, rather than assume,
what "today's era" meant **as of session 71** — at that point in the repo's
history the live oil policy still included **both** triggers from §2's
`on-demand` recommendation: the Focus Oil trigger (`focus-when-empty-only`,
modeled **+17.74pp**, the larger of the two) and the Relaxing Oil lethal
trigger (`lethal-relaxing-only`, modeled **+4.47pp**). **Session 93** (user
directive, 2026-08-24, `handoff/OIL-POLICY.md` §4) withdrew the Focus Oil
trigger from live play entirely — `config/bot.json`'s
`dendren.oils.allowedItemIds` narrowed from `[937, 942]` to `[937]` — and it
has stayed withdrawn through session 96.

Check the git history / STATE.md trail between session 71 and session 93 to
confirm (don't assume) that no live batch since the withdrawal has reported
anything near 60%, and that no live batch report between session 71 and 93
reads 60% either — session 92's STATE.md line 140 reads **5 caught (50%)**
which is the highest recorded live batch rate in that window and still isn't
60. If a literal 60% live number turns up somewhere in `handoff/log/`, cite
it by session and treat it as new evidence; if it doesn't, the §0a-line-14
figure — pre-withdrawal, sim-adjacent, seven sessions stale — is almost
certainly the source of the recollection, and that should be stated plainly
in the write-up rather than left to hang.

**Separately, and worth ruling out explicitly:** `scripts/mineFishPatterns.ts`
and `scripts/minedLibraryGate.ts` both print `castSim`-derived catch numbers
in the 59%–88% range (session 95's miner run: blind 9.2% → mined 59.4%,
N=500; §2's `on-demand` sweep: control 68.71%, on-demand 88.11%). **Every one
of these is suspended from being quoted as live evidence by OIL-POLICY.md
§0a** — the sim's own bare arm reads catch ~81–91% against the real fishery's
27.6%. If the "~60%" recollection traces to one of these prints rather than a
live figure, say so exactly as plainly as the §0a-line-14 case — this repo
has apparently been printing sim numbers in the same range as a stale live
figure, which is exactly the kind of confusion §0a exists to prevent and has
evidently not fully prevented.

## 2. Build the missing measurement: live catch rate, broken out by era, over the full corpus

This is the load-bearing check and it has never been run. `src/sim/fishing/
castEra.ts` (`eraOf`) already classifies casts into `preOil` / `oilSupplied` /
`focusDry` (session 92 §32 re-specified this as a consumable-supply boundary,
not a policy date). Existing reports use `eraOf` for **budget-zero rate**
(QUESTIONS.md §32: preOil 44.9%, oilSupplied ~1.4–7%, focusDry ~36.5%) but
nothing in `handoff/` reports **catch rate** segmented the same way.

- Write or extend a script (`scripts/oilArmCatchCheck.ts` already computes
  catch by oil-arm and is the closest existing convention to reuse or
  pattern-match; `scripts/fishingReport.ts` regenerates
  `handoff/reports/fishing-casts.md` and already has the per-cast
  caught/not-caught data this needs) to report **caught / total casts, by
  `eraOf` classification**, over the full 199-cast corpus.
- State plainly whether `focusDry` reads meaningfully lower than
  `oilSupplied` and `preOil`. The mechanical hypothesis worth testing directly
  (not just asserted): the focus meter **never regenerates within a cast**
  (CONFIRMED session 13, not a sim claim) and the only live-approved top-up
  was the Focus Oil trigger, withdrawn session 93. If `focusDry` casts —
  casts with no oil-based way to un-stick a frozen aim — catch at a
  materially lower rate than `oilSupplied`/`preOil` casts did, **that is a
  real, live-confirmed mechanical explanation for a lower recent catch rate,
  not a bug**, and session 96's batch being **entirely** `focusDry` (STATE.md:
  "all ten new casts classified `focusDry`") would make 30% close to
  expected for its era rather than anomalous.
- Report this segmented by batch/session too if the corpus supports it
  (session 92's batch, pre-withdrawal or early-withdrawal, catching 50% is a
  useful anchor point against session 96's 30%, post-withdrawal).

## 3. Frame session 96's 3/10 with an actual confidence interval before calling it a regression

n=10 is thin. Compute the exact binomial 95% CI for 3/10 and state it next to
the corpus baselines (27.6% bare-arm real / 28.3% live-config pooled / 25.9%
dead-era-excluded / 36.7% all-time corpus, all from `OIL-POLICY.md` and
`handoff/reports/fishing-casts.md`). If the interval comfortably contains
those baselines — it will; 3/10 against a true rate anywhere from roughly
7%–65% is not distinguishable at this sample size — say so explicitly in the
write-up as its own finding, independent of the era question in §2. **A
single 10-cast batch reading 30% is not, by itself, statistical evidence of
anything changing**, even before the era explanation is considered. Do not
let §2's era finding (if it holds) substitute for this point or vice versa —
they are two independent reasons the 30% reading doesn't need a code
regression to explain it, and the write-up should keep them separate.

## 4. Take the two things STATE.md session 96 itself flagged as open, seriously, on their own terms

These are real, and distinct from the "is 30% abnormal" question above — do
not let §§1–3 crowd them out if they resolve first.

- **The §2c oil-trigger tripwire fired**: 9 of 10 clean casts exceeded a
  pre-registered threshold of 6 (~1-in-900 under the model's own ~0.70
  oils/cast assumption). STATE.md's own open question #2 asks for a ruling:
  re-derive the trigger model, retire the tripwire as broken, or accept and
  document the divergence. This is squarely offline work — it's a model
  question about `src/strategy/fishing/oilPolicy.ts` / `oilTiming.ts` and the
  existing corpus, not a live-data gap. Do not defer it again; it's now
  reached the point the tripwire's own pre-registration says warrants a call.
- **The 11-pattern library's first out-of-sample read was weak, at very low
  n.** On the 20 matcher-active turns in session 96's batch, the mined
  library predicted the actual cell 2 times against the baseline's 5
  (`src/sim/fishing/matcherHeadroom.ts` / `scripts/matcherWeightReport.ts`).
  STATE.md is correct that n=20 is not evidence of a regression on its own —
  but it is exactly the kind of thin, early, slightly-worse-looking signal
  the user's "garage now" reaction is picking up on, and `minedLibraryGate.ts`
  only checked paired ΔlogLoss (no-harm, CI includes zero), not per-turn
  predictive accuracy. If a second batch's matcher-active turns are on disk
  by the time this session runs, extend the accuracy tally rather than
  re-reading the same 20 turns; if not, say explicitly that this remains
  open at n=20 and name what volume would settle it, rather than re-asserting
  "not evidence of a regression" as if it were now a closed question.

## 5. The unconstrained-early-spend guardrail exists, was swept, and was never wired live — check whether it should be now

`src/strategy/fishing/focusBudget.ts` (session 49, brief §3) was built for
exactly this shape of problem — session 48 measured "the first move alone
spends 1.62 of 3 points" and 80.8% of casts escaping by meter-out. It defines
three real policies (`costCap`, `threshold`, `schedule`), all swept via
`scripts/focusBudgetSweep.ts`, and the module's own header says plainly
`NO_FOCUS_POLICY` — unconstrained — "remains the default" as of its last
update (session 72). **Confirmed still true at the current live call site**:
`scripts/liveFishing.ts`'s `chooseCard(hand, mana, dist, gridSize, 1, fishHp,
turnFocusBudget, true, focusReserveWeight)` passes no sixth `spendConstraint`
argument, so `cardChoice.ts` falls through to its default, `UNCONSTRAINED`
(no move-cost cap, no EV threshold). The only live brake on early spend is
`focusReserveWeight` (`DEFAULT_FOCUS_RESERVE_WEIGHT = 3`, one commit ever,
session 45 — a **soft** linear tax of 1.00 EV-unit per manhattan step, not a
hard cap), and even with it active `TASKS.md` records focus exhaustion at
**69.5% of casts** — down from 79.5% unweighted, still the large majority.

This is not a new regression — the wiring hasn't changed since session
49/50 — but it is the mechanism that makes §2's era finding bite as hard as
it does: nothing stops a cast from spending most of its meter early, and
since session 93 nothing can refill it once it's gone. Two things worth
doing here, offline:

- **Re-measure opening-turn spend fresh**, against the live corpus's most
  recent batches (sessions 92 and 96 at minimum). The only number on record
  — 0.83 of 3 points — is from session 71's "today's policy" era
  (`focusBudget.ts`'s header comment / `OIL-POLICY.md` line 14, the same
  35-cast era the "~60%" figure in §1 traces to), roughly 25 sessions old,
  measured under a different matcher, before the Focus Oil withdrawal, and
  never rechecked since. Don't assume it still holds.
- **If it's crept up, or even if it hasn't**, this is a real, already-built,
  already-swept lever (`costCap`/`threshold`/`schedule`) sitting unused —
  report which of the three looks most promising against the current corpus
  and recommend whether it's worth proposing to the user for live wiring,
  rather than leaving it catalogued and inert for another 25 sessions.

---

## What this does and does not settle

- **It should produce a defensible answer to "is the catch rate actually
  down, and why"** — grounded in the corpus, not a guess — covering
  provenance of the "~60%" figure, the era-segmented catch rate, and a
  proper confidence interval on the one batch that triggered the concern.
- **It does not, on its own, decide whether to re-approve Focus Oil.** If §2
  shows `focusDry` is structurally worse, that's a real trade-off for the
  user to rule on (re-approve Focus Oil vs. accept the lower `focusDry`-era
  rate as the honest current baseline) — report the finding, don't make the
  call.
- **It does not replace a live batch.** If everything here comes back
  "explained, not a regression," the honest next step is probably still one
  more supervised live batch to confirm 30%-ish holds up outside the
  `focusDry` era or with the tripwire ruling applied — that's a live-spend
  decision for a future brief, not this one.

---

## Do not

- **Do not change any live strategy code (oil trigger, matcher weighting,
  card choice) in this session** unless one of §§1–4 turns up something
  concrete enough to name precisely — this is a diagnostic brief, not a fix
  brief. If a fix becomes obvious, write it up as a recommendation for the
  user to rule on rather than shipping it unilaterally (rule 9: a brief's
  claims are hypotheses to verify, and by symmetry an investigator's own
  mid-session conclusions need the same discipline before they become code).
- **Do not quote any `castSim`- or miner-derived catch number as evidence
  either way.** OIL-POLICY.md §0a stays in force for this brief exactly as
  everywhere else.
- **Do not re-open §36/§37/§38** (the 11-pattern shipping decision, the
  `boonCapture` deletion, the gate-1 closure) — all three are executed
  directives from session 96, not open questions. §4's matcher-accuracy check
  above is about **measuring** the already-shipped library, not
  re-litigating whether to have shipped it.
- **Do not spend any live casts.** Every measurement above reads the existing
  corpus and existing `handoff/` documents.

---

## Your task

1. Confirm, from primary sources (`OIL-POLICY.md` line 14 and the session
   71→96 STATE.md/log trail), where the "~60%" figure the user is recalling
   actually comes from — a specific, datable, superseded number, not an
   assumption.
2. Build the missing report: live catch rate segmented by `eraOf`
   (`preOil` / `oilSupplied` / `focusDry`) over the full 199-cast corpus, and
   state whether `focusDry` reads structurally lower.
3. Compute the exact binomial 95% CI for session 96's 3/10 and compare it to
   the corpus baselines; state plainly whether 30% is distinguishable from
   the historical live rate at this sample size.
4. Rule on the §2c oil-trigger tripwire (re-derive / retire / accept-and-
   document) — it's overdue by its own pre-registration.
5. Extend the matcher-accuracy tally past n=20 if a second batch exists on
   disk by the time this runs; otherwise state precisely what volume would
   settle it.
6. Re-measure opening-turn focus spend against the most recent live batches
   and report whether the unconstrained (`NO_FOCUS_POLICY`) wiring at
   `scripts/liveFishing.ts`'s `chooseCard` call is still worth leaving as-is,
   or whether one of `focusBudget.ts`'s already-swept policies
   (`costCap`/`threshold`/`schedule`) should be proposed for live wiring.
7. Write up all six as one QUESTIONS.md entry (next unused number as of
   whenever this runs — **§39 is now taken** by the oil-conserve approval
   recorded 2026-08-25; check the file's actual last section before
   numbering) with an explicit verdict: sampling noise, era effect, real
   regression, or some combination — named, not hedged into mush.
8. Normal recap: suite, `tsc --noEmit`, `git diff --check`, secret scan.
