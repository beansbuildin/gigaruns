# STATE — session 16 — 2026-08-16 — commit ed96644

## Status
Task 12 ("Potion timing"), Stage B: **GATE PASS.** next.md was stale (it was
session 15's already-executed brief — no session-16 brief existed), so per
the handoff skill's own instruction this session worked the next unblocked
task from TASKS.md/STATE.md's open questions rather than guessing. Picked
Stage B because it needed no permission and no blocked resource: the account
already held 8 Big Heal Juice (session 14), today's dungeon budget was
untouched, and using owned potions during normal play is explicitly fine per
CLAUDE.md ("playing dungeon runs... fine to do autonomously within budget").
Next per TASKS.md: fishing is still fully blocked (see below); dungeon-side,
Task 11's dungeon half stays PARKED (its revival conditions are unchanged),
so the next unblocked dungeon work is either Task 10 (orchestrator, never
started) or growing live volume under the now-working potion policy. The
crafting-energy-pool question (session 15) is UNCHANGED — not attempted,
since this session used existing stock rather than crafting.
Overall: Task 12 Stage B is genuinely done — sim timing model built, live
policy wired, two live runs both confirmed and then confirmed-again (after a
mid-session bug fix) the two previously-open mechanics. The fishing account
is still stuck and needs the user, not more agent guessing.

## What works
- **`dungeonSim.ts` models potion TIMING**, not just a pre-loaded upper
  bound — `SimOptions.potions: {heals, threshold}` fires a heal the instant
  own HP fraction crosses the threshold, checked once per exchange, threaded
  across rooms via a mutable queue. Verified: 5 new tests in
  `tests/dungeonSim.test.ts` (regression-matches the no-potions case exactly,
  never overheals past hpMax, deterministic, caps at loadout size, raises
  mean rooms cleared over baseline). `npx vitest run` — all pass.
- **`scripts/potionTimingSweep.ts`** (new) sweeps threshold {0.2, 0.34, 0.5}
  × loadout {1,2,3}, N=2000: threshold 0.5 (proactive) beats 0.2 (reactive)
  at every loadout size — waiting until critical risks a lethal exchange
  crossing the check point before it fires. Best row: 3.477 ± 0.034 mean
  rooms cleared (0.5 threshold, 3 potions) vs. 2.130 ± 0.051 baseline
  (+1.347). Corrects a real bug in the OLD `potionSweep.ts` (kept for the
  record): it modelled a heal as `hpMax += 20`, i.e. a permanent stat boost,
  not a heal.
- **`use_item` fires live and heals correctly** —
  `src/strategy/potions.ts`'s `shouldUsePotion` (pure) wired into
  `scripts/liveRun.ts` via `--potions=N --potion-threshold=X`: sends real
  Big Heal Juice in `consumables` at `start_run`, fires `use_item` mid-combat
  at the threshold. TWO live runs this session, verified by direct
  observation of before/after HP and by `npx tsc --noEmit`/`npx vitest run`
  (315 tests, 21 files, all pass — was 313/21 last session).
- **`--status` flags** (both `liveRun.ts`/`liveFishing.ts`) — confirmed
  clean at session start: dungeon 0/12 runs used, fishing 4/15 casts used
  (carried over from session 15, since the guard hadn't rolled to a new UTC
  date).

## What's broken
- **The fishing account is still stuck.** Re-checked read-only
  (`scripts/checkFishingStuck.ts`, new) at the top of this session:
  `GET /fishing/state` shows the exact same completed doc as session 15 left
  it (`docId 12925779`, `COMPLETE_CID`/`SUCCESS_CID` true, `fullDeck` length
  10, unmerged). Confirms this is a genuinely persistent stuck state, not
  transient. No new guesses attempted — CLAUDE.md's stuck protocol already
  used its two reasoned tries last session (`select_card`, `claim`, both
  cleanly rejected). Needs the user's own DevTools capture of a real catch's
  follow-up request (QUESTIONS.md §10) — nothing more to try blindly.
- **Task 12's crafting-energy-pool question is still open** (session 15):
  does crafting a NEW potion draw from the same 240/day energy pool as
  dungeon runs and fishing casts? Not attempted this session (used existing
  stock, not a craft). Still needs one live craft with a before/after
  `GET /offchain/player/energy` read, or a direct user answer.

## Corrections to SPEC.md
- **`use_item` action, previously `[VERIFY]`, is now `[CONFIRMED]`.** Same
  combat-style envelope as `rock`/`paper`/`scissor`; `data.itemId` is the
  item ID; `data.index` is **how many items from this run's committed
  `consumables` loadout have already been consumed** — NOT the item's
  stable ID, and NOT always 0. A loadout of `[131, 131]` needs `index: 0`
  for the first use, `index: 1` for the second — resending `index: 0` for
  the second use was rejected `HTTP 400 "Item not found in index"`.
- **`use_item` confirmed to cost NO combat turn** — a successful heal left
  the enemy's HP/ARM and the opponent model's observation count completely
  unchanged; no exchange resolved. A potion is a free action, not a
  substitute move.
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren nodeId="5" /
  pondId=2**.
- Move charges: unchanged, PRESENT, hard-pruned.

## Dead ends
- None new this session on the "guessing an unconfirmed value" front. The
  ONE parameter guess made (`index: 1` on the second `use_item`, after
  `index: 0` failed) was a reasoned single test on an already-confirmed
  action — succeeded immediately, not a dead end, but flagged here because
  it's the kind of thing CLAUDE.md §2 is watching for: one try, not a loop.

## Metrics
- Sim (potion timing, N=2000, ev-engine, real PLAYER baseline): 0-potion
  baseline 2.130 ± 0.051 mean rooms cleared; best row (0.5 threshold, 3
  potions) 3.477 ± 0.034 (+1.347).
- Live dungeon this session: 2 runs, 40 energy spent, 4 real Big Heal Juice
  consumed (balance 7→3). Run 1: rooms 1-3 cleared, died room 4. Run 2:
  rooms 1-2 cleared, died room 3. Both potions fired successfully in both
  runs (4/4 real `use_item` calls returned HTTP 200).
- Death-room histogram (`scripts/deathRooms.ts`, 15 confirmed deaths total,
  was 13): room 1 ×0, room 2 ×4, room 3 ×5, room 4 ×6 — still no room-1
  death, still consistent with enemy-scaling over cross-room HP
  mismanagement (Task 11, parked).
- Tests: 315 passed, 0 skipped, 0 failed (313 → 315).
- Fishing this session: 0 casts (account stuck before any could run).

## Open questions for Claude
1. **Does crafting a potion share the 240/day energy pool with dungeon runs
   and fishing casts?** Still the single open question from session 15 that
   decides whether committing more than the free stock is worth it. One
   live craft + a before/after energy read settles it — small enough to fit
   alongside other work, not a whole session's focus.
2. **The stuck fishing account still needs a real DevTools capture from the
   user.** Re-confirmed stuck this session, unchanged since session 15. Two
   reasoned guesses were already tried and rejected — no further blind
   guessing should be asked for; this is now purely a "ask the user for a
   HAR/request capture" item, not an agent task.
3. **Now that potion timing works live, is it worth committing to
   production runs by default?** The sim says yes (+1.347 rooms at 3
   potions/0.5 threshold), and it's now live-verified mechanically sound
   (2/2 runs, 4/4 heals landed). The only reason not to default it on is
   materials draw-down (Big Heal Juice now at 3, was 8 three sessions ago) —
   worth a session weighing whether to keep drawing down the free stock,
   start crafting (blocked on question 1), or throttle to fewer potions per
   run.

## Files changed
```
18 non-fixture files changed, 754 insertions(+), 26 deletions(-)
+5 new: scripts/checkFishingStuck.ts, scripts/potionTimingSweep.ts,
  scripts/probeUseItemIndex1.ts, src/strategy/potions.ts, tests/potions.test.ts
+146 fixture files (4 new live run captures, redacted)

CLAUDE.md                     |  11 +
QUESTIONS.md                  |  10 +
SPEC.md                       |  24 ++-
TASKS.md                      |  42 ++--
handoff/DECISIONS.md          |   3 +
scripts/liveRun.ts            | 110 ++++-
src/sim/boons.ts              |  41 ++
src/sim/dungeonSim.ts         |  55 +++
tests/*.test.ts (7 files)     | 313 ++++---

full stat: `git diff HEAD~1 HEAD --stat` (this commit)
```
