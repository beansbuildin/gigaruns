# STATE — session 137 — 2026-09-25 — commit (see the session-137 commit)

## Status
No numbered TASKS.md gate. User-driven: *"run a full day of fishing only"* ×2,
an oil-timing investigation, one [USER] config reversal, a third fishing day,
then `/gigarecap`. No `/handoff` brief.

**Closeout: GATE FAIL — 15 of 2846 tests red.** All 15 are pin-patcher
REFUSALS left for hand-work. I did not hand-work them in the recap. Two need
real judgement: the **damageEconomy tripwire** (now 0.114) and **14 new crit
anomalies**, 11 of them on the Focus-oil day. See What's broken.

⚠ **SESSION 136 WAS NEVER RECAPPED OR COMMITTED, and this commit absorbs it.**
On 2026-09-21 (game day 20716) a session fished 26 casts on rod 812, then 50,
with `SESSION_136_LIMITS` (castCap 20). It pin-passed at 700 casts and
stopped with everything staged. Its fixtures, pins, `SESSION_136_LIMITS` and the
in-sample 2.3 → 2.2 change all land in this commit. There is no
`log/session-136.md`. Session 136's day is covered in this log's §0, from its own
code comments and fixtures only.

**Live fishing: three game days, each spent to 20/20 charged.**
| day | played / charged | caught | oils | rod 812 |
|---|---|---|---|---|
| 20718 | 22 / 20 | 11 (50%) | 0 — Focus withdrawn, 0 Relaxing held | 24 → 2 |
| 20719 | 21 / 20 | 9 (43%) | 2 Relaxing | 40 → 19 (repaired out of band) |
| **20720** | 26 / 20 | **22 (85%)** | **16 Focus + 4 Relaxing** | 19 → **0**, repaired → 44 → 38 |

Day 20720 is the first day since session 93 with Focus Oil allowed and stocked.
It is n=26, one day. Treat it as a strong first read, not a rate.

**Rod 812: 38.** **Stock after day 20720: Focus 51 / Relaxing 64.** At ~16
Focus/day that is ~3 days. **JWT:** reads worked all session. Its expiry was
not re-read.

**No dungeon activity. Ring balances were not read.**

## Settled — do not re-open
Pointers only. `DECISIONS.md` and `QUESTIONS.md` own the evidence. **[USER]** = a
user directive an agent may not re-open at all.

- ⭐ **[USER] FOCUS OIL (942) IS RE-ALLOWED, reversing session 93's
  relaxing-only directive.** 2026-09-24. `allowedItemIds [937, 942]`, pinned by
  `oilPolicy.test.ts` + `oilDoubleLethalDisabled.test.ts`. Re-opens as:
  *"withdraw Focus Oil again"*, *"return to relaxing-only to save oils"*.
- ⭐ **ORDER ALONE SAYS THE CATCH-RATE LEVER IS WHICH OIL, NOT WHEN.** Every sweep
  puts `focus-when-empty-only` above every Relaxing timing. Loosening the Relaxing
  gate adds ~0pp. §0a holds, so **quote no sweep number.** DECISIONS 2026-09-24.
  Re-opens as: *"loosen the Relaxing trigger to lift catch rate"*, *"spend an
  oil at start_run"*.

**Dropped this session:** "PIN AFTER THE DAY'S LAST CAST" (a one-shot reminder, quiet for two sessions).

- ⭐ **THE damageEconomy 10% BAR IS A TRIPWIRE, NOT A PIN.** It breached at
  0.10048. The claim gets re-examined; the bar does not move. Re-opens as:
  *"widen the bar to 0.11"*, *"the patcher refused a pin, fix it by hand"*.
- ⭐ **[USER] THE ROD IS GOLKAN (812).** Re-opens as: *"swap back to 924/923"*,
  *"the sim says Dendren beats Golkan"*.
- ⭐ **THE GOLKAN SLICE IS 812-ONLY.** Last computed 197/335 = 58.8% at 674 casts; NOT recomputed at 769.
  Recompute from the corpus; never pool 811. Re-opens as: *"Golkan 58.7%"*,
  *"add 74 back to GOLKAN_IDS"*.
- ⭐ **GOLD ROTATION: four clean points** (dow 2 Foxglove, 3 Archon, 4 Summoner,
  5 Overseer), **charge shape 16/16.**
  - The fifth, **dow 6 → Crusader**, is WEAK: it was out of band, and −12 was a
    net figure.
  - Re-opens as: *"the gold map has five confirmed points"*, *"predict the next
    gold faction by a step rule"*.
- ⭐ **AN ABORTED WRITE PRODUCES A TRACE SHAPE NOTHING ELSE DOES** (`hasStart`
  true, `continuous` false). Re-opens as: *"the second non-clean trace is
  another resumed cast"*.
- ⭐ **`--resume-existing` COSTS NO RUN-UNIT; gear debits at `start_run`.**
- ⭐ **A RESUMED RUN'S state-000 IS NOT AN OPENING LOADOUT.** Re-opens as: *"the
  corpus shows a new starting loadout"*.
- ⭐ **SLOT-6 204 IS NOT A WEAR PIECE.** The wear set is 640/641/901/905.
- ⭐ **"Intuition quarters damage" and the Weak "exceptions" are Weak/Vengeance.**
- ⭐ **DENDREN ROOT (846) IS A FUNCTION OF THE DEATH ROOM.**
- ⭐ **`blockedMove`'s WIRING IS FALSIFIED.** Re-opens as: *"wire blockedMove in"*.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT.** The rod read 40 at this
  open after closing at 1; it was repaired out of band. Read `checkGear.ts` live.
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT** (still read all fourteen on a
  dungeon day).
- **[USER] THE DUNGEON GEAR HALT; OTHER DUNGEONS OUT OF SCOPE; fishing budget 360
  energy / 30 casts; Tier-1/Tier-3 income baseline RETIRED BY NAME.**

## What works
- **`liveFishing.ts --oil-batch` under `SESSION_136_LIMITS` (castCap 20).** Five
  batches, and every one exited rc 0 on `cast_cap` or `ledger_exhausted`.
  - ⚠ castCap counts PLAYED casts, and ~1 play per 20 goes uncharged. So each
    full day needed a small second batch to spend the last 1–2 charges.
  - Every one was preceded by a `checkFishingCaps.ts` read.
- **The Focus-oil path, live.** 19 × `use_fishing_item` itemId 942 posted and
  accepted on day 20720. The necessity-gated trigger fired it only on focus-empty
  turns.
- **Rod-0 halt.** Rod 812 hit 0 on day 20720's last cast. The next batch was not
  issued until the user repaired it.
- **Transient server write conflict, failed closed.** `start_run` → HTTP 400
  *"Write conflict during plan execution … Please retry"*. The loop reconciled
  it as `action_not_applied`. The ledger read 15/20 unchanged, and one retry
  succeeded.
- **`scripts/pinPatch.ts`:** 157 pins over 8 passes, converged, 15 refusals.
- **Rule-13 read after an app quit** mid tool-permission: ledger 0/20, and the
  newest log was only the dry run. Nothing had run.

## What's broken
- ⛔ **15 pin refusals, all RED. Hand-work each one; do not auto-move them.**
  1. **damageEconomy.test.ts:332 TRIPWIRE: 0.114** (was 0.10048 at s135).
     Still rising. The bar may not move. Open Q1.
  2. **stateFields.test.ts:373/676: `KNOWN_CRIT_ANOMALIES` +14.**
     - Every one is `hit=true crit=false` with actual ≈ 1.5 × predicted.
     - **11 of 14 are casts 13573xxx, the Focus-oil day, after the repair.**
     - Hypothesis, UNTESTED: an oil or the repair changes crit behaviour.
       Check the base/ratio window before appending. Open Q2.
  3. **movePath.test.ts:30: "exceptionless" broke.** Cast 13547151 t4/t5 has
     `lengthMatches: false`: 3 steps against a different path length, endpoint
     OK. A first exception is a finding, not a pin.
  4. **oilReachability ×4 + fishingCorpus:550: id lists grew.** Expected, since
     Focus oils went live: the oil-cast list is +15. Verify each is ADDITIVE,
     then append.
  5. **redrawCounterfactual ×3: ratio pins.** Both halves by hand. Current
     values: 0.72334, 0.80469, 0.25726.
  6. **fishMaxHp:41: mean 20.087 vs `< 20`.** Did the fish pool shift, or did
     the claim drift? Do not widen it blindly.
  7. **castEra:697: the gear-reach delta is 0.0115 vs `< 0.01`.** Same
     judgement.
  8. **redrawShadowAnalysis:123: in-sample 2.2 → 2.0.** Set
     `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` by hand.
- ⚠ **castCap counts plays, not charges.** Every full day this session needed a
  follow-up batch. Candidate: halt on `ledger 0` only.
- ⚠ **Carried, unchanged:** ROM-overflow path untested, `checkGear.ts` banner on
  item 50, `web/` idle since s120.

## Corrections to SPEC.md
- None this session.
- **Resolved IDs:** forbiddenWoods=5, dendren nodeId "5" / pondId 2. Focus oil
  942 and Relaxing oil 937 are unchanged.
- **Move charges:** ABSENT (unchanged).

## Dead ends
- **zsh does not word-split an unquoted `$VAR`.** `pinPatch.ts --run $F`
  passed 12 paths as ONE argument, so vitest matched nothing and the patcher
  reported "0 failures". **Rule: a 0 after a known-red run is a harness fault
  until shown otherwise.** List the files literally.
- **Loosening the Relaxing trigger to fix catch rate.** Every sweep arm puts it
  at ~+0pp over the necessity gate. See the digest.
- **Carried:** §0a is not lifted, and no sweep number may be quoted as a
  forecast. `$TMPDIR` differs by sandbox mode, and tsx/vitest/git run
  unsandboxed.

## Metrics
- **Live, this session:** 69 played / 60 charged / **42 caught (60.9%)**, 22
  oils. By day: 50%, 43%, **85%**.
- **Focus-withheld split, days 20718–20719:** 19 casts where the trigger wanted
  942 and policy withdrew it → **2 caught (11%)**. The other 24 → 18 caught
  (75%). This split is **selection-biased**: the trigger fires in casts that are
  already failing.
- **Loss mix, last 400 casts:** 214 caught / 143 escaped at full HP / 43 mana-out.
  Catch rate when focus never hit 0: **128/188 = 68%**. When it did hit 0:
  **86/212 = 41%**.
- **`oilArmCatchCheck` (default runs):** live no-oil 45.7% (231/505), live oil
  arm 96.2% (127/132). Sim with oils off: 29.6%. Both rows REFUTED against the
  live CI.
- **Corpus: 769 fishing casts** (was 674, +26 from s136, +69 this session).
- **Suite at final tree:** **2831 passed / 15 failed (2846)**, 9 files. `tsc`
  rc 0.

## Open questions for Claude
1. ⭐ **damageEconomy tripwire: 4.7% → 8.0% → 10.05% → 11.4%.** Retire *"the
   clamp is real but small"*, or restate it on a quantity that is not tied to
   deck composition?
2. ⭐ **14 new crit anomalies, 11 on the first Focus-oil day.** Does Focus Oil,
   or the out-of-band repair, change damage? Test it by splitting the anomalies
   by `consumablesUsed` before the hit, before growing the list.
3. **Should `castCap` count charges?** The ~1-in-20 uncharged play costs one
   extra batch per day.
4. **Is a Focus-stock budget warranted?** At ~16/day, 51 lasts ~3 days, and the
   next dry day reverts to ~45%.

## Files changed
```
 config/bot.json                      allowedItemIds [937] -> [937, 942], dated note
 tests/fishing/oilPolicy.test.ts, oilDoubleLethalDisabled.test.ts   942 allowed
 scripts/liveFishing.ts, src/strategy/fishing/oilBatch.ts           s136 (uncommitted): SESSION_136_LIMITS
 tests/**                             ~14 files, 157 auto pins (s136's + this session's)
 fixtures/fishing-casts/live/**       95 cast captures (days 20716, 20718-20720)
 handoff/{STATE,DECISIONS,log/session-137}.md, handoff/reports/*
```
