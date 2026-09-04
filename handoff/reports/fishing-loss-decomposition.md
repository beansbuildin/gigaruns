# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-04T06:29:33.291Z.

409 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 203/409 | 49.6% | 1.00 | 7.02 | 3.0 |
| escaped (fish at full HP) | 179/409 | 43.8% | 0.63 | 5.87 | 4.1 |
| mana out | 26/409 | 6.4% | 0.12 | 0.00 | 10.0 |
| truncated / unresolved | 1/409 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 222/409 (54.3%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
