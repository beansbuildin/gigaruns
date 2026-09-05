# scratch — session 122 — 2026-09-05 — PRE-REGISTRATION

**Committed BEFORE any `start_run`. This file is the test; anything written
after the spend is a story fitted afterwards.** Session 121's `f35602e0` is the
precedent and STATE's "What works" says to repeat it.

## Step 0 — JWT

STATE recorded expiry `2026-09-04T18:48:43Z`. **The user refreshed it.**
`scripts/doctor.ts` at 2026-09-05T16:54Z: *"token present and valid for another
167.8h"* (~7 days). Authenticated as `<USER>` /
`<ADDRESS REDACTED>`. Step 0 PASSES; live work proceeds.

> ⚠ **[session 122] The bare wallet address was written here in the
> pre-registration commit `4d68bc84` and is redacted above.**
> `scripts/secretScan.ts` caught it at closeout as the ONLY unexplained
> hit across 12,329 tracked files — the repo redacts addresses
> everywhere else (fixtures carry `0xUSER`), so this was a genuine
> break in that convention, and it was mine.
>
> **Not rotated, and no rotation is possible or needed**: it is the
> account's public on-chain address, visible on any block explorer, not
> a credential. CLAUDE.md rule 3's rotation instruction is about the
> JWT, which was never printed — `doctor.ts` shows only a truncated
> 8-character prefix plus a length.
>
> **Fixed forward rather than by rewriting history, deliberately.**
> `4d68bc84` is the pre-registration whose whole value is that it is a
> tamper-evident timestamp predating `start_run`; amending it to tidy a
> public address would destroy the thing it exists to prove. The commit
> stands, the leak is disclosed here, and the decision to rewrite
> history is the user's, not an agent's.

## Step 1 — live readings, all five brief claims CHECKED

Read at 2026-09-05T16:54–16:57Z. **All five confirmed.** For once the brief was
right on every checkable claim — worth saying, after four consecutive sessions
(115, 116, 118, 121) in which a stale or wrong printed caption was the defect.

| # | Claim | Verdict | Live reading |
|---|---|---|---|
| A | day 20700, dow 1 | ✓ CONFIRMED | `TIMESTAMP_CID 20700`; `checkEntryTiers` "game day 20700 (week 87, dayOfWeek 1) — next day in 01:05:19" |
| B | balances unchanged from s121 close | ✓ CONFIRMED | all seven exact, total 246 |
| C | run-units fresh 0/12 | ✓ CONFIRMED | dungeon 5 `dayProgressEntities: null` |
| D | fishing fresh 0/20 | ✓ CONFIRMED | `dayDocs[pond 2] = 0/20`, repo ledger 0, caps agree |
| E | rod 812 durability 28 | ✓ CONFIRMED | `DURABILITY_CID 28`, slot 14, `GearInstance#812_1787690500_766077e9` |

Balances live, 2026-09-05T16:55Z:

```
f4 138 Archon   18      f3 137 Athena   21      f7 134 Chobo    30
f1 135 Crusader 39      f6 140 Summoner 42      f5 139 Foxglove 45
f2 136 Overseer 51                                   total 246
```

⚠ **THE WINDOW IS ~63 MINUTES.** Day 20700 rolls to 20701 at 18:00Z and it was
16:57Z at commit time. Run 1 is the whole measurement and must land inside it.

### ▸ SURPRISE, logged now rather than at recap: a `Dungeon#3` DayCount at 9

`checkDungeonToday.ts` returned dungeon 5 = null (0 used) but ALSO printed a
sibling doc `DayCount#...#Dungeon#3` with `UINT256_CID: 9`, `TIMESTAMP_CID:
20700`, `updatedAt: 2026-09-05T16:30:49Z` — 23 minutes before this reading.
**This bot did not do that.** Two readings are open and they differ by 3 runs:

- the 12-unit ledger is **PER DUNGEON**, dungeon 5 is untouched, 4 runs are
  available — or
- the ledger is **SHARED**, 9 of 12 are already gone, and only **1** juiced run
  (3 units) is available today.

**Do not assume the first because it is the convenient one.** `liveRun.ts
--dry-run` exercises the real gate and costs nothing — rule 12's actual lesson —
so the dry-run answers this before run 1, and if the gate refuses, that is the
answer and the recap reports it as a finding, not a blocker to reason around.

## Step 2 — THE PREDICTION

### Rotation, day 20700 = dow 1

Observed fragment, five days: **dow3→f5 Foxglove, 4→f6 Summoner, 5→f7 Chobo,
6→f3 Athena, 7→f4 Archon.** Two slots (dow 1, dow 2) and two factions
({f1 Crusader, f2 Overseer}) remain.

**Under hypothesis (a) — a fixed 7-permutation — run 1 MUST charge exactly one of:**

- **f1 Crusader (135), 39 → 36**
- **f2 Overseer (136), 51 → 48**

**No prediction is made about WHICH.** That is the design: either answer forces
the other into dow 2, so **either branch solves the permutation.**

### Falsifiers, stated in advance

1. **(a) DIES OUTRIGHT** if the mover is Foxglove (139), Summoner (140), Chobo
   (134), Athena (137) or Archon (138) — any faction already claimed by dows
   3–7. A repeat inside one cycle is not a permutation. **Do not re-fit an
   arithmetic rule to six points** if this fires; STATE's Dead ends says so and
   three consecutive +1 steps already produced one confident wrong answer.
2. **The CHARGE-SHAPE claim dies SEPARATELY** (currently 17/17: exactly one
   faction, exactly 3) if more than one faction moves, or if the amount is
   anything but 3. Session 118 is the precedent for one claim dying without the
   other.

### Why this day is decisive where day 20699 was not

Day 20699's predicted set was 3-of-7, which a random draw hits 43% of the time —
Bayes factor ~2.3, recorded by STATE as explicitly **not a solve**. Today's set
is **2 of 7** (29% under (b)) and a pass **completes the permutation**. So:

- **PASS** → (a) survives AND the full 7-permutation is determined for the first
  time. Write it out in full.
- **FAIL** → (a) is dead, like the arithmetic rule at day 20698.

### Rod: PLAYED vs CHARGED decrement — pre-registered too

Rod 812 at **28**, decrement measured at **1.00 durability/cast** (two clean
10-cast brackets, 48→38→28, session 121). 30 casts authorized; the game charges
only 20/day. Crossing the charge boundary discriminates:

- **per PLAYED cast** → 28 → **8 after cast 20**, → 7 at cast 21, → 0 at **cast 28** (HALT).
- **per CHARGED cast only** → 28 → **8 after cast 20 and STOPS FALLING**; casts
  21–30 cost nothing, all 30 complete, no halt, no repair.

**The 20→21 step is the entire discriminator.** Read durability at casts 19, 20,
21 and at the halt; report all four.

### Standing directives that bind this session's fishing

- **[USER 2026-09-05] Fish the rod to ZERO, HALT, hand back, WAIT for a manual
  repair.** The rod is not to be conserved and is not a reason to cut the batch
  short. 0→50 is a manual repair, not a timer (DECISIONS 2026-09-03), so the
  halt is a handback, not a sleep.
- Oils **Relaxing-only**; double-lethal override DISABLED, Focus off the
  allowlist. Focus triggers log **policy-withdrawn**, not dry-bag.
- Report **played vs charged separately**. Never report 30 charged.

### `LIVE.drift` — the RATIFIED threshold, recorded before the fifth reading exists

**[USER, 2026-09-05]** Approved in chat **before** this session's casts run,
which is what makes it a test. Two arms, either sufficient:

> **Re-derive `LIVE.drift` if `|LIVE.drift| >= 1.0`** (STATE's existing rule,
> unchanged), **OR if it moves five consecutive times in the same direction,
> regardless of magnitude.**

Prior four, monotone: **-0.6417 -> -0.6593 -> -0.6850 -> -0.6882** (s121 batch
alone -0.7436). **This batch is move five.** Unless it moves upward (less
negative) or is exactly unchanged, **the direction arm FIRES and the response is
RE-DERIVE, not another pin.** Not to be reasoned around at the moment it fires —
setting it in advance is the whole point. STATE open question 4 is CLOSED.
