# session 46 — 2026-08-19 — Task 11 fishing half — GATE FAIL (live batch not attempted)

Final commit `0dcca9b`. Suite 663/663, `tsc --noEmit` clean, `git diff --check`
clean, all re-run at that commit.

## The headline

**The session-46 brief's §1 gate — a 20-30 cast live batch producing 200-300
scored turns — was unreachable before the session began, and zero casts were
played.** Per CLAUDE.md §6 this was flagged at the top of the session rather
than saved for the recap.

Everything else the brief asked for (§2, §3, §4, and the whole of §1's
instrumentation) was delivered and committed.

## §0 — the blocker, and how the brief got it wrong

The brief's §0 named the completed-but-unresolved doc state (QUESTIONS.md §10)
as the one thing to clear first, and prescribed the `loot` action as the exit.

Read-only check at the top of session (`scripts/checkFishingStuck.ts` plus a
scratch dump of the full doc):

```
docId: 12978003
COMPLETE_CID: true
SUCCESS_CID: false
data.cardChosenId = -1
data.fishPosition = [2,1]
data.nextPosition = null
data.nextMovePath = null
fullDeck length: 11
(no `cardsToAdd` key anywhere in the doc)
```

This is QUESTIONS.md **§15's ESCAPE shape**, n=3 now — not §10's CATCH shape.
`loot` resolves §10, where a real `cardsToAdd` triple sits pending. **There is
nothing to loot on an escape**, so the brief's remedy was inapplicable, not
merely unsuccessful.

Session 44 had already established that a fresh `start_run` succeeds past this
escape shape (twice, live). So the doc state was not expected to block anything
— and it didn't.

## The two real limits

### 1. The server-side daily cap

`npx tsx scripts/liveFishing.ts --casts=2` → HTTP 400 on `start_run`, guard
tripped, 0 energy committed. The error as originally logged said only:

```
"error": "Unexpected response from /fishing/action: HTTP 400"
```

which is ambiguous between a stuck doc, a server cap, and an energy floor.
After fixing the body-swallowing bug below, one further attempt (also 0 energy
committed) returned the actual message:

```
HTTP 400 — {"success":false,
            "message":"Player has reached max runs for fishing",
            "error":"Player has reached max runs for fishing",
            "actionToken":<redacted>}
```

**It is the server-side daily cap.** The bot's own ledger
(`data/guard-budget-fishing.json`) read `{"date":"2026-08-18","energySpent":216,
"runsStarted":18}` — implying 2 casts still available. The server disagreed.

### 2. Energy — the constraint nothing in the codebase models

`GET /offchain/player/energy`:

```json
{ "energyValue": 15, "maxEnergy": 420, "regenPerHour": 18,
  "isPlayerJuiced": true, "secondsSinceLastUpdate": 3207 }
```

A cast costs 12 energy. Twenty casts cost 240. From 15, that is
`(240 − 15) / 18 = 12.5 hours` of regeneration. The 11:00 Pacific cap reset was
~85 minutes away at the time of measurement, by which point the pool would hold
`15 + 18 × 1.42 ≈ 41` energy — **three casts**.

So no ordering of this session's work could have produced the brief's 200-300
scored turns. The user was given the choice (wait ~85 min for 3 casts /
dry-run smoke test only / stop and recap) and chose to stop.

**This is the durable lesson for future briefs**: `config/bot.json`'s budgets
and `guard-budget-fishing.json` are *policy ceilings* layered on top of a real
account energy pool that neither of them reads. Planning N casts without a live
energy read produces unreachable gates.

## The dead classifier — a real bug, found live

`src/api/client.ts` throws `UnexpectedResponseError` for every non-2xx. That
error's `.message` is only ever `"Unexpected response from <path>: HTTP
<status>"`; the server's own text lives **only** in `.body`.

`scripts/liveFishing.ts` was discarding `.body` at all three fishing action
call sites (`start_run`, `play_cards`, `loot`), logging `.message` alone —
contrary to CLAUDE.md §5's "log the full response body to `logs/`".

Two consequences:

1. **`runOneCast`'s server-cap classifier had been dead since session 29
   wrote it.** It tested `/reached max runs/i` against `.message`, a string
   that text can never appear in. It was intended to reclassify a confirmed
   server-cap rejection as a budget trip (marking the mode exhausted for the
   persisted day) rather than propagating a generic anomaly that could take the
   whole orchestrator down over one exhausted mode.
2. Today's HTTP 400 was undiagnosable without it.

Fixed with `serverErrorDetail(e): {message, body}`, used at all three call
sites. **Verified live: the classifier fired correctly for the first time
ever**, reclassifying the rejection as `"session run cap reached"`.

**Note the shape.** This is the *same defect class* as heuristic (d), retired
earlier the same session: **a guard whose condition names a real fact while
reading a field that fact never appears in.** Two instances in one session —
one in strategy code, one in production error handling — and neither was found
by a reviewer applying a rule. Both were found by something else going wrong.
Recorded as a generalized lesson in SPEC-fishing.md §8's closing paragraph.

**Strong inference, flagged as inference:** session 45's cast-3 rejection was
most likely this same server cap. Its batch stood at cast 18-19 of the day
(session 44's 16 plus its own 2), right at the 20-cast juiced cap, and the
message that would have identified it was being discarded by this same bug. It
was recorded instead as "the account is stuck in the completed-but-unresolved
doc state", promoted to the top of `handoff/STATE.md` as the blocker, and from
there became the session-46 brief's §0 — its first instruction.

## §1b/§1d — the instrumentation, landed before any cast

The brief was explicit that this must land *before* the first cast, not after.
It did, and it is the session's main hand-off: **the next session can run the
batch and get the entire §1 readout with no further building.**

`RingPredictionRecord` gains two optional groups (optional so session 45's 20
existing rows still parse — `loadRingPredictions` is a plain `JSON.parse`, and
the report drops them from the paired arm rather than scoring a missing
baseline as a zero):

- **§1b paired baseline** — `baselinePredicted`, `baselinePPredicted`,
  `baselinePActual`, `baselineHit`. The shipped `contextualFallback` predictor
  (the "cell + prev-displacement (shipped backoff)" arm of
  `scripts/fishingRingCV.ts`, offline logLoss 3.536) scored on the SAME turn,
  against the SAME fish, from the SAME history. Comparing a live number against
  an offline *constant* throws away the fact that some fish are simply harder
  than others; pairing removes that variance entirely.
- **§1d calibration** — `playedCardId`, `playedFocus`, `pHitPredicted`
  (`chooseCard`'s own `pHit + pCrit` for the shot it actually played),
  `realizedHit` (read off `fishHp` **decreasing** — a miss pushes `fishHp`
  toward `fishMaxHp`, QUESTIONS.md §15, which is one fewer wire shape to be
  wrong about than parsing the event list).

The baseline is **logged only** and never reaches the policy — asserted by a
test that first proves the two predictors actually disagree on some turn, so
the assertion isn't vacuous.

`scripts/ringPredictionReport.ts` now prints:

- **paired mean ΔLL (ring − baseline) with a 95% CI**, per class and pooled,
  labelled `✓ ring better` / `✗ ring WORSE` / `— inconclusive` by whether the
  interval clears zero;
- per-class top-1 for **both** predictors split by `k`, against 54.1% (k=1) and
  38.2% (k=2) — never the pooled 46.4%, which is exactly what misled session 45
  when its batch happened to draw two `k=2` casts;
- a **Wilson-interval calibration curve**, bucketed predicted P(hit) against
  realized, with the brief's own three-way reading printed beneath it;
- `--since=<iso>` so one batch reports separately from all-time.

4 new tests. Run against the existing 20 rows to confirm they fall out of the
paired arm cleanly.

## §2 — heuristic (d) retired

`pruneReturnToPrevious` removed entirely: the function, its `castSim.ts`
option, its `liveFishing.ts` call site, its 5 unit tests, its ablation arms in
both ablation scripts, and `scripts/auditPruneCounterexample.ts` (an audit of a
function that no longer exists). A tombstone comment sits in `heuristics.ts`.

Why delete rather than keep the no-op: **a dead guard that looks like it
encodes a movement rule is worse than either enforcing the rule or removing
it.** The next reader sees the name, assumes reversal is handled there, and
stops looking for SPEC-fishing.md §9's conditional table — which is where it is
actually handled, correctly, in both directions.

The arc is preserved in SPEC-fishing.md §8: user-proposed → implemented
unverified → measured as a regression against a synthetic fish the game does
not have → corrected to NEUTRAL against the empirical fish → retired as
subsumed by a measured rule.

## §3 — the deck thread, closed with a reason

Session 45 measured shape-matched MID *below* the real deck; an independent
re-run of the same three cards put it ~20pp *above*. Two harnesses cannot both
be describing the same card geometry.

The brief's diagnostic: re-run printing **per-turn hit rate** beside catch
rate. Hit rate is very nearly a pure function of card zones and focus placement
— independent of the HP arithmetic, the mana curve, and the sequential-
`drawHand` confound.

Required adding shot accounting to the sim (`CastResult.hits/shots`,
`CastSummary.hitRate`). Measured, empirical fish + ring model, N=20000 × 2
far-apart seeds, **after (d)'s retirement**:

| deck | catch% | per-turn hit% | mean turns |
|---|---|---|---|
| real `[1,2,3,4,5,6,7,76,77,79]` | 32.5 / 32.3 | **48.8 / 48.7** | 4.6 |
| shape-matched MID `[7,79,76]` | 17.8 / 17.2 | **42.2 / 41.8** | 4.1 |
| shape-matched HIGH `[107,108,25]` | 22.6 / 22.5 | **38.0 / 38.1** | 2.3 |

**MID's per-turn hit rate is genuinely lower** (−6.6pp, consistent across both
seeds). That is the brief's "geometry claim is wrong" branch, not its "harness
bug in the draw path" branch — had this been a draw-path defect, MID's hit rate
would sit at or above the real deck's while only catch rate lagged. **Session
45's refutation stands unqualified.** The ~20pp inversion in the independent
re-run was measuring a different configuration, not exposing a bug in this one.

The HIGH arm validates the instrument: **lowest** hit rate (38.0%) yet a
**higher** catch rate than MID (22.6% vs 17.8%), because it does far more damage
per connect and ends casts in 2.3 turns instead of 4.1. Hit rate and catch rate
are genuinely separable axes, and a deck comparison reporting only the latter
cannot tell coverage apart from damage.

(Figures sit slightly off session 45's — real 32.5 vs 33.2, MID 17.8 vs 15.2 —
because (d) was retired in between, changing the distribution reaching the
policy. The ordering, which is the result, is unchanged.)

**Closed.** The practical reason is independent of the measurement: you gain
one card per catch, so wholesale deck replacement is unreachable at any catch
rate this project can achieve. Only the marginal regime (+1 card, 16
candidates, ~0-3pp, inside noise) is ever available.

## §4 — SPEC hygiene

Two standing conventions written into SPEC-fishing.md §9.

**The log-loss smoothing convention.** The session-45 brief's baseline of 2.070
vs the measured 3.536 reconciles *exactly* as a convention difference, with both
numbers correct under their own rule. This project uses **no smoothing**; a
zero-probability event is charged `-log(1e-9)` ≈ 20.7 nats. The brief used ε=0.02
uniform smoothing, charging ~6.7 nats. With 23 zero-probability events in 211
transitions: `23/211 × (20.7 − 6.7) ≈ 1.5` nats against a measured gap of
**1.47**. Two consequences recorded: the convention only ever moves the
*baseline's* number (the ring model has 0 such events by construction — the ring
floor), so the ring model's advantage is **robust to the choice**; and quoting a
log loss without its convention is quoting half a number.

**The in-sample calibration discount**, as a standing rule. Two independent
in-sample projections have now over-predicted live by ~2.5-3x (SPEC.md §5's
22.4% vs 10.1% live; the session-45 brief's ~+5pp reserve projection vs +1.6pp
measured). The *shape* transfers well — `w=3` landed exactly on the predicted
plateau, the ring model's log loss came in slightly better than projected — the
*magnitudes* do not.

## FACT 1, re-verified

Corpus unchanged (no new casts): **0 off-ring moves in 279 clean transitions,
66/66 casts class-consistent**, `scripts/auditStepClass.ts`. The brief's §1c
primary gate holds on everything currently captured; it simply gained no new
out-of-sample data.

## Surprises worth carrying forward

1. **The loud warning was not the load-bearing one.** `unknownDocKeys` prints
   "the account is likely stuck (QUESTIONS.md §10); start_run below will
   probably reject" on every run that sees a terminal doc. It is right that the
   doc is unusual and wrong about the consequence, and it has now caused two
   consecutive misdiagnoses. Worth rewording — not done this session.
2. **A bug in error *reporting* cost two sessions of correct diagnosis.** The
   information needed was on the wire both times.
3. **`git status` clean can hide work**: the three fixture dirs today's failed
   `start_run` attempts created contain only an empty `raw/` subdirectory, since
   no state was ever written. Git doesn't track empty dirs, so nothing showed.

## Not done

- **The live batch** (§1's actual measurement) — the gate. FAIL.
- **`data.nextMovePath`** (§5) — no casts ran, so no opportunistic capture.
- **Dungeon work** — none, for a **fourth** consecutive session. Deliberate
  (fishing is where the open questions are) but now worth an explicit decision
  rather than continued drift. Scheduler energy-tracking gap and charge-reserve
  plateau (sessions 40-42) remain untouched and unblocked.
- **Whether `scripts/liveRun.ts` has the same swallowed-body bug** — not
  checked, out of this session's fishing scope. Likely worth one grep.
