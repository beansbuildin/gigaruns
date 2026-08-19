# BRIEF — session 47 (fishing, offline-only)

**No live play this session.** The account is inside the server-side daily cast
cap window. **This is a stated constraint, not a gate to be failed** — per
CLAUDE.md §6, a gate set on something unreachable before the session begins is
not a gate. The live batch moves to session 48; nothing in this brief depends
on a cast being played, and the recap should not record a fishing GATE FAIL.

If the cap resets while this session is still running, **still do not play.**
A batch tacked onto the end of a build session is precisely how 17 of 20 casts
went into flawed logic. The batch belongs to a session that opens with the §0b
checkpoint discipline in front of it.

**First, my own error, carried from the last brief.** It opened with "resolve
the stuck doc state via `loot`." Wrong. The `start_run` HTTP 400 was the
server-side daily cap (`"Player has reached max runs for fishing"`); the
terminal-doc shape was a red herring and `loot` resolves the *catch* shape,
which was not present. I inherited session 45's diagnosis and promoted it to
instruction #1 instead of treating it as a hypothesis — the exact failure
CLAUDE.md §9 names. **Do not diagnose a fishing 400 from the doc state; read
the body, which `serverErrorDetail()` now logs.**

---

## 0. Two standing policy changes from the user — in force from session 48

These do not apply this session (no live play) but are recorded here so they
are not rediscovered.

### 0a. ROM energy is claimable on demand. Energy is never a reason not to run.

The session 19-20 "ask before automating ROM claiming" instruction is
**lifted by the user**. It predated `GET /roms/player?id=<address>` being
confirmed (session 22) and overflow past the 420 cap being proven non-wasting
(sessions 21/22).

- **Preflight every live batch** with `GET /offchain/player/energy` **and**
  `GET /roms/player?id=<address>`. If the pool is short, run
  `npx tsx scripts/claimAllRoms.ts` and proceed. Session 46 measured **2,603
  energy claimable** across 27 of 37 ROMs while reporting the batch blocked on
  a "12.5-hour regen wait."
- **Never plan a batch from `data/guard-budget-fishing.json` or
  `config/bot.json`.** Those are this bot's policy ledgers; they know nothing
  about the real pool, the ROM bank, or the server's counter. Session 46's
  ledger implied 2 casts available; the server said zero.
- **The ceilings already agree and need no config change.** Dendren tier 0 is
  `node0Energy = 12`, the server's juiced daily cap is 20 casts, and
  `config/bot.json`'s 240 daily fishing budget is exactly 20 × 12. ROM claiming
  exists to ensure the *pool* can fund that 240 — it is not a licence to exceed
  it. Spending above the configured daily budget stays on the ask-first list.
- **Caveat that still holds:** if claiming turns out to require an on-chain
  transaction that spends ETH, stop and ask. The user authorized the claim, not
  an ETH spend.

### 0b. Fishing runs in batches of 5 casts, with a mandatory checkpoint between

**User directive: 5 casts at a time, maximum**, then stop and read
`scripts/ringPredictionReport.ts --since=<batch start>` before deciding
anything.

This costs almost nothing in evidence. From the leave-one-cast-out paired
differences on the existing corpus — **paired per-turn ΔLL (baseline − ring):
mean 2.599, sd 5.996, n=196**:

| scored turns | 95% CI on paired ΔLL | excludes 0? |
|---|---|---|
| 25 (~2-3 casts) | [0.25, 4.95] | yes |
| **50 (one 5-cast batch)** | **[0.94, 4.26]** | **yes** |
| 200 (the old 20-cast ask) | [1.77, 3.43] | yes |

**One 5-cast batch settles the primary question.** The paired design removes
fish-to-fish variance — both predictors scored on the same turn against the
same fish. The 20-cast batch was only ever needed for *per-class top-1*, which
is weaker (±14pp at 50 turns/class, ±8pp at 150) and should accumulate across
batches as a running figure with its CI, never be read from one batch.

Checkpoint order after every batch: **FACT 1 violations** (any → stop
immediately) → **paired ΔLL with CI** (includes 0 after two batches → stop and
report) → **calibration curve** → **catch rate, flagged as underpowered**.

---

## 1. This session's work, in order

### 1a. Build the energy preflight (session 46's own "highest-value unbuilt thing")

Fold an energy-floor check plus ROM-bank read and claim into
`scripts/liveFishing.ts`'s and `scripts/liveRun.ts`'s preflight. Fully
buildable and testable offline against fixtures — mock the two GETs, assert the
claim fires when the pool is below the planned batch's cost and does not fire
when it isn't, assert it fails closed on a claim error rather than proceeding
with a short pool.

This removes the constraint that blocked or truncated sessions 44, 45 and 46.
It should exist before the next batch, and this session is the natural place.

### 1b. Off-policy replay — the centerpiece, and the reason this session is worth running

**Predict the batch's outcome before spending it.** Every recorded cast fixture
carries the full per-turn state: `fishPosition`, `previousFishPosition`,
`fishHp`, `focusPoint`, `focusMeter`, `playerHp` (mana), `hand`, `fullDeck`,
`nextCardIndex`. That is enough to re-run today's policy against a real
recorded fish and ask **"what would the current stack have done on the 69 casts
we actually played?"**

**Precondition, test this first and do not skip it:** the replay is only valid
if the fish's movement is independent of whether your shot hit. Test it
directly — for every recorded transition, classify the *preceding* play as hit
or miss (from the `fishHp` delta), then compare the next-delta distributions
conditional on hit vs. miss, **within step class and controlling for previous
delta**. If they differ materially, the movement model needs a term it does not
have and the replay is invalid; that would itself be the session's headline
finding. If they don't, replay is sound and the rest follows.

**Harness design:**

- Take the recorded fish trajectory as ground truth and re-simulate everything
  the policy controls: focus placement, card choice, mana, `fishHp`, focus
  meter. Draws are deterministic — `fullDeck` plus `nextCardIndex` reconstructs
  the exact sequence — so a different card choice still yields a well-defined
  subsequent hand.
- **Refit leave-one-cast-out.** The cast being replayed must be excluded from
  the model it is scored against, or the number is in-sample and worthless.
- **Truncate at the recorded trajectory length.** If the replayed cast would
  have run longer than the record, score it as not-caught. That makes the
  result a **conservative lower bound**, which is the right direction to err in
  — say so explicitly rather than quietly.

**Report:** counterfactual catch rate vs. the actual 7/69 = 10.1%, per-turn hit
rate vs. what was actually realized, and paired ΔLL — all against the same
trajectories the old policy actually played, which makes it a paired *policy*
comparison, not just a paired predictor comparison.

**What it can and cannot tell you.** It cannot confirm the model on fish it has
never seen — every replayed trajectory is already in the corpus, and
leave-one-cast-out mitigates but does not eliminate that. It *can* tell you
whether the new policy would have converted the shots the old one missed, on
real fish, with real decks and real mana curves. If the replay says the new
stack catches 15-20 of 69 where the old caught 7, the 5-cast batch goes in with
a genuine prior instead of a hope. If it says 8 of 69, that is worth knowing
before spending 60 energy.

### 1c. Re-check the focus-reserve weight — the sim moved under it

`w=3` was swept before heuristic (d) was retired and before `hits/shots`
instrumentation existed. Session 46 changed the sim under that result. One run
of `scripts/focusReserveAblation.ts` on the current empirical-fish + ring
configuration, reporting **catch rate and per-turn hit rate side by side**,
confirms whether 3 is still the plateau. Small, cheap, and the kind of stale
constant that survives for ten sessions if nobody looks.

### 1d. Reword the `unknownDocKeys` stuck-doc warning

It prints "the account is likely stuck… `start_run` below will probably
reject" on every run that sees a terminal doc, and it has now caused two
consecutive misdiagnoses — one of which propagated into a brief as its first
instruction. The condition it fires on is not the condition that rejects
`start_run`. Reword to state only what was observed ("terminal doc present;
this does not by itself predict a `start_run` rejection — read the 400 body"),
or remove it.

### 1e. Check the dungeon side for the same swallowed-error-body bug

`client.ts` throws `UnexpectedResponseError` whose `.message` carries only the
status; the server's text lives in `.body`. That made `runOneCast`'s
server-cap classifier **dead since session 29**. `scripts/liveRun.ts` was never
checked — same shape, likely the same bug.

While in there, **grep for every other classifier that tests a pattern against
`.message`**. The generalized lesson from session 46 is worth acting on, not
just recording: *a guard's condition can name a real fact while reading a field
that fact never appears in.* Two worked instances in one session (heuristic
(d)'s displacement-vs-class guard, the server-cap classifier's `.message`) is
a pattern, not a coincidence.

### 1f. Decide the dungeon items rather than deferring a fifth time

The scheduler energy-tracking gap and the charge-reserve plateau (sessions
40-42) have been carried unaddressed for four consecutive sessions. That was
right while fishing had the open questions. With fishing now reduced to "run 5
casts and read the report," it no longer fills a session. Either pick one up
this session or **formally park them in TASKS.md with what would unpark them** —
CLAUDE.md §6's own discipline applied to the backlog.

---

## Your task

1. §1a — build and test the energy preflight offline.
2. §1b — run the movement-independence precondition test first. If it passes,
   build the off-policy replay harness and report the counterfactual numbers
   with the truncation caveat stated. If it fails, stop there and report that
   instead; it is the more important finding.
3. §1c — one focus-reserve re-sweep on the current sim configuration.
4. §1d / §1e — the warning reword and the dungeon-side error-body check plus
   the `.message` grep.
5. §1f — pick up a dungeon item or formally park both.
6. **Do not play a cast, even if the cap resets mid-session.** The batch is
   session 48's, and it opens with §0b's checkpoint in front of it.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit. Record §0a/§0b as standing policy so session 48 inherits them.

Honest expectation: §1b is the one that could surprise. The most likely outcome
is that movement is independent of hits, the replay works, and it shows a
meaningful but smaller lift than the in-sample sim projects — which is exactly
what SPEC-fishing.md §9's calibration discount predicts and would be a healthy
confirmation of it. The outcome worth watching for is a replay lift near zero
despite the predictor's large log-loss advantage: that would mean better
prediction isn't converting into better shots, and would point squarely at
focus placement as the remaining defect.
