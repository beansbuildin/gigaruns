# STATE — session 43 — 2026-08-18 — commit 38fd190

## Status
Task 14 "Bot-initiated juiced `start_run`, with per-mode potion equip":
**GATE MET.** Two bot-initiated juiced Tier-3 `start_run` calls were sent by
this project's own process (not resumes) under the user's standing
authorization (session-43 brief §0), both closing the gate's two conditions
exactly (3x reward, `dayProgressEntities` +3) — see Metrics. §2 (dungeon
loot-pick priority: Sword-upgrade pin + 15%-overflow Heal gate) and §3
(fishing strategy heuristics) are both **DONE**, code + tests + SPEC/
DECISIONS updates, all three committed separately.
Next per TASKS.md: no numbered task is ready to start cleanly. Task 13
stays capture-blocked (needs more real fishing card choices). Task 11 stays
parked. The new fishing oil-reserve heuristic (§3c) is blocked on an
unconfirmed oil-use action shape (QUESTIONS.md §16) — needs a DevTools
capture, not code.

## What works
- **Task 14's gate MET, live-verified, not assumed:** run 1 —
  `dayProgressEntities` for Dungeon#5 moved 6→9 (+3 exactly), first-kill
  `gameItemBalanceChanges` carried three duplicate `{id:846, amount:5}`
  entries (15 total, matching the user's 5→15 reference), died room 6, HP
  0/40. Run 2 (after the user's manual level-up, brief §1) — `dayProgressEntities`
  moved 9→12 (+3 exactly, exhausting today's 12-run juiced cap), same 3x
  pattern (5,9,14,19,25 progression, byte-identical to run 1 and to session
  42's resumed runs), died room 5, HP 0/40. Both numbers matched the gate's
  terms exactly on both runs — nothing rounded up.
- `UpgradePaper` gets its first-ever pickup pair (run 2, room 4, ATK-variant
  roll: `selectedVal1` 8/`selectedVal2` 0 → paper ATK 6→14, DEF unchanged) —
  modelled `{kind:"moveDelta", move:"paper"}`, `contaminates: []`. All three
  `Upgrade*` types are now modelled and clean; this retroactively cleans 8
  already-recorded room-1 `UpgradePaper` offers (same mechanic as
  `AddMaxArmor`, session 11). See `src/sim/boons.ts`.
- PLAYER's hpMax moved 38→40 (armorMax/moves unchanged) — the level-up
  landed before this session's run 1 even started (both runs' own
  state-000 already read 40), not between the two runs as the brief
  planned; recorded honestly rather than folded into the assumed
  narrative. See `src/sim/enemies.ts`'s PLAYER doc.
- `src/strategy/loot.ts`: `UpgradeRock` (Sword) now wins whenever offered
  (hard tier-separation bonus, `SWORD_PIN_BONUS`, not a bigger multiplier —
  cannot be outscored by a big pool offer). Heal is now gated:
  `hpCurrent < hpMax && wasted <= 0.15 * healAmount`, else scores 0 and
  falls through. Both are user directives (2026-08-18), SPEC.md §4c updated.
- `src/strategy/fishing/heuristics.ts` (new): four user-sourced heuristics
  implemented as tested pure functions — center-bias tie-break
  (`isCentralSquare`), prune-return-to-previous-cell after a 1-cell move
  (`pruneReturnToPrevious`), an edge position's narrower candidate-cell
  count (`candidateCellCount`, geometric claim only), coverage-maximizing
  card/focus tie-break (`coverageCount`). Wired into `cardChoice.ts`'s
  `bestFocusForCard`/`chooseCard` (as tie-breaks, never overriding real EV)
  and `scripts/liveFishing.ts`'s distribution pipeline (prune skipped under
  the `nextPosition` override). `src/strategy/fishing/oilPolicy.ts` (new):
  the oil-reserve heuristic as a documented recommendation function, not
  wired to any live action (see Open questions).
- Opportunistic finding: "Mid Relaxing Oil" (itemId 937) is a direct
  fish-damage consumable (`FishingDamageFish` +2), not the calming/mana
  effect its name suggests — "Mid Mana Oil" (939) is the real restore-mana
  item. Matches the user's own stated use case for Relaxing Oil exactly.
  See SPEC-fishing.md §4a addendum.
- Two new unmodelled boon type sightings: `CritHeal`, `LossLuckUp`.
- Tests: **629/629 passing** (595 baseline + 34 new). `npx tsc --noEmit`
  clean, `git diff --check` clean, both re-checked at this session's actual
  final commit (38fd190), not a mid-session snapshot.

## What's broken
Nothing shipped this session broke anything — full suite green, tsc clean,
at the actual final commit. Unchanged standing items: room 6 (Enemy Room
68) still has never been offered at Safe tier live — reinforced this
session (n=2 offers now, both non-Safe, run 1's own room-6 entry). Scheduler
can't learn energy gained outside its own tracking; a SIGINT during an
energy-regen sleep ends the whole session (unchanged since session 25).
Charge-reserve plateau (unchanged since session 40).

## Corrections to SPEC.md
- §4c: Heal is now gated (≤15% overflow) instead of unconditional-below-max;
  `UpgradeRock` is pinned ahead of the play-share inference. Both dated
  2026-08-18, user directive.
- No corrections to confirmed wire shapes this session — Task 14's envelope
  shape (session 42) held byte-for-byte across both live sends.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged).

## Dead ends
None. Both bot-initiated runs completed (not abandoned, both deaths were
the expected outcome of a played-to-completion run), all three brief items
landed as scoped.

## Metrics
Live: 2 bot-initiated juiced Tier-3 dungeon runs (Task 14), rooms 1-6 and
1-5, both died. 120 energy spent (60 each), 6 run-units (3 each) — today's
real juiced cap for Dungeon#5 (12) now fully exhausted. Corpus grew to 51
total recorded dungeon attempts (49 + 2). No fishing casts sent this
session (§3 was code + doc only, no live cast). No sim runs this session.

## Open questions for Claude
1. **Fishing oil-use action shape is unconfirmed** (QUESTIONS.md §16) —
   blocks wiring `oilPolicy.ts`'s recommendation into a real action. Needs
   a DevTools capture of the real client using any fishing oil mid-cast,
   same method as `reward_one`/`path_two`/`loot` were each confirmed.
2. **Room 6 still has no Safe-tier capture** — now n=2 offers, both
   non-Safe (`{Dangerous, Dangerous, Risky}` pattern repeating). Not
   blocking anything, just still open.
3. **None of session 43's four implemented fishing heuristics (a/d/e/f)
   are corpus-validated** — stated explicitly in SPEC-fishing.md §8, not
   left implicit. Worth auditing `data/fish-patterns.jsonl` for a real
   1-cell-move-then-reversal counterexample to heuristic (d) once there's
   time — that's the one with a real chance of being wrong outright.
4. Standing from session 40/41: scheduler energy-tracking gap,
   SIGINT-during-sleep behavior, charge-reserve plateau — none addressed,
   none urgent.

## Files changed
```
 QUESTIONS.md                       |  27 +++++++
 SPEC-fishing.md                    | 131 ++++++++++++++++++++++++++++++
 SPEC.md                            |  40 ++++++---
 TASKS.md                           |  61 ++++++++++++++
 config/bot.json                    |   2 +-
 handoff/DECISIONS.md               |   6 ++
 handoff/reports/*.md               |  14 +--
 scripts/liveFishing.ts             |  32 +++++---
 src/sim/boons.ts                   |  82 ++++++++++++++++++-
 src/sim/enemies.ts                 |  20 ++++-
 src/strategy/fishing/cardChoice.ts |  64 ++++++++++++---
 src/strategy/fishing/heuristics.ts | 138 (new)
 src/strategy/fishing/oilPolicy.ts  |  74 (new)
 src/strategy/loot.ts               | 109 ++++++++++++++++++++-----
 tests/*.test.ts                    | ~475 (boons/dungeonSim/enemies/
                                        strategy/fishing — 34 new tests)
 22 non-fixture files changed, 1194 insertions(+), 81 deletions(-)
 + fixtures/dungeon-runs/run-2026-08-18-{22-00-28,22-07-14}/ (164 files,
   85 + 79 states, this session's two bot-initiated runs)
```
