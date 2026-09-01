# BRIEF — session 116 — day-20697 rotation point (likely already live), remaining runs if authorized, JWT expiry awareness

**This document replaces the session-115 `next.md`.** Session 115 closed
complete: the offline `chooseNewCard` currency fix verified for real against
the actual suite (2298/2298, exact match to the isolated sandbox check, no
discrepancy) and independently re-derived from the real card catalog rather
than trusted on the same session's own test. **Live spend was ZERO** — the
day had not rolled yet when session 115 checked (~09:39 Pacific,
`currentDay` still 20696), so its own Step-1 stop-condition fired as
written and it ended there rather than forcing a measurement. **Before
doing anything below, read STATE.md's "Settled — do not re-open" digest.**

**Two consequences of session 115 spending nothing carry forward:** first,
session 116 opens with a **full, untouched 12/12 run-unit cap** — the
reset that session 115 was 1h20m away from has very likely landed by now
(this brief is being written well after that projected reset time), so day
20697 — which predicts **Chobo (134)** as the third, non-adjacent point on
the rotation map — is probably already live. Second, ring balances showed
zero out-of-band drift across the 115 gap (unlike the 113→114 gap, which
saw +6) — read them fresh anyway rather than assuming either pattern holds.

**⚠ NEW, time-sensitive, not spending-related:** STATE.md session 115 flags
that the **JWT expires 2026-09-04T18:48Z** — as of this brief, roughly two
to three days out. Session 115 explicitly suggested making a validity check
the first step of the next brief, so that's Step 0 below. Refreshing the
JWT itself is the user's action, not something a live session can do for
itself — if Step 0 finds it close to expiry, say so plainly and let the
user know directly rather than only noting it in the recap.

---

## Step 0 — confirm the JWT is still good before anything else

1. Check the JWT's expiry against the current time (`config/discovered.json`
   or wherever it's read from — do not hardcode 2026-09-04T18:48Z from this
   brief, confirm live). If it has expired or is within a few hours of
   expiring, stop before spending anything, report the exact expiry and how
   much runway is left, and tell the user directly this needs a refresh —
   don't bury it at the bottom of a recap.
2. If there's runway, proceed to Step 1. Note the remaining time in the
   recap either way, since STATE.md flagged this session as likely one of
   the last few before it dies.

## Step 1 — confirm the day live before assuming 20697

**Do not trust this brief's projection that the reset has landed — verify.**

1. `client.getGameDay()` (or `npx tsx scripts/checkDungeonToday.ts`) — read
   `currentDay` live. Compare against session 115's read, 20696.
   - **If `currentDay` is still 20696**: the reset hasn't landed (unlikely
     given the time elapsed, but confirm rather than assume). Stop —
     nothing live to spend this session either, same as 115. Report the
     countdown and end here.
   - **If `currentDay` is 20697**: proceed to Step 2 — this is the
     predicted Chobo day, the highest-value measurement.
   - **If `currentDay` has advanced past 20697** (more than one reset
     elapsed since session 115): proceed to Step 2 anyway — whatever the
     actual day is still produces a valid rotation-map point, just not
     necessarily the specific Chobo prediction. Say explicitly which day
     it actually is and that it isn't the day this brief was written
     expecting, rather than silently treating it as 20697.
2. Read fresh silver-ring balances for all seven factions before spending
   anything. Session 115's close: Archon 30, Athena 33, Chobo 39, Crusader
   39, Summoner 42, Foxglove 45, Overseer 48 (total 276) — confirm rather
   than assume these still hold; session 115 itself found a human playing
   the account concurrently on a different dungeon, so out-of-band drift is
   a live possibility even without another bot session in between.
3. `npx tsx scripts/checkDungeonToday.ts` — confirm the run-unit cap is a
   fresh 12/12 rather than assuming it reset alongside the day.

## Step 2 — the measurement: one juiced Tier-2 run on the new day

**Only if Step 1 confirms a new `currentDay` past 20696.**

1. `--dry-run` first, per standing rule 4.
2. One juiced Tier-2 run: `--runs=1 --juiced --juiced-index=2`. No
   chaining — rule 11, stop after this one run regardless of cap remaining.
3. **After the run**, read silver-ring balances again. Report which single
   faction moved and by how much (expect exactly one faction, exactly 3 —
   a different pattern falsifies the confirmed model, not noise), the new
   `currentDay`/`currentDayOfWeek`, and whether it matches the Chobo
   prediction (if this IS day 20697) or simply extends the map (if it
   isn't). Say plainly what is and isn't determined with n=3 — a third
   point starts to constrain the rotation order meaningfully but likely
   still won't fully solve a 7-way map; don't overclaim.
4. Rule 8 governs in-room picks throughout, unaffected by any of the above.
5. Stop after this run and report. A third rotation point does not by
   itself authorize further runs — get explicit go-ahead, standard rule 11.

## Step 3 — if authorized to continue: remaining runs, Tier-1/Tier-3 baseline

Only on explicit go-ahead after Step 2's report.

1. **STATE.md session 115 open question 5: the Tier-1/Tier-3 baseline is
   now an ELEVENTH-session-old, still cheap, still well-defined
   experiment** — a five-run same-arm Tier-2 anchor already exists (s113
   run 3 + all four of s114's runs), so a single Tier-1 or Tier-3 run on
   THIS SAME loadout gives the first clean cross-tier read. If the user
   authorizes spending one of the remaining runs on this instead of
   another Tier-2 run, that's explicitly sanctioned — ask rather than
   assume either way, and don't let an eleventh session close without at
   least raising it by name.
2. Otherwise, remaining Tier-2 runs: `--dry-run` first, then `--runs=1
   --juiced --juiced-index=2` per run, one at a time, stop and report
   between each. Confirm the SAME faction moves again by exactly 3 each
   time — a mid-day change would be a bigger finding than the rotation
   measurement itself.
3. Rule 13 discipline on any denied/blocked/interrupted run, as always.

## Step 4 — fishing, only if requested

Not pre-authorized by this brief. Only run if the user asks for it live
this session.

---

## Carry forward — do not let these go unmentioned again

- **`BurnMastery` floor-vs-round** still needs an ODD plain (non-crit,
  non-multiplied) amount to separate the two readings. Named by session
  113, still absent after 114 and 115 (115 spent no runs, so no new
  pairs). **Third session running** — if any run this session produces a
  qualifying observation, flag it explicitly rather than letting it pass
  unnoticed in a pile of other numbers.
- **`Intimidating` (§68), `BurningTenacity` (§69), `CritHeal` (§66)** —
  all three hold at their DEFAULT (latent/hold) per standing rule. Do not
  model any without an explicit user directive. Say this plainly rather
  than letting them go unmentioned.
- **Whether `chooseNewCard` was worth fixing blind (STATE.md session 115
  open question 7)** is a judgment question for the user, not something a
  live session resolves on its own — the fix is defensible on argument,
  not on data (validation floor is still 2 live choices project-wide,
  same footing TASKS §13's full swap is parked for). Not this session's
  job to decide, but worth surfacing once rather than dropping silently.

## Recap, for the whole session

State explicitly, at the top of the recap:

- Step 0: JWT expiry check and remaining runway.
- Step 1: the live `currentDay` reading, whether it matched the predicted
  20697, and the fresh run-unit cap / ring-balance readings.
- Step 2 (only if a new day): which faction moved, the amount, and
  whether it matched the Chobo prediction (if applicable).
- Step 3, if run: per-run detail, and whether a run went to the
  Tier-1/Tier-3 baseline experiment instead of another Tier-2 run.
- Step 4, only if it happened.
- The three carry-forward items above, addressed by name.

Full suite (`--maxWorkers=4`, UNSANDBOXED — `tsx`/`git` both fail
sandboxed), `tsc --noEmit`, `git diff --check`, secret scan
(`scripts/secretScan.ts`, quote its summary verbatim) — standard closeout.
