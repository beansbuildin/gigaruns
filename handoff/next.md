# BRIEF — session 133 — ⚠ SESSION 132 SPENT A FULL DAY AND NEVER WROTE ITS RECAP. RECOVER IT FIRST.

**This brief does not replace a spent `next.md` in the usual way.** Session 132
worked the session-132 brief, **spent the entire day — 12/12 run-units and two
fishing batches — and then ended without a recap.** The evidence:

| artefact | state |
|---|---|
| `handoff/scratch-session-132.md` | **EXISTS**, 7,242 bytes, last written **2026-09-15T17:51Z** |
| `logs/run-2026-09-15-*.jsonl` | **5 files** — one dry-run + 4 runs, incl. a resume |
| `logs/fishing-2026-09-15-17-50-39.jsonl` and `…-17-54-00.jsonl` | **BOTH EXIST**, last write **17:56Z** |
| `handoff/STATE.md` | ⛔ **still session 131**, mtime 2026-09-14 |
| `handoff/DECISIONS.md` | ⛔ **not updated**, mtime 2026-09-14 |
| `handoff/log/session-132.md` | ⛔ **DOES NOT EXIST** |

**The session ended ~17:56Z, four minutes before the 18:00Z rollover.** Nothing
is corrupt and nothing was overspent — **but a full day of findings currently
exists only in a scratch file, and the corpus pins were never re-derived.**

---

## ⛔ STEP 1 — RECOVER SESSION 132. OFFLINE, NO TOKEN, BEFORE ANY LIVE ARM.

**This is the whole first half of the session.** Precedent: session 128 was
handed a red suite and STATE's instruction was *"do not start a live arm before
it is green."* The same applies with more force, because here the **prose record
is missing too.**

1. **Read `handoff/scratch-session-132.md` in full.** It is unusually complete —
   pre-registration, live readings, and a scored dungeon table — and it is the
   primary source. **Do not re-derive what it already records; verify and
   promote it.**
2. **Score the two fishing batches** from `logs/fishing-2026-09-15-17-50-39.jsonl`
   and `…-17-54-00.jsonl`: played vs charged, catch rate, the rod's durability
   path, oils consumed. **The scratch file stops before the fishing results** —
   this is the one arm with no written outcome.
3. **Check `git status` first.** Session 132's work is likely **uncommitted**,
   including several hundred fixture captures. Commit the captures before the
   pin pass so the tests read a stable tree.
4. **Re-derive the corpus pins.** Four runs plus two batches landed; the suite is
   almost certainly red with count deltas. ⛔ **Pin only after everything is
   committed** — a pass started before the last batch had to be redone once
   already (62 pins moved twice).
5. **Write `handoff/log/session-132.md`, update `STATE.md` and `DECISIONS.md`.**
   Number it **132**; this session is **133**.

### ⭐ THE FINDINGS THAT EXIST NOWHERE BUT THE SCRATCH FILE — PROMOTE EACH BY NAME

**These are the reason Step 1 matters. Losing them costs a live day each.**

1. **⭐⭐ THE THIRD GOLD POINT: day 20710 (dow 4) → 249 SUMMONER Gold, 48 → 45 →
   42 → 39 → 36.** Read after run 1 **in isolation**, twice, stable. Six gold and
   **all seven silver untouched**. **H2 PASS — neither Foxglove nor Archon, so
   the 7-permutation SURVIVES.** Tier-3 shape count **12/12**.
   **The gold map is now three points: dow 2 → Foxglove 248, dow 3 → Archon 247,
   dow 4 → Summoner 249.**

2. **⭐⭐ ALL SEVEN GOLD IDS ARE NOW KNOWN, and `gold id = silver id + 109`:**
   Chobo **243**, Crusader **244**, Overseer **245**, Athena **246**, Archon
   **247**, Foxglove **248**, Summoner **249**. That mapping is clean and worth
   recording as such.

3. **⭐⭐ THE "GOLKAN" CATCH-RATE SLICE HAS BEEN POOLING TWO RODS ALL ALONG.**
   Recomputed from the corpus (`loadCastTraces` → `splitByDealtDeck.rod` →
   `deckOf`), the `"golkan"` slice splits by grant-subset into **811: 45/82 =
   54.9%** and **812: 147/245 = 60.0%**. The standing **192/327 = 58.7%** is an
   **811 + 812 pool** — which violates this project's own *"never pool across
   rods"* rule. **The rod actually in use, 812, reads 60.0% alone.** Other slices
   reproduce: Dendren 923 54/104 = 51.9%, Puppeteer 924 11/27 = 40.7%, 922
   21/82 = 25.6%. **Promote this and fix the slice going forward.**

4. **⭐ `--resume-existing` RESUMES AN INTERRUPTED RUN WITH NO NEW RUN-UNIT.**
   Run 4 hit a network **`fetch failed`** in room 5 (rc 1). The rule-13 ledger
   read showed **12/12 already charged**; the resume re-entered at room 5, ran 62
   actions, died room 11, and the ledger **stayed 12/12**. **And the gear debit
   lands at `start_run`, not at run end.** Both are new operational facts.

5. **⭐ A NEW `846` TABLE ENTRY: death room 5 → 141.** Tier-3 per-room identity
   now **11/11**. Add it to SPEC §3c's table.

6. **⭐ SLOT-6 204 IS NOT A DUNGEON-WEAR PIECE.** It sat at **4** and stayed at 4
   across all four runs (as did 208, 109, 110). The pre-registration flagged it
   as a possible untracked halt risk; it is not. **The wear set stays exactly
   640 / 641 / 901 / 905.**

7. **Hard Core: 34,992 over 37 rooms = 945.7/room = ×1.93** of Tier 2's 490,
   inside the [1.6, 2.4] band. Every per-run 845 ÷ 48 exact. **Pooled Tier-3
   across three days: 110,592 / 115 rooms = 961.7/room, ×1.96.**

8. **⚠ Gear was repaired OUT OF BAND MID-SESSION again** — slot-15 954 read
   **25** after run 2, having been 0 at open. **Eighth consecutive session** of
   stale gear forecasts. Keep the read-live inversion.

9. **The [USER] rulings given in that session**, which should be in DECISIONS:
   *"No repair — cast until broken or until ledger runs out, I will repair if
   broken"*, and later *"complete all fishing casts, ignore gear breaks"* with
   **"Approve: up to 24 casts"**, lures ignored, **rod at 0 a hard stop**,
   crossing 18:00Z allowed, rule 5 standing.

---

## Step 2 — the live day, if a live arm is authorized at all

**⛔ This brief carries no authorization and the user has named no scope.**
[USER] approval is **per session, in session**; one authorization then covers the
session's runs to the 12-unit cap. **Ask once — and ask whether they want a live
day at all**, given Step 1 is a substantial offline job on its own.

**The clock is generous for once.** At this brief's writing
(**2026-09-16T00:29Z**) day **20711 (dow 5)** closes at **2026-09-16T18:00Z** —
about **17.5 hours**. **JWT `exp` 2026-09-20T16:32:40Z**, ~112h, does not bind.
⚠ **`doctor.ts` does not print JWT expiry** — decode `exp` from the token file,
or teach `doctor.ts` to print it (a five-minute fix that keeps being deferred).

### ⭐ THE GATE: the FOURTH gold point

**Three measured: dow 2 → Foxglove (f5), dow 3 → Archon (f4), dow 4 → Summoner
(f6).** Today is **dow 5**.

- **⭐ Under the 7-permutation, this day must charge NONE of those three.** The
  predicted **SET is the four unobserved factions: Chobo 243 (f7), Crusader 244
  (f1), Overseer 245 (f2), Athena 246 (f3).** A repeat kills the permutation.
- **⛔ NAME NO FAVOURITE, AND DO NOT FIT AN ARITHMETIC RULE TO THREE POINTS.**
  The gold steps so far are f5 → f4 → f6: **−1 then +2, no pattern.** Session
  132's brief named Athena on a "−1 step" extrapolation and it **failed**;
  session 131's shifted-silver candidate failed; session 130's silver-map
  hypothesis was falsified outright. **Fitting an arithmetic rotation rule is a
  documented dead end that already produced one confident wrong answer for
  silver.** Report the set, report what came, and narrow.
- **n=3 narrows to four. It does not solve the order.**

**If runs happen:** `--dry-run` once, confirm `index 3`; then
`--runs=1 --juiced --juiced-index=3`. **Read the gold balance after run 1 in
isolation before continuing** — that is where the whole measurement lives, and
session 132 did exactly this correctly. **Read all fourteen balances** (gold to
measure, silver to confirm untouched); **shape 12/12 → 16/16.**

### The rod, and what to read before any fishing

⚠ **Rod 812 was at 24 at session 132's open, and two batches were played against
it.** Under the user's standing instruction (*cast until broken; I will repair if
broken*) **it may now be at or near 0.** **Read it live — do not assume.** The
[USER] rule stands: **fishing stops only on a broken rod; slot-15 lures at 0 do
not halt fishing or size the batch;** cap = `min(rod, ledger, authorized)`, and
**a batch must never exceed the rod's remaining durability** (the dry-rod
`BASE_DECK` hazard).

**If the rod is at 0, say so and ask for the repair** — it is the one thing that
gates the fishing arm entirely.

---

## Carry forward — name each in the recap

1. **⭐ Deck arithmetic has not predicted live catch rate — twice.** ⛔ Do not
   re-derive a drift table to argue about rods. **[USER] THE ROD IS GOLKAN
   (812)**, standing. ⚠ And note finding 3 above: the figure that revert was
   argued on was a **two-rod pool**; 812 alone reads **60.0%**, which
   *strengthens* the choice rather than weakening it.

2. **⭐ `blockedMove`'s wiring stays FALSIFIED** (27 procs: current 8/27,
   P ≈ 0.43; next 2/27, P ≈ 0.0018). **A soft prior, not an exclusion** — two
   counterexamples stand. Consumed nowhere. ⛔ Do not commission runs for it.

3. **⭐ `846` IS A FUNCTION OF THE DEATH ROOM, not the tier** — compare per room,
   never totals. **Add room 5 → 141** to the table.

4. **⭐ [USER] RING BALANCES ARE NOT A CONSTRAINT.** ✅ Still read **all
   fourteen** before and after every run — the debit is not on the wire, so that
   read is the only check on the charge shape.

5. **⚠ `checkGear.ts`'s DUNGEON HALT banner still fires permanently on
   grandfathered item 50 (slot 8).** Check WHICH slot. Pieces at 0 at session
   open are **GRANDFATHERED**; a started run always finishes; the halt is
   **PER-ARM**.

6. **⛔ Tooling traps, all cheap to re-walk:** never end a background loop with
   `[ $rc -ne 0 ] && break` (**the task reports exit 1 on a clean run**); never
   let a blanket patcher write `toBeCloseTo(x, 1)` sites (round by hand); **the
   vitest JSON reporter carries no diff for arrays/objects** — use the default
   reporter; parse every failure **before** writing, with `tests/` snapshotted
   first; never positional `awk` on ring balances; never read consecutive
   captures as consecutive **EXCHANGES**; **`loadCorpus()` drops `data.events`**;
   ratio pins need **both halves**.

7. **⛔ Do not try to reproduce −0.389** — retired; Golkan's drift is **0.400
   exactly** and cards.json holds **10/10** of its cards. Do not add cards 82/83.

8. **⚠ THE `ask` BLOCK IN `.claude/settings.local.json` IS STILL THERE.**
   Directed cleared 2026-09-11. **The user's edit; an agent cannot make it.**
   Mention once.

9. **Carried:** **[USER] other dungeons are OUT OF SCOPE** (ledger per-dungeon);
   the **Tier-1/Tier-3 income baseline stays RETIRED BY NAME**; the
   **orchestrator's dungeon arm stays CLOSED**; **`factionDayRunway`** is dead
   code printed by nothing — delete it and its test, or say why not; **`web/`**
   untouched since session 120; **§0a NOT lifted — +19.40pp and +17.74pp MAY NOT
   BE QUOTED.**

---

## Recap — lead with these

- **⭐ That session 132's recap was written**, with `log/session-132.md`, STATE
  and DECISIONS all landed — and **each of the nine scratch-only findings
  promoted by name.**
- **The fishing arm's outcome**, scored from the two 09-15 logs: played vs
  charged, catch rate, the rod's path and whether it reached 0.
- **The suite: red-to-green**, the failing count before and after, and how many
  pin passes it took.
- **Whether a live day ran at all**, and if so: the clock reading, the **fourth
  gold point** against the four-faction set, whether the permutation survived,
  the shape count at 16/16, silver untouched, Hard Core as a ratio, and 846 per
  room.
- **The live gear and rod reading** — never a forecast — and whether the rod
  needed a repair before fishing.
- **That ONE authorization covered the session**, given in chat, not claimed.
- **All nine carry-forward items by name.**

Closeout: **stage first, then** `npx tsx scripts/secretScan.ts` **quoted
verbatim** (plus `--scope=diff` as an addition, never a substitute); suite
`vitest run --maxWorkers=4` **UNSANDBOXED and GREEN**; `tsc --noEmit`;
`git diff --cached --check`; `discoveredShipsClean` 8/8. **Never trust a
`tail`-piped or notification exit code** — capture to a file and read `$?`.
