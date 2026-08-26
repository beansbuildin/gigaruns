# session 101 — 2026-08-26 — §A events coverage, §B proc effect sizes, §D status mechanics, §C blocked

**Result: GATE PASS.** §A done, §B done, §C blocked on the ledger exactly as
the brief anticipated, plus **§D — a section the USER chose mid-session** when
offered the choice between idling ~60 minutes for the 11:00 PT reset and
measuring the statuses instead.

Suite 2023/2023 across 111 files (`--maxWorkers=4`). `tsc --noEmit` clean.
`git diff --check` clean. Secret scan 0 hits on all four patterns.
`discoveredShipsClean` 8/8.

**Live spend: ZERO.** Two ledger reads and one `--dry-run`. No casts, no runs,
no energy, no oils, no fixtures written. All three completed sections were
offline against the committed corpus.

---

## §A — is the capture path dropping `data.events`?

Session 100's open question 3: `data.events` present on only 2093 of 5308
canonical states. Either expected, or evidence already lost.

**The classifier needed no new capture.** `scripts/liveRun.ts:1191` writes the
loop's `GET /game/dungeon/state` read before every POST, and
`client.getDungeonState`'s own comment records that the GET reports
`actionToken: 0` regardless of run state. So `actionToken === 0` separates
reads from responses on data already on disk.

```
  GET-read  (actionToken == 0)    events=False   2687
  POST-resp (actionToken != 0)    events=False    528
  POST-resp (actionToken != 0)    events=True    2093
```

**2687 of 2687 reads lack events, zero exceptions.** A read caused nothing, so
it reports nothing. The 528 POST responses without events split by phase:

```
  phase=enemyPath  events=False    265      the offer — no exchange
  phase=combat     events=False    263      ← the suspicious set
  phase=combat     events=True    1756
  phase=rewardPath events=True     267      the killing blow
  phase=over       events=True      70      the player's death
```

The 263 are the response to a path SELECTION, which returns the NEXT room's
opening state. Every one has the foe at `health.current === health.currentMax`
with `lastMove === ""` while the player's `lastMove` is set — a fresh enemy
that has not acted. **263 of 263, zero exceptions.**

A worked example, `run-2026-08-15-01-53-36`:

```
state-008 tok=1786758834855 enemyPathPhase=True  events=False foeHP=0    ← offer
state-009 tok=0             enemyPathPhase=True  events=False foeHP=0    ← GET read
state-010 tok=1786758840753 enemyPathPhase=False events=False foeHP=35   ← selection resp
state-012 tok=1786758843169                      events=[use_move x2, OnApplyShield,
                                                          OnDamage x2, OnUpdateStatus x2]
```

**The arithmetic closes exactly**, which is what makes this a partition rather
than a plausible story:

```
  2687 GET + 265 enemyPath + 263 selection + 66 dungeon_started
     + 108 use_item + 1919 exchanges  =  5308     ✓
  1919 exchanges x 2 use_move rows    =  3838     ✓ (procEvidence.ts's count)
  2093 with events = 1919 + 108 + 66              ✓
```

Event-carrying responses by `use_move` count: `use_move=2` → 1919,
`use_move=0` → 174, of which 108 are `['use_item','OnHeal']` and 66 are
`['dungeon_started']`. Nothing else exists.

**Decisive statement: every POST response in which an exchange resolved — foe
`lastMove` non-empty — carries `data.events`. 1919 of 1919.**

Date distribution, to rule out a regression that crept in:

```
 date        POST-resp with events   without   %without
 2026-08-14         26                   1       3.7%
 2026-08-15        229                  48      17.3%
 2026-08-17        418                  99      19.1%
 2026-08-20        289                  90      23.7%
 2026-08-24        188                  50      21.0%
 2026-08-26        183                  46      20.1%
```

Flat. Structural, not a regression. **§57's `n = 1919` stands uncorrected.**

---

## §B — what the procs DO

### The instrument

`OnDamage` rows in the same `data.events[]`:

```json
{"type":"OnDamage","value":10,"playerId":0,
 "data":{"ignoreShield":false,"prevent":0,"source":""}}
```

Two properties, both **verified rather than assumed**:

- **`playerId` names the VICTIM, not the dealer.** Checked against a state diff
  (`run-2026-08-15-01-53-36/state-012`): player 0 entered with 0 shield, the
  events show `OnApplyShield 12` then `OnDamage 10` both at `playerId: 0`, and
  the response reports shield 2. `0 + 12 - 10 = 2`.
- **`data.source` separates combat (`""`, 2591) from burn (`"burn"`, 522).**

**`data.prevent` is NOT the block instrument.** The name invites it; it is 0 on
all 2591 combat rows, including all 76 blocked ones:

```
  victim=0: (blockProc0, prevent>0) -> {(False,False): 1259, (True,False): 57}
  victim=1: (blockProc1, prevent>0) -> {(False,False): 1256, (True,False): 19}
```

Full event-type census across the corpus:

```
  4196  OnUpdateStatus     data keys: {status: 358}
  3838  use_move           {blockProc0/1, evadeProc0/1, critProc0/1,
                            intuitionProc0, tenacityProc0/1} — 1919 each
  3113  OnDamage           {ignoreShield, prevent, source}
  2078  OnApplyShield      {}
   341  OnDeath            {}
   197  OnHeal             {}
   108  use_item           {}
    70  OnDropJuice        {prevent}
    66  dungeon_started    {dungeonId}
     6  intuition_block    {blockedMove}
```

Note there is **no `intuitionProc1`** — the enemy's `intuition` is 0 in all
5308 states, matching session 100's finding.

### The null

`src/sim/combat.ts` resolves by RPS: winner deals its move's ATK, tie has both
deal, loser deals nothing. So the baseline prediction for damage taken is the
attacker's `currentATK` for the move it played, read off the preceding state.

**2211 / 2285 (96.8%) exact on no-proc exchanges.**

### Results

```
  flag          predicts       status-clean          all      control (stat>0, unfired)
  blockProc0    floor(ATK/2)   33/33  [90-100%]    53/56              0/1041
  blockProc1    floor(ATK/2)    8/8   [68-100%]    19/19               0/619
  evadeProc0    0               2/2   [34-100%]      4/4               0/149
  evadeProc1    0               9/9   [70-100%]    22/22               0/605
  critProc0     2*ATK           9/9   [70-100%]    13/14               0/558
  critProc1     2*ATK          11/11  [74-100%]    16/17               0/605
```

- **`block` — `floor(ATK/2)`.** Partial reduction, **never** a negate: of 76
  fired exchanges, **0 took zero damage**. Odd ATK rounds down (ATK 15 → 7),
  so it is floor and not a rounded half. Raw pairs: (12,6) x16, (16,8) x11,
  (14,7) x9, (10,5) x8, (8,4) x7, (15,7) x4, (26,13) x4.
- **`evasion` — FULL negate.** 26 of 26 took exactly 0. Status-robust, since 0
  is 0 whatever else modifies damage. Matched control: **0 of 765** unfired
  exchanges with `evasion > 0` took 0.
- **`lck` — crit, exactly `2 x ATK`.** 29 of 32 fired exchanges landed on
  exactly 2.00x.
- **`tenacity` — NOT damage.** Matched on `tenacity > 0`, damage tracks the
  null. What moves is `OnHeal`: 11.8% [3.3-34.3%] fired vs 1.6% [0.9-2.9%]
  unfired (player), 21.1% [8.5-43.3%] vs 5.2% [3.9-6.7%] (enemy). Both pairs
  non-overlapping, so the association is real — but it rests on **6 heals
  total** and the amounts (2; 4, 6, 8) cannot be bounded. Association, not
  mechanic.
- **`intuition` — NOT damage.** All 6 fires carry an `intuition_block` event
  with a `blockedMove`, and 5 of 5 non-blocked fires took the attacker's FULL
  ATK. The sixth looked mitigated and was not — it also carried `blockProc0`
  and took exactly `floor(ATK/2)`:

```
  run-2026-08-25-03-25-26/state-034:
    playerId 0  rock  {blockProc0: True, intuitionProc0: True, ...}
    → taken 5, enemy ATK 10.   floor(10/2) = 5.   That is block.
```

  In **2 of 6**, `blockedMove` names a move DIFFERENT from the one the enemy
  actually played, which points at move denial. n=6; not enough to say more.

**The control column is the claim.** Across 3577 matched exchanges the rule
matched zero times. The intervals are wide and reported wide — `evadeProc0`'s
status-clean sample is 2, and 2/2 is not 100%.

### The composition rule, found by accident

`run-2026-08-23-05-53-49/state-108`: `critProc1` and `blockProc0` both fired,
attacker ATK 14, damage dealt **14**. Crit doubles, block halves, and they
compose multiplicatively — `2 x 0.5 = 1.0`. **n=1**, so it is a mechanism with
an explanation, not a measured rule. Recorded because it also explains an
outlier that would otherwise read as noise.

### The residual, which became §D

Every one of the 74 no-proc exchanges the null missed, and every one of the 6
proc exchanges that missed its rule, carried a **non-empty `statusEffects`
array** on one side. Restricted to status-clean exchanges the rules hold
**72 / 72**.

---

## §D — the statuses (chosen by the user over waiting for the reset)

At 10:14 PT, with ~45 minutes to the reset, the user was offered three options
(hold and run §C at 11:00 / recap now / measure the statuses) and chose the
statuses, on the reasoning that §B had just shown they were the entire error
term and `Burn` alone already had 522 rows on disk.

**They were never uncaptured.** CAPTURE-1 has listed `Weak`, `Vulnerable`,
`Burn`, `Regen` and lifesteal as needing capture since it was written. They are
on every player object in the corpus.

**Fourth instance of the same failure**: s70 (`/gear/items` vs
`/offchain/static`), s99 (fishing doc vs `/gear/instances`), s100
(`run.players[]` vs `data.events[]`), now this.

### The census — six, not four

```
  type            occurrences   amount distribution
  Burn                 1388     {4: 637, 2: 248, 6: 205, 8: 122, ...}
  Weak                  477     {0: 320, 1: 112, 2: 37, 3: 8}
  Vulnerable            427     {0: 230, 1: 145, 2: 28, 3: 14, 4: 10}
  SecondWind            223     {0: 135, 10: 74, 5: 14}
  Regen                 176     {8: 24, 4: 24, 6: 23, 7: 22, ...}
  Steadfast              65     {0: 35, 2: 30}
```

Every entry is `{type, amount}` — no other keys, 2756 occurrences.

**`SecondWind` and `Steadfast` are not in CAPTURE-1's list. `lifesteal` is in
it and does not exist.**

### `amount` means three different things

| type | what `amount` is |
|---|---|
| `Burn` | magnitude — the tick equals it exactly |
| `Regen` | magnitude, spent down — heals its value, then decrements by 1 |
| `SecondWind` | magnitude, stored — heals its value ONCE, then sits at 0 |
| `Weak` / `Vulnerable` | **not magnitude** — a countdown; the multiplier is fixed |

And **`amount: 0` is INERT**, not present-and-cleared:

```
  Weak        on attacker amount==0  n=  59  mean ratio = 1.000   top=[(1.0, 59)]
  Weak        on attacker amount>0   n=  33  mean ratio = 0.721
  Weak        on attacker absent     n=1958  mean ratio = 1.000   top=[(1.0, 1958)]

  Vulnerable  on victim   amount==0  n=  37  mean ratio = 1.000
  Vulnerable  on victim   amount>0   n=  34  mean ratio = 1.234
  Vulnerable  on victim   absent     n=1958  mean ratio = 1.000
```

Amount 0 is **indistinguishable from absent**. Zero is the single most common
value on four of the six types, so a PRESENCE check is wrong on the majority
of occurrences. `tests/statusEffects.test.ts` pins this specifically.

### The rules

```
  Burn        tick === AFTER-state amount               522/522   100%
  Weak        damage dealt === floor(ATK * 0.75)          33/33   by amount: 1: 30/30, 2: 3/3
  Vulnerable  damage taken === floor(ATK * 1.25)          34/34   by amount: 1: 26/26, 2: 5/5,
                                                                            3: 1/1, 4: 2/2
  Regen       heals its amount if the unit survived       53/53   100%
              then decays by 1, same exchange             60/60   100%
  SecondWind  when spent, heals exactly its amount        10/10   100%
              while held, does nothing                    28/28   100%
  Steadfast   no damage effect, either role               UNDETERMINED (n=23)
```

The multiplier is **independent of amount** for both `Weak` and `Vulnerable` —
amounts 1, 2, 3 and 4 all give the same result, which is what establishes that
the field is a countdown there and not a magnitude.

### Three things that came from checking residuals

**1. `Burn` matches the AFTER amount, not the before.**

```
  tick == before_st Burn amount:  303/522
    mismatches: (None,4) x91, (None,6) x36, (None,2) x34,   ← applied this exchange
                (4,8) x25, (6,12) x8                        ← stacking, doubles
  tick == after_st  Burn amount:  522/522     ← exact
```

**The order is apply, then tick.** Measured the wrong way it looks like a
303/522 rule with two exception families.

**2. `Regen` does not heal a unit that DIED, though its counter still decays.**
The 7 apparent exceptions, all lethal:

```
  run-2026-08-18-19-50-14/state-069 side1: Regen 4→3 heal=None hp=23/40 incoming=28
  run-2026-08-20-01-38-22/state-094 side1: Regen 5→4 heal=None hp=28/52 incoming=42
  run-2026-08-22-04-12-49/state-022 side1: Regen 4→3 heal=None hp=13/35 incoming=21
  run-2026-08-22-04-27-03/state-088 side1: Regen 3→2 heal=None hp=23/48 incoming=37
  run-2026-08-24-00-14-01/state-094 side1: Regen 2→1 heal=None hp=17/48 incoming=18
  run-2026-08-25-03-07-57/state-106 side1: Regen 5→4 heal=None hp=20/50 incoming=29
  run-2026-08-25-03-30-48/state-110 side0: Regen 1→0 heal=None hp= 1/40 incoming=14
```

`incoming >= hp` in all seven. Excluding them: **53/60 → 53/53.**

**3. `Burn` never decays on its own** (0 of 522 decremented; it holds then
clears outright), while `Weak` and `Vulnerable` DO, within the exchange
(1 → 0, 38 and 46 times). An earlier cross-exchange test appeared to show no
status decaying — it was comparing `after_st` of exchange k against
`before_st` of exchange k+1, which is **the same instant**. Discarded.

### `lifesteal` does not exist

22 heals are explained by no status and no proc. A real lifesteal would sit at
a constant fraction of damage dealt:

```
  heal=4 dealt=14 ratio=0.286     heal=2 dealt= 6 ratio=0.333
  heal=4 dealt= 5 ratio=0.800     heal=2 dealt=10 ratio=0.200
  heal=4 dealt=20 ratio=0.200     heal=2 dealt= 0 ratio=n/a
```

Ratios 0.20-0.80, and one heals 2 having dealt 0. What they actually are is
**constant within a run** — one value per run per side, always 2 or 4, the
enemy side always 4:

```
  run-2026-08-22-03-51-44 side0: {2: 3}     run-2026-08-23-05-45-51 side0: {2: 6}
  run-2026-08-26-03-08-08 side1: {4: 2}     run-2026-08-26-03-46-50 side0: {4: 2}
```

A flat per-exchange effect from a boon or enemy trait. **lifesteal is ruled
OUT** and comes off CAPTURE-1's list.

### What stayed open

- **`SecondWind`'s trigger.** Magnitude exact, trigger not determined — it is
  **not** lethality and **not** a fixed HP threshold:

```
  FIRED:  hp 40/40 incoming 10   |  held: hp 40/40 incoming 14
  FIRED:  hp 14/40 incoming 30   |  held: hp 14/40 incoming 10
```

  n=10 fires. Fitting a rule to that would be inventing one.
- **`Steadfast`.** No damage effect (10/10 and 6/6 at exactly 1.00x). Debuff
  immunity is *consistent* — 0 of 11 gained a `Weak`/`Vulnerable` while
  `Steadfast > 0`, against 103 of 3815 when absent — but at n=11 the expected
  count under NO effect is ~0.3. **Underpowered; proves nothing.**

---

## §C — the 20-cast batch: BLOCKED, as anticipated

Per CLAUDE.md rule 12, exercised rather than reasoned about. At 09:54 PT:

```
  guard day (11:00 PT rollover): 2026-08-25   [file records: 2026-08-25]
  hours until next reset:        1.1
  GAME ledger  (dayDocs pond 2):  20 / 20
  REPO ledger:                    20 casts, 252 energy
  ledgers agree at 20 cast(s) spent today.
  VERDICT: BLOCKED — cap spent. Next window opens at 11:00 PT (1.1h).
```

`--dry-run` confirms the batch is staged and the guards work:

```
  · resuming today's fishing budget: 252 energy / 20 casts already spent
  · nextPosition override: ARMED (no miss on record).
  · rod durability: rod 812 reads DURABILITY_CID 38 (slot 14, GearInstance#812_...).
  ✗ Guard tripped: session run cap reached {"attemptedRun":21,"cap":20}
```

**Durability reads 38, identical to session 100's preflight** — independent
confirmation that zero casts have been spent since. The durability bracket is
still `40 → 38 over 2 casts = 1.0/cast, n=1`, unchanged and still not promoted
to a rate.

---

## Process notes

- **The sandbox breaks `tsx`** (`EPERM listen /tmp/claude-501/tsx-501/*.pipe`).
  Every `npx tsx` and `git` invocation this session needed
  `dangerouslyDisableSandbox`. Matches the standing memory note.
- **A bounded-slice test must not put a floor on a per-flag denominator.**
  `tests/procEffectSize.test.ts` initially asserted `controlN > 20` per flag
  and failed on `evadeProc0` at 14 — `evasion` is 0 on the player side for most
  of a run. That is CLAUDE.md rule 6 (a gate on something the slice does not
  control). Fixed by asserting the denominator in aggregate across the six.
- **`tests/noHardcodedPaths.test.ts` ratchet 26 → 27** for
  `scripts/procEffectSize.ts`, on the same terms session 100 used for
  `procEvidence.ts`: it names the COMMITTED CORPUS, which is a fact about what
  was recorded and not something a `--profile` run should redirect, and it
  takes `runsRoot` as a parameter with that default. `statusEffects.ts` did not
  need a raise — it delegates to `loadExchanges`.
