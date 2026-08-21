# BRIEF — session 67

## The clock and the ledger

Written **2026-08-21, 11:05 PT**, just after the rollover. Twenty casts and
twelve run-units are now live.

**This session is OFFLINE. User decision, 2026-08-21: no fishing, no dungeon
runs.** A full ledger is not permission, and rule 11 needs a per-run go-ahead
regardless. Read both ledgers once, report the day, spend nothing.

*Environment note, session 66: `npx tsx` fails under the command sandbox on this
machine (`EPERM listen … tsx-501/*.pipe`). Run `tsx` unsandboxed. Not a repo
problem — do not chase it as one.*

---

## 1. NEW USER DIRECTIVE — oils are a backup, not a routine spend

**User, 2026-08-21, verbatim intent:**

> Keep crafting, but use oils only on an as-needed basis. If the autofisher
> believes it can catch the fish without oil, don't use the oil — conserve
> inventory for future casts. The priority is to use mana to get the fish as
> close as possible to caught, with the oils as a backup to guarantee a catch if
> need be.

This is a **policy change**, not a crafting preference. It does not ship this
session (rule 4, and it is a live-policy change), but it gets designed and
scored.

### 1a. The objective function changed, and that alone may re-rank the shipped policy

*Source: `OIL-POLICY.md`, sim-derived, `costsTurn=false, amount=2, n=8000`.*

The sweep ranked arms by **catch-rate delta**. The directive ranks them by
something closer to **catches per oil**. The existing table already carries both
columns, and they disagree:

| arm | Δ catch | oils | **Δpp per oil** |
|---|---|---|---|
| on-demand (SHIPPED) | +19.40pp | 5578 | 0.278 |
| **focus-when-empty-only** | +17.74pp | 3515 | **0.404** |
| lethal-relaxing-only | +4.47pp | 1821 | 0.197 |
| start | +5.66pp | 16000 | 0.028 |

**Under a conserve objective, `focus-when-empty-only` already beats the shipped
policy on the numbers this repo has had since session 61** — 91% of the benefit
for 63% of the oil. **Re-rank the existing arms under the new objective before
building anything new.** That costs nothing and may answer the whole question.

### 1b. The corpus already says the Relaxing trigger is the wasteful one

*Source: session 66, corpus-measured over 109 casts.* The lethal trigger is
reachable in 12 casts, and **10 of those 12 were CAUGHT ANYWAY.** Only 2 escaped
(12975713, 12991353). So under the directive, roughly five of every six Relaxing
spends are exactly the "would have caught it without the oil" case the user is
asking to stop.

That is corpus evidence for the directive, not a projection.

### 1c. Design the necessity gate — and state plainly what "believes it can catch" means

The directive needs an operational definition, and a vague one will silently
become "always" or "never". Propose one, defend it, and pin it:

- **Relaxing Oil** — fires at `fishHp <= 2` today. The gate should add: **and the
  bot cannot close this turn without it.** The natural test is whether an
  affordable card in hand deals `>= fishHp` at the current focus. If one does,
  play it; the oil buys nothing. If none does, the oil converts a probable escape
  into a certain catch — which is exactly "guarantee a catch if need be."
- **Focus Oil** — fires at meter zero today. At zero the policy is frozen on its
  last cell and cannot aim, so the necessity case is stronger. **Do not assume it
  is always necessary.** Score at least one gated variant, e.g. skip when the
  fish is already within reach from the frozen cell.
- **Mana first, explicitly.** The directive ranks mana ahead of oils. Whatever
  gate you build, verify in sim that it does not cause the bot to hold mana back
  in anticipation of an oil.

### 1d. Report it against the directive's own metric

Headline **oils per extra fish**, not Δpp — that is what the user is optimising.
Session 66 priced the Relaxing trigger at **~6 oils per extra fish, 95% CI
roughly 1.5–20**; give the conserving arm the same treatment so the two are
comparable.

**Do not ship any of this.** Produce a recommendation with its causal story, the
way `OIL-POLICY.md` did, and stop. Note explicitly whether the recommendation is
simply "switch to focus-only" — if the free re-rank in §1a settles it, say so
rather than building a gate nobody needs.

---

## 2. Consolidate the six `fakeDoc` copies

**User decision, 2026-08-21: do it now.** Flagged for six sessions; session 65
proved the risk is not theoretical — two copies omitting
`fishingConsumableSlotUsed` made every "it consumes" assertion **vacuous** while
staying green.

`tests/helpers/liveFishingDeps.ts` already exists for this reason, under its own
stated rationale that *a guard that only covers one file is not a guard*. One
shared builder, four test files, no behaviour change.

**The consolidation is not the point — the guard is.** A single copy that omits a
field is the same bug with better ergonomics. So the shared helper must carry
**every field the live decision path reads**, and a test must prove it: remove a
field the path depends on and the suite must go red.

---

## 3. Distribution — rehearse steps 5 and 6 locally, before anything is pushed

**User decision, 2026-08-21: distribution is the direction from here.**

*Source: `handoff/DISTRIBUTION.md`.* Steps 1–2 are done in the tree. Steps 3–6
are the user's, and **an agent must not create or push the distribution repo.**

But DISTRIBUTION.md says its own step 5 — *clone it fresh and run
`scripts/doctor.ts` as a friend would* — is "the one worth not skipping", and
**that step needs no GitHub at all.** It can be rehearsed here, offline, and the
result is the thing the user most needs before inviting anyone: the actual
first-run experience.

### 3a. What to do

- Export the **ships list** (DISTRIBUTION.md's table) into a clean directory
  **inside the project and gitignored** — e.g. `dist-preflight/`. A copy, not a
  clone: **no `.git` comes with it.** Keep it inside the project root; CLAUDE.md's
  filesystem-scope rule is not suspended for convenience.
- **Do not `git init` it, do not create a repo, do not push.** The export is a
  rehearsal of step 3's output, not step 4.
- In that directory, run the friend's first-run sequence: `npm install`, the full
  suite, and `scripts/doctor.ts`.
- **Simulate the friend's missing environment through the profile/env
  indirection** — no `~/.secrets`, no `data/`. **Do not touch, move, or rename
  anything under `~/.secrets` to achieve this.**

### 3b. What to report

- **Every failure `doctor.ts` prints, verbatim.** These are the friend's first
  five minutes, and each one is either a README gap or a real portability bug.
- Whether the suite passes in the clean tree. If `fixtures/` was trimmed by
  accident it fails there and passes at home — that is precisely what step 6 is
  for.
- Anything in the ships list that turned out to be missing, and anything in the
  does-not-ship list that the clean tree still needed. **A file the bot needs and
  the list omits is the finding.**
- A short **user checklist for steps 3–6**, written so the user can execute them
  without re-reading this brief: the exact commands, in order, with the two
  decisions already made (private repo, squashed single-commit history) stated
  inline.

### 3c. The one thing not to lose sight of

*Source: DISTRIBUTION.md.* **Ship from a fresh repo with squashed history.** The
working tree is clean — session 54 redacted 2,726 files to zero raw occurrences —
but **the git history still carries the noob token and three handoff documents'
identifiers.** That was fine for a repo nobody was invited to read. Pointing
friends at it is an invitation. One commit, no ancestry, no `filter-repo`, no
stale clones holding old objects.

Re-run the secret scan **against the exported tree**, not against the working
tree, and report it separately. They are not the same artifact.

---

## 4. Carried

- **The tripwire has never met a real server**, and it should not be chased.
  It fires on ~1–2% of turns, so a seven-cast batch produces perhaps one armed
  turn and most likely none. **Do not budget casts to exercise it** — session
  66's own recommendation, and this brief adopts it explicitly rather than
  leaving it implied. It sits armed until it fires on its own.
- **`SESSION_65_LIMITS` stays exported and unchanged, and is not an
  authorization.** Its rationale is retired in both places a future session
  reads it.
- **Do not quote the sim's +4.47pp as the cost of zero Relaxing stock.** Per oil
  the sim and corpus agree (0.196 vs 0.167); the headline differs 2.4x only
  because the sim reaches the lethal band on 22.8% of casts against the corpus's
  11.0%.
- **`boonCapture` stays OFF** — third recap in a row saying so. **Settled unless
  the user reopens it; stop listing it.**
- Boon coverage unchanged at orb 6 / priority 2 since session 62. Zero runs since.
- Corrode in `dungeonSim` is a **CLOSED decision**; rule 8's measurement
  programme is **CLOSED**; §19 is **CLOSED**. Do not reopen any of the three.
- Carried and deliberate: 25 analysis scripts hold hardcoded paths (ratcheted);
  distribution steps 3–6 remain the user's.

---

## 5. Gate

Both halves are offline and deterministic.

1. **The conserving oil policy is scored against `on-demand`, `never`, and
   `focus-when-empty-only`**, headlined in **oils per extra fish**, with the
   necessity gate's definition pinned by a test that fails if the gate degrades
   to always-fire or never-fire.
2. **The six `fakeDoc` copies are one shared builder**, and a test proves the
   builder carries every field the live decision path reads — **demonstrate it
   failing with one such field removed**, then restore.

---

## 6. Do not

- **Do not fish and do not run a dungeon run.** Offline session by user decision.
- **Do not ship the conserving policy** — derive, recommend, stop (§1d).
- **Do not `git init` or push anything** (§3a). The export is a rehearsal.
- **Do not touch, move, or rename anything under `~/.secrets`** to simulate a
  friend's environment.
- Do not run the export outside the project root.
- Do not budget casts for the tripwire (§4).
- Do not reopen §19, rule 8, or corrode-in-`dungeonSim`.
- Do not let the consolidated `fakeDoc` omit a field the live path reads — that
  is the original bug with fewer copies.
- Do not read an `UNKNOWN FIELD` banner as a server change.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 7. Corrections to me

- **The membership check I asked for in §3 last session was arithmetically
  vacuous, and session 66 was right to say so.** Gap membership is a per-cast
  property and the corpus only grows, so `gap(109) ⊇ gap(102)`; equal counts
  therefore **force** equal membership. The check could only ever return one
  answer, so it could not distinguish the hypothesis from its negation.
- **What makes that worse than a wasted step is its shape.** The probability
  argument in the same section was sound — 0.36 is not evidence — and I then
  proposed, as the remedy, a test with no power at all. **A brief that correctly
  identifies weak evidence and then prescribes no evidence has not improved
  anything**; it has replaced a soft claim with a procedure that manufactures a
  hard-looking one. Before asking for a check, ask what the failing case would
  look like. If it cannot be described, the check is not a check.
- **Session 66 found the real property anyway, and it is worth recording as the
  answer**: the gap is exactly the casts whose meter emptied for the first and
  only time on the state that ended the cast. 66 escaped-with-empty-terminal-meter
  minus 52 that had already hit zero with a turn still to play = 14. A caught cast
  can never be in the gap. That is the clause the definition was invented to
  exclude, restated — a definition working as designed, not a discovery.
- **Session 66's own note on source-text pins is the transferable lesson and I am
  carrying it forward into §2 and §5**: source-text assertions prove a line
  exists, not that it runs — the populate-side pins still passed with the
  tripwire branch dead, because `disarmOverride(...)` remained textually present
  in the dead branch. Behavioural tests caught it. Keep that division of labour.

---

## Your task (session 67)

1. Read both ledgers, report the day, **spend nothing**.
2. **§1a** — re-rank the existing sweep arms under the conserve objective first.
   If that settles it, say so and skip the gate design.
3. **§1c–1d / gate 1** — otherwise design and score the necessity gate, headline
   oils per extra fish, and **recommend without shipping.**
4. **§2 / gate 2** — consolidate the six `fakeDoc` copies behind one builder that
   carries every field the live path reads.
5. **§3** — the distribution rehearsal: export the ships list to a gitignored
   in-project directory, run the friend's first-run sequence, report every
   `doctor.ts` failure verbatim, re-run the secret scan **against the export**,
   and write the user's steps 3–6 checklist.
6. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the **final**
   commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** §3 is the session's most valuable item and the one with
the highest chance of an unwelcome surprise, which is the point of doing it before
anyone is invited. The bot has been developed for 67 sessions inside a directory
that has always had `~/.secrets`, a populated `data/`, and a full `fixtures/`
corpus; **nothing has ever verified that it starts without them.** Sessions 64,
65 and 66 were each a component that looked shipped and had never executed the
path that would break it — a fresh clone is that same question asked of the whole
repo at once.
