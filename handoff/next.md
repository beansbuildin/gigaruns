# BRIEF — session 114 — confirm the Tier-2 rotation order on the first post-reset day, then remaining Tier-2 runs if authorized

**This document replaces the session-113 `next.md`.** Session 113 closed
113 complete: ring model implemented and confirmed 4/4 live, double-lethal
override disabled and confirmed live, fishing and three Tier-2 runs all
GATE PASS. **Before doing anything below, read STATE.md's "Settled — do
not re-open" digest — it is long and every entry in it is closed.**

The one thing session 113 could not do is baked into this brief: it spent
all three of its runs on the SAME faction day (game day 20695, Foxglove),
so the rotation order is still n=1 — every candidate day→faction offset
still fits. **The daily reset (dungeon cap + faction day) lands
2026-08-31 18:00 UTC / 11:00 Pacific.** Any run authorized after that
instant, on a new faction day, is the second data point that turns this
from a 7-way unknown into a solved map. STATE.md calls this "the
highest-value cheap measurement available" — it is free in the sense that
it rides on a run you'd spend anyway, not in the sense that it doesn't
need a run.

---

## Step 0 — confirm the day actually rolled before assuming anything

**Do not trust the pre-reset clock reading; re-check live.** Session 113's
scratch notes read `secondsTillNextDay` from `/offchain/static` at 23:16
UTC on 2026-08-30 and projected the rollover to 18:00 UTC on 08-31 — that
is a projection, not an observation of the new day.

1. `client.getGameDay()` (or `npx tsx scripts/checkDungeonToday.ts`, which
   wraps it) — read `currentDay` live. Compare against 20695.
   - **If `currentDay` is still 20695**: the reset has not landed yet (or
     landed later than projected). Stop. Do not spend a run trying to
     force a measurement — report the actual value and how long until
     `secondsTillNextDay` says it will roll, and wait for a session after
     that.
   - **If `currentDay` has advanced**: proceed to Step 1. This is the
     confirmation that a new faction day is live.
2. Read current silver-ring balances for all seven factions before
   spending anything, so the before/after diff is clean. Session 113 left
   these at Foxglove 45, all others at their session-113 closing values —
   pull the live numbers fresh rather than assuming the log is current.
3. `npx tsx scripts/checkDungeonToday.ts` — confirm the run-unit cap reset
   to 12/12 (fresh day) rather than assuming it did. If it did NOT reset
   alongside the day advancing, that's itself a finding — report it rather
   than reconciling it silently.

## Step 1 — the measurement: one juiced Tier-2 run on the new day

**Only if Step 0 confirms a new `currentDay`.**

1. Before spending: if session 113's Step 1.3 search for an advance
   faction-indicator field found nothing (per STATE.md — it found
   nothing, search marked COMPLETE, do not re-hunt it), this faction is
   only knowable after the fact from the balance diff. Don't re-run that
   search.
2. `--dry-run` first, per standing rule 4.
3. One juiced Tier-2 run: `--runs=1 --juiced --juiced-index=2`. No
   chaining — rule 11, stop after this one run regardless of how much cap
   remains.
4. **After the run**, read silver-ring balances again. Report:
   - which single faction moved (expect exactly one, per the confirmed
     3-of-one-faction model — if more than one moved or the amount isn't
     3, that's a falsification of session 113's model, not noise; stop
     and report it as such rather than averaging it away)
   - the new `currentDay` and `currentDayOfWeek`, alongside the faction
     that moved — this pair IS the second point on the day→faction map
   - whether Foxglove (yesterday's faction) or a different faction moved.
     Either outcome is informative; a repeat of Foxglove on a new day
     would itself be worth flagging since it narrows the period rather
     than just the offset.
5. Rule 8 governs the in-room picks (highest non-Perpetual tier,
   lowest/no-modifiers at the final room), unaffected by any of the above.
6. Stop after this run and report. Getting a second faction-day point does
   not by itself authorize the remaining 3 runs in today's fresh cap —
   get explicit go-ahead before spending further, standard rule 11.

## Step 2 — if authorized to continue: remaining Tier-2 runs

Only proceed here on explicit go-ahead after Step 1's report, same
discipline as every session except 108's one-time exception.

1. `--dry-run` first, then `--runs=1 --juiced --juiced-index=2` per run,
   one at a time, stop and report between each.
2. After each run, confirm the SAME faction moves again (it should — the
   faction is fixed for the whole calendar day, only the day-to-day
   identity is what Step 1 is measuring) and the amount is still exactly
   3. A change mid-day would be a bigger finding than the rotation
   measurement itself — stop and report rather than continuing.
3. Rule 13 discipline on any denied/blocked/interrupted run, as always.

## Step 3 — fishing, if there's headroom and it's requested

Not pre-authorized by this brief — session 113 already ran a 20-cast
batch under the new oil policy and closed it out GATE PASS. Only run more
fishing this session if the user asks for it live; otherwise leave it for
its own brief so this session stays focused on the rotation measurement.

---

## Carry forward — do not let these go unmentioned again

Neither is this session's job, but STATE.md and TASKS.md both flag that
they keep getting closed out unmentioned. Say a sentence on each in the
recap even if the answer is "still not this session":

- **Whether the Tier-1/Tier-3 arm is a usable baseline for anything
  downstream.** Ninth session unactioned as of session 113 (STATE.md open
  question 3) — this would be the tenth if it goes unmentioned again.
- **`chooseNewCard`'s currency flaw** (a one-zone crit scored against a
  five-zone hit as the same event). TASKS §13 — first candidate fix is
  built but NOT wired, gate still not meetable; this is a DATA problem,
  not a code problem, and stays parked without a user directive. Do not
  attempt to wire it without one.

## Recap, for the whole session

State explicitly, at the top of the recap:

- Step 0: the live `currentDay` reading, whether it had advanced past
  20695, and the fresh run-unit cap reading.
- Step 1 (only if Step 0 confirmed a new day): which faction moved, the
  amount, the new day's `currentDay`/`currentDayOfWeek`, and what that
  does or doesn't resolve about the rotation order/period — don't
  overclaim from n=2; say plainly what is and isn't determined yet.
- Step 2, if run: per-run faction/amount confirmation, rooms, Hard Core,
  Dendren Root.
- Step 3, only if it happened.
- The two carry-forward items above, addressed by name even if the answer
  is "not this session."

Full suite (`--maxWorkers=4`, UNSANDBOXED — `profile.test.ts` false-fails
sandboxed), `tsc --noEmit`, `git diff --check`, secret scan
(`scripts/secretScan.ts`, quote its summary verbatim) — standard closeout,
same as every session.
