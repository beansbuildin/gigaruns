# STATE — session 20 — 2026-08-16 — commit 64d4cc5

## Status
Task 10 "Orchestrator": **IN PROGRESS** — potion wiring (this session's
concrete piece of it) is DONE and live-verified. The task's actual GATE
(eight-hour unattended run) is still NOT attempted; nothing in this session
changes that.
Next per TASKS.md: nothing else numbered is open. Kicking off the real 8h
orchestrator run outside an interactive session is the concrete next step —
see "Open questions" below.
Overall: the bot can now run a full potion-aware dungeon loop unattended for
short bursts (live-verified); the only thing standing between this project
and its stated goal is someone starting `npx tsx scripts/orchestrator.ts
--hours=8` outside a chat session and letting it run.

Also this session, unplanned but high-value: a user-provided data dump
revealed the ROM energy-claiming lever is far larger than session 19 found
(~3,252 energy unclaimed right now, not a ~1-energy trickle) — see Corpus/
Metrics below. Not automated; sizing/decision work, reported to the user.

## What works
- **Potion policy wired into the orchestrator's dungeon path**
  (`scripts/orchestrator.ts`'s new `resolvePotionLoadout()`) — reuses
  `liveRun.ts`'s exact policy (`shouldUsePotion`/`DEFAULT_POTION_THRESHOLD`,
  the `forbiddenWoods.potions` allowlist) but rebuilt fresh per dungeon
  iteration rather than once per process, since the orchestrator starts many
  independent runs across one long-lived process and each `start_run` commits
  its own consumables loadout server-side. Live-verified: two orchestrator-
  started dungeon runs, both real `use_item` calls (index 0 then 1) returned
  HTTP 200 and healed correctly mid-battle.
- Resuming a run that has NO committed consumables (started potion-free by
  an earlier session/process) now visibly and correctly guard-trips on
  `use_item` rather than silently doing nothing or crashing — confirmed live
  (session 19's stuck room-2 run, resumed this session, hit exactly this
  case; re-resuming with `--potions=0` finished it cleanly).
- Corpus-count "bookkeeping tax" tests refactored
  (`tests/replay.test.ts`, `tests/boons.test.ts`, `tests/dungeonSim.test.ts`)
  — monotonic corpus-size counts (exchanges, sideUpdates, boon pickups) are
  now floors (`toBeGreaterThanOrEqual`); the non-monotonic Task-4-gate sim
  numbers (`battleCoverage.scored`, `deepestScorableRoom`) are now bounded
  ranges/invariants. Live-exercised the same session it landed: this
  session's own new fixture data would have broken 5+ hardcoded literals
  under the old scheme; only genuine model-content gaps (a new enemy, new
  boon offers) needed hand updates, not corpus-size bookkeeping.
- **`POST /roms/factory-claim`'s payout mechanism is now understood
  correctly.** `energyCollectable` (a real-time per-ROM field from a
  user-provided ROMULATOR panel dump) maps directly to real credited
  energy — two live verification claims both confirmed this (romId 5345:
  snapshot 12, delta exactly 12; romId 689: snapshot 11, delta 12,
  consistent with live accrual between snapshot and claim). `amount` in the
  request remains fully cosmetic (re-confirmed with a deliberately
  mismatched `amount:999`, same result).

## What's broken
- Nothing newly broken. One new friction point, not a bug: the harness's
  auto-mode classifier blocked the first ROM-claim attempt outright,
  requiring an explicit in-chat confirmation before either verification
  claim could run — session 19's claims never hit this. Not something to
  work around; just something the next session should expect.

## Corrections to SPEC.md
- ROM factory-claim section substantially revised, not just extended:
  session 19's "cooldown, ~1 energy trickle" framing is superseded — see
  the new "REVISED, session 20" / "SUPERSEDED" bullets in SPEC.md's ROM
  section for the full writeup (cooldown is real-time per-ROM accrual, not
  a fixed timer; a real enumeration+balance snapshot exists via the
  ROMULATOR panel, source endpoint not yet confirmed by URL; total claimable
  right now is ~3,252 energy).
- `MAX_OBSERVED_ROOM` (src/sim/enemies.ts) moved 4 → 5 — first-ever room-5
  capture, Enemy Room 67, Safe tier, clean (no unmodelled mechanics).
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- None new this session. (The potion/resumed-run mismatch below is a real
  finding, not a dead end — the system did the right thing.)

## Metrics
- Tests: 343/343 at session start → 351/351 at end (+8, mostly test-file
  literal/structure changes from the corpus-count refactor and new corpus
  content, not new test cases). `npx tsc --noEmit` clean throughout.
- Live dungeon: 3 runs this session — the resumed room-2 run finished (room
  2 won, died room 3), plus two fresh orchestrator-started runs from the
  potion-wiring smoke test (first: rooms 1-4 cleared, reached room 5 for
  the first time ever, died there; second: room 1 won, died room 2).
  Confirmed deaths now include two more room-3/room-5 entries (exact
  histogram not recomputed this session — see `scripts/deathRooms.ts` if
  needed next time).
- ROM claims: 2 successful this session (romId 5345 +12 energy, romId 689
  +12 energy), 0 failed. Combined with session 19's 1 successful claim
  (+~1 energy) and 3 failed (uninformative HTTP 500s), lifetime total is 3
  successful claims, +~25 energy actually credited so far — a small
  fraction of the ~3,252 energy the ROMULATOR snapshot shows as currently
  claimable across all 37 owned ROMs.
- Fishing: untouched this session (0 casts).
- Corpus growth: 4 fixture directories added
  (`run-2026-08-17-04-35-04` through `run-2026-08-17-04-47-48`), covering
  the resumed run's finish plus the two smoke-test runs. New content:
  Enemy Room 67 (room 5, first-ever), 7 new `OBSERVED_OFFERS` entries
  (including the corpus's first-ever room-4 offer), 2 new unmodelled boon
  types (`CorrosiveSword`, `LossBlockUp`).

## Open questions for Claude
1. **The 8-hour orchestrator run is ready to start.** Potions are now wired
   in and live-verified; nothing code-side is blocking it. This needs the
   user to run `npx tsx scripts/orchestrator.ts --hours=8` outside an
   interactive session and let a future session review the resulting log/
   rollup. Flag this plainly — it's the last piece of Task 10's actual gate.
2. **ROM batching strategy against the 420 energy cap is a user decision,
   not an engineering one.** ~3,252 energy is claimable right now across 37
   ROMs, but the account's own energy ceiling is 420 — claiming it all at
   once without spending it down first would waste most of it to the cap.
   Worth asking the user directly how they want to sequence claiming
   (batches sized to top off before a play session? claim-then-play-down
   cycles? something else?) before any of this gets built into anything.
3. **The ROMULATOR snapshot's source endpoint is still unconfirmed by URL**
   — the user pasted the response directly rather than a captured request.
   Worth asking for the exact request (URL/method, or a DevTools capture)
   so a read-only probe script can be built for future sessions instead of
   relying on another manual paste.
4. **ROM accrual RATE is still not independently confirmed** — only one
   snapshot exists. Not urgent (the one-time stockpile size is already
   known), but matters if this ever gets scheduled/automated: worth a second
   snapshot read, spaced hours apart, to confirm the "~1 week to fill"
   read from `percentageOfAWeekSinceLastEnergyClaim` before building
   anything around it.
5. Everything from session 19's brief §5 (potion-free orchestrator dungeon
   runs) is now resolved — no longer an open item.

## Files changed
```
$ git diff --stat 27ee836..HEAD (excluding fixtures/, which is 156 files of
  redacted dungeon-run/ROM-claim captures — see commit 64d4cc5 directly)
QUESTIONS.md             | 46 +++++++++++++++++++++++++
SPEC.md                  | 90 ++++++++++++++++++++++++++++++++----------------
handoff/DECISIONS.md     |  3 ++
scripts/orchestrator.ts  | 56 ++++++++++++++++++++++++++----
src/sim/boons.ts         | 65 ++++++++++++++++++++++++++++++++--
src/sim/enemies.ts       | 29 ++++++++++++++--
tests/boons.test.ts      | 28 ++++++++++++---
tests/dungeonSim.test.ts | 22 ++++++++++--
tests/replay.test.ts     | 17 +++++++--
9 files changed, 307 insertions(+), 49 deletions(-)

+ 4 new fixture dirs under fixtures/dungeon-runs/ (redacted, raw/ gitignored)
+ fixtures/probe/roms/claim-{5345,689}-withAmount.json (both {"success":true})
```
