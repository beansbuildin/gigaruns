# STATE — session 138 — 2026-09-25 — commit (see the session-138 commit)

## Status
No numbered TASKS.md gate. **`next.md` was STALE** (the session-134 brief; last
log is 137), so per `/handoff` this session worked the next unblocked item:
**session 137's GATE FAIL, 15 red pin refusals, each by hand.**

**Closeout: GATE FAIL — 1 of 2848 tests red.** 14 of 15 refusals resolved
(appended after verification, or restated on the load-bearing claim). The one
left is the **damageEconomy 10% tripwire (0.1140)**, a pre-registered bar that may
not move. It needs your call on the claim. I said at session open that it was
unreachable (rule 6). Evidence: QUESTIONS §72.

**No live activity.** Fishing ledger at open (04:48Z): pond 2 **20/20**, day
20720 already spent by session 137. Next window 18:00Z (11:00 PT). No dungeon
(needs an in-session human go-ahead). Gear read 04:52Z: rod 812 **38**, slot-15
954 **24 / 14**, 640 10, 641 60, 905 8, 901 14, 204 0, 50 0 (grandfathered).
JWT reads worked. Its expiry was not read.

## Settled — do not re-open
Pointers only. `DECISIONS.md` and `QUESTIONS.md` own the evidence. **[USER]** = a
user directive an agent may not re-open at all.

- ⭐ **[USER] FOCUS OIL (942) IS RE-ALLOWED**, reversing session 93's
  relaxing-only directive. 2026-09-24. Re-opens as: *"withdraw Focus Oil again"*,
  *"return to relaxing-only to save oils"*.
- ⭐ **FOCUS OIL DOES NOT EXPLAIN DAY 20720's CRIT-RATE JUMP, AND NEITHER DOES
  THE REPAIR.** No-oil hits 8/47 vs post-oil 3/16; 8 of 11 came before the
  repair. DECISIONS 2026-09-25, QUESTIONS §73. Re-opens as: *"Focus Oil boosts
  crit damage"*, *"the anomalies came after the repair"*.
- ⭐ **THE damageEconomy GAP IS TWO CLAMPS WITH OPPOSITE SIGNS.** Lethal overkill
  is rising; the max-HP regen cap is flat at ~−0.11/play. QUESTIONS §72. Re-opens
  as: *"the clamped and unclamped readings disagree"*.
- ⭐ **ORDER ALONE SAYS THE CATCH-RATE LEVER IS WHICH OIL, NOT WHEN.** §0a holds,
  so **quote no sweep number.** DECISIONS 2026-09-24. Re-opens as: *"loosen the
  Relaxing trigger to lift catch rate"*, *"spend an oil at start_run"*.
- ⭐ **THE damageEconomy 10% BAR IS A TRIPWIRE, NOT A PIN.** Re-opens as: *"widen
  the bar to 0.12"*, *"the patcher refused a pin, fix it by hand"*.
- ⭐ **[USER] THE ROD IS GOLKAN (812).** Re-opens as: *"swap back to 924/923"*,
  *"the sim says Dendren beats Golkan"*.
- ⭐ **THE GOLKAN SLICE IS 812-ONLY.** Last computed 197/335 = 58.8% at 674
  casts; not recomputed since. Never pool 811. Re-opens as: *"Golkan 58.7%"*,
  *"add 74 back to GOLKAN_IDS"*.
- ⭐ **GOLD ROTATION: four clean points** (dow 2 Foxglove, 3 Archon, 4 Summoner,
  5 Overseer), **charge shape 16/16.** The fifth, **dow 6 → Crusader**, is WEAK.
  Re-opens as: *"the gold map has five confirmed points"*, *"predict the next
  gold faction by a step rule"*.
- ⭐ **`--resume-existing` COSTS NO RUN-UNIT; gear debits at `start_run`.**
- ⭐ **A RESUMED RUN'S state-000 IS NOT AN OPENING LOADOUT.** Re-opens as: *"the
  corpus shows a new starting loadout"*.
- ⭐ **"Intuition quarters damage" and the Weak "exceptions" are Weak/Vengeance.**
- ⭐ **DENDREN ROOT (846) IS A FUNCTION OF THE DEATH ROOM.**
- ⭐ **`blockedMove`'s WIRING IS FALSIFIED.** Re-opens as: *"wire blockedMove in"*.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT.** Read `checkGear.ts` live.
- **[USER] RING BALANCES ARE NOT A CONSTRAINT; THE DUNGEON GEAR HALT; OTHER
  DUNGEONS OUT OF SCOPE; fishing budget 360 energy / 30 casts; Tier-1/Tier-3
  income baseline RETIRED BY NAME.**

**Dropped this session:** "AN ABORTED WRITE PRODUCES A TRACE SHAPE NOTHING ELSE
DOES" and "SLOT-6 204 IS NOT A WEAR PIECE". Both have been quiet for many
sessions, and both are in DECISIONS.md. Dropped to stay near the ~15 cap.

## What works
- **Hand pin pass on all 15 refusals.** Each list was diffed for additivity
  (0 removals anywhere), and each ratio was re-derived from its own pinned
  counts. Suite **2847/2848**, `tsc` rc 0.
- `checkFishingCaps.ts` and `checkGear.ts` live reads: both worked, both read-only.
- `scripts/secretScan.ts`: `scope: tracked`, `files scanned: 21442`, PASS.

## What's broken
- ⛔ **damageEconomy.test.ts "the clamp is real but small": 0.1140 vs `< 0.1`.**
  RED on purpose. It needs a decision on the CLAIM (QUESTIONS §72). The bar does
  not move.
- ⚠ **castEra has no fourth era.** Day 20720's 26 Focus-SUPPLIED casts are
  binned `focusDry`, against castEra.ts's own "do not silently widen focusDry"
  rule. Every focusDry pin includes them. The boundary is
  `2026-09-25T03:18:24.342Z`. QUESTIONS §74.3.
- ⚠ **`stepClass.ts` hard-codes `StepClass = 1 | 2` with the k-ring as a HARD
  constraint.** A 3-step fish (cast 13547151) landed off-ring on 2 of 6 moves.
  Not fixed. Size it first: the server sends `nextMovePath`. QUESTIONS §74.1.
- ⚠ **Sim fishMaxHp sampler is pooled.** Current fish (Sep 16+) average 21.66,
  and the pooled mean is 20.09. QUESTIONS §74.2.
- ⚠ **`pinPatch.ts` moves only the FIRST occurrence of a duplicated quantity.**
  redrawCounterfactual's all3 net sat at 62 (line 417) and 53 (lines 539 and 604)
  at the same time.
- ⚠ **Carried:** castCap counts plays, not charges (a small second batch per
  day). ROM-overflow path untested. `checkGear.ts` banner on item 50. `web/`
  idle since s120.

## Corrections to SPEC.md
- **SPEC-fishing §lastMovePath** said `length == manhattan` held on every move and
  steps are "only ever 1 or 2". The corpus has a 3-step fish, and that identity
  holds on **3097/3099**. Fixed in SPEC-fishing.md.
- Resolved IDs: forbiddenWoods=5, dendren nodeId "5" / pondId 2. Oils 942 / 937.
- Move charges: ABSENT (unchanged).

## Dead ends
- **Focus Oil, the rod repair, and `jebaitorTriggered` as crit-rate causes.**
  All three were tested and ruled out (numbers above; §73). Don't retry without
  a lure-state record for days 20716–20720.
- **"Excluding day 20720 fixes castEra's reach delta."** It doesn't: the delta is
  0.0108 without it. The drift is September's decks.
- **Carried:** zsh does not word-split an unquoted `$VAR` (a 0 after a known-red
  run is a harness fault). §0a is not lifted. `$TMPDIR` differs by sandbox mode.
  tsx/vitest/git run unsandboxed.

## Metrics
- **Live:** none this session.
- **Crit anomalies:** 45 total (31 → 45). Day 20720: **11/63 hits = 17.5%**. Rest
  of corpus: **34/1304 ≈ 2.6%**. All 45 fit ×1.5; interval [1.500, 1.5625).
- **Card-zone crits (census):** 150 → 166. The transposed control still scores fewer.
- **fishMaxHp mean:** Aug 18.94 (n=339), Sep 1–15 20.63 (n=267), Sep 16+ 21.66
  (n=163), pooled 20.09.
- **damageEconomy by window:** ratio 5.3% → 12.4% → 12.3% → 23.1%. Lethal
  overkill 0.147 → 0.246 → 0.210 → 0.335 HP/play. Regen cap −0.116 → −0.130 →
  −0.106 → −0.049.
- **Moves:** 3099 scored; steps 1: 1516, 2: 1577, 3: 6.
- **Corpus:** 769 fishing casts (unchanged). **Suite at final tree: 2847 passed /
  1 failed (2848).** `tsc` rc 0.

## Open questions for Claude
1. ⭐ **damageEconomy (§72):** retire *"the clamp is real but small"*, or restate
   it as two separately measured clamps (pin the flat regen cap per play; treat
   overkill as a census)?
2. ⭐ **Crit rate (§73):** ask the user whether the slot-15 lures (954) were
   repaired or swapped between 09-24 05:56Z and 09-25 03:18Z. Should the next
   session read gear at open and record the lures every fishing day?
3. **castEra fourth era (§74.3):** it's mechanical but moves many pins. Worth a
   session slot?
4. **Carried from s137:** should `castCap` count charges? Is a Focus-stock budget
   warranted (51 held at ~16/day)?
5. **Brief freshness:** `next.md` has been stale for 4 sessions (134 → 138).
   Sessions 135–137 were user-driven without a brief.

## Files changed
```
 QUESTIONS.md                               +86  §72 damageEconomy, §73 crit rate, §74 three corpus facts
 SPEC-fishing.md                            lastMovePath correction (3-step fish)
 scripts/liveFishing.ts                     REDRAW_SHADOW_IN_SAMPLE_RATE_PCT 2.2 -> 2.0
 tests/fishing/stateFields.test.ts          +14 crit anomalies (+14 interval rows), census 150 -> 166
 tests/fishing/movePath.test.ts             length identity split out, 2 exact exceptions
 tests/fishing/oilReachability.test.ts      id lists +2/+4/+2/+2 (additive)
 tests/sim/fishingCorpus.test.ts            oil-cast list +15 (additive)
 tests/fishing/redrawCounterfactual.test.ts 4 ratios, b6/b10 arms, duplicated all3 net
 tests/fishing/fishMaxHp.test.ts            bar -> stated claim (<21) + new era-shift test
 tests/fishing/castEra.test.ts              reach claim made directional; crit census 0.2551 -> 0.2412
 handoff/{STATE,DECISIONS,log/session-138,scratch-session-138}.md
```
