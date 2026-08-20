# BRIEF — session 60

## The clock, and nothing else in this paragraph

**Caps roll at 11:00 PT.** This brief was written at 10:08 PT on 2026-08-20, 52
minutes before the rollover. **Do not begin this session before 11:00 PT.** If it
is already past, run `npx tsx scripts/checkFishingCaps.ts` and
`npx tsx scripts/checkDungeonToday.ts` as the first two actions and confirm both
ledgers read unspent. §2 has waited three sessions and §19 has waited nine, and
every one of those was lost to starting inside a spent day.

---

## 1. §2 — the first live juiced run. Do this before anything else.

Two policies are live in code with **zero live exercise**: session 57's rule-8
tier flip and session 58's wide orb rule. Every test is against a mock. This run
is the first contact for both, and it is the only data that will ever exist on
what winning a chosen hard fight pays — the bot took the lowest tier on every
unforced decision it ever made.

```
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1 > logs/run-60-1.log 2>&1
```

Rule 11 terms: 60-energy juiced, `--juiced-index=3`, 3x Big Heal Juice,
`--runs=1`, stop and hand back. Redirect and `tail`; never pipe a live run to a
truncating reader.

**Check the first `tier_choice` AND the first `boon_choice` before letting it
continue.**

- `tier_choice` must show the **highest** offered tier taken (minus any Perpetual
  filter). If it shows the lowest, or if `⚠ final-room-unreadable` appears at
  all, **stop the run.** Room 16 is unreachable — the deepest run ever is room 10
  — so any `final-room-unreadable` is a bug, and its failure mode is silent: the
  run completes looking exactly like the previous fifty while the flip never
  happened.
- `boon_choice` must show the orb rule reachable — `orbFallback` fires only where
  no priority family matched, which was 56.5% of corpus decisions.

**Report:** tier offered vs taken per room; how often Perpetual filtered the top
choice (~35% expected); whether `final-room` or `final-room-unreadable` appeared;
`orbFallback` fire count, `narrowed` true vs false, `orbsTaken` vs `orbsOffered`,
and the run's orb sum; loot, score, rooms, juice use and when.

**And §23 finally fires.** The tight energy probe has been armed and unfired
since session 54 for want of a run. Report whether the pair around `start_run`
reads **−59 or −60** — that single number splits "the 3x multiplier miscounts"
from "something inside the run credits 1 back", and closes a question open for
six sessions.

**If `PerpetualOnlyOfferError` halts the run:** it is not lost — resume with
`--resume-existing --potions=3 --potions-used=<n>`. Capture the full offer first;
zero of 134 corpus offers are entirely Perpetual, so it would be the corpus's
first sighting and worth more than the run.

**Expect to die shallower than room 10.** Every fight is now the hardest offered.
A short run is the cost side of rule 8, not a regression, and n=1 says nothing
either way in either direction.

## 2. Fishing — 5 casts at a time, and a corpus that no longer averages a dead era

**User directive, 2026-08-20. Five casts, then STOP and report.** Not a
checkpoint that continues on its own — a hard stop that hands back. Four batches
gets the day's 20 if the user keeps saying go.

### 2a. The dead era, measured — and it was worse than remembered

The 14.6% lifetime figure is an average across three different bots. Ordered by
`docId` (chronological), `handoff/reports/fishing-casts.md` splits cleanly:

| era | casts | caught | rate | 95% CI |
|---|---|---|---|---|
| pre (idx 0–29) | 30 | 7 | **23.3%** | [11.8%, 40.9%] |
| **DEAD (idx 30–69)** | **40** | **0** | **0.0%** | [0%, 8.8%] |
| post (idx 70–88) | 19 | 6 | **31.6%** | [15.4%, 54.0%] |
| lifetime | 89 | 13 | 14.6% | [8.7%, 23.4%] |

**The dead run was 40 casts, not the 17–18 remembered** — more than twice as
long, which strengthens the case for excluding it rather than weakening it.

And it is not a slump. Under the pre-era's own 23.3%, P(0 catches in 40) =
**2.4 × 10⁻⁵**; under the post-era's 31.6%, **2.6 × 10⁻⁷**. The same policy did
not produce both. That is independent confirmation of the focus-burn diagnosis:
something genuinely broke, it is identifiable in the data without knowing the
cause, and excluding it is warranted rather than convenient.

**Excluding the dead era the bot sits at 26.5% (13/49), or 31.6% on the post-fix
casts alone.** Roughly double the headline number, and it makes the 60% target
about a 2x gap rather than 4x.

### 2b. Exclude it from OUTCOMES — not from the movement model

This is the distinction to get right, and it decides how much data survives.

The focus-burn bug was in **our spending policy**. The fish moved however fish
move; our observations of that movement are unaffected. So:

- **Catch rate, per-cast outcome metrics, oil comparisons** — exclude the 40.
  They measure a policy that no longer exists.
- **The ring model, step classes, mined patterns, the matcher prior** — the dead
  casts still carry valid movement transitions and should be **kept**, unless
  someone shows the bug changed what was *observed* rather than what was *done*.

Throwing all 40 out of the movement corpus would drop it from 88 clean casts to
49 and force a re-derivation of every fitted parameter — per-class shrinkage
`{1: 0.1, 2: 8}`, the de-aliased 3-pattern library, π₀ = 0.133 — all of which
were swept on the full corpus. **Do not do that by accident as a side effect of
a catch-rate wipe.** If a re-derivation is wanted it is its own task with its own
gate.

Implement the split as a **flag on each cast record**, not a deletion. A deleted
cast cannot be reconsidered; an excluded one can.

### 2c. The gate structure — what 60% can and cannot mean at n=5

Target: **average above 60%**, then oils, then above 80%. The gate stays as
directed — oils do not come forward.

60% is a good choice at this batch size because it is exactly **3 of 5** —
n=5 can only ever read 0/20/40/60/80/100%, so 65% was not an observable value
and 60% is.

But a **single** batch is still noise, and this is the part to hold:

- At the post-fix 31.6%, a 5-cast batch returns **zero catches 15% of the time**.
- Even at a true 60%, zero-of-five happens **1% of the time**.

So **do not halt the programme on one bad batch, and do not declare success on
one good one.** The best 5-cast window in the entire corpus is 3/5 — exactly
"60%" — and it is the maximum over 85 overlapping windows, i.e. cherry-picked
noise. Judge 60% on the **running mean with a Wilson CI**, and note that reading
it to ±10pp takes ~93 casts (~19 batches, ~5 days at 20/day).

**The tripwire that IS meaningful at small n** is a zero-streak, and it is the
one thing that would have caught the dead era early:

> **Halt and report on 15 consecutive casts with zero catches.**

At 31.6% that is a 0.34% false alarm; at 60% it is effectively zero; at the old
broken 14.6% it fires ~9% of the time, which is the point. **The dead run went
40 casts before a human noticed. This fires at 15.**

Report per batch: catches/5, the running rate with its CI, current zero-streak
length, focus spend per cast against the 1.667 mean, and anything mechanical
(errors, guard trips, unknown enums).

### 2d. §19 rides along

`npx tsx scripts/matcherWeightReport.ts --last-casts=20` once the casts are done.
Session 51's rule is already code in `matcherVerdict.ts` and cannot be
renegotiated once numbers are visible. Library should be the 3-pattern de-aliased
one (π₀ = 0.133); record support counts at run time. Report the full π
distribution and opening focus spend, not just the 0.5 crossing.

If the user stops after fewer than 20 casts, run the report on whatever exists
and let `matcherVerdict` return `INSUFFICIENT_DATA` — that is a correct answer,
not a failed session.

---

## 3. Distribution — all three decisions are in

`handoff/DISTRIBUTION.md` is updated. Summary:

- **Private repo, MIT `LICENSE`.** Friends added as collaborators.
- **`config/discovered.json` gets SPLIT, not un-ignored.** Its `roms` block holds
  `knownRomIds` and the 37-ROM enumeration — the author's own NFT token ids, the
  identifier class session 54 spent 2,726 files removing. Game-global half ships;
  the ROM enumeration moves to a gitignored per-profile file behind
  `src/profile.ts`. Pin the split with a test asserting the shipped file carries
  no id list and no 20+-char hex.
- **Delete the README's ToS warning.** My portability brief told you to write one.
  It was wrong: bots are explicitly allowed in this game and the team publishes
  agentic skills for autonomous accounts. Replace it with the true version —
  automation is sanctioned, and the bot only plays, with
  `tests/clientSurface.test.ts` as the proof.

Do this only after §1 and §2. **An agent must not create or push the distribution
repo** — that remains the user's action.

---

## 4. Corrections to me

- **My "`viem` is imported nowhere in `src/`" was true but incomplete, and the
  gap was the whole point.** `scripts/probe.ts` held a full working Path B: it
  read `~/.secrets/gigaverse-private-key.txt` and signed with
  `privateKeyToAccount`. I scoped a grep to `src/` and then made a *safety* claim
  — "nothing here signs anything" — on it. That claim is the entire trust story
  for sharing this repo, and it was the one place a partial search was least
  affordable. Session 59 found it. Rule 9's third payoff.
  - **Follow-up for the user, not the agent:** if
    `~/.secrets/gigaverse-private-key.txt` still exists on the machine, it is a
    dangling key for a wallet model this account does not use. Worth deleting.
- **My README ToS warning invented a risk that does not exist** — see §3. Rule 1
  applied to the brief's author: I assumed a generic fact about game bots instead
  of checking this game's stance.
- **My "greps `src/` and `scripts/` and fails on a hit" was unimplementable as
  written** — it fails on ~60 sites, most in analysis scripts with no portability
  value. Session 59's scoped-plus-ratchet version is the right shape and the
  25 unconverted scripts are honest debt, not a gap.

---

## Your task (session 60)

1. **Do not start before 11:00 PT.** Confirm both ledgers unspent.
2. **§1** — one juiced run, with the two first-decision checks before it
   continues, the full two-policy report, and §23's probe result.
3. **§2** — fishing in 5-cast batches, stopping after each; the 15-cast zero-streak tripwire; the dead-era exclusion flagged not deleted; matcher report on whatever casts happen.
4. **§3** — the `discovered.json` split, the MIT `LICENSE`, the README
   correction. Offline, after the live work.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes a real data path; secret scan before handoff.

**Honest expectation.** This is the first session in four with live work actually
available, and the two live items are worth more than everything offline behind
them. §1's most likely failure is not a crash — it is `final-room-unreadable`
firing silently and the run coming back looking ordinary, which is why the room-1
check is a stop condition rather than a note. §19 is twenty casts and one command
and has cost nine sessions; it should take twenty minutes. If the session runs
out of room, §3 waits — it has no deadline and the caps do.
