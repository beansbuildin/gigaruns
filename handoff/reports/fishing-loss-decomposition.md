# Fishing loss decomposition

Regenerated from `data/run-reports/fishing-loss-decomposition.jsonl` by `scripts/lossDecompositionReport.ts` — do not hand-edit. Last generated 2026-09-25T03:32:07.703Z.

767 clean casts (`loadCastTraces()` + `isCleanTrace`) over the full fixture corpus. Terminal reason, in order:

| terminal reason | n | % | mean final focus | mean final mana | mean turns |
|---|---|---|---|---|---|
| caught | 398/767 | 51.9% | 0.98 | 6.94 | 3.0 |
| escaped (fish at full HP) | 303/767 | 39.5% | 0.65 | 5.82 | 4.1 |
| mana out | 65/767 | 8.5% | 0.06 | 0.00 | 9.8 |
| truncated / unresolved | 1/767 | 0.1% | 0.00 | 7.00 | 3.0 |

Casts that ever reached `focusMeter 0`: 417/767 (54.4%).

See `handoff/DECISIONS.md`, 2026-09-02 (session 117) for the per-batch breakdown that motivated wiring this in, and `npx tsx scripts/lossDecomposition.ts` for the turn-by-turn focus/mana profile this summary table does not carry.
