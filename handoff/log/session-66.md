# session 66 — 2026-08-21 (PT) — OFFLINE — GATE PASS (both halves)

Code at `2bb0dc9`. Suite **1254/1254** (1223 → 1254, +31). `tsc --noEmit`
clean. `git diff --check` clean. Secret scan clean across `4ab199f..HEAD`.
`tests/discoveredShipsClean.test.ts` 8/8.

**Zero live actions.** No cast, no dungeon run, no `start_run`, no consume.
The only network calls all session were `scripts/checkFishingCaps.ts` and
`scripts/checkDungeonToday.ts`, both read-only, run at the start and again at
hand-off.

---

## 0. The ledgers, read twice, spent nothing

```
guard day (11:00 PT rollover): 2026-08-20   [file records: 2026-08-20]
GAME ledger  (dayDocs pond 2):  20 / 20
REPO ledger:                    20 casts, 240 energy
dungeonId 5 dayProgressEntities (real runs today): 12
```

At session start: 0.45h to the rollover. At hand-off: 0.15h. **Both ledgers
were already full on arrival**, so the offline directive and the ledger state
agreed; the directive would have held either way. Twenty casts and twelve
run-units appear at 11:00 and none of them are authorized — a full ledger is
not permission, and rule 11 needs a per-run go-ahead regardless.

---

## 1. §1 / GATE 1 — the first-miss tripwire

### 1a. Why the existing gate could not protect anything

The override arms behind a Wilson-score lower bound on hits/attempts. That
gate fixed a real bug (session 39: a raw hit COUNT ignoring the denominator).
What it cannot do is **fire**.

A Wilson lower bound computed from an **unbroken streak only ever climbs**:

| streak | lower bound |
|---|---|
| 12/12 | ≈ 0.76 |
| 20/20 | ≈ 0.84 |
| 50/50 | ≈ 0.93 |

There is no value the streak can reach that lowers it. So while the override
behaves, the gate is monotone in the wrong direction, and the moment it stops
behaving is the moment nobody is watching a number that has spent its entire
history going up. **That is not a threshold problem and no threshold fixes
it.** The fix is an event that can actually occur.

### 1b. The three cases

`classifyPredictionOutcome` in `src/strategy/fishing/nextPositionArm.ts` —
pure, no I/O, so the distinction is testable on its own:

| kind | condition | trips? |
|---|---|---|
| `absent` | server volunteered no `nextPosition` (~98–99% of turns) | no |
| `not_acted` | present, but did NOT steer card choice | **no** |
| `acted_hit` | present, steered, right | no |
| `acted_miss` | present, steered, **wrong** | **YES** |

`not_acted` is the load-bearing one. Tripping on a prediction the bot never
acted on would retire the safeguard over a counterfactual — the gate was
unmet, or the override was already off, so the miss says something about the
SERVER's field and nothing about a decision the bot took.

`NextPositionValidation` gains an optional `overrideActive`. **Absence means
UNKNOWN, never "acted on"** — the 12 live rows written before the field
existed cannot be re-attributed, and the tripwire fires from the live
classification at the moment of the miss rather than from a replay of the
ledger, so nothing gates on the field.

### 1c. The disarm is a VETO, not a term in the bound

If a miss were folded into hits/attempts it would lower the bound a few points
and be swamped by the next handful of hits — the override would re-arm itself
inside the same batch. **A safeguard that resets is a log line, not a guard.**
Pinned directly: seeded at 200/200 with a disarm on disk, the bound stays
above 0.97 and `ready` is `false`.

Nothing re-arms automatically. The module exports no re-arm function and a
test asserts that absence (`export function (rearm|reArm|clearDisarm|
resetArmState)` must not appear, and the module must not import `unlinkSync`
or `rmSync`). Re-arming is a human deleting
`data/nextPositionOverrideDisarm.json` after reading what it says.

Fail-closed in both directions: a **missing file is ARMED** (the normal state,
and has been all project); an **unreadable or wrong-shape file is DISARMED**,
because a disarm that cannot be read is still a disarm and the override is an
optimisation worth a fraction of a percent of turns. Write-once, so the FIRST
miss stays the recorded one.

The record carries everything a recap needs without going back to the logs:
`at`, `castId`, `turn`, `predicted`, `actual`, `gridSize`, `streakHits`,
`streakAttempts`, `lowerBound` — the streak it ended, because the number that
authorised the override is part of the evidence about it.

### 1d. THE GATE, demonstrated by breaking it three ways

Each edit made, the suite run, then restored:

| what was broken | tests failing |
|---|---|
| the `if (tripsWire(...))` branch disabled | **2** — the live one and the restart one |
| `disarmOverride` stubbed to `return false`, read path fully intact | **6** |
| `readArmState` forced to return permanently DISARMED | **8** |

The third is the brief's own question, answered by experiment: under a
permanently-disarmed override, *"and it does NOT wash out as the streak
grows"* — a pure read-path assertion — **still passes**. A read-path-only test
cannot tell a working tripwire from an override that is off forever. The
assertions that catch it are the behavioural ones: the arm file is asserted
**ABSENT before the cast and PRESENT after**.

**A weakness this exposed in my own tests, worth recording:** the §5
source-text populate assertions all PASSED in demonstration 1, because
`disarmOverride(disarmRecord, nextPositionArmStatePath)` was still textually
present inside the dead branch. **Source-text pins prove a line exists, not
that it runs.** They are the right tool for an absent property in an object
literal (session 64's bug) and the wrong tool for "does this execute".

### 1e. Both known trap classes handled structurally

- `nextPositionArmStatePath` went into `LiveFishingIsolatedPaths` **in the
  same commit as the field on `LiveFishingDeps`**. It failed **11 call sites
  at compile time** — the session-62 pattern working exactly as designed. This
  bug class has shipped four times when the step was skipped, and this one
  matters more than most: a test that wrote a real disarm would switch the
  live override off for every subsequent session, and nothing re-arms it.
- `main()` **populates** it, profile-scoped
  (`dataPath(profile, "nextPositionOverrideDisarm.json")`), and prints the arm
  state before any cast runs — armed or not — so "it is still armed" is an
  observation rather than an assumption. Profile-scoping is not cosmetic: a
  `--profile` run falling through to the default would disarm the DEFAULT
  profile's override.

`nextPositionOverrideStats` now takes the arm-state path as a **required**
second argument where every other path in that file defaults. Two defaulted
real data paths on one function is how a test silently reads production state,
and this caller decides whether the bot overrides its own model.

`tests/noHardcodedPaths.test.ts` gained the module by name — it meets that
file's own stated condition (a default-profile ledger location that every live
caller resolves over the top of), not merely resembling the entries near it.

---

## 2. §3 / GATE 2 — the 14-cast gap, settled by membership

The session-65 recap said:

> The lax-vs-strict Focus gap is **STILL exactly 14** across three independent
> batches — **structural, not sampling noise.**

**Withdrawn as stated. Two independent problems.**

**(1) The count is not evidence.** Seven casts were added between the two
readings. At the observed gap rate 14/102 = 13.7%, those seven were expected
to add ~0.96 members; adding **zero** has probability 0.863⁷ = **0.36**. A
one-in-three outcome is the single most ordinary thing that could have
happened.

**(2) The "same 14 casts" reading is arithmetic, not a finding.** Gap
membership is a **per-cast** property — `castReachability` reads one cast and
nothing else — and the corpus only ever grows, so gap(109) is necessarily a
superset of gap(102). **Equal counts therefore FORCE equal membership.**
Observing it teaches nothing at all.

The ids, since the brief asked (`npx tsx scripts/oilReachability.ts --gap`):

```
12923189 12942026 12942155 12944922 12945306 12945313 12956660
12956727 12957029 12957061 12957129 12975708 12975724 12991326
```

**0 of them among the seven newest casts. All 14 escaped. All 14 have
lax = strict + 1 decision point and exactly one lax focus point.**

### What they actually share — and it is clause 2 restated

```
casts CAUGHT                                   23   (0 can be in the gap)
casts ESCAPED                                  86
  of those, terminal state alive + meter <= 0  66
  of those, ALREADY focus-reachable strictly   52
  of those, in the gap                         14
```

A caught cast can **never** be in the gap: its terminal state has `fishHp: 0`,
which fails clause 1 (alive). That is structural, not a property of these 14.

And the gap is **not** "escaped with an empty meter at the end" — that set is
**66**. Of those, **52** had already hit zero with a turn still to play, so
the strict reading calls them reachable too. **66 − 52 = 14.** The gap is
precisely the casts whose meter emptied for the **first and only** time on the
state that ended the cast, which is exactly the case the "with a turn
remaining" clause was invented to exclude.

So there is a real, exactly-characterisable shared property, and it is the
definition of the clause rather than a finding about the meter's dynamics. The
test comment carrying the old claim is rewritten in place; four new tests pin
the membership, the shared property, the structural exclusion of caught casts,
and the 66/52/14 split.

---

## 3. §2 — what zero Relaxing Oil costs, priced

`npx tsx scripts/oilReachability.ts --relaxing-cost`, write-up at
`handoff/reports/session-66-relaxing-cost.md`.

```
catch rate as played                  23/109 = 21.1%
lethal trigger REACHABLE              12/109 = 11.0%
  of those, CAUGHT anyway             10
  of those, ESCAPED                   2   <- the only casts an oil could convert

expected catches gained               2 over 109 = +1.83pp
95% Wilson interval                   [0.5pp, 6.4pp] = 0.10-1.29 fish/day
oils that would have been spent       12
oils per extra fish                   ~6
at the 20-cast daily cap              ~2.2 oils/day, ~0.37 extra fish/day
```

**THE FINDING IS THE 10, NOT THE 2.** Ten of the twelve reachable casts were
caught anyway. The trigger fires at `fishHp <= 2` with a turn still to play,
and a fish that low usually dies to the next card, which deals far more than
the oil's 2. **The lethal trigger is a proxy for "this cast is nearly over",
not for "this cast is about to escape"** — five of six oils spent on it buy
nothing.

**The sim's +4.47pp must not be quoted as this cost.** Per oil the two sources
agree closely — 0.196 (sim) vs 0.167 (corpus). The headline differs 2.4x
purely because the sim reaches the lethal band on **22.8%** of casts against
this corpus's **11.0%**. Trigger rate, not oil value.

**EXPECTED, not observed, and labelled so everywhere.** The numerator is two
casts (`12975713`, `12991353`). The one live Relaxing consume on record
(session 65, `fishHp 1/23 → 0/23`, CAUGHT) confirms the MECHANISM and
calibrates no rate. The counterfactual is clean in one specific way that the
Focus trigger's would not be: the lethal trigger fires at the END of a cast,
so spending it cannot change any earlier card choice — **do not build an
equivalent estimate for Focus this way.**

Distribution detail: 11 of the 12 casts offer exactly one lethal decision
point; `13019682` offers three (the session-65 cast abandoned by the token
desync, resumed, three oils consumed). It was caught, so those extra points
change no outcome.

For contrast, Focus is reachable in **55.0%** of casts and carries +17.74pp of
the policy's +19.40pp. **Focus is where the value is**, and stock is 18.

---

## 4. §4 — §19 recorded as closed

§19 landed a POWERED KEEP at n=35 of 32 in session 65, so the objective
`SESSION_65_LIMITS` was chosen for — accumulating instrumented matcher turns —
no longer exists. The constant stays exported, tested and numerically
unchanged (same reason `SESSION_64_LIMITS` does: a batch shape is history, not
a setting). What is retired is its **rationale**, in both places a future
session would read it: the constant's own doc comment and `main()`'s
`batchLimits` line.

**A future batch that wants seven casts must state what they are for in its
own brief.** Do not budget casts for §19 and do not report turn accrual.

---

## 5. Surprises

- **`npx tsx` cannot run under this machine's command sandbox.** Every
  invocation dies with `Error: listen EPERM … /tmp/claude-501/tsx-501/*.pipe`
  before executing a line of the script. Both ledger reads and every analysis
  run this session had to be issued unsandboxed. Not a repo problem and it
  produces no misleading output — it fails loudly — but it looks like a script
  crash on first sight.
- **The §2 answer inverted my expectation.** I expected the corpus to show the
  Relaxing Oil converting escapes, and went in intending to report a cost the
  user should act on. It shows the opposite: 10 of 12 trigger opportunities
  were already going to be catches. The oil is worth about a sixth of what the
  sim's headline implies, and that is the useful thing the report says.
- **§3 turned out to be provable rather than measurable.** The membership
  question the brief asked — "are they the same 14 by cast id?" — has an
  arithmetic answer that needs no data: per-cast property + monotone corpus +
  equal counts ⟹ equal sets. The ids were printed anyway, but the real answer
  is that the observation could not have come out any other way.
- **My own populate tests passed while the feature was disabled.** Found only
  because the gate required demonstrating the failure. See §1d.

---

## 6. Verification, at the final commit

```
npx tsc --noEmit                       clean
npx vitest run                         69 files, 1254/1254 passed
npx vitest run tests/discoveredShipsClean.test.ts   8/8
git diff --check                       clean
secret scan over 4ab199f..HEAD         no matches
   (0x[a-fA-F0-9]{4,} | noobId \d | eyJ | PRIVATE)
.gitignore covers .env .env.* *.key data/ logs/ profiles/
   fixtures/**/*.har fixtures/**/raw/
data/ holds no nextPositionOverrideDisarm.json after the full suite
```

No test writes a real data path: the new arm-state path is a required member
of `LiveFishingIsolatedPaths`, so all 11 `runOneCast` call sites in the suite
pass an `mkdtemp` path and the compiler enforces it.
