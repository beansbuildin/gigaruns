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

2026-08-18 (out-of-band, user DevTools capture, not a numbered session) — A
second real ESCAPE terminal doc confirms the shape above was not a one-off.
`POST /api/fishing/action` response for `docId 12972042`: `COMPLETE_CID:
true`, `SUCCESS_CID: false`, `cardChosenId: -1`, no `cardsToAdd` field
anywhere in the doc — identical to `docId 12957129`'s shape, n=2 now, not
n=1. Event sequence: `FISH_MOVED` → `CARD_PLAYED` → `FISH_HP_DIFF` (-5) →
`FISH_ESCAPED`. `IS_JUICED_CID: true` on this capture (the account-level
buff per DECISIONS 2026-08-17 session 23/30's naming — noted as present,
not inferred as causally relevant to the escape's terminal shape; the
prior capture's `IS_JUICED_CID` value isn't on record to compare against).
Captured via the browser's Network tab and pasted directly into the chat
session, NOT through the bot's own `FixtureWriter` — the raw response has
NOT yet been redacted or filed into `fixtures/fishing-casts/live/` under
that pipeline's directory/state-file convention, and it carries the
account's real wallet address in `PLAYER_CID`, so it must not be committed
verbatim (DECISIONS 2026-08-13/14's redaction rule). The full raw capture
is available in this chat session's own history for the next live session
to redact and fold into the real fixture corpus through the normal
capture path, rather than hand-built here outside that tooling. **Still
open**: this capture is the escape event itself, not the request that follows it — the
actual remaining question is what the client sends NEXT (a subsequent
fishing action/`start_run`) while this shape is on the account: does the
server need an explicit acknowledgment first, or does a fresh action just
succeed past it? A capture of that follow-up request, taken while a stuck
doc like this is still on the account, would close this out.

**2026-08-18 (session 44) — the "still open" question above is now
ANSWERED, twice, live: a fresh `start_run` just succeeds past this exact
stuck shape, no acknowledgment needed.** This session's live batch hit the
`COMPLETE_CID: true, SUCCESS_CID: false` shape (this section's own
"unknown terminal field... account is likely stuck" warning) TWICE, ahead
of casts 16 and 17 (loop-numbered) — both times the very next `start_run`
call this project's own process sent (no special handling, no separate
acknowledgment action) returned HTTP 200 and started cleanly. The original
2026-08-18 HTTP 400 that opened this section is therefore most likely
attributable to something else entirely (a stale action token, rate
limiting, a transient error) rather than this doc shape itself — though
that specific correlation is still not directly confirmed, only the
"does a fresh action succeed past it" half is now settled.

**2026-08-19 (session 46) — the HTTP 400 that opened this section is now
ATTRIBUTED, and it was never this doc shape.** The account was carrying the
exact shape above at the top of this session (`docId 12978003`,
`COMPLETE_CID: true`, `SUCCESS_CID: false`, `cardChosenId: -1`, no
`cardsToAdd` anywhere — n=3 for this shape now), and `start_run` rejected
HTTP 400 again. The session-46 brief's §0 prescribed resolving it with the
`loot` action; **that remedy does not apply** — `loot` resolves §10's CATCH
shape, where a real `cardsToAdd` triple sits pending. There is nothing to
loot on an escape.

The actual cause was invisible because of a separate bug, fixed this session.
`client.ts` throws `UnexpectedResponseError` for every non-2xx, and that
error's `.message` is only ever `"Unexpected response from <path>: HTTP
<status>"` — the server's own text lives ONLY in `.body`, which
`liveFishing.ts` was discarding at all three action call sites (contrary to
CLAUDE.md §5's "log the full response body"). With `serverErrorDetail()`
wired in, one further attempt returned:

```
HTTP 400 {"success":false,
          "message":"Player has reached max runs for fishing",
          "error":"Player has reached max runs for fishing"}
```

**It is the server-side daily cap.** Not the stuck doc, and not the energy
floor either (the account also sat at 15/420 energy, which is a real
constraint but not this one). The same bug had also killed `runOneCast`'s
server-cap classifier, which tested `/reached max runs/i` against `.message`
— a string that text can never appear in — so the branch had been **dead
since session 29 wrote it**. It fired correctly for the first time on this
capture, reclassifying the rejection as a budget trip.

**Strong inference, flagged as inference:** session 45's cast-3 rejection was
most likely the same thing. Its batch stood at cast 18-19 of the day (session
44's 16 plus its own 2), right at the 20-cast juiced cap, and the message
that would have identified it was being discarded by this same bug. It was
recorded instead as "the account is stuck in the completed-but-unresolved doc
state", propagated into `handoff/STATE.md` as the top blocker, and from there
into the session-46 brief's §0 as the session's first instruction.

**Consequence for future sessions: the stuck-doc warning is loud and it is
not load-bearing.** `unknownDocKeys` prints "the account is likely stuck
(QUESTIONS.md §10); start_run below will probably reject" on *every* run that
sees a terminal doc, and session 44 already established that a fresh
`start_run` succeeds past that shape. Do not attribute a `start_run` HTTP 400
to it without reading the body first — the body is now logged, so there is no
longer any excuse to infer.

---

## 16. Fishing oil-use action shape — RESOLVED 2026-08-18 [session 44]: user DevTools capture confirmed `use_fishing_item` — `{action:"use_fishing_item", actionToken:"<string>", data:{cards:[], nodeId:"", focusPoint:[], itemId:821, slotIndex:0, tierId:0}}`, captured using one "Lil Mana Oil" (itemId 821) mid-cast. Same six-field envelope as every other fishing action; `itemId`/`slotIndex` do address the item, confirming SPEC-fishing.md §4a's "very likely" hypothesis. `oilPolicy.ts`'s `shouldConsiderRelaxingOil` is now wired into a real call site in `scripts/liveFishing.ts`'s `runOneCast` (item 937, Mid Relaxing Oil) — `slotIndex:0` is a stated, fail-closed hypothesis for THAT item specifically (the capture confirms it only for item 821), see `src/api/fishing.ts`'s `FishingActionSchema` doc comment and DECISIONS.md 2026-08-18 (session 44). Original question preserved below for context. [session 43]

`src/strategy/fishing/oilPolicy.ts`'s `shouldConsiderRelaxingOil` (session-43
brief §3, "always hold at least one Mid Focus Oil and one Mid Relaxing Oil in
reserve... a fish at low HP with no sure kill is a legitimate case to spend
Mid Relaxing Oil") is a pure recommendation function with no live call site,
and it cannot get one yet: no request shape for actually consuming a fishing
oil mid-cast has ever been captured. SPEC-fishing.md §4a already named this
gap generally (`itemId`/`slotIndex` on the existing `play_cards`/`start_run`
envelope are "very likely" the mechanism, not confirmed by a captured
oil-use request).

Item ids are resolved (SPEC-fishing.md §4a addendum, session 43): Mid Focus
Oil is 942 (`FishingRestoreFocus` +2), Mid Relaxing Oil is 937
(`FishingDamageFish` +2 — a direct fish-damage effect, not the "calming"
effect its name suggests).

**Needs**: a DevTools capture of the real client using ANY fishing oil
during a live cast — same method as `reward_one`/`path_two`/`loot` were
each originally confirmed (Network tab, capture the exact `POST
/api/fishing/action` request body, redact the JWT/wallet). Once that shape
is confirmed, `oilPolicy.ts`'s recommendation can be wired into a real
`use_item`-equivalent call site in `scripts/liveFishing.ts`. Until then,
the heuristic stays a documented decision point, not live code — this is
the same "confirm the shape, don't guess it" discipline CLAUDE.md §2
requires everywhere else in this project.

---

## §17 — `data.nextMovePath` — ANSWERED 2026-08-19 [session 48]: it IS a genuine multi-cell path, and the "identical to `nextPosition`" reading was a type confusion

**Answer.** `nextMovePath` is the same encoding as `lastMovePath` — a list of
1-based **row-major cell indices**, one per unit step — applied to the fish's
NEXT move instead of its last one. `nextPosition` is that path's endpoint.

The §17 table below reads `nextMovePath [1,2]` and `nextPosition [1,2]` and
concludes "the two fields are identical, and it is a single cell, not a path,
despite the name". They are not identical; they are **different types**.
`[1,2]` as a path is two indices decoding to `[1,1]` then `[1,2]`; `[1,2]` as
a position is row 1, column 2. The coincidence was in the formatting.

Scored over all six non-null observations by `scripts/auditMovePaths.ts`
(`auditNextMovePaths`), pinned by `tests/fishing/movePath.test.ts`:

| check | result |
|---|---|
| decoded path ends exactly on `nextPosition` | **6/6** |
| decoded path is unit steps from the fish's current cell | **6/6** |
| **multi-cell** (length > 1) — i.e. NOT a `nextPosition` duplicate | **2/6** |
| fish actually went there (the 4 where the cast continued) | **4/4** |
| next turn's `lastMovePath` equals it byte-for-byte | **4/4** |

So it is a real, exact, one-turn-ahead oracle when present, and its LENGTH is
the next move's step count — the quantity FACT 1 got wrong (see
SPEC-fishing.md §9).

**Two things this does NOT change.**

1. **It is not unexploited, and the override is correctly gated.**
   `scripts/liveFishing.ts` already validates each prediction into
   `data/nextPositionValidation.jsonl` and enables `certainDistribution` only
   once `nextPositionOverrideStats` reports ≥ `NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS`
   (10) with a Wilson lower bound ≥ 0.5. It currently stands at **3 attempts,
   3 hits, lower bound 0.438 — not ready.** Working as designed.
2. **Still no idea WHY it is populated** — 6 of 385 state docs (~1.6%), and
   session 27 checked and did not confirm the Fintuition hypothesis (§12).
   Four of the six are mid-cast (`COMPLETE_CID: false`), so it is not a
   terminal-doc-only artifact.

**One decision left for a human, deliberately not taken.** Cast `12956718`
turn 1 is a **fourth** validated observation (predicted `[2,4]`, realized
`[2,4]`) that predates the validation ledger and so is not counted toward the
10-attempt gate. Backfilling it would move a live gate using data the gate's
author never sanctioned, so it was left alone. If backfilled the count becomes
4/4, lower bound 0.51 — still short of 10 attempts, so it changes nothing
today either way.

Original question preserved below for context.

## §17 (original) — `data.nextMovePath`: a new wire field, one non-null observation

**[session 45, live]** Three docs in this session's 2-cast live batch carried
`data.nextMovePath` alongside the already-known `data.nextPosition`, both
flagged as unknown fields by `unknownDocKeys` (dumps in `logs/
fishing-unknown-{midcast,terminal}-2026-08-19-05-14-*.json`).

Observed values:

| dump | `fishPosition` | `nextPosition` | `nextMovePath` |
|---|---|---|---|
| midcast 05-14-28 | `[2,1]` | `[1,2]` | `[1,2]` |
| midcast 05-14-30 | `[1,2]` | `null` | `null` |
| terminal 05-14-32 | `[2,1]` | `null` | `null` |

In the one non-null sample the two fields are **identical**, and it is a single
cell, not a path — despite the name. The fish did in fact move `[2,1] → [1,2]`,
Manhattan distance 2, so this was a `k=2` cast and the prediction was correct.

**Question for Claude / the user:** is `nextMovePath` ever an actual multi-cell
path (which would be a substantially stronger signal than `nextPosition` — the
fish's whole remaining route), or is it always a one-cell duplicate? One
observation cannot distinguish "always equals `nextPosition`" from "usually a
single cell, occasionally longer". A DevTools capture of a cast where the field
is non-null over several consecutive turns would settle it. Not acted on: per
the standing "don't invent behavior that wasn't captured" rule, nothing reads
this field yet, and `unknownDocKeys` will keep flagging it until it is either
modelled or allowlisted.

---

## §18 — the `nextPosition` override gate was set under different information; should it be re-specified? [session 49]

**Not blocking.** The gate is doing the right thing today. This is a design
question the brief (§5) explicitly asked me to RAISE rather than decide, and
CLAUDE.md's "don't reopen a settled decision silently" applies.

### Where it stands — and this moved a lot during session 49 itself

`data/nextPositionValidation.jsonl` is at **8 attempts / 8 hits / Wilson lower
bound 0.6756**.

Three of those were pre-existing, one is session 49's backfill (`12956718` t1,
`backfilled: true`, source recorded in the row), and **four are new live hits
from session 49's own two batches** — `12991353` t3 and t9, `12991355` t1 and
t5. All four realized exactly.

The gate is `attempts >= NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS (10)` **and**
`lowerBound >= NEXT_POSITION_OVERRIDE_MIN_LOWER_BOUND (0.5)`. The bound half is
met with room to spare; the attempts half is **two short**, so the override
stays **off**. Correct as written.

### Why it may be worth re-specifying

The 10-attempt threshold was chosen when the field's *meaning* was unknown —
QUESTIONS.md §17 read `nextMovePath` as a possible duplicate of `nextPosition`
and could not rule out that the whole thing was a wire artifact. That is no
longer the situation. `scripts/auditMovePaths.ts` at 84 casts:

- **11** non-null observations of `nextMovePath` / `nextPosition`
- decoded path ends exactly on `nextPosition`: **11/11**
- decoded path is unit steps from the current cell: **11/11**
- multi-cell (so NOT a `nextPosition` duplicate): **3/11**
- the fish actually went there, where the cast continued: **8/8**
- next turn's `lastMovePath` equals it byte-for-byte: **8/8**

That is structural evidence the hit count cannot express: the field decodes
correctly under the confirmed row-major identity every single time, and where
it was checkable it was right every single time.

### The cost of waiting — MUCH lower than it looked

**Correction to this section's own first draft, written earlier in session 49
from the pre-batch state.** I estimated ~80-160 more casts to reach 10 validated
attempts, from a rate of ~2.4% of state docs. That rate is not uniform: the
field clusters, and session 49's ten casts produced **four** validated attempts
on their own — two casts (`12991353`, `12991355`) carried it on most turns while
the other eight carried none.

At that observed rate, **roughly 5 more casts reaches n = 10** — a single batch,
not a month. That substantially weakens the "waiting is expensive" argument
below, and it is the honest reason to consider simply *waiting one more batch*
rather than re-specifying the gate at all.

### The question

Should the gate become **two-armed** — structural decode valid (path ends on
`nextPosition`, unit steps, non-empty) **AND** Wilson lower bound >= 0.5 at
n >= 5 — rather than a single attempt count?

Arguments against, stated fairly:
- **The cheapest answer is now "wait one batch."** At n=8 and ~4 attempts per
  10 casts, the existing gate resolves itself in about 5 more casts. Changing a
  threshold two observations before it would have been met is the worst time to
  change it.
- 8/8 is still only 8. A two-armed gate that fires at n=5 fires on very little.
- The structural check validates the *decode*, not the *prediction*. A field
  could decode perfectly and still be a plan the server revises.
- The override replaces the movement model with a point mass. Being wrong
  costs a whole turn's aim, and the movement model is currently healthy
  (session 49: live ring top-1 41.7% against an offline 42.6%).

Arguments for:
- The threshold encodes uncertainty that has since been resolved by a
  different kind of evidence.
- Waiting a month to learn something already visible is a real cost.

**Not changed unilaterally.** `NEXT_POSITION_OVERRIDE_MIN_ATTEMPTS` stays at
10 until the user or Claude says otherwise.

---

### RESOLVED [session 50] — the gate CLEARED itself. Nothing was re-specified.

The session-50 brief's answer was "wait one batch," and one batch was exactly
right. Session 50's five casts produced two more validated attempts
(`12992261` turns 3 and 8, both exact), and the ledger is now:

    attempts = 10   hits = 10   Wilson lower bound = 0.7225   READY = true

Both halves of the gate are met — `attempts >= 10` and `lowerBound >= 0.5` —
so `nextPositionOverrideStats` reports `ready` and **the override will arm on
the next live cast.** No threshold was touched, no question was re-opened, and
the two-armed redesign proposed above is moot: the original gate resolved
itself in five casts, which is the outcome its own design was betting on.

**What the next session must watch, because nobody has seen this fire yet.**

- The override replaces the entire movement distribution with a point mass on
  `nextPosition` (`certainDistribution`), so it does not merely nudge the
  focus — it removes the ring model from that turn's decision completely.
  Rows written on such a turn carry `tier: "override"` and are excluded from
  every ring-tier comparator, which is correct but means a batch dominated by
  override turns produces a much thinner ring-model readout.
- 10/10 is 10. The bound is 0.7225, not 1. A first live miss is not evidence
  the gate was wrong; it is the sample doing what a sample at n=10 does. What
  would be worth acting on is a RUN of misses, and the ledger keeps scoring
  every attempt whether the override is armed or not.
- Session 50's own batch is a reason for care rather than confidence about the
  movement model generally: it was k=2-heavy (17 of 19 scored turns), live
  coverage fell to 37.5%, and the shipped model LOST to the k-ring null
  (21.1% vs 26.3%). The override is a different mechanism from the ring model
  and this does not bear on its ledger — but it is the context the first
  armed batch will be read in.

---

## §19 — Should the matcher tier be DROPPED rather than mixed? [session 51 §3, OPEN — STILL UNMEASURED, blocked a FIFTH time; but the live half is now ONE COMMAND]

**[session 55] Nothing measured — session 55 was offline by construction (caps
spent; both ledgers verified agreeing at 20/20, see below). What changed is
that everything EXCEPT the twenty casts is now built, so §19 can no longer
consume a session:**

    npx tsx scripts/matcherWeightReport.ts --last-casts=20

**And a finding that would have made a naive version of that command WORSE than
useless.** The brief said to "read `matcherWeight` off `ringPrediction.jsonl`
rows". The field is real — `liveFishing.ts` has written it since session 51 —
but **0 of the 129 rows on disk carry it.** Every row predates the
instrumentation. That alone would only mean "no data"; the hazard is what
`matcherWeightOf()` does with an absent field: it back-fills the fixed
`1 - ringFloor = 0.9` that genuinely WAS in force before session 51. Correct
for reading history. Catastrophic here — 0.9 on every turn reads as "pi is
high on every turn", **which is exactly the conclusion §19 exists to test.**
A report that pooled those rows would have answered KEEP, confidently, off a
constant. **CLAUDE.md rule 10, in its purest form: a field that first appears
at date D, counted as though it described the period before D.**

`src/strategy/fishing/matcherVerdict.ts` therefore reads the raw field and
treats absence as NOT MEASURED, never as 0.9. Run against today's log it
returns `INSUFFICIENT_DATA` and says why, which is the right answer.

Two other things the script pins, both offline:

- **Session 51's decision rule is CODE, not prose**, so it cannot be
  renegotiated once the numbers are visible — and the honest answer may well be
  "drop the thing two sessions built". It also names the case session 51 left
  unnamed: pi crosses 0.5 and NO crossing cast beats the base rate, reported as
  `EARNED_BUT_UNPAID` rather than silently folded into DROP.
- **The loaded library's support is recomputed at run time**, so the verdict is
  pinned to what actually ran: 3 patterns (perimeterWalk cw/ccw, bounce(2,0)),
  **11 of 88 CLEAN casts** (88, not 89 — 89 is the trace count,
  `supportingCastCount`'s denominator is clean casts), pi_0 = 0.133.
- Opening focus spend on today's log, for the record: **n=15, mean 1.667, 95%
  CI [1.137, 2.196]** — brackets session 50's 1.80 live figure, far above its
  0.71 replayed one.

The scheduling precondition below is unchanged and still governs.

**[session 54] Blocked again, and this time on the game's own daily cap, not on
anything reprioritisable.** The session-54 brief said "the cap resets 11:00 PT
and the library is finally the right one... It is not blocked now." That was
right about the library and wrong about the timing: this session started ~2
hours after session 53, inside the SAME guard-day session 53 exhausted.

Measured, not assumed: `GET /fishing/state`'s `dayDocs` reports
`UINT256_CID: 20` for pond 2 (Dendren) — 20 casts used, against the real
20/day cap the user confirmed in session 21. The bot's own guard agrees
(20/20 casts, 240/240 energy, `data/guard-budget-fishing.json` dated
`2026-08-19`). Real energy was 100/420, so ENERGY was never the constraint —
the cast cap is, and it is a server-side limit no config change reaches. The
guard-day rolls at 11:00 PT.

Nothing about the decision rule or the library has changed. When a batch can
run, it runs against the 3-pattern de-aliased library (perimeterWalk cw 4,
ccw 4, bounce(2,0) 3 — 11 distinct supporting casts of 89, pi_0 ~= 0.133) and
session 51's rule below applies as written. Record support counts at batch
time.

**For the next brief:** a fishing batch is only schedulable in a session that
begins AFTER 11:00 PT on a day the caps have not already been spent. Session
53 spent this one. That is a scheduling fact about this repo, not a finding,
and it has now cost §19 four sessions — it is worth stating in the brief
rather than discovering at minute five.

---

### Original (session 51)

**Not blocking.** Session 51 replaced the matcher tier's fixed 0.9 weight with a
posterior mixture and shipped it, because it beats what was there by a wide
margin. But the third arm beats the mixture:

| arm | ΔlogLoss vs shipped fixed 0.9 | caught / 88 |
|---|---|---|
| posterior mixture (SHIPPED) | −0.632 [−0.760, −0.504] | 26 |
| matcher tier OFF entirely | −0.667 [−0.808, −0.527] | 25 |
| *posterior vs OFF* | **+0.030 [+0.015, +0.044]** | +2 / −1 |

Keeping the tier costs 0.030 nats across the corpus and buys the **4 of 88**
casts the posterior actually identifies as perimeter walkers (the fixed weight
treated all 88 as such). The CI on that cost excludes zero, so it is a real if
small price, and the catch difference is noise (McNemar p ≈ 0.12).

**Not decided here.** Dropping a whole tier is a larger design reversal than
the session-51 brief authorised, and there is a live consideration the replay
cannot see: session 50 measured that with the matcher OFF the replayed policy
stops spending focus (0.71 opening spend against live's 1.80), so the tier is
entangled with spending behaviour, not only with prediction. Dropping it live
may change more than the log loss.

**What would settle it:** run one live batch on the shipped mixture and read
`matcherWeight` on the `ringPrediction.jsonl` rows. If π stays near the prior
on every turn of every cast, the tier is buying nothing live and should go. If
π climbs past 0.5 on a cast and that cast's turns hit, it is earning its 0.030.
The instrumentation for this shipped in session 51; it needs a batch, not a
decision.

## §20 — `data/mined-patterns.json` is STALE [session 51 §3, OPEN — mechanical]

The live matcher library is `perimeterWalk(cw)` + `perimeterWalk(ccw)`,
explaining **8 of 88** clean casts. Re-mining at the current corpus promotes
**four** patterns — adding `bounce(2,0)` and `bounce(-2,0)` — with **11 of 88**
support.

Not regenerated in session 51: it changes live matcher behaviour, and
`scripts/mineFishPatterns.ts` is the thing that owns that decision. The
posterior's prior is computed from the LOADED library (`supportingCastCount`),
so it stays correct either way — a re-mine will simply raise the prior from
0.100 to ~0.144 on its own.

Worth doing, and worth doing BEFORE §19 is judged: a bigger library is a
different tier, and the "is the matcher worth keeping" question should be asked
of the library that would actually ship.

---

## §21 — every path-selection POST is rejected on first attempt [session 52, RESOLVED session 53 — it was never new, and it was a timing bug]

**Status: reproduced 26/26 across two live runs. Not fixed — fixing it means
changing a DevTools-confirmed envelope on a guess, which CLAUDE.md §2 forbids.**

Every `reward_*` and `path_*` POST is rejected on its FIRST attempt with

```
HTTP 500 {"success":false,"message":"Error tracking action",
          "error":"Invalid action token  != 1787185878470","actionToken":""}
```

and the **byte-identical retry ~1.5s later succeeds**. Combat moves, which
send the numeric token, succeed first time every time. Timeline from
`logs/run-2026-08-20-00-30-48.jsonl`:

```
00:31:17.774 RESP ok actionToken='1787185878470'
00:31:18.995 POST reward_two dungeonId=0 token='' idx=1
00:31:20.241 FAIL "Invalid action token  != 1787185878470"
00:31:21.773 POST reward_two dungeonId=0 token='' idx=1   <- identical
00:31:23.304 RESP ok actionToken='1787185883981'
```

Note the doubled space in `Invalid action token  != N`: our token is the empty
string, so the server is comparing `""` against the outstanding numeric token.
The blank is `buildPathSelectionEnvelope`'s deliberate, DevTools-confirmed
shape (session 08) — and it worked as recently as **2026-08-18**.

**This is new.** Rates per run log, path-selection decisions vs rejections:

| run log | tier+boon decisions | rejections |
|---|---|---|
| 2026-08-18-19-50-13 | 12 | **0** |
| 2026-08-18-21-15-24 | 10 | **0** |
| 2026-08-18-22-00-26 | 10 | **0** |
| 2026-08-18-22-07-12 | 8 | **0** |
| 2026-08-20-00-30-48 (run 1) | 14 | **14** |
| 2026-08-20-00-45-19 + -00-46-46 (run 2) | 12 | **12** |

No envelope code changed between those dates (sessions 44–51 were fishing-only;
session 51 touched only `liveRun.ts`'s preflight). So the server changed.

**Cost today:** 26 wasted requests and ~40s across two runs, and it eats the
failure budget — `maxConsecutiveActionFailures` is 3, and a reward→path
boundary is already 2 rejections back to back. It has not tripped, but it is
one server-side change away from halting every run.

**Questions for the user / next session.**

1. The obvious hypothesis is that path selections should now send the current
   numeric `actionToken` (`client.getActionToken()`) like combat moves do,
   rather than `""`. The experiment is one line and one run: send the numeric
   token on `reward_*`/`path_*` and see whether the first attempt succeeds. It
   is cheap but it costs a 60-energy juiced entry to observe, so it should ride
   along with a run that was going to happen anyway rather than justify its own.
2. Is there a cheaper read? A DevTools capture of the browser making a reward
   pick TODAY would settle the envelope question with no energy at all, and
   that is a user action, not a bot one. **This is the preferred route.**
3. Should the retry-on-rejection path log a WARN and a running count, so that a
   silent 100% first-attempt failure rate can never again be invisible in a run
   that otherwise "succeeded"? It was only found by reading the log by hand.

## §22 — the mined library's two new patterns are exact aliases [session 52 §4, RESOLVED session 53 — fixed upstream in the pool]

`scripts/mineFishPatterns.ts` promoted `bounce(2,0)` AND `bounce(-2,0)` at 89
casts. Both have the SAME three supporting casts, and on all three they
produce **byte-identical trajectories** — on a 4-wide grid a ±2 step reflects
immediately, so both collapse to the same period-2 horizontal oscillation:

```
12944936  start (3,1) grid 4   +2: (3,1) (1,1) (3,1) (1,1)   -2: identical
12991310  start (3,2) grid 4   +2: (3,2) (1,2) (3,2) (1,2)   -2: identical
12992271  start (2,4) grid 4   +2: (2,4) (4,4) (2,4) (4,4)   -2: identical
```

The library "doubled" 2 → 4 but added **one** distinguishable hypothesis. The
matcher's candidate set now holds two identical candidates, so the oscillation
hypothesis takes **2/4** of the initial mass instead of 1/3. That is a
double-counting defect in the candidate prior, not a modelling gain.

The prior itself is unaffected — `supportingCastCount` counts DISTINCT casts
and breaks on first match, so 11/89 is right.

**Measured, and this is why it is not simply "dedupe it":**

| library | ΔlogLoss vs 2-pattern | 95% cluster CI | caught/88 |
|---|---|---|---|
| 4-pattern (SHIPPED) | −0.0041 | [−0.0355, +0.0177] | 27 |
| 3-pattern, deduped | −0.0056 | [−0.0312, +0.0121] | 24 |
| 2-pattern (before) | — | — | 26 |

All three are indistinguishable on log loss, and the catch counts wander 24–27
— a spread of 3 catches on 88 casts is noise, not signal. **Dedup was NOT
applied**, because the evidence does not support it any more than it supports
the alias. Both are defensible; neither is demonstrated.

The right fix is probably upstream of the choice: `buildPatternPool()` should
not offer two primitives that are provably the same map on the grid sizes this
game uses, or `promotePatterns` should collapse primitives whose trajectories
agree on every supporting cast. Either makes the aliasing impossible rather
than arguing about it after the fact. Not attempted this session — it changes
mining for every future corpus and deserves its own gate.

---

## §21 RESOLUTION [session 53]

**The server never changed, and no envelope change was needed.** Session 52's
central claim — "the four 2026-08-18 run logs have 40 path-selection decisions
and zero rejections" — is refuted by those same logs. Counting
`post_attempt_failed` rows with `reason: "reward selection rejected"`:

```
run-2026-08-18-19-50-13   12      run-2026-08-20-00-30-48   14
run-2026-08-18-21-15-24   10      run-2026-08-20-00-45-19    2
run-2026-08-18-22-00-26   10      run-2026-08-20-00-46-46   10
run-2026-08-18-22-07-12    8
                        ----                              ----
                          40 of 40                          26 of 26
```

100% on both sides of the supposed change. Session 52 searched the old logs for
`"Invalid action token"` — a string that **could not exist** before session
47/51's `serverErrorDetail` fix started capturing the server's body — and read
*newly visible* as *new*. **A logging fix creates a false discontinuity in your
own history.** The `reason` field was populated on both sides and answers the
question correctly in one grep.

**Mechanism.** The server holds exactly one outstanding action token and rejects
any POST whose token does not equal it (hence the doubled space in
`Invalid action token  != N` — `""` interpolated into `{sent} != {outstanding}`).
Measured over all ten pre-fix run logs by `scripts/rejectionAudit.ts`, on local
response timestamps:

| POST class | n | first-attempt failures | gap since last response |
|---|---|---|---|
| empty token, rejected | 66 | 66 | 0.90 – 1.54 s (med 1.28) |
| empty token, accepted | 66 | 0 | 3.40 – 4.92 s (med 4.07) |
| numeric token | 224 | 0 | 0.90 – 1.79 s (med 1.36) |
| `start_run` (empty) | 4 | 0 | — (no token outstanding: the control) |

Zero overlap. The threshold sits in (1.54, 3.40) **since the response**.

**Fix, and a correction to the session-53 brief.** The brief proposed 3600ms as
a `minGapMs` — a REQUEST-to-request gap, since `RateLimiter` stamps
`lastCallAt` before dispatch. That is the wrong clock: it differs from the
response clock by one response latency (0.72–1.78 s, median 1.45, n=296), so
3600ms would have left ~1.8 s since the response in the worst case, inside the
reject band. Shipped instead as `RequestPacing.minGapSinceResponseMs = 4000`,
inside the band all 66 historical successes came from.

**GATE PASSED.** Two live juiced Tier-3 runs, **24 path-selection decisions, 0
first-attempt rejections** (historical rate: 100%). `post -> outcome` for
empty-token POSTs moved 0.72–1.78 s → 4.21–4.55 s while numeric-token POSTs
stayed at 1.02–1.71 s, so the pacing landed on exactly the intended class.
`postWithVerifiedRetry` untouched — the double-apply hazard it guards is real
and independent of this.

---

## §22 RESOLUTION [session 53]

Fixed upstream in `buildPatternPool()`, as the aliasing is a property of the
primitive SET at a given grid size and not of any one corpus. `dedupePatterns`
collapses primitives with identical behaviour signatures — full trajectories
from every start cell at every grid size the game uses (`GAME_GRID_SIZES = [4]`;
all 531 `gridSize` values in the corpus are 4).

**It was bigger than the one pair session 52 found: 5 of 23 primitives are
aliases, not 1.** Session 52 saw only the pair that happened to clear the
promotion threshold.

```
bounce(-2,0)  == bounce(2,0)      bounce(0,-2)  == bounce(0,2)
bounce(2,-2)  == bounce(2,2)      bounce(-2,2)  == bounce(2,2)
bounce(-2,-2) == bounce(2,2)
```

Pool 23 → 18. Re-mined library 4 patterns → 3 (`perimeterWalk(cw)`,
`perimeterWalk(ccw)`, `bounce(2,0)`); support counts unchanged at 4/4/3 = 11
distinct casts of 89, so π₀ is unmoved at ~0.133 while the oscillation
hypothesis drops from 2/4 of the candidate mass to 1/3 — which is the whole
point, since QUESTIONS.md §19's decision rule reads that mass.

**GATE: inert on the replay, as predicted, and shipped anyway.** 88 clean
traces, paired per turn, cluster-bootstrapped over casts: ΔlogLoss **−0.0017,
95% CI [−0.0063, +0.0033]**, caught 27 → 24. It is a correctness fix to the
prior, not a prediction improvement, and should not be argued as one. The catch
count moving −3 is within the same noise band session 52 measured (24/26/27
across three indistinguishable libraries at n=88).

`resolvePatternsByName` maps a retired alias name onto its surviving twin, so a
library file mined before the dedup still loads and collapses rather than being
silently dropped.

---

## §23 — juiced runs under-report energy spend by exactly 1, every time [session 53, OPEN — needs a cheap read, not a run]

Three consecutive juiced Tier-3 runs have logged `energy_accounting` with
`observedDelta` one LESS than `committedDelta`, always in the same direction:

| session | run | before | after | observed | committed | drift |
|---|---|---|---|---|---|---|
| 52 | 1 | — | — | 59 | 60 | −1 |
| 53 | 1 | 80 | 21 | 59 | 60 | −1 |
| 53 | 2 | 79 | 20 | 59 | 60 | −1 |

The session-53 brief pre-committed to the rule: same direction on both runs
makes it systematic rather than incidental. It is now 3/3.

**It is not regen.** Regen ADDS energy, which would make `observedDelta`
smaller than committed — which is what we see — but regen at 18/hr over a
~2-minute run is ~0.6 energy and would not land on exactly −1 three times.

**Candidate explanations, none confirmed:**
1. A juiced entry costs 59, not 60, and `energyCostPerRun × JUICED_COST_MULTIPLIER`
   is off by one. This would mean the guard has been over-charging the budget
   by 1 per juiced run all along — conservative, so it has never failed loudly.
2. The pool read is floor/truncated somewhere and 60 spent from a pool with a
   fractional regen component reads as 59.
3. `start_run` refunds or rebates 1 under some condition.

**Cheapest resolution, zero energy:** read `GET /offchain/player/energy`
immediately before and immediately after a juiced `start_run` with nothing else
in flight, and compare against the same pair around a PLAIN (20-energy) run.
If plain runs drift 0 and juiced drift −1, it is the multiplier (1). If both
drift −1, it is the read (2). No extra entry is needed — the next juiced run
that happens for any other reason can carry this.

**Not urgent.** The guard enforces off COMMITTED spend (CODEXREVIEW #8), so the
error is conservative in the safe direction: the bot believes it has spent
slightly more than it has and stops slightly early.

**[session 54] The probe is BUILT and ARMED; it has not fired.** `LiveRunDeps.
energyProbe` reads the pool immediately before and immediately after the
`start_run` POST with nothing else in flight and logs
`start_run_energy_probe` with `tightDelta`, `estimatedCost` and
`matchesCommitted`. Two GETs, zero energy, on every real run.

Rule 11 removed the plain-20-energy comparison arm this section originally
proposed — there are no plain runs any more — so the discriminating read
changed shape and no longer needs one:

- **tight `-59`** -> the CHARGE is 59, not the accounting, and the 3x
  multiplier is the suspect (59 = 20x3 - 1).
- **tight `-60`** -> something INSIDE the run credits 1 back (a loot effect, a
  boon, a regen tick landing in the window) — a different investigation.

No run happened in session 54 (rule 11 needs per-run approval, and both daily
caps were already spent), so this carries to the next run at no cost. Do not
fix the drift before the probe says which of the two it is.

---

## §24 — Should the Hard Core orb tie-break be widened? [session 57]

**Status: RESOLVED — YES, WIDENED AND SHIPPED (session 58).** `orbRule: "wide"`
is the default in `src/strategy/boonPriority.ts` and a `config/bot.json` knob.
The user's decision was to settle it with an experiment against a rule fixed in
advance rather than by judgement, and the experiment came back decisive:

```
  scripts/orbDepthExperiment.ts, n=8000 per arm, identical seeds, paired

  B shipped (tie-break)   mean rooms 3.2776   orbs/run 60.333
  C wide                  mean rooms 3.2796   orbs/run 66.637

  depth loss (B - C):  -0.0020 rooms,  paired 95% CI [-0.0175, +0.0135]
  ship bar 0.15  |  break-even 0.292   -> the whole interval is ~11x inside the bar
  orb gain:            +6.30 per run (+10.4%)
  seeds where the arms produced an identical run: 6311 of 8000 (78.9%)
```

C is not merely no worse on depth — it is indistinguishable from B on depth
while paying 10.4% more. **Do not narrow this back without a user directive**,
the same standing the rule it replaced had.

**The stage-0 check that had to pass first, and would have voided the result.**
`applyBoon` changes player state for exactly six boon types (Heal, the three
`Upgrade*`, AddMaxArmor, AddMaxHealth); the five `rolled` types move a stat
`combat.ts` never reads, the six `latent` types hit `case "latent": break;`,
and the 36 unmodelled types return the player unchanged. So two arms differing
only on inert options are bit-identical and a null is guaranteed by
construction rather than earned. Measured: C differs from B on 34.4% of
decisions, and **25.8% of those differences touch an option that moves player
state** — the channel is open, 21.1% of seeds diverged, and the null is a real
null. The script reports this first and returns UNRESOLVED regardless of the
depth number if the channel is ever closed.

**What the result does NOT license.** The sim fights SAFE tier while live play
fights the hardest offered (rule 8), and boon quality plausibly matters more
when fights are harder. That is exactly why the ship bar was half the
break-even. A null here is evidence that C's depth cost is small under
Safe-tier conditions, not that it is zero under live ones.

--- the original session-57 write-up follows, unchanged ---

**Status: BLOCKED on a user directive. Nothing is wrong; the shipped rule works
exactly as directed and is worth almost nothing.**

The directive implemented in session 57 was: *boon priority decides first;
orbs break ties within the same priority rank; orbs never override a
higher-priority boon.* That is what shipped, and it is pinned by tests.

**Measured across all 138 recorded offers × 4 HP fractions = 552 decisions**
(`npx tsx scripts/orbTieBreakReport.ts`):

```
  payouts differ across the three options:  136 of 138 offers (98.6%), mean spread 6.22 orbs

  no option matches any priority family:    312 of 552 decisions (56.5%)
  a priority matched, but only ONE option:  224 (40.6%)
  TWO OR MORE tied at the winning rank:      16 (2.9%)   <- the shipped rule's entire surface

  A  BASELINE (priority -> rankBoons)         10256 orbs   18.580/decision
  B  SHIPPED  (priority -> ORBS -> rankBoons) 10272 orbs   18.609/decision   +16 total, pick changed on 0.7%
  C  WIDE     (NOT SHIPPED)                   11256 orbs   20.391/decision   +1000 total, pick changed on 35.5%
```

**The question for the user.** Policy C is the same field read more widely:
when NO option matches a priority family — 56.5% of decisions, where the pick
today falls through to `rankBoons` alone — take the richest option, with
`rankBoons` breaking payout ties. It never touches a decision where a priority
family IS on offer, so it still cannot override a higher-priority boon. It is
worth **+1.81 orbs per decision, 62x the shipped rule**, and for scale session
56 measured the entire enemy-tier effect on mean orbs at room 3 as +4.21.

**The cost, stated honestly.** In those 56.5% of decisions `rankBoons` is
currently choosing on modelled combat value. Policy C would override that with
orb count on 35.5% of all picks. `rankBoons` is a real scorer with a real
model behind it, so this is not free — it trades some simulated combat quality
for leaderboard currency. Whether that trade is good is a judgement about what
the account is FOR, which is the user's call and not one the corpus can settle:
the simulator can no longer separate two boon policies at n=2000 (session 56),
so there is no offline experiment that would answer it.

**Not widened unilaterally**, per the session-57 brief: *"If the tie rate turns
out to be low, do not widen the rule to make it fire. The user's directive is
tie-break only."* One sentence from the user either way closes this.

---

## §25 — the depth-matched pre-death control is a CAPTURE REQUEST, and here is its price [session 84 §4, PARKED]

**This is named as a capture, not set as a gate, because CLAUDE.md rule 6 says
to say which.** Session 82's pre-death ordering was retracted in session 83
under a within-room control: all three pre-death decisions of a run carry the
identical unmodelled set (effective n = 4, not 12), the decisions EARLIER in
the same room already read `STATUS_EFFECT` 17/24 and `ENEMY_BUFF` 0/24, and a
depth confound sits underneath — `STATUS_EFFECT`'s base rate climbs 23% (room
1) → 75% (room 8) while `ENEMY_BUFF` collapses 100% (room 6) → 0% (room 8).

**The honest replacement question** is depth-matched: does a death fight's
unmodelled set differ from a NON-death fight at the SAME room number? At the
current death distribution — rooms 7–8 in 3 of 4 recorded deaths — the controls
have to come from runs that SURVIVE past room 7, and **the corpus has none.**

**What it would cost, stated so a hard task can be told from an impossible
one.** Every dungeon run is a 60-energy juiced entry charging 3 of the daily 12
run-units (rule 11), so the ceiling is 4 runs/day. Recent juiced runs die at
rooms 7–8; to get even 8 control fights at rooms 7–8 from runs that survive
them needs on the order of **8–12 runs, i.e. 2–3 full days of the run cap**,
and that is before any of them is required to reach room 9+. Each one also
needs its own human go-ahead.

**The recommendation is to DROP it unless the user wants that spend.** It buys
one retracted finding re-asked, on a question nothing downstream is waiting on;
the same 2–3 days of run cap spent on `evSupported` telemetry or the crit rule
(§6, one base-6/8/10 crit still outstanding) buys more. **Not dropped
unilaterally** — one sentence either way closes this.

---

## §26 — should the redraw trigger be SHADOW-EVALUATED live? [session 84 §4, OPEN — needs a go-ahead, it is a live-path change]

**Session 84 makes this designable for the first time, and it needs the user's
answer before anything is written.**

**What changed.** Session 83's candidate trigger was `heldCoverage <= K AND
focusBudget >= 1`, aimed at a population of 101 dead hands (26.0% of plays) of
which only 44.6% were rescuable. Conditioned on today's policy era (§1), the
target is smaller and completely different in character: **15 dead hands, 11.8%
of plays, and `neither = 0` — every one of them is rescued by a redraw**, at a
mean 1.33 mana against a pool that discards 5.85 per cast. So the trigger's job
is no longer SELECTION (pick the rescuable dead hands out of the dead ones); it
is DETECTION (notice a dead hand at all). That is a much easier problem, and it
is the reason to ask now rather than later.

**What is being asked for, precisely.** Log what the trigger WOULD have fired
on, live, and send nothing — no redraw action, `redrawEnabled` stays false,
`REDRAW_THRESHOLD` untouched. One extra field per logged decision.

**Why it cannot be done offline.** §3's thresholds are fitted to this corpus
with ORACLE labels (they use where the fish actually went) and no held-out set,
n=15 in the conditioned arm. A shadow evaluation is the only way to get
NON-oracle labels — the trigger firing on information the bot actually has at
decision time, scored afterwards against what happened.

**The costs and the risks, stated.** It is a live-path instrumentation change
to `scripts/liveFishing.ts`, so CLAUDE.md rule 4 puts it behind a sim gate
first and rule 5 requires it to fail closed. It spends no extra casts — it
rides on casts already being played. Its risk is the ordinary one for a live
edit: a bug in the shadow path can throw inside a real cast. That is
containable (compute-and-log inside a try/catch that never fails the cast) and
it is exactly what session 68's oil shadow did, provably inert.

**The three answers this could get, all fine:** (a) yes, design it and bring
the gate back; (b) not yet, redraw is CLOSED and instrumenting a closed policy
is premature; (c) yes but only after the redraw verdict itself is revisited.
**Nothing is written until one of them comes back.**

---

## §25 UPDATE [session 85] — recommendation is still DROP, and session 85 does not change its price

Session 85 was asked to recommend §25 as a drop and does. Nothing measured
this session bears on it: §25 needs ~8-12 juiced runs (2-3 full days of the
12-unit cap, each run individually approved) to re-ask ONE retracted finding
with a depth-matched control. The price has not moved and neither has the
value. **Not dropped unilaterally — it stays parked until the user says.**

---

## §27 — session 84's open question 1 (the off-policy replay) is now WORSE-EVIDENCED, not better [session 85 §1a, OPEN — a recommendation, not a blocker]

**Session 84 asked whether replaying the corpus's decision points through the
session-60 and session-62 policies is worth a session.** Session 85 turned up
two things that lower its expected value, and neither was available when the
question was written.

**1. The commits may sit on the wrong side of the change.** The proposal rests
on the corpus's 20.3-hour empty gap (2026-08-20T18:28:24Z ->
2026-08-21T14:46:17Z) being a clean bracket containing sessions 61/62. It is
not. The overspend series (§1a) shows **the five 08-20 casts already reading
the NEW regime at -0.40, stamped 11:27 PT — BEFORE both commits (13:33 and
15:59 PT)**. At n=5 that is not evidence of anything, but it means the corpus
cannot date the change closer than "between 08-19 and 08-21", so a replay of
those two commits could compare two policies that are BOTH on the new side.

**2. The one focus-related constant in the live path did not move in that
window** — `git log -S` shows `DEFAULT_FOCUS_RESERVE_WEIGHT` touched by exactly
one commit ever, session 45's.

**But gate 2 opened a narrower question in its place, and it is cheap.** At the
shipped weight w=3 the simulator's opening spend lands **0.004 outside** today's
era's interval, against 0.207 outside at w=0. The sim at the live weight very
nearly reproduces live's pacing. So the question worth asking next is not "what
did sessions 61/62 change" but **"what makes live's EFFECTIVE focus-reserve
behaviour differ from the sim's at the same nominal weight"** — and that is a
much smaller search than replaying two whole policies.

**Recommendation: hold the replay; ask the narrower question first.** Not a
decision an agent should make alone, which is why it is here rather than in
DECISIONS.md.

---

## §26 UPDATE [session 85] — still OPEN, still needs a yes/no, and gate 2 does not touch it

Session 85 was asked to put §26 to the user and has. **Nothing has been
written**: no shadow instrumentation, no `redrawEnabled` change, no
`REDRAW_THRESHOLD` change. §7a's supporting figures are unchanged and re-pinned
by this session's suite (`wasted` structurally zero at every K because
`neither = 0`; K=7 fires 9, rescues 7, sacrifices 0, 11 mana).

The three answers in §26 above are still the three answers. **(a) design it and
bring the gate back, (b) not yet — redraw is CLOSED and instrumenting a closed
policy is premature, (c) yes but only after the redraw verdict is revisited.**
