# STATE — session 57 — 2026-08-19 (PT) — code at commit 9080355

> One code commit, `9080355`. This recap and the session log sit on top of it
> and touch no source. All verification below was run AT `9080355`.

## Status
Session-57 brief: **all four items (§1, §2, §3, §4) delivered.**
**NO GATE WAS SET by the brief**, and per CLAUDE.md rule 6 none is invented
here — the bar was full suite + `tsc --noEmit` + `git diff --check`, all clean.
Next per TASKS.md: nothing is blocked on code. The next real move is a live
juiced run (needs a per-run human go-ahead, rule 11) or QUESTIONS.md §19.

**Zero energy spent. Zero casts. Zero dungeon runs. Two free GETs total.**

**§19 is BLOCKED for a SEVENTH session** and was checked as the first action:
session began 23:13 PT on 2026-08-19, and the caps reset at **11:00 PT on
2026-08-20**. Game ledger 20/20, repo ledger 20, agreeing, 11.77h to reset.
The precondition is unchanged and unmet: **a session that BEGINS after 11:00 PT
on a day whose 20 casts are unspent.**

**The two headline numbers:**
1. **The rule-8 flip is live in code and has never run against the game.** The
   first juiced run is its first exercise and is also the only measurement of
   what winning a chosen hard fight yields — the corpus has none.
2. **§2's orb tie-break, shipped exactly as directed, is worth +0.029 orbs per
   decision.** The wider reading the directive does not authorise is worth
   +1.81 — **62x** — and is written up as QUESTIONS.md §24 for the user.

## What works
- **§1 the flip — `src/strategy/enemyTier.ts` rewritten.** `pickLowestTier` is
  **deleted**, not renamed-and-kept; the live selector is `pickHighestTier`.
  `chooseTier` -> `lowestTierOption`, plus a `highestTierOption` sibling.
  Verified by 1014 tests including five new `runOnce`-level ones that assert
  the `tier_choice` log event, not just that the loop resolved.
- **Perpetual is applied as a FILTER BEFORE the max**, so the clause now
  *lowers* the tier rather than breaking a within-tier tie. An all-Perpetual
  offer throws `PerpetualOnlyOfferError` and halts.
- **`maxRoom` verified against a LIVE response before it governs anything** —
  `scripts/checkMaxRoom.ts`, one free GET, committed: Forbidden Woods **16**,
  Void Dungeon **17**, Dungetron 16, Underhaul 16, matching
  `config/discovered.json`. `liveRun` now reads `config.maxRoom`, not the
  `MAX_ROOM` literal.
- **Unreadable room/`maxRoom` -> conservative no-modifiers branch, LABELLED**
  `final-room-unreadable` and printed with a `⚠` naming `ROOM_NUM_CID`.
- **The retry re-locator delegates to the rule** — `locateChosenTierOption(run,
  room, maxRoom)`. Its old inline lowest-tier scan would have skipped the
  Perpetual filter and the final-room exception on a retry.
- **§2 `gigusOrbAmount` as a within-rank tie-break** in `boonPriority.ts`,
  wired live and logged (`orbTieBreak`, `orbsTaken`, `orbsOffered`). Refuses to
  fire on a partial capture rather than read an absent payout as zero.
- **`scripts/orbTieBreakReport.ts`** — three policies over 552 decisions.
- **§3 `boonCapture` untouched and still OFF** behind its two-condition gate.
- Suite **1014/1014** (was 988), `tsc --noEmit` clean, `git diff --check` clean.
  No test writes a real data path.

## What's broken
1. **The flip has ZERO live exercise, and so does the final-room path.** Every
   test is against a mock. The `maxRoom` VALUE is verified live; the code path
   that consumes it has never seen room 16, the deepest run ever being room 10.
2. **§2 is a near-no-op as shipped and that is a finding, not a defect.** The
   winning priority rank ties on **16 of 552 decisions (2.9%)**, so the rule
   changes the pick on **0.7%**. The field is not the problem — payouts differ
   in 136 of 138 offers, mean spread 6.22 orbs. The narrow reading is.
3. **The simulator now models a policy the bot does not play.** `dungeonSim`
   still fights Safe tier by default, deliberately: raising it would only make
   the sim refuse to score (617/622 non-Safe paths carry rolled stats). Every
   number it prints is now a LOWER BOUND on difficulty. Documented in the
   default's doc comment; **do not "fix" it.**
4. **§19 UNMEASURED for a seventh session.** Purely scheduling. Unchanged.
5. **§23's −1 energy drift still unexplained.** Probe armed, never fired — no
   run happened. Unchanged from sessions 54, 55, 56.
6. Carried, unchanged: git HISTORY still holds the noob token and the three
   documents' identifiers (deliberate, `fixtures/README.md`).

## Corrections to SPEC.md
- **SPEC §3e's tier rule is REVERSED in the document, not merely annotated.**
  The `lootTable`-identity evidence is left standing and marked still-true; the
  new paragraph states why the two claims are orthogonal and names
  `pickHighestTier`, `PerpetualOnlyOfferError`, and the two exceptions.
- **SPEC's `gigusOrbAmount` bullet now carries the measured numbers** (136/138
  differ, spread 6.22, shipped +0.029/decision, wide +1.81/decision).
- **No live response contradicted SPEC this session.** The one live read
  (`maxRoom`) CONFIRMED the recorded value. There was no live play.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
  `maxRoom` is per-dungeon and now confirmed on four dungeons, not one.
- Move charges: PRESENT — unchanged, no new capture this session.

## Dead ends
- **Do not leave a renamed `pickLowestTier` in place as an alias.** It was
  deleted outright. Three prose references in `src/sim/enemies.ts`,
  `tests/enemies.test.ts` and `boonCapture.ts` were annotated rather than
  rewritten, because they describe things that happened under the old rule.
- **Do not re-implement the tier rule anywhere but `enemyTier.ts`.** The retry
  path had a second copy for 48 sessions and it was equivalent right up until
  it wasn't.
- **Do not read the old `runOnce` enemy-path tests as covering the flip.** They
  served state with **no `data.entity`**, so `roomNum` was 0 — post-flip that
  is the `final-room-unreadable` branch. They asserted only "resolves", so they
  would have passed while the loop took the LOWEST tier. Fixed; the new tests
  serve `entity: { ROOM_NUM_CID: n }` and assert the logged decision.
- **Do not widen the orb rule to make it fire.** Measured, written up, left to
  the user (QUESTIONS.md §24).
- Standing, unchanged: do not apply a stat-only `enemyBuff` (double-counts, 56);
  do not key the buff fail-closed line on the buff ID (56); do not join reward
  offers per run DIRECTORY (56); `ROOM_NUM_CID` is on `data.entity` (56); do not
  expect the priority list to subsume `boonCapture` (56); do not write a
  liveRun `runOnce` test without `vi.runAllTimersAsync()` (56); do not read
  `matcherWeight` through `matcherWeightOf()` for §19 (55); do not write a real
  identifier into a test (54); `npx tsx -e` cannot resolve this project's
  relative imports; never pipe a live run to a truncating reader (52).

## Metrics
- **Live dungeon: 0 runs. Live fishing: 0 casts. Energy spent: 0.** Two free
  GETs (`checkFishingCaps`, `checkMaxRoom`).
- **Cap ledgers, verified live 23:13 PT and agreeing:** `dayDocs[pondId 2]` =
  20 of 20; repo guard 20 casts. 11.77h to rollover.
- **§1 live `maxRoom`:** Forbidden Woods 16, Void Dungeon 17, Dungetron 5000
  16, Underhaul 16. Matches `config/discovered.json`.
- **§2, 138 offers x 4 HP fractions = 552 decisions:**
  - payouts present on every option 138/138; differ across options **136/138
    (98.6%)**; mean spread where they differ **6.22 orbs**.
  - no priority family matches: **312 (56.5%)**; matched but only one option:
    **224 (40.6%)**; two or more tied at the winning rank: **16 (2.9%)**.
  - A baseline 10256 orbs (18.580/dec) | **B shipped 10272 (18.609/dec,
    +16 total, +0.029/dec, pick changed on 4 = 0.7%)** | C wide, NOT SHIPPED,
    11256 (20.391/dec, +1000 total, **+1.81/dec, pick changed on 196 = 35.5%**).
  - For scale: session 56 measured the whole enemy-TIER effect on mean orbs at
    room 3 at **+4.21** (n=25/10/2), suggestive not established.
- Suite 988 -> **1014**. Corpus unchanged (nothing captured this session).

## Open questions for Claude
1. **§24 is the live one and it needs one sentence from the user.** Should the
   orb rule be widened to decide among options when NO priority family matches
   (56.5% of decisions)? +1.81 orbs/decision vs the shipped +0.029. The cost is
   real and stated: it overrides `rankBoons`' modelled combat value on 35.5% of
   picks. **No offline experiment can settle it** — the sim cannot separate two
   boon policies at n=2000. Full numbers in QUESTIONS.md §24.
2. **The first juiced run under the flip is the most valuable thing available**
   and needs a per-run go-ahead (rule 11). Report tier offered vs taken per
   room, how often Perpetual filtered the top choice, whether `final-room` or
   `final-room-unreadable` ever appeared, and orb totals. The bot took the
   lowest tier on every unforced decision it ever made, so this is the ONLY
   data that will exist on what a chosen hard win pays.
3. **§19: put the precondition in the brief's FIRST paragraph.** Seventh
   blocked session. `npx tsx scripts/checkFishingCaps.ts` first, then 20 casts,
   then `npx tsx scripts/matcherWeightReport.ts --last-casts=20`.
4. **Do not write a brief that gates a dungeon strategy change offline.** That
   instrument is gone (DECISIONS 2026-08-20, session 57 §4). Fishing is the
   only offline gate left with meaning.
5. **§23 stays open until the armed probe fires.** Unchanged.
6. **`boonCapture` stays OFF** per the session-57 brief; re-ask once the
   directive's free by-product coverage has landed from ordinary play.

## Files changed
```
 1 commit.  18 files, +1,212 / −303.  No fixtures written (zero live play).

     src/strategy/enemyTier.ts    | 334  (§1, rewritten — the flip)
     scripts/orbTieBreakReport.ts | 233  (§2, new — the three-policy report)
     tests/liveRun.test.ts        | 224  (§1 runOnce-level flip tests)
     scripts/liveRun.ts           | 162  (§1/§2 wiring, telemetry)
     tests/enemyBuffs.test.ts     | 115  (§1 selector tests)
     src/strategy/boonPriority.ts |  71  (§2, the orb tie-break)
     tests/boonPriority.test.ts   |  67  (§2)
     scripts/checkMaxRoom.ts      |  56  (§1, new — live maxRoom check)
     QUESTIONS.md                 |  47  (§24, new)
     SPEC.md                      |  43  (tier rule reversed, orbs measured)
     tests/rewardTier.test.ts     |  40  (§2 tie-rate pin)
     tests/enemyTier.test.ts      |  39  (renamed accessors)
     TASKS.md                     |  35  (Task 4.5 gate retired again, §4)
     src/sim/dungeonSim.ts        |  26  (Safe-tier default documented)
     src/strategy/boonCapture.ts  |  10  (rule-8 prose corrected)
     handoff/DECISIONS.md         |   7
     src/sim/enemies.ts           |   3
     tests/enemies.test.ts        |   3
```

---

# APPENDIX — session 57 verbose

## A. The two free GETs, in full

### A1. `npx tsx scripts/checkFishingCaps.ts` — the first action of the session
```
guard day (11:00 PT rollover): 2026-08-19   [file records: 2026-08-19]
hours until next reset:        11.77

GAME ledger  (dayDocs pond 2):  20 / 20
REPO ledger  (data/guard-budget-fishing.json): 20 casts, 240 energy

  dayDocs[pondId 1] = 0
  dayDocs[pondId 2] = 20

Ledgers agree.
VERDICT: BLOCKED — cap spent. Next window opens at 11:00 PT (11.77h).
```

Session start was 23:13 PT on 2026-08-19. The session-57 brief predicted this
exactly and it happened anyway, because the constraint is not knowledge — it is
that a session has to BEGIN in the right window. Seven sessions now.

### A2. `npx tsx scripts/checkMaxRoom.ts` — new, committed, read-only
```
LIVE dungeonDataEntities — ID_CID / NAME_CID / maxRoom:
    1  Dungetron 5000           maxRoom=16
    3  Underhaul                maxRoom=16
    4  Void Dungeon             maxRoom=17
    5  Forbidden Woods          maxRoom=16

Forbidden Woods (id 5):  live=16  discovered.json=16
VERDICT: OK — live value matches config/discovered.json.
```

The brief asked for `maxRoom` to be verified against a live response before it
governed anything, and this is that. Two things beyond the headline: **`maxRoom`
is published on every dungeon, not just the two known ones**, and **Void Dungeon
at 17 is the only outlier of four** — which re-confirms per-dungeon and is why
`pickTierForRoom` takes it as a parameter. The script exits non-zero on drift or
on the field disappearing, so it is a check and not just a dump.

## B. §2 — the full three-policy report

`npx tsx scripts/orbTieBreakReport.ts`:

```
ORB TIE-BREAK — 138 distinct offers, 552 decisions

  offers with a payout on EVERY option:  138 of 138  (100.0%)
  of those, payouts DIFFER across options: 136  (98.6%)
  mean spread (max - min) where they differ: 6.22 orbs

1. THE TIE RATE — how often two options share the winning priority rank

  decisions swept:                                  552
  no option matches any priority family:            312  (56.5%)
  a priority matched, but only ONE option:          224  (40.6%)
  TWO OR MORE tied at the winning rank:              16  (2.9%)
    ...and those tied options pay DIFFERENT orbs:    16  (2.9%)

2. WHAT IT IS WORTH — total Hard Core orbs taken, three policies

  decisions with a payout on every option (scored): 552 of 552

  A  BASELINE (priority -> rankBoons)          total 10256 orbs   mean 18.580/decision
  B  SHIPPED  (priority -> ORBS -> rankBoons)  total 10272 orbs   mean 18.609/decision
  C  WIDE     (NOT SHIPPED)                    total 11256 orbs   mean 20.391/decision

  B vs A:  +16 orbs over 552 decisions  (0.029/decision), pick CHANGED on 4 (0.7%)
  C vs A:  +1000 orbs over 552 decisions  (1.812/decision), pick CHANGED on 196 (35.5%)
```

**The detail that explains the shape.** All 16 tied decisions have differing
payouts — so the tie-break gets its chance every single time the rank ties. It
still only changes 4 picks, because on the other 12 `rankBoons` was already
choosing the richest option. The narrow rule is not being blocked by anything;
there is simply almost nothing for it to do.

**Why C is 62x and not 2x.** C's surface is the 312 decisions (56.5%) where no
priority family matches at all — nineteen times larger than B's 16. That is the
whole story: the field is valuable, the *gate on reading it* is what is narrow.

## C. Surprises, in the order they were hit

1. **CLAUDE.md rule 8 and DECISIONS (session 56) disagreed about fail-open vs
   fail-closed on an all-Perpetual offer.** Rule 8 says fail closed; the
   session-56 DECISIONS line says "Fails OPEN if one ever is: a preference
   among equals must not strand a 60-energy run." Both were right when written
   — session 56's clause could not change a tier, so it genuinely was a
   preference among equals. Under the flip it decides the tier. Resolved for
   CLAUDE.md (non-negotiable, and newer), and the reversal is appended to
   DECISIONS with the reason rather than silently overriding it. The final-room
   path keeps session 56's fail-open, so the repo now holds BOTH behaviours on
   purpose, in two functions, each documented against the other.

2. **The existing `runOnce` enemy-path tests were serving state with no
   `data.entity`.** `roomNum` therefore read 0. Post-flip, 0 is
   `final-room-unreadable`, so those tests were exercising the conservative
   branch — and since they only asserted that the promise resolved, **they
   would have passed while the live loop took the LOWEST tier in every room.**
   This is the near-miss of the session: the flip could have shipped green and
   inert. The new tests serve `entity: { ROOM_NUM_CID: n }` and assert the
   `tier_choice` log event's `rule`, `chosen.tier`, `position`,
   `topTierOffered` and `perpetualCostATier`.

3. **`locateLowestTierOption` was a second, independent copy of the tier rule**
   living on the retry path since session 09. It was equivalent to the rule for
   48 sessions and stopped being equivalent the moment the rule gained a filter.
   Retries happen on the action-token path where nobody is watching, so an
   inline max-tier scan could have taken a Perpetual card the decision path had
   just refused, once per token expiry, invisibly.

4. **`MAX_ROOM = 16` was a hard-coded literal** in `src/sim/enemies.ts` with a
   comment reading "from config/discovered.json" — true as provenance, false as
   mechanism. `liveRun` now prefers `config.maxRoom` (which really is read from
   `discovered.json`) and falls back to the literal only for a caller that built
   a config without one.

5. **`gigusOrbAmount` is present on 138/138 offers and on every option of each.**
   The partial-capture guard in the tie-break is therefore inert today. It was
   still written, because reading an absent field as 0 would hand the pick to
   whichever option happened to be recorded — the same shape as CLAUDE.md rule
   10's back-compat-default trap.

## D. What the first live run under the flip should report

Nothing here is gated on it and no run was authorised. But the corpus contains
**zero** observations of a deliberately-chosen hard win, so the first run is the
entire evidence base, and it is worth knowing in advance what to read off it:

- `tier_choice.rule` per room — if it is `final-room-unreadable` in rooms 1-15,
  the flip is not firing and `ROOM_NUM_CID` has moved. Stop and investigate.
- `tier_choice.chosen.tier` vs `topTierOffered` per room — how often they differ
  is exactly how often the Perpetual clause cost a tier. Expected ~35%.
- `perpetualCostATier` vs `perpetualAvoided` — the first is the tier-lowering
  case, the second the within-tier case. Both are logged separately.
- `boon_choice.priority.orbTieBreak` — expected to fire on roughly 3% of reward
  decisions, i.e. probably not at all in a single run. Its absence is not a bug.
- `gameItemBalanceChanges` item 845 totals — the actual Hard Core payout, which
  is the thing the whole reversal is for and which no corpus run can supply.
- The `start_run_energy_probe` event's `tightDelta` — §23 has been armed and
  unfired for four sessions; the first run answers it for free.

## E. Verification, at commit 9080355

```
npx vitest run      ->  Test Files  56 passed (56)
                        Tests  1014 passed (1014)      [was 988 at session 56]
npx tsc --noEmit    ->  clean
git diff --check    ->  clean
git status --short  ->  clean (no data/ or logs/ writes)
secret scan over `git diff HEAD~1` for
  0x[a-fA-F0-9]{4,} | noobId \d+ | eyJ | PRIVATE   ->  zero matches
.gitignore still covers .env, *.key, config/discovered.json, data/, logs/,
  fixtures/**/raw/, fixtures/**/*.har
```
