# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-14T17:56:42.803Z.

583 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 291/583 | 49.9% | 1.00 | 7.03 | 2.9 |
| escaped (fish at full HP) | 251/583 | 43.1% | 0.64 | 5.91 | 4.1 |
| mana out | 40/583 | 6.9% | 0.07 | 0.00 | 9.8 |
| truncated / unresolved | 1/583 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 318/583 (54.5%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
