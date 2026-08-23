# STATE — session 83 — 2026-08-23 (PT) — code at commit 8896dd1a

## Status
**GATE 1 PASS. GATE 2 PASS.** Suite **1614/1614** (was 1594), 96 files,
`tsc --noEmit` clean, `git diff --check` clean, `assertionCoverage` **0
vacuous**, **`preflight.ts` PASSED** with a clean secret scan at the final
commit (1599 passed / 15 author-data skips in the stranger's tree).

- **Offline session by the SERVER's own arithmetic, not the brief's.** Rule 13
  first: `DayCount#…#Dungeon#5` = **12/12**, `dayDocs[pondId 2]` = **20/20**.
  Both spent, 10.2h to the 11:00 PT rollover. Zero live spend this session.
- **GATE 2 reproduces the brief BYTE FOR BYTE**, histogram included.
- **GATE 1 reproduces in shape and not in count** — 389 rows against the
  brief's 386 — and the delta is recorded rather than hidden (rule 9).
- **§3 got an answer, and it is an INVERSION.** A decision-time signal DOES
  separate dead hands from live ones. The dead hands it finds are the ones a
  redraw cannot fix.
- **The pre-death ordering DISSOLVED under a within-room control.** It is not
  a death signal. Do not reorder CAPTURE-1 — for a stronger reason than n=4.
- **Ship-nothing posture HOLDS.** `redrawEnabled` still false,
  `REDRAW_THRESHOLD` untouched, redraw still CLOSED. Nothing live changed.

## What works
- **§2a — the triple reconstruction, checked BEFORE it is used.** Pinned in its
  own test so a corpus change that breaks the METHOD fails loudly instead of
  shifting the table it feeds.

  ```
    nextCardIndex deltas when it advances   -8:4  -7:3  3:137      brief: exact
    draws containing a previously-unheld card    144 / 144         brief: exact
  ```

  ⚠ The unheld-card check must exclude the DRAWING turn's own `hand` — the
  state doc's `hand` on a refill turn is ALREADY the new hand, so `j <= i`
  reports **0 of 144**, and the vacuous form reads like a failure. Asserted
  both ways.
- **§2 — GATE 1, the four-cell table** (brief in parentheses):

  ```
    actual reaches   redrawn reaches        n = 389 (386)
       yes               yes         261 (262)  67.1%
       yes               no           27  (26)   6.9%   ← sacrifice
       no                yes          45  (42)  11.6%   ← rescue
       no                no           56  (56)  14.4%

    hit-availability  74.0% (74.6) → 78.7% (78.8)
    mean rescue cost  1.60 (1.57)    1:24  2:15  3:6
  ```

  **Both arms agree EXACTLY on the actual arm's numerator, 288**, so only the
  denominator moved. `neitherReaches` agrees at 56. The brief's table is **not
  a subset** of this one — its `bothReach` is one HIGHER — so the difference is
  not a filter alone. Conditional on a dead hand (101 of 389, 26.0%) a redraw
  restores availability **44.6%** of the time.
- **The clause that decides `n`, and it is a trap.** "Exactly one card moved
  from hand to discard" read as a hand-LENGTH decrement silently drops every
  REFILL turn — the hand goes 1 → 3 — and yields **286** rows. Read as "the
  discard grew by exactly one card and that card was held" it yields **389**.
  Same English sentence, different measurement. Pinned as a test.
- **§3 — separability, and it is the session's most useful result.**
  `heldCoverage` (distinct cells the held hand can put a zone on, over every
  reachable focus — uses the hand, the focus point and the meter, **nothing
  about where the fish goes**) separates at **AUC 0.922**, dead mean 5.13 vs
  live 13.32. A hand covering all 16 cells is dead **0 of 141** times.

  ```
    rescue rate among the 101 DEAD hands
      coverage <= 3        46 dead    7 rescued    15%
      coverage >= 4        55 dead   38 rescued    69%
      focus budget 0       74 dead   19 rescued    26%
      focus budget >= 1    27 dead   26 rescued    96%
  ```

  **One cause for both halves: a dead hand is usually a hand firing from an
  EXHAUSTED focus meter, and a redraw does not restore the meter.** 74 of 101.
  `coverage <= K` over all plays is worthless where it is confident — K=3 fires
  55 for 7 rescues and 7 sacrifices, net **zero**, 39 firings wasted. Restricted
  to `budget >= 1` the same signal is clean: K=6 fires 6 / rescues 6 /
  sacrifices 0 / 9 mana; K=10 fires 44 / rescues 18 / sacrifices 3 / 60 mana.
- **§4 — GATE 2, the mana slack, reproduced EXACTLY** and wired into
  `damageEconomy.ts` §4a beside the margin column via a shared printer:
  **mean 5.85, median 7, over 147 RESOLVED casts; 132 of 147 (89.8%) left mana
  unspent; mana-out 15; escapes 5.42, catches 6.73.** Histogram identical.
  Predicate recovered: **ALL traces, RESOLVED only (`caught || escaped`)**,
  terminal doc's `playerHp` — not `isCleanTrace`, which gives 146 / 5.86.

## What's broken
- **`run_over` (`liveRun.ts:1233`) still has NEVER fired**, and session 78 §3's
  `EV support: n/m` line still lives inside it. **Untouched this session** — it
  is a live-path edit and the posture is ship-nothing. The gate it should carry
  is written in §Open questions 1.
- **Three of the five §2b predicate clauses are VACUOUS on this corpus.** "Every
  card in the held hand belongs to one revealed draw-triple" drops **zero** rows
  under BOTH readings (any-triple and same-single-triple), and "a further play
  exists" is implied by "the next triple exists". Kept and labelled, because a
  corpus where they start biting is a corpus where the method needs re-checking.
- **§3's thresholds are fitted to this corpus with ORACLE labels and no held-out
  set**, n=27 dead in the conditioned arm. A shape, not a tuning.
- **§2's method is inferred, never observed.** No redraw has ever been played
  live. §2a is the strongest evidence available and it is indirect.
- Carried, untouched: H2's proc model (CAPTURE-1); `play_cards`/redraw/
  `use_fishing_item` unrouted; §0a NOT lifted, **+19.40pp MAY NOT BE QUOTED**;
  `mana -= card.manaCost` unconfirmed; three Big Heals do not save a run (M2
  blocked); the crit rule still has two members and needs a base-6/8/10 crit.

## Corrections to SPEC.md
- **The pre-death ordering is a WITHIN-ROOM artefact, not a death signal, and
  session 82's §2 reading is RETRACTED.** Recomputed from the four session-82
  runs' JSONL (174 decisions — reproduces the pooled table exactly). Three
  things the old reading could not see:
  1. **All three pre-death decisions of a run carry the IDENTICAL unmodelled
     set.** They are one fight. Effective **n = 4, not 12**.
  2. **The within-room control kills it.** The decisions EARLIER in the room
     each run died in already read `STATUS_EFFECT` **17/24 = 71%** and
     `ENEMY_BUFF` **0/24 = 0%**. The pre-death window adds nothing.
  3. **A depth confound sits underneath.** `STATUS_EFFECT`'s base rate climbs
     23% (room 1) → 75% (room 8); `ENEMY_BUFF` collapses 100% (room 6) → 24%
     (room 7) → 0% (room 8). Deaths cluster at rooms 7–8.
- **`STATUS_EFFECT` and `ENEMY_BUFF` are NOT complementary** despite both
  reading 87/174. The 2×2 is 46 / 41 / 41 / 46 — near-independent.
- **Scoring the redraw arm from the ACTUAL timeline's next focus point is the
  WRONG counterfactual**, and the brief's own number rules it out: it gives
  redraw availability **71.5%**, i.e. worse than the held hand, against the
  78.8% the brief reports. The right set is the DECISION-POINT one
  (`prev.focusPoint`, budget `budgetBefore(prev, cur)`) — and it is also the
  principled one, since the meter is a non-regenerating pool and reaching a
  cell in two moves within total budget B is the set reachable in one move of B.
- Unchanged: resolved IDs forbiddenWoods=5, dendren nodeId="5"/pondId=2. Move
  charges: PRESENT — unchanged, not re-measured. No new fixtures this session.

## Dead ends
- **Trying to reproduce the brief's n=386.** Six predicate variants tried
  (clean-vs-all traces, `>= i` vs `> i` for the next triple, crit zones in and
  out, any-triple vs single-triple hand accounting, both focus-set readings).
  None lands on 386, and none CAN: the brief's `bothReach` is one higher than
  this measurement's, so its table is not a subset of any subsetting of this one.
- **Reading "exactly one card moved from hand to discard" as `hand.length − 1`.**
  Drops every refill turn. 286 rows instead of 389.
- **Excluding the drawing turn's own hand from the unheld-card check.** Gives
  0/144 and looks like the method failing.
- Standing, none re-opened: redraw CLOSED; energy is never a blocker; `--dry-run`
  before claiming one; do not revert rule 8; +19.40pp SUSPENDED; `boonCapture`
  OFF; no H2 proc model; no M4 lines; `DEFAULT_POTION_THRESHOLD`/`chooseNewCard`
  UNTOUCHED; no 429 backoff without an observed 429; do not shuffle the
  random-sample deck; do not complete the corrode perpetual table.
- **`npx tsx` and `git` both fail under the command sandbox.** Run unsandboxed.
- **`preflight.ts` (~90s) runs BEFORE the push**, after committing. No new
  fixtures this session, so the count was stable across it.

## Metrics
- **Live: ZERO. No dungeon run, no fishing cast, no on-chain anything.** Both
  server ledgers read and both spent before the session began.
- Suite **1594 → 1614** (+20, one new file), 96 files, 0 vacuous. Stranger's
  tree: 1599 passed / **15** author-data skips (session 82 recorded 13 at its
  own commit — rule 10, don't compare the two counts as if they were the same
  gate).
- Corpus UNCHANGED: 148 cast traces, 612 plays, 147 resolved casts. Nothing
  captured, nothing appended.
- New offline measurements: 389-row redraw counterfactual, 101 dead hands,
  AUC 0.922 separability, 147-cast mana-slack table.

## Open questions for Claude
1. **`run_over`'s convergence, and the gate I would put on it.** Two exits:
   `run_ended_or_absent` (`liveRun.ts:1151`), which every real run takes, and
   `run_over` (`:1233`), which none ever has and which owns the coverage
   summary and the `EV support` line. **The fix I would argue for is extracting
   ONE `finishRun(reason, room)` that both call** — two exits printing different
   things is how this happened. **The gate: the reporting must be demonstrated
   executing on a REPLAYED run of each shape — one that ends with state absent,
   one that ends with state present-and-finished — before it is trusted live.**
   That is meetable offline with the existing fixtures; it needs no run-unit.
2. **The pre-death ordering is dead as posed, and I think the replacement
   question is not answerable by more runs alone.** The honest measurement is
   depth-matched: compare a death fight's unmodelled set to non-death fights at
   the SAME room number, pooled. At the current death distribution (rooms 7–8 in
   3 of 4) the controls have to come from runs that SURVIVE past room 7, and the
   corpus has none. **Is that the capture to ask for, or is the question worth
   dropping?** Rule 6 says say which.
3. **§3 makes a shadow evaluation designable for the first time, and I did not
   design one.** The candidate is not `bestEv < threshold`; it is
   `heldCoverage <= K AND focusBudget >= 1`, and its cost on the corpus is 60
   mana across 94 casts against a pool that discards 5.85 per cast. **Does the
   user want that shadow-evaluated (log what it WOULD have fired on, live, send
   nothing), which is the only way to get non-oracle labels?** That is a
   live-path instrumentation change and needs a go-ahead.
4. **Whether §2 changes the CLOSED verdict is the USER's call and I am not
   making it.** What is now measured: the price that closed redraw was quoted
   against a resource 89.8% of casts do not exhaust; a redraw takes no shot so
   it cannot miss, and a miss is what heals the fish; and the rescues are real
   but the trigger is the hard part. The two correctness fixes (the client
   throwing away the redraw's `FISH_MOVED`; `MAX_REDRAWS_PER_CAST`) are still
   unpaid and are live-path edits.
5. **12 run-units and 20 casts refresh at 11:00 PT.** The crit rule still needs
   one base-6/8/10 crit; card 10 is in the deck. First fishing after the roll.

## Files changed
```
 1 commit (8896dd1a) + this recap.

  A  src/sim/fishing/redrawCounterfactual.ts   +568  the predicate, the triple
                                                     check, the table, mana
                                                     slack, separability
  A  scripts/redrawCounterfactual.ts           +226  the report, §1–§5
  A  tests/fishing/redrawCounterfactual.test.ts +334  20 tests, gate 1 + gate 2
  M  scripts/damageEconomy.ts                   +31  §4a mana slack, shared
                                                     printer, beside the margin
  A  handoff/scratch-session-83.md             +123  surprises as they landed

  5 files changed, 1282 insertions(+), 0 deletions(-)
```

---

# scratch — session 83

## Ledgers (rule 13, server-read, not arithmetic)
- `doctor.ts`: all checks pass, token 130.1h. Local: dungeon 12 runs / fishing 20 casts.
- `checkDungeonToday.ts`: `DayCount#…#Dungeon#5` = **12** (of 12). Spent.
- `checkFishingCaps.ts`: `dayDocs[pondId 2]` = **20/20**. VERDICT BLOCKED, 10.17h to 11:00 PT.
- Offline session confirmed by the server, not by the brief's arithmetic.

## Surprise 1 — §2a reproduces EXACTLY, on ALL traces
`nextCardIndex` deltas when it advances `{+3: 137, −7: 3, −8: 4}` over **148**
traces; draws with previously-unheld cards **144/144**. Brief's figures, byte
for byte. Note the "previously-unheld" test must exclude the drawing turn's own
`hand` (`j < i`, not `j <= i`) — the state doc's `hand` on a refill turn is
ALREADY the new hand, so including it makes the check vacuous (0/144).

## Surprise 2 — gate 2 reproduces EXACTLY, and its predicate is recoverable
n=147 mean 5.85 median 7, mana-out 15, escapes 5.42, catches 6.73, and the
whole histogram. Predicate: **ALL traces (not `isCleanTrace`), RESOLVED only
(`caught || escaped`)**, terminal doc's `playerHp`. `isCleanTrace` gives 147 too
but mean 5.86 — the brief's is the resolved filter, not the clean one.

## Surprise 3 — gate 1 does NOT reproduce byte-for-byte, and the delta is legible
Mine (ALL traces, crits counted, redraw arm reachable from `prev.focusPoint`
with `budgetBefore(prev,cur)`):

```
              brief        mine
  n            386          389
  yes/yes      262          261
  yes/no        26           27
  no/yes        42           45
  no/no         56           56
  actual avail 74.6%       74.0%     ← SAME numerator, 288. Denominator differs.
  redraw avail 78.8%       78.7%
  rescue cost  1.57 {1:24,2:12,3:6}  1.60 {1:24,2:15,3:6}
```

**The brief's table is not a subset of mine** — `yy` would have to GAIN a row —
so the difference is not only a filter. Decomposed: 3 rows I count that it does
not, all held-hand-size 2, all in the RESCUE cell; plus one row it scores as a
redraw-reach that I score as not. Both arms' "actual reaches" count is
identically 288, which is what makes the delta readable at all.

Predicate clauses that turn out to be VACUOUS on this corpus (checked, both
readings): "every card in the held hand belongs to one revealed draw-triple",
in the any-triple AND the same-single-triple reading. Neither drops a row.
"A further play exists" is also implied by "the next triple exists" (286→286
under the strict one-card reading; 422→389 under the correct one).

The clause that actually decides `n`: **"exactly one card moved from hand to
discard"**. Read as `hand.length − 1` it gives 467/286 — it excludes every
REFILL turn, where the hand goes 1 → 3. Read as "the discard grew by exactly
one card and that card was in the held hand" it gives 603/389. The second is
the true statement of the words; the first is a different measurement wearing
them.

## Surprise 4 — variant B is ruled out by the brief's own numbers
Scoring the redraw arm from `cur.focusPoint` with `budgetBefore(cur,next)`
gives redraw availability **71.5%**, i.e. redraw is WORSE than the held hand.
The brief reports 78.8%, so it used the decision-point reachable set
(`prev.focusPoint`, budget `B`). That is also the principled one: the meter is
a per-cast pool, and reaching a cell in two moves within total budget B is the
same set as reaching it in one.

## Surprise 5 — §3's separability question has an answer, and it is an INVERSION
`heldCoverage` (distinct cells the held hand can put a zone on, over every
reachable focus — decision-time only) separates dead from live hands at
**AUC 0.922**, dead mean 5.13 vs live 13.32. A hand covering all 16 cells is
dead **0 of 141** times.

**And the dead hands it finds are the ones a redraw cannot fix.**

```
  rescue rate among the 101 DEAD hands
    coverage <= 3        46 dead    7 rescued    15%
    coverage >= 4        55 dead   38 rescued    69%
    focus budget 0       74 dead   19 rescued    26%
    focus budget >= 1    27 dead   26 rescued    96%
```

One cause for both: **a dead hand is usually a hand firing from an exhausted
focus meter, and a redraw does not restore the meter.** 74 of the 101 dead
hands have budget 0. A fresh triple fired from one fixed cell is usually dead
too.

`coverage <= K` as a trigger over all plays is worthless where it is confident
— K=3 fires 55 times for 7 rescues and 7 sacrifices, net **zero**, with 39
firings wasted on hands nothing could save. Conditioned on `budget >= 1` the
same signal is clean: K=6 fires 6, rescues 6, sacrifices 0, costs 9 mana;
K=10 fires 44, rescues 18, sacrifices 3, wastes 1, costs 60 mana.

⚠ Fitted to this corpus with ORACLE labels and no held-out set. n=27 dead in
the conditioned arm. It is a shape, not a threshold.

## Surprise 6 — the pre-death ordering is a WITHIN-ROOM artefact, not a death signal
Recomputed from `logs/run-2026-08-23-*.jsonl` (the four session-82 runs, 174
decisions — reproduces STATE.md's pooled table exactly). Two things STATE.md
could not see:

1. **All three pre-death decisions of a run carry the IDENTICAL unmodelled
   set.** They are one fight. The effective n is **4, not 12**.
2. **The within-room control kills it.** For each run, the decisions EARLIER
   in the same room the run died in:

```
   death room 8 : earlier n=5  STATUS_EFFECT 3  ENEMY_BUFF 0
   death room 3 : earlier n=6  STATUS_EFFECT 4  ENEMY_BUFF 0
   death room 7 : earlier n=6  STATUS_EFFECT 5  ENEMY_BUFF 0
   death room 7 : earlier n=7  STATUS_EFFECT 5  ENEMY_BUFF 0
                  ------------------------------------------
                  17/24 = 71%              0/24 = 0%
```

The death room's ORDINARY decisions already show STATUS_EFFECT high and
ENEMY_BUFF at zero. The pre-death window adds nothing.

3. **And there is a depth confound underneath that.** STATUS_EFFECT's base
   rate climbs 23% (room 1) → 75% (room 8); ENEMY_BUFF collapses 100% (room 6)
   → 24% (room 7) → 0% (room 8). Deaths cluster in rooms 7–8. **Any pre-death
   statistic drawn from deaths that cluster deep is measuring depth.**

STATUS_EFFECT and ENEMY_BUFF are NOT complementary despite both being 87/174 —
the 2×2 is 46/41/41/46, near-independent.

---

## Verbose appendix — session 83

### A. The ledger reads, in full (rule 13 before anything)

```
▸ doctor — profile "default"
  ✓ Node 24.13.1 / repo root / token valid 130.1h
  ✓ config valid — dungeon 5, 20 energy/run, budget 240/day, 12 runs
  ✓ fishing configured — node 5, 20 casts/session
  ✓ authenticated as <USER> — <ADDR>
  today's local ledgers (roll over at 11:00 Pacific, 10.2h from now):
    dungeon: 12 runs / 240 energy recorded
    fishing: 20 casts / 240 energy recorded

checkDungeonToday.ts   DayCount#…#Dungeon#5  UINT256_CID: 12
checkFishingCaps.ts    dayDocs[pondId 1] = 0 / dayDocs[pondId 2] = 20
                       VERDICT: BLOCKED — cap spent. 10.17h to the window.
```

The brief's arithmetic said the same thing. The point of reading it anyway is
that arithmetic about a ledger is not authority over it.

### B. The full predicate-variant grid, since the brief's count did not reproduce

Counts under every reading tried, ALL 148 traces unless marked:

```
  total play transitions                                        612
  one card moved, read as hand.length − 1                       467
  one card moved, read as discard grew by a held card           603

  + next triple exists (k >= i)          length reading  286   discard reading  422
  + next triple exists (k >  i)          length reading  286   discard reading  336
  + a further play exists in the cast    length reading  286   discard reading  389
  same, CLEAN traces only                length reading  286   discard reading  388
```

And the four-cell table under the two focus-set readings:

```
                                            n     yy   yn   ny   nn   avail A   avail R
  A  reach from prev.focusPoint, budget B  389    261   27   45   56    74.0%     78.7%
  B  reach from cur.focusPoint,  budget'   389    237   51   41   60    74.0%     71.5%
  A, crit zones EXCLUDED                   389    259   26   46   58    73.3%     78.4%
  A, CLEAN traces only                     388    261   27   44   56    74.2%     78.6%
  brief                                    386    262   26   42   56    74.6%     78.8%
```

Variant B is ruled out by the brief's own reported availability. Crit exclusion
is ruled out by session 81's validated `cardCovers` convention. Neither the
clean filter nor the triple-successor reading closes the remaining 3 rows, and
no subsetting can, because the brief's `bothReach` is HIGHER than any of these.

### C. The room-by-room base rates behind the retracted pre-death claim

174 decisions, four runs, deaths at rooms 8 / 3 / 7 / 7:

```
  room 1: n= 13  STATUS_EFFECT   3 ( 23.1%)   ENEMY_BUFF   0 (  0.0%)
  room 2: n= 27  STATUS_EFFECT   7 ( 25.9%)   ENEMY_BUFF  10 ( 37.0%)
  room 3: n= 30  STATUS_EFFECT  12 ( 40.0%)   ENEMY_BUFF  21 ( 70.0%)
  room 4: n= 29  STATUS_EFFECT  19 ( 65.5%)   ENEMY_BUFF  15 ( 51.7%)
  room 5: n= 24  STATUS_EFFECT  14 ( 58.3%)   ENEMY_BUFF  17 ( 70.8%)
  room 6: n= 18  STATUS_EFFECT  10 ( 55.6%)   ENEMY_BUFF  18 (100.0%)
  room 7: n= 25  STATUS_EFFECT  16 ( 64.0%)   ENEMY_BUFF   6 ( 24.0%)
  room 8: n=  8  STATUS_EFFECT   6 ( 75.0%)   ENEMY_BUFF   0 (  0.0%)
```

The within-run, within-room control:

```
  death room 8  pre-death SE 3/3, EB 0/3   |  same room, earlier: n=5  SE 3  EB 0
  death room 3  pre-death SE 3/3, EB 0/3   |  same room, earlier: n=6  SE 4  EB 0
  death room 7  pre-death SE 3/3, EB 0/3   |  same room, earlier: n=6  SE 5  EB 0
  death room 7  pre-death SE 3/3, EB 0/3   |  same room, earlier: n=7  SE 5  EB 0
                                              ------------------------------------
                                              17/24 = 71%          0/24 = 0%
```

**The death room's ordinary decisions already show the pattern.** Nothing
distinguishes the last three decisions from the rest of the fight they belong
to, because the unmodelled set is a property of the FIGHT.

Note the source: `logs/run-2026-08-23-*.jsonl`, which is gitignored and lossy.
These four runs' logs are present locally at the time of writing. A future
session that cannot find them cannot re-derive this — the retraction stands on
its own reasoning (three identical sets per run, and the within-room control),
which does not need the raw file to be believed, only to be re-checked.

### D. The two correctness fixes that remain unpaid

Neither was touched. Both are live-path edits and this was a ship-nothing,
offline session.

1. **`liveFishing.ts` discards the redraw's `FISH_MOVED`.** The live redraw
   response carries the fish's new position and the send path does not hand it
   to the matcher. Session 75 established the INFORMATION term is the larger
   half of a redraw's value — a real redraw buys an extra observation for the
   price of the mana. Without this fix a live redraw buys a fresh hand and
   *loses* an observation, which is a worse trade than the simulator's.
2. **`MAX_REDRAWS_PER_CAST`** is a fail-closed cap standing in for the fact
   that a redraw does not advance `turn`, so `MAX_TURNS` cannot bound it.

### E. What `scripts/redrawCounterfactual.ts` prints

Five sections: §1 the triple-reconstruction check (run BEFORE the table it
feeds), §2 the four-cell table with the three caveats printed rather than
assumed, §3 the separability analysis and both trigger sweeps, §4 the mana
slack via the printer `damageEconomy.ts` §4a shares, §5 a standing note that
none of it licenses a policy.

`npx tsx scripts/redrawCounterfactual.ts` — offline, deterministic, ~1s.
