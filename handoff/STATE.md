# STATE — session 109 — 2026-08-29 — code at commit <SHA>

## Status
Brief was **dungeon only: the 2 remaining Tier-1 juiced runs, one at a time,
standard rule 11 (no chaining). GATE PASS — 2 of 2 completed**, each its own
`--runs=1` invocation with a stop and a fresh user go-ahead between them.
Live spend: **2 dungeon runs, 120 energy, 6 run-units, 6 Big Heal Juice
committed and 6 fired, 0 rings, 0 fishing casts.** Today's ledger is now
**12/12 — exhausted**, resetting 11:00 Pacific.

Suite **2138 passed / 2138, 111 files** (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — session 100,
unchanged). `tsc --noEmit` clean, `git diff --check` clean, secret scan **0 hits
on all four patterns** over the 290 committable new files AND every added line,
`discoveredShipsClean` 8/8, `.gitignore` verified on all seven required paths.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. Entries marked **[USER]** are user
directives an agent may not re-open at all.

**Dropped this session** (folded into something that self-enforces): **the
potion-chaining bug** (now `runPotionPolicyFor` + 4 tests that fail if it
regresses, and verified live 6/6 this session — see What works); **rod
durability per cast played** and **redraw** (both quiet for many sessions, and
neither is at risk of being proposed as new dungeon work); and the two
**tenacity** entries, merged into one below.

- **[USER] Chaining is a ONE-TIME, DATED exception, not a rule change.**
  Session 108 ran `--runs=4`; rule 11 pins `--runs=1` with a stop between runs.
  **Session 109 ran the standard way and it worked**, which removes the last
  excuse. DECISIONS 2026-08-29. Re-opens as: *"chain the runs like last time."*
- **The guard-budget day-key straddle, FIXED IN DATA not in code.** A process
  crossing 11:00 PT stamps its CUMULATIVE counters onto the new day, so
  session 108's batch left the local ledger reading 12/12 against a server 6/12.
  Corrected to the server-authoritative 120/6; **the code path is still there.**
  DECISIONS 2026-08-29, QUESTIONS §65. Re-opens as: *"the guard ledger and the
  server disagree"* or *"reset the guard budget"* — the correction is done; the
  CODE FIX is genuinely open and is the one carried task.
- **`AddLifestealSword` is modelled `latent`**, first pair, run 1 room 4,
  completing the lifesteal triple with the already-modelled Shield and Magic
  siblings. DECISIONS 2026-08-29. Re-opens as: *"AddLifestealSword has a pair
  but no model"* or *"close the lifesteal coverage gap."*
- **Room 11 is captured; `Enemy Room 73` is in `ROOM_ENEMIES` at tier 1.**
  Deepest ever, superseding room 10. Its `withering` buff is `mechanic`, so the
  statline is a clean base. DECISIONS 2026-08-29. Re-opens as: *"add the room-11
  enemy"* or *"why does the report say death @ room unknown."*
- **The loadout HOLDS STEADY, now tested against a real re-spec window.**
  Both runs opened `50/17` byte-identical across two separate invocations with a
  user pause between them. DECISIONS 2026-08-29. Re-opens as: *"confirm the runs
  are still one arm."*
- **Consumables are debited at `start_run`, not at `use_item`.** Measured,
  stock 14 -> 2. DECISIONS 2026-08-29. Re-opens as: *"do unused potions get
  refunded."*
- **`BurnMastery` amplifies the burn TICK, not the recorded amount.** 719/719
  exact without it, 0/12 with. **x2 vs +3 is UNSEPARATED.** DECISIONS
  2026-08-29. Re-opens as: *"burn has exceptions again"* — *"BurnMastery
  doubles burn"* is NOT settled.
- **The zero-stat proc control is falsified for `intuitionProc0` ONLY**, 1 event
  in 1716, and **the mapping SURVIVES** on a dose-response. DECISIONS
  2026-08-29. Re-opens as: *"a proc flag fired at stat 0, the mapping is
  broken."* It is a base rate.
- **JEBAITOR, and its gap, MEASURED.** ~9% of casts do not count against
  `dayDocs`. Re-opens as: *"the cast ledgers disagree."* **A sub-25-cast batch
  is NOT evidence the budget is too low.**
- **Tier-1 Hard Core payout.** MEASURED, not derived: `dropMultiplier` governs
  item 845 ONLY, at an exact 4:1 quantum. DECISIONS 2026-08-28. Re-opens as:
  *"measure the first live Tier-1 run."*
- **The no-proc null.** Damage = attacker's `currentATK` on 1645/1645
  status-clean exchanges. DECISIONS 2026-08-28. Re-opens as: *"the null rate is
  falling"* — a MIXED-population rate is composition-bound.
- **`tenacity` / `intuition` as damage mitigation RULED OUT, and tenacity
  PICK-ORDER RETIRED** (redundant given the stat by construction). §58, §62,
  §63. Re-opens as: *"find what tenacity does"* — heal AMOUNTS are what is open.
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. DECISIONS 2026-08-26.
  Re-opens as: *"settle whether triggeredBoons populates."* **No runs may be
  spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — a
  positive finding, not missing data. DECISIONS 2026-08-27.
- **[USER] Rule 11 entry tier is Tier-1 (`--juiced-index=1`), 0 rings.**
  `data.index` is the TIER; `entryData` is ordered 2, 1, 3. Exercised live
  **10/10** now. Re-opens as: *"correct the juiced index"* — a positional 'fix'
  selects Tier 2 and spends silver rings.
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1 forbids re-raising
  it. Re-opens as: *"report the accumulated unspent skill XP."*
- **Suite invocation.** `vitest run --maxWorkers=4`. DECISIONS 2026-08-26.

## What works
- **Both runs, run the standard rule-11 way.** Separate invocations, exit 0, no
  fail-closed stop. **0 first-attempt failures across 138 actions.**

  | # | run id | outcome | Hard Core | Dendren Root | energy | potions |
  |---|--------|---------|-----------|--------------|--------|---------|
  | 1 | 25192447 | death @ room 7 | 1,632 | 309 | 60 | 3 committed / **3 fired** |
  | 2 | 25192595 | death @ room 11 | 2,484 | 840 | 60 | 3 committed / **3 fired** |
  | | | **2 deaths** | **4,116** | **1,149** | **120** | **6 / 6** |

- **The potion fix VERIFIED IN CODE BEFORE ANY SPEND (brief Step 0), then live.**
  `runPotionPolicyFor` is called INSIDE the per-run loop (`liveRun.ts:2362`,
  keyed on loop index `i`), returning a fresh object per run;
  `tests/potions.test.ts` 7/7 including *"hands each run its own object."*
  Live: 3 of 3 fired in BOTH runs, `use_item` indices 0/1/2, all HTTP 200.
  Independently confirmed by stock 22 -> 19 -> 16.
- **Both `start_run` bodies byte-identical**, read off the logged request:
  `{"consumables":[131,131,131],"isJuiced":true,"index":1,"itemId":0,
  "expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}`. `index: 1` ✓
  `isJuiced: true` ✓ 3x131 ✓ **no `inputItems` key at all -> zero rings** ✓
- **Rule 8: 16/16 TIER-CHECK OK**, `violations: []` and
  `chosenTier == eligibleTop` on every one. `perpetualFilteredTop=true` on
  **6 of 16 (38%)** — the never-a-Perpetual clause is load-bearing. Final-room
  rule correctly never fired (deepest room 11 of `maxRoom` 16).
- **Rule 13 exercised twice.** Server ledger read after each run: 6 -> 9 -> 12,
  local guard agreeing at every step.

## What's broken
- ⚠ **The guard-budget day-key straddle is UNFIXED IN CODE.** `saveGuardBudget`
  stamps `todayKey()` from WRITE time onto counters seeded at PROCESS START, so
  a process crossing 11:00 PT attributes its pre-rollover spend to the new day.
  Found at this session's first dry run, which fail-closed
  (`attemptedRun: 15, cap: 12`) against a server reading 6. **I corrected the
  DATA, not the code** — user-approved, server-authoritative. Same class as the
  potion bug: in-process state that only misbehaves across a boundary.
  **Not dungeon-only** — `liveFishing.ts:1799` uses the identical pattern and
  runs AUTONOMOUSLY across long batches. Failure direction is SAFE (over-counts
  -> blocks runs, never over-spends). QUESTIONS §65 has the fix design.
- ⚠ **The secret scan can report 0 because it read NOTHING.** My first scan
  piped `git ls-files -z | xargs -0 cat` into grep and returned 0/4; a direct
  grep then found the player address in the new fixtures. Resolved — it lives
  only under gitignored `fixtures/**/raw/`, and a scan scoped to the 290
  actually-committable files is genuinely 0/4. **Session 108's identical claim
  may have come from the same broken construction**; its committed fixtures ARE
  clean (`git grep` over 8,201 tracked fixture files finds the address 0 times),
  so its conclusion held even if its method did not. **Always prove the file
  count the scan covered.**
- ⚠ **`LossBlockUp` has a live pickup pair and no model** — deliberately.
  QUESTIONS §64 asks for the directive. Carried UNCHANGED from session 108.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z.
  No renewal path in-repo; manual copy from the browser.

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched** — nothing in the
  live responses contradicted them this session.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not add a room-11 SAFE baseline by deriving it.** `withering` is
  `kind: "mechanic"` so room 11's statline is already clean, but its rolled
  stats (ev4/bl2/lk3/ten4) keep the battle unscorable. That is rule 8's
  documented accepted cost, not a regression to repair.
- **Do not trust an enemy-id -> room regex that reads `room:` AFTER `id:`.**
  `room:` PRECEDES `id:` in each record, so such a regex returns the FOLLOWING
  entry's room. It cost me a wrong room number in a comment. True mapping is
  `Enemy Room N -> room N-62`.
- **Corpus and live room numbers differ BY ONE, by construction** — corpus rooms
  the offer by the room just CLEARED, `liveRun.ts` logs the room being ENTERED.
  Not a discrepancy; don't "fix" either.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live: 2 dungeon runs, 120 energy, 6 run-units, 4,116 Hard Core, 1,149
  Dendren Root, 0 rings, 0 fishing casts.**
- Rooms reached: 7, 11 (mean 9.0). Both ended in death. **Room 11 is the
  deepest in 93 recorded attempts.**
- **0 first-attempt failures / 138 actions.**
- Potions: **6 committed, 6 fired** — the number that silently diverged last
  session, matched in both runs.
- Tier choices 16, all rule-8 compliant; 6 Perpetual-filtered.
- Corpus **91 -> 93 dungeon attempts**; fishing unchanged at 273 casts.
- Suite **2121 -> 2138** (+17: 16 new `OBSERVED_OFFERS` rows as per-pickup cases,
  plus the new `Enemy Room 73` profile case).

## Open questions for Claude
1. **Fix the guard-budget rollover straddle in code?** QUESTIONS §65 has the
   design (memo the day key per path at load; on a key change, write
   `cumulative - baseline`). It bit twice in two sessions and reaches
   autonomous fishing. **This is the one concrete carried task.**
2. **`LossBlockUp` — may it be modelled as `latent` from n=1?** QUESTIONS §64.
   Same n and measurement as session 99's `LossIntuitionUp`, which the user
   approved. Note `AddLifestealSword` was modelled this session WITHOUT a
   directive because it had two modelled siblings; `LossBlockUp` has none — that
   is the whole distinction. **Second session blocking.**
3. **BurnMastery: x2 or flat +3?** Unseparable — all 12 observations are
   `after: 3 -> tick: 6`. Arrives on its own through play; spend no runs on it.
4. **The `nextPosition` override is LIVE and steering fishing card choice** with
   still no user sign-off. Carried UNCHANGED from sessions 105/106/107/108.
5. **The fishing guard counter over-counts** (`runsStarted` 25 on a 22-played /
   20-charged batch). Carried from 107; out of scope for two dungeon sessions
   running.
6. **Is the Tier-1 arm now the baseline for everything downstream?** Session
   103's Tier-3 numbers are not comparable on any payout statistic and several
   reports still quote them. **Fifth session unactioned.**

## Files changed
```
 handoff/reports/dungeon-runs.md          |  10 +-
 handoff/reports/fishing-casts.md         |   2 +-
 src/sim/boons.ts                         | 121 +++++++++++++++++++++++++
 src/sim/enemies.ts                       |  31 +++++++
 tests/boons.test.ts                      |  32 ++++++-
 tests/enemies.test.ts                    |  37 ++++++++
 fixtures/dungeon-runs/run-2026-08-29-... | 290 files (new, 2 runs)
```
