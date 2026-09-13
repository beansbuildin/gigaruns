# BRIEF — session 130 — ⭐ BACK TO TIER 3 / GOLD RINGS, 4 runs + 20 casts — and the JWT is EXPIRED

**This document replaces the session-129 `next.md`, which is spent.** Session 129
spent a full live day, left the suite **green (2674/2674)**, ran the first
Puppeteer batch, and closed `blockedMove` offline after three sessions of
deferral.

**The headline this session is a TIER CHANGE, and it is the largest change to
rule 11 since the approval softening.** Read the directive below before touching
`liveRun.ts` — it invites one specific bug that CLAUDE.md documents in advance.

---

## ⏱️⛔ STEP 0 — THE JWT IS EXPIRED. THIS BLOCKS EVERYTHING LIVE.

STATE 129 recorded the token expiring **≈ 2026-09-12T16:45Z**. At this brief's
writing (**2026-09-13T16:36Z**) that is **more than 24 hours ago.**

1. **`npx tsx scripts/doctor.ts` first.** Confirm live; do not trust this brief's
   arithmetic.
2. **If still expired: stop. Spend nothing.** Tell the user directly in chat that
   `~/.secrets/gigaverse-jwt.txt` needs a fresh token from their browser. ⛔ **Do
   not probe with a live call** — a 401 adds nothing `doctor.ts` did not say.
3. **If refreshed: record the expiry and runway** in the recap and STATE, and say
   whether it binds tighter than the day. It did in session 129, exactly as
   predicted, and both arms still finished 74 minutes inside it.

**The Tier-3 preparation in Step 2 is READ-ONLY and needs no token beyond
`entryData` — but the CLAUDE.md edit and the offline queue need none at all.**

⚠ **The day is short too.** At writing, day **20708** (dow 2) closes at
**2026-09-13T18:00Z**, about **1h 24m** away; day **20709** (dow 3) follows with
a full 24h. **Read the rollover clock; do not assume either.**

---

## ⭐⭐ [USER] DIRECTIVE 2026-09-13 — ENTRY TIER GOES BACK TO 3 (GOLD RINGS)

**The user's call: *"we are going back to Tier 3 - gold rings for the dungeon
runs."*** This is a **standing amendment to CLAUDE.md rule 11**, the same shape
as the two changes before it — Tier 3 → Tier 1 on 2026-08-27, Tier 1 → Tier 2 on
2026-08-30 — **and it must be recorded the same way: as a user directive, not an
optimisation.**

### What changes

- **`--juiced-index=3`**, not 2. Tier 3.
- **The entry cost moves from silver rings to GOLD.**
- **`dropMultiplier` goes 2 → 4.** Per SPEC §3c and DECISIONS 2026-08-28 that
  multiplier is an **EXACT quantum on Hard Core (item 845) and moves nothing
  else.**

### What does NOT change — all of it still binds

- **60 energy, juiced, 3 of the 12 daily run-units.** `index` and `isJuiced` are
  **independent axes** (SPEC §3c/§3f, session 42), so the tier change does not
  touch the energy cost, the run-unit charge, or the potion auto-load — that gate
  reads `--juiced` alone and never `index`.
- **3× Big Heal Juice** from `config/bot.json`'s `forbiddenWoods.potions`.
- **Rule 8** on in-room picks — highest non-Perpetual tier, except the final
  room, keyed on the server's `maxRoom`. **The ENTRY tier and the in-room
  `enemyPathOptions` tier are different choices; do not collapse them.** That
  distinction is written into rule 11 and matters more, not less, now that both
  numbers are 3.
- **Rule 5** (fail closed), **rule 13** (read the ledger before believing a
  denial), the **per-arm gear halt**, and **[USER] per-session approval**.

### ⛔ THE TRAP THIS CHANGE INVITES — CLAUDE.md NAMES IT IN ADVANCE

> **`index` is the TIER, not an array position.** `entryData` is returned ordered
> **tier 2, 1, 3**, so `entryData[1]` is Tier 1 **by luck**, `entryData[0]` is
> Tier 2 **by a different coincidence**, and **`entryData[3]` DOES NOT EXIST.**

**Match on `entryData[].tier === 3`. Never index the array positionally.** Two
tiers in a row landing on a positional index that happened to work is exactly how
this becomes a silent bug, and the previous two tier changes both got away with
it by accident. **This one will not.**

### ⛔ FOUR THINGS THAT ARE TIER-2 FINDINGS AND DO NOT AUTOMATICALLY CARRY

1. **The charge shape — "one faction, exactly 3, six untouched" — is a TIER-2
   claim, currently 49/49.** ⛔ **Do NOT carry that counter across the tier
   change.** Open a **separate Tier-3 count starting at 0/0**, and state in the
   recap that 49/49 is closed as a Tier-2 figure.
2. **The dow → faction rotation is a TIER-2 finding.** Tier 2's `entryData`
   carried `inputsBasedOnFactionDay: true` over the seven **silver** ids.
   ⛔ **Do not assume today's dow governs the GOLD charge.** Read Tier 3's own
   `entryData` and its own `inputsBasedOnFactionDay` before predicting anything.
   The rotation being *"fully measured, all seven cells"* is a statement about
   silver rings at Tier 2 and nothing else.
3. **The gold-ring item IDs are NOT in this brief** and must not be guessed.
   **Read them off `entryData[].tier === 3`'s `inputItems` / `inputAmounts`**, and
   read the balances for exactly those ids before and after each run.
4. **Confirm the Tier-3 offering is still OPEN.** Tier availability has a window;
   `checkEntryTiers.ts` prints the live cost and the offering. **If Tier 3 is not
   offered, stop and tell the user** rather than falling back to Tier 2 silently.

### ⛔ AND ONE EXPERIMENT THAT STAYS RETIRED

**[USER] The Tier-1/Tier-3 whole-run income baseline is RETIRED BY NAME**, after
thirteen sessions, because a ~3x within-arm spread made it underpowered.
**Switching tiers does not un-retire it.** Recording Hard Core per run is free and
correct; **designing a cross-tier income experiment around these runs is not**, and
a brief proposing one would be wrong.

### The CLAUDE.md edit — do it, and record it

Amend rule 11's `--juiced-index` clause to **3**, dated 2026-09-13, marked
**[USER]**, standing until the user says otherwise. **Keep the superseded
paragraphs** — that file's convention is to strike through and annotate rather
than delete, because the reasoning behind a reversed decision keeps mattering.
Record in `DECISIONS.md` and update STATE's digest. Re-opens as: *"switch to
Tier 2 to save gold"* or *"Tier 2 is the standing entry tier"* — both now wrong.

---

## Step 1 — read everything, before the first `start_run`

`checkDungeonToday.ts` · **`checkEntryTiers.ts` (the rollover clock AND the live
Tier-3 cost)** · the ring balances for **both** metals · `checkFishingCaps.ts` ·
**`npx tsx scripts/checkGear.ts`**.

### Claims to verify — rule 9

| # | Claim | value |
|---|---|---|
| A | Day / dow / faction | **per the clock** — 20708 dow 2 at writing, 20709 dow 3 after 18:00Z |
| B | **Tier 3 is OFFERED**, and its `inputItems` are GOLD | `entryData[].tier === 3` |
| C | Silver rings total **159**: Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33, Overseer 42 — **an INSTRUMENT, not a budget** | read live |
| D | **GOLD ring balances — UNKNOWN to this brief.** Read and report them; do not assert | read live |
| E | Run-units fresh **0 of 12** | `dayProgressEntities` |
| F | Fishing ledger — read it; last session closed at 14/20 with 6 unspent | `checkFishingCaps.ts` |
| G | Gear — **see Step 2. Do not assert it; read it.** | `checkGear.ts` |

⚠ **`checkFishingCaps.ts`'s cast counter tracks CHARGED casts; its energy counter
tracks PLAYED ones.** Both correct; reads as broken if skimmed.

---

## Step 2 — gear: keep the inversion. It worked.

**STATE 129 explicitly endorses what the last brief did:**

> **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — FIFTH session running.** 640
> and 905 were repaired out of band… ✅ **This brief handled it correctly** — it
> inverted the instruction to *"read `checkGear.ts` first, then raise a repair
> only if the live numbers call for one"*, and nothing was wasted. **Keep that
> inversion.**

**So: read `checkGear.ts` FIRST. Then raise a repair only if the live numbers
call for one.** Three of the last five briefs' gear tables were stale, and last
session's was stale in **three of its six rows**.

For orientation only — **session 129's close, which may already be wrong:**

| arm | piece | close | note |
|---|---|---|---|
| **Dungeon** | **901** (slot 13) | **0** | arm halted at close |
| Dungeon | 640 | 48 | 16 runs |
| Dungeon | 641 | 24 | 8 runs |
| Dungeon | 905 | 12 | 4 runs |
| **Fishing** | **slot-15 954** | **0** | arm halted at close |
| Fishing | slot-15 pair | 10 | **10 casts — binds below the 20 asked for** |
| Fishing | rod 924 | 27 | 27 casts |

**If those zeros still stand, both arms need a repair** — raise it once, with the
scope question and the JWT runway, in a single message. ⚠ **Note for the 20-cast
scope: last session the binding cap was GEAR at 17, not the rod (44) and not the
ledger (20).** The binding cap is **whichever of rod / ledger / gear is
smallest** — compute all three and say which one binds.

⚠ **`checkGear.ts`'s HALT banner is not automatically an arm halt** — item 50
(slot 8) is grandfathered and trips it permanently. Check WHICH slot. Pieces at 0
at session open are **GRANDFATHERED**; a started run always finishes.

---

## Step 3 — pre-register, then spend

**Ninth session running** (`09c8bc37` and `bf31c692` last time, each before its
own arm's spend — **that split is good practice; repeat it**). Write
`handoff/scratch-session-130.md`, `git commit`, quote the hash. No addresses, no
usernames, no JWT fragments.

**Pre-register these, and note that the tier change makes two of them genuinely
uncertain for the first time in weeks:**

1. **⭐ The GOLD charge shape — UNKNOWN, and that is the point.** State in advance
   what you expect from `entryData` (how many ids, what amounts, whether
   `inputsBasedOnFactionDay` is true) and what would falsify it. **Do not predict
   "one faction, exactly 3"** on the strength of the Tier-2 result; say plainly
   that it is a Tier-2 claim being tested at Tier 3 for the first time.
2. **⭐ Dendren Root should be UNCHANGED. This is the TIGHT test.** Item **846
   answers to `isJuiced` alone** and is **not** governed by `dropMultiplier`.
   Session 129's four runs are the comparison; recent Tier-2 days paid ≈ **2,700
   – 2,900**. **If Dendren Root moves with the tier, a documented SPEC claim is
   wrong** — that is a real finding, not a rounding difference.
3. **⚠ Hard Core should roughly DOUBLE — and this is the LOOSE test, so frame it
   loosely.** `dropMultiplier` 4 vs 2 implies ×2 on item 845. Recent Tier-2
   four-run days paid **18,816 / 19,056 / 19,608**, so the multiplier implies
   ≈ **37,000 – 39,000**. ⚠ **But session 103's four Tier-3 runs paid 30,960**,
   and the two references do not agree, because **room depth varies run to run
   and dominates**. **Pre-register the RATIO, not the total**, and expect noise.
4. **The gear path** per run at −3 on slots 11/12/13×2, **and the break run if
   one lands**, computed from the LIVE read.

### The runs

**⛔ This brief does not carry authorization.** [USER] approval is **per session,
in session** — one authorization then covers all four runs consecutively, but a
brief may never manufacture it. The user named a scope (4 runs, 20 casts);
**ask once, then go.**

`--dry-run` once (rule 4) — **and read its output carefully this time**, because
it is the cheapest place to catch a wrong `index`. Then
**`--runs=1 --juiced --juiced-index=3`**, four times, consecutively, no pause.

**Read BOTH metals' balances after each run** — gold to measure the charge,
silver to confirm it is untouched. **Report all four readings together at the
end.** If any silver moves on a Tier-3 entry, that is a finding; say so.

---

## Step 4 — fishing: 20 casts on the Puppeteer rod

**The user's scope is 20 casts**, inside the standing 360-energy / 30-cast
budget. **The binding cap is whichever of rod / ledger / gear is smallest** —
last session that was gear at 17, and the slot-15 pair closed at 10/0.

- **Set `castCap` to the binding number**, as `SESSION_129_LIMITS` did at 17.
  Add a `SESSION_130_LIMITS` the same way. ⛔ **`--casts=N` is silently
  overridden by `--oil-batch`** while the banner still prints `args.casts`.
- **The `castCap: 2` convention is not a safety rule in itself** — it exists
  because a dry rod injects `BASE_DECK` mid-batch unnoticed, and that needs the
  rod to hit 0 **with casts still to play.** A batch sized to the binding cap
  cannot.
- **On a halt: stop, hand back, wait for the repair**, resume with a **fresh live
  read.**
- **Report played and charged separately**, and **report Puppeteer as its own
  slice.** Day one read **7/17 = 41.2%**, n far too small to mean anything.
  ⛔ **Do not pool it into Dendren's 54/104 = 51.9%.** The other slices: Golkan
  183/307 = 59.6%, pooled 271/537 = 50.5%.

Oils **Relaxing-only** (20 held, 2 consumed last session); Focus off the
allowlist, triggers log **policy-withdrawn**.

---

## One [USER] question — and only one

**⚠ `Vengeance` AMPLIFIES and needs a directive to model.** `atk 26 → taken 32`
(**+6**) twice, attacker carrying `beforeStatus.Vengeance = 25`; **one a TIE and
one NOT**, so the trigger is **not** ties and this is **not**
`TieDamageReduction`. It is the **second** held boon whose conditional has been
observed.

**Attach the same caveat that came with the last such ask:** a yes still needs
more observations to say what the **25** governs, and `BOON_MODELS` is untouched
meanwhile.

⛔ **Do NOT re-ask about `TieDamageReduction`** — asked and answered 2026-09-12,
**stays HELD at n=1**, roster stays eleven. Re-asking without a second pickup is
in the do-not-re-open digest.

---

## Carry forward — name each in the recap

1. **⭐ `blockedMove` IS ANSWERED, AND THE WIRING THREE BRIEFS PROPOSED IS
   FALSIFIED.** It does **NOT** bind the current exchange (6/20 vs 6.67 expected,
   p = 0.48 — chance exactly) and only **depresses the next** (2/20, p = 0.018).
   ⛔ **A hard exclusion assigns probability ZERO to an event the corpus contains
   TWICE.** It is a **soft prior (~3.3x)** whose magnitude n=20 cannot support.
   Pinned in `src/sim/blockedMove.ts`; consumed nowhere in the strategy path.
   **The remaining work is COLLECTION and it accrues for free — do not commission
   runs for it.**

2. **⚠ IS THE ROD CARRYING A DUNGEON STAT LINE?** `hpMax` **51 → 50** and Sword
   ATK **27 → 26** moved **together**, on every opening of 09-12 against every
   opening of 09-11, with `armorMax`/Paper/Scissor unmoved. **The one equipment
   IDENTITY change between the readings is the rod swap 923 → 924**, and every
   dungeon piece read healthy. ⛔ **COINCIDENT, NOT PROVEN.** It is falsifiable
   for the price of one gear read: **if the user ever swaps back to 923, capture
   the opening — 51/27 returning would prove it.** Do not swap back for this
   alone; it would cost the Puppeteer data. **But if a swap happens for any
   reason, take the reading.** This matters more under Tier 3, where combat
   depth drives the payout.

3. **⚠ The unknown-field registry does not know `nextPosition` — and the strategy
   ACTIVELY USES IT** (the override reports 62/62 hits). Logged as an unknown
   field on every fishing turn, with dumps from 2026-09-08 onward. **A registry
   gap, not a rule-5 condition.** Cheap to close, and it is noise on every turn
   until someone does.

4. **⚠ `fixtures/fishing-casts/cards.json` holds only 8 of Golkan's 10 cards**
   (82 and 83 absent); Dendren and Puppeteer are complete. **This is why Golkan's
   per-play drift computes −0.389 rather than the −0.400 an earlier brief
   quoted.** Dendren (−0.300) and Puppeteer (−0.678) reproduce exactly. Quote the
   computed values, not the brief's.

5. **⚠ A BRIEF'S PREDICTION ABOUT ITS OWN TESTS CAN BE BACKWARDS.** Last brief
   said `rodDeck.test.ts` would be *"red until the repoint lands"*. Wrong
   direction: the test keys on the rod in the **latest CORPUS cast**, so the
   **repoint** reddens it and the **first recorded Puppeteer cast** heals it.
   Check which way a guard actually points before predicting its colour.

6. **⭐ PIN IN-SESSION.** Five rounds, ~90 sites last time, done same-session and
   left green. ⛔ Do not defer the pin pass. Pin only after the run-units and the
   cast cap are spent, never mid-arm.

7. **⛔ Two fresh patcher traps.** Do not let a pin patcher **walk forward to the
   next `);`** — it annotated 16 assertions it never changed and mis-mapped array
   literals positionally (`[3,3]` → `[4,3]` where the truth was `[3,4]`). And
   **do not patch a bare numeric literal — anchor on the matcher call**, because
   the old value also lives inside the historical `/* was X */` comment on the
   same line. **Sweep the diff for added annotations whose line is otherwise
   byte-identical.**

8. **⛔ Do not read consecutive captures as consecutive EXCHANGES.** Every
   `use_move` capture is followed by a duplicate with no events; treating those as
   exchanges makes "current" and "next" the SAME row — which is exactly how a
   first pass at `blockedMove` hid the entire finding. Relatedly,
   **`loadCorpus()` cannot answer any question about `data.events`** — it keeps
   `data.run` and drops `events`.

9. **⚠ `$TMPDIR` DIFFERS between sandbox modes — SIXTH consecutive session it
   cost cycles**, this time on the very first suite capture. **Use the scratchpad
   path, never `$TMPDIR`.** Run the suite and git **UNSANDBOXED**.

10. **⚠ THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE** — the
    user directed it cleared on 2026-09-11 and it remains; the path SUBSTRING
    alone trips it. **An agent cannot edit its own permission rules.** Mention it
    once with the exact lines, and carry on.

11. **[USER] Other dungeons on this account are OUT OF SCOPE.** The 12-run-unit
    ledger is per-dungeon. **The rotation is fully measured** — for silver at
    Tier 2; see the directive. **The `web/` front end** is untouched since
    session 120. **§0a NOT lifted; +19.40pp and +17.74pp MAY NOT BE QUOTED.**

---

## Recap — lead with these

- **The JWT: expiry, runway, and whether it was refreshed at all.** If not, say
  what was done offline instead.
- **⭐ TIER 3: the live `entryData` for `tier === 3`** — the gold ids, the
  amounts, `inputsBasedOnFactionDay`, and whether the offering was open. **The
  GOLD charge shape as a NEW count starting at 0/0**, with 49/49 stated as
  **closed** at Tier 2.
- **Whether any SILVER balance moved on a Tier-3 entry** — it should not.
- **Dendren Root against its ≈2,700–2,900 Tier-2 baseline** (the tight test) and
  **Hard Core as a RATIO** against ×2 (the loose one), with room depths beside
  them.
- **The CLAUDE.md rule-11 edit landed**, dated and marked [USER], superseded
  paragraphs kept, and recorded in DECISIONS and STATE.
- **The live gear reading** — never a forecast — and which of rod / ledger / gear
  bound the cast count.
- **That ONE authorization covered the session**, given in chat, not claimed.
- **Fishing: played vs charged separately**, Puppeteer as its own slice, never
  pooled.
- **`Vengeance` put to the user** with the "a yes still needs more observations"
  caveat.
- **All eleven carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim** (plus the `--scope=diff` run as an addition, never a substitute);
suite `vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**; `tsc --noEmit`;
`git diff --check`; `discoveredShipsClean` 8/8. **Never trust a `tail`-piped or
notification exit code** — capture to a file and read `$?`.
