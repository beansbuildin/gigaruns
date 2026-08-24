# scratch — session 88 (surprises as they land)

## §0 verification, 17:45–17:47 PT 2026-08-23
- Clock: 17:45 PT Sun 2026-08-23. Session 87 recapped ~17:30 PT SAME DAY.
  **No 11:00 PT rollover in between** — so the brief's "9 units / 3 runs" is the
  CARRIED figure, and it is still true. Confirmed against the server, not assumed.
- `dayProgressEntities` = **3 of 12** → 9 units → exactly 3 juiced runs. Gate meetable.
- Fishing `dayDocs[pondId 2]` = 20/20, BLOCKED 17.25h. Not being spent (by design).
- `doctor.ts` all green; token valid 113.2h; account `<USER>` `<ADDR>`.
- `tsc --noEmit` clean (exit 0).
- Suite: **11 failed files / 99; 70 failed, 1602 passed, 1 SKIPPED (1673).**
  - ⚠ rule 9, minor: the session-88 brief says "1603 passed / 70 failed". The real
    shape is **1602 passed + 1 skipped**. Same total, same failure count — the
    brief folded the skip into the pass column. Not a regression, just a wrong
    expectation string to carry forward.
- `--dry-run` clean. Its energy preflight read "pool 36 covers the planned 20" —
  that is the NON-juiced 20-energy base, because `--juiced` was not passed; the
  dry run also declined to load potions for exactly that reason and said so.
  Expect a different preflight line on the real juiced runs (60, ROM claim likely).
- ⚠ The dry run wrote `fixtures/dungeon-runs/run-2026-08-24-00-47-25` — a STUB
  dir, same shape session 87 tried to clean up with an over-wide `find -empty`.
  Named path, remove at recap; do NOT re-run a wide glob (session 87 dead end).

## Run log
(filled in as each run completes)

### RUN 1 — 25036015 — death @ room 7 — 5952 HC / 309 orbs — exit 0
- Ledger (rule 13): `dayProgressEntities` **3 -> 6**, exactly +3. Nothing denied/interrupted.
- Energy preflight: pool 36 short of 60 (deficit 24) -> ROM bank 37 ROMs / 2369 claimable
  -> claimed ONE ROM (6096, snapshot 170) -> pool 206. **claim audit drift +0.**
  Rule 12 in action: a raw energyValue of 36 would have looked like a blocker.
- **`tightDelta` PRESENT: 206 -> 146, tightDelta -60, estimatedCost 60, matchesCommitted TRUE.**
  Same as session 87. Run-level again shows 206 -> 147 (observed 59), so the +1
  credit lands DURING the run, not at start_run. **Two runs, two agreements.**
- **`EV support` PRESENT: 0/46 fully modelled, 46 (100.0%) unsupported.** Expected under rule 8.
- First-attempt failures **0/55** (paper 12, rock 17, scissor 14, paths 6, rewards 6).
- Rule 8: 6 TIER-CHECKs, all OK. **perpetualFilteredTop=TRUE at rooms 5 and 6** —
  the never-a-Perpetual clause is load-bearing again (room 6 fell all the way to tier 0).
- Boons: 6 picked, 0 first-ever unmodelled, 2 unmodelled offered, UNMODELLED_TYPES 24.
  No WeakeningMastery recurrence. One boon_priority_conflict: AddLifestealSword
  demoted at room 6 (earlyGameMaxRoom 8), AddLuck taken.
- Potions: 3x itemId 131 loaded from stock 20; 3 use_item posts in the log (all used).
- ⚠ NO base-6/8/10 crit seen. Capture still outstanding.

### RUN 2 — 25036128 — death @ room 5 — 4176 HC / 141 orbs — exit 0
- Ledger (rule 13): `dayProgressEntities` **6 -> 9**, exactly +3. Nothing denied/interrupted.
  **3 units / exactly ONE juiced run remain.**
- Energy preflight: **pool 148 covered 60 — NO ROM claim needed this run.**
- **`tightDelta` PRESENT: 148 -> 88, tightDelta -60, matchesCommitted TRUE. THREE FOR THREE**
  (s87 run, s88 run 1, s88 run 2). The 3x multiplier stays exonerated.
- **`EV support` PRESENT: 0/39 fully modelled, 39 (100.0%) unsupported.**
- First-attempt failures **0/44**.
- Rule 8: 4 TIER-CHECKs, all OK, `perpetualFilteredTop` FALSE on all four (contrast run 1,
  where it fired twice). Boons: 4 picked, 0 first-ever unmodelled, UNMODELLED_TYPES 24,
  **zero** boon_priority_conflicts.
- Room 5 death is inside the documented juiced spread (rooms 3-10). Not a regression.

#### ⚠ FINDING — §23's remaining half just got cheaper, for free
The run-level drift warning names its own suspect: *"Possible external balance change
(e.g. a ROM claim) landed mid-run."* **Run 2 made NO ROM claim** (pool 148 already
covered 60) and STILL read `148 -> 89, observed 59, committed 60` — the same -1.
So the mid-run-ROM-claim explanation is **FALSIFIED** for this run, and the warning
string is misleading. Regen (18/hr against an integer pool) survives as the candidate
and is now the only one standing of the two named. **NOT asserted as proven** — one
run is one run, and run 1 DID claim, so run 1 alone could not have separated them.
This is exactly the offline §3 item the brief listed, answered by the runs themselves.

### RUN 3 — 25036263 — death @ room 9 — 8160 HC / 546 orbs — exit 0
- Ledger (rule 13): `dayProgressEntities` **9 -> 12**. **DAY CLOSED, 12/12.** No discrepancy.
- Energy preflight: pool 90 covered 60 — no ROM claim.
- **`tightDelta` PRESENT: 91 -> 31, tightDelta -60, matchesCommitted TRUE. FOUR FOR FOUR.**
- **`EV support` PRESENT: 0/50 fully modelled, 50 (100.0%) unsupported.**
- First-attempt failures **0/63**. Deepest + richest of the three.
- Rule 8: 8 TIER-CHECKs all OK; perpetualFilteredTop TRUE at rooms 7 and 9.
- 8 boons picked (incl. AddMaxHealth, AddMaxArmor - priority families), 0 first-ever
  unmodelled, UNMODELLED_TYPES 24. No WeakeningMastery recurrence in any of the 3 runs.
- ⚠ `critEffects` appears **0 times** in the log. Base-6/8/10 crit capture STILL outstanding.

## §23's REMAINING HALF — substantially answered, at zero extra cost
The question was: what credits energy back DURING a run? Three converging pieces:
1. **ROM claim FALSIFIED as the cause.** Run 2 made no claim (pool 148 covered 60) and
   still drifted -1. The drift warning's own suggested culprit is wrong.
2. **THE POOL WAS CAUGHT TICKING MID-RUN, DIRECTLY.** Run 3's `energy_accounting`
   recorded `before: 90`; its own `start_run_energy_probe`, seconds later, recorded
   `energyBefore: 91`. **+1 between two reads inside one run's startup, no claim between.**
   This is an observation, not an inference.
3. **Drift tracks DURATION in the right direction:**
   | run | wall duration | credited back |
   |-----|---------------|---------------|
   | 25036128 | 2m43s (2.72m) | 1 |
   | 25036015 | 3m25s (3.42m) | 1 |
   | 25036263 | 4m06s (4.10m) | 2 |
   At 18/hr an integer pool ticks once per ~200s; windows of 163/205/246s contain
   0-1 / 1-2 / 1-2 ticks, so 1/1/2 is consistent under phase dependence.
**VERDICT: regen is strongly supported and ROM-claim is out. NOT proven** — n=3 and the
tick phase is unmeasured. **The drift was still NOT "fixed"** (per §23), but the warning
STRING at the drift site is now known to name the wrong suspect and should be reworded.

## Session totals
- 3 juiced runs, rooms 7 / 5 / 9, HC 5952 + 4176 + 8160 = **18288**, orbs 309+141+546 = **996**.
- First-attempt failures **0/162** across all three runs.
- `tightDelta -60` on 3/3; `EV support` printed on 3/3 (0/46, 0/39, 0/50 = 0/135, 100% unsupported).
- Fishing: **0 casts, by design.** Budget was already 20/20 spent before the session began.
- Potions: 9x itemId 131 consumed (stock 20 -> 17 -> 14 -> 11).
