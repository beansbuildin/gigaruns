# SESSION 79 — 2026-08-22 — the deck is shuffled

*Copy of STATE.md at handoff, plus the verbose material below it.*

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1529/1529** (was 1511), 91 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, `discoveredShipsClean` passes.

- **`castSim` drew every held deck in roster order from index 0. The server
  shuffles.** Measured over committed fixtures: **129 opening hands, ZERO equal
  to `fullDeck[0..2]`**, which a sequential pile predicts for all 129. Session
  78's "an appended card is unreachable by construction" was a property of
  `drawHand` generalised into a claim about Dendren.
- **CAPTURE-3 is CLOSED from the corpus**, no casts spent on it. The deck sweep
  re-ran meaningfully and is recorded SUSPENDED.
- **Live: 3 of 20 fishing casts, USER-APPROVED, 2 catches, 36 energy.** 0
  dungeon runs. Ledgers agree at 3/20 (rule 13 check run). No oil consumed.
- **Ship-nothing posture HOLDS.** No strategy changed. The one live-code change
  is a failure-path reconciliation (loot), not a policy.

## What works
- **§1 GATE 1 — the draw pile shuffles once per cast**, `src/sim/fishing/
  drawModel.ts` + `castSim.ts`. `tests/fishing/deckShuffle.test.ts` (13 tests)
  re-derives the corpus measurement on every run and fails the old model on the
  same statistic: chi-square live-vs-sim **14.08** shuffled (crit 16.92),
  **Infinity** sequential — the old model gives zero probability to data that
  happened. Four scoping decisions, all deliberate:
  - **The pile has its OWN salted rng stream.** Fisher-Yates consumes
    `deck.length - 1` draws, so shuffling off the main stream would make the
    fish trajectory a function of deck SIZE and silently break
    `deckObjectiveSweep.ts`'s seed pairing (its arms differ by one card).
  - **The random-SAMPLE deck path is NOT shuffled** — built i.i.d. with
    replacement, already exchangeable, so the shuffle is a distributional
    no-op that would move every pinned figure in the repo. Pinned
    byte-for-byte: catchRate **0.86**, hitRate **0.7768969422423556**.
  - **`sequentialDrawPile: true` keeps the falsified model selectable so it can
    be watched failing.** Verified byte-identical to `git show HEAD`'s
    simulator: hitRate **0.4075**, meanFinalFishHp **13.255**, catchRate **0**.
  - **`observeTurn` now carries `hand`**, which is how the opening hand became
    observable at all.
- **§1e GATE 2 — CAPTURE-3 closed, sweep re-run.** 4000 paired casts/arm, 161
  compositions: baseline hit **36.42%** (catch **0.0%** on the real 23-card
  deck), best appended arm card 25 at **+9.40pp**, `chooseNewCard`'s pick (card
  110) **62/80, 8.80pp behind** the argmax. **SUSPENDED under OIL-POLICY §0a;
  `chooseNewCard` UNTOUCHED.** The sweep now ranks the APPENDED arm (what a
  loot pick does), its null block is a TRIPWIRE, and the append/prepend pair is
  a CONTROL that doubles as a **noise floor: 1.93pp**, so only 10 of 80 arms
  clear their own noise.
- **§2 the profile check, run both ways** (`focusProfileCheck.ts
  --sequential-pile`). Live-config arm's per-turn focus profile **essentially
  closed** — worst turn discrepancy **0.92 → 0.16**; opening spend 0.53 → 1.27.
- **§3 the loot pick joins the transaction protocol.** APPLIED-but-lost now
  returns true instead of throwing "loot rejected" at a caller whose account is
  fine. All three outcomes pinned, 5 tests.
- **§4 three live casts played and captured.** Corpus 128 → 131 casts, 721 →
  741 response docs, 129 → **132 opening hands, still zero sequential**.

## What's broken
- **§2's verdict is still `*** FAIL ***`, and §0a is NOT lifted.** The bare arm
  — which is what every oil Δ was computed on — barely moved: meter-out
  **0.6% → 0.6%** against a fishery at 63.0% pooled / 33.3% today's era, catch
  **91.5% → 81.2%** against a real **27.6%**. A draw-order fix took ten points
  off a seventy-point chasm. **+19.40pp still MAY NOT BE QUOTED.** The check now
  fails in the opposite direction: the sim OVERSHOOTS today's-era opening spend
  (1.27 against [0.57, 1.02]) where it used to undershoot (0.53).
- **`play_cards`, redraw and `use_fishing_item` remain unrouted, deliberately.**
  Session 65 measured live that a rejected in-cast POST advances the server's
  action token while the client never sees the new value, and `GET
  /fishing/state` carries no `actionToken` to resync from. Mid-cast the cast is
  over either way, so reconciliation could only change the wording of the stop.
  **What would change this is a capture** (an endpoint returning a fresh
  actionToken for an in-progress cast), not a refactor.
- **Whether the pile is RE-SHUFFLED at the wrap is unobserved.** Not modelled.
- **Per-cast vs per-draw shuffle is not distinguished** by this corpus. Per-cast
  is implemented as the simpler hypothesis — chosen, not measured, said so in code.
- Carried, untouched: H2's proc model does not exist (CAPTURE-1); `nextPosition`
  tripwire never met a real miss; session 72's oil gate row still fails; shrinkage
  re-fit unstable; `pConnect` +9.38pp closed BY IRRELEVANCE.

## Corrections to SPEC.md
- **SPEC-fishing's deck-fields row: the draw pile is SHUFFLED and `fullDeck` is
  a ROSTER.** 129/129 opening hands, tail roster positions drawn as often as the
  head (13/8/5/16/6/10/7/13/7/6 over 31 hands on one deck, chi-square 13.47 on
  9 df, not rejected). The pile's order is never on the wire — `deckCardData` is
  metadata and is likewise canonical. Fixed in SPEC-fishing.md.
- **The pile EXHAUSTS and the cursor WRAPS** — `nextCardIndex` 9→2 on a 10-card
  deck, 9→1 on an 11-card one, in **7 of 131 casts**, exactly
  `(idx + handSize) % deck.length`. **This corrects THIS session's own earlier
  commit**, which said the pile never exhausts because `nextCardIndex` never
  exceeds `fullDeck.length`. That predicate cannot see the event — the server
  wraps rather than overflows. CLAUDE.md rule 10 in miniature.
- **A looted card is APPENDED to the roster** (live, 2026-08-22:
  `[..,5,6]` → `[..,5,6,38]`) and is drawn immediately after, including in
  opening hands. CAPTURE-3's literal question, and the answer carries no draw
  consequence.
- **`cardChosenId` has THREE states, not two**: `null`/absent while an offer is
  pending, a real card id once picked, **`-1` on a cast that never offered** —
  92 of 129 states carrying the field. Today's loot predicate's first draft
  tested `!= null` and would have read the sentinel as a landed pick.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Shuffling the RANDOM-SAMPLE deck path.** Distributionally a no-op (i.i.d.
  with replacement is already exchangeable) and it would move every pinned
  figure in the repo. Pinned byte-for-byte so it cannot happen quietly.
- **Re-running the oil sweep after the shuffle.** §0a forbids it on this
  instrument by name, before or after, and eliminating one of its causes does
  not change that. Not run.
- **Routing the three mid-cast writes** — see What's broken. Blocked on a
  capture, not on effort.
- **The sliding-window gap-membership assertion** in `oilReachability.test.ts`
  ("the newest ten casts contain exactly 13024562"). It was always going to go
  false the session after that id left the window, and it did. Rewritten to
  assert the durable id list plus "this batch contributed no gap member".
- Standing, none re-opened: energy is never a blocker; `--dry-run` before
  claiming one; do not revert rule 8; redraw CLOSED on price; +19.40pp
  SUSPENDED; `boonCapture` OFF; do not build H2's proc model; do not write M4's
  lines; `DEFAULT_POTION_THRESHOLD` untouched; no 429 backoff without an
  observed 429.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.
- **`preflight.ts` (~90s) runs BEFORE the push**, not via CI after it.

## Metrics
- **Live: 3 fishing casts, 2 catches (66.7%, n=3 — do not read as a rate), 36
  energy, 0 dungeon runs.** Ledgers agree at 3/20 casts; 12/12 run-units unspent.
- Suite **1511 → 1529** (+18), 89 → 91 files. `assertionCoverage` 0 vacuous.
- Corpus: 128 → **131 casts**, 721 → **741 response docs**, 129 → **132 opening
  hands, 0 sequential**, 39 distinct deck orderings, **7 pile wraps**.
- Deck sweep: baseline hit 36.42%, spread 9.09pp, control/noise floor 1.93pp.
- Profile check, live-config arm: focus Δ turns 1–3 **+0.84/+0.92/+0.69 →
  +0.10/+0.01/−0.01**.

## Open questions for Claude
1. **§0a survived its first named cause. Where does the next hypothesis go?**
   The bare arm reads catch 81.2% / meter-out 0.6% against 27.6% / 63.0%. The
   deck model is now eliminated by measurement. Candidates nobody has costed:
   the fish movement model, the zone/hit geometry, `fishMaxHp` distribution.
2. **17 casts and 12 run-units remain today, expiring 11:00 PT.** Casts now
   have a cheap standing value (more opening hands, more corpus) and cost
   nothing extra. Is a bigger batch worth asking for?
3. **One juiced dungeon run would seed session 78's `evSupported` telemetry**
   with real rule-8 co-occurrence data — still the only dungeon item worth
   arguing for, still needs a per-run go-ahead (rule 11).
4. **The oil policy approval** (`dendren.oils.policyApproved` FALSE) — §2 says
   ask AFTER a profile check that passes, and it did not pass. Still not the
   time.
5. Carried: per-test assertion counts are recorded — is a low-assertion review
   worth one pass? Separate the crit source with one-lure-only casts?

## Files changed
```
 5 commits (590a034, 85758ee, fd74077, ecbbb90, 6c51176).
 40 files, +11866 -194 (of which ~11k is the three new cast fixtures).

  NEW  src/sim/fishing/drawModel.ts        284  the shuffle + corpus statistics
  NEW  tests/fishing/deckShuffle.test.ts   267  GATE 1
  NEW  tests/fishing/lootTransaction.test.ts 198  §3, all three outcomes
       scripts/deckObjectiveSweep.ts      +181  re-run, tripwire, noise floor
       scripts/liveFishing.ts             +158  loot transaction + the unrouted note
       src/sim/fishing/castSim.ts         +103  shuffle, own stream, observeTurn.hand
       src/sim/fishingCorpus.ts            +61  responses carry the draw-pile state
       tests/fishing/oilReachability.test.ts +56  corpus pins, one rewrite
       handoff/OIL-POLICY.md               +44  §0a-i — the cause tested, not lifted
       handoff/DECISIONS.md                +44
       scripts/focusProfileCheck.ts        +42  --sequential-pile
```


---

# Verbose appendix

## A. The measurement, in full — 129 opening hands (132 after the live batch)

Predicate: every committed live fishing state where `nextCardIndex ===
hand.length`, i.e. the pile has been read exactly as far as the hand is wide.
Re-derived independently of the brief before anything was built.

```
BEFORE the session's own three casts:
  states carrying a draw pile                   721
  opening hands                                 129
  hand === fullDeck[0..2]                         0     ← sequential predicts 129
  distinct fullDeck orderings                    38
  nextCardIndex > fullDeck.length                 0     ← see §C: this predicate is blind

AFTER:
  states 741   opening hands 132   sequential 0   orderings 39
```

Three opening hands from one directory on one deck `[1,2,3,4,5,6,7,76,77,79]`:

```
  state-000   hand [6, 3, 1]     nextCardIndex 3   discard []
  state-006   hand [2, 77, 1]    nextCardIndex 3   discard []
  state-009   hand [79, 76, 4]   nextCardIndex 3   discard []
```

Position counts on that deck, 31 opening hands:

```
  pos          0    1    2    3    4    5    6    7    8    9
  card id      1    2    3    4    5    6    7   76   77   79
  in opening  13    8    5   16    6   10    7   13    7    6      / 31

  uniform shuffle predicts 9.3 each  →  chi-square 13.47, 9 df, crit 16.92, NOT rejected
  sequential-from-0 predicts         →  31, 31, 31, 0, 0, 0, 0, 0, 0, 0
```

The chi-square is a CONSISTENCY check, not a significance test — three cards are
drawn without replacement per hand, so the per-position counts are not
independent. The falsification rests on the support test (0/129), which needs no
distributional assumption. Both are stated that way in `drawModel.ts`.

## B. Sim-vs-live, the statistic the old model fails

```
                            chi-square of live counts against the model's shares
  shuffled sim (4000 casts)          14.08     crit 16.92 at 9 df → not rejected
  sequential sim (4000 casts)     Infinity     the model gives probability 0 to
                                               positions the live data occupies
```

Simulated position counts, shuffled, 4000 casts:
`[1200, 1200, 1176, 1196, 1218, 1143, 1205, 1209, 1176, 1277]`, tail share 0.7020
(uniform predicts 0.70). Sequential, same seeds: `[n, n, n, 0, 0, 0, 0, 0, 0, 0]`.

## C. The rule-10 trap I walked into, and the field that could not report it

The first commit of the day asserted "the draw pile never exhausts in the
corpus", from `nextCardIndex > fullDeck.length` being **0** across 721 states
(max ratio 0.92). That is true and it means nothing: the server WRAPS the cursor
rather than overflowing it, so exhaustion is invisible to an overflow test. The
right detector is a DECREASE within one cast, ordered by the server's own
`updatedAt`:

```
  12923274   9 -> 2  of 10    cast-2026-08-15-20-38-13/state-024.json
  12975713   9 -> 2  of 10
  12975717   9 -> 2  of 10
  12978000   9 -> 1  of 11
  12978003   9 -> 1  of 11
  12988710   9 -> 1  of 11
  (+1 more)                    7 of 131 casts
```

Every one satisfies `to === (from + 3) % deckLength` — `drawHand`'s own
arithmetic. So the wraparound is validated in FORM and does fire on real decks.
Six of the seven predate today. **The data was there the whole time; the
predicate could not express the question.**

## D. The deck sweep, re-run — full head of the table

```
  baseline (23-card held deck):  catch 0.0%  hit 36.42%  meanTurns 4.39  meanFinalFishHp 13.62

  CONTROL — append vs prepend, which the shuffle should have made equivalent
    mean |append − prepend| hit rate   1.93pp     ← the harness's own noise floor
    max                                2.59pp
    spread across appended arms        9.09pp
    (session 78 measured this pair at 0.00pp and up to 19.91pp — that asymmetry
     WAS the sequential pile)

  rank  card                 appended hit%    Δhit   prepended Δhit   mana
     1  +25  (r4, 1m)              45.82    9.40             7.34     1
     2  +16  (r0, 1m)              44.76    8.34             6.11     1
     3  +109 (r3, 1m)              43.26    6.84             4.96     1
     4  +18  (r2, 1m)              43.26    6.84             4.96     1
     5  +99  (r2, 1m)              43.26    6.84             4.96     1
     ...
    10  +17  (r1, 0m)              40.51    4.09             2.62     0
    11  +24  (r3, 1m)              38.31    1.89            -0.16     1   ← below the floor
     ...
    62  +110 (r4, 1m)              37.02    0.60            -1.35     1   ← chooseNewCard's pick
     ...
    80  +97  (r2, 1m)              36.73    0.31            -1.42     1

  10 of 80 arms beat the baseline by more than the 1.93pp control gap.
  The rest are inside the harness's own noise and their ORDER means nothing.

  chooseNewCard (damage/mana):  card 110
  composition argmax:           card 25
  → 62/80, 8.80pp behind, 4.6x the control gap. SUSPENDED (§0a). UNTOUCHED.
```

## E. The profile check, both draw models, 4000 casts/arm

```
                        sequential      shuffled     corpus
  live-config arm
    focus, turn 0..3    3.00 2.47 1.88 1.21   3.00 1.73 0.98 0.51   3.00 1.63 0.97 0.52
    Δ, turns 1-3        +0.84 +0.92 +0.69     +0.10 +0.01 -0.01     —
    opening spend       0.53            1.27         1.37 pooled; 0.79 [0.57,1.02] today
    meter-out           27.3%           29.3%        63.0% pooled;  33.3% today
    catch               32.7%           20.6%        28.3% (pools oil + non-oil)
    turns at focus 0    38.5%           54.7%        43.0%
  bare arm — what every OIL-POLICY Δ was computed on
    meter-out           0.6%            0.6%         63.0% / 33.3%
    catch               91.5%           81.2%        27.6%

  VERDICT: *** FAIL *** both ways. §0a NOT lifted.
```

## F. The three live casts

```
  cast 1  13039914   CAUGHT in ~4 turns.  loot: offered (38, 48, 37) → chose 38
  cast 2  13039923   escaped after 10 turns.  cardChosenId -1 on the terminal doc
  cast 3  13039932   CAUGHT in 2 turns.   loot: offered (41, 48, 10) → chose 10

  fullDeck  [74,75,76,78,1,2,3,4,5,6]  →  [74,75,76,78,1,2,3,4,5,6,38]   ← APPENDED
  card 38 then appears in cast 2's turn-6 hand and in cast 3's OPENING hand.

  energy 39 → 28 → 16 → 4.  One accounting drift note on cast 1 (committed 12 vs
  observed 11) — the guard enforces off committed spend by design (CODEXREVIEW #8),
  and a ROM claim landing mid-run is the stated benign cause.

  ledger check (rule 13):  GAME dayDocs pond 2 = 3/20, REPO 3 casts — agree.
```

## G. Corpus pin churn from the live batch, itemised

Five test files carry hard-pinned corpus counts. Each was updated with what
moved AND what did not, because the second half is the finding:

```
  fishingCorpus:  casts 128→131, responseDocs 721→741, playTurns 537→552,
                  caught 36→38, escaped 91→92, incomplete unchanged at 1
  zoneTemplate:   traces 128→131, clean 127→130 (still trails by exactly one),
                  clean play turns 533→548, caught 36→38
  stateFields:    corrected.crits 24→25
  oilReachability: casts 128→131, decisionPoints 549→564, neitherReachable 58→61
                  (ALL THREE new casts reach neither trigger),
                  relaxingReachable STILL 12 across three consecutive batches,
                  focusReachable STILL 65, terminalMeterZero STILL 68
```

## H. What the next session should NOT re-derive

- The 129/132 opening-hand measurement — `deckShuffle.test.ts` re-derives it on
  every run and will say so if it ever stops holding.
- The pre-session-79 simulator's figures — pinned as literals (0.4075 / 13.255 /
  0 for the held deck, 0.86 / 0.7768969422423556 for the sampled path).
- The append/prepend control gap — printed by the sweep every run.
- CAPTURE-3. Closed. Do not spend casts on it.
