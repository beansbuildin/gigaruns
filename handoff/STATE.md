# STATE — session 52 — 2026-08-19 — commit 6985ff5

## Status
Session-52 brief: **all six items delivered.** The two things this session
existed to prove both PASS: the ROM-claim path executed against the live API
for the first time (clean, twice), and two juiced Tier-3 runs exercised the
tier enumeration and in-run decision points that nine sessions of drift had
never touched.

Next: **a server-side change is rejecting every path-selection POST on its
first attempt, and it is invisible unless you read the log by hand.**

## What works
- **§1 the ROM-claim path, LIVE, twice, drift 0.** Wired in session 47, never
  once executed until now. Run 1: pool 8, deficit 52, bank 2499 across 27/37
  ROMs; claimed 3777(13) + 7959(26) + 2114(30) ascending → pool 77, **measured
  delta +69 == snapshot total 69**, all three ROMs read `energyCollectable: 0`
  after. Run 2: pool 22, deficit 38, one claim (2097, snapshot 50) → pool 72,
  **delta +50, drift 0**. No under-credit, no zero-credit claim.
- **§1a `ensureEnergyFor(required, deps, { order, maxClaims })`.** Default
  `"descending"`; omitting both is byte-for-byte session-47 behaviour
  (`maxClaims` defaults to `Infinity`, so its `>=` never fires and the fallback
  is unreachable). Bounded-and-still-short claims the LARGEST remaining ROM and
  logs the fallback. `liveRun.ts --claim-order=ascending|descending`.
- **§1c claim audit** in `liveRun.ts`: measured delta vs snapshot total, the
  drift between them, an explicit warning on NEGATIVE drift, and per-ROM
  post-claim `energyCollectable` re-read from the bank. Logged as `claim_audit`.
- **§3 two juiced Tier-3 runs, 3 heal juices each, all 6 consumed.**
  Run 1: **death @ room 8**, score 6864, loot 420 — deepest and
  highest-scoring run in this corpus (prior best: room 7, 6048/309).
  Run 2 (after the user's manual level-up): **death @ room 7**, score 4896,
  loot 309. `dayProgressEntities` Dungeon#5 0 → 3 → 6; a juiced run costs 3 of
  the daily 12. Guard ledger 120 energy / 6 runs of 240 / 12.
- **TIER ENUMERATION IS EXERCISED — eight sessions of drift discharged.**
  13/13 rooms routed through `pickLowestTier()`; tier taken == lowest offered
  in all 13. **4 of those rooms offered NO Safe tier at all**, where the STRICT
  `pickSafeTier()` would have halted the run for zero loot benefit. CLAUDE.md
  §8's other claim also re-held: `lootTable` is byte-identical across all three
  offered tiers in all 13 rooms (same NAME_CID / ID_CID / item 846 / weight /
  amount).
- **§4 re-mined library shipped** (2 → 4 patterns) with the gate the brief
  asked for — after building the arm that made it measurable at all.
- Suite **806/806** (was 786), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final commit. No test writes to a real data path.

## What's broken
1. **Every path-selection POST is rejected on first attempt — 26/26 — and it
   is NEW.** `reward_*`/`path_*` send the DevTools-confirmed `actionToken: ""`
   and get `HTTP 500 "Invalid action token  != <outstanding numeric token>"`;
   the **byte-identical retry ~1.5s later always succeeds**. Combat moves
   (numeric token) succeed first time, always. The four 2026-08-18 run logs
   have 40 path-selection decisions and **zero** rejections, and no envelope
   code changed in between — so the server changed. Runs still complete, but
   it wastes a request per decision and eats `maxConsecutiveActionFailures`
   (3), of which a reward→path boundary already consumes 2. **Not fixed** —
   changing a confirmed envelope on a guess is what CLAUDE.md §2 forbids.
   QUESTIONS.md §21, SPEC.md correction committed.
2. **The re-mined library is not measurably better than the one it replaced.**
   ΔlogLoss −0.0041, 95% cluster CI **[−0.0355, +0.0177]** — includes zero.
   Shipped per the brief's own rule (don't ship only if WORSE with a CI
   excluding zero), not because it was shown to help.
3. **The two new patterns are exact aliases.** `bounce(2,0)` and `bounce(-2,0)`
   produce byte-identical trajectories on all three supporting casts (on a
   4-wide grid a ±2 step reflects immediately). The library doubled but added
   ONE hypothesis, and the matcher now holds two identical candidates, so that
   hypothesis takes 2/4 of the initial mass instead of 1/3. QUESTIONS.md §22.
4. **A rejection-rate blind spot.** Item 1 was found by reading a JSONL log by
   hand. Nothing in the run summary reports that 100% of a decision class
   failed on first attempt. A run that "succeeded" can hide anything the retry
   loop absorbs.

## Corrections to SPEC.md
- **SPEC §2 "path-selection actions don't use a numeric token at all" is now
  contradicted by the server.** The empty string is rejected on first attempt,
  26/26. Correction block committed to SPEC.md with the timeline and the
  before/after rejection rates. Envelope deliberately unchanged.
- **The brief's "pool at 3/420" was wrong** — live read **8/420** at run 1 and
  22/420 at run 2 (regen 18/hr since the user's drain). The bank was **2499**,
  not the 2480 session 51 recorded. CLAUDE.md §9: the read won, and the deficit
  arithmetic followed the read.
- **The brief's §4 gate was NOT MEASURABLE as specified.** It asked to pair the
  re-mined library "against the current 2-pattern library on the same 88
  traces". No such arm existed: `matcherTier: "loo"` re-mines from `otherCasts`
  every fold and **never reads `data/minedFishPatterns.json`**. Every
  session-50/51 replay figure therefore describes a LOO-mined library, not the
  one live loads. Built `ReplayOptions.matcherLibrary` +
  `scripts/minedLibraryGate.ts` to make the gate runnable.
- **The brief names the file `data/mined-patterns.json`; it is
  `data/minedFishPatterns.json`.** `patternMining.ts:158`'s comment has the
  wrong name too.
- **Wall 1 gained a FIFTH hole.** `AddMaxHealth` has been in `BOON_MODELS`
  since session 23, but no room-1 offer had ever CONTAINED it, so the sim could
  never pick it there. Run 1's room-1 offer did. Same retroactive mechanic as
  session 11's AddMaxArmor and 43's UpgradePaper.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: **PRESENT** — re-confirmed live, `currentCharges`/`maxCharges`
  on every move of both combatants across both runs.

## Dead ends
- **Do not dedupe the mined library on this evidence.** The 3-pattern deduped
  variant scores ΔlogLoss −0.0056 [−0.0312, +0.0121] and catches 24/88 vs the
  4-pattern's 27 and the 2-pattern's 26. All three are indistinguishable; a
  3-catch spread on 88 casts is noise. The real fix is upstream — stop
  `buildPatternPool()`/`promotePatterns` from offering provably-identical
  primitives — and that needs its own gate.
- **Never pipe a live run to a truncating reader.** `head -30` SIGPIPE'd run 2
  mid-battle in room 2 with 60 energy already committed. `--resume-existing
  --potions=3 --potions-used=0` recovered it with nothing lost, but redirect to
  a file and tail it.
- **Checked and NOT claimed:** `deepestScorableRoom` is 4 both before and after
  this session's corpus growth — verified by re-running `npm run sim` on the
  stashed tree. The new room 5/6/7/8 captures did not move it.
- Standing, unchanged: do not rebuild the expected-coverage focus objective
  (50); do not tune focus spend quantity again (48, 49, 50); replay for
  DIFFERENCES never absolutes (48); do not take the bare log-loss argmin on a
  smoothing sweep (51).

## Metrics
- **Live dungeon: 2 juiced Tier-3 runs, 120 energy, 0 clears.**
  | run | death | score | loot (item 846) | juices | rooms w/ no Safe offered |
  |---|---|---|---|---|---|
  | 1 | room 8 | 6864 | 420 | 3/3 | 1 of 7 |
  | 2 | room 7 | 4896 | 309 | 3/3 | 3 of 6 |
- **ROM claims: 4 claims, 119 energy, measured drift 0 on both runs.**
- **§4 replay, 88 clean traces, 292 paired turns, cluster bootstrap over casts:**
  | library | ΔlogLoss vs 2-pattern | 95% CI | caught/88 | matcher-active turns |
  |---|---|---|---|---|
  | 4-pattern (SHIPPED) | −0.0041 | [−0.0355, +0.0177] | 27 | 136 |
  | 3-pattern (deduped) | −0.0056 | [−0.0312, +0.0121] | 24 | — |
  | 2-pattern (before) | — | — | 26 | 129 |
- **Mined support at 89 casts** (so session 53 reads its batch against a known
  library): perimeterWalk(cw) 4, perimeterWalk(ccw) 4, bounce(2,0) 3,
  bounce(-2,0) 3 → **11 distinct supporting casts of 89, prior 0.133**.
- **Live fishing this session: 0 casts** (cap was 20/20 for 2026-08-19).
- Corpus: dungeon 51 → **53 attempts**; fishing unchanged at 89 traces.
- Suite 786 → **806** (+6 claim order, +14 corpus pin updates).

## Open questions for Claude
1. **QUESTIONS.md §21 — the path-selection token rejection.** The preferred
   resolution costs no energy: a fresh DevTools capture of the browser making a
   reward pick, today. That settles the envelope with no run. The alternative
   is a one-line experiment (send `client.getActionToken()` instead of `""`)
   that needs a 60-energy juiced entry to observe, so it should ride along with
   a run that was going to happen anyway.
2. **Should the retry path log a WARN and a running count?** A decision class
   failing 100% of the time on first attempt was invisible in a run that
   otherwise reported success. This is cheap and would have caught it on run 1.
3. **QUESTIONS.md §22 — fix the aliasing upstream?** Neither shipping nor
   deduping is supported by the replay. Making `buildPatternPool()` or
   `promotePatterns` incapable of offering provably-identical primitives makes
   the question moot instead of arguable. Worth its own gate?
4. **§19 (matcher drop-vs-mix) is still open and still needs a batch, not an
   argument.** Session 51's decision rule stands and the instrumentation
   shipped; the library it will run against is now the 4-pattern one recorded
   above. Fishing was capped out today, so nothing was collected.
5. **Was ascending the right call, and should it stay?** It is now proven — but
   the descending rationale (an interrupted pass made the most progress it
   could) is the better steady-state one, which is why the default was left
   alone. Is there a reason to keep passing `--claim-order=ascending`?

## Files changed
```
 14 files changed, 659 insertions(+), 30 deletions(-)   (+ 106 new fixtures)

     src/orchestrator/energyPreflight.ts        | 128  (§1a order/maxClaims/fallback)
     QUESTIONS.md                               | 106  (§21, §22)
     scripts/minedLibraryGate.ts                | 109  (§4 gate, new)
     tests/orchestrator/energyPreflight.test.ts |  87
     src/sim/boons.ts                           |  79  (13 new offers, rooms 1-7)
     scripts/liveRun.ts                         |  75  (--claim-order, §1c audit)
     src/sim/fishing/offPolicyReplay.ts         |  28  (§4 matcherLibrary arm)
     tests/boons.test.ts                        |  25  (corpus pins)
     src/sim/enemies.ts                         |  23  (room 8 / Enemy Room 70)
     tests/dungeonSim.test.ts                   |   7  (AddMaxHealth clean)
     tests/enemies.test.ts                      |   7  (loadout 54/17)
     config/bot.json                            |   2  (potions re-added, removed)
     SPEC.md                                    |  +26 (§2 token correction)
```
