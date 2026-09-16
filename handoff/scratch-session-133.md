# scratch — session 133 — 2026-09-16

## Session open (read live, 16:42Z)
- ⚠ Session 132 ended without a recap. Its captures + uncommitted code committed first (`e2500a76`,
  secretScan --scope=staged PASS). Recovery (scoring, pins, recap) runs AFTER the live day — the
  brief ordered recovery first, but 78 min remained on day 20711 and pins must follow the last cast anyway.
- JWT exp **2026-09-20T16:32:40Z**, 95.8h left (doctor.ts now prints it — session 132's uncommitted fix).
- Game day **20711, dow 5**, rollover 18:00Z (1h17m at 16:42Z). Run-units **0/12**. Fishing **0/20**, ledgers agree.
- Gold (tier 3, dropMultiplier 4): Foxglove 248 19, Overseer 245 25, Crusader 244 25, Archon 247 28,
  Athena 246 35, Summoner 249 36, Chobo 243 44. Summoner 36 = session 132's final read ✓.
- Silver: Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33, Overseer 42 (= 159) ✓.
- Gear LIVE: 109 19, 110 30, 204 4, 208 15, 50 0 (grandfathered, slot 8), 640 12, 641 48, **905 24**
  (was 2 at 132's end — repaired out of band), 901 12, **rod 812 44** (brief feared ~0; repaired out of band),
  slot-15 954 40 / 25. **NINTH consecutive stale gear forecast.**
- **[USER] in chat 16:43Z:** "4 T3 runs + 20 casts" — ONE authorization for the session.

## PRE-REGISTRATION — dungeon arm (committed before the first start_run)
1. **GOLD — the FOURTH gold point. Day 20711, dow 5.** Read after run 1 IN ISOLATION.
   - H1 shape: exactly ONE gold id moves, by exactly −3; six gold untouched. Tier-3 shape 12/12 → 13/13
     after run 1, 16/16 after run 4.
   - **H2 (permutation falsifier): NONE of Foxglove 248, Archon 247, Summoner 249.** A repeat kills the
     7-permutation.
   - Predicted SET: {243 Chobo, 244 Crusader, 245 Overseer, 246 Athena} — a random draw hits it 4/7.
   - **No favourite named.** Steps so far f5 → f4 → f6; fitting a rule to three points is a documented dead end.
   - If the day rolls to 20712 before a run starts: STOP.
2. **SILVER untouched at every read (159).**
3. **Hard Core 845 as a RATIO:** per-room ÷ 490 ∈ **[1.6, 2.4]**. Every per-run 845 ÷ 48 exact.
4. **Dendren Root 846 per death room** = SPEC §3c + room 5 from session 132: 5→141, 6→216, 7→309, 8→420,
   9→546, 10→687, 11→840, 12→1005, 13→1179, 14→1362.
5. **Gear path at −3/run, debit at start_run:**
   | after run | 640 | 641 | 901 | 905 |
   |---|---|---|---|---|
   | 1 | 9 | 45 | 9 | 21 |
   | 2 | 6 | 42 | 6 | 18 |
   | 3 | 3 | 39 | 3 | 15 |
   | 4 | 0 | 36 | 0 | 12 |
   640 and 901 reach 0 after run 4, the LAST run → dungeon arm halts for repair then (no run follows; moot today).
   Any piece at 0 after runs 1–3 → STOP the arm.
6. Run-units 0 → 3 → 6 → 9 → 12.

## PRE-REGISTRATION — fishing arm (Golkan 812)
- cap = min(rod 44, ledger 20, authorized 20) = 20. `SESSION_132_LIMITS` (castCap 12) reused unchanged:
  batch 1 = 12, batch 2 = `--casts=8` on a fresh ledger + rod read. Rod cannot run dry (44 > 20).
- Rod −1.00 per PLAYED cast → predicted 44 → 32 → 24 (played count; charged reported separately).
- Catch rate: no prediction. Reported on the **812-only** slice (session 132 finding: "golkan" pooled 811+812).
- If 18:00Z arrives mid-batch: stop after that batch.

## Live log
- Dry-run 16:54Z: `index 3`, 3x 131 (38 in stock), pool 420 covers 60.
- **Run 1** (16:55Z, `run-2026-09-16-16-55-13`): rc 0, 53 actions, 0/53 first-attempt failures. Energy 420→360.
- **⭐ FOURTH GOLD POINT (run 1 in isolation, read twice, stable): 245 OVERSEER Gold 25 → 22.** Six gold untouched,
  silver 159 untouched. H1 PASS (13/13). **H2 PASS — none of Foxglove/Archon/Summoner; permutation survives.**
  In the pre-registered 4-set. Gold map: dow2 f5 Foxglove, dow3 f4 Archon, dow4 f6 Summoner, dow5 f2 Overseer.
  (Silver dow2 was ALSO f2 Overseer — a coincidence at a different dow, not a fit.)
- Gear after run 1 exact: 640 9, 641 45, 905 21, 901 9; 204 4, 208 15, 109 19, 110 30 unchanged. Ledger 3/12.
- **Runs 2–4** (17:13Z / 17:18Z / 17:22Z): rc 0 each, 71 / 62 / 73 actions, 0 first-attempt failures. Ledger **12/12**.
  Gear exact at every read: 640 6/3/0, 641 42/39/36, 905 18/15/12, 901 6/3/0. **640 and 901 at 0 after run 4 (the
  last run) → [USER] dungeon HALT: repair both before the next dungeon day.**
- Gold after run 4: **Overseer 13** (25→22→…→13, −3 ×4); six gold + silver 159 untouched → shape **16/16**.

### Dungeon arm — SCORED (payout summed off post_response gameItemBalanceChanges; method re-validated on 132's 5 logs first)
| run | log | death room | 845 | ÷48 | 846 | table |
|---|---|---|---|---|---|---|
| 1 | 16-55-13 | 8 | 7,776 | 162 | 420 | 420 ✓ |
| 2 | 17-13-50 | 11 | 11,232 | 234 | 840 | 840 ✓ |
| 3 | 17-18-41 | 9 | 8,784 | 183 | 546 | 546 ✓ |
| 4 | 17-22-53 | 8 | 7,584 | 158 | 420 | 420 ✓ |
- 845: **35,376 / 36 rooms = 982.7/room = ×2.01** of 490 — band PASS. Every ÷48 exact.
- Pooled Tier-3, four days: 145,968 / 151 rooms = 966.7/room, ×1.97.
- 846 identity 4/4 → Tier-3 per-room total **15/15**.

### Fishing arm — SCORED
- Batch 1 (`fishing-2026-09-16-17-30-09`, 17:30Z): 12 played, **7/12**, 2 oils, rod 44→32, `cast_cap`. Ledger 10 left
  after 12 played (2 uncharged — Jebaitor; game 8 vs repo 9 mid-batch, game won, a GAIN).
- Batch 2 (`…-17-38-48`, `--casts=8`, 17:38Z): 8 played, **5/8**, 1 oil, rod 32→24, ended at its --casts target (no
  halt verdict — the batch target, not a halt condition). rc 0.
- **Day: 20 PLAYED / 17 CHARGED, 12/20 = 60.0%, 3 oils (Relaxing 9→8 held), rod 44 → 24 exact.** Stopped at the
  authorized 20 played with 3 ledger casts unused.
- **812-only slice (deckOf fixed this session): 173/287 = 60.3%.** Shroom 811 45/82 = 54.9% separately.

## Session 132 fishing — SCORED (from the two 09-15 logs)
- Batch 1 (17:50Z): 12 played, **8/12**, 4 oils, rod 24→12, `cast_cap`.
- Batch 2 (17:54Z): 10 played, **6/10**, 2 oils, rod 12→2, `ledger_exhausted`.
- **22 PLAYED / 20 CHARGED, 14/22 = 63.6%, 6 oils, rod 24 → 2 — did NOT reach 0.** Repaired out of band to 44 by 133 open.

## deckOf fix (redrawDeckSlice.ts)
- Card 74 is in both 811 and 812 grants; GOLKAN_IDS included it → Shroom casts filed as golkan. Now 812-exclusive ids
  only; Shroom keyed on 74/75/78. Reproduces 132's split exactly (811 34+11=45/82; 812 161/267 incl. 132's 14/22).
- §71 slice moves: SHROOM margin **+12**, GOLKAN-812 **−22** (606 traces). Reported only — §71 is [USER] HOLD.
