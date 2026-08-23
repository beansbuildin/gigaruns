# STATE — session 84 — 2026-08-23 (PT) — code at commit dd81ccf5

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
