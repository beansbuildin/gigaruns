# SESSION LOG — session 78 — 2026-08-22 (PT 2026-08-22) — code at commit 77f1ec2

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
  covers `res.text()`, because headers that arrive over a stalled body hang
  just as completely. **11 tests stall a real socket** — a deaf fetch, a polite
  one, a stalled BODY, the mutex releasing so the next request goes out.
- **GET/POST split on what an abort PROVES.** GET: nothing was written →
  retried once (`MAX_GET_TIMEOUT_RETRIES`), bounded. POST: nothing at all →
  `RequestTimeoutError.ambiguousWrite` is true, never replayed, routed into §2.
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
  New `probeDecision(me, foe, run)` in `src/sim/coverage.ts`; every
  `event: "decision"` record carries `evSupported`, `unmodelled`, and
  `unmodelledBySide`, **in the same record as the EV**. Each run ends with an
  `EV support: n/m` line. Demonstrated on the REAL corpus and on `runOnce`.
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
- Carried, untouched: `nextPosition` tripwire has still never met a real miss;
  the oil row of session 72's gate 1 still fails (50.1% sim vs 78.6% live,
  n=14); the shrinkage re-fit is unstable and unadopted; `pConnect` still
  optimistic at +9.38pp and closed BY IRRELEVANCE; old SHAs (pre-session-77)
  are dead outside the tip.

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
- **The wire's rolled-stat pools carry `{current, starting}`, not `current`
  alone** — the client's zod schema rejected a first-draft test fixture that
  omitted `starting`. `starting` stays 0 while `current` is non-zero.
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
- Standing, none re-opened: never report energy as a blocker; `--dry-run`
  before claiming a blocker; do not revert rule 8; redraw CLOSED on price;
  +19.40pp SUSPENDED; do not re-run the oil sweep on the current instrument;
  `boonCapture` OFF; `shrinkageK` inert.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

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


---

# Verbose appendix

## A. The deck sweep's full diagnosis

`npx tsx scripts/deckObjectiveSweep.ts 800` — 23-card real deck read from
`fixtures/fishing-casts/live/cast-2026-08-22-00-56-14/state-000.json`,
80 candidates, matcher blind (`matcherPool: []`, session 14's representative
condition), 800 paired casts per arm.

```
baseline (deck unchanged):  catch 0.0%  hit 41.06%  meanTurns 5.00  meanFinalFishHp 13.22

  rank  card                        appended Δhit   prepended hit%    Δhit   mana
     1  +25 (r4, 1m)                        0.00            60.97   19.91     1
     2  +20 (r3, 1m)                        0.00             47.03    5.97     1
    ...
    78  +108 (r4, 1m)                       0.00            41.25    0.19     1
    79  +110 (r4, 1m)                       0.00            41.25    0.19     1
    80  +17 (r1, 0m)                        0.00            39.56   -1.50     0

  chooseNewCard (damage/mana):  card 110      → ranks 79/80
  composition argmax:           card 25       → 19.72pp ahead
```

The isolating probe that produced the diagnosis, run before the harness was
rewritten around it:

```
baseline           hit 0.4106  turns 5.00  finalHp 13.22
card 17  APPENDED hit 0.4106 finalHp 13.22 | PREPENDED hit 0.3956 finalHp 13.38
card 25  APPENDED hit 0.4106 finalHp 13.22 | PREPENDED hit 0.6097 finalHp  9.94
card 20  APPENDED hit 0.4106 finalHp 13.22 | PREPENDED hit 0.4703 finalHp 10.97
```

Appended arms are identical to FOUR DECIMAL PLACES across every candidate.
That is not a weak effect, it is no effect: the card is never drawn.

Note `catch 0.0%` on every arm as well. That is the blind-matcher condition
session 45 documented (against the empirical fish a blind policy catches
nothing, matching live), which is why `hitRate` — added session 46 explicitly
as "the right instrument for a deck comparison" — is the ranked column.

## B. Why the CI red-suite output change was needed

`assertionCoverage.ts` spawns vitest with `stdio: ["ignore","pipe","pipe"]` and
exits 2 on a red suite without printing what vitest said. With the plain
`npx vitest run` step removed, that would have been CI's only suite run. Planted
a deliberately failing test to verify the fix surfaces the diagnosis:

```
 FAIL  tests/zz-deliberate-red.test.ts > deliberate red > fails on purpose ...
AssertionError: expected 1 to be 2 // Object.is equality
      2| describe("deliberate red", () => {
  ★★★ the suite did not pass. Fix that first — counts from a partial run mean nothing.
```

File name, assertion and source line all present. The planted file was removed.

## C. Action pins (L3), resolved against the GitHub API

```
actions/checkout    v5 → fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09  (= tag v5.1.0)
actions/setup-node  v5 → a0853c24544627f65ddf259abe73b1d18a591444  (= tag v5.0.0)
```

Both are `commit` objects (checked — an annotated-tag SHA would not work as a
`uses:` pin). Latest majors are v7.0.1 / v7.0.0 and were deliberately NOT taken:
session 77 chose v5 and nothing here has tested v7.

## D. Two corrections the code forced on the tests

Recorded because both were the TEST lying, not the code — rule 9 in miniature.

1. **The combat-move fake keyed on a READ COUNT.** `runOnce` reads state several
   times before it ever decides a move (the resume check, then the loop head),
   so `reads <= 1 ? before : after` landed on the wrong question and produced a
   `not_applied` where an `applied` was intended. Re-keyed on whether a POST has
   happened, which is what "the exchange resolved" actually means.
2. **"Never says rejected" was too strong.** The run correctly CONTINUES to a
   second decision after the lost response, then fails honestly when the state
   stops moving. The property is that the first lost response did not end the
   run, and that is what it asserts now.

Also, in `postWithVerifiedRetry`, session 53's own telemetry test caught a real
regression in the refactor: `firstAttemptFailed` is a property of the SEND, not
of the final outcome — an attempt that threw and then reconciled to `applied`
still failed on its first try. Second time that test has earned its place.

## E. The persistent-5xx behaviour change, in full

Before: `client.getDungeonState()`'s `UnexpectedResponseError` propagated out of
`postWithVerifiedRetry`, carrying the READ's body and silently dropping the
POST's — so the operator was told the re-check 5xx'd and never told what the
action itself returned.

After: the transaction's `unknown` outcome, thrown as `GuardTrip` carrying BOTH.
Same halt, same `exit(1)` at `main()`, strictly more information. Pinned by the
rewritten session-28 test, which now asserts the detail carries the POST's
`"server error"` body AND `getDungeonState`'s own
`"repeated 5xx on /game/dungeon/state"` verdict.


## F. CI went RED on the recap commit, and the scanner was right

Run 32591431828 failed at the `Distribution preflight` step:

```
  ★★★ HITS — DO NOT SHARE THIS EXPORT:
      JWT in tests/capture.test.ts
```

The string was `eyJhbGciOiJIUzI1NiJ9.reallylongsecretpayload.signature`, which I
wrote as a synthetic fixture and which matches preflight's pattern
`/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./` exactly.

**The recap's own step-1 grep found this string and I judged it synthetic and
moved on.** That judgement is precisely what a scanner exists to take away from
a human, and a scanner with case-by-case exceptions trains its reader to ignore
it — which `preflight.ts`'s own allowance comment says in as many words.

**No allowance was added.** `SCAN_ALLOW` exists for "the redaction module has to
contain the thing it redacts" (`redact.ts` and its test carry `NOOB_TOKEN_CID`
as a literal). This is not that case: `src/orchestrator/capture.ts` DELEGATES to
the caller's redactor and holds no token literal. The test needed a long
multi-segment secret, not a structurally valid JWT, so it uses
`"HEADER-part.reallylongsecretpayload.SIGNATURE-part"`. The other `eyJ`-prefixed
literal in the file was changed too, so a future tightening of the pattern
cannot turn it into a fresh false hit.

**The process lesson:** `preflight.ts` takes ~90s and is the last check before a
push. It was run only via CI, after the push. It now passes locally:

```
  Tests  1496 passed | 15 skipped (1511)
  author-data tests skipped: 15
  ✓ green in a stranger's tree.
  ▸ secret scan of the exported tree ✓ clean.
  ▸ PREFLIGHT PASSED — the export behaves for a stranger.
```
