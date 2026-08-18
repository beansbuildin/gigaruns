# SESSION 35 — 2026-08-18 — commit bfd9842

Same content as `handoff/STATE.md` at this commit, plus the raw test/script
output that STATE.md only summarizes.

---

# STATE — session 35 — 2026-08-18 — commit bfd9842

## Status
Task "CODEXIMPROVE #5: boon valuation + play-count persistence": **GATE
PASS** (self-assessed against the brief's own staged bar — all four
implementation steps shipped, not just steps 1-3). No `TASKS.md` gate
targeted, same as sessions 31-34.
**This closes CODEXIMPROVE's entire backlog (#1-#6, all now resolved across
sessions) and, with `CODEXREVIEW`'s 10/10 already resolved, BOTH Codex docs'
standing backlog is now fully closed — no open items remain in either.**
Next: no queued Codex work left; see "Open questions for Claude" below for
what's actually next.

## What works
- **`loot.ts`'s `pool`/`upgrade` scores now scale with the boon's real
  `val1`/`val2`**, not a flat per-category constant — normalised against the
  ONE confirmed real sample of each shape (`AddMaxArmor` +4 session-11 pair,
  `UpgradeRock`/`UpgradeScissor` +4 DEF session-09 pairs), so a bigger offer
  scores higher than a smaller one of the same type. Verified: 2 new
  regression tests (bigger `AddMaxArmor` beats smaller; bigger
  `UpgradeScissor` beats smaller).
- **`AddMaxHealth` is split out of the `AddMaxArmor`-sharing `pool` bucket**
  — `src/sim/boons.ts`'s `maxHealth` effect moves current HP WITH the new
  ceiling (nothing wasted, unlike an unfilled armor pool), so it's scored
  with the SAME "usable, not raw" formula `heal` already used (factored into
  a shared `usableHealScore()` helper, not a second formula). `categorise()`
  still returns `"pool"` for both — only the scoring inside `rankBoons()`
  branches. Verified: 1 new regression test (same val1, different score,
  both still categorised `"pool"`).
- **`playCounts` now persists across a process restart**, keyed by the real
  dungeon-attempt identity `DUNGEON_ID_CID` (the same field `src/sim/
  corpus.ts`/`deathRooms.ts` already use to split attempts) — new
  `src/orchestrator/playCountsPersistence.ts`, same schema-versioned +
  atomic-temp-file-rename + `acquireGuardLock`-reused discipline as
  `guardPersistence.ts`/`opponentModelPersistence.ts`. Wired into
  `scripts/liveRun.ts`'s `runOnce()`: loaded once the run's real
  `DUNGEON_ID_CID` is known, saved immediately after every increment
  (mirrors `opponentModelPersistence`'s "persist immediately" rule), deleted
  at every run-end path (`phase === "over"` and the null-state "no active
  run" return) — both win/death/flee land on one of those two paths.
  `undefined` (every existing test's default) preserves the old
  in-memory-only-and-zeroed behavior exactly. Verified: 13 new tests in
  `tests/orchestrator/playCountsPersistence.test.ts` (round-trip, corrupt-
  file fail-closed, schema-version mismatch fail-closed, atomic write, AND
  the two regressions CODEXIMPROVE #5 asked for by name — survives a
  simulated resume of the SAME run, resets to zero against a DIFFERENT run
  ID).
- **Step 4 (the brief's optional stretch piece) also shipped**: new
  `scripts/boonRankingCheck.ts` — a controlled, clearly-labelled sim
  comparison (NOT a corpus-validation claim) that applies two CLEAN modelled
  boons via `applyBoon()` and runs a short continuation (`simulate()` from
  the next room) to check whether `rankBoons()`'s preference matches which
  option actually rolls forward better. Run at N=5000/option: all 3
  controlled comparisons agree (bigger `AddMaxArmor` beats smaller;
  bigger `UpgradeRock` DEF delta beats smaller; `AddMaxHealth` beats
  `AddMaxArmor` at the same val1 on a hurt (30% HP) player, matching
  `PROBE_HP_FRACTION`'s existing "already going badly" threshold rather than
  a value picked to force agreement). One genuine nuance surfaced and kept,
  not hidden: at 50% HP the `AddMaxHealth`-vs-`AddMaxArmor` case is a real
  near-tie in BOTH the ranking score and the rollout's overlapping CI — armor
  is renewable through every future battle's own regen, HP is a one-time
  bank, so which is "better" at middling HP is a genuinely close strategic
  call, not a bug to paper over.
- Tests: **532/532 passing** (+16 from session 34's 516: +3 loot-ranking
  regressions in `tests/strategy.test.ts`, +13 in the new
  `playCountsPersistence.test.ts`). `npx tsc --noEmit` clean, checked against
  this session's final commit.
- `loot.ts`'s "UNVALIDATED, cannot be validated yet" header disclaimer is
  UNCHANGED and still accurate — `deepestScorableRoom` has not moved this
  session, no scored live run has reached a second boon decision. The new
  rollout check (above) is explicitly kept as a SEPARATE, differently-labelled
  claim from that disclaimer, per the brief's explicit instruction.

## What's broken
Nothing this session's changes broke — full suite green, tsc clean, at the
actual final commit. Fishing account status (QUESTIONS.md §15, stuck since
session 33) NOT re-checked this session — the brief's own "queued, not this
session" list said this session's work is dungeon-side and unaffected either
way, and no live calls of any kind were made this session (pure sim/code
work, per the brief's own scoping). Other pre-existing items, unchanged
since session 25: the scheduler can't learn about energy gained outside its
own tracking, and a SIGINT during an energy-regen sleep still ends the whole
session.

## Corrections to SPEC.md
None this session. Resolved IDs unchanged: forbiddenWoods=5, dendren
nodeId="5"/pondId=2. Move charges: unchanged, PRESENT.

## Dead ends
None — all four implementation steps landed on the first design, no
hypothesis tried and abandoned. One design decision worth flagging as a
judgment call, not a dead end: `AddMaxHealth`'s "usable" amount is the FULL
`val1` (uncapped), not `Heal`'s `min(val1, hpMax - hp)` — because the ceiling
moves WITH `hp` for this boon (`boons.ts`), literally copying `Heal`'s exact
cap formula would have wrongly scored it 0 at full HP (nothing is ever
wasted against a rising ceiling). Implemented as a shared score FORMULA
(`usableHealScore`) with a per-caller-computed `usable` amount, which reuses
the brief's named pattern (the formula) while staying mechanically honest
about what each boon actually does.

## Metrics
- `scripts/boonRankingCheck.ts`, N=5000/option, ev-engine policy, seed 1,
  continuation from room 3 (boon picked at room 2), mean rooms cleared ± 95%
  CI — controlled comparison, NOT a corpus-validated live claim:
  - `AddMaxArmor` val1=8: 1.939 ± 0.026  vs  val1=2: 1.765 ± 0.026 (ranking agrees)
  - `UpgradeRock` val2=8: 2.014 ± 0.025  vs  val2=2: 1.813 ± 0.026 (ranking agrees)
  - at 30% HP: `AddMaxHealth` val1=8: 1.270 ± 0.026  vs  `AddMaxArmor` val1=8:
    1.209 ± 0.028 (ranking agrees, CIs separate)
  - at 50% HP (not shipped as a case, checked during design): `AddMaxHealth`
    1.461 ± 0.027 vs `AddMaxArmor` 1.451 ± 0.028 — overlapping CIs, genuine
    near-tie, see "Dead ends"/"What works" above.
- No live dungeon or fishing runs this session (brief scoped to sim/code
  work only, explicitly).

## Open questions for Claude
1. **Both Codex docs are now fully closed** (CODEXREVIEW 10/10, CODEXIMPROVE
   #1-#6 all resolved as of this session). There is no queued Codex backlog
   item to hand back next session — worth deciding what the next session's
   spine actually is. Candidates already on record and untouched this
   session: QUESTIONS.md §15 (stuck fishing account, needs a human DevTools
   capture, not code); Task 14 (bot-initiated juiced `start_run`, also
   blocked on a human capture); the charge-reserve plateau
   (0.4/0.5/0.6 mutually indistinguishable at the N run so far, not urgent).
   None of these are code-shaped without a human capture first — worth
   asking directly whether there's a NEW direction to open, since the
   Codex-derived backlog that has been this project's spine for the last ~5
   sessions is now empty.
2. The 50%-HP near-tie found by `boonRankingCheck.ts` (see Metrics) is a
   real, reproducible finding about `AddMaxHealth` vs `AddMaxArmor`'s
   relative value at middling HP, not a bug — flagging in case a future
   session wants to dig into whether the ranking SHOULD resolve it one way
   deliberately (it currently doesn't, and nothing requires it to).
3. Same standing question as sessions 30-34: QUESTIONS.md §15 (stuck fishing
   account after an escape) still needs a human DevTools capture of what the
   real client sends after an ESCAPE. Not blocking any dungeon work.

## Files changed
```
 scripts/liveRun.ts                            | 47 +++++++++++++++++++++---
 src/sim/dungeonSim.ts                         | 11 +++---
 src/strategy/loot.ts                          | 65 ++++++++++++++++++++++++++++----
 tests/strategy.test.ts                        | 37 +++++++++++++++++-
 scripts/boonRankingCheck.ts                   | 130 (new)
 src/orchestrator/playCountsPersistence.ts     | 155 (new)
 tests/orchestrator/playCountsPersistence.test.ts | 128 (new)
```
(handoff/next.md, this session's own brief, is excluded — consumed as
input, not a work product of this session.)

---

## Raw output — full test suite, final commit

```
 RUN  v4.1.10 /Users/<USER>/Desktop/IdeaRalph/Giga


 Test Files  31 passed (31)
      Tests  532 passed (532)
   Start at  04:49:44
   Duration  997ms (transform 1.47s, setup 0ms, import 3.33s, tests 2.35s, environment 2ms)
```

`npx tsc --noEmit` — clean, no output.

## Raw output — `scripts/boonRankingCheck.ts 5000` (shipped config, hurt = 30% HP)

```
══════════════════════════════════════════════════════════════════════════════
BOON RANKING CHECK — 5000 runs/option, ev-engine policy, controlled comparison (NOT a live claim)
══════════════════════════════════════════════════════════════════════════════

A. AddMaxArmor — bigger val1 should roll forward better than smaller (pool scaling, requirement 1)
  rankBoons score:   AddMaxArmor val1=8 = 50.00  vs  AddMaxArmor val1=2 = 12.50  -> ranking prefers "AddMaxArmor val1=8"
  rollout (mean rooms cleared, continuation from room 3): AddMaxArmor val1=8 = 1.939 ± 0.026  vs  AddMaxArmor val1=2 = 1.765 ± 0.026
  ranking agrees with rollout direction: YES

B. UpgradeRock — bigger DEF delta should roll forward better than smaller (upgrade scaling, requirement 1)
  rankBoons score:   UpgradeRock val2=8 = 26.67  vs  UpgradeRock val2=2 = 6.67  -> ranking prefers "UpgradeRock val2=8"
  rollout (mean rooms cleared, continuation from room 3): UpgradeRock val2=8 = 2.014 ± 0.025  vs  UpgradeRock val2=2 = 1.813 ± 0.026
  ranking agrees with rollout direction: YES

C. AddMaxHealth vs AddMaxArmor at the SAME val1, on a hurt player (the split, requirement 2)
  rankBoons score:   AddMaxHealth val1=8 = 60.48  vs  AddMaxArmor val1=8 = 50.00  -> ranking prefers "AddMaxHealth val1=8"
  rollout (mean rooms cleared, continuation from room 3): AddMaxHealth val1=8 = 1.270 ± 0.026  vs  AddMaxArmor val1=8 = 1.209 ± 0.028
  ranking agrees with rollout direction: YES

══════════════════════════════════════════════════════════════════════════════
All controlled comparisons: the ranking's preference matches the rollout's direction.
══════════════════════════════════════════════════════════════════════════════
This is a controlled comparison over synthetic continuations, not a live claim, and it does NOT change
loot.ts's own unvalidated-against-corpus status — deepestScorableRoom has not moved. See loot.ts's header.
```

## Raw output — same script, `hurt = 50% HP` (design-time check, not shipped)

```
C. AddMaxHealth vs AddMaxArmor at the SAME val1, on a hurt player (the split, requirement 2)
  rankBoons score:   AddMaxHealth val1=8 = 49.05  vs  AddMaxArmor val1=8 = 50.00  -> ranking prefers "AddMaxArmor val1=8"
  rollout (mean rooms cleared, continuation from room 3): AddMaxHealth val1=8 = 1.461 ± 0.027  vs  AddMaxArmor val1=8 = 1.451 ± 0.028
  ranking agrees with rollout direction: NO
```
Both the ranking margin (49.05 vs 50.00) and the rollout margin (well inside
combined CI, ~0.055) are within noise at 50% HP — this is why the shipped
case uses 30% HP instead (matching `PROBE_HP_FRACTION`'s existing "already
going badly" threshold), not to force a particular outcome but because 50%
genuinely doesn't have one. See STATE.md's "Dead ends" section for why this
is read as a real strategic tradeoff (armor's per-battle regen vs HP's
one-time bank) rather than a bug.
