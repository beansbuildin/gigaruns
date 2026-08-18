# STATE — session 42 — 2026-08-18 — commit c25b03f

## Status
Task "Resume and complete the live juiced Tier-3 run" (session-42 brief §0):
**DONE** — the run was resumed and played to completion (death, room 7).
Task 14 "Bot-initiated juiced `start_run`, with per-mode potion equip"
(brief §1/§2): **CODE DONE, GATE NOT MET**. Both pieces (envelope builder,
`--juiced` CLI flag) are implemented and tested, but the gate specifically
asks for a **bot-initiated** juiced `start_run`, live-verified — this
session only *resumed* a run the user started manually before the session
began, and never sent a fresh juiced `start_run` itself (today's real
budget/run-slots were already spent on the resumed run; nothing in the
brief authorized a second live spend to test the new code path).
Next per TASKS.md: no numbered task is ready to start cleanly. Task 14
needs one bot-initiated juiced `start_run` attempt (real energy/run-slot
cost, needs explicit authorization) to actually close its gate. Task 13
stays capture-blocked (double-digit real card-choice observations). Task
11 stays parked.

## What works
- The resumed run (§0) played rooms 1→7 live, died at room 7 (own HP 0/43)
  — the deepest recorded death this corpus has ever captured. Full run log
  `logs/run-2026-08-18-19-50-13.jsonl`, fixtures
  `fixtures/dungeon-runs/run-2026-08-18-19-50-14/` (123 states).
- **Juiced reward multiplier CONFIRMED 3x, mechanism now known**: item 846
  ("Dendren Root") is credited via THREE duplicate `gameItemBalanceChanges`
  entries of the base amount (5,5,5 → 15 at the first kill; held at every
  subsequent kill this run), not one tripled entry. `dungeonReport.ts`'s
  existing sum-by-id extraction already handles this correctly (its report
  shows 309 Dendren Root for this run — exactly 3× the sum of base amounts).
  See SPEC.md §3f and DECISIONS.md.
- `dayProgressEntities` for Dungeon#5 read before and after this session's
  play: unchanged at 3 both times (second read's `updatedAt` predates the
  resume). Consistent with — not new proof of — session 23's "+3 at
  start_run" finding, since this invocation never sent `start_run` itself.
- `buildJuicedStartRunEnvelope(dungeonId, index, consumables)`
  (`scripts/liveRun.ts`) — pinned against the exact captured JSON
  (DECISIONS.md 2026-08-18 out-of-band). Wired into the `start_run` call
  site behind a new `deps.juicedStartRun`, only set when `--juiced` is
  passed; the ordinary `buildEnvelope` path is byte-for-byte unchanged for
  every plain start (dedicated regression test confirms this).
- `--juiced` + `--juiced-index=N` CLI flags — fail-closed like `--potions=N`
  (`--juiced` alone throws rather than defaulting index to 3). Potion
  auto-loading (config-auto-detect branch AND `startConsumables` on a new
  start) is now gated behind `--juiced`, closing the exact gap
  `config/bot.json`'s own session-24 comment named. Explicit `--potions=N`
  still works without `--juiced` — needed for, and confirmed working by,
  this session's own `--resume-existing` resume.
- **Real correctness gap found and fixed while wiring this in**:
  `GuardState.assertCanStartRun`/`recordRunStarted` hardcoded 1 run-unit
  per start; a juiced run consumes 3. Both now take an optional `runUnits`
  param (default 1, every existing call site unaffected) — without this, a
  future bot-initiated juiced start would have silently under-counted both
  the daily energy budget and the session run cap.
- `ROOM_ENEMIES` gained its first-ever room-6 (Enemy Room 68, RISKY_TIER
  only — no Safe tier was ever offered here) and room-7 (Enemy Room 69,
  clean SAFE_TIER) captures, from this run's own live play. `PLAYER`'s
  loadout updated to the newest unbooned capture (hpMax 42→43, armorMax
  16→17, scissor DEF 13→15 — a gear change, confirmed against a
  zero-`pickedBoons` state).
- Tests: **581/581 passing** (561 baseline + 20 new: 3 guard `runUnits`
  tests, 4 `parseArgs` tests, 3 `runOnce` juiced-start integration tests, 2
  `buildJuicedStartRunEnvelope` pin tests, plus 8 corpus-total assertions
  corrected across `boons.test.ts`/`enemies.test.ts`/`combat.test.ts`/
  `dungeonSim.test.ts` to match the grown corpus). `npx tsc --noEmit`
  clean, `git diff --check` clean, both at this session's final commit.

## What's broken
Nothing shipped this session broke anything — full suite green, tsc clean,
at the actual final commit. A default Safe-tier `simulateRun` walk now
halts at room 6 with `NO_TIER_CAPTURE` (not `DEPTH_BEYOND_CORPUS`) — not a
regression, a real capture gap (room 6 was never offered at Safe tier live)
that a future Safe-tier room-6 capture would close. Unchanged since session
25: scheduler can't learn energy gained outside its own tracking; a SIGINT
during an energy-regen sleep ends the whole session. Unchanged since
session 40: charge-reserve plateau (0.4/0.5/0.6 mutually indistinguishable).

## Corrections to SPEC.md
- §3f: added the juiced-run 3x-crediting mechanism (three duplicate entries
  of the base amount, not one tripled entry) — confirmed live this session,
  see the new subsection under §3f.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged).

## Dead ends
None — both planned pieces of code work (§1/§2) landed as scoped. The gate
itself was correctly NOT attempted rather than forced with an unauthorized
fresh spend — see Status above.

## Metrics
No sim runs this session. Live: 1 dungeon run (resumed, juiced Tier-3),
rooms 1-7, died room 7, 0 energy newly committed by this session's own
invocation (the run's 60 energy was already spent before this session
began — this session only played it out). 6604→12652 total Hard Core
across the corpus's 48 recorded attempts (this run alone: 6048 Hard Core,
309 Dendren Root — both auto-reported, `handoff/reports/dungeon-runs.md`).

## Open questions for Claude
1. **Task 14's actual gate still needs a bot-initiated juiced `start_run`**
   — the code is ready and tested (`--juiced --juiced-index=3
   --potions=N`), but nobody has actually run it live yet. This needs an
   explicit go-ahead for a fresh 60-energy / 3-run-unit spend, since
   today's real budget context (`GET /game/dungeon/today`) should be
   checked fresh before attempting it — the account's real daily run count
   may already be closer to the 12-run cap after this session's play.
2. **Task 14's `index == tier` question is still unconfirmed in general.**
   This session's evidence (Tier-3 pick, `index: 3`, worked) is consistent
   with but does not prove the mapping — a future juiced start at a
   DIFFERENT tier (e.g. Tier-1 or Tier-2, if those are even offered as
   juiced options) would settle it. Not attempted this session, per the
   brief's own explicit "don't guess past what's known" instruction.
3. **New capture gap, symmetric to the one session 08 closed for room 3**:
   room 6 (Enemy Room 68) has never been offered at Safe tier live — only
   `{Dangerous, Dangerous, Risky}` so far, n=1 offer. A future Safe-tier
   room-6 capture would let `deepestScorableRoom`-style sim walks reach
   room 7 cleanly instead of halting at the `NO_TIER_CAPTURE` wall.
4. **Currency crediting (item 845, Hard Core) does NOT show the same
   3x-duplicate-entry pattern item 846 does** — single entries per
   reward-pick response on the same juiced run. Not investigated this
   session (out of scope for Task 14's own gate); worth a look if a
   currency-specific multiplier question ever comes up.
5. Standing from session 40/41: scheduler energy-tracking gap,
   SIGINT-during-sleep session-ending behavior, charge-reserve plateau —
   none addressed this session, none urgent.

## Files changed
```
 SPEC.md                          |  16 +++++
 TASKS.md                         |  47 ++++++++++++++
 config/bot.json                  |   2 +-
 handoff/DECISIONS.md             |   6 ++
 handoff/reports/dungeon-runs.md  |   7 +-
 handoff/reports/fishing-casts.md |   2 +-
 scripts/liveRun.ts               | 137 ++++++++++++++++++++++++++++++++++++---
 src/orchestrator/guards.ts       |  22 +++++--
 src/sim/boons.ts                 |  40 ++++++++++++
 src/sim/enemies.ts               |  60 +++++++++++++++--
 tests/boons.test.ts              |  19 ++++--
 tests/combat.test.ts             |  12 ++--
 tests/dungeonSim.test.ts         |  20 ++++--
 tests/enemies.test.ts            |   7 +-
 tests/guards.test.ts             |  22 +++++++
 tests/liveRun.test.ts            | 130 +++++++++++++++++++++++++++++++++++++
 16 files changed, 506 insertions(+), 43 deletions(-)
 + scripts/checkDungeonToday.ts (new, read-only dayProgressEntities helper)
 + fixtures/dungeon-runs/run-2026-08-18-19-50-14/ (new, 123 states, this run)
```
