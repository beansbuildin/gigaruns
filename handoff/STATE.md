# STATE — session 07 — 2026-08-17 — commit ff36aa1

## Status
Task 2 "Auth + API client": **GATE PASS**, read-only, live-verified.
Next per TASKS.md: Task 3 (`scripts/probe.ts` — already built and previously
run) is done; the next UNBUILT task is **Task 6, Live dungeon (supervised)**,
now that Task 2's client exists. Consider one capture run first — see Open
Questions.
Overall: the client works against the real API (real username/noob ID
printed, corrupted-JWT halt confirmed live), and a corpus re-audit found the
enemies.ts tier labels from sessions 05/06 were wrong on the specifics —
room 4 is actually clean at Safe tier; only room 3 has zero Safe captures.

## What works
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **155 tests, 10 files, all pass** (127 → 155).
- `npm run check-auth` — **live gate, run against the real account**: prints
  `address 0x4F03...`, `/game/account -> username "<PLAYER>" noobId 72946`;
  corrupted JWT halts cleanly with `TokenExpiredError` (HTTP 401, confirmed
  live — not assumed) rather than crashing or retrying.
- `src/api/` — `GigaverseClient`: 1200ms+jitter rate limiter, single-flight
  mutex (serializes every request, not just dungeon actions), 429 backoff
  from 5s (5 retries then `RateLimitedError`), zod-validated responses with
  `.passthrough()` so spec drift stays visible instead of silently stripped.
  `getDungeonState()` returns `null` on a 5xx (SPEC: "no active run") but
  throws `UnexpectedResponseError` on a 5xx anywhere else. Covers
  `/user/me`, `/game/account`, `/offchain/player/energy`,
  `/game/dungeon/today`, `/game/dungeon/state`, `/items/balances`,
  `/gigajuice/player`. **Nothing POSTs.** `DungeonActionResponseSchema`
  exists but is `[VERIFY]` — never validated against a live response.
- `src/sim/enemies.ts` — restructured to `EnemyProfile[]` keyed by
  `(room, tier)`. `lookupEnemy(room, tier)` fails closed (no fallback).
  `bestKnownProfile(room)` for tests/scenarios that want real numbers
  regardless of tier. `MAX_SAFE_ROOM` = 2 (computed, not asserted).
- `src/strategy/enemyTier.ts` — `pickSafeTier()` picks the lowest tier in an
  offer and throws `UnsafeTierError` if it isn't `SAFE_TIER`. CLAUDE.md §8
  makes this a hard rule, not a scored preference.
- `src/strategy/config.ts` — `LIVE_CONFIG` (depth 3) alongside `DEFAULT_CONFIG`
  (depth 2, unchanged, for sim throughput). `scripts/depthAblation.ts` at
  N=20000 separates depth 1/2/3 cleanly; Task 6 should use `LIVE_CONFIG`.
- Task 5 gate re-verified unaffected by the enemies.ts restructure (room 1
  mechanics didn't change): always-Sword 67.9% vs ev-engine 81.8%, still PASS.

## What's broken
- **`deepestScorableRoom` is still 1** in the reported sim numbers — unchanged
  this session, because nothing here modelled a new boon or mechanic. But the
  CEILING under the Safe-tier hard rule is now much better understood: rooms
  1, 2 and 4 already have clean Safe-tier captures. **The only remaining gap
  is room 3** — no Safe-tier capture of enemy 65 exists anywhere in the
  corpus. This is a capture gap, not an unscorable enemy.
- `src/api/schemas.ts`'s `DungeonActionResponseSchema` is unverified — no POST
  has ever been sent. Task 6 must re-derive it from a live response before
  trusting it.
- `src/orchestrator/` is still empty. No budget/energy enforcement exists yet.
- `037→038` anomaly (session 06) remains genuinely unexplained. Not touched
  this session, per session-06 brief §2's instruction not to propose a third
  hypothesis.

## Corrections to SPEC.md
- **§3e — room 3 and room 4's `enemies.ts` profiles were mislabelled
  "Dangerous-tier instances".** Re-matched each captured enemy state against
  the `enemyPathOptions[]` that preceded it (comparing `rolledEnemyStats` of
  the picked option to the resulting state):
  - Room 3 (enemy 65)'s capture is **tier 1 "Risky"**, not tier 2. Buff is
    `shatterblade` ("Applies 1 Vulnerable on Sword wins").
  - Room 4 (enemy 66)'s capture is **tier 0 "Safe"**, not Dangerous.
    `activeEnemyBuff` is `null` for the whole battle. The Burn status seen on
    that enemy is the **player's own `AddBurnSword` boon** (in that run's
    `pickedBoons`) landing on a Sword win — not an enemy or tier mechanic.
    Room 4's Safe-tier profile is CLEAN.
- **§4b (armor/HP room-transition section) — HP persistence strengthened.**
  All 7 corpus room boundaries (up from 4) confirm HP unchanged across the
  transition, 6 of them below the HP cap (was 1 informative point, now 6).
  HP persists; it does not reset. `Regen`'s cross-room value is therefore
  potentially large if it fires every room — reported, not modelled (no
  pickup pair exists for `Regen`).
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren=NOT FOUND**.
- Move charges: unchanged, PRESENT.

## Dead ends
- **Trusting the brief's instruction to "label existing rows as tier 2."**
  The brief's premise was wrong — re-deriving tier from the corpus (not from
  the existing code comments) found room 3 was tier 1 and room 4 was tier 0.
  Always adjudicate from the corpus before implementing a brief's specific
  claim about it, same lesson as session 06 brief §1.
- **Assuming `firstDirtyRoom`/"wall 2" scoped to whole rooms.** Tier is a
  property of the *encounter* (room + tier), not the room or the enemy —
  `src/sim/enemies.ts` and `scripts/sim.ts`'s narrative text both had to be
  restructured around `(room, tier)`, not `room` alone.
- Did not model `Regen` or `intuition` this session, per session-06 brief
  §4/§5 — both stay open questions.

## Metrics
- Task 2 gate: live, 1 real account check + 1 corrupted-JWT halt, both PASS.
- Task 5 gate (re-verified, unaffected by this session's changes), 1000 runs
  each vs random, room-1 battle win rate, scored subset:
  `always-Sword 67.9% ± 2.9 [65.0, 70.8]` vs `ev-engine 81.8% ± 2.4 [79.4, 84.2]`.
  Non-overlapping. **PASS.**
- Depth ablation (`scripts/depthAblation.ts`, N=20000, seed 1, room-1 battle
  win rate): depth1 77.14% ± 0.58, depth2 79.96% ± 0.55, depth3 81.64% ± 0.54,
  depth4 82.62% ± 0.53. 1v2 SEPARATED, 2v3 SEPARATED (settles what N=1000
  couldn't), 3v4 NOT separated (0.98pp gap overlaps). Depth 3 adopted for live
  (`LIVE_CONFIG`); depth 4 is not.
- Tests: 155 passed, 0 skipped, 0 failed (127 → 155).
- Live: 0 dungeon/fishing actions POSTed. 2 read-only live GET checks this
  session (`/user/me`, `/game/account`), both via `npm run check-auth`.

## Open questions for Claude
1. **Task 6 next, or one more capture first?** The client (Task 2) and the
   Safe-tier hard rule (with its guard) are both built and tested. The
   remaining `deepestScorableRoom` blocker is narrow and specific: **one
   Safe-tier capture of room 3 (enemy 65)** — pick Safe at every enemy-path
   screen, all the way to room 3, in one supervised run. `QUESTIONS.md` §5b
   is updated with this. My read: worth ~20 energy before Task 6, since it
   might let the very first live run score deeper than room 2 immediately —
   but session-06 brief §6 pushed back hard on spending human clicks on
   coverage Task 6 will produce for free, and that argument still applies.
   Your call.
2. **`DungeonActionResponseSchema` is unverified.** No POST has ever been
   sent to `/game/dungeon/action`. Task 6's `--dry-run` should log what a
   real response looks like the moment one arrives, and the schema should be
   corrected from it immediately — same discipline as everything else in
   `src/api/schemas.ts`.
3. **`intuition`** — still pending an answer from the user (session-06 brief
   §5). Not asked again this session.
4. **Room-2's now-captured Risky/Dangerous tiers** (`bloodthirsty` +4 ATK all
   moves, `corrosiveShield`) are stored in `ROOM_ENEMIES` as diagnostic-only
   entries, never fought by default. No action needed — just flagging that
   `enemies.ts` now carries data it doesn't use by default, in case that
   looks like dead code to a future session. It isn't; it's corpus fidelity.

## Files changed
```
 New: src/api/{client,auth,errors,schemas}.ts, tests/api/client.test.ts,
      scripts/checkAuth.ts, scripts/depthAblation.ts,
      src/strategy/enemyTier.ts, tests/enemyTier.test.ts
 Restructured: src/sim/enemies.ts (+172/-), src/sim/dungeonSim.ts,
      src/sim/scenarios.ts, src/sim/coverage.ts, scripts/sim.ts,
      tests/{combat,dungeonSim,enemies,strategy}.test.ts
 Docs: CLAUDE.md (§8), SPEC.md (§3e, HP persistence), TASKS.md,
      QUESTIONS.md, handoff/DECISIONS.md
 25 files changed, 1310 insertions(+), 82 deletions(-) — full stat: `git diff 2f78c74..ff36aa1 --stat`
```
