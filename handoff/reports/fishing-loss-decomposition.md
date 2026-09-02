# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-02T18:49:40.157Z.

366 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 177/366 | 48.4% | 1.00 | 7.03 | 3.0 |
| escaped (fish at full HP) | 165/366 | 45.1% | 0.60 | 5.85 | 4.1 |
| mana out | 23/366 | 6.3% | 0.13 | 0.00 | 10.0 |
| truncated / unresolved | 1/366 | 0.3% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 203/366 (55.5%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
