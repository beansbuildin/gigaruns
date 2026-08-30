# BRIEF — session 113 — confirm & fix the Tier-2 ring model, disable the oil override, then fishing (up to 25) then the remaining 3 dungeons

**This document replaces the session-112 `next.md`.** Session 112 closed with
a real correction still incomplete: the Tier-2 ring-cost paragraph in
CLAUDE.md was fixed once (from "one of each of seven" to "measured 3 of one
faction, unseparated from the multiplier, rotation unconfirmed") but the
user has now supplied the missing piece directly. **Before doing anything
below, read STATE.md's "Settled — do not re-open" digest.** Nothing below
should duplicate an entry in it.

---

## Step 1 — confirm and implement: Tier-2 costs 3 of ONE faction, and the faction rotates daily

**User's direct statement, given in chat, to be treated as ground truth and
implemented, not re-derived from scratch:** *"the tier 2 ring cost is 3x of
one faction per juiced run, and each day the faction changes, that's why it
was described as one of the seven factions."* This resolves STATE.md
session 112's open question 1 and explains `entryData[].inputItems` holding
all seven faction ids at `inputAmounts: [1,...]` — that's the set of
*possible* factions the day-selection can land on, each at a base amount of
1, multiplied by the juiced multiplier (3) for whichever one is active
today. It is not "sum all seven" and it is not "read entryData literally as
the bill."

1. **Update CLAUDE.md rule 11's cost paragraph again** — this is now the
   THIRD state that paragraph has been in (7-rings-of-each → measured-3-
   unseparated → this). Follow the file's own convention: keep the prior
   wrong/incomplete versions struck through with their dates, add this
   version as the current one, dated today, citing that it's a direct user
   statement resolving what session 112 left open.
2. **Fix `scripts/checkEntryTiers.ts`'s runway math to model rotation, not a
   static per-run cost.** The correct model: each calendar day, exactly ONE
   faction is charged, 3 rings per juiced run that day (up to 12/day at the
   4-run/day cap). The runway is therefore bounded by whichever faction has
   the least stock **relative to how often the rotation lands on it**, not
   by a flat "min balance / 3-per-run" figure. Since the rotation's exact
   period/order is still unconfirmed (session 112 only observed one day,
   Foxglove), the honest thing to compute and print is: current per-faction
   balances, days-of-runway IF that faction were hit every day (a
   worst-case per-faction figure), and an explicit statement that the
   TRUE runway depends on the unconfirmed rotation order. Don't manufacture
   a single confident number the data doesn't support yet.
3. **Investigate whether today's active faction is knowable in advance**,
   before spending — check `entryData` and any other field on the dungeon
   state/today-progress response for a day-index or faction-selector field,
   rather than only learning it after the fact from a balance diff. If
   found, wire it into `checkEntryTiers.ts` so future runway reads don't
   need trial and error. If not found after a real check (not just absence
   from the one response already logged), say so and move on — don't spend
   time hunting for a field that may not exist.
4. **Record a `DECISIONS.md` entry, dated today**, stating this is a direct
   user-supplied correction (not independently re-derived) and citing it as
   the resolution to session 112's open question 1. Update the STATE.md
   digest entry to match.
5. **This session's dungeon runs (Step 4) are where this gets confirmed
   live** — expect the charged faction to still show as Foxglove (same
   calendar day as session 112, if today hasn't rolled over) or a
   *different* faction (if it has), and either outcome is consistent with
   the user's model. Log the actual faction and amount debited on every run
   this session as the confirming measurement, and say explicitly in the
   recap whether it matched "3 of one faction" — it should, by
   construction, but verify rather than assume.

## Step 2 — implement: disable the double-lethal oil override, on-demand only

**User's directive, given directly:** *"focus oil will not be added back on
the allowlist, disable the override rule."* This resolves STATE.md session
112's open question 2, choosing option (b).

1. **Focus Oil (942) stays off `allowedItemIds`** — no change needed there,
   it's already off (session 93). Just confirm it's still off; don't
   re-add it.
2. **Disable the double-lethal override** — find its actual trigger site
   (the logic `OIL-DOUBLE-LETHAL.md` documents, likely in
   `src/strategy/fishing/oilTiming.ts` or `scripts/liveFishing.ts`'s oil
   decision point) and turn it off, leaving only the rule-4-approved
   on-demand policy active (Relaxing Oil at `fishHp <= 2`, gated by the
   necessity gate). Prefer a config flag or clearly-named constant over
   deleting the code outright, so it stays legible in history and easy to
   re-enable if a future user directive asks for it back — but make the
   *default behavior* on-demand-only, not "off unless configured."
3. **Add a regression test** confirming the override no longer fires —
   same discipline as every other fix this repo has shipped (a test that
   fails if the override silently comes back).
4. **Record a `DECISIONS.md` entry, dated today**, with the user's exact
   framing preserved (target 60-70% catch rate, oils not wasted,
   double-lethal explicitly rejected in favor of the approved on-demand
   policy actually firing).
5. **This session's fishing batch (Step 3) is the first live test of this
   change** — report explicitly whether on-demand actually fires now that
   nothing intercepts its band, and whether the catch rate stays inside the
   60-70% target with a real trigger instead of a dormant one.

## Step 3 — fishing: up to 25 casts, under the new oil policy

1. **Confirm before assuming, on every axis.** `npx tsx
   scripts/checkFishingCaps.ts` first — read the real remaining casts, not
   an assumed fresh 25 or an assumed exhausted 0. Confirm the fishing guard
   over-count fix (session 112) reads correctly — this is its first live
   exercise since landing, per STATE.md open question 4, so watch for it
   specifically rather than assuming it's fine.
   - Read current rod durability live before sizing the batch.
2. `--dry-run` first, per standing rule-4 discipline — and this time also
   confirms Step 2's oil-policy change is actually wired before any live
   cast spends anything.
3. Run the batch: on-demand Relaxing-Oil-only policy (double-lethal now
   disabled), redraw stays disabled (CLOSED). Size to whatever the live
   caps/durability allow, up to 25 casts / 300 energy — headroom, not a
   target.
4. Report at standard depth, plus the Step 2 confirmation: catch rate with
   CI, oil spend broken out by WHICH trigger fired (on-demand vs. — there
   should be no double-lethal firings at all now), Hard Core total (now
   tracked, per session 110), casts played vs. charged, post-batch rod
   durability.
5. Rule 13 discipline on any denied/blocked/interrupted cast, as always.

## Step 4 — dungeon: the remaining 3 Tier-2 runs today, one at a time

Session 112 already spent 3 of today's 12 run-units (1 run). **9
run-units remain = 3 more juiced runs**, matching what the user asked for.
Standard rule 11 — no chaining authorized this time, stop between each.

1. `npx tsx scripts/checkDungeonToday.ts` first — confirm 9 run-units
   actually remain rather than assuming (today may have rolled over since
   session 112, in which case a fresh 12 would be available — if so, still
   cap this brief's ask at 3 runs since that's what was requested, and note
   the extra headroom rather than spending it without asking).
2. `--dry-run` first, then `--runs=1 --juiced --juiced-index=2` per run.
3. **Before each run**, log whatever the entry data/preflight shows about
   today's active faction if Step 1.3 found a way to know it in advance;
   otherwise this is only knowable after the fact from the balance diff.
4. **After each run**, read silver ring balances and confirm exactly 3 of
   ONE faction moved (per Step 1's model) — report which faction, every
   run. If a run ever shows a different pattern (more than one faction
   moved, or an amount other than 3), stop and report it as a falsification
   of the just-confirmed model rather than averaging it away.
5. Stop after each run, report it, and get a fresh explicit go-ahead before
   the next — standard rule 11, same as every session except 108's one-time
   exception.
6. Rule 8 (highest non-Perpetual tier; lowest/no-modifiers at the final
   room) governs every in-room pick, unaffected by any of the above.

---

## Recap, for the whole session

Full suite (`--maxWorkers=4`, UNSANDBOXED per session 112's finding —
`profile.test.ts` false-fails sandboxed), `tsc --noEmit`, `git diff
--check`, secret scan (`scripts/secretScan.ts`, quote its summary verbatim).
State explicitly, at the top of the recap:

- Step 1: the corrected rule-11 cost paragraph, the runway model change,
  whether an advance faction-indicator field was found, and confirmation
  from Step 4's live runs that "3 of one faction" held.
- Step 2: the override-disable change, its regression test, and Step 3's
  live confirmation that on-demand actually fired (or didn't, and why).
- Step 3: casts played/charged, catch rate, oil trigger breakdown, Hard
  Core total, rod durability, and the fishing-guard-fix's first live
  behavior.
- Step 4: how many of the 3 runs happened, per-run faction/amount debited,
  rooms/Hard Core/Dendren Root per run.
- **Carried forward, unresolved:** whether Tier-1/Tier-3 numbers are a
  usable baseline for anything downstream (STATE.md open question 3,
  eighth session unactioned) and whether `chooseNewCard`'s currency flaw
  should be fixed independently of TASKS §13's data-gated term (open
  question 5) — neither is this session's job, but don't let them go
  unmentioned again.
