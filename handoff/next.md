# BRIEF — session 73

## The clock and the ledger

Written **2026-08-21, 18:20 PT**. *Source: session 72 live-read.* Fishing
**20/20 — the day's cap is spent.** Dungeon **0/12**. Rollover **11:00 PT
tomorrow**, ~16½h out.

**This brief authorizes the day's fishing allowance (§3) and ZERO dungeon runs.**
If the session runs before 11:00, there are no casts and §1 is the whole session.
`doctor.ts` first; read both ledgers and report them.

*Environment, sessions 66–72: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. `pConnect` is optimistic — find out why. This is the session's build.

**User decision, 2026-08-21.**

*Source: session 72, era-matched, n=118 turns.* `pConnect` predicts **50.0%** and
observes **39.8%** — a gap of **2.3 SE**, so not noise. It is **monotone across
all five buckets**, so the ordering is right and the level is wrong.

**That distinction is the whole shape of the problem and it should drive the
session.** A monotone-but-miscalibrated estimator is:

- **fine wherever it is used to RANK** — argmax over cards, argmax over
  placements. A uniform optimism cancels.
- **wrong wherever it is used as a LEVEL** — any threshold, any comparison
  against a constant, any expected-value figure quoted as a probability.

*Source: session 71/72.* `bestConnectProbability` is the **Focus oil gate's own
input**, and the exchange threshold compares it against a derived constant. So a
10pp optimism there means **the gate under-fires** — it believes it can connect
without the oil more often than it can. That is a level-based consumer, and it is
live.

### 1a. Enumerate the consumers and classify them — this is gate 2

Before diagnosing the cause, establish the blast radius. **Every call site that
reads `pConnect` (or anything derived from it) gets classified rank-based or
level-based**, and the level-based ones named individually.

This is the output most likely to still matter in ten sessions, and it is cheap.
**Ratchet it the way the repo already ratchets hardcoded paths** (currently 26,
and it caught `rodDeck.ts` as designed): a test that fails when a new consumer
appears that is not in the classified list.

### 1b. Decompose the bias by source, with a residual

Session 71's replay-gap decomposition is the model that worked — **toggle one
thing at a time and report what does not add up.**

Candidate sources, and this list is a starting set rather than a complete one:

- **The matcher** — its posterior over where the fish moves next.
- **The ring model / step classes** — the movement distribution the matcher
  consults.
- Their combination: a correctly-calibrated matcher over a biased movement model
  produces a biased product without either part looking wrong alone.

**Report an explicit residual.** *Session 71's own lesson:* a decomposition that
sums perfectly on the first attempt should be distrusted. And *session 72's*: the
brief's named candidates were worth ~nil and the real cause was one nobody had
listed — so **hold the list loosely.**

### 1c. Do not correct it in the same session you diagnose it

**Diagnose and report. Do not ship a correction.**

Three reasons, all specific rather than general caution:

- **A calibration fitted on 118 turns of one era is a claim about that era.**
  *Session 71:* an era is a bundle, not a knob.
- **Five buckets on 118 turns is enough to see a bias and not enough to fit a
  curve** without overfitting it.
- **Correcting a shared estimator changes every consumer at once**, including the
  rank-based ones where it was doing no harm. If a correction is warranted, the
  audit in §1a says where to apply it — possibly at the level-based call sites
  only, rather than at the source.

---

## 2. The forced Relaxing consume — one, and keep it OUT of the arms

**User decision, 2026-08-21: spend one forced consume to measure the Relaxing
payload.**

*Source: session 72.* `castSim`'s oil arm reads **50.1%** against live's
**78.6%** (n=14). The Focus payload **is** observed — *session 68: `focusMeter`
0 → 2 exactly.* The Relaxing payload **never has been**: every firing has been
lethal, so the record only ever shows `fishHp → 0`, which is consistent with +2
and with anything else ≥ the fish's remaining HP.

### 2a. How to spend it

- **One consume, on a fish with `fishHp` comfortably above 2** — high enough that
  the delta is unambiguous and not clipped by lethality. Early in a cast is best.
- **This is deliberately outside policy.** `on-demand` fires only at `fishHp ≤ 2`;
  this is the one case where the loop is told to ignore that.
- Capture the full `use_fishing_item` envelope, `fishHp` before and after, mana
  before and after, and confirm nothing else moved.
- **If the moment does not arise — the fish dies first, the cast ends early —
  report it and do not retry.** One cast, one attempt.

### 2b. THE HAZARD: it must not enter the oil arm

This is the part that is easy to get wrong and expensive to discover later.

Gate 1's whole verdict rests on the **oil arm at n=14**. A forced consume is
**not policy play** — it is instrumentation. If it lands in the oil arm it
contaminates the exact statistic it was spent to inform.

**Give it its own cast state**, the way `OIL-POLICY-DRY` was carved out in
session 65, and **exclude it from both arms** and from today's-era catch rate.
Flag it on the record, do not delete it — an excluded cast can be reconsidered.

*And note session 72's related finding:* stock is now **Relaxing 48 / Focus 11**,
so the `policy-dry` arm's composition has already shifted — casts that would once
have landed there now land in the oil arm. That is not an era break, but it is a
change in the split gate 1 rests on, and it should be stated wherever that gate
is quoted.

---

## 3. Casts — the daily allowance

**User decision, 2026-08-21: keep casting the allowance.** Today's era reads
**23/39 = 59.0%**, 95% [43.4%, 72.9%]; ~90 casts in this era reads it to ±10pp.

- **Batches of 5, hand back after each.** Twenty available after 11:00 PT; none
  before.
- Policy **unchanged** — `onDemandTriggers`, Relaxing capped at 2 per cast (*it
  has still never bound*), never force a consume **except the single §2 case,
  which is separately authorized and separately recorded**.
- Halt on: the batch count; the ledger short; the 15-cast zero-streak tripwire.
- **Report the running rate with its Wilson interval every batch**, and both oil
  arms' n alongside — gate 1's margin is **0.9pp** and one escaped no-oil cast
  flips it.
- Rule 13 after each batch: the ledger must move by exactly the casts sent.
- **If the rod, lures, zone map or matcher weighting change, the era breaks and
  the sample splits.** Say so at the moment it happens.

---

## 4. `schedule` — deferred, and record why

**User decision, 2026-08-21: after `pConnect`, not before.**

The reasoning is worth writing into `DECISIONS.md` rather than leaving as a
scheduling note: **`schedule` constrains focus movement, focus movement is chosen
on `pConnect`, and `pConnect` is known-biased.** Sweeping a focus policy scored by
a biased estimator measures the policy against the bias, not against the fishery.

`costCap` stays retired as a **finding** — today's opener spends 0.83 of 3, so it
has nothing to bind. `focusBudget.ts` stays in place, unwired: the meter still
empties in **34.3%** of casts, which is a cumulative drain `costCap` cannot bound
and `schedule` can.

---

## 5. Carried

- **Redraw is CLOSED as a dead end** — 263 mana per extra fish against a cast
  holding 10; +1.4pp at 1.4 SE. **Do not reopen expecting a better threshold.**
  Both degeneracies stay pinned, and the ALWAYS pin asserting the recorded
  disaster (100% `escaped_mana`, 1.00 turns/cast) stays as the guard it is.
- **+19.40pp stays SUSPENDED.** Do not quote it. §1 licenses nothing about the
  bare-default sim arm, which is still meter-out 1.0% / catch 69.7%.
- **The certainty gate is a proven live no-op**; shadow stays on the exchange
  threshold. Nothing oil-related ships.
- **The crit source is USER-STATED**, not confirmed; the control (443 lure-free
  plays, 0 crits, upper bound 0.86%) is the evidence. Crit damage rule OPEN at
  n=1.
- The `nextPosition` tripwire has still never met a real miss — **do not budget
  casts for it.** `preflight.ts` in CI still open since session 68.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability guard;
  §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture` settled OFF;
  do not fold stock into the oil threshold; leave-one-out and truncation are
  closed as replay-gap causes; distribution steps 3/4/6 are the user's.

---

## 6. Gate

Both halves are offline and deterministic; neither depends on the batch or on §2
landing.

1. **The `pConnect` bias is decomposed by source with an explicit residual**, each
   contribution measured by toggling that one thing. A named cause without a
   measured size does not meet this gate, and neither does a decomposition that
   sums perfectly without saying why it should.
2. **Every `pConnect` consumer is enumerated and classified rank-based or
   level-based**, with the level-based sites named, **and a test fails when a new
   unclassified consumer appears.** Demonstrate that test failing by adding one,
   then restore.

---

## 7. Do not

- **Do not run a dungeon run.**
- **Do not ship a `pConnect` correction** in the session that diagnoses it (§1c).
- **Do not let the forced consume enter either oil arm or the era catch rate**
  (§2b).
- **Do not force any consume other than the single §2 case.**
- **Do not sweep `schedule`** before `pConnect` is understood (§4).
- **Do not reopen redraw** (§5).
- Do not quote +19.40pp, or present a `castSim` result as evidence about live
  play — only the era-matched replay has passed a profile check, and only on
  today's era.
- Do not read a `GearInstance` suffix as an equip time.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me

- **I specified the era-matched replay as the instrument for the redraw
  calibration, and it structurally cannot score a redraw's consequence.** Its
  licence to refill rests on "one card per turn means the counterfactual empties
  the hand on the same turn as the record" — and a redraw is precisely the move
  that breaks that invariant. Half of §2b was unaskable of the tool I named.
- **This is the second time, and the repeat is the point.** Session 60's brief
  told the agent to check `tier_choice` on stdout when it only ever reached the
  JSONL. Same shape both times: **I named a mechanism without checking the
  mechanism's own invariants against what I was asking it to carry.** The
  session-60 version I wrote up as a one-off; it was not.
- **I relayed session 71's "the sim's catch rate is the open disagreement" to the
  user as established.** It was computed over today's era **pooled across oil
  arms**, and the user's question — *is the sim not factoring in the relaxing
  oil?* — is what caught it. That is twice now the user has caught a framing I
  passed through.
- **The sharper part: I had named the diagnostic one message earlier.** Session
  72's §8 said the through-line across my errors was accepting a frame and
  checking the arithmetic inside it, and that the question which would have caught
  all of them is *what exactly is this number computed over*. I wrote that, and
  then relayed the next recap's headline without asking it. **A lesson recorded in
  a brief is not a lesson applied**; the place to apply this one is the first time
  a number is quoted, not the retrospective afterwards.

---

## Your task (session 73)

1. `doctor.ts`, read both ledgers, report them.
2. **§1a / gate 2** — enumerate and classify every `pConnect` consumer; ratchet it.
3. **§1b / gate 1** — decompose the bias by source with an explicit residual.
   **Diagnose only; ship no correction** (§1c).
4. **§2** — one forced Relaxing consume at `fishHp` well above 2, captured in
   full, **excluded from both oil arms and the era rate** (§2b).
5. **§3** — the day's allowance in batches of 5, running rate and both arms' n
   reported each batch.
6. **§4** — record the `schedule` deferral and its reasoning in `DECISIONS.md`.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §1a is the item most likely to outlive this session and
the least likely to feel like progress while doing it — a classified consumer list
is bookkeeping right up until someone corrects the estimator, at which point it is
the difference between a targeted fix and a change that silently moves five call
sites. §1b may not resolve; *"the matcher accounts for 4pp, the movement model for
3pp, and 3pp is unexplained"* is a good session. **The outcome to be suspicious of
is a single clean cause**, because that is what session 72 expected of the redraw
gap and what session 71 expected of the replay gap, and both times the real answer
was structural and elsewhere.
