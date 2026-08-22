# STATE — session 07 — 2026-08-17 — commit a0a31d6

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
  `address 0xUSER...`, `/game/account -> username "<USER>" noobId <NOOB_TOKEN>`;
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
 25 files changed, 1310 insertions(+), 82 deletions(-) — full stat: `git diff 98757dd..a0a31d6 --stat`
```

---

## Appendix — verbose material not in STATE.md

### A1. Task 2 gate, full live output

```
$ npm run check-auth
▸ real JWT
  jwt eyJhbGci...(1728 chars)
  /user/me -> address 0xUSER  canEnterGame true
  /game/account -> username "<USER>"  noobId <NOOB_TOKEN>

▸ corrupted JWT — expecting a clean halt, not a crash loop
  ✓ halted cleanly: Auth rejected (HTTP 401). The JWT is expired or invalid — refresh it. (status 401)

✓ Task 2 gate passed.
```

401 was not assumed going in — the client treats both 401 and 403 as
`TokenExpiredError` since which one the server actually returns for a bad
token was unconfirmed before this run.

### A2. How the tier mislabelling was found

Session 06's `enemies.ts` comments asserted rooms 3 and 4 were "Dangerous-tier
instances" on the theory that the user was picking high tiers. This was never
verified against the corpus directly — it was an inference from the *shape* of
the rolled stats (non-zero) plus a session-05 assumption that non-zero rolled
stats meant Dangerous tier specifically. That assumption is wrong: any
non-Safe tier can carry non-zero rolls, and one specific room-2 sighting shows
a *Risky* pick with zero rolled stats but a live buff (`bloodthirsty`).

The correct method, used this session: for every room transition in the
corpus, take the `enemyPathOptions[]` recorded on the state immediately
*before* the pick, and match each option's `rolledEnemyStats` against the
`rolledEnemyStats` actually observed on the enemy in the state immediately
*after*. The matching option's `tier` is the ground truth.

```python
# enemy 65 (room 3), run-2026-08-14-01-00-08, state-028 -> state-029
options offered (state-028.enemyPathOptions):
  index 0  tier 1 Risky  rolled {evasion:2, block:2, lck:1, tenacity:0}  buff shatterblade
  index 1  tier 1 Risky  rolled {evasion:2, block:1, lck:2, tenacity:2}  buff bloodthirsty
  index 2  tier 1 Risky  rolled {evasion:0, block:0, lck:1, tenacity:0}  buff Cursing
observed after pick (state-029, players[1]):
  rolled {evasion:2, block:2, lck:1, tenacity:0}   <- matches index 0
  => tier 1 "Risky", buff shatterblade
```

```python
# enemy 66 (room 4), run-2026-08-14-01-00-08, state-039 -> state-040
options offered (state-039.enemyPathOptions):
  index 0  tier 0 Safe        rolled {0,0,0,0}                          buff null
  index 1  tier 2 Dangerous   rolled {evasion:1, block:1, lck:3, tenacity:2}  buff searing
  index 2  tier 2 Dangerous   rolled {evasion:2, block:4, lck:4, tenacity:4}  buff perpetual_regenerating
observed after pick (state-040, players[1]):
  rolled {0,0,0,0}   <- matches index 0
  activeEnemyBuff: null (state-040 through state-048, the whole battle)
  => tier 0 "Safe", buff null
```

Room 4's recorded battle later shows `statusEffects: [{type: "Burn", amount:
3}]` on the enemy (state-046 onward) despite `activeEnemyBuff` staying `null`
throughout. Checked the player's `pickedBoons` on that same run (state-039):

```
{'BoonType': 'AddEvasion', 'selectedVal1': 1, ...}
{'BoonType': 'Heal', 'selectedVal1': 16, ...}
{'BoonType': 'AddBurnSword', 'selectedVal1': 3, ...}
```

`AddBurnSword` was picked at the room-3→4 reward phase, immediately before
this battle. The Burn on the enemy is that boon landing on a Sword win — a
player-side mechanic riding along on this instance, not a property of tier 0
or of enemy 66. `src/sim/boons.ts` already models `AddBurnSword` as a
verified-zero-delta pickup (DECISIONS 2026-08-15); the in-combat Burn damage
mechanic is `BURN_PER_EXCHANGE`, default off (SPEC §4f). Neither of those is
the enemy profile's concern, so the room-4 Safe-tier profile in `enemies.ts`
is tagged clean (`unmodelled: []`).

Also checked room 2 (enemy 64), which turned out to have all three tiers
captured across the corpus — the only enemy with that property:

```
run-2026-08-13-23-29-39  state-010  tier 0 Safe        rolled {0,0,0,0}   buff null
run-2026-08-14-01-00-08  state-023  tier 0 Safe        rolled {0,0,0,0}   buff null
run-2026-08-14-03-26-57  state-018  tier 1 Risky        rolled {0,0,0,0}   buff bloodthirsty
run-2026-08-14-03-26-57  state-007  tier 2 Dangerous    rolled {1,2,1,1}   buff corrosiveShield
run-2026-08-14-03-26-57  state-030  tier 0 Safe        rolled {0,0,0,0}   buff null
```

Base combat stats (hp 35/35, armor 14/14, move ATK/DEF/charges) are identical
across every one of these — confirms SPEC §3e's claim that tier only varies
`rolledEnemyStats`/`enemyBuff`, never the underlying combatant.

### A3. HP-persistence corpus check, full boundary list

All 7 room-transition boundaries the corpus contains (pairs where
`players[1].id` changes under one `DUNGEON_ID_CID`):

```
run-23-29-39  009->010  63->64  HP  2/32 ->  2/32   ARM  4/15 ->  4/15
run-01-00-08  022->023  63->64  HP 15/32 -> 15/32   ARM 15/15 -> 15/15
run-01-00-08  028->029  64->65  HP 31/32 -> 31/32   ARM 15/15 -> 15/15
run-01-00-08  039->040  65->66  HP 22/32 -> 22/32   ARM 15/15 -> 15/15
run-03-26-57  006->007  63->64  HP 12/32 -> 12/32   ARM  0/16 ->  0/16
run-03-26-57  017->018  63->64  HP  4/32 ->  4/32   ARM 16/16 -> 16/16
run-03-26-57  029->030  63->64  HP 28/32 -> 28/32   ARM  8/16 ->  8/16
```

Six of seven cross with HP below the 32 cap, all unchanged. This is a much
stronger sample than the single informative armor crossing (4/15) the
2026-08-15 reversal rested on for HP specifically.

### A4. Depth ablation, full output (N=20000)

```
$ npx tsx scripts/depthAblation.ts 20000

20000 runs per depth, room-1 battle win rate on the scored subset, seed 1

depth 1  77.14% ± 0.58  [76.56, 77.72]  (15428/20000 scored)  528ms
depth 2  79.96% ± 0.55  [79.41, 80.51]  (15992/20000 scored)  3061ms
depth 3  81.64% ± 0.54  [81.10, 82.18]  (16328/20000 scored)  20817ms
depth 4  82.62% ± 0.53  [82.09, 83.14]  (16523/20000 scored)  135843ms

Pairwise separation (non-overlapping 95% CI):
  depth 1 vs depth 2: SEPARATED  (gap 2.82pp)
  depth 2 vs depth 3: SEPARATED  (gap 1.68pp)
  depth 3 vs depth 4: overlap — not established  (gap 0.98pp)

Time per decision scales with depth as expected (9^depth leaves):
  depth 1: 528ms total for 20000 runs
  depth 2: 3061ms total for 20000 runs
  depth 3: 20817ms total for 20000 runs
  depth 4: 135843ms total for 20000 runs
```

Wall time: 2m40s total for all four depths at N=20000 (mostly depth 4, which
is not adopted). Depth 3's 20.8s for 20000 SIM runs (each several decisions)
is a small fraction of a millisecond per decision — irrelevant against the
1200ms live rate-limit floor.

### A5. `npm run sim` — post-restructure spot check (N=1000)

Confirms the enemies.ts restructure didn't change room-1 mechanics (Task 5
gate numbers are bit-for-bit identical to session 06's), and the threshold
check now correctly exercises all 4 enemies (previously room 3 would have
been silently skipped under the new Safe-tier default without the
`enemyTier` diagnostic override added this session):

```
THRESHOLD CHECK — Shield mirrors against every observed enemy (brief §1, corrected)

  enemy 63  Shield DEF 2  net-on-tie 4  → predicted clears, actual {"cleared":100,"died":0,"stalled":0,"halted":0}  ✓
  enemy 64  Shield DEF 4  net-on-tie 2  → predicted clears, actual {"cleared":100,"died":0,"stalled":0,"halted":0}  ✓
  enemy 65  Shield DEF 6  net-on-tie 0  → predicted NEVER clears, actual {"cleared":0,"died":100,"stalled":0,"halted":0}  ✓
  enemy 66  Shield DEF 8  net-on-tie 0  → predicted NEVER clears, actual {"cleared":0,"died":0,"stalled":100,"halted":0}  ✓

✓ the threshold is exact.
```

RUN COVERAGE now includes a new reason, `NO_TIER_CAPTURE`, for runs that
reach room 3 under the default Safe tier and find no captured profile —
distinct from `DEPTH_BEYOND_CORPUS` (past all corpus knowledge at any tier).
Sample from the random-vs-random baseline (N=200): 48 of 200 runs hit
`NO_TIER_CAPTURE` (room 3, Safe tier absent).

### A6. Surprises log (kept during the session, not re-derived after)

- Session 06's tier attribution turned out backwards in an interesting way:
  room 3 (which session 06 thought was worse — "Dangerous") was actually the
  *milder* tier (Risky), and room 4 (also called "Dangerous") was actually
  the *mildest* (Safe) and clean. Neither error was random — both came from
  trusting the shape of the data (non-zero rolled stats / a status effect
  present) rather than tracing it back to the specific `enemyPathOptions[]`
  offer that produced it.
- `data.entity.ROOM_NUM_CID` is a real, direct room-number field in
  `/game/dungeon/state` responses. `src/sim/corpus.ts` does not use it —
  room number is inferred from a caller-supplied `enemyId -> room` mapping
  instead (ultimately `enemies.ts`'s own `room` field, circularly). This
  works today because every room number has had exactly one distinct enemy
  id so far, but it's worth flagging: if a future capture ever shows a room
  offering more than one possible `enemyId` at the SAME room depth, the
  current room-inference method breaks silently where `ROOM_NUM_CID` would
  not. Not fixed this session — out of scope, flagging for whoever touches
  `corpus.ts`'s room derivation next.
- The room-4 Burn-from-player-boon finding was not something I went looking
  for — it fell out of double-checking why `activeEnemyBuff` was `null` but
  `statusEffects` was non-empty on the same enemy. Worth remembering as a
  general pattern: a status effect on an enemy is not evidence of an enemy
  mechanic by itself; check `pickedBoons` on the player before attributing it.
