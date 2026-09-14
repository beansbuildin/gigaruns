# scratch — session 131 — 2026-09-14

## Session open (read live, 15:57Z)
- JWT exp **2026-09-20T16:32:40Z**, **144.6h** left — does NOT bind; the day does (rollover 18:00Z, ~2.0h).
- Game day **20709, dow 3**. Run-units **0/12** (`dayProgressEntities` null). Fishing **0/20** (both ledgers agree).
- Tier 3 offered, `dropMultiplier 4`. **Gold 236**: Foxglove 248 **19**, Overseer 245 25, Crusader 244 25,
  Athena 246 35, Archon 247 40, Chobo 243 44, Summoner 249 48 — matches brief claim B exactly.
- **Silver 159**: Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33, Overseer 42 — matches C.
- Gear LIVE (brief's table stale again — SEVENTH session): 640 36, 641 12, 901 12, **905 26** (was 0 — repaired),
  **rod slot 14 = 812 Golkan at 44** (already equipped by the user before the session),
  slot-15 954 …83b834fd **20** (was 0 — repaired), 954 …ac25b641 **10**. Item 50 slot 8 at 0, grandfathered.
- **[USER] in chat, 2026-09-14 ~16:05Z: "Golkan yes: 4 T3 + 20 Casts"** — confirms the Golkan (812) rod
  directive the brief quoted AND authorizes this session: 4 juiced Tier-3 runs + 20 casts.
  **20 casts is NOT reachable on current gear** — the 954 at 10 wears −1/played cast and halts the arm at 10.
  Said so to the user at the top: batch 1 = 10, then halt → hand back for repair → resume on a fresh read.

## PRE-REGISTRATION — dungeon arm (committed before the first start_run)

1. **GOLD — the SECOND gold-rotation point. Day 20709, dow 3.**
   - H1 (shape): exactly ONE gold id moves per run, by exactly −3; six gold untouched. Tier-3 shape count 4/4 → 8/8.
   - **H2 (permutation falsifier, the sharp test): the charged faction is NOT Foxglove 248.** A second Foxglove
     charge (19 → 16 → 13 → 10 → 7) kills "gold is a 7-permutation of dow" outright.
   - Predicted SET under H2: {243 Chobo, 244 Crusader, 245 Overseer, 246 Athena, 247 Archon, 249 Summoner}.
   - **Named candidate H3 (one of many, not a favourite): "gold = silver shifted by one day" → dow 3 = silver dow 4
     = Summoner Gold 249: 48 → 45 → 42 → 39 → 36.** Expected because it is the only named map that fits the one
     observed point; its prior is barely above 1/6 — a miss is not surprising, a hit is not a solve (n=2).
   - If the day rolls to 20710 before a run starts (it should not — ~2h slack), falsifier stays "not Foxglove"
     and H3 becomes Chobo 243.
2. **SILVER untouched: all seven identical before and after every run (159).** Any silver move is a finding.
3. **Hard Core (845) — RATIO, not total.** Tier-2 reference 490 HC/room. Prediction: Tier-3 HC-per-room ÷ 490
   ∈ **[1.6, 2.4]**, centre **2.04** (session 130's measurement). Also: every per-run 845 amount divides by 48.
4. **Dendren Root (846) — per DEATH ROOM, never totals.** Each run's 846 equals the SPEC §3c table for its
   death room: 6→216, 7→309, 8→420, 9→546, 10→687, 11→840, 12→1005, 13→1179, 14→1362. Falsified by any
   mismatch at a tabled room. Rooms outside 6–14 are new table entries, not tests.
5. **The rod stat line — opening loadout on Golkan.** Session 129/130 openings on rod 924: hpMax **50**,
   Sword (rock) ATK **26**, armorMax 17. Pre-2026-09-12 on rod 923: **51/27**.
   - H-rod: the unbooned `state-000` of run 1 reads **hpMax 51, rock ATK 27** (armor 17) → the fishing rod
     carries a DUNGEON stat line (924 subtracts 1/1 relative to 812/923).
   - Null: reads **50/26** → the 51→50 coincidence was not the rod.
   - Anything else (e.g. a third reading) → record, assert no cause.
6. **Gear path at −3/run on 640/641/901/905:**
   | after run | 640 | 641 | 901 | 905 |
   |---|---|---|---|---|
   | 1 | 33 | 9 | 9 | 23 |
   | 2 | 30 | 6 | 6 | 20 |
   | 3 | 27 | 3 | 3 | 17 |
   | 4 | 24 | **0 ← break** | **0 ← break** | 14 |
   641 and 901 break at the END of run 4, the last authorized run; the dungeon arm halts after it, costs nothing.
7. Run-units 0 → 3 → 6 → 9 → 12.

## PRE-REGISTRATION — fishing arm (to be committed separately, before the first cast)
(pending)

## Surprises log
- `doctor.ts` does not print JWT expiry any more (brief says "verify with doctor.ts"); decoded `exp` directly.
- 812 was already equipped at session open — the brief's step 1 ("the user equips 812") landed out of band.
