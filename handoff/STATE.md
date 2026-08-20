# STATE — session 60 — 2026-08-20 (PT) — code at commit 47d7508

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
 1 code commit (47d7508) + this recap. 109 files, +54,279 / −40.
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
