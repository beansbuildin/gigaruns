# BRIEF — session 93 — go relaxing-oil-only, land §33 (option b) and the boons.test.ts pin, then run the third live fishing batch (10 casts)

**Three small, independent landings, then one live batch.** None of §1–§3
depends on the others, and none of them touches live decision logic in a way
the batch needs to precede — land all three first anyway, so the batch's
corpus and its ledger both reflect the corrected state before new casts join
them.

**Where this came from.** Session 92's STATE.md was walked through with the
user in chat, along with a separate correction: the user had already directed
that Focus Oil be dropped from the live policy (stock has read 0 for four
consecutive batches with no replenishment in sight) and this had **not**
landed anywhere in the repo — not `config/bot.json`, not `OIL-POLICY.md`, not
`QUESTIONS.md`/`DECISIONS.md`. That gap is §1. Session 92 also left three
open items worded as needing a ruling (§33, `boons.test.ts`, the redraw-shadow
puzzle); the user was walked through all three and ruled on each — §2, §3,
and §4c below record those choices as decisions made among options offered,
the same convention §29/§31/§32 used, not as spontaneous language.

---

## 0. Verification and rule 9

```
npx tsc --noEmit
npx vitest run
```

**Establish the actual current baseline yourself.** Session 92's own STATE.md
(its own final recap, not a paraphrase) reads 1 failed / 1749 passed (1750
total) at commit `9ec24567`. Cite that as the last *known* reading, not this
session's baseline.

**Files actually read this pass, precisely:** `handoff/STATE.md` (session 92,
in full); `handoff/next.md` (session 92's brief — this brief's predecessor —
in full); `QUESTIONS.md` §§32 UPDATE/33/33 UPDATE/34 (in full); `handoff/log/session-92.md`
(grepped for any existing record of a relaxing-only directive — **none
found**); `handoff/OIL-POLICY.md` (in full, all 240 lines); `config/bot.json`'s
`dendren.oils` block (in full: `allowedItemIds: [942, 937]`, `maxPerCast: 3`,
`policyApproved: true`, `perItemMaxPerCast: {"937": 2}` — unchanged since
before session 91); `src/strategy/fishing/oilPolicy.ts` (grepped: `mayConsumeOil`
rejects on `!allowedItemIds.includes(ctx.itemId)`, line ~251 — this is the
mechanism §1 relies on); `tests/fishing/oilPolicy.test.ts`, `oilPerItemCap.test.ts`,
`oilStockExhaustion.test.ts` (grepped for hardcoded `942`/Focus references —
`oilPolicy.test.ts` line 92 builds its own local `APPROVED` fixture with
`allowedItemIds: [937, 942]`; it does not read `config/bot.json`, so it is
**not** automatically affected by §1, but confirm this pass rather than assume
it); `tests/boons.test.ts` (grepped: the `OBSERVED_OFFERS` staleness is a pin
against `Math.max(...OBSERVED_OFFERS.map(o => o.room))` plus an exact-match
assertion against the fixtures, lines ~117-149 — not read end to end).

**Not opened this pass — verify before relying on them:** the full body of
`scripts/liveFishing.ts` (still 180KB+ — confirm how it decides *which* oil
triggers to even evaluate per turn, i.e. whether `allowedItemIds` gates
evaluation or only the final POST attempt, before writing §1's docblock note
about what changes observably); `src/sim/fishing/castEra.ts`'s and
`scripts/damageEconomy.ts`'s full bodies beyond the `oilsConsumed` call site
(§2 only needs the one call site repointed, but confirm nothing else reads the
same blind path); every consumer of `OBSERVED_OFFERS` and `boonPickups`
besides `tests/boons.test.ts` itself.

---

## 1. Relaxing-oil-only, by user directive — config, docs, and the record

**The choice, restated plainly:** stop attempting Focus Oil (942) in live
play. Relaxing Oil (937) is the only oil the bot spends going forward. This is
a full policy-and-code landing, not documentation-only — the user chose that
explicitly over a docs-only note, given `mayConsumeOil`'s existing fail-closed
behavior already made a docs-only change tempting but incomplete.

### 1a. What to change, precisely

1. **`config/bot.json`**: remove `942` from `dendren.oils.allowedItemIds`,
   leaving `[937]`. Leave `maxPerCast` (3) and `perItemMaxPerCast` (`{"937":
   2}`) untouched — neither references Focus Oil. `mayConsumeOil` already
   rejects on `!allowedItemIds.includes(ctx.itemId)` (`src/strategy/fishing/oilPolicy.ts`
   ~line 251), so this one-line config change is what actually stops the bot
   from attempting 942 — confirm the exact rejection path fires as expected
   (a quick unit check or a `--dry-run` read of the code path, not a live
   spend) before treating this as done.
2. **Confirm what observably changes.** Today, Focus Oil already fails closed
   harmlessly when stock is 0 (an `oil_trigger_no_stock` event, no live
   effect). After this change, the failure mode moves from "no stock" to
   "not an allowed item" — functionally similar today, but it also means the
   bot will **stop attempting Focus Oil even if stock is ever replenished**,
   which is the actual point of a policy change versus a stock-exhaustion
   artifact. State this distinction explicitly in the recap; it's the reason
   this is a real decision and not a no-op.
3. **`handoff/OIL-POLICY.md`**: add a new dated section (don't rewrite §2's
   history — append, the way §0a was appended as a suspension rather than an
   edit) recording that the Focus Oil half of the `on-demand` recommendation
   is now **withdrawn by user directive**, not merely unsupported. Say plainly
   what this costs: §2's own decomposition attributes **+17.74pp of the
   +19.40pp effect** (itself SUSPENDED under §0a, so don't quote it as a live
   forecast either way) to `focus-when-empty-only`; going relaxing-only keeps
   only the lethal trigger's modeled +4.47pp share. Cite this as what the
   *model* attributed, not a live prediction — §0a's suspension still stands
   and nothing here lifts it.
4. **Record the directive**: a new dated entry in `QUESTIONS.md` (append,
   don't edit existing entries) quoting the user's directive and this
   session's implementation, plus the matching entry in `DECISIONS.md`.

### 1b. What NOT to touch

- Don't touch `MID_FOCUS_OIL_ITEM_ID` or any other Focus-Oil-referencing
  constant in `src/strategy/fishing/oilPolicy.ts` — the constant still names a
  real item and other code/tests may reason about it independent of whether
  it's currently allowed.
- Don't touch `tests/fishing/oilPolicy.test.ts`'s local `APPROVED` fixture
  unless verification in §0 shows it actually reads `config/bot.json` (it
  appears not to — it's a hand-built `OilBudgetConfig` literal used to test
  `mayConsumeOil` generically, including the *rejected* case). Confirm rather
  than edit reflexively.
- Don't touch `§0a`'s suspension. Nothing here lifts the +19.40pp/+17.74pp
  quoting ban — if anything, this makes the Focus share of that number even
  less relevant to quote, since it will not be spent going forward.

---

## 2. §33 — apply option (b): point `oilsConsumed` at the reader that's already right

**The choice made:** option (b), on session 92's own recommendation. The
double-lethal trigger fires on a cast's closing turn by construction, and
`castTrace`'s turn-filtered `oilsConsumed` cannot see anything that happens
there — currently a **40% undercount** (census reads 15 casts/24 oils where
the truth is 21/35). `src/sim/fishingCorpus.ts` already reads the raw states
directly and gets all six known-missed casts exactly right
(`consumablesUsed` 2, 2, 2, 1, 2, 2), pinned by `tests/sim/fishingCorpus.test.ts`.

### What to actually do

1. Point `castEra.ts`'s (or wherever `oilsConsumed`/`firedOil` is actually
   defined — confirm the exact file/line this pass, session 92's STATE.md
   names `castEra.ts` as the affected file but not the precise export) oil
   count at `fishingCorpus.ts`'s already-correct reader, rather than writing a
   new one. Don't touch turn semantics — this is explicitly not option (a).
2. **Recompute, don't hand-edit**, every pinned number downstream of the old
   undercount. Session 92 named two instruments as affected by the same root
   cause: the oil census itself, and `tests/fishing/oilReachability.test.ts`'s
   `lax.decisionPoints === strict + 1` / `focusPoints === 1` structural claim
   (already exempts `13071770` explicitly — verify that exemption still reads
   correctly once the census source changes, since it was written against the
   *old* reader's blind spot). Grep for any other consumer of the old
   `oilsConsumed`/`firedOil` path before assuming these two are the only ones.
3. Record the ruling in `QUESTIONS.md` as a new dated "§33 ANSWERED" heading
   (below the existing §33/§33 UPDATE text, not editing it) stating the user
   chose option (b), plus the corresponding `DECISIONS.md` entry.
4. **Generalization worth carrying forward, not just fixing the instance:**
   §33's own text notes two instruments have now broken on "an instrument
   that walks the END of a cast, unchecked against a double-lethal cast" in
   two sessions. If this pass finds a third, treat it as confirming a pattern
   worth a standing note (e.g. in `castTrace.ts`'s docblock) rather than a
   third isolated fix.

---

## 3. `boons.test.ts` — regenerate the `OBSERVED_OFFERS` pin

**The choice made:** regenerate now rather than defer a fourth time. It has
been checked and declined as inert by sessions 89, 90, and 91; it is now the
**sole** blocker on both `assertionCoverage` and `preflight.ts` passing clean,
which none of the three prior declines were true of.

1. Confirm one more time that nothing has changed the underlying claim (a new
   dungeon run reaching deeper than room 9, or a new boon type at an existing
   room) — this is a regeneration of a stale fixture snapshot, not a licence
   to stop checking it.
2. Regenerate `OBSERVED_OFFERS` from the current corpus and update the
   `Math.max(...OBSERVED_OFFERS.map(o => o.room))` pin (currently `9`) if the
   deepest recorded offer has moved.
3. Confirm `assertionCoverage.ts` and `preflight.ts` both actually run clean
   afterward — that's the entire point of doing this now rather than later.

---

## 4. The live batch — 10 casts, standard cadence, relaxing-only for the first time

### 4a. Before starting

- Baseline the suite yourself (§0).
- **Land §1, §2, and §3 first.** None gates the others, but all three land
  before the batch so the 10 new traces enter a corrected corpus and a
  corrected policy, rather than needing to be reconciled against them after
  the fact.
- **Rule 13.** Read the server's ledger before assuming budget: `dayDocs[pondId 2]`
  casts remaining, `oilHeld.relaxing` stock. Session 92 left the day's ledger
  at `19/20` (**1 cast remaining that day** — confirm whether the daily
  counter has since reset) and Relaxing stock at `46`; Focus stock was `0`
  and is now moot regardless of its actual value, since §1 stops the bot from
  attempting it either way.
- Rod durability: ~20 of the user's ~40-cast estimate (from the 2026-08-24
  repair) is spent as of session 92. Check for `BASE_DECK` casts afterward
  (§4c-3) as before; nothing in this repo can see durability directly.

### 4b. Run it

```
npx tsx scripts/liveFishing.ts --casts=10 --oil-batch
```

Same flags as session 92 (carry `--oil-batch` forward — it's what makes the
redraw-shadow batch summary print). `npx tsx` and `git` fail under the command
sandbox — run unsandboxed.

### 4c. After it finishes — report on

1. **Oil spend, under the new policy.** Confirm zero Focus Oil attempts
   (`oil_trigger_no_stock` events for 942 should disappear entirely, replaced
   by nothing — there should be no 942 trigger evaluation at all, per §1a-2).
   If a 942 event of any kind appears, that's a direct sign §1's config change
   didn't take effect as expected — surface it immediately.
2. **The double-lethal trigger, if the band arose.** Same depth as the last
   two batches: both POSTs, both slots, `fishHp` trajectory, whether the
   per-cast Relaxing cap (2) is reached and whether it binds (reached-not-bound
   twice running so far). This trigger already only ever spends Relaxing
   (937), so §1's policy change should not otherwise affect it — confirm that
   holds rather than assuming it.
3. **The redraw shadow — standard reporting, not an expanded batch.** The user
   chose the standard 10-cast cadence over sizing this batch specifically to
   chase the fire-rate puzzle (0/52 → 4/24, Fisher p = 0.008, backwards from
   the "dead hand" pattern a redraw trigger should show). Report the batch
   summary counts and fire rate as usual, plus a cast-length breakdown (short
   vs long casts) so the puzzle keeps accumulating evidence without this batch
   being scoped around it. `liveRedrawEnabled` should still read `false` on
   every row — the shadow stays a shadow.
4. **Whether any of the 10 new casts were dealt `BASE_DECK`,** using the
   existing shared classification — no new logic needed.

---

## 5. Gate

1. §1: `config/bot.json`'s `dendren.oils.allowedItemIds` is `[937]`.
   `OIL-POLICY.md` carries a new dated section stating the Focus Oil
   withdrawal and its cost against the (suspended) modeled recommendation.
   `QUESTIONS.md` and `DECISIONS.md` both carry the directive.
2. §2: `oilsConsumed` reads from `fishingCorpus.ts`'s reader; every downstream
   pinned number is recomputed, not hand-edited; `QUESTIONS.md`/`DECISIONS.md`
   carry the §33 ruling.
3. §3: `OBSERVED_OFFERS` is regenerated and verified against the current
   corpus; `assertionCoverage` and `preflight.ts` both run clean.
4. §4: the batch ran to completion with `--oil-batch`, or the recap says
   exactly why it stopped early (rule 13). All four of §4c's reports are
   present even when the honest answer is "no."

**What does NOT meet the gate:** a docs-only change to `OIL-POLICY.md` without
the `config/bot.json` edit (the user chose the full landing, not
documentation-only); hand-editing any of §2's downstream pins instead of
recomputing them; regenerating `OBSERVED_OFFERS` without re-verifying the
underlying claim first; a live batch that shows a 942 event of any kind
without it being surfaced as a possible policy-landing failure; sizing the
batch around the redraw-shadow puzzle after the user explicitly chose not to.

---

## 6. Do not

- **Do not re-open `QUESTIONS.md` §26, §28, §29, §30, §31, or §32.** All
  closed.
- **Do not touch `redrawEnabled` or `REDRAW_THRESHOLD`.** Still a shadow.
- **Do not touch `session-86-redraw-revisit.md` or `session-86-corpus-snapshot.md`.**
  Still frozen at `CORPUS-2026-08-23A`.
- **Do not extend the batch past 10 casts.** The user explicitly chose the
  standard cadence over an expanded one for the redraw-shadow puzzle.
- **Do not lift §0a's suspension.** Nothing here re-derives +19.40pp or
  +17.74pp on a valid instrument; §1 only changes what the bot spends, not
  whether the old number can be quoted.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 93)

1. Remove `942` from `config/bot.json`'s `dendren.oils.allowedItemIds`;
   confirm the rejection path in `mayConsumeOil` behaves as expected.
2. Add a dated withdrawal section to `OIL-POLICY.md`; record the directive in
   `QUESTIONS.md` and `DECISIONS.md`.
3. Point `oilsConsumed` at `fishingCorpus.ts`'s reader (§33 option b); recompute
   every downstream pin; record the ruling.
4. Regenerate `boons.test.ts`'s `OBSERVED_OFFERS` pin after re-verifying the
   underlying claim; confirm `assertionCoverage`/`preflight.ts` run clean.
5. Check the server ledger and oil stock, then run
   `npx tsx scripts/liveFishing.ts --casts=10 --oil-batch`.
6. Report: zero-Focus-attempt confirmation, the double-lethal trigger's firing
   (or absence) and cap behavior, the redraw shadow's batch summary with a
   cast-length breakdown, and whether any `BASE_DECK` casts appeared.
7. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
   final commit, `assertionCoverage`, `preflight.ts`, secret scan. Report the
   actual final failure count — it should read 0 if §3 lands cleanly.

**Honest expectation and sequencing.** §1–§3 are all small, mechanical
landings once each one's specific verification step is done — none is the
kind of open-ended reversal §1/§2 were in sessions 91 and 92. The batch itself
is, as it has been the last two sessions, mechanical: nothing new is being
built, only run and reported on honestly. **If Focus Oil quietly stops
appearing in the logs and everything else reads the same as the last two
batches, that is the expected and complete result.**
