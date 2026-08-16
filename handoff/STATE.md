# STATE — session 15 — 2026-08-16 — commit PENDING

## Status
No single TASKS.md gate targeted this session (session-15 brief's own
framing, matching session 14) — six brief items, all attempted, most landed.
**Task 9's gate is now MET across two sessions** (session 13 supplied the
casts/no-trip/transitions parts; this session supplied the missing "fish
logged with rarity" — this project's first-ever live catch). **The account
is now STUCK** after that catch (`HTTP 400 "Player is already in a game"` on
every `start_run` since) — blocked all further live fishing this session,
logged to `QUESTIONS.md §10`, not resolved.
Next per TASKS.md: unblock the stuck fishing account (needs a real DevTools
capture — see QUESTIONS.md §10), then either grow `data/fish-patterns.jsonl`
further toward `mineFishPatterns.ts`'s promotion bar, or confirm whether
potion-crafting energy shares the dungeon/fishing pool (decides Task 12
Stage B's whole recommendation).
Overall: real progress on every brief item, but the fishing account's own
stuck state is now the binding constraint on further live play, not budget.

## What works
- **`--status` flag, both live scripts** (`scripts/liveRun.ts`,
  `scripts/liveFishing.ts`) — prints remaining dungeon runs/energy and
  fishing casts/energy from local guard-state files, no network call, no
  dry-run POST. Verified: `npx tsx scripts/liveRun.ts --status` /
  `npx tsx scripts/liveFishing.ts --status` both ran clean at session start,
  confirmed the date-keyed guards had reset (2026-08-15→2026-08-16 UTC
  rollover) before any live action was taken.
- **`chooseCard`'s objective REVERTED to argmax raw `EV(card,f)`**
  (`src/strategy/fishing/cardChoice.ts`) — session 13's `argmax P_hit` fix
  conflated two defects (the `/manaCost` divisor, a real bug; and optimising
  hit-probability instead of EV, an overcorrection). Reverted the second
  part only. New regression test pins a concrete counterexample (2-damage
  wide-hitbox card beats... loses to... a 5-damage narrow-hitbox card at
  higher EV despite lower `P_hit`). Verified:
  `npx vitest run tests/fishing/cardChoice.test.ts` (10/10 pass, 2 new).
- **Fishing sim re-run after the fix** (`scripts/fishFocusMeter.ts`):
  library-known 72.8%/500, 70.0%/3000; library-blind 6.6%/500, 10.4%/3000 —
  barely moved from session 14's 71.6%/69.9% and 7.0%/10.3%. Fix is kept for
  being theoretically correct (concrete counterexample in the test), not
  because the aggregate sim number changed.
- **`scripts/mineFishPatterns.ts` built** (Task 11's fishing half) — tests
  every real logged cast's full trajectory against the existing synthetic
  primitive pool, promotes at ≥3 independent exact matches (stated
  reasoning for why this differs from the project's usual 30-observation
  rate floor). At 9 real casts: 0 promoted (correct), but `perimeterWalk(cw)`
  matches 2 of 9 casts exactly — including the 5-turn catch cast, a genuine
  edge-following, corner-turning match, not a short coincidence. One more
  confirming cast promotes it.
- **First-ever live fishing catch** (cast `12925773`, "Zombo," item 521,
  `rarity: 2`) — resolves the catch terminal event name (`FISH_DIED`, not
  the guessed `FISH_CAUGHT`) and confirms `cardsToAdd` (3 full card objects)
  is real. Loot (`gameItemBalanceChanges`) credits synchronously with the
  catch. Full capture: `fixtures/fishing-casts/live/cast-2026-08-16-01-57-02/`.
- **Fishing oils, fully confirmed via `GET /offchain/static`** — 7 distinct
  effect types (draw cards, damage fish, restore mana, boost Fintuition,
  boost crit, **restore `focusMeter`**, boost Dual Yield), 3 tiers each,
  exact amounts. `FishingRestoreFocus` answers part of the standing
  `focusMeter`-regeneration question: it doesn't regen passively, but a
  Focus Oil restores it on purpose. See SPEC-fishing.md §4a.
- **Potion crafting recipe resolved** — Big/Mid Heal Juice, faction-gated
  (Archon variant matches this account), exact inputs, **70% success rate**
  per attempt (new information), materials NOT scarce (700-900+ of each
  input on hand). `scripts/potionSweep.ts` (new) gives the upper-bound
  benefit curve: +0.534/+0.956/+1.260 mean rooms cleared for 1/2/3
  committed Big Heal Juice (N=2000). See "Open questions" below for the one
  unresolved variable that decides the whole recommendation.
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **298 tests, 20 files, all pass** (296 → 298).

## What's broken
- **The fishing account is stuck and cannot start a new cast.** Every
  `start_run` since the catch returns `HTTP 400 "Player is already in a
  game"`; `GET /fishing/state` shows the completed doc unchanged
  (`fullDeck` never merged the 3 `cardsToAdd` cards in). Two reasoned
  action-name guesses (`select_card`, `claim`) on the same confirmed
  `/fishing/action` endpoint both got clean `"Invalid action: <name>"`
  rejections — informative about what it ISN'T, not what it is. No further
  live fishing possible until this resolves. See QUESTIONS.md §10 for the
  full response dumps and what a fix needs (a DevTools capture of a real
  client resolving its own catch).
- **Potion economics has one open variable that decides everything**:
  whether crafting energy is drawn from the same 240/day pool as dungeon
  runs and fishing casts. If yes, the break-even math (TASKS.md Task 12)
  says spending that energy on more runs beats spending it on potions, at
  every tested N. If no, potions are close to free and worth committing at
  max. Could not be settled read-only this session — needs one live craft
  with a before/after energy read.
- `config/bot.json`'s raised fishing cap (200/15) could not actually be
  used past 4 casts — the stuck-account blocker above, not a budget limit.

## Corrections to SPEC.md
- §5: card-choice primary objective REVERTED session-13's `argmax P_hit`
  back to `argmax EV(card,f)` — see "What works" above. Session 13's own
  `/manaCost` divisor fix stays; only the P_hit-vs-EV part reverses.
- §5: `mineFishPatterns.ts` result recorded (0 promoted at 9 casts,
  `perimeterWalk(cw)` near-miss at 2/9).
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren nodeId="5" /
  pondId=2**.
- Move charges: unchanged, PRESENT, hard-pruned.
- SPEC-fishing.md §4: catch terminal shape resolved (`FISH_DIED`,
  `cardsToAdd`, `gameItemBalanceChanges`) — previously fully `[VERIFY]`.
- SPEC-fishing.md new §4a/4b: fishing oils confirmed (full table); rod
  equipment checked and found NO encoded spell-set effect in `GET
  /gear/items` (stays `[VERIFY]`, not narrowed either way).

## Dead ends
- Two action-name guesses (`select_card`, `claim`) on `/fishing/action` to
  resolve the stuck post-catch state — both cleanly rejected as invalid
  action names by the server's own whitelist. Stopped after two (not a
  brute-force loop) per CLAUDE.md's stuck protocol; logged to QUESTIONS.md
  §10 rather than guessed further.
- Checked `GET /gamewebui/actions` (named in the community notes as "the
  client's own action registry") hoping it would list the missing action —
  it's a UI-panel menu registry (marketplace, racing, duel...), not the
  game-action enum for `/fishing/action` or `/game/dungeon/action`.
- Traced potion-crafting materials (Bolt, Steel Pipe, Archon Dust/Shard)
  back toward their own source (which loot table, which activity) —
  checked all 16 named `lootTables` in `GET /offchain/static`, none
  contain these item IDs; enemy `LOOT_ID_CID` values (34-59) don't match
  any of those 16 tables' own IDs either, so the actual drop source isn't
  encoded in this endpoint. Abandoned rather than guessed — not needed
  anyway, since the account already holds abundant stock (see "What works").

## Metrics
- Fishing sim (post-EV-fix), library known: 72.8% (364/500) / 70.0%
  (2099/3000, independent seed).
- Fishing sim (post-EV-fix), library blind (`matcherPool: []`): 6.6%
  (33/500) / 10.4% (311/3000).
- Live fishing this session: 4 casts completed (1 catch, 3 escapes), 1
  blocked mid-start (guard trip). Cumulative real corpus: 9 casts, 39
  transitions (25→39 this session).
- `mineFishPatterns.ts`: 0/23 primitives promoted (threshold 3), best
  candidate `perimeterWalk(cw)` support=2.
- Potion sweep (`scripts/potionSweep.ts`, N=2000, upper bound): 0/1/2/3
  Big Heal Juice → 2.130/2.664/3.086/3.389 mean rooms cleared.
- Live dungeon: 0 runs this session (fishing was the spine; no dungeon
  budget spent). Death-room histogram unchanged from session 14: 13
  confirmed deaths, 0/4/4/5 across rooms 1-4.
- Tests: 298 passed, 0 skipped, 0 failed (296 → 298).

## Open questions for Claude
1. **Does potion-crafting energy share the dungeon/fishing 240/day pool?**
   This is now the single number that decides Task 12's entire
   recommendation (TASKS.md has the full break-even math both ways). One
   live craft attempt with a `GET /offchain/player/energy` read before and
   after would settle it in one action — worth prioritizing early next
   session, before any Stage B policy work.
2. **The stuck fishing account needs a real capture to unblock**, not
   another guess — a DevTools HAR (or even just the Network-tab request
   line) of a real client resolving its own catch, specifically whatever
   fires when the "pick a new spell" UI (if the client has one) is
   confirmed/dismissed. Worth asking the user directly rather than trying a
   third blind guess.
3. **`perimeterWalk(cw)` is one cast from promotion** (2/9 exact matches,
   threshold 3) — is growing `data/fish-patterns.jsonl` toward that third
   match (once the account unblocks) worth prioritizing over other fishing
   work next session? It's the first concrete signal this project has ever
   had that Dendren's movement might genuinely be drawn from the kind of
   small deterministic set SPEC.md §5 always assumed.

## Files changed
```
10 tracked files changed, 495 insertions(+), 35 deletions(-)
+3 new: scripts/mineFishPatterns.ts, scripts/potionSweep.ts,
  fixtures/fishing-casts/live/cast-2026-08-16-01-57-02/ (18 redacted states)

QUESTIONS.md                       |  69 +++++++++++++++++
SPEC-fishing.md                    |  97 ++++++++++++++++++-
SPEC.md                            |  68 +++++++++++++++
TASKS.md                           | 109 +++++++++++++++++++++++++
config/bot.json                    |   6 +-
handoff/DECISIONS.md               |   7 +
scripts/liveFishing.ts             |  29 +++++-
scripts/liveRun.ts                 |  42 +++++++-
src/strategy/fishing/cardChoice.ts |  55 ++++++------
tests/fishing/cardChoice.test.ts   |  48 +++++++++

full stat: `git diff 6459897..HEAD --stat` (before this commit)
```
