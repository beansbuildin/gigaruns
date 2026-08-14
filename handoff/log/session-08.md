# STATE — session 08 — 2026-08-14 — commit 7ab83f1

## Status
Task 6 "Live dungeon, supervised": **BLOCKED — 0/4 stages run.**
Next per TASKS.md: still Task 6, unstarted, the moment the JWT is refreshed.
Overall: everything Task 6 needs is built and unit-tested (POST client,
guards, config, a full 4-stage live-run script) but none of it has touched the
live API — `~/.secrets/gigaverse-jwt.txt` is rejected (HTTP 401). Refresh it
and stage 1 (`npm run live -- --dry-run`) should run immediately.

## What works
- Privacy fix: `STATE.md`/`next.md` no longer carry a real address/username/
  noobId; `.claude/commands/gigarecap.md`'s secret scan widened to
  `0x[a-fA-F0-9]{4,}` + `noobId\s*\d+` — verified by re-grepping the working
  tree, zero hits outside already-committed historical logs (sessions 01-03,
  07, not rewritten — no history rewrite, per session-04 precedent).
- `CLAUDE.md` §9 added: a brief's claims about the corpus are hypotheses to
  verify, not facts to implement (this is the second time a brief's specific
  claim was wrong and only caught by re-deriving from fixtures).
- `config/bot.json` (committed) + `config/discovered.json` (generated) merged
  by `src/orchestrator/config.ts`, fails closed if either is missing —
  verified by `tests/orchestrator/config.test.ts` against temp fixtures, NOT
  the real gitignored `discovered.json` (so the test suite still passes on a
  fresh clone with no local probe output).
- `src/orchestrator/guards.ts` — energy budget (pre- and post-spend), session
  run cap, 3-consecutive-failure halt, same-state-twice stall detection,
  `assertKnownEnum` — verified by `tests/guards.test.ts`.
- `GigaverseClient.postDungeonAction()` — the client's first POST path, same
  mutex/rate-limit/fail-closed discipline as every GET — verified against a
  mocked `fetch`, never the real network (`tests/api/client.test.ts`).
- `scripts/liveRun.ts` — all 4 of session-08 brief §5's stages
  (`--dry-run`/`--stage2`/`--runs=N`) implemented: builds `BattleState` via
  `src/sim/corpus.ts`'s `toCombatant()` (not a re-derived mapping), runs
  `decide()` at `LIVE_CONFIG` (depth 3), enforces the Safe-tier hard rule via
  `pickSafeTier()`, writes fixtures in `scripts/watch.ts`'s exact shape.
  Verified ONLY against a mocked client (`tests/liveRun.test.ts`) — zero live
  execution this session.
- `scripts/fieldFrequency.ts` — intuition rare-field check, actually run
  against the real corpus (see Metrics). Found nothing; see Corrections.
- `npx tsc --noEmit` — clean, exit 0, throughout the session.
- `npx vitest run` — **195 tests, 13 files, all pass** (155 → 195).

## What's broken
- **Task 6 did not run at all.** `npm run check-auth` fails with HTTP 401,
  confirmed independently with a raw `curl` against `/user/me` — the JWT is
  rejected, not merely close to expiry. This is a credential problem, not a
  code bug; see QUESTIONS.md §7 for the exact fix.
- `deepestScorableRoom` unchanged at **1** — no live capture happened, so
  session 07's room-3 Safe-tier gap is still open exactly as it was.
- `DungeonActionResponseSchema` still unverified against a live response —
  stage 2 (the one `start_run` POST) never sent.
- `scripts/liveRun.ts`'s `selectByIndex()` sends `loot_<n>` for the enemy-path/
  reward-path/loot selection, and this is an unconfirmed hypothesis, not a
  fact — SPEC §2 never names a selection action distinct from `loot_one`..
  `loot_four`. Flagged inline and in DECISIONS; needs a live response to
  confirm or correct at stage 3.
- Found in passing, not fixed: `src/api/schemas.ts`'s `RunSchema` declares
  `lootPhase`/`pathPhase`/`rewardPathPhase`/`enemyPathPhase` as REQUIRED
  booleans, while `src/sim/corpus.ts`'s hand-written `WireRun` interface marks
  them optional (`?:`). Harmless today — every real response has always
  carried them — but the two should agree.

## Corrections to SPEC.md
- §4e appended: the `intuition` rare-field hypothesis (session-08 brief
  addendum §7) was checked against the corpus and found nothing — every
  top-level key on every side is present 100% of the time, so a proc can't
  show up as a key appearing/disappearing; the four normally-empty array
  fields are non-empty in 0/230, 0/230, 0/230, 3/230 (the known Burn
  instance). This is evidence of insufficient exposure (only 6/230
  observations even carry `intuition`), not evidence the stat does nothing.
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren=NOT FOUND**.
- Move charges: unchanged, PRESENT.
- No spec corrections from a live response this session — nothing live ran.

## Dead ends
- None project-relevant. (One tooling quirk, not worth a DECISIONS entry:
  `tsx -e '...'` doesn't resolve this repo's relative imports; a scratch `.ts`
  file works fine.)

## Metrics
- Sim: unchanged this session — no strategy code touched, Task 5's gate not
  re-run.
- Live: **0 dungeon actions POSTed, 0 runs.** 2 read-only auth checks this
  session (`npm run check-auth`, one raw `curl` against `/user/me`), both
  failed with HTTP 401.
- Corpus analysis: `scripts/fieldFrequency.ts` run once — 230 player/enemy
  side-observations across 5 capture directories, see Corrections.
- Tests: 195 passed, 0 skipped, 0 failed (155 → 195, +40 this session).

## Open questions for Claude
1. **JWT refresh is the whole blocker.** QUESTIONS.md §7 has the exact repro
   and fix (browser DevTools → copy the `Authorization: Bearer` value →
   overwrite `~/.secrets/gigaverse-jwt.txt`). Nothing else in Task 6 can move
   until this happens.
2. Once refreshed: should the next session still run stages 1→4 with a commit
   between each, or does having a fully-built (if live-unverified) script
   justify collapsing stages? My read: keep the staging exactly as brief §5
   specified — the reasoning for stage 2's hard stop was "this is the first
   POST this project has ever sent," which is still true regardless of how
   much surrounding code exists.
3. `selectByIndex()`'s `loot_<n>` hypothesis for enemy-path/reward-path
   selection needs live confirmation at stage 3. If the server rejects it,
   the response body is worth reading closely (it may name the real action)
   rather than treating the rejection as a generic guard trip and moving on.

## Files changed
```
 .claude/commands/gigarecap.md     |  18 +-
 CLAUDE.md                         |  12 +
 QUESTIONS.md                      |  52 ++++-
 SPEC.md                           |  30 +++
 config/bot.json                   |  10 +
 handoff/DECISIONS.md              |   4 +
 handoff/STATE.md                  |   2 +-
 handoff/next.md                   |   4 +-
 package.json                      |   3 +-
 scripts/fieldFrequency.ts         |  83 +++++++
 scripts/liveRun.ts                | 481 +++++++++++++++++++++++++++++++++++
 src/api/client.ts                 |  51 ++++
 src/api/schemas.ts                |  37 +++
 src/orchestrator/config.ts        |  75 ++++++
 src/orchestrator/guards.ts        | 132 +++++++++
 tests/api/client.test.ts          |  86 +++++++
 tests/guards.test.ts              | 102 ++++++++
 tests/liveRun.test.ts             | 323 +++++++++++++++++
 tests/orchestrator/config.test.ts |  72 ++++++
 19 files changed, 1567 insertions(+), 10 deletions(-) — full stat:
 `git diff 44a43ce..7ab83f1 --stat`
```

---

## Verbose appendix (not in STATE.md)

### Commits this session, in order

```
67cb402  session 08: fix STATE.md privacy regression, widen secret scanner
938e41c  CLAUDE.md §9: brief claims are hypotheses to verify, not facts to implement
5084d47  session 08: config/bot.json + guards.ts, un-deferring the 2026-08-12 decision
f4242d8  session 08: add POST /game/dungeon/action to the API client
af15b8e  session 08: JWT rejected, blocking Task 6 — logged per CLAUDE.md
a5f5ab2  session 08: scripts/liveRun.ts — Task 6's run loop, built but not live-verified
7ab83f1  session 08: intuition rare-field check (addendum §7) — checked, found nothing
```

### The JWT rejection, verbatim

```
$ npm run check-auth

> gigaruns@0.1.0 check-auth
> tsx scripts/checkAuth.ts

▸ real JWT
  jwt eyJhbGci...(1728 chars)

✗ Auth rejected (HTTP 401). The JWT is expired or invalid — refresh it.
```

Independent confirmation, bypassing the project's own client entirely:

```
$ curl -s https://gigaverse.io/api/user/me -H "Authorization: Bearer <jwt>"
{"error":"Unauthorized"}
```

The JWT file itself is present and non-empty (`~/.secrets/gigaverse-jwt.txt`,
1729 bytes) — this is not the "missing file" case `loadJwt()` already handles,
it's a token the server no longer accepts. Ruled out before writing anything
to QUESTIONS.md: this is exactly CLAUDE.md's "missing private key/JWT"
blocking condition (a rejected token is functionally the same as no token for
everything Task 6 needs), so it went to QUESTIONS.md §7 immediately rather
than being worked around.

### `scripts/fieldFrequency.ts` output, in full

```
▸ 230 player-side observations across 5 capture directories

  no key path appears in under 15% of observations.

  non-empty rate of array-typed fields (content, not key presence):

    1.3%  (  3/230)  statusEffects
    0.0%  (  0/230)  activeEffects
    0.0%  (  0/230)  gearBoons
    0.0%  (  0/230)  triggeredBoons
```

Supplementary check (scratch, not committed as a script — folded into
`fieldFrequency.ts`'s array-field section above): every rolled-stat key
(`evasion`/`block`/`lck`/`tenacity`/`intuition`) is present on all 230/230
sides; `intuition.current` is non-zero on 6/230. `battleArmorReduction` is
the literal value `0` on all 230; `focusBuffs` is `[]` on all 230.

### Why the staged Task 6 design wasn't second-guessed

The session-08 brief's four-stage plan (dry run → one POST + hard stop → one
full run → five runs) was written assuming a working JWT. Once the JWT turned
out to be dead, the temptation was to treat the whole plan as moot and just
build whatever seemed useful. Stuck to it anyway: `scripts/liveRun.ts`
implements exactly those four stages as CLI modes (`--dry-run`, `--stage2`,
`--runs=N`) rather than a single undifferentiated loop, so the staging is
still what happens the moment the JWT is fixed — nobody has to reconstruct
the plan from a "just make it work" implementation.

### Test count progression, for anyone auditing the session

```
155 (session start)
167 (+ guards.ts, config.ts, tests/guards.test.ts)
172 (+ postDungeonAction tests in tests/api/client.test.ts)
192 (+ scripts/liveRun.ts, tests/liveRun.test.ts, tests/orchestrator/config.test.ts)
195 (+ unknownSideKeys tests, folded into tests/liveRun.test.ts)
```

### `KNOWN_SIDE_KEYS` (22), for reference — every key ever seen on a
player/enemy side across the whole corpus as of this session

```
_id, activeEffects, battleArmorReduction, block, evasion, focusBuffs,
gearBoons, health, id, intuition, lastMove, lck, otherPlayerWin, paper,
pickedBoons, rock, scissor, shield, statusEffects, tenacity, thisPlayerWin,
triggeredBoons
```
