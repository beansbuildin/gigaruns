# STATE — session 59 — 2026-08-20 (PT) — code at commit 6d705bc

## Status
Portability brief (`handoff/next-portability.md`): **§1–§5 ALL DELIVERED**, plus
CLAUDE.md rule 3's two "non-optional before the repo goes anywhere" cleanups.

**No gate was set.** Standing bar met: suite **1060/1060**, `tsc --noEmit`
clean, `git diff --check` clean, secret scan clean, no test writes a real data
path.

**`handoff/next.md` was STALE** (2026-08-19 23:49, older than the session-58
log) — it is the session-58 brief, whose §1 was completed last session. Its §2,
**the first live juiced run, is still queued and is now the single most valuable
item in the project.** The user chose to recap rather than wait for the 11:00 PT
rollover.

**Zero energy spent. Zero casts. Zero dungeon runs.** One free GET, from
`doctor.ts` proving itself.

**THE CARRIED DIRECTIVE, restated because it cost a session already:**
**ENERGY IS NOT A CONSTRAINT — never plan around it or report it as a blocker.**
~1368/day once ROMs are counted; `GET /offchain/player/energy` shows only the
passive regen pool. CLAUDE.md rule 12. Real ceilings are the game's daily
ledgers (12 dungeon run-units, 20 fishing casts, both 11:00 PT).

## What works
- **`src/profile.ts` — the seam, wired through all four entry points**
  (`liveRun`, `liveFishing`, `orchestrator`, `doctor`). `--profile=<name>` or
  `GIGA_PROFILE`.
- **Omitting `--profile` is byte-for-byte unchanged.** `tests/profile.test.ts`
  pins every default as a **literal**, not by recomputing it from the module —
  a test comparing a constant to itself passes whatever that constant becomes.
  Confirmed live: `liveRun.ts --status` still reads the real ledgers.
- **`getJwt()` is a PROVIDER, not a loaded string**, so refresh-on-expiry stays
  reachable later without touching call sites.
- **Profile names are REJECTED, not sanitised** (`..`, `a/b`, empty, leading
  dash). A silently-sanitised name is how one ledger overwrites another.
- **`config/discovered.json` is SHARED; `config/bot.json` is per-profile.**
  Dungeon 5 and `maxRoom` 16 are game-global; budgets are personal. The first
  cut had this wrong — the brief called it out and tests now pin the split.
- **The JWT stays in `~/.secrets`**, never under `profiles/` (inside a public
  repo, one `git add -A` from being committed).
- **`tests/clientSurface.test.ts` — the safety property is now enforced.** No
  sell/burn/list/transfer/on-chain call exists; adding one breaks the build.
- **`scripts/doctor.ts`** — Node, cwd, token presence/parse/**expiry decoded
  locally from `exp`**, config, then ONE authenticated GET printing which
  account resolved. Every failure says what to do. Verified on a real profile
  and a nonexistent one.
- **SPEC Path B DELETED and `viem` dropped** (rule 3). `README.md` and
  `handoff/DISTRIBUTION.md` drafted.
- Suite 1047 → **1060**.

## What's broken
1. **§2 STILL NOT ATTEMPTED — three sessions running.** The rule-8 tier flip
   (session 57) **and** the wide orb rule (session 58) are both live in code
   with **zero live exercise**. Every test is against a mock. This is the
   project's largest untested surface and it grows each session.
2. **§19 UNMEASURED for a NINTH session.** Precondition is one thing: **a
   session that BEGINS after 11:00 PT** with the day's 20 casts unspent.
3. **The no-hardcoded-paths invariant is SCOPED, not met literally.** Enforced
   for `src/` and the four entry points; the **25** remaining analysis/probe
   scripts are inventoried as a ratchet, not converted. They read the author's
   corpus directly and nobody running the bot invokes them. Stated as debt.
4. **§23's −1 energy drift still unexplained.** Probe armed, unfired, no run.
5. **The distribution repo does not exist and must not be created by an agent.**
   Blocking item in `handoff/DISTRIBUTION.md`: git HISTORY carries identifiers,
   so ship from a fresh squashed repo, not `filter-repo`. Also unresolved:
   whether `config/discovered.json` comes off `.gitignore`, and **there is no
   LICENCE** — absent one, nobody has permission to use it.
6. Carried: the sim models a policy the bot does not play (Safe tier). Deliberate.

## Corrections to SPEC.md
- **SPEC §1a REWRITTEN. Path B ("bot-owned EOA", `AUTH_MODE=eoa`) is DELETED,
  not deferred**, along with its `POST /user/auth` EIP-191 flow that was marked
  **[CONFIRMED]**. AGW exposes no user-held EOA key, so the path was
  *unreachable*, not unfinished — and it would falsify the one safety sentence
  the repo can offer. Do not replace it with AGW session keys either: this bot
  does no on-chain work at all.
- **The brief said `viem` was "imported nowhere in `src/`" — TRUE BUT
  INCOMPLETE.** `scripts/probe.ts` held a **full working Path B**: it read
  `~/.secrets/gigaverse-private-key.txt` and signed with
  `privateKeyToAccount`. Deleted with the `AUTH_MODE` branch. (Rule 9: verify
  the brief's claims — this is the third time it has paid.)
- **No live response contradicted SPEC this session.** No live play.
- Resolved IDs unchanged: forbiddenWoods=5, dendren nodeId="5"/pondId=2.
- Move charges: PRESENT — unchanged, no new capture.

## Dead ends
- **Do not take the brief's "greps `src/` and `scripts/` … and fails on a hit"
  literally.** It fails on ~60 sites, most in analysis scripts with no
  portability value. Enforce where load-bearing; inventory the rest.
- **Do not pin a test to an IDENTIFIER when you mean a property.** Session 54's
  `dungeonArmClosed.test.ts` asserted the literal
  `acquireGuardLock(FISHING_GUARD_STATE_PATH)`, so renaming a variable read as
  the dungeon arm reopening. Re-pinned on the FILE NAMES actually locked.
- **Do not assume `.gitignore`'s `data/`/`logs/` cover a new tree.** They match
  at any depth, so `profiles/<name>/data` was covered by luck — but
  `profiles/<name>/fixtures` and `.../config` were NOT, and a second account's
  captures would have been committed to a **public** repo. `profiles/` is now
  ignored, pinned against real `git check-ignore`.
- **Do not filter the generic transports out of the client-surface test.**
  `raw`/`get`/`post` are `private` in TypeScript only — **erased at runtime**.
  Listing them honestly, plus a test that no call site outside `client.ts`
  touches them, beats claiming a smaller surface than exists.
- Standing: do not report an energy number as a blocker (rule 12); exercise the
  real gate (`--dry-run`, free) before claiming anything is blocked; do not
  revert rule 8 or the wide orb rule without a user directive; never pipe a
  live run to a truncating reader.

## Metrics
- **Live dungeon: 0 runs. Live fishing: 0 casts. Energy spent: 0.** One free GET.
- **Caps at session start (09:44 PT):** dungeon 12/12 run-units, fishing 20/20
  casts, both spent; roll at 11:00 PT. Session ended before the rollover.
- **Path literals outside the seam:** `src/` 3 real ones at session start → all
  behind `profile.ts` or documented defaults; `scripts/` **25** unconverted,
  ratcheted.
- **Client surface:** 12 named endpoints (9 GET, 3 mutating), 0 destructive.
- Suite 1047 → **1060** (+13: profile 16, clientSurface 6, noHardcodedPaths 9,
  minus overlap).

## Open questions for Claude
1. **The next brief's FIRST paragraph should be the 11:00 PT clock and nothing
   else.** §2 and §19 need only a session that BEGINS after 11:00 PT with caps
   unspent. Do not mention energy. Do not add conditions.
2. **§2 is now testing TWO untested policies at once.** Report: tier offered vs
   taken per room; how often Perpetual filtered the top choice (~35% expected);
   whether `final-room` or `final-room-unreadable` appeared (**room 16 is
   unreachable — any `final-room-unreadable` is a BUG, stop the run**); and for
   the orb rule, how often `orbFallback` fired, `narrowed` true vs false,
   `orbsTaken` vs `orbsOffered`, and the run's orb sum. Check the first
   `tier_choice` AND the first `boon_choice` before letting it continue.
3. **§23's probe is still armed and unfired** — is the pair around `start_run`
   −59 or −60?
4. **Distribution needs three USER decisions, not agent work:** whether
   `config/discovered.json` comes off `.gitignore`; which repo and whether
   public; and **a licence** (there is none). See `handoff/DISTRIBUTION.md`.
   **An agent must not create or push the distribution repo.**
5. **Do not ask for a "dashboard", a server, or a credential store.** The brief
   named scope creep as its real risk and it was right; model A needs none of
   them, and each one ends the "a session token, not custody" story.
6. `boonCapture` stays OFF — still zero ordinary runs since the directive.

## Files changed
```
 2 commits. 17 files, +1,310 / −347. No fixtures written (zero live play).

     scripts/doctor.ts                      | 223  (§4, new — the preflight)
     tests/profile.test.ts                  | 174  (§1, new)
     src/profile.ts                         | 178  (§1, new — the seam)
     README.md                              | 177  (§5, new)
     tests/noHardcodedPaths.test.ts         | 159  (§1, new — scoped + ratchet)
     tests/clientSurface.test.ts            | 139  (§2, new — the safety pin)
     SPEC.md                                |  83  (§1a rewritten, Path B gone)
     handoff/DISTRIBUTION.md                |  79  (§3, new)
     scripts/probe.ts                       |  67  (Path B implementation gone)
     scripts/liveRun.ts                     |  59  (§1 wiring)
     src/api/auth.ts                        |  45  (path param; no-key note)
     scripts/liveFishing.ts                 |  23  (§1 wiring)
     scripts/orchestrator.ts                |  23  (§1 wiring)
     tests/orchestrator/dungeonArmClosed.ts |  14  (re-pinned on file names)
     .gitignore                             |   6  (profiles/)
     package.json / package-lock.json       | 208  (viem dropped)
```
