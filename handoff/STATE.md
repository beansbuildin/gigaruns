# STATE — session 13 — 2026-08-15 — commit 63ae54d

## Status
Task 9 "Live fishing, supervised": **GATE MET.** §1's mana-divisor bug in
`chooseCard` (Task 8's own strategy code) is fixed, and fixing it uncovered a
second, dependent bug in `shouldRedraw` — together they move the 500-cast
sim's catch rate from 19.0% to 92.4%. Five live Dendren casts ran end to
end, transitions logged to `data/fish-patterns.jsonl` (25 real transitions
now on disk, up from 0). A genuine undocumented mechanic (`focusMeter`'s
spend rule) was discovered live mid-session, root-caused from a guard trip,
fixed, and re-verified across the remaining four casts with zero further
incidents. Task 12 Stage A (`use_item` confirmation) landed as a zero-cost
side effect of an ordinary live dungeon run: CONFIRMED via a clean HTTP 400.
Task 11's dungeon-tuning half is now PARKED with stated revival conditions.
Next per TASKS.md: Task 12 Stage B (potion loadout + timing policy, needs a
real potion in `consumables` first) or more live fishing casts to grow
`data/fish-patterns.jsonl` toward Task 11's fishing-side pattern mining.

Overall: fishing went from "built but never run" to "run, and meaningfully
better than the number that gated it in" in one session — the corpus-vs-spec
discipline (CLAUDE.md §9) caught a real, load-bearing bug in the strategy
code itself, not just in SPEC prose, before it ever touched live play.

## What works
- **Task 8's mana-divisor bug: FIXED.** `src/strategy/fishing/cardChoice.ts`'s
  `chooseCard` picked `argmax EV/manaCost`; SPEC.md §5 said the same thing,
  and both were wrong — the one real cast escaped with 5/10 mana unspent
  because the MISS counter capped it, not mana. Fixed to `argmax P_hit`
  (mana as an affordability filter only, `argmax EV/mana` kept solely as a
  late-cast correction via `isManaConstrained`). Fixing it exposed a SECOND
  bug: `shouldRedraw` compared `best.evPerMana` against its threshold when
  SPEC always said raw `ev` — harmless while `chooseCard`'s own objective
  was also EV/mana, but once it wasn't, redraw fired almost every turn.
  Fixed (`best.ev`), `REDRAW_THRESHOLD` re-tuned 3→0 in
  `src/sim/fishing/castSim.ts` (a 500-cast sweep across {-∞,0,1,2,3,5,8}
  found catch rate falls monotonically as the threshold rises). **Net: the
  500-synthetic-cast catch rate moved from 19.0% (95/500) to 92.4%
  (462/500)**, unchanged 7.8% (39/500) random baseline. Verified by:
  `npx vitest run tests/fishing` (24/24 pass, up from 18), a standalone
  re-run of `simulateCasts`.
- **Task 9 (live fishing): GATE MET.** `scripts/liveFishing.ts` (new, staged
  like `scripts/liveRun.ts`: `--dry-run`, `--casts=N`), `GigaverseClient`
  gained `getFishingState`/`postFishingAction` with their OWN action-token
  sequence (`src/api/client.ts`), `config/bot.json`/`config.ts` gained a
  `dendren` budget block. Five live casts completed (1 resumed after a
  mid-session fix + 4 fresh), all ended `escaped` (0 catches — consistent
  with the one prior human capture also escaping; catch response shape
  stays `[VERIFY]`), 25 real transitions appended to
  `data/fish-patterns.jsonl`. Verified by: live run output, fixture writes
  under `fixtures/fishing-casts/live/cast-*/`, `data/fish-patterns.jsonl`
  line count.
- **`focusMeter`'s spend rule: CONFIRMED live**, resolving a `[VERIFY]` the
  one prior capture left open (it never moved the meter off 3/3). Moving the
  focus costs its Manhattan distance from the CURRENT focus, out of a
  3-point per-cast budget that does NOT regenerate — 4 clean data points,
  the 4th a real HTTP 400 rejection (not a display-only cap). Fixed live,
  mid-session: `bestFocusForCard`/`chooseCard` gained an optional
  `FocusBudget` param (`src/sim/fishing/geometry.ts`'s new `reachableCells`);
  the live loop always supplies one. The sim does NOT model this yet, so its
  92.4% catch-rate figure assumes free focus movement and is an optimistic
  ceiling, not a live prediction. Verified by: 4 more live casts with zero
  further focus-related rejections, `tests/fishing/geometry.test.ts` (+4
  tests), `tests/fishing/cardChoice.test.ts` (+2 tests).
- **Task 12 Stage A: `use_item` CONFIRMED.** `POST /game/dungeon/action`
  `{action:"use_item", dungeonId:5, actionToken:<real>, data:{consumables:[],
  isJuiced:false, index:0, itemId:0}}` (combat-style envelope) returned
  **HTTP 400 `{"success":false,"message":"Item not found in index"}`** — a
  clean, meaningful rejection (not 404/405 wrong-endpoint, not a crash),
  confirming the action name, the envelope, and that `itemId` addresses the
  item. Zero exposure: `consumables` is always sent empty, so there was
  never a real item to lose. `scripts/liveRun.ts` gained a `--probe-use-item`
  flag (fires once, own HP ≤34%, never touches the 3-strikes guard). Fixture:
  `fixtures/dungeon-runs/run-2026-08-15-20-44-28/state-039.json`.
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **292 tests, 20 files, all pass** (272 → 292; 18 new
  fishing/live tests, 8 corpus-total assertions re-derived — not just
  bumped — after this session's 2 new live captures, per the established
  "expected to fail after every capture" convention, DECISIONS 2026-08-15).
- `npx tsx scripts/sim.ts` — Task 5's gate report still passes (room-1
  battle win rate always-Sword 85.6% vs ev-engine 92.9%, non-overlapping),
  re-measured against the grown corpus and the new PLAYER baseline
  (hpMax 34→36 this session).

## What's broken
- **Zero catches across all 5 live casts.** Not a strategy failure so much
  as small-sample variance against an unknown pattern set — the matcher ran
  on `emptyFallback` (uniform, then thinly empirical) the whole session
  since the real pattern library is still unknown. Catch response shape
  (rarity, reward fields — TASKS.md Task 9's "fish logged with rarity")
  remains `[VERIFY]`, now across 6 total real casts (1 prior + 5 this
  session), all escapes.
- **One dungeon run left stuck mid-combat, not resolved this session.**
  `run-2026-08-15-20-44-28`, room 3, own HP 4/36 vs Enemy Room 65 (full
  38/38) — the `use_item` probe's own run hit an HTTP 500 on the following
  combat move; a live re-check confirmed the move did NOT apply (run still
  active, HP unchanged), so this is a genuinely resumable, not-yet-lost run,
  left alone deliberately (session's daily energy/run budget was nearly
  exhausted: 229/240 energy, 11/12 runs). Resume with `npx tsx
  scripts/liveRun.ts --runs=1` next session before starting anything new.
- **Task 12 Stage B is still fully unbuilt.** Stage A landing cleanly does
  NOT mean the timing/loadout policy exists — turn-cost, multi-use, and
  consumed-on-loss are all still open, and none of them are answerable
  without a REAL potion in `consumables` at `start_run` (still untested
  whether that field takes item IDs, slot indices, or objects). Per the
  session-13 brief's own instruction, this was deliberately NOT started
  this session so Stage B gets a clean one.
- **`data/fish-patterns.jsonl`'s `turn` field resets to 0 on a resumed
  cast** (turn-in-invocation, not turn-in-cast) — cosmetic, since pattern
  mining keys on `(fromCell, toCell)` pairs not turn index, but worth fixing
  before Task 11's `mineFishPatterns.ts` is built if turn position ever
  matters to that algorithm.

## Corrections to SPEC.md
- §5: "pick `argmax EV(card, f) / card.manaCost` — mana is the real budget"
  was WRONG, not just superseded — the one real cast's own trajectory
  (escaped with mana 5/10 unspent) already refuted it before this session,
  but nobody had checked `cardChoice.ts` against that fact until now.
  Corrected to `argmax P_hit(card, f)`, EV/mana demoted to a late-cast-only
  correction. Full derivation in SPEC.md §5.
- §5: added `focusMeter`'s CONFIRMED spend rule (Manhattan distance from
  current focus, 3-point non-regenerating per-cast budget) — previously
  `[VERIFY]`, the one prior capture never moved it off 3/3.
- SPEC-fishing.md §4: `focusMeter`/`focusMeterMax` row updated with the
  same confirmation and the four supporting data points.
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren nodeId="5" /
  pondId=2**.
- Move charges: unchanged, PRESENT, hard-pruned.

## Dead ends
- None new. No hypothesis was tried and abandoned this session — both
  discoveries (mana-divisor, focusMeter) were confirmed-and-fixed, not
  disproven.

## Metrics
- Fishing sim (500 synthetic casts, matcher-EV policy): catch rate 92.4%
  (462/500) vs random 7.8% (39/500) — up from 19.0% (95/500) before this
  session's fix. `meanTurns` moved 2.80 (matcher) vs 3.43 (random) —
  matcher now resolves faster AND catches far more often.
- Live fishing: 5 casts, 0 catches, 0 guard trips in the final 4 (1 guard
  trip in the first, root-caused to `focusMeter` and fixed live — see "What's
  broken" and DECISIONS.md). 25 real transitions logged. Energy: 59/100
  fishing budget spent (5/5 session cap reached).
- Live dungeon: 1 run this session (carrying the `use_item` probe), halted
  mid-combat by an HTTP 500 that a re-check showed did not apply — not a
  new confirmed death. Death-room histogram UNCHANGED at 11 confirmed
  deaths (room 1 ×0, room 2 ×3, room 3 ×4, room 4 ×4). Energy: 229/240
  spent, 11/12 runs.
- Gear sweep, RE-MEASURED this session under the new PLAYER baseline
  (hpMax 34→36; armor and all move ATK/DEF unchanged) — full ranked table,
  1000 runs/candidate, ev-engine policy:
  ```
  upgrade                      mean rooms cleared        delta vs baseline
  rock (Sword) ATK +4          2.429 ± 0.070        +0.249
  rock (Sword) DEF +4          2.427 ± 0.073        +0.247   (ties ATK — CIs overlap)
  scissor (Spell) DEF +4       2.350 ± 0.073        +0.170
  paper (Shield) ATK +4        2.342 ± 0.074        +0.162
  paper (Shield) DEF +4        2.304 ± 0.072        +0.124
  max armor +4                 2.287 ± 0.073        +0.107
  scissor (Spell) ATK +4       2.280 ± 0.071        +0.100
  max HP +4                    2.221 ± 0.071        +0.041
  ```
  baseline (no upgrade): 2.180 ± 0.072. Sword ATK is still the top pick but
  is now statistically TIED with Sword DEF (2.429±0.070 vs 2.427±0.073,
  intervals overlap) — a change from session 12's report under the old
  hp-34 baseline, where Sword ATK led alone. Re-measuring under a changed
  loadout is exactly why this project doesn't quote old-session numbers
  (DECISIONS 2026-08-16).
- Tests: 292 passed, 0 skipped, 0 failed (272 → 292).

## Open questions for Claude
1. **Task 12 Stage B vs more fishing casts — which is the next session's
   spine?** Stage B needs a real potion in `consumables` first (untested
   field shape) before ANY policy work, and the session-13 brief explicitly
   asked to leave it alone this session. Meanwhile `data/fish-patterns.jsonl`
   has only 25 transitions from 5 casts — probably not enough for Task 11's
   `mineFishPatterns.ts` to find real cycles yet, but every additional
   session of live casts compounds. Worth deciding whether the next session
   spends its live-play budget on potion-loadout discovery or on growing
   the fishing transition log toward pattern-mining viability.
2. **The stuck dungeon run at room 3 (HP 4/36) — resume first, or abandon
   and start fresh?** It's genuinely still alive and resumable at zero
   additional run-slot cost (session 09's resume-fix still holds), but at
   4/36 HP against a full-health enemy it's very likely a loss either way.
   Worth 20 seconds of the next session's first action either way, just to
   close it out cleanly rather than leave it dangling indefinitely.
3. **`focusMeter`'s regeneration behavior is still unknown** — this
   session's cast never went long enough (or never played wastefully
   enough) to observe whether the 3-point budget refills at all (per turn,
   per hand-refill, never). The sim doesn't model `focusMeter` at all yet;
   worth deciding whether Task 11's fishing-side mining effort should
   extend to this mechanic too, or stay scoped to movement-pattern
   identification as originally designed.

## Files changed
```
21 non-fixture files changed, 747 insertions(+), 67 deletions(-)
(+2 new fixture dirs: fixtures/dungeon-runs/run-2026-08-15-20-44-28/,
fixtures/fishing-casts/live/ [5 cast subdirs];
+2 new source files: scripts/liveFishing.ts, tests/liveFishing.test.ts)

SPEC-fishing.md                    |   2 +-
SPEC.md                            |  63 ++++++++++++++++++++-
TASKS.md                           | 107 +++++++++++++++++++++++++----------
config/bot.json                    |   5 ++
handoff/DECISIONS.md               |   5 ++
scripts/liveRun.ts                 | 100 ++++++++++++++++++++++++++++++---
src/api/client.ts                  |  89 +++++++++++++++++++++++++++++
src/orchestrator/config.ts         |  47 ++++++++++++++++
src/sim/boons.ts                   |  13 +++++
src/sim/enemies.ts                 |  10 ++--
src/sim/fishing/castSim.ts         |  17 +++++-
src/sim/fishing/geometry.ts        |  19 +++++++
src/strategy/fishing/cardChoice.ts | 103 ++++++++++++++++++++++++++++++----
tests/boons.test.ts                |   9 ++-
tests/dungeonSim.test.ts           |   5 +-
tests/enemies.test.ts              |   4 +-
tests/fishing/cardChoice.test.ts   |  35 ++++++++++--
tests/fishing/geometry.test.ts     |  28 +++++++++-
tests/liveRun.test.ts              | 112 +++++++++++++++++++++++++++++++++++++
tests/orchestrator/config.test.ts  |  32 +++++++++++
tests/replay.test.ts               |   9 ++-

full stat: `git diff 8a83f8a..HEAD --stat` (before this commit)
```
