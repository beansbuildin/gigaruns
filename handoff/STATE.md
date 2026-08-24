# STATE — session 90 — 2026-08-24 (PT) — code at commit <RECAP_SHA>

## Status
**GATE PASS — all four brief items delivered. No live spend, by design.** No
dungeon run, no fishing cast, no on-chain anything, no new fixture.
`tsc --noEmit` clean, `git diff --check` clean, `discoveredShipsClean` 8/8,
secret scan clean.

**The suite went 42 failed → 4 failed** (1673 → 1730 passed, 1716 → 1735 tests;
8 failing files → 2). **Not one failure was fixed by loosening an assertion.**
Three of the four remaining are RED ON PURPOSE and are the session's most
important finding.

## What works
- **§1 — the double-lethal oil trigger is WIRED LIVE, by user override, and the
  sim still says DO NOT SHIP.** Recorded verbatim in `QUESTIONS.md` §30,
  `DECISIONS.md`, and a new `WIRED LIVE` section of `OIL-DOUBLE-LETHAL.md`,
  beside the unchanged **140.9 oils per extra fish against a bar of ~12**.
  **Never present this as sim-recommended.** `liveFishing.ts` calls
  `doubleLethalTriggers`. The not-wired guard was **inverted, not deleted**,
  plus a new pin that the memo still says DO NOT SHIP — so softening the record
  to match the code fails a test.
- **§1a — the two-consume path is RUN, not argued.**
  `tests/fishing/oilDoubleLethalLive.test.ts` drives `runOneCast` against a
  live-shaped mocked sequence: two POSTs, two DISTINCT slots (0 and 1),
  `oilsConsumed` 2 against a per-item cap of exactly 2, zero refusals — **and
  the case session 89 §3 did NOT cover**, a lethal SECOND relaxing followed by
  a wanted trailing `focus`. Both confirmed **non-vacuous by mutation**.
- **§2 — `redrawCounterfactual.test.ts` regenerated** from the real functions
  at 168 casts, old values beside every pin, frozen-memo cross-reference added.
  Both session-86 report files UNTOUCHED.
- **§3 — five of six pin files were genuinely mechanical**, each checked
  individually before regenerating. The sixth was not; see below.
- **§4 — the redraw shadow evaluator exists and is inert.**
  `src/strategy/fishing/redrawShadow.ts`, all three `oilShadow.ts` properties.
  **`redrawEnabled` false and `REDRAW_THRESHOLD` 0, verified in the diff.**

## What's broken
- ⚠ **`damageEconomy.test.ts` — 3 tests RED ON PURPOSE. DO NOT REGENERATE.**
  `LIVE.drift` **changed sign**: +0.19 (band asserted `> 0.05`) → **−0.0316**.
  Cause measured, not guessed — split by the deck actually DEALT:
  base `[1..10]` 22 casts drift **+1.568** (hit 18.9%), non-base 145 casts
  **−0.222** (hit 39.9%), POOLED **−0.032**. **The arms have OPPOSITE signs and
  nearly cancel — "the fish gains HP in expectation" is a POOLING ARTEFACT.**
  Held to one deck the live fish LOSES HP, the SAME sign as the sim's bare arm.
  **`QUESTIONS.md` §31 asks for the ruling and offers three options.**
- **`boons.test.ts` — 1 failure, `OBSERVED_OFFERS` stale.** Unchanged from
  session 89, which verified it INERT and declined it. Not re-opened.
- **`scripts/assertionCoverage.ts` STILL CANNOT RUN** — fails closed on a red
  suite. The "zero vacuous" check is **BLOCKED, not passed**, and now blocked by
  4 failures rather than 42.
- **`scripts/preflight.ts` STILL FAILS, same cause, much smaller number:**
  **4 failed / 1715 passed / 16 skipped (1735)** in the exported tree — now
  EXACTLY matching the working tree. 310 files exported, one `✗` in the
  empty-HOME `doctor.ts` run (the expected missing JWT), **secret scan clean**.
- Carried, untouched: the gate-1 re-audit; the two unpaid redraw correctness
  gaps (`liveFishing.ts:2471`, `:1526`); the pacing term's cause; H2's proc
  model; `play_cards`/redraw/`use_fishing_item` unrouted; §0a NOT lifted,
  **+19.40pp MAY NOT BE QUOTED**; Focus Oil stock 0.

## Corrections to SPEC.md
- **None this session** — no live response was taken, so nothing could
  contradict the spec. `SPEC.md` and `SPEC-fishing.md` are untouched.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Rule 9, TWO corrections to the session-90 brief, both in §1c:**
  1. **"same context object, same call shape" is FALSE.**
     `doubleLethalTriggers` takes an `OilDecisionState` — `OilTimingState` plus
     `focusCell` and `board` — because its confidence read is
     `bestKillProbability`. The old site passed eight scalars; a literal
     substitution does not compile. The site now builds the board exactly as
     the oil shadow above it does. **Session 69 §1's hoist of the distribution
     pipeline above the oil block is the ONLY reason `dist` is in scope there**
     — a move made for the shadow that paid for this twenty sessions later.
  2. **The wiring puts `bestKillProbability` on the LIVE path for the first
     time ever.** It has only run inside `evaluateOilShadow`, whose body is
     wrapped in try/catch *because it can throw*; `buildHand` throws by design.
     Live, a throw aborts a cast already in flight. The evaluation is now
     wrapped: a throw **degrades to `onDemandTriggers`** — yesterday's shipped
     policy, strictly the less-spending arm — logs `oil_trigger_threw`, and the
     cast continues. **Any `oil_trigger_threw` line in a live log is a finding.**
- **The brief's §0 correction #3 was RIGHT and is confirmed:**
  `loadCastTraces()` has no date or doc-id filter, so
  `redrawCounterfactual.test.ts` was always live-computed. There was never a
  frozen-vs-live architectural conflict to resolve.

## Dead ends
- **Regenerating the `hoistInvariant` golden — considered and REFUSED.** It is
  the only artefact comparing live play against a capture taken BEFORE the
  session-69 hoist; regenerating would destroy that baseline to accommodate a
  field it could not have contained. Diffed by hand instead: **the ONLY
  differences are the two new shadow fields appearing** — every `posts` array,
  `outcome`, `turns`, `oilTriggerNoStock`, `oilsConsumed` byte-identical across
  all five scenarios. Fields now excluded from the capture, as
  `oilShadowRecords` already was.
- **Regenerating `damageEconomy`'s three pins — REFUSED,** see above.
- **Routing §1 through `doubleLethal(...).decide(...)` — not done,** per the
  brief: the wrapper's positional stock filter is redundant with the loop's
  per-iteration `mayConsumeOil`.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker;
  `--dry-run` before claiming a blocker; do not revert rule 8; +19.40pp
  SUSPENDED; `boonCapture` OFF; no H2 proc model; do not read `SIM blind` as a
  live proxy; do not restate session 86's finding without the word **UNIFORM**.

## Metrics
- **Live: ZERO. No dungeon run, no fishing cast, no oil consumed.**
  `dayProgressEntities` and `dayDocs` untouched and unread — nothing was spent,
  so rule 13 has nothing to reconcile.
- Suite **42 failed / 1673 passed / 1 skipped (1716) → 4 failed / 1730 passed /
  1 skipped (1735)**. Files 8 failed of 100 → **2 of 103**.
- Corpus: unchanged — **168 fishing casts, 71 dungeon attempts. No fixture was
  added.** Every regenerated pin was computed by CALLING its instrument.
- Redraw candidate in sample at 168 casts: fires on **12 of 444 plays (2.7%)**.
  The live batch summary prints the out-of-sample rate against that 2.7%.

## Open questions for Claude
1. **§31 is the one that needs a ruling, and §29 is upstream of it.** The
   damage-drift sign flip is a deck-pooling artefact; until it is known WHY
   casts get dealt the base deck, it is not certain the base arm is a
   legitimate population at all. Three options are written out in §31.
2. **§29 is still the cheapest high-value question and still needs the USER:**
   next time they are in the game — **is the Shroom Rod still equipped, and
   does it show durability, charges, or a per-day limit?** This session made it
   more urgent, not less: the deck split now moves a published finding.
3. **The redraw shadow has never run against a live cast.** It wants a fishing
   batch, not a brief. Its first real output is the out-of-sample firing rate
   against the in-sample 2.7%.
4. ⚠ **§26's candidate has MOVED and `DECISIONS.md` is stale on it.** Session
   83's K=6 arm was `{fires 6, rescues 6, sacrifices 0, wasted 0}`; at 168
   casts it is `{12, 8, 0, 2}`. **`sacrifices: 0` survived, `wasted: 0` did
   not.** Shadow the SHAPE, never quote the prose.
5. **Standing captures, both still unmet:** a base-6/8/10 dungeon crit
   (`critEffects` still never observed); an oil consumed at a NON-ZERO meter —
   now **24 of 24** consumes at meter 0, impossible while Focus stock is 0.

## Files changed
```
 5 commits, 21 files, +2175 / -223.

  A  src/strategy/fishing/redrawShadow.ts        §4, the shadow evaluator
  A  tests/fishing/redrawShadow.test.ts          §4, pure-function + corpus parity
  A  tests/fishing/redrawShadowInert.test.ts     §4, the inertness proof
  A  tests/fishing/oilDoubleLethalLive.test.ts   §1a, the two-consume path RUN
  M  scripts/liveFishing.ts                      doubleLethalTriggers + redraw shadow
  M  QUESTIONS.md                                §30 the override, §31 the sign flip
  M  handoff/OIL-DOUBLE-LETHAL.md                WIRED LIVE section
  M  src/sim/fishing/redrawCounterfactual.ts     coverageOfCards extracted
  M  src/sim/fishing/matcherHeadroom.ts          cardCovers widened to readonly
  M  tests/fishing/damageEconomy.test.ts         RED ON PURPOSE + the docblock
  M  tests/fishing/{redrawCounterfactual,matcherHeadroom,oilReachability}.test.ts
  M  tests/fishing/{zoneTemplate,oilDoubleLethal,oilStockExhaustion}.test.ts
  M  tests/fishing/{pConnectConsumers,hoistInvariant}.test.ts
  M  tests/{enemies,sim/fishingCorpus}.test.ts
  M  handoff/DECISIONS.md, handoff/STATE.md, handoff/log/session-90.md
```
