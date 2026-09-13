# scratch — session 130 — 2026-09-13

## Session open (read live, 16:58Z)
- doctor: token valid another **167.6h** — does NOT bind; the day does (rollover 18:00Z, ~1.0h).
- Game day **20708, dow 2**. Run-units **0/12** (`dayProgressEntities` null). Fishing **0/20**.
- **Tier 3 OFFERED**, `dropMultiplier 4`, `inputsBasedOnFactionDay: true` (printed off tier 3's own entry).
  Gold ids (entryData order, amounts all 1): 245 Overseer 25, 244 Crusader 25, 248 Foxglove 31,
  246 Athena 35, 247 Archon 40, 243 Chobo 44, 249 Summoner 48 — **gold total 248**.
- Silver (instrument only): Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33,
  Overseer 42 — **total 159**, matches STATE 129 exactly.
- Gear LIVE (brief's table stale again, 2 of 7 rows): 640 48, 641 24, **901 24** (was 0 — repaired),
  905 12, rod 924 27, slot-15 954 **10 / 20** (was 10 / 0 — repaired). Item 50 slot 8 at 0, grandfathered.
- `liveRun.ts` sends `index` straight to the server (no positional `entryData` lookup anywhere in it);
  dry-run printed **"isJuiced:true, index 3"**. Trap checked, not present.
- **[USER] authorization, in chat, 2026-09-13 ~17:01Z: "Yes: 4 T3 + 10 casts"** — confirms the Tier-3
  directive the brief quoted AND authorizes the session. **[USER] Vengeance: "Model it".**

## PRE-REGISTRATION — dungeon arm (committed before the first start_run)

1. **GOLD charge shape — a Tier-2 claim tested at Tier 3 for the FIRST time. New counter 0/0;
   Tier-2's 49/49 is CLOSED as a Tier-2 figure.**
   - H1: exactly ONE gold id moves per run, by exactly −3, six untouched.
   - H2 (weaker, stated separately): the gold faction follows the SILVER dow map, so dow 2 → f2 →
     **245 Overseer Gold 25 → 22 → 19 → 16 → 13**.
   - Falsifiers: >1 gold id moves; an amount other than 3; (H2 only) a different faction moves.
2. **SILVER untouched: all seven identical before and after every run (159).** Any silver move is a finding.
3. **Dendren Root (846) — TIGHT test.** Answers to `isJuiced` alone. Tier-2 reference session 125:
   2,874 over 4 runs (~718/run). Prediction: 4-run total within **±25% of 2,874 (2,155–3,590)**.
   **Falsified if the ratio to Tier 2 is ≥ 1.5** (i.e. it moved with the tier).
4. **Hard Core (845) — LOOSE test, pre-registered as a RATIO.** Tier-2 reference session 125:
   19,608 over 40 death-rooms (9/11/7/13) = **490 HC/room**. Prediction: Tier-3 HC-per-room ÷ 490
   ∈ **[1.6, 2.4]**, centre 2.0. Room depths reported beside it. Totals are depth-dominated and not
   predicted.
5. **Gear path at −3/run on slots 11/12/13×2:**
   | after run | 640 | 641 | 901 | 905 |
   |---|---|---|---|---|
   | 1 | 45 | 21 | 21 | 9 |
   | 2 | 42 | 18 | 18 | 6 |
   | 3 | 39 | 15 | 15 | 3 |
   | 4 | 36 | 12 | 12 | **0 ← break** |
   905 breaks at the END of run 4, the last authorized run; the dungeon arm halts after it, which costs nothing.
6. Run-units 0 → 3 → 6 → 9 → 12.

## DUNGEON ARM — RESULTS (4/4 runs, 17:04:17Z → ~17:25Z, day 20708 dow 2)

| run | log | actions | 1st-attempt fails | death room | 845 | 846 |
|---|---|---|---|---|---|---|
| 1 | 17-04-18 | 75 | 0 | 9 | 8,736 | 546 |
| 2 | 17-10-46 | 62 | 0 | 9 | 9,264 | 546 |
| 3 | 17-14-59 | 57 | 0 | 10 | 9,696 | 687 |
| 4 | 17-19-06 | 103 | 0 | 14 | 14,208 | 1,362 |
| **Σ** | | **297** | **0/297** | 42 | **41,904** | **3,141** |

Payout summed from `gameItemBalanceChanges` in the run logs; method VALIDATED first against session
125's recorded day (19,608 / 2,874 reproduced exactly).

1. **GOLD charge, Tier-3 count: 4/4 one faction at −3 (readings: 31 → 28 after run 1; 22 read DURING
   run 3; 19 read DURING run 4; 19 at close).** ⚠ Runs 2 and 3 are one combined reading (−6 over two
   entries) — the between-run print in my loop used the wrong awk columns and lost run 2's number.
   H1 PASS. **H2 FALSIFIED: the charged gold faction on dow 2 is FOXGLOVE (248), not Overseer (245).**
   The silver dow map does not govern gold.
2. **Silver untouched on all readings — 159.** PASS.
3. **Dendren Root 3,141 vs 2,874 = ×1.09** — inside ±25%, below 1.5. PASS. ⭐ And sharper than
   registered (found AFTER registration, so labelled as such): **846 is a deterministic function of the
   death room, identical across tiers** — room 9 → 546, room 10 → 687 on both Tier 2 (sessions
   125/129/09-09..09-11) and Tier 3 today. Room 14 → 1,362 is new and continues the increment series.
4. **Hard Core 41,904 / 42 rooms = 997.7/room ÷ 490 = ×2.04** — inside [1.6, 2.4]. PASS. Room-matched
   (post-registration): room 9 T3 mean 9,000 vs T2 mean 4,219 (n=5) = ×2.13; room 10 T3 9,696 vs T2
   mean 5,016 (n=4) = ×1.93.
5. **Gear EXACT at every reading:** 45/21/21/9 → 42/18/18/6 → 39/15/15/3 → **36/12/12/0**. 905 broke at
   the end of run 4 as predicted → dungeon arm HALTED (costs nothing; all authorized runs done).
6. Run-units 3 → 6 → 9 → 12. PASS.

## PRE-REGISTRATION — fishing arm (committed before the first cast)
- Scope: user authorized 20; **binding cap is GEAR at 10** (slot-15 pair 10 / 20, −1.00/PLAYED cast).
  Rod 924 at 27 (slack), ledger 0/20 CHARGED (slack). `SESSION_130_LIMITS.castCap = 10`.
- Predicted close: slot-15 **10 → 0 and 20 → 10**, rod **27 → 17**, exit `cast_cap` at played 10, and
  the fishing arm HALTED on gear after it. Charged ≤ 10 (free casts make charged < played).
- Oils Relaxing-only; Focus triggers log policy-withdrawn.
- Catch rate: NO prediction. Reported as a Puppeteer-only slice, never pooled into Dendren.

## Surprises log
- `checkEntryTiers.ts`'s Tier-3 cost block is TEMPLATED off the Tier-2 finding ("3x ONE of the seven,
  Measured live, session 112", silver rotation text) — it asserts the Tier-2 charge shape for gold
  without any Tier-3 measurement. The instrument prints a hypothesis as fact.
- `doctor.ts` still suggests `--juiced-index=2` in its "ready" banner.
