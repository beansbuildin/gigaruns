# BRIEF — session 61

## The clock, and the caps you are deliberately not spending

Written **2026-08-20, 12:30 PT** — after the 11:00 rollover, same game-day as
session 60. Session 60 spent 3 run-units and 5 casts. **9 run-units and 15 casts
remain and expire at 11:00 PT tomorrow.**

**This brief authorizes ONE juiced run (3 units) and ZERO fishing casts.** The
other 6 run-units and all 15 casts go unspent, by user decision on 2026-08-20.
That is an instruction, not an oversight — **do not top up the day.** If you
finish early, the correct action is to hand back, not to find a use for the
ledger. §4 explains why the casts are held; it is not a de-prioritization of
fishing and must not be recapped as one.

First two actions, in order:

```
npx tsx scripts/checkDungeonToday.ts     # expect 3 of 12 used
npx tsx scripts/checkFishingCaps.ts      # expect 5 of 20 used
```

If either disagrees, stop and report before spending anything. There is no
start-time constraint this session — the rollover already happened.

---

## 1. Make the room-1 stop-check REAL. Offline, before the run.

Session 60's brief said "check the first `tier_choice` before letting it
continue" and that was **not performable as written** — `tier_choice` and
`boon_choice` go only to the structured JSONL, never stdout, and the run
finished in ~2 minutes. The check became a post-hoc audit, which is a different
thing wearing the same name. That is a defect in the brief, not in the agent's
execution, and this section fixes it rather than repeating it.

Rule 8's failure mode is silent: a run where the flip never fired comes back
looking exactly like the previous fifty. A check that runs after the run is over
cannot stop anything. So build the gate into the loop:

**In `liveRun.ts`, at the first room offering `enemyPathOptions`:**

- **Print the decision to stdout** — room index, tiers offered, tier taken,
  whether a Perpetual filtered the top choice, and the `final-room` flag. One
  line, readable in a `tail`.
- **Assert, in-loop, and halt the run on failure** (rule 5, fail closed,
  non-zero exit): tier taken **==** max non-Perpetual tier offered.
- **Assert `final-room-unreadable` never appears before the server's
  `maxRoom`.** Room 16 is unreachable; the deepest run ever is room 10.

**The cost is real and is accepted deliberately.** An assertion that halts a
live run can cost 3 run-units. That is the intended trade: a run that silently
took the lowest tier is worth less than no run at all, because it looks like
evidence and isn't.

**Pin it the way session 60 pinned the split.** A fixture where the flip is
wrong, and a test that **fails when the assertion is removed** — demonstrate the
failure, don't just show the pass. Session 60's `discoveredShipsClean.test.ts`
was verified by re-injecting the ids; do the same shape here. A guard that has
never been seen to fire is not known to guard anything.

**General form, for whoever writes the next brief:** do not specify a check
against a channel you have not confirmed carries the value. If the check reads
stdout, confirm the field prints to stdout.

---

## 2. One juiced run — rule 8's second data point, and only its second

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 > logs/run-61-1.log 2>&1
```

Rule 11 terms, unchanged: 60-energy juiced, `--juiced-index=3`, 3x Big Heal
Juice, `--runs=1`, **stop and hand back**. Redirect and `tail`; never pipe a
live run to a truncating reader. Energy is not a constraint (rule 12) — the
preflight claims from the ROM bank on its own; do not report an energy number
as a blocker, and exercise `--dry-run` before claiming any blocker at all.

### 2a. Pre-register the comparison BEFORE you run it

Session 60 produced one clean same-depth pair: run 24943210 (rule 8, died room
5, loot 141) scored **4224** against run 24893156 (lowest-tier, died room 5,
loot 141) at **3456** — **+22%**. That is n=1 per arm, and the reading is only
clean because depth *and* loot matched.

Write the following into the log **before** the run starts, so it cannot be read
post hoc:

- **Supports rule 8:** dies at a depth that has a lowest-tier comparator with
  equal loot, and scores above it.
- **Counts against rule 8:** same conditions, scores at or below it.
- **No read:** dies at a depth with no equal-loot comparator. This is the most
  likely outcome and is **not** a failed run — it still contributes to the
  rule-8 depth distribution (prior lowest-tier juiced depths 7,6,6,5,8,7,4,10,
  mean 6.6; rule-8 depths so far: 5).

**And hold this line in the recap:** n=2 is not an argument. Two anecdotes
pointing the same way are two anecdotes. Do not write "rule 8 is validated"
whatever this run does.

### 2b. §23's residual — this run is a cheap test of the regen hypothesis

Session 60 closed the six-session question at **−60** and attributed the
residual +1 to passive regen (18/hr ≈ 1 per 3.33 min) ticking inside the
measurement window — both drifting measurements sat on the longest-elapsed
measurement of their batch, in two different run types on the same day.

That hypothesis makes a checkable prediction: over a T-minute window, regen
credits `floor(T/3.33)` or `ceil(T/3.33)`, and **nothing else about the run
matters**. So record **wall-clock elapsed** between the two halves of the
`start_run` energy probe pair, to the second, and report elapsed-minutes
**alongside** `tightDelta` and `observedDelta` as a pair, not as two separate
facts. One observation decides nothing; the point is to start accumulating
(elapsed, drift) pairs. Report it as data, not as a verdict.

### 2c. Report

Tier offered vs taken per room; how often Perpetual filtered the top choice
(session 60: 1 of 4, ~35% expected); whether `final-room` or
`final-room-unreadable` appeared; `orbFallback` fire count, `narrowed` true vs
false, `orbsTaken` vs `orbsOffered`, run orb sum; loot, score, rooms, juice use
and when; first-attempt action failures, 429s, unknown enums, guard trips
(session 60: 0/31, 0, 0, 0).

---

## 3. §19 — write the replacement rule. This is the session's most important item.

**User decision, 2026-08-20:** gather more instrumented turns, framed as a **new
pre-registered rule** that supersedes the old one. Not a quiet amendment.

**And note what makes this the strongest available version of that decision:**
this session runs **zero casts**, and §4 means casts are held for days yet. The
new rule is written with no new data in hand and none arriving imminently — it
cannot be tuned to a result you have already seen. If a pre-registration is
going to be redone, this is the cleanest moment in the programme to redo it.

The replacement lives in `matcherVerdict.ts` **as code**, not in prose:

1. **A minimum-n clause.** Below N instrumented turns the verdict is
   `INSUFFICIENT_DATA`. **Derive N; do not inherit a number from this brief.**
   The rule at issue is `distribution.max < 0.5`. Given the replay reference
   (session 50/51 predicted median 0.135 / 70.5% and was well calibrated), work
   out what n gives a reasonable chance of *observing* a π above 0.5 if such
   turns occur at a plausible base rate, and state the assumed rate explicitly.
   25 is a plausible landing spot; it is not the answer, it is a sanity check on
   yours. **Derive N from the replay reference, never from the 7 turns already
   seen** — that is the whole point of the exercise.
2. **A stopping condition in BOTH directions.** What result drops the matcher
   tier, and what result keeps it. Session 51's rule had only a drop arm, which
   is why hitting it felt like a trap rather than an answer. A rule that can
   only fire one way never ends.
3. **The oil-era pooling answer, written into the rule now.** §4b settles it:
   oil-era matcher turns **do** count toward N, because both oils change what we
   spend and not what the fish does. Carry §4b's HP-reweighting caveat into the
   rule's comment rather than restating the conclusion without it.
4. **N is denominated in TURNS, and oils shorten casts.** +2 damage means fish
   die sooner, so an oil cast yields fewer instrumented turns than a non-oil
   cast. **Do not convert N into a cast count using the pre-oil turns-per-cast
   rate**, and do not let the rule quietly assume one. If the rule reports
   progress, report it in turns.
5. **The 7-turn DROP is recorded, not erased.** Keep it with its date, its
   sample, and its numbers (min 0.130, median 0.138, max 0.255, 71.4% ≤0.15, 0%
   above 0.5, π₀ 0.137, library 3 patterns, support 12/93). The new rule states
   in its own comment that it supersedes that verdict and why.
6. **A test pinned on the RULE, not the count.** Session 60's lesson from
   rewriting `matcherVerdict.test.ts`: `activeTurns === 7` would fire on the
   next batch and teach whoever hit it to edit the number, which is exactly how
   a pre-registered rule erodes. Use inequalities.

**And write it plainly in `DECISIONS.md`:** *a pre-registered rule was
renegotiated after its result was visible, deliberately, on the user's call,
with the original verdict preserved.* That sentence is the honest version. A
recap that describes this as "refining the threshold" is the dishonest version
and is worse than not doing it at all.

---

## 4. Oils — the fishing hold, and everything that can be decided at zero oil casts

**User, 2026-08-20:** casts are paused because **oils are being introduced**, and
gathering the in-game resources and crafting them takes real-world time. The bot
fishes again once oils exist and can be loaded. **This is a resource dependency,
not a verdict on the fishing programme** — recap it that way. A paused item
recapped as a deprioritized one is how it quietly dies.

Nothing in this section is a cast. It is all work that is cheaper now, at zero
oil data, than it will ever be again.

### 4a. What the oils do — user-supplied, so VERIFY it (rule 9)

| item | effect | shape |
|---|---|---|
| **Mid Focus Oil** | **+2 focus** | one-shot, instant on consume |
| **Mid Relaxing Oil** | **+2 damage to the fish** | one-shot, instant on consume |

That is the user's description, given 2026-08-20. Rule 9 applies to it exactly
as it applies to anything else in a brief: **check it against the live item
payload before implementing.** Capture and report, if reachable:

- the two `itemId`s, and the item payloads in full;
- whether the effect really is one-shot rather than a buff for the rest of the
  cast;
- whether both oils can be used in the same cast, and whether either stacks;
- any per-cast or per-day server-side limit.

**The capture may not be possible yet, and that is an acceptable answer.** The
user has not crafted the oils — as of 2026-08-20 they do not exist in the
inventory. Try only the item and inventory endpoints already CONFIRMED in
`SPEC.md`; if the oils are not reachable without owning them, **say so and stop.
Do not brute-force URLs** (rule 2), and do not treat an unreachable payload as a
session failure. Record what you tried and what it returned so the next session
does not repeat it.

**The question that decides whether the Relaxing Oil is worth using at all:
does consuming an oil COST A TURN?** A one-shot +2 damage that spends an action
is a net loss whenever an ordinary attack deals more than 2 — the oil would only
pay when the turn budget is binding, not the damage. If consumption is free,
both oils are close to strictly positive and the only question is timing. If it
costs a turn, the Relaxing Oil may not be worth crafting more of.

**If the payload cannot answer this, it does not get assumed** — it becomes the
first thing the first oil cast measures, and §4d carries both branches until
then. Flag it to the user explicitly in the recap, because it is the one finding
that could change what they spend crafting time on.

### 4b. Pooling across the oil boundary — settled, with one caveat

Both oils change **what we spend**, not what the fish does. So the dead-era
precedent applies, and it applies the same way:

- **Outcome metrics** (catch rate, per-cast outcomes, oil comparisons): oil and
  non-oil casts **do not pool**. Separate arms.
- **Movement model** (ring model, step classes, mined patterns, matcher prior
  π₀): oil casts **pool** with non-oil.

**The caveat, which is specific to the Relaxing Oil and is not the focus-burn
situation repeating.** +2 damage reaches low-HP fish states *earlier* in a cast.
If anything in the movement model conditions on fish HP, oil casts do not
invalidate the transitions — they **reweight which states get observed**. A
conditional transition model survives that untouched; a marginal or
shrinkage-fitted parameter can drift on it. So when oil casts start landing,
check the per-class shrinkage `{1: 0.1, 2: 8}` and π₀ = 0.133 specifically for
that drift. **Check and report — do not pre-emptively re-derive.** A
re-derivation is its own task with its own gate (session 60 brief §2b).

- **Also do not compare focus-spend numbers across the boundary.** The 1.667
  opening-spend mean is denominated in a focus budget that the Focus Oil makes
  bigger. It is an outcome metric, so 4b already excludes it — but name it
  explicitly, because it is the number most likely to get compared out of habit.
- Implement the split as a **flag on the cast record, not a deletion and not a
  separate file** — same shape as the dead-era flag. An excluded cast can be
  reconsidered; a deleted one cannot.

**One cheap task this session:** check whether the cast record can already carry
oil usage. If it cannot, add the field **now** — it costs nothing today and
costs a re-derivation the moment one oil cast is recorded without it. This is
the whole reason §4 sits in a session with no casts in it.

### 4c. Authorization — autonomous within a config budget

**User decision, 2026-08-20.** Oils get an `oils` block in `config/bot.json`
(under `dendren`) mirroring `forbiddenWoods.potions`: the user sets the count,
the bot spends within it autonomously and stops at the budget. Fishing stays
autonomous; oils do **not** become a per-cast approval.

**Two things to get right, both of which the potions block got wrong:**

- **Do not copy `resolvePotionLoadout`'s bug.** Rule 11 records that it gates on
  `config.potions` and nothing else, despite a comment claiming it mirrors
  `main()`'s gate, which is two conditions. The oils resolver must gate on the
  same conditions its caller does, and a **test must pin that** — not a comment
  claiming it.
- **Add a line to CLAUDE.md's "Ask first" list saying oils are permitted within
  the configured budget.** The list currently says "Sell, burn, or list any
  item," and a careful agent could reasonably read consuming a hand-crafted item
  as needing approval. Say explicitly that it does not, so nobody blocks on it —
  and so nobody later treats the silence as licence for something larger.

### 4d. The consumption policy — derive it in sim, then the user approves

**User decision, 2026-08-20:** the agent derives candidate timing policies
against the corpus, and **reports both what the result was and why that policy
won** — the causal story, not a score table with a winner circled. Rule 4: no
oil is consumed live until the user has approved the policy.

Constraints on that work, all of which limit what the answer can be worth:

- **The corpus contains zero oil casts.** The sim will be *modelling* the
  oils' effect from §4a's description, not observing it. Say so at the top of
  the report, not in a footnote.
- **Report BOTH turn-cost branches, not one.** Unless §4a captured the answer,
  derive the policy twice — once assuming consumption is free, once assuming it
  costs a turn — and present both. This is cheap, it makes the work useful
  whichever way the payload lands, and it means no oil-timing code is ever built
  on a guess about the mechanic it depends on most.
- **Run the sensitivity check too, and report it even if the recommendation
  holds.** Does the winning policy flip if the effect is +1 or +3 instead of +2?
  If it flips, the recommendation is not robust, and saying so is the useful
  result.
- **"The sim cannot separate these" is a valid answer** and has precedent — it
  could not separate two boon policies at n=2000. Report it as a finding rather
  than picking a winner on noise.
- The simplest baseline (consume both at cast start) is a legitimate candidate,
  not a strawman. If nothing beats it robustly, it wins on the strength of being
  un-overfittable to a corpus with no oil casts in it.

### 4e. The 60% target is DROPPED, by user decision

Session 60's brief sequenced it as *60% first, then oils, then 80%*. Oils arrive
first, so that sequence is dead. Record the reasoning in `DECISIONS.md`, because
a dropped target with no reasoning reads as one that was quietly missed:

> 60% was chosen because 3-of-5 is an observable value at batch size 5 — n=5 can
> only read 0/20/40/60/80/100% — not because 60% meant anything about this
> fishery. It never got its read: 24 post-fix casts against the ~93 needed for
> ±10pp. Oils change the spending policy underneath it, so carrying it forward
> would mean measuring a target chosen for one policy against a different one. A
> replacement target gets derived once the oil policy's actual range is visible.
> Dropped deliberately, 2026-08-20.

**Do not derive a replacement target this session, and not by an agent at all.**
That is the user's, after oil casts exist.

**What survives the drop: the zero-streak tripwire.**

> **Halt and report on 15 consecutive casts with zero catches.**

Independent of any outcome target, and **armed through the oil transition.** Do
not remove it as a side effect of dropping 60%. It is the one thing that would
have caught the dead era early — 40 casts before a human noticed — and a live
policy change is exactly when it earns its keep. Current zero-streak: **4**.

### 4f. §19's gathering is blocked on this, and that is the honest status

§3's replacement rule gets **written** this session. Its N instrumented turns
cannot start accruing until casts resume, which is gated on the user's crafting,
not on any agent's work. Do not let §3's rule silently imply a timeline, and do
not report §19 as "in progress" in the recap. It is written and waiting.

---

## 5. The orb rule's coverage effect — make it measurable, don't decide it

`UNMODELLED_TYPES` shrank by two at once — a first — because choosing by orb
payout reaches boons the ranked policy structurally avoids. Depth got worse,
coverage got better. Whether coverage is a **reason** for the wide orb rule or a
**side effect** of it is a real question and n=1 cannot answer it.

What this session can do is make it answerable: record per run the count of
first-ever boon types seen, and `UNMODELLED_TYPES` size before and after. Then
in three or four runs the question has data under it. **Do not decide it now**,
and do not let a coverage argument become a second, unstated justification for a
rule the user adopted for a different reason.

---

## 6. Distribution — the SPEC.md decision is IN, and it is "leave them"

**User decision, 2026-08-20: the ROM token ids stay in `SPEC.md`.** No scrub, no
aliasing. Write it into `handoff/DISTRIBUTION.md` **as a decision with its
reasoning**, so nobody rediscovers it as a finding in six sessions and "fixes"
it:

> The 19 `romId` references in SPEC.md are ERC-721 token ids on a public chain,
> already enumerable by anyone holding the contract address, and they anchor
> evidence whose value depends on being checkable (`romId 2097 claimed with
> amount:57 credited ~1.0`). Scrubbing them would cost the spec's evidentiary
> value to remove information that is not actually concealed. Accepted exposure,
> deliberate, 2026-08-20.

**What does NOT change:** no wallet addresses, no JWTs, no private keys in any
shipped doc, ever. `config/discovered.json`'s split stays exactly as shipped and
`tests/discoveredShipsClean.test.ts` stays as its pin — this decision is scoped
to `romId` references in SPEC.md prose and nothing else. `SPEC-fishing.md` is
already clean.

**One line needed from the user, and it is the only thing blocking:** `LICENSE`
reads `Copyright (c) 2026 Bean`, taken from `git config user.name`. Confirm the
name you want on it. No email, deliberately.

**Steps 3–6 of DISTRIBUTION.md remain the user's.** An agent must not create or
push the distribution repo. Steps 1–2 are done in the tree.

---

## 7. Gate

Both halves are offline, deterministic, and entirely within your control — they
do not depend on the live run's outcome, so a bad run cannot fail them and a
good run cannot pass them (rule 6).

1. **`tests/` contains a test that FAILS when the room-1 tier assertion is
   removed from `liveRun.ts`.** Paste the failing output, not just the passing
   run.
2. **Under the new §19 rule, `matcherVerdict` returns `INSUFFICIENT_DATA` on
   today's 7-turn log**, and a test pins that on `n < N`, not on the literal 7.

Nothing needs to be captured for this to be meetable. If you think otherwise,
say so at the top of the session, not in the recap.

---

## 8. Do not

- **Do not spend the remaining 6 run-units or any of the 15 casts.**
- **Do not consume an oil live.** The policy is derived and approved first (§4d).
- Do not drop the matcher tier this session — §3's new rule governs now.
- **Do not remove the 15-cast zero-streak tripwire** as a consequence of
  dropping 60%. It is not part of that target.
- **Do not derive a replacement fishing target.** The user's, after oil casts.
- **Do not pre-emptively re-derive the movement model** for the oil boundary.
  Check for drift, report, then it is its own task with its own gate.
- Do not scrub SPEC.md's romIds.
- Do not revert rule 8 or the wide orb rule without a user directive.
- Do not re-derive fitted parameters as a side effect of the dead-era split (the
  ring model, step classes, mined patterns and π₀ keep the dead casts; only
  outcome metrics exclude them, and the split is a flag, not a deletion).
- Do not put identifiers in a test that guards against identifiers.
- `boonCapture` stays **OFF** — still zero ordinary runs since the directive.
- Do not trust the recap checklist's `.gitignore` line; `config/discovered.json`
  is deliberately **not** ignored as of 2026-08-20. Everything else still holds.

---

## 9. Corrections to me

- **I specified a stop-check against a channel I never confirmed existed.** §1
  above. `tier_choice` was never on stdout, so "check it before letting the run
  continue" was unperformable from the moment it was written, and the agent
  correctly did the only thing available — audit afterwards — which is not the
  thing I asked for. Rule 1 applied to the brief's author.
- **My "1.667 focus-spend mean" was right, and the agent's first correction of
  it was wrong** — but the failure mode is worth naming because it will recur:
  the claim was checked against session 48's 1.62, a *different window*, and
  called reconstructed on that basis. Rule 9 says check a brief's claim against
  the corpus. A nearby number from a different window is not the corpus.
  `matcherWeightReport.ts` settled it: (28−3)/15 = 1.667 exactly.
- **§4a's oil effects are a user description, not a captured payload.** I have
  written them into a table, which makes them look like findings. They are not.
  Verify them.
- **Carried and still deliberate:** 25 analysis scripts hold hardcoded paths
  (ratcheted, honest debt). The simulator models a policy the bot does not play
  and its coverage metrics will keep falling — rule 8's accepted price, not a
  regression.

---

## Your task (session 61)

1. Confirm both ledgers: 3/12 run-units, 5/20 casts. Stop if either disagrees.
2. **§1** — room-1 stdout print + in-loop halting assertion, with a test proven
   to fail when the assertion is removed. **Before the run.**
3. **§2** — ONE juiced run. Pre-register the comparison first. Full two-policy
   report plus the (elapsed, drift) pair. Then stop and hand back.
4. **§3** — §19's replacement rule in `matcherVerdict.ts`: derived N, both-way
   stopping conditions, the oil-pooling answer, turns-not-casts denomination,
   old verdict preserved, rule-pinned test, honest `DECISIONS.md` entry.
5. **§4** — attempt the oil payload capture on CONFIRMED endpoints only, and
   report plainly if the uncrafted items are unreachable; add the cast-record
   oil flag; the `oils` config block with a real gate and a test; the CLAUDE.md
   Ask-first line; the sim-derived timing policy in **both turn-cost branches**
   with its sensitivity check and its causal explanation; the 60% drop and its
   reasoning; tripwire confirmed armed. **No casts, no oil consumed.**
6. **§5** — instrument boon coverage. Do not decide it.
7. **§6** — DISTRIBUTION.md records the romId decision with its reasoning. No
   repo creation.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before
   handoff.

**Honest expectation.** The live run is the small item this session and the
offline ones are load-bearing — which inverts session 60, and is the right
inversion given one authorized run and a fishing programme waiting on crafting.
§1 fixes a defect I introduced. §3 and §4b are pre-registrations written at zero
data, which is the only condition under which they are worth anything; the oil
hold is what makes that possible, so use it rather than treating it as dead
time.

**The oils do not exist yet, and §4 is written to survive that.** Every item in
it is either pure bookkeeping (the flag, the config block, the 60% drop) or
explicitly two-branched (§4d). The one thing that would be worth a great deal —
whether consuming an oil costs a turn — is attempted, not assumed, and an
honest "not reachable until the user crafts one" is the correct outcome rather
than a gap. If the session runs short, finish **§3 and §4b**; §2 is 3 units that
will still be there tomorrow, and §6 has no deadline at all.
