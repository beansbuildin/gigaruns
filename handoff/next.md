# BRIEF — session 24

Session 23 was an incident-response session: `liveRun.ts` silently resumed
a pre-existing active run under the wrong policy, wasting the user's
potions before anyone caught it. The fix (`ResumeConfirmationRequired`
gate, refuses to resume any run the invocation didn't start unless
`--resume-existing` is passed) landed and is unit-tested, but has never
fired against real server state — worth keeping in mind if anything today
surfaces a stray active run.

Juiced runs are explicitly OUT of scope this session — queued for a
separate, calmer session per the user's own call, partly for daily
run-budget reasons (a juiced run costs 3 of the 12 daily units, confirmed
session 23) and partly so the untested resume-safety gate gets its first
live exercise on a day with full attention, not folded into today.

Today's spine: **Task 10's real unattended gate**, on a day that finally has
what it needed — full fresh 12/12 dungeon, 20/20 fishing at reset.

---

## 1. Revise the 8-hour target before starting — with reasoning, not a guess

TASKS.md's "eight-hour unattended session" gate predates both the ROM
energy discovery and the confirmed real per-day run/cast counts (12
dungeon, 20 fishing). The gate's own language ("energy-regen sleeps") reads
like it assumed energy was the slow, scarce resource requiring hours to
exhaust and recover — that's no longer the actual binding constraint, and
may never have been.

**The real limit is the game's own per-day counts, not energy.** At this
project's action pacing (1200ms + jitter, a handful of actions per run/
cast), spending the full day's allowance — 12 runs + 20 casts — is likely
well under an hour of continuous play. Once those caps are hit, the only
remaining thing to verify is that the orchestrator recognizes it and idles
cleanly rather than erroring or busy-retrying. The NEXT real milestone
after that — surviving to tomorrow's UTC reset and resuming — is roughly
24 hours out, which even the original 8-hour figure was never going to
reach anyway. So most of an 8-hour window would prove nothing new.

**Target 2 hours instead of 8** — enough to comfortably cover all real
activity plus a solid buffer confirming graceful idle behavior with zero
exceptions, without paying for hours that test nothing. Log the actual
wall-clock time it takes to exhaust today's caps; this project has been
guessing at this number for four sessions and should have a real one now.

**Update TASKS.md's Task 10 gate text itself** with this reasoning before
running it — don't just quietly run a shorter window than what's written.
State the new target and why, same discipline as every other gate revision
in this project's history (see how Task 4.5/5/11's gates were each
restated with reasoning, not silently reinterpreted).

## 1a. What "2 hours" actually means — read this before running

`orchestrator.ts` is a plain background script, not an LLM loop — the 2-hour
window is the SCRIPT's wall-clock runtime (rate-limited API calls, 1200ms +
jitter per action), not a budget for Claude's own effort or token usage.
Claude's actual work here is starting the process and later reading its
output; the 2 hours in between is the script idling/pacing on its own.

**2 hours is a ceiling, not a target to fill.** If the real caps get
exhausted in 45 minutes as the math above suggests, let it idle cleanly and
report that — do not manufacture extra activity, extend scope, or otherwise
pad the session to consume the full window. The number exists to bound how
long an unattended run is allowed to take, not to mandate that much work
actually happen.

## 2. Run it

`npx tsx scripts/orchestrator.ts --hours=2` (or whatever the revised gate
settles on), outside an interactive session so it actually runs unattended.
Watch for:

- Zero unhandled exceptions.
- Correct recognition of hitting the daily dungeon (12) and fishing (20)
  caps, with clean idle behavior after — not busy-polling, not erroring.
- Daily rollup generated.
- Energy spend within budget (should be trivially true today given ROM
  headroom, but confirm rather than assume).
- Whether `ResumeConfirmationRequired` ever fires (only relevant if
  something leaves a run active mid-session — unlikely in a clean
  orchestrator-only run, but note it either way).

## 3. Report real numbers afterward

How long it actually took to exhaust both caps, whether the 2-hour window
was well-calibrated (too long, too short, about right), and whether the
gate should be revised again based on what actually happened versus what
was predicted above.

---

## Your task

1. Revise TASKS.md's Task 10 gate text to state the 2-hour target and the
   reasoning (per-day counts bind before energy does).
2. Run `orchestrator.ts` for that window, outside an interactive session.
3. Report: wall-clock time to exhaust both caps, zero-exception confirmation,
   idle-behavior correctness, daily rollup contents.
4. Do not touch juiced runs this session — queued separately.
