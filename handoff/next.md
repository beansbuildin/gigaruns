# BRIEF — session 35

Session 34 landed clean: 516/516 tests (+6), `tsc` clean, GATE PASS. It
shipped CODEXIMPROVE #4 in the two stages the brief asked for: a
provably non-regressive charge-reserve tie-break in `decide()` first
(exact, not an expectation — charges depend only on our own move, not the
enemy's reply), then a `chargeReserveWeight` continuation term in
`utility()`, ablated (not guessed) at N=20000-60000/weight across two
seeds, shipped at `0.4` — the low-risk edge of a real, reproduced
plateau (0.4/0.5/0.6 mutually indistinguishable, all separated above the
zero control and above 0.2/0.8). `LIVE_CONFIG` inherits it automatically.
Fishing account is still stuck exactly where session 33 left it
(`docId 12957129`, checked read-only, unchanged) — still QUESTIONS.md §15,
still needs a human DevTools capture, still not blocking dungeon work.

---

## This is the last open item on both Codex docs

CODEXIMPROVE #4 landing means the full cross-referenced backlog from both
`CODEXREVIEW` (10/10 resolved) and `CODEXIMPROVE` (#1, #2, #3, #4, #6
resolved) is down to exactly one remaining item: **#5, boon valuation**.
After this session, if it lands, there is no more standing Codex backlog
— worth being extra careful about not shipping something half-right just
to close it out. If anything in §1 below turns out to need more than one
session, say so and leave it queued rather than forcing a GATE PASS this
document doesn't actually support.

---

## 1. Rank confirmed boons by their actual deltas, and preserve play counts (CODEXIMPROVE #5)

Relevant code, re-checked against the current tree:

- `src/strategy/loot.ts:92-175` — `rankBoons()`. Confirmed live, all four
  of the original findings still hold exactly as Codex described:
  - `"pool"` case (`:129-141`): `score = 25 * Math.min(1, roomsRemaining / 8)`
    — every max-pool boon gets the identical score regardless of
    `option.val1`.
  - `categorise()` (`:54-62`): `AddMaxHealth` and `AddMaxArmor` both match
    `POOL_PREFIX = "AddMax"` and fall into the same `"pool"` category,
    despite a real mechanical difference this project already confirmed
    and documented — see below.
  - `"upgrade"` case (`:143-153`): `score = 40 * share * Math.min(1, roomsRemaining / 4)`
    — reads `playCounts` share correctly, but never reads `option.val1`/
    `val2`, so an ATK upgrade and a DEF upgrade of the same move score
    identically.
  - **Important standing caveat, unchanged, do not quietly drop it**:
    `loot.ts`'s own header says this module is "UNVALIDATED, and it
    cannot be validated yet" — no scored corpus run has ever reached a
    second boon decision (`deepestScorableRoom` gates this), so there is
    no real outcome to fit the ranking to. Whatever this session ships,
    that disclaimer stays honest and in place unless the corpus itself
    changes — don't remove or soften it just because the heuristic got
    better-informed.
- `src/sim/boons.ts` — the mechanical deltas ARE already correctly
  modelled and confirmed, this session's fix does not need to re-derive
  them: `AddMaxArmor` (`:159-172`, `effect: { kind: "maxArmor" }`) grows
  `armorMax` only, current `armor` does NOT auto-fill (`14/16 → 14/20`,
  live-confirmed session 11). `AddMaxHealth` (`:200-209`,
  `effect: { kind: "maxHealth" }`) grows `hpMax` AND moves current `hp`
  with the new ceiling — "a genuine mechanical difference, not an
  inconsistency to paper over" (existing comment). `applyBoon()` (search
  for the `maxHealth`/`maxArmor` cases in this file — the exact function
  boundaries have shifted from the doc's original `:296-333` citation
  since this file has grown with new live captures across many sessions;
  find it fresh rather than trusting that line range) already applies
  both correctly. This session's job is to make `loot.ts` USE this
  existing, correct information — not to fix `boons.ts` itself.
- `scripts/liveRun.ts:612` — `const playCounts: Record<MoveKey, number> = { rock: 0, paper: 0, scissor: 0 };`,
  local to `runOnce()`, confirmed still zeroed on every invocation with
  no persistence. Incremented at `:834`, passed to `rankBoons` via
  `opts.playCounts` at `:903`. Resuming an active run therefore forgets
  the move distribution logged earlier in the SAME run, despite that
  distribution being exactly what the `"upgrade"` case's `share` is
  supposed to rank against.

**Implementation requirements, per CODEXIMPROVE's spec:**

1. Scale the `"pool"` and `"upgrade"` scores by their actual confirmed
   deltas (`option.val1`/`val2`) instead of a flat category constant.
   Keep the existing `roomsRemaining` weighting structure — this is about
   making the MAGNITUDE responsive to the real offer, not replacing the
   shape of the heuristic wholesale.
2. Split `AddMaxHealth` out from `AddMaxArmor`'s scoring, using the same
   distinction `boons.ts`'s `effect.kind` already encodes: credit
   `AddMaxHealth` for the immediate usable HP it grants (same "usable,
   not raw" framing the existing `"heal"` case already uses at
   `:124-126` — reuse that pattern rather than inventing a second one),
   and do NOT credit `AddMaxArmor` with armor it doesn't fill. This can
   stay inside `categorise()`/`rankBoons()`'s existing category
   structure (e.g. a `type === "AddMaxHealth"` special case ahead of the
   generic `"pool"` fallthrough) rather than requiring a new
   `BoonCategory` value, if that's the smaller diff — your call, but
   don't lose the `"pool"` bucket's existing behavior for every OTHER
   `AddMax*` type this project hasn't seen yet.
3. Persist or reconstruct per-run `playCounts`, keyed by the dungeon run
   ID (check what real run identifier `liveRun.ts` already reads off the
   dungeon state doc — there should be one, since resume logic elsewhere
   in this file already has to recognize "this is the same run" for
   other purposes; use that, don't invent a second identity scheme).
   Follow the established persistence pattern this project has now built
   three times (`guardPersistence.ts`, `opponentModelPersistence.ts`,
   and now this): schema-versioned, atomic temp-file + rename, reuse
   `acquireGuardLock()` rather than a fourth locking mechanism. Delete
   the persisted counts when the run ends (win, death, or flee) — this is
   per-run state, not a running total across runs, and the doc is
   explicit about deleting it, not just letting it go stale.
4. For CLEAN, modelled boons only (i.e. `effect.kind !== "latent"` and
   not an unmodelled/unknown type): clone the player, call `applyBoon()`,
   and compare a short next-room rollout or continuation value — this is
   the one piece of this item that CAN get a sim-based signal despite the
   live corpus never reaching a second boon decision, the same way
   session 33's fishing ablation and session 34's charge-reserve ablation
   both used synthetic/simulated data rather than waiting on live
   corpus depth. Frame any such ablation the same way those two did:
   "does the new ranking logic prefer the objectively better option in a
   controlled comparison," not a live claim, and keep it as a genuinely
   separate, clearly-labeled check from the corpus-validation status
   above — one does not fix the other.
5. Keep the existing conservative fallback (today's flat-score heuristic)
   for latent/unmodelled boons, unchanged. Do not infer mechanics from a
   boon's name to improve apparent sim coverage — same standing rule this
   project has enforced since DECISIONS 2026-08-15, restated in both
   Codex docs.

Report this the way the doc itself frames it: "a targeted policy
improvement," not a proven rooms-cleared gain — the boon corpus is still
sparse and `deepestScorableRoom` hasn't moved. That's an honest scope,
not a weaker one.

---

## Your task

1. §1 (CODEXIMPROVE #5) is the whole scope this session, staged as
   written above: read real deltas into the pool/upgrade scores first,
   then the `AddMaxHealth`/`AddMaxArmor` split, then `playCounts`
   persistence, then (if time allows within this session) the
   clean-boon rollout comparison as a separately-labeled sim check. If
   the rollout-comparison piece doesn't fit this session, ship steps 1-3
   with tests and leave step 4 explicitly queued rather than rushing it —
   this is the last standing Codex item, not a reason to cut a corner to
   close it.
2. Do not touch or soften `loot.ts`'s existing "UNVALIDATED, cannot be
   validated yet" header disclaimer unless the real corpus itself now has
   a scored second-boon decision (it doesn't, as of session 34).
3. Add regression tests for every scoring change — same standard as every
   prior Codex item in this run: a same-category boon with a bigger
   `val1` should score higher than a smaller one; `AddMaxHealth` should
   score differently than an `AddMaxArmor` offer with the same `val1`;
   `playCounts` persistence should survive a simulated resume and reset
   between two different run IDs.
4. Recap normally, full suite + `tsc` against the final commit as usual.
   If this closes out both Codex docs' entire backlog, say so plainly in
   the STATE.md status line — that's a real milestone for this project,
   not just another session.

---

## Queued, not this session

- **QUESTIONS.md §15** (stuck fishing account after an escape) — still
  needs a human DevTools capture, not code. Worth a cheap read-only
  `scripts/checkFishingStuck.ts` check at the start of the session before
  ruling out any live fishing smoke test, same as session 34's instinct,
  but this session's actual work (boon valuation) is dungeon-side and
  unaffected either way.
- Task 14 (bot-initiated juiced `start_run`) still BLOCKED on a live
  DevTools capture — still needs a manual juiced run captured whenever
  convenient, not code work.
- The scheduler still can't learn about energy gained outside its own
  tracking, and a single SIGINT during an energy-regen sleep still ends
  the whole session (unchanged since session 25, not re-queued as an
  action item, just still true).
- The charge-reserve plateau (0.4/0.5/0.6, mutually indistinguishable at
  the N this project has run) was not narrowed further — not urgent, only
  worth revisiting if a much larger ablation N or a sharper metric is
  ever worth the compute.
