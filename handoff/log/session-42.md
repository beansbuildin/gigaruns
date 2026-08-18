# Session 42 — 2026-08-18

Brief: resume and complete the user's manually-started juiced Tier-3
Forbidden Woods run (§0, first action, required), then implement TASKS.md
Task 14 (§1: `buildJuicedStartRunEnvelope`, §2: `--juiced` CLI flag),
grounded in §0's own gate-verification outcome. Stretch: redact and file a
second live escape capture into the fishing fixture corpus (QUESTIONS.md
§15) — NOT attempted this session, genuinely out of time after §0-§2.

## §0 — resuming the live run

Baseline read before touching anything: `scripts/checkDungeonToday.ts` (new,
read-only) against `GET /game/dungeon/today` — `dayProgressEntities` for
Dungeon#5 was **3** (already reflecting the juiced run's own +3-at-start
increment from before this session, per session 23's established finding).

`npx tsx scripts/liveRun.ts --resume-existing --potions=3 --potions-used=0`
initially refused: `config/bot.json` has no `forbiddenWoods.potions` block
(deliberately absent since session 24 — see DECISIONS.md), and
`potionPolicyState` (the mid-combat `use_item` trigger) needs
`allowedItemId` to fire even on a resume. Same situation session 23 hit
resuming a stray run — re-added the block TEMPORARILY (`allowedItemId: 131`,
`maxPerRun: 3`, matching this run's actually-committed loadout), ran the
resume, removed it again immediately once the run ended. `config/bot.json`'s
diff in the final commit is a net no-op (comment-only change).

The run played rooms 1 → 7 live via the existing EV-engine policy
(`LIVE_CONFIG`, depth 3), firing `use_item` three times (HTTP 200 each, room
1 twice + room 2 once) at the potion policy's 0.5 HP-fraction threshold.
Died at room 7, own HP 0/43, after a string of increasingly bad EV rolls
(the model's own confidence stayed "low"/`uniform-below-floor` for rooms
2-7 — no opponent-model bootstrap exists yet for enemies 64/65/66/67/68/69
beyond room 1's `Enemy Room 63`, matching DECISIONS 2026-08-18 session 32's
own finding that the bootstrap's live-usable value is concentrated at room
1). This is the deepest death this corpus has ever recorded (previous
deepest: room 4/session 10's histogram, later room 5/6 in later sessions —
worth checking `scripts/deathRooms.ts` fresh if Task 11's parked dungeon
half ever revives).

Two HTTP 500s hit during path/reward selection (room 6→7 transition) —
both cleanly retried via the existing `postWithVerifiedRetry`, same
long-standing pattern (session 08 onward), no new finding.

## Reward-multiplier verification (the actual gate evidence for Task 14)

Checked `gameItemBalanceChanges` (SPEC.md §3f) across every kill-crediting
response in this run's fixtures:

```
state-019: [{id:846,amount:5},{id:846,amount:5},{id:846,amount:5}]   (room 1 kill)
state-035: [{id:846,amount:9}  x3]                                    (room 2 kill)
state-055: [{id:846,amount:14} x3]                                    (room 3 kill)
state-069: [{id:846,amount:19} x3]                                    (room 4 kill)
state-085: [{id:846,amount:25} x3]                                    (room 5 kill)
state-109: [{id:846,amount:31} x3]                                    (room 6 kill)
```

Base amount 5 at the first kill matches the user's own "5 Dendren Root"
reference point exactly — 3x is real, but implemented as THREE duplicate
entries of the base amount rather than one `amount: 15` entry. This was NOT
previously known (SPEC.md's only prior §3f capture, session 30, was a
non-juiced run with one single entry). Currency (item 845, Hard Core)
credits on this same run's reward-pick responses were single entries, not
tripled — noted, not investigated further.

`dayProgressEntities` re-read after the run ended: still 3, `updatedAt`
predating the resume. Since this invocation never sent `start_run` itself
(only resumed), this is consistent with the +3-at-start mechanism, not new
proof of it — the actual bot-initiated test still needs to happen.

## §1/§2 — Task 14 implementation

`buildJuicedStartRunEnvelope(dungeonId, index, consumables)` added right
after `buildPathSelectionEnvelope` in `scripts/liveRun.ts`, doc-commented
with the DECISIONS.md 2026-08-18 capture as its evidence, same convention
as the existing builders. Pinned test in `tests/liveRun.test.ts` against the
exact captured JSON.

Wired into the `start_run` call site (`runOnce`'s new-start branch) via a
new `deps.juicedStartRun?: { index: number }` — `undefined` (default)
preserves the existing `buildEnvelope` path exactly.

`--juiced` + `--juiced-index=N` CLI flags added to `parseArgs` (now
exported for testing, previously private). `--juiced` alone throws rather
than defaulting `index` to 3 — CLAUDE.md §2's "don't guess an unconfirmed
mapping" applied directly, since `index == tier` in general is still
unconfirmed.

**Potion-loading gating, the part that took the most thought.** Task 14's
own text says potions should load "ONLY when starting a genuinely new
juiced run" — and `config/bot.json`'s session-24 comment says the same
thing about its own removed `potions` block. Implemented as: the
config-auto-detect branch (implicit, no `--potions=N` typed) now only fires
when `args.juiced` is true; explicit `--potions=N` still works regardless
(needed for `--resume-existing`, which this session's own §0 used). The
`startConsumables` sent on a genuinely NEW `start_run` is ALSO gated behind
`args.juiced`, regardless of how `potionCount`/`potionItemId` got set — this
is the actual structural enforcement point (a resume never reaches this
code path at all, so it's unaffected).

**Correctness gap found while wiring the guard calls**: `assertCanStartRun`/
`recordRunStarted` hardcoded a 1-run-unit cost. A juiced run costs 3
(SPEC.md, user-confirmed session 23). Added an optional `runUnits` param
(default 1) to both — `scripts/liveRun.ts`'s new-start branch now passes
`config.energyCostPerRun * 3` / `runUnits: 3` when `deps.juicedStartRun` is
set. Not asked for by the brief, but without it a bot-initiated juiced start
would have silently under-counted the daily budget/session cap the moment
it actually ran.

## Corpus-total assertion drift (expected, per DECISIONS 2026-08-16)

The live run's 123 new fixture states tripped 4 stale corpus-total tests on
the first full-suite run (`OBSERVED_OFFERS`, enemy-id coverage, PLAYER
loadout ×2). Read and corrected one at a time, per the standing convention
(never reverted, never batch-suppressed):

1. `src/sim/boons.ts`'s `OBSERVED_OFFERS` — added 5 new offer entries
   (rooms 1-5, this run's own reward picks). Room 6's offer was initially
   EXCLUDED by `boonPickups`'s `room <= 0` guard (no `ROOM_ENEMIES` entry
   for "Enemy Room 68" yet) — added a 6th entry once that gap closed below.
2. `src/sim/enemies.ts`'s `ROOM_ENEMIES` — added room 6 (RISKY_TIER only,
   no Safe ever offered: `enemyPathOptions[]` was `{2,2,1}`) and room 7
   (clean SAFE_TIER) from this run's actual captured battle stats. This
   cascaded: `MAX_OBSERVED_ROOM` (derived) grew 4→7, `dungeonSim.test.ts`'s
   "Safe-tier walk reaches DEPTH_BEYOND_CORPUS" test's premise broke (a
   Safe-tier walk now hits `NO_TIER_CAPTURE` at room 6, not
   `DEPTH_BEYOND_CORPUS` at room 8) — rewritten to match, not just bumped.
3. `PLAYER`'s loadout (hpMax 42→43, armorMax 16→17, scissor DEF 13→15) —
   updated from the newest zero-`pickedBoons` state. Cascaded into
   `combat.test.ts`'s "regenerates on any winning move" test: at the old
   starting armor (2) the new DEF (15) would land EXACTLY at the new
   armorMax cap (17), no longer clearly demonstrating "plain regen, not the
   cap" — starting armor lowered to 0 to keep the demonstration clean.
4. Distinct-loadout count (`enemies.test.ts`) — two new combos, `43/17`
   (new starting loadout) and `43/25` (43/17 + one room-2 AddMaxArmor(8)
   pickup, not a second starting loadout).

All four fixes read the actual fixture data directly (via ad hoc Python/tsx
scratch scripts, not guessed) before writing the new expected values —
matching this project's own "corpus wins, don't infer" discipline.

## Verification

`npx vitest run`: **581/581 passing** (561 baseline + 20 new). `npx tsc
--noEmit`: clean. `git diff --check`: clean. All three re-run against the
actual final commit, not a mid-session snapshot.

No real `data/`/`logs/` path touched by any test — checked via `stat -f
"%m"` on `data/guard-budget.json`, `data/guard-budget-fishing.json`,
`data/nextPositionValidation.jsonl`, `data/opponent-model.json` before and
after a full suite run; all four predate the run.

## Not attempted this session

- A bot-initiated juiced `start_run` (Task 14's actual gate) — the code is
  ready but sending it would spend a fresh 60 energy / 3 run-units, which
  the brief did not authorize (today's real budget was already committed to
  the resumed run). Needs an explicit go-ahead next session.
- The QUESTIONS.md §15 fishing-escape-capture stretch item — genuinely no
  time left after §0-§2's own scope, correctly deprioritized per the
  brief's own explicit ordering.
