# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-13T17:34:41.615Z.

563 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 282/563 | 50.1% | 1.00 | 7.04 | 2.9 |
| escaped (fish at full HP) | 245/563 | 43.5% | 0.64 | 5.90 | 4.1 |
| mana out | 35/563 | 6.2% | 0.09 | 0.00 | 9.9 |
| truncated / unresolved | 1/563 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 306/563 (54.4%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
