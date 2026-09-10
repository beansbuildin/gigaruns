# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-09T18:03:44.513Z.

508 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 255/508 | 50.2% | 0.99 | 7.02 | 2.9 |
| escaped (fish at full HP) | 220/508 | 43.3% | 0.65 | 5.91 | 4.1 |
| mana out | 32/508 | 6.3% | 0.09 | 0.00 | 10.0 |
| truncated / unresolved | 1/508 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 277/508 (54.5%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
