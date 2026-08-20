# BRIEF — session 62

## The clock and the ledger

Written **2026-08-20, 15:00 PT**. Session 61 spent 3 run-units and 0 casts.
**6 run-units (2 juiced runs) and 15 casts remain, expiring 11:00 PT tomorrow.**

**This brief authorizes TWO juiced runs and ZERO fishing casts.** §3 pre-specifies
a single diagnostic cast that is **not yet authorized** — it runs only if the user
says so during the session.

First two actions:

```
npx tsx scripts/checkDungeonToday.ts     # expect 6 of 12 used
npx tsx scripts/checkFishingCaps.ts      # expect 5 of 20 used
```

**CLAUDE.md rule 13 is new and applies from the first live command.** A denial,
block, or interrupt is not evidence that nothing ran; read the ledger before
believing it and never retry on the strength of one. Session 61's run had already
completed when the harness reported it denied. The rule has the detail — this is
the pointer, not a restatement.

---

## 1. The oil policy is APPROVED. Ship `on-demand`.

**User decision, 2026-08-20:** approve `handoff/OIL-POLICY.md`'s recommendation as
written. The user also confirms the two oils cost **roughly the same** to craft, so
the sweep's pooled ranking stands and no per-item gate is needed.

Three things, and the second is a live-policy change:

1. Set `dendren.oils.policyApproved` to `true` in `config/bot.json`.
2. **Replace `liveFishing.ts`'s heuristic-(c) trigger with `on-demand`'s two
   triggers** — Relaxing Oil only at `fishHp <= 2`, Focus Oil only at meter zero.
   Session 61 deliberately did not do this and was right not to. Heuristic (c) is
   dominated on this repo's own numbers: statistically indistinguishable benefit
   (+4.51pp vs +4.47pp) for **44% more oil**, and the two rules differ only on fish
   where 15% of max exceeds 2 HP — exactly the fish where the oil is spent without
   securing the kill.
3. **Pin the replacement.** A test that fails if heuristic (c) is reinstated,
   written on the trigger's shape rather than on a magic number.

### 1a. The stock-exhaustion path, which is now the likely case

The user has **a few oils, fewer than a batch needs.** Under `on-demand` the sweep
spent 5578 oils across 8000 casts — about **0.70 oils per cast** — so a five-cast
batch expects ~3.5. Stock will run out mid-batch before it runs out between
batches, and that is the path to get right:

- **A trigger firing with zero stock must degrade to ordinary play**, not abort
  the cast and not fail closed. Rule 5 exists for unexpected states; an empty
  consumable is an expected one.
- **`mayConsumeOil` must check stock as a required condition**, in the same
  structural style session 61 used — every condition a required field, so a caller
  cannot pass fewer.
- **Exercise the path in a test, don't just write it.** A trigger firing against
  zero stock, the cast continuing, and the record showing what happened.

### 1b. The third category — do not let a half-oiled batch contaminate the arm

§4b's pre-registration (session 61 brief) splits casts into oil and non-oil for
outcome metrics. **Partial stock creates a third case that is neither:** a cast
where the policy *wanted* an oil and none was available is not an oil cast, and it
is not a clean non-oil cast either, because the policy that played it was the oil
policy running dry.

Flag it as its own state on the cast record — trigger fired, stock zero — and keep
it out of both arms until there is a reason to fold it into one. **The dead era is
the precedent for why this matters:** a policy change that goes unflagged gets
averaged into a rate that then means nothing, and it took 40 casts to notice.

### 1c. What still is not known, and stays not known

`use_fishing_item`'s **mana** cost. Session 61's sweep reframed this from the
turn-cost question the brief asked (see §7) and found mana is the scarce resource,
not turns. Nothing in the payload or the `use_fishing_item` envelope suggests a
mana cost, so the sim models it as free — **that is the load-bearing assumption
under the entire +19.40pp**, and only a live cast settles it.

Approving the policy does not settle it. Ship the policy, keep the assumption
labelled as an assumption, and re-check the recommendation against §3's cast
whenever it happens.

---

## 2. Rule 8 — two runs, then the 4-vs-4 historical comparison

**USER DIRECTIVE, 2026-08-20, and it settles the question session 61 raised:**

> **Continue enforcing rule 8 without exception. Do not run any new lowest-tier
> control entries.**

The control arm stays frozen, deliberately. The comparison is therefore
**historical and directional — a 4-vs-4 read, not statistical proof** — and the
brief's job is to make sure it is run honestly rather than to pretend it is more
than it is.

### 2a. The two runs, and which four they complete

Rule 11 terms unchanged. One run, then stop and hand back; the second needs its
own go-ahead.

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 > logs/run-62-1.log 2>&1
```

**Today's four rule-8 runs are the comparison group**, and two of them already
exist:

| # | run | session | depth | score | loot |
|---|---|---|---|---|---|
| 1 | 24943210 | 60 | room 5 | 4224 | 141 |
| 2 | 24945829 | 61 | room 5 | 3840 | 141 |
| 3 | *this session* | 62 | — | — | — |
| 4 | *this session* | 62 | — | — | — |

Twelve run-units a day at 3 per juiced run is exactly four runs, so the group
closes today. **If a run is lost — halted by an assertion, a
`PerpetualOnlyOfferError`, a guard trip — the group is three, and you report a
3-vs-4 saying so.** Do not substitute a run from another day to fill the slot.

### 2b. Identify the historical four BEFORE the runs, and record the ids in the log

The comparison group is **the four chronologically immediately preceding juiced
runs from the lowest-tier era** — the last four before rule 8 took effect on
2026-08-20. Session 60 recorded eight prior lowest-tier juiced depths
(7, 6, 6, 5, 8, 7, 4, 10); the four you want are the last four by timestamp, not
the most convenient four.

**Write the four run ids into the log before the first new run starts.** Selecting
the comparison group after seeing today's results is the same renegotiation §19
exists to prevent, and it is much easier to do accidentally here because the
historical arm is sitting right there to be re-sliced.

### 2c. THE PRECONDITION — rule 10 applies directly, and this comparison is its textbook case

**Before comparing anything, confirm the HARD CORES field predates all eight
runs.**

This repo improves its own logging constantly, and the historical four are from
the lowest-tier era — before the 2026-08-20 directives. **If the field you are
counting first appears partway through the eight, the comparison reproduces
session 52's error exactly**: concluding behaviour changed at date D when what
changed at date D was what was being recorded.

So:

- Find the field the server uses for HARD CORES and state its name explicitly.
- Check its **first appearance** across the fixture corpus.
- **If it does not predate all eight runs, say the logs cannot date this** and
  report the depth comparison alone, with the HARD CORES comparison labelled
  unavailable rather than estimated, reconstructed, or inferred from score.
- If a per-run count is genuinely absent for a historical run, that run's HARD
  CORES cell is empty. **Do not impute it.**

This is the single most likely way this comparison produces a confident wrong
answer, which is why it is a precondition and not a caveat.

### 2d. What to report — HARD CORES is the primary outcome

**1. HARD CORES earned — the primary outcome, because it is ultimately the most
important currency.**

- Every run's count, all eight.
- Per group: **total, average, median.**
- **Record entry tier and energy spent for every run.** If entry costs differ
  between the groups — and they may, since `--juiced-index=3` is itself a
  2026-08-20 directive and the historical four predate it — then **HARD CORES per
  energy spent is required, not optional**, and the raw totals must not be
  compared without it.

**2. Maximum room/depth reached — the progression outcome.**

- Every run's depth, all eight.
- Per group: **average, median, and range.**

**3. Context, reported alongside and not folded into the numbers:** corrode
sightings, boons taken and any first-ever types, entry tier per run, and any
unusual run conditions (halts, resumes, guard trips, potion use, a
`PerpetualOnlyOfferError`, anything that makes a run atypical).

**Show all eight raw run results.** The tables above are summaries of a list that
must also appear in full.

### 2e. Classification — and the trap it is built to stop

Classify the result as exactly one of:

- **Strong positive** — both HARD CORES and depth improve.
- **Positive** — HARD CORES improve without a meaningful depth regression.
- **Tradeoff or negative** — depth improves but HARD CORES decline.
- **Inconclusive** — the two four-run groups are too variable or materially
  incomparable.

> **Do not describe rule 8 as a positive result if it reaches greater depth but
> earns fewer HARD CORES.** Depth is the progression outcome; HARD CORES are the
> currency. A deeper run that pays less is a tradeoff at best, and calling it a
> win because the more visible number moved is the failure mode this scheme
> exists to prevent.

**Scope of NO READ.** If a *specific room-level* comparison lacks samples — say
only one historical run reached room 5 — label **that comparison** NO READ and
move on. **Do not discard the whole-run HARD CORES and depth comparison because a
room-level slice is thin.** Session 61 correctly returned NO READ on a room-5
score comparison; that verdict was about one slice and does not govern this one.

**And state the frame plainly in the recap:** this is a directional 4-vs-4
historical comparison across a policy change, with a frozen control arm that will
never grow, run once. It is evidence about what happened, not proof about what
rule 8 does.

### 2f. Capture, which pays off regardless of the verdict

- **`onEnemyWinExchange_corrode`** (`corrosiveSword` "Miasmablade", −3
  `shield.currentMax` on Sword wins, `minTier: 2`). Capture every further
  sighting. **Recommend, with reasoning, whether to model it in the sim** — it is
  arithmetic on a named move win, not a proc chance like `rolledEnemyStats`, so
  unlike most of what rule 8 made unreachable it is actually modellable. Do not
  implement it without saying why it earns its place.
- **Boon coverage (§5, carried).** Two data points now point different ways —
  session 60's new types came from the orb rule, session 61's `TieVulnerable` from
  the priority rule. Keep instrumenting; do not let either become a coverage
  argument yet.
- Standard per-run report: tier offered vs taken per room, Perpetual filter rate,
  `orbFallback` fire count and `narrowed`, orb sum, loot, score, rooms, potions,
  first-attempt failures, 429s, unknown enums, guard trips.
- §23: keep recording the `(elapsed, drift)` pair. Session 61 read 2m20s / drift 0
  against a predicted `floor(2.33/3.33) = 0`. n=2 and n=3 are cheap here.

---

## 3. The single diagnostic cast — pre-specified, NOT authorized

**Zero casts are authorized by this brief.** This section exists so that if the
user gives a go-ahead mid-session, the agent runs the right cast rather than
improvising one.

**The case for it, for the user to weigh:** a few oils cannot measure a catch rate
— five casts at n=5 read nothing, and the user has said there is not enough stock
for a batch. But **one oil consumed on one live cast answers the mana question**,
which is the load-bearing assumption under the whole +19.40pp recommendation. That
is the highest value per oil available anywhere in the programme right now, and it
does not compete with the batch programme because it is not measuring outcomes.

If authorized, the cast is instrumented, not scored:

- Capture the full `use_fishing_item` request and response envelope.
- Record mana before and after the consume, and whether the fish's position or
  state advanced across it.
- Record whether a turn was consumed — the original question, now secondary.
- **One cast, then stop.** Do not batch it, do not score it, do not let it enter
  the catch-rate arms as a data point (§1b applies).

**Report the mana answer to the user directly and immediately**, whatever else the
session is doing. It changes whether the approved policy is right.

§19 stays where it is: **7 of 32 instrumented turns**, accrual gated on stock, not
on any agent's work. Do not report it as in progress.

---

## 4. Carried, small, and unblocking

- **`LICENSE` reads `Copyright (c) 2026 Bean`** — unconfirmed since session 60.
  Ask once more; it is one line and it blocks distribution.
- **Distribution steps 3–6 remain the user's.** An agent must not create or push
  the repo. Steps 1–2 are done in the tree; the romId decision is recorded.
- **`.claude/settings.local.json` was repaired outside the session** — it had been
  two concatenated top-level JSON objects and therefore unparseable, leaving its
  sandbox block inert. It now carries `ask` rules for `liveRun.ts`,
  `liveFishing.ts` and `orchestrator.ts`, so a live script should now produce a
  real permission prompt rather than a classifier verdict. **If a live command
  still returns a classifier denial, that is worth reporting** — and rule 13
  applies to it either way.
- Carried and deliberate: 25 analysis scripts hold hardcoded paths (ratcheted);
  the sim models a policy the bot does not play; `boonCapture` stays **OFF**.

---

## 5. Gate

All three are offline and deterministic; none depends on a live run's outcome.

1. **A test exercises the stock-exhaustion path**: a trigger fires, stock is zero,
   `mayConsumeOil` refuses, and the cast completes as ordinary play. Demonstrate it
   failing when the exhaustion branch is removed — not merely passing as written.
2. **A test fails if heuristic (c) is reinstated in `liveFishing.ts`**, pinned on
   the trigger's shape rather than on a literal threshold.
3. **The comparison report names the HARD CORES field and states, with evidence,
   whether it predates all eight runs** (§2c). A report that compares the counts
   without answering this does not meet the gate, and one that answers "it does
   not predate them" and drops to depth-only **does**.

---

## 6. Do not

- Do not spend more than 2 juiced runs, and **do not fish without an explicit
  go-ahead** — §3 is pre-specified, not authorized.
- **Do not run a lowest-tier entry, for any reason, including to grow the control
  arm.** User directive: rule 8 without exception.
- **Do not select the historical four after seeing today's results** (§2b), and do
  not substitute a run from another day to fill a lost slot.
- **Do not impute a missing HARD CORES count**, or infer one from score.
- **Do not call a depth-up / HARD-CORES-down result positive** (§2e).
- Do not let a thin room-level slice void the whole-run comparison (§2e).
- Do not fold a trigger-fired-but-empty cast into either outcome arm (§1b).
- Do not treat the mana assumption as settled by approving the policy.
- Do not re-derive the movement model for the oil boundary; check for drift on the
  per-class shrinkage `{1: 0.1, 2: 8}` and π₀ = 0.133, report, and stop there.
- Do not remove the 15-cast zero-streak tripwire (now code, `zeroStreak.ts`).
  Current streak **4**.
- Do not derive a replacement fishing target; 60% was dropped deliberately and the
  replacement is the user's after oil casts exist.
- Do not put identifiers in a test that guards against identifiers.
- The recap checklist's `.gitignore` line is still stale — `config/discovered.json`
  is deliberately **not** ignored.

---

## 7. Corrections to me

Session 61 corrected the brief three times and was right every time.

- **"The corpus contains zero oil casts" was FALSE.** Cast `12975152` carries
  `consumablesUsed: 1` on its first captured state. The derived oil flag found it
  on its first run — which is also the vindication of session 61's choice to derive
  the flag from the server's `consumablesUsed` rather than write it from the loop.
- **"§4a needs capturing" was FALSE — it was captured in session 43.** Both
  payloads had been in `SPEC-fishing.md` since 2026-08-18 and `oilPolicy.ts` had
  held the ids since. I asserted a gap without checking the corpus, which is rule 9
  applied to the brief's own author, and I then built a whole section on the
  assumption that the capture was the session's highest-value item.
- **"`tier_choice` never reaches stdout" was HALF wrong.** A readable decision line
  did print (`logs/run-60-1.log:33`). What was actually missing was the room index,
  the offered-tier list, and any assertion — which is what §1 should have said.
- **And the substantive one: my turn-cost reasoning was inverted.** I argued a
  turn-costing +2 damage is a net loss whenever an ordinary attack deals more than
  2. That assumes the forgone turn is a free guaranteed attack. It is not — a turn
  spends mana and risks a miss that pushes `fishHp` back up. Turns are not scarce
  in this fishery at all (`maxTurns` 40, mean 2.95, `stalled` 1 in 8000); mana is.
  **I named the wrong resource and then called it the highest-value question in the
  session.** The lesson is not "check the payload" — it is that a scarcity claim is
  itself checkable against the sim, and I asserted one from the armchair.

---

## Your task (session 62)

1. Confirm both ledgers: 6/12 run-units, 5/20 casts. Rule 13 applies to every live
   command from here.
2. **§1** — approve the oil policy: `policyApproved: true`, replace heuristic (c)
   with `on-demand`, pin the replacement, implement and **exercise** the
   stock-exhaustion path, add the trigger-fired-but-empty cast state.
3. **§2b** — identify and log the historical four **before** running anything.
4. **§2c** — settle the HARD CORES field's first appearance before comparing.
5. **§2a** — two juiced runs, each pre-registered and each stopping for approval.
6. **§2d–2e** — the full 4-vs-4 report: all eight raw runs, HARD CORES primary
   (total / average / median / per-energy if entry costs differ), depth secondary
   (average / median / range), context alongside, and one classification.
7. **§2f** — corrode sightings plus a reasoned modelling recommendation; boon
   coverage instrumented, not decided.
8. **§3** — only if the user gives a go-ahead. Report the mana answer immediately.
9. **§4** — ask about the `LICENSE` name.
10. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
    **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** Two deliverables carry this session. §1 is a live-policy
change to code that has been playing a dominated rule for nineteen sessions. §2 is
the first read on rule 8 against the era it replaced, and it is worth doing
carefully because it will not be repeatable — the control arm is frozen by
directive, so these eight runs are the comparison, permanently.

**The way §2 most plausibly goes wrong is not a bad verdict, it is a confident
one.** Two failure modes, both cheap to avoid and both expensive to discover
later: counting a HARD CORES field that does not reach back across the era
boundary (§2c), and reading a depth improvement as a win when the currency moved
the other way (§2e). Getting either wrong produces a result that looks clean and
settles a question it never actually answered.
