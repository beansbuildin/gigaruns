# STATE — session 108 — 2026-08-29 — code at commit 6302ad0c

## Status
Brief was **dungeon only: 4 Tier-1 juiced runs, chained in ONE invocation.
GATE PASS — 4 of 4 completed.**
Live spend: **4 dungeon runs, 240 energy, 12 run-units, 12 Big Heal Juice
committed (only 3 fired — see What's broken), 0 rings, 0 fishing casts.**

**This session ran under a ONE-TIME, DATED exception to CLAUDE.md rule 11's
chaining prohibition**, authorized by the user for time pressure and
re-confirmed in chat before any spend. **It does NOT carry forward** — the next
dungeon brief defaults back to `--runs=1` with a stop and a fresh go-ahead
between runs. Rule 11's other four conditions were unchanged and held on all
four runs.

Suite **2121 passed / 2121, 111 files** (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — session 100,
unchanged). `tsc --noEmit` clean, `git diff --check` clean, secret scan **0 hits
on all four patterns over the session's added lines**, including the WIDENED
`0x[a-fA-F0-9]{4,}` address pattern, `discoveredShipsClean` 8/8.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten (see `/recap` step 3). Entries marked
**[USER]** are user directives an agent may not re-open at all.

**Dropped this session** (folded into tests that would fail, per `/recap` step
3): **the fishing budget 300/25** (session 107's raise is now just the config
value, and no test or brief is at risk of proposing it as new) and **the rod**
(`CORPUS_DECK` is pinned by tests and the rod was not touched this session).

- **[USER] Chaining is a ONE-TIME, DATED exception, not a rule change.**
  Session 108 ran `--runs=4`; rule 11 still pins `--runs=1` with a stop between
  runs. DECISIONS 2026-08-29. Re-opens as: *"chain the runs like last time"* or
  *"session 108 shows approval-per-run isn't needed."* It does not.
- **The potion-chaining bug is FIXED, and the loss is counted.** `potionPolicy`
  is rebuilt per run (`runPotionPolicyFor`); 9 Big Heal Juice were burned
  before the fix. DECISIONS 2026-08-29. Re-opens as: *"potions didn't fire on
  runs 2-4"* or *"audit the consumables spend."*
- **Consumables are debited at `start_run`, not at `use_item`.** Measured,
  stock 14 -> 2. DECISIONS 2026-08-29. Re-opens as: *"do unused potions get
  refunded"* or *"when are consumables charged."*
- **`BurnMastery` amplifies the burn TICK, not the recorded amount.** 719/719
  exact without it, 0/12 with, no off-diagonal cell. **x2 vs +3 is
  UNSEPARATED** — every observation is 6-against-3. DECISIONS 2026-08-29.
  Re-opens as: *"burn has exceptions again"* or *"BurnMastery doubles burn"* —
  the latter is NOT settled.
- **The zero-stat proc control is falsified for `intuitionProc0` ONLY**, 1
  event in 1716, and **the mapping SURVIVES** on a dose-response. DECISIONS
  2026-08-29. Re-opens as: *"a proc flag fired at stat 0, the mapping is
  broken."* It is a base rate, not a broken mapping.
- **JEBAITOR, and its gap, MEASURED.** ~9% of casts do not count against
  `dayDocs`. Session 107: 22 played, 20 charged, 9.1%. Re-opens as: *"the cast
  ledgers disagree"*. **A sub-25-cast batch is NOT evidence the budget is too
  low.**
- **Rod durability is charged per cast PLAYED, not per cast CHARGED.** Two
  paired readings agree at exactly 1.00/cast. DECISIONS 2026-08-29. Re-opens
  as: *"does JEBAITOR save durability"*.
- **Tier-1 Hard Core payout.** MEASURED, not derived: `dropMultiplier` governs
  item 845 ONLY, at an exact 4:1 quantum. DECISIONS 2026-08-28. Re-opens as:
  *"measure the first live Tier-1 run"* — it is no longer a derivation.
- **The no-proc null.** Damage = attacker's `currentATK` on 1645/1645
  status-clean exchanges. DECISIONS 2026-08-28. Re-opens as: *"the null rate is
  falling"* — a MIXED-population rate is composition-bound.
- **`tenacity` / `intuition` as damage mitigation.** RULED OUT, both. §58, §62.
  Re-opens as: *"find what tenacity does."* Heal AMOUNTS are what is open.
- **Tenacity PICK-ORDER.** RETIRED — redundant given the stat by construction.
  §63. Re-opens as: *"test whether tenacity's rate depends on pick order."*
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. DECISIONS 2026-08-26.
  Re-opens as: *"settle whether triggeredBoons populates."* **No runs may be
  spent on it.**
- **`SecondWind` / `Steadfast`.** Ordinary volume WILL NOT settle these — a
  positive finding, not missing data. DECISIONS 2026-08-27.
- **Redraw.** CLOSED — structurally unreachable from a shadow at any volume.
  §49, §51. Re-opens as: *"run more redraw shadow analysis."*
- **[USER] Rule 11 entry tier is Tier-1 (`--juiced-index=1`), 0 rings.**
  `data.index` is the TIER; `entryData` is ordered 2, 1, 3. Exercised live 8/8
  now. Re-opens as: *"correct the juiced index"* — a positional 'fix' selects
  Tier 2 and spends silver rings.
- **[USER] Unspent skill XP.** CLOSED, not deferred. §61.1 says explicitly *"do
  not re-raise unspent XP as a finding in a future recap."* Re-opens as: *"report
  the accumulated unspent skill XP"* — **session 108's own brief asked for this
  and it was correctly declined.**
- **Suite invocation.** `vitest run --maxWorkers=4`. DECISIONS 2026-08-26.

## What works
- **The chained batch, 4 of 4.** One `--runs=4` invocation, exit 0, no
  fail-closed stop. **0 first-attempt failures across 172 actions.**

  | # | run id | outcome | Hard Core | Dendren Root | energy |
  |---|--------|---------|-----------|--------------|--------|
  | 1 | 25189558 | death @ room 10 | 2,664 | 687 | 60 |
  | 2 | 25189614 | death @ room 7 | 1,680 | 309 | 60 |
  | 3 | 25189640 | death @ room 4 | 828 | 84 | 60 |
  | 4 | 25189674 | death @ room 6 | 1,512 | 216 | 60 |
  | | | **4 deaths** | **6,684** | **1,296** | **240** |

- **All four `start_run` bodies byte-identical**, read off the logged request:
  `{"consumables":[131,131,131],"isJuiced":true,"index":1,"itemId":0,
  "expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}`. `index: 1` ✓
  `isJuiced: true` ✓ 3x131 ✓ **no `inputItems` key at all -> zero rings** ✓
- **The loadout is ONE arm.** Byte-identical on all four runs (rock 16/0, paper
  6/12, scissor 12/8), which the session-103 "holds steady" ruling asks to be
  confirmed rather than assumed. Chaining removed the only window a re-spec
  could have occurred in.
- **Rule 8: 23/23 TIER-CHECK OK**, zero violations. `perpetualFilteredTop=true`
  on **3 of 23 offers (13%)** — the never-a-Perpetual clause is load-bearing.
  The final-room lowest-tier rule never fired, correctly: deepest room was 10
  of 16.
- **Energy preflight, exercised live.** Priced the batch at 4 x 60 = 240, found
  pool 159 short by 81, claimed ONE 252-energy ROM from the 37-ROM bank (3,309
  claimable), measured pool delta +252, drift +0. Rule 12 exactly as documented.

## What's broken
- ⚠ **FIXED THIS SESSION, but it cost 9 items: `potionPolicy` was shared across
  a `--runs=N` batch.** Built once outside the run loop and passed by reference
  while `runOnce` mutates it (`p.remaining--`), so run 1 draining its 3 potions
  left `remaining: 0` and `shouldUsePotion` returned false for runs 2-4. Not
  free — consumables are debited at `start_run`, so **12 Big Heal Juice were
  committed and only 3 ever fired** (stock 14 -> 2; all 3 `use_item` calls in
  run 1). **Invisible for 108 sessions because rule 11 pins `--runs=1`**, giving
  every run a fresh process and therefore fresh state. Now `runPotionPolicyFor`,
  rebuilt per run, with a regression test.
- ⚠ **The ledger reads 6, not 12 — the batch straddled the 11:00 PDT reset.**
  Runs 1-2 at 17:53:29Z / 17:57:45Z (pre-reset), runs 3-4 at 18:00:26Z /
  18:02:16Z (post). This was FLAGGED before starting, not discovered after.
  Benign, and it leaves **6 run-units in today's fresh window = 2 more runs
  available**.
- ⚠ **`LossBlockUp` has a live pickup pair and no model** — deliberately.
  QUESTIONS.md §64 asks for the directive. Suite is green; the gap is explicit.
- **The JWT expires and blocks the whole session.** Currently valid to
  2026-09-04T18:48Z. No renewal path in-repo; manual copy from the browser.

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched** — nothing in the
  live responses contradicted them this session.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not "repair" the burn invariant by lowering its count onto the mixed
  population.** 384/396 looks like a decaying invariant and is not one; the 12
  are all BurnMastery and the split arm is exceptionless at a LARGER n (719).
- **Do not model `LossBlockUp` from n=1 without a directive.** The
  `LossIntuitionUp` precedent required one, and `LossEvasionUp`/`LossLuckUp`
  are still unmodelled, so there is no family to generalise from.
- **A Monitor whose grep matches only success markers is silent through a
  crash.** The first monitor this session filtered on invented event names
  (`run_started`, `run_over`) that appear nowhere in the jsonl — the real
  events are `post`, `post_response`, `action_applied`, `decision`,
  `tier_choice`, `boon_choice`. Silence looked identical to "still running".
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED.**

## Metrics
- **Live: 4 dungeon runs, 240 energy, 12 run-units, 6,684 Hard Core, 1,296
  Dendren Root, 0 rings, 0 fishing casts.**
- Rooms reached: 10, 7, 4, 6 (mean 6.75). All four ended in death.
- **0 first-attempt failures / 172 actions**, all six action classes at 0.0%.
- Potions: 12 committed, **3 fired** (all run 1) — the bug above.
- Boons taken 23; tier choices 23, all rule-8 compliant; 3 Perpetual-filtered.
- Corpus **87 -> 91 dungeon attempts**; fishing unchanged at 273 casts.
- Suite **2092 -> 2121** (+29: 4 new potion-policy tests, 1 burn-amplification
  test, 1 intuition-pin test, and 23 new per-pickup boon cases).

## Open questions for Claude
1. **`LossBlockUp` — may it be modelled as `latent` from n=1?** QUESTIONS.md
   §64 has the full evidence (whole-object diff, only `pickedBoons` differs).
   Same question, same n, same measurement as session 99's `LossIntuitionUp`,
   which the user approved. **This is the one blocking question.**
2. **BurnMastery: x2 or flat +3?** Unseparable from current data — all 12
   observations are `after: 3 -> tick: 6`. Needs a BurnMastery burn tick at any
   amount other than 3. Would arrive on its own through ordinary play; no run
   need be spent deliberately.
3. **The `nextPosition` override is LIVE and steering fishing card choice**
   with still no user sign-off — it armed itself by accumulating validation
   data. Carried UNCHANGED from sessions 105/106/107. Is it wanted?
4. **The fishing guard counter over-counts** (`runsStarted` 25 on a 22-played /
   20-charged batch). Carried from session 107, untouched — out of scope for a
   dungeon session.
5. **Is the Tier-1 arm now the baseline for everything downstream?** Session
   103's Tier-3 numbers are not comparable on any payout statistic and several
   reports still quote them. **Fourth session unactioned.**
6. **The brief asked for accumulated unspent skill XP, which §61.1 forbids
   re-raising.** Declined, per the digest. Flagging so the next brief does not
   repeat it — the digest check caught this one.

## Files changed
```
 handoff/DECISIONS.md                     |   5 +
 QUESTIONS.md                             |  41 +
 scripts/liveRun.ts                       |  49 +-
 scripts/statusEffects.ts                 |  56 +-
 src/sim/boons.ts                         | 109 +++
 tests/boons.test.ts                      |  63 +-
 tests/enemies.test.ts                    |  18 +
 tests/potions.test.ts                    |  40 +
 tests/procEvidence.test.ts               |  44 +-
 tests/statusEffects.test.ts              |  38 +-
 fixtures/dungeon-runs/run-2026-08-29-... | 354 files (new)
```
