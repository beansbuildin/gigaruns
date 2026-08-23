# session 82 — 2026-08-22 (PT) — the dungeon programme — GATE 1 PASS / GATE 2 PASS

Four authorised 60-energy juiced Tier-3 runs, one human go-ahead each per rule
11. `dayProgressEntities` null → 3 → 6 → 9 → 12, checked after every run.
Zero denials and zero ledger discrepancies — nothing like session 61's race.

Clock: session opened 22:11 PT, 12.8h before the 11:00 PT rollover. Fishing was
20/20 spent on arrival, so §5 was unreachable and no cast was played.

---

## §0 — the ledgers, verbatim

```
  dungeonId 5 dayProgressEntities (real runs today): null
  GAME ledger  (dayDocs pond 2):  20 / 20
  REPO ledger  (data/guard-budget-fishing.json): 20 casts, 240 energy
  ledgers agree at 20 cast(s) spent today.
```

The only `dayProgressEntities` row present at session start was `Dungeon#3` at
`UINT256_CID: 9`, updated 12:15 PT. **That is the user's own manual play on a
different dungeon** (user confirmed mid-session). Caps are per-dungeon —
Forbidden Woods' container carries `juicedMaxRunsPerDay: 12` — so it never
touched this allowance. Session 75 confirms the `Dungeon#5` row is created on
first run and steps null → 3 → 6 → 9 → 12.

## §1 GATE 1 — the dry-run

```
▸ liveRun.ts — STAGE 1 dry-run
  · --juiced: next genuinely new start_run will send isJuiced:true, index 3.
  · potions: config authorizes up to 3x itemId 131 (hard cap 3); 35 in stock -> loading 3.
  ▸ energy preflight: pool 150 covers the planned 60 — no ROM claim needed.
▸ run 1/1
  [dry-run] would POST start_run (dungeonId 5, juiced)
  · no active run — nothing further to decide against, stopping.
▸ done. energy spent (guard-tracked) 0, runs 0
EXIT=0
```

The three mechanisms that had been rewritten since the last live run:

| mechanism | commit | verdict |
|---|---|---|
| arg guard | `d650e8e` | **First-ever exercise.** `--bogus-flag` → `✖ unrecognised argument(s)`, exit 1, nothing sent. |
| `runActionTransaction` `:1052` | `a12e6b3` | **Correctly not entered.** `dryRun` branch at `:997` fires `assertCanStartRun` and returns first. |
| `raw()` 10s deadline | `0f5d61a` | Exercised on GETs only. Never yet on a POST. |

`capture.ts`'s extracted FixtureWriter created `.../raw/` and wrote nothing —
correct for a dry run.

## §2 GATE 2 — the telemetry

**Pooled, 4 runs, 174 decisions, `EV support: 0/174 (0.0%)`.**

```
-- reason frequency
   ROLLED_STATS         174/174 (100.0%)
   UNKNOWN_EFFECT       174/174 (100.0%)
   BOON_TAKEN           161/174  (92.5%)
   STATUS_EFFECT         87/174  (50.0%)
   ENEMY_BUFF            87/174  (50.0%)
   ARMOR_REDUCTION       12/174   (6.9%)

-- exact reason SETS (what actually co-occurs)
     42  24.1%   BOON_TAKEN + ENEMY_BUFF + ROLLED_STATS + STATUS_EFFECT + UNKNOWN_EFFECT
     39  22.4%   BOON_TAKEN + ENEMY_BUFF + ROLLED_STATS + UNKNOWN_EFFECT
     36  20.7%   BOON_TAKEN + ROLLED_STATS + UNKNOWN_EFFECT
     32  18.4%   BOON_TAKEN + ROLLED_STATS + STATUS_EFFECT + UNKNOWN_EFFECT
     10   5.7%   ROLLED_STATS + UNKNOWN_EFFECT
      6   3.4%   ARMOR_REDUCTION + BOON_TAKEN + ROLLED_STATS + STATUS_EFFECT + UNKNOWN_EFFECT
      4   2.3%   ARMOR_REDUCTION + BOON_TAKEN + ENEMY_BUFF + ROLLED_STATS + STATUS_EFFECT + UNKNOWN_EFFECT
      3   1.7%   ROLLED_STATS + STATUS_EFFECT + UNKNOWN_EFFECT
      2   1.1%   ARMOR_REDUCTION + BOON_TAKEN + ENEMY_BUFF + ROLLED_STATS + UNKNOWN_EFFECT

-- pairwise co-occurrence (decisions carrying BOTH)
                  ARMOR_ BOON_T ENEMY_ ROLLED STATUS UNKNOW
ARMOR_REDUCTION       12     12      6     12     10     12
BOON_TAKEN            12    161     87    161     84    161
ENEMY_BUFF             6     87     87     87     46     87
ROLLED_STATS          12    161     87    174     87    174
STATUS_EFFECT         10     84     46     87     87     87
UNKNOWN_EFFECT        12    161     87    174     87    174

-- unmodelledBySide
   me   ROLLED_STATS=174  UNKNOWN_EFFECT=174  BOON_TAKEN=161  STATUS_EFFECT=30
   foe  ROLLED_STATS=159  STATUS_EFFECT=63   ARMOR_REDUCTION=12
   run  ENEMY_BUFF=87
```

**The reasons on the last decisions before each death** — the ordering
CAPTURE-1 actually asked for:

```
  run 1  room 8   BOON_TAKEN, STATUS_EFFECT, ROLLED_STATS, ARMOR_REDUCTION, UNKNOWN_EFFECT
  run 2  room 3   BOON_TAKEN, STATUS_EFFECT, ROLLED_STATS, UNKNOWN_EFFECT
  run 3  room 7   BOON_TAKEN, STATUS_EFFECT, ROLLED_STATS, UNKNOWN_EFFECT
  run 4  room 7   BOON_TAKEN, STATUS_EFFECT, ROLLED_STATS, UNKNOWN_EFFECT
```

`STATUS_EFFECT` on **12/12** pre-death decisions against a 50.0% base rate;
`ENEMY_BUFF`, same 50.0% base rate, on **0/12**. `ARMOR_REDUCTION` 6.9%
overall but on all three of run 1's. **The frequency ranking and the death
ranking disagree**, so which one CAPTURE-1 uses is a real choice, not a
formality. n=4 runs — a hypothesis, not a result.

### The defect this exposed

`run_over` (`liveRun.ts:1233`) has **never fired**. Checked every logged run:

```
  run-2026-08-23-05-53-48   run_over=0  ended_or_absent=1
  run-2026-08-23-05-45-50   run_over=0  ended_or_absent=1
  ... (13 logs checked, every one identical)
```

On a death the server drops the run state, `getDungeonState()` returns null,
and the loop exits at `:1151` — before session 78 §3's `EV support: n/m` line
at `:1241`. The boon-coverage summary in the same branch has never printed
either. The `decision` records carry `evSupported` / `unmodelled` /
`unmodelledBySide`, so every number above was computed from the JSONL directly.

## §3 — per-run detail

```
  run 1  25011957  room 8  8112 HC  420 DR  48 dec  7 tiers  7 boons  3 potions  0/59
  run 2  25012461  room 3  1824 HC   42 DR  26 dec  2 tiers  2 boons  3 potions  0/27
  run 3  25012690  room 7  6384 HC  309 DR  58 dec  6 tiers  6 boons  3 potions  0/67
  run 4  25012886  room 7  6336 HC  309 DR  42 dec  6 tiers  6 boons  3 potions  0/51
```

**Tiers — `auditTierChoice` 21/21 offers, 0 violations.**

```
  run 1  r2 [2,2,2]→2   r3 [0,2,2]→2   r4 [1,2,0]→1*  r5 [0,2,2]→2  r6 [2,2,0]→2  r7 [0,2,2]→2  r8 [1,0,2]→1*
  run 2  r2 [0,1,1]→1   r3 [2,2,1]→2
  run 3  r2 [0,1,1]→1   r3 [0,1,2]→2   r4 [2,2,1]→2   r5 [1,0,2]→2  r6 [1,1,0]→1  r7 [2,2,2]→2
  run 4  r2 [2,2,0]→0*  r3 [2,0,1]→1*  r4 [0,2,1]→2   r5 [1,0,1]→1  r6 [2,1,1]→2  r7 [0,2,1]→1*
                                                                        * perpetualFilteredTop
```

Perpetual filter fired on 5 of 21; `perpetualAvoided` 3 (equal non-perpetual
available, tier unchanged); `perpetualCostATier` 5. **Run 4 room 2 dropped to
tier 0** — every tier-2 option was perpetual. No offer was ever entirely
Perpetual, so the fail-closed branch stayed shut.

**Potions — all 12 loaded, all 12 spent, at these HP:**

```
  run 1   17/40   19/40    8/40     died room 8
  run 2   20/40   16/40   12/40     died room 3
  run 3    9/40    5/40   15/40     died room 7
  run 4   16/40   18/48   19/48     died room 7
```

`OnHeal value 20` on the wire, 3 of 3 checked — **Big Heal Juice heals exactly
20** against a 40 HP pool. Run 4's 48s are post-`AddMaxHealth`.

**Rewards:** 21 total, 17 via `orbFallback` (`narrowed: true` on all of run
1's), 4 via priority. The ranker was overridden on 9.

**Run 3's ROM claim — rule 12's mechanism, live:**

```
  ▸ energy preflight: pool 39 short of the planned 60 (deficit 21) — reading the ROM bank.
  ▸ cap headroom: largest single ROM snapshot 220, pool headroom 381.
    no single claim can reach the cap — overflow unreachable from this path.
  ▸ ROM bank: 37 ROMs, 27 with energyCollectable > 0, 2412 energy claimable (claiming descending).
  ▸ energy preflight: pool 39 -> 259 after 1 claim(s) (measured +220).
  ▸ claim audit: 1 claim(s) descending, snapshot total 220, measured pool delta +220 (drift +0)
```

**§23 `(elapsed, drift)` — now 15/15, floor 6 / ceil 9:**

```
  run 1   3.73 min   x=1.120   drift 1   floor
  run 2   1.75 min   x=0.527   drift 0   floor
  run 3   4.03 min   x=1.210   drift 1   floor
  run 4   3.29 min   x=0.987   drift 1   ceil
```

## §4 — the gear diff, EMPTY

Run 1's own `start_run` (`current*`, not `starting*` — the `starting*` fields
are pre-gear base stats and read 16/0, 6/12, 12/8, hp 30, armorMax 12):

```
  rock 25/8   paper 10/15   scissor 12/8   hp 40/40   armor 22/22   block 10   lck 0.75
```

Byte-identical to `enemies.ts` PLAYER. **No re-spec since session 75, so unlike
that session all four runs are ONE arm and may be read against each other.**
Recorded as a stated negative in `tests/enemies.test.ts`.

## §5 — corpus findings

- **`perpetual_corrosiveShield`: first-ever appearance.** 4 fixture hits, all
  in run 1, 0 in every prior fixture. `perpetual_corrosiveMagic` still 0. It
  arrived inline with `{ kind: onEnemyWinExchange_corrode, amount: 3, moveType:
  "paper" }` — **field for field the synthetic case session 63 wrote on a
  guess** — and classified correctly with no table entry. Table NOT completed:
  the capture that licenses it is the capture proving it buys nothing.
- **`TieWeak` and `VulnerableBlock`: first-ever pickup pairs, both LATENT.**
  Verified against every prior run log. TieWeak via ORB FALLBACK (14 HC of
  [14,12,13]), VulnerableBlock via BOON-PRIORITY 5. **Orb 7→8, priority 5→6.**
  TieWeak had 11 offers since session 03 and had never been taken; it landed
  twice in one day. `VulnerableBlock`'s val1 4 is NOT a rolled-`block` add
  (10 → 10 across the pair).
- **`LossEvasionUp`: first-ever TYPE.** `OBSERVED_OFFERS` 181 → 202.
- **`boonCoverage.ts` cannot see any of this.** It reads `OBSERVED_OFFERS`, a
  hand-transcribed constant. Removing the four new fixture dirs and re-running
  gives byte-identical output. The brief's §3 method would have reported a
  false zero.

## Verification at the final commit

```
  npx tsc --noEmit                       clean
  npx vitest run                         95 files, 1594 passed (1594)
  npx tsx scripts/assertionCoverage.ts   1594 counted, 0 vacuous
  npx vitest run tests/discoveredShipsClean.test.ts   8 passed
  git diff --check                       clean
  npx tsx scripts/preflight.ts           PASSED — 1579 passed | 15 skipped (1594)
                                         in a stranger's tree, secret scan clean
```

The 1573 baseline in the brief was a FRESH CLONE with 13 author-data skips
(`logsProbe`, `romsProbe`, `emptyDirProbe`). Locally all tests run. 1573 → 1594
is +21 corpus-generated tests; do not read the two counts as like-for-like.

**Preflight must run AFTER committing new fixtures** — it exports TRACKED files
only, so it reported 1573 before the commit and 1594 after.

## Dead ends

- **`boonCoverage.ts` for a live coverage delta.** Verified inert by removing
  the fixtures.
- **`prev.focusMeter`-style trust in a console grep.** `grep -B1 "using
  potion" | grep "^room"` silently returned nothing for run 3 and briefly read
  as "no potions used"; the potions were used. Read `use_item_post` from the
  JSONL.
- **Treating `Dungeon#3` at 9 units as our spend.** It is the user's manual
  play on another dungeon; caps are per-dungeon.
