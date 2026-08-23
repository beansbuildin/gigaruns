# STATE — session 85 — 2026-08-23 (PT) — code at commit 86596d5d

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1656/1656** (was 1652), 98 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, **`preflight.ts` PASSED** — 302 tracked files exported, 1641 passed
/ 15 author-data skips in the stranger's tree, secret scan clean —
`discoveredShipsClean` 8/8.

- **Offline session, and offline BY DIRECTIVE this time, not by exhaustion.**
  Server ledgers at 10:17 PT: dungeon `UINT256_CID` **12/12**,
  `dayDocs[pondId 2]` **20/20**, both spent before the session began, 0.78h to
  the 11:00 PT rollover. Asked what to do with the refresh, **the user chose to
  end the session offline**. **Zero live spend.** Nothing was denied or
  interrupted, so no rule-13 discrepancy to reconcile.
- **GATE 1: the bot stopped OVERSHOOTING and the target never moved.** Session
  84's 1.553 → 0.852 first-play spend is overshoot disappearing, not fish
  getting easier to reach.
- **GATE 2: the shipped focus-reserve weight moves the sim's gates in OPPOSITE
  directions** — 98% toward live on one, away on two. Neither outcome the brief
  predicted. **No default changed.**
- **QUESTIONS §26 ANSWERED by the user**: shadow evaluation approved **(c) —
  but gated behind revisiting the closed redraw verdict.** That revisit is now
  the next fishing task.
- **Ship-nothing posture HOLDS.** `redrawEnabled` still false,
  `REDRAW_THRESHOLD` untouched, redraw still CLOSED.

## What works
- **§1 / GATE 1 — the overspend control** (`src/sim/fishing/castEra.ts`,
  `openingOverspendSplit`). For each cast's opening play, the CHEAPEST move
  distance from the opening focus at which some card in the HELD hand covers
  the cell the fish actually resolved on:

  ```
             casts  hand fp   actual  optimal  OVERSPEND
    before      94     7.38    1.553    0.656      +0.90
    today       54     7.20    0.852    0.648      +0.20
  ```

  **The optimal move did not move**, and neither did its distribution (0 on
  44%/48%, 1 on 46%/39%, 2 on 10%/13%). Three doors shut at once: targets no
  closer, hands no wider, opening focus pinned. `meanActual` reproduces
  `focusEraSplit`'s `meanFirstPlaySpend` to 10 places by sharing its first-play
  predicate.

  ⚠ **ORACLE-LENSED** — `optimal` uses the resolution cell. A control applied
  identically to both eras; the COMPARISON is sound, neither arm's LEVEL is a
  policy target. Same posture as `matcherHeadroom.ts`'s oracle rows.

  ⚠ **It does not name the cause.** Rule 6.
- **Every §1 figure reproduced on the FIRST run, with no predicate search** —
  worth recording only because the play counts have failed three briefs
  running. The contrast is the evidence that this is the brief's measurement
  and not a near-miss reconstruction of it.
- **§1a — the daily series STEPS, it does not trend:**

  ```
    08-15 +1.00 (n=5)   08-19 +0.84 (n=38)   08-22 +0.25 (n=16)
    08-16 +0.80 (n=5)   08-20 -0.40 (n=5)    08-23 +0.50 (n=8)
    08-17 +1.15 (n=40)  08-21 +0.10 (n=30)
    08-18 n=1, UNSCORED
  ```

  Inside today's era it drifts back **UP** (+0.10 → +0.25 → +0.50), which a
  still-sharpening learned model would not do. Argues for a DISCRETE change.
- **§2 / GATE 2 — the sim has never run the shipped weight, and it matters.**
  `DEFAULT_FOCUS_RESERVE_WEIGHT = 3` is passed by `liveFishing.ts` and
  `offPolicyReplay.ts`; `makeMatcherFishPolicy`'s third parameter defaults to
  0, so no `castSim` arm has run it since session 45.

  ```
    focusProfileCheck, OPENING SPEND (its verdict statistic) — TOWARD live:
      sim w=0  1.27   miss past interval top  0.207
      sim w=3  1.07   miss past interval top  0.004      <- 98% of the miss
      corpus today's era  0.85  95% CI [0.64, 1.06]  n=54

    focusProfileCheck, PER-TURN PROFILE — AWAY:
      turn         1     2     3     4     5     6     7     8
      Δ w=0     +0.03 -0.04 -0.07 -0.17 -0.11 -0.11 -0.24 -0.37
      Δ w=3     +0.24 +0.30 +0.24 +0.09 +0.07 +0.01 -0.16 -0.33

    damageEconomy, THE MARGIN (its own gate) — AWAY:
      live-config  hit% 42.6 -> 44.7   margin +4.0 -> +6.1pp   (live -0.7pp)
      so its distance from live widens 4.7pp -> 6.8pp
  ```

  **FAIL at both weights, by four thousandths at w=3.** The term is far from
  inert and "set w=3 in the sim" is NOT an unambiguous improvement — which is
  why the brief's own "do not change the default" is right, and now has
  evidence rather than caution behind it. `--focus-reserve-weight=N` runs
  either way; **0 stays the default in both scripts.**
- **`focusProfileCheck`'s §4 verdict now also reports the PORTABLE boundary.**
  Its gate interval was built on `todaysEraCastIds()`, the `matcherWeight`
  predicate session 84 rejected. On `castEra.ts`'s date boundary the same era
  reads 0.85 [0.64, 1.06] n=54 against 0.83 [0.63, 1.03] n=59. **FAIL on both,
  at both weights**; only the margin differs. Reported alongside, not instead
  of — the matcher-weight row is fourteen sessions of published number.

## What's broken
- **The pacing term's cause is STILL unidentified, and §1a made dating it
  harder rather than easier.** The five 08-20 casts already read the NEW regime
  (−0.40) and are stamped **before** sessions 61/62's commits (11:27 PT against
  13:33 and 15:59 PT). At n=5 that is not evidence, but **the corpus cannot
  date the change closer than "between 08-19 and 08-21"** — so the 20.3h empty
  gap is NOT the clean bracket session 84 took it for.
- **The catch rate 15.1% → 63.0% across the same boundary is still
  unattributed.** Untouched this session.
- **`SIM blind` is byte-identical at w=0 and w=3** (42.7% hit, +0.317 drift,
  −4.6pp margin, to every printed digit). Noticed, not chased. A weight that
  moves every other arm and this one not at all is either a real structural
  fact about that arm or a wiring bug, and nobody knows which.
- **§3's thresholds remain oracle-labelled with no held-out set**, n=15 dead in
  today's arm. §26's answer makes the shadow evaluation the eventual fix, but
  it is gated (below).
- Carried, untouched: H2's proc model (CAPTURE-1); `play_cards`/redraw/
  `use_fishing_item` unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**;
  `mana -= card.manaCost` unconfirmed; three Big Heals do not save a run (M2
  blocked); the crit rule still has two members and needs a base-6/8/10 crit.

## Corrections to SPEC.md
- **None to SPEC.md this session** — no live response was taken, so nothing
  could contradict it. Every correction below is to the session-85 BRIEF, and
  all three are recorded in code and in DECISIONS.
- **`scripts/redrawCounterfactual.ts` IS NOT A SIM ARM.** The brief lists it as
  running at w=0. It calls `makeMatcherFishPolicy` **zero** times and contains
  no simulator; the `focusReserveWeight` it cites at :460 is inside a PRINTED
  PROSE PARAGRAPH. There is no arm there to run at either weight.
- **"Nobody has asked what it reads at w=3" is wrong.**
  `scripts/focusReserveAblation.ts` has swept w over
  `[0, 0.5, 1, 2, 3, 4, 6, 8, 12]` with a live-config arm since session 45.
  What had NOT been asked is what the opening-spend gate and the drift margin
  read at w=3 — which is what gate 2 answers.
- **The (2,2) claim is 147 of 147 RECORDED openings, not "147 of 148".** The
  148th trace has `hasStart` false: its turn 0 is a MID-CAST RESUME, already
  play-bearing, meter 2, hand down to one card. Its opening was never recorded
  rather than being an exception — and it is ALSO the corpus's only cast with
  no covering focus. **Two apparent anomalies, one cause.**
- The w=0/w=3 divergence is **deliberate and documented**, not an oversight:
  `cardChoice.ts` keeps 0 "so every pre-session-45 caller, test and sim script
  stays byte-for-byte unchanged."
- Unchanged: resolved IDs forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
  charges: PRESENT — unchanged, not re-measured. **No new fixtures this
  session.**

## Dead ends
- **Reading the 20.3h gap as a clean bracket for the era change.** §1a breaks
  it; see What's broken.
- **Running `redrawCounterfactual.ts` at two weights.** There is nothing there
  to run. Do not put it back in a gate.
- **Treating "the sim has never run w=3" as an undiscovered defect.** It is a
  documented session-45 decision with its reason attached.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD`/`chooseNewCard` UNTOUCHED; no 429 backoff without
  an observed 429; do not shuffle the random-sample deck; do not complete the
  corrode perpetual table; do not import `todaysEraCastIds()` into a committed
  test.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: ZERO. No dungeon run, no fishing cast, no on-chain anything.** Both
  server ledgers read (12/12, 20/20), both spent before the session began, and
  the refresh was declined by the user.
- Suite **1652 → 1656** (+4, no new files), 98 files, 0 vacuous. Stranger's
  tree: 1641 passed / **15** author-data skips, 302 files exported.
- Corpus UNCHANGED: 148 cast traces, 612 plays, 147 resolved casts. Nothing
  captured, nothing appended.
- New offline measurements: the opening-overspend control (94/54 casts, with
  hand-footprint and both distance distributions), its 9-row daily series, and
  the w=0/w=3 delta on two sim scripts and four arms.

## Open questions for Claude
1. **The revisit of the CLOSED redraw verdict is now a TASK, not a question** —
   the user gated §26's shadow evaluation behind it. Its content is already
   measured: redraw was closed at 43.9 mana against 10; session 83 §1c found
   89.8% of 147 resolved casts end with mana to spare (mean 5.85, median 7);
   session 84 found the counterfactual inverts on today's era (88.2% → 97.6%,
   `neither = 0`, cost 1.33). **It is NOT a re-run of the counterfactual** —
   that is done twice and pinned. It is the argument about WHICH SCARCITY a
   redraw should be priced against, put to the user as a recommendation with
   its uncertainty stated (15/15, 95% CI [79.6%, 100.0%], n=15). **Order is the
   directive: revisit first, instrument second.**
2. **QUESTIONS §27 — session 84's off-policy replay is now WORSE-evidenced.**
   The 08-20 casts sit on the new side of the bracket, and
   `DEFAULT_FOCUS_RESERVE_WEIGHT`'s definition was touched by exactly one
   commit ever (session 45, 2026-08-18 22:11; the last call-site change is
   2026-08-19 15:20). **Gate 2 opened a narrower, cheaper question in its
   place:** at w=3 the sim lands 0.004 outside today's era's interval, so the
   question worth asking is *what makes live's EFFECTIVE focus-reserve
   behaviour differ from the sim's at the same nominal weight* — a much smaller
   search than replaying two whole policies. Recommendation: **hold the
   replay.**
3. **Is `SIM blind`'s invariance to the weight real or a wiring bug?** One
   cheap check, and it decides whether gate 2's "away" readings generalise.
4. **§25 (the depth-matched pre-death control) is recommended DROP** — 2–3 full
   days of the run cap to re-ask one retracted finding. Still parked, not
   dropped unilaterally.
5. **12 run-units and 20 casts are UNSPENT and rolled at 11:00 PT.** The
   standing captures are unchanged: one base-6/8/10 crit (card 10 is in the
   deck), an oil consumed at a NON-ZERO meter, and `finishRun`'s
   `EV support: n/m` line which has still never printed on a real run.

## Files changed
```
 5 commits (7060031e, 2e6f7712, 6f1f52a0, cd5e194c, 86596d5d) + this recap.

  M  src/sim/fishing/castEra.ts       +253  §6 the overspend control, the daily
                                            series, the (2,2) pin, the dating
                                            caveat
  M  tests/fishing/castEra.test.ts    +115  4 tests, GATE 1
  M  scripts/redrawCounterfactual.ts   +64  §7b the overspend report
  M  scripts/focusProfileCheck.ts      +59  --focus-reserve-weight, the
                                            portable-boundary verdict line
  M  scripts/damageEconomy.ts          +12  --focus-reserve-weight
  M  QUESTIONS.md                      +91  §27, §25 update, §26 ANSWERED
  M  handoff/DECISIONS.md               +6
  A  handoff/scratch-session-85.md    +100  surprises as they landed
```

---

# APPENDIX — session 85 verbose material

## A. The full §7b report, as `redrawCounterfactual.ts` prints it

```
── §7b  THE OVERSPEND CONTROL — did the bot aim cheaper, or did the fish get closer? ──
              casts   hand fp   actual  optimal  OVERSPEND
  before         94      7.38    1.553    0.656      +0.90
  today          54      7.20    0.852    0.648      +0.20
  all           148      7.32    1.297    0.653      +0.64

  optimal move distance   before  0:41 (44%)  1:43 (46%)  2:9 (10%)
                          today   0:26 (48%)  1:21 (39%)  2:7 (13%)
  actual  move distance   before  0:12 (13%)  1:35 (37%)  2:30 (32%)  3:17 (18%)
                          today   0:21 (39%)  1:20 (37%)  2:13 (24%)

  §1a  THE DAILY SERIES — it STEPS, it does not trend
    2026-08-15  n=  5  actual 1.40  optimal 0.40  overspend  +1.00
    2026-08-16  n=  5  actual 1.40  optimal 0.60  overspend  +0.80
    2026-08-17  n= 40  actual 1.82  optimal 0.68  overspend  +1.15
    2026-08-18  n=  1  actual 0.00  optimal  —    overspend      —   (the one resumed cast)
    2026-08-19  n= 38  actual 1.47  optimal 0.63  overspend  +0.84
    2026-08-20  n=  5  actual 0.60  optimal 1.00  overspend  -0.40
    2026-08-21  n= 30  actual 0.87  optimal 0.77  overspend  +0.10
    2026-08-22  n= 16  actual 0.75  optimal 0.50  overspend  +0.25
    2026-08-23  n=  8  actual 1.00  optimal 0.50  overspend  +0.50
```

**The tell in the ACTUAL distributions**, which the means hide: 17 of 94
before-era casts spent the WHOLE 3-point meter on move one. Today's era has no
such cast at all — `actualHistogram.get(3)` is 0, pinned as a test.

## B. The one anomalous trace, in full

```
  docId 12975152   hasStart=false  continuous=true  turns=4
  createdAt 2026-08-18T22:59:56.627Z
    idx=0 focus=(3,2) meter=2 fish=(4,3) hand=[4]     play=y
    idx=1 focus=(3,2) meter=2 fish=(3,4) hand=[5,2,7] play=y
    idx=2 focus=(2,3) meter=0 fish=(2,3) hand=[5,2]   play=y
    idx=3 focus=(2,3) meter=0 fish=(3,4) hand=[5]     play=y
```

Turn 0 already bears a `play`, the meter is already down to 2, and the hand is
a single card. It is a **mid-cast resume**, not an opening. That one fact
explains BOTH of its apparent anomalies — the non-(2,2) opening focus and the
absence of any covering focus (a one-card hand cannot cover (4,3)) — and it is
why the honest form of the pin is **147 of 147 recorded openings**.

## C. GATE 2 — the four runs, in full

Command form (added this session; **defaults unchanged**):

```
npx tsx scripts/focusProfileCheck.ts --focus-reserve-weight=0   # and =3
npx tsx scripts/damageEconomy.ts     --focus-reserve-weight=0   # and =3
```

### focusProfileCheck §4 verdict, w=0

```
  corpus, TODAY's era   0.83  95% CI [0.63, 1.03]  n=59   <- the gate
  corpus, TODAY's era   0.85  95% CI [0.64, 1.06]  n=54   <- castEra.ts date boundary
                        sim 1.27 is OUTSIDE that one too (0.207 past its top, against 0.235).
  corpus, POOLED        1.31  95% CI [1.15, 1.46]  n=147
  sim    opening spend  1.27  95% CI [1.24, 1.30]  n=4000
  *** FAIL ***
```

### focusProfileCheck §4 verdict, w=3

```
  corpus, TODAY's era   0.83  95% CI [0.63, 1.03]  n=59   <- the gate
  corpus, TODAY's era   0.85  95% CI [0.64, 1.06]  n=54   <- castEra.ts date boundary
                        sim 1.07 is OUTSIDE that one too (0.004 past its top, against 0.033).
  corpus, POOLED        1.31  95% CI [1.15, 1.46]  n=147
  sim    opening spend  1.07  95% CI [1.04, 1.09]  n=4000
  *** FAIL ***
```

### The sim arms, both weights

```
  SIM — live config (mined + contextual fallback, empirical fish)
    w=0  focus 3.00 1.73 1.00 0.54 0.23 0.10 0.04 0.01 ...
         fish-at-full 27.1%  catch 21.0%  opening spend 1.27  turns at focus 0 54.2%
    w=3  focus 3.00 1.93 1.34 0.85 0.49 0.28 0.16 0.09 ...
         fish-at-full 26.5%  catch 26.2%  opening spend 1.07  turns at focus 0 44.2%

  SIM — bare default (synthetic fish, no fallback) — the oil sweeps' arm
    w=0  fish-at-full 0.6%  catch 81.2%  opening spend 1.16  turns at focus 0 41.7%
    w=3  fish-at-full 0.2%  catch 90.8%  opening spend 0.39  turns at focus 0 23.3%

  CORPUS — today's policy era (matcherWeight predicate, n=59)
         focus 3.00 2.17 1.52 0.97 0.90 0.69 0.45 0.88 ...
         fish-at-full 32.2%  catch 59.3%  opening spend 0.83  turns at focus 0 19.3%
```

Note the bare arm moves the MOST (opening spend 1.16 → 0.39, a third of its
w=0 value) and it is the arm OIL-POLICY §0a suspends. **§0a is not lifted and
nothing here lifts it** — the arm moving is not the arm agreeing.

### damageEconomy §4, both weights

```
                       plays     hit%     dmg    heal       h*    margin     drift
  w=0
  LIVE (corpus)          609     36.5    5.10    3.02     37.2    -0.7pp    +0.059
  SIM bare             13294     80.8    5.01    3.20     38.9   +41.9pp    -3.437
  SIM blind             7641     42.7    3.66    3.28     47.3    -4.6pp    +0.317
  SIM live-config      16377     42.6    4.94    3.11     38.7    +4.0pp    -0.319
  w=3
  LIVE (corpus)          609     36.5    5.10    3.02     37.2    -0.7pp    +0.059
  SIM bare             12988     85.1    5.00    3.17     38.8   +46.3pp    -3.783
  SIM blind             7641     42.7    3.66    3.28     47.3    -4.6pp    +0.317
  SIM live-config      17128     44.7    4.94    3.11     38.6    +6.1pp    -0.490
```

**`SIM blind` is identical to every printed digit at both weights, including
its play count (7641).** That is the one loose thread this session leaves: a
weight that moves `bare` by 4.3pp of hit rate and `live-config` by 2.1pp and
this arm by literally nothing is either a real structural fact about the blind
fallback (a uniform distribution making every focus placement EV-identical, so
the reserve term never gets a tie to break) or a wiring bug. **One cheap check
decides it, and it decides whether gate 2's two "away" readings generalise.**

## D. Verification at the final commit

```
npx tsc --noEmit                    clean
git diff --check                    clean
npx vitest run                      Test Files  98 passed (98)
                                          Tests  1656 passed (1656)
npx tsx scripts/assertionCoverage.ts 1656 counted, every one called expect()
npx vitest run tests/discoveredShipsClean.test.ts   8 passed
npx tsx scripts/preflight.ts        PASSED
    302 tracked files exported
    doctor with empty HOME: exactly one ✗, the JWT — the expected state
    stranger's tree: 1641 passed | 15 skipped (1656)
    secret scan of the exported tree: clean
```

Secret scan of the session diff (`5d538a24..HEAD` plus untracked) for
`0x[a-fA-F0-9]{4,}`, `noobId\s*\d+`, `eyJ`, `PRIVATE`: **no matches.**
`.gitignore` still covers `.env`, `*.key`, `data/`, `logs/`, `profiles/`,
`fixtures/**/raw/`, `fixtures/**/*.har`.

## E. Server ledgers, read at 10:17 PT (rule 13 posture)

```
dungeon  DayCount#<ADDR>#Dungeon#5   UINT256_CID: 12      → 12 / 12
fishing  dayDocs[pondId 1] = 0
         dayDocs[pondId 2] = 20                            → 20 / 20
         VERDICT: BLOCKED — cap spent. Next window 11:00 PT (0.78h).
```

Both spent before the session began. **Nothing was denied, blocked or
interrupted this session**, so the ledgers were read because rule 13 says read
them, not because a tool result needed checking. The user then declined the
11:00 PT refresh, so the session ends with 12 run-units and 20 casts unspent.

## F. Process notes worth keeping

- **A dismissal with its reason attached is auditable.** The brief reached §2
  only because session 84 wrote `focusReserveWeight defaults to 0` into
  `redrawCounterfactual.ts:460` instead of silently discounting it. That the
  brief then over-read the comment (it describes the SIM's default, and the
  file has no sim) does not spoil the lesson — it sharpens it. **Name the
  caller as well as the constant.**
- **Reproduction on the first run is itself evidence.** Session 84's play
  counts took six predicates and never landed; §1 landed cell for cell with
  none. When a brief's number reproduces immediately, that is weak evidence the
  brief and the corpus are measuring the same thing — and worth one line,
  because the alternative (a long predicate search that eventually "works") is
  how a near-miss reconstruction gets mistaken for a confirmation.
- **Two anomalies with one cause are commoner than two causes.** The (3,2)
  opening and the missing covering focus looked independent and were the same
  `hasStart=false` trace.
