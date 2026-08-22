# Session 71 — 2026-08-21 — the replay gap decomposed, REAL_DECK repointed

**GATE 1 PASS. GATE 2 PASS.** Zero casts, zero dungeon runs. See
`handoff/STATE.md` for the summary and
`handoff/reports/session-71-replay-gap.md` for the full gate-1 argument.

---

## A. Ledgers, start and end — identical

```
doctor: token valid another 162.1h; authenticated as <USER> — <ADDR>
  dungeon: 0 runs / 0 energy recorded
  fishing: 15 casts / 180 energy recorded

checkFishingCaps:  GAME 16/20 (pond 2)   REPO 15   VERDICT: 4 available
checkDungeonToday: dungeonId 5 dayProgressEntities = null  (0 of 12 units)
```

Read again at recap: byte-identical. **Nothing was spent.**

One observation, not a bug: `checkFishingCaps.ts` reports the 16-vs-15
disagreement and says it defers, but it does **not persist** the corrected
count — session 70 wired `reconcileFishingLedger` inside `runOneCast`, not into
the check script. So the repo file still reads 15 and will be corrected on the
next real cast. Correct by design; noted because the check's wording ("raised
the repo counter") reads as if it wrote something.

---

## B. GATE 1 — full output of `scripts/replayGapDecomposition.ts`

```
  ── 0. the statistic, measured three ways
    LIVE   (ringPrediction focusMoveCost)      1.080  [0.82, 1.34]  n=50
    RECORDED, same 50 casts (off the traces)   1.080  [0.82, 1.34]  n=50
    RECORDED, all 123 clean traces             1.398  [1.23, 1.56]  n=123

  ── 1. live's 1.08 is not one policy — it pools two
    played under the FIXED 0.9 weight (retired) 1.667  [1.14, 2.20]  n=15
    played under TODAY's posterior weighting    0.829  [0.58, 1.08]  n=35
    pooled — the number session 70 compared to  1.080  [0.82, 1.34]  n=50
    era boundary, on `ts` (PREDATES `matcherWeight` — rule 10):
      last fixed-era row  2026-08-19T22:23:49.089Z
      first posterior row 2026-08-20T18:27:39.808Z   (zero interleaving)

  ── 2. the 2x2 — same casts, both weightings
                              replay w/ FIXED      replay w/ POSTERIOR
    fixed-era casts  (n=15)     1.267 <- as played     0.800
    posterior-era casts (n=35)  1.114                  0.743 <- as played

  ── 3. decomposition of the 0.348 gap, one toggle at a time
    session 70's as-run arm (all 123, re-mined, posterior) 0.732
    + cast set: the 50 live actually logged     0.732 -> 0.760   +0.028
    + matcher library: live's loaded 3 patterns 0.760 -> 0.840   +0.080
    + matcher weighting: each cast's OWN era    0.840 -> 1.060   +0.220
                                                        target   1.080
    RESIDUAL, unexplained                                        +0.020

  ── 4. the conservatisms the brief named — MEASURED, and both are ~nil
    leave-one-out ON  (as run)                   0.760
    leave-one-out OFF (models see the cast)      0.740   -0.020
    truncation at the recorded length            exactly 0.000
      (0/123 casts lose their turn-0 observation)
    sticky switch prob: shipped 0.05 -> live's 0.0431   +0.000

  ── 5. the match is PER-CAST
    era-matched, posterior era   paired Δ  0.000 [-0.16, 0.16] n=35  30/35 (86%)
    era-matched, fixed era       paired Δ -0.067 [-0.20, 0.06] n=15  14/15 (93%)
    session 70's as-run arm      paired Δ -0.320 [-0.53, -0.11] n=50 33/50 (66%)

  ── 6. the precondition, restated against the policy that actually ships
    TODAY's policy, live:   0.829  [0.58, 1.08]  n=35
    the replay, as run:     0.732 (all 123)   0.760 (the live 50)
    => INSIDE today's-policy interval.
```

The mined library live loads is **3** patterns: `perimeterWalk(cw)`,
`perimeterWalk(ccw)`, `bounce(2,0)`. The replay's `matcherTier:"loo"` re-mines
its own per fold and never reads `data/minedFishPatterns.json` — that is the
+0.080 term, and session 52 had already built `matcherLibrary` for exactly this
without anyone connecting it to the spend gap.

---

## C. GATE 1's second half — `focusProfileCheck.ts` now era-aware

```
  CORPUS — today's policy era
    focus:  3.00 2.17 1.45 0.83 0.69 0.38 0.43 0.50 1.00 0.50 0.00
    meter-out 34.3%  catch 60.0%  opening 0.83  turns at focus 0 21.3%  casts 35
  CORPUS — retired fixed-0.9 era
    focus:  3.00 1.33 0.73 0.50 0.38 0.00 0.00 0.00 0.00 0.00 0.00
    meter-out 53.3%  catch 33.3%  opening 1.67  turns at focus 0 56.8%  casts 15
  CORPUS — pre-logging era (session 49's 73)
    focus:  3.00 1.38 0.72 0.36 0.14 0.04 0.00 0.00 0.00 0.00 0.00
    meter-out 80.8%  catch 11.0%  opening 1.62  turns at focus 0 50.4%  casts 73

  SIM — live config (Shroom deck, post-repoint)
    meter-out 33.9%  catch 24.7%  opening 0.77   n=4000
  SIM — bare default (the oil sweeps' arm)
    meter-out  1.0%  catch 69.7%  opening 0.64   n=4000

── §4  VERDICT ──
  corpus, TODAY's era   0.83  95% CI [0.58, 1.08]  n=35    <- the gate
  corpus, POOLED        1.40  95% CI [1.23, 1.56]  n=123   <- session 70 used this
  sim    opening spend  0.77  95% CI [0.75, 0.79]  n=4000
  PASS
```

**Session 49's header numbers are the pre-logging row, exactly.** 80.8% and
1.62. They were never stale; they were correct for their corpus. Session 70
"corrected" them by pooling, which produced a figure describing no policy.

**The sim arm's own numbers moved with the repoint** (Makeshift → Shroom):
meter-out 32.5% → 33.9%, catch 20.7% → 24.7%; opening spend stayed 0.77. Any
comparison against session 70's sim figures spans the deck break.

---

## D. GATE 2 — the ratchet, demonstrated failing

With `CURRENT_ROD` flipped back to Makeshift:

```
 ❯ tests/fishing/rodDeck.test.ts (8 tests | 3 failed)
     × CURRENT_ROD is that rod
     × REAL_DECK is that rod's CARD_CID_array
     × the grant table agrees with PLAY, not just with /offchain/static

AssertionError: the account is holding rod 811 as of cast 13024581
(2026-08-21T22:01:54.124Z), but CURRENT_ROD is 922. Repoint it — and date every
figure computed on the old deck as pre-repoint rather than restating it as
current.
```

Restored: 8/8. The latest cast's `fullDeck` is 20 cards —
`[74,75,76,78,1,2,3,4,5,6,34,7,36,10,38,41,39,49,48,36]` — whose first ten sort
to exactly the Shroom grant `[1,2,3,4,5,6,74,75,76,78]`; the rest is loot. That
prefix is the independent witness that `/offchain/static`'s `CARD_CID_array` is
right about the rod→deck rule.

`tests/noHardcodedPaths.test.ts` caught `rodDeck.ts`'s default fixtures path on
the first full-suite run — the ratchet working exactly as intended. Documented
in the allowlist alongside `castTrace.ts` (same tree, same reason) rather than
profile-resolved: "which rod is the account holding" is a fact about the
recorded corpus, not something a `--profile` run should redirect. Ratchet 25→26.

---

## E. Surprises worth keeping

1. **The brief's leading hypothesis was wrong, and measuring it took one arm.**
   Leave-one-out is worth −0.020. Had the session "found a plausible cause and
   stopped" — which the brief explicitly warned against — LOO is exactly the
   cause it would have found and asserted.
2. **The instrument that looked broken had been reproducing live all along.**
   86% exact per-cast agreement was sitting there behind a pooled target.
3. **Session 70's "these numbers are stale" correction was itself the same
   mistake one level up.** Recomputing over a bigger corpus felt like rigour and
   produced a number describing no policy that ever played.
4. **Truncation's zero was predictable from the mechanism.** Worth measuring,
   but noticing that truncation removes *tail* turns is cheaper than running it.
5. **`liveFishing.ts` estimates the sticky switch probability at load and the
   replay does not.** A genuine live/replay divergence nobody had written down,
   found only because the decomposition enumerated everything rather than
   testing the named candidates. Worth +0.000 — but the next such difference
   might not be.
