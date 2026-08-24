# BRIEF — session 91 — close §29/§31, then run the first live batch through the double-lethal trigger and the redraw shadow (10 casts)

**One documentation/test-correctness pass, then one live batch.** Read §1-§2
fully before running anything live — §2's ruling changes what "THE FINDING"
in `damageEconomy.test.ts` is allowed to claim, and running the batch before
that lands would let 10 new casts blend into a baseline that's still wrong.

**Where this came from.** Session 90's STATE.md was walked through with the
user. Two rulings came back on the two items session 90 left open, plus
confirmation of what session 91 should spend its live budget on. The two
rulings were obtained differently and that difference matters for how each
gets written into `QUESTIONS.md`: §29's answer is the user's own words,
unprompted by any options. §31's is a choice among three options this
brief's author put in front of them (tracking `QUESTIONS.md` §31's own
(a)/(b)/(c), reworded to fold in §29's answer) — record it as a choice made,
not as spontaneous user language.

---

## 0. Verification and rule 9

```
npx tsc --noEmit
npx vitest run
```

**Establish the actual current baseline yourself at the top of this
session — don't carry forward a number from this brief.** This brief's
author does not have session 90's exact final suite count in hand (only a
paraphrase that it finished "very close to green"), so it isn't quoted here
as a starting point. Rule 9 applies to numbers as much as to claims.

**Files actually read this pass, precisely** (so the next reader knows what's
verified versus what's carried forward): `QUESTIONS.md` §29/§30/§31 in full;
`handoff/next.md` (session 90's brief, in full); `tests/fishing/damageEconomy.test.ts`
in full; `src/sim/fishing/rodDeck.ts` in full; `src/strategy/fishing/redrawShadow.ts`'s
docblock and threshold section (~lines 1-90); `tests/fishing/redrawShadow.test.ts`'s
live-parity tests (~lines 95-175); `handoff/reports/session-86-redraw-revisit.md`
in full; `handoff/DECISIONS.md`'s session-83 §3 and session-90 §2/§3/§4 entries
(grepped and read in place, not the whole 526KB file); `scripts/damageEconomy.ts`
and `src/sim/fishing/castTrace.ts` (grepped for specific exports/fields, not
read start to finish); `scripts/liveFishing.ts` (grepped for `doubleLethalTriggers`,
`redrawShadow`, `COMPLETE_CID`, and `--casts=` wiring — not read in full this
pass); `config/bot.json` (grepped: `dendren.maxCastsPerSession` = 20).

**Not opened this pass — verify before relying on them:** `OIL-POLICY.md`'s
exact current §0a text (read in an earlier turn of this project, not re-read
now — don't trust this brief's memory of its wording); `tests/fishing/oilDoubleLethalLive.test.ts`;
`tests/fishing/redrawShadowInert.test.ts`; the full body of `liveFishing.ts`'s
oil-consume loop (session 90's brief did that full read when it wired the
trigger; nothing here touches that loop, but confirm rather than assume it's
unchanged).

---

## 1. §29 — record the user's answer; no code changes needed

**Verbatim**, in answer to what causes the intermittent `BASE_DECK` dealing:

> "Casts were dealt the base deck because my shroom rod ran out of
> durability and I didnt notice. Rod has been repaired and will be good for
> another 40 casts."

This resolves `QUESTIONS.md` §29's open causal question definitively:
durability, not a per-day allowance, a server-side equip desync, or a plain
bug. Append a new dated "§29 ANSWERED" heading below the existing open text
— the way §26 and §30 were closed, a new heading, not an edit to the
original — quoting the user exactly, and stating plainly what is now
established (durability-gated, and will recur) versus what still isn't
tracked anywhere in this repo: there is no durability or charge field
anywhere in the fixtures or the live doc shape (`GEAR_CID_array` and
`fullDeck` carry neither), so this repo has no way to predict the next
base-deck window before it happens. The account owner is currently the only
durability sensor that exists.

**`rodDeck.ts` / `rodDeck.test.ts` need no changes.** `KNOWN_DEALT_DECKS`
already treats a `BASE_DECK` deal as a legitimate, ratchet-passing state
(session 89's fix), and that was the right call independent of the cause —
it stays right now that the cause is known and is expected to recur.

**One live thing worth watching, free of charge:** the "~40 casts of
headroom" claim is about durability, not a repo fact, and §3 below gives
this session a zero-cost way to sanity-check it against the batch it's
already running — see §3c item 3.

---

## 2. §31 — exclude the base-deck casts from the headline LIVE figure; this is a bigger edit than it sounds

**The choice made:** exclude the 22 base-deck casts from the headline figure
as a distinct, now-closed equipment-failure population; keep their numbers
as a dated historical note; do not stand up a second permanently-tracked
line. (The other two options offered — keep pooled with a footnote, or
formally re-pin two permanent tracked figures — were not chosen.)

**This is not quite `QUESTIONS.md` §31's original option (a).** Option (a)
as written treated the base-deck arm as a possible second *legitimate
fishery*, worth tracking side by side with the real one indefinitely. §1's
durability answer changes that framing: the base-deck window isn't a second
fishery, it's an equipment-failure interval — real casts dealt a worse deck
because the rod had run dry. The right treatment is closer to "drop it from
the corpus this file measures, keep the number as a dated closed note, and
expect it to recur (§1's ~40-cast clock) without needing a standing second
line" than to "track two fisheries forever."

### 2a. The part that is not mechanical — read before touching the file

Excluding the 22 base-deck casts does **not** restore "the fish gains HP in
expectation." The actual split (`tests/fishing/damageEconomy.test.ts` lines
83-86, reproduced from `DECISIONS.md`'s 2026-08-24 session-90 §2/§3 entry):

```
 dealt deck        casts  plays   hitRate   meanDmg  meanHeal    drift
 base [1..10]         22     74    18.9%      4.571     3.000   +1.568
 non-base            145    622    39.9%      5.210     3.086   -0.222
 POOLED (= LIVE)     167    696    37.6%      5.176     3.074   -0.032
```

**The non-base arm's drift is −0.222 — negative.** The old positive pooled
figure that produced "the fish gains HP in expectation" was carried entirely
by the 22-cast base-deck window, now understood to be equipment failure, not
real Shroom Rod play. Restating `LIVE` on the non-base population alone
doesn't shrink the old claim toward zero — **it flips it**, to the same sign
as the sim's bare arm. That's a genuine reversal of a headline claim on the
corrected population, not a value bump, and deserves the same weight session
90 gave the original sign flip. **Do not fold this into any mechanical-pin
bucket or treat it as a routine regeneration.**

### 2b. What to actually change in `tests/fishing/damageEconomy.test.ts`

1. **Build the split**, using what's already in the repo rather than
   inventing new deck-comparison logic: `grantedPrefix` and
   `BASE_DECK`/`REAL_DECK` from `src/sim/fishing/rodDeck.ts`, applied to
   each trace's own `fullDeck` field (`CastTrace.fullDeck`,
   `src/sim/fishing/castTrace.ts` line 107) at `grantSize = REAL_DECK.length`.
   A trace is base-deck if its `grantedPrefix` equals sorted `BASE_DECK`;
   everything else in `KNOWN_DEALT_DECKS` (the Shroom grant, currently) is
   non-base. **This repo has the primitive but not the split as a named,
   reusable thing.** `scripts/damageEconomy.ts` (checked this pass — it
   currently has no base-deck awareness at all) will want the same split for
   its printed report to stay consistent with what the test now measures, so
   consider a small `dealtDeck(trace): "base" | "real" | null` (or similar)
   helper on `rodDeck.ts` beside `grantedPrefix`, shared by both. Exact shape
   is your call; the constraint is one implementation, not two that can
   drift apart.
2. **Repoint `LIVE`** (currently line 53: `const LIVE = corpusEconomy(TRACES)`)
   to the non-base subset, with a label that says so — `corpusEconomy`'s
   second argument defaults to `"LIVE — every clean trace on disk"`
   (`src/sim/fishing/damageEconomy.ts` line 145); change the label along
   with the population. A mislabeled constant is worse than an unlabeled one.
3. **Add a second, clearly-separate constant** for the base-deck arm — never
   named `LIVE`, never feeding a "THE FINDING" assertion — used only in a
   new small `describe` block that records its current numbers (recompute,
   don't hand-type the table above) as a dated, closed historical fact. Its
   docblock should say: closed by §1's durability explanation, expected to
   recur on roughly the user's own ~40-cast horizon, and not a second
   fishery to track going forward, just a population to keep excluding.
4. **Rewrite the three previously-red tests.** Each needs its title and
   claim corrected, not just its comparator flipped:
   - *"THE FINDING: the fish gains HP in expectation"* (lines 149-156) — the
     claim is now the opposite. Recompute the corrected `LIVE.drift` (expect
     it near −0.222, but pin whatever the run actually produces) and rewrite
     the title and assertions to state the corrected direction plainly —
     something like "the live fish loses HP in expectation, same sign as the
     sim's bare arm, over an order of magnitude smaller" — rather than
     silently swapping `toBeGreaterThan` for `toBeLessThan` under the old title.
   - *"the clamp is real but small"* (lines 172-183) — recompute
     `corpusEconomyUnclamped` on the corrected (non-base) population and pin
     whatever sign and magnitude it actually reads. Don't assume it matches
     the old pooled unclamped figure (−0.0014) or the old positive-sign claim.
   - *"THE FINDING: the bare arm's drift is NEGATIVE where live's is
     positive"* (lines 215-223) — the contrast this title asserts no longer
     exists on the corrected population; both arms are negative. Rewrite
     around magnitude: live's corrected drift should still read over an
     order of magnitude smaller than the bare arm's (< −2), so "not the same
     fishery" survives and is what the rewritten title should claim —
     "opposite signs" does not survive and the old title must not either.
5. **Delete the "THREE TESTS ARE RED ON PURPOSE, DO NOT REGENERATE" docblock**
   (lines 66-125) once the above lands. Replace it with a short
   resolved-history note — what changed, why (§1's durability answer plus
   §31's ruling), and a pointer to the `QUESTIONS.md`/`DECISIONS.md` entries
   rather than re-quoting the full reasoning a third place.

### 2c. `OIL-POLICY.md` §0a

Session 90's docblock already flagged that §0a's "different fisheries"
argument would need restating around magnitude rather than sign once §31 was
ruled on. **Verify its exact current text before editing** — not re-read
this pass. The substance to land: the suspension of the +19.40pp margin is
**not lifted** (nothing here argues it should be), and the reason it holds
is now "live's drift is negative but over an order of magnitude smaller than
the bare arm's, and the bare arm is an oracle-matcher, no-redraw-cost,
~70%-catch-rate arm this fishery cannot reproduce" — not "live's drift is
positive, the sim's is negative."

---

## 3. The live batch — 10 casts, the first live exercise of two features that have never fired live

**Confirmed directly by the user: a live fishing batch of 10 casts.**
Nothing else scopes this session — no dungeon work.

### 3a. Before starting

- Baseline the suite yourself (§0); don't carry forward a number.
- **Rule 13.** Read the server's own ledger before assuming budget:
  `dayDocs[pondId 2]` (Dendren) casts remaining, and current
  `oilHeld.relaxing` / `oilHeld.focus` stock. `config.dendren.maxCastsPerSession`
  is `20` (checked this pass), so the local session cap is not the binding
  constraint — the server ledger is.
- **Land §2 first.** The batch will add up to 10 new traces the next time
  anything calls `loadCastTraces()`. Landing the split-based rewrite against
  the current 167-trace corpus before the batch runs means the fix's
  correctness doesn't depend on data that doesn't exist yet, and the batch
  becomes a clean out-of-sample check on the fix and both live features
  below, rather than something tangled up with them.

### 3b. Run it

```
npx tsx scripts/liveFishing.ts --casts=10
```

`npx tsx` and `git` fail under the command sandbox — run unsandboxed, as
every prior session has noted.

### 3c. After it finishes — three separate things to report, not one recap paragraph

1. **The double-lethal oil trigger's first live firing, if the band arose.**
   `QUESTIONS.md` §30 already sets the bar: if it fires, report the full
   response pair in detail — both `use_fishing_item` POSTs, both slots, the
   `fishHp` trajectory across the two consumes, and whether the mid-sequence
   `COMPLETE_CID` break (`liveFishing.ts`, inside the same consume block
   session 90 wired `doubleLethalTriggers` into — grepped to ~line 2322 this
   pass, confirm the exact line before citing it in the recap) correctly
   stopped the loop before a third POST. If the band never arose in 10
   casts, say that plainly — it's a real outcome, not a gap to chase (session
   89's sim estimate put the band at a low single-digit percent of
   decisions). If `oil_trigger_threw` fires even once (`liveFishing.ts`
   ~line 2296, the try/catch fallback to `onDemandTriggers`), report it in
   full — that's the live path's first-ever exercise of
   `bestKillProbability`/`buildHand` outside a shadow's try/catch, and while
   it's designed to degrade safely, a fallback actually firing is worth a
   close look.
2. **The redraw shadow's first live output.** `scripts/liveFishing.ts`
   already accumulates `batchRedrawShadowDecisions`, `batchRedrawShadowFires`,
   `batchRedrawShadowSanity`, and `batchRedrawShadowBlind` per batch (checked
   this pass, ~lines 3333-3338) and logs a `redraw_shadow_batch` event —
   report all four raw counts, the resulting live fire rate, and how it
   compares to the K=6-with-budget in-sample rate the candidate was fitted
   on (`{fires 12, rescues 8, sacrifices 0, wasted 2}` at 168 casts, per
   `DECISIONS.md`'s 2026-08-24 session-90 entry — state the in-sample rate
   as a fraction of whatever total-plays denominator the code or that entry
   actually gives; this brief does not have a verified percentage to hand
   you). `redrawShadow.ts`'s own docblock (its "what shadow CANNOT
   establish" section, read this pass) is explicit about the limit: this can
   show whether the candidate fires at a similar rate out of sample, not
   whether it would have helped. Report at that level of honesty, no more.
3. **Whether any of the 10 new casts were dealt `BASE_DECK`.** Free, given
   §2's fix already builds the classification — check the new casts'
   `fullDeck` against it. If none were, that's consistent with "repaired,
   ~40 casts headroom." If any were, that directly contradicts that report
   and is worth surfacing immediately rather than quietly absorbing into the
   corpus — it would mean either the repair didn't fully take or the
   ~40-cast estimate is wrong, and which (if either) is the user's call, not
   something to guess at.

---

## 4. Gate

1. §1: `QUESTIONS.md` §29 carries a new dated ANSWERED entry with the user's
   exact words. No code changes elsewhere.
2. §2: the base/non-base split exists as a named, reusable thing, not
   duplicated logic. `LIVE` in `damageEconomy.test.ts` is repointed and
   relabeled to the non-base population. A separate, clearly-non-`LIVE`
   constant carries the base-deck arm's numbers with a closed-historical
   docblock. All three previously-red tests are rewritten under corrected
   titles and claims, not just flipped comparators. The old "RED ON PURPOSE"
   docblock is replaced with a resolved-history note. `QUESTIONS.md` §31 and
   `DECISIONS.md` both carry the ruling.
3. §3: the batch ran to completion, or the recap says exactly why it stopped
   early (rule 13 — a permission denial or early halt is verified against
   the ledger, not assumed). All three of §3c's reports are present even
   when the honest answer is "no, it didn't happen this batch" — a null
   result reported is a met gate; a null result left unmentioned is not.

**What does NOT meet the gate:** flipping the three red tests' comparators
without rewriting their titles and claims to match; a base/non-base split
duplicated across two files instead of shared; treating the base-deck arm's
exclusion as licence to delete its numbers rather than keep them as a dated
note; a live batch run without a ledger check first; a double-lethal or
redraw-shadow live firing that happens and goes unreported because the recap
only says "batch completed."

---

## 5. Do not

- **Do not re-open `QUESTIONS.md` §26, §28, or §30.** All three are closed;
  nothing this session bears on any of them except §30's "first live firing"
  callback in §3c, which is reporting, not re-deciding.
- **Do not touch `redrawEnabled` or `REDRAW_THRESHOLD`.** The shadow stays a
  shadow regardless of anything this batch produces.
- **Do not touch `session-86-redraw-revisit.md` or
  `session-86-corpus-snapshot.md`.** Still frozen at `CORPUS-2026-08-23A`,
  permanently, regardless of §2 or §3.
- **Do not treat the base-deck arm's exclusion as evidence it was bad
  data.** It's real play, dealt a worse deck for a known reason. It's
  excluded from the headline because it's a different, closed population —
  not because it's wrong.
- **Do not extend the batch past 10 casts** to "see if the double-lethal
  trigger fires" or "see if the redraw shadow fires more." The user set the
  number; a null result from exactly 10 casts is the honest result.
- **`npx tsx` and `git` fail under the command sandbox. Run unsandboxed.**

---

## Your task (session 91)

1. Record the §29 answer in `QUESTIONS.md` (new dated ANSWERED entry, user's
   words verbatim).
2. Build the base/non-base deck-split classification, shared rather than
   duplicated.
3. Repoint and relabel `LIVE` in `damageEconomy.test.ts` to the non-base
   population; add the separate base-deck-arm constant with its
   closed-historical docblock.
4. Rewrite the three previously-red tests under corrected titles and claims.
5. Replace the old "RED ON PURPOSE" docblock with a resolved-history note.
6. Record the §31 ruling in `QUESTIONS.md` and `DECISIONS.md`.
7. Verify, and if needed update, `OIL-POLICY.md` §0a's magnitude-not-sign
   framing.
8. Check the server ledger (dayDocs, oil stock), then run
   `npx tsx scripts/liveFishing.ts --casts=10`.
9. Report on: the double-lethal trigger's first live firing (or its
   absence), the redraw shadow's first live fire rate against the in-sample
   K=6 rate, and whether any of the 10 new casts were dealt `BASE_DECK`.
10. Recap normally: full suite + `tsc --noEmit` + `git diff --check` at the
    final commit, `assertionCoverage`, `preflight.ts`, secret scan. Report
    the actual final failure count.

**Honest expectation and sequencing.** §2 is the real work this session — a
genuine reversal of a published headline claim on the corrected population,
not a mechanical regeneration, and it deserves the same care session 90 gave
the original sign flip. Do it first and get it right; a live batch run
against a still-wrong `damageEconomy.test.ts` baseline isn't something the
batch can fix retroactively. §3's live batch is comparatively mechanical —
the wiring for both features it exercises was built and tested in session
90, so this session isn't building anything new there, only running it and
reporting honestly on what does or doesn't happen. **If the band or the
redraw-shadow trigger simply don't arise in 10 casts, that's a complete and
acceptable result** — a null result is not licence to run more casts than
the user authorized.
