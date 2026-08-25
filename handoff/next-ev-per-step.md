# BRIEF — session 97 (or whichever session picks this up) — measure the ΔEV-per-step distribution, live corpus only, zero live spend

**This is a separate document from `handoff/next.md` on purpose.** The user's
ruling was explicit: "Create a separate offline, live-corpus-only ΔEV-per-step
brief." It does not compete with session 96's slot (11-pattern library,
`boonCapture` deletion, gate-1 closure, the 10-cast fishing batch) and should
not be merged into it. Run this whenever it's next convenient — it has no
dependency on session 96 completing first, and session 96 has no dependency on
this one either.

**Zero live spend.** This is off-policy-replay analysis over casts already on
disk. No `start_run`, no `use_fishing_item`, nothing POSTed to the game.

---

## Where this came from

§27 in QUESTIONS.md has been narrowed twice. Session 85 turned "should we
replay two whole policies" into "what makes live's effective focus-reserve
behavior differ from the sim's at the same nominal weight." Session 95 §G
answered *that* structurally and narrowed it again — to exactly one
measurable quantity. Quoting §27's session-95 update directly, since this
brief exists to execute exactly what it specifies:

> The entire remaining question is **how the ΔEV-per-step distribution at
> decision points differs between live and sim** — a sharper distribution (EV
> gaps well above 1.00/step) makes the term inert, a flatter one makes it
> bind. That is one measurable quantity per side, not a policy replay.

> Measuring it live needs the off-policy replay machinery over the corpus,
> and measuring it in sim needs `castSim`, which OIL-POLICY.md §0a suspends
> for this fishery — so a sim-side number would not be quotable even once
> computed.

The user's ruling resolves the half that was still open: measure the live
side. **Do not attempt the sim side** — §0a still suspends `castSim` for this
fishery (sim catch ~70–80% against a real ~27.6%), and a sim-side ΔEV-per-step
number would be exactly as unquotable as every other `castSim` output this
repo already carries. This brief is scoped to live-corpus-only because that's
the half that's actually payable right now, not as an arbitrary restriction.

---

## The exact quantity, derived precisely so it isn't reinvented loosely

Session 95 §G already worked out the mechanics; this section restates them so
whoever implements this doesn't have to re-derive from scratch.

`src/strategy/fishing/cardChoice.ts`'s `bestFocusForCard` ranks each reachable
candidate cell by:

```
score = ev + focusReserveWeight * focusReserveFraction(focusBudget, focus)
```

Session 95 §G proved `focusReserveFraction`'s retention half is a per-decision
constant that cancels in the argmax, and the term's entire effect on ranking
reduces to a **linear movement tax**: `-(w / FOCUS_METER_MAX) * d`, where `d`
is the manhattan distance from the current cell. At the shipped
`DEFAULT_FOCUS_RESERVE_WEIGHT = 3` against `FOCUS_METER_MAX = 3`, that's
exactly **1.00 EV-units per manhattan step** — verified with max error 0
across 1912 swept candidates.

That tax changes the argmax if and only if:

```
ΔEV(best moving placement, best stay-put placement)  <  1.00 × Δd
```

So **the ΔEV-per-step distribution** is: at every live decision point in the
corpus, take the raw `ev` (before the reserve term is applied) of the best
`d = 0` candidate and the best `d > 0` candidate, compute
`ΔEV = ev(best mover) − ev(best stayer)`, and divide by that mover's `d` to
get an EV-per-step figure comparable to the 1.00/step tax rate. Do this at
every decision point in the corpus and report the distribution (not just a
mean) — the finding this feeds into cares about *what fraction of decision
points have ΔEV/d under 1.00* (where the tax can flip the choice), not just
the average.

---

## How to compute it without inventing new machinery

This is deliberately scoped to be a report over existing infrastructure, not
a new model.

1. **Reuse the off-policy replay's existing discipline.** `offPolicyReplay.ts`
   already does leave-one-cast-out model rebuilding for every decision point
   in `loadCastTraces().filter(isCleanTrace)` — reuse that same corpus and the
   same leave-one-out convention. A number computed in-sample here would have
   the identical problem session 47/49 already documented for logloss.
2. **The EV surface per decision point already exists inside `chooseCard` /
   `bestFocusForCard`'s candidate loop** — it evaluates every reachable cell's
   raw `ev` before adding the reserve term. The cleanest implementation is
   either (a) a small option on `bestFocusForCard`/`chooseCard` that returns
   the per-candidate `ev` breakdown instead of (or alongside) just the winning
   choice, or (b) a new function alongside it that computes the same
   candidate set and raw EVs without re-deriving the movement model —
   whichever keeps the two functions provably in sync (a test asserting the
   report's chosen cell matches what `chooseCard` actually picked, at
   `focusReserveWeight = 0`, is the cheap way to catch drift between them).
3. **A new script**, in the shape of `scripts/focusProfileCheck.ts` or
   `scripts/offPolicyReplay.ts` (same corpus loading, same report-printing
   conventions, same `--flag=value` CLI style) — e.g.
   `scripts/evPerStepDistribution.ts` — that walks every decision point in the
   filtered corpus, computes `ΔEV/d` as defined above, and prints:
   - n (decision points with at least one `d > 0` candidate — a decision
     point where every reachable cell is the current one has no `d > 0`
     comparison and should be excluded, not treated as `d = 0`),
   - mean, median, and a distribution summary (quartiles or a histogram —
     match whatever this repo's other distribution reports already use,
     `redrawTriggerCalibration.ts` and `focusProfileCheck.ts` both report
     distributions and are worth checking for the house convention before
     inventing a new one),
   - explicitly, the fraction of decision points with `ΔEV/d < 1.00` (tax
     binds, can change the choice) vs. `≥ 1.00` (tax is inert there),
   - broken out by `d` if the shape differs meaningfully between `d = 1`,
     `d = 2`, `d = 3` (the reserve tax's reach already scales with
     `remaining`, so the binding fraction may not be uniform across step
     sizes).
4. **Pin it with a test** the way every other distribution report in this
   repo is pinned — a fixed small synthetic corpus with a hand-computable
   ΔEV-per-step distribution, so a future refactor of `cardChoice.ts` gets
   caught if it silently changes the EV surface this report reads.

---

## What this does and does not settle

- **It answers §27's own stated remaining question** — how sharp or flat the
  live-side ΔEV-per-step distribution is — which is what decides whether the
  1.00/step tax is inert or binding in practice, on the live corpus, without
  needing `castSim` at all.
- **It does not, on its own, tell you whether to change
  `DEFAULT_FOCUS_RESERVE_WEIGHT`.** That's a policy question for a future
  brief if this measurement turns up something actionable (e.g., a large
  fraction of decision points where the tax visibly flips the choice against
  a materially better mover). Report the distribution; don't recommend a new
  weight in the same pass unless asked.
- **It does not reopen the "replay two whole policies" question §27
  originally asked and session 85 talked down.** That's still shelved for the
  reasons session 85 gave (the corpus can't cleanly bracket the sessions
  61/62 change). This is a narrower, different, and now fully-scoped
  question.

---

## Write-up

When this is done, add **QUESTIONS.md §27 UPDATE [session N, this session's
date]** — not a new section number, since this continues the existing §27
thread — reporting: n, the distribution summary, the binding-fraction split
above, and whatever the by-`d` breakdown shows. State plainly whether the
distribution is "sharp" (tax mostly inert) or "flat" (tax often binds), since
that's the framing session 95 §G set up for reading the result. Leave §27
OPEN (as a recommendation) unless this measurement makes the next step
obvious enough to state outright — don't force a close if the honest answer
is "here's the distribution, here's what it suggests, the weight decision is
still a call for a human."

---

## Do not

- **Do not touch `castSim` for this.** No sim-side number, no matter how easy
  it looks to compute one for comparison — §0a's suspension applies exactly
  as much here as everywhere else in this repo.
- **Do not spend any live casts.** Everything needed is already in the
  corpus `loadCastTraces()` reads.
- **Do not fold this into session 96's brief** (`handoff/next.md`) or wait for
  it to finish first — this is intentionally a separate, independent
  document.
- **Do not recommend a new `DEFAULT_FOCUS_RESERVE_WEIGHT` value from this
  measurement alone.** Report the distribution; a weight change is a
  follow-up decision, not an automatic conclusion.

---

## Your task

1. Build the ΔEV-per-step distribution report over the existing clean-trace
   corpus, leave-one-cast-out, reusing `chooseCard`/`bestFocusForCard`'s
   existing EV surface rather than re-deriving it.
2. Report n, the full distribution (not just a mean), the `< 1.00` /
   `≥ 1.00` binding-fraction split, and the by-manhattan-distance breakdown.
3. Pin it with a test against a small hand-computable synthetic corpus.
4. Write up the result as a §27 UPDATE in QUESTIONS.md — sharp vs. flat,
   what it suggests, and whether it's enough to recommend a next step or
   just enough to inform one.
5. Normal recap: suite, `tsc --noEmit`, `git diff --check`, secret scan.
