# BRIEF — session 131 — ⭐ BACK TO THE GOLKAN ROD (812), and the SECOND gold-rotation point

**This document replaces the session-130 `next.md`, which is spent.** Session 130
spent a full live day at the **new Tier 3**, left the suite green (2718/2718),
modelled `Vengeance`, and **falsified its own H2** — the gold faction does not
follow the silver dow map.

**The JWT is comfortable for once.** Refreshed before session 130 and read at
**167.6h**, expiring ≈ **2026-09-20T16:35Z** — roughly **144 hours** from this
writing. Verify with `doctor.ts` and record it, but it will not bind this
session. **The day will**: at writing, day **20709** (dow 3) closes at
**2026-09-14T18:00Z**, about **2h 10m** away.

---

## ⭐⭐ [USER] DIRECTIVE 2026-09-14 — REVERT THE ROD TO GOLKAN (812)

**The user's call: *"we are going back to the Golkan rod."*** Standing until
they say otherwise.

### The live evidence supports it, and it is now the strongest it has been

| rod | caught | n | rate |
|---|---|---|---|
| **Golkan (812)** | 183 | 307 | **59.6%** |
| Dendren (923) | 54 | 104 | 51.9% |
| **Puppeteer (924)** | **11** | **27** | **40.7%** |

**Puppeteer against Golkan: −18.9pp, z = 1.90, p = 0.057.** That is not
conventional significance, and n=27 is still thin — **but it is far stronger
than the Dendren comparison ever was (p = 0.17)**, and it has been consistent
across both Puppeteer days (7/17 then 4/10).

### ⛔ AND THE DECK ARITHMETIC THAT ARGUED FOR PUPPETEER HAS NOW BEEN CONTRADICTED BY PLAY. RECORD THAT.

The session-129 brief computed per-play drift off the committed fixture and
concluded Puppeteer **strictly dominates at every aim level** (−0.678 against
Golkan's −0.400 at random aim). **Live play went the other way, hard.** The
pattern is now three-for-three and it deserves a name in DECISIONS:

- The **simulator** said Dendren beats Golkan by +3.23pp. Live: Dendren came in
  **7.7pp worse**.
- The **deck arithmetic** said Puppeteer beats both. Live: Puppeteer came in
  **18.9pp worse than Golkan**.
- **Golkan remains the best-performing rod in live play, at by far the largest
  n.**

**⛔ Do not re-derive a drift table to argue against this directive.** Whatever
the per-play arithmetic captures, it is not predicting catch rate — plausibly
because catch rate is dominated by **meter-out** (64.2% live) rather than damage
per play, because `cardChoice.ts` does not play the ten cards uniformly, or
because the **fish-HP multiplier** (interval now [1.500, 1.5625) on Puppeteer
card 101, base 8 → actual 12) sits between card damage and fish HP. **All three
are hypotheses. Do not fit one.** The finding to record is the narrower,
defensible one: **deck arithmetic has not predicted live catch rate, twice.**

### The swap — steps, in order

1. **The user equips 812 in slot 14.** An agent cannot equip gear; confirm it by
   reading `checkGear.ts`, never by assuming.
2. **Read 812's durability LIVE.** Unknown to this brief — it was at 5 when it
   was swapped out long ago and may have been repaired since. **Do not carry
   Puppeteer's 17 across.**
3. **Repoint `CURRENT_ROD` / `REAL_DECK` in `src/sim/fishing/rodDeck.ts` from
   `PUPPETEERS_ROD` (924) to `GOLKAN_ROD` (812).**
4. ⚠ **`rodDeck.test.ts` goes RED ON THE REPOINT and is healed by the FIRST
   RECORDED GOLKAN CAST — not the other way round.** The session-129 brief
   predicted this backwards and STATE corrected it. The test keys on the rod in
   the **latest CORPUS cast**, so expect red between the repoint and the first
   cast, and say so rather than treating it as a break.
5. ⛔ **Do NOT add the legacy rods (49/50/336) to `ROD_CARD_GRANTS`** while in
   there. The gear array carries Stone Rod (50) beside the active rod, so a
   complete table makes "exactly one KNOWN rod" ambiguous. **Resolve by SLOT.**
6. **Report Golkan's post-swap casts as a CONTINUATION of the existing 183/307
   slice**, not a new one — same rod, same deck. But **flag the era**: these
   casts come after a policy era and two rod swaps, so if the rate diverges
   sharply from 59.6%, that is itself informative.

### ⚠ A CARRIED CLAIM ABOUT GOLKAN'S CARDS IS FALSE — CHECK AND CORRECT IT

**STATE 129 and STATE 130 both record:** *"`fixtures/fishing-casts/cards.json`
holds 8 of Golkan's 10 cards (82, 83 absent)."* STATE 129 used it to explain why
Golkan's drift computed −0.389 rather than −0.400.

**It does not survive one command.** `ROD_CARD_GRANTS[GOLKAN_ROD]` is
`[74, 80, 81, 84, 85, 86, 87, 88, 89, 90]`, and **all ten of those ids are
present in `cards.json`.** Ids **82 and 83 are absent from the fixture, but they
are not Golkan cards** — they are not in the grant list at all.

**So one of two things is wrong and this session should settle which**, now that
Golkan is the live deck again:

- either the "8 of 10" claim was always a misreading of an absent-id list, **or**
- `deckOf()` / `splitByDealtDeck` defines Golkan's deck differently from
  `ROD_CARD_GRANTS`, in which case the −0.389 figure came from a different card
  set and **the two numbers were never comparable.**

**Resolve it, correct both STATE entries, and do not carry the claim a third
time.** It is five minutes and it currently underwrites a published number.

---

## Step 0 — the JWT, briefly

`npx tsx scripts/doctor.ts`. Expected ≈ **2026-09-20T16:35Z**, ~144h out.
**Record expiry and runway in the recap and STATE anyway** — that habit is what
made session 129's tight window a non-event. **The day, not the token, is the
constraint this session.**

---

## Step 1 — read everything, before the first `start_run`

`checkDungeonToday.ts` · `checkEntryTiers.ts` (rollover clock **and** the live
Tier-3 cost) · **all FOURTEEN ring balances, both metals** · `checkFishingCaps.ts`
· **`npx tsx scripts/checkGear.ts`**.

### Claims to verify — rule 9

| # | Claim | value |
|---|---|---|
| A | Day / dow — **20709, dow 3** at writing; **20710, dow 4** after 18:00Z | per the clock |
| B | **GOLD** totals **236**: Foxglove **19**, Overseer 25, Crusader 25, Athena 35, Archon 40, Chobo 44, Summoner 48 | read live |
| C | **SILVER** totals **159**: Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30, Foxglove 33, Overseer 42 — should be **untouched** by a Tier-3 entry | read live |
| D | Tier **3** is offered; `entryData[].tier === 3` carries GOLD ids | read live |
| E | Run-units fresh **0 of 12** | `dayProgressEntities` |
| F | Fishing ledger — last session closed 9/20 | `checkFishingCaps.ts` |
| G | Gear + the rod — **see Step 2. Read it, do not assert it.** | `checkGear.ts` |

⛔ **`index` is the TIER, not an array position.** `entryData` comes back ordered
**tier 2, 1, 3**; **`entryData[3]` does not exist.** Match on
`entryData[].tier === 3`. `liveRun.ts` sends `index` straight to the server and
has no positional read — **keep it that way.**

⚠ **Do not print ring balances with positional `awk` columns.** Faction names
shift the fields; session 130's between-run print came out empty and **run 2's
gold reading was lost.** Use `sed` on the `balance N` token, or read the JSON.

---

## Step 2 — gear: keep the inversion. SIXTH session of stale forecasts.

**Read `checkGear.ts` FIRST. Then raise a repair only if the live numbers call
for one.** Session 130's brief table was stale in **2 of 7 rows** (901 0→24,
slot-15 0→20) — repairs keep landing out of band, and the inversion is the
reason nothing was wasted.

For orientation only — **session 130's close, which may already be wrong:**

| arm | piece | close |
|---|---|---|
| **Dungeon** | **905** (slot 13) | **0** — arm halted at close |
| Dungeon | 640 | 36 |
| Dungeon | 641 | 12 |
| Dungeon | 901 | 12 |
| **Fishing** | **slot-15 954** (…83b834fd) | **0** — arm halted at close |
| Fishing | slot-15 pair | 10 |
| Fishing | rod 924 | 17 — **being swapped out; read 812 instead** |

**If those zeros stand, both arms need a repair** — raise it once, with the scope
question, in a single message. **The binding cast cap is the smallest of rod /
ledger / gear** — it was **gear at 10** last session, not the rod.

⚠ **`checkGear.ts`'s HALT banner is not automatically an arm halt** — item 50
(slot 8) is grandfathered and trips it permanently. Check WHICH slot. Pieces at 0
at session open are **GRANDFATHERED**; a started run always finishes; the halt is
**PER-ARM**.

---

## Step 3 — ⭐ THE DUNGEON GATE: the SECOND gold-rotation point

**One gold day is observed: day 20708, dow 2 → Foxglove Gold (248), −12 across
four runs, six gold factions and all seven silvers untouched. Tier-3 shape count
4/4; Tier-2's 49/49 is CLOSED.**

**n=1 separates nothing.** STATE's instruction is explicit: **pre-register a SET,
not a single faction.**

### The pre-registration, and it has a clean falsifier

- **⭐ Under ANY 7-permutation hypothesis, a dow-3 gold day must NOT charge
  Foxglove again.** That is the sharp test: **a second Foxglove charge kills the
  permutation hypothesis outright**, exactly as a repeat inside one cycle killed
  it for silver.
- **One named candidate, and only one, so it is falsifiable:** *"gold = silver
  shifted by one day"* predicts **dow 3 → Summoner Gold**, because silver's dow 4
  is Summoner. It fits the single observed point (gold dow 2 = Foxglove = silver
  dow 3) — **and so do many other maps. It is one candidate among many, not a
  favourite.**
- **The predicted SET, if the permutation holds:** any of the six non-Foxglove
  gold factions. **State which one you expect and why, then report which came.**
- ⛔ **Do NOT predict today's gold faction from the silver dow map.** That is the
  hypothesis session 130 falsified on purpose-built data, and it is in the
  do-not-re-open digest.

⚠ **If the day has rolled to 20710 (dow 4), the same structure applies** — the
falsifier is still "not Foxglove", and the shifted-map candidate becomes silver's
dow 5, **Chobo**. Read the clock and say which day you are on.

### Also pre-register

- **The gold path**: opening balance of the charged faction, **−3 per run**, six
  gold untouched, **all seven silver untouched.**
- **The Tier-3 shape count 4/4 → 8/8.**
- **Hard Core as a RATIO, not a total.** Session 130 measured **998/room against
  Tier 2's 490/room = ×2.04**, inside the [1.6, 2.4] band. Predict the ratio.
- ⛔ **Dendren Root (846) is a function of the DEATH ROOM, not the tier** — room
  9 → 546, room 10 → 687 at both tiers. **Compare per room, never totals.**
  "846 should be ≈2,700–2,900" is depth-confounded and was wrong in the last
  brief.
- **The gear path** per run, from the LIVE read, and the break run if one lands.

---

## Step 4 — the runs

**⛔ This brief does not carry authorization.** [USER] approval is **per session,
in session**; one authorization then covers all runs consecutively to the
12-unit cap, but **a brief may never manufacture it.** The user named a scope
(the rod revert) but **no run or cast count — ask for both, once, in the same
message as the gear reading.**

`--dry-run` once (rule 4) and **confirm it prints `index 3`**. Then
`--runs=1 --juiced --juiced-index=3`, consecutively, no pause.

**Read BOTH metals after every run** — gold to measure the charge, silver to
confirm it is untouched — and **report all readings together at the end.** Rule 8
on in-room picks; **rule 5 fail-closed and rule 13 on denials are untouched: no
prompt is not no halt.**

---

## Step 5 — fishing, on Golkan

- **Set `castCap` to the binding number** (smallest of rod / ledger / gear), as
  `SESSION_130_LIMITS` did at 10. Add `SESSION_131_LIMITS` the same way.
  ⛔ **`--casts=N` is silently overridden by `--oil-batch`** while the banner
  still prints `args.casts`.
- **The `castCap: 2` convention is not a safety rule in itself** — it exists
  because a dry rod injects `BASE_DECK` mid-batch unnoticed, which needs the rod
  to hit 0 **with casts still to play.** A batch sized to the binding cap cannot.
- **On a halt: stop, hand back, wait for the repair**, resume on a **fresh live
  read**.
- **Report played and charged separately.** Slices: **Golkan 183/307 = 59.6%**
  (this session's casts CONTINUE it), Puppeteer 11/27 = 40.7%, Dendren
  54/104 = 51.9%. ⛔ Never pool across rods.
- Oils **Relaxing-only** (19 held); Focus off the allowlist, triggers log
  **policy-withdrawn**.

---

## Two small jobs that are already decided — just do them

1. **⛔ DELETE the ring "RUNWAY" line from `scripts/checkEntryTiers.ts`.** STATE
   130 lists it as an open question — **it is not one.** The user retired the
   runway concept on 2026-09-11 (*"ignore the balances I can get more rings if
   needed"*), so removing a line that still prints it is **implementing a
   standing directive, not a new decision.** Do it; do not spend a user question
   on it. Its Tier-3 block already stopped printing the silver rotation table.

2. **⚠ CLOSE THE `nextPosition` REGISTRY GAP.** `data.nextPosition` /
   `data.nextMovePath` are logged as UNKNOWN FIELDS on **every fishing turn**,
   with dumps from 2026-09-08 onward, **while the strategy actively uses
   `nextPosition`** — the override reported **67/67** hits last session. A field
   the bot depends on has been flagged unknown for six sessions. **A registry
   gap, not a rule-5 condition.** Cheap, offline, and it is noise on every turn
   until someone does it.

---

## Carry forward — name each in the recap

1. **⭐ [USER] `Vengeance` IS MODELLED** (2026-09-13). Arms on a LOSS, holds on a
   loss, consumed on the holder's next damaging exchange, which deals
   `floor(x * 1.25)` — **crit before; Weak / Vulnerable / block after.**
   `src/sim/vengeance.ts`; QUESTIONS §67 ANSWERED; 29/29 damage, 164/164
   transitions, 8/8 victim-inert. ⛔ **Only amount 25 has armed; 15 is REFUSED.**
   Re-opens as *"ask the user about Vengeance"*, *"Vengeance is n=2"*, or
   *"model Vengeance 15 as +15%"* — all wrong.

2. **⭐ `blockedMove`'s wiring stays FALSIFIED, now at 23 procs.** Current
   **6/23** vs 7.67 expected (p ≈ 0.31 — chance); next **2/23** (p ≈ 0.0067).
   **A soft prior, not an exclusion — two counterexamples stand.** Consumed
   nowhere in the strategy path. ⛔ **Do not commission runs for it**; it accrues
   for free.

3. **⚠ Is the rod carrying a DUNGEON stat line?** `hpMax` 51→50 and Sword ATK
   27→26 coincided with the 923→924 swap; all four session-130 openings read
   **50/17** on 924. **COINCIDENT, NOT PROVEN.** ⭐ **This session's revert to 812
   is the test that was never worth making on its own — TAKE THE READING.** If
   the opening returns to **51/27** on Golkan, the rod carries a combat stat line
   and every rod choice becomes a dungeon decision. **Pre-register it**: it costs
   nothing and the swap is happening anyway.

4. **⛔ `TieDamageReduction` stays HELD at n=1** — asked and answered 2026-09-12,
   roster stays eleven, enforced by `tests/boons.test.ts`'s
   `AWAITING_MODEL_DIRECTIVE`. **Do not re-ask without a second pickup.**

5. **⭐ PIN IN-SESSION.** 175 sites last session, green same-session. ⛔ Never
   defer the pin pass; pin only after the run-units and cast cap are spent.

6. **⛔ Three fresh patcher / formatting traps.** Do not let a pin patcher **write
   files before it has parsed every failure** — session 130's first run crashed
   after writing three; **snapshot `tests/` and diff against it.** Do not **strip
   outer brackets** re-formatting an array received value (`[[1,99],…]` became
   `[1,104], …`, a syntax error). And carried: anchor pins on the **matcher
   call**, never a bare numeric literal; ratio pins need **both halves** moved;
   never nest a `/* was */`.

7. **⛔ Do not read consecutive captures as consecutive EXCHANGES** — every
   `use_move` capture is followed by a duplicate with no events, which is how a
   first pass at `blockedMove` hid the whole finding. **`loadCorpus()` cannot
   answer any question about `data.events`** — it keeps `data.run` and drops
   `events`.

8. **⚠ `$TMPDIR` DIFFERS by sandbox mode** — **avoided last session** by using
   the scratchpad path throughout, after six consecutive sessions of cost. **Keep
   using the scratchpad path, never `$TMPDIR`.** Run the suite and git
   **UNSANDBOXED**.

9. **⚠ THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE** —
   `Bash(npx tsx scripts/liveRun.ts *)`, `liveFishing.ts`, `orchestrator.ts`. The
   user directed it cleared on 2026-09-11; it did not block anything last
   session, but it remains and **the path substring alone trips it.** An agent
   cannot edit its own permission rules. Mention once; do not re-litigate.

10. **⭐ THE ORCHESTRATOR'S DUNGEON ARM STAYS CLOSED** — "no dungeon run without a
    human in the loop". **[USER] Other dungeons are OUT OF SCOPE**; the 12-unit
    ledger is per-dungeon. **The Tier-1/Tier-3 income baseline stays RETIRED BY
    NAME** — per-room recording is not that experiment. **The `web/` front end**
    is untouched since session 120. **§0a NOT lifted; +19.40pp and +17.74pp MAY
    NOT BE QUOTED.**

---

## Recap — lead with these

- **⭐ The rod revert**: 812 equipped and confirmed by a live gear read, its
  durability, the `CURRENT_ROD` repoint, and `rodDeck.test.ts` going red on the
  repoint and green on the first Golkan cast — **in that order.**
- **⭐ The opening loadout on Golkan** against session 130's 50/17 — **51/27 or
  not** — and what that says about the rod carrying a dungeon stat line.
- **⭐ The SECOND gold-rotation point**: which faction charged, whether it was
  Foxglove (killing the permutation), and how the observed value scored against
  the pre-registered set and the shifted-map candidate.
- **Whether any SILVER moved on a Tier-3 entry** — it should not — and the
  Tier-3 shape count at **8/8**.
- **The Golkan card-coverage claim: resolved**, with both STATE entries corrected
  and the −0.389 / −0.400 discrepancy explained or retired.
- **The live gear reading** — never a forecast — and which of rod / ledger / gear
  bound the cast count.
- **That ONE authorization covered the session**, given in chat, not claimed, and
  what scope the user set.
- **Fishing: played vs charged separately**, Golkan casts as a **continuation** of
  183/307 with the era flagged.
- **Both small jobs done**: the runway line deleted, the `nextPosition` registry
  gap closed.
- **All ten carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim** (plus `--scope=diff` as an addition, never a substitute); suite
`vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**; `tsc --noEmit`;
`git diff --cached --check`; `discoveredShipsClean` 8/8. **Never trust a
`tail`-piped or notification exit code** — capture to a file and read `$?`.
