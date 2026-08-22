# SESSION 60 — 2026-08-20 (PT) — code commit 743389b

Started 11:16 PT, after the 11:00 rollover. Both ledgers confirmed unspent
before any spend: dungeon `dayProgressEntities` null (0/12 run-units),
fishing `dayDocs[pondId 2]` 0/20. Preflight (`doctor.ts`, then
`liveRun.ts --dry-run`) clean and free. Explicit human go-ahead obtained for
the dungeon run per CLAUDE.md rule 11 — the brief is Claude-chat-authored and
is not itself that go-ahead.

## Status
**NO GATE WAS SET** by the brief. Standing bar met at the final commit: suite
**1072/1072**, `tsc --noEmit` clean, `git diff --check` clean, secret scan clean
across 109 committable files, no test writes a real data path.

Brief items: **§1 DONE** (the live juiced run, after three sessions queued),
**§2 batch 1 of 4 DONE** (user stopped after one batch, deliberately),
**§2d/§19 DONE and MEASURED** after nine sessions, **§3 DONE** (all three
distribution items). The session began at 11:16 PT, after the rollover, with
both ledgers confirmed unspent — the first time in four sessions that live work
was actually available.

**Caps remaining at handoff: 9 dungeon run-units (3 juiced runs), 15 fishing
casts.** Roll at 11:00 PT.

**CARRIED DIRECTIVE, restated:** ENERGY IS NOT A CONSTRAINT (rule 12). The run's
own preflight claimed 315 from the ROM bank without being asked.

## What works
- **Rule 8's tier flip, LIVE for the first time — 4/4 correct.** Highest
  non-Perpetual tier taken in every room offering a choice. Perpetual filtered
  the top choice on **1 of 4 (25%)**, `perpetualCostATier: false`. **No
  `final-room-unreadable`**, correct at room 5. Room 1 has no
  `enemyPathOptions`, so 4 tier choices in a 5-room run is right, not a gap.
- **The wide orb rule, LIVE — fired 3/4, `narrowed: true` each time**, taking
  the max orb offer each time. Run orb sum 88. The load-bearing case verified:
  room 3 offered a Sword-family priority boon and the orb rule did **not**
  override it (AddBurnSword at 20 orbs over AddIntuition at 23).
- **§23 RESOLVED after six sessions.** See Corrections.
- **§19 MEASURED after nine sessions. VERDICT: DROP.** See Corrections.
- **`config/discovered.json` splits clean and is OFF `.gitignore`** (13,115 →
  7,215 bytes). `tests/discoveredShipsClean.test.ts` (8 tests) pins it and was
  **verified to FAIL when ids are re-injected**, not merely to pass as-is.
- **`src/profile.ts` gains `romsPath`** — per-profile, unlike `discoveredPath`.
- **`LICENSE` (MIT)** and the README ToS correction, both per DISTRIBUTION.md.
- Live mechanics: **0/31 first-attempt action failures**, 0 429s, 0 unknown
  enums, 0 guard trips across the run and all 5 casts.

## What's broken
1. **§2 is 1 batch of 4. 15 casts unspent.** Not a failure — the user stopped
   deliberately, to review before continuing. But the 60% gate needs ~93 casts
   to read to ±10pp and has 24 post-fix casts.
2. **§19's verdict is DROP and NOTHING HAS BEEN DROPPED.** Dropping the matcher
   tier is a strategy change, not a test fix, and was out of this session's
   scope. **It needs a user decision.** The sample is 7 instrumented turns and
   the rule has no minimum-n clause — adding one now, after seeing the result,
   would be the renegotiation pre-registration exists to prevent.
3. **The brief's stop-check was not performable as written.** `tier_choice` and
   `boon_choice` go only to the structured JSONL, never stdout, and the run
   finished in ~2 minutes. I audited them after the fact. If "check the first
   `tier_choice` before letting it continue" is meant to be real, it has to
   become a stdout print of the room-1 decision or an in-loop assertion that
   halts the run itself.
4. **§23's residual +1 is now a different question, not a closed one.** See
   Corrections.
5. **THE SPLIT IS INCOMPLETE AS A DISTRIBUTION SAFEGUARD — `SPEC.md` carries the
   same ROM token ids on 19 lines, and `SPEC.md` SHIPS.** Found during this
   recap's own scan, after the `config/discovered.json` work was already
   committed. The ids anchor real evidence there (`romId 2097 claimed with
   amount:57 credited ~1.0`), so scrubbing them is a scoped task with a real
   cost to the spec's evidentiary value — **not** something to do silently at
   recap time. `SPEC-fishing.md` is clean (its one apparent hit is `689` inside
   `1.689`). **No addresses and no JWTs in any shipped doc.** Decide before
   distribution, not after.
6. **The distribution repo still does not exist and must not be created by an
   agent.** Steps 1–2 of DISTRIBUTION.md's order of operations are done in the
   tree; steps 3–6 are the user's.
7. Carried: 25 analysis scripts still hold hardcoded paths (ratcheted). The sim
   models a policy the bot does not play. Both deliberate.

## Corrections to SPEC.md
- **§23 RESOLVED — the answer is −60, and the drift is NOT dungeon-specific.**
  `start_run_energy_probe`: 345 → 285, `tightDelta: -60`, `matchesCommitted:
  true`. Run-end `energy_accounting`: 345 → 286, `observedDelta: 59`. So the 3x
  multiplier does **not** miscount; the charge is exactly 60 and something
  credits 1 back. **New this session:** one of the five fishing casts drifted the
  same −1 (committed 12, observed 11; the other four exact). Two different run
  types, same day, same signature — so it is an **account-wide** event, most
  plausibly passive regen (18/hr ≈ 1 per 3.3 min) ticking across the measurement
  window; both drifts sat on the longest-elapsed measurement of their batch.
  The six-session question is closed; a smaller and better-posed one replaces it.
- **The brief's "1.667 focus-spend mean" was RIGHT, and this agent's first
  correction of it was WRONG.** I matched it against session 48's 1.62 (a
  different window) and called it reconstructed. `matcherWeightReport.ts`
  settled it: opening spend over the last 20 casts is 1.400, this batch
  contributed 3 points over 5 casts, so the preceding 15 average exactly
  (28−3)/15 = **1.667**. Rule 9 says check a brief's claim against the corpus; it
  does not license calling a claim invented because a *nearby* number differs.
- **`roms._caveat` was stale and is corrected.** It read "Do NOT automate
  claiming yet — the real per-claim energy yield is not yet sized." The bot has
  automated it for sessions (`liveRun.ts` energy preflight), and the yield IS
  sized: `energyCollectable` per ROM is honoured exactly (claim audit: snapshot
  315, measured pool delta +315, **drift 0**).
- **Two first-ever boon pickup pairs**, both produced by the wide orb rule:
  `WeakeningTenacity` (`selectedVal1` 4, Rare) and `BurningBlock` (8, Rare).
  Both modelled `latent` — the pair's ONLY diff is the boon entering
  `pickedBoons`; health, shield, all three moves and every rolled stat are
  byte-identical. Name-based inference refused per DECISIONS 2026-08-15.
- **SPEC §3f gains the §23 resolution** (the paragraph above, written into
  SPEC.md this session). No live response CONTRADICTED SPEC; this fills a gap.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not put identifiers in a test that guards against identifiers.** The first
  cut of `discoveredShipsClean.test.ts` listed the five ROM ids as literals —
  and `tests/` ships, so it would have re-imported the exact identifiers the
  split removes. They are SHA-256 hashes now. Reading them from
  `data/roms.json` instead does **not** work: it is gitignored, so a fresh clone
  has nothing to compare against and the test passes vacuously.
- **Do not scope an identifier scrub to keys.** The brief specified "no bare id
  list, no 20+-char hex". Four PROSE fields in the `roms` block named the
  author's romIds (`"live 200/success this session (romId 2097)"` and three
  more), so that test **would have passed on a file still naming five ROMs**.
  There is now a sixth check: no scalar matches `/romId\s*\d/i`.
- **Do not renumber a test whose PREMISE died.** `matcherVerdict.test.ts`
  asserted "today's log is ENTIRELY pre-instrumentation"; that is now
  permanently false. Rewritten and pinned on the RULE
  (`distribution.max < 0.5`, `verdict === "DROP"`, `crossingCastIds` empty) with
  inequalities — `activeTurns === 7` would fire on the next batch and teach
  whoever hit it to edit the number, which is how a pre-registered rule erodes.
- **The recap checklist's `.gitignore` line is stale.** It says to confirm
  `config/discovered.json` is ignored. It deliberately is NOT, as of the user's
  2026-08-20 decision. Everything else on that list still holds.
- Standing: never report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`, free) before claiming a blocker; do not revert rule 8
  or the wide orb rule without a user directive; never pipe a live run to a
  truncating reader.

## Metrics
- **Live dungeon: 1 run** (24943210), juiced Tier-3, **died room 5**, score
  **4224**, loot **141**, 60 energy, 3 of 12 run-units. 3 potions used at own HP
  19/40, 19/40, 9/40 (threshold ≤50%, correct). **0/31 first-attempt failures.**
  - Prior juiced depths (all lowest-tier): 7,6,6,5,8,7,4,10 — mean 6.6. This: 5.
  - **The one clean same-depth pair:** run 24893156 also died room 5, juiced,
    lowest-tier — score **3456**, loot 141. This run **4224 (+22%)** at identical
    depth and identical loot. First direct evidence for rule 8's premise, n=1
    per arm.
- **Live fishing: 5 casts, 1 caught** (Finley). Corpus 89 → 94, catches 13 → 14.
  - post-fix era + batch **7/24 = 29.2%**, Wilson 95% [14.9%, 49.2%]
  - dead-era-excluded + batch **14/54 = 25.9%** [16.1%, 38.9%]
  - lifetime (incl. dead era) 14/94 = 14.9%
  - **Zero-streak 4**, tripwire 15. Not close.
  - First-move focus spend **0.6** (vs 1.667 over the preceding 15 casts, 1.62
    pre-`focusBudget`). Turns at meter zero **7/19 = 36.8%** vs session 48's
    50.4%. Meter-out 3/5 vs 80.8%. n=5 — directional only.
- **§19:** 7 instrumented matcher turns. π n=7: min 0.130, median **0.138**,
  max **0.255**, 71.4% at or below 0.15, **0% above 0.5**. Replay reference
  (session 50/51) predicted median 0.135 / 70.5% — **well calibrated**. π₀ 0.137
  (the brief's 0.133 was pre-batch). Library 3 patterns, support 12/93.
- Suite 1060 → **1072** (+12: discoveredShipsClean 8, boons +2 pairs, net).

## Open questions for Claude
1. **§19's DROP needs a user decision and is the top item.** The rule fired as
   written on 7 turns. Options are: drop the matcher tier now; or gather more
   instrumented turns first — which is NOT free, because deciding to gather more
   *after seeing* a DROP is itself a renegotiation unless it is framed as a new
   pre-registered rule. Put the framing in the brief, not the arithmetic.
2. **§2 has 15 casts left and the user wants batches of 5 with a hard stop.**
   Ask for them explicitly; do not assume standing authorization.
3. **Rule 8 needs n>1.** The +22%-at-equal-depth result is one pair. Two or
   three more juiced runs would make it an argument rather than an anecdote, and
   9 run-units are available today.
4. **The orb rule is exploring new boon types and nobody predicted that.**
   `UNMODELLED_TYPES` shrank by two at once, a first, because choosing by orb
   payout reaches boons the ranked policy structurally avoids. Depth got worse;
   coverage got better. Worth deciding whether coverage is now a REASON for the
   rule rather than a side effect.
5. **Fix the §1 stop-check or stop specifying it.** See What's broken #3.
6. **The `LICENSE` says `Copyright (c) 2026 Bean`,** taken from `git config
   user.name`. The user should confirm the name. No email in it, deliberately.
7. **Distribution steps 3–6 remain the user's.** An agent must not create or
   push the repo.
8. `boonCapture` stays OFF — still zero ordinary runs since the directive.

## Files changed
```
 1 code commit (743389b) + this recap. 109 files, +54,279 / −40.
 94 are new redacted fixtures (69 dungeon states, 25 fishing).

     handoff/scratch-session-60.md        | 260  (new — full session notes)
     config/discovered.json               | 198  (SPLIT, now tracked)
     tests/discoveredShipsClean.test.ts   | 139  (new — the split's pin)
     src/sim/boons.ts                     |  57  (2 latent models, 4 offers)
     tests/fishing/matcherVerdict.test.ts |  35  (rewritten, not renumbered)
     src/profile.ts                       |  25  (romsPath)
     tests/boons.test.ts                  |  22  (recounts, 2 types demoted)
     README.md / LICENSE                  |  42  (ToS deleted; MIT added)
     zoneTemplate + fishingCorpus tests   |  27  (89→94 recounts)
     .gitignore                           |   7  (discovered.json un-ignored)
     data/roms.json                       |  —   (new, GITIGNORED — the ids)
```

---

# VERBOSE — full session notes (from handoff/scratch-session-60.md)

## §1 live juiced run — run 24943210, fixture run-2026-08-20-18-19-07

Started 11:19 PT, after confirming both ledgers unspent (dungeon
`dayProgressEntities` null, fishing 0/20). Doctor clean, dry-run clean.

### SURPRISE 1 — the human-readable log prints NO tier_choice / boon_choice lines
The brief's stop-check ("check the first `tier_choice` before letting it
continue") is not performable from `logs/run-60-1.log`. Those events exist only
in the structured JSONL (`logs/run-*.jsonl`, 4 `tier_choice`, 4 `boon_choice`).
The run also completed in ~2 minutes, faster than a human-in-the-loop check.
=> If the stop-check is meant to be real, either liveRun must print the room-1
decision to stdout, or the check has to be a pre-registered assertion inside the
loop that halts the run itself. As it stands it is a post-hoc audit.

### SURPRISE 2 — §23 RESOLVED, and it is −60
`start_run_energy_probe`: before 345, after 285, tightDelta **−60**,
matchesCommitted **true**. Run-end `energy_accounting`: before 345, after 286,
observedDelta **59**.
=> The 3x multiplier does NOT miscount. The charge at `start_run` is exactly 60.
Something INSIDE the run credits 1 energy back. Six-session question closed;
the remaining (much smaller) question is what the +1 is.

### Rule 8 tier flip — 4/4 correct, first live exercise
| room | offered tiers | topTierOffered | taken | notes |
|---|---|---|---|---|
| 2 | 0 Safe, 2 Dangerous(**Perpetual Sharpened**), 2 Dangerous(Miasmagem) | 2 | idx2 tier 2 | `perpetualAvoided:true`, `perpetualCostATier:false` |
| 3 | 2 Dangerous(Overgrown), 0 Safe, 2 Dangerous(Miasmaguard) | 2 | idx0 tier 2 | |
| 4 | 0 Safe, 1 Risky(Bloodthirsty), 1 Risky(Bladebreaker) | 1 | idx1 tier 1 | |
| 5 | 1 Risky(Cursing), 1 Risky(Regenerating), 0 Safe | 1 | idx0 tier 1 | |

- Highest non-Perpetual tier taken on **4 of 4**.
- Perpetual offered on **1 of 4 (25%)**; brief predicted ~35%; n=4, consistent.
- `perpetualCostATier` **false** — the filter cost nothing this run.
- `final-room` / `final-room-unreadable`: **neither appeared.** Correct — died
  at room 5, nowhere near maxRoom 16. No bug.
- Room 1 has no `enemyPathOptions`, so 4 tier choices for a 5-room run is right.

### Wide orb rule — fired on 3 of 4, `narrowed:true` every time
| room | rule | taken | orbs taken | orbs offered |
|---|---|---|---|---|
| 2 | orbFallback (wide) | WeakeningTenacity | 20 | 14,14,20 |
| 3 | **priority rank 4 Sword family** | AddBurnSword | 20 | 23,20,20 |
| 4 | orbFallback (wide) | BurningBlock | 24 | 22,21,24 |
| 5 | orbFallback (wide) | AddLuck | 24 | 21,24,16 |

- `orbFallback` fired **3/4 = 75%** (corpus expectation 56.5%; n=4).
- `narrowed: true` on all three.
- Fallback took the **max** orb offer all three times (20 of 14/14/20; 24 of
  22/21/24; 24 of 21/24/16). Rule behaving exactly as specified.
- **Room 3 is the important one**: a priority family (Sword) was on offer and
  the orb rule did NOT override it — took AddBurnSword at 20 orbs over
  AddIntuition at **23**. "Never overrides a priority family" verified live.
- Run orb sum: **88** (20+20+24+24).

### Outcome
- Died **room 5**, own HP 5/40 → 0. Score **4224**, loot **141**, energy 60,
  3 run-units (dungeon ledger 0 → 3 of 12).
- **First-attempt action failures: 0 of 31 (0.0%).** No 429s, no invalid tokens.
- Potions: all 3 used, at own HP 19/40, 19/40, 9/40 — all ≤50%, threshold correct.

### The n=1 datapoint the brief wanted, stated honestly
Prior juiced (all lowest-tier) depths: 7,6,6,5,8,7,4,10 — mean 6.6. This run: 5.
Shallower, as the brief predicted, and n=1 says nothing.
**But there is one clean same-depth pair:** run 24893156 also died at room 5,
also juiced, lowest-tier — score **3456**, loot 141. This run at the same depth
and same loot scored **4224 (+22%)**. Loot is depth-determined (identical 141);
score is not. That is the first direct evidence for rule 8's premise, and it is
n=1 per arm — suggestive, not established.

---

## §2 fishing — BATCH 1 of 4 (casts 90–94 of the corpus)

**1 catch of 5 (20%)** — Finley, cast 1, caught after 3 turns. Casts 2–5 escaped
(3, 2, 5, 6 turns). Corpus 89 → 94, catches 13 → 14.

### SURPRISE 3 — CORRECTED: the brief's "1.667 mean" was right, and I was wrong
**My first read called it reconstructed. It is not.** I matched it against
session 48's 1.62 (the `focusBudget.ts` header's 73-trajectory decomposition)
and concluded 1.667 = 5/3 was too neat to be real. Running
`matcherWeightReport.ts` settled it: opening focus spend over the last 20 casts
is **mean 1.400**, and this batch's 5 casts contributed 3 points total, so the
15 casts before it average (28 − 3)/15 = **1.667 exactly**. The brief's number
was the running opening-spend mean immediately before this batch — a real
measured quantity, just a different one from session 48's.

**The lesson is the mirror image of rule 9 and worth writing down as such.**
Rule 9 says a brief's claim is a hypothesis to check against the corpus. It does
not say a claim that fails to match the first number you find is therefore
wrong. I found a *nearby* figure measuring a *different* window and treated the
mismatch as proof. The correct move was to compute the brief's quantity — one
command — before calling it invented.

Both baselines are real and they answer different questions:
- **1.62** — session 48, 73 trajectories, the pre-`focusBudget` policy.
- **1.667** — the 15 live casts immediately before this batch.
- **1.400** — the last 20 casts, including this one.
- **0.6** — this batch's 5 casts alone.

Against every one of them the spend policy is moving the right way.

### And against those baselines the spend policy is working
`focusMeter` is in the state fixtures, so this is read, not derived.
Meter trajectories (value BEFORE each turn):

| cast | outcome | turns | meter trajectory | 1st-move spend | total spent |
|---|---|---|---|---|---|
| 1 | **caught** | 3 | 3 1 1 0 0 | 2 | 3 |
| 2 | escaped | 3 | 3 3 2 1 | 0 | 2 |
| 3 | escaped | 2 | 3 3 3 | 0 | 0 |
| 4 | escaped | 5 | 3 2 0 0 0 0 | 1 | 3 |
| 5 | escaped | 6 | 3 3 0 0 0 0 0 | 0 | 3 |

- **First-move spend mean 0.6**, against 1.667 over the preceding 15 casts and
  1.62 for the pre-`focusBudget` policy. That is
  the exact quantity `focusBudget.ts` was built to attack, and it is down ~63%.
- Turns played at meter zero: **7 of 19 = 36.8%**, against session 48's
  **50.4%**. (19 turns matches the 19 `decision` events exactly.)
- Meter-out casts: 3 of 5 = 60%, against session 48's 80.8%.
- n=5. Directionally strong, not established.

### Rates
| slice | caught/casts | rate | Wilson 95% |
|---|---|---|---|
| this batch | 1/5 | 20.0% | — (n=5 is uninformative) |
| post-fix era + batch | 7/24 | **29.2%** | [14.9%, 49.2%] |
| dead-era-excluded + batch | 14/54 | **25.9%** | [16.1%, 38.9%] |
| lifetime (incl. dead era) | 14/94 | 14.9% | — |

**Zero-streak: 4** (casts 2–5). Tripwire is 15. Not close.

### SURPRISE 4 — the §23 "+1 credited back" is NOT dungeon-specific
Cast 4's `energy_accounting`: committed 12, observed **11**, `drifted: true`.
The other four casts were exact (12/12). So a −1 drift appeared once in five
fishing casts AND once in the dungeon run, on the same day, on two different
run types. Whatever credits 1 energy back is a general mechanic, not something
inside a dungeon run. That reframes §23's residual: it is not "something in the
dungeon run credits 1 back", it is an account-wide event (most likely passive
regen ticking across the measurement window — 18/hr = 1 per 3.3 min, and both
drifts sat on the longest-elapsed measurement of their batch).

### Mechanical
- Zero errors, zero 429s, zero unknown enums, no guard trips.
- 10 `redraw_indicated_not_sent` — expected, not an error (redraw action
  unconfirmed, SPEC-fishing.md §7).
- Energy spent 60 guard-tracked (12/cast). Fishing ledger 5/20.
- Catch resolved a `cardsToAdd` offer (23, 48, 51) → chose 48.

---

## §19 — MEASURED, after nine sessions. Verdict: DROP.

`npx tsx scripts/matcherWeightReport.ts --last-casts=20`. This session's 5 casts
were the first ever played with session 51's instrumentation live, so the field
that has been missing for nine sessions now exists.

```
patterns:  3 — perimeterWalk(cw), perimeterWalk(ccw), bounce(2,0)
support:   12/93 clean casts explained exactly
prior pi0: 0.137 (Laplace +1/+2)

matcher turns with a REAL matcherWeight: 7
matcher turns predating the field:      20   (NOT counted — rule 10)

pi distribution, n=7:
  min 0.130  p25 0.133  median 0.138  p75 0.194  max 0.255
  at or below 0.15: 71.4%   above 0.5: 0.0%
REPLAY reference (session 50/51): median 0.135, 70.5% at or below 0.15

VERDICT: DROP — pi never exceeded 0.5 on any of 20 casts (max 0.255).
```

**Two things worth more than the verdict itself.**

1. **The replay was well calibrated.** It predicted median 0.135 / 70.5% below
   0.15; live came back 0.138 / 71.4%. The simulator was not lying about this
   even while it was blind to almost everything else (rule 8's accepted cost).
   That is a rare piece of evidence FOR the sim and should be remembered as one.
2. **pi0 is 0.137, not the brief's 0.133.** The brief quoted the pre-batch value;
   the 5 new casts moved it. Not an error in the brief — just stale by one batch.

The rule was pre-registered in session 51 and could not be renegotiated once the
numbers were visible, which is exactly why it was pre-registered. Applied as
written: **DROP the matcher tier.** Note the sample is 7 instrumented turns; the
rule does not have a minimum-n clause, and adding one now, after seeing the
result, would be the renegotiation it was designed to prevent. **Flagging it for
the user rather than acting on it** — dropping the tier is a strategy change, not
a test fix, and it is not in this session's scope.

## §3 — distribution, offline. All three items done.

### The split, and the part the brief did not know
`config/discovered.json` 13,115 → 7,215 bytes and is **off `.gitignore`**.

**The account-specific half was NOT confined to `knownRomIds` and `allRoms`.**
Four prose fields embedded the author's own token ids — `endpointConfidence`
("live 200/success this session (romId 2097)"), `amountFieldBehavior`,
`cooldown` (three ids), `session21ClaimResult` (four). A test checking only for
"a bare numeric id list and 20+-char hex", which is what the brief specified,
**would have passed on a file still naming five of the account's ROMs.**
`tests/discoveredShipsClean.test.ts` therefore has a sixth check the brief did
not ask for: no scalar anywhere in the file matches `/romId\s*\d/i`.

- Per-account half → `data/roms.json`, gitignored by the existing `data/` rule.
- `src/profile.ts` gains `romsPath`, per-profile like `dataRoot` and unlike
  `discoveredPath`.
- **Nothing in `src/`, `scripts/` or `tests/` ever read `allRoms` or
  `knownRomIds`** — verified by grep before touching anything. The live bank
  comes from `GET /roms/player` at run time. So this was a data-only move with
  no behavioural risk, which is why it was safe to do in one pass.
- The test was verified to FAIL when the ids are re-injected, not just to pass
  as-is.

### One stale claim corrected in passing
`roms._caveat` read "Do NOT automate claiming yet — the real per-claim energy
yield is not yet sized." The repo has automated it for some sessions
(`liveRun.ts`'s energy preflight), and the yield IS sized: `energyCollectable`
per ROM is honoured exactly — session 60's claim audit measured snapshot 315
against pool delta +315, drift 0. Shipping a file that tells a friend not to do
what the bot does on line one is worse than shipping no file, so it now states
the true position.

### LICENSE and README
- `LICENSE` — MIT, `Copyright (c) 2026 Bean`, taken from `git config user.name`.
  **The user should confirm the name.** No email in it, deliberately.
- README's ToS warning **deleted, not softened**, per DISTRIBUTION.md. Replaced
  with the accurate version: automation is sanctioned here and the team
  publishes agentic skills for autonomous accounts. Also added a `Licence`
  section and a `config/discovered.json` row to the file table.

## Test-suite consequences of the live play — 1060 → 1072, all green

Seven tests failed after the live work, **none from the offline changes**. All
were literal pins invalidated by new fixtures. Worth separating two classes:

**Mechanical recounts** (the corpus grew): `fishingCorpus` 89→94 casts,
492→517 docs, 392→411 turns, 13→14 caught, 75→79 escaped; `zoneTemplate`
89→94 traces, 88→93 clean, 388→407 turns, 13→14 caught.

**Not mechanical — the orb rule found new content:**
- `WeakeningTenacity` and `BurningBlock` got **first-ever pickup pairs**, both
  because the wide orb rule took the richest payout where no priority family
  was offered. The ranked policy had passed over both for 134 offers. Both
  modelled as `latent` (the pair's only diff is the boon entering
  `pickedBoons`; every other player field byte-identical) — name-based
  inference refused, per DECISIONS 2026-08-15.
- `UNMODELLED_TYPES` **shrank by two at once**, a first.
- This is a real, unpredicted payoff of rule 8 + the orb rule: choosing by orb
  payout explores boon types the ranked policy structurally avoids, so the
  corpus grows sideways rather than only deeper. Depth got worse; coverage got
  better. Nobody predicted the second half.

`tests/fishing/matcherVerdict.test.ts` was rewritten rather than renumbered —
its premise ("today's log is ENTIRELY pre-instrumentation") is now permanently
false. Its own comment said failing would be good news. Pinned on the RULE
(`distribution.max < 0.5`, `verdict === "DROP"`, `crossingCastIds` empty) with
inequalities rather than on `activeTurns === 7`, which would fire on the next
batch and teach whoever hit it to edit the number.
