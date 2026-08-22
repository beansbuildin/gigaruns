# SESSION 03 LOG — 2026-08-14 — commit a7d1548

## Status
Task 4 "Simulator + fixtures": **GATE FAIL — not started.**
The session was spent entirely on the brief's Step 1 (live capture). Step 2
(the sim) was never begun. `vitest run` still exits 1, "No test files found."
Next per TASKS.md: Task 4, unchanged. Task 2 (auth + client) also still unbuilt.
Overall: `src/` is still empty and nothing has ever POSTed to the API, but the
fixture corpus went from 8 states of one dead run to 72 states across 5 dungeon
attempts reaching room 4, and three mechanics that block Tasks 4/5 are now
resolved from live data.

## What works
- `scripts/watch.ts` (new) — GET-only poller, 2.5s fixed cadence, hashes
  `data.run` and writes a fixture only on change. Ran 4 sessions, ~1400 polls,
  0 writes to the API. Verified GET-only by grep; only `method: "GET"` appears.
- `scripts/chargeTable.ts` (new) — emits the per-move charge table and answers
  the H1/H2 questions. Run over all 4 corpora: 134 played moves.
- `scripts/verifyCombatModel.ts` — fixed (see What's broken for what it was
  reporting before). Now: 14/14, 14/14, 24/24, 76/82 across the four corpora.
- Redaction: 0 wallet addresses, 0 JWTs, 0 `PRIVATE`, 0 `raw/` paths in the
  whole session diff. All raw dumps ignored by `fixtures/**/raw/`.
- `npx tsc --noEmit` — clean, exit 0.

## What's broken
- **Task 4 gate: `npx vitest run` exits 1, "No test files found."** Zero tests
  exist. Unchanged from session 02. This is the gate and it FAILS.
- `src/` is still entirely empty — no API client, no strategy, no orchestrator.
- **The combat model is exact only for clean exchanges.** 128/134 side-updates.
  The 6 misses are all mechanics outside the model (below). Anything built on
  the clean model is right for room 1 and increasingly wrong after it.
- **Two mechanics observed and NOT explained** — see Corrections. Do not model
  either from the current data.
- `/game/dungeon/state` returns a **500 HTML error page** once a run ends, not
  an empty state. The Task 2 client must not treat 5xx here as fatal.
- One watcher session can span several dungeon attempts. Both verifiers now
  split on `DUNGEON_ID_CID`, but any *new* analysis script must do the same or
  it will read the boundary between two attempts as a real exchange.

## Corrections to SPEC.md
All fixed in SPEC.md this commit (§3 phase table, §4 armor/unresolved block,
§4 charges, §4c).

- **SPEC §3/§4c said rewards arrive via `lootPhase` / `lootOptions`. They do
  not.** Across 5 attempts including runs that awarded loot, a boon and a heal,
  `lootPhase` was `false` and `lootOptions` `[]` **every time**. Nothing known
  populates them. The real surfaces are `rewardPathPhase`/`rewardPathOptions[]`
  (boons) and `enemyPathPhase`/`enemyPathOptions[]` (next enemy — and it carries
  `lootTable`). Session 02's "never reached a loot phase" was wrong; both runs
  did reach one.
- `enemyPathOptions[]` = `{index, tier, tierName: Safe|Risky|Dangerous, enemyId,
  enemyBuff, lootTable, rolledEnemyStats}`. `lootTable` =
  `{NAME_CID: "LT_D5_Room_2", ID_CID: 95, GAME_ITEM_ID_CID_array: [846],
  WEIGHT_CID_array: [1], LOOT_AMOUNT_CID_array: [9]}`. All three tiers shared an
  identical loot table in the one sample — higher tiers were pure added risk.
- **Boon values: read `selectedVal1`/`selectedVal2`, never `val1Min`/`val1Max`.**
  `selected*` is the applied value, already multiplied by `basicBoonMultiplier`
  (2). Observed `Heal` `val1: 8` → `selectedVal1: 16` (HP 15 → 31);
  `UpgradePaper` `val2: 2` → `selectedVal2: 4`. Ranking off the raw range halves
  every boon's value.
- **Armor refills to `currentMax` at every room transition; HP does not.**
  Observed at all 3 room boundaries. Armor is a per-room budget, wasted if
  unspent; HP is the run-long resource.
- **`rolledEnemyStats` (`evasion`/`block`/`lck`/`tenacity`) are live and affect
  damage.** Session 02's "all zero, safe to hardcode" is dead.
- **UNRESOLVED:** enemy 65 (`block: 2`, `evasion: 2`) took **8 damage from a
  16-ATK Sword win** — exactly half, but neither stat explains it. One sample.
- **UNRESOLVED:** with `Burn` up (applied amount 3), the enemy lost **1 HP/turn
  and regenerated no armor**. Tick rate and burn↔armor interaction unknown.
- Move charges: **PRESENT**, enemy's fully visible. Rule confirmed over 134
  played moves: played = −1, *except from exactly 1 charge, which lands on −1,
  skipping 0* (118/134 were −1; all 16 exceptions were plays from exactly 1).
  Unplayed regenerate +1 capped (105/105 below max, 163/163 at max unchanged,
  never exceeded max). Regen ticks on combat exchanges only, not on phase or
  room transitions. **This explains session 02's "unexplained decrement of
  two" — it was a last-charge rule, not two collapsed turns.**
- Resolved IDs: **forbiddenWoods=5**, **dendren=NOT FOUND** (unchanged; not
  re-probed this session).

## Dead ends
- **The brief's charge discriminator — "held a move at ≤0 and played a different
  one ⇒ illegal" — does not work. Do not retry it.** It fired 23 times; every
  instance left another legal move available, which is exactly what a free
  choice looks like under the opposite hypothesis. Forced plays: 0.
- **"Play Shield-heavy and conservative to survive to a loot phase"** (session
  03 brief) cost a full run. Shield's ATK 6 cannot out-damage enemy 63's 12
  armor, which fully restores on any enemy win; enemy HP never moved off 30/30
  in 7 exchanges. Surviving and winning are not the same axis.
- **I derived "enemy 63 is Shield-biased (57%)" off 14 exchanges and gave play
  advice from it. Over 39 exchanges it is uniform (31/38/31%).** Small-sample
  noise, same failure shape as session 02's combat-model overfit. Do not read a
  move distribution off fewer than ~40 exchanges.
- Asking the user to transcribe their move sequence from memory: ~75% accurate
  against the fixtures (miscounted exchanges per enemy in 3 of 4 fights). The
  capture has every exchange exactly — don't ask for this again.

## Metrics
- Live: **5 dungeon attempts, ~80 energy, all human-played. 0 runs by the bot,
  0 actions POSTed.** Deepest: room 4 / enemy 66, died there. 3 attempts died
  in room 1.
- Corpus: 72 states, 134 played moves, 4 capture directories.
- Combat model: **128/134 side-updates exact** (14/14, 14/14, 24/24, 76/82).
  All 6 misses attributable to heal / room-transition armor refill / Burn.
- Charge rule: 118/134 at −1, 16/16 exceptions explained by the last-charge
  rule. 268/268 unplayed transitions exactly as specified.
- Enemy profile (from fixtures):
  `63 HP30 ARM12 Sword12/6 Shield8/2 Spell16/4 — n=39, uniform 31/38/31`
  `64 HP35 ARM14 Sword14/7 Shield10/4 Spell8/3 — n=7`
  `65 HP38 ARM15 Sword10/5 Shield15/6 Spell12/4 — n=8`
  `66 HP40 ARM16 Sword16/4 Shield8/8 Spell14/4 — n=8`
  Enemies scale HP and armor with depth. 64–66 samples are too small to call.
- Sim: none. Not built.

## Open questions for Claude
1. **Charge legality is still UNRESOLVED after 134 played moves** and is the
   single biggest claimed edge in §4a. 23 qualifying turns, 0 forced. The
   cheapest test costs no energy: drive a move to −1 in the client and try to
   click it. Should the next session ask the user to do that before Task 4, or
   just build §4a behind the `chargesAreHardLimit` flag and move on?
2. **Two damage mechanics are unexplained** (enemy-65 half-damage; Burn tick +
   armor-regen suppression). Both need targeted capture, not more general runs.
   Is it worth one run specifically to sit on a Burn stack and watch the ticks?
3. **Scope call for Task 4.** Boons, status effects and rolled enemy stats
   materially change combat from room 2 onward. Options: (a) sim the clean model
   only, accurate for room 1 and knowingly wrong deeper; (b) sim clean + treat
   boons/status as explicit unmodelled inputs that fail closed; (c) capture more
   before simulating. Recommend (b), but the brief should say.
4. `enemyPathOptions` tier choice (Safe/Risky/Dangerous) is a real strategic
   decision with no spec at all. All three tiers shared one loot table in the
   single sample — if that generalises, higher tiers are pure downside and the
   rule is trivially "always Safe". Worth one capture to confirm?

## Files changed
```
 SPEC.md                                    |  108 ++-
 handoff/DECISIONS.md                       |   10 +
 handoff/STATE.md                           |  rewritten
 handoff/log/session-03.md                  |  new
 scripts/chargeTable.ts                     |  259 ++ (new)
 scripts/watch.ts                           |  228 ++ (new)
 scripts/verifyCombatModel.ts               |   58 +-
 fixtures/dungeon-runs/run-2026-08-13-23-21-36/*.json |  8 files (new, redacted)
 fixtures/dungeon-runs/run-2026-08-13-23-29-39/*.json | 15 files (new, redacted)
 fixtures/dungeon-runs/run-2026-08-14-01-00-08/*.json | 49 files (new, redacted)
```

---

# Appendix — verbose detail

## A. The four captures

| dir | attempts | states | outcome |
|---|---|---|---|
| `fixtures/dungeon-runs/` (flat) | 1 | 8 | session-02 corpus, died room 1 |
| `run-2026-08-13-23-21-36` | 1 | 8 | died room 1, enemy HP never moved off 30/30 |
| `run-2026-08-13-23-29-39` | 1 | 15 | cleared room 1, died room 2 at 2 HP |
| `run-2026-08-14-01-00-08` | 3 | 49 | two died room 1; third reached room 4 |

## B. The six combat-model misses, in full

```
── 027→028  Shield vs Sword  → me
   ✗ me   predicted HP 15 ARM 15   actual HP 31 ARM 15
```
Not an exchange. `rewardPathPhase` heal boon: `Heal`, `val1Min/Max: 8`,
`selectedVal1: 16`. HP 15 + 16 = 31.

```
── 037→038  Sword vs Sword  → tie
   ✗ me   predicted HP 22 ARM 5   actual HP 22 ARM 15
```
Room 3 → room 4 transition. Armor refilled 5 → 15 (`currentMax`). HP unchanged.

```
── 045→046  Sword vs Spell  → me
   ✗ foe  predicted HP 28 ARM 0   actual HP 25 ARM 0
```
3 extra damage = `AddBurnSword` `selectedVal1: 3` on a Sword win. Enemy
`statusEffects` becomes `[{"type":"Burn","amount":3}]` in the same state.

```
── 046→047  Shield vs Shield  → tie
   ✗ foe  predicted HP 25 ARM 2   actual HP 24 ARM 0
── 047→048  Shield vs Shield  → tie
   ✗ foe  predicted HP 24 ARM 2   actual HP 23 ARM 0
```
Burn present (amount 3) but the enemy loses exactly **1 HP/turn**, and
regenerates **0 armor** where the model expects 2. UNRESOLVED: is the tick 1
regardless of amount, and does Burn suppress armor regeneration outright?

```
── 029→030  Sword vs Spell  → me
   ✗ foe  predicted HP 37 ARM 0   actual HP 38 ARM 7
```
Enemy 65, `block: 2`, `evasion: 2`, `battleArmorReduction: 0`, my Sword
`currentATK: 16`. Armor went 15 → 7, i.e. **8 damage from a 16-ATK win**, HP
untouched. Exactly half, but `block 2` and `evasion 2` do not produce 8 under
any obvious arithmetic. UNRESOLVED on one sample.

## C. Boon objects observed (verbatim shapes)

`AddLuck` Common val1 1 · `CorrosiveShield` Uncommon val1 2 ·
`UpgradePaper` Uncommon val2 2 → selectedVal2 4, `MaxRoom: 12` ·
`AddEvasion` Common val1 1 · `Heal` Uncommon val1 8 → selectedVal1 16,
`MaxRoom: 12` · `AddBurnSword` Uncommon val1 3.

Common fields: `{MinRoom, MaxRoom, RestrictedToDungeons: ["5"], BoonType,
Rarity, val1Min, val1Max, TokenId, UINT256_CID_array, UINT256_CID, RARITY_CID,
selectedVal1, selectedVal2, boonTypeString, docId}`.

`pickedBoons` on the player accumulates the full boon objects across the run.

## D. enemyPathOptions — the tier choice

Three options, all `enemyId: 64`, all sharing `lootTable` `LT_D5_Room_2`
(`ID_CID 95`, items `[846]`, weights `[1]`, amounts `[9]`):

- tier 0 `Safe` — `enemyBuff: null`, rolled `{evasion:0, block:0, lck:0, tenacity:0}`
- tier 1 `Risky` — `Cursing`, "Applies 1 Vulnerable on Magic wins"
  (`onEnemyWinExchange_applyStatus`, `statusType: Vulnerable`, amount 1,
  `moveType: scissor`), rolled `{evasion:2, block:0, lck:2, tenacity:1}`
- tier 2 `Dangerous` — `Firebrand`, "Applies 2 Burn on Sword wins"
  (`statusType: Burn`, amount 2, `moveType: rock`), rolled
  `{evasion:2, block:1, lck:1, tenacity:3}`

Identical loot across tiers means the tier premium bought nothing in this
sample. If that generalises the rule is "always Safe" — but it is one sample.

## E. Recollection vs fixtures

The user transcribed their move sequence from memory for all four enemies.
Checked against the recorded states: ~75% match. Enemy 1 — 7 listed, 8 actual.
Enemy 2 — 4 listed, 3 actual. Enemy 3 — 9 listed, 8 actual. Enemy 4 — 8 listed,
8 actual, 4 with at least one move wrong. The fixtures hold every exchange with
exact HP/armor/charges, so nothing was lost; but recollection is not a data
source and should not be requested again.

## F. Verification commands and output

```
npx tsc --noEmit                                              -> exit 0
npx tsx scripts/verifyCombatModel.ts fixtures/dungeon-runs    -> 14/14 HOLDS
  ... run-2026-08-13-23-21-36                                 -> 14/14 HOLDS
  ... run-2026-08-13-23-29-39                                 -> 24/24 HOLDS
  ... run-2026-08-14-01-00-08                                 -> 76/82 BROKEN
npx tsx scripts/chargeTable.ts                                -> 134 played moves
npx vitest run                                                -> exit 1, NO TEST FILES
```

`--rejected` replays the superseded combat model as a falsification check. It
fails, but it is reconstructed from STATE.md prose and omits the "Shield ties"
special case, so its failure is NOT evidence that session 02's model scored
differently than logged. Do not cite it as such.
