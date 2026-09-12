# BRIEF — session 129 — a CRUSADER day, the JWT dies before it does, and a ROD SWAP to Puppeteer (924)

**This document replaces the session-128 `next.md`, which is spent.** Session 128
took the suite green **and** spent a full live day — 12/12 run-units at
**0/272 = 0.00% first-attempt failures**, the best rate on record — implemented
both [USER] directives, and turned three of its findings into real answers rather
than pins.

---

## ⏱️⚠️ STEP 0 — THE JWT IS THE BINDING CONSTRAINT, NOT THE DAY. CHECK IT FIRST.

**`npx tsx scripts/doctor.ts`, before anything else.**

STATE 128 recorded the token as valid to **≈ 2026-09-12T16:45Z**. At this brief's
writing (**2026-09-12T14:51Z**) that is **about 1 hour 50 minutes** — and the
game day does not close until **18:00Z, about 3h 10m away.**

**So the token expires roughly 75 minutes BEFORE the day does.** That is the
whole shape of this session:

- **If the JWT is live:** the usable window is the runway, not the day. Session
  128 fit four runs into **33 minutes** and session 127 into 36, so a full
  12/12 is comfortably achievable inside ~1h45m — but only if Step 1 is fast and
  the pre-registration is four lines.
- **If it has expired:** **stop. Spend nothing.** Tell the user directly, in
  chat, that `~/.secrets/gigaverse-jwt.txt` needs a fresh token from their
  browser. Do not probe with a live call — a 401 tells you nothing `doctor.ts`
  did not. Then go to the offline queue (Step 5), which needs no token at all.
- **Either way, record the expiry and runway in the recap and STATE.** Session
  128 did this correctly; 123 and 124 did not.

**Say the remaining runway to the user in your first message**, alongside the
scope question and the gear reading. One message, not three.

---

## Step 1 — read everything, fast, before the first `start_run`

`checkDungeonToday.ts` · all seven balances · `checkFishingCaps.ts` ·
**`npx tsx scripts/checkGear.ts`** · `checkEntryTiers.ts` for the rollover clock.

**⭐ THE FACTION IS A FUNCTION OF THE ROLLOVER CLOCK** — read
`next day in HH:MM:SS` before accepting any faction framing. Not to protect a
ring (balances are no longer a constraint) but so you know **which faction to
expect in the balance diff**, which is the only check on the charge shape.

**At writing:**

| | day | dow | faction |
|---|---|---|---|
| now, ~3h10m left | **20707** | **1** | **Crusader (135)** |
| from 18:00Z | 20708 | 2 | Overseer (136) |

### Claims to verify — rule 9

| # | Claim | value |
|---|---|---|
| A | Day / dow / faction | **per the clock** |
| B | Rings total **171**: Athena 9, Archon 12, Chobo 18, Crusader **27**, Summoner 30, Foxglove 33, Overseer 42 — **an INSTRUMENT, not a budget** | read live |
| C | Run-units fresh **0 of 12** (day 20706's 12/12 reset at 18:00Z) | `dayProgressEntities` |
| D | Fishing ledger fresh **0/20 charged** | `checkFishingCaps.ts` |
| E | Gear — **see Step 2. Do not assert it; read it.** | `checkGear.ts` |

⚠ **`checkFishingCaps.ts`'s cast counter tracks CHARGED casts; its energy counter
tracks PLAYED ones.** Both correct; reads as broken if skimmed.

---

## Step 2 — ⛔ I AM NOT GOING TO ASK FOR A REPAIR. READ THE GEAR AND DECIDE.

**This brief is deliberately breaking a pattern.** STATE 128:

> **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — now FOUR sessions running, and
> this time BOTH of its repairs were unnecessary.** 901 read 24 not 2; the
> slot-15 pair read 30/20 not 0/0.

Twice now a brief has opened with "raise these repairs up front" and twice the
user had already repaired out of band, so the request was noise. **A fifth
repetition would be the brief failing the same way on purpose.**

**So the instruction is inverted: read `checkGear.ts` FIRST, then raise a repair
only if the live numbers call for one.**

For orientation only — **session 128's closing values, which may already be
stale:**

| arm | piece | close | note |
|---|---|---|---|
| **Dungeon** | **640** (slot 11) | **0** | arm halted at close |
| **Dungeon** | **905** (slot 13) | **0** | arm halted at close |
| Dungeon | 641 | 36 | 12 runs |
| Dungeon | 901 | 12 | 4 runs |
| Fishing | rod 923 | **10** | **10 played casts, then zero** |
| Fishing | slot-15 pair | 30 / 20 | healthy |

**If the dungeon pieces are still at 0**, that arm is halted and needs one repair
before run 1 — raise it **in the same message as the scope question and the JWT
runway**. **If they have been repaired, say so as a claim-E note and move
straight on.** Either way the live read is the fact; the table above is not.

⚠ **`checkGear.ts`'s HALT banner is not automatically an arm halt.** Check WHICH
slot. The halt is **PER-ARM**, and pieces already at 0 at session open are
**GRANDFATHERED** — they never abort a run in progress, and a started run always
finishes.

---

## Step 3 — authorization, and what the softening did NOT change

**⭐ [USER], as of 2026-09-11: APPROVAL IS PER SESSION, NOT PER RUN.** One
authorization covers this session's runs up to the server's 12-run-unit daily
cap. **Ask once, then run consecutively without pausing.**

**⛔ What did not soften, and this brief is bound by it:**

- **A human still authorizes each session, in session.** Authorization does
  **not** carry forward, and **a brief may never manufacture it** — "the user has
  authorized 4 runs" is the brief's claim unless the user said it in chat.
  **This brief does not claim it.** The user asked for "the next live session";
  that is a scope, so **ask once** and then go.
- **Rule 5, fail closed** — unknown enum, 5xx, three consecutive action failures,
  a cap hit → stop, log the body, exit non-zero. **No-prompt is not no-halt.**
- **Rule 13** — read the ledger before believing a denial; never retry on one.
- **The per-arm gear halt**, rule 4, rule 8, the 12-unit cap.

⚠ **THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE.** The user
directed it cleared on 2026-09-11; **it has not been.** It blocked two commands
last session outright — including `vitest run tests/orchestrator`, where the
**path SUBSTRING alone was enough** to trip it. **An agent cannot edit its own
permission rules.** Mention it once, with the exact lines to delete (the `ask`
entries naming `liveRun.ts`, `liveFishing.ts`, `orchestrator.ts`), and carry on
— do not let it become a third session's discussion.

**⭐ THE ORCHESTRATOR'S DUNGEON ARM STAYS CLOSED.** The softening deleted the
clause the closure used to rest on; all four sites now rest it on *"no dungeon
run without a human in the loop"*, which the softening does not touch.
Re-opening it is a **separate [USER] decision** and is not on this session's
table.

---

## Step 4 — pre-register, then spend

**Eight sessions running** (`825a8389` last time), and every dungeon forecast
landed at **all four readings**. Write `handoff/scratch-session-129.md`,
`git commit`, quote the hash, confirm it predates the spend. No addresses, no
usernames, no JWT fragments.

**Four lines is enough when the clock is short** — the commit's value is the
timestamp:

1. **Day, dow, faction**, read off the clock.
2. **The ring path** — opening balance, −3 per run, sole mover, six untouched.
3. **The gear path** — per run at −3 on slots 11/12/13×2, **and the break run if
   one lands**, computed from the LIVE read.
4. **The charge shape, 45/45 → 49/49** after four runs.

### The dungeon runs

`--dry-run` once (rule 4), then `--runs=1 --juiced --juiced-index=2`, four times,
**consecutively — no pause between them** once the session authorization is
given. **Read all seven balances after each run** and continue; report the four
reads together at the end.

### ⭐⭐ [USER] DIRECTIVE 2026-09-12 — SWAP TO PUPPETEER'S ROD (924) BEFORE FISHING

**The user's call: try the Puppeteer rod, the highest tier, instead of the
Dendren rod.** This replaces the earlier idea of reverting to Golkan.

**⭐ THE DECK IS ALREADY KNOWN — NO DISCOVERY CAST IS NEEDED.** Session 123 read
every rod's grants off `/offchain/static` in one call, so
`ROD_CARD_GRANTS[PUPPETEERS_ROD = 924] = [101…110]` is already in
`src/sim/fishing/rodDeck.ts`, and cards 101–110 are already in
`fixtures/fishing-casts/cards.json`. ⛔ **Do not plan a cast to "recover the
Puppeteer geometry" — it is committed.** That is the same error session 123 made
about Dendren, the third instance of *"right endpoint is one over"*.

**⭐ IT IS POSITIONALLY IDENTICAL TO GOLKAN AND DENDREN** — the same ten
hit-zone sets, the same `manaCost: 1` on all ten, the same shape. **So this is
the session-99/123 pattern: geometry-keyed numbers TRANSFER; only damage
magnitude does not.** The zone template, matcher, focus/reachability and movePath
statistics all carry across; **only the damage economy forks into a new era.**
Say this explicitly rather than reporting "a new deck" as a full break.

| card slot | Golkan | Dendren | **Puppeteer** |
|---|---|---|---|
| 3-zone lines ×6 | 6 / −3 | 7 / −4 | **8 / −4** |
| [1,3,7,9] | 7 / −4 | 9 / −4 | **10 / −5** |
| [2,4,6,8] | 8 / −4 | 9 / −5 | **11 / −5** |
| ring, 8 cells | 4 / −4 | 5 / −4 | **6 / −5** |
| centre crit | 12 / −3 | 14 / −4 | **16 / −4** |

*(hit damage / miss heal-to-fish, from the committed fixture)*

**⭐ WHY THIS ALSO EXPLAINS THE DENDREN UNDERPERFORMANCE — worth recording in
DECISIONS, because it corrects a live-vs-sim reading.** Expected fish-HP change
per play, computed off the fixture at aim skill `s` (0 = random aim):

| deck | s=0 | s=0.2 | s=0.4 | s=0.6 |
|---|---|---|---|---|
| Golkan | −0.400 | −1.660 | −2.920 | −4.180 |
| Dendren | −0.300 | −1.820 | −3.340 | −4.860 |
| **Puppeteer** | **−0.678** | **−2.362** | **−4.047** | **−5.731** |

**Dendren raised hit damage by 1 but ALSO raised the miss heal by 1.** Below an
aim skill of **s ≈ 0.077** that makes it WORSE than Golkan — and the corpus's
observed hit rate (**39.9%**) sits essentially on the random-aim baseline
(**38.9%**), i.e. **s ≈ 0.02, below the crossover.** So the live Dendren-vs-Golkan
gap (51.9% vs 59.6%) has a **mechanism**, not just noise, and the sim's
+3.23pp-for-Dendren result quietly assumed aim the bot does not have.
⚠ **This is deck arithmetic, not a measurement** — it ignores the focus meter,
turn economy, fish HP pools, oils and redraw, and weights the ten cards equally
where `cardChoice.ts` does not. **The direction is robust; the magnitudes are
not. Do not quote these as measured values.**

**Puppeteer wins at EVERY aim level, including random**, so no crossover applies.

### The swap — steps, in order

1. **The user equips 924 in slot 14.** An agent cannot equip gear; confirm it
   happened by reading `checkGear.ts`, not by assuming.
2. **Read 924's durability LIVE.** It is unknown — do not carry Dendren's 10
   across, and do not assume a full bar.
3. **Repoint `CURRENT_ROD` / `REAL_DECK` to `PUPPETEERS_ROD` (924).**
   `tests/fishing/rodDeck.test.ts` exists precisely to fail when the constant no
   longer matches the rod held in the most recent recorded cast — **let it be the
   check, and expect it to go red until the repoint lands.**
4. ⛔ **Do NOT add the three legacy rods (49/50/336) to `ROD_CARD_GRANTS`** while
   doing this. The gear array carries Stone Rod (50) beside the active rod, so a
   complete table makes "exactly one KNOWN rod" ambiguous. **Resolve by SLOT
   first** — session 128's documented trap.
5. **Pre-register the expected per-play drift** from the table above, then report
   the measured value against it. That turns the swap into a test rather than a
   preference, and it is free.

### The batch itself

- **Set `castCap` to the LIVE rod durability**, not to 30. `--casts=N` is
  **silently overridden by `--oil-batch`** while the banner still prints
  `args.casts` — set the cap, not the flag. `SESSION_127_LIMITS` ran 25 and
  `SESSION_128_LIMITS` ran 3, both deliberately; add a `SESSION_129_LIMITS` the
  same way.
- **The `castCap: 2` convention is NOT a safety rule in itself.** It exists
  because a **dry rod injects `BASE_DECK` mid-batch unnoticed**, and that hazard
  needs the rod to hit 0 **with casts still to play**. A batch sized exactly to
  the rod cannot do that.
- **On a fish-to-zero halt: stop, hand back, wait for a manual repair**, then
  resume with a **fresh live durability read**.
- **Report played and charged separately.** Standing budget 360 energy / 30
  casts; the rod is the real cap.
- **Report the catch rate as a FOURTH slice** — Puppeteer alongside Dendren
  54/104 = 51.9%, Golkan 183/307 = 59.6%, pooled 271/537 = 50.5%. ⛔ **Do not
  pool Puppeteer casts into the Dendren figure**, and expect n to be far too
  small to conclude anything on day one.

Oils **Relaxing-only**; Focus off the allowlist, triggers log
**policy-withdrawn**; autonomous within `dendren.oils` with `policyApproved`
true. 22 Relaxing held, 0 consumed last session.

---

## Step 5 — the offline queue. THIS IS ALSO THE NO-TOKEN FALLBACK.

**If the JWT has expired, this is the whole session** — none of it needs a token
or a single unit of spend.

1. **⚠ Wire `blockedMove` into the opponent model — UNTOUCHED FOR A THIRD
   SESSION.** The server names the **ENEMY's** excluded move (`playerId` 1 on all
   18) and the field is consumed **nowhere in `src/`**, so the model still prints
   a full three-way distribution over a move already ruled out. Free EV, pure
   strategy, sim-testable under rule 4. ⚠ **Scope it: whether the exclusion binds
   the CURRENT exchange or only the NEXT is NOT settled by the fixtures.**
   **Three sessions of deferral is the signal that it needs doing first, not
   last.**

2. **⚠ The residual TWO `Weak`-outside-bucket exchanges.** Both exactly 2 under
   prediction, no flags, **both PREDATING the `TieDamageReduction` pickup** — so
   that boon does not explain them. n=2, **deliberately not fitted.** Free to
   look at; ⛔ do not name a mechanism from two observations.

3. **⭐ `VulnerableMastery` needs COLLECTION, not analysis.** Its `val1` never
   rolls, so **more pickups will not separate 4/3 from 1.35 from "+4" — only
   exchanges at DIFFERENT `atk` values will.** A reason to watch future runs; not
   offline work that can succeed today. Say so rather than queueing it again.

4. **The `web/` front end has still never spawned a real script** — untouched
   since session 120. `cd web/server && npm install && npm run dev` against the
   Setup/Status tabs.

---

## One [USER] question to put forward — and only one

**⭐ `TieDamageReduction` HAS AN OBSERVED EFFECT NOW AND NEEDS A DIRECTIVE TO
MODEL.** It is the **first held type whose conditional has been observed**, so it
is no longer the usual "latent no-op at n=1" ask:

- **Measured: −2 on TIES, 3/3, holder-only**, composing **after** the Weak
  multiplier. Non-ties and the other side of those same ties are exact.
- **⚠ The name got the TRIGGER right and the MAGNITUDE wrong.** Reduction was
  **2** while `selectedVal1` was **8**, so *"reduce by val1"* is **FALSIFIED.**
- **⛔ Even a "yes" does not finish it.** It rolls 7–10, so **a second pickup is
  needed to say what the 8 governs.** Put that caveat in the same message as the
  question so a yes is not mistaken for a solved model.

**Do not ask about anything else.** The ring runway, Tier-1-vs-Tier-2, and the
catch rate are all retired or answered — see carry-forward.

---

## Carry forward — name each in the recap

1. **⭐ THE 25% MITIGATOR IS IDENTIFIED AND IT IS `Weak`.** 343/343 of the
   `floor(atk × 0.75)` bucket carry `Weak > 0` **on the ATTACKER**; zero carry no
   Weak. **⛔ Do not re-open it**, and note *why* it hid for four sessions: the
   bucket was described by an **ABSENCE** ("carries no proc flag" — true, and
   irrelevant, because `Weak` is a STATUS). **Do not describe an exchange
   population by what it does NOT carry.**

2. **⚠ `critProc1` is in `procEffectSize`'s intuition exclusion — the FOURTH
   completion of that filter, not a relaxation.** `atk 22 → taken 44` is the
   ATTACKER's crit, an amplification, and the old exclusions covered only player
   0's side. *"Intuition interacts with crit"* — it does not.

3. **⭐ [USER] RING BALANCES ARE NOT A CONSTRAINT.** Retired: the Athena/Tier-1
   runway question (**not on day 20712 either**), "X is the scarcest ring" as a
   reason for anything, and every runway table. ✅ **Keep reading all seven
   balances before and after every run** — the debit is **not on the wire**, so
   that read is the only check on the charge shape.

4. **⚠ §71 K=10 — quote BOTH slices.** **Pooled −1**, having come in at 0, held
   at 0 through four runs, then moved when the 3-cast tail took b10's
   `sacrifices` 8 → 9. **Dendren-only −3** at n=104 (was −2 at n=101); Golkan −5.
   **[USER] HOLD — report, do not decide, do not retire or rescope.**

5. **Catch rate: quote all three slices or none.** **Dendren 54/104 = 51.9%** —
   still inside the pre-registered **50–65% noise band** — **Golkan 183/307 =
   59.6%**, **pooled 271/537 = 50.5%**. The tripwire has fired and returned
   noise. ⛔ **Do not re-raise it and do not commission a live study**; detecting
   the real 3pp effect needs ~87 sessions.

6. **⭐ PINNING ONE DAY'S SPEND IS CHEAP — 3 passes. THE BACKLOG WAS THE COST —
   19.** So **pin this session's spend in this session**; do not defer it again.
   Pin only after the run-units and the cast cap are spent, never mid-arm.

7. **⚠ `$TMPDIR` DIFFERS between sandbox modes — FIFTH consecutive session it
   cost cycles.** **Use the scratchpad path, not `$TMPDIR`,** for anything that
   must survive a sandbox-mode switch. Run the suite and git **UNSANDBOXED**.

8. **Four new tooling dead ends from last session, all cheap to re-walk:**
   ⛔ do not auto-patch a `toBeCloseTo` whose expectation is a **RATIO**
   (`908 / 1242`) — a naive patcher replaces the numerator with the whole
   decimal, and three sites were mangled; ⛔ do not run a pin patcher **twice**
   over the same line — it nests `/* was X /* was Y */ */`, a parse error;
   ⛔ do not read a **lethal-clamped `fishHp` delta** as the damage (`FISH_HP_DIFF`
   is the truth — the card-94 Δ-10 closes the crit interval to EMPTY and reads as
   a false falsification); ⛔ do not trust **`git check-ignore` under the
   sandbox** — it exits 128 and `&& echo yes || echo no` turns that into a
   phantom security finding, which is exactly what the `profiles/someone-else`
   failure was.

9. **[USER] Other dungeons on this account are OUT OF SCOPE.** The 12-run-unit
   ledger is per-dungeon. **The rotation is fully measured, all seven cells** — a
   brief proposing rotation work is wrong.

10. **Carried, unchanged:** §0a is NOT lifted, and **+19.40pp and +17.74pp MAY
    NOT BE QUOTED.**

---

## Recap — lead with these

- **The JWT: expiry, runway, and whether it bound the session before the day
  did.** If it expired, say that plainly and what was done offline instead.
- **The live gear reading** — and, if the dungeon arm was halted, whether the
  repair was raised in the same message as the scope question and the runway.
  **Do not report a forecast as a fact.**
- **That the session used ONE authorization**, per the softened rule 11, and that
  it was given in chat rather than claimed by the brief.
- **The clock reading, the day and faction**, Claims A–E each pass or fail, the
  pre-registration hash, per-run detail, the shape count at **49/49**.
- **The Puppeteer swap**: that 924 was equipped and confirmed by a live gear
  read, its durability, the `CURRENT_ROD` repoint and `rodDeck.test.ts` going
  green, the pre-registered per-play drift against the measured one, and the
  catch rate as a **fourth slice** — never pooled into Dendren's.
- **Fishing: played vs charged separately**, the `castCap` chosen and why, and
  whether the fish-to-zero halt fired at the rod's own number.
- **`TieDamageReduction` put to the user** with the "a yes still needs a second
  pickup" caveat attached.
- **Whether `blockedMove` moved** — a fourth deferral should be stated as one.
- **All ten carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim**; suite `vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**;
`tsc --noEmit`; `git diff --check`; `discoveredShipsClean` 8/8. **Never trust a
`tail`-piped or notification exit code** — capture to a file and read `$?`.
