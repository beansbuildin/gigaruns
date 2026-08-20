# BRIEF — portability (make the bot runnable by someone who is not the author)

**This does not replace `handoff/next.md`.** Session 58's brief — the orb depth
experiment and the flip's first live run — is still queued and still valid; the
user cannot run live for ~3 hours and asked to start this in the meantime.
**This brief spends zero energy and makes no live play calls.** If both get done
in one session, do the portability work first and let §2 of `next.md` be the
session's live half.

**Chosen model: A now, keep C possible.** Friends run it themselves on their own
machines with their own credentials. No hosting, no credential custody, no front
end. But the seams get designed so a hosted layer could sit on top later without
a rewrite.

---

## 0. Two facts that make this much smaller than it looks

**There is no private key.** `src/api/auth.ts` implements only SPEC's Path A — a
JWT the user copies from their own browser's DevTools. Path B (bot-owned EOA) is
deferred and unimplemented, and nothing in `src/` signs anything. So the trust
ask on a friend is a **session token, not custody of a wallet**. Say this
explicitly in the setup guide; it is the difference between "install my bot" and
"give me your NFTs."

**The multi-account plumbing mostly exists already, by accident.** Sessions 30
and 31 forced every I/O-owning module to take an explicit path parameter,
because tests kept overwriting the real ledgers. `guardPersistence`,
`opponentModelPersistence`, `playCountsPersistence` and the fishing corpus are
already parameterised. **Per-account state is a wiring change, not a rewrite** —
the expensive part was paid for a different reason four hundred tests ago.

---

## 1. The `Profile` seam — the one design decision that keeps C reachable

Everything else here is mechanical. This is not.

```ts
// src/profile.ts
export interface Profile {
  name: string;
  dataRoot: string;      // was data/
  logRoot: string;       // was logs/
  fixtureRoot: string;   // was fixtures/
  getJwt(): Promise<string>;   // NOT a string — see below
}
export function resolveProfile(name?: string): Profile;
```

Three rules, and the third is the one that matters:

1. **Omitting `--profile` must be byte-for-byte today's behaviour** — same paths,
   same files, same `~/.secrets/gigaverse-jwt.txt`. Same discipline as session
   51's `shrinkageKByClass` and session 53's `order` option. The author's own
   setup must not move.
2. **`getJwt()` is a function, not a loaded string.** Today it wraps `loadJwt()`
   and nothing changes. But a hosted layer needs to refresh an expired token, and
   `TokenExpiredError` already exists because tokens *do* expire. Making this a
   provider now costs one indirection and is the single change that makes
   refresh-on-expiry possible later without touching call sites. Making it a
   string now means rewriting the client when C arrives.
3. **Nothing below the entry point may call `homedir()` or a literal path.**
   That is the whole invariant, and it is testable: a source-level test that
   greps `src/` and `scripts/` for `homedir(`, `"data/`, `"logs/`, `"fixtures/`
   outside `profile.ts` and fails on a hit. Same shape as session 54's
   `dungeonArmClosed.test.ts`, which is the precedent for testing "which code
   paths exist" rather than what they return.

Then wire `--profile=<name>` through `liveRun.ts`, `liveFishing.ts`,
`orchestrator.ts` and the check scripts, and resolve every persistence path off
the profile.

`config/discovered.json` is **game-global, not per-account** — Forbidden Woods is
dungeon 5 for everyone, `maxRoom` 16 for everyone (confirmed on four dungeons,
session 57). Ship it rather than making each friend re-run `probe.ts`.
`config/bot.json` is per-profile: budgets are personal.

---

## 2. The safety property worth pinning before it decays

The client's entire public surface is: `getMe`, `getAccount`, `getEnergy`,
`getDungeonToday`, `getDungeonState`, `getItemsBalances`, `getJuice`,
`getFishingState`, `getRomsPlayer`, `postDungeonAction`, `postFishingAction`,
`claimRomEnergy`.

**There is no sell, no burn, no list, no transfer, and no on-chain transaction
anywhere in it.** The worst this program can do on a friend's account is play the
game and claim that account's own ROM energy. That is a real, checkable safety
property and it is the strongest thing you can tell someone who is deciding
whether to hand over a token.

It is also currently an accident of what has been built, not a guarantee. Pin it:
a test that enumerates the client's public methods against an allowlist and fails
when one is added. Adding a destructive endpoint then becomes a conscious act
that breaks the suite, rather than a Tuesday.

**Note the boundary this creates.** CLAUDE.md's "ask first" list governs *the
agent building this repo*, not the program. A friend running
`npx tsx scripts/liveRun.ts` gets the program, not the agent, and no CLAUDE.md
rule constrains them. So anything on that list which actually matters at runtime
must be a **code** guard, not a documented one. Today that holds because the
capability doesn't exist. Say so in the guide, and keep it true.

Rule 11 needs no special handling under model A: the per-run human go-ahead *is*
the friend typing the command.

---

## 3. De-personalising the distribution

What a friend clones must not be the author's account.

- **Distribute from a fresh repo with squashed history.** The git history still
  carries the noob token and the three handoff documents' identifiers — a
  deliberate decision (`fixtures/README.md`), and it stays fine for a repo
  nobody is invited to read. Pointing friends at it is an invitation. Squashing
  into a new repo costs nothing and sidesteps the filter-repo/force-push
  question entirely.
- **Fixtures ship; they are already redacted** (session 54, 2,726 files, 0 raw
  occurrences). The sim needs them, and a friend starting with an empty corpus
  gets a bot that cannot simulate anything.
- **`data/`, `logs/`, `handoff/` do not ship.** `data/` is the author's learned
  state and ledgers, `logs/` is raw captures, `handoff/` is 250KB of session
  notes naming the account. `handoff/` in particular reads as an internal
  document and belongs in the working repo only.
- Keep `SPEC.md`, `PROTOCOL.md`, `CLAUDE.md`. A friend who wants to understand
  or extend it needs them, and CLAUDE.md explains *why* the odd rules exist.

---

## 4. `scripts/doctor.ts` — the thing that decides whether anyone actually uses this

Every "can I use your bot" dies at setup, and it dies silently. Build a preflight
that a friend runs first and that tells them exactly what is wrong:

- JWT present, non-empty, parses, **not expired** (decode the `exp` claim — do
  not call the API to find out), and log it masked, never whole (CLAUDE.md §3).
- One authenticated GET succeeds and reports which address it resolved to, so
  they can confirm it is *their* account before anything runs.
- `config/discovered.json` and `config/bot.json` present and schema-valid.
- Both cap ledgers read and printed with hours to the 11:00 PT rollover —
  `checkFishingCaps.ts` already does this half.
- Node version, and that `npx tsx` resolves.

Every failure prints what to do about it, not just what failed. `MissingJwtError`
already models this well — copy its tone.

---

## 5. The setup guide, written for someone who is not the author

A short `README.md` at the distribution root. Assume no context:

1. What it does, in three sentences, including that it plays two things.
2. **The ToS warning, once, plainly.** Automating a game account may breach its
   terms and the downside lands on their assets. They should decide knowingly.
   Do not bury this and do not repeat it five times — one honest paragraph.
3. Getting the JWT: log into gigaverse.io, DevTools → Network, play one action,
   copy the `Authorization: Bearer` value. Note that it expires and will need
   re-copying, so nobody is surprised the first time it dies.
4. `npx tsx scripts/doctor.ts` before anything else.
5. Setting their own budgets in `config/bot.json`, with the defaults explained
   in energy rather than in run-units — "240 energy = 4 juiced runs a day".
6. The two live commands, and what rule 11 means in practice: one run, then it
   stops and waits for you.
7. What it will not do: no selling, no burning, no transfers, no on-chain
   transactions. Point at the §2 test as the reason to believe it.

---

## Your task

1. **§1** — `src/profile.ts`, `--profile` wired through the four entry points,
   default path byte-for-byte unchanged, `getJwt()` as a provider, and the
   source-level test that no literal path or `homedir()` survives outside it.
2. **§2** — the client-surface allowlist test.
3. **§4** — `scripts/doctor.ts`.
4. **§3/§5** — the distribution list and the README, drafted in-repo. **Do not
   create or push the distribution repo** — that is the user's call and involves
   their GitHub account.
5. Recap normally: full suite + `tsc --noEmit` + `git diff --check`; no test
   writes a real data path; secret scan before handoff.

**Do not build:** a web UI, an HTTP server, a database, a credential store, user
accounts, or a job queue. Model A needs none of them and every one of them is a
commitment to operating other people's accounts. §1's seam is the only concession
to C and it is deliberately the cheapest one available.

**Honest expectation.** §1 is half a day and mostly mechanical because sessions
30/31 already did the hard part. §4 is the item that actually determines whether
a friend gets to a first run, and it is the one most likely to be underbuilt
because it feels like scaffolding rather than work. The real risk in this whole
brief is scope: "let my friends use it" is one refactor and a README, and it
turns into a product the moment anyone types the word "dashboard."
