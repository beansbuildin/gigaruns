> **SUPERSEDED 2026-08-25.** Folded into `handoff/next.md` §1 as a firm part
> of session 97's assignment — per the user's explicit instruction, this is
> no longer a "whenever convenient" document. Kept here only as the
> detailed derivation reference `next.md` §1 points back to. **Work from
> `handoff/next.md`, not this file.**

# BRIEF — re-derive and wire the oil necessity gate under today's live composition

**A fourth independent offline document**, alongside `handoff/next.md`
(executed), `handoff/next-ev-per-step.md` (§27, unstarted), and
`handoff/next-catch-rate.md` (§39-adjacent diagnostic, unstarted). No
dependency in either direction with the other two open ones — but read
`next-catch-rate.md`'s open item on the §2c oil-trigger tripwire before
starting §2 below, since this brief may resolve it as a side effect.

**Not zero live spend, but small and gated.** §1–§3 are offline (re-sweep in
sim, no live spend). §4 (shipping) touches `config/bot.json` and
`scripts/liveFishing.ts` and changes what the NEXT live batch actually
spends — that's a real behavior change, not a live cast itself, and is
already user-approved in direction (QUESTIONS.md §39). Do not run a live
batch as part of this brief; that's the next fishing session's job, after
this ships.

---

## Where this came from

QUESTIONS.md §39: the user approved, in direction, the necessity-gating
policy `handoff/OIL-CONSERVE.md` derived in session 67 — skip an oil spend
when the bot's own model already shows it can catch the fish without one.
That approval is **not** a green light to paste the old
`conserve(r=1,f=1)` numbers into `liveFishing.ts` unmodified. Two live
things changed since session 67's sweep and neither was accounted for in
it:

1. **`config/bot.json`'s `dendren.oils.allowedItemIds` is `[937]` only**
   (session 93, RELAXING-OIL-ONLY). The old sweep priced both a Relaxing
   gate and a Focus gate; only the Relaxing half matters live today.
2. **`doubleLethalTriggers` is live** (session 90, §30), and it composes
   with `onDemandTriggers`, not with `conservingOil` — the two gate
   functions in `src/strategy/fishing/oilTiming.ts` were built as siblings
   (both wrap `onDemandTriggers` directly, lines ~600 and ~694) and nothing
   anywhere says what "necessity-gated Relaxing spend, still capable of a
   double-lethal same-turn spend when the band calls for it" actually does.

This brief is that re-derivation, plus the wiring, plus a normal
verification gate — not a re-litigation of whether to do it at all.

---

## 1. Re-price the Relaxing-only necessity gate on its own, not as half of a two-oil table

`handoff/OIL-CONSERVE.md` §3 already isolated this once — "the Relaxing
gate is free… identical catch rate… for 1182 fewer oils (−21%)" — but that
was measured with Focus Oil still live alongside it and the double-lethal
layer not yet built. Re-run `scripts/oilConserveSweep.ts` (or a
relaxing-only variant of it) with:

- `allowedItemIds` restricted to `[937]` in the sweep's simulated
  configuration, matching live.
- `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` (currently `1`) re-checked
  against the bimodal `bestKillProbability` distribution table
  (`OIL-CONSERVE.md` §4) — confirm the plateau shape still holds
  relaxing-only, don't assume it transfers unchanged from the two-oil
  sweep.
- Report catch rate and oils-per-cast/oils-per-extra-fish exactly as
  `OIL-CONSERVE.md`'s tables do, so the numbers are directly comparable to
  the ones already on record, not a differently-shaped report that's hard
  to cross-check.

## 2. Derive how the necessity gate composes with `doubleLethalTriggers` — this does not exist yet and has to be written, not assumed

`src/strategy/fishing/oilTiming.ts`:

- `onDemandTriggers` (line ~180) is the shared base both `conservingOil`
  (line ~600) and `doubleLethalTriggers` (line ~694) wrap independently.
- `doubleLethalTriggers` layers a same-turn double-Relaxing-spend in the
  HP band where one oil can't finish the fish but two can, when the bot's
  own best affordable card can't guarantee the kill this turn — using
  `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` as its own default
  `relaxingThreshold` parameter already (line ~697), which is a promising
  sign the two were designed to be compatible, but it has never been
  proven and never tested composed.

Write the composition explicitly — either a new function that applies the
necessity gate first and then evaluates the double-lethal band on what
survives, or confirm (with a test, not an assertion in a comment) that
calling `doubleLethalTriggers` with a necessity-gated base produces the
intended behavior. Whichever shape it takes, pin it with a test the way
every other policy in this file is pinned (`tests/fishing/oilNecessity.
test.ts` is probably the right home, or a new sibling file if the
composition warrants its own coverage).

Sweep the composed policy the same way §1 does, and report where it lands
relative to: today's shipped `doubleLethalTriggers`-over-`onDemandTriggers`,
and the Relaxing-only necessity gate alone from §1. State plainly whether
composing costs anything relative to the gate alone — it might, if the
double-lethal band and the necessity check ever disagree about the same
turn — and if so, by how much.

## 3. Check whether this resolves (or explains) the §2c oil-trigger tripwire

`next-catch-rate.md` (if not yet run) or `STATE.md` session 96 records: the
§2c clean-cast tripwire fired, 9 of 10 clean casts exceeding a
pre-registered threshold of 6 against the model's ~0.70 oils/cast
assumption (~1-in-900 event). That assumption was almost certainly built on
`onDemandTriggers`'s ungated firing rate. If §1's re-sweep shows the
necessity gate cuts oils/cast by roughly the ~20% `OIL-CONSERVE.md`
originally measured, **recompute what the tripwire's threshold would have
been under the gated rate** and check whether session 96's 9/10 still looks
anomalous against it, or whether it was actually consistent with a gate
that hadn't shipped yet. Report this explicitly either way — "the tripwire
and this gate are unrelated" is a fine answer too, but it has to be
checked, not assumed one way or the other (rule 9 applies to this
session's own reasoning, not just to the brief that requested it).

## 4. Ship it

Once §1–§3 hold up:

- Swap the live trigger call in `scripts/liveFishing.ts` from whatever
  currently calls `onDemandTriggers`/`doubleLethalTriggers` to the composed,
  necessity-gated version from §2.
- Update `handoff/OIL-CONSERVE.md`'s own title and opening line — it
  currently says "derived, awaiting the user's approval" and "Nothing here
  has been consumed live and nothing here is shipped," both of which stop
  being true the moment this lands. Don't leave a shipped policy's own
  design doc claiming it isn't shipped — that's exactly the kind of stale
  status line QUESTIONS.md §39 exists to stop happening again.
- Add a QUESTIONS.md **§40** entry (not a rewrite of §39 — §39 recorded the
  approval, §40 records the shipping) stating what was actually wired, the
  re-derived numbers from §1–§2, and the §2c tripwire finding from §3.

---

## Do not

- **Do not skip §1–§2 and wire the old session-67 numbers directly.** They
  were measured under a configuration (both oils, no double-lethal) that no
  longer exists live. The user approved the *direction*, not a specific
  unverified number.
- **Do not run a live fishing batch as part of this brief.** Sim/offline
  re-derivation and the code change are in scope; testing it live is the
  next fishing session's job, after this ships and passes its own
  verification gate.
- **Do not touch the Focus Oil trigger or `allowedItemIds`.** Session 93's
  RELAXING-OIL-ONLY directive stands untouched; this brief is scoped to the
  Relaxing gate only, per §1.
- **Do not treat §3 as optional.** If the tripwire and this gate turn out to
  be connected, saying so (or ruling it out) is part of what makes this
  brief worth doing rather than just a code change with no diagnostic
  value.

---

## Your task

1. Re-price the Relaxing-only necessity gate in sim, matching today's live
   `allowedItemIds: [937]` configuration.
2. Write and test the composition of the necessity gate with
   `doubleLethalTriggers` — this doesn't exist yet.
3. Check the composed policy's numbers against the §2c oil-trigger
   tripwire and report whether they're connected.
4. Wire it live, update `OIL-CONSERVE.md`'s stale "not shipped" framing,
   and record a QUESTIONS.md §40 entry with what actually shipped.
5. Normal recap: suite, `tsc --noEmit`, `git diff --check`, secret scan.
