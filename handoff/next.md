# BRIEF — session 86 — the blind arm never aims

## 0. Verification, and three corrections taken

Fresh clone at `c8a144d`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Test Files  98 passed (98)
                      Tests  1643 passed | 13 skipped (1656)
```

**Both gates hold.** Gate 2's result — 98% of the opening-spend miss closed at
w=3, the per-turn profile and the drift margin both moving *away*, FAIL at both
weights by four thousandths — is a better answer than either outcome I predicted,
and the decision to change no default now has evidence behind it rather than
caution.

**Session 85's three corrections to me are all correct and one is bad.**

- **`redrawCounterfactual.ts` is not a sim arm.** It calls
  `makeMatcherFishPolicy` zero times; the `focusReserveWeight` I cited at `:460`
  is inside a printed prose paragraph. **I asserted what a file does without
  opening it** — the same failure as the `policyApproved` line in session 81, and
  the rule session 74 §7 wrote to stop it. Twice now.
- **"Nobody has asked what it reads at w=3" was wrong** —
  `focusReserveAblation.ts` has swept `[0, 0.5, 1, 2, 3, 4, 6, 8, 12]` with a
  live-config arm since session 45. The narrow true statement is the one gate 2
  answered: nobody had asked what the *opening-spend gate* and the *drift margin*
  read at w=3.
- **(2,2) is 147 of 147 recorded openings.** The 148th trace has `hasStart` false
  — a mid-cast resume — and it is also the corpus's only cast with no covering
  focus. **Two anomalies, one cause**, which is a better fact than my number was.

---

## The clock and the ledger

Written **2026-08-23, 11:32 PT**. The ledgers rolled at 11:00 and session 85 ended
offline by your directive, so **12 run-units and 20 casts are fresh and unspent.**

`doctor.ts` first. §1 and §2 need neither.

*⚠ `preflight.ts` (~90s) after committing fixtures, before the push.*

---

## 1. Open question 3, answered: the blind arm never moves its focus. Not once

Session 85 noticed `SIM blind` was byte-identical at w=0 and w=3 and asked whether
that is a real structural fact or a wiring bug. **It is structural, and it is
larger than the question.**

I reproduced the invariance first — same 7641 plays, same 3261 hits, same modes,
same counts, to every printed digit, while the bare arm moved 80.8% → 85.1% hit
and −3.437 → −3.783 drift. Then I instrumented the focus meter directly, 400 casts
per arm through `observeTurn`:

```
  arm                        turns   turns that MOVED focus   total focus spent
  BLIND (matcherPool: [])  w=0  2363          0    (0.0%)            0
  BLIND (matcherPool: [])  w=3  2363          0    (0.0%)            0
  BARE  (default pool)     w=0  2223        752   (33.8%)         1047
  BARE  (default pool)     w=3  2069        713   (34.5%)          913
```

**Zero. Not one focus move in 2,363 turns.** A term that prices focus *movement*
cannot bind on a policy that never moves — so the invariance is a tautology, not a
bug, and session 85's "away" readings on the other arms are unaffected by it.

**The mechanism is in the repo's own comment** (`castSim.ts:370-374`): with
`matcherPool: []` the sim "has always fallen back to UNIFORM regardless of any
real transition data ... hardcoded". A uniform distribution makes EV identical at
every focus of the same footprint, so the argmax never has a reason to move — and
never does.

### 1a. What that means beyond the question

**`SIM blind` is a no-aim arm, not a bad-predictor arm, and its name says the
wrong one.** "Blind matcher" reads as a bot with a weak predictor; this is a bot
that places its focus at (2,2) and leaves it there for the entire cast. Live
spends **0.85 on the opening play alone** in today's era, and 1.55 before it.

Three things follow, and the third is the one that bites:

1. **Every deck-sweep baseline was measured on a bot that never aims** — session
   83's 36.42%, session 78's 41.06%. That is not wrong for a deck comparison, but
   it is not a fishery anyone plays in.
2. **It explains session 84's "the blind arm is the only one on live's side of
   zero", and the explanation is the opposite of encouraging.** No aiming → low
   damage per hit (3.66 against live's 5.06) → break-even lifted to 47.3% →
   positive drift. **It matches live's sign for the reason live does not.**
   Session 84 already flagged the sign-vs-mechanism trap; this is the mechanism.
3. **`castSim.ts:370-372` records that `matcherPool: []` is "the condition
   session 14 established as representative of real live Dendren play".** On the
   dimension gate 2 measures, it is not: live moves its focus, this arm never
   does. **That sentence is fourteen sessions old and load-bearing** — it is why
   the blind arm gets used as a live proxy at all. It should carry the 0/2363
   beside it.

---

## 2. The redraw revisit — what §1 changes about it

The user gated §26's shadow evaluation behind revisiting the CLOSED verdict, and
session 85 is right that the content is already measured and this is **not**
another counterfactual run. It is an argument put to the user. **§1 adds one thing
to it, and it is not small.**

**There is no sim arm that could re-derive 43.9 honestly.** The two candidates:

```
  SIM bare    margin +41.9pp over its own break-even, ORACLE matcher (matcherPool
              defaults to truePool — it can identify the true pattern by
              construction), redraws 27-61% of turns
  SIM blind   never aims (§1), 0 focus spent in 2363 turns, damage/hit 3.66
              against live's 5.06
```

Neither is a fishery the live bot plays in, and they fail in opposite directions.
**So "re-derive the price properly in sim" is not an available option** — the
corpus is the only instrument that describes the bot. That is worth saying in the
memo explicitly, because "we should just re-run it properly" is the obvious
objection and the answer is that there is nothing to re-run it on.

**What the memo should carry, each with its instrument and its distance from
live:**

- **The verdict on record:** 43.9 mana per extra fish against a 10-mana pool.
  Instrument: `SIM bare`, margin **+41.9pp**, redraw rate 27–61% against a shipped
  threshold that wants one on ~3.5% of turns.
- **Mana is not the binding resource.** 147 resolved casts, **89.8% end with mana
  unspent**, mean 5.85, median 7. Instrument: the corpus. Distance from live:
  none — it *is* live.
- **The binding resource is fish-HP headroom** — 6.8 HP, heal 3, ~2.3 net misses —
  and **a redraw takes no shot, so it cannot miss.**
- **Today's era, the counterfactual:** dead hands 11.8% of plays, rescue **15 of
  15**, `neither = 0`, mean cost **1.33 mana**, availability 88.2% → 97.6%.
  **Uncertainty: n = 15, 95% CI [79.6%, 100.0%]** — the weak point, and it should
  lead rather than trail.
- **Still unpaid:** the two correctness gaps (the client discards the redraw's
  `FISH_MOVED`; `MAX_REDRAWS_PER_CAST` is not the `MAX_TURNS` guarantee), both
  live-path edits.

**The recommendation is the user's to accept or refuse, and the order is their
directive: revisit first, instrument second.** Do not write shadow
instrumentation before the answer comes back.

---

## 3. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6, predicates in code.

1. **The blind arm's zero focus movement is pinned, and the arm is labelled for
   what it is.** Reproduce **0 of 2363 turns / 0 points at both weights**, and
   the bare arm's **1047 → 913** as the control that proves the instrument works.
   Put the 0/2363 beside `castSim.ts:370-372`'s "representative of real live
   Dendren play", and beside `damageEconomy.ts`'s printed label for that row.
   **A pin that does not also record the bare arm's movement has not shown the
   probe can see movement at all.**
2. **The redraw memo exists and, for every quantitative claim in it, names the
   instrument and that instrument's distance from live** (§2) — and states the
   rescue rate as `15/15, 95% CI [79.6%, 100.0%], n = 15` wherever it appears,
   never as a point. Delivered to the user as a recommendation, with the
   two unpaid correctness gaps priced.

Not gated, do if there is room: whether the blind arm's never-moving focus makes
`focusReserveAblation.ts`'s session-45 sweep partly vacuous — its live-config arm
is a different arm, but the sweep's framing should be checked against §1.

**What would make these unmeetable:** nothing for gate 1. Gate 2 is a document,
so its gate is its content, not its conclusion — **the memo may recommend keeping
redraw closed and still meet it.**

---

## 4. The live budget — fresh, and the captures are unchanged

12 run-units, 20 casts, all unspent. Each dungeon run needs its own go-ahead; rule
11 terms unchanged; rule 13 after every one; `--dry-run` first — the dungeon path
has not executed since session 82.

- **`finishRun`'s `EV support: n/m` line has still never printed on a real run.**
  It was built in session 78, found unreachable in session 82, fixed in session
  84, and has not been exercised. One juiced run prints it.
- **One base-6/8/10 crit** finishes the crit rule; card 10 (crit 10) is in the
  deck — ×1.5 → 15 against ×1.6 → 16. `critEffects`, not `hitEffects`.
- **An oil at a non-zero meter** settles add-2 vs restore-to-2, and it is getting
  *harder*: today's bot reaches meter 0 on 1.5% of plays. If it matters it may
  have to be arranged, and arranging it is a live-policy deviation — the user's
  call, not something to quietly set up.
- **Ordinary casts** still buy the most: today's era is 54 casts / 202 plays and
  §2's whole case rests on 15 dead hands inside it.

---

## 5. Do not

- **Do not read the blind arm as a live proxy on anything focus-related** (§1a).
  Its 42.7% hit rate is card zones at a fixed point, with no aiming in it.
- **Do not change any default**, including renaming the blind arm's *behaviour*.
  Gate 1 is a pin and a label, not a fix.
- **Do not write the shadow instrumentation** before the user answers §2. Their
  directive is revisit first.
- **Do not present §2's 15/15 as 100%.** n=15.
- **Do not re-derive 43.9 on a sim arm** (§2) — there is no arm that could.
- **Do not un-suspend +19.40pp.** §0a stands, and gate 2's FAIL at both weights
  did not move it.
- **Do not resume the off-policy replay** — session 85's §27 recommendation to
  hold it stands, and §1 does not change it.
- Standing, none re-opened: do not build H2's proc model; no M4 lines;
  `DEFAULT_POTION_THRESHOLD` / `chooseNewCard` UNTOUCHED; `boonCapture` OFF; no
  429 backoff without an observed 429; do not shuffle the random-sample deck; do
  not complete the corrode perpetual table; do not import `todaysEraCastIds()`
  into a committed test.
- **Do not start a dungeon run without `--dry-run`, `doctor.ts` and a per-run
  go-ahead**, and never chain runs.

---

## 6. Corrections to me

- **I claimed what a file does without opening it, for the second time in five
  sessions.** `redrawCounterfactual.ts` has no simulator in it and I put it in a
  gate. Session 74 §7 wrote the rule — *any claim in a brief about what code does
  gets the file opened before the sentence is written* — and I have now broken it
  on `policyApproved` and on this. **The pattern is that I break it on the
  supporting claims, never on the measurement**, because the measurement is the
  part I actually run.
- **"Nobody has asked" is a claim about the repo's history and I made it without
  searching.** `focusReserveAblation.ts` has existed since session 45. The
  narrow version was true and would have cost one grep.
- **§1 is a case where I did run it**, and the finding is bigger than the question
  because the probe was direct — instrument the meter rather than infer from
  summary statistics. **That is the whole difference between this section and the
  two above it.**
- **Rule 9 applies.** §1's counts are from `c8a144d` with `npm ci` and no
  `data/`; a run that disagrees wins.

---

## Your task (session 86)

1. `doctor.ts` first. **12 run-units and 20 casts are fresh.**
2. **§1 / gate 1** — pin the blind arm's zero focus movement with the bare arm as
   its control, and label the arm where it is described as representative of live
   play.
3. **§2 / gate 2** — the redraw memo, every claim carrying its instrument and that
   instrument's distance from live, the rescue rate always as an interval.
   Deliver it and stop; the answer is the user's.
4. **§4** — only with a go-ahead. One juiced run would print the `EV support` line
   for the first time.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` after committing
   fixtures and before the push**, no test writes a real data path, secret scan.

**Honest expectation.** §1 is a small pin sitting under a large fact: the arm this
repo has used as its stand-in for live play since session 14 does not do the one
thing the last three sessions have been measuring. **The satisfying version of
this session is gate 1 landing and the memo going out clean.** The unsatisfying
one is that gate 1 prompts a re-audit of every figure the blind arm has ever
produced — the deck sweep, the noise floor, the drift margin — and that is a
larger job than one session. **If that is where it goes, stop and hand it
forward rather than half-doing it**; the pin and the label are what make the
re-audit possible later, and they are cheap.
