# BRIEF — session 45 (fishing)

**This brief replaces the earlier session-45 draft.** That draft was right
that `bestFocusForCard`'s objective has no cost on spending focus, and right
that a reserve term is the fix shape. It was wrong about the priority. I went
back to `data/fish-patterns.jsonl` (263 real transitions, 67 casts) and
`fixtures/fishing-casts/cards.json` directly, and the focus-budget bug is the
*second*-largest defect in fishing, not the first. Fixing it alone buys about
5 points of catch rate. Fixing what's above it buys about 35.

Per CLAUDE.md §9 everything below is checkable against files already in the
repo — I checked it, the numbers are in §0, and the first task of this session
is to re-derive them independently before building on them.

---

## 0. The finding the last brief missed: the movement model is wrong

`data/fish-patterns.jsonl`, all 263 transitions, 67 casts, no filtering:

**Fact 1 — every move lands on the Manhattan-`k` ring around the fish's
current cell, and `k` is fixed for the whole cast.**

| | |
|---|---|
| transitions at Manhattan distance 1 | 148 |
| transitions at Manhattan distance 2 | 115 |
| transitions at any other distance | **0** |
| casts with ≥2 moves whose every move has the same `k` | **65 / 65 (100%)** |
| moves landing off the legal (in-grid) `k`-ring | **0 / 263** |

This is the user's "1 box per move or 2 box per move, established on the first
move" — confirmed exactly, with zero counterexamples, by the project's own
corpus. `k=1` casts: 36. `k=2` casts: 31.

**Fact 2 — within a class, the next move is strongly conditioned on the
previous one, and in opposite directions for the two classes.**

| class | P(repeat previous delta) | P(exact reversal) | n |
|---|---|---|---|
| k=1 | 27.7% | **0.0% — 0 of 112** | 112 |
| k=2 | 3.6% | **41.7% — 35 of 84** | 84 |

A 1-step fish *never* backtracks. A 2-step fish backtracks more than any other
single option. Both are large, both are exploitable, and **neither is class-
aware in the current code**.

**Fact 3 — the deck is built around Fact 1, and the code cannot see it.**
From `fixtures/fishing-casts/cards.json`, the zone templates are not arbitrary:

- `hitZones {2,4,6,8}` (ids 8, 14, 27, 75, 79, 88, 98, 108) is *exactly* the
  Manhattan-1 ring. Focus on the fish's current cell + one of these = **100%
  hit against a k=1 fish**, by construction, no pattern knowledge needed.
- `hitZones {1,3,7,9}` (ids 7, 13, 19, 38, 74, 97, 107) is the diagonal subset
  of the Manhattan-2 ring. Focus on the fish + one of these = **71.3% (82/115)
  against a k=2 fish**, measured on the real corpus.
- `hitZones {1,2,3,4,6,7,8,9}` (ring-8: ids 9, 12, 15, 18, 24, 25, 76, 89, 99,
  109) covers both rings' intersection with the 3×3 window: 100% vs k=1,
  71.3% vs k=2, at lower damage.

Best (card, focus-offset) by EV against the real corpus — focus offset is
measured from the fish's **current** cell:

| class | offset (0,0) | (±1,0) | (±1,±1) | (2,0) | (2,2) |
|---|---|---|---|---|---|
| k=1 | **100.0%** | 75–84% | 56–59% | 40% | **0%** |
| k=2 | **71.3%** | 54–63% | 41–48% | 64% | 8% |

Focus co-location is worth 25–60 points of hit rate, and at Chebyshev distance
2 from the fish a k=1 cast is a **guaranteed miss** — every card, every turn.

**What the code does instead.** `scripts/liveFishing.ts:1009-1025` builds the
distribution from `predictDistribution(matcher)` over two mined
`perimeterWalk` candidates anchored at the start cell; when those die (they
die fast) it falls to `contextualFallback`, keyed on
`(current cell, previous displacement)` over a 263-row table. Neither tier
knows the step class, so neither can restrict to the ring. The class-blind
empirical map assigns mass to cells the fish provably cannot reach this turn,
and `chooseCard` consumes the whole distribution — so that mass directly
distorts both the card pick and the focus placement. This is why the 0/16 live
batch looks the way it does.

**Leave-one-cast-out on the real corpus**, 196 scored transitions, comparing
predictors head to head (this is the honest out-of-sample number, not a fit):

| predictor | top-1 | log loss |
|---|---|---|
| cell-only (today's tier 2) | 23.5% | 2.397 |
| cell + prev-displacement (today's tier 1) | 40.8% | 2.070 |
| **ring, class-aware (Fact 1 only)** | 31.6% | **1.249** |
| **ring + class-aware prev-delta conditional (Facts 1+2)** | **47.4%** | **1.123** |

Note the log-loss column especially. `chooseCard` integrates over the whole
distribution, so calibration matters more than top-1 — and the ring model
nearly halves log loss even where it loses on top-1. It also needs no
per-cell history, so it works on turn 1 of a fresh pond where the cell-keyed
tables are empty.

### The corrected priority ordering

I ran a Monte Carlo against the real deck (`fullDeck` from
`fixtures/fishing-casts/live/cast-2026-08-19-00-55-15/state-000.json`:
`[1,2,3,4,5,6,7,76,77,79]`), real parameters (fishHp 13/21, mana 10/10, focus
3, hand 3), with the fish's dynamics drawn from the empirical conditional
table. N=4000 per row:

| policy | catch rate | escaped_meter | escaped_mana |
|---|---|---|---|
| blind cell-only + EV (≈ today) | 19.5% | 59.2% | 21.3% |
| + step-class ring predictor | 35.9% | 38.5% | 25.6% |
| + class-aware prev-delta conditional | 54.2% | 23.8% | 21.9% |
| + focus-reserve term, w=3 | 59.9% | 19.4% | 20.7% |
| (same, but shape-matched deck) | 86.6% | 5.2% | 8.2% |

So: **movement model ≈ +35pp. Focus reserve ≈ +5pp. Deck shape ≈ +27pp.**
The last brief's fix is real and worth shipping — third.

**Caveat, stated plainly and not to be glossed over in the recap:** rows 2-4
share their movement model with the simulator's own generator, so they are
optimistic by construction — the same "sim authority is earned per domain"
problem SPEC.md §5 already names. The leave-one-cast-out table above is the
part that is *not* in-sample, and it is the evidence that actually justifies
the work. Treat the Monte Carlo as an ordering of the levers, not as a catch-
rate promise. n=263 transitions / 67 casts is also small; Fact 1 is 263/263
and I'd bet on it, Fact 2's k=2 reversal rate rests on 84 observations and
should be re-checked as the corpus grows.

---

## 1. Build the ring model — first, and in the sim

Add a movement model that encodes Facts 1 and 2. Suggested shape, a new
`src/strategy/fishing/stepClass.ts`, pure per CLAUDE.md's strategy/API split:

```
classifyStep(history): 1 | 2 | null          // null before the first observed hop
ringCells(cell, k, gridSize): Cell[]         // legal Manhattan-k ring
ringDistribution(cell, k, prevDelta, corpusTable, gridSize): Distribution
```

Design notes that matter:

1. **The class is a hard constraint, not a prior.** Once `k` is known, cells
   off the `k`-ring get probability 0, full stop. 263/263 says this is safe.
   Before the first hop, mix the two rings by the observed class prior
   (36/67 vs 31/67).
2. **Condition on previous delta within the class**, backing off to the class
   marginal by the same continuous-shrinkage pattern `contextualFallback.ts`
   already uses (`n/(n+k)`); don't re-invent a second smoothing mechanism.
   `shrinkageK≈2` is what I used; sweep it, the existing
   `scripts/fishingContextualCV.ts` harness already does exactly this kind of
   leave-one-cast-out sweep and should be reused rather than duplicated.
3. **This replaces the fallback tiers, not the matcher.** Keep
   `predictDistribution(matcher)` as tier 0 when live candidates survive — but
   intersect it with the ring, since a surviving candidate that predicts an
   off-ring cell is now provably wrong and should be eliminated. The ring model
   becomes tier 1; `contextualFallback` drops to tier 2; uniform stays last.
4. **Don't delete the synthetic pool yet, but stop treating it as ground
   truth.** `perimeterWalk` matches 8 of 67 real casts on full trajectory
   (cw 4, ccw 4; lengths 1,2,2,2,3,4,5,5) — real but minor, and entirely a
   subset of `k=1`. `patterns.ts`'s `bounceDelta` primitive, by contrast,
   generates moves the real fish never makes, which is a live problem — see §2.

**Gate for §1:** leave-one-cast-out log loss on `data/fish-patterns.jsonl`
must beat the cell+prev-displacement baseline of **2.070**, and top-1 must
beat **40.8%**. My run says 1.123 / 47.4%; if you can't reproduce that, stop
and report the discrepancy rather than proceeding to §2 — a brief's numbers
are a hypothesis (CLAUDE.md §9) and this one is mine, not the corpus's.

---

## 2. Correct the heuristic (d) verdict — it was measured against a wrong sim

Session 44 recorded `pruneReturnToPrevious` as a reproducible ~2pp catch-rate
**regression** (N=20000, two seeds) and traced it to `patterns.ts`'s
`bounceDelta` wall-reflection doing exactly what the heuristic forbids. That
trace was correct and the conclusion drawn from it was backwards: the real
corpus says the heuristic is **exceptionless for k=1 fish — 0 reversals in
112 observations** — and `bounceDelta` is a synthetic primitive that models a
fish this game does not have. The sim was wrong, not the heuristic.

Two consequences:

- **Gate (d) on the step class rather than removing it.** It is correct and
  free for `k=1`, and actively harmful for `k=2`, where reversal is the single
  most likely move at 41.7%. The current implementation already checks
  `|prev.dx| + |prev.dy| === 1`, which is the *displacement's* Manhattan
  length, not the *class* — for a k=2 fish that guard is simply never true, so
  today it silently no-ops on exactly the class where the opposite rule
  applies. Once §1 exists, express both directions through the conditional
  table and this heuristic becomes redundant; that is the preferred end state.
- **Fix `patterns.ts`'s standing in the codebase.** Its header already says
  "never use this library to drive live card choice", and
  `data/minedFishPatterns.json`'s two promoted patterns are the one path where
  it does. Keep the perimeter candidates (they're real), but stop using
  `buildPatternPool()` as the sim's ground-truth generator — replace the sim's
  fish with a sampler over the empirical ring/conditional table, which is what
  makes every sim number below trustworthy.

---

## 3. The focus-reserve term — keep it, third, with a measured starting range

Everything the previous brief said about the mechanism is correct and worth
re-reading: `bestFocusForCard` (`cardChoice.ts:136-217`) searches
`reachableCells(...)` and takes argmax raw `ev`; movement cost is consulted
only inside the `EV_TIE_EPSILON = 1e-9` tie-break, which real EV differences
essentially never hit. The 3-point budget is gone by turn 2-4 and the rest of
the cast plays from a frozen cell. Confirmed live 16/16, sim 43%/N=300, and
visible turn by turn in `cast-2026-08-19-00-55-15`: focus (2,2)→(2,3)→(3,3)→
(3,2), meter 3→2→1→0 by turn 3, then six turns frozen at (3,2) while the fish
cycled (1,3)↔(2,2)↔(2,4) and the meter ran 13→21.

That same cast is also the cleanest illustration of why §1 comes first: the
fish never left `{(1,3),(2,2),(2,4)}`, and **focus parked at (2,3) covers all
three of those cells** — zones 4, 2 and 8 respectively, i.e. a single
`{2,4,6,8}` card (id 79, in that very deck) hits every turn for the whole
cast. A correct movement model finds that placement on turn 2. No amount of
reserve weighting finds it, because the reserve term only decides *how much*
to move, never *where*.

Implement the reserve term as the previous brief specified — the shape is
right and mirrors the dungeon side's `chargeReserveWeight` precedent:

```
reserveFraction = max(0, focusBudget.remaining − manhattan(current, focus)) / FOCUS_METER_MAX
score(card, focus) = ev(card, focus) + focusReserveWeight * reserveFraction
```

Use `score` as the primary key in `bestFocusForCard` and `isPreferred`; keep
raw `ev` for `isLethal`, `isManaConstrained`, and reporting.

My sweep against the real deck, with the §1 model in place, N=4000:

| w | 0 | 0.5 | 1 | 2 | 3 | 4 | 6 | 8 |
|---|---|---|---|---|---|---|---|---|
| catch rate | 32.2% | 33.3% | 34.1% | 34.9% | **36.9%** | **37.1%** | 36.6% | 32.1% |

The same inverted-U with a plateau the dungeon side found, plateau at **3-4**,
collapsing past 6. Sweep it yourself in `scripts/focusReserveAblation.ts`
(mirror `scripts/chargeReserveAblation.ts`'s structure) rather than taking
3.5 on my word — but note the range brackets card `hitEffect` magnitudes, which
is the sanity check the previous brief asked for and it passes.

**Skip the 2-ply lookahead.** I tested a one-step focus lookahead against the
flat reserve term at matched N: lookahead 32.4% vs. flat-reserve 33.6% vs.
no-term 29.2%. The flat term captures the effect; the lookahead costs a large
constant factor in the inner loop for nothing. Not worth building.

**Also worth a cheap test while you're in here:** the previous brief's hard-cap
sanity check (refuse any move costing >1 unless lethal or the only option) is
still a good 20-minute experiment, and now it has a proper model to run
against.

---

## 4. Deck composition — the largest lever, and currently unowned

Isolating shape from damage in the sim (ring model, focus 3, N=3000):

| deck | catch rate |
|---|---|
| real deck `[1,2,3,4,5,6,7,76,77,79]` | 32.2% |
| high damage, wrong shape (rows/cols, 8 dmg) | 45.9% |
| low damage, right shape (ring-8 id 76, 3 dmg) | 35.9% |
| shape-matched mid (X id 7 / plus id 79 / ring-8 id 76) | **55.5%** |
| shape-matched high (ids 108 / 107 / 25) | **79.0%** |

`chooseNewCard` (`cardChoice.ts:346`) picks `max(hitEffect, critEffect)/manaCost`
— pure damage efficiency, blind to zone shape, and its own doc comment already
flags this as an unvalidated placeholder. With Fact 1 in hand it can be
scored properly: value a card by its expected hit rate against the two rings
at the placements the policy actually reaches, times its damage. Concretely,
`{2,4,6,8}` and `{1,3,7,9}` and ring-8 should dominate row/column triples, and
the `crit {5}`-only cards (ids 10, 77, 78, 90, 100, 110) are close to dead
weight — the fish moves every turn, so zone 5 is only ever live when focus sits
on a *predicted destination*, which is a much rarer placement than their EV
suggests.

This is a real task but it is **not** this session's priority — it only pays
off across many catches, and there are no catches yet. Do §1 first. Note it in
TASKS.md so it doesn't get lost.

---

## 5. Live validation — only after §1's gate, and small

Unchanged from the previous brief and still right, per CLAUDE.md §4:

1. Do not spend live fishing energy until §1 clears its leave-one-cast-out
   gate and the sim shows a real lift over the 19.5% baseline.
2. Then wire the model through as a real parameter (same threading pattern as
   `heuristicsEnabled` in sessions 43/44), not a magic constant in
   `cardChoice.ts`.
3. Spend **5-10 casts**, not the daily budget. Report today's batch separately
   from the all-time cumulative figure. At n=8, anything from 0 to 4 catches is
   consistent with a 30% true rate — say so in the recap rather than declaring
   a verdict the sample can't support.
4. `data/nextPositionValidation.jsonl` already exists and has the right shape
   (2 rows). Log a predicted-vs-actual row for **every** turn of the batch, and
   report the realized top-1 accuracy against the 47.4% the corpus predicts.
   That single number tells you whether §1 transferred, independently of how
   the catch-rate coin flips landed.

## 6. Stretch, only if §1-§3 land

- Graceful SIGINT in `liveRun.ts` / `liveFishing.ts` `main()` (TASKS.md Task
  10; `orchestrator.ts` has the working pattern).
- Resume the cast left mid-play at turn 3 (`docId 12975755`) before starting
  anything that touches active-cast state.
- The first turn of a cast is an identification turn — the class is unknown
  until the fish's first hop resolves. `fullDeck` contains ids 16 and 17
  (all-9 zones, **no miss penalty at all**), which are free probes: nonzero
  damage, zero meter risk. Worth checking whether forcing one of those on turn
  1 when held beats the greedy pick. Small, cheap, plausibly real.

---

## Your task

1. Re-derive §0's numbers yourself from `data/fish-patterns.jsonl` and
   `fixtures/fishing-casts/cards.json` before writing any strategy code. Write
   the check as `scripts/auditStepClass.ts` so it re-runs as the corpus grows.
   If the corpus contradicts me, the corpus wins and the brief does not get
   implemented as stated (CLAUDE.md §9).
2. §1 — build the ring/conditional movement model, gate it on leave-one-cast-
   out log loss < 2.070 and top-1 > 40.8%.
3. §2 — replace the sim's synthetic fish generator with an empirical sampler,
   then re-run session 44's heuristic (d) ablation against it and correct the
   record in SPEC-fishing.md §8 either way.
4. §3 — implement and sweep `focusReserveWeight` on top of the new model.
5. §5 — live-validate small, only after the gates, reporting the batch
   separately.
6. Report the numbers plainly in STATE.md, including any that come in below
   what this brief projects. My Monte Carlo is optimistic by construction and
   said so in §0; a smaller real lift is a result, not a failure.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit.
