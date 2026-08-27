# session 104 — 2026-08-27 — proc effect sizes re-verified + the standing entry tier switched to Tier-1 — GATE PASS (both parts) — code at commit ca0342da7e3c2d9e671d12c5754a986ae8f34954

Brief: `handoff/next.md`, two parts, both dungeon-side, both offline.
**Zero live spend — no dungeon runs, no fishing casts, no items consumed.**
The only live calls were read-only: one `liveRun.ts --dry-run` and one
`checkDungeonToday.ts`.

---

## 0. The brief conflicted with the repo, and the repo won

The `/handoff` contract says to trust `STATE.md` over `next.md` and flag it.
This fired immediately, on Part A.

The brief opened: *"This is the direct continuation of §58's own unresolved
half"*, quoting §58's line that rates are not mechanics and that the effect-size
diff *"has not been done."*

**It had.** Before writing any code:

- `scripts/procEffectSize.ts` exists — session 101, 400+ lines, with a header
  comment describing exactly the measurement the brief specified.
- `tests/procEffectSize.test.ts` exists — 20 tests pinning the null, the three
  rules and the zero-matching control.
- QUESTIONS.md **§58 is titled** *"THE CAPTURE PATH IS COMPLETE, AND FOUR OF THE
  FIVE ROLLED STATS NOW HAVE AN EXACT EFFECT SIZE."*
- DECISIONS.md carries four 2026-08-26 entries with the verdicts, including
  `block = floor(ATK/2), evasion = full negate, lck = crit at exactly 2x ATK`
  and `tenacity and intuition are RULED OUT as damage mitigation`.

The brief was quoting §58's **problem statement** as if it were §58's
conclusion. CLAUDE.md rule 9 covers precisely this ("a brief's claims are
hypotheses to verify"), and the cost of checking was about four minutes.

**Two things were genuinely open, and only those were done:**

1. The corpus has grown by 4 runs (session 103) since the measurement. §58 item
   7 says the script is *"re-runnable as volume accumulates"* — so re-run it.
2. **The brief's own item 2 — the `AddTenacity` split — had never been done.**
   This turned out to be the real work, and it was worth doing.

Items 1, 3, 4, 5, 6 and 7 of the brief's Part A were already satisfied by
session 101. Item 4 (use `intuition` as a sanity control on the method) was
re-run as a check rather than skipped, and it passes.

---

## 1. Part A — re-run at +184 exchanges

`npx tsx scripts/procEffectSize.ts`, corpus **1919 → 2103 exchanges**, 1314 of
them status-clean.

```
▸ proc effect sizes — 2103 exchanges, 1314 of them status-clean

  NULL (no proc fired): damage taken === attacker currentATK   2378 / 2485

  flag            predicts       status-clean        all exchanges     control (stat>0, unfired)
  blockProc0      floor(ATK/2)    35/35   [90-100%]      60/63           0/1154
  evadeProc0      0                 3/3   [44-100%]        5/5            0/155
  critProc0       2*ATK           10/10   [72-100%]      17/18            0/677
  blockProc1      floor(ATK/2)    10/10   [72-100%]      22/25            0/721
  evadeProc1      0                 9/9   [70-100%]      22/22            0/707
  critProc1       2*ATK           11/11   [74-100%]      16/17            0/697
```

**Verdicts, stated plainly per the brief's item 7:**

- **`block` — PARTIAL REDUCTION, exactly `floor(ATK/2)`.** Not a negate.
- **`evasion` — FULL NEGATE**, 0 damage taken.
- **`lck` — CRIT, exactly `2 x ATK`.**
- **`tenacity` — NO measurable damage effect.** See §2.
- **`intuition` — NO measurable damage effect.** It denies a MOVE.

**The control column is still 0 on every row — now 4111 matched exchanges**
(was 3577). Same stat non-zero, flag unfired, rule matched zero times. That
separation is the result; the per-flag Wilson intervals are wide and are
reported wide.

**Sanity check on the method (brief item 4) — PASSES.** `intuition`'s mechanic
was settled independently in §57/§58 via `intuition_block` events. The
fired/unfired diff recovers it unchanged: **5 of 6 non-blocked procs took the
attacker's FULL ATK**, and the sixth also carried `blockProc0` and took exactly
`floor(ATK/2)` — that is block, not intuition. The method reproduces a known
answer, so it is trusted on the open flags.

---

## 2. Part A, the new half — tenacity split by `AddTenacity`

Session 103's dead-end note found tenacity's proc RATE moving with whether
`AddTenacity` was picked *and* with pick order — n=4 runs, explicitly not a
rule. The brief's item 2 correctly identified that **pooling all
tenacity-fired exchanges without noting boon presence could mix two
populations.**

Implementation: `Exchange` gains `boons: [string[], string[]]` read off
`players[n].pickedBoons[].BoonType` on the PRECEDING state, and
`tenacityByBoon()` partitions every `tenacity > 0` exchange by
side x boon-picked x fired.

```
  side  AddTenacity  proc       n   OnHeal   damage tracks the plain null
  0     picked       FIRED     20      3           7/8
  0     picked       unfired  360      7       223/231
  0     not picked   FIRED      4      0           2/2
  0     not picked   unfired  547      9       287/312
  1     picked       FIRED      0      0             n/a
  1     picked       unfired    0      0             n/a
  1     not picked   FIRED     23      4           7/9
  1     not picked   unfired 1125     62       550/608
```

### (a) `AddTenacity` raises the proc RATE

Player side: **20/380 = 5.26%** [3.43–7.99%] with the boon vs
**4/551 = 0.73%** [0.28–1.85%] without. Fisher two-sided **p = 2.23e-05**.

Session 103 was right that the boon matters. At the exchange level, pooled
across the whole corpus, presence is measurable where 4 runs could not show it.

**Caveat, stated rather than buried: exchanges are clustered within runs and
are not independent observations, so this p is anti-conservative.** The
direction is the finding; the exact figure is not. **Pick ORDER is still
untested** — this splits on presence only.

### (b) The boon is not a gate

Tenacity fires **4 times on the player side with no `AddTenacity`**, and
**23 times on the enemy side**, where `AddTenacity` appears in zero rows. The
boon modulates a rate; it does not switch the mechanic on.

### (c) Enemies never pick boons at all — a structural control arm

**0 of 5820** states carrying a `players[]` have a non-empty `pickedBoons` on
`players[1]`, whole corpus. (Player side: 4994 of 5820 non-empty.)

This is asserted in the test as a **zero count**, which DECISIONS 2026-08-26
normally forbids (the `deckShuffle` finding: *"a test may not assert a zero
COUNT on a chance event"*). It is permitted here because **this is not a chance
event** — no capture path exists by which an enemy acquires a boon. The test
comment says so explicitly, so the exemption is visible rather than accidental.

This is what makes the split a genuine control rather than a re-labelling: any
effect surviving on side 1 cannot be the boon's doing.

### (d) The load-bearing result — the OnHeal association is not the boon

§58 recorded tenacity as associated with `OnHeal` at n=6 heals. That
association **survives in the arm where the boon is structurally absent**:

```
  enemy side (boon impossible)   fired 4/23 = 17.4%   unfired 62/1125 = 5.5%   p = 0.0386
  player side, boon picked       fired 3/20           unfired 7/360            p = 0.0119
  player side, no boon           fired 0/4            unfired 9/547            p = 1.0    (uninformative)
```

**Still an ASSOCIATION, not a mechanic.** It now rests on 10 heals rather than
6, and the heal AMOUNTS still cannot be bounded at that volume. The player's
boon-free arm at 0/4 is reported as uninformative, not as a contradiction.

### (e) The damage verdict survives the split

This is the question the split was actually asked to answer, and the answer is
that **pooling had not hidden a damage effect in one arm**:

- tenacity-FIRED cells, pooled: **16/19** track the plain null
- tenacity-unfired cells, pooled: **1060/1151**

Same in both arms. The residual is the same status-effect error term that §58
and §59 already characterise (`Weak`, `Vulnerable`, `Burn`, `Regen`).

### (f) Tests

`tests/procEffectSize.test.ts` **20 → 25**, on the same bounded 20-run slice
with slice-safe assertions:

- the enemy side is a structurally boon-free arm (`boons[1]` empty, every cell)
- the player side does carry boons, so both arms are populated
- **tenacity mitigates no damage in EITHER arm** — status-clean, no other proc
  → damage equals the attacker's plain `currentATK`. Vacuously true on a slice
  containing none, which is what makes it slice-safe.
- the eight cells PARTITION every `tenacity > 0` exchange exactly once
- no cell reports more heals than exchanges

### (g) Not done, deliberately

`src/sim/combat.ts` untouched. **CAPTURE-1's prohibition — do not stub,
default, or flag-hide the proc branches — stands exactly as §58/§59 left it**,
and the brief's item 6 said so explicitly. This re-verifies three effect sizes
at higher volume and removes one confound from a fourth. It does not close
CAPTURE-1 and does not authorise building the model.

---

## 3. Part B — the standing entry tier switched Tier-3 → Tier-1

User directive: gold-ring stock covers roughly **16 more days** at the Tier-3
run rate, while the Hard Cores event has **42 days** left. Continuing would
exhaust the rings with ~26 days of the event still open.

### (a) The trap the brief walked into, caught before shipping

The brief described `index` as *"`entryData`'s tier — 1/2/3"*. Reading
`config/discovered.json` directly:

```
  entryData[0]  "Forbidden Woods Tier 2"  tier 2  inputItems [134..140]  dropMultiplier 2   (silver rings)
  entryData[1]  "Forbidden Woods Tier 1"  tier 1  inputItems []          dropMultiplier 1
  entryData[2]  "Forbidden Woods Tier 3"  tier 3  inputItems [243..249]  dropMultiplier 4   (gold rings)
```

**The array is ordered tier 2, 1, 3 — array position is NOT tier.** A
3-element array has no position 3, yet every juiced start this bot has sent
used `index: 3` and consumed gold rings. Two readings both explained that
(1-based array position, or the tier number itself) and they **disagree about
what `index=1` means**: Tier 2 (seven silver rings) vs Tier 1 (nothing).

Resolved from SPEC §3c, which already documents it and already warns about the
ordering: **`data.index` IS the tier**, confirmed live twice by user captures
(Tier-3 sent `index: 3`; Tier-2 sent `index: 2`). So `--juiced-index=1` is
Tier 1, `inputItems: []` — the brief's target was right, its reasoning was not.

**This is now pinned**, because the wrong reading looks right: a future reader
"correcting" the flag by array offset would select Tier 2 and silently spend
seven silver rings per run.

### (b) The brief's three code claims, verified rather than assumed

- **No hardcoded `3`.** `buildJuicedStartRunEnvelope(dungeonId, index,
  consumables)` — `scripts/liveRun.ts:415` — takes `index` as a pure parameter
  with no default. `--juiced-index` is required and fail-closed (`parseArgs`
  throws if `--juiced` is passed without it). Confirmed.
- **Potion loading is index-independent.** The auto-load gate reads
  `args.juiced` alone (`scripts/liveRun.ts` ~2118, `} else if (!args.juiced) {`).
  Confirmed — and the dry-run below demonstrates it at the new index.
- **`dropMultiplier` has NO consumer.** `grep -rn dropMultiplier src scripts
  tests` returns exactly two hits, both zod schema fields
  (`src/api/schemas.ts:69`, `src/api/fishing.ts:122`). Nothing computes reward
  expectations from it, so the switch cannot silently break a report. Checked
  precisely because a path assuming Tier-3's `4` would have gone wrong quietly.

### (c) The cost, in plain numbers

`dropMultiplier` **4 → 1**, and per SPEC §3c it governs **Hard Core (item 845)
only**. **Dendren Root (item 846) answers to `isJuiced` alone and is
unaffected.**

Session 103's four Tier-3 runs paid **8,736 / 8,976 / 7,152 / 6,096 = 30,960**
Hard Core. The same four at Tier 1 project to **~7,740**.

**That is a DERIVATION from the multiplier, not a measurement.** Census of
every `start_run` envelope in the whole log corpus:

```
  isJuiced=true index=3   x34   (no other combination has ever been sent)
```

**Tier-1 has no observed payout here at all.** Session 42's Tier-2 comparison
was a *user* capture from the browser, not a bot run. Measure it on the first
live Tier-1 run rather than quoting ~7,740 back as fact.

### (d) What changed

- **CLAUDE.md rule 11** — `--juiced-index=3` → `--juiced-index=1`, with the
  date, the ring-scarcity reason, the Hard Core cost in numbers, the
  derivation-not-measurement warning, and the index-is-not-an-array-position
  warning. Written the way rule 8 documents why "highest tier" replaced
  "lowest tier" — the number is not changed silently.
- **Four operator-facing hints** — `scripts/doctor.ts`, `scripts/liveRun.ts`
  help text, `scripts/orchestrator.ts` x2.
- **`tests/orchestrator/dungeonArmClosed.test.ts`** — the existing pin updated,
  plus a new test asserting **no source file anywhere recommends
  `--juiced-index=3`**. A stale hint IS the bug here: nothing in code defaults
  the index, so the policy lives entirely in the printed command line a human
  copies.
- **Nothing else changed.** `index` and `isJuiced` are independent axes: still
  60-energy juiced, still 3 of 12 run-units, still auto-loads potions. Rule
  11's other three conditions are untouched.

### (e) Dry-run — clean, spent nothing

`npx tsx scripts/liveRun.ts --dry-run --juiced --juiced-index=1 --runs=1`:

```
  account <USER> noobId <NOOB>
  · --juiced: next genuinely new start_run will send isJuiced:true, index 1.
  · potions: config authorizes up to 3x itemId 131 (hard cap 3); 17 in stock -> loading 3.
  · next genuinely new start_run will load 3x itemId 131, used at own HP ≤50%.
  ▸ energy preflight: pool 29 short of the planned 60 (deficit 31) — reading the ROM bank.
  ▸ ROM bank: 37 ROMs, 26 with energyCollectable > 0, 2548 energy claimable.
  ▸ [read-only] would claim 1 ROM(s) for a snapshot total of 279/31; claiming NOTHING.
  [dry-run] would POST start_run (dungeonId 5, juiced)
▸ done. energy spent (guard-tracked) 0, runs 0
```

`index 1` sent, potions still auto-loading (confirming the gate is
index-independent in behaviour and not just in source), energy resolved via the
ROM bank per rule 12.

**No live Tier-1 run was performed** — the brief forbade it, and rule 11 needs
a per-run human go-ahead regardless.

**Ledger checked afterwards** (rule 13 discipline, applied to a read-only
command as well): `npx tsx scripts/checkDungeonToday.ts` → `dungeonId 5
dayProgressEntities (real runs today): null`, `[]`. **0 runs on a fresh game
day.** The dry-run spent nothing, confirmed against the server rather than
inferred from the tool's own output.

---

## 4. QUESTIONS.md entries added

- **§61** — the three user answers the brief carried, recorded as ANSWERED per
  the §52–§56 convention: (1) the 11,111 unspent skill XP is **closed, not
  deferred** — do not re-raise it; (2) the loadout **holds steady going
  forward**, with the explicitly **non-retroactive** caveat that session 103's
  runs 1-3 vs run 4 remain separate arms; (3) the rod is being **repaired, not
  replaced**, so `CORPUS_DECK` needs no change.
- **§62** — this session's proc verdicts, including §0 recording that the
  measurement already existed.

`tests/enemies.test.ts`'s census doc comment rewritten per (2): a new loadout
combo is now a **signal to chase** rather than expected drift, with the
historical caveat stated in the same comment so the two halves cannot be
separated by a future reader.

---

## 5. Verification, against the final tree

```
npx tsc --noEmit                     exit 0
npx vitest run --maxWorkers=4        111 files, 2063 passed / 2063   (was 2057)
git diff --check                     clean
secret scan over the diff            0 hits on all four patterns
tests/discoveredShipsClean.test.ts   8 passed
.gitignore                           all seven required entries present
```

Suite delta **+6**: 5 tenacity-split cases, 1 stale-hint pin.

Secret scan detail — the four patterns
(`0x[a-fA-F0-9]{4,}`, `noobId\s*[0-9]`, `eyJ`, `PRIVATE`) run over the 378
added lines of the diff: **0 hits each**. A repo-wide scan surfaced only benign
hits (a `package-lock.json` sha512 integrity string, and historical prose in
`DECISIONS.md`/`handoff/log/` about the deleted Path B, plus
`tests/clientSurface.test.ts`'s grep that *forbids* signing imports).

**No new fixtures this session** — no live run, and the dry-run's fixture dir
holds only an ignored `raw/`, so git never sees it. Four such empty `run-`
dirs now exist; three predate this session. `loadExchanges` skips them.

---

## 6. Surprises worth keeping

1. **A brief can quote a resolved entry's problem statement as if it were the
   open question.** The wording was persuasive because it was verbatim from
   §58 — it just came from the paragraph §58 wrote *before* answering itself.
   The cheap defence was checking `scripts/` for a file named after the task.
2. **`entryData` being ordered 2, 1, 3 makes the wrong reading of `index` look
   right.** Both candidate readings explain the only evidence we had (34 runs
   at `index: 3`). SPEC §3c had already resolved it *and* already flagged the
   ordering — the spec was ahead of the brief on both counts.
3. **The enemy side is a free control arm nobody had used.** Enemies never pick
   boons, on 5820 of 5820 states. Any player-side boon confound can be checked
   against side 1 for nothing, and this is the first analysis to exploit it.
4. **`dropMultiplier` is captured, schema-validated, and read by nothing.** It
   is the number the whole tier decision turns on, and no code consumes it.
