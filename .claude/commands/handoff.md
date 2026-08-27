---
description: Start a session from Claude's brief. Reads context, restates the plan, then works.
---

# /handoff

Start of session. You have no memory of previous sessions — the repo has it.

## Read, in this order

1. `CLAUDE.md` — rules of engagement. Non-negotiable.
2. `handoff/STATE.md` — where things actually stand.
3. `handoff/next.md` — your brief for this session, written by Claude (chat).
4. `handoff/DECISIONS.md` — settled questions. **Do not reopen these.** If you
   think a decision is wrong, note it in the recap; don't silently reverse it.
5. `TASKS.md` — the task and gate you're working toward.
6. `SPEC.md` — only the sections your brief cites. Don't read it end to end.

Skip `handoff/log/` unless your brief points you at a specific session.

## Before writing code

Restate in three lines: the task, the gate that ends it, and the first thing
you'll do. If any of those three is unclear from the brief, ask now — a wrong
assumption at the top of a session compounds all the way to the recap.

**If `next.md` conflicts with `STATE.md`,** trust `STATE.md` and flag it. Claude
wrote the brief from the last recap and may be working off something that has
since changed or turned out to be wrong. Reality beats the plan.

**Check the brief against `STATE.md`'s "Settled — do not re-open" digest before
you start.** [session 104] The digest exists because a brief asked for a
measurement that had shipped three sessions earlier, quoting the problem
statement of the very entry that answered it — and the check that would have
caught it took four minutes. If the brief proposes something the digest lists,
say so at the top of the session and work only the part that is genuinely open.
The digest is pointers; `DECISIONS.md` and `QUESTIONS.md` hold the evidence.

**If `next.md` is missing or stale** (older than the last session log), don't
guess — work the next unblocked task in `TASKS.md` and note it in the recap.

## During

- Verify against live responses, not against `SPEC.md`. The spec is a hypothesis.
- Log surprises as you hit them, in a scratch file. You will not remember them
  at recap time, and surprises are the most valuable thing in a recap.
- Blocked on a human decision? Write `QUESTIONS.md`, move to the next unblocked
  task, keep going.

## End

Run `/recap` **before** context gets tight. A recap compressed out of an
exhausted context loses exactly the detail that makes it useful.
