# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-12T15:22:41.917Z.

536 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 271/536 | 50.6% | 0.99 | 7.05 | 2.9 |
| escaped (fish at full HP) | 231/536 | 43.1% | 0.64 | 5.87 | 4.1 |
| mana out | 33/536 | 6.2% | 0.09 | 0.00 | 9.9 |
| truncated / unresolved | 1/536 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 292/536 (54.5%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
