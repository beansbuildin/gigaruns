# BRIEF — session 74

## The clock and the ledger

Written **2026-08-21, 19:25 PT**. *Source: session 73 live-read.* Fishing
**20/20 spent**; dungeon **0/12**. Rollover **11:00 PT tomorrow**, ~15½h out.

**This brief authorizes the day's fishing allowance (§4) and ZERO dungeon runs.**
If the session runs before 11:00 there are no casts, and §1–§3 are the whole
session — as happened to session 73, which was written the same way and lost
nothing by it.

`doctor.ts` first; read both ledgers and report them.

*Environment, sessions 66–73: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. Re-run the ring shrinkage CV at 128 casts — the boring explanation first

**User decision, 2026-08-21: this leads.**

*Source: session 73.* The ring tier's corpus delta table **claims +15.69pp of
sharpening and delivers +6.88pp — a 43.8% delivery ratio**, and that accounts for
**93.9% of `pConnect`'s whole optimism**. The matcher is innocent: on its own 62
turns it predicts 51.9% and observes 48.4%, carrying 5.1% of the weight.

`shrinkageKByClass` is `{1: 0.1, 2: 8}`, **swept on log loss at 88 casts. The
corpus is now 128.** If the table is simply under-shrunk at the new size, the
"the conditional is broken" conclusion partly dissolves.

**Checking the cheap alternative before building on the alarming one has now paid
off twice** — the oil arm retracted session 71's headline, and era-pooling
retracted session 70's. That is the reason for this ordering, not caution for its
own sake.

### 1a. Pool across eras here — and that is not a contradiction

The era rule is about to be over-applied, so state it explicitly in the report.

*Source: session 61 brief §4b, the dead-era precedent.* **Outcome metrics split
by era; the movement model pools.** The fish moves how fish move; a policy change
alters what we spend, not what the fish does. Shrinkage is a **movement-model**
parameter, so the CV pools all 128 casts.

**Splitting it by era would be over-correcting** — the same reflex that produced
session 70's "session 49's numbers are stale", which was itself wrong.

### 1b. What to report

- Whether the optimum moved, and by how much, at 128 casts versus 88.
- **The delivery ratio recomputed at the new optimum.** That is the number that
  says whether this explains anything: if delivery goes 43.8% → 90%, the
  conditional is largely exonerated; if it barely moves, it is not.
- **A cross-validated sweep is still a fit.** Report the CV design and whether the
  optimum is flat or sharp — a sharp optimum on 128 casts is a warning, not a
  result.

**Do not ship the new parameters**, whatever they are (§3).

---

## 2. `isLethal` — build the tightening, measure its blast radius, do not flip it

**Two user answers, 2026-08-21, that pull against each other:** *tighten
`isLethal` now*, and *ship nothing until the diagnosis is settled.* This section
honours both — **the work happens this session; the flip waits on one word from
the user.**

*Source: session 73.* `isLethal` is the most consequential live level-based
consumer and nobody had listed it. It does not decline an action — **it grants an
override**:

- a lethal placement is **exempt from the focus spend constraint**
  (`bestFocusForCard`: "a LETHAL placement is never blocked"), and
- it **short-circuits both oil gates**.

And it reads the worst-calibrated end of the range: the **[0.50, 1.01) bucket
predicts 72.2% and observes 60.3%.** Its current test is `pAnyHit < 0.999999`.

### 2a. Measure first — the two override paths are separately countable

- How many turns claimed lethal, and **how many of those actually killed**?
- **Split by override path**: how many took a focus placement the spend
  constraint would otherwise have blocked, and how many short-circuited an oil
  gate that would otherwise have fired?
- **Report the cost in fish and turns, not in counts.** A lethal claim that
  misses costs that turn; a lethal claim that skipped an oil may have cost the
  cast. Those are not the same and should not be summed.

### 2b. Then implement the tightening behind a flag that is demonstrably OFF

- A stricter `isLethal` predicate, with the change and its rationale in the code.
- **Default OFF**, and a test that fails if the default is on — the same shape as
  `redrawEnabled` and `policyApproved`.
- Report what the tightening *would* have changed on the measured turns.

**Do not flip it.** The user's standing posture is ship-nothing-until-settled, and
the estimator this gate reads is the thing under diagnosis.

---

## 3. Correction posture — ship nothing, and say so in `DECISIONS.md`

**User decision, 2026-08-21.** Until the `pConnect` diagnosis settles:

- **No default changes, no thresholds moved, no strategy behaviour altered.**
- New shrinkage parameters from §1: measured, not adopted.
- The `isLethal` tightening from §2: built, defaulted off, not adopted.
- The prev-delta conditional: not disabled, however good §1's numbers look.

Record it as a **posture with an exit condition**, not an indefinite freeze —
name what "settled" requires, so a future session can tell whether it has been
reached rather than re-litigating it. A reasonable statement of it: the §6
comparison paired (§5), the delivery ratio explained or attributed, and the
`isLethal` blast radius measured.

---

## 4. Live — the two carried items, both still valid

Session 73 could not spend these; the ledger was at 20/20 when it ran. **Twenty
casts become available at 11:00 PT.**

### 4a. The forced Relaxing consume — one, and keep it OUT of the arms

Unchanged from session 73's §2 and still the right design.

- **One consume, on a fish with `fishHp` comfortably above 2**, early in a cast,
  so the delta is not clipped by lethality. This is **deliberately outside
  policy** — the one authorized exception.
- Capture the full `use_fishing_item` envelope, `fishHp` and mana before and
  after, and confirm nothing else moved.
- **It must not enter either oil arm or the era catch rate.** Give it its own cast
  state, the way `OIL-POLICY-DRY` was carved out. *Gate 1 of session 72 rests on
  the oil arm at n=14 with a 0.9pp margin* — one contaminating cast is enough to
  matter.
- If the moment does not arise, **report it and do not retry.**

### 4b. Casts

- **Batches of 5, hand back after each.** Policy unchanged; Relaxing capped at 2
  per cast (still never bound); no forced consumes except §4a.
- Halt on the batch count, a short ledger, or the 15-cast zero-streak tripwire.
- **Report the running era rate with its Wilson interval and both oil arms' n**
  every batch. Today's era: **23/39 = 59.0%**, [43.4%, 72.9%].
- Rule 13 after each batch: the ledger must move by exactly the casts sent.
- **If the rod, lures, zone map or matcher weighting change, the era breaks** —
  say so at the moment it happens.

---

## 5. The paired §6 comparison — design it now, run it after §1

*Source: session 73.* Re-planned with the prev-delta conditional off, observed hit
goes **40.3% → 51.2%** and the gap flips negative. **It is not clean**: 125 turns
against 134, unpaired, and the observed columns are contaminated by which turns
exist at all. Naively the difference is ~1.8 SE with heavily overlapping
intervals.

**Do not run it before §1**, because a shrinkage result changes how it should be
set up. But **write the design down this session** so it is not improvised later:
same turn set, or a cast-level bootstrap, and state which turns each arm is
allowed to drop and why.

---

## 5a. A redraw is NOT damage-neutral — check what `castSim` assumed

**User question, 2026-08-21, and the evidence says no.**

*Source: the user's DevTools capture, doc `13025041`.* The events on that turn:

```
FISH_MOVED    value 5   path [5]
CARD_PLAYED   value 0   result 0
FISH_HP_DIFF  value -3  result 10
NEW_HAND      [4, 38, 75]
```

`FISH_HP_DIFF: -3` with `result: 10` means `fishHp` went **7 → 10 — the fish
HEALED 3**, the same sign as a card's `missEffects`. `FISH_MOVED` fired too. So a
redraw appears to cost **mana, a heal, and a fish step**.

**How firm this is, stated honestly.** The response and the `cards: []` request
payload came from **different calls** — the user captured them on separate manual
casts. The reason to read this one as a redraw is `NEW_HAND` returning **three**
cards where ordinary play shrinks the hand. A `CARD_PLAYED result 0` with a −3
heal is otherwise indistinguishable from an ordinary miss.

**This does not reopen redraw** — it is CLOSED at 263 mana per extra fish and
this pushes the cost up. But:

- **Check what `castSim`'s redraw model actually charges.** If it modelled the
  move as damage-neutral, the 263 figure **understates** the cost and the model is
  wrong in an unexamined direction. Record the answer either way.
- Add the observed event sequence to SPEC-fishing §7a as the redraw's measured
  cost, **labelled as one observation with the attribution caveat above** — not as
  a confirmed mechanic.

---

## 6. Gate

Both halves are offline and deterministic; neither depends on §4 landing.

1. **The shrinkage CV is re-run over all 128 casts pooled**, with §1a's reasoning
   stated in the output, and **the delivery ratio recomputed at the new optimum**
   alongside the old 43.8%. A sweep that reports new parameters without the
   recomputed delivery ratio does not meet this gate.
2. **`isLethal`'s override blast radius is measured, split by the two override
   paths**, and the tightening is implemented with a test that **fails if its
   default is on** — demonstrated failing, then restored.

---

## 7. Do not

- **Do not run a dungeon run.**
- **Do not ship anything** — no shrinkage adoption, no `isLethal` flip, no
  conditional disable (§3).
- **Do not split the shrinkage CV by era** (§1a).
- **Do not let the forced consume enter either oil arm or the era rate** (§4a).
- **Do not force any consume other than §4a's.**
- **Do not run the paired comparison before §1** (§5).
- Do not reopen redraw, the matcher as `pConnect`'s cause, `shrinkageK` (inert —
  `shrinkageKByClass` overrides it), or the 0.05 switch probability as a
  correction. All four are closed.
- Do not quote +19.40pp (SUSPENDED), or present a `castSim` result as evidence
  about live play.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me

- **My `pConnect` figures were stale by session 72's own batch.** I quoted 118
  turns at 50.0% vs 39.8%; the correct current figures are **134 turns, 49.7% vs
  40.3%, gap 9.38pp at 2.2 SE.** The finding was unchanged and the size moved.
- **The failure mode is new and worth naming: a recap can be internally stale.**
  Session 72's replay figures were computed *before* the four-cast batch that same
  session then played and appended. Nothing in the recap was wrong when written;
  it was overtaken by the session's own later work. **So the freshest source is
  not the newest document — it is the script.** `redrawTriggerCalibration.ts`,
  unmodified, prints the current numbers on demand.
- **I also carried "the hardcoded-path ratchet is 26" forward. The test asserts
  25 and passes.** Same class: I repeated a figure from a recap without checking
  the authority that enforces it.
- **The rule both of these point at:** *a recap is a secondary source; the test or
  script is the authority.* When a brief quotes a number that some code computes,
  the number should come from running that code, not from the last document that
  mentioned it. That is cheap for exactly the figures I keep getting wrong,
  because they are the ones with a script behind them.

---

## Your task (session 74)

1. `doctor.ts`, read both ledgers, report them.
2. **§1 / gate 1** — re-run the shrinkage CV pooled over 128 casts; report whether
   the optimum moved and **recompute the delivery ratio at it**. Adopt nothing.
3. **§2 / gate 2** — measure `isLethal`'s override blast radius split by path;
   implement the tightening **defaulted off**, with a test pinning the default.
4. **§3** — record the ship-nothing posture in `DECISIONS.md` **with its exit
   condition**.
5. **§5** — write down the paired-comparison design. Do not run it yet.
   **§5a** — check whether `castSim` charges a redraw the heal and the fish step;
   record the observed sequence in SPEC with its caveat.
6. **§4** — if casts exist: the single forced Relaxing consume, then batches of 5.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 most likely moves the optimum a little and explains
some but not most of the delivery ratio — in which case the conditional stays the
prime suspect and §5's paired comparison becomes the next session's build. **The
result to be suspicious of is a shrinkage optimum that explains the whole gap**,
because that is the third time in four sessions the tidy answer would have been
the wrong one: the replay was never broken, the sim's catch gap was oils, and the
redraw trigger's currency was never the problem. A sharp optimum on 128 casts
should be read as a fitting artefact until something independent agrees with it.
