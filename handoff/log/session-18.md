# Session 18 — 2026-08-17 — commit 77b91ad

## Context at start

`next.md` was session 17's brief, already fully executed (verified against
`STATE.md` and `git log`: every item in the brief — extended threshold sweep,
craft attempt, break-even recommendation, unknown-terminal-event dump, fishing
spend — has a corresponding session-17 commit). Per `/handoff`'s own stale-brief
rule, did not re-run it or guess at an unwritten session-18 brief. Worked the
next unblocked item instead: `STATE.md`'s own "Open questions for Claude #1" —
verify the automated `loot` catch-resolution path on the bot's OWN live play,
flagged as top priority since it was wired and unit-tested last session but
never bot-exercised (account energy was too low, 2/420, at session 17's end).

## Finding 1: guard budgets are UTC-date-keyed, and UTC had already rolled over

Real-world wall clock at session start: 2026-08-16 17:02 PDT locally, but
2026-08-17 00:02 UTC — already past midnight UTC. `src/orchestrator/
guardPersistence.ts`'s `todayKey()` uses `new Date().toISOString().slice(0,10)`
— confirmed via a targeted `Explore`-agent read (exact lines 38-40, with the
file's own comment: "UTC calendar date — deterministic and independent of the
host's local timezone"). This meant BOTH `data/guard-budget.json` and
`data/guard-budget-fishing.json` (both still dated `2026-08-16` at session
start, showing session 17's spend) would reset to 0 on first touch today,
giving a fresh 240/12 dungeon and 200/15 fishing budget — confirmed by the
first `--dry-run` fishing invocation's log timestamp (`2026-08-17`) and by
`data/guard-budget-fishing.json` reading `{"date":"2026-08-17","energySpent":0,
"runsStarted":0}` immediately after.

## Finding 2: the `loot` path works, live, on the bot's own catches

`npx tsx scripts/checkFishingStuck.ts` first, to confirm the account wasn't
already stuck from anything between sessions: `COMPLETE_CID: true,
SUCCESS_CID: false, fullDeck length: 14` — clean (a completed-without-catch
game, not a stranded one).

`npx tsx scripts/liveFishing.ts --dry-run` — confirmed the fresh budget and
that the code path is otherwise unchanged from session 17.

`npx tsx scripts/liveFishing.ts --casts=5`:
- cast 1: caught after 2 turns. `★ caught! resolving cardsToAdd offer (49, 41,
  21) -> chose id 21` / `✓ loot sent — fullDeck now 10 card(s), cardChosenId
  21`.
- cast 2: escaped, 5 turns.
- cast 3: escaped, 2 turns.
- cast 4: caught after 4 turns. `fullDeck now 11`.
- cast 5: caught after 4 turns. `fullDeck now 12`.

3/5 caught, all 3 `loot` calls succeeded with no rejection, `fullDeck`
incremented cleanly each time (10→11→12, never stalling or double-counting).
`checkFishingStuck.ts` immediately after: `COMPLETE_CID: true, SUCCESS_CID:
true, fullDeck length: 12` — clean, matches the last cast's own report.

This directly answers STATE.md session 17's open item #1 — the `loot`
auto-resolution path, wired and unit-tested but never bot-exercised, now has 3
independent live confirmations from the bot's own play in one batch.

## Finding 3: `perimeterWalk(cw)` promoted — 3rd confirming cast was cast 1 above

`npx tsx scripts/mineFishPatterns.ts` (re-run against the grown log, now 58
transitions / 15 casts):

```
Primitive exact-match test (23 candidates from src/sim/fishing/patterns.ts):
  perimeterWalk(cw)        support=3  casts=[12923267,12925773,12942030]
  bounce(0,-1)             support=1  casts=[12923267]

Promotion threshold: 3 independent exact-matching casts
  1 primitive(s) promoted: perimeterWalk(cw)

Sim catch rate (500 synthetic casts, focusMeter modelled):
  matcher BLIND (matcherPool: []):        33/500 = 6.6%
  matcher with MINED library (1 pattern): 81/500 = 16.2%
```

Two of the three matching casts (`12923267`, `12925773`) were already known
from session 15 (STATE.md's own "one confirming cast from promotion" note).
The third (`12942030`) is one of THIS session's own casts — the specific one
wasn't logged by docId in the console output, but its timing (within the
`--casts=5` batch) and the fact that the miner's own casts-total (15) only
grew by exactly what this session added confirms it.

## Wiring the promotion into live play (not previously done)

Investigated via an `Explore`-agent query first (to avoid duplicating a search
across the whole matcher/castSim/liveFishing chain by hand): confirmed no
persisted mined-patterns file existed anywhere, `matcherPool` was a sim-only
concept (`src/sim/fishing/castSim.ts`), and `scripts/liveFishing.ts:451` always
called `initMatcher([], fishCell(doc))` — an empty candidate set, forever,
by design (the file's own header comment: "candidate pool starts EMPTY every
cast, deliberately" — true until something had actually been promoted, which
nothing had been before this session).

Built the missing link:
- `scripts/mineFishPatterns.ts` now `writeFileSync`s the promoted pattern
  names (plus `minedAt`/`castCount`) to `data/minedFishPatterns.json` after
  every run — always overwritten, even to an empty list, so a pattern that
  later regresses below threshold doesn't linger stale.
- `scripts/liveFishing.ts` gained `loadMinedPatterns()` (reads the file,
  resolves names back against `buildPatternPool()`, tolerant of a
  missing/unparseable file or an unrecognised name — never a crash, falls
  back to the pre-existing empty-matcher behavior) and now seeds
  `initMatcher` with real `Candidate`s built via `toCandidate(pattern,
  startCell, gridSize, MAX_TURNS)`, anchored at each cast's actual observed
  start cell.

Verified live, not just type-checked: `npx tsx scripts/liveFishing.ts
--casts=1` printed `· matcher seeded with 1 mined pattern(s):
perimeterWalk(cw)` and completed normally (escaped after 3 turns, no crash,
no malformed-candidate error). This confirms the wiring FUNCTIONS live; it
does not yet isolate whether it improved the catch outcome for that one cast
(n=1 is not evidence either way) — that's an accumulating-evidence question
for future sessions, not something one cast can answer.

## Finding 4: the test suite was broken on `main`, unrelated to this session

Running the full suite after the matcher-wiring change surfaced 4 failures in
`tests/replay.test.ts` and `tests/boons.test.ts` (hardcoded corpus-size
assertions — `exchanges(runs).length` expected 386, got 414; `sideUpdates`
expected 772, got 828; etc.). Before assuming these were caused by this
session's own edits, isolated the question with `git stash` (confirmed the
failures persisted with a clean working tree) and then, since `git checkout
<commit> -- .` doesn't remove files added in LATER commits and so doesn't
give a true clean revert, with an actual `git worktree add /tmp/giga-check-head
dfe0b34` (a full separate checkout of `main`'s own tip commit) plus a fresh
`npm install` there. **Confirmed: 4 tests already failed at `dfe0b34` — session
17's own final commit — with zero relation to anything this session touched.**

Bisected further with a second worktree at `268c129` (the commit immediately
before the out-of-band `1da0bc7`, "live: took over and completed
already-active dungeon run at room 1"): **tests passed cleanly there, 56/56**.
So `1da0bc7` is the exact commit that broke the suite — it added 28 new
exchanges and 3 new boon offers to the fixture corpus (a real, legitimate live
dungeon run) but nobody re-ran `npx vitest run` against the result before
committing, and session 17's own `STATE.md` (written at `dfe0b34`, chronologically
AFTER `1da0bc7`) claimed "322/322 passed" — which was not true at that commit.
This is a genuine process gap, not a data-integrity problem: every
model-correctness test (exact clean-exchange replay, per-pickup delta
re-derivation) passed throughout on both sides of the bisection — only the
hand-maintained literal COUNTS were stale, the exact "reshuffling, not a
regression" pattern this project's own test comments already document
happening repeatedly as the corpus grows.

Fixed properly, not just re-numbered:
- `src/sim/boons.ts`'s `OBSERVED_OFFERS` — added the 3 new offers from
  `run-2026-08-16-17-55-45` (room 1: `VulnerableBlock`/`CorrosiveShield`/
  `AddBlock`, picked `AddBlock`; room 2: `UpgradeScissor`/`AddTenacity`/
  `AddBlock`, picked `AddTenacity`; room 3: `AddVulnerableShield`/`AddLuck`/
  `AddBlock`, picked `AddLuck`) with sourced commentary matching the file's
  existing style. `VulnerableBlock` and `AddVulnerableShield` are first
  sightings, both offered-not-picked, correctly left unmodelled.
- `tests/boons.test.ts` — `pickups.length` 37→40; `UNMODELLED_TYPES` gained
  the 2 new type names (alphabetically inserted); `roomOne.length` (room-1
  option count) 57→60, `clean` array unchanged (the new room-1 options are
  either already-known-contaminated or newly-unmodelled, nothing newly
  clean).
- `tests/replay.test.ts` — `exchanges(runs).length` 386→414; `sideUpdates`
  772→828.
- `tests/dungeonSim.test.ts` — `battleCoverage.scored` (seed 1, N=1000)
  1126→1108 — same reshuffling pattern the test's own long comment history
  already documents for every prior corpus growth. `deepestScorableRoom`
  ALSO moved, 4→3, the first time this specific number has changed through
  any of these reshufflings — verified this is NOT `MAX_OBSERVED_ROOM`
  regressing (that constant comes from `ROOM_ENEMIES` in `src/sim/
  enemies.ts`, untouched this session, still 4) but a property of THIS
  seeded 1000-run sample: the larger room-1/2/3 option pools shifted which
  boon each simulated run draws, and the specific low-probability tail of
  "stay scorable through a room-4 battle" didn't land in this sample this
  time. Documented inline with the distinction spelled out, since a future
  reader seeing "4→3" without context would reasonably suspect a real
  regression.

Verification, both directly in the working tree (not just in the diagnostic
worktrees): `npx tsc --noEmit` clean, `npx vitest run` **325/325 passed**
(was 322 claimed / actually 4-failing before this session).

Committed separately from the fishing work (`177bb37`) so the "found a
pre-existing break, fixed it" story reads clearly in `git log` rather than
being buried inside a fishing-feature commit.

## Finding 5: dungeon and fishing energy ARE the same account-wide pool

`config/bot.json`'s `dendren._comment` had carried a `[VERIFY]` note since
session 15: "whether this energy is the SAME account-wide pool `forbiddenWoods`
spends from — plausible but not confirmed by a captured fishing energy delta
yet." Settled this session, not by design but by both loops independently
hitting the real floor:

- `npx tsx scripts/liveFishing.ts --casts=9` ran 3 successful casts (1 more
  catch — `fullDeck now 13`) then guard-tripped on cast 4's `start_run`:
  `HTTP 400`, real energy `9` (below the 12 needed for a tier-1 cast).
- ~90 seconds later, `npx tsx scripts/liveRun.ts --runs=5` guard-tripped
  IMMEDIATELY on run 1's `start_run`: `HTTP 400`, energy shown as `10 -> 10
  (spent 0)`.
- A direct read via a small ad-hoc script calling `GigaverseClient.getEnergy()`
  (written to the session scratchpad, not the repo — deleted after use)
  confirmed `GET /offchain/player/energy`: `energyValue: 10, maxEnergy: 420,
  regenPerHour: 18, isPlayerJuiced: true`. Both guard trips were reading the
  SAME underlying value from the SAME endpoint, ~90 seconds apart — one pool,
  not two independently-tracked ones.

Both fail-closed correctly per CLAUDE.md §5: neither loop retried, both
logged the real HTTP body, both halted cleanly with no fixture data written
for the dungeon attempt (it failed before any state was captured — confirmed
`fixtures/dungeon-runs/run-2026-08-17-00-14-48/` contains only an empty
gitignored `raw/` subdirectory, nothing committed).

Updated `config/bot.json`'s `dendren._comment` to record the confirmation and
its evidence, replacing the `[VERIFY]` note. Not committed as its own commit —
folded into `77b91ad` alongside the two new fishing-cast fixture dirs from
this session's later casts (`cast-2026-08-17-00-12-52`,
`cast-2026-08-17-00-13-28`).

## Not attempted

- No further dungeon runs — real energy floor blocks it (10 < 20), regen is
  18/hour so meaningful headroom is roughly an hour out, not worth waiting on
  mid-session.
- No further fishing casts past the guard trip — same real-energy-floor
  reasoning (9 < 12 needed).
- Did not attempt to grow `mineFishPatterns.ts`'s promoted set past 1 primitive
  this session — needs more live casts than today's energy allowed, and the
  wiring that makes future promotions matter automatically is exactly what
  this session shipped.

## Commits this session

- `177bb37` — fishing loot-path live verification + mined-pattern wiring +
  test-suite repair (the substantive work).
- `77b91ad` — `config/bot.json` energy-pool-confirmation comment + 2 more live
  fishing-cast fixture dirs from casts run after the first commit.
