# STATE — session 78 — 2026-08-22 (PT 2026-08-22) — code at commit 77f1ec2

## Status
**GATE 1 PASS. GATE 2 PASS. GATE 3 PASS.** Suite **1511/1511** (was 1443),
89 files, `tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage`
**0 vacuous**, `preflight.ts` PASSED, **CI green on a real run**.

- **Offline session, by USER DIRECTIVE.** Asked at 11:00 PT with both ledgers
  freshly rolled (12 run-units, 20 casts), the user chose no live play.
  **0 runs, 0 casts, 0 energy.** `doctor.ts` at 10:49 PT read 12/12 and 20/20
  spent from the previous day, rollover 0.2h out.
- The session's work is the triage of `CODEXAUG22REVIEW.md` (Codex, read-only,
  at the pre-session tip). Ten findings; eight acted on, one declined by the
  user, one recorded as blocked.
- **Ship-nothing posture still HOLDS.** No live policy changed.

## What works
- **§1 GATE 1 — `raw()` carries a 10s deadline and the bot cannot hang.**
  `fetch()` had NO `signal`, inside the client's ONE mutex, so a stalled socket
  stopped the bot permanently with no guard able to fire. Two mechanisms,
  deliberately both: `AbortController` (tears the socket down) and
  `Promise.race` (bounds `raw()`'s return even if fetch ignores the signal —
  the guarantee must be a property of `client.ts`, not of undici). The race
  covers `res.text()` too. **11 tests stall a real socket**, including one
  asserting the mutex releases so the next request still goes out.
- **GET/POST split on what an abort PROVES.** GET: nothing was written →
  retried once, bounded. POST: nothing at all → `ambiguousWrite`, never
  replayed, routed into §2.
- **§2 GATE 2 — one transaction protocol, `src/api/actionTransaction.ts`.**
  `runActionTransaction` returns `applied` / `not_applied` / `unknown`. Two
  design points are load-bearing: `didApply` and `provesNotApplied` are
  SEPARATE predicates (not one and its negation), and `commitSpend` runs
  **exactly once** on applied, response or not.
- **Routed, in ledger-consequence order:** dungeon `start_run`, fishing
  `start_run`, `postWithVerifiedRetry` (reward + path), dungeon combat moves.
  Session 09's locate-by-identity rule survives — `locate` is called once PER
  ATTEMPT against freshly-fetched state, and the transaction now hands that
  state back (`after`) so the retry path does not spend a second request.
- **§3 GATE 3 — every live decision logs whether its own EV is supported.**
  New `probeDecision` in `src/sim/coverage.ts`; every `event: "decision"`
  record carries `evSupported` / `unmodelled` / `unmodelledBySide`, **in the
  same record as the EV**, and each run ends with an `EV support: n/m` line.
  (617 of 622 non-Safe paths carry rolled stats, so a high figure is EXPECTED.)
  Demonstrated on the REAL corpus and on `runOnce`.
- **§5** L1 (CI ran the suite THREE times, now once + preflight's), L2
  (`engines` → `^20.19.0 || >=22.12.0`), L3 (Actions pinned to SHAs), L4
  (`src/orchestrator/capture.ts` — one `FixtureWriter`/`RunLog`).
- **§4** `scripts/deckObjectiveSweep.ts` runs and returns a diagnosed null
  (below). **§6** M4's comment written, no code; `DEFAULT_POTION_THRESHOLD`
  untouched.

## What's broken
- **M3 (the fishing deck objective) is BLOCKED, and the block was found by
  building it.** All 80 appended candidates measured **byte-identical to the
  baseline** (hit 41.06%, meanFinalFishHp 13.22); the same cards **prepended**
  moved hit rate by up to **+19.91pp** (card 25 → 60.97%). `drawHand` is
  sequential from index 0 and a cast lasts ~5 turns, so on the real 23-card
  deck only the first ~8 cards are ever seen — **an appended card is
  unreachable by construction.** See TASKS.md CAPTURE-3.
- **`chooseNewCard`'s pick ranks 79/80** by prepended hit rate, 19.72pp behind
  the composition argmax. **DOUBLY suspended** — a `castSim` result
  (OIL-POLICY §0a) measured in the prepended arm, which is not what a loot pick
  does. Not a reason to change `chooseNewCard`.
- **Fishing's IN-CAST writes are NOT routed** through the transaction:
  `play_cards`, loot, oil, redraw. They move no daily ledger and
  `resolvePendingCardOffer` recovers the one stranding state. Same shape as
  combat moves; the obvious next increment, and deliberately not claimed.
- **H2's model is NOT built and must not be** — §3 makes the gap visible, it
  does not close it. Proc rates for evasion/block/lck/tenacity/intuition do not
  exist. TASKS.md CAPTURE-1.
- Carried, untouched: `nextPosition` tripwire never met a real miss; session
  72's oil gate row still fails (50.1% sim vs 78.6% live, n=14); shrinkage
  re-fit unstable/unadopted; `pConnect` +9.38pp optimistic, closed BY
  IRRELEVANCE; pre-session-77 SHAs dead outside the tip.

## Corrections to SPEC.md
- **None to SPEC.md this session** — no live response was read.
- **`use_fishing_item` does NOT advance the fish and does NOT cost mana** —
  **USER ANSWER**, not a measurement. Closes `OIL-POLICY.md` §1's two
  load-bearing questions, open since session 73 and deferred by four briefs. It
  confirms the sim's `costsTurn=false` arm is the real mechanic; the
  `costsTurn=true` arm was never modelling anything that exists (which is why
  its numbers were incoherent — an added cost that *improved* catch 74%→93%).
  No capture exists; rule 1 still says a live response wins if one disagrees.
  **Does NOT authorize live oil use** — `policyApproved` still ships FALSE.
- **The brief's "nothing is lost" by dropping CI's plain vitest step was wrong
  on a detail.** True of the pass/fail SIGNAL, false of the diagnostics:
  `assertionCoverage.ts` piped vitest's output and never printed it. Fixed
  there, verified with a planted failing test.
- **M3's advice to cache "by normalized deck composition" is WRONG for this
  simulator.** `[...deck, id]` and `[id, ...deck]` are the same multiset and
  measurably different decks. A normalized cache would have hidden the finding.
- **Rolled-stat pools carry `{current, starting}`, not `current` alone** — the
  client's zod schema rejected a first-draft fixture omitting `starting`, which
  stays 0 while `current` is non-zero.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Amending rule 7's 429 backoff — DECLINED BY THE USER**, after the futility
  argument was put in full (a POST retried after 5/10/20/40/80s carries a token
  stale by construction, so the retry can only be rejected, while holding the
  only mutex). Declined because **this repo has never recorded a single 429**
  (session 75: zero across 216 actions). Do not re-raise without an observed one.
- **Shuffling the deck in `castSim` to unblock M3.** Not done: the ranking
  would become an artifact of an invented draw model and would look exactly as
  authoritative as a real one. Pinned by tests so it cannot be done quietly.
- **Building H2's proc-branch model.** Not stubbed, not defaulted, not flagged.
- **Writing M4's three lines** (`observe` + `turn++` on redraw). They ARE the
  decision the code's own comment says is not the flipper's to make.
- Standing, none re-opened: energy is never a blocker; `--dry-run` before
  claiming one; do not revert rule 8; redraw CLOSED on price; +19.40pp
  SUSPENDED; no oil sweep on the current instrument; `boonCapture` OFF.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.
- **Pushing before running `preflight.ts` — CI went RED on this session's own
  recap commit** (run 32591431828). A synthetic
  `eyJhbGci...` test string in `tests/capture.test.ts` matched preflight's JWT
  pattern; my own step-1 grep saw it and judged it synthetic, which is exactly
  the judgement a scanner exists to remove from a human. **The scanner was right
  and no allowance was added** — its narrow allowance is for "the redaction
  module must contain what it redacts", and `capture.ts` DELEGATES redaction and
  holds no token literal, so the test simply uses a long non-JWT-shaped secret
  instead. `preflight.ts` is ~90s and is the last check before a push, not an
  optional one.

## Metrics
- **Live: 0 dungeon runs, 0 fishing casts, 0 energy.** User directive.
- Suite **1443 → 1511** (+68), 87 → 89 files. `assertionCoverage` **0 vacuous**.
- Hardcoded-path ratchet **25**, unchanged — it caught the new sweep script at
  26 and the script was converted to the profile seam rather than the number
  raised.
- Deck sweep, 800 paired casts/arm, 81 arms, 161 distinct compositions:
  baseline hit **41.06%**, all 80 appended arms identical to 4 d.p.;
  prepended spread **39.56% → 60.97%**.
- CI: **3 full suite runs → 2** (~65s saved), one of which tests a different
  tree on purpose.

## Open questions for Claude
1. **Fishing's in-cast writes are the last unrouted class.** `play_cards`,
   loot, oil, redraw. No daily ledger moves, so the value is the same as combat
   moves: a transient error mid-cast currently ends the cast even when the
   action landed. Worth one pass, or is the ledger argument the only one that
   justified §2 at all?
2. **CAPTURE-3 is answerable by ordinary fishing casts and would unblock M3.**
   A `fullDeck` read either side of a loot pick, plus enough consecutive casts
   on one deck to see whether hands repeat in deck order. No probe, no new
   endpoint. **12 run-units and 20 casts available.**
3. **§3 now records which mechanics co-occur in live decisions.** That makes
   CAPTURE-1's ordering measurable rather than guessed — but only from a run
   that actually happens. Is one juiced run worth spending to seed it?
4. **The oil question is answered but the oil POLICY is not approved.**
   `dendren.oils.policyApproved` ships FALSE and the timing policy is a
   separate approval from the budget. Is that the next thing to put to the user?
5. Carried: per-test assertion counts are recorded — is a low-assertion review
   worth one pass? Separate the crit source with one-lure-only casts? What
   re-derives +19.40pp (still SUSPENDED, do not quote)?

## Files changed
```
 6 commits (0f5d61a, a12e6b3, e248303, 774ab76, 38fe18e, 4e20e91).
 23 files, +3059 -235.

  NEW  src/api/actionTransaction.ts       189  GATE 2 — the protocol
  NEW  src/orchestrator/capture.ts        138  L4 — one FixtureWriter/RunLog
  NEW  scripts/deckObjectiveSweep.ts      339  §4 — the diagnosed null
  NEW  tests/api/actionTransaction.test.ts 287
  NEW  tests/capture.test.ts              189
       scripts/liveRun.ts                +451  start_run, reward/path, combat
       scripts/liveFishing.ts            +200  fishing start_run, M4 comment
       src/api/client.ts                 +119  GATE 1 — the deadline
       tests/liveRun.test.ts             +355
       TASKS.md                           +94  CAPTURE-1/2/3
       .github/workflows/ci.yml           +44  L1, L3
       src/sim/coverage.ts                +49  GATE 3 — probeDecision
```
