# STATE — session 17 — 2026-08-16 — commit 3e7f0d4

## Status
Task 12 ("Potion timing") is now fully **CLOSED** — Stage C's threshold
extension confirmed 0.5 as a genuine interior optimum (not a boundary
artifact), and a direct mid-session user instruction ("all potion crafting
will be manually done by the player, only use in dungeon will be
automated") retires the crafting-energy-pool question outright rather than
answering it. This landed just before a fresh `GET /offchain/static` dump
(hunting for a craft endpoint, since none was ever confirmed anywhere in
this repo) would have hit the same wall anyway — no craft POST endpoint
exists in that payload, only the already-known read-only recipe data.

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
actually live-tested in session 16. This is genuinely a different, safer
design than what I'd have shipped without the correction — see
DECISIONS.md for both the superseded and final versions.

Fishing: confirmed LIVE (not just via a stale-looking `GET /fishing/state`
read) that the account is unblocked — one real cast this session
(`--casts=1`) went through cleanly, escaped after 2 turns. The new
unknown-terminal-field dump (session-17 brief §4) immediately proved its
worth on the very first real response: it caught `cardChosenId: 23` on the
account's old completed doc, which is the field that flips a "stuck"
doc to "resolved" — genuinely new information toward QUESTIONS.md §10,
though the actual action name that SETS it is still uncaptured. **Paused
here mid-session**: the user offered to do a manual fishing run with
DevTools open specifically to capture that action, which is worth more
than more automated casts right now — didn't want to race the same account
from two directions. Today's remaining fishing casts (budget: 12/15 used
before this session; +1 this session = 13/15) are NOT yet spent — next
session's first move if the user's capture didn't land, or if it did,
wiring the newly-confirmed action in is the first move instead.

## What works
- **`potionTimingSweep.ts` extended to {0.5..0.9} × {1,2,3}** (N=2000):
  confirms 0.5 is a genuine interior optimum — the curve rises 0.2→0.5
  (prior sweep) and falls 0.5→0.9 (this session), at every loadout size.
  Best row unchanged in substance: 3.474 ± 0.034 mean rooms cleared (0.5
  threshold, 3 potions) vs. 2.112 ± 0.050 baseline. No config change needed
  — `DEFAULT_POTION_THRESHOLD` was already 0.5.
- **`config/bot.json`'s `forbiddenWoods.potions` allowlist** (new,
  `src/orchestrator/config.ts` schema) — `{allowedItemId: 131, maxPerRun:
  2}`, user's explicit choice via `AskUserQuestion`. `scripts/liveRun.ts`
  reads this before every run, prints the authorized item/cap and the live
  balance, loads `min(config.maxPerRun, MAX_POTIONS_PER_RUN=3, balance)`.
  Verified live via `--dry-run`: correctly read config, correctly read a
  real (surprising — see below) balance of 45, correctly capped at 2.
  `--potions=N` CLI override still works but is pinned to the
  config-allowed item id, can't smuggle in an unauthorized item.
- **`scripts/liveFishing.ts`'s unknown-terminal-field dump** (new,
  `unknownDocKeys`/`KNOWN_DOC_DATA_KEYS`/`KNOWN_DOC_TOP_KEYS`/
  `dumpUnknownTerminal`) — checks both the pre-`start_run` existing-doc
  read and every `play_cards` terminal response against a hand-maintained
  allowlist (mirrors `scripts/liveRun.ts`'s `KNOWN_SIDE_KEYS`), writes a
  loudly-named `logs/fishing-unknown-terminal-<stamp>.json` the moment
  something outside it appears. First version's allowlist was built only
  from `FishingBoardDataSchema`'s DECLARED fields and immediately flagged
  16 boring, already-real fields (`LEVEL_CID`, `data.day`/`week`, etc.) as
  "unknown" on every single doc — corrected against the real captured
  fixture (CLAUDE.md §1). `cardsToAdd`/`caughtFish`/`cardChosenId` are
  DELIBERATELY still flagged (see below) even though their rough meaning
  is now known — the point is staying loud until the RESOLUTION ACTION
  itself is captured, not just its result fields. 3 new tests
  (`tests/liveFishing.test.ts`), all pass.
- **Live-confirmed: the fishing account is genuinely unblocked.** One real
  cast (`--casts=1`) succeeded end to end — `start_run` accepted, 2 turns
  played, escaped cleanly, energy accounted (23→11, spent 12). The stale
  `GET /fishing/state` read (`docId 12925779`, `fullDeck` length still 10)
  is NOT a reliable "still stuck" signal once a game is truly resolved —
  the read endpoint just doesn't update that view. `cardChosenId` (present
  and non-null, value 23) is the real distinguishing field, found via the
  new pre-check dump.
- **All 318 tests pass** (315 → 318), `npx tsc --noEmit` clean.

## What's broken / paused
- **QUESTIONS.md §10's core question — the actual `/fishing/action` action
  name that resolves a catch — is STILL open.** We now know the resolved
  doc's shape (`cardChosenId` set) but not what our bot should POST to set
  it. User offered a DevTools capture this session; outcome not known as
  of this write (session paused here, see Status).
- Today's fishing casts are under-spent relative to budget (13/15 used
  including this session's 1) — deliberately paused, not blocked.

## Corrections to SPEC.md / this repo's own assumptions
- `GET /fishing/state`'s `fullDeck` length and even `COMPLETE_CID`/
  `SUCCESS_CID` do NOT reliably distinguish "stuck" from "resolved" once a
  game is fully closed out — `cardChosenId` (non-null) is the real signal,
  found this session, not previously documented anywhere.
- `scripts/liveFishing.ts`'s known-field allowlist needed 16 more real
  fields than `FishingBoardDataSchema` declares (`LEVEL_CID`, `ID_CID`,
  `PLAYER_CID`, `FACTION_CID`, `GEAR_CID_array`, `DAY_CID`, `_id`,
  `createdAt`, `updatedAt`, `__v` at top level; `jebaitorTriggered`,
  `consumablesUsed`, `fishingConsumableSlotUsed`,
  `fintuitionOilBoostPercent`, `dualYieldOilBoostPercent`, `day`, `week`
  under `data`) — the schema's own `.passthrough()` already carried these,
  they just weren't typed or accounted for anywhere. Not urgent to add to
  the zod schema itself (nothing currently reads them), but worth noting
  the schema was more incomplete than assumed.
- Potion crafting is now explicitly, permanently OUT OF SCOPE for
  automation (user directive) — any future task referencing "crafting
  economics" as a bot decision is stale; it's the user's manual job.

## Dead ends
- Hunting for a crafting POST endpoint via a fresh `GET /offchain/static`
  dump (`scripts/probeCraftAction.ts`, new, read-only, kept) — found
  nothing beyond the already-known read-only recipe data. Not wasted: this
  is exactly CLAUDE.md §2's prescribed move (dump a related endpoint,
  don't invent/brute-force one) and the negative result is real information
  — reinforced (rather than contradicted) by the user's crafting-is-manual
  instruction landing moments later.
- First cut of "potions default ON" (free inventory auto-detection, no
  config gate) — not shipped as final; superseded within the same session
  by the user's direct safety correction. See DECISIONS.md for both.

## Metrics
- Sim (potion timing, extended sweep, N=2000): baseline 2.112 ± 0.050;
  best row (0.5 threshold, 3 potions) 3.474 ± 0.034 — matches session 16's
  figure within noise, now confirmed as an interior optimum rather than a
  boundary artifact.
- Live dungeon this session: 0 runs (all via `--dry-run` verification
  only; the 2-runs/40-energy figures seen mid-session belong to session
  16, already documented in its own STATE.md — see the session-17 recap
  scratch notes if this needs re-deriving).
- Live fishing this session: 1 real cast, escaped after 2 turns, 12 energy
  spent. Guard budget: dungeon 40/240 energy, 2/12 runs (session 16
  carryover, unchanged by this session); fishing 60/200 energy, 5/15
  casts.
- Big Heal Juice balance: 3 → 45 between session start and this session's
  mid-point check — user crafting manually, consistent with this
  session's own crafting-is-manual instruction landing around the same
  time. Not investigated further (not this session's job).
- Tests: 315 → 318 passed, 0 skipped, 0 failed.

## Open questions for Claude
1. **QUESTIONS.md §10 — still the single most valuable capture available.**
   If the user's DevTools capture landed, the next session should wire the
   real action name into `scripts/liveFishing.ts` immediately (highest
   priority — it's been asked for three sessions running). If it didn't
   land, the new `unknownDocKeys` dump means the bot's OWN next catch will
   auto-capture the result fields at least, even without the action name
   itself.
2. **Today's fishing casts are under-spent (13/15) — deliberately, not by
   accident.** Worth resuming once the DevTools-capture question above is
   settled one way or the other, so the loop doesn't race a manual browser
   session on the same account.
3. **Big Heal Juice jumped 3→45 mid-session.** Not investigated (out of
   scope — crafting is the user's job now), but worth a passing mention if
   the user asks why their potion count is different than expected.

## Files changed
```
10 files changed, 298 insertions(+), 27 deletions(-)
+1 new: scripts/probeCraftAction.ts
+1 new fixture dir: fixtures/fishing-casts/live/cast-2026-08-16-16-18-37/

QUESTIONS.md                 |  26 ++++++++
TASKS.md                     |  24 ++++++++
config/bot.json              |   7 ++-
handoff/DECISIONS.md         |   4 ++
scripts/liveFishing.ts       | 138 +++++++++++++++++++++++++++++++++++++++++++
scripts/liveRun.ts           |  53 ++++++++++++++---
scripts/potionTimingSweep.ts |  26 ++++----
src/orchestrator/config.ts   |  14 +++++
src/sim/dungeonSim.ts        |  12 ++--
tests/liveFishing.test.ts    |  21 +++++++

full stat: `git diff HEAD --stat` (pre-commit)
```
