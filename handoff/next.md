# BRIEF — session 08

Task 2 passed live, the depth ablation settled cleanly, and the tier re-audit
corrected two sessions of wrong labels. One regression to fix first, then Task 6
— the first time this project sends a POST.

---

## 1. Privacy regression in `STATE.md` — fix the detector, not just the file

`STATE.md` in a **public** repo now contains:

```
address <ADDR>
username <USER> noobId <NOOB>
```

`DECISIONS.md` says *username tolerated in history; address and JWT never are*.
This breaks that rule, and the secret scan passed anyway because the pattern is
`0x[a-fA-F0-9]{40,}` — a truncated address doesn't match.

The leak itself is mild: the username was already in history and a Gigaverse
account is public on-chain regardless. **The detector gap is the real finding.**
A scan that only catches full-length addresses will keep passing on truncated
ones forever, and the next one might sit next to something that matters.

Do three things:

1. Widen the scan to `0x[a-fA-F0-9]{4,}` and add `noobId\s*\d+` — accept the
   false positives, they're cheap.
2. Replace the identifiers in `STATE.md` with `<USER>` / `<NOOB>` / `<ADDR>`.
   `check-auth` should print them to the terminal, never to a committed file.
3. Extend redaction to **prose in handoff files**, not just fixtures. Session
   05's fix covered `writeRedactedCorpus`; this path was never covered.

No history rewrite — same reasoning as session 04.

## 2. My tier premise was wrong, and that's now a standing rule

I told you to label existing `enemies.ts` rows as tier 2. You re-derived from the
corpus and found room 3 is tier 1 and room 4 is tier 0 and **clean**. That's the
second time you've correctly overridden a specific factual claim of mine by
checking the data.

Making it explicit, for `CLAUDE.md`:

> **A brief's claims about what the corpus contains are hypotheses to verify,
> not facts to implement.** Claude writes briefs without access to the fixtures.
> When a brief asserts something checkable, check it first; if it's wrong, the
> corpus wins and the correction goes in the recap.

The room-4 finding is the good kind of surprise: the Burn on that enemy was the
player's own `AddBurnSword` boon landing on a Sword win, not an enemy mechanic
at all. Room 4 is clean at Safe tier, which means the coverage ceiling was never
where three sessions of briefs assumed it was.

## 3. Depth 3 confirmed — good call running it at N=20000

`depth2 79.96 ± 0.55` vs `depth3 81.64 ± 0.54`, separated; 3v4 not. Adopting
depth 3 for live and keeping depth 2 for sim throughput is exactly right. This
is the payoff for re-testing something that had been rejected on a cost argument
that didn't apply in production.

---

## 4. Task 6 now — the first live run *is* the room-3 capture

You asked whether to spend ~20 energy on a Safe-tier room-3 capture first. No —
and the reason is that it isn't a separate thing anymore.

Task 6's first real run picks Safe at every screen (hard rule, guarded) and
plays deeper than a human did. **That run is the room-3 capture**, for the same
20 energy, while also validating the client, the schema, and the strategy engine
against reality. Spending a separate run first buys the same fixture and none of
the rest.

This is the moment the capture bottleneck dissolves. Design the run loop so
every live run writes fixtures in the `watch.ts` shape automatically — that's
what makes coverage compound instead of requiring a decision each time.

## 5. The first POST — staged, with a hard stop after one

`DungeonActionResponseSchema` has never seen a live response, and this is the
highest-risk moment in the project so far. Everything until now has been
read-only; a bug now costs energy and can corrupt a run mid-way.

Run it in four stages, committing between each:

**Stage 1 — dry run.** Full decision loop against live *read* state. Log every
intended action with its EV table. POST nothing. Verify the Safe-tier guard
fires on a real `enemyPathOptions[]`.

**Stage 2 — one POST, then halt.** Send exactly one action — `start_run` — then
**stop unconditionally**, whatever comes back. Dump the raw response. Correct
`DungeonActionResponseSchema` from it. Do not continue in the same process.

**Stage 3 — one full run.** Only after the schema is corrected and committed.
Halt on any zod failure, unknown enum, or three consecutive action failures.

**Stage 4 — five runs.** Only if stage 3 produced a clean run summary and
energy accounting matched expectation.

If any stage surprises you, stop there and recap. Reaching stage 2 with a
corrected schema is a good session; reaching stage 4 on a broken one is not.

**Before stage 2**, write `config/bot.json` with real numbers — you have them
now: energy cost 20, `maxRoom` 16, daily caps from `/game/dungeon/today`. Set a
conservative first-session budget of **60 energy** (three runs). `guards.ts`
enforces it. This is the file session 01 correctly declined to invent; it can be
written honestly now.

## 6. Loot phase — log everything, trust nothing

§4c ranking has never been validated at depth. For these runs, log every offer
triple and every pick with the state before and after, but treat the ranking's
output as provisional. If a pick looks wrong in hindsight, that's a finding, not
a bug to patch mid-session.

`Regen` is the one to watch: HP persistence is now confirmed across 6 informative
boundaries, so if `Regen` fires every room its cross-room value is large. If it's
offered, **take it** and capture the pickup pair — that answers session 06's
question for free.

## 7. `intuition` — still pending

I've asked the user again. Don't model it either way. If an answer arrives
mid-session it goes in `QUESTIONS.md`, not into code.

---

## Your task

1. Privacy fixes, per §1. First, before anything else.
2. `CLAUDE.md` rule from §2.
3. `config/bot.json` with real numbers + `guards.ts` enforcement, per §5.
4. Task 6, stages 1→4, stopping at the first surprise.
5. Live fixtures written in `watch.ts` shape automatically, per §4.

Report per stage reached, not per task attempted. State the energy spent against
budget, and whether `deepestScorableRoom` moved.

Addendum to §7 — intuition:

The user hasn't seen it fire; it's a 5% proc. Don't wait on them.

Two cheap checks instead:

1. Diff the corpus for rare fields. Enumerate every key path across
   all captured battle states and report any that appear in under
   ~15% of them. If intuition reveals the enemy's next move, it
   likely surfaces as an occasional extra field rather than a
   permanent one. ~92 exchanges at 5% should have produced a few
   fires if the stat was active in those runs.

2. If nothing turns up, add detection to the live loop: log the full
   raw state whenever an unexpected key appears. At machine speed
   this resolves within a session or two on its own.

Still don't model it either way.
