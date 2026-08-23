# Session 86 §2 — the redraw verdict, revisited

**Computed on `CORPUS-2026-08-23A` — 148 traces / 612 plays / 147 resolved,
the fishing corpus as of `createdAt <= 2026-08-23T00:20:47.236Z`.** The roster
and every frozen denominator are in
[`session-86-corpus-snapshot.md`](session-86-corpus-snapshot.md), pinned
[session 87 §1] BEFORE that session's 20-cast batch. Casts landing after that
cut are not in any number below; a figure re-read on the grown corpus is a NEW
row beside these, never over them.

**This is a memo, not a change.** `redrawEnabled` is still `false`,
`REDRAW_THRESHOLD` is still `0` and untouched, and no live-path line moved this
session. The user gated QUESTIONS §26's shadow evaluation behind this revisit
and specified the order — **revisit first, instrument second** — so this
document is the whole of the deliverable and the decision at the end is the
user's.

---

## The recommendation, up front

**Re-price the verdict; do not reverse it.**

- **Keep redraw closed.** Nothing measured supports enabling it.
- **Retire the stated REASON.** "43.9 mana per extra fish against a cast holding
  10" prices redraw against the resource the corpus says is *not* scarce, and it
  was derived on a sim arm that this repo has since suspended for this fishery.
  It should stop being quoted as the reason.
- **Restate the reason as what actually blocks it:** no trigger has been
  validated out-of-sample, and two correctness gaps in the live redraw path are
  unpaid. Both are fixable offline; neither is fixed.

That is a smaller change than it sounds, and it is the honest one: the verdict
survives, the argument behind it does not. It also matters for what comes next —
§26's shadow evaluation is the instrument that would produce the out-of-sample
evidence the restated reason names, so the two fit together.

---

## Every number below, with its instrument and that instrument's distance from live

Nothing here is new capture. Everything was measured in sessions 75, 83, 84, 85
or 86 and re-run today unless marked.

### 1. The verdict on record — 43.9 mana per extra fish

| | |
|---|---|
| **Instrument** | `castSim`, `SIM bare` arm, n=4000/arm (session 75) |
| **Distance from live** | **The largest of any arm in the repo.** |

Four specific gaps, all re-measured today with `npx tsx scripts/damageEconomy.ts`:

- **Margin +41.9pp** over its own break-even, against live's **−0.7pp**. An arm
  clearing break-even by forty points is a fishery where the fish essentially
  cannot escape. `OIL-POLICY.md` §0a suspends this arm for exactly this.
- **Oracle matcher.** `castSim.ts` defaults `matcherPool` to `truePool`, so the
  bare arm can identify the true pattern by construction. Live has never once
  identified it (STATE.md session 13).
- **It redraws 27.3% of its turns** (2.58 mana/cast of a 10-mana pool) while the
  live bot redraws **0**, structurally.
- Sim catch ~70% against a real 27.6% at the time §0a was written.

### 2. There is no sim arm that could re-derive the price honestly

This is what session 86 §1 adds to the argument, and it is the reason "just
re-run it properly" is not an available option.

| arm | why it cannot price a redraw |
|---|---|
| `SIM bare` | §1 above: oracle matcher, +41.9pp margin |
| `SIM blind` | **Never aims.** 0 focus moves in 1963 turns, 0 points spent, all 763 plays fired from the opening cell (2,2), at focus-reserve weight 0 and 3 alike. Damage/hit 3.66 against live's 5.10. Instrument: `src/sim/fishing/focusMovement.ts`, this session, pinned in `tests/fishing/focusMovement.test.ts` |
| `SIM live-config` | Closest, and still on the wrong side: margin **+4.0pp** against live's −0.7pp, and it redraws **31.5%** of turns |

The two candidates fail in **opposite** directions — one is a fishery the fish
cannot escape, the other a bot that never aims — so there is no averaging
between them either. **The corpus is the only instrument that describes the bot
that plays.**

### 3. Mana is not the binding resource

| | |
|---|---|
| **Instrument** | the live corpus, 147 RESOLVED casts (`caught \|\| escaped`), terminal doc's `playerHp` |
| **Distance from live** | **none — it is live**, the bot's own casts |

```
  pooled (147 casts)   mean 5.85 left   median 7   132/147 (89.8%) end with mana to spare   15 mana-outs
  today's era (54)     mean 6.26 left   median 7    48/54  (88.9%) end with mana to spare    6 mana-outs
  before      (93)     mean 5.61 left   median 6    84/93  (90.3%) end with mana to spare    9 mana-outs
```

The era split is new here and it matters: the standing discipline since session
84 is that a pooled corpus figure must be checked on the era the bot plays in.
**It holds on both eras, and today's era is the slacker of the two.**

### 4. The binding resource is fish-HP headroom, and a redraw cannot spend it

| | |
|---|---|
| **Instrument** | the live corpus, `scripts/damageEconomy.ts` §2 |
| **Distance from live** | **none — it is live** |

Opening headroom **6.8 HP** mean; a miss heals **3.02**; so a cast tolerates
**~2.3 net misses**. Against that, **a redraw takes no shot, so it cannot
miss.**

The cost of a redraw is fully known and is entirely in the abundant resource:
**mana equal to the number of cards held, and the fish moves. Nothing happens to
`fishHp` in either direction** (SPEC-fishing §7a). Instrument: the account
owner's own play, 2026-08-21, plus one user-captured response; distance from
live: it *is* live, but by human report — **no bot cast has ever played a
redraw.** A session-74 reading that had the fish healing 3 on a redraw is
retracted in SPEC and should not be re-proposed.

### 5. Today's era: what a redraw would have bought

| | |
|---|---|
| **Instrument** | `scripts/redrawCounterfactual.ts` §6, committed fixtures, re-run today |
| **Distance from live** | **live data under an ORACLE lens.** It scores *availability* — whether some card could have reached the cell the fish actually resolved on — not hits. The bot converts about half of available hits into real ones (36.3% actual against a 71.1% best-card ceiling, session 81). The lens is identical on both arms, so the paired comparison is fair; **neither arm's level is achievable.** |

```
             n  both  sac  rescue  neither   dead   rescue rate   cost   availability
  today    127   109    3      15        0     15    15/15        1.33   88.2% -> 97.6%
                                                     95% CI [79.6%, 100.0%], n = 15
  before   262   152   24      30       56     86    30/86        1.73   67.2% -> 69.5%
                                                     95% CI [25.7%, 45.4%], n = 86
```

**The rescue rate is `15/15`, 95% CI [79.6%, 100.0%], n = 15. It is never to be
written as 100%.** That interval, with a lower bound near 78% on fifteen
observations, is the weakest joint in this entire memo, and it is deliberately
stated before the result rather than after it.

Dead hands are **15 of 127 plays (11.8%)**. `neither = 0` — in today's era there
is not one play where both the held hand and the redrawn triple are dead — which
is the exact inversion of session 83's pooled finding that "the dead hands a
signal finds are the ones a redraw cannot fix". That finding describes the
BEFORE arm and nothing else.

**The three sacrifices are not a rounding error**; they are what a wrong trigger
costs, and a trigger is what does not exist.

### 6. How often the shipped trigger actually wants a redraw

| | |
|---|---|
| **Instrument** | the bot's own live JSONL logs, `logs/fishing-*.jsonl` — the union of `redraw_indicated_not_sent` (pre-session-70) and `redraw_suppressed` (post), against one `decision` record per turn |
| **Distance from live** | **none. These are the shipped policy's own decisions on real turns** — not a replay, not a sim |

```
  today's era   26 of 204 decisions   12.7%
  before        93 of 245 decisions   38.0%
  pooled       119 of 449 decisions   26.5%
```

⚠ **The union is required, not tidiness.** `redraw_suppressed` did not exist
before session 70 — counting only it would date a policy change to the session
that renamed the log event, which is CLAUDE.md rule 10's trap exactly.

⚠ **Correction to the session-86 brief.** It states the shipped threshold "wants
one on ~3.5% of turns". That number is not supported anywhere I can find; the
nearest figure in the repo is a Wilson lower bound in session 72's log, not a
fire rate. The measured rate is **12.7% in today's era**.

**What that costs, arithmetically.** At today's rate and roughly 2 mana a
redraw, the shipped trigger would spend on the order of **1 mana per cast**
against **6.26 spare**. Firing only on the 15 dead hands would cost
15 × 1.33 ≈ 20 mana over 54 casts, about **0.37 per cast**. Both are affordable
against the slack. ⚠ These two populations are near-identical in size (204
logged decisions, 202 corpus plays) but I have not proved they are the same
casts, so read this as an order of magnitude, not a ledger.

**And note what it does not say:** that the trigger fires on the *right* turns.
The shipped EV cut fires at about the same rate as dead hands occur (12.7%
against 11.8%) and **nothing here establishes they are the same turns.** That
overlap is cheap to measure and has not been measured.

---

## What is still unpaid — the two correctness gaps, priced

Both are live-path edits, both are blocking for enabling, and neither is fixed.

### Gap 1 — the matcher's history gets a hole where a real movement happened

`scripts/liveFishing.ts:2471`. A redraw response carries `FISH_MOVED`, so the
fish moves exactly as it does on a play — and the redraw branch does **not** hand
the new position to the matcher, because `observe` is called on the play path
alongside the placement it is scored against.

**Price:** this is not a three-line repair. It is a choice between two semantics
nobody has measured — (a) redraw is a turn the predictor learns from (observe the
moved cell with no placement, increment `turn`; matches the sim's bookkeeping and
changes how the predictor is fed), or (b) redraw is a turn the predictor skips
(what ships, and the history keeps a hole). The sim can observe because it has a
true trajectory to observe against; live has no placement to score with, so the
same three lines are a *different operation* on the two sides. **Measurable
offline; not measured.**

### Gap 2 — `MAX_REDRAWS_PER_CAST` is a fail-closed guard, not a per-cast budget

`scripts/liveFishing.ts:1526`, cap = 5. Because a redraw does not advance `turn`,
`MAX_TURNS` cannot bound redraws, so this cap is the **only** bound — and
exceeding it throws a `GuardTrip` that **aborts the cast**, rather than falling
through to play.

**Price:** at today's 12.7% fire rate over casts averaging a handful of turns,
tripping 5 is unlikely — but the failure mode on record is precisely a trigger
that re-fires on the hand it just drew (`cardChoice.ts` §5: repeated redraws
produced casts averaging 1.29 turns), and under that shape the guard converts a
mana burn into a **lost cast**. A real per-cast redraw budget with a graceful
fall-through to a play is part of the recalibration, and it does not exist.

---

## What this memo deliberately does not do

- **It does not re-run the counterfactual.** That is done twice and pinned
  (sessions 83, 84). This is the argument about which scarcity to price against,
  which is a different question from what the counterfactual measures.
- **It does not propose a trigger.** `heldCoverage` separates dead hands from
  live ones at AUC 0.922 and cleans up considerably when conditioned on focus
  budget ≥ 1 — but it is **fitted to this corpus with oracle labels and no
  held-out set**, n=27 in the conditioned arm. A shape, not a tuning.
- **It does not flip anything.** `redrawEnabled` false, `REDRAW_THRESHOLD`
  untouched, no live-path line changed.

---

## The question for the user

**Do you accept re-pricing the verdict — keeping redraw closed, retiring "43.9
mana against a 10-mana pool" as its stated reason, and restating the reason as
"no validated trigger + two unpaid correctness gaps"?**

If yes, §26's shadow evaluation becomes the next step in its own right: it is
the instrument that would produce the out-of-sample trigger evidence the
restated reason names, and it spends nothing live beyond a log line.

If no — if the verdict should keep standing on its original price — say so and
it stands as written; this memo is then a record of why the price is weak, and
redraw stays closed either way.

---

## Reproduce

```bash
npx tsx scripts/redrawCounterfactual.ts
```

```bash
npx tsx scripts/damageEconomy.ts
```

Sections 1, 2 and 4 of the tables above come out of `damageEconomy.ts` (§3,
§4, §4a, §4b); section 5 out of `redrawCounterfactual.ts` §6; section 3 appears
in both, printed through one shared helper so the two reports cannot drift
apart. Section 6's counts are a scan of `logs/fishing-*.jsonl`, which is
gitignored and local to the author's machine.
