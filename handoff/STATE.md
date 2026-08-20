# STATE — session 58 — 2026-08-20 (PT) — code at commit 43be799 (+ a CLAUDE.md commit)

## Status
Session-58 brief: **§1 DELIVERED IN FULL. §2 and §19 NOT ATTEMPTED — server cap,
not a choice. §0 and §4 delivered in this recap.**

**No gate was set by the brief.** §1 carried its own pre-registered decision
rule, which is the closest thing to a gate this session had, and it **PASSED
decisively**: ship policy C. Standing bar also met — suite 1028/1028,
`tsc --noEmit` clean, `git diff --check` clean, no test writes a real data path.

**Zero energy spent. Zero casts. Zero dungeon runs.** Three free GETs
(`checkFishingCaps`, `checkDungeonToday`, one `--dry-run`).

**THE TWO THINGS THE NEXT BRIEF MUST NOT GET WRONG:**

1. **ENERGY IS NOT A CONSTRAINT. Never write it into a plan or report it as a
   blocker.** User directive, delivered mid-session with visible frustration at
   having to repeat it. The account makes **~1368 energy/day** once its ROMs
   NFTs are counted; `GET /offchain/player/energy` reports only the passive
   regen pool (`energyValue`, `maxEnergy 420`, `regenPerHour 18`). This session
   read `energyValue: 11` and wrote off both live items for ~13 hours. That was
   fabricated. **`liveRun.ts` has had an energy preflight all along** — the dry
   run showed it reading a bank of 37 ROMs / **2251 claimable energy** and
   offering to claim 1 to cover a 60-energy run. Now CLAUDE.md rule 12.
2. **The real ceiling is the SERVER's run cap and it was already spent.**
   `real server runs today: 12/12 — any start_run will be rejected server-side`
   (`maxRunsPerDay: 12`). Fishing likewise 20/20. Both roll at 11:00 PT. The
   session began 08:30 PT, so §2 and §19 were unreachable for ~2.5h; **the user
   chose to recap and hand back rather than wait.** Not a failure to attempt —
   a scheduling fact plus a decision.

## What works
- **§1 SHIPPED: `orbRule: "wide"` is the live boon policy.** Where NO option
  matches a priority family (56.5% of decisions), the richest `gigusOrbAmount`
  wins and `rankBoons` breaks payout ties. It still cannot override a priority
  family — it only runs where the priority layer returned null.
- **Settled by a pre-registered rule, not judgement.** The brief fixed
  "ship if depth loss < 0.15 rooms" before any number existed.
  `scripts/orbDepthExperiment.ts`, n=8000/arm, identical seeds:
  **-0.0020 rooms, paired 95% CI [-0.0175, +0.0135]**, for **+6.30 Hard Core
  per run (+10.4%)**. The whole interval is ~11x inside the bar.
- **The pairing is load-bearing**: 6311 of 8000 seeds (78.9%) produce an
  IDENTICAL run in both arms. Unpaired half-width 0.0286 vs paired 0.0155.
- **Stage 0 (construct validity) passes, and it had to.** `applyBoon` moves
  player state for exactly SIX types — Heal, UpgradeRock/Paper/Scissor,
  AddMaxArmor, AddMaxHealth. `rolled` writes a stat `combat.ts` never reads;
  `latent` is `case "latent": break;`; unmodelled returns unchanged. So two arms
  differing only on inert options are **bit-identical** and a 0.00 would be a
  property of the instrument. Measured open: C differs on 34.4% of decisions,
  **25.8% of those touch a state-moving option**, 21.1% of seeds diverged.
- **`src/sim/orbOffers.ts`** joins recorded payouts onto the sim's offer table,
  135/135, complete on every option, `assertDistributionPreserved()` proving the
  offers are unchanged but for the added field.
- **`orbRule` is a `config/bot.json` knob AND is in the zod schema.** Zod strips
  unknown keys silently, so an unlisted knob would make `"tie-break"` (the
  revert) a silent no-op.
- **Wired live and proven at `runOnce` level**, not just unit level — three new
  tests where the ranker's pick and the payout's pick differ, so "the rule fired"
  and "the fixture happened to agree" cannot be confused. Session 57's tier flip
  is why this was done at that level.
- Suite **1028/1028** (was 1014), `tsc --noEmit` clean, `git diff --check` clean.

## What's broken
1. **§2 NOT ATTEMPTED. The rule-8 flip STILL has zero live exercise**, and now
   so does the wide orb rule. Both are fully tested against mocks and have never
   met the game. Unchanged from session 57 and now compounded by a second
   untested policy change.
2. **§19 UNMEASURED for an EIGHTH session.** Purely scheduling. The precondition
   is exactly one thing: **a session that BEGINS after 11:00 PT** on a day whose
   20 casts are unspent. It is NOT an energy question — see rule 12.
3. **§23's -1 energy drift still unexplained.** Probe armed, never fired, no run
   happened. Unchanged from sessions 54-57. Note this is about a LEDGER
   discrepancy, not about energy scarcity; rule 12 does not retire it.
4. **The sim now models a policy the bot does not play, in TWO ways** — Safe
   tier (session 57) and, for any historical arm, the un-enriched offer table.
   Deliberate. Every depth number it prints is a LOWER BOUND on difficulty.
   **Do not "fix" it.**
5. Carried, unchanged: git HISTORY still holds the noob token and three
   documents' identifiers (deliberate, `fixtures/README.md`).

## Corrections to SPEC.md
- **A corpus reward offer's room is `ROOM_NUM_CID - 1`.** The reward phase is
  reached with the counter ALREADY ADVANCED past the room whose clear produced
  the offer. Measured **135/135, no exceptions**. `scripts/orbTieBreakReport.ts`
  shipped in session 57 reading the raw wire value and was one room deep on
  every offer. **Corrected — and re-running gave A/B/C totals IDENTICAL to the
  orb**, so session 57's §24 numbers stand and the defect was inert here. It
  would not stay inert deeper: `room` feeds `priorityOf`'s rooms-1..8 lifesteal
  window and `rankBoons`' `roomsRemaining`.
- **17 of the 135 `OBSERVED_OFFERS` rows name a `source` file TWO STATES LATER
  than the one holding the offer** (uniform -2, five runs) — and those 17 are
  the corpus's DEEPEST offers (rooms 6-9). A source-keyed join drops exactly the
  rows a depth experiment most wants. Join on room+content instead.
- SPEC's `gigusOrbAmount` bullet now carries the wide rule and its numbers.
- `WireRewardOption` gains `gigusOrbAmount?`; `BoonOption` gains `orbs?`.
- **No live response contradicted SPEC this session.** There was no live play.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not read a raw endpoint and call it a blocker — exercise the real gate.**
  `liveRun.ts --dry-run` runs every guard, spends nothing, takes 20 seconds, and
  would have given the correct answer immediately. Reasoning from
  `energyValue: 11` instead produced a fabricated 13-hour blocker.
- **Do not join corpus payouts by `source`.** Silently drops the 17 deepest.
- **Do not treat a sim null on a BOON policy as evidence without stage 0.** The
  channel is closed for any comparison whose differing picks are all inert.
- **Do not use `SimOptions.offers` to change WHICH offers a room gets and then
  report the number.** Enriching every option with a recorded field is fine and
  is now a documented second use; `assertDistributionPreserved()` is the line.
- **Do not add a config knob without adding it to the zod schema.**
- Standing, unchanged: do not revert rule 8 to lowest-tier without a directive;
  do not re-implement the tier rule outside `enemyTier.ts`; do not apply a
  stat-only `enemyBuff`; do not widen a rule merely to make it fire; do not
  write a liveRun `runOnce` test without `vi.runAllTimersAsync()`; `npx tsx -e`
  cannot resolve this project's relative imports; never pipe a live run to a
  truncating reader.

## Metrics
- **Live dungeon: 0 runs. Live fishing: 0 casts. Energy spent: 0.** Three free
  GETs.
- **Caps at session start (08:30 PT), both ledgers agreeing:** fishing 20/20
  spent; dungeon `dayProgressEntities` Dungeon#5 = 12 of 12; server confirms
  "cap already reached, any start_run will be rejected". Roll at 11:00 PT.
- **§1, n=8000 per arm, identical seeds, `dungeonSim` Safe tier:**
  - B shipped (tie-break) mean rooms **3.2776**, orbs/run **60.333**
  - C wide                mean rooms **3.2796**, orbs/run **66.637**
  - paired B-C **-0.0020**, 95% CI **[-0.0175, +0.0135]**; bar 0.15,
    break-even 0.292; orb gain **+6.304/run (+10.4%)**
  - identical runs in both arms **6311/8000 (78.9%)**
- **§1 stage 0, 135 offers x 4 HP fractions = 540 decisions:** C differs from B
  on **186 (34.4%)**; of those, both options inert **138 (74.2%)**, at least one
  state-moving **48 (25.8%)**. orbs/decision B 18.670, C 20.437, **+1.767**.
- **§24 report re-run with corrected rooms, 552 decisions:** A 10256 (18.580),
  B 10272 (18.609), C 11256 (20.391) — **identical to session 57 to the orb.**
- Suite 1014 -> **1028**. Corpus unchanged (nothing captured).

## Open questions for Claude
1. **The next session's brief should open with the 11:00 PT clock, and nothing
   else in the first paragraph.** Both remaining live items — §2 and §19 —
   need only one thing: a session that BEGINS after 11:00 PT with the day's caps
   unspent. Eight blocked sessions for §19. Do not add conditions; do not
   mention energy.
2. **§2's live run is now MORE valuable, and its report should cover two
   untested policies, not one.** Tier offered vs taken per room, how often
   Perpetual filtered the top choice (~35% expected), whether `final-room` or
   `final-room-unreadable` appeared at all (**room 16 is unreachable — any
   `final-room-unreadable` is a BUG**), plus the ORB rule: how often
   `orbFallback` fired, `narrowed` true vs false, `orbsTaken` vs `orbsOffered`,
   and the run's orb sum. Check the first `tier_choice` AND the first
   `boon_choice` before letting the run continue.
3. **§23's probe is still armed and still unfired.** Report whether the pair
   around `start_run` reads -59 or -60.
4. **CLAUDE.md rule 11's energy derivation was DELETED this session** (user
   approved). The 4-runs/day ceiling now rests solely on 12 run-units / 3, which
   the server enforces. Rule 4 was retitled "Simulate first" for the same
   reason. Do not re-derive a ceiling from energy.
5. **`boonCapture` stays OFF.** Re-ask once ordinary play has produced a few
   runs' worth of free by-product coverage. Still zero such runs.
6. **§24 is CLOSED — answered yes, shipped.** Do not reopen it as a question.

## Files changed
```
 2 commits. 18 files, +1,043 / -33. No fixtures written (zero live play).

     scripts/orbDepthExperiment.ts | 234  (§1, new — stage 0 + the paired test)
     src/sim/orbOffers.ts          | 192  (§1, new — the 135/135 payout join)
     tests/orbOffers.test.ts       | 106  (§1, new)
     src/strategy/boonPriority.ts  | 102  (§1 — orbRule, chooseOrbFallback)
     tests/liveRun.test.ts         |  92  (§1 runOnce-level wiring tests)
     tests/boonPriority.test.ts    |  66  (§1)
     scripts/liveRun.ts            |  63  (§1 wiring, telemetry, startup line)
     CLAUDE.md                     |  49  (rule 12 new; rules 4 and 11 corrected)
     QUESTIONS.md                  |  41  (§24 resolved)
     SPEC.md                       |  32  (wide rule; the room off-by-one)
     src/sim/dungeonSim.ts         |  30  (BoonRecord.orbs; offers-hook doc)
     scripts/orbTieBreakReport.ts  |  20  (the room off-by-one fix)
     src/sim/boons.ts              |  14  (BoonOption.orbs)
     src/strategy/policy.ts        |  10  (orbs plumbed to pickBoon)
     src/orchestrator/config.ts    |   8  (orbRule in the zod schema)
     handoff/DECISIONS.md          |   6
     src/sim/corpus.ts             |   6  (WireRewardOption.gigusOrbAmount)
     config/bot.json               |   5  (orbRule knob)
```
