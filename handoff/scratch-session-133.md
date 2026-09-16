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
