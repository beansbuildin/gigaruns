# session 23 — 2026-08-17

Brief (`handoff/next.md`, original): spend the 9 remaining non-juiced dungeon
runs, potions off; then 3 user-started juiced Tier-3 runs, bot-finished,
potions on, `maxPerRun=3`, one at a time, no auto-loop; correct SPEC.md's
juiced-multiplier note; defer Task 10. No conflict between STATE.md and
next.md at session start — session 22 left dungeon at 3/12 runs, 59/240
energy; fishing fully spent (240/240).

This session did not go as briefed. What follows is the incident, the fix,
and the terminology correction that resolved it — in the order they actually
happened, not cleaned up into the "intended" shape.

## 1. Opening batch — ran ahead of a user correction

Checked `--status`: 3/12 runs, 59/240 energy, matching STATE.md. Launched
`npx tsx scripts/liveRun.ts --runs=9 --potions=0` per the brief. The command
completed 5 full runs before the user's "stop" message landed (already queued
alongside the tool result — the command had already run to near-completion by
the time it was seen). A 6th run got cut off mid-combat at room 2 by a
`fetch failed` network error, leaving it stranded/active.

The user's message: this session was actually supposed to be about
completing juiced runs *already started* — not the plain 9-run batch from the
brief.

## 2. First diagnostic pass — wrong conclusion, later retracted

Checked live status: 8/12 runs, 157/240 energy (local guard). Ran
`--dry-run` to confirm a stranded run existed (room 2, HP 22/42, non-juiced
enemy Room 64) without sending anything.

Investigated "run 1" of the batch (`DUNGEON_ID_CID 24860624`, active before
this session's first command, `createdAt: 2026-08-17T17:02:38Z` — ~70s
before the first live call). Diagnostic method: loot table amounts from its
`tier_choice` log entries (`LOOT_AMOUNT_CID_array: [9]`, `[14]`, `[19]` for
rooms 2/3/4 — matching the established non-juiced baseline) and tier labels
("Risky"/"Safe", no "Gold Ring" mention anywhere). Concluded: not juiced, no
potions consumed (the bot's own `--potions=0` never fired `use_item`
regardless).

**This conclusion was wrong**, per the user's direct correction (message 2 of
this session): `isJuiced`/`consumables` are never exposed on any
`GET /game/dungeon/state` read — the diagnostic method had no actual
visibility into the thing it was claiming to rule out. The user confirmed
live that potions WERE consumed.

## 3. User correction #1 — the four-part problem statement

The user laid out four concrete problems:

1. Real dungeon run count was **11/12**, not the 8/12 the bot reported —
   3 (session start) + 3 (the user's own juiced-run start, consuming 3 of
   the 12 slots) + 5 (the bot's own runs) = 11.
2. The "run 1 not juiced, nothing consumed" claim above was wrong —
   user-confirmed live.
3. The manual player's "dungeon sack" reloads whatever potions were last
   selected on every dungeon entry, regardless of what a given `start_run`
   request's `consumables` field says — so the bot could have been silently
   carrying potions in and burning them on runs it thought were potion-free.
4. Direct ask: build better handling so this doesn't happen again.

### Real day-counter confirmed, live

`GET /game/dungeon/today`'s `dayProgressEntities` (a field that existed in
the schema's `.passthrough()` catch-all but was never explicitly typed or
read anywhere in the codebase) for `docId: "DayCount#<addr>#Dungeon#5"`
showed `UINT256_CID: 11` — exact match to the user's arithmetic. This is the
authoritative server-side count; the local `data/guard-budget.json` only
tracks actions the bot itself sends, so a manually-started run is invisible
to it by construction, not by a bug in the counting logic itself.

### Resolved the stranded run, then used the account's own real remaining slot as a controlled experiment

User chose: resolve the stranded room-2 run (potions off, matching its own
original policy), then use the account's real last remaining run slot as a
plain non-juiced run rather than another juiced attempt (given only 1 real
slot was left and the juiced plan for today was already compromised).

Captured Big Heal Juice balance immediately before (`70`) and after (`70`,
unchanged) this one controlled fresh `start_run` with `consumables: []`. This
is a real, clean data point: a genuinely NEW start with an explicit empty
`consumables` did NOT pull anything from the sack. It does not explain what
happened on the user's own manually-started juiced run (never captured by
this process) or on a RESUMED run (which never sends its own `consumables`
field at all, fresh or otherwise).

Real day-counter after this run: **12/12** — dungeon fully spent for today,
server-side, hard stop.

## 4. The fix — `ResumeConfirmationRequired` + real-count check

Two pieces, both in `scripts/liveRun.ts`:

**a. Resume confirmation gate.** In `runOnce`'s "existing run found" branch,
before printing anything or reading further state:

```ts
if (opts.requireResumeConfirmation && !opts.resumeExisting) {
  const hp = existing.data.run?.players?.[0]?.health?.current ?? "?";
  const hpMax = existing.data.run?.players?.[0]?.health?.currentMax ?? "?";
  const message = `An active run already exists (room ${room}, own HP ${hp}/${hpMax}) ` +
    `that this process didn't start. Its consumables/juiced status is NOT visible ` +
    `from here...`;
  if (dryRun) {
    console.log(`  ⚠ [dry-run] a REAL invocation would REFUSE here without --resume-existing: ${message}`);
  } else {
    throw new ResumeConfirmationRequired(message);
  }
}
```

`opts.requireResumeConfirmation` is set by `main()` only on `i === 0` of the
`--runs=N` loop — a run still active between iterations of the SAME
invocation was started by this same process (or explicitly confirmed already)
and needs no re-confirmation. `orchestrator.ts` passes no `opts` at all to
`runOnce`, so its continuous unattended loop is deliberately unaffected —
requiring interactive confirmation there would break its whole reason for
existing (Task 10's 8-hour unattended run). `--dry-run` warns instead of
throwing, since it never POSTs regardless — this keeps it useful as the
"what would happen" inspection tool even in this exact scenario.

**b. Real run-count cross-check.** New `findRealRunsToday(today, dungeonId)`
in `liveRun.ts`, pure/testable, matches `dayProgressEntities` rows by
`docId.endsWith(`#Dungeon#${dungeonId}`)`. Called in `main()` right after the
account is loaded, printed alongside the local guard count with an explicit
`⚠ DRIFT` flag when they disagree. Added `dayProgressEntities` to
`DungeonTodaySchema` in `src/api/schemas.ts` as a proper typed field (was
previously only reachable via the schema's `.passthrough()`, untyped).

Tests added (`tests/liveRun.test.ts`): `findRealRunsToday` matching/no-match
cases, and four `runOnce` cases — refuses without `--resume-existing` (no
POST sent), proceeds with it, dry-run warns instead of throwing, and no
confirmation required when `opts` is omitted entirely (matching
`orchestrator.ts`'s call site).

## 5. Corpus fallout from the live batch — routine, not incident-related

This session's live runs (9 dungeon attempts across ~230 combat states) grew
the fixture corpus enough to break 5 existing tests — the expected
"corpus-total assertions fail after every capture" pattern (DECISIONS
2026-08-15), not a regression from the fix above. Fixed by re-deriving every
number from the actual fixtures, not by loosening any assertion:

- **`AddMaxHealth` boon, first-ever pickup pair** (`run-2026-08-17-17-03-45`
  state-196→197): `selectedVal1` 8 → `hpMax` 42→50, `hp` 15→23 (both +8). New
  `BoonEffect` kind `"maxHealth"` in `src/sim/boons.ts` — explicitly NOT the
  same shape as `AddMaxArmor` (whose current `armor` does NOT move with the
  ceiling; this one's `hp` did, unprompted).
- **13 new `OBSERVED_OFFERS` entries**, generated programmatically (a scratch
  script computing the exact `fromCorpus` string array the test itself uses,
  diffed against the current table) rather than hand-transcribed, to avoid
  introducing a transcription error while fixing a data-integrity test:

  ```
  1: AddBurnSword(5,0) | AddEvasion(1,0) | AddIntuition(1,0)
  1: UpgradeRock(0,4) | AddIntuition(2,0) | AddEvasion(1,0)
  1: AddTenacity(2,0) | AddBlock(2,0) | AddEvasion(1,0)
  1: AddTenacity(2,0) | AddBlock(2,0) | AddLifestealShield(4,0)
  1: UpgradeScissor(0,4) | AddIntuition(1,0) | TieWeak(1,0)
  1: AddIntuition(1,0) | AddIntuition(4,0) | UpgradeRock(0,4)
  1: UpgradeScissor(0,4) | AddTenacity(2,0) | AddEvasion(1,0)
  2: AddBurnShield(3,0) | AddBlock(2,0) | AddWeakSword(2,0)
  2: AddEvasion(2,0) | AddBlock(2,0) | AddBlock(5,0)
  2: UpgradeScissor(0,6) | AddBurnShield(3,0) | AddTenacity(2,0)
  2: UpgradeScissor(4,0) | Regen(1,0) | AddEvasion(1,0)
  3: AddIntuition(1,0) | AddLuck(1,0) | AddLifestealShield(4,0)
  3: AddLuck(2,0) | AddTenacity(2,0) | AddMaxHealth(8,0)
  ```

  Zero entries needed removal — the existing table was clean, just behind.
- **`PLAYER` baseline re-derived** from the newest unbooned capture: real
  gear re-spec, hpMax 38→42, rock (Sword) 20/4→16/0 (gear boost gone),
  scissor (Spell) 12/8→18/13 (new gear boost). This cascaded into two more
  test updates: `tests/combat.test.ts`'s "regenerates on ANY winning move"
  test (hardcoded armor value 10 → 15, matching the new scissor DEF), and
  `tests/dungeonSim.test.ts`'s random-vs-random sanity band (upper bound
  0.8 → 0.9, since the real stronger gear pushed even a random policy's
  measured win rate to ~0.82 — a real stat effect, not sim degeneracy).

Final: `npx tsc --noEmit` clean, `npx vitest run` 375/375 (up from 356/356 at
session start).

## 6. User correction #2 — the full terminology picture, before commit

Before committing, the user supplied the clarification that explains
everything above:

> "juice"/"juiced" is three unrelated game concepts sharing one word:
> 1. `isPlayerJuiced` — an account-level PURCHASED buff (more energy, more
>    ROM output, 4x Hard Cores across dungeons AND fishing). Nothing to do
>    with any specific run. Confirmed reading `true` on this account right
>    now.
> 2. "Juice" as an item name — Big Heal Juice, etc. Ordinary potions.
> 3. A "Juiced" Forbidden Woods run MODE — 60 energy (3x normal), consumes
>    3 of the 12 daily run-count units (confirmed: the 3+3+5=11/12 arithmetic
>    above), requires clearing only 1 room's worth of fights (same combat
>    effort as a normal run), and pays 3x every room's reward (5 Dendren Root
>    → 15 at room 1). Economic rationale: 3 Big Heal Juice spent across ONE
>    juiced run buys the yield of 3 normal runs, vs. needing 9 Big Heal Juice
>    across 3 separate normal runs to match it.
> 3.1. The dungeon sack will be left EMPTY going forward (user's own
>    decision) — the bot should instead be built to equip potions
>    specifically when entering a JUICED run.

This also confirmed the earlier arithmetic-only inference ("one juiced run
consumes 3 daily-run-count units") as a directly-stated fact, not just a
coincidence in the numbers.

**Consequence for future work:** `start_run`'s captured envelope has still
never once carried a `tier` field or sent `isJuiced: true`, in any capture
across 23 sessions — there is no confirmed request shape for the bot to
construct a juiced start itself. Scoped as new **TASKS.md Task 14**,
explicitly BLOCKED on a live DevTools capture of that real request body
(CLAUDE.md §2 — guessing at this shape is exactly the failure mode that
caused this session's incident in the first place, just via a different
field).

SPEC.md's Forbidden Woods section rewritten with the full three-concept
breakdown and the confirmed 3-run-slot/3x-reward/1-room-effort mechanics.
DECISIONS.md got three new entries (the incident itself, the confirmed
terminology, and the sack-empty directive).

## 7. Commit

`git commit 3cce4a1` — "session 23: resume-confirmation safety gate + real
run-count check, corpus updates, juiced-mode terminology corrected". 271
files (mostly new redacted fixtures from the live batch), 136146 insertions.
Secret scan on the diff (`0x[a-fA-F0-9]{4,}`, `noobId\s*[0-9]+`, `eyJ`,
`PRIVATE`) — clean, zero matches. `.gitignore` still covers `.env`, `*.key`,
`config/discovered.json`, `data/`, `logs/`. Spot-checked two new fixture
files directly for the real wallet address / JWT prefix — clean.

## What did NOT happen this session

- **Zero juiced runs completed.** The originally-planned 3-run juiced batch
  never started — the day's real run budget (12/12) was exhausted resolving
  the incident and finishing the plain batch before a juiced attempt could
  proceed on solid ground.
- **`ResumeConfirmationRequired` was never exercised against real server
  state.** It's unit-tested only. The account's real run budget was maxed
  before any subsequent live invocation could hit an actual pre-existing
  active run under the new code path.
- Task 10's 8-hour orchestrator run — explicitly deferred, per the user's own
  standing instruction from the original brief.
- Fishing and ROMs — untouched, both already fully spent/claimed as of
  session 22 (same calendar day).
