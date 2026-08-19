# BRIEF — session 51 (fishing fixes) + session 52 spec (dungeon live)

Session 50 did the right thing twice: it built the coverage objective, gated
it honestly, and reported the failure as a finding rather than tuning until it
passed — then let a live batch reverse its own offline conclusion in the same
session and said so. The ceiling result stands (budget 3 is one turn short of
hindsight-perfect at 83 casts; more buys 0.27pp), so "spend quantity was never
the dimension" is now settled on two corpus sizes.

Session 51 is the last fishing session before the dungeon work. It should be
short: four answers, three of them small changes, one of them a real fix.
Session 52's dungeon spec is at §6 — **do not start it early.**

---

## 0. Corrections to me, and one idea I killed before proposing it

- **"`s` has risen at every single count" is no longer true.** It went 4.98%
  (83 casts) → 4.67% (88). My monotone-trend argument for estimating it at
  load was therefore weaker than I stated. The conclusion still holds — the
  swept optimum tracks the estimator at every corpus size — but on
  "estimate it because it moves," not "estimate it because it only rises."
- **The mined library has 8 supporting casts, not 7.** My number, wrong.
- **An idea I tested and am not proposing.** The obvious explanation for k=2
  underperforming is that reversal frequency varies fish-to-fish, so a pooled
  41–46% over-generalises and a per-cast adaptive reversal parameter would
  help. I checked: across 15 k=2 casts with ≥2 comparable hops, pooled
  reversal is 32/69 = 46.4% and the **dispersion ratio is 0.80** — at or below
  pure binomial, i.e. no heterogeneity to exploit. One cast always reverses,
  none never does, and the spread is what chance alone produces. **Do not
  build a per-cast reversal parameter.** Recording this so the idea doesn't
  get proposed later by someone who hasn't checked.

---

## 1. Q1 — coverage or conversion: your reading is right, and the reason is structural

The two answers disagree because **the decomposition is diagnostic, not a
lever.** `hit = coverage × conversion` factorises the outcome, but both factors
are functions of the *same* decision variable — the (card, focus) placement.
You cannot optimise one factor of a product when both depend on the same
choice; pushing coverage up necessarily moves focus to cells chosen for
window-containment rather than zone-alignment, and session 50 measured exactly
that: +42/−5 on coverage, −8.8pp of aiming, hit rate unchanged at p=0.35.

The quantity that is actually a lever is **expected hit probability**, and
`bestFocusForCard` already maximises it jointly over every card × every
reachable focus. There is no conversion-side change being dismissed too fast:

- Better zone shapes → the deck thread, closed in session 46 on a marginal
  sweep of ~0–3pp, and unreachable anyway at one card per catch.
- Aiming the card at the conditional distribution given the window → that *is*
  EV placement.
- Joint (card, focus) search → already joint.

So conversion has no untapped lever **given the current model**, which is the
qualifier that matters: 62.3% conversion is what EV aiming extracts from a
3.57-zone average card, against 39.7% with no aiming. Better prediction raises
both factors at once. Your reading — coverage is downstream of prediction, the
real lever is the movement model on k=2 — is correct, and §2 is that lever.

---

## 2. Q2 — it is the shrinkage, and it should be per class

The conditional tier's shrinkage is a single `shrinkageK = 1` shared by both
step classes. It should not be. Leave-one-cast-out on my 67-cast snapshot,
sweeping `shrinkageK` **separately per class**:

| `shrinkageK` | 0.5 | 1 | 2 | 4 | 8 | 16 | 64 |
|---|---|---|---|---|---|---|---|
| **k=1** top-1 | 52.7% | 52.7% | 52.7% | 52.7% | 52.7% | 52.7% | 52.7% |
| **k=1** logLoss | **0.745** | 0.751 | 0.763 | 0.784 | 0.820 | 0.872 | 0.999 |
| **k=2** top-1 | 40.5% | 40.5% | 40.5% | 40.5% | 41.7% | **42.9%** | 36.9% |
| **k=2** logLoss | 1.830 | 1.697 | 1.576 | 1.475 | 1.400 | 1.356 | **1.341** |

The two classes want opposite things. **k=1 wants low shrinkage** — trust the
conditional, logLoss degrades monotonically as you back off. **k=2 wants much
higher shrinkage** — from the shipped `K=1` to `K=16`, logLoss improves 1.697 →
1.356 (**0.34 nats**) and top-1 rises 40.5% → 42.9%. The shipped single value
is near-optimal for k=1 and materially wrong for k=2.

That is a mechanistic explanation for everything Q2 asks about. k=2's legal
ring is bigger (4.42 cells vs 3.13), so its conditional table is spread thinner
over more (prevDelta → delta) keys, and it needs *more* smoothing, not the
same. Over-trusting a sparse table is exactly what produces a tier that loses
to its own k-ring null on a k=2-heavy batch (21.1% vs 26.3%) while winning on
mixed batches.

**Do this**: make `shrinkageK` per class, sweep it per class on the 88-cast
corpus with `fishingRingCV.ts`, and gate on paired ΔLL against the current
shared value. Expect the k=2 optimum well above 1 — but re-derive rather than
taking 16 from a 67-cast snapshot (§0's own standing rule). Note top-1 peaks at
16 while logLoss keeps falling to 64; prefer the logLoss optimum, since
`chooseCard` consumes the whole distribution.

---

## 3. Q3 — the matcher: stop measuring the override, replace it with a mixture

Two independent measurements now agree in sign and magnitude — session 49's
+1.337 nats at n=15 and session 50's shadow-tier +1.300 [0.006, 2.593] at n=6,
against different comparators. The question "how many more turns before acting"
has a better answer than a number: **the fix dominates both alternatives, so
the measurement stops being decision-relevant.**

The matcher tier is an *override*. It replaces the distribution with a
near-point-mass on a perimeter walk when its candidates survive. Its library
has 8 supporting casts out of 88 — roughly a 9% prior. The right object is a
mixture, not a switch:

```
P(next) = π · P_matcher(next) + (1 − π) · P_ring(next)
π = posterior that this fish is a perimeter walker
  = prior (≈ 8/88) updated by the likelihood ratio over hops observed so far
```

This reduces to the current override at π→1 and to the pure ring at π→0, and is
strictly better calibrated everywhere in between — so it cannot lose to either
arm, which is why it does not need more n to justify. It also removes the
`tier: "override"` rows that currently drop out of every ring comparator, which
is the reason this took two sessions and two different comparators to see.

**The unifying frame, worth putting in SPEC-fishing.md §9:** every remaining
defect in this stack is a hard override where a mixture belongs. The hard ring
(fixed in 48 by the sticky latent, zero-probability events 8 → 0), the matcher
tier (here), and the `nextPosition` point mass (§4). Same bug, three places,
and the sticky fix is the worked template.

---

## 4. Q4 — arm the override, and get the paired comparison for free

Do **not** hold it off for a batch. You already built the machinery that makes
that unnecessary: the shadow-tier dual-logging from §3 of session 50. Arm it,
and log what the ring tier *would* have predicted on every override turn.
That gives before/after on the *same* turns — a strictly better paired
comparison than two batches on different fish, at zero cost and zero delay.

**One change to make before arming**, per §3's frame: the override installs a
point mass. At 10/10 with a Wilson bound of 0.7225 the field is very likely
right, but a point mass has unbounded loss when it is wrong, and nobody has yet
seen it fire. Floor it — mix at 0.99 override / 0.01 ring. That costs ~0.01
nats when it is right and caps the loss near 5 nats when it is not. This does
not reverse §18's settled design; it makes the armed behaviour survive its
first miss.

---

## 5. Before session 52: dry-run the dungeon path

**The dungeon has not been played live for eight sessions**, and in that window
it acquired changes nobody has exercised: session 47's energy preflight (wired
into `liveRun.ts` ×3 under `--juiced`), the three swallowed-error-body fixes in
that same file, and the graceful SIGINT handler. All are tested offline; none
has met the live API.

Do a **full dry-run of `liveRun.ts` that spends no energy** — preflight,
auth, state read, tier enumeration, and the first decision point — and confirm
each of those three changes behaves. Finding a dead classifier in a dry run
costs nothing; finding it mid-run costs a 60-energy juiced entry.

---

## 6. SESSION 52 — dungeon live runs (specified now, do not start early)

**Configuration, from the user:**

- **60-energy juiced run**, tier 3 dungeon **entry** (the gold-rings loot
  table).
- **3× big heal juice.**
- **Pause after every completed run** and hand control back — the user upgrades
  skills between runs, then tells you to resume.

**Two rules that are not negotiable and are easy to get wrong here:**

1. **The tier-3 choice is the ENTRY tier only.** CLAUDE.md §8 remains in force
   *inside* the run: `pickLowestTier()` chooses the lowest `enemyPathOptions`
   tier offered in every room. The loot table is identical across those tiers
   (440/440 verified) and higher ones only add unscorable mechanics. Confirmed
   with the user this session — entry tier only. If any part of the run path
   tries to route an in-run tier decision anywhere other than `pickLowestTier()`,
   stop.
2. **Never allocate skill points.** CLAUDE.md's ask-first list makes levelling
   and skill allocation user-only, and it is irreversible without Hourglasses.
   The pause exists precisely so the user does it. The bot pauses; it does not
   upgrade.

**Process:**

- Energy preflight first (pool + ROM bank, claim to the deficit) — §0a of the
  standing policy. Energy must not be the reason a run doesn't happen.
- One run, then **stop and report** before the next. Do not chain runs.
- Per run, report: rooms reached, the tier offered and the tier taken in each,
  heal-juice consumption and when, loot, energy spent vs committed, and any
  server message captured by `serverErrorDetail`.
- If anything fails closed — a guard trip, an unclassified non-2xx, an
  unexpected enum — stop and report rather than retrying. Eight sessions of
  drift means the first surprise is more likely than usual, and it is
  information.

---

## Your task (session 51)

1. §2 — per-class `shrinkageK`, swept on the 88-cast corpus, gated on paired
   ΔLL against the shared value. This is the session's one real fix.
2. §3 — replace the matcher override with the posterior mixture; gate on the
   replay and report the override rows re-entering the ring comparators.
3. §4 — floor the `nextPosition` point mass at 0.99/0.01, arm it, and
   dual-log the ring counterfactual on every override turn.
4. §5 — dungeon dry-run, no energy spent, confirming the three unexercised
   `liveRun.ts` changes.
5. §0 and §3's frame into SPEC-fishing.md §9: the rejected per-cast reversal
   idea with its dispersion number, and the override-vs-mixture principle.
6. Fishing casts only if §1–§4 leave time and the cap has reset; the 5-cast
   checkpoint discipline is unchanged.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit.

Honest expectation: §2 is the only change with a real chance of moving the
live number, and its measured size is ~0.34 nats on roughly half the turns —
meaningful for a distribution `chooseCard` integrates over, but not the kind of
thing that shows up in a 5-cast catch rate. §3 and §4 are correctness fixes
that make future measurements interpretable rather than improvements in
themselves. Say so if that is how they land.
