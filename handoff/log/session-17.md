# STATE — session 17 — 2026-08-16 — commit 24c97ff (superseded, see final sha in handoff/STATE.md)

Same top-level content as `handoff/STATE.md` at commit time — reproduced
here plus verbose detail that doesn't belong in the always-loaded file.

## Status
Task 12 "Potion timing": GATE PASS (task CLOSED, no further stages). Worked
session-17's `next.md` brief (extended threshold sweep, one authorized
craft attempt, break-even recommendation, fishing unknown-terminal-event
capture, spend today's casts) plus two live user corrections mid-session
that materially changed the shipped design. QUESTIONS.md §10 (fishing
catch-resolution action, open since session 15) is also resolved this
session, off-brief — the user offered a manual DevTools capture partway
through and it landed.

## 1. Extended potion threshold sweep — full table

`scripts/potionTimingSweep.ts`, extended `THRESHOLDS` from `[0.2, 0.34,
0.5]` to `[0.5, 0.6, 0.7, 0.8, 0.9]`, N=2000, ev-engine policy, real
`PLAYER` baseline:

```
0-potion baseline: mean rooms cleared 2.112 ± 0.050

threshold potions  mean rooms cleared          delta          mean potions used/run
  0.5      1        2.728 ± 0.046          +0.616          0.966
  0.5      2        3.162 ± 0.041          +1.049          1.836
  0.5      3        3.474 ± 0.034          +1.361          2.558
  0.6      1        2.672 ± 0.047          +0.560          0.974
  0.6      2        3.107 ± 0.042          +0.995          1.867
  0.6      3        3.418 ± 0.036          +1.306          2.628
  0.7      1        2.573 ± 0.048          +0.461          0.983
  0.7      2        2.987 ± 0.043          +0.875          1.912
  0.7      3        3.293 ± 0.040          +1.181          2.751
  0.8      1        2.480 ± 0.049          +0.368          0.990
  0.8      2        2.753 ± 0.047          +0.641          1.949
  0.8      3        3.017 ± 0.044          +0.904          2.857
  0.9      1        2.329 ± 0.050          +0.217          0.996
  0.9      2        2.579 ± 0.048          +0.467          1.980
  0.9      3        2.829 ± 0.046          +0.717          2.938
```

Combined with the prior `{0.2, 0.34, 0.5}` sweep (session 16: 0.5 winning
at every loadout size), the full curve is monotonically increasing
0.2→0.5 and monotonically decreasing 0.5→0.9 at every loadout size — a
clean interior maximum, not a boundary artifact. No config change needed;
`DEFAULT_POTION_THRESHOLD` (`src/strategy/potions.ts`) was already 0.5.

## 2. Crafting endpoint hunt — dead end, then rendered moot

Before attempting the brief's authorized "one craft attempt with
before/after energy read," checked whether any crafting POST endpoint was
even confirmed anywhere in the repo. It wasn't — only the read-only `GET
/offchain/static` recipe data (session 15) existed. Per CLAUDE.md §2
("dump a related endpoint and look for it, don't invent one"), wrote
`scripts/probeCraftAction.ts` (new, read-only) to fetch `/offchain/static`
fresh and search the full ~900KB payload for any field mentioning "craft."
Found nothing beyond flavor text ("Crafted at a Workbench") and the
already-known recipe array — no action name, no hint of a POST path.

Mid-investigation, the user sent a direct instruction: "all potion
crafting will be manually done by the player. only use in dungeon will be
automated." This retires the whole question — not because the search
failed, but because the bot was never going to craft regardless. Recorded
in `handoff/DECISIONS.md` 2026-08-16 (session 17).

## 3. Potion policy — two designs, the second superseding the first

**First cut** (not shipped as final): `scripts/liveRun.ts` defaulted
`--potions` to `min(MAX_POTIONS_PER_RUN=3, live Big Heal Juice balance)`
whenever the flag wasn't explicitly passed — i.e. free auto-detection of
whatever heal item happened to be in inventory. Verified via `--dry-run`
that it correctly read a live balance and capped at 3.

The user flagged this directly: "For potion use, I want you to verify
before doing runs which potions (juices) you are allowed to take into the
dungeon. Otherwise you might burn through my supply of Big Heal Juice
without my intent."

**Final design**: `config/bot.json` gains `forbiddenWoods.potions:
{allowedItemId, maxPerRun}` (schema in `src/orchestrator/config.ts`,
optional, zod-validated). `scripts/liveRun.ts` now requires this block —
absent, it loads 0 potions regardless of balance. Asked the user directly
via `AskUserQuestion` what `maxPerRun` should be (options: 3/2/1/0, with
context that current stock was showing as 3 — later found to be stale,
see below); answer was **2**, matching what was actually live-tested
twice in session 16 rather than the sim's best-row 3. `--potions=N` CLI
override still works but is now pinned to the config-allowed item id.

Live-verified via `--dry-run`:
```
  · potions: config authorizes up to 2x itemId 131 (hard cap 3); 45 in stock -> loading 2. Pass --potions=N to override.
  · next genuinely new start_run will load 2x itemId 131, used at own HP ≤50%.
```

Note the balance shown (45) vs. what `checkPotions.ts` showed at the very
start of the session (3) — see §7 below, a real surprise investigated and
resolved as "the user crafted manually mid-session," not a bug.

## 4. Fishing — unknown-terminal-field dump, then the real capture

Built `scripts/liveFishing.ts`'s `unknownDocKeys`/`KNOWN_DOC_DATA_KEYS`/
`KNOWN_DOC_TOP_KEYS`/`dumpUnknownTerminal` per the brief's §4 (dump the
full raw response on any terminal event the loop doesn't recognise). First
version's allowlist was built only from `FishingBoardDataSchema`'s
DECLARED fields and immediately flagged 16 real-but-boring fields
(`LEVEL_CID`, `data.day`/`week`, etc.) as "unknown" on the very first real
fixture tested against it — corrected by deriving the allowlist from the
actual captured fixture instead of the schema (CLAUDE.md §1).

Ran one real live cast (`--casts=1`) to test the account's unblocked state
directly rather than trust `next.md`'s addendum at face value (see §6).
The pre-`start_run` check fired on the account's OLD completed doc
(unchanged since session 15/16) and surfaced genuinely new fields:

```
★★★ UNKNOWN FIELD(S) on the existing completed-but-unresolved doc: data.lastMovePath, data.activeFintuitionTurns, data.activeCritBoostTurns, data.caughtFish, data.cardsToAdd, data.cardChosenId
```

Inspecting the dump (`logs/fishing-unknown-terminal-2026-08-16-16-18-39.json`,
gitignored):
```
docId 12925779
COMPLETE_CID True SUCCESS_CID True
cardChosenId = 23
cardsToAdd = [{"id": 23, ... "hitEffects": [{"type": "FISH_HP", "amount": 7}], "missEffects": [{"type": "FISH_HP", "amount": -8}], ...}]
```

`cardChosenId: 23` — a resolved value, matching one of session 15's 3
original `cardsToAdd` ids (23/14/7). This meant the account had ALREADY
been resolved by the time this session started, even though the read
still showed the exact same-looking "stuck" doc. Confirmed the real cast
then succeeded (`start_run` accepted, escaped after 2 turns) — the
`fullDeck`-length/`COMPLETE_CID` heuristic used throughout sessions 15/16
to mean "stuck" was never fully reliable; `cardChosenId` is the real
signal.

## 5. The `loot` action — user's manual DevTools capture

Mid-session the user did a manual fishing run with DevTools open and
pasted the parsed payload from the actual browser client:

```json
{
  "action": "loot",
  "actionToken": "1786897508188",
  "data": { "cards": [22], "nodeId": "", "focusPoint": [], "itemId": 0, "slotIndex": 0, "tierId": 0 }
}
```

`data.cards: [22]` is far too large to be a hand-relative index (hand
size is 3-5 cards) — this is the card's real id from `cardsToAdd[].id`,
the OPPOSITE convention from `play_cards`'s `cards: [handIndex]` despite
an identical envelope shape. Verified via `checkFishingStuck.ts`
immediately after: `docId` changed to a NEW game (12934543, a fresh catch
from this manual run), `fullDeck length: 11` (was 10).

Wired in:
- `src/api/fishing.ts`: `FishingActionSchema` gains `"loot"`;
  `FishingBoardDataSchema` gains `cardsToAdd: z.array(FishingCardSchema)`
  and `cardChosenId: z.number().nullable().optional()` (previously
  untyped passthrough fields).
- `src/strategy/fishing/cardChoice.ts`: new `chooseNewCard(offers)` —
  argmax `max(hitEffect, critEffect) / manaCost` among the 3 offers.
  Explicit placeholder: this is a one-time permanent deck addition, not
  an in-cast tactical pick, and no sim exists yet to judge whether grid
  coverage / miss penalty / rarity matters more than raw damage-per-mana.
- `scripts/liveFishing.ts`: `runOneCast` now sends `loot` automatically,
  right after a catch, the moment `doc.data.cardsToAdd` is non-empty and
  `doc.data.cardChosenId` is null. Logs the offer ids and the chosen id,
  verifies `fullDeck` grew and `cardChosenId` is set, fixture-writes the
  response. On rejection: guard-recorded as a failure and thrown as a
  `GuardTrip` (fail-closed, not a silent skip that would leave the account
  stuck again).
- Moved `cardsToAdd`/`caughtFish`/`cardChosenId` from the unknown-field
  allowlist's deliberate exclusions into the KNOWN set now that the
  mechanism is understood and automated (previously kept flagged on
  purpose so a human wouldn't miss it; that purpose is served now).

NOT yet exercised end-to-end by the bot's own live play — see §8, energy
ran out (2/420) before a bot-driven catch happened this session.

## 6. Trust-but-verify: `next.md`'s addendum vs. live reality

`next.md`'s addendum claimed the account was already unblocked ("The user
opened the client and found a 'COLLECT' screen... clicked collect, then
selected a spell card. The account is no longer stuck... expect... fullDeck
length 11"). `checkFishingStuck.ts` at session start showed `fullDeck`
length still 10, same docId as the known-stuck session-16 state — directly
contradicting the addendum. Rather than trust either the brief or the
stale-looking read, ran a real `--casts=1` attempt: it succeeded cleanly.
Conclusion (see §4): the account genuinely was unblocked, the addendum was
right, but the READ endpoint just doesn't reflect resolution in the field
this project had been using as its signal (`fullDeck` length /
`COMPLETE_CID`). Neither the brief nor the stale-read heuristic was fully
trustworthy on its own; only the live action settled it.

## 7. A self-inflicted scare: mistaking session 16's own history for lost work

While investigating the fishing state, noticed dungeon-run fixture
directories timestamped earlier the same calendar day (`fixtures/dungeon-
runs/run-2026-08-16-15-27-54/` etc.) that didn't match anything in this
session's own visible actions, with real `use_item`/`tier_choice`/
`boon_choice` events and energy deltas around 400 (looking wrong against a
"240/day" mental model). Spent real effort treating this as possible
lost/uncommitted pre-compaction work before checking `git log`: the files
were already committed in `5bb3a63` ("session 16: Task 12 Stage B
complete"), which predates this conversation entirely — session 16 simply
ran earlier the same real-world day. The "400ish energy" confusion
resolved separately and usefully (§ Corrections: `maxEnergy` 420 is the
account's real absolute cap, unrelated to the bot's 240/day policy).
Lesson for next brief: STATE.md's own "session N — <date>" header already
states the date; multiple sessions landing the same calendar day is
normal, not a sign of missing memory, and file mtimes matching "today"
are not evidence of new-this-conversation work.

## 8. What was NOT done, and why

- **The `loot` path's live exercise by the bot's own play** — not done.
  Account energy read 2/420 (`GET /offchain/player/energy`) by the time
  the fix landed; every live action (dungeon or fishing) needs at least
  12-20 energy. This is the single most important thing for the next
  session to verify first, since an untested live path here would
  re-strand the account exactly like sessions 15/16 if it has a bug the
  mocks don't catch.
- **Spending the day's remaining fishing casts (13/15 unused)** — blocked
  by the same real energy floor, not a task or guard-budget issue.
- **A deck-composition sim for `chooseNewCard`** — not attempted, out of
  scope for this session; flagged as an explicit placeholder instead of
  guessed at.
- **Investigating why Big Heal Juice jumped 3→45** — not investigated
  beyond confirming it's plausible manual crafting; out of scope now that
  crafting is the user's job, not a bot decision.

## Files changed (full stat)
```
$ git diff d2dd6a0..HEAD --stat
 16 files changed
 QUESTIONS.md                                              |  26 +++
 SPEC-fishing.md                                            |  50 +++--
 TASKS.md                                                   |  42 +++-
 config/bot.json                                            |  10 +-
 handoff/DECISIONS.md                                       |  10 +
 handoff/STATE.md                                           | (rewritten)
 scripts/liveFishing.ts                                     | 175 +++++++++++
 scripts/liveRun.ts                                         |  53 +++-
 scripts/potionTimingSweep.ts                                |  26 +--
 scripts/probeCraftAction.ts (new)                           |  86 +++++
 src/api/fishing.ts                                          |  22 +-
 src/orchestrator/config.ts                                  |  14 +
 src/sim/dungeonSim.ts                                       |  12 +-
 src/strategy/fishing/cardChoice.ts                          |  20 ++
 tests/fishing/cardChoice.test.ts                            |  18 ++
 tests/liveFishing.test.ts                                   |  32 ++-
 fixtures/fishing-casts/live/cast-2026-08-16-16-18-37/ (new) |   3 files
```
Three commits before the first recap: `d86dcb7` (Task 12 + potion policy +
fishing capture-loop), `bcb58da` (sha record), `f9f81ec` (loot action
confirmed), `24c97ff` (sha record), `8f4bbd0` (first recap commit),
`5b406fd` (sha record).

## 9. Post-recap: taking over an already-active dungeon run

After the first recap landed, the user asked the bot to take over a
Forbidden Woods run that was already active — started outside this
session (not by any script this session ran), sitting at room 1 with 2
Big Heal Juice already committed in the run's `consumables`.

**Verification before acting**: ran `scripts/liveRun.ts --dry-run` first
rather than trust the user's description blindly (CLAUDE.md's "discover,
don't assume" applies to user reports too, not just briefs). Confirmed
live:
```
· active run already exists at room 1 — resuming rather than starting a new one
room 1  me HP 36/36 ARM 16  |  Enemy Room 63 HP 30/30 ARM 12
[dry-run] would POST rock
```
Matched the user's description exactly (room 1, presumably-fresh HP).
Also surfaced that Big Heal Juice balance had grown again, 45 → 80 (the
user continuing to craft manually, as expected).

**Real run** (`scripts/liveRun.ts --runs=1`, no dry-run): resumed cleanly,
no new `start_run` sent (confirmed by the log: `resuming today's budget:
40 energy / 2 runs already spent` — unchanged from before this action,
i.e. resuming truly costs nothing extra). Full room-by-room outcome:

- Room 1 (Enemy Room 63, HP30/ARM12): won cleanly across 4 exchanges, HP
  36→28, ARM 16→0→8 (regen visible from wins). Reward: `AddBlock`.
  Enemy path: Safe tier (0) offered and taken.
- Room 2 (Enemy Room 64, HP35/ARM14): HP dropped 20→14 over several
  exchanges (armor absorbing most hits); potion #1 fired at HP 14/36
  (≤50% threshold), itemId 131 index 0, `HTTP 200` — HP 14→34. Continued,
  won the room at HP 24. Reward: `AddTenacity`. Enemy path: Safe tier
  offered and taken.
- Room 3 (Enemy Room 65, HP38/ARM15): HP dropped 24→12 over several
  exchanges; potion #2 fired at HP 12/36, itemId 131 index 1, `HTTP 200`
  — HP 12→32. Won the room at HP 13. Reward: `AddLuck`. Enemy path: **no
  Safe tier offered this time** — `pickLowestTier()` correctly fell back
  to the lowest available (tier 1), matching the session-09 finding that
  this is expected server behavior, not a bug, and logged as such inline
  (`▸ enemy path: choosing lowest offered tier 1 — NOT Safe, none was
  offered (session-09: expected, not a bug)`).
- Room 4 (Enemy Room 66, HP40/ARM16, tier 1): started at HP 13/36 with
  both potions already spent. Lost the exchange sequence — HP 13→5→5→5→3,
  final exchange ended the run. `· no active run — stopping.` confirms a
  clean death, not a stall or crash.

**Energy accounting**: `▸ energy: 7 -> 8 (spent 0)` — the small increase
is regen during the run's duration, not a spend; resuming an
already-started run costs nothing beyond what the run's own original
`start_run` already paid. Guard budget (`data/guard-budget.json`)
unchanged at 40 energy / 2 runs after this action, confirming the
accounting is correct.

**Death-room histogram** (`scripts/deathRooms.ts`): 15 → 16 confirmed
deaths, `0/4/5/6` → `0/4/5/7` across rooms 1-4. Still zero room-1 deaths.
One more data point in the same even-ish spread Task 11 (parked) already
noted — not enough on its own to revisit that parking decision.

Fixtures written and redacted automatically: `fixtures/dungeon-runs/
run-2026-08-16-17-55-21/` (the dry-run's one read) and `fixtures/
dungeon-runs/run-2026-08-16-17-55-45/` (68 states, the real run).
Committed in `db1f76c`, pushed. `handoff/DECISIONS.md` gained one entry
documenting the potion-policy-on-a-resumed-run confirmation.
