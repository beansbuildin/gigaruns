# BRIEF — session 85 — the sim has never run the shipped policy

## 0. Verification

Fresh clone at `c52ebad`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Test Files  98 passed (98)
                      Tests  1637 passed | 15 skipped (1652)
```

**Both gates hold.** Session 84 is the best session in this run. Three things
stand out and should be kept as method, not just as results:

- **`todaysEraCastIds()` was preferred, tried, and rejected on evidence** — it
  reads `data/`, sees 81 of 148 casts, names a different boundary, and the five
  casts between the boundaries read the OLD regime. That is the right way to
  handle a brief's suggestion.
- **The decomposition ships with three controls and the cause of its largest
  term is stated as unknown** rather than papered over.
- **`finishRun`'s gate was demonstrated FAILING** on the regression it exists to
  catch, and both run-end shapes replay offline.

Corrections to me taken: my 605/404/201 play counts do not reproduce (612/410/202
is STATE.md's own documented figure); my "+2 exactly, 21 times" was read off raw
fixtures including the `use_fishing_item` response, while `castTrace.ts` skips it
— both right about different things, and the trace-level reading is the one an
instrument should use.

---

## The clock and the ledger

Written **2026-08-23, ~10:00 PT**. Both ledgers spent; **they roll at 11:00 PT,
about an hour out.** After the roll: 12 run-units, 20 casts.

`doctor.ts` first. §1–§3 need neither.

*⚠ `preflight.ts` (~90s) after committing fixtures, before the push.*

---

## 1. The pacing term: the bot stopped OVERSHOOTING, and the target never moved

Session 84 identified the proximate mechanism as first-play focus spend
**1.553 → 0.852, never 3**. That is one number; it does not separate *"the fish
was easier to reach"* from *"the bot aimed more cheaply."*

I computed the second half. For every cast's opening play: the **minimum** focus
move distance from (2,2) at which **some card in the held hand** covers the fish's
actual resolution cell — the cheapest move that could have worked, oracle-lensed
identically in both eras.

```
              casts   opening-hand    actual first    optimal move    OVERSPEND
                       footprint       move spend       distance
  before        94      7.38 cells        1.553           0.66          +0.89
  today         54      7.20 cells        0.852           0.65          +0.20
```

**The optimal move is unchanged — 0.66 against 0.65.** The distributions match
too (distance 0 on 44% / 48%, distance 1 on 46% / 39%). What collapsed is the
**overspend: 0.89 → 0.20.**

This is a stronger control than intrinsic reach, and it closes three doors at
once. The targets did not get closer, the hands did not get wider (7.38 vs 7.20
cells), and the opening focus point is **(2,2) in 147 of 148 casts across both
eras**. Whatever changed, it changed how far the bot *chooses* to move — nothing
about what it was moving toward.

### 1a. The series steps; it does not trend

If the cause were a learned model sharpening as the mined corpus grew, overspend
should decline gradually. Per day:

```
  08-15 +1.00 (n=5)   08-17 +1.15 (n=40)   08-19 +0.84 (n=38)   08-21 +0.10 (n=30)
  08-16 +0.80 (n=5)   08-18  n=1 (resumed) 08-20 −0.40 (n=5)    08-22 +0.25 (n=16)
                                                                08-23 +0.50 (n=8)
```

**It steps.** And today's era drifts back *up* (+0.10 → +0.25 → +0.50) rather
than continuing down, which is what a still-improving model would do. **That
argues against the learned state and for a discrete change** — the alternative
session 84's open question 1 named as the fallback.

**One caution that matters for dating it:** the five 08-20 casts already read
−0.40, i.e. the new regime, and they are stamped **before** sessions 61/62's
commits (11:27 PT against 13:33 and 15:59 PT). At n=5 that is not evidence, but it
means **the corpus cannot date the change more precisely than "between 08-19 and
08-21"**, and the 61/62 window is not as clean as the 20.3h gap makes it look.
Say so before spending a session replaying two commits.

---

## 2. The finding: every sim arm runs a policy the live bot does not

**`DEFAULT_FOCUS_RESERVE_WEIGHT = 3`** (`cardChoice.ts:133`), and it is passed by:

```
  scripts/liveFishing.ts:1536      deps.focusReserveWeight ?? DEFAULT_FOCUS_RESERVE_WEIGHT   → 3
  src/sim/fishing/offPolicyReplay.ts:577   opts.focusReserveWeight ?? DEFAULT_...            → 3
```

and **not** by any `castSim` arm:

```
  makeMatcherFishPolicy(redrawThreshold, heuristicsEnabled = true, focusReserveWeight = 0)

  scripts/focusProfileCheck.ts:220     makeMatcherFishPolicy(REDRAW_THRESHOLD, true)   → w = 0
  scripts/damageEconomy.ts:108         makeMatcherFishPolicy(REDRAW_THRESHOLD, true)   → w = 0
  scripts/redrawCounterfactual.ts      same                                            → w = 0
```

**The live bot has run with a focus-reserve weight of 3 since session 45. Every
simulator arm in this repo has run with 0.** The policy even names itself —
`matcher-ev(redraw=0,w=0)` — and that label has been printed in every sim report
for forty sessions.

### 2a. What this does and does not explain

**It does NOT explain the era boundary.** `git log -S` shows one commit ever
touching that constant — session 45's — so it did not change on 08-20/21 and
session 84's conclusion stands.

**But the reason given for dismissing it does not.**
`scripts/redrawCounterfactual.ts:460` reads *"focusReserveWeight defaults to 0 and
costCap is documented inert"* — the **sim's** default, used to reason about the
**live** path, in the file investigating live focus pacing. That is the fourth
instance of this class in six sessions: name the arm, name the arm, name the era,
and now **name the caller.** The right check reaches the same answer, which is
luck rather than method.

### 2b. Why it matters anyway — and it is free to test

The term this parameter controls is *exactly* the quantity under investigation. It
is a penalty on spending focus; live it is on at 3, and every sim arm has it off.
So:

- **§0a's focus-profile mismatch has a named, unexamined candidate.** Session 79
  §2 found the live-config arm's per-turn focus profile "essentially closed" at
  **w = 0**; nobody has asked what it reads at **w = 3**, the value live runs.
- **Session 84's own decomposition** attributes −18.2pp to focus pacing. If the
  sim's pacing is structurally different from live's by a shipped constant, every
  focus-adjacent sim figure inherits it.
- **The cost is one flag.** `makeMatcherFishPolicy(REDRAW_THRESHOLD, true,
  DEFAULT_FOCUS_RESERVE_WEIGHT)` in the three scripts, run both ways, report the
  delta.

**Do not just switch it.** Run both arms and report both — w=0 is what every
historical figure was computed on, and changing the default silently would move
numbers this repo has spent forty sessions pinning. **The deliverable is the
delta, not a new default.**

---

## 3. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6, predicates in code.

1. **The overspend control reproduces and ships as a metric.** Reproduce
   **0.66 / 0.65 optimal, 1.553 / 0.852 actual, +0.89 / +0.20 overspend**, over
   94 / 54 casts, with the predicate written out — and assert the opening focus
   point is (2,2) on 147 of 148, since the whole control rests on it. **Report
   the daily series (§1a) too**, because "it steps, it does not trend" is the part
   that bears on open question 1.
2. **Every sim arm is run at BOTH `w = 0` and `w = DEFAULT_FOCUS_RESERVE_WEIGHT`,
   and the delta is reported** — `focusProfileCheck`, `damageEconomy`,
   `redrawCounterfactual`. **Nothing's default changes.** The profile check's
   verdict at w=3 against live's per-turn profile is the number that matters; if
   it moves the arm toward live, say by how much, and if it moves it away, say
   that instead.

**What would make these unmeetable:** gate 2's profile check needs `data/` for
the live-config arm. **If it cannot run in your tree, say so at the top and report
the bare arm's delta explicitly labelled** — do not let a missing input become a
silent w=0 result, which is the failure `requireInputs.ts` exists to stop.

Not gated: §1a's dating caveat is worth one line in `castEra.ts`, since the next
reader will otherwise take the 20.3h gap as a clean bracket.

---

## 4. Session 84's open questions

- **§1 (the off-policy replay of the 61/62 policies).** §2 lowers its value:
  those commits are oil plumbing, and the one focus-related constant in the path
  did not move in that window. §1a lowers it further — five 08-20 casts already
  read the new regime, before those commits. **I would run gate 2 first.** If the
  sim at w=3 reproduces live's pacing, the question becomes "what set w's
  *effective* value differently", which is a much narrower search than replaying
  two whole policies. **If gate 2 moves nothing, then the replay is the next
  step and it is worth its session.**
- **§26 (the shadow evaluation).** §7a made it clearly worth asking for: `wasted`
  is structurally zero, and K=7 gets 7 rescues for 0 sacrifices unconditioned.
  **It needs a yes/no from the user** and nothing should be written until it
  comes.
- **§25 (the depth-matched pre-death control) — I agree with DROP.** Two to three
  full days of the run cap, each run individually approved, to re-ask one
  retracted finding. Recommend it as a drop and let the user overrule.
- **The era split going into the next instrument.** `castEra.ts` exists;
  gate 2's runs are the first chance to use it by default rather than as an
  afterthought.

---

## 5. Do not

- **Do not change any default.** Gate 2's deliverable is a delta, not a new
  `focusReserveWeight` (§2b). Forty sessions of figures were computed at w=0.
- **Do not read §1 as identifying the cause.** It rules out the target, the hand
  and the opening focus. It does not name what changed.
- **Do not treat the 20.3h gap as a clean bracket** — the 08-20 casts sit on the
  new side of it at n=5 (§1a).
- **Do not un-suspend +19.40pp** whatever gate 2 shows. §0a stands.
- **Do not flip `redrawEnabled`**, recalibrate `REDRAW_THRESHOLD`, or write the
  shadow instrumentation before the user answers §26.
- **Do not import `todaysEraCastIds()` into a committed test** — session 84
  settled that it is not portable.
- Standing, none re-opened: do not build H2's proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD` / `chooseNewCard` UNTOUCHED; `boonCapture` OFF; no
  429 backoff without an observed 429; do not shuffle the random-sample deck; do
  not complete the corrode perpetual table; do not re-run the oil sweep on any
  current arm.
- **Do not start a dungeon run without `--dry-run`, `doctor.ts` and a per-run
  go-ahead**, and never chain runs.

---

## 6. After 11:00 PT, with a go-ahead

12 run-units, 20 casts.

- **The crit rule** still has two members and needs one base-6/8/10 crit; card 10
  (crit 10) is in the deck — ×1.5 → 15 against ×1.6 → 16. `critEffects`, not
  `hitEffects`; the two sources compose.
- **An oil at a NON-ZERO meter** settles add-2 vs restore-to-2, and §5 of session
  84 is right that this is getting *harder*: today's bot reaches meter 0 on 1.5%
  of plays. If it matters, it may need to be set up rather than waited for — and
  that is a live-policy deviation, so it is the user's call, not a capture to
  quietly arrange.
- **Ordinary casts** still buy the most: today's era is 54 casts / 202 plays and
  every result in the last two briefs rests on it.
- **Dungeon runs** remain worth one go-ahead each for the `evSupported` telemetry
  — now that `finishRun` exists, the `EV support: n/m` line will actually print.

---

## 7. Corrections to me

- **My play counts failed to reproduce for the third time** (605 against 612).
  The cast counts agreed exactly, which is the tell that my play predicate is
  wrong rather than my era predicate — and §0a of the last brief already found one
  set-for-multiset bug in that same function. **I am no longer confident any play
  count I produce is right, and gate 1 asks you to reproduce mine before using
  it for that reason.**
- **My "+2 exactly, 21 times" was read off raw fixtures including the
  `use_fishing_item` response**, which `castTrace.ts` deliberately skips. Session
  84's 11 casts / 16 jumps is the trace-level truth and mine was the wire-level
  one; **I did not say which level I was reading, and that is the defect.**
- **§2 is a finding I only reached because session 84 wrote its reasoning down.**
  Its `redrawCounterfactual.ts:460` comment names the constant it dismissed, which
  is what let me check it. **A dismissal with its reason attached is auditable; a
  silent one is not** — worth keeping as a habit regardless of this instance.
- **Rule 9 applies.** §1 and §2 are measurements over committed fixtures and code
  at `c52ebad`; a live response or a run that disagrees wins.

---

## Your task (session 85)

1. `doctor.ts` first. Both ledgers roll at 11:00 PT; report them.
2. **§1 / gate 1** — reproduce the overspend control and the daily series, pin
   the (2,2) opening-focus assumption, and record §1a's dating caveat in
   `castEra.ts`.
3. **§2 / gate 2** — run every sim arm at both weights and report the delta. Do
   not change a default. If `data/` blocks the live-config arm, say so at the top.
4. **§4** — hold the off-policy replay behind gate 2's result; put §26 to the
   user; recommend §25 as a drop.
5. **§6** — only past 11:00 PT and only with a go-ahead.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` after committing
   fixtures and before the push**, no test writes a real data path, secret scan.

**Honest expectation.** §2 is a two-line change with a large blast radius and I
would not bet on the direction. **The satisfying version is that the sim at w=3
moves visibly toward live's focus profile**, which would mean forty sessions of
sim figures were computed on a policy the bot does not run, and §0a acquires its
first named, fixable cause since the draw pile. **The unsatisfying version is that
w=3 barely moves the sim at all** — which is also worth knowing, because it would
mean the focus-reserve term is nearly inert in simulation while the live bot's
pacing is the thing that collapsed at the era boundary, and those two facts
together point somewhere neither this brief nor session 84 has looked.
