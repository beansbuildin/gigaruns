# BRIEF — session 78 — the Codex review, triaged

## 0. What this brief is, and how it was checked

`CODEXAUG22REVIEW.md` is a read-only external review at `489c989`. **This brief
is the triage of it, not a relay of it.** Ten findings; my verdicts:

| | finding | verdict |
|---|---|---|
| **M1** | no request deadline; a stall holds the mutex forever | **DO — first** |
| **H1** | live writes lack shared reconciliation | **DO the reconciliation half. The HTTP half is a rule-7 change and is the USER'S.** |
| **H2** | Rule 8 fights scored by a model that calls them unscorable | **DO the diagnosis half. REFUSE the modelling half — it requires guessing.** |
| **M3** | permanent deck additions use a placeholder objective | **DO — and it is more ready than the review thinks** |
| **L1** | CI runs the suite twice | **DO — it is actually THREE times** |
| **L2** | `engines` advertises Node the toolchain rejects | **DO — the reasoning is already written in your own CI file** |
| **L3** | Actions on mutable major tags | **DO — cheap, low value** |
| **L4** | responses stored up to three times | **DO the shared-module half. REFUSE the log-thinning half.** |
| **M4** | live redraw branch disagrees with the sim | **DO the comment. REFUSE the code.** |
| **M2** | potion timing swept on the pre-Rule-8 model | **DEFER — blocked behind H2, and it is a live policy change** |

**Every claim below was verified by opening the file at `489c989`**, in a fresh
clone with `npm ci` and no `data/`, `logs/` or `~/.secrets`. The review's own
validation baseline reproduces exactly: `tsc` clean, **1430 passed | 13 skipped
(1443)**, `assertionCoverage` **zero vacuous**. Session 77's gates hold
independently.

**The review is good.** Its facts are accurate almost everywhere I checked — the
617/622, the 429-on-POST path, the missing abort signal, the placeholder
objective, the duplicated writers. Where I disagree it is never about the
observation; it is about **two places where it read a deliberate refusal as an
oversight**, and about ordering.

---

## The clock and the ledger

Written **2026-08-22, 10:25 PT**. **Rollover is 11:00 PT — ~35 minutes out.**
Sessions 76 and 77 were both offline by arithmetic; this one need not be. After
11:00 there are **12 run-units and 20 casts**.

`doctor.ts` first, both ledgers, report them. **Everything in §1–§4 is offline
and needs neither.**

*Environment: `npx tsx` and `git` both fail under the command sandbox. Run
unsandboxed.*

*⚠ Session 77 rewrote history. Every SHA older than today is dead. Cite the tip.*

---

## 1. M1 — the request deadline. Do this first; it is the cheapest real defect in the review

**`src/api/client.ts:198-217`. Verified: `fetch()` is called with no `signal`.**

`raw()` runs inside `this.mutex.run(...)`, and that mutex is the only one — the
file's own header says *"a second concurrent request can only race it, never
help it."* So a stalled socket does not slow the bot down; **it stops it
permanently, holding the lock, with no timeout anywhere to break it.** No guard
fires, no `maxConsecutiveActionFailures` counts, no `GuardTrip` throws. The
process simply never returns.

This is CLAUDE.md rule 5 with no code behind it. A hung bot is not a stopped bot.

```ts
const res = await fetch(`${this.base}${path}`, {
  ...init,
  signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  headers,
});
```

**One thing the review gets right and it changes the sequencing: an aborted POST
is an ambiguous write, not proof that nothing applied.** So:

- **Land the deadline for `GET` now.** A GET is idempotent, the abort proves
  nothing was written, and retrying under a bounded policy is safe. This half
  needs nothing else and removes the hang.
- **Land the deadline for `POST` together with §2's transaction helper**, so an
  abort routes into reconciliation instead of throwing an error the caller reads
  as "did not apply."

Pick the timeout from the repo's own numbers, not a round one: rule 7 pins
minimum spacing at 1200ms + jitter and the action-token window at ~5s. A deadline
below the token window turns a slow-but-fine request into an abort; **10s is the
review's suggestion and is defensible, but state the reasoning in the constant's
comment** rather than leaving a bare `10_000`.

---

## 2. H1 — reconciliation: do the transaction half, and take the HTTP half to the user

### 2a. The diagnosis is right, and the evidence is this repo's own

Verified at `scripts/liveRun.ts:729`, the header of `postWithVerifiedRetry`:

> *[session 08, live] `reward_one` returned HTTP 500 twice on an otherwise
> byte-identical request — once where the pick had silently applied server-side
> anyway (`pickedBoons` had grown despite the error), once where it hadn't.*

**The API demonstrably applies writes while returning errors. That is measured,
not theoretical.** And the protection built for it guards exactly two call sites
— `liveRun.ts:1380` (reward) and `:1584` (path). Nothing else.

### 2b. `start_run` is the case that matters, and rule 13 already knows it

`scripts/liveRun.ts:1015-1038`, verified. On a `start_run` error the code calls
`fail(...)`, which throws — **before** `recordRunStarted(runUnits)`,
`recordEnergySpent(estimatedCost)` and `saveGuardBudget(...)`. So if the server
applied the start and lost the response, **the local ledger says zero runs while
the server says one**, and the scarce thing — 12 server-enforced run-units, the
thing rule 4 calls *"the scarce thing"* — is silently out of sync.

**CLAUDE.md rule 13 is a human doing this reconciliation by hand, after the fact:**
*"A permission denial is NOT evidence that nothing ran. Verify against the
server."* The rule exists because this failure is real and recurring. **H1's
`start_run` half is rule 13 executed in code, at the moment of failure, instead
of by a person afterwards.** That is the argument for it and it is a strong one.

Combat moves are a weaker case — the loop re-reads state each iteration, so an
applied-but-lost move largely self-heals. Fishing `play_cards` and loot sit in
between. **Order the work by ledger consequence: `start_run` first, fishing
`start`/loot second, combat moves last.**

### 2c. What to build

The review's shape is right. Return an explicit outcome rather than throwing:

```ts
type ActionOutcome<T> =
  | { outcome: "applied"; response: T | null }
  | { outcome: "not_applied"; error: unknown }
  | { outcome: "unknown"; error: unknown };
```

Two constraints the review states and both are correct:

- **Commit the spend exactly once**, on `applied`, whether or not a response came
  back. An applied action with a lost response must still move the ledger.
- **`unknown` fails closed.** Do not invent a recovery. Log the full state pair,
  exit non-zero, let a human read it. Rule 5.

`postWithVerifiedRetry`'s session-09 lesson must survive the refactor: **re-derive
the index from freshly-fetched state on every attempt, by stable identity, never
by array position.** A generic helper that loses that reintroduces a bug this
repo already paid for.

### 2d. The HTTP half is NOT an agent's to make

The review's smallest fix is *"do not automatically retry non-idempotent
requests in `raw()`."* Verified: `raw()` retries every 429 regardless of method
(`client.ts:208-213`), `BACKOFF_START_MS = 5000`, `MAX_429_RETRIES = 5`.

**CLAUDE.md rule 7 is a non-negotiable and it mandates the current behaviour:**
*"Exponential backoff on 429 starting at 5s."* An agent does not amend a
non-negotiable. **Put this to the user as a rule-7 amendment.**

And when you do, put the sharper argument in front of them, because it is not the
one the review makes:

> **On a POST the retry is not dangerous — it is futile.** Rule 7 pins the
> action-token window at ~5s and `client.ts:10` repeats it. The backoff starts at
> 5000ms and doubles. **The retried token is stale by construction**; the retry
> can only be rejected. So the cost is not a double-apply — a 429 means
> rate-limited, which almost certainly means *not applied* — the cost is 5, 10,
> 20, 40, 80 seconds of the only mutex held to guarantee a failure, on a clock
> where the action token is expiring.

Also worth telling the user plainly: **this repo has never recorded a single
429.** Session 75 logged *"zero 429s"* across 216 actions and I found no observed
429 anywhere in `handoff/`. So this is an unmeasured path. That is a reason to
change it cheaply and honestly — return the 429 to the caller and let the
transaction helper decide — not a reason to treat it as urgent.

---

## 3. H2 — do the honesty half. Refuse the modelling half

### 3a. The observation is correct

Verified. `src/strategy/decide.ts:177-204` computes a precise EV table through
`resolveExchange`. `scripts/liveRun.ts:148-164`'s `buildBattleState` attaches
`run.activeEnemyBuff` and nothing else. `src/sim/combat.ts` reads **corrode and
no other mechanic**. And `src/sim/coverage.ts:145-194` marks `ROLLED_STATS` on
**617 of the same 622 non-Safe paths** rule 8 selects — the number is in the
repo's own comment.

**So the live loop assigns confident EVs to states the coverage layer refuses to
score.** That is real and it is worth fixing.

### 3b. But the absence is deliberate, and the review read it as an oversight

`src/sim/types.ts:31-36`, verbatim:

> *`src/sim/combat.ts` does not read these AT ALL, **and that is the point**:
> their effect on damage is unexplained, so any non-zero value makes the
> surrounding unit **UNSCORABLE rather than being quietly approximated**.*

The review proposes replacing that with probability-weighted proc branches. **To
fill those branches you need proc rates for evasion, block, lck, tenacity and
intuition, and nobody has them.** The review knows: its own *"context that would
materially improve implementation"* asks for *"authoritative mechanics or
captures for evasion, block, luck, tenacity, and intuition."*

Building the machinery and filling it with guessed numbers is CLAUDE.md rule 1
inverted. It would convert an honest **"unscorable"** into a confident wrong
number — the exact failure this repo has spent seventy-seven sessions
eliminating, and the one session 75's redraw finding is a monument to.

**Do not build it. Not as a stub, not "with conservative defaults", not behind a
flag.** A branch structure with invented probabilities is worse than no branch
structure, because the next reader sees an EV and believes it.

### 3c. What to do instead — and the review says it, at line 160

> *Until all mechanics are covered, live decision logs should report the specific
> unmodeled reasons instead of presenting the result as a fully supported EV.*

**That is the whole of H2 that is buildable today, and it is genuinely valuable.**
`probeCombatant` and `probeRun` already compute exactly these reasons. Wire them
into the live decision path so every logged decision in a rule-8 fight carries
its `ROLLED_STATS` / `UNKNOWN_EFFECT` / `ENEMY_BUFF` reasons beside the EV.

Two consequences worth having:

- **Every run report says out loud how much of its own decision-making was
  unsupported.** Right now that is visible only in a coverage script nobody runs
  mid-session.
- **It produces the capture list.** Which mechanics actually co-occur in fights
  the bot loses becomes a measured priority ordering instead of the review's
  guessed one.

Then the follow-on is a **capture request, not a modelling task** — and rule 6 is
explicit that a gate needing data that does not exist is *"a capture request
wearing a gate's clothes."* Record it as one in `TASKS.md`.

---

## 4. M3 — the deck objective. The best item in the review, and readier than it says

### 4a. Verified, including the part the review gets wrong

`src/strategy/fishing/cardChoice.ts:678-684` — `chooseNewCard` is argmax
`max(hit, crit) / manaCost`, and its own comment says it is a *"simple,
defensible placeholder... Not sim-validated against a full-deck-composition
objective."* The review is right that each pick permanently changes every future
cast.

**But the review lists *"a complete fishing card catalog mapping card IDs to
zones/effects"* as missing context. It is not missing.**
`fixtures/fishing-casts/cards.json` holds **80 cards** with `hitZones`,
`critZones`, `hitEffects`, `critEffects`, `missEffects`, `manaCost`, `rarity` and
`foundInPonds`, and `src/sim/fishing/deck.ts` already loads and zod-validates it.
**M3 can be built today, offline, with no new captures.**

### 4b. Build it — with one condition that is not optional

Paired Monte Carlo over full-deck composition, identical trajectories and seeds
per arm, cached by normalized deck. Offline, precomputed; **never inside the
action-token-sensitive live loop** — the review says this and is right.

**The condition:** `castSim` has been shown not to reproduce this fishery.
`OIL-POLICY.md` §0a suspends every Δ in it for exactly this reason — sim catch
~70% against a real 27.6%, meter-out 1.0% against 64.2%. **A deck objective
derived on that instrument inherits that suspension the day it is written.**

So: build the harness, report the ranking, and **mark it SUSPENDED pending a
profile check, in the same words §0a uses.** Do not let it become a second
headline number that cannot be quoted. If the ranking is robust across the
profile-check parameters, say so and that is a real result; if it flips, that is
a more useful one.

**Do not change `chooseNewCard` live.** That is a live policy change on a sim
result — rule 4 — and the ship-nothing posture holds.

---

## 5. The low-priority items — take four, and one of them is bigger than labelled

**L1 — do it, and note the review undercounted.** `.github/workflows/ci.yml`
runs `npx vitest run`, then `assertionCoverage.ts` which spawns
`vitest run --config vitest.assertions.config.ts` (`scripts/assertionCoverage.ts:68`),
then `preflight.ts` which runs the suite against the export. **Three full runs,
~65s each.** Drop the plain step and let `assertionCoverage.ts` be the suite step
— it already distinguishes a red suite from a vacuous test (`suiteFailed`), so
nothing is lost. Keep preflight's run: it tests a different tree, which is the
whole point of it.

**L2 — do it; your own CI file already contains the reasoning.**
`package.json` says `>=20`; `ci.yml:52-53` says, in a comment: *"22 rather than
the `engines` floor of 20: vite requires ^20.19 || >=22.12, so a bare '20' can
resolve below what the toolchain accepts."* **The problem was diagnosed, worked
around in CI, and left wrong in the manifest a stranger reads.** Set
`"node": "^20.19.0 || >=22.12.0"`.

**L3 — do it, low value, no downside.** `actions/checkout@v5` and
`actions/setup-node@v5` are mutable. `permissions: contents: read` and no secrets
limit the blast radius, so this is hygiene not urgency. Pin SHAs with a version
comment beside each. Note session 77 §2 deliberately moved to `@v5`; this is the
next notch, not a reversal.

**L4 — take the refactor. REFUSE the log-thinning.**

The refactor is right and is the same class of defect this repo keeps finding:
`FixtureWriter` and `RunLog` each exist **twice**, independently, at
`scripts/liveRun.ts:454`/`:503` and `scripts/liveFishing.ts:1079`/`:1107`. A
redaction or durability fix applied to one and not the other is a silent
divergence in the two paths that write the evidence everything else is built on.
Extract one capture module.

**But do not thin the JSONL logs to "tag, action, status, room/turn, deltas."**
Session 76's STATE.md records that `logs/` is gitignored and **LOSSY**, and that
four Relaxing observations from session 69 survive only inside a report because
the record was never written — CLAUDE.md rule 10 in its second form. **Cutting
the log is a bet about what future analysis will need, placed by a reviewer who
has not done that analysis.** Fixtures are 73MB in a clean clone. That is not a
problem worth paying for in evidence.

---

## 6. M4 and M2 — one comment, one deferral

**M4 — write the comment, not the code.**

The inconsistency is real: `liveFishing.ts:2296` calls `shouldRedraw()`, does not
observe the moved cell, and does not increment `turn`, while the corrected sim
does all three. But `liveFishing.ts:2337-2352` **already says so**, under a
heading reading `── UNRESOLVED, AND IT BLOCKS ENABLING THIS ──`, and it raises
what the review misses:

> *feeding it in without a placement is a change to how the predictor is fed that
> nothing has measured. Which of those is right is a question for the
> recalibration this flag is waiting on, **NOT for whoever first flips it**.*

The review's fix — `matcher = observe(matcher, toCell); turn++` — **is that
decision, made silently, by exactly the reader that comment warns about.** The sim
can observe on a redraw because it has a true trajectory to observe *against*;
live there is no placement to score the observation with. Same three lines, not
the same operation.

**Do:** update that block to cite session 75's measured figures (263.0 → 43.9,
catch 24.9% → 32.5%, ~29.9 at the fresh-hand threshold) and name the two
candidate semantics as the open choice. **Do not** write the lines.

**M2 — defer, and record why.**

The claim is accurate: `src/strategy/potions.ts:11` is a flat
`DEFAULT_POTION_THRESHOLD = 0.5`, swept on the clean simulator. But the review's
fix is `hp <= credibleNextExchangeHpDamage`, which needs the corrected Rule 8
model — **which §3 says cannot be built yet.** The review's own implementation
order puts H2 third and M2 fourth, so it sequences a blocked item behind a blocked
item.

It is also a **live policy change** to consumable use, which is rule 4 and the
user's call regardless. **Record it in `TASKS.md` as blocked on the H2 captures,
and do not touch `0.5`.** The review says this too — *"should not be solved by
changing `0.5` blindly"* — and it is right.

---

## 7. Gate

**All offline, deterministic, no live budget, no `data/`.** Rule 6.

1. **The bot cannot hang.** `raw()` carries a deadline; a GET abort is bounded
   and retried, a POST abort routes into §2's outcome type rather than throwing
   a "did not apply." Demonstrated by a test that stalls a socket and asserts the
   mutex is released and a typed outcome returned — **not** by reading the code.
2. **Every irreversible action class returns the same transaction outcome**, and
   `start_run` in particular can no longer throw without either committing the
   spend or proving it did not land. Tests cover applied-despite-error,
   definitely-pending, unreadable state, timeout and exactly-once accounting.
   `postWithVerifiedRetry`'s locate-by-identity rule survives the refactor,
   pinned by a test.
3. **No live decision is logged as a supported EV when the coverage layer would
   refuse to score it.** `probeCombatant`/`probeRun` reasons appear beside the EV
   in the live decision log, demonstrated on a captured rule-8 state.

Not gated, do if there is room: §4's deck harness (the largest single item and
the one most likely to overrun), §5's four items, §6's comment.

**Rule 7's amendment is NOT gated — it is a question for the user (§2d).**

---

## 8. Do not

- **Do not change `raw()`'s 429 behaviour.** Rule 7 is a non-negotiable; take it
  to the user with the futility argument (§2d).
- **Do not build H2's proc-branch model**, not stubbed, not defaulted, not
  flagged. The proc rates do not exist and inventing them is rule 1 inverted
  (§3b).
- **Do not change `chooseNewCard` live**, and do not quote the deck ranking
  unsuspended (§4b).
- **Do not write M4's three lines** (§6). Do not enable `redrawEnabled`.
- **Do not touch `DEFAULT_POTION_THRESHOLD`** (§6).
- **Do not thin the JSONL capture logs** (§5, L4).
- **Do not run a deck simulation inside the live loop** — action-token window.
- **Do not start a live run without `doctor.ts` and a per-run go-ahead**, and
  never chain runs.
- Standing: do not quote +19.40pp; do not re-run the oil sweep on the current
  instrument; do not present a `castSim` result as evidence about live play; do
  not read session 75's run 4 against runs 1–3; do not give a new I/O-owning test
  construction a real data path.

---

## 9. Carried, and one of them is now six sessions old

Session 77's open questions, none addressed by the review:

- **The forced Relaxing consume plus the era batch — unspent since session 73.**
  `OIL-POLICY.md` §1's two load-bearing live questions (does `use_fishing_item`
  advance the fish, does it cost mana) are answerable by **one** deliberate cast.
  **Rollover is 11:00 PT and there are 20 casts.** Three briefs running have said
  this costs nothing to defer; it is now the oldest thing on the board and
  deferring it a sixth time is a decision, not a deferral.
- Per-test assertion counts are now recorded — is a low-assertion review worth one
  pass, or does that metric rot into a target?
- Dead SHA citations inside old session logs — note in each, or does DECISIONS.md
  suffice?
- Separate the crit source with one-lure-only casts? What re-derives +19.40pp?

The review's own fishing priority list agrees with the record on two points worth
noting: **keep `pConnect` closed** unless a level-sensitive consumer appears
(matching session 75's moot verdict), and **keep the focus work suspended** until
the harness reproduces live opening focus spend. Both are already the posture.

---

## 10. Corrections to me

- **I triaged a review I did not commission, against rules I have been reading for
  four sessions, and I am the third opinion in the room.** Where I say "refuse",
  I mean *"do not do this silently"* — H2's model and M4's three lines are both
  defensible with evidence that does not exist yet, and the user may want them
  anyway. **Neither is an agent's call and neither should be settled by a brief.**
- **The review is better than my objections make it sound.** Its facts held up
  under every check I ran; the two disagreements are both cases of an outsider
  reading a documented refusal as a gap, which is what an outsider is for. **The
  correct response is to write the refusal where the reviewer would have seen it**
  — `types.ts:31-36` says it well, `chooseNewCard` says it well, `liveFishing.ts`
  says it well, and Codex still missed all three, which is evidence about where
  those notes live rather than about the reviewer.
- **Rule 9 applies to this document.** If anything above is wrong against the code
  or a live response, the code wins, the claim is not implemented as stated, and
  the correction goes in the recap.

---

## Your task (session 78)

1. `doctor.ts` first, both ledgers. Past 11:00 PT they have rolled.
2. **§1 / gate 1** — the request deadline. GET now; POST with §2.
3. **§2 / gate 2** — the transaction helper, `start_run` first. **Ask the user
   about rule 7 (§2d); do not amend it yourself.**
4. **§3 / gate 3** — wire the coverage reasons into the live decision log.
   **Build nothing else of H2.**
5. **§5** — L1, L2, L3, and L4's refactor only.
6. **§4, §6** — the deck harness if there is room; M4's comment; M2 recorded as
   blocked.
7. **§9** — if past 11:00 and the user gives a go-ahead, the forced Relaxing
   consume is the item I would spend a cast on.
8. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit, `assertionCoverage` at zero, no test writes a real data path, secret
   scan before handoff.

**Honest expectation.** §1 and §2 are the session: a bot that can hang forever and
a ledger that can silently disagree with the server are the only two findings here
that can cost something irreversible, and both are fixable today with no new
captures. §3 is small and will feel unsatisfying — it makes the gap *visible*
rather than closing it, which is the right move and reads like a half-measure.
**The likeliest way this session goes wrong is §4 eating it**: a paired-Monte-Carlo
deck harness is a genuinely interesting problem and it is the one item here with
no ceiling. If it starts to overrun, stop and hand it forward — it has waited
since session 17 and it can wait one more.
