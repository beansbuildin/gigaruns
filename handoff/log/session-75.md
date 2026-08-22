# session 75 — 2026-08-22 — four juiced runs, GATE 1 PASS / GATE 2 PASS

Commits: `6ae4962`, `82baf53`, `e5dbbd2`. Base `6d9217e`.
Suite 1401 → **1433**. `tsc --noEmit` clean. `git diff --check` clean.

---

## §0 The ledgers, read at the top

```
doctor: token valid 158.1h, authenticated as <USER> <ADDR>
  dungeon: dayProgressEntities null  (0 of 12)
  fishing: dayDocs[pond 2] 20 / 20, repo 20 casts / 228 energy — AGREE
  VERDICT: fishing BLOCKED — cap spent. Next window 11:00 PT (14.18h).
```

Zero fishing casts this session, as the brief directed. The two carried fishing
items carry forward a third time.

## §1a The dry-run — PASSED, and the negative is the finding

```
▸ liveRun.ts — STAGE 1 dry-run
  · --juiced: next genuinely new start_run will send isJuiced:true, index 3.
  · potions: config authorizes up to 3x itemId 131 (hard cap 3); 50 in stock -> loading 3.
  · boon-priority: ON   · orb rule: WIDE (session 58)
  ▸ energy preflight: pool 330 covers the planned 60 — no ROM claim needed.
▸ run 1/1
  [dry-run] would POST start_run (dungeonId 5, juiced)
▸ done. energy spent (guard-tracked) 0, runs 0        EXIT=0
```

Twelve sessions and ~130 commits since the dungeon path last executed
(session 62). `adoptServerRunCount`, the corrode wiring, and repeated sim and
strategy seam moves all landed in between. **Nothing had rotted.** The brief
named this the item most likely to surprise; it is worth recording that the
surprise was its absence, because sessions 64–66 kept finding the opposite.

## §1 The four runs

Rule 13 after every one: `dayProgressEntities` **null → 3 → 6 → 9 → 12**,
exactly +3 each time. Cap exhausted.

| cid | died | HC | DR | tier checks | perpetual filtered tier | orbFallback | orb sum | potions at HP |
|---|---|---|---|---|---|---|---|---|
| 24982745 | 6 | 5568 | 216 | 5/5 | 1 (r3) | 4/5 | 116 | 14/40, 3/40, 15/40 |
| 24982886 | 7 | 6816 | 309 | 6/6 | 0 | 2/6 | 142 | 19/40, 6/40, 18/54 |
| 24983080 | **9** | **8688** | 546 | 8/8 | 2 (r2,r6) | 3/8 | 181 | 20/40, 15/54, 19/54 |
| 24983279 | 8 | 6480 | 420 | 7/7 | 2 (r2,r3) | **0/7** | 135 | 10/40, 31/62, 19/62 |

Totals **27,552 HC / 1,491 DR / 240 energy**. First-attempt failures **0/216**
across all four (`rock` 80, `paper` 47, `scissor` 37, plus path/reward). Zero
429s, zero `Invalid action token`, zero unknown enums, zero guard trips.

Tier gate cumulative **17/17 → 38/38**. Run 4's `orbFallback 0/7` is notable on
its own: the priority rule reached **every** offer in that run.

### §1b The four first-ever pickup pairs

Diffed the full player object across each `reward_*` POST, before → after.

```
run 1   AddLifestealShield   ZERO DELTA (latent)
        AddEvasion           evasion.current 0->1
        AddIntuition         intuition.current 0->1
        AddMaxArmor          shield.currentMax 17->21
        CorrosiveMagic       ZERO DELTA (already modelled)
run 2   CorrosiveSword       ZERO DELTA (latent)   <- twice, rooms 2 and 3
        AddTenacity          tenacity.current 0->3
        AddMaxArmor          shield.currentMax 17->25
        AddMaxHealth         health 26->40, currentMax 40->54
        AddBlock             block.current 8->15
run 3   AddWeakSword         ZERO DELTA (latent)
        AddVulnerableShield  ZERO DELTA (latent)
        UpgradeRock          rock.currentDEF 9->13, then 13->21
        AddIntuition         0->1, then 1->6
run 4   AddWeakSword         ZERO DELTA (second observation)
        UpgradeRock          rock.currentATK 25->29->33
        AddMaxArmor          22->30, then 30->32
        AddMaxHealth         30->44 / 40->54, then 44->52 / 54->62
```

**Every zero is a measurement.** The controls above moved under the identical
diff in the same runs, so the instrument was demonstrably live. Coverage
running total (sessions 60–75): **orb 6 → 7, priority 2 → 5.**

`AddLifestealShield` was the most-offered unmodelled type on the whole record —
6 offers since session 03, never picked — so it is the largest hole this table
has closed in one session.

### §1b §23 — `Bernoulli(elapsed / 3.33)` is falsified

Every recorded run carrying both `energy_preflight` and `energy_accounting`,
x = elapsed / 3.33:

```
run                            el       x  drift  took
run-2026-08-20-00-30-48      3.10   0.931      1  ceil
run-2026-08-20-01-34-29      2.01   0.605      1  ceil
run-2026-08-20-01-38-20      3.91   1.175      1  floor
run-2026-08-20-18-19-06      2.15   0.647      1  ceil
run-2026-08-20-20-04-35      2.48   0.744      0  floor
run-2026-08-20-22-41-45      3.05   0.916      1  ceil
run-2026-08-20-22-46-24      3.05   0.916      1  ceil
run-2026-08-22-03-51-43      2.58   0.775      1  ceil
run-2026-08-22-04-00-30      2.85   0.855      1  ceil
run-2026-08-22-04-12-47      4.33   1.301      2  ceil   <- kills Bernoulli
run-2026-08-22-04-27-01      4.01   1.205      1  floor  <- kills pure ceil

n=11  drift in {floor(x), ceil(x)}: 11/11   ceil 8  floor 3
mean frac(x) 0.643   observed ceil rate 0.727
```

Run 3 drifted **2**; a Bernoulli emits only 0 or 1. It is the first observation
with elapsed > 3.33 min — session 71's three were all inside a single regen
tick, which is exactly why n=3 could not see it. Runs 3 and 4 both sit above
one tick and went opposite ways, so no deterministic rounding rule fits either.

The model is **passive regen ticks landing inside the measurement window**:
18 energy/hr = 1 per 3.33 min, so drift = floor(x) plus one more depending on
PHASE, with P(extra) = frac(x). The 3.33 was never an arbitrary constant.

The `start_run` tight probe matched exactly −60 on all four runs
(`matchesCommitted: true`), so the drift is credited back DURING the run.

### §1 The armor re-spec

User-stated in chat between runs 3 and 4. Captured from run 4's own `start_run`:

| | runs 1–3 | run 4 |
|---|---|---|
| rock (Sword) | ATK 16→26, DEF 0→9 | ATK 16→**25**, DEF 0→**8** |
| paper (Shield) | ATK 6→6, DEF 12→12 | ATK 6→**10**, DEF 12→**15** |
| scissor (Spell) | 12→12 / 8→8 | unchanged |
| shield.current / block | 17 / 8 | **22** / **10** |

**Runs 1–3 and run 4 are not the same arm.** Four downstream consequences, all
recorded rather than smoothed — see DECISIONS. The general rule extracted:
**a test about a MODEL must not read the user's current gear.** Pinning
`PLAYER.moves.paper.atk` into an assertion about the armor threshold made a
gear change look like a combat-model regression in four separate files.

## §2 GATE 1 — the three remaining live level gates

`scripts/liveGateFiringRates.ts`, paired at the turn. `offPolicyReplay` now
publishes `hand` / `manaBefore` / `focusBefore` / `fishMaxHp` / `focusMax` —
the PRE-PLAY values, because the oil decision sits above the card choice (the
session-69 hoist).

```
── §2  THE REPLAY — 'WOULD IT FIRE', PAIRED AT THE TURN ──
  era only — 134 turns
    turns where the trigger wanted ANY oil       27
    RELAXING gate   evaluated    3   held (fired)    0   0.0%
    FOCUS    gate   evaluated   24   held (fired)    0   0.0%
    SHADOW   >=1 certain-kill       0      >=1 certain-connect    0
  whole clean corpus — 440 turns
    turns where the trigger wanted ANY oil       96
    RELAXING gate   evaluated   20   held (fired)    0   0.0%
    FOCUS    gate   evaluated   80   held (fired)    0   0.0%
    SHADOW   >=1 certain-kill       0      >=1 certain-connect    0
    bestKillProbability    0.009 .. 0.991   exactly 1: 0
    bestConnectProbability 0.000 .. 0.967   exactly 1: 0

── §3  THE LIVE RECORD — 'DID IT FIRE' ──
  oil_shadow records                          73
  ...at a FIRING MOMENT                       14
  RELAXING arm evaluated live                  6   at >= 1: 0   max 0.964
  FOCUS    arm evaluated live                 10   at >= 1: 0   max 0.906
  SHADOW sanity flags raised, all time         0
  Union of every Relaxing observation ever: 10, at >= 1: 0, max 0.975.

── §3b  THE BIMODALITY, RE-ASKED ──
  replay  bestKillProbability     n  20   exactly 0   0    exactly 1 0   between  20 100.0%
  replay  bestConnectProbability  n  80   exactly 0   5    exactly 1 0   between  75  93.8%
  live    bestKillProbability     n   6   exactly 0   0    exactly 1 0   between   6 100.0%
  live    bestConnectProbability  n  10   exactly 0   0    exactly 1 0   between  10 100.0%
```

**The denominator question, which is the part a future reader will get wrong.**
`isLethal` fires by GRANTING an override, so turns is right for it. A necessity
gate is `if (meetsThreshold(...)) continue;` — it fires by WITHHOLDING an oil
the trigger already wanted, and is never evaluated on a turn where
`onDemandTriggers` wants nothing. Scoring it per turn divides by a number the
gate does not see. Its denominator is TRIGGERED ARMS.

**The argument is stronger than the sample and this is what makes the verdict
safe at n=20.** All four sites compare against p = 1. The corpus maxima are
0.991 and 0.967 — approached, never reached. `pConnect` is OPTIMISTIC, so a
fitted correction moves these inputs DOWN, *away* from the only boundary they
are ever tested against. A correction cannot make these gates fire; it can only
make them fire less. That conclusion does not depend on n at all.

**Closed by irrelevance, not by explanation.** `pConnect` is still wrong by
+9.38pp and nothing here diagnosed why. What makes "moot" safe to RECORD is the
ratchet — `pConnectConsumers.test.ts` fails on a connect-probability read in an
unclassified file and on a changed site count in a classified one — so a future
level-based consumer reopens the question automatically.

### §2 Two findings beside the gate

**The upper spike is a `castSim` artefact.** Threshold 1 was chosen (session 67)
because the SIMULATOR's `bestKillProbability` is bimodal, 34.3% at exactly 0 and
55.8% at exactly 1, leaving "no constant to defend" between the spikes. Session
70 found live had no mass at either endpoint (n=9). The replay is a third source
and the first with a usable n, and it agrees with live: strictly between on
20/20 and 75/80. Nothing is re-tuned — CLAUDE.md's "do not tune the necessity
thresholds" is untouched — but the bimodality ARGUMENT should not be re-quoted
as a live property.

**`logs/` is gitignored and lossy.** Session 69 cites nine Relaxing
observations; only six survive in the log tree, and one of mine (0.925) is not
among its nine. The four missing (0.400, 0.580, 0.587, 0.975) exist only in
`handoff/reports/session-69-oil-threshold.md`. Their absence is not pruning: the
session-68 shadow was evaluated BELOW the oil block, and a lethal Relaxing
trigger ends the cast inside that block, so the one turn the arm was observable
on was the one turn no record was written. This is CLAUDE.md rule 10 in its
second form and **it applies to session 74's "1 / 373" as well** — that is what
survives, not what happened.

## §3 GATE 2 — the redraw fix

The branch now does `observe(trueTrajectory[matcher.turn])` then `turn++`,
copying the turn-costing oil branch exactly so ONE mechanism advances time on a
non-shooting turn.

`tests/fishing/redrawFishStep.test.ts`, 4 tests. Demonstrated in both
directions by reverting the branch in place:

```
against the OLD `continue`:
  × a cast that redraws consumes MORE turns than one that does not
  × each redraw advances the turn counter by EXACTLY one — turns = redraws + shots
  × the fish is somewhere else after a redraw
  ✓ a redraw still costs mana equal to cards held, and still does not touch fishHp
  Tests  3 failed | 1 passed (4)
```

The passing one is deliberate: mana and no-heal were always correct, so it is
non-discriminating by construction and the file says so.

### §3 The re-derivation inverted the recorded prediction

```
threshold        catch    mana/cast on redraws   escaped_mana   turns/cast   mana per extra fish
NEVER (0)       24.9%                   0.00          18.5%         6.20   n/a
derived (0.339) 32.5%                   3.34          39.4%         6.07                  43.9
pFresh  (0.485) 40.1%                   4.53          43.1%         6.01                  29.9
ALWAYS  (2)      0.0%                   9.00         100.0%         4.00                 -36.1
```

Session 74 recorded 263 as an **understatement** on the reasoning that a free
fish step made the sim's redraw cheaper than the real one. **263.0 → 43.9.** The
direction was wrong, not just the magnitude.

**Why the reasoning failed, which is the durable half: it priced the missing
`turn++` and forgot the missing `observe()` beside it.** A `continue` skips
everything below it, not the one thing you were thinking about. The audit
enumerated three charges and checked each; it never enumerated what else the
statement jumped over. A sim redraw was not merely time-free, it was
**information-free** — a real redraw moves the fish and the bot SEES where it
went, buying an extra observation for the price of the mana — and the
information term is the larger one.

Measured directly: hit rate per shot **35.6% (NEVER) → 45.4% (derived)**. The
redrawing arm shoots BETTER, not merely more often.

### §3 The blast radius is NOT contained

```
── §3  DOES IT ACTUALLY EXECUTE? — THE DEFAULT POLICY, MEASURED ──
  matcherFishPolicy            casts with >=1 redraw  3515 / 4000   87.9%
  NON-ZERO — the fix moves numbers for every consumer of the default policy.
```

`redrawEnabled` is a LIVE flag and gates nothing in the simulator.
`matcherFishPolicy` reaches the branch two ways: `shouldRedraw` at
`REDRAW_THRESHOLD = 0`, and the `!best` fallback, which needs **no threshold
crossed at all** — only a hand nothing in it can afford. 19 files reference a
redraw-capable policy. The brief hoped "if the oil sweeps and the focus profile
never enable redraw, the fix touches nothing else"; that is **false**, and the
enumeration is what established it rather than an assertion.

**The suite then bounds it usefully.** Exactly ONE pinned number moved:
`redrawTrigger.test.ts`'s ALWAYS arm, `turnsPerCast < 1.29` → `<= 4`. Re-pinned
on the OUTCOME instead — `escaped_mana` is 100%, which is the degeneracy the
test exists for and is unchanged. The old bound was measuring the missing
`turn++`, not the disaster.

`redrawTriggerCalibration.ts` §6 asserted "i.e. not distinguishable from zero"
in a template string — true at |t| = 1.4 when written, false at |t| = 7.6 now.
It COMPUTES that clause as of this session. **A conclusion baked into a format
string survives the data that contradicts it.**

**Redraw stays CLOSED.** 43.9 mana per extra fish against a cast holding 10 in
total is unaffordable at either figure, `escaped_mana` still roughly doubles,
and rule 4 bars a live change on a sim result regardless. The honest statement
is that it is closed on **price**, not on **effect** — which is a different
verdict from the one on record, and open question 3 asks about it.

## §4 The 10 non-sim test failures, and why they are not breakage

The full suite went red after the runs, and only ONE failure came from the sim
fix. The other ten were today's captures hitting ratchet tests exactly as
designed:

- `boons.test.ts` × 8 — four new pickup pairs with no model; `OBSERVED_OFFERS`
  155 vs 181; `UNMODELLED_TYPES`; two Wall-1 census counts.
- `enemies.test.ts` × 2 — the armor re-spec, caught by the test that pins to the
  NEWEST capture precisely so gear drift cannot go silent.

Then updating `PLAYER` turned five more red downstream (`combat`, `scenarios`,
`strategy`, `dungeonSim`, `boonCapture`) — the re-spec's real consequences.

`OBSERVED_OFFERS`'s 26 new rows were **generated from the fixtures**, not
transcribed. The table had reached the size where transcription is the likelier
error source than the capture is.

`UNMODELLED_TYPES` −4 +1: `WeakeningEvade` was offered for the first time this
session. The list shrinks by three, not four — a deeper corpus finds new types
about as fast as it explains old ones, and that is the honest shape of the
metric rather than a regression.

## §5 Verification at the final commit

```
npx tsc --noEmit          clean
git diff --check          clean
npx vitest run            Test Files 86 passed (86)   Tests 1433 passed (1433)
tests/discoveredShipsClean.test.ts   8 passed
secret scan (0x[a-fA-F0-9]{4,}, noobId, eyJ, PRIVATE) over 6d9217e..HEAD
                          no matches outside 0xUSER
```
