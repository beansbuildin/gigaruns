# BRIEF — session 101 — settle the events-coverage question, measure proc effect sizes, then the 20-cast batch once the ledger resets

**This document replaces the session-100 `next.md`.** Session 100 is
executed and closed — QUESTIONS.md §57, STATE.md session 100. `§A` (durability
preflight) and `§B` (proc-rate evidence) from that brief are DONE; `§C` (the
20-cast batch) was correctly left BLOCKED — the ledger read 20/20 spent as
recently as 09:12 PT that session, with 1.8h to the 11:00 PT reset.

**Time-boxed on purpose.** As of this brief there is roughly 1.5h left
before the reset. §A and §B below are both offline, both fully specified
from data already on disk, and ordered by dependency and value: **do §A
first — it's quick and it sizes §B's sample** — then spend the rest of the
window on §B, which is the one that actually unblocks something
(`TASKS.md` CAPTURE-1's remaining half). **If the reset arrives before §B
finishes, stop where you are and say exactly how far you got** — a
half-finished, honestly-reported effect-size measurement is fine; a rushed
one that gets shipped as complete is not. §C is unchanged from the last
brief and still can't start until the reset regardless of how §A/§B go.

---

# §A — Settle whether the capture path is dropping `data.events` (STATE.md session 100, open question 3)

**Quick, and it determines §B's real sample size.** `data.events` is
present on only 2093 of 5308 canonical states. Session 100 flagged this as
unresolved rather than guess at it: either that's expected (only action
responses carry it) or the capture path is silently dropping evidence on
some exchanges, in which case §B's `n=1919` is an undercount and some proc
evidence has already been lost.

1. For every state where `data.events` is absent, check what KIND of
   response it is (a `play_cards` action response, a poll/read-only fetch,
   a state snapshot between actions, etc.) — the fields already on the
   state should say this without new capture.
2. If absence correlates cleanly with response type (e.g., only non-action
   reads lack it), that's the "expected" answer — state it plainly and
   move on, §B's `n` stands.
3. If it doesn't correlate cleanly — some action responses are missing
   `data.events` too — that's a real capture-path gap. Name which capture
   path it is (fishing vs dungeon, live vs replay) and whether it's still
   live today or historical only. Do not attempt to fix a live capture gap
   in this section; that's a separate, scoped follow-up if one is found.
4. Report the corrected denominator for §B to use, one way or the other.

# §B — Measure effect sizes for each proc type (STATE.md session 100, open question 1)

**This is the one that matters.** Session 100 settled RATES (block 4.69%,
crit 1.25-1.30%, evade 0.31-1.62%, tenacity 0.89-0.99%, intuition 0.31%,
all inside SPEC §4e's predicted 1-5% band, zero false-fires on a zero-stat
control). A rate is not a mechanic — nothing yet says what a proc actually
DOES: full negate, partial reduction, and by how much. This is fully
measurable from the same corpus `scripts/procEvidence.ts` already scans, no
live play required.

1. For each of the nine flags in session 100's table (`blockProc0/1`,
   `critProc0/1`, `evadeProc0`, `evadeProc1`, `intuitionProc0`,
   `tenacityProc0/1`), compute the HP/shield delta on exchanges where the
   flag fired vs. a matched set where it didn't (same stat nonzero, same
   attack context if that's derivable) — the diff is the effect size.
2. **Use §A's corrected denominator**, not the uncorrected 1919, if §A
   found a real gap.
3. Sample sizes here are small (some flags fire as few as 6 times in 1919
   exchanges) — report confidence intervals or explicitly flag "n too
   small to bound," don't present a point estimate as precise when it
   isn't. This is the same discipline session 97-100 have held throughout:
   a thin number gets reported as thin, not rounded into false confidence.
4. Write up as a QUESTIONS.md entry (next unused number) with a verdict per
   flag: "full negate," "partial reduction of X," "cannot be determined at
   current volume," etc. Update `TASKS.md` CAPTURE-1 to reflect exactly
   which of the five rolled stats now have both a rate AND an effect size,
   versus which still need one or the other.
5. **Do not wire any of this into a live decision.** STATE.md session 100's
   open question 2 (should the live loop read the proc booleans in
   real time) is explicitly deferred until effect sizes exist — this
   session may finally answer that dependency, but wiring consumption is
   its own future task, not part of this one.

# §C — The 20-cast fishing batch, once the ledger has reset (carried from session 100, QUESTIONS.md §55)

Unchanged from the last brief. Confirm the reset actually happened
(`npx tsx scripts/checkFishingCaps.ts`) before starting — don't assume the
clock. `--dry-run` first. Report catch rate with a binomial CI, how many
opportunities the 0.85 necessity gate got and what it did, opening-turn
focus spend against baseline, updated cumulative redraw-shadow count, and
the second half of the durability bracket — this is the first batch where
§A's (session 100's, not this session's) preflight can log both a before
AND after reading in the same session, which is what turns the current
1.0/cast, n=1 bracket into something with an actual sample size.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4` — session 100 found the default oversubscribes
this machine and produces false timeout failures; don't read an unbounded
red run as a regression), `tsc --noEmit`, `git diff --check`, secret scan.
State explicitly, at the top of the recap: §A's verdict, §B's per-flag
effect-size table and how far it got if time ran out, and §C's status
(blocked-on-reset is an expected, acceptable outcome — say so plainly).
