# BRIEF — session 80 — the damage economy

## 0. Verification, and a correction to me first

Fresh clone at `ee2c45a`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Tests  1516 passed | 13 skipped (1529)   91 files
```

**Both gates hold.** The shuffle, its own salted rng stream, the sequential model
kept selectable so it can be watched failing, the byte-for-byte pins on the
random-sample path — all of it is right, and the chi-square-both-ways test is a
better ratchet than the one I asked for.

**And session 79 corrected me, on exactly the error I had warned it about.**

My §1d said the pile never exhausts, evidenced by `nextCardIndex` never exceeding
`fullDeck.length` across 721 states. Session 79 found **7 wraps in 131 casts** —
`nextCardIndex` 9→2 on a ten-card deck — because the server **wraps rather than
overflows**, so my predicate could not see the event it was testing for. Two
briefs earlier I wrote that a detector shaped to the wrong predicate reports
green and means nothing. I then shipped one. It is CLAUDE.md rule 10 and I am the
example.

---

## The clock and the ledger

Written **2026-08-22, 14:36 PT**. Session 79 spent **3 of 20 casts and 0 of 12
run-units**, so **17 casts and 12 run-units remain, expiring 11:00 PT tomorrow.**

`doctor.ts` first, both ledgers, report them. §1 needs neither.

*⚠ `preflight.ts` (~90s) before the push. `npx tsx` and `git` fail under the
command sandbox. Pre-session-77 SHAs are dead.*

---

## 1. Open question 1, answered: it is the damage economy, and session 48 wrote down that it would be

**Everything in this section is measured from committed fixtures.** No `data/`,
no `logs/`, no live play. 131 casts, 130 with a terminal doc, 543 card plays.

### 1a. The live loss decomposition

```
completed casts                                    130
  CAUGHT                                            38     29.2%
  ESCAPED, fish at full HP at the terminal doc      81     62.3%
  ESCAPED, otherwise                                11      8.5%
```

`fishHp` reaching `fishMaxHp` is terminal without exception: **81 casts reach it,
and in all 81 it is the last captured state. Zero casts continue past it.**
Terminal `fishHp == fishMaxHp` holds on 81 of 92 escapes and **0 of 38 catches**.

The bare simulator arm, run in this clone at n=4000:

```
                              LIVE          SIM (bare arm)
  caught                     29.2%              81.5%
  fish healed to full         62.3%              0.6%
  player/mana exhausted       10.0%             17.9%
```

**One discrepancy dominates everything: the dominant live loss mode fires 100×
less often in the simulator.** Catch rate is the symptom; this is the disease.

*Limit, stated plainly: I cannot run the live-config arm — `empiricalFish`,
`matcherPool` and `blindFallback` all come from `data/`. The sim column above is
the bare arm, which is the arm §0a is about.*

### 1b. Hit geometry is ELIMINATED — the rates already match

For every card play I took the sign of the `fishHp` delta:

```
543 live plays      fishHp DOWN (hit)   191   35.2%
                    fishHp UP  (miss)   352   64.8%
                    unchanged             0    0.0%
```

**Live per-shot hit rate 35.2%. The sim's shuffled baseline reads 36.42%**
(session 79's own deck-sweep figure). Within a point.

Open question 1 lists "the zone/hit geometry" as a candidate. **It is not the
cause.** The sim lands shots at the live rate and still catches three times as
often, which means the gap is not in how often you hit — it is in **what a hit
and a miss are worth.**

### 1c. The mechanism, as one number

From the same 543 plays, the actual amounts:

```
damage on a hit    mean 5.05   (mode 5, n=89 of 191; range 1–13)
heal on a miss     mean 3.00   (mode 3, n=269 of 352; range 1–6)

expected fishHp change per play
  = 0.352 × (−5.05) + 0.648 × (+3.00)
  = −1.78 + 1.94
  = +0.166
```

**The live fish gains HP in expectation.** Every cast is a race against a rising
floor: mean opening `fishHp` is 11.5 with **6.8 HP of headroom**, so at 3 per miss
a cast tolerates **~2.3 net misses** before the fish is full and gone. That is the
whole fishery in one line, and it is why 62% of casts end the way they do.

**This is the diagnostic I would build the session on.** It is a scalar, it is
computed identically on both sides, and it localises the gap in a way an outcome
rate cannot: if the sim's drift is negative where live's is +0.166, the fault is
in the damage economy — card selection, or the damage and heal arithmetic — and
**not** in hit frequency, which 1b has already ruled out.

### 1d. Session 48 already wrote the decision table, and this selects a branch

`scripts/lossDecomposition.ts`'s header:

> *meter-outs dominate, focus hits 0 early → the focus budget, still*
> *meter-outs dominate, **focus intact** → **the damage economy***
> *mana-outs dominate → cast length / redraw policy*

Meter-outs dominate at 62.3%. And **24 of those escapes ended with BOTH the focus
meter and the player's plays still in hand** — every one of them at
`fishHp == fishMaxHp`, most after only three plays. Focus intact.

**The middle branch. Written down in session 48, unselected for thirty-one
sessions because nobody had the number that picks it.**

### 1e. Two more measurements, both cheap and both wrong in the sim

**`fishMaxHp` is a distribution, not the constant 21.** Over 132 opening hands:

```
14:12  15:13  16:12  17:21  18:17  19:9  20:18  21:21  23:2  25:2  26:5
mean 18.3   eleven distinct values   sim uses a fixed 21
```

The opening ratio *is* right — live mean 0.629 against `REAL_PARAMS`' 13/21 =
0.619. It is the **variance that is missing entirely**, and catch is a threshold
outcome, so a fixed-HP sim understates the spread of results on both tails. This
is open question 1's third named candidate, now measured.

**`playerHp` is the wire name for what the sim calls mana.** It decrements by
exactly 1 on every card played — **543 of 543 plays, deltas only −1 and 0** — and
reaching 0 is terminal in all 13 casts that got there. The sim's
`mana -= card.manaCost` is consistent with every observation, **but only because
all 543 plays were manaCost-1 cards**; 3 Dendren cards cost 2 and 1 costs 0, and
none was ever played. Flat-1 and cost-equals-manaCost are indistinguishable on
this corpus. **Say so in the code rather than treating it as confirmed.**

### 1f. A naming hazard that has already cost the record once

**`escaped_meter` does not mean the focus meter ran out. It means the fish healed
to full** — `castSim.ts:789`, `if (fishHp >= fishMaxHp)`. The sim has no focus
terminal condition at all, and it is right not to: live, `focusMeter` hits 0 and
the cast **continues** (a cast in the corpus runs eight more plays after the meter
empties), and **53% of CAUGHT casts end with the meter at 0.** Focus exhaustion
is a state, not a loss.

The definitions are consistent — `focusProfileCheck.ts:158` and
`lossDecomposition.ts` both define corpus meter-out as *fish reached full HP*, so
§0a's comparison is apples-to-apples and its numbers stand. **The name is the
hazard, not the arithmetic.** Reading "the sim meter-outs on 0.6% of casts"
naturally suggests a focus problem, and the actual finding is a damage problem.
**Rename it `escapedFishFull` / `escaped_fish_full`**, mechanically, in one commit
with no behaviour change. Every future reader of §0a is otherwise pointed at the
wrong subsystem by the word itself.

---

## 2. What I would NOT do with this

- **Do not re-run the oil sweep.** §0a forbids it on this instrument by name,
  before or after, and narrowing a cause does not change that.
- **Do not tune damage or heal amounts to close the gap.** They are read from the
  card catalog, which is a real capture. If the sim's drift is wrong with correct
  per-card amounts, the fault is in **which cards get played** or in the
  hit/miss resolution's effect selection (`hitEffects[0]`, `critEffects[0]`,
  `missEffects[0]` — first-element-only, and no card with multiple effects has
  been checked). Find it; do not fit it.
- **Do not sample `fishMaxHp` and call §0a addressed.** Adding the distribution
  is right and it is not the 60-point mechanism.
- **Do not touch `chooseNewCard`, `DEFAULT_POTION_THRESHOLD`, `policyApproved`,
  or `redrawEnabled`.** The ship-nothing posture holds.

---

## 3. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6.

1. **The per-play `fishHp` drift is computed on both sides and reported
   together.** Live from the corpus, sim from the same instrument §0a's profile
   check uses. The live target is **+0.166 per play, from 543 plays, 35.2% hit
   rate, 5.05 mean damage, 3.00 mean heal** — reproduce those four numbers first
   as the check that the corpus side is right, then run the sim side. **A drift
   comparison whose live half does not reproduce §1c does not meet this gate.**
2. **`escaped_meter` is renamed to say what it is** (§1f), mechanically, with the
   suite green and no figure moved. Byte-for-byte pins on the affected sweeps are
   the proof that nothing but the name changed.

Not gated, do if there is room: sample `fishMaxHp` from the measured
distribution behind an opt-in flag, pinned so the default does not move (§1e);
record the flat-1 vs manaCost ambiguity in the code (§1e).

**What would make gate 1 unmeetable, stated per rule 6:** nothing. Both halves
run on committed fixtures and the shipped simulator. If the sim half needs
`data/` to be meaningful, say so at the top of the session and report the bare
arm's drift explicitly labelled as the bare arm.

---

## 4. The live budget — 17 casts, 12 run-units, and what they now buy

Every item needs its own go-ahead. Rule 11 terms unchanged; rule 13 after every
run; `--dry-run` first — the dungeon path has not executed since session 75.

**§1 raises what casts are worth and narrows what they are for.** Each cast now
contributes to a decomposition that has a named target: more plays tighten
§1c's 543, and the drift estimate is the thing the session is gated on. **A batch
of ordinary casts is the cheapest way to tighten the one number that matters**,
and it costs nothing beyond the casts themselves.

The forced Relaxing consume is now **seven sessions** carried. Its prize shrank
when the user answered the mechanic questions directly; what remains is
verification against a live response, which rule 1 says outranks a stated fact.
That is worth one cast, not a session.

**One juiced dungeon run** to seed session 78's `evSupported` telemetry with real
rule-8 co-occurrence data remains the only dungeon item worth arguing for, and it
is the input that turns CAPTURE-1's ordering from guessed into measured.

---

## 5. Do not

- **Do not read `escaped_meter` as a focus problem** (§1f).
- **Do not fit damage/heal amounts to the gap** (§2).
- **Do not claim hit geometry is the cause** — eliminated at 35.2% vs 36.4% (§1b).
- **Do not re-run the oil sweep on this instrument. Do not quote +19.40pp.**
- **Do not treat `mana -= card.manaCost` as confirmed** — the corpus cannot
  distinguish it from a flat 1 (§1e).
- **Do not start a dungeon run without `--dry-run`, `doctor.ts` and a per-run
  go-ahead**, and never chain runs.
- Standing, none re-opened: do not build H2's proc model; do not write M4's
  `observe`/`turn++` lines; do not raise `policyApproved`; do not revert rule 8;
  redraw CLOSED on price; `boonCapture` OFF; no 429 backoff without an observed
  429; do not shuffle the random-sample deck path; do not model reshuffle-at-wrap
  beyond what session 79 measured.

---

## 6. Corrections to me

- **§0's correction is the one that matters and I have made this exact mistake
  before, in writing, in the brief that warned against it.** My predicate
  (`nextCardIndex > fullDeck.length`) could not observe a wrap because the server
  wraps modularly. **A measurement is only as good as its predicate, and I did not
  test mine against a case where the event was known to have happened.** Session
  79 did, and found seven.
- **I framed §0a's gap as "one draw-order fix against a seventy-point chasm" and
  predicted the gap would barely move. It moved ten points and the prediction was
  right for the wrong reason** — I expected the deck model to be a small term, and
  it was, but I had no account of where the large term lived. §1 is that account,
  and it was available in `fixtures/` while I was writing the prediction.
- **Three briefs running I have told this project to look at its own corpus, and
  three briefs running the corpus has answered a question the brief had filed as
  needing new captures.** The shuffle, the wrap, and now the damage economy. That
  is a pattern about the corpus, not about any one session: **it is under-read,
  and the cheapest instrument available is a script over `fixtures/`.**
- **Rule 9 applies.** §1 is a measurement over committed fixtures; a live response
  that disagrees wins, and the correction goes in the recap.

---

## Your task (session 80)

1. `doctor.ts` first, both ledgers. **17 casts and 12 run-units, expiring 11:00
   PT.**
2. **§1 / gate 1** — reproduce §1c's live numbers, then compute the sim's drift
   on the same instrument and report both together.
3. **§1f / gate 2** — rename `escaped_meter`, mechanically, nothing else moved.
4. **§1e** — `fishMaxHp` sampling behind an opt-in flag; record the manaCost
   ambiguity.
5. **§4** — with a go-ahead: a batch of ordinary casts is the cheapest thing that
   tightens gate 1's live half. One juiced run for the `evSupported` telemetry.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` before the push**, no
   test writes a real data path, secret scan before handoff.

**Honest expectation.** §1b is the useful half and it is a negative result: the
sim lands shots at the live rate, so thirty sessions of focus-budget and
hit-geometry work were aimed at a subsystem that was already right. **The
satisfying version of this session is that the drift comparison localises the
remaining gap to a specific term in the damage economy** — most likely which card
the policy selects, since the per-card amounts come from a real capture. **The
unsatisfying version is that the sim's drift comes out near +0.166 too**, and then
the gap is not in the per-play economy at all but in something that ends casts
early, and the next place to look is the terminal conditions rather than the
arithmetic. Both are worth knowing and both are one script away.
