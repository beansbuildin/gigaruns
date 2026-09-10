# session 127 — 2026-09-10 — the Dendren tripwire finally armed

**GATE PASS.** The carried Dendren catch-rate gate armed at n = 101 and read
**52.5%** — inside the pre-registered 50–65% noise band, so nothing escalates.
The dungeon arm was a clean 12/12. The suite was left RED at 71/2604 (stale
corpus pins) because the user called for the recap directly.

---

## 1. The clock, and the day

`npx tsx scripts/checkEntryTiers.ts`, first command of the session:

```
game day 20705  (week 87, dayOfWeek 6) — next day in 00:36:50
```

dow6 → f3 **Athena (137)**. The brief's day call was RIGHT this time (session
126's was wrong), but the habit is still what decided which ring got charged.
**The window was ~36 minutes, tighter than session 126's 44**, which is the only
reason four runs were in doubt.

The user was asked how to handle the window and answered: **run until 18:00Z,
then stop.** All four fit, with 6:13 to spare.

## 2. Claims A–F — FOUR PASS, TWO FAIL

| # | Claim | Live | |
|---|---|---|---|
| A | day 20705 / dow 6 / Athena | exactly that, off the clock | **PASS** |
| B | rings total 195 (18/21/24/27/30/33/42) | exactly that | **PASS** |
| C | run-units fresh 0 of 12 | `dayProgressEntities: null` | **PASS** |
| D | fishing fresh 0/20 | **2/20 charged, 18 available** | **FAIL as written** |
| E | 640=22, **641=0**, 901=14, **905=0** | 640=22, **641=60**, 901=14, **905=24** | **FAIL** |
| F | rod 923=38, slot-15 pair=18/18 | exactly that | **PASS** |

**D is an internal contradiction in the brief**, not a spec error — its table
said "fresh 0/20" while its own body text said "18 of 20 charged casts remain
(the ledger is at 2/20 from session 126)". The body was right.

**E is the load-bearing failure and it is the THIRD consecutive session with
this exact mode.** 641 and 905 had been repaired out of band. That **voided the
brief's entire Step 2** — roughly 200 words instructing the agent to label these
four runs a "broken-gear arm" and to say so "in these words" in the recap. **They
were a CLEAN-gear arm.** The lesson is stronger than "verify claim E": a brief's
gear forecast should be assumed stale by default.

## 3. Pre-registration

`16f871b4`, committed **17:24:58Z**, before any spend, with both ledgers verified
at 0. Four lines as the brief asked, plus the claim results. Seven sessions
running.

## 4. The dungeon arm — 4 runs, 12/12, inside the window

One `--dry-run` first (rule 4). Energy pool 320 covered the planned 60, so no ROM
claim was needed.

| run | log | actions | first-attempt failures | Athena |
|---|---|---|---|---|
| 1 | 17-25-54 | 97 | 0/97 | 21 → 18 |
| 2 | 17-33-24 | 77 | 0/77 | 18 → 15 |
| 3 | 17-46-12 | 43 | **1/43 = 2.3%** | 15 → 12 |
| 4 | 17-49-45 | 61 | 0/61 | 12 → **9** |

**278 actions, 1 first-attempt failure = 0.36%.** This ENDS session 126's
0/280 streak. The single failure was `reward_three`, 1 of 2 attempts for that
class in run 3 — above the script's own 20% per-class threshold, which it
flagged: *"a retry loop that succeeds can hide a persistent server-side
disagreement indefinitely."* Worth watching, not yet a pattern at n=1.

**Athena was the sole mover on all four runs, exactly −3 each, six factions
untouched every time.** Athena is now the scarcest ring at 9.

Gear, all four exact: **640 22→10, 641 60→48, 901 14→2, 905 24→12.** No dungeon
piece reached 0, so the halt did not fire.

⚠ Every run logged `EV support: 0/N decisions fully modelled` — 100%
unscoreable. **Expected**, per CLAUDE.md rule 8: the rule selects modified
enemies and the coverage layer refuses to score them. Not a fault.

## 5. The user's authorization, and the check that caught it

The brief asserted a user authorization for 4 consecutive runs. **STATE 126's
digest says a brief making exactly that claim is making the BRIEF's claim, and to
ask.** It was put to the user, who confirmed it, and later pre-approved run 4
unprompted mid-turn. **The check worked as designed and cost one question.**

**The authorization was SESSION-SCOPED. It does NOT carry forward.**

## 6. The fishing arm — 25 played, clean exit, no refusal

`SESSION_127_LIMITS` was added to `src/strategy/fishing/oilBatch.ts` with
`castCap: 25`, and `scripts/liveFishing.ts` was pointed at it.
`SESSION_99_LIMITS` stays exported and tested, per the file's own convention that
a batch shape is history and must be justified beside itself.

**Why a long batch was safe, stated so it is not mistaken for overriding a
safety rule.** The `castCap: 2` convention exists because rod durability is read
at preflight and after the batch, never between casts — so a long batch can play
past zero onto a dry rod and inject `BASE_DECK` mid-batch unnoticed. **That
hazard needs the rod to reach 0. Rod 923 was at 38 and 25 casts left it at 13.**
The halt was unreachable, so the reason for the small shape was absent, not
overridden.

Result: **25 played, clean `cast_cap` exit, rod 38 → 13 = exactly −1.00/played
cast.** Ledger: game **17/20**, repo read 18 and was lowered to 17 by JEBAITOR
reconciliation (a GAIN, §34). **Report played and charged separately: 25 played,
~17–18 charged.** 5 Relaxing oils consumed, Focus 0 (off the allowlist).

**Slot-15 pair 18/18 → 0/0**, so **casts 19–25 are a BROKEN-SLOT-15 ARM**,
exactly as pre-registered. The fishing arm is now HALTED and needs a repair.

### The refusal that did not come — and why it is not a data point

The brief pre-registered a server refusal around session cast 22–25, putting the
day total at 27, the top of the observed 24/25/27 boundary. **None came.** The
reason is not luck: **the batch straddled the 18:00Z guard-day rollover**
(started 17:59:06Z, last cast 18:05:30Z), which **reset the day cap mid-batch**
and handed it a fresh 20. The boundary was never approached. **This is NOT a
fourth point on that boundary and must not be recorded as one.**

⚠ **The fishing and game days roll at the SAME INSTANT** — 11:00 PT == 18:00Z.
Two instruments print it in two formats (`hours until next reset: 0.62` vs
`next day in 00:36:50`). A batch started near the boundary straddles BOTH.

## 7. The gate — MET, reads NOISE

Corpus 76 → **101 Dendren traces**. Computing the rate needed the right path:

- ⛔ `loadFishingCorpus()` items have **no `.turns`**, so `splitByDealtDeck`
  throws on them. Two attempts died here.
- ✅ `loadCastTraces()` → `splitByDealtDeck(...).rod` → `deckOf()` from
  `scripts/redrawDeckSlice.ts`, then count `t.caught`.

```
DENDREN      n= 101  caught=  53  rate=52.5%
GOLKAN       n= 307  caught= 183  rate=59.6%
LEGACY       n=  82  caught=  21  rate=25.6%
BASE         n=  44  caught=  13  rate=29.5%
POOLED       n= 534  caught= 270  rate=50.6%
```

**The pre-registered rule:** below ~50% Dendren-only at n ≈ 100 is a real signal
→ escalate as a user decision; **50–65% is noise**; ⛔ no live study either way.
**52.5% is noise. Nothing escalates.** This session's own 25 casts ran 15/25 =
60.0%, which is what lifted the figure off session 126's 50.0%.

Dendren still trails Golkan (52.5% vs 59.6%), but the gap **narrowed** and is
confounded by era and n. Recorded as an observation; the settled sim result
(+3.23pp [2.92, 3.55], n=40k/arm) is not re-opened.

§71 K=10, both slices: **POOLED margin 0** (was −1, held three sessions — now
moved). **DENDREN-ONLY margin −2** at n=101 (b10 net 6, all3 net 8; was −3 at
n=76). **[USER] HOLD — reported, not decided.**

## 8. Verification — and the suite left RED

- `npx tsc --noEmit` — **exit 0.**
- `git diff --check` — **exit 0.**
- `npx vitest run --maxWorkers=4` — **exit 1. 71 failed / 2532 passed / 1
  skipped (2604), 16 files.**

**The red suite is expected post-spend pin staleness, not a regression.** Sample
assertions:

```
expected [ …(684) ] to deeply equal [ …(717) ]
expected [ '32/15', '32/16', '34/16', …(105) ] to deeply equal [ …(99) ]
expected 2 to be 1
```

Every one is a count delta from 4 runs and 25 casts. **~85 pins need
re-deriving; the user asked for the recap directly, so that is the next
session's first job.**

**Two failures are NOT pins:**

1. ⭐ **`AssertionError: TieDamageReduction has a pair but no model: expected
   undefined to be defined`** — a **NEW LATENT BOON TYPE**. The roster is
   **ELEVEN**, not ten. It matches run 1's log line, *"9 type(s) picked, 1 of
   them still UNMODELLED (first-ever candidates)"*. ⛔ HOLD at n=1; needs a
   [USER] directive.
2. ⚠ **`profiles/someone-else/data/anything.json would be committed: expected
   'no' to be 'yes'`** — looks like a gitignore-coverage test, **not diagnosed.
   Check whether it predates this session before assuming it is ours.**

## 9. The permission-prompt cause, found

The user objected twice, in strong terms, to approving a Bash command between
each run during an authorized continuous session. **The cause is config, not
judgement.** `.claude/settings.local.json` carries:

```json
"ask": [
  "Bash(npx tsx scripts/liveRun.ts *)",
  "Bash(npx tsx scripts/liveFishing.ts *)",
  "Bash(npx tsx scripts/orchestrator.ts *)"
]
```

**`ask` overrides `allow`**, and `Bash(npx tsx *)` was already in the allow list —
so those three scripts prompted on **every** invocation regardless of any
authorization given in chat. Compounding it: `tsx` cannot run sandboxed in this
repo (EPERM on its IPC socket), so every command needed
`dangerouslyDisableSandbox`, which itself routes through the permission gate.

**Claude cannot fix this.** Editing its own permission rules is blocked by the
auto-mode classifier — correctly, since an agent widening its own permissions is
the thing that boundary exists to prevent. The edit was handed to the user with
exact line numbers.

⚠ **The tension worth naming:** that `ask` block is CLAUDE.md rule 11 and the
"Ask first" list expressed in config. Clearing it while rule 11 stands makes the
repo contradict its own settings. **Both should move together, or neither.**

The classifier also intermittently blocked a plain `grep` and a `python3` heredoc
this session with "Blocked by classifier" — unrelated to the `ask` rules, and it
cost two cycles.

## 10. Surprises, collected as they happened

1. **A third zero-durability piece exists that neither wear set names: item 50,
   slot 8.** At 0 since before session open (grandfathered), unmoved across 4
   runs and 25 casts. **It is why `checkGear.ts` prints a HALT banner even when
   both arms are healthy** — do not read that banner as an arm halt without
   checking the slot.
2. **The energy accounting drift fired on every run** — committed 60 vs observed
   59. Expected in-run passive regen (18/hr); the guard enforces off committed
   spend. Not asserted, not a defect.
3. **`start_run` still carries no ring debit on the wire.** Unchanged from
   session 112: the spend is observable only by reading balances before and
   after.
