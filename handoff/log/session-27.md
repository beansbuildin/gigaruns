# Session 27 — 2026-08-17/18

Same content as STATE.md at commit time, plus full derivations and raw
numbers behind each finding.

## Brief

Session 26's `nextPosition`/`nextMovePath` investigation found the field in
8/225 turns (3.56%) and called it too rare to be a standing mechanic. The
session-27 brief arrived with new user context — a Fintuition skill
(level 2, stated 3% per-turn reveal chance) and a Dual Yield skill (level 2,
stated 4% double-catch chance) — and reasoned 3.56% observed vs 3% expected
was "a match, not noise," asking to re-open the investigation. It also
carried a direct user report that catch rate "feels very low," asking for
a foundational check of the focus-point mechanic before chasing either
skill, plus a request to fold the user's own manual-play heuristic (most
grid coverage, not raw hit-power) into Task 13's scoring design as a real
first candidate, and to audit for any silent Dual Yield firing.

## 1. Focus-point repositioning — CONFIRMED working, not a no-op

Read `scripts/liveFishing.ts` end to end. The `play_cards` envelope (line
~541-544) sends `focusPoint: [best.focus.x, best.focus.y]` where `best`
comes from `chooseCard(hand, mana, dist, gridSize, 1, fishHp,
focusBudget(doc))`. Read `src/strategy/fishing/cardChoice.ts`'s
`bestFocusForCard`: it iterates `reachableCells(gridSize, focusBudget.current,
focusBudget.remaining)` — every cell affordable under the live
`focusMeter` budget — and argmaxes raw `EV(card, focus)` against the
predicted fish distribution. This is real search, not a stub or a
hardcoded center.

Cross-checked against data: wrote a one-off script (not committed) reading
`data.focusPoint`/`data.focusMeter` off every turn of every committed live
fixture. Result: **29 of 30 casts show `focusPoint` actually changing value
within the cast**, with `focusMeter` decrementing in lockstep — e.g.
`cast-2026-08-15-20-32-43`: `([2,2],3) → ([2,2],3) → ([1,2],2) → ([1,1],1)`.
The one cast that never varied is short enough (few turns) that it may
simply never have needed a move; not separately investigated further, low
value given the other 29 already answer the question.

**Conclusion**: the mechanic is exercised correctly. This is NOT the source
of the low catch rate.

## 2. Why catch rate is actually low — the sim baseline mismatch

Given #1 rules out a broken focus mechanic, checked what the sim itself
predicts for the REAL live regime, rather than assuming the ~70% figure
DECISIONS.md 2026-08-17 (session 21) restates is the right comparison.

Read `src/sim/fishing/castSim.ts`: `matcherPool` (what the matcher searches
when identifying the fish) defaults to `opts.candidatePool ?? truePool` —
i.e. by default the matcher can ALWAYS identify the true pattern. The
~70% figure (69.9-71.6%, DECISIONS 2026-08-15 session 14; 70.7% ± 2.0%,
DECISIONS 2026-08-17 session 21) is measured under this default — the
matcher-omniscient ceiling.

Real live play does NOT operate under this condition:
`scripts/liveFishing.ts`'s own header states "the matcher's candidate pool
starts EMPTY every cast, deliberately" and is only ever seeded from
`mineFishPatterns.ts`-promoted patterns. This is exactly the
`matcherPool: []` (forced-blind) condition `castSim.ts` also supports, and
DECISIONS.md 2026-08-15 (session 14) already measured it once: ~7-10%,
"consistent with live 0/6" at the time.

Re-ran this session (`npx tsx scripts/mineFishPatterns.ts`) against the
current, larger real transition log:

```
169 transitions across 50 casts

Primitive exact-match test (23 candidates):
  perimeterWalk(cw)   support=4  casts=[12923267,12925773,12942030,12945319]
  perimeterWalk(ccw)  support=3  casts=[12945306,12956727,12957096]
  (8 more primitives, support 1-2 each, below the promotion threshold)

Promotion threshold: 3 independent exact-matching casts.
  2 primitive(s) promoted: perimeterWalk(cw), perimeterWalk(ccw)

Sim catch rate (500 synthetic casts, focusMeter modelled):
  matcher BLIND (matcherPool: []):        33/500 = 6.6%
  matcher with MINED library (2 patterns): 104/500 = 20.8%
```

(Up from 1 pattern / 16.2% mined-library rate at session 18 — support grew
1→2 promoted patterns purely from ordinary play between sessions, no code
change.) This regenerated `data/minedFishPatterns.json` — gitignored,
regenerable, not a tracked change.

Real observed catch rate, computed directly from the 30 committed live
fixture directories (`doc.COMPLETE_CID && doc.SUCCESS_CID` on each cast's
terminal state): **4 caught / 30 = 13.3%**. This sits between the blind
(6.6%) and mined-library (20.8%) sim figures — exactly the shape you'd
expect from a matcher that's blind on casts whose pattern isn't one of the
2 promoted ones, and informed on the ones that are. Not anomalous.

**Conclusion, stated plainly per the brief's own instruction**: the low
catch rate is real, but it's not a bug — it's the expected consequence of
the matcher starting blind every cast, a known and already-measured
regime. The lever that actually moves this number is more mined-pattern
coverage (Task 11, `mineFishPatterns.ts` — already working, growing
naturally) and/or Task 13's deck-composition scoring — not the focus-point
mechanic, which the brief was right to worry about but which turned out
fine.

## 3. Fintuition/`nextPosition` — re-checked, hypothesis REJECTED

Went to the raw fixture JSON directly rather than trusting session 26's
summary phrasing or the brief's own arithmetic (CLAUDE.md §9).

**Problem 1 — wrong denominator in the brief's own claim.** Wrote a
one-off Python check over all 225 turns: the `nextPosition` KEY is present
on 8 turns, but only **2 of those 8 have a non-null value** — the other 6
are the key persisting as `null` for the rest of a cast after one real
firing (this exact behavior is already described in session 26's own
QUESTIONS.md prose, just not carried through into the brief's percentage).
Real firing rate: 2/225 = **0.89%**, not 3.56%. This undershoots the
stated 3% Fintuition rate; it does not match it.

**Problem 2 — the one candidate trigger field is constant across the
WHOLE corpus, not just at the two sightings.** Checked
`activeFintuitionTurns` and `fintuitionOilBoostPercent` on every one of
225 turns (not just the 8 session 26 checked): both are `0` or `null`
EVERYWHERE, no exceptions, at the 2 real firings AND at every other turn.
A constant field carries zero discriminating information — session 26's
"ruled out as the gate" phrasing implied a real test was run and failed;
actually there was never any variation to test against. This doesn't
prove Fintuition ISN'T the cause (the field might just not track what I'm
assuming, or might track an oil-boosted variant that's never been used
given `fintuitionOilBoostPercent` is also always 0) — it proves this
project currently has no way to check either way.

Full raw values pulled directly from `fixtures/fishing-casts/live/
cast-2026-08-17-20-40-57/state-001.json` and `cast-2026-08-17-21-10-15/
state-008.json` (the two real firings):

```
state-001: fishPosition=[3,3] previousFishPosition=[2,4]
           nextPosition=[2,4] nextMovePath=[7,8]
           activeFintuitionTurns=0 activeCritBoostTurns=0
           fintuitionOilBoostPercent=0 dualYieldOilBoostPercent=0
           jebaitorTriggered=false

state-008: fishPosition=[2,3] previousFishPosition=[3,3]
           nextPosition=[1,3] nextMovePath=[3]
           activeFintuitionTurns=0 activeCritBoostTurns=0
           fintuitionOilBoostPercent=0 dualYieldOilBoostPercent=0
           jebaitorTriggered=false
```

**Conclusion**: did not implement any Fintuition-reactive strategy code —
the brief's claim doesn't survive the check, per CLAUDE.md §9. Status is
unchanged from session 26 in substance (real, rare, cause unknown), now
more precisely quantified (~0.9%, not ~3.6%). Written up in full in
QUESTIONS.md §12 (updated in place, session 26's original text preserved
above the correction) and DECISIONS.md 2026-08-17.

## 4. Dual Yield — checked, never observed, consistent with low exposure

Searched every fixture for evidence of a double-catch: `caughtFish` shape,
`cardsToAdd` count, `gameItemBalanceChanges` array length.

- `caughtFish` is always a single object across every real catch observed
  (15 catch-turn observations — some catches appear on 2 consecutive
  states as the terminal doc persists into the `loot`-resolution
  response), never an array or multiple entries.
- `cardsToAdd` is always exactly 3 offers on every catch — no variation
  tied to a possible double-catch.
- The single largest `gameItemBalanceChanges` array in the whole corpus
  (`cast-2026-08-17-00-03-25/state-023.json`) has exactly 2 entries: one
  fish item (id 517 "Ollie", amount 1) and one currency/orb credit (id 845,
  amount 160 — matches the `gigusOrbItemId` pattern from DECISIONS.md
  2026-08-14 session 08). Never two distinct fish entries.
- `dualYieldOilBoostPercent` is constant `0` throughout (no oil ever
  equipped, consistent with `fintuitionOilBoostPercent`'s same reading).

At a stated 4% per catch and roughly 8-10 real catches on record, expected
fires ≈ 0.3-0.4 — not seeing it is consistent with insufficient exposure,
not with a broken or absent mechanic. No code change. The existing
`unknownDocKeys` detector (session 26's widening) would already catch a
genuinely new response shape live, so no additional visibility work
needed here either.

## 5. Task 13 — user's grid-coverage heuristic documented as first candidate

Added to `TASKS.md` Task 13 (not code): the user's own manual-play
heuristic — pick the offered card with the most hit/catch spots (grid
coverage), not raw hit-power/mana — is now the task's designated FIRST
real candidate to test against the deck-aware `simulateCast` infrastructure
(session 26), once the task unparks. Sketched the shape it would take
(`zonesToCells` over hitZones ∪ critZones, sized against the grid) without
writing the real implementation — that's for when the task actually
unparks, not now. Does not change the gate or either unparking condition.

## 6. Real daily-cap reset boundary is NOT UTC midnight

Given fresh local guard budget (session 25/26 had exhausted both caps;
zero live calls happened since), checked whether today's UTC rollover
meant fresh real budget too, since CLAUDE.md pre-authorizes autonomous
fishing/dungeon play within budget and more live casts would directly help
Task 13's data floor and pattern-mining support.

`npx tsx scripts/liveFishing.ts --status` confirmed the LOCAL guard had
rolled to 0/20 for the new UTC date (2026-08-18). Attempted a 10-cast batch
(`npx tsx scripts/liveFishing.ts --casts=10`); the very first `start_run`
was rejected HTTP 400. Wrote a one-off diagnostic script (not committed) to
capture the raw response body, since the normal error path loses it
(`GuardTrip` only carries the message, not `UnexpectedResponseError`'s
`.body`):

```
status: 400
body: {"success":false,"message":"Player has reached max runs for fishing",
       "error":"Player has reached max runs for fishing",
       "actionToken":1787024069626}
```

The real server considers today's fishing allowance still exhausted, at
03:33 UTC on what the local UTC-keyed guard already considers a new day.
Fail-closed worked exactly as designed — the guard tripped on the very
first attempt, energy accounting showed 228→228 (0 spent), no batch
proceeded past attempt 1.

Corroborated read-only on the dungeon side (no write attempted): a second
one-off script called `GET /game/dungeon/today` directly — real
`dayProgressEntities` for dungeon 5 still reads **12** (session 25's
exhausted value), `updatedAt: 2026-08-17T21:17:26.409Z`, i.e. still capped
6+ hours past UTC midnight. Same mismatch, same direction, both modes —
this looks like a real, general "the account's day boundary is not UTC
midnight" fact, not a fishing-specific quirk. Both diagnostic scripts and
the two empty fixture directories the failed attempt created were deleted
before commit — no lasting code change, this was pure discovery.

Logged as QUESTIONS.md §13 (new) — needs the user to say what the real
boundary is (a specific timezone's midnight? a rolling 24h window from
last cast/run?) so a future session doesn't need to burn a wasted
`start_run`/`start_run`-equivalent just to find out the cap hasn't lifted.

## Verification

`npx tsc --noEmit`: clean. `npx vitest run`: 408/408 (unchanged — no `src/`
or `scripts/` files changed this session; two throwaway diagnostic scripts
were written, run, and deleted, never committed).

## Files changed

```
QUESTIONS.md          | 93 +++++++++++++++++++++++++++++++++++++++++++++++-
TASKS.md              | 16 ++++++++
handoff/DECISIONS.md  |  5 +++
3 files changed, 113 insertions(+), 1 deletion(-)
```

No fixture or `src`/`scripts` changes. `data/minedFishPatterns.json`
regenerated locally (gitignored, not a tracked diff) reflecting the newer
2-pattern promotion.
