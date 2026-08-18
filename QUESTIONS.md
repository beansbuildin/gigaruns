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

## 10. Fishing catch-reward action name — RESOLVED 2026-08-16, session 17: `loot`. See SPEC-fishing.md and DECISIONS.md for the full capture. [originally opened session 15]

**[session 16] Re-checked read-only at the top of this session, still stuck,
unchanged.** `GET /fishing/state` still shows the same completed doc
(`docId 12925779`, `COMPLETE_CID`/`SUCCESS_CID` both true, `fullDeck`
length 10, never merged) — confirms this is a genuinely persistent account
state, not a transient one that would clear on its own. No new guesses
attempted (CLAUDE.md's stuck protocol already exhausted its two reasoned
tries last session). Session 16 spent its time on the dungeon side instead
(Task 12 Stage B, fully resolved — see TASKS.md), since this blocker still
needs the user's own DevTools capture to move.

**This project's first-ever live catch happened this session** (cast 4 of the
day, `fixtures/fishing-casts/live/cast-2026-08-16-01-57-01/state-*.json`) —
Zombo, item 521, rarity 2. The terminal `play_cards` response's `data.doc.data`
carries `caughtFish` (fish metadata, sizes, `findexResult`) and **`cardsToAdd`**,
an array of 3 full card objects (ids 23, 14, 7 in this capture) — this is the
first live confirmation of the session-15 brief §2 hypothesis ("choose one of
three new spells on catch"). `gameItemBalanceChanges` in the SAME response
already shows the fish (521, +1) and Hard Core (845, +320) credited — loot
itself is NOT gated behind whatever this blocker is.

**The account is now stuck.** Every subsequent `start_run` attempt (5 total,
spaced ~15–90s apart, both through `liveFishing.ts`'s normal retry path and
manual probes) returns:

```
HTTP 400 {"success":false,"message":"Player is already in a game","error":"Player is already in a game"}
```

`GET /fishing/state/:address` agrees: `gameState.COMPLETE_CID: true`,
`SUCCESS_CID: true`, but the doc is still returned as the "current" game —
`fullDeck`/`deckCardData` are UNCHANGED at the pre-catch 10 cards, i.e. the 3
`cardsToAdd` cards have not been merged into the deck. Something has to
acknowledge/select from `cardsToAdd` before the slot frees up — this reads as
the exact mechanic the session-15 brief's screenshot flagged (§2, "choose one
of three new spells"), now confirmed to be a required action, not cosmetic.

**Two reasoned guesses tried on the same confirmed `/fishing/action` endpoint,
both cleanly rejected by the server's own action whitelist (not brute-forced —
CLAUDE.md §2 is about inventing endpoints, and this is testing an unconfirmed
action-name value on an already-confirmed endpoint, same category as how
`reward_one`/`path_two` were originally probed on the dungeon side):**

```
action: "select_card" → HTTP 400 {"message":"Invalid action: select_card"}
action: "claim"       → HTTP 400 {"message":"Invalid action: claim"}
action: "play_cards" (itemId:23, on the completed doc) →
    HTTP 400 {"message":"Player is not in a game [0x...]"}
```

The `play_cards` response is the interesting one — it means the completed doc
blocks `start_run` ("already in a game") but does NOT count as an active game
for `play_cards` ("not in a game"). Consistent with a genuinely separate,
still-unknown action being the only way out. Stopped guessing after these two
clean "Invalid action" rejections — the server clearly enforces a real
whitelist and further blind guesses would just be brute-forcing an enum, which
CLAUDE.md's spirit (if not its literal endpoint-only wording) argues against
doing indefinitely.

**Checked `GET /gamewebui/actions`** (named in the community notes as "the
client's own action registry") hoping it would list this — it does not; that
endpoint is a UI-panel menu registry (marketplace, racing, duel, etc.), not the
game-action enum for `/fishing/action` or `/game/dungeon/action`.

**Consequence: fishing is blocked for the rest of today's session regardless
of remaining budget.** `data/guard-budget-fishing.json` shows only 4 real casts
completed (48 energy spent) before the stall — session 15's raised 200-energy/
15-cast cap (config/bot.json) could not be used past this point. The account
needs a `play_cards`-style card-selection action fired (in-browser, or via a
DevTools capture of the real client resolving its own catch) before another
cast can start.

**What would unblock this**: same recipe as question 3 originally — one
DevTools HAR capture (or even just the Network-tab request line) of a live
catch's follow-up request, from a real cast played to a catch in the browser
client. Specifically need to see what request fires when the client's own "pick
a new spell" UI (if any) is dismissed/confirmed after a catch.

**[session 17] The account IS unblocked — user resolved it in-browser between
sessions ("COLLECT" screen, then picked a spell card) — but the resolution
ACTION NAME is still uncaptured, so the bot still can't perform this step
itself.** Confirmed two ways this session: (1) `scripts/liveFishing.ts`'s new
pre-start check (`unknownDocKeys`) read the SAME old completed doc (`docId
12925779`, still `fullDeck` length 10 on `GET /fishing/state` — the read
endpoint apparently never updates this view once a game is fully resolved,
so `fullDeck` length was never a reliable "still stuck" signal); (2) despite
that, a real `start_run` immediately succeeded — the account was never
actually stuck this session. The pre-check's raw dump (`logs/fishing-unknown-
terminal-2026-08-16-16-18-39.json`) shows the RESOLVED doc's new fields:
`cardChosenId: 23` (matches one of the 3 `cardsToAdd` ids from session 15's
catch — 23/14/7), plus `caughtFish` (full fish metadata), `lastMovePath`,
`activeFintuitionTurns`, `activeCritBoostTurns`. So the resolved state is
distinguishable from the stuck state by `cardChosenId` being set (non-null)
— a real, useful field — but the actual POST that SETS it was fired from the
browser client, not captured. **Still needed**: a DevTools capture of that
one request, offered by the user this session but not yet done as of this
write (in progress). `scripts/liveFishing.ts` now dumps ANY unrecognised
field on a terminal doc automatically (`unknownDocKeys`/
`dumpUnknownTerminal`) — the next time the bot's OWN play reaches a catch,
the resolution fields will be captured mechanically without a human needing
to notice mid-session. This does not by itself capture the action name
(the bot doesn't send that action), but it removes any risk of missing the
signal in the response if a human capture also lands around the same time.

---

## 11. ROM factory-claim — enumeration + cooldown duration [session 19]

`POST /roms/factory-claim` is CONFIRMED and live-verified (SPEC.md's "ROM
factory-claim" section, DECISIONS 2026-08-16 session 19): claims land in the
same spendable energy pool as dungeon/fishing, but a single live claim on
romId 2097 delivered only ~1.0 real energy — not the 57 present in the
user's captured request body, which turns out not to control the payout at
all. Two things needed to size whether this is actually worth automating:

1. **How many ROMs does this wallet own, and how are they enumerated?**
   Only 7959 and 2097 are known (both from the user's own DevTools capture).
   `GET /user/me`, `GET /game/account/{address}`, and `GET /offchain/static`
   were all dumped and searched (CLAUDE.md §2) — none list owned ROM ids or
   balances. There may be a dedicated read endpoint (parallel to
   `/items/balances` or `/gigajuice/player/{address}`) that hasn't surfaced
   yet, or ROM ownership may only be visible through an on-chain NFT read
   this project doesn't otherwise touch. If the user can point at (or
   DevTools-capture) whatever UI panel lists "your ROMs," that would resolve
   this in one capture, same recipe as the fishing catch-resolution question
   (§10) was resolved.
2. **Cooldown duration.** Only lower-bounded at >34 seconds (an immediate
   re-claim of a just-claimed ROM failed). Is it minutes? Hours? Once per
   UTC day, like the dungeon/fishing guard budgets? This decides whether
   claiming is worth polling for or is a background, infrequent action.

Not blocking anything — Task 10 (orchestrator) doesn't need this resolved to
proceed, and CLAUDE.md's own instruction (session-19 brief) was explicit:
don't automate ROM claiming until the energy model is sized. Logged here per
the "write the question, keep going" protocol rather than idling on it.

**UPDATE [session 20, user-answered] — partially resolved, model revised, still open:**

1. **37 ROMs**, listed in an in-game panel called **"ROMULATOR"** — real
   volume, not the 2 known before. Still needed: a DevTools capture of that
   panel to get the other 35 ROM ids (no enumeration endpoint has ever
   surfaced in the three dumped candidates above).
2. **Cooldown is NOT a fixed per-claim timer** — the mental model in the
   question above was wrong. User: claim-to-claim cooldown is near-zero
   (0-1s), but each ROM accrues energy independently, and a claim only
   returns something once that ROM has accrued ≥~1 energy. This explains
   BOTH session 19 oddities at once (2097's immediate re-claim failing —
   nothing new accrued yet; 7959 never once succeeding — its own accrual
   state is simply unknown, not necessarily broken).

Consequence: the one successful claim (~1.0 energy, romId 2097) is NOT a
usable per-ROM rate — it reflects an unknown, possibly long, unclaimed
backlog on that one ROM, not a representative interval. Sizing this for real
needs (a) the other 35 ROM ids and (b) multiple spaced claims per ROM to
back out an actual accrual rate — a multi-session, multi-day measurement,
not a single-session task. No automation work until that rate exists (still
the standing instruction). See DECISIONS.md 2026-08-16 (session 20).

**UPDATE 2 [same session, user-provided + live] — mostly resolved, and the
number is much bigger than either prior estimate:**

The user pasted the full ROMULATOR response (all 37 ROMs, each with a
real-time `energyCollectable` field) mid-session. Summed: **~3,252 energy
unclaimed right now** — ~7.7x the account's own 420 cap. Two live
verification claims (small ROMs only, to avoid wasting a big accrual
against the cap) confirm `energyCollectable` maps directly to real credited
energy: romId 5345 claimed for an exact +12 (matching its snapshot value);
romId 689 claimed for +12 against a snapshot value of 11, consistent with a
few more seconds of live accrual. `amount` in the request remains fully
ignored (re-confirmed with a deliberately wrong value, `amount:999`, same
+12 result). Session 19's ~1 energy finding is now understood as a real but
unrepresentative single data point, not a rate.

Two things genuinely still open, both logged in SPEC.md's "ROM factory-claim"
section: (1) the exact endpoint/URL that produced the ROMULATOR snapshot —
worth asking the user directly so it can be scripted; (2) a batching
strategy for claiming ~3,252 energy against a 420 cap without wasting most
of it — this is a user decision (how they want to sequence claiming vs.
playing it down), not something to decide unilaterally. Still no automation
without explicit go-ahead — this update only changes the SIZE of the
lever, not the standing instruction to ask before building it.

## 12. Fishing `data.nextPosition`/`data.nextMovePath` — NARROWED [session 26]: real, but RARE (~2/30 casts), not the standing per-turn signal it looked like; Fintuition hypothesis CHECKED AND NOT CONFIRMED [session 27]

**[session 30] Validation-only recording is now LIVE.** Per user directive
this session (act on `nextPosition` when it fires) paired with the standing
caveat above (2/169 real firings, statistically compatible with but not
confirming a 3% rate), `scripts/liveFishing.ts`'s `runOneCast` now logs
predicted-vs-actual to `data/nextPositionValidation.jsonl` every time a
prediction from one turn can be checked against the next turn's real
position — `NextPositionValidation` records, `confirmedHitCount()` reads
the running total. The live override (force focus toward the predicted
cell via `certainDistribution`) is wired but gated behind
`NEXT_POSITION_OVERRIDE_THRESHOLD = 10` confirmed hits, unreachable at
today's 2-hit total regardless of this session's or the next session's live
volume. See DECISIONS.md 2026-08-18 (session 30).

Three fishing casts during Task 10's real 2-hour orchestrator gate run
tripped `liveFishing.ts`'s existing unknown-terminal-field detector on a
cast's final `play_cards` response. The detector's own inline comment
guessed this was "the catch-resolution mechanic" (question 10 above) — on
inspection that guess was wrong (`nextPosition`/`nextMovePath` sit next to
`fishPosition`/`previousFishPosition`, nowhere near `cardChosenId`/
`caughtFish`), and the session-25 recap raised a bigger question: is this a
live look-ahead of the fish's next move, available every turn?

**Checked against the existing fixture corpus (all 30 committed live casts,
`fixtures/fishing-casts/live/`, 225 turns total, no new live casts spent),
per CLAUDE.md §9 and the session-26 brief's own instruction to check
cheaply before spending anything new:**

1. **Not present on every turn, and not terminal-only either — it's rare.**
   The key appears on only **8 of 225 turns**, across only **2 of 30
   casts** (`cast-2026-08-17-20-40-57` and `cast-2026-08-17-21-10-15`). In
   the first cast it appears from turn 1 onward (real value once, then
   `null` for the rest of that cast); in the second it appears exactly
   once, on the terminal turn. Both readings in the original writeup were
   partial: it is not tied to "terminal doc" (contra the original
   catch-resolution guess) and it is not "every turn" (contra the hopeful
   look-ahead framing) — it looks like a **low-frequency, possibly
   probabilistic proc**, same shape as this project's other percent-chance
   mechanics (DECISIONS.md 2026-08-16: those need hundreds of observations
   to read a rate, not dozens).

2. **The one checkable prediction was correct, but n=1.** `cast-
   2026-08-17-20-40-57` turn 1: `nextPosition: [2,4]`, `nextMovePath:
   [7,8]`. Turn 2's actual `fishPosition: [2,4]`, `lastMovePath: [7,8]` —
   an EXACT match on both fields. The second occurrence
   (`cast-2026-08-17-21-10-15`, `nextPosition: [1,3]`) is on that cast's
   terminal turn, so there is no following turn in the fixture to check it
   against. **One confirmed hit is suggestive, not proof** — the same
   standard this project applies everywhere else (a single observation
   doesn't establish a rate or a mechanic).

3. **No candidate trigger condition explains the 2/30 rate.**
   `activeFintuitionTurns`, `activeCritBoostTurns`, `fintuitionOilBoostPercent`,
   `dualYieldOilBoostPercent`, and `jebaitorTriggered` are all `0`/`false`
   at both occurrences — ruled out as the gate. The specific card played
   immediately before the first occurrence (id 10, a crit-only card,
   `hitZones: []`, `critZones: [5]`) doesn't carry any declared "reveal"
   effect in `deckCardData`. Whatever gates this is not visible in any
   field this project currently reads.

**Consequence for the session-25/26 framing**: this is NOT "a bigger lever
than `mineFishPatterns.ts`" as originally hoped — at an apparent ~7%
per-cast rate (2/30), it cannot replace the general prediction problem
`mineFishPatterns.ts` exists to solve; it would at best be an occasional
bonus signal on the rare turn it fires. Not chased further into strategy
code this session, per the brief's own instruction not to build a reaction
mechanism before confirming it holds — it doesn't yet, at only 2 sightings.

**What would settle it further**: more real occurrences. `liveFishing.ts`'s
unknown-field detector is now widened (session 26) from terminal-only to
EVERY `play_cards` turn, so future live casts will surface every occurrence
immediately (event `unknown_fields`, `logs/fishing-unknown-midcast-*.json`
or `-terminal-*.json`) instead of requiring a fixture-corpus audit to
notice. No strategy change made — purely a visibility widening, since the
underlying data was already captured every turn via `fixtures.write()`
regardless.

---

**Session 27 update: checked directly against the named candidate
(Fintuition) — NOT CONFIRMED, and the field this project would need to
confirm it can't do the job.**

The session-27 brief arrived with new user-supplied context: the account has
a **Fintuition** skill (level 2, stated 3% per-turn chance to reveal the
fish's next move) and reasoned that 8/225 turns (3.56%) is "a match, not
noise" for a 3% proc. Checked directly against the raw fixture JSON before
accepting this, per CLAUDE.md §9 (a brief's claims about the corpus are
hypotheses to verify, not facts to implement) — **two problems, both found
by reading the raw responses, not by re-running session 26's analysis:**

1. **The denominator is wrong.** 8/225 counts turns where the `nextPosition`
   *key* is present, but the key stays present (as `null`) for the rest of a
   cast once it has appeared once — session 26's own writeup already says
   this ("real value once, then `null` for the rest of that cast"), the
   session-27 brief just didn't carry that distinction through its own
   percentage. The real count of **firings** (non-null value) is **2**, not
   8. 2/225 = 0.89%, not 3.56% — well below the stated 3% rate, not a match
   to it.

2. **The one candidate field this project already has for this — checked
   and found genuinely uninformative, not merely "0 at both occurrences" as
   session 26's phrasing implied.** Read `activeFintuitionTurns` off every
   turn of every fixture (`fixtures/fishing-casts/live/**/state-*.json`,
   225 turns): its value is **`0` or `null` in literally every single turn
   of the entire corpus**, including the 2 turns where `nextPosition` fired
   AND every turn where it didn't. A field that never varies can't confirm
   or refute anything it's compared against — session 26's "ruled out as
   the gate" reads as a real test having been run; it wasn't, because there
   was no variation to test against in the first place. (`fintuitionOilBoostPercent`
   is similarly constant at `0` throughout — no oil has ever been equipped
   in this corpus, consistent with DECISIONS.md 2026-08-16 session 15.)

**Consequence:** Fintuition is a real, user-confirmed mechanic that
*probably* exists server-side, but this project has no field that has ever
been observed to move when it (hypothetically) fires, and the correct
observed rate (2/225 real firings, not 8/225) undershoots the stated 3%
rather than matching it. The brief's "re-opened, confirmed mechanic" framing
does NOT hold up against the corpus — this stays exactly where session 26
left it: real, rare (now more precisely ~0.9–1% of turns, not ~3.6%), cause
unconfirmed. Not implementing any Fintuition-reactive strategy code off this
— per CLAUDE.md §9, the brief's claim doesn't get implemented as stated,
and this correction is what goes in the recap instead.

**What would actually settle it**: a live capture where `nextPosition`
fires and `activeFintuitionTurns` (or literally any other field this
project reads) is simultaneously non-zero/non-default — that has never
happened once in 30 casts. Absent that, the honest position is "an unnamed
mechanism reveals the fish's next move on ~1% of turns, cause unknown" —
Fintuition is a plausible name for it, not a confirmed one.

---

**Session 28 correction (Codex review, `CODEXREVIEW` #1): session 27's own
count above used the wrong unit, and its conclusion was too strong as a
result. "Rejected" downgrades to "unconfirmed."**

Session 27 counted "2/225 real firings" using 225 as the denominator — but
225 is the total number of fishing RESPONSE DOCUMENTS in the corpus
(`start_run` + `play_cards` + `loot`, across 50 distinct casts, not 30
fixture directories), not the number of turns where `nextPosition` could
have fired. The right denominator is **169** — the actual `play_cards`
(card-play) turn count, direct-recounted by `docId` via the new
`src/sim/fishingCorpus.ts` loader (`npx tsx -e` against `loadFishingCorpus()`
reproduces this exactly). The corrected rate is **2/169 = 1.18%**, not
2/225 = 0.89% — still below the stated 3% Fintuition rate, but the
denominator error also means the earlier "well below... not a match" framing
needs its own statistical check, not just a smaller-looking fraction:

**A binomial test against a 3% null does NOT reject at n=169.** Observing 2
or fewer events in 169 independent trials at true rate p=0.03 has probability
P(X≤2) ≈ 11.5% under that null — not small enough to rule out 3% as the real
rate at any conventional significance threshold. 0.89% (the old, wrong
denominator) LOOKED more clearly incompatible with 3% than 1.18% (the
correct one) does; fixing the arithmetic error moves the evidence, if
anything, slightly TOWARD "compatible with Fintuition," not away from it.

**Corrected status: Fintuition as the cause of `nextPosition` firing is
UNCONFIRMED, not rejected.** The two problems session 27 found are both
still real and still block confirmation either way — `activeFintuitionTurns`/
`fintuitionOilBoostPercent` are constant `0`/`null` across the entire corpus
and carry zero discriminating information regardless of which denominator is
used, so this project genuinely cannot confirm OR refute the hypothesis from
data it has today. What changed is only the confidence of the negative
claim: "the numbers argue against Fintuition" (session 27's implicit framing)
is not supported; "the numbers can't yet tell either way" is the accurate
one. STATE.md/DECISIONS.md corrected accordingly this session — see
DECISIONS.md's 2026-08-18 (session 28) entry.

---

## 13. Fishing's real daily-cap reset boundary is NOT UTC midnight — RESOLVED 2026-08-18 [session 29]: user-confirmed both dungeon and fishing reset at 11am Pacific (`America/Los_Angeles`, DST-aware). `guardPersistence.ts`'s `todayKey()` now keys on this boundary instead of UTC midnight for both modes. See DECISIONS.md 2026-08-18 (session 29). Original question preserved below for context. [session 27]

Session 27 found fresh local guard budget (`data/guard-budget-fishing.json`
rolled to 0/20 at UTC midnight, confirmed via `--status`) but the REAL
server rejected the very first `start_run` attempt of the day (03:33 UTC)
with `"Player has reached max runs for fishing"` — the account's real cast
allowance had NOT reset yet, hours after the local UTC-date guard already
considered it a new day. See DECISIONS.md 2026-08-18 (session 27) for the
full detail; `liveRun.ts`'s dungeon side has an analogous known gap
(session 23's run-count drift, fixed via `GET /game/dungeon/today`'s real
counter) but fishing has no equivalent "real remaining casts today" read —
only the write path (`start_run`) currently reveals the real state, and
only by rejecting.

**Needs a human**: what IS the real fishing reset boundary — a fixed
non-UTC timezone (e.g. reset at local midnight somewhere), a rolling 24h
window from the last cast of the previous day, or something else? Knowing
this would let a future session avoid burning a wasted `start_run` attempt
just to discover the cap hasn't lifted yet, the same way the dungeon side
already can via its `today` endpoint. Not blocking — the current fail-closed
behavior (guard trips cleanly, 0 energy wasted) is safe either way — but
worth asking the user or capturing whenever the account happens to be right
at that boundary.

**Corroborated read-only on the dungeon side the same session**: `GET
/game/dungeon/today`'s real `dayProgressEntities` counter for Forbidden
Woods (dungeon 5) still reads **12** (its session-25 exhausted value) at
03:33 UTC on 2026-08-18, `updatedAt: 2026-08-17T21:17:26.409Z` — six-plus
hours past UTC midnight and the real cap has not lifted either. Same
mismatch, same direction, on both game modes — strengthens "not a UTC
boundary" over "fishing-specific oddity." No write attempted on the dungeon
side (this was a GET-only check); dungeon's local guard also reads fresh
0/12 for the new UTC day, so the same live-vs-local mismatch applies there
too, not just to fishing.

---

## 14. `data/fish-patterns.jsonl` gained castId `9001`/`9002` records from an unknown ACTIVE process — RESOLVED 2026-08-18 [session 30]: not a live process at all. `tests/sim/fishingCorpus.test.ts` (added session 28, CODEXREVIEW #1/#5) calls the real `runOneCast` with `dryRun: false` and synthetic docIds `"9001"`/`"9002"`, but never passed `transitionsPath` — it defaulted to the real `data/fish-patterns.jsonl` (`scripts/liveFishing.ts:453`). Every test run appended a real, zero-movement transition record for whichever turn `lastRecordForCast()` derived next off the file's own growing history — explaining both the reappearance with new timestamps (repeated test runs during the session) and the incrementing turns (session 29's own CODEXREVIEW #5 fix made `runOneCast` resume from the file's last logged turn for that castId). Fixed by passing an isolated `transitionsPath` (temp dir) in the test. Verified: file checksum unchanged after re-running the test. The 14 accumulated pollution records were removed from the real file (169 real transitions / 50 real casts remain, matching session 29's clean count). Re-ran `mineFishPatterns.ts`: `twoCellCycle(0,-1)` stays at support=1, unchanged — the pollution's zero-movement records never matched any primitive, so no mined pattern was ever actually affected by it, but the corpus is clean now and the leak is closed going forward. Original report preserved below for context. [session 29]

While fixing the resumed-cast turn-numbering bug (CODEXREVIEW #5) and
re-running `mineFishPatterns.ts` against the real local
`data/fish-patterns.jsonl` (gitignored, not part of the committed corpus),
I found 8 records with castId `"9001"`/`"9002"` — a numeric shape (4 digits)
that has never appeared anywhere else in this project's fishing corpus (real
docIds are always 8 digits, e.g. `12923189`). Every one of these records has
`from:[0,0]` and `to:[0,0]` (zero movement) on a 4×4 grid, alternating
between the two castIds a few seconds apart.

I treated this as one-off test/debug pollution — removed the original 8
lines from the local file (documented in this session's STATE.md) and
re-ran the miner. **Before I finished the rest of this session's work, the
SAME castIds reappeared with NEW timestamps and incrementing turn numbers
(0→1→2→3), spaced roughly a minute apart, spanning real wall-clock time
while this session was running** — meaning something was ACTIVELY writing to
this file concurrently with this session, not a stale one-time artifact. I
could not find a matching local process (`ps aux` from this sandbox showed
nothing), so I don't know what it is.

**I've stopped touching `data/fish-patterns.jsonl` for the rest of this
session** rather than risk interfering with whatever is writing to it. Two
possibilities I can't distinguish from here: (a) you were testing
`liveFishing.ts` (or something adjacent) manually against a sandbox/mock
node with synthetic ids, in which case this is expected and the
`9001`/`9002` records should probably be excluded from the miner by
convention (they don't look like real Dendren gameplay — zero movement every
turn); or (b) something is writing to this file that neither of us expects.

**Needs a human**: what is currently appending castId `9001`/`9002` to
`data/fish-patterns.jsonl`? If it's an intentional test harness, worth
either pointing it at a separate file (so it never touches the real mining
corpus) or teaching the miner to recognize and skip it explicitly. This
does NOT affect anything committed to git (`data/` is gitignored end to end)
and does NOT affect this session's actual code changes or their test
coverage — it only affects the live-runtime `data/minedFishPatterns.json`
that `liveFishing.ts` reads to seed its matcher, so it's worth resolving
before trusting that file's current promoted-pattern list.

---

## 15. A live `start_run` HTTP 400, and an ESCAPED (not caught) cast leaving `COMPLETE_CID: true` on the account [session 33]

While live-verifying this session's new contextual-fallback wiring
(CODEXIMPROVE #3), `npx tsx scripts/liveFishing.ts --casts=1` rejected
`start_run` with HTTP 400 — before any of this session's new code ever ran
(the request body was the standard, unchanged `start_run` envelope; see
`logs/fishing-2026-08-18-10-12-52.jsonl`'s `action_failed` entry). Guard
correctly fail-closed, 0 energy spent, no crash.

Read-only follow-up (`scripts/checkFishingStuck.ts`) found the account
carrying a completed-but-unresolved doc: `docId 12957129`,
`COMPLETE_CID: true`, **`SUCCESS_CID: false`** (an ESCAPE, not a catch —
`fishHp`/`fishMaxHp` both at 17, matching the confirmed catch-meter
direction: a miss pushes `fishHp` toward `fishMaxHp`, and `FISH_ESCAPED`
fires there). This is a DIFFERENT shape from every previously-documented
stuck case: DECISIONS 2026-08-16 (session 15) and QUESTIONS §10 both
describe the stuck mechanic as CATCH-specific — a real `cardsToAdd` triple
sits unresolved until `loot` picks one, and `runOneCast`'s existing
pre-start check (`scripts/liveFishing.ts` around the `existing.gameState &&
existing.gameState.COMPLETE_CID` branch) was written against that case. This
doc has no `cardsToAdd` at all (`undefined`) and `cardChosenId: -1` — not
the previously-documented `null` sentinel, and nothing to `loot` against.

I don't know whether this HTTP 400 and this stuck doc are actually related
(I have no earlier successful live cast this session to compare against —
the 12957129 doc could predate this session entirely, left over from
whenever it was actually played), and I did not attempt to resolve it
further: sending `loot` here would be guessing at an action shape this
project has never confirmed for an escape (only for a catch with real
`cardsToAdd` ids), and CLAUDE.md's stuck protocol is to log and stop, not
guess. `--dry-run` still works cleanly (it never reaches `start_run`), so
this doesn't block anything except an actual new live cast today.

**Needs a human**: does an ESCAPED cast ever leave the account similarly
"stuck" needing something to acknowledge it before a new `start_run` is
accepted (a genuinely new mechanic if so — worth a DevTools capture of what
the real client sends after an escape, same as how `reward_one`/`path_two`/
`loot` were each originally confirmed), or is `docId 12957129` simply stale
from earlier out-of-band play and the HTTP 400 was something unrelated
(rate limiting, a stale action token, a transient server error)? Either
way, this session's actual deliverable (the contextual fallback module,
tests, offline CV, and simulator ablation) is unaffected — this is purely a
live-environment finding surfaced while trying to smoke-test the new
wiring end to end.
