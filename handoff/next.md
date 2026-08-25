# BRIEF — session 97 — wire the oil necessity gate, diagnose the catch-rate batch, and close it out. NOT a rolling recommendation.

**This document replaces the session-96 `next.md`.** Session 96's brief is
executed and closed (QUESTIONS.md §36–§38, STATE.md session 96) — its content
now lives there, not here. This file is the assignment for session 97, full
stop.

**Why this file looks different from the last few briefs in this repo, and
why that's deliberate.** The user's own words, 2026-08-25: *"I don't trust
Claude's judgement to not sweep shit under the rug again."* That reaction was
earned — an audit this session ran found three concrete cases of a
user-sourced recommendation getting logged as "worth doing," never gated by
any legitimate approval requirement, and then sitting unbuilt for 24 to 70+
sessions because nothing forced a follow-up (`handoff/OIL-CONSERVE.md` sat
"awaiting approval" for 29 sessions after the approval question was written
into a session log instead of `QUESTIONS.md`, where the user would actually
see it; `focusBudget.ts`'s `schedule` policy for 24; `chooseNewCard`'s
deck-composition scoring for 70+). The structural cause was a document that
says "whenever convenient, no dependency" and a task backlog nothing sweeps.

**So: this session is not complete until every numbered item in §1 and §2
below is either done, or blocked with an explicit, named reason stated
before you stop** (CLAUDE.md rule 6 — a gate must be on something the agent
controls; if something here turns out to be ungateable, say so at the START
of the recap, not buried in it). "I ran out of session" is not a reason
unless you say so explicitly and state exactly what's left undone and why,
the same way rule 6 already requires for an unreachable gate. Do not write a
"still open" list and move on the way `handoff/OIL-CONSERVE.md` effectively
did for 29 sessions.

**Ordering, and why it's in this order:** §1 (oil necessity gate) is
smaller, already user-approved in direction (QUESTIONS.md §39, recorded
today), and has the clearest finish line — do it first so it's *done*, not
partially done, before spending time on §2's more open-ended diagnostic
work. §2 (catch-rate diagnosis) doesn't gate §1 or vice versa; if time runs
short, §1 fully done and §2 partially done with an honest account of what's
left is a better outcome than both half-finished.

---

# §1 — Re-derive and wire the oil necessity gate

*(Full detail below is the same brief as `handoff/next-oil-conserve.md`,
inlined here because that file is now superseded — this is the version to
work from.)*

## Where this came from

QUESTIONS.md §39: the user approved, in direction, the necessity-gating
policy `handoff/OIL-CONSERVE.md` derived in session 67 — skip an oil spend
when the bot's own model already shows it can catch the fish without one.
That approval is **not** a green light to paste the old
`conserve(r=1,f=1)` numbers into `liveFishing.ts` unmodified. Two live
things changed since session 67's sweep and neither was accounted for in
it:

1. **`config/bot.json`'s `dendren.oils.allowedItemIds` is `[937]` only**
   (session 93, RELAXING-OIL-ONLY). The old sweep priced both a Relaxing
   gate and a Focus gate; only the Relaxing half matters live today.
2. **`doubleLethalTriggers` is live** (session 90, §30), and it composes
   with `onDemandTriggers`, not with `conservingOil` — the two gate
   functions in `src/strategy/fishing/oilTiming.ts` were built as siblings
   (both wrap `onDemandTriggers` directly, lines ~600 and ~694) and nothing
   anywhere says what "necessity-gated Relaxing spend, still capable of a
   double-lethal same-turn spend when the band calls for it" actually does.

## 1a. Re-price the Relaxing-only necessity gate on its own, not as half of a two-oil table

`handoff/OIL-CONSERVE.md` §3 already isolated this once — "the Relaxing
gate is free… identical catch rate… for 1182 fewer oils (−21%)" — but that
was measured with Focus Oil still live alongside it and the double-lethal
layer not yet built. Re-run `scripts/oilConserveSweep.ts` (or a
relaxing-only variant of it) with:

- `allowedItemIds` restricted to `[937]` in the sweep's simulated
  configuration, matching live.
- `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` (currently `1`) re-checked
  against the bimodal `bestKillProbability` distribution table
  (`OIL-CONSERVE.md` §4) — confirm the plateau shape still holds
  relaxing-only, don't assume it transfers unchanged from the two-oil
  sweep.
- Report catch rate and oils-per-cast/oils-per-extra-fish exactly as
  `OIL-CONSERVE.md`'s tables do, so the numbers are directly comparable to
  the ones already on record.

## 1b. Derive how the necessity gate composes with `doubleLethalTriggers` — this does not exist yet

`src/strategy/fishing/oilTiming.ts`:

- `onDemandTriggers` (line ~180) is the shared base both `conservingOil`
  (line ~600) and `doubleLethalTriggers` (line ~694) wrap independently.
- `doubleLethalTriggers` layers a same-turn double-Relaxing-spend in the
  HP band where one oil can't finish the fish but two can, when the bot's
  own best affordable card can't guarantee the kill this turn — using
  `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` as its own default
  `relaxingThreshold` parameter already (line ~697), which is a promising
  sign the two were designed to be compatible, but it has never been
  proven and never tested composed.

Write the composition explicitly — either a new function that applies the
necessity gate first and then evaluates the double-lethal band on what
survives, or confirm (with a test, not an assertion in a comment) that
calling `doubleLethalTriggers` with a necessity-gated base produces the
intended behavior. Pin it with a test (`tests/fishing/oilNecessity.test.ts`
is probably the right home, or a new sibling file if the composition
warrants its own coverage).

Sweep the composed policy the same way §1a does, and report where it lands
relative to: today's shipped `doubleLethalTriggers`-over-`onDemandTriggers`,
and the Relaxing-only necessity gate alone from §1a. State plainly whether
composing costs anything relative to the gate alone.

## 1c. Check whether this resolves (or explains) the §2c oil-trigger tripwire

STATE.md session 96 records: the §2c clean-cast tripwire fired, 9 of 10
clean casts exceeding a pre-registered threshold of 6 against the model's
~0.70 oils/cast assumption (~1-in-900 event). That assumption was almost
certainly built on `onDemandTriggers`'s ungated firing rate. If §1a's
re-sweep shows the necessity gate cuts oils/cast by roughly the ~20%
`OIL-CONSERVE.md` originally measured, **recompute what the tripwire's
threshold would have been under the gated rate** and check whether session
96's 9/10 still looks anomalous against it, or whether it was actually
consistent with a gate that hadn't shipped yet. Report this explicitly
either way — "the tripwire and this gate are unrelated" is a fine answer
too, but it has to be checked, not assumed.

## 1d. Ship it

Once §1a–§1c hold up:

- Swap the live trigger call in `scripts/liveFishing.ts` from whatever
  currently calls `onDemandTriggers`/`doubleLethalTriggers` to the composed,
  necessity-gated version from §1b.
- Update `handoff/OIL-CONSERVE.md`'s own title and opening line — it
  currently says "derived, awaiting the user's approval" and "Nothing here
  has been consumed live and nothing here is shipped," both of which stop
  being true the moment this lands. **A shipped policy's own design doc
  must not claim it isn't shipped** — that stale-status-line failure mode is
  exactly what QUESTIONS.md §39 exists to stop happening again.
- Add a QUESTIONS.md **§40** entry stating what was actually wired, the
  re-derived numbers from §1a–§1b, and the §2c tripwire finding from §1c.

## §1 — Do not

- **Do not skip §1a–§1b and wire the old session-67 numbers directly.** They
  were measured under a configuration (both oils, no double-lethal) that no
  longer exists live. The user approved the *direction*, not a specific
  unverified number — wiring an unverified number is the same mistake this
  whole review started from.
- **Do not run a live fishing batch as part of §1.** Sim/offline
  re-derivation and the code change are in scope; §2 below (or a future
  fishing session) is where live play happens.
- **Do not touch the Focus Oil trigger or `allowedItemIds`.** Session 93's
  RELAXING-OIL-ONLY directive stands untouched; this is scoped to the
  Relaxing gate only.

---

# §2 — Diagnose the catch-rate batch: sampling noise, the focusDry era, real regression, or some combination

*(Full detail below is the same brief as `handoff/next-catch-rate.md`,
inlined here because that file is now superseded — this is the version to
work from.)*

**Zero live spend for all of §2.** Every question below is answerable from
the existing corpus (`fixtures/fishing-casts/`, `data/run-reports/
fishing.jsonl`) and the existing `handoff/` record.

## Where this came from

The user read `handoff/STATE.md` (session 96) — **3 caught / 7 escaped, 43
shots, 15 hits (34.9%)** — and reacted: catch rate is "DOWN to 30%," was
"~60% on previous sessions," and the autofisher is "garage now." **Do not
start §2 by looking for a bug to fix.** The user's "~60%" figure does not
match anything in the live-measured record — the closest candidate is one
specific, datable, superseded number (§2a below) — and the honest all-time
live baseline has never been close to 60% on any real volume. Whether
session 96's 30% is actually abnormal is the first thing to establish, not
the last.

## 2a. Nail down where "~60%" actually comes from — fact-finding, not assumption

`handoff/OIL-POLICY.md` line 14 (§0a, session 71, 2026-08-21) is the only
place in `handoff/` a "60%" live catch figure appears:

> the real fishery reads meter-out **64.2%** and catch **27.6%** (and **34.3%
> / 60.0%** on the era today's policy actually played)

`src/strategy/fishing/focusBudget.ts`'s header (session 71/72) carries the
same figure with more detail — a 35-cast "TODAY's policy" era at that time,
opening spend 0.83, meter-out 34.3%, catch 60.0%. Confirm from the git
history / STATE.md trail between session 71 and 96 that no live batch since
has reported anything near 60% — session 92's STATE.md reads 5 caught (50%),
the highest recorded live-batch rate in that window and still not 60. If a
literal 60% live number turns up elsewhere in `handoff/log/`, cite it and
treat it as new evidence; if it doesn't, the §0a-era figure — pre-Focus-Oil-
withdrawal, 25 sessions stale — is almost certainly the source, and say so
plainly in the write-up.

**Separately, rule out sim/live conflation explicitly.** `scripts/
mineFishPatterns.ts` and `scripts/minedLibraryGate.ts` both print
`castSim`-derived catch numbers in the 59%–88% range. Every one is
suspended from being quoted as live evidence by OIL-POLICY.md §0a — the
sim's own bare arm reads catch ~81–91% against the real fishery's 27.6%. If
the "~60%" recollection traces to one of these prints instead, say so
exactly as plainly.

## 2b. Build the missing measurement: live catch rate, broken out by era, over the full corpus

This is the load-bearing check and it has never been run. `src/sim/fishing/
castEra.ts` (`eraOf`) classifies casts into `preOil` / `oilSupplied` /
`focusDry`. Existing reports use `eraOf` for budget-zero rate
(QUESTIONS.md §32: preOil 44.9%, oilSupplied ~1.4–7%, focusDry ~36.5%) but
nothing reports **catch rate** segmented the same way.

- Write or extend a script (`scripts/oilArmCatchCheck.ts` is the closest
  existing convention; `scripts/fishingReport.ts` already has the per-cast
  caught/not-caught data) to report caught/total, **by `eraOf`
  classification**, over the full 199-cast corpus.
- State plainly whether `focusDry` reads meaningfully lower than
  `oilSupplied`/`preOil`. Mechanical hypothesis to test directly: the focus
  meter never regenerates within a cast (CONFIRMED session 13), and the
  only live-approved top-up was Focus Oil, withdrawn session 93. If
  `focusDry` casts catch at a materially lower rate, **that's a real,
  live-confirmed mechanical explanation, not a bug**, and session 96's
  batch being entirely `focusDry` would make 30% close to expected for its
  era.
- Report by batch/session too where the corpus supports it — session 92's
  50% batch is a useful anchor against session 96's 30%.

## 2c. Frame session 96's 3/10 with an actual confidence interval

Compute the exact binomial 95% CI for 3/10 and state it next to the corpus
baselines (27.6% bare-arm real / 28.3% live-config pooled / 25.9%
dead-era-excluded / 36.7% all-time corpus). If the interval comfortably
contains those baselines — it will — say so explicitly as its own finding,
independent of §2b's era question. Keep the two separate in the write-up:
they're independent reasons 30% doesn't need a code regression to explain
it.

## 2d. Rule on the two things STATE.md session 96 itself flagged as open

- **The §2c oil-trigger tripwire.** Coordinate with §1c above — do not
  duplicate the analysis; whichever of §1 or §2 you reach first on this
  point should leave a clear pointer for the other rather than re-deriving
  it twice. If §1 already resolved it, §2d just needs to cite that result.
- **The 11-pattern library's weak first read.** On the 20 matcher-active
  turns in session 96's batch, the mined library predicted the actual cell
  2 times against the baseline's 5. n=20 is not evidence of a regression on
  its own, but extend the accuracy tally past n=20 if a second batch exists
  on disk by the time this runs; otherwise state precisely what volume
  would settle it, rather than re-asserting "not evidence" as if closed.

## 2e. The unconstrained-early-spend guardrail — check whether it should be wired now

`src/strategy/fishing/focusBudget.ts` (session 49) built three real
guardrails (`costCap`, `threshold`, `schedule`) for exactly the shape of
problem session 48 measured ("the first move alone spends 1.62 of 3
points"). The module's own header says `NO_FOCUS_POLICY` (unconstrained)
"remains the default," and this is **confirmed still true at the current
live call site**: `scripts/liveFishing.ts`'s `chooseCard(hand, mana, dist,
gridSize, 1, fishHp, turnFocusBudget, true, focusReserveWeight)` passes no
sixth `spendConstraint` argument, so it falls through to `UNCONSTRAINED`.
The only live brake is the soft `focusReserveWeight` tax (session 45,
unchanged since), and even with it `TASKS.md` records focus exhaustion at
69.5% of casts.

- **Re-measure opening-turn spend fresh** against sessions 92 and 96 at
  minimum. The only number on record — 0.83 of 3 — is from session 71,
  ~25 sessions old, measured under a different matcher, before the Focus
  Oil withdrawal, and never rechecked.
- **Report which of the three built-and-swept policies looks most
  promising** against the current corpus and state plainly whether it's
  worth wiring now or in a dedicated follow-up — this is a second
  already-built, already-swept lever sitting unused; don't let it become a
  fourth 25-session-old stale recommendation.

## §2 — Write-up

Write up 2a–2e as one QUESTIONS.md entry (**§41** — §39 is the oil-conserve
approval recorded 2026-08-25, §40 is §1's shipping record above; check the
file's actual last section before numbering in case either shifted) with an
explicit verdict: sampling noise, era effect, real regression, or some
combination — named, not hedged into mush.

## §2 — Do not

- **Do not touch `castSim`- or miner-derived catch numbers as evidence
  either way.** OIL-POLICY.md §0a stays in force.
- **Do not re-open §36/§37/§38** (11-pattern shipping, `boonCapture`
  deletion, gate-1 closure) — executed directives, not open questions. 2d's
  matcher-accuracy check is about measuring the already-shipped library,
  not re-litigating whether to have shipped it.
- **Do not change strategy code in §2 beyond what 2e recommends and you
  actually have time to wire and test.** If 2e's guardrail looks worth
  wiring but there isn't session time left after §1 and §2a–§2d, say so
  explicitly and name it as the next session's first job — do not let it
  join the pile silently.

---

## Recap, for the whole session

Full suite, `tsc --noEmit`, `git diff --check`, secret scan — once, at the
end, against everything §1 and §2 actually changed. State explicitly, at
the top of the recap, the status of every lettered/numbered item above:
done, done-with-a-named-caveat, or blocked-with-a-stated-reason. Nothing
gets left as a bare "still open" the way `OIL-CONSERVE.md` was for 29
sessions.
