# STATE — session 14 — 2026-08-15 — commit PENDING

## Status
No TASKS.md gate newly MET this session — the session's work was diagnostic
(session-14 brief's own framing) plus two live probes riding along on it.
**Primary finding: session 13's 92.4% fishing-sim catch rate does NOT survive
contact with live data, and now we know why in two parts.** `focusMeter`
(confirmed live session 13) is now MODELLED in `src/sim/fishing/castSim.ts` —
alone it drops the 500-cast catch rate to 69.9–71.6%, real but still
statistically incompatible with live's 0/6 (P≈0.05%). The DOMINANT cause is
separate and larger: the sim's true fish pattern is always drawn from the
same synthetic pool the matcher searches, so it can always identify it in
principle — none of this project's six real casts ever have, because the
real pattern isn't in that library. Forcing the matcher blind (new
`matcherPool: []` option) drops the rate to ~7–10%, consistent with live 0/6
(P≈55–65%). **This reclassifies `scripts/mineFishPatterns.ts` (unbuilt) from
"nice to have" to the actual blocker for fishing** — no volume of
`data/fish-patterns.jsonl` transitions helps until it exists.

Also this session: resumed the run session 13 left stuck at room 3 (survived,
died room 4 instead); confirmed Task 12 Stage B's `consumables` field shape
(raw item ID) plus a bigger finding (potion consumed at `start_run`/loadout
time, not at `use_item` time); recorded a standing rule (sim authority is
earned per domain, never inherited). Both today's live-play budgets are now
FULLY EXHAUSTED (dungeon 12/12 runs, fishing 5/5 casts) — no more live play
possible today regardless of what's asked.

Next per TASKS.md: Task 11's `mineFishPatterns.ts` is now the priority (see
above) — but note `data/fish-patterns.jsonl` still only has 25 transitions
from 5 casts, and fishing's daily budget is spent, so more casts to grow it
can't happen until tomorrow. Task 12 Stage B's timing policy is still fully
unbuilt and was deliberately not started.

Overall: a brief that asked "does this one mechanic explain the gap" got an
honest "partly, and here's the bigger thing" instead of a rescoped
confirmation — the sim's headline numbers were never wrong about the
algorithm, they were wrong about what the algorithm is being tested against.

## What works
- **`focusMeter` MODELLED in the sim.** `src/sim/fishing/castSim.ts` gained
  `FOCUS_METER_MAX=3`, `defaultStartFocus` (grid-center, matching the one
  live cast's observed `[2,2]` start), and per-cast budget tracking threaded
  through `chooseCard`/`bestFocusForCard` via the existing `FocusBudget`
  param (built session 13 for the live loop, now also fed by the sim).
  500-cast catch rate: 71.6% (n=500) / 69.9% (n=3000, independent seed) —
  down from session 13's unconstrained 92.4%. Verified by:
  `npx vitest run tests/fishing` (26/26 pass), `scripts/fishFocusMeter.ts`.
- **Library-mismatch diagnostic: the dominant explanation, isolated
  cleanly.** `castSim.ts`'s new `matcherPool` option separates "what the
  TRUE pattern is drawn from" (`candidatePool`, unchanged) from "what the
  matcher searches" (new) — `matcherPool: []` forces the matcher permanently
  blind. Result: 7.0% (n=500) / 10.3% (n=3000) — indistinguishable from the
  8.4% random baseline, and statistically consistent with live's 0/6
  (P≈55–65%, vs. P≈0.05% for the focus-only 71.6% figure and P≈0.00002% for
  session 13's unconstrained 92.4%). Two new regression tests in
  `tests/fishing/castSim.test.ts` pin both findings.
- **Task 12 Stage B — `consumables` field shape CONFIRMED, live.**
  `scripts/checkPotions.ts` (new, read-only) found real inventory (Big Heal
  Juice ×8, Mid Heal Juice ×7). `scripts/liveRun.ts` gained
  `--probe-consumables=<itemId>` (mirrors `--probe-use-item`): sent
  `start_run` with `consumables: [131]`, run started normally — **the field
  takes a raw item ID.** Bigger finding: the Big Heal Juice balance dropped
  8→7 immediately at `start_run`, before any combat, and the run never
  called `use_item` once (died room 2 via the normal combat loop, zero heal
  events). **The potion is consumed at loadout commitment, not at
  point-of-use.** Fixture: `fixtures/dungeon-runs/run-2026-08-15-23-02-36/state-000.json`.
- **Stuck run (session 13) resumed and resolved.** `npx tsx
  scripts/liveRun.ts --runs=1` — survived room 3 at HP 1/36, picked up
  `CorrosiveMagic` for the first time ever (now MODELLED as `{kind:"latent"}`,
  zero delta at pickup, contaminates STATUS_EFFECT — same shape as
  `AddBurnSword`/`CorrosiveShield`), cleared into room 4 Safe-tier, died
  there. Cost 0 energy / 0 run slots (a resume, not a new start — session 09's
  rule still holds).
- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **296 tests, 20 files, all pass** (292 → 296; 2 new
  fishing tests plus 2 more from corpus-total re-derivation; 9 corpus-total
  assertions re-derived from the live corpus after this session's 2 new live
  runs, per the established "expected to fail after every capture"
  convention — every one checked against the actual new corpus data, not
  guessed).
- `npx tsx scripts/sim.ts` — Task 5's gate report still passes (room-1
  battle win rate always-Sword 85.6% vs ev-engine 92.9%, non-overlapping),
  re-verified against the further-grown corpus.

## What's broken
- **The fishing strategy's honest current live expectation is ~7–10% catch
  rate, not 92.4%.** This isn't a new bug in `chooseCard`/`shouldRedraw`
  (session 13's fixes were real and are still correct) — it's that the
  matcher currently has nothing to identify against. Until
  `mineFishPatterns.ts` exists and produces a real pattern library from
  `data/fish-patterns.jsonl`, the "hedge throughout vs. identify-then-cash-in"
  tradeoff in SPEC.md §5 is moot: hedge-throughout is the only policy
  actually in effect, live, right now.
- **Task 12 Stage B's timing policy is still fully unbuilt.** Field shape is
  now known, but turn-cost and multi-use-per-battle are still open — neither
  is answerable without a run that actually calls `use_item` on a loaded
  potion, which didn't happen this session (deliberately, per the brief).
- **`focusMeter` regeneration is still `[VERIFY]`.** The session-14 brief
  asked for a deliberate live test (spend all 3 points early, watch for
  refill) — NOT attempted: `data/guard-budget-fishing.json` already showed
  5/5 casts spent for today's date before this session began (session 13's
  own spend, date-keyed guard), so the cap was exhausted at session start.
  Next session's first fishing action, once the date rolls over.
- **Both live-play budgets are now fully exhausted for today.** Dungeon:
  12/12 runs, 216/240 energy. Fishing: 5/5 casts, 59/100 energy. No further
  live play is possible until the date-keyed guards reset.

## Corrections to SPEC.md
- §5: `focusMeter` is now MODELLED in the sim (previously flagged as
  unmodelled, making the 92.4% figure "an optimistic ceiling"). New finding:
  modelling it only explains ~30% of the sim-vs-live gap; the pattern-library
  mismatch explains the rest. Full derivation and numbers in SPEC.md §5.
- §5: new subsection, "A standing rule: sim authority is earned per domain,
  never inherited" — a sim's authority to inform a design decision comes
  from demonstrated agreement with live outcomes IN THAT DOMAIN specifically;
  the dungeon sim's own good agreement (session 11) said nothing about the
  fishing sim's trustworthiness.
- §5: "does identification ever finish?" section updated — all six real
  casts to date never converged even once, confirming this open question's
  own worst case is the live reality, not a hypothetical.
- SPEC-fishing.md §4: `focusMeter` row updated to say the sim now models it,
  with a pointer to SPEC.md §5 for the fuller finding.
- Resolved IDs unchanged: **forbiddenWoods=5**, **dendren nodeId="5" /
  pondId=2**.
- Move charges: unchanged, PRESENT, hard-pruned.

## Dead ends
- None new. Both this session's live probes (resumed run, consumables field
  shape) landed clean, confirmatory results — nothing was tried and
  abandoned.

## Metrics
- Fishing sim, `focusMeter` modelled, library KNOWN (matcher can identify):
  71.6% (358/500, n=500) / 69.9% (2097/3000, n=3000, independent seed) —
  down from session 13's unconstrained 92.4%.
- Fishing sim, `focusMeter` modelled, library BLIND (`matcherPool: []`):
  7.0% (35/500) / 10.3% (308/3000) — statistically indistinguishable from
  random (8.4%, 42/500) and consistent with the live 0/6 result.
- Random baseline, `focusMeter` modelled: 8.4% (42/500) — essentially
  unchanged from session 13's unconstrained figure (a 4×4 grid still leaves
  most cells reachable within a 3-point budget for a policy with no
  placement preference).
- Live dungeon: 2 runs this session (1 resumed from session 13: survived
  room 3, died room 4; 1 fresh, carrying Task 12 Stage B's consumables probe:
  died room 2). Death-room histogram now **13 confirmed deaths: room 1 ×0,
  room 2 ×4, room 3 ×4, room 4 ×5** — same even spread every session, two
  more data points, no shape change. Energy: 216/240 spent, 12/12 runs
  (session/day cap reached).
- Live fishing: 0 casts this session (budget already exhausted at session
  start — see "What's broken"). `data/fish-patterns.jsonl` unchanged at 25
  transitions.
- Tests: 296 passed, 0 skipped, 0 failed (292 → 296).

## Open questions for Claude
1. **`mineFishPatterns.ts` is now the clear priority — is it the next
   session's spine?** This session's finding reframes it from "mine once
   there's enough volume" to "nothing else in fishing matters until this
   exists." But `data/fish-patterns.jsonl` still has only 25 transitions
   from 5 casts (unchanged this session — fishing budget was exhausted
   before the session started), and it's unclear whether that's enough
   volume for the miner to find real cycles even once built. Worth deciding
   whether next session builds the miner against the current 25-line log
   (and reports honestly if it's too thin), or spends live-play budget
   growing the log first (once the date-keyed guard resets) and defers the
   miner.
2. **Task 12 Stage B's timing policy — worth starting now, or still wait?**
   The field-shape blocker is resolved (raw item ID, consumed at loadout
   time) and there's a real potion balance to work with (7 Big Heal Juice
   left after this session's probe). The turn-cost/multi-use questions still
   need a live `use_item` call on a loaded potion to answer, which needs
   dungeon run budget (currently 0 remaining today).
3. **Should the live fishing/dungeon loops report their date-keyed budget
   status BEFORE a session starts trying to plan around it?** Both guards
   were already at cap this session before any live action was taken
   (fishing from session 13's own spend), which wasted no budget but did
   cost early-session investigation time to discover. A `--status`-only
   flag on `liveRun.ts`/`liveFishing.ts` that just prints remaining
   budget without needing a dry-run might be worth it — not built this
   session, just noticed.

## Files changed
```
12 non-fixture files changed, 356 insertions(+), 42 deletions(-)
(+3 new fixture dirs: fixtures/dungeon-runs/run-2026-08-15-22-50-29/ [empty,
dry-run],  run-2026-08-15-22-50-38/, run-2026-08-15-23-02-36/;
+2 new source files: scripts/checkPotions.ts, scripts/fishFocusMeter.ts)

SPEC-fishing.md                    |  2 +-
SPEC.md                            | 80 ++++++++++++++++++++++++++++++++++--
TASKS.md                           | 72 ++++++++++++++++++++++++++++------
handoff/DECISIONS.md               |  6 +++
scripts/liveRun.ts                 | 39 +++++++++++++++++--
src/sim/boons.ts                   | 41 ++++++++++++++++++-
src/sim/fishing/castSim.ts         | 70 ++++++++++++++++++++++++++++-----
src/strategy/fishing/cardChoice.ts |  6 ++-
tests/boons.test.ts                | 13 +++++--
tests/dungeonSim.test.ts           | 14 ++++++-
tests/fishing/castSim.test.ts      | 42 ++++++++++++++++++++
tests/replay.test.ts               | 13 ++++++-

full stat: `git diff 56a4320..HEAD --stat` (before this commit)
```
