# STATE — session 66 — 2026-08-21 (PT) — code at commit 2bb0dc9

## Status
**BOTH GATE HALVES PASS.** Suite **1254/1254** (1223 → 1254, +31), `tsc
--noEmit` clean, `git diff --check` clean, secret scan clean across the whole
session diff, no test writes a real data path.

- **Gate 1 PASS** — the `nextPosition` override has a first-miss tripwire that
  fires on a synthetic miss, disarms, and persists across a simulated restart.
  Demonstrated failing **three** different ways (see "What works" §1c).
- **Gate 2 PASS** — the 14-cast lax-vs-strict Focus gap is answered by cast id,
  and the recap's "structural, not sampling noise" wording is **withdrawn**.

**This was an OFFLINE session by user decision. Zero casts, zero dungeon runs,
zero live actions of any kind.** The only network calls were the two read-only
ledger scripts, at the start and again at hand-off.

**Ledgers at hand-off: fishing 20/20 spent, dungeon 12/12 spent, guard day
2026-08-20, 0.15h to the 11:00 PT rollover.** Both were already full on
arrival; twenty casts and twelve run-units appear at 11:00 and **none of them
are authorized**.

## What works
- **§1a THE TRIPWIRE, and the reason it had to exist.** A Wilson lower bound
  computed from an unbroken streak **only ever climbs** — 12/12 ≈ 0.76,
  20/20 ≈ 0.84, 50/50 ≈ 0.93 — so no value the streak can reach lowers it, and
  the gate could never fire while the override behaved. Not a threshold
  problem: the fix is an **event that can occur**. `acted_miss` disarms;
  nothing else does.
- **§1b THE THREE CASES, in code and in the record.**
  `classifyPredictionOutcome` (`src/strategy/fishing/nextPositionArm.ts`,
  pure): `absent` (no `nextPosition`, ~98–99% of turns) / `not_acted`
  (present, did NOT steer — logged, never trips) / `acted_hit` / `acted_miss`.
  `NextPositionValidation` gains `overrideActive`; **absent means UNKNOWN,
  never "acted on"**, because the 12 rows written before the field existed
  cannot be re-attributed.
- **The disarm is a VETO, not a term in the bound.** Folded into
  hits/attempts, one miss is swamped by the next handful of hits and the
  override re-arms itself inside the same batch. Pinned: at **200/200 plus a
  disarm the bound stays > 0.97 and `ready` is false**. Nothing re-arms
  automatically — the module exports no re-arm function and a test pins that
  absence; a human deletes `data/nextPositionOverrideDisarm.json`.
- **Fails closed both ways, and is write-once.** Missing file = ARMED (the
  normal state); unreadable or wrong-shape = DISARMED. The FIRST miss stays
  the recorded one.
- **§1c THE GATE, demonstrated by breaking it three ways, each restored:**
  tripwire branch disabled → **2 fail**; `disarmOverride` stubbed to a no-op
  with the read path fully intact → **6 fail**; `readArmState` forced
  permanently DISARMED → **8 fail**, while *"does NOT wash out as the streak
  grows"* still **PASSES** — which is exactly the brief's point, and is the
  demonstration that a read-path-only assertion cannot tell a working tripwire
  from an override that is off forever.
- **Both session-64/65 traps addressed structurally, not by intention.**
  `nextPositionArmStatePath` went into `LiveFishingIsolatedPaths` in the same
  commit as the field and **failed 11 call sites at compile time**; `main()`
  POPULATES it, profile-scoped, pinned on the object literal's source text.
- **§3 THE MEMBERSHIP CHECK.** `npx tsx scripts/oilReachability.ts --gap`.
- **§2 THE RELAXING COST.** `npx tsx scripts/oilReachability.ts
  --relaxing-cost`, write-up at `handoff/reports/session-66-relaxing-cost.md`.

## What's broken
- **Nothing new. No live code executed this session, so nothing was found by
  running it** — which is worth stating plainly rather than leaving an empty
  section that reads as a clean bill of health. Sessions 64 and 65 were both
  bugs in things that looked shipped and had never executed the path that
  would break them; **the tripwire is in exactly that category right now.** It
  has never fired against a real server, only against a mock.
- **A weakness in my own §5 tests, found while demonstrating the gate:** the
  source-text populate assertions still PASSED with the tripwire branch
  disabled, because `disarmOverride(...)` remained textually present in the
  dead branch. Source-text pins prove a line exists, not that it runs. The two
  behavioural tests are what caught it, and that is the division of labour to
  keep.
- Carried: corrode modelled but inert in `dungeonSim` (**CLOSED decision**); a
  perpetual corrode would be under-modelled; 25 analysis scripts hold
  hardcoded paths; `boonCapture` stays OFF; distribution steps 3–6 remain the
  user's.
- Carried, and now a sixth occurrence: `tests/` holds **six divergent copies**
  of the fishing `fakeDoc` mock. The new one carries every field the live
  decision path reads (including `fishingConsumableSlotUsed`), but session
  65's lesson says a mock that omits a field is a DIFFERENT SERVER, and six
  copies is six chances to drift. Not consolidated — it would touch four test
  files' harnesses and was out of scope.

## Corrections to SPEC.md
- **None this session.** No live response was observed, so nothing could
  contradict the spec. Stated explicitly rather than left blank.
- **A correction to the SESSION-65 RECAP, which is gate 2** — see "Dead ends".
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **"STRUCTURAL, NOT SAMPLING NOISE" IS WITHDRAWN — the gap being 14 twice is
  two different non-findings stacked.** (1) The count is not evidence: seven
  casts were added between readings, ~0.96 new members were expected at
  14/102 = 13.7%, and adding zero has probability **0.36**. (2) The "same 14
  casts" is **arithmetic, not a finding**: gap membership is a per-cast
  property and the corpus only grows, so gap(109) ⊇ gap(102) and equal counts
  FORCE equal membership. Observing it teaches nothing.
- **The property the 14 share is real, exact, and is clause 2 restated.** A
  CAUGHT cast can never be in the gap (terminal `fishHp: 0` fails clause 1 —
  23 caught, 0 in the gap). And the gap is **not** "escaped with an empty
  terminal meter", which is **66** casts, of which **52** had already hit zero
  with a turn still to play. 66 − 52 = 14. The gap is precisely the casts
  whose meter emptied for the first and only time on the state that ended the
  cast — the case the clause was invented to exclude.
- **Do not quote the sim's +4.47pp as the cost of zero Relaxing stock.** Per
  oil the sim and the corpus agree (0.196 vs 0.167); the headline differs 2.4x
  purely because the sim reaches the lethal band on 22.8% of casts against the
  corpus's 11.0%.
- **Do not carry §19's batch shape forward as an authorization.**
  `SESSION_65_LIMITS` stays exported and unchanged, but its rationale is
  retired in both places a future session reads it.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`) before claiming a blocker; do not revert rule 8; do
  not re-run rule 8's closed measurement programme; do not read an
  `UNKNOWN FIELD` banner as a server change; do not assume a mock that omits a
  field is merely simpler.
- **`npx tsx` fails under the command sandbox** on this machine (`EPERM
  listen … tsx-501/*.pipe`). Every `tsx` invocation this session had to be run
  unsandboxed. Not a repo problem; do not chase it as one.

## Metrics
- **Live: NOTHING. 0 casts, 0 dungeon runs, 0 spend.** Two read-only ledger
  reads. Corpus unchanged at **109 casts**.
- **Suite 1223 → 1254 (+31).** New: `nextPositionTripwire.test.ts` 23,
  `oilReachability.test.ts` 10 → 18 (+8).
- **§2, EXPECTED not observed:** lethal trigger reachable **12/109 = 11.0%**
  (14 decision points, 11 casts with one and cast 13019682 with three);
  **10 of the 12 were CAUGHT ANYWAY**; 2 escaped (12975713, 12991353).
  Expected gain **+1.83pp**, 95% Wilson **[0.5pp, 6.4pp]**, ~**6 oils per
  extra fish**, ~2.2 oils/day for ~0.37 fish/day at the 20-cast cap.
- **§3:** gap = 14 of 109, **0 among the seven newest casts**; all 14 escaped,
  all 14 lax = strict + 1 turn with exactly one lax focus point.
- Oils held (last live read, session 65): **Relaxing 0, Focus 18** — the user
  is crafting more Relaxing.

## Open questions for Claude
1. **The tripwire has never met a real server.** It fires correctly against a
   mock. The override fires on ~1–2% of turns, so a live batch of 7 casts
   produces maybe 1–2 armed turns and most likely nothing at all. Is there any
   point budgeting casts to exercise it, or is the honest answer that it sits
   there until it fires on its own? I lean strongly to the latter — say so
   explicitly rather than leaving it implied.
2. **Relaxing Oil is worth about a sixth of what the sim's headline implies.**
   Now that it is priced (~6 oils per extra fish, 95% CI ~1.5–20), does the
   user still want to spend crafting time on it? The report is written to make
   that a priced decision; it is theirs, not mine.
3. **Should the six `fakeDoc` copies be consolidated into a shared helper?**
   `tests/helpers/liveFishingDeps.ts` exists for exactly this reason ("a guard
   that only covers one file is not a guard"). One session of work, touches
   four files, no behaviour change.
4. `boonCapture` stays OFF — still zero ordinary runs since the directive.
   **Third recap in a row saying so; consider it settled unless the user
   reopens it.**

## Files changed
```
 3 commits (75f44de, cab0566, 2bb0dc9). No new fixtures — offline session.

     tests/fishing/nextPositionTripwire.test.ts  | 521  (new — gate 1)
     src/strategy/fishing/nextPositionArm.ts     | 214  (new — the tripwire)
     tests/fishing/oilReachability.test.ts       | 170  (gate 2 + the §2 pricing)
     scripts/liveFishing.ts                      | 144  (wiring, the veto, main())
     scripts/oilReachability.ts                  | 135  (--gap, --relaxing-cost)
     handoff/reports/session-66-relaxing-cost.md |  97  (new)
     src/strategy/fishing/oilBatch.ts            |  14  (§19's rationale retired)
     tests/noHardcodedPaths.test.ts              |  11  (the new default path)
     handoff/DECISIONS.md                        |   8  (4 entries)
     tests/helpers/liveFishingDeps.ts            |   7  (the isolated path)
     tests/liveFishing.test.ts                   |  33  (stats signature + 11 call sites)
     3 other test files                          |   3  (the isolated path)
```
