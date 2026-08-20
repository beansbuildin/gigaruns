# STATE — session 55 — 2026-08-19 (PT) — code at commit 39b8ef7

> The four code commits end at **39b8ef7**; this recap sits on top of it, so
> `git log` HEAD is one commit later. All verification below was run AT
> 39b8ef7, which touches no source. (Session 54 had to patch this header after
> the fact — stating the code SHA rather than a SHA that cannot exist yet
> avoids the same correction.)

## Status
Session-55 brief: **all four items (§1–§4) delivered.** No gate was set this
session; every item was offline by construction and none required live play.

**Zero energy spent. Zero casts. Zero dungeon runs.** The brief declared the
session offline in advance and that was verified live, not assumed, as the
first action. Its one bounded exception (start the §19 batch if the session is
still running after 11:00 PT 2026-08-20) **did not trigger** — the session ran
20:52–21:15 PT, ~14 hours short of the reset.

**The single most important finding is §2's, and it is a near-miss:** the
report the brief asked for, built naively, would have answered §19 **KEEP,
confidently, off a constant.** See "What's broken" #1.

Next: §19 still needs a batch. Unchanged precondition — a session that
**begins** after 11:00 PT on a day the caps are unspent. The live half is now
one command.

## What works
- **§1 `scripts/checkFishingCaps.ts`** — read-only, zero energy, one GET.
  Prints the GAME's ledger (`GET /fishing/state` → `dayDocs`) and this repo's
  guard ledger side by side, flags disagreement, and reports hours to the 11:00
  PT rollover. Verified live: **both ledgers agree, 20/20 casts**; dungeon side
  agrees too (server `Dungeon#5` = 12, guard = 12).
- **§2 `scripts/matcherWeightReport.ts` + `src/strategy/fishing/matcherVerdict.ts`**
  — §19's whole offline half. Session 51's decision rule is CODE (it cannot be
  renegotiated once numbers are visible), the loaded library's support is
  recomputed at run time, and the full π distribution and opening focus spend
  are reported, not just the 0.5 crossing. Runs end to end on the real corpus.
- **§3 `src/strategy/boonCapture.ts`** — pure. Room 1 only, five ranked
  targets, one per run, and **a target retires itself once modelled** (not in
  the brief; without it a stale config pays run quality forever). Wired into
  `liveRun.ts` behind a **two-condition gate** (`config/bot.json`'s
  `forbiddenWoods.boonCapture.enabled` AND `--boon-capture`; the flag alone is
  a hard error). **Shipped OFF.** Logs `boon_capture_pair` only when both
  fixture halves exist; run summary reports the zero case too.
- **§4 `redactProse()` in `src/api/redact.ts`** — the three handoff documents
  are redacted. Rules keyed on the identifier's **LABEL**, not its shape, so
  git SHAs and contract addresses survive. `tests/api/redact.test.ts` asserts
  the three FILES are clean, not merely that the function can clean them.
- Suite **931/931** (was 886), `tsc --noEmit` clean, `git diff --check` clean,
  all at the final code commit 39b8ef7. No test writes a real data path.

## What's broken
1. **§19 is UNMEASURED for a fifth session — and the near-miss matters more
   than the block.** `matcherWeight` is a real field (written since session 51)
   but **0 of 129 `ringPrediction.jsonl` rows carry it**; every row predates the
   instrumentation. The hazard is not the absence, it is
   `matcherWeightOf()`, which back-fills an absent field with the fixed
   `1 - ringFloor = 0.9` that genuinely WAS in force pre-session-51 — correct
   for reading history, and here it reads as "π is high on every turn", which
   is **exactly the conclusion §19 exists to test.** CLAUDE.md rule 10 in its
   purest form. `matcherVerdict.ts` reads the raw field and treats absence as
   NOT MEASURED, never as 0.9; today it correctly returns `INSUFFICIENT_DATA`.
2. **The boon blind spot is CONFIRMED and self-sealing.** 36 of 36 unmodelled
   types fall to `loot.ts`'s `unknown` category (score 10, lowest of five);
   across 135 offers × 4 HP fractions = 540 decisions, `pickBoon` top-ranked an
   unmodelled type **0 times**, and **0 of 135** offers are entirely unmodelled.
   The override exists but is OFF and has never fired.
3. **§23's −1 energy drift is still unexplained.** The probe is armed and has
   still not fired — no run happened. Unchanged from session 54.
4. **The git HISTORY still holds the noob token and now also the three
   documents' identifiers.** Deliberate; see `fixtures/README.md`'s new
   history section. Not a defect, but it is the standing limit.
5. Carried, unchanged: Enemy Room 71 (room 9) captured UNCLEAN, unmodellable.

## Corrections to SPEC.md
- **None this session** — no live response contradicted SPEC.md. Two live shape
  surprises did contradict a reasonable assumption, and are recorded in
  `scripts/checkFishingCaps.ts` rather than in SPEC (the field is not in SPEC):
  - **`dayDocs` is NOT keyed like the dungeon side.** Shape is
    `[{pondId, doc:{UINT256_CID, docId, …}}]` — `pondId` is an explicit sibling
    field. `docId` reads `DayCount#<addr>#player-day-data-pond-2`, so the
    dungeon's `DayCount#<addr>#Dungeon#<id>` convention does not carry over.
  - **The response also carries a SINGULAR `dayDoc`, and it is POND 1's.** It
    read `0` while pond 2 sat at 20/20. Any reader reaching for `state.dayDoc`
    gets a confident wrong answer about Dendren.
- Corrections to the BRIEF (not the spec) are listed under "Open questions".
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture this session.

## Dead ends
- **Do not read `matcherWeight` through `matcherWeightOf()` for §19.** It is the
  right reader for history and the wrong one for this question — see above. Any
  §19 analysis must read the raw field and count absence as unmeasured.
- **Do not expect `redactNoobToken`'s rules to touch prose.** Every rule is
  keyed on a JSON field shape; the three handoff documents matched none of
  them, and a rule silently matching nothing looks exactly like success. That
  is why the effort stayed scoped to `fixtures/` for fifty-odd sessions.
- **Do not redact prose by shape alone.** A bare `0x` + hex rule eats contract
  addresses and, in these very files, the git SHAs quoted in every STATE header
  (`commit ff36aa1`, `git diff 2f78c74..ff36aa1`). Losing a SHA out of a
  session log destroys the one thing that makes the log checkable. Every
  `redactProse` rule requires the identifier's own label.
- **Do not test the boon override with a repeated identical state.** The first
  draft of the once-per-run test fed the same reward state twice; the stall
  guard ended the run before the second decision, so the test passed for the
  wrong reason (and leaked an unhandled rejection). Two DISTINCT offers.
- Standing, unchanged: do not write a real identifier into a test (54); do not
  re-run the numeric-token experiment (§21); do not gate a de-aliasing change
  without `--before-raw` (53); `npx tsx -e` cannot resolve this project's
  relative imports; do not rebuild the expected-coverage focus objective (50);
  do not tune focus spend quantity again (48–50); replay for DIFFERENCES never
  absolutes (48); never pipe a live run to a truncating reader (52).

## Metrics
- **Live dungeon: 0 runs. Live fishing: 0 casts. Energy spent: 0.**
- **Cap ledgers, verified live 20:55 PT and agreeing:** game
  `dayDocs[pondId 2] = 20` of 20; repo guard 20 casts / 240 energy, dated
  `2026-08-19`. Dungeon: server `Dungeon#5` = 12, guard 12 runs / 240 energy.
- **Boon blind spot: 540 decisions swept (135 offers × 4 HP fractions), 0
  unmodelled top-ranked. 36/36 unmodelled types categorise `unknown`. 0/135
  offers entirely unmodelled.**
- **Boon capture firing rate: 9 of 49 room-1 offers (18.4%) hold a target; 8 of
  43 corpus runs had one.** → ~27 runs to model five boons, ~7 days at rule
  11's 4 juiced runs/day. (The brief said five runs — optimistic by ~5x.)
  Rooms 1–3 raise the rate only to 23.6% while tripling exposure.
- **Matcher library at run time: 3 patterns (perimeterWalk cw/ccw,
  bounce(2,0)), support 11 of 88 CLEAN casts, π₀ = 0.133.** (88, not 89 — 89 is
  the trace count; `supportingCastCount`'s denominator is clean casts.)
- **Opening focus spend, today's log: n=15, mean 1.667, 95% CI [1.137, 2.196]**
  — brackets session 50's 1.80 live figure, far above its 0.71 replayed one.
- Suite 886 → **931**. Corpus unchanged (dungeon 55 attempts, fishing 89
  traces) — nothing was captured this session.

## Open questions for Claude
1. **§19 needs a session that STARTS after 11:00 PT on an unspent day.**
   Unchanged and still the whole blocker. It is now cheap: run
   `npx tsx scripts/checkFishingCaps.ts` first (one GET), then 20 casts, then
   `npx tsx scripts/matcherWeightReport.ts --last-casts=20`. **Put the
   precondition in the brief's first paragraph.**
2. **Do you want `boonCapture` ARMED on the next dungeon run?** It is off and
   needs both the config flag and `--boon-capture`. Arming it costs run quality
   on ~18% of runs and buys one pickup pair when it fires. Rule 11 means the
   run needs the user's go-ahead anyway, so this rides along with that ask.
   **Say the expected cost honestly in the brief: ~27 runs for five boons, not
   five.**
3. **Three brief errors to not repeat.** (a) There is no `chooseBoon`; it is
   `pickBoon`/`rankBoons`. (b) `pickBoon` never reads `BOON_MODELS` — the blind
   spot is a score FLOOR, not an exclusion (right conclusion, wrong mechanism).
   (c) `matcherWeight` exists in code but on zero rows on disk.
4. **§23 stays open until the armed probe fires.** Unchanged — do not fix the
   −1 drift before the probe says whether the tight pair reads −59 or −60.
5. **Room 9 still needs a Safe capture** to become modellable. Leave it; rule 8
   means you cannot choose it.

## Files changed
```
 4 commits.  17 files, +1,685 / −21.  No fixtures written (zero live play).

     src/strategy/fishing/matcherVerdict.ts | 248  (§2, new — the rule as code)
     scripts/matcherWeightReport.ts         | 215  (§2, new)
     tests/fishing/matcherVerdict.test.ts   | 196  (§2, new)
     tests/boonCapture.test.ts              | 167  (§3, new)
     src/strategy/boonCapture.ts            | 165  (§3, new)
     tests/liveRun.test.ts                  | 165  (§3)
     scripts/liveRun.ts                     | 157  (§3 wiring, gate, summary)
     scripts/checkFishingCaps.ts            | 136  (§1, new)
     tests/api/redact.test.ts               |  72  (§4)
     src/api/redact.ts                      |  57  (§4 redactProse)
     QUESTIONS.md                           |  43  (§19 rewritten)
     fixtures/README.md                     |  41  (§4 decision + history §)
     src/orchestrator/config.ts             |  22  (§3 schema)
     config/bot.json                        |  14  (§3 block, disabled)
     handoff/{log/session-02,log/session-07,scratch-session-02}.md
                                            |   8  (§4, 4 lines redacted)
```
