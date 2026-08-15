# session-14.md

Same content as `handoff/STATE.md` at the time of this commit, plus verbose
detail (full command outputs) not worth keeping in the always-loaded file.

---

## Brief's ask (session-14 brief, 6 items)

1. Resume the stuck run (session 13, room 3, HP 4/36) — first action.
2. Model `focusMeter` in `castSim.ts`, re-run the 500-cast sim, report the
   new catch rate against live's 0/6. The spine.
3. Re-derive SPEC §5's card-choice policy under the real focus budget — only
   after #2's number is known.
4. `focusMeter` regeneration probe, live, if fishing budget allows.
5. `consumables` field-shape test only (Task 12 Stage B) — establish the
   shape, do not build the timing policy.
6. Record the standing rule: sim authority is earned per domain, never
   inherited.

## What actually happened, in order

### 1. Resumed the stuck run

```
$ npx tsx scripts/liveRun.ts --dry-run --runs=1
▸ liveRun.ts — STAGE 1 dry-run
  · resuming today's budget: 196 energy / 11 runs already spent
  account <USER> noobId <NOOB>
▸ run 1/1
  · active run already exists at room 3 — resuming rather than starting a new one
room 3  me HP 4/36 ARM 0  |  Enemy Room 65 HP 38/38 ARM 15
  ...
  [dry-run] would POST paper
```

Confirmed still stuck exactly where session 13 left it. Then for real:

```
$ npx tsx scripts/liveRun.ts --runs=1
room 3  me HP 4/36 ARM 0  |  Enemy Room 65 HP 38/38 ARM 15   -> paper
room 3  me HP 1/36 ARM 0  |  Enemy Room 65 HP 38/38 ARM 9    -> paper
room 3  me HP 1/36 ARM 12 |  Enemy Room 65 HP 38/38 ARM 3    -> scissor
room 3  me HP 1/36 ARM 4  |  Enemy Room 65 HP 33/38 ARM 0    -> scissor
room 3  me HP 1/36 ARM 12 |  Enemy Room 65 HP 21/38 ARM 0    -> rock (enemy dies)
  ▸ reward: picking "CorrosiveMagic" (index 0)
  ▸ enemy path: choosing lowest offered tier 0 (Safe)
room 4  me HP 1/36 ARM 16 |  Enemy Room 66 HP 40/40 ARM 16
room 4  me HP 1/36 ARM 0  |  Enemy Room 66 HP 28/40 ARM 0
  · no active run — stopping.   (player died)
  ▸ energy: 266 -> 266  (spent 0)
```

Survived room 3 at HP 1/36 (never took a hit that would have killed at 1 HP —
the EV engine's own choices held), picked up `CorrosiveMagic` for the first
time in the corpus (first pickup pair — see boons.ts changes below), cleared
into room 4 at Safe tier, died there. Confirmed via `scripts/deathRooms.ts`:
12 confirmed deaths after this run (was 11), histogram 0/3/4/5.

### 2. Modelled `focusMeter` in the sim, re-ran the 500-cast sweep

Added to `src/sim/fishing/castSim.ts`:
- `FOCUS_METER_MAX = 3` (confirmed constant, session 13 live)
- `defaultStartFocus(gridSize)` — grid-center, `Math.ceil(gridSize/2)`,
  reproduces the one live cast's observed starting `focusPoint` of `[2,2]`
  on the confirmed 4×4 grid.
- `FishPolicyContext` gained a `focusBudget: FocusBudget` field.
- `simulateCast` tracks a running `focus: FocusBudget` state, threading it
  into `chooseCard` via `matcherFishPolicy`, and into `randomFishPolicy` via
  `reachableCells` (previously searched the whole grid).
- Focus never regenerates within a cast — the conservative reading, since
  regeneration ACROSS a cast is still unconfirmed (brief's own open
  question 3, not resolved this session — see below).

First measurement (`scripts/fishFocusMeter.ts`, n=500):

```
matcher-ev, focusMeter modelled, library known:  358/500 = 71.6%  (P(0/6 live) ≈ 0.052%)
random,     focusMeter modelled:                 42/500 = 8.4%   (P(0/6 live) ≈ 59.1%)
matcher-ev, focusMeter modelled, library BLIND:  35/500 = 7.0%   (P(0/6 live) ≈ 64.7%)

for reference, session 13's figure (no focusMeter, library known): 92.4% (P(0/6 live) ≈ 0.00002%)

[N=3000, independent seed] library known: 2097/3000 = 69.9%
[N=3000, independent seed] library blind: 308/3000 = 10.3%
```

The "library BLIND" row needed a real code change, not just a flag: added a
`matcherPool` option to `CastOptions`, separate from `candidatePool` (which
still controls what the TRUE fish pattern is drawn from). Previously the
same array served both roles, meaning the sim's matcher could always, in
principle, identify the true pattern — an assumption that doesn't hold live,
where the real Dendren pattern library is unknown and none of six real casts
(1 human + 5 bot, across sessions) have ever matched anything. `matcherPool:
[]` reproduces the live condition: the matcher stays on `emptyFallback`
(uniform) the whole cast, exactly like every real cast to date.

P(0 catches in 6 casts) at each rate, for calibration:
- 92.4% (session 13, unconstrained): (1-0.924)^6 ≈ 0.00002% — essentially
  impossible, this is what motivated the whole session.
- 71.6% (focusMeter modelled, library known): (1-0.716)^6 ≈ 0.052% — still
  implausible, ruling out "focusMeter alone explains it."
- 7.0–10.3% (focusMeter modelled, library blind): (1-0.07)^6 to (1-0.103)^6
  ≈ 55–65% — fully plausible, this is the honest current expectation.

Conclusion stated in SPEC.md §5 and DECISIONS.md: focusMeter is real and
worth ~20-25 percentage points, but the dominant cause of the sim-vs-live gap
is that the sim's own test setup gives the matcher an unfair advantage it
doesn't have live (a searchable library containing the truth). This is now
recorded in `tests/fishing/castSim.test.ts`'s new "session 14" describe
block as two permanent regression tests.

### 3. Card-choice policy re-derivation

Per the brief: only re-derive after #2's number is known, and the two
outcomes were "collapses toward 0" (sim now faithful, re-derive under the
understood constraint) or "stays high" (focusMeter isn't the explanation,
check other suspects). The actual result (71.6%) is neither cleanly — real
but insufficient. Chose not to rewrite `chooseCard`'s formula: inspection of
`bestFocusForCard` shows it already searches only `reachableCells(gridSize,
current, remaining)`, which degrades correctly as the budget depletes (a
near-exhausted budget naturally narrows the search to the current focus,
which is the "commitment" behavior a hand-derived policy would implement
anyway). The re-derivation that actually mattered was in SPEC.md's prose,
not the code: documented that "hedge throughout" is currently the ONLY
policy in effect live (since identification has never once succeeded), not
a fallback among several.

### 4. `focusMeter` regeneration probe

NOT attempted. `data/guard-budget-fishing.json` showed `{"date":
"2026-08-15", "energySpent": 59, "runsStarted": 5}` before this session took
any action — session 13's own live fishing work had already spent the full
5/5-cast, 59/100-energy daily allowance, and the guard is date-keyed
(`guardPersistence.ts`, same convention as the dungeon guard), so the cap
carried over from session 13 to session 14 since both fall on 2026-08-15.
Confirmed by inspection, not by attempting and being blocked — no wasted
call. Logged as a scheduling fact in DECISIONS.md, not a session-14 finding.

### 5. `consumables` field-shape test

```
$ npx tsx scripts/checkPotions.ts
270 item balance rows total.
  itemId 131 (Big Heal Juice): balance 8
  itemId 151 (Lil Heal Juice): balance 0
  itemId 155 (Mid Heal Juice): balance 7
```

Added `--probe-consumables=<itemId>` to `scripts/liveRun.ts` (mirrors the
existing `--probe-use-item` pattern): overrides ONLY the `consumables` field
on the next genuinely new `start_run` POST, everything else (combat,
reward/path picks) still sends `consumables: []` as always.

```
$ npx tsx scripts/liveRun.ts --runs=1 --probe-consumables=131
  ✓ start_run sent — actionToken now 1786834962102
room 1  me HP 36/36 ARM 16 | Enemy Room 63 HP 30/30 ARM 12   -> rock (won)
  ▸ reward: picking "AddTenacity" (index 0)
  ▸ enemy path: choosing lowest offered tier 0 (Safe)
room 2  me HP 36/36 ARM 16 | Enemy Room 64 HP 35/35 ARM 14
  ... (HP drops 36 -> 28 -> 16 -> 8, no heal events, no use_item calls)
  · no active run — stopping.   (player died, room 2)
  ▸ energy: 269 -> 249  (spent 20)
```

Confirmed via the raw request log (`logs/run-2026-08-15-23-02-35.jsonl`):

```json
{"action":"start_run","dungeonId":5,"actionToken":0,"data":{"consumables":[131],"isJuiced":false,"index":0}}
```

— run started normally (`"Dungeon run started"`), settling that the field
takes a raw item ID (not a slot index or object). The response itself never
echoes a `consumables` field anywhere (`data.run.players[0]` has no such
key) — so the ONLY way to observe the effect was the item balance:

```
$ npx tsx scripts/checkPotions.ts   (re-run after the run above finished)
  itemId 131 (Big Heal Juice): balance 7    (was 8)
  itemId 155 (Mid Heal Juice): balance 7    (unchanged, not touched)
```

The balance dropped by exactly 1 the moment `start_run` was sent, before any
combat happened, and stayed at 7 after the run ended in death — with
`use_item` never called even once (confirmed: `grep -o '"action":"[a-z_]*"'
logs/run-2026-08-15-23-02-35.jsonl | sort | uniq -c` shows zero
`use_item` entries). **The potion is consumed at loadout commitment
(`start_run`), not at point-of-use.** This is a stronger, more specific
answer than the original "are potions consumed on use even if the run
fails" question — this potion was never used at all and was still consumed.

Per the brief, stopped here — no `use_item` attempt on the loaded potion, no
timing policy. Turn-cost and multi-use-per-battle remain open for a future
session with dungeon run budget available.

### 6. Sim-authority-per-domain rule

Recorded in `SPEC.md §5` (new subsection) and `handoff/DECISIONS.md`. Text
in both places; not duplicated here.

## Corpus-total assertion re-derivation (mechanical, not a finding)

The two live runs above added new boon offers/pickups and new combat
exchanges, tripping the "expected to fail after every capture" corpus-total
assertions (DECISIONS 2026-08-15, session 06's established convention).
Each was individually re-checked against the real new corpus data (via
one-off inspection scripts, deleted after use) before updating:

- `src/sim/boons.ts`: added `CorrosiveMagic` to `BOON_MODELS` (`{kind:
  "latent"}`, zero delta at pickup — verified directly: before/after
  combatant states are byte-identical, `statusEffects` empty both sides).
  Added two new `OBSERVED_OFFERS` entries (room 3: CorrosiveMagic/TieWeak/
  AddLifestealShield; room 1: AddTenacity/AddBlock/ArmorDepletedWeak — the
  latter a first-sighting unmodelled type).
- `tests/boons.test.ts`: `pickups.length` 30→32, `UNMODELLED_TYPES` (removed
  CorrosiveMagic, added ArmorDepletedWeak), `OBSERVED_OFFERS` totals, Wall-1
  room-1 option count 48→51 (clean set unchanged — neither new option is
  clean).
- `tests/replay.test.ts`: `exchanges().length` 315→334, `sideUpdates`
  630→668. Verified 0 clean failures both times (the model still matches
  every exchange exactly) before touching the numbers — this is the test
  that would catch a real regression, and it never failed.
- `tests/dungeonSim.test.ts`: `battleCoverage.scored` 1097→1087,
  `scoredWinRate` 2/251→0 (offer-table reshuffling at the fixed seed, same
  non-finding pattern session 11 already documented for this exact metric).

All re-derived by running the real code against the real new corpus, never
guessed or pattern-matched from the old comment.

## Final verification

```
$ npx tsc --noEmit          # exit 0, clean
$ npx vitest run             # 296 tests, 20 files, all pass
$ npx tsx scripts/sim.ts     # Task 5 gate: 85.6% vs 92.9%, non-overlapping — still passes
$ npx tsx scripts/deathRooms.ts
13 confirmed deaths. room 1: 0, room 2: 4, room 3: 4, room 4: 5.
```

## Secret scan (pre-commit)

```
$ git diff | grep -nE "0x[a-fA-F0-9]{4,}|noobId\s*[0-9]+|eyJ|PRIVATE"     # empty
$ find fixtures/.../run-* -type f -not -path "*/raw/*" | xargs grep -lE "0x[a-fA-F0-9]{4,}|eyJ"   # empty
$ git check-ignore -q fixtures/dungeon-runs/run-*/raw   # ignored, all 3 new dirs
```
Clean. `.gitignore` still covers `.env`, `*.key`, `config/discovered.json`,
`data/`, `logs/`.
