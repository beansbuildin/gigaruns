# BRIEF — session 31

Session 30 landed clean: 479/479 tests (+25), reporting live for both
loops, the `9001`/`9002` mystery resolved (session 28's own
`fishingCorpus.test.ts` was writing to the real `data/fish-patterns.jsonl`
instead of a temp path — fixed, 14 pollution records cleaned out, nothing
mined was ever actually affected). Real reward fields confirmed against
live captures before the report code was written: Hard Core = item 845 via
`gameItemBalanceChanges`; "Dendren Root" = item 846, wire name "Dendren
Remnant"; fishing catches come from `data.events[]` `FISH_DIED`, not the
documented-but-always-null `doc.data.caughtFish`. Also caught and fixed
before shipping: `IS_JUICED_CID` is an account-level flag mirrored onto
every entity (true on all 47 corpus attempts) — the real per-run signal is
`WANTS_JUICED_MODE_CID`.

No live play in sessions 29 or 30 — both were pure engineering. This
session returns to the CODEXREVIEW/CODEXIMPROVE queue that's been sitting
untouched since session 28. Three items, ordered safety-then-performance
per this project's standing priority discipline, plus a documentation-sync
bundle and one small wiring fix.

---

## 1. Split committed-vs-observed energy accounting (CODEXREVIEW #8)

Relevant code: `scripts/liveRun.ts:1154-1168`, `scripts/liveFishing.ts:
733-740`, `scripts/orchestrator.ts:239-245, 272-278`.

Currently the guard tracks spend as a raw before/after energy delta.
In-run regen partially masks the entry cost; an external top-up (e.g. a
ROM claim happening mid-session) can mask it entirely. Persistent policy
spend can drift below what was actually committed, which is a real gap in
the daily-budget guard, not just a cosmetic accounting issue.

Track two numbers separately:
- **Committed spend**: the confirmed `energyCost` the moment `start_run`
  succeeds — independent of what happens to the account balance after.
- **Observed delta**: the before/after account reading, kept as a
  diagnostic for spotting drift (e.g. "committed 20, observed delta 12" is
  a useful signal that a ROM claim landed mid-run), not as the ledger of
  record.

Enforce the daily-budget guard off committed spend. Add a test where an
external balance change (simulate a ROM claim) happens between a run's
start and its accounting step, and confirm the guard still records the
full committed cost rather than the masked delta.

## 2. Resource-conserving fishing tie-breaks (CODEXIMPROVE #2)

Relevant code: `src/strategy/fishing/cardChoice.ts:124-163, 211-224`,
`src/sim/fishing/geometry.ts:60-69, 83-84`.

`bestFocusForCard()` only replaces the current best on strictly greater
EV, so equal-EV placements resolve by grid enumeration order, not by
distance from the current focus point — meaning the bot can spend scarce,
non-regenerating focus for zero immediate benefit. Same issue in
`chooseCard()` across non-lethal cards: equal-EV choices stay in hand
order even when one costs less mana or less focus movement.

This is a safe change — it cannot reduce immediate expected value, only
break ties in favor of conserving a scarce resource. Codex's suggested
smallest implementation:

```ts
const EPSILON = 1e-12;

if (Math.abs(candidate.ev - best.ev) <= EPSILON && focusBudget) {
  const candidateCost = manhattan(focusBudget.current, candidate.focus);
  const bestCost = manhattan(focusBudget.current, best.focus);
  if (candidateCost < bestCost) best = candidate;
}
```

Across cards, deterministic lexicographic order: lethal before non-lethal,
higher EV (or EV/mana under the existing mana-constrained branch), lower
focus movement cost on a tie, lower mana cost on a further tie, existing
hand/grid order as the final tie-break.

Add tests proving an equal-EV stationary focus beats a moving focus, and
an equal-EV cheaper card beats a costlier one. Do not go further than this
tie-break — Codex explicitly flagged a focus shadow-price or lookahead
term as a separate, unvalidated experiment; don't fold that in here.

## 3. Documentation sync bundle (CODEXREVIEW #9, #10 + session 30's open question 1)

Three small, independent doc/cleanup fixes — bundle them since none needs
its own session:

- **CODEXREVIEW #9**: `CLAUDE.md`'s non-negotiable §8 says `pickSafeTier()`
  and halts when Safe isn't offered; `src/strategy/enemyTier.ts` actually
  implements the generalized `pickLowestTier()` because Safe is often not
  on offer, and `liveRun.ts` correctly uses the generalized version. This
  is real behavior, correctly implemented — the doc is what's stale. Update
  CLAUDE.md's wording to "always choose the lowest tier actually offered,"
  referencing `pickLowestTier()` by name, so the repo's own shared memory
  stops contradicting the code that's actually running.
- **CODEXREVIEW #10**: `viem` is listed in `package.json` but unused
  anywhere in `src`, `scripts`, or tests (confirm this is still true before
  removing — Task 14's juiced `start_run` work is still blocked on a live
  capture, not on signing code, so it shouldn't have landed yet). Remove it
  if still unused.
- **Session 30 open question 1**: fold the reward-field discoveries (Hard
  Core = item 845, "Dendren Root"/"Dendren Remnant" = item 846, fishing
  catch source = `data.events[]` `FISH_DIED` not `doc.data.caughtFish`)
  into `SPEC.md`/`SPEC-fishing.md` directly, resolving the existing
  `[VERIFY]` tags on these fields rather than leaving the findings only in
  code comments and DECISIONS.md.

## 4. Wire standalone report regeneration (session 30 open question 4)

Currently `handoff/reports/*.md` only regenerate at
`scripts/orchestrator.ts`'s end-of-session rollup. Task 6/9's standalone
`liveRun.ts`/`liveFishing.ts` invocations don't trigger it, so a
non-orchestrator session leaves the committed reports stale until someone
remembers to run `dungeonReport.ts`/`fishingReport.ts` by hand. Decision:
wire regeneration into the end of standalone invocations too (same
non-fatal-on-failure pattern already used in the orchestrator), rather
than relying on a stated manual convention — automation is cheap here and
a stale committed report is worse than a redundant regeneration.

---

## Your task

1. §1 (energy accounting) first — it's the one safety-adjacent item left
   in the queue.
2. §2 (fishing tie-breaks) — self-contained, low risk, ship with tests.
3. §3 (doc sync bundle) and §4 (report wiring) — quick, do both if time
   allows; don't let them crowd out §1/§2.
4. Don't start CODEXIMPROVE #1 (opponent-model persistence) this session —
   it's the single biggest remaining item (schema versioning, atomic
   writes, bootstrap from historical fixtures, restart tests) and deserves
   its own focused session rather than being squeezed in. Queued for
   session 32.
5. Recap normally, full suite + tsc against the final commit as usual.

---

## Queued, not this session

- **CODEXIMPROVE #1** (persist/bootstrap dungeon opponent model) — session
  32, per above.
- **CODEXIMPROVE #3** (previous-direction contextual fishing fallback) —
  the strongest empirical fishing predictor Codex found (33.9% vs 16.4%
  top-1 accuracy), but needs its own cross-validation + simulator ablation
  pass, not a quick add.
- **CODEXIMPROVE #4** (charge-reserve tie-breaking for dungeon) and **#5**
  (boon valuation using real deltas + persisted `playCounts`) — both
  well-scoped in CODEXIMPROVE, neither urgent.
- Task 14 (bot-initiated juiced `start_run`) still BLOCKED on a live
  DevTools capture — needs the user to do a manual juiced run and capture
  the real request body whenever convenient. Not code work, just flagging
  it's still sitting there.
