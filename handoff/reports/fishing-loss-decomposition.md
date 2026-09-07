# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-07T00:19:12.514Z.

482 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 241/482 | 50.0% | 1.00 | 7.02 | 2.9 |
| escaped (fish at full HP) | 209/482 | 43.4% | 0.65 | 5.91 | 4.1 |
| mana out | 31/482 | 6.4% | 0.10 | 0.00 | 10.0 |
| truncated / unresolved | 1/482 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 263/482 (54.6%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
