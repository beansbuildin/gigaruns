# BRIEF — session 30

Session 29 landed clean: 454/454 tests (+26), `tsc` clean, both CODEXREVIEW
#5 and #6 fixed and verified. Both fishing pattern promotions
(`perimeterWalk(cw)` support=4, `perimeterWalk(ccw)` support=3) survived
the corrected miner — not inflated by the resumed-cast bug. Dungeon-side
`GET /game/dungeon/today` reconciliation and Pacific-time guard date-keying
are both live but only unit-tested against a mocked client so far; worth a
real check next time `liveRun.ts`/`orchestrator.ts` runs live.

This session: the three items you already confirmed, plus one thing to
check first before touching fishing data at all.

---

## 0. Check first: what wrote castId `9001`/`9002` into `data/fish-patterns.jsonl`

Session 29's recap (QUESTIONS.md §14) found 8 records with a 4-digit
castId shape never seen elsewhere in the real corpus, all zero-movement
(`from`/`to` both `[0,0]`), that reappeared with new timestamps and
incrementing turns WHILE that session was running — meaning something was
actively writing to this file concurrently, even though no live fishing
happened that session.

**Strong hypothesis, worth ruling out before asking the user anything:**
session 29 added two new test files, `tests/liveFishing.test.ts` and
`tests/mineFishPatterns.test.ts`. Synthetic-looking 4-digit castIds with
all-zero movement are exactly what a fabricated test fixture looks like,
and the timing lines up exactly with when those tests would have been run
repeatedly during the session. Check whether either test file (or any
existing one that touches fishing logging) writes to the real
`data/fish-patterns.jsonl` path instead of an isolated temp file or a
mock. If so, that's the whole mystery — not an unidentified live process.

- If confirmed: fix the test(s) to write to a temp directory, never the
  real data path. Clean the 8 polluted `9001`/`9002` records out of the
  real file. Re-run `mineFishPatterns.ts` and confirm whether the third
  pattern (`twoCellCycle(0,-1)`) changes once the pollution is gone —
  report the corrected support number either way.
- If NOT confirmed (tests already isolate their I/O correctly): say so
  plainly, don't paper over it, and surface it back as a real open
  question for the user — something is appending to the corpus outside
  the normal `liveFishing.ts`/`mineFishPatterns.ts` write paths, and that
  needs a human to identify before session 31 touches fishing data again.

Do this before §1's reporting work reads `data/fish-patterns.jsonl` for
anything — no point building a catch-rate summary on top of a file with an
unresolved pollution source.

---

## 1. Run-visibility reporting

Goal: something you can read after a session without pasting raw fixture
dumps. Per-run/per-cast JSONL log (machine-readable, forward-compatible
with a future frontend) plus an auto-generated markdown summary, both
committed to the repo.

**Before writing any code:** verify, don't assume, that Dendren Root and
Hard Cores are actually present and extractable in dungeon-run response
data — check real fixtures/live response shapes for the reward fields
rather than guessing field names. If they're not present in dungeon
responses at all (e.g. only in a separate loot/claim response), say so and
report what's actually there instead of inventing a shape.

**Dungeon report** (build on `deathRooms.ts` rather than duplicating its
logic):
- Outcome per run: death room number (1-16), or `CLEARED` for the
  (never-yet-seen) case of clearing room 16 / floor 4 room 4, the true
  final boss.
- Dendren Root and Hard Cores earned, per run, if extractable per above.
- Juiced vs. non-juiced, energy spent.

**Fishing report** (build on `loadFishingCorpus()` rather than
duplicating it):
- Per-cast: caught or not, fish name + quantity if caught.
- Session/day rollup: catch rate as a %, total fish by name.

**Output:** JSONL log (e.g. `data/run-reports/dungeon.jsonl`,
`data/run-reports/fishing.jsonl` — gitignored like other `data/`, these
are raw per-run records) plus a regenerated markdown summary committed to
the repo at `handoff/reports/dungeon-runs.md` and
`handoff/reports/fishing-casts.md`. Regenerate the markdown from the JSONL
after each live session rather than hand-writing it — same "recap reads
the real state" discipline as `STATE.md`.

Add regression tests: a dungeon run ending in a known death room produces
the right JSONL record and markdown line; a `CLEARED` run (fabricate one,
since it's never happened live) renders correctly instead of crashing on
an unhandled case; a fishing session with mixed catches/misses computes
the right catch rate.

## 2. Act on `nextPosition` when it fires, not just log it

User directive, confirmed this session: when `nextPosition` is present in
a fishing response, reposition the focus point to secure the guaranteed
hit on the predicted cell. This is authorized live behavior now, not a
"wait and see."

**Caveat worth respecting given the numbers:** CODEXIMPROVE #6 measured
this at 2 non-null sightings out of 169 real turns, and CODEXREVIEW's
binomial check found that rate statistically compatible with (not
confirming, not rejecting) the 3% Fintuition base rate. Rare and
unconfirmed isn't the same as wrong — do the validation-only pass first as
CODEXIMPROVE recommended: log predicted vs. actual next position for a
few more live sightings before letting it override the matcher, so if the
field turns out to mean something other than "the fish's next cell,"
that's caught before it's steering focus placement. Once a handful of
sightings confirm predicted == actual, flip it to a live override.

Implementation should live where `nextPosition` is currently
detected/logged as an unknown field (`src/api/fishing.ts`,
`scripts/liveFishing.ts` per CODEXIMPROVE #6's citations) — add the
validation-only recording first, wire the override behind a flag or a
confirmed-count threshold, don't hardcode it live on day one.

## 3. Dual Yield — forward detection, not backfill

The user added this skill after the corpus was captured, so there's nothing
to audit in existing fixtures — don't spend time searching historical data
for a double-catch that predates the skill. Instead, add a lightweight
detector for the next time it actually fires live: does a double-catch
show up as two `loot` calls, one `loot` call with a different
`cardsToAdd`/reward shape, or something else. Log it explicitly as
"possible Dual Yield event" with the full raw response rather than letting
it get silently mishandled or mis-parsed by the existing single-catch
assumption, same pattern as other unknown-field detectors already in this
project.

---

## Your task

1. §0 first — resolve or honestly report the mystery-writer question
   before touching fishing data for §1.
2. §1 (reporting) is the main body of this session.
3. §2 and §3 are smaller, bounded additions — do them if §0/§1 leave
   reasonable room, don't rush §1 to fit them in.
4. Don't start CODEXREVIEW #8, CODEXIMPROVE #1/#2, or #9/#10 this session
   — still queued, not now.
5. Recap normally, full suite + tsc against the final commit as usual.
