# DECISIONS

Append-only. One line per settled question, newest at the bottom. Never edit or
delete a line — if a decision is reversed, append the reversal with its reason.

Format: `YYYY-MM-DD — <decision> — <reason>`

---

2026-08-12 — Repo is PUBLIC at github.com/beansbuildin/gigaruns; PROTOCOL Option A — user directive; secrets live in ~/.secrets and are gitignored, so nothing sensitive is exposed. Strategy tuning being public is accepted.
2026-08-12 — TypeScript strict + NodeNext ESM, `"type": "module"` — CLAUDE.md mandates TS; NodeNext matches the actual Node/tsx runtime. Consequence: relative imports need explicit `.js` extensions.
2026-08-12 — vitest 4.1.10, not 2.x — the 2.x tree carried a critical vite/esbuild advisory; 4.x audits clean. Re-audit before any downgrade.
2026-08-12 — `.claude/settings.local.json` gitignored — machine-local permissions state, not repo content.
2026-08-12 — No `.gitkeep` in `data/` or `logs/` — both gitignored wholesale, so a keepfile could never be tracked.
2026-08-12 — `config/bot.json` deferred, not invented — no schema exists yet and CLAUDE.md forbids guessing at energy-budget values. Must be defined explicitly before the orchestrator can enforce a budget.
