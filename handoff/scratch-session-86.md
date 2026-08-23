# scratch — session 86 — surprises as they landed

- **The brief's "2363 turns" is a STATE count, not a turn count.** `observeTurn`
  emits one state per turn taken PLUS the terminal state, so 400 casts give
  2363 states = 1963 turns. Every movement figure in the brief (0/0, 752/1047,
  713/913) reproduced EXACTLY on the first run, which is what identifies this
  as the same measurement with a different denominator rather than a near miss.
  At a numerator of zero the rate is zero either way; corrected because the
  next reader will divide. Pinned as an identity (`states === turns + casts`).

- **The decision-level probe is stronger than the meter-level one the brief
  ran.** Wrapping the policy and comparing the chosen focus cell against
  `focusBudget.current` shows the blind arm's 763 plays all fire from (2,2) —
  ONE cell in 400 casts. Meter moves and aimed plays agree exactly on all four
  arms (0/0, 752/752, 713/713), so the two readings corroborate.

- **⚠ THE FINDING'S OBVIOUS GENERALISATION IS FALSE, and I nearly shipped it.**
  I wrote "a blind arm never aims" into `castSim.ts` before checking the
  brief's own not-gated question. `matcherPool: []` is necessary and NOT
  sufficient:

      matcherPool: []                     0 moves / 1963 turns
      matcherPool: [] + empiricalFish     0 moves / 1963 turns
      matcherPool: [] + ringModel       824 moves / 2492 turns
      matcherPool: [] + blindFallback   838 moves / 2443 turns
      mined + blindFallback (live cfg)  829 moves / 2346 turns

  The condition is a UNIFORM distribution, not a blind matcher. So
  **`focusReserveAblation.ts`'s sweep is NOT vacuous** — its arm A is blind
  WITH a ring model. Pinned portably on a synthetic step-class table so the
  overclaim cannot come back.

- **The no-aim arm's whole decision sequence is fish-blind, as an exact
  identity.** Turning `empiricalFish` on changes which shots land (313 -> 353
  hits) and moves the turn count, play count and redraw count by ZERO. It
  plays the same cast against any fish.

- **Not a param artefact.** On `castSim`'s own defaults — `deckObjectiveSweep`'s
  configuration, the arm whose 36.42% baseline the brief flags — the same arm
  reads 0 moves in 1944 turns, 840 plays, all at (2,2).

- **`damageEconomy.ts` already had a §4b** (the verdict block). The new probe
  section took §4b and the verdict moved to §4c; nothing outside that file
  references either.

- At `REAL_PARAMS` the blind arm caught **0 of 400** casts (it redraws 61% of
  its turns and mana-outs). Noted, not chased — `deckObjectiveSweep` runs
  different params, so its 36.42% is not this number.

- **§4 / live: OFFLINE BY USER DIRECTIVE, second session running.** Asked what
  to do with the fresh 12 run-units and 20 casts, the user chose to stay
  offline and recap. **Zero live spend.** Nothing was denied or interrupted, so
  there is no rule-13 ledger discrepancy to reconcile. `doctor.ts` passed at
  the top of the session (token valid 116h, ledgers 0/0 recorded locally).
  Standing captures carry forward untouched: the base-6/8/10 crit, an oil at a
  NON-ZERO meter, and `finishRun`'s `EV support: n/m` line, which has still
  never printed on a real run.

- **The memo's numbers are computed on the corpus AS IT STANDS** (148 traces,
  612 plays). That is a reason the offline choice was the clean one: new casts
  would have moved every pinned corpus figure in the same session the memo went
  out.
