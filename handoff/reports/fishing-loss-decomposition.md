# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-12T15:31:30.358Z.

553 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 278/553 | 50.3% | 1.00 | 7.05 | 2.9 |
| escaped (fish at full HP) | 241/553 | 43.6% | 0.64 | 5.91 | 4.1 |
| mana out | 33/553 | 6.0% | 0.09 | 0.00 | 9.9 |
| truncated / unresolved | 1/553 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 299/553 (54.1%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
