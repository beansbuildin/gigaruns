# BRIEF — session 79 — the deck is shuffled

## 0. How this was checked, and session 78's verification

Fresh clone at `e7607bc`, `npm ci`, no `data/`, `logs/` or `~/.secrets`.

```
npx tsc --noEmit                     clean
npx vitest run   Tests  1498 passed | 13 skipped (1511)   89 files
npx tsx scripts/assertionCoverage.ts   1498 counted, 0 vacuous
```

**Session 78's three gates hold on independent re-run.** The deadline, the
transaction protocol, and the EV-support logging are all in and all sound. The
`preflight`-caught synthetic JWT and the response — *"the scanner was right and
no allowance was added"* — is the right call and worth keeping as precedent.

**Everything below is one finding.** It is measured from `fixtures/` alone, needs
no live play, and it changes what several suspended numbers mean.

---

## The clock and the ledger

Written **2026-08-22, 12:18 PT**. **Both ledgers rolled at 11:00 PT and session
78 spent nothing** — user directive, no live play. So as of writing there are
**12 run-units and 20 casts available, unspent, and the window closes at 11:00 PT
tomorrow.** Three sessions running have been offline; this is the first that is
offline only by choice.

`doctor.ts` first, both ledgers, report them. §1 needs neither.

*⚠ Pre-session-77 SHAs are dead. Cite the tip. `npx tsx` and `git` fail under the
command sandbox — run unsandboxed. `preflight.ts` (~90s) is the last check before
a push, not an optional one (session 78's own dead end).*

---

## 1. `castSim` draws the deck in order. The server shuffles it. This has never been true

### 1a. What session 78 found, and the half of it that is wrong

§4's deck sweep returned a diagnosed null and the diagnosis is right about the
**simulator**: `castSim.ts:388`'s `drawHand` walks `deck[idx % deck.length]` from
`drawIdx = 0`, so a card appended to the end is never reached in a ~5-turn cast.
Verified.

STATE.md then generalises it to the game:

> *"on the real 23-card deck only the first ~8 cards are ever seen — an appended
> card is **unreachable by construction**."*

**That sentence is false, and the corpus already says so.** It is a property of
`drawHand`, not of Dendren.

### 1b. The measurement — 129 live opening hands, from committed fixtures

Every live fishing state carries `fullDeck`, `hand`, `nextCardIndex`,
`cardInDrawPile` and `discard`. I took every state where
`nextCardIndex === hand.length` — i.e. the opening hand of a cast — across
`fixtures/fishing-casts/live/`:

```
opening hands examined                     129
hand === fullDeck[0..2]                      0      ← sequential draw predicts 129
distinct fullDeck orderings                 38
states with nextCardIndex                  721
states where nextCardIndex > fullDeck.length  0     ← the pile never exhausts in this corpus
```

**Zero of 129.** Three opening hands from the same directory on the same
ten-card deck `[1,2,3,4,5,6,7,76,77,79]`:

```
state-000   hand [6, 3, 1]      nextCardIndex 3   discard []
state-006   hand [2, 77, 1]     nextCardIndex 3   discard []
state-009   hand [79, 76, 4]    nextCardIndex 3   discard []
```

and the next draw inside the first of those is `[79, 4, 5]`, not `fullDeck[3..5]`
= `[4,5,6]`.

On that deck alone, 31 opening hands, by deck position:

```
pos          0    1    2    3    4    5    6    7    8    9
card id      1    2    3    4    5    6    7   76   77   79
in opening  13    8    5   16    6   10    7   13    7    6      / 31

uniform shuffle predicts 9.3 each   → χ² = 13.5, df 9, NOT rejected (crit 16.9)
sequential-from-0 predicts 31,31,31,0,0,0,0,0,0,0
```

**Positions 7, 8 and 9 — the tail — appear in opening hands 13, 7 and 6 times.**
And the one 23-card deck in the corpus opened with cards from positions 0, 2, and
14-or-later. There is no positional decay of any kind.

`deckCardData` is also in canonical order (it is the card *metadata* list), so the
shuffled pile is **not exposed on the wire**. `fullDeck` is a roster;
`nextCardIndex` indexes a hidden shuffled pile.

**The server shuffles. `castSim` has never modelled that, on any figure it has
ever produced.**

### 1c. What this costs, and it is not confined to M3

The simulated bot always holds the same first three cards of a fixed order and
draws the same next three after that. The real bot holds a random three of ten to
twenty-three. **Every `castSim` number is computed on a hand distribution the bot
never faces**, which touches:

- catch rate, `escaped_mana`, `escaped_meter`, turns per cast;
- **the redraw price** — session 75's 263.0 → 43.9. A real redraw returns three
  *fresh random* cards; the sim's returns the deterministic next three. The
  measured 43.9 is a number about the wrong draw model;
- the oil sweeps and the focus profile — already suspended by `OIL-POLICY.md`
  §0a, now for a **third, independent** reason;
- `shouldRedraw`, `chooseCard`'s EV, and every threshold derived from them.

**This is a plausible contributor to the §0a suspension itself.** §0a records the
sim reading catch ~70% and meter-out 1.0% against a real 27.6% and 64.2%. A sim
that always draws its best-ordered opening hand and never faces a bad one would
over-catch and never run its meter out, which is the shape of that gap. **I am
not claiming it explains §0a — I am claiming it is the first named mechanism that
could, and it is testable.**

### 1d. The fix is measured, not invented — which is the crux

Session 78 declined to shuffle, and the reasoning is recorded as a dead end:

> *"Shuffling the deck in `castSim` to unblock M3. Not done: the ranking would
> become an artifact of an invented draw model and would look exactly as
> authoritative as a real one."*

**That was the right instinct applied to a wrong premise.** Sequential draw is not
the conservative default and shuffling is not the invention — **it is the other
way round.** `drawHand`'s fixed order is an unexamined assumption that the corpus
falsifies at 129/129; a per-cast shuffle is what the corpus shows.

What to build, and it is small:

1. **Shuffle the deck once per cast**, from the cast's own seeded rng, before the
   first `drawHand`. Draw sequentially from the shuffled pile exactly as now —
   that matches `nextCardIndex` advancing 3, 6, 9.
2. **Validate it against these 129 opening hands.** A test that runs the sim over
   the corpus decks and asserts the opening-position distribution is consistent
   with the live one (and that sequential draw fails the same test) is a real
   ratchet, not a vibe check. The numbers in §1b are the target.
3. **Keep `drawHand` itself.** Only the pile's order changes. One mechanism, not
   two — the same discipline session 75 used on the redraw's `turn++`.

**State the limits in the code, because I hit two:**

- **Per-cast vs per-draw shuffle is not distinguished by this corpus.** Both
  reproduce the opening-hand statistics. Per-cast is the simpler hypothesis and
  matches `nextCardIndex`'s monotone advance; say so rather than implying it was
  measured.
- **Reshuffle on exhaustion is UNOBSERVED.** `nextCardIndex` never exceeds
  `fullDeck.length` in 721 states (max ratio 0.92), so `drawHand`'s
  `idx % deck.length` wraparound is unvalidated. It rarely fires on real decks.
  Leave it, mark it.

### 1e. CAPTURE-3 is already answered. Retract it

STATE.md open question 2 says CAPTURE-3 *"is answerable by ordinary fishing casts
and would unblock M3"*, wanting *"enough consecutive casts on one deck to see
whether hands repeat in deck order."*

**Thirty-one consecutive opening hands on one deck are already committed, and they
do not repeat in deck order.** The question is answered; spending casts on it
would re-measure something the repo already holds. **Close CAPTURE-3 with §1b's
table** rather than carrying it as a capture request.

What CAPTURE-3 *could* still usefully ask, if anything: a `fullDeck` read either
side of a loot pick, to confirm where an added card lands in the roster. That is
one line of a normal cast's log and does not justify a session.

### 1f. M3 after the fix — unblocked, still suspended

Once the pile shuffles, an appended card is as reachable as any other and the
deck sweep can be re-run meaningfully. **Do not let that become a live change.**
`chooseNewCard` ranking 79/80 was measured in the *prepended* arm, which is not
what a loot pick does; after the fix the appended arm is the right one and the
number will move. It remains a `castSim` result under §0a. Report it, mark it
suspended, change nothing live. Rule 4.

---

## 2. What to do with the suspended figures now that there is a third reason

`OIL-POLICY.md` §0a suspends every Δ because the sim's bare arm does not
reproduce the fishery. Session 76 added the redraw fix as a second invalidation.
**§1 is a third, and it differs from the other two in a way that matters: it is a
named, fixable modelling error rather than a calibration gap.**

So the standing advice — *mark, do not re-derive* — should get one amendment:

> **After the shuffle lands, the profile check that §0a names as its precondition
> becomes worth attempting for the first time.** Not the oil sweep — §0a forbids
> re-running that on the current instrument by name, and that stands. The profile
> check: does `castSim` now reproduce the fishery's catch rate and meter-out rate
> within a stated band?

If it does, §0a's suspension has a path to lifting and a great deal of shelved
work comes back. If it does not, that is a stronger result than today's — the gap
survives its first named cause, and the next hypothesis has to be somewhere else.

**Do not quote +19.40pp either way. Do not re-run the oil sweep.**

---

## 3. Session 78's own open items

- **Fishing's in-cast writes are the last unrouted class** (`play_cards`, loot,
  oil, redraw). Session 78 asks whether it is worth a pass given no daily ledger
  moves. **Yes, but after §1** — and the honest justification is not the ledger,
  it is that `resolvePendingCardOffer` is a one-off recovery for one stranding
  state, and *one-off recovery per state* is the shape §2 of last session
  replaced. It is a small increment on machinery that already exists.
- **The oil policy approval** (`dendren.oils.policyApproved` still FALSE) is a
  user decision, and §1 argues for *not* raising it yet: the timing policy was
  derived on the pre-shuffle simulator. **Ask after the profile check, not
  before.** The user's answer that `use_fishing_item` neither advances the fish
  nor costs mana closes §1's mechanic questions but not the timing.
- Carried: low-assertion review; crit-source separation with one-lure casts;
  what re-derives +19.40pp; `nextPosition` tripwire still unmet; session 72's oil
  gate row still failing.

---

## 4. The live budget — 12 units and 20 casts, and §1 changes what they are for

**Available now, unspent, expiring 11:00 PT tomorrow.** Every item needs its own
go-ahead; rule 11 terms unchanged (60-energy juiced, `--juiced-index=3`, 3× Big
Heal Juice, `--runs=1`, stop and hand back). Rule 13 after every run. `--dry-run`
first — the dungeon path has not executed since session 75.

**§1 re-orders what the casts are worth.** CAPTURE-3 no longer needs them (§1e).
What does:

- **The forced Relaxing consume** — carried since session 73, now six sessions.
  The user has *answered* the two mechanic questions; a cast would **verify** the
  answer against a live response, which rule 1 says wins over any stated fact.
  That is a smaller prize than it was a week ago, and it is honest to say so.
- **Ordinary casts are now worth more than they were**, because §1's fix wants
  validation data: more opening hands on known decks, especially a deck longer
  than ten, directly tighten §1b's distribution. **This costs nothing extra —
  it is a property of casts the bot plays anyway.**

**One juiced dungeon run** would seed §3-of-last-session's `evSupported` telemetry
with real rule-8 co-occurrence data, which is what turns CAPTURE-1's ordering from
guessed into measured. That is a real use for one run-unit and is the only dungeon
item I would argue for.

---

## 5. Gate

**Offline, deterministic, no live budget, no `data/`.** Rule 6.

1. **`castSim` draws from a shuffled pile**, shuffled once per cast from the
   cast's own seed, and a test over the corpus decks asserts the simulated
   opening-hand position distribution is consistent with §1b's live one **and
   that the old sequential draw fails that same test.** Demonstrated by running
   it both ways, as session 75 demonstrated the redraw fix.
2. **CAPTURE-3 is closed in `TASKS.md`** with §1b's table as its answer, and the
   deck sweep is re-run on the shuffled pile with its result recorded as
   SUSPENDED under §0a. **A re-run that does not carry the suspension label does
   not meet this gate.**

Not gated, do if there is room: §3's in-cast transaction routing; §2's profile
check if §1 lands early — but **do not start the profile check until the shuffle
is pinned by gate 1**, or it measures two changes at once.

---

## 6. Do not

- **Do not treat the shuffle as an invented model** (§1d). It is measured at
  129/129; the fixed order is the assumption.
- **Do not change `chooseNewCard`**, and do not quote the re-run deck ranking
  without §0a's suspension attached (§1f).
- **Do not re-run the oil sweep on the current instrument**, before or after the
  shuffle. §0a forbids it by name. **Do not quote +19.40pp.**
- **Do not raise `policyApproved`** (§3).
- **Do not claim the shuffle explains §0a's gap** until the profile check says so.
  §1c states it as the first named candidate mechanism, not as the cause.
- **Do not implement reshuffle-on-exhaustion** — unobserved in 721 states (§1d).
- **Do not build H2's proc-branch model**; do not write M4's `observe`/`turn++`
  lines; do not touch `DEFAULT_POTION_THRESHOLD`; do not re-raise rule 7's 429
  backoff without an observed 429 (all settled, sessions 77–78).
- **Do not start a dungeon run without `--dry-run`, `doctor.ts`, and a per-run
  go-ahead**, and never chain runs.
- Do not present a `castSim` result as evidence about live play. Do not read
  session 75's run 4 against runs 1–3. Do not give a new I/O-owning test
  construction a real data path. **Run `preflight.ts` before pushing.**

---

## 7. Corrections to me

- **I triaged the Codex review and told session 78 that M3 was "the best item in
  the review... readier than it says", and it was not ready at all.** The
  simulator it had to be built on draws the deck wrong. I checked that the card
  catalog existed and did not check that the thing consuming it modelled the
  draw. **A harness is only as ready as the model underneath it, and I verified
  the input and skipped the mechanism.**
- **Session 78 found the real obstacle by building the thing anyway**, which is
  the better failure — a null with a diagnosis attached beat my confident go.
  Its only error was generalising a simulator property to the game, and it is a
  small error sitting on top of a good measurement.
- **I have now spent three briefs advising deferral of the fishing items on the
  grounds that they cost nothing to defer.** §1 is a reason that was available in
  `fixtures/` the entire time and would have been found by anyone who asked what
  the live opening hands looked like. **The corpus answers more questions than it
  is asked.**
- **Rule 9 applies.** §1 is a measurement over committed fixtures; if a live
  response disagrees, the live response wins and the correction goes in the
  recap.

---

## Your task (session 79)

1. `doctor.ts` first, both ledgers. **They rolled at 11:00 PT and are unspent.**
2. **§1 / gate 1** — shuffle the pile once per cast, pin it with a corpus-validated
   test that the old draw fails.
3. **§1e / gate 2** — close CAPTURE-3 with the measurement, re-run the deck sweep
   on the shuffled pile, record it SUSPENDED.
4. **§2** — if gate 1 lands early, attempt §0a's profile check. Not before.
5. **§3** — fishing's in-cast writes, if there is room.
6. **§4** — only with a per-run go-ahead: one juiced run to seed the `evSupported`
   telemetry is the dungeon item worth arguing for; casts are worth more than
   they were and CAPTURE-3 no longer needs them.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, **`preflight.ts` before the push**, no
   test writes a real data path, secret scan before handoff.

**Honest expectation.** §1 is a one-line change to `drawHand`'s caller wrapped in
a real validation test, and it will move a lot of numbers. The satisfying version
is that the shuffle lands, the profile check narrows §0a's gap, and shelved work
comes back. **The likelier and more useful version is that the gap barely moves** —
sim catch ~70% against a real 27.6% is a wide chasm for one draw-order fix to
close — and then the finding is that the fishery's difficulty lives somewhere the
deck model was never hiding it, with one more candidate eliminated by measurement
instead of assumption. Either way, do not let the deck sweep's re-run become the
session; it is a consequence of gate 1, not a rival to it.
