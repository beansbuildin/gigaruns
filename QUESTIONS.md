# QUESTIONS

Open items needing a human. Task 3's gate has passed and is committed (ae1830f);
none of these block it.

---

## 1. Can a move at ≤ 0 charges actually be played? — blocks full §4a pruning

**Why it matters.** SPEC §4a originally said to zero out moves the enemy has no
charges for and renormalise. That is the single biggest claimed edge in the
strategy. If it's wrong, we assign probability 0 to a move the enemy can play,
which is the expensive kind of wrong.

**What we observed.** Across 14 charge transitions, every one moved by exactly
±1 (−1 on use, +1 per turn for unused moves, capped at `maxCharges`) — except
one:

```
state 005  foe  Shield 8/2 x1     ← enemy plays paper
state 006  foe  Shield 8/2 x-1    ← lands at -1, not 0
state 007  foe  Shield 8/2 x0     ← regenerates +1
```

So charges **can go negative**, and we never saw the enemy attempt a move at
`≤ 0`. Two readings, and we can't distinguish them from one sample:

- Negative is a *lockout counter* — the move is unplayable until it climbs
  above 0, and the extra −1 buys a turn of penalty.
- Negative is just an *accounting artifact* and the move remains playable.

**How to settle it.** Play on and watch for an enemy at `x0` or below. If it
ever plays that move, pruning is unsafe permanently. `scripts/battleWatch.ts`
already logs every transition, so this resolves itself with more observation —
no new tooling needed. Until then SPEC §4 says *down-weight, don't zero*.

## 2. Loot table shape — blocks §4c loot ranking

`lootOptions` is `[]` and `lootPhase` is `false` for the entire observed run.
The brief noted per-item drop percentages render in the UI, so the data is
almost certainly exposed once the phase flips — we just never reached it.

**What's needed.** One room won to completion while `scripts/battleWatch.ts` is
running. It snapshots `lootOptions` and prints it automatically. The run was
left paused at room 1 with you on 7 HP and the enemy on 4 HP.

Note for whoever picks this up: `dropItemIds` and `dropRateMultipliers` on the
`entryData` tiers are `[]` for all three Forbidden Woods tiers, so the drop
table does **not** come from `/game/dungeon/today`. It has to come from the loot
phase.

## 3. Fishing HAR — still blocks Task 7 (carried from session 01)

Confirmed this session that fishing is on a genuinely undiscovered surface:
**zero** matches for `/dendren|fish|cast|bait|node/i` across all seven probed
endpoints. There is nothing further to try without the capture.

Per SPEC §3a: gigaverse.io → DevTools → Network → filter Fetch/XHR → play one
Dendren cast start to finish → right-click → Save all as HAR →
`fixtures/fishing-cast.har` (already gitignored).

Not urgent — Tasks 4, 5 and 6 are all unblocked without it.

## 4. `dungeonId` in the action envelope — unverifiable until Task 6

The spec-drift diff flags `dungeonId` as quoted in SPEC.md but never seen in a
response. **This is not necessarily drift**: it is a *request* field in the §2
action envelope, and GET responses can neither confirm nor refute it.

Flagging it because the neighbouring evidence is suspicious — the API's own
`DUNGEON_ID_CID` means "run instance id", and the dungeon type is `ID_CID` as a
string. If `start_run` rejects `dungeonId: 5`, that naming is why. First real
POST at Task 6 settles it. Do not "fix" it speculatively before then.
