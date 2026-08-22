# STATE — session 71 — 2026-08-21 (PT) — code at commit f91cafb

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1368/1368** (1360 → 1368, +8),
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean across the
whole session diff (zero matches), `discoveredShipsClean` 8/8. **Zero casts,
zero dungeon runs** — the brief authorized none and none were spent. Ledgers
identical at session start and end: fishing game **16/20**, dungeon **0/12**.

- **Gate 1 PASS. The headline is a retraction, not a discovery: the replay was
  never broken — the comparison was.** Live's "1.08" pools two policy eras.
- **Gate 2 PASS.** `REAL_DECK` is the Shroom deck, in ONE place, with a test
  that fails when it diverges from the rod the account holds.
- **The same defect had failed session 70's OTHER gate too**, and that one now
  PASSES on a like-for-like comparison. **Session 70's report is superseded in
  part** — header added, not edited away.

**NOTHING NEW IS SHIPPED TO THE LIVE LOOP.** `liveFishing.ts` is untouched.
`focusBudget.ts` is still `{kind:"none"}`; redraw is still wired and OFF. Every
change is analysis scripts, one new sim module, tests, and documentation.

## What works
- **§1 GATE 1 — `scripts/replayGapDecomposition.ts`.** The 1.08-vs-0.73 gap
  decomposed by toggling one thing at a time, with an explicit residual:

  ```
  session 70's as-run arm (all 123, re-mined, posterior)   0.732
  + cast set: the 50 live actually logged     0.732 -> 0.760   +0.028
  + matcher library: live's loaded 3 patterns 0.760 -> 0.840   +0.080
  + matcher weighting: each cast's OWN era    0.840 -> 1.060   +0.220
                                                     target     1.080
  RESIDUAL, unexplained                                        +0.020
  ```

  **The residual is 5.7% and does NOT sum perfectly** — which the brief
  correctly said would be the suspicious outcome.
- **§1 the dominant term is not a harness conservatism at all.** Live's 1.08
  pools **15 casts played under the RETIRED fixed-0.9 matcher weight** (spent
  **1.667**) with **35 under today's posterior** (spent **0.829**). Asked about
  today's policy alone, the replay lands on **0.829 against live's 0.829**.
- **§1 the brief's two named candidates were MEASURED and are ~nil.**
  Leave-one-out — the *leading* hypothesis — is worth **−0.020, in the wrong
  direction**. Truncation is **exactly 0.000**: 0/123 casts lose a turn-0
  observation, because truncation removes TAIL turns and cannot touch the
  opener. A third difference the brief did not name (live estimates the sticky
  switch probability at load, 0.0431; the replay took the constant 0.05) is
  worth +0.000.
- **§1 the match is PER-CAST, not a coincidence of means** — era-matched, the
  replay reproduces the recorded opening move **exactly** on 30/35 (86%) and
  14/15 (93%), against 33/50 (66%) for the as-run arm.
- **§1 the 2×2 separates POLICY from CAST SET.** Each era's casts under both
  weightings: fixed-era 1.267 (as played) vs 0.800; posterior-era 1.114 vs
  0.743 (as played). Both rows move the same way, so it is the weighting.
- **§1 rule 10 applied to my own era marker.** `matcherWeight` first appears in
  session 51, so the split is corroborated on `ts`, which predates it: legacy
  rows all ≤ 2026-08-19T22:23:49Z, posterior all ≥ 2026-08-20T18:27:39Z,
  **zero interleaving**.
- **§1 `focusProfileCheck.ts` is era-aware and its gate now PASSES.** The
  corpus is **three** policy eras, printed on every run:

  | era | casts | opening | meter-out | catch |
  |---|---|---|---|---|
  | pre-logging (session 49's corpus) | 73 | 1.62 | 80.8% | 11.0% |
  | retired fixed-0.9 weighting | 15 | 1.67 | 53.3% | 33.3% |
  | **today's policy** | **35** | **0.83** | **34.3%** | **60.0%** |
  | pooled — session 70's target | 123 | 1.40 | 64.2% | 27.6% |

  Sim 0.77 is INSIDE today's-era [0.58, 1.08]; meter-out 33.9% vs 34.3%.
- **§2 GATE 2 — `src/sim/fishing/rodDeck.ts` + `tests/fishing/rodDeck.test.ts`.**
  `REAL_DECK` is `[1,2,3,4,5,6,74,75,76,78]` (Shroom, 811), defined ONCE and
  imported by all three scripts. The guard resolves the rod off the LATEST
  cast's own `GEAR_CID_array` and checks the table **against play** too — the
  granted prefix of that cast's `fullDeck`. Demonstrated failing on Makeshift
  before restoring (message names rod 811, cast 13024581), 8/8 after.
- **§3 the crit source is recorded as USER-STATED** in SPEC-fishing.md, with
  the 443-play zero-crit control alongside it and the Sticky Lure ambiguity
  intact. Not CONFIRMED.
- **§4 +19.40pp is SUSPENDED**, marked in `OIL-POLICY.md` §0a where the number
  lives *and* in `DECISIONS.md`, and struck through in both tables.

## What's broken
- **THE SIMULATOR'S CATCH RATE IS THE OPEN DISAGREEMENT, and it is WORSE than
  the one session 70 failed on.** Sim (live config) **24.7%** against today's
  era's **60.0%**. The focus profile agreeing does **not** clear the sim.
- **The gate PASSES on n=35, an interval 0.49 wide** — "not refuted at n=35",
  not "reproduced". Repeated here so a brief cannot quote the PASS alone.
- **The profile gate now SPANS THE MAKESHIFT/SHROOM DECK BREAK.** The sim arm
  is the Shroom deck as of this session's repoint; today's-era corpus is **20
  Makeshift casts and 15 Shroom** (opening spend 0.75 and 0.93). The verdict
  does not turn on which side you take, but the number is not deck-pure.
- **AN ERA IS A BUNDLE, NOT A KNOB** — zone map, matcher weighting, lures and
  rod all changed between them. The split proves a pooled comparison invalid; it
  does **not** prove any one change caused it. Only the 2×2 isolates the
  weighting, and only for the replay.
- **`focusBudget.ts`'s PREMISE is in question, not just its numbers.** It
  exists because meter-out was 80.8%; on the era the shipped policy plays it is
  **34.3%**, catch **60.0%**. In the module header. Nothing is wired live.
- **The sim's oil arm is UNCHANGED and still not this fishery** (meter-out
  1.0%, catch 69.7% post-repoint). §1 restored the *replay's* precondition;
  that licenses nothing about `castSim`'s bare-default arm.
- Carried: the `nextPosition` tripwire has still never met a real miss;
  distribution steps 3/4/6 remain the user's; the hardcoded-path ratchet is now
  **26** (rodDeck.ts documented in the allowlist — it caught the new module, as
  designed).

## Corrections to SPEC.md
- **SPEC-fishing.md §CRIT: the Steady Lure is USER-STATED**, not confirmed.
  The load-bearing evidence is still the control — **443 lure-free plays, 0
  crits, upper bound 0.86%**, below the stated 3%. The single crit falls inside
  the Steady+Sticky overlap; the 27 Steady-only plays hold none;
  `/offchain/static` has no effect field for 951 or 952.
- **Session 49's `focusBudget.ts` numbers were NOT STALE — session 70's
  correction was itself wrong.** 80.8% meter-out and opening spend 1.62 are
  *exactly* the pre-logging era of 73 casts, correct for the corpus they were
  computed on. The defect is **pooling, not age**, and the fix is different:
  do not recompute over everything, split by era.
- **A live/replay difference nobody had named:** `liveFishing.ts` **estimates**
  the sticky switch probability at load (0.0431, n=394); `offPolicyReplay.ts`
  takes the constant 0.05. Worth +0.000 here — documentation, not a bug.
- **`fullDeck`'s opening entries ARE the rod's grant** — the latest cast's
  20-card `fullDeck` opens with exactly the Shroom 10, rest is loot. The
  independent witness for the rod→deck rule.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Leave-one-out as the explanation for the replay gap. It is worth −0.020, in
  the wrong direction.** Do not re-open it; the measurement is in
  `replayGapDecomposition.ts` §4.
- **Truncation likewise: exactly 0.000.** It removes tail turns and structurally
  cannot touch turn 0. Measuring it was still right — it turns "probably
  irrelevant" into a number — but it was never going to be the cause.
- **Recomputing a corpus statistic over MORE casts is not the fix for a stale
  one.** Session 70 did that to session 49's numbers and produced a figure
  describing no policy at all. Split by era instead.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability
  guard; §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture`
  settled OFF; do not fold stock into the oil threshold.
- **`npx tsx` and `git` both fail under the command sandbox** on this machine.
  Run unsandboxed. Not a repo problem.

## Metrics
- **Live: 0 casts, 0 dungeon runs.** Ledgers unchanged start→end: fishing game
  **16/20** (4 remain, rollover 11:00 PT), dungeon **0/12** run-units.
- Corpus unchanged: 124 casts / 123 clean traces / 521 `playTurns`.
- Replay, era-matched: posterior era **0.829** vs live 0.829 (n=35, 86% exact);
  fixed era **1.600** vs live 1.667 (n=15, 93% exact).
- Sim (live config, n=4000, **Shroom deck** — post-repoint): opening spend
  **0.77**, meter-out **33.9%**, catch **24.7%**. Session 70's Makeshift-deck
  read of the same arm was 0.77 / 32.5% / 20.7%.
- Sim (bare default, synthetic fish — the oil sweeps' arm, post-repoint):
  opening 0.64, meter-out **1.0%**, catch **69.7%**. Still not this fishery.
- **Suite 1360 → 1368.** New: `rodDeck` 8.

## Open questions for Claude
1. **The sim's CATCH RATE is the open gap: 24.7% vs today's era's 60.0%.** A
   bigger disagreement than the focus profile ever was, and NOT an era artefact
   — it is measured on the era the policy plays. Is closing it the next
   session's work, and what gate would be set on something the agent controls
   (rule 6)?
2. **Should the focus-budget families be swept at all now?** Built for a 80.8%
   meter-out fishery; today's era is 34.3% with catch 60.0%. The arms are no
   longer *known-unexercised* — but today's policy really does spend only ~0.83
   on the opener, so `costCap(2)` still has nothing to cap. **A finding, not a
   measurement failure.**
3. **Is the era split worth making a first-class corpus concept?** Three
   analyses have now been invalidated by pooling; a shared `eraOf(cast)` would
   make the question cheap instead of re-derived per script.
4. **What re-derives +19.40pp?** It needs a sim arm passing a profile check, and
   the bare-default arm is nowhere near one (catch 69.7% vs 27.6%). Worth a
   session, or is the oil decision made on live evidence instead?
5. Carried: separate the crit source with one-lure-only casts? Recalibrate
   `REDRAW_THRESHOLD` — §1 restored the instrument it was waiting on. Should
   `preflight.ts` run in CI (open since session 68)?

## Files changed
```
 3 commits (d67aa87, b1ff5fc, f91cafb). 14 files, +903 -58.

  NEW  scripts/replayGapDecomposition.ts        237  GATE 1
  NEW  handoff/reports/session-71-replay-gap.md 171  the gate-1 argument
  NEW  src/sim/fishing/rodDeck.ts               158  GATE 2
  NEW  tests/fishing/rodDeck.test.ts             96  GATE 2, the ratchet
       scripts/focusProfileCheck.ts            +129  era-aware; gate now PASSES
       handoff/OIL-POLICY.md                    +30  §0a SUSPENDED
       src/strategy/fishing/focusBudget.ts      +27  the era split, and the premise
       handoff/reports/session-70-focus-profile.md +24  SUPERSEDED IN PART
       scripts/{fishingEmpiricalAblation,focusReserveAblation}.ts +45  REAL_DECK
       handoff/DECISIONS.md                     +16  §4 + the era rule
       scripts/critByGear.ts                    +14  shares rodDeck's constants
       SPEC-fishing.md                           +8  crit source: user-stated
       tests/noHardcodedPaths.test.ts            +6  rodDeck documented (ratchet 26)
```
