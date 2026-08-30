# session 112 — 2026-08-30 — three user decisions, the oil-gap answer, two carried fixes, one Tier-2 run

Commit `b0d9b6a7`. Brief: `handoff/next.md` (session-112 brief, committed as
`5e815aa2`).

**All four brief steps done.** Headline results:

| step | subject | result |
|---|---|---|
| 1 | three user decisions recorded | **GATE PASS** |
| 2 | why the on-demand oil trigger never fires | **GATE PASS** — neither of the brief's hypotheses; no waste |
| 3a | fishing guard over-count | **GATE PASS** — fixed |
| 3b | TASKS §13 `chooseNewCard` | **GATE FAIL BY DESIGN** — parked on data, candidate built and NOT wired |
| 4 | one Tier-2 run | **RAN** — brief's gate unmeetable as worded; **falsified CLAUDE.md rule 11's cost paragraph** |

**Live spend: 1 dungeon run (3/12 run-units), 3 Foxglove Silver, 60 energy, 0
fishing casts.** Reached room 13, the deepest this corpus has gone.

---

## 0. A note on the session's starting state

`git log` showed `5e815aa2 session 112: record three user decisions, ...` as
HEAD, which reads as though session 112 had already run. It had not — that
commit changed **only `handoff/next.md`**, i.e. it is the BRIEF, misleadingly
named. STATE.md was still at session 111 and the tree was clean. Worth knowing
because the same naming convention will recur.

---

## Step 2: the oil trigger gap — ANSWERED, and the brief's hypothesis is FALSE

Measured off session 110's own live logs (`logs/fishing-2026-08-30-02-19-04`,
`-02-19-54`, `-15-03-56`, `-15-07-41`), NOT off a replay. The `oil_shadow`
event already records `onDemandTriggers`' verdict on every live turn
(`oilShadow.ts` `liveWanted`), so this is a direct read of what the live loop
saw, with no estimator in the loop.

**22 casts, 96 oil-decision turns, 14 caught / 8 escaped = 63.6% catch rate**
(inside the user's stated 60-70% ideal target).

### The counts
- on-demand RELAXING wanted (`0 < fishHp <= 2`): **1 of 96 turns**
- on-demand FOCUS wanted (`focusRemaining <= 0`): **32 of 96 turns**
- turns wanting nothing: 63
- double-lethal fired: **7 firings = 14 oils** (all 14 oils spent this batch)
- `oil_trigger_policy_withdrawn`: **32, every one of them `focus`**

### Which explanation it is — it is NEITHER of the brief's two
The brief offered (a) the condition never arose, or (b) double-lethal
intercepted it. The answer is a THIRD thing, and it splits by arm.

**FOCUS arm — fired 32 times and was withdrawn 32/32 by CONFIG, not by any
trigger.** `config/bot.json`'s `dendren.oils.allowedItemIds` is `[937]`
(Relaxing only). Focus Oil 942 is not a spendable item on this account, so
every one of the 32 firings was withdrawn at the `allowedItemIds` filter.
No waste; the arm is unreachable by configuration.

**RELAXING arm — the condition AROSE ONCE and was suppressed by the NECESSITY
GATE, not by the override.** The single turn:
```
turn 2, fishHp 1, relaxing held 19, exercisable true
liveWanted ["relaxing"] -> wouldSkip ["relaxing"]
bestKillProbability 0.9912882658784465
```
`meetsThreshold(0.9913, 0.85)` is true, so `conservingTriggers` removed it.
That is QUESTIONS §43's user-approved behaviour working exactly as approved
("if the autofisher believes it can catch the fish without oil, don't use the
oil") — a SAVING, not a bug and not waste.

⚠ **At the OLD threshold of 1 this oil WOULD have been spent** (0.9913 < 1).
So this is the first recorded live instance of session 98 §A's 0.85 threshold
actually biting. STATE/§40's "measured no-op" was true at 1 and is now
falsified at 0.85, on the live path, n=1.

### Double-lethal did NOT intercept on-demand — three independent proofs
1. **Structural.** `doubleLethalOver` returns `base` unchanged when
   `base.includes("relaxing")` OR `fishHp <= e.fishDamage`. The two arms act on
   disjoint `fishHp` bands ((0,2] vs (2,4]) and the band can only ever ADD to a
   base that had no relaxing. Already pinned by
   `tests/fishing/oilNecessityComposition.test.ts`.
2. **Empirical, same-turn.** The one relaxing trigger was at `fishHp 1` — never
   in the band. No turn had both.
3. **The suppressor is identified** and it is the necessity gate (above).

### BUT there IS a real interception, and it is TEMPORAL, not same-turn
This is the part neither the brief nor STATE.md had, and it is the actual
reason "on-demand never fires":

`fishHp` at decision, histogram: **1:1, 2:0, 3:4, 4:5**, then 5+.

The override fires at `fishHp` 3-4 and its two oils deal 4 damage — a certain
kill. **So the fish is destroyed at 3-4 HP and never descends into the 1-2 HP
band where on-demand lives.** 7 of the 9 band turns fired. The override does
not steal on-demand's decision point; it consumes the TRAJECTORY upstream in
HP space, so on-demand's band is almost never reached.

The 2 band turns that did NOT fire were held by the band's own
`bestKillProbability >= 0.85` check — 4 oils saved there.

### Waste check — the user's actual question
- **14 of 14 oils spent came from the double-lethal override.** Zero came from
  the rule-4-approved on-demand policy.
- **No oil was spent that the approved policy asked for.** The one moment it
  asked for was correctly skipped as unnecessary (99.1% kill already).
- **No focus oil was wasted** — none is spendable.
- `handoff/OIL-DOUBLE-LETHAL.md` prices the override at **140.9 marginal oils
  per extra fish against an exchange-rate bar of ~12**, i.e. ~12x above bar.
  That figure is unchanged and is the sim's standing verdict.

⚠ **Honest limit, `oilShadow.ts`'s standing caveat.** "on-demand alone would
have spent 0 oils" is true ON THESE TRAJECTORIES, and these trajectories are
override-shaped: with the override off, those 7 fish would not have died at
3-4 HP and some would have descended into on-demand's band. The
counterfactual branch is gone. Do not quote 0 as on-demand's standalone spend.

### The finding to REPORT, not ship
**The approved on-demand policy is effectively unreachable in today's
configuration**, for two independent reasons neither of which is a bug:
its focus arm is 100% withdrawn by `allowedItemIds`, and its relaxing arm is
starved of states by the override killing fish one band above it. The policy
the user approved is not the policy spending their oils.
Changing either is a USER decision (rule 4 / §30). NOT shipped this session.

## Step 3.2: the fishing guard over-count — ROOT CAUSE FOUND, FIXED

**Not the day-key straddle re-surfacing.** The straddle (session 111) was about
WHEN a counter is stamped. This is about WHAT value is stamped.

`GuardState.recordServerCapReached()` was
`this.runsStarted = Math.max(this.runsStarted, this.budget.maxRunsPerSession)`.
It encoded a BOOLEAN ("the server says we are done today") by writing a POLICY
CONSTANT into a counter whose persisted meaning is "how many casts the GAME has
counted today" — the quantity `fishingLedgerReconcile.ts` reconciles against
`dayDocs`. Two measurement systems, one field.

Session 107: 22 played, 20 charged, reconciler trace ended *agreed at 20*, file
said **25** because `dendren.maxCastsPerSession` is 25. The "over-count by 5"
was the gap between a config knob and a server ledger, not a miscount.

**Failure direction: SAFE.** An inflated count can only refuse casts, never
authorize one. And on the fishing path the sentinel was not even protective —
`reconcileFishingLedger` runs before the next batch and `adoptServerRunCount` is
deliberately non-monotonic, so it lowered the forged 25 straight back to 20.
**The sentinel bought nothing live and cost the accuracy of every surface that
reads the file WITHOUT reconciling** (`--status`, `checkFishingCaps`).

⚠ **The forged value had been ASSERTED AS CORRECT in a test since session 29.**
`tests/liveFishing.test.ts` read `expect(deps.guards.runCount).toBe(20)` with
the comment "marked exhausted for the rest of the persisted day" — in a test
where **no cast is played and the true count is 0**. The 20 was
`maxRunsPerSession`. The test did not catch the bug because it encoded it.
`tests/liveRun.test.ts` had the same shape at `maxRunsPerSession`.

**Fix:** exhaustion is its own flag — `GuardState.serverCapReached` (+
`capReachedByServer` getter, seeded from `GuardSeed`), persisted as an OPTIONAL
`serverCapReached` boolean, reported on its own line by `--status` and
`checkFishingCaps`. `assertCanStartRun` checks the flag FIRST, so the protection
is identical.

Two things that would have been silent bugs:
- **`isBudgetGuardTrip` had to learn the new reason.** The old path surfaced as
  `"session run cap reached"`, already in `BUDGET_GUARD_REASONS`. A new reason
  string not added there would turn a designed daily stop into an anomaly and
  take the whole orchestrator down over one exhausted mode — the exact failure
  session 29 added the classifier to prevent.
- **The flag must NOT cross the 11:00 PT rollover.** `capReachedByServer` is
  cumulative in memory (same property session 111 left unfixed for the
  counters), so after a rollover a `true` is ambiguous. `DAY_MEMO` now carries
  `rolledOverInProcess` and suppresses the write for the rest of the process.
  Cost: one extra real rejection in the rare straddle-then-capped-again case.
  Same trade session 111 took.

## Step 4: the Tier-2 run RAN — and the ring cost is NOT what rule 11 says

One authorized run, explicit user go-ahead this session. Reached **room 13**,
108 actions, **0 first-attempt failures**, energy 78 → 20 (committed 60,
observed 58 — passive regen, expected). `dayProgressEntities` **0 → 3** of 12.
`start_run` body confirmed correct: `index: 2, isJuiced: true,
consumables: [131,131,131]`. Run id 25215982, faction day **20695**.

### The brief's gate is UNMEETABLE AS WORDED — the field does not exist

The gate was "confirm the seven negative `gameItemBalanceChanges` on
`start_run` match `inputItems`/`inputAmounts`". **`start_run`'s response has no
`gameItemBalanceChanges` field at all.** Its keys are
`success, actionToken, message, data{run, events, entity}`; `data.events` is
`[{"type":"dungeon_started","data":{"dungeonId":25215982}}]`.

Across the ENTIRE run log, `gameItemBalanceChanges` mentions only **845
(+6768)** and **846 (+1179)**. **No ring id ever appears.** The ring debit is
not reported on the wire at any point.

### ⚠⚠ THE COST IS ONE FACTION × 3, NOT ONE OF EACH OF SEVEN

Balances read live immediately before and after, twice after (stable, not lag):

```
id   faction            before   after   delta
134  Chobo Silver         39       39      0
135  Crusader Silver      39       39      0
136  Overseer Silver      45       45      0
137  Athena Silver        30       30      0
138  Archon Silver        30       30      0
139  Foxglove Silver      57       54     -3   <-- the only one that moved
140  Summoner Silver      54       54      0
                        total 294 -> 291   -3
```

**Six of the seven factions were not charged at all.** CLAUDE.md rule 11 and
`scripts/checkEntryTiers.ts` both state one of EACH per run, and both derive
the runway from that. Rule 11's own text says the runway is 30 runs bound by
the scarcest faction. **That arithmetic is wrong**, and it is wrong in the
direction that UNDERSTATES the runway by a lot.

**The leading reading, and it is a hypothesis at n=1, not a measurement.**
`entryData` carries `inputsBasedOnFactionDay: true`. So the seven-id
`inputItems` list is plausibly the SUPERSET across faction-days, with exactly
ONE faction actually charged on any given day — today (day 20695) Foxglove.
The **3** is unexplained but matches the juiced run-unit multiplier exactly
(`JUICED_COST_MULTIPLIER` 3, and `dayProgressEntities` moved 3).

**Two readings the next run must separate**, and it takes a run on a DIFFERENT
faction day to do it:
- 3 = juiced multiplier → an unjuiced Tier-2 entry would cost 1.
- 3 = flat per-entry amount for the active faction, multiplier-independent.

Do NOT rewrite the runway number until a second run on a different day says
which faction is charged then. What is certain today: **the cost is not one of
each of seven, and no ring debit appears on the wire.**

### Hard Core payout: 6768, and it is NOT comparable to session 103

One Tier-2 run to room 13 paid **6768** Hard Core (item 845) and 1179 Dendren
Root (846). Session 103's four Tier-3 runs paid 30,960 (7,740/run). **These are
not comparable** — different tier, different depth, different room count. This
is STATE.md open question 3 in live form; the number is recorded, no ratio is
claimed from it.

---

## 5. The corpus updates the Tier-2 run forced

The run reached room 13 and the suite went red on five census pins. All five
were re-derived from the fixtures, never guessed.

- **`ROOM_ENEMIES` +2** — room 12 (enemy 74, RISKY_TIER) and room 13 (enemy 75,
  DANGEROUS_TIER), both first-ever captures.

  ```
  Enemy Room 74  hp 62/62  armor 28/28  rock 20/10  paper 24/8   scissor 18/10
                 rolled evasion 4, block 2, lck 2, tenacity 2   buff `warden`
  Enemy Room 75  hp 65/65  armor 35/35  rock 25/10  paper 20/12  scissor 22/13
                 rolled evasion 8, block 8, lck 7, tenacity 3   buff `vampiric`
  ```

  Both buffs are `kind: "mechanic"` in `src/sim/enemyBuffs.ts` (warden applies
  1 Vulnerable on Shield wins; vampiric heals 4 HP on Sword wins) and modify no
  hp/armor/move number, so the stats above are the enemies' unmodified base and
  `ENEMY_BUFF` is deliberately absent from `unmodelled` — the same reasoning
  room 11's entry records for `withering`. `ROLLED_STATS` is the blocker on
  both.

  Enemy 75's rolled stats are the **heaviest ever recorded**, roughly double
  room 11's. That is the shape rule 8 predicts: highest-tier selection at every
  room means the deepest captures arrive with the largest rolled stats, so
  coverage falls fastest exactly where new depth is gained.

- **`VulnerableTenacity` modelled `latent`.** First-ever pickup, room 12,
  `state-211 → state-212`, `selectedVal1` 4, Rare, TokenId 118, taken by BOON
  PRIORITY 5 over ranked `AddIntuition`. Session 89's strict whole-object diff:
  the ONLY difference in `players[0]` is the boon's own `pickedBoons` append;
  `players[1]` byte-identical.

  **No user directive needed**, unlike `LossBlockUp` — six Vulnerable-family
  members are already modelled latent, so this follows the `AddLifestealSword`
  family precedent (session 109). `UNMODELLED_TYPES` 14 → 13.

- **`OBSERVED_OFFERS` +12 rows**, first-ever room-11 and room-12 offers. Depth
  invariant re-checked rather than assumed: died in room 13, deepest offer is
  room 12.
- **Loadout census +3** — 58/25, 58/33, 72/33, all mid-run boon maxima.
  **Starting loadout UNCHANGED at 50/17**, so the session-104 user directive's
  "a new combo is a signal to chase" is NOT triggered. 72 hpMax is the highest
  ever; 33 armorMax sits below session 103's 40.
- **`roomOne` 261 → 264** (+3 = one run × 3 room-1 options, the smallest
  possible increment and the first datum for per-run scaling at a Tier-2
  entry). **`healRooms` +2** (rooms 2 and 9, both `Heal(50)`, neither picked).

---

## 6. Verification

```
npx tsc --noEmit                  clean
npx vitest run --maxWorkers=4     Test Files 114 passed (114)
                                  Tests      2226 passed (2226)
git diff --check                  clean
npx vitest run tests/discoveredShipsClean.test.ts   8 passed
```

⚠ **The suite must be run UNSANDBOXED.** `tests/profile.test.ts` shells out to
git to check ignore rules and fails falsely under the sandbox; a first red run
this session was entirely that. `~/.gitconfig` is also unreadable sandboxed, so
plain `git log` fails too.

Secret scan, quoting the instrument verbatim:

```
> secret scan — scope: tracked
  files scanned:        9121
  CONTROL A (read):     8759 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
      jwt                 0 unexplained   (1 allowlisted)
      addressBare         0 unexplained
      addressLabelled     0 unexplained   (2 allowlisted)
      noobTokenJson       0 unexplained   (1 allowlisted)
      noobIdProse         0 unexplained   (4 allowlisted)
      usernameQuoted      0 unexplained   (6 allowlisted)
      privateKeyPem       0 unexplained
      privateKeyHex       0 unexplained
> PASS — no unexplained hits, both controls healthy.
```

At `--scope=diff --ref=5e815aa2`: **246 files scanned, 0 unexplained**, control
A 231. The recap's four literal patterns over the session's added lines all
returned **0**: `0x[a-fA-F0-9]{4,}`, `noobId\s*\d+`, `eyJ`, `PRIVATE`. The 222
new fixture states redacted clean by `writeRedactedCorpus`.

`.gitignore` verified on all seven required paths (`.env`, `*.key`, `data/`,
`logs/`, `profiles/`, `fixtures/**/raw/`, `fixtures/**/*.har`).
`config/discovered.json` deliberately NOT ignored, per session 60 — checked via
the TEST, not a grep.

---

## 7. Surprises, for the next brief

1. **The Tier-2 ring cost was wrong in every document, and the tell was in the
   data all along.** `inputsBasedOnFactionDay: true` sat beside the seven-id
   list for two sessions. Nobody read it as "the list is the superset, not the
   bill." **The single most valuable next live measurement is one Tier-2 run on
   a DIFFERENT faction day** — it separates "3 = juiced multiplier" from "3 =
   flat per-entry" and shows whether the charged faction rotates.
2. **A test had encoded the guard bug as correct since session 29.**
   `expect(deps.guards.runCount).toBe(20)` in a test where no cast is played
   and the true count is 0 — the 20 was `maxRunsPerSession`. General lesson: an
   assertion whose expected value is a CONFIG CONSTANT cannot distinguish "the
   code is right" from "the code writes the constant".
3. **The brief's premises were wrong twice, both caught by CLAUDE.md rule 9.**
   "Card 84 has no on-grid footprint" (it has `hitZones [7,8,9]`) and "§13 is
   ordinary feature work, no live spend required" (§13 is parked on a data
   floor by its own text).
4. **The approved oil policy is unreachable and nobody had noticed**, because
   each half has an innocent explanation and the two were never looked at
   together.
5. **The double-lethal override's real effect is temporal, not procedural.** It
   does not steal on-demand's decision point; it kills the fish one HP band
   above where on-demand lives. Any future analysis of "why doesn't trigger X
   fire" should check whether something upstream is consuming the trajectory.
