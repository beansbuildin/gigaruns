# session 117 — 2026-09-02 — OFFLINE, no live game calls

Follow-up to the user's oil-usage question from the previous offline turn:
does session 116's fishing data show batches losing to mana/turn exhaustion
rather than to misses? Full write-up: `handoff/DECISIONS.md`, 2026-09-02
(session 117). This file is the index/recap.

## What ran

Not a new script. `scripts/lossDecomposition.ts` already existed (session
48, off `src/sim/fishing/castTrace.ts`) and does exactly this — terminal
reason per cast (`caught` / `escaped (fish at full HP)` / `mana out` /
`truncated`), turn-by-turn focus/mana profile, focus-budget-zero frequency.
It had never been run against session 116's data. Writing a second reader
off the raw `logs/fishing-*.jsonl` stream (which is what an earlier offline
turn this session had already hand-built, informally, to answer the oil
question) would have duplicated cast-boundary/docId-grouping logic this
project has already hardened — abandoned once the existing tool turned up.

Verified in the same isolated-sandbox pattern every offline session since
115 has used (`device_bash` still cannot mount this repo): `lossDecomposition.ts`
+ `castTrace.ts` + `geometry.ts` (type dep only), unmodified, run against all
167 real `state-*.json` files for session 116's 28 real casts, staged
individually via the device bridge. **Nothing in either file was touched.**

## Result

| terminal reason | n | mean final mana | mean turns |
|---|---|---|---|
| caught | 16/28 (57.1%) | 6.38 | 3.5 |
| escaped, fish at full HP | 9/28 (32.1%) | 5.44 | 4.6 |
| mana out | 2/28 (7.1%) | 0.00 | 10.0 |
| truncated / unresolved | 1/28 (3.6%) | 6.00 | 4.0 |

By batch — batch 1: 6 caught / 3 fish-full / 2 mana-out. Batch 2 (the ~70%
batch): 9 caught / 4 fish-full / 1 truncated / **0 mana-out**. Batch 3: 1
caught / 2 fish-full / **0 mana-out**. Every mana-exhaustion loss is in
batch 1 — the same batch that spent both of the day's two Relaxing Oils.
Batches 2 and 3 lose exclusively to the fish's HP gauge climbing back to
max from misses, turns and mana both still in hand.

**Ties directly to the prior turn's oil finding**: `lethal-relaxing-only`
fires at `fishHp <= 2`; none of the 9 fish-full escapes ever got near that —
oil-trigger tuning cannot touch this loss mode by construction. The lever
would be whatever governs hit/miss (connect probability, focus placement),
not investigated this session.

## One reconciled discrepancy — minor, not a re-derivation

`loadCastTraces()` says 16 caught; `handoff/log/session-116.md`'s own recap
says 17/28 = 60.7%. Traced to one cast: docId `13208720`
(`cast-2026-09-02-03-34-41`, batch 2) — its `state-*.json` capture stops 4
turns in with no terminal event recorded, so `loadCastTraces()` correctly
calls it `truncated` rather than guessing. The live recap's count almost
certainly reflects the true outcome (it comes off the live API stream, not
a fixture replay) — what's missing is that cast's terminal fixture file, not
a disagreement about what happened. Single cast, not chased further.

## Also resolved in passing

The "12 dirs found vs 11 played" / "4 vs 3" off-by-ones an earlier offline
turn this session flagged and left open: `fixtures/fishing-casts/live/`
holds two `2026-09-02` directories with `raw/` only and no `state-*.json`
at all — `cast-2026-09-02-02-53-41` (batch 1's FIRST directory) and
`cast-2026-09-02-04-29-48` (batch 3's LAST). Both are correctly invisible
to `loadCastTraces()` (it walks for `state-*.json`, skips `raw/` by name),
so this was never a bug — just two directories with nothing to contribute.
Their cause is still unconfirmed (leading for batch 1, trailing for batch
3 — not simply "every batch's dry-run preflight"); not chased further.

## Now wired in (addendum, same session)

The "left undone, deliberately" item below was undone within this same
session: asked whether to wire `lossDecomposition.ts`'s breakdown into
`regenerateReports.ts`, user said **"Yes, wire it in now."** New:
`src/sim/fishing/lossDecompositionReport.ts` (pure functions, no
filesystem) and `scripts/lossDecompositionReport.ts` (the
`buildRecords`/`writeReports`/`main()` wrapper — writes
`data/run-reports/fishing-loss-decomposition.jsonl` +
`handoff/reports/fishing-loss-decomposition.md`). `scripts/lossDecomposition.ts`
now imports `terminalReason` from the new src file instead of keeping a
second copy; nothing about its classification changed. `regenerateReports.ts`
calls the new report as a third step inside its existing non-fatal
try/catch, alongside `fishingReport.ts`/`dungeonReport.ts`. Full details
and verification: `handoff/DECISIONS.md`, 2026-09-02 (session 117,
addendum).

## Left undone, deliberately (historical — see above, this was closed within the session)

`lossDecomposition.ts` was still console-only at this point — not wired into
`regenerateReports.ts`, so its output wasn't committed anywhere and nobody
would see it again without re-running it by hand. That's a small, additive,
read-only change in principle, but `regenerateRunReports` runs after every
live cast (`orchestrator.ts`, `liveRun.ts`, `liveFishing.ts` all call it),
so it wasn't made without asking first. The user's answer, and what got
built, is in the addendum above.

## Verification

Two rounds, both isolated-sandbox only — `device_bash` still cannot mount
this repo, so neither ran against the real repo's suite, `tsc` project-wide,
or the secret scan.

Round 1 (analysis): `lossDecomposition.ts` + `castTrace.ts` + `geometry.ts`
copied verbatim, unmodified; ran clean against 28/28 traces reconstructed
from the staged fixture files with no parse errors.

Round 2 (wiring, addendum): `npx tsc --noEmit` clean across the sandbox
project; 11/11 new tests in `tests/sim/lossDecompositionReport.test.ts`
pass; `scripts/lossDecompositionReport.ts` run against the same 167-file/
28-cast corpus reproduces the recorded numbers (16/9/2/1) in both the
written `.jsonl` and `.md`; the refactored `scripts/lossDecomposition.ts`
reproduces the same numbers, confirming the import-based refactor is
behavior-preserving. **Still not run**: the real repo's 2323-test suite,
project-wide `tsc`, or the secret scan — flagged for the next live brief.
