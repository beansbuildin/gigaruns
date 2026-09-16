# session 132 — 2026-09-15 — third gold point (Summoner), 4 T3 runs incl. a resume, 22 Golkan casts — RECAP RECOVERED IN SESSION 133

⚠ **This log was written by session 133, not session 132.** Session 132 spent
its full day (12/12 run-units, two fishing batches) and ended at ~17:56Z
without a recap. Its captures, scratch file and code changes were left
uncommitted; session 133 committed them as `e2500a76` and wrote this log from
`handoff/scratch-session-132.md` (the primary source), the six run logs and the
two fishing logs. Nothing here was re-derived where the scratch file already
recorded it; the fishing arm, which the scratch file does not score, was scored
from its logs. The pin pass for this day's captures ran in session 133,
together with session 133's own, and is recorded in `log/session-133.md`.

## Status
Worked the session-132 brief. **The live day was spent in full and correctly;
the recap was not written.** Pre-registration commit `baadd90e` landed before
the first `start_run`.

**One authorization, given in chat (~17:08Z):** *"Go now on day 20710"*, *"Yes —
4 T3 runs + casts"*; rod: *"No repair - cast until broken or until ledger runs
out, I will repair if broken."* Later (~17:46Z): *"Resume run 4 now"*, and for
fishing *"complete all fishing casts, ignore gear breaks"* with the confirmed
option **"Approve: up to 24 casts"** (Golkan, batches ≤ 12, lures ignored, rod
at 0 a hard stop, crossing 18:00Z allowed, rule 5 standing).

## Session open (live, 17:06Z)
- JWT exp 2026-09-20T16:32:40Z (119.4h). Day **20710, dow 4**, rollover 18:00Z
  (~53 min). Run-units 0/12, fishing 0/20, ledgers agree.
- Gold 224 (Foxglove 19, Overseer 25, Crusader 25, Archon 28, Athena 35, Chobo
  44, Summoner 48); silver 159 — both brief claims exact.
- Gear: 640 24, 641 60, 905 14, 901 24, rod 812 24, slot-15 954 0/10, 204 4, 50 0
  (grandfathered). Dry-run `index 3`.

## Dungeon arm — 12/12 run-units, 4 juiced Tier-3 runs, 0 first-attempt failures
| run | log | death room | 845 | ÷48 | 846 | table |
|---|---|---|---|---|---|---|
| 1 | 17-19-23 | 10 | 9,360 | 195 | 687 | 687 ✓ |
| 2 | 17-25-13 | 5 | 3,552 | 74 | 141 | new: 5 → 141 |
| 3 | 17-28-02 | 11 | 10,944 | 228 | 840 | 840 ✓ |
| 4 | 17-33-09 + 17-46-39 (resume) | 11 | 4,512 + 6,624 = 11,136 | 232 | 141 + 699 = 840 | 840 ✓ |

Actions 70 / 37 / 74 / (pre-drop) + 62. Payout method re-validated first
against session 131's figures.

- **⭐ THIRD GOLD POINT: 249 SUMMONER, 48 → 45 → 42 → 39 → 36.** Read after run 1
  in isolation, twice, stable. H1 PASS (shape 9/9 → 12/12), **H2 PASS** (neither
  Foxglove nor Archon — the permutation survives). Named nominal Athena FAILED.
- **Hard Core 34,992 / 37 rooms = 945.7/room = ×1.93** (band PASS).
- **`--resume-existing` costs no run-unit** — run 4's network `fetch failed` in
  room 5; rule-13 ledger read showed 12/12 already; the resume kept it 12/12.
  **Gear debit lands at `start_run`.**
- Gear exact on the −3 path (640 12, 641 48, 905 2, 901 12 at end); **slot-6 204
  stayed at 4 — not a wear piece.** Slot-15 954 read 25 after run 2 (repaired
  out of band mid-session — eighth consecutive stale gear forecast).

## Fishing arm — 22 played / 20 charged on Golkan (812)
Scored in session 133 from `logs/fishing-2026-09-15-17-50-39.jsonl` and
`…-17-54-00.jsonl`:

| batch | start | played | caught | oils | rod | exit |
|---|---|---|---|---|---|---|
| 1 | 17:50Z | 12 | 8 | 4 | 24 → 12 | `cast_cap` |
| 2 | 17:54Z | 10 | 6 | 2 | 12 → 2 | `ledger_exhausted` |

**14/22 = 63.6%.** Rod −1.00 per played cast; **it ended at 2, not 0.** Ledgers
agreed at every reconciliation (last read 19/19 before the final cast).

## Corpus finding — the "Golkan" slice pooled two rods
Recomputed pre-batch (`loadCastTraces` → `splitByDealtDeck.rod` → `deckOf`):
the carried 192/327 reproduced exactly, but by grant-subset it split into
**811 Shroom 45/82 = 54.9%** and **812 Golkan 147/245 = 60.0%**. Other slices
reproduced (923 54/104, 924 11/27, 922 21/82). Session 133 found the cause
(card 74 is in both grants) and fixed `deckOf`.

## Changes left uncommitted (committed by session 133 in `e2500a76`)
- `src/strategy/fishing/oilBatch.ts` +`SESSION_132_LIMITS` (castCap 12).
- `scripts/liveFishing.ts` → `SESSION_132_LIMITS`.
- `scripts/doctor.ts` prints the absolute JWT `exp` — the long-deferred fix.
- 5 dungeon run captures, 22 fishing cast captures, `handoff/reports/*`.

## What was not done
- Recap, STATE, DECISIONS, SPEC table row, pin pass — all done by session 133.
