# STATE — session 19 — 2026-08-17 — commit (pending, see final commit this session)

## Status
Two independent threads, both from `next.md`. Housekeeping (CLAUDE.md recap
line) and Task 10 (Orchestrator, "if time remains") are new; ROM factory-claim
was the brief's main task.

**ROM factory-claim documentation/live-claim gate: GATE PARTIAL.** Endpoint,
request shape, and one live claim confirming the credited amount lands in the
real spendable pool are all DONE. Cooldown behavior is NOT fully
characterized — only lower-bounded (>34s), not a real duration. ROM
enumeration (how many ROMs, how listed) is UNRESOLVED — no read endpoint
found after dumping and searching three related endpoints.

**Task 10 (Orchestrator): GATE PARTIAL, explicitly not the full gate.** Built,
unit-tested, and live-smoke-tested (one real dungeon run + a mid-run SIGINT,
both behaving correctly). The gate's actual eight-hour unattended window was
NOT attempted — cannot be run and verified inside one interactive session.
See "Open questions" below for what's needed to actually close it.

Housekeeping (CLAUDE.md recap-against-final-commit line): DONE.

Next per TASKS.md: nothing else numbered is open. Task 10's real 8h run is the
concrete next action, once someone can leave it running unattended.

## What works
- `POST /roms/factory-claim` — confirmed live: one real claim (romId 2097)
  succeeded (HTTP 200), and `GET /offchain/player/energy` before/after
  confirms the credited amount lands in the SAME spendable pool dungeon/
  fishing draw from (net of natural regen, ~1.0 energy credited).
- Orchestrator scheduler (`src/orchestrator/scheduler.ts`) — `--dry-run`
  against the live account read real energy/guard state and picked the
  correct next action (verified by eye against the real numbers printed).
- Graceful SIGINT (`src/orchestrator/shutdown.ts`, wired into `runOnce`/
  `runOneCast`) — live-verified: a real dungeon run in progress (mid-reward-
  pick) received SIGINT, finished that action, then stopped cleanly at the
  NEXT turn boundary rather than mid-turn ("run left active at room 2"),
  correct energy delta recorded (95→75, 20 spent), guard state persisted,
  process exited 0 with no unhandled exception.
- `isBudgetGuardTrip()` mode-isolation classifier — unit tested against every
  `GuardTrip` reason string `guards.ts` actually throws; confirmed budget
  reasons vs. anomaly reasons are correctly separated.

## What's broken
- Nothing newly broken. The pre-existing corpus-count test fragility (stale
  hardcoded literals after any new live capture) fired again this session,
  as expected — see Corrections.

## Corrections to SPEC.md
- None to existing content — added a new CONFIRMED section (ROM
  factory-claim) rather than correcting anything prior.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.
- New: `POST /roms/factory-claim` — CONFIRMED, request needs `amount` present
  (omitting it → HTTP 500) but the value does NOT control the credited
  amount (sent 57, credited ~1.0). See SPEC.md's new section.

## Dead ends
- Looked for a ROM-enumeration read endpoint by dumping `GET /user/me`,
  `GET /game/account/{address}`, `GET /offchain/static` and searching every
  field for "rom"/"factory" (CLAUDE.md §2's "dump a related endpoint" rule).
  None found — don't re-check these three specifically without new
  information; the next lever is asking the user for a DevTools capture of
  whichever UI panel lists owned ROMs.
- `GET /gamewebui/actions` also checked (a UI-panel registry used to resolve
  a different question in an earlier session) — no ROM/factory mention.

## Metrics
- Tests: 325/325 at session start → 343/343 at end (+18 from Task 10's own
  new tests: `scheduler.test.ts`, `shutdown.test.ts`, plus additions to
  `guards.test.ts`). `npx tsc --noEmit` clean throughout.
- ROM claims: 1 succeeded (romId 2097, ~1.0 real energy credited, request
  `amount` was 57 and did not matter), 3 failed (romId 7959 ×2 — never once
  succeeded this session; romId 2097's own immediate 34s-later re-claim) —
  all failures HTTP 500 `{"error":{}}`, uninformative but state-dependent
  (energy unchanged on every failure, confirmed via before/after reads).
- Live dungeon (orchestrator smoke test): 1 run, room 1 combat won (3
  exchanges, clean model match), SIGINT'd before room 2's first action, 20
  energy spent, run left active/resumable (not completed, not abandoned
  mid-turn).
- Fishing: untouched this session (0 casts) — today's guard budget already
  had 9/15 casts, 108/200 energy spent from a prior session.
- Corpus growth from the one live smoke-test run: +3 exchanges (417 total),
  +6 side-updates (834 total), +1 boon pickup (41 total), +1 room-1 offer
  triple (63 room-1 options total), +1 new distinct player loadout (`38/16`,
  hpMax 36→38), +1 new unmodelled boon type (`AddBurnShield`, offered not
  picked). `battleCoverage.scored` at the Task 4 gate's seed moved 1108→1127
  (reshuffling from the larger offer pool, not a regression — `tsc`/tests
  confirm the model itself is unchanged).

## Open questions for Claude
1. ROM enumeration is still unresolved and needs the user directly — ask for
   a DevTools capture (or even just a description) of whatever UI panel
   lists this wallet's owned ROMs. Only 7959 and 2097 are known.
2. ROM cooldown duration is only lower-bounded at >34 seconds. Worth asking
   the user directly whether they know it (minutes? hours? daily, like the
   dungeon/fishing guard budgets?) rather than spending a session waiting it
   out empirically.
3. Given a single claim delivered ~1.0 energy — not the 7/57 the captured
   request bodies showed — is ROM claiming still worth pursuing as an
   energy-bottleneck lever at all? Worth an explicit user check-in before
   any future session invests more time sizing it: it may simply be a small
   trickle, not the lever the brief hoped for. Do NOT automate claiming
   regardless of the answer (session-19 brief's own instruction, still in
   force) until the real daily total is known.
4. Task 10's actual eight-hour unattended gate needs someone to run
   `npx tsx scripts/orchestrator.ts --hours=8` and leave it running,
   separately from any interactive chat session, then have the resulting
   log/rollup checked afterward. This is the concrete next action to close
   the task, not further code work.
5. The orchestrator's dungeon runs go potion-free (known simplification,
   stated in the script's own header) — worth deciding whether to wire in
   the existing potion-loading logic from `liveRun.ts`'s `main()` before the
   real 8h run, or accept a potion-free first attempt.

## Files changed
```
$ git diff --stat (working tree vs HEAD before this session's commit)
15 files changed, 314 insertions(+), 18 deletions(-)
+ untracked: scripts/orchestrator.ts, scripts/probeRoms.ts,
  scripts/probeRomsFactoryClaim.ts, src/orchestrator/scheduler.ts,
  src/orchestrator/shutdown.ts, tests/orchestrator/scheduler.test.ts,
  tests/orchestrator/shutdown.test.ts,
  fixtures/dungeon-runs/run-2026-08-17-01-23-21/ (redacted + gitignored raw/),
  fixtures/probe/roms/ (4 factory-claim response fixtures, no address/username)

Modified: CLAUDE.md, QUESTIONS.md, SPEC.md, TASKS.md, handoff/DECISIONS.md,
scripts/liveFishing.ts, scripts/liveRun.ts, src/orchestrator/guards.ts,
src/sim/boons.ts, src/sim/enemies.ts, tests/boons.test.ts,
tests/dungeonSim.test.ts, tests/enemies.test.ts, tests/guards.test.ts,
tests/replay.test.ts

Also written (gitignored, not in diff): config/discovered.json's new `roms`
block.
```
