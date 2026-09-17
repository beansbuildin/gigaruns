# BRIEF — session 134 — FISHING ONLY. No dungeon runs.

**This document replaces the session-133 `next.md`.** Session 133 recovered
session 132's missing recap, spent day 20711 in full, and left the suite green
(**2826/2826**). **This session is fishing only, by the user's instruction —
there is no dungeon arm.**

---

## What "fishing only" changes, and it simplifies three things

1. **⭐ NO AUTHORIZATION IS NEEDED.** CLAUDE.md is explicit: *"Reading, playing
   fishing casts, and looting are all fine to do autonomously within the
   configured budget. Dungeon runs are not."* The **[USER] fishing budget is 360
   energy / 30 casts, STANDING**, and the per-session approval rule governs
   **dungeon runs only.** **Do not ask for a go-ahead to fish** — say what you
   are about to do and do it.

2. **⭐ THE DUNGEON GEAR HALT IS IRRELEVANT — NO REPAIR IS NEEDED THIS SESSION.**
   640 and 901 closed at 0, which halts the **dungeon** arm. **The halt is
   PER-ARM**, measured and settled. **Do not raise a gear repair**; it blocks
   nothing here. The only gear that matters is the **rod in slot 14**, and
   slot-15 lures at 0 neither halt fishing nor size the batch ([USER],
   2026-09-14).

3. **⭐ SKIPPING TODAY COSTS THE ROTATION NOTHING.** The day's 12 run-units go
   unspent and the **fifth gold point is not taken** — say that plainly. But the
   three unmeasured dows are **6, 7 and 1**, and **measuring any two FORCES the
   third.** dow 7 is tomorrow (day 20713) and dow 1 the day after, so the gold
   map can still be completed on schedule without today. dow 6 itself returns on
   **day 20719 (opens 2026-09-22T18:00Z)** if it is ever wanted directly.

---

## ⏱️ The clock — and for a fishing-only day, waiting is the cleaner call

At this brief's writing (**2026-09-17T17:37Z**) day **20712** closes at
**18:00Z** — about **22 minutes**.

**⭐ The rod, not the day, is the binding term.** Rod **812 is at 24**, and it
loses exactly **1.00 per PLAYED cast**. **That is 24 plays before it breaks,
and they do not expire at the rollover.** A day's ledger only limits how many of
them **charge** (20/day).

So the choice is about accounting, not about losing casts:

- **Start now** → a 20-cast batch will almost certainly **straddle 18:00Z**,
  which **resets the charged cap mid-batch** (session 127 saw exactly this and
  got handed a fresh 20). All 24 plays could charge across the two days — but the
  ledger bookkeeping is messy and a mid-batch instruction becomes unactionable,
  as in session 131.
- **Wait ~22 minutes** → a clean fresh **0/20** ledger, the full 24h of day
  20713, and no straddle. **Nothing is lost by waiting** because the rod's 24
  plays carry over.

**Recommend waiting; do not decide it.** Say which day the session actually
spent.

---

## Step 1 — the reads. Short, because this is one arm.

`npx tsx scripts/checkGear.ts` · `checkFishingCaps.ts` · `checkEntryTiers.ts`
(for the rollover clock) · **`doctor.ts`** (it now prints the absolute JWT `exp`,
fixed in session 132).

| # | Claim — verify, do not assert | value |
|---|---|---|
| A | Rollover clock / which day | per the clock |
| B | **Rod 812 durability** — the only gear term that matters | expected **24** |
| C | Fishing ledger fresh **0/20 charged** | `checkFishingCaps.ts` |
| D | JWT `exp` **2026-09-20T16:32:40Z** (~71h) — will not bind | `doctor.ts` |

**⚠ NINTH consecutive session of stale gear forecasts — read it, do not assume
it.** Last session's brief feared the rod was "at or near 0" and it **read 44**;
905 was expected at 2 and **read 24**. Both had been repaired out of band.

⚠ **`checkGear.ts`'s DUNGEON HALT banner fires permanently on grandfathered item
50 (slot 8)** and will fire on 640/901 too. **Ignore it this session** — check
the slot, and note that it says nothing about the fishing arm.

**Read the fourteen ring balances once, for the record.** There is **no charge
shape test this session** (no entry), so this is a null check, not a measurement.
Shape stands at **16/16** and does not advance.

---

## Step 2 — the batch

**Cap = `min(rod, ledger, authorized)`.** With rod 24, a fresh ledger and the
standing 30-cast budget, that is **20 charged, up to 24 played.**

- **Size each batch to the rod's remaining durability.** ⛔ A batch that outruns
  the rod injects `BASE_DECK` mid-batch unnoticed — durability is read at
  preflight and after the batch, **never between casts.** Session 133 ran
  `castCap 12` then `--casts=8`, both rc 0 at exactly −1.00 per played cast;
  session 132 ran 12 + 12. **Add `SESSION_134_LIMITS` the same way.**
- ⛔ **`--casts=N` is silently overridden by `--oil-batch`** while the banner
  still prints `args.casts`. **Set the cap, not the flag.**
- **If the rod reaches 0 it is a hard stop** — [USER]: *"cast until broken or
  until the ledger runs out; I will repair if broken."* Report it and hand back.
- **Report played and charged separately.** The game ledger has lagged the repo
  ledger by one mid-session before and converged after the next batch — **that is
  not a rule-13 event.**
- Oils **Relaxing-only**; Focus off the allowlist, triggers log
  **policy-withdrawn**; autonomous within `dendren.oils` with `policyApproved`
  true.

### Reporting the catch rate

**Report the 812-only slice. ⛔ Never pool across rods.**

| slice | caught | n | rate |
|---|---|---|---|
| **Golkan 812 — the live rod** | 173 | 287 | **60.3%** |
| Golkan 811 | 45 | 82 | 54.9% |
| Dendren 923 | 54 | 104 | 51.9% |
| Puppeteer 924 | 11 | 27 | 40.7% |

⛔ **The old "Golkan 192/327 = 58.7%" is RETIRED** — it was an 811+812 pool
(card 74 is shared). `deckOf` is fixed and pinned; **do not add 74 back to
`GOLKAN_IDS`.** Recompute from the corpus when quoting a cumulative:
`loadCastTraces()` → `splitByDealtDeck(...).rod` → `deckOf()`. ⛔ Not
`loadFishingCorpus()` (no `.turns`), not `fishBatchReport.ts` (session-scoped).

**The last two Golkan days read 14/22 = 63.6% and 12/20 = 60.0%** — the revert is
holding up. ⛔ **Do not re-derive a drift table to argue about rods**; deck
arithmetic has not predicted live catch rate.

**§71 margins are REPORTED ONLY — [USER] HOLD.** At 626 traces: pooled **−9**,
Shroom **+12**, 812 **−22**, Dendren **−3**. Do not decide, retire or rescope.

---

## Step 3 — ⭐ THE FREED TIME IS THE POINT OF THIS SESSION

A fishing day is ~10 minutes of live work (session 132's two batches ran
17:50 → 17:56). **Everything else is offline, and the backlog has a clear
priority order.**

### 1. ⭐ FIX THE LIST-INSERTER BUG. It is the highest-value item and it will recur.

It **wrote into two single-line arrays and broke syntax** last session (boons
heal rooms; `oilReachability` ×2) because its **end-of-array detection mis-fires
and it inserts after `]);`**. It was caught only by the parse error and repaired
by hand. **The tool bug is unfixed and the next pin pass will hit it again.**

Two more parser defects to fix in the same pass, both from session 133:

- **Diff parsing must skip the `+ Received` header line**, or the hunk loses its
  context.
- **A `startswith` anchor is not unique in `redrawCounterfactual.test.ts`** — the
  same `all3.rescues - all3.sacrifices` pin sits in **three** tests and all three
  move together.

**Keep the parts that work:** parse every failure **before** writing; refuse to
write when an anchor is not unique; snapshot `tests/` first. Carried: never write
full precision into `toBeCloseTo(x, 1)`; ratio pins need **both halves**.

### 2. The loadout census gained +6 combos and was not chased

50/37, 58/19, 58/21, 64/11, 64/14, 78/27. **Session 131 chased 74/24 exactly this
way and it resolved benignly** — worth one chase on a light day. Report what it
resolves to; ⛔ do not fit a mechanism to a census row.

### 3. `factionDayRunway` — decide it properly or leave it alone

⛔ **Do not delete it casually.** Session 133 kept it deliberately: **CLAUDE.md
rule 11 names `tests/entryTierRunway.test.ts` as the guard against the retired
"30 runs / 7.5 days" figure returning.** Deleting it is a **rule-11 edit**.
Either make both changes together, or leave both and say why — **never one
without the other.**

### 4. `web/` is still untouched since session 120

`cd web/server && npm install && npm run dev` against the Setup/Status tabs. Only
if the above are done.

---

## One [USER] question — and only one

**⭐ `WeakeningEvade` is held at n=1 and needs a directive.** Latent at pickup,
**`val1` fixed at 4** (it does not roll). **Model it as latent by directive — the
`LossBlockUp` precedent — or keep holding?**

Attach the caveat: a "yes" models the **pickup** as latent; it does not say what
the **4** governs, and **because `val1` is fixed, more pickups will never
separate that** — the same dead end as `VulnerableMastery`.

⛔ **Ask nothing else.** `TieDamageReduction` stays HELD (answered 2026-09-12);
`Vengeance` is MODELLED (2026-09-13); the ring runway, the Tier-1/Tier-3 baseline
and the catch-rate tripwire are retired or answered.

---

## Carry forward — the ones that still apply on a fishing-only day

1. **⭐ [USER] THE ROD IS GOLKAN (812)**, standing. Re-opens as *"swap back to
   924/923"* or *"the sim says Dendren beats Golkan"* — both wrong.

2. **⭐ [USER] FISHING STOPS ONLY ON A BROKEN ROD.** Cap = min(rod, ledger,
   authorized). CLAUDE.md rule 11. Re-opens as *"size castCap to the slot-15
   gear"*.

3. **⭐ PIN AFTER THE DAY'S LAST CAST** — session 133 did and it took a **single
   pass, no redo**. With one arm and one or two batches this should be the
   cheapest pin pass in a dozen sessions. ⛔ Never pin mid-arm.

4. **⚠ `$TMPDIR` differs between sandbox modes** — write cross-mode scratch to
   the **scratchpad path**. Run the suite and git **UNSANDBOXED**. Never end a
   background loop with `[ $rc -ne 0 ] && break` (the task reports exit 1 on a
   clean run), and never trust a `tail`-piped or notification exit code —
   capture to a file and read `$?`.

5. **⚠ `KNOWN_CRIT_ANOMALIES` 21 → 26**; fish-HP interval unchanged at
   **[1.500, 1.5625)**. Report new ones; do not fit.

6. **⛔ Carried:** never read consecutive captures as consecutive **exchanges**;
   **`loadCorpus()` drops `data.events`**; **do not reproduce −0.389**; **§0a NOT
   lifted — +19.40pp and +17.74pp MAY NOT BE QUOTED**; **[USER] other dungeons
   are OUT OF SCOPE**; the **`ask` block in `.claude/settings.local.json`** is
   still there and is **the user's edit** — mention once, do not re-litigate.

---

## Recap — lead with these

- **That this was a fishing-only session**, that **no authorization was needed**
  and none was asked for, and that **no gear repair was raised** because the halt
  is per-arm.
- **The day decision** — ran in the ~22-minute sliver or waited for 18:00Z — and
  which day the casts charged against.
- **The live rod reading**, the batch sizes against remaining durability, **casts
  played vs charged separately**, and whether the rod reached 0.
- **The 812-only catch rate**, never pooled, with the cumulative **recomputed
  from the corpus** rather than carried arithmetic.
- **⭐ Whether the list-inserter bug was fixed**, and the two parser defects with
  it — that is this session's real gate.
- **The loadout-census chase**, if it happened, and what it resolved to.
- **The run-units forfeited**: 12 unspent, no fifth gold point, shape still
  **16/16** — and the note that measuring dow 7 and dow 1 still forces dow 6.
- **`WeakeningEvade` put to the user** with the "a yes still does not say what
  the 4 governs" caveat.
- **All six carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim** (plus `--scope=diff` as an addition, never a substitute); suite
`vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**; `tsc --noEmit`;
`git diff --cached --check`; `discoveredShipsClean` 8/8.
