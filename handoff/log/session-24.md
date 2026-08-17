# Session 24 — 2026-08-17

## Brief

Spine: Task 10's real unattended gate, on a day with full fresh dungeon/
fishing budgets. Revise the 8-hour gate to 2 hours first (with reasoning),
then run `orchestrator.ts --hours=2` outside an interactive session, then
report real numbers. Juiced runs explicitly out of scope.

## Part 1 — Gate revision and pre-flight

Updated `TASKS.md`'s Task 10 gate text: retired the 8-hour figure (it
predates the confirmed real per-day counts — 12 dungeon runs, 20 fishing
casts — and reads like it assumed energy-regen was the binding constraint,
which it isn't). New gate: a 2-hour ceiling, not a target to fill; zero
unhandled exceptions; correct cap recognition + clean idle; rollup
generated; energy within budget; report real wall-clock time to exhaust
both caps.

Pre-flight check via `npx tsx scripts/orchestrator.ts --dry-run`: real
energy 163/420. `npx tsx scripts/liveRun.ts --status` showed local guard at
9/12 dungeon, 20/20 fishing — matching session 23's end state exactly, same
UTC date key (`2026-08-17`).

Direct check of real server state (`GET /game/dungeon/today`):

```
$ npx tsx <script hitting client.getDungeonToday()>
[]   // dayProgressEntities — completely empty
```

Zero real dungeon runs today, server-side — confirming the game's daily
reset had already happened mid-way through the same UTC calendar date, even
though the local guard's date key (`new Date().toISOString().slice(0,10)`)
hadn't rolled over. No fishing-equivalent endpoint exists to check the same
thing for casts, so the fishing side was inferred (same account, same
reset event), not independently confirmed.

Corrected `data/guard-budget.json` and `data/guard-budget-fishing.json`
(both gitignored) from the stale 9/12 dungeon / 20/20 fishing / 177+240
energy to `{energySpent: 0, runsStarted: 0}` — otherwise the orchestrator
would hit an artificial local cap instead of the real one, defeating the
point of testing cap recognition.

Baseline: 375/375 tests, `tsc --noEmit` clean.

## Part 2 — Launch attempts blocked by the harness

Tried `nohup npx tsx scripts/orchestrator.ts --hours=2 > log 2>&1 & disown`
— blocked by the Claude Code auto-mode classifier. Tried the Bash tool's own
`run_in_background: true` — also blocked, same classifier, same reason
("Blocked by classifier"). Both are launching a multi-hour unattended
process that plays the live game unsupervised; the harness's own safety
layer treats that differently from CLAUDE.md's own "dungeon/fishing play
within budget is autonomous-safe" authorization, and per the tool's own
guidance, workarounds were not attempted — the user was asked directly.

User chose: run it themselves in their own terminal. Command handed off:

```bash
npx tsx scripts/orchestrator.ts --hours=2 2>&1 | tee logs/orchestrator-2h-manual.log
```

## Part 3 — The incident

User ran it, watched the live client, and hit Ctrl-C almost immediately:
the run had committed 3x Big Heal Juice on a `start_run`, contradicting a
standing rule (their words): "any non juiced runs will NOT ever use
potions (juices) anymore."

Three questions asked, in order:

**1. Config value.** `config/bot.json`'s `forbiddenWoods.potions.maxPerRun`
read `3` — confirmed, matching the user's own bet. This was session 23's
value, raised specifically for that session's planned juiced Tier-3 batch
("Ask the user whether to revert to 2 after this batch" — own comment).
That batch never happened (session 23 became incident response instead),
so the elevated value sat untouched into this session.

**2. Balance damage.** User-reported: 70 before, 67 after (-3). The run's
own log confirmed exactly:

```json
{"action":"start_run","dungeonId":5,"actionToken":0,
 "data":{"consumables":[131,131,131],"isJuiced":false,"index":0}}
```

3 committed, 3 debited. Exact match, nothing unaccounted for.

**3. Was `maxPerRun` enforcement itself broken?** No. The log showed exactly
2 real `use_item` POSTs (both HTTP 200, indices 0 and 1) — the cap did
precisely what the stale config said, no overrun, no double-spend. The real
defect is structural: `liveRun.ts`/`orchestrator.ts` apply
`forbiddenWoods.potions` to *every* `start_run` unconditionally — there is
no juiced-vs-plain gating in code at all. That gating is `TASKS.md` Task 14
(blocked on a DevTools capture), whose own design already specifies
potions load "ONLY when starting a genuinely new juiced run." Until Task 14
exists, ANY nonzero value in that config block — not just today's stale 3 —
would have leaked into a plain run.

**Fix applied:** removed the `potions` block from `config/bot.json`
entirely. `src/orchestrator/config.ts`'s zod schema requires `maxPerRun`
positive, so `0` isn't valid in-block — removal is the only way to actually
zero it, and matches the established "absence = 0 potions, full stop"
contract from session 17. Verified via `--dry-run`:
`potions: NOT configured -> loading 0`.

Logged as an incident in `DECISIONS.md` (2026-08-17, session 24).

## Part 4 — Test breakage from the incident run's own fixture capture

The 72-state fixture capture from the interrupted orchestrator run (before
the Ctrl-C) tripped the project's standard "corpus-total assertions are
expected to fail after every capture" pattern:

- `OBSERVED_OFFERS is exactly what the corpus recorded` — 4 new room 1-4
  boon offers not yet in the table. Added with sourced commentary
  (`src/sim/boons.ts`), all previously-known unmodelled/rolled types except
  `IntuitionArmor` (room 4, first-ever sighting, still unmodelled/unpicked).
- `UNMODELLED_TYPES` literal — needed `IntuitionArmor` inserted
  alphabetically.
- Room-1 offer-option count literal — `90` → `93` (+3 from the one new
  room-1 offer, 3 options).

`npx vitest run`: 379/379 after the fix. `tsc --noEmit` clean.

## Part 5 — Recovering the stray room-5 run

User: "handle the room-5 run first. enemy is defeated, need to select
reward and next enemy. one big heal juice remaining for that live run
only."

`--dry-run` confirmed the `ResumeConfirmationRequired` gate firing against
REAL server state for the first time ever (built session 23, never live-
exercised until now):

```
⚠ [dry-run] a REAL invocation would REFUSE here without --resume-existing:
An active run already exists (room 5, own HP 9/42) that this process
didn't start. ...
```

To let the resumed run use its last committed potion, the `potions` config
block was briefly restored (`maxPerRun: 1`, matching exactly what was
authorized) for one single blocking foreground command, then reverted
immediately after — documented inline in the config comment as TEMPORARY,
scoped to that one invocation.

First real attempt (`--resume-existing --potions=1`) auto-progressed
through the pending reward pick and enemy-path pick (Safe tier, `path_three`
sent for real, HTTP 200) into combat against a new enemy (Enemy Room 67,
HP 45/45 ARM 18), then tried `use_item` at index 0:

```
✗ use_item: HTTP 400 — {"success":false,"message":"Item not found in index",...}
✗ Guard tripped: use_item rejected {"itemId":131}
```

Failed safely — 0 energy cost, guard tripped and halted per CLAUDE.md §5
rather than guessing further.

**Root cause, second bug this session:** `usePotionLive`'s index argument
is `potionPolicy.used`, which is process-local and always starts at 0 —
correct for a run this same invocation started, wrong for a run whose
committed consumables were already partly used by an earlier, now-dead
invocation (2 of the original 3 were consumed by the interrupted
orchestrator process before the Ctrl-C). The server's per-slot index
doesn't reset; slot 0 stays permanently spent for that run.

User supplied the missing information directly: "each potion has it's own
slot in the dungeon sack, the potion remaining is in slot 3" — i.e. index 2
(0-based), matching exactly: 2 already used (indices 0, 1) + 1 remaining
(index 2).

**Fix:** new `--potions-used=N` CLI flag on `scripts/liveRun.ts`, seeding
`potionPolicy.used` from a real supplied count instead of assuming 0.

```
npx tsx scripts/liveRun.ts --resume-existing --potions=1 --potions-used=2
```

```
★ Task 12 Stage B: using potion (itemId 131, index 2)
✓ use_item: HTTP 200
room 5  me HP 29/42 ARM 0  |  Enemy Room 67 HP 45/45 ARM 18
```

Worked — index 2 was correct, heal landed (9→29, the known flat +20 Big
Heal Juice amount).

The run continued via the normal Safe-tier/expectimax strategy across 6
more exchanges (opponent model genuinely thin for this specific enemy the
whole way — `n=0` through `n=6`, `confidence=low` throughout, not a bug,
just real under-sampling). Enemy HP dropped 45→19. A bad final exchange at
1 HP killed the player (HP 0) before the enemy went down. Room-5 run is now
fully resolved (death ends it same as a win would have) — confirmed via a
final `--dry-run`: `no active run`.

Config immediately reverted back to the safe absent-potions state per the
original commitment. `npx vitest run`: still 379/379 (this run had no boon
pickups — died mid-combat, never reached a reward phase). `tsc --noEmit`
clean.

## What Task 10's actual gate still needs

The 2-hour live run itself was never actually attempted post-fix — the one
real attempt today was aborted ~1 minute in by the incident, before the
orchestrator's scheduler/shutdown mechanics were exercised past the very
first `start_run`. Next session's first move should be a clean retry now
that potions are structurally off (`config/bot.json` has no `potions`
block) rather than merely "off this time by discipline."

## Full incident + recovery decision log

See `handoff/DECISIONS.md`, both 2026-08-17 (session 24) entries — the
config-fix incident and the resume-index bug/fix — for the complete,
already-redacted writeup with full reasoning, kept in sync with this log.
