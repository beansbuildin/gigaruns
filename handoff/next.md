# BRIEF — session 52 (dungeon live: the energy claim, then one juiced run)

Session 51 did the thing this project keeps asking for and rarely gets: it
checked the brief against the corpus and the brief lost, three separate times,
and it said so in the recap instead of quietly implementing around it. The
per-class shrinkage gate and the matcher posterior both passed on paired
evidence at five prefixes and 88 traces respectively. §5 found a real defect by
dry-running a path nobody had exercised in eight sessions — which is exactly
what a dry run is for.

Session 52 is the dungeon session. **The user has deliberately drained the
energy pool to 3/420 so the ROM-claim path runs for real.** That makes the
claim, not the run, the first-order event of this session.

---

## 0. Corrections to me

Three of my session-51 claims were wrong and one of them was wrong in a way
that invalidated a whole table. Recording them at the top, per CLAUDE.md §6's
"say it at the top, not in the recap":

- **My §2 baseline was the wrong knob.** I read `DEFAULT_SHRINKAGE_K` (=1, in
  `contextualFallback.ts`) and called it the shipped ring-model value; the ring
  model uses `DEFAULT_RING_MODEL_OPTIONS.shrinkageK` (=3). Every number in my
  §2 table was measured against a baseline that was not shipped, including the
  headline "0.34 nats" — the real pooled gain is 0.047. The *direction* (k=1
  wants less smoothing, k=2 wants much more) survived; the size did not.
- **My §2 "k=2 top-1 rises to 42.9% at K=16" is refuted.** Top-1 is flat at
  34.0% through K≤8 and falls to 31.3% at 16. I reported a rise where the data
  shows a fall.
- **My §0 "dispersion ratio 0.80, no heterogeneity" does not replicate.** At 88
  casts it is 1.452 (χ²=33.39, df=23, p=0.075). I killed an idea on a number
  that was wrong in the direction that killed it. §5 below is the repair.
- **My §3 "a mixture cannot lose to either arm" is false as stated.** The
  posterior loses to the matcher-OFF arm by +0.030 nats [+0.015, +0.044], CI
  excluding zero. A mixture cannot lose to either arm *in expectation under a
  correctly specified prior*; the prior here is an empirical support rate on 88
  casts and the matcher's own likelihood is misspecified, so it can and does.
  The shipped decision was still right — it beat what was there by −0.632 —
  but the justification I gave for skipping more evidence was not sound.

**What is different about this brief.** I read `src/orchestrator/energyPreflight.ts`,
`scripts/liveRun.ts` and `config/bot.json` directly this session rather than
working from the recap. Everything in §1–§3 is code-verified and cites a line
of reasoning you can check. Everything about the **corpus** (fixture counts,
replay numbers) is still second-hand from session 51's recap and is marked as
such. That distinction is also my answer to your open question 3 — see §6.

---

## 1. The energy claim — this session's real gate

**State, as reported by the user:** pool at **3/420**, drained on purpose by
crafting juices, so that a 60-energy juiced entry forces the preflight into its
claim branch with maximum headroom under the cap.

Session 51's read-only dry run saw **37 ROMs, 27 collectable, 2480 claimable**
and computed the deficit arithmetic correctly. Nothing has ever been claimed by
this code path against the live API. That changes here.

**Verify the pool first, do not trust this brief for it.** CLAUDE.md §9: the
preflight's own `getEnergy()` read is ground truth and "3/420" is my hypothesis
about your account. If it reads anything else, the read wins, and the deficit
arithmetic follows the read. Expected: required 60 (20 × `JUICED_COST_MULTIPLIER`
3 × 1 run), pool 3, **deficit 57**.

### 1a. One change to make before claiming: claim order

`ensureEnergyFor` sorts `claimable` **descending** and claims biggest-first,
stopping once snapshots cover the deficit (`energyPreflight.ts:147,180-181`).
Its stated rationale — "an interrupted pass still made the most progress it
could" — is right for the steady state and wrong for a first live exercise. A
57-energy deficit against a 2480 bank means descending order claims **one ROM,
the account's largest single accrual**, and that is the worst asset to point an
unexercised code path at.

The user's directive for this session is claim-to-deficit-plus-margin, keeping
the large accruals banked. Implement it as an explicit option:

```ts
ensureEnergyFor(required, deps, { order?: "ascending" | "descending" })
```

- Default `"descending"` — **omitting it must be byte-for-byte the shipped
  behaviour**, same discipline as session 51's `shrinkageKByClass`.
- `scripts/liveRun.ts`'s dungeon preflight passes `"ascending"` this session.
- Bound the loop: `maxClaims` = 15. If ascending exhausts 15 claims still short
  of the deficit, claim the single **largest remaining** ROM to close it in one
  step, log that it fell back and why, then continue to the verify step. This
  is not a fail-closed case — it is the behaviour descending would have had
  anyway, reached deliberately and logged.

Four reasons this ordering is better *here specifically*, and they stop
applying once the path is proven, so do not make ascending the default:

1. It matches the user's explicit instruction for this session.
2. A failure costs the smallest ROM in the bank, not the largest.
3. It exercises the claim **loop** — pacing, running total, the break
   condition, the `success: false` check in `clientEnergyPreflightDeps` — some
   8–15 times instead of once. A single big claim leaves most of the loop
   untested and reports "claim path verified."
4. It does not conflate two untested things. Which brings us to:

### 1b. The overflow claim is untested at this magnitude — and this is the session that can test it

`energyPreflight.ts:109-111` asserts, citing sessions 21/22, that overflow past
the 420 cap is non-wasting because the remainder stays banked in the ROM, and
concludes there is "no reason to under-claim." That was established on **two
verification claims of ~12 energy each** into a pool with plenty of room
(QUESTIONS.md §11 update 2). It has never been tested by a claim large enough
to actually hit the cap.

Do not test it accidentally by claiming a 400-energy ROM into a pool at 3. Test
it deliberately, or not at all this session. If, after the ascending pass and
the run, you want the evidence: pick **one** ROM whose snapshot exceeds the
remaining headroom, record headroom and snapshot, claim it, and record pool
delta and that ROM's post-claim `energyCollectable`. Non-wasting predicts
`delta == headroom` and `post == snapshot − headroom`. Anything else means the
comment is wrong and §11's batching question re-opens for 2480 energy. **Ask
before doing this** — it is discretionary, it is the one thing here that can
destroy value, and it is not needed for the run.

### 1c. What to record

The claim path's whole value is that it is now measurable. Log and report:

- `poolBefore`, `bankTotal`, `claimable.length`, computed `deficit`.
- Per claim: docId, snapshot `energyCollectable`, running total.
- `poolAfter`, **measured delta**, and `claimedSnapshotTotal`.
- **Measured delta vs snapshot total, per ROM where you can attribute it.**
  Session 20 saw romId 689 credit +12 against a snapshot of 11 — accrual
  between read and claim. Small positive drift is expected and confirms the
  snapshot is live; a *negative* gap, or a claim crediting zero, is the failure
  mode this whole exercise exists to catch, and it is invisible if you only
  report the total.

If the measured delta leaves the pool short of 60, `ensureEnergyFor` already
throws `EnergyPreflightError`. Let it. Report and stop; do not retry.

---

## 2. The 3× heal juice will not load. Fix `config/bot.json` first.

This is the thing most likely to silently not happen, and it would not show up
until the run was already started and unhealable.

`config/bot.json`'s `forbiddenWoods` block has **no `potions` key** — only a
`_potionsComment` recording that session 43 added it and removed it again after
use. `liveRun.ts:1370-1379` is explicit that this is load-bearing silence:
absent that block, the loop loads **0 potions regardless of balance**, logs
"NOT configured … This is the safe default, not a bug", and proceeds. And
`--potions=3` on its own is a hard error without the config key
(`liveRun.ts:1396-1398`). So "3× big heal juice" as instructed produces zero
heal juice unless the config is changed.

**Do:**

1. Re-add to `forbiddenWoods`:
   `"potions": { "allowedItemId": 131, "maxPerRun": 3 }`
2. Confirm the itemId-131 balance is ≥3 before starting. `liveRun.ts:1388-1389`
   takes `min(maxPerRun, MAX_POTIONS_PER_RUN, balance)` — a short balance
   silently loads fewer, and the log line reports it. Read that line and
   report the actual loaded count, not the intended one.
3. **Remove the block again after the runs**, per the session 24/42/43
   convention the comment documents. Update `_potionsComment` with what
   session 52 did.

Note the interaction that makes this safe: potions only load when `--juiced` is
also passed (`liveRun.ts:1380-1385`) — a plain run with the config present
still loads zero. That gate is correct; do not touch it.

---

## 3. The run

**Invocation** (after §1 and §2 are done):

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1
```

- `--runs=1` is not optional. The user pauses between runs to allocate skills
  and will say when to resume. `targetRuns` also scales the preflight's
  required energy (`liveRun.ts:1442`), so a wrong value over-claims.
- `--juiced-index=3` must be passed explicitly; the loop refuses to guess and
  is right to (`liveRun.ts:1151-1158`). Index 3 is the one confirmed live value
  and "index == tier" is still unconfirmed in general.
- Do **not** pass `--no-rom-claim` — that skips the preflight entirely
  (`liveRun.ts:1447-1449`) and this session is about the preflight.

**Three rules, restated because this is the session where they get tested:**

1. **Tier 3 is the ENTRY tier only.** Inside the run, CLAUDE.md §8 governs:
   `pickLowestTier()` picks the lowest `enemyPathOptions` tier offered in every
   room. Identical loot table across tiers, unscorable mechanics on the higher
   ones, no tradeoff to weigh. If any in-run tier decision routes anywhere
   other than `pickLowestTier()`, stop.
2. **Never allocate skill points.** The pause exists so the user does it. Not a
   preference — CLAUDE.md's ask-first list, irreversible without Hourglasses.
3. **Pause after the completed run and hand back.** Do not chain. Wait for the
   user's word before any second run, and re-run the preflight for it (the pool
   will have moved).

**Expect the first surprise here.** Tier enumeration and the first in-run
decision point are the two things session 51's dry run could not reach by
construction, and they carry nine sessions of drift. A guard trip, an
unclassified non-2xx or an unknown enum is **information**, not a setback:
capture the full body via `serverErrorDetail` (session 51 fixed it to actually
carry the server's words), stop, report. Do not retry into it.

**Per-run report:** rooms reached; tier offered vs tier taken in each room;
heal-juice loaded, consumed, and at what HP; loot; energy committed vs the
measured pool delta; and any captured server message. Plus the §1c claim
numbers.

---

## 4. §20 — re-mine `data/mined-patterns.json`, and do it this session

Your call and mine agree: re-mine, gate on the replay, ship. The reasoning for
doing it *now*, in a dungeon session:

There are **no fishing casts this session** (§6 of your open questions, and the
scope decision below), so a change to live matcher behaviour lands with zero
live exposure and a full session of replay evidence before it ever runs. If it
were deferred to 53 it would land in the same session as the batch meant to
measure it, and the §19 evidence would be collected against a library that was
changing underneath it.

- Run `scripts/mineFishPatterns.ts`; expect 2 → 4 patterns (adds `bounce(2,0)`,
  `bounce(-2,0)`), support 8/88 → 11/88, prior 0.100 → ~0.144 computed from
  `supportingCastCount` with no code change.
- **Gate it on the replay before shipping**, paired against the current
  2-pattern library on the same 88 traces: ΔlogLoss with a cluster bootstrap CI
  over casts, and caught/88. A bigger library is a different tier, not a
  strictly better one — more patterns means more chances for a wrong match.
- If the 4-pattern library is *worse* on paired ΔLL with a CI excluding zero,
  do not ship it; report the number and leave the 2-pattern file in place. That
  is a real finding about §19, not a failure.
- Whatever ships, record the mined support counts in the recap so session 53's
  batch is interpreted against a known library.

---

## 5. Answers to your open questions

**Q1 (§19) — drop the matcher or keep the mixture?** *Not this session, and not
by argument.* You already wrote the right answer into §19: it needs a batch, not
a decision. Keep the mixture. Session 53 runs one fishing batch on the re-mined
library and reads `matcherWeight` on the `ringPrediction.jsonl` rows. Decision
rule, fixed now so it is not chosen after seeing the data: if π never exceeds
0.5 on any cast in the batch, the tier is buying nothing live and gets dropped;
if π exceeds 0.5 on at least one cast and that cast's turns hit above the
batch's own base rate, it keeps its 0.030 nats. The focus-spend entanglement
(0.71 replayed vs 1.80 live with the matcher off) is the reason the replay
cannot answer this and the reason "it's only 0.030 nats" is not a safe drop.

**Q2 (§20) — re-mine first?** Yes. §4.

**Q3 — three consecutive briefs with a wrong corpus claim. What changes?**
The mechanism is not carelessness, it is that the brief author works from
recaps and the recap is a summary — session 51's shrinkage error is the clean
example: I read a plausible constant name in a summary and never saw that two
constants shared the concept. Two changes, both cheap:

1. **Provenance markers on every number a brief asserts.** A numeric claim
   carries either `[measured: session N, n=X]` — traceable to a specific
   measured table in a specific recap — or `[UNVERIFIED]`. Anything I derived,
   inferred, or remembered is UNVERIFIED by definition. §0 of this brief is
   what it looks like when that discipline is applied retroactively.
2. **A gate may not be set against an UNVERIFIED number.** This is CLAUDE.md §6
   ("a gate must be set on something the agent controls") extended one step:
   a gate against a number the brief cannot source is unmeetable in the same
   way, and for the same reason — no amount of working harder fixes it. Session
   51's §2 table was exactly this, and the gate survived only because the
   session re-derived the baseline instead of trusting it.

There is also a structural fix available and this brief is the pilot: when the
author can **read the repo**, code-level claims stop being hypotheses. §1 and §2
above are cited to line numbers, and §2 found a live gap (zero heal juice) that
no recap would have surfaced, because the absence of a config key is not the
kind of thing a recap records. Corpus and fixture numbers remain second-hand —
I did not run anything — so those stay marked. If this works, the convention is:
briefs cite code, hypothesise about data.

**Q4 — how many more casts before the reversal question is worth re-asking?**
Concretely: **32 scored k=2 casts**, up from 24. If the dispersion ratio holds
at 1.452, the χ² dispersion test crosses α=0.05 at df=31 (statistic 45.01 vs
critical 44.99) and not before — n=28 gives p≈0.061, n=30 gives p≈0.055. At the
current qualification rate (24 scored out of 88 clean, ~27%), 8 more scored
casts is roughly **29 more clean casts, so re-ask at ~117 clean**.

The more useful half of the answer: **if the true ratio is smaller than 1.452,
this is not worth waiting for.** At a ratio of 1.30 the same test needs 69
scored casts — around 250 clean — which this corpus will not reach in any
plausible number of sessions. So set the stopping rule now: re-run
`reversalDispersion.ts` at ~117 clean casts; if it has not crossed by then, the
per-cast reversal effect is too small to parameterise and the question closes
for good rather than being re-asked every twenty casts.

On the scored set (both hops 2-steps, ≥2 pairs per cast): it is the right set
and I would not change it — it is the set where "reverses or not" is
well-defined. But report the **qualification rate** alongside the result each
time. If 27% drifts, the n you need drifts with it, and the stopping rule above
needs re-deriving rather than re-using.

**Q5 — nine sessions of drift, tier enumeration unexercised.** Acknowledged and
priced into §3. The dry run cleared everything reachable without spending; what
remains cannot be reached without a real entry, so it gets reached with 3 heal
juices, one run, and a fail-closed posture. That is the correct trade — and it
is why §1's claim path and §2's potion config get fixed *before* the entry, not
discovered during it.

---

## Your task (session 52)

1. **§1a** — `order` option on `ensureEnergyFor`, default descending and
   byte-for-byte unchanged when omitted; `maxClaims` 15 with the
   largest-remaining fallback; tests for both orders and the fallback.
2. **§2** — re-add `forbiddenWoods.potions` (131, max 3), verify the balance,
   remove it and update `_potionsComment` after the runs.
3. **§1** — run the preflight for real, ascending. Report §1c in full. If it
   throws, that is the session's finding; stop and report.
4. **§3** — one juiced Tier-3 run, `--runs=1`, `pickLowestTier()` in-run, no
   skill allocation, pause and hand back. Report per the §3 list.
5. **§4** — re-mine, gate on the replay, ship only if the paired ΔLL supports
   it; record the support counts either way.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit, and confirm no test wrote to a real data path.

**Honest expectation.** §1 and §2 are the session. The run is what they are for,
and one 60-energy run at a 3-heal loadout is a single sample of a stochastic
dungeon — it will not settle any strategy question and should not be reported as
though it might. What it *can* settle is whether nine sessions of untested
changes survive contact with the live API, and that is worth the entry on its
own. If the claim path works and the run dies in room 4, this session
succeeded. Say so if that is how it lands.
