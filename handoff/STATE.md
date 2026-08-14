# STATE — session 08 — 2026-08-14 — commit 04dddad

## Status
Task 6 "Live dungeon, supervised": **GATE PARTIALLY MET.** One completed live
run, full log, run summary derivable, model validated. Five-run stage NOT
attempted.
Next per TASKS.md: Task 6's five-run stage, now that the client is
live-battle-tested. Then Task 7 (fishing HAR, still blocked on the user's
capture) or Task 10/11 (orchestrator persistence, tuning).
Overall: this session went from a rejected JWT to the bot completing a full
Forbidden Woods run (rooms 1→4, died in room 4) unattended for most of it,
finding and fixing five distinct live bugs along the way. The combat model
held exactly through all of it — 0 mismatches across every live exchange.

## What works
- Privacy fix, CLAUDE.md §9, `config/bot.json`+`guards.ts`, the client's POST
  path — all from earlier this session, unchanged, still solid.
- `npm run check-auth` — JWT refreshed mid-session by the user, confirmed
  live: real account, corrupted-JWT halt still clean.
- `scripts/liveRun.ts` — all 4 stages now **live-verified**, not just
  unit-tested: `--dry-run` correctly reads live state and stops when idle;
  `--stage2` sent the project's first-ever POST (`start_run`) and halted as
  designed; `--runs=1` played one complete run start to death.
- `postWithVerifiedRetry()` — re-checks live state after any path-selection
  POST failure before deciding whether to retry (never assumes a 500 means
  "nothing happened" either way). This is what let the run continue past two
  genuinely flaky `reward_one` 500s without human help.
- Confirmed live action names: `start_run`/`rock`/`paper`/`scissor` (already
  known), **`reward_one`/`reward_three`** (reward-path pick — NOT `loot_one`,
  which was rejected HTTP 409), **`path_two`** (enemy-tier pick — NOT
  `enemy_two`, which failed 3/3 including one HTTP 400). Envelope for both
  families: `dungeonId: 0`, `actionToken: ""` (empty string). `reward_*`'s
  `data.index` matches the option's array position; `path_*`'s does not — it's
  always `0`.
- **Room 3's Safe-tier capture gap (open since session 06/07) is closed** —
  the bot fought enemy 65 live, all rolled stats zero, both buffs null.
  `src/sim/enemies.ts`'s `MAX_SAFE_ROOM` is now **4**, not 2.
  `AddBlock` also got its first-ever pickup pair (block 0→7, room 4) and is
  now in `BOON_MODELS`.
- `npx tsc --noEmit` — clean, exit 0, throughout.
- `npx vitest run` — **209 tests, 13 files, all pass** (155 → 209 this
  session).

## What's broken
- **Five-run stage not attempted.** This run took 5 rounds of live-discovered
  bugs and 2 human-assisted unblocks to complete — not the clean baseline
  TASKS.md's five-run gate wants to build on.
- **The root cause of the two `reward_one` HTTP 500s is still unknown.** One
  silently applied server-side despite the error, one didn't. Handled
  robustly now (verify-then-retry), but genuinely not explained — possibly
  server-side flakiness unrelated to the request.
- `path_one`/`path_three` and `reward_two`/`reward_four` are still inferred
  by naming pattern only, not individually confirmed.
- **Energy accounting resets every process.** Each `npm run live` invocation
  builds a fresh `GuardState`, so the 60-energy session budget isn't tracked
  across the several separate invocations this session actually used. Not a
  correctness bug (nothing overspent — the account has 300+ energy), but a
  real gap before unattended multi-run use: Task 10's persistence
  (`data/opponent-model.json`-style) needs to cover this too, or `guards.ts`
  needs a way to seed prior spend.
- `intuition`'s true effect is still unconfirmed. `unknownSideKeys()` is live
  and watching every poll this session; it never fired (no new key appeared).

## Corrections to SPEC.md
- §2: dungeon action envelope is NOT universal — `reward_*`/`path_*` use
  `dungeonId: 0`/`actionToken: ""` plus four extra `data` fields, unlike
  combat/`start_run`.
- §2 (Action token): `GET /game/dungeon/state`'s `actionToken` field is not
  fresh — it reports `0` regardless of real state; only POST responses
  update the tracked token now.
- §2: `/game/dungeon/state`'s "no active run" has two wire shapes (500-HTML,
  and 200 with `data.run: null`).
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren=NOT FOUND**.
- Move charges: unchanged, PRESENT.

## Dead ends
- `enemy_one`/`two`/`three` for the enemy-tier pick — wrong, refuted live
  (3/3 failures, one HTTP 400 on an identical retry). Real name: `path_two`.
- `RestrictedToDungeons` + `dungeonId: 0` as the cause of the reward-pick
  500s — refuted: a later successful pick (`AddBlock`) also carried
  `RestrictedToDungeons` and worked fine. The 500s remain unexplained.
- `loot_one` for the reward pick — wrong (HTTP 409). Real name: `reward_one`.

## Metrics
- Live: **1 complete run**, rooms 1→4, ended in death at room 4 (HP hit 0 on
  a losing exchange). 2 human-assisted unblocks (room 1's reward and
  enemy-tier picks, while the real action names were still unknown);
  everything from room 2 onward ran through `postWithVerifiedRetry`
  unattended.
- Model validation: **0 clean-model failures** across all 117 exchanges now
  in the corpus (up from 92 at session start), including the run's fatal
  exchange.
- Tests: 209 passed, 0 skipped, 0 failed (155 → 209, +54 this session).

## Open questions for Claude
1. Should the next session go straight to Task 6's five-run stage, or spend
   one session hardening energy-budget persistence across process
   invocations first (see "What's broken")? My read: the budget gap is real
   but not urgent at 60 energy/session — five runs is ~100 energy against a
   300+ balance either way. Worth fixing before truly unattended (Task 10)
   operation, not necessarily before five more supervised runs.
2. `path_one`/`path_three`/`reward_two`/`reward_four` — confirm opportunistically
   as they come up in play; not worth a dedicated capture effort.
3. The unexplained `reward_one` 500s — if they recur at a meaningful rate
   across five more runs, worth a closer look (retry-storm risk, or a real
   pattern that `postWithVerifiedRetry`'s current logic doesn't fully
   protect against, e.g. if a retry lands on a DIFFERENT reward than
   intended because the offer itself changed between attempts — not observed
   yet, but not ruled out either).

## Files changed
```
 85 files changed, 26280 insertions(+), 171 deletions(-)
 (fixtures/dungeon-runs/** dominate the count — 8 new capture directories,
 the first ever from the bot's own live play rather than supervised human
 sessions)

 Key non-fixture files:
 scripts/liveRun.ts                  | 639 (new)
 src/api/schemas.ts                  | 136 ++
 src/orchestrator/guards.ts          | 132 (new)
 src/api/client.ts                   |  85 ++
 src/orchestrator/config.ts          |  75 (new)
 tests/liveRun.test.ts               | 485 (new)
 tests/api/client.test.ts            | 137 ++
 tests/guards.test.ts                | 102 (new)
 tests/orchestrator/config.test.ts   |  72 (new)
 scripts/fieldFrequency.ts           |  83 (new)
 src/sim/enemies.ts                  |  42 +-
 src/sim/boons.ts                    |  18 +

 full stat: `git diff 44a43ce..04dddad --stat`
```
