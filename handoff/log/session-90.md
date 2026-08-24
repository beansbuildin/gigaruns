# session 90 — 2026-08-24 — wire the double-lethal oil trigger, finish the pin sweep, build the redraw shadow — GATE PASS

Brief: `handoff/next.md` (session 90). Four items, all delivered. **Zero live
spend of any kind** — no dungeon run, no fishing cast, no oil consumed, no new
fixture. Every number below was computed by CALLING an instrument against the
committed corpus.

Baseline confirmed exactly as the brief predicted before any edit:
**8 failed files / 42 failed / 1673 passed / 1 skipped (1716)**, `tsc` clean.
Final: **2 failed files / 4 failed / 1730 passed / 1 skipped (1735)**.

---

## §1 — the double-lethal oil trigger is WIRED LIVE, by user override

**The record, in both directions, because they are both true.** The user:

> "I want to authorize the bot to use 2x relaxing oil if it will be lethal and
> it is not confident in catching with mana."

`handoff/OIL-DOUBLE-LETHAL.md`'s recommendation is **unchanged and
unretracted**: +0.13pp catch (95.03% vs 94.90%) for 1409 extra oils at n=8000
paired seeds — **140.9 marginal oils per extra fish against a bar of ~12**, more
than 11x over. Nothing was re-run or re-priced. The user is buying **certainty
in the 3–4 `fishHp` band**, which the sweep never scored. **Never present this
as sim-recommended.** Written into `QUESTIONS.md` §30, `DECISIONS.md`, and a new
`WIRED LIVE` section of the memo.

### Two rule-9 catches — the brief's §1c was wrong twice

**(1) It is NOT a same-shape drop-in.** `doubleLethalTriggers` takes an
`OilDecisionState`, which extends `OilTimingState` with `focusCell` and `board`,
because its confidence read is `bestKillProbability`. The old call site passed
eight scalars; a literal substitution does not compile. The site now builds the
board exactly as the oil shadow above it does — `buildHand(doc)`, `dist`,
`gridSize`.

**Session 69 §1's hoist of the distribution pipeline above the oil block is the
ONLY reason `dist` and `gridSize` are in scope at line ~2177 at all.** That move
was made for the oil shadow and it paid for this wiring twenty sessions later.

**(2) It puts `bestKillProbability` on the LIVE path for the first time ever.**
It has only ever run inside `evaluateOilShadow`, whose entire body is wrapped in
try/catch *specifically because it can throw* (`oilShadow.ts` structural
property 2), and `buildHand` throws by design on a hand id missing from
`deckCardData`. In the shadow a throw becomes a logged record; live it would
abort a cast already in flight and already paid for.

The trigger evaluation is therefore wrapped. A throw:
- **degrades to `onDemandTriggers`** — the exact policy that shipped yesterday,
  and strictly the LESS-spending arm, never the more;
- writes `log.write({ event: "oil_trigger_threw", ... })`;
- prints a `★★★` line;
- **the cast continues.**

This is a deviation from CLAUDE.md rule 5's default (fail closed), taken
knowingly: aborting mid-cast is itself unrecoverable, and the fallback is a
policy already in production. **Any `oil_trigger_threw` line in a real log is a
finding and should be reported, not absorbed** — it would mean
`bestKillProbability` threw on real wire data, which nothing has yet seen.

### §1a — the code-reading claim is now RUN

Session 89 §3 argued from `for (const kind of oilWanted)` that the executor can
consume the same kind twice. Sound, never executed.
`tests/fishing/oilDoubleLethalLive.test.ts` drives the real `runOneCast` against
a live-shaped mocked request/response sequence:

- two `use_fishing_item` POSTs, both item 937;
- **two DISTINCT slots, 0 and 1** — the mock throws HTTP 400 on slot reuse, as
  the live server did on cast 13019682;
- `oilsConsumed === 2` against a `perItemMaxPerCast["937"]` of **exactly 2** —
  the user's own real ceiling, not a laxer test value;
- zero `oil_spend_refused`, zero `oilTriggerNoStock`;
- outcome `caught`, and **no `play_cards`** — the second oil was lethal.

**The case session 89 did NOT cover.** Its safety argument reasons about the
FIRST oil (which provably cannot kill in the band) and says nothing about the
third entry. `doubleLethalTriggers` returns `["relaxing","relaxing",...base]`,
and `base` carries `"focus"` whenever the meter is empty — so a lethal SECOND
relaxing followed by a wanted focus consume is on this trigger's **happy path**,
not an edge. Exercised: exactly two POSTs, one `oil_skipped_cast_complete`
naming the focus oil, zero `action_failed`.

**Both confirmed NON-VACUOUS by mutation**: reverting the call site to
`onDemandTriggers` fails both, and only those two.

### §1b — the guard was inverted, not deleted

`oilDoubleLethal.test.ts`'s not-wired grep now asserts the positive, plus that
`onDemandTriggers` is STILL called (it is the throw fallback), plus a new pin
that the memo still contains `"the recommendation is DO NOT SHIP"` and `140.9`
— so softening the record to agree with the code fails a test.

### Two other tests failed CORRECTLY and were fixed at the claim

**`oilStockExhaustion.test.ts` GATE 2.** It derived its discriminating fish as
"heuristic (c) fires, `onDemandTriggers` does not" = `fishHp` 3 at `fishMaxHp`
20 — **exactly the bottom of the new band**, so the live loop genuinely does
spend there now. Rewritten to ask the **shipped** trigger, and made
**board-INDEPENDENT**: it accepts a fish only when the shipped trigger declines
it *while holding a board that cannot possibly kill*, the case most likely to
make it fire. A fish refused under those conditions is refused under all.

⚠ **And at `fishMaxHp` 20 no separating fish exists any more.** (c) fires at
`fishHp <= 3`; the band reaches 4. **The band's reach SWALLOWS (c)'s entire
firing range — the wiring inverted which rule is more eager on a small fish.**
`GATE2_FISH_MAX_HP` is now 40, where (c) fires to 6 and the band stops at 4.

**`pConnectConsumers.test.ts`.** The double-lethal gate's entry carried
`live: false`; it flipped to `true` and joined the live level-based SET — the
assertion whose stated job is *"a site moving between live and not-live is a
loud change"*. It did its job on the first commit that made it wrong. The
`liveFishing.ts` site count went 10 → 11 (the new `oil_trigger_threw` console
line, a REPORT site). The note now says what actually changed: a connect
probability now reaches real oil stock **through `oilTiming`**, not through a
read in that file.

---

## §2 — `redrawCounterfactual.test.ts` regenerated

**The brief's §0 correction #3 was right and is confirmed.** `loadCastTraces()`
has no date or doc-id filter; the test was always live-computed. There was never
an architectural conflict. One cross-reference comment added: these pins track
the corpus, `session-86-redraw-revisit.md` is frozen at `CORPUS-2026-08-23A` per
§28, they diverge on purpose. **Both session-86 report files UNTOUCHED.**

### ⚠ Two of its claims are STRUCTURAL and changed — flagged, not renumbered

**(A) "exactly break-even" is gone.** `all3.rescues - all3.sacrifices` was
`7 - 7 = 0`; it is now `8 - 7 = +1`. Zero was a property of 148 casts, not of
the signal. Now pinned as the direction plus a bound, not as an identity.

**(B) The K=6 conditioned arm is no longer CLEAN.** It was
`{fires 6, rescues 6, sacrifices 0, wasted 0}`; it is now
`{fires 12, rescues 8, sacrifices 0, wasted 2}`. **`wasted` 0 → 2.**
`sacrifices: 0` survives, and that is the stronger half.

**This matters beyond the file: (B) IS §26's shadow candidate**, and
`DECISIONS.md` (session 83 §3) describes it as *"K=6 fires 6 times with 6
rescues and 0 sacrifices"*. **Two of those four numbers are stale.**

### What SURVIVED, which is worth as much

Triple deltas still exactly `{-8,-7,3}`, wraps still 7; `drawsWithUnheldCard ===
draws` (166/166, was 144/144); the vacuous reading still 0; `sweep[16].fires ===
plays` (444); the **INVERSION holds and widened** (rescue rate 0.16 where the
signal fires vs 0.71 where it says the hand is fine); clean-only still moves
`plays` by **exactly one** row; and **89.8% mana slack survives to three
decimals** on 20 more casts — the one figure the corpus growth did not move.

Other movements: `plays` 389→444, dead 101→118 (rate 0.260→0.266), AUC
0.922→0.921, `meanRescueCost` 1.60→1.61, focus-budget≥1 rescue rate 26/27
(96.3%) → 34/37 (91.9%) — **do not quote it as ~96%**, it keeps drifting down
as n grows, which is what a small-sample rate does.

---

## §3 — five of six pin files were mechanical, ONE was not

Each of the six was opened and its failing assertions read before anything was
regenerated.

### Mechanical, with their structural halves re-verified rather than assumed

- **`zoneTemplate`** — 612 → **699 plays, still EXCEPTIONLESS** (0 mismatches),
  fourth consecutive clean widening; 696 clean + 3 in session 45's resumed cast,
  same split. All three wrong readings still strictly worse. Clean traces still
  trail traces by **exactly one**, now across six consecutive oil batches, and
  that is now asserted as an identity rather than two literals. *(Noted:
  `stateBefore` and `previousFishPosition` swapped rank, 385/380 → 430/436.
  Noise between two wrong readings that nothing ranks — recorded so it is not
  rediscovered as a finding.)*
- **`fishingCorpus`** — 148 → 168 casts, 839 → 970 docs, 613 → 700 play turns,
  48 → 60 caught, 99 → 107 escaped; **`incomplete` UNCHANGED at 1**. +10 oil
  casts (23 → 33), twelve oils, and `13055883` walked **all three slots** — the
  fourth cast on record, so a recurring shape rather than a curiosity.
  ⚠ **Flagged as known-unchecked:** whether the Relaxing per-cast cap ever bound
  cannot be read from this corpus view (no item ids), so the standing "it never
  has" was NOT restated on the strength of earlier batches. It matters more now
  §1 shipped the first policy that can want two.
- **`enemies`** — 6 new hp/armor combos, **NONE a new starting loadout** (the
  starting set is unchanged at ten, 40/22 still newest) and **none gone**, so
  the whole batch is one arm. **Two of the six are DECREASES landing exactly on
  the documented corrode amount**: 40/19 is −3 (one application), 40/16 is −6
  (two within a room). The mechanic reproducing on new data at the right size.
- **`matcherHeadroom`** — **all three structural claims survived a fourth
  time**: every budget-identity failure is an oil consume (24/24, zero
  residue), every consume recovers a budget of **exactly 2**, every consume is
  at **meter 0**. The ceilings held within 0.002 (0.663→0.662, 0.711→0.710)
  while **`actual` climbed 0.363→0.375** — a board-dependent ceiling holding
  still while the bot's own rate moves is exactly the shape the instrument was
  built to show. Aim-error distance-1 share **48.3%**, against 48.0% and 48.0%
  before it. No-footprint plays 23→25, **avoidable UNCHANGED at 6, and no new
  offending card** — still exactly cards 1, 3, 4, 6.
- **`oilReachability`** — ⚠ **the relaxing numerator did NOT move across TWENTY
  casts**: still 13 casts over 15 decision points, and still **the same two
  uncaught docIds**, now seven batches running. `lax − strict` relaxing went
  **13 → 22**, the sharpest confirmation yet that `strict.relaxingReachable` is
  **not a firing rate and must never be quoted as one**. A THIRD caught cast
  entered the gap (`13055929`), which is confirmation of session 68's
  falsification rather than news; the residue decomposition written as a sum
  rather than "residue + 1" has now paid for itself twice.

### `damageEconomy` — STOPPED AND REPORTED, per the standing rule

**`LIVE.drift` CHANGED SIGN.** It was positive (band asserted `> 0.05`, docblock
cites +0.19) and is now **−0.0316**. A sign flip on a claim two tests call
**THE FINDING** is not a number to bump.

Cause measured, not guessed — split by the deck actually DEALT (the split
session 89 §2 found, and DECISIONS 2026-08-23 says to always state):

```
 dealt deck        casts  plays   hitRate   meanDmg  meanHeal    drift
 base [1..10]         22     74    18.9%      4.571     3.000   +1.568
 non-base            145    622    39.9%      5.210     3.086   -0.222
 POOLED (= LIVE)     167    696    37.6%      5.176     3.074   -0.032
```

**The two arms have OPPOSITE drift signs and nearly cancel.** So *"the fish
gains HP in expectation"* was never a fact about the fishery — it is what
pooling a low-hit-rate base-deck window into a rod-deck corpus produces. **Held
to one deck the live fish LOSES HP, the SAME sign as the sim's bare arm.** By
batch instead of by deck: the 146 older clean traces drift **+0.079**, the 21
newest **−0.787** (hit rate 47.2% vs 36.2%). One batch flipped the pooled sign.

Three published claims are affected, each differently:
1. *"the fish gains HP in expectation"* — false as stated, and **meaningless**
   on a pooled corpus that is two fisheries.
2. *"the clamp is real but small"* — unclamped drift is **−0.0014**,
   indistinguishable from zero. The clamp claim survives; its `> 0` term does not.
3. *"the bare arm's drift is NEGATIVE where live's is positive"* — the CONTRAST
   breaks. Both are negative. Magnitudes still differ by an order of magnitude
   (−0.222 vs < −2), so **"not the same fishery" survives; "opposite signs" does
   not.**

**Bearing on OIL-POLICY §0a:** the +19.40pp suspension rests partly on live and
sim being different fisheries, and the cleanest expression of that was the
opposite drift sign. That argument now needs the MAGNITUDE. **§0a is NOT lifted
and nothing here argues it should be** — but the reason it stands has changed,
and a reason that changes silently is worse than one that fails loudly.

**Three tests left RED with a docblock saying why. `QUESTIONS.md` §31** asks for
the ruling with three options, and notes **§29 is upstream**: until it is known
why casts get dealt the base deck, it is not certain the base arm is a
legitimate population at all.

---

## §4 — the redraw shadow evaluator

`src/strategy/fishing/redrawShadow.ts`. **`redrawEnabled` stays false,
`REDRAW_THRESHOLD` stays 0**, both verified in the diff and pinned by a test.
All three `oilShadow.ts` structural properties, copied deliberately: frozen deep
copy, cannot throw, inert by type.

### The phase is deliberately NOT the oil shadow's, and the brief did not anticipate this

The brief said to evaluate before the card is played — right — which also
implies **BELOW** the oil block, not above it where session 69 hoisted the oil
shadow. Reason: **the candidate conditions on the focus BUDGET**, and the
offline definition (`budgetBefore`) is the pre-play meter *including an oil
restore taken this turn* — that is the whole finding `budgetBefore` exists for,
and 24 of 24 observed consumes restore 2 from a meter reading 0. Evaluating
above the block would read the PRE-oil meter and shadow a **different signal**
from the one the corpus validated, on exactly the turns where the oil mattered.

**The blindness that placement buys is COUNTED, not absorbed.** A cast ended by
a lethal oil never reaches a card decision, so no record is written — correct,
and *precisely what session 68 believed about the oil shadow before measuring
it*. `redrawShadowNoDecision` plus a `redraw_shadow_no_decision` log line make
it a visible number. The hoist golden shows it **non-zero in 2 of 5 existing
scenarios**, so the counter is exercised rather than hypothetical.

### One shared implementation — what makes it a shadow of the RIGHT thing

`coverageOfCards` was extracted from `redrawCounterfactual.ts`'s
`coverageCells` (now a thin adapter over it) so the live shadow and offline
`separability` compute `heldCoverage` **from the same code**. A careful
re-implementation would have made this a shadow of something slightly else with
no test able to tell. `cardCovers` was widened to readonly zone arrays so this
needed neither a cast nor a second copy of the geometry.

`redrawShadow.test.ts` reproduces the corpus's own `heldCoverage` through the
LIVE path (snapshot + evaluator) on **400+ real plays** and asserts the firing
count is **IDENTICAL** to the offline sweep's — pinned as an identity, not a
count, so corpus growth cannot make it stale.

### K is pre-registered, and the raw signal is recorded

K=6 with `budget >= 1` comes from session 83, frozen so the shadow tests a rule
committed to in advance. **Raw `heldCoverage` is recorded on every row**, so any
other K is reconstructable offline for free — the same argument `oilShadow.ts`
used when it replaced its certainty arm rather than adding a second one. The
constant's docblock carries the ⚠ that session 83's published K=6 numbers have
moved (§2 above).

### A guard fired, and the golden was NOT regenerated

`hoistInvariant.test.ts` compares live play against a capture taken **before**
the session-69 hoist; the two new result fields broke it. Regenerating would
have destroyed that baseline to accommodate a field it could not have contained.
Diffed by hand once instead: **the ONLY differences are the two new fields
appearing** — every `posts` array, `outcome`, `turns`, `oilTriggerNoStock` and
`oilsConsumed` byte-identical across all five scenarios. The fields are now
excluded from the capture, on the same grounds `oilShadowRecords` already was.

### Tests

`redrawShadowInert.test.ts` carries `oilShadowInert`'s three anti-vacuity
refusals — the shadow RAN; the shadow FIRES (so a leak would be visible); the
comparator is SENSITIVE — plus a fourth this one needs: **it does NOT fire on a
wide hand at a full meter**, since a rule that fired on everything would pass
the firing test and be useless as a trigger.

Batch reporting added: fires / card decisions, the blind count beside it (never
folded into the denominator), and the **in-sample 2.7%** to compare against.

---

## Preflight caught a real regression, and that is the argument for running it early

The new "the memo still says DO NOT SHIP" assertion reads
`handoff/OIL-DOUBLE-LETHAL.md`, and `preflight.ts` **prunes `handoff/`** from a
distributed tree. So it passed here and **failed on first contact for anyone
else** — the failure mode preflight's own output calls *"the single most likely
reason someone quietly gives up"*. Fixed with the mechanism the repo already
has (`probeAuthorData` + `announceMissingAuthorData` + `it.skipIf`, as
`tests/api/redact.test.ts` guards its handoff-prose sweep), so the skip
announces itself and cannot pass for a pass.

The exported tree now matches the working tree exactly: **4 failed / 1715 passed
/ 16 skipped (1735)**, 310 files, one expected `✗` (missing JWT), secret scan
clean. `preflight.ts` still FAILS overall, because the suite is red — but the
red is now exactly the 4 known, deliberate failures.

---

## Verification at the final commit

```
npx tsc --noEmit                     clean
npx vitest run                       2 failed files | 4 failed | 1730 passed | 1 skipped (1735)
git diff --check                     clean
tests/discoveredShipsClean.test.ts   8 passed
secret scan of the session diff      clean (no 0x…, noobId, eyJ, PRIVATE)
scripts/preflight.ts                 FAILS — red suite only; export/doctor/secret-scan all green
scripts/assertionCoverage.ts         BLOCKED — fails closed on a red suite, as designed
REDRAW_THRESHOLD = 0                 verified
redrawEnabled ?? false               verified
```

The 4 remaining: 3 in `damageEconomy` (**red on purpose**, §31) and 1 in
`boons` (`OBSERVED_OFFERS`, verified inert and declined in session 89).
