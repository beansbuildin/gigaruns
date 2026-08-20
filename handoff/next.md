# BRIEF — session 56 (the user's strategy directives: boon priority now, tier reversal after the evidence)

Session 55 delivered all four items with zero energy and found the thing that
mattered most by refusing to build the naive version: `matcherWeightOf()`
back-fills an absent field with the pre-session-51 constant 0.9, so the §19
report built the obvious way would have answered **KEEP, confidently, off a
constant** — which is precisely the conclusion §19 exists to test. That is rule
10 in its purest form and it was caught before it produced a number.

This session implements a set of **user strategy directives**, given 2026-08-20.
They are the user's call about their own account and they are not up for
re-litigation on EV grounds. But two of them cannot be implemented as stated
without a decision the user has now made, and one of them touches CLAUDE.md
rule 8 — so the order matters. §1 explains what lands this session and what
does not.

---

## 0. Corrections to me

- **There is no `chooseBoon`.** It is `pickBoon`/`rankBoons`. I named a function
  that does not exist and session 55 had to find what I meant.
- **My blind-spot mechanism was wrong, the conclusion right.** `pickBoon` never
  reads `BOON_MODELS`; unmodelled types fall to `loot.ts`'s `unknown` category
  at score 10, lowest of five. It is a **score floor, not an exclusion.** That
  distinction matters for §2 — a floor can be overridden by a priority layer
  without touching the scorer, an exclusion could not.
- **My "five runs to model five boons" was optimistic by ~5x.** The real figure
  is ~27 runs, ~7 days at rule 11's four juiced runs/day: targets appear in 9 of
  49 room-1 offers (18.4%). I asserted a rate I had not computed. §2 is where
  that number stops mattering, and it is worth saying why rather than quietly
  benefiting from it.

---

## 1. What lands this session, and what does not

The user gave five directives. Four are boon-selection changes and land now. The
fifth reverses CLAUDE.md rule 8 and **does not land this session** — user
decision: mine the evidence first, flip in 57.

**Rule 8 remains in force for the whole of this session.** Do not add a
`pickHighestTier`, do not soften `enemyTier.ts`'s doc comment, do not mark rule 8
"under review" in CLAUDE.md. A hard rule with a "this is exactly the kind of
thing that gets optimised away later" warning attached should be either in force
or deliberately replaced — never left ajar. §4 is the evidence that decides it;
§4's output is what brief 57 will be written from.

---

## 2. The boon priority directives

**User's ordering — a single total order, clarified by the user 2026-08-20:**

1. **BurnMastery** (enemy burn triggers twice) — outranks everything, including
   MaxArmor. Take it whenever it appears.
2. **AddMaxArmor** — every time, unless BurnMastery is also on offer.
3. **AddMaxHealth.**
4. **Sword upgrades** — `UpgradeRock`, plus "anything on sword win".
5. **Vulnerable upgrades** — many combat ties, this converts them.
- **Lifesteal is overrated in early game** — demote. **Early game = rooms 1–8**,
  user-confirmed, not a placeholder.

This is now an unambiguous total order with one exception rule, so it should be
implemented as a literal ordered list, not as a set of competing heuristics. If
a future reader finds themselves weighing two of these against each other at
runtime, the implementation has drifted from the directive.

### 2a. The naming mapping, user-confirmed, and it resolves the whole list

**Rock = Sword, Paper = Shield, Scissor = Spell.** The rock/paper/scissor names
are the API action names; Sword/Shield/Spell are the human-facing names for the
same three moves.

This is the missing Rosetta stone for the boon corpus and I do not believe it is
written down anywhere in this repo after 55 sessions. **Pin it in SPEC.md as
user-confirmed**, because it silently resolves a naming split that runs through
the whole boon table: the *actions* are `rock`/`paper`/`scissor` while the *boon
type strings* use `Sword`/`Shield`/`Magic`. They are the same three things.
`AddBurnSword` is a Rock boon. `AddLifestealMagic` is a Scissor boon.
`CorrosiveShield` is a Paper boon.

So "anything on sword win" is a **family**, mechanically identifiable:
`UpgradeRock` plus every `*Sword` type — `AddBurnSword`, `AddWeakSword`,
`AddVulnerableSword`, `AddLifestealSword`, `CorrosiveSword`. Implement it as
the family, matched on the suffix, not as a hand-listed set — new `*Sword` types
will appear and should be covered automatically.

### 2b. This cannot be done by tuning the scorer

Session 55 established that unmodelled types sit at score 10 and were top-ranked
**0 times in 540 decisions**. Most of what the user is asking for is unmodelled:
BurnMastery, VulnerableBlock, VulnerableMastery, `AddVulnerable*`, `TieVulnerable`,
and four of the five `*Sword` types. Only `AddMaxArmor`, `AddMaxHealth`,
`UpgradeRock`, `AddBurnSword`, `VulnerableEvade` and `AddLifestealMagic` are
modelled at all.

Re-weighting inside `rankBoons` therefore cannot express this directive — the
scorer has no model to weight. Build a **priority layer above the scorer**:

```
pickBoonWithPriority(offer, room):
  match offer against the ordered priority list
  if any option matches -> take the highest-priority match
  else -> fall through to rankBoons() unchanged
```

Pure, in `src/strategy/`, no network. `rankBoons` is not modified; it becomes
the fallback. That keeps the sim's EV path intact for measurement while live
play follows the directive, which is what makes the next point possible.

### 2c. Every ambiguity in the directive is resolved

**All user-confirmed, 2026-08-20:**

- **BurnMastery outranks AddMaxArmor.** MaxArmor stays the default first pick;
  BurnMastery displaces it when both are on offer. This should be rare —
  BurnMastery appears twice in the whole of `boons.ts` against AddMaxArmor's
  nineteen — but it is now a rule, not a warning. Still log
  `boon_priority_burnmastery` when it fires, because a directive whose whole
  point is "take it if you ever see it" deserves a record of every time it was
  seen.
- **Early game = rooms 1–8**, user-confirmed. Keep it as a config knob for
  legibility, but it is a real number now, not a placeholder — do not describe
  it as provisional in the recap.

- **`AddLifestealSword`: the demotion wins in rooms 1–8**, user-confirmed. It is
  a `*Sword` type (priority 4) and a lifesteal type, and inside the early-game
  window the lifesteal rule is the more specific one and takes precedence.
  **From room 9 on it is an ordinary priority-4 sword boon**, because the
  demotion window has closed — that follows from the two rules as written and
  needs no extra case. Log `boon_priority_conflict` when it is offered so the
  edge has a record either way.

**No ambiguity remains in the directive.** Every case is now determined by the
ordered list plus two window rules (BurnMastery displaces MaxArmor; lifesteal
demoted in rooms 1–8). If the implementation needs a tie-break that is not one
of those, something has been misread — stop and ask rather than inventing one.

### 2d. This makes §3's boon capture nearly free — and that is the real win

Session 55 costed boon capture at ~27 runs for five pairs, because each capture
trades run quality. Under this directive the trade largely disappears: the user
now *wants* Vulnerable and Sword-family boons picked for play reasons, and
picking one produces the pickup pair as a by-product at no strategic cost.

Check the overlap explicitly and report it: how many of `boonCapture.ts`'s five
targets are subsumed by the priority list, and what the combined firing rate is
across the 49 recorded room-1 offers. If the overlap is high, **`boonCapture`
should be retired rather than left running as a second override** — two override
layers competing for the same pick is a bug waiting to happen, and session 55
already built the retire-once-modelled machinery that makes this clean.

### 2e. Gate it against the sim, and report the disagreement either way

Run the priority policy against `scripts/sim.ts` head-to-head with the current
`rankBoons` path and report the difference in the usual terms. **The directive
ships regardless of the result** — it is the user's account and their read of a
game the simulator models incompletely. But if the sim says the ordering costs
depth, that is worth knowing and worth saying plainly, and if it says the
ordering *helps*, that is a point of evidence for the user's judgement over the
scorer's. Do not tune the ordering to make the sim happy. Report and move on.

---

## 3. Model the enemy buffs — this is now load-bearing

User decision. Once rule 8 flips in session 57, **every** battle carries
`rolledEnemyStats` and `enemyBuff`, which is exactly what makes a capture
unscorable today. Room 9 is already unmodellable for this reason and it was one
forced Risky fight. After the flip it is every fight, and the sim goes blind
permanently unless the contamination becomes data.

Both fields are on the wire and at least one is legible: session 53 recorded
`bloodthirsty` as +4 ATK on all moves. So:

- Enumerate every distinct `enemyBuff.id` in the corpus with its observed
  effect and frequency, the same shape `boonCoverage.ts` produces for boons.
- Extend the enemy model to apply `rolledEnemyStats` and a known `enemyBuff`
  rather than marking the capture `unmodelled`.
- **Fail closed on an unknown buff id** — an unrecognised buff must mark the
  battle unscorable exactly as today, not silently apply nothing. A buff quietly
  treated as zero is worse than a battle honestly marked unscorable.
- Re-check whether room 9 becomes modellable once `bloodthirsty` is modelled.
  If it does, that is a concrete win and it closes a question carried since 53.

This is the item that decides whether the rule-8 flip costs the simulator. Do it
before the flip, not after.

---

## 4. Mine the reward tier — the evidence that decides rule 8

**This has been sitting in the fixtures since session 09 and nobody has looked.**

Session 09 recorded, live, on the first room-2 offer following a forced non-Safe
fight: all three reward options carried `tier`/`tierName: "Risky"` — fields never
seen on `rewardPathOptions[]` before — and noted "reward offers apparently
inherit the risk tier of the fight just won." It was logged, not modelled, not
acted on (DECISIONS 2026-08-15), and `wireBoonToOption` still reads only
`boonTypeString`/`selectedVal1`/`selectedVal2`. **That field has been discarded
on every offer for 46 sessions.**

That is direct corroboration of the user's mechanism, and it is why the flip is
worth taking seriously rather than treating as a preference. It is also why
rule 8's own evidence does not refute it: rule 8 measured `lootTable` identity
**in the offer**, 440/440. Reward-card quality and score payout are downstream of
winning the fight, and the offer's lootTable cannot show them. **The user's claim
is orthogonal to rule 8's evidence, not contradicted by it.** Say that clearly in
the recap — it is the reason a hard rule can be reversed without anyone having
been wrong.

**Build `scripts/rewardTierAudit.ts`:**

- Pull `tier`/`tierName` off every recorded `rewardPathOptions` entry in
  `fixtures/dungeon-runs/`, joined to the tier of the fight that preceded it.
- Test the inheritance claim first: does reward tier always equal the tier of
  the fight just won? Session 09 saw one instance. Report the rate, not the
  anecdote.
- Then the question that matters: **does a higher-tier reward offer contain
  better boons?** Compare by tier — modelled-vs-unmodelled mix, roll values on
  matched types (the corpus already has `UpgradeScissor` at both (4,0) and
  (0,4)), and how often the offer contains a priority-list target from §2.
- **Control for room, and say n out loud.** Deeper rooms offer fewer Safe tiers
  *and* plausibly better rewards independently, so an uncontrolled comparison
  will find an effect whether or not one exists. Session 53's runs forced
  non-Safe in 5 of 12 rooms and session 52's in 4 of 13, so there is genuine
  within-corpus variation — but it is small, and a null result here is "not
  enough data", not "the user is wrong."

**Whatever it finds, it does not veto the flip** — the user has played the game
and the reward-tier link is their direct observation. What it does is tell
brief 57 how big the effect is, which rooms it is strongest in, and whether the
score claim ("harder cores payout from the next enemy") shows up in the data at
all. Write the output so 57 can be written from it directly.

**Also record what the corpus cannot say.** The bot has taken the lowest tier in
every unforced decision it has ever made, so there is no data at all on what
*beating* a chosen-hard enemy yields. Rule 8 created its own evidence base. That
is not a criticism of rule 8 — it is the honest limit on §4's answer, and it is
why the first few flipped runs are themselves the measurement.

---

## 5. Room 16 — encode it, and encode it defensively

The user's exception: **at room 16 (floor 4, room 4) always take no-modifiers**,
because there are no upgrades after the final boss.

Two things to be careful about, and neither is a reason not to do it:

- **The corpus has never seen room 16.** The deepest run ever is room 10
  (session 53). So this rule cannot be tested live and will not fire for a long
  time. Encode it anyway — it is cheap insurance against a good run — but do
  not let anyone gate anything on it (rule 6).
- **"Room 16 = floor 4 room 4" implies a flat index over four floors of four
  rooms, and that mapping is unverified.** The bot logs a flat `room` field
  1..10; whether the API exposes `floor` separately has not been checked. Check
  it before encoding. If the index scheme cannot be confirmed, encode the rule
  against **whatever field the server actually provides for the final room** and
  say in the code comment that the 16 is inferred.

Get the failure direction right: taking no-modifiers at the wrong room costs a
little reward, taking hardest at the *actual* final room costs the boss fight.
When uncertain, err toward no-modifiers.

---

## Your task (session 56)

1. **§2a** — pin the Rock=Sword / Paper=Shield / Scissor=Spell mapping in
   SPEC.md as user-confirmed.
2. **§2** — `pickBoonWithPriority` above `rankBoons`, implemented as the literal
   five-step total order with BurnMastery at the top; the `*Sword` family matched
   by suffix; lifesteal demoted in rooms 1–8 (including `AddLifestealSword`,
   which reverts to priority 4 from room 9 on). No open tie-breaks remain.
3. **§2d** — report the boonCapture overlap and retire it if subsumed.
4. **§2e** — sim head-to-head, reported either way, no tuning to the result.
5. **§3** — enumerate `enemyBuff` ids, model them and `rolledEnemyStats`, fail
   closed on unknown ids, re-check room 9.
6. **§4** — `scripts/rewardTierAudit.ts`, controlled for room, n stated, written
   so brief 57 can be built from its output.
7. **§5** — verify the room index scheme, then encode the final-room exception
   defensively.
8. **Rule 8 stays in force.** No tier-selection code changes this session.
9. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the final
   commit; no test writes a real data path; secret scan before handoff.

**Live play:** none is required by this brief. If the session begins after 11:00
PT on an unspent day, §19 is one command and should be taken — `checkFishingCaps`,
20 casts, `matcherWeightReport --last-casts=20`. Dungeon runs remain per-run
approval under rule 11.

**Honest expectation.** §2 is the session's deliverable and it is mostly
plumbing — the hard part was the naming mapping and the user has given it. §4 is
the one that could surprise: it is the first look at a field this project has
been discarding since session 09, and it decides how brief 57 is written. §3 is
the least visible and the most consequential — if the buffs are not modelled
before rule 8 flips, the simulator that makes every other measurement in this
project possible stops receiving usable captures, and nobody will notice for
several sessions.
