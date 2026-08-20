# BRIEF — session 57 (the rule-8 flip lands; orbs become a tie-break)

## PRECONDITION — read this before anything else

**§19 needs a session that BEGINS after 11:00 PT on a day whose 20 casts are
unspent.** At the time of writing it is **23:04 PT on 2026-08-19** and the
rollover is **11:00 PT on 2026-08-20, 11.9 hours out**. A session started before
then is blocked for a **seventh** time — session 56 began at 22:31 PT, after a
rollover but inside the day session 55 had already exhausted, which is the exact
shape of this trap.

Run `npx tsx scripts/checkFishingCaps.ts` as the first action, free, one GET. If
it says the caps are spent, **do not plan around fishing at all** — the rest of
this brief is offline plus one optional dungeon run and stands on its own. If it
says unspent: 20 casts, then
`npx tsx scripts/matcherWeightReport.ts --last-casts=20`. That is the whole of
§19 now, and it takes minutes.

---

## 0. Corrections to me — four, and one of them would have corrupted the model

- **My §3 said to APPLY `rolledEnemyStats` and a known `enemyBuff`. That
  double-counts.** A stat buff is already inside the wire's
  `startingATK`/`startingDEF`/`health.starting`/`shield.starting`, verified
  30/30 against clean baselines. Had session 56 implemented the instruction as
  written, every buffed enemy in the model would have carried its buff twice and
  the error would have been invisible until some later session wondered why
  simulated enemies hit harder than real ones. It was caught by checking the
  claim against the corpus instead of implementing it — rule 9 working exactly
  as intended.
- **"At least one buff is legible" understated it by 45.** All 46 carry
  structured `effects[]`.
- **My fail-closed line was drawn on the wrong key.** I said fail closed on an
  unknown buff *id*; session 56 correctly keyed it on the effect **KIND** —
  46 ids against 12 kinds, and the game adds ids far faster than mechanics.
  Keying on id would have failed closed on every new id that was mechanically
  familiar, which is a rule that trips constantly and gets disabled.
- **I predicted the priority list would subsume `boonCapture`. The overlap is
  1 of 5**, and 7 of the 9 capture-room offers where it fires take a target no
  priority family reaches. I recommended retiring a module on a guess about
  overlap I had not computed.

---

## 1. The rule-8 flip

**CLAUDE.md rule 8 is already rewritten — read it before writing code.** It now
reads "take the HIGHEST tier offered, except the final room, and never a
Perpetual," with the reversal's evidence, its accepted cost, and a note that
the original rule was not wrong but orthogonal. Rule 11's second bullet was also
edited, because it referenced `pickLowestTier()` by name and would otherwise
have contradicted rule 8 from inside the same file.

Implement it in `src/strategy/enemyTier.ts`, which stays the only call site that
may choose a tier:

- **Highest tier among non-Perpetual options.** Not "highest tier, then check
  Perpetual" — that ordering produces a fallback question every time the top
  tier is perpetual. Filter first, then take the max.
- **The Perpetual clause is now load-bearing.** Session 56 measured it at 4 of
  134 offers under the old rule and **47 of 134 (35%)** putting a perpetual on
  the top tier. A directive that fired twice a month now fires on a third of all
  decisions. Test it at that weight.
- **Fail closed on an all-Perpetual offer.** Zero of 134 corpus offers are
  entirely perpetual, so this should never fire — which is exactly why it needs
  to halt loudly rather than silently pick one. A branch that has never executed
  and quietly does the wrong thing is the worst available outcome.
- **Wire up `pickTierForRoom`/`pickFinalRoomTier`.** Session 56 built them keyed
  on the server's per-dungeon `maxRoom` (Forbidden Woods 16) and they have been
  inert under rule 8. They go live here. **Verify the `maxRoom` read against a
  live state response** before trusting it — it has never governed a real
  decision, and the corpus has never reached room 16, so this path has zero live
  exercise. Prefer no-modifiers if the field is missing or unreadable: the
  failure directions are asymmetric, and taking hardest at the real final room
  costs the boss fight.
- **Rename or re-document `pickLowestTier`.** It is referenced by name across
  SPEC.md, DECISIONS.md and several test files. Leaving a function called
  `pickLowestTier` as the thing that picks the highest tier is how a future
  session misreads the code in thirty seconds.

**Do not chase the coverage metrics afterward.** `deepestScorableRoom`, battle
coverage, and scored-exchange counts will fall and stay fallen — that is the
price of this rule, recorded in rule 8 itself. Mark Task 4.5's old gate retired
in TASKS.md with a pointer to rule 8, so the next reader can tell a deliberate
cost from a regression (rule 6's obligation, applied to a gate going obsolete
rather than being unreachable).

---

## 2. `gigusOrbAmount` as a tie-break — the free lever

User directive: **boon priority decides first; orbs break ties within the same
priority rank.** Never let orbs override a higher-priority boon.

This is the cheapest live gain available and it is independent of the flip. Hard
Core payout is carried per reward option and differs across the three options in
**136 of 138 offers** — `[23, 16, 21]` is a recorded example, a spread of 7. For
scale, §4's whole tier effect at room 3 was Δ+4.21 mean orbs. **The within-offer
choice may be a larger orb lever than the tier choice, and it costs nothing** —
no rolled stats, no sim cost, no risk. The bot has been blind to it for 56
sessions.

Implementation:

- `pickBoonWithPriority` gains the orb comparison **only among options that tie
  on priority rank**, and `rankBoons` remains the tie-break below that. Order:
  priority rank → orbs → `rankBoons`.
- **Report what the change is worth** across the 138 recorded offers: total orbs
  under the current policy vs orbs-as-tie-break. If the two barely differ,
  because priority rank rarely ties, say so plainly rather than shipping a
  no-op described as a gain. That is the number that decides whether §2 was
  worth the session.
- If the tie rate turns out to be low, **do not widen the rule to make it fire**.
  The user's directive is tie-break only. Report the tie rate and let them
  decide whether to loosen it.

---

## 3. `boonCapture` stays OFF

User decision. The directive already reaches 10 previously-unreachable types for
free (VulnerableBlock 16, TieVulnerable 12, AddWeakSword 8, AddVulnerableMagic 8,
BurnMastery 4, and five more) — types session 55 measured `rankBoons` reaching
**0 times in 540 decisions**. Let those pairs accumulate from ordinary play
first.

Keep the module and its arming gate exactly as they are. Do not retire it — my
last brief was wrong about the overlap and the remaining capture-only targets
(TieWeak 11, AddBurnShield 8, AddLifestealShield 5, Regen 4) are real. Re-ask
when the free coverage has landed.

---

## 4. What measures a strategy change now — say it out loud

This is the item with no code in it and it matters most for briefs 58 onward.

Post-flip the simulator scores ~nothing, and it was already scoring 5.8% and
unable to separate two boon policies at n=2000. **So offline gating of strategy
changes is largely over.** That should be stated in the recap rather than
discovered gradually over five sessions of gates that quietly stop meaning
anything.

The honest consequence: from here, a strategy change is justified by being a
**user directive** or by being **mechanically obviously correct** (reading a
field the bot was ignoring, fixing a double-count), and it is validated by
**live outcome over many runs** — at rule 11's four juiced runs per day, that is
weeks, not sessions. Anything claiming to be gated offline needs to say what
arm actually separated, at what n, or admit it did not.

What survives as real measurement: the fishing replay (untouched by any of
this — 88 clean traces, paired, bootstrapped, and it still separates arms), the
opponent model, and live per-run reporting. **Fishing is now the only place in
this project where an offline gate means anything**, which is a further reason
§19 has been worth six sessions of waiting.

---

## Your task (session 57)

1. **Precondition** — `checkFishingCaps.ts` first. If unspent, §19 immediately:
   20 casts and the report. It is minutes and it has waited six sessions.
2. **§1** — the flip in `enemyTier.ts`; filter Perpetual then take the max; fail
   closed on all-Perpetual; `maxRoom` verified live before it governs anything;
   rename `pickLowestTier`; Task 4.5's gate marked retired.
3. **§2** — orbs as a within-rank tie-break, with the "what it's worth across 138
   offers" number reported, including if that number is ~0.
4. **§4** — the measurement note in the recap.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes a real data path; secret scan before handoff.

**Dungeon runs:** none authorised. Rule 11 needs a per-run go-ahead and none has
been given. If the user gives one, the flip's first live exercise is that run,
and it should be reported carefully — tier offered vs taken in every room, how
often Perpetual filtered the top choice, and the orb totals — because it is the
first data that exists on what winning a hard fight actually yields. The corpus
has none: the bot took the lowest tier on every unforced decision it ever made.

**Honest expectation.** §1 is a small change with a large blast radius and its
risk is naming, not logic — a function called `pickLowestTier` that picks the
highest is a trap for the next reader, and the `maxRoom` path has never once
executed against a live response. §2 is the one that might quietly be worth
nothing; the tie rate decides it and should be reported before anyone calls it
a win. §4 is not optional even though nothing depends on it — a project that
keeps writing gates after its instrument went blind will keep passing them.
