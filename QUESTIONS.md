# QUESTIONS

Open items needing a human. Task 4's gate has passed and is committed; none of
these block it.

---

## 1. Can a move at ≤ 0 charges actually be played? — one click settles it

**Status 2026-08-15: no longer blocking, but still unproven.** The flag
`chargesAreHardLimit` now defaults to `true` (prune) on the strength of the
enemy-only recount — 11 clean opportunities where the enemy held a move at ≤0,
0 taken, `p ≈ 0.012` under the soft-cost null. See SPEC §4 charges. The player's
own 12 opportunities are excluded as policy-contaminated: the user was following
a guide that avoided low-charge moves, so a zero there proves nothing about the
rule.

**What we still want.** `p ≈ 0.012` is suggestive, not settled, and it is the
single biggest claimed edge in §4a. One observation of an enemy playing a move
at ≤0 flips the default straight back.

**The decisive test costs no energy and takes one minute:** in the browser
client, play a single move until its charge counter reads `-1` (any move, any
run — the last-charge rule drives it there after two plays from 3), then try to
click that move. Report whether the client lets you select it.

- If it refuses → hard prune confirmed, remove the flag.
- If it accepts → soft cost confirmed, flip the default to `false` and we have
  been pruning a legal move.

Please do this before Task 5 if convenient; §4a's EV engine is built on it.

## 2. Loot table shape — RESOLVED 2026-08-14, superseded by question 5

`lootOptions`/`lootPhase` are not the reward surface at all; boons arrive via
`rewardPathPhase`/`rewardPathOptions[]` and the loot table rides on
`enemyPathOptions[].lootTable`. See SPEC §3d. What remains open is the tier
choice — question 5.

## 5. The coverage wall: everything past room 1 is unscorable

**This is now the project's main constraint, and it is a capture problem, not a
code problem.** The sim refuses to score any unit touching a mechanic we cannot
model, and the corpus contamination is not gradual — it is a wall:

```
room 1                    clean in every capture
first rewardPathPhase  →  boons, rolled enemy stats, status effects, enemy buffs
```

Clearing a room means taking a boon, so **a scored run is by construction one
that died in room 1**, and `deepestScorableRoom` is 1. Task 5's strategy work
can only be validated on room-1 battles until this moves.

Three things would each raise coverage by a whole room, in order of value per
energy spent:

1. **Boon stat effects.** After taking a boon, diff the player's move ATK/DEF
   and HP/armor maxima against the state before it. `pickedBoons` carries the
   full boon object with `selectedVal1`/`selectedVal2`, so if the deltas match
   the selected values, boons stop being unmodelled and rooms 2+ open up. This
   is the single highest-value capture available and it needs no new tooling —
   `scripts/watch.ts` already records every state.
2. **Rolled enemy stats.** The enemy-65 half-damage case (8 from a 16-ATK Sword
   win, `block 2 / evasion 2`) is still one sample. Needs several exchanges
   against an enemy with known non-zero rolled stats.
3. **Burn's tick rate** and its interaction with armor regen. Also one sample.

## 6. `enemyPathOptions` tier choice — still unspecified

Safe / Risky / Dangerous, with an identical `lootTable` across all three tiers
in the single captured sample. If that generalises, higher tiers are pure added
risk and the rule is trivially "always Safe" — but it is one sample, and it is a
real strategic decision with no spec. One capture of a reward phase, reading all
three tiers' loot tables, settles it.

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
