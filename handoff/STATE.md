# STATE — session 09 — 2026-08-15 — commit 447f700

## Status
Task 6 "Live dungeon, supervised": **GATE PASS on its numeric terms — five
completed runs, zero clean-model failures — but two of the five runs' path
there involved real guard trips that had to be fixed, not just logged.**
Next per TASKS.md: Task 7 (fishing HAR, still blocked on the user's capture)
or Task 10/11 (orchestrator persistence, tuning) — but see "Open questions"
below, since this session also broke an assumption behind Task 5's gate.
Overall: five live runs completed (rooms reached 3/4/2/2/3, all deaths), two
real bugs found and fixed via regression tests (not workarounds), and the
biggest capture-driven finding of the project so far — `deepestScorableRoom`
moved from 1 (pinned since Task 4.5, session 05) to **4**, the corpus's
entire known depth, because the bot's own live play captured pickup pairs
for two new clean boon types.

## What works
- Everything from session 08 (client, guards skeleton, `liveRun.ts`'s
  staged CLI, combat model) — unchanged, still solid.
- **Reward/tier picks now address by IDENTITY, not array position.**
  `postWithVerifiedRetry` re-derives the intended option from freshly-fetched
  state on every attempt (including the first), halting via `GuardTrip`
  rather than ever picking whatever now sits at a stale index. Verified this
  session it was never actually needed (no offer changed mid-retry in 17
  observed 500s), but the safety net is real and unit-tested.
- **Guard budget now persists across process invocations.**
  `src/orchestrator/guardPersistence.ts` writes `data/guard-budget.json`
  keyed by UTC date; `GuardState` takes an optional seed. Caught its own bug
  immediately (a test was writing to the REAL file — fixed via injectable
  `guardStatePath`) and then, once genuinely enforcing, immediately exposed
  a second real bug (below).
- **`assertCanStartRun` no longer blocks resuming an active run.** It used
  to run unconditionally at the top of `runOnce`, before the check for an
  existing run — invisible through session 08 (state never persisted), real
  the moment persistence started working: it stranded a live run at room 2,
  HP 2/32. Fixed and regression-tested (both directions: resuming is never
  blocked, a genuinely NEW start still is).
- **`pickLowestTier()` replaces the strict Safe-only rule as the live
  loop's default.** `enemyPathOptions[]` is confirmed NOT to always include
  a Safe (tier 0) option (recurred 3× this session) — user-confirmed
  expected game behavior, not a bug. The generalized rule (lowest tier
  actually offered, Safe or not) keeps the original zero-tradeoff reasoning
  (identical loot table across whatever's offered) intact. `pickSafeTier`
  kept for a stricter caller.
- **Two new boon types modelled from live pickup pairs**: `UpgradeScissor`,
  `UpgradeRock` — a new `moveDelta` `BoonEffect` kind
  (`atk += val1; def += val2`), `contaminates: []`. The bot's own loot
  ranking picked both; neither was a supervised capture.
- Scissor gear change (+4 ATK/+4 DEF) verified live and reflected in
  `PLAYER` (offline sim baseline) — the LIVE loop needed no code change,
  since it already reads `currentATK`/`currentDEF` off the wire every poll.
- `npx tsc --noEmit` — clean, exit 0, throughout.
- `npx vitest run` — **236 tests, 14 files, all pass** (209 → 236 this
  session).

## What's broken
- **`reward_*`/`path_*` HTTP 500s recur substantially, root cause still
  unknown.** 17 occurrences across 5 runs (9 reward, 8 path) — not the rare
  event session 08's 2 occurrences suggested. All cleanly retried via
  `postWithVerifiedRetry`, 0 split-brain applies, 0 needing the identity
  relocation to actually redirect. Handled robustly; not explained.
- **No run has cleared past room 4.** All five runs this session died
  (rooms 3, 4, 2, 2, 3) — one non-Safe-tier Dangerous fight (enemy 64 at
  HP46/ARM19, rolled stats) among the deaths. `MAX_OBSERVED_ROOM` is still 4;
  nothing has ever reached room 5.
- `path_one`/`path_three` and `reward_two`/`reward_four` still inferred by
  naming pattern only, never individually confirmed this session either.
- `use_item`/`heal_or_damage`/`flee`/`cancel_run` remain `[VERIFY]` in
  SPEC — source (Gigaverse's published agent skill) already wrong twice
  (`loot_one`, `enemy_two`), never sent live this session (correctly — no
  run needed abandoning).
- No item-metadata endpoint is confirmed. `/items/balances` returns numeric
  IDs and balances only, no names/descriptions — can't tell which held
  items are consumables from this endpoint alone. `start_run`'s
  `consumables: []` field is entirely client-controlled (we always send
  empty); nothing server-side populates it that's been observed.

## Corrections to SPEC.md
- §2: `enemy_one/two/three` corrected to `path_two` CONFIRMED (already
  known from session 08, but SPEC's own action-list section hadn't been
  updated to say so — now fixed).
- §2: `use_item`/`heal_or_damage`/`flee`/`cancel_run` explicitly marked
  `[VERIFY]` with the compromised-source rationale.
- §3e: `enemyPathOptions[]` is NOT guaranteed to include a Safe (tier 0)
  option — new finding this session, generalizes the tier-choice rule.
- §3e: `rewardPathOptions[]` entries can carry `tier`/`tierName` fields
  when the preceding enemy-tier pick was non-Safe (new fields, one sample).
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren=NOT FOUND**.
- Move charges: unchanged, PRESENT.

## Dead ends
- None new this session — no hypothesis was tried and refuted from scratch.
  (The no-Safe-tier and Wall-1 findings were surprises, not failed guesses.)

## Metrics
- Live: **5 completed runs** this session (Task 6 five-run stage), rooms
  reached 3/4/2/2/3, all deaths, no full clear. 78 energy spent (session
  budget raised 60/3 → 120/5 in `config/bot.json` to match the session-09
  brief's stated 120-energy figure, which the config had never been updated
  to reflect).
- Model validation: **0 clean-model failures** across all 214 exchanges now
  in the corpus (up from 117 at session start), including this session's
  first-ever live Dangerous-tier battle and every death.
- Sim: `deepestScorableRoom` **1 → 4** (`MAX_OBSERVED_ROOM`, the corpus's
  entire known depth) in the same 1000-run batch (`battleCoverage.scored`
  1000 → 1108). `scoredWinRate` **0% → ~0.32%** — no longer exactly 0 "by
  construction" (DECISIONS 2026-08-15's own framing), since three boon
  types are now clean (Heal, UpgradeRock, UpgradeScissor) and a run
  threading clean picks while also winning every battle can now clear all
  the way through, rarely.
- Tests: 236 passed, 0 skipped, 0 failed (209 → 236, +27 this session).

## Open questions for Claude
1. **Task 5's strategy gate and Task 11's rooms-cleared gate were both
   explicitly deferred pending `deepestScorableRoom` climbing past 1.** It
   just did, to 4. Worth deciding whether either should be revisited now,
   or whether the corpus is still too thin (only 3 clean room-1 offers
   sampled) to trust a re-run yet.
2. **The 17 `reward_*`/`path_*` 500s per 5 runs is a real rate, not noise.**
   Worth a closer look at whether there's a pattern (timing, specific
   action families, server load) now that there's enough volume to look
   for one — or whether `postWithVerifiedRetry`'s current handling is
   simply the right permanent answer and this is just accepted server
   flakiness.
3. **No-Safe-tier offers recurred 3/9 times this session (~33%).** Worth
   tracking whether that rate holds or whether it correlates with anything
   (room number, prior picks) as more data comes in — not urgent, since
   `pickLowestTier()` already handles it correctly either way.
4. Item metadata (names/descriptions) has no confirmed endpoint. If
   consumables (mentioned in the session-09 brief's addendum as the
   possible "biggest lever" on deaths) matter for a future task, that
   endpoint needs discovering first — `/items/balances` alone isn't enough.

## Files changed
```
19 non-fixture files changed, 950 insertions(+), 123 deletions(-)
(239 fixture files also added — 4 new capture directories from this
 session's five live runs)

Key non-fixture files:
scripts/liveRun.ts                          | 206 +++++++++++++++++++++++-----
src/sim/boons.ts                            | 132 +++++++++++++++++-
tests/liveRun.test.ts                       | 170 +++++++++++++++++++++--
tests/dungeonSim.test.ts                    |  91 ++++++++----
src/orchestrator/guardPersistence.ts        |  72 ++++++++++ (new)
tests/orchestrator/guardPersistence.test.ts |  66 +++++++++ (new)
src/strategy/enemyTier.ts                   |  58 ++++++--
SPEC.md                                     |  61 ++++++--
src/sim/enemies.ts                          |  17 ++-
tests/boons.test.ts                         |  38 +++--
config/bot.json                             |   6 +-

full stat: `git diff 8df2736~1..447f700 --stat`
```
