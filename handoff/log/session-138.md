# Session 138 — 2026-09-25 — hand pin pass on session 137's 15 refusals — GATE FAIL (1/2848 red, by design)

## §0 Open
- `/handoff`. `next.md` = session-134 brief (stale vs log 137). Per /handoff: worked the next
  unblocked item, session 137's GATE FAIL. Stated at open (rule 6) that the damageEconomy
  tripwire cannot be cleared without a decision on the claim.
- Ledger 04:48Z: `GAME ledger (dayDocs pond 2): 20 / 20`, `ledgers agree at 20`, BLOCKED, 13.2h to reset.
- Full suite at HEAD: 2831 passed / 15 failed (2846) — identical to STATE s137's list.
- Gear 04:52Z: 109 37, 110 36, 204 0, 208 9, 50 0, 640 10, 641 60, 905 8, 901 14, rod 812 38,
  954 …83b834fd 24, 954 …ac25b641 14.

## §1 Crit anomalies (stateFields ×2) — appended, and the rate is a finding
New violations (all `hit=true crit=false`), unclamped FISH_HP_DIFF from `play.fishHpDiff`:
```
13547166 t1 base 6 -> 9     13573605 t2 base 4 -> 6
13547196 t1 base 6 -> 9     13573625 t1 base 4 -> 6
13562111 t4 base 4 -> 6     13573645 t1 base 6 -> 9
13573580 t3 base 6 -> 9 (lethal, state Δ7)   13573649 t3 base 6 -> 9
13573585 t1 base 4 -> 6     13573708 t3 base 6 -> 9
13573585 t2 base 8 -> 12 (lethal, state Δ11) 13573715 t9 base 6 -> 9
13573595 t2 base 8 -> 12    13573717 t3 base 5 -> 8
```
All fit x1.5 round-half-up; interval stays [1.5, 1.5625). 31 old rows unchanged.

Rate by game day (hits / anomalies), Sep 1 onward: 0–8% every day; **2026-09-24 gday (20720): 63 / 11 = 17.5%**.
Corpus excl. that day 34/1304 = 2.6%. P(X>=11 | Poisson 1.64) ~ 1e-6.
- Oil split on day 20720: b.consumablesUsed==0 → 47 hits / 8; >0 → 16 / 3.
- Time split: casts 03:18:20–03:23:57Z (pre-repair, 20 casts) hold 8; 03:30:16–03:31:47Z (6 casts) hold 3.
  STATE s137 said "11 of 14 ... after the repair" — wrong.
- jebaitorTriggered (per-cast constant): true 82 casts/155 hits/7 anom; false 685/1212/38.
- Day 20719 → 20720 state-000 diff: fullDeck 19 cards → 10; jebaitorTriggered false → true. Neither explains it.
- Card-zone crit census 150 → 166.

## §2 movePath — first exceptions ever
Cast 13547151 (cast-2026-09-23-04-58-57, day 20718), escaped. Every move 3 unit steps:
```
t1 (4,4)->(2,3) [12,11,7]   t2 (2,3)->(4,4) [11,12,16]   t3 (4,4)->(2,3) [12,8,7]
t4 (2,3)->(2,2) [3,2,6]  <- manhattan 1     t5 (2,2)->(1,2) [5,1,2] <- manhattan 1
t6 (1,2)->(3,1) [1,5,9]
```
Histogram 1: 1516, 2: 1577, 3: 6 (all this cast). Test split: unit+endpoint exceptionless;
length==manhattan with an exact 2-item exception list. SPEC-fishing corrected.
stepClass.ts (`StepClass = 1|2`, k-ring hard constraint) is wrong for this fish; not fixed.

## §3 Oil id lists — all additive
reach-not-caught +13547143 +13547155 (both day 20718) — ends the "same two casts" run;
gap +13547143 +13562115 +13573637 +13573717; caught∩gap (×2 tests) +13573637 +13573717;
fishingCorpus oilCasts +15 (13562077, 13562084, 13573585…13573717). 0 removed anywhere.

## §4 redrawCounterfactual — ratios re-derived off their own pinned counts
actual 1370/1894, redraw 1497/1894, focus>=1 rescue 103/128, all3 net/fires 62/241.
Then two assertions the earlier failure had masked: b6 {38,22,0,9,50} (sacrifices HELD 0),
b10 {178,64,14,21,264} (sacrifices HELD 14), b10 net 41 → 50 (two sites), b6 net 21 → 22,
all3 net 53 → 62 at lines 539/604 — line 417 already said 62. pinPatch moved only the first occurrence.

## §5 redrawShadow — REDRAW_SHADOW_IN_SAMPLE_RATE_PCT "2.2" → "2.0" (38/1894 = 2.006%).

## §6 fishMaxHp — restated, not widened
Half-month means: Aug 18.94 (339), Sep-a 20.63 (267), Sep-b 21.66 (163). Bar `< 20` → `< 21`
(the claim the comment states) + new test: Aug mean < 20 and Sep mean > Aug + 1.

## §7 castEra — restated directional
focusDry reach 0.1647 vs preOil 0.1532 (|Δ| 0.0115). Excluding day 20720's 26 casts: 0.0108.
focusDry by window: Aug 0.1553 (183), Sep-a 0.1681 (267), Sep-b 0.1697 (163).
Assertion → focusDry > preOil − 0.01 (the direction that rules gear out of a DECLINE) plus a
0.02 drift tripwire. crit census 0.2551 → 0.2412. Fourth era NOT split
(first Focus-supplied cast 2026-09-25T03:18:24.342Z, last dry 2026-09-24T05:55:42.575Z).

## §8 damageEconomy — LEFT RED
0.11402 vs < 0.1. Decomposition (per play, rod-dealt clean traces):
```
window     casts plays  drift    unclamped ratio  overkill  regenCap
aug         294  1160  -0.6017  -0.6336  0.0530  +0.1474   -0.1155
sep-a       267  1024  -0.9404  -1.0566  0.1236  +0.2461   -0.1299
sep-b       115   537  -0.8492  -0.9534  0.1228  +0.2104   -0.1061
09-24+       46   203  -1.2365  -1.5222  0.2311  +0.3350   -0.0493
ALL         722  2924  -0.8098  -0.9022  0.1140  +0.2066   -0.1142
excl d20720 676  2721  -0.7780  -0.8559  0.1001  +0.1970   -0.1191
```
QUESTIONS §72.

## §9 Close
tsc rc 0. Suite 2847 passed / 1 failed (2848). secretScan: scope tracked, 21442 files, PASS.
Surprises: STATE s137's "after the repair" was wrong; pinPatch's first-occurrence-only behaviour;
next.md stale for four sessions.
