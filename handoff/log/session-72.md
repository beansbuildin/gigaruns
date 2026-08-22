# session 72 — 2026-08-21 (PT) — GATE 1 PASS / GATE 2 PASS

Brief: `handoff/next.md` (written 17:15 PT). Commits `b30bb2e`, `d6b0af1`,
`9f4e2f7`, `9064d6e`, `7557752`.

Everything in `STATE.md` applies. This file carries the full outputs and the
things that did not fit.

---

## §0 The ledgers, read before anything was spent

```
doctor:   token valid 161.6h; dungeon 0 runs/0 energy; fishing 15 casts/180 energy
game:     dayDocs[pondId 2] = 16 / 20    dayDocs[pondId 1] = 0
repo:     15 casts, 180 energy
          LEDGERS DISAGREE: game 16 vs repo 15 — deferring to the game
dungeon:  dayProgressEntities for dungeon 5 = null / []   (0 of 12)
```

The 15-vs-16 gap is the known session-70 case (docId `13024510` charged energy
without ticking `dayDocs`). The reconciler deferred to the game in the safe
direction, as designed. **VERDICT: 4 casts available.**

---

## §1 GATE 1 — the oil hypothesis

### What the sim arm actually does

`scripts/focusProfileCheck.ts:271-279` builds both arms as

```ts
const empiricalMined = { empiricalFish: { table }, matcherPool: minedPool, deckIds: [...REAL_DECK] };
const live      = simProfile("SIM — live config …", { ...empiricalMined, blindFallback: LIVE_FALLBACK }, runs);
const synthetic = simProfile("SIM — bare default …", { deckIds: [...REAL_DECK] }, runs);
```

No `oils` key on either. `castSim`'s own doc comment on the option: *"Opt-in and
additive — omitted, the sim is byte-for-byte the sim it has always been."* Every
oil branch guards on `if (opts.oils)`. So `oilsUsed` comes back `[]` and the
24.7% was a no-oil simulator. The script proves it at runtime by printing
`mean oils/cast` on both arms; the OFF arm must read 0.00.

### The full run, after the batch

```
── §2  TODAY'S ERA, SPLIT BY OIL ARM ──
  arm            caught/n      rate    95% Wilson         oils spent
  non-oil        10/23          43.5%  [25.6%, 63.2%]      0
  oil            11/14          78.6%  [52.4%, 92.4%]     19
  policy-dry     2/2           100.0%  [34.2%, 100.0%]     3
  POOLED         23/39          59.0%  [43.4%, 72.9%]      (session 71's 60.0%)

── §3  THE LIKE-FOR-LIKE TABLE ──
  no-oil     43.5% (10/23)   [25.6%, 63.2%]    26.5% (n=4000)   -17.0pp  INSIDE
  oil        78.6% (11/14)   [52.4%, 92.4%]    50.1% (n=4000)   -28.5pp  OUTSIDE
  mean oils/cast — sim OFF 0.00   sim ON 1.16   live oil arm 1.36
  meter-out      — sim OFF 33.2%  sim ON 32.8%
```

Before the batch it read: non-oil 9/21 = 42.9% [24.5%, 63.5%] against sim 24.7%
— **a 0.2pp margin.** The batch moved it to 0.9pp. Both are thin.

### The sim's oil arm, and what it is matched to

`config/bot.json`'s `dendren.oils` is Focus (942) uncapped, Relaxing (937)
capped at 2 per cast, `maxPerCast: 3`. `castSim` has no per-item or combined
per-cast cap, so the arm expresses this as **holdings**: `relaxingOilHeld: 2`
(exact — a cast cannot spend what it does not hold), `focusOilHeld: 3` (the
board's own 3-slot ceiling), `costsTurn: MEASURED_CONSUME_COSTS_TURN` (false),
`capFocusRestore: true` (the conservative branch). `mean oils/cast` is printed
so a breach of the 3-slot ceiling would be visible rather than assumed away —
sim ON came out at 1.16 against live's 1.36, so the arms are comparable on spend.

### Why the oil row is weak in both directions

`castSim`'s oil block is **MODELLED, NOT OBSERVED**. No cast in the corpus
supplies an oil outcome, so the block encodes the item payloads
(`FishingRestoreFocus` +2, `FishingDamageFish` +2) and nothing measured. The
no-oil row compares two things that were both actually played; the oil row
compares a real arm against an assumption. They are not the same strength of
evidence and the script says so on every run.

---

## §2 GATE 2 — the redraw trigger

### The correction to the brief, and why it is structural

The brief §2b: *"Use era-matched replay, not `castSim` — it is the instrument
that passed."* The replay **cannot score a redraw's consequence.** From
`offPolicyReplay.ts`'s own header and `castTrace.ts`'s `newHand`:

- `fullDeck` is a canonical sorted list; **0 of 56 refills and 1 of 69 opening
  hands** match a slice of it. The draw pile is a server-side shuffle that never
  appears on the wire.
- The replay's entire licence to refill is: *"across all 282 recorded plays,
  with zero exceptions, a play removes exactly one card by hand index and the
  hand refills to 3 exactly when it empties. Since every turn plays exactly one
  card, a counterfactual policy empties the hand on the SAME turn no matter
  which card it picks."*

A redraw discards three cards at a turn the record never refilled at. It is
precisely the move that breaks the invariant. So the work split by instrument:
replay for **when** the trigger fires, `castSim` for **what it is worth**, each
labelled in the output.

### The derivation

`shouldRedraw` tests `best.ev < REDRAW_THRESHOLD`. `chooseCard` stopped
maximizing EV in session 13 and picks for hit probability, so a card can be the
right pick and carry a legitimately low EV. Tuning the constant cannot fix a
currency mismatch — it can only move where the mismatch bites.

    fire  <=>  pConnect < pFresh − manaPrice

- `pConnect` = `choice.pHit + choice.pCrit`, the connect probability of the play
  the policy is about to make.
- `pFresh` = **0.4897**, mean `pConnect` on freshly-dealt hands (`handSize === 3`,
  n=50), measured on today's era.
- `manaPrice` = `3/10 × pFresh` = **0.1469** — a 3-card redraw is 3 of a
  10-mana cast. Expressed as a fraction of `pFresh` rather than an absolute so
  it scales with the fishery instead of being a second free constant.
- **THRESHOLD = 0.3428.**

### Is `pConnect` calibrated? (the precondition)

```
  pConnect bucket    turns   predicted   observed hit   95% Wilson
  [0.00, 0.10)        11        2.6%           0.0%   [0.0%, 25.9%]
  [0.10, 0.20)         3       16.7%           0.0%   [0.0%, 56.2%]
  [0.20, 0.30)         7       25.6%          14.3%   [2.6%, 51.3%]
  [0.30, 0.50)        39       39.1%          33.3%   [20.6%, 49.0%]
  [0.50, 1.01)        58       71.0%          56.9%   [44.1%, 68.8%]
  OVERALL            118       50.0%          39.8%
```

Monotone — good enough to threshold on. **Optimistic in every bucket**, which
is a finding about the policy's distribution, not about redraw, and is open.

### Fire rates and the split

```
    NEVER degeneracy         t=0.0000   fires on   0.0% of turns
    derived                  t=0.3428   fires on  25.4% of turns
    pFresh (no mana price)   t=0.4897   fires on  50.8% of turns
    ALWAYS degeneracy        t=2.0000   fires on 100.0% of turns

  the split it makes, on REALIZED hits:
    would redraw    30 turns   observed hit 10.0%  [3.5%, 25.6%]
    would play      88 turns   observed hit 50.0%  [39.8%, 60.2%]
```

Non-overlapping intervals — which is exactly the result the brief said to be
suspicious of, so:

### The confound

A low `pConnect` has two causes: a bad HAND (a redraw fixes it) or a flat
DISTRIBUTION (nothing fixes it, and the redraw burns 3 mana for the same shot).
`pConnect` cannot tell them apart, and a trigger that fires on the second is the
1.29-turns-per-cast failure with a new number on it. `ReplayTurn.pConnectCeiling`
runs the SAME `chooseCard` over the whole deck instead of the hand:

```
  group                turns   mean pConnect   mean ceiling   mean headroom
  would redraw          30          0.1837         0.5781          0.3944
  would play            88          0.6080         0.7785          0.1705
  ALL                  118          0.5001         0.7275          0.2274

  Of the 30 turns the derived threshold fires on, 9 have headroom BELOW the
  mana price (0.1469) — 30.0% of firings spent on case (b).
```

The ceiling picks the best card in the whole deck where a real redraw deals
three at random, so **the true wasted share is higher than 30%, not lower.**

### The verdict

```
  threshold        catch    mana/cast on redraws   escaped_mana   turns/cast   mana per extra fish
  NEVER (0)       24.8%                   0.00          18.8%         6.17   n/a
  derived (0.343) 26.2%                   3.68          39.8%         4.38   263.0
  pFresh (0.490)  26.4%                   4.70          47.7%         4.01   289.3
  ALWAYS (2)       0.0%                   9.00         100.0%         1.00   n/a
```

+1.4pp is **1.4 standard errors** at n=4000 — not distinguishable from zero —
for **263 mana per extra fish against a cast holding 10 in total.** And the
failure DIRECTION is the recorded one: mana exhaustion replacing meter
exhaustion. The new trigger fires four times less often than the old and still
lands there, which says the problem was never only the currency. A redraw costs
30% of the mana budget and a fresh 3-card hand is not 30% better.

**RECOMMENDATION: ship nothing.** `redrawEnabled` stays false,
`REDRAW_THRESHOLD` untouched. `shouldRedrawOnConnect` stands as the correct
question with a measured negative answer, which is worth more than an
uncalibrated constant.

### The pins, demonstrated

Two levels, because a degeneracy can hide at either. The predicate pin alone
would pass a policy that ignored it; the outcome pin alone would pass a
predicate with a hidden off-by-one.

**DEMO 1 — NEVER broken (`<` → `<=`), 2 tests fail:**
```
× NEVER: a threshold of 0 cannot fire, at any connect probability
  AssertionError: pConnect 0 fired at the never-threshold: expected true to be false
× NEVER spends no mana on redraws at all, and does not exhaust mana
  AssertionError: expected 2.04 to be +0
```

**DEMO 2 — ALWAYS broken (threshold clamped to ≤1), 1 test fails:**
```
× ALWAYS: a threshold of 2 fires at every connect probability, mana permitting
  AssertionError: pConnect 1 did not fire at the always-threshold: expected false to be true
```

Restored: **7/7 pass.** The ALWAYS outcome pin asserts `escapedMana > 0.78` and
`turnsPerCast < 1.29` against `cardChoice.ts` §5's recorded disaster; the
harness reproduces **100% at 1.00**, i.e. strictly worse, as it must be since
the always-threshold is strictly more aggressive than the one that produced
those numbers.

---

## §3 The batch

Four casts, the day's remaining allowance. Policy unchanged.

| # | outcome | turns | oils |
|---|---|---|---|
| 1 | escaped | 2 | — |
| 2 | escaped | 10 | 2 × Focus (942), turns 4 and 6 |
| 3 | **caught** | 2 | 1 × Relaxing (937), lethal trigger at fishHp 2/21 |
| 4 | **caught** | 2 | — |

**Rule 13, read after:** game `dayDocs[2]` **16 → 20**, exactly the 4 sent;
repo agrees at 20. `VERDICT: BLOCKED — cap spent.` No discrepancy this time.

Running rate for today's era: **23/39 = 59.0%, [43.4%, 72.9%]**, from 21/35 =
60.0% [43.6%, 74.4%]. Interval 30.8pp → 29.5pp. Not read as progress — 2/4 is
the running rate, and session 62's arithmetic (best 5-cast window in the whole
corpus is 3/5, the max over 85 overlapping windows) still holds.

### §3a — the bundle change

Oil stock is now **Relaxing 48 / Focus 11.** `config/bot.json`'s own note
describes the prior state as *"the user holds a few oils, fewer than a batch
needs, and on-demand spends ~0.70/cast, so stock runs out MID-batch"* — and
that is what **produced** the `policy-dry` arm. With 48 held the policy cannot
run dry, so casts that would have landed in `policy-dry` now land in the oil
arm instead.

Not one of §3a's four named bundle members (rod, lures, zone map, matcher
weighting), and not an era break. Recorded at the point it happened because
gate 1's whole argument rests on that three-way split.

### Two comments I wrote before checking

I recorded `13025987`'s two consumables as "the Relaxing per-cast cap of 2
binding for the first time on record", in two test files. Checked against
`logs/fishing-2026-08-22-00-55-26.jsonl`: both were **Focus oil (942)**, fired
by the meter-zero trigger on turns 4 and 6. **The Relaxing cap did not bind and
still never has.** Corrected in both files before the commit. This is the same
shape of error as the brief's §8 through-line — a plausible frame accepted
without asking what the number was computed over.

---

## §4 costCap

Recorded in `DECISIONS.md` and in `focusBudget.ts`'s own header, because session
71 left the open question *in that header* and answering it only in DECISIONS
would leave the question standing where the next reader looks.

- **`costCap` is inert because the policy does not need it.** Today's policy
  spends **0.83** of a 3-point meter on the opener, so `costCap(2)` has nothing
  to bind on and `focusBudgetSweep.ts`'s `+0/−0` is the correct reading. The
  user's opening-turn directive is substantially already satisfied.
- **`schedule` is not covered by that.** The meter still empties in **34.3%** of
  casts, including the cast the user watched reach 0/3 by turn 3. That is a
  CUMULATIVE drain across turns; `costCap` bounds a single move and cannot
  price it. If any focus arm is worth a session, it is `schedule`.

---

## Corpus pin maintenance

Adding 4 casts broke 12 assertions across 4 files. All updated to the new
figures with the move recorded inline, following the session-68/69 convention.
**No assertion was loosened**; every one is still an exact equality or a
tightened `toBeCloseTo`.

| file | pin | 124-cast | 128-cast |
|---|---|---|---|
| `fishingCorpus` | casts / responseDocs / playTurns / caught / escaped | 124/696/521/34/89 | 128/721/537/36/91 |
| `fishingCorpus` | oil cast ids | 14 | 16 (+`13025987`, `13025990`) |
| `zoneTemplate` | traces / clean / playTurns / caught | 124/123/517/34 | 128/127/533/36 |
| `stateFields` | `oilSkipped` / `corrected.crits` | 11 / 22 | 13 / 24 |
| `oilReachability` | casts / decisionPoints / focusReachable / eitherReachable / neitherReachable / totalFocusPoints | 124/531/64/69/55/197 | 128/549/65/70/58/199 |
| `oilReachability` | lax focusReachable / lax−strict relaxing | 80 / 10 | 81 / 11 |
| `oilReachability` | reachable % / gained % | 9.7 / 1.61 | 9.375 / 1.5625 |
| `oilReachability` | caught / escaped / terminalMeterZero / alreadyStrict | 34/90/67/53 | 36/92/68/54 |

The reachability NUMERATORS did not move: `reachable` is still 12 and `gained`
is still 2 across both the session-69 and session-72 batches. Only the
denominator grows, which is the point of quoting them as fractions.

---

## Verification at the final commit

```
npx tsc --noEmit                      clean
npx vitest run                        83 files, 1375 passed (1368 → 1375, +7)
git diff --check main..HEAD           clean
secret scan (0x…, noobId, eyJ, PRIVATE, .secrets)   clean
tests/discoveredShipsClean.test.ts    8/8
new fixtures: 0 raw identifiers, 25 redaction markers
```

No test writes a real data path: the two new constructions
(`tests/fishing/redrawTrigger.test.ts`) call `simulateCast` only, which takes a
seed and a deck and touches no filesystem.

---

## Surprises worth keeping

1. **The most alarming number in session 71's recap was an artefact of the same
   defect session 71 had just corrected.** It split the corpus by era, then
   pooled the oil arms inside the era it kept. Pooling has now invalidated four
   analyses in this repo.
2. **A "not refuted" verdict can pass by 0.2pp.** Gate 1's PASS is real and it
   is also one escaped cast away from failing. The script prints the margin
   beside the verdict for exactly this reason.
3. **The replay's greatest strength is what makes it blind to redraw.** The
   one-card-per-turn invariant is why refills are exact; it is also why a
   redraw cannot be replayed. A strength and a limit that are the same fact.
4. **The re-derivation was right and the answer was still no.** Asking a better
   question does not guarantee a better answer, and the honest outcome of a
   session's main build can be "do not ship this".
