# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-05T20:36:37.103Z.

432 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 217/432 | 50.2% | 1.00 | 7.05 | 2.9 |
| escaped (fish at full HP) | 187/432 | 43.3% | 0.61 | 5.87 | 4.1 |
| mana out | 27/432 | 6.3% | 0.11 | 0.00 | 10.0 |
| truncated / unresolved | 1/432 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 235/432 (54.4%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
