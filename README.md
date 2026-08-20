# Gigaverse autoplay bot

A bot that plays two things in [Gigaverse](https://gigaverse.io) on your behalf:
the **Forbidden Woods** dungeon (a rock-paper-scissors combat roguelite) and
**Dendren fishing**. It reads the game's own API, decides moves with a strategy
engine tuned against thousands of recorded real states, and stops when it is
told to. It runs on your machine, under your account, with your token.

---

## Read this part before anything else

**Automation is allowed here.** Gigaverse permits bots explicitly — the team
publishes its own repo of agentic skills for running accounts autonomously — so
this is not a tool that works by not being noticed, and there is no ban risk to
weigh up. An earlier draft of this file carried a terms-of-service warning. It
was wrong: it assumed the usual stance of the usual game rather than checking
this one's, and it is deleted rather than softened.

What is worth reading before anything else is the next two paragraphs, which are
about what the bot can and cannot reach.

**What this bot cannot do to your account.** It never sells, burns, lists,
transfers, or sends an on-chain transaction. It has no code to do any of those
things, and that is enforced rather than promised: `tests/clientSurface.test.ts`
enumerates every method the API client exposes and **fails the build** if one is
added. The worst it can do is play the game badly and claim your own ROM energy
into your own pool.

**It asks for a session token, not custody of a wallet.** There is no private
key anywhere in this project. The account is an Abstract Global Wallet, which
does not expose one, and nothing here signs anything — the `viem` dependency
that once existed for a key-based login was deleted along with the login. The
token you paste in is the same credential your browser is already using, and it
expires on its own in about a day.

---

## Setup

### 1. Requirements

Node 20 or newer, and a Gigaverse account you already play.

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 2. Get your token

1. Log in at [gigaverse.io](https://gigaverse.io) in your browser.
2. Open DevTools → **Network**.
3. Play one action in the game so a request fires.
4. Click any request to `gigaverse.io/api` and find the request header
   `Authorization: Bearer <token>`.
5. Copy **only the `<token>` part** — not the word `Bearer`, not the whole line.
6. Save it to `~/.secrets/gigaverse-jwt.txt`.

**It will expire, probably tomorrow.** That is normal and not a bug. When it
does, every command here stops with a "token expired" message and you repeat
these six steps. `doctor` tells you how long you have left.

### 3. Check everything before you run anything

```bash
npx tsx scripts/doctor.ts
```

This is the one command worth running first. It checks your Node version, that
your token exists, parses, and has not expired (locally — it does not have to
call the API to find out), that your config is valid, and then makes exactly one
authenticated request so it can print **which account you just authenticated
as**. Confirm that is you before going further. Every failure it reports comes
with what to do about it.

### 4. Set your budgets

`config/bot.json` holds the numbers you choose. The defaults are the author's:

```json
"forbiddenWoods": { "dailyEnergyBudget": 240, "maxRunsPerSession": 12 },
"dendren":        { "dailyEnergyBudget": 240, "maxCastsPerSession": 20 }
```

240 energy is **4 juiced dungeon runs a day** at 60 energy each. 240 fishing
energy is 20 casts at 12 each. Both are policy ceilings this bot imposes on
itself, layered on top of the game's own daily caps, which reset at **11:00
Pacific**. The game's caps win regardless of what you put here.

---

## Running it

**One dungeon run**, juiced at tier 3 with three Big Heal Juices:

```bash
npx tsx scripts/liveRun.ts --juiced --juiced-index=3 --runs=1
```

It plays one run and **stops**. It does not start another. That is deliberate:
you allocate skill points between runs, and the bot never does that for you
because it is irreversible. When you want another run, you type the command
again.

**Fishing:**

```bash
npx tsx scripts/liveFishing.ts --casts=1
```

**See where you stand without spending anything:**

```bash
npx tsx scripts/liveRun.ts --status
npx tsx scripts/liveRun.ts --dry-run --juiced --juiced-index=3 --runs=1
```

`--dry-run` runs every guard and decision path and sends no action. If you are
ever unsure whether something will work, run this — it is free and it exercises
the real checks.

---

## Running more than one account

Everything above uses the default profile. To keep a second account entirely
separate:

```bash
npx tsx scripts/doctor.ts  --profile=alice
npx tsx scripts/liveRun.ts --profile=alice --juiced --juiced-index=3 --runs=1
```

That profile reads `~/.secrets/gigaverse-jwt-alice.txt` and keeps its ledgers,
logs and captures under `profiles/alice/`. Omitting `--profile` is byte-for-byte
the original behaviour, so adding profiles cannot disturb a setup that already
works.

---

## When something goes wrong

The bot **fails closed**. On an unknown response, three consecutive action
failures, a daily cap, or anything it does not recognise, it stops and exits
non-zero rather than guessing a move. A stopped bot costs nothing; a confused
one costs energy and items. If it stops, the reason is on stdout and the full
response body is in `logs/`.

Run `npx tsx scripts/doctor.ts` first for anything that looks like a setup
problem. It is right more often than guessing.

---

## What's in here

| Path | What it is |
|---|---|
| `scripts/doctor.ts` | preflight — run this first |
| `scripts/liveRun.ts` | the dungeon loop |
| `scripts/liveFishing.ts` | the fishing loop |
| `src/api/` | the API client. No game logic |
| `src/strategy/` | pure decision functions. No network |
| `src/sim/` | the simulator and the recorded corpus it replays |
| `config/bot.json` | your budgets |
| `config/discovered.json` | the game's own IDs and endpoints. Shared, not yours — you do not need to run `probe.ts` |
| `fixtures/` | thousands of redacted real game states the sim learns from |
| `SPEC.md` | what the API actually does, verified against live responses |
| `CLAUDE.md` | the rules this project is built under, and why each exists |

`SPEC.md` and `CLAUDE.md` are worth reading if you want to extend it. `CLAUDE.md`
in particular explains why the odd-looking rules are there — most of them are
scar tissue from a specific incident.

---

## Not planned

No web UI, no hosted service, no dashboard, no one else holding your token.
This is a program you run yourself. If it ever grows a server, the safety
sentence at the top stops being true, and that sentence is the point.

---

## Licence

MIT — see [`LICENSE`](LICENSE). Use it, change it, pass it on.
