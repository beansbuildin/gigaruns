# BRIEF — session 72

## The clock and the ledger

Written **2026-08-21, 17:15 PT**. *Source: session 71 live-read.* Fishing game
ledger **16/20** — four casts remain today; dungeon **0/12**. Rollover **11:00 PT
tomorrow**.

**This brief authorizes FISHING CASTS (§3) and ZERO dungeon runs.** `doctor.ts`
first; read both ledgers and report them before spending anything.

*Environment, sessions 66–71: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. The sim's catch gap — test the oil hypothesis BEFORE anything else

*Source: session 71.* Sim (live config, Shroom deck, n=4000) catches **24.7%**;
today's policy era catches **60.0%** (21/35, 95% CI [43.6%, 74.4%]). Session 71
calls this the open disagreement and a bigger one than the focus profile ever was.

**User hypothesis, 2026-08-21, and it is the right first check: is the sim simply
not using oils?**

*Source: session 65's changelog —* `src/sim/fishing/castSim.ts | 90 (oils,
**opt-in** and additive)`. If oils are opt-in and the live-config arm does not opt
in, then the comparison is **a no-oil simulator against an oil-heavy era**:
session 69 alone ran 10 casts with 10 oils and caught 8.

**Note what this is not.** The sim does not average historical catches — it plays
forward and produces its own rate — so pre-fix casts cannot be dragging it down.
That was the user's other hypothesis and it is ruled out by construction; say so.

### 1a. The comparison that settles it

- **Check whether the live-config arm enables oils.** One read of the config.
- **Then compare like with like.** Today's era contains both oil and non-oil
  casts, and `classifyOilArm` already splits them (session 62). Report:

  | arm | live (today's era) | sim |
  |---|---|---|
  | no-oil casts | ? | oils off |
  | oil casts | ? | oils on |

- **Report both n's.** Splitting 35 casts by arm leaves small numbers on each
  side; a 60% that rests on 12 oil casts is not the same claim as one resting on
  35.

**If the gap closes, session 71's "worse than the focus profile" framing is
retracted and the sim is not broken on this axis** — say that plainly rather than
letting the alarming version stand. **If it does not close, the gap is real and
the sim's fate becomes a live question again**, which is where the user left it.

---

## 2. Recalibrate `REDRAW_THRESHOLD`

**User decision, 2026-08-21: this is session 72's build.**

*Source: sessions 70–71.* Redraw is **confirmed, wired, guarded and OFF**.
`buildFishingEnvelope` throws on a `play_cards` with absent or empty `cards`;
`buildRedrawEnvelope` is the only producer of `cards: []`. §1 of session 71
restored the instrument this was waiting on — **era-matched replay reproduces
live's opening move on 86% and 93% of casts.**

### 2a. What went wrong last time, so it is not repeated

*Source: `cardChoice.ts` §5 comment.* The one prior calibration triggered redraw
**almost every turn**: the loss mix flipped from **89% `escaped_meter` to 78%
`escaped_mana` at a mean of 1.29 turns per cast** — repeated redraws burning mana
before a card was ever played. **The threshold that produced that is still the
shipped constant.**

Its stated cause is diagnosable: the trigger was calibrated on "is EV/mana bad",
and the objective later stopped being EV/mana — cards are now chosen for hit
probability, so a good card can have a legitimately low EV/mana and trip a
threshold meant to catch bad ones.

**So do not tune the old trigger's number. Re-derive what the trigger should
test.** A redraw is worth its cost when the hand cannot connect, not when the
hand scores poorly per mana.

### 2b. Calibrate on the replay, and state the era

- **Use era-matched replay, not `castSim`** — it is the instrument that passed,
  and only on today's era. *Session 71:* an era is a **bundle, not a knob**, so a
  calibration derived on today's era is a claim about today's era only.
- **Redraw costs 1 mana per card held** (user-stated, and consistent with every
  card's `manaCost: 1`) and always returns three. Mana is `playerHp`, max 10, so
  a 3-card redraw is 30% of the cast's whole budget. **Report the calibration in
  mana spent per extra fish**, the same currency §66 used for oils.
- **Pin both degeneracies** — a threshold that redraws every turn and one that
  never redraws must both fail a test, the way session 67 pinned the oil gate.
- **Do not enable it live.** Recommend, with the causal story. Shipping is the
  user's call and it is a live-policy change.

---

## 3. Casts — build today's-era sample

**User decision, 2026-08-21: accumulate casts and read the 60% properly.**

*Source: session 71.* Today's era is **21/35 = 60.0%, CI [43.6%, 74.4%]** — a
±15pp interval. Roughly 90 casts in this era would read it to ±10pp.

- **Cast the day's available allowance**, in batches of 5 with a hand-back after
  each. Four remain today; twenty after the 11:00 rollover.
- Policy **unchanged** — `onDemandTriggers`, Relaxing capped at 2 per cast, never
  force a consume. Shadow stays on the exchange threshold.
- Halt on: the batch count; the ledger short; the 15-cast zero-streak tripwire.
- Rule 13 after each batch: read the ledger and confirm it moved by exactly the
  casts sent. *Session 70 precedent:* docId **13024510** was charged energy and
  never ticked `dayDocs`, server-side and unexplained — the reconciler now defers
  to the game in both directions, so a repeat should be visible, not silent.

### 3a. Two things that keep the sample honest

- **Every new cast is today's era only if nothing in the bundle changes.** If the
  rod, lures, zone map or matcher weighting change mid-sample, **the era breaks
  and the sample splits.** Say so at the point it happens rather than discovering
  it three sessions later — that is the exact failure §1 of session 71 corrected.
- **Report the running rate with its Wilson interval every batch**, and resist
  reading a good batch as progress. *Session 62's arithmetic still holds:* the
  best 5-cast window in the whole corpus is 3/5, and it is the maximum over 85
  overlapping windows.

---

## 4. `focusBudget` — record why the sweep is not worth running, with the caveat

*Source: session 71.* The module exists because meter-out was **80.8%** and the
opening move spent **1.62 of 3**. On the era the shipped policy plays, meter-out
is **34.3%** and the opener spends **0.83**.

**So `costCap(2)` has nothing to cap** — that is why the sweep read `+0/−0`. The
arm was inert because it was **never exercised**, which is a finding about the
fishery, not a measurement failure. Record it in `DECISIONS.md` so nobody
rebuilds it, and note that the user's opening-turn directive is **substantially
already satisfied**.

**But do not close the file on the premise.** Two things remain true together:

- The opener is gentle now (0.83).
- **The meter still empties in about a third of casts** (34.3%), and the cast the
  user watched hit **0/3 by turn 3**.

`costCap` bounds a *single* move; a meter draining over several turns is a
**cumulative** problem, which is what the `schedule` family addresses. **If any
focus arm still has work, it is `schedule`, not `costCap`** — say that in the
record rather than retiring the whole module on one arm's inertness.

---

## 5. Carried

- **+19.40pp stays SUSPENDED** (`OIL-POLICY.md` §0a, `DECISIONS.md`). Do not
  quote it. It needs a sim arm passing a profile check, and the bare-default arm
  is nowhere near one — **meter-out 1.0%, catch 69.7% against a real 34.3% and
  60.0%.** §1's oil check does not license re-running the oil sweep.
- **The certainty gate is a proven live no-op** — 0 of 9 Relaxing firings held;
  the exchange threshold would have held 2. Shadow stays on the exchange
  threshold. Nothing oil-related ships.
- **The crit source is USER-STATED, not confirmed.** The control is the evidence:
  443 lure-free plays, 0 crits, upper bound 0.86%. Sticky Lure ambiguity intact;
  crit damage rule OPEN at n=1.
- **`REAL_DECK` is the Shroom deck, defined once in `src/sim/fishing/rodDeck.ts`**,
  with a test that fails when it diverges from the rod the account holds. The
  hardcoded-path ratchet is **26** and that is correct — it caught the new module.
- The `nextPosition` tripwire has still never met a real miss — **do not budget
  casts for it.**
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability guard;
  §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture` settled OFF;
  do not fold stock into the oil threshold; distribution steps 3/4/6 are the
  user's; `preflight.ts` in CI still open since session 68.

---

## 6. Gate

Both halves are offline and deterministic; neither depends on the batch's
outcome.

1. **The oil hypothesis is answered with a like-for-like table** (§1a): whether
   the live-config arm enables oils, and today's-era catch split by oil arm
   against the matching sim arm, **with both n's**. A verdict either way meets the
   gate; a comparison that leaves the arms mismatched does not.
2. **The re-derived redraw trigger is pinned at both degeneracies** — a test
   fails for a threshold that redraws every turn and for one that never redraws,
   each demonstrated failing then restored. **A recalibrated number without both
   pins does not meet this gate**, because the failure mode on record is exactly
   the always-fire degeneracy.

---

## 7. Do not

- **Do not run a dungeon run.**
- **Do not enable redraw**, and do not ship any focus policy, oil gate or
  threshold. Recommend and shadow.
- **Do not tune the old redraw trigger's constant** — re-derive what it tests
  (§2a).
- **Do not re-run the oil sweep** or quote +19.40pp (§5).
- **Do not read a good 5-cast batch as progress** (§3a).
- **Do not let a bundle change pass unremarked mid-sample** (§3a).
- **Do not retire `focusBudget.ts` wholesale** on `costCap`'s inertness (§4).
- Do not present a `castSim` result as evidence about live play — only the
  era-matched replay has passed a profile check, and only on today's era.
- Do not read a `GearInstance` suffix as an equip time.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me

- **Both replay-gap candidates I named were nil, and the one I called leading was
  worth −0.020 in the wrong direction.** Leave-one-out was my headline
  hypothesis; truncation was **exactly 0.000** and structurally could never have
  mattered, since it removes tail turns and the divergence was entirely at turn 0.
  I should have noticed that before naming it.
- **The gate is what saved this, and it was the right gate for the wrong reason.**
  I required a decomposition with an explicit residual because I expected the
  named causes to be partial. They were not partial — they were absent, and the
  real cause was one I had not considered at all: **live's 1.08 pooled two policy
  eras.** A brief that had asked "confirm leave-one-out is the cause" would have
  got a confirmation-shaped answer.
- **I passed on session 70's correction of session 49's numbers, and that
  correction was itself wrong.** 80.8% meter-out and 1.62 opening spend were
  never stale — they are exactly right for the 73-cast era they were computed on.
  **The defect was pooling, not age**, and I repeated "the numbers behind it
  moved" without asking *which corpus each number described*. Recomputing a
  statistic over more data is not how you fix a stale one.
- **The through-line across §8s: I keep accepting a frame and checking the
  arithmetic inside it.** Pooled-vs-era, sim-vs-live, mint-vs-equip stamp — each
  time the numbers were fine and the population they described was not. The
  question that would have caught all three is the same one: **what exactly is
  this number computed over?**

---

## Your task (session 72)

1. `doctor.ts`, read both ledgers, report them.
2. **§1 / gate 1** — the oil hypothesis, like-for-like, with both n's. **Before
   anything else**, since it may retract session 71's framing.
3. **§2 / gate 2** — re-derive the redraw trigger on era-matched replay, report in
   mana per extra fish, pin both degeneracies. **Do not enable it.**
4. **§3** — cast the day's allowance in batches of 5, hand back after each,
   running rate with its interval every batch.
5. **§4** — record `costCap`'s inertness as a finding, with the `schedule` caveat
   intact.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 is small and may retract the largest-sounding claim in
session 71's recap, which is a good use of a first hour. §2 is the session's real
build and its risk is well documented: the previous calibration failed by firing
almost every turn, and the shipped constant is still that one. **The result worth
being suspicious of is a recalibration that looks obviously better** — the same
shape of confidence preceded the 1.29-turn casts, and the only defence in the
brief is that both degeneracies have to fail a test before the number is believed.
