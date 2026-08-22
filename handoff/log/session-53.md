# STATE — session 53 — 2026-08-20 — commit 1928c16

## Status
Session-53 brief: **all eight items delivered. GATE PASS.**
The gate was zero path-selection first-attempt rejections across ~26 live
decisions, against a current rate of 100%. Result: **24 decisions, 0
rejections.**

Two questions the last two sessions carried are now CLOSED (§21, §22), and the
session's central finding is that **session 52's diagnosis of §21 was wrong in
both directions** — the server never changed, and the fix was not an envelope
change but a delay.

Next: §19 (matcher drop-vs-mix) finally has its de-aliased library and needs a
live fishing batch, which the 11:00 PT cap reset makes possible.

## What works
- **§0c the pacing fix, LIVE, GATE PASS.** `RequestPacing.minGapSinceResponseMs
  = 4000` on `reward_*`/`path_*` only (`liveRun.ts`'s `pacingForAction`).
  **24 path-selection decisions across two runs, 0 first-attempt rejections**
  (historical: 66/66 = 100%). Direct proof it lands, measured `post` → outcome:
  empty-token 0.72–1.78s → **4.21–4.55s**, numeric-token unchanged at
  1.02–1.71s. Envelope byte-identical; `postWithVerifiedRetry` untouched.
- **§0d `scripts/rejectionAudit.ts`**, run over all 13 run logs. Reproduces and
  sharpens the split: the 132 historical empty-token POSTs are **66 DECISIONS
  each sent twice**, so the rate is 66/66 = 100%, not 66/132 = 50%.
- **§1 `src/orchestrator/attemptTelemetry.ts`** — first-attempt failures per
  class, counted even when the retry succeeds, printed in the run summary
  (including on the failure path), WARN at ≥20%. Both runs reported 0/31 and
  0/59 across all classes.
- **§3 `maxSnapshot`/`headroom`/`overflowReachable` in `claim_audit`.**
  **315 < 394** on both runs → no single claim this path can make can reach the
  cap. The overflow question is closed by construction for this code path.
- **§4 de-aliasing, shipped.** Pool 23 → 18, library 4 → 3 patterns.
- **§6 `scripts/boonCoverage.ts`** — reports both coverage directions.
- **Two live juiced Tier-3 runs.** Run 2 reached **room 10 / score 8112 / loot
  687** — the deepest and highest-scoring run in this corpus by a wide margin
  (prior best: room 8 / 6864 / 420).
- **Tier enumeration held: 12/12 decisions took the lowest offered tier**, and
  **5 of 12 rooms offered no Safe tier at all**.
- Suite **862/862** (was 806), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final commit. No test writes to a real data path.

## What's broken
1. **§23 — three consecutive juiced runs under-report energy spend by exactly
   1.** `observedDelta` 59 vs `committedDelta` 60, `drifted: true`, same
   direction every time (session 52 run 1; session 53 runs 1 and 2). **Not
   regen** — regen at 18/hr over a ~2-minute run is ~0.6 and would not land on
   exactly −1 three times. Conservative in the safe direction (the guard
   enforces off committed spend), so nothing is at risk, but it is systematic
   and unexplained. Resolvable with a zero-energy read. QUESTIONS.md §23.
2. **Enemy Room 71 (room 9) is captured UNCLEAN and cannot be modelled.**
   Room 9 offered tiers `[1,1,1]` — no Safe — so the capture carries
   `bloodthirsty` (+4 ATK all moves) and non-zero rolled stats. Its move
   numbers include the buff. `unmodelled: ["ROLLED_STATS","ENEMY_BUFF"]`.
3. **This session's own corpus growth lowered one sim arm's
   `deepestScorableRoom` from 5 to 4** (verified by stashing; deterministic
   across three runs). The 12 new offers introduced three new UNMODELLED types
   at rooms 3/4, so more simulated runs go unscorable earlier. Honest capture
   reducing a coverage metric — not a code regression — but Task 4.5's old gate
   sat exactly at 4.
4. **36 boon types have been OFFERED with no `BOON_MODELS` entry.** This is the
   real untested surface (see Corrections — the brief asked about the opposite
   gap, which is now empty).

## Corrections to SPEC.md
- **SPEC §2's session-52 correction is itself SUPERSEDED and the block is
  rewritten.** "This is a server-side change" is **refuted by the same logs
  session 52 cited**. Counting `post_attempt_failed` on `reason` — a field
  populated on BOTH sides of session 47/51's `serverErrorDetail` fix — the
  2026-08-18 logs hold **40 rejections in 40 decisions**, the identical 100%.
  Session 52 grepped for `"Invalid action token"`, a string that could not
  exist before 2026-08-19, and read *newly visible* as *new*.
  `actionToken: ""` is CONFIRMED and correct; it was only being sent too soon.
- **CLAUDE.md gains rule 10** for the general trap: a logging fix creates a
  false discontinuity in your own history. Date an effect on a field that
  predates the instrumentation change, or say plainly that you cannot.
- **The brief's §0c number was on the WRONG CLOCK.** It measured the split as
  gap-since-RESPONSE, then proposed it as `minGapMs`, which `RateLimiter`
  applies REQUEST-to-request (`lastCallAt` is stamped before dispatch). The two
  differ by one response latency (0.72–1.78s, median 1.45, n=296), so 3600ms
  would have left ~1.8s since the response in the worst case — inside the
  reject band — and would very likely have failed the brief's own gate. Caught
  before the runs, from the brief's own data.
- **The brief's §6 list is EMPTY, and the gap runs the other way.** ZERO of 17
  modelled boons remain unoffered in room 1; session 52's own `AddMaxHealth`
  capture closed the last wall-1 hole. That mechanism cannot recur until
  something new is added to `BOON_MODELS`.
- **§22 was FIVE aliases, not one pair.** Session 52 saw only the pair that
  cleared the promotion threshold. `bounce(-2,0)==bounce(2,0)`,
  `bounce(0,-2)==bounce(0,2)`, and all three of `bounce(2,-2)`/`bounce(-2,2)`/
  `bounce(-2,-2)` `==bounce(2,2)`.
- **`rejectionAudit`'s gap is measured at LOG-WRITE time, not dispatch.**
  `liveRun.ts` writes `post` before calling the client and the limiter sleeps
  inside it. Historically the sleep was ~0–0.2s so the bands are near the
  dispatch truth; AFTER this session's fix they are not. Use `post → outcome`
  to see pacing.
- **The action token cannot be used as an absolute clock.** It is a ms epoch,
  but `token_epoch − dispatch_ts` runs 0.70–2.68s (median 1.93) — larger than
  the full round trip. The server clock is ~1.5–2s ahead of this machine. All
  timing conclusions here are anchored on LOCAL response timestamps only.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: **PRESENT** — `currentCharges`/`maxCharges` on every move of
  both combatants across both runs, including the new rooms 9 and 10.

## Dead ends
- **Do not gate a de-aliasing change without a raw BEFORE arm.** Loading the
  pre-dedup library through the new `resolvePatternsByName` collapses the
  duplicate and turns the comparison into 3-vs-3, scoring ΔlogLoss exactly
  0.0000 — a clean-looking "no change" that measured nothing. The gate needs
  `--before-raw`.
- **Do not re-run the numeric-token experiment §21 proposed.** It would change
  a confirmed envelope to fix a problem that was never in the envelope, and it
  costs a 60-energy entry. The logs answered it for free.
- **`npx tsx -e` cannot resolve this project's relative imports.** Write a temp
  file under `scripts/` instead.
- Standing, unchanged: do not rebuild the expected-coverage focus objective
  (50); do not tune focus spend quantity again (48, 49, 50); replay for
  DIFFERENCES never absolutes (48); do not take the bare log-loss argmin on a
  smoothing sweep (51); never pipe a live run to a truncating reader (52).

## Metrics
- **Live dungeon: 2 juiced Tier-3 runs, 120 energy, 0 clears.**
  | run | death | score | loot (846) | juices | decisions | 1st-attempt rejections | rooms w/ no Safe |
  |---|---|---|---|---|---|---|---|
  | 1 | room 4 | 2976 | 84 | 3/3 | 6 | **0** | 2 of 3 |
  | 2 | **room 10** | **8112** | **687** | 3/3 | 18 | **0** | 3 of 9 |
- **§0c gate, pooled: 24 empty-token decisions, 0 rejected. Historical 66/66
  (100%) over ten pre-fix logs.**
- **Rejection audit, ten pre-fix logs:** empty-token rejected n=66 gap
  0.90–1.54s (med 1.28); empty-token accepted n=66 gap 3.40–4.92s (med 4.07);
  numeric n=224, 0 failures, 0.90–1.79s (med 1.36); `start_run` 4/4 accepted.
  Zero overlap → threshold in (1.54, 3.40) s since the response.
- **§4 replay gate, 88 clean traces, 292 paired turns, cluster bootstrap over
  casts:** ΔlogLoss **−0.0017, 95% CI [−0.0063, +0.0033]**, caught 27 → 24.
  INERT, shipped as a correctness fix to the prior, not a prediction gain.
- **Mined library at 89 casts: 3 patterns** — perimeterWalk(cw) 4,
  perimeterWalk(ccw) 4, bounce(2,0) 3 → **11 distinct supporting casts of 89,
  π₀ ≈ 0.133 (unchanged)**; candidate mass on the oscillation hypothesis
  2/4 → 1/3.
- **ROM claims:** run 1, 4 claims ascending, snapshot 54, measured +54, drift 0.
- **Guard: 240/240 energy, 12/12 runs — both caps exactly exhausted** for the
  day ending 11:00 PT 2026-08-20.
- **Live fishing this session: 0 casts** (cap was 20/20 for the same day).
- Corpus: dungeon 53 → **55 attempts**; fishing unchanged at 89 traces.
- Suite 806 → **862**.

## Open questions for Claude
1. **§23 — the −1 energy drift, 3/3 in the same direction.** The cheap
   resolution needs no extra entry: read `GET /offchain/player/energy`
   immediately before and after a juiced `start_run` with nothing else in
   flight, and compare against the same pair around a PLAIN 20-energy run. If
   plain drifts 0 and juiced drifts −1 it is the multiplier; if both drift −1
   it is the read. Should the next run carry this?
2. **§19 is finally unblocked and needs a fishing batch, not an argument.**
   Session 51's decision rule stands; the library it runs against is now the
   3-pattern de-aliased one recorded above. Record support counts at batch time.
3. **Should the default claim order switch to descending now?** §3's blocker is
   gone: `maxSnapshot` 315 < `headroom` 394 means no single claim can reach the
   cap, so descending cannot trip the untested overflow comment by accident.
   Ascending has now been exercised twice with drift 0.
4. **Room 9 needs a Safe capture to become modellable.** Its only capture is a
   forced Risky (tiers `[1,1,1]`). Worth targeting, or leave it unscorable?
5. **36 boon types are offered but unmodelled.** Is any subset worth modelling
   deliberately, or does this stay opportunistic? A known list now exists
   (`scripts/boonCoverage.ts`).
6. **Pre-existing, not introduced this session:** tracked fixtures redact
   `PLAYER_CID` to `0xUSER` but keep `NOOB_TOKEN_CID` as its real value, on a
   public repo, and have since session 08. Deliberate?

## Files changed
```
 2 commits, 26 files changed, ~1340 insertions, ~90 deletions (+ 194 new fixtures)

     QUESTIONS.md                               | 135  (§21/§22 resolutions, §23 new)
     src/sim/fishing/patterns.ts                | 141  (§4 de-aliasing + resolver)
     scripts/rejectionAudit.ts                  | 288  (§0d, new)
     src/orchestrator/attemptTelemetry.ts       | 104  (§1, new)
     scripts/liveRun.ts                         | 118  (§0c pacing, §1/§3 wiring)
     src/api/client.ts                          |  75  (RequestPacing, response clock)
     src/orchestrator/energyPreflight.ts        |  60  (§3 maxSnapshot/headroom)
     SPEC.md                                    |  65  (§2 correction superseded)
     tests/*                                    | 300+ (rejectionAudit, attemptTelemetry,
                                                        patternDedup, client pacing,
                                                        preflight headroom, corpus pins)
     scripts/boonCoverage.ts                    | 100  (§6, new)
     src/sim/enemies.ts                         |  47  (rooms 9, 10)
     src/sim/boons.ts                           |  64  (12 offers, rooms 1-9)
     CLAUDE.md                                  |  16  (rule 10)
```

---

# Appendix — session 53 verbose

## A1. The §21 refutation, per-file

`post_attempt_failed` rows with `reason: "reward selection rejected"`.
Counted on `reason`, NOT on the error text — the text only exists after
session 47/51's `serverErrorDetail` fix, which is the whole trap.

```
run-2026-08-18-19-50-13.jsonl               12
run-2026-08-18-21-15-24.jsonl               10
run-2026-08-18-22-00-26.jsonl               10
run-2026-08-18-22-07-12.jsonl                8
run-2026-08-20-00-30-48.jsonl               14
run-2026-08-20-00-45-19.jsonl                2
run-2026-08-20-00-46-46.jsonl               10
```

The two eras, side by side, showing what changed was the RECORDING:

```
2026-08-18 row: {"ts":...,"event":"post_attempt_failed",
                 "reason":"reward selection rejected",
                 "error":"Unexpected response from /game/dungeon/action: HTTP 500"}
                 <- no `body` field at all

2026-08-20 row: {..., "reason":"reward selection rejected",
                 "body":"{\"success\":false,\"message\":\"Error tracking action\",
                          \"error\":\"Invalid action token  != 1787185878470\",
                          \"actionToken\":\"\"}"}
```

## A2. Full rejection audit, all 13 run logs
```

▸ rejection audit over 13 run log(s), 461 POSTs

  class                POSTs  decisions    1st-fail  rejected gap                    accepted gap                    post->outcome (incl. pacing)
  numeric token          299        299      0 (0%)  —                               0.90 – 1.79 s (med 1.36, n=296) 1.02 – 1.76 s (med 1.44, n=298)
  empty token            156         90    66 (73%)  0.90 – 1.54 s (med 1.28, n=66)  1.06 – 4.92 s (med 3.95, n=90)  0.72 – 4.55 s (med 1.48, n=156)
  start_run (empty)        6          6      0 (0%)  —                               —                               1.42 – 1.72 s (med 1.56, n=6)

  per file:
    logs/run-2026-08-18-19-50-13.jsonl         74 POSTs,  12 first-attempt failures
    logs/run-2026-08-18-21-15-24.jsonl         57 POSTs,  10 first-attempt failures
    logs/run-2026-08-18-21-59-34.jsonl          0 POSTs,   0 first-attempt failures
    logs/run-2026-08-18-22-00-26.jsonl         53 POSTs,  10 first-attempt failures
    logs/run-2026-08-18-22-07-12.jsonl         48 POSTs,   8 first-attempt failures
    logs/run-2026-08-19-23-56-06.jsonl          0 POSTs,   0 first-attempt failures
    logs/run-2026-08-20-00-30-09.jsonl          0 POSTs,   0 first-attempt failures
    logs/run-2026-08-20-00-30-48.jsonl         65 POSTs,  14 first-attempt failures
    logs/run-2026-08-20-00-45-19.jsonl          9 POSTs,   2 first-attempt failures
    logs/run-2026-08-20-00-46-46.jsonl         57 POSTs,  10 first-attempt failures
    logs/run-2026-08-20-01-33-13.jsonl          0 POSTs,   0 first-attempt failures
    logs/run-2026-08-20-01-34-29.jsonl         35 POSTs,   0 first-attempt failures
    logs/run-2026-08-20-01-38-20.jsonl         63 POSTs,   0 first-attempt failures

```

## A3. The two session-53 runs only — the gate
```

▸ rejection audit over 2 run log(s), 98 POSTs

  class                POSTs  decisions    1st-fail  rejected gap                    accepted gap                    post->outcome (incl. pacing)
  numeric token           72         72      0 (0%)  —                               1.14 – 1.59 s (med 1.38, n=72)  1.02 – 1.71 s (med 1.41, n=72)
  empty token             24         24      0 (0%)  —                               1.06 – 1.52 s (med 1.30, n=24)  4.21 – 4.55 s (med 4.28, n=24)
  start_run (empty)        2          2      0 (0%)  —                               —                               1.68 – 1.72 s (med 1.68, n=2)

  per file:
    logs/run-2026-08-20-01-34-29.jsonl         35 POSTs,   0 first-attempt failures
    logs/run-2026-08-20-01-38-20.jsonl         63 POSTs,   0 first-attempt failures

```

## A4. Boon coverage, both directions
```

▸ boon coverage — 17 modelled, 49 room-1 offers of 135 total

  MODELLED but never offered in ROOM 1 (0) — wall-1 holes waiting to happen:
    (none — every modelled boon has appeared in a room-1 offer)

  MODELLED but never offered ANYWHERE (0):
    (none)

  OFFERED but NOT modelled (36) — the opposite gap:
    AddBurnMagic, AddBurnShield, AddLifestealShield, AddLifestealSword, AddVulnerableMagic, AddVulnerableShield, AddVulnerableSword, AddWeakMagic, AddWeakShield, AddWeakSword, ArmorDepletedVulnerable, BurnMastery, BurningBlock, BurningCrit, BurningEvade, BurningTenacity, CorrosiveSword, CritHeal, IntuitionArmor, LossBlockUp, LossIntuitionUp, LossLuckUp, Regen, RegenMastery, SecondWind, Thorns, TieDamageReduction, TieVulnerable, TieWeak, Vengeance, VulnerableBlock, VulnerableMastery, WeakeningBlock, WeakeningCrit, WeakeningMastery, WeakeningTenacity

```

## A5. §4 replay gate, the real arm

The BEFORE arm must be loaded with `--before-raw`. Without it,
`resolvePatternsByName` collapses the duplicate and the comparison becomes
3-vs-3, scoring exactly 0.0000 — a clean-looking null result that measured
nothing at all.

```
▸ minedLibraryGate — 88 clean traces
  BEFORE: 4 pattern(s) — perimeterWalk(cw), perimeterWalk(ccw), bounce(2,0), bounce(-2,0)
  AFTER : 3 pattern(s) — perimeterWalk(cw), perimeterWalk(ccw), bounce(2,0)

  BEFORE  caught 27/88   hits 143/296   matcher-active turns 136 (median weight 0.135)
  AFTER   caught 24/88   hits 139/302   matcher-active turns 138 (median weight 0.135)

  paired ΔlogLoss (AFTER − BEFORE), 292 turns in 88 casts:
    -0.0017  95% cluster-bootstrap CI [-0.0063, 0.0033]

  VERDICT: CI includes zero — not measurably better OR worse on log loss.
  caught: 27 -> 24
```

Shipped anyway, per the brief: it is a correctness fix to the matcher's PRIOR
(the oscillation hypothesis held 2/4 of the candidate mass, now 1/3), not a
prediction improvement, and must not be argued as one. The −3 catch move sits
inside the same noise band session 52 measured across three indistinguishable
libraries (24 / 26 / 27 at n=88).

The full alias set at gridSize 4 — five of twenty-three primitives:

```
bounce(-2,0)   == bounce(2,0)
bounce(0,-2)   == bounce(0,2)
bounce(2,-2)   == bounce(2,2)
bounce(-2,2)   == bounce(2,2)
bounce(-2,-2)  == bounce(2,2)
```

## A6. Proof the pacing lands on the intended class only

Measured `post` log-write → outcome, which INCLUDES the rate limiter's sleep.
(The audit's `sinceLastResponseMs` is measured at log-write time and therefore
does NOT show the sleep — see Corrections.)

```
BEFORE (session 52 run 1)   empty-token n=28  0.72 – 1.78 s (med 1.42)
                            numeric     n=36  1.16 – 1.67 s (med 1.45)

AFTER  (session 53 run 1)   empty-token n= 6  4.24 – 4.55 s (med 4.27)
                            numeric     n=28  1.03 – 1.71 s (med 1.42)
```

## A7. Live tier decisions, run 2 (nine rooms)

`pickLowestTier()` took the minimum offered tier in all nine. Three rooms
offered no Safe at all; room 9 offered `[1,1,1]`, which is why Enemy Room 71's
only capture is contaminated.

```
 1  enemy 64  took 1 (Risky)  offered [2,2,1]  safeOffered=False  buff withering
 2  enemy 65  took 0 (Safe)   offered [2,0,1]  safeOffered=True
 3  enemy 66  took 0 (Safe)   offered [1,2,0]  safeOffered=True
 4  enemy 67  took 0 (Safe)   offered [0,1,2]  safeOffered=True
 5  enemy 68  took 0 (Safe)   offered [1,0,1]  safeOffered=True
 6  enemy 69  took 0 (Safe)   offered [0,1,2]  safeOffered=True
 7  enemy 70  took 1 (Risky)  offered [1,2,2]  safeOffered=False  buff regenerating
 8  enemy 71  took 1 (Risky)  offered [1,1,1]  safeOffered=False  buff bloodthirsty
 9  enemy 72  took 0 (Safe)   offered [0,1,2]  safeOffered=True
```

## A8. New enemy captures

```
Enemy Room 71 (room 9, RISKY — no Safe offered)   NOT CLEAN
  hp 55/55  armor 25/25
  rock 24/8   paper 22/7   scissor 21/10      <- INCLUDES bloodthirsty (+4 ATK)
  rolled { evasion 3, block 1, lck 2, tenacity 2 }
  unmodelled: ["ROLLED_STATS", "ENEMY_BUFF"]

Enemy Room 72 (room 10, SAFE)                     CLEAN
  hp 58/58  armor 28/28
  rock 22/6   paper 20/10  scissor 16/12
  rolled all zero, enemyBuff null
```

## A9. The −1 energy drift, three for three

```
session  run  before  after  observed  committed  drift
   52     1      —      —       59         60      -1
   53     1     80     21       59         60      -1
   53     2     79     20       59         60      -1
```

Not regen: regen ADDS (which is the right sign) but at 18/hr over a ~2-minute
run is ~0.6 energy, and would not land on exactly −1 three times running.
See QUESTIONS.md §23 for the zero-energy resolution.
