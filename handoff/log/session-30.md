# session-30.md — 2026-08-18 — commit 05db6ea

Same content as `handoff/STATE.md` at commit time, plus verbose detail that
doesn't belong in the always-loaded STATE.md.

---

## Status
No TASKS.md gate was targeted this session — the brief was four items: §0
(resolve the QUESTIONS.md §14 mystery-writer before touching fishing data),
§1 (run-visibility reporting for both loops), §2 (nextPosition validation
recording), §3 (Dual Yield forward detector). Task 10 stays the last GATE
PASS (session 25, unchanged); this session touched none of that path.

## §0 — full detail: the QUESTIONS.md §14 mystery, resolved

The brief's own strong hypothesis (test fixtures writing to the real path)
was checked directly rather than assumed. `tests/liveFishing.test.ts` and
`tests/mineFishPatterns.test.ts` (session 29's own new files, the brief's
first suspects) were both already correctly isolated — every write goes
through `mkdtempSync` temp dirs.

The real culprit was found by grepping for the literal pollution docIds
(`9001`/`9002`) across the repo: `tests/sim/fishingCorpus.test.ts` (added
session 28, CODEXREVIEW #1/#5's own regression test) uses exactly these two
docIds as synthetic fixture data. Its `runOneCast` call:

```ts
const p = runOneCast({
  client, config: TEST_CONFIG, guards, fixtures, log,
  address: "0xUSER", dryRun: false,
});
```

passes no `transitionsPath`, which defaults to `DEFAULT_TRANSITIONS_PATH =
join("data", "fish-patterns.jsonl")` — the REAL corpus file
(`scripts/liveFishing.ts:453`). Every run of this test appended a real,
zero-movement transition record (the test's `fakeDoc` always has
`fishPosition`/`previousFishPosition` both `[0,0]`). Session 29's own
CODEXREVIEW #5 fix (`lastRecordForCast`) then made each SUBSEQUENT test run
resume from the file's own growing history for that castId, incrementing
the turn number — exactly the "new timestamps, incrementing turns 0→1→2→3"
pattern session 29 observed and couldn't explain, because the "process"
was the test suite being re-run repeatedly during that session, not a
live watcher.

Fix: added `transitionsPath: join(root, "fish-patterns-test.jsonl")` to the
test's `runOneCast` call. Verified with an MD5 checksum of the real file
before/after re-running the test — unchanged. Cleaned the 14 accumulated
pollution lines out of the real file with `grep -v`, leaving 169 lines
(matching session 29's own "169 real transitions" count exactly). Re-ran
`npx tsx scripts/mineFishPatterns.ts`: 50 casts, 169 transitions,
`perimeterWalk(cw)` support=4 and `perimeterWalk(ccw)` support=3 both still
promoted (unchanged from session 29), `twoCellCycle(0,-1)` still support=1
(unchanged) — the pollution's all-zero-movement records never matched any
real primitive shape, so nothing mined was ever actually distorted by it,
but the leak is now closed for every future test run.

## §1 — full detail: run-visibility reporting

### Field verification, done BEFORE writing any report code (brief's own instruction)

Searched `fixtures/probe/raw/roms-offchain-static-raw.json`'s `gameItems`
catalog for anything matching "root"/"core"/"dendren" by name. Found:
- item 845, `NAME_CID: "Hard Core"`, description "A core of ontological
  hardware found in the Forbidden Woods."
- item 846, `NAME_CID: "Dendren Remnant"`, description "Twigs fallen off of
  the Dendren found in the Forbidden Woods... Can be used to level up
  Forbidden Woods Skills." — this description matches the user's own
  session-08 description of "Dendren roots" ("used to manually level Max
  HP/Max ARM/Tenacity/...") almost exactly. No item literally named
  "Dendren Root" exists in the catalog.

Then checked real dungeon action-response fixtures for where these items
actually get credited, via `data.entity`/top-level `gameItemBalanceChanges`
(a field `src/sim/corpus.ts` didn't parse before this session — it only
read `data.run`). Sampled `fixtures/dungeon-runs/run-2026-08-15-15-38-09/`:

```
state-054.json  message: "Reward chosen"   gameItemBalanceChanges: [{id: 845, amount: 56}]
state-068.json  message: "Move Used"       gameItemBalanceChanges: []
state-079.json  message: "Reward chosen"   gameItemBalanceChanges: [{id: 845, amount: 52}]
state-110.json  message: "Move Used"       gameItemBalanceChanges: [{id: 846, amount: 5}]
state-126.json  message: "Move Used"       gameItemBalanceChanges: []
```

Confirms: Hard Core (845) credits on a boon pick ("Reward chosen" —
confirms the session-08 `gigusOrbItemId`/`gigusOrbAmount` hypothesis
directly, DECISIONS 2026-08-14). Dendren Remnant (846) credits on a
"Move Used" response that lands a kill (matches `enemyPathOptions[].
lootTable`'s `GAME_ITEM_ID_CID_array: [846]`, SPEC.md §3e).

For fishing, checked whether `doc.data.caughtFish` (SPEC-fishing.md's
documented catch shape) is ever actually populated:

```python
for f in glob.glob('fixtures/fishing-casts/live/*/state-*.json'):
    d = json.load(open(f)); cf = d['data']['doc'].get('caughtFish')
    if cf: print(f, cf)
# -> no output. Every real live catch fixture has caughtFish: null.
```

The real catch data lives in `data.events[]`'s `FISH_DIED` entry instead —
confirmed across 7 real catch fixtures (`Ollie`/517, `Finley`/516 ×2,
`Plankton`/515, `Kelpkin`/519, `Barnaboo`/514, `Zombo`/521), each with
`{type: "FISH_DIED", value: <gameItemId>, data: {fish: {gameItemId, name,
rarity, ...}}}`.

### The IS_JUICED_CID trap, caught before shipping

First implementation used `entity.IS_JUICED_CID` for the report's "juiced"
flag. Running it against the real corpus showed **47/47 attempts juiced** —
implausible on its face (session 25's real 2-hour run alone did a mix of
juiced/non-juiced play per its own recap). Checked directly:

```python
# IS_JUICED_CID values seen across the whole corpus: {True}  <- constant!
# WANTS_JUICED_MODE_CID values seen: {False, True}            <- varies
```

`IS_JUICED_CID` is `true` on literally every fixture, including
pre-session-08 captures that predate the Juiced RUN MODE's very existence
— it's the ACCOUNT-level purchased buff DECISIONS 2026-08-17 (session 23)
already named and distinguished from the run mode (`isPlayerJuiced` vs.
the "Juiced" run mode are TWO of the three "juice" concepts that session
called out), just mirrored onto the entity object under a name similar
enough to cause exactly this mistake. `WANTS_JUICED_MODE_CID` is the real
per-run flag — checked it's stable within every attempt (no corpus attempt
has mixed values across its own states) and varies across attempts (45
false / 2 true, a plausible real distribution). Switched the report to use
it; corrected output shows 2 juiced, 1020 total energy (45×20 + 2×60 =
900+120=1020, checks out exactly).

### Architecture

- `src/sim/corpus.ts` extended additively: `WireEntity`
  (`IS_JUICED_CID`/`WANTS_JUICED_MODE_CID`/`ROOM_NUM_CID`/`COMPLETE_CID`)
  and `WireItemBalanceChange` (`{id, amount}`), both parsed in `readState`
  alongside the existing `run` field. No existing field removed/renamed.
- `src/sim/fishingCorpus.ts` extended additively: `CaughtFish`, parsed from
  `data.events[]`'s `FISH_DIED` entry.
- `scripts/deathRooms.ts` refactored: its grouping/room/death logic
  extracted into an exported `computeAttempts()` (now returns `states` too,
  needed for reward aggregation), CLI printing guarded behind an
  `isMain` check (`process.argv[1]` pattern, same as `liveFishing.ts`) so
  importing it has no side effects. Verified `npx tsx scripts/
  deathRooms.ts` still prints the identical histogram when run directly.
- `src/sim/dungeonReport.ts` / `src/sim/fishingReport.ts`: pure functions
  only (`summarizeDungeonAttempt`, `buildDungeonMarkdown`,
  `summarizeFishingCast`, `summarizeFishingRollup`, `buildFishingMarkdown`)
  — same split as `src/strategy/` vs. `src/api/`.
- `scripts/dungeonReport.ts` / `scripts/fishingReport.ts`: CLI glue,
  rebuilds both the gitignored JSONL and the committed markdown from the
  FULL corpus every invocation (deterministic, no incremental-append
  consistency to manage — chosen over per-run appending specifically to
  avoid partial/duplicate-record bugs).
- Wired into `scripts/orchestrator.ts`'s end-of-session rollup
  (`try`/`catch`, non-fatal — a report-generation failure shouldn't turn a
  clean session into a non-zero exit).

### CLEARED outcome (never observed live)

`DungeonOutcome`'s `cleared` variant requires `ROOM_NUM_CID >= MAX_ROOM
(16) && COMPLETE_CID === true` on the attempt's last captured state — a
principled definition given the confirmed field semantics, not a verified
observation of the shape itself (floor 4 / room 16 has never been cleared
in this project). Tested with a fabricated fixture
(`tests/sim/dungeonReport.test.ts`) rather than skipped, per the brief's
explicit ask, plus a companion test proving `ROOM_NUM_CID: 16` alone
(without `COMPLETE_CID: true`) does NOT falsely report cleared.

## §2 — full detail: nextPosition validation

Read QUESTIONS.md §12/DECISIONS.md's full history before writing anything:
2/169 real firings across the whole fishing corpus, a binomial test against
a 3% Fintuition null does NOT reject (P(X≤2) ≈ 11.5%), and the two
candidate corroborating fields (`activeFintuitionTurns`,
`fintuitionOilBoostPercent`) are constant 0/null across every single turn
of the corpus — genuinely uninformative either way.

Implementation, `scripts/liveFishing.ts`:
- `extractNextPosition(doc)`: reads `data.nextPosition` off the raw
  response (not added to the zod schema — cause still unconfirmed, per
  CLAUDE.md §2's spirit of not modelling something not understood).
- `appendNextPositionValidation`/`loadNextPositionValidations`/
  `confirmedHitCount`: JSONL log at `data/nextPositionValidation.jsonl`
  (gitignored), same pattern as `appendTransition`/`loadTransitionLog`.
- Wired into `runOneCast`'s per-turn loop: after computing `toCell` each
  turn, checks whether the PRIOR turn revealed a prediction (`
  pendingPrediction`); if so, logs hit/miss, then extracts THIS turn's own
  `nextPosition` (if any) as the prediction to check against the NEXT
  turn. Reset to `null` per cast (not carried across a resume — a resumed
  doc's position might not line up exactly with a pre-resume prediction).
- Override: `certainDistribution(cell)` builds a `Distribution` with all
  probability mass on one cell; wired to replace `dist` in `chooseCard`'s
  call ONLY when `pendingPrediction.turn === turn &&
  confirmedHitCount(...) >= NEXT_POSITION_OVERRIDE_THRESHOLD (10)`. At 2
  confirmed hits in this project's entire history, unreachable this
  session regardless of live volume — exactly "log more sightings before
  letting it override the matcher," per the brief.

Integration-tested through a mocked `GigaverseClient` (not just unit tests
of the pure helpers): a 2-turn synthetic cast where turn 0's response
reveals `nextPosition: [2,2]` and turn 1's actual position is exactly
`[2,2]` — asserts a `hit: true` record lands in the validation log, AND a
companion test asserting the override never fires (confirmedHitCount stays
far below 10) even after a real hit is recorded.

## §3 — full detail: Dual Yield forward detector

DECISIONS 2026-08-17 (session 27) already audited the entire existing
corpus for a double-catch and found none — every real `caughtFish` is a
single object, largest `gameItemBalanceChanges` array seen has exactly 2
entries (one fish + one Hard Core credit). The brief was explicit: the
skill was added to the account AFTER capture, so there's nothing to
backfill; this only needs to catch the NEXT live occurrence.

`detectPossibleDualYield(raw)` checks two independent signals (deliberately
not betting on one specific double-catch shape, since this project doesn't
know which one a real Dual Yield event takes):
1. 2+ `FISH_DIED` entries in one response's `data.events[]`.
2. 2+ DISTINCT non-currency item ids in one response's top-level
   `gameItemBalanceChanges` (currency id 845 excluded — a normal single
   catch already credits fish+currency together, so this specifically
   excludes that known pattern rather than flagging every ordinary catch).

Wired into both the `play_cards` loop (every turn, catching the moment a
catch response lands) and the `loot` response (in case a double-catch only
reveals itself at resolution time). On a hit: dumps the full raw response
to `logs/fishing-unknown-dual-yield-*.json`, logs
`possible_dual_yield_event`, prints loudly to console — same "loud dump, no
strategy change" pattern as the existing unknown-terminal-field detector.

## What's broken
Nothing newly broken by this session's changes — 479/479 tests pass (up
from 454/454 at session 29's end), `npx tsc --noEmit` clean, both verified
against this session's final commit (05db6ea). Unchanged, pre-existing open
items:
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).

## Corrections to SPEC.md
None edited this session — see STATE.md's note and open question #1: the
reward-field findings are recorded in code comments and DECISIONS.md but
not yet folded into SPEC.md/SPEC-fishing.md's own `[VERIFY]` tags.

## Dead ends
None this session.

## Metrics
- No live play this session.
- Tests: 479/479 passing (+25 new since session 29's 454).
- Backfilled dungeon report (47 attempts, full corpus): 38 deaths (room 1
  ×1, room 2 ×9, room 3 ×12, room 4 ×12, room 5 ×4), 0 cleared, 9
  incomplete/stopped, 2 juiced, 6604 Hard Core earned, 803 Dendren Root
  earned, 1020 energy spent.
- Backfilled fishing report (50 casts, full corpus): 7 caught (14.0%) —
  Finley ×2, Zombo ×1, Plankton ×1, Ollie ×1, Barnaboo ×1, Kelpkin ×1.

## Open questions for Claude
1. Should the reward-field findings (§1's Hard Core/Dendren Root/catch-
   source discoveries) get folded into SPEC.md/SPEC-fishing.md directly in
   a future session? Not done this session.
2. Unchanged from session 29: which CODEXREVIEW/CODEXIMPROVE items are
   worth queuing next? Remaining: CODEXREVIEW #8, CODEXIMPROVE #1/#2,
   #9/#10.
3. `NEXT_POSITION_OVERRIDE_THRESHOLD = 10` is a stated "a handful," worth
   sanity-checking once real validation data accumulates.
4. The run-visibility reports currently only regenerate at `orchestrator.
   ts`'s end-of-session rollup, not after standalone `liveRun.ts`/
   `liveFishing.ts` invocations. Worth deciding whether those should also
   trigger it, or whether a manual-regeneration convention is fine.

## Commits this session
- `d9110f6` session 30 §0: fix fishingCorpus.test.ts leaking synthetic casts into real fish-patterns.jsonl
- `ee3c22f` session 30 §1: run-visibility reporting for dungeon and fishing loops
- `dc92d5f` session 30 §2: nextPosition validation-only recording, live override gated
- `05db6ea` session 30 §3: Dual Yield forward detector
