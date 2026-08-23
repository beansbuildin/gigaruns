# scratch — session 84 — surprises as they landed

## 1. `todaysEraCastIds()` cannot be the era instrument, for three reasons
It reads `data/ringPrediction.jsonl`, which is **gitignored** — the gate says
"no `data/`", and a fresh clone has none. It knows only **81 of the corpus's
148 casts**. And it names a **different boundary**: turn-0 rows carrying
`matcherWeight` = the matcher-weighting era at 2026-08-20T18:27Z, not the
oil-policy date the brief split on.

Measured rather than argued: mw-era = 59 casts, date-era = 54, and the
disagreement is **exactly 5 casts, all at 2026-08-20T18:27–18:28Z**. Those 5
read **7/19 = 36.8% budget-0** — squarely the OLD regime. Folding them into
"today" takes today's rate from 1.5% to 4.5%. **The date literal wins, on
evidence.**

## 2. `doc.createdAt` is a per-cast timestamp available off committed fixtures
Constant within a cast on **148 of 148**. This is NOT the brief's §0b hazard —
that was about ordering STATES inside a cast, where the timestamps tie. Dating
a whole cast is a different use and it is safe.

## 3. Play counts are 612 / 410 / 202, not the brief's 605 / 404 / 201
Cast counts match exactly (94 / 54). 612 is STATE.md's own documented corpus
figure. Six variants tried (clean traces, hasStart, continuous, next-turn-
exists, stale meter) — none lands on 605.

## 4. Today's era reproduces the brief EXACTLY; the gap is all in the OLD arm
`127 / 109 / 3 / 15 / 0`, dead 15 (11.8%), cost 1.33, 88.2% → 97.6%. Every cell
identical. Session 83's unexplained 389-vs-387 residual therefore lives
**entirely before 2026-08-21** and does not touch today's-era conclusion.

## 5. The catch rate went 15.1% → 63.0%
93 resolved / 14 caught, against 54 / 34. Nobody has written this down either.

## 6. Cast length explains only 5.4pp of the 43.4pp drop
Direct standardisation of before-era per-length rates onto today's length mix
gives 39.5% expected against 1.5% observed. The drop is WITHIN length: at
matched length 10 it is 69% → 2%.

## 7. The decomposition is three additive terms and the corpus supports all three
44.9% → 39.5% (length mix, 5.4pp) → 21.3% (focus pacing, 18.2pp) → 1.5%
(oil restores, 19.8pp).
- Oil term isolated by a **within-cast no-restore counterfactual**: strip the
  restores from the 13 oil casts and they read **47.1%**, against a before-era
  length-standardised **54.9%**. The oil does ~all the work on that arm.
- Pacing term isolated on the **41 restore-free casts**: **1.7% observed vs
  27.8% standardised**, and the no-restore counterfactual on that arm is
  identical to observed (2 plays) — by construction, which is the self-check.
- Self-check: the POOL=3 no-restore counterfactual reproduces the before era at
  183 vs the observed 184. The one difference is the single before-era cast
  that started at `focusMeter` 2.

## 8. It is NOT a gear effect
Deck intrinsic reach — the policy-free fraction of (focus, target) pairs one
random deck card covers — is **15.3% before vs 15.1% today**, and the era
effect survives deck-size matching (11–12 cards: 45% → 4%; 13–15: 51% → 2%).
Decks did get bigger (11.4 → 15.4 cards) and crit-richer (18.5% → 34.2%), which
plausibly drives the catch rate, but not the focus budget.

## 9. The proximate mechanism is the FIRST PLAY
Mean first-play focus spend **1.553 → 0.852**, and today it is **never 3**
(before: 17 of 94 casts spent the whole meter on play 1). Cumulative spend
before play 3: 2.2 → 1.5. Before-era casts are at 3.0/3 by play 6 — 100% frozen
from there.

## 10. The cause is NOT identified, and the bracket says why it is hard
Corpus brackets the change to **2026-08-20T18:28:24Z → 2026-08-21T14:46:17Z**,
a 20.3h gap with zero casts. The only code in it is sessions 61 and 62, and
their `scripts/liveFishing.ts` diff is **oil plumbing only** — no focus or card
selection change. `focusReserveWeight` defaults 0, `costCap` is documented
inert. So the measured mechanism has no identified cause.

## 11. Oil detection: use `consumablesUsed`, not the meter
`consumablesUsed` delta → **13 casts** (matches the brief). A `focusMeter`
increase → 11 casts / 16 jumps, deltas +1 (7) and +2 (9), because `castTrace`
skips the `use_fishing_item` response, so the visible jump is **restore minus
the move spent on the same transition**. The brief's "+2 exactly, 21 times"
was read off raw fixtures including the item response; both are right about
different things. Oils consumed today: **21**, which does match.
