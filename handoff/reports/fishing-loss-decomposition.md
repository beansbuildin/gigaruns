# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-16T17:41:21.747Z.

625 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 317/625 | 50.7% | 0.99 | 7.03 | 2.9 |
| escaped (fish at full HP) | 263/625 | 42.1% | 0.65 | 5.90 | 4.1 |
| mana out | 44/625 | 7.0% | 0.07 | 0.00 | 9.8 |
| truncated / unresolved | 1/625 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 338/625 (54.1%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
