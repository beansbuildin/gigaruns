# THE DOUBLE-LETHAL BAND — derived, and the recommendation is DO NOT SHIP

Session 89, 2026-08-23. Brief §6. **Nothing here has been consumed live and
nothing here is shipped.** `scripts/liveFishing.ts` still plays
`onDemandTriggers`, `config/bot.json`'s `dendren.oils.policyApproved` still
ships **false**, and CLAUDE.md rule 4 still governs.

Reproduce with `RUNS=8000 npx tsx scripts/oilDoubleLethalSweep.ts`.

---

## 0. THE RECOMMENDATION, first

> **Do not wire this live.** The trigger is correct, its confidence cutoff is
> genuinely non-degenerate, and it does raise catch. It costs **140.9 oils per
> extra fish** against a bar of roughly **12**, so it is about **12x too
> expensive** — and it buys **+0.13pp** of catch for **1409** extra oils across
> 8000 casts.

This is a negative result and it is a clean one. The band is real, the rule is
implementable, the executor supports it, and the arithmetic simply does not pay.
`doubleLethalTriggers` is left reachable-but-uncalled, exactly as
`conservingOil` has been since session 67, so a later session with a reason to
revisit it does not start from nothing.

---

## 0a. §0a APPLIES, VERBATIM

> `handoff/OIL-POLICY.md` §0a suspends `castSim`'s bare default arm for this
> fishery: **sim catch ~70% against a real 27.6%, meter-out 1.0% against
> 64.2%.**

Every catch figure below is measured on that arm. They ORDER the options and
authorize none of them. That caveat cuts *toward* this recommendation rather
than against it — the case for shipping would need the suspension lifted, and
the case for not shipping does not.

---

## 1. The gap this was asked to close

`onDemandTriggers` (`src/strategy/fishing/oilTiming.ts`) fires the Relaxing Oil
exactly when `fishHp <= fishDamage` — when ONE oil already finishes the fish. At
`fishHp` 3 or 4 (the payload's +2) it fires **zero** times: one oil leaves the
fish alive, and nothing has ever asked for a second to finish it.

`config/bot.json`'s `dendren.oils.perItemMaxPerCast["937"] = 2` has permitted two
Relaxing-Oil spends per cast since **session 69**, on the user's own directive
(*"then only use 2x Relaxing oil per fishing run"*). **The budget plumbing was
built twenty sessions before a trigger that would use it.**

## 2. The rule, as built

In the band `fishDamage < fishHp <= 2 * fishDamage`, holding at least two
Relaxing Oils, fire **both in the same turn** — but only when the bot is not
already certain of landing the fish this turn on its own.

The certainty read is `bestKillProbability`, the function the necessity gate
already uses. It is reused rather than reinvented, the same discipline
`onDemand` and `conservingOil` follow by sharing `onDemandTriggers` instead of
each restating the lethal condition.

**No new fitted constant.** The cutoff is
`RECOMMENDED_NECESSITY_THRESHOLDS.relaxing`, which is `1`: *if the bot can
guarantee the kill without the oils, don't spend them.* `oilTiming.ts`'s
standing rule against tuning the necessity thresholds applies unchanged.

---

## 3. THE LIVE EXECUTOR CAN DO THIS — verified, not assumed

The brief asked whether `scripts/liveFishing.ts` can consume the same oil kind
twice inside one turn's decision, and whether it might dedupe or short-circuit.
**It does not dedupe.** Read directly at the call site:

- The loop is `for (const kind of oilWanted)` and issues one `use_fishing_item`
  per entry, in order.
- Every piece of per-consume state updates **inside** the loop: `doc` is
  replaced by the response (so `fishHp`, `COMPLETE_CID` and the
  `fishingConsumableSlotUsed` cursor are fresh), and `oilHeld[kind]`,
  `oilsUsedThisCast` and `oilsUsedThisCastOf[kind]` all move per iteration.
- `mayConsumeOil` is re-called each iteration with the updated counts, so the
  second spend is authorised independently against `perItemMaxPerCast` 2.
- `nextConsumableSlot` re-reads the fresh doc, so the pair takes slots 0 and 1.

So `["relaxing", "relaxing"]` would issue two authorised POSTs. **This is not a
second piece of work.**

Two properties of that loop matter to this trigger specifically, and both are
recorded in `doubleLethalTriggers`'s own docblock:

- **Session 68's `COMPLETE_CID` break does not bite here, by construction.**
  That break exists because a LETHAL first consume ends the cast and the second
  is then rejected against a finished one — which cost a cast live on
  2026-08-21. In this band the first oil *provably* cannot kill
  (`fishHp > fishDamage`), so the fish is alive at 1..fishDamage HP when the
  second is sent. **The band's own definition is what makes the pair safe**, and
  `tests/fishing/oilDoubleLethal.test.ts` pins the lower edge as strict.
- **The decision commits before the first oil's result is seen.** `oilWanted` is
  evaluated once per turn from the pre-consume state. Sound here because the
  first consume's outcome in this band is arithmetic rather than a roll; it
  would NOT be sound for a band where the first oil might finish the fish.

---

## 4. THE CONFIDENCE CUTOFF IS NOT DEGENERATE — the brief's second question

The brief asked whether `1` degenerates in this band (always fires, or never).
**It does neither.** Measured at the moments the band arises, n=8000:

```
  decision points                          31190
  in band (fishDamage < fishHp <= 2x)       2580   8.27% of decisions
  ... and holding >= 2 Relaxing             2580   8.27%
  ... and NOT already certain of the kill   1084   3.48%   <- the trigger's rate
  band turns where the bot WAS certain      1496   57.98% of band-with-stock
```

The cutoff withholds the pair on **58%** of the band turns it could fire on.
That is the gate doing real work, not a formality.

`bestKillProbability` at band turns is bimodal in the same way session 67
measured it at `onDemandTriggers`'s moments — **36.20% exactly 0, 57.98% exactly
1, 5.81% between** — so `1` is again a choice between two behaviours rather than
a fitted number, and again there is no plateau to tune within.

**The band is not rare.** It arises on 8.27% of decisions, and the account
always holds 2+ Relaxing Oils in this arm by construction. So the null below is
NOT the null of an inert arm — the trigger fires 1084 times and the sweep is
measuring what it does, not whether it runs.

---

## 5. THE SWEEP

n=8000/arm, paired seeds, `costsTurn=false`, effect amount 2, and
**`relaxingOilHeld = focusOilHeld = 2`**.

⚠ **The stock is the one harness change, and it is not optional.** Every
published sweep runs `held = 1`, at which this trigger is *identically inert*.
`on-demand` is therefore re-run at `held = 2` here as the comparison, rather
than compared against its published `held = 1` numbers — a cross-stock delta
would be measuring the stock, not the trigger.

```
  policy                     catch     Δ vs never   Δ vs on-demand   oils   casts   oils/extra fish
  never                     84.35%      +0.00pp        -10.55pp         0       0        —
  on-demand                 94.90%     +10.55pp         +0.00pp      6246    4313      7.40
  conserve(r=1,f=1)         94.91%     +10.56pp         +0.01pp      4157    2994      4.92
  double-lethal(r=1)        95.03%     +10.67pp         +0.13pp      7655    4546      8.96
  double-lethal(r=0)        94.90%     +10.55pp         +0.00pp      6246    4313      7.40
  double-lethal(r=2)        95.03%     +10.67pp         +0.13pp      9885    5231     11.57
```

**`double-lethal(r=0)` reproduces `on-demand` byte for byte** — same catch, same
6246 oils, same 4313 casts. That is the arm validating itself: at the
never-fires threshold the new branch is provably inert, so any difference in the
other rows is the branch and nothing else.

---

## 6. THE MARGINAL PRICE — the number that decides it

Average oils-per-extra-fish flatters a policy that inherits a good trigger. The
question is what the SECOND oil buys on top of the first.

```
  extra oils spent vs on-demand      1409
  extra fish caught vs on-demand       10
  paired Δ catch                    +0.13pp   95% CI [+0.12pp, +0.13pp]   discordant 10

  MARGINAL oils per extra fish     140.90
```

**The bar.** The corpus prices the shipped Relaxing trigger at ~**6** oils per
extra fish, 95% interval [1.5, 20] (`MEASURED_RELAXING_OILS_PER_EXTRA_FISH`). A
double spend commits two oils to one fish, so to be worth taking it must clear
roughly **twice** that bar — a marginal cost at or below ~**12**.

**140.9 against a bar of 12 is 11.7x over.** It is not close, it is not inside
the [1.5, 20] interval's own upper end doubled (40), and it does not become
close under any reading of the interval. The gain is real — 10 of 10 discordant
seeds fall the arm's way, so the direction is not noise — and it is negligible.

**Why it is so expensive, stated so the result is understood rather than just
recorded.** The band condition asks the fish to be at 3-4 HP *and* the bot to be
unsure of the kill. But `on-demand` already covers the case that matters most:
the fish reaches 1-2 HP on its own most of the time, and one oil finishes it
there for one oil. Firing two oils at 3-4 HP mostly buys a turn the bot would
have won anyway a turn later — the pair is spent on fish that were not actually
lost. 1409 oils bought 10 fish because ~1399 of those spends changed nothing.

---

## 7. What this does NOT say

- It does not say the band is uninteresting. It says a *guaranteed* kill is the
  wrong thing to buy there, at two oils a go.
- It does not reopen `conserve`. `conserve(r=1,f=1)` is still the arm that
  matches `on-demand`'s catch on **2089 fewer oils** (4.92 vs 7.40 per extra
  fish), and this sweep re-confirms that at `held = 2` — which is a free
  re-verification of `OIL-CONSERVE.md`'s recommendation at a stock it had not
  been run at.
- It does not change `perItemMaxPerCast["937"] = 2`. The budget stays as the
  user set it in session 69; what is declined is a TIMING that would use it.

## 8. Where the code is

| thing | where |
|---|---|
| the trigger | `src/strategy/fishing/oilTiming.ts` — `doubleLethalTriggers`, `doubleLethal` |
| the sweep | `scripts/oilDoubleLethalSweep.ts` |
| the pins | `tests/fishing/oilDoubleLethal.test.ts` (19 assertions) |
| not-wired guard | same test file, last block — asserts `liveFishing.ts` calls `onDemandTriggers` and does not mention `doubleLethalTriggers` |

`doubleLethal(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing)` is in
`OIL_TIMING_POLICIES` so it keeps being scored by anything that sweeps the
roster. That is deliberate: a declined policy that stops being measured is how a
declined policy quietly becomes an unexamined one.
