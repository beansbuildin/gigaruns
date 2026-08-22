# BRIEF — session 81 — the matcher, costed

## 0. Verification, and my error first

Fresh clone at `4ba97c8`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Tests  1548 passed | 13 skipped (1561)   94 files
```

**Both gates hold.** The shared scorer, the rename proven inert by running three
reports either side of it, the `fishMaxHp` sampler on its own salted stream with
the default pinned byte-for-byte, the arg guard — all correct.

**And session 80 caught a real methodological error of mine.** My §1b eliminated
hit geometry by putting live's 35.2% next to "the sim's shuffled baseline" of
36.42%. That figure is `deckObjectiveSweep.ts`'s baseline — a **different arm**,
blind, on a different deck. The arms that produce §0a's figures land shots at
80.8% and 42.1%. **I compared two arms and carried the conclusion across.** The
conclusion happens to be true — §1 below proves it properly — but the reasoning
was invalid and the session was right to say so and to say so loudly.

I also gated the session on reproducing 543 plays. Session 80 reproduced every
substantive number exactly and got **548** for the denominator under a predicate
I did not record. **That is my fault, not a discrepancy**: a gate that pins a
count without pinning the predicate that produced it is unmeetable by
construction, which is rule 6 turned on its author. The session's response —
state the predicate in full in the script — is the right permanent fix. **Drop
the 543 question.**

---

## The clock and the ledger

Written **2026-08-22, 16:46 PT**. **8 casts and 12 run-units remain, expiring
11:00 PT tomorrow (~18h).** `doctor.ts` first. §1–§3 need neither.

*⚠ `preflight.ts` (~90s) before the push. `npx tsx` and `git` fail under the
command sandbox.*

---

## 1. Open question 1, answered: the geometry is EXACT, and the matcher is costed

### 1a. The zone geometry is right — 581 of 581, against ground truth

The corpus contains everything needed to test the hit resolver in isolation from
the matcher: the card played, the focus point, the fish's cell, and the observed
outcome. The matcher's job is predicting *where the fish will be*; the geometry's
job is, *given where it actually is and where you aimed*, hit or miss. **The
second can be tested with the true cell substituted in, and then the matcher does
not enter at all.**

Reimplementing `zoneToCell`'s closed form (`dx = ⌊(z−1)/3⌋−1`, `dy = (z−1)%3−1`,
off-grid dropped, 4×4) and scoring every live play:

```
581 live plays with complete geometry data
  predicted outcome == observed outcome     581 / 581      100.0%
```

**Zero errors.** Not one card, one focus, one cell in the whole corpus where the
shipped resolver disagrees with the server.

**So hit geometry IS eliminated — this time on evidence.** Every point of the
residual belongs to the matcher. My §1b reached the right destination illegally;
this is the same destination with a receipt.

*(The test also fixes the wire semantics — see §3. Reading them wrongly gives
62.8%, which is what a plausible-looking convention error costs.)*

### 1b. The matcher, costed — the thing open question 1 says nobody has done

Same 581 plays. For each, the reachable focus set is every cell within
`focusMeter` Manhattan of the current focus point — exactly what the server
enforces:

```
  RANDOM   same card, uniform over reachable focus        19.3%
  ACTUAL   what the shipped bot did                       35.8%
  ORACLE   same card, best reachable focus                66.1%
  ORACLE   best card in hand + best reachable focus       71.1%
```

**The matcher captures (35.8 − 19.3) / (66.1 − 19.3) = 35% of the available
prediction headroom.** It is doing real work — nearly double random — and
**30.3 percentage points of hit rate remain on the table with the cards and the
focus budget the bot already holds.** No new cards, no change to card selection,
no live-policy change: purely better prediction of the fish's next cell.

Card choice is worth a further 5.0pp (66.1 → 71.1) and is the smaller prize.

**This is the tractable target, and it is now costed.** Anything that improves
next-cell prediction is scored against a 66.1% ceiling and a 19.3% floor.

---

## 2. The reframing that makes all four arms one equation — and one correction

Drift is fully determined by three numbers, and every arm's sign is decided by a
single threshold:

```
drift = h·(−damage) + (1−h)·(+heal)        zero when   h* = heal / (damage + heal)
```

Applied to session 80's own table, reproducing all four drifts to the third
decimal:

```
  arm             hit%    dmg   heal    break-even h*    margin      drift
  LIVE            35.6   5.06   3.02        37.4%        −1.8pp      +0.145
  SIM blind       42.7   3.66   3.28        47.3%        −4.6pp      +0.317
  SIM live-cfg    42.1   4.94   3.11        38.6%        +3.5pp      −0.282
  SIM bare        80.8   5.01   3.20        39.0%       +41.8pp      −3.437
```

**The fishery is a knife-edge, and the bot is sitting 1.8 points on the wrong
side of it.** Break-even is 37.4%; the bot hits 35.6%. That is the whole of
"catch 29.2% versus 81%" — not a seventy-point chasm, a **two-point** one, on a
threshold. It also explains why catch rate has been such an unstable instrument:
near h* it is a step function.

**And it corrects a reading in session 80's own recap.** STATE.md says *"the
blind arm is the only one on live's side of zero."* True, and **not for live's
reason.** The blind arm clears zero because its **damage is 3.66 against live's
5.06**, which lifts its break-even to 47.3%; its hit rate (42.7%) is *seven points
above* live's. Two different errors producing the same sign.

> **Matching the sign of the drift is not evidence of matching the mechanism.**
> The margin column is the diagnostic, not the drift column.

### 2a. Open question 2 — is the bare arm worth keeping as §0a's instrument?

**No, and §2 says exactly why rather than as a matter of taste.** Its margin is
**+41.8pp**. An arm whose hit rate clears its own break-even by forty-two points
is not a noisy model of this fishery; it is a different fishery, in which the
fish essentially cannot escape. Every §0a figure — +19.40pp included — was
computed there.

**But do not delete it and do not silently re-home the oil work onto another
arm.** The live-config arm is +3.5pp over break-even against live's −1.8pp: it is
much closer and still on the wrong side of the line, so it would produce a
different unsupported number rather than a supported one. **The margin is the
gate.** State it: an arm is admissible as §0a's instrument when its margin
brackets live's within some stated band, and none currently does. That is a
gate on something measurable, which is more than §0a has had.

---

## 3. Wire semantics, settled by the same test

The 100% fit only appears under one interpretation, and the alternatives are far
away:

```
  b.focusPoint  + b.fishPosition          581/581   100.0%    ← the truth
  a.focusPoint  + b.fishPosition          460/581    79.2%
  a.focusPoint  + a.fishPosition          365/581    62.8%
  b.focusPoint  + b.previousFishPosition  374/581    64.4%
```

**A card resolves against the focus point AFTER the move and the fish's cell in
the RESULTING state — not `previousFishPosition`.** The fish moves and the shot
lands at its new cell, so the bot is predicting one step ahead, which is what
makes 66.1% a ceiling rather than 100%.

`previousFishPosition` is currently used only by `movePathAudit.ts`, correctly,
for path continuity. **Nothing depends on the wrong reading** — but nothing writes
the right one down either, and a 62.8% agreement rate is exactly the kind of
"mostly works" that survives review. **Record it in SPEC-fishing, and pin it with
the 581/581 assertion**, which is a genuine ratchet: it fails the moment either
the resolver or the wire semantics drift.

---

## 4. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6 — and per §0's
lesson, each gate names its predicate, not just its number.

1. **The resolver is pinned against the corpus at 581/581**, under the predicate
   *"every state-to-state transition where exactly one card left the hand into
   the discard, and both states carry `focusPoint`, `fishPosition` and
   `fishHp`"* — that predicate stated in the test, in those words. The test must
   fail under the `previousFishPosition` reading, demonstrated by running it both
   ways. **A pin that does not fail the wrong reading has not tested anything.**
2. **The matcher's headroom is a reported metric, not a one-off.** A script
   emitting the four rows of §1b — random floor, actual, same-card oracle,
   best-card oracle — over the corpus, so any change to the matcher is scored
   against a fixed ceiling. Reproduce **19.3 / 35.8 / 66.1 / 71.1** as the check
   that the harness is right before it is used to judge anything.

Not gated, do if there is room: **§2's margin column added to
`scripts/damageEconomy.ts`'s output** — it is `heal/(damage+heal)` and one
subtraction, and it turns that report from four unrelated drifts into one
equation; §3's SPEC-fishing entry.

**What would make these unmeetable:** nothing. Both run on committed fixtures and
shipped code. If either number fails to reproduce, that is the finding and it
belongs at the top of the session, not in the recap.

---

## 5. Where the matcher work would go, if the session gets that far

**Not gated — this is a research direction, and it needs the corpus more than it
needs a plan.** §1b says the ceiling is 66.1% and the bot is at 35.8%. Two
questions that are cheap and would shape any attempt:

- **How much of the headroom is reachable without prediction at all?** Compute a
  "stay-put oracle": the best hit rate achievable if focus never moves from its
  opening cell. If that is near 35.8%, the matcher's movement decisions are
  adding nothing and the problem is the focus budget, not the prediction. If it
  is far below, prediction is genuinely load-bearing.
- **Is the miss structured or diffuse?** For each miss, the Manhattan distance
  from the fired focus to the fish's actual cell. A distribution concentrated at
  1 means the matcher is nearly right and a better tie-break wins points; a flat
  distribution means it is not tracking at all. **This is the single most
  informative plot available from the corpus and it costs one script.**

Both are offline, both are one pass over the same 581 plays.

---

## 6. The live budget — 8 casts, 12 run-units

Every item needs its own go-ahead. Rule 11 terms unchanged; rule 13 after every
run; `--dry-run` first — the dungeon path has not executed since session 75.

- **A hit-9 crit separates the three surviving crit rules** (`hit × 1.5`
  round-half-up, `hit × 1.6` rounded, `floor(hit × 5/3)` — 14/14/15 at hit 9).
  Casts are the only source. Worth asking for.
- **Ordinary casts still tighten §1b's 581** at no extra cost, and that number is
  now gate 2's fixture.
- **One juiced dungeon run** still seeds session 78's `evSupported` telemetry,
  unchanged.

**And read the `--help` incident as the standing lesson it is.** A cast was spent
by an unguarded arg parser, and the same defect sat in `liveRun.ts` where the
default is a plain 20-energy run — a run-unit and a rule-11 violation, never
exercised. §5's guard closed both. The general form is worth keeping in front of
the next reader: **a script that spends something must not have a default that
spends it.**

---

## 7. Do not

- **Do not read a matching drift SIGN as a matching mechanism** (§2). Use the
  margin.
- **Do not re-home §0a's figures onto the live-config arm.** It is +3.5pp over
  break-even against live's −1.8pp — closer, still wrong-side, still unsupported
  (§2a).
- **Do not delete the bare arm.** Mark it with its margin so nobody quotes it
  again by accident.
- **Do not treat §1b's 30.3pp headroom as a licence to change live policy.** It
  is a ceiling computed with knowledge no bot has at decision time. Rule 4.
- **Do not encode a crit multiplier** — n=2 separates the families, not the
  members (session 80).
- **Do not re-run the oil sweep on any current arm. Do not quote +19.40pp.**
- **Do not treat `mana -= card.manaCost` as confirmed** — 587/587 plays were
  manaCost-1 cards.
- **Do not start a dungeon run without `--dry-run`, `doctor.ts` and a per-run
  go-ahead**, and never chain runs.
- Standing, none re-opened: do not build H2's proc model; do not write M4's
  lines; `chooseNewCard`, `DEFAULT_POTION_THRESHOLD` untouched; redraw CLOSED on
  price; `boonCapture` OFF; no 429 backoff without an observed 429; do not
  shuffle the random-sample deck path.

---

## 8. Corrections to me

- **§1b of the last brief was invalid reasoning that reached a true conclusion,
  which is the worst kind to leave standing.** I compared live's hit rate to a
  number from a different arm and wrote "eliminated". Session 80 caught it. The
  lesson it extracted — *always name the arm* — is the right one, and I would add
  the reason it bit: **I took the nearest available number that matched instead
  of the one that belonged.** 36.42% was in front of me because I had quoted it
  the session before.
- **My gate 1 pinned a count without pinning its predicate.** 543 is unmeetable
  without the filter that produced it, and I made the session chase it. Rule 6
  says a gate must be set on something the agent controls; a number whose
  definition lives only in my scratch buffer is not that.
- **I said `dendren.oils.policyApproved` ships FALSE. It has been TRUE since
  session 62** and I repeated a stale line from a previous STATE without opening
  `config/bot.json`. **That is exactly the failure session 74's §7 rule was
  written to stop** — *any claim in a brief about what code does gets the file
  opened before the sentence is written* — and I broke it on a config value that
  takes one grep. Session 80 caught and retracted it.
- **Three errors in one brief, all of the same shape: I trusted a number I had
  already written down instead of re-deriving it.** The corpus work in that same
  brief was right because I ran it. The prose around it was wrong wherever I did
  not.
- **Rule 9 applies to this document.** §1's 581/581, §1b's four rates and §2's
  table are measurements over committed fixtures; a live response that disagrees
  wins.

---

## Your task (session 81)

1. `doctor.ts` first, both ledgers. **8 casts, 12 run-units, expiring 11:00 PT.**
2. **§1a / gate 1** — pin the resolver at 581/581 with the predicate written out,
   and demonstrate the test failing under the `previousFishPosition` reading.
3. **§1b / gate 2** — the matcher headroom as a reported metric; reproduce
   19.3 / 35.8 / 66.1 / 71.1 first.
4. **§2** — the margin column in `damageEconomy.ts`; mark the bare arm with its
   +41.8pp.
5. **§3** — SPEC-fishing entry for the resolution ordering.
6. **§5** — if there is room, the stay-put oracle and the miss-distance
   distribution. Both are one pass over the same plays.
7. **§6** — with a go-ahead: casts, ideally reaching a hit-9 crit; one juiced run
   for the `evSupported` telemetry.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` before the push**, no
   test writes a real data path, secret scan before handoff.

**Honest expectation.** The useful thing here is that a seventy-point catch-rate
mystery turns out to be a **two-point hit-rate threshold**, and the bot is on the
wrong side of it by less than the width of most of the effects this project has
spent sessions arguing about. **The satisfying version of this session is gate 2
landing and §5's miss-distance distribution showing a spike at distance 1** — the
matcher nearly right, a tie-break away. **The unsatisfying version is a flat
distribution**, meaning the matcher is not tracking the fish at all and 35.8%
against a 19.3% floor is coming from the card zones being large rather than from
prediction. That would be a harder result and a more important one, and it is one
script either way.
