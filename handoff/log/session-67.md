# STATE — session 67 — 2026-08-21 (PT) — code at commit dc898a8

## Status
**BOTH GATES PASS.** Suite **1279/1279** (1254 → 1279, +25), `tsc --noEmit`
clean, `git diff --check` clean, secret scan clean across the whole session
diff, no test writes a real data path.

- **Gate 1 PASS** — the conserving oil policy is scored against `on-demand`,
  `never` and `focus-when-empty-only`, headlined in **oils per extra fish**,
  with the necessity gate pinned by a test demonstrated failing at BOTH
  degeneracies.
- **Gate 2 PASS** — six `fakeDoc` copies are one builder, and the guard is
  demonstrated failing with a live-path field removed.

**OFFLINE session by user decision. Zero casts, zero dungeon runs, zero live
actions.** Nothing was shipped: `liveFishing.ts` still plays `onDemandTriggers`
and `dendren.oils.policyApproved` is still false.

**THE LEDGER READ FAILED — THE JWT IS EXPIRED.** `checkFishingCaps.ts` returned
HTTP 401. Decoded locally without printing the token: `exp` =
**2026-08-21 17:54:17 UTC = 10:54 PT**, six minutes before today's 11:00 PT
rollover. **So today's `dayDocs` and `dayProgressEntities` are UNKNOWN.**
The token must be refreshed from the browser before any live session. This
blocked only the ledger report; everything else was offline.

## What works
- **§1 THE NECESSITY GATE, and it beats the shipped policy on BOTH axes.**
  `conservingOil({relaxing:1, focus:1})` — on-demand's two triggers unchanged,
  each skipped when an affordable card already achieves the outcome with
  certainty. **88.38% / +19.66pp / 3809 oils = 2.42 oils per extra fish**,
  against on-demand's **88.11% / +19.40pp / 5578 = 3.59**. n=8000, paired on
  seed. `npx tsx scripts/oilConserveSweep.ts --runs=8000`.
- **The answer to the brief's own question is NO, it is not "switch to
  focus-only".** The free re-rank reproduces byte-for-byte and does reverse the
  ranking (`focus-when-empty-only` 2.48 beats `on-demand` 3.59; the Relaxing
  trigger costs **15.51 oils/fish at the margin**) — but taking it would have
  discarded 1.9pp of catch rate for nothing.
- **The decomposition, which is the causal story.** Relaxing-gate-only scores
  **88.11% / +19.40pp — byte-identical to on-demand — for 1182 fewer oils.**
  It is free because 55.8% of lethal triggers fire when a card already kills
  with probability exactly 1. Focus-gate-only *gains* +0.35pp: it defers the one
  held oil to a turn where the frozen cell genuinely cannot reach.
- **The threshold is NOT a fitted parameter, and that is measured.** Both gate
  inputs are bimodal at the moments the triggers fire — `bestKillProbability`
  34.3% exactly 0 / 55.8% exactly 1 / 9.9% between; `bestConnectProbability`
  59.8% / 27.8% / 12.5%. Every value 0.25→1 is one plateau, so `1` ships with
  no constant to defend.
- **Mana first is STRUCTURAL.** The card policy's context is
  `["dist","fishHp","focusBudget","gridSize","hand","mana"]` — no oil field
  exists, so no oil policy can make it hold mana back. Pinned on the key set.
- **§2 ONE `fakeDoc` BUILDER + THE GUARD.** `tests/helpers/fishingDoc.ts`;
  `LIVE_PATH_FIELDS` names what the live path reads and
  `fishingDocGuard.test.ts` requires removing each one to be OBSERVABLE in a
  real `runOneCast`.
- **§3 THE DISTRIBUTION REHEARSAL. THE BOT IS PORTABLE.** `doctor.ts` in a
  friend's environment prints exactly one `✗` — the missing JWT — with four
  numbered steps; `liveRun.ts --status` works with no token; both live entry
  points refuse cleanly. `npm install` works from a bare `package.json`.
  Report: `handoff/reports/session-67-distribution-rehearsal.md`.

## What's broken
- **ITS TEST SUITE IS NOT PORTABLE. Four shipped test files assert against
  unshipped data**, so a friend's first `npx vitest run` is red:
  `rejectionAudit.test.ts` (`logs/`), `redact.test.ts` (`handoff/`),
  `matcherVerdict.test.ts` (`data/ringPrediction.jsonl`),
  `reversalDispersion.test.ts` (`data/fish-patterns.jsonl`). Clean export:
  **4 failed | 67 passed (71), 4 failed | 1264 passed (1268)**. **None is a
  ships-list bug** — every path is correctly excluded. Not fixed: the fix is
  judgement about what a stranger's suite should assert.
- **`rejectionAudit.test.ts` throws at COLLECTION, so it contributes 0 tests
  instead of 11.** The count drops silently; the eleven are identifiable only
  by diffing the JSON reporters, and they are listed in the report.
- **THE JWT IS EXPIRED** (see Status). Not a code defect, but it blocks every
  live command until refreshed.
- **The guard found two fields on my own list that were unobservable** —
  `fishMaxHp` and `focusMeterMax`. Real: under `onDemandTriggers` neither
  enters a decision, they are read only to be PRINTED. The observable was
  widened to console output; the list was **not** shortened.
- **The sim cannot model shared stock per-cast.** `runArm` hands every cast a
  fresh oil. §5's finite-stock table is a separate instrument built for exactly
  this, at 400 days per cell — do not read the per-cast tables as answering
  "conserve for future casts".
- Carried: corrode modelled but inert in `dungeonSim` (**CLOSED decision**);
  25 analysis scripts hold hardcoded paths; the nextPosition tripwire has still
  never met a real server; distribution steps 3–6 remain the user's.

## Corrections to SPEC.md
- **None this session.** No live game response was observed. Stated explicitly
  rather than left blank.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.
- `handoff/DISTRIBUTION.md` corrected: ships list gained `vitest.config.ts` and
  `package-lock.json`; does-not-ship gained `CODEX*`, `config/.gitkeep`,
  `.claude/`.

## Dead ends
- **A `toContain` assertion on the mock's key set was written and rejected as
  worthless.** It passes for a field nothing reads, so it cannot tell a complete
  mock from one with a decorative extra key — the same class session 66 caught
  with source-text pins. Replaced by the observability guard. **Do not loosen
  that assertion**; widen the observable or drop the field deliberately.
- **Do not re-derive the gate from "can a card GUARANTEE the kill".** Taken
  strictly it is almost never true and the gate becomes always-fire; taken
  loosely it is almost always true and the gate becomes never-fire. Both are
  reachable in the shipped code by moving one number, which is what makes the
  pin meaningful.
- **Do not tune the necessity thresholds.** A tuned pair buys ~0.08pp on a sim
  whose control arm catches 68.71% against the real fishery's 25.9%.
- **Do not quote the sim's ±0.01pp CIs as decision intervals.** They are the
  sim's repeatability. Session 66's corpus interval for the same Relaxing
  trigger is ~1.5–20 oils per extra fish.
- **The brief's `focusPoint: [1,1]` vs `[2,2]` divergence between mock copies
  was a non-issue** — both are on-grid; only the old `[0,0]` was fatal. The
  shared builder uses `[2,2]`, the live wire's value, and all copies still pass.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`) before claiming a blocker; do not revert rule 8; do
  not budget casts for the tripwire; `boonCapture` stays OFF (settled — stop
  listing it); do not reopen §19, rule 8, or corrode-in-`dungeonSim`.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine
  (`EPERM …tsx-501/*.pipe`; `unable to access '~/.gitconfig'`). Run both
  unsandboxed. Not a repo problem.

## Metrics
- **Live: NOTHING. 0 casts, 0 dungeon runs, 0 spend.** One read-only ledger
  attempt, which 401'd. Corpus unchanged at **109 casts** — verified with
  `oilReachability.ts --gap`, not carried over from the last recap. Note
  `fixtures/fishing-casts/live/` holds **110** `cast-*` directories; one does
  not load. 109 is the number every corpus statistic in this repo is computed
  on, and `ls | wc -l` is not that number.
- **Nothing this session wrote a real data path**, checked rather than
  asserted: no file under `data/` or `logs/` has an mtime inside the session
  window. The most recent writes are 10:06 PT, from session 65's live batch.
- **Suite 1254 → 1279 (+25).** New: `oilNecessity.test.ts` 12,
  `fishingDocGuard.test.ts` 13.
- **Sim, n=8000/arm paired on seed, `costsTurn=false`, amount=2:**
  never 68.71% / on-demand 88.11% (5578 oils) / focus-when-empty-only 86.45%
  (3515) / **conserve(r=1,f=1) 88.38% (3809)**.
- **Finite-stock day, 20 casts, 400 days/cell** — conserve dominates on-demand
  at every stock level. At the user's actual **18 Focus / 0 Relaxing**:
  18.14 fish / **8.6 oils** vs 18.12 / 11.0. At 4/4: **16.29 / 6.1** vs
  15.71 / 7.6.
- **Clean-export suite: 1268 passed, 4 failed, 11 never ran** vs 1279 at home.
- Oils held (last live read, session 65): **Relaxing 0, Focus 18**.

## Open questions for Claude
1. **Does the user approve `conserve(r=1,f=1)`?** Approving means
   `policyApproved: true` plus one trigger swap in `liveFishing.ts`; the code
   is written and tested and deliberately not wired. Note it is a strict
   improvement on the shipped policy in the sim, not a trade-off — which is
   unusual enough to be worth their scepticism.
2. **Who fixes the four non-portable test files, and how?** The pattern exists
   (`loadRingPredictions` returns `[]` for a missing file); the tests then need
   explicit skip-guards rather than loosened assertions. It is a session of
   judgement calls about what a stranger's suite should assert.
3. **The JWT expired mid-session.** Is there a way the user wants to be warned
   before a session starts, or is `doctor.ts` at the top of each session
   sufficient? `doctor.ts` already decodes `exp` locally and would have said so
   in one second.
4. **Should `dist-preflight/` be regenerable by a script** rather than by the
   eleven-command incantation now living in a report? A `scripts/preflight.ts`
   would make step 5 repeatable before every invite, not once.

## Files changed
```
 2 commits (7d536bc, dc898a8). No new fixtures — offline session.

     handoff/reports/session-67-distribution-rehearsal.md | 265  (new — §3)
     handoff/OIL-CONSERVE.md                              | 222  (new — §1d)
     src/strategy/fishing/oilTiming.ts                    | 236  (the gate)
     scripts/oilConserveSweep.ts                          | 258  (new — the sweep)
     tests/fishing/oilNecessity.test.ts                   | 191  (new — gate 1)
     tests/fishing/fishingDocGuard.test.ts                | 177  (new — gate 2)
     tests/helpers/fishingDoc.ts                          | 152  (new — the ONE builder)
     tests/liveFishing.test.ts                            | 175  (3 copies removed)
     tests/helpers/oilDecisionState.ts                    |  62  (new)
     tests/fishing/oilStockExhaustion.test.ts             |  70  (1 copy removed)
     tests/fishing/oilPartialDry.test.ts                  |  63  (1 copy removed)
     tests/fishing/nextPositionTripwire.test.ts           |  61  (1 copy removed)
     handoff/DECISIONS.md                                 |   7  (6 entries)
     src/sim/fishing/castSim.ts                           |  13  (board wiring)
     handoff/DISTRIBUTION.md                              |  15  (ships list)
     tests/fishing/oilTiming.test.ts                      |  17
     .gitignore                                           |   5  (dist-preflight/)
```

---

# APPENDIX — session 67 verbose material

## A. The full conserve sweep, n=8000/arm, `costsTurn=false`, amount=2

```
── §1  THE EXISTING ARMS, RE-RANKED UNDER THE NEW OBJECTIVE ──
  policy                            catch  Δ vs never   oils   OILS PER EXTRA FISH [95% CI]
  focus-when-empty-only            86.45%    +17.74pp   3515              2.48 [2.48, 2.48]
  on-demand                        88.11%    +19.40pp   5578              3.59 [3.59, 3.60]
  lethal-relaxing-only             73.19%     +4.47pp   1821              5.09 [5.08, 5.09]
  heuristic-c                      73.22%     +4.51pp   2630              7.29 [7.28, 7.29]
  start                            74.38%     +5.66pp  16000           35.32 [35.28, 35.36]
  never                            68.71%     +0.00pp      0                              —

  THE MARGINAL STEP, which the average column hides:
    on-demand over focus-when-empty-only costs 2063 extra oils for 133.0 extra fish
    = 15.51 OILS PER EXTRA FISH at the margin, against 2.48 for the focus arm on average.

── §2  THE NECESSITY GATE ──
  policy                            catch  Δ vs never   oils   OILS PER EXTRA FISH [95% CI]
  conserve(r=2,f=2)                88.11%    +19.40pp   5578              3.59 [3.59, 3.60]
  conserve(r=0.9,f=0.9)            88.38%    +19.66pp   3809              2.42 [2.42, 2.42]
  conserve(r=1,f=1)                88.38%    +19.66pp   3809              2.42 [2.42, 2.42]
  conserve(r=0.75,f=0.5)           88.46%    +19.75pp   3675              2.33 [2.32, 2.33]
  conserve(r=0.5,f=0.5)            88.42%    +19.71pp   3548              2.25 [2.25, 2.25]
  conserve(r=0.25,f=0.25)          88.29%    +19.57pp   3420              2.18 [2.18, 2.19]
  conserve(r=0,f=0)                68.71%     +0.00pp      0                              —
  conserve(r=0,f=0.5)              86.96%    +18.25pp   2745              1.88 [1.88, 1.88]
  conserve(r=2,f=0.5)              88.46%    +19.75pp   4853              3.07 [3.07, 3.07]
  conserve(r=0.75,f=2)             88.11%    +19.40pp   4396              2.83 [2.83, 2.83]

── §2b  IS THE THRESHOLD A FITTED PARAMETER? ──
  bestKillProbability, at every turn the LETHAL trigger fired (n=2097)
    exactly 0        719  34.3%
    (0, 0.25)          0  0.0%
    [0.25, 0.5)       46  2.2%
    [0.5, 0.75)      148  7.1%
    [0.75, 1)         13  0.6%
    exactly 1       1171  55.8%
  bestConnectProbabilityFromFrozenCell, at every turn the METER trigger fired (n=3481)
    exactly 0       2081  59.8%
    (0, 0.25)          0  0.0%
    [0.25, 0.5)      230  6.6%
    [0.5, 0.75)      201  5.8%
    [0.75, 1)          3  0.1%
    exactly 1        966  27.8%

── §3  A REAL DAY: 20 casts (the server cap), ONE shared stock ──
  stock (focus,relax)                    never            on-demand focus-when-empty-onl    conserve(r=1,f=1)
  18 focus, 0 relaxing             13.74f/0.0o         18.12f/11.0o         18.12f/11.0o          18.14f/8.6o
  8 focus, 8 relaxing              13.74f/0.0o         17.14f/12.8o          16.82f/7.8o          17.63f/9.5o
  4 focus, 4 relaxing              13.74f/0.0o          15.71f/7.6o          15.35f/4.0o          16.29f/6.1o
  2 focus, 2 relaxing              13.74f/0.0o          14.85f/4.0o          14.58f/2.0o          15.29f/3.6o
  40 focus, 40 relaxing            13.74f/0.0o         18.19f/16.2o         18.13f/11.0o         18.20f/11.0o
  (mean fish caught / mean oils spent per 20-cast day, 400 days per cell)
```

## B. Gate 1 demonstrated failing at BOTH degeneracies, each restored

`conserving` forced to `{relaxing: ALWAYS_FIRES_THRESHOLD, focus: ALWAYS_FIRES_THRESHOLD}`:

```
 FAIL  oilNecessity > THE ANTI-DEGENERACY PIN > spends STRICTLY FEWER oils than on-demand
AssertionError: expected 1396 to be less than 1396
 FAIL  oilNecessity > THE ANTI-DEGENERACY PIN > the saving is material, not a rounding artifact
AssertionError: expected 0 to be greater than 0.1
      Tests  2 failed | 10 passed (12)
```

`conserving` forced to `{relaxing: NEVER_FIRES_THRESHOLD, focus: NEVER_FIRES_THRESHOLD}`:

```
 FAIL  oilNecessity > THE ANTI-DEGENERACY PIN > spends STRICTLY MORE than zero
AssertionError: expected 0 to be greater than 0
 FAIL  oilNecessity > THE ANTI-DEGENERACY PIN > does NOT pay for the saving in fish
AssertionError: expected 1371 to be greater than or equal to 1759
      Tests  2 failed | 10 passed (12)
```

Restored: 12 passed.

## C. Gate 2 demonstrated failing — `fishingConsumableSlotUsed` deleted from the ONE builder

This is session 65's exact bug, reproduced deliberately in the consolidated
builder to prove the guard catches what six copies did not:

```
 FAIL  fishingDocGuard > the shared builder carries every field LIVE_PATH_FIELDS names
AssertionError: builder is missing fishingConsumableSlotUsed: expected false to be true
 FAIL  fishingDocGuard > GATE 2 > omitting `fishingConsumableSlotUsed` changes what the live path does
AssertionError: removing `fishingConsumableSlotUsed` changed NOTHING about the cast. …
 FAIL  oilPartialDry > GATE 2 (cast) — a DRY Relaxing trigger does not suppress a FUNDED Focus consume
AssertionError: expected [ 'start_run', 'play_cards', …(1) ] to include 'use_fishing_item'
 FAIL  oilPartialDry > [session 65] a SECOND consume in one cast targets the next free slot, live
AssertionError: expected 0 to be greater than or equal to 2
 FAIL  oilStockExhaustion > GATE 2 > the same loop DOES spend once the fish is genuinely lethal
AssertionError: expected [ 'start_run', 'play_cards', …(1) ] to include 'use_fishing_item'

 Test Files  3 failed | 68 passed (71)
      Tests  5 failed | 1274 passed (1279)
```

Restored: 71 files, 1279 passed.

Note the second message reads "changed NOTHING" rather than naming the missing
field: with the builder itself broken, the control run and the omit run are
both missing it, so they compare equal. The first assertion is the one that
names the cause. Both are needed.

## D. The expired-JWT diagnosis, in full

```
TokenExpiredError: Auth rejected (HTTP 401). The JWT is expired or invalid — refresh it.
    at GigaverseClient.get (src/api/client.ts:228:49)
    at async main (scripts/checkFishingCaps.ts:55:14) {
  status: 401,
  body: '{"error":"Unauthorized"}'
}
```

Decoded locally from `~/.secrets/gigaverse-jwt.txt` without printing the token:

```
exp epoch: 1787334857
exp utc  : 2026-08-21 17:54:17 UTC     (= 10:54 PT)
now utc  : 2026-08-21 18:25:51 UTC
expired  : True
claims   : ['address', 'exp', 'gameAccount', 'login_type', 'user']
```

It expired six minutes before the 11:00 PT rollover, so no reading of today's
ledgers was possible at any point in this session.

**`doctor.ts` already decodes `exp` locally and would have reported this in one
second, without a network call.** It was not run first because the brief asked
for the ledgers directly. That is worth a line in the next brief.

## E. The eleven tests that silently never run in a clean clone

`tests/rejectionAudit.test.ts` throws at collection on `logs/run-*.jsonl`, so
vitest reports the FILE as failed and the tests simply do not exist. Recovered
by diffing the home and export JSON reporters:

```
rejectionAudit — the pre-session-53 regime
  classifies start_run separately from the other empty-token actions
  pins the 66 / 66 / 224 split
  NEVER rejected a numeric-token POST or a start_run on its first attempt
  shows zero overlap between the rejected and accepted empty-token gap bands
  counts a retry as part of its decision, not as a second decision
rejectionAudit — after the session-53 pacing fix
  has post-fix logs to read at all
  rejects ZERO empty-token first attempts — the session-53 gate
  actually paces the empty-token POSTs, and ONLY those
rejectionAudit — parsing
  does not advance the response clock across a rejected attempt
  survives a truncated final line rather than losing the whole log
  reads the legacy stringified body shape the older logs use
```

## F. Secret scan of the EXPORT — every hit, adjudicated

Run against `dist-preflight/`, `node_modules` excluded. Reported separately
from the working-tree scan because they are different artifacts.

| pattern | file | verdict |
|---|---|---|
| `0x[a-fA-F0-9]{4,}` | `src/sim/rng.ts` | mulberry32 constant `0x6d2b79f5` |
| | `scripts/auditMovementIndependence.ts` | same constant |
| | `fixtures/probe/roms/player-response-redacted.json` | `1280x1280 PNG` inside an IPFS image URL |
| | `tests/api/redact.test.ts` | the redactor's own synthetic vectors |
| noob-id pattern | `tests/api/redact.test.ts` | same synthetic vectors |
| JWT prefix | `tests/api/client.test.ts` | synthetic `{"alg":"HS256"}` header + 300 `x`s |
| `PRIVATE` | — | 0 hits |
| `*.har`, `*.harx`, `**/raw/**` | — | 0 hits |

Export is clean. This says nothing about the git history, which is the entire
reason for the squashed-history plan.
