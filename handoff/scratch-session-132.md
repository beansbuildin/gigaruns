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

## Dungeon arm — raw result (live)
- **Run 1** (17:19Z, `run-2026-09-15-17-19-23`): rc 0, 70 actions, 0/70 first-attempt failures. Energy 414→355.
  Death room **10**. 845 **9,360** (÷48 = 195 exact) → 936/room = ×1.91. 846 **687** = table room 10 ✓.
  Payout method re-validated first: reproduces session 131's 8448/5424/8976/10848 and 546/216/687/840 and rooms 9/6/10/11 exactly.
- **⭐ THIRD GOLD POINT (run 1 in isolation, read twice, stable): 249 SUMMONER Gold 48 → 45.** Six gold untouched,
  all seven silver untouched (159). H1 shape PASS (9/9). **H2 PASS — neither Foxglove nor Archon; permutation survives.**
  In the pre-registered set. Named nominal Athena (−1 step extrapolation) FAILED.
  Note: Summoner is what the falsified "gold = silver shifted by one" predicted for dow 3 (session 131) — it came a day late. Not a fit.
- Gear after run 1 exact: 640 21, 641 57, 905 11, 901 21. **Slot-6 204 stayed 4** (and 208 15, 109 19, 110 30) — not dungeon-wear pieces.
- Ledger before run 2: 3/12.

## Fishing corpus — RECOMPUTED (pre-batch, 584 casts; loadCastTraces → splitByDealtDeck.rod → deckOf)
- deckOf "golkan" slice: **192/327 = 58.7%** — the carried arithmetic reproduces EXACTLY. Post-revert last 20: **9/20 = 45.0%**.
- ⚠ SURPRISE: that "Golkan" slice POOLS TWO RODS — by grant-subset of the opening deck: **811 45/82 = 54.9%** and
  **812 147/245 = 60.0%**. "Never pool across rods" — the Golkan cumulative has been an 811+812 pool.
- Other rod slices reproduce: 923 Dendren 54/104 = 51.9%, 924 Puppeteer 11/27 = 40.7%; 922 21/82 = 25.6% (older era).
- **Runs 2, 3**: rc 0, 37 / 74 actions, 0 failures. Summoner 45→42→39; gear −3 exact each (640 18/15, 641 54/51, 905 8/5, 901 18/15).
  Slot-15 954 …83b834fd read **25** after run 2 (was 0) — repaired out of band mid-session.
- **Run 4 (17:33Z)**: `start_run` OK (energy 238→178), then **`✗ fetch failed`** (network) in room 5, HP 45/50, rc 1.
  Rule 13 ledger read at 17:45Z: **run-units 12/12**, Summoner **36**, six gold + silver 159 untouched → shape **12/12**.
  Gear 640 12, 641 48, 905 2, 901 12 — exact; no piece at 0 → no halt. Gear debit lands at start_run, not at run end.
- **[USER] ~17:46Z:** "Resume run 4 now" → `--resume-existing` (no new run-unit).
- **[USER] fishing:** "complete all fishing casts, ignore gear breaks, ask me for the approval on fishing now so I can
  step away" → confirmed option **"Approve: up to 24 casts"** — Golkan, batches ≤12, lures ignored, rod at 0 a hard
  stop, crossing 18:00Z allowed, rule 5 stands.
- **Run 4 resumed** (`--resume-existing`, 17:46Z): "active run already exists at room 5 — resuming", rc 0, 62 actions,
  0 failures; ledger still **12/12** (no new charge). Died room 11. Gear unchanged by the resume (640 12, 641 48, 905 2, 901 12).

### Dungeon arm — SCORED
| run | log | death room | 845 | ÷48 | 846 | table |
|---|---|---|---|---|---|---|
| 1 | 17-19-23 | 10 | 9,360 | 195 | 687 | 687 ✓ |
| 2 | 17-25-13 | 5 | 3,552 | 74 | 141 | (room 5 new: 141) |
| 3 | 17-28-02 | 11 | 10,944 | 228 | 840 | 840 ✓ |
| 4 | 17-33-09 + 17-46-39 (resume) | 11 | 4,512 + 6,624 = 11,136 | 232 | 141 + 699 = 840 | 840 ✓ |
- 845: **34,992 over 37 rooms = 945.7/room = ×1.93** Tier 2's 490 — band [1.6, 2.4] **PASS**. Every per-run ÷48 exact.
- Pooled Tier-3, three days: 110,592 / 115 rooms = 961.7/room, ×1.96.
- 846 per-room identity **3/3** at tabled rooms; room 5 → 141 is a new table entry (run 4's pre-drop segment ALSO read 141 on
  reaching room 5 — consistent, not a second test). Tier-3 per-room total now 11/11.
- Gold: Summoner 48→45→42→39→36. Shape **12/12**. Silver 159 untouched at every read.
- Actions 70 + 37 + 74 + (≈? pre-drop) + 62; first-attempt failures 0 in every printed tally. One network `fetch failed` (run 4).
