# TIER-1 HARD CORE — the RESULT

**Companion to `handoff/TIER1-MEASUREMENT.md`, which was written BEFORE any
Tier-1 run and is NOT edited by this document.** A pre-registration that gets
revised once the numbers are in stops being one. Where the plan was wrong, it is
corrected *here*.

**Executed session 106, 2026-08-28. Four juiced Tier-1 runs, 12/12 run-units,
240 energy, 0 rings.**

---

## Verdict: **H1 CONFIRMED.**

`dropMultiplier` governs **Hard Core (item 845) only**, exactly as SPEC §3c
says. Dendren Root (846) does not move. The multiplier is **4:1 exactly**.

| run | id | death | **r** | Hard Core | H/r | Root | scored? | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | 25165690 | 5 | 4 | 1,152 | 288.0 | 141 | no, `r < 6` | — |
| 2 | 25165963 | 6 | 5 | 1,452 | 290.4 | 216 | no, `r < 6` | — |
| 3 | 25166186 | 7 | **6** | 1,560 | **260.0** | 309 | **yes** | **H1** |
| 4 | 25166314 | 10 | **9** | 2,268 | **252.0** | 687 | **yes** | **H1** |
| | | | **24** | **6,432** | | **1,353** | | |

Pre-registered rule: `H/r < 500 -> H1`. Predicted H1 centre **266**.
Observed **260.0** and **252.0**.

**Runs 1 and 2 read 288.0 and 290.4 — the same answer — and were still not
scored.** `r >= 6` was fixed in advance and a rule kept only when it agrees with
you is not a rule.

## Pooling, checked before doing it
The two valid runs sit **3.1%** apart against a hypothesis gap of **300%** — the
same argument §3 used to license pooling the gear arms. **Pooled H/r = 3828/15 =
255.2.**

## The exact result: divide out the quantum
Every Tier-3 per-room amount is divisible by **48**; every Tier-1 amount by
**12**; `48 / 12 = 4`. So payout is `base x 12 x dropMultiplier`, and the two
arms can be compared on `base` with depth removed entirely:

| | rooms | Hard Core | quantum | base units | **mean base** |
|---|---|---|---|---|---|
| **Tier 3** (session 103, 4 runs) | 29 | 30,960 | 48 | 645 | **22.24** |
| **Tier 1** (session 106, 4 runs) | 24 | 6,432 | 12 | 536 | **22.33** |

`30,960 = 48 x 645` exactly. `6,432 = 12 x 536` exactly. **The base draw is the
same to within 0.4%; the entire difference is the multiplier.** Naive HC/room
1,067.6 vs 268.0 gives **3.984**.

Per-run ratios range 3.72–4.47 depending on which rooms are compared. **Those
are base-sampling noise around an exact 4 — quote the quantum, not a ratio.**

## The matched pair
Session 103 run 4 and session 106 run 3: both **r = 6**, both gear **50/17**,
both 3/3 potions, both juiced, differing **only** in entry tier.

| | Tier 3 | Tier 1 | ratio |
|---|---|---|---|
| Hard Core | 6,096 | **1,560** | 3.908 |
| Dendren Root | 309 | **309** | **1.000** |

## The negative control — and the plan's one error
**§5 fixed the control as "Root flat at ~62/room". That is WRONG.** Root per
room is **not** flat; it grows with room index:

> **5, 9, 14, 19, 25, 31, 37, 42, 47** — credited **3x per room**.

The ~62 was a depth-average of session 103's runs, confounded in exactly the way
§2 warned Hard-Core-per-run was. Corrected here rather than in the plan.

**The control passes anyway, and far more sharply than §5 asked for**: matched
by room index the sequence is **identical to the unit** in both tiers, on all
four runs. Run 4's room 9 (**47**) extends it one room past anything Tier-3 ever
captured. Root did not move, so the cut is specific to `dropMultiplier` and is
not a general Tier-1 drop cut — the discrimination §5 existed to make.

## §6's capture list, corrected
- **§6.3 asks to confirm `inputItems: []` in the `start_run` body. There is no
  such key.** The body is
  `{consumables:[131,131,131], isJuiced:true, index:1, itemId:0,
  expectedAmount:0, gearInstanceIds:[], devBoons:[]}`. `inputItems` lives on
  `entryData[].inputItems` — the tier's COST (Tier 1 `[]`, Tiers 2 and 3 seven
  ids each). **Confirm zero rings via the absence of negative
  `gameItemBalanceChanges`** — there were none on any of the four runs.
- **§6.4 asks for `dropMultiplier` as returned on the entry used. It is not
  returned on any run response** — 0 occurrences across all four logs. It exists
  only on `entryData` (T1 1, T2 2, T3 4). The instruction cannot be satisfied as
  written; the payout itself is the check.

## What this does NOT establish
- Tier 2 (`dropMultiplier` 2) is untested. The model predicts a quantum of 24.
- Nothing here says whether Tier-1 is the right economic choice. It measures the
  cost the user already accepted when they set the directive.
