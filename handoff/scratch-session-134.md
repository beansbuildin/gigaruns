# scratch — session 134 — 2026-09-17 — fishing only

## Surprises
- **Day 20712's 12 run-units were ALREADY SPENT out of band.** `checkDungeonToday.ts`
  at 17:40Z: `dayProgressEntities` 12, updatedAt 2026-09-17T17:29:24Z. No log or
  fixture in this repo — played outside it. The brief's "12 run-units go unspent,
  no fifth gold point" is wrong on the ledger. Not a rule-13 event (this session
  issued no dungeon command).
- **Balance diff vs session 133's close is consistent with 4 T3 runs on dow 6:**
  - Crusader Gold (244) 25 -> 13 (−12 = 4 × 3). In the pre-registered set {Chobo, Crusader, Athena}.
  - The other six gold ROSE: Overseer 13->14, Foxglove 19->20, Archon 28->29,
    Athena 35->37, Summoner 36->37, Chobo 44->47. So there was ring INCOME out
    of band, and Crusader's −12 is a NET figure. WEAK point, not a clean 3×4.
  - Silver total unchanged at 159 (9/12/15/18/30/33/42).
  - Gear: 641 36->24 and 905 12->0 (−12 each); 640 48 and 901 12 (repaired, then −12?).
- **Gear forecast stale for a TENTH session:** the brief expected 640/901 at 0 —
  they read 48/12. 905 is now at 0 (dungeon arm only).
- Rod 812 = 24 as forecast (the first forecast to hold in a while).
- **The pin patcher was never committed** — it lived only in a prior session's
  scratchpad (outside the project; not read). Rebuilt as `scripts/pinPatch.ts`
  + `scripts/pinReporter.ts` (commit 40a692b2).
- vitest's JSON reporter truncates nothing in `failureMessages` for short arrays,
  but a custom reporter gets STRUCTURED `actual`/`expected` + `stacks[0]`
  line:col of the matcher name — the right anchor.

## Clock
- 17:40Z reads. Waited for the 18:00Z rollover (brief's recommendation).

## Census chase (session 133's +6) — all benign
- 78/27: AddMaxArmor(10), AddMaxHealth(14) ×2.
- 64/14, 64/11: AddMaxHealth(14) then shred.
- 50/37: run-09-15-17-46-40 is the RESUME of run 4 — state-000 is mid-run (50/25).
- 58/19, 58/21: AddMaxHealth(8), then AddMaxArmor at selectedVal1 2, twice
  (the boon def says val1Min/Max 1 — the selected value is 2; not fitted).

## Catch rate, pre-batch (corpus recompute)
- golkan 173/287 = 60.3%, shroom 45/82, dendren 54/104, unknown 32/109. 626 traces.
