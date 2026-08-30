# BRIEF — session 112 — offline wrap-up while the dungeon ledger resets, three decisions to record, two real fixes

**This document replaces the session-111 `next.md`.** Session 111 already
recapped: the Tier-2 tier switch GATE PASS (documented in CLAUDE.md,
STATE.md, DECISIONS.md; live cost read off `entryData`), but the live-run
half DID NOT RUN — `dayProgressEntities` read 12/12 all session, the 11:00
Pacific reset hadn't arrived. **The Tier-2 wire check (confirming the seven
negative `gameItemBalanceChanges` on `start_run` match `entryData`) is still
owed and is NOT this session's job to force** — see Step 4.

**Before doing anything below, read STATE.md's "Settled — do not re-open"
digest.** Nothing below should duplicate an entry in it.

**Zero live spend is the point of this session**, except opportunistically
at the very end if the reset has genuinely passed by then (Step 4) — don't
wait idle for the clock, do the offline work below first.

---

## Step 1 — record three decisions the user just made, directly in chat

None of these are new investigation — they're user rulings on questions
STATE.md had carried as open for multiple sessions. Record each with today's
date in `DECISIONS.md` (matching the format every other dated ruling in that
file uses) and update the STATE.md digest / relevant `QUESTIONS.md` entries
to reflect them as answered, not open.

1. **`nextPosition` override: KEPT ACTIVE, formally approved.** It had been
   live and steering fishing card choice for seven sessions on self-armed
   validation data (22/22 hits, Wilson lower bound 85.1%) with no sign-off.
   The user's ruling: keep it running. Record this as the sign-off rule 11's
   spirit (and STATE.md open question 4, carried sessions 105-111) was
   waiting on. No code change — it's already live — this is documentation
   catching up to a decision.
2. **`LossBlockUp`: approved to model as `latent` from n=1**, same precedent
   as `LossIntuitionUp` (session 99). QUESTIONS §64 has the evidence (whole-
   object diff, only `pickedBoons` differs) — implement it the same way
   `LossIntuitionUp` was implemented, same file, same pattern. Add the
   regression case the way every other single-pair boon model in this repo
   has one.
3. **Oil policy: re-derive the approved on-demand policy — do NOT adopt the
   double-lethal override.** The user's exact framing, worth keeping intact
   in the DECISIONS entry: *"make a note of this decision today so we can
   track results if they change, the current 60-70% catch rate is the ideal
   target. We just want to make sure oils aren't being wasted."* This is
   Step 2 below, not just a documentation entry — the investigation is real
   work, do it before writing the decision up as resolved.

## Step 2 — why did the on-demand oil trigger never fire, and are oils being wasted?

Session 110's 22 casts produced zero firings of the approved on-demand
trigger (`fishHp <= 2`, `src/strategy/fishing/oilTiming.ts`, rule-4 approved
policy) and seven double-lethal firings (14 oils) from the override the sim
does not recommend. This needs a real answer, not just a re-statement of the
gap:

1. **Determine whether the on-demand trigger's condition genuinely never
   arose, or whether the double-lethal override is intercepting cases
   before on-demand gets a chance to fire.** Read the actual call order in
   `liveFishing.ts` — does double-lethal check run first and consume the
   decision point, or are they independent checks against the same board
   state? Use session 110's own fixtures (22 real casts,
   `fixtures/fishing-casts/live/cast-2026-08-30-*`) to reconstruct what
   `fishHp` was at each decision point and whether on-demand's condition was
   ever true and simply never acted on.
2. **State plainly which of these it is:**
   - The condition never arose (fishHp never sat at <=2 without also being
     double-lethal) — in which case there's no waste, the two triggers are
     just rarely both-eligible, and the "gap" is a data artifact, not a bug.
   - The condition arose and something suppressed it — in which case find
     and fix that, it's a real bug.
3. **Check for waste specifically**, since that's the user's stated
   concern: any oil spent where a cheaper/no oil outcome would have caught
   the same fish, or any oil spent that didn't affect the outcome. Use the
   existing oil-timing sim tooling (`scripts/oilTimingSweep.ts`,
   `scripts/oilDoubleLethalSweep.ts`) against the real corpus rather than
   inventing new analysis.
4. **Do not silently re-enable or adjust the double-lethal override's
   priority** — the user's ruling was to re-derive the on-demand policy,
   not adopt the override. If the investigation concludes the on-demand
   policy itself needs a parameter change (not just documentation) to
   actually engage, that's a new finding to report, not something to ship
   without saying so plainly in the recap — a live-behavior change still
   needs the same rule-4 discipline (sim first, then approval) the original
   policy got.
5. Write the DECISIONS.md entry for this once the investigation is done,
   including the user's target framing (60-70% catch rate, oils-not-wasted)
   so a future session can check results against it.

## Step 3 — two carried code tasks that need zero live spend

1. **`chooseNewCard` deck-composition term (TASKS.md §13).** Card 84 has no
   on-grid footprint and has now been looted twice as a guaranteed miss —
   second observed instance, STATE.md session 111 open question 7. TASKS.md
   §13 has the task definition; it has never been started. This is ordinary
   feature work against `src/strategy/fishing/cardChoice.ts` and the
   existing corpus — no live spend required to implement or test.
2. **The fishing guard counter over-count** (STATE.md open question 8,
   carried from session 107: `runsStarted` read 25 against a 22-played /
   20-charged batch). This is the same *class* of bug as the day-key
   straddle just fixed this session (`guardPersistence.ts`, `DAY_MEMO`) —
   in-process counter state disagreeing with the server ledger — so start
   by checking whether it's actually the SAME root cause re-surfacing under
   a different symptom, or a genuinely separate counting bug, before
   designing a fix. If it's separate, follow the same discipline QUESTIONS
   §65 used: design the fix, pin it with a regression test replaying
   session 107's actual numbers, and state explicitly whether the failure
   direction is safe (over-counts, blocks) or unsafe (under-counts,
   over-spends) — that framing is what made the straddle fix safe to ship
   without a live re-test.

## Step 3b — if time remains: the Tier-1/Tier-2 baseline question

STATE.md open question 3, unactioned for seven sessions: session 103's
Tier-3 numbers aren't comparable to Tier-1 or Tier-2 on any payout
statistic, and several reports/docs still quote them without that caveat.
This is a documentation audit, not new measurement — grep
`handoff/reports/`, `TIER1-RESULT.md`, and any other doc that cites
session 103's Hard Core figures, and add an explicit non-comparability note
wherever a raw number appears without one. Do not attempt to normalize or
convert the numbers across tiers — just make the incomparability visible
everywhere it currently isn't. Lower priority than Steps 1-3; do this only
if the suite/tsc/scan cycle for the above is done with room to spare.

## Step 4 — opportunistic only: the Tier-2 wire check, IF the reset has actually passed

**Do not wait for this.** Finish Steps 1-3 first. Only after that, check
`npx tsx scripts/checkDungeonToday.ts` once. If the daily reset has genuinely
occurred (dungeon ledger shows headroom below 12/12), the standing
authorization from session 111's brief still applies — one Tier-2 run,
`--dry-run` first, then live, with the specific gate that session 111 could
not meet: **confirm the seven negative `gameItemBalanceChanges` on
`start_run` match `entryData`'s `inputItems`/`inputAmounts`
(`[134,137,138,135,136,139,140]`, all amount 1) exactly**, then re-read
silver ring balances after. Stop after that one run — standard rule 11, no
chaining, wait for a fresh go-ahead before a second. If the ledger still
reads 12/12, say so and stop; do not poll for it repeatedly.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan (`scripts/secretScan.ts`, quote its own summary verbatim the way
session 111 did). State explicitly, at the top of the recap:

- The three decisions recorded, each dated, each in `DECISIONS.md`.
- Step 2's actual finding: which of the two explanations it was, whether
  any oil waste was found, and whether the on-demand policy itself needs a
  follow-up change (flagged, not shipped without separate approval).
- Whether `chooseNewCard` §13 and the fishing guard counter fix landed, and
  their test coverage.
- Whether Step 4 happened (reset had passed) or didn't (still 12/12) —
  either is a fine outcome, just say which.
