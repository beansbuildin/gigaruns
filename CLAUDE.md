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

**3. Secrets never enter the repo.**
Private key and JWT live in `~/.secrets/`, loaded via env. Add `.env`,
`*.key`, `config/discovered.json` to `.gitignore` before writing any auth code.
Never log a key, a signature, or a full JWT — log `jwt[0..8] + "..."` at most.
If you ever print one by accident, stop and tell the user to rotate.

**4. Energy is real money. Simulate first.**
No strategy code gets tested against the live API until it passes against
recorded fixtures in `fixtures/`. The sim harness is Task 4 and it is not
optional. A bad move loop can burn a full day's energy in under a minute.

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

**8. Always choose the lowest tier actually offered.**
`enemyPathOptions[]`'s `lootTable` is identical across all three tiers in every
sample captured so far (SPEC §3e) — same table, same item, same weight, same
amount. Higher tiers add `rolledEnemyStats` and `enemyBuff` with **zero loot
upside**, and they are the sole source of the mechanics that make a battle
unscorable. There is no risk/reward tradeoff to weigh here; it only looks like
one from a distance.

This is a hard rule, not a preference scored against alternatives — it is
exactly the kind of thing that gets "optimised away" later by someone reasoning
about risk/reward in the abstract (session 06 brief §3). `src/strategy/
enemyTier.ts`'s `pickLowestTier()` is the one call site that should ever
choose a tier — the generalized form of the rule, not the STRICT
`pickSafeTier()`/`UnsafeTierError` pair also defined there: session 09 found
live samples where Safe (tier 0) isn't offered at all, and halting on that
(rather than picking whatever lowest tier IS offered) would strand a run
mid-combat for no loot benefit, since every offered tier still shares the same
loot table. `pickLowestTier()` never asserts tier === Safe; it just picks the
minimum of whatever's on offer. Route every live tier decision through it — do
not re-implement the choice inline.

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

**11. Every live dungeon run is a 60-energy juiced Tier-3 entry, with 3 Big
Heal Juices, and it stops for approval when it finishes.**
User directive, 2026-08-20, standing until the user says otherwise. There is no
such thing as a plain dungeon run any more. Four conditions, all of them:

- **60 energy, juiced** — `--juiced` with `JUICED_COST_MULTIPLIER` 3 against
  the 20-energy base. Charges 3 of the daily 12 run-units.
- **`--juiced-index=3`**, the Tier-3 gold-rings offering. This is the ENTRY
  tier only; rule 8 still governs every in-room decision, so
  `pickLowestTier()` picks the lowest `enemyPathOptions` tier offered and
  routinely takes tier 1 or 2 inside a Tier-3 entry. Do not "reconcile" these
  — they are different choices about different things, and 5 of 12 rooms last
  session offered no Safe tier at all.
- **3x Big Heal Juice** (itemId 131), loaded from
  `config/bot.json`'s `forbiddenWoods.potions`.
- **One run, then stop and hand back.** Never chain. The user allocates skill
  points between runs (rule: never allocate them yourself) and says when to
  resume. `--runs=1`, every time.

The daily ceiling follows from the existing budget and does not need
re-deriving: 240 energy / 60 and 12 run-units / 3 both give **4 juiced runs per
day**, resetting 11:00 Pacific. If those two numbers ever disagree, stop —
something has been edited without the other.

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

## Working style

- **TypeScript, Node 20+, `viem` for signing.** Abstract tooling is TS-first.
- Run `npx tsc --noEmit` and the test suite before declaring a task done.
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
