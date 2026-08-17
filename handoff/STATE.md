# STATE — session 25 — 2026-08-17 — commit 9e32109

## Status
Task 10 "Orchestrator, 2-hour live gate": **GATE PASS.** Retried after
session 24's potions leak was closed; the user ran
`caffeinate -i npx tsx scripts/orchestrator.ts --hours=2` unattended, in
their own terminal, and it ran to completion on its own with zero unhandled
exceptions, zero potions used, both real daily caps hit and recognized
cleanly, and a rollup printed.
Next per TASKS.md: Task 13 (`chooseNewCard` deck-composition scoring,
scoped session 22, NOT STARTED) is the next unblocked task. Task 11's
dungeon half is PARKED (weight-tuning dead end, session 13). Task 12
(potion timing) is fully MET. Task 14 (bot-initiated juiced `start_run`)
stays BLOCKED on a live DevTools capture.
Overall: Task 10 is DONE — the project finally has a real number for "how
long to exhaust a day's budget" (~45 minutes) instead of the original
8-hour guess. A concrete new fishing-mechanic lead (`nextPosition`/
`nextMovePath`, below) surfaced as a byproduct and is worth a look before
diving into Task 13.

## What works
- **Orchestrator, real 2-hour unattended run, completed** — 12/12 dungeon
  runs (216/240 energy), 20/20 fishing casts (239/240 energy), clean
  `"done for today"` idle, full rollup, exit 0. Real wall-clock to exhaust
  both real daily caps: **~45 minutes** (~27 of which was one
  energy-regen sleep down to 4/420, ~18 minutes active play across 32
  actions). Scheduler interleaved both modes by relative daily-budget
  headroom throughout, confirmed live (not just unit-tested).
- **Potions leak fix holds** — zero potion log lines anywhere in the run;
  confirmed at both the config level (`forbiddenWoods.potions` absent) and
  the code level (`orchestrator.ts`'s `resolvePotionLoadout()` and
  `liveRun.ts`'s loadout path both fail safe to 0 when the block is
  absent).
- Two boons got their first-ever pickup pairs this session:
  `VulnerableEvade` and `AddLifestealMagic`, both modelled
  `{kind:"latent"}` (zero delta at pickup, same shape as `AddBurnSword`).
- Full test suite + typecheck, re-run against the final commit: **404/404,
  `tsc --noEmit` clean.**

## What's broken
- Nothing broken in the codebase from this session's own changes.
- **Known, not fixed**: the scheduler cannot learn about energy gained
  outside its own tracking (e.g. a manual ROM claim mid-run) — it only
  re-polls real energy when a sleep completes or the process restarts, and
  a single SIGINT during a sleep ends the WHOLE session (not just that
  wait) because `shutdown.ts` sets `requested` on the first press, which
  the outer loop also checks. Surfaced live this session when the user
  topped energy up manually mid-sleep and had no way to tell the running
  process.
- **New lead, not chased down**: three fishing casts this session hit
  `liveFishing.ts`'s unknown-terminal-field detector on
  `data.nextPosition`/`data.nextMovePath`. The code's own inline comment
  guesses this is "the catch-resolution mechanic" (`QUESTIONS.md §10`) —
  **that guess looks wrong on inspection of the actual dumps.** These
  fields sit alongside `fishPosition`/`previousFishPosition` in
  `doc.data`, not near `cardChosenId`/`caughtFish` (the real
  catch-resolution fields from session 17). One dump has concrete values —
  `fishPosition: [2,3]`, `nextPosition: [1,3]`, `nextMovePath: [3]` — which
  reads far more like a **look-ahead reveal of the fish's next move** than
  anything catch-related. Only checked on a cast's TERMINAL doc (the
  detector only fires there), so it's unknown whether this is present on
  every turn's response and just never surfaced before, or genuinely new.
  See QUESTIONS.md §12 (new) for the full dumps and reasoning. If this
  holds up, it could remove the need for `mineFishPatterns.ts`'s
  after-the-fact pattern mining entirely — worth checking before Task 13.

## Corrections to SPEC.md
- None this session — no SPEC claim was contradicted by a live response.
  (The two new boon models and the fishing lead above are additions, not
  corrections to an existing claim.)
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- None new this session. (Session 24's two dead ends — launching a
  multi-hour background process from within Claude Code, and inferring a
  resumed run's potion-slot usage from state reads — stand unchanged and
  weren't re-attempted.)

## Metrics
- Tests: 404/404 at final commit (+5 from 399 at session start: 2 new
  clean/latent boon models, corpus-total assertions updated for +30
  offers). `npx tsc --noEmit` clean throughout.
- Dungeon: **12/12 real runs used today**, 216/240 energy. 12 real runs
  played this session (the full daily cap), outcomes not separately
  tallied (not gated — Task 5/11's room-1 battle win rate is the gated
  metric, unaffected by this session).
- Fishing: **20/20 real casts used today**, 239/240 energy. 1 mined
  pattern (`perimeterWalk(cw)`) seeded the matcher throughout; no catches
  this session (all casts ended "escaped").
- Energy: real account energy 139/420 at session end (regen 18/hr). Local
  `data/guard-budget.json`/`guard-budget-fishing.json` correctly tracked
  real spend end-to-end this time (216/239) — session 24's local
  under-recording bug did not recur.
- ROMs: untouched.

## Open questions for Claude
1. Is `data.nextPosition`/`data.nextMovePath` (see "What's broken" above,
   full dumps in `QUESTIONS.md §12`) worth a dedicated capture session
   before Task 13? If it's a genuine live look-ahead of the fish's next
   move on every turn (not just the terminal one), it would let the live
   loop react to real information instead of `mineFishPatterns.ts`'s
   after-the-fact statistical inference — a bigger win for fishing
   accuracy than anything Task 13 scopes.
2. Task 13's own brief (session 22) already flagged its validation floor
   as the harder problem: `castSim`'s fish-pattern model is only weakly
   checked against reality (matcher-blind 6.6% vs. matcher+mined 16.2% sim
   catch rate, real rate ~3.3% off a single-digit sample). Does question 1
   change that calculus, or should Task 13's deck-aware `simulateCast`
   infrastructure step proceed regardless since it "needs no new live
   capture" per its own scoping note?
3. Should `shutdown.ts` grow a way to skip the current energy-regen sleep
   without ending the whole session (e.g. a distinct signal/flag file), or
   is a full restart (documented as safe — guard state persists across
   process invocations) an acceptable answer to "I added energy, stop
   waiting"?

## Files changed
```
$ git show --stat HEAD (last commit, non-fixture)
TASKS.md              |  64 ++++++++++++++++++++
src/sim/boons.ts       | 163 ++++++++++++++++++++++++++++++++++++++++++++++++++
tests/boons.test.ts    |  26 ++++++--
tests/enemies.test.ts  |  10 +++-
4 files changed, 258 insertions(+), 5 deletions(-)

+ fixtures/dungeon-runs/run-2026-08-17-{20-33-23,20-36-03,20-37-00,20-39-09,
  21-08-10,21-09-37,21-10-32,21-12-02,21-14-12,21-16-02,21-17-23}/ (11 new
  run dirs, 11 distinct DUNGEON_ID_CID values — one short of
  `data/guard-budget.json`'s `runsStarted: 12` for the day; unexplained,
  not investigated, doesn't affect the gate)
+ fixtures/fishing-casts/live/cast-2026-08-17-{20-35-46 .. 21-18-46}/ (20
  new cast dirs, the session's 20 live fishing casts)
```
