# STATE — session 129 — 2026-09-12 — commit <SHA>

## Status
No numbered TASKS.md gate; tasks 1–14 are GATE MET or parked on data. The
session worked `handoff/next.md`'s session-129 brief, which was CURRENT.

**⭐ GATE PASS. The full live day was spent AND the suite was left GREEN** —
**2674 passed / 2674, exit 0**, `tsc --noEmit` exit 0, `git diff --check`
exit 0, `discoveredShipsClean` 8/8.

**The dungeon arm is a full PASS: 12/12 run-units, 4 juiced Tier-2 runs,
254 actions, 0/254 = 0.00% first-attempt failures**, and **every
pre-registered forecast landed EXACTLY at all four readings.** The fishing arm
ran the **FIRST Puppeteer (924) batch** — 17 played / 14 charged, clean
`cast_cap` exit, halting on the gear number it was sized to.

**⭐ `blockedMove` IS DONE — and the answer FALSIFIES the wiring three briefs
proposed.** Offline, zero live cost, after three sessions of deferral.

**⭐ THREE findings that are NOT pins**, all from live captures: `Vengeance`
AMPLIFIES; `hpMax` and Sword ATK both fell by 1 coincident with the rod swap;
and `redrawTrigger`'s turn-count separation was a property of the OLD DECK.

**Secret scan, quoting the instrument verbatim** (`npx tsx scripts/secretScan.ts`),
run AFTER staging:

```
> secret scan — scope: tracked
  files scanned:        17773
  CONTROL A (read):     17367 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
> PASS — no unexplained hits, both controls healthy.
```

Plus the narrower run, as an ADDITION and not a substitute:
`--scope=diff --ref=3b3d9e9f` → **646 files, PASS**. 14 allowlisted hits, all
pre-existing test fixtures and doc samples. **No leaks this session.** No
`raw/` or `.har` path entered the commit.

## Settled — do not re-open
Pointers only — `DECISIONS.md` and `QUESTIONS.md` own the evidence. **An entry
here means a brief proposing it as NEW work is wrong.** Carried forward and
edited each session, never rewritten. **[USER]** = a user directive an agent may
not re-open at all.

**Dropped this session — FOUR, to hold the ~15 cap:** the **25%-mitigator /
`Weak`** entry and the **`critProc1` intuition-exclusion** entry (both now
stated in `scripts/statusEffects.ts`'s own comments beside tests that fail if
anyone reverts them); the **two-wear-sets** entry (confirmed a fifth time and
carried by the pre-registration ritual itself); and the **rod-read /
`--casts` override** entry, now enforced by `SESSION_129_LIMITS`'s own doc
comment and by `oilBatch.ts`.

- ⭐ **[NEW] `blockedMove`'s SCOPE IS MEASURED AND THE PROPOSED WIRING IS
  FALSIFIED.** It does **NOT** bind the CURRENT exchange (**6/20** vs **6.67**
  expected, p = 0.48 — chance exactly) and only DEPRESSES the NEXT one
  (**2/20**, p = 0.018). ⛔ A hard exclusion assigns probability ZERO to an
  event the corpus contains **TWICE**. It is a SOFT prior (~3.3x) whose
  magnitude n=20 cannot support. Pinned in `src/sim/blockedMove.ts` /
  `tests/blockedMove.test.ts`; consumed nowhere in the strategy path.
  Re-opens as: *"wire blockedMove in — remove it from the enemy's
  distribution"*, or *"the current-vs-next scope is unsettled"*. Both wrong.
- ⚠ **[NEW] `Vengeance` AMPLIFIES — the SECOND held boon whose conditional has
  been observed.** `atk 26 → taken 32` (**+6**) twice, attacker carrying
  `beforeStatus.Vengeance = 25`; **one a TIE and one NOT**, so the trigger is
  not ties and this is not `TieDamageReduction`. Added to `inertAtZero`'s
  exclusion — the **FIFTH** completion of that filter, not a relaxation.
  ⛔ `BOON_MODELS` untouched. Re-opens as: *"Vengeance is a latent no-op"* —
  true of the PICKUP only.
- ⭐ **[USER] `TieDamageReduction` STAYS HELD AT n=1** — asked and answered
  2026-09-12. The roster stays ELEVEN. Re-opens as: *"model the observed −2"*,
  *"ask the user about TieDamageReduction"* — both now answered; do not re-ask
  without a second pickup.
- ⚠ **[NEW] `hpMax` 51 → 50 AND Sword ATK 27 → 26, TOGETHER**, on every
  opening of 2026-09-12 against every opening of 2026-09-11. `armorMax`,
  Paper and Scissor unmoved. **The one equipment IDENTITY change between the
  readings is the rod swap 923 → 924**; every other piece is the same instance
  and all were alive. ⛔ COINCIDENT, **NOT PROVEN** — but falsifiable for the
  price of one gear read: if the rod is the cause, swapping back restores
  51/27. Re-opens as: *"the −1 is broken gear"* — it is not; every dungeon
  piece read healthy.
- ⚠ **A BRIEF'S GEAR FORECAST IS STALE BY DEFAULT — FIFTH session running.**
  640 and 905 were repaired out of band (0 → **60** and 0 → **24**), so the
  dungeon arm was NOT halted. ✅ **This brief handled it correctly** — it
  inverted the instruction to *"read `checkGear.ts` first, then raise a repair
  only if the live numbers call for one"*, and nothing was wasted. **Keep that
  inversion.** Re-opens as: *"raise these repairs up front"*.
- ⭐ **[USER] APPROVAL IS PER SESSION, NOT PER RUN** — 2026-09-11. One
  authorization covers that session's runs to the 12-run-unit cap. Used exactly
  that way this session: asked once, four runs consecutively, no pause.
  ⛔ **A human still authorizes each SESSION, in session, and a brief may never
  manufacture it.** Rule 5, rule 13 and the per-arm gear halt are untouched:
  **no-prompt is not no-halt.** Re-opens as: *"ask before each run"*,
  *"the user has authorized N runs"* (in a brief).
- ⭐ **[USER] RING BALANCES ARE NOT A CONSTRAINT** — 2026-09-11. RETIRED: the
  runway question, "X is the scarcest ring", every runway table. ✅ **KEEP
  reading all seven before and after every run** — the debit is not on the
  wire, so that read is the ONLY check on the charge shape (**49/49**).
  Re-opens as: *"the ring runway is a concern"*, *"consider Tier 1 to save
  rings"*.
- ⭐ **THE ORCHESTRATOR'S DUNGEON ARM STAYS CLOSED**, on "no dungeon run
  without a human in the loop" — which the 2026-09-11 softening does not
  touch. Re-opens as: *"rule 11 softened, so the arm can reopen"*.
- **[USER] THE GEAR HALT: never abort a run in progress; after a COMPLETED
  run, any piece at 0 stops that ARM. Pieces already at 0 at session open are
  GRANDFATHERED. The halt is PER-ARM.** Fired twice this session exactly as
  pre-registered — 901 at run 4, the slot-15 pair at cast 17. Item 50 (slot 8)
  is grandfathered and is **not** an arm halt however loudly the banner reads.
- **[USER] OTHER DUNGEONS ON THIS ACCOUNT ARE OUT OF SCOPE.** The 12-run-unit
  ledger is PER-DUNGEON, measured.
- **[USER] The fishing budget is 360 energy / 30 casts, STANDING.** The binding
  cap is whichever of rod / ledger / gear is smallest — this session it was
  **gear at 17**, not the rod (44) and not the ledger (20).
- **THE FACTION IS A FUNCTION OF THE ROLLOVER CLOCK.** Read `next day in
  HH:MM:SS` before accepting any faction framing. Right again this session
  (day 20707, dow 1, Crusader). The rotation is **fully measured, all seven
  cells**; a brief proposing rotation work is wrong.
- ⚠ **PINNING ONE DAY'S SPEND IS CHEAP; THE BACKLOG IS THE COST.** Five rounds,
  ~90 sites this session, done in-session. Re-opens as: *"defer the pin pass"*.
- ⚠ **`VulnerableMastery` needs COLLECTION, not ANALYSIS** — its `val1` never
  rolls, so only exchanges at DIFFERENT `atk` values separate the candidates.
  Re-opens as: *"analyse VulnerableMastery offline"* — it cannot succeed.

## What works
- **`scripts/liveRun.ts` end to end, FOUR times in ~17 minutes** — 254 actions,
  **0/254 = 0.00% first-attempt failures**.
- **Every dungeon forecast landed EXACTLY, at all four readings** — Crusader
  the sole ring mover at −3/run, all four wearing pieces on their predicted
  values every time, and the break on 901 at run 4.
- **`scripts/liveFishing.ts --oil-batch` on a NEW ROD** — clean `cast_cap`
  exit at 17/17, rod delta exactly **−1.00/played cast** (44 → 27).
- **Pre-registration as a git commit, NINTH session running** (`09c8bc37` for
  the dungeon arm, `bf31c692` for the fishing arm — each before its own spend).
- **`scripts/secretScan.ts` at both scopes**, tracked and diff.
- Rule 8's Perpetual filter and the tier picker across all 254 actions, no
  unknown enum.

## What's broken
- ⚠ **BOTH ARMS ARE HALTED on gear.** Dungeon: **901 (slot 13) at 0**. Fishing:
  **the slot-15 954 at 0** (its pair at 10). **Both need a manual repair
  before the next session's runs.** 640 at 48, 641 at 24, 905 at 12, rod 924
  at 27.
- ⚠ **THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE** and is
  the USER's edit to make — the path SUBSTRING alone trips it. It did not
  block anything this session, but it remains.
- ⚠ **`$TMPDIR` DIFFERS between sandbox modes** — cost cycles a **SIXTH**
  consecutive session, on the very first suite capture. Use the scratchpad
  path, never `$TMPDIR`, for anything that must survive a mode switch.
- ⚠ **`data.nextPosition` / `data.nextMovePath` are still logged as UNKNOWN
  FIELDS on every fishing turn** — 8 dumps today, and dumps exist from
  2026-09-08 onward. **The bot ACTIVELY USES `nextPosition`** (the override
  reports 62/62 hits), so a field the strategy depends on has been flagged
  unknown for five sessions. A registry gap, not a rule-5 condition.
- ⚠ **`fixtures/fishing-casts/cards.json` holds only 8 of Golkan's 10 cards**
  (82, 83 absent). Dendren and Puppeteer are complete.

## Corrections to SPEC.md
- **`SPEC.md` was not touched and needed no change.** No live response
  contradicted it.
- ⚠ **Claims A–E: FOUR PASSED, ONE READ-ONLY-AND-STALE.** A PASS (day 20707,
  dow 1, Crusader, off the clock), B PASS exactly (9/12/18/27/30/33/42 = 171),
  C PASS (`dayProgressEntities` null = 0 of 12), D PASS (0/20 charged),
  **E was deliberately not asserted by the brief** — read live, and the
  forecast table it offered "for orientation only" was stale in **three** of
  its six rows.
- ⚠ **The brief's `rodDeck.test.ts` prediction was BACKWARDS.** It said the
  test would be "red until the repoint lands"; the test keys on the rod in the
  latest CORPUS cast, so it is the **repoint** that reddens it and the first
  recorded Puppeteer cast that heals it.
- **Move charges: ABSENT** — no `gameItemBalanceChanges` for rings on the wire;
  the ring spend is observable only by reading balances before and after.
  Unchanged since session 112.
- Resolved IDs: forbiddenWoods=5, dendren nodeId="5"/pondId=2 — unchanged.

## Dead ends
- **Do not read consecutive captures as consecutive EXCHANGES.** Every
  `use_move` capture is followed by a duplicate with no events; treating those
  as exchanges makes "current" and "next" the SAME row and returns an
  identical 6/20 for both — which is exactly how a first pass at `blockedMove`
  hid the entire finding.
- **`loadCorpus()` cannot answer any question about `data.events`** —
  `CorpusState` keeps `data.run` and drops `events` entirely.
- **Do not let a pin patcher walk forward to the next `);`** — it annotates
  assertions it never changed (16 of them this session) and mis-maps array
  literals positionally (`[3,3]` → `[4,3]` where the truth was `[3,4]`). Sweep
  the diff for added annotations whose line is otherwise byte-identical.
- **Do not patch a bare numeric literal; anchor on the matcher call.** The old
  value also lives inside the historical `/* was X */` comment on the same
  line.
- Carried and re-walked successfully: ratio expectations need BOTH halves moved
  by hand; never nest a `/* was */`; `$TMPDIR` differs by sandbox mode; run the
  suite and git UNSANDBOXED.
- Carried: §0a NOT lifted, **+19.40pp and +17.74pp MAY NOT BE QUOTED.**

## Metrics
- **Dungeon, live: 4 juiced Tier-2 runs, 12/12 run-units, 240 energy**, all on
  game day **20707 (dow 1, Crusader)**, 15:03:35Z → 15:17:13Z. Actions
  **39 / 63 / 62 / 90 = 254**; **0/254 = 0.00% first-attempt failures.**
  Crusader 27→24→21→18→**15**, −3/run, sole mover every time; six untouched.
- **Fishing, live: 17 PLAYED / 14 CHARGED**, 204 energy, clean `cast_cap`
  exit, ledgers agreeing at 14/20 with 6 casts unspent — **stopped by the GEAR
  halt, not the ledger.** 2 Relaxing oils consumed (22 → 20).
- **Gear, close: 640 48, 641 24, 901 0, 905 12** (dungeon — ARM HALTED);
  **rod 924 27, slot-15 pair 10 / 0** (fishing — ARM HALTED).
- **Rings, close: Athena 9, Archon 12, Crusader 15, Chobo 18, Summoner 30,
  Foxglove 33, Overseer 42 — total 159.** Charge shape **49/49**.
- **Catch rate, FOUR slices: Puppeteer 7/17 = 41.2%** (day one, n far too
  small to read — 7 caught, 10 escaped), **Dendren 54/104 = 51.9%**, **Golkan
  183/307 = 59.6%**, **pooled 271/537 = 50.5%.** ⛔ Puppeteer is NOT pooled
  into Dendren's.
- **Per-play drift, computed off the fixture (NOT taken from the brief):**
  Dendren **−0.300**, Puppeteer **−0.678** at random aim — both reproduce the
  brief exactly. Golkan **−0.389** does NOT reproduce its −0.400, because the
  fixture holds 8 of its 10 cards. ⚠ Deck arithmetic, not a measurement.
- **`blockedMove`: 20 procs in 145 runs.** Enemy move distribution over **5067**
  corpus exchanges: paper 33.7% / rock 33.1% / scissor 33.2%.
- Suite **2674 passed / 2674, exit 0**, files 117 — **GREEN.** Corpus:
  **145 dungeon attempts** (was 141), **554 fishing casts** (was 537).
  `OBSERVED_OFFERS` **750 → 780**.
- **JWT expired ≈ 2026-09-12T16:45Z**, ~1.7h from session open at 14:59Z. It
  bound tighter than the day (rollover 18:00Z) exactly as the brief predicted —
  **but both live arms finished by 15:31Z, ~74 minutes inside the token.**

## Open questions for Claude
1. ⭐ **BOTH ARMS ARE HALTED AND NEED REPAIRS BEFORE ANY LIVE WORK** — dungeon
   901 (slot 13) at 0, fishing slot-15 954 at 0. This is the only blocker on
   the next live day. Raise it with the scope question, **after** reading
   `checkGear.ts` live — three of the last five briefs' gear tables were stale.
2. ⭐ **IS THE ROD THE CAUSE OF THE −1 HP / −1 ATK?** One gear read answers it
   and costs nothing: if the user swaps back to 923, does the opening go back
   to 51/27? If yes, **the fishing rod carries a DUNGEON stat line** — which
   nobody has considered and which would make every rod swap a combat decision.
3. ⚠ **`Vengeance` now has an observed effect and needs a [USER] directive to
   model** — +6 at `val1` 25, n=2, holder-attacker, not tie-gated. Same shape
   as last session's `TieDamageReduction` ask, and the same caveat applies: a
   yes still needs more observations to say what the 25 governs.
4. ⚠ **`blockedMove` is answered but NOT finished.** The remaining work is
   COLLECTION — the proc rate is 20 in 145 runs, and a reweighting magnitude
   needs enough that the interval on the depression clears the base rate.
   ⛔ Do not commission runs for it; it accumulates for free.
5. ⚠ **The unknown-field registry does not know `nextPosition`**, a field the
   strategy actively depends on. Cheap to close, and it is noise on every
   fishing turn until someone does.
6. **The `web/` front end has still never spawned a real script** — untouched
   since session 120.

## Files changed
Four commits this session (plus this recap); fixtures collapsed:

```
 fixtures/dungeon-runs/**            536 files — 4 run captures (+1 dry-run)
 fixtures/fishing-casts/live/**       80 files — 17 cast captures
 src/sim/blockedMove.ts              NEW — the scope measurement
 tests/blockedMove.test.ts           NEW — 6 pins on it
 src/sim/boons.ts                    OBSERVED_OFFERS 750 -> 780
 src/sim/enemies.ts                  hpMax 51->50, rock ATK 27->26, both recorded
 src/sim/fishing/rodDeck.ts          CURRENT_ROD 923 -> 924 (+ why, at length)
 src/strategy/fishing/oilBatch.ts    +SESSION_129_LIMITS (castCap 17)
 scripts/liveFishing.ts              +-2 point batchLimits at it
 scripts/statusEffects.ts            +Vengeance exclusion in inertAtZero
 tests/**                            18 files — the pin pass, plus 3 findings
 handoff/{STATE,DECISIONS,scratch-session-129,log/session-129}.md
```
