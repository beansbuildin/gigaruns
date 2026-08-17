# Session 25 — 2026-08-17

## Brief

Retry Task 10's 2-hour orchestrator gate now that session 24's potions leak
is closed structurally (`forbiddenWoods.potions` block removed entirely from
`config/bot.json`, not just reset to a safer number). User runs
`caffeinate -i npx tsx scripts/orchestrator.ts --hours=2` in their own
terminal (confirmed last session: Claude Code cannot hold a multi-hour
background process itself). Two loose ends noted but explicitly not
blockers: local guard-budget UTC-date drift, and local energy-tracking
under-recording — both cosmetic, self-correcting.

## Pre-flight

Before the user started the run, confirmed (by direct code read, not just
config read) that zero potions would load:

- `config/bot.json`: `forbiddenWoods` block has no `potions` key.
- `scripts/orchestrator.ts:119`: `resolvePotionLoadout()` — `if
  (!config.potions) return {};` — no config, no loadout, full stop.
- `scripts/liveRun.ts:1084`: same guard, explicitly logs "NOT configured —
  loading 0. This is the safe default, not a bug."

Neither script has any other path that loads potions absent that config
key, and the command about to run carries no `--potions=N` override. User
asked for this confirmation explicitly before starting the run — answered
directly rather than deferring to "the config looks right."

## Mid-run: energy-regen sleep question

~20 minutes in, the orchestrator hit real energy 4/420 (below the 12-energy
floor for even the cheapest fishing cast) and computed a ~1600s sleep. The
user manually topped energy back to 420/420 (via ROM claims, outside the
bot's own tracking) and asked how to tell the running process without
waiting out the full sleep.

Answer, after reading `orchestrator.ts`'s `sleepUntil()` and
`shutdown.ts`'s `nextSigintState()`: there is no live channel for this.
`sleepUntil` computes its duration once, from the energy value at the
moment the scheduler decided to sleep, and only re-polls real energy when
the sleep completes or a fresh invocation starts. A single Ctrl-C does NOT
just skip the current sleep — `nextSigintState` sets `requested: true` on
the FIRST press, which `sleepUntil`'s inner loop checks (breaks out) AND
the outer `while` loop in `main()` also checks (`!shutdownSignal.requested`)
— so one Ctrl-C ends the WHOLE 2-hour session, not just the wait. Given the
session's actual goal (one clean continuous unattended pass for the gate),
recommended letting the sleep ride out rather than interrupting — it would
re-poll on wake and immediately see the real 420/420 anyway, at the cost of
only idle time, not energy or a wrong decision.

Also clarified, since the user's phrasing suggested they thought this was a
missed feature: ROM energy auto-claiming was never built, by a standing
decision (`QUESTIONS.md` §11/session 20: "No automation work until
[a real per-ROM accrual rate] exists... still the standing instruction").
The scheduler only knows about passive `regenPerHour`, never about ROM
claims — that's why it had no way to know about the top-up. A real gap,
but a deliberate scope boundary, not a bug introduced this session.

## Gate outcome — PASS

Full run completed on its own. Verified against the gate line by line:

- **Zero unhandled exceptions.** Output ends cleanly at the rollup, no
  stack trace.
- **Zero potions used.** Confirmed post-hoc: grepped the full run output
  for any potion-related log line — none exist. Matches the pre-flight
  code-level confirmation above.
- **Both real daily caps hit, recognized cleanly.** Final line: `"▸ done
  for today: both modes' daily policy budget/cap exhausted (or neither is
  configured)"`. Rollup: dungeon 12/12 runs (216/240 energy, 24 remaining),
  fishing 20/20 casts (239/240 energy, 1 remaining).
- **Energy spend within budget** on both modes.
- **Daily rollup generated** — the `liveRun.ts --status` block shown above.
- **Real wall-clock time to exhaust both caps**, computed from the first
  and last `start_run`/cast action-token timestamps:
  `1787001530501 - 1786998807064 = 2,723,437ms = 45.39 minutes`. Of that,
  the single energy-regen sleep was ~1600s (~26.7 minutes), leaving
  ~18.7 minutes of active play across all 32 actions (12 dungeon runs + 20
  fishing casts). This project has guessed at this number for four
  sessions running (originally an 8-hour figure, since retired) — this is
  the first real measurement.
- **Scheduler balance confirmed live**: after 4 dungeon runs (80/240
  energy, 33% of budget) the scheduler switched to fishing (0% spent, full
  headroom) rather than draining dungeon to zero first — matches
  `scheduler.ts`'s documented "relative headroom" design (session 19), now
  verified against a real multi-hour run rather than a single smoke test.

`npx tsc --noEmit` and `npx vitest run` both re-run at session start (before
any new corpus landed) and after the corpus-processing work below, against
the final commit — 404/404, clean.

## Post-run: processing the new corpus

`npm test` (`npx vitest run`) came back 5 failed / 399 passed immediately
after the live run, exactly as `DECISIONS.md` 2026-08-16 predicts
("corpus-total assertions are EXPECTED to fail after every capture... read
one at a time, never reverted"). Worked through each:

**Two new boon pickup pairs.** `VulnerableEvade` (run-2026-08-17-20-37-00,
state-009→010) and `AddLifestealMagic` (run-2026-08-17-21-14-12,
state-035→036) were PICKED for the first time — both had been offered
since sessions 11/12 respectively but never taken. Used `boonPickups()`
from `src/sim/corpus.ts` (the one module permitted to know the wire shape,
per DECISIONS 2026-08-15) via a throwaway script to pull both pairs'
before/after `toCombatant()` states and raw `statusEffects`/
`triggeredBoons`. Both show **zero delta on every tracked field** — same
shape as `AddBurnSword`/`CorrosiveShield`/`CorrosiveMagic`. Modelled both
as `{kind: "latent"}`, `contaminates: ["STATUS_EFFECT"]`, per the
established precedent (a zero delta at pickup is a RESULT proving the
pickup changes no stat, not a gap — whatever these boons do is armed for
combat and unconfirmed).

**OBSERVED_OFFERS**: 65 → 90 entries (+25, one row per reward-pickup event
in the corpus, not per every offer ever shown — each row lists all 3
options at that pickup). Regenerated the missing 25 via a diff script
comparing `boonPickups()`'s output against the hardcoded table, then
hand-appended them to `src/sim/boons.ts` in the existing per-session-batch
comment style. Six genuinely new boon TYPES surfaced for the first time in
this batch (checked via `grep -c` against the pre-session file — zero
prior occurrences): `BurningEvade`, `AddVulnerableSword`,
`ArmorDepletedVulnerable`, `AddWeakMagic`, `WeakeningCrit`,
`AddVulnerableMagic`. All offered, none picked — left unmodelled per
DECISIONS 2026-08-15's rule against inferring effects from names.

**`UNMODELLED_TYPES`** is auto-derived (`OBSERVED_OFFERS.flatMap(...).
filter(t => !BOON_MODELS[t])`), so only the hardcoded test literal in
`tests/boons.test.ts` needed updating — removed `AddLifestealMagic`/
`VulnerableEvade` (moved to modelled), added the six new types with
session-25 comments.

**"Wall 1" room-1 clean-boon tests**: room-1 option count 93→123 (+30, ten
new room-1 offers × 3 options). Of those 30, three are the DEF-variant
`UpgradeScissor` (already-known clean) — three more clean picks join the
set (14→17 total clean entries). Everything else is a rolled stat, the
newly-modelled-but-latent `VulnerableEvade`, or one of the six new
unmodelled types — none newly clean.

**Heal-rooms test**: `[1,1,2,2]` → `[1,1,2,2,3,3]` — two new Heal sightings
this session, both at room 3 (`Heal`'s first sighting past room 2).

**Distinct player loadouts** (`tests/enemies.test.ts`): two new combos,
`42/18` and `42/26`, both traced by a throwaway script cross-referencing
`pickedBoons` at the state where each combo first appears: `42/18` is the
existing `42/16` starting loadout + a +2 `AddMaxArmor` pickup (three
independent runs each took one); `42/26` is `42/16` + a +10 `AddMaxArmor`
offer (one run's room-3 offer — the biggest `AddMaxArmor` roll seen yet).
Neither is a new starting loadout.

Final state: **404/404 tests passing, `tsc --noEmit` clean.** All three
throwaway inspection scripts (`scripts/tmpInspectBoons.ts`,
`tmpDiffOffers.ts`, `tmpLoadoutCheck.ts`) deleted before commit — they were
one-shot corpus queries, not part of the shipped tooling.

## New lead: `data.nextPosition`/`data.nextMovePath` (fishing)

Three fishing casts this session tripped `liveFishing.ts`'s pre-existing
(not built this session) unknown-terminal-field detector — a diagnostic
that fires when a cast's final `play_cards` response carries fields the
schema doesn't recognize, logs them, and dumps the full response to
`logs/fishing-unknown-terminal-*.json`. Non-fatal by design; the cast
itself resolved normally each time.

The code's own inline log string guesses this is "the catch-resolution
mechanic (QUESTIONS.md §10)" — the mechanic where a completed-but-unresolved
fishing doc blocks further casts until something acknowledges
`cardsToAdd`/sets `cardChosenId` (see `QUESTIONS.md` §10, resolved session
17 for the ACTION but the exact request that fires it was never captured).

**That guess does not hold up against the actual dumps.** Inspected two of
the three (`logs/fishing-unknown-terminal-2026-08-17-20-41-10.json`,
`...-21-10-29.json`) directly:

```
doc.data keys (partial): ..., fishPosition, previousFishPosition, ...,
  lastMovePath, nextPosition, nextMovePath, ...
```

`nextPosition`/`nextMovePath` sit structurally next to `fishPosition`/
`previousFishPosition`/`lastMovePath` — the fish's grid-position tracking
— not anywhere near `cardChosenId`/`caughtFish` (the actual catch-resolution
fields captured session 17). One dump has concrete values:

```
fishPosition: [2, 3]
previousFishPosition: [3, 3]
lastMovePath: [7]
nextPosition: [1, 3]
nextMovePath: [3]
gridSize: 4
```

This reads far more plausibly as a **look-ahead reveal of the fish's next
move** than anything catch-related — `previousFishPosition` → `fishPosition`
is the fish's LAST move, so `nextPosition`/`nextMovePath` alongside it would
naturally be its NEXT one. The other dump (2026-08-17-20-41-10) has both
fields present but `null` — consistent with "no next move to predict"
on a cast where the fish had already fully escaped, which would strengthen
rather than weaken the look-ahead hypothesis. Not confirmed either way with
certainty (only 2 of 3 dumps inspected closely, and the detector only
checks the TERMINAL doc, so whether this is present on every turn's
response — which is where it would actually be useful, live, mid-cast — is
unknown).

**Why this matters if true**: the live fishing loop currently predicts the
fish's movement statistically, after the fact, via
`mineFishPatterns.ts`'s pattern mining over the transition log (this
session ran with 1 mined pattern, `perimeterWalk(cw)`, seeded from prior
sessions' data). If the server directly reveals the next move on a live
response, that removes the need for statistical inference entirely for
whichever turns it's present on — a much bigger lever than anything
currently scoped for Task 11 or Task 13's fishing side.

Not chased further this session — flagged in `STATE.md`'s open questions
and logged as `QUESTIONS.md` §12 (new) with both raw dumps referenced, for
whoever picks this up next (a fresh capture with the field explicitly
watched for on every turn, not just the terminal one, would settle it).

## Files changed (this session's commit, 9e32109)

```
$ git show --stat HEAD -- TASKS.md src/sim/boons.ts tests/boons.test.ts tests/enemies.test.ts
TASKS.md              |  64 ++++++++++++++++++++
src/sim/boons.ts      | 163 ++++++++++++++++++++++++++++++++++++++++++++++++++
tests/boons.test.ts   |  26 ++++++--
tests/enemies.test.ts |  10 +++-
4 files changed, 258 insertions(+), 5 deletions(-)
```
Plus 11 new dungeon-run fixture dirs and 20 new fishing-cast fixture dirs
(redacted, raw/ subdirs gitignored as usual). Secret scan on the full diff
(`0x[a-fA-F0-9]{4,}`, `noobId\s*\d+`, `eyJ`, `PRIVATE`) came back clean —
only matches were `0xUSER`/`<USER>`/`<JWT>` placeholders already in place.
