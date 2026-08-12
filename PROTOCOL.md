# PROTOCOL — Claude ⇄ Claude Code

Two agents, neither with memory. **The repo is the shared brain.**

- **Claude Code (CC)** writes code. Forgets everything when the session ends.
- **Claude (chat)** writes briefs, reviews, decides direction. Forgets everything
  when the chat ends, and starts each chat blind.
- **You** are the transport layer. Ideally two copy-pastes per cycle.

Everything either agent needs to resume must be *in the repo*. Nothing important
lives in a chat window or a CC session — those are scratch space that gets
deleted.

---

## The loop

```
   ┌─ Claude writes handoff/next.md ──────────────┐
   │                                              │
   │  you: git pull, then tell CC "/handoff"      │
   ▼                                              │
CC works the brief ──── /recap ────► STATE.md + log/session-NN.md, pushed
                                                  │
   you: give Claude the repo URL ─────────────────┘
```

**One cycle:**

1. CC does the work, then runs `/recap`. That updates `handoff/STATE.md`,
   appends `handoff/log/session-NN.md`, checks for leaked secrets, commits, pushes.
2. You paste the repo URL into a chat with Claude. Same URL every time.
3. Claude reads `STATE.md` + the newest session log (+ any diffs it asks for),
   then writes the next brief.
4. Claude gives you the brief as a file. You drop it at `handoff/next.md`,
   commit, and tell CC `/handoff`.

CC reads its own brief from the repo, so nothing degrades through copy-paste and
the brief is version-controlled alongside the work it produced.

---

## How Claude reads the repo — pick one

**Option A — public repo (simplest).** Claude fetches raw files directly from a
URL. Zero paste. Secrets are already gitignored per `CLAUDE.md`, so nothing
sensitive is exposed — but your strategy tuning is public. Fine for most people.

**Option B — private repo + unlisted gist (recommended).** Code stays private.
`/recap` also pushes `STATE.md` and the latest session log to a **secret gist**,
whose URL is unguessable but fetchable. You get privacy on the code and zero
paste on the handoff. Set `HANDOFF_GIST_ID` in `.env`.

**Option C — private repo + paste.** You paste `STATE.md` into the chat. Works
fine, costs you one extra copy per cycle. Choose this if you'd rather not
publish anything at all.

**Option D — Google Drive.** You have Drive connected to this chat. If CC writes
`STATE.md` into a Drive-synced folder, Claude can read it directly — private and
paste-free. Slightly more setup; worth it if you'll run this for months.

Start with C, move to B once the loop feels good.

---

## What makes a recap good

This is the whole ballgame. A bad recap makes Claude write a confidently wrong
brief, and you lose a session. The `/recap` command enforces the format, but the
principles behind it:

**Report failures louder than successes.** "Task 5 gate FAILED, win rate 48% vs
baseline 44%, needs 15%" is worth ten times more than "implemented strategy
engine." Claude cannot correct a course it doesn't know is off.

**Ground truth beats the spec.** When a live API response contradicts `SPEC.md`,
the response wins. Recaps must list every such correction explicitly. `SPEC.md`
was written from public docs and an educated guess about undocumented content —
assume parts of it are wrong and overwrite them.

**Record what was tried and abandoned.** Otherwise Claude will cheerfully suggest
it again next cycle, and you'll pay for the same dead end twice.

**Commit the fixtures.** Redacted `fixtures/probe/*.json` in the repo means Claude
can write strategy code against *real* response shapes instead of imagining them.
This single habit removes most of the back-and-forth.

**Keep `STATE.md` under ~150 lines.** It's overwritten every session and read
fresh every cycle. Session logs are the append-only history; Claude only reads
those when it needs to dig.

---

## Repo layout

```
handoff/
  STATE.md            ← overwritten each session. The single source of truth.
  next.md             ← Claude writes this. CC reads it via /handoff.
  DECISIONS.md        ← append-only. Settled choices, so nothing is relitigated.
  log/session-NN.md   ← append-only history.
.claude/commands/
  recap.md            ← /recap
  handoff.md          ← /handoff
QUESTIONS.md          ← blockers for a human. Cleared once answered.
```

`DECISIONS.md` matters more than it looks. Without it, each amnesiac cycle
risks re-opening a question that was already closed — auth path, language,
utility weights. One line per decision, with the date and the reason.

---

## Session hygiene for CC

- One task per session where possible. Long sessions produce vague recaps
  because the early work has fallen out of context by the end.
- Run `/recap` **before** context runs low, not after. A recap written by a
  context-starved agent is a recap written from a summary of a summary.
- Push before ending. An unpushed recap is an invisible one.

## When to break the loop and just ask

If CC is blocked on something a human must decide — spending ETH, an ambiguous
game mechanic, a design fork with real cost — it writes to `QUESTIONS.md` and
moves to the next unblocked task. Bring `QUESTIONS.md` to the chat immediately
rather than waiting for the session to end. Blockers are the one thing worth
interrupting the rhythm for.
