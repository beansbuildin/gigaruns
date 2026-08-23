# BRIEF — session 84 — name the era

## 0. Verification, and I found my own bug

Fresh clone at `984fdae`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Test Files  96 passed (96)
                      Tests  1599 passed | 15 skipped (1614)
```

**Both gates hold.** Session 83 is the best-audited session in this stretch: the
triple reconstruction pinned *before* it was used, the vacuous-clause note, the
"exactly one card moved" trap recorded as a test, and the pre-death retraction
under a within-room control. The retraction in particular is a better result than
the finding it replaces.

### 0a. Why my n=386 did not reproduce — one of the two causes is mine

`played()` in my script was `[c for c in db if c not in da]` — a **set**
membership test on a **multiset**. The corpus has decks with duplicate card ids
(135 states with two copies of some id, 26 with three) and 3 states whose discard
carries a duplicate. When a second copy of a card moved to the discard, `c not in
da` was already false, my list came out empty, and **I silently dropped the
play.**

Re-run with a multiset difference: **386 → 387.** Every cell holds except one
rescue. So one row of the three-row gap is mine, and named. The other two are not
explained and I did not find them; session 83 time-boxed the hunt correctly and
its 389 is the number to use. **The same set-for-multiset defect is in my
triple-matching line too** (`all(c in t for c in hand)`), which is why the
predicate belongs in code rather than in prose — the point session 83 made.

### 0b. A corpus-handling hazard I nearly published

Sorting a cast's states by `createdAt` instead of by file order reorders them —
the timestamps tie — and my focus-oil detector then reported **140** casts where
the file-ordered truth is **13**. Caught only because 140 of 148 was implausible.
**Within a cast, `state-NNN.json` order is the sequence; the server timestamps are
not.** Worth a line in `castTrace.ts` if it is not already load-bearing there.

---

## The clock and the ledger

Written **2026-08-23, ~08:45 PT**. Both ledgers were spent before session 83 and
**roll at 11:00 PT — about two hours out.** After the roll: 12 run-units, 20 casts.

`doctor.ts` first. §1–§3 need neither.

*⚠ `preflight.ts` (~90s) after committing fixtures, before the push.*

---

## 1. The finding: session 83's §3 inversion is a pre-2026-08-21 artifact

### 1a. The measurement

Session 83's sharpest result was that a decision-time signal separates dead hands
at AUC 0.922 — **but the dead hands it finds are ones a redraw cannot fix**,
because **74 of 101 are firing from an exhausted focus meter** and a redraw does
not restore the meter.

That is true of the pooled corpus. It is not true of the bot that exists now.

Plays firing at focus budget 0 (`spent + remaining` = 0), split at the date the
focus-oil policy went live:

```
  BEFORE 2026-08-21   94 casts   404 plays   178 at budget 0   44.1%
  2026-08-21 ONWARD   54 casts   201 plays     3 at budget 0    1.5%
  ALL (what §3 pooled)          605 plays   181              29.9%
```

**A thirtyfold drop.** The focus meter is non-regenerating, so meter-zero is an
**absorbing state** in a cast with no restore and a **transient** one in a cast
with it — which is why the effect is this large and does not need a subtle
control.

The Focus oil is directly visible: `focusMeter` increases by **exactly +2, 21
times, in 13 casts**, and every one fires **0 → 2**. (So add-2 and restore-to-2
remain indistinguishable, confirming session 81 §4e. Those 21 are the same 21 that
break `prev.focusMeter`.) All 13 casts are 2026-08-21 or later; the policy went
`policyApproved: true` in session 62 on 08-20.

### 1b. What it does to the redraw counterfactual

Re-running session 83's table with the era split, multiset predicate:

```
                            n     both  sac  rescue  neither | dead      rescue-rate  cost
  ALL (session 83 pooled)  387     262   26      43      56  |  99 25.6%    43.4%     1.58
  before 2026-08-21        260     153   23      28      56  |  84 32.3%    33.3%     1.71
  2026-08-21 ONWARD        127     109    3      15       0  |  15 11.8%   100.0%     1.33
```

**In today's era there is not one play where both the held hand and the redrawn
hand are dead.** `neither = 0`. Every dead hand — all 15 — is rescued by a
redraw, at a mean **1.33 mana**, on a pool that discards **5.85 per cast**.

Hit-availability, today's era: **88.2% held → 97.6% redrawn, +9.4pp.**

**Session 83's conclusion inverts back.** "The dead hands a signal finds are the
ones a redraw cannot fix" describes the pre-era corpus. With a live focus budget,
a fresh triple can always reach — that is what `neither = 0` says, and it is
structural, not statistical.

### 1c. The three things this does NOT say

1. **n = 15 dead hands.** 15/15 has a 95% lower bound near **78%**, not 100%.
   Report the interval, never the point.
2. **Availability, not hits, and oracle-lensed** — the same lens on both arms, so
   the pairing is fair and the levels are not achievable.
3. **Still not a trigger.** Three sacrifices remain, and the bot cannot see the
   fish's next cell. §3's `heldCoverage` signal is still the candidate; what
   changed is which population it has to work on.

**This does not reopen the CLOSED verdict.** It says the counterfactual that
informs it should be read on the era the bot plays in.

### 1d. And the error class is one this project has now hit three times

"Name the arm" — my §1b, session 80. "Name the arm" again — the 43.9 figure,
session 83. **Now: name the era.** `focusProfileCheck.ts` has carried a
`todaysEraCastIds()` split since session 71, precisely because *"the corpus pools
THREE policy eras and the oldest two are 88 of its 123 casts."* **The redraw
counterfactual did not use it**, and neither did I when I handed the method over.

---

## 2. The part I cannot explain, and it is the better question

The drop is **not** attributable to the focus oil alone. Within the post-08-21
period:

```
  casts that fired a focus oil     13 casts   87 plays   1 at budget 0   1.1%
  casts that did NOT               41 casts  114 plays   2 at budget 0   1.8%
```

**The same rate.** So something *besides* the oil changed at that boundary and
41 casts never needed a restore at all.

Candidates, none costed: session 69's oil-gate hoist changed the decision ORDER
(the oil decision now sits above the card choice); the matcher-weighting era
boundary the repo already dates at **2026-08-20T18:27Z**; the focus-reserve
weight. **`todaysEraCastIds()` already computes a split on that boundary** and is
the instrument to attribute this with.

**This matters beyond redraw.** If a change around 08-21 took focus exhaustion
from 44.1% to 1.5% of plays, it is the largest live behavioural improvement in
this project's record and **nobody has attributed it or written it down.** It is
also independent live support for the *mechanism* under OIL-POLICY's largest
suspended term — `focus-when-empty-only`, +17.74pp of the +19.40pp, justified as
*"at zero the policy is frozen onto whichever cell it last occupied"*. **The
mechanism now has live evidence the number never had. The number stays
SUSPENDED** — it was computed on the bare arm and §0a is not lifted by this.

---

## 3. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6, and every count
ships with its predicate.

1. **The era split reproduces and is wired into the counterfactual report.**
   Reproduce **44.1% / 1.5% / 29.9%** over 404 / 201 / 605 plays, and the
   era-split table of §1b, **with the era predicate written out** — and prefer
   `todaysEraCastIds()` to my date literal if it agrees, saying so either way.
   Pin **`neither = 0` in today's era** and report the rescue rate as an
   interval, not a point (§1c).
2. **The 44.1% → 1.5% drop is attributed.** How much is the focus oil, how much
   is whatever else changed at that boundary (§2)? A decomposition, or — if the
   corpus cannot separate them — **that stated as the finding**, with what would
   separate them. Rule 6: say which it is.

Not gated, do if there is room: re-run §3's `heldCoverage` separability on
today's era alone. Its dominant class was the budget-0 hands; with those gone,
whether the signal survives at all is unknown and is the thing a shadow design
needs.

**What would make these unmeetable:** nothing. Both run on committed fixtures.
**If §1's table does not reproduce, that is the finding** — mine has now failed to
reproduce three times, and one cause is named in §0a.

---

## 4. Session 83's open questions

- **`run_over`'s convergence.** Extracting one `finishRun(reason, room)` that both
  exits call is right, and the gate — demonstrate the reporting on a replayed run
  of each shape, offline, before trusting it live — is well-formed and meetable
  with existing fixtures. **I would take it.**
- **The depth-matched pre-death control needs runs that survive past room 7, and
  the corpus has none.** That is a capture request, and rule 6 says name it as one
  rather than gate on it. **I would state the run count and park it**; the
  question is real but it is not this session's.
- **The shadow evaluation.** §1 changes its design: the candidate population is
  now 11.8% of plays, not 26%, and `neither = 0` means the trigger's job is
  detection, not selection. That is a **live-path instrumentation change** and
  needs the user's go-ahead; it is worth asking for now that the target is this
  much cleaner.
- **Whether §2 changes the CLOSED verdict remains the user's call**, and §1
  strengthens the case without settling it: the price was quoted against a
  resource 89.8% of casts do not exhaust, and on today's era the rescue set is
  small, cheap, and complete.

---

## 5. Do not

- **Do not read §1b's 100% as 100%** (§1c). n=15.
- **Do not flip `redrawEnabled`**, recalibrate `REDRAW_THRESHOLD`, or fix the two
  correctness gaps yet. The verdict is the user's and the measurement is still
  offline-only.
- **Do not treat §2's drop as proven to be the focus oil.** Post-era casts that
  fired no oil read the same rate.
- **Do not un-suspend +19.40pp.** The mechanism gained live support; the number
  did not. §0a stands, **do not quote it**.
- **Do not sort a cast's states by `createdAt`** (§0b).
- **Do not reorder CAPTURE-1** — dead as posed, and the replacement needs a
  capture (§4).
- Standing, none re-opened: do not build H2's proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD` / `chooseNewCard` UNTOUCHED; `boonCapture` OFF; no
  429 backoff without an observed 429; do not shuffle the random-sample deck; do
  not complete the corrode perpetual table; do not re-run the oil sweep on any
  current arm.
- **Do not start a dungeon run without `--dry-run`, `doctor.ts` and a per-run
  go-ahead**, and never chain runs.

---

## 6. After 11:00 PT, if the user gives a go-ahead

12 run-units and 20 casts. Unchanged in priority:

- **The crit rule still has two members** and needs one base-6/8/10 crit; card 10
  (crit 10) is in the deck — ×1.5 → 15 against ×1.6 → 16. Watch `critEffects`,
  not `hitEffects`, and remember the two crit sources compose.
- **An oil consumed at a NON-ZERO focus meter** settles add-2 vs restore-to-2. All
  22 on record fired at 0. §1a says today's bot reaches meter 0 on 1.5% of plays,
  so this capture is getting *harder*, not easier — worth saying out loud.
- **Ordinary casts now buy more than they did**: every one adds to a 127-play
  today's-era sample that §1b's whole result rests on, and that sample is the
  smallest thing in this brief.
- **Dungeon runs** remain worth one go-ahead each for the `evSupported` telemetry.

---

## 7. Corrections to me

- **I shipped a method with a set-for-multiset bug in two places and a count with
  no predicate.** Session 83 paid for both — a session spent failing to reproduce
  386, and a trap ("exactly one card moved") that my English sentence created.
  **§0a is me finding one cause; two rows remain unexplained and I am not
  claiming otherwise.**
- **I handed over a corpus-wide measurement without splitting the era**, on a
  corpus this repo has known pools three policy eras since session 71, using an
  instrument (`todaysEraCastIds`) that already exists. That is the third instance
  of the same class in five sessions, and the first two were mine as well.
- **§0b is a near-miss I want on the record**: I had a table of 140 focus-oil
  casts ready to publish and it was an artifact of my own sort order. What caught
  it was 140 of 148 being implausible, not a check. **The check should not be
  incredulity.**
- **Rule 9 applies.** §1 and §2 are measurements over committed fixtures at
  `984fdae`; a live response that disagrees wins, and the correction goes in the
  recap.

---

## Your task (session 84)

1. `doctor.ts` first. Both ledgers roll at 11:00 PT; report them.
2. **§1 / gate 1** — reproduce the era split and the era-conditioned table, with
   the predicate in code and `todaysEraCastIds()` preferred to a date literal.
   Report the rescue rate as an interval.
3. **§2 / gate 2** — attribute the 44.1% → 1.5% drop, or state that the corpus
   cannot and what would.
4. **§4** — `finishRun` with its offline gate; park the depth-matched control as
   a named capture; put the shadow design to the user now that the target is
   cleaner.
5. **§6** — only past 11:00 PT and only with a go-ahead.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` after committing
   fixtures and before the push**, no test writes a real data path, secret scan.

**Honest expectation.** §1 is the useful half and it cuts both ways: it revives
the redraw's rescue case on the era that matters, **and** it says the corpus this
project has been measuring for twenty sessions is 64% a bot that no longer exists.
**The satisfying version of this session is gate 2 finding what changed on
2026-08-21** — a thirtyfold drop in the dominant failure mode, currently
unattributed and unwritten-down, is a larger result than anything redraw can
offer. **The unsatisfying version is that the corpus cannot separate the oil from
whatever else moved**, and then the finding is that the biggest live improvement
on record happened without anyone noticing, and the era split has to go into every
instrument before the next one does.
