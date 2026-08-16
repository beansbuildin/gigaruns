# STATE — session 17 — 2026-08-16 — commit PENDING

## Status
Task 12 ("Potion timing") is now fully **CLOSED** — Stage C's threshold
extension confirmed 0.5 as a genuine interior optimum (not a boundary
artifact), and a direct mid-session user instruction ("all potion crafting
will be manually done by the player, only use in dungeon will be
automated") retires the crafting-energy-pool question outright rather than
answering it. A fresh `GET /offchain/static` dump (hunting for a craft
endpoint, since none was ever confirmed anywhere in this repo) had already
hit the same wall independently — no craft POST endpoint exists in that
payload, only the already-known read-only recipe data.

Potions now default ON in `scripts/liveRun.ts`, but **gated behind an
explicit user-set config allowlist**, not free inventory auto-detection —
my first cut auto-detected any Big Heal Juice in the wallet, and the user
directly flagged the risk ("verify before doing runs which potions you are
allowed to take... otherwise you might burn through my supply... without my
intent") before any run actually used it. Redesigned around
`config/bot.json`'s new `forbiddenWoods.potions` block
(`{allowedItemId, maxPerRun}`) — absent, the loop uses 0 potions, full
stop. Asked the user directly (not assumed) what `maxPerRun` should be;
answer was **2**, not the sim's theoretical-best 3, matching what was
actually live-tested in session 16.

**QUESTIONS.md §10 — open for three sessions — is RESOLVED.** The user did
a manual fishing run with DevTools open and captured the real
catch-resolution action: `loot`, `data.cards: [<real card id from
cardsToAdd, NOT a hand index>]`. Verified live (`fullDeck` grew 10→11,
account stopped rejecting `start_run`). Wired into `scripts/liveFishing.ts`
so the bot's own future catches resolve themselves automatically instead of
stranding the account — not yet exercised end-to-end by the bot's own play,
since account energy dropped to 2/420 (a real account-level floor, separate
from our own 240/day spending policy) before the fix landed. That's this
session's one clean carry-forward: confirm the automated `loot` path
actually fires correctly the next time the bot's own play lands a catch.

## What works
- **`potionTimingSweep.ts` extended to {0.5..0.9} × {1,2,3}** (N=2000):
  confirms 0.5 is a genuine interior optimum — the curve rises 0.2→0.5
  (prior sweep) and falls 0.5→0.9 (this session), at every loadout size.
  Best row unchanged in substance: 3.474 ± 0.034 mean rooms cleared (0.5
  threshold, 3 potions) vs. 2.112 ± 0.050 baseline.
- **`config/bot.json`'s `forbiddenWoods.potions` allowlist** (new,
  `src/orchestrator/config.ts` schema) — `{allowedItemId: 131, maxPerRun:
  2}`, user's explicit choice via `AskUserQuestion`. `scripts/liveRun.ts`
  reads this before every run, prints the authorized item/cap and the live
  balance, loads `min(config.maxPerRun, MAX_POTIONS_PER_RUN=3, balance)`.
  Verified live via `--dry-run`. `--potions=N` CLI override still works
  but is pinned to the config-allowed item id, can't smuggle in an
  unauthorized item.
- **`scripts/liveFishing.ts`'s unknown-terminal-field dump** (new,
  `unknownDocKeys`/`KNOWN_DOC_DATA_KEYS`/`KNOWN_DOC_TOP_KEYS`/
  `dumpUnknownTerminal`) — checks both the pre-`start_run` existing-doc
  read and every `play_cards` terminal response against a hand-maintained
  allowlist, writes a loudly-named `logs/fishing-unknown-terminal-
  <stamp>.json` the moment something outside it appears. Immediately
  useful: caught `cardChosenId` on the account's old doc mid-session,
  which turned out to be the actual "is this catch resolved" signal.
- **`action: "loot"` CONFIRMED** (QUESTIONS.md §10, three sessions open) —
  user-captured real payload, `data.cards` addresses a card by its real id
  from `cardsToAdd[].id`, the OPPOSITE of `play_cards`'s hand-index
  convention despite an identical envelope shape. Added to
  `FishingActionSchema`/`FishingBoardDataSchema` (`cardsToAdd`,
  `cardChosenId` now typed). `runOneCast` sends it automatically after any
  catch via new `chooseNewCard()` (`src/strategy/fishing/cardChoice.ts`,
  argmax hit-power/mana — an explicit placeholder heuristic, not
  sim-validated against deck-composition value).
- **Live-confirmed: the fishing account is genuinely unblocked** and stays
  that way now that `loot` is wired — one real bot-driven cast this
  session (`--casts=1`) succeeded end to end (escaped, 2 turns).
- **`GET /fishing/state`'s `fullDeck` length / `COMPLETE_CID`/
  `SUCCESS_CID` are NOT reliable "still stuck" signals** once any game has
  ever been resolved on the account — a real surprise mid-session
  (`checkFishingStuck.ts` showed what looked exactly like session 16's
  stuck doc, yet a real `start_run` succeeded immediately after).
  `cardChosenId` is the real signal.
- **`GET /offchain/player/energy`'s `maxEnergy` (420, `regenPerHour: 18`)
  is the account's real absolute energy ceiling**, confirmed completely
  independent of `config/bot.json`'s `dailyEnergyBudget` (240) — the
  latter is purely this bot's own spending policy. Also clarifies
  `isPlayerJuiced: true` on dungeon runs sent with `isJuiced:false`: an
  account-level capability flag, not evidence of accidentally paying 3x
  (both runs correctly cost the plain 20 energy).
- **All 322 tests pass** (315 → 322), `npx tsc --noEmit` clean.

## What's broken / paused
- The `loot` auto-resolution path is wired and typechecks/tests clean, but
  has NOT been exercised end-to-end by the bot's own live play — account
  energy hit 2/420 before a bot-driven catch happened this session. First
  thing to verify next time energy allows a live cast.
- Today's fishing casts are under-spent relative to budget (13/15 used
  including this session's 1) — the account's real energy floor (2/420),
  not the bot's own daily policy, is what's actually blocking further live
  action right now.

## Corrections to SPEC.md / this repo's own assumptions
- `SPEC-fishing.md`'s catch-resolution blocker is RESOLVED — see `action:
  "loot"` above, full detail in SPEC-fishing.md's request-envelope section.
- `scripts/liveFishing.ts`'s known-field allowlist needed 16 more real
  fields than `FishingBoardDataSchema` originally declared (`LEVEL_CID`,
  `ID_CID`, `PLAYER_CID`, `FACTION_CID`, `GEAR_CID_array`, `DAY_CID`,
  `_id`, `createdAt`, `updatedAt`, `__v` at top level; `jebaitorTriggered`,
  `consumablesUsed`, `fishingConsumableSlotUsed`,
  `fintuitionOilBoostPercent`, `dualYieldOilBoostPercent`, `day`, `week`
  under `data`) — the schema's own `.passthrough()` already carried these,
  they just weren't typed or accounted for anywhere.
- Potion crafting is now explicitly, permanently OUT OF SCOPE for
  automation (user directive) — any future task referencing "crafting
  economics" as a bot decision is stale; it's the user's manual job.

## Dead ends
- Hunting for a crafting POST endpoint via a fresh `GET /offchain/static`
  dump (`scripts/probeCraftAction.ts`, new, read-only, kept) — found
  nothing beyond the already-known read-only recipe data. Not wasted: this
  is exactly CLAUDE.md §2's prescribed move, and the negative result
  turned out to be moot anyway once crafting was declared out of scope.
- First cut of "potions default ON" (free inventory auto-detection, no
  config gate) — not shipped as final; superseded within the same session
  by the user's direct safety correction. See DECISIONS.md for both.

## Metrics
- Sim (potion timing, extended sweep, N=2000): baseline 2.112 ± 0.050;
  best row (0.5 threshold, 3 potions) 3.474 ± 0.034 — confirmed as an
  interior optimum rather than a boundary artifact.
- Live fishing this session: 1 real cast (escaped, 2 turns, 12 energy).
  Guard budget: dungeon 40/240 energy, 2/12 runs (session 16 carryover,
  unchanged); fishing 60/200 energy, 5/15 casts. Real account energy at
  session end: 2/420 (the actual current constraint, not the bot's policy
  caps).
- Big Heal Juice balance: 3 → 45 mid-session — user crafting manually,
  consistent with this session's own crafting-is-manual instruction
  landing around the same time.
- Tests: 315 → 322 passed, 0 skipped, 0 failed.

## Open questions for Claude
1. **Verify the automated `loot` path live the next time the bot's own
   play lands a catch** — wired and unit-tested, not yet live-exercised.
2. **Today's fishing casts are under-spent (13/15).** Real blocker now is
   account energy (2/420, regen 18/hour), not guard budget — resume once
   energy allows, no other blocker remains.
3. **`chooseNewCard`'s argmax-hit-power/mana heuristic is a placeholder.**
   Worth a real sim-based deck-composition analysis eventually (does grid
   coverage / miss penalty / rarity matter more than raw damage?), not
   urgent — the mechanism working at all was the session's actual goal.

## Files changed
```
15 files changed (session total, both commits)
+2 new: scripts/probeCraftAction.ts, fixtures/fishing-casts/live/cast-2026-08-16-16-18-37/

QUESTIONS.md, TASKS.md, SPEC-fishing.md, config/bot.json, handoff/DECISIONS.md,
scripts/liveFishing.ts, scripts/liveRun.ts, scripts/potionTimingSweep.ts,
scripts/probeCraftAction.ts (new), src/api/fishing.ts, src/orchestrator/config.ts,
src/sim/dungeonSim.ts, src/strategy/fishing/cardChoice.ts,
tests/fishing/cardChoice.test.ts, tests/liveFishing.test.ts

full stat: `git diff HEAD~2 HEAD --stat` (after this commit)
```
