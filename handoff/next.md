# BRIEF — session 21

Priority shift, decided directly with the user: dungeon tuning is
deliberately parked with no live lever left to pull (Task 11, see
DECISIONS/TASKS history — a 10x utility-weight sweep found nothing, and the
lever that did work, potions, already shipped). Fishing is where the real
tuning headroom is, and ROM energy resolves the thing that was starving it.
This session's spine is fishing performance, funded by ROM claims.

---

## 1. Raise the fishing budget — sourced, not guessed

`config/bot.json`'s `dendren` block is 200 energy / 15 casts. Raise to
**240 energy / 20 casts**. This isn't a fresh guess: `config/discovered.json`
already recorded `maxCastsPerDayJuiced: 20` (vs. 10 non-juiced) from
probe-era data that was never wired into policy, and the user independently
confirmed this session that the real daily cast limit is 20 at 12 energy
each (240 total) — two independent sources landing on the same number.
Write the config comment citing both, matching house style (see the
existing `forbiddenWoods` block's sourcing comments for the pattern).

The real per-day ceiling was never actually the constraint here — the
account's own real energy floor was. That's what §2 is for.

## 2. ROM claiming: fund the raised budget

Lifetime so far: 3 successful claims (+~25 energy total), against ~3,252
currently claimable across 37 owned ROMs. Known IDs: 7959 (never
succeeded), 2097, 5345, 689. Overflow is confirmed non-wasting (user, this
session) — whatever doesn't fit under the 420 cap stays banked in the ROM,
so there's no batching logic to design. Claim opportunistically, biggest
`energyCollectable` first, whenever there's room under 420.

Still missing: full enumeration of all 37 ROMs (only 4 IDs known). Worth
one more ask to the user for the ROMULATOR panel's request URL if they can
grab it — that turns "claim the 4 ROMs we happen to know about" into "claim
the actual best ROM out of 37." Not blocking — claim what's known now to
start funding fishing casts, don't wait on full enumeration first.

## 3. Sim-only redraw threshold sweep — free, safe, and never actually done

SPEC.md §5 says explicitly: "Tune the threshold in the sim, not live." That
sweep has never been run — `shouldRedraw` currently uses whatever threshold
was set when the `evPerMana`-vs-raw-EV bug (SPEC.md, session 12ish) got
fixed, not a value chosen by sweeping. This is the direct fishing-side
analog of `potionTimingSweep.ts`: build `scripts/redrawThresholdSweep.ts`,
sweep threshold values against `castSim.ts` (N≥500, report the full curve
not just the winner, same discipline as the potion sweep — check the
optimum isn't sitting on the boundary of whatever range gets tested). Zero
energy cost, do this regardless of how ROM claiming and the budget raise go.

## 4. Spend real casts to grow the mined-pattern library

`mineFishPatterns.ts` has promoted exactly 1 of ~23 candidates
(`perimeterWalk(cw)`), already live-wired, already measured (sim: blind
6.6% → 16.2% catch rate with just that one promotion, N=500). This is the
highest-leverage lever fishing has and it compounds automatically with
volume — no further code needed, just more real casts feeding the miner.
With the raised budget and whatever ROM energy funds it, spend real casts
this session and re-run the miner against the grown log.

## 5. Lower priority, only if time remains

`chooseNewCard`'s argmax-hit-power/mana heuristic (picking among a catch's 3
new-card offers) is still an explicit placeholder — no deck-composition sim
exists to judge alternatives against it. Genuinely unexplored, but bigger
scope than the other four items here. Don't start this unless 1-4 are done
with session time left; if you do, scope it as its own design question
before writing code, same as the dungeon utility-form caveat from the last
brief.

---

## Your task

1. Raise `config/bot.json`'s fishing budget to 240/20 with a sourced
   comment.
2. Claim available energy from the 4 known ROMs (highest `energyCollectable`
   first); ask the user again for full enumeration if convenient, don't
   block on it.
3. Build and run `redrawThresholdSweep.ts` in sim; report the full curve.
4. Spend real fishing casts against the newly-funded budget; re-run
   `mineFishPatterns.ts` afterward and report what changed.
5. `chooseNewCard` heuristic only if 1-4 finish with time left, and only as
   a scoped design question first.
6. Task 10's 8h orchestrator run is still the one open item outside any
   session's control — keep it flagged in the recap, don't chase it here.
