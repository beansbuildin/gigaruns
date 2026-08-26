# BRIEF — session 98 — wire the four rulings, run the capped 9-cast batch, and build the ΔEV-per-step report. NOT a rolling recommendation.

**This document replaces the session-97 `next.md`.** Session 97 is executed
and closed — QUESTIONS.md §40/§41, STATE.md session 97. This file is the
assignment for session 98, full stop, on the same terms session 97 shipped
under: **every numbered item below is done, or blocked with an explicit
named reason stated up front, before the session ends** (CLAUDE.md rule 6).
Session 97 held that bar; hold it again.

**Where this came from.** The user answered all four of session 97's open
questions directly, in conversation, 2026-08-25 — recorded as QUESTIONS.md
§42 (no Focus Oil, standing), §43 (necessity-gate threshold → 0.85), §44
(retire the §2c tripwire), §45 (9-cast batch, then a rod swap). Read those
four entries in full before starting — this brief summarizes them but the
entries carry the reasoning and the specific things to verify, not just the
headline decision.

**Ordering, and why.** §A and §B are offline config/code changes that the
live batch (§D) depends on — §D is pointless if the threshold and tripwire
aren't already shipped, since the whole reason to run 9 live casts now is to
see the new threshold actually fire. §C (the ΔEV-per-step report) has zero
live dependency and no ordering constraint with anything else here; do it
whenever it's convenient inside the session, including in parallel with
§A/§B if that's how the work naturally splits. §D must come after §A/§B.
§E is a note to leave for whoever reads this after the rod swap, not a task
this session performs.

---

# §A — Lower the necessity-gate relaxing threshold to 0.85 (QUESTIONS.md §43)

`RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` in
`src/strategy/fishing/oilTiming.ts` changes from `1` to `0.85`.

1. **Do not re-run `scripts/oilConserveSweep.ts`.** `OIL-POLICY.md` §0a
   forbids it by name; session 97 already refused this instruction once
   when an earlier brief asked for it. If you want a sanity check, do it
   against the live/replay corpus the way §40/§41 were, not the suspended
   sim.
2. Re-run and, where the boundary shifted, re-derive
   `tests/fishing/oilNecessityComposition.test.ts`'s assertions (91 of them,
   pinned exhaustively at threshold `1`) at `0.85`. Don't assume they all
   still hold; the whole point of that test file is boundary behavior, and
   the boundary moved.
3. Report, against the same 24-decision live/replay union §40 measured
   (18 replayed + 20 live... wait — cross-check the exact union size at the
   time you run this, don't reuse a stale count), **how many of those
   decisions would fire at 0.85 that didn't fire at 1.** This is the
   corpus-grounded answer to "does this do anything now" — §0a forbids
   citing a sim table for it.
4. Ship it, and note in the same recap section as §D below what the live
   batch actually shows the gate doing at the new threshold — that's the
   first real-world read on a threshold picked by the user, not derived
   from a sweep, and it's worth recording plainly whether it looks like the
   tradeoff the user expected.

# §B — Retire the §2c clean-cast tripwire (QUESTIONS.md §44)

Not re-register with a corrected threshold — retire outright, per the
user's explicit ruling.

1. Find the tripwire's actual current call site — `scripts/eraCatchRate.ts`
   per session 97's files-changed list is the newest touch point, but
   confirm before editing rather than assuming.
2. Remove or explicitly disable the check.
3. Record, at the tripwire's own threshold constant / pre-registration
   comment, that it was retired 2026-08-25 by user directive, for being
   miscalibrated on a suspended `castSim` instrument (stated rarity wrong
   by ~9x — see QUESTIONS.md §44 for the exact figures). A future reader
   should be able to find why this stopped existing.
4. **Do not invent a replacement tripwire in the same motion.** That's a
   separate ask if it comes up later.

# §C — Build the ΔEV-per-step distribution report (QUESTIONS.md §27)

**Zero live spend. No ordering dependency on §A/§B/§D.** This has been
fully scoped and ready since session 95 §G narrowed it — it has simply
never been picked up. Do it this session rather than let it become a fifth
stale recommendation; the pattern this repo is actively correcting for is
exactly "scoped, ready, never started."

`src/strategy/fishing/cardChoice.ts`'s `bestFocusForCard` ranks each
reachable candidate cell by `score = ev + focusReserveWeight *
focusReserveFraction(focusBudget, focus)`. Session 95 §G proved the term's
entire ranking effect reduces to a linear movement tax,
`-(w / FOCUS_METER_MAX) * d`, exactly **1.00 EV-units per manhattan step**
at the shipped weight. That tax changes the argmax if and only if
`ΔEV(best moving placement, best stay-put placement) < 1.00 × Δd`. **The
ΔEV-per-step distribution** is: at every live decision point, take the raw
`ev` (before the reserve term) of the best `d = 0` candidate and the best
`d > 0` candidate, compute `ΔEV = ev(best mover) − ev(best stayer)`, divide
by that mover's `d`. Report the full distribution, not just a mean — what
matters is the fraction of decision points with `ΔEV/d < 1.00` (tax binds,
can flip the choice) vs. `≥ 1.00` (tax is inert there).

How to build it without inventing new machinery:

1. Reuse `offPolicyReplay.ts`'s existing leave-one-cast-out discipline over
   `loadCastTraces().filter(isCleanTrace)` — the same corpus, the same
   convention. An in-sample number here would repeat the mistake session
   47/49 already documented for logloss.
2. The EV surface per decision point already exists inside `chooseCard`'s
   candidate loop. Either add an option that returns the per-candidate `ev`
   breakdown alongside the winning choice, or write a sibling function that
   computes the same candidate set without re-deriving the movement model —
   whichever keeps the two provably in sync (a test asserting the report's
   chosen cell matches what `chooseCard` actually picks at
   `focusReserveWeight = 0` is the cheap way to catch drift).
3. A new script (`scripts/evPerStepDistribution.ts` or similar, in the
   shape of `focusProfileCheck.ts`/`offPolicyReplay.ts` — same corpus
   loading, same `--flag=value` style) that walks every decision point and
   prints: n (excluding decision points with no `d > 0` candidate — nothing
   to compare there), mean/median/quartiles, the `< 1.00` / `≥ 1.00`
   binding-fraction split, and a by-manhattan-distance breakdown if the
   shape differs meaningfully across `d = 1, 2, 3`.
4. Pin it with a test against a small hand-computable synthetic corpus.

**Do not touch `castSim` for this — §0a applies exactly as much here.**
**Do not recommend a new `DEFAULT_FOCUS_RESERVE_WEIGHT` value from this
measurement alone** — report the distribution; a weight change is a
follow-up decision if the distribution turns up something actionable.

Write up as QUESTIONS.md §27 UPDATE (not a new section number — this
continues the existing thread): n, the distribution, the binding-fraction
split, the by-`d` breakdown, and whether the distribution reads "sharp"
(tax mostly inert) or "flat" (tax often binds).

# §D — Run the capped 9-cast live batch (QUESTIONS.md §45)

Standard fishing-batch cadence, with two differences from the usual 10:

1. **Cap at 9 casts, not 10** — deliberately inside the user's own rod
   durability estimate rather than testing it to failure. If the rod shows
   signs of failing before 9, stop and say so; don't push to the cap.
2. **This is the first live read on both §A's new threshold and the
   standing no-Focus-Oil decision (§42) at the same time.** Report, same
   depth as prior fishing sessions: catch rate (with the usual caveat that
   n=9 proves little on its own — use the same binomial-CI framing session
   97 established, don't repeat the mistake this whole thread started
   from), how many times the necessity gate actually fired at 0.85 vs. how
   many opportunities it had, and opening-turn focus spend compared to the
   0.82 baseline session 97 measured (§2e's own stated reopening condition
   is turns-at-focus-zero rising back above ~40% — check it, don't assume
   it's fine).
3. **This batch also feeds the redraw shadow instrument for free.**
   `src/strategy/fishing/redrawShadow.ts` (built session 90, QUESTIONS.md
   §26) has been passively logging a shadow record on every live decision
   since it shipped — nothing here needs to change that. Report the
   updated cumulative shadow count after this batch (STATE.md session 96
   had it at 43 in-sample decisions; state the new total) — this is
   groundwork for §26's eventual resolution, not a new task, and costs
   nothing beyond running the batch you were already running.

Before starting: confirm oil stock covers the batch, confirm rod durability
per the user's own estimate, `--dry-run` first since §A/§B both changed
oil-decision logic since the last live cast (rule 4 discipline, same as
every prior fishing brief in this repo).

# §E — Note for whoever picks up the session after the rod swap

Not a task for this session. Leave this here so it isn't lost: **the user
is replacing the rod after this 9-cast batch**, with a new deck. When that
happens:

- Confirm the swap actually occurred before assuming `REAL_DECK` changed —
  ask the user, the way session 87-89's rod-mismatch history argues for
  checking rather than inferring from `GEAR_CID_array`.
- Expect every pinned corpus number keyed to the current deck to need a
  fresh baseline, the same kind of break the Makeshift/Shroom rod change
  already caused once.
- The matcher-library question (11-pattern library accuracy, still open at
  n=20) needs 87–122 matcher-active turns total to settle with real power.
  This session's 9-cast batch contributes toward that, but doesn't close
  it — track cumulative matcher-active-turn count across batches rather
  than resetting the tally at each one, and don't claim the question is
  settled until the volume actually gets there.

---

## What §26 (the redraw shadow) still needs — status, not a task for this session

Worth recording precisely, since the user asked directly what's needed here
and the honest answer is more specific than "write a brief": the shadow
**instrument already exists and has been running since session 90**
(`src/strategy/fishing/redrawShadow.ts`) — it is not unbuilt code, contrary
to how it's been carried in recent STATE.md "carried, untouched" lists.
What's actually missing is the **analysis pass**: nobody has written a
script that takes the accumulated shadow log and produces an out-of-sample
verdict on the candidate trigger, and the remaining correctness question
from §28 (`GAP 1`, the `FISH_MOVED`-unobserved semantics ambiguity named in
code since session 78 §6) is still unmeasured. Once §D's batch lands, check
whether the cumulative shadow count is enough volume to attempt that
analysis (session 95's log mentions an early Fisher's-exact read at
0/52, 4/24, 0/2 — check whether that's still the right framing before
reusing it) — if so, that's the natural next brief; if not, say explicitly
how much more volume is needed, the same way session 97 priced the
matcher-library question at 87-122 turns instead of leaving it vague.
`redrawEnabled` and `REDRAW_THRESHOLD` stay untouched regardless — enabling
redraw live is explicitly the user's call, not an agent's, per §26/§28's
own text.

---

## Recap, for the whole session

Full suite, `tsc --noEmit`, `git diff --check`, secret scan — once, at the
end, against everything §A–§D actually changed. State explicitly, at the
top of the recap, the status of every lettered item above: done,
done-with-a-named-caveat, or blocked-with-a-stated-reason.
