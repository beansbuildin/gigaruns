# STATE — session 17 — 2026-08-16 — commit PENDING

## Status
Task 12 "Potion timing": **GATE PASS (task CLOSED, no further stages).**
Off-brief but resolved this session: QUESTIONS.md §10 (fishing
catch-resolution action, open since session 15) — RESOLVED. After the
first recap, the user separately asked the bot to take over and complete
an already-active dungeon run (started outside this session) — done, and
it produced the first live confirmation that the potion policy also works
correctly on a RESUMED run, not just one the bot itself starts.
Next per TASKS.md: Task 9 (live fishing) already read GATE MET from prior
sessions; its one remaining loose end (the account-stranding root cause)
is closed too. No task is currently blocked on agent work.
Overall: potion policy is safer (user-gated via config, not a free
inventory scan) and simpler (crafting is the user's manual job now, not a
bot decision); the fishing account's 3-session-old stuck-state mystery is
solved and live-verified end-to-end on the bot's own automated path is
still the top open item; one additional live dungeon run this session
died at room 4, rooms 1-3 cleared, both potions fired correctly on a
resumed run.

## What works
- `potionTimingSweep.ts` extended to {0.5,0.6,0.7,0.8,0.9} × {1,2,3}
  potions (N=2000): 0.5 confirmed a genuine INTERIOR optimum (curve rises
  0.2→0.5, falls 0.5→0.9 at every loadout size). Best row: 3.474 ± 0.034
  mean rooms cleared vs. 2.112 ± 0.050 baseline.
- `config/bot.json`'s `forbiddenWoods.potions: {allowedItemId,
  maxPerRun}` — required before `scripts/liveRun.ts` uses ANY potion;
  absent, loads 0. User's explicit choice: itemId 131 (Big Heal Juice),
  maxPerRun 2. Verified live twice this session: once via `--dry-run`,
  once for real on a resumed run (see below) — both potions fired at the
  correct incrementing `use_item` index with no rejection.
- `action: "loot"` on `POST /fishing/action` — CONFIRMED live via a
  user DevTools capture: resolves a catch's `cardsToAdd` offer,
  `data.cards: [<real card id>]` (NOT a hand-relative index, unlike
  `play_cards`, despite an identical envelope). Verified: `fullDeck` grew
  10→11, account stopped rejecting `start_run`. Wired into
  `scripts/liveFishing.ts`'s `runOneCast` — fires automatically after any
  catch via new `chooseNewCard()` (argmax hit-power/mana, an explicit
  placeholder heuristic).
- One real live fishing cast (`--casts=1`): escaped after 2 turns, 12
  energy, confirmed the account genuinely unblocked.
- **Took over and completed an already-active dungeon run** (started
  outside this session, room 1, 2 Big Heal Juice pre-committed): resumed
  via `scripts/liveRun.ts --runs=1`, played through rooms 1-3 (boons
  AddBlock/AddTenacity/AddLuck), both potions fired correctly at HP
  thresholds, died room 4 vs. Enemy Room 66. Confirms the potion policy's
  `remaining/used` state seeded fresh in `main()` is safe to assume even
  when RESUMING a run the bot didn't start itself. Resuming cost zero
  additional energy (before/after delta 0, aside from natural regen).
- `npx tsc --noEmit` clean; `npx vitest run` 322/322 passed (was 315 at
  session start).

## What's broken
- The `loot` auto-resolution path is wired and unit-tested but has NOT
  been exercised end-to-end by the bot's OWN live play — no bot-driven
  catch happened this session (account fishing-energy hit 2/420 before
  one could occur). This is the single most important thing to verify
  next: if it has a live-only bug the mocks don't catch, the account will
  strand again exactly like sessions 15/16.
- Today's fishing casts remain under-spent (5/15 used) — blocked by the
  account's real energy floor at the time, not a code or guard issue.

## Corrections to SPEC.md
- SPEC-fishing.md's catch-resolution blocker (open since session 15) is
  RESOLVED: `action: "loot"`, `data.cards: [<cardsToAdd[].id>]`. Full
  envelope now documented in SPEC-fishing.md's request section.
- `FishingBoardDataSchema` was missing `cardsToAdd`/`cardChosenId`
  entirely (silently passed through, untyped) — now declared.
- `GET /fishing/state`'s `fullDeck` length and `COMPLETE_CID`/
  `SUCCESS_CID` do NOT reliably distinguish "stuck" from "resolved" once
  ANY game has ever closed out on the account — `cardChosenId` (non-null)
  is the real signal.
- `GET /offchain/player/energy`'s `maxEnergy` (420, `regenPerHour: 18`) is
  the account's real absolute energy ceiling, confirmed independent of
  `config/bot.json`'s `dailyEnergyBudget` (240, this bot's own policy).
  `isPlayerJuiced: true` on a dungeon response is an account-level
  capability flag, not evidence the bot paid 3x — actual per-run cost
  tracked correctly as plain 20 every time checked.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT, hard-pruned.

## Dead ends
- Hunted for a crafting POST endpoint via a fresh `GET /offchain/static`
  dump (`scripts/probeCraftAction.ts`, new, read-only, kept) — found
  nothing beyond the already-known read-only recipe data. Moot anyway:
  the user put crafting permanently out of scope for automation
  mid-session.
- First cut of "potions default ON" auto-detected any Big Heal Juice in
  inventory with no config gate — not shipped; the user flagged the risk
  of unintended consumption before any run used it, superseded same
  session by the config-allowlist design.

## Metrics
- Sim (potion timing, N=2000): baseline 2.112 ± 0.050 mean rooms cleared;
  best row (0.5 threshold, 3 potions) 3.474 ± 0.034.
- Live dungeon this session: 1 run completed (a resumed, not
  bot-started, run) — rooms 1-3 cleared, died room 4, 2/2 potions fired
  correctly. Death-room histogram: 16 confirmed deaths total,
  0/4/5/7 across rooms 1-4 (was 0/4/5/6) — still zero room-1 deaths.
- Live fishing this session: 1 cast, escaped, 2 turns, 12 energy.
- Guard budgets at session end: dungeon 40/240 energy, 2/12 runs
  (resuming a run costs neither); fishing 60/200 energy, 5/15 casts.
- Big Heal Juice balance: 3 → 45 → 80 over the course of the session
  (user crafting manually, consistent with the crafting-is-manual
  instruction given mid-session).
- Tests: 315 → 322 passed, 0 skipped, 0 failed.

## Open questions for Claude
1. Verify the automated `loot` path fires correctly the next time the
   bot's own live play lands a catch — wired, unit-tested, not yet
   live-exercised. Top priority for the next session's opening move.
2. `chooseNewCard`'s argmax-hit-power/mana heuristic for picking among a
   catch's 3 new-card offers is an explicit placeholder — no
   deck-composition sim exists yet. Not urgent.
3. Death-room histogram (0/4/5/7, n=16) still shows zero room-1 deaths
   and an even-ish spread across rooms 2-4 — consistent with Task 11's
   parked "enemy-scaling, not cross-room HP mismanagement" finding. Still
   thin data (one more room-4 death this session); worth revisiting the
   parking decision only if a much larger sample shifts the shape.

## Files changed
```
$ git diff c0eb91e..HEAD --stat
89 files changed, 39382 insertions(+), 172 deletions(-)
(bulk is fixture captures: 3 fishing-cast dirs + 2 dungeon-run dirs, all
redacted 0xUSER/<USER>/<JWT>)

Non-fixture files:
QUESTIONS.md, SPEC-fishing.md, TASKS.md, config/bot.json,
handoff/DECISIONS.md, handoff/STATE.md, handoff/log/session-17.md,
scripts/liveFishing.ts, scripts/liveRun.ts, scripts/potionTimingSweep.ts,
scripts/probeCraftAction.ts (new), src/api/fishing.ts,
src/orchestrator/config.ts, src/sim/dungeonSim.ts,
src/strategy/fishing/cardChoice.ts, tests/fishing/cardChoice.test.ts,
tests/liveFishing.test.ts
```
