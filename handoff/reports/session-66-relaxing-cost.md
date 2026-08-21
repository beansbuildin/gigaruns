# What holding ZERO Mid Relaxing Oil actually costs

**Session 66, 2026-08-21. Offline — reads `fixtures/`, spends nothing.**
Reproduce with:

```
npx tsx scripts/oilReachability.ts --relaxing-cost
```

Written because a count of dry triggers is not actionable on its own. The user
is crafting more Relaxing Oil and asked for the dry-trigger counts to stay in
the recaps; this turns them into a number that answers *how much crafting time
is this worth*.

**Everything below is EXPECTED, not observed.** It is a counterfactual computed
over 109 casts that were played with no Relaxing Oil in stock. There has been
exactly **one** live Relaxing consume in this project's history (session 65,
cast 1: `use_fishing_item(937)` at `fishHp 1/23` → `0/23` → CAUGHT). That n=1
confirms the MECHANISM — the oil's damage lands and a killed fish is a caught
fish — and calibrates none of the rates below.

---

## The headline, and it is smaller than the sim's

| | |
|---|---|
| corpus | 109 casts, 23 caught (21.1%) |
| lethal trigger **reachable** | **12 / 109 = 11.0%** |
| …of those, **caught anyway** | **10** |
| …of those, **escaped** | **2** ← the only casts an oil could have converted |
| expected catches gained | **2 over 109 = +1.83pp** |
| 95% Wilson interval | **[0.5pp, 6.4pp]** |
| oils spent to get it | 12 (one per reachable cast) |
| **oils per extra fish** | **~6** |
| at the 20-cast daily cap | ~2.2 oils/day for ~0.37 extra fish/day (95%: 0.10–1.29) |

## The finding is the 10, not the 2

**Ten of the twelve reachable casts were caught anyway.** The trigger fires when
the fish is at or below the oil's 2 damage with a turn still to play — and a
fish that low usually dies to the next card, which deals far more than 2. The
oil only earns anything in the residue where the next card *misses*, and a miss
pushes `fishHp` back toward `fishMaxHp` and can lose the cast outright.

So the lethal trigger is **not** a proxy for "this cast is about to escape". It
is a proxy for "this cast is nearly over", and those are different populations.
Five out of six oils spent on it buy nothing.

## Why the sim's +4.47pp is not the number to quote at the user

`handoff/OIL-POLICY.md`'s `lethal-relaxing-only` arm is **+4.47pp for 1821 oils
across 8000 casts** — sim-derived. Put per-oil, the two sources agree closely:

| | extra catches per oil |
|---|---|
| sim, `lethal-relaxing-only`, n=8000 | 0.196 |
| this corpus, n=109 | 0.167 |

The **headline percentages** disagree by 2.4x, and the reason is trigger RATE,
not oil value: the sim reaches the lethal band on **22.8%** of casts against
this corpus's **11.0%**. The sim's fish visit the 1–2 HP band about twice as
often as real ones do, so it spends about twice as many oils and books about
twice the gain. Quoting +4.47pp as the cost of zero stock would roughly double
it.

## Assumptions, stated so they can be attacked

1. **Firing kills.** `onDemandTriggers` fires "relaxing" only at
   `fishHp <= fishDamage` (2), so a consume is a kill by construction, and a
   killed fish is caught (live, n=1). If the oil's real damage is ever observed
   below 2, every number here moves.
2. **One oil per reachable cast.** `on-demand` spends at the FIRST lethal point.
   The corpus holds 14 lethal decision points across those 12 casts, and the
   distribution is lopsided: **eleven casts offer exactly one, and `13019682`
   offers three** — the session-65 cast that was abandoned by the token desync,
   resumed, and went on to consume three oils. It was caught, so those extra
   points change no outcome here.
3. **The counterfactual is clean.** The lethal trigger fires at the END of a
   cast, so spending it cannot change any earlier card choice. This is not true
   of the Focus trigger and no equivalent estimate should be made for it this
   way.
4. **The numerator is two casts** (`12975713`, `12991353`). The interval is what
   should be quoted, not the point estimate: somewhere between 0.1 and 1.3 extra
   fish a day.

## What this says about crafting

At the 20-cast daily cap, full Relaxing coverage costs **~2.2 oils/day** and
returns **~0.37 fish/day**, i.e. **~6 oils per extra fish**, with real
uncertainty spanning ~1.5 to ~20 oils per fish. Whether that is worth crafting
time is the user's call — this report exists to make it a priced decision rather
than an open question.

For contrast, the Focus trigger is reachable in **55.0%** of casts and carries
+17.74pp of the policy's +19.40pp in sim. **Focus stock is where the value is**,
and it stands at 18.
