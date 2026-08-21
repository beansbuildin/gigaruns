# BRIEF — session 63

## The clock and the ledger

Written **2026-08-20, 17:20 PT**. Session 62 spent the day's remaining 6
run-units. **0 dungeon run-units remain; 15 fishing casts remain.** Caps roll at
**11:00 PT on 2026-08-21**.

**This brief authorizes ONE fishing cast and ZERO dungeon runs.**

If the session starts **after** the rollover, twelve run-units will be sitting
there. **They are still not authorized.** Rule 11 requires an explicit human
go-ahead for each run, and this brief does not carry one — ask, do not assume,
and do not treat a full ledger as permission.

```
npx tsx scripts/checkFishingCaps.ts      # expect 5 of 20 used (or 0 of 20 post-roll)
npx tsx scripts/checkDungeonToday.ts     # expect 12 of 12 used (or 0 of 12 post-roll)
```

**Rule 13 applies to the cast.** A denial, block, or interrupt is not evidence
that nothing ran; read the ledger before believing it. Session 62 exercised this
as routine verification twice and it cost nothing.

---

## 1. The first live oil cast — one cast, policy-gated, possibly uneventful

The `on-demand` policy has been live since session 62 and **has never consumed an
oil against the real server.** That is the entire remaining risk surface on a
policy that is already shipped and already gating live play.

**User decision, 2026-08-20: play the cast policy-gated. Do not force a consume.**
The user holds exactly one Mid Focus Oil and one Mid Relaxing Oil.

### 1a. Say this before the cast, so the outcome is not a surprise

**The cast may consume nothing, and that is a legitimate result.** `on-demand`
fires only at meter zero (Focus) or `fishHp <= 2` (Relaxing). The sweep spent
~0.70 oils per cast, so a single cast has roughly a coin-flip chance of firing no
trigger at all. If that happens: the oils are still held, the cast is still a
valid non-oil observation, and **the `slotIndex` questions below stay open**. Do
not retry, do not force a consume to rescue the session, and do not describe the
cast as failed.

### 1b. What to capture if a trigger does fire

- **`slotIndex` for items 937 and 942.** Confirmed only for item 821 so far. This
  is the concrete unknown.
- **`slotIndex` for a SECOND consume within one cast.** `on-demand` can want two
  in a cast; heuristic (c) never could, so this path has never run anywhere.
  Only observable if both triggers fire in the one cast — unlikely, and worth
  saying so rather than reporting its absence as a finding.
- The full `use_fishing_item` request and response envelope, both times.
- **Mana across every consume.** Session 62 established that `use_fishing_item`
  does not spend mana (user-stated, §8), and the loop already shouts if it ever
  moves. Record it; do not re-litigate it.
- Whether the fish's position or state advanced across the consume.
- Whether a turn was consumed.

### 1c. Classify the cast correctly

`oilCastState.ts` now distinguishes three states. Use them:

- **Oil cast** — a consume happened.
- **OIL-POLICY-DRY** — a trigger fired and no stock was held. Excluded from both
  arms. Should not occur this cast; stock exists.
- **Clean non-oil** — no trigger fired. This is the ~50% case.

The distinction between "holds none" and "balance read failed" is already
recorded separately and stays that way. **Report which state the cast landed in
as the first line of the fishing section**, before any outcome.

### 1d. What this cast is not

It is not a catch-rate measurement. n=1 reads nothing, the zero-streak tripwire
sits at **4 of 15** and will not move meaningfully, and **§19 stays at 7 of 32
instrumented turns** whatever happens. Do not report §19 as progressing.

---

## 2. Corrode — model it in the sim

**User decision, 2026-08-20: fold this into session 63.** There are no dungeon
runs to compete with it, so the offline room exists.

`onEnemyWinExchange_corrode` reduces the player's `shield.currentMax` when the
enemy wins an exchange with a matching move. Three variants are captured:

| buff | move | amount | minTier |
|---|---|---|---|
| `corrosiveSword` "Miasmablade" | sword | 3 | 2 |
| `corrosiveShield` "Miasmaguard" | paper | 3 | 2 |

**Why it earns a place in a sim that has otherwise stopped being fed.** Unlike
`rolledEnemyStats` — 1–5% proc chances needing hundreds of observations — corrode
is **deterministic arithmetic on a named move win.** It is the rare mechanic rule
8 made reachable that is also cheaply modellable, and at `minTier: 2` it is now on
essentially every run.

**Implement it reading the buff's own fields, never a constant:**

- Read `amount` from the buff. Do not hard-code 3.
- Read `moveType` from the buff and gate on it. A corrode that fires on any enemy
  win is wrong — session 62 recorded this as a dead end explicitly, and the
  negative control is already in `tests/enemies.test.ts`.
- Apply to `shield.currentMax`, within the room.

**This touches the combat core**, which is why both halves of the gate are on it.

---

## 3. Rule 8's measurement programme — formally closed

**User decision, 2026-08-20: the comparison is done and rule 8 continues to be
enforced without exception.** Session 62 already ran it, pre-registered at commit
`27c7f84` before either run, and the result is in
`handoff/reports/session-62-comparison.md`:

| | 4 runs pre-rule-8 | 4 runs under rule 8 |
|---|---|---|
| **Total HARD CORES** | **22,848** | **20,640** |
| Per run | 5,712.0 | 5,160.0 |
| Avg depth | 7.25 | 6.00 |

−2,208 HARD CORES (−9.7%), depth −17.2%, |t| 0.42 and 0.91. Entry conditions
identical across all eight (TIER_CID 3, 60 energy, all starting hp 30/30 armor
12/12). **Classification: INCONCLUSIVE.**

**Write the closure into `DECISIONS.md`, with all three parts and none of them
softened:**

1. The comparison ran, pre-registered, and returned INCONCLUSIVE.
2. **Both point estimates favoured the pre-rule-8 era.** Neither is near
   distinguishable, but the direction is recorded rather than dropped.
3. **The comparison is unfinishable, and this is the durable reason.** The control
   arm is frozen at n=4 by directive. That fixes a floor on the standard error of
   the difference at `sd/2 = 1127` HARD CORES, so **no number of additional rule-8
   runs can ever detect a difference smaller than ~55% of the historical mean.**
   The observed difference is 9.7%. Adding runs does not help; only unfreezing the
   control would, and that is forbidden.

**Then stop.** Future briefs do not ask for rule-8 outcome comparisons, and a
future agent that proposes one should be pointed at this entry. Rule 8 stands on
the account owner's directive, which is a sufficient reason on its own and does
not need a measurement to prop it up.

---

## 4. The `focusPoint: [0,0]` trap — cheap, and live

`geometry.ts`'s `allCells` is **one-indexed**, so `focusPoint: [0,0]` is off-grid.
It is harmless at a full meter and fatal at `focusMeter: 0`, where the reachable
set is empty and `bestFocusForCard` throws `"gridSize must be >= 1"`.

`tests/liveFishing.test.ts`'s older mock still uses `[0,0]` and gets away with it
only because nothing there drives the meter to zero. **The Focus Oil's entire
trigger is meter zero**, so the next person to test that state walks straight into
it.

Fix the mock, and add a meter-zero test on an on-grid focus point that would have
caught this.

---

## 5. Carried

- **Boon coverage: keep reporting it.** User decision, 2026-08-20. Sessions 60–62
  read orb 6, priority 2, with five first-ever pairs in session 62 alone. It stays
  instrumented and reported; it is not yet an argument for the orb rule and should
  not be written as one.
- **`LICENSE` is RESOLVED — `Copyright (c) 2026 Sabre`**, user-stated. No longer a
  distribution blocker. Do not change `git config user.name` to match it; commit
  author and copyright holder are separate facts.
- **Distribution steps 3–6 remain the user's.** An agent must not create or push
  the repo.
- Carried and deliberate: 25 analysis scripts hold hardcoded paths (ratcheted);
  `boonCapture` stays **OFF**; the recap checklist's `.gitignore` line is stale for
  the fourth session running — `config/discovered.json` is deliberately **not**
  ignored.

---

## 6. Gate

Both halves are offline, deterministic, and independent of whether the cast fires.

1. **A corrode test FAILS when the `moveType` gate is removed**, and a second
   FAILS when `amount` is hard-coded rather than read from the buff. Demonstrate
   both failing, then restore — the same discipline session 62 used on the
   exhaustion branch.
2. **A meter-zero fishing test passes on an on-grid focus point and demonstrably
   throws on `[0,0]`**, so the trap in §4 is guarded rather than merely tidied.

---

## 7. Do not

- **Do not run a dungeon run**, even post-rollover with 12 units available. Rule 11
  needs a per-run go-ahead and this brief does not carry one.
- **Do not force an oil consume**, and do not retry the cast if no trigger fires.
- Do not report a no-consume cast as a failure, or §19 as progressing.
- **Do not re-run the rule-8 comparison** or propose a new one (§3).
- Do not model corrode as a flat shred on any enemy win, or hard-code its amount.
- Do not run a lowest-tier entry for any reason. Rule 8, without exception.
- Do not remove the 15-cast zero-streak tripwire. Current streak **4**.
- Do not derive a replacement fishing target; 60% was dropped deliberately.
- Do not put identifiers in a test that guards against identifiers.
- Do not give a new I/O-owning test construction a real data path — session 62's
  `oilCastStatePath` went into `LiveFishingIsolatedPaths` in the same commit as the
  field and caught all 8 call sites at compile time. Keep that habit.

---

## 8. Corrections to me

- **I pre-specified a live measurement for a question the account owner could
  simply answer.** §3 of the last brief called the mana cost "the load-bearing
  assumption under the entire +19.40pp" and reserved a cast to settle it. The user
  answered it directly and the cast was cancelled. The lesson is not that the
  question was unimportant — it was — but that **"only a live cast settles it" was
  false, and I did not check the cheapest source first.** Ask the owner before
  budgeting a scarce resource to find out.
- **§23's predictor was the wrong shape and I wrote it twice.**
  `floor(elapsed / 3.33)` assumes the regen clock resets at run start; it does not.
  Worse, over a sub-tick window `floor()` **can only ever return 0**, which makes
  it unfalsifiable in exactly the regime every juiced run occupies — I wrote an
  unfalsifiable prediction and presented it as a checkable one. The correct form is
  `Bernoulli(elapsed / 3.33)`, and all three observations fit it.
- **The four result categories did not cover "both moved down," which is what
  happened.** The categories came from the user's directive, but I transcribed them
  into the brief without checking they spanned the cross-product, and a
  classification scheme with a missing box will either mislabel a result or force
  it. Session 62 recorded the gap instead of forcing it, which was right.

---

## Your task (session 63)

1. Check both ledgers. **No dungeon runs, whatever they read.**
2. **§1** — one policy-gated fishing cast. Report its `oilCastState` first. Capture
   `slotIndex` for 937/942 if a trigger fires; say plainly if none did.
3. **§2** — model corrode in the sim, reading `amount` and `moveType` from the buff.
4. **§3** — write the rule-8 closure into `DECISIONS.md`, all three parts.
5. **§4** — fix the `[0,0]` mock and add the meter-zero test.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the **final**
   commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** This is a small session and should be, because the day's
run-units are gone and the fishing stock is one set of oils. The corrode work is
the only substantial build in it. **The cast is the item most likely to produce
nothing, and the brief is written so that nothing is an acceptable outcome** — a
~50% chance of no trigger is the honest prior, and a session that spends its one
cast, reports "clean non-oil, no consume," and still holds both oils has done
exactly what was asked. The failure mode to avoid is an agent that treats a quiet
cast as a problem and forces a consume to have something to report.
