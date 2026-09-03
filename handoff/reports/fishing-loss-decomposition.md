# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-03T01:10:07.639Z.

387 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 191/387 | 49.4% | 1.01 | 7.03 | 2.9 |
| escaped (fish at full HP) | 170/387 | 43.9% | 0.63 | 5.88 | 4.1 |
| mana out | 25/387 | 6.5% | 0.12 | 0.00 | 10.0 |
| truncated / unresolved | 1/387 | 0.3% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 211/387 (54.5%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
