# STATE — session 13 — 2026-08-15 — commit 63ae54d

Full detail behind `handoff/STATE.md`'s session-13 entries. Same status/
what-works/what's-broken/corrections/dead-ends/metrics, expanded with the
verbose material (sweep tables, exact request/response bodies, error dumps)
that doesn't belong in the always-read STATE.md.

---

## 1. Mana-divisor fix (§1 of the session-13 brief)

Read `src/strategy/fishing/cardChoice.ts` cold, before touching anything —
confirmed `chooseCard` still picked `argmax EV(card,f) / card.manaCost`,
exactly as the brief flagged. SPEC.md §5 said the same thing and was
itself wrong (the one real captured cast escaped with 5/10 mana unspent —
the miss counter capped it, not mana).

Fix: `chooseCard`/`bestFocusForCard` now pick `argmax P_hit` (`pHit+pCrit`),
`ev` as tie-break, mana as an affordability filter (`c.manaCost <= mana`)
only. A late-cast correction (`isManaConstrained`) falls back to
`argmax EV/mana` when mana genuinely can't cover finishing the fish even
under optimistic play (turnsNeeded = ⌈fishHp / bestHitInHand⌉, manaNeeded =
turnsNeeded × cheapestAffordableManaCost).

First re-run of the 500-cast sim after ONLY this fix: catch rate actually
FELL, 19.0% → 17.6% (88/500), with the outcome mix flipping from mostly
`escaped_meter` (446/500 under random, matcher was previously also mostly
meter-capped) to mostly `escaped_mana` (388/500) at a mean of 1.29
turns/cast — the matcher was running out of mana almost immediately.

Root cause: `shouldRedraw` compared `best.evPerMana` against
`redrawThreshold`, not `best.ev` as SPEC.md §5 always specified. This was
silently correct while `chooseCard`'s own objective was ALSO evPerMana (the
two scales agreed often enough); the moment `chooseCard` stopped optimizing
for evPerMana, the chosen card's evPerMana became a poor proxy for "is this
hand worth keeping," and redraw fired almost every turn — each redraw burns
`hand.length` mana for a re-roll, explaining the near-instant mana
exhaustion.

Fixed `shouldRedraw` to read `best.ev`. Then swept `REDRAW_THRESHOLD` at
n=500/threshold across a custom harness mirroring `simulateCast`:

```
threshold -Infinity: { caught: 464, escaped_meter: 36 }                    meanTurns 2.87
threshold 0:          { caught: 462, escaped_meter: 25, escaped_mana: 13 } meanTurns 2.80
threshold 1:          { caught: 372, escaped_mana: 101, escaped_meter: 27 } meanTurns 2.39
threshold 2:          { caught: 157, escaped_mana: 318, escaped_meter: 25 } meanTurns 1.53
threshold 3 (old):    { escaped_mana: 382, caught: 94, escaped_meter: 24 } meanTurns 1.31
threshold 5:          { escaped_mana: 469, escaped_meter: 16, caught: 15 } meanTurns 1.09
threshold 8:          { escaped_mana: 484, escaped_meter: 14, caught: 2 }  meanTurns 1.06
```

Catch rate falls MONOTONICALLY as the threshold rises — every redraw is
expensive relative to just playing the best available card once
`chooseCard` targets hit probability. Picked `0` over `-∞` (462/500 vs
464/500, inside noise at n=500, but `0` matches SPEC's literal "redraw only
when max EV is negative" more honestly than disabling redraw outright).

**Final number, both fixes together, real `castSim.ts`/`simulateCasts`
(not the scratch harness):**

```
random:  39/500 = 7.8%   meanTurns 3.43
matcher: 462/500 = 92.4% meanTurns 2.80
```

`npx tsc --noEmit` clean, `npx vitest run tests/fishing` 24/24 (was 18 —
added a `shouldRedraw` doc update, an `evaluateCardAtFocus`/`bestFocusForCard`
tie-break comment, and later the `FocusBudget` tests, see §3).

Updated SPEC.md §5 with the full corrected derivation and the `shouldRedraw`
bug's own explanation, so the next reader sees WHY the fix mattered as much
as WHAT it was.

---

## 2. Building the live fishing loop (Task 9)

`GigaverseClient` needed `getFishingState(address)` (`GET
/fishing/state/{address}`) and `postFishingAction(body)` (`POST
/fishing/action`) — neither existed. Built with a SEPARATE
`fishingActionToken` field (string, defaults `""`), deliberately not
sharing `get()`/`post()`'s auto-update of the dungeon-side `actionToken` —
SPEC-fishing.md §2 confirms fishing's token chain is a different sequence
with a different wire shape (request token STRING, response token
top-level NUMBER, `String()`-ed for the next request). Confirmed against
`fixtures/fishing-casts/cast.json` request 0: the very first `start_run`
sends `actionToken: ""`, not a stale numeric token.

`config/bot.json` gained a `dendren` block (`dailyEnergyBudget: 100,
maxCastsPerSession: 5` — conservative first-session figures, mirroring
`forbiddenWoods`' original session-08 posture) and `src/orchestrator/
config.ts` merges it with `config/discovered.json`'s existing `dendren`
block (nodeId, tierId 1 = free tier, energyCostPerCast from
`tiers["1"].energyCost`, maxCastsPerDayGame). Both sides optional so a repo
without Task 7's discovery still gets a valid dungeon-only config.

`scripts/liveFishing.ts` mirrors `liveRun.ts`'s shape: `cardsById`/
`buildHand` resolve `doc.data.hand` (confirmed to hold card IDs, not
positional indices — `hand[i]` equals the ID that lands in `discard[]` that
turn, verified against all 5 real plays in `cast.json`) against
`deckCardData`; `buildFishingEnvelope` builds the confirmed request shape;
`data/fish-patterns.jsonl` gets one line per turn
(`{ts,castId,turn,from,to,gridSize}`), loaded back in as `emptyFallback`'s
empirical source so later turns in the SAME cast (and later casts) benefit
from earlier transitions, not just future sessions.

**Deliberate design choice, not an oversight:** the matcher's candidate
pool starts EMPTY every cast (`initMatcher([], startCell)`), never seeded
from `src/sim/fishing/patterns.ts`'s synthetic library. That library is a
sim stand-in built to test the algorithm (Task 8's gate), explicitly not a
claim about real Dendren (SPEC.md §5) — seeding live decisions from it
would silently launder an unverified assumption into real play. Every turn
this session ran through `emptyFallback`, which is honest but weak signal
this early (uniform-over-grid until enough real transitions accumulate).

Redraw is UNCONFIRMED (SPEC-fishing.md §7 — never captured, wire shape
`[VERIFY]`). The live loop detects `shouldRedraw` firing and logs it
(`redraw_indicated_not_sent`) but never sends one, per CLAUDE.md §2 ("never
invent an endpoint"). Given the `REDRAW_THRESHOLD=0` retune above, this
almost never fires in practice anyway.

---

## 3. `focusMeter` — discovered, root-caused, and fixed live

**Dry run** (`--dry-run`): clean. GET `/fishing/state/{address}` parsed,
correctly reported "no active cast," would-POST `start_run` logged. Zero
issues — confirmed the client wiring and schema before spending anything.

**First real cast** (`--casts=1`): `start_run` succeeded, actionToken now
numeric. Four turns played successfully (cards 76, 5, 77, 7 — hand
correctly shrinking/refilling), THEN the 5th `play_cards` request (focus
`[2,2]`, from a current focus of `[1,1]`) returned **HTTP 400**, un-caught,
process exit 1.

Investigated via the fixture files this same failed run had already
written (`fixtures/fishing-casts/live/cast-2026-08-15-20-32-43/state-*.json`):

```
state-000 (post start_run): focusPoint [2,2]  focusMeter 3/3
state-001 (post turn 0, focus [2,2]→[2,2]):    focusMeter 3/3   (no move, no cost)
state-002 (post turn 1, focus [2,2]→[1,2]):    focusMeter 2/3   (dist 1, cost 1)
state-003 (post turn 2, focus [1,2]→[1,1]):    focusMeter 1/3   (dist 1, cost 1)
turn 3 attempted: focus [1,1]→[2,2], Manhattan distance 2, only 1 meter left → REJECTED HTTP 400
```

4/4 clean fit for "focus move costs its Manhattan distance from the
current focus, out of a 3-point budget that does not regenerate within a
cast." The 4th point is the load-bearing one — a REJECTION, not just a
number staying put, proving the cap is enforced server-side.

Fix: `src/sim/fishing/geometry.ts` gained `manhattan(a,b)` and
`reachableCells(gridSize, current, maxDistance)` (filters `allCells` by
Manhattan distance, always includes `current` itself even at 0 remaining
meter — never throws). `cardChoice.ts`'s `bestFocusForCard`/`chooseCard`
gained an optional `FocusBudget` (`{current, remaining}`) param, threading
through to `reachableCells` when supplied; omitted (as the sim still does),
behavior is unchanged. `scripts/liveFishing.ts` always supplies one, built
from `doc.data.focusPoint`/`focusMeter` (`focusBudget(doc)` helper).

**Resumed the stuck cast** (same docId, `--casts=1` again): the resumed
process's fresh `GigaverseClient` has `fishingActionToken=""`, yet the
resume succeeded immediately — confirms (empirically, matching the
dungeon side's established resume behavior) that the actionToken's "~5s
anti-spam window" isn't a strict continuity check tied to the exact last
issued value; a fresh sentinel works for resuming an existing cast, not
just for a brand-new `start_run`. Cast completed: `escaped` after 1 more
turn (5 total). Energy delta 0 (resuming costs nothing new, as expected).

**Remaining four casts** (`--casts=4`): zero further focus-related
rejections, zero guard trips. All four completed cleanly:

```
cast 1: escaped after 5 turns  (energy 295→283)
cast 2: escaped after 2 turns  (energy 283→271)
cast 3: escaped after 5 turns  (energy 271→259)
cast 4: escaped after 9 turns  (energy 259→247)
```

Total this session: **5 casts, 25 real transitions logged to
`data/fish-patterns.jsonl`**, 0 catches, 1 guard trip (root-caused and
fixed, not swept under the rug), 0 further incidents across the remaining
4. `data/guard-budget-fishing.json`: `{energySpent: 59, runsStarted: 5}` —
exactly matches `maxCastsPerSession: 5`.

Added `tests/fishing/geometry.test.ts` (+4: manhattan/reachableCells
against the exact live data points, including the rejected move) and
`tests/fishing/cardChoice.test.ts` (+2: `FocusBudget` threading through
`bestFocusForCard`/`chooseCard`). Added `tests/liveFishing.test.ts` (new,
7 tests: `cardsById`/`buildHand` against the real cast fixture,
`fishCell`, `buildFishingEnvelope` matching both real captured request
shapes, `data/fish-patterns.jsonl` round-trip including a malformed-line
skip test).

SPEC.md §5 and SPEC-fishing.md §4 both updated with the confirmation.

---

## 4. Task 12 Stage A — `use_item` probe

Session-13 brief §2's framing: `consumables` is currently ALWAYS sent
empty (no code path populates it), so `use_item` risks nothing regardless
of run state — the doomed-state-detection Task 12 originally asked for was
unnecessary scope.

Added `--probe-use-item` to `scripts/liveRun.ts`: fires AT MOST ONCE per
process (shared `{fired:boolean}` across every run in the invocation), only
when own HP fraction ≤ `PROBE_HP_FRACTION` (0.34), never in `--dry-run`.
Deliberately does NOT touch `guards.recordActionResult` — a 400 here is the
expected, informative outcome, not a failure that should count against the
3-strikes budget. Always re-syncs state afterward via the NEXT loop
iteration's normal `getDungeonState()` poll rather than a redundant manual
read; added a `skipNextStateCheck` flag so that resync (which legitimately
re-reads unchanged state) doesn't trip the "same state observed twice"
stall guard.

Ran live via `npx tsx scripts/liveRun.ts --runs=2 --probe-use-item`. Room 1
and 2 cleared normally (EV tables in the raw terminal output, omitted here
— see `logs/run-2026-08-15-20-44-27.jsonl` if still present). At room 3,
own HP dropped to 4/36 against Enemy Room 65 (Safe tier, 38/38 HP). The
probe fired:

```
POST /game/dungeon/action
{"action":"use_item","dungeonId":5,"actionToken":1786826735969,
 "data":{"consumables":[],"isJuiced":false,"index":0,"itemId":0}}

→ HTTP 400
{"success":false,"message":"Item not found in index","actionToken":1786826738249}
```

Clean confirmation: the action name is real (not a 404/405 wrong-endpoint
rejection), the combat-style envelope (`dungeonId` real, `actionToken`
real numeric — NOT the reward/path-style `dungeonId:0, actionToken:""`) is
accepted at the routing/validation layer, and `itemId` is how the target
item gets specified (the error is specifically about the item, not the
envelope).

The run then continued: the very next combat move (`paper`) returned
**HTTP 500**. `fail()` fired, `GuardTrip`, process exit 1 — a completely
normal fail-closed halt, no different from any other unexplained 500 this
project has already seen and characterized (session 08/09's
`reward_*`/`path_*` 500 pattern; this is the first time a plain combat
move produced one, but the failure mode is the established one).

Re-checked live via a throwaway read (`GigaverseClient.getDungeonState()`)
immediately after: the run is STILL ACTIVE, room 3, own HP still 4/36,
enemy still 38/38 — the `paper` move that 500'd did NOT apply. This is the
"didn't apply" branch of the already-established "HTTP 500 doesn't
reliably mean the action didn't apply" finding (session 08) — confirmed
both ways across this project now, not just the "did apply" case from
before.

Given the session's dungeon budget was nearly exhausted (229/240 energy,
11/12 runs) and the run's outcome (win or death) wouldn't change anything
this session was actually testing, left it as-is rather than pushing
further — resumable next session at zero additional run-slot cost.

Manually captured the probe's request/response as
`fixtures/dungeon-runs/run-2026-08-15-20-44-28/state-039.json` (the
`fixtures.write()` call was added to `probeUseItem` AFTER this run
happened, so it wasn't auto-captured — backfilled by hand from the JSONL
log so the finding isn't lost; future probes will fixture-write
automatically).

TASKS.md Task 12 and `handoff/DECISIONS.md` both updated with the outcome
and the still-open questions (turn cost, multi-use, consumed-on-loss — none
answerable from an empty-loadout probe).

---

## 5. Task 11 parked

Per the session-13 brief §3: three independent live confirmations now
(n=6 session 10, n=9 session 11, n=11 session 12) of the flat death-room
histogram (room 1 ×0, 2 ×3, 3 ×4, 4 ×4), plus session 10's 10× weight-
amplification null result. No new sweep run this session — the brief's
own reasoning was already sufficient and re-running the same test a fourth
time would test nothing new.

TASKS.md's Task 11 entry updated with an explicit PARKED marker and three
stated revival conditions (a materially different utility form, the
histogram shifting shape as the corpus grows, or Task 12 Stage B's own
result bearing on whether attrition is addressable via ANY lever). The
fishing half of Task 11 (`mineFishPatterns.ts`) is explicitly UNPARKED —
it now has real data to eventually work with (`data/fish-patterns.jsonl`,
25 lines), even though 25 lines is probably still too few to mine real
cycles from yet.

---

## 6. Corpus-total re-derivation (mechanical, not a finding)

This session's two new live captures (1 dungeon run, 5 fishing casts —
only the dungeon run affects the SHARED dungeon-side corpus tooling; the
fishing casts are a separate corpus) shifted six hardcoded corpus-total
assertions, exactly as DECISIONS 2026-08-15 says to expect ("Corpus-total
assertions are EXPECTED to fail after every capture and must be read one
at a time, never reverted"). Re-derived each from the actual corpus rather
than incrementing by a guess:

| assertion | old | new | why |
|---|---|---|---|
| `tests/replay.test.ts` exchanges | 301 | 315 | +14 exchanges from the new run |
| `tests/replay.test.ts` sideUpdates | 602 | 630 | +28 side-updates, same run |
| `tests/boons.test.ts` pickups.length | 28 | 30 | +2 boon pickups (AddBlock room 1, UpgradeRock room 2) |
| `tests/boons.test.ts` room-1 options | 45 | 48 | +1 room-1 offer (3 options: UpgradeScissor/AddBlock/AddTenacity) |
| `tests/boons.test.ts` clean room-1 list | 5 entries | 6 entries | UpgradeScissor is clean — a second clean UpgradeScissor entry, not a new type |
| `tests/enemies.test.ts` PLAYER hpMax | 34 | 36 | newest capture's opening state — armor/moves unchanged |
| `tests/enemies.test.ts` distinct loadouts | 4 combos | 5 combos | new `36/16` loadout |
| `tests/dungeonSim.test.ts` battleCoverage.scored | 1094 | 1097 | reshuffled by the new PLAYER baseline + 2 new OBSERVED_OFFERS entries |

`src/sim/boons.ts`'s `OBSERVED_OFFERS` and `src/sim/enemies.ts`'s `PLAYER`
doc comments both updated with the new session's data point, matching the
existing convention of narrating drift rather than silently editing a
number. `npx tsx scripts/sim.ts` re-run after all fixes: Task 5's gate
still passes (85.6% vs 92.9%, non-overlapping), `npx tsx
scripts/deathRooms.ts` re-run: histogram unchanged at 11 confirmed deaths
(the new run isn't a death, so it doesn't enter the histogram — it shows
correctly as a non-death capture at `lastRoom=3`).

Final: `npx tsc --noEmit` clean, `npx vitest run` 292/292 passing, 20 files.

---

## 7. Full gear ranking (session-13 brief §5's ask)

Re-run (not reused from session 12) since PLAYER's hpMax changed this
session (34→36) and DECISIONS 2026-08-16 requires re-measuring rather than
quoting an old-loadout number:

```
GEAR SWEEP — 1000 runs each, ev-engine policy, +4 single-stat upgrades
Baseline PLAYER: hp 36/36, armor 16/16, rock 20/4, paper 6/12, scissor 12/8
baseline mean rooms cleared: 2.180 ± 0.072 (battle coverage 41%)

upgrade                      mean rooms cleared        delta vs baseline
rock (Sword) ATK +4          2.429 ± 0.070        +0.249
rock (Sword) DEF +4          2.427 ± 0.073        +0.247
scissor (Spell) DEF +4       2.350 ± 0.073        +0.170
paper (Shield) ATK +4        2.342 ± 0.074        +0.162
paper (Shield) DEF +4        2.304 ± 0.072        +0.124
max armor +4                 2.287 ± 0.073        +0.107
scissor (Spell) ATK +4       2.280 ± 0.071        +0.100
max HP +4                    2.221 ± 0.071        +0.041
```

Sword ATK and Sword DEF are now STATISTICALLY TIED (2.429±0.070 vs
2.427±0.073, intervals overlap) — under session 12's hp-34 baseline, Sword
ATK led alone at +0.305 with no close second. The ranking changed shape,
not just magnitude, when the loadout changed. Everything below Shield ATK
is meaningfully separated from the top two; Max HP is the weakest single
lever by a wide margin, consistent with session 12's finding.

---

## Full test run at end of session

```
npx tsc --noEmit     → clean, exit 0
npx vitest run       → 292 tests, 20 files, all pass
npx tsx scripts/sim.ts → Task 5 gate: PASS (85.6% vs 92.9%, non-overlapping)
```
