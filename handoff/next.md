# BRIEF — session 106 — 1 fishing cast, then up to 4 juiced Tier-1 dungeon runs (pause + fresh go-ahead between each)

**This document replaces the session-105 `next.md`.** Session 105 is executed
and closed — both its parts GATE PASS, STATE.md session 105. **Before doing
anything below, read STATE.md's "Settled — do not re-open" digest and the
relevant `DECISIONS.md` blocks (2026-08-27 rule-11 amendment, "stable going
forward" gear ruling).** Nothing in this brief should duplicate an entry in
that digest — if anything below looks like it might, that's this brief being
wrong, not the digest being stale.

---

# Part A — one fishing cast

1. **Confirm before assuming, on every axis — do not carry forward session
   105's numbers.**
   - `npx tsx scripts/checkFishingCaps.ts` — read `dayDocs[pondId 2]` for
     today's actual remaining casts, whatever today's date is when this runs.
   - Check the repo's own `dailyEnergyBudget` (252, `config/bot.json`)
     against energy already spent **today**. Session 105 exhausted it exactly
     (21 casts, 252/252) on 2026-08-28. If this brief executes before the
     11:00 Pacific rollover clears that, the repo guard will refuse the cast
     even though only 1 is requested — that is a real, expected block, not a
     bug, and it is **not** licence to raise the 252 budget unilaterally
     (rule 12's ask-first list covers spending above a configured budget).
     Surface it in the recap and stop; don't self-approve a bump.
   - Read current rod durability before casting. Repaired to 40 in session
     105 (digest) — confirm the live reading rather than assuming it's still
     40.
2. `--dry-run` first, per standing rule-4 discipline.
3. Run exactly **1** cast under the already-shipped, already-autonomous
   policy — no new approval needed:
   - On-demand Relaxing-Oil-only necessity gate, composed with the
     double-lethal band (shipped) — do not re-derive it.
   - Redraw stays disabled (`redrawEnabled: false`) — CLOSED per digest; log
     the shadow trigger as usual, it changes nothing live.
4. Take a durability reading immediately after.
5. Report at standard depth even at n=1: outcome (caught/escaped), any oil
   spend under the shipped policy, whether the necessity gate had an
   opportunity (and fired or withheld), post-cast durability.
6. If the cast comes back denied, blocked, or interrupted, **re-read
   `checkFishingCaps.ts` before reporting anything** — rule 13 stands
   regardless of which resource is at issue.

---

# Part B — dungeon: Tier-1 juiced entry, 0 rings, one run at a time, up to 4 today

This is potentially the **first live Tier-1 entry-tier run(s)**. Every fact
below is already settled (STATE.md digest; CLAUDE.md rule 11's 2026-08-27
amendment; `handoff/TIER1-MEASUREMENT.md`) — none of it is new work to derive,
only to execute correctly.

## What "Tier-1 offering" means — confirmed, not ambiguous

- **`--juiced-index=1`.** `index` is the **TIER value**, read off
  `entryData[].tier` — it is **not an array position**. `entryData` is
  returned ordered tier **2, 1, 3**, so array position 1 happens to equal
  Tier-1 by coincidence, array position 0 is Tier-2, and there is no
  position 3. **Match on `entryData[].tier`, never by array index.** A
  positional "fix" would silently select Tier-2 and spend silver rings —
  this is exactly the mistake the digest already flags as wrong.
- **Zero rings: `inputItems: []`.** Confirm the *actual* `start_run` request
  body sent `index: 1` and `inputItems: []` — do not assume the flag
  guarantees it; log and report the real body (TIER1-MEASUREMENT.md §6.3).

## The other three rule-11 conditions are unchanged by going to Tier-1

`index` (entry tier) and `isJuiced` are independent axes — Tier-1 does not
mean non-juiced:

- **Still 60 energy, juiced** — `--juiced`, `JUICED_COST_MULTIPLIER` 3 against
  the 20-energy base. Charges 3 of the day's 12 run-units per run.
- **Still auto-loads 3x Big Heal Juice** (itemId 131,
  `config/bot.json` → `forbiddenWoods.potions`, `maxPerRun: 3`) — that gate
  reads `--juiced` alone and is unaffected by `index`.
- **One run, then stop and hand back. Never chain.** `--runs=1`, every
  invocation.

## The pause between runs is not a formality

Per rule 11: *"approval for one run is never approval for the next."* **This
brief is the go-ahead for run 1 only.** After each run:

- Stop and report that run's result before doing anything else.
- The user allocates skill points between runs (never allocate them
  yourself) and decides whether/when to run the next one.
- Do **not** auto-continue into run 2, 3, or 4 just because this brief names
  4 as the target for the day — that number is the day's *plan*, not
  standing pre-authorization. Treat each of runs 2-4 as needing its own
  explicit resume from the user, exactly like run 1 needed this brief.
- If the user doesn't reconvene for a later run, report however many of the
  4 actually happened — that is a normal outcome, not a shortfall.

## Ledger and loadout discipline, every run

- `npx tsx scripts/checkDungeonToday.ts` before run 1 and again after
  **every** run (`dayProgressEntities`). Daily ceiling is 12 run-units / 3 =
  **exactly 4 juiced runs/day** — so 4 requested runs is the whole day's
  allotment. If any run is denied, blocked, or interrupted, re-check the
  ledger before reporting anything (rule 13) — do not assume it didn't run,
  and do not re-issue it on the strength of the denial alone.
- Record the gear reading (`hp`/`armor` max) before run 1 and re-check it
  before each later run. Keep the loadout stable across the whole batch —
  that's what makes all 4 runs one comparable arm rather than several
  confounded ones (the "stable going forward" ruling, DECISIONS 2026-08-27;
  TIER1-MEASUREMENT.md §3).
- In-room tier picks still follow rule 8 (highest non-Perpetual tier;
  lowest / no-modifiers at the final room) — the entry-tier choice governs
  `start_run` only, not the per-room `enemyPathOptions` picks.

## Apply the pre-registered measurement plan (`handoff/TIER1-MEASUREMENT.md`)

Written session 105, zero live spend against it so far. This batch is what
executes it — and it's what answers STATE.md session 105's **open question
3** ("should the first live Tier-1 run be run"), so say so plainly in the
recap.

Per run, capture in this order: the ledger before/after; the gear reading;
the actual `start_run` body (confirm `index: 1`, `inputItems: []`);
`dropMultiplier` as returned on the entry actually used (don't assume 1
because the flag said 1); rooms cleared (the tier-choice count, **not** the
death room); Hard Core (845) and Dendren Root (846) totals.

- **Score H/r** (Hard Core per room cleared) against the fixed decision rule:
  **< 500 → H1 confirmed** (`dropMultiplier` governs Hard Core, ~1/4 as
  derived); **500-800 → inconclusive**; **> 800 → H0** (the multiplier does
  NOT govern Hard Core). **Validity condition `r >= 6`** — a run that dies in
  room ≤ 5 is recorded but not scored, not argued into a verdict.
- **Run the negative control every run.** Dendren Root per room should stay
  flat at ~62/room regardless of the Hard Core verdict (it answers to
  `isJuiced` alone, per SPEC §3c/§3f). If Root *also* falls ~4x, that
  falsifies the `dropMultiplier`-specific story even though Hard Core moved
  the "right" way — report that plainly instead of calling it H1.
- One valid run already suffices per the pre-registration. With up to 4 in
  hand, report whether they agree with each other before pooling — pool only
  if the spread between runs is small relative to the H1/H0 gap (same
  caveat session 103's two gear arms needed), and say explicitly if it
  isn't.
- Update the "~quarter of Tier-3" figure from **derivation** to **measured**
  (or correct it) based on what actually comes back. Until this batch, it
  may not be quoted as observed — that constraint lifts only once real
  numbers exist.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`), `tsc --noEmit`, `git diff --check`, secret
scan. State explicitly, at the top of the recap:

- The fishing cast's outcome and post-cast durability reading — or, if
  blocked by the exhausted 252-energy repo budget, that fact plus the
  ledger check that confirmed it.
- How many of the (up to) 4 dungeon runs actually happened, and why if fewer
  than 4.
- Per run: the `start_run` body confirmation (`index: 1`, `inputItems: []`),
  rooms cleared, Hard Core and Dendren Root totals, H/r, and the individual
  verdict.
- The pooled verdict (if pooling was valid) against H1 / inconclusive / H0,
  and the Dendren Root control result.
- **Carried forward, unresolved — this brief does not settle either:**
  STATE.md session 105's open question 1 (the `nextPosition` override is now
  live and steering card choice with no user sign-off) and open question 2
  (JEBAITOR makes the 252-energy fishing budget the binding constraint
  again — raise it or accept losing ~1-2 casts/day). Both are ask-first;
  flag them again rather than deciding either silently.
