# BRIEF — session 121 — day-20699 rotation point, the decisive measurement, JWT very likely expires before a session after this one

**Renumbered from session 120 to 121**: a second offline session (120, this
same day) did front-end/web-UI work between this brief being drafted and
the next live session running — see `handoff/log/session-120.md`. Nothing
in the content below changed, only the number this brief is written for.

**This document replaces the session-116 `next.md`, which had gone stale —
session 118 flagged this itself (STATE 118 open question 7) but closed
without replacing it.** Session 118 closed the day fully spent (dungeon
12/12, fishing 23 played / 20/20 charged, 15/23 = 65.2% caught) and the
day-20698 wrap test FAILED: `faction = dayOfWeek + 2` predicted Crusader,
the server charged Athena. **Before doing anything below, read STATE.md's
"Settled — do not re-open" digest — it is long and several entries in it
are exactly the traps this brief exists to route around.**

**⚠ JWT: expires 2026-09-04T18:48:43Z.** Session 118 measured 41.5h of
runway at its own recap. Depending on when this session runs, this is very
likely the LAST live session, or very close to it. Step 0 below is
unchanged from the last two briefs for exactly this reason — confirm before
spending anything, and if the runway is down to a few hours, say so plainly
and let the user know directly rather than only noting it in the recap.

**⚠ Rod: the 0-durability halt from session 118 is now understood, narrowly.**
Session 119 (offline) confirmed directly with the user that the rod's
0→50 recovery mid-session-118 was a **manual repair**, not a timer — see
`handoff/DECISIONS.md`, 2026-09-03. That does NOT mean durability can be
ignored: a rod hitting 0 mid-batch is still a hard stop that needs the
user, not something to wait out. Read the rod's current durability before
committing to a long fishing batch rather than assuming session 118's
recovery means it will always come back on its own.

---

## Step 0 — confirm the JWT is still good before anything else

1. Check the JWT's expiry against the current time (wherever it's read
   from live — do not hardcode 2026-09-04T18:48:43Z from this brief,
   confirm it). If expired or within a few hours, stop before spending
   anything, report the exact expiry and remaining runway, and tell the
   user directly this needs a refresh — don't bury it at the bottom of a
   recap.
2. If there's runway, proceed to Step 1. Note the remaining time in the
   recap either way — this is very likely one of the last sessions able to
   do live work at all.

## Step 1 — confirm the day live before assuming 20699

**Do not trust this brief's projection — verify.**

1. `npx tsx scripts/checkDungeonToday.ts` (or equivalent) — read
   `currentDay` live. Compare against session 118's close, 20698.
   - **If `currentDay` is still 20698**: the reset hasn't landed. Stop —
     nothing live to spend this session. Report the countdown and end
     here.
   - **If `currentDay` is 20699**: proceed to Step 2 — this is the
     decisive rotation-point measurement (see below).
   - **If `currentDay` has advanced past 20699**: proceed to Step 2
     anyway — say explicitly which day it actually is and that it isn't
     the day this brief expected, rather than silently treating it as
     20699.
2. Read fresh silver-ring balances for all seven factions before spending
   anything — confirm rather than assume session 118's close still holds
   (Athena 21, others per session 118's metrics).
3. Confirm the run-unit cap is a fresh 12/12 and the fishing cap a fresh
   0/20 rather than assuming either reset alongside the day. Also read the
   rod's current durability while you're at it — see the note above.

## Step 2 — the measurement: one juiced Tier-2 run on day 20699

**Only if Step 1 confirms `currentDay` at or past 20699.** This is
STATE 118's open question 3, worth stating precisely before running
anything: it discriminates the three surviving rotation hypotheses left
after the day-20698 falsification —

- (a) a fixed 7-permutation with the known fragment 5→6→7→3, leaving
  {1,2,4} (Crusader/Overseer/Archon) for dow 0/1/2 in one of 6 orders —
  under this hypothesis, day 20699 (`dayOfWeek 0`) **must** charge one of
  Crusader/Overseer/Archon. Anything else kills (a) outright.
- (b) per-day pseudo-random, under which the three consecutive +1 steps
  that held through day 20697 were a coincidence that already broke once.
- (c) a period that is not 7.

**Do not re-fit an arithmetic rule to whatever comes back** — three
consecutive +1 steps already produced a confident wrong answer once, and
STATE's "Dead ends" section says this explicitly. State the prediction
under (a) in advance, in a scratch file, before `start_run` — same
discipline that made the day-20698 falsification a real test rather than a
story fitted afterward.

1. `--dry-run` first, per standing rule 4.
2. One juiced Tier-2 run: `--runs=1 --juiced --juiced-index=2`. No
   chaining — rule 11, stop after this one run regardless of cap
   remaining.
3. **After the run**, read silver-ring balances again. Report which single
   faction moved and by how much (expect exactly one faction, exactly 3),
   the new `currentDay`/`currentDayOfWeek`, and whether it matched one of
   Crusader/Overseer/Archon (hypothesis (a) survives) or not (hypothesis
   (a) is falsified, same as the arithmetic rule was). Say plainly what is
   and isn't determined at n=5 — this measurement discriminates hypotheses,
   it likely doesn't fully solve the 6-way order even if (a) survives.
4. Rule 8 governs in-room picks throughout, unaffected by any of the above.
5. Stop after this run and report. A fifth rotation point does not by
   itself authorize further runs — get explicit go-ahead, standard rule 11.

## Step 3 — if authorized to continue: remaining runs, Tier-1/Tier-3 baseline

Only on explicit go-ahead after Step 2's report.

1. **The Tier-1/Tier-3 baseline is now a THIRTEENTH-session-old open
   question (STATE 118 open question 4).** Two independent days measure a
   ~3x within-arm spread on the same loadout (2.9x session 118, 3.2x
   session 116) — either budget several runs per arm, or retire the
   experiment by name. Ask the user directly rather than letting a
   fourteenth session pass without a decision either way.
2. Otherwise, remaining Tier-2 runs: `--dry-run` first, then `--runs=1
   --juiced --juiced-index=2` per run, one at a time, stop and report
   between each. Confirm the SAME faction moves again by exactly 3 each
   time.
3. Rule 13 discipline on any denied/blocked/interrupted run, as always.

## Step 4 — fishing, only if requested

Not pre-authorized by this brief. If the user asks for it live this
session: check the rod's current durability FIRST (see the note above —
session 118's 0-durability halt is real and can recur; it needs the user,
not a wait). Oils stay Relaxing-only per the standing [USER] directive
(double-lethal disabled, Focus Oil off the allowlist).

---

## Carry forward — do not let these go unmentioned again

- **The rod-durability print label** (STATE 118 open question 5, "has been
  declined before and is now actively harmful"). Ask directly again rather
  than fixing it unasked or letting it pass a third time unmentioned:
  `0 (before: 13, casts this batch: 18)` mixes a play-driven delta with a
  charge-driven session-cumulative count, and it's misleading exactly when
  durability is low, which is when it matters most.
- **`Intimidating` (§68), `BurningTenacity` (§69), `CritHeal` (§66)** — all
  three hold at their DEFAULT (latent/hold) per standing rule. Do not model
  any without an explicit user directive. §69 has been offered and declined
  twice now; say this plainly rather than letting it go unmentioned a third
  time.
- **`LIVE.drift`** moved a third consecutive time this last session
  (−0.6417 → −0.6593) and was pinned, not re-derived, per STATE's own rule
  (still negative, still short of −1). If it moves a fourth time, that's
  worth naming explicitly rather than another silent pin update.

## Recap, for the whole session

State explicitly, at the top of the recap:

- Step 0: JWT expiry check and remaining runway — flag plainly if this is
  likely the last live session.
- Step 1: the live `currentDay` reading, whether it matched the predicted
  20699, and the fresh run-unit cap / fishing cap / rod-durability /
  ring-balance readings.
- Step 2 (only if a new day): which faction moved, the amount, and whether
  it matched one of Crusader/Overseer/Archon (hypothesis (a) survives) or
  falsified it.
- Step 3, if run: per-run detail, and whether a run went to the
  Tier-1/Tier-3 baseline decision instead of another Tier-2 run.
- Step 4, only if it happened, and the rod-durability check that gated it.
- The three carry-forward items above, addressed by name.

Full suite (`--maxWorkers=4`, UNSANDBOXED — `tsx`/`git` both fail
sandboxed), `tsc --noEmit`, `git diff --check`, secret scan
(`scripts/secretScan.ts`, quote its summary verbatim) — standard closeout.
