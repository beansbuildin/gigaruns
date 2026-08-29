# session 108 — 2026-08-29 — 4 chained Tier-1 juiced dungeon runs — GATE PASS

## 0. The authorization, and why it was re-confirmed

`handoff/next.md` (commit 7a2125f0, authored by the user at 10:49 PDT) quoted a
user directive authorizing all 4 runs without stopping. **That reached the
agent as a file, not as chat**, and CLAUDE.md rule 11 plus the "Ask first" list
both require an explicit human go-ahead *for each run*. 12 run-units is the
whole day's dungeon allowance and the spend is irreversible, so the session
asked for one line of confirmation in chat before spending anything. The user
confirmed ("Yes — run all 4 now").

**This is a ONE-TIME, DATED exception to rule 11's chaining prohibition. It does
not carry forward.** Recorded in DECISIONS 2026-08-29 and in STATE.md's digest
with the phrasings a future brief might use to re-open it.

Rule 11's other four conditions were unchanged and held on all four runs.

## 1. Preflight

| Check | Reading |
|---|---|
| `checkDungeonToday.ts` | `dayProgressEntities: []` — 0/12 run-units used |
| JWT | valid to 2026-09-04T18:48Z (145h) |
| Clock | 10:51 PDT — **the 11:00 reset was 9 minutes out**, flagged before starting |
| `--dry-run` | `isJuiced:true, index 1`, 3x131 loaded (14 in stock), boon-priority ON, orb rule WIDE |

**`--dry-run` printed `run 1/1` and this is NOT a dropped flag** —
`scripts/liveRun.ts:2200` clamps `targetRuns` to 1 under `--dry-run` by design
(`args.dryRun || args.stage2 ? 1 : args.runs`). The real invocation printed
`▸ liveRun.ts — 4 run(s)`.

**Energy preflight, exercised live and worth recording in full:**

```
▸ energy preflight: pool 159 short of the planned 240 (deficit 81) — reading the ROM bank.
▸ cap headroom: largest single ROM snapshot 252, pool headroom 261.
  no single claim can reach the cap — overflow unreachable from this path.
▸ ROM bank: 37 ROMs, 25 with energyCollectable > 0, 3309 energy claimable (claiming descending).
  · claimed 3777 (snapshot 252); running total 252/81
▸ energy preflight: pool 159 -> 411 after 1 claim(s) (measured +252).
▸ claim audit: 1 claim(s) descending, snapshot total 252, measured pool delta +252 (drift +0)
```

## 2. The four runs

| # | run id | outcome | Hard Core | Dendren Root | energy | `start_run` (UTC) | PDT | window |
|---|--------|---------|-----------|--------------|--------|---|---|---|
| 1 | 25189558 | death @ room 10 | 2,664 | 687 | 60 | 17:53:29 | 10:53 | pre-reset |
| 2 | 25189614 | death @ room 7 | 1,680 | 309 | 60 | 17:57:45 | 10:57 | pre-reset |
| 3 | 25189640 | death @ room 4 | 828 | 84 | 60 | 18:00:26 | **11:00** | post-reset |
| 4 | 25189674 | death @ room 6 | 1,512 | 216 | 60 | 18:02:16 | 11:02 | post-reset |
| | | **4 deaths** | **6,684** | **1,296** | **240** | | | |

**All four `start_run` bodies byte-identical**, read off the logged request
rather than off config:

```json
{"action":"start_run","dungeonId":5,"actionToken":"",
 "data":{"consumables":[131,131,131],"isJuiced":true,"index":1,
         "itemId":0,"expectedAmount":0,"gearInstanceIds":[],"devBoons":[]}}
```

`index: 1` ✓ `isJuiced: true` ✓ 3x131 ✓ **no `inputItems` key at all** — which
is session 106's correction, and the absence is what confirms zero rings.

**The ledger reads 6, not 12.** Runs 3 and 4 landed after the 11:00 PDT reset
(run 3 at 18:00:26Z = 11:00:26 PDT, 26 seconds past it), so 6 run-units charged
to the old window and 6 to the new. This was predicted before the batch, not
discovered after. **6 run-units remain in today's fresh window = 2 more runs
available.**

**Loadout byte-identical across all four** (rock 16/0, paper 6/12,
scissor 12/8, hp starting 30) — one comparable arm, which the session-103
"holds steady" ruling asks to be confirmed rather than assumed. Chaining
removed the only window in which a re-spec could have happened.

**Rule 8: 23/23 `TIER-CHECK ... OK`, zero violations.** Three offers had their
top tier Perpetual-filtered:

```
TIER-CHECK room=8/16 rule=highest offered=[0,1,2] taken=1 eligibleTop=1 perpetualFilteredTop=true OK
TIER-CHECK room=3/16 rule=highest offered=[0,2,1] taken=1 eligibleTop=1 perpetualFilteredTop=true OK
TIER-CHECK room=5/16 rule=highest offered=[2,0,1] taken=1 eligibleTop=1 perpetualFilteredTop=true OK
```

3 of 23 = 13%. The final-room lowest-tier rule never fired, correctly — the
deepest room reached was 10 of 16.

**First-attempt failures: 0 of 172**, every action class at 0.0%
(`path_one` 0/9, `path_three` 0/4, `path_two` 0/10, `reward_one` 0/8,
`reward_three` 0/7, `reward_two` 0/8).

## 3. THE BUG: `potionPolicy` was shared across the batch

Only **3** potions fired in the whole batch, all in run 1. Runs 2, 3 and 4
each committed 3 and used none.

`potionPolicyState` is constructed ONCE at `scripts/liveRun.ts:2149`, before
the run loop at `:2297`, and passed by reference into `runOnce` on every
iteration. The call site mutates it:

```ts
const p = deps.potionPolicy;
await usePotionLive(...);
p.remaining--;
p.used++;
```

Run 1 drained `remaining` 3 -> 0. `shouldUsePotion(hp, hpMax, 0, threshold)`
returns false unconditionally, so runs 2-4 could never fire one.

**This was not free.** Stock read **14 before the batch and 2 after** — 12
consumed, 3 used. So **consumables are debited at `start_run` (commit time),
not at `use_item` time**, and **9 Big Heal Juice were burned for nothing**.

**Why 108 sessions never saw it:** rule 11 pins `--runs=1`, so every run got a
fresh process and therefore fresh state. The bug is reachable only through the
`--runs=N` flag, which this session is the first to use for dungeons.

**Fix:** `runPotionPolicyFor(base, potionCount, iteration, potionsUsed)`,
exported from `liveRun.ts` and called per iteration. `remaining` resets to the
configured count (every new run commits a fresh `consumables` array); `used` is
an index into THAT array so it resets to 0, and only iteration 0 honours
`--potions-used=`, since only iteration 0 can be a `--resume-existing`. Four
regression tests in `tests/potions.test.ts`, including one asserting that
mutating one run's object cannot leak into the next.

## 4. Suite: 6 failures, and only 3 were census growth

The batch's new fixtures turned the suite red. Session 107's discipline —
re-derive, never bump — mattered here, because **three of the six were
structural**, not census.

### 4a. `BurnMastery` amplifies the burn tick (statusEffects.test.ts)

`expect(r.ok).toBe(r.n)` went 384 vs 396: 12 exceptions in an invariant
documented as exceptionless. The test scans a bounded, sliding 30-run-dir
window, so the 4 new dirs pushed 4 old ones out.

Every one of the 12 exceptions is `side 1, tick 6, after 3` — exactly double,
no scatter. Splitting by whether the ATTACKER holds `BurnMastery` gives a
total separation with **no off-diagonal cell**:

```
  BurnMastery=false  exact=true    384
  BurnMastery=true   exact=false    12      non-exact ratios: {"6/3": 12}
```

On the FULL corpus (2389 exchanges, all run dirs):

```
maxRunDirs=30    BurnMastery pairs={"tick6/after3":12}   no-BM exact=384/384
maxRunDirs=200   BurnMastery pairs={"tick6/after3":12}   no-BM exact=719/719
maxRunDirs=1000  BurnMastery pairs={"tick6/after3":12}   no-BM exact=719/719
```

So the invariant was **incomplete, not wrong**, and scoped to the population it
actually describes it is exceptionless at a LARGER n (719) than the combined
rule ever reached.

**⚠ x2 and flat +3 are UNSEPARATED.** All 12 observations are `after: 3`, all
from one run (`run-2026-08-29-17-53-12`). Separating them needs a BurnMastery
burn tick at any amount other than 3. `tests/statusEffects.test.ts` pins
`expect(Object.keys(pairs)).toEqual(["6/3"])` deliberately — when that goes
red, it is data arriving, not a regression.

`burnMasterySplit` added to `scripts/statusEffects.ts`; the CLI now prints the
split so the headline number is not read as a decaying invariant:

```
  Burn        tick === after-state amount            719/731  98.4%
              without BurnMastery                     719/719  100.0%
              with BurnMastery (amplified)            0/12  pairs {"6/3":12} — x2 vs +3 UNSEPARATED
```

### 4b. The ★ zero-stat proc control is falsified — for intuition only

`intuitionProc0 fired while its stat was 0: expected 1 to be +0`. One event:
`run-2026-08-29-17-53-12/state-138.json`, playerId 0,
`intuition: {"current":0,"starting":0}`, with a corroborating `intuition_block`
event. **Both players read intuition 0.** It is not a run-boundary reset
artifact — intuition read 0 across states 134-138 of that run, so the stat was
genuinely zero.

**The mapping SURVIVES**, on a dose-response the absolute control never
measured. Full corpus, `intuitionProc0` by the actor's own intuition:

```
  intuition   fired/n      rate
      0        1/1716     0.06%
      1        2/ 539     0.37%
      2        1/  52     1.92%
      5        0/  24     0.00%
      6        0/   8     0.00%
     10        4/  50     8.00%
```

Monotone. The other candidate, `lck` — the account skill, sitting at 6.75 and
matching QUESTIONS.md's "6.75% chance" answer — is scattered and non-monotone
(0/1012 at 0, 1/109 at 1.5, 4/112 at 3, 0/106 at 6, 1/137 at 6.75), so `lck`
is not the driver.

Read as a small nonzero BASE rate, not a broken mapping. The test now scopes
the strict control to every flag except `intuitionProc0` and pins intuition's
count at exactly 1, so a second occurrence turns it red.

### 4c. `LossBlockUp` — first-ever pickup, deliberately unmodelled

`LossBlockUp has a pair but no model`. First-ever PICKUP,
`state-298 -> state-299`, `selectedVal1` 5, `Rarity: "Rare"`, `TokenId: 116`.
Offered many times across the corpus, never taken until now.

Whole-object recursive diff (session 89's strict method, not just the fields
`toCombatant` projects):

```
players[0] diffs: 1
   players[0].pickedBoons.1: undefined -> {"BoonType":"LossBlockUp","Rarity":"Rare",...}
players[1] diffs: 0
```

Latent at pickup, measured, n=1. **Not modelled** — the `LossIntuitionUp`
precedent (session 99) required an explicit user directive for exactly this,
and `LossEvasionUp`/`LossLuckUp` remain unmodelled, so there is no family to
generalise from. `tests/boons.test.ts` carries
`AWAITING_MODEL_DIRECTIVE = new Set(["LossBlockUp"])`, asserting the type is
NOT in `BOON_MODELS` and separately pinning the measured latent delta. The
suite is green and the gap is explicit. QUESTIONS.md §64 asks for the ruling.

### 4d. The three that WERE census growth

- **`OBSERVED_OFFERS` 325 -> 348.** Regenerated exactly as session 93 did:
  **23 rows missing, ZERO extras** — purely additive, nothing was ever wrong.
  Depth invariant re-checked rather than assumed: run 1 died at room 10 and its
  deepest offer is room 9, so `Math.max(room)` is unchanged at 9.
- **Wall-1 room-1 census 243 -> 255.** +12 = four runs x 3 room-1 options.
  Clean TYPE set unchanged (still exactly six, since session 52); the two new
  clean OPTIONS are an eighth `UpgradeRock` and an eleventh `UpgradeScissor`,
  both already-clean types recurring — NOT new holes.
- **Loadout census, one new combo `50/14`.** Not a re-spec: the starting
  loadout was byte-identical on all four `start_run`s. It is the session-61/62
  corrode mechanic, same shape as that section's own trace —
  `state-175  50/17 -> 50/14` on an enemy win, `state-183  back to 50/17` at
  the room boundary.

## 5. The brief asked for something the digest forbids

The brief's recap section asked to "report the accumulated unspent skill XP".
**QUESTIONS.md §61.1 says explicitly: "Do not re-raise unspent XP as a finding
in a future recap."** STATE.md's digest carries it as `[USER] ... CLOSED, not
deferred`. Declined, and flagged here so the next brief does not repeat it.

This is the `/handoff` digest check working as designed — it cost about four
minutes and caught one item.

## 6. Dead ends and process notes

- **A Monitor that greps only success markers is silent through a crash.** The
  first monitor armed this session filtered on invented event names
  (`run_started`, `run_over`, `run_complete`) that appear NOWHERE in the run
  jsonl. The real events are `post`, `post_response`, `action_applied`,
  `decision`, `tier_choice`, `boon_choice`. It was replaced before the batch
  mattered, but a silent monitor is indistinguishable from a healthy one.
- **`$TMPDIR` differs between the sandboxed and unsandboxed shells.** A monitor
  armed on `"$TMPDIR/batch108.log"` died instantly with
  `tail: /tmp/claude-501/batch108.log: No such file or directory` while the
  unsandboxed writer had put it in `/var/folders/...`. Use absolute paths in
  Monitor commands.
- **`npx tsx` fails under the sandbox** with `EPERM ... listen` on its IPC
  pipe. Every live script this session needed `dangerouslyDisableSandbox`.
- Do not model `LossBlockUp` from n=1 without a directive (§4c).
- Do not "repair" the burn invariant by lowering its count onto the mixed
  population (§4a).

## 7. Verification, against the final commit

```
npx tsc --noEmit                 clean
npx vitest run --maxWorkers=4    2121 passed / 2121, 111 files
git diff --check                 clean
discoveredShipsClean             8/8
secret scan (session's added lines, all four patterns incl. the
  WIDENED 0x[a-fA-F0-9]{4,}):    0 hits
tracked files under raw/:        0   (354 tracked fixtures, 0 with an address)
```

Suite 2092 -> 2121 (+29): 4 potion-policy tests, 1 burn-amplification test,
1 intuition pin, 23 new per-pickup boon cases.
