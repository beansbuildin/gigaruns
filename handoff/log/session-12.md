# STATE — session 12 — 2026-08-15 — commit 9448d6e

(Full version of `handoff/STATE.md` as of this session, with verbose detail
kept here that STATE.md trims for length.)

## Status
Task 8 "Fishing strategy": **GATE PASS.** See `handoff/STATE.md` for the
summary; this log has the derivations and raw output behind it.

## Session narrative

Per the session-12 brief, this session's spine was Task 8 (fishing
strategy), now fully unblocked by Task 7's gate passing last session. The
brief's own instruction was to measure the convergence question (§2) BEFORE
writing the card chooser, and to check whether the 3×3→4×4 correction made
Task 8's gate unrunnable as written — both done at the top of the session,
per CLAUDE.md §6.

### Before writing any code: replaying the real cast against the spec

Before touching the matcher or EV code, the one real captured cast
(`fixtures/fishing-casts/cast.json`) was decoded turn-by-turn and checked
against every claim `SPEC.md §5` and `SPEC-fishing.md` made about it — per
CLAUDE.md §9, a brief's or a spec's claims about the corpus are hypotheses,
not facts. Two were wrong:

**1. Catch meter direction was backwards.** `SPEC.md §5` said "Hit → catch
meter rises. Miss → catch meter falls. Fill the meter to catch. Run out of
mana, or let the meter hit zero, and the fish escapes." Decoding the real
cast's `fishHp` trajectory (13 → 16 → 19 → 14 → 17 → 20) against each turn's
`FISH_HP_DIFF` event value and hit/miss status:

```
turn 1 (miss, missEffect -3): fishHp 13 -> 16   (13 - (-3) = 16)
turn 2 (miss, missEffect -3): fishHp 16 -> 19   (16 - (-3) = 19)
turn 3 (HIT,  hitEffect  +5): fishHp 19 -> 14   (19 -   5  = 14)
turn 4 (miss, missEffect -3): fishHp 14 -> 17   (14 - (-3) = 17)
turn 5 (miss, missEffect -3): fishHp 17 -> 20   (17 - (-3) = 20)  -> FISH_ESCAPED
```

`newFishHp = oldFishHp - effectValue` in every case — a HIT (positive
value) subtracts, driving the meter DOWN toward 0 (the catch, never
observed in this one-escape corpus); a MISS (negative value) subtracts a
negative, driving it UP toward `fishMaxHp` (the escape). `FISH_ESCAPED`
fires the turn `fishHp` reaches `fishMaxHp` (20/20) — confirmed directly,
with `playerHp` (mana) still at 5/10, not 0. "Let the meter hit zero" was
backwards; zero is the goal.

**2. `CARD_PLAYED`'s `value` field is not a hit/miss flag.**
`SPEC-fishing.md §2` claimed `value: 0 (miss) or 1 (hit)`. The real cast's
`CARD_PLAYED.value` sequence across its 5 turns is `1, 1, 0, 1, 0` — but the
actual hit/miss sequence (from the `HIT` event's presence and
`FISH_HP_DIFF`'s sign) is `miss, miss, HIT, miss, miss` (turn 3 only). The
`value` sequence matches the **hand index played** exactly instead: turn 1
played hand-index 1, turn 2 index 1, turn 3 index 0, turn 4 index 1, turn 5
index 0 — `1,1,0,1,0`, identical. The real hit/miss flag is
`CARD_PLAYED.data.result` (1 on the hit turn, 0 on every miss).

Both corrected in `SPEC.md §5` / `SPEC-fishing.md §2/§4` with the full
derivation cited, not just the corrected claim.

### Hitbox geometry — upgraded to CONFIRMED

`SPEC-fishing.md §4` had flagged the focus-relative 1-9 zone template as
"[VERIFY, but very likely correct]" — never independently re-derived from
the capture. Turn 3 is the cast's one genuine hit: card id 79
(`hitZones: [2,4,6,8]`), submitted `focusPoint [3,3]`. The fish's post-move
cell was `[3,4]`. Zone 8's offset in the confirmed 1-9 row-major template is
`(0,1)`; `[3,3] + (0,1) = [3,4]` — exact match, and no other zone/offset
reading produces it. The fish's PRE-move cell (`previousFishPosition`,
`[4,4]`) is NOT in the translated hit set, confirming the focus scores the
POST-move position — you're betting on where the fish lands, not where it
already is. This is the mechanic SPEC's hypothesis-elimination section had
always assumed; now it's confirmed, not just assumed.

Zone-to-cell mapping used throughout (`src/sim/fishing/geometry.ts`):
```
1=(-1,-1)  2=(0,-1)  3=(1,-1)
4=(-1,0)   5=(0,0)   6=(1,0)
7=(-1,1)   8=(0,1)   9=(1,1)
```
absolute cell = focusPoint + offset, clipped (an off-grid translated zone is
simply unreachable that turn — no clamping).

### Card catalog reality check

`fixtures/fishing-casts/cards.json` (80 real cards) confirmed: every card's
`hitEffects`/`missEffects`/`critEffects` carries exactly ONE flat amount
(never a per-cell table), and miss penalties vary meaningfully by card (-3
to -10). The original SPEC formula's `missPenalty` was a single external
constant — rewritten as `missPenaltyMultiplier` scaling each card's OWN real
`missEffects[0].amount`, so the real per-card risk signal isn't thrown away.
This surfaced as a real bug during implementation (an unused-variable
warning from `tsc` caught it before any test ran) — worth noting because
it's exactly the kind of thing that's easy to miss when translating a spec
formula into code without checking it against the actual data shape.

### (card, focus) EV re-derivation

Full formula, `SPEC.md §5`:
```
hitSet(card, f)  = { f + offset(z) : z in card.hitZones,  f + offset(z) in grid }
critSet(card, f) = { f + offset(z) : z in card.critZones, f + offset(z) in grid }
P_hit(card, f)   = sum P(next=c) for c in hitSet, excluding cells also in critSet
P_crit(card, f)  = sum P(next=c) for c in critSet

EV(card, f) = P_crit * critEffect + P_hit * hitEffect
            - missPenaltyMultiplier * |missEffect| * (1 - P_hit - P_crit)
```
argmax over both `card` and `f`, then `/ manaCost`. Lethal check: every
nonzero-probability outcome must be a hit/crit AND the worst-case effect
amount must finish the fish from the current `fishHp`.

This formula collapses "hedge when |H| is large" and "cash in when |H|==1"
into one expression rather than two branches — summing `P(next=c)` over
every cell a hitbox spans already rewards a focus placement that covers
multiple live hypotheses (hedging), and naturally collapses to "aim exactly
at the one known cell" once only one hypothesis survives. No special-case
branch needed; verified this is genuinely emergent, not asserted, by
`tests/fishing/cardChoice.test.ts`'s crit/hit-precedence and lethal tests.

### Matcher — built and tested against real data

`src/strategy/fishing/matcher.ts` implements SPEC.md §5's hypothesis
elimination exactly: `Candidate = { id, predict(turn): Cell }`,
`observe(state, cell)` narrows by filtering candidates whose `predict(state.turn)`
matches, `predictDistribution` reads off `P(next=c)` as `count/|H|`, and
`emptyFallback` falls back to an empirical distribution over a transition
log (or uniform-over-grid as the last resort when the log itself is empty).

Tested against the REAL cast's decoded position sequence (`[4,2] -> [4,3] ->
[4,4] -> [3,4] -> [3,3] -> [4,3]`, decoded via `SPEC-fishing.md §4`'s
column-major `FISH_MOVED` encoding), with synthetic decoy candidates around
an "oracle" that reproduces the real sequence exactly:
- Narrowing is monotonic (candidate count never grows) — `tests/fishing/matcher.test.ts`.
- With decoys that diverge at turn 1, `|H|` collapses to 1 immediately and
  every subsequent prediction matches the real cast's actual next cell —
  the gate's "predicts correctly once |H| == 1" requirement, satisfied
  against real data.
- With decoys that ALL disagree with the real cast's turn-1 observation,
  `|H|` hits 0 and `predictDistribution` returns an empty map;
  `emptyFallback` was tested both with an empty log (uniform-over-16-cells,
  sums to 1) and a populated one (narrows to exactly what was logged).

### Synthetic pattern library and the convergence measurement (SPEC §2 ask)

`src/sim/fishing/patterns.ts` builds a 23-pattern stand-in pool (8 bounce
directions x 2 step sizes, a centre-mirror, 4 two-cell cycles, CW/CCW
perimeter walks) — explicitly documented throughout as hypothetical, not
the real Dendren library (only one 5-move cast exists; nowhere near enough
to fit a real one). `scripts/fishConvergence.ts` sweeps library sizes
4/8/16/23, 400 trials each:

```
library size 4  (400 trials): converged 338/400 (84.5%) — mean 1.13 turns, never-converged 62/400 (15.5%)
library size 8  (400 trials): converged 282/400 (70.5%) — mean 1.36 turns, never-converged 118/400 (29.5%)
library size 16 (400 trials): converged 212/400 (53.0%) — mean 1.82 turns, never-converged 188/400 (47.0%)
library size 23 (400 trials): converged 169/400 (42.3%) — mean 2.07 turns, never-converged 231/400 (57.8%)
```

Reading: BIMODAL, not "usually a bit slow." When convergence happens it's
fast (median 1-2 turns, well inside a real cast's 5-turn affordance or the
mana-bound ~10-turn ceiling) — but the "never converges at all" share climbs
steeply with library size, because several stand-in patterns are
permanently indistinguishable from each other for some start cells
(symmetric bounce/mirror trajectories that coincide — not a matcher bug, a
real property of a library built from overlapping geometric shapes, and the
real library may share it).

Separately, the real captured cast's own 5-move sequence was replayed
against the full 23-pattern pool:
```
start 4,2 — |H0| = 23
  turn 1: observed 4,3 -> |H| = 3
  turn 2: observed 4,4 -> |H| = 2
  turn 3: observed 3,4 -> |H| = 1
  turn 4: observed 3,3 -> |H| = 0   <- library exhausted, none of the 23 fit
```
Expected — the real pattern almost certainly isn't in this synthetic set —
but a second independent argument for the same conclusion: the policy has
to be sound when identification never completes, not just when it does.

**Verdict, written into `SPEC.md §5`**: hedge-throughout (maximize `P_hit`
over the live spread every turn) is the default policy shape;
identify-then-exploit is a bonus the EV formula exploits opportunistically
when `|H|` does collapse, not an assumption to build around. Confirm against
Task 9's real transition log before trusting the specific percentages.

### Cast simulator and the 500-cast gate

`src/sim/fishing/castSim.ts` mirrors `dungeonSim.ts`'s shape — seeded rng,
pluggable `FishPolicy`, no network. Mechanics are the CONFIRMED real ones
(mana pool, catch-meter direction, hit/crit geometry, hand-refill-on-empty
from the real 80-card Dendren catalog via `src/sim/fishing/deck.ts`); the
fish's true movement is drawn from the same synthetic pool the matcher
searches, for internal consistency (the sim tests the algorithm, not real
Dendren — same scope note as the convergence script).

```
random policy:      500 casts, caught 39  (7.8%),  mean turns 3.432
matcher-EV policy:   500 casts, caught 95 (19.0%),  mean turns 1.312
```
Gate met: `tests/fishing/castSim.test.ts` asserts `matcher.catchRate >
random.catchRate` and `matcher.caught > random.caught * 1.2` (actual ratio
~2.44x). Mean turns being short for both policies is a real consequence of
the numbers, not a bug: `fishMaxHp - startFishHp` is only 7 (20 - 13, from
the real cast's own ratio), and several real cards' miss penalties (-6 to
-10) can cover most or all of that gap in one bad miss — early turns
(before any narrowing) are inherently risky, matching SPEC's own framing.

### Gear sweep (brief §5)

Added an optional `player?: Combatant` override to `SimOptions`/
`simulateRun` (`src/sim/dungeonSim.ts`), documented diagnostic-only exactly
like the existing `offers` override (never for a reported win rate without
labelling it hypothetical). `scripts/gearSweep.ts`, 1000 runs/candidate,
ev-engine policy, real `PLAYER` baseline (hp 34/34, armor 16/16, rock
20/4, paper 6/12, scissor 12/8):

```
baseline mean rooms cleared: 2.103 ± 0.070

rock (Sword) ATK +4          2.408 ± 0.069        +0.305
scissor (Spell) DEF +4       2.339 ± 0.072        +0.236
rock (Sword) DEF +4          2.334 ± 0.070        +0.231
paper (Shield) ATK +4        2.307 ± 0.074        +0.204
max armor +4                 2.269 ± 0.072        +0.166
paper (Shield) DEF +4        2.226 ± 0.071        +0.123
max HP +4                    2.212 ± 0.070        +0.109
scissor (Spell) ATK +4       2.201 ± 0.070        +0.098
```
Sword ATK tops the ranking, consistent with session 11's own live gear
change (16→20) already being the biggest lever found across the project —
a sanity check the sweep passes rather than a new claim. Reported metric
for the user's own progression decisions, not a gate.

### Session 09's 500-clustering check (brief §4 — a log query, not a run)

Session 09's own commits run `2026-08-14T18:12:52-07:00` to
`2026-08-14T19:36:55-07:00` — `2026-08-15T01:12` to `02:36` **UTC**.
Filtering every `logs/run-*.jsonl` line matching `HTTP 500` with reason
`reward selection rejected` / `enemy path selection rejected` to that UTC
window produces exactly 9 reward + 8 path = 17, matching `session-09.md §D`
precisely, across 5 distinct run files matching session 09's 5 completed
runs by `start_run` count:

```
run-2026-08-15-01-16-01: 1 failure
run-2026-08-15-01-42-33: 2 failures
run-2026-08-15-01-53-35: 8 failures
run-2026-08-15-01-58-11: 4 failures
run-2026-08-15-02-03-21: 2 failures
```

Every one of the 5 runs hit at least one failure — spread across the whole
~50-minute session, not clustered into one contiguous window. Per the
brief's own decision framework: SPREAD means request-shaped, keep the
envelope test queued (`QUESTIONS.md §9`) rather than writing it off as
transient, even though session 11's own separate 3-run batch saw zero.

A stray log file, `logs/run-2026-08-15-15-38-07.jsonl` (12 more 500s, 2
seconds before session 11's actual reported-batch file
`fixtures/dungeon-runs/run-2026-08-15-15-38-09`), was found during this
check and initially looked like it might contradict session 11's "0 HTTP
500s" claim. It doesn't — `logs/session11-liverun.log`, the log session 11
actually measured against, has zero `HTTP 500` lines. The stray file is
most likely an earlier discarded/aborted attempt from the same morning.
Noted in `QUESTIONS.md §9` so a future session doesn't re-discover the same
false lead.

### Task 12 restored (brief §3 addendum)

The session-12 brief's addendum carried a direct user confirmation
reversing session 11's downgrade: potions are CLICKED to use during a run,
not pre-committed and left alone. `TASKS.md` Task 5's extension note is
retracted (kept, not deleted, with the retraction stated inline per the
append-only spirit even though TASKS.md itself isn't strictly append-only)
and Task 12 is added as a standalone task with a two-stage gate: Stage A
(confirm `use_item` on a run already lost) blocks Stage B (build the
loadout+timing policy). Not attempted live this session — the two
background dungeon runs both died mid-fight without the loop detecting
"certain death" in advance to attempt the confirmation; needs either
detection code or a supervised session.

### Live dungeon (not this session's focus, ran to use remaining budget)

`npx tsx scripts/liveRun.ts --runs=2`, background:
```
run 1: room 1 (win) -> room 2 (win) -> room 3, died at HP 2/34 vs Enemy Room 65
run 2: room 1 (win) -> room 2 (win) -> room 3 (win) -> room 4, died vs Enemy Room 66
```
0 HTTP 500s, 0 guard trips, exit 0. `data/guard-budget.json`: 137 -> 176
energy spent today, 8 -> 10 runs. Death-room histogram
(`scripts/deathRooms.ts`, 11 confirmed deaths total): room 1 x0, room 2 x3,
room 3 x4, room 4 x4 — was 0/3/3/3 at session 11's n=9. A third independent
confirmation of the even-spread finding; no code changed in response (Task
11 not re-attempted this session, per Open Questions).

### Corpus-total test re-derivation (expected maintenance, not a regression)

The 2 new live runs added real data to the corpus, which shifted several
hardcoded corpus-total assertions — the established project pattern
(sessions 09-11 all hit this) is to re-derive the real numbers from the
grown corpus, not just bump them blindly. Four tests failed after the live
runs and were fixed by computing the actual new values directly:

```
tests/replay.test.ts:    exchanges 264 -> 301, sideUpdates 528 -> 602 (0 clean failures both before and after)
tests/boons.test.ts:     pickups 23 -> 28, UNMODELLED_TYPES +3 (AddBurnMagic, TieVulnerable, VulnerableMastery),
                          Wall-1 room-1 option count 39 -> 45 (no newly-clean types)
tests/dungeonSim.test.ts: battleCoverage.scored 1120 -> 1094, scoredWinRate 0 -> 2/251
                          (boon-offer-table reshuffle at the fixed seed; neither number is itself
                          a strategy claim, both are artifacts of OBSERVED_OFFERS growing)
```
5 new `OBSERVED_OFFERS` entries added to `src/sim/boons.ts`, all
transcribed from the actual fixture state files (`run-2026-08-15-18-10-21`),
none newly clean (2 rolled-stat types, 3 still-unmodelled: WeakeningMastery
already known, AddBurnMagic/TieVulnerable/VulnerableMastery new sightings).

Final: `npx tsc --noEmit` clean, `npx vitest run` 272/272 pass,
`npx tsx scripts/sim.ts 500` exit 0, Task 5's gate still met (intervals
non-overlapping), `deepestScorableRoom` still 4.

## Metrics
(see `handoff/STATE.md` — identical, not duplicated here)

## Open questions for Claude
(see `handoff/STATE.md` — identical, not duplicated here)

## Files changed
See `handoff/STATE.md`'s Files changed section, and the full diff at
`git diff d2d92e5..HEAD --stat`.
