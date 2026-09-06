# PRE-REGISTRATION — session 124 — written BEFORE any spend

Committed before the first `start_run` and before the first cast. Game day
**20702**, `dayOfWeek` **3**, read live. Rollover in 18:30:55.

No addresses, no usernames, no JWT fragments in this file.

---

## Step 0 — the JWT, recorded as a number (second ask, now discharged)

`scripts/doctor.ts`: **token valid for another 137.2h ≈ 5.7 days**. Runway is
not a constraint for this session and no chat warning is owed.

## Step 1 — the live reads, and Claims A–F

| # | claim | verdict |
|---|---|---|
| A | day 20702, dow 3 → **Foxglove (139)** | **PASS** |
| B | balances are session 123's close, total 231 | **PASS** (did not rise this time) |
| C | run-units a fresh 0 of 12 | **PASS** (`dayProgressEntities` null) |
| D | fishing a fresh 0/20 charged | **PASS** (both ledgers agree at 0) |
| E | rod is Dendren (923), slot 14 | **PASS** (durability 16) |
| F | item 50 (slot 8) is the superseded Stone Rod, at 0, grandfathered | **PASS** |

Balances read live: Athena 21, Archon 24, Crusader 27, Chobo 30, Overseer 42,
Summoner 42, **Foxglove 45**. Total **231**.

---

## PREDICTION 1 — the gear-break forecast. HIGH confidence, and it CUTS THE
## DUNGEON ARM FROM FOUR RUNS TO ONE.

Wear rate, measured n=4 last session: **−3 per run on exactly four pieces**
(slots 11, 12, 13×2), six unmoved.

| slot | item | durability now | runs to zero = floor(d/3) |
|---|---|---|---|
| 11 | 640 | 58 | 19 |
| 12 | 641 | 36 | 12 |
| 13 | 905 | 18 | 6 |
| 13 | **901** | **2** | **0 — breaks on RUN 1** |

**I predict item 901 (slot 13) reads 0 after dungeon run 1**, exactly as item
905 went 3 → 0 during session 123's run 2. Under the [USER] gear halt that
**stops the dungeon arm after run 1**, so this session plays **1 of the 4
authorised runs**, not 4.

Falsifiable three ways, and each would be a finding about the rate at n=4:
- 901 reads 2 → 0 after run 1 → **forecast holds**;
- 901 reads something other than 0 → the −3 rate or the wearing set is wrong;
- a piece outside {640, 641, 905, 901} moves → the wearing set is wrong.

**Interpretation flagged, not assumed:** the halt stops the DUNGEON arm only.
The four wearing pieces are dungeon slots; fishing uses 8/14/15. Fishing
proceeds after a dungeon gear halt. Stated so the user can correct it.

## PREDICTION 2 — the rod-break forecast. The fish-to-zero halt has NEVER been
## exercised and I predict it fires this session, at played cast 16.

Rod **923, slot 14, durability 16**. Rate **1.00 per PLAYED cast**, and today's
read corroborates it independently: session 123 recorded the rod at **40 and
unmoved across all four dungeon runs**, then played 24 casts; 40 − 24 = **16**.

**I predict the rod reaches 0 on played cast 16**, and the [USER] fish-to-zero
halt fires there.

Consequence worth stating in advance: 16 played < the server's 20-charge cap,
so **this session will NOT reach the server refusal** and will NOT produce a
third data point on where that refusal lands (24, then 25). That is a cost of
the halt, not a failure.

## PREDICTION 3 — the charge SHAPE, currently 25/25

Per run: **exactly one faction moves, exactly −3, the other six untouched.**
Today's faction is **Foxglove (139)**, read off the measured rotation table —
bookkeeping, not a discovery. One run takes the shape count to **26/26** and
Foxglove **45 → 42**.

---

## PREDICTION 4 — §71, and ⚠ THE GATE WAS ALREADY ANSWERABLE FROM COMMITTED
## FIXTURES. It cost zero casts, and §71's dichotomy is FALSE.

`scripts/redrawDeckSlice.ts` (new) slices the corpus by the deck the server
actually dealt — Dendren ids 91–100, Golkan 80–90, and a **third, earlier deck**
(base ids 1–7 + loot) that §71 does not know about. **The corpus straddles at
least TWO deck changes, not one.**

Computed on the corpus as committed, before this session's casts:

```
POOLED (all decks)   457 traces   b10 net 32   all3 net 32   MARGIN  0
LEGACY only          126 traces   b10 net  8   all3 net  1   MARGIN +7
GOLKAN only          307 traces   b10 net 23   all3 net 28   MARGIN -5
DENDREN only          24 traces   b10 net  1   all3 net  3   MARGIN -2
```

**§71 assumes the pre-swap corpus carried a positive margin that the rod swap
may or may not have destroyed. It did not.** The largest single-deck slice —
Golkan, 307 traces, 673 plays — is already **negative**. So both branches of
§71's dichotomy are mis-specified, and its nominated Dendren-only discriminator
would have returned "margin ≤ 0" and been read as "the collapse is the thesis"
for the wrong reason.

**Deck and policy era are confounded, so the decks were compared at CONSTANT
era.** The `focusDry` era is the one cell containing all three decks:

```
focusDry x legacy    12 traces   MARGIN  -1
focusDry x golkan   265 traces   MARGIN -16
focusDry x dendren   24 traces   MARGIN  -2
```

**Every deck is ≤ 0 at constant era.** The positive margin lives in the two
OLDER ERAS instead (preOil +6, oilSupplied +13, focusDry −19). So the K=10
separation tracks the POLICY ERA, not the rod.

**A mechanism was hypothesised and MEASURED AND REJECTED, recorded so nobody
re-proposes it.** I guessed the K=10 arm (`sweepWithBudget`, conditioned on
`budget >= 1`) collapsed because budget-zero plays became rare. Measured
budget-zero rates by era are **preOil 41.2%, oilSupplied 0.7%, focusDry 30.2%**
against margins **+6 / +13 / −19** — no monotone relation, and the era with
essentially no budget-zero plays has the LARGEST positive margin. **The
mechanism is NOT established and no explanation is offered.**

⚠ **Power.** The Dendren and legacy cells fire only 4–7 times; those margins are
not distinguishable from zero. **Only the Golkan −16 at 265 traces carries
weight.** The two arms are overlapping subsets of the same plays, so no p-value
is quoted.

⚠ **The pinned thresholds are K=10-with-budget and K=3-unconditional, fitted on
the POOLED corpus with oracle labels.** Slicing does not re-fit them. The claim
is "these pinned thresholds do not separate within any single deck", NOT "no
threshold separates".

**The forward prediction, which is what is actually pre-registered here:** this
session's casts take the Dendren slice from 24 to roughly 40 traces. **I predict
the Dendren-only margin stays ≤ 0** and does not reopen. If it goes positive at
n≈40 that contradicts the Golkan result at n=307 and is a finding.

⚠ **This resolves the DISCRIMINATOR; it does NOT retire the claim.** §71 needs a
**USER decision**, exactly as §70 did. The pinned assertion stays pinned.

---

## Standing constraints acknowledged

- Rule 11: one run, then stop and hand back. The brief's "4 runs authorised"
  does not repeal per-run approval; each `start_run` is asked in chat.
- Rule 8 governs in-room tier picks; entry tier is `--juiced-index=2`.
- Rule 13: any denied / blocked / interrupted live command is checked against
  the server ledger before it is believed, and never retried on a denial.
- Oils Relaxing-only; double-lethal disabled; Focus Oil off the allowlist.
- Catch rate is NOT raised as a concern and no study is commissioned.
- Corpus pins are updated only after the LAST fixture lands, never between runs.
