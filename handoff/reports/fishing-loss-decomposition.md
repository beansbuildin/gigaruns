# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-19T17:59:40.179Z.

672 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 341/672 | 50.7% | 1.01 | 7.01 | 2.9 |
| escaped (fish at full HP) | 279/672 | 41.5% | 0.65 | 5.86 | 4.1 |
| mana out | 51/672 | 7.6% | 0.06 | 0.00 | 9.8 |
| truncated / unresolved | 1/672 | 0.1% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 362/672 (53.9%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
