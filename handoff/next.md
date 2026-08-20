# BRIEF — session 54 (rule 11, then the fishing batch §19 has waited four sessions for)

Session 53 passed its gate cleanly — **24 path-selection decisions, 0
first-attempt rejections**, against a historical rate of 66/66 = 100% — and
closed §21 and §22. Room 10 / 8112 / 687 is the deepest and best-scoring run in
the corpus by a wide margin. Two questions that had been carried for three
sessions are done.

It also caught a real error in my own brief before it cost anything, which is
the single most valuable thing a session can do with a brief. §0.

---

## 0. Corrections to me

- **My §0c number was on the wrong clock, and session 53 caught it from my own
  data.** I measured the accept/reject split as gap-since-**response**
  (1.54–3.40s), then proposed 3600ms as `minGapMs` — which `RateLimiter`
  applies **request-to-request**, stamping `lastCallAt` before dispatch. The
  two differ by one response latency (0.72–1.78s, median 1.45, n=296), so 3600ms
  request-to-request would have left as little as ~1.8s since the response:
  inside the reject band, and it would very likely have failed my own gate.
  Session 53 built `RequestPacing.minGapSinceResponseMs` instead and set it to
  4000. That is the correct fix and I had the data to see it.
  **The general form, worth keeping:** a threshold measured against one clock
  cannot be handed to a limiter that enforces a different one. State which
  event a duration is measured *from*, every time.
- **My §6 question was backwards.** I asked which modelled boons had never been
  offered in room 1; the answer is zero, and session 52's own `AddMaxHealth`
  capture closed the last hole. The real gap runs the other way — 36 boon types
  offered with no `BOON_MODELS` entry.
- **My §22 was one alias pair; it was five.** I read session 52's report of the
  pair that cleared the promotion threshold and did not ask whether the pool
  held others.
- **My "40 decisions, 40 rejections" arithmetic needed session 53's correction
  to be stated right.** The 132 historical empty-token POSTs are 66 decisions
  each sent twice, so the rate is 66/66 = 100%, not 66/132 = 50%. My table
  reported both halves correctly and then described them in a way that invited
  the wrong denominator.

---

## 1. Rule 11 — the standing dungeon protocol, and the ordering that makes it safe

**User directive, 2026-08-20:** every live dungeon run is a 60-energy juiced
Tier-3 entry with 3 Big Heal Juices, one run at a time, stopping for approval
before the next. This is now **CLAUDE.md rule 11** (already written; read it
before starting). The user's stated motivation for the config half is right:
with plain runs gone, potions are economically sound on every run that happens,
so the add-before / remove-after churn has no reason to exist.

**But the churn was load-bearing, and this is the thing to get right.**

`scripts/orchestrator.ts:127-141`'s `resolvePotionLoadout` gates on
`config.potions` and nothing else. Its doc comment says it "Mirrors
`liveRun.ts`'s `main()` allowlist gate exactly" — it does not.
`liveRun.ts:1370-1385` has **two** gates: the config block must be present
**and** `--juiced` must have been passed, because "plain runs must NEVER use
potions" (session 24). The orchestrator implements the first and not the
second. And it calls `runOnce` with **no `juicedStartRun`**
(`orchestrator.ts:298-312`), so every run it starts is a plain 20-energy run.

Net: make the potions block permanent today, and the next `orchestrator.ts`
invocation starts a plain run and loads 3 Big Heal Juices into it. That is
session 24's incident verbatim. The remove-after-use convention has been the
only thing preventing it for thirty sessions — a latch standing in for a
missing gate, which nobody wrote down because the latch always got pulled in
time.

**So the order is not negotiable:**

1. **Close the orchestrator's dungeon arm first.** User decision: disabled, not
   flagged. `nextAction` never returns `{kind: "dungeon"}`; the dungeon branch
   in `scripts/orchestrator.ts` fails closed with a message naming rule 11 and
   pointing at `liveRun.ts --juiced --juiced-index=3 --runs=1`. Delete
   `resolvePotionLoadout` and the `startConsumables`/`potionPolicy` wiring on
   that path rather than leaving them unreachable — an unreachable potion
   loader is exactly what gets re-reached later.
   - `dungeonBudgetSnapshot`'s `costPerAction: config.energyCostPerRun` (20) is
     also wrong under rule 11 and goes with it. Do not "fix" it to 60 and keep
     the arm.
   - The **fishing arm is untouched** and still runs autonomously within budget.
     Make sure the disabled dungeon arm cannot make `nextAction` return `done`
     while fishing still has budget — that would silently stop fishing sessions.
     Test that case explicitly; it is the obvious way this change goes wrong.
2. **Then** make `forbiddenWoods.potions` permanent:
   `{"allowedItemId": 131, "maxPerRun": 3}`. Rewrite `_potionsComment` — it is
   now ~1,900 characters of add/remove history for a convention that no longer
   exists. Replace it with: the block is permanent as of rule 11; the safety
   argument is that no code path starts a non-juiced run; and **if the
   orchestrator's dungeon arm is ever reopened, remove-after-use comes back with
   it.** Keep the session 24 incident in one sentence — it is the reason, and a
   comment that keeps its reason survives being edited by someone in a hurry.
3. **Then** a test that would have caught this: assert that no code path
   constructs a `LiveRunDeps` with a `potionPolicy` and no `juicedStartRun`.
   That is the invariant, stated once, in a place that fails loudly.

Leave `liveRun.ts`'s own `--juiced` gate exactly as it is. With the orchestrator
closed it is belt-and-braces, and it is the brace that has actually held.

Do **not** change the daily ceiling. 240 energy / 60 and 12 run-units / 3 both
give 4 juiced runs per day and they agree; that agreement is worth more than the
tidiness of renaming the units. Rule 11 says to stop if they ever disagree.

---

## 2. §19 — the fishing batch. This is the session's real measurement.

The cap resets 11:00 PT and the library is finally the right one. §19 has been
"needs a batch, not an argument" since session 51 and has been blocked three
times by things that were genuinely more urgent. It is not blocked now.

**Session 51's decision rule, unchanged and not to be renegotiated after seeing
the data:**

- If π never exceeds 0.5 on any cast in the batch → the matcher tier is buying
  nothing live and gets dropped.
- If π exceeds 0.5 on at least one cast **and** that cast's turns hit above the
  batch's own base rate → it keeps its 0.030 nats.

Run the batch against the **3-pattern de-aliased library** (perimeterWalk cw 4,
ccw 4, bounce(2,0) 3 → 11 distinct supporting casts of 89, π₀ ≈ 0.133). Record
support counts at batch time so the number is pinned to what actually ran.

Read `matcherWeight` off the `ringPrediction.jsonl` rows. Report the full π
distribution, not just whether it crossed — the median was 0.135 on the replay
with 70.5% of active turns below 0.15, and whether live looks like that is
itself the finding. The 5-cast checkpoint discipline is unchanged.

One thing the replay cannot see and the batch can: session 50 measured that with
the matcher OFF the replayed policy stops spending focus (0.71 vs live 1.80). If
π stays at the floor all batch, note the live opening focus spend anyway — the
entanglement is the reason "it's only 0.030 nats" was never a safe drop, and a
batch that says π never moved should also say whether spending looked normal.

---

## 3. §23 — the −1 energy drift, and yes, carry it

3/3 juiced runs under-report by exactly 1 (`observedDelta` 59 vs
`committedDelta` 60). Session 53's reasoning is right that regen cannot produce
−1 three times: 18/hr over a ~2-minute run is ~0.6, and it would not land on
exactly −1 every time.

Your proposed test is the right one and it costs nothing extra, so **carry it on
the next run**: read `GET /offchain/player/energy` immediately before and
immediately after `start_run` with nothing else in flight. But rule 11 has
removed the plain-run comparison arm you wanted — there are no 20-energy runs
any more. So the discriminating comparison changes shape:

- If the −1 appears in the tight before/after pair around `start_run` alone, it
  is the charge, not the accounting, and the multiplier is the suspect (59 =
  20×3 − 1 has an obvious shape: a rounding or an off-by-one in a 3× charge).
- If the tight pair reads a clean −60 and the drift only appears across the
  whole run, something inside the run credits 1 back — a loot effect, a boon, a
  regen tick landing inside the window — and that is a different investigation.

Either way it is diagnosis by read, not by spend. Nothing is at risk: the guard
enforces off committed spend and the error is conservative. Do not fix it before
you can say which of the two it is.

---

## 4. Claim order — switch the default to descending

Your open question 3, and the answer is yes, per my own stated stopping rule
from session 52 ("these reasons stop applying once the path is proven, so do not
make ascending the default"). Both blockers are now gone:

- The path is proven: 8 claims across three runs, **drift 0 every time**.
- The overflow hazard is closed by construction: `maxSnapshot` 315 <
  `headroom` 394 on both runs, so no single claim this path can make can reach
  the 420 cap.

Switch the default to `"descending"` and stop passing `--claim-order`. Keep
`overflowReachable` in `claim_audit` — it is what makes the switch safe, and if
the bank ever grows a ROM larger than the headroom it should say so out loud
rather than silently becoming reachable again. Consider a WARN when
`overflowReachable` flips true, on the same reasoning as §1's telemetry: the
condition that makes a decision safe should announce when it stops holding.

---

## 5. The remaining open questions

**Room 9 (Enemy Room 71) needs a Safe capture — leave it, don't target it.**
Its only capture is a forced Risky (`[1,1,1]`, no Safe offered), so it carries
`bloodthirsty` and rolled stats and cannot be modelled. But rule 8 means you
cannot *choose* to capture it clean — you take the lowest offered tier, and
whether Safe is offered in room 9 is the server's call, not yours. Targeting it
would mean either overriding rule 8 or re-entering repeatedly hoping for a
different offer at 60 energy a try. Neither is worth it. It will capture clean
the first time a run reaches room 9 and Safe is on the board; 5 of 12 rooms
offered no Safe last session, so this is a waiting game with decent odds, not a
task.

**36 unmodelled boon types — stay opportunistic, but publish the list.**
`scripts/boonCoverage.ts` exists now, so put its output in the recap each
session and let the ranking come from offer frequency. Modelling a boon that
gets offered once every forty runs costs more than it returns. What is worth
doing once: check whether any of the 36 appear in **room 1–3** offers, since
those are the ones the sim's `deepestScorableRoom` chokes on — session 53's own
corpus growth dropped one arm from 5 to 4 because three new unmodelled types
landed at rooms 3/4. That is the subset with leverage.

**`deepestScorableRoom` 5 → 4 is not a regression, and Task 4.5's old gate sat
at 4.** Worth one line in TASKS.md saying so explicitly, per rule 6: an honest
capture lowering a coverage metric is exactly the case where a stale gate starts
looking like a failure. Do not tune anything to get it back to 5.

**Fixture redaction (your question 6) — this one deserves a decision, not a
shrug.** Tracked fixtures redact `PLAYER_CID` to `0xUSER` but keep
`NOOB_TOKEN_CID` at its real value, on a public repo, since session 08. The
token id is not a credential and nothing is compromised — but it is a stable
on-chain identifier for the same account the address redaction is hiding, so
anyone who wants the address can read it off the token. **The redaction as it
stands does not do the thing it looks like it does.** That is worse than not
redacting, because it invites the assumption that the fixtures are anonymous.

Pick one and write it down: redact both (and re-derive the existing fixtures, ~a
mechanical pass), or redact neither and state in `fixtures/README` that these
are account-identifying. CLAUDE.md §3 covers secrets, and this is not one — so
this is the user's call about linkability, not a security incident. Ask; do not
decide it unilaterally, and do not leave it as is.

---

## Your task (session 54)

1. **§1, in order** — orchestrator dungeon arm disabled (fishing arm verified
   still live), *then* `forbiddenWoods.potions` permanent with a rewritten
   comment, *then* the invariant test. Rule 11 is already in CLAUDE.md.
2. **§4** — default claim order to descending; `overflowReachable` WARN.
3. **§2** — the §19 fishing batch against the 3-pattern library, session 51's
   decision rule applied as written, full π distribution reported.
4. **§3** — the tight before/after energy read on whichever runs happen.
5. **§5** — `boonCoverage.ts` output in the recap; the rooms 1–3 subset
   identified; one line in TASKS.md about the 5 → 4 gate; the redaction
   question put to the user with a recommendation.
6. Dungeon runs only if the user gives an explicit go-ahead for each one
   (rule 11). The cap allows 4/day; needing none of them is a fine outcome for
   this session.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes to a real data path.

**Honest expectation.** §1 is chores with one real trap in it, and the trap is
the whole reason it is item 1 — the ordering is the work, not the edits. §2 is
the only thing here that can change what the bot believes: four sessions of
"needs a batch, not an argument" finally gets its batch, and it can legitimately
end with the matcher tier being deleted. Say so plainly if π never leaves the
floor; a tier that has cost two sessions of analysis and buys nothing live is a
good thing to be rid of, and reporting that cleanly is worth more than finding a
reason to keep it.
