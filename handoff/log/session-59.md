# session 59 — 2026-08-20 — portability: the Profile seam, the safety pin, and deleting the private key that was never supposed to exist

Commits: `5bc044e` (the brief), `f012bb4` (the gitignore hole), plus this recap.
Started 09:44 PT, ended before the 11:00 PT rollover by the user's choice.
Suite 1047 → 1060. Zero energy, zero casts, zero runs, one free GET.

---

## Which brief was live, and why it wasn't the obvious one

`handoff/next.md` is dated 2026-08-19 23:49 — **older than `handoff/log/
session-58.md` (09:09 today), so stale by the handoff protocol's own test.** It
is the session-58 brief; its §1 was completed last session and its §2 (the first
live juiced run) is still queued.

The live brief was `handoff/next-portability.md`, modified at 09:44 today in the
user's own out-of-band commit `e74fe3e` — which also rewrote **CLAUDE.md rule
3** and is the reason this session had two mandatory cleanups attached to it.

---

## Rule 3, and the private key that was still in the repo

The user's new rule 3 says, in part:

> **There is no private key, and there is not going to be one.** … the account
> is an **Abstract Global Wallet**, which does not expose a user-held EOA
> private key at all, so there is no key to store, load, or hand to anyone.

with two actions attached: delete SPEC's Path B, and drop `viem`.

The portability brief justified the `viem` half as "a declared dependency
imported nowhere in `src/`". **That is true and it is incomplete**, which is
exactly the shape CLAUDE.md rule 9 exists for. `scripts/probe.ts` imported it
and carried a complete, working Path B:

```ts
const pk = readSecret("gigaverse-private-key.txt");
if (!pk) throw new Error("No key at ~/.secrets/gigaverse-private-key.txt");
const account = privateKeyToAccount(pk as `0x${string}`);
const signature = await account.signMessage({ message });
```

So the repo shipped a script that reads a private key off disk and signs with
it. Whatever its history, that is precisely the thing that falsifies the one
sentence this project can offer someone deciding whether to run it: **it asks
for a session token, not custody of a wallet.** Deleted along with the
`AUTH_MODE=eoa` branch, and `viem` removed from `package.json`.

SPEC §1a was rewritten rather than annotated. The old text presented Path B as
"the right end state" and §1b documented its EIP-191 flow as **[CONFIRMED]** —
a confirmed-and-unfinished feature is an invitation for a later session to
helpfully complete it. The replacement states the three reasons it is gone, in
order of weight, and closes the obvious follow-up: **do not replace it with AGW
session keys either** — those are for delegated *on-chain* signing and this bot
does no on-chain work at all.

---

## §1 — the Profile seam

`src/profile.ts`. Three rules, per the brief, and the third is the one that
matters. Wired through `liveRun.ts`, `liveFishing.ts`, `orchestrator.ts` and the
new `doctor.ts`.

The brief's claim that this would be "mostly mechanical because sessions 30/31
already did the hard part" **held up exactly**. Every I/O-owning module already
took an explicit path parameter — they were parameterised so tests would stop
overwriting the real ledgers, four hundred tests ago and for an unrelated
reason. The survey found only **three real path literals in `src/`**:

```
src/api/auth.ts:12       join(homedir(), ".secrets")
src/sim/corpus.ts:16     CORPUS_DIR = "fixtures/dungeon-runs"
src/sim/fishing/deck.ts  CARD_CATALOG_PATH = "fixtures/fishing-casts/cards.json"
```

### The design points worth carrying

**`getJwt()` is a provider, not a string.** One indirection now; the alternative
is rewriting every call site the day a token needs refreshing mid-run.

**Default-unchanged is pinned with LITERALS.** `tests/profile.test.ts` asserts
`expect(p.dataRoot).toBe("data")`, never `toBe(DEFAULT_DATA_ROOT)`. A test that
compares a constant to itself passes no matter what the module later decides
that constant means, which is the exact failure it is meant to catch. Confirmed
against reality too — `liveRun.ts --status` after the refactor still reads the
author's real ledgers (12/12 runs, 20/20 casts), not an empty new file.

**Names are rejected, not sanitised.** `..`, `a/b`, `a\b`, empty, leading dash.
A name that silently becomes a different directory is how one person's spend
ledger gets written over another's.

**`config/discovered.json` is shared; `config/bot.json` is per-profile.** The
first cut made both per-profile, which the brief had explicitly warned against:
Forbidden Woods is dungeon 5 and `maxRoom` 16 **for everyone** (four dungeons,
session 57), so per-profile discovery would make each person re-run `probe.ts`
to rediscover facts that cannot differ between them. Budgets are personal and go
the other way. That split is the entire reason these are two files, and it is
now pinned by test.

**The JWT stays in `~/.secrets`, not under `profiles/`.** `profiles/` is inside
the repo and the repo is public; a token in the working tree is one `git add -A`
from being committed.

---

## The hole the seam opened, found by testing rather than by reading

`.gitignore` has `data/` and `logs/`, and gitignore patterns without a leading
slash match **at any depth** — so `profiles/alice/data/` was covered. By luck.
`profiles/alice/fixtures/` and `profiles/alice/config/` were not:

```
profiles/testfriend/data/x.json                  -> IGNORED
profiles/testfriend/fixtures/dungeon-runs/y.json -> TRACKED (would be committed)
```

The first time anyone used `--profile`, a second account's captured game states
would have been committed to a public repo. `profiles/` is now ignored, and the
test asserts it by shelling out to **real `git check-ignore`** rather than by
reading `.gitignore` — the pattern semantics are the thing under test, and
re-implementing them in the test would reproduce the same misunderstanding that
caused the bug.

---

## §2 — the safety property, and an honest complication

`tests/clientSurface.test.ts`. The client exposes 12 named endpoints: 9 reads,
`postDungeonAction`, `postFishingAction`, and `claimRomEnergy` — which moves the
account's OWN accrued energy into its OWN pool, with no recipient and no
counterparty. No sell, burn, list, transfer, or on-chain transaction exists.

The first version of the test failed, and the failure was the point:

```
- Expected                     + Received
  [ "claimRomEnergy",          + "post",
    "postDungeonAction",         "postDungeonAction",
    "postFishingAction" ]        "postFishingAction" ]
```

**`raw`, `get` and `post` are `private` in TypeScript, which is erased at
runtime.** They are on the prototype, and `post` can reach any path. The
tempting move is to filter them out and report a smaller surface; the honest one
is to list them, say in the header that the allowlist describes what the program
DOES rather than sandboxing what it COULD do, and add a separate test that no
call site outside `client.ts` touches them. Plus a grep test that nothing in
`src/` or `scripts/` imports a signing library — which is rule 3 enforced rather
than asserted.

---

## §4 — `scripts/doctor.ts`

The brief called this "the item that actually determines whether a friend gets
to a first run… most likely to be underbuilt because it feels like scaffolding."

One design note worth keeping: **token expiry is decoded from the `exp` claim
locally, not discovered by calling the API.** A network answer is strictly worse
— it needs the network up, it costs a request, and a 401 cannot distinguish
expired from malformed from revoked. No signature verification: this is a local
sanity check on the user's own token, not an authentication decision.

Verified against a real profile (all checks pass, prints the resolved account so
the user can confirm it is theirs) and a nonexistent one:

```
▸ doctor — profile "testfriend"
  ✓ Node 24.13.1
  ✓ running from the repo root
  ✗ no JWT at <HOME>/.secrets/gigaverse-jwt-testfriend.txt
      1. Log in at gigaverse.io in your browser.  … (four numbered steps)
  ✗ config problem: Missing config file: profiles/testfriend/config/bot.json
      profiles/testfriend/config/bot.json is this profile's own budget file …
        Copy the shipped one:  mkdir -p profiles/testfriend/config && cp …
  today's local ledgers … dungeon: 0 runs / 0 energy   fishing: 0 casts / 0 energy
```

Note the ledgers read **0/0**, not the default profile's 12/240 — the isolation
is real, not just the paths being different strings.

---

## Where I did LESS than the brief asked, stated plainly

The brief asked for "a source-level test that greps `src/` and `scripts/` for
`homedir(`, `"data/`, `"logs/`, `"fixtures/` outside `profile.ts` and fails on a
hit." Taken literally that fails on ~60 sites, ~25 of them in one-off analysis
and probe scripts (`reversalDispersion.ts`, `parseHar.ts`, `chargeTable.ts`,
`fishingRingCV.ts`, …) that read the author's own corpus by design and that
nobody running the bot ever invokes.

So `tests/noHardcodedPaths.test.ts` does three narrower things instead:

1. **Enforces** that `src/` grows no new path literals (allowlist of 9 files,
   each documented, each checked to still be needed so the list cannot rot).
2. **Enforces** that the four entry points resolve through the profile — and
   specifically that `guardStatePath` is passed rather than left to default,
   because leaving it undefined means two profiles silently share one spend
   ledger and each sees the other's spend. It fails safe-looking and is wrong.
3. **Inventories** the 25 remaining scripts as a ratchet, so the set cannot grow
   silently and a later session can see exactly what is left.

This is debt, recorded as debt.

---

## A session-54 test that was pinned to the wrong thing

Renaming `FISHING_GUARD_STATE_PATH` to a profile-resolved `fishingGuardPath`
broke `tests/orchestrator/dungeonArmClosed.test.ts`:

```
AssertionError: expected '/**\n * scripts/orchestrator.ts — Tas…'
  to contain 'acquireGuardLock(FISHING_GUARD_STATE_PATH)'
```

That test guards rule 11 — the orchestrator must take the fishing lock and NOT
the three dungeon locks. **The property was untouched; only the spelling
changed.** An identifier is a spelling; a file name is the thing actually
locked. Re-pinned on `guard-budget-fishing.json` / `guard-budget.json` /
`opponent-model.json` / `play-counts.json`, so the next rename does not read as
the dungeon arm reopening — and so a future reader who *does* reopen it cannot
sneak past by renaming a variable.

---

## §3/§5 — drafted, not executed

`README.md` (177 lines, written for someone with no context: the ToS warning
once and plainly, the six-step token copy, `doctor.ts` first, what it will not
do and the test that proves it) and `handoff/DISTRIBUTION.md`.

**The distribution repo was NOT created or pushed** — the brief says that is the
user's call and it involves their GitHub account. `DISTRIBUTION.md` names the
blocking item (git HISTORY carries identifiers → ship from a fresh squashed
repo, which sidesteps `filter-repo`/force-push entirely) and three decisions
only the user can make: whether `config/discovered.json` comes off `.gitignore`
(it holds nothing per-account, but removing it edits a rule-3 line), which repo
and whether public, and **a licence — there is none, and absent one nobody has
permission to use it.**

---

## Verification at the final commit

```
npx tsc --noEmit          clean
npx vitest run            60 files, 1060 passed (was 1047)
git diff --check          clean
secret scan on e74fe3e..HEAD
  0x[a-fA-F0-9]{4,} | noobId \d+ | eyJ | PRIVATE   ->  zero matches
.gitignore covers .env, .env.*, *.key, config/discovered.json, data/, logs/, profiles/
no test writes a real data path — the new tests resolve paths and read source
  text; the git check-ignore test shells out read-only
```

One commit message was amended: it claimed 1061 tests when the run showed 1060.
Small, but the whole point of pasting verification output into a commit message
is that the number is real.
