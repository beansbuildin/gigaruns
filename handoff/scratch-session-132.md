# scratch — session 132 — 2026-09-15

## Session open (read live, 17:06Z)
- JWT exp **2026-09-20T16:32:40Z**, **119.4h** left — does not bind; the day does.
- Game day **20710, dow 4**, rollover 18:00Z (~53 min at open). Run-units **0/12**. Fishing **0/20** (ledgers agree).
- Tier 3 offered, dropMultiplier 4. **Gold 224**: Foxglove 248 19, Overseer 245 25, Crusader 244 25, Archon 247 28,
  Athena 246 35, Chobo 243 44, Summoner 249 48 — brief claim B exact. **Silver 159** (9/12/15/18/30/33/42) — claim C exact.
- Gear LIVE: slot2 109 19, slot3 110 30, **slot6 204 4**, slot6 208 15, slot8 50 0 (grandfathered), 640 24, 641 60,
  905 14, 901 24, **rod 812 24**, slot15 954 0 / 10 (no longer halting).
  ⚠ slot-6 204 at 4 has never been tracked per run; if it wears −3/run it hits 0 after run 2 → dungeon arm halt.
- Dry-run: `index 3`, 3x item 131 loaded (8 in stock), energy pool 413 covers 60.
- **[USER] in chat ~17:08Z:** "Go now on day 20710"; rod: "No repair - cast until broken or until ledger runs out,
  I will repair if broken."; authorization: "Yes — 4 T3 runs + casts". One authorization for the session.

## PRE-REGISTRATION — dungeon arm (committed before the first start_run)

1. **GOLD — the THIRD gold point. Day 20710, dow 4.** Read after run 1 IN ISOLATION.
   - H1 shape: exactly ONE gold id moves, by exactly −3; six gold untouched. Tier-3 shape 8/8 → 9/9 after run 1, 12/12 after run 4.
   - **H2 (permutation falsifier): NEITHER Foxglove 248 NOR Archon 247.** A repeat kills the 7-permutation.
   - Predicted SET: {245 Overseer, 244 Crusader, 246 Athena, 243 Chobo, 249 Summoner} — a random draw hits it 5/7.
   - Named expectation (nominal, ~1/5 prior): **Athena 246 (faction 3)** — the only structure in two points is
     faction 5 → 4, a −1 step; continuing it gives 3. A 2-point extrapolation, not a model; a miss is expected.
   - NOT predicted from the silver dow map or silver-shifted-by-one (both falsified, digest).
   - n=3 narrows the set; it does not solve the order.
   - If the day rolls to 20711 before a run starts: STOP (new day, new authorization).
2. **SILVER untouched at every read (159).**
3. **Hard Core 845 as a RATIO:** per-room ÷ 490 ∈ **[1.6, 2.4]**, centre 1.98 (pooled Tier-3). Every per-run 845 ÷ 48 exact.
4. **Dendren Root 846 per death room** = SPEC §3c: 6→216, 7→309, 8→420, 9→546, 10→687, 11→840, 12→1005, 13→1179, 14→1362.
5. **Gear path at −3/run** (from the live read):
   | after run | 640 | 641 | 901 | 905 |
   |---|---|---|---|---|
   | 1 | 21 | 57 | 21 | 11 |
   | 2 | 18 | 54 | 18 | 8 |
   | 3 | 15 | 51 | 15 | 5 |
   | 4 | 12 | 48 | 12 | 2 |
   No halt on these four. Slot-6 204 (4): NO prediction — untracked; recorded per run.
6. Run-units 0 → 3 → 6 → 9 → 12.

## PRE-REGISTRATION — fishing arm (Golkan 812)
- [USER] cap = min(rod, ledger, authorized). Rod 24, ledger 20 charged, authorized 30. User: cast until the rod
  breaks or the ledger runs out.
- Batch 1 `castCap 12` (SESSION_132_LIMITS). Batch 2 sized on a fresh gear + ledger read, ≤ remaining rod.
- Rod −1.00 per PLAYED cast. Played and charged reported separately.
- No catch-rate prediction beyond: Golkan cumulative recomputed from the corpus at recap, post-revert sub-slice alongside.
- If 18:00Z arrives mid-batch: stop after that batch; day 20711 needs its own authorization.
