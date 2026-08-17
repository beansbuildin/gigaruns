# BRIEF — session 22

Session 21 delivered all four required items cleanly, including one good
null result (redraw threshold sweep confirms the current default is already
optimal — nothing to change). Also corrected a stale baseline figure that's
been floating in TASKS.md since session 8: the sim catch-rate number to cite
going forward is **~70%**, not 92.4%/19.0% — those predate the `focusMeter`
modelling fix. Use ~70% in any future brief.

Fishing's live-cast levers are largely exhausted for the moment; ROM
enumeration is where the real remaining upside is. Pivot accordingly.

---

## 1. Redraw threshold — CLOSED, no further sim work here

Interior optimum confirmed at the current default (threshold 0, 70.7% ±
2.0%, curve rises from "never redraw" and collapses past 1). Don't re-run
this; it's settled the same way the potion threshold sweep settled.

## 2. Today's fishing budget is nearly spent — don't force more casts

15/20 casts, 180/240 energy used today (UTC-keyed). 5 casts / 60 energy of
headroom left. If it's convenient, spend the remainder; don't burn session
time forcing volume against a budget that's almost at its own daily ceiling
regardless — `mineFishPatterns.ts` volume is a multi-session compounding
game, not a one-session sprint.

## 3. ROM enumeration — CONFIRMED, this is the session's real spine now

The user provided the ROMULATOR panel's request URL directly:
`GET https://gigaverse.io/api/roms/player?id=<wallet address>`. This
unblocks the thing flagged as the project's single biggest unrealized
number for two sessions running — lifetime ROM income is only +38 energy
across 5 successful claims against a stockpile last snapshotted at ~3,252
(session 20, stale — it only grows) across 37 owned ROMs, and only 4 of
those 37 were ever known before now.

**Redaction note, same discipline as every other fixture in this project:**
the URL's `id` query param IS the real wallet address in plaintext. Treat it
exactly like the JWT/address redaction already applied throughout
`fixtures/` — do not commit the real address into any tracked file
(`SPEC.md`, `TASKS.md`, etc.). Use a placeholder (`<WALLET_ADDRESS>` or the
existing `0xUSER` convention) in anything that isn't gitignored.
`config/discovered.json` is gitignored, so the real value can live there.

**This session's actual priority, ahead of `chooseNewCard`:**

1. Probe `GET /roms/player?id=<address>` read-only, confirm the response
   shape (per-ROM `energyCollectable`, presumably matching the fields
   already inferred from the ROMULATOR panel's rendered numbers).
2. Confirm all 37 ROM IDs and their current claimable amounts.
3. Extend `scripts/claimRoms.ts` (or build a successor) to claim from the
   full list, ranked by `energyCollectable` descending, rather than the
   hardcoded known-4. Overflow is already confirmed non-wasting, so no
   cap-aware batching logic is needed — same simplification as before, just
   applied to the real full list instead of 4 IDs.
4. Live-verify against a handful of the newly-discovered ROMs before
   assuming the pattern holds across all 37.

This is bigger than `chooseNewCard` in expected value — do this first.
Fall through to §4 (`chooseNewCard` scoping) only if session time remains.

## 4. `chooseNewCard` heuristic — good candidate for this session's real work

Fishing's other live levers are either closed (redraw) or budget-capped
(casts) or blocked on the user (ROM enumeration) — this is the one piece of
fishing strategy that's genuinely gated on design work, not on the user or
on more live volume, and it's been correctly deferred for three sessions
running (15, 17, 21) specifically because nobody had session time to scope
it properly. This session does.

**Scope it before writing code, per the last three briefs' own instruction:**

- What is `chooseNewCard` actually optimizing for right now? Argmax
  hit-power/mana on each of the 3 offered cards, in isolation — no model of
  how a card fits the *existing* deck (grid coverage, redundancy with cards
  already held, mana curve).
- What would a deck-composition sim need to judge alternatives? At minimum:
  a representation of the current 10-13 card deck (real data exists — the
  live `fullDeck` growth from session 18's catches is real, not synthetic),
  and a way to score a hypothetical addition against it in `castSim.ts` runs
  rather than in isolation.
- Real validation data is thin — 25 real casts, 1 new card choice actually
  observed live (the catch this session). Scope what's sim-only vs. what
  needs more live catches before it can be checked against reality, same
  honesty as the redraw sweep's own reporting.
- This is genuinely new scope, not covered by Task 8's existing gate (which
  is about in-cast card play, not post-catch deck building). If it's worth
  doing, give it its own TASKS.md entry with its own gate, per house
  convention (see how Task 12 was restored) — don't fold it into Task 8's
  already-met gate retroactively.

**Only write code after scoping is written down.** If scoping reveals this
needs more real catches before a sim comparison would mean anything, say so
plainly and stop there — that's a legitimate outcome, not a failure to
finish.

## 5. Task 10 — unchanged, still outside any session's control

Still the single concrete blocker on the project's stated overall goal.
Nothing code-side stands in the way. Keep flagging it in the recap.

---

## Your task

1. Confirm `GET /roms/player?id=<address>` read-only, document it (redacted)
   in SPEC.md, and enumerate all 37 ROMs with current `energyCollectable`.
2. Extend ROM claiming to the full list, ranked by claimable amount; live-
   verify against a handful before assuming it holds across all 37.
3. Spend remaining fishing budget if convenient (5 casts / 60 energy); not
   worth forcing.
4. Only if time remains: scope `chooseNewCard`'s replacement design (§4) and
   write it down before any implementation code.
5. Recap: flag Task 10's 8h run plainly again, and use ~70% (not
   92.4%/19.0%) if citing the fishing sim baseline anywhere.
