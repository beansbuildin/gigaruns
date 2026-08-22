# STATE — session 75 — 2026-08-22 (PT 2026-08-21) — code at commit e5dbbd2

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1433/1433** (1401 → 1433, +32),
`tsc --noEmit` clean, `git diff --check` clean, secret scan clean across the
whole session diff, `discoveredShipsClean` 8/8.

- **Four juiced runs played, one at a time, each with its own go-ahead.**
  `dayProgressEntities` null → 3 → 6 → 9 → 12, **exactly +3 every time**
  (rule 13 verified after each). **12/12 spent — the day's cap is exhausted.**
  Fishing **20/20** at start and end (game and repo agree); **0 casts**, as the
  brief directed. Rollover 11:00 PT.
- **§1a the dry-run PASSED first try**, exit 0. Twelve sessions and ~130 commits
  since the dungeon path last executed and nothing had rotted. The brief called
  this the item most likely to surprise; the surprise is that it did not.
- **GATE 1 PASS — every remaining live level gate fires ZERO.** The `pConnect`
  thread closes **as MOOT**.
- **GATE 2 PASS — `castSim`'s redraw now charges a turn and a fish step**, and
  re-deriving 263 **inverted the recorded prediction**.

## What works
- **§1 four runs, 0/216 first-attempt failures**, no 429s, no token errors, no
  unknown enums, no guard trips. Tier gate **38/38 OK** (cumulative 17/17 →
  38/38). Perpetual filter changed the taken tier on **5** offers.

  | cid | died | Hard Core | Dendren Root | orbFallback | orb sum |
  |---|---|---|---|---|---|
  | 24982745 | room 6 | 5568 | 216 | 4/5 | 116 |
  | 24982886 | room 7 | 6816 | 309 | 2/6 | 142 |
  | 24983080 | **room 9** | **8688** | 546 | 3/8 | 181 |
  | 24983279 | room 8 | 6480 | 420 | **0/7** | 135 |

  **27,552 Hard Core / 1,491 Dendren Root.** Run 3 is the **highest-HC juiced
  run on record** (17 juiced; previous best 8112) and room 9 was an empty
  bucket in the death histogram.
- **§1b FOUR first-ever pickup pairs, coverage 6/2 → 7/5** after three sessions
  frozen. `AddLifestealShield` (orb; the most-offered unmodelled type on the
  record, 6 offers since session 03), `CorrosiveSword` (priority, twice),
  `AddWeakSword` (priority, two observations), `AddVulnerableShield`
  (priority, room 9). **All latent, and every zero is MEASURED** — controls in
  the same runs moved (AddEvasion 0→1, AddIntuition 0→1 and 1→6, AddMaxArmor
  17→21 and 17→25, AddMaxHealth 26→40 / max 40→54, AddBlock 8→15, UpgradeRock
  DEF 9→13→21).
- **§1b §23's predictor is FALSIFIED and replaced.** Run 3 drifted **2**; a
  `Bernoulli` cannot emit 2. It is the first observation with elapsed > 3.33
  min — session 71's n=3 were all inside one regen tick. Re-fit over **all 11**
  recorded runs, x = elapsed/3.33: **drift ∈ {floor(x), ceil(x)} on 11/11**,
  ceil 8 / floor 3, mean frac(x) 0.643 vs ceil rate 0.727. Runs 3 and 4 sit
  either side of one tick and went opposite ways, which kills pure-`ceil` too.
  It is passive regen ticks landing in the window; 18/hr = 1 per 3.33 min.
- **§2 GATE 1 — `scripts/liveGateFiringRates.ts`**, paired at the turn.

  | gate | replay (440 turns) | live |
  |---|---|---|
  | RELAXING necessity | 0 / 20 arms | 0 / 10 (union of all records) |
  | FOCUS necessity | 0 / 80 arms | 0 / 10 |
  | shadow `>= 1` kill | 0 / 440 | 0 / 73 `oil_shadow` |
  | shadow `>= 1` connect | 0 / 440 | 0 / 73 |

  Zero sanity flags all time. With session 74's `isLethal` (1 / 373 live,
  0 / 440 replay), **`pConnect`'s +9.38pp reaches no live level gate at all.**
- **§2 the denominator is stated, not assumed.** `isLethal` fires by GRANTING an
  override → denominator is turns. A necessity gate is
  `if (meetsThreshold(...)) continue;` → it fires by WITHHOLDING an oil the
  trigger already wanted, and is not evaluated when the trigger wants nothing.
  Its denominator is TRIGGERED ARMS.
- **§2 the argument is stronger than the sample.** All four sites compare
  against p = 1; corpus maxima **0.991** (kill) / **0.967** (connect); a fitted
  correction moves an OPTIMISTIC estimator DOWN, away from the boundary. **A
  correction cannot make these gates fire, only fire less** — independent of n.
- **§3 GATE 2 — the redraw charges a turn and a fish step**, the same way the
  turn-costing oil branch does. `tests/fishing/redrawFishStep.test.ts` **fails
  against the old `continue` on 3 of its 4 assertions** (the 4th pins mana and
  no-heal, always correct, deliberately non-discriminating).

## What's broken
- **`pConnect` is still optimistic at +9.38pp and was never explained.** It is
  closed **BY IRRELEVANCE, NOT BY EXPLANATION** — different claims, do not blur
  them. What makes "moot" safe to record is the RATCHET, not this snapshot:
  `tests/fishing/pConnectConsumers.test.ts` fails on a read in an unclassified
  file and on a changed site count in a classified one. **Cite it with the
  verdict.**
- **Session 74's redraw prediction was BACKWARDS, and that is the session's
  sharpest finding.** It said a free fish step made the sim's redraw cheaper,
  so 263 was an UNDERSTATEMENT. Re-derived: **263.0 → 43.9** mana per extra
  fish, catch 26.2% → 32.5%, turns/cast 4.38 → 6.07. **The reasoning priced the
  missing `turn++` and forgot the missing `observe()` beside it.** A sim redraw
  was not merely time-free, it was **information-free** — a real redraw moves
  the fish and the bot SEES where it went. Hit rate per shot **35.6% → 45.4%**.
- **The redraw fix is NOT contained: 87.9% of default-policy casts execute that
  branch** (3515/4000). `redrawEnabled` gates nothing in the sim;
  `matcherFishPolicy` reaches it via `shouldRedraw` at threshold 0 AND via the
  `!best` fallback, which needs no threshold crossed. 19 files reference a
  redraw-capable policy. **Any oil-sweep / focus-profile / mining figure
  derived before 2026-08-22 needs re-deriving before it is re-quoted.** The
  suite bounds it: exactly ONE pinned number moved.
- **The armor re-spec splits the batch.** Runs 1–3 and run 4 are **not the same
  arm**. Nothing may read run 4's depth or Hard Core against the others.
- Carried: the `nextPosition` tripwire has still never met a real miss; the oil
  row of session 72's gate 1 still fails (50.1% sim vs 78.6% live, n=14) and no
  oil payload was measured — no cast existed; distribution steps 3/4/6 remain
  the user's; the shrinkage re-fit is still unstable and unadopted.

## Corrections to SPEC.md
- **SPEC-fishing §7a's "understatement" claim is RETRACTED** with the
  before/after table and the `continue` lesson. Session 74 wrote it; §3
  measured the opposite.
- **`PLAYER` re-spec'd, user-stated mid-batch, captured from run 4's own
  `start_run`**: Shield 6/12 → **10/15**, Sword 26/9 → 25/8, Spell unchanged,
  armorMax 17 → **22**, block 8 → 10, hpMax 40 unchanged. Fixed in
  `src/sim/enemies.ts`. **Its consequences are recorded, not smoothed**: the
  room-4 Shield mirror that stalled forever now nets 2 per tie, and
  `the-lost-run-position`'s answer CHANGED — a Shield win now breaks the 8
  armor and carries 2 into HP. The general fix: **a test about a MODEL must not
  read the user's current gear.**
- **The oil gates' upper spike is a `castSim` ARTEFACT.** Threshold 1 was chosen
  (session 67) on the simulator's bimodality at 0 and 1 (34.3% / 55.8%). Replay
  puts `bestKill` strictly between on **20/20** and `bestConnect` on **75/80**.
  Both sources resolving against REAL trajectories agree and disagree with
  `castSim`. Nothing re-tuned; the ARGUMENT is what rests on an artefact.
- **`logs/` is gitignored and LOSSY — a scan of it is not "the entire live
  record".** Four Relaxing observations session 69 cites survive only in its
  report; the pre-hoist shadow never wrote a record for a lethal Relaxing turn.
  CLAUDE.md rule 10 in its second form. **It applies to session 74's "1 / 373"
  too** — that is what SURVIVES, not what happened.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged.
- Corrode: `corrosiveShield` / `corrosiveMagic` / `corrosiveSword` all seen as
  enemy buffs, amounts read off the buff. `perpetual_corrosiveShield` and
  `perpetual_corrosiveMagic` still have **zero** appearances — table NOT
  completed.

## Dead ends
- **Expecting the redraw fix to be contained.** The brief hoped the oil sweeps
  and focus profile never enable redraw. **False** — 87.9%. Enumerate, never
  assert, and the enumeration is what caught it.
- **Correcting `pConnect` at a live level gate.** All four fire zero and a
  correction can only push them further from the boundary. There is nothing to
  correct toward.
- **Reading a live firing rate off `logs/` alone.** Lossy and era-dependent.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; **redraw is CLOSED** (43.9 is still
  unaffordable against 10 mana); +19.40pp stays SUSPENDED; do not loosen the
  `fakeDoc` guard; `boonCapture` settled OFF; do not fold stock into the oil
  threshold; the matcher is not `pConnect`'s cause; `shrinkageK` is inert.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.

## Metrics
- **Live: 4 dungeon runs (12/12 units, cap exhausted), 0 fishing casts.**
  27,552 Hard Core, 1,491 Dendren Root, 240 energy. Deaths rooms 6/7/9/8.
- Tier gate 38/38; first-attempt failures 0/216; 0 × 429.
- §23 over n=11: drift ∈ {floor(x), ceil(x)} **11/11**; ceil 8, floor 3.
- Gate firing rates: relaxing 0/20 replay + 0/10 live; focus 0/80 + 0/10;
  shadow 0/440 + 0/73.
- Redraw re-derivation, n=4000/arm: **263.0 → 43.9** mana per extra fish; catch
  26.2% → 32.5%; hit rate per shot 35.6% → 45.4%; branch incidence 87.9%.
- Corpus unchanged at 128 casts (127 clean) / 537 `playTurns`. `OBSERVED_OFFERS`
  155 → **181** (generated from fixtures, not transcribed). `UNMODELLED_TYPES`
  −4 +1 (`WeakeningEvade`, first offered this session) — shrinks by three, not
  four, which is the honest shape of the metric.
- **Suite 1401 → 1433.** New: `redrawFishStep` 4; the rest are boon-model rows.
- Hardcoded-path ratchet **25**, unchanged.

## Open questions for Claude
1. **The `pConnect` thread is closed as moot. What replaces it?** Three
   sessions were spent on it and the exit is "still wrong, no longer reaches
   anything". The ship-nothing posture's other items (shrinkage re-fit
   unstable, `isLethal` tightening inert, conditional unfalsified) are all
   still frozen and none is now blocked by the diagnosis. **Is the posture
   still the right stance, or does something get shipped next?**
2. **Should the pre-2026-08-22 sim figures be re-derived in bulk?** The redraw
   fix moves a branch 87.9% of default-policy casts execute. Only one pinned
   number moved, but oil-policy and focus-profile numbers quoted in
   `handoff/OIL-POLICY.md` and past recaps were derived under the broken
   branch. Re-derive them as a batch, or re-derive lazily when quoted?
3. **Does 43.9 mana per extra fish reopen redraw?** I kept it CLOSED per the
   brief and the arithmetic (43.9 against a 10-mana cast is unaffordable), but
   the gain is now a REAL 7.6pp at |t| = 7.6, not noise. The honest statement is
   that redraw is closed on PRICE, not on effect — which is a different verdict
   from the one on record.
4. **Carried, still unspendable:** the forced Relaxing consume and the era
   batch (session 73/74 §4 designs, untouched and still valid); the oil row of
   session 72's gate 1. **20 casts at 11:00 PT.**
5. Carried: separate the crit source with one-lure-only casts? Should
   `preflight.ts` run in CI (open since session 68)? What re-derives +19.40pp
   (still SUSPENDED, do not quote)?

## Files changed
```
 3 commits (6ae4962, 82baf53, e5dbbd2). 480 files, +304616 -68
 (455 of them new run fixtures).

  NEW  scripts/liveGateFiringRates.ts        290  GATE 1
  NEW  scripts/redrawBlastRadius.ts          189  GATE 2's enumeration half
  NEW  tests/fishing/redrawFishStep.test.ts  150  4 tests, 3 fail on the old branch
  NEW  fixtures/dungeon-runs/run-2026-08-22-{03-51-44,04-00-32,04-12-49,04-27-03}
       src/sim/boons.ts                     +190  4 latent models + 26 offers
       SPEC-fishing.md                       +50  §7a retraction + the re-derivation
       tests/boons.test.ts                   +48  ratchets advanced
       src/sim/fishing/offPolicyReplay.ts    +35  pre-play oil-gate inputs
       tests/combat.test.ts                  +38  stall rule made gear-independent
       tests/strategy.test.ts                +32  same
       src/sim/fishing/castSim.ts            +29  the fix
       tests/enemies.test.ts                 +24  loadout census +5
       tests/scenarios.test.ts               +25  a scenario's ANSWER changed
       src/strategy/boonCapture.ts           +19  AddLifestealShield retired
       scripts/redrawTriggerCalibration.ts   +17  §6 significance now computed
       src/sim/enemies.ts                    +16  the armor re-spec
       tests/fishing/redrawTrigger.test.ts   +16  ALWAYS arm re-pinned on outcome
       handoff/DECISIONS.md                  +14  6 settlements
       tests/dungeonSim.test.ts              +11  win-rate band 0.9 -> 0.95
```
