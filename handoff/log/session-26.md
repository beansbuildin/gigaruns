# Session 26 — 2026-08-17 — commit 928c870

## Brief

Session 25's brief (`handoff/next.md`) had two parts:

1. **Priority**: investigate `data.nextPosition`/`data.nextMovePath` —
   fields that tripped `liveFishing.ts`'s unknown-terminal-field detector
   on 3 casts during session 25's Task 10 gate run. The original inline
   comment guessed "catch-resolution mechanic"; session 25's own recap
   argued that guess looked wrong (the fields sit next to
   `fishPosition`/`previousFishPosition`, not `cardChosenId`/`caughtFish`)
   and floated a bigger hypothesis: a live look-ahead of the fish's next
   move, which — if it fires every turn — would be a bigger lever for
   fishing accuracy than anything in Task 11 or Task 13. Explicit
   instruction: check this CHEAPLY against existing fixture data first,
   don't spend new live casts, don't build a reaction mechanism until it's
   confirmed to hold across multiple real casts.
2. **Task 13's infrastructure piece only** (not scoring): `simulateCast`
   draws a fresh random deck sample every cast with no concept of a real
   held deck — fix that prerequisite, leave `chooseNewCard`'s scoring logic
   alone.
3. Three low-priority items explicitly flagged "don't chase this session"
   (shutdown.ts SIGINT-during-sleep gap, an 11-vs-12 run-dir count
   mismatch) — left alone, as instructed.

No TASKS.md gate was in scope. This was an investigation + a small
infrastructure piece, both non-gated.

## What was done

### 1. `nextPosition`/`nextMovePath` investigation

Started from `QUESTIONS.md §12`'s existing raw dumps in `logs/` (gitignored,
still on disk locally) — 6 `fishing-unknown-terminal-*.json` files, not the
4 the brief mentioned (2 extra ones from session 16, dated 2026-08-16,
already existed and had gone unremarked — a minor correction to the
brief's own framing, not a new finding). Extracting `doc.data` from each
confirmed the concrete values QUESTIONS.md §12 already quoted
(`fishPosition [2,3]`, `nextPosition [1,3]`, `nextMovePath [3]`, etc.).

The real work was checking the brief's two open questions against
`fixtures/fishing-casts/live/` — 30 committed live-cast directories, each
with per-turn `state-NNN.json` files written by `FixtureWriter` on EVERY
`play_cards` response, not just the terminal one. This is the corpus the
brief's own instruction ("check cheaply... using existing fixture data
first") pointed at, and it turned out to already contain everything needed
— no live cast had to be spent.

Ran a Python scan across all 30 cast directories (225 turns total):

```
total turns inspected: 225
turns where 'nextPosition' key present: 8
turns where nextPosition non-null: 2
predictions checkable against a following turn: 1
predictions correct: 1
```

Listed every occurrence with cast name / turn index / completion status:

```
cast-2026-08-17-20-40-57   turn 1/7  nextPosition=[2, 4]  COMPLETE=False
cast-2026-08-17-20-40-57   turn 2/7  nextPosition=None    COMPLETE=False
cast-2026-08-17-20-40-57   turn 3/7  nextPosition=None    COMPLETE=False
cast-2026-08-17-20-40-57   turn 4/7  nextPosition=None    COMPLETE=False
cast-2026-08-17-20-40-57   turn 5/7  nextPosition=None    COMPLETE=False
cast-2026-08-17-20-40-57   turn 6/7  nextPosition=None    COMPLETE=False
cast-2026-08-17-20-40-57   turn 7/7  nextPosition=None    COMPLETE=True  SUCCESS=False
cast-2026-08-17-21-10-15   turn 8/8  nextPosition=[1, 3]  COMPLETE=True  SUCCESS=False
```

Key findings:

- **The key is present (as a JSON key, `null` or real) on only 8/225 turns,
  across only 2/30 casts.** In the first cast it appears starting turn 1
  (real value once, then persists as `null` through the rest of that
  cast). In the second cast it appears exactly once, on the terminal turn.
- **Neither prior framing holds.** Not terminal-only (contra the original
  catch-resolution guess — it fired on a non-terminal turn in the first
  cast) and not every-turn (contra the hopeful look-ahead reading — 217 of
  225 turns never see the key at all).
- **The one checkable prediction was exactly correct.** Turn 1 of
  `cast-2026-08-17-20-40-57`: `nextPosition: [2,4]`, `nextMovePath: [7,8]`.
  Turn 2's real `fishPosition: [2,4]`, `lastMovePath: [7,8]` — exact match
  on both fields. The second occurrence (`cast-2026-08-17-21-10-15`,
  `nextPosition: [1,3]`) is on that cast's terminal turn, so there's no
  following turn in the fixture to check it against.
- **Ruled out every candidate trigger checked.** `activeFintuitionTurns`,
  `activeCritBoostTurns`, `fintuitionOilBoostPercent`,
  `dualYieldOilBoostPercent`, `jebaitorTriggered` are all `0`/`false` at
  both occurrences. The card played immediately before the first
  occurrence (id 10 — crit-only, `hitZones: []`, `critZones: [5]`, no
  declared "reveal" effect in `deckCardData`) doesn't explain it either. No
  field this project currently reads correlates with the 2/30 rate.
- Double-checked the field is absent from the older single-cast fixture
  (`fixtures/fishing-casts/cast.json`) too — not a shape that's always been
  there and just never flagged; it's genuinely rare across the whole
  corpus.

**Conclusion, stated plainly per the brief's own instruction that a
negative result is legitimate**: this is real, but it is NOT "a bigger
lever than `mineFishPatterns.ts`" — at an apparent ~7%-per-cast rate it
cannot replace the general fish-pattern-identification problem
`mineFishPatterns.ts` exists to solve. It might occasionally supplement it
on the rare turn it fires, but there's nowhere near enough data (n=1
checkable, n=2 total sightings) to build anything on top of it yet. No
strategy code was touched — correctly, per the brief's explicit
instruction not to build a reaction mechanism before this holds up.

**Code change made** (pure visibility, not strategy): `scripts/
liveFishing.ts`'s `unknownDocKeys` check — previously gated on
`newDoc.COMPLETE_CID` (terminal-only) inside `runOneCast`'s turn loop — now
runs on every `play_cards` response. `dumpUnknownTerminal` gained a `tag`
parameter (`"terminal"` default, `"midcast"` for the new non-terminal case)
so dump filenames stay self-describing (`logs/fishing-unknown-midcast-*.json`
vs `-terminal-*.json`). This doesn't change what data gets captured (every
turn was already written to `fixtures/` via `FixtureWriter` regardless) —
it only adds an immediate console/log signal so a future rare sighting
doesn't require a fixture-corpus audit to notice, the way this session's
did. Not yet verified live (no live cast run this session) — next live
fishing session will exercise it for real.

### 2. Task 13 infrastructure

Read `src/sim/fishing/castSim.ts`'s `simulateCast`: it built its per-cast
deck via `for (let i = 0; i < catalog.length; i++) deck.push(rng.pick(catalog))`
— a fresh random sample of the WHOLE Dendren catalog (`loadDendrenDeck()`,
80 cards), sized to the catalog's own length, on every single cast. No
concept of "the deck a specific account actually holds" existed anywhere
in the sim, exactly as the session-22 scoping (TASKS.md Task 13) found.

Added an optional `deckIds?: readonly number[]` to `CastOptions`. When
present, the deck is built by resolving each id against a
`Map(catalog.map(c => [c.id, c]))`, throwing (`deckIds: card id ${id} not
found in Dendren catalog`) on an id the catalog doesn't have — same
fail-closed convention as `liveFishing.ts`'s `buildHand` for an unknown
hand-card id. When absent, behavior is byte-identical to before (the
random-sample path is untouched, just moved into an `else` branch) — no
regression risk to Task 8's existing gate or any test that doesn't pass
`deckIds`.

`chooseNewCard` (the actual scoring logic Task 13's gate is about) was NOT
touched, per the brief's explicit scoping. Nothing in the live loop or sim
currently calls `simulateCast` with a real `deckIds` — this is
infrastructure sitting ready for whenever Task 13 actually unparks.

Added 4 new tests (`tests/fishing/castSim.test.ts`, new `describe("deckIds
— Task 13 infrastructure...")` block):
- draws hands from the exact provided ids in order, cycling on refill
- deterministic given a fixed deck + seed (no random catalog sampling once
  `deckIds` is set — `simulateCast` called twice with identical opts
  produces `toEqual` results)
- throws on an id absent from the catalog
- a 1-card-type deck (id 1 repeated 3x) actually changes what's drawable
  (proves the substitution takes hold, not a claim about catch rate)

### 3. Documentation

- `QUESTIONS.md §12` rewritten from "not yet confirmed" to the full
  fixture-corpus finding above (kept the section, since the underlying
  trigger condition is still genuinely unknown — this narrows the
  question, it doesn't close it).
- `handoff/DECISIONS.md` gained one new dated entry (2026-08-17, session
  26) recording the same finding as a settled fact, so a future session
  doesn't have to re-derive "is this a per-turn look-ahead" from scratch.
- `SPEC.md`/`SPEC-fishing.md` were NOT touched — neither ever documented
  these fields, so there was no existing claim to correct.

## Verification

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 Test Files  23 passed (23)
      Tests  408 passed (408)
```
408/408 — up from 404/404 at session start (the 4 new `deckIds` tests). Run
twice: once mid-session after each change, once at the end against the
actual final commit (928c870), per CLAUDE.md's "re-run against the FINAL
commit you're about to hand off" rule (session 18's own lesson).

Secret scan on this session's own commits (`git diff 1a50a9f..HEAD`, the
range excluding the prior brief commit) against
`0x[a-fA-F0-9]{4,}`/`noobId\s*\d+`/`eyJ`/`PRIVATE`: **zero matches** — this
session made no live API calls, touched no fixtures, and wrote no new
identifiers anywhere. `.gitignore` confirmed still covering `.env`,
`*.key`, `config/discovered.json`, `data/`, `logs/`.

## Commits this session

- `e89a76b` — nextPosition/nextMovePath narrowed to rare (~2/30 casts),
  Task 13 deck-aware simulateCast infra (QUESTIONS.md, scripts/liveFishing.ts,
  src/sim/fishing/castSim.ts, tests/fishing/castSim.test.ts)
- `928c870` — DECISIONS.md entry for the same finding

## What's NOT done, and why

- Task 13's scoring logic — still correctly gated behind more real
  card-choice data (its own stated validation floor, unchanged this
  session: 1 live choice on record, needs "double digits" per TASKS.md).
  The infrastructure piece built this session removes one of two named
  prerequisites; the data-volume one is untouched and can't be fixed by
  writing code.
- The three low-priority items from session 25's brief §3 — left alone as
  explicitly instructed.
- No live dungeon runs or fishing casts this session — zero energy spent,
  zero new fixtures. Purely a read/analysis + infrastructure session.

## Surprises worth flagging

- The brief said "3 fishing casts" tripped the detector; the actual raw
  dump count in `logs/` is 6, with 2 predating session 25 (dated
  2026-08-16, session 16's fishing batch). This didn't change the
  investigation's conclusion but is worth noting as a small inaccuracy in
  how the prior session's own recap characterized the evidence it was
  looking at — worth double-checking raw counts against `logs/`/
  `fixtures/` directly rather than trusting a prior recap's tally when the
  underlying files are cheap to just count.
