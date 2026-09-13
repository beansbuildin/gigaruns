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

## PRE-REGISTRATION — fishing arm (to be committed separately, before the first cast)
(pending)

## Surprises log
- `checkEntryTiers.ts`'s Tier-3 cost block is TEMPLATED off the Tier-2 finding ("3x ONE of the seven,
  Measured live, session 112", silver rotation text) — it asserts the Tier-2 charge shape for gold
  without any Tier-3 measurement. The instrument prints a hypothesis as fact.
- `doctor.ts` still suggests `--juiced-index=2` in its "ready" banner.
