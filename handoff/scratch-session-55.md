# scratch — session 55 (surprises as they happen)

## §1 cap verification (2026-08-19 ~20:55 PT)
- Both ledgers AGREE: game `dayDocs[pondId 2] = 20` vs cap 20; repo guard
  `data/guard-budget-fishing.json` = 20 casts / 240 energy, date `2026-08-19`.
  Session offline confirmed. Reset 14.1h out (11:00 PT 2026-08-20).
- SURPRISE 1 — **`dayDocs` is NOT keyed the way the dungeon side is.** Shape is
  `[{pondId, doc:{UINT256_CID, docId, ...}}]`; `pondId` is an explicit sibling
  field. `docId` reads `DayCount#<addr>#player-day-data-pond-2`, so the
  dungeon's `DayCount#<addr>#Dungeon#<id>` suffix convention does not carry
  over. My first draft parsed the suffix and read NOT FOUND.
- SURPRISE 2 — **the response also carries a SINGULAR `dayDoc`, and it is
  POND 1's.** It read `UINT256_CID: 0` at the moment pond 2 was at 20/20. Any
  reader reaching for `state.dayDoc` gets a confident wrong answer about
  Dendren. This is a live trap for exactly the check §19 keeps needing.
- Dungeon ledger also exhausted and agreeing: server `Dungeon#5` = 12, repo
  guard = 12 runs / 240 energy. (Rule 11 forbids a run regardless.)
- Minor: `scripts/checkDungeonToday.ts` prints `PLAYER_CID`/`docId` RAW to
  stdout. Console, not a tracked file, so not a repo leak — but it is the same
  identifier §4 is redacting out of prose. Noted, not fixed (out of scope).

## §3 blind-spot check — RIGHT CONCLUSION, WRONG MECHANISM
- The brief names `chooseBoon`. **No such function exists**; it is
  `pickBoon`/`rankBoons` in `src/strategy/loot.ts`.
- The brief's MECHANISM is REFUTED: `pickBoon` never reads `BOON_MODELS` at
  all. `categorise()` is purely NAME-based (`Heal` / `AddMax*` prefix /
  `Upgrade*` suffix / a 5-name `ROLLED_TYPES` set / else `unknown`). The
  module header already says so explicitly and on purpose: "What is
  deliberately NOT in the ranking: whether a boon is modelled."
- The brief's CONCLUSION is nonetheless CONFIRMED, and by measurement, not
  argument. All **36 of 36** unmodelled types fall to `unknown`, which scores
  **10 — the lowest of the five categories** (heal ~1e6, sword upgrade 1e5,
  pool ~25·scale, rolled 15, unknown 10). Swept all 135 captured offers × 4 HP
  fractions = **540 decisions: an unmodelled type was top-ranked 0 times.**
  And **0 of 135 offers have every option unmodelled**, so the only escape
  hatch (an all-`unknown` offer, where one must win on the index tie-break)
  has never once occurred.
- So it is a **score floor, not an exclusion** — and that distinction is
  load-bearing for the fix: an exclusion would need special-casing to break,
  a floor needs only an override, which is what §3 builds.
- **The brief's "five boons is five runs" is optimistic by ~5x.** Only **9 of
  49 room-1 offers (18.4%)** contain a top-five target, and only **8 of 43
  corpus runs** had one. At one target per run that is ~27 runs to model five
  boons — ~7 days at rule 11's 4 juiced runs/day. Widening to rooms 1-3 barely
  helps the RATE (23.6%) but triples the pool.

## §2 — the brief's premise is HALF wrong, and the wrong half is the dangerous one
- `matcherWeight` IS a real field: `liveFishing.ts` writes it (session 51) and
  `matcherWeightOf()` reads it back-compatibly. But **0 of the 129 rows on
  disk carry it.** Every row predates the instrumentation. So there was
  nothing for the brief's script to read.
- **CLAUDE.md rule 10, live.** `matcherWeightOf()` fills an absent field with
  the fixed `1 - ringFloor = 0.9` that really was in force pre-session-51 —
  correct for reading history, catastrophic for §19, because 0.9 on every turn
  reads as "π is high", *which is the conclusion §19 exists to test*. A naive
  report would have produced a confident WRONG answer rather than no answer.
  `matcherVerdict.ts` therefore reads the raw field and treats absence as NOT
  MEASURED, never as 0.9.
- Session 51's rule names only DROP and KEEP, but a third case is reachable:
  π crosses 0.5 and no crossing cast beats the base rate. Named
  `EARNED_BUT_UNPAID` rather than folded silently into DROP.
- Live-corpus numbers, run today: library = 3 patterns (perimeterWalk cw/ccw,
  bounce(2,0)), support **11/88** clean casts, π₀ = 0.133. The brief said "11
  distinct casts of 89" — 89 is the trace count, 88 is the CLEAN-cast total,
  which is the denominator `supportingCastCount` actually uses.
- Opening focus spend on today's log: n=15, mean **1.667**, 95% CI
  [1.137, 2.196] — brackets session 50's 1.80 live figure, well above the 0.71
  replayed one.
