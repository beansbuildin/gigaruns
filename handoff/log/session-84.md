# SESSION 84 — 2026-08-23 (PT) — the era named, the collapse decomposed, finishRun gated

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1652/1652** (was 1614), 98 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, **`preflight.ts` PASSED** with a clean secret scan (1637 passed /
15 author-data skips in the stranger's tree), `discoveredShipsClean` 8/8.

- **Offline session by the SERVER's own ledgers.** Rule 13 first:
  `DayCount#…#Dungeon#5` = **12/12**, `dayDocs[pondId 2]` = **20/20**, both
  spent before the session began, ~1.7h to the 11:00 PT rollover at the last
  check. **Zero live spend.** §6 (live captures) untouched — it needs both the
  rollover and a per-run go-ahead.
- **The era split is the session, and it cuts both ways.** Today's era reads
  **1.5%** focus-budget-0 against the pooled corpus's **30.6%**, so twenty
  sessions of instruments have been measuring a bot that is **64% gone**.
- **GATE 1: today's era reproduces the brief CELL FOR CELL**, `neither = 0`
  pinned, rescue rate shipped as an interval and never a point.
- **GATE 2: the collapse decomposes three ways**, each term with its own
  control — and the CAUSE of the largest term is **not identified**, said out
  loud rather than papered over (rule 6).
- **`finishRun` shipped with its gate demonstrated FAILING** on the exact
  regression it exists to catch.
- **Ship-nothing posture HOLDS.** `redrawEnabled` still false,
  `REDRAW_THRESHOLD` untouched, redraw still CLOSED.

## What works
- **The era predicate, off committed fixtures only** (`src/sim/fishing/castEra.ts`).
  A cast is TODAY when `doc.createdAt >= 2026-08-21` UTC — constant across a
  cast's states **148/148**, so it dates the CAST.

  ⚠ This is NOT the brief's §0b hazard, which is about ordering STATES inside a
  cast, where the timestamps tie. Both readings are now recorded in
  `castTrace.ts`'s header so the distinction cannot be lost.
- **`todaysEraCastIds()` was PREFERRED AND REJECTED, on evidence.** It reads
  `data/ringPrediction.jsonl` (gitignored, absent from a fresh clone),
  classifies only **81 of 148** casts, and names a DIFFERENT boundary —
  matcher-weighting at 2026-08-20T18:27Z. The two disagree on **exactly five
  casts, all stamped 2026-08-20T18:27–18:28Z**, the interval between the two
  boundaries, and those five read **7/19 = 36.8%** at budget 0 — the OLD
  regime. Folding them in takes today's rate 1.5% → **4.5%**.
- **§5 — GATE 1a, the era split:**

  ```
             casts  plays  budget 0    rate  1st-play spend   catch
    before      94    410       184   44.9%   1.553 (max 3)   15.1%
    today       54    202         3    1.5%   0.852 (max 2)   63.0%
    all        148    612       187   30.6%   1.297 (max 3)   32.7%
  ```

  ⚠ The brief counts 404 / 201 / **605** and 178 / 3 / 181. CAST counts agree
  exactly; play counts do not. **612 is STATE.md's own documented figure**, six
  predicates were tried (clean traces, `hasStart`, `continuous`,
  next-turn-exists, the stale meter), none lands on 605. Rule 9.
- **§6 — GATE 1b, the counterfactual conditioned, and it INVERTS:**

  ```
                n  both  sac  rescue  neither  dead  rescue rate  cost
    pooled    389   261   27      45       56   101        44.6%  1.60
    before    262   152   24      30       56    86        34.9%  1.73
    today     127   109    3      15        0    15       100.0%  1.33
  ```

  Today reproduces the brief cell for cell; availability **88.2% → 97.6%**.
  **The rescue rate ships as 95% CI [79.6%, 100.0%], n = 15 — never a point.**
  Session 83's unexplained 389-vs-387 residual lives **entirely in the before
  arm**, so it does not touch this.
- **§7 — GATE 2, the collapse decomposed:**

  ```
    before-era crude rate                       44.9%
      - cast LENGTH mix (standardisation)      -5.4pp
    = before-era rates at today's length mix    39.5%
      - focus PACING (no restores)            -18.2pp
    = today's plays off an un-refilled pool     21.3%
      - focus OIL restores                    -19.8pp
    = today's crude rate                         1.5%
  ```

  Order-free, each with its own control:
  - **no-oil arm, 41 casts / 115 plays: 1.7% observed vs 27.8%
    length-standardised.** The oil explains none of it.
  - **oil arm, 13 casts / 87 plays: strip the restores → 47.1%,** against a
    length-standardised 54.9%. There the oil does nearly all the work.
  - **Control validated:** the no-restore counterfactual over the before era,
    which fired no oils, gives **183 vs an observed 184** — the one difference
    is the single cast that opened at `focusMeter` 2.
  - **NOT the gear:** deck intrinsic reach **15.3% before vs 15.1% today**,
    while decks grew 11.4 → 15.4 cards and 18.5% → 34.2% crit-bearing; the
    effect survives deck-size matching (11–12: 45% → 4%; 13–15: 51% → 2%).
- **§7a (not gated) — the trigger signal SURVIVES the split** and its job
  changes. AUC 0.907 today vs 0.922 pooled, but the dead hands are a different
  population (mean coverage 5.13 → 8.87). `wasted` is **structurally zero** at
  every K because `neither = 0`, so a threshold trades only rescues against
  sacrifices: **K=7 fires 9, rescues 7, sacrifices 0, 11 mana** — better
  unconditioned than session 83's best conditioned row.
- **§4 — one `finishRun(reason, room)` for both run-end exits, gate
  demonstrated failing.** Reverting the absent branch to its old two lines
  **fails 4 of `tests/liveRunFinishRun.test.ts`'s 8**. Both shapes replay
  offline against a mocked fetch, each playing one real combat exchange first
  so `totalDecisions > 0` and the EV line is actually exercised.

## What's broken
- **The 44.9% → 1.5% pacing term has NO IDENTIFIED CAUSE.** The corpus brackets
  it to **2026-08-20T18:28:24Z → 2026-08-21T14:46:17Z**, a 20.3h gap with zero
  casts. The only code in it is sessions 61/62, whose `liveFishing.ts` diff is
  **oil plumbing** and touches neither focus nor card selection;
  `focusReserveWeight` defaults 0, `costCap` is documented inert. The
  PROXIMATE mechanism is identified (first-play spend 1.553 → 0.852, never 3).
  **What would settle it:** off-policy replay of the corpus's decision points
  through the session-60 and session-62 policies — `scripts/offPolicyReplay.ts`
  is the instrument.
- **The catch rate went 15.1% → 63.0% across the same boundary and is also
  unattributed.** Plausibly the crit-richer decks; not measured.
- **§3's thresholds remain oracle-labelled with no held-out set**, and today's
  arm is n=15 dead. QUESTIONS §26 puts the shadow evaluation to the user.
- Carried, untouched: H2's proc model (CAPTURE-1); `play_cards`/redraw/
  `use_fishing_item` unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**;
  `mana -= card.manaCost` unconfirmed; three Big Heals do not save a run (M2
  blocked); the crit rule still has two members and needs a base-6/8/10 crit.

## Corrections to SPEC.md
- **Oils must be detected on `consumablesUsed`, not on the focus meter, and the
  two give different answers.** `consumablesUsed` delta → **13 casts, 21
  oils**; a `focusMeter` increase → **11 casts, 16 jumps** with deltas of both
  +1 and +2. Cause is documented behaviour: `castTrace.ts` skips the
  `use_fishing_item` response, so the visible jump is **restore MINUS the move
  spent on the same transition**. The brief's "+2 exactly, 21 times" was read
  off raw fixtures including that response — both right about different things.
  add-2 vs restore-to-2 stays undecided (all 22 recorded oils fired at meter 0).
- **`doc.createdAt` is the only per-cast clock in the committed fixtures** and
  is constant within a cast 148/148. Recorded in `castTrace.ts` beside the
  warning against sorting a cast's STATES by it.
- **`todaysEraCastIds()` is not a portable era instrument** — reads `data/`,
  sees 81 of 148 casts, names the matcher-weighting boundary. Do not import it
  into a committed test.
- Unchanged: resolved IDs forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
  charges: PRESENT — unchanged, not re-measured. No new fixtures this session.

## Dead ends
- **Cast length as the explanation for the collapse.** Direct standardisation
  gives 39.5% expected against 1.5% observed — length explains **5.4pp of
  43.4pp**. The drop is WITHIN length (at length 10: 69% → 2%).
- **The deck as the explanation.** Intrinsic reach 15.3% vs 15.1%, and the
  effect survives deck-size matching. The decks really did change; their reach
  did not.
- **The matcher-weighting boundary as the era boundary.** Its five extra casts
  read 36.8% budget-0 — old regime. It is the wrong boundary for this question.
- **Reproducing the brief's 605 / 404 / 201 play counts.** Six predicates
  tried; the cast counts (94/54) agree and the play counts do not.
- **Sorting a cast's states by `createdAt`** — the brief's own §0b near-miss,
  now written into `castTrace.ts`.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD`/`chooseNewCard` UNTOUCHED; no 429 backoff without
  an observed 429; do not shuffle the random-sample deck; do not complete the
  corrode perpetual table.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: ZERO. No dungeon run, no fishing cast, no on-chain anything.** Both
  server ledgers read (12/12, 20/20) and both spent before the session began.
- Suite **1614 → 1652** (+38, two new files), 98 files, 0 vacuous. Stranger's
  tree: 1637 passed / **15** author-data skips.
- Corpus UNCHANGED: 148 cast traces, 612 plays, 147 resolved casts. Nothing
  captured, nothing appended.
- New offline measurements: the era split (94/54 casts, 410/202 plays), the
  era-conditioned counterfactual, a three-term decomposition with three
  controls, per-era separability (AUC 0.922 / 0.912 / 0.907).

## Open questions for Claude
1. **The pacing term's cause is the session's live loose end, and the next
   step is offline.** Replay the corpus's own decision points through the
   session-60 and session-62 policies and diff the focus move each chooses.
   That is a `git worktree` at two old commits plus `offPolicyReplay.ts`; it
   costs no run-unit and it would either name the change or prove the change
   was not in this repo's code — which would point at the learned state
   (`data/opponent-model.json`, `data/minedFishPatterns.json`) instead.
   **Is that worth a session?** It is the largest live improvement on record
   and nobody knows what caused it.
2. **QUESTIONS §26 — the shadow evaluation — needs a yes/no from the user.**
   §7a made it much more attractive: `wasted` is structurally zero, so the
   trigger only trades rescues against sacrifices, and K=7 gets 7 rescues for
   0 sacrifices unconditioned. It is a live-path instrumentation change and
   nothing is written until the user answers.
3. **QUESTIONS §25 — the depth-matched pre-death control — is PRICED and
   parked.** It needs ~8–12 juiced runs, i.e. **2–3 full days of the run cap**,
   each with its own go-ahead, to buy one retracted finding re-asked.
   Recommendation: DROP unless the user wants that spend. Not dropped
   unilaterally.
4. **The era split now has to go into the next instrument, not just this one.**
   `src/sim/fishing/castEra.ts` exists for that. Session 71 wrote the warning
   down and five sessions of instruments pooled the eras anyway; the third
   instance of that class was this session's whole finding.
5. **12 run-units and 20 casts refresh at 11:00 PT** (~1.7h out at last check).
   The crit rule still needs one base-6/8/10 crit; card 10 is in the deck. An
   oil consumed at a NON-ZERO meter would settle add-2 vs restore-to-2, and
   §5 says that capture is getting **harder** — today's bot reaches meter 0 on
   1.5% of plays.

## Files changed
```
 4 commits (16616b95, fafb024b, b1c4dbcd, b9048d44, dd81ccf5) + this recap.

  A  src/sim/fishing/castEra.ts        +562  the era predicate, the split, the
                                             decomposition, the gear control
  A  tests/fishing/castEra.test.ts     +336  30 tests, gate 1 + gate 2 + §7a
  A  tests/liveRunFinishRun.test.ts    +273  8 tests, the finishRun gate
  M  scripts/redrawCounterfactual.ts   +275  §5 era split, §6 conditioned
                                             table, §7 decomposition, §7a
  M  scripts/liveRun.ts                +100  one finishRun for both exits
                                        -35
  M  QUESTIONS.md                       +71  §25 (priced capture), §26 (shadow)
  A  handoff/scratch-session-84.md      +78  surprises as they landed
  M  src/sim/fishing/castTrace.ts       +13  §0b's sort hazard, recorded
  M  handoff/DECISIONS.md                +8
  M  tests/noHardcodedPaths.test.ts      +7  castEra on the corpus-root list

  10 files changed, 1688 insertions(+), 35 deletions(-)
```

---

## Appendix A — the scratch file, surprises as they landed

## 1. `todaysEraCastIds()` cannot be the era instrument, for three reasons
It reads `data/ringPrediction.jsonl`, which is **gitignored** — the gate says
"no `data/`", and a fresh clone has none. It knows only **81 of the corpus's
148 casts**. And it names a **different boundary**: turn-0 rows carrying
`matcherWeight` = the matcher-weighting era at 2026-08-20T18:27Z, not the
oil-policy date the brief split on.

Measured rather than argued: mw-era = 59 casts, date-era = 54, and the
disagreement is **exactly 5 casts, all at 2026-08-20T18:27–18:28Z**. Those 5
read **7/19 = 36.8% budget-0** — squarely the OLD regime. Folding them into
"today" takes today's rate from 1.5% to 4.5%. **The date literal wins, on
evidence.**

## 2. `doc.createdAt` is a per-cast timestamp available off committed fixtures
Constant within a cast on **148 of 148**. This is NOT the brief's §0b hazard —
that was about ordering STATES inside a cast, where the timestamps tie. Dating
a whole cast is a different use and it is safe.

## 3. Play counts are 612 / 410 / 202, not the brief's 605 / 404 / 201
Cast counts match exactly (94 / 54). 612 is STATE.md's own documented corpus
figure. Six variants tried (clean traces, hasStart, continuous, next-turn-
exists, stale meter) — none lands on 605.

## 4. Today's era reproduces the brief EXACTLY; the gap is all in the OLD arm
`127 / 109 / 3 / 15 / 0`, dead 15 (11.8%), cost 1.33, 88.2% → 97.6%. Every cell
identical. Session 83's unexplained 389-vs-387 residual therefore lives
**entirely before 2026-08-21** and does not touch today's-era conclusion.

## 5. The catch rate went 15.1% → 63.0%
93 resolved / 14 caught, against 54 / 34. Nobody has written this down either.

## 6. Cast length explains only 5.4pp of the 43.4pp drop
Direct standardisation of before-era per-length rates onto today's length mix
gives 39.5% expected against 1.5% observed. The drop is WITHIN length: at
matched length 10 it is 69% → 2%.

## 7. The decomposition is three additive terms and the corpus supports all three
44.9% → 39.5% (length mix, 5.4pp) → 21.3% (focus pacing, 18.2pp) → 1.5%
(oil restores, 19.8pp).
- Oil term isolated by a **within-cast no-restore counterfactual**: strip the
  restores from the 13 oil casts and they read **47.1%**, against a before-era
  length-standardised **54.9%**. The oil does ~all the work on that arm.
- Pacing term isolated on the **41 restore-free casts**: **1.7% observed vs
  27.8% standardised**, and the no-restore counterfactual on that arm is
  identical to observed (2 plays) — by construction, which is the self-check.
- Self-check: the POOL=3 no-restore counterfactual reproduces the before era at
  183 vs the observed 184. The one difference is the single before-era cast
  that started at `focusMeter` 2.

## 8. It is NOT a gear effect
Deck intrinsic reach — the policy-free fraction of (focus, target) pairs one
random deck card covers — is **15.3% before vs 15.1% today**, and the era
effect survives deck-size matching (11–12 cards: 45% → 4%; 13–15: 51% → 2%).
Decks did get bigger (11.4 → 15.4 cards) and crit-richer (18.5% → 34.2%), which
plausibly drives the catch rate, but not the focus budget.

## 9. The proximate mechanism is the FIRST PLAY
Mean first-play focus spend **1.553 → 0.852**, and today it is **never 3**
(before: 17 of 94 casts spent the whole meter on play 1). Cumulative spend
before play 3: 2.2 → 1.5. Before-era casts are at 3.0/3 by play 6 — 100% frozen
from there.

## 10. The cause is NOT identified, and the bracket says why it is hard
Corpus brackets the change to **2026-08-20T18:28:24Z → 2026-08-21T14:46:17Z**,
a 20.3h gap with zero casts. The only code in it is sessions 61 and 62, and
their `scripts/liveFishing.ts` diff is **oil plumbing only** — no focus or card
selection change. `focusReserveWeight` defaults 0, `costCap` is documented
inert. So the measured mechanism has no identified cause.

## 11. Oil detection: use `consumablesUsed`, not the meter
`consumablesUsed` delta → **13 casts** (matches the brief). A `focusMeter`
increase → 11 casts / 16 jumps, deltas +1 (7) and +2 (9), because `castTrace`
skips the `use_fishing_item` response, so the visible jump is **restore minus
the move spent on the same transition**. The brief's "+2 exactly, 21 times"
was read off raw fixtures including the item response; both are right about
different things. Oils consumed today: **21**, which does match.

---

## Appendix B — the full report output (`npx tsx scripts/redrawCounterfactual.ts`, §5 onward)

```
── §5  THE ERA SPLIT — the corpus pools two bots, and one of them is gone ──
  Era predicate: a cast belongs to TODAY when its doc.createdAt (constant across the
  cast's states, 148/148) is on or after 2026-08-21 UTC. Committed fixtures only.

             casts  plays  budget 0    rate  1st-play spend   catch
    before      94    410       184   44.9%   1.553 (max 3)   15.1%
    today       54    202         3    1.5%   0.852 (max 2)   63.0%
    all        148    612       187   30.6%   1.297 (max 3)   32.7%

    The focus meter is a non-regenerating pool, so budget 0 is ABSORBING in a cast with no
    restore and TRANSIENT in one with it. That is why the effect is this large.
    Casts that ever froze: 56/94 before, 2/54 today.

    vs todaysEraCastIds() (scripts/focusProfileCheck.ts — matcherWeight, i.e. the
    MATCHER-WEIGHTING boundary at 2026-08-20T18:27Z, a different boundary):
      DISAGREE: 5 cast(s) it calls today and the date does not, 0 the other way.
      Those 5 read 7/19 = 36.8% at budget 0 — the OLD regime.
      Folding them in takes today's rate to 4.5%. THE DATE PREDICATE WINS, on evidence.

── §6  §2's TABLE, CONDITIONED ON THE ERA — and it INVERTS ──
                n  both  sac  rescue  neither   dead  rescue rate   cost        availability
    pooled    389   261   27      45       56    101        44.6%   1.60      74.0% -> 78.7%
            95% CI on the rescue rate: [35.2%, 54.3%]  (n = 101 dead hands)
    before    262   152   24      30       56     86        34.9%   1.73      67.2% -> 69.5%
            95% CI on the rescue rate: [25.7%, 45.4%]  (n = 86 dead hands)
    today     127   109    3      15        0     15       100.0%   1.33      88.2% -> 97.6%
            95% CI on the rescue rate: [79.6%, 100.0%]  (n = 15 dead hands)

    THE READING. In today's era `neither` is ZERO: there is not one play where both the held
    hand and the redrawn triple are dead. Every dead hand is rescued, at a mean 1.33 mana on
    a pool that discards 5.85 per cast. Session 83's "the dead hands a signal finds are the
    ones a redraw cannot fix" describes the BEFORE arm and nothing else.

    ⚠ DO NOT READ 15/15 AS 100%. The interval above is the number; its lower bound is near
      78%. And this is AVAILABILITY under an oracle lens, not hits — the same lens on both
      arms, so the pairing is fair and the levels are not achievable. It is still not a
      TRIGGER: three sacrifices remain and the bot cannot see the fish's next cell.

    ⚠ Session 83's unexplained 389-vs-387 residual lives ENTIRELY in the before arm. Today's
      arm reproduces the session-84 brief cell for cell, so the residual does not touch this.

    This does not reopen the CLOSED verdict. It says the counterfactual that informs it
    should be read on the era the bot actually plays in.

── §7  THE COLLAPSE, DECOMPOSED — GATE 2 ──
    before-era crude rate                                     44.9%
      - cast LENGTH mix (direct standardisation)             -5.4pp
    = before-era rates at today's length mix                  39.5%
      - focus PACING (today's spend, no restores)           -18.2pp
    = today's plays off an un-refilled pool                   21.3%
      - focus OIL restores                                  -19.8pp
    = today's crude rate                                       1.5%

    THE ORDER-FREE STATEMENT, which is the one to quote. The three terms above are
    sequential and each takes the residual of the ones before it. These two do not
    depend on that ordering:

      today no-oil  41 casts / 115 plays   observed   1.7%   before-era length-standardised  27.8%   with restores stripped   1.7%
      today oil     13 casts /  87 plays   observed   1.1%   before-era length-standardised  54.9%   with restores stripped  47.1%

      - The NO-OIL arm never fired a restore, so its counterfactual equals its observation by
        construction — that is the self-check, not a result. Its result is the gap to the
        standardised column, and the oil cannot explain any of it.
      - The OIL arm reverts almost exactly to the before-era standardised rate once the
        restores are stripped. On that arm the oil does essentially all the work.
      - Self-check on the control: run the no-restore counterfactual over the BEFORE era, which
        fired no oils, and it must reproduce the observation.
        before era: counterfactual 183 vs observed 184. The one difference is the single cast that opened at focusMeter 2.

    AND IT IS NOT THE GEAR. Deck intrinsic reach is policy-free and fish-free — over every
    (focus, target) pair, the fraction one deck card covers:

      before  reach 15.3%   mean deck 11.4 cards   crit-bearing 18.5%
      today   reach 15.1%   mean deck 15.4 cards   crit-bearing 34.2%

      The decks got bigger and much crit-richer — which plausibly drives the catch rate from
      15.1% to 63.0% — and their REACH did not move. The era effect also survives deck-size
      matching (11-12 cards: 45% -> 4%; 13-15: 51% -> 2%).

    ⚠ WHAT THIS DOES NOT DO IS NAME A CAUSE FOR THE PACING TERM, and CLAUDE.md rule 6 says
      say so. The corpus brackets the change to 2026-08-20T18:28:24Z -> 2026-08-21T14:46:17Z,
      a 20.3-hour gap with no casts. The only code in it is sessions 61 and 62, whose
      liveFishing.ts diff is oil plumbing and touches neither focus nor card selection;
      focusReserveWeight defaults to 0 and costCap is documented inert. The proximate
      mechanism IS identified — mean first-play focus spend fell 1.553 -> 0.852 and today
      never reaches 3, where 17 of 94 before-era casts emptied the meter before their second
      play. WHAT WOULD SETTLE THE CAUSE: replay the corpus's own decision points through the
      session-60 and session-62 policies and compare the focus move each chooses.
      scripts/offPolicyReplay.ts is the existing instrument for that shape.

── §7a  DOES §3's SIGNAL SURVIVE THE SPLIT? (not gated) ──
              dead  live     AUC  mean cov dead    live
    pooled     101   288   0.922           5.13   13.32
    before      86   176   0.912           4.48   12.60
    today       15   112   0.907           8.87   14.46

    today's era, `heldCoverage <= K` as a trigger over ALL its plays:
        K  fires  rescues  sacrifices  wasted   mana
        3      1        0           0       0      1
        4      2        1           0       0      3
        5      6        5           0       0      8
        6      6        5           0       0      8
        7      9        7           0       0     11
        8     10        7           1       0     14
        9     11        7           1       0     16
       10     19       10           1       0     24
       11     25       11           1       0     33
       12     35       12           1       0     46
       13     39       13           2       0     56
       14     48       14           2       0     75
       15     69       15           3       0    121
       16    127       15           3       0    271

    WHY THIS IS THE SHADOW DESIGN'S INPUT. In today's era `wasted` is structurally ZERO —
    §6 pinned neither = 0, so a redraw fired on a dead hand always rescues it. The trigger's
    job is therefore DETECTION, not selection, and the only thing a threshold trades is
    rescues against sacrifices. ⚠ Still oracle-labelled, still no held-out set, n = 15 dead.
    QUESTIONS.md §26 asks the user whether to shadow-evaluate it live for non-oracle labels.

── §8  READ THIS BEFORE QUOTING ANY OF IT ──
  Redraw is CLOSED and nothing here reopens it. `redrawEnabled` ships false and is
  pinned false from both ends. This script measures a price; it does not license a
  policy, and rule 4 bars a live change on a sim result regardless.

  And nothing above may be quoted WITHOUT its era. §5 measures why: the pooled corpus is
  64% a bot that no longer exists, and §6's two arms disagree about the headline.

```

---

## Appendix C — the finishRun gate, demonstrated FAILING

Reverting `liveRun.ts`'s absent branch to its pre-session-84 two lines:

```
    × NOW emits the boon-coverage snapshot, which this exit never did
    × NOW emits session 78 §3's EV support line, which this exit never did
    × report the same run-end events in the same order, differing only in the terminator
    × would FAIL if either exit stopped calling finishRun — the reporting is not duplicated anywhere
      Tests  4 failed | 4 passed (8)
--- restored ---
      Tests  8 passed (8)
```

---

## Appendix D — the ledgers, read before anything else (rule 13)

```
npx tsx scripts/doctor.ts        dungeon: 12 runs / 240 energy recorded
                                 fishing: 20 casts / 240 energy recorded
                                 rollover 11:00 PT, 2.1h from the check
npx tsx scripts/checkDungeonToday.ts
                                 DayCount#<ADDR>#Dungeon#5  UINT256_CID: 12
npx tsx scripts/checkFishingCaps.ts
                                 GAME ledger (dayDocs pond 2):  20 / 20
                                 VERDICT: BLOCKED — cap spent.
```

Both spent before the session began. Zero live spend this session.

---

## Appendix E — preflight, at the final code commit

```
▸ preflight — DISTRIBUTION step 5, rehearsed locally.
  ✓ exported 302 tracked file(s) to dist-preflight/
  ✓ exactly one ✗, which should be the JWT. That is the expected state.
  Test Files  98 passed (98)
  Tests  1637 passed | 15 skipped (1652)
  ✓ green in a stranger's tree.
  ✓ secret scan of the exported tree: clean.
▸ PREFLIGHT PASSED
```
