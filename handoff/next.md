# BRIEF — session 55 (offline: no live play, and §19 reduced to something a session can't displace)

Session 54 delivered four of five items and reported the fifth as blocked
rather than working around it, which is the right call. It also caught three
separate errors in my brief — one of them the premise of the item that failed.
§0.

**This session spends no energy and makes no live play calls.** That is a
decision, not a constraint discovered at minute five. §1.

---

## 0. Corrections to me

- **My §2 premise was wrong, and it is the reason §19 failed for a fourth
  time.** I wrote "the cap resets 11:00 PT and the library is finally the right
  one… It is not blocked now." The reset is real; my assumption that the session
  would *begin after it* was not. Session 54 began ~2 hours after session 53,
  inside the same guard-day session 53 had already exhausted.
  **The general form is worth a rule, and it is rule 6's shape exactly:** a
  brief may not schedule live play without naming the cap ledger it assumes and
  the wall-clock window it requires, because *when a session starts is not
  something the session controls*. A task whose feasibility depends on the
  start time is a **precondition**, and preconditions belong at the top of the
  brief where they can be checked in one read — not inside item 2 where they
  get discovered after the setup work is done. §1 is what that looks like.
- **My §4 was stale.** The default claim order has been `"descending"` since
  session 52 (`opts.order ?? "descending"`); sessions 52 and 53 ran ascending
  by passing `--claim-order=ascending` explicitly, and I read those runs as the
  default. No code change was needed — the change was to stop passing the flag.
  The WARN half was real and shipped.
- **My potion invariant was phrased as a falsehood.** "No `potionPolicy`
  without `juicedStartRun`" is false of a legitimate path:
  `liveRun.ts --potions=N --resume-existing` deliberately builds one, because
  those consumables were committed server-side by whoever started the run.
  Session 54 correctly restated it as being about **auto-deriving from the
  config allowlist**, which is the thing that was actually unguarded.
- **My §5 expected a small leverage subset; it is 30 of 36.** I guessed
  "a handful" and reasoned from a made-up frequency ("offered once every forty
  runs"). TieWeak alone is 11 offers of 135. The recommendation that followed
  from the invented number was wrong, and §3 replaces it.

---

## 1. PRECONDITION — this session does not play

At the time of writing it is **20:32 PT on 2026-08-19**. The guard-day that
began at 11:00 PT today is **fully spent**: 20/20 casts, 240/240 energy, 12/12
run-units. It resets at **11:00 PT on 2026-08-20**, 14.5 hours out.

So session 55 is **offline by construction**. Not "offline unless energy allows"
— offline. Reads are fine (`getMe`, `getEnergy`, `getFishingState`,
`getDungeonToday`); **zero casts, zero runs, zero claims.**

**Check it anyway, first thing, and record both numbers.** Two independent
ledgers have to agree: the game's own `GET /fishing/state` → `dayDocs` →
`UINT256_CID` for pond 2, and this repo's guard state. Session 54 verified both;
do the same and put them in the recap. If they ever disagree, that is a finding
worth more than anything else in this brief.

**One bounded exception.** If this session is still running after 11:00 PT on
2026-08-20 *and* every item below is complete, you may start the §19 batch under
full 5-cast checkpoint discipline. If both conditions are not met, stop and hand
back — §19 has been displaced four times by work that felt more urgent at minute
five, and doing it hurriedly at the end of a session is the fifth version of the
same mistake. **Dungeon runs remain per-run-approval-only under rule 11** and no
approval exists for this session.

---

## 2. Make §19 unable to consume a session

This is the highest-value item here, and it is entirely offline.

§19 has been "needs a batch, not an argument" since session 51 and has lost four
sessions. The reason is not scheduling alone — it is that §19 has been treated
as *a session's project*, so it needs a session with room for a project.
Shrink it until it fits in the gap after the reset:

Build `scripts/matcherWeightReport.ts` **now**, against the existing corpus, so
the live half of §19 is twenty casts and one script invocation. It should:

- Read `matcherWeight` off `ringPrediction.jsonl` rows for a given batch.
- Emit the **full π distribution** — not just whether it crossed 0.5. The replay
  median was 0.135 with 70.5% of active turns below 0.15; whether live looks
  like that is itself the finding.
- Apply session 51's decision rule mechanically and print the verdict:
  *drop* if π never exceeds 0.5 on any cast; *keep* if π exceeds 0.5 on at least
  one cast **and** that cast's turns hit above the batch's own base rate.
- Report the batch's **opening focus spend** alongside. Session 50 measured
  0.71 replayed vs 1.80 live with the matcher off, so the tier is entangled
  with spending, not only prediction. A batch where π never moves should still
  say whether spending looked normal — that is the half the replay cannot see.
- Record the loaded library's support counts at run time (currently 3 patterns,
  11 distinct casts of 89, π₀ ≈ 0.133), so the verdict is pinned to what
  actually ran.

Validate it end-to-end against the existing 89-trace corpus so the only untested
thing on the day is the data. Write the decision rule into the script as code,
not as a comment — the point is that it cannot be renegotiated after seeing the
numbers.

---

## 3. Boon capture — room 1 only, top five, and check the blind spot first

User decision: yes, trade a room-1 boon pick for a capture, limited to the top
five and to room 1. **Rule 8 is not in play** — it governs `enemyPathOptions`
tier choice, not boon choice, and nothing about a boon pick touches the loot
table. Say so in the code comment so this is not "optimised away" later by
someone who reads a deliberate suboptimal pick as a bug.

**Check this before building anything, because it may change the whole item.**
I believe — and this is a hypothesis, per rule 9 — that `chooseBoon` cannot pick
an unmodelled boon, because an unmodelled type has no `BOON_MODELS` entry to
score. If that is right, the 36 unmodelled types are a **self-sealing blind
spot**: they stay unmodelled because they are never picked, and they are never
picked because they are unmodelled. "Stay opportunistic" would then not be a
strategy but a guarantee of never learning, and four sessions of
`deepestScorableRoom` being capped by unmodelled types would have a single
cause. Verify it against the code and the corpus, and report the answer either
way — if unmodelled boons *have* been picked historically, my model is wrong and
this item shrinks to a preference tweak.

Then build it:

- A `boonCapturePolicy` module, pure, taking the offer and the room and
  returning an override or null. **Room 1 only.** Target list, ranked by offer
  frequency: TieWeak (11 of 135), AddBurnShield (8), AddLifestealShield (5),
  Regen (4), VulnerableBlock (4) — all first offered in room 1.
- **Off by default**, behind an explicit config flag. It costs run quality; it
  should never be on by accident, and it should be visible in the run summary
  when it is on.
- The capture must record a genuine **pickup pair** — full state immediately
  before the pick and immediately after — so `val1`/`val2` → stat delta is
  derivable. A pick that does not produce a usable pair costs run quality and
  buys nothing, which is the worst outcome available here.
- One target per run maximum. Modelling five boons is five runs, and that is
  fine; taking two picks in one run compounds the quality cost for no extra
  information about either.

---

## 4. Redaction — the three handoff documents, and stop there

User decision: redact the three files, leave the git history alone.

`handoff/log/session-02.md`, `handoff/log/session-07.md` (which also carries the
username and a partial address), `handoff/scratch-session-02.md`. Route them
through `src/api/redact.ts`.

**One thing to watch:** `redact.ts`'s rules are shape-keyed against JSON field
shapes, and these three files are **prose**. A token appearing mid-sentence, or
an address written with different casing or truncation, may not match. Check the
output rather than trusting the exit code, and add a prose-mode pass or hand-edit
the misses. Session 54's own dead end applies — **do not write the real
identifiers into a test**; the rules are shape-keyed, so synthetic ids exercise
them identically.

Update `fixtures/README.md` to record the decision and its limit, plainly: the
working tree is redacted, **the git history from session 08 onward is not**, and
that is deliberate. Nothing here is a credential, and the repository owner is
already public, so history rewriting buys little against a force push that
breaks every clone and invalidates every commit SHA cited in past STATE.md
files. Someone will ask again in three sessions; the README is the answer.

---

## 5. §23 — nothing to do

The tight energy probe is armed on `LiveRunDeps.energyProbe` and fires on the
next real run, which is not this session. Do not fix the −1 drift before the
probe says whether the tight pair around `start_run` reads −59 or −60. The two
answers point at different code and the guard is enforcing off committed spend
either way, so nothing is at risk from waiting.

---

## Your task (session 55)

1. **§1** — verify both cap ledgers, record them, confirm offline scope. First
   thing, before any other work.
2. **§2** — `scripts/matcherWeightReport.ts`, validated against the 89-trace
   corpus, decision rule encoded as code.
3. **§3** — verify the `chooseBoon` blind-spot hypothesis and report it; then
   `boonCapturePolicy`, room 1, top five, off by default, pickup pair recorded,
   one target per run.
4. **§4** — redact the three handoff documents, verify the prose matches,
   update `fixtures/README.md`.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes to a real data path; secret scan before handoff.

**Honest expectation.** Nothing here changes what the bot does today. §2 and §3
are both about making a *later* session able to measure something it currently
cannot, and that is the right use of a session with no caps available — better
than inventing live work to fill it. The one item that could produce a real
finding is §3's blind-spot check, and it is a twenty-minute read of existing
code. If it comes back "yes, unmodelled boons can never be picked," say so
prominently: it would explain a coverage ceiling this project has been treating
as bad luck for several sessions.

**And the scheduling note for whoever writes brief 56:** §19 needs a session
that *starts* after 11:00 PT on a day whose 20 casts are unspent. That is a
precondition on the session, not a task within it. Put it in the first
paragraph.
