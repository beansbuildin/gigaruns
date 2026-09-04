# scratch — session 121 — 2026-09-03/04

## PRE-REGISTERED PREDICTION — day 20699 rotation point
**Written BEFORE `start_run`. Nothing has been spent at the time of writing.**

Same discipline as session 118, which is what made that falsification a real
test rather than a story fitted afterwards.

### Readings taken first (Step 1, all live, nothing spent)
- JWT valid another **14.5h** (`doctor.ts`).
- Game day **20699**, week 86, **`dayOfWeek 7`**, next day in 13:37:50.
  ⚠ **The brief predicted `dayOfWeek 0`. The server says 7.** The dow series is
  1-indexed (observed 3,4,5,6,7); unobserved dows are 1 and 2. This changes the
  brief's label, not its logic — under (a) the three unobserved dows still take
  the three unobserved factions.
- Dungeon ledger: `dayProgressEntities` null / `[]` — **fresh, 0 of 12 run-units.**
- Fishing ledger: GAME 0/20, REPO 0 casts — **fresh.**
- Rod 812 `DURABILITY_CID` **48**, `GearInstance#812_1787690500_766077e9` — the
  SAME instance session 118 closed at 48. No drift, no repair needed.
- Silver rings, live, **identical to session 118's close (no overnight drift)**:
  | faction | item | name | balance |
  |---|---|---|---|
  | 3 | 137 | Athena   | 21 |
  | 7 | 134 | Chobo    | 30 |
  | 4 | 138 | Archon   | 30 |
  | 1 | 135 | Crusader | 39 |
  | 6 | 140 | Summoner | 42 |
  | 5 | 139 | Foxglove | 45 |
  | 2 | 136 | Overseer | 51 |

### The known map (four points, arithmetic rule already FALSIFIED)
```
day 20695  dow 3 -> f5 Foxglove
day 20696  dow 4 -> f6 Summoner
day 20697  dow 5 -> f7 Chobo
day 20698  dow 6 -> f3 Athena     <- killed "faction = dayOfWeek + 2"
day 20699  dow 7 -> ???           <- THIS MEASUREMENT
```

### THE PREDICTION
**Under hypothesis (a) — a fixed 7-permutation with the observed fragment
5->6->7->3, leaving {f1 Crusader, f2 Overseer, f4 Archon} for the three
unobserved dows — day 20699 MUST charge one of:**

- **f1 Crusader (135), 39 -> 36**
- **f2 Overseer (136), 51 -> 48**
- **f4 Archon   (138), 30 -> 27**

### FALSIFIERS, stated in advance
1. **(a) DIES** if the mover is Athena / Chobo / Foxglove / Summoner — i.e. any
   faction already claimed by dows 3-6. A repeat inside one cycle is not a
   permutation.
2. **The CHARGE SHAPE claim dies** (separately, and it is currently 16/16) if
   more than one faction moves, or if the amount is anything other than exactly 3.
   The order and the shape are independent claims; session 118 is the precedent
   for one dying without the other.
3. **No prediction is made about WHICH of the three** it is. (a) surviving leaves
   the 6-way order underdetermined; at n=5 the best case narrows it to 2 orders
   (the two arrangements of the remaining pair), never to 1.

### What this measurement CANNOT do
It cannot distinguish (b) per-day pseudo-random from (a) on a single point —
a random draw lands in {f1,f2,f4} 3/7 = 43% of the time by chance. A PASS is
weak evidence for (a); a FAIL is strong evidence against it. Say so in the recap
rather than reporting a pass as a solve. **Do not re-fit an arithmetic rule to
five points** — STATE's Dead ends section, and it already produced one confident
wrong answer.
