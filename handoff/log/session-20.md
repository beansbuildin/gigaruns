# Session 20 — 2026-08-16 — commit 00b49c0

## Brief recap

next.md's opening move: finish session 19's stuck room-2 dungeon run first.
Then, in order: (1) ROM sizing decision (ask user two questions, decide
whether to keep investing), (2) wire potions into the orchestrator's dungeon
path, (3) refactor three "corpus-count bookkeeping tax" tests, (4) tell the
user the 8h orchestrator run is ready.

## 1. Resuming session 19's stuck run

`npx tsx scripts/liveRun.ts` (no flags) auto-detected the active run at room
2 and tried to resume it. Immediately hit a real bug/finding: the run had
been started by the orchestrator (session 19's smoke test), which is
explicitly potion-free per its own header comment — so the run's committed
`consumables` was empty. `liveRun.ts`'s `main()` computes a potion loadout
from `config/bot.json`'s `forbiddenWoods.potions` allowlist regardless of
whether THIS invocation is the one that sent `start_run`, and tried
`use_item` at index 0:

```
✗ use_item: HTTP 400 — {"success":false,"message":"Item not found in index","actionToken":1786941315302}
✗ Guard tripped: use_item rejected {"itemId":131}
```

Confirmed via the raw fixture dump (`fixtures/dungeon-runs/run-2026-08-17-04-35-04/state-000.json`)
that `players[0]` has no `consumables`/potion-related field at all on this
run — the server's rejection is correct, not a bug in the game. This is
exactly CLAUDE.md §5's fail-closed behavior working as designed: guard
tripped, zero energy/turn lost (confirmed by the before/after energy read:
130 → 131, i.e. only regen), run left active/resumable.

Re-resumed with `--potions=0` to finish it on its own actual loadout: room 2
won (paper spam beat Enemy Room 64's soft counter), reward "AddIntuition"
picked, room 3 vs Enemy Room 65 at Safe tier — died there (HP 38→0 over 8
exchanges). Confirmed clean via `--status`: 0 active runs afterward.

This is the direct motivating case for potion-wiring item 2 below — a
config-authorized potion policy is meaningless if the run that actually got
started never committed the consumables in the first place.

## 2. Potion policy wired into the orchestrator

`scripts/orchestrator.ts`'s new `resolvePotionLoadout(client, config)`:
reads `config.potions` (same allowlist gate as `liveRun.ts` — absent config
means 0 potions, full stop, no silent default), reads live
`getItemsBalances()`, caps at `min(maxPerRun, MAX_POTIONS_PER_RUN, balance)`,
returns `{ startConsumables, potionPolicy }` for `runOnce`'s `LiveRunDeps`.

Key design difference from `liveRun.ts`, documented inline in
`orchestrator.ts`'s header: `liveRun.ts` builds this ONCE per process and
reuses the same mutable `potionPolicy` object across however many runs that
one invocation does (its own doc comment: "not a per-run reset" —
intentional, since in practice it's almost always one run per invocation).
The orchestrator starts MANY independent dungeon runs across one long-lived
process, and each genuinely new `start_run` commits its OWN fresh
consumables loadout server-side — reusing a single depleted `potionPolicy`
object across runs would silently starve every run after the first of
potions it was actually configured for. So `resolvePotionLoadout()` is
called fresh inside the dungeon branch of the main loop, before every
`runOnce` call, re-reading the live balance each time (balance legitimately
drops over an 8h session as potions get consumed).

Live smoke-tested (`npx tsx scripts/orchestrator.ts --hours=0.05`, ~3 min
bounded window): two dungeon iterations ran.

Iteration 1 (not fully captured in the truncated terminal tail, but visible
in fixtures — `run-2026-08-17-04-45-33`): rooms 1-4 cleared, reached room 5
— **the first time this project's corpus has ever gone past room 4** —
died to Enemy Room 67 (first-ever sighting) after ~13 exchanges.

Iteration 2 (`run-2026-08-17-04-47-48`, full terminal output captured):

```
▸ [2] dungeon run — real energy 123/420
  · potions: loading 2x itemId 131, used at own HP ≤50%.
  ✓ start_run sent
room 1  me HP 38/38 ARM 16  |  Enemy Room 63 HP 30/30 ARM 12
  ...
  ▸ reward: picking "UpgradeRock" (index 2)
  ▸ enemy path: choosing lowest offered tier 0 (Safe)
room 2  me HP 26/38 ARM 0  |  Enemy Room 64 HP 35/35 ARM 14
  ...
  ★ Task 12 Stage B: using potion (itemId 131, index 0)
  ✓ use_item: HTTP 200
room 2  me HP 38/38 ARM 0  |  Enemy Room 64 HP 35/35 ARM 14
  ...
room 3  me HP 38/38 ARM 0  |  Enemy Room 65 HP 38/38 ARM 15
  ...
  ★ Task 12 Stage B: using potion (itemId 131, index 1)
  ✓ use_item: HTTP 200
room 3  me HP 37/38 ARM 0  |  Enemy Room 65 HP 29/38 ARM 11
  ...
  · no active run — stopping.
▸ 0.05h window elapsed after 2 iteration(s).
▸ rollup:
  dungeon runs:    3/12 used  ->  9 remaining
  dungeon energy:  59/240 used  ->  181 remaining
  real account energy: 104/420 (regen 18/hr)
```

Both `use_item` calls (index 0, then index 1) returned HTTP 200 and healed
correctly mid-battle, both fired automatically by the orchestrator's own
potion policy with zero manual intervention — this is the actual gate for
"potions wired into the orchestrator," met live.

## 3. New corpus content from this session's live play

The resumed run + two smoke-test runs together added:

- **Enemy Room 67** (room 5, Safe tier) — first-ever room-5 capture.
  `enemyPathOptions[0]` at the room4→5 transition: tier 0 "Safe",
  `rolledEnemyStats` all zero, `enemyBuff: null`. The two alternatives
  offered (both tier 2 "Dangerous") had non-zero rolled stats and real
  buffs (`firebrand` — Burn on Sword wins; `perpetual_hemomancer` —
  lifesteal on Magic wins), confirming `pickSafeTier()` chose correctly.
  Real stats: HP/ARM 45/18, rock 15/8, paper 12/6, scissor 18/4, all
  maxCharges 3. Added to `ROOM_ENEMIES` (`src/sim/enemies.ts`).
  `MAX_OBSERVED_ROOM` moved 4 → 5 automatically (it's derived, not
  hardcoded).
- **7 new `OBSERVED_OFFERS` entries** across rooms 1-4, including the
  corpus's first-ever room-4 offer (`AddBlock(2,0) | AddLuck(1,0) |
  CorrosiveSword(2,0)`, picked AddBlock — clean). Sourced directly from the
  new fixture files, room/state numbers cited inline in `src/sim/boons.ts`.
- **2 new unmodelled boon types**: `CorrosiveSword` (room-4 offer, not
  picked), `LossBlockUp` (room-2 offer, not picked). Both added to
  `UNMODELLED_TYPES`'s expected list in `tests/boons.test.ts` (the constant
  itself in `boons.ts` is already derived, not hardcoded).
- 2 new room-1 clean/modelled boon picks (`UpgradeRock`, DEF-variant,
  offered twice more) — the first new room-1 CLEAN type added to any Wall-1
  test list since AddMaxArmor (session 06). `roomOne.length` 63 → 69,
  `clean` array gained two more `UpgradeRock` entries.
- 1 new room-2 Heal offer (`healRooms` [1,1,2] → [1,1,2,2]).

All of this was caught immediately by the existing test suite (5 failures
right after the smoke test), fixed with real captured data per CLAUDE.md §1
(never invented — every new `ROOM_ENEMIES`/`OBSERVED_OFFERS` entry traces
to a specific fixture file/room, cited inline).

## 4. Corpus-count test refactor (the "bookkeeping tax")

Session 18 found 4 stale hardcoded corpus-count literals after an
out-of-band commit; session 19's own notes said the same failure mode
"fired again this session, as expected." This session's OWN new fixture
data reproduced it a third time, live, within the session — before the
refactor landed, `npx vitest run` showed 5 failures purely from corpus
growth (not model bugs): `exchanges(runs).length` (417→474→ ultimately
irrelevant once refactored), `report.sideUpdates` (834→948→...), 
`pickups.length` (41→48), `ROOM_ENEMIES` vs corpus enemy-id mismatch (real
content gap, not bookkeeping — Enemy Room 67), `OBSERVED_OFFERS` fromTable
vs fromCorpus mismatch (also real content).

Refactored three files:

- **`tests/replay.test.ts`**: `exchanges(runs).length` and
  `report.sideUpdates` — both monotonic (corpus is append-only across
  sessions, never shrinks) — converted from `toBe(<literal>)` to
  `toBeGreaterThanOrEqual(<literal>)`. A genuine regression (fixtures
  deleted, `exchanges()` silently dropping transitions) still fails by
  falling below the floor; ordinary growth from new live play needs no
  edit.
- **`tests/boons.test.ts`**: `pickups.length` and `roomOne.length` (room-1
  option count) — same floor treatment, same reasoning. `healRooms` and the
  Wall-1 `clean` array are NOT monotonic-count assertions (they check WHICH
  types are clean, not how many total options exist) — left as exact
  `toEqual`, updated by hand with real new content, same as `OBSERVED_OFFERS`
  itself and `UNMODELLED_TYPES`'s expected list. The "no offer past room 3"
  test was renamed/updated to room 4 (a real depth change, not a bookkeeping
  drift — the corpus genuinely reached room 5 this session).
- **`tests/dungeonSim.test.ts`**: `battleCoverage.scored` and
  `deepestScorableRoom` (the Task-4-gate's fixed-seed sim numbers) are
  DIFFERENT in kind from the above — they're not monotonic (documented
  history: 1108→1120→1094→1097→1099→1087→1083→1126→1108→1127→1159 for
  `scored`; 4→3→4 for `deepestScorableRoom`), since new `OBSERVED_OFFERS`
  entries reshuffle which random boon draws land scorable at a fixed seed,
  in either direction. A floor doesn't fit a number that goes down as often
  as up. Converted to bounded ranges instead: `scored` now asserts
  `> 800 && < 1400` (covers every value seen across 10 sessions with
  margin); `deepestScorableRoom` now asserts `>= 1 && <= MAX_OBSERVED_ROOM`
  — both real invariants (Wall 1 guarantees a scorable room-1 battle; can't
  score deeper than the corpus has ever reached), not arbitrary bounds.

Final: `npx tsc --noEmit` clean, `npx vitest run` 351/351 (was 343/343 at
session start).

## 5. ROM claiming — user provided a major new data point mid-session

While working through the test refactor, the user pasted (unprompted, mid-
turn) the full response from an in-game panel called "ROMULATOR" — all 37
owned ROM NFTs, each with a `factoryStats` object including a real-time
`energyCollectable` field (current claimable amount, not a static number),
`secondsSinceLastEnergyClaim`, `percentageOfAWeekSinceLastEnergyClaim`
(suggesting accrual fills to `maxEnergy` over roughly a week per ROM), and
`maxEnergy = baseMaxEnergy * (1 + totalBoost)` where
`totalBoost = romBoost + juiceBoost`.

Summed `energyCollectable` across all 37 ROMs in that one snapshot:
**~3,252 energy** — about 7.7x the account's own 420 energy cap. This is a
completely different picture from session 19's single data point (~1
energy from one claim), which the session-19 brief and this session's own
brief both read as "may just be a small trickle."

Verified this wasn't a coincidence or a different currency before drawing
any conclusion. Two live claims, deliberately targeting SMALL
`energyCollectable` ROMs (large ones like the 315s/540s would mostly be
wasted against the 420 cap while real energy sat around 100-130):

```
$ npx tsx scripts/probeRomsFactoryClaim.ts 5345 --with-amount=12
BEFORE: energyValue=107
POST /roms/factory-claim {"romId":"5345","claimId":"energy","amount":12}
-> HTTP 200 {"success":true}
AFTER: energyValue=119
DELTA: 12
```

Snapshot showed `energyCollectable: 12` for romId 5345 — delta matched
exactly.

```
$ npx tsx scripts/probeRomsFactoryClaim.ts 689 --with-amount=999
BEFORE: energyValue=119
POST /roms/factory-claim {"romId":"689","claimId":"energy","amount":999}
-> HTTP 200 {"success":true}
AFTER: energyValue=131
DELTA: 12
```

Snapshot showed `energyCollectable: 11` for romId 689 (captured a few
minutes before the claim); delta was 12, consistent with a small amount of
continued live accrual in the interim, NOT with the deliberately-mismatched
`amount:999` mattering. Re-confirms session 19's finding that `amount` in
the request is fully cosmetic — the server always credits the ROM's own
real, currently-accrued `energyCollectable`.

**This means session 19's ~1-energy finding was correct but badly
unrepresentative** — that particular claim just happened to catch a ROM
with very little currently accrued, not evidence of a fixed per-claim
trickle or a hidden conversion factor.

Note on process: the harness's own auto-mode classifier blocked the FIRST
claim attempt outright (`scripts/probeRomsFactoryClaim.ts 5345
--with-amount=12`), something session 19's ROM claims never hit. Asked the
user directly in chat before proceeding (AskUserQuestion) rather than
retrying or working around it — got an explicit yes before either
verification claim ran.

**Not automated.** Per the standing instruction (session 19, still in
force): no automation of ROM claiming without a separate explicit go-ahead.
This session's work is sizing, not building. Two things logged as
genuinely open in SPEC.md/QUESTIONS.md: (1) the ROMULATOR snapshot's exact
source endpoint/URL, not yet confirmed — the user pasted the response
directly rather than a captured request; (2) how to sequence claiming
~3,252 energy against a 420 real cap without wasting most of it to
overflow — explicitly a user decision, not something to decide
unilaterally.

## Verification

```
$ npx tsc --noEmit
(clean)

$ npx vitest run
 Test Files  23 passed (23)
      Tests  351 passed (351)
```

Run against the final commit (00b49c0), not a mid-session check — per
CLAUDE.md's working-style rule (added session 19, after session 18 found a
stale passing-count claim).
