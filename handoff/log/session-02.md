# STATE — session 02 — 2026-08-13 — commit a9abd4d

## Status
Task 3 "Probe & discovery": **GATE PASS**
Next per TASKS.md: Task 4 — Simulator + fixtures. (Task 2, Auth + API client,
was deliberately deferred behind Task 3 — see DECISIONS 2026-08-13. It is still
unbuilt and is the other unblocked task.)
Overall: Forbidden Woods is `dungeonId 5`, 20 energy, 16 rooms; the full combat
model is confirmed and machine-checked against 8 recorded live battle states;
`src/` is still entirely empty.

## What works
- `scripts/probe.ts` — ran live against the API. Resolved Forbidden Woods from
  `GET /game/dungeon/today`, dumped 7 endpoints, wrote `config/discovered.json`.
- `scripts/battleWatch.ts` (new) — GET-only poller. Captured 8 distinct battle
  states across 7 exchanges of a human-played run, snapshotting on change.
- `scripts/verifyCombatModel.ts` (new) — replays every recorded exchange and
  diffs predicted HP/armor against the server's actual values.
  **Verified: 14/14 side-updates matched, exit 0.**
- `npx tsc --noEmit` — clean, exit 0.
- Redaction: raw dumps (address, username) stay in gitignored `**/raw/`;
  committed copies carry `0xUSER` / `<USER>` / `<JWT>` with every
  game-mechanical value intact.
- Secret scan over the whole session diff — 0 hits for address, JWT, username.

## What's broken
- `npx vitest run` — **exit 1, "No test files found."** Zero tests exist. This
  is Task 4's job, but it means nothing in this repo is regression-protected.
- `src/` is still empty. No API client, no strategy, no orchestrator. Nothing
  has ever POSTed to the API; the human played every observed move.
- Loot table completely unobserved. `lootOptions` was `[]` for the whole run and
  `lootPhase` never flipped — the run ended in a death. §4c loot ranking is
  built on zero evidence.
- Charge semantics incomplete — see Corrections. Pruning cannot be built safely.
- `handoff/next.md` carried the raw username. Redacted to `<USER>` in the
  working tree, but it is still present in git history at commit b26bc6f
  (user-authored, before this session). Removing it there needs a history
  rewrite and force-push — NOT done, ask first.

## Corrections to SPEC.md
All fixed in SPEC.md this session (§3 table, new §3c/§3d, §4, §4a, §4b, §4c).

- **Combat resolution — SPEC had no model at all; now CONFIRMED.** A side that
  **wins or ties** regenerates armor = **its own move's `currentDEF`**, capped
  at `currentMax` (excess wasted), then deals its **full `currentATK`**. A loser
  gains and deals nothing. Regen resolves **before** damage. Damage depletes
  armor first, overflow carries to HP the same exchange. A tie = both sides
  winning. **Every move regenerates, not just Shield.**
- **I first derived a WRONG model that also scored 14/14.** It had only Shield
  granting armor, ties dealing `ATK − opponent DEF`, and a special case for
  Shield ties. The two are algebraically identical while armor is 0 and the cap
  is slack, and every observed win was Sword (DEF 0) or the enemy's Shield — so
  no win with a DEF-bearing non-Shield move ever exercised the deciding branch.
  It is wrong the moment you win with Spell: 0 armor granted instead of 8. The
  correct model came from the user, not from the data. Recorded in SPEC §4 as a
  "do not reintroduce" block.
- **There is no in-combat healing.** HP is restored only by a card offered after
  a won fight. Armor is renewable, HP is not. SPEC §4b previously implied they
  were interchangeable; `w₃=0.3` raised to ~0.8 and effective-HP demoted to a
  baseline to beat rather than the default.
- SPEC §2 `dungeonId` — never seen in any response, but it is a **request**
  field, so GETs can neither confirm nor refute it. Left unverified, not
  "corrected". Settles at Task 6.
- `entity.ID_CID` is the dungeon type and is a **string** `"5"`;
  `dungeonDataEntities[].ID_CID` is the **number** `5`. Coerce at the boundary.
- `DUNGEON_ID_CID` (`24754733`, on both `run` and `entity`) is the **run
  instance id**, not the dungeon id.
- `players[1].id` = `"Enemy Room 63"` embeds `ENEMY_CID` 63, **not** the room.
  Room is `entity.ROOM_NUM_CID`.
- **No floor field exists** anywhere. Only `ROOM_NUM_CID`.
- `entryData` is ordered tier 2, 1, 3 — **array index is not tier**.
- Tier 1 is free (`inputItems: []`); tiers 2/3 consume 7 items each and carry
  `inputsBasedOnFactionDay: true`, so the required list is **not static**.
- Energy is stored scaled (`ENERGY_CID: 332247916021`). Read
  `parsedData.energyValue`. Never the raw CID.
- Armor is the `shield` field, a full pool parallel to `health`, not a minor term.
- Resolved IDs: **forbiddenWoods=5** (energy 20, maxRoom 16, basicBoonMultiplier
  2), **dendren=NOT FOUND** — zero hits for `/dendren|fish|cast|bait|node/i`
  across all 7 endpoints. Fishing is on a genuinely undiscovered surface.
- Move charges: **PRESENT, and the enemy's are fully visible** —
  `currentCharges`/`maxCharges` per move on both `players[]` entries, alongside
  `currentATK`/`currentDEF`. No hidden information in the move layer.
  **But see the caveat under Open questions — charges can go negative.**

## Dead ends
- Deriving combat rules from fixtures alone. The corpus fit two different models
  perfectly and could not separate them. Don't trust a 100% fit until you have
  checked the data actually exercises the branch that distinguishes candidates.
- Searching the 7 confirmed endpoints for fishing. Zero hits. Do not re-probe
  for Dendren without the HAR; the surface is not reachable from these paths.
- First `.gitignore` rule was `fixtures/probe/raw/`, which missed
  `fixtures/dungeon-runs/raw/` and staged 104 address-bearing lines. Caught
  pre-commit. Rule is now `fixtures/**/raw/`. Any new capture script writing to
  a fresh directory needs re-checking.

## Metrics
- Live: 0 runs played by the bot. 0 energy spent. 0 actions POSTed. All
  observation GET-only; a human played the run.
- Observed: 1 human run, 7 exchanges, 8 states, room 1, enemy 63, tier 1,
  ended in death.
- Combat model: 14/14 side-updates predicted exactly.
- Damage taken across the run: 51, of which armor absorbed 27.
- Account: noobId <NOOB_TOKEN>, energy 332/420, regen 18/hr, juiced.

## Open questions for Claude
1. **Can a move at ≤ 0 charges be played?** Blocks SPEC §4a pruning, which is
   the single biggest claimed edge. 13 of 14 charge transitions moved by exactly
   ±1 (−1 on use, +1/turn regen, capped). The exception: the enemy played
   `paper` at `currentCharges: 1` and it landed at **−1**, then regenerated to 0.
   So charges go negative and we never saw a move attempted at ≤ 0. Either
   negative is a lockout (pruning valid) or an accounting artifact (pruning
   unsafe). SPEC now says down-weight, don't zero. Resolves with more observed
   runs — `battleWatch.ts` already logs every transition, no new tooling needed.
2. **Loot table shape — blocks §4c entirely.** Never reached a loot phase.
   `dropItemIds`/`dropRateMultipliers` are `[]` on all three `entryData` tiers,
   so the table is *not* in `/game/dungeon/today`; it must come from
   `lootOptions` during `lootPhase`. Needs one room won with `battleWatch.ts`
   running — a fresh run, 20 energy. Same run also answers Q1 and shows the heal
   card. Should the next session ask the user for this before Task 4, given §4c
   is currently specified against no evidence at all?
3. **Task 4 or Task 2 next?** Both unblocked. Task 4 (sim) can be built purely
   from the 8 committed fixtures plus the verified combat model, with no network
   and no auth. Task 2 (auth + client) is a prerequisite for Task 6 but nothing
   sooner. Recommend Task 4 — the model is fresh and machine-checkable now — but
   the brief should say which.
4. Unmodelled battle fields, all zero/empty in the one observed run:
   `tenacity`, `evasion`, `lck`, `intuition`, `block`, `battleArmorReduction`,
   `activeEffects`, `statusEffects`, `pickedBoons`, `triggeredBoons`,
   `gearBoons`, `focusBuffs`. Worth asking the user what any of these do before
   the sim hardcodes them to zero?

## Files changed
```
 .gitignore                           |    7 +
 QUESTIONS.md                         |   77 ++   (new)
 SPEC.md                              |  189 +++-
 fixtures/dungeon-runs/state-00{0..7}.json | 2357 ++  (new, redacted)
 fixtures/probe/*.json (7 files)      | 2757 ++   (new, redacted)
 handoff/DECISIONS.md                 |    2 +
 handoff/scratch-session-02.md        |  149 ++   (new)
 scripts/battleWatch.ts               |  135 ++   (new)
 scripts/probe.ts                     |  119 ++-
 scripts/verifyCombatModel.ts         |  129 ++   (new)
 23 files changed, 5902 insertions(+), 19 deletions(-)
```

---

# APPENDIX — session 02 verbose

## verifyCombatModel.ts full output

```
── 000→001  Sword vs Spell  → me
   ✓ me   predicted HP 32 ARM 15   actual HP 32 ARM 15
   ✓ foe  predicted HP 26 ARM 0   actual HP 26 ARM 0
── 001→002  Shield vs Shield  → tie
   ✓ me   predicted HP 32 ARM 7   actual HP 32 ARM 7
   ✓ foe  predicted HP 22 ARM 0   actual HP 22 ARM 0
── 002→003  Sword vs Shield  → foe
   ✓ me   predicted HP 31 ARM 0   actual HP 31 ARM 0
   ✓ foe  predicted HP 22 ARM 2   actual HP 22 ARM 2
── 003→004  Spell vs Spell  → tie
   ✓ me   predicted HP 23 ARM 0   actual HP 23 ARM 0
   ✓ foe  predicted HP 16 ARM 0   actual HP 16 ARM 0
── 004→005  Shield vs Shield  → tie
   ✓ me   predicted HP 23 ARM 4   actual HP 23 ARM 4
   ✓ foe  predicted HP 12 ARM 0   actual HP 12 ARM 0
── 005→006  Sword vs Shield  → foe
   ✓ me   predicted HP 19 ARM 0   actual HP 19 ARM 0
   ✓ foe  predicted HP 12 ARM 2   actual HP 12 ARM 2
── 006→007  Sword vs Sword  → tie
   ✓ me   predicted HP 7 ARM 0   actual HP 7 ARM 0
   ✓ foe  predicted HP 4 ARM 0   actual HP 4 ARM 0

✓ MODEL HOLDS — 14/14 side-updates matched
```

## Full observed run (battleWatch.ts)

```
── 000  room 1  enemy 63
   me   HP 32/32  ARM 15/15  Sword 16/0 x3  Shield 6/12 x3  Spell 12/8 x3
   foe  HP 30/30  ARM 12/12  Sword 12/6 x3  Shield 8/2 x3  Spell 16/4 x3
── 001  me HP 32/32 ARM 15/15 | foe HP 26/30 ARM 0/12   last: me=Sword foe=Spell  won: me
── 002  me HP 32/32 ARM  7/15 | foe HP 22/30 ARM 0/12   last: me=Shield foe=Shield won: tie
── 003  me HP 31/32 ARM  0/15 | foe HP 22/30 ARM 2/12   last: me=Sword foe=Shield  won: foe
── 004  me HP 23/32 ARM  0/15 | foe HP 16/30 ARM 0/12   last: me=Spell foe=Spell   won: tie
── 005  me HP 23/32 ARM  4/15 | foe HP 12/30 ARM 0/12   last: me=Shield foe=Shield won: tie
── 006  me HP 19/32 ARM  0/15 | foe HP 12/30 ARM 2/12   last: me=Sword foe=Shield  won: foe
── 007  me HP  7/32 ARM  0/15 | foe HP  4/30 ARM 0/12   last: me=Sword foe=Sword   won: tie
        (run ended in a death on the following exchange — not captured)
```

## Charge transitions — the anomaly in full

```
        000 001 002 003 004 005 006 007
me rock   3   2   3   2   3   3   2   1
me paper  3   3   2   3   3   2   3   3
me sciss  3   3   3   3   2   3   3   3
foe rock  3   3   3   3   3   3   3   2
foe paper 3   3   2   1   2   1  -1   0   <-- 005->006 moved by -2
foe sciss 3   2   3   3   2   3   3   3
```
Every transition is -1 (played) or +1 (unused, capped at max) EXCEPT foe paper
005->006, which went 1 -> -1 while being played. Raw JSON confirms it; no
statusEffects, activeEffects, or battleArmorReduction were set on either side
at any point in the run, so nothing visible explains the extra -1.

## Forbidden Woods entity, verbatim

```json
{ "ID_CID": 5, "enabled": true, "devEnabled": true,
  "NAME_CID": "Forbidden Woods", "ENERGY_CID": 20, "UINT256_CID": 12,
  "CHECKPOINT_CID": -1, "juicedMaxRunsPerDay": 12, "gearEnabled": true,
  "consumablesEnabled": true, "maxRoom": 16, "dungeonDisabled": false,
  "juicedMultiplier": 1, "minLevelForInvader": 79, "invaderPercentage": 10,
  "juicedModeEnabled": true, "basicBoonMultiplier": 2 }
```

All four dungeons for comparison (UINT256_CID appears to be base runs/day):
```
ID 1 Dungetron 5000  energy 40  UINT256 10  juiced 12  maxRoom 16
ID 3 Underhaul       energy 40  UINT256  8  juiced  9  maxRoom 16  CHECKPOINT 2
ID 4 Void Dungeon    energy  0  UINT256 9999           maxRoom 17  DISABLED
ID 5 Forbidden Woods energy 20  UINT256 12  juiced 12  maxRoom 16  boonMult 2
```

## Spec drift diff output

183 observed keys. 157 appear in the API but nowhere in SPEC.md — the spec
documents almost none of the `*_CID` layer. 1 identifier is quoted in SPEC.md
and never seen in a response: `dungeonId`, which is a REQUEST field and so
cannot be refuted by GETs. Not treated as drift.

## Probe defects fixed this session

1. `config/discovered.json` was written with `id: null`. "Forbidden Woods"
   matches the entity `NAME_CID` and all three `entryData` tier names; the
   entity is not last in iteration order, so last-write-wins clobbered id 5.
   The gate would have "passed" against a null. Now refuses to overwrite a real
   id with a null one, and records energyCost/maxRoom/tiers alongside.
2. SPEC §3b requirement 5 (spec-drift diff) had never been implemented. Added.
3. Raw dumps carry the wallet address and username. Split raw (gitignored) from
   redacted (committed). First rule was `fixtures/probe/raw/` and missed
   `fixtures/dungeon-runs/raw/`, staging 104 address-bearing lines; widened to
   `fixtures/**/raw/`. Username redaction (`<USER>`) was missing entirely on the
   first pass and added during the recap scan.
