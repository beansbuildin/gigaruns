# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-02T23:31:37.032Z.

374 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 182/374 | 48.7% | 0.99 | 7.02 | 3.0 |
| escaped (fish at full HP) | 167/374 | 44.7% | 0.60 | 5.87 | 4.1 |
| mana out | 24/374 | 6.4% | 0.13 | 0.00 | 10.0 |
| truncated / unresolved | 1/374 | 0.3% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 208/374 (55.6%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
