# BRIEF — session 70

## The clock and the ledger

Written **2026-08-21**. *User-verified manually, 2026-08-21:* the game ledger
reads **14 of 20 spent, 6 remaining**. The repo ledger read **15**. **The game is
right and the repo over-counts by one** (§4).

**The user spent TWO casts manually capturing the redraw action** (§1) — one for
the response, a second for the request payload. So the ledger has moved by at
least two since that count. **Read it; do not assume any number in this brief.**

`doctor.ts` is the standing first command of every session.

**This brief authorizes ZERO casts and ZERO dungeon runs.** Everything in it is
offline. The one live thing that matters this session is being done by the user,
by hand, in a browser.

*Environment, sessions 66–69: `npx tsx` and `git` both fail under the command
sandbox. Run unsandboxed. Not a repo problem.*

---

## 1. Redraw — CAPTURED AND CONFIRMED. It is `play_cards` with an empty `cards` array.

*Source: `scripts/liveFishing.ts` header and line ~2128.* `shouldRedraw` is
implemented, imported, and **evaluated every single turn** — and its firing is
written to the log as `redraw_indicated_not_sent` and then discarded.
`FishingActionSchema` is `["start_run", "play_cards", "loot",
"use_fishing_item"]`. There is no redraw action, so the client has never been
able to perform one.

**User-stated mechanic, 2026-08-21:** redraw costs **1 mana per card currently
held** (1/2/3) and **always returns 3 new cards** regardless of how many were
held.

### 1b. The response is captured. It says redraw is NOT a new action.

*Source: user-supplied DevTools capture, 2026-08-21, doc `13025041`.* The
response to the redraw call reads **`"message": "Cards played successfully."`**
and its events are `FISH_MOVED` → `CARD_PLAYED` → `FISH_HP_DIFF` → **`NEW_HAND`
with THREE cards** (`playerId: -1`).

Two things follow, and the second is why the request body still matters:

- **Redraw almost certainly runs through the existing `play_cards` action**,
  which is why no fifth action was ever found and why SPEC-fishing §7 has called
  it "genuinely uncaptured" for so long. The distinguishing signal is in the
  request's `data`, **not** in the `action` string.
- **`NEW_HAND` returning three cards is the discriminator.** In ordinary play the
  hand shrinks turn over turn (*fixture `cast-2026-08-21-20-11-01`: `[1,78,6]` →
  `[78,6]` → `[78]`*). A turn that ends with three fresh cards is the user's
  described mechanic.

**⚠ THE CAPTURE CONTAINS A WALLET ADDRESS.** The pasted doc carries
`PLAYER_CID: "0x4f03…"`. *DISTRIBUTION.md:* **no wallet addresses, no JWTs, no
private keys in any shipped doc, ever** — and this repo is being prepared for
distribution. **Strip `PLAYER_CID` and any token before this capture touches
`SPEC-fishing.md`, a fixture, a test, or a commit message.** `src/api/redact.ts`
exists for exactly this; run the capture through it rather than hand-editing.
Re-run the secret scan afterwards.

### 1c. THE REQUEST PAYLOAD — user-captured, 2026-08-21, from a manual cast

```
action:      "play_cards"
actionToken: "1787351554996"
data: { cards: [], nodeId: "", focusPoint: [2,3], itemId: 0, slotIndex: 0, tierId: 0 }
```

**`cards: []` on a `play_cards` action IS the redraw.** No fifth action, no new
endpoint, the same six-field envelope every fishing action uses. `focusPoint` is
still sent — the marker is supplied, not omitted. This is now CONFIRMED capture,
not inference, and SPEC-fishing §7's "genuinely uncaptured" paragraph can be
replaced with it.

**⚠ AND THIS IS THE DANGEROUS PART.** A redraw is **indistinguishable on the wire
from a play that failed to choose a card.** Any bug, any fallback path, any
`chooseCard` returning nothing that still serialises the envelope **sends a
redraw and burns mana** — silently, and looking exactly like a normal turn in the
log.

So the wiring must carry intent explicitly:

- Redraw is its own decision in the client, not the absence of a card. **A test
  must assert that a `play_cards` with no chosen card never serialises as
  `cards: []`** — it must throw, or fail closed, never fall through to the wire.
- Log a redraw as a redraw. `redraw_indicated_not_sent` becomes
  `redraw_sent`/`redraw_suppressed`, so the log distinguishes the two forever.
- Session 65's precedent stands on why this matters: a rejected
  `use_fishing_item` **advanced the server's action token** with no resync
  available, and the failure surfaced a full turn from its cause.

### 1a. Capturing it does NOT mean turning it on

*Source: `cardChoice.ts` §5 comment.* The one time redraw was calibrated, it was
a disaster: *"repeated redraws burning mana before a card was ever played"* —
the loss mix flipped from **89% `escaped_meter` to 78% `escaped_mana` at a mean
of 1.29 turns per cast.**

So the order is: **capture → implement the action → recalibrate
`REDRAW_THRESHOLD` in sim → shadow → then ask the user.** Wiring a mechanic whose
only calibration attempt produced 1.29-turn casts is not a small change, and the
threshold that produced it is still the shipped constant.

---

## 2. The focus-meter policy — sweep the three families, but validate the sim first

**User decision, 2026-08-21: sweep all three in sim, recommend, the user
approves.**

*Source: `src/strategy/fishing/focusBudget.ts`, session 49.* The module exists
precisely for the behaviour the user is complaining about. Its own header:
**"the first move alone spends 1.62 of 3 points"**, **"80.8% of casts escape by
meter-out"**, observed profile **3.00 → 1.38 → 0.72 → 0.36 → 0.14 → 0.04 → 0.00**.

It offers `costCap`, `threshold` and `schedule`. **`liveFishing.ts` references
none of them.** The shipped value is `{kind:"none"}`, labelled in the module's own
`describePolicy` as **"none (shipped)"**. A module written to fix this problem has
been switched off for twenty sessions.

### 2a. Before trusting the sweep — check the sim reproduces the meter profile

This is gate 1 and it is not a formality.

*Source: session 69, live-measured.* **The sim's bimodality does not reproduce
live.** All nine Relaxing `bestKillProbability` values on the entire live record
(0.400 0.481 0.505 0.506 0.580 0.587 0.690 0.964 0.975) are **strictly between 0
and 1**, where the sim says 34.3% exactly 0 and 55.8% exactly 1. That was the
evidence session 67's whole "threshold 1 is zero-parameter" argument rested on.

**The same simulator is now being asked to choose a focus-spend policy.** So
before the sweep's recommendation counts for anything, check the one thing that
makes it relevant: **does the sim's per-turn focus-spend profile match the
corpus's?** The corpus profile is quoted above and the corpus is now 124 casts —
recompute it rather than reusing session 49's number.

- If the profiles agree, the sweep is measuring the right thing. Say so and
  proceed.
- **If they diverge, the sweep is choosing a policy for a fishery that does not
  exist**, and the recommendation must be labelled that way — or the sweep should
  be run against the corpus's real trajectories instead.

### 2b. What to report

Score `costCap`, `threshold`, `schedule` and `none` on catch rate **and** on
meter-out rate — the failure mode the module was built for. Give the causal
story, not a ranking: *why* does the winner win, in the way `OIL-CONSERVE.md`
did. **Recommend; do not ship.**

The module's two invariants are already asserted and must stay: a cost-0
placement is always allowed, and a lethal placement is never blocked.

---

## 3. The oil threshold argument now rests on live, not on the sim

*Source: session 69, live-measured.* **The certainty gate has never held a
Relaxing Oil live — 0 of 9 firings on the whole record.** The exchange-rate
threshold would have held **2 of 9**.

Combined with §2a's finding, the conclusion is uncomfortable and should be
written down rather than left implied:

- **`conserve(r=1,f=1)` — the certainty gate — is a proven no-op live.** It was
  chosen because the sim's inputs are bimodal at 0 and 1. Live inputs are not.
- **The exchange-rate threshold is the only one of the two that does anything**,
  and it was derived from a measured exchange rate rather than swept.
- *Session 69:* the sim cannot distinguish the two — both give 3809 oils / 88.38%
  at n=8000 — **because it has no `bestKillProbability` mass in [0.833, 1)**. An
  aggregate over a distribution with a hole in it says nothing about the hole.

**So shadow the exchange threshold, not the certainty gate** (session 69 open
question 2). Today's shadow spends its records on the one rule now known to do
nothing. Neither ships this session.

---

## 4. Reconcile the repo ledger — the game is authoritative

*User-verified manually:* game **14**, repo **15**, after a batch of 10
`start_run`s from a shared starting point of 5. The corpus also moved +10
(114 → 124).

So the bot believes it spent ten casts and the game charged it nine. **Find the
one that was free**, or establish that it cannot be found:

- Check each of the ten `start_run`s against `dayDocs` movement individually.
- *Session 65 precedent:* a cast resumed after a token desync costs **no ledger
  entry** — no `start_run`, no energy. Session 69 reported no resumes; verify
  that rather than accepting it.
- **Whatever the cause, make the repo ledger defer to the game's.** The game's
  count is the one the server enforces, and a repo counter that drifts high will
  eventually stop a batch that had casts left — the safe direction today, the
  wrong answer tomorrow.

Do not spend casts investigating this.

---

## 5. Carried

- **Relaxing cap stays at 2 per CAST** — user-confirmed 2026-08-21, as shipped.
  No change.
- **Focus: unconstrained until stock depletes**, then stop and tell the user.
  *Live-measured session 68: Relaxing 56, Focus 19 — verify at session start, do
  not carry these forward as current.*
- **`strict.relaxingReachable` has stopped being a usable firing rate** — unmoved
  at 12 while live fired 5 times in one batch. Use shadow records instead.
- The `nextPosition` tripwire has still never met a real miss. **Do not budget
  casts for it.**
- The crit damage rule stays **OPEN at n=1**; the scoped rate (1/73 all plays,
  1/39 connecting) contains the stated 3% on both denominators. **Do not choose a
  denominator at n=1.**

### 5a. The crit source is now in doubt — resolve the gear from data, not memory

*Session 68 recorded, user-stated:* a **"Steady Lure"** is equipped, 3% crit, and
the crit rate was scoped to all of 2026-08-21 on the strength of it.

*User-stated 2026-08-21, on the two gear instances whose suffixes decode to
**10:21 PT that same day**:* they are a **Shroom Rod** and a **Sticky Lure**.

**Those two statements are in tension and the difference moves the denominator.**
If the crit-bearing lure went on at 10:21 PT, every Aug-21 play before 10:21 had
no lure and is diluting session 69's rate. And a **Shroom Rod** is a gear class
nothing in the model accounts for at all.

*Source: the same capture.* `GEAR_CID_array` entries carry equip timestamps in
their suffixes — `#811_1787332895` and `#952_1787332903` both decode to
2026-08-21 10:21 PT; `#951_1787254688` to 2026-08-20 12:38 PT; others back to
2025.

**So date the crit source from data:** resolve the gear ids against
`/offchain/static` (which names each item), identify which instance is the
crit-bearing lure, and **rescope the crit rate to plays after that equip
timestamp.** Report the new denominator alongside session 69's so the change is
visible rather than silent.

Rule 9 applies to a user-stated claim exactly as it applies to a brief's — session
63 already caught one user-stated inventory that the live read contradicted. This
is not a challenge to the user; it is that gear ids and timestamps are sitting in
the capture and are cheaper to read than to remember.
- Standing: never report energy as a blocker; `--dry-run` before claiming a
  blocker; do not revert rule 8; do not loosen the `fakeDoc` observability guard;
  §19, rule 8 and corrode-in-`dungeonSim` are CLOSED; `boonCapture` settled OFF;
  distribution steps 3/4/6 remain the user's.

---

## 6. Gate

Both halves are offline and deterministic.

1. **The sim's per-turn focus-spend profile is computed against the 124-cast
   corpus's and the comparison is reported**, with the sweep's recommendation
   explicitly labelled as trustworthy or not on the strength of it. A sweep
   reported without this comparison does not meet the gate.
2. **The repo ledger reconciles with the game's**, with either the cause of the
   off-by-one identified or the repo made to defer — and a test that fails if the
   repo counter can exceed the game's.

---

## 7. Do not

- **Do not cast, and do not run a dungeon run.**
- **Do not enable redraw** — wire it, guard it, recalibrate first (§1a).
- **Do not let a card-less play serialise as `cards: []`** — that is a redraw on
  the wire and it spends mana (§1c).
- **Do not commit `PLAYER_CID`, a JWT, or any address from the capture.** Run it
  through `src/api/redact.ts` and re-run the secret scan.
- Do not restate "Steady Lure" as the crit source until the gear ids resolve it
  (§5a).
- **Do not ship any focus policy, the certainty gate, or the exchange
  threshold.** Recommend and shadow.
- Do not report the sweep's winner without §2a's comparison.
- Do not quote the sim's ±0.01pp CIs as decision intervals, and do not present a
  sim aggregate as evidence about a region the sim has no mass in (§3).
- Do not carry a stock or ledger number forward as current — read it.
- Do not put identifiers in a test that guards against identifiers, and do not
  give a new I/O-owning test construction a real data path.

---

## 8. Corrections to me — two errors, and they are the same error

- **I told the user there is no mana pool. `mana` is `doc.data.playerHp`**
  (`liveFishing.ts:1857`, `:1894`, `:2078`). Their original reading — "3–4 spent,
  6–7 left" — was **exactly right**, and my correction was the mistake. I also
  said misses cost `playerHp`; they do not. **Playing a card costs 1 mana**
  (`manaCost: 1` on every card), which is why it fell 10 → 9 → 8 across three
  plays. Missing separately heals the fish.
- **How I got there matters more than the fact.** I searched the server's raw doc
  for a field named `mana`, did not find one, and concluded the *concept* did not
  exist — without searching the code that consumes the doc, where the mapping
  lives one layer up. **An absent field name is not an absent mechanic.** And I
  said it with confidence to the person who plays the game, who then had to
  correct me from knowledge I could have read off line 1857.
- **The second error is the same shape at a different layer.** Last brief I wrote
  that the probabilistic band covers "~9.9% of firing moments", from the sim's
  bimodality. Session 69 measured the live record: **every Relaxing firing sits
  strictly between 0 and 1.** The band is not a tenth of firings live — it is all
  of them.
- **Both are trusting a representation over the thing it represents** — a schema
  over the code that reads it, a simulator over the server it models. The repo's
  rule 1 is "discover, don't assume", and its rule 9 says a brief's claims are
  hypotheses. **I have been applying both to the agent's claims and not to my
  own.** The check that would have caught each is the same and it is cheap: before
  asserting a mechanic is absent, grep the consumer, not just the producer.

---

## Your task (session 70)

1. `doctor.ts` first; read both ledgers and report them. **No casts.**
2. **§1** — wire redraw from the CONFIRMED payload (`play_cards`, `cards: []`),
   with the intent guard and the never-serialise-empty test. **Scrub `PLAYER_CID`
   from the capture before it touches the repo. Do not enable redraw** —
   recalibrate `REDRAW_THRESHOLD` first (§1a).
3. **§2 / gate 1** — recompute the corpus focus-spend profile, compare the sim's
   to it, and report the comparison **before** the sweep's recommendation.
4. **§2b** — sweep `costCap`, `threshold`, `schedule`, `none` on catch rate and
   meter-out rate, with the causal story. Recommend; do not ship.
5. **§3** — record that the certainty gate is a live no-op, and move the shadow
   onto the exchange threshold.
6. **§4 / gate 2** — reconcile the ledgers; make the repo defer to the game.
7. **§5a** — resolve the gear ids against `/offchain/static`, identify the
   crit-bearing lure, and rescope the crit rate to plays after its equip
   timestamp. Report both denominators.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   **final** commit, no test writes a real data path, secret scan before handoff.

**Honest expectation.** This session's real finding may be gate 1 rather than the
sweep it guards. Three separate times now — the oil gate's bimodality, the
`conserve` no-op, and the meter profile about to be checked — **the simulator has
described a fishery the server does not run.** If §2a shows the meter profile
diverges too, then the honest conclusion is not "pick a different focus policy"
but that **sim-selected policy is not currently a reliable instrument**, and the
corpus's own trajectories should be scoring these decisions instead. That would
be a larger and more useful result than a winner from a sweep nobody can trust.
