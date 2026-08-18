# STATE — session 42 — 2026-08-18 — commit fdd1e69

## Status
Task "Resume and complete the live juiced Tier-3 run" (session-42 brief §0):
**DONE**. A SECOND live run (Tier-2, silver rings, user-initiated mid-session
after the recap) was also resumed and completed at the user's direct request
— also **DONE**. Task 14 "Bot-initiated juiced `start_run`, with per-mode
potion equip" (brief §1/§2): **CODE DONE, GATE NOT MET** — both pieces
(envelope builder, `--juiced` CLI flag) are implemented and tested, but the
gate specifically asks for a **bot-initiated** juiced `start_run`; both live
runs this session were resumes of runs the user started manually, never a
fresh juiced `start_run` sent by this process. Task 14's `index == tier`
open question IS now settled (see below) — a real, unplanned finding from
the second run.
Next per TASKS.md: no numbered task is ready to start cleanly. Task 14 needs
one bot-initiated juiced `start_run` attempt (real energy/run-slot cost,
needs explicit authorization) to actually close its gate. Task 13 stays
capture-blocked. Task 11 stays parked.

## What works
- Two live juiced runs resumed and played to completion: run 1 (Tier-3, gold
  rings) died room 7, HP 0/43 — the deepest death this corpus has recorded.
  Run 2 (Tier-2, silver rings) died room 6, HP 0/38. Logs
  `logs/run-2026-08-18-{19-50-13,21-15-24}.jsonl`, fixtures
  `fixtures/dungeon-runs/run-2026-08-18-{19-50-14,21-15-25}/` (123 + 93
  states).
- **Juiced reward multiplier CONFIRMED 3x on BOTH runs, mechanism now
  known**: item 846 ("Dendren Root") is credited via THREE duplicate
  `gameItemBalanceChanges` entries of the base amount (not one tripled
  entry). Base per-room amounts were byte-for-byte identical across both
  runs (5,9,14,19,25...) regardless of entry tier — `entryData`'s own
  `dropMultiplier` (2 for Tier-2, 4 for Tier-3) does NOT visibly affect this
  specific reward channel. One observation per tier, not a settled finding.
  See SPEC.md §3f.
- `dayProgressEntities` for Dungeon#5 moved 3→6 at the SECOND run's
  `start_run` (read before/after) — a third independent confirmation of the
  +3-at-juiced-start mechanism (session 23's original 3→6, plus this
  session's two reads).
- **`start_run`'s `data.index` field IS `entryData`'s `tier` — CONFIRMED.**
  The user provided a second capture (Tier-2 juiced start, `index: 2`),
  which combined with this session's own Tier-3 capture (`index: 3`) proves
  `index` selects the entry tier independently of `isJuiced`. Also
  identified: `entryData`'s two gated tiers are literally the user's
  "silver rings" (items 134–140, Tier 2) and "gold rings" (items 243–249,
  Tier 3) — confirmed by name against `GET /offchain/static`'s catalog.
  This was already in `config/discovered.json`/SPEC.md §3c since session 03
  but had never been connected to `start_run`'s `index` field before this
  session. See SPEC.md §3c and TASKS.md Task 14.
- `buildJuicedStartRunEnvelope(dungeonId, index, consumables)`
  (`scripts/liveRun.ts`) — pinned against the exact captured JSON. Wired
  into the `start_run` call site behind `deps.juicedStartRun`, only set
  when `--juiced` is passed; the ordinary `buildEnvelope` path is
  byte-for-byte unchanged for every plain start.
- `--juiced` + `--juiced-index=N` CLI flags — fail-closed like `--potions=N`.
  Potion auto-loading (config-auto-detect branch AND `startConsumables` on a
  new start) is now gated behind `--juiced`. Explicit `--potions=N` still
  works without `--juiced` — needed for, and confirmed working twice by,
  `--resume-existing`.
- **Real correctness gap found and fixed**: `GuardState.assertCanStartRun`/
  `recordRunStarted` hardcoded 1 run-unit per start; a juiced run consumes
  3. Both now take an optional `runUnits` param (default 1, every existing
  call site unaffected).
- `ROOM_ENEMIES` gained first-ever room-6 (RISKY_TIER only — no Safe offer
  exists yet) and room-7 (clean SAFE_TIER) captures. `ArmorDepletedWeak`
  boon modelled (`{kind:"latent"}`, first pickup pair, run 2 room 2).
- Tests: **586/586 passing** (561 baseline + 25 new). `npx tsc --noEmit`
  clean, `git diff --check` clean, both at this session's final commit.

## What's broken
Nothing shipped this session broke anything — full suite green, tsc clean,
at the actual final commit. A default Safe-tier `simulateRun` walk halts at
room 6 with `NO_TIER_CAPTURE` (not `DEPTH_BEYOND_CORPUS`) — a real capture
gap (room 6 has never been offered at Safe tier live), not a regression.
Unchanged since session 25: scheduler can't learn energy gained outside its
own tracking; a SIGINT during an energy-regen sleep ends the whole session.
Unchanged since session 40: charge-reserve plateau.

## Corrections to SPEC.md
- §3c: `start_run`'s `data.index` field is now documented as `entryData`'s
  `tier`, with the silver/gold ring item ids named — previously undocumented
  connection between two already-known-separately facts.
- §3f: added the juiced-run 3x-crediting mechanism (three duplicate entries
  of the base amount) — confirmed live across two runs at two different
  entry tiers.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged).

## Dead ends
None. Both live runs were completed, not abandoned; both planned Task 14
code pieces landed as scoped.

## Metrics
No sim runs this session. Live: 2 dungeon runs (both resumed, both juiced —
Tier-3 then Tier-2), rooms 1-7 and 1-6, both died. 0 energy newly committed
by this session's own invocations (both runs' 60 energy was already spent
by the user before each resume). Corpus grew to 49 total recorded dungeon
attempts.

## Open questions for Claude
1. **Task 14's actual gate still needs a bot-initiated juiced `start_run`**
   — the code is ready and tested (`--juiced --juiced-index=N
   --potions=N`), but nobody has actually run it live yet. Needs explicit
   authorization for a fresh 60-energy/3-run-unit spend; check
   `GET /game/dungeon/today` fresh first — the account's real daily run
   count is at least 6/12 after this session's two resumes.
2. **UNRESOLVED, flagged not guessed**: `PLAYER`'s move stats changed
   substantially between the session's two manually-started runs (~90 min
   apart, both zero-picked-boons at capture) — rock (Sword) ATK 16→26/DEF
   0→9 gained a boost, scissor (Spell) lost its ATK/DEF boost entirely
   (18/15→12/8). Either an ordinary gear re-spec between the two manual
   starts, or something tied to entry tier itself (Tier 3 vs Tier 2) —
   genuinely can't tell from this session's data. Needs the user to confirm
   whether they changed equipped gear between starting the two runs.
3. **`entryData`'s `dropMultiplier` (2 vs 4) does not visibly stack with
   the juiced 3x** on the one reward channel checked (item 846 credits) —
   base amounts were identical at both entry tiers. One observation per
   tier; worth checking a THIRD reward channel (e.g. Hard Core/item 845,
   which showed single non-tripled entries on both runs — also unexplained)
   if this matters for economic planning.
4. New capture gap: room 6 (Enemy Room 68) has never been offered at Safe
   tier live — only `{Dangerous, Dangerous, Risky}` so far, n=1 offer.
5. Standing from session 40/41: scheduler energy-tracking gap,
   SIGINT-during-sleep behavior, charge-reserve plateau — none addressed,
   none urgent.

## Files changed
```
 SPEC.md                          |  49 ++++++++++++++++++++++
 TASKS.md                         |  77 +++++++++++++++++++++++++++++++++++
 config/bot.json                  |   2 +-
 handoff/DECISIONS.md             |  10 +++++
 handoff/reports/dungeon-runs.md  |  13 +++---
 handoff/reports/fishing-casts.md |   2 +-
 scripts/liveRun.ts               | 137 ++++++++++++++++++++++++++++++++++++---
 src/orchestrator/guards.ts       |  22 +++++--
 src/sim/boons.ts                 |  88 +++++++++++++++++++++++++++++++++++++
 src/sim/enemies.ts               |  93 +++++++++++++++++++++++++++++++++++---
 src/sim/scenarios.ts             |   7 +++-
 tests/boons.test.ts              |  29 +++++++++---
 tests/combat.test.ts             |  25 ++++++----
 tests/dungeonSim.test.ts         |  20 ++++--
 tests/enemies.test.ts            |  14 +++++-
 tests/guards.test.ts             |  22 +++++++
 tests/liveRun.test.ts            | 130 +++++++++++++++++++++++++++++++++++++
 tests/strategy.test.ts           |  10 +++--
 18 files changed, ~750 insertions(+), ~90 deletions(-)
 + scripts/checkDungeonToday.ts (new, read-only dayProgressEntities helper)
 + fixtures/dungeon-runs/run-2026-08-18-19-50-14/ (new, 123 states, run 1)
 + fixtures/dungeon-runs/run-2026-08-18-21-15-25/ (new, 93 states, run 2)
```
