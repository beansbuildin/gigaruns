# STATE — session 135 — 2026-09-19 — commit (see the session-135 commit)

## Status
No numbered TASKS.md gate. A **short, user-driven fishing session**: *"the
rollover has passed, run 30 fishing casts immediately"*, then `/gigarecap`.
There was no `/handoff` brief.

**Closeout: GATE FAIL — the suite is not green, on purpose.** 2845/2846. The one
failure is a **pre-registered tripwire** in `tests/fishing/damageEconomy.test.ts`,
whose own comment says *"If it breaches 10%, RE-EXAMINE the claim — do not move
this bar."* It reads **0.10048**. I did not move the bar. See What's broken.

**Live fishing, day 20714:** one `--oil-batch` of **25 played / 20 charged
(20/20, cap spent) / 13 caught**, 1 Relaxing oil, rod 812 **40 → 15**.
- ⚠ **The user said the rollover had passed; it had not.** At 17:51Z there were
  9 minutes left of day 20714, with 0/20 spent. I cast immediately, per
  CLAUDE.md rule 14. The batch hit the day's cap at 17:59:40Z, 20 s before
  rollover.
- **The last 5 of the 30 were NOT played.** At 18:00:16Z day 20715 read a fresh
  0/20. I issued `--casts=5` and **the user rejected the tool call**. Rule-13
  ledger read at 18:03:53Z: **game 0/20, repo 0, rod still 15, no new log**, so
  nothing ran. **Day 20715 has 20 casts unspent.**

**Rod 812: 15** — enough for a full day. **JWT** exp 2026-09-20T16:32:40Z: **~22h
from this recap, and it WILL bind the next session** unless the user refreshes it.

**No dungeon activity, and the ring balances were not read this session.**

## Settled — do not re-open
Pointers only. `DECISIONS.md` and `QUESTIONS.md` own the evidence. **[USER]** = a
user directive an agent may not re-open at all.

**Dropped this session, two, both now in CLAUDE.md:**
- "never wait for the rollover" is **rule 14**;
- "fishing stops only on a broken rod" is **rule 11**.

- ⭐ **[NEW] THE damageEconomy 10% BAR IS A TRIPWIRE, NOT A PIN.** It breached at
  0.10048. The claim gets re-examined; the bar does not move. Re-opens as:
  *"widen the bar to 0.11"*, *"the patcher refused a pin, fix it by hand"*.
- ⭐ **[USER] THE ROD IS GOLKAN (812).** Re-opens as: *"swap back to 924/923"*,
  *"the sim says Dendren beats Golkan"*.
- ⭐ **THE GOLKAN SLICE IS 812-ONLY: now 197/335 = 58.8%** (was 184/310).
  Recompute from the corpus; never pool 811. Re-opens as: *"Golkan 58.7%"*,
  *"add 74 back to GOLKAN_IDS"*.
- ⭐ **GOLD ROTATION: four clean points** (dow 2 Foxglove, 3 Archon, 4 Summoner,
  5 Overseer), **charge shape 16/16.**
  - The fifth, **dow 6 → Crusader**, is WEAK: it was out of band, and −12 was a
    net figure.
  - Re-opens as: *"the gold map has five confirmed points"*, *"predict the next
    gold faction by a step rule"*.
- ⭐ **AN ABORTED WRITE PRODUCES A TRACE SHAPE NOTHING ELSE DOES** (`hasStart`
  true, `continuous` false). Re-opens as: *"the second non-clean trace is
  another resumed cast"*.
- ⭐ **`--resume-existing` COSTS NO RUN-UNIT; gear debits at `start_run`.**
- ⭐ **A RESUMED RUN'S state-000 IS NOT AN OPENING LOADOUT.** Re-opens as: *"the
  corpus shows a new starting loadout"*.
- ⭐ **SLOT-6 204 IS NOT A WEAR PIECE.** The wear set is 640/641/901/905.
- ⭐ **"Intuition quarters damage" and the Weak "exceptions" are Weak/Vengeance.**
- ⭐ **DENDREN ROOT (846) IS A FUNCTION OF THE DEATH ROOM.**
- ⭐ **`blockedMove`'s WIRING IS FALSIFIED.** Re-opens as: *"wire blockedMove in"*.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT.** The rod read 40 at this
  open after closing at 1; it was repaired out of band. Read `checkGear.ts` live.
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT** (still read all fourteen on a
  dungeon day).
- **[USER] THE DUNGEON GEAR HALT; OTHER DUNGEONS OUT OF SCOPE; fishing budget 360
  energy / 30 casts; Tier-1/Tier-3 income baseline RETIRED BY NAME.**
- ⚠ **PIN AFTER THE DAY'S LAST CAST.** Done this session.

## What works
- **`liveFishing.ts --oil-batch` with `SESSION_135_LIMITS` (castCap 30).**
  - 25 casts in ~8 min, rc 0.
  - It stopped cleanly at `ledger 0 left`.
  - Rod wear was exactly 1.00 per played cast.
- **`scripts/pinPatch.ts`, second live use:** 160 pins written automatically over
  17 passes, 9 refusals.
  - The refusals were all correct: 4 ratio pins, 1 constant, 2 id lists, 1
  anomaly list with its expression-valued pin, and the tripwire.
  - No syntax damage.
  - The late passes each moved one assertion. That is sequential assertions
    inside one test, **not oscillation**.
- **The rule-13 ledger read after the rejected `--casts=5`** — see Status.

## What's broken
- ⛔ **`damageEconomy.test.ts:321` is RED by design.**
  - `|unclamped.drift − LIVE.drift| / |LIVE.drift|` = **0.10048**, against a
    pre-registered bar of `< 0.1`.
  - The ratio's history: 4.7% at session 91, 8.0% at session 116, now 10.05%.
  - The test's claim is *"the clamp is real but small — the unclamped reading
    agrees in sign and within a hundredth"*. That claim now needs
    re-examination, and a bar move is explicitly forbidden.
  - **Needs a decision** (Open question 1).
- ⚠ **The JWT expires 2026-09-20T16:32:40Z**, before the next rollover window
  closes.
- ⚠ **ROM overflow warning, first time printed:**
  - The largest single ROM (400) is ≥ the pool headroom (359), so one claim can
    now reach the energy cap.
  - The overflow path is marked UNTESTED in `liveFishing.ts`.
  - Energy is not a constraint (rule 12). The worry is wasted ROM energy on a
    claim, not a blocker.
- ⚠ `checkGear.ts`'s DUNGEON HALT banner still fires permanently on item 50.
- ⚠ `factionDayRunway` + `tests/entryTierRunway.test.ts` are kept. Deleting them
  is a rule-11 edit.
- **`web/`** has been untouched since session 120.

## Corrections to SPEC.md
- None this session.
- **The user's "the rollover has passed" was off by 9 minutes.** It was 17:51Z;
  day 20714 was still open, with 20 unspent. That is not a SPEC matter, and it
  worked in the account's favour.
- **Resolved IDs:** forbiddenWoods=5, dendren nodeId "5" / pondId 2 (unchanged).
- **Move charges:** ABSENT for rings on the wire (unchanged since session 112).

## Dead ends
- **Don't widen a tripwire bar because the patcher refused it.** A refusal on
  `toBeLessThan` is the tool working.
- **Carried:**
  - `$TMPDIR` differs by sandbox mode, and git and the suite run UNSANDBOXED.
  - Never end a background loop with `[ $rc -ne 0 ] && break`.
  - Never read consecutive captures as consecutive exchanges.
  - `loadCorpus()` drops `data.events`.
  - §0a is NOT lifted: **+19.40pp and +17.74pp MAY NOT BE QUOTED.**
  - Don't reproduce −0.389.

## Metrics
- **Fishing, live day 20714:** 25 played / 20 charged, **13 caught (52.0%)**, 1
  Relaxing oil, rod 40 → 15.
- **Day 20715: 0 of 20.** The user stopped the 5-cast continuation.
- **Rod slices (corpus recompute, `loadCastTraces` → `splitByDealtDeck().rod` →
  `deckOf`):**
  - **812: 197/335 = 58.8%**
  - 811: 45/82 = 54.9%
  - 923: 54/104 = 51.9%
  - unknown/legacy: 32/109
- **Corpus:** **674 fishing casts** (was 649); 161 dungeon attempts.
- **`KNOWN_CRIT_ANOMALIES` 27 → 30.**
  - The fish-HP interval is **unchanged** at [1.500, 1.5625).
  - Two of the new rows are base 6, one is base 8; none is a new base.
- **Ratio pins:** 1157/1614, 1262/1614, 51/218, 86/110.
- **The in-sample redraw constant went 2.2 → 2.3.**
- **Suite:** **2845 passed / 1 failed (2846)**. `tsc` rc 0.

## Open questions for Claude
1. ⭐ **The damageEconomy tripwire fired (0.10048 against 10%).** Re-examine
   *"the clamp is real but small"* — the ratio has risen at every read (4.7% →
   8.0% → 10.05%). Retire the claim, or restate it on a quantity that is not
   composition-bound? Moving the bar is ruled out by the test itself.
2. ⭐ **WeakeningEvade is still held at n=1.** It was put to the user in session
   134 and has not been answered. Model it as latent by directive (the
   LossBlockUp precedent), or keep holding?
3. **The JWT expires in ~22h.** The next session's first act may be a refresh
   by the user.
4. **Day 20715 has 20 unspent casts**, rod at 15. Per rule 14 the next session
   spends them, if they are still open when it starts.

## Files changed
```
 scripts/liveFishing.ts               SESSION_135_LIMITS wired; in-sample 2.2 -> 2.3
 src/strategy/fishing/oilBatch.ts     +SESSION_135_LIMITS (castCap 30)
 tests/**                             ~15 files — 160 auto pins + 8 hand-worked
 fixtures/fishing-casts/live/**       25 cast captures (day 20714)
 handoff/{STATE,DECISIONS,log/session-135}.md
```
