# scratch — session 138 (2026-09-25)
- Open: next.md is the s134 brief (stale vs log s137) -> worked s137's GATE FAIL (15 pin refusals).
- Ledger at open 04:48Z: pond 2 20/20 (day 20720 spent). No fishing possible until 18:00Z.
- Q2 (crit anomalies): day 20720 = 11/63 hits (17.5%) vs corpus 34/1304 (2.6%), p~1e-6.
  Ruled out: Focus oil (8/47 no-oil vs 3/16 post-oil), rod repair (8 of 11 BEFORE ~03:24Z),
  jebaitorTriggered (7/155 vs 38/1212). All 14 fit x1.5; interval unchanged [1.5,1.5625).
  STATE's "after the repair" was WRONG.  Open lead: slot-15 lure 954 — no lure read in s134-137 logs.
  Gear read 04:52Z: 954 24 / 14, rod 812 38.
- movePath: cast 13547151 (day 20718) is the corpus's ONLY 3-step mover (6/6 moves = 3 unit steps).
  t4/t5 detour: net Manhattan 1 via 3 unit steps. "length = manhattan" split out with exact exception list.
  ⚠ stepClass.ts StepClass = 1|2 and FACT 1 (k-ring, k fixed, "hard constraint") is FALSE for this fish:
  a k=3 fish, landing at distance 1 twice. Any cell-probability model built on it gives the true cell p=0.
  Not fixed — flagged. (Does the live loop even need prediction given server nextMovePath? check before sizing.)
- stateFields card-crit census 150 -> 166 (transposed control still discriminates).
- fishMaxHp: pooled 20.087; Aug 18.94 / Sep-a 20.63 / Sep-b 21.66. Restated (<21 + era-shift pin).
- castEra: focusDry reach drift is the decks (0.0108 even excl. d20720). Restated directional. ⚠ 4th era not split.
- redrawCounterfactual: s137 patcher moved all3 net at L417 (62) but left L539/L604 at 53 — patcher only moves 1st occurrence of a duplicated quantity.
- damageEconomy: gap = lethal overkill (rising 0.15->0.34/play) + max-HP regen cap (flat -0.11). Left RED. QUESTIONS §72.
- Final: 2847/2848, tsc rc 0.
