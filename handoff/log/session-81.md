# session 81 — 2026-08-22 — the matcher costed, and the crit rule cut to two

**GATE 1 PASS. GATE 2 PASS.** Suite 1573/1573, 95 files. Commits `aa912662`,
`e7dd1f97`, `2981e4ea`.

---

## 0. What the brief asked for, and what was actually missing

The brief's §1a asked me to "pin the resolver at 581/581" as new work. **That
test has existed since session 47.** `src/sim/fishing/zoneAudit.ts` +
`scripts/auditZoneTemplate.ts` + `tests/fishing/zoneTemplate.test.ts` already
scored the hit resolver against the server's own verdict on every recorded
play, and already reported exceptionless.

So the honest reading of gate 1 was: the *substance* is done, and two real
things are missing.

1. **The count was `>= 282`**, and had been for thirty-four sessions. That
   assertion cannot distinguish "the corpus grew" from "the predicate silently
   narrowed" — precisely the failure mode session 80 spent a session on.
2. **Nothing checked the OTHER axis.** The zone template says where a zone
   *lands*. It says nothing about which two states a shot is resolved
   *between*, and both states in a transition carry a `focusPoint` and a
   `fishPosition`. That choice was implicit in a call site and unexamined.

Gate 1 was met by fixing those two, not by rebuilding what existed.

### 0a. The brief's 581 does not reproduce, and I stopped hunting it

Reported at the top of the session as the gate instructed. The true count under
the full predicate was **590** (now 612 after the live batch). Neighbours it is
not:

```
  all plays (the predicate zoneAudit actually uses)   590
  clean traces only                                   587
  the brief's own stated predicate (discard-diff)     583
  lastMovePath present                                590
  non-terminal plays                                  461
```

The brief's §4 stated its predicate as *"exactly one card left the hand into
the discard"*. Implemented literally that gives **583**, not 581. Time-boxed
and abandoned — session 80 lost real time to the same shape, and the brief's own
§0 called that its author's error. **Every count in the new code now ships with
the filter that produced it, written out in words in the test.**

Useful byproduct: implementing the discard predicate cross-validated the card
identification. Discard set-difference vs `play.handIndex` — **583 agree, 0
disagree**, the remaining 7 being refill boundaries where the discard moved by
something other than one card.

---

## 1. GATE 1 — the wire semantics (SPEC-fishing §4d)

`RESOLUTION_READINGS` in `zoneAudit.ts` makes the state-pair choice selectable,
so the alternatives are scored rather than assumed away. `a` = state before the
play, `b` = after:

```
  b.focusPoint + b.fishPosition           612/612  100.0%   <- the server's
  a.focusPoint + b.fishPosition           480/612   78.4%
  a.focusPoint + a.fishPosition           385/612   62.9%
  b.focusPoint + b.previousFishPosition   380/612   62.1%
```

**A card resolves against the focus point AFTER the move and the fish's cell in
the RESULTING state.** The fish moves first and the shot lands where it moved
to, which is what makes fishing a one-step-ahead PREDICTION problem — and
therefore what makes gate 2's oracle a ceiling below 100% rather than at it.

**The wrong readings are dangerous for where they land, not for failing.**
62–79% is the band in which a convention error looks like a working model and
survives review. `previousFishPosition` is the specific trap: it reads as
"where the fish was when you aimed", and `movePathAudit.ts` uses it *correctly*
for path continuity, so its presence in the codebase is not itself a smell.

The test asserts all four exact scores and **that the pin fails under the
`previousFishPosition` reading** (`expect(prevFish.correct).not.toBe(...)`,
plus `mismatches.length === 232`). The gate asked for this demonstration
explicitly, and it is the right ask: a pin that does not fail the wrong reading
has not tested anything.

---

## 2. GATE 2 — the matcher headroom

`src/sim/fishing/matcherHeadroom.ts` + `scripts/matcherHeadroom.ts` + 9 tests.
Four policies over the same plays, same cards, same focus budget; only the
aiming rule differs.

```
  RANDOM    uniform over reachable focus    20.3%   floor — no prediction
  STAY-PUT  never move the focus            24.2%   what the zones alone give
  ACTUAL    the shipped bot                 36.3%
  ORACLE    same card, best focus           66.3%   ceiling for prediction
  ORACLE    best card in hand + best focus  71.1%   + free card selection
```

- captures **34.6%** of available prediction headroom, `(36.3−20.3)/(66.3−20.3)`
- **30.1pp** of hit rate remain with today's cards and budget
- card SELECTION worth a further **4.7pp** — the smaller prize
- focus MOVEMENT worth **12.1pp** over never moving → **prediction is
  load-bearing**, which answers the brief's §5 first question directly. Had
  stay-put landed near 35%, the matcher's movement decisions would have been
  adding nothing.

RANDOM is the exact expectation (fraction of reachable cells that would have
hit), not sampled — no seed, no noise.

**ACTUAL is the only row a code change can move.** The rest depend on the
cards, the board and the budget. That is what makes this a scoreboard, and a
change that moves a ceiling is a harness bug rather than an improvement.

The oracles use knowledge no policy has at decision time. **Ceiling to score
against, never a policy to ship** (rule 4).

---

## 3. The focus budget was wrong, and an assertion I wrote caught it (SPEC-fishing §4e)

I wrote `assertHeadroomSelfConsistent` to throw on two invariants, in the
spirit of `damageEconomy.ts`'s `assertShotsAccountedFor`. It fired immediately
under the obvious budget model:

```
  naive budget = prev.focusMeter
    plays firing from a focus outside the modelled reach   12
    server-scored HITS the oracle calls unhittable          6   <- ceiling below its own floor
```

**Diagnosed to completion rather than filtered.** The budget identity
`spent + remaining == prev.focusMeter` holds on **591 of 591** non-oil plays
and fails on exactly **21** — and every one of the 21 is an oil consume
(`consumablesUsed` increments across the same transition). **Zero residue.**

The cause is a capture convention, not a game rule: `castTrace.ts` skips
`use_fishing_item` responses (they re-report their predecessor's state, and
counting them breaks position continuity and drops the whole cast — session
64). So a Focus Oil restores the meter *between* two recorded turns and the
trace shows it rise with no local cause. **That file's header already said so;
§4e is what it costs downstream.**

Fix: reconstruct the budget from the transition —
`manhattan(a.focusPoint, b.focusPoint) + b.focusMeter`. Exact on every play
including oil turns, and self-consistent by construction. The naive model is
kept in the test as the scored counter-model.

### What the oil turns do NOT settle

All 21 consumes recover a budget of exactly **2**, and all 21 fired at a meter
reading **0** — where restore-to-2 and add-2 are the same event. The corpus
cannot separate them.

**The static table breaks the tie and points at add-2.** SPEC-fishing §4a's
`gameItems[]` declares `FishingRestoreFocus` as an AMOUNT per tier — Lil 1 /
Mid 2 / Big 3 — and `config/bot.json` spends item **942**, the MID Focus Oil,
whose amount is exactly the 2 observed. Under restore-to-2 the tiering would
carry no meaning. Recorded, **not encoded**: the reconstruction reads the budget
off the transition and never needs to know. A Lil/Big consume, or any consume
at a non-zero meter, confirms it outright.

Same shape as session 80's `mana -= card.manaCost`, still open for the same
reason — one arm of the distinction has never been exercised.

---

## 4. A live-policy defect, found by pinning rather than tolerating

I asserted "every scored play has a measurable footprint". **It failed.**

```
  plays with NO on-grid footprint    23 / 612  (3.8%)
    of those, hits                    0        (structurally impossible)
    avoidable with the SAME card      6
    cards implicated                  1, 3, 4, 6
```

Card 1's `hitZones` are `[1,2,3]` — the whole top row of the 3×3 template — so
firing it from grid row 1 puts every zone at row 0, off-board. The shot could
not have hit whatever the fish did.

**A wasted play is invisible in the hit rate: it looks exactly like a bad
prediction, and it is not one.** 6 of the 23 were avoidable with the same card
from a different reachable focus, so they are not forced by the hand.

**REPORTED, NOT FIXED.** This is a live-policy change and rule 4 puts it behind
a gate of its own.

---

## 5. §2 — the margin column

`scripts/damageEconomy.ts` now prints `h* = heal/(damage+heal)` and
`margin = hit% − h*`:

```
                   plays    hit%     dmg   heal      h*    margin     drift
  LIVE (corpus)      587    35.6    5.06   3.02    37.4    -1.8pp    +0.145
  SIM bare         13294    80.8    5.01   3.20    38.9   +41.9pp    -3.437
  SIM blind         7641    42.7    3.66   3.28    47.3    -4.6pp    +0.317
  SIM live-config  16518    42.5    4.94   3.11    38.6    +3.8pp    -0.309
```

Reproduces the brief's §2 table. The output now states in place that **matching
the sign of the drift is not matching the mechanism** — the blind arm clears
zero because its damage is low, not because its hit rate resembles live's — and
marks the bare arm with its +41.9pp so §0a's figures are not re-quoted by
accident. It also states the admissibility gate the brief proposed: *an arm
becomes admissible when its margin brackets live's within a stated band; none
currently does.*

---

## 6. §5 — the aim-error distribution

Measured from the shot's own footprint (how far off the aim was), not from the
focus point (how far away the fish was):

```
  aim error on MISSES
    1   176   48.0%   ##############
    2   140   38.1%   ###########
    3    42   11.4%   ###
    4     9    2.5%   #
```

**The satisfying result the brief hoped for: the miss is STRUCTURED.** 48% of
misses land one cell from the footprint, 86% within two. The matcher is nearly
right, which points at a better tie-break rather than a new model.

The fraction was **48.0% before the live batch and 48.0% after** — the shape is
not an artefact of the sample.

---

## 7. §6 — eight live casts, and the third crit anomaly

User-authorised: the full remaining allowance, played in two batches of 4 with
a `checkFishingCaps.ts` ledger check between (rule 13). Ledgers agree at
**20/20**. 6 catches in 8 casts; 4 casts consumed oil. No dungeon runs.

### THE RESULT: `floor(hit × 5/3)` is falsified

Cast `13041474` turn 2:

```
  card 38   hitZones [1,3,7,9]  critZones [5]   hitEffects 3   critEffects 9
  focus [4,3], fish [4,3]  -> zone 5 -> the card's OWN crit fired, base 9
  fishHp 12 -> 0            server FISH_HP_DIFF = 14

    x1.5 round-half-up   9 -> 14   survives
    x1.6 rounded         9 -> 14   survives
    floor(9 x 5/3)       9 -> 15   FALSIFIED
```

**Two rules survive, not three.** Two details make this usable where a careless
reading discards it:

- **It is LETHAL** (12 → 0). The clamped state delta is 12 and says only
  "≥ 12", which separates nothing. Only the server's uncensored `FISH_HP_DIFF`
  carries the information. **On a lethal blow the clamped view is useless.**
- **The base is the card's CRIT amount, not its hit amount.** Session 80
  searched `hitEffects` for a 9, found none in the deck, and DECISIONS recorded
  that "more casting alone will not get there". The lure scales *whatever the
  shot's damage would have been* — `hitEffects` on an ordinary hit,
  `critEffects` on a crit-zone hit. Base-9 crits are common (cards 38, 39, 40),
  so the reachable pool was always far larger than the one being searched.

**The two crit sources COMPOSE.** This shot was both a card crit and a lure
crit: the card set the base, the lure scaled it. `cardChoice.ts` still models
only the card's half.

Found because session 68 pinned the anomaly as an EXACT list rather than a
tolerance — **the third time that decision has paid.**

### The remaining separator

```
  base 6:   x1.5 -> 9    x1.6 -> 10
  base 8:   x1.5 -> 12   x1.6 -> 13
  base 10:  x1.5 -> 15   x1.6 -> 16
```

**Card 10 crits for 10 and is in the deck being played.** The last two rules are
separable by ordinary casting. Still do not encode a multiplier until one is
eliminated.

### Both gates held on data they had never seen

This is the part worth trusting more than the gates themselves. Both were
pinned *before* the batch:

```
  resolver          590/590  ->  612/612   still exceptionless over 22 new plays
  random             20.4%   ->   20.3%
  stay-put           23.7%   ->   24.2%
  actual             35.4%   ->   36.3%
  oracle same-card   65.6%   ->   66.3%
  oracle best-card   70.5%   ->   71.1%
  aim-error at d=1   48.0%   ->   48.0%
  budget identity    0 non-oil failures -> 0 non-oil failures (3 new oil consumes)
  no-footprint       23      ->   23      (no new offending card)
```

### Corpus movement

140 → **148 casts**, 799 → **839 response docs**, 591 → **613 play turns**,
42 → **48 catches**, oil-era casts 19 → **23**.

`13041480` is the second lethal-trigger Relaxing consume on record (fish at
1/15, one oil, CAUGHT) — confirms the mechanism again, calibrates no rate.

75% catch rate on n=8 is the highest batch on record. **It is a sample of eight
and is not evidence of a change.**

### Oil reachability — a softening, not a finding

The relaxing NUMERATOR did not move at all across 8 casts (still 13 casts / 15
decision points); the rate fell 9.286% → 8.784% on the denominator alone.
Session 80 retired "only the denominator grows" after one observation moved the
numerator. **Two batches now say the numerator moves *rarely*** — weaker than
either previous version and better supported than both. The lax-vs-strict gap
moved 16 → 17 (`13041476`, escaped, so the caught-in-gap pair is undisturbed).

---

## 8. Verification (final commit)

```
  npx tsc --noEmit                        clean
  npx vitest run                          1573 passed, 95 files  (was 1561)
  npx tsx scripts/assertionCoverage.ts    1573 counted, 0 vacuous
  npx vitest run discoveredShipsClean     8 passed
  git diff --check                        clean
  secret scan over dc1ff346..HEAD         no matches
  redaction spot-check                    40x 0xUSER, no raw addresses
  npx tsx scripts/checkFishingCaps.ts     ledgers agree 20/20
  npx tsx scripts/checkDungeonToday.ts    dungeonId 5 today: null (0 runs)
```

## 9. Surprises worth carrying forward

1. **The gate asked for work that already existed.** Checking before building
   turned gate 1 from a rebuild into two real gaps. Worth doing first every
   time.
2. **Two of the three most valuable findings came from assertions failing.**
   The no-footprint plays and the oil focus-restore were both discovered
   because I pinned something I believed instead of tolerating it. Neither was
   being looked for.
3. **A denominator discrepancy appeared for the second session running** (543
   then, 581 now). The cure landed this time: predicates written out in words,
   in the test, next to the number.
4. **"No card deals 9" was true and useless.** The wrong field was being
   searched. When a search comes up empty, check the search space before
   concluding the thing is unreachable.
