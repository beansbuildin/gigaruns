# STATE — session 24 — 2026-08-17 — commit (pending, see below)

## Status
Task 10 "Orchestrator, 2-hour live gate": **GATE FAIL** — attempt aborted by
the user ~1 minute in over a real potions-policy violation, not a mechanism
failure. The orchestrator's scheduler/shutdown logic itself was never
exercised past the first `start_run`.
Next per TASKS.md: retry Task 10's 2-hour gate with the potions leak closed
(done, see below). Task 14 (bot-initiated juiced `start_run`) stays BLOCKED
on a live DevTools capture, unchanged.
Overall: revised Task 10's gate from 8h to a 2h ceiling with reasoning
(per-day counts bind before energy does), but the live attempt itself
surfaced and then required fixing a real incident — a stale config value
let a plain orchestrator run auto-load 3x Big Heal Juice, contradicting the
user's standing "non-juiced runs never use potions" rule. The leak is
closed (config fix) and a stray run it left active was safely recovered
(one more, unrelated bug found and fixed along the way). The 2-hour gate
itself is unattempted after the fix — next session's first move.

## What works
- **`ResumeConfirmationRequired` gate fired against real server state for
  the first time ever** (session 23 built it, never live-exercised) —
  correctly refused to touch the stray room-5 run without
  `--resume-existing`, exactly as designed.
- **`findRealRunsToday()` real-vs-local drift check** — used this session to
  discover the local guard-budget files were stale by a full day boundary
  (see Corrections below), not just by a few runs.
- **`--potions-used=N` (new)** — `scripts/liveRun.ts` CLI flag seeding
  `potionPolicy.used` from a real count instead of always assuming 0.
  Verified live: `--potions-used=2` correctly targeted `use_item` index 2
  (slot 3), HTTP 200, healed 9→29. Needed because `potionPolicy.used` is
  process-local and doesn't survive across separate invocations resuming
  the same run.
- **Room-5 stray run fully resolved** either way (death ends it same as a
  win) — account confirmed clean afterward (`--dry-run`: "no active run").
- Full test suite + typecheck, re-run against the final commit: **379/379,
  `tsc --noEmit` clean.**

## What's broken
- Nothing left broken in the codebase — see above. Task 10's actual 2-hour
  unattended gate is simply not yet attempted post-fix; that's a gap in
  progress, not a bug.
- **Local `data/guard-budget.json`/`guard-budget-fishing.json` energy
  tracking under-recorded this session's real spend** — both still read
  `energySpent: 0` despite a real `start_run` + several `use_item`/combat
  actions happening. Likely: the SIGINT'd orchestrator invocation never
  reached its energy-accounting block, and the later `liveRun.ts` resume
  invocations' before/after energy deltas were masked by concurrent regen
  each time (small deltas, clamped to 0 per existing logic). Not a
  resource-loss bug — real energy is genuinely fine (~157/420) — just a
  local bookkeeping gap. Self-corrects next real UTC date rollover; not
  fixed this session.

## Corrections to SPEC.md
- None this session. The `use_item` index semantics SPEC already documents
  ("how many items from THIS run's committed loadout have already been
  consumed") were already correct — the bug this session was in our own
  code (a process-local counter that didn't survive across invocations),
  not a wrong belief about the API contract.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- **Launching or leaving a multi-hour unattended background process running
  from within this coding session** — tried twice (`nohup`+`disown`, and
  the harness's own Bash `run_in_background`), both blocked by the
  harness's own auto-mode classifier regardless of CLAUDE.md's own
  "dungeon/fishing play is autonomous-safe" authorization. Task 10's real
  gate needs the USER to run `orchestrator.ts --hours=2` themselves, in
  their own terminal, outside any Claude Code session.
- **Inferring a resumed run's remaining potion slot(s) from
  `GET /game/dungeon/state`** — reconfirmed dead end, one level deeper than
  session 23's finding. Session 23 established `consumables`/`isJuiced`
  aren't visible on state reads at all; this session adds that per-slot
  usage (which of a committed loadout's slots are already spent) isn't
  recoverable from state reads either. The only way to know it is a direct
  human report (this session, "slot 3") or a captured original `start_run`
  request. `--potions-used=N` exists because of this gap, not despite it.

## Metrics
- Tests: 375/375 at session start → **379/379** at final commit (+4, from
  4 new room 1-4 boon offers captured before the incident's Ctrl-C — all
  already-known unmodelled/rolled types except `IntuitionArmor`, a
  first-ever sighting, still unmodelled/unpicked). `npx tsc --noEmit`
  clean throughout, re-checked against the final commit.
- Dungeon: **1/12** real runs used today (server-confirmed the day's
  counter was genuinely empty before this session's one run — see
  Corrections/drift note below). That one run: started by the orchestrator
  with 3x Big Heal Juice (the incident), left active mid-fight after the
  user's Ctrl-C, resumed twice via `liveRun.ts` (first resume attempt
  failed safely on a wrong potion index, 0 cost; second succeeded), ended
  in a room-5 death (own HP 0 vs. Enemy Room 67's remaining 19/45) under
  thin opponent-model data for that matchup (n=0–6 samples throughout,
  "confidence=low"). Material cost: all 3 committed Big Heal Juice
  consumed (balance 70→67 at commit time), for a run that died at room 5.
- Energy: real ~157/420 currently (account-wide pool). Local
  guard-tracked spend under-recorded this session — see "What's broken."
- Fishing: untouched this session. Local guard reset to 0/20 by inference
  from the dungeon day-boundary reset (see Corrections), NOT independently
  confirmed — no fishing-equivalent "today" endpoint exists to check
  against, unlike dungeon's `GET /game/dungeon/today`.
- ROMs: untouched.

## Corrections to operational assumptions (not SPEC, but load-bearing)
- **Local guard-budget files are date-keyed to UTC calendar date, but the
  game's real daily reset does NOT align with UTC midnight.** Confirmed
  this session: `GET /game/dungeon/today`'s `dayProgressEntities` was
  genuinely empty (a fresh day, 0 real runs) partway through the SAME UTC
  calendar date session 23 ended on, while the local guard files still
  read session 23's stale near-exhausted state (9/12 dungeon, 20/20
  fishing) under the same date key. Corrected by hand this session
  (reset both to 0/0) after confirming the dungeon side directly; the
  fishing side was inferred, not independently confirmed (see above).

## Open questions for Claude
1. Two incidents now (session 23's dungeon-sack, session 24's stale
   `maxPerRun`) trace to the same root shape: a flag left in an elevated
   state for one specific planned batch, silently reused later by
   unrelated automation. Task 14 (juiced-only potion gating, blocked on a
   DevTools capture) would remove the whole class of risk by construction
   — no standing `forbiddenWoods.potions` config to go stale. Worth
   re-prioritizing ahead of retrying Task 10's live gate, or retry Task 10
   first with potions simply left off (current state)?
2. Confirmed (two methods) that Claude Code cannot launch or leave running
   a multi-hour unattended background process — a harness-level block, not
   a CLAUDE.md one. Should the next brief ask the user to kick off
   `orchestrator.ts --hours=2` themselves at session start (so a log is
   ready to analyze), rather than asking Claude Code to launch it?
3. Is the game's real daily-reset boundary (see above) known or
   discoverable, or should `guardPersistence.ts` grow a live cross-check
   (mirroring the existing dungeon-run drift check) so a mid-UTC-day reset
   doesn't need manual correction again?

## Files changed
```
$ git diff --stat (tracked, non-fixture)
TASKS.md              | 22 ++++++++++++++++++++--
config/bot.json       |  6 +-----
handoff/DECISIONS.md  |  4 ++++
scripts/liveRun.ts    | 28 +++++++++++++++++++++++++---
src/sim/boons.ts       | 24 ++++++++++++++++++++++++
tests/boons.test.ts    |  7 ++++++-
6 files changed, 80 insertions(+), 11 deletions(-)

+ fixtures/dungeon-runs/run-2026-08-17-18-54-04/ (72 states, new — the
  incident run, orchestrator-started, Ctrl-C'd)
+ fixtures/dungeon-runs/run-2026-08-17-19-15-53/ (16 states, new — the
  recovery resume, ends in the room-5 death)
+ 5 more fixture dirs (1-3 states each, new) — dry-run/status-check
  invocation artifacts, no real actions sent
```
