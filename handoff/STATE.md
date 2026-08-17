# STATE — session 21 — 2026-08-17 — commit (pending, see below)

## Status
No numbered TASKS.md task is open right now — this was a tuning/funding
session per the session-21 brief, not a gated task. All 4 of the brief's
required items are done: fishing budget raised (sourced), 4 known ROMs
claimed (net +13 energy), a real redraw-threshold sweep built and run
(confirms current default), and 6 real fishing casts spent with the miner
re-run against the grown log.
Next per TASKS.md: nothing numbered is blocked. Task 10's 8-hour unattended
orchestrator run is still the single open item outside any session's
control — see "Open questions" below, unchanged from session 20.
Overall: fishing now has its real daily budget (240/20, matching the user's
own confirmed cap) instead of a conservative placeholder, the sim-side
redraw threshold is now verified rather than assumed, and the account is
+13 energy from ROM claims with one ROM (7959) claiming successfully for
the first time ever. No strategy code changed — `chooseNewCard`'s
placeholder heuristic (brief item 5) was explicitly deprioritized and not
started, per the brief's own instruction not to touch it without scoping
first.

## What works
- **`GigaverseClient.claimRomEnergy(romId, amount?)`** — promoted from
  session 20's raw-fetch probe now that the endpoint is confirmed; same
  rate-limit/mutex/fail-closed discipline as every other client method.
  Unit-tested (3 new tests: body shape, default `amount=0`, fail-closed on
  500). Live-verified this session: 2 of 4 known ROMs claimed successfully.
- **`scripts/claimRoms.ts`** — claims all known ROM ids in one pass, no
  batching logic against the 420 cap needed (overflow confirmed
  non-wasting, user, this session). Live run: 5345/689 → HTTP 500 (claimed
  last session, nothing new accrued — consistent with per-ROM accrual, not
  a bug); 2097 → +8 energy; **7959 → +5 energy, its first-ever successful
  claim** after 2 straight failures in session 19. Net +13 energy.
- **`scripts/redrawThresholdSweep.ts`** — sim-only, N=2000, 14 threshold
  values from -1,000,000 ("never redraw") to 20. Confirms the current
  `REDRAW_THRESHOLD` (0) is the true optimum: 70.7% ± 2.0% catch rate, an
  interior point (curve rises from 67.6% at "never" to the peak at 0, then
  collapses past 1, down to 0.4% by 8) — not a boundary artifact. No config
  change needed.
- **6 real fishing casts spent** against the raised budget (`config/bot.json`
  dendren 200/15 → 240/20). 1 new catch (cast 5 of the batch). Guard budget
  today (fishing): 180/240 energy, 15/20 casts used.
- **`mineFishPatterns.ts` re-run** against the grown log (90 transitions, 25
  casts, up from 75/~19 at session start): `perimeterWalk(cw)` stays
  promoted at support=3 (no new independent match this batch, an honest
  null result), plus two new support-1 near-misses (`bounce(2,0)`,
  `bounce(-2,0)`) from a single cast — not promotable yet.

## What's broken
- Nothing newly broken. 5345/689's HTTP 500 on this session's claim attempt
  is expected behavior under the per-ROM-accrual model (session 20), not a
  regression — both were claimed one session earlier and evidently hadn't
  accrued anything new yet.

## Corrections to SPEC.md
- ROM factory-claim section extended (not revised) with this session's live
  claim result — see SPEC.md's new session-21 bullet under "ROM
  factory-claim". `config/discovered.json`'s `roms.knownRomIds` corrected
  from an incomplete 2-entry list (`["7959","2097"]`) to the actual known 4
  (`["7959","2097","5345","689"]`) — this file is gitignored so the fix
  doesn't appear in the commit, but it's now accurate for this session's
  own future reads.
- No dungeon-side corrections this session (dungeon untouched).
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: unchanged, PRESENT.

## Dead ends
- None this session.

## Metrics
- Tests: 351/351 at session start → 354/354 at end (+3, the new
  `claimRomEnergy` tests). `npx tsc --noEmit` clean throughout.
- ROM claims: 4 attempted, 2 succeeded (2097 +8, 7959 +5), 2 failed
  HTTP 500 (5345, 689 — no new accrual). Net +13 energy this session.
  Lifetime: 5 successful ROM claims, +~38 energy credited so far, still a
  small fraction of the ~3,252-energy stockpile last snapshotted (session
  20; not re-snapshotted this session, so that total is now stale — it only
  ever grows).
- Fishing: 6 real casts this session (1 catch), 12 energy each. Today's
  guard-tracked totals (UTC-keyed, spans sessions): 15/20 casts,
  180/240 energy.
- Fishing sim: redraw-threshold sweep, N=2000 per threshold, 14 thresholds
  — see "What works" above for the winning row. Baseline catch rate at the
  current config is ~70%, not the older 92.4%/19.0% figures still cited
  elsewhere in TASKS.md (those predate session 14's `focusMeter` modelling
  fix and should not be read as current).
- Corpus growth: `data/fish-patterns.jsonl` 75 → 90 lines (transitions),
  ~19 → 25 casts. `mineFishPatterns.ts`: still 1 primitive promoted
  (unchanged support), 2 new unpromoted near-misses logged.
- Dungeon: untouched this session (0 runs, 0 energy spent from this
  session's own actions — the 59/3 dungeon guard-budget total on disk is
  carried over from sessions 19-20, not new).

## Open questions for Claude
1. **Task 10's 8-hour orchestrator run is still the single open item outside
   any session's control** — unchanged from session 20's brief. Nothing
   code-side blocks it; it needs the user to run
   `npx tsx scripts/orchestrator.ts --hours=8` outside an interactive
   session.
2. **Full ROM enumeration is still incomplete** (4 of 37 known). The
   ROMULATOR panel's request URL is still unconfirmed — worth asking the
   user again if convenient, per session 20's same open item. Not blocking:
   claiming the known 4 continues to work and nets real energy every time
   any of them has accrued something.
3. **`chooseNewCard`'s placeholder heuristic (Task 11 §5 in the session-21
   brief) is unstarted, deliberately** — the brief asked for it to be
   scoped as its own design question before any code, and items 1-4 filled
   the session. Worth a dedicated brief section if this becomes the
   priority: no deck-composition sim exists yet to judge alternatives
   against the current argmax-hit-power/mana placeholder.
4. **The sim's catch-rate baseline has drifted across TASKS.md** — Task 8's
   original gate cited 92.4%/19.0% (matcher vs random, pre-`focusMeter`
   modelling); session 14 corrected the matcher-informed figure to
   ~69.9-71.6% once `focusMeter` was modelled, and this session's sweep
   independently reproduces ~70.7% at the optimal threshold. Not a new
   finding, but worth Claude(chat) knowing when citing "the sim number" in
   a future brief — use the ~70% figure, not 92.4%/19.0%.

## Files changed
```
$ git diff --stat (tracked)
SPEC.md                    | 11 +++++++++++
TASKS.md                   | 27 +++++++++++++++++++++++++++
config/bot.json            |  6 +++---
src/api/client.ts          | 16 ++++++++++++++++
src/api/schemas.ts         |  9 +++++++++
src/sim/fishing/castSim.ts | 40 +++++++++++++++++++++++++---------------
tests/api/client.test.ts   | 44 ++++++++++++++++++++++++++++++++++++++++++++
7 files changed, 135 insertions(+), 18 deletions(-)

+ scripts/claimRoms.ts (new)
+ scripts/redrawThresholdSweep.ts (new)
+ fixtures/fishing-casts/live/cast-2026-08-17-05-34-25/ (new, redacted; raw/ gitignored)
```
