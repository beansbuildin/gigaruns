# QUESTIONS

Open items needing a human. Task 4's gate has passed and is committed; none of
these block it.

---

## 8. Daily guard budget already spent — RESOLVED 2026-08-15 [session 11]

User confirmed raising the budget in-chat this session (not unilateral) — see
DECISIONS 2026-08-15 (session 11). `config/bot.json` now reads 240/12,
matching the user's own stated real daily budget (240 energy/day, 12 runs at
20 energy) rather than a session-scoped patch. The three retuned-config runs
this asked for ran successfully (rooms reached 4, 3, 2 — see STATE.md
session 11). Original text kept below for the record.

<details><summary>Original [session 10]</summary>

`config/bot.json`'s `dailyEnergyBudget: 120` / `maxRunsPerSession: 5` is keyed
by UTC date in `data/guard-budget.json`, and today's entry already reads
`{"date":"2026-08-15","energySpent":78,"runsStarted":5}` — session 09's
five-run stage spent it all earlier today. `npm run live -- --dry-run` this
session correctly refused a 6th run:

```
✗ Guard tripped: session run cap reached {"attemptedRun":6,"cap":5}
```

This is the guard working as designed, not a bug — the whole point of session
09's persistence fix was making this cap real across process invocations. But
the session-10 brief asks for five MORE live runs (with the retuned
`utility.ts`/`loot.ts` from this session) to compare death-room distribution
before/after, which needs either a raised budget for today or waiting for
tomorrow's UTC rollover. Raising `dailyEnergyBudget`/`maxRunsPerSession`
myself is exactly CLAUDE.md's "Ask first" list ("spend energy above the
configured daily budget") — not something to do unilaterally the way session
09 did (that raise matched a budget the user's own brief had already stated
explicitly; this one would not).

**What's needed:** either (a) confirm raising today's budget (e.g. to 240
energy / 10 runs, covering both sessions' worth) so the five-run stage can run
now, or (b) let it run tomorrow once the date key rolls over. The five-run
stage and the opportunistic `reward_*`/`path_*` envelope test (§9 below) are
both blocked on the same thing.

</details>

## 9. `reward_*`/`path_*` envelope test — STILL OPEN, opportunistic window closed without firing [session 11]

Session-10 brief §3: on the next live reward pick, send the tracked
`actionToken` and the real `dungeonId` instead of `""`/`0` (current behavior),
one variation at a time, falling back to current handling if it 500s too. Not
attempted this session — no live reward pick happened, since §8 blocked every
live run before one was reached.

**[session 11] Still not attempted — but this time because the opportunity
never arose, not because it was blocked.** The three retuned-config live runs
this session had ZERO HTTP 500s of any kind (confirmed: `grep -c "HTTP 5"
logs/session11-liverun.log` → 0), unlike session 09's 17-across-5-runs and
session 08's 2. Either the earlier 500s really were transient server-side
flakiness (per the session-10 brief's own fallback: "if both variations 500
too, accept it as server flakiness, record it, and stop looking" — this
session's zero occurrences over 3 more runs leans that direction, though 3
runs is thin evidence either way), or this batch got lucky. Keep the test
queued opportunistically for the next live session that hits a `reward_*`/
`path_*` 500; do not spend a dedicated session chasing it.

**[session 12] Free check done (log query, not a live run, per the session-12
brief §4): session 09's 17 failures are SPREAD across the batch, not
clustered into one server-side window — keep the envelope test queued.**

Method: every `logs/run-*.jsonl` line matching `HTTP 500` with reason
`reward selection rejected` or `enemy path selection rejected` carries a
real UTC timestamp. Session 09's own commits (`git log --date=iso-strict`)
run `2026-08-14T18:12:52-07:00` to `2026-08-14T19:36:55-07:00`, i.e.
`2026-08-15T01:12` to `02:36` **UTC** — the date-flip is just the -07:00
offset, not a different day. Filtering the logs to that UTC window and
counting by reason produces **exactly** 9 reward + 8 path = 17, matching
`session-09.md`'s own breakdown (§D) precisely, and lands across **5**
distinct run files (`run-2026-08-15-01-16-01`, `-01-42-33`, `-01-53-35`,
`-01-58-11`, `-02-03-21`) — session 09's 5 completed runs, confirmed by
`start_run` counts per file.

The distribution across those 5 runs: **1, 2, 8, 4, 2** failures per run.
**Every one of the 5 runs hit at least one 500** — not one bad run dragging
the average up, and not one contiguous block of wall-clock time with a
quiet period on either side inside the ~50-minute session. That's the
"spread, request-shaped" signature the session-12 brief's decision
framework named, not the "clustered, one server-side window" signature that
would have let this get written off as transient. **Conclusion: keep
`reward_*`/`path_*` handled defensively (current `postWithVerifiedRetry`
behavior) and keep this envelope test queued** — it is not dead server
flakiness, even though session 11's own 3-run batch happened to see zero.

(In the course of this check, a separate stray log file,
`logs/run-2026-08-15-15-38-07.jsonl`, was found with 12 more reward_/path_
500s at a timestamp that initially looked like it fell inside session 11's
own commit window — appearing to contradict session 11's "0 HTTP 500s"
claim. It does not: the authoritative log session 11 actually measured
against, `logs/session11-liverun.log`, has zero `HTTP 500` lines, and the
real 3-run batch fixture directory is `fixtures/dungeon-runs/
run-2026-08-15-15-38-09` (note the `-09`, not the stray file's `-07`) —
two seconds apart, different artifacts. session 11's claim stands; the
stray file is most likely an earlier discarded/aborted attempt from the
same morning, not part of the reported batch. Flagging only so a future
session doesn't re-discover the same false lead.)

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

## 3. Fishing HAR — RESOLVED 2026-08-15 [session 11]

The HAR landed (`fixtures/fishing-casts/fishing-cast.har`, at a slightly
different path than the checklist below asked for but correctly gitignored)
and was parsed. Both halves this item was blocking are done: `SPEC-fishing.md`
documents the fishing API in full, and the item-metadata endpoint is
resolved (`GET /offchain/static`'s `gameItems[]`) — see DECISIONS
2026-08-15 (session 11) and TASKS.md Task 7. Original text kept below for
the record.

<details><summary>Original (carried from session 01, expanded session 10)</summary>

Confirmed this session that fishing is on a genuinely undiscovered surface:
**zero** matches for `/dendren|fish|cast|bait|node/i` across all seven probed
endpoints. There is nothing further to try without the capture.

**[2026-08-16, session 10]** This is now also the only lead on item metadata.
`/items/balances` returns bare numeric IDs and balances, no names or
descriptions — can't tell which held items are consumables from that endpoint
alone. But the game client clearly displays item names somewhere, so it fetches
them from an endpoint that exists; per CLAUDE.md §2 ("never invent an
endpoint"), the way to find it without guessing a URL is the same HAR capture
already blocking fishing. One ten-minute capture unblocks both.

**One capture, one checklist:**

1. Open gigaverse.io in a browser with DevTools open, Network tab, filter to
   Fetch/XHR.
2. Open the inventory and let item names render on screen (this is what
   captures the item-metadata endpoint).
3. Play one complete Dendren fishing cast, start to finish.
4. Right-click the network panel → Save all as HAR → save as
   `fixtures/fishing-cast.har` (repo root; already gitignored).

Not urgent for the dungeon side — Tasks 4, 5 and 6 are all unblocked without
it — but it is the single highest-value capture left for the project as a
whole: it unblocks the entire fishing half (blocked since session 01) and the
item-metadata question the session-09 brief flagged as possibly "the biggest
lever" on live-run deaths (consumables), in one action.

</details>

## 4. `dungeonId` in the action envelope — unverifiable until Task 6

The spec-drift diff flags `dungeonId` as quoted in SPEC.md but never seen in a
response. **This is not necessarily drift**: it is a *request* field in the §2
action envelope, and GET responses can neither confirm nor refute it.

Flagging it because the neighbouring evidence is suspicious — the API's own
`DUNGEON_ID_CID` means "run instance id", and the dungeon type is `ID_CID` as a
string. If `start_run` rejects `dungeonId: 5`, that naming is why. First real
POST at Task 6 settles it. Do not "fix" it speculatively before then.
