# session 21 — 2026-08-17

Brief: fishing tuning funded by ROM claims. Four required items (dungeon
tuning stays parked, no live lever left — session 20/13). No conflict
between STATE.md and next.md at session start.

## 1. Fishing budget raise

`config/bot.json`'s `dendren` block: `dailyEnergyBudget` 200 → 240,
`maxCastsPerSession` 15 → 20. Sourced from two independent things landing on
the same number: `config/discovered.json`'s `maxCastsPerDayJuiced: 20`
(probe-captured session 11, never wired into policy) and a fresh user
confirmation this session of "20 casts/day at 12 energy each = 240." Comment
appended to the existing `_comment` field rather than replacing it, matching
house style (see the `forbiddenWoods.potions` block's pattern of appending
history rather than overwriting).

## 2. ROM claiming

Added `RomClaimResponseSchema` (`src/api/schemas.ts`) and
`GigaverseClient.claimRomEnergy(romId, amount = 0)` (`src/api/client.ts`),
promoting session 19/20's raw-fetch `probeRomsFactoryClaim.ts` probe into a
proper client method now that the endpoint is CONFIRMED — same
rate-limit/mutex/fail-closed discipline as every other write. 3 new unit
tests in `tests/api/client.test.ts` (body shape with explicit amount,
default `amount=0`, fail-closed on HTTP 500).

`scripts/claimRoms.ts` claims all 4 known ROM ids
(`5345, 689, 2097, 7959`, ordered by last-known `energyCollectable`
descending, though order turned out not to matter — see below) in one pass.
No batching logic against the 420 cap: overflow is confirmed non-wasting by
the user this session (whatever doesn't fit stays banked in the ROM), so
"claim opportunistically, whenever there's room" (the brief's own framing)
needed no cap-aware sequencing code.

**Live run output:**
```
Starting energy: 140
romId 5345: FAILED — Unexpected response from /roms/factory-claim: HTTP 500
romId 689: FAILED — Unexpected response from /roms/factory-claim: HTTP 500
romId 2097: success=true
  energy 140 -> 148 (delta 8)
romId 7959: success=true
  energy 148 -> 153 (delta 5)

Final energy: 153 (started at 140, net +13)
```

5345 and 689 both HTTP 500'd — both were claimed exactly one session earlier
(session 20, +12 each), and the per-ROM-accrual model (session 20) predicts
exactly this: a claim only returns something once the ROM has accrued
something new since its last claim, and one session's worth of real-time
accrual evidently wasn't enough yet for either. This is the model's first
real predictive success, not just a description of past behavior.

**2097 and 7959 both succeeded.** 7959 is the more interesting one: it
failed both of its session-19 attempts (uninformative HTTP 500s at the
time, before the accrual model existed to explain them) and has now
succeeded for the first time ever, for +5 energy. Consistent with the
accrual model: two sessions' worth of untouched accrual finally cleared
whatever threshold gates a real payout.

Net: +13 energy, lifetime ROM-claim total now 5 successful claims / ~38
energy credited (from session 19's 1 + session 20's 2 + this session's 2).

`config/discovered.json`'s `roms.knownRomIds` was `["7959","2097"]` —
missing `5345`/`689`, which STATE.md/QUESTIONS.md already knew about from
session 20. Corrected to all 4 (gitignored file, so this fix is local-only,
not part of the commit, but keeps this session's own re-reads accurate).

Full ROM enumeration (37 total, only 4 known) is still open — flagged again
in STATE.md's open questions, not chased this session per the brief's "not
blocking" framing.

## 3. Redraw threshold sweep

`REDRAW_THRESHOLD` (`src/sim/fishing/castSim.ts`) traces back to an
informal session-13 sweep done inline while fixing the `evPerMana`-vs-`ev`
bug — real evidence, never built as a dedicated, re-runnable script with a
full curve and CIs (unlike the dungeon side's `potionTimingSweep.ts`).
SPEC.md §5 has said "tune the threshold in the sim, not live" since it was
written; this is the first time that sweep actually ran as its own thing.

Parameterized `matcherFishPolicy` into a factory,
`makeMatcherFishPolicy(redrawThreshold)`, so the sweep script can vary the
threshold without duplicating `chooseCard`/`shouldRedraw` wiring.
`matcherFishPolicy` itself is now just `makeMatcherFishPolicy(REDRAW_THRESHOLD)`
— unchanged behavior, confirmed by the full test suite staying green.

`scripts/redrawThresholdSweep.ts`: N=2000 per threshold, 14 values from
-1,000,000 (a sentinel for "never redraw" — `bestEv` is never actually that
low) through 20, wide enough on both sides of 0 and the old session-13
range to see the curve turn over rather than run off the edge.

**Full curve:**
```
threshold   catch rate          mean turns
never       67.6% ± 2.1         4.10
-5          69.1% ± 2.0         4.10
-2          69.7% ± 2.0         2.93
-1          69.7% ± 2.0         2.93
-0.5        70.6% ± 2.0         2.92
0           70.7% ± 2.0         2.88
0.5         69.2% ± 2.0         2.80
1           62.1% ± 2.1         2.49
2           30.6% ± 2.0         1.60
3           20.5% ± 1.8         1.35
5           4.7% ± 0.9          1.09
8           0.4% ± 0.3          1.03
12          0.4% ± 0.3          1.03
20          0.4% ± 0.3          1.03
```
0 wins, an interior point (curve rises from "never" to 0, then collapses
past 1). No config change needed — matches the existing default exactly.

**Side finding, not new:** the ~70% catch rate here is well below the
92.4%/19.0% figures TASKS.md's Task 8 gate and elsewhere still cite. Those
predate session 14's `focusMeter` modelling fix, which independently
dropped the matcher-informed rate to 69.9-71.6% — this sweep's 70.7% at the
optimal threshold reproduces that figure exactly, just via a different
script. Not a regression, just a stale-number trap for anyone citing "the
sim number" without checking which session's figure they're quoting. Flagged
in STATE.md's open questions.

## 4. Real fishing casts + miner re-run

`--status` before starting: 9/20 casts, 108/240 energy used today (UTC-keyed
guard budget, spans sessions). `--dry-run` clean (correctly read live state,
proposed `start_run`, no active cast). Then `--casts=6`, live:

```
cast 1: escaped after 5 turns (12 energy)
cast 2: escaped after 2 turns (12 energy)
cast 3: escaped after 2 turns (12 energy)
cast 4: escaped after 2 turns (12 energy)
cast 5: CAUGHT after 2 turns — cardsToAdd resolved, chose card 35 (12 energy)
cast 6: escaped after 2 turns (12 energy)
```
72 energy spent, 1 catch. Ending guard totals: 15/20 casts, 180/240 energy.
Real account energy after this batch: 82 (was 154 before, including the ROM
claim gains from earlier in the session).

`mineFishPatterns.ts` re-run against the grown log:
```
90 transitions across 25 casts
perimeterWalk(cw)        support=3  casts=[12923267,12925773,12942030]
bounce(0,-1)             support=1  casts=[12923267]
bounce(2,0)              support=1  casts=[12944936]
bounce(-2,0)             support=1  casts=[12944936]
1 primitive(s) promoted: perimeterWalk(cw)
Sim catch rate (500 synthetic casts, focusMeter modelled):
  matcher BLIND (matcherPool: []):        33/500 = 6.6%
  matcher with MINED library (1 pattern): 81/500 = 16.2%
```
Same promoted set as before this session (`perimeterWalk(cw)`, support
unchanged at 3 — this session's 6 casts didn't add a 4th independent match
to it). Two new support-1 near-misses from a single cast (`12944936`),
`bounce(2,0)`/`bounce(-2,0)` — not promotable without 2 more independent
matches each. Honest null result on new promotions, consistent with the
project's own established discipline (session 15's "0 promoted is the
correct outcome, not a miner bug").

Note for the record: `perimeterWalk(cw)` was ALREADY promoted going into
this session (visible in the live cast output: "matcher seeded with 1 mined
pattern(s)") — it cleared the ≥3-match bar back in session 18
(`handoff/log/session-18.md`), but that promotion was never rolled up into
TASKS.md's Task 11 narrative, which still read as if session 15's "0
promoted" was the latest state. Backfilled a short note into TASKS.md this
session so the written record matches what `data/minedFishPatterns.json`
has actually had since session 18.

## 5. `chooseNewCard` heuristic

Not started. Brief explicitly said only attempt if 1-4 finish with time
left AND to scope it as a design question first, not code directly. Given
the volume of items 1-4, deliberately left for a future session with its
own scoping pass.

## Verification

`npx tsc --noEmit`: clean throughout.
`npx vitest run`: 351/351 → 354/354 (+3, the new `claimRomEnergy` tests).
Secret scan (recap step 1): clean — no addresses/JWTs in the tracked diff,
new scripts, or the new fixture directory's redacted (non-`raw/`) files;
`raw/` confirmed gitignored via `git check-ignore`.

## Not attempted

Task 10's 8-hour orchestrator run — outside any interactive session's
control, unchanged from session 20's framing. Dungeon side untouched
entirely (parked, no live lever — session 13/20).
