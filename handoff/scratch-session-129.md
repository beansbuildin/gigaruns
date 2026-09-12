# PRE-REGISTRATION — session 129 — written BEFORE any spend

Ninth consecutive session. Read live at 2026-09-12T14:59–15:02Z, before the
first `start_run`. `825a8389` was session 128's.

## Authorization
ONE session authorization, given in chat 2026-09-12: **4 juiced Tier-2 runs,
full 12/12 run-units**, run consecutively without pausing (rule 11 as softened
2026-09-11). The brief did not claim it; the user gave it.

## Window
JWT valid **1.7h** from 14:59Z (≈16:45Z). Game day closes **18:00Z**
(`next day in 02:59:56`). **The token binds ~75 min before the day does.**

## 1 — Day, dow, faction (off the clock, not off the brief)
- game day **20707**, week 88, **dayOfWeek 1** → **faction 1 = Crusader (135)**.
- Predicted sole mover in every balance diff: **135 Crusader Silver**.

## 2 — The ring path
Opening, all seven read live:
`Athena 9 · Archon 12 · Chobo 18 · Crusader 27 · Summoner 30 · Foxglove 33 · Overseer 42` = **171**

Predicted: **Crusader 27 → 24 → 21 → 18 → 15**, −3 per run, **sole mover**;
the other six **untouched** at every one of four readings. Total 171 → 159.
Balances are an INSTRUMENT here, not a budget ([USER] 2026-09-11).

## 3 — The gear path (−3 per RUN on slots 11, 12, 13×2)
Live open: **640 = 60, 641 = 36, 901 = 12, 905 = 24.** Both of session 128's
zeros (640, 905) were repaired OUT OF BAND; the dungeon arm is NOT halted.
Item 50 / slot 8 at 0 is GRANDFATHERED and is not an arm halt.

| piece | open | r1 | r2 | r3 | r4 |
|---|---|---|---|---|---|
| 640 (11) | 60 | 57 | 54 | 51 | **48** |
| 641 (12) | 36 | 33 | 30 | 27 | **24** |
| 901 (13) | 12 |  9 |  6 |  3 | **0 ← BREAK** |
| 905 (13) | 24 | 21 | 18 | 15 | **12** |

**Predicted break run: 4** — 901 reaches 0 exactly as the 12-unit cap is hit,
so the per-arm halt costs nothing. Durability CLAMPS at 0.

## 4 — The charge shape
**45/45 → 49/49** after four runs (exactly one faction, exactly 3, no
`gameItemBalanceChanges` for rings on the wire).

## Also predicted
- Rule 8's tier picker: highest non-Perpetual tier every room; no-modifiers at
  the final room, keyed on the server's `maxRoom` (16 for Forbidden Woods).
- Fail closed on any unknown enum / 5xx / 3 consecutive action failures.

---

# PRE-REGISTRATION, PART 2 — the FISHING arm — written BEFORE the batch

Appended at ~15:25Z, after the dungeon arm closed at 12/12 and **before** the
first Puppeteer cast. The dungeon half above is already settled and is not
revised here.

## The rod
**924 Puppeteer was equipped OUT OF BAND by the user** — `checkGear.ts` read it
live in slot 14 at **DURABILITY 44**, Dendren (923) gone from the equipped set.
Not assumed, not carried across from Dendren's 10.

`CURRENT_ROD` repointed 923 → 924 **before** the batch, because
`readRodDurability` defaults to it and a stale 923 fails the preflight closed.

## 5 — `castCap` = 17, and why it is that number
Three candidate caps; the SMALLEST binds:

| cap | value | binds? |
|---|---|---|
| rod 924 durability | 44 | no |
| game ledger `dayDocs[2]` | 20 charged | no |
| standing budget | 30 casts / 360 energy | no |
| **slot-15 gear halt** | **17** | **YES** |

The two slot-15 pieces read **27 and 17** and wear **−1.00 per PLAYED cast**, so
the 17 reaches **0 at cast 17** and the [USER] per-arm halt fires there.
`SESSION_129_LIMITS.castCap = 17` is sized to that. The `castCap: 2` convention
does not bind — the dry-rod hazard needs the rod to reach 0 with casts still to
play, and 44 − 17 = 27 makes it unreachable.

## 6 — The per-play drift, computed off the fixture, NOT taken from the brief
E[fish-HP delta per play] at **random aim (s = 0)**, over each rod's ten cards
weighted equally:

| deck | cards in fixture | E[Δ fishHP / play] |
|---|---|---|
| Dendren (923) | 10 / 10 | **−0.300** |
| **Puppeteer (924)** | 10 / 10 | **−0.678** |
| Golkan (812) | **8 / 10** — 82, 83 ABSENT | −0.389 (brief said −0.400) |

**Dendren and Puppeteer reproduce the brief exactly.** ⚠ **Golkan does NOT, and
the reason is that the fixture holds only 8 of its 10 cards** — any Golkan
comparison rests on an incomplete deck. Flagged, not fitted.

**Predicted: Puppeteer ≈ 2.26× Dendren's per-play drift at the aim the bot
actually has.** ⚠ Deck arithmetic, NOT a measurement — it ignores the focus
meter, turn economy, fish HP pools, oils and redraw, and weights the ten cards
equally where `cardChoice.ts` does not. **The direction is robust; the
magnitude is not.**

## 7 — Gear path, fishing arm (−1.00 per PLAYED cast)
slot 15: **27 → 10** and **17 → 0 (HALT at cast 17)**; rod **924: 44 → 27**.
Predicted: the dungeon pieces (640/641/901/905) do **not** move across the
fishing batch — the two wear sets are disjoint.

## 8 — Catch rate
Reported as a **FOURTH slice**, never pooled into Dendren's 54/104. n on day one
is far too small to conclude anything, and that is said in advance.

## 9 — `rodDeck.test.ts` goes RED at the repoint, GREEN after the first cast
The test keys on the rod in the **latest recorded cast**, so the repoint is what
reddens it and the first Puppeteer cast is what heals it. ⚠ The brief predicted
the opposite direction.
