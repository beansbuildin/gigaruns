# Session 44 — 2026-08-18 — commit b75cfb2

Same content as `handoff/STATE.md` at this session's end, plus verbose
detail that didn't fit there.

## §0 — pattern-mining ground truth re-verification

Fresh `npx tsx scripts/mineFishPatterns.ts` against the real
`data/fish-patterns.jsonl` (pre-session: 169 transitions, 50 casts —
matching QUESTIONS.md §14's resolved count):

```
Primitive exact-match test (23 candidates):
  1 cast excluded: 12923189 (duplicate/conflicting turn 0, CODEXREVIEW #5)
  perimeterWalk(cw)   support=4  casts=[12923267,12925773,12942030,12945319]
  perimeterWalk(ccw)  support=3  casts=[12945306,12956727,12957096]
  bounce(0,-1)        support=2
  bounce(1,0)/(1,1)/(2,0)/(-2,0)/(0,2)/(0,-2)   support=1 each
  twoCellCycle(0,-1)  support=1

2 primitives promoted. Sim (N=500): BLIND 7.0% (35/500), MINED 22.4% (112/500).
```

`data/minedFishPatterns.json` on disk matched this exactly (`castCount:
50`) — not stale. Confirmed `scripts/liveFishing.ts`'s `runOneCast` calls
`loadMinedPatterns()` at the default path (grep-verified the call site,
not just the function's existence). SPEC.md §5 and TASKS.md's own Task 11
fishing section both still described the session-15/21 "0 promoted, 1
near-miss" state — corrected in place, not silently.

**Found while building the counterexample-audit script (§3 below)**:
`scripts/mineFishPatterns.ts` was the one script in this project without
an `isMain` guard — importing its exports (as a sibling script naturally
would) triggered a full unconditional `main()` run (real write to
`data/minedFishPatterns.json` + console output) as a side effect. Every
other script with exports (`deathRooms.ts`, `dungeonReport.ts`,
`fishingReport.ts`, `liveRun.ts`, `liveFishing.ts`, `orchestrator.ts`)
already had this guard. Fixed.

## §1 — sim baseline + heuristic ablation infrastructure

Added `heuristicsEnabled: boolean = true` to `cardChoice.ts`'s
`bestFocusForCard`/`chooseCard`/`isPreferred` (gates heuristics a/f, tie-
breaks only, default preserves existing shipped behavior for every
existing caller) and `pruneReturnToPrevious?: boolean` to `castSim.ts`'s
`CastOptions` (opt-in, default omitted/false since the sim never applied
heuristic (d) before this option existed — unlike (a)/(f), which were
already live-default-on in `cardChoice.ts` since session 43).

`scripts/fishingHeuristicAblation.ts` (new) results:

```
1. Baseline (BLIND vs MINED):
   N=500  seed=1      BLIND  7.0% (35/500)   MINED 22.4% (112/500)
   N=3000 seed=1      BLIND  8.4% (251/3000) MINED 23.3% (698/3000)
   N=3000 seed=50000  BLIND  9.2% (277/3000) MINED 24.2% (727/3000)

2. Heuristic ablation (a,d,f) vs MINED library:
   N=2000  seed=1      ALL-ON 21.0% (420/2000)  ALL-OFF 22.8% (455/2000)
   N=2000  seed=50000  ALL-ON 21.6% (431/2000)  ALL-OFF 24.6% (493/2000)
   N=20000 seed=1      ALL-ON 21.9% (4375/20000) ALL-OFF 23.8% (4761/20000)
   N=20000 seed=50000  ALL-ON 22.1% (4424/20000) ALL-OFF 24.2% (4845/20000)

2b. Breakdown (N=20000, isolates a/f from d):
   (a,f) ON, (d) OFF:  23.9% / 24.3%  — matches ALL-OFF almost exactly
   (a,f) OFF, (d) ON:  21.7% / 22.0%  — matches ALL-ON almost exactly
   (a,f) OFF, (d) OFF: 23.8% / 24.2%  — the baseline
```

Conclusion: (a)/(f) genuinely neutral (as designed — provably EV-neutral
tie-breaks). (d) alone drives the entire ~2pp regression.

**Seed gotcha found the hard way**: `simulateCasts(runs, opts, seed)`
draws `seed+i` for `i` in `[0,runs)` internally. Two seed bases close
together (1 and 2) at N=3000 overlap on 2999/3000 draws — the first
version of this script returned byte-identical catch counts for "two
different seeds" before this was caught. Far-apart bases (1, 50000) fixed
it. Not documented anywhere in the codebase before this session; worth
remembering for any future two-seed comparison using `simulateCasts`.

**Mechanism for (d)'s regression**: `patterns.ts`'s `bounceDelta` (a
billiard-style wall reflection, part of the 23-primitive synthetic pool)
literally returns to its predecessor cell on the exact turn it bounces off
a wall — that's the pattern's correct next move, and heuristic (d) zeroes
it out. `scripts/auditPruneCounterexample.ts` (new) walked the real corpus
(67 casts post-session) for a literal instance of this exact failure case:
**0 found**, both before (50 casts) and after (67 casts) this session's
live batch. Sim-domain-only finding per "sim authority earned per domain"
— not acted on, see SPEC-fishing.md §8.

## §2/§3 — live batch: 16 completed casts, 0 caught

Pre-flight: JWT present, `data/guard-budget-fishing.json` showed 0/0 spent
today (untouched), `config/bot.json` dendren 240 energy/20 casts (tier-1,
12 energy each). A `--dry-run` found an ALREADY-ACTIVE cast on the account
— confirmed with the user first (they were mid-manual-play, had just sent
the `use_fishing_item` capture) before taking it over.

Ran `npx tsx scripts/liveFishing.ts --casts=20` in the background,
monitored live. Outcomes, in order: escaped(7t) [resumed pre-existing],
escaped(4t), escaped(10t), escaped(4t), escaped(10t), escaped(2t),
escaped(5t), escaped(7t), escaped(3t), escaped(7t), escaped(4t),
escaped(8t), escaped(3t), escaped(5t), escaped(8t), then user instructed
"stop if you fail the next attempt" and the batch was stopped via
`kill -INT` on the real PID as cast 17 (loop-numbered, 16th new
`start_run`) was 3 turns into play.

Energy: 192/240 spent (16 × 12), `runsStarted: 16` — matches exactly (15
new starts + cast 17's new start = 16; cast 1 was a resume, no new
`start_run`). `handoff/reports/fishing-casts.md` regenerated: 67 casts
total, 7 caught (10.4%, down from 14.0%/50 pre-session).

**The dominant finding — user-diagnosed, then confirmed**: the user
reviewed the interrupted cast's real state directly and reported "7/10
mana left and 0/3 focus... chasing the fish using the focuspoint far too
often." Verified against the session's own log
(`logs/fishing-2026-08-19-00-52-19.jsonl`), per-turn `fishHp`/`focusMeter`
trace for all 16 casts:

```
cast 1:  hp=9,foc=3  hp=6,foc=2  hp=9,foc=2  hp=12,foc=2  hp=15,foc=1
cast 4:  hp=13,foc=3 hp=7,foc=2 hp=4,foc=1 hp=7,foc=1 hp=2,foc=0 hp=5,foc=0
         hp=8,foc=0 hp=11,foc=0 hp=14,foc=0 hp=18,foc=0 hp=13,foc=0
cast 5:  hp=13,foc=3 hp=16,foc=1 hp=13,foc=0 hp=16,foc=0 hp=19,foc=0
         hp=14,foc=0 hp=9,foc=0 hp=12,foc=0 hp=15,foc=0 hp=18,foc=0 hp=13,foc=0
[... all 16 casts show the same shape, full trace in this session's own
tool output, not reproduced in full here]
```

Every cast hits `focusMeter:0` within turns 1-4 (never later) and then
plays every remaining turn — sometimes 7-9 more — from that frozen
position, producing long miss-streaks (fishHp climbing back toward
escape) instead of progress toward a catch. Cast 4 got the fish to HP 2
(one hit from a kill) right as focus ran out, then missed 5 straight and
escaped.

**Confirmed in the sim too**, not a live-only artifact: a direct
instrumentation of `castSim.ts`'s own decision loop (same `chooseCard`/
`bestFocusForCard` code, N=300, mined-seeded matcherPool) found:

```
outcomes: { escaped_meter: 207, escaped_mana: 21, caught: 72 }
focus exhausted (reached 0) in 129/300 casts (43%)
  turn exhausted — mean 1.93, median 2, min 1, max 6
```

So the sim's own 22-24% baseline number ALREADY has this flaw priced in
— it isn't new, it's a standing property of the strategy code that this
session's bad-luck-amplified live run made visible. Root cause:
`bestFocusForCard`/`isPreferred` are purely single-turn-greedy, with the
existing focus-movement tie-break (CODEXIMPROVE #2, session 31) only
conserving budget on an EXACT EV tie — never when there's any positive
edge to moving, which is nearly always true early in a cast.

**User asked directly** (0/16, "exceptionally embarrassing... a
regression") how to close the session: document-only vs. design-and-
validate-a-fix-now. Chose document-only. Proposed fix (NOT implemented):
a focus-reserve continuation term in `bestFocusForCard`'s scoring, same
shape as the dungeon side's `chargeReserveWeight` (session 34) — sim-
ablate at real N (per that precedent's own N=20000-60000 discipline)
before any live wiring.

**SIGINT gap found while stopping the batch**: `kill -INT` on the real
node PID fell through to Node's default immediate-termination instead of
the documented graceful "stop before next card" behavior —
`scripts/liveFishing.ts`'s `main()` never calls
`installProcessSigintHandler`/`createShutdownSignal` (grepped, confirmed
absent; `scripts/orchestrator.ts` has it, `scripts/liveRun.ts` also
lacks it). Confirmed harmless this specific time via a follow-up
`--dry-run` read: the account sat at exactly the pre-kill turn (3), no
orphaned or double-counted energy/guard state. Not fixed this session
(out of scope — found while diagnosing the focus issue, not what was
being worked on).

`tests/sim/fishingCorpus.test.ts`'s corpus-total assertions updated per
this project's own "expected to fail after every capture" convention: 67
casts / 335 response docs / 263 play turns / 7 caught / 59 escaped / 1
incomplete. New legitimate exception documented for the "every cast has a
start_run" test: docId `12975152` (the resumed pre-existing cast) has none
in our own corpus, since we never sent it — not a bug in the loader.

## §4 — `use_fishing_item` confirmed, wired live

User sent a live DevTools capture mid-session (unprompted — this closed
QUESTIONS.md §16, which the brief had asked the user to try to get):

```
{"action":"use_fishing_item","actionToken":"1787094007859","data":{"cards":[],"nodeId":"","focusPoint":[],"itemId":821,"slotIndex":0,"tierId":0}}
```

Item 821 resolved against `fixtures/fishing-casts/item-metadata-sample.json`:
"Lil Mana Oil", `FishingRestoreMana +1` (note: user called it "lil mana
potion," wire name is "Oil" — same naming-mismatch pattern already seen
with "Mid Relaxing Oil"/session 43). Same 6-field envelope as every other
confirmed fishing action. `src/api/fishing.ts`'s `FishingActionSchema`
gains `"use_fishing_item"`. `scripts/liveFishing.ts`'s `runOneCast` now
reads the account's Mid Relaxing Oil (937) balance once per cast via `GET
/items/balances` and fires `use_fishing_item` when
`shouldConsiderRelaxingOil` says so — `slotIndex:0` is confirmed only for
item 821, so it's a stated hypothesis for item 937 specifically, fails
closed (caught, logged, not retried this cast, no `GuardTrip`) on
rejection since this is an optional rescue action. Never actually fired
live this session (the account never held any Mid Relaxing Oil, so the
balance read always returned 0 and the gate never opened) — wiring
verified by code review + the new `buildFishingEnvelope` test, not by a
live fire.

## Verification

632/632 tests passing (629 baseline this session + 3 new: `chooseCard`
heuristicsEnabled toggle ×2, `buildFishingEnvelope` use_fishing_item
shape ×1 — the fishingCorpus.test.ts count-updates aren't new tests, same
2 tests with updated expected numbers). `npx tsc --noEmit` clean.
`git diff --check` clean. All checked at this session's actual final
commit (b75cfb2), not a mid-session snapshot.

Commits this session: `5f89f95` (§4, use_fishing_item), `1e8645a` (§0-§1,
pattern-mining reverification + ablation infra), `b75cfb2` (§2-§3, live
batch + focus-budget finding).
