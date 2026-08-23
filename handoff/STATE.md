# STATE — session 82 — 2026-08-22 (PT) — code at commit 6858f63d

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1594/1594** (was 1573), 95 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, `discoveredShipsClean` passes, **`preflight.ts` PASSED** with a
clean secret scan at the final commit.

- **The dungeon programme ran: FOUR authorised juiced runs, the full daily
  allowance, one human go-ahead each (rule 11).** Rule 13 after every one:
  `dayProgressEntities` **null → 3 → 6 → 9 → 12**, exactly 3 units per run.
  **Zero denials, zero discrepancies** — nothing like session 61's race.
- **The dry-run passed BEFORE any run was played**, which was the whole point:
  three mechanisms that commit a run-unit had been rewritten since the last
  live run and none had executed.
- **`EV support: 0/174` across all four runs.** Not "high" — total. And the
  line session 78 §3 wrote to print it **has never executed**, in any run ever.
- **Ship-nothing posture HOLDS.** No strategy changed. The gear diff was EMPTY,
  so all four runs are ONE arm.

## What works
- **§1 GATE 1 — the dry-run, and the three unexercised mechanisms.** Exit 0,
  `[dry-run] would POST start_run (dungeonId 5, juiced)`.
  - **Arg guard** (`d650e8e`, recorded as NEVER EXERCISED): now exercised.
    `--bogus-flag` → `✖ unrecognised argument(s)`, **exit 1, nothing sent**.
  - **`runActionTransaction` at `:1052`**: correctly **NOT entered**. The
    `dryRun` branch at `liveRun.ts:997` fires the real gate
    (`assertCanStartRun`) and returns before it. The guard has not moved.
  - **`raw()` 10s deadline**: exercised on the dungeon path's GETs only. A POST
    has still never hit it.
- **§2 GATE 2 — the telemetry, computed per run and pooled.** 4 runs, 174
  decisions, **0 supported**. Pooled reasons:

  ```
    ROLLED_STATS      174/174  100.0%    me 174, foe 159
    UNKNOWN_EFFECT    174/174  100.0%    me 174
    BOON_TAKEN        161/174   92.5%    me 161
    STATUS_EFFECT      87/174   50.0%    foe 63, me 30
    ENEMY_BUFF         87/174   50.0%    run 87  (never me/foe)
    ARMOR_REDUCTION    12/174    6.9%    foe 12  (never me)
  ```

  **The pre-death ordering is NOT the frequency ordering, and that is the
  finding CAPTURE-1 asked for.** `STATUS_EFFECT` is on **12 of 12** pre-death
  decisions while being 50.0% overall; `ENEMY_BUFF`, also 50.0%, is on **none**
  of them. `ARMOR_REDUCTION` is 6.9% overall and was on all three of run 1's.
- **§4 gear diff EMPTY, stated as a positive.** Run 1's own `start_run`: rock
  25/8, paper 10/15, scissor 12/8, HP 40/40, armor 22/22, block 10 — identical
  to `enemies.ts` PLAYER. No re-spec since session 75, so unlike that session
  all four runs are comparable.
- **The four runs.** 0/204 first-attempt failures, 0 429s, 0 guard trips, 0
  unknown enums. `auditTierChoice` **21/21 offers, 0 violations**.

  ```
    run 1  25011957  death @ room 8   8112 HC  420 DR   48 decisions
    run 2  25012461  death @ room 3   1824 HC   42 DR   26 decisions
    run 3  25012690  death @ room 7   6384 HC  309 DR   58 decisions
    run 4  25012886  death @ room 7   6336 HC  309 DR   42 decisions
  ```

- **Rule 12's ROM mechanism fired live (run 3).** Pool 39 against a planned 60
  — exactly the reading that looks like a blocker. Preflight read the bank (37
  ROMs, 2412 claimable), made ONE descending claim of 220, **measured +220,
  drift +0**, and reported cap overflow unreachable.
- **§23 `(elapsed, drift)` is 15/15**, floor 6 / ceil 9 — the n=15 the brief
  projected. New rows: 3.73→1 (floor), 1.75→0 (floor), 4.03→1 (floor),
  3.29→1 (ceil).

## What's broken
- **`run_over` (`liveRun.ts:1233`) has NEVER fired — not in these four runs,
  not in any logged run on record (13 checked).** Every real run exits via
  `run_ended_or_absent` at `:1151`, which returns *before* session 78 §3's
  `EV support: n/m` line at `:1241`. **The session's headline deliverable is
  unreachable where it was placed.** The `decision` records carry the data, so
  this recap's numbers were computed from them directly. Also never printed:
  the `run_over` branch's boon-coverage summary (`firstEverCandidates`,
  `UNMODELLED_TYPES` size). **REPORTED, NOT FIXED** — it is a live-path change
  and nothing was going to be shipped this session.
- **`boonCoverage.ts` cannot measure a live run's boon delta.** It reads
  `OBSERVED_OFFERS`, a HAND-TRANSCRIBED constant in `src/sim/boons.ts`.
  Re-running it with the four new fixture dirs removed gives **byte-identical**
  output. A zero from that script after a live capture is never evidence — the
  brief's §3 method would have produced a false negative.
- **Three potions are routinely not enough.** All 3 spent in runs 1, 2 and 3,
  at HP 17/19/8, 20/16/12 and 9/5/15 of 40, and all three runs died anyway.
  The 5/40 is the most extreme M2 case on record. `DEFAULT_POTION_THRESHOLD`
  untouched; M2 stays blocked.
- Carried, untouched: H2's proc model (CAPTURE-1); `play_cards`/redraw/
  `use_fishing_item` unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**;
  `mana -= card.manaCost` unconfirmed; shrinkage re-fit unstable.

## Corrections to SPEC.md
- **`perpetual_corrosiveShield` no longer appears ZERO times.** Run `25011957`
  offered it in room 2; it is now in `fixtures/` **4 times**, against 0 in
  every prior fixture. `perpetual_corrosiveMagic` is still at zero.
  `src/sim/enemyBuffs.ts:121` asserted both were at zero and is corrected.
  **The table is still NOT completed, and that is the result rather than an
  omission**: the twin arrived inline carrying its own `effects: [{ kind:
  onEnemyWinExchange_corrode, amount: 3, moveType: "paper" }]` and classified
  correctly with no entry — **field for field the synthetic case session 63
  wrote on a guess**. The capture that would license completing the table is
  the same capture proving the entry buys nothing.
- **`TieWeak` and `VulnerableBlock` have first-ever pickup pairs, both LATENT.**
  Neither changes any player field at pickup; the pair's only difference is the
  boon in `pickedBoons`. TieWeak came from the ORB FALLBACK, VulnerableBlock
  from BOON-PRIORITY 5 (Vulnerable family) — **orb 7→8, priority 5→6**.
  TieWeak was the most-offered unmodelled type on the whole record (11 offers
  since session 03, never once taken) and then landed TWICE in one day.
  `VulnerableBlock`'s `selectedVal1` 4 is **NOT** a flat add to rolled `block`
  (10 → 10 across the pair) — the one reading the pair rules out.
- **`LossEvasionUp` is a first-ever TYPE**, absent from all 181 prior offers.
  `OBSERVED_OFFERS` **181 → 202**; `UNMODELLED_TYPES` net −1 (two out, one in).
- **Big Heal Juice (itemId 131) heals exactly 20** — `OnHeal value 20`, 3 of 3
  on the wire. Raw material for M2, which stays blocked.
- **`DEFAULT_CAPTURE_TARGETS` loses TieWeak and VulnerableBlock, gains
  WeakeningMastery and AddLifestealSword.** Three of the original five targets
  are now modelled **without `boonCapture` ever being armed** — the shipped
  rules are clearing that list on their own, so the module's own
  "27 runs to model five boons" estimate was costing the wrong mechanism.
- **The boonCapture/priority overlap is 0 of 5, not 1 of 5.** The one shared
  type was `VulnerableBlock`, and the priority layer went and captured it.
- Unchanged: resolved IDs forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
  charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Using `boonCoverage.ts` to measure the run's coverage delta.** See above —
  it reads a hand-transcribed constant. Verified by removing the fixtures and
  re-running.
- **Reading `dayProgressEntities` for a dungeon other than 5.** A `Dungeon#3`
  row at 9 units, updated today, is the USER's own manual play (user
  confirmed). Caps are per-dungeon; it never touched the Forbidden Woods 12.
- **Grepping the console log for potion HP with a `^room` anchor.** Silently
  returned nothing on run 3 and briefly read as "no potions used" — the
  potions were used. Read `use_item_post` from the JSONL instead.
- Standing, none re-opened: energy is never a blocker; `--dry-run` before
  claiming one; do not revert rule 8; redraw CLOSED; +19.40pp SUSPENDED;
  `boonCapture` OFF; no H2 proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD`/`chooseNewCard` UNTOUCHED; no 429 backoff without
  an observed 429; do not shuffle the random-sample deck.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.
- **`preflight.ts` (~90s) runs BEFORE the push**, not via CI after it. Run it
  AFTER committing new fixtures — it exports TRACKED files only, so an
  uncommitted corpus is invisible to it (1573 before the commit, 1594 after).

## Metrics
- **Live: 4 juiced dungeon runs, all authorised, 12/12 run-units spent, 240
  energy.** 22,656 Hard Core, 1,080 Dendren Root. Deaths at rooms 8, 3, 7, 7.
  0/204 first-attempt failures. **0 fishing casts** — 20/20 already spent, and
  the 11:00 PT rollover was 12.8h out.
- Suite **1573 → 1594** (+21, all corpus-generated), 95 files, 0 vacuous.
  **The 1573 baseline was a FRESH CLONE with 13 author-data skips**; locally
  all tests run. Don't compare the two counts without that (rule 10).
- Corpus: 63 → **67 dungeon attempts** (24 juiced), `OBSERVED_OFFERS` 181 →
  **202**, `BOON_MODELS` 29 → **31**, distinct player loadouts +1 (`48/22`,
  mid-run, not a starting loadout).
- Boon coverage running total (sessions 60–82): **orb 8, priority 6.**
- Per-run orbFallback: 5/7, 2/2, 5/6, 5/6 — **17 of 21 rewards**, `narrowed`
  true on all of run 1's; the ranker was overridden on 9.
- Perpetual filter: fired on **5 of 21** tier offers; `perpetualCostATier` on
  **5** (run 4 room 2 dropped to tier **0** because every tier-2 was perpetual).

## Open questions for Claude
1. **`run_over` has never fired and the EV-support line lives inside it.** Is
   the fix to move the reporting to the `run_ended_or_absent` path, to make
   both paths converge, or to treat the `:1233` branch as dead? This is a
   live-path edit on the function that ends a run, so it wants a gate, and I
   did not invent one.
2. **The pre-death ordering (STATUS_EFFECT 12/12 at 50% base rate) is n=4
   runs.** Is that enough to reorder CAPTURE-1, or is the honest move to state
   it as a hypothesis and set a run count that would settle it? Note the
   frequency ordering and the death ordering disagree, so picking the wrong one
   is not neutral.
3. **Three Big Heal Juices did not save three of four runs**, and the heal is
   now known to be exactly 20 against a 40 HP pool. M2 is blocked behind H2 —
   is that still right, given the potion data is now the thing there is most of?
4. **The crit rule still has two members** and needs one base-6/8/10 crit;
   card 10 (crit 10) is in the deck. **Zero casts were possible this session**
   — the cap was spent before it began. First fishing after 11:00 PT gets it.
5. **12 run-units are spent and the next allowance is a fresh 12 at 11:00 PT.**
   Worth noting the four runs cost 240 energy against ~1368/day generated —
   energy was never close to binding, as rule 12 says.

## Files changed
```
 1 commit (6858f63d) + this recap.

  M  src/sim/boons.ts             +154  TieWeak + VulnerableBlock models,
                                        OBSERVED_OFFERS 181 -> 202
  M  src/sim/enemyBuffs.ts         +21  the corrode-twin claim, corrected
  M  src/strategy/boonCapture.ts   +20  two targets retired, two added
  M  tests/boons.test.ts           +30  UNMODELLED_TYPES, room-1 count, healRooms
  M  tests/boonCapture.test.ts     +28  example type swapped off TieWeak
  M  tests/boonPriority.test.ts    +15  overlap 1 of 5 -> 0 of 5
  M  tests/corrode.test.ts         +11  the prediction that held
  M  tests/enemies.test.ts         +12  48/22, and the EMPTY gear diff recorded
  M  tests/liveRun.test.ts         +19  capture-target fixture swapped
  A  fixtures/dungeon-runs/        4 runs (~440 redacted state docs)
  M  handoff/reports/              regenerated
```
