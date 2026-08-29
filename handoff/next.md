# BRIEF — session 107 — fishing only, budget raised to 25 casts / 300 energy per day

**This document replaces the session-106 `next.md`.** Session 106 is executed
and closed — Part A (1 fishing cast) did NOT run, correctly blocked by the
repo's own exhausted 252-energy budget; Part B (4 Tier-1 dungeon runs) GATE
PASS, H1 CONFIRMED (STATE.md session 106, `handoff/TIER1-RESULT.md`). **Before
doing anything below, read STATE.md's "Settled — do not re-open" digest.**
Nothing in this brief should duplicate an entry in that digest — if anything
below looks like it might, that's this brief being wrong, not the digest
being stale.

**This session is fishing only. No dungeon work is authorized here** — rule
11 requires its own explicit go-ahead per run regardless of what any other
brief says, and none is given in this one.

---

# The budget change — read this before running anything

**`config/bot.json`'s `dendren.dailyEnergyBudget` and `maxCastsPerSession`
are raised, by explicit user directive given directly in chat: 252 → 300,
20 → 25.** This is already committed to the config, not something to decide
or re-derive this session. The comment on `_dailyEnergyBudgetComment107`
explains why and should not be edited except to append, per the file's own
convention.

**What this does and does not mean:**

- It directly answers STATE.md's carried-forward open question 2. Session
  106 could not spend its one requested cast because the repo's old
  252/252 ceiling was already exhausted (session 105's 21 casts) while the
  GAME's own ledger (`dayDocs[pondId 2]`) still read 19/20 — JEBAITOR (§34,
  CLOSED) makes ~9% of casts not count against that ledger, so more casts
  get **played** than get **charged**, and the old budget was sized as if
  every cast charged 1:1.
- **300/25 is headroom, not a new real cap.** `dendren.maxCastsPerDayJuiced`
  (`config/discovered.json`) is still the game's own **20 charged casts/day**
  limit, and the server-side preflight remains the true, binding gate exactly
  as before. This budget raise cannot buy a cast the server would refuse; it
  only stops the *repo* from refusing one the server would still allow.
- **If today's batch stops before 25 casts, that is expected, not a bug —
  say so plainly rather than treating it as a shortfall.** It means one of
  two ordinary things happened: the game's real 20-charged-cast ceiling was
  reached (`dayDocs` hit 20/20), or JEBAITOR simply didn't proc enough times
  today to open extra headroom above it. Do not read a sub-25 count as
  evidence the new budget is wrong or insufficiently raised.
- This is **not** licence to raise the budget further this session, or to
  treat today's raise as inviting a bigger ask next time. It's a specific,
  dated response to a specific mechanism (JEBAITOR), not an open door.

---

# The fishing batch

1. **Confirm before assuming, on every axis — do not carry forward session
   105/106 numbers.**
   - `npx tsx scripts/checkFishingCaps.ts` first — read `dayDocs[pondId 2]`
     for today's actual remaining casts, whatever today's date is when this
     runs. Confirm the repo now reads the raised 300/25 ceiling, not the old
     252/20 — if it still shows the old numbers, the config didn't take and
     that's a stop-and-report condition, not something to patch around.
   - Read current rod durability before casting. Last read **37** at the
     session-106 preflight (repaired to 40 in session 105, one cast since).
     Confirm live rather than assuming.
2. `--dry-run` first, per standing rule-4 discipline.
3. Run the batch under the already-shipped, already-autonomous policy — no
   new approval needed for any of this:
   - On-demand Relaxing-Oil-only necessity gate, composed with the
     double-lethal band (shipped) — do not re-derive it.
   - Redraw stays disabled (`redrawEnabled: false`) — CLOSED per digest; log
     the shadow trigger as usual, it changes nothing live.
   - Size the batch to whatever `checkFishingCaps.ts` and the rod durability
     reading actually allow, up to the new 25-cast / 300-energy ceiling —
     this is not a request for exactly 25; take the real number from the
     live reading, same discipline session 105/106 used for the rod.
4. Take a durability reading immediately after the batch.
5. Report at standard depth: catch rate with a binomial CI against the era
   baseline, opening-turn focus spend, oil spend under the shipped policy,
   necessity-gate opportunity count, and how many casts were actually
   **played** vs actually **charged** to `dayDocs` (the JEBAITOR gap) — this
   is the number the budget raise exists to capture cleanly, so report it
   explicitly even if the gap is zero.
6. If any cast comes back denied, blocked, or interrupted, **re-read
   `checkFishingCaps.ts` before reporting anything** — rule 13 stands
   regardless of which resource is at issue, and applies equally to the new
   ceiling.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan. State explicitly, at the top of the recap:

- Casts played vs. casts charged to `dayDocs`, and which ceiling (game's
  20-charge cap, or simply running out of durability/opportunities) actually
  stopped the batch, if it stopped short of 25.
- Catch rate with CI, oil spend, necessity-gate opportunities, post-batch rod
  durability.
- Confirmation the new 300/25 budget was read correctly from
  `config/bot.json` and behaved as a non-binding headroom ceiling rather than
  the constraint that bound.
- **Carried forward, unresolved:** STATE.md's open question 1 (the
  `nextPosition` override is live and steering card choice with no user
  sign-off — this brief does not authorize or revoke it, just flag it again)
  and open question 3 (whether the Tier-1 arm is now the baseline for
  downstream dungeon reports — out of scope for a fishing-only session, but
  don't let it go unmentioned a third time).
