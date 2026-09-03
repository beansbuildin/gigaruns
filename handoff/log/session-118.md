# session 118 — 2026-09-02 — day-20698 wrap test FAILS, 4 runs, 21 casts, rod to 0

No numbered TASKS.md gate. `handoff/next.md` was **stale** — it is the
session-116 brief (written 2026-09-01 12:11) and session 116 already closed
against it (STATE.md 21:51 the same day). Per `/handoff` the fallback is the
next unblocked TASKS.md task; tasks 1–14 are all GATE MET or parked on data
(§13), so the session took STATE 116's open question 2, the rotation wrap test.

**I am session 118, not 117.** An out-of-band session 117 (Claude Sonnet 5,
commit `0755d156`, 2026-09-02 11:40 PT) landed the fishing loss-decomposition
wiring and wrote `handoff/log/session-117.md`. Its own commit message says it
was **"not yet run against the real repo's suite/tsc/secret scan"** — that debt
is discharged here (see §5).

## Step 0 — JWT: PASS

`scripts/doctor.ts`, which decodes `exp` locally and never prints the token:

```
✓ token present and valid for another 48.1h  (<JWT> — 1728 chars)
✓ authenticated as <USER> — <ADDR>
```

41.5h remaining at recap time. Expiry **2026-09-04T18:48:43Z**.

## Step 1 — the day: PASS

`checkEntryTiers.ts` → `game day 20698 (week 86, dayOfWeek 6) — next day in
23:18:31`. `checkDungeonToday.ts` → `dayProgressEntities: []`, a fresh 0/12.

Ring balances showed **NO out-of-band drift** since session 116 closed (total
270, identical to that recap — unlike the 116 open, which had drifted +6):

```
134 Chobo 30   138 Archon 30   137 Athena 33   135 Crusader 39
140 Summoner 42   139 Foxglove 45   136 Overseer 51
```

## Step 2 — the wrap test: **FAIL**, and this is the session's finding

**The prediction was recorded to a scratch file BEFORE `start_run`**, with its
falsifiers written out, so this is a real test and not a story fitted after the
fact. STATE 116 had the map at `faction = dayOfWeek + 2`, "solved UP TO THE
WRAP", and named day 20698 as the only observation that could test it.

```
day 20698 is dayOfWeek 6 -> 6+2 = 8 -> WRAPS to faction 1 = CRUSADER (135)
PREDICT: 135 Crusader 39 -> 36, all six other silver rings UNCHANGED.
Falsifiers: any other faction moves; a delta other than -3; more than one moves.
```

**Observed, read twice and stable:**

```
137 Athena   33 -> 30    <-- the ONLY one that moved, -3
135 Crusader 39 -> 39    <-- the PREDICTED faction, untouched
134 Chobo 30  138 Archon 30  140 Summoner 42  139 Foxglove 45  136 Overseer 51
```

**Two thirds of the model survived and got stronger; one third died.**

- SURVIVED: exactly ONE faction charged, exactly −3. Now **13/13** at this
  point, and **16/16** by the end of the day.
- DIED: the arithmetic ORDER. The map is `dow 3→f5, 4→f6, 5→f7, 6→f3`. Three
  consecutive `+1` steps, then a wrap to **3, not 1**.

**What still fits, and none of it may be assumed:**

- (a) a fixed 7-permutation with the fragment 5→6→7→3, leaving {1,2,4} for
  dow 0/1/2 in one of **6** orders;
- (b) per-day pseudo-random selection, under which three consecutive `+1` steps
  were a ~2% coincidence (1/49);
- (c) a period that is not 7.

`checkEntryTiers.ts`'s runway figure assumes (a) and says so.

**The lesson, which is bigger than the rotation.** Three consecutive points fit
a clean arithmetic rule and produced a confident, wrong prediction. The rule was
never wrong about the three points it was fitted to — it was wrong about the one
it had not seen. STATE 116 called it "solved UP TO THE WRAP", which was an
honest and accurate hedge, and the hedge is the only reason this was a cheap
experiment rather than a silent bad assumption baked into a runway number.

## Steps 3/4 — three more runs and 21 fishing casts, each authorized separately

Rule 11: `--runs=1` every time, `--dry-run` first every time, stop and report
between each, and a fresh go-ahead asked for each run.

| run | id | died room | first-attempt failures | Hard Core | Dendren Remnant |
|-----|----|-----------|------------------------|-----------|-----------------|
| 1 | 25289721 | 12/16 | 0/80 | 5,784 | 1,005 |
| 2 | 25290994 |  7/16 | 0/52 | 3,168 |   309 |
| 3 | 25293207 |  5/16 | 0/42 | 1,992 |   141 |
| 4 | (day's last) | 10/16 | 0/81 | 4,632 |   687 |

**0/255 first-attempt action failures across the day.** Ledger closed 12/12.

**Run 3's depth was DERIVED, not read.** Its final state carries no
`ROOM_NUM_CID`. Depth came from reward count, a rule validated against the two
runs where the field IS present — run 1: 11 rewards → room 12; run 2: 6 → room
7. Both exact, so run 3's 4 rewards → room 5 and run 4's 9 → room 10.

**Ring model closes at 16/16.** Athena 33→21 across four runs is exactly 12 =
3/run, single faction, six untouched, and the faction did **not** change
mid-day — a fourth same-day confirmation, in a second independent session.

**⚠ Within-arm spread, one day / one loadout / one entry tier / one boon policy:
5784 / 3168 / 1992 / 4632 = 2.9x.** Session 116 measured 3.2x. That is now two
independent days agreeing, and it is why a single cross-tier run cannot separate
`dropMultiplier` from noise. The Tier-1/Tier-3 baseline should be budgeted at
several runs per arm or retired by name.

### Fishing — two batches, 21 casts

Batch 1 (8 casts, authorized after I proposed 20 and the user cut it to 8):
**8 played, 7 charged**, JEBAITOR spared 1, **5 caught = 62.5%**.
Batch 2 (13 casts): **13 played, 11 charged**, 2 spared, **9 caught = 69.2%**.

Batch 3 (2 casts, after the rod recovered): **2 played, 2 charged, 1 caught**.

**Day total: 23 played, 20 charged, 15 caught = 65.2%** — inside the user's
60–70% framing. 276 energy. Ledger 20/20, the full daily cap.

Oils behaved exactly to policy: Relaxing (937) on lethal triggers only, 4 oil
casts total; **17 Focus triggers logged `oil_trigger_policy_withdrawn`**, which
is the session-93 fix working — a withdrawn trigger is NOT a dry bag and does
not flag the cast out of both outcome arms. Per-cast cap of 2 still has never
bound. `config/bot.json` was not touched and remains in its standing state.

**⚠ THE ROD RAN DRY MID-SESSION — and then came back. Both halves matter.**

Rod 812 (`GearInstance#812_1787690500_766077e9`, slot 14) fell 21 → 13 → 0 across
batches 1 and 2. The guard behaved exactly as designed and **halted**:

```
{"event":"rod_durability_preflight","phase":"after","status":"halt","stop":true,
 "detail":"rod 812 reads DURABILITY_CID 0 — it has RUN DRY. This is the Shroom
 (811) state: the server deals BASE_DECK, not the rod grant, so every
 damage-keyed sim number would describe a rod that is not in play
 (QUESTIONS.md §29).","durability":0,"rodItemId":812,"slot":14}
```

**I then reported that as a standing blocker requiring a user repair, and that
was WRONG.** ~62 minutes later the user asked for two more casts; the preflight
read the **SAME instance** at **50**, and both casts ran normally:

```
01:10:05Z  after   dur=  0   GearInstance#812_1787690500_766077e9   status halt
02:12:55Z  before  dur= 50   GearInstance#812_1787690500_766077e9   status ok
02:13:22Z  after   dur= 48   GearInstance#812_1787690500_766077e9   status ok
```

**Whether that is timed regeneration or a user repair is UNKNOWN** — the logs
cannot separate them, and the instance id is identical either way, so a repair
did not mint a new rod. Do not assert one without asking.

**This is CLAUDE.md rule 12's lesson recurring in a new place.** Rule 12 is
written about energy: exercise the real gate before reporting a blocker. The
gate here (`liveFishing.ts`'s own preflight) was correct at the instant it
fired, but I extrapolated one reading into a standing state requiring human
action. Running the loop cost nothing and answered it in seconds. **The general
form: a guard tells you the state NOW; it never tells you the state is
permanent.**

Final batch: **2 casts, 1 caught, 1 escaped.** The day closed at **20/20**
charged — fishing is now genuinely blocked, by the CAP, until 11:00 PT.

**Day fishing total: 23 played, 20 charged, 15 caught = 65.2%**, inside the
user's 60–70% framing. 276 energy, 3 casts spared by JEBAITOR.

**And the rod label reached its worst reading of all.** Batch 2 printed
`0 (before: 13, casts this batch: 18)`; batch 3 printed
`48 (before: 50, casts this batch: 20)` — in the final line **neither** number
describes that batch's 2 casts, because the delta is play-driven and per-batch
while the count is charge-driven and session-cumulative.

## §5 — the surprise that was NOT a finding (rule 10 in action)

The fishing loop flagged `data.nextPosition` and `data.nextMovePath` as
**UNKNOWN FIELDS** 20 times across the day and dumped a file each time — while
the same run reported `nextPosition override ACTIVE (46/46 hits)`. A field both
unknown and successfully consumed looks like a server change.

**It is not.** CLAUDE.md rule 10 says to check whether the field being counted
first appears at the date in question. Two checks killed it:

- `git log -S"unknown_fields"` → commit `e5f43cfa` (session 26, 2026-08-17):
  *"nextPosition/nextMovePath narrowed to rare (~2/30 casts)"*. Known since.
- Per-log rates: `fishing-2026-08-31-19-47-27.jsonl` already shows **6 events in
  7 casts**. The behaviour long predates today.

Only session 26's "~2/30 casts" **rate characterisation** is stale, and it went
stale several sessions ago, not today. No server change was reported.

## §6 — the out-of-band commit's untested debt, discharged

`0755d156` broke `tests/noHardcodedPaths.test.ts` (ratchet 27, actual 28). The
culprit is `scripts/lossDecompositionReport.ts:30`,
`join("data", "run-reports", "fishing-loss-decomposition.jsonl")`.

**Raised to 28 rather than converted**, on the sessions 100/101 terms it meets
exactly: it is byte-for-byte the construction its sibling
`scripts/fishingReport.ts:18` already uses from inside this same inventory, and
`writeReports()` takes both paths as parameters defaulting to those constants.
Converting it alone would split three report scripts across two conventions for
no portability gain. `tsc --noEmit` and the secret scan were also clean for it.

Also note the suite baseline moved **without this session touching it**: 115
files/2323 tests → 116/2345 at HEAD, entirely from `0755d156`. That is exactly
CLAUDE.md's session-18 stale-count trap, caught by re-running at HEAD.

## §7 — corpus pins: ~160 across 11 files, in THREE waves

Adding 4 dungeon runs and 23 fishing casts moved pins in
`boons`, `enemies`, `castEra`, `redrawCounterfactual`, `redrawShadowAnalysis`,
`oilReachability`, `matcherHeadroom`, `zoneTemplate`, `stateFields`,
`damageEconomy`, `fishingCorpus`, `noHardcodedPaths`.

**Discipline applied to every one:** integer counts verified to move UPWARD; set
diffs verified PURELY ADDITIVE by **multiset** diff, so a repeated row cannot
mask a removal. The boon additivity check printed
`IN TABLE, ABSENT FROM CORPUS: 0` on all four runs.

Substantive rather than mechanical:

- **`boons`** `OBSERVED_OFFERS` 453 → 483 (+30, 0 removed), four per-run blocks.
  Run 1 contributed a contiguous **room-1..11 ladder** — the first single run in
  the corpus to do so.
- **`boons`** `roomOne` 297 → 309. The clean census stayed still for run 1
  (no clean type in its room-1 offer, a third consecutive run of the two coming
  apart) and then **moved** for runs 2–4 (+`Heal`, +2 `UpgradeRock`,
  +`UpgradeScissor`). **No new clean TYPE — still the same SIX since session 52.**
- **`boons`** `healRooms` +1 at room 1, and it was **PICKED**.
- **`enemies`** +`74/22`, +`74/25`, +`66/17`. **None is a new starting loadout** —
  every run opened `50/17` with `pickedBoons: []`, read off its OWN state-000.
  `74/25` and `66/17` are AddMaxArmor/AddMaxHealth growth; **`74/22` is the
  session-61/62 CORRODE shred** (25→22 on an enemy win, back to 25 at the room
  boundary), the same shape session 108 recorded for `50/14`.
- **`castEra`** `[94, 62, x]` — preOil and oilSupplied **BYTE-IDENTICAL for a
  13th and then 14th consecutive batch**. This is the control that makes a
  150-pin re-baseline trustworthy rather than indistinguishable from a broken
  instrument.
- **`castEra`** `focusDry.actualHistogram` bucket `[3]` **MOVED 7 → 8**, its
  first move since session 110b, then **HELD at 8** through batch 2. Buckets sum
  to `focusDry.casts` at every step, so this is one new cast landing in bucket 3,
  not a reclassification.
- **`redrawCounterfactual`** ⭐ the **K=10 arm's `sacrifices` HELD at 7** and
  `wasted` at 12 across both batches, while `fires`/`rescues`/`manaSpent` all
  moved — **and the K=3 arm's `sacrifices` MOVED 13 → 14 on the same batch.**
  The two arms separating on identical data is the sharpest form of that
  contrast the corpus has produced.
- **`redrawCounterfactual`** mana histogram **SHAPE unmoved**: ten buckets,
  still peaked at 8, several buckets byte-identical; sums 366 → 374 → 387,
  i.e. +8 then +13, the batches exactly.
- **`damageEconomy`** `LIVE.drift` −0.6417 → −0.6593, third consecutive move.
  Still NEGATIVE and short of −1 — the two conditions STATE names — so a pin
  update, not a re-derivation. The bare/LIVE ratio still clears its bar of 5.
  **The clamp bar was NOT widened.**
- **`liveFishing`** `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` "2.6" → "2.5" on 390 casts.

## §8 — a tooling trap worth recording

A backgrounded `npx vitest run | tail -25` **reported exit code 0 while 3 tests
were failing** — the exit status belonged to `tail`, and the truncation hid 2 of
the 3 failures. Capture to a file and read `$?` from vitest directly.

Also: `$TMPDIR` differs between sandboxed and unsandboxed Bash, so a file
written by an unsandboxed command is not where a sandboxed one looks for it.
Use an absolute scratchpad path across the boundary.

## Verification

```
npx vitest run --maxWorkers=4   116 files, 2364 passed / 2364, exit 0
npx tsc --noEmit                exit 0
git diff --check                exit 0
tests/discoveredShipsClean      8 passed / 8
.gitignore                      all seven paths PRESENT
npx tsx scripts/secretScan.ts   scope: tracked, 11712 files scanned,
                                0 unexplained across all 8 rules,
                                14 allowlisted (each printed),
                                both controls healthy — PASS
diff-scoped grep (0755d156..HEAD) for 0x[a-fA-F0-9]{4,} / noobId N / eyJ /
PRIVATE — no unredacted hits.
```
