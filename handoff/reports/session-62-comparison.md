# Rule 8 vs the lowest-tier era — 4-vs-4 historical comparison

**PRE-REGISTERED session 62, 2026-08-20, BEFORE either new run started.**
Committed ahead of the runs deliberately: selecting the comparison group after
seeing today's results is the renegotiation QUESTIONS.md §19 exists to prevent,
and it is unusually easy to do here because the historical arm is sitting in the
corpus waiting to be re-sliced. Brief §2b.

---

## §2c PRECONDITION — the HARD CORES field, settled BEFORE any comparison

**The field is `gameItemBalanceChanges[].id === 845`** (`NAME_CID: "Hard Core"`,
`src/sim/dungeonReport.ts`'s `ITEM_HARD_CORE`) — a TOP-LEVEL array on dungeon
POST responses, sibling to `data`, not inside it. A run's count is the sum of
`amount` over every such entry across all its captured states. It is credited on
`message: "Reward chosen"` responses, i.e. on boon picks.

**First appearance across the whole fixture corpus:**
`fixtures/dungeon-runs/run-2026-08-14-22-02-31/state-001.json`, carrying
`{id: 845, amount: 84}`. Measured by scanning all 2877 `state-*.json` files
under `fixtures/dungeon-runs/` (excluding `raw/`); 136 carry an `id: 845` entry,
274 carry a non-empty `gameItemBalanceChanges` at all, the earliest of those
being `run-2026-08-14-20-05-00`.

**Verdict: the field PREDATES all eight runs, by six days.** The earliest of the
eight is `24924689` at `run-2026-08-20-00-30-50`; the field has been captured
since `2026-08-14 22:02:31`. Independently, all twelve juiced runs on record —
including all eight in this comparison — have at least one `id: 845` entry
actually recorded, so no run's count is an artifact of the field being absent.

**Therefore CLAUDE.md rule 10 does not bite here and the HARD CORES comparison
is available.** This was checked first precisely because it is the single most
likely way this comparison produces a confident wrong answer: session 52
concluded the server had changed when what changed was what was being recorded.
It did not happen this time, and that is a measured result, not an assumption.

No HARD CORES cell is imputed anywhere in this report. Brief §6.

---

## The comparison group, fixed in advance

**Historical arm — the four chronologically immediately preceding juiced runs
from the lowest-tier era**, i.e. the last four by timestamp before rule 8 took
effect on 2026-08-20. Selected by timestamp, not by convenience:

| # | run | capture dir | entry TIER_CID | energy |
|---|---|---|---|---|
| H1 | 24924689 | run-2026-08-20-00-30-50 | 3 | 60 |
| H2 | 24924936 | run-2026-08-20-00-45-21 | 3 | 60 |
| H3 | 24925597 | run-2026-08-20-01-34-30 | 3 | 60 |
| H4 | 24925642 | run-2026-08-20-01-38-22 | 3 | 60 |

These are the last four of session 60's recorded eight lowest-tier juiced depths
(7, 6, 6, 5, 8, 7, 4, 10) — the eight are runs 24890133, 24892362, 24893069,
24893156, 24924689, 24924936, 24925597, 24925642 in that order, and the four
above are its tail. Two older juiced runs exist (24833553 at TIER_CID 1,
24860624 at TIER_CID 3) and are deliberately NOT used: they are not the
immediately-preceding four.

**Rule-8 arm — today's four, two of which already exist:**

| # | run | session | entry TIER_CID | energy |
|---|---|---|---|---|
| R1 | 24943210 | 60 | 3 | 60 |
| R2 | 24945829 | 61 | 3 | 60 |
| R3 | *this session* | 62 | 3 (pre-registered) | 60 |
| R4 | *this session* | 62 | 3 (pre-registered) | 60 |

**Entry conditions are IDENTICAL across the two arms** — every one of the eight
is `TIER_CID 3`, 60 energy, 3 run-units. So §2d's "HARD CORES per energy spent"
is not required to make the totals comparable; it is reported anyway, and it is
necessarily just the totals over a constant divisor. This was checked before the
runs, not asserted.

**If a run is lost** — an assertion halt, a `PerpetualOnlyOfferError`, a guard
trip — the rule-8 arm is three and this is reported as a 3-vs-4, said plainly.
No run from another day is substituted to fill the slot. Brief §2a, §6.

---

## Results

*(filled in after the runs — see below)*
