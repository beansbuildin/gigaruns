# BRIEF — session 42

Session 41 landed cleanly and stayed honest about its size: both `RunLog`
classes (`scripts/liveRun.ts`, `scripts/liveFishing.ts`) took the same
optional `dir: string = "logs"` constructor parameter, closing the gap
session 40 found on the dungeon side and the identical unfixed twin session
41 found on the fishing side — same bug class as sessions 30/31/39, closed
before a future test could reach for a no-arg constructor and repeat it. All
four real production call sites (`liveRun.ts:1218`, `liveFishing.ts:1172`,
`orchestrator.ts`'s aliased `DungeonRunLog`/`FishingRunLog`) stay
byte-for-byte unchanged. It also corrected TASKS.md's self-contradicting
Task 13 section (the stale session-22 paragraph vs. the correct session-27
addendum). 561/561 tests, `tsc` clean, `git diff --check` clean, no real
`logs/` path touched by the new regression tests. No other TASKS.md item was
ready that session, and it said so rather than manufacturing scope.

**Since that commit, something happened outside any coding session that
changes what's ready now — read this whole section before touching code.**

---

## 0. FIRST ACTION — resume and complete the live dungeon run. Do this before anything else below.

There is a REAL, currently-active juiced Tier-3 Forbidden Woods run sitting
at floor 1 / room 1, full HP and full armor, started by the user directly
against the API (not by this bot) with 3x Big Heal Juice and a Tier-3
("3x gold rings") offering already committed. Real energy (60, a juiced
run's cost) and one of today's real run-count slots are already spent on
it. It has not been touched since. This is not a drill run or a dry-run
scenario — treat it with the same seriousness as any other real spend.

**Do not start a new run. Do not send another `start_run`. Resume this
exact one and play it to completion.**

```
npx tsx scripts/liveRun.ts --resume-existing --potions=3 --potions-used=0
```

Why both flags matter, not just `--resume-existing`:

- `--resume-existing` is required per session 23's `ResumeConfirmationRequired`
  gate (`scripts/liveRun.ts` "existing" branch, ~line 687) — without it, a
  real invocation refuses to touch a run it didn't start itself this
  process, by design, and throws rather than guessing. That gate is doing
  exactly its job here; this is the one case where overriding it is correct
  because the human confirming it is the one who started the run.
- `--potions=3 --potions-used=0` is required too, and easy to skip by
  mistake because resuming doesn't normally need it. `potionPolicyState` (the
  mid-combat `use_item` firing logic, ~line 844-860) is built in `main()`
  from `--potions=N`/config auto-detect BEFORE the new-vs-resume branch is
  even reached, and its default auto-detect path (`client.getItemsBalances()`
  against `config.potions.allowedItemId`) reads CURRENT wallet balance —
  which no longer reflects these 3 Big Heal Juice, since they're already
  spent into this run's committed `consumables`, not sitting in tradeable
  inventory anymore. Left to auto-detect, the bot would very likely load a
  potion count of 0 or short and never fire `use_item` for juice that's
  already paid for and waiting. Pass the real committed count explicitly.
  `--potions-used=0` because nothing has been used yet (full HP/armor, no
  `use_item` sent since the run started).

Resuming an already-active run does NOT touch `start_run`/`buildEnvelope` at
all — the "existing" branch returns straight into the normal per-turn combat
loop (`buildEnvelope` for moves, `buildPathSelectionEnvelope` for
reward/path picks), both unaffected by anything in §1 below. None of §1's
code work needs to land before this run can be resumed and finished; do not
block on it.

Record, plainly, once the run ends (win, loss, or escape doesn't apply here
— it's a dungeon, not fishing):

- The reward shown at the FIRST reward pick — is it actually 3x whatever a
  plain Tier-3 pick would show (the user's own reference point: a 5→15
  Dendren Root-equivalent multiplier)? This is Task 14's actual gate
  evidence, not a guess.
- A follow-up `GET /game/dungeon/today` read of `dayProgressEntities` for
  Dungeon#5 — did it move by exactly 3 from wherever it stood before this
  run, not 1? (`findRealRunsToday()`, `liveRun.ts` ~line 1128, already
  does this read/parse — just needs to be diffed before/after.)

Neither of these was captured before this brief was written — the run was
still live, mid-floor-1, when this was handed off. Get both numbers for
real before writing session 42's own STATE.md claim about Task 14's gate.
If either number doesn't match the hypothesis, say so plainly — do not round
up to "gate passed" the way sessions 35/36 overclaimed and CODEXAUDIT caught.

---

## 1. Task 14 — wire the real juiced `start_run` shape into `buildEnvelope`

The blocker is resolved: DECISIONS.md now has the full captured request
(dated 2026-08-18, out-of-band). TASKS.md's Task 14 section is updated to
`UNBLOCKED`, not yet implemented — both were already committed ahead of
this session by the planning side; you don't need to re-append them, just
build against what's there. **Do this AFTER §0**, not instead of it — §0 is
real, in-flight, time-sensitive work; this is the follow-up code task.

The captured request (credential-free — no JWT, no wallet address in this
payload, safe to use directly in code and tests):

```json
{"action":"start_run","actionToken":"","dungeonId":5,
 "data":{"consumables":[131,131,131],"itemId":0,"expectedAmount":0,
         "index":3,"isJuiced":true,"gearInstanceIds":[],"devBoons":[]}}
```

**What's actually wrong, confirmed by direct read, not inferred from the
capture alone.** `scripts/liveRun.ts`'s `buildEnvelope()` (~line 244, the
function today's `start_run` call site at line 718 uses) hardcodes
`isJuiced: false`, builds only a 3-field `data`
(`consumables`/`isJuiced`/`index`), and passes `client.getActionToken()` — a
real number — as `actionToken`. `buildPathSelectionEnvelope()` (~line 271)
already sends the matching 7-field `data` shape and an empty-string
`actionToken`, but hardcodes `dungeonId: 0`. The capture is a THIRD shape —
empty-string `actionToken`, full 7-field `data`, but the run's REAL
`dungeonId` (5) — that neither existing builder produces. This directly
contradicts `buildPathSelectionEnvelope`'s own header comment (session 08),
which asserted combat/start_run always used the numeric-actionToken/3-field
shape. That assumption was never actually tested against a juiced start
before now.

**Implementation:**

1. Add `buildJuicedStartRunEnvelope(dungeonId, index, consumables)` —
   doc-commented with this capture as its evidence, same convention as
   `buildPathSelectionEnvelope`'s own comment. It returns the hybrid shape:
   real `dungeonId`, `actionToken: ""`, full 7-field `data` with
   `isJuiced: true`.
2. Branch the `start_run` call site (line 718) to use the new builder only
   when the caller is starting a genuinely new JUICED run (see §2's flag
   below). Leave the existing `buildEnvelope` call untouched for ordinary
   (non-juiced) starts — that shape has produced working runs across 23
   sessions; this task is not a reason to touch it.
3. Add a dedicated test pinning the new builder's output against the exact
   captured JSON above, same convention as `reward_one`/`path_two`'s tests.
4. Leave open, in the code comment and in TASKS.md if you touch it further:
   whether the empty-string-actionToken/7-field shape is required *because*
   the run is juiced, or would also be required for an ordinary start_run.
   This capture can't distinguish the two — there's no juiced/non-juiced
   pair to diff. Don't guess past what's actually known.

---

## 2. Task 14 — `--juiced` CLI flag, scoped like `--potions=N`

Mirror the existing `--potions=N`/`--potions-used=N` pattern
(`scripts/liveRun.ts` ~line 1039-1074's `parseArgs`):

- `--juiced` — only takes effect on a genuinely new start_run (never a
  resume; §0's resumed run already has its juiced status locked in from the
  original manual `start_run` and cannot be changed after the fact).
- A tier/`index` selector, fail-closed the same way `--potions=N` refuses to
  guess an item id without config — refuse rather than default to
  `index: 3`. `index: 3` is this capture's value for the specific tier-3
  offering the user picked; it is NOT yet confirmed as "index == tier" in
  general (see §0 — the gate-verification read may or may not settle this).
- Per the user's standing directive (quoted in TASKS.md Task 14, session
  17): plain, non-juiced runs keep defaulting to an empty `consumables`
  sack. `--juiced` must never cause a plain run to load potions, and a plain
  run without `--juiced` must not change behavior at all from today.

---

## Redaction — same rule as every prior live capture

The JSON payload above has no secrets in it and is safe in committed code,
tests, and docs. The cURL this capture came from also carried the account's
real bearer JWT and wallet address in its headers/cookies — those were never
recorded anywhere in this repo and must stay that way (DECISIONS
2026-08-13/14: wallet and JWT never land in git history, even redacted-looking
placeholders should use the literal `<JWT>`/`0xUSER` tokens, never a partial
real value). Whoever runs §0's resume command already has their own live
browser session / JWT via the normal way `liveRun.ts` loads credentials —
nothing in this brief needs a credential value pasted into it, and nothing
you write back to `handoff/`, `DECISIONS.md`, `TASKS.md`, or a fixture should
ever contain one either.

---

## Also already updated, informational only

QUESTIONS.md §15 (stuck fishing account after an escape) already has a
second data point recorded (2026-08-18, out-of-band): a live escape capture,
docId 12972042, `COMPLETE_CID: true` / `SUCCESS_CID: false`. That capture's
raw JSON has NOT yet been redacted or filed into
`fixtures/fishing-casts/live/` under that pipeline's real `cast-<timestamp>/`
directory/state-file convention (confirmed via a live directory listing —
it's per-turn `state-NNN.json` files inside timestamped subdirectories, not
flat single-file names), and it carries the account's real wallet address in
`PLAYER_CID`. It is NOT committed anywhere. If you have time after §0-§2,
redacting it and folding it into the real fixture corpus (matching the
existing pipeline's convention) would resolve that loose end — but §0 comes
first, and §1/§2 are the actual scoped work for this session; treat the
QUESTIONS.md fixture-filing as a stretch item, not required.

---

## Your task

1. §0 (resume and complete the live run) is the FIRST action, required,
   time-sensitive — real energy and a real run slot are already committed.
2. §1 and §2 (Task 14 implementation) are the primary code work, done after
   §0, grounded in §0's own outcome for gate verification.
3. The QUESTIONS.md fixture-filing (last section above) is optional stretch
   work only.
4. Recap normally: full suite + `tsc` + `git diff --check` against the final
   commit, plus the same "no real data/log path touched by new tests"
   discipline recent sessions have used. State the §0 gate numbers (reward
   multiplier, `dayProgressEntities` delta) plainly and honestly — if Task
   14's gate isn't actually satisfied yet, say so; don't round up.
