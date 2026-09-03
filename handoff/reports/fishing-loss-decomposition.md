# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-03T02:13:25.062Z.

389 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 192/389 | 49.4% | 1.00 | 7.04 | 2.9 |
| escaped (fish at full HP) | 171/389 | 44.0% | 0.63 | 5.89 | 4.1 |
| mana out | 25/389 | 6.4% | 0.12 | 0.00 | 10.0 |
| truncated / unresolved | 1/389 | 0.3% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 213/389 (54.8%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
