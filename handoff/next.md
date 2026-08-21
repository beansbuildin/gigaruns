# BRIEF — session 71

## The clock and the ledger

Written **2026-08-21, 16:40 PT**. *Source: session 70 live-read.* Game ledger
**16/20**, so four casts remain today; rollover **11:00 PT tomorrow**, ~18h out.

**This session is OFFLINE. Zero casts, zero dungeon runs.** Everything below is
analysis and refactoring. `doctor.ts` first, read both ledgers, report them, spend
nothing.

*Environment, sessions 66–70: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. Why does the same `chooseCard` spend 1.08 live and 0.73 in replay?

**User decision, 2026-08-21: this leads the session.** It is offline, it costs
no casts, and **it blocks every focus-policy decision** — including the user's
own directive about not burning the meter in the opening turns.

*Source: session 70, gate 1.*

| instrument | opening spend | meter-out |
|---|---|---|
| **corpus (recorded play)** | **1.40** [1.23, 1.56] | **64.2%** |
| live today | 1.08 [0.82, 1.34] | — |
| replay of today's policy (`--matcher=loo`) | **0.73** | — |
| `castSim` (live config) | 0.77 | 32.5% |

**The divergence is localized and that is what makes it tractable.** The replay's
fish is the *real recorded trajectory*, so this is not a fish-model problem. On
the same 123 traces the recorded policy spent 1.40 and today's replayed policy
spends 0.73. `castSim`, which shares no fish model with the replay, independently
lands at 0.77. **Two instruments that disagree about everything else agree with
each other and disagree with live.**

And *turns 3+ agree within 0.11* — **the entire divergence is the opening move**,
which is precisely what every candidate focus policy constrains. That is why the
sweep returned `costCap(2)` and `threshold(0.1…1)` at **+0/−0**: an inert arm
here means **not exercised**, not "no effect".

### 1a. This is a measurement task, not a hunt

`offPolicyReplay.ts` states its own conservatisms. **Measure each one's
contribution rather than arguing about which is likelier:**

- **Leave-one-out** (`--matcher=loo`, session 50's fix) weakens the models the
  policy consults. Run with LOO off and measure the delta.
- **Truncation at the recorded length** — a replay cannot run longer than the
  trace it replays. Measure what that removes.
- Anything else the harness does that the live loop does not. **The list above is
  from the recap; treat it as a starting set, not a complete one.**

**Report a decomposition with a residual.** If the named conservatisms account
for 0.20 of the 0.35 gap, say so and say the remaining 0.15 is unexplained.
**A decomposition that sums exactly to the gap on the first attempt should be
distrusted, not celebrated.**

### 1b. The datum that says the phenomenon is real

*Session 70:* the corrected-map era reads **1.07** and live reads **1.08** —
agreement to 0.01. **So the data contains the behaviour and both offline
instruments lose it.** This is the fixed point to test any hypothesis against: a
proposed cause that would also have suppressed the corrected-map era's 1.07 is
wrong.

---

## 2. `REAL_DECK` → the Shroom deck, and make the next rod change loud

**User decision, 2026-08-21: repoint and re-baseline.**

*Source: session 70, confirmed against play, not just the payload.* A rod grants
the starting deck — `/offchain/static`'s `gameItems.CARD_CID_array`, which
`/gear/items` does not carry. **922 Makeshift** `[1,2,3,4,5,6,7,76,77,79]` →
**811 Shroom** `[1,2,3,4,5,6,74,75,76,78]`, swapped at **2026-08-21T19:58:29Z**,
with every cast's `fullDeck` matching before and after.

Repoint `REAL_DECK` in `fishingEmpiricalAblation.ts`, `focusReserveAblation.ts`
and `focusProfileCheck.ts`.

**The repoint is only honest if the break is visible.** 110 of 123 clean traces
were played on Makeshift, so:

- **Mark the break where numbers live**, not just in a commit message. Any figure
  in `handoff/reports/`, `SPEC-fishing.md` or a script's header that was computed
  on the Makeshift deck gets dated and labelled as pre-repoint.
- **Do not silently restate a Makeshift-era number as current.** If a comparison
  spans the break, say it spans the break.

**And ratchet it, because the rod can change again.** The user chose repointing
over reading the deck per cast — so add the guard that makes that choice safe:
**a test that fails when `REAL_DECK` no longer matches the account's current
rod.** `critByGear.ts` already reads gear off each cast's own document, so the
lookup exists. A stale constant that nothing checks is how this one survived
unnoticed through 110 traces.

---

## 3. The crit source — user-stated, control-supported, API-unverifiable

**User-stated, 2026-08-21: the Steady Lure is the crit source.**

Record it as **user-stated**, and record alongside it exactly what the data does
and does not support:

- **The control is the real finding and it stands:** *443 lure-free plays, zero
  crits, 95% upper bound 0.86%* — below the stated 3%. That is the first positive
  evidence the crit source is gear at all.
- **The corpus cannot separate the two lures.** The single crit falls inside the
  Steady+Sticky overlap; the 27 Steady-only plays hold none. Consistent with the
  user's statement, not confirmation of it.
- **`/offchain/static` carries no effect field for 951 or 952**, so the 3% cannot
  be verified from the API at all.

**Do not write "CONFIRMED" against the crit source**, and do not drop the Sticky
Lure from the record. Rule 9's habit applies to user statements as much as to a
brief's — session 63 caught a user-stated inventory the live read contradicted,
and §8 below is this brief doing the same to itself.

The **crit damage rule stays OPEN at n=1** (`hit + 2`, flat 5, and "lethal, server
reports remaining HP" all fit exactly). Do not encode one.

---

## 4. Stop quoting +19.40pp until it is re-derived

*Source: session 70.* The sim's **bare default arm — the one the oil sweeps ran
on** — reads opening spend 0.64, **meter-out 1.0%**, catch **70.8%**. The real
fishery is **meter-out 64.2%, caught 27.6%**. The recap's own words: *that is not
this fishery.*

So `OIL-POLICY.md`'s **+19.40pp rests on an arm that does not reproduce live.**
That does not make `on-demand` wrong — it makes the number unsupported.

- **Do not quote +19.40pp** in a recap, a report, or a decision until it has been
  re-derived on an instrument that passes a profile check.
- **Do not re-run the oil sweep this session.** §1 must restore an instrument
  first; re-running on a broken one just produces a second unsupported number.
- The certainty gate stays a **proven live no-op** (0 of 9 Relaxing firings held);
  the exchange threshold would have held 2. The shadow stays on the exchange
  threshold.

**The through-line worth writing down.** Three sim-derived results have now been
checked against live and all three failed: the bimodality argument, the
`conserve(r=1,f=1)` recommendation, and the focus profile. **The pattern is not
bad luck with one model — it is that no sim-derived policy claim in this
programme has yet survived contact.** §1 is the attempt to restore one instrument
to the point where its claims mean something.

---

## 5. Carried

- **Redraw is wired, guarded and OFF.** `buildFishingEnvelope` throws on a
  `play_cards` with absent/empty `cards`; `buildRedrawEnvelope` is the only
  producer of `cards: []`. **`REDRAW_THRESHOLD` recalibration waits on §1** — it
  needs a working offline instrument, which is the thing §1 is trying to restore.
- **The missing cast is identified and unexplained:** docId **13024510** did not
  tick `dayDocs` though the server charged its energy. Double-count, resume,
  rejection, read lag, other pond and oil-ending are all ruled out from the logs.
  **Server-side, no client-visible cause.** The repo now defers to the game in
  both directions. Do not spend casts chasing it.
- **The `GearInstance` suffix is a MINT stamp, not an equip stamp** (§8). First
  appearance in a cast's own array is the observable.
- Session 49's `focusBudget.ts` header numbers are stale at 123 traces: meter-out
  80.8%→**64.2%**, turns at focus 0 50.4%→**43.9%**, opening spend 1.62→**1.40**.
  The meter-out premise survives; update the numbers when the file is next
  touched.
- The `nextPosition` tripwire has still never met a real miss — **do not budget
  casts for it.**
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability guard;
  §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture` settled OFF;
  do not fold stock into the oil threshold; distribution steps 3/4/6 are the
  user's.

---

## 6. Gate

Both halves are offline and deterministic.

1. **The 1.08-vs-0.73 gap is decomposed into named contributions with an
   explicit residual**, and each contribution is measured by toggling that one
   thing rather than argued for. **A session that identifies a cause without
   measuring its size does not meet this gate**, and neither does one that
   reports a decomposition summing perfectly without saying why it should.
2. **`REAL_DECK` is the Shroom deck in all three scripts, and a test fails when
   `REAL_DECK` diverges from the account's current rod.** Demonstrate that test
   failing against the Makeshift deck, then restore.

---

## 7. Do not

- **Do not cast, and do not run a dungeon run.**
- **Do not quote +19.40pp** or any oil-sweep figure until it is re-derived (§4).
- **Do not re-run the oil sweep** on the current instrument.
- **Do not enable redraw**, and do not recalibrate `REDRAW_THRESHOLD` yet.
- **Do not write "CONFIRMED" against the crit source** (§3), and do not drop the
  Sticky Lure from the record.
- **Do not restate a Makeshift-era number as current** after the repoint (§2).
- Do not read a `GearInstance` suffix as an equip time.
- Do not present a replay result as evidence about live play until §1 says how far
  the two diverge.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me

- **I read the `GearInstance` suffix as an equip timestamp. It is a mint stamp.**
  *Session 70:* `#951_1787254688` decodes to 2026-08-20 12:38 PT and first
  appears on a cast **21 hours later**; `#811`/`#952` decode to 10:21 PT and first
  appear **2h37m** later. First appearance in a cast's own array is the
  observable.
- **The compounding part is that I then built a question on it.** I told the user
  two items "went on at 10:21 PT", concluded session 69's crit denominator was
  therefore too wide, and asked them which of the two was the lure — a question
  whose premise was my own unverified decode. They answered it in good faith.
  The denominator did turn out to be too wide (the Steady Lure first appears at
  **09:47 PT**, and eight earlier casts that day carried no lure), so **the
  conclusion survived and the reasoning did not** — the third time in four
  sessions I have been right for a reason that was wrong.
- **The check was available and cheap.** A timestamp decoded out of an opaque id
  is a hypothesis about an encoding; the corpus records when each instance
  actually first appears, and comparing the two is one query. **Decoding an
  identifier is not reading a field.**
- **On §4's through-line, my share of it:** I have quoted +19.40pp as an
  established figure in four consecutive briefs, including as the anchor for the
  exchange-rate derivation. It was always a sim number and the sim's arm has now
  been shown not to be this fishery. The derivation may still be sound in form;
  its input is not currently supported.

---

## Your task (session 71)

1. `doctor.ts`, read both ledgers, report them. **Spend nothing.**
2. **§1 / gate 1** — decompose the 1.08-vs-0.73 gap by toggling each named
   conservatism, with an explicit residual. Test every hypothesis against §1b's
   fixed point.
3. **§2 / gate 2** — repoint `REAL_DECK` to the Shroom deck, mark the break where
   numbers live, and add the rod-divergence test.
4. **§3** — record the crit source as user-stated with the control alongside it.
   Not confirmed.
5. **§4** — put the +19.40pp suspension in `DECISIONS.md` so it is not quoted
   again by habit.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 may not resolve, and a session that ends with *"LOO
accounts for 0.15, truncation for 0.06, and 0.14 is unexplained"* has done its
job — that is three numbers the programme does not currently have. **The failure
mode to avoid is finding one plausible cause and stopping**, because the gap is
large enough to have several and the policy question behind it is the user's own
directive about the opening move. The thing that would make this session a waste
is not an unexplained residual; it is a confident single answer that the next
live batch quietly contradicts.
