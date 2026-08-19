# The `[CONFIRMED]` falsifiability audit — session 48, brief §2

Session 47 found `ZONE_OFFSET` had been the transpose of the truth for eleven
sessions while marked CONFIRMED. It was found by accident. This is that check
done deliberately.

**The question this pass asks is not "is the claim true?" but "could the sample
it was established on have shown it false?"** A claim tested only on inputs
that are invariant under the competing hypothesis is untested, however
carefully it was derived. That is the failure mode, now **four** times over:
heuristic (d)'s displacement-vs-class guard, the `.message` server-cap
classifier, the zone table, and — found by this session's own live batch —
FACT 1's "`k` is constant per cast".

Priority flags, per the brief:
- **[n1]** established on n = 1, or before the corpus existed.
- **[sym]** the establishing sample is symmetric or degenerate with respect to
  the claim — invariant under the competing hypothesis.

Action taken on the fourth column: **anything re-scorable was re-scored.**

---

## Fishing

| claim | establishing sample | what that sample could NOT distinguish | re-scored? |
|---|---|---|---|
| `ZONE_OFFSET` card hitbox table (SPEC.md §5, SPEC-fishing.md §4) | **[n1][sym]** one hit, card 79, `hitZones [2,4,6,8]` — session 12 | its own **transpose**; `{2,4,6,8}` is transpose-symmetric | **YES, and it was WRONG** — session 47, 282/282 vs 228/282. Guarded by `tests/fishing/zoneTemplate.test.ts`. Re-confirmed independently this session by the crit test below. |
| FACT 1 — "every move lands on a fixed Manhattan-`k` ring, and `k` is constant per cast" (SPEC-fishing.md §9) | 66 casts / 279 transitions, exceptionless | that `k` is a **step COUNT** over unit steps, not a ring class — and that the count can vary within a cast. `data/fish-patterns.jsonl` projects each turn to `from`/`to` and **discards the path between them**, so the corpus view used to fit the model could not represent the counterexample | **YES, and the constancy half is FALSE** — session 48 live cast `12988700` ran 1,2,1,2,1,2. `scripts/auditMovePaths.ts`: unit-step decomposition **312/312**; constant count only **72/73**. `tests/fishing/movePath.test.ts`. |
| `position` is row-major (`position[0]` is the ROW) | **[sym]** implicit in the same session-12 capture | column-major; the capture's cells did not discriminate | **YES** — session 47, `lastMovePath` identity 289/289; session 48 re-derived it from a second field, `path[last] == fishPosition`, **312/312**. |
| focus-meter spend rule: costs Manhattan distance, no regen within a cast (SPEC-fishing.md §4) | **[n1]** one cast, session 13 — moves of distance **0, 1, 1**, then a distance-2 move rejected at 1 point left | **"cost = 1 per move"** predicts identically on 0,1,1 (the HTTP 400 does discriminate it, so the claim was not baseless). The **no-regen** half rested on a cast that never had the budget to show regeneration either way | **YES** — `scripts/auditStateFields.ts`: **308/308**, regen observed **0/308**. `tests/fishing/stateFields.test.ts`. |
| `fishHp` is the catch meter — hits damage it, misses heal it (SPEC-fishing.md §4) | **[sym]** sign agreement only | **any** rule with the right sign, including the wrong magnitude — and specifically **crits**, which are invisible to a sign test | **YES** — **308/308** on amounts, once `critEffects` is used at `critZones` cells. Found 4 crits nothing had ever scored. |
| `playerHp` is mana, not health | **[sym]** 5 plays, **every card `manaCost: 1`** — cannot distinguish "−1 per play" from "− manaCost" | the per-card cost rule | **YES** — session 47, `mana(t+1) = mana(t) − manaCost` 282/282. |
| hand refills "drawn from `fullDeck` via `nextCardIndex`" | **[n1]** asserted from field names, never checked | that `fullDeck` is a canonical **sorted** list and the draw order is a hidden server shuffle | **YES, and it was WRONG** — session 47: 0/56 refills, 1/69 opening hands match a `fullDeck` slice. |
| `gridSize` 4, `focusMechanicEnabled` true for Dendren | one capture, but a field read | nothing — a direct field read of a value that is either there or not | not needed; re-read on every live cast since |
| `action: "loot"` resolves a catch | live, session 17 | — | exercised live every catch since, incl. this session's batch |
| `use_fishing_item` envelope (SPEC-fishing.md, session 44) | **[n1]** one user DevTools capture; **this project has never sent one** | whether the bot's own construction of it is accepted; whether `slotIndex`/`tierId` matter | **NO — not re-scorable offline.** See QUESTIONS.md §18. |
| `focusMeter` regeneration **across** casts | never tested — already marked `[VERIFY]` | — | still open, correctly labelled |

## Dungeon

| claim | establishing sample | what that sample could NOT distinguish | re-scored? |
|---|---|---|---|
| `enemyPathOptions[].lootTable` is identical across all offered tiers — **the claim CLAUDE.md §8 rests on** | "every sample captured so far" (SPEC §3e) — **never quantified** | a tier-dependent loot table appearing outside the samples looked at | **YES** — **440/440** `enemyPathOptions` observations, byte-identical across all three tiers, whole fixture tree. |
| Combat resolution (SPEC §3d/§5) | replayed against every recorded exchange | — | already re-scored by construction: `tests/replay.test.ts`, 127/132 side-updates, 0 failures inside the clean model |
| Charge mechanics (SPEC §5) | 132 played moves / 264 unplayed transitions, `scripts/chargeRecount.ts` | — | already re-scored by construction, and re-runnable |
| `start_run`'s `data.index` **is** `entryData.tier` | n = 2 (index 2 and 3), each matched to its ring cost | a coincidence of two points; index 1 has never been sent | partially — the `entryData` table is independent evidence, so this is stronger than n=2 alone. Low risk, low value to chase. |
| ROM claim overflow past the 420 cap is non-wasting | session 22: claimed 540 into an 88 pool, saw +332, **re-probed the ROM and read 208 banked** | — | **this one is exemplary.** The re-probe is precisely the observation that could have refuted it. Re-observed live this session: 540 claimed into a 47 pool, +373 measured. |
| Endpoint list, envelope shapes, action-token chain | live captures, exercised continuously | — | re-exercised every live session; a 404 or a shape change fails closed |

---

## What this pass changes

1. **FACT 1's strong form is retired** and the ring model's hard-zero
   constraint is now known to be unguarded against a real case. Measured, not
   fixed — see STATE.md.
2. **Two §4 claims are now genuinely confirmed** rather than nominally so, with
   re-runnable scripts and corpus-pinned tests.
3. **The zone correction has a second, independent confirmation** on a
   different zone set and a different observable.
4. **CLAUDE.md §8 has a number behind it** for the first time: 440/440.

## The cheap standing guard

Every one of the four failures had a real mechanism, a plausible derivation,
and an evidence base structurally blind to the specific error. More care at
derivation time would not have caught any of them. What catches them is
**re-scoring against the corpus once the corpus is big enough to bite** — so
each re-scorable claim above now ships as `scripts/audit*.ts` plus a
corpus-pinned test, and those tests fail as the corpus grows if the claim
stops holding.

**The one that is not re-scorable is the one to watch**: `use_fishing_item`.
The capture that would make it so is stated in QUESTIONS.md §18.
