# BRIEF — session 46 (fishing)

Session 45 cleared its gate. The ring model (`stepClass.ts`) beat the shipped
predictor out-of-sample on 68 clean casts / 211 transitions — log loss **1.118
vs 3.536**, top-1 **46.4% vs 42.7%**, and **0 zero-probability events vs 23** —
and is live-wired, default-on, at commit `1c86561`. The focus-reserve term
shipped at `w=3` (+1.6pp, honestly reported against the ~+5pp I projected).
Heuristic (d)'s regression verdict was corrected to neutral. Suite 664/664.

Everything the corpus can settle by itself is now settled. **The only question
left is whether the model transfers live, and that needs casts.** This session
is mostly about spending energy well and instrumenting it properly — not about
building more model.

---

## 0. The blocker, first

The account is stuck in the completed-but-unresolved doc state (QUESTIONS.md
§10). It killed cast 3 of session 45's batch: `start_run` rejected HTTP 400,
guard tripped, batch stopped. That is the fail-closed behaviour working
correctly, and it is also a hard wall in front of everything below.

Session 44 saw a fresh `start_run` succeed past this doc shape **twice**, so it
is not reliably fatal — the state clears sometimes and nobody has established
when or why. Before anything else:

1. Dry-run `scripts/checkFishingStuck.ts` and read the current doc shape.
2. If a `cardsToAdd` offer is pending, resolve it with the `loot` action — that
   is the confirmed exit from this state (session 17, QUESTIONS.md §10) and the
   most likely cause.
3. If it clears, go straight to §1. If it does not clear after one honest
   attempt, **do not keep poking it** — do §3 and §4 offline, write what you
   observed into QUESTIONS.md §10 with the full doc body, and stop. A blocked
   fishing session that leaves clean offline work behind is a fine session.

Do not spend energy probing whether the state cleared by starting casts. Read
state, don't guess at it.

---

## 1. The live batch — 20-30 casts, instrumented paired

This is the session's whole point. Three things to get right.

### 1a. It spans two days, so plan it that way

`maxPerDay` is 10, `maxPerDayJuiced` 20; Dendren tier 0 is `node0Energy = 12`
against a 240 daily energy budget. So **20 casts is one full juiced day**, and
a 20-30 cast batch is 1.5 days. Run 20 today, the remainder tomorrow, and
report each day separately as well as pooled. Do not let a partial second day
get silently averaged into the first.

### 1b. Gate on scored TURNS, not casts, and log both predictors

Session 45's live read was n=18 scored turns with a 95% CI of roughly
[12%, 51%] — a number that could not have failed. At ~10 turns per cast, 20-30
casts gives **200-300 scored turns**, which at p≈0.4 is a CI half-width of
about ±7pp per class. That is a gate that can actually be met or missed, which
is what CLAUDE.md §6 asks for.

**The methodological upgrade this session should make:** log the shipped
cell+prev-displacement predictor's distribution *alongside* the ring model's
on every turn, and compare them **paired**, on the same turns, on the same
fish. Comparing a live number against an offline constant (38.2%) throws away
the fact that some fish are simply harder than others; a paired comparison
removes that variance entirely. `scripts/ringPredictionReport.ts` already
prints per-class top-1 — extend its row schema to carry both predictors'
probability assigned to the realized cell, then report:

- **paired mean log-loss difference** (ring − baseline), with a CI. This is the
  decisive statistic. The offline gap is 2.4 nats; at n=200 paired turns that
  is overwhelming if it transfers at all.
- per-class top-1 for each predictor, **split by `k`** — against 54.1% (k=1)
  and 38.2% (k=2), never the pooled 46.4%. Session 45's two casts were both
  `k=2`, which is exactly why the pooled comparator misled.

### 1c. The cheapest and sharpest check: FACT 1 out-of-sample

Every new transition either lands on the legal Manhattan-`k` ring or it does
not. Session 45's batch added 20 with **0 counterexamples**. At 200-300 new
transitions, a violation rate above ~1% becomes visible.

**Primary gate for §1: 0 off-ring moves, and 0 class-inconsistent casts, across
the whole batch** (on the `isCleanCast`-filtered corpus — carry session 45's
exclusion of cast `12923189`'s duplicate turn-0 records; any restatement of
FACT 1 that drops that caveat is wrong).

If this holds, the model's core is confirmed regardless of how the catch-rate
coin lands, and that is the durable result. If it fails, that is a much more
important finding than any catch rate and the session should stop and report
it immediately.

### 1d. Add one instrument: predicted vs. realized hit rate

Log, per turn, the hit probability `chooseCard` assigned to the card and focus
it actually played, next to whether it hit. Pooling those into a calibration
curve costs almost nothing and is the one diagnostic that separates the three
ways this can still go wrong:

| observed | means |
|---|---|
| prediction good, realized hit ≈ predicted, catch rate still low | the model is fine; the binding constraint is focus budget, deck, or mana |
| prediction good, realized hit **below** predicted | focus placement is the defect — the policy is aiming at cells the model likes but cannot cover |
| prediction poor (paired log loss doesn't transfer) | the model doesn't generalize past the corpus it was fitted on |

Without this, a low catch rate is uninterpretable and you will be tempted to
tune something at random. With it, the next session's brief writes itself.

**Reporting discipline:** today's batch catch rate separately from the all-time
7/69 = 10.1%. At n=20-30 casts a catch rate is nearly uninformative — say so
rather than reading a verdict into it. The per-turn numbers are the result;
the catch rate is a byproduct.

---

## 2. Retire heuristic (d)

Session 45 established that `pruneReturnToPrevious` is a **proven no-op for
`k=2`** — its guard tests `|prev.dx| + |prev.dy| === 1`, the displacement's
length rather than the step class, so it can never fire on the one class where
reversal is the single most likely move (39.2%). For `k=1` it is redundant:
§9's conditional table already assigns reversal ~0 probability from the data
itself.

Remove it, and remove its call sites in `castSim.ts` and `liveFishing.ts`.
A dead guard that *looks* like it encodes a movement rule is worse than either
enforcing the rule or deleting it — the next reader will assume the codebase
handles reversal via this function and stop looking for §9's table.

Keep the finding in SPEC-fishing.md §8, including the history: it was
user-proposed, implemented unverified, measured as a regression against a
synthetic fish the game does not have, corrected to neutral, and finally
retired as subsumed. That arc is worth preserving as a worked example of why
sim authority is earned per domain.

---

## 3. Close the deck thread properly — one diagnostic run

Session 45 refuted brief §4's deck-composition claim and the refutation should
stand. But one number in it is not consistent with the geometry, and the thread
should be closed with a reason rather than just a verdict.

Measured there: shape-matched MID `[7,79,76]` at **15.2%/14.7%**, *below* the
real deck's 33.2%/32.9%. Independently re-run with the same three cards, the
opposite ordering appears — MID **83.1% catch at 71.8% per-turn hit** vs. the
real deck's 57.6% at 51.4%. Two harnesses producing a ~20pp inversion cannot
both be describing the same card geometry.

**The diagnostic: re-run the deck arms printing per-turn hit rate alongside
catch rate.** Hit rate is very nearly a pure function of card zones and focus
placement — independent of the HP arithmetic, the mana curve, and the
sequential-`drawHand` confound session 45 already flagged. Then:

- MID's per-turn hit rate **≥** the real deck's, catch rate lower → the deck
  harness has a bug, most likely in the draw/refill path with a short repeated
  deck. Same class of defect as the `blindFallback` omission caught mid-session.
- MID's per-turn hit rate genuinely **lower** → the geometry claim is wrong,
  the refutation stands unqualified, and it should say *why*.

Either way, **the practical conclusion does not change and this is not worth
more than one run.** You gain one card per catch, so wholesale deck replacement
is unreachable; the only regime you can ever act in is marginal. A marginal
sweep — real deck plus exactly one added card, 16 candidates — moves catch rate
by ~0-3pp, inside noise. The deck lever is small where you can actually pull it.
Record that and close the thread.

---

## 4. SPEC hygiene, cheap and worth doing while blocked

- **Write the log-loss smoothing convention into SPEC-fishing.md §9.** The
  brief-vs-measured baseline discrepancy (2.070 vs 3.536) reconciles exactly:
  the brief's figure floored every predictor with ε=0.02 uniform smoothing; the
  shipped path has no floor, so a zero-probability event costs ~20.7 nats
  instead of ~6.7. With 23 such events in 211 transitions that is
  23/211 × (20.7 − 6.7) ≈ **1.5 nats** against a measured gap of **1.47**. Both
  numbers were right; only the convention differed. State the convention so the
  next comparison is unambiguous, and note that the ring model's **0
  zero-probability events** is structural (the ring floor), which is why its
  advantage is robust to whichever convention is chosen.
- **Record the calibration discount as a standing rule.** Two independent
  in-sample projections have now over-predicted live by roughly 2.5-3x (the
  22.4% sim figure vs 10.1% live; my ~+5pp reserve projection vs +1.6pp
  measured). The *shape* of these projections transfers — w=3 landed exactly on
  the predicted plateau, the ring model's log loss came in slightly better than
  projected — but the *magnitudes* do not. Any future brief quoting an
  in-sample catch rate should carry that discount explicitly rather than
  rediscovering it.

## 5. Low priority

- `data.nextMovePath` / `nextPosition` (QUESTIONS.md §17): capture
  opportunistically if it fires during the batch, but do not chase it. A ~1-2%
  proc behind a Wilson gate at 2/10 attempts is a long way from arming, and
  the gate design is already sound.
- Standing and unaddressed since sessions 40-42: scheduler energy-tracking gap,
  charge-reserve plateau. No dungeon work in three sessions — worth a line in
  the recap acknowledging that's a deliberate choice, not an oversight.

---

## Your task

1. §0 — read the stuck doc state and resolve it via `loot` if an offer is
   pending. One honest attempt. If it doesn't clear, document and move to
   §2/§3/§4 offline, then stop.
2. §1 — run 20 casts today (the full juiced daily cap), the remainder tomorrow.
   Extend the prediction log to carry both predictors and the played card's
   predicted hit probability *before* the first cast, not after.
3. Report against §1's gates: FACT 1 violations (primary), paired log-loss
   difference with a CI, per-class top-1 vs 54.1% / 38.2%, and the calibration
   curve from §1d. Catch rate reported separately from all-time and explicitly
   flagged as underpowered at this n.
4. §2 — retire heuristic (d) and its call sites.
5. §3 — one diagnostic run with per-turn hit rate, then close the deck thread.
6. §4 — SPEC hygiene.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit.

A note on honest expectations: the most likely outcome of this session is
"FACT 1 holds out-of-sample, the paired log-loss advantage transfers, and the
catch rate is still disappointing." That is a **good** session, not a null one
— it would mean the movement model is solved and the binding constraint has
moved somewhere else, and §1d's calibration curve would tell you where. Say so
plainly if that is what happens, rather than reaching for a tuning knob to
make the headline number move.
