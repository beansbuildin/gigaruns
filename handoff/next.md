# BRIEF — session 64

## The clock and the ledger

Written **2026-08-21, 08:10 PT** — about **2h50m before the 11:00 rollover**.
Session 63 ran before the roll, so the ledger day is still 2026-08-20: **14
fishing casts remain, 0 dungeon run-units.**

**Check the ledger first and let it tell you which day you are in.** If the
session starts after 11:00 the counters reset to 20 casts and 12 run-units.

```
npx tsx scripts/checkFishingCaps.ts
npx tsx scripts/checkDungeonToday.ts
```

**This brief authorizes a FISHING BATCH (§2) and ZERO dungeon runs.** Twelve
run-units appearing at 11:00 is not permission — rule 11 needs a per-run
go-ahead and this brief carries none. Rule 13 applies to every live command.

---

## 1. FIRST, and offline: is either trigger actually reachable?

**Do this before spending a single cast. It costs nothing and it may make the
batch unnecessary.**

Session 63's one cast did not merely fail to fire a trigger — **both triggers
were structurally unreachable**, and the recap verified that from the board
states rather than inferring it from a missing log line:

- `fishHp` **12 → 9 → 4 → 0.** Never `<= 2` while alive; the fish went from 4 to
  dead in one hit. The Relaxing trigger had no window.
- `focusMeter` **3 → 1 → 1 → 0.** Zero only on the *terminal* state, with the
  fish already dead. The Focus trigger had no turn left to spend into.

That is one cast and proves nothing on its own. But it is a **specific
hypothesis with a free test**: that `on-demand`'s triggers fire often in the
simulator and rarely or never in live play, because live fish skip the 1–2 HP
band and the meter empties only as the cast ends.

**Run it over the 95-cast corpus.** For every cast, independent of what was
actually spent and independent of stock:

- **Relaxing reachable** — did any state show `fishHp <= 2` while the fish was
  still alive, with a turn remaining?
- **Focus reachable** — did any state show `focusMeter == 0` with a turn
  remaining and the fish still alive?

Report both as counts and percentages of the 95, and **state the exact
definitions in the report**, because "with a turn remaining" is the whole
question and a definition that quietly drops it will show reachability that does
not exist.

**Why this matters more than the batch.** The sim chose `on-demand` over every
alternative on the strength of the Focus trigger — `focus-when-empty-only` alone
is +17.74pp of the +19.40pp total. **If the meter only reaches zero as a cast
ends, that entire benefit is an artifact of the sim's cast model**, and the
policy shipped in session 62 is a no-op wearing a recommendation. This analysis
either retires that worry or turns it into the most important open item in the
programme, and it needs no casts, no oils, and no server.

**Report the finding to the user before starting the batch**, whichever way it
lands.

---

## 2. The batch — cast until the first oil is consumed, then stop

**User directive, 2026-08-21:**

> Play the same logic as before. Use oils if the policy calls for them, but do
> not force a consume. Keep casting until the first cast that uses an oil, then
> end the session and recap.

### 2a. Stock is not what the last brief said

The live read at the end of session 63 is **Relaxing 1, Focus 23** — not one of
each. Focus is abundant; **Relaxing is a single item.** Two consequences:

- The first consume will almost certainly be a **Focus Oil (item 942)**, so the
  batch most likely clears `slotIndex` for 942 and **leaves 937 unconfirmed**.
  Say so in the recap rather than reporting the risk surface as retired.
- If both triggers fire in one cast, all three unknowns clear at once — 942, 937,
  and the second-consume path. Unlikely. Do not engineer for it.

### 2b. Stop conditions, all of them

Halt and hand back on the **first** of these:

1. **A cast consumes an oil.** Finish that cast completely, then stop. This is
   the intended exit.
2. **Six casts with no consume.** See §2c — this is a finding, not a budget.
3. **The day's cast ledger is exhausted**, or fewer casts remain than the batch
   needs.
4. **OIL-POLICY-DRY on every remaining trigger** — if stock reaches zero for both
   oils, the stop condition can never be met and continuing spends casts for
   nothing.
5. **The zero-streak tripwire at 15.** It reset to **0** on session 63's catch, so
   it will not bind here, but it stays armed.

### 2c. Pre-register the six-cast interpretation NOW, before any cast

Under the sim's own consumption rate (~0.70 oils/cast, ~0.32 chance a cast
consumes nothing):

| casts with no consume | probability under the sim's model |
|---|---|
| 3 | 3.3% |
| 4 | 1.1% |
| 6 | **0.1%** |

**So six clean casts is not bad luck — it is roughly a 1-in-900 event under the
model, and the correct conclusion is that the model is wrong, not that the dice
were.** If the batch reaches six with nothing consumed, do not extend it, do not
call it inconclusive, and do not force a consume. Report it as **evidence the
trigger model does not describe live play**, and pair it with §1's corpus
numbers, which by then will say whether the corpus agreed.

This is the whole reason the cap exists. It is a tripwire on the policy, not a
budget on the ledger.

### 2d. Per-cast instrumentation, every cast in the batch

For each cast, record — and this applies to the clean ones too, which are the
ones that carry the §1 signal:

- **`oilCastState`**: oil cast / OIL-POLICY-DRY / clean non-oil. **First line of
  every cast's report.**
- **Trigger reachability, by §1's definitions**, whether or not stock existed.
- The full `fishHp` and `focusMeter` trajectories, turn by turn.
- Turns, outcome, focus spend.

### 2e. On the consuming cast

- **`slotIndex` for the item consumed**, and the full `use_fishing_item` request
  and response envelope.
- Board state immediately before and after: `focusMeter` or `fishHp` delta across
  the consume, to confirm the +2 lands as the payload says.
- Whether the fish advanced across the consume; whether a turn was spent.
- Mana across the consume. Session 62 settled that it costs none; the loop shouts
  if it moves. Record, do not re-litigate.

---

## 3. What this batch can and cannot tell you about oils

The user's stated purpose is to see how oils affect the fisher and the sim. Two
of those readings are available and one is not.

**Available — the sim's consumption rate against live.** The sim spends ~0.70
oils per cast. The batch gives an empirical rate over its casts. A sharp
divergence is a direct calibration failure on the exact quantity that produced
the +19.40pp, and it is worth reporting even at n=1 or 2 consumes because the
*denominator* is every cast in the batch, not just the consuming one.

**Available — mechanical verification.** `slotIndex`, the +2's real effect on the
board, turn and mana cost.

**NOT available — the oil's effect on catch rate, at any batch size this session
can reach.** And not only because n is small. **The trigger fires because of the
cast's own state**: a Focus consume happens in casts whose meter emptied — casts
going badly — and a Relaxing consume in casts with the fish nearly dead — casts
going well. Comparing consuming casts to clean ones inside the batch measures
that selection, not the oil.

**Do not report an oil-vs-non-oil catch comparison from this batch**, however
tempting the arithmetic looks. The §4b arms exist for accumulating across
sessions; one batch does not populate them meaningfully, and a within-batch
comparison is confounded by construction.

---

## 4. Carried and small

- **Corrode is modelled but inert in `dungeonSim`** — sim enemy profiles carry no
  buff id, so nothing sets `foeBuff` there. Session 63's honest default is to
  sample the buff from corpus offer frequency, which is a **scenario decision, not
  a modelling one. Put it to the user; do not decide it in-session.**
- **A perpetual corrode would be under-modelled.** `buildBattleState` attaches
  `activeEnemyBuff` only. Corpus-justified (0 states carry a perpetual corrode)
  and the failure direction is safe. Leave it; keep the note.
- **`tests/liveFishing.test.ts`'s `previousFishPosition: [0, 0]`** is the same
  fabricated-input trap as the `focusPoint` one, and the live wire reports
  `[4,4]`. Session 63 left it alone deliberately because changing it could shift
  matcher-derived expectations. **Look at it deliberately this session** — the
  fix is probably small, and the reason to do it now is that §1 and §2 both walk
  through meter-zero and low-HP states.
- **Boon coverage is unchanged at orb 6 / priority 2** — zero dungeon runs since.
  **Do not re-report it as if it moved.**
- **Do not complete the corrode twin table to a neat 3×2.** `perpetual_corrosiveShield`
  and `perpetual_corrosiveMagic` have zero appearances; they are absent because
  unobserved.
- Rule 8's measurement programme is **CLOSED** (DECISIONS 2026-08-21). Do not
  re-run it or propose a new one.
- Carried: 25 analysis scripts hold hardcoded paths (ratcheted); `boonCapture`
  stays **OFF**; distribution steps 3–6 are the user's; the recap checklist's
  `.gitignore` line is stale for the sixth session.

---

## 5. Gate

Both halves are offline and deterministic; neither depends on what the batch does.

1. **The trigger-reachability analysis (§1) exists, reports both triggers as
   counts and percentages over the 95-cast corpus, and its definitions are pinned
   by a test** — including a case that would pass a definition omitting "with a
   turn remaining" and fails the correct one.
2. **The batch's stop logic is implemented and tested**: it halts after the first
   consuming cast, at the six-cast cap, and on exhausted stock. Demonstrate the
   test failing with each halt removed, then restore — the same discipline used
   on the exhaustion branch and the corrode gates.

---

## 6. Do not

- **Do not run a dungeon run**, including after the 11:00 rollover.
- **Do not force an oil consume**, extend past six clean casts, or re-run a cast.
- Do not report a clean cast as a failure — under §1's hypothesis it is the
  finding.
- Do not report an oil-vs-non-oil catch comparison from this batch (§3).
- Do not report the risk surface as retired if only 942 was exercised (§2a).
- Do not decide the `dungeonSim` corrode scenario in-session (§4).
- Do not "fix" a fabricated `[0,0]` by clamping it onto the grid; the board never
  sends it, and repairing fabricated input is how a suite stops testing the server.
- Do not read a `shield.currentMax` delta across a state boundary without deduping
  on the `(myLastMove, foeLastMove)` pair.
- Do not make corrode scorable; it stays a `mechanic` kind.
- Do not put identifiers in a test that guards against identifiers, and do not give
  a new I/O-owning test construction a real data path.

---

## 7. Corrections to me

Session 63 corrected the brief twice, and both times the same way.

- **The brief said the user holds one Mid Focus Oil and one Mid Relaxing Oil. The
  live read is Relaxing 1, Focus 23.** I took a figure the user gave in
  conversation and wrote it into the brief as fact. Rule 9 exists for exactly
  this and its target is not only the corpus — **a stated inventory is a claim,
  and the brief should have labelled it as one to be verified.** The agent
  verified anyway, which is the system working, but it should not have had to.
- **The brief's corrode table listed two variants. There are three** — it omitted
  `corrosiveMagic` (scissor), which fires in the corpus. I built that table from
  what the previous recap happened to mention rather than from the fixtures.
- **These are one failure, not two, and it is now the third time.** Session 61's
  brief already warned that its own oil-effects table "makes them look like
  findings — they are not." I wrote that sentence and then twice more put
  unverified claims into tables, which is the format that most strongly signals
  measured data. **A table in a brief should carry its provenance in the caption**
  — corpus-measured, user-stated, or assumed — or not be a table.

---

## Your task (session 64)

1. Check both ledgers and report which ledger day you are in. **No dungeon runs.**
2. **§1** — the corpus trigger-reachability analysis, offline, **before any cast**.
   Report it to the user before starting the batch.
3. **§2** — the batch: cast under the live `on-demand` policy until the first
   consuming cast, then stop. Cap six. All five halt conditions live.
4. **§2d–2e** — per-cast instrumentation on every cast; full capture on the
   consuming one.
5. **§3** — report the sim-vs-live consumption rate. Do not report a catch
   comparison.
6. **§4** — the `previousFishPosition` trap; put the `dungeonSim` corrode scenario
   to the user without deciding it.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the **final**
   commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 is the session's most valuable item and it is free.
There is a real possibility that the policy shipped in session 62 — chosen over
five alternatives, gated, tested, and pinned — **cannot fire in live play at all**,
and that one cast's board states are already consistent with it. If §1 comes back
saying both triggers were reachable in most of the 95 casts, the batch proceeds as
a straightforward capture and the worry is retired cheaply. If it comes back near
zero, **stop and report rather than spending casts to confirm it** — the corpus
will already have said it more clearly than six casts could.
