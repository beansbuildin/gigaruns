# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-17T18:18:09.212Z.

647 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 328/647 | 50.7% | 0.99 | 7.04 | 2.9 |
| escaped (fish at full HP) | 271/647 | 41.9% | 0.66 | 5.90 | 4.1 |
| mana out | 47/647 | 7.3% | 0.06 | 0.00 | 9.8 |
| truncated / unresolved | 1/647 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 348/647 (53.8%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
