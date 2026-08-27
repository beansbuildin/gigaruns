# STATE — session 104 — 2026-08-27 — commit <SHA>

## Status
Brief had two parts, both dungeon-side, both offline. **Part A GATE PASS,
Part B GATE PASS.** Zero live spend: **no dungeon runs, no fishing casts, no
items consumed.** The only live calls were read-only (a `--dry-run` and the
run ledger).

⚠ **The brief's Part A was written from a stale premise and is the single most
important thing for the next brief to absorb** — see What's broken.

Suite **2063 passed / 2063, 111 files** (`vitest run --maxWorkers=4`; the
default over-subscribes this machine and produces FALSE timeouts — session 100,
unchanged). `tsc --noEmit` clean, `git diff --check` clean, secret scan **0 hits
on all four patterns over the diff**, `discoveredShipsClean` 8/8.

## What works
- **Part A — the proc effect sizes RE-VERIFY at +184 exchanges** (1919 → 2103),
  `npx tsx scripts/procEffectSize.ts`. `block` = `floor(ATK/2)` (partial
  reduction, never a negate), `evasion` = full negate, `lck` = exactly
  `2 x ATK`. **The matched control still matches ZERO times, now across 4111
  exchanges** — that separation, not the wide per-flag intervals, is the claim.
- **The method's sanity check reproduces**, as the brief asked: `intuition`,
  settled independently in §57/§58, comes back the same way — 5 of 6
  non-blocked fires took FULL ATK, and the sixth also carried `blockProc0` and
  took exactly `floor(ATK/2)`, which is block. The fired/unfired approach
  recovers a known answer before being trusted on the open flags.
- **`AddTenacity` raises tenacity's proc RATE but does not GATE it** — 20/380
  (5.26%) with the boon vs 4/551 (0.73%) without, Fisher **p = 2.23e-05**.
  Session 103's "n=4 runs supports no rule" is superseded for PRESENCE.
- **Enemies NEVER pick boons — `players[1].pickedBoons` empty on 5820 of 5820
  states** — which is what makes the enemy side a structurally boon-free
  control arm rather than a re-labelling of the same population.
- **§58's tenacity/OnHeal association SURVIVES the split**, so it is not an
  artifact of the boon: enemy side 4/23 = 17.4% fired vs 62/1125 = 5.5%
  unfired, **p = 0.0386**; player boon arm agrees (3/20 vs 7/360, p = 0.0119).
- **The DAMAGE verdict is unchanged in BOTH arms** (fired 16/19 track the plain
  null, unfired 1060/1151) — **pooling had not hidden an effect in one arm**,
  which is the question the split was actually asked to answer.
- **Part B — the Tier-1 switch is wired and dry-run clean.**
  `--juiced --juiced-index=1` sends `index 1`, still auto-loads 3x itemId 131,
  resolves energy via the ROM bank, and spends nothing (`energy spent 0,
  runs 0`). Ledger read after: **0 runs today**, confirming it.
- `src/sim/combat.ts` untouched. **CAPTURE-1's prohibition stands exactly as
  §58/§59 left it** — this session obtained inputs, it did not build the model.

## What's broken
- ⚠ **THE BRIEF ASKED FOR WORK THAT WAS ALREADY DONE, and the next brief must
  not repeat it.** Session 104's brief framed Part A as "§58's own unresolved
  half," quoting §58's line that rates are not mechanics. **§58 is the entry
  that RESOLVED it** — `scripts/procEffectSize.ts` and
  `tests/procEffectSize.test.ts` shipped in session 101, and four DECISIONS
  entries dated 2026-08-26 carry the verdicts. CLAUDE.md rule 9 applied and the
  repo won. Only two things were genuinely open and only those were done: the
  re-run at higher volume, and the brief's own item 2 (the `AddTenacity`
  split), which had never been done. **Read DECISIONS.md's 2026-08-26 block
  before briefing anything proc-related.**
- ⚠ **THE BRIEF'S TIER MAPPING WOULD HAVE COST SEVEN SILVER RINGS IF
  "CORRECTED".** `entryData` is returned ordered **tier 2, 1, 3**, so array
  position ≠ tier: `entryData[1]` is Tier 1 only by coincidence and
  `entryData[3]` does not exist. `data.index` is the TIER NUMBER (SPEC §3c,
  confirmed live twice). A future reader who "fixes" `--juiced-index=1` by
  reasoning about array offsets selects **Tier 2** and silently spends silver
  rings. Now pinned by test.
- **Tier-1's Hard Core payout is UNMEASURED and the ~quarter figure is a
  DERIVATION, not an observation.** Every juiced `start_run` this bot has ever
  sent used `index: 3` — **34 of 34** across the whole log corpus.
- Carried, untouched: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE
  QUOTED**; `CORPUS_DECK` still Shroom; `triggeredBoons` still never populates;
  `SecondWind` (n=10) and `Steadfast` (n=23) still unmoved and still will not
  yield to ordinary volume (session 103).

## Corrections to SPEC.md
- **None. `SPEC.md` and `SPEC-fishing.md` were not touched, and neither was
  contradicted.** SPEC §3c was *consulted* and proved RIGHT where the brief was
  wrong — it already documents both `index == tier` and the tier-2,1,3 array
  ordering. The correction was to the brief, not to the spec.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.
- **Correction to CLAUDE.md rule 11:** the standing entry tier is now
  `--juiced-index=1`, with the date, the ring-scarcity reason and the Hard Core
  cost stated in the rule itself.
- **`dropMultiplier` has NO consumer anywhere in `src/`, `scripts/` or
  `tests/`** — only a zod field and captured config data. Checked before the
  switch precisely because a reward-expectation path assuming Tier-3's `4`
  would have gone wrong quietly. None exists.

## Dead ends
- **Do not re-brief the proc effect-size measurement as open.** See What's
  broken. The verdicts are in QUESTIONS.md §58 and §62 and DECISIONS 2026-08-26.
- **Do not read the `AddTenacity` p-value as a clean significance test.**
  Exchanges cluster within runs and are not independent, so p = 2.23e-05 is
  anti-conservative. The DIRECTION is the finding; the figure is not.
- **Do not treat the tenacity/OnHeal result as a mechanic.** It is on 10 heals
  (was 6) and the heal AMOUNTS still cannot be bounded. Session 103's warning
  against fitting a rule to tenacity stands — this removes one confound from
  it, nothing more.
- **Do not read the player's boon-free tenacity arm as contradicting the heal
  result.** It is 0/4, p = 1.0 — uninformative, and reported as such.
- **Empty `run-` fixture dirs from `--dry-run` are expected, not corpus
  pollution** — 4 exist now, 3 predate this session. They hold only an ignored
  `raw/`, so git never sees them and `loadExchanges` skips them.
- Standing, none re-opened: redraw CLOSED; `--dry-run` before claiming a
  blocker; do not revert rule 8; +19.40pp SUSPENDED.

## Metrics
- **Live: 0 dungeon runs, 0 fishing casts, 0 energy, 0 items.** Ledger 0/12 on
  a fresh game day. One `--dry-run` and one ledger read, both read-only.
- **Proc corpus 1919 → 2103 exchanges** (1314 status-clean). Null holds
  **2378/2485**. Per-flag, status-clean / control:
  `blockProc0` 35/35, 0/1154 · `blockProc1` 10/10, 0/721 ·
  `evadeProc0` 3/3, 0/155 · `evadeProc1` 9/9, 0/707 ·
  `critProc0` 10/10, 0/677 · `critProc1` 11/11, 0/697.
- **Tenacity split, 8 cells:** boon+fired 20 (3 heals) · boon+unfired 360 (7) ·
  no-boon+fired 4 (0) · no-boon+unfired 547 (9) on the player side; enemy side
  fired 23 (4) · unfired 1125 (62), with **0 rows in either boon cell**.
- **Hard Core projection for the tier switch:** `dropMultiplier` 4 → 1. Session
  103's four Tier-3 runs paid **30,960**; the same four project to **~7,740**.
  Dendren Root unaffected (answers to `isJuiced`). **Projection, not measured.**
- Suite **2057 → 2063** (+5 tenacity-split cases, +1 stale-hint pin).
- Corpus unchanged: 83 dungeon attempts, 230 fishing casts.

## Open questions for Claude
1. **Where did the brief's stale premise come from, and can that be closed at
   the source?** Part A cost most of a session re-establishing that §58 was
   already answered. The recap → brief path lost it in one hop. Is there
   something the recap should carry (a "settled, do not re-open" digest) that
   would have prevented it?
2. **Should the first live Tier-1 run be shaped to MEASURE the payout?** The
   ~quarter figure is a derivation and Tier-1 has never been run here. One run
   gives an observed Hard Core number against session 103's 30,960 baseline —
   but the loadout and room depth vary, so a single run may not separate the
   tier effect from ordinary variance. Worth pre-registering what would count.
3. **Tenacity pick-ORDER is still untested.** Session 103 saw the rate move
   with order (pick 5 of 8 → 6/54; pick 6 of 7 → 0/38). The split done here is
   presence-only. Is order worth a targeted analysis, or does it go the way of
   `SecondWind`/`Steadfast` — real but not reachable by ordinary volume?
4. **The rod:** repair is the user's, outside this loop (§61.3). Fishing was
   out of scope this session and no cast was spent.
5. Unchanged and still deferred: session 100's open question 2 (should the live
   loop read the dungeon proc booleans in real time).

## Files changed
```
  M  CLAUDE.md                     rule 11: --juiced-index 3 -> 1, with the
                                     date, reason, cost and the index!=array
                                     -position warning
  M  TASKS.md                      CAPTURE-1: session 104 re-verification +
                                     the AddTenacity split
  M  QUESTIONS.md                  +§61 (3 user answers), +§62 (proc verdicts)
  M  handoff/DECISIONS.md          +9 lines
  M  scripts/procEffectSize.ts     +Exchange.boons, +tenacityByBoon, +report
  M  tests/procEffectSize.test.ts  +5 split tests (20 -> 25)
  M  scripts/doctor.ts             hint -> --juiced-index=1
  M  scripts/liveRun.ts            help text -> --juiced-index=1
  M  scripts/orchestrator.ts       2 hints -> --juiced-index=1
  M  tests/orchestrator/dungeonArmClosed.test.ts
                                     pin -> index=1, +no-source-recommends-3
  M  tests/enemies.test.ts         census doc: loadout now expected STEADY,
                                     with the non-retroactive caveat
  M  handoff/reports/*.md          timestamp only (0 runs, 0 casts)
```
