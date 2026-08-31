# STATE — session 114 — 2026-08-31 — commit <SHA>

## Status
Brief was three steps: confirm the day rolled, spend ONE juiced Tier-2 run to get
a second point on the day→faction map, then stop. **Steps 0 and 1: GATE PASS.**
The user then authorized three more runs and 24 fishing casts in chat.

- **Step 0, day rollover: GATE PASS.** `currentDay` 20695 → **20696**,
  `dayOfWeek` 3 → 4, run-unit cap reset to 0/12.
- **Step 1, the rotation measurement: GATE PASS.** Day 20696 charged
  **Summoner (140)**, not Foxglove. The faction DOES rotate — measured, not
  assumed.
- **Steps 2–3 (authorized in chat): 3 more runs + 24 fishing casts.** Both
  daily caps now exhausted.

**Live spend: 4 dungeon runs (12/12 run-units), 12 Summoner Silver, 240 energy;
24 fishing casts played / 20 charged, 288 energy, 6 Mid Relaxing Oils.**

Suite **2297 passed / 2297, 115 files** (2262 → 2297). `tsc --noEmit` clean,
`git diff --check` clean, `.gitignore` verified on all seven required paths,
`config/discovered.json` still tracked.

⚠ **Re-run the suite UNSANDBOXED** — sandbox breaks `tsx` (EPERM on its IPC
socket) and `git` (`.gitconfig`). Use `--maxWorkers=4`.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`):

```
> secret scan — scope: tracked
  files scanned:        10523
  CONTROL A (read):     10160 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
  0 unexplained across all 8 rules; 14 allowlisted hits, each printed
> PASS — no unexplained hits, both controls healthy.
```

At `--scope=diff --ref=501fadd1`: **745 files, 0 unexplained**, control A 737.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session:** the "rotation order is unmeasurable from here" entry
(superseded — it is now n=2, see below); "today's faction is not knowable in
advance" (folded into `checkEntryTiers.ts`'s own printed warning, which
enforces itself); the `nextPosition`/fishing-guard entries (already enforced by
tests). The Tier-2 ring-cost entry is KEPT because a brief could still restate
the retired model.

- **[USER] Tier 2 costs 3 rings of ONE faction per juiced run, rotating daily.**
  Now **8 for 8 across TWO faction days**. DECISIONS 2026-08-30/31. Re-opens as:
  *"Tier 2 costs one of each of the seven silver rings"* or *"the charged
  faction is fixed"* — the latter is now disproven day-to-day and CONFIRMED
  within a day.
- ⚠ **The rotation ORDER is n=2 and NOT solved.** 20695→Foxglove(5),
  20696→Summoner(6). Candidate `faction = ((dayOfWeek + 1) mod 7) + 1` fits both
  but they are ADJACENT days — 120 permutations fit equally. Re-opens as: *"the
  day→faction map is solved"*. **Day 20697 predicts Chobo (134); a
  NON-adjacent point is worth more than another adjacent one.**
- **TODAY'S FACTION IS NOT KNOWABLE IN ADVANCE — search COMPLETE.** Do not
  re-hunt. Learn it from a balance diff.
- **[USER] The double-lethal oil override is DISABLED; Focus Oil off the
  allowlist.** Four consecutive batches now: 0 override firings, 0 sirens.
  Re-opens as: *"turn the double-lethal band back on"*.
- **[USER] Oil target framing: 60-70% catch rate, oils not wasted.** ⚠ Re-opens
  as: *"the disable cost us catch rate"* — **63.6 / 60.0 / 58.3% across three
  batches are NOT distinguishable**; today's CI is [39%, 76%].
- **A new boon type from n=1 needs a USER DIRECTIVE.** Precedent used four
  times. `CritHeal` (§66) and `BurningTenacity` (§69) are held. Re-opens as:
  *"model the remaining latent boons"*.
- **TASKS §13 is parked on DATA, not code.** First candidate built, NOT wired.
- **[USER] Chaining is a ONE-TIME, DATED exception.** Rule 11 pins `--runs=1`.
  Approval for one run is never approval for the next.
- **`triggeredBoons`.** CLOSED — 0 non-empty of 10,616. No runs may be spent.
- **`tenacity` / `intuition` as damage mitigation RULED OUT.** §58, §62, §63.
- **[USER] Unspent skill XP.** CLOSED, §61.1 forbids re-raising it.
- **Suite invocation.** `vitest run --maxWorkers=4`, UNSANDBOXED.

## What works
- **The faction rotation, MEASURED on two days.** Summoner 54→51→48→45→42 across
  four runs, every other faction 0 at every step. `currentDayOfWeek ===
  currentDay mod 7` confirmed on both days.
- **Four Tier-2 runs, rooms 6/7/10/14, 281 actions, 0 first-attempt failures
  (0/281).** Rule 8 **33 of 33**; its Perpetual clause fired **9/33 = 27%**
  against CLAUDE.md's stated 35% — first live check of that figure.
- ⭐ **Room 14 is the deepest run in corpus history** (101 attempts checked).
  Rule 8's final-room clause has still never fired live.
- ⭐ **A FIVE-run same-arm set** — s113 run 3 + today's four, all
  `rock 26/9 paper 11/16 scissor 12/8 hpMax 50`, depths 9/6/7/10/14.
- **`Intimidating` heals**, found by SecondWind's pinned rule breaking as
  designed. Miss census exactly `{Regen: 4, Intimidating: 12}`; excluding both,
  SecondWind is **19/19 spent and 44/44 held** — larger than s113's clean set.
- **`BurnMastery` x2 survived a doubling of its evidence** (4 pairs, all x2).
- **`LossBlockUp`'s n=1 directive held out of sample** at n=2.
- **The fishing ledger guard's DISAGREE branch, first live exercise** — game 10
  vs repo 11, deferred to the game, named JEBAITOR.
- **Rod durability: 1 per cast PLAYED**, measured over 40 casts.

## What's broken
- ⚠ **The rotation ORDER is a 2-point fit on ADJACENT days.** Not a map.
- ⚠ **`Intimidating` cannot separate "heals its amount" from "heals a flat 2"**
  — all 12 observations are at amount 2. Same trap `BurnMastery` sat in.
  Its TRIGGER is also unseparated (all 12 are consecutive in one fight).
- ⚠ **`chooseNewCard`'s CURRENCY flaw is unfixed** — a one-zone crit scored
  against a five-zone hit. Carried, unactioned, **fifth session**.
- ⚠ **`LIVE.drift` has moved monotonically more negative across seven pins.**
  Explained (player ATK rising), band widened to the order of magnitude. **If
  the sign flips or it reaches -1, re-derive — do not widen again.**
- ⚠ **`redrawCounterfactual`'s K=6 arm is no longer frozen**; only
  `sacrifices: 0` is durable. K=10 still carries the thesis.
- ⚠ **A cosmetic label nit in `liveFishing.ts`**, deliberately NOT fixed: the
  rod-durability line pairs a play-driven delta with a charge-driven count.
- **The JWT expires and blocks the whole session.** Valid to 2026-09-04T18:48Z.

## Corrections to SPEC.md
- **`SPEC.md` was not touched, and neither was CLAUDE.md rule 11** — this
  session CONFIRMED rule 11's third-version cost paragraph rather than
  revising it. First session since 111 that rule 11 did not need editing.
- **`/gear/instances` represents a rod REPLACEMENT as a mutation of the
  existing instance** — same `docId` and `_id`, `createdAt` six days stale,
  durability 0 → 60. Not previously modelled anywhere.
- **Max durability on rod item 812 is ≥ 60**, so s113's opening 33 was a
  partly-drained rod.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.
- Move charges: PRESENT — unchanged, not re-measured.

## Dead ends
- **Do not treat the day→faction formula as solved.** Two adjacent points.
- **Do not re-hunt the advance faction-indicator field.** Search complete.
- **Do not look for the ring debit on the wire.** Read balances before/after.
- **Do not "fix" `readRodDurability`'s same-item-id instance blindness** — no
  observation motivates it; the identity check did NOT fail this session.
- **Do not infer `BurningTenacity` from its name** — it gestures at `Burn`
  (a STATUS, not this) and `tenacity` (ruled out as mitigation).
- **Do not widen a SecondWind/scaleRule exclusion ad hoc.** The exclusion is a
  two-member CENSUS asserted by composition; that is how `Intimidating` surfaced.
- **Do not pin an "EVER" claim on a bounded slice.** It answers "recently", and
  the two diverge silently — `procEvidence` lost a pinned fact this way.
- **Do not run the suite sandboxed** — `tsx` and `git` both fail under it.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Live dungeon: 4 runs, rooms 6/7/10/14, 281 actions, 0 first-attempt
  failures.** 12/12 run-units, 240 energy, **12 Summoner Silver** (54→42).
  Hard Core **+18,144**, Dendren Root **+2,574**. All four ONE ARM.
- **Live fishing: 24 played / 20 charged**, 288 energy, catch **14/24 = 58.3%**
  (Wilson 95% CI ≈ [39%, 76%]). **6 oils, all approved-policy, 0 override.**
  Hard Core **+3,120**. JEBAITOR gap **4/24 = 16.7%**. Rod 13→0→[replaced 60]→49.
- Suite **2262 → 2297 (+35)**, files 115. ~110 census assertions re-baselined
  across 13 files; era control (`preOil`/`oilSupplied`) BYTE-IDENTICAL, 11th batch.
- Secret scan: **10,523 files (tracked), 0 unexplained, 14 allowlisted**;
  745 files (diff scope), 0 unexplained.
- Silver rings 288 → 276. Corpus: 101 dungeon attempts, 339 fishing casts.
- Offer table +33 rows; room-max 12 → 13. `Enemy Room 76` added at room 14.

## Open questions for Claude
1. **The rotation map needs a THIRD point, ideally NON-adjacent.** Day 20697
   predicts **Chobo (134)** — free on any authorized run that day. A day skipped
   and resumed later is worth more than another consecutive one.
2. **`Intimidating` (§68): model it as a per-exchange heal, or hold?** The
   evidence is 12/12 — far stronger than the usual n=1 boon case — but a single
   observation at a different amount separates the two readings. Default: hold.
3. **`BurningTenacity` (§69) and `CritHeal` (§66) both await directives.**
   `LossBlockUp` holding at n=2 is evidence the `latent` default is usually
   right; it is NOT licence to apply it unasked.
4. **Is the Tier-1/Tier-3 arm a baseline for anything downstream?** **TENTH
   session — but materially changed.** There is now a five-run same-arm Tier-2
   anchor, so a single Tier-1 or Tier-3 run on THIS loadout would give the first
   clean cross-tier read. This is now a cheap, well-defined experiment.
5. **`chooseNewCard`'s currency flaw** — fifth session unactioned. Wrong
   regardless of deck composition; needs a directive to fix independently of §13.
6. **`BurnMastery` floor-vs-round** still needs an ODD plain amount. Named by
   session 113 as the next informative capture; four pairs later, still absent.

## Files changed
```
 QUESTIONS.md                          | 100 +   (§68 Intimidating, §69 BurningTenacity)
 handoff/DECISIONS.md                  |  20 +
 handoff/STATE.md                      | rewritten
 handoff/scratch-session-114.md        | 260 +
 src/sim/boons.ts                      | 250 +   (+33 offer rows)
 src/sim/enemies.ts                    |  36 +   (Enemy Room 76, room 14)
 tests/  (13 files)                    | ~400 +- (~110 census re-baselines + 3 correctness fixes)
 fixtures/  4 dungeon runs + 24 fishing casts
```
