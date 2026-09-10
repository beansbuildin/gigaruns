# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-10T18:05:47.079Z.

533 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 270/533 | 50.7% | 0.99 | 7.05 | 2.9 |
| escaped (fish at full HP) | 230/533 | 43.2% | 0.63 | 5.86 | 4.1 |
| mana out | 32/533 | 6.0% | 0.09 | 0.00 | 10.0 |
| truncated / unresolved | 1/533 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 291/533 (54.6%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
