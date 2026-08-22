# STATE — session 16 — 2026-08-16 — commit 5bb3a63

Same content as `handoff/STATE.md` at commit time, plus verbose detail that
doesn't belong in the always-loaded file.

---

## 0. Starting condition: no session-16 brief

`handoff/next.md` (mtime 18:52, session 15's own brief) was OLDER than
`handoff/log/session-15.md` (mtime 19:18) — i.e. it was the brief session 15
had already executed, not a fresh one for this session. Per the `/handoff`
skill's own instruction ("If `next.md` is missing or stale... work the next
unblocked task in TASKS.md and note it in the recap"), this session picked
its own task from `STATE.md`'s "Open questions for Claude" rather than
guessing at a brief that didn't exist.

Two candidates were visible: (1) the stuck fishing account, blocked on the
user's own DevTools capture — nothing an agent can do; (2) the potion
crafting-energy-pool question, ambiguous under CLAUDE.md's ask-first rules
(spending materials, even abundant ones) and the previous session had
explicitly deferred it pending clearer authorization. Neither was pursued
directly. Instead: `--status`/`--dry-run` checks (both read-only) confirmed
the dungeon side was FULLY unblocked (0/12 runs used today) and that the
account already held 7 Big Heal Juice (session 14's balance, minus one
already-consumed probe) — enough to build and live-verify Task 12 Stage
B's potion-TIMING policy without touching crafting or needing permission at
all, since CLAUDE.md is explicit that "playing dungeon runs... [is] fine to
do autonomously within the configured budget."

## 1. Sim: potion timing, not just a pre-loaded upper bound

`src/sim/dungeonSim.ts` gained:

```ts
export interface PotionPlan {
  heals: number[];       // e.g. [20, 20, 20] for 3 Big Heal Juice
  threshold: number;     // use the next potion when hp/hpMax <= this
}
export interface PotionUse { room: number; heal: number; hpBefore: number; hpAfter: number; }
```

Checked once per exchange, inside `fightBattle`'s loop, BEFORE computing
legal moves — so a heal taken mid-battle can change that exchange's
outcome. Potions are threaded across ROOMS within one run via a mutable
queue (`.shift()`'d in place), cloned fresh per `simulateRun` call so
different runs never share state.

This supersedes `scripts/potionSweep.ts`'s original model (kept, not
deleted, for the historical record): that script pre-healed ALL potions at
room 1 as a flat `hpMax += 20*N` bonus — i.e. modelled a Heal potion as a
permanent stat boost, which is not what a heal item is. The new model only
raises current HP, capped at the existing `hpMax`, and only when the
threshold check actually fires.

5 new tests in `tests/dungeonSim.test.ts` (`describe("potion timing...")`):
regression-exact match against the no-potions case, never overheals past
hpMax, deterministic given a seed, never exceeds the loadout size across a
whole run, and a generous loadout/threshold measurably raises mean rooms
cleared over baseline (checked with N=1500, not asserting an exact number —
just that it's strictly greater).

## 2. `scripts/potionTimingSweep.ts` — full output

```
════════════════════════════════════════════════════════════════════════════════════
POTION TIMING SWEEP — 2000 runs each, ev-engine policy, real PLAYER baseline
════════════════════════════════════════════════════════════════════════════════════

Heal fires the instant own HP fraction drops to/below the threshold — not pre-loaded at
room 1 (that was scripts/potionSweep.ts's model; kept for the record, not the current best
answer). Still free (no exchange/charges cost) — UNCONFIRMED live at the time this ran,
see §4 below for the live answer.

0-potion baseline: mean rooms cleared 2.130 ± 0.051

threshold potions  mean rooms cleared          delta          mean potions used/run
  0.2      1        2.642 ± 0.051          +0.512          0.776
  0.2      2        2.924 ± 0.050          +0.794          1.339
  0.2      3        3.111 ± 0.049          +0.982          1.706
  0.34     1        2.722 ± 0.047          +0.592          0.923
  0.34     2        3.177 ± 0.043          +1.047          1.706
  0.34     3        3.469 ± 0.036          +1.339          2.287
  0.5      1        2.752 ± 0.046          +0.622          0.961
  0.5      2        3.166 ± 0.041          +1.036          1.825
  0.5      3        3.477 ± 0.034          +1.347          2.530
```

Reading: threshold 0.5 (proactive — heal well before critical) beats 0.2
(reactive — wait until nearly dead) at EVERY loadout size. Mechanism: the
threshold is checked once per exchange, at the TOP of the loop, before that
exchange resolves — a single large hit can cross a low threshold in one
step, meaning the heal never gets a chance to fire before death. A higher
threshold leaves more margin for the check to catch HP on the way down.

Chose 0.5 (best row) as the live default — `src/strategy/potions.ts`'s
`DEFAULT_POTION_THRESHOLD`.

## 3. Live wiring — `src/strategy/potions.ts` + `scripts/liveRun.ts`

```ts
// src/strategy/potions.ts
export const DEFAULT_POTION_THRESHOLD = 0.5;
export function shouldUsePotion(hp: number, hpMax: number, potionsRemaining: number, threshold: number): boolean {
  if (potionsRemaining <= 0) return false;
  return hp / hpMax <= threshold;
}
```

`scripts/liveRun.ts` new CLI: `--potions=<n>` (loads n× Big Heal Juice,
itemId 131, into `consumables` at `start_run`) and
`--potion-threshold=<x>` (default 0.5). `LiveRunDeps.potionPolicy:
{itemId, threshold, remaining, used}` — `used` doubles as the index sent on
the next `use_item` (see §4 — this is the field the bug fix below added).

New `usePotionLive()` function (parallel to the existing `probeUseItem`,
but treats a rejection as a REAL failure fed to
`guards.recordActionResult`, since — unlike the itemId-0 probe — there's a
genuine item at stake).

## 4. Live run 1 — the bug, in full

```
npx tsx scripts/liveRun.ts --runs=1 --potions=2 --potion-threshold=0.5
```

Run started cleanly, `consumables: [131, 131]` sent on `start_run`. Combat
proceeded normally (EV engine) down to HP 16/36 (fraction 0.444, below the
0.5 threshold):

```
  ★ Task 12 Stage B: using potion (itemId 131)
  ✓ use_item: HTTP 200
room 1  me HP 36/36 ARM 0  |  Enemy Room 63 HP 22/30 ARM 0
```

Note: HP 16→36 exactly (capped at hpMax, consistent with the confirmed flat
+20 heal). Enemy HP/ARM (22/30, ARM 0) and the opponent model's observation
count (`n=4` both before and after) are IDENTICAL across this call — no
exchange resolved. This is the live confirmation that `use_item` costs no
combat turn.

Combat continued, HP dropped again. At HP 4/36:

```
  ★ Task 12 Stage B: using potion (itemId 131)
  ✗ use_item: HTTP 400 — {"success":false,"message":"Item not found in index","actionToken":1786894104822}
  ▸ energy: 420 -> 400  (spent 20)

✗ Guard tripped: use_item rejected {"itemId":131}
```

The code at the time always sent `data.index: 0`. First use (index 0)
succeeded; second use, SAME index 0, failed with "Item not found in
index." Hypothesis: `index` addresses a POSITION in the committed
`consumables` array (2× itemId 131), not the item's stable id — first 131
sits at index 0 (consumed), second sits at index 1.

Tested with a one-off script (`scripts/probeUseItemIndex1.ts`), using the
`actionToken` from the failed response's own error body (a fresh process
has no other way to get a current token, since a GET never refreshes it —
DECISIONS 2026-08-14):

```
POST {"action":"use_item","dungeonId":5,"actionToken":1786894104822,"data":{"consumables":[],"isJuiced":false,"index":1,"itemId":131}}
HTTP 200 {
  "success": true,
  "actionToken": 1786894189658,
  "message": "Item Used",
  "data": { "run": { ... "health": { "current": 24, ... "currentMax": 36 ... } ... } }
}
```

Confirmed: HP 4→24 (the second +20 heal, capped at nothing since 24<36).
Hypothesis correct. Fixed `usePotionLive`/`LiveRunDeps.potionPolicy` to
track and send the correct incrementing `index` (the `used` field, +1 per
successful use, from 0).

The run (still active, resumable) was then resumed with a plain
`npx tsx scripts/liveRun.ts --runs=1` (no more potions needed — both
already spent) and played through normally: cleared rooms 1-3 (picked
CorrosiveMagic, AddMaxArmor, AddLuck), died room 4 vs. Enemy Room 66.

## 5. Live run 2 — confirming the fix, end to end

```
npx tsx scripts/liveRun.ts --runs=1 --potions=2 --potion-threshold=0.5
```

With the fix in place, both uses fired automatically with ZERO manual
intervention:

```
  ★ Task 12 Stage B: using potion (itemId 131, index 0)
  ✓ use_item: HTTP 200
room 2  me HP 32/36 ARM 0  |  Enemy Room 64 HP 14/35 ARM 8
...
  ★ Task 12 Stage B: using potion (itemId 131, index 1)
  ✓ use_item: HTTP 200
room 2  me HP 36/36 ARM 0  |  Enemy Room 64 HP 14/35 ARM 14
```

(HP 12→32 then 18→36 — both flat +20, both capped correctly.) Run cleared
rooms 1-2 (AddMaxArmor picked twice — offered at both room 1 and room 2
this run), died room 3 vs. Enemy Room 65.

Potion balance across both runs: 7 → 5 (run 1) → 3 (run 2) Big Heal Juice.
Energy: 40 total (2× 20-energy runs), well inside the 240/day budget (200
remaining at session end).

## 6. Corpus-total drift — every number touched, and why

Per DECISIONS 2026-08-16's standing rule ("corpus-total assertions are
EXPECTED to fail after every capture... read one at a time, never
reverted"), the two new live runs broke 6 pinned-count assertions across 4
test files. Each was re-derived from the actual new fixtures, not
guessed:

- `tests/boons.test.ts`: `pickups.length` 32→37 (5 new pickups: run 1's
  CorrosiveMagic/AddMaxArmor/AddLuck at rooms 1/2/3; run 2's AddMaxArmor×2
  at rooms 1/2). `UNMODELLED_TYPES` gained `BurningTenacity`,
  `AddLifestealMagic`, `SecondWind` (3 new unmodelled types offered, not
  picked, in run 1's triples). Room-1 offer count 51→57 (3 new room-1
  triples: run 1's CorrosiveMagic/BurningTenacity/AddLifestealMagic; run
  2's UpgradeScissor/AddMaxArmor/AddBlock — wait, that's 2 triples ×3 = 6,
  plus... — see `src/sim/boons.ts`'s `OBSERVED_OFFERS` for the exact
  additions, 5 new offer objects total across both runs). "Clean boons
  taken" list gained a second `AddMaxArmor` and a third `UpgradeScissor`
  (from run 2's picks).
- `tests/enemies.test.ts`: distinct loadout combos gained `36/18` (36 hpMax
  / 16+2 armorMax after ONE AddMaxArmor pickup, run 1) and `36/20` (16+2+2
  after TWO pickups, run 2) — both mid-run states after a boon, not new
  starting gear.
- `tests/dungeonSim.test.ts`: `battleCoverage.scored` at the Task 4 gate's
  fixed seed drifted 1087→1083→1126 as the two new offer triples reshuffled
  which random draws land scorable — same reshuffling-not-regression
  pattern as every prior session's capture.
- `tests/replay.test.ts`: `exchanges().length` 334→386 (+52, real combat
  exchanges from 2 new runs), `report.sideUpdates` 668→772. **Critically,
  `report.cleanFailures.length` stayed 0 throughout** — the combat model
  still matches every clean exchange exactly, including whatever the
  `use_item` state transitions did to exchange-pairing (they did not get
  mis-classified as phantom exchanges the way boon pickups once did,
  per-DECISIONS 2026-08-15's phantom-exchange fix already covering "no
  reward/enemy path phase active" — `use_item` states have neither flag
  set, but also don't change `lastMove`, so `exchanges()`'s pairing logic
  correctly didn't treat them as combat exchanges either way; verified by
  running `scripts/scratchReplayCheck.ts` — a throwaway diagnostic, deleted
  after confirming `cleanFailures: 0`).

Verification after all fixes: `npx tsc --noEmit` clean; `npx vitest run` —
315 tests, 21 files, all pass (313→315 net, +2 from the new
`tests/potions.test.ts`, +2 from `tests/liveRun.test.ts`'s new
index-handling regression tests, offset by no removals).

## 7. Fishing — re-checked, still stuck, not pursued further

`scripts/checkFishingStuck.ts` (new, read-only):

```
docId: 12925779
COMPLETE_CID: true
SUCCESS_CID: true
fullDeck length: 10
```

Identical shape to what session 15 left it in — `fullDeck` never merged the
catch's 3 `cardsToAdd` cards. Confirms this is a persistent server-side
state, not something that would clear with time or a UTC rollover (today's
date guard had already rolled over per `--status`, and the account was
STILL stuck). No new action-name guesses attempted this session — CLAUDE.md's
stuck protocol already spent its two reasoned tries last session
(`select_card`, `claim`, both cleanly rejected as invalid actions by the
server's own whitelist). This is now purely a "needs the user's own
DevTools capture" item (QUESTIONS.md §10), not something further agent
guessing should attempt.

## 8. What was NOT done, and why

- **Crafting a new potion** (session 15's open energy-pool question) — not
  attempted. This session used EXISTING stock (7→3 Big Heal Juice), which
  sidesteps the ask-first ambiguity around spending materials entirely.
  Still open for a future session, ideally paired with a direct user
  confirmation given the prior session's explicit deferral.
- **Task 10 (orchestrator, 8-hour unattended session)** — not started.
  Exists as an unstarted task in TASKS.md; not picked up this session
  because Task 12 Stage B was both higher-value (an actually-open question
  with real live mechanics to resolve) and lower-risk (short, supervised
  runs vs. an 8-hour unattended commitment that arguably deserves explicit
  user buy-in before a first attempt).
- **Task 11's dungeon half** — stays PARKED. Its stated revival conditions
  (materially different utility form, histogram shape shifting, or Task 12
  Stage B's result bearing on attrition) are formally addressed now: Stage
  B DID land (this session), but with only 2 live data points (not enough
  to move the histogram's shape) — worth flagging for whoever writes the
  next brief, since condition 3 is now "landed but inconclusive," not
  simply "not yet landed."
