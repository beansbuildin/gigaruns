# STATE — session 86 — 2026-08-23 (PT) — code at commit 69721b9c

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1666/1666** (was 1656), **99** files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, **`preflight.ts` PASSED** — 304 tracked files exported, 1651 passed
/ 15 author-data skips in the stranger's tree, secret scan clean —
`discoveredShipsClean` 8/8.

- **Offline again, and again BY DIRECTIVE, not by exhaustion.** `doctor.ts`
  passed at the top of the session with **12 run-units and 20 casts fresh and
  unspent**. Asked what to do with them, **the user chose to stay offline and
  recap**. **Zero live spend.** Nothing was denied or interrupted, so there is
  no rule-13 ledger discrepancy to reconcile.
- **GATE 1: the blind sim arm NEVER AIMS** — 0 focus moves in 1963 turns, all
  763 plays fired from (2,2), at both focus-reserve weights. Session 85's
  invariance is a tautology, not a wiring bug.
- **⚠ The obvious generalisation of that is FALSE, and I nearly shipped it.**
  The condition is a UNIFORM distribution, not a blind matcher.
- **GATE 2: the redraw revisit is DELIVERED** as a memo plus QUESTIONS §28.
  Recommendation: **re-price the verdict, do not reverse it.** The decision is
  the user's and is OPEN.
- **Ship-nothing posture HOLDS.** `redrawEnabled` still false,
  `REDRAW_THRESHOLD` untouched, redraw still CLOSED, **no shadow
  instrumentation written** — the order was the directive.

## What works
- **§1 / GATE 1 — the focus-movement probe** (`src/sim/fishing/focusMovement.ts`,
  `measureFocusMovement`). 400 casts an arm, `REAL_DECK`, seed base 1, no
  `data/`:

  ```
    arm                        turns  moved  spent  plays  aimed  cells used
    BLIND (matcherPool: []) w=0  1963      0      0    763      0  (2,2) ONLY
    BLIND (matcherPool: []) w=3  1963      0      0    763      0  (2,2) ONLY
    BARE  (default pool)    w=0  1823    752   1047   1328    752  15 of 16
    BARE  (default pool)    w=3  1669    713    913   1284    713  15 of 16
  ```

  **Measured two independent ways** — the meter through `observeTurn`, and the
  DECISION by wrapping the policy and comparing the chosen focus cell against
  `focusBudget.current`. They agree exactly on all four arms. The bare rows are
  the control: a zero from an instrument never shown to read non-zero is not
  evidence of anything.
- **⚠ THE CONDITION IS "UNIFORM", NOT "BLIND"** — `matcherPool: []` is
  necessary and **not sufficient**:

  ```
    matcherPool: []                     0 moves / 1963 turns
    matcherPool: [] + empiricalFish     0 moves / 1963 turns
    matcherPool: [] + ringModel       824 moves / 2492 turns
    matcherPool: [] + blindFallback   838 moves / 2443 turns
    mined + blindFallback (live cfg)  829 moves / 2346 turns
  ```

  So **`focusReserveAblation.ts`'s session-45 sweep is NOT vacuous** — its arm
  A is blind WITH a ring. The arms that never aim are `damageEconomy.ts`'s
  `SIM blind` and `deckObjectiveSweep.ts`'s baseline (**0 of 1944** turns on
  `castSim`'s own default params, so not a param artefact). The ring boundary
  is pinned PORTABLY on a synthetic step-class table — a committed test may not
  read the gitignored corpus.
- **The no-aim arm's whole decision sequence is fish-blind, as an exact
  identity**: turning `empiricalFish` on changes hits 313 → 353 of 763 and
  moves the turn, play and redraw counts by **zero**.
- **Labelled, not fixed.** `castSim.ts`'s "the condition session 14 established
  as representative of real live Dendren play" now carries the 0/1963 beside it
  (true of PATTERN IDENTIFICATION, false of focus behaviour — live spends 0.85
  of its meter on the opening play alone today). `damageEconomy.ts` prints
  **§4b DOES THE ARM AIM?** (its old §4b verdict is now §4c) and its row reads
  `SIM blind (no-aim)`. **No default, arm or baseline changed.**
- **§2 / GATE 2 — `handoff/reports/session-86-redraw-revisit.md` + QUESTIONS
  §28.** Every claim carries its instrument and that instrument's distance from
  live; the rescue rate appears only as **15/15, 95% CI [79.6%, 100.0%],
  n = 15**. Two things measured for it rather than carried over:
  - **The mana-slack argument, ERA-SPLIT** (new): pooled 132/147 (89.8%) mean
    5.85; **today 48/54 (88.9%) mean 6.26 median 7**; before 84/93 (90.3%) mean
    5.61. It holds on both eras and today's is the slacker one.
  - **How often the shipped trigger actually wants a redraw**, from the bot's
    own live logs: **today 26/204 decisions (12.7%)**, before 93/245 (38.0%),
    pooled 119/449 (26.5%) — counted on the UNION of
    `redraw_indicated_not_sent` and `redraw_suppressed`, because the newer
    event first appears at session 70 (rule 10).

## What's broken
- **QUESTIONS §28 is OPEN and blocks §26.** No shadow instrumentation may be
  written until the user answers. Redraw stays closed either way.
- **The shipped trigger's turn-level accuracy is unmeasured.** It fires at
  about the rate dead hands occur (12.7% against 11.8%) and **nothing
  establishes those are the same turns.** Cheap; not done.
- **The two unpaid correctness gaps are still unpaid**, both live-path:
  `liveFishing.ts:2471` (a redraw fires `FISH_MOVED` and the branch does not
  observe it, so the matcher's history keeps a hole — the fix is a choice
  between two UNMEASURED semantics, not a repair) and `liveFishing.ts:1526`
  (`MAX_REDRAWS_PER_CAST = 5` is a fail-closed `GuardTrip` that ABORTS the
  cast, and since a redraw does not advance `turn` it is the only bound there
  is).
- **Gate 1 opens a re-audit nobody has done.** Every figure the no-aim arm has
  produced — the deck sweep, the noise floor, its −4.6pp drift margin — was
  measured on a bot that never aims. That is not wrong for a deck comparison
  and it is not a fishery anyone plays in. **Not started; larger than one
  session.**
- **The pacing term's cause is still unidentified** and the corpus cannot date
  it closer than "between 08-19 and 08-21". Untouched this session.
- **The catch rate 15.1% → 63.0% across the same boundary is still
  unattributed.** Untouched.
- Carried, untouched: H2's proc model (CAPTURE-1); `play_cards`/redraw/
  `use_fishing_item` unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**;
  `mana -= card.manaCost` unconfirmed; three Big Heals do not save a run (M2
  blocked); the crit rule still has two members and needs a base-6/8/10 crit.

## Corrections to SPEC.md
- **None to SPEC.md this session** — no live response was taken, so nothing
  could contradict it. Both corrections below are to the session-86 BRIEF, and
  both are recorded in code and in DECISIONS.
- **The brief's "2363 turns" is a STATE count, not a turn count.**
  `observeTurn` emits one state per turn taken PLUS the terminal state, so 400
  casts give 2363 states = **1963 turns**; the same 400-offset applies to the
  bare arm's 2223/2069. **Every movement figure reproduced the brief exactly**
  (0/0, 752/1047, 713/913), which is what identifies this as the same
  measurement with a different denominator rather than a near miss. Pinned as
  the identity `states === turns + casts`.
- **"A shipped threshold that wants a redraw on ~3.5% of turns" is
  unsupported.** The measured rate is **12.7%** in today's era, from the bot's
  own logs. The nearest 3.5% in the repo is a Wilson lower bound in session
  72's log, not a fire rate.
- Unchanged: resolved IDs forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
  charges: PRESENT — unchanged, not re-measured. **No new fixtures this
  session**; the corpus is still 148 traces / 612 plays / 147 resolved.

## Dead ends
- **Writing "a blind arm never aims" into `castSim.ts`.** I did, then checked
  the brief's own not-gated question and had to take it back out. `ringModel`
  and `blindFallback` each restore aiming. **Do not restate the finding without
  the word UNIFORM in it.**
- **Reading `damageEconomy.ts`'s `SIM blind` as a live proxy on anything
  focus-related.** Its 42.7% hit rate is card zones at a fixed point with no
  aiming in it, and its margin clears zero for a reason live's does not.
- **"Re-derive 43.9 properly in sim."** There is no arm that could: bare is the
  oracle arm at +41.9pp, blind never aims, live-config is closest and still
  +4.0pp, and the two candidates fail in OPPOSITE directions.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD`/`chooseNewCard` UNTOUCHED; no 429 backoff without
  an observed 429; do not shuffle the random-sample deck; do not complete the
  corrode perpetual table; do not import `todaysEraCastIds()` into a committed
  test.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: ZERO. No dungeon run, no fishing cast, no on-chain anything.** The
  budget was fresh (12 run-units, 20 casts) and the user declined to spend it.
- Suite **1656 → 1666** (+10, +1 file), **99** files, 0 vacuous. Stranger's
  tree: 1651 passed / **15** author-data skips, 304 files exported.
- Corpus UNCHANGED: 148 cast traces, 612 plays, 147 resolved casts.
- New offline measurements: the four-arm focus-movement probe (two independent
  readings each), the five-arm uniform-vs-blind boundary, the default-param
  control, the era-split mana slack, and the shipped trigger's live fire rate.

## Open questions for Claude
1. **QUESTIONS §28 is the live one and it is the user's** — accept re-pricing
   the redraw verdict, or keep the original price as the reason, or retire the
   line of work. **§26's shadow evaluation stays blocked until it is
   answered**, and an agent must not answer it.
2. **The cheap follow-up §2 named and did not do:** does the shipped EV trigger
   fire on the SAME turns the dead hands occur on? It fires at 12.7% against a
   dead-hand rate of 11.8%, and the overlap is unmeasured. Offline, one script,
   no live spend.
3. **How much of the repo's published fishing work needs re-reading in light of
   gate 1?** The deck sweep's 36.42%, session 78's 41.06%, the noise floor, the
   −4.6pp drift margin — all measured on the no-aim arm. **This is bigger than
   one session and the pin is what makes it possible; it is not started.**
4. **§25 (the depth-matched pre-death control) is still recommended DROP** —
   2–3 full days of the run cap to re-ask one retracted finding. Parked, not
   dropped unilaterally.
5. **12 run-units and 20 casts went unspent and roll again at 11:00 PT.** The
   standing captures are unchanged: one base-6/8/10 crit (card 10 is in the
   deck), an oil consumed at a NON-ZERO meter, and `finishRun`'s
   `EV support: n/m` line, which has still never printed on a real run.

## Files changed
```
 3 commits (551415a2, 8cf569c1, 69721b9c) + this recap.

  A  src/sim/fishing/focusMovement.ts      +260  the probe, both readings
  A  tests/fishing/focusMovement.test.ts   +158  10 tests, GATE 1 + the boundary
  M  scripts/damageEconomy.ts               +65  §4b DOES THE ARM AIM?, labels,
                                                 old §4b verdict -> §4c
  M  src/sim/fishing/castSim.ts             +33  the session-14 sentence, labelled
  A  handoff/reports/…-redraw-revisit.md   +254  GATE 2, the memo
  M  QUESTIONS.md                           +98  §28, the decision
  M  handoff/DECISIONS.md                    +4
  A  handoff/scratch-session-86.md          +48  surprises as they landed
```

---

# Verbose appendix — session 86

## The §4b table as it prints

```
── §4b  DOES THE ARM AIM? — the focus meter, measured directly ──
  400 casts per row, REAL_DECK, seed base 1. `moved` = turns where the meter fell;
  `aimed` = plays whose chosen focus cell differed from the current one. Two independent readings.

  BLIND (matcherPool: [])   w=0  turns  1963  moved    0  spent     0  plays   763  aimed    0  cells used (2,2) ONLY
  BLIND (matcherPool: [])   w=3  turns  1963  moved    0  spent     0  plays   763  aimed    0  cells used (2,2) ONLY
  BARE  (default pool)      w=0  turns  1823  moved  752  spent  1047  plays  1328  aimed  752  cells used 15 of 16
  BARE  (default pool)      w=3  turns  1669  moved  713  spent   913  plays  1284  aimed  713  cells used 15 of 16
```

## The §4 comparison table it sits under, re-run today

```
                       plays     hit%     dmg    heal       h*    margin     drift
  LIVE (corpus)          609     36.5    5.10    3.02     37.2    -0.7pp    +0.059
  SIM bare             13294     80.8    5.01    3.20     38.9   +41.9pp    -3.437
  SIM blind (no-aim)    7641     42.7    3.66    3.28     47.3    -4.6pp    +0.317
  SIM live-config      16377     42.6    4.94    3.11     38.7    +4.0pp    -0.319
```

Redraw shares of turns, same run: bare **27.3%** (2.58 mana/cast), blind
**61.1%** (8.09), live-config **31.5%** (3.91). Live: **0**, structurally.

## The boundary sweep in full — why the finding is about UNIFORM, not BLIND

400 casts an arm, `REAL_DECK`. The three rows needing `data/` are measured but
NOT test-pinned (a committed test may not read the gitignored corpus); the
`ringModel` row is pinned on a synthetic table built inside the test.

```
  arm                                   w=0                     w=3
  matcherPool: []                   0 / 1963              0 / 1963
  matcherPool: [] + empiricalFish   0 / 1963              0 / 1963
  matcherPool: [] + ringModel     824 / 2492            863 / 2426
  matcherPool: [] + blindFallback 838 / 2443            855 / 2481
  mined + blindFallback (live)    829 / 2346            821 / 2339
```

At `castSim`'s OWN default params — `deckObjectiveSweep.ts`'s configuration —
`matcherPool: []` reads **0 moves in 1944 turns, 840 plays, all at (2,2)**, so
the no-aim behaviour is not an artefact of `PROBE_PARAMS`.

Recorded and not chased: at `REAL_PARAMS` the blind arm **caught 0 of 400**
casts (it redraws 61% of its turns and mana-outs). `deckObjectiveSweep` runs
different params, so its 36.42% baseline is not this number.

## The era-conditioned redraw counterfactual, re-run today

```
             n  both  sac  rescue  neither   dead  rescue rate   cost   availability
  pooled   389   261   27      45       56    101       44.6%    1.60   74.0% -> 78.7%
                                            95% CI [35.2%, 54.3%], n = 101
  before   262   152   24      30       56     86       34.9%    1.73   67.2% -> 69.5%
                                            95% CI [25.7%, 45.4%], n = 86
  today    127   109    3      15        0     15      15 / 15    1.33   88.2% -> 97.6%
                                            95% CI [79.6%, 100.0%], n = 15
```

Reproduces session 84 cell for cell. **Never write 15/15 as 100%.**

## Mana slack, era-split — new this session

```
  before  93 casts   mean 5.61  median 6   84/93 (90.3%) with mana to spare   9 mana-outs
  today   54 casts   mean 6.26  median 7   48/54 (88.9%) with mana to spare   6 mana-outs
  all    147 casts   mean 5.85  median 7  132/147 (89.8%) with mana to spare  15 mana-outs
```

`manaSlack()` over traces filtered by `eraOf(t.docId, created)`. The pooled row
is the one 40 sessions have quoted; the era rows are the check session 84's
discipline demands, and the argument holds on both.

## The shipped trigger's live fire rate — the scan

```
  today's era   26 of 204 decisions   12.7%
  before        93 of 245 decisions   38.0%
  pooled       119 of 449 decisions   26.5%
```

Method: scan `logs/fishing-*.jsonl`, one `decision` record per turn, and count
the UNION of `redraw_indicated_not_sent` (107, pre-session-70, reason "redraw
action unconfirmed") and `redraw_suppressed` (12, post, reason "redrawEnabled is
false"). Era by the record's own `ts` against 2026-08-21. Verified by reading a
single file's sequence that `redraw_suppressed` precedes the `decision` on the
same turn, so the wanted-events are a proper subset of the decisions.

⚠ **Rule 10 is the reason for the union.** `redraw_suppressed` could not have
appeared before session 70 renamed the event, so counting only it would date a
policy change to an instrumentation change. `logs/` is gitignored, so this row
is not reproducible in a stranger's clone and the memo says so.

## Verification at the final commit

```
npx tsc --noEmit                        clean
npx vitest run     Test Files  99 passed (99)
                        Tests  1666 passed (1666)
git diff --check                        clean
assertionCoverage  1666 counted, every one called expect()
discoveredShipsClean                    8/8
preflight.ts                            PASSED — 304 files exported,
                                        1651 passed / 15 author-data skips,
                                        secret scan of the export clean
```

## Live ledger

`doctor.ts` at the top of the session: token valid another 116.0h, config valid
(dungeon 5, 12 runs), fishing configured (node 5), authenticated as the
expected account. Local ledgers 0 runs / 0 casts recorded, rollover 20.1h out.
**Nothing was spent, nothing was denied, nothing was interrupted** — no rule-13
reconciliation applies.
