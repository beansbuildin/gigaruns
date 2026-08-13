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
2026-08-13 — Task 3 runs before Task 2; schemas are written from observed responses, never from SPEC — probe.ts is self-contained and read-only, so writing zod schemas against spec guesses then rewriting them against reality is wasted work in both directions. Ground truth first.
2026-08-13 — Auth is Path A (browser JWT at ~/.secrets/gigaverse-jwt.txt); Path B EOA signing stays deferred — user plays in-browser via Abstract Global Wallet, so a bot-owned EOA would authenticate a different, empty account.
2026-08-13 — Combat resolution: winner OR tie regenerates armor = own move's currentDEF (capped, excess wasted) then deals full ATK; loser gains and deals nothing; regen before damage; damage hits armor then overflows to HP — user-supplied rule, machine-verified 14/14 against recorded exchanges by scripts/verifyCombatModel.ts. EVERY move regenerates, not just Shield.
2026-08-13 — The earlier "only Shield grants armor / ties deal ATK−DEF" model is REJECTED and must not be reintroduced — it also fit 14/14, because the two are identical while armor is 0 and the cap is slack and no win with a DEF-bearing non-Shield move was ever recorded. It grants 0 armor instead of 8 when winning with Spell.
2026-08-13 — No in-combat healing; HP restored only by a post-fight card — observed. Consequence: armor is renewable and HP is not, so SPEC §4b keeps HP and armor as separate utility terms rather than one effective-HP pool.
2026-08-13 — Enemy moves at ≤0 charges are DOWN-WEIGHTED, not pruned to zero — charges were observed going negative (paper 1 → −1) and no move was ever seen attempted at ≤0, so illegality is unproven. Revisit when a run records an enemy playing at ≤0.
2026-08-13 — Raw API dumps live in gitignored `fixtures/**/raw/`; committed fixtures are redacted (0xUSER / <USER> / <JWT>) with all game values intact — raw is ground truth per CLAUDE.md §1, but the repo is public.
