# session 103 — 2026-08-27 (UTC fixture dates) — dungeon batch, 4 juiced Tier-3 runs — GATE PASS

Brief: `handoff/next.md`, session 103 — "up to 4 juiced runs, one at a time,
human go-ahead before each (rule 11)". Fishing explicitly out of scope.

---

## 0. The ledger check, first, before anything else

The brief made this non-negotiable and it was done first:

```
$ npx tsx scripts/checkDungeonToday.ts
dungeonId 5 dayProgressEntities (real runs today): null
[
  {
    "docId": "DayCount#<ADDR>#Dungeon#3",
    "UINT256_CID": 9,
    "ID_CID": "Dungeon#3",
    "TIMESTAMP_CID": 20691,
    "DOC_TYPE_CID": "DayCount",
    "updatedAt": "2026-08-27T00:46:51.624Z"
  }
]
```

`null` for dungeon 5 is a legitimate "genuinely zero runs today"
(`assertDungeonCapNotExhausted`'s own comment says so). So Forbidden Woods was
**0/12** and the brief's "if it reads anything other than 0/12, say so plainly"
branch did not fire.

**But the row that IS there is worth recording.** `Dungeon#3` at 9 was played
today, outside this bot. Dumping `dungeonDataEntities` showed why that does not
touch our allowance — **the cap is per-dungeon**:

| ID | NAME_CID | ENERGY_CID | maxRoom | juicedMaxRunsPerDay |
|----|----------|-----------|---------|---------------------|
| 1 | Dungetron 5000 | 40 | 16 | 12 |
| 3 | Underhaul | 40 | 16 | **9** |
| 4 | Void Dungeon | 0 | 17 | 9999 |
| 5 | Forbidden Woods | 20 | 16 | **12** |

Underhaul was at 9/9 — its own cap, fully spent. `findRealRunsToday` already
keys on `docId.endsWith("#Dungeon#" + id)`, so nothing in the code read this
wrong. The lesson is for the human reader: **a non-zero `dayProgressEntities`
is not necessarily ours.**

`entryWarnings` also carried `unspentSkillXp: [{skillId: 3, xpItemId: 333,
balance: 11111, currentLevel: 15, nextLevelCost: 3568}]`. Surfaced to the user
before run 1; never acted on (standing rule: never allocate skill points).

## 1. Dry run

`liveRun.ts --dry-run --juiced --juiced-index=3 --runs=1`, per rule 4 and the
brief's step 1. Exercised the whole path with nothing spent:

- `--juiced: next genuinely new start_run will send isJuiced:true, index 3.`
- `potions: config authorizes up to 3x itemId 131 (hard cap 3); 29 in stock -> loading 3`
- boon-priority ON; `orb rule: WIDE`
- `energy preflight: pool 63 covers the planned 60 — no ROM claim needed`
- guard reset for the new day (`data/guard-budget.json` was date-keyed
  `2026-08-25`, 240/12)

## 2. The four runs

Each was authorised individually, live, before it started. The user was asked
four separate times and said yes four times. The batch ended because the ledger
hit 12/12.

| # | run id | outcome | Hard Core | Dendren Root | POSTs | 1st-attempt failures | potions | boons | tier choices |
|---|--------|---------|-----------|--------------|-------|----------------------|---------|-------|--------------|
| 1 | 25127188 | death @ room 9 | 8,736 | 546 | 64 | 0 | 3/3 | 8 | 8 |
| 2 | 25127745 | death @ room 9 | 8,976 | 546 | 71 | 0 | 3/3 | 8 | 8 |
| 3 | 25127932 | death @ room 8 | 7,152 | 420 | 53 | 0 | 3/3 | 7 | 7 |
| 4 | 25128104 | death @ room 7 | 6,096 | 309 | 57 | 0 | 3/3 | 6 | 6 |
| | | **4 deaths** | **30,960** | **1,821** | **246** | **0** | **12/12** | **29** | **29** |

Ledger after each run, read every time: **3 → 6 → 9 → 12**. Run 2's 8,976 is
the best Hard Core a room-9 death has ever paid (previous 8,688, session 79).

Energy: every run reported `60 committed / 59 observed`, identically, four times
— consistent with the script's own stated explanation (in-run passive regen at
18/hr). Guard enforced off committed spend, per CODEXREVIEW #8.

### Rule 8 audit, all 29 choices

Read off the `tier_choice` events' own `perpetualOffered` /
`perpetualAvoided` / `perpetualCostATier` fields, not re-derived by hand:

- Perpetual offered on **12 of 29 (41.4%)** — close to rule 8's own stated 35%.
- Avoided at **no tier cost 5 times** (an alternative at the top tier existed).
- **Cost a tier 5 times.** Two in run 1 (#4 offered `[0,2,2]` with *both*
  tier-2s Perpetual — `perpetual_Cursing` and `perpetual_regenerating` — so it
  took Safe; #6 offered `[1,2,1]` with `perpetual_overgrown` at tier 2), one in
  run 3 (#5), two in run 4 (#1, #5).
- Took the top offered tier on **24 of 29**.
- **No offer was ever entirely Perpetual**, so rule 8's fail-closed branch was
  never reached.

## 3. THE BIG FINDING — gear changed twice, mid-batch

`tests/enemies.test.ts`'s newest-opening pin went red with
`expected 40 to be 50`, which is not a corpus ratchet — it is the account
changing under the sim. Tracing every run's `state-000` (all `pickedBoons: []`,
so all read the live loadout):

```
2026-08-26-03-46-50   hpMax=40 armorMax=22  rock=25/8  paper=10/15 scissor=12/8
2026-08-27-05-08-27   hpMax=45 armorMax=20  rock=25/9  paper=10/16 scissor=12/8   <-- CHANGED
2026-08-27-05-45-38   hpMax=45 armorMax=20  rock=25/9  paper=10/16 scissor=12/8
2026-08-27-05-58-10   hpMax=45 armorMax=20  rock=25/9  paper=10/16 scissor=12/8
2026-08-27-06-05-41   hpMax=50 armorMax=17  rock=25/9  paper=10/16 scissor=12/8   <-- CHANGED
```

Two steps: **40/22 → 45/20 before run 1** (plus Sword DEF 8→9, Shield DEF
15→16), and **45/20 → 50/17 between runs 3 and 4** (moves untouched). Both
trade ARMOR for HEALTH — the first time this table has recorded a re-spec moving
consistently in one direction across two steps.

`PLAYER` updated to 50/17, the newest unbooned capture, with both steps
documented in place.

⚠ **Consequence, and it is the load-bearing one: runs 1-3 and run 4 are not the
same arm, and neither group is the same arm as 2026-08-26's four runs.** Nothing
may read depth or Hard Core across those boundaries as a strategy effect. This
is the session-75 trap, twice in one day.

**Cause is NOT asserted.** The account carried 11,111 unspent skill XP at level
15 all session, so a level-up is available as an explanation — but `hpMax +5`
with `armorMax −3` is not the shape a pure level-up makes, and nothing in the
capture distinguishes gear from level. Recorded as observed fact.

## 4. Three new boon models, all LATENT

All three got their first-ever before/after pair in this batch. Verified by
diffing the whole `players[0]` object across each pair: **the only difference in
any of them is the boon's own append to `pickedBoons`** — health, shield, all
three moves and every rolled stat identical.

| type | val1 | rarity | mechanism | pairs | first sighted |
|------|------|--------|-----------|-------|---------------|
| `BurningEvade` | 8 | Rare | **ORB FALLBACK**, twice | 2 (runs 1, 4) | session 25 |
| `BurnMastery` | 1 | Rare | **BOON PRIORITY rank 1** | 1 (run 2) | **session 11** |
| `ArmorDepletedVulnerable` | 2 | Rare | **BOON PRIORITY 5** (Vulnerable family) | 1 (run 3) | session 25 |

**`BurnMastery` is the one worth naming.** It is rank 1 of the user's
boon-priority directive — the single highest-priority boon in the list — and
this was its first pickup ever, against one prior offer on the entire record.
It had been on `UNMODELLED_TYPES` since **session 11**, a longer gap than any
type ever removed from that list (session 82's TieWeak was the previous record
at 11 offers since session 03). It was taken at 17 Hard Core over a `Legendary`
`AddBlock` at 24 — the priority layer correctly declining the richer payout,
which is the load-bearing half of DECISIONS 2026-08-20.

**`BurningEvade` got two independent pairs**, from two different runs, both by
the orb fallback (run 1 room 5: 24 out of `[24, 17, 21]` over ranked
`AddTenacity`; run 4 room 2: 18 out of `[18, 15, 16]` over ranked `AddLuck`).
Most entries in this table rest on n=1 and four were modelled from n=1 by
explicit user directive, so two pairs is unusually good evidence.

Mechanism split this session: **orb 1 type, priority 2.** The file's running
total ("sessions 60-82: orb 8, priority 6") was **deliberately not extended** —
sessions 95 and 99 added four types between them without updating it, so it is
stale by four and continuing it would be a guess about what those sessions
counted. Left visibly stale, with a comment saying why.

Per DECISIONS 2026-08-15, none of the three has its effect inferred from its
name. "Burn on an evade", "mastery over Burn" and "Vulnerable once armor is
depleted" are all plausible readings and all stay readings.

## 5. The corrode decrease AND its restore, in one trace

`tests/enemies.test.ts`'s loadout census gained 9 combos. Seven are ordinary
mid-run states; two are the new starting loadouts above. One trace is worth
reading in full — run 2's:

```
state-000  hpMax=45 armorMax=20  boons=[]
state-026  hpMax=53 armorMax=20  +AddMaxHealth(8)
state-030  hpMax=53 armorMax=17  <-- -3, NO new boon (a use_move response)
state-040  hpMax=53 armorMax=19  +AddMaxArmor(2)
state-042  hpMax=53 armorMax=22  <-- +3 back, on a "Path chosen" response
```

The −3 is exactly the documented `onEnemyWinExchange_corrode` amount. Session 90
recorded two decreases and predicted they land on the corrode amount; this trace
confirms it **and** shows the restore, which is new.

**Checked before writing it up, per CLAUDE.md rule 10:** mid-run `armorMax`
decreases are not new and not caused by today's gear change — they appear in
**11 runs since 2026-08-15** (2026-08-15 ×1, 08-20 ×4, 08-22 ×1, 08-24 ×4,
08-25 ×4, 08-26 ×3, 08-27 ×1). The instrumentation did not change; the
mechanic has been there all along.

The other new combos: `50/19` (run 4 start + AddMaxArmor), `53/20` (run 1,
AddMaxHealth(+8) off 45/20), `59/20` and `59/22` (run 3, **AddMaxHealth val1
14** — the largest this table has seen — then AddMaxArmor(+2)).

## 6. Status effects and proc booleans

Proc flags live at `data.events[].use_move.data.*Proc[01]`, where the suffix is
the player index and the values are **booleans**, not 0/1. (A first grep for
`"blockProc":[01]` matched nothing and briefly looked like a capture gap; it was
the wrong pattern.)

**184 exchanges across the four runs:**

| flag | player (`0`) | enemy (`1`) |
|------|--------------|-------------|
| blockProc | 11 / 184 | 9 / 184 |
| critProc | 6 / 184 | 1 / 184 |
| evadeProc | 1 / 184 | 1 / 184 |
| tenacityProc | 7 / 184 | 4 / 184 |
| intuitionProc | 1 / 184 | **no key at all** |

**`intuitionProc1` does not exist.** Every other flag carries both sides, so a
`use_move` event has 9 proc fields, not 10.

**`tenacityProc` does not track `AddTenacity` in any simple way** and this is a
recorded dead end: run 1 (no AddTenacity) 0/48; run 2 (AddTenacity as pick 5 of
8) 6/54; run 3 (AddTenacity as pick 6 of 7, late) **0/38**; run 4 (no
AddTenacity) 1/44. Both the boon and pick-order plainly matter and n=4 runs
supports neither as a rule.

**Status effects, per run (walk-based count — matches `type` + `amount`
together, so it does not pick up type names appearing elsewhere):**

| run | Burn | Weak | Vulnerable | Regen | SecondWind | Steadfast |
|-----|------|------|------------|-------|------------|-----------|
| 1 | 38 | 70 | 89 | 0 | 0 | 0 |
| 2 | 57 | 38 | 0 | 0 | 0 | 0 |
| 3 | 54 | 50 | 39 | 0 | 0 | 0 |
| 4 | 46 | 70 | 8 | 22 | 0 | 0 |
| **total** | **195** | **228** | **136** | **22** | **0** | **0** |

⚠ **A correction against my own earlier pass.** Run 1's counts were first taken
with a bare string grep (`Burn 71 / Weak 123 / Vulnerable 146 / Regen 8`), which
matches type names outside `statusEffects` — inside `enemyBuff.effects[].
statusType`, for instance. The table above is the consistent method.
Conclusions unchanged; the numbers are not. Do not quote the first-pass figures.

**`SecondWind` and `Steadfast` fired ZERO times in four deep runs.** The brief
named both as thin (n=10 fires and n=23 respectively) and hoped ordinary volume
would grow them. It did not. Four juiced runs reaching rooms 9/9/8/7 is not a
small sample, so this is positive evidence that **volume alone will not settle
these two**.

**`Regen`'s decay rule got its cleanest single-run corroboration:** run 4 alone
shows 22 occurrences at amounts 8, 7, 6, 5, 4, 3, 2, 1, 0 — each exactly twice.

**`Burn` stacking gained a family member:** run 4 showed amounts {2, 4, 5, 10}.
**5 → 10** joins the recorded 4→8 and 6→12.

## 7. The ratchet

+4 runs turned the suite red: **8 failures across 2 files.** Four of them looked
alarming — `every modelled boon reproduces its recorded delta` — but were the
"has a pair but no model" assertion, i.e. the three new types above, not the
model disagreeing with live data.

- `tests/boons.test.ts` — 3 models added; `OBSERVED_OFFERS` **272 → 301** (29
  rows, generated from the corpus and diffed both ways: 29 in the corpus and
  absent from the table, **zero the other way**); `UNMODELLED_TYPES` **18 → 15**
  (three out, **none in** — a clean decrement, the same shape as session 99's
  and unlike 75/82 where a new type arrived alongside); `roomOne.length`
  **219 → 231** (twelve new room-1 options, **none of them clean** — eight
  rolled-stat, three latent, one still unmodelled); `healRooms` +3 (rooms 2, 7,
  4).
- `tests/enemies.test.ts` — `PLAYER` pin (the gear change, §3); loadout census
  +9 combos.

On the room-1 comment's counters: it carries two ("sixth consecutive session of
the same pattern" / "clean TYPE set unchanged for the fifth-sixth"), both of
which session 99 left un-narrated. **Neither was incremented** — the facts are
stated and the reason for not attaching an ordinal is stated with them.

## 8. Verification, against the final commit

```
vitest run --maxWorkers=4   ->  Test Files 111 passed (111)
                                Tests    2057 passed (2057)
tsc --noEmit                ->  clean
git diff --check            ->  clean
secret scan                 ->  0 hits on all four patterns
discoveredShipsClean        ->  8 passed (8)
```

2028 → 2057 is +29, exactly one new case per new boon pickup.

`.gitignore` re-verified for `.env`, `*.key`, `data/`, `logs/`, `profiles/`,
`fixtures/**/raw/`, `fixtures/**/*.har` — all present, and `git check-ignore`
confirms the new runs' `raw/` directories are actually ignored. The 512
committed fixture files carry 13,824 `0xUSER` redaction markers and zero
address, JWT, noobId or PRIVATE matches.

The dry run's fixture directory (`run-2026-08-27-05-07-11`) contains only an
empty, ignored `raw/` and is correctly not committed.

## 9. One thing left alone deliberately

`BoonModel.evidence`'s doc comment says "Asserted by tests/boons.test.ts".
Nothing in `src/`, `tests/` or `scripts/` reads `.evidence` — it is
documentation only. Not fixed here: the fix is a choice between weakening the
comment and writing the missing assertion, and that is not a call to make in
the middle of a corpus ratchet.

---

Recap commit: `0d6fa8d99dc414decbe5f6847fc2cad74520366e`
