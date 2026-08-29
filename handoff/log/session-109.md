# session 109 — 2026-08-29 — the 2 remaining Tier-1 juiced runs, one at a time

**GATE PASS — 2 of 2 completed**, each its own `--runs=1` invocation with a stop
and a fresh user go-ahead between them. Standard rule 11; no chaining.

Live spend: 2 dungeon runs, 120 energy, 6 run-units, 6 Big Heal Juice committed
and 6 fired, 0 rings, 0 fishing casts. Ledger closed the day at 12/12.

---

## Step 0 — the potion fix, verified in code before any spend

The brief made this a precondition and it was checked against HEAD, not read off
session 108's recap:

1. `runPotionPolicyFor(potionPolicyState, potionCount, i, args.potionsUsed)` is
   called at `scripts/liveRun.ts:2362`, **inside** the per-run `for` loop and
   keyed on the loop index `i`. It returns
   `{ ...base, remaining: potionCount, used: i === 0 ? potionsUsed : 0 }` — a
   fresh object per iteration. The shared-and-mutated object is gone.
2. `tests/potions.test.ts` — **7/7 pass**, including all four
   `runPotionPolicyFor` cases and specifically *"hands each run its own object,
   so mutation cannot leak across runs."*

Then confirmed live, which is the part that actually matters: **3 of 3 potions
fired in BOTH runs**, `use_item` indices 0/1/2, all HTTP 200, independently
corroborated by stock 22 -> 19 -> 16.

---

## The blocker: a guard-budget day-key straddle

The first `--dry-run` fail-closed before spending anything:

```
  · resuming today's budget: 240 energy / 12 runs already spent
  · real server runs today: 6/12  ⚠ DRIFT from bot-tracked 12
✗ Guard tripped: session run cap reached {"attemptedRun":15,"cap":12}
```

`data/guard-budget.json` held `{date: "2026-08-29", energySpent: 240,
runsStarted: 12}` — session 108's entire four-run batch, attributed to today.

**Mechanism, traced in code rather than guessed.** `todayKey()`
(`guardPersistence.ts:99`) is correctly anchored at 11:00 Pacific and DST-aware.
The bug is in `saveGuardBudget` (~line 164), which writes
`{ date: todayKey(), energySpent, runsStarted }` — `todayKey()` evaluated at
WRITE time, against CUMULATIVE counters seeded at PROCESS START. Session 108's
one `--runs=4` process started 17:53Z (10:53 PT, key `2026-08-28`) and crossed
18:00Z (11:00 PT, key `2026-08-29`) between runs 2 and 3, so runs 3 and 4 wrote
180/9 then 240/12 under the new key.

**Same class as the potion bug** — in-process state that only misbehaves when
one process spans a boundary — and a second, independent cost of session 108's
chaining exception. **Not dungeon-only:** `liveFishing.ts:1799` uses the
identical pattern and runs autonomously across long batches. Failure direction
is fail-safe: it over-counts and blocks runs, never over-spends.

**Resolution.** The user chose "correct the ledger, then run." Set to the
server-authoritative `{date: "2026-08-29", energySpent: 120, runsStarted: 6}`
(runs 3+4 only), per CLAUDE.md §1. The next dry run reported `real server runs
today: 6/12 (matches bot-tracked count)`. The CODE is unfixed — QUESTIONS §65
carries the mechanism and a fix design.

---

## The two runs

| # | run id | outcome | Hard Core | Dendren Root | energy | potions |
|---|--------|---------|-----------|--------------|--------|---------|
| 1 | 25192447 | death @ room 7 | 1,632 | 309 | 60 | 3 committed / **3 fired** |
| 2 | 25192595 | death @ room 11 | 2,484 | 840 | 60 | 3 committed / **3 fired** |
| | | **2 deaths** | **4,116** | **1,149** | **120** | **6 / 6** |

Both `start_run` bodies byte-identical, read off the logged request:

```json
{"consumables":[131,131,131],"isJuiced":true,"index":1,"itemId":0,
 "expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}
```

`index: 1` ✓ `isJuiced: true` ✓ 3x131 ✓ **no `inputItems` key at all -> zero
rings** ✓

**Rule 8: 16/16 TIER-CHECK OK**, `violations: []` and
`chosenTier == eligibleTop` on every one. `perpetualFilteredTop=true` on **6 of
16 (38%)**. Final-room lowest-tier rule correctly never fired — deepest room 11
of `maxRoom` 16.

**Rule 13 exercised twice.** Server ledger read after each run: 6 -> 9 -> 12,
local guard agreeing at every step.

**0 first-attempt failures across 138 actions** (51 in run 1, 87 in run 2), all
action classes at 0.0%.

Energy accounting drift of -1 and -2 against committed 60 on the two runs — the
loop flags this itself as in-run passive regen (18/hr) and does not assert on it.
Expected on runs of this length.

---

## Room 11 — the deepest capture in 93 attempts

Run 2 died against `Enemy Room 73`. `ROOM_ENEMIES` stopped at `Enemy Room 72`
(room 10), so `dungeonReport.ts` printed **`death @ room unknown`** — the report
correctly failing closed on an enemy it had never seen, not a bug.

Added at room 11 / `RISKY_TIER`:

```
hp 60/60  armor 30/30  rock 24/8  paper 18/12  scissor 20/10
rolled { evasion: 4, block: 2, lck: 3, tenacity: 4 }
unmodelled: ["ROLLED_STATS"]
```

**Why the statline is a clean base despite a buff.** The enemy carried
`withering`, which `src/sim/enemyBuffs.ts` records as `kind: "mechanic"`
(applies 1 Weak on Scissor wins). It modifies no hp/armor/move number, so
`ENEMY_BUFF` is deliberately absent from `unmodelled` — unlike room 9's
`bloodthirsty`, which is `statOnly` and IS baked into that entry's ATK.

`ROLLED_STATS` still makes the battle unscorable. Per SPEC §4e those are 1-5%
proc chances needing hundreds of observations. **This is rule 8's documented
accepted cost, not a regression to repair** — CLAUDE.md says so explicitly.

I first considered NOT adding the profile, on the reading that a modified
capture shouldn't become a baseline. That was half right: `enemies.ts`'s own
session-53 note forbids *deriving* a baseline, not *recording the instance*, and
`Enemy Room 71` is the standing precedent for recording a rolled-stat capture
with an `unmodelled` marker. The `withering`-is-mechanic check is what settled
it.

---

## `AddLifestealSword` modelled — first pair since session 43

Offered repeatedly since session 43 and never picked, until run 1's room-4 orb
fallback took it (19 Hard Core out of [14, 15, 19], orbRule "wide").

**Whole-object diff of `players[0]` across state-065 -> state-066: only
`pickedBoons` grew by one.** Every other field identical.

**The zero is measured, not a blind spot** — the same check
`AddLifestealShield`'s comment demands. Three other boons in the SAME run moved
fields under the identical diff:

```
state-047→048  AddTenacity(2)        tenacity 1 -> 3
state-083→084  AddEvasion(10)        evasion  0 -> 10
state-095→096  AddIntuition(4)       intuition 0 -> 4
state-065→066  AddLifestealSword(2)  NONE
```

Modelled `{ kind: "latent" }`, `contaminates: ["STATUS_EFFECT"]`, matching its
two siblings exactly (`selectedVal1 2`, no field change).

**Why this did NOT need a user directive when `LossBlockUp` does.** It completes
an established family — `AddLifestealShield` (session 75) and
`AddLifestealMagic` (session 25) are already modelled with the identical
measurement. `LossBlockUp`'s own siblings, `LossEvasionUp` and `LossLuckUp`, are
still unmodelled, so there is no family to generalise from. That is the whole
distinction and it is now written into both the model comment and the test.
**Do not read the lifesteal decision as a precedent for `LossBlockUp`.**

---

## Pin updates (the suite went red because the corpus grew)

Five failures, all corpus-growth pins, none a real defect:

| pin | before | after | reason |
|---|---|---|---|
| `OBSERVED_OFFERS` exact match | 348 | 364 | +16 offers (run 1 rooms 1-6, run 2 rooms 1-10) |
| max offer room | 9 | 10 | run 2's room-10 offer is the first past room 9 |
| `UNMODELLED_TYPES` | 16 | 15 | `AddLifestealSword` moved out; none moved in |
| room-1 clean options | 255 | 261 | +6 = 2 runs x 3 room-1 options |
| loadout census | 55 | 61 | +6 combos, all mid-run |

The generated-vs-table diff was computed both ways: **16 corpus offers missing
from the table, and 0 table rows absent from the corpus** — purely additive.

**The max-offer-room invariant is not a coincidence and now says so in the
test:** you are offered a reward for CLEARING a room, so the room you die in
never yields one. It holds at 10 vs 11 and will keep holding until a run first
clears its deepest room — which across 84 deaths and 0 clears has never happened.

### The loadout census — the interesting one

All 6 new combos are mid-run, from run 2's single trace, **and not one is a new
starting loadout.** Both runs opened `50/17`, rock 16/0, paper 6/12, scissor
12/8, byte-identical, read off each run's OWN `start_run` response.

```
state-040  50/17 -> 74/17  AddMaxHealth(val1 24)
state-090  74/17 -> 74/14  corrode, exactly -3
state-094  74/14 -> 74/11  corrode again, exactly -3
state-108  74/11 -> 74/13  AddMaxArmor(+2)
state-110  74/13 -> 74/19  +6 restore at the next path choice
state-120  74/19 -> 88/19  AddMaxHealth(+14)
```

**This is a stronger confirmation than session 108's.** Session 108 noted that
chaining had "removed the only window a re-spec could have occurred in." This
session HAD that window — two separate invocations with a user-facing pause
between them, exactly where rule 11 expects skill points to be allocated — and
the loadout still held. DECISIONS 2026-08-27's "holds steady" ruling now has the
test it was previously missing.

**`AddMaxHealth val1 24` is the largest this table has ever recorded**, beating
the 14 session 103 flagged. Read `selectedVal1`; never assume the size.

The corrode trace re-confirms session 103's reading at a new depth: -3 exactly,
twice, with the 6 returning in a single +6 step at the next path choice rather
than in two.

---

## Surprises

**My own enemy-id -> room regex was off by one, and I caught it from a
contradiction.** `room:` PRECEDES `id:` in each `ROOM_ENEMIES` record, so a
regex matching `id:"..."` and then the next `room:` returns the FOLLOWING
entry's room. It made me write "room 5" in a comment for a room-4 pickup. Caught
because the generated `OBSERVED_OFFERS` rows disagreed with the comment I had
just written. True mapping is `Enemy Room N -> room N-62`, confirmed
independently by `Enemy Room 71 -> 9` and `72 -> 10` in their own comments. The
`Enemy Room 73 -> room 11` entry was right.

**Corpus and live room numbers differ by one BY CONSTRUCTION.** `boonPickups`
rooms an offer by the enemy in the `before` state — the room just CLEARED —
while `liveRun.ts` logs the room being ENTERED. Not a disagreement. Now stated
in the `AddLifestealSword` model comment so it is not rediscovered as a bug.

**A secret scan can return 0 because it read NOTHING.** My first scan piped
`git ls-files --others -z | xargs -0 cat` into grep and reported 0/4 patterns. A
direct grep then found the player address in the new fixtures. The zero was a
false negative from a broken pipe. Same class as CLAUDE.md rule 10: an
instrument that is not measuring returns the comfortable answer.

Resolved: `fixtures/**/raw/` is gitignored (`.gitignore:28`, added by an earlier
session that staged 104 address-bearing lines), so the address is confined to
files git will never commit. Re-scanned over the 290 actually-committable files
plus every added line: **0/4 patterns**, and the file count is printed as proof.

⚠ **Session 108's recap claimed "0 hits including the WIDENED 0x pattern" and
may have produced it the same broken way.** Its committed fixtures ARE clean —
`git grep` over 8,201 tracked fixture files finds the address 0 times — so the
conclusion held even if the method did not. **Always prove the file count the
scan covered.**

**Potion stock had been replenished** 2 -> 22 between sessions, so both runs
could load their 3 without the ROM/energy preflight or a stock guard firing.

---

## Verification

- `vitest run --maxWorkers=4` — **2138 passed / 2138, 111 files** (2121 -> 2138,
  +17)
- `tsc --noEmit` — clean, exit 0
- `git diff --check` — clean
- Secret scan — **0/4 patterns** (`0x[a-fA-F0-9]{4,}`, `noobId\s*\d`, `eyJ`,
  `PRIVATE`) over 290 committable new files AND every added line
- `tests/discoveredShipsClean.test.ts` — 8/8
- `.gitignore` — verified on `.env`, `*.key`, `data/`, `logs/`, `profiles/`,
  `fixtures/**/raw/`, `fixtures/**/*.har`
- Server ledger — 12/12, matching the local guard exactly
