# scratch — session 04 surprises

## S1 — "Armor refills at room transition" is FALSE. (refutes DECISIONS 2026-08-14 #26)

Checked every room boundary in the corpus (pairs where `players[1].id` changes,
same `DUNGEON_ID_CID`). There are exactly **four**:

```
run-23-29-39  009->010  63->64  me ARM  4/15 ->  4/15   HP  2-> 2  ch [2,0,3]->[2,0,3]
run-01-00-08  022->023  63->64  me ARM 15/15 -> 15/15   HP 15->15  ch [2,2,2]->[2,2,2]
run-01-00-08  028->029  64->65  me ARM 15/15 -> 15/15   HP 31->31  ch [2,2,3]->[2,2,3]
run-01-00-08  039->040  65->66  me ARM 15/15 -> 15/15   HP 22->22  ch [2,1,3]->[2,1,3]
```

Three of the four had the player **already at the armor cap**, so they carry no
information — "refilled to max" and "unchanged" are the same observation at
15/15. The single informative boundary is the first one, and armor stayed at
**4/15**. It did not refill.

What actually refills is the **enemy**: a room transition swaps in a new entity
at full pools (`HP 40/40 ARM 16/16`). Session 03 read the enemy's fresh pools as
a global room-transition rule and applied it to the player too.

Nothing carries over differently: HP, armor, and charges all persist unchanged
across the boundary.

**Consequence — the §4b guidance built on this is backwards.** SPEC currently
says armor is "a per-room budget that is wasted if unspent" and that "spending
armor freely late in a room costs nothing". It is not a per-room budget; it is a
run-long resource that is merely *renewable in combat* (via a won/tied move's
DEF). Spending it late in a room costs exactly as much as spending it early.

Same failure shape as the session-03 enemy-63 read and the Shield advice: a
confident rule off samples that could not discriminate.

## S2 — the corpus is cleanly split at the first reward phase

Room 1 (enemy 63) is entirely free of unmodelled mechanics in every run: no
boons, no status effects, all rolled stats zero. Every contaminant enters at or
after the first `rewardPathPhase`:

- `lck=1` / `evasion=1` on the player from turn 1 of room 2 onward (boons)
- enemy 65 carries `evasion 2 / block 2 / lck 1`
- enemy 66 carries `statusEffects [{Burn, 3}]`

So coverage is not a smooth fraction — it is a hard wall at the end of room 1.
That is worth stating as the headline number rather than burying it.

## S3 — rolled stats: read `current`, not `starting`

`evasion/block/lck/tenacity` are `{current, starting}` pools and **`starting` is
0 even when `current` is non-zero** (enemy 65: `starting 0`, `current 2`). A
coverage check written against `starting` reports a clean corpus and is wrong.
