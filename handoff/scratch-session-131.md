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

## Dungeon arm — raw result (read live after each run; scored at recap)
- Runs exit 0 ×4, actions 73/46/74/72 = **265, 0/265 first-attempt failures**; run-units 12/12.
- **Gold: Archon 247 40 → 37 → 34 → 31 → 28** (−3 ×4). Six gold untouched. **All seven silver untouched (159).**
  H1 PASS (shape 8/8). **H2 PASS — not Foxglove; the permutation survives.** **H3 (Summoner) FAILED.**
- Gear exact on every reading: 640 33/30/27/24, 641 9/6/3/**0**, 901 9/6/3/**0**, 905 23/20/17/14. Dungeon arm HALTED
  (641 + 901 at 0 after the last authorized run — cost nothing).
- The batch loop's own exit 1 was the trailing `[ $rc -ne 0 ] && break` test, not a run failure.

### Dungeon arm — SCORED
| run | dungeon run id | death room | 845 | 845/48 | 846 | SPEC §3c 846 for room |
|---|---|---|---|---|---|---|
| 1 | 25578265 | 9 | 8,448 | 176 | 546 | 546 ✅ |
| 2 | (17-04-24 log) | 6 | 5,424 | 113 | 216 | 216 ✅ |
| 3 | (17-07-44 log) | 10 | 8,976 | 187 | 687 | 687 ✅ |
| 4 | (17-12-40 log) | 11 | 10,848 | 226 | 840 | 840 ✅ |
- Method validated first: the same `gameItemBalanceChanges` summer reproduces session 130's **41,904** exactly.
- **845: 33,696 over 36 rooms = 936/room → ÷490 = ×1.91. PASS** ([1.6, 2.4], centre 2.04). Every amount ÷48 exact — PASS.
- **846: 4/4 per-room identity PASS** (rooms 6/9/10/11 all tabled). Total 2,289 — NOT compared (depth-confounded).
- **Rod stat line: NULL.** Every opening on Golkan 812 reads **hpMax 50, armor 17, rock ATK 26** (×4) — the same as on
  924. The rod does NOT carry a dungeon stat line; the 51→50 / 27→26 coincidence with the 923→924 swap was NOT the rod.
  (Cause of the −1/−1 still unknown; 923 itself untested, but 812 ≠ 924 is now shown irrelevant.)

## PRE-REGISTRATION — fishing arm (committed before the first cast)
1. `CURRENT_ROD` repointed 924 → **812** BEFORE the first cast (preflight needs it). `rodDeck.test.ts`
   "CURRENT_ROD is that rod" expected **RED now, GREEN after the first recorded Golkan cast.**
2. The first cast is dealt Golkan's grant `[74,80,81,84,85,86,87,88,89,90]` (not BASE_DECK, not Puppeteer's).
3. Batch `SESSION_131_LIMITS.castCap 10` — bound by GEAR (slot-15 …ac25b641 at 10). **Played 10.** Charged ≤ 10,
   reported separately.
4. Gear path: slot-15 …83b834fd 20 → **10**, …ac25b641 10 → **0 ← fishing arm halts**; rod 812 44 → **34**.
5. Catch rate — CONTINUATION of Golkan 183/307 = 59.6%. Expected ~6/10; 90% binomial band **3–9**.
   **≤ 2 caught is a flag** (P ≈ 1.2% at 59.6%) that the post-era Golkan arm diverges. n=10 settles nothing else.
6. Oils Relaxing-only (19 held); Focus triggers log policy-withdrawn.
7. After the halt: stop, hand back for the slot-15 repair; casts 11–20 only on a fresh gear read.

## Fishing batch 1 — raw result
- 10 PLAYED; GAME ledger **8/20** vs repo guard **9** charged — disagree by one, both recorded. Caught **5/10**
  (casts 1,2,3,5,10). Golkan continuation **188/317 = 59.3%**. In band (3–9) PASS; no divergence flag.
- Gear exact: slot-15 …83b834fd 20→10, …ac25b641 10→**0** (arm halted), rod 44→34 (−1.00/played cast). 1 Relaxing (19→18).
- The UNKNOWN FIELD lines in this batch came from the process that loaded liveFishing.ts before the registry edit.

## PRE-REGISTRATION — fishing batch 2 (committed before its first cast)
- **[USER] "resume fishing"** in chat ~17:36Z, after an out-of-band repair; covered by the session's 20-cast scope.
- Fresh read 17:36:55Z: slot-15 …83b834fd **10**, …ac25b641 **20** (repaired 0→20); rod 812 **34**; ledger 8/20
  (12 left). ALSO repaired/changed out of band: **641 0→60**, and slot 13's 901 is a NEW INSTANCE (…37fba31e) at 24.
- Binding cap = min(gear 10, authorization remainder 10, ledger 12, rod 34) = **10** — `SESSION_131_LIMITS` unchanged.
- Gear path: …83b834fd 10→**0 (halt)**, …ac25b641 20→10, rod 34→24.
- Catch: same band 3–9 of 10; ≤2 flags. Rollover 18:00Z is ~23 min out; a batch took ~3.5 min.

## Fishing batch 2 — raw result
- 10 PLAYED, **4 caught** (casts 1,2,4,6). Golkan continuation **192/327 = 58.7%**. In band PASS.
- Ledgers now AGREE at **17/20** (game 8→17, repo 9→17): the batch-1 8-vs-9 gap closed — the game ledger lagged one
  cast. Session total: **20 played / 17 charged**.
- Gear exact: …83b834fd 10→**0 (halt)**, …ac25b641 20→10, rod 34→24.
- **[USER] mid-batch "run up to 15 casts, ledger shows 12/20 left"** arrived AFTER batch 2 had started at castCap 10.
  Not actionable: gear halt (…83b834fd at 0), 3 left on the ledger, rollover 18:00Z at 17:56Z. Handed back.

## Offline findings so far
- **Golkan card coverage: the "8 of 10 (82, 83 absent)" claim is FALSE.** All ten of `ROD_CARD_GRANTS[812]` are in
  `cards.json`; E[fish-HP delta per play] at random aim computes **0.400 exactly** = the session-129 brief's figure.
  82/83 are not Golkan cards. −0.389 is not reproduced by the grant list, by 80–89, or by 74+80–88 — its source is
  unknown and it is RETIRED. The two numbers were never a deck-coverage discrepancy.

## Pin pass
- Suite after the live work: 72 failed (batch 1), then 62 after batch 2 landed mid-pass. Snapshot of `tests/` taken
  first (scratchpad). Patcher parses EVERY failure and refuses to write if any literal is unanchored; a second-round
  hit on a pin already carrying a session-131 annotation replaces the value and keeps the original "was".
- Hand edits: OBSERVED_OFFERS +32 (generated, multiset 32/0), loadout census +3 (chased), KNOWN_CRIT_ANOMALIES +1,
  Wall-1 clean +Heal +UpgradeRock, Heal rooms +1,+4, oil docIds +13419650 +13419927, gap set +13419933, four ratio
  pins with BOTH halves, redraw in-sample "2.2" → "2.1", toMatchObject ×7, arrays ×8, procEffectSize slice-aware,
  redrawTrigger deck-explicit, rodDurability Golkan default case. 190 `[session 131, day 20709]` annotations.
- **GREEN: 2752/2752, 117 files.**

## Surprises log
- `doctor.ts` does not print JWT expiry any more (brief says "verify with doctor.ts"); decoded `exp` directly.
- 812 was already equipped at session open — the brief's step 1 ("the user equips 812") landed out of band.
- Gear repaired/changed out of band MID-SESSION, between the batches: 641 0→60, a NEW 901 instance (…37fba31e) at 24,
  slot-15 …ac25b641 0→20. The dungeon arm is therefore NOT halted at close on 641; the old 901 (…492d8277) left slot 13.
- The batch loop's trailing `[ $rc -ne 0 ] && break` makes the background task report exit 1 on success.
- A blanket patcher writes full precision into `toBeCloseTo(x, 1)` sites — rounded back by hand (blockedMove pct).
- The JSON reporter carries no diff for arrays/objects; the default reporter does.
