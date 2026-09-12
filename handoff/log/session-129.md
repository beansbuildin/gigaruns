# session 129 — 2026-09-12 — a Crusader day, the Puppeteer swap, and `blockedMove` answered

**GATE PASS.** Full live day spent (12/12 run-units), both arms run to their
pre-registered halts, suite left GREEN at 2674/2674.

---

## 0. The JWT, which the brief said would bind before the day did — it did

`doctor.ts` at 14:59Z: token valid **1.7h** (≈16:45Z); game day 20707 closed at
18:00Z, `next day in 02:59:56`. So the usable window was ~1h45m, not 3h.

**Both live arms finished by 15:31Z — about 74 minutes inside the token.** The
constraint was real and was never approached. Recorded because two earlier
sessions failed to record it at all.

## 1. Claims A–E

| # | Claim | Result |
|---|---|---|
| A | day / dow / faction | **PASS** — 20707, dow 1, Crusader (135), off the clock |
| B | rings total 171 | **PASS exactly** — 9/12/18/27/30/33/42 |
| C | run-units 0 of 12 | **PASS** — `dayProgressEntities: null` |
| D | fishing 0/20 charged | **PASS** — both ledgers agree at 0 |
| E | gear | **read live; the brief deliberately did not assert it** |

**Claim E is the interesting one.** The brief broke a four-session pattern by
*inverting* the instruction — "read `checkGear.ts` FIRST, then raise a repair
only if the live numbers call for one" — instead of opening with a repair
request. It was right to: **640 and 905 had been repaired out of band**
(0 → 60 and 0 → 24), so the dungeon arm was not halted and there was nothing to
raise. Three of the six rows in its orientation table were stale. **That
inversion should be kept.**

Also found at this read: **slot 14 already held 924** — the user had equipped
the Puppeteer rod out of band, at durability 44. Step 1 of the swap was done
before the session started.

## 2. Pre-registration

Two commits, each before its own spend — ninth session running.

- **`09c8bc37`** — the dungeon arm. Day/dow/faction; Crusader 27 → 15 at −3/run
  as sole mover; the gear table run by run with **the break predicted at run 4
  on 901**; charge shape 45/45 → 49/49.
- **`bf31c692`** — the fishing arm, written after the dungeon arm closed and
  before the first cast. `castCap` 17 and *why that number*; the per-play drift
  computed off the fixture; the slot-15 halt at cast 17.

## 3. The dungeon day — 4 runs, 0/254 failures

| run | actions | first-attempt failures |
|---|---|---|
| 1 | 39 | 0 |
| 2 | 63 | 0 |
| 3 | 62 | 0 |
| 4 | 90 | 0 |
| **total** | **254** | **0 = 0.00%** |

15:03:35Z → 15:17:13Z. Server ledger `dayProgressEntities` **12**.

**Every forecast landed exactly, at all four readings.**

```
rings    Crusader 27 -> 24 -> 21 -> 18 -> 15     sole mover, six untouched, all 4 reads
gear     640  60 -> 57 -> 54 -> 51 -> 48
         641  36 -> 33 -> 30 -> 27 -> 24
         901  12 ->  9 ->  6 ->  3 ->  0   <-- BREAK, predicted at run 4
         905  24 -> 21 -> 18 -> 15 -> 12
```

The break coincided with the 12-unit cap, so the arm halt cost nothing.
Charge shape now **49/49**.

`energy accounting drift` printed on all four runs (committed 60, observed 59).
Expected: in-run passive regen at 18/hr credits part of the charge back. Not a
finding.

## 4. The Puppeteer (924) swap

**The repoint had to come BEFORE the batch**, which the brief got right for a
reason it did not state: `readRodDurability` defaults to `CURRENT_ROD`, so
leaving it at 923 fails the preflight closed with *"rod 923 is NOT equipped"*
and no cast can be played at all.

⚠ **The brief's `rodDeck.test.ts` prediction was backwards.** It said the test
would be "red until the repoint lands". The test keys on the rod in the latest
recorded CAST, so the repoint is what reddens it and the first Puppeteer cast
is what heals it. The red window existed between commit `bf31c692` and the
first cast; the suite was never run inside it.

`tests/fishing/rodDurability.test.ts` was restructured rather than re-pinned:
the historical Dendren reading now passes its rod id **explicitly** (it had
been asserting `rodItemId === CURRENT_ROD`, a claim about *today* that a
2026-09-05 fixture cannot make), and a new Puppeteer case covers the default
path. This is the same treatment Golkan got when Dendren became current.

### The per-play drift, verified rather than accepted (rule 9)

E[fish-HP delta per play] at random aim, over each rod's ten cards:

| deck | cards in fixture | computed | brief said |
|---|---|---|---|
| Dendren (923) | 10/10 | **−0.300** | −0.300 ✅ |
| **Puppeteer (924)** | 10/10 | **−0.678** | −0.678 ✅ |
| Golkan (812) | **8/10** | −0.389 | −0.400 ❌ |

⚠ **Golkan does not reproduce, and the fixture is why** — cards 82 and 83 are
absent from `fixtures/fishing-casts/cards.json`. Any Golkan comparison rests on
an incomplete deck. The Puppeteer conclusion does not depend on it.

Card values confirmed off the fixture: 3-zone 8, [1,3,7,9] 10, [2,4,6,8] 11,
ring 6/−5, centre crit 16/−4.

## 5. The fishing batch

`castCap: 17`, and the reasoning is the point — three candidate caps, smallest
binds:

| cap | value | binds? |
|---|---|---|
| rod 924 durability | 44 | no |
| game ledger `dayDocs[2]` | 20 charged | no |
| standing budget | 30 casts | no |
| **slot-15 gear halt** | **17** | **YES** |

Result: **17 played / 14 charged**, clean `cast_cap` exit, rod **44 → 27** =
exactly −1.00 per played cast, slot-15 pair **27/17 → 10/0**. The halt fired at
the number the cap was sized to. 2 Relaxing oils consumed inside the
`dendren.oils` budget (22 → 20); Focus remains off the allowlist and logged
`policy-withdrawn` on every trigger.

**Catch rate, FOURTH slice: Puppeteer 7/17 = 41.2%** (7 caught, 10 escaped).
n = 17. ⛔ Not pooled into Dendren's 54/104.

The dungeon pieces did not move across the batch — the two wear sets are
disjoint, confirmed a fifth time.

## 6. `blockedMove` — three sessions of deferral, answered offline

DECISIONS 2026-09-08 left it unwired on *"unsettled whether the exclusion
applies to the current exchange or only the next"*. That is now measured.

```
CURRENT exchange   6/20 hits   6.67 expected   one-sided p = 0.48    -> chance
NEXT exchange      2/20 hits   6.67 expected   one-sided p = 0.018   -> real
```

**The null is measured, not assumed** — the enemy's own distribution over all
**5067** corpus exchanges is paper 33.7% / rock 33.1% / scissor 33.2%, flat to
within a percent. Had the enemy been skewed, the CURRENT result is the one that
would have been at risk.

⛔ **So the wiring every brief since session 125 has proposed is falsified.** A
hard exclusion assigns probability ZERO to an event this corpus contains
**twice**. Shipping it would make the model confidently wrong about ~10% of
post-proc exchanges — strictly worse than ignoring the field, because a
three-way distribution over a slightly-wrong prior degrades gracefully and a
zero does not.

What it *is*: a soft prior, ~3.3x depression on the next exchange. Fitting that
needs a magnitude and n=20 does not support one — the 95% interval on 2/20
still touches the base rate. **Collect, then fit.** 20 procs in 145 runs.

**Two traps worth the words:**

- **An exchange is a capture carrying a `use_move` event.** Every such capture
  is followed by a duplicate with no events. A first pass read consecutive
  captures as consecutive exchanges and got an **identical 6/20 for both**
  current and next — which looks like a null result and hides the entire
  finding.
- **`loadCorpus()` cannot answer this at all.** `CorpusState` keeps `data.run`
  and drops `data.events`, so `intuition_block` is invisible through it.
  `src/sim/blockedMove.ts` walks the raw captures deliberately.

## 7. Three findings that are NOT pins

### `Vengeance` amplifies

`tests/statusEffects.test.ts`'s "Vulnerable at 0 is inert" went 19/21. Both
offenders: **`atk 26 → taken 32`, delta +6**, attacker carrying
`beforeStatus.Vengeance = 25`. One a TIE (rock/rock), one NOT (rock/scissor) —
so the trigger is not ties and it is not `TieDamageReduction`, which *reduces*
by 2 on ties only.

`BOON_MODELS.Vengeance` is `latent` on its PICKUP evidence and **stays that
way** — [USER] 2026-09-12 confirmed the hold. What changed is `inertAtZero`'s
exclusion: a Vengeance attacker is not a clean reading of "damage == ATK". That
is the **fifth** completion of that filter family, not a relaxation.

⚠ The guard first landed in the wrong function — the same
`beforeStatus[other]` line exists twice in `scripts/statusEffects.ts`. Caught
because the test stayed red.

### `hpMax` 51 → 50 and Sword ATK 27 → 26, together

Read off every unbooned `state-000`:

```
2026-09-11 (session 128, all 4 runs)   hp 51  arm 17  rock 27/10  paper 11/17  scissor 12/8
2026-09-12 (session 129, all 4 runs)   hp 50  arm 17  rock 26/10  paper 11/17  scissor 12/8
```

Armor, Paper and Scissor unmoved. **The one equipment IDENTITY change between
the two readings is the rod swap 923 → 924.** Every other equipped piece is the
same instance (docIds identical) and every dungeon piece was alive at both
openings — 640/641/901/905 at 60/36/12/24 today against 3/36/12/15 the day
before. Item 50 (slot 8) read 0 on both days.

⛔ **Coincident, not proven.** Two readings a day apart cannot separate the rod
from a skill point or an unobserved change, and nothing in the capture
distinguishes gear from level. It is recorded because it is **cheap to
falsify**: swap back to 923 and read the opening. If the rod is the cause, the
fishing rod carries a dungeon stat line and every rod swap is a combat
decision.

Both constants updated to the live values — which is what the test demands
("uses the live values, not the class base"). Note `hpMax: 50` also agrees with
the standing [USER] statement that it holds at 50.

### `redrawTrigger`'s turn-count separation was deck-dependent

`expect(a.turnsPerCast).toBeLessThan(n.turnsPerCast)` broke at 4 vs 3.877. The
always-redraw arm is 4 on *every* deck because that is a **mana ceiling** — 10
mana at 3/turn — not a behaviour. What moved is the other arm: Puppeteer kills
fish fast enough that never-redraw finishes in 3.88 turns where Dendren took
longer than 4. The inequality flipped with the redraw mechanism unchanged.

Retired, with `escapedMana` — the separation the test exists for — untouched.
Same treatment session 123 gave `toBe(1)`.

## 8. The pin pass — five rounds, ~90 sites

Corpus growth: 141 → 145 dungeon attempts, 537 → 554 fishing casts,
`OBSERVED_OFFERS` 750 → 780 (the 30 new offers transcribed by script and
verified additive).

Two documented traps re-walked and **both held**:

- **Ratio expectations** (`912 / 1248` → `929 / 1274`, `993 / 1248` →
  `1010 / 1274`, `37 / 167` → `38 / 172`) were hand-fixed, both halves. The
  automated patcher refused them by design.
- **No `/* was */` was nested.** Anchoring on the matcher call rather than on
  the bare literal is what kept the patcher off the value living inside the
  historical comment on the same line.

**A third trap was found in-session**, and it is new: a patcher that walks
forward to the next `);` to find a multi-line assertion will **annotate
assertions it never changed**. Sixteen `/* [session 129] was ... */` comments
landed on neighbouring lines whose values were byte-identical to their
pre-image, and one histogram was mis-mapped positionally (`[3,3]` → `[4,3]`
where the truth was `[3,4]`). Swept by diffing added annotations against the
removed lines and stripping any whose line was otherwise unchanged.

## 9. Housekeeping

- The `ask` block in `.claude/settings.local.json` is still present. It blocked
  nothing this session. Only the user can remove it.
- `$TMPDIR` differs between sandbox modes — cost cycles a **sixth** consecutive
  session, on the very first suite capture. The scratchpad path works.
- `data.nextPosition` / `data.nextMovePath` are still dumped as UNKNOWN FIELDS
  on every fishing turn (8 dumps today; dumps exist from 2026-09-08 on). The
  bot **actively uses** `nextPosition` — its override reports 62/62 hits — so a
  field the strategy depends on has been flagged unknown for five sessions.
  Registry gap, not a rule-5 condition.

## 10. Gates

```
npx vitest run --maxWorkers=4      Tests  2674 passed (2674)   exit 0
npx tsc --noEmit                                               exit 0
git diff --check                                               exit 0
npx vitest run tests/discoveredShipsClean.test.ts   8 passed   exit 0

npx tsx scripts/secretScan.ts
> secret scan — scope: tracked
  files scanned:        17773
  CONTROL A (read):     17367 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples
> PASS — no unexplained hits, both controls healthy.

npx tsx scripts/secretScan.ts --scope=diff --ref=3b3d9e9f
  files scanned:        646
> PASS — no unexplained hits, both controls healthy.
```

No `raw/` or `.har` path entered the commit. 14 allowlisted hits, all
pre-existing.

## 11. Closing state — BOTH ARMS HALTED

```
dungeon   640 48   641 24   901 0 <-- HALT   905 12
fishing   rod 924 27          slot-15  10 / 0 <-- HALT
rings     Athena 9  Archon 12  Crusader 15  Chobo 18
          Summoner 30  Foxglove 33  Overseer 42   = 159
```

**Both arms need a manual repair before the next session's live work.**
