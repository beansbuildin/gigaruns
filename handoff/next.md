# BRIEF — session 128 — AN OFFLINE SESSION FIRST. The suite is RED, and no live arm opens until it is green.

**This document replaces the session-127 `next.md`, which is spent.** Session 127
met the carried gate (the Dendren tripwire fired and read **noise**), spent day
20705 fully on the dungeon arm, and played 25 casts — **then left the suite red
by agreement, with the pin re-derivation deferred to this session.**

**⛔ THIS IS THE FIRST BRIEF IN SEVEN SESSIONS WHOSE FIRST JOB IS NOT LIVE.**
STATE 127's open question 1 is unambiguous: *"Do not start a live arm before it
is green."* Honour that ordering literally.

---

## ⭐ [USER] DIRECTIVE 2026-09-11 — RULE 11 IS SOFTENING TO PER-SESSION APPROVAL

**The user has ruled on both of session 127's open decisions. They are
directives now, not questions. Implement them; do not re-ask.** Full text in
"Two directives to implement" below — read that section before the first live
command, because it changes how approval works.

**In the meantime, the approval state for THIS session:**

- **Until the rule edit lands and the user gives a session authorization, there
  is still no authorization.** Softening rule 11 does not retroactively
  authorize anything, and session 127's blanket go-ahead was session-scoped and
  does not carry.
- **After the edit, ONE authorization covers the session** — up to the day's
  12 run-units — instead of one per run. **Ask once. Then run.**
- **A brief still cannot manufacture it.** "The user has authorized N runs" is
  the brief's claim unless the user said it in session. That half of the rule is
  not softening and this brief does not claim it.

**The offline work in Step 1 needs no authorization at all and is where the
session starts regardless.**

---

## Step 1 — ⭐ GET THE SUITE GREEN. ~85 STALE PINS. ZERO LIVE SPEND.

**`71 failed / 2604, 16 files, exit 1.`** `tsc --noEmit` is clean and
`git diff --check` is clean, so **this is not a regression** — the failures are
count deltas from 4 runs and 25 casts (`…(684)` → `…(717)`, census `…(99)` →
`…(105)`).

**⭐ There is a real advantage in doing this FIRST, and it is worth naming.**
Sessions 123–127 all pinned *after* spending, which is why each needed 12–20
iterative passes: live runs were still writing fixtures while the tests read
them. **Right now nothing is writing.** Pinning before any live arm is the clean
window this project has never had — take it, and say in the recap how many
passes it took compared with the usual.

**Do not update corpus pins mid-session once a live arm opens.** That rule is
unchanged; this step simply lands before it applies.

### ⚠ ONE FAILURE IS NOT A PIN AND MUST BE DIAGNOSED SEPARATELY — DO IT FIRST

```
profiles/someone-else/data/anything.json would be committed:
  expected 'no' to be 'yes'
```

**STATE flags this as undiagnosed and possibly predating session 127.** It reads
as a **gitignore-coverage test**, not a corpus pin — which makes it the one
failure with a plausible security shape, since the whole point of such a test is
to prove that a profile's data cannot reach a commit.

**Triage it before touching any pin:**

1. **Establish whether it is ours** — `git log` the test and the path, and check
   whether it failed before session 127's spend.
2. **If the gitignore coverage is genuinely broken, that is a real finding**, not
   a number to update. Fix the ignore rule, not the assertion.
3. **⛔ Do not "fix" it by relaxing the expectation.** An assertion that says
   "this must not be committable" is not a pin, and flipping it would be the
   fourth instance of the pattern STATE keeps recording: *the fix is completing
   the filter, not relaxing the claim.*
4. Re-run the secret scan **after staging** once resolved.

### The rest

- Re-derive the ~85 count pins. Verify every set change is purely **ADDITIVE** by
  **MULTISET diff both ways**, and **report removals as removals** — that
  discipline has caught real changes before.
- **⛔ Do not "fix" `OBSERVED_OFFERS` source labels using the AFTER state.** Rows
  are keyed to the **BEFORE** label; using `after` once turned 35 new rows into
  `sourceMisses` (17 → 52).
- **⚠ `$TMPDIR` DIFFERS between sandbox modes and sandboxed `tsx`/`git` fail
  outright — this has cost cycles in FOUR consecutive sessions.** Run the suite
  and git **UNSANDBOXED**, `--maxWorkers=4`. Capture exit codes to a file and
  read `$?`; never trust a `tail`-pipe or a task notification, which reports the
  compound command.

**The gate for this step: `vitest run --maxWorkers=4` exits 0.** Report the
before/after counts and the pass number.

---

## Step 2 — TWO REPAIRS, and BOTH ARMS ARE BLOCKED WITHOUT THEM

**⚠ READ `checkGear.ts` LIVE BEFORE QUOTING ANY NUMBER BELOW.**

> **[NEW, STATE 127] A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT, NOT BY
> EXCEPTION.** Claim E failed for the **third straight session** — 641 and 905
> were repaired out of band (0 → 60 and 0 → 24) — and it **voided an entire
> ~200-word section** of the last brief instructing a "broken-gear arm" label
> that did not apply. **They were a clean-gear arm.**

So treat this table as a **prompt to ask the user**, not as fact:

| arm | piece | durability | consequence |
|---|---|---|---|
| **Fishing** | slot-15 pair | **0 / 0** | **ARM IS HALTED.** No batch until repaired. |
| Fishing | rod 923 | 13 | fine — 13 played casts |
| **Dungeon** | **901** | **2** | **BREAKS ON RUN 1** (needs 3, clamps to 0) → halt after one run |
| Dungeon | 640 | 10 | 3 runs |
| Dungeon | 905 | 12 | 4 runs |
| Dungeon | 641 | 48 | 16 runs |

**Without repairs the live day is: ONE dungeon run, then a halt. Zero fishing
casts.** Raise both repairs to the user **in the same message as the scope
question** — one message, not three.

⚠ **`checkGear.ts` prints a HALT banner permanently and it is not an arm halt.**
**Item 50, slot 8, sits at 0 and belongs to NEITHER wear set** — unmoved across
4 runs and 25 casts. **Check WHICH slot before believing the banner.**

---

## Step 3 — if and only if a live arm is authorized: read the clock first

**⭐ THE FACTION IS A FUNCTION OF THE ROLLOVER CLOCK.** Run
`npx tsx scripts/checkEntryTiers.ts` and read `next day in HH:MM:SS` before
accepting any faction framing.

⚠ **The REASON for this habit has changed.** It used to be about protecting a
scarce ring. Per the [USER] directive below, **ring balances are no longer a
constraint** — the clock read now exists only so you know **which faction to
expect in the balance diff**, which is how the charge shape is verified. Keep the
read; drop the scarcity framing.

**At this brief's writing (2026-09-11T16:07Z):**

| | day | dow | faction | balance |
|---|---|---|---|---|
| now, **~1h50m left** | 20706 | 7 | **Archon (138)** | 24 |
| from 18:00Z, full 24h | 20707 | 1 | **Crusader (135)** | 27 |

**Step 1 will most likely consume the Archon window**, and that is fine — a full
day is a better container for live work than a sliver. **But read the clock and
report which day you are actually on; do not assume either.** ⛔ **Do not weigh
the two days by ring balance** — see the directive below.

⚠ **THE FISHING AND GAME DAYS ROLL AT THE SAME INSTANT** — 11:00 PT == 18:00Z.
Two instruments print it in two formats (`hours until next reset: 0.62` vs
`next day in 00:36:50`). **A batch started near the boundary straddles BOTH
ledgers**, which is exactly what happened last session: the cap reset mid-batch
and handed it a fresh 20.

### Claims to verify — rule 9

| # | Claim | value |
|---|---|---|
| A | Day / dow / faction | **per the clock** |
| B | Rings total **183**: Athena **9**, Chobo 18, Archon 24, Crusader 27, Summoner 30, Foxglove 33, Overseer 42 — **read as a MEASUREMENT, not a budget** | read live |
| C | Run-units fresh **0 of 12** | `dayProgressEntities` |
| D | Fishing ledger — **read it, do not assert a number** | `checkFishingCaps.ts` |
| E | Gear — **read live per Step 2** | `checkGear.ts` |

⚠ **Claim D failed last session because THE BRIEF CONTRADICTED ITSELF** — its
table said "fresh 0/20" while its own body said 18 available. **Check a brief's
internal consistency before treating a mismatch as a spec error.** The live
reading was 2/20 and the body was right.

⚠ **`checkFishingCaps.ts`'s cast counter tracks CHARGED casts and its energy
counter tracks PLAYED ones.** Both correct; reads as broken if skimmed.

### If runs happen

Pre-register in a git commit before any spend — **seven sessions running**, and
every dungeon forecast landed exactly last time. `--dry-run` once (rule 4);
`--runs=1 --juiced --juiced-index=2`; **ask between runs unless the user gives a
fresh blanket authorization in session.** Rule 8 on in-room picks; rule 13 on any
denial. Charge shape stands at **41/41**.

### If a fishing batch happens

Only after the slot-15 repair. **The `castCap: 2` convention is NOT a safety rule
in itself** — it exists because a dry rod injects `BASE_DECK` mid-batch
unnoticed, and **that hazard needs the rod to reach 0.** At rod 13, a batch of
**13 or fewer played casts cannot reach it**; beyond that it can. Size the cap to
the rod, deliberately, as `SESSION_127_LIMITS` did at 25. **`--casts=N` is
silently overridden by `--oil-batch`** while the banner prints `args.casts` — set
`castCap`, not `--casts`.

Oils Relaxing-only; Focus off the allowlist, triggers log **policy-withdrawn**.
Standing budget 360 energy / 30 casts.

---

## ⭐ Step 4 — THE OFFLINE QUEUE IS NOW THE INTERESTING WORK, AND IT KEEPS SLIPPING

Three of these have gone untouched for two or more sessions because live arms
always came first. **This session's ordering finally favours them.** All are
zero live spend and answerable from committed fixtures under rule 4.

1. **⚠ Wire `blockedMove` into the opponent model.** UNTOUCHED for two sessions.
   The server names the **ENEMY's** excluded move (`playerId` 1 on all 18) and
   the field is consumed **nowhere in `src/`** — the model still prints a full
   three-way distribution over a move already ruled out. ⚠ **Scope it: whether
   the exclusion binds the CURRENT exchange or only the NEXT is NOT settled by
   the fixtures and must be measured.** EV is small by construction (~0.22–0.5%)
   — **do it for correctness, and do not spend a run on it.**

2. **⚠ What is the 25% mitigator?** 73 exchanges take `floor(atk × 0.75)` with
   **no proc flag**, 72 of them with no intuition at all. Untouched for two
   sessions; **the single largest unexplained regularity in the combat corpus.**
   ⛔ **Do not name it without measuring it**, and do not attribute it to
   intuition — that error has been made three times and each fix was *completing
   the filter, not relaxing the claim*.

3. **⭐ `VulnerableMastery` is the sharpest lead — but it needs COLLECTION, not
   analysis.** atk 39 with Vulnerable 1 dealt **52** where `floor(39×1.25)` = 48;
   splitting on whether `VulnerableMastery` was active separates it perfectly
   (**ABSENT 84/84 obey, ACTIVE 0/1**). **Its `val1` never rolls, so more pickups
   will not separate 4/3 from 1.35 from "+4" — only exchanges at DIFFERENT `atk`
   values will.** Say this plainly rather than queuing offline work that cannot
   succeed; it is a reason to watch future runs, not to analyse today.

4. **The `web/` front end has still never spawned a real script** — untouched
   since session 120. `cd web/server && npm install && npm run dev` against the
   Setup/Status tabs.

---

## ⭐⭐ TWO [USER] DIRECTIVES TO IMPLEMENT — 2026-09-11. Not questions. Do them.

### 1. CLEAR THE `ask` BLOCK, AND SOFTEN RULE 11 TO MATCH. Both halves, together.

**The user's words: *"clear the block and soften rule 11."*** Session 127 flagged
that changing one without the other makes the repo contradict its own config.
The user has answered: **change both.**

**The config half is the USER'S edit — an agent CANNOT make it.** The auto-mode
classifier blocks an agent editing its own permission rules, correctly, and that
is not something to work around. **Tell the user exactly what to remove:** the
`ask` block in `.claude/settings.local.json` naming `liveRun.ts`,
`liveFishing.ts` and `orchestrator.ts`. `ask` **overrides** `allow`, and
`Bash(npx tsx *)` is already allowed, which is why those three prompted on every
invocation regardless of any authorization given in chat.

**The CLAUDE.md half IS the session's job.** Edit rule 11 and the "Ask first"
entry so approval is **PER SESSION, not per run**:

- **What changes:** *"One run, then stop and hand back. Never chain."* and
  *"Approval for one run is never approval for the next."* become a **single
  authorization covering a session's runs, up to the server's 12 run-unit daily
  cap.** Ask once; then run consecutively without pausing.
- **⛔ What does NOT change, and must be preserved in the edited text:**
  - **A human still authorizes each SESSION.** The softening removes the
    per-run prompt, not the human. **A brief may still never manufacture the
    authorization** — "the user has authorized N runs" without the user saying
    it in session stays wrong, and that entry stays in the do-not-re-open digest.
  - **Rule 5, fail closed.** Unknown enum, 5xx, three consecutive action
    failures, a cap hit → stop, log the body, exit non-zero. No-prompt is not
    no-halt.
  - **Rule 13.** Read the ledger before believing a denial; never retry on one.
  - **Rule 4**, rule 8, the 12-run-unit cap, and every other "Ask first" item —
    ETH spends, selling or burning items, skill points — all untouched.
  - **The gear halt** stays exactly as written: never abort a run in progress;
    after a COMPLETED run a piece at 0 stops that arm.

**⚠ FLAG THE KNOCK-ON EXPLICITLY — IT IS THE ONE THING THAT COULD GO WRONG
QUIETLY.** CLAUDE.md states that `scripts/orchestrator.ts`'s dungeon arm is
disabled **because** *"a rule requiring per-run human approval cannot be
satisfied by an autonomous loop."* **Softening rule 11 removes that stated
reason.** It does **not** follow that the arm should reopen, and this brief's
position is that it should **STAY CLOSED**: a session authorization is still a
human act at the start of a session, whereas an orchestrator-initiated run
involves no human act at all — a different safety property entirely.

**So: rewrite that paragraph to rest the closure on its real reason** (no
bot-initiated dungeon run without a human in the loop), rather than leaving it
resting on a clause that no longer exists. **Do not reopen the arm.** If the
edit makes it reopenable, say so and hand that decision to the user separately.
Note also that CLAUDE.md ties the permanent potions block to this closure — that
stays true while the arm stays closed.

**Record it:** `DECISIONS.md` dated 2026-09-11, marked `[USER]`, and update
STATE's **"Settled — do not re-open"** entry, which currently reads *"EVERY
DUNGEON RUN NEEDS ITS OWN GO-AHEAD"* — that phrasing is now **wrong** and must be
replaced, not annotated. Re-opens as: *"ask before each run"* or *"restore the
per-run prompt"*.

### 2. RING BALANCES ARE NO LONGER A CONSTRAINT. STOP TREATING THEM AS ONE.

**The user's words: *"ignore the balances I can get more rings if needed."***

**⛔ Retire, immediately and everywhere:**

- **The Athena/Tier-1 runway question.** STATE 127's open question 8 recommended
  putting Tier-2-vs-Tier-1 to the user before the next Athena day. **The user has
  pre-emptively answered it. Do not raise it — not now, not on day 20712.**
- **"X is the scarcest ring"** as a reason to do anything: to prefer one day over
  another, to defer a run, to drop to Tier 1, or to flag a spend as costly.
- **Runway tables**, "N full days left at 4 runs", and every variant. CLAUDE.md
  rule 11's runway arithmetic is now **descriptive background, not a decision
  input**.

**✅ KEEP reading all seven balances before and after every run.** This is the
distinction that matters and it is easy to get wrong: **balances are a
MEASUREMENT INSTRUMENT, not a budget.** The ring debit does **not** appear on the
wire — `gameItemBalanceChanges` carries nothing for rings — so a before/after
balance read is **the only way to verify the charge shape** (one faction, exactly
3, six untouched), which stands at **41/41** and is a live claim. Losing that
read would lose the shape claim.

**Record it:** `DECISIONS.md` dated 2026-09-11, `[USER]`, and STATE's digest.
Re-opens as: *"the ring runway is a concern"*, *"consider Tier 1 to save rings"*,
or *"Athena is the scarcest ring"* — all three are now wrong on their own.

---

## Carry forward — name each in the recap

1. **⭐ THE DENDREN TRIPWIRE IS FIRED AND ANSWERED: NOISE.** n = 101, **52.5%**,
   inside the pre-registered 50–65% band. **Nothing to escalate; do not re-raise
   it.** Quote all three slices or none: **Dendren 53/101 = 52.5%**, **Golkan
   183/307 = 59.6%**, **pooled 270/534 = 50.6%**. The Dendren-vs-Golkan gap is
   confounded by era and n, and ⛔ **no live study either way** — the sim settled
   it (+3.23pp [2.92, 3.55], n=40k/arm) and detecting 3pp live needs ~87
   sessions.

2. **⚠ §71's POOLED MARGIN MOVED after holding at −1 for three sessions — it is
   now 0.** Dendren-only is **−2** at n=101 (was −3 at n=76); Golkan −5, base +1,
   legacy +6. **[USER] HOLD — report both slices, do not decide, do not retire or
   rescope.**

3. **⛔ ELEVEN latent boon types now, not ten** — `TieDamageReduction` joined
   last session, caught by `tests/boons.test.ts`'s "has a pair but no model".
   With `Thorns`, `CritHeal`, `Intimidating`, `BurningTenacity`, `RegenMastery`,
   `VulnerableMastery`, `WeakeningBlock`, `LossLuckUp`, `IntuitionArmor`,
   `AddWeakShield`. **Default HOLD; n=1 needs a [USER] directive.**

4. **⛔ DO NOT RECORD A FOURTH FISHING-REFUSAL POINT FROM SESSION 127.** The batch
   straddled the 18:00Z rollover (17:59:06Z → 18:05:30Z), which reset the day cap
   mid-batch and handed it a fresh 20 — **the boundary (day-cast 24/25/27) was
   never approached and none was reachable.** A missing refusal is not evidence
   about the boundary.

5. **⛔ Do not compute a Dendren catch rate from `loadFishingCorpus()`** — its
   items have no `.turns`, so `splitByDealtDeck` throws. The working path is
   `loadCastTraces()` → `splitByDealtDeck(...).rod` → `deckOf()` from
   `scripts/redrawDeckSlice.ts`, then count `t.caught`. And **do not read
   `fishBatchReport.ts` for a corpus-wide rate** — it is SESSION-scoped and
   printed `catch rate 0.0%` before any cast.

6. **Move charges: ABSENT.** No `gameItemBalanceChanges` for rings on the wire;
   the ring spend is observable only by reading balances before and after.
   Unchanged since session 112. **Do not look for the ring debit on the wire.**

7. **⚠ JWT expires ≈ 2026-09-12T16:40Z — roughly 24 HOURS from this writing.**
   Verify with `npx tsx scripts/doctor.ts`, record expiry and runway in the recap
   and STATE, and **tell the user plainly if a live arm would run close to it.**

8. **[USER] Other dungeons on this account are OUT OF SCOPE.** The 12-run-unit
   ledger is per-dungeon. **The rotation is fully measured, all seven cells** — a
   brief proposing rotation work is wrong; do not re-fit an arithmetic rule or
   re-hunt the advance faction-indicator field.

9. **Carried, unchanged:** §0a is NOT lifted, and **+19.40pp and +17.74pp MAY NOT
   BE QUOTED.**

---

## Recap — lead with these

- **The suite: red-to-green.** Failing count before and after, how many passes it
  took, and **whether pinning before any spend was cheaper than the usual 12–20
  iterative passes** — that comparison is the point of the ordering.
- **The `profiles/someone-else/...` failure: diagnosed, and whether it was ours,
  predated session 127, and was a real gitignore hole or not.** Say which, and do
  not report it alongside the pins as if it were one.
- **Both repairs: whether they were raised in the same message as the scope
  question, and what the user did.** Then the LIVE gear reading — never the
  forecast.
- **Whether any live arm was authorized at all**, and if so: the clock reading,
  the day and faction, Claims A–E each pass or fail, the pre-registration hash,
  per-run detail and the shape count.
- **The two [USER] directives: DONE, not discussed.** The CLAUDE.md rule-11 edit
  (with the orchestrator paragraph rewritten and the arm still CLOSED), the
  `ask`-block removal handed to the user with the exact lines to delete, and both
  recorded in DECISIONS and STATE — including replacing STATE's now-wrong "every
  dungeon run needs its own go-ahead" entry.
- **Any offline-queue item actually moved**, and for `VulnerableMastery`, the
  statement that it needs different-`atk` exchanges rather than more pickups.
- **All nine carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim**; suite `vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**;
`tsc --noEmit`; `git diff --check`. **Never trust a `tail`-piped or notification
exit code** — capture to a file and read `$?`.
