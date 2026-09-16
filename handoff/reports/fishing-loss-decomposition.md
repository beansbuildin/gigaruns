# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-15T17:56:58.653Z.

605 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 305/605 | 50.4% | 1.00 | 7.04 | 2.9 |
| escaped (fish at full HP) | 256/605 | 42.3% | 0.64 | 5.94 | 4.0 |
| mana out | 43/605 | 7.1% | 0.07 | 0.00 | 9.8 |
| truncated / unresolved | 1/605 | 0.2% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 327/605 (54.0%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
