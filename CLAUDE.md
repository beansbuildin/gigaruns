# CLAUDE.md — Gigaverse Autoplay Bot

You are building an autonomous bot that plays **Forbidden Woods** (dungeon) and
**Dendren fishing** in Gigaverse on Abstract chain.

Read `SPEC.md` for architecture and strategy design. Work through `TASKS.md` in
order. Do not skip the verification gate at the end of each task.

---

## Non-negotiables

**1. Discover, don't assume.**
Every ID, field name, and enum in `SPEC.md` marked `[VERIFY]` is a guess. The
dungeon ID for Forbidden Woods and the fishing-node ID for Dendren are **not
publicly documented** — you must find them at runtime via `scripts/probe.ts` and
write the real values into `config/discovered.json`. If a field you expected is
missing from a live response, the spec is wrong and the live response is right.
Update the spec and say so in your commit message.

**2. Never invent an endpoint.**
Only call paths confirmed by `probe.ts` output or listed as CONFIRMED in
`SPEC.md`. If you need an endpoint that doesn't exist yet, dump the full response
of a related endpoint and look for it. Do not brute-force URLs.

**3. Secrets never enter the repo — and the only secret is a JWT.**
The JWT lives in `~/.secrets/gigaverse-jwt.txt`. Add `.env`, `*.key`,
`config/discovered.json` to `.gitignore` before writing any auth code. Never log
a full JWT — `jwt[0..8] + "..."` at most. If you ever print one by accident,
stop and tell the user to rotate.

**[2026-08-20] There is no private key, and there is not going to be one.** This
rule used to open "Private key and JWT live in `~/.secrets/`". That was wrong in
a way that matters now the repo is being shared: the account is an **Abstract
Global Wallet**, which does not expose a user-held EOA private key at all, so
there is no key to store, load, or hand to anyone. `src/api/auth.ts` implements
only SPEC Path A — a JWT the user copies from their own browser — and nothing in
`src/` signs anything.

Two consequences, both to be acted on rather than noted:

- **SPEC's Path B ("bot-owned EOA", `AUTH_MODE=eoa`) is not deferred, it is
  retired.** It describes a wallet model this chain's wallet does not use. Delete
  it rather than leaving it as future work someone tries to finish.
- **`viem` is a declared dependency imported nowhere.** It was added on day one
  for Path B. Drop it.

This is also the sentence to put in front of anyone deciding whether to run this
on their own account: **the bot asks for a session token, not custody of a
wallet.** Keep that true — the moment anything here signs, that claim dies and
the trust story changes completely.

**4. Simulate first.**
No strategy code gets tested against the live API until it passes against
recorded fixtures in `fixtures/`. The sim harness is Task 4 and it is not
optional. A bad move loop can burn a full day's RUN ALLOWANCE in under a
minute, and that allowance — 12 run-units, server-enforced — is the scarce
thing. [session 58] This rule used to open "Energy is real money"; it does not,
see rule 12. What is real is the run cap, the items a run consumes, and the
fact that a bad loop is unrecoverable until 11:00 Pacific.

**5. Fail closed.**
On any unexpected state — unknown enum, HTTP 5xx, three consecutive action
failures, energy below threshold, daily cap hit — stop the loop, log the full
response body to `logs/`, exit non-zero. Never guess an action to "keep going."
A stopped bot costs nothing. A confused bot costs energy and items.

**6. A gate must be set on something the agent controls.**
If a gate depends on data that does not exist yet, it is a capture request
wearing a gate's clothes, and no amount of working harder can meet it. Task 4.5
asked for `deepestScorableRoom >= 4` because the corpus *reached* room 4 —
confusing corpus depth with corpus scorability — and the number was unreachable
before the session began.

Two obligations follow. If you receive a gate you believe is unreachable, say so
**at the top of the session**, not in the recap; that is a far cheaper failure.
And when you set a gate, state what would have to be captured for it to be
meetable, so the next reader can tell a hard task from an impossible one.

**7. Rate limits.**
Minimum 1200ms between actions, plus 0–400ms jitter. Exponential backoff on 429
starting at 5s. The action-token window is ~5s — if you go too fast the server
rejects the token, and if you go too slow it goes stale. Handle both.

**8. Take the HIGHEST tier offered — except the final room, and never a
Perpetual.**
User directive, 2026-08-20, replacing the lowest-tier rule that stood from
session 06 to session 56. Three clauses, all of them:

- **Highest tier**, because reward offers inherit the tier of the fight just
  won (measured 87/87 = 100%, session 56 §4) and a higher-tier win therefore
  unlocks better upgrade cards and a larger Hard Core payout.
- **Never a Perpetual card as the hardest option** (user directive, session 56).
  Take the highest tier *among non-Perpetual options*. This was nearly inert
  under the old rule — 4 offers of 134 — and fires on **35%** of offers under
  this one, so it is load-bearing now, not a footnote. No corpus offer is
  entirely Perpetual; **fail closed if one ever is** rather than taking it.
- **At the final room, take no-modifiers** — the lowest tier offered. There are
  no upgrades after the final boss, so the entire reason for the risk is gone.
  Key on the server's per-dungeon `maxRoom` (Forbidden Woods 16, Void Dungeon
  17), never a hard-coded number.

**The old rule was not wrong, and this is not it being optimised away.** Its
evidence — `lootTable` byte-identical across all offered tiers, 440/440 — is
still true and still re-verified. But that measured the loot table *in the
enemy offer*, while reward quality and orb payout are downstream of *winning*.
The two claims are orthogonal; the old rule was never evidence against this one.
It was reversed by the account owner on new evidence, not by someone reasoning
about risk/reward in the abstract, and the original warning now applies in the
other direction: **do not revert to lowest-tier without a new user directive.**

**The accepted cost, recorded so nobody re-discovers it as a bug.** Higher tiers
carry `rolledEnemyStats` on 617 of 622 non-Safe paths, and those are 1–5% proc
chances needing hundreds of observations (SPEC §4e). So the simulator scores
almost nothing from here on, and modelling `enemyBuff` does not help — session
56 measured that at exactly zero freed exchanges. This was accepted knowingly:
the sim was already scoring 64/1107 exchanges (5.8%), reaching depth 5 against
live runs' room 10, and could not separate two boon policies at n=2000. A
near-blind simulator got blinder; it did not stop being useful, because it had
largely stopped being used. **Do not "fix" the falling coverage metrics** —
they are the price of this rule, not a regression.

`src/strategy/enemyTier.ts` remains the one call site that may choose a tier.
Route every live tier decision through it; do not re-implement the choice
inline.

**9. A brief's claims about what the corpus contains are hypotheses to verify,
not facts to implement.**
Claude (chat) writes session briefs without access to the fixtures — it works
from the previous recap, which can be stale, incomplete, or simply wrong about
a specific. When a brief asserts something checkable against `fixtures/` or a
live response (a tier label, a field's meaning, a boon's effect), check it
first. If it's wrong, the corpus wins, the brief's claim does not get
implemented as stated, and the correction goes in the recap so the next brief
doesn't repeat it. This has already happened twice (session 06's "label rows
tier 2", session 07 found room 3 was tier 1 and room 4 was tier 0 and clean) —
treat a third time as expected, not exceptional.

**10. Date an effect on a field that predates the instrumentation change.**
This repo improves its own logging constantly, and that creates false
discontinuities in its own history. Session 52 concluded the SERVER had changed
because `"Invalid action token"` appeared in the 2026-08-20 logs and in none of
the 2026-08-18 ones — but that string could not have appeared earlier, because
session 47/51's `serverErrorDetail` fix is what started capturing the server's
body at all. Counting the same failures on `reason`, a field populated on both
sides, the rate was 100% before and 100% after. Nothing had changed except what
was being recorded.

So: before concluding that behaviour changed at date D, check whether any log
field you are counting on FIRST APPEARS at date D. If it does, re-ask the
question using a field that predates it, or say plainly that the logs cannot
date this. The same trap applies to any before/after comparison that straddles
a capture improvement.

**11. Every live dungeon run is a 60-energy juiced Tier-2 entry, with 3 Big
Heal Juices, and it stops for approval when it finishes.**
User directive, 2026-08-20, standing until the user says otherwise. There is no
such thing as a plain dungeon run any more. Four conditions, all of them:

- **60 energy, juiced** — `--juiced` with `JUICED_COST_MULTIPLIER` 3 against
  the 20-energy base. Charges 3 of the daily 12 run-units.
- **`--juiced-index=2`**, the Tier-2 offering — **one of EACH of the seven
  silver rings per run.** This is the ENTRY tier only and is a different
  choice from the in-room `enemyPathOptions` tier, which rule 8 governs. Do
  not collapse them: the entry tier is chosen once at `start_run`, the room
  tier is chosen in every room, and rule 8's final-room and Perpetual
  exceptions apply only to the latter.

  **[2026-08-30] This was `--juiced-index=1` from 2026-08-27 through session
  110, and the change is a user directive, not an optimisation.** It is a
  STANDING change, not a dated one-off like session 108's chaining exception —
  it holds until the user says otherwise. Tier 2 doubles Hard Core income
  against Tier 1 (`dropMultiplier` 2 vs 1, and per DECISIONS 2026-08-28 that
  multiplier is an EXACT quantum on item 845 and moves nothing else), and the
  user's judgement is that the silver-ring stock is worth spending on that
  where the gold-ring stock was not.

  **⚠⚠ [2026-08-30, session 112] THE COST BELOW IS WRONG. MEASURED ON THE
  FIRST LIVE TIER-2 RUN: exactly ONE faction is charged, THREE of it — not one
  of each of seven.** Balances immediately before and after run 25215982
  (faction day 20695), read twice after and stable:

  ```
  134 Chobo 39->39   135 Crusader 39->39   136 Overseer 45->45
  137 Athena 30->30  138 Archon   30->30   140 Summoner 54->54
  139 Foxglove 57->54   <-- the ONLY one that moved, -3
  ```

  Six of seven factions were untouched. `entryData` carries
  `inputsBasedOnFactionDay: true`, so the seven-id `inputItems` list is
  plausibly the SUPERSET across faction-days with one faction live per day.
  The **3** matches the juiced run-unit multiplier exactly, but whether it is
  the multiplier or a flat per-entry amount is **UNSEPARATED at n=1** and needs
  a run on a different faction day.

  **So the runway arithmetic below is wrong, in the direction that
  UNDERSTATES it.** Do not quote "30 runs / 7.5 days" and do not rewrite it
  either until a second run identifies the next day's faction.
  `scripts/checkEntryTiers.ts` prints the same wrong runway and now says so.

  **Also measured: NO ring debit appears on the wire.** `start_run`'s response
  has no `gameItemBalanceChanges` field at all (keys: `success, actionToken,
  message, data{run, events, entity}`), and across the whole run log that field
  mentions only 845 and 846. The ring spend is only observable by reading
  balances before and after.

  *The original claim is kept below, marked wrong, because the ORDER of the
  ids and the `inputAmounts` are still what `entryData` returns — what was
  wrong is the inference that all seven are charged.*

  ~~**The cost, measured live before the first run rather than assumed from
  Tier 3's shape.**~~ Tier 2's `entryData` reads
  `inputItems: [134,137,138,135,136,139,140]`, `inputAmounts: [1,1,1,1,1,1,1]`
  — ~~**all seven silver rings, one each, per run.** Not "seven ids" in the
  loose sense session 106 recorded off Tier 3: it is one ring from every
  faction simultaneously, so **the RUNWAY IS SET BY THE SCARCEST FACTION, not
  by the total.**~~ On 2026-08-30 the balances were 33/39/42/30/30/57/54
  (Chobo/Crusader/Overseer/Athena/Archon/Foxglove/Summoner), so the stock was
  **30 runs — 7.5 days at the 4-runs-per-day ceiling — against a Tier-2
  offering window running to day 20731, ~37 days out.** That shortfall is the
  same arithmetic that drove the Tier-3 → Tier-1 switch, and it is recorded
  here so nobody rediscovers it as a surprise blocker. Re-read the balances
  rather than trusting these numbers — `npx tsx scripts/checkEntryTiers.ts`
  prints the live cost, the balances and the runway — because
  `inputsBasedOnFactionDay: true` means the required list is a per-day thing
  and must never be cached.

  **[2026-08-27, superseded above but kept because its reasoning still binds]
  This was `--juiced-index=3` from 2026-08-20 through session
  103, and the change is a user directive, not an optimisation.** Gold-ring
  stock covered roughly **16 more days** at the Tier-3 run rate while the Hard
  Cores event has **42 days** left to run, so continuing would have exhausted
  the rings with ~26 days of the event still open. Tier 1 spends none.

  **The cost is real and is stated here rather than buried in a session log:
  Hard Core income per run drops to about a QUARTER.** `dropMultiplier` is 4
  at Tier 3 and 1 at Tier 1, and per SPEC §3c it governs Hard Core (item 845)
  **only** — Dendren Root (item 846) answers to `isJuiced` alone and is
  **unaffected**. For scale, session 103's four Tier-3 runs paid 30,960 Hard
  Core; the same four at Tier 1 project to ~7,740. That projection is a
  derivation from `dropMultiplier`, **not a measurement** — every juiced
  `start_run` this bot has ever sent used `index: 3` (34 of 34), so Tier 1 has
  no observed payout here yet. Measure it on the first live Tier-1 run rather
  than quoting this number back as fact.
  **[2026-08-30] That measurement is DONE and this caveat is discharged** —
  session 106 measured the 4:1 quantum live (DECISIONS 2026-08-28,
  `handoff/TIER1-RESULT.md`), so "a quarter of Tier 3" may be quoted as
  observed. Left in place only because the paragraph is a superseded record;
  do not act on its instruction.

  **`index` is the TIER, not an array position** (SPEC §3c, confirmed live
  twice). `entryData` is returned ordered **tier 2, 1, 3**, so `entryData[1]`
  is Tier 1 by luck, **`entryData[0]` is Tier 2 by a DIFFERENT coincidence**,
  and `entryData[3]` does not exist. Two tiers in a row landing on a
  positional index that happens to work is exactly how this becomes a silent
  bug. Match on `entryData[].tier`; never index the array positionally.

  None of rule 11's other three conditions change. `index` and `isJuiced` are
  independent axes (SPEC §3c/§3f, session 42): the run is still a 60-energy
  juiced entry, still charges 3 of the 12 daily run-units, and still auto-loads
  potions — that gate reads `--juiced` alone and never `index`.
- **3x Big Heal Juice** (itemId 131), loaded from
  `config/bot.json`'s `forbiddenWoods.potions`.
- **One run, then stop and hand back.** Never chain. The user allocates skill
  points between runs (rule: never allocate them yourself) and says when to
  resume. `--runs=1`, every time.

The daily ceiling is **12 run-units / 3 = 4 juiced runs per day**, resetting
11:00 Pacific, and the SERVER enforces it (`maxRunsPerDay: 12`,
`dayProgressEntities`) — `npx tsx scripts/checkDungeonToday.ts` reads it.

**[session 58] The energy half of this derivation is DELETED, by user
directive.** It used to read "240 energy / 60 and 12 run-units / 3 both give 4,
and if those two numbers ever disagree, stop." They now disagree permanently and
correctly: the account generates **~1368 energy/day** once its ROMs NFTs are
counted, so the energy arm gives 22.8 and the tripwire fired on good data. See
CLAUDE.md's energy note below and DECISIONS 2026-08-20.

**The consequence that is easy to miss.** A rule requiring per-run human
approval cannot be satisfied by an autonomous loop, so **`scripts/orchestrator.ts`
does not start dungeon runs.** Its dungeon arm is disabled and fails closed with
a pointer to `liveRun.ts --juiced`; its fishing arm is unaffected and still runs
autonomously within budget. Anything that reintroduces a bot-initiated dungeon
run without an explicit human go-ahead violates this rule, however well-gated it
looks.

This rule is also what makes the potions block safe to leave in
`config/bot.json` permanently. Sessions 24, 42, 43 and 52 added it before a run
and removed it after, and that convention was never bookkeeping — it was a latch
standing in for a gate the orchestrator never had (`resolvePotionLoadout` checks
`config.potions` and nothing else, despite a comment claiming it mirrors
`main()`'s gate, which is two conditions). With the dungeon arm closed, the
latch is redundant and the block stays put. **If the dungeon arm is ever
reopened, the remove-after-use convention comes back with it.**

---

**12. Energy is not a constraint. Do not plan around it or report it as a
blocker.**
User directive, 2026-08-20, given after it had to be said more than once. The
account generates **~1368 energy/day** once the ROMs NFTs tied to this character
are counted. `GET /offchain/player/energy` reports only the PASSIVE REGEN POOL
(`energyValue`, `maxEnergy: 420`, `regenPerHour: 18`), so reading it as a
ceiling understates the real supply by ~3x and invents blockers that do not
exist. Session 58 read `energyValue: 11` and wrote off the whole session's live
work as blocked for thirteen hours.

**`scripts/liveRun.ts` already handles this and has for some time.** Its energy
preflight reads the ROM bank and claims what a run needs — on 2026-08-20 that
bank held 37 ROMs and **2251 claimable energy** against a 60-energy run. So the
alarming number was one the loop resolves by itself.

The real ceilings are the GAME's own daily ledgers and nothing else: fishing
casts (`dayDocs[pondId]`, 20/day) and dungeon run-units
(`dayProgressEntities`, 12/day), both rolling over at 11:00 Pacific, plus this
repo's own policy budgets in `config/bot.json`.

**The general lesson, which is the durable half: exercise the real gate before
reporting a blocker.** `liveRun.ts --dry-run` runs every guard, spends nothing,
and takes twenty seconds. It would have answered this correctly and instead the
answer was reasoned out from a raw endpoint reading.

---

**13. A permission denial is NOT evidence that nothing ran. Verify against the
server ledger before believing it, and never retry on the strength of one.**
Session 61, 2026-08-20. The authorized juiced run was issued, the harness
returned *"Permission for this action was denied by the Claude Code auto mode
classifier"*, and the agent reported it as blocked and moved on. **The run had
already completed** — `dayProgressEntities` 3→6, 39 POSTs, run 24945829. It was
found ~25 minutes later, by accident, when new fixtures appeared in the boons
tests.

This is a known Claude Code defect, not a quirk of this repo:
`anthropics/claude-code#77185`, open, labelled `bug` / `area:permissions` /
`has repro` — the classifier's denial can race the command and come back after
the side effects have already landed. Anthropic's own documentation says the
classifier check happens *before* execution, so the denial is supposed to
guarantee non-execution. Sometimes it does not.

**The obligation, and it is unconditional.** After ANY live command that reports
as denied, blocked, or interrupted — before saying it did not run, and long
before re-issuing it — read the server's own ledger:

```
npx tsx scripts/checkDungeonToday.ts     # dayProgressEntities
npx tsx scripts/checkFishingCaps.ts      # dayDocs[pondId]
```

The ledger is the only authority on what was spent. A tool result is not.

**Why this is a rule and not a note.** The dangerous case is not the one that
happened — exactly one run was authorized and exactly one occurred, so nothing
was overspent. It is the next one: an agent that believes a denied run did not
happen will reasonably re-issue it, and that silently burns another 3 run-units
against a 12-unit day. The same reasoning applies to any irreversible spend, so
do not scope this rule to dungeon runs.

**Report it, do not absorb it.** If the ledger contradicts the denial, say so
plainly in the recap with both numbers. A denial that raced execution is
information the user needs about their tooling, not a discrepancy to reconcile
quietly.

---

## Working style

- **TypeScript, Node 20+. Nothing here signs.** Abstract tooling is TS-first.
  [session 76] This bullet used to read "`viem` for signing", which rule 3
  above retires: `viem` was dropped in session 59 and is imported nowhere
  (`tests/clientSurface.test.ts` fails the build if that changes). The rule's
  own document was the last place the claim survived.
- Run `npx tsc --noEmit` and the test suite before declaring a task done.
- **The recap secret scan is `npx tsx scripts/secretScan.ts` — do not hand-roll
  another shell pipeline.** [session 111] Three sessions ran three different
  ad-hoc scans and reported three incomparable file counts; one of them had
  read zero bytes (session 109) and one covered 1.3% of the tree while its
  recap line read as full coverage (session 110's `files in session diff:
  117`). The script defaults to `--scope=tracked`, **prints the scope next to
  the count**, and fails closed on an unexplained hit, on a zero-file sweep, or
  on a matcher that stops matching its own synthetic sample. Quote its output
  verbatim in the recap; a scan whose scope is not stated has not been
  reported. `--scope=diff --ref=<sha>` narrows it to one session's changes, but
  that is an ADDITION to the whole-tree run, never a substitute — a diff scan
  cannot see a secret that landed in an earlier session.
- At recap time, re-run the full test suite against the FINAL commit you're
  about to hand off — not against your last in-session check. Session 18
  found `main` claiming a passing count that was stale by one out-of-band
  commit; a mid-session check can go stale the moment anything lands after it.
- Commit after each task with the verification output pasted in the message.
- Keep the API client (`src/api/`) free of game logic, and the strategy modules
  (`src/strategy/`) free of network calls. Strategy takes a state object and
  returns a decision — pure functions, trivially testable. This separation is
  what makes the sim harness possible, so don't collapse it for convenience.
- **Tests must never write to a real data path.** Anything under `data/` or
  `logs/`, or any file a persistence module (`guardPersistence.ts`,
  `opponentModelPersistence.ts`) or a report script treats as ground truth,
  must be given an isolated temp path in the test (`mkdtempSync` + an
  explicit path param) — never the default path a live script would use.
  This has been the working convention all along but was never written down,
  and it has already shipped as a real bug twice in a row: session 30's
  `9001`/`9002` fishing-corpus pollution and session 31's `guard-budget.json`
  leak (three tests never set `guardStatePath` on a real `runOneCast` call
  and silently overwrote the actual dungeon spend ledger). Both were found
  by accident, not by a reviewer checking this rule. A new I/O-owning test
  construction (`LiveRunDeps`, `LiveFishingDeps`, or anything wired to
  `opponentModelPersistence.ts`) that omits an isolated path is this same
  bug a third time.

## When you get stuck

Write your question and the relevant response dump into `QUESTIONS.md` at the
repo root, then **continue with the next unblocked task**. Do not idle waiting
for a human. The user will paste `QUESTIONS.md` into a chat with Claude and
bring back answers.

Blocking is only acceptable for: a missing private key/JWT, an on-chain
transaction that would spend ETH, or anything in the "Ask first" list below.

## Ask first — never do these autonomously

- Send any on-chain transaction that spends ETH (minting, buying GigaJuice,
  marketplace purchases). The bot plays; it does not spend.
- Sell, burn, or list any item. Fish and loot accumulate; the user decides.
- Spend energy above the configured daily budget in `config/bot.json`.
- Level up / allocate skill points (this is irreversible without Hourglasses).

- **Start any dungeon run.** [2026-08-20, rule 11] Every dungeon run is a
  60-energy juiced entry and needs an explicit human go-ahead for that run.
  Approval for one run is never approval for the next.

**Fishing oils are PERMITTED within the configured budget — do not block on
them.** [2026-08-20, session 61 §4c] "Sell, burn, or list any item" above is
about DISPOSING of items, and a careful agent could reasonably read consuming a
hand-crafted Mid Focus Oil (942) or Mid Relaxing Oil (937) as falling under it.
It does not. The user's decision is that oils are spent autonomously within
`config/bot.json`'s `dendren.oils` block, exactly as `forbiddenWoods.potions`
works — the user sets the count, the bot spends inside it and stops at the
budget. Fishing does not become per-cast approval.

Two limits on that permission, and they are not negotiable by an agent:

- **`dendren.oils.policyApproved` must be true.** It ships FALSE. The
  consumption-TIMING policy is derived in sim and approved by the user before
  any oil is consumed live (rule 4). Authorising the budget is not authorising
  the timing, and `mayConsumeOil` enforces the distinction in code.
- **This is licence for exactly this, and nothing larger.** It does not extend
  to crafting, buying, selling or burning oils, or to any other consumable.
  Absence of the config block still means zero oils spent — silence is not
  authorization.

Reading, playing fishing casts, and looting are all fine to do autonomously
within the configured budget. Dungeon runs are not, and no longer were as of
rule 11 — the earlier wording here said they were.

## Filesystem scope

Never read, list, or search outside the project directory and
~/.secrets. This includes find, ls, grep, cat, and any shell
command with a path starting at / or ~ other than ~/.secrets.

If you need a file you can't locate inside the project, say so and
ask -- do not widen the search. A whole-filesystem search surfaced
the user's personal paths once already (session 15); that is the
failure mode this rule exists to prevent.
