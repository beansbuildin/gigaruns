# BRIEF — session 75

## The clock and the ledger

Written **2026-08-21, 20:40 PT**. *Source: session 74 live-read.* Dungeon
`dayProgressEntities` **null / 0 of 12 — twelve run-units available now**, no
rollover needed. Fishing **20/20 spent**; rolls at 11:00 PT, ~14h out.

**This brief authorizes FOUR juiced dungeon runs (§1) and ZERO fishing casts.**
**User decision, 2026-08-21: dungeon only this session.** The two carried fishing
items — the forced Relaxing consume and the era-sample batch — **carry forward
again, deliberately.** They cost nothing to defer and have survived two sessions
unspent.

`doctor.ts` first; read both ledgers and report them.

*Environment, sessions 66–74: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. Four juiced dungeon runs — and `--dry-run` before the first one

**User decision, 2026-08-21: all four, one at a time.**

Rule 11 terms, unchanged: **60-energy juiced, `--juiced-index=3`, 3× Big Heal
Juice, `--runs=1`, stop and hand back.** Each run needs its own go-ahead;
approval for one is never approval for the next. Redirect and `tail`; never pipe
a live run to a truncating reader. Energy is not a constraint (rule 12).

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 > logs/run-75-1.log 2>&1
```

### 1a. Dry-run first. The dungeon path has not executed since session 62.

**Twelve sessions and roughly 130 commits have landed since the last live dungeon
run**, essentially all of them fishing or analysis. Several touched code the
dungeon path shares — `src/orchestrator/guards.ts` gained `adoptServerRunCount`,
`buildBattleState` gained the corrode wiring, and the sim and strategy seams have
moved repeatedly.

`liveRun.ts --dry-run` **runs every guard, spends nothing, and takes twenty
seconds.** The repo's own standing rule is to exercise the real gate before
claiming a blocker; here it is the same instrument used before *spending* three
run-units on a path nobody has exercised in twelve sessions.

**Do this first and report what it prints.** If it fails, that is the session's
finding and the runs wait.

### 1b. What the runs are FOR — capture, not comparison

**Rule 8's measurement programme is CLOSED** (DECISIONS 2026-08-21). Do not re-run
the 4-vs-4, do not propose a new comparison, and do not present these four runs as
evidence about rule 8. The control arm is frozen and no number of rule-8 runs
resolves it.

What these runs actually buy:

- **Boon coverage.** *Source: session 62.* Orb **6** / priority **2**, and
  **frozen since then for want of runs** — three consecutive recaps have had to
  report it unchanged. This is the first opportunity to move it. Record first-ever
  pickup pairs and the `UNMODELLED_TYPES` delta.
- **Corrode sightings.** Three variants captured: `corrosiveSword` (sword),
  `corrosiveShield` (paper), `corrosiveMagic` (scissor), all `minTier: 2`,
  **amount read off the buff, never hard-coded**. It is modelled in the combat
  core and live-wired; more sightings test the model rather than extend it.
  **Do not complete the perpetual-twin table to a neat 3×2** —
  `perpetual_corrosiveShield` and `perpetual_corrosiveMagic` have zero observed
  appearances.
- **HARD CORES per run**, reported per run and as a total. It is the currency.
- **§23's `(elapsed, drift)` pair.** *Session 71:* the predictor is
  `Bernoulli(elapsed / 3.33)`, not `floor()` — three observations fit so far. Four
  more runs is a real increment on n=3.
- **The in-loop tier gate.** Session 61's `auditTierChoice` re-derives rule 8's
  answer from the raw offer and **halts on disagreement**. Last exercised at
  **12/12 correct**. Report the count.

### 1c. Report per run

Tier offered vs taken per room; Perpetual filter rate; `orbFallback` fire count
and `narrowed`; orb sum; loot; score; rooms; potion use and at what HP;
first-attempt action failures; 429s; unknown enums; guard trips.

**Rule 13 after every run:** read `checkDungeonToday.ts` and confirm
`dayProgressEntities` moved by exactly 3. *Session 61's precedent:* a denial
message is not evidence that nothing ran. *Session 70's:* a cast was once charged
energy without ticking the ledger — the same class of silent divergence.

---

## 2. Measure the other three live level gates — this may close the `pConnect` thread

**User decision, 2026-08-21.**

*Source: session 74, gate 2, and it inverted the premise I gave it.* `isLethal`
fires **once in 373 live decisions** and **never in 440 replay turns** — the
correction target session 73 nominated as "narrow" turns out to be narrow enough
to be empty.

So measure the rest of the inventory the same way. *Source: session 73's gate 2
classification —* the live level-based gates are:

- the **Focus** oil necessity gate,
- the **Relaxing** oil necessity gate,
- the shadow's **two `>= 1` certainty checks**.

**Use the same instrument shape as `isLethalBlastRadius.ts`** — paired at the
turn, re-planning on the identical state, so the counterfactual shares the turn
set by construction. *Session 74:* that pairing is what made the zero
interpretable; session 73 §6's unpaired 125-vs-134 was not.

### 2a. If they all fire ~never, say what that closes and what it does not

The recap asks whether "moot" is an acceptable exit. **It is — on two conditions,
and both should be written into the posture rather than assumed:**

- **State it as closed-by-irrelevance, not closed-by-explanation.** `pConnect`
  would still be optimistic at +9.38pp; it would simply not reach any consumer
  where the level matters. Those are different claims and the record should not
  blur them.
- **Name the ratchet as what keeps it true.** Session 73's
  `pConnectConsumers.test.ts` fails when a new unclassified consumer appears — so
  a future level-based consumer reopens the question automatically. **That guard
  is the reason "moot" is safe to record**, and it should be cited in the exit
  condition, not left implicit.

If instead one of the three fires often, that is the correction target `isLethal`
turned out not to be, and it becomes the next session's work.

---

## 3. Fix `castSim`'s redraw to advance the fish — outside the freeze

**User decision, 2026-08-21: outside the ship-nothing freeze, fix it.**

*Source: session 74.* The redraw branch `continue`s past both `observe()` and
`turn++`, so **a redraw in the sim is time-free while the real one moves the
fish.** Mana (1 per card held) and damage (none — *user-confirmed, and it
retracts my §5a*) are already correct.

- Charge the turn and the fish step.
- **Re-derive the 263 mana per extra fish**, since the user chose the plain fix.
  Redraw stays **CLOSED** either way — this makes the closed verdict firmer, and
  §5a's finding says the old number was an understatement.
- **Check the blast radius before assuming it is contained.** Which other sim
  consumers execute that branch? If the oil sweeps and the focus profile never
  enable redraw, the fix touches nothing else — **establish that rather than
  asserting it.** A sim branch fix that silently moves an unrelated published
  number is exactly the class this repo keeps finding.

---

## 4. Carried

- **Ship-nothing posture holds** for everything else: no shrinkage adoption (the
  re-fit optimum is unstable — decided by a tiebreak column that flipped sign
  under 40 more casts, on a 0.006-logLoss plateau), no `isLethal` flip
  (`STRICT_LETHALITY` measured **inert**: 0 no-move turns in 440), no conditional
  disable.
- **The conditional is prime suspect BY ELIMINATION**, which is weaker than it
  sounds — stale shrinkage explains 12%, `isLethal` fires ~never.
  `PAIRED-CONDITIONAL.md` is designed and unrun; §2 decides whether it is worth
  running.
- **Do not tighten `isLethal` on its threshold** — there is no number above 1, and
  any calibration haircut makes it never-lethal. The optimism enters through the
  **support**, not the threshold.
- Fishing carried: the forced Relaxing consume and the era batch (session 74 §4,
  designs still valid); the oil row of session 72's gate 1 still fails (50.1% sim
  vs 78.6% live, n=14).
- The `nextPosition` tripwire has still never met a real miss. `preflight.ts` in
  CI open since session 68. Distribution steps 3/4/6 are the user's.
- Standing: never report energy as a blocker; do not revert rule 8; redraw is
  CLOSED; +19.40pp stays SUSPENDED; do not loosen the `fakeDoc` observability
  guard; `boonCapture` settled OFF; do not fold stock into the oil threshold; the
  matcher is not `pConnect`'s cause; `shrinkageK` is inert.

---

## 5. Gate

Both halves are offline and deterministic; neither depends on the runs.

1. **The three remaining live level gates' firing rates are measured with the
   paired-at-the-turn instrument**, and the ship-nothing exit condition is updated
   to state explicitly whether the `pConnect` thread closes as **moot** or stays
   open — **citing the consumer ratchet as what makes "moot" safe** (§2a).
2. **`castSim`'s redraw charges a turn and a fish step**, demonstrated by a test
   that fails against the old `continue`, **plus an enumeration of which other sim
   consumers execute that branch.** A fix without the blast-radius enumeration does
   not meet this gate.

---

## 6. Do not

- **Do not start a dungeon run before `--dry-run` passes** (§1a), and **never
  chain runs** — each needs its own go-ahead.
- **Do not fish.** Zero casts this session.
- **Do not re-run rule 8's comparison** or present these runs as evidence about it.
- **Do not ship** the shrinkage re-fit, the `isLethal` tightening, or the
  conditional disable (§4).
- **Do not hard-code corrode's amount or complete its twin table** (§1b).
- **Do not blur closed-by-irrelevance with closed-by-explanation** (§2a).
- Do not quote +19.40pp, or present a `castSim` result as evidence about live play.
- Do not read a `GearInstance` suffix as an equip time.
- Do not put identifiers in a test that guards against identifiers, and do not give
  a new I/O-owning test construction a real data path.

---

## 7. Corrections to me

- **My §5a was wrong: a redraw does not heal the fish.** I read doc `13025041`'s
  `FISH_HP_DIFF: -3` / `result: 10` as a redraw healing 3. The user confirmed from
  their own play that redraw does neither damage nor heal; the −3 was an ordinary
  miss carrying `missEffects`.
- **The caveat worked and the headline still did damage.** I flagged the exact gap
  that resolved it — response and `cards: []` payload came from different calls,
  and a miss is indistinguishable from a redraw on that evidence. But the section
  **led with the inference and appended the doubt**, so it entered SPEC-fishing as
  a mechanic needing retraction. **A caveated wrong answer still propagates as an
  answer.** The right shape was to lead with the question and let the capture
  settle it.
- **I relayed session 73's "`isLethal` short-circuits the oil gates". It does
  not.** One call site; `onDemandTriggers` is `fishHp <= fishDamage` with **no
  estimator input at all**. Card-play lethality and oil lethality were conflated,
  and I repeated the claim as a reason to prioritise `isLethal`.
- **The part worth sitting with: I wrote the rule that would have caught it, in
  the same document.** Session 74's §8 said *a recap is a secondary source; the
  test or script is the authority* — and §2 of that same brief made a structural
  claim about code sourced from a recap, without opening the file. Session 73's §8
  named a diagnostic I then failed to apply one message later. **Twice now the
  lesson has been written in the retrospective and broken in the body.**
- **So the fix has to be structural, not intention.** From here: **any claim in a
  brief about what code does — "X reads Y", "A short-circuits B", "this is the
  only call site" — gets the file opened before the sentence is written.** Not at
  review, not in the §8 afterwards. That is a small, checkable rule aimed at
  precisely the claims I keep getting wrong, and unlike a resolution it either
  happened or it did not.

---

## Your task (session 75)

1. `doctor.ts`, read both ledgers, report them.
2. **§1a** — `liveRun.ts --dry-run` first. Report what it prints. If it fails,
   that is the session and the runs wait.
3. **§1** — up to four juiced runs, one at a time, each stopping for approval.
   Full per-run report; rule 13 after each.
4. **§2 / gate 1** — measure the three remaining live level gates; update the exit
   condition with the moot-vs-open verdict and the ratchet citation.
5. **§3 / gate 2** — fix `castSim`'s redraw, re-derive 263, enumerate the blast
   radius.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** The dry-run is the item most likely to produce a surprise,
and it is the cheapest thing in the session — twelve sessions of drift on a path
nobody has executed is exactly the condition sessions 64, 65 and 66 kept finding,
where a component looked shipped and had never run. **§2 is the one that could
close a thread that has consumed three sessions**, and the honest version of that
outcome is unsatisfying: `pConnect` stays wrong and stops mattering. That is a
real result and it should be recorded as one, not dressed up as a fix or buried as
a non-finding.
