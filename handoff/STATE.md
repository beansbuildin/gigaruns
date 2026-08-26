# STATE — session 100 — 2026-08-26 (PT) — code at commit 5d99093f

## Status
Brief items **§A: DONE. §B: DONE. §C: BLOCKED — ledger not reset (expected).**
**GATE PASS** on everything this session could reach.

Suite **1988 passed / 1988, 109 files** (`vitest run --maxWorkers=4`; see
"What's broken" — unbounded, this machine fails on timeouts, including on
session 99's own file set). `tsc --noEmit` clean,
`git diff --check` clean, secret scan **0 hits on all four patterns**,
`discoveredShipsClean` 8/8.

**Live spend: ZERO.** No casts, no runs, no energy, no oils. The only live
traffic was three reads (`/gear/instances` twice, one `--dry-run`).

§C was blocked on arrival and stayed blocked: `checkFishingCaps.ts` read
**20/20 spent** at 07:59 PT and again at 09:12 PT (**1.8h to the 11:00 PT
window**). The brief anticipated this exact case and said to do §A/§B and
leave §C. Not attempted, not partially attempted.

## What works
- **§A — the durability preflight is LIVE and fail-closed.**
  `GET /gear/instances/{address}` → `src/strategy/fishing/rodDurability.ts`
  (pure) → `scripts/liveFishing.ts` halts before any cast. Verified by running
  it: `rod 812 reads DURABILITY_CID 38 (slot 14, GearInstance#812_...)`.
  Halts on four states, each meaning the batch would spend casts on a rod the
  repo cannot describe: **durability <=0**, **rod not equipped**, **a DIFFERENT
  rod equipped**, **empty response**. Warns at <=5 without stopping.
- **The rod is identified by ITEM ID, never by slot 14.** That makes the check
  self-validating: if the equipped rod stops being the rod `REAL_DECK`
  describes, that is itself the halt — sessions 89-91's failure caught forward
  instead of backward.
- **§A — the first real durability bracket exists.** Golkan read **40** at
  equip (2026-08-26T02:27:20Z) and **38** on this session's preflight, with
  session 99's **2 casts** between. **1.0/cast.** `data/rodDurability.jsonl`
  now takes a paired before/after reading on every live batch.
- **§B — `scripts/procEvidence.ts` is new**, with `tests/procEvidence.test.ts`.
  Re-runnable as volume accumulates.

## What's broken
- ⚠ **`triggeredBoons` has NEVER populated — 0 of 10,616 occurrences**, 93 run
  dirs, both sides, 2026-08-13 to 2026-08-26. Session 99 saw the same over 4
  runs and could not tell "rare" from "never". It is never. **It gates nothing
  and no runs should be spent on it** (QUESTIONS.md §57).
- ⚠ **`data.events[]` — the channel that DOES carry proc evidence — has been
  ignored on the dungeon side for 92 sessions.** `src/api/schemas.ts` has kept
  it since session 08 with a comment predicting exactly this use, and the
  FISHING side has read its own `data.events[]` all along. **Third instance of
  the same failure**: session 70 (`/gear/items` vs `/offchain/static`), session
  99 (fishing doc vs `/gear/instances`), now (`run.players[]` vs
  `data.events[]`). A field's absence from the payload a repo happens to read
  is not its absence from the API.
- ⚠ **`data.events` is present on only 2093 of 5308 canonical states.**
  Presumably action responses only — **not verified**, and if some exchanges
  are captured without their events then the true n is larger than 1919 and the
  capture path is dropping evidence. Unresolved; see open question 3.
- ⚠ **The default vitest worker count over-subscribes this machine and
  produces FALSE failures. Use `--maxWorkers=4`.** Load ran **13-31 with 49
  stray node processes** from unrelated sessions. Unbounded, the suite failed
  intermittently — always timeouts in heavy sim tests (`deckShuffle` observed
  at **16.3s** against the 10s `testTimeout`), never assertion failures.
  **The control that proves it is not this session's code:** the suite
  *excluding both new test files* — session 99's exact 107 files — failed
  **4 of 1967** under load 20, where session 99 recorded 1967/1967.
  With `--maxWorkers=4` it passes **1988/1988 in 13.3s even at load 31.6**.
  Never read a red suite here as a regression before re-running bounded.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED**; `CORPUS_DECK` still Shroom (§53 sets no threshold); the 0.85
  necessity gate still never observed live (now four batches).

## Corrections to SPEC.md
- **None to `SPEC.md` or `SPEC-fishing.md` — neither file was touched.**
  Nothing in any live response contradicted either.
- **But SPEC §4e's "unknown semantics" list is now one shorter, in TASKS.md
  rather than SPEC:** **`lck` is CRIT CHANCE.** Established by the zero-stat
  control, not by the name — `critProc0/1` never fired in 1012 + 943 exchanges
  where `lck` was 0.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- Corrections to REPO DOCS: `src/sim/boons.ts` (`LossIntuitionUp`'s
  "`triggeredBoons` empty all run" is true but evidences nothing),
  `src/sim/fishing/rodDeck.ts` (the wiring job is done; first bracket recorded).

## Dead ends
- **Do not spend runs trying to make `triggeredBoons` fire.** Ruled out as a
  capture-path gap separately: five sibling arrays on the SAME player object
  populate, including `focusBuffs` at **54/21,268 = 0.25%**. A path that
  captures a 0.25% sibling is not silently dropping this one 21,268 times.
- **Do not narrow `tests/procEvidence.test.ts` and keep its "every flag fires"
  assertion.** `evadeProc0` and `intuitionProc0` fire **6 times each across all
  1919 exchanges**; any slice can honestly contain zero. The test scans 20 run
  dirs and asserts a slice-safe form instead.
- **Do not inherit a performance rationale from `procEvidence.ts`'s history.**
  Two different "the full scan times out other tests" justifications were
  written and both were withdrawn — they rested on runs taken at load 17+ and
  one with two vitest processes at once. The bounded scan is there to bound
  what a test pays as an append-only corpus grows, and for no other reason.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED; §50's "don't shape a batch
  toward the 0.85 gate"; §56's depth-confidence gap stays open, no action.

## Metrics
- **Live: 0 casts, 0 runs, 0 energy, 0 oils, 0 deaths.** Corpus unchanged at
  79 dungeon attempts / 210 fishing casts.
- **§B proc rates, n = 1919 exchanges per side** (`scripts/procEvidence.ts`):

```
  flag              stat        fired /    n      rate    fired when stat==0
  blockProc0        block         90 / 1919     4.69%     0 / 299
  blockProc1        block         22 / 1919     1.15%     0 / 918
  critProc0         lck           24 / 1919     1.25%     0 / 1012
  critProc1         lck           25 / 1919     1.30%     0 / 943
  evadeProc0        evasion        6 / 1919     0.31%     0 / 1691
  evadeProc1        evasion       31 / 1919     1.62%     0 / 928
  intuitionProc0    intuition      6 / 1919     0.31%     0 / 1354
  tenacityProc0     tenacity      17 / 1919     0.89%     0 / 1172
  tenacityProc1     tenacity      19 / 1919     0.99%     0 / 932
```

  Rates land in **0.31%-4.69%**, exactly the 1-5% band SPEC §4e predicted.
  **The zero-stat column is the load-bearing one** — no flag has ever fired
  while its own stat read zero, across 299-1691 observations each.
- **Two corroborations, neither engineered:** `intuitionProc0` fired 6 times and
  the corpus holds exactly **6** `intuition_block` events on the same turns;
  and there is **no `intuitionProc1` at all**, matching the enemy's `intuition`
  being 0 in all 5308 states.
- **Rod durability: 40 → 38 over 2 casts = 1.0/cast, n=1 bracket.** At 1.0/cast
  a 40-durability rod is a ~40-cast rod, which matches the user's own estimate.
  **Not promoted to the rate** — the "before" half was a hand-read at equip, and
  a per-BATCH or per-TURN decrement could coincide at this sample.

## Open questions for Claude
1. **Effect SIZES are now the only thing blocking CAPTURE-1, and they are
   measurable from data already on disk.** A rate is not a mechanic: nothing yet
   says what `block` DOES when it procs (full negate? reduction? how much?).
   The measurement is a diff of HP/shield deltas on fired vs unfired exchanges
   over the same 1919, no live play required. Worth a task?
2. **Should the live loop READ the proc booleans, or only the corpus?**
   `scripts/procEvidence.ts` reads committed fixtures. The events are in every
   action response the bot already receives, so per-exchange proc logging beside
   the existing `evSupported`/`unmodelled` fields is cheap — but nothing should
   consume it in a decision until effect sizes exist.
3. **Is the capture path dropping events?** `data.events` is on 2093 of 5308
   states. If that is "action responses only" it is complete; if some exchanges
   are captured without their events, n is larger than 1919 and evidence is
   being lost. Cheap to settle offline and it sizes everything in question 1.
4. **§C is still owed: the 20-cast batch** (§55), first session after 11:00 PT.
   It is also the first real chance at a durability bracket the instrument took
   itself at BOTH ends — §A's task-3 data.
5. **The 0.85 necessity gate has now gone four batches with zero
   opportunities.** Unchanged from session 99's question 4; §50 still stands.

## Files changed
```
 2 commits (this recap makes 3). No new fixtures — zero live play.

  A  scripts/procEvidence.ts               +239  §B's instrument
  A  tests/procEvidence.test.ts            +116  both claims + zero-stat control
  A  src/strategy/fishing/rodDurability.ts +199  §A, pure, fail-closed
  A  tests/fishing/rodDurability.test.ts   +188  the durability-0 refusal
  M  scripts/liveFishing.ts                +144  preflight + paired ledger
  M  QUESTIONS.md                          +132  §57
  M  src/api/schemas.ts                     +42  GearInstanceSchema
  M  TASKS.md                               +32  CAPTURE-1 updated
  M  src/sim/fishing/rodDeck.ts             +22  wiring done, first bracket
  M  src/api/client.ts                      +14  getGearInstances()
  M  src/sim/boons.ts                       +14  LossIntuitionUp correction
  M  tests/noHardcodedPaths.test.ts          +9  ratchet 25 -> 26
  M  tests/clientSurface.test.ts             +3  allowlist the read
```
