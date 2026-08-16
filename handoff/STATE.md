# STATE — session 17 — 2026-08-16 — commit PENDING

## Status
Task 12 "Potion timing": **GATE PASS (task CLOSED, no further stages).**
No new TASKS.md task was targeted otherwise — this session worked
session-17's `next.md` brief (extended sweep, craft probe, potion default,
fishing capture-loop hardening) plus two live user corrections mid-session.
Next per TASKS.md: Task 9 (live fishing) already reads GATE MET from prior
sessions; its one remaining loose end (the guard-trip root cause) is now
closed too — see below. No task is currently blocked on agent work; the
real fishing account is at 2/420 energy (regen 18/hr), which is what's
actually stopping further live action, not a task gate.
Overall: potion policy is now safer (user-gated, not free-inventory-scan)
and permanently simpler (crafting is the user's job, not the bot's
decision); the fishing account's 3-session-old stuck-state mystery
(QUESTIONS.md §10) is solved and wired into the live loop, not yet
exercised by the bot's own play.

## What works
- `potionTimingSweep.ts` extended to {0.5,0.6,0.7,0.8,0.9} × {1,2,3}
  potions (N=2000): 0.5 confirmed a genuine INTERIOR optimum (curve rises
  0.2→0.5, falls 0.5→0.9 at every loadout size) — not a boundary artifact
  of the prior {0.2,0.34,0.5} sweep. Best row: 3.474 ± 0.034 mean rooms
  cleared (0.5 threshold, 3 potions) vs. 2.112 ± 0.050 baseline.
- `config/bot.json`'s new `forbiddenWoods.potions: {allowedItemId,
  maxPerRun}` — required before `scripts/liveRun.ts` uses ANY potion;
  absent, loads 0. Verified live via `--dry-run`: read the config, read
  real Big Heal Juice balance, correctly capped the loadout at the
  configured `maxPerRun` (2, user's own choice via `AskUserQuestion`, not
  the sim's best-row 3).
- `action: "loot"` on `POST /fishing/action` — CONFIRMED live (user
  DevTools capture): resolves a catch's `cardsToAdd` offer, `data.cards:
  [<real card id>]` (NOT a hand-relative index, unlike `play_cards`,
  despite an identical envelope). Verified: `fullDeck` grew 10→11,
  account stopped rejecting `start_run`. Wired into
  `scripts/liveFishing.ts`'s `runOneCast` — fires automatically after any
  catch via new `chooseNewCard()` (argmax hit-power/mana).
- `scripts/liveFishing.ts`'s unknown-terminal-field dump (new
  `unknownDocKeys`) — caught `cardChosenId` (the real resolved/unresolved
  signal) on its very first live use, before the mechanism was even
  fully understood.
- One real live fishing cast this session (`--casts=1`): escaped after 2
  turns, 12 energy spent, confirmed the account genuinely unblocked.
- `npx tsc --noEmit` clean; `npx vitest run` 322/322 passed (was 315).

## What's broken
- The `loot` auto-resolution path is wired and unit-tested but has NOT
  been exercised end-to-end by the bot's OWN live play — no bot-driven
  catch happened this session (account energy hit 2/420 first). Real risk
  if untested: `chooseNewCard`'s output type or the envelope could still
  have a live-only bug the fixtures/mocks don't catch.
- Today's fishing casts are under-spent (13/15) — not a bug, just blocked
  by the account's real energy floor (2/420, regen 18/hr), unrelated to
  the bot's own 240/day self-imposed budget.

## Corrections to SPEC.md
- SPEC-fishing.md's catch-resolution blocker (open since session 15) is
  RESOLVED: `action: "loot"`, `data.cards: [<cardsToAdd[].id>]`. Full
  envelope and the hand-index-vs-id distinction now in SPEC-fishing.md's
  request section.
- `FishingBoardDataSchema` was missing `cardsToAdd`/`cardChosenId`
  entirely (silently passed through, untyped) — now declared.
- `scripts/liveFishing.ts`'s field allowlist was built only from the
  schema's DECLARED fields and undercounted the real wire shape by 16
  fields (`LEVEL_CID`, `data.day`/`week`, etc.) — corrected against the
  real captured fixture, not the schema.
- `GET /fishing/state`'s `fullDeck` length and `COMPLETE_CID`/
  `SUCCESS_CID` do NOT reliably distinguish "stuck" from "resolved" once
  ANY game has ever closed out on the account — `cardChosenId` (non-null)
  is the real signal. Found because a live `start_run` succeeded despite
  a read that looked identical to the known stuck state.
- `GET /offchain/player/energy`'s `maxEnergy` (420, `regenPerHour: 18`) is
  the account's real absolute energy ceiling, confirmed independent of
  `config/bot.json`'s `dailyEnergyBudget` (240, this bot's own policy).
  `isPlayerJuiced: true` on a dungeon run response is an account-level
  capability flag, not evidence the bot paid 3x energy — actual per-run
  cost tracked correctly as plain 20 both times checked.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT, hard-pruned.

## Dead ends
- Hunted for a crafting POST endpoint via a fresh `GET /offchain/static`
  dump (`scripts/probeCraftAction.ts`, new, read-only, kept) — found
  nothing beyond the already-known read-only recipe data. Turned out moot
  anyway once a direct user instruction put crafting permanently out of
  scope for automation mid-session.
- First cut of "potions default ON" auto-detected any Big Heal Juice in
  inventory with no config gate — not shipped; the user flagged the risk
  of unintended consumption before any run used it, superseded same
  session by the config-allowlist design.

## Metrics
- Sim (potion timing, N=2000): baseline 2.112 ± 0.050 mean rooms cleared;
  best row (0.5 threshold, 3 potions) 3.474 ± 0.034.
- Live fishing this session: 1 cast, escaped, 2 turns, 12 energy.
- Live dungeon this session: 0 runs (dry-run verification only).
- Guard budgets at session end: dungeon 40/240 energy, 2/12 runs; fishing
  60/200 energy, 5/15 casts. Real account energy: 2/420 (the actual
  binding constraint right now).
- Big Heal Juice balance: 3 → 45 mid-session (user crafted manually,
  consistent with this session's crafting-is-manual instruction).
- Tests: 315 → 322 passed, 0 skipped, 0 failed.

## Open questions for Claude
1. Verify the automated `loot` path fires correctly the next time the
   bot's own live play lands a catch — wired, unit-tested, not yet
   live-exercised. If it fails, the account will strand again exactly
   like sessions 15/16, so this is worth a dedicated check early next
   session once energy allows.
2. `chooseNewCard`'s argmax-hit-power/mana heuristic for picking among a
   catch's 3 new-card offers is an explicit placeholder — no
   deck-composition sim exists to judge whether grid coverage, miss
   penalty, or rarity matter more than raw damage/mana. Not urgent.
3. Today's fishing casts (13/15) and dungeon runs (2/12) are both
   under-spent purely because the account's real energy floor (2/420)
   binds tighter than either guard budget right now — resume live volume
   once energy regenerates (18/hr) or the user claims more; no other
   blocker remains on either surface.

## Files changed
```
16 files changed across 3 commits this session
+2 new: scripts/probeCraftAction.ts, fixtures/fishing-casts/live/cast-2026-08-16-16-18-37/

QUESTIONS.md, SPEC-fishing.md, TASKS.md, config/bot.json, handoff/DECISIONS.md,
scripts/liveFishing.ts, scripts/liveRun.ts, scripts/potionTimingSweep.ts,
scripts/probeCraftAction.ts (new), src/api/fishing.ts, src/orchestrator/config.ts,
src/sim/dungeonSim.ts, src/strategy/fishing/cardChoice.ts,
tests/fishing/cardChoice.test.ts, tests/liveFishing.test.ts,
fixtures/fishing-casts/live/cast-2026-08-16-16-18-37/ (3 files, new)

full stat: `git diff c0eb91e..HEAD --stat`
```
