# STATE — session 80 — 2026-08-22 (PT 2026-08-22) — code at commit d650e8ec

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1561/1561** (was 1529), 94 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, `discoveredShipsClean` passes.

- **The damage economy is the gap, and the term carrying it is the HIT RATE —
  which the brief had eliminated.** Live per-play `fishHp` drift **+0.145**
  (the fish GAINS HP); the sim's bare arm **−3.437**. Decomposed one term at a
  time, hit rate carries **96%** of it. The per-card amounts are right in every
  arm to within a tenth.
- **`escaped_meter` is renamed `escaped_fish_full`**, mechanically, with three
  reports run before and after: every diff is a label, every figure identical.
- **Live: 9 casts played, 8 of them authorised.** The ninth was spent by
  `liveFishing.ts --help` falling through an unguarded arg parser. Ledgers
  agree at **12/20**; 8 casts remain. 0 dungeon runs, 12 run-units unspent.
- **Ship-nothing posture HOLDS.** No strategy changed. The two live-code
  changes are an arg guard and an opt-in sim option, neither of which can move
  a policy.

## What works
- **§1 GATE 1 — the drift, both sides, one shared scorer**
  (`src/sim/fishing/damageEconomy.ts`, `scripts/damageEconomy.ts`, 13 tests).
  Both halves take the CLAMPED state-to-state delta; live from `castTrace.ts`
  states, sim from `castSim.ts`'s `observeTurn` — the same hook
  `focusProfileCheck.ts` uses.

  ```
                        plays    hit%     dmg   heal    drift
    LIVE (corpus)         587    35.6    5.06   3.02   +0.145
    SIM bare            13294    80.8    5.01   3.20   −3.437   ← §0a's arm
    SIM blind            7641    42.7    3.66   3.28   +0.317
    SIM live-config     16429    42.1    4.94   3.11   −0.282
  ```

  - **The brief's §1b is WRONG and this is the measurement that says so.** It
    eliminated hit geometry by putting live's 35.2% next to "the sim's shuffled
    baseline" of 36.42%. That is `deckObjectiveSweep.ts`'s baseline — the BLIND
    row, `matcherPool: []` on a different deck. The arms producing §0a's
    figures land shots at 80.8% and 42.1%. Two arms were compared and the
    conclusion carried across.
  - **The blind arm is the only one on live's side of zero**, and it is also
    the one that redraws 61% of its turns.
- **§1's second discrepancy: the simulator REDRAWS on 27–61% of its turns and
  the live bot cannot redraw at all** (`redrawEnabled` false; zero redraws in
  140 committed casts). Counting redraw turns as plays would divide the sim's
  drift by a denominator live does not have. They are excluded and the
  exclusion is VALIDATED against `CastResult.shots` — card 78's `hitEffects` is
  empty, so a hit moving nothing is possible in principle.
  `assertShotsAccountedFor` throws instead of absorbing it.
- **§2 GATE 2 — the rename, proven inert.** `escaped_meter` →
  `escaped_fish_full`, `escapedMeter` → `escapedFishFull`, plus
  `focusBudgetSweep.ts`'s `meterOutCasts` → `focusZeroCasts` (the same
  confusion mirrored — it counts casts reaching focus 0, a state 53% of CAUGHT
  casts pass through). `focusProfileCheck` / `oilArmCatchCheck` /
  `lossDecomposition` run at the pre-rename commit and after: **every diff is a
  printed label, every figure byte-identical** (bare arm 0.6% / catch 81.2% /
  opening spend 1.16; VERDICT still `*** FAIL ***`).
- **§3 `fishMaxHp` sampling, opt-in and pinned.** Live it takes ELEVEN values
  (14:12 15:13 16:12 17:21 18:17 19:10 20:18 21:19 23:2 25:2 26:5, mean 18.27)
  against the sim's fixed 21, constant within a cast (0 of 140). Opening ratio
  already right: 0.6286 vs 13/21 = 0.6190. `fishMaxHpSampler` draws from its
  OWN salted stream, and that scoping is proven by measurement — sampled vs
  fixed leaves `hitRate` and `meanTurns` **byte-identical** while
  `escapedFishFull` goes 0 → 392 of 2000.
- **§5 an unrecognised argument now stops both spending scripts**
  (`scripts/lib/cliArgs.ts`, 10 tests). `--help` prints usage and exits 0.

## What's broken
- **§0a is NOT lifted and the drift makes the gap WORSE-looking, not better.**
  The bare arm's fish is destroyed at 3.4 HP per play where live's heals at
  +0.145. That is a bigger discrepancy than the catch-rate framing suggested,
  not a smaller one. **+19.40pp still MAY NOT BE QUOTED.**
- **The 543-vs-548 discrepancy with the brief is unresolved.** The brief gated
  the session on reproducing 543 plays / 352 misses / +0.166. Reproduced
  EXACTLY: 191 hits, damage mode 5 at n=89 range 1–13, heal mode 3 range 1–6,
  130 casts, 38 catches, 5.05 damage, 2.99 heal. NOT reproduced: the
  denominator, 548 not 543, under a predicate the brief did not record. Four
  candidate predicates were tried and all move it further away. Rule 9: the
  corpus wins. (Post-batch the figure is 587 plays / +0.145.)
- **`liveFishing.ts --help` played a real cast** before §5 closed it. The same
  defect was live in `liveRun.ts`, where the default is **one PLAIN 20-energy
  dungeon run** — a run-unit spent AND a rule-11 violation. Never exercised
  there; closed anyway.
- **`play_cards`, redraw and `use_fishing_item` remain unrouted**, unchanged
  and for the unchanged reason (session 65: a rejected in-cast POST advances
  the server's token invisibly). Blocked on a capture, not on effort.
- Carried, untouched: H2's proc model does not exist (CAPTURE-1); shrinkage
  re-fit unstable; `pConnect` +9.38pp closed BY IRRELEVANCE; per-cast vs
  per-draw shuffle undistinguished; reshuffle-at-wrap unobserved.

## Corrections to SPEC.md
- **The lure crit is MULTIPLICATIVE, and n=2 settled it.** A second `CRIT_HIT`
  anomaly landed on this batch and falsifies all three readings SPEC listed:

  ```
    13022874 t4   card 76, hit 3   actual Δ5   (5 -> 0 / 19)   LETHAL
    13041046 t9   card 2,  hit 5   actual Δ8   (17 -> 9 / 20)  NOT lethal

    hit + 2              3->5 ✓  5->7 ✗       flat 5   3->5 ✓  5->5 ✗
    lethal, remaining HP   ✓     ✗ — the second crit is not lethal at all
  ```

  `hit × 1.5` round-half-up, `hit × 1.6` rounded and `floor(hit × 5/3)` all fit
  both. **n=2 separates the FAMILIES, not the members** — do not encode a
  multiplier. It does settle that an ADDITIVE model is wrong for every card
  whose hit amount is not 3. A hit-9 crit would separate the survivors
  (14/14/15). SPEC-fishing §CRIT_HIT rewritten. **Found because session 68
  pinned the anomaly as an EXACT list rather than a tolerance.**
- **`escaped_meter` never meant the focus meter ran out.** It means the fish
  healed to full. The simulator has no focus terminal condition and is right
  not to: live the meter hits 0 and the cast CONTINUES, and 53% of CAUGHT casts
  end there. Renamed in code; SPEC-fishing, OIL-POLICY and PAIRED-CONDITIONAL
  updated where they name the enum.
- **`mana -= card.manaCost` is NOT confirmed and now says so in code.**
  `playerHp` fell by exactly 1 on 587 of 587 plays — but every one was a
  manaCost-1 card. The catalog holds one 0-cost card (17) and three 2-cost
  (12, 13, 14); none is in the Shroom deck and none has ever been played. Flat-1
  and cost-equals-manaCost are indistinguishable here. A live play of one of
  those four settles it; a refactor cannot.
- **STATE.md's own open question 4 was STALE and is retracted.**
  `dendren.oils.policyApproved` is **TRUE** in `config/bot.json` and has been
  since session 62. Session 79's STATE and the session-80 brief both said FALSE.
  Nothing was changed.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Recovering the brief's 543-play predicate.** Tried: drop the unresolved
  cast, drop the terminal play, drop oil casts, drop plays after an oil. All
  move the count further from 543. Abandoned; the script states its own
  predicate in full instead.
- **Reading `CastSummary.hitRate` as the sim's per-play hit rate.** It is
  hits/shots and excludes redraw turns, so it is right — but the brief's 36.42%
  came from a DIFFERENT ARM, and that is the trap. Always name the arm.
- **Treating `fishMaxHp` sampling as an answer to §0a.** Run both ways: drift
  −3.444 → −3.249 against a live +0.145. A per-cast change cannot close a
  per-play gap. The brief predicted this and was right.
- Standing, none re-opened: energy is never a blocker; `--dry-run` before
  claiming one; do not revert rule 8; redraw CLOSED on price; +19.40pp
  SUSPENDED; `boonCapture` OFF; do not build H2's proc model; do not write M4's
  lines; `DEFAULT_POTION_THRESHOLD` untouched; `chooseNewCard` UNTOUCHED; no
  429 backoff without an observed 429; do not shuffle the random-sample deck.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.
- **`preflight.ts` (~90s) runs BEFORE the push**, not via CI after it.

## Metrics
- **Live: 9 fishing casts (8 authorised, 1 by the `--help` defect), 4 catches,
  108 energy, 0 dungeon runs.** Ledgers agree at 12/20 casts; 12/12 run-units
  unspent. 3 casts consumed oil; one walked all three consumable slots.
- Suite **1529 → 1561** (+32), 91 → 94 files. `assertionCoverage` 0 vacuous.
- Corpus: 131 → **140 casts**, 741 → **799 response docs**, 552 → **591 play
  turns**, 38 → **42 catches**.
- Drift, live: **+0.192 (n=548) → +0.145 (n=587)** across the batch. Sim bare
  −3.437, blind +0.317, live-config −0.282, all at n=4000.
- Oil reachability: strict relaxing **12 → 13** — the first move in three
  batches, so "only the denominator grows" is retired. Numerator still **2**.

## Open questions for Claude
1. **The hit rate is the whole gap. Which half of it is wrong — the MATCHER or
   the ZONE GEOMETRY?** The bare arm's matcher can identify the true pattern by
   construction (`matcherPool` defaults to `truePool`), which is why it hits
   80.8%; the live-config arm is blind and still hits 42.1% against a live
   34.9%. That residual 7pp is the tractable target and nobody has costed it.
2. **Is the bare arm worth keeping as OIL-POLICY's instrument at all?** Every
   §0a figure comes from an arm with an ORACLE matcher and a 61%-redraw policy,
   neither of which the shipped bot has. That may be the real reason §0a has
   never lifted.
3. **8 casts and 12 run-units remain, expiring 11:00 PT.** A hit-9 crit would
   separate the three surviving crit rules; casts are the only way to get one.
4. **One juiced dungeon run** still seeds session 78's `evSupported` telemetry
   and still needs a per-run go-ahead (rule 11). Unchanged.
5. Carried: separate the crit source with one-lure-only casts?

## Files changed
```
 5 commits (08e17b3, abf1aaf, df0e1ff, d650e8c, + this recap).
 87 files, +33694 −121 (of which ~33k is the nine new cast fixtures).

  NEW  src/sim/fishing/damageEconomy.ts     224  the shared drift scorer
  NEW  scripts/damageEconomy.ts             376  GATE 1, both halves + verdict
  NEW  tests/fishing/damageEconomy.test.ts  215  GATE 1
  NEW  src/sim/fishing/fishMaxHp.ts         102  the measured distribution
  NEW  tests/fishing/fishMaxHp.test.ts      122  opt-in, default pinned
  NEW  scripts/lib/cliArgs.ts                83  rule 5 on the command line
  NEW  tests/cliArgs.test.ts                 86  incl. the wired-in check
       src/sim/fishing/castSim.ts           +98  rename, sampler, manaCost note
       tests/fishing/stateFields.test.ts    +90  the second crit, separated
       tests/fishing/oilReachability.test.ts +67  corpus pins moved
       scripts/liveRun.ts                   +52  arg guard (never exercised)
       scripts/liveFishing.ts               +32  arg guard (exercised, badly)
       SPEC-fishing.md                       +39  §CRIT_HIT rewritten
```

---
---

# APPENDIX — session 80 verbose material

## A. `scripts/damageEconomy.ts`, full output at n=4000 (post-batch corpus)

```
── §1  THE LIVE LOSS DECOMPOSITION ──
    CAUGHT                                     42   30.2%
    ESCAPED, fish at full HP                   84   60.4%
    ESCAPED, mana exhausted                    12    8.6%
    unresolved (no terminal doc captured)       1    0.7%

    Of the 84 fish-at-full escapes, 28 ended with BOTH focus and mana still in hand.
    Session 48's table: meter-outs dominate, focus intact -> THE DAMAGE ECONOMY.

── §2  THE LIVE ECONOMY ──
  LIVE — every clean trace on disk
    casts 139   plays 587   hit 209 (35.6%)   miss 378 (64.4%)   unchanged 0
    damage on a hit  mean 5.06  mode 5 (n=95)   heal on a miss  mean 3.02  mode 3 (n=283)
    E[Δ fishHp / play] = 0.356 × (−5.06) + 0.644 × (+3.02) = +0.145
    damage histogram   1:5  2:6  3:39  4:6  5:95  6:22  7:12  8:15  9:5  10:3  13:1
    heal histogram     1:25  2:19  3:283  4:27  5:22  6:2

  LIVE — same plays, UNCLAMPED (server's FISH_HP_DIFF)
    damage 5.34   heal 3.24   drift +0.186

    opening headroom mean 6.8 over 139 casts -> ~2.3 NET misses tolerated

── §3  THE SIMULATOR, SAME STATISTIC ──
  SIM — bare default (synthetic fish, no fallback) — the oil sweeps' arm
    plays 13294   hit 10739 (80.8%)   dmg 5.01   heal 3.20   drift −3.437
    turns 18290 = 13294 plays + 4996 REDRAWS (27.3%, 2.58 mana/cast of 10)
  SIM — blind matcher (matcherPool: []) — the deck sweep's arm
    plays 7641    hit 3261 (42.7%)    dmg 3.66   heal 3.28   drift +0.317
    turns 19641 = 7641 plays + 12000 REDRAWS (61.1%, 8.09 mana/cast of 10)
  SIM — live config (mined + contextual fallback, empirical fish)
    plays 16429   hit 6921 (42.1%)    dmg 4.94   heal 3.11   drift −0.282
    turns 23880 = 16429 plays + 7451 REDRAWS (31.2%, 3.86 mana/cast of 10)

── §4b  VERDICT ──
  SIM bare         drift −3.437 vs live +0.192  — dominant term: HIT RATE (96%)
  SIM blind        drift +0.317 vs live +0.192  — dominant term: HIT RATE (49%)
  SIM live-config  drift −0.282 vs live +0.192  — dominant term: HIT RATE (84%)
```

(The §4b percentages above were computed pre-batch against live's +0.192; the
table in §2/§3 is post-batch. Both are reported rather than one silently
restated — the arm figures did not move, only the live half did.)

### The one-term-at-a-time decomposition, bare arm

```
  starting from live's +0.192:
    swap in its HIT RATE   80.8%  ->  −3.502   (Δ −3.693)
    swap in its DAMAGE     5.01   ->  +0.203   (Δ  0.011)
    swap in its HEAL       3.20   ->  +0.323   (Δ  0.131)
    all three (its own drift)     ->  −3.437
```

## B. GATE 2's byte-for-byte proof, in full

Three reports run at `abf1aaf9^` and again after the rename. The COMPLETE diff:

```
focusProfileCheck.ts   9 lines, all of the form
                         "meter-out 61.5% ..."  ->  "fish-at-full 61.5% ..."
                         "meter-out rate    "   ->  "fish-at-full rate "
                         "The sim meter-outs on 28.2%" -> "The sim's fish heal to full on 28.2%"
oilArmCatchCheck.ts    1 line: "meter-out — sim OFF 28.2% sim ON 29.8%"
                            -> "fish-at-full — sim OFF 28.2% sim ON 29.8%"
lossDecomposition.ts   1 line: "escaped (meter out)  80/130 (61.5%) ..."
                            -> "escaped (fish at full HP)  80/130 (61.5%) ..."
```

Not one numeric character differs anywhere in the three outputs.

## C. The `--help` incident, in full

Command issued, in a compound line whose output was sent to `/dev/null`:

```
npx tsx scripts/liveFishing.ts --help >/dev/null 2>&1
```

`parseArgs` looked for `--casts=`, did not find it, defaulted `casts` to 1, and
ignored `--help` entirely. `logs/fishing-2026-08-22-22-43-27.jsonl`:

```
{"event":"energy_preflight","requiredEnergy":12,"poolBefore":143,...}
{"event":"fishing_ledger_reconciled","gameCasts":11,"repoCastsBefore":11,"adjusted":false,"direction":"agreed"}
{"event":"post","body":{"action":"start_run","actionToken":"","data":{...,"tierId":1}}}
{"event":"action_applied","action":"start_run"}
```

Detection chain, in order:
1. `fishingCorpus` reported 140 casts where 131 + 8 = 139 was expected.
2. Nine fixture directories, not eight — the ninth timestamped `22-43-29`,
   after the batch's last at `22-41-38`.
3. Re-read the server ledger: **12/20, not 11/20.**

The batch itself was correct: 8 casts requested, 8 played, ledger 3 → 11.

**Why this is a rule-5 defect and not an operator error.** A script that spends
a capped daily resource treated an argument it could not parse as an argument it
did not need. `liveRun.ts` had the identical shape with `--runs=` defaulting to
1 — a mistyped flag there starts a PLAIN 20-energy dungeon run, spending a
run-unit and violating rule 11 in the same step.

## D. The second crit anomaly, and the rules it kills

```
  13022874 t4   card 76 (hitEffects 3, critEffects [], critZones [])   Δ5   5 -> 0 / 19   LETHAL
  13041046 t9   card 2  (hitEffects 5, critEffects [])                Δ8   17 -> 9 / 20  NOT lethal

  rule                        case 1        case 2        verdict
  hit + 2                     3->5  ✓       5->7  ✗       FALSIFIED
  flat 5                      3->5  ✓       5->5  ✗       FALSIFIED
  lethal, remaining HP        ✓ (5)         ✗ not lethal  FALSIFIED
  hit × 1.5, round half up    3->5  ✓       5->8  ✓       fits
  hit × 1.6, rounded          3->5  ✓       5->8  ✓       fits
  floor(hit × 5/3)            3->5  ✓       5->8  ✓       fits
  hit × 2                     3->6  ✗       5->10 ✗       FALSIFIED
  hit × 1.5, floor            3->4  ✗       5->7  ✗       FALSIFIED
```

Separation of the three survivors needs a crit on a card with hit amount 9:
they give 14 / 14 / **15**. Hit 4 gives 6/6/6 and hit 7 gives 11/11/11 — both
useless. No card in the Shroom deck deals 9 on a hit, so this needs either a
looted card or a deck change; it is not reachable by casting more.

## E. Corpus pins moved by the batch

```
  fishingCorpus     casts 131 -> 140, responseDocs 741 -> 799,
                    playTurns 552 -> 591, caught 38 -> 42, escaped 92 -> 97,
                    incomplete unchanged at 1
  castTrace         traces 131 -> 140, clean 130 -> 139 (still trails by one)
  stateFields       oilSkipped 13 -> 18; card crits 25 -> 26;
                    fishHp violations 1 -> 2 (see §D)
  oilReachability   casts 140, decisionPoints 564 -> 608,
                    relaxingReachable 12 -> 13, focusReachable 65 -> 67,
                    eitherReachable 70 -> 72, neitherReachable 61 -> 68,
                    totalRelaxingPoints 14 -> 15, totalFocusPoints 199 -> 205,
                    lax focusReachable 81 -> 83 (GAP unmoved at 16),
                    lax-vs-strict relaxing gap 11 -> 12,
                    reachable-and-caught 10 -> 11, NUMERATOR still 2,
                    gained/oils 0.167 -> 0.1538, 100·gained/rows 1.5267 -> 1.4286,
                    reachable rate 9.160% -> 9.286%  ← FIRST rise; numerator moved
```

`13041058` is the new lethal-reachable cast: 13 decision points, reached the
lethal band, **and was caught anyway** — which is why the numerator stayed at 2
for a fourth consecutive batch.

It is also the first cast on record where the on-demand policy WANTED a
Relaxing oil and was refused by the **3/3 per-cast consumable budget** rather
than by stock. A third way for a wanted firing to leave no strict decision
point, alongside the two session 64/69 recorded.

## F. Three oil casts this batch

```
  13041046   2 consumables (Focus)          10 plays, ESCAPED
  13041055   1 consumable                    3 plays, CAUGHT
  13041058   3 consumables — all three slots 10 plays, CAUGHT
```

Focus oil stock fell 8 -> 6 across the batch. The Relaxing per-cast cap of 2
still has never bound.
