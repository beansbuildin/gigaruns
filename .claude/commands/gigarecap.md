---
description: End-of-session handoff. Updates STATE.md, writes a session log, checks for secrets, pushes.
---

# /recap

You are writing a handoff for **Claude (chat)**, who will read it with **zero
memory of this session** and use it to write your next brief. Assume the reader
is intelligent, has read `SPEC.md`, and knows nothing about what just happened.

The value of your next brief is capped by the honesty of this recap. An
optimistic recap produces a brief that builds on work that doesn't function.

## Rules

1. **State gate results as PASS or FAIL. Never soften a FAIL.** "Mostly working"
   is not a state. If the gate didn't pass, it failed — say so and say why.
2. **Ground truth overrides `SPEC.md`.** Every place a live response contradicted
   the spec goes in the Corrections section, with the actual field names. Also
   fix `SPEC.md` itself in this commit.
3. **Record dead ends.** Anything tried and abandoned, with the reason. This is
   what stops the next brief from sending you down the same hole.
4. **No invented progress.** If you didn't run it, don't report it. If a test is
   skipped, say skipped.
5. **Numbers, not adjectives.** "Win rate 61% over 1000 sim runs" — not "good."

## Steps

**1. Secret scan (before anything else).**
Grep the diff for `0x[a-fA-F0-9]{40,}`, `eyJ` (JWT prefix), `PRIVATE`, and any
file under `~/.secrets`. If anything matches, **stop, do not commit**, and tell
the user which file and line. Confirm `.gitignore` still covers `.env`, `*.key`,
`config/discovered.json`, `data/`, `logs/`.

**2. Redact and commit fixtures.**
Copy any new API captures into `fixtures/`, replacing wallet addresses with
`0xUSER`, JWTs with `<JWT>`, and usernames with `<USER>`. Keep the structure and
all non-identifying values exactly — Claude needs the real shapes.

**3. Overwrite `handoff/STATE.md`** with the template below. Under ~150 lines.
It is read fresh every cycle and must stand alone.

**4. Append `handoff/log/session-NN.md`** — same content plus anything verbose
(full error dumps, EV tables, response bodies). No length limit here.

**5. Append to `handoff/DECISIONS.md`** any question settled this session, one
line each: `YYYY-MM-DD — <decision> — <reason>`.

**6. Commit and push.** Message: `session NN: <task> — GATE PASS|FAIL`.

**7. Print the repo URL and commit SHA** so the user can hand them to Claude.

---

## STATE.md template

```markdown
# STATE — session NN — <date> — commit <sha>

## Status
Task <N> "<name>": **GATE PASS | GATE FAIL | IN PROGRESS**
Next per TASKS.md: Task <N+1>
Overall: <one sentence a stranger could act on>

## What works
- <capability> — verified by <how>
(Only things you actually ran. Delete anything unverified.)

## What's broken
- <thing> — <symptom> — <suspected cause, or "unknown">
(Empty only if genuinely empty. An empty section here on a FAIL is a bug in
this recap.)

## Corrections to SPEC.md
- SPEC §<n> said `<claimed>`; live response has `<actual>`. Fixed in SPEC.md.
- Resolved IDs: forbiddenWoods=<id>, dendren=<id>
- Move charges: PRESENT | ABSENT | UNKNOWN — <evidence>
(Say "none this session" if none. Never leave blank.)

## Dead ends
- Tried <X>, failed because <Y>. Don't retry without <Z>.

## Metrics
- Sim: <n> runs, win rate <x>% vs baseline <y>%
- Live: <n> runs, <items>/energy, <deaths>
- Fishing: <casts>, catch rate <x>%, |H| converged in <n> turns median
(Omit lines you have no data for. Do not estimate.)

## Open questions for Claude
1. <specific, answerable question with the context needed to answer it>

## Files changed
<git diff --stat, trimmed>
```

---

If the session ended early, produce the recap anyway. A short honest recap beats
a missing one — an absent recap costs the next cycle entirely.
