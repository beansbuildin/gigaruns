# STATE — session 30 — 2026-08-18 — commit 05db6ea

## Status
No TASKS.md gate was targeted this session — the brief was four items: §0
(resolve the QUESTIONS.md §14 mystery-writer before touching fishing data),
§1 (run-visibility reporting for both loops), §2 (nextPosition validation
recording), §3 (Dual Yield forward detector). Task 10 stays the last GATE
PASS (session 25, unchanged); this session touched none of that path.
Overall: all four brief items are done, committed, and verified against the
final commit. No live play happened this session (matches the brief's own
scope — §1-§3 are all instrumentation/reporting, not live-loop changes).

## What works
- **QUESTIONS.md §14 (the `9001`/`9002` pollution "mystery") is RESOLVED,
  and it was never a live process.** `tests/sim/fishingCorpus.test.ts`
  (added session 28) calls the real `runOneCast` with `dryRun: false` and
  synthetic docIds `9001`/`9002` but never passed `transitionsPath`, which
  defaults to the real `data/fish-patterns.jsonl` — every test run
  appended a real record, and session 29's own `lastRecordForCast`
  resume-fix made repeated test runs during a session increment the turn
  number, producing exactly the "active process" appearance. Fixed by
  isolating the test's `transitionsPath` to a temp dir; verified the real
  file's checksum is now unchanged after re-running that test. Cleaned 14
  pollution records out of the real (gitignored) corpus file — 169 real
  transitions / 50 real casts remain, matching session 29's clean count.
  Re-ran `mineFishPatterns.ts`: `twoCellCycle(0,-1)` unchanged at
  support=1 — the pollution's zero-movement records never matched any
  primitive, so nothing mined was ever actually affected, but the leak is
  closed going forward.
- **Run-visibility reporting is live for both loops.**
  `scripts/dungeonReport.ts`/`scripts/fishingReport.ts` rebuild
  `data/run-reports/{dungeon,fishing}.jsonl` (gitignored) and the committed
  `handoff/reports/{dungeon-runs,fishing-casts}.md` summaries from the full
  fixture corpus every run (deterministic, no incremental-append
  consistency to manage). Wired into `scripts/orchestrator.ts`'s
  end-of-session rollup (non-fatal on failure) so future live sessions
  regenerate both automatically. Backfilled against the full committed
  corpus: 47 dungeon attempts (38 deaths, 0 cleared, 9 incomplete, 2
  juiced, 6604 Hard Core / 803 Dendren Root earned, 1020 energy), 50
  fishing casts (7 caught, 14.0%).
- **Dungeon reward fields CONFIRMED against real captures before writing
  any report code** (not guessed from SPEC's `[VERIFY]` tags): Hard Core
  (item 845) is credited via the top-level `gameItemBalanceChanges` array
  on a `"Reward chosen"` response — confirms the session-08
  `gigusOrbItemId`/`gigusOrbAmount` hypothesis directly. The user's
  "Dendren Root" is wire item 846, `NAME_CID: "Dendren Remnant"` — credited
  on a `"Move Used"` response landing a kill. Fishing catch data
  (name/rarity) comes from a response's `data.events[]` `FISH_DIED` entry,
  NOT `doc.data.caughtFish` (checked every committed live-catch fixture:
  that field is null in all of them despite SPEC-fishing.md documenting it
  as the catch shape).
- **Caught and fixed before shipping**: `IS_JUICED_CID` on a dungeon
  response's `data.entity` is NOT the per-run "Juiced mode" flag — it's
  `true` on all 47 corpus attempts, including pre-Juiced-mode captures. Per
  DECISIONS 2026-08-17 (session 23) this is the ACCOUNT-level purchased
  buff, just mirrored onto the entity object. The real per-run field is
  `WANTS_JUICED_MODE_CID`, confirmed stable within an attempt and varying
  across attempts (45 false / 2 true). First draft of the report used the
  wrong field and showed 47/47 "juiced" — caught by eyeballing the output
  before committing, not by a test.
- **nextPosition validation-only recording is live**, per user directive
  paired with the standing statistical caveat (2/169 real firings,
  compatible with but not confirming a 3% Fintuition rate).
  `scripts/liveFishing.ts`'s `runOneCast` logs predicted-vs-actual to
  `data/nextPositionValidation.jsonl` every time a prior turn's prediction
  can be checked. The live override (force focus to the predicted cell) is
  wired but gated behind `NEXT_POSITION_OVERRIDE_THRESHOLD = 10` confirmed
  hits — unreachable at today's 2-hit total regardless of live volume.
- **Dual Yield forward detector is live.** `detectPossibleDualYield` checks
  every `play_cards`/`loot` response for 2+ `FISH_DIED` events or 2+
  distinct non-currency `gameItemBalanceChanges` ids; on a hit, dumps the
  full raw response to `logs/fishing-unknown-dual-yield-*.json`. No live
  occurrence yet (the skill was added to the account after the existing
  corpus was captured, so there's nothing to backfill — DECISIONS
  2026-08-17 session 27's audit stands unchanged).

## What's broken
Nothing newly broken by this session's changes — 479/479 tests pass (up
from 454/454 at session 29's end), `npx tsc --noEmit` clean, both verified
against this session's final commit. Unchanged, pre-existing open items:
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends the
  whole session (unchanged since session 25).

## Corrections to SPEC.md
None edited this session — the reward-field findings (Hard Core,
"Dendren Root"/"Dendren Remnant", fishing catch source) are new discoveries
recorded in `src/sim/dungeonReport.ts`/`src/sim/fishingCorpus.ts`'s own doc
comments and DECISIONS.md rather than SPEC.md itself; SPEC.md's existing
`[VERIFY]` tags on these fields were not individually resolved in the spec
document this session. Worth a follow-up pass folding these into SPEC.md
directly.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
None this session — the one thing that looked like it might become a dead
end (backfilling `data/run-reports/*.jsonl` incrementally per-run) was
reconsidered before building it: rebuilding wholesale from the fixture
corpus every run is simpler, avoids append-consistency bugs, and is what
got built instead. Not a dead end since nothing was built and discarded.

## Metrics
- No live play this session (no dungeon runs, no fishing casts sent) —
  pure instrumentation/reporting session, consistent with the brief's
  scope.
- Tests: 479/479 passing (+25 new since session 29's 454: 11 for
  `src/sim/{dungeon,fishing}Report.ts`, 14 for `scripts/liveFishing.ts`'s
  §2/§3 additions).
- Backfilled dungeon report (47 attempts, full corpus): 38 deaths (room 1
  ×1, room 2 ×9, room 3 ×12, room 4 ×12, room 5 ×4), 0 cleared, 9
  incomplete/stopped, 2 juiced, 6604 Hard Core earned, 803 Dendren Root
  earned, 1020 energy spent.
- Backfilled fishing report (50 casts, full corpus): 7 caught (14.0%) —
  Finley ×2, Zombo ×1, Plankton ×1, Ollie ×1, Barnaboo ×1, Kelpkin ×1.
- Real fishing corpus (`data/fish-patterns.jsonl`, corrected): 50 real
  casts, 169 real turns, pollution removed.

## Open questions for Claude
1. Should the reward-field findings (§1's Hard Core/Dendren Root/catch-
   source discoveries, all currently only in code comments and
   DECISIONS.md) get folded into SPEC.md/SPEC-fishing.md directly in a
   future session? Not done this session — flagged in the Corrections
   section above rather than silently left implicit.
2. Unchanged from session 29: which CODEXREVIEW/CODEXIMPROVE items are
   worth queuing next? Remaining: CODEXREVIEW #8 (split committed-vs-
   observed energy accounting), CODEXIMPROVE #1 (persist/bootstrap the
   dungeon opponent model), CODEXIMPROVE #2 (resource-conserving fishing
   tie-breaks), #9/#10 (docs/dependency cleanup, lower priority).
3. `NEXT_POSITION_OVERRIDE_THRESHOLD = 10` is a stated "a handful," not a
   power calculation (the event is too rare for one yet, per DECISIONS
   2026-08-18). Worth Claude(chat) sanity-checking that number once more
   real validation data accumulates — it was picked, not derived.
4. The run-visibility reports (`handoff/reports/*.md`) are currently only
   regenerated at `orchestrator.ts`'s end-of-session rollup, not after
   individual `liveRun.ts`/`liveFishing.ts` standalone invocations (Task 6/
   9's supervised staged scripts). Worth deciding whether those should also
   trigger regeneration, or whether "run `scripts/dungeonReport.ts`/
   `scripts/fishingReport.ts` manually after a standalone session" is
   an acceptable stated convention instead.

## Files changed
```
 QUESTIONS.md                     |  15 ++-
 handoff/DECISIONS.md             |   6 +
 handoff/reports/dungeon-runs.md  |  68 ++++++++++++
 handoff/reports/fishing-casts.md |  69 ++++++++++++
 scripts/deathRooms.ts            | 120 ++++++++++++--------
 scripts/dungeonReport.ts         |  51 +++++++++
 scripts/fishingReport.ts         |  40 +++++++
 scripts/liveFishing.ts           | 179 +++++++++++++++++++++++++++++-
 scripts/orchestrator.ts          |  17 +++
 src/sim/corpus.ts                |  54 ++++++++-
 src/sim/dungeonReport.ts         | 187 +++++++++++++++++++++++++++++++
 src/sim/fishingCorpus.ts         |  27 ++++-
 src/sim/fishingReport.ts         |  99 +++++++++++++++++
 tests/liveFishing.test.ts        | 234 +++++++++++++++++++++++++++++++++++++++
 tests/sim/dungeonReport.test.ts  | 147 ++++++++++++++++++++++++
 tests/sim/fishingCorpus.test.ts  |   6 +
 tests/sim/fishingReport.test.ts  |  71 ++++++++++++
 17 files changed, 1336 insertions(+), 54 deletions(-)
```
