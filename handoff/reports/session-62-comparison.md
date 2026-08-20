# Rule 8 vs the lowest-tier era — 4-vs-4 historical comparison

**PRE-REGISTERED session 62, 2026-08-20, BEFORE either new run started.**
Committed ahead of the runs deliberately: selecting the comparison group after
seeing today's results is the renegotiation QUESTIONS.md §19 exists to prevent,
and it is unusually easy to do here because the historical arm is sitting in the
corpus waiting to be re-sliced. Brief §2b.

---

## §2c PRECONDITION — the HARD CORES field, settled BEFORE any comparison

**The field is `gameItemBalanceChanges[].id === 845`** (`NAME_CID: "Hard Core"`,
`src/sim/dungeonReport.ts`'s `ITEM_HARD_CORE`) — a TOP-LEVEL array on dungeon
POST responses, sibling to `data`, not inside it. A run's count is the sum of
`amount` over every such entry across all its captured states. It is credited on
`message: "Reward chosen"` responses, i.e. on boon picks.

**First appearance across the whole fixture corpus:**
`fixtures/dungeon-runs/run-2026-08-14-22-02-31/state-001.json`, carrying
`{id: 845, amount: 84}`. Measured by scanning all 2877 `state-*.json` files
under `fixtures/dungeon-runs/` (excluding `raw/`); 136 carry an `id: 845` entry,
274 carry a non-empty `gameItemBalanceChanges` at all, the earliest of those
being `run-2026-08-14-20-05-00`.

**Verdict: the field PREDATES all eight runs, by six days.** The earliest of the
eight is `24924689` at `run-2026-08-20-00-30-50`; the field has been captured
since `2026-08-14 22:02:31`. Independently, all twelve juiced runs on record —
including all eight in this comparison — have at least one `id: 845` entry
actually recorded, so no run's count is an artifact of the field being absent.

**Therefore CLAUDE.md rule 10 does not bite here and the HARD CORES comparison
is available.** This was checked first precisely because it is the single most
likely way this comparison produces a confident wrong answer: session 52
concluded the server had changed when what changed was what was being recorded.
It did not happen this time, and that is a measured result, not an assumption.

No HARD CORES cell is imputed anywhere in this report. Brief §6.

---

## The comparison group, fixed in advance

**Historical arm — the four chronologically immediately preceding juiced runs
from the lowest-tier era**, i.e. the last four by timestamp before rule 8 took
effect on 2026-08-20. Selected by timestamp, not by convenience:

| # | run | capture dir | entry TIER_CID | energy |
|---|---|---|---|---|
| H1 | 24924689 | run-2026-08-20-00-30-50 | 3 | 60 |
| H2 | 24924936 | run-2026-08-20-00-45-21 | 3 | 60 |
| H3 | 24925597 | run-2026-08-20-01-34-30 | 3 | 60 |
| H4 | 24925642 | run-2026-08-20-01-38-22 | 3 | 60 |

These are the last four of session 60's recorded eight lowest-tier juiced depths
(7, 6, 6, 5, 8, 7, 4, 10) — the eight are runs 24890133, 24892362, 24893069,
24893156, 24924689, 24924936, 24925597, 24925642 in that order, and the four
above are its tail. Two older juiced runs exist (24833553 at TIER_CID 1,
24860624 at TIER_CID 3) and are deliberately NOT used: they are not the
immediately-preceding four.

**Rule-8 arm — today's four, two of which already exist:**

| # | run | session | entry TIER_CID | energy |
|---|---|---|---|---|
| R1 | 24943210 | 60 | 3 | 60 |
| R2 | 24945829 | 61 | 3 | 60 |
| R3 | *this session* | 62 | 3 (pre-registered) | 60 |
| R4 | *this session* | 62 | 3 (pre-registered) | 60 |

**Entry conditions are IDENTICAL across the two arms** — every one of the eight
is `TIER_CID 3`, 60 energy, 3 run-units. So §2d's "HARD CORES per energy spent"
is not required to make the totals comparable; it is reported anyway, and it is
necessarily just the totals over a constant divisor. This was checked before the
runs, not asserted.

**If a run is lost** — an assertion halt, a `PerpetualOnlyOfferError`, a guard
trip — the rule-8 arm is three and this is reported as a 3-vs-4, said plainly.
No run from another day is substituted to fill the slot. Brief §2a, §6.

---

## Results — all eight raw runs

Both new runs completed normally. No halt, no `PerpetualOnlyOfferError`, no
guard trip, so the rule-8 arm closed at **four**, as pre-registered. Ledger
verified after each (CLAUDE.md rule 13): `dayProgressEntities` 6 → 9 → 12.

| arm | # | run | depth | **HARD CORES** | Dendren | entry tier | energy | HC/energy |
|---|---|---|---|---|---|---|---|---|
| historical | H1 | 24924689 | room 8 | 6864 | 420 | 3 | 60 | 114.4 |
| historical | H2 | 24924936 | room 7 | 4896 | 309 | 3 | 60 | 81.6 |
| historical | H3 | 24925597 | room 4 | 2976 | 84 | 3 | 60 | 49.6 |
| historical | H4 | 24925642 | room 10 | 8112 | 687 | 3 | 60 | 135.2 |
| rule 8 | R1 | 24943210 | room 5 | 4224 | 141 | 3 | 60 | 70.4 |
| rule 8 | R2 | 24945829 | room 5 | 3840 | 141 | 3 | 60 | 64.0 |
| rule 8 | R3 | 24949925 | room 7 | 6336 | 309 | 3 | 60 | 105.6 |
| rule 8 | R4 | 24949982 | room 7 | 6240 | 309 | 3 | 60 | 104.0 |

### 1. HARD CORES — the primary outcome

| | total | average | median | sd | range |
|---|---|---|---|---|---|
| historical (lowest-tier) | **22848** | **5712.0** | 5880 | 2254 | 2976–8112 |
| rule 8 | **20640** | **5160.0** | 5232 | 1312 | 3840–6336 |

**Difference: −552 per run, −9.7%.** Per energy: 95.20 → 86.00, the same figure
over a constant divisor — every one of the eight is TIER_CID 3 at 60 energy, so
entry costs do not differ and the per-energy row carries no information the
totals do not. That was checked before the runs (§2b), not after.

### 2. Depth — the progression outcome

| | average | median | range | sd |
|---|---|---|---|---|
| historical | **7.25** | 7.5 | 4–10 | 2.50 |
| rule 8 | **6.00** | 6 | 5–7 | 1.15 |

**Difference: −1.25 rooms, −17.2%.**

### 3. Context, reported alongside rather than folded in

- **Player stats are identical across all eight runs** — every one starts
  `hp 30/30, armor 12/12`. Checked directly rather than assumed, because rule 11
  has the user allocating skill points BETWEEN runs and a level-up landing
  mid-comparison would be a confound indistinguishable from the rule. It did not
  happen.
- **Corrode**: run 24949982 met `corrosiveShield` ("Miasmaguard",
  `onEnemyWinExchange_corrode`, amount 3, `moveType: "paper"`, `minTier: 2`) at
  room 5 — a THIRD variant beside session 61's `corrosiveSword`/"Miasmablade"
  and `corrosiveMagic`/"Miasmagem". See §2f below; it produced the corpus's
  first clean NEGATIVE control for the mechanic.
- **Boons**: five first-ever pickup pairs (WeakeningCrit, AddBurnMagic,
  SecondWind, AddVulnerableMagic, Vengeance) — four via the orb fallback, one
  via the priority rule. All five latent. The largest single-session coverage
  gain `BOON_MODELS` has had.
- **Tier gate**: 12 of 12 rooms across the two runs took the top non-Perpetual
  tier. Perpetual filtered the top choice on 4 of 12. No `final-room` case.
- **Mechanics**: 0 first-attempt action failures across both runs, 0 429s, 0
  unknown enums, 0 guard trips. 3 potions used per run.

---

## Classification: **INCONCLUSIVE**

**And a note on the scheme itself, because the result did not land in it.** The
brief's four categories are strong positive (both improve), positive (HARD CORES
improve without meaningful depth regression), tradeoff-or-negative (depth
improves but HARD CORES decline), and inconclusive. **This result is "both point
estimates moved DOWN", which none of the first three describes.** Recording that
rather than forcing the result into the nearest-looking box.

Why inconclusive and not negative:

- **Neither difference is anywhere near distinguishable at n=4 per arm.**
  HARD CORES: −552 against a between-run SE of 1304, |t| = 0.42. Depth: −1.25
  against SE 1.38, |t| = 0.91. Both are well inside noise.
- **The historical arm's own spread swamps the difference.** Its four runs range
  over rooms 4–10 and 2976–8112 HARD CORES — a 2.7x spread within a single arm
  playing a single policy in a 68-minute window. The gap between the arms is a
  fifth of that.

**But do not read "inconclusive" as "neutral".** Both point estimates favour the
lowest-tier era, and the honest one-line summary is: *this data provides no
support for rule 8 improving either outcome, and cannot rule out that it hurts
both.* Rule 8 stands on the account owner's directive, which is a legitimate
basis; it does not stand on this measurement.

---

## The actually useful result: the variance estimate, and what it forecloses

STATE.md's open question 4 asked whether rule 8 needs more runs or a variance
estimate first, and said the variance had to come first. **These eight runs
supply it, and the answer settles the question in a direction nobody has to run
more runs to confirm.**

Taking the lowest-tier arm's own sd (2254 HARD CORES, 2.50 rooms) as the
between-run variance, the sample size needed per arm at 80% power, α = 0.05:

| to detect | n per arm | at rule 11's 4 runs/day |
|---|---|---|
| a 10% HARD CORES difference (571) | **250 runs** | 62 days |
| a 1-room depth difference | **100 runs** | 25 days |

**And the control arm is frozen by user directive, so its n is permanently 4.**
The comparison is therefore not merely underpowered today — it is
**unfinishable**, and no amount of running the rule-8 arm changes that, because
power depends on both arms.

Two consequences worth acting on:

1. **There is no measurement programme to schedule here.** Running further
   juiced runs *to settle rule 8* is not a step toward an answer; it is 62 days
   of spending against a control that will never grow. This vindicates the
   user's directive to stop running lowest-tier controls — that directive costs
   nothing that was ever obtainable.
2. **This is the same conclusion session 57 reached for dungeon strategy
   generally** (DECISIONS 2026-08-20: offline gating of dungeon strategy is
   over; changes are justified by user directive or mechanical obviousness and
   validated by live outcome over *weeks*). The 4-vs-4 puts a number on the
   "weeks": for a 10% effect it is two months per arm.

**Frame, stated plainly as §2e requires.** This is a directional 4-vs-4
historical comparison across a policy change, with a frozen control arm that
will never grow, run once. The two arms were not randomised — the historical
four are four consecutive runs inside one 68-minute window, the rule-8 four span
three sessions over four hours. It is evidence about what happened on eight
runs. It is not proof about what rule 8 does, and after this it cannot become
proof.

---

## §2f — should `onEnemyWinExchange_corrode` be modelled in the sim?

**Recommendation: YES, and the case got materially stronger this session.**

What run 24949982 added, beyond a third variant name:

- **A positive observation with the moveType visible.** Player `shield.currentMax`
  fell 17 → 14 at `state-056` on an exchange the enemy won with `paper`, against
  a `corrosiveShield` buff whose declared `moveType` is `paper`. Amount 3,
  exactly as declared.
- **A clean NEGATIVE CONTROL, which is the new thing.** At `state-062` the enemy
  won an exchange with `scissor` — a non-matching move — and `currentMax` did
  **not** move (14 → 14). Session 61 observed two corrode applications but never
  an enemy win that should NOT have triggered one, so the `moveType` gate was
  declared-but-untested. It is now tested.
- **The within-room scope re-confirmed.** 14 held from `state-056` through
  `state-067` and reset to 17 at the room boundary (`state-068`).

Why it earns its place, in the terms §2f asks for:

- It is **arithmetic on an observable trigger** — subtract a declared `amount`
  from `shield.currentMax` when the enemy wins with a declared `moveType` — not
  a proc chance. That is the whole difference from `rolledEnemyStats`, which
  needs hundreds of observations for 1–5% procs and is why the simulator went
  blind under rule 8 (SPEC §4e).
- Every input is already in the state the sim reads: the buff object is on
  `enemyPathOptions[].enemyBuff`, and the winner and move of each exchange are
  what the combat model already computes.
- **It is now reachable on essentially every run.** `minTier: 2` made it
  structurally unreachable under the pre-2026-08-20 lowest-tier rule; under rule
  8 it appeared in two of the last three runs.

**The honest caveat, which does not change the recommendation.** Positive
observations remain few — two in session 61, one here — and all three are the
same amount (3) on the same field. Modelling it is justified by the mechanic
being *declared in the payload* and *matching on every observation*, not by
sample size. It should be modelled as reading the buff's own `amount` and
`moveType` fields, never as a hard-coded 3 on Sword wins.

**Not implemented this session** — the brief asked for a reasoned
recommendation, not an implementation, and modelling it touches the combat core.
The capture is documented in `tests/enemies.test.ts` so it cannot be lost.


---

## §23 — the (elapsed, drift) pair, and a correction to the prediction's FORM

| session | run | elapsed | committed | observed | drift | `floor(elapsed/3.33)` |
|---|---|---|---|---|---|---|
| 61 | 24945829 | 2.33 min | 60 | 60 | 0 | 0 ✓ |
| 62 | 24949925 | 2.87 min | 60 | 59 | **1** | 0 ✗ |
| 62 | 24949982 | 2.86 min | 60 | 59 | **1** | 0 ✗ |

Both of this session's runs credited back 1 energy against a `floor()`
prediction of 0. At n=3 the floor form is 1 for 3.

**But the misses are the model's FORM, not the mechanic.** `floor(elapsed /
3.33)` assumes the regen clock RESETS AT RUN START. It does not — regen ticks on
its own schedule at `regenPerHour: 18`, i.e. one energy every 3.33 minutes, and a
run simply either straddles a tick boundary or does not. For a run shorter than
one tick interval the right prediction is not a floor but a Bernoulli with
p = elapsed / 3.33:

| run | elapsed | P(tick lands inside the run) | observed |
|---|---|---|---|
| 24945829 | 2.33 min | 0.70 | 0 |
| 24949925 | 2.87 min | 0.86 | 1 |
| 24949982 | 2.86 min | 0.86 | 1 |

All three are consistent with that, and the one 0 landed on the shortest run —
the lowest-probability case of the three. **So the mechanic looks right and the
arithmetic around it was wrong**: a `floor()` over a window shorter than one tick
can only ever predict 0, which makes it unfalsifiable in exactly the regime every
juiced run sits in (2–3 minutes against a 3.33-minute tick).

Worth noting how cheap this was to get wrong in the other direction: two runs
drifting where the model said they would not is the shape of a "the server
changed" conclusion, and CLAUDE.md rule 10 exists because this repo has drawn
that conclusion from thinner evidence. Here nothing changed — the predictor was
never able to say anything else.
