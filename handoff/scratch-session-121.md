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

---

## RESULT — measured 2026-09-04T04:32Z, AFTER the run

**Run 25324264, death @ room 9, Hard Core 4368, Dendren Root 546, 60 energy.
0/61 first-attempt action failures. Server ledger `dayProgressEntities` 3 of 12.**

### The balance diff — read twice, stable both times
```
134 Chobo    30 -> 30    135 Crusader 39 -> 39    136 Overseer 51 -> 51
137 Athena   21 -> 21    138 Archon   30 -> 27  <-- the ONLY mover, -3
139 Foxglove 45 -> 45    140 Summoner 42 -> 42
```

### Verdict against the pre-registration
- **Hypothesis (a) SURVIVES.** Archon is **f4**, and f4 was one of the three
  factions named in advance. Predicted set was {f1 Crusader, f2 Overseer,
  f4 Archon}; the server charged f4 at exactly the predicted 30 -> 27.
- **The charge SHAPE holds, now 17/17.** Exactly one faction, exactly 3, six
  untouched. Falsifier 2 did not fire.
- **The pass is WEAK, exactly as pre-registered.** Under (b) a random draw lands
  in a 3-of-7 set 43% of the time — a Bayes factor of only ~2.3 for (a) over (b).
  This is not a solve and was said in advance not to be one.

### What it DID buy: the order is down from 6 candidate permutations to 2
Fragment is now **5 -> 6 -> 7 -> 3 -> 4**. Only {f1 Crusader, f2 Overseer}
remain, for the only two unobserved slots.

### A SECOND finding, unplanned — dayOfWeek is 1-INDEXED, and the repo assumed 0
The brief and `checkEntryTiers.ts`'s caption both said day 20699 would be
`dayOfWeek 0`. **The server returned 7.** `dow = day mod 7`, with 0 mapped to 7
(20699 = 7 x 2957 exactly). So the two open slots are **dow 1 (day 20700)** and
**dow 2 (day 20701)** — there is no dow 0 and never was. Caption corrected.

### THE NEXT TEST IS THE LAST ONE NEEDED — and the JWT barely reaches it
Day **20700, dow 1**, must charge **Crusader or Overseer** under (a). Either
answer SOLVES the order, because dow 2 then takes whichever is left. Anything
else kills (a) outright.

⚠ **The window is ~55 minutes wide.** Day 20700 opens at 11:00 PT (18:00Z) and
the JWT expires 2026-09-04T18:48:43Z. A session starting at the rollover can
take the point; a session starting an hour later cannot.
