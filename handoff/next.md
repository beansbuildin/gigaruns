# BRIEF — session 53 (two juiced runs, and §21 is already solved)

Session 52 delivered the two things it existed to prove. The ROM-claim path ran
live four times with **measured drift 0** on both runs, and tier enumeration
discharged eight sessions of drift with 13/13 rooms through `pickLowestTier()`
— including **4 rooms that offered no Safe tier at all**, where the STRICT
`pickSafeTier()` would have halted a 60-energy entry for zero loot benefit.
That is CLAUDE.md §8's generalized rule earning its keep, live, for the first
time. Room 8 at 6864 is the deepest and highest-scoring run in the corpus.

It also did the thing this project is actually built on: it found §21 by
reading a JSONL log by hand, when nothing in the summary reported it.

**§21 is solved, and it costs no energy and no DevTools capture.** It is not
what session 52 concluded it was. §0 is that finding, because it changes what
this session does before it starts a run.

---

## 0. §21 — the server did not change. The behaviour was always there; session 51 made it visible.

I mined all seven dungeon run logs — the four from 2026-08-18 and the three
from 2026-08-20 — for every action POST, the gap between it and the preceding
response, the token it carried, and whether the next event was
`post_attempt_failed`. Pooled:

| POST class | n | first-attempt failures | gap band |
|---|---|---|---|
| empty token (`reward_*`, `path_*`), **failed** | 66 | 66 | **0.90 – 1.54 s**, median 1.29 |
| empty token, **succeeded** | 66 | 0 | **3.40 – 4.92 s**, median 4.07 |
| numeric token (`rock`/`paper`/`scissor`/`use_item`) | 224 | **0** | 0.90 – 1.79 s, median 1.36 |

**Zero overlap between the two empty-token bands.** Every failure is under
1.55s; every success is over 3.40s. This is not an envelope problem. It is a
timing threshold, and it sits somewhere in (1.54, 3.40).

### 0a. The 2026-08-18 runs had 40 rejections, not zero

Session 52's central claim — "the four 2026-08-18 run logs have 40
path-selection decisions and **zero** rejections … so the server changed" — is
refuted by those same logs. Per-file `post_attempt_failed` counts with
`reason: "reward selection rejected"`:

```
run-2026-08-18-19-50-13   12      run-2026-08-20-00-30-48   14
run-2026-08-18-21-15-24   10      run-2026-08-20-00-45-19    2
run-2026-08-18-22-00-26   10      run-2026-08-20-00-46-46   10
run-2026-08-18-22-07-12    8
                        ----                              ----
                          40                                26
```

40 decisions, 40 rejections. **100%, exactly as on 08-20.** The rate did not
change.

**Why session 52 saw zero, and this is the part worth keeping.** The 08-18
`post_attempt_failed` rows have an **empty `body` field**. The error text only
started being captured when session 47/51's `serverErrorDetail` fix landed —
the fix whose own stated finding was "every failure logged this repo's own
summary and nothing the server said." Session 52 searched the old logs for
`"Invalid action token"`, found nothing, and read *newly visible* as *new*.

That is a genuinely hard trap and I want it named rather than scored: **a
logging fix creates a false discontinuity in your own history.** Every
before/after comparison that straddles 2026-08-19 is comparing "what happened"
against "what was recorded," and the recording changed. The same question asked
of `reason` — which was populated on both sides — answers correctly in one
grep. Worth a line in CLAUDE.md: when a log field's first appearance coincides
with the effect you are dating, date the effect on a field that predates the fix.

### 0b. The mechanism

The action token is a millisecond epoch timestamp (`1787185878470` =
2026-08-20 00:31:18.470 UTC). The server holds exactly one outstanding token
and rejects any POST whose token does not equal it — hence the doubled space in
`Invalid action token  != N`, which is `""` interpolated into
`Invalid action token {sent} != {outstanding}`. The outstanding token clears
after roughly 1.5–3.4 seconds. So:

- **Combat moves send the matching numeric token** → equality passes
  immediately → 224/224 succeed at ~1.36s.
- **Path selections send `""`** (the DevTools-confirmed session-08 shape) →
  equality fails while a token is still outstanding → rejected at ~1.29s, and
  accepted once it has cleared at ~4.07s.
- **`start_run` also sends `""` and always succeeds** — there is no outstanding
  token at that moment. This is the control case, and it fits.

`RateLimiter` in `src/api/client.ts:73-82` spaces every request by
`MIN_GAP_MS` 1200 + up to 400ms jitter → **1.2–1.6s**, which lands the first
path-selection attempt squarely inside the reject window, every time.

**The retry is not what fixes it — the delay is.** On failure,
`postWithVerifiedRetry` calls `client.getDungeonState()` before looping
(`liveRun.ts:566`), and that extra round trip plus its own rate-limit gap adds
~2.7s. The retry succeeds because it happens 4 seconds later, not because
anything about it differs; session 52 correctly observed it was byte-identical
and drew the wrong conclusion from it.

This also explains session 08's founding incident — `reward_one` returning HTTP
500 on a byte-identical request, once having applied server-side anyway
(`liveRun.ts:508-512`). Same phenomenon, 2026-08-14. **`postWithVerifiedRetry`
was built to paper over this bug and has been doing so successfully for
thirty-nine sessions.** Do not remove it: the double-apply hazard it guards is
real and independent of this.

### 0c. The fix, and why it needs no envelope change

Give path-selection POSTs a longer minimum gap. Add a per-request override to
the client — `postDungeonAction(body, { minGapMs })` — and have `liveRun.ts`
pass **3600ms** for `reward_*`/`path_*`. Keep the decision in `liveRun.ts`, not
in `RateLimiter`: which actions carry an empty token is game knowledge, and
`src/api/` stays free of it (CLAUDE.md working style).

CLAUDE.md §2 is not in play. Nothing about the envelope changes; the confirmed
shape is sent exactly as captured, just later.

It is also **strictly dominant**, which is the part to check before building it:

| | requests | wall clock | charged to `maxConsecutiveActionFailures` |
|---|---|---|---|
| today | 2 POST + 1 GET | ~4.0 s | 1 per decision, 2 at a reward→path boundary |
| with the fix | 1 POST | ~3.6 s | 0 |

Fewer requests, slightly faster, and it retires the standing risk session 52
flagged: the failure budget is 3, a reward→path boundary already burns 2, and
one unrelated hiccup mid-run halts a 60-energy entry.

**Gate:** across both runs, **zero path-selection first-attempt rejections** in
~26 decisions. The current rate is 100%, so this is a clean before/after with no
statistics required. If a first attempt at ≥3.6s is rejected, the timing model
is wrong — stop and report rather than raising the number until it passes.

Do **not** run the numeric-token experiment §21 proposed. It would change a
confirmed envelope to fix a problem that is not in the envelope, and it costs a
60-energy entry to observe something the logs already answered for free. If you
want it settled anyway, the DevTools capture is still the cheap route and it is
a user action — but it is no longer needed for anything.

### 0d. Make it re-runnable

Commit `scripts/rejectionAudit.ts` — point it at any run log, get the per-class
first-attempt failure counts and the gap bands. Same discipline as session 51's
`reversalDispersion.ts`: the analysis that found this should not have to be
re-derived by hand next time. Run it over all seven historical logs and pin the
66/66/224 split in a test so a regression in pacing shows up as a test failure,
not as a log someone happens to read.

---

## 1. The rejection-rate blind spot (your open question 2) — yes, and it is the actual lesson

A decision class failing 100% of the time on first attempt was invisible in two
runs that reported success. Build it, and note what makes it useful:

- Count **first-attempt failures even when the retry succeeds.** That is the
  entire blind spot. A per-class success rate that scores the retry as a
  success reports 100% and hides this exact bug.
- Report it in the **run summary**, not only the JSONL. It was in the JSONL all
  along, in seven runs, across nine sessions.
- WARN when any class exceeds ~20% first-attempt failure, with the class name
  and the count.

This generalises past §21: any retry loop that succeeds is a place where a
persistent server-side disagreement can hide indefinitely.

---

## 2. The two runs

**Budget, and verify it rather than trusting me.** The guard day is keyed to
11am Pacific (session 29). Session 52's runs landed 2026-08-19 ~17:30 PT, so
the ledger at **120/240 energy and 6/12 run-units** stands until **11:00 PT on
2026-08-20** — exactly the two juiced runs the user reports. Read
`guardPersistence` and confirm before starting; if the day has rolled, the
ledger resets to 0/240 and the constraint becomes the pool, not the cap.

**Invocation, one run at a time:**

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 --claim-order=ascending > logs/run-53-1.log 2>&1
```

- **Redirect to a file and `tail` it.** Session 52's `head -30` SIGPIPE'd run 2
  mid-battle in room 2 with 60 energy already committed. It recovered with
  `--resume-existing --potions=3 --potions-used=0` and nothing was lost, but do
  not re-run that experiment.
- **`config/bot.json` needs `potions` re-added** — `{"allowedItemId": 131,
  "maxPerRun": 3}` — and removed again after. Session 52 did exactly this and
  removed it on the way out (`config/bot.json | 2`), so it is absent again now.
  Zero heal juice loads silently without it (`liveRun.ts:1370-1379`).
- Entry tier 3; **`pickLowestTier()` governs in-run**, 13/13 last session and it
  should stay 13/13. Never allocate skill points. **Pause and hand back after
  each completed run.**

Expect the pool to need a claim: ~12–18 energy against 120 required, roughly
2380 left in the bank.

**Report per run** as before, plus the §0c gate (path-selection first-attempt
rejections — target 0) and the §3 claim numbers below.

**On run 1 vs run 2 scoring:** run 1 reached room 8 for 6864, run 2 reached
room 7 for 4896 after the user's manual level-up. That is n=1 against n=1 on a
stochastic dungeon and says nothing about the level-up. Do not report it as
though it might.

---

## 3. Claim order (your open question 5) — one more session of ascending, then switch

My session-52 rationale for ascending was explicitly time-limited: "these
reasons stop applying once the path is proven, so do not make ascending the
default." The path is proven — 4 claims, drift 0. By that rule the answer is
switch to descending, and the steady-state rationale you kept is the better one.

One thing blocks it, and it is the thing §1b of the last brief flagged: **the
"overflow past 420 is non-wasting" comment has still never been tested.** Both
claims last session ran into a nearly empty pool (8→77, 22→72) and never came
near the cap. Descending with a ~100 deficit will reach for the bank's largest
ROMs, and if one exceeds the headroom it tests that comment by accident — the
exact thing not to do.

Resolve it for free instead. The bank is already read at preflight; log two
more numbers in `claim_audit`:

- **`maxSnapshot`** — the largest single `energyCollectable` in the bank.
- **`headroom`** — 420 − `poolBefore`.

If `maxSnapshot < headroom`, no single claim can hit the cap and the question
is closed by construction for this code path. If it is larger, you now know the
overflow test is reachable and it can be run deliberately, once, with the
numbers recorded — still ask first.

So: **`--claim-order=ascending` for these two runs**, ship the two audit fields,
and switch the default to descending in session 54 with the overflow question
either closed or scheduled. Costs nothing and stops the two open questions from
colliding.

---

## 4. §22 — fix the aliasing upstream, before any fishing batch

Your read is right and the reason is that §19 depends on it. `bounce(2,0)` and
`bounce(-2,0)` are the same map on a 4-wide grid, so the oscillation hypothesis
holds **2/4** of the matcher's initial candidate mass instead of 1/3. §19's
whole decision rule is "does π climb past 0.5 on any cast" — and π is computed
from that mass. Measuring the matcher's posterior against a prior you know is
double-counted answers a question nobody asked.

Fix it where it cannot recur: `buildPatternPool()` should not offer two
primitives that are provably the same map at the grid sizes this game uses, or
`promotePatterns` should collapse primitives whose trajectories agree on every
supporting cast. Prefer the former — it is a property of the primitive set, not
of one corpus.

Gate it on the replay as its own change. Note what the gate can and cannot show:
all three libraries were indistinguishable last session (ΔlogLoss −0.0041 and
−0.0056, both CIs spanning zero, catches wandering 24–27), so **expect this to
be inert on the replay too, and ship it anyway** — it is a correctness fix to
the prior, not a prediction improvement, and it should be argued that way in the
recap. Session 51's per-class shrinkage was the same shape: behaviourally inert,
correct, shipped.

---

## 5. §19 — the fishing batch cannot happen this session, and that is a scheduling fact

Fishing was 20/20 for the 2026-08-19 cap day, which also runs to **11:00 PT on
2026-08-20**. There are no casts available until then. Session 53 is therefore
the two dungeon runs plus the offline work; the §19 batch is session 54, after
the reset, against the de-aliased library from §4.

Session 51's decision rule stands unchanged and should not be renegotiated now
that it is nearly measurable: if π never exceeds 0.5 on any cast in the batch,
drop the tier; if π exceeds 0.5 on at least one cast and that cast's turns hit
above the batch's own base rate, it keeps its 0.030 nats. Record the library's
support counts at batch time (currently 11 distinct casts of 89, prior 0.133;
§4 will not change the count, only the candidate mass).

---

## 6. Smaller things

- **`AddMaxHealth` was the fifth wall-1 hole** — in `BOON_MODELS` since session
  23, never offered in room 1 until run 1. That is the same retroactive shape as
  session 11's AddMaxArmor and 43's UpgradePaper, three times now. Worth ten
  minutes: enumerate which `BOON_MODELS` entries have **still** never appeared
  in a room-1 offer, and list them in the recap. A known list of untested boons
  is worth more than discovering the sixth one by accident.
- **Energy accounting drifted 1** on run 1 (`observedDelta` 59 vs
  `committedDelta` 60, `drifted: true`). Almost certainly regen landing inside
  the measurement window. Not worth chasing, worth watching: if it drifts the
  same direction on both runs this session, it is systematic and gets its own
  question.
- The brief's file name last session was wrong — it is
  `data/minedFishPatterns.json`, and `patternMining.ts:158`'s comment has the
  wrong name too. Fix the comment while you are in there.
- STATE.md's session-52 header says 2026-08-19; the runs and commit are
  2026-08-20 UTC. Cosmetic, but the log filenames are the timestamps people
  will search on.

---

## Your task (session 53)

1. **§0c** — `minGapMs` override on the client request path; `liveRun.ts` passes
   3600ms for `reward_*`/`path_*`. Tests for the override; `postWithVerifiedRetry`
   untouched.
2. **§0d** — `scripts/rejectionAudit.ts`, run over all seven historical logs,
   with the 66/66/224 split pinned in a test.
3. **§1** — first-attempt failure counting per decision class, in the run
   summary, WARN above ~20%.
4. **§3** — `maxSnapshot` and `headroom` in `claim_audit`.
5. **§2** — re-add the potions block, then **two juiced Tier-3 runs, one at a
   time, pausing between**. Gate: zero path-selection first-attempt rejections.
   Remove the potions block afterward.
6. **§4** — de-alias the pattern pool upstream, gated on the replay, shipped
   even if inert.
7. **§6** — the never-offered `BOON_MODELS` list.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes to a real data path.

**Honest expectation.** §0 is the session's result and it is already in hand —
what remains is implementing a delay and proving it with a number that is
currently 100% and should be 0%. The runs are worth having for the corpus and
for a second look at rooms 7–8, but two juiced runs will not settle any strategy
question and should not be written up as though they might. If the pacing fix
lands, the rejections go to zero, and both runs die in room 6, this session
succeeded — it will have retired a bug that has been silently burning a request
per decision since 2026-08-14 and sitting one hiccup away from halting a
60-energy entry.

One thing to carry forward past this session: the reason §21 looked like a
server change is that a logging fix landed between the two datasets being
compared. That is going to happen again — this repo improves its instrumentation
constantly — and the defence is cheap. Date an effect on a field that predates
the instrumentation change, or say plainly that you cannot.
