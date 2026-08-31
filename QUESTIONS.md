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

## §19 — Should the matcher tier be DROPPED rather than mixed? [session 51 §3, **CLOSED — see the closing pointer immediately below**]

> **[session 95 §I] CLOSING POINTER — this section's body is history, not an
> open question.** The header read `OPEN` through session 94 and a backlog
> sweep had to re-derive its status from `DECISIONS.md`; this pointer exists so
> nobody does that again. The text below is left exactly as written.
>
> **§19 is ANSWERED: `KEEP`.** Closed first at `DECISIONS.md` 2026-08-21
> (session 65 §2) as a **POWERED KEEP at n=35** against
> `MIN_INSTRUMENTED_TURNS` = 32, pre-registered in that session's brief before
> the batch ran. Re-confirmed independently at `DECISIONS.md` 2026-08-23
> (session 87 §2 / GATE 1) — `KEEP`, one turn short of powered at 31, reported
> as the code returned it and explicitly **not** renegotiated; the whole-file
> scope (95 turns) returns KEEP *powered*, so both agree on direction.
>
> **Do not budget casts for §19 and do not report turn accrual** — session 66
> §4 retired the batch shape as history rather than a standing authorization.
> If a brief asks for §19 turns, this pointer is the answer.

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

## §23 — juiced runs under-report energy spend by exactly 1, every time [session 53, **CLOSED — see the closing pointer immediately below**]

> **[session 95 §I] CLOSING POINTER — this section's body is history, not an
> open question.** Same story as §19: the header read `OPEN` through session
> 94 while the answer had been in `DECISIONS.md` since session 87. The text
> below is left exactly as written.
>
> **§23 is ANSWERED: the 3x multiplier is EXONERATED** (`DECISIONS.md`
> 2026-08-23, session 87 §3 / GATE 2). The tight probe read `tightDelta -60`
> against a committed 60 on run 25035508 — §23's own pre-registered SECOND
> branch. The charge at `start_run` is exactly 60, and the standing −1 is
> credited back DURING the run. **In-run regen at 18/hr against an integer
> pool is the LEADING CANDIDATE, NOT asserted**, and the drift was
> deliberately NOT fixed because the guard enforces off committed spend
> (CODEXREVIEW #8), which is the conservative direction.
>
> **[session 95 §C2] The DIAGNOSTIC TEXT was wrong and is now fixed** —
> a separate thing from the drift itself, which stays unfixed as §23 directed.
> `describeEnergyAccounting` blamed *"possible external balance change (e.g. a
> ROM claim) landed mid-run"* and fired on 4 of 4 of session 94's runs with no
> ROM claim during any of them. It now names in-run passive regen as the
> leading candidate, matching this section's hedge exactly.

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
window.** Stated precisely, because the loose version of this claim is wrong:
`git log -S DEFAULT_FOCUS_RESERVE_WEIGHT -- src/strategy/fishing/cardChoice.ts`
returns **exactly one commit ever — session 45's `b103bf0e`, 2026-08-18 22:11**,
which is where the constant is defined. Repo-wide the same `-S` also returns
sessions 46, 47 and 50, but those are CALL-SITE changes that moved the symbol's
occurrence count, not its value. **The last of them is 2026-08-19 15:20 and the
next is this session's**, so nothing touched this symbol anywhere in the
08-20/08-21 window.

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

## §27 UPDATE [session 95 §G] — the narrower question was asked, and it narrows AGAIN: the weight is not the variable

**Time-boxed, offline, zero live spend.** The question §27 recommended asking
was *"what makes live's EFFECTIVE focus-reserve behaviour differ from the sim's
at the same nominal weight"*. The first thing to establish is what the term
does at all, and that turns out to be **structural and exactly derivable** —
no corpus and no sim needed. Three claims, all verified by exhaustive sweep and
now pinned in `tests/fishing/cardChoice.test.ts`:

**1. The `Math.max(0, …)` clamp is dead code inside the default search space.**
`bestFocusForCard` searches `reachableCells(gridSize, current, remaining)`, so
every candidate already satisfies `d <= remaining` and `left` is never
negative. Swept over grids 4/5/6, every current cell, every `remaining` 0–3:
**0 of 1912 candidates clamp.** The clamp is the term's only nonlinearity, so
with it unreachable the term is linear.

**2. Therefore the term is EXACTLY a linear movement tax, and the retention
part cancels.** Within one decision `remaining` is fixed, so

```
  w * (remaining - d) / MAX   =   (w * remaining / MAX)  -  (w / MAX) * d
```

and the first half is a constant across candidates — which cancels in an
argmax. **`focusReserveWeight` does not price retention in the ranking at
all.** Its entire effect is `-(w / FOCUS_METER_MAX) * d`. Max error over every
candidate pair on every tested grid and budget: **exactly 0**. At the shipped
`DEFAULT_FOCUS_RESERVE_WEIGHT = 3` against `FOCUS_METER_MAX = 3` that is a tax
of **precisely 1.00 EV-units per manhattan step**.

⚠ This contradicts the term's own documentation in two places.
`cardChoice.ts`'s docstring calls it a reward for what a placement LEAVES, and
`focusBudget.ts` describes it as *"a FIXED penalty proportional to budget
retained"*. Both describe the FORMULA correctly and its RANKING BEHAVIOUR
incorrectly, and the difference is the whole finding.

**3. The tax's RATE is constant but its REACH scales with `remaining`, so it is
structurally a first-turns-only effect.** The longest available move is bounded
by the meter:

```
  remaining 3   17 candidate cells   longest move 3   worst-case tax 3.0
  remaining 2   11                   longest move 2   worst-case tax 2.0
  remaining 1    5                   longest move 1   worst-case tax 1.0
  remaining 0    1                   longest move 0   worst-case tax 0.0
```

At `remaining` 0 the search space is a single cell and the term cannot
influence anything.

### What this settles: two measurements that looked contradictory are both right

- **Session 48:** `w=0` and `w=3` indistinguishable over 73 whole traces —
  measured across ALL turns, and `focusBudget.ts` records that 50.4% of turns
  in that era were played at focus zero, where the term has nothing to reach
  with.
- **Session 85 gate 2:** `w=3` lands 0.004 outside today's era's OPENING-SPEND
  interval against 0.207 at `w=0` — measured on turn 1, the only turn where
  `remaining` is 3 and the tax can apply its full 3.0 EV-units.

They are measuring different turns of a term that is only alive on the early
ones. Neither needs to be re-run and neither was wrong.

### The question that is actually left, and it is now ONE distribution

Since the tax is an identical 1.00-per-step on both sides, **the nominal weight
cannot be the source of a live-vs-sim difference.** The term changes a choice
if and only if

```
  ΔEV(best moving placement, best stay-put placement)  <  1.00 x Δd
```

so the entire remaining question is **how the ΔEV-per-step distribution at
decision points differs between live and sim** — a sharper distribution (EV
gaps well above 1.00/step) makes the term inert, a flatter one makes it bind.
That is one measurable quantity per side, not a policy replay.

### What was NOT established, per rule 6

**That distribution was not measured on either side.** Measuring it live needs
the off-policy replay machinery over the corpus, and measuring it in sim needs
`castSim`, which OIL-POLICY.md §0a suspends for this fishery — so a sim-side
number would not be quotable even once computed. §27 therefore stays a
RECOMMENDATION rather than closing, narrowed from "replay two whole policies"
to "measure one distribution, live side first". The replay is still on hold.

---

## §27 UPDATE [session 98 §C] — THE DISTRIBUTION IS MEASURED. THE TAX BINDS ON **48.9%** OF DECISION POINTS — THE SURFACE IS FLAT, NOT SHARP

**The measurement §27 was narrowed to, taken.** Session 95 §G proved the
reserve term's entire ranking effect is a linear movement tax of
`w / FOCUS_METER_MAX` = **1.00 EV-units per manhattan step** at the shipped
weight, and left one thing unmeasured: how often that tax is large enough to
change the argmax. It changes it exactly when `ΔEV / d < 1.00`.

`scripts/evPerStepDistribution.ts` (new) measures that ratio at every live
decision point, LEAVE-ONE-CAST-OUT over the clean corpus — the same
out-of-sample discipline sessions 47/49 established for logloss. **No `castSim`
quantity appears; §0a is untouched.**

### The distribution

| | whole clean corpus (207 casts) | today's era (119 casts) |
|---|---|---|
| turns replayed | 723 | 444 |
| **comparable decision points** | **583** | **334** |
| excluded — no `d > 0` candidate | 140 (19.4%) | 110 (24.8%) |
| min / p25 / **median** / p75 / max | −9.26 / 0.13 / **1.05** / 2.28 / 13.19 | −9.26 / 0.12 / **1.06** / 2.19 / 13.19 |
| mean | 1.38 | 1.34 |
| **TAX BINDS (`< 1.00`)** | **285 of 583 = 48.9%** | **160 of 334 = 47.9%** |
| INERT (`>= 1.00`) | 298 = 51.1% | 174 = 52.1% |

**The verdict the brief asked for: FLAT, decisively.** The median sits at 1.05
— essentially ON the tax — and the tax binds on very nearly half of all
decision points. This is not a term that "rarely decides anything": at the
shipped weight it is choosing the placement on roughly one turn in two where a
move is available at all. The two corpora agree to within a percentage point,
so this is not an era artefact.

### The shape by distance, and it is the sharpest thing here

Measured within-turn, best placement at EXACTLY `d` against the same stayer:

| `d` | n | median ΔEV/step | binds |
|---|---|---|---|
| 1 | 583 | 0.83 | 309 — **53.0%** |
| 2 | 460 | 0.48 | 312 — **67.8%** |
| 3 | 316 | −0.01 | 287 — **90.8%** |

**The tax is near-prohibitive on three-step moves.** At `d = 3` the median
ΔEV/step is BELOW ZERO — the best three-step placement is typically WORSE in
raw EV than staying put — and the tax binds on 91% of them. At `d = 1` it is
close to a coin flip. So the term does not merely tax movement uniformly; it
effectively removes long moves from the policy's reach, which is a much
stronger statement than "1.00 per step" reads as.

### What is deliberately NOT concluded

**No `DEFAULT_FOCUS_RESERVE_WEIGHT` is recommended, and none should be inferred
from this.** A binding fraction says how often the term is live; it says
nothing about whether its price is right. A high binding fraction is equally
consistent with "the weight is far too high" and with "the weight is doing
exactly the job session 45 swept it for". Session 85 measured the shipped
weight landing 0.004 outside the opening-spend interval against `w=0`'s 0.207,
which is evidence FOR the current value and is not contradicted by anything
here.

**And note the 19.4% exclusion before reading any of it.** Those turns have an
empty meter, no `d > 0` candidate, and pay no tax however flat their surface
is. The tax is structurally a first-turns-only effect (session 95 §G) and this
is the number that says how much of the cast it cannot reach at all.

Pinned by `tests/fishing/evPerStep.test.ts` — including a DRIFT GUARD that the
report's argmax is the cell `chooseCard` actually picks at
`focusReserveWeight = 0`, because the report enumerates the candidate surface
itself (it needs the losers, and `bestFocusForCard` returns only a winner) and
two enumerations of "the same" surface are exactly what silently diverges.

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

---

## §26 ANSWERED [session 85, user directive 2026-08-23] — (c) YES, BUT ONLY AFTER THE REDRAW VERDICT IS REVISITED

**The user picked option (c).** The shadow evaluation is wanted, and it is
**gated behind reopening the CLOSED redraw verdict** — not behind another
measurement of the trigger.

**What this settles.** §26 is no longer an open yes/no. Nobody needs to ask
again whether to instrument; the answer is yes.

**What it does NOT authorise, and this is the part to hold.** Nothing about the
shadow path may be written yet. The ORDER is the directive: revisit first,
instrument second. An agent that finds the redraw revisit hard and writes the
shadow instrumentation anyway has inverted the one thing the user specified.
`redrawEnabled` stays false and `REDRAW_THRESHOLD` stays untouched throughout
— revisiting a verdict is not flipping it, and only the user flips it.

**So the prerequisite is now a task, and it is the next fishing task.** The
redraw verdict was closed on a price of 43.9 mana against 10, and session 83
§1c already found the denominator suspect: over 147 resolved casts the mana
pool ends with a mean 5.85 spare, median 7, and **89.8% of casts end with mana
left over** — the resource redraw was priced against is not the scarce one.
Session 84 then found the counterfactual INVERTS on today's era (availability
88.2% -> 97.6%, `neither = 0`, mean rescue cost 1.33). Neither of those was
available when the verdict was taken.

**What a revisit must NOT be.** It is not a re-run of the counterfactual — that
is done, twice, and pinned. It is the argument about **which scarcity a redraw
should be priced against**, assembled from what is already measured, put to the
user as a recommendation with its own uncertainty stated (the rescue rate is
`15/15`, 95% CI [79.6%, 100.0%], n=15 — an interval, never a point). The
verdict is the user's to change, as it was the user's to set.

**Standing constraints, unchanged by this answer:** rule 4 puts any live-path
edit behind a sim gate; rule 5 requires it to fail closed; the shadow path when
it is eventually written computes-and-logs inside a `try/catch` that can never
fail a cast, as session 68's oil shadow did.

---

## §28 — the REDRAW VERDICT REVISIT, delivered [session 86 §2 / GATE 2, **ANSWERED 2026-08-23 — see §28 ANSWERED below**]

**Every number below is computed on `CORPUS-2026-08-23A`** — 148 traces / 612
plays / 147 resolved, the fishing corpus as of
`createdAt <= 2026-08-23T00:20:47.236Z`, rostered in
`handoff/reports/session-86-corpus-snapshot.md`. That snapshot was pinned in
session 87 §1 **before** that session's 20-cast batch, precisely so this
question keeps being asked about the corpus it was asked on. The corpus has
grown since; **these figures have not been recomputed and must not be.**

**The memo is `handoff/reports/session-86-redraw-revisit.md`.** It is the
prerequisite the user set when answering §26: revisit the closed redraw verdict
first, instrument second. It is delivered here rather than summarised, because
every quantitative claim in it carries its instrument and that instrument's
distance from live, and stripping those is what produced the verdict being
revisited.

**Nothing changed.** `redrawEnabled` is false, `REDRAW_THRESHOLD` is 0 and
untouched, no live-path line moved.

### The recommendation, in one line

**Re-price the verdict; do not reverse it.** Keep redraw CLOSED, retire "43.9
mana per extra fish against a cast holding 10" as the stated reason, and restate
the reason as **no validated trigger + two unpaid correctness gaps**.

### Why the old reason should be retired

- **43.9 was derived on `castSim`'s `SIM bare` arm** — margin **+41.9pp** over
  its own break-even against live's **−0.7pp**, an ORACLE matcher
  (`matcherPool` defaults to `truePool`), redrawing 27.3% of turns where the
  live bot redraws 0. `OIL-POLICY.md` §0a suspends that arm for this fishery.
- **It prices redraw against mana, which the corpus says is not scarce.**
  Pooled 132/147 (89.8%) of resolved casts end with mana to spare, mean 5.85;
  **today's era 48/54 (88.9%), mean 6.26, median 7** — the era split is new in
  this memo and the argument holds on both sides of it. Instrument: the corpus.
  Distance from live: none.
- **The binding resource is fish-HP headroom** — 6.8 HP opening, 3.02 heal per
  miss, ~2.3 net misses — **and a redraw takes no shot, so it cannot miss.** Its
  entire cost is mana plus a fish step; `fishHp` does not move in either
  direction (SPEC-fishing §7a, user-confirmed from their own play).
- **[session 86 §1] No sim arm could re-derive the price honestly.** `SIM bare`
  is the oracle arm above; `SIM blind` **never aims** — 0 focus moves in 1963
  turns, all 763 plays from (2,2), damage/hit 3.66 against live's 5.10;
  `SIM live-config` is closest and still +4.0pp. They fail in OPPOSITE
  directions, so there is nothing to average. **"Re-run it properly in sim" is
  not an available option.**

### Why it should NOT be reversed

- The rescue evidence is **`15/15`, 95% CI [79.6%, 100.0%], n = 15** — never to
  be written as 100% — and it is AVAILABILITY under an ORACLE lens, not hits.
- **No trigger has been validated out-of-sample.** `heldCoverage` separates at
  AUC 0.922 but is fitted to this corpus with oracle labels, n=27 in the
  conditioned arm.
- **Two unpaid correctness gaps**, both live-path, both blocking:
  **(1)** `liveFishing.ts:2471` — a redraw fires `FISH_MOVED` and the branch
  does not observe it, so the matcher's history keeps a hole; the fix is a
  choice between two unmeasured semantics, not a repair.
  **(2)** `liveFishing.ts:1526` — `MAX_REDRAWS_PER_CAST = 5` is a fail-closed
  `GuardTrip` that ABORTS the cast, and since a redraw does not advance `turn`
  it is the only bound there is. A real per-cast budget with a fall-through to a
  play does not exist.

### Measured for this memo, and it corrects the session-86 brief

**How often the shipped trigger actually wants a redraw**, from the bot's own
live logs (union of `redraw_indicated_not_sent` and `redraw_suppressed` —
counting only the newer event would date a policy change to the session that
renamed it, rule 10):

```
  today's era   26 of 204 decisions   12.7%
  before        93 of 245 decisions   38.0%
  pooled       119 of 449 decisions   26.5%
```

The brief says the shipped threshold wants one on "~3.5% of turns". **That is
not supported** — the measured rate is 12.7% in today's era. It is still
affordable (~1 mana per cast against 6.26 spare), and it says nothing about
whether the trigger fires on the RIGHT turns: it fires at about the rate dead
hands occur (12.7% against 11.8%) and **nothing establishes they are the same
turns.** That overlap is cheap and unmeasured.

### THE QUESTION

**Do you accept re-pricing the verdict — redraw stays CLOSED, "43.9 against 10"
stops being the stated reason, and the reason becomes "no validated trigger plus
two unpaid correctness gaps"?**

- **(a) Yes.** Then §26's shadow evaluation is unblocked and becomes the next
  fishing task in its own right — it is the instrument that produces the
  out-of-sample trigger evidence the restated reason names, and it spends
  nothing live beyond a log line.
- **(b) No — the original price stands as the reason.** Redraw stays closed
  either way; this memo becomes a record of why the price is weak.
- **(c) Something else** — including "closed, and stop revisiting it", which is
  a legitimate answer and would retire the whole line of work.

**An agent must not answer this.** The verdict was the user's to set and is the
user's to re-price. Until an answer comes back, `redrawEnabled` stays false,
`REDRAW_THRESHOLD` stays untouched, and **no shadow instrumentation gets
written** — the order was the directive.

---

## §28 ANSWERED [session 89, user directive 2026-08-23] — (a) ACCEPT THE RE-PRICING

**The user's ruling, verbatim:**

> *"Accept the re-pricing — keep redraw closed, but retire '43.9 mana per extra
> fish' as the stated reason and restate it as 'no validated trigger + two
> unpaid correctness gaps.'"*

**What this changes: the STATED REASON, and only that.** From this point the
reason redraw is closed is **no validated trigger + two unpaid correctness gaps
(both fixable offline, neither fixed)**. "43.9 mana per extra fish against a
cast holding 10" is retired as a justification wherever it was doing that job.

**What it does NOT change, and this is the half a later reader will get wrong.**
The verdict itself was never in question in either direction. `redrawEnabled`
stays **false**, `REDRAW_THRESHOLD` stays **0 and untouched**, and no live-path
line moved in session 89 any more than it did in session 86. Re-pricing a
verdict is not weakening it — under the restated reason the two correctness gaps
at `scripts/liveFishing.ts:2471` and `:1526` are now the *named* blockers rather
than a supporting detail, which if anything makes the closure more concrete.

**43.9 is retired as a REASON, not deleted as a MEASUREMENT.** Session 75
measured it and session 86 dissected it; every sentence reporting it as
*"this is what session 75 measured, on `castSim`'s suspended `SIM bare` arm"*
stays exactly as written. What gets replaced is any sentence using it to answer
*"why is redraw closed today?"*

**§26's shadow evaluation is now UNBLOCKED.** The prerequisite the user set when
answering §26 — revisit the verdict first, instrument second — is met. The
shadow evaluation is the instrument that would produce the out-of-sample trigger
evidence the restated reason names as missing, so it is the natural next fishing
task. **It was deliberately NOT started in session 89**, per that session's
brief: it is a large enough piece of work to deserve its own brief rather than
being bolted onto a cleanup session, and starting it badly is worse than
starting it next.

**Unchanged standing constraints:** rule 4 puts any live-path edit behind a sim
gate; rule 5 requires it to fail closed; the shadow path, when written, computes
and logs inside a `try/catch` that can never fail a cast, as session 68's oil
shadow did.

---

## §28 UPDATE [session 95 §F] — one of the two correctness gaps is PAID, the other is capped as far as it can be offline

**`redrawEnabled` is still `false` and `REDRAW_THRESHOLD` is still `0` and
untouched.** Neither was edited, under any framing. The restated reason for the
closure — *no validated trigger + two unpaid correctness gaps* — becomes **no
validated trigger + one unpaid correctness gap**, and the trigger half is
untouched, so **the verdict does not move.**

### GAP 2 (`MAX_REDRAWS_PER_CAST`, the abort) — PAID

The cap threw a `GuardTrip` and ABORTED the cast, which handled a policy
ceiling — an expected state — as a rule-5 unexpected one. A cast is a unit of a
capped daily allowance; discarding one because the policy wanted a sixth redraw
destroys more than it protects.

**The comparison this brief suggested was checked before being leaned on, and
it holds.** The per-cast OIL cap (`reason: "per_cast_cap"`) logs the third
state, prints *"playing on without it"*, and continues the cast; its own comment
says *"The cast CONTINUES and the batch does NOT halt. A ceiling reached is an
expected state, not a rule-5 unexpected one."*

The one constant was doing two jobs and is now two:

- `REDRAW_BUDGET_PER_CAST` (5, **number unchanged and still uncalibrated**) —
  the policy ceiling. It is now part of the redraw branch's own CONDITION, so
  exhausting it falls through and PLAYS the already-chosen card. That keeps the
  cast alive AND advances `turn`, so the spin `MAX_TURNS` could not bound is
  bounded structurally rather than by an abort.
- `REDRAW_RUNAWAY_GUARD` — the fail-closed backstop, **unreachable by
  construction** under the fall-through, kept as an assertion: if it ever fires,
  the fall-through is broken, and that IS a rule-5 unexpected state.

A distinct `redraw_budget_exhausted` event carries the reason, never folded into
`redraw_suppressed` — session 62's lesson about an unflagged reason poisoning a
rate for 40 casts. ⚠ **`redraw_suppressed`'s existing reason string was left
byte-identical on purpose** (rule 10): the 449 decisions this memo counts are
keyed on it, and moving it would date a policy change to the session that
renamed the field.

### GAP 1 (`FISH_MOVED` unobserved) — NOT CLOSED, and deliberately not

**The two candidate semantics were already named concretely**, in the code
itself, by session 78 §6 — this brief's request to articulate them turned out
to be already satisfied:

  **(a)** redraw is a turn the predictor learns from — observe the moved cell
  with no placement, increment `turn`. Matches the sim's bookkeeping; changes
  how the predictor is fed.
  **(b)** redraw is a turn the predictor SKIPS — leave both alone, accept the
  hole. **What ships, still.**

Neither has been measured and session 95 did **not** choose. What it did is the
only part of this gap that can be paid offline: the `redraw_sent` log line now
carries `fishFrom`, `fishTo` and `observedByMatcher: false`. **Recording is not
choosing** — nothing reads those fields, the matcher is untouched, `turn` is
untouched, and a reader who takes their presence as a lean toward (a) has it
backwards. They exist so the recalibration can compare (a) and (b) on evidence
instead of on feel, rather than having to generate that evidence from scratch.

**What would actually close gap 1:** the §26 shadow evaluation, or the
recalibration itself. Both need live casts with redraw armed or shadowed, which
is why neither happened in a zero-spend session.

⚠ **Everything above is unit-tested against a path that NEVER RUNS LIVE.** The
tests reach it only by forcing the dep on. That is coverage, not live
validation, and `tests/fishing/redraw.test.ts` says so in its own text.

---

## §29 — a cast can be dealt the BASE DECK with the rod still equipped, and nothing in this repo knows why [session 89 §2, OPEN — needs one live read, not a run]

**Found while fixing what STATE.md called "`REAL_DECK` no longer matches the
account's rod". That description was wrong**, and the way it was wrong is the
finding: `REAL_DECK` matches the rod fine. What broke is the independent
PLAY-side assertion in `tests/fishing/rodDeck.test.ts`, and the claim it encoded
— *"every cast's `fullDeck` opens with exactly the granted set"* — is false.

### The counterexample, which is about as tight as a corpus can produce

Two consecutive casts, **15 seconds apart**, with a **byte-identical
`GEAR_CID_array`** — same instances, same mint stamps:

```
  2026-08-24T00:01:31.205Z   fullDeck [74,75,76,78,1,2,3,4,5,6,29]   Shroom grant
  2026-08-24T00:01:46.915Z   fullDeck [ 1,2, 3, 4,5,6,7,8,9,10,29]   BASE_DECK
```

Same node (5), same `LEVEL_CID` (20), same `day` (20688), same juice, same
multiplier, same looted tail card (`29`). Nothing on the doc distinguishes them.

### What is established

- **It is not a third rod.** All eight rods in `/offchain/static` were checked
  (49 Wood, 50 Stone, 336 Phin's, 811 Shroom, 812 Golkan, 922 Makeshift, 923
  Dendren, 924 Puppeteer's). **None grants `[1..10]`.**
- **`[1..10]` is the un-bonused deck.** 7/8/9/10 cover exactly the hit zones
  74/75/76/78 do — `[1,3,7,9]`, `[2,4,6,8]`, the eight-cell ring, and the
  centre-crit card — with strictly worse hit and miss numbers. The rod grant
  upgrades four cards in place; a base window is those four un-upgraded.
- **It has happened twice and the first window ENDED.** 2026-08-17T05:57:37.799Z
  (also gear-identical across the flip, 21 casts, Makeshift era) and
  2026-08-24T00:01:46.915Z (17 casts, current). The 2026-08-17 window ended and
  the rod deck came back on 2026-08-18. **So this is an intermittent STATE, not
  a rod change** — which is why `REAL_DECK` was NOT repointed to it.
- **`GEAR_CID_array` never identified the active rod.** It carries Stone Rod
  (50) alongside Shroom Rod (811) on every recent cast. The old test only ever
  saw one rod because `latestRodObservation` filters to `ROD_CARD_GRANTS`, which
  lists two of the eight.
- **38 of the corpus's 149 casts were dealt `BASE_DECK`** and no figure in this
  repo has ever said so. They are neither Makeshift-era nor Shroom-era traces.

### What is NOT established, and is not guessed at

The cause. Durability or charges running out, a per-day grant allowance, a
server-side equip that `GEAR_CID_array` does not reflect, and a plain server bug
are all consistent with the above, and **nothing in the fixtures separates
them**. SPEC §4d's standing rule applies: do not infer a mechanic from what it
resembles.

### THE QUESTION — and it is cheap

**When you are next in the game, is the Shroom Rod still equipped and does it
show durability, charges, or a per-day limit?** One look at the rod in the
fishing UI answers this at zero cost and would separate every hypothesis above.

Failing that, the offline half — **does a base window start at a fixed cast
count into a day?** — is measurable from the corpus now (2026-08-17 flipped 4
casts in, 2026-08-24 flipped 3 casts in) but n=2 establishes nothing, so it is
recorded as an observation rather than run as an analysis.

### Consequence to carry meanwhile

**A sim figure quoted against recent live play is quoted against the wrong
deck.** `REAL_DECK` is the Shroom grant; the account's most recent 17 casts were
dealt `BASE_DECK`. This is the Makeshift/Shroom break a second time, and it has
the same rule: **say which deck a comparison used.** `rodDeck.test.ts` now
asserts out loud which window the corpus's latest cast is in, so the fact is
recorded rather than inferred.

---

## §30 ANSWERED [session 90, user directive 2026-08-24] — WIRE THE DOUBLE-LETHAL OIL TRIGGER LIVE, OVERRIDING THE SIM'S OWN RECOMMENDATION

**This is not the sim's recommendation. It is the account owner overruling it,
knowingly, on a value the sim does not price.** Both halves are recorded here
so that nobody reading this later mistakes the wiring for an endorsement.

**The user, verbatim:**

> "I want to authorize the bot to use 2x relaxing oil if it will be lethal and
> it is not confident in catching with mana."

**What `handoff/OIL-DOUBLE-LETHAL.md` concluded, unchanged and not softened:**
**RECOMMENDED AGAINST.** At n=8000 paired seeds, `held = 2`,
`double-lethal(r=1)` catches **95.03%** against `on-demand`'s **94.90%** —
**+0.13pp for 1409 extra oils, i.e. 140.9 marginal oils per extra fish against
a bar of roughly 12.** More than 11x over the bar. Nothing about that number
has been re-run, revised, or re-interpreted; it stands exactly as session 89
published it.

**The two claims are not actually in conflict, which is the point.** The sim
prices oils-per-fish. The user is buying something the sweep never scored: a
**guaranteed** catch in the 3–4 `fishHp` band on turns when the bot's own best
affordable card cannot guarantee one. `bestKillProbability` at those turns is
bimodal (36.20% exactly 0, 57.98% exactly 1 — session 89 §6), so the trigger
withholds on 58% of band turns and fires on the turns where the alternative is
genuinely a coin-flip rather than a near-certainty. Valuing certainty over
throughput is a preference, not an arithmetic error, and it is the account
owner's to hold.

**What this authorizes, precisely.** Trigger SELECTION only:
`scripts/liveFishing.ts` now calls `doubleLethalTriggers` where it called
`onDemandTriggers`. It is **not** a budget change — `dendren.oils.policyApproved`
was already `true` (session 62) and `perItemMaxPerCast["937"] = 2` has been set
since session 69 §4 on the user's own earlier directive. Every existing
single-oil behaviour is preserved byte-for-byte, because `doubleLethalTriggers`
calls `onDemandTriggers` internally as its base case and returns it unchanged
on every state outside the band.

**What it does NOT authorize:** any change to the Focus arm, any second oil
outside the band, any new fitted constant (the cutoff is
`RECOMMENDED_NECESSITY_THRESHOLDS.relaxing = 1`, reused, not invented), and no
forced live fishing batch to exercise it.

**⚠ The first live firing has not happened yet.** Sim estimate: the band arises
on 8.27% of decisions and the trigger fires on 3.48%. Whichever session sees it
first must report the full response pair in detail — both `use_fishing_item`
POSTs, both slots, the `fishHp` trajectory, and whether `COMPLETE_CID` landed
on the second — not a line item. This is the first time real oil stock moves
through a path nothing has exercised live.

---

## §31 — THE LIVE DAMAGE DRIFT CHANGED SIGN, AND IT IS A DECK-POOLING ARTEFACT [session 90 §3, OPEN — needs a ruling, three tests are RED until it comes]

**What happened.** Session 90 was authorized to regenerate six files of
"ordinary corpus-count drift", each to be checked first. Five were drift.
`tests/fishing/damageEconomy.test.ts` was not, and it is **left failing on
purpose** rather than folded into the mechanical batch.

`LIVE.drift` — the quantity two of its tests call **THE FINDING** — was
positive (asserted `> 0.05`, docblock cites `+0.19`) and is now **−0.0316**.

**The cause, measured not guessed.** Split the 167 clean traces by the deck
they were actually DEALT — the split session 89 §2 found, and which
DECISIONS 2026-08-23 says to always state:

```
 dealt deck        casts  plays   hitRate   meanDmg  meanHeal    drift
 base [1..10]         22     74    18.9%      4.571     3.000   +1.568
 non-base            145    622    39.9%      5.210     3.086   -0.222
 POOLED (= LIVE)     167    696    37.6%      5.176     3.074   -0.032
```

**The two arms have OPPOSITE drift signs and nearly cancel.** So *"the fish
gains HP in expectation"* was never a fact about the fishery — it is what
pooling a low-hit-rate base-deck window into a rod-deck corpus produces. Held
to one deck the live fish LOSES HP, the **same sign** as the sim's bare arm.
Seen by batch instead of by deck: the 146 older clean traces drift **+0.079**,
the 21 newest **−0.787** (hit rate 47.2% vs 36.2%). One batch flipped it.

**Three published claims are affected, each differently:**

1. *"the fish gains HP in expectation"* — false as stated, and **meaningless**
   on the pooled corpus, which is two fisheries.
2. *"the clamp is real but small"* — the unclamped drift is **−0.0014**,
   indistinguishable from zero. The clamp claim survives; its `> 0` term does not.
3. *"the bare arm's drift is NEGATIVE where live's is positive"* — the
   CONTRAST breaks. Both are negative. Magnitudes still differ by an order of
   magnitude (−0.222 vs < −2), so **"not the same fishery" survives; "opposite
   signs" does not.**

**Why this needs the user.** It bears on `OIL-POLICY.md` §0a. The suspension of
+19.40pp rests partly on live and sim being different fisheries, and the single
cleanest expression of that was the opposite drift sign. That argument now
needs the MAGNITUDE. **§0a is not lifted and nothing here argues it should be**
— but the reason it stands has changed, and a reason that changes silently is
worse than one that fails loudly.

**The question, and it is a choice between two real edits to a published
claim:**

- **(a)** Re-pin this file on the **deck-conditioned** figures — measure the
  non-base arm and the base arm separately, and retire the pooled `LIVE`
  constant. Most honest; changes what the file measures, and re-baselines
  anything downstream that quotes `LIVE`.
- **(b)** Keep the pooled measurement and **re-state the findings around
  magnitude** rather than sign — "live's fish is destroyed an order of
  magnitude slower than the sim's" instead of "live's drift is positive".
  Smaller edit; keeps a pooled number that mixes two regimes.
- **(c)** Something else, including leaving it red until the deck question
  (§29) is answered — the base-deck window is still unexplained, and if it
  turns out to be a bug or a transient the right split may change.

⚠ **§29 is upstream of this.** Until it is known why casts get dealt the base
deck, it is not certain the base arm is a legitimate population at all.

---

## §29 ANSWERED [session 91, user 2026-08-24] — THE ROD RAN OUT OF DURABILITY

**The user's own words, unprompted by any options put in front of them:**

> "Casts were dealt the base deck because my shroom rod ran out of
> durability and I didnt notice. Rod has been repaired and will be good for
> another 40 casts."

### What this establishes

**Durability.** Of the four hypotheses §29 listed and refused to choose
between — durability/charges, a per-day grant allowance, a server-side equip
`GEAR_CID_array` does not reflect, and a plain server bug — it is the first.
The other three are eliminated.

This also explains the shape of the evidence that made §29 confusing. A
durability counter is a property of the ROD INSTANCE, not of the equip state,
which is exactly why two casts 15 seconds apart with a byte-identical
`GEAR_CID_array` could be dealt different decks. The gear array was never wrong;
it was answering a different question ("is this rod equipped") from the one the
deck answers ("does this rod still have charges").

**It will recur.** This is not a one-off to be written off. The rod has been
repaired, so the current base-deck window is closed, but the mechanism is
standing and the next window arrives when the repair is used up. The user's own
estimate is **~40 casts** of headroom from 2026-08-24.

### What is still NOT tracked, and this is the part to carry forward

**Nothing in this repo can see durability.** There is no durability, charge, or
uses-remaining field anywhere in the fixtures or in the live doc shape —
`GEAR_CID_array` carries instance ids and mint stamps, `fullDeck` carries the
dealt deck, and neither carries a counter. So this repo **cannot predict the
next base-deck window before it happens**; it can only detect one after the
fact, by the deck it was dealt.

**The account owner is currently the only durability sensor that exists.** The
"~40 casts" figure is the user's report about their own equipment, not a repo
measurement, and it must not be restated as one.

The detection side is in place and needs no changes: `KNOWN_DEALT_DECKS` already
treats a `BASE_DECK` deal as a legitimate, ratchet-passing state (session 89),
and `rodDeck.ts`'s `dealtDeck` / `splitByDealtDeck` (session 91) name the split
so any script can exclude a base window rather than pool it. That was the right
shape independent of the cause and it stays right now the cause is known.

### One thing the answer does not literally cover

The user's words are about the **Shroom** rod, which dates the 2026-08-24
window. The corpus holds a **second** base window, 27 casts on 2026-08-17, in
the **Makeshift** era. Same signature, one rod earlier, and consistent with the
same mechanism — but that is inference and is recorded as inference. Nothing in
session 91's work depends on it: the split classifies on the deck actually
dealt, which is observable, rather than on a cause, which is not.

---

## §31 ANSWERED [session 91, user directive 2026-08-24] — (a), NARROWED: EXCLUDE THE BASE-DECK CASTS AS A CLOSED EQUIPMENT-FAILURE POPULATION

**Recorded as a choice made among options, not as spontaneous user language.**
Three options were put in front of the user, tracking §31's own (a)/(b)/(c)
reworded to fold in §29's answer. The choice:

> **Exclude the base-deck casts from the headline figure as a distinct,
> now-closed equipment-failure population; keep their numbers as a dated
> historical note; do not stand up a second permanently-tracked line.**

(b) — keep pooled and restate around magnitude — was not chosen. (c) — formally
re-pin two permanent tracked figures — was not chosen.

### This is NOT quite §31's original option (a), and the difference is §29

Option (a) as written treated the base-deck arm as a possible second
**legitimate fishery**, worth tracking side by side indefinitely. §29's
durability answer removes that framing: the base-deck window is not a second
fishery, it is an **equipment-failure interval** — real casts dealt a worse deck
because the rod had run dry. So the treatment is "drop it from the corpus this
file measures, keep the number as a dated closed note, and expect it to recur"
rather than "track two fisheries forever."

**Excluding it is not a judgement that the data is bad.** It is real play. It is
excluded because it is a different, closed population.

### ⚠ TWO CORRECTIONS TO SESSION 90's OWN TABLE — do not restate it

§31's table above was recomputed this session through `splitByDealtDeck`, and it
does not reproduce.

```
                     session 90 said        session 91 measures
  base                22 casts /  74 plays   44 casts / 157 plays
  non-base           145 casts / 622 plays  123 casts / 539 plays
  POOLED             167 casts / 696 plays  167 casts / 696 plays   (agrees)
```

The pooled totals agree exactly, so it is the **split** that was wrong, not the
corpus. Session 90's base row is also internally inconsistent with any single
classification: its play count (74) matches only the 2026-08-24 window, while
its hit rate (18.9%) and drift (+1.568) match only the 2026-08-17 one.

The classification used this session is deterministic and was validated before
anything was pinned on it: exactly **three** distinct opening prefixes exist in
the corpus (Makeshift grant 81 casts, base 44, Shroom grant 42), every trace's
prefix is **identical across all of its own turns** (0 of 167 vary), and
`splitByDealtDeck` leaves **0 casts unclassified**.

**The second correction matters more: the base arm is not one population
either.** Measured by date it is two windows that barely resemble each other:

```
  window        casts  plays  hitRate    drift
  2026-08-17       27     83    15.7%   +1.735   (Makeshift era)
  2026-08-24       17     74    50.0%   -0.797   (Shroom era)
  base, pooled     44    157    31.8%   +0.541
```

So "the base deck drifts positive" is itself a pooling artefact one level down,
and the 2026-08-24 window landed shots **more** often than the rod-dealt corpus
does (50.0% against 39.3%). **`BASE_ARM.drift` may not be quoted as a property
of playing without a rod bonus.**

### THE CORRECTED FIGURES, and the reversal they carry

```
  arm                          casts  plays  hitRate  meanDmg  meanHeal    drift
  LIVE (rod-dealt)               123    539    39.3%    5.146     3.009   -0.1985
  LIVE rod-dealt, UNCLAMPED      123    539    39.3%    5.434     3.180   -0.2078
  SIM bare arm (n=400)             —      —    81.6%    5.012     3.225   -3.4925
```

**The correction does not shrink the old claim toward zero — it reverses it.**
"The fish gains HP in expectation" was carried entirely by the base-deck
windows. Held to the casts a rod was actually working on, the live fish LOSES
HP, the **same sign** as the sim's bare arm.

Effect on the three claims §31 listed:

1. *"the fish gains HP in expectation"* — **reversed**, not merely retired. The
   live fish loses ~0.20 HP per play.
2. *"the clamp is real but small"* — **survives, and came out STRONGER.** Pooled,
   the clamped and unclamped readings were −0.0316 and −0.0014: same side of
   zero but a factor of twenty apart, both indistinguishable from nothing. On
   the rod-dealt arm they are −0.1985 and −0.2078 — agreeing to within a
   hundredth of an HP, on a quantity large enough for the agreement to mean
   something.
3. *"the bare arm's drift is NEGATIVE where live's is positive"* — the CONTRAST
   is gone; both are negative. **"Not the same fishery" survives on the
   MAGNITUDE**: −3.49 against −0.20, a factor of ~17.6.

### `OIL-POLICY.md` §0a — verified, and it needs NO edit

Session 90's docblock warned §0a's "different fisheries" argument would need
restating around magnitude rather than sign. **Checked against §0a's actual
text: it never cited the drift at all** — the words "drift", "damageEconomy",
"gains HP" and "opposite sign" appear nowhere in `OIL-POLICY.md`. §0a rests
entirely on meter-out (1.0% sim against 64.2% live) and catch (~70% against
27.6%), both of which are untouched by this ruling.

**§0a is NOT lifted, +19.40pp still MAY NOT BE QUOTED.** The reason it stands is
the same reason it always stood, and the worry that it had silently changed was
itself the thing that needed checking rather than acting on.

---

## §32 — THREE CLAIMS IN `castEra.test.ts` ARE DEGRADING MONOTONICALLY WITH EVERY BATCH, AND ONE HAS NOW BROKEN A LOAD-BEARING CONTROL [session 91 §3, OPEN — needs a ruling, one test is RED until it comes]

**What happened.** Session 91's authorized ten-cast batch grew the corpus 168 →
178. Most pin files moved by pure census drift and were regenerated after
individual checks. `tests/fishing/castEra.test.ts` did not behave like the
others, and the way it differs is the finding.

### The pattern — three separate claims, one direction, three consecutive batches

```
  claim                                 s84/86      s89        s91
  budget-zero ratio before/today        ~30x        6.48x      3.92x
  redraw rescue rate, today's era       15/15 100%  26/32 81%  30/42 71%
  `wasted` values across the sweep      {0}         {0,3,4,5,6} {0,3,6,7,9,10,11,12}
  meanOptimal gap between eras          —           0.0062     0.0250  ⚠ BOUND 0.01
```

Each of these was **retracted or weakened once already** (session 89 retired
"THIRTYFOLD", retired `neither = 0`, retired `wasted` being structurally zero,
and replaced 15/15 with an interval). Session 91 finds every one of them moved
further in the same direction. **That is not four coincidences; it is one fact
about the era predicate showing up in four places.**

### The likely mechanism, stated as a hypothesis and not implemented

`before` is frozen history. `today` is an era that keeps absorbing every new
batch. Every claim above was first pinned when `today` held 54 casts; it now
holds 84. So the pattern is consistent with **the original pins having been
small-sample artefacts of a young era**, with each batch pulling them toward
their true values. Under that reading nothing is wrong and the numbers are
simply converging — but that is exactly the reading that would justify bumping
them forever, so it is the one that most needs checking rather than assuming.

The competing reading is that "today's era" is no longer one policy era at all.
It has spanned the oil era, the session-90 double-lethal wiring, the rod
durability window (§29) and its repair. A predicate that was a policy boundary
when it was written may now just mean "recent", which would make every
era-conditioned number in this file a pooled quantity of the same kind §31 just
ruled on.

### ⚠ THE ONE THAT IS RED, and why it was not bumped

```
  expect(Math.abs(over.before.meanOptimal - over.today.meanOptimal)).toBeLessThan(0.01);
  // before 0.656, today 0.662 -> 0.631.  gap 0.0062 -> 0.0250.
```

Session 89 called this **"the single most important thing in the file that did
NOT move."** It has moved, and it is load-bearing rather than descriptive. The
section's argument is: the cheapest move that COULD have worked is the same in
both eras → the eras do not differ in difficulty → **the entire difference is
OVERSPEND** (the assertion immediately below it). That syllogism needs the two
`meanOptimal`s to agree.

**The conclusion is probably not overturned** — an 0.025 gap is small beside the
overspend gap it explains (0.897 against 0.176). But widening the bound to 0.03
would convert a falsified premise into a passing test, which is precisely what
session 90 refused to do on `damageEconomy.test.ts` and what rule 9 forbids. So
it stays red.

### THE QUESTION

- **(a)** Re-pin all four on the current corpus and accept that these are
  converging small-sample estimates. Cheapest; treats the era predicate as
  sound. Requires someone to say out loud that the bound was descriptive, not
  load-bearing — which contradicts how session 89 described it.
- **(b)** Re-specify the era predicate, on the same logic §31 was ruled on: cut
  "today" at a policy boundary that is still meaningful (the oil era, or the
  double-lethal wiring) rather than letting it accumulate everything recent.
  Most honest; re-baselines every number in this file.
- **(c)** Something else, including splitting the control out as a standing
  tracked series rather than a bound, so its drift is visible without gating
  the suite.

**Not urgent in the sense that anything downstream is spending on it** —
`castEra.test.ts` feeds no live decision. Urgent in the sense that it is one
test away from being bumped silently by whoever next runs a batch, which is how
the "thirtyfold" claim survived three sessions past its evidence.

---

## §32 ANSWERED [session 92, user directive 2026-08-24] — (b) RE-SPECIFY THE ERA PREDICATE. IT IS A CONSUMABLE-SUPPLY BOUNDARY, NOT A POLICY DATE, AND THE FOUR DEGRADING CLAIMS WERE DILUTED RATHER THAN DYING

**The choice.** Session 91's STATE.md was walked through with the user in chat.
§32 offered three options; the user was shown all three (plus "leave it open,
it isn't gating anything") and chose **(b) — re-specify the era predicate**.
Recorded as a choice made among options offered, per the §31 convention.

**The brief's two candidate boundaries were both WRONG, and the corpus said so
before anything was implemented.** `handoff/next.md` §1b proposed cutting at
the double-lethal oil trigger — either at a timestamp near session 91's first
live firing, or at the next calendar day — and told this session not to force
either if neither held up. Neither does: the double-lethal wiring is a change
in what the bot does with *Relaxing* oil (937), and it has no visible effect on
any of the four degrading claims, all of which are about the **focus budget**.

### The actual boundary — Focus Oil ran out, and it is bracketed to 5.6 seconds

`logs/fishing-*.jsonl` records every `use_fishing_item` POST and every
`oil_trigger_no_stock` refusal with its `itemId`:

```
  last successful Focus Oil (942) POST   2026-08-24T00:02:51.543Z
  first oil_trigger_no_stock for 942     2026-08-24T00:02:57.148Z   <- FOCUS_DRY_BOUNDARY
  further 942 refusals, no more POSTs    36 (17 that batch, 19 the next)
```

`FOCUS_DRY_BOUNDARY` is that first refusal. **Focus Oil is the meter-restoring
half of the oil policy**, so when it hit zero the budget-zero rate reverted
toward the pre-oil regime while the policy, the code and the deck were all
unchanged.

### The dose-response, and the row that carries the causal claim

```
  era / cluster              Focus POSTs   plays   budget-0   rate
  preOil (no oil policy)               0     410        184   44.9%
  2026-08-21                          13     110          2    1.8%
  2026-08-22                           7      70          1    1.4%
  2026-08-23                           3      22          0    0.0%
  2026-08-24 00:0x (dries mid-batch)   3      87         17   19.5%
  2026-08-24 19:1x (dry throughout)    0      52         19   36.5%
```

**The confound is named and controlled.** 12 of `focusDry`'s 22 casts are
BASE-DECK casts from the §29 rod-durability window, and a base deck could
explain a worse budget on its own. It does not explain this one: holding the
deck fixed to rod-dealt casts, `oilSupplied` reads **3 budget-zero plays of 215
(1.4%)** and `focusDry` reads **19 of 52 (36.5%)** — a factor of 26 with the
same deck, the same policy and the same code. The 2026-08-24 19:1x cluster is
that comparison standing alone.

### ⚠ Day precision genuinely cannot express this boundary

It falls **inside** a single 20-cast batch (2026-08-24T00:01:04 → 00:05:48),
splitting it **8 supplied / 12 dry**. `eraOf` therefore compares the FULL
timestamp for this boundary and keeps day precision for the first one, whose
20.3-hour empty gap makes every literal inside it equivalent. Both choices are
pinned in `castEra.test.ts` and stated in `castEra.ts`'s header — the brief's
resolution 2 ("treat it as starting the next calendar day") was rejected
because it would misclassify 12 casts that demonstrably had no Focus Oil.

### What the corrected split does — all four claims reverse

Every one was **contaminated, not converging**. Session 89's "~30x" was RIGHT
for the oil-supplied era and decayed only because starved casts were pooled in:

```
  claim                          s84/86      s89        s91       s92 (corrected)
  budget-zero ratio                ~30x      6.48x     3.92x            26.37x
  budget-zero rate, later era      1.49%     6.92%     11.4%              1.7%
  redraw rescue rate           15/15 100%  26/32 81%  30/42 71%     21/22 95.5%
  redrawCounterfactual.neither         0         6        12                  1
  `wasted` across the sweep          {0}  {0,3,4,5,6}  {0,3,6,…,12}       {0, 1}
```

The rescue rate's Wilson lower bound is now **0.782**, within 0.001 of the 0.78
session 84 published for 15/15.

⚠ **This does NOT make sessions 89 and 91 wrong to have retracted.** Each
retraction was correct given a two-era model, and neither session could see the
dilution from one batch. What is now forbidden is **restating the degrading
sequence as evidence about the redraw or the policy** — it was evidence about
the predicate. `neither = 1` also means the retraction is not fully rescinded:
the claim is "negligible while the policy can fire", never "structural".

### ⚠ THE FIFTH CLAIM IS A SEPARATE DEFECT AND OPTION (b) DOES NOT FIX IT

The red assertion — `|before.meanOptimal − today.meanOptimal| < 0.01` — **still
fails on the corrected split, at 0.0108.** So there were two defects, not one.

`optimal` is a per-cast integer in {0,1,2} with sd ≈ 0.65; at n = 93 and 62 the
standard error of the **difference** is **0.112**. A 0.01 bound is one tenth of
one standard error — it demanded agreement about twenty times finer than this
corpus can resolve. **Session 89's 0.0062 was a coincidence** (roughly a 7%
chance of landing that small), not the "single most important thing in the file
that did NOT move". It was always going to break.

It is replaced by `meanOptimalGap`, which compares against 1.96 standard errors
derived from the arms' own dispersion. **That is not a widened bound**: it is
not a constant, it TIGHTENS as the corpus grows, and a half-move divergence
still fails it at gap/SE ≈ 2.7 — asserted non-vacuously in the test itself. The
premise is confirmed and now holds pairwise across all three eras (gap/SE 0.10,
0.46, 0.35). The syllogism's real claim is asserted directly beside it: the
overspend gap (0.736) dwarfs the difficulty gap (0.011) ~68-fold.

**Suite: 2 failed / 1744 passed → 1 failed / 1749 passed.** The only remaining
failure is the carried, inert `boons.test.ts` staleness.

---

## §33 — `firedOil`/`oilsConsumed` CANNOT SEE AN OIL THAT FIRES ON A CAST'S LAST TURN, AND THE NEW DOUBLE-LETHAL POLICY FIRES EXACTLY THERE [session 92 §1, OPEN — needs a ruling before `castTrace` is "fixed"]

**Found while re-specifying the era, not looked for.** The corpus oil census
reads **15 casts / 24 oils**. The truth is **17 / 28**.

`castTrace` deliberately skips `use_fishing_item` responses (they re-report
their predecessor's move fields, which breaks position continuity — a
documented, correct decision). `oilsConsumed` reads the first-to-last
`consumablesUsed` delta over the surviving turns. When an oil fires on the
**closing** turn there is no later real turn to carry the incremented count, so
the trace simply ends before it.

Session 91's two double-lethal firings are exactly this shape:

```
  cast 13068171  raw states: cu 0,0,0,0,0,1,2,2   fishHp 18,13,16,9,4,2,0,0
                 trace:      5 turns, cu all 0, last fishHp 4, firedOil FALSE
  cast 13068190  raw states: cu 0,0,0,0,1,2,2     fishHp 11,6,9,4,2,0,0
                 trace:      4 turns, cu all 0, last fishHp 4, firedOil FALSE
```

Both were CAUGHT, and `trace.caught` is **correct** on both — it is computed
from events across all states, so catch accounting is unaffected. What is lost
is the oil count and the last two HP transitions.

**Why this is a question and not a fix.** A LETHAL trigger fires on the closing
turn *by construction*, so this blind spot is not a rare edge — it will hit
every double-lethal cast from here on, and the policy that produces them was
only wired in session 90. But repairing `castTrace` changes turn counts on an
unknown number of casts and would move numbers in several pinned files at once.

**It contaminates nothing currently pinned, which is why there is time to
decide.** Both casts are in `focusDry`; `budgetZeroDecomposition`'s oil term
reads `oilSupplied`, and `assertCastEraSound`'s restore-free control reads
`preOil`. `castEra.test.ts` now pins the defect explicitly, at its
wrong-but-actual value, so a repair fails loudly rather than silently shifting
figures elsewhere.

### THE QUESTION

- **(a)** Repair `castTrace` to carry `consumablesUsed` (and the terminal HP
  transitions) forward from skipped `use_fishing_item` states without
  reinstating them as turns, then re-pin every affected file in one pass.
- **(b)** Leave the trace alone and give `oilsConsumed` a separate source that
  reads the raw states directly, keeping turn semantics untouched.
- **(c)** Leave both, treat the census as a known undercount, and rely on the
  live logs for oil accounting — cheapest, and it keeps the pin as the record.

**Not blocking anything.** Live oil spend is ledgered from `logs/` and
`config/bot.json`, not from the corpus, so no decision the bot makes depends on
this.

---

## §33 UPDATE [session 92 §2] — THE BATCH MADE IT WORSE, BROKE A SECOND INSTRUMENT, AND ANSWERED ITS OWN OPTION (b)

The ten-cast batch run after §33 was written changes three things about it.

**1. The incidence is not rare — it is 40% of casts in the current regime.**
Four of the ten new casts fired an oil on their closing turn and all four read
`firedOil === false`: `13071770` (2 oils), `13071790` (2), `13071794` (2),
`13071804` (1). Corpus-wide the census now reads **15 casts / 24 oils where the
truth is 21 / 35**. Session 91's two were not a curiosity; a lethal trigger
fires on the closing turn by construction, so this is the steady state.

**2. ✅ OPTION (b) ALREADY EXISTS AND WORKS — this is the finding that should
decide §33.** `src/sim/fishingCorpus.ts` reads the raw states directly rather
than through `castTrace`'s turn filter, and it gets **every one of the six
missed casts right**: `consumablesUsed` reads 2, 2, 2, 1, 2, 2 exactly as the
fixtures show, and all six are flagged `oilEra`. So the repo already has a
correct oil source; only the `castTrace`-derived path in `castEra.ts` is blind.
Option (b) is therefore not "write a new reader" but "point `oilsConsumed` at
the reader that is already right", which is much cheaper than option (a) and
does not disturb turn semantics at all. `tests/sim/fishingCorpus.test.ts` pins
all six.

**3. ⚠ A SECOND INSTRUMENT BROKE ON THE SAME ROOT CAUSE, AND THIS IS THE PART
THAT GENERALISES.** `tests/fishing/oilReachability.test.ts` carried a structural
claim about the 16-cast gap: `lax.decisionPoints === strict.decisionPoints + 1`
and `lax.focusPoints === 1`, on **every** member. `13071770` reads lax 3 /
strict 1 and `focusPoints` 2. Both clauses fail on it and on nothing else.

The cause is the same one behind the oil blindness: **the double-lethal trigger
is the first policy in this repo's history that sends two `use_fishing_item`
POSTs in one turn**, so a cast can now end with TWO un-actionable trailing
states where every earlier shape appended at most one. The `+1` was derived
from the definition *given one trailing state*; that premise changed, not the
definition. The test now exempts `13071770` explicitly and asserts `+2` for it,
so the exception stays visible rather than being absorbed into a loosened bound.

**The generalisation, which is worth more than either instance: any instrument
that walks the END of a cast should be checked against a double-lethal cast.**
Two have now broken this way within two sessions of the policy going live.
Session 90 wired it, session 91 fired it twice, session 92 fired it three more
times — and each session found a new instrument that had quietly assumed the
old tail shape.

**Still not blocking.** Live oil spend is ledgered from `logs/` and
`config/bot.json`, and `trace.caught` remains correct on all six casts, so
catch accounting is unaffected. The recommendation is now (b), on the evidence
above, but it is still the user's call.

---

## §34 — TEN `start_run` POSTs, TEN CASTS, NINE CHARGED AGAINST THE DAILY CAP [session 92 §2, OPEN — an observation, needs no action]

**What happened.** The session-92 batch sent exactly **10** `start_run` POSTs,
produced **10** distinct docIds and 10 fixture directories, recorded 0
`action_failed` events, and the game's `dayDocs[pondId 2]` advanced from **10 to
19** — nine, not ten.

The bot noticed by itself. `fishing_ledger_reconciled` runs before every cast:

```
  before cast  1  game 10  repo 10  agreed
  ...
  before cast  9  game 18  repo 18  agreed
  before cast 10  game 18  repo 19  LOWERED   <- cast 9 was never charged
```

So `13071800` (started 22:35:49Z, escaped after 3 turns, nothing unusual about
it) did not increment the server's counter. The final ledger check, taken
minutes later, still read 19 — so this is not lag.

**Why this is filed as an observation and not a defect.** The repo's guard
deferred to the game and lowered itself, which is the safe direction: the bot
spent exactly the ten casts it was authorized to spend and the two ledgers now
agree at 19 with 1 cast left. Nothing was overspent and nothing needs undoing.

**Why it is filed at all.** It is the first recorded instance of the server and
the client disagreeing about whether a completed cast happened, and the
reconciliation only caught it because it runs per-cast. If the direction ever
reverses — the game counting a cast the repo did not — the same mechanism would
raise the repo's counter and lose a cast of allowance silently. Worth knowing
the disagreement is possible before assuming a ledger mismatch is a repo bug.

**No question attached.** Nothing to decide unless it recurs; if it does, the
thing to capture is the `start_run` RESPONSE body for the uncharged cast, which
this batch did not single out at the time.

---

## §33 ANSWERED [session 93 §2, user directive 2026-08-24] — OPTION (b). THE UNDERCOUNT WAS **27 CASTS**, NOT 6, AND IT DATES FROM SESSION 62 RATHER THAN SESSION 90

**The ruling.** The user chose option (b), on session 92's own recommendation:
point `oilsConsumed` at the reader that was already right rather than write a
new one, and do not touch turn semantics (that was option (a), and it would
break position continuity and drop every oil cast from the movement corpus).

**Landed.** `castTrace.ts` now carries `consumablesUsedMax` — the MAX of
`consumablesUsed` over every captured state, including the ones deliberately
skipped as turns — which is exactly `src/sim/fishingCorpus.ts`'s own rule.
`oilsConsumed()` returns it. `tests/sim/oilCensusAgreement.test.ts` pins the two
readers to the same number on every cast in the corpus, so they cannot drift
apart again. This is the same move session 68 made for `FISH_DIED`: take the
FACT off the item response without letting the response become a turn.

### ⚠ THE ESTIMATE IN §33 AND §33 UPDATE WAS FOUR TIMES TOO SMALL

§33 put the census at **21 casts / 35 oils** against a read of 15 / 24. The
truth is **39 / 56**, from **27** blind casts:

```
  era           casts   oils      (blind casts by era)
  preOil           1       1       1   ← 12975152, see below
  oilSupplied     27      39      16
  focusDry        11      16      10
  ──────────────────────────────────
  total           39      56      27
```

**Why §33 was low, and it is a mechanism it named without following through.**
§33 reasoned from the double-lethal trigger, which session 90 wired. But the
**on-demand LETHAL trigger has fired on the closing turn since session 62 by
construction** — it fires when the oil finishes the fish, so a *successful*
lethal firing always lands there and always has. Every one of those was
invisible to the census from the day the oil policy shipped. The signature is
unmistakable: of the 27, 26 are `caught` with a final `fishHp` at or below the
payload's damage (single lethal) or exactly 4 (double lethal).

So this was never "a new policy broke an instrument". It was **an instrument
that had been blind to the shipped policy's own successes for thirty sessions**,
and the double-lethal only made it visible by firing twice in one turn.

### The consequence that matters more than the count: `firedOil` changed meaning

Every one of the twelve casts the fix added to `oilSupplied`'s oil arm is a
**Relaxing** firing, and Relaxing Oil does not touch the focus meter. So the arm
went from "oils that restored the meter" to "oils of any kind", and
`castEra.test.ts`'s oil-term counterfactual — which strips RESTORES — diluted:
`cf / plays` 48.5% → 37.5%, entirely because `plays` grew 99 → 128 while `cf`
stayed at 48.

**`firedOil` used to approximate "restored the meter" only by accident**,
because the reader was blind to precisely the oils that don't restore. The
decomposition's claim is now asserted on the restore predicate directly: 13
restore casts, stripped rate **51.7%** against a length-standardised preOil
**57.2%** — within 5.5pp, *tighter* than the 6.8pp the blind reader gave. The
claim survived and is now measured on the right set.

The meter-vs-`consumablesUsed` comparison also loses its "gap is exactly 2"
reading — that constant was an artifact of BOTH readers being broken in the same
place. It is 13 against 39 now, and the original point (the meter is the wrong
detector) is stronger for it.

### One cast is exempted, explicitly, and it is a finding

`12975152` reads `consumablesUsed: 1` on **all four** of its captured states,
every one a `play_cards` — capture began mid-cast and the consumable predates
the window *and* the oil policy. It made `assertCastEraSound` throw, because
`preOil` is the restore-free control. It is now the sole entry in
`PRE_OIL_CONSUMABLE_EXEMPT`, exempted on a claim rather than by loosening the
check: the count is flat across every captured turn, so no restore is visible to
any trace-derived quantity. **A second id arriving there is a different fact and
must be investigated, not appended.**

Nothing already published was inflated: the old reader under-counted 27 times
and over-counted zero times.

---

## §35 — RELAXING-OIL-ONLY [session 93 §1, user directive 2026-08-24, LANDED — recorded, not open]

**The directive.** Stop attempting Focus Oil (942) in live play. Relaxing Oil
(937) is the only oil the bot spends going forward. The user chose a full
policy-and-code landing over a documentation-only note.

**Landed.** `config/bot.json`'s `dendren.oils.allowedItemIds` is `[937]`.
`mayConsumeOil` already refused any id absent from that list, so the POST was
never in danger — that one line is the whole enforcement, and it means the bot
will not spend Focus Oil **even if stock is ever replenished**. That is the
difference between a withdrawal and running dry, and it is why this is a real
decision rather than a no-op against a bag that has read 0 for four batches.

### ⚠ THE BRIEF'S EXPECTED OBSERVABLE WAS WRONG, AND THE CORRECTION IS THE CODE HALF

The session-93 brief §4c-1 expected "no 942 trigger evaluation at all" after the
config change. **That is not what the config change does.** `onDemandTriggers`
is documented as evaluating "independently of how many oils are held", the
focus trigger fires on `focusRemaining <= 0` regardless, and `allowedItemIds` is
checked inside `mayConsumeOil` — *after* the trigger has already decided.

Worse than cosmetic: the refusal then fell through `liveFishing.ts`'s
`held <= 0` branch — **keyed on the BALANCE, not on the reason** — and logged
`oil_trigger_no_stock`. That writes a `dryTriggers` row and flags the whole cast
OIL-POLICY-DRY, keeping it out of **both** outcome arms. Under a withdrawal that
state is permanent: every future cast whose meter reached zero would have left
the corpus forever, for an oil the policy has stopped wanting — the exact corpus
poisoning the third state was invented to prevent, arriving through the
instrument itself.

So the withdrawn kind is now dropped from `oilWanted` **before** the spend loop,
under its own event `oil_trigger_policy_withdrawn`. **A trigger the policy has
withdrawn is not a dry bag.** `tests/fishing/oilFocusWithdrawn.test.ts` pins it
with five Focus Oils in stock — a withdrawal that only held because the bag was
empty would be a stock artifact — plus a contrast case showing the session-92
budget still flagging the same cast dry.

**What it costs, in the model's own terms, and no further.** `OIL-POLICY.md` §2
attributes +17.74pp of the +19.40pp effect to `focus-when-empty-only`, leaving
the lethal trigger's +4.47pp. ⚠ **§0a's suspension is untouched** — neither
number may be quoted as a live forecast, and they appear here only to show the
shape of the trade: the withdrawal drops the trigger the sim scored higher, and
does so knowingly. The dropped trigger was also the less efficient one per oil
(0.404 vs 0.197 modelled pp/oil), so the account keeps the better rate of return
on a scarce hand-crafted item. See `handoff/OIL-POLICY.md` §4.

**No question attached.** Recorded so the next session does not read the empty
Focus bag as the cause and "restore" the item id when stock returns.

---

## §34 ANSWERED [session 93 §4, user-stated 2026-08-24] — IT IS A SKILL, IT IS NAMED `JEBAITOR`, AND IT IS ON THE SERVER'S OWN `start_run` RESPONSE

**The answer, from the account owner:** *"I have a skill that has a 6.75% chance
of a cast not counting against the daily ledger. so one trigger of that today
allowed us to have 21 casts instead of 20."*

**§34 asked for exactly the right capture and the capture carries the proof.**
§34's closing line was "if it recurs, capture the `start_run` RESPONSE body for
the uncharged cast". It recurred this session, the body was captured, and it
contains a single event:

```json
{"type": "JEBAITOR", "playerId": -1, "batch": 0, "value": 6.75, "data": {}}
```

The `value` is the proc percentage. Census over every committed fixture — **166
casts with a captured `start_run`, and `JEBAITOR` appears on exactly 3**:

```
  docId       when                      value   charged?
  13024510    2026-08-21T21:59:50.786Z   2.25   unknown — predates the instrument
  13071800    2026-08-24T22:35:50.831Z   6.75   NO  ← session 92's §34 cast
  13073296    2026-08-25T02:20:23.009Z   6.75   NO  ← this session's
```

**Two of the three are the two casts known to have gone uncharged, and they are
the only two ever observed.** `13071800` is the exact docId session 92 named.

⚠ **The third is not a counterexample — it is CLAUDE.md rule 10 in action.**
`13024510` predates `fishing_ledger_reconciled` (session 92's instrument), so
nobody was watching that day; it is an unobserved instance, not a
contradiction. The reason this can be dated at all is that the `JEBAITOR` event
is on the **SERVER's** response and predates the instrument, which is exactly
the field rule 10 says to re-ask the question with. Its lower `value` (2.25 vs
6.75) suggests the skill was levelled between 08-21 and 08-24, but that is an
inference from two points and is not asserted.

### What changes as a result

- **The direction is EXPECTED and it is a GAIN, not a defect.** The repo counts
  a cast the game does not charge, so the account gets *more* casts that day
  than the cap implies — 21 instead of 20 today. Deferring to the game stays
  correct; what changes is that a future session must not investigate this as a
  repo bug. `src/orchestrator/fishingLedgerReconcile.ts` now names the cause in
  the `lowered` note and points here.
- **The `raised` direction still has no explanation** and remains worth
  investigating. Do not generalise this answer to it.
- **Do not plan around it.** ~6.75% per cast is a bonus that shows up after the
  fact, not allowance to schedule. The ledger remains the only authority
  (CLAUDE.md rule 13).

**§34 is CLOSED.**

---

## §36 ANSWERED [session 96, user directive 2026-08-25] — SHIP THE 11-PATTERN LIBRARY

**The directive, verbatim:** *"Ship the 11-pattern library; it has now passed
offline evaluation."*

This entry exists because session 95 left the decision in a STATE.md "Open
questions" list, which is where it sat unresolved across two sessions. A live
behaviour change in a gitignored file needs a home a future reader can find.

### What actually changed

`data/minedFishPatterns.json` — the library `scripts/liveFishing.ts` seeds its
matcher from — went **3 patterns → 11** when `scripts/mineFishPatterns.ts` was
re-run offline in session 95 §H, at `castCount` **89 → 189**.

| | before (mined 2026-08-20, 89 casts) | after (mined 2026-08-25, 189 casts) |
|---|---|---|
| patterns | `perimeterWalk(cw)`, `perimeterWalk(ccw)`, `bounce(2,0)` | those three plus `bounce(1,0)`, `bounce(0,1)`, `bounce(0,-1)`, `bounce(1,1)`, `bounce(-1,0)`, `bounce(-1,1)`, `bounce(-1,-1)`, `twoCellCycle(0,-1)` |

`PROMOTION_THRESHOLD` is **unchanged at 3**. Nothing was tuned to produce this;
it is what the shipped rule returns at the current corpus size. Three specifics
from session 95 §H, recorded because the session-95 brief predicted otherwise
and a later reader should not re-derive them: **`bounce(2,0)` was ALREADY
promoted** before this re-run (it is in the 89-cast file above),
**`bounce(-2,0)` does not clear the threshold at any support level** and is not
a candidate at all, and **eleven primitives clear the threshold**, not the ~4
the brief expected.

### The due-diligence cross-check — it ran, and here is the verdict

Session 95's scratchpad backup of the pre-re-mine 3-pattern file **survived**,
so `scripts/minedLibraryGate.ts` — the purpose-built paired-replay gate for
exactly this kind of library change, which had NOT been run old-vs-new — was
run for this library:

```
npx tsx scripts/minedLibraryGate.ts <3-pattern-backup>.json data/minedFishPatterns.json

▸ minedLibraryGate — 188 clean traces
  BEFORE  caught 48/188   hits 302/671   matcher-active turns 292 (median weight 0.164)
  AFTER   caught 51/188   hits 294/632   matcher-active turns 398 (median weight 0.196)

  paired ΔlogLoss (AFTER − BEFORE, negative favours AFTER), 618 turns in 188 casts:
    0.0106  95% cluster-bootstrap CI [-0.0096, 0.0274]

  VERDICT: CI includes zero — the change is not measurably better OR worse on log loss.
```

**Read this as what it is: a NO-HARM result, not a benefit.** The paired
ΔlogLoss CI straddles zero, so on the replay corpus the 4x larger candidate
pool neither sharpens nor degrades the matcher's predictions measurably. The
`caught 48 → 51` difference is 3 casts in 188 and is nowhere near the gate's
own noise bar — **do not quote it as an improvement.**

**This instrument is NOT under OIL-POLICY.md §0a.** §0a suspends `castSim` for
this fishery and says so by name; `minedLibraryGate.ts` runs `replayCorpus`
over real cast traces, and §0a's own text draws the line explicitly — *"Session
71 restored the replay's precondition, not this sim arm. They are different
instruments."* So the ΔlogLoss verdict above is quotable and the suspension is
untouched.

⚠ **What may NOT be quoted:** `mineFishPatterns.ts`'s own end-of-run print
(blind 9.2% → mined 59.4%, N=500). That is `castSim`-derived, §0a suspends it,
and it is the only "evaluation" that had run on this change before today.

### The honest scope of "passed offline evaluation"

The gate says the change does no measurable harm on 188 clean traces. It does
**not** establish that eleven candidates help, and nobody has evaluated the
larger pool's effect on the matcher **posterior in live play** — the replay's
LOO arm is not the live seeding path. What the gate does newly show is that the
matcher **engages more often**: active turns 292 → 398 (+36%) at a higher
median weight (0.164 → 0.196). More engagement with no log-loss penalty is the
case for shipping; it is not proof of gain.

**§36 is CLOSED. The library ships.** The first live batch to run against it is
session 96 §4, which is therefore also the first out-of-sample observation of
it — see that batch's matcher-activity report.

---

## §37 ANSWERED [session 96, user directive 2026-08-25] — RETIRE AND DELETE `boonCapture`

**The directive.** Retire and delete the boon-capture override — module, test,
config block, and all of `scripts/liveRun.ts`'s wiring. Done this session.

### Why, in one line

**Six of six capture targets have now been modelled by the ordinary shipped
rules, without the override ever being armed once**, and the module's own test
said in as many words that this is the condition for deleting it:
`tests/boonCapture.test.ts`'s header — *"if it ever stops holding the module
should be deleted rather than left running."*

### What it was, quoted out of the deleted files, because the "why" lived there

The module took a **deliberately worse boon**, at most once per run and only in
room 1, to record a `state-NNN → state-NNN+1` pickup pair for a boon nobody had
ever picked. `src/sim/boons.ts` can only model a boon it has seen taken, and
session 55 measured a closed loop that made such a pair impossible to get any
other way:

> all 36 unmodelled boon types fall to `loot.ts`'s `unknown` category (score
> 10, the lowest of five), and across 135 captured offers × 4 HP fractions —
> **540 decisions** — `pickBoon` top-ranked an unmodelled type **ZERO** times,
> with **0 of 135** offers having every option unmodelled. Unmodelled because
> never picked, never picked because unmodelled.

It was a score **floor**, not an exclusion — which is why a small override was
enough rather than surgery on the ranker. It carried three limits (room 1 only;
one target per run; a target retires itself once modelled) and a **two-condition
gate**: `config/bot.json`'s block with `enabled: true` **and** `--boon-capture`
on the command line. Two conditions deliberately, because session 24 shipped a
one-condition gate on the potion block next door and it consumed the user's
limited item on a run they had not authorized. **That two-condition precedent is
the load-bearing part worth preserving** — it survives on the potion gate, which
is untouched.

### What actually killed it: the wide orb rule, not this module

The 0-of-540 figure predates **session 58's WIDE ORB RULE**, which picks
unmodelled types for free whenever no priority family is on offer. All six of
the types the override existed to reach — `TieWeak`, `VulnerableBlock`,
`AddBurnShield`, `WeakeningMastery`, `AddLifestealShield`, `Regen` — got their
first-ever pickup pairs through the ordinary rules, **at zero deliberate quality
cost**. Session 55's headline cost estimate ("~27 runs to model all five") was
pricing a mechanism that turned out not to be the one doing the work; it was
already marked stale-as-a-forecast in session 95 and is **not** to be quoted.

### The one wrinkle, and why it does not resurrect the premise

Session 95 re-measured the 0-of-540 claim on the grown corpus: `rankBoons` now
top-ranks an unmodelled type on **4 of 996** decisions. All four are **one
offer** (`run-2026-08-25-03-25-26/state-069`, room 5) at four HP fractions, and
all three of its options score **exactly 10** — the `unknown` floor — because
`categorise` sends LATENT boons there too. The tie breaks on wire-array order.
**So the ranker did not PREFER an unmodelled boon; it could not tell three
floor-scored options apart.** A tie-break artifact is not the escape hatch the
module existed to provide.

### ⚠ The deletion was LARGER than the session-96 brief's own wiring list

The brief enumerated `liveRun.ts`, `config/bot.json`, the module and its test.
**Four more call sites existed and are recorded here so a future reader does not
read the brief as the complete map** (CLAUDE.md rule 9 — a brief's claims are
hypotheses):

- **`src/orchestrator/config.ts`** — a zod schema entry, the `BotConfig`
  field, and the `resolve()` line passing it through. A real code dependency,
  not a comment.
- **`scripts/boonPriorityReport.ts`** — imported `chooseCaptureBoon`,
  `DEFAULT_CAPTURE_TARGETS`, `DEFAULT_CAPTURE_ROOMS` and built an entire **§2d
  OVERLAP section** on them. That section is deleted; §2d's firing-rate arm
  remains and the script still runs.
- **`tests/boonPriority.test.ts`** — imported `DEFAULT_CAPTURE_TARGETS` for a
  corpus test pinning the overlap ("0 of 5"). Deleted with it.
- **Comment references** in `src/strategy/boonPriority.ts` and
  `src/sim/boonRunCoverage.ts`.

The brief also said to leave `liveRun.ts`'s `boonPriority` doc comment alone,
but that comment's whole point was the contrast *"unlike `boonCapture`, this is
ON by default and needs no gate"* — it would have been left naming a deleted
module. **It was reworded, not deleted:** the asymmetry it explains is real and
is why the user's play directive correctly ships ungated. The same applies to
`config/bot.json`'s `_boonPriorityComment`, which opened "NOT A GATE, unlike
`_boonCaptureComment` next door."

**The 1-of-5 overlap measurement is deliberately KEPT**, in
`src/strategy/boonPriority.ts`'s header. It is the reason the priority list was
never widened to cover those types, and that reason outlives the module. **Do
not add the old capture targets to the priority list** — it is the user's play
directive, not a coverage instrument.

### Verification

`grep -rn "boonCapture\|boon-capture\|BoonCapture" src/ scripts/ tests/ config/`
returns **nothing**. `npx tsc --noEmit` clean. Full suite **1769 passed /
1769**, 104 files (down from 1792/105 — 23 tests removed with the feature, no
failures). `handoff/log/` and `handoff/DECISIONS.md` still mention it and were
deliberately left alone: they are historical and append-only.

**§37 is CLOSED.**

---

## §38 ANSWERED [session 96, user directive 2026-08-25] — THE GATE-1 RE-AUDIT IS DEFINED, ITS NAMED FIGURES ARE ALREADY SUPERSEDED OR SUSPENDED, AND IT IS CLOSED

**Why this entry exists.** "The gate-1 re-audit" has been carried as an open
item in five consecutive STATE.md files (sessions 87, 91, 92, 93, 95) as a bare
phrase with no definition any of them pointed at. It **already had an answer**
— session 86 §1 diagnosed it fully — and nobody ever wrote that down as one.
**No new measurement was taken to close this.** This is bookkeeping: the first
time the diagnosis is recorded where a future STATE.md can find it instead of
re-carrying the phrase.

### The definition, from the phrase's origin

`handoff/log/session-86.md` line 97, verbatim:

> **Gate 1 opens a re-audit nobody has done.** Every figure the no-aim arm has
> produced — the deck sweep, the noise floor, its −4.6pp drift margin — was
> measured on a bot that never aims. That is not wrong for a deck comparison
> and it is not a fishery anyone plays in. **Not started; larger than one
> session.**

The finding behind it: `damageEconomy.ts`'s `SIM blind` arm and
`deckObjectiveSweep.ts`'s baseline arm (`matcherPool: []`) **structurally never
aim** — **0 focus moves in 1963 turns, 0 cells used beyond the start cell
(2,2)**, at both `w=0` and `w=3` (session 86 §1, and §4b's table). They carry no
fish-distribution model at all, so every candidate cell scores identically and
`bestFocusForCard` has nothing to prefer.

⚠ **This is not a bug and not "blind" in the sense of "handicapped."** Session
86 §4b is explicit that the condition is **UNIFORM, not blind**: the arm's EV
surface is flat, not degraded. `matcherPool: [] + ringModel` moves 824 of 2492
turns; it is the *absence of any fish model whatsoever*, not blindness, that
produces 0/1963.

### The figures, traced to source — none needs re-measuring

Session 86 named **three**. A fourth from the same lineage is added here because
it is the number most likely to be found and cited by someone reading the older
logs.

1. **The deck sweep's 36.42%** — `deckObjectiveSweep.ts`'s baseline
   (`matcherPool: []`), re-run session 79 §1e on the shuffled draw pile: 4000
   paired casts, baseline hit **36.42%**, catch **0.0%** on the real 23-card
   deck. The no-aim arm by construction. **Already SUSPENDED** under
   OIL-POLICY.md §0a in session 79's own text.
2. **The noise floor, 1.93pp** — session 79 §1e, same re-run: two arms that are
   the SAME deck differ by 1.93pp at 4000 casts, so **only 10 of 80 arms clear
   their own noise**. Sound as a noise floor *for that harness*; wrong to cite
   as a noise floor for anything a real, aiming fishery does.
3. **The −4.6pp drift margin** — `damageEconomy.ts`'s comparison table (session
   80 §1, re-run session 86 §4): margin **−4.6pp** against LIVE's −0.7pp, drift
   **+0.317**. By session 86 the row label already read **`SIM blind
   (no-aim)`** — the table carries the caveat this closure formalizes.
4. **[not one of session 86's three] Session 78's 41.06%** — the pre-shuffle
   baseline of the same lineage ("All 80 appended candidates measured
   byte-identical to the baseline (hit 41.06%)", session 78 §4). **Already
   RETRACTED independently**: session 79 §1 retracted session 78's "deck ORDER
   is load-bearing" finding outright once the per-cast shuffle was confirmed
   (129 opening hands, zero equal to the sequential prediction), and the same
   baseline arm was re-measured as item 1. Superseded by its own re-run, which
   is itself the no-aim arm.

### The verdict: "not wrong, not applicable" — not "wrong"

**None of these misdescribes the harness it was measured on.** `SIM blind` and
`deckObjectiveSweep.ts`'s baseline are legitimate for the one thing session 86
§4b says they are good for: a **deck-composition comparison**, where uniform-EV
aiming is a fair way to isolate the deck variable. They are not, and were never
validly cited as, a description of catch rate, hit rate, or margin for a fishery
a real aiming policy plays. That distinction is the entire finding.

**This closure changes none of the four numbers.** It retires their use as
evidence about live play, and it does **not** lift OIL-POLICY.md §0a or create
any new quotable figure.

### Closed

**§38 is CLOSED.** "The gate-1 re-audit" stops being carried as an open item in
STATE.md as of session 96 — the same way §19 and §23 got closing pointers in
session 95 rather than staying open by inertia.

---

## §39 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — APPROVE THE NECESSITY GATE FROM `handoff/OIL-CONSERVE.md`, DIRECTION CONFIRMED, RE-DERIVATION REQUIRED BEFORE IT SHIPS

**Why this entry exists.** The user asked, unprompted, how many of their own
directives had been logged as recommendations and never actually wired live.
An audit of `DECISIONS.md`/`TASKS.md`/the session logs surfaced
`handoff/OIL-CONSERVE.md` (session 67, 2026-08-21, brief §1) as the clearest
case: a policy the user explicitly asked for, that was derived, swept at
n=8000, and measured to **beat the shipped policy on catch rate AND oil spend
at once** (88.38% vs 88.11% catch, 32% fewer oils; dominates at every
finite-stock level tested, §5) — and the one open question it left
("does the user approve `conserve(r=1,f=1)`?") was written into
`handoff/log/session-67.md`'s own "open questions" section instead of into
this file, so it was never actually put in front of the user. It surfaced
again in passing in `DECISIONS.md`'s 2026-08-24 (session 90) entry and then
stopped being mentioned anywhere through session 96.

**The user's directive, quoted again because it's what this approves** (first
recorded `handoff/OIL-CONSERVE.md` §0, session 67, 2026-08-21):

> Keep crafting, but use oils only on an as-needed basis. If the autofisher
> believes it can catch the fish without oil, don't use the oil — conserve
> inventory for future casts. The priority is to use mana to get the fish as
> close as possible to caught, with the oils as a backup to guarantee a catch
> if need be.

**Today, 2026-08-25, the user approved shipping this direction** when it was
re-surfaced to them directly (not through `handoff/log/`) as one of several
stalled recommendations found by an audit. **This answers the "does the user
approve" question `session-67.md` left open. It does not, by itself,
authorize dropping the old `conserve(r=1,f=1)` sweep numbers straight into
`liveFishing.ts`** — two things changed underneath that sweep since session
67 that make a straight drop-in the wrong kind of confidence (rule 9):

1. **`config/bot.json`'s `dendren.oils.allowedItemIds` is now `[937]` only**
   (session 93, §35, RELAXING-OIL-ONLY). The original sweep scored both the
   Relaxing gate and the Focus gate; only the Relaxing half is live-relevant
   today. §3's own decomposition table already isolates that half — "the
   Relaxing gate is free… for 1182 fewer oils (−21%)" — so the Relaxing-only
   case doesn't need re-deriving from nothing, but it does need re-stating on
   its own, not as half of a two-oil recommendation that no longer applies
   whole.
2. **The live trigger the necessity gate would sit on top of is no longer
   `onDemandTriggers` alone.** Session 90 (§30, user directive) wired
   `doubleLethalTriggers` live, which itself calls `onDemandTriggers` as its
   `base` (`src/strategy/fishing/oilTiming.ts` line ~699) and layers a
   same-turn double-spend on top in a specific HP band. `conservingOil`
   (line 600) also wraps `onDemandTriggers` directly — the two were built as
   siblings, not composed with each other, and nothing in `OIL-CONSERVE.md`
   or `oilTiming.ts`'s own comments says what "necessity-gated AND
   double-lethal-capable" does together. That composition needs to be
   written and swept before it ships, not assumed.

**What this entry settles and what it leaves for the next session:**

- **Settled:** the user approves the necessity-gating *direction* — skip an
  oil spend the bot's own model already shows is unnecessary — as shipped
  policy, not merely a sim curiosity. `handoff/OIL-CONSERVE.md` is no longer
  "awaiting the user's approval" in the sense its own title says; that title
  should be updated when the wiring session runs.
- **Not settled, and not to be assumed:** the exact thresholds and the
  composition with `doubleLethalTriggers` under the current relaxing-only
  configuration. `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing = 1` was derived
  with both oils live and no double-lethal layer; re-sweep it (or confirm it
  still holds) under today's actual live composition before wiring, per
  CLAUDE.md rule 4.
- **Worth checking together with the still-open §2c oil-trigger tripwire**
  (STATE.md session 96: 9 of 10 clean casts exceeded a threshold of 6, a
  ~1-in-900 event under the model's ~0.70 oils/cast assumption). A
  necessity gate that cuts unnecessary Relaxing spends by ~21% would also
  lower the *model's own* expected oils/cast, which changes what threshold
  the tripwire should have been pre-registered against. These may be the
  same finding wearing two names — the wiring session should check that
  explicitly rather than treat them as two separate open items.

See `handoff/next-oil-conserve.md` for the concrete wiring brief.

**§39 is ANSWERED on direction; wiring is deferred to a brief with its own
verification gate, per CLAUDE.md rule 4.**

---

## §40 ANSWERED [session 97 §1, 2026-08-25] — THE NECESSITY GATE IS WIRED, COMPOSED AND PROVED — AND IT IS A MEASURED LIVE NO-OP

**What shipped.** `scripts/liveFishing.ts` now calls
**`necessityGatedDoubleLethalTriggers`** in place of `doubleLethalTriggers`.
That is the Relaxing-only necessity gate composed UNDER the live double-lethal
band, at `RELAXING_ONLY_NECESSITY_THRESHOLDS` = `{ relaxing: 1, focus:
ALWAYS_FIRES_THRESHOLD }`. §39 approved the direction; this is the wiring it
deferred.

### §1b — the composition, and why it was PROVED rather than swept

The brief asked for the composition to be swept. **A sweep was the wrong
instrument and would have been the weaker answer.** The two layers act on
disjoint `fishHp` bands, so with `D = fishDamage`:

| `fishHp` | gate acts? | band acts? | composed result |
|---|---|---|---|
| `<= 0` | no | no | `[]` — fish dead |
| `0 < hp <= D` | **yes** | no | **== gate alone** |
| `D < hp <= 2D` | no | **yes** | **== shipped double-lethal, untouched** |
| `hp > 2D` | no | no | == on-demand |

`conservingTriggers` can only ever REMOVE entries from `onDemandTriggers`'
array, and the band's second guard (`fishHp <= D`) means it cannot re-add an
oil the gate just skipped. **There is no interaction term at any HP.** A sweep
of a quantity that is provably zero returns "near zero, CI [−x, +y]" — which is
exactly how a real interaction hides. `tests/fishing/oilNecessityComposition.test.ts`
pins the partition exhaustively over both sides of every boundary (91 assertions).

**Answer to the brief's question — does composing cost anything relative to the
gate alone? No, and not approximately: exactly nothing, at every `fishHp`.**

Two supporting pieces of work fell out of it:

- **`conservingTriggers` is new.** `conservingOil` was a `OilTimingPolicy`
  whose `decide` folds the stock check in with the trigger check. The live loop
  needs a TRIGGER and does its own stock accounting — the session 62 §1b split
  that exists so "trigger did not fire" and "trigger fired while dry" stay
  distinguishable. Handing `liveFishing.ts` a `decide` would have silently
  re-merged them. `conservingOil.decide` is now defined in terms of it, so the
  two halves cannot drift.
- ⚠ **A LIVE EPSILON DIVERGENCE WAS FOUND AND FIXED.** `doubleLethalTriggers`
  compared `bestKillProbability(s) >= relaxingThreshold` with a **bare `>=`**
  from session 89 onward, while the necessity gate — same quantity, same
  constant — went epsilon-tolerant in session 68. At a threshold of exactly `1`
  a certain kill arrives as `0.9999999999999999` whenever the summation order
  does not cancel (**session 68 observed exactly this**, same card, consecutive
  turns). The bare form therefore read certainty as uncertainty and would spend
  **two** oils on a turn the bot was already sure of — the precise decision both
  the band's thesis and the gate's forbid. Now `meetsThreshold`. This was
  shipped live from session 90.

### §1a — ⚠ THE GATE IS A MEASURED LIVE NO-OP, AND ITS JUSTIFICATION IS A `castSim` ARTEFACT

**The brief's instruction to re-run `scripts/oilConserveSweep.ts` was NOT
followed, and could not be.** `handoff/OIL-POLICY.md` §0a forbids it by name —
*"Do not re-run the oil sweep on the current instrument to 'check': that
produces a second unsupported number"* — and `runArm` (`scripts/oilTimingSweep.ts:130`)
uses `baseOpts() = { policy: matcherFishPolicy }`, the plain synthetic-pool bare
arm, which is exactly the arm §0a suspends. Re-derived instead on the LIVE
corpus via `scripts/liveGateFiringRates.ts` (session 75), which §0a does not
reach:

| source | Relaxing gate evaluated | HELD (withheld an oil) | max `bestKillProbability` | at exactly 1 |
|---|---|---|---|---|
| replay, whole clean corpus (684 turns) | **18** | **0 — 0.0%** | 0.990 | **0** |
| the live loop's own record | **20** | **0 — 0.0%** | 0.991 | **0** |
| union of every Relaxing observation ever | **24** | **0** | 0.991 | **0** |

**`OIL-CONSERVE.md` §4's threshold argument does not survive this.** §4 chose
`1` because the input is bimodal with **55.8% of Relaxing decisions at exactly
1**. That upper spike is a property of `castSim`; two instruments resolving
against real movement put **no mass at 1 at all**. So §3's mechanism — *"spending
an oil to convert a certainty into a certainty buys nothing"* — describes the
simulator, and its **"1182 fewer oils (−21%)" DOES NOT TRANSFER**.

**The direction argument is stronger than the sample size.** `pConnect` is
optimistic, so correcting it moves these inputs DOWN, away from the only
boundary they are compared against. A better estimator cannot make this gate
fire — only fire less.

It shipped anyway because it is the user's approved policy, because a gate that
never fires cannot cost a catch, and because leaving an approved directive
unwired is the failure §39 exists to stop. **The open decision — should the
threshold be lowered so the gate actually bites? — is the USER's.** The shadow's
own exchange-rate arm already uses **0.8333**, which WOULD have fired on live
observations. `oilTiming.ts`'s standing rule against tuning the necessity
thresholds means no agent may pick that number.

### §1c — the §2c tripwire and this gate are UNRELATED. §39's guess is REFUTED

§39 speculated they "may be the same finding wearing two names". **They are
not.** The gate holds 0 oils live, so a gated oils/cast is IDENTICAL to an
ungated one and the tripwire's threshold is unchanged by this gate.

**But they share a CAUSE, and it is the same one.** The tripwire is
pre-registered against *"the sim's ~0.70 oils/cast"* (`scripts/liveFishing.ts`)
— another `castSim` number. Measured live (`scripts/eraCatchRate.ts` §4–§5):

| | oils/cast | clean-cast rate | P(≥9 clean of 10) |
|---|---|---|---|
| the sim's assumption | ~0.70 | 49.7% | 1.02% — **~1 in 98** |
| **live, `focusDry` era** | **0.44** | **30/43 = 69.8%** | **14.6% — ~1 in 7** |
| live, all-time | 0.30 | 157/198 = 79.3% | — |

⚠ **And the tripwire's own stated rarity is miscomputed by ~9x.** It prints
"~1-in-900"; the correct figure under its OWN assumption is ~1 in 98. So three
errors compounded: wrong instrument, wrong arithmetic, wrong conclusion.

**RULING: session 96's 9-clean-of-10 is an ORDINARY outcome (~1 in 7), not a
~1-in-900 anomaly. The tripwire did not detect a divergence in live play; it
detected its own threshold being derived from a suspended instrument.** It
should be re-registered against the live clean-cast rate or retired — flagged
for the user, not decided here, since it is a pre-registered instrument.

---

## §41 ANSWERED [session 97 §2, 2026-08-25] — THE CATCH-RATE DIAGNOSIS: A COMBINATION, AND THE USER'S "~60%" IS CORRECT

**VERDICT, named rather than hedged: sampling noise on the BATCH, plus a real
but statistically unresolved ERA-level decline that is mechanically explained
by a deliberate policy change. NOT a code regression, and NOT purely noise
either.**

### §2a — ⚠ THE BRIEF WAS WRONG. "~60%" IS A REAL, LIVE-MEASURED NUMBER (CLAUDE.md rule 9)

The brief asserted that *"The user's '~60%' figure does not match anything in
the live-measured record"* and that *"the honest all-time live baseline has
never been close to 60% on any real volume."* **Both are false**, and the
correction matters because the whole framing of §2 rested on them.

`scripts/eraCatchRate.ts` (written this session; LIVE corpus only, no `castSim`
quantity appears in it by construction):

| era | caught/n | rate | 95% Wilson | oils/cast |
|---|---|---|---|---|
| `preOil` | 14/93 | 15.1% | [9.2%, 23.7%] | 0.01 |
| **`oilSupplied`** | **39/62** | **62.9%** | **[50.5%, 73.8%]** | 0.63 |
| `focusDry` (today) | 20/43 | 46.5% | [32.5%, 61.1%] | 0.44 |
| ALL | 73/198 | 36.9% | [30.5%, 43.8%] | 0.30 |

**`oilSupplied` reads 62.9% on n=62.** That is real volume, and it is the era
the user remembers. The lineage is one era growing, re-confirmed three times:

- session 71 log: catch **60.0%**, n=35
- session 72 log: **23/39 = 59.0%** [43.4%, 72.9%] — *"(session 71's 60.0%)"*
- today: **39/62 = 62.9%** [50.5%, 73.8%]

**The user's recollection is accurate.** It is not the stale §0a-era artefact
the brief predicted, and it is not sim/live conflation — though the trap the
brief asked about is real: `castSim`/miner prints land at 59–88%, numerically
adjacent to 60%. The user's figure does not need that explanation.

### §2b — the era split: the right direction, NOT resolvable at this n

`focusDry` 46.5% vs `oilSupplied` 62.9% = **−16.4pp**. **The Wilson intervals
OVERLAP** ([32.5, 61.1] vs [50.5, 73.8]), so the corpus cannot distinguish these
rates and the era effect is **not established** — it is the right sign with an
honest mechanism and insufficient n.

The mechanism, stated before the numbers and not fitted to them: the focus meter
never regenerates within a cast (CONFIRMED session 13), the only live-approved
top-up was Focus Oil, and Focus Oil was **withdrawn in session 93 (§35,
RELAXING-OIL-ONLY)**. `focusDry` is by definition the era after that withdrawal.
So if the decline is real, it is a **live-confirmed mechanical consequence of a
deliberate policy change the user made** — not a bot defect.

### §2c — session 96's 3/10, with the interval the brief asked for

**3/10 = 30.0%, EXACT (Clopper–Pearson) 95% CI [6.7%, 65.2%].** That interval
contains *every* baseline on record:

| baseline | | |
|---|---|---|
| bare-arm real (§0a) | 27.6% | INSIDE |
| live-config pooled | 28.3% | INSIDE |
| dead-era-excluded | 25.9% | INSIDE |
| all-time corpus | 36.9% | INSIDE |
| **today's `focusDry` era** | **46.5%** | **INSIDE** |

**Stated as its own finding, independent of §2b: a 10-cast batch cannot
distinguish 30% from 46.5% or from 27.6%. Session 96's batch is uninformative
about whether anything changed.** It is not evidence of a regression and would
not have been evidence of an improvement either.

### §2d — the two items session 96 left open

- **The oil-trigger tripwire — see §40 §1c above, not re-derived here.** Ruling:
  9-clean-of-10 is ~1 in 7 at the live rate, an ordinary outcome; the tripwire's
  threshold came from `castSim` and its stated rarity is miscomputed ~9x.
- **The 11-pattern library's weak first read.** **No second batch exists on
  disk** — the newest fixtures are session 96's own (2026-08-25 18:53–18:56) and
  §1/§2 both forbade live play — so the tally stands at n=20 (mined 2, baseline
  5). Exact sign test on the discordant pairs, overlap unknown so bounded:
  **p = 0.25 to 0.45**. It settles nothing, exactly as STATE.md said.
  **What WOULD settle it, computed rather than asserted:** McNemar at α=0.05,
  power 0.80, *assuming the true gap is as large as the observed 25%-vs-10%
  (optimistic — an observed gap this size at n=20 is likely an extreme)*:
  **87–122 matcher-active turns**. At session 96's rate of 2.0 matcher-active
  turns per cast that is **~44–61 casts, i.e. 4–6 ten-cast batches**. Against a
  20/day server cap and a rod with ~9 casts of headroom, **this question is
  expensive and should be chosen deliberately, not drifted into.**

### §2e — the unconstrained-early-spend guardrail: do NOT wire it, and `costCap` should be RETIRED

Re-measured fresh (`scripts/focusProfileCheck.ts`, live corpus):

| | session 49's premise era (n=73) | **today's policy era (n=110)** |
|---|---|---|
| opening spend | 1.62 | **0.82**, 95% CI [0.67, 0.97] |
| focus profile | 3.00 1.38 0.72 0.36 0.14 0.04 **0.00** | 3.00 2.18 1.49 1.01 0.93 0.70 0.36 — **does not collapse** |
| fish-at-full (meter-out) | 80.8% | **38.2%** |
| turns at focus 0 | 50.4% | **23.0%** |

- **Opening spend 0.83 (n=35, session 71) → 0.82 (n=110). UNMOVED across 75 more
  casts.** `costCap(2)` still has nothing to bind on. Session 72's "costCap is
  inert because the policy does not need it" is re-confirmed at 3x the n.
  **Recommendation: retire `costCap` explicitly** rather than leave it as a
  fourth stale recommendation.
- **The module's PREMISE is gone.** It was built because meter-out was the
  dominant loss at 80.8%; today's era reads 38.2% fish-at-full and 23.0% of
  turns at focus zero — roughly halved. The binding constraint has moved.
- ⚠ **The brief's "`TASKS.md` records focus exhaustion at 69.5% of casts" is a
  `castSim` number** (TASKS.md:810, session 45's `focusReserveAblation.ts`),
  suspended under §0a, and must not be cited as a live constraint.
- **`schedule` keeps a named revival condition rather than an open-ended
  "worth doing":** revisit it if today's-era turns-at-focus-0 rises back above
  ~40%, or if meter-out becomes the dominant loss again. That is a gate on a
  number this repo already prints every run (CLAUDE.md rule 6).

**Nothing in §2 changed strategy code.** §2e's conclusion is "do not wire", so
there was nothing to wire.

---

## §42 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — FOCUS OIL STAYS RETIRED. THREE RELAXING OILS PLUS 10 MANA IS THE STANDING BUDGET, GATED ON THE FOCUS-SPEND GUARDRAIL STAYING OFF

**Session 97's open question #3 asked whether the user wants to reconsider
the session-93 Focus Oil withdrawal**, given the era split showed
`oilSupplied` reading 62.9% against `focusDry`'s 46.5%. **The user's answer:
no.** Verbatim:

> "no we will not be using focus oil, the autofisher with 3x relaxing oils
> and 10 mana is enough. as long as it is not aggressively burning through
> focus meter is should be able to reliable catch fish."

**This is a standing decision, not a re-opening of §35.** RELAXING-OIL-ONLY
(§35, session 93) is reaffirmed with its reasoning restated in the user's own
terms: the account will run on 3 Relaxing Oils and 10 mana, and the thing
that has to stay true for that to work is the bot not burning the focus
meter aggressively early. **This is directly why §2e's finding matters and
should not be re-litigated lightly**: session 97 measured today's-era
opening spend at 0.82 of 3 (n=110, stable since session 71's 0.83 at n=35)
and recommended retiring `costCap` because the module's premise (meter-out
dominant at 80.8%) is gone — today's era reads 38.2% fish-at-full, half of
the historical rate. §2e's own text names the reopening condition
precisely: **if today's-era turns-at-focus-zero rises back above ~40%, or
meter-out becomes the dominant loss again, that is the signal this
directive is no longer holding and `schedule` should be revisited** — not a
guess, a number this repo already prints every run (CLAUDE.md rule 6).

**Do not read the `oilSupplied`-era 62.9% as evidence Focus Oil should come
back.** The user weighed that tradeoff directly, with the number in front of
them, and chose the simpler standing configuration. Carry this decision
forward as CLOSED, the same way §35 has been since session 93 — don't
re-surface the era split as if it were still an open question next session.

---

## §43 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — LOWER THE NECESSITY-GATE RELAXING THRESHOLD FROM 1 TO 0.85

**Session 97's open question #1**, named "the session's most consequential
open item": the necessity gate shipped in §40 at threshold 1 (only skip the
oil on an exactly-certain kill) and was measured a live no-op — 24
evaluations, 0 held, max observed `bestKillProbability` 0.991. `oilTiming.ts`
itself forbids an agent picking a lower number; it needed the user.

**The user's ruling: 0.85.** Between the live maximum (0.991, would still be
near-inert) and the shadow's own exchange-rate arm (0.8333, session 69 §3,
which QUESTIONS §40/session 97 noted "WOULD have fired") — 0.85 sits just
above that exchange-rate arm, closer to the aggressive end of the range that
was actually on the table. **This is a deliberate tradeoff, not a
free lunch**: `handoff/OIL-CONSERVE.md` §4's plateau table showed lower
thresholds trade a small amount of catch probability for oil savings; at
0.85 expect the gate to actually start firing (unlike at 1) and to skip a
meaningfully larger share of the Relaxing spends `doubleLethalTriggers`
would otherwise take.

**What this requires before it ships** (do not treat "the user picked a
number" as "the number is now correct in code"):

- `RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` in
  `src/strategy/fishing/oilTiming.ts` changes from `1` to `0.85`.
- **Do not re-run `scripts/oilConserveSweep.ts`** to "check" this number —
  `OIL-POLICY.md` §0a forbids it by name, and session 97 already refused
  that instruction once for exactly this reason. If a sanity check is
  wanted, it has to be against the live/replay corpus the way §40/§41 were,
  not the suspended sim.
- Re-run `tests/fishing/oilNecessityComposition.test.ts`'s boundary
  assertions at the new threshold — they were pinned exhaustively at `1`
  (91 assertions) and the boundary behavior at `0.85` needs the same
  scrutiny, not an assumption that shifting one constant leaves every pinned
  case correct.
- Confirm against the live/replay union (the same 24-decision set §40
  measured) how many of those 24 would have fired at `0.85` instead of `1` —
  report this number. It is the honest, corpus-grounded answer to "does this
  actually do anything now," in place of the sim table §0a forbids citing.

---

## §44 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — RETIRE THE §2c CLEAN-CAST TRIPWIRE

**Session 97's open question #2**: the tripwire's stated rarity ("~1-in-900")
was wrong by roughly 9x — the correct figure under its own ~0.70 oils/cast
assumption is ~1-in-98, and against the live `focusDry` clean-cast rate
(30/43 = 69.8%) it's ~1-in-7. Three compounded errors: wrong instrument
(`castSim`-derived assumption), wrong arithmetic, wrong conclusion.

**The user's ruling: retire it.** Not re-register with a corrected
threshold — retire outright. Whoever picks this up should:

- Remove or explicitly disable the §2c tripwire check in whatever script
  currently evaluates it (`scripts/eraCatchRate.ts` per session 97's files-
  changed list is the newest touch point; confirm the tripwire's actual
  call site before editing rather than assuming it's there).
- Record in the tripwire's own location (wherever its threshold constant
  and pre-registration comment live) that it was retired 2026-08-25, by
  user directive, for being miscalibrated on a suspended sim instrument —
  not that it "never fired again" or was quietly removed. A future reader
  should be able to find why this stopped existing, the same discipline
  `boonCapture`'s deletion (§37) already set.
- Do not invent a replacement tripwire in the same motion. Retiring a
  broken instrument and proposing a new one are two different decisions;
  if a corrected pre-registered threshold is wanted later, that's its own
  ask.

---

## §45 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — QUEUE 9 LIVE CASTS, THEN THE ROD IS BEING REPLACED

**Session 97's open questions #4 and #5** (matcher-library volume is
expensive; the rod has ~9 casts of headroom on the user's own estimate):
resolved together. **The user's ruling, verbatim:**

> "we can queue up 9 live casts then I will replace the rod with a new one
> that will have a new deck."

**What this settles:**

- The next live fishing batch is capped at **9 casts**, not the standard 10
  — deliberately inside the user's own durability estimate rather than
  testing it to failure.
- **The rod change is the user's own action, off-repo.** No script here can
  detect or trigger it; whoever runs the next fishing session should ask
  the user to confirm the swap happened before treating the deck as
  changed, the same way `REAL_DECK`'s rod-mismatch history (session 87–89)
  argues for checking rather than assuming.
- **A new rod very likely means a new `REAL_DECK`.** Every pinned corpus
  number keyed to the current rod's deck (`rodDeck.ts`, the Makeshift/Shroom
  break precedent) should be expected to need a fresh baseline after the
  swap — this is not optional bookkeeping, it's the same kind of break
  session 87 already diagnosed once for an intermittent rod mismatch, this
  time deliberate and known in advance.
- **This does not, on its own, resolve the matcher-library question.**
  Session 97 priced that at 87–122 matcher-active turns (~4–6 ten-cast
  batches) to settle with real power — 9 casts is far short of that. Treat
  the matcher-activity data from this batch as a partial contribution to
  that eventual volume, not as the batch that closes it, and don't claim it
  settled anything it didn't.

---

## §46 ANSWERED [session 98 §A/§B/§D, 2026-08-25] — THE THRESHOLD IS SHIPPED AT 0.85 AND HELD 9 OF 24 ON THE CORPUS; THE TRIPWIRE IS RETIRED; THE 9-CAST BATCH CAUGHT 6

The execution record for the user's three operational rulings (§43, §44, §45).
The rulings are in those entries; this is what happened when they were carried
out.

### §A — the necessity gate at 0.85 (QUESTIONS.md §43)

`RECOMMENDED_NECESSITY_THRESHOLDS.relaxing` is **0.85**. `focus` is untouched
at `1` (nothing was asked about it, the Focus Oil is not spendable on this
account, and the shipped `RELAXING_ONLY_NECESSITY_THRESHOLDS` overrides that
arm to the degenerate `ALWAYS_FIRES_THRESHOLD` regardless).

**`scripts/oilConserveSweep.ts` was NOT run** — `OIL-POLICY.md` §0a forbids it
by name, and this is the third brief in a row to ask. Re-derived on the live
and replayed corpus instead, via a new **§3c** block in
`scripts/liveGateFiringRates.ts` so the question is answered by running an
instrument rather than by reading a suspended table:

| observations | n | held at `1` | held at `0.85` | **newly held** |
|---|---|---|---|---|
| the live loop's own record | 20 | 0 | **8 — 40.0%** | 8 |
| pre-hoist, recovered offline (session 69) | 4 | 0 | 1 — 25.0% | 1 |
| **UNION — every Relaxing observation ever** | **24** | **0** | **9 — 37.5%** | **9** |
| replay, whole clean corpus (684 turns) | 18 | 0 | 4 — 22.2% | 4 |

The nine newly-held values are `0.857, 0.914, 0.925, 0.945, 0.961, 0.964,
0.971, 0.975, 0.991`. **So the gate goes from a measured live no-op to
withholding roughly three of every eight Relaxing spends the old policy would
have made.** That is the corpus-grounded answer §43 asked for.

`tests/fishing/oilNecessityComposition.test.ts` was **re-derived, not
assumed**. Its 91 assertions all still pass — because they probe
`bestKillProbability` only at `0` and `1`, and no threshold strictly between
them changes either verdict — which means the file had **no coverage at its own
new boundary**. Added: both sides of 0.85 in the single-lethal band and in the
double-lethal band, and the `[0.85, 1)` region that flips SPEND → WITHHOLD.
91 → 120 tests in that file. The partition PROOF is threshold-independent by
construction (it turns on disjoint `fishHp` bands and on `conservingTriggers`
only ever removing entries), so §40's composition argument survives unchanged.

**Three findings fell out, all recorded in `handoff/OIL-CONSERVE.md` §8:**

1. ⚠ **Session 97's epsilon test was VACUOUS.** `almostCertain` summed three
   thirds, which in this summation order comes to **exactly 1** — so it
   asserted that a certain kill is treated as certain, and nothing about the
   tolerance it was named for. It would have stayed green with session 97's own
   bare-`>=` fix reverted. Now `0.7 + 0.2 + 0.1 = 0.9999999999999999`, the
   exact value session 68 observed live; the ORDER is load-bearing and is
   documented, because ascending order re-sums to exactly 1.
2. **`NECESSITY_EPSILON` is now INERT on the Relaxing arm** —
   `0.9999999999999999` clears `0.85` under a bare `>=` too. Kept (the Focus
   arm is still `1`, and `meetsThreshold` takes arbitrary thresholds), and every
   assertion that actually exercises it was re-pointed at an explicit
   threshold of `1`.
3. ⚠ **`liveGateFiringRates.ts` §4's standing verdict does not survive for this
   arm.** *"`pConnect`'s +9.38pp optimism reaches NO live level gate — CLOSED BY
   IRRELEVANCE"* held because every level gate sat at `p = 1` and no observation
   ever reached it. The corpus has mass on **both sides** of 0.85, so correcting
   an optimistic estimator now moves observations across the boundary and
   changes gate verdicts. Unchanged for the FOCUS arm. §7's direction argument
   flips with it: at `1` "a better estimator can only make the gate fire less"
   was a SAFETY argument; at `0.85` it is a risk argument.

Also: at 0.85 the shadowed exchange arm (0.8333) and the live gate return the
**same verdict on every Relaxing observation ever recorded** — nothing has
landed in `[0.8333, 0.85)`. The shadow's Relaxing column can now only be a tie;
its live-relevant disagreement is entirely the FOCUS arm.

### §B — the §2c clean-cast tripwire, retired (QUESTIONS.md §44)

Retired outright, not re-registered. The only site that still EVALUATED it was
the post-batch report block in `scripts/liveFishing.ts`; that is gone, and the
batch output confirms it live. Tombstones recording what it claimed, why it was
wrong (wrong instrument, ~9x arithmetic error, wrong conclusion) and who
retired it sit at `src/strategy/fishing/oilBatch.ts`'s `cleanCastCap` field,
its module header, `SESSION_64_LIMITS`, the `clean_cast_cap` verdict message,
and `scripts/eraCatchRate.ts` §5.

`SESSION_64_LIMITS.cleanCastCap` keeps its `6`: that constant records what
session 64 RAN — the module's own rule is that a shape is history, not a
setting — and no live shape carries a non-null cap. No replacement tripwire was
invented, per the ruling.

### §D — the 9-cast batch (QUESTIONS.md §45)

Preflight: ledger 11 casts available, **43** Relaxing Oils held (Focus 0),
`--dry-run` clean. The cap is structural, not a flag: **`SESSION_98_LIMITS`**
(new) sets `castCap: 9` with its nine casts justified at the constant, as
session 66 §4 requires — the rod's headroom, not the ledger's.

**Result: 9 casts, 6 caught = 66.7%, exact 95% CI [29.9%, 92.5%].** 8 oils
consumed. Halted on `cast_cap`, the intended exit.

That interval contains **every** baseline — the `focusDry` era (50.0%),
`oilSupplied` (62.9%), all-time (38.2%), today's policy era (55.5%) **and
session 96's 3/10 = 30.0%**. Fisher's exact on the two batches (3/10 vs 6/9)
gives **p = 0.179**. **So this batch settles nothing on its own, and neither
batch is evidence the autofisher changed.** That is the same framing session 97
established and it applies to the good result exactly as it applied to the bad
one.

Era-level, after folding these 9 casts in: `focusDry` **26/52 = 50.0%**
[36.9, 63.1] (was 20/43 = 46.5%), against `oilSupplied` 62.9% — the gap is now
−12.9pp with **overlapping intervals**, i.e. still NOT SUPPORTED.

**⚠ THE GATE AT 0.85 HAD FOUR OPPORTUNITIES AND WITHHELD ZERO — and the reason
matters more than the count.** From the batch's own `oil_shadow` records:

- **single-lethal turns (`0 < fishHp <= 2`): ZERO.** The arm the corpus
  measurement above is about never arose. Every `bestKillProbability` in the
  live record is null for this batch.
- **double-lethal band turns (`2 < fishHp <= 4`, ≥2 oils held): FOUR**, and the
  band's own gate — same constant — fired the pair on all four. Those turns had
  mana 9, 8, 7 and 1, so the bot was nowhere near 85% sure; withholding would
  have been wrong there.

So the first live read of 0.85 is **"no opportunity to observe it"**, not
"confirmed" and not "still inert". The 9-of-24 corpus figure and this batch's
0-of-4 are consistent: they are different arms of the same threshold.

**Opening focus spend: 0.83** [0.69, 0.97] at n=119 (was 0.82 at n=110) —
unmoved by another 9 casts. **§2e's stated reopening condition is NOT met:**
today's-era turns-at-focus-zero is **24.3%** (was 23.0%) against the ~40% bar,
and fish-at-full is 37.0%. `costCap` stays retired and `focusBudget.ts`'s
guardrails stay unwired.

**Redraw shadow, cumulative across every batch it has run in:** 0/52, 4/24,
0/2, 0/43, 2/40 = **6 fires in 161 shadow card decisions (3.7%)**, plus 12
turns that reached no card decision. `redrawEnabled` is still false and the bot
did not redraw.

**Matcher volume:** this batch contributes toward the 87–122 matcher-active
turns session 97 priced. It does not close anything, and no matcher claim is
made from it.

**The rod:** nothing in this repo can read durability (`rodDeck.ts` — the
account owner is the only sensor), so "the rod showed no signs of failing" is
NOT a claim this session can make. What can be said is that all 9 casts
completed and none halted early. The user's replacement is the next event.

---

## §47 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — THE ROD WAS SWAPPED, AFTER SESSION 98, FOR A NEW ONE WITH A NEW DECK

**Session 98's open question #1**, verbatim ruling: *"yes it's swapped now
after the session."* Confirms the swap happened, and that it happened
**after** session 98's 9-cast batch — so every fixture and pin from session
98 and earlier is still on the OLD rod's deck; nothing needs retroactive
correction, but the NEXT live fishing activity is on a new one.

**What this requires of the next session that casts anything:**

- **Do not assume `REAL_DECK` transferred.** Check `GEAR_CID_array` on the
  first live response against the OLD rod's known ids before trusting any
  deck-composition assumption — the Makeshift/Shroom break (session 87-89)
  is the standing precedent for why this gets checked, not inferred.
- **Expect a fresh baseline requirement**, not a continuation of the
  existing one. `rodDeck.ts` and any pinned test keyed to the current deck
  should be treated as describing the OLD rod until the new one is
  confirmed and captured.
- **State plainly, in whichever session first casts on the new rod, whether
  the deck actually changed** (it may not, if the new rod grants the same
  card set) — don't assume a new rod implies a new deck just because it's
  the more interesting finding.

---

## §48 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — DO NOT REVISIT `DEFAULT_FOCUS_RESERVE_WEIGHT`

**Session 98's open question #2**: the ΔEV/step report found the reserve tax
binds on 48.9% of decision points overall and 90.8% at distance 3 (median
ΔEV/step −0.01 there) — session 98 deliberately did not recommend a change
and left it as the user's call. **The user's ruling: leave it.**

**This closes the question, not just defers it.** No follow-up sweep, no
weight change, no re-litigating this the next time a binding-fraction number
looks high in a report. If the underlying numbers move enough to matter
again, that's a fresh finding earning a fresh ask — this entry is not a
standing invitation to revisit on the strength of the same data.

---

## §49 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — PROCEED WITH THE §26 REDRAW SHADOW ANALYSIS

**Session 98's open question #3**: 161 cumulative shadow decisions, 6 fires,
with the honest caveat that *whether that's enough for an out-of-sample
verdict had not been computed*. **The user's ruling: yes, proceed.**

**What this authorizes, precisely.** It authorizes attempting the analysis
now rather than waiting for more volume — it does **not** pre-certify that
161 is statistically sufficient. That's still a computation, not a
judgment call, and the session that does this work must run it honestly:
compute the actual power/confidence the data supports, and if 161 turns out
to be thin for the effect size in question, **say so explicitly rather than
forcing a verdict** the same way session 97 priced the matcher question
instead of leaving it vague. A green light to start the work is not a green
light to round up the result.

**What stays untouched regardless of what the analysis finds:**
`redrawEnabled` and `REDRAW_THRESHOLD`. Enabling redraw live is the user's
call per §26/§28's standing text, not a conclusion this analysis gets to
reach on its own even if the verdict comes back favorable.

---

## §50 ANSWERED [conversation with the user, 2026-08-25, outside a numbered session] — THE MATCHER-LIBRARY QUESTION: NO NEW ACTION, KEEP ACCUMULATING NATURALLY; DO NOT SHAPE A BATCH TO OBSERVE THE 0.85 GATE

**Session 98's open questions #4 and #5.** On the matcher-library volume
question (still priced at 87–122 matcher-active turns), the user's answer
was **"ok"** — read as: continue accumulating through ordinary batches,
nothing dedicated. On whether to deliberately shape a future batch to give
the 0.85 necessity-gate threshold a single-lethal turn to actually fire on,
the user's answer was **no** — let it happen naturally or not at all;
do not engineer a cast toward `fishHp <= 2` specifically to observe it.

---

## §51 ANSWERED [session 99 §3, 2026-08-26] — THE §26 SHADOW VERDICT: **CONSISTENT, AND UNDERPOWERED — BOTH HALVES ARE THE FINDING.** GAP 1 IS **STRUCTURALLY** UNREACHABLE FROM THE SHADOW, NOT MERELY SHORT OF DATA

**§49 authorized attempting this analysis without pre-certifying that 161
observations were enough, and required that an underpowered result be reported
as underpowered rather than rounded up.** It is underpowered. It is also
consistent. Both sentences are true and neither is the headline on its own.

`scripts/redrawShadowAnalysis.ts` is new and is the re-runnable instrument the
brief asked for, in the shape of `redrawTriggerCalibration.ts` /
`redrawCounterfactual.ts` rather than as a one-off calculation.
`tests/fishing/redrawShadowAnalysis.test.ts` pins its arithmetic.

### The two arms

| | fires | decisions | rate |
|---|---|---|---|
| **OUT-OF-SAMPLE** (`logs/`, sessions 90–99) | 6 | 170 | **3.53%**, exact 95% CI **[1.31%, 7.52%]** |
| **IN-SAMPLE** (`fixtures/`, same rule) | 17 | 553 | **3.07%** |

Per batch: 0/52, 4/24, 0/2, 0/43, 2/40, **0/9** — the last being session 99's
two casts. 12 turns reached no card decision at all (the instrument's counted
blind spot). 0 rows carried a sanity flag or error.

⚠ **The denominators are easy to get wrong and the recap's number depends on
it.** `grep -c redraw_shadow logs/*.jsonl` returns 214, not 170, because
`redraw_shadow_no_decision` shares the prefix. A turn with no card decision has
no redraw decision to shadow and is not part of the firing-rate denominator.

### §2 — the power computation, run BEFORE the verdict

Against H0 = the in-sample 3.07%, at n = 170, α = 0.05:

```
  truth = 1.5x in-sample (4.61%)   power  26.06%
  truth =   2x in-sample (6.15%)   power  60.27%
  truth =   3x in-sample (9.22%)   power  95.69%
  truth =   5x in-sample (15.4%)   power 100.00%
```

- **Minimum detectable effect at 80% power: 2.38x the in-sample rate.**
- **~350 card decisions** would be needed for 80% power at a **2x** departure —
  about **7 more batches** at the recent average, on top of the 170 held.

That is the number to quote when asking for more volume, priced the way session
97 priced the matcher question at 87–122 turns rather than leaving it vague.

### §3 — the verdict

Two-sided exact binomial test of 6/170 against 3.07%: **p = 0.6545, NOT
REJECTED.**

**What it licenses.** The candidate is not firing wildly more often on hands it
has never seen. That is precisely the refutation `redrawShadow.ts`'s own header
pre-registers — *"a trigger that fires ten times more often live than it did on
the corpus is refuted as a calibrated rule before any outcome question is
asked"* — and at 10x the test has 100% power, so **that specific refutation is
genuinely excluded**, not merely unobserved.

**What it does not license.** It is not evidence the trigger is GOOD: no outcome
is observed, because the bot really plays the card and the counterfactual is
unobservable live. And a non-rejection at 60% power against a 2x departure is
weak — **anyone quoting the non-rejection without the 2.38x MDE beside it is
quoting absence of evidence as evidence of absence.** The test pins that pairing
so it cannot be separated silently.

### §4 — GAP 1 (§28): **NO, and not for want of volume**

The two candidate `FISH_MOVED` semantics — **(a)** redraw is a turn the
predictor learns from, **(b)** redraw is a turn it skips (what ships) — differ
**only in what happens to the predictor's bookkeeping on a turn a redraw
actually happened.**

**A shadow never redraws. That is its defining property.** So no shadow row, at
any n, ever sits on the turn where (a) and (b) disagree. `redraw_sent` rows in
every log on this machine: **0**, and the `fishFrom`/`fishTo`/
`observedByMatcher` fields session 95 added ride on that line.

⚠ **§28 said the §26 shadow "or the recalibration" would close gap 1. On the
shadow half that expectation is wrong**, and it should stop being repeated as a
volume problem. Closing gap 1 needs redraw **armed** live, which is §26/§28's
standing user decision.

### A stale number found on the way

`scripts/liveFishing.ts` printed *"in-sample 2.7%"* beside every batch's shadow
line. That literal was written in session 90 and the corpus has grown 42 casts
since; the true figure is **3.07%**. Now a named constant, re-derived by the new
script, and **pinned against the corpus by the test** so the next drift fails
the suite instead of quietly mis-hinting an operator.

### Unchanged

**`redrawEnabled` stays `false` and `REDRAW_THRESHOLD` stays `0`**, per §49,
whatever the verdict. This analysis reports; it does not enable.

---

## §52 ANSWERED [conversation with the user, 2026-08-26, outside a numbered session] — WIRE `DURABILITY_CID` INTO THE FISHING PREFLIGHT

**Session 99's open question #1**: `GET /gear/instances/{address}` publishes
`DURABILITY_CID` directly (Golkan 40 at equip; Shroom read 0 when it ran
dry) and nothing consumes it — three sessions (89–91) reconstructed
durability indirectly from dealt decks while the server had it the whole
time. **The user's ruling: proceed.**

**What "proceed" requires, precisely, so it doesn't repeat the mistake it's
fixing.** Reading a durability number and acting on it correctly needs one
thing this repo does not yet have: **the per-cast decrement rate.** Session
99 recorded exactly one data point — Golkan equipped at 40, two casts played
on it since — and did not record the post-batch reading. **Do not assume a
linear ~1-unit-per-cast rate or any other formula.** The scoped work is:

1. Call `/gear/instances/{address}` (or reuse it if a live fishing response
   already bundles the same gear-instance data — check before adding a new
   network call) at the START of a live batch and log the reading, the same
   way oil stock is checked before a batch today.
2. **Fail-closed, not predict-forward, for the first version.** We know 0
   means "ran dry" (Shroom). A preflight that halts or warns when durability
   reads at or near 0 is buildable now, on data already in hand. A preflight
   that predicts "N casts of headroom remain" needs the decrement rate,
   which needs at least two readings bracketing a known cast count — that
   doesn't exist yet.
3. **Start recording the reading before and after each live batch** as a
   new, small piece of instrumentation, so the decrement rate becomes
   derivable from ordinary play rather than a dedicated experiment. Once
   there are a few paired readings, a future session can fit the rate and
   upgrade the preflight from fail-closed to predictive.
4. This replaces the user's own self-reported "~40-cast estimate" as the
   authority once it's wired and reads a real number — but not before it has
   been cross-checked at least once against an actual observed rod failure,
   the same discipline rule 9 asks of everything else this repo measures.

---

## §53 ANSWERED [conversation with the user, 2026-08-26, outside a numbered session] — GOLKAN IS THE STANDING ROD, UNTIL FURTHER NOTICE

**Session 99's open question #2** asked when `CORPUS_DECK` should repoint
from Shroom to Golkan (2 of 210 corpus casts are Golkan; the standing rule
is repoint when the ratio inverts). **The user's ruling, verbatim:** *"golkan
will be the rod of choice until further notice."*

**This does not, by itself, trigger a repoint.** It answers a different but
related question: there is no planned swap back to Shroom, so every future
cast will be Golkan and the ratio will move in exactly one direction from
here. **The existing "repoint when the ratio inverts" rule stays the
mechanism — no new numeric threshold is being set**, because the user
didn't set one and an agent shouldn't invent one (rule 9 territory: a
threshold picked by an agent rather than derived or directed is exactly the
kind of unverified confidence this repo has been correcting). What changes
is that whoever tracks the ratio going forward can now assume it moves
monotonically toward Golkan rather than possibly reversing, which makes
"the ratio inverts" a when-not-if question for the first time.

**No code change from this entry alone.** `rodDeck.ts`'s `CORPUS_DECK`
stays Shroom until the ratio condition is actually met.

---

## §54 ANSWERED [conversation with the user, 2026-08-26, outside a numbered session] — THE `triggeredBoons` EMPTY-FIELD QUESTION IS A REQUIRED ITEM FOR THE NEXT SESSION, NOT RESOLVED HERE

**Session 99's open question #3**: `triggeredBoons` — the field that would
evidence a boon actually procing — was empty on every recorded state across
all 214 POSTs of a full 4-run day, and it gates `CAPTURE-1` (a silent,
never-firing evidence channel would make the five-rolled-stats model
unreachable by ordinary play, however many runs are spent). **The user's
ruling: write this into the next session as a resolution requirement**,
rather than answer it in conversation.

**This entry does not resolve the question — it records the requirement.**
See `handoff/next.md` §C for the scoped investigation. Whoever picks that up
should treat it as blocking: don't let it become a sixth item carried
forward unresolved the way `OIL-CONSERVE.md` sat for 29 sessions. Check the
FULL corpus (all 79 dungeon attempts), not just session 99's 4, before
concluding anything about whether the field ever populates.

---

## §55 ANSWERED [conversation with the user, 2026-08-26, outside a numbered session] — TOMORROW'S FISHING BATCH IS 20 CASTS, THE FULL DAILY CAP

**Session 99's open question #4** (the 0.85 necessity gate has gone three
straight batches with zero opportunities, at a natural arrival rate too low
to observe it at 1-2 casts/day) is not being solved by shaping a batch
toward it — §50 already ruled that out and stands. **The user's ruling
instead: tomorrow's batch is 20 casts** — the full daily cap, not another
small increment.

**This is a volume decision, not a targeting one — the distinction
matters and should be preserved in how the next session reports it.** A
20-cast batch raises the natural odds of a single-lethal turn arising
without engineering toward one, which is consistent with §50's ruling, not
a reversal of it. Report whatever the gate does (or doesn't do) as an
observation of ordinary play at higher volume, not as a targeted test.

**Timing:** both daily ledgers were EXHAUSTED as of session 99 (fishing
20/20, dungeon 12/12), resetting 11:00 Pacific. This batch runs whenever a
session executes after that reset — it does not have to be the very next
session chronologically if that session runs before the reset.

---

## §56 ANSWERED [conversation with the user, 2026-08-26, outside a numbered session] — THE DUNGEON DEPTH-CONFIDENCE GAP STAYS OPEN, NO ACTION

**Session 99's open question #5** (the opponent model is weakest exactly at
the deepest, highest-stakes rooms — room 10 reported `confidence=low` on
n=5 — which compounds because a death there forfeits the most accumulated
Hard Core). **The user's ruling: leave open.** No task, no brief item, no
threshold set. Carry it forward as a standing observation only; do not let
a future session interpret silence on this as license to invent a fix
unprompted.

---

## §57 ANSWERED [session 100 §B] — `triggeredBoons` IS NOT THE PROC CHANNEL. `data.events[]` IS, IT HAS POPULATED SINCE 2026-08-14, AND IT UNBLOCKS CAPTURE-1

**The question (§54, session 99's open question #3):** `triggeredBoons` — the
field that would evidence a boon actually procing — was empty on every recorded
state across all 214 POSTs of a full 4-run day. Does it ever populate? A
silent, never-firing evidence channel would make CAPTURE-1's five-rolled-stats
model unreachable by ordinary play, however many runs get spent chasing it.

**Verdict, in one line: the field is real, it has never once populated, and it
does not matter — because it was never the channel.**

### 1. `triggeredBoons` has never been non-empty. Not rare — never.

Measured over the whole committed corpus, every run dir, both players, every
captured state (`scripts/procEvidence.ts`):

```
  triggeredBoons occurrences        10616      (= 5308 states x 2 players, exactly)
  triggeredBoons NON-EMPTY              0
```

Session 99 saw the same thing over four runs and could not tell "rare" from
"never". Over 93 run dirs spanning 2026-08-13 to 2026-08-26, it is never.

### 2. It is NOT a capture-path gap, and that had to be ruled out separately.

The obvious competing explanation — the pipeline strips array fields off the
player object — is false. Five sibling arrays on the *same object* populate:

```
  activeEffects   10286 / 21268 non-empty        gearBoons    8346 / 21268
  pickedBoons      9036 / 21268                  statusEffects 4900 / 21268
  focusBuffs          54 / 21268   = 0.25%
```

`focusBuffs` is the one that settles it: it populates on a quarter of one
percent of states and it still gets through. A path that captures a 0.25%
sibling is not a path that would silently drop `triggeredBoons` in 21,268
consecutive chances.

### 3. The proc channel is `data.events[]`, and this repo has kept it since session 08.

Every dungeon ACTION response carries an event log. Its `use_move` rows carry a
**per-exchange, per-side boolean for each of the five rolled stats**:

```json
{"type":"use_move","value":"rock","playerId":0,"batch":0,
 "data":{"blockProc0":false,"evadeProc0":false,"critProc0":false,
         "intuitionProc0":false,"tenacityProc0":false}}
```

Measured, n = 1919 exchanges per side:

```
  flag              stat        fired /     n       rate     fired when stat==0
  blockProc0        block         90 /  1919      4.69%      0 / 299
  blockProc1        block         22 /  1919      1.15%      0 / 918
  critProc0         lck           24 /  1919      1.25%      0 / 1012
  critProc1         lck           25 /  1919      1.30%      0 / 943
  evadeProc0        evasion        6 /  1919      0.31%      0 / 1691
  evadeProc1        evasion       31 /  1919      1.62%      0 / 928
  intuitionProc0    intuition      6 /  1919      0.31%      0 / 1354
  tenacityProc0     tenacity      17 /  1919      0.89%      0 / 1172
  tenacityProc1     tenacity      19 /  1919      0.99%      0 / 932
```

**The right-hand column is the load-bearing one.** No flag has ever fired while
its own stat read zero, across 299 to 1691 zero-stat observations each. That is
what makes this a MAPPING rather than a naming coincidence — and it resolves
`lck` as **crit chance**, which SPEC §4e listed as unknown semantics.

Two independent corroborations, neither of which was engineered:

- `intuitionProc0` fired **6** times and the corpus holds exactly **6**
  `intuition_block` events (`{"blockedMove":"rock"}` etc.). Same number, and
  they identify the same turns.
- There is **no `intuitionProc1` flag at all**, and the enemy's `intuition` is
  zero in all 5308 states. The server does not report a roll the enemy cannot
  make.

Proc rate rises with the stat roughly as expected (block 10 → 8.5%, crit 2 →
3.0%, evade 2 → 3.3%), i.e. on the order of 1 percentage point per point.
**That last sentence is an observation, not a fitted model** — do not lift it
into code.

### 4. This was predicted in `src/api/schemas.ts` in session 08 and never followed up.

The schema has carried `events: z.array(z.unknown())` since 2026-08-14, with a
comment saying: *"worth watching: a structured event log of what an action
caused is a much better signal than diffing `run` before/after, if later actions
populate it for room clears, kills, boon picks, etc."* They populate — from
2026-08-14 onward, including all four of session 99's runs. Nothing on the
dungeon side has ever read it, while the FISHING side
(`src/sim/fishing/castTrace.ts`) has been reading its own `data.events[]` all
along.

**This is the same failure as §52's, one week and one endpoint apart:** the
data was published, a field was looked for in the wrong payload, and its
absence there was read as its absence everywhere. Third occurrence
(`/gear/items` vs `/offchain/static` in session 70, the FISHING doc vs
`/gear/instances` in session 99, and now `run.players[]` vs `data.events[]`).

### 5. What this does to CAPTURE-1

**It does not gate it. It unblocks the capture half of it.** CAPTURE-1 said the
proposed proc branches need proc RATES, "1-5% events wanting hundreds of
observations each (SPEC §4e)" — and the corpus already holds **1919 exchanges
per side**, with rates landing in exactly that 0.3-4.7% band, on data that cost
nothing to collect because it was already committed.

**What is still NOT resolved, and must not be papered over:**

- **Rates are not mechanics.** Knowing `blockProc0` fires 4.69% of the time
  does not say what `block` DOES when it fires (a full negate? a reduction? by
  how much?). That is a second measurement — diff the HP/shield deltas on
  fired vs unfired exchanges — and it has not been done.
- **`Weak`, `Vulnerable`, `Burn`, `Regen` and lifesteal are untouched by this.**
  They surface in `statusEffects`, not in the proc booleans, and CAPTURE-1
  lists them separately.
- **Nothing here licenses stubbing `src/sim/combat.ts`.** CAPTURE-1's "do not
  stub it, default it, or hide it behind a flag" stands unchanged. This entry
  moves one input from unobtainable to obtained; it does not authorise
  building the model, and the per-stat effect sizes are still missing.

### 6. Reproducing this

`npx tsx scripts/procEvidence.ts`, re-runnable as volume accumulates.
`tests/procEvidence.test.ts` pins both claims — the never-populated field and
the zero-stat control — so a corpus change that breaks either is visible.

---

## §58 ANSWERED [session 101 §A + §B] — THE CAPTURE PATH IS COMPLETE, AND FOUR OF THE FIVE ROLLED STATS NOW HAVE AN EXACT EFFECT SIZE

### 1. §A — `data.events` is not being dropped. Every state is accounted for.

STATE.md session 100's open question 3 asked whether the capture path was
losing proc evidence: `data.events` was present on only **2093 of 5308**
canonical states, and if some of the 3215 without it were exchanges, then
§57's `n = 1919` was an undercount and evidence had already been lost.

**It is not.** The 5308 states partition exactly, with no remainder:

```
  2687   GET /game/dungeon/state reads      (actionToken == 0)   0 carry events
   265   enemyPath POST responses           the offer, no exchange
   263   path-SELECTION POST responses      fresh un-acted enemy, no exchange
    66   dungeon_started (start_run)        events, no use_move
   108   use_item / OnHeal (potion)         events, no use_move
  1919   exchange responses                 events, exactly 2 use_move each
  ----
  5308                                      3838 use_move rows = 1919 x 2
```

The classifier needs no new capture. `scripts/liveRun.ts:1191` writes the
loop's `GET` read before every POST, and `client.getDungeonState` documents
that the GET reports `actionToken: 0` regardless of run state — so
`actionToken === 0` separates reads from responses, and **2687 of 2687 reads
lack events**, zero exceptions. A read caused nothing, so it reports nothing.

The 263 that look like combat but carry no events are the response to a path
selection, which returns the NEXT room's opening state. All 263 have the foe at
`health.current === health.currentMax` with `lastMove === ""` while the player's
`lastMove` is set — a fresh enemy that has not acted. **263 of 263, zero
exceptions.**

**The decisive statement:** every POST response in which an exchange actually
resolved — foe `lastMove` non-empty — carries `data.events`. **1919 of 1919.**

The eventless share is also flat across every capture date (17-24% of POST
responses, 2026-08-14 through 2026-08-26), so this is structural, not a
regression that crept in. **§57's `n = 1919` stands uncorrected.**

### 2. §B — the instrument, and the null that makes it a measurement

The same `data.events[]` carries the resolved arithmetic beside the proc
booleans:

```json
{"type":"OnDamage","value":10,"playerId":0,
 "data":{"ignoreShield":false,"prevent":0,"source":""}}
```

Two properties, both verified rather than assumed:

- **`playerId` on `OnDamage` names the VICTIM, not the dealer.** Checked
  against a state diff (`run-2026-08-15-01-53-36/state-012`): player 0 entered
  with 0 shield, the events show `OnApplyShield 12` then `OnDamage 10` both at
  `playerId: 0`, and the response reports shield 2.
- **`data.source` separates combat damage (`""`, 2591 rows) from burn ticks
  (`"burn"`, 522).** Every number below filters to `source === ""`.

**`data.prevent` is NOT the block instrument, despite the name.** It reads 0 on
all 2591 combat rows, including all 76 on which a block procced. Anyone
reaching for the obvious field here will find nothing; the effect is in the
`value`.

**The null.** `src/sim/combat.ts` resolves by RPS — winner deals its move's
ATK, a tie has both deal, loser deals nothing. So the baseline prediction for
damage taken is the attacker's `currentATK`, read off the preceding state. On
no-proc exchanges that prediction is exact **2211 / 2285 (96.8%)**.

### 3. The results

Restricted to exchanges where the attacker owed damage, excluding the opposing
multiplier, against a matched control holding the same stat non-zero unfired:

```
  flag          predicts       status-clean          all       control (stat>0, unfired)
  blockProc0    floor(ATK/2)   33/33  [90-100%]    53/56              0/1041
  blockProc1    floor(ATK/2)    8/8   [68-100%]    19/19               0/619
  evadeProc0    0               2/2   [34-100%]      4/4               0/149
  evadeProc1    0               9/9   [70-100%]    22/22               0/605
  critProc0     2*ATK           9/9   [70-100%]    13/14               0/558
  critProc1     2*ATK          11/11  [74-100%]    16/17               0/605
```

**Verdict per flag:**

- **`block` — PARTIAL REDUCTION, exactly `floor(ATK/2)`.** Not a negate: of 76
  fired exchanges, **0 took zero damage**. Odd ATK rounds down (ATK 15 → 7
  taken), so it is floor and not a rounded half.
- **`evasion` — FULL NEGATE.** 26 of 26 fired exchanges took exactly 0, and
  this one is status-robust (0 is 0 regardless of what else is modifying
  damage).
- **`lck` — CRIT, exactly `2 x ATK`.** Session 100 established `lck` is crit
  chance from the zero-stat control; this gives the magnitude.
- **`tenacity` — NOT damage mitigation, mechanic UNDETERMINED.** See §4.
- **`intuition` — NOT damage mitigation, mechanic UNDETERMINED.** See §4.

**The control column is the load-bearing one, and it is 0 on every row.**
Across 3577 matched control exchanges — same stat non-zero, flag unfired — the
rule matched **zero times**. That is what separates a mechanic from a
correlation, and it is a stronger result than any of the confidence intervals.

**The intervals are wide and are reported wide.** `evadeProc0`'s status-clean
sample is 2, and 2/2 is not 100% — its Wilson interval starts at 34%. The
per-flag intervals are not the claim; the perfect separation against a control
in the hundreds is.

### 4. What is NOT resolved, stated as thin because it is thin

- **`tenacity` does something, and it is not damage.** Matched on
  `tenacity > 0`, damage taken tracks the null. What moves is `OnHeal`:
  **11.8% [3.3-34.3%] fired vs 1.6% [0.9-2.9%] unfired** on the player side,
  **21.1% [8.5-43.3%] vs 5.2% [3.9-6.7%]** on the enemy's. Both pairs of
  intervals are non-overlapping, so the association is real — but that rests on
  **6 heals total**, and the heal AMOUNTS (2; 4, 6, 8) cannot be bounded at
  that volume. **Recorded as an association, not a mechanic.**
- **`intuition` denies a MOVE, it does not reduce damage.** All 6
  `intuitionProc0` fires carry an `intuition_block` event with a `blockedMove`,
  and **5 of 5 non-blocked fires took the attacker's FULL ATK**. The sixth
  looked mitigated and was not: it also carried `blockProc0` and took exactly
  `floor(ATK/2)` — that is block. In **2 of 6**, `blockedMove` names a move
  DIFFERENT from the one the enemy actually played, which points at move denial
  rather than damage handling. **n = 6. Not enough to say more.**
- **`Weak`, `Vulnerable`, `Burn`, `Regen`, lifesteal — untouched, and they are
  the residual.** Every one of the 74 no-proc exchanges the null misses, and
  every one of the 6 proc exchanges that misses its rule, carries a non-empty
  `statusEffects` array on one side. Restricted to status-clean exchanges the
  rules hold **72 / 72**. The statuses are the entire error term.

### 5. One composition rule, found by accident and worth keeping

`run-2026-08-23-05-53-49/state-108`: `critProc1` and `blockProc0` both fired,
attacker ATK 14, damage dealt **14**. Crit doubles and block halves, and they
**compose multiplicatively** — `2 x 0.5 = 1.0`. One observation, so it is a
hypothesis with a mechanism, not a measured rule; it is recorded because it
also explains an outlier that would otherwise read as noise.

### 6. This does not authorise building the model

CAPTURE-1's prohibition is unchanged: **do not stub, default, or flag-hide the
proc branches in `src/sim/combat.ts`.** Two of the five rolled stats still have
no mechanic, the statuses that account for the entire residual are still
unmeasured, and STATE.md session 100's open question 2 — should the live loop
read the proc booleans in real time — stays deferred. This entry moves three
stats from "rate only" to "rate and effect size"; it does not close CAPTURE-1.

### 7. Reproducing this

`npx tsx scripts/procEffectSize.ts`, re-runnable as volume accumulates.
`tests/procEffectSize.test.ts` pins the null, all three rules, and the
zero-matching control — on a bounded slice, with slice-safe assertions, since
`evadeProc0` and `intuitionProc0` fire 6 times each in the whole corpus and any
honest slice can contain none.

---

## §59 ANSWERED [session 101 §D] — THE STATUSES WERE NEVER UNCAPTURED. FOUR OF SIX ARE NOW EXACT, `lifesteal` DOES NOT EXIST, AND `amount` MEANS THREE DIFFERENT THINGS

**Why this was done instead of waiting for the fishing reset.** §58 established
that the statuses account for the ENTIRE residual of the proc measurement:
every exchange that missed the null, and every proc exchange that missed its
rule, carried a non-empty `statusEffects` array; status-clean, the rules held
72/72. CAPTURE-1 has listed `Weak`, `Vulnerable`, `Burn`, `Regen` and lifesteal
as needing capture since it was written. **They needed no capture.** They are on
every player object in the corpus, exactly like `data.events[]` was in §57.

**This is the fourth instance of the same failure**, and it should stop being
surprising: session 70 (`/gear/items` vs `/offchain/static`), session 99
(fishing doc vs `/gear/instances`), session 100 (`run.players[]` vs
`data.events[]`), now this. A field's absence from the payload a repo happens to
read is not its absence from the API — and a TASKS entry saying "we need to
capture X" is a claim about the repo's reading habits, not about the server.

### 1. What the corpus contains — six statuses, not four

```
  Burn 1388    Weak 477    Vulnerable 427    SecondWind 223    Regen 176    Steadfast 65
```

- **`SecondWind` and `Steadfast` are not in CAPTURE-1's list at all.**
- **`lifesteal` IS in that list and does not exist.** There is no status by that
  name and no proportional heal anywhere in the corpus. See §4.

### 2. `amount` means three different things. This is the trap.

Every entry is `{type, amount}`. Read as a magnitude everywhere — the obvious
reading — it is wrong on half the types:

| type | what `amount` is |
|---|---|
| `Burn` | magnitude. The tick equals it exactly. |
| `Regen` | magnitude, spent down. Heals its value, then decrements by 1. |
| `SecondWind` | magnitude, stored. Heals its value ONCE, then sits at 0. |
| `Weak` / `Vulnerable` | **not a magnitude.** A countdown; the multiplier is fixed. |

**And `amount: 0` means INERT, not "present and cleared."** A `Weak` at 0 leaves
damage at exactly 1.000x the attacker's ATK — indistinguishable from having no
`Weak` at all — verified **59/59, 37/37 and 25/25** on `Weak`, `Vulnerable` and
`SecondWind`. **Zero is the single most common amount on four of the six types**
(`Weak` 320/477, `Vulnerable` 230/427, `SecondWind` 135/223, `Steadfast` 35/65).
Anything that tests `"Weak" in statusEffects` instead of reading the amount will
be wrong on the MAJORITY of occurrences. `tests/statusEffects.test.ts` pins this
specifically.

### 3. The measured mechanics

```
  Burn        tick === AFTER-state amount              522/522   100%
  Weak        damage dealt === floor(ATK * 0.75)         33/33   independent of amount (1: 30/30, 2: 3/3)
  Vulnerable  damage taken === floor(ATK * 1.25)         34/34   independent of amount (1: 26/26, 2: 5/5, 3: 1/1, 4: 2/2)
  Regen       heals its amount, if the unit survived     53/53   100%
              then decays by 1, same exchange            60/60   100%
  SecondWind  when spent, heals exactly its amount       10/10   100%
              while held, does nothing                   28/28   100%
  Steadfast   no effect on damage, either role           UNDETERMINED (n=23)
```

Three details that only appear if you check the residual instead of reporting a
percentage:

- **`Burn` matches the AFTER-state amount, not the before-state one.** A burn
  applied this exchange ticks the same exchange — 161 of 522 ticks had no prior
  burn at all — and a burn re-applied on top stacks before ticking (4 -> 8, 6 ->
  12). Measured against the before-state it looks like a 303/522 rule with two
  families of exception; against the after-state it is exact. **The order is:
  apply, then tick.**
- **`Regen` does not heal a unit that DIED this exchange, but its counter still
  decays.** All 7 apparent exceptions were lethal exchanges — incoming damage at
  or above the unit's HP. Excluding them takes the rule from 53/60 (88.3%) to
  53/53. This was found by looking at the seven, not by rounding 88.3% up.
- **`Burn` does not decay on its own.** 0 of 522 decremented; it holds its value
  and then clears outright. `Weak` and `Vulnerable` DO decrement, within the
  exchange (1 -> 0, 38 and 46 times).

### 4. `lifesteal` does not exist, and the heals it was invented to explain are something else

22 heals are explained by no status and no proc. If lifesteal were real they
would sit at a constant fraction of damage dealt. They do not: **ratios run 0.20
to 0.80, and one heals 2 having dealt 0 damage.** What they actually are is
**constant within a run** — one value per run per side, always 2 or 4, the enemy
side always 4. That is the signature of a flat per-exchange effect from a boon
or an enemy trait, not a proportional one. **Mechanism undetermined; lifesteal
is ruled OUT** and should come off CAPTURE-1's list rather than staying on it as
an unmeasured item.

### 5. What is still open, stated as thin because it is thin

- **`SecondWind`'s TRIGGER.** The magnitude is exact and the trigger is not
  determined. It is **not** lethality and **not** a fixed HP threshold: it fired
  at 40/40 HP against 10 incoming and held at 40/40 against 14 incoming. n = 10
  fires. Fitting a rule to that would be inventing one.
- **`Steadfast`.** No effect on the damage number in either role (10/10 and 6/6
  at exactly 1.00x). Debuff immunity is consistent with the data — 0 of 11
  exchanges gained a `Weak`/`Vulnerable` while `Steadfast > 0`, against 103 of
  3815 when absent — but at n=11 the expected count under NO effect is ~0.3, so
  **the observation is underpowered and proves nothing.** Recorded as consistent,
  not as established.
- **`tenacity` and `intuition` are unchanged from §58** — still ruled out as
  damage mitigation, still without a positive mechanic.

### 6. This still does not authorise building the model

CAPTURE-1's prohibition stands. What has changed is which gap is load-bearing:
the damage NUMBER is now almost fully accounted for, and what remains unmodelled
is two proc mechanics, one trigger condition and one status. That is a much
smaller list than CAPTURE-1 describes — and it is a list, not a green light.
STATE.md session 100's open question 2 (should the live loop read any of this in
real time) is still deferred and this session did not touch it.

### 7. Reproducing this

`npx tsx scripts/statusEffects.ts`, re-runnable as volume accumulates.
`tests/statusEffects.test.ts` pins every exact rule plus the inert-at-zero
claim, on a bounded slice with slice-safe assertions.

---

## §60 ANSWERED [session 102 §C] — THE 20-CAST BATCH: THE 0.85 NECESSITY GATE FIRED FOR THE FIRST TIME, THE ROD DECREMENT IS EXACTLY 1.00/CAST, AND TWO PINNED CLAIMS DIED

The brief was §55's twenty-cast batch — the full daily cap, set as a VOLUME
decision, not a shaped attempt to observe the necessity gate (§50's ruling,
unchanged). The ledger had reset (0/20 on arrival), the batch ran clean, and
both ledgers agree at 20/20 spent afterwards.

Everything below is an observation of ordinary play at higher volume.

### 1. The necessity gate finally had opportunities, and it used them

Four batches had gone by with **zero** single-lethal evaluations — §46 recorded
that session 98's gate "withheld NOTHING", not because it is inert but because
zero of its `oil_shadow` records carried a non-null `bestKillProbability`.

This batch produced **three**, and the gate withheld on two:

```
  04:14:45  turn 1  p = 0.9830  ->  WITHHELD   card played bare   CAUGHT
  04:17:32  turn 2  p = 0.5457  ->  PERMITTED  oil spent          CAUGHT
  04:18:08  turn 1  p = 0.9937  ->  WITHHELD   card played bare   CAUGHT
```

**Both withholds are the gate, not an artefact.** Ruled out explicitly: the
per-cast Relaxing cap of 2 (the first had 40 held with zero oils spent all
batch; the second was turn 1 of a cast started 5 seconds earlier with no prior
oil), and an empty bag (40 and 27 held). All three casts were caught, so the
two withholds saved an oil at **no observed cost**.

⚠ **The shadow arm is NOT independent confirmation.** It runs
`conserve(r=0.8333, f=1)` — `PREREGISTERED_EXCHANGE_THRESHOLDS`, not the user's
0.85 — and agreed with the live gate on all three, because 0.983 and 0.994 sit
above BOTH thresholds and 0.546 below both. Do not report it as corroborating.

**n = 2 withholds.** This is the gate's first live evidence, not a validation.

### 2. The rod durability bracket is closed: exactly 1.00 per cast

The first batch to take a real `before` AND `after` reading around live casts in
one session. Rod 812 (Golkan): **38 -> 18 over 20 casts, n = 20**. Session 99's
40 -> 38 over 2 casts gave the same 1.00, at n = 1; this makes it a measurement.

**Operational consequence, and it binds the NEXT session:** the rod now reads
**18**. At 1.00/cast a full 20-cast day exhausts it with 2 casts unspent. The
preflight is fail-closed (DECISIONS 2026-08-26), so the batch will halt rather
than break the rod — but the next batch cannot be a full cap unless the rod is
replaced or repaired first. That is a user decision, not an agent one.

### 3. The batch's numbers

- **14/20 caught = 70.0%**, exact 95% CI **[45.7%, 88.1%]**, Wilson
  [48.1%, 85.5%]. Best batch on record.
- ⚠ **Do not quote the all-time comparison on its own.** Against the pooled
  corpus (80/210 = 38.1%) Fisher gives p = 0.0079 — but that corpus spans
  several strategy eras, which is exactly the "transposed-era majority answers a
  different question" trap `scripts/focusBudgetSweep.ts:238` warns about.
  Against the recent-era live batches (s91 4/10, s92 5/10, s96 3/10, s98 6/9,
  s99 1/2; pooled **19/41 = 46.3%**) Fisher gives **p = 0.105 — NOT
  significant**. The honest statement: the best batch on record, and not
  separable from the recent era at n = 20.
- Corpus **210 -> 230 casts, 80 -> 94 caught** (38.1% -> 40.9%).
- **Oils: 13 Relaxing (937), 0 Focus.** Six casts spent 2 (double-lethal), one
  spent 1. The per-cast cap of 2 was reached six more times and **still did not
  bind** — fifth batch running. 19 `oil_trigger_policy_withdrawn` rows, the
  session-93 Focus withdrawal path working across a full batch. Stock 40 -> 27.
- **Opening focus spend UNMOVED**: 0.85 [0.52, 1.18] for the batch alone against
  the era's 0.82 [0.68, 0.96] at n = 121; era pooled now 0.82 [0.69, 0.95] at
  n = 141.
- **Redraw shadow**: out-of-sample **8 fires / 240 card decisions = 3.33%**
  [1.45%, 6.46%] against in-sample 3.04%; exact binomial **p = 0.7064, NOT
  REJECTED**. MDE at 80% power 2.32x. ~375 decisions needed for 80% power at a
  2x departure, so **~2 more batches of this size**, not the script's "~4 more
  batches" (which averages over the small historical ones). 0 redraws sent,
  0 sanity rows. §51's target is in reach for the first time.
- **Energy**: the preflight claimed 242 from the ROM bank (pool 45 -> 287) and
  spent 240. Rule 12 working as documented; not a blocker at any point.

### 4. `data.nextPosition` is an EXACT oracle — 21/21 all time

Every recorded occurrence has predicted the fish's next cell correctly:
**21/21** (exact 95% lower bound 83.9%), of which **9/9** with the override
actively steering focus (lower bound 66.4%). This batch added 3, all
`acted_hit`. Occurrence rate here: 4 non-null of 117 responses = **3.4%**,
consistent with the historical ~1-2%.

The standing framing — "statistically compatible with, not confirming, a 3%
Fintuition proc" (§12) — is about the RATE and is unchanged. What it
understates is the ACCURACY: the field has never once been wrong.

### 5. The "possible dual yield" detector was firing on every catch — FIXED

All five `possible_dual_yield_event` sightings on this machine (sessions 91, 93,
99 and two this batch) are **false positives**, and they share one shape:

```
  [{id:519, amount:1}, {id:935, amount:10}, {id:845, amount:320}]
```

Item **935 is the XP credit** — the same value the response carries as
`data.doc.data.caughtFish.xpItemId`, 5 of 5 dumps. `detectPossibleDualYield`'s
arm 2 excluded only `845` (Hard Core), so the XP credit read as a second
non-currency item. Arm 1 (`2+ FISH_DIED`) has **never** fired.

This mattered rather than merely being noisy: **a real dual yield would have
looked identical to the noise on arm 2**, so the signal the detector exists to
catch was already indistinguishable from ordinary play.

Fixed by excluding the response's OWN `xpItemId` — read off the payload, never
hardcoded to 935, the same self-validating rule as the rod preflight's
`GAME_ITEM_ID_CID` match. A genuine dual yield still trips arm 2 because it
credits two distinct FISH ids on top of the one XP id; pinned by five new tests.

### 6. TWO PINNED CLAIMS DIED ON THIS BATCH — both recorded, neither smoothed over

**(a) `redrawCounterfactual`'s "near-break-even" bound broke, and was NOT
widened.** `|rescues - sacrifices| / fires` for the unconditional threshold-3
trigger is **4/74 = 5.41%** against a 5% bound. Session 91 wrote that one more
growth in the same direction would break it and left an explicit instruction:
*"do NOT widen the bound: the honest reading is that near-break-even has stopped
being true, which is a finding."* It is followed. The ratio has run
0% -> 1.7% -> 4.76% -> 4.41% -> 5.41%, and the one dip was mechanical (frozen
numerator, growing denominator). The assertion is now a PIN on the measured
value. **This argues for nothing**: the trigger is unconditional, §3's finding
is that only the conditioned trigger is worth anything, and `redrawEnabled`
stays false per §49.

**(b) `damageEconomy`'s sim-vs-live drift ratio crossed its 10x bar: 9.97x.**
Decomposed at the batch boundary, and the cause is **live moving toward the sim,
not the sim moving**:

```
  pre-batch   165 casts / 709 plays   hitRate 39.2%   drift -0.2426
  this batch   20 casts /  70 plays   hitRate 48.6%   drift -1.4429
  pooled      185 casts / 779 plays   hitRate 40.1%   drift -0.3504
```

The batch landed damage at 48.6% against 39.2% and at a higher mean (6.18 vs
5.32 HP), so live's own drift grew 1.44x in magnitude. `bare` did not move.
The gap narrowed **because the bot played better**, which is the one direction
that makes this a result rather than an artefact. The bar is lowered to 5 and
that is **stated as a weakening**; if it keeps falling the answer is to
re-examine the conclusion, not to move the bar a third time. Nothing in flight
depends on it — OIL-POLICY §0a is already SUSPENDED.

### 7. Two more claims survived a much bigger test than they were built for

- **The era ruling (§32) held out of sample for a FIFTH batch.** All twenty new
  casts classified `focusDry`; `preOil` and `oilSupplied` are byte-identical.
- **The `focusDry` bucket-3 tell is STILL EXACTLY ONE**, now across 74 focusDry
  casts against `preOil`'s 17 in 94.

Two other pinned "trends" were falsified, and both are recorded in the tests
rather than here: `zoneTemplate`'s monotone narrowing of the two wrong readings
(6 -> 4 -> 2 -> 0, then REOPENED to 4 with the rank flipped back — session 90's
"noise between two wrong readings" is what stands), and `deckShuffle`'s
`toEqual([])` on sequential-draw matches (the first match appeared; the
uniform-shuffle null expects 0.199 over the 232 opening hands on record, so
P(at least one) = 18.1% — an ordinary coincidence, and the zero-count assertion
was the fragile part, not the finding).

### 8. Reproducing this

`npx tsx scripts/checkFishingCaps.ts` for the ledger, `scripts/fishingReport.ts`
for the corpus totals, `scripts/redrawShadowAnalysis.ts` for §3's figures.
`data/rodDurability.jsonl` holds the paired before/after readings under one
`batchId` with `dryRun: false`.

---

## §61 ANSWERED [conversation with the user, 2026-08-27, outside a numbered session] — THREE SESSION-103 OPEN QUESTIONS CLOSED: SKILL XP IGNORED, LOADOUT STABLE, ROD REPAIRED NOT REPLACED

Recorded here rather than left in a brief, per the §52–§56 convention.

1. **STATE.md session 103's open question 3 (11,111 unspent skill XP) — IGNORE
   IT.** Not a task and not a recommendation to revisit later; the question is
   CLOSED, not deferred. CLAUDE.md's "never allocate skill points yourself"
   rule is unaffected in either direction — it was never the thing in doubt.
   Do not re-raise unspent XP as a finding in a future recap.

2. **STATE.md session 103's open question 1 (gear/loadout stability) —
   RESOLVED: the loadout HOLDS STEADY going forward.** Session 103 caught the
   account re-speccing twice inside one batch (40/22 -> 45/20 before run 1,
   -> 50/17 between runs 3 and 4), and asked whether that is how the account is
   played. It is not; the user expects the gear settled from here.

   **The consequence is asymmetric and both halves matter.** Forward: a future
   batch may be read as ONE arm unless a new re-spec is flagged, and a new
   loadout combo appearing in the census is now a signal to chase rather than
   expected drift — `tests/enemies.test.ts`'s census doc comment is updated to
   say so. Backward: **this changes nothing about the data already captured.**
   Session 103's runs 1-3 and run 4 are still not one arm, and neither group is
   one arm with 2026-08-26's. Do not read this answer as retroactive repair.

3. **§53 / session 102's open question 1 (the fishing rod) — INFORMATIONAL, NO
   ACTION.** The user is REPAIRING Golkan rather than replacing it,
   specifically so the deck stays the same one across future sessions. Nothing
   in the repo changes: `CORPUS_DECK` stays where DECISIONS 2026-08-26 put it
   (Shroom, until the corpus is majority-Golkan). Recorded so a future reader
   does not re-ask why the rod is not being swapped.

---

## §62 ANSWERED [session 104 §A] — THE PROC EFFECT SIZES HOLD AT +184 EXCHANGES, AND TENACITY'S HEAL ASSOCIATION SURVIVES THE `AddTenacity` SPLIT

### 0. The brief asked for a measurement that already existed

Session 104's brief framed this as "§58's own unresolved half", citing §58's
line that rates are not mechanics. **§58 is the entry that resolved it** —
`scripts/procEffectSize.ts` and `tests/procEffectSize.test.ts` shipped in
session 101, and four DECISIONS entries dated 2026-08-26 carry the verdicts.
Per CLAUDE.md rule 9 the repo wins over the brief's account of it.

Two things were genuinely open, and they are what this entry adds: the corpus
has grown by 4 runs since the measurement, and **the brief's own item 2 — the
`AddTenacity` split — had never been done.**

### 1. Re-run at the new volume: every rule holds, the control is still zero

`npx tsx scripts/procEffectSize.ts`, corpus **1919 -> 2103 exchanges**
(1314 status-clean). Null: damage taken === attacker `currentATK` on
**2378 / 2485** no-proc exchanges.

```
  flag          predicts       status-clean       all      control (stat>0, unfired)
  blockProc0    floor(ATK/2)    35/35  [90-100%]   60/63          0/1154
  blockProc1    floor(ATK/2)    10/10  [72-100%]   22/25           0/721
  evadeProc0    0                 3/3  [44-100%]     5/5           0/155
  evadeProc1    0                 9/9  [70-100%]   22/22           0/707
  critProc0     2*ATK           10/10  [72-100%]   17/18           0/677
  critProc1     2*ATK           11/11  [74-100%]   16/17           0/697
```

**The verdicts are unchanged and are restated plainly, per the brief:**

- **`block` — PARTIAL REDUCTION, exactly `floor(ATK/2)`.** Not a negate.
- **`evasion` — FULL NEGATE**, 0 damage taken.
- **`lck` — CRIT, exactly `2 x ATK`.**
- **`tenacity` — NO measurable damage effect** (see §2).
- **`intuition` — NO measurable damage effect**; it denies a MOVE.

**The control column is still 0 on every row, now across 4111 matched control
exchanges** — same stat non-zero, flag unfired, rule matched zero times. That
separation, not the wide per-flag intervals, is the result.

**The method's sanity check reproduces**, as the brief asked: `intuition`,
whose mechanic §57/§58 already settled independently, comes back the same way
— **5 of 6 non-blocked procs took the attacker's FULL ATK**, and the sixth
also carried `blockProc0` and took exactly `floor(ATK/2)`, which is block.
The fired/unfired approach recovers the known answer, so it is trusted on the
others.

### 2. `tenacity`, split by `AddTenacity` — the split was worth doing

Session 103's dead-end note found tenacity's proc RATE moving with whether
`AddTenacity` was picked, at n=4 runs. Pooling those into one population is
exactly what the brief flagged as a risk, so `tenacityByBoon` splits every
`tenacity > 0` exchange by side x boon-picked x fired:

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

**(a) `AddTenacity` raises the proc RATE, and this is now measured rather than
a 4-run pattern.** Player side: **20/380 = 5.26%** with the boon vs
**4/551 = 0.73%** without, Fisher two-sided **p = 2.23e-05**. Session 103 was
right that the boon matters. **Caveat stated rather than buried: exchanges are
clustered within runs and are not independent, so that p is anti-conservative.
The direction is solid; the exact figure is not.** Pick order is still
untested — this splits on presence only.

**(b) The boon is NOT a gate. Tenacity procs without it.** 4 fires on the
player side with no `AddTenacity`, and **23 fires on the enemy side, where
`AddTenacity` appears in zero rows.** The boon modulates a rate; it does not
switch the mechanic on.

**(c) The enemy side is a structurally boon-free control arm — enemies never
pick boons at all.** 0 of 5820 states carrying a `players[]` have a non-empty
`pickedBoons` on `players[1]`, whole corpus. This is asserted as a zero count,
which DECISIONS 2026-08-26 normally forbids, and it is allowed here **because
it is not a chance event**: no capture path exists by which an enemy acquires
a boon.

**(d) The load-bearing result: §58's OnHeal association is NOT an artifact of
the boon.** It survives in the arm where the boon is structurally absent —
enemy side **4/23 = 17.4% fired vs 62/1125 = 5.5% unfired, Fisher p = 0.0386**.
The player's boon arm agrees (3/20 vs 7/360, p = 0.0119). The player's
boon-free arm is uninformative at 0/4 (p = 1.0) and is reported as such rather
than read as a contradiction. **This remains an ASSOCIATION, not a mechanic:**
it now rests on 10 heals rather than §58's 6, and the heal AMOUNTS still
cannot be bounded.

**(e) The damage verdict survives the split, which is the question the split
was actually asked to answer.** Tenacity-fired cells: damage tracks the plain
null **16/19**; unfired cells **1060/1151**. Same in both arms, and the
residual is the same status-effect error term §58 and §59 already characterise.
**Pooling did not hide a damage effect in one arm.**

### 3. What this does NOT do

`src/sim/combat.ts` is untouched. **CAPTURE-1's prohibition — do not stub,
default, or flag-hide the proc branches — stands exactly as §58 left it**, and
the brief said so explicitly. This entry re-verifies three effect sizes at
higher volume and removes one confound from a fourth; it does not close
CAPTURE-1 and does not authorise building the model.

### 4. Reproducing

`npx tsx scripts/procEffectSize.ts`. `tests/procEffectSize.test.ts` pins the
split on a bounded slice with slice-safe assertions (25 tests, was 20).

---

## §63 ANSWERED [session 105 §B1] — TENACITY PICK-ORDER IS **STRUCTURALLY REDUNDANT** GIVEN THE STAT, AND THE QUESTION IS RECOMMENDED FOR RETIREMENT

Session 103 saw tenacity's proc rate move with where `AddTenacity` sat in the
pick order (pick 5 of 8 → 6/54; pick 6 of 7 → 0/38) at n=4 runs, and correctly
declined to fit a rule. Session 104 settled PRESENCE (§62) and left ORDER open —
it is the one item STATE.md's settled digest names as genuinely still open on
the tenacity thread. This closes it, offline, on the full 83-attempt corpus.

### 1. The corpus is far richer than session 103's four runs

**26 of 77 runs picked `AddTenacity`**, at positions spanning **1 through 9**
(3 of the 26 picked it twice). That is not a thin corpus, and this question does
not fail for lack of data — which makes the negative result below informative
rather than merely underpowered.

### 2. Raw pick-order DOES look like a signal — and it is the stat

Player side, `tenacity > 0`, `AddTenacity` picked:

```
  pick  1    4/136 =  2.94%   runs=10
  pick  2    0/ 76 =  0.00%   runs=6
  pick  3    5/ 70 =  7.14%   runs=4
  pick  4    1/ 16 =  6.25%   runs=1
  pick  5   10/ 73 = 13.70%   runs=3
  pick  6    0/  7 =  0.00%   runs=1
  pick  9    0/  2 =  0.00%   runs=1
```

Session 103's shape reproduces at 5x the volume — pick 5 is the high cell, pick
6 is zero. **It dissolves entirely under the stat.** Fire rate by the side's own
`tenacity` value, same population:

```
  tenacity= 1   4/551 = 0.73%      tenacity= 7   4/38 = 10.53%
  tenacity= 2   2/141 = 1.42%      tenacity= 8   4/36 = 11.11%
  tenacity= 3   1/ 92 = 1.09%      tenacity=10   1/15 =  6.67%
  tenacity= 4   2/ 14 =14.29%      tenacity=13   6/36 = 16.67%
  tenacity= 5   0/  8 = 0.00%
```

Cross-tabbed, **13 of the 16 (stat, pick) cells are a SINGLE RUN**. Pick 5's
73 exchanges are stat 13 (6/36), stat 8 (4/29) and stat 2 (0/8); pick 6's are
all stat 8. The pick-order gradient is the stat gradient, re-indexed.

### 3. Holding the stat fixed, pick order does nothing

Only **3 of 8 stat strata** contain more than one pick position, and they carry
**7 procs across 269 exchanges** between them. Within those:

```
  stat=2   early (picks 1-2)  1/101   vs  late (picks 3+)  1/40   Fisher p = 0.488
  stat=3   early (picks 1-2)  0/ 74   vs  pick 3           1/18   Fisher p = 0.196
  stat=8   pick 5             4/ 29   vs  pick 6           0/ 7   Fisher p = 0.566
  pooled   early              5/204   vs  late             2/65   Fisher p = 0.677
```

Nothing, in every stratum and pooled. The `stat=8` row is session 103's own
contrast with the stat controlled, and it is p = 0.57 — and both its cells come
from ONE run, so its exchanges are maximally clustered and even that is
generous.

### 4. Why this is a RETIREMENT and not "underpowered"

**Pick order is redundant by construction, not merely confounded.** `boons` and
`stat` are read off the *same* preceding state, so the per-exchange `tenacity`
value already encodes what the boon did, at the moment it applied. Picking
`AddTenacity` 5th rather than 1st does not give a different stat — it gives the
same stat later, and the per-exchange reading tracks exactly that. So any
pick-order effect must appear as a residual after conditioning on the stat, and
there is no mechanism by which one could.

This is a **different** verdict from `SecondWind`/`Steadfast` (DECISIONS
2026-08-27), which are real mechanics that ordinary volume cannot reach. Pick
order is not waiting for volume. **Recommended for retirement; do not re-brief
it as open.**

### 5. What this does NOT say

It does not settle the tenacity RATE model. The digest's standing note that
proc rate rises with the stat "on the order of 1 percentage point per point"
(§57) is an OBSERVATION and remains one — this section adds volume to it but
does not promote it, and §57's "do not lift it into code" is unchanged.

### 6. Reproducing

`npx tsx scripts/procEffectSize.ts` — new `tenacityByPickOrder` /
`pickOrderPower` sections. `tests/procEffectSize.test.ts` pins the collinearity
as an invariant (informative strata < total strata) rather than as a count, so
it survives corpus growth. 30 tests, was 25.

---

## §64 ANSWERED [session 112] — YES. Modelled `latent` from n=1 by user directive, on the `LossIntuitionUp` precedent.

**The ruling, 2026-08-30 (DECISIONS same date).** `LossBlockUp` is in
`BOON_MODELS` as `{ kind: "latent" }` with `contaminates: ["STATUS_EFFECT"]`.
`AWAITING_MODEL_DIRECTIVE` in `tests/boons.test.ts` is now EMPTY — the
mechanism stays, because an unlisted type that gains a pair and no model must
still fail. Evidence below was re-verified against the corpus before the model
landed (CLAUDE.md rule 9), not taken from the brief.

`contaminates` is the load-bearing half: the PICKUP is modelled, the loss
conditional the name gestures at is NOT, so every exchange after it stays
unscorable rather than being scored as though the boon were inert. Per
DECISIONS 2026-08-15 the effect is still not inferred from the name.

**If this type is ever observed moving a field on a second pickup, the
`BOON_MODELS` entry is what to revisit.** `LossEvasionUp` and `LossLuckUp`
remain unmodelled — offered, never picked — so there is still no family
precedent, which is exactly why a directive was required rather than assumed.

*The original ask and its evidence are kept below, unchanged.*

---

**The ask, in one line: may `LossBlockUp` be modelled as `latent`, from n=1?**

This is the same question session 99 asked about `LossIntuitionUp`, with the
same evidence and the same n, and it is asked rather than assumed because that
precedent required an explicit user directive.

**What is measured.** First-ever PICKUP, `run-2026-08-29-17-53-12`
state-298 -> state-299, `selectedVal1` 5, `Rarity: "Rare"`, `TokenId: 116`. It
had been OFFERED many times across the corpus and never taken until now.
Checked with session 89's strict method — a recursive diff of the ENTIRE raw
`players[0]` object, not just the fields `toCombatant` projects — the pair's
only difference in the whole object is this boon's own append to
`pickedBoons`. `players[1]` is byte-identical.

So: **latent at pickup, measured, n=1.**

**Why it is not modelled already.** Per DECISIONS 2026-08-15 the effect is NOT
inferred from the name, so nothing here claims it does anything on a loss.
And there is no family to generalise from: of the four `Loss*Up` types,
`LossIntuitionUp` is modelled (by directive) and `LossEvasionUp` /
`LossLuckUp` remain unmodelled, having been offered but never picked.

**Current state in the repo.** `tests/boons.test.ts` carries
`AWAITING_MODEL_DIRECTIVE = new Set(["LossBlockUp"])`. The suite is GREEN and
the gap is explicit: the test asserts the type is NOT in `BOON_MODELS` and
separately pins the measured latent delta, so the gap cannot quietly turn into
a model, and an unlisted type with a pair and no model still fails as before.

**If the answer is yes**, add the model as `{ kind: "latent" }` with this
section as its evidence and drop it from the set. **If no**, it stays here and
the next pickup adds n.

---

## §65 ANSWERED [session 111] — FIXED IN CODE. The day-boundary memo landed; the answer to "is it worth it" was yes, and the autonomous fishing arm was the reason.

**[session 109] Found at this session's first dry run, which fail-closed and
blocked two legitimately-available runs.**

`data/guard-budget.json` read `{date: "2026-08-29", energySpent: 240,
runsStarted: 12}` while the server's `dayProgressEntities` read **6**. The dry
run refused: `Guard tripped: session run cap reached {"attemptedRun":15,
"cap":12}`.

### Mechanism (traced in code, not inferred)

`todayKey()` (`src/orchestrator/guardPersistence.ts:99`) is correctly anchored
at 11:00 Pacific, DST-aware via `Intl`. That part is not the bug.

`saveGuardBudget(energySpent, runsStarted, path)` (same file, ~line 164) writes:

```ts
const body = { date: todayKey(), energySpent, runsStarted };
```

`todayKey()` is evaluated at **write** time, but `energySpent`/`runsStarted` are
the process's **cumulative** counters, seeded at **process start** from whatever
day was current then. A process that crosses 11:00 PT therefore stamps the whole
invocation's totals — including everything spent before the rollover — onto the
new day.

Session 108's single `--runs=4` invocation started 17:53Z (10:53 PT, key
`2026-08-28`) and crossed 18:00Z (11:00 PT, key `2026-08-29`) between runs 2 and
3. Runs 3 and 4 wrote 180/9 then 240/12 under the NEW key. The new day inherited
two runs it never saw.

### Why this matters beyond one bad file

- **It is the same class as the potion-policy bug** — in-process state that only
  misbehaves when one process spans a boundary. Rule 11's `--runs=1` hides it
  for dungeons, which is why 108 sessions never saw it.
- **It is NOT dungeon-only.** `scripts/liveFishing.ts:1799` uses the identical
  `saveGuardBudget(guards.spentEnergy, guards.runCount, ...)` pattern and runs
  **autonomously** across long cast batches, unattended, so it can straddle
  11:00 PT with nobody watching.
- **The failure direction is safe.** It over-counts spend and therefore BLOCKS
  runs; it can never cause an over-spend. That is why this is a question and not
  an emergency.

### What was done this session

The DATA was corrected, not the code — user-approved, and justified by CLAUDE.md
§1 (the authoritative server count wins over local guard tracking). Set to
`{date: "2026-08-29", energySpent: 120, runsStarted: 6}`, exactly runs 3+4. The
next dry run then reported `real server runs today: 6/12 (matches bot-tracked
count)` and both authorized runs proceeded normally.

**There is no `--reset-guard` / reconcile flag.** `assertDungeonCapNotExhausted`
reconciles only DOWNWARD-to-exhausted (server exhausted -> mark local exhausted);
nothing reconciles a local ledger that is ahead of the server.

### Proposed fix, if wanted

Naive rebasing does not work: on a fresh process on a new day, `loadGuardBudget`
already discards the stale file and seeds `{0,0}`, so subtracting the file's
prior-day totals would go negative.

The shape that does work is to memo, per guard-state path, the day key the
in-memory counters belong to plus the cumulative totals at the last write:

- at load, memo `lastDay = todayKey()` and `baseline = seed totals`;
- on each save, if `todayKey() !== lastDay`, set `baseline = cumulativeAtLastSave`
  and update `lastDay`;
- always write `cumulative - baseline`.

Fresh-process-new-day: baseline 0, writes cumulative — unchanged behaviour.
Straddle: baseline 120/6 at the rollover, so run 3 writes 60/3. Correct in both.

**Question: is this worth landing, given rule 11 pins `--runs=1` for dungeons
and the failure direction is fail-safe? The autonomous fishing arm is the real
argument for yes.**

---

### ANSWERED [session 111] — landed, as designed above, with three corrections

The memo is `DAY_MEMO` in `src/orchestrator/guardPersistence.ts`, keyed by
guard-state path. `loadGuardBudget` and `saveGuardBudget` both take an optional
`now: Date`, matching `todayKey`'s existing shape, so the boundary is testable
without waiting for 11:00 Pacific. Ten regression cases in
`tests/orchestrator/guardPersistence.test.ts` replay session 108's exact
timestamps and land on `{date: "2026-08-29", energySpent: 120, runsStarted: 6}`
— the value session 109 had to write by hand.

**Correction 1 — the memo must be seeded at LOAD, not lazily at the first
save.** §65's sketch says "at load, memo `lastDay`", and that detail is
load-bearing rather than incidental: a process that loads a non-zero seed
before 11:00 and does not write again until after it has no pre-rollover save
to learn the boundary from, and a save-time memo would stamp the whole
cumulative onto the new day — the original bug, intact. Pinned by its own case.

**Correction 2 — FIRST LOAD WINS.** `liveRun.ts` and `liveFishing.ts` each call
`loadGuardBudget` twice (a preflight/status read, then the real one), and
`doctor.ts` and `checkFishingCaps.ts` load the same paths read-only. A second
load re-seeding the memo after a rollover resets the baseline to zero and
reintroduces the bug in full. `seedDayMemo` therefore skips a path it already
knows. Pinned.

**Correction 3 — a backwards move must NOT throw, and the first draft did.**
`guards.adoptServerRunCount()` assigns the server's count ABSOLUTELY and can
LOWER it, and `liveFishing.ts` calls it after `reconcileFishingLedger` on the
autonomous path. Post-rollover that can put the cumulative below the baseline,
so throwing would have crashed a straddling fishing batch at the exact moment
it was healing itself. The baseline is what stops applying once the counters
are re-seeded, so it is dropped and the raw cumulative is written — always
`>=` the rebased value, so the error direction stays "over-count, block, never
over-spend", and in the adopt case it is exactly the game's own number.

**What this does NOT fix, stated so it is not read as solved.** Only the
PERSISTED ledger is rebased. `GuardState`'s in-memory counters stay cumulative
across the boundary, so the straddling process itself still counts the old
day's spend against the new day's cap and stops early. That is fail-safe, and
the next process reads a correct ledger. Re-seeding a live `GuardState`
mid-batch is a larger change than this question asked for.

**A wording correction to this section, for the record.** Above it says
"`scripts/liveFishing.ts:1799` uses the identical `saveGuardBudget(...)`
pattern". Line 1799 is not a write — it builds the `PersistedGuardBudget`-shaped
input to `reconcileFishingLedger`; the write is `saveGuardBudget` at 1804, plus
1903 and 1969. The conclusion was right (the autonomous arm reaches the bug and
is the argument for fixing it) and all three writes go through the fix.

---

## §66 OPEN [session 113] — `CritHeal`: model it from n=1, or wait for a second pair?

**A user directive is needed. An agent may not decide this** — the
`LossIntuitionUp` (session 99) and `LossBlockUp` (session 112) precedents both
required an explicit one for exactly this call, and both are recorded in
`DECISIONS.md`.

**What is established, verified against the fixture rather than assumed from
the family.** `run-2026-08-31-03-04-33`, `state-011.json` → `state-012.json`:

```
health   {"current":50,"starting":30,"currentMax":50,"startingMax":30}   UNCHANGED
armor    null                                                            UNCHANGED
rock / paper / scissor                                                   BYTE-IDENTICAL
pickedBoons  0 -> 1
new boon  {"BoonType":"CritHeal","Rarity":"Rare","selectedVal1":6,
           "val1Min":6,"val1Max":6,"TokenId":95,"UINT256_CID":31}
```

So **the pickup is a latent no-op** — nothing observable moves at pickup. That
is the same evidence, at the same n, as the two types already modelled by
directive.

**⚠ What is NOT established, and the trap to avoid.** The name says "heal on
crit". **Per DECISIONS 2026-08-14/15 the effect is never inferred from the
name.** The conditional the name gestures at is entirely unobserved; measuring
it needs crit-landing exchanges AFTER the pickup, which this run does not
contain. `selectedVal1` is 6, and whether that is a heal amount, a percentage,
a proc chance or something else is unknown.

**The two options, stated so the answer can be a single word.**

- **(a) Model it `latent` now**, as `LossBlockUp` was: the pickup is modelled,
  the conditional is not, and every exchange after the pickup stays UNSCORABLE
  rather than being scored as if the boon were inert. This is the conservative
  option despite sounding like the aggressive one.
- **(b) Wait for a second pair.** Costs nothing but time; `CritHeal` currently
  sits in `AWAITING_MODEL_DIRECTIVE` in `tests/boons.test.ts`, which pins the
  latent measurement and fails if anyone models it without a directive.

**Current state: (b), by default, because no directive exists.**

---

## §67 OPEN [session 113] — `Vengeance`: the first quantitative observation, and it is n=1

**No decision is being asked for.** This is recorded so the observation is not
lost and so a future session does not rediscover it as a `Weak` regression.

`run-2026-08-31-03-26-52/state-116.json` is the corpus's **first exchange where
`Weak` and `Vengeance` are carried together**, and it is the **only exception
`Weak`'s multiplier rule has ever had**:

```
attacker status  {"Regen":0,"SecondWind":10,"Weak":1,"Vengeance":25}
ATK 30    floor(30 * 0.75) = 22 predicted    27 TAKEN     residue +5
```

**This is contamination, not falsification.** `scaleRule` excludes the other
side's `Weak`/`Vulnerable` and this side's opposite scaler, and nothing else —
so any unmodelled damage-affecting status is scored as though the multiplier
were acting alone. Excluding exchanges where either combatant carries an
unmodelled status restores **54/54, 100%**, and
`tests/statusEffects.test.ts` asserts that exclusion is EXACTLY the
unmodelled-status set so it cannot widen.

**What would resolve it.** More `Vengeance` exchanges, ideally without `Weak`,
so its own contribution is separable. Three statuses are currently unmodelled
and all three are rare: `Vengeance` (2 runs), `Intimidating` (1),
`Steadfast` (1). ⚠ **Do NOT fit an effect to the +5**: with one observation,
"+5 flat", "+ATK/6", and "Vengeance overrides Weak entirely" (30 → 27 is not
that, but a fourth reading might be) are all unseparated, and `Vengeance: 25`'s
amount field has not been shown to be a magnitude at all — for `Weak` and
`Vulnerable` the amount is a COUNTDOWN, not a magnitude, which is precisely the
trap `statusEffects.test.ts` already warns about.
