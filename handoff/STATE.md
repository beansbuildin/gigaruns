# STATE — session 22 — 2026-08-17 — commit (pending, see below)

## Status
No numbered TASKS.md task is open right now — this was a brief-directed
session (ROM enumeration + fishing top-off + a design-scoping task), same
shape as session 21. All of the session-22 brief's required items are done:
`GET /roms/player?id=<address>` confirmed and documented, all 37 ROMs
enumerated with real claimable amounts, claiming extended from the
hardcoded known-4 to the full list and live-verified, remaining fishing
budget spent, and `chooseNewCard`'s replacement scoped (deliberately not
implemented — see below).
Next per TASKS.md: nothing numbered is blocked. Task 10's 8-hour
unattended orchestrator run is still the single item outside any session's
control — unchanged for the fourth session running.
Overall: ROM claiming went from "4 known ids, ~+13/session" to "all 37
enumerated, ~2,867 energy of real remaining stockpile visible" in one
session — the single biggest lever this project has had open since
session 20's initial ~3,252 estimate. It's throttled by the account's real
420 energy cap, not by anything code-side; see "Open questions" for what
that means going forward.

## What works
- **`GET /roms/player?id=<address>` — CONFIRMED, live.** User-supplied URL
  (ROMULATOR panel), not a guess. `scripts/probeRomsPlayer.ts` (new,
  read-only). Returns all 37 owned ROMs with real-time
  `factoryStats.energyCollectable`. `docId` cross-checked live as the same
  id `factory-claim` takes as `romId` — all 4 previously-known ids appear
  verbatim. New client method `getRomsPlayer(address)`, schema
  `RomsPlayerResponseSchema`, 2 new unit tests.
- **`scripts/claimAllRoms.ts`** — sources the full ROM list live every run
  (never hardcoded), filters `energyCollectable > 0`, claims descending.
  `--limit=N` for a bounded pass. Live-verified in two batches this
  session (see Metrics): the account-cap no-op case is genuinely
  non-wasting, confirmed by re-probing the 4 no-op'd ROMs and finding
  their `energyCollectable` completely untouched.
- **Fishing budget fully spent for today**: 5 casts, 60 energy (240/240,
  20/20 casts — today's guard maxed). 1 catch (`fullDeck` 14→15, chose
  card 34 from offers `{16, 34, 33}` via the current `chooseNewCard`
  heuristic — the one live data point referenced in the Task 13 scoping
  below).
- **`mineFishPatterns.ts` re-run** against the grown log (102 transitions,
  30 casts, up from 90/25): `perimeterWalk(cw)` support climbed 3→4 (still
  1 primitive promoted, no NEW promotion this batch). `bounce(0,-1)`
  climbed to support=2 (was a single-match near-miss before) — one more
  independent match away from promotion, worth watching next session.

## What's broken
- Nothing newly broken. `claimAllRoms.ts --limit=5`'s 4 zero-delta results
  are the EXPECTED shape of "account already at the 420 cap," not a bug —
  confirmed by re-probing, not assumed.

## Corrections to SPEC.md
- **Refined, not contradicted**: session 21's "overflow past the 420 cap
  is non-wasting, no batching logic needed" is CONFIRMED but was stated
  too strongly — a claim while already at the cap is a genuine no-op
  (nothing lost, but also nothing gained) rather than "loses nothing" in
  the sense of always being productive. SPEC.md's ROM factory-claim
  section, "still open" item 3, corrected this session with the live
  before/after evidence (`2696`: 540→208 collectable after a real +332
  credit; `6096`/`4586`/`2768`/`4543`: unchanged after a 0-delta claim at
  cap).
- Source endpoint for the ROM-list snapshot (open since session 20):
  RESOLVED. `GET /roms/player?id=<address>`, user-supplied, live-confirmed.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- None this session.

## Metrics
- Tests: 354/354 at session start → **356/356** at end (+2, the new
  `getRomsPlayer` tests). `npx tsc --noEmit` clean throughout, re-checked
  against the final tree before this commit.
- ROM claims: 37 ROMs enumerated (up from 4 known), 22 with
  `energyCollectable > 0` this snapshot, summing to **3,259 energy**
  (matches session 20's ~3,252 hand-pasted estimate). This session claimed
  2 of them for real energy — `2696` (+332, account 88→420, the real 420
  cap) and `6096` (+60, account 360→420 after fishing spent the account
  back down) — net **+392 energy this session**, the largest single-session
  ROM yield so far (previous best was session 21's +13). ~2,867 energy
  remains banked across the other ROMs, gated by the account's own 420
  cap, not by anything code-side.
- Fishing: 5 real casts this session (1 catch), 12 energy each. Today's
  guard-tracked totals (UTC-keyed): **20/20 casts, 240/240 energy — fully
  spent for today.**
- Fishing sim: unchanged this session (no new sweep run; redraw threshold
  stays CLOSED per session 21). Reference figure for any future brief:
  **~70%** sim catch rate at the optimal config, not the older
  92.4%/19.0%.
- Corpus growth: `data/fish-patterns.jsonl` 90 → 102 lines (transitions),
  25 → 30 casts. `mineFishPatterns.ts`: still 1 primitive promoted
  (`perimeterWalk(cw)`, support 3→4), `bounce(0,-1)` now at support=2 (was
  1), not yet promotable.
- Dungeon: untouched this session (0 runs). The 59/240, 3/12 guard-budget
  totals on disk are carried over from sessions 19-21, not new.

## Open questions for Claude
1. **Task 10's 8-hour orchestrator run is still the single open item
   outside any session's control** — unchanged for the fourth session
   running. Nothing code-side blocks it; needs the user to run
   `npx tsx scripts/orchestrator.ts --hours=8` outside an interactive
   session.
2. **ROM claiming is now unblocked but throttled by the real 420 energy
   cap, not by code** — the remaining ~2,867 energy across 21 other ROMs
   will only surface as the account gets spent down by normal dungeon/
   fishing play. Worth deciding: keep running `claimAllRoms.ts` manually
   whenever there's headroom (current state), or fold an opportunistic
   claim step into Task 10's orchestrator so it happens automatically
   without a dedicated session. Not urgent — nothing is being lost either
   way, per this session's own non-wasting confirmation.
3. **Task 13 (`chooseNewCard` deck-composition scoring) is scoped, not
   started, per the brief's own explicit permission to stop there.** One
   cheap, capture-free piece IS buildable now (making `castSim.ts` draw
   from a real deck instead of a random full-catalog sample each cast) —
   worth greenlighting on its own if a future brief wants incremental
   progress, but the actual scoring/comparison logic needs more real card
   choices than the single live data point this project has (this
   session's own catch, card 34 from `{16, 34, 33}`) before a sim
   comparison would mean anything. See TASKS.md Task 13 for the full
   scoping writeup and its stated unpark conditions.
4. **`bounce(0,-1)` is at support=2** in `mineFishPatterns.ts` (was 1) —
   one more independent matching cast promotes it. Worth flagging as a
   specific thing to check next time fishing casts are spent.
5. Use **~70%** (not 92.4%/19.0%) if citing the fishing sim baseline in a
   future brief — carried forward from session 21.

## Files changed
```
$ git diff --stat (tracked)
SPEC.md                    | 78 +++++++++++++++++++++++++++++++++++++++-----
TASKS.md                   | 85 +++++++++++++++++++++++++++++++++++++++++++
src/api/client.ts          | 11 ++++++++
src/api/schemas.ts         | 33 +++++++++++++++++++
tests/api/client.test.ts   | 33 +++++++++++++++++++
5 files changed, 228 insertions(+), 12 deletions(-)

+ scripts/probeRomsPlayer.ts (new)
+ scripts/claimAllRoms.ts (new)
+ fixtures/probe/roms/player-response-redacted.json (new, redacted; raw/ gitignored)
+ fixtures/fishing-casts/live/cast-2026-08-17-05-57-33/ (new, redacted; raw/ gitignored)
```
