# STATE — session 103 — 2026-08-27 (UTC fixture dates; game day rolled 11:00 PT 2026-08-26) — code at commit <RECAP_SHA>

## Status
Brief was a single item: **the dungeon batch — up to 4 juiced Tier-3 runs, one
at a time, explicit human go-ahead before each (CLAUDE.md rule 11). GATE PASS.**
All four ran. The ledger read **0/12 on arrival** so the brief's "say so plainly
if it is anything other than 0/12" branch did not fire for Forbidden Woods.
Every run was authorised live, individually, before it started; the batch
stopped because `dayProgressEntities` reached **12/12**, not because anything
tripped. No denials, no interruptions, **no rule-13 situation**.

Suite **2057 passed / 2057, 111 files** (`vitest run --maxWorkers=4` — the
default over-subscribes this machine and produces FALSE timeout failures,
session 100's finding, unchanged). `tsc --noEmit` clean, `git diff --check`
clean, secret scan **0 hits on all four patterns**, `discoveredShipsClean` 8/8.

**Live spend: 4 runs, 240 energy, 12 Big Heal Juices, 12 of 12 run-units.
Zero fishing casts.**

⚠ **The account's GEAR CHANGED TWICE DURING THE BATCH** (see What's broken).
This is the largest thing in the session and it is not a bug — it is the user
re-speccing between runs, which rule 11 explicitly makes room for. It means the
four runs are **not one arm**.

## What works
- **The batch itself** — four clean exits, 246 POSTs, **0 first-attempt
  failures across all four runs** (rock 0/84, paper 0/49, scissor 0/51, plus
  path/reward classes), 12/12 potions consumed at own HP ≤50%.
- **Rule 8 held on all 29 tier choices.** Perpetual was offered on **12 of 29
  (41.4%)**, avoided at no tier cost 5 times, and **cost a tier 5 times**. Took
  the top offered tier on 24 of 29. No offer was ever entirely Perpetual, so
  the fail-closed branch was never reached.
- **THREE first-ever boon pairs, all measured LATENT** — `BurningEvade` (two
  independent pairs, runs 1 and 4, both by the ORB FALLBACK), `BurnMastery`
  (BOON PRIORITY **rank 1**) and `ArmorDepletedVulnerable` (BOON PRIORITY 5).
  Verified by whole-pair diff: the only change is the append to `pickedBoons`.
- **`BurnMastery` closed the oldest gap this table has ever closed** — on
  `UNMODELLED_TYPES` since **session 11**, longer than session 82's TieWeak. It
  was taken at 17 Hard Core over a `Legendary` `AddBlock` at 24, which is the
  priority layer correctly declining the richer payout.
- **The corrode DECREASE and its RESTORE captured in one trace** (run 2):
  45/20 → AddMaxHealth(+8) → 53/20 → corrode **−3** → 53/17 → AddMaxArmor(+2)
  → 53/19 → the 3 returns at the next path choice → 53/22. Session 90 predicted
  the decrease would land on the documented corrode amount; it does.
- **`Regen`'s decay rule corroborated cleanly** — run 4 alone shows 22
  occurrences at amounts 8,7,6,5,4,3,2,1,0, each exactly twice.

## What's broken
- ⚠ **GEAR CHANGED TWICE, mid-batch, and the four runs are NOT one arm.**
  40/22 (through 2026-08-26) → **45/20 before run 1** (also Sword DEF 8→9,
  Shield DEF 15→16) → **50/17 between runs 3 and 4**. Both steps trade ARMOR
  for HEALTH. `src/sim/enemies.ts`'s `PLAYER` is updated to 50/17, the newest
  unbooned capture. **Nothing may read depth or Hard Core across runs 1-3 vs
  run 4, or across either group vs 2026-08-26's runs, as a strategy effect.**
  The session-75 trap, twice in one day. Cause not asserted: the account
  carried **11,111 unspent skill XP at level 15** all session
  (`entryWarnings.unspentSkillXp`), but hpMax +5 with armorMax −3 is not the
  shape a pure level-up makes, and the capture cannot separate gear from level.
- ⚠ **`SecondWind` and `Steadfast` got ZERO occurrences across all four runs.**
  The brief named both as thin and hoped ordinary volume would grow them. It
  did not: §58's SecondWind n=10 and §59's Steadfast n=23 are **unmoved**. Four
  juiced runs reaching rooms 9/9/8/7 is not a small sample of play, so this is
  evidence these two are rarer than the remaining-questions list implies —
  **volume alone is not going to settle them.**
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED**; `CORPUS_DECK` still Shroom; `triggeredBoons` still never populates;
  the rod still reads 18 so the next fishing batch is capped at 18 casts (user
  decision, session 102 open question 1, unanswered).

## Corrections to SPEC.md
- **None to `SPEC.md` or `SPEC-fishing.md` — neither file was touched.**
  Nothing in any live response contradicted either.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **The daily run cap is PER-DUNGEON, and `dayProgressEntities` holds rows for
  dungeons this bot does not play.** Each `dungeonDataEntities[]` carries its
  own `juicedMaxRunsPerDay`: Dungetron 5000 (ID 1) 12, **Underhaul (ID 3) 9**,
  Void Dungeon (ID 4) 9999, Forbidden Woods (ID 5) 12. On arrival the ledger
  held one row — `Dungeon#3` at 9/9, from play outside this bot — and **zero**
  rows for dungeon 5. `findRealRunsToday` already keys on `#Dungeon#${id}` so
  nothing read wrong, but a future reader seeing a non-zero
  `dayProgressEntities` must not assume it is ours.
- **Corrections to REPO CODE:** `src/sim/enemies.ts`'s `PLAYER` (loadout, see
  above); `src/sim/boons.ts` (+3 models, +29 offers); the two test files'
  corpus pins.
- **`BoonModel.evidence`'s doc comment is WRONG and was left alone.** It claims
  "Asserted by tests/boons.test.ts". Nothing in `src/`, `tests/` or `scripts/`
  reads `.evidence` — it is documentation only. Not fixed because fixing it is
  a choice between weakening the comment and writing the assertion, and that is
  a call for a session that is not mid-ratchet.

## Dead ends
- **Do not read `tenacityProc` as tracking the `AddTenacity` boon in any simple
  way.** Run 1 (no AddTenacity) 0/48; run 2 (AddTenacity as pick 5 of 8) 6/54;
  run 3 (AddTenacity as pick 6 of 7, late) **0/38**; run 4 (no AddTenacity)
  1/44. The boon plainly matters and pick-order plainly matters, and n=4 runs
  supports neither as a rule.
- **Do not attribute mid-run `armorMax` DECREASES to this session's gear
  change.** Checked before writing it up (CLAUDE.md rule 10): decreases appear
  in **11 runs since 2026-08-15**, only one of them today. They are the corrode
  mechanic, already documented in `tests/enemies.test.ts`.
- **Do not extend `boons.ts`'s orb-vs-priority running total.** It reads
  "sessions 60-82: orb 8, priority 6" and sessions 95 and 99 added four types
  between them without updating it, so it is stale by four. This session's own
  split (**orb 1 type, priority 2**) is recorded; the total is left visibly
  stale rather than guessed.
- **Do not quote this session's per-run status-effect counts from the first
  pass.** Run 1 was first counted with a bare string grep (Burn 71 / Weak 123 /
  Vulnerable 146 / Regen 8) which matches type names outside `statusEffects`.
  The consistent walk-based count is **Burn 38 / Weak 70 / Vulnerable 89 /
  Regen 0**. Conclusions unchanged; the numbers are not.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED.

## Metrics
- **Dungeon: 4 runs, all DEATHS, rooms 9 / 9 / 8 / 7.** Corpus **79 → 83
  attempts**.
  - Hard Core **8,736 / 8,976 / 7,152 / 6,096 = 30,960**. Run 2's 8,976 is the
    **best a room-9 death has ever paid** (prev 8,688).
  - Dendren Root **546 / 546 / 420 / 309 = 1,821**.
  - Energy **240 committed, 236 observed** — every run read 60 committed vs 59
    observed, identically, consistent with in-run passive regen (18/hr).
- **Proc booleans, 184 exchanges** (`0` player / `1` enemy):
  block **11 / 9**, crit **6 / 1**, evade **1 / 1**, tenacity **7 / 4**,
  intuition **1** (player only). **`intuitionProc1` has no key at all** — every
  other flag carries both sides, so a `use_move` has 9 proc fields, not 10.
- **Status effects, walk-based, all four runs:** Weak 228, Burn 195,
  Vulnerable 136, Regen 22, **SecondWind 0, Steadfast 0**.
  - **`Burn` 5 → 10 is a NEW member of the doubling family**, alongside the
    recorded 4→8 and 6→12.
- **Boons: 29 pickups, 29 tier choices.** `UNMODELLED_TYPES` **18 → 15**, a
  clean decrement — 29 offers produced no type the list did not already carry.
  `OBSERVED_OFFERS` 272 → 301. Room-1 options 219 → 231, **none of the twelve
  new ones clean**.
- **Loadout census: 9 new combos, TWO of them new starting loadouts** (45/20,
  50/17) — the first session since 75 to catch the account changing, and the
  first ever to catch it changing twice in a day.
- EV support **0/190 decisions fully modelled (100% unscorable)** across the
  four runs — EXPECTED under rule 8, not a fault.
- **Fishing: 0 casts.** Corpus unchanged at 230.
- Suite **2028 → 2057** (+29 = one case per new boon pickup).

## Open questions for Claude
1. **The gear question is the user's and it is now urgent for measurement, not
   for play.** Two re-specs in one batch means any cross-run comparison this
   corpus supports is narrower than it looks. Does the user want to hold the
   loadout steady for a batch so runs are comparable, or is re-speccing between
   runs simply how this account is played (in which case the census note should
   stop framing it as drift)?
2. **`SecondWind` and `Steadfast` did not move on four deep runs.** §58/§59
   left both open pending volume. This session is evidence volume will not
   deliver them at any rate worth waiting for. Retire them as open questions,
   or design a capture that actually targets them (which rule 8 and the
   boon-priority config both constrain)?
3. **11,111 unspent skill XP sat unallocated all session** at level 15,
   nextLevelCost 3,568 — roughly three levels. Never touched, per the standing
   "never allocate them yourself". Worth the user spending before the next
   batch.
4. **The rod is still the fishing blocker** — 18 durability at 1.00/cast caps
   the next batch at 18. Session 102's open question 1 is still unanswered.
5. Unchanged and still deferred: STATE.md session 100's open question 2 (should
   the live loop read the dungeon proc booleans in real time).

## Files changed
```
 518 files staged. 512 are new dungeon fixtures (4 runs, redacted; raw/ ignored).

  M  src/sim/boons.ts                    +3 models (BurningEvade, BurnMastery,
                                            ArmorDepletedVulnerable) + 29 offers
  M  src/sim/enemies.ts                  PLAYER loadout 40/22 -> 50/17, two
                                            documented re-spec steps
  M  tests/boons.test.ts                 UNMODELLED_TYPES 18->15; roomOne
                                            219->231; healRooms +3
  M  tests/enemies.test.ts               loadout census +9 combos, 2 of them
                                            new starting loadouts
  M  handoff/reports/dungeon-runs.md     regenerated, 83 attempts
  M  handoff/reports/fishing-casts.md    timestamp only, 0 fishing casts
```
