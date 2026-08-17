# STATE — session 23 — 2026-08-17 — commit dbeb609

## Status
No numbered `TASKS.md` gate targeted this session. It started as a
brief-directed session (spend 9 non-juiced runs, then 3 user-started juiced
Tier-3 runs) and became an incident-response session after a real live bug
surfaced: `liveRun.ts` silently resumed a pre-existing active dungeon run it
had not started, playing it to a room-2 death under the wrong (`--potions=0`)
policy. The user caught this from the real numbers not matching, not from
anything CC self-reported.
Next per `TASKS.md`: Task 14 (new, added this session) — bot-initiated juiced
`start_run` + per-mode potion equip — is scoped and **BLOCKED** on a live
DevTools capture of the real juiced `start_run` request body; nothing else is
unblocked. Task 10's 8-hour orchestrator run stays deferred (user directive,
wait for a day with real headroom on both budgets).
Overall: the account's real dungeon-run budget for today is fully spent
(12/12, server-confirmed) with zero juiced runs completed — the planned
juiced batch did not happen this session. In exchange, a real safety gap that
was actively costing the user resources (potions, entry materials, run
slots) is now closed in code, and the "juice/juiced" terminology confusion
that caused it is fully resolved and documented.

## What works
- **`ResumeConfirmationRequired` gate, `scripts/liveRun.ts`** — refuses to
  resume any dungeon run the current invocation didn't itself start, unless
  `--resume-existing` is passed; throws before any POST. Verified by 4 new
  unit tests (mocked fetch). **NOT live-verified against a real stray run**
  — the account's real run budget was already maxed by the time the fix
  landed, so it has never actually fired against live server state yet.
  Watch for this the next time a session opens with a run already active.
- **`findRealRunsToday()` / real-day-counter cross-check** — pulls
  `GET /game/dungeon/today`'s `dayProgressEntities` (new schema field) and
  prints it beside the local guard count on every real invocation. Live-
  verified twice this session: caught the real drift (local 8 vs. real 11),
  and correctly read 11 → 12 after the session's last live run.
- **`AddMaxHealth` boon, first-ever pickup pair** — `src/sim/boons.ts`,
  `kind: "maxHealth"`. Verified against `run-2026-08-17-17-03-45`
  state-196→197: `selectedVal1` 8 → hpMax 42→50, hp 15→23 (both +8). Genuine
  mechanical difference from `AddMaxArmor` (current HP moves WITH the
  ceiling here; armor does not for `AddMaxArmor`).
- **`PLAYER` baseline re-derived from the newest capture** — real gear
  re-spec this session: hpMax 38→42, rock (Sword) 20/4→16/0 (gear boost
  removed), scissor (Spell) 12/8→18/13 (new gear boost gained). Verified by
  `tests/enemies.test.ts` passing against `newestOpening()`.
- **13 new `OBSERVED_OFFERS` entries** re-derived programmatically from the
  corpus (not hand-transcribed) — `tests/boons.test.ts`'s exact-match test
  passes.

## What's broken
- Nothing left broken in the codebase — all 375 tests pass, `tsc --noEmit`
  clean. The `ResumeConfirmationRequired` gate's real-world behavior is
  UNVERIFIED (see above), which is a gap in confidence, not a known bug.
- **Local `data/guard-budget.json` is stale** (9/12 runs, 177/240 energy)
  against the real 12/12 — this is now visibly flagged by the new drift
  check on the next invocation, but nothing reconciles the file itself. It
  self-corrects tomorrow via the date key; not fixed today.

## Corrections to SPEC.md
- **`juicedMultiplier: 1` does NOT represent the real reward multiplier** —
  user live-confirmed a Juiced Forbidden Woods run pays a real 3x per room
  (room 1's 5 Dendren Root → 15 juiced). Whatever that field means, it isn't
  this. Fixed in SPEC.md.
- **New terminology section, user-clarified**: "juice"/"juiced" are THREE
  unrelated concepts — `isPlayerJuiced` (account-level purchased buff: more
  energy, more ROM output, 4x Hard Cores across dungeons AND fishing), "Juice"
  as an item name (Big Heal Juice etc., ordinary potions), and a "Juiced"
  Forbidden Woods run MODE (60 energy, requires clearing only 1 room's worth
  of fights, pays 3x every room). This ambiguity is the direct root cause of
  this session's incident.
- **New fact**: a Juiced run consumes **3 of the 12 daily run-count units**,
  not 1 — confirmed against the real `dayProgressEntities` counter moving
  3→6 after the user started one.
- **New fact, user directive**: the "dungeon sack" (persists potions across
  entries, commits them at `start_run` regardless of that request's own
  `consumables` field) will be left EMPTY going forward. Potion loading is
  entirely the bot's job via `consumables` on a genuinely new `start_run`.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- **Diagnosing a resumed run's juiced/potion status from `GET
  /game/dungeon/state` reads alone (loot amounts, tier labels)** — concluded
  "not juiced" this way early in the session and had to retract it after the
  user's direct correction. `isJuiced`/`consumables` are NEVER exposed on any
  state read, only possibly on the original `start_run` request/response —
  and this session never captured that request for the run in question. Any
  future diagnostic on a resumed run's loadout needs either a direct user
  answer or a captured `start_run`, not inference from state reads.

## Metrics
- Tests: 356/356 at session start → **375/375** at end (+19: 6 new in
  `tests/liveRun.test.ts` for the resume gate + `findRealRunsToday`, 13 from
  corpus-table growth in `tests/boons.test.ts`/`tests/enemies.test.ts`).
  `npx tsc --noEmit` clean throughout, re-checked against the final commit.
- Dungeon: real server day-counter (Dungeon#5) went **3/12 → 12/12** today:
  3 (carried in from session 22) + 3 (the user's 1 manually-started juiced
  run, never visible to local tracking) + 6 (the bot's own new `start_run`
  calls this session — 5 in the initial batch, 1 final plain run) = 12.
  Local guard (bot-only view) ends at 9/12, 177/240 energy — undercounts by
  exactly the user's 3-run juiced entry, as expected now that the cause is
  understood.
- Zero juiced runs completed this session (planned 3, actual 0) — the day's
  real run budget was exhausted resolving the incident and finishing the
  originally-planned non-juiced batch before any juiced attempt could
  proceed cleanly.
- Fishing: untouched this session, still 20/20 casts / 240/240 energy from
  session 22 (same calendar day).
- ROMs: untouched this session.

## Open questions for Claude
1. **Task 14 needs a live DevTools capture of a real juiced `start_run`
   request body** (Network tab, redact the JWT) before any code can be
   written for it — CLAUDE.md §2 forbids guessing at the request shape, and
   guessing here specifically is the root cause pattern behind this
   session's incident. Ask the user for this capture the next time they
   start a juiced run manually, before scoping any implementation work.
2. **The `ResumeConfirmationRequired` gate has never fired against real
   server state.** It's unit-tested but the account's real run budget was
   maxed before any live invocation could hit an actual pre-existing active
   run under the new code path. Worth explicitly watching/confirming next
   session if the opportunity arises (e.g., a run left active across a
   session boundary).
3. Local `data/guard-budget.json` will read 9/12 today; the real number is
   12/12. This resolves automatically at the next UTC date rollover — not a
   bug to fix, just don't trust the local file over the live status check's
   own real-count line if both are printed.

## Files changed
```
$ git show dbeb609 --stat (non-fixture files)
SPEC.md                  | 50 ++
TASKS.md                 | 56 ++
config/bot.json          |  4 +-
handoff/DECISIONS.md     |  4 +
handoff/next.md          | 198 +++---
scripts/liveRun.ts       | 81 ++-
src/api/schemas.ts       | 18 +
src/sim/boons.ts         | 94 +++
src/sim/enemies.ts       | 20 +-
tests/boons.test.ts      | 16 +-
tests/combat.test.ts     |  9 +-
tests/dungeonSim.test.ts |  7 +-
tests/enemies.test.ts    |  6 +-
tests/liveRun.test.ts    | 73 ++

+ fixtures/dungeon-runs/run-2026-08-17-17-03-45/ (217 states, new)
+ fixtures/dungeon-runs/run-2026-08-17-17-12-13/ (1 state, new)
+ fixtures/dungeon-runs/run-2026-08-17-17-30-00/ (14 states, new)
+ fixtures/dungeon-runs/run-2026-08-17-17-44-38/ (25 states, new)
271 files changed, 136146 insertions(+), 125 deletions(-)
```
