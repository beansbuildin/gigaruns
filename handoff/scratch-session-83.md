# scratch — session 83

## Ledgers (rule 13, server-read, not arithmetic)
- `doctor.ts`: all checks pass, token 130.1h. Local: dungeon 12 runs / fishing 20 casts.
- `checkDungeonToday.ts`: `DayCount#…#Dungeon#5` = **12** (of 12). Spent.
- `checkFishingCaps.ts`: `dayDocs[pondId 2]` = **20/20**. VERDICT BLOCKED, 10.17h to 11:00 PT.
- Offline session confirmed by the server, not by the brief's arithmetic.

## Surprise 1 — §2a reproduces EXACTLY, on ALL traces
`nextCardIndex` deltas when it advances `{+3: 137, −7: 3, −8: 4}` over **148**
traces; draws with previously-unheld cards **144/144**. Brief's figures, byte
for byte. Note the "previously-unheld" test must exclude the drawing turn's own
`hand` (`j < i`, not `j <= i`) — the state doc's `hand` on a refill turn is
ALREADY the new hand, so including it makes the check vacuous (0/144).

## Surprise 2 — gate 2 reproduces EXACTLY, and its predicate is recoverable
n=147 mean 5.85 median 7, mana-out 15, escapes 5.42, catches 6.73, and the
whole histogram. Predicate: **ALL traces (not `isCleanTrace`), RESOLVED only
(`caught || escaped`)**, terminal doc's `playerHp`. `isCleanTrace` gives 147 too
but mean 5.86 — the brief's is the resolved filter, not the clean one.

## Surprise 3 — gate 1 does NOT reproduce byte-for-byte, and the delta is legible
Mine (ALL traces, crits counted, redraw arm reachable from `prev.focusPoint`
with `budgetBefore(prev,cur)`):

```
              brief        mine
  n            386          389
  yes/yes      262          261
  yes/no        26           27
  no/yes        42           45
  no/no         56           56
  actual avail 74.6%       74.0%     ← SAME numerator, 288. Denominator differs.
  redraw avail 78.8%       78.7%
  rescue cost  1.57 {1:24,2:12,3:6}  1.60 {1:24,2:15,3:6}
```

**The brief's table is not a subset of mine** — `yy` would have to GAIN a row —
so the difference is not only a filter. Decomposed: 3 rows I count that it does
not, all held-hand-size 2, all in the RESCUE cell; plus one row it scores as a
redraw-reach that I score as not. Both arms' "actual reaches" count is
identically 288, which is what makes the delta readable at all.

Predicate clauses that turn out to be VACUOUS on this corpus (checked, both
readings): "every card in the held hand belongs to one revealed draw-triple",
in the any-triple AND the same-single-triple reading. Neither drops a row.
"A further play exists" is also implied by "the next triple exists" (286→286
under the strict one-card reading; 422→389 under the correct one).

The clause that actually decides `n`: **"exactly one card moved from hand to
discard"**. Read as `hand.length − 1` it gives 467/286 — it excludes every
REFILL turn, where the hand goes 1 → 3. Read as "the discard grew by exactly
one card and that card was in the held hand" it gives 603/389. The second is
the true statement of the words; the first is a different measurement wearing
them.

## Surprise 4 — variant B is ruled out by the brief's own numbers
Scoring the redraw arm from `cur.focusPoint` with `budgetBefore(cur,next)`
gives redraw availability **71.5%**, i.e. redraw is WORSE than the held hand.
The brief reports 78.8%, so it used the decision-point reachable set
(`prev.focusPoint`, budget `B`). That is also the principled one: the meter is
a per-cast pool, and reaching a cell in two moves within total budget B is the
same set as reaching it in one.

## Surprise 5 — §3's separability question has an answer, and it is an INVERSION
`heldCoverage` (distinct cells the held hand can put a zone on, over every
reachable focus — decision-time only) separates dead from live hands at
**AUC 0.922**, dead mean 5.13 vs live 13.32. A hand covering all 16 cells is
dead **0 of 141** times.

**And the dead hands it finds are the ones a redraw cannot fix.**

```
  rescue rate among the 101 DEAD hands
    coverage <= 3        46 dead    7 rescued    15%
    coverage >= 4        55 dead   38 rescued    69%
    focus budget 0       74 dead   19 rescued    26%
    focus budget >= 1    27 dead   26 rescued    96%
```

One cause for both: **a dead hand is usually a hand firing from an exhausted
focus meter, and a redraw does not restore the meter.** 74 of the 101 dead
hands have budget 0. A fresh triple fired from one fixed cell is usually dead
too.

`coverage <= K` as a trigger over all plays is worthless where it is confident
— K=3 fires 55 times for 7 rescues and 7 sacrifices, net **zero**, with 39
firings wasted on hands nothing could save. Conditioned on `budget >= 1` the
same signal is clean: K=6 fires 6, rescues 6, sacrifices 0, costs 9 mana;
K=10 fires 44, rescues 18, sacrifices 3, wastes 1, costs 60 mana.

⚠ Fitted to this corpus with ORACLE labels and no held-out set. n=27 dead in
the conditioned arm. It is a shape, not a threshold.

## Surprise 6 — the pre-death ordering is a WITHIN-ROOM artefact, not a death signal
Recomputed from `logs/run-2026-08-23-*.jsonl` (the four session-82 runs, 174
decisions — reproduces STATE.md's pooled table exactly). Two things STATE.md
could not see:

1. **All three pre-death decisions of a run carry the IDENTICAL unmodelled
   set.** They are one fight. The effective n is **4, not 12**.
2. **The within-room control kills it.** For each run, the decisions EARLIER
   in the same room the run died in:

```
   death room 8 : earlier n=5  STATUS_EFFECT 3  ENEMY_BUFF 0
   death room 3 : earlier n=6  STATUS_EFFECT 4  ENEMY_BUFF 0
   death room 7 : earlier n=6  STATUS_EFFECT 5  ENEMY_BUFF 0
   death room 7 : earlier n=7  STATUS_EFFECT 5  ENEMY_BUFF 0
                  ------------------------------------------
                  17/24 = 71%              0/24 = 0%
```

The death room's ORDINARY decisions already show STATUS_EFFECT high and
ENEMY_BUFF at zero. The pre-death window adds nothing.

3. **And there is a depth confound underneath that.** STATUS_EFFECT's base
   rate climbs 23% (room 1) → 75% (room 8); ENEMY_BUFF collapses 100% (room 6)
   → 24% (room 7) → 0% (room 8). Deaths cluster in rooms 7–8. **Any pre-death
   statistic drawn from deaths that cluster deep is measuring depth.**

STATUS_EFFECT and ENEMY_BUFF are NOT complementary despite both being 87/174 —
the 2×2 is 46/41/41/46, near-independent.
