# TIER-1 HARD CORE — the measurement plan, written BEFORE the first Tier-1 run

**Status: PRE-REGISTERED, session 105, 2026-08-28. Nothing here has been run.**
This document authorizes nothing. A live dungeon run still needs its own
explicit human go-ahead under CLAUDE.md rule 11, every time.

It exists so that the session which does run the first Tier-1 entry is not
designing its own measurement while a run-unit ticks down. Session 104 asked
whether that first run should be *shaped* to measure the payout (STATE.md
session 104, open question 2) and flagged the real difficulty: loadout and room
depth vary run to run, so one run might not separate the tier effect from
ordinary variance.

**It does. That is this document's main finding, and it was reached offline.**

---

## 1. What is actually unknown

`dropMultiplier` is **4** at Tier 3 and **1** at Tier 1, and per SPEC §3c it
governs **Hard Core (item 845) only** — Dendren Root (846) answers to `isJuiced`
alone. From that, session 104 derived that Tier-1 Hard Core income falls to
roughly a **quarter**.

That derivation has never been checked against a payout, because **every juiced
`start_run` this bot has ever sent used `index: 3` — 34 of 34** (DECISIONS
2026-08-27). `dropMultiplier` also has **no consumer anywhere in `src/`,
`scripts/` or `tests/`**, so nothing in this repo has ever acted on it either.

Two competing hypotheses, and they are far apart:

- **H1 — `dropMultiplier` governs Hard Core as SPEC §3c says.** Tier-1 pays
  about **1/4** of Tier-3 for the same run.
- **H0 — it does not.** Tier-1 pays about the **same** as Tier-3.

A partial multiplier (say 2x rather than 4x) is a third possibility and the
decision rule below leaves room for it rather than forcing it into H0 or H1.

## 2. The baseline, and why depth is the confound to normalise away

Session 103's four Tier-3 runs are the comparison set. Rooms cleared is read off
the **tier-choice count**, which equals the boon count and equals death room
minus one on all four:

| run | death room | rooms cleared | Hard Core | HC / room | Dendren Root | Root / room |
|-----|-----------|---------------|-----------|-----------|--------------|-------------|
| 25127188 | 9 | 8 | 8,736 | 1,092.0 | 546 | 68.2 |
| 25127745 | 9 | 8 | 8,976 | 1,122.0 | 546 | 68.2 |
| 25127932 | 8 | 7 | 7,152 | 1,021.7 | 420 | 60.0 |
| 25128104 | 7 | 6 | 6,096 | 1,016.0 | 309 | 51.5 |
| **total** | | **29** | **30,960** | **mean 1,062.9** | **1,821** | **mean 62.0** |

**Raw per-run payout spans 6,096 to 8,976 — a 1.47x spread — purely because the
runs died at different depths.** Normalising by rooms cleared collapses that to
1,016–1,122, a **10.4% spread (CV 4.9%)**. So:

> **The statistic is Hard Core per room CLEARED, never Hard Core per run.**

Dendren Root per room is noisier (CV 12.9%) and is not the primary statistic —
it has a different job, in §4.

## 3. Is session 103 a fair baseline, given the loadout moved?

Partly, and the shortfall does not matter **for this question**.

The account's gear changed **twice inside session 103's own batch** (40/22 →
45/20 before run 1, → 50/17 between runs 3 and 4), so runs 1–3 and run 4 are
formally two arms and neither is one arm with 2026-08-26's (DECISIONS
2026-08-27). Session 104 then recorded the user's ruling that the loadout is
expected to **hold steady going forward** — explicitly **not retroactive**.

Strictly, then, the only same-arm baseline is **run 4 alone**: 1,016 HC/room,
n=1.

**Pooling all four anyway is defensible here, and the reason is the effect
size.** The two gear arms differ by about 10% on this statistic. The hypotheses
differ by **300%**. A confound an order of magnitude smaller than the signal
cannot flip the verdict. This licence is granted **for this comparison only** —
it is not a general permission to pool session 103's arms, and any question with
an effect size near 10% must keep them separate.

## 4. The decision rule — fixed now, in advance

Let `r` = rooms cleared on the Tier-1 run and `H` = Hard Core paid.

| `H / r` | verdict |
|---------|---------|
| **< 500** | **H1 confirmed** — `dropMultiplier` governs Hard Core, ~1/4 as derived |
| **500 – 800** | **INCONCLUSIVE** — consistent with a partial multiplier; run more |
| **> 800** | **H0** — the multiplier does NOT govern Hard Core; SPEC §3c is wrong |

Predicted centres: **H1 → 266/room**, **H0 → 1,063/room**. The bands sit ~4.5
Tier-3 standard deviations either side of the boundaries, so this is not a close
call at n=1.

**Validity condition, and it is a real one: `r >= 6`.** Below that the
normaliser is too coarse and a single unlucky room dominates. A Tier-1 run that
dies in room ≤ 5 is **recorded but not scored** — it does not become an
inconclusive result, and it does not get argued into one.

**How many runs: ONE, if `r >= 6`.** This is the answer to session 104's open
question 2. Depth variance was the stated worry and normalising by depth removes
it; what is left is 4x apart. Only the inconclusive band or a short run buys a
second.

## 5. The negative control — the part that catches a wrong story

**Dendren Root (846) must NOT fall.** It answers to `isJuiced`, the run is still
juiced, and `isJuiced` and `index` are independent axes (SPEC §3c/§3f).

So score both:

- Hard Core **down ~4x**, Root **flat at ~62/room** → SPEC §3c is right and the
  effect is specific to `dropMultiplier`.
- **Both** down ~4x → the tier is cutting *all* drops and the `dropMultiplier`
  story is wrong even though its number moved the right way. Do not report H1.
- Hard Core flat, Root flat → H0.

Without this control, a general Tier-1 payout cut would be indistinguishable
from the specific mechanism SPEC claims, and would be written up as confirmation
of it.

## 6. What the run must capture

Read and record, in this order:

1. `npx tsx scripts/checkDungeonToday.ts` — the ledger, **before** and after.
2. The gear reading (`hp`/`armor` max), to state which arm the run belongs to.
3. The `start_run` request body — confirm **`index: 1`** and
   **`inputItems: []`**. `index` is the TIER, not an array position, and
   `entryData` is ordered tier **2, 1, 3** (DECISIONS 2026-08-27). A run that
   sent `index: 2` spends silver rings and measures the wrong thing.
4. `dropMultiplier` as returned on the entry actually used — do not assume 1
   because the flag said 1.
5. Rooms cleared, taken as the **tier-choice count**, not the death room.
6. Hard Core (845) and Dendren Root (846) totals for the run.
7. Potions: 3/3 loaded, per rule 11, so the run is comparable to session 103's.

## 7. What this document does not do

It does not authorize a run, schedule one, or lower the rule-11 bar. It does not
change `--juiced-index=1`, which is a **user directive** (STATE.md's settled
digest) and is not up for re-derivation by whoever measures this.

And until a run happens: **the ~quarter figure stays a derivation.** It may not
be quoted as observed, including by anyone citing this document.
