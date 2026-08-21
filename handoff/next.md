# BRIEF — session 66

## The clock and the ledger

Written **2026-08-21, 10:25 PT**, ~35 minutes before the 11:00 rollover. Session
65 ended with **0 casts and 0 run-units**, on the 2026-08-20 ledger day.

**This session is OFFLINE. User decision, 2026-08-21: no fishing, no dungeon
runs.** Twenty casts and twelve run-units appear at 11:00 and **none of them are
authorized.** A full ledger is not permission and rule 11 needs a per-run
go-ahead regardless.

Read both ledgers once, report which day you are in, and spend nothing.

```
npx tsx scripts/checkFishingCaps.ts
npx tsx scripts/checkDungeonToday.ts
```

---

## 1. The `nextPosition` override — keep it armed, give it a tripwire that can fire

*Source: session 65 live-measured.* The override armed for the first time this
session: **12 validation entries, 12 hits, across 9 casts.** It fires on ~1–2% of
turns and forces focus onto the predicted cell. It is now **a live input to card
choice, not a dormant safeguard**, and it became one without a decision being
taken.

**User decision, 2026-08-21: keep it armed, and add a first-miss tripwire.**

### 1a. Why the existing gate cannot protect anything

A Wilson lower bound computed from an unbroken streak **only ever climbs.** At
12/12 it sits around 0.76; at 20/20 it would be 0.84; at 50/50, 0.93. There is no
value the streak can reach that lowers it, so the gate can never fire while the
override is behaving, and the moment it stops behaving is the moment nobody is
watching a number that has spent 12 observations going up.

**That is the whole problem: the safeguard is monotone in the wrong direction.**
The fix is not a better threshold, it is an event that can actually occur.

### 1b. What the tripwire must do

- **Fire on the first validated miss** — a prediction was present, was acted on,
  and was wrong. Not on an absent prediction, not on a turn the override skipped.
  **Those three cases must be distinguished in code and in the record**, because
  conflating "no prediction" with "prediction correct" is how 12/12 becomes 12/12
  forever.
- **Disarm the override on that miss** and continue the cast without it. The
  override is an optimisation; losing it costs a fraction of a percent of turns.
- **Stay disarmed until a human re-arms it.** This is the part that matters. If
  it re-arms itself next session, the tripwire records a blip and nothing
  changes — and a safeguard that resets is a log line, not a guard.
- **Surface it loudly in the recap**, with the turn, the predicted cell, the
  actual cell, and the cast id.

### 1c. Two implementation traps this repo has already paid for

- **The disarm has to persist somewhere, which means a new I/O-owning path.** Put
  it in `LiveFishingIsolatedPaths` **in the same commit as the field**. Session
  62 did exactly this for `oilCastStatePath` and it failed all 8 call sites at
  compile time — that is the pattern working. The bug class has shipped four
  times when it was not followed.
- **Something must actually hand the loop its dependency.** Session 64's headline
  was a config block that existed, was approved, was tested at the inner hop, and
  was never populated by `main()` — so the feature was inert for three sessions
  while looking shipped. **Test that something POPULATES the armed/disarmed
  state, not merely that the loop reads it correctly.** A test of the inner hop
  alone would pass on a permanently-disarmed override and on a permanently-armed
  one equally.

---

## 2. Relaxing Oil — the user is crafting more; make the dry counts mean something

**User decision, 2026-08-21: more Relaxing Oil is being crafted, and dry-trigger
counts stay in the recaps.** Stock is currently **Relaxing 0, Focus 18**
(*source: session 65 live balance read*).

A count of dry triggers is not by itself actionable. **Turn it into a cost
estimate, offline, from the 109-cast corpus:**

- Of casts where the Relaxing trigger was reachable, how many **escaped**?
- What is the lethal-trigger reachability rate, and what would spending an oil on
  each have been worth under the sweep's own model?

*Source note for whatever you produce: the sweep's `lethal-relaxing-only` arm is
**+4.47pp for 1821 oils across 8000 casts** — sim-derived, not live-measured.*
Say plainly that this yields an **expected** cost of holding zero stock, not an
observed one, and that n=1 live Relaxing consume cannot calibrate it.

This is the whole point of keeping the counts: they should tell the user how much
crafting time is worth spending, not just that something was missed.

---

## 3. Correct the "structural gap" claim before it hardens into a fact

*Source: session 65 recap, "Reachability, corpus-wide".* The recap states:

> The lax-vs-strict Focus gap is **STILL exactly 14** across three independent
> batches — **structural, not sampling noise.**

**Check that claim, because the arithmetic does not support it.** The gap was 14
at corpus n=102 and 14 at n=109 — **one increment of 7 casts.** At the observed
gap rate of 14/102 = 13.7%, those 7 casts were expected to add **~0.96** members,
and adding **zero** has probability **~0.36**.

**A one-in-three outcome is not evidence of structure.** It is the single most
ordinary thing that could have happened.

The claim may still be true — a fixed, identifiable set of casts would be a real
finding about the meter's dynamics. So **settle it rather than restating it**:

- Are the 14 the *same* 14 casts at both corpus sizes, by cast id?
- If they are, what property do they share? That is the finding.
- If they are not, the gap holding at 14 is a coincidence of two sets of
  different membership having equal size, and it should be reported as such.

**Then correct the recap's language either way.** This is CLAUDE.md rule 10's
neighbour: a number that has not moved across two readings is not thereby a
constant, and "structural, not sampling noise" is a strong claim that needs the
membership check, not the count.

---

## 4. §19 is CLOSED — carry it forward as closed, not as a budget line

*Source: session 65 live-measured.* **POWERED, verdict KEEP, n=35 of 32.** Two
casts crossed `PI_DECISION_THRESHOLD`, both above the 28.5% base rate: 13019015
(π 0.727) and 13019677 (π 0.502).

**Stop budgeting casts for it. Stop reporting turn accrual.** It ran for roughly
fourteen sessions, was renegotiated once by explicit user decision at n=7, and
that renegotiation was vindicated — the crossing at 0.727 was not visible at n=7
and dropping the matcher tier then would have removed something real.

If a future brief asks for §19 turns, this entry is the answer.

---

## 5. Carried

- **The second-consume path is fixed and confirmed once** — slots 0→1→2 on cast
  13019682. *Slot 2 has exactly one observation.* With Focus stock at 18 and the
  Focus trigger reachable in 55% of casts, it should accumulate incidentally.
  **No dedicated budget; say so explicitly rather than leaving it implied.**
- **A rejected `use_fishing_item` advances the server's action token** and there
  is no resync — `GET /fishing/state` carries no `actionToken`. The loop now
  fails closed at the rejected consume. Not destructive: the cast persists
  server-side and the next invocation resumes it with no `start_run`, no energy,
  no ledger entry.
- **Boon coverage is unchanged at orb 6 / priority 2.** Zero dungeon runs since
  session 62. **Third brief saying not to re-report it as if it moved.**
- Corrode in `dungeonSim` is a **CLOSED decision** (leave inert, DECISIONS
  2026-08-21), not an open question. A perpetual corrode would be under-modelled;
  corpus-justified, safe failure direction.
- Rule 8's measurement programme is **CLOSED**. Do not re-run or propose one.
- Carried and deliberate: 25 analysis scripts hold hardcoded paths (ratcheted);
  `boonCapture` stays **OFF**; distribution steps 3–6 remain the user's;
  `LICENSE` resolved as `Copyright (c) 2026 Sabre`.
- **The recap checklist's `.gitignore` line was FIXED in session 65** after seven
  sessions of being flagged. Do not re-flag it.

---

## 6. Gate

Both halves are offline and deterministic, which suits an offline session.

1. **The first-miss tripwire fires on a synthetic miss**, disarms the override,
   and the disarm persists across a simulated restart. **Demonstrate the test
   failing with the tripwire removed**, and demonstrate that a test of the read
   path alone would pass on a permanently-disarmed override — i.e. show the
   populate-side assertion is doing work (§1c).
2. **The §3 membership check is answered by cast id**, and the recap's
   "structural, not sampling noise" wording is corrected to match whichever
   answer the ids give.

---

## 7. Do not

- **Do not fish and do not run a dungeon run**, including after the 11:00
  rollover. Offline session by user decision.
- Do not let the override re-arm itself after a miss (§1b).
- Do not conflate "no prediction" with "prediction correct" (§1b).
- Do not report the expected cost of zero Relaxing stock as an observed one (§2).
- Do not restate the 14-cast gap as structural without the membership check (§3).
- Do not budget casts for §19 (§4) or for the second-consume path (§5).
- Do not re-report boon coverage as if it moved.
- Do not re-open the corrode-in-`dungeonSim` or rule-8 decisions.
- Do not read an `UNKNOWN FIELD` banner as a server change — `data.nextPosition`
  has fired on ~1–2% of responses since session 30.
- Do not assume a mock that omits a field is merely simpler; it is a different
  server. Two mocks omitting `fishingConsumableSlotUsed` turned every "it
  consumes" assertion vacuous.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me

- **I said the +19.40pp headline "was computed across both arms." It was not.**
  `OIL-POLICY.md`'s table is labelled `costsTurn=false, amount=2, n=8000`, and
  `main()` has always judged robustness on those rows alone, printing "ARTIFACT
  BRANCH" over the others. Rule 9, fifth occurrence — and the sweep re-run
  reproduced the published table exactly, so §3 of the last brief corrected no
  number. It was not wasted (the turn cost is now pinned so the sweep cannot
  drift back to sweeping a resolved parameter), but the premise was wrong.
- **The precise failure is worse than "I did not check," and worth naming
  exactly.** I had read `OIL-POLICY.md` in full, including that label, before
  writing the claim. I then asserted from a remembered gist rather than from the
  record I had already seen. **A provenance tag written from memory is not a
  provenance tag** — the format rule I introduced last session does not help if
  the tag is filled in by recall. When a brief cites what a document says, the
  document gets re-opened at the moment of writing.
- **The seven-cast batch was priced at ~51% for the Relaxing trigger and it hit
  on cast one.** That is the estimate working, not a correction — recorded so the
  next projection is neither inflated nor discounted by this one lucky draw.

---

## Your task (session 66)

1. Read both ledgers, report the day, **spend nothing**.
2. **§1 / gate 1** — the first-miss tripwire: distinguish the three prediction
   cases, disarm on a validated miss, persist the disarm until a human re-arms,
   isolated path in the same commit, and a populate-side test.
3. **§2** — turn the Relaxing dry counts into an expected-cost estimate from the
   109-cast corpus, labelled as expected rather than observed.
4. **§3 / gate 2** — the membership check on the 14-cast gap, and correct the
   recap's wording to match the answer.
5. **§4** — record §19 as closed so it stops being carried as a budget line.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the **final**
   commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** An offline session with one real build in it. The tripwire
is small but it is the first safeguard in this repo designed around the question
*can this ever fire?* rather than *is the threshold right?* — and sessions 64 and
65 were both bugs in things that looked shipped and had never executed the path
that would break them. **§3 is the item most likely to be skipped**, because
correcting a claim in a recap feels like bookkeeping next to writing code. It is
not: "structural, not sampling noise" is exactly the kind of sentence that gets
quoted forward as established, and the membership check that would settle it costs
minutes and needs no server.
