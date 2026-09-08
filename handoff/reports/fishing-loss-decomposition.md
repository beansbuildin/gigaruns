# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-08T17:33:14.173Z.

506 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 254/506 | 50.2% | 0.99 | 7.02 | 2.9 |
| escaped (fish at full HP) | 219/506 | 43.3% | 0.65 | 5.93 | 4.1 |
| mana out | 32/506 | 6.3% | 0.09 | 0.00 | 10.0 |
| truncated / unresolved | 1/506 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 276/506 (54.5%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
