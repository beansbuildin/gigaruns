# BRIEF — session 115 — verify the offline `chooseNewCard` fix for real, then the day-20697 rotation point if the reset has landed

**This document replaces the session-114 `next.md`.** Session 114 closed
complete: the rotation measurement landed (day 20696 charged Summoner, not
Foxglove — the faction DOES rotate, n=2 now), three more authorized runs and
24 fishing casts ran clean. **Both daily caps are now exhausted** (12/12
dungeon run-units, fishing charged out) as of day 20696. **Before doing
anything below, read STATE.md's "Settled — do not re-open" digest.**

**Something changed OFFLINE, between sessions, and it is this session's
FIRST job to verify it for real — see Step 0.** With both live caps already
spent, the user gave a direct chat directive to fix `chooseNewCard`'s
currency flaw (STATE.md session 114 open question 5 / TASKS.md §13 point 3):
the old formula compared a one-zone crit and a five-zone hit as the same
"power," which is exactly the recorded session-92 bad choice. The fix —
weight each effect by the zone count that earns it — was written, and the
two affected test files were updated, and both were verified **only in an
isolated sandbox** (the offline session had no shell on this repo and no
live JWT). **The real suite has never run against this change. Do not trust
it, do not build on it, until Step 0 confirms it for real.** Full details:
DECISIONS.md 2026-09-01, TASKS.md §13.

---

## Step 0 — verify the offline `chooseNewCard` fix for real, FIRST, before anything else

1. `git status` / `git diff` — confirm what actually landed:
   `src/strategy/fishing/cardChoice.ts`, `tests/fishing/cardChoice.test.ts`,
   `tests/fishing/cardReachability.test.ts`, plus the DECISIONS.md and
   TASKS.md entries dated 2026-09-01. Read the diff, don't assume the
   description above is exact.
2. Full suite (`vitest run --maxWorkers=4`, UNSANDBOXED — `profile.test.ts`
   false-fails sandboxed), `tsc --noEmit`, `git diff --check`. The isolated
   sandbox check claimed 45/45 on the two affected files and a clean
   subset typecheck — **confirm the FULL 2297+ suite is still green**, not
   just those two files; a dependency this session didn't know to check
   could still break.
3. Secret scan (`scripts/secretScan.ts`), quote its summary verbatim, same
   as every session's closeout.
4. Report explicitly: did the real suite agree with the sandbox check, or
   did anything the isolated verification couldn't see turn up? If the
   real suite disagrees with the sandbox result in any way, STOP, do not
   proceed to Step 1, and report the discrepancy in detail — that is a
   bigger finding than any of this session's live measurements.
5. This step spends nothing live and can run regardless of the day/cap
   state below.

## Step 1 — confirm the day actually rolled before spending anything live

**Do not proceed past here until Step 0 is clean.**

1. `client.getGameDay()` (or `npx tsx scripts/checkDungeonToday.ts`) — read
   `currentDay` live. Compare against session 114's closing value, 20696.
   - **If `currentDay` is still 20696**: the reset hasn't landed. Stop —
     there is nothing live to spend this session. Report the countdown
     and end here; Step 0's verification is still this session's real
     output even with zero live actions.
   - **If `currentDay` has advanced**: proceed to Step 2.
2. Read fresh silver-ring balances for all seven factions before spending
   anything — do not assume session 114's closing numbers still hold.
   Session 114 itself found +6 out-of-band movement (Overseer +3, Athena
   +3) between sessions 113 and 114 from user/game activity, not the bot —
   so read the post-run diff as "which faction went down by exactly 3,"
   not "which faction moved."
3. `npx tsx scripts/checkDungeonToday.ts` — confirm the run-unit cap reset
   to 12/12 rather than assuming it did.

## Step 2 — the measurement: one juiced Tier-2 run on the new day

**Only if Step 1 confirms a new `currentDay`.**

1. **Day 20697 predicts Chobo (134)**, per the two-point candidate
   `faction = ((dayOfWeek + 1) mod 7) + 1` (STATE.md session 114). This
   would be the THIRD point on the rotation map, and a non-adjacent one is
   worth more than another consecutive day — but if the reset skipped a
   day (more than one day has passed since 20696), say so explicitly and
   treat the actual `currentDay` as what it is, not as the assumed 20697.
2. `--dry-run` first, per standing rule 4.
3. One juiced Tier-2 run: `--runs=1 --juiced --juiced-index=2`. No
   chaining — rule 11, stop after this one run regardless of cap remaining.
4. **After the run**, read silver-ring balances again. Report which single
   faction moved and by how much (expect exactly one faction, exactly 3 —
   a different pattern is a falsification of the confirmed model, not
   noise), the new `currentDay`/`currentDayOfWeek`, and whether it matches
   the Chobo prediction. Either outcome (matches or doesn't) is real
   information about the rotation's period/order — say plainly what is and
   isn't determined with n=3.
5. Rule 8 governs in-room picks throughout, unaffected by any of the above.
6. Stop after this run and report. A third rotation point does not by
   itself authorize further runs — get explicit go-ahead, standard rule 11.

## Step 3 — if authorized to continue: remaining Tier-2 runs, Tier-1/Tier-3 baseline

Only on explicit go-ahead after Step 2's report.

1. **STATE.md session 114 flags the Tier-1/Tier-3 baseline question (open
   Q4) as now a cheap, well-defined experiment** — there is a five-run
   same-arm Tier-2 anchor (s113 run 3 + all four of s114's runs), so a
   single Tier-1 or Tier-3 run on THIS SAME loadout would give the first
   clean cross-tier read. If the user authorizes spending one of the
   remaining runs on this instead of another Tier-2 run, that is
   explicitly sanctioned by STATE.md — ask rather than assume either way.
2. Otherwise, remaining Tier-2 runs: `--dry-run` first, then `--runs=1
   --juiced --juiced-index=2` per run, one at a time, stop and report
   between each. Confirm the SAME faction moves again by exactly 3 each
   time — a mid-day change would be a bigger finding than the rotation
   measurement itself.
3. Rule 13 discipline on any denied/blocked/interrupted run, as always.

## Step 4 — fishing, only if requested

Not pre-authorized by this brief — session 114 already closed out a
24-cast batch. Only run more if the user asks for it live this session.

---

## Carry forward — do not let these go unmentioned again

- **`BurnMastery` floor-vs-round** still needs an ODD plain (non-crit,
  non-multiplied) amount to separate the two readings — named by session
  113, still absent after session 114's four more pairs (STATE.md open Q6).
- **`Intimidating` (§68), `BurningTenacity` (§69), `CritHeal` (§66)** — all
  three hold at their DEFAULT (latent/hold) per standing rule; do not model
  any of them without an explicit user directive. Say this plainly in the
  recap rather than letting them go unmentioned.
- **`chooseNewCard`'s currency flaw is NO LONGER on this list** — see Step
  0. Only mention it again if Step 0's real-suite verification found a
  problem the offline sandbox check missed.

## Recap, for the whole session

State explicitly, at the top of the recap:

- Step 0: the real suite/typecheck/secret-scan result for the offline
  `chooseNewCard` fix — this is the load-bearing item, first.
- Step 1: the live `currentDay` reading and whether it had advanced.
- Step 2 (only if a new day): which faction moved, the amount, and
  whether day 20697 matched the Chobo prediction.
- Step 3, if run: per-run detail, and whether a run went to the
  Tier-1/Tier-3 baseline experiment instead of another Tier-2 run.
- Step 4, only if it happened.
- The three carry-forward items above, addressed by name.

Full suite (`--maxWorkers=4`, UNSANDBOXED), `tsc --noEmit`, `git diff
--check`, secret scan (`scripts/secretScan.ts`, quote its summary
verbatim) — standard closeout. Note this already happened once in Step 0;
re-run it at close only if Steps 1-4 changed anything beyond Step 0's
state.
