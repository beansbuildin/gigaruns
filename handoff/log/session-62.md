# STATE — session 62 — 2026-08-20 (PT) — code at commit 1639f55

## Status
**ALL THREE GATE ITEMS PASS.** Suite **1157/1157** (1139 → 1157, +18), `tsc
--noEmit` clean, `git diff --check` clean, secret scan clean across the whole
session diff, no test writes a real data path.

- **Gate 1 PASS** — a trigger fires, stock is zero, `mayConsumeOil` refuses, the
  cast completes as ordinary play. **Demonstrated FAILING** with the exhaustion
  branch disabled (2 tests: "expected 0 to be greater than 0", "expected Set{}
  to equal Set{balance_unknown}"), then restored.
- **Gate 2 PASS** — reinstating heuristic (c) in `liveFishing.ts` fails a test.
  **Demonstrated FAILING** ("expected [start_run, …] to not include
  use_fishing_item"). Pinned on the trigger's SHAPE: the discriminating fish HP
  is derived from the two policies at test time, not written down.
- **Gate 3 PASS** — the HARD CORES field is named, and its first appearance is
  measured and PREDATES all eight runs by six days. Rule 10 does not bite.

Brief items delivered: §1 (all of it), §2b, §2c, §2a (both runs), §2d–2e, §2f,
§4. **§3 is CANCELLED, not skipped** — see below.

**Caps: 0 dungeon run-units left (12/12 spent), 15 fishing casts left.** Roll at
11:00 PT. Zero casts spent this session.

**Rule 13 held twice.** Ledger read after each run: `dayProgressEntities`
6 → 9 → 12, +3 each. No denial/interrupt occurred this session, so the rule was
exercised as routine verification rather than as a rescue.

## What works
- **§1's `on-demand` oil policy is LIVE**, replacing session 43's heuristic (c)
  after nineteen sessions. Relaxing Oil only when LETHAL, Focus Oil only at
  meter ZERO. The loop now reads and spends BOTH oils; (c) only ever considered
  the Relaxing Oil. `policyApproved` is TRUE.
- **`onDemandTriggers` is split out of `onDemand.decide`**, so a trigger firing
  against an empty bag is observable instead of silent. `decide` is defined in
  terms of it, so sim and live cannot drift.
- **The third cast state.** A cast where the policy wanted an oil and none was
  held is flagged OIL-POLICY-DRY and kept out of BOTH arms (`oilCastState.ts`,
  `classifyOilArm`). "Holds none" and "balance read failed" are recorded as
  DIFFERENT reasons — both exclude, only the first is evidence about stock.
- **The isolated-path guard did its job.** `oilCastStatePath` went into
  `LiveFishingIsolatedPaths` in the same commit as the field; it failed all 8
  call sites at compile time. That bug class has shipped four times before.
- Live: **2 juiced Tier-3 runs, 0/46 and 0/46 first-attempt failures**, 0 429s,
  0 unknown enums, 0 guard trips, tier gate **12/12** correct.

## What's broken
1. **Nothing from this session is known-broken.** That is not the same as
   "nothing is wrong" — see the honesty notes under Metrics and Dead ends.
2. **`on-demand` has never consumed an oil live.** It is shipped, gated,
   tested against mocks, and completely unexercised against the real server.
   The `slotIndex: 0` hypothesis is still confirmed only for item 821, and is
   now additionally unconfirmed for a SECOND consume in the same cast, which
   `on-demand` can want and (c) never could. It fails soft (logs, plays on).
3. **`onEnemyWinExchange_corrode` is recommended for the sim, not implemented.**
4. Carried: 25 analysis scripts hold hardcoded paths (ratcheted). The sim models
   a policy the bot does not play. `boonCapture` stays OFF. Distribution steps
   3–6 remain the user's; an agent must not create or push the repo.

## Corrections to SPEC.md
- **No live response contradicted SPEC this session.** Corrections are to the
  brief, to a prediction's form, and to one of my own comments.
- **§3's premise is void: `use_fishing_item` does NOT consume mana.**
  RESOLVED, user-stated — only playing cards spends mana. The brief called this
  "the load-bearing assumption under the entire +19.40pp" and pre-specified a
  cast to measure it. The account owner answered it directly, so the cast is
  **cancelled rather than deferred** and no oil needs spending to find out. The
  loop still records mana across every consume and shouts if it ever moves.
- **§23's predictor had the wrong FORM, and the mechanic is fine.**
  `floor(elapsed / 3.33)` assumes the regen clock resets at run start. It does
  not. Both runs drifted 1 against a prediction of 0. For a 2–3 minute run
  against a 3.33-minute tick the prediction is `Bernoulli(elapsed / 3.33)`, and
  all three observations to date fit (0 at p=0.70; 1 at p=0.86; 1 at p=0.86).
  A `floor()` over a sub-tick window can only ever say 0 — unfalsifiable in
  exactly the regime every juiced run occupies.
- **A third corrode variant: `corrosiveShield` "Miasmaguard"**,
  `onEnemyWinExchange_corrode`, amount 3, **`moveType: "paper"`**, `minTier: 2`.
- **`geometry.ts`'s `allCells` is ONE-indexed**, so `focusPoint: [0,0]` is
  off-grid. Harmless at a full meter; at `focusMeter: 0` the reachable set is
  EMPTY and `bestFocusForCard` throws "gridSize must be >= 1".
  `tests/liveFishing.test.ts`'s older mock still uses `[0,0]` and gets away with
  it only because nothing there drives the meter to zero. Any future test of a
  meter-zero state must use an on-grid focus point.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not spend runs trying to settle rule 8.** The 4-vs-4 returned
  INCONCLUSIVE, and the variance estimate says why it always would: at the
  lowest-tier arm's own sd (2254 Hard Core, 2.50 rooms), a 10% Hard Core
  difference needs **250 runs per arm** — 62 days at 4/day — and the control arm
  is frozen at n=4 permanently by user directive. The comparison is not
  underpowered, it is **unfinishable**. Rule 8 stands on the directive.
- **Do not read "inconclusive" as "neutral" here.** Both point estimates favour
  the LOWEST-TIER era (Hard Core −9.7%, depth −17.2%). Neither is near
  distinguishable (|t| 0.42, 0.91), but the direction should not be lost.
- **The brief's four result categories do not cover "both moved down"**, which
  is what happened. Recorded rather than forced into the nearest box.
- **Do not model corrode as a flat shred on any enemy win.** Read the buff's own
  `amount` and `moveType`. The `moveType` gate is now TESTED, not just declared.
- **Do not change `git config user.name` to match the LICENSE.** Commit author
  and copyright holder are separate facts; conflating them produced the wrong
  name in the first place.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`) before claiming a blocker; do not revert rule 8 or the
  wide orb rule without a user directive; never pipe a live run to a truncating
  reader; do not put identifiers in a test that guards against identifiers.
- **The recap checklist's `.gitignore` line is still stale.** It says to confirm
  `config/discovered.json` is ignored. It deliberately is NOT (2026-08-20).
  Everything else on that list holds. **Third session running.**

## Metrics
- **Live dungeon: 2 runs, both juiced Tier-3, both died room 7.**
  - 24949925 — Hard Core **6336**, Dendren 309, 60 energy, 3 potions, 0/46 fails
  - 24949982 — Hard Core **6240**, Dendren 309, 60 energy, 3 potions, 0/46 fails
  - Tier: 12/12 took the top non-Perpetual offer. Perpetual filtered the top
    choice **4 of 12** (session 61: 0 of 4; session 60: 1 of 4).
- **The 4-vs-4 (`handoff/reports/session-62-comparison.md`), pre-registered at
  commit 5092a86 BEFORE either run:**
  - Hard Core/run: historical **5712.0** → rule 8 **5160.0** (−9.7%), |t| 0.42
  - Depth: historical **7.25** → rule 8 **6.00** (−17.2%), |t| 0.91
  - Within-arm spread, historical: rooms **4–10**, Hard Core **2976–8112**
  - Entry conditions IDENTICAL across all eight (TIER_CID 3, 60 energy), and
    all eight start `hp 30/30 armor 12/12` — no level-up confound. Checked.
  - **Classification: INCONCLUSIVE.**
- **§5 boon coverage: FIVE first-ever pickup pairs in one session** — the
  largest single-session gain this table has had. WeakeningCrit, AddBurnMagic,
  SecondWind, AddVulnerableMagic, Vengeance. **Four via the orb fallback, one
  (AddVulnerableMagic) via the priority rule.** All five LATENT — measured (the
  same diff shows AddLuck/AddEvasion/Heal changing), not assumed.
  Running total sessions 60–62: **orb 6, priority 2.**
- **Live fishing: 0 casts.** Corpus unchanged at 94. Zero-streak **4** of 15.
- **§19: 7 of 32 instrumented turns.** Unchanged; accrual gated on oil casts.
- Suite 1139 → **1157** (+18).

## Open questions for Claude
1. **The oil policy is shipped but has never consumed an oil live.** The next
   fishing session's first oil cast is the whole remaining risk surface:
   `slotIndex` for items 937/942, and `slotIndex` for a SECOND consume in one
   cast. Worth one cast of deliberate attention, not a batch.
2. **Should corrode be implemented in the sim?** The recommendation is YES with
   reasoning in the report §2f. It touches the combat core, so it wants its own
   session and its own gate rather than being tacked on.
3. **Rule 8's measurement programme should be formally closed.** DECISIONS
   records it as unfinishable. Consider whether the next brief should stop
   asking for rule-8 outcome comparisons at all.
4. **Three sessions of orb-vs-priority coverage data now point 6–2.** STATE has
   said "do not let this become a coverage argument" twice. Either it becomes
   one deliberately, with a stated mechanism, or the instrumentation should stop
   being reported as if it were building toward something.
5. **`tests/liveFishing.test.ts`'s mock uses an off-grid `focusPoint: [0,0]`.**
   Harmless today, and a trap for the next person who tests a meter-zero state.
6. `boonCapture` stays OFF — still zero ordinary runs since the directive.
7. **LICENSE is RESOLVED**: `Copyright (c) 2026 Sabre`, user-stated. It is no
   longer a distribution blocker. Steps 3–6 remain the user's.

## Files changed
```
 3 commits (5092a86, 0e026c3, 1639f55). 198 new redacted fixtures.

     handoff/reports/session-62-comparison.md | 240  (new — pre-reg + report)
     src/sim/boons.ts                         | 175  (5 models + 12 offers)
     scripts/liveFishing.ts                   | 170  (on-demand replaces (c))
     tests/fishing/oilStockExhaustion.test.ts | 270  (new — gates 1 and 2)
     src/strategy/fishing/oilCastState.ts     |  90  (new — the third state)
     src/strategy/fishing/oilTiming.ts        |  60  (trigger/stock split)
     src/sim/fishingCorpus.ts                 |  35  (classifyOilArm)
     tests/boons.test.ts                      |  45  (census updates)
     tests/enemies.test.ts                    |  25  (corrode negative control)
     tests/fishing/oilPolicy.test.ts          |  30  (call site + approval)
     handoff/DECISIONS.md                     |   4  (LICENSE, oils, mana, r8)
     config/bot.json / LICENSE                |   4
```

---

# Session 62 — verbose appendix

## A correction to commit 0e026c3's own message

That message says the two runs had "0/46 and 0/47 first-attempt failures". The
real figures are **0/46 and 0/46** — both runs, verified from
`logs/run-62-2.log`'s own TOTAL line after the commit had landed. The commit
message cannot be edited without a rewrite that is not worth it; the correction
lives here and in STATE.md. Nothing downstream used the 47.

## The full 4-vs-4, all eight raw runs

| arm | # | run | depth | HARD CORES | Dendren | tier | energy | HC/energy |
|---|---|---|---|---|---|---|---|---|
| historical | H1 | 24924689 | room 8 | 6864 | 420 | 3 | 60 | 114.4 |
| historical | H2 | 24924936 | room 7 | 4896 | 309 | 3 | 60 | 81.6 |
| historical | H3 | 24925597 | room 4 | 2976 | 84 | 3 | 60 | 49.6 |
| historical | H4 | 24925642 | room 10 | 8112 | 687 | 3 | 60 | 135.2 |
| rule 8 | R1 | 24943210 | room 5 | 4224 | 141 | 3 | 60 | 70.4 |
| rule 8 | R2 | 24945829 | room 5 | 3840 | 141 | 3 | 60 | 64.0 |
| rule 8 | R3 | 24949925 | room 7 | 6336 | 309 | 3 | 60 | 105.6 |
| rule 8 | R4 | 24949982 | room 7 | 6240 | 309 | 3 | 60 | 104.0 |

Full write-up, including the §2c precondition evidence and the §2f corrode
recommendation, is in `handoff/reports/session-62-comparison.md`. It was
committed at 5092a86 with the comparison group fixed and the Results section
empty, BEFORE either run started.

### Power arithmetic, so the "unfinishable" claim is checkable

Using the historical arm's own sd as the between-run variance, n per arm at 80%
power / alpha 0.05, via the `16 (sd/delta)^2` rule of thumb:

    Hard Core, 10% effect (delta 571, sd 2254):  16 * (2254/571)^2  = 250 runs
    Depth, 1 room          (delta 1,   sd 2.50):  16 * (2.50/1)^2    = 100 runs

At rule 11's 4 juiced runs/day that is 62 and 25 days PER ARM, and the control
arm's n is frozen at 4 forever. Power depends on both arms, so running the
rule-8 arm alone does not move it.

## The §2c scan, reproducibly

    total state-*.json under fixtures/dungeon-runs (excluding raw/):  2877
    files with a non-empty gameItemBalanceChanges:                     274
    files carrying an id 845 entry:                                    136
    earliest id-845 capture:  run-2026-08-14-22-02-31/state-001.json
                              {id: 845, amount: 84}
    earliest of the eight runs: 24924689 @ run-2026-08-20-00-30-50

Six days of margin. Every one of the 12 juiced runs on record has a real 845
entry, so no run's count is an artifact of an absent field.

## The corrode trace, run 24949982 room 5

Buff: `corrosiveShield`, name "Miasmaguard", description "Reduces 3 max armor on
Shield wins", `minTier: 2`, `effects: [{kind: "onEnemyWinExchange_corrode",
amount: 3, moveType: "paper"}]`.

    state-050..055   me shield 0/17   (armor currentMax 17)
    state-056        me shield 0/14   enemy lastMove PAPER   <- -3, the trigger
    state-058        me shield 12/14  enemy lastMove rock    (I won)
    state-060        me shield 14/14  enemy lastMove scissor (I won)
    state-062        me shield 0/14   enemy lastMove SCISSOR (enemy won) <- NO shred
    state-064..067   me shield 9/14
    state-068        me shield 9/17   room boundary — restored

`state-062` is the new evidence and the reason this is worth modelling: an enemy
win with a NON-matching move that did not shred. Sessions 61 and 62 have three
corrode applications between them, but until this run there had never been a
case that could have falsified the `moveType` gate.

## The five new boon pairs, with the mechanism that produced each

| type | run | states | val1 | picked by |
|---|---|---|---|---|
| WeakeningCrit | 24949925 | 005→006 | 1 | orb fallback (20 of [20,12,13]) |
| AddBurnMagic | 24949925 | 047→048 | 3 | orb fallback (24 of [24,20,12]) |
| SecondWind | 24949982 | 005→006 | 10 | orb fallback (23 of [23,21,18]) |
| AddVulnerableMagic | 24949982 | 065→066 | 2 | BOON-PRIORITY 5, Vulnerable family |
| Vengeance | 24949982 | 087→088 | 15 | orb fallback (26 of [17,16,26]) |

All five: the ONLY difference between the before and after states is the boon
appearing in `pickedBoons`. Health, shield, all three moves and every rolled
stat byte-identical. The identical diff run against AddLuck, AddEvasion and Heal
on the same corpus DOES show their changes:

    ctrl AddLuck      lck:     {current:0} -> {current:1}
    ctrl AddEvasion   evasion: {current:0} -> {current:1}
    ctrl Heal         health:  {current:15} -> {current:31}
    NEW  WeakeningCrit / AddBurnMagic / SecondWind /
         AddVulnerableMagic / Vengeance                    (none)

So "latent" is a measured result here, not an unexamined default. `SecondWind`
at val1 10 with `health` completely unchanged is the clearest case of a name
that would have produced a wrong model.

## Gate demonstrations, verbatim

Gate 1, with `if (held <= 0)` replaced by `if (false)`:

    × plays the cast to a normal outcome, sends no use_fishing_item, and
      records the third state
      AssertionError: expected 0 to be greater than 0
    × separates 'the account holds none' from 'we never found out'
      AssertionError: expected Set{} to deeply equal Set{ 'balance_unknown' }
    Tests  2 failed | 4 passed (6)

Gate 2, with heuristic (c)'s fraction-of-max trigger spliced back in:

    × on a fish where heuristic (c) WOULD spend and lethality would not, the
      live loop spends NOTHING
      AssertionError: expected [ 'start_run', …(4) ] to not include
      'use_fishing_item'
    Tests  1 failed | 5 passed (6)

Both restored from a byte-identical backup; the full suite is green at the
final commit.

## Environment note for the next session

`npx tsx` fails under the Claude Code sandbox in this project: first
`listen EPERM` on a unix socket for tsx's IPC server, and with that worked
around, `getaddrinfo ENOTFOUND gigaverse.io` even though that host is on the
sandbox allowlist. Every live script and every `git` invocation this session ran
with the sandbox disabled. `node --import tsx/esm <script>` avoids the IPC
failure but not the DNS one, so it only helps for offline scripts.

Two vitest files ALSO fail under the sandbox for the same reason and pass
outside it — `tests/api/redact.test.ts` and `tests/profile.test.ts`, both of
which shell out to `git`. **A sandboxed test run therefore reports two false
failures.** Anyone reading a red suite should re-run unsandboxed before
believing it.

## Secret scan, session diff 787dd2f..HEAD

    0x[a-fA-F0-9]{4,} excluding 0xUSER   0 matches
    eyJ (JWT prefix)                     0
    noobId <digits>                      0
    PRIVATE                              0
    .secrets                             0
    .gitignore covers .env, *.key, data/, logs/   all IGNORED
    config/discovered.json               NOT ignored — deliberate, 2026-08-20

One thing worth recording because it looks alarming and is not: a raw numeric
`"NOOB_TOKEN_CID": <NOOB>` (a real numeric token) exists in this session's captures, inside
`fixtures/dungeon-runs/run-*/raw/`. `fixtures/**/raw/` is gitignored
(`.gitignore:28`), the tracked copies carry `"<NOOB_TOKEN>"`, and the string
that token string appears **zero** times in the tracked tree and zero times in the session
diff. Checked rather than assumed.
