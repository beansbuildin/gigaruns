# STATE — session 46 — 2026-08-19 — commit 0dcca9b

## Status
Task 11 (fishing half), session-46 brief §1: **GATE FAIL — not attempted, and
unreachable before the session began.** The brief's whole point was a 20-30
cast live batch (200-300 scored turns). **Zero casts were played.** §2, §3, §4
all delivered in full offline; §1's *instrumentation* landed complete and
tested, but the batch itself could not run.

Next per TASKS.md: the same live batch, once energy allows. **Read
`GET /offchain/player/energy` FIRST and compute the affordable cast count from
it.** Do not infer the budget from `data/guard-budget-fishing.json` — that is
this bot's own policy ledger and knows nothing about either the real energy
pool or the server's own daily counter.

Overall: the movement model is unchanged and still unconfirmed live. What this
session actually produced is a corrected diagnosis of *why* live fishing keeps
stalling, plus the instrumentation to make the next batch decisive.

## Why the gate was unreachable
Two hard limits, **neither** of them the completed-but-unresolved doc state
that STATE.md (session 45) and the session-46 brief §0 both named as the top
blocker:

1. **Server-side daily cap already reached.** `start_run` → HTTP 400,
   `{"success":false,"message":"Player has reached max runs for fishing"}`.
   Resets 11:00 Pacific.
2. **Energy: 15-16 of 420, regen 18/hour.** Twenty casts cost 240 energy —
   **12.5 hours of regen**. Even past the 11:00 reset the account would hold
   ~41 energy = 3 casts. No ordering of this session's work reaches 20.

Flagged at the top of the session per CLAUDE.md §6, not saved for the recap.
User was asked and chose to stop rather than wait ~85 minutes for 3 casts.

## What works
- **Paired-predictor + calibration logging** (`scripts/liveFishing.ts`,
  `RingPredictionRecord`) — every row now also carries the shipped
  `contextualFallback` baseline scored on the SAME turn against the SAME fish
  (`baselinePredicted/PPredicted/PActual/Hit`), plus the played shot's own
  `pHitPredicted` and `realizedHit`. Verified by 4 new tests incl. both
  directions of `realizedHit` and an assertion that the baseline never reaches
  the policy. **Landed before any cast, as the brief required.**
- **`scripts/ringPredictionReport.ts`** — paired mean ΔLL (ring − baseline)
  with a 95% CI, per-class top-1 for both predictors split by `k`, a
  Wilson-interval calibration curve, and `--since=<iso>` to report one batch
  separately from all-time. Run against the existing 20 rows; they correctly
  fall out of the paired arm rather than scoring as zeros.
- **`serverErrorDetail()`** — the server's own message now reaches `logs/` and
  the guard trip. Verified live: it captured the cap message and the previously
  dead server-cap classifier fired correctly for the first time.
- **Per-turn hit-rate accounting in the sim** (`CastResult.hits/shots`,
  `CastSummary.hitRate`) — the §3 diagnostic instrument.
- **FACT 1 re-verified**, corpus unchanged: **0/279 off-ring, 66/66 casts
  class-consistent** (`scripts/auditStepClass.ts`).
- Suite **663/663**, `tsc --noEmit` clean, `git diff --check` clean, all re-run
  at the final commit `0dcca9b`.

## What's broken
- **The ring model's live transfer is STILL unconfirmed.** Unchanged from
  session 45: n=18 scored turns, both casts `k=2`, top-1 27.8% vs the
  class-matched offline 38.2%, CI ≈ [12%, 51%]. No new live data this session.
- **Energy is the real binding constraint on all live fishing work**, and no
  part of the codebase models it. `config/bot.json`'s budgets and
  `guard-budget-fishing.json` are policy ceilings layered on a real account
  pool they never read. A brief that plans N casts without checking the pool
  will keep producing unreachable gates.
- **`unknownDocKeys`' stuck-doc warning is loud and NOT load-bearing.** It
  prints "the account is likely stuck (QUESTIONS.md §10); start_run below will
  probably reject" on every run that sees a terminal doc. It has now caused
  two consecutive misdiagnoses. Worth rewording, not done this session.
- `data.nextMovePath` — unmodelled, unchanged. QUESTIONS.md §17.

## Corrections to SPEC.md
- **QUESTIONS.md §15 corrected**: the `start_run` HTTP 400 is the **server-side
  daily cap**, captured verbatim — not the escape-shaped stuck doc. The doc
  shape was present (n=3 now: `COMPLETE_CID: true`, `SUCCESS_CID: false`,
  `cardChosenId: -1`, no `cardsToAdd`) and is a red herring.
- **The brief's §0 remedy does not apply.** It prescribed resolving the state
  with the `loot` action; `loot` resolves §10's CATCH shape, where a real
  `cardsToAdd` triple is pending. There is nothing to loot on an escape.
- **A dead guard, live**: `client.ts` throws `UnexpectedResponseError` for every
  non-2xx and its `.message` is only `"Unexpected response from <path>: HTTP
  <status>"` — the server's text lives ONLY in `.body`. `runOneCast`'s
  server-cap classifier tested `/reached max runs/i` against `.message`, so it
  had been **dead since session 29**. Fixed; fired correctly on first capture.
- **SPEC-fishing.md §8**: heuristic (d) marked RETIRED with its full arc, plus
  the generalized lesson — *a guard's condition can name a real fact while
  reading a field that fact never appears in* — with the server-cap classifier
  as the second worked instance in the same session.
- **New SPEC-fishing.md §9 subsections**: the log-loss smoothing convention,
  and the in-sample calibration discount as a standing rule.
- **The deck thread is CLOSED** in SPEC-fishing.md §9, with a reason.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT (unchanged — no dungeon work, fourth session running).

## Dead ends
- **Do not diagnose a fishing `start_run` HTTP 400 from the doc state.** Read
  the body — it is logged now. Two sessions in a row attributed a server-cap
  rejection to the stuck doc, and the second one propagated into a brief as
  its first instruction.
- **Do not plan a live fishing batch from `guard-budget-fishing.json`.** It
  said 216/18 of 240/20 — implying 2 casts available. The real answers were
  "server says zero" and "16 energy". Both live reads, both cheap.
- **The deck thread — closed, do not reopen without a new premise.** The
  §3 diagnostic settled the session-45-vs-independent-rerun inversion in favour
  of session 45: shape-matched MID's per-turn hit rate is *genuinely lower*
  (42.2%/41.8% vs the real deck's 48.8%/48.7%, N=20000 × 2 seeds), which is the
  "geometry claim is wrong" branch, not the "harness bug" branch. Independent
  practical reason: you gain one card per catch, so only the marginal regime
  (+1 card, 16 candidates, ~0-3pp) is ever reachable.
- **Heuristic (d) is retired — do not re-add without a corpus measurement.**

## Metrics
- **Sim, deck arms** (empirical fish + ring model, N=20000 × 2 far-apart seeds,
  after (d)'s retirement) — catch% / per-turn hit% / mean turns:
  real deck `[1,2,3,4,5,6,7,76,77,79]` **32.5/32.3 · 48.8/48.7 · 4.6** ·
  MID `[7,79,76]` 17.8/17.2 · **42.2/41.8** · 4.1 ·
  HIGH `[107,108,25]` 22.6/22.5 · **38.0/38.1** · 2.3.
  (HIGH validates the instrument: lowest hit rate, higher catch rate than MID —
  more damage per connect, casts end in 2.3 turns. The two axes are separable.)
- **Sim, predictors** (same setup): blind 0.0% · mined only 5.3% · live config
  26.3/26.0% · ring 32.5/32.3% · ring + mined intersected 37.6/37.3%. All
  in-sample — apply the §9 calibration discount.
- **FACT 1**: 0 off-ring in 279 clean transitions, 66/66 casts class-consistent.
- **Live: 0 casts played.** All-time unchanged at **7/69 = 10.1%**. Live
  prediction log unchanged at 20 rows / 2 casts.
- Suite 663 (664 − 5 retired (d) tests + 4 new paired/calibration tests).

## Open questions for Claude
1. **The live batch is still the only open question the corpus can't answer,
   and it needs energy, not effort.** Budget the brief against a real reading:
   240 energy = 20 casts; the pool regenerates 18/hour to a 420 cap. An
   overnight gap covers it from empty. Ask for the batch only if the session
   starts after the 11:00 Pacific reset with the pool already high — otherwise
   ask for N casts where N is read live, and gate on scored TURNS.
   `scripts/ringPredictionReport.ts` prints the entire §1 readout with no
   further building: paired ΔLL with CI, per-class top-1 vs 54.1% (k=1) /
   38.2% (k=2), and the calibration curve.
2. Should the `unknownDocKeys` stuck-doc warning be reworded or removed? It has
   now caused two consecutive misdiagnoses and the condition it fires on is not
   the condition that rejects `start_run`.
3. Does the same swallowed-error-body bug exist on the **dungeon** side
   (`scripts/liveRun.ts`)? Not checked — out of this session's fishing scope.
4. `data.nextMovePath` (QUESTIONS.md §17) — unchanged, one non-null observation.
5. Standing and unaddressed for a **fourth** consecutive session: scheduler
   energy-tracking gap, charge-reserve plateau (sessions 40-42). Deliberate —
   fishing is where the open questions are — but worth a decision rather than
   continued drift.

## Files changed
```
 14 files changed, 815 insertions(+), 262 deletions(-)

     scripts/liveFishing.ts              | 144  (paired+calibration logging, serverErrorDetail)
     scripts/ringPredictionReport.ts     | 145  (paired ΔLL + CI, calibration curve, --since)
     tests/liveFishing.test.ts           | 173  (4 new tests)
     SPEC-fishing.md                     | 123  (§8 retirement, §9 conventions, deck closure)
     TASKS.md                            |  74  (session outcome)
     src/sim/fishing/castSim.ts          |  71  (hits/shots/hitRate; (d) removed)
     scripts/fishingEmpiricalAblation.ts |  87  (§3 diagnostic; (d) arms dropped)
     src/strategy/fishing/heuristics.ts  |  62  ((d) removed, tombstone left)
     QUESTIONS.md                        |  50  (§15 corrected)
     tests/fishing/heuristics.test.ts    |  53  (5 (d) tests removed)
     scripts/fishingHeuristicAblation.ts |  20
 del scripts/auditPruneCounterexample.ts |  71
```
