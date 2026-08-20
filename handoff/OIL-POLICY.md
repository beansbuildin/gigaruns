# OIL CONSUMPTION POLICY — derived, awaiting the user's approval

Session 61, 2026-08-20. Brief §4d. **Nothing here has been consumed live.**
`config/bot.json`'s `dendren.oils.policyApproved` ships **false**, and
`mayConsumeOil` refuses every spend while it is (CLAUDE.md rule 4).

---

## 0. What this is worth, stated first and not in a footnote

**The corpus contains no usable oil data.** 93 of 94 casts spent no consumable
at all. The 94th — `12975152`, 2026-08-19 — carries `consumablesUsed: 1` on its
*first* captured state, so a consumable was spent before capture began, by
someone other than this bot, and the board state does not name the item. (This
corrects the brief, which stated the corpus contains zero oil casts.)

So every number below scores a **model** of the oils built from their item
payloads, not observed behaviour. The payloads themselves are real and
re-verified this session against `fixtures/fishing-casts/item-metadata-sample.json`:

| item | id | effect | amount | shape |
|---|---|---|---|---|
| Mid Focus Oil | 942 | `FishingRestoreFocus` | 2 | `OnUseFishing`, `durabilityChange: 0`, single effect entry |
| Mid Relaxing Oil | 937 | `FishingDamageFish` | 2 | same |

The user's description in the brief is confirmed in every particular, including
that "Relaxing" is a direct fish-damage item despite the name.

---

## 1. THE HEADLINE: the turn-cost branch cannot be scored, and that is the result

The brief asked for the policy derived twice — once assuming consumption is
free, once assuming it costs a turn. Both were run. **The second is not a
model of a turn cost, and reporting it as one would be false.**

Diagnosed from the sweep's own numbers, not assumed:

- **Turns are not scarce in this fishery.** `maxTurns` is 40; mean turns per
  cast is **2.95**; `stalled` — the only outcome `maxTurns` can produce — is
  **1 in 8000**.
- **What is scarce is mana and misses.** `escaped_mana` is the dominant loss
  (2003/8000 on the control arm), `escaped_meter` second (499/8000, driven by
  misses pushing `fishHp` back toward `fishMaxHp`).
- A consume turn plays no card, so it **spends no mana, takes no miss, and
  hands the matcher a free observation of the fish's move.**

The consequence is visible directly: `start` at `costsTurn=true` cuts
`escaped_mana` 868 → 270 and `escaped_meter` 165 → 10, and its catch rate
**rises** from 74% to 93%. An added cost that improves the outcome is an
artifact. Those rows are printed with a warning attached rather than deleted.

**This also inverts the brief's framing of the mechanic.** The brief reasoned
that a turn-costing +2 is a net loss whenever an ordinary attack deals more
than 2. That assumes the forgone turn was a free guaranteed attack. It is not:
a turn spends mana and risks a miss that *undoes* damage. So the comparison is
not "2 versus the card's damage" even in principle, and the Relaxing Oil is
less obviously bad under a turn cost than the brief feared.

**What still needs the first live oil cast:** whether `use_fishing_item`
advances the fish, and — the question the sim says actually matters — whether
it costs **mana**. Nothing in the payload or the `use_fishing_item` envelope
suggests it does, which is why the sim models it as free, but that is an
assumption and it is the load-bearing one.

---

## 2. RECOMMENDATION: `on-demand`

> **Relaxing Oil:** spend only when `fishHp <= 2` — i.e. only when it is lethal.
> **Focus Oil:** spend only when the focus meter is at **zero**.

Robust within the branch the sim can model: it wins at effect amounts 1, 2 and
3, so the recommendation does not depend on the payload's `+2` being exact.

`n = 8000` per arm, paired on seed, `costsTurn=false`, amount = 2:

| policy | catch | Δ vs never | 95% CI | oils spent | Δpp per oil |
|---|---|---|---|---|---|
| never (control) | 68.71% | — | — | 0 | — |
| **on-demand** | **88.11%** | **+19.40pp** | [+19.39, +19.41] | 5578 | 0.278 |
| focus-when-empty-only | 86.45% | +17.74pp | [+17.73, +17.75] | 3515 | **0.404** |
| start | 74.38% | +5.66pp | [+5.66, +5.67] | 16000 | 0.028 |
| heuristic-c (shipped) | 73.22% | +4.51pp | [+4.51, +4.52] | 2630 | 0.137 |
| lethal-relaxing-only | 73.19% | +4.47pp | [+4.47, +4.48] | 1821 | 0.197 |

### Why it wins — the causal story, which matters more than the ranking

**The Focus Oil carries almost all of the effect.** Decomposed:
`focus-when-empty-only` alone is +17.74pp; `lethal-relaxing-only` alone is
+4.47pp; together +19.40pp — close to additive, so the two triggers are not
competing for the same casts. The mechanism is direct: the focus meter **never
regenerates within a cast** (CONFIRMED session 13), so at zero the policy is
frozen onto whichever cell it last occupied and every subsequent shot must be
taken from there. +2 focus is not "a bit more budget"; it is the difference
between a policy that can still aim and one that cannot. That is also why the
*trigger* matters: spent at any other moment, the same +2 merely tops up a
budget that was not binding.

**The lethal trigger is worth its small share for a reason that does not show
up in its delta.** At `fishHp <= 2` the oil ends the cast outright, converting
a probabilistic shot into a certain catch. It is therefore **provably
indifferent to the unresolved turn-cost mechanic** — there is no next turn to
lose. It is the one part of this recommendation that survives whatever the
first live cast finds.

**Why `start` loses, given it is the un-overfittable baseline.** It spends
16000 oils for +5.66pp — every oil, every cast, 0.028pp each, an order of
magnitude worse per oil than any triggered policy. Its thesis ("a held oil
earns nothing") is sound about oils held to the END of a cast and wrong about
oils held for three turns: the Focus Oil spent at turn 0 tops up a meter that
was still full, which is worth nothing at all. It is a real baseline and it is
genuinely beaten, not strawmanned.

**The shipped heuristic (c) is dominated and should be replaced.** Session 43's
rule — Relaxing Oil at `fishHp <= 15% of max` — scores +4.51pp for 2630 oils
(0.137pp each) against the lethal trigger's +4.47pp for 1821 (0.197pp each).
Statistically indistinguishable benefit, **44% more oil**. The two differ only
on fish where 15% of max exceeds 2 HP, and on exactly those fish the oil is
spent without securing the kill. This is a finding about code that is already
live, not a hypothetical.

### Sensitivity

| amount | winner | Δ vs never |
|---|---|---|
| 1 | on-demand | +13.89pp |
| **2 (payload)** | **on-demand** | **+19.40pp** |
| 3 | on-demand | +21.99pp |

The winner does not flip. The *magnitude* scales strongly with the amount,
which is expected and is why the amount is a swept parameter rather than a
constant.

---

## 3. What approving this would mean

1. Set `dendren.oils.policyApproved` to `true` in `config/bot.json`.
2. Replace `liveFishing.ts`'s heuristic-(c) trigger with `on-demand`'s two
   triggers. **Not yet done** — it is a live-policy change and this document is
   the approval request for it.
3. The first oil cast measures the turn-cost and mana-cost questions §1 leaves
   open, and this recommendation is re-checked against them.

**Do not read +19.40pp as a forecast of the live catch rate.** The sim's
control arm catches 68.71%; the real fishery catches 25.9% (dead-era-excluded).
The sim is a policy-comparison instrument, not a calibrated model of Dendren.
