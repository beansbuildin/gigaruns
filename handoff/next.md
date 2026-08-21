# BRIEF — session 65

## The clock and the ledger

Written **2026-08-21, 08:55 PT**, about **two hours before the 11:00 rollover**.
Session 64 ran before the roll, so as written the ledger day is still
2026-08-20: **7 fishing casts left (13/20 spent), 0 dungeon run-units.**

**This brief authorizes a SEVEN-CAST fishing batch and ZERO dungeon runs.**

**The batch is seven casts on whichever ledger day you find.** If you start
before 11:00 that is the whole remainder of the old day; if you start after, it
is seven of a fresh twenty. Unused casts do not carry over, so there is nothing
to rescue and no reason to rush — **check the ledger, report which day you are
in, and cast seven either way.**

```
npx tsx scripts/checkFishingCaps.ts
npx tsx scripts/checkDungeonToday.ts
```

**Twelve run-units appear at 11:00 and are not authorized.** User decision,
2026-08-21: no dungeon runs this session. Rule 11 needs a per-run go-ahead
regardless, and a full ledger is not one. Rule 13 applies to every live command.

---

## 1. The seven-cast batch — §19's turns are the goal, 937 is the lottery ticket

**User decision, 2026-08-21:** spend the seven casts. Same `on-demand` policy,
never force a consume.

This batch is **not** the session-64 shape. It does **not** stop at the first
oil consume — it runs the full seven, because the primary objective is
instrumented turns and every cast supplies them whether or not an oil is spent.

### 1a. What seven casts buys

*Source: session 64 measured rates (corpus n=102 for reachability; 13 turns over
7 casts for the turn rate). Projections are arithmetic on those, not measurements.*

| objective | mechanism | expected from 7 casts |
|---|---|---|
| **§19 instrumented turns** | every cast contributes | ~13 turns → **20 + 13 = 33 of 32**, powering the DROP arm |
| **`slotIndex` for 937** | Relaxing trigger reachable 9.8% of casts | **~51%** chance of at least one firing |

The turn rate is the load-bearing projection. **If casts run short and the batch
ends below 32 turns, say so plainly and do not round up** — a rule that powers at
32 does not power at 31.

### 1b. Stop conditions

Halt on the first of:

1. **Seven casts completed.** The intended exit.
2. **The ledger is exhausted** or has fewer than the batch needs.
3. **The zero-streak tripwire at 15.** Compute it from the corpus with
   `zeroStreak.ts` rather than quoting a remembered value — session 64 wired it
   for real and this is its first live batch.

**Do NOT stop on an oil consume.** Not on the first Focus consume, not on a
Relaxing consume, not on a second consume within a cast. Those are captures, not
exits.

### 1c. Partial dry is now the expected state, and it is new

*Source: session 64 live balance read.* Stock is **Relaxing 1, Focus 22**.

The moment the Relaxing Oil is spent, the bot is in a state no previous batch has
been in: **one oil exhausted while the other is plentiful.** Session 64's
`oilBatch` halt covers stock reaching zero for *both*. Partial dry is different:

- A Relaxing trigger with zero Relaxing stock records **OIL-POLICY-DRY** for that
  trigger and the cast **continues**.
- A Focus trigger in the same cast **still consumes normally**.
- The batch **does not halt**, because the Focus objective is unaffected.

This is gate half 2. Get it right in code before the batch, not after.

### 1d. Per-cast instrumentation

Unchanged from session 64 and still the right list. `oilCastState` first, then
trigger reachability by the pinned definitions, the full `fishHp` and
`focusMeter` trajectories, turns, outcome, focus spend.

On any consume: `slotIndex`, the full `use_fishing_item` envelope, board deltas
across the consume, and mana. **If 937 fires, that is the session's headline** —
it is the last mechanical unknown on the oil path.

**Do not report the risk surface as retired unless 937 actually fires.** A
~51% shot that misses is a miss, and the second-consume-in-one-cast index stays
unexercised either way unless both triggers happen to fire in one cast.

---

## 2. §19 — it powers at 32, and the verdict stands whatever it says

*Source: session 64 measured.* §19 sits at **20 of 32 instrumented turns**.
π crossed 0.5 for the first time in the programme's history (cast 13019015, max
**0.727**), giving **KEEP** on the existence arm with `verdictIsPowered: false`.

Seven casts should carry it past 32 and power the DROP arm for the first time.

**Pre-registered now, before the batch:**

- **Whatever the shipped rule returns at n ≥ 32 is the answer.** Do not add a
  clause, do not raise N, do not gather more because the number is close.
- **A powered KEEP closes §19.** Record it as closed in `DECISIONS.md`, stop
  reporting turn accrual, and stop budgeting casts for it.
- **A powered DROP means dropping the matcher tier**, which is a live-policy
  change and needs the user's go-ahead — report it and stop, do not implement it
  in-session.
- If the batch lands **below 32**, the verdict stays unpowered and the honest
  report is "still unpowered, n short by X."

**Why the pre-registration matters more here than anywhere else.** This rule has
been renegotiated once already — at n=7 it read DROP, and the user chose to
pre-register a replacement and gather rather than act on it. **That call has been
vindicated**: the crossing at 0.727 could not have been seen at n=7, and dropping
then would have removed something real. The way to spend that credit badly is to
renegotiate a second time because the powered answer is unwelcome.

---

## 3. Re-run the oil timing sweep on the measured turn cost

*Source: session 64 measured from the live `use_fishing_item` envelope.*
`use_fishing_item` **costs no turn** — the response carries `FOCUS_STAMINA_DIFF`,
no `FISH_MOVED`, and `fishPosition`, `previousFishPosition`, `lastMovePath`,
`hand`, `discard` and `nextCardIndex` are all identical across it. No mana either.

`oilTimingSweep.ts` scored every policy under **both** turn-cost assumptions
because the payload never said. One arm is now known to be the real one, and
**nobody has re-run the sweep since.** It is offline, cheap, and overdue.

- Re-score on the free-consume arm only.
- **Report the corrected headline.** The +19.40pp figure was computed across both
  arms and should not be quoted again until it has been recomputed.
- The free arm was the favourable one, so **no policy ranking is expected to
  change** — `on-demand` should still win. Say so if it does, and say so loudly
  if it does not.
- Pin the measured turn cost so the sweep cannot silently drift back to sweeping
  a resolved parameter.

---

## 4. Corrode in `dungeonSim` — DECIDED: leave it inert

**User decision, 2026-08-21.** Corrode stays modelled and live-wired, and stays
inert in `dungeonSim`. Sim enemy profiles carry no buff id and none will be added.

**Write this into `DECISIONS.md` as a closed decision, with the reasoning**, so it
stops surfacing as an open question every session — it has now appeared in two
consecutive recaps:

> The simulator is already near-blind (617 of 622 non-Safe paths carry
> `rolledEnemyStats`; session 56 measured exactly zero freed exchanges from
> modelling buffs) and is largely unused for policy decisions. Wiring corrode
> into `dungeonSim` requires inventing which buff a simulated room's enemy
> carries — a scenario assumption, not a measurement — and the return does not
> justify it. Corrode remains modelled in the combat core and live-wired through
> `buildBattleState`. Decided 2026-08-21.

Keep the two standing notes: a perpetual corrode would be under-modelled
(corpus-justified, safe failure direction), and the twin table is **not** to be
completed to a neat 3×2 — `perpetual_corrosiveShield` and
`perpetual_corrosiveMagic` have zero observed appearances.

---

## 5. Carried

- **Boon coverage is unchanged at orb 6 / priority 2.** Zero dungeon runs since
  session 62. **Do not re-report it as if it moved** — this is the second brief
  saying so.
- Rule 8's measurement programme is **CLOSED** (DECISIONS 2026-08-21). Do not
  re-run it or propose a new one.
- Carried and deliberate: 25 analysis scripts hold hardcoded paths (ratcheted);
  `boonCapture` stays **OFF**; distribution steps 3–6 remain the user's;
  `LICENSE` is resolved as `Copyright (c) 2026 Sabre`.
- **The recap checklist's `.gitignore` line is stale for the seventh session.**
  It says to confirm `config/discovered.json` is ignored; it deliberately is not.
  **Fix the checklist this session** rather than noting it an eighth time.

---

## 6. Gate

Both halves are offline and deterministic; neither depends on what the batch does.

1. **The oil timing sweep is re-scored on the measured free-consume arm**, the
   corrected headline delta is reported, and a test pins the turn cost to the
   measured value so the sweep cannot revert to sweeping it.
2. **Partial dry is handled and tested**: a Relaxing trigger with zero Relaxing
   stock records OIL-POLICY-DRY, the cast continues, a Focus trigger in the same
   cast still consumes, and the batch does not halt. **Demonstrate the test
   failing with the partial-dry branch removed**, then restore.

---

## 7. Do not

- **Do not run a dungeon run**, including after the 11:00 rollover.
- **Do not stop the batch on an oil consume** (§1b).
- **Do not force a consume** or re-run a cast.
- **Do not renegotiate §19 at n ≥ 32** — no new clauses, no raised N (§2).
- **Do not implement a DROP verdict in-session**; it is a live-policy change.
- Do not quote the +19.40pp figure until §3 recomputes it.
- Do not report the oil risk surface as retired unless 937 actually fires.
- Do not re-report boon coverage as if it moved.
- Do not count the `use_fishing_item` response as a turn — it repeats the
  preceding turn's move fields, breaks continuity, and would drop the whole oil
  cast out of the movement corpus.
- Do not drop "with a turn remaining" from a reachability definition; it inflates
  Focus reachability by 14 casts, in the flattering direction.
- Do not clamp a fabricated `[0,0]` onto the grid.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me, and a format rule I am now applying rather than restating

- **`previousFishPosition: [4,4]` was a single observation generalised into a
  claim.** The corpus sends all 16 on-grid cells across 75 `start_run` states and
  `[4,4]` is 3 of them. Rule 9, fourth occurrence.
- **Session 64's recap made the sharper point and it is the one that lands:** the
  session-64 brief's own §7 diagnosed exactly this habit, asked for provenance in
  table captions, and then **the very next table in the same brief lacked one.**
  A diagnosis I do not act on is worse than no diagnosis, because it reads as
  handled.

**So, as a format rule from this brief onward — visible in §1a, §1c, §2 and §3
above, not just asserted here:**

> **Every table and every quoted figure in a brief carries its provenance
> inline** — *corpus-measured*, *live-measured*, *user-stated*, *sim-derived*, or
> *projected*. A number without a source tag does not go in a brief. If the tag
> is awkward to write because the provenance is unclear, that is the signal the
> claim needed checking before it was written down.

- **My six-clean-casts tripwire fired on the wrong target and I should own the
  shape of that error.** The pre-registration was sound and the arithmetic was
  right, but it assumed the only explanations for silence were "unlucky" or
  "trigger model wrong." The actual cause — **the policy was never wired to its
  config and could not consume at all** — was a third branch I did not consider,
  and it is the branch a pre-registered interpretation is least able to see,
  because it looks exactly like the hypothesis being tested. Session 64 was right
  to refuse to read §2c onto batch 1. **When a pre-registered test fires, check
  that the mechanism under test was actually running before believing the
  verdict.**

---

## Your task (session 65)

1. Check both ledgers; report which ledger day you are in. **No dungeon runs.**
2. **§1c / gate 2** — implement and test partial-dry handling **before** casting.
3. **§1** — the seven-cast batch under the live `on-demand` policy. Full
   instrumentation on every cast; full capture on any consume.
4. **§2** — report §19's verdict as the shipped rule computes it. Close it if a
   powered KEEP; stop and report if a powered DROP; say "still unpowered" if
   short of 32.
5. **§3 / gate 1** — re-run the oil timing sweep on the measured turn cost and
   report the corrected headline.
6. **§4** — write the corrode decision into `DECISIONS.md` as closed.
7. **§5** — fix the recap checklist's stale `.gitignore` line.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the **final**
   commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** The most likely outcome is a quiet, productive session:
§19 powers and closes on a KEEP, the sweep's headline gets corrected downward or
holds, 937 misses on a coin-flip, and the batch adds seven casts of ordinary data.
**The thing worth watching for is the shape of session 64's bug repeating** — a
component that is shipped, gated, tested and inert because nothing hands it its
dependency. Session 64 found one because a live result contradicted a live
expectation. §1c is the same risk in miniature: partial dry is a state no code
path has ever executed, and the batch is the first thing that will run it.
