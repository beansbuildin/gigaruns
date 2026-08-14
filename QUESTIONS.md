# QUESTIONS

Open items needing a human. Task 4's gate has passed and is committed; none of
these block it.

---

## 7. JWT rejected — blocks all of Task 6 [session 08, TOP OF SESSION]

`~/.secrets/gigaverse-jwt.txt` exists (1729 chars) but the server rejects it.

```
$ npm run check-auth
▸ real JWT
  jwt eyJhbGci...(1728 chars)
✗ Auth rejected (HTTP 401). The JWT is expired or invalid — refresh it.
```

Confirmed independently with a raw request, same result:

```
$ curl https://gigaverse.io/api/user/me -H "Authorization: Bearer <jwt>"
{"error":"Unauthorized"}
```

This is exactly CLAUDE.md's "missing private key/JWT" blocking condition — a
rejected token is functionally the same as no token for everything Task 6
needs, since even the stage-1 dry run reads live state. Per CLAUDE.md ("When
you get stuck"), not idling on this: `scripts/liveRun.ts` is being built and
unit-tested against a mocked client (same pattern as
`tests/api/client.test.ts`) so all four stages are ready to run the moment a
fresh JWT lands, and the corpus-only `intuition` field-frequency check
(session-08 brief addendum §7) doesn't need network access either.

**What's needed:** log into gigaverse.io in a browser, DevTools → Network,
copy the current `Authorization: Bearer <token>` value, overwrite
`~/.secrets/gigaverse-jwt.txt` with it (no trailing newline needed — the
loader trims). Then `npm run check-auth` should pass again and Task 6 stage 1
can run for real.

## 0. CAPTURE RUN — do this first [session 06]

One supervised Forbidden Woods run, ~20 energy. `scripts/watch.ts` is read-only
and records every state automatically — you just play. Everything below is a
thing to *do while playing*; nothing needs writing down.

**Setup**

```bash
npx tsx scripts/watch.ts 2700
```

Leave it running. Start a Forbidden Woods run in the browser when it says
`polling — no active run yet`.

**While you play — in priority order**

- [ ] **Pick the "Safe" tier at every enemy-path screen.** [added run 2 —
      this is now the top item] The run-1 capture showed all three tiers share
      an identical `lootTable`, while Safe alone has `rolledEnemyStats` all zero
      and `enemyBuff: null`. Higher tiers are pure added risk with no loot
      upside — and a Safe enemy is one the sim can actually score.
- [ ] **Room 1 boon: take `AddMaxArmor` (or any `AddMax…`, or `Heal`) if it is
      offered.** [changed run 3 — this replaces the earlier "take AddEvasion or
      AddLuck"] It is very likely the first *clean* room-1 boon, which is the
      one thing that would let the sim score past room 1. See §5b.
      If none of those is offered, then take `AddEvasion` or `AddLuck` — a
      rolled stat carried all run is the second-best thing to capture.
- [ ] **Play long.** The rolled stat needs ~30 exchanges where you actually
      *take damage* to be readable. Grinding an enemy down is worth more to us
      than a fast clean kill.
- [ ] **At enemy 65 (room 3): win with Sword while its armor is FULL.**
      Several times if you can. This is the single highest-value capture in the
      session. Enemy 65 once took 8 from a 16-damage Sword win and 16 from the
      same hit elsewhere; full armor is the one thing that differed. If its
      armor is already chipped, let it rebuild (it regenerates when it wins or
      ties) and then Sword it.
- [ ] **Free if it comes up: kill an enemy with a TIE, not a win.** Mirror its
      move on the killing blow, while you still have armor. Don't chase this —
      ties can't be forced. If it happens, that's one confound resolved.
- [ ] **Pause a beat at every boon and enemy-tier screen** so the 2.5s poll
      catches it. We need the full offer triple, including the two you don't
      take, and all three tiers' loot tables.

**One free check, no energy, any time**

- [ ] Play one move until its charge counter reads `-1`, then try to click it.
      Does the client let you select it? (See §1 — this settles `chargesAreHardLimit`
      outright, and it's currently the biggest claimed edge in the EV engine.)

**When you're done**, ctrl-c the watcher. It prints where it wrote.

---

## 1. Can a move at ≤ 0 charges actually be played? — one click settles it

**Status 2026-08-15: no longer blocking, but still unproven.** The flag
`chargesAreHardLimit` now defaults to `true` (prune) on the strength of the
enemy-only recount — 11 clean opportunities where the enemy held a move at ≤0,
0 taken, `p ≈ 0.012` under the soft-cost null. See SPEC §4 charges. The player's
own 12 opportunities are excluded as policy-contaminated: the user was following
a guide that avoided low-charge moves, so a zero there proves nothing about the
rule.

**What we still want.** `p ≈ 0.012` is suggestive, not settled, and it is the
single biggest claimed edge in §4a. One observation of an enemy playing a move
at ≤0 flips the default straight back.

**The decisive test costs no energy and takes one minute:** in the browser
client, play a single move until its charge counter reads `-1` (any move, any
run — the last-charge rule drives it there after two plays from 3), then try to
click that move. Report whether the client lets you select it.

- If it refuses → hard prune confirmed, remove the flag.
- If it accepts → soft cost confirmed, flip the default to `false` and we have
  been pruning a legal move.

Please do this before Task 5 if convenient; §4a's EV engine is built on it.

## 2. Loot table shape — RESOLVED 2026-08-14, superseded by question 5

`lootOptions`/`lootPhase` are not the reward surface at all; boons arrive via
`rewardPathPhase`/`rewardPathOptions[]` and the loot table rides on
`enemyPathOptions[].lootTable`. See SPEC §3d. What remains open is the tier
choice — question 5.

## 5. The coverage wall — boons are now modelled, and the wall did not move

**Updated 2026-08-15 (Task 4.5).** Item 1 below is **done**: boons are modelled
as verified state deltas (`src/sim/boons.ts`, SPEC §4d). It did not raise
`deepestScorableRoom`, which is still **1**. That is the finding, not a failure
of the attempt — and it changes what to ask for next.

Why it didn't move:

1. **No clean room-1 boon exists.** Both recorded room-1 offers are
   `AddLuck | CorrosiveShield | UpgradePaper` and
   `AddEvasion | AddTenacity | AddBlock`. All six are either unmodelled or grant
   a rolled stat whose damage effect is unexplained. `Heal` is the only clean
   boon in the corpus and it is only ever offered at **room 2**.
2. **Enemies 65 and 66 are unscorable innately** — nothing to do with boons. So
   a perfect boon model caps `deepestScorableRoom` at **2**. **[RETRACTED
   session 06, RE-DERIVED session 07]** Not innate — it's per-tier
   (`rolledEnemyStats`/`enemyBuff`), and re-matching the actual captures
   against their preceding `enemyPathOptions[]` shows enemy 66's one capture
   IS Safe-tier and clean. Only enemy 65 (room 3) has zero Safe-tier captures.
   See the updated ask below.

The remaining work is capture. Three specific asks, in order of value per energy
spent. **All three fit inside a single watched run** (`scripts/watch.ts` already
records every state; none of these needs new tooling):

### 5a-bis. Does `intuition` reveal the enemy's next move?

The user took `AddIntuition` (+5%) and reported it "didn't trigger during the
next fight". At 5% that is expected and proves nothing about the effect — but it
does tell us intuition has a **visible trigger** in the client.

SPEC §5 records `Fintuition` on the fishing side as an ability that *reveals*
information. If dungeon `intuition` reveals the enemy's next move, it is worth
far more than 5% suggests, because predicting that move is the entire content of
§4a — a 5% chance of a certain read is a much better deal than a 5% chance of a
dodge.

**[session 08] Corpus check 1 (session-08 brief addendum §7) done, found
nothing** — `scripts/fieldFrequency.ts` over all 230 captured sides: every key
path is present 100% of the time (rolled stats included), and the four
normally-empty array fields (`activeEffects`, `triggeredBoons`, `gearBoons`,
`statusEffects`) are non-empty in 0/230, 0/230, 0/230, 3/230 (the known Burn
instance) respectively. `intuition.current` is non-zero in only 6/230
side-observations — far too little exposure to conclude anything, not evidence
the stat does nothing. See SPEC §4e.

**Check 2, still open and now the only path left:** add detection to the live
loop (`scripts/liveRun.ts`) that logs the full raw state whenever an unexpected
key appears — "at machine speed this resolves within a session or two on its
own" (brief addendum §7). Blocked on the same JWT issue as the rest of Task 6
(§7 above). Asking the user directly remains a fallback if a live session
doesn't produce a fire: when intuition does trigger, what does the client show?

### 5a. Rolled-stat semantics — downgraded twice, now a poor use of a capture

**It gates less than session 05 thought, and it costs more to settle.** Two
independent downgrades on 2026-08-16:

1. On the *enemy* side, rolled stats come from the tier the player picks (§6,
   SPEC §3e) — pick Safe and the mechanic never fires. On the player side they
   arrive via a boon the bot can simply decline.
2. They are **percentages**. `evasion 1` is a 1% dodge, not a ~10% one. Reading
   a 1–5% proc to any useful precision needs *hundreds* of damage-taking
   observations, not the ~30 session 05 asked for — which is far more than a
   supervised run can produce, and is a job for Task 6 machine-speed play.

At 1–5% these stats are also probably near-irrelevant to EV. That is a reason to
stop spending human captures on them, and **not** a reason to model them as zero:
`ROLLED_STATS` stays a fail-closed reason code. Superseded as a priority by §5b
and §5a-bis.

**What we have.** Counted in damage-taking opportunities: player `evasion 1`
8/9 exact, player `lck 1` 2/2, enemy `ev2+bl2+lk1` 6/7. The enemy-65 anomaly is
a Sword win that dealt exactly **8** of 16 — while the *same matchup against the
same enemy* dealt the full 16 elsewhere, so it is not a function of moves and
stats alone. SPEC §4e lists the hypotheses already tested and rejected.

**What would settle it.** ~30 exchanges where a side carries non-zero rolled
stats and actually takes damage. Concretely: take `AddEvasion` or `AddLuck`
early and play a long run, and/or fight enemy 65 through several Sword wins **at
full enemy armor** (the anomaly's one distinguishing feature).

### 5b. A clean room-1 boon offer — NOW THE TOP ASK, and it is one click

**Updated 2026-08-16.** Session 06 recorded `AddMaxArmor` (val1 2) offered at
**room 1**, alongside `AddLuck` and `UpgradeScissor`. It was not taken, so it has
no pair and stays unmodelled.

This is the highest-value single action left in the project. A max-pool change is
something `combat.ts` already models, so `AddMaxArmor` is very likely the clean
room-1 boon that has been missing since session 04 — and one pickup gives it a
before/after pair. Combined with Safe-tier enemies (§6), `deepestScorableRoom`
could go from 1 to 4 in a single run.

**Capture:** if `AddMaxArmor` — or any `AddMax*`, or `Heal` — is offered at room
1, take it. Then keep playing so the rooms behind it get scored.

**[UPDATED session 07] This alone no longer reaches room 4.** Re-deriving tier
from the corpus found rooms 1, 2 AND 4 already have clean Safe-tier captures —
only room 3 (enemy 65) has never been captured at Safe tier at all, at any
depth. So the ceiling with a clean room-1 boon plus Safe tier everywhere is
**room 3's lookup being absent**, not room 4's enemy being dirty. The single
highest-value capture is now: **pick Safe at the room-2→3 enemy-path screen**
(not Risky or Dangerous) so enemy 65 finally gets a Safe-tier recording. See
SPEC §3e and DECISIONS 2026-08-17.

### 5c. Die-on-a-tie — RESOLVED 2026-08-16, and the answer was the unexpected one

`run-2026-08-14-03-26-57 004→005`: the enemy **died on a tie and dealt its full
16 ATK anyway**, inside the clean model. So "a side that dies on an exchange
deals no damage" is **refuted** — do not implement it.

The confound at 037→038 therefore breaks toward `evasion`, which means evasion
probably *does* fire, and the player-side evidence stays 8/9 rather than becoming
9/9. `ROLLED_STATS` is still not narrowed: n = 9 is under the floor either way.
See SPEC §4e.

### 5d. Burn — nearly closed, low priority

`amount` 3, flat 3 damage per exchange, non-decrementing over 3 exchanges
(SPEC §4f). Implemented behind a default-off flag. It stays off because the
boon val, the status amount and the damage are all `3`, and it is never seen
expiring. **Deliberately low priority:** the only burning enemy is in room 4,
which is unscorable for `ENEMY_BUFF` regardless, so resolving Burn alone buys no
coverage. Worth doing only once 5a lands.

## 6. `enemyPathOptions` tier choice — RESOLVED 2026-08-16

Second sample captured, and it agrees: **the `lootTable` is identical across all
three tiers** (same table `LT_D5_Room_2`, same item 846, same weight, same amount
9). And the tiers are the source of `rolledEnemyStats` and `enemyBuff` — tier 0
("Safe") is all zeros with a null buff.

So the rule is **always Safe**, for two independent reasons that happen to point
the same way: higher tiers are pure added risk with no loot upside, and they are
the only thing making these battles unscorable. See SPEC §3e and DECISIONS
2026-08-16.

Still open, and worth one line in any future capture: both samples are at room 2.
If a deeper room shows a tier premium in `LOOT_AMOUNT_CID_array`, this becomes a
real risk/reward tradeoff rather than a free choice.

## 3. Fishing HAR — still blocks Task 7 (carried from session 01)

Confirmed this session that fishing is on a genuinely undiscovered surface:
**zero** matches for `/dendren|fish|cast|bait|node/i` across all seven probed
endpoints. There is nothing further to try without the capture.

Per SPEC §3a: gigaverse.io → DevTools → Network → filter Fetch/XHR → play one
Dendren cast start to finish → right-click → Save all as HAR →
`fixtures/fishing-cast.har` (already gitignored).

Not urgent — Tasks 4, 5 and 6 are all unblocked without it.

## 4. `dungeonId` in the action envelope — unverifiable until Task 6

The spec-drift diff flags `dungeonId` as quoted in SPEC.md but never seen in a
response. **This is not necessarily drift**: it is a *request* field in the §2
action envelope, and GET responses can neither confirm nor refute it.

Flagging it because the neighbouring evidence is suspicious — the API's own
`DUNGEON_ID_CID` means "run instance id", and the dungeon type is `ID_CID` as a
string. If `start_run` rejects `dungeonId: 5`, that naming is why. First real
POST at Task 6 settles it. Do not "fix" it speculatively before then.
