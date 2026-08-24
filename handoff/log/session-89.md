# Session 89 — 2026-08-23 — the user's rulings, three offline boon captures, and one declined oil policy

**GATE PASS.** All six brief items delivered. **No live spend** — no dungeon
run, no fishing cast, nothing on-chain. Suite **72 → 42 failures**.

Commits: `66a78709`, `50d5e8c6`, `6e0d821e`, `e034a49e`.

---

## Verification, at the final commit

```
npx tsc --noEmit                     clean
git diff --check                     clean
npx vitest run                       42 failed | 1673 passed | 1 skipped (1716)
                                     8 failed files of 100
tests/discoveredShipsClean.test.ts   8 passed
secret scan (staged diff)            clean — 0x{4,}, noobId, eyJ, PRIVATE, ~/.secrets all empty
.gitignore                           .env, *.key, data/, logs/, profiles/,
                                     fixtures/**/raw/, fixtures/**/*.har all present
scripts/assertionCoverage.ts         BLOCKED — fails closed on a red suite
scripts/preflight.ts                 FAILED — 42 failed / 1659 passed / 15 skipped in the
                                     exported tree; 306 files; one ✗ (expected missing JWT);
                                     exported-tree secret scan CLEAN
```

Baseline at session start, confirmed before touching anything: **72 failed /
1618 passed / 1 skipped (1691), 11 failed files of 99** — exactly what the brief
predicted.

---

## §1 — QUESTIONS §28 ANSWERED

User ruling, verbatim: *"Accept the re-pricing — keep redraw closed, but retire
'43.9 mana per extra fish' as the stated reason and restate it as 'no validated
trigger + two unpaid correctness gaps.'"*

Recorded in `QUESTIONS.md` (§28 header marked ANSWERED, full section appended in
§26's style) and `DECISIONS.md`.

**The retirement was done by classification, not by grep-and-replace.** 29 sites
mention 43.9. A sentence REPORTING what session 75 measured stays verbatim; a
sentence ANSWERING "why is redraw closed today?" was replaced. Seven qualified:

| file | what it was doing |
|---|---|
| `SPEC-fishing.md:1097` | "REDRAW IS STILL CLOSED … 43.9 … is unaffordable" |
| `tests/fishing/pConnectConsumers.test.ts` | "a closed dead end (session 75 re-derivation: 43.9…)" |
| `scripts/liveFishing.ts` | "these price the feature and they are the reason it stays off" |
| `scripts/redrawCounterfactual.ts` | "Redraw is CLOSED … on a price: 43.9" |
| `src/sim/fishing/redrawCounterfactual.ts` | "the price that CLOSED redraw" |
| `src/sim/fishing/castSim.ts` | "Redraw stays CLOSED, but on PRICE" |
| `scripts/damageEconomy.ts` | "the price that closed redraw … was quoted against the abundant one" |

Dated `DECISIONS.md` entries were left alone — they are historical records of
what was decided when, and rewriting them would be the thing rule 10 warns about.

`redrawEnabled` false, `REDRAW_THRESHOLD` 0. No live-path line moved. **No
shadow instrumentation written.**

---

## §2 — REAL_DECK: the brief was right to say "check first"

The brief warned that STATE.md's one-line summary might name the wrong file. It
named the wrong THING.

**Four of `rodDeck.test.ts`'s five assertions pass.** `CURRENT_ROD` is the rod
in gear; `REAL_DECK` is that rod's `CARD_CID_array`. The one that failed is *"the
grant table agrees with PLAY, not just with /offchain/static"* — the independent
half — and it failed because the claim is false.

### The counterexample

```
2026-08-24T00:01:31.205Z  fullDeck [74,75,76,78,1,2,3,4,5,6,29]   Shroom grant
2026-08-24T00:01:46.915Z  fullDeck [ 1,2, 3, 4,5,6,7,8,9,10,29]   BASE_DECK
```

15 seconds apart. `GEAR_CID_array` **byte-identical** — same instances, same
mint stamps. Same node (5), `LEVEL_CID` (20), `day` (20688), juice, multiplier,
and the same looted tail card 29.

### Every transition in the corpus, with the gear-identity flag

```
2026-08-17T05:34:29 [MAKESHIFT] -> 2026-08-17T05:57:37 [BASE]     gearIdentical=true
2026-08-17T21:18:49 [BASE]      -> 2026-08-18T22:59:56 [MAKESHIFT] gearIdentical=false
2026-08-21T17:05:52 [MAKESHIFT] -> 2026-08-21T19:58:29 [SHROOM]    gearIdentical=false
2026-08-24T00:01:31 [SHROOM]    -> 2026-08-24T00:01:46 [BASE]      gearIdentical=true
```

**Both transitions INTO the base deck are gear-identical; both transitions back
out are not.** 69 Makeshift / 42 Shroom / **38 BASE** casts.

### What the two decks are

Positionally analogous, one tier apart — which is what identifies `[1..10]` as
the un-bonused deck rather than a ninth rod:

| hit zones | Shroom | base |
|---|---|---|
| `[1,3,7,9]` | **74** hit 7, miss −4 | **7** hit 6, miss −3 |
| `[2,4,6,8]` | **75** hit 6, miss −4 | **8** hit 5, miss −5 |
| eight-cell ring | **76** hit 3, miss −3 | **9** hit 2, miss −4 |
| centre crit `[5]` | **78** crit only, miss −3 | **10** crit only, miss −5 |

And `/offchain/static`'s full rod table rules out the alternative outright:

```
 49 Wood Rod        [2,4,5,6,7,8,9,10,32,34]
 50 Stone Rod       [2,5,7,8,9,10,32,34,35,37]
336 Phin's Rod      [2,5,7,8,9,10,28,31,38,52]
811 Shroom Rod      [1,2,3,4,5,6,74,75,76,78]
812 Golkan Rod      [74,80,81,84,85,86,87,88,89,90]
922 Makeshift Rod   [1,2,3,4,5,6,7,76,77,79]
923 Dendren Rod     [91,92,93,94,95,96,97,98,99,100]
924 Puppeteer's Rod [101,102,103,104,105,106,107,108,109,110]
```

**None grants `[1..10]`.**

### A smaller thing that made the old claim look better-supported than it was

`GEAR_CID_array` carries **Stone Rod (50) alongside Shroom (811)** on every
recent cast. The test's *"holds exactly one KNOWN rod"* passed only because
`latestRodObservation` filters to the two rods in `ROD_CARD_GRANTS`. So the
array never identified the ACTIVE rod at all.

### What was changed, and what deliberately was not

- `BASE_DECK` and `KNOWN_DEALT_DECKS` added; `rodDeck.ts`'s docblock records the
  falsification with the evidence.
- The ratchet now guards the half that survives: **an unrecognised deck is a
  finding**. A new assertion also says out loud which window the latest cast is
  in, so a base window is recorded rather than inferred.
- **`REAL_DECK` was NOT repointed.** The 2026-08-17 base window ENDED, so the
  base deck is a transient state; and `REAL_DECK` feeds pinned sim numbers in
  ~6 test files, so repointing would silently re-baseline all of them.
- **The cause was NOT guessed.** Durability, a per-day grant allowance, an equip
  the array does not reflect, and a plain server bug all fit; the fixtures
  separate none of them. `QUESTIONS.md` §29 asks the user for one live look.

Offline hint recorded but explicitly NOT run as an analysis: both base windows
started a few casts into a day's fishing (4 on 08-17, 3 on 08-24). **n=2.**

---

## §3 — the three new `fishHp` exceptions are ONE rule

The brief asked for two steps and only the second if the first earned it. It did.

| doc | card | base | `FISH_HP_DIFF` | lethal |
|---|---|---|---|---|
| 13022874 t4 | 76 | 3 (hit) | 5 | yes |
| 13041046 t9 | 2 | 5 (hit) | 8 | no |
| 13041474 t2 | 38 | 9 (**crit**) | 14 | yes |
| **13055873 t3** | 5 | 5 (hit) | 8 | no |
| **13055892 t1** | **7** | **6** (hit) | **9** | **no** |
| **13055941 t5** | 9 | 2 (hit) | 3 | no |

Session 81's docblock said the remaining separator was *a base of 6, 8 or 10*.
**Base 6 arrived**, non-lethal so nothing is clamped:

```
base 6:  ×1.5 round-half-up ->  9  ✓ survives
         ×1.6 rounded       -> 10  ✗ FALSIFIED
         floor(6 × 5/3)     -> 10  ✗ (already dead, re-falsified)
```

Solving `actual − 0.5 ≤ base × m < actual + 0.5` on all six:

```
base 3 -> 5   m ∈ [1.5000, 1.8333)
base 5 -> 8   m ∈ [1.5000, 1.7000)
base 9 -> 14  m ∈ [1.5000, 1.6111)
base 5 -> 8   m ∈ [1.5000, 1.7000)
base 6 -> 9   m ∈ [1.4167, 1.5833)   <- the separator
base 2 -> 3   m ∈ [1.2500, 1.7500)
              ─────────────────────
INTERSECTION  m ∈ [1.5000, 1.5833)
```

`m = 1.5` ✓, `1.55` ✓, `1.6` ✗, `5/3` ✗, `1.4` ✗. **A narrowed family, not a
constant.** Next separator is base 12+, which no known deck carries.

**Card 7 is a `BASE_DECK` card** — reachable only because the account spent
session 87's tail in a base-deck window. The §2 anomaly paid for the §3 result.

Multiplier still NOT encoded in `cardChoice.ts` (§4d, rule 4).

The other two pins in the file were **attributed, not assumed** — removing
session 87's 20 traces returns every old value exactly:

```
ALL (167 clean traces)      oilSkipped=24  crits=36  scored=696  agree=690  viol=6
WITHOUT the 8/24 batch      oilSkipped=21  crits=30  scored=609  agree=606  viol=3
```

---

## §4 — three boon pairs, modelled offline

All three `latent`. The check was **stricter than `tests/boons.test.ts`
applies**: a recursive diff of the entire raw `players[0]` object, not the six
fields `toCombatant` projects.

```
WeakeningMastery    run-2026-08-24-00-14-01 state-059→060  val1 10  Rare
AddVulnerableSword  run-2026-08-24-01-04-21 state-105→106  val1 2   Rare
AddBurnShield       run-2026-08-24-01-04-21 state-123→124  val1 3   Uncommon

RAW player diffs, all three:  exactly 1 — the boon's own pickedBoons append.
```

`UNMODELLED_TYPES` **24 → 21. Three OUT, none IN** — the first un-offset gain in
five recorded sessions. Verified independently of the stale table: the
offered-type SET is identical between the corpus (227 offers) and
`OBSERVED_OFFERS` (202), 55 both ways.

**The consequence is the module's own rule firing.** `AddBurnShield` and
`WeakeningMastery` were `DEFAULT_CAPTURE_TARGETS` *because* they were
unmodelled, so both retire — **5 of the original 5 targets are now modelled
without `boonCapture` ever being switched on.** Replacements per the same rule
(next-ranked unmodelled, still offered in a permitted room): `BurningEvade` 4,
`WeakeningBlock` 4.

⚠ The ranking is now computed over the CORPUS rather than `OBSERVED_OFFERS`,
which is 25 offers stale and disagrees on the ORDER (Regen 7 vs 8,
AddLifestealSword 4 vs 5, BurningTenacity 1 vs 2).

Three tests followed correctly (they used `AddBurnShield` as their exemplar):
`boonCapture.test.ts` moved to `Regen`, `liveRun.test.ts`'s two boon-capture
tests likewise — and its two-offer test's offerA moved to `LossBlockUp`, since
the two offers must hold DIFFERENT targets or the stall guard ends the run
before the second decision. Collapsing both to `Regen` would have made that test
pass for the wrong reason; caught before commit.

---

## §5 — `castEra.test.ts` regenerated

Every pin produced by CALLING the instruments. Nothing hand-typed.

**The control: the BEFORE arm is unchanged** — 94 casts / 410 plays / 184
budget-zero / rate 0.449, identical to session 84. The corpus grew on one side
only, so the instrument demonstrably did not drift.

### The four structural changes

| claim | was | is |
|---|---|---|
| "THIRTYFOLD drop" | ratio > 28 | **6.48** (today 1.49% → 6.92%) |
| `neither = 0` | 0, "structural" | **6** — RETRACTED |
| `wasted` structurally zero | 0 everywhere | **0, 3, 4, 5, 6** |
| rescue rate | 15/15, hi = 1 | **26/32, CI [64.7%, 91.1%]** |

(3) is (2) restated and the retraction is written where the claim was made:
with `wasted > 0` a threshold can spend mana on hands nothing could rescue,
which is a SELECTION cost — so *"the trigger's job is detection, not
selection"* no longer holds. It is now asserted as the identity
`max(wasted) === neitherReaches` so the two facts cannot drift apart.

### What did NOT move — the more interesting half

- **THE CONTROL HOLDS.** `meanOptimal` before 0.656 / today 0.662 — agreeing to
  0.0062 inside a 0.01 bound, on 37% more casts. The target still never moved.
- Not one cast in 74 spent the whole meter on move one (was 0 of 54).
- **GEAR null got STRONGER**: reach arms agree to 0.00003, was 0.002.
- `heldCoverage` separation SURVIVES: AUC pooled 0.921, today **0.925** (was 0.907).
- Strip the restores and oil casts revert to 48.5% against a standardised 55.3%
  — the same finding at both corpus sizes.
- Length still explains ~10% of the drop (was 12.5%); the `< 15%` bound holds
  with more room.

### A new day that cuts against an old reading

`openingOverspendByDay` gained 2026-08-24 at **0.10**, after the within-era
climb 08-21 0.10 → 08-22 0.25 → 08-23 0.50. So the series inside today's era
does not trend in either direction; it wanders in roughly [0.1, 0.5] while the
before era sat near 1.0. **The band separation is durable; the climb was four
points of noise.** Pinned as such.

`session-86-redraw-revisit.md` and `session-86-corpus-snapshot.md` **NOT
touched** — frozen at `CORPUS-2026-08-23A` per §28.

---

## §6 — the double-lethal oil trigger: built, and declined

### Both pre-checks came back YES, and both are findings

**1. The live executor CAN consume the same kind twice in one turn.** Read at
the call site (`scripts/liveFishing.ts`): `for (const kind of oilWanted)` issues
one `use_fishing_item` per entry and does **not** dedupe. Every piece of
per-consume state updates INSIDE the loop — `doc` is replaced by the response,
`oilHeld[kind] -= 1`, `oilsUsedThisCast += 1`, `oilsUsedThisCastOf[kind] += 1` —
`mayConsumeOil` is re-called with updated counts, and `nextConsumableSlot`
re-reads the fresh doc. **Not a second piece of work.**

Session 68's `COMPLETE_CID` break **cannot bite here by construction**: it
exists because a LETHAL first consume ends the cast and the second is rejected
against a finished one. In this band the first oil provably cannot kill
(`fishHp > fishDamage`).

**2. The cutoff of `1` is NOT degenerate.**

```
decision points                          31190
in band (fishDamage < fishHp <= 2x)       2580   8.27% of decisions
... and holding >= 2 Relaxing             2580   8.27%
... and NOT already certain of the kill   1084   3.48%   <- the trigger's rate
band turns where the bot WAS certain      1496   57.98%

bestKillProbability at band turns:  36.20% exactly 0, 57.98% exactly 1, 5.81% between
```

It withholds the pair on **58%** of the band turns it could fire on. Bimodal
exactly as session 67 found it elsewhere, so `1` is again a choice between
behaviours rather than a fitted number.

### The sweep — n=8000, paired seeds, `held = 2`

⚠ **`held = 2` is the one harness change and it is not optional.** Every
published sweep runs `held = 1`, at which this trigger is *identically inert*, so
`on-demand` was re-run at the same stock rather than compared against its
published numbers.

```
policy                     catch     Δ vs never   Δ vs on-demand   oils   casts   oils/extra fish
never                     84.35%      +0.00pp        -10.55pp         0       0        —
on-demand                 94.90%     +10.55pp         +0.00pp      6246    4313      7.40
conserve(r=1,f=1)         94.91%     +10.56pp         +0.01pp      4157    2994      4.92
double-lethal(r=1)        95.03%     +10.67pp         +0.13pp      7655    4546      8.96
double-lethal(r=0)        94.90%     +10.55pp         +0.00pp      6246    4313      7.40
double-lethal(r=2)        95.03%     +10.67pp         +0.13pp      9885    5231     11.57

extra oils vs on-demand    1409
extra fish vs on-demand      10
paired Δ catch           +0.13pp  95% CI [+0.12pp, +0.13pp]  discordant 10
MARGINAL oils/extra fish  140.90
```

**`double-lethal(r=0)` reproduces `on-demand` byte for byte** — the arm
validating itself.

### The verdict

**140.9 against a bar of ~12 is 11.7x over.** (`MEASURED_RELAXING_OILS_PER_EXTRA_FISH`
is ~6, and a double spend must clear roughly twice that.) The gain is real — 10
of 10 discordant seeds fall the arm's way — and negligible.

**Why it is so expensive**, so the result is understood rather than just
recorded: `on-demand` already covers the case that matters. The fish reaches
1-2 HP on its own most of the time and one oil finishes it there. Firing two at
3-4 HP mostly buys a turn the bot would have won anyway. 1409 oils bought 10
fish because ~1399 spends changed nothing.

**Free re-verification:** `conserve` still matches `on-demand`'s catch on **2089
fewer oils** at `held = 2` — a stock `OIL-CONSERVE.md` had not been run at.

`handoff/OIL-DOUBLE-LETHAL.md`. Not wired: `liveFishing.ts` calls
`onDemandTriggers`, `policyApproved` false, and the last block of
`tests/fishing/oilDoubleLethal.test.ts` asserts exactly that.

One follow-on: `bestKillProbability` in the new trigger is a new pConnect
consumer, so `pConnectConsumers.test.ts` went 8 → 9 sites with the new read
classified **NOT LIVE**.

---

## Surprises, in the order they landed

1. **The `rodDeck` failure was not what its recap said**, and checking took ten
   minutes. Rule 9 earned its keep for the third recorded time.
2. **A gear-identical deck flip.** Expected a rod swap; found the same gear
   array dealing two different decks 15 seconds apart.
3. **The base-6 separator the repo had been waiting three sessions for arrived
   in the same window that broke the rod test.** The anomaly paid for the result.
4. **Modelling three boons BROKE three passing tests** — correctly. They used a
   now-modelled type as their unmodelled exemplar, and one of them would have
   silently passed for the wrong reason if both offers had collapsed to `Regen`.
5. **`neither = 0` and `wasted = 0` are the same fact**, which only became
   obvious when both moved together. Now asserted as an identity.
6. **The oil trigger works and is 11.7x too expensive.** The most decisive
   negative result available: nothing was ambiguous about it.
