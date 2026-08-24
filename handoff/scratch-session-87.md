# scratch — session 87 — surprises as they land

## S1 [pre-batch, §2a] The brief's §19 premise is STALE — the report already returns KEEP
Run BEFORE the first cast, whole file (`npx tsx scripts/matcherWeightReport.ts`):
  - 350 rows on disk, **95 instrumented matcher turns** (N=32 required) + 29 pre-instrumentation
  - pi: n=95 min 0.129 p25 0.137 median 0.142 p75 0.241 max 0.880; <=0.15 63.2%; >0.5 6.3%
  - base hit rate 30.0% over 350 turns; 5 casts crossed 0.5, 4 beat base
  - **VERDICT: KEEP, verdictIsPowered TRUE**
  - opening focus n=74 mean 1.000 CI [0.793, 1.207] (ref: 0.71 replayed / 1.8 live matcher-off)
The brief says "§19 is now one command behind the batch" and that everything but
the casts was built in session 55. True — but the turns had ALREADY accrued in
sessions 60-85's casts. §19 was one command behind SOMEONE RUNNING IT, not behind
this session's 20 casts.

## S2 [pre-batch, §2a] The brief's library-support numbers are stale (rule 9)
Brief: "3 de-aliased patterns (perimeterWalk cw 4, ccw 4, bounce(2,0) 3), 11 of 88
clean casts, pi_0 ~ 0.133."
Measured at batch time: **3 patterns (same three), support 22/147 clean casts,
prior pi0 = 0.154 (Laplace +1/+2).** Denominator is 147 clean casts, not 88.

## S3 [§2a / GATE 1] §19 verdict on the batch: KEEP, but ONE TURN short of powered
`matcherWeightReport.ts --last-casts=20` — 437 rows on disk, 87 in batch:
  - library at batch time: 3 patterns, support **23/167** clean casts, pi0 0.142
  - **31 instrumented matcher turns, 0 predating the field** (clean, no rule-10 issue)
  - pi n=31 min 0.141 p25 0.145 median 0.150 p75 0.242 max 0.735; <=0.15 48.4%; >0.5 19.4%
  - base hit rate 34.5% (87 turns); 2 casts crossed, BOTH beat base
  - **VERDICT: KEEP — verdictIsPowered FALSE (31 of minimum 32).**
  - opening focus n=20 mean 0.800 CI [0.435, 1.165]
⚠ ONE TURN SHORT. Not renegotiated, reported as returned. The whole-file run
(95 turns) returns KEEP *powered*, so both scopes agree on the direction.
Note pi>0.5 is 19.4% of turns here against 6.3% whole-file, and <=0.15 is 48.4%
against the replay reference's 70.5% — this batch's pi ran HIGHER than history.

## S4 [batch] Focus Oil stock is ZERO; Relaxing 36
Casts repeatedly logged `on-demand wanted the Mid Focus Oil — NONE HELD`. One
cast (13055941) flagged OIL-POLICY-DRY with 5 triggers / 0 spent, excluded from
both outcome arms. The standing add-2-vs-restore-to-2 capture COULD NOT have
fired this batch — nothing to consume. Not arranged, per the brief.

## S5 [§3 / run 1] BOTH probes fired. §23 IS ANSWERED.
Run 25035508, death @ room 8, 7008 Hard Core, juiced, 60 energy.
  - **§23 tight energy probe: 86 -> 26, tightDelta -60 against committed 60 — MATCHES.**
    Per §23's own pre-registered discriminator that is the SECOND branch: the
    charge is exactly 60, the 3x multiplier is NOT the suspect, and something
    inside the run credits 1 back. Run-level accounting still shows the -1
    (86 -> 27, observed 59 vs committed 60), so the credit lands DURING the run.
    Leading candidate is now regen (18/hr, integer pool) — NOT asserted.
  - **EV support line PRINTED, first time ever** (built s78, unreachable s82,
    fixed s84): `0/49 decisions were fully modelled; 49 (100.0%) unsupported`.
    Expected under rule 8, which selects modified enemies.
  - Rule 13 ledger check: dayProgressEntities 0 -> **3**, exactly one juiced run.
    No discrepancy. 9 units / 3 runs remain today.
  - first-attempt failures 0/60 across every action class.
  - No base-6/8/10 crit observed (opportunistic capture, not chased).

## S6 ⚠ THE BATCH FALSIFIED A LOAD-BEARING CLAIM IN THE MEMO §28 IS ASKING ABOUT
70 assertions across 11 files now fail. MOST are corpus counts moving
(148->168 traces, 612->699 plays, 147->167 resolved) and are mechanical. THESE
ARE NOT:
  - **`neither = 0` is now `neither = 6`.** The memo §5 states, as a STRUCTURAL
    claim and not a statistical one, "in today's era there is not one play where
    both the held hand and the redrawn triple are dead". 20 casts produced six.
    `castEra.test.ts:189` pinned it as structural. **It is false now.**
  - **Dead hands today 15 -> 32**, so the memo's weakest joint (rescue 15/15,
    95% CI [79.6%,100%], n=15) has 17 more observations against it.
  - **`wasted` structurally zero at every threshold -> 3.** Downstream of the above.
  - **The "THIRTYFOLD drop" in budget-zero incidence is now ~6.5x.** Today's era
    goes 54 casts/202 plays/3 budgetZero -> 74/289/**20** (1.5% -> 6.9%).
  - **SPEC-fishing §4: "fishHp moves by exactly the played card's FISH_HP effect
    — three documented exceptions" is now SIX.** Three new exceptions.
  - **`REAL_DECK` no longer matches the account's rod** — grant table expected
    [1..10], corpus now yields [1,2,3,4,5,6,74,75,76,78]. The batch's catches
    resolved `cardsToAdd` offers and the deck grew (fullDeck 21 at cast 20).
  - **`WeakeningMastery` — a FIRST-EVER boon pair, captured free** in run
    25035508 (state-059 -> state-060). It has a pair and no model. This is the
    thing `boonCapture` was built to buy and it arrived without arming it.
GATE 0 IS WHAT MAKES THIS LEGIBLE. The memo's numbers are frozen at
CORPUS-2026-08-23A and did not move. Every figure above is a NEW row beside
them, never over them. **Do not "fix" these pins by rewriting the claims to
match the new data** — the count updates are mechanical, the claim reversals
are findings and belong to the user.
