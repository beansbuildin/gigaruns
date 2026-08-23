# BRIEF — session 83 — redraw, priced off the corpus

## 0. Verification, and where this brief comes from

Fresh clone at `2b8d02e`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Test Files  95 passed (95)
                      Tests  1581 passed | 13 skipped (1594)
```

**Both gates hold.** Session 82 was a good session: the dry-run went first and
found the arg guard's first real exercise, the gear diff was reported empty as a
positive, `EV support: 0/174` is a cleaner result than any fraction would have
been, and **finding that the line printing it has never executed** is worth more
than the number.

**This brief has two jobs.** It assesses the redraw plan you were given, and it
**executes the plan's step 2** — because that step is offline, spends nothing, and
turned out to be computable in one pass. The session should start from a result,
not a method.

---

## The clock and the ledger

Written **2026-08-23, 00:25 PT**.

```
  fishing    20 / 20 spent      rolls 11:00 PT (~10.5h out)
  dungeon    12 / 12 spent      rolls 11:00 PT
```

**Both allowances are exhausted. Before 11:00 PT this is an offline session by
arithmetic**, which suits §1–§3 exactly — none of them needs a cast.

`doctor.ts` first anyway; rule 13's point is that arithmetic about ledgers is not
authority.

*⚠ `preflight.ts` (~90s) before the push — and per session 82, **after**
committing new fixtures, since it exports tracked files only.*

---

## 1. The redraw plan — endorsed, with the order reversed

**The diagnosis is right and the "name the arm" catch is the important part.**
43.9 mana per extra fish was computed on an arm that redraws 27–61% of its turns
against a shipped threshold that wants one on ~3.5%. That is the third instance
of the same error class in this project and the plan is correct to lead with it.

Four amendments.

### 1a. Do step 2 FIRST, not step 1

The plan puts the two correctness fixes ahead of the corpus pricing, on the
grounds that they are not policy and cannot be validated by calibration. **True,
and it is still the wrong order** — because pricing is not calibration either.

Step 2 is **free**: offline, no casts, no budget, no live-path edit. Steps 1 and 2
of the plan's correctness list are **live-path surgery on the cast loop under a
ship-nothing posture**. If the corpus price says no, that surgery was spent on a
dead end; if it says yes, it is done with a number behind it.

**Measure first. It costs nothing and it decides whether the rest happens.**

### 1b. The `3.5% of turns` figure needs its provenance attached

12 of 347 comes from `logs/`, which is **gitignored and LOSSY** — this repo's own
rule 10, in the second form session 75 wrote up. That is what *survives*, not what
happened, and the project has already been bitten by exactly this once
(session 74's "1 / 373", corrected in session 75's STATE).

It is also the demand of an **uncalibrated** threshold (`REDRAW_THRESHOLD = 0`,
the plan's own blocker #3), so it is a bound on one particular policy, not on the
mechanic. **Label it both ways and it is still useful.** Do not let it become a
quoted constant.

### 1c. The price was computed against the wrong scarce resource

"43.9 mana per extra fish **against a 10-mana pool**" only bites if the pool is
scarce. **Measured over the committed corpus, 147 completed casts:**

```
  playerHp (mana) REMAINING at the terminal doc

     0 left : 15 casts       5 left : 16        mean   5.85
     1 left :  2             6 left : 17        median 7
     2 left :  4             7 left : 27
     3 left :  6             8 left : 49
     4 left :  6             9 left :  5

  132 of 147 casts (89.8%) ended with mana to spare.
  mana-out: 15 casts (10.2%)      escapes 5.42 left   catches 6.73 left
```

**The average cast throws away 5.85 of its 10 mana.** The pool is not what ends
casts — the fish healing to full is, at 62%. At the measured cost of a redraw
(§2, mean 1.57 mana) **the discarded mana alone funds ~3.7 redraws per cast.**

And a redraw does not touch the resource that *is* scarce. Fish-HP headroom is
**6.8 HP** and a miss heals **3**, so a cast tolerates ~2.3 net misses. A redraw
deals no damage and no heal (user-confirmed, session 74) — it takes no shot, so it
**cannot miss**. **A redraw spends the abundant resource to avoid spending the
scarce one.** That is the argument the 43.9 figure never made, and it is the one
worth testing.

### 1d. Blocker #1 is not just a correctness gap — it is where the value lives

Session 75 found the sim's old redraw was not merely time-free but
**information-free**, and that the information term was the larger one. The live
redraw response carries the fish's new position; **blocker #1 is the client
throwing that information away before the matcher sees it.**

So #1 is not housekeeping ahead of the interesting work. **It is the mechanism the
value case depends on**, and it should be framed that way when it is fixed:
without it, a live redraw buys a fresh hand and *loses* an observation, which is a
worse trade than the sim's.

---

## 2. Step 2, executed — the counterfactual is computable, and here it is

### 2a. Why it is computable, and the check that it is

Session 79 established the pile is shuffled **once per cast** and drawn
sequentially; the shuffled order is never on the wire. **But the actual timeline
reveals it.** The bot plays a hand down, the server deals the next three, and
those three are recorded. A redraw discards the held hand and draws three — from
the same untouched pile. **So the hand a redraw would have produced at turn *t* is
exactly the next triple the cast actually drew.**

Verified before using it, over 148 casts:

```
  nextCardIndex deltas when it advances:  {+3: 137,  −7: 3,  −8: 4}
  draws whose new hand contains previously-unheld cards:  144 / 144
```

Every draw is a clean triple; the seven negatives are session 79's pile wraps.

### 2b. The measurement

**Predicate, stated in full because I have now twice shipped a count without
one:** every play transition where exactly one card moved from hand to discard;
both states carry `focusPoint` and `fishPosition`; every card in the held hand
belongs to one revealed draw-triple; the **next** triple was drawn later in the
same cast; and a further play exists in that cast. **n = 386.**

Both arms are scored with session 81's validated semantics — resolution against
the post-move focus and the resulting-state cell, reachable focus from
`spent + remaining` (session 81 §4e, not `prev.focusMeter`). The redraw arm is
scored against the **next** turn's cell, because a redraw burns the fish's move.

```
  actual hand can reach the fish     redrawn hand can reach it      n      share
        yes                                 yes                    262    67.9%
        yes                                 no                      26     6.7%   ← sacrifice
        no                                  yes                     42    10.9%   ← rescue
        no                                  no                      56    14.5%

  hit-availability, actual hand    74.6%
  hit-availability, redrawn hand   78.8%

  mana a rescuing redraw would have cost:  mean 1.57   {1: 24, 2: 12, 3: 6}
```

### 2c. What it says, stated carefully

**Conditional on the held hand having no reachable hit — 98 of 386 plays,
25.4% — a redraw restores hit-availability 42.9% of the time, at a mean 1.57
mana out of a pool that routinely wastes 5.85.**

Those 98 plays are **guaranteed misses**: no card, no reachable focus, no
outcome but +3 fish HP against a 6.8 headroom. **One avoided guaranteed miss is
worth 44% of the entire headroom budget of a cast.**

**Three things this does NOT say, and the session must not let them blur:**

1. **It is availability, not hits.** Both arms use an oracle lens that knows where
   the fish went. The bot converts roughly half of available hits into actual ones
   (session 81: ACTUAL 36.3% against a 71.1% best-card ceiling). **The oracle bias
   is the same on both sides, so the paired comparison is fair — the absolute
   levels are not achievable.**
2. **It is not a trigger.** The bot cannot know at decision time that its hand is
   dead. The 26 sacrifices are what a bad trigger costs, and a trigger keyed on
   `bestEv < 0` is not the same predicate as "no reachable hit". **§3 is about
   that gap.**
3. **It does not convert to mana-per-fish.** Doing so needs an availability→hit
   rate and a hits→fish rate, and inventing either is how 43.9 happened.
   **Report the measured quantities; let the conversion be an explicit, separate
   step with its assumptions named.**

**The honest headline: the number on record does not describe the candidate
policy, and the corpus-derived quantities are an order of magnitude friendlier —
but "friendlier" is not "affordable", and nothing here reopens the decision.**

---

## 3. What the trigger would have to be, and it is not `bestEv < 0`

§2's rescue set is defined by *no reachable hit*. The shipped trigger is
`bestEv < redrawThreshold && mana > redrawCost` — a different predicate, and the
26 sacrifices show the two come apart.

The plan's blocker #3 is right that `REDRAW_THRESHOLD = 0` is uncalibrated, and
the one historical calibration produced casts averaging 1.29 turns with 78%
`escaped_mana`. **That failure is legible now in a way it was not then:** a
threshold that fires often burns the pool *and* the fish's patience, and it was
tuned on an arm where mana never binds. §1c says the pool has 5.85 of slack —
so a trigger firing at the §2 rate (25.4% of plays, ~1.57 mana each) spends about
**0.4 mana per play**, well inside it, while a trigger firing at 61% does not.

**The tractable design question, and it is measurable offline:** how well does
any available signal — `bestEv`, the best card's reachable-cell count, hand size,
the matcher's spread — separate the 98 dead-hand plays from the 288 live ones?
That is a classification problem over a labelled corpus, and **the labels now
exist.**

---

## 4. Session 82's open questions

- **`run_over` has never fired and the EV line lives inside it.** The fix I would
  argue for is **making both exit paths converge** rather than duplicating the
  reporting: two exits that print different things is how this happened. But it is
  a live-path edit on the function that ends a run, and it should carry a gate —
  *the reporting executes on a replayed run of each shape, demonstrated, before it
  is trusted live.* Note the same class as §1d: **a line nobody has watched
  execute is a line that does not exist.**
- **The pre-death ordering at n=4 runs.** `STATUS_EFFECT` on 12/12 pre-death
  decisions at a 50% base rate is striking and it is four runs. **State it as a
  hypothesis with a run count that would settle it**, and say the frequency and
  death orderings disagree so the choice is not neutral. Do not reorder CAPTURE-1
  on n=4.
- **M2 and the potions.** Three Big Heals at exactly 20 each against a 40 pool did
  not save three of four runs. **M2 is blocked behind H2, and I think that is
  still right** — the fix on the table is `hp <= credibleNextExchangeHpDamage`,
  which needs the model H2 cannot build yet. But the potion data is now the thing
  there is most of, and **a threshold sweep on the corpus is not the same as
  changing the constant.** Worth recording as a capture-backed item rather than a
  blocked one.
- **The crit rule** needs one base-6/8/10 crit; card 10 is in the deck. First
  fishing after 11:00 PT.

---

## 5. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6.

1. **§2 reproduces, with its predicate in the code.** A script and a test that
   recompute the four-cell table from committed fixtures and assert
   **262 / 26 / 42 / 56 at n=386**, plus the 1.57 mean rescue cost, **with the
   predicate of §2b written out in the test in those words.** The triple
   reconstruction must be pinned separately by the §2a check (`+3: 137`, wraps 7,
   `144/144`) so a corpus change that breaks the method fails loudly rather than
   shifting the table.
2. **The mana-slack table is a reported metric** (§1c): mana remaining at cast
   end, mean/median/distribution, split by caught and escaped. Reproduce
   **mean 5.85, median 7, 15 mana-out of 147** first, then wire it into
   `damageEconomy.ts` beside the margin column — it is the same argument about
   which resource is scarce.

Not gated, do if there is room: §3's separability check — how well `bestEv` and
its neighbours classify the 98 dead-hand plays.

**What would make these unmeetable:** nothing. Both run on committed fixtures and
shipped code. **If §2's table does not reproduce, that is the finding** and it
belongs at the top of the session — my counts have failed to reproduce twice now
and the possibility is real.

---

## 6. Do not

- **Do not flip `redrawEnabled`.** Nothing here authorises it. `DECISIONS.md`
  records redraw CLOSED on price; reopening it is the user's call, and rule 4 bars
  a live change on a sim result regardless.
- **Do not fix the two correctness gaps yet** (§1a). They are live-path edits and
  the free measurement decides whether they are worth making.
- **Do not convert §2's availability numbers into mana-per-fish** without naming
  every assumption in the conversion (§2c). That is how 43.9 happened.
- **Do not quote 3.5% without its provenance** — `logs/` is lossy and the
  threshold is uncalibrated (§1b).
- **Do not recalibrate `REDRAW_THRESHOLD` on any sim arm.** Session 81: the arms
  clear their own break-even by up to +41.9pp against live's −1.8pp.
- **Do not reorder CAPTURE-1 on n=4 runs** (§4).
- **Do not touch `DEFAULT_POTION_THRESHOLD`**, `chooseNewCard`, or the necessity
  thresholds.
- Standing, none re-opened: **+19.40pp SUSPENDED, do not quote**; §0a not lifted;
  do not build H2's proc model; `boonCapture` OFF; no 429 backoff without an
  observed 429; do not shuffle the random-sample deck path; do not complete the
  corrode perpetual table (session 82 showed the capture that would license it is
  the capture proving it buys nothing).

---

## 7. Corrections to me

- **This brief hands over numbers, so it hands over the predicate with them**
  (§2b) and asks the session to reproduce them before using them (§5). I have
  shipped a bare count twice — 543, then 581 against a true 590 — and both times
  a session spent real effort failing to reproduce it. **The fix is not care, it
  is that a number without its filter is not a measurement.**
- **§2's method could be wrong in a way I would not see.** The triple
  reconstruction assumes a redraw draws from the same pile position the played-out
  hand would have, which follows from the per-cast shuffle but is **inferred, not
  observed** — no redraw has ever been played live. §2a's check is the strongest
  evidence available and it is indirect. **If a live redraw ever happens, the
  first thing to check is whether the dealt triple is the one this method
  predicts.**
- **I am the third opinion on a plan I did not write, and the plan is good.** The
  amendments are ordering and framing, not disagreement — except §1a, which is a
  real disagreement about sequence, and §1c, which is an argument the plan does
  not make and that I think is the strongest one available.
- **Rule 9 applies.** §1c and §2 are measurements over committed fixtures at
  `2b8d02e`; a live response that disagrees wins, and the correction goes in the
  recap.

---

## Your task (session 83)

1. `doctor.ts` first. Both ledgers are spent until 11:00 PT; report them anyway.
2. **§2 / gate 1** — reproduce the four-cell table and the 1.57 mean, pin the
   predicate and the triple-reconstruction check.
3. **§1c / gate 2** — the mana-slack table, reproduced and wired beside
   `damageEconomy.ts`'s margin column.
4. **§3** — if there is room, how well any available signal separates the 98
   dead-hand plays from the 288 live ones.
5. **§4** — `run_over`'s convergence with a gate; the pre-death ordering stated
   as a hypothesis with the run count that would settle it.
6. **Report to the user, do not decide:** whether §2 changes the CLOSED verdict is
   theirs. Give them the measured quantities, the three things §2c says it does
   not say, and the cost of the two correctness fixes.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` after committing
   fixtures and before the push**, no test writes a real data path, secret scan.

**Honest expectation.** The useful thing here is not that redraw might be
affordable — it is that **the number that closed it was priced against a resource
the corpus says is not scarce.** 89.8% of casts end with mana unspent, averaging
5.85 of 10. **The satisfying version of this session is gate 1 reproducing and §3
finding a signal that separates the dead hands**, which would make a shadow
evaluation worth designing. **The unsatisfying version is that no available signal
separates them** — the bot cannot tell a dead hand from a live one at decision
time — and then redraw stays closed for a better reason than the one on record:
not that it costs too much, but that **nothing tells you when to use it.**
