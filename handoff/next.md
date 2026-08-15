# BRIEF — session 09

The bot completed a run. Rooms 1→4, mostly unattended, five live bugs found and
fixed in flight, and **0 clean-model failures across 117 exchanges** including
the one that killed it. That last number is the one that matters — the combat
model derived over five sessions of offline work survived contact with live play
without a single miss.

`postWithVerifiedRetry` is the right instinct: never assuming a 500 means
"nothing happened" is exactly the discipline this needs. Two things to harden
before five runs, then the runs.

---

## 1. Your question 3 is a blocker, not a footnote — promote it

You flagged, as a not-yet-observed possibility, that a retry could land on a
**different reward than intended** if the offer changed between attempts. Take
that seriously now rather than after five runs.

The setup is already there in what you found: `reward_*`'s `data.index` is an
**array position**, one of the two 500s **applied server-side anyway**, and the
retry re-checks state but re-sends an index. Position-addressing plus
non-idempotent failures plus retry is the classic recipe for acting on a stale
index.

The reason this can't wait: if a retry picks the wrong boon, the run continues
and the fixture is written **labelled with the intended boon, not the applied
one**. That's a silently poisoned pickup pair feeding `BOON_MODELS`, which feeds
coverage, which everything downstream depends on. A failed run costs 20 energy;
a mislabelled fixture costs trust in the corpus, and you won't know which one it
was.

Fix: **address rewards by identity, not position.** Before any retry of a
`reward_*` or `path_*` pick, re-read the offer, locate the intended option by
its stable fields, and re-derive the index. If the intended option is no longer
present, or its index moved, **halt** rather than picking whatever now sits at
that position. Log both.

Five runs multiply the exposure. Do this first.

## 2. Guard persistence — do it now, it's cheap and it's a stated non-negotiable

Your read that 100 energy against a 300+ balance isn't urgent is correct on
overspend risk. But `CLAUDE.md` lists the energy budget as a hard rule, and a
guard rebuilt fresh per process **enforces nothing across invocations** — the
session that used several `npm run live` calls had no effective budget at all.

The problem isn't the risk today, it's that a guard which silently doesn't work
is worse than no guard, because it gets trusted. It's a small fix — persist
`GuardState` to `data/` with a date key, seed from it on startup. Do it now
rather than carrying a non-functional safety mechanism into unattended
operation.

## 3. SPEC §2's action list is compromised — re-verify the rest

`loot_one` returned 409 and `enemy_two` returned 400. Both came from **my**
SPEC §2, sourced from Gigaverse's published agent skill. Two of the documented
names were wrong.

So treat the remainder as suspect: `use_item`, `heal_or_damage`, `flee`,
`cancel_run` are all unverified and from the same compromised source. Mark them
`[VERIFY]` in SPEC and confirm opportunistically — but **never** send one
speculatively mid-run, since a 400 in the middle of a live run costs the run.
`flee` and `cancel_run` in particular should be confirmed only when a run is
already being abandoned.

Your point 2 — confirming `path_one`/`path_three`/`reward_two`/`reward_four`
opportunistically rather than with dedicated captures — is right. Same treatment.

## 4. Report `deepestScorableRoom`

`MAX_SAFE_ROOM` moved 2 → 4, which lifts the enemy-side ceiling, but the
boon-side wall is separate and the metric wasn't in this session's numbers.
Report it explicitly next time. If it's still 1, say what's pinning it now that
the tier and room-3 gaps are closed — `AddBlock` landing its first pickup pair
should have moved something.

## 5. `intuition`

`unknownSideKeys()` watching every poll and never firing is a clean negative
result. Leave it running. At machine speed across five runs it'll either fire or
build real evidence that it doesn't surface as a state field at all. Don't model
it either way.

---

## Your task

1. **Reward-by-identity retry**, per §1. Before anything live.
2. **Persist `GuardState`**, per §2.
3. Mark unverified action names `[VERIFY]` in SPEC, per §3.
4. **Task 6's five-run stage.** Stop at the first surprise and recap — five runs
   on a clean baseline is the gate; five runs through five more rounds of
   bugfixing is a different and less useful thing.
5. Report `deepestScorableRoom`, energy spent against budget, rooms reached per
   run, and whether the `reward_*` 500s recurred.

Budget: **120 energy** this session. That covers five runs with margin for one
retry, and `guards.ts` should now actually enforce it.

If the identity fix in §1 surfaces that a past retry *did* pick the wrong boon,
that's the most important finding of the session — quarantine the affected
fixture and say so, rather than letting it sit in `BOON_MODELS`.

Addendum — consumables groundwork (data only, no implementation):

During the five runs, log but do not act on:
  - /items/balances entries that look consumable, with full metadata
  - the exact shape of start_run's `consumables: []` field
  - any item description implying heal / revive / stat buff

Do NOT send `use_item` — it's [VERIFY] per §3 and a 400 mid-run
costs the run.

Report what's in the inventory in the recap. If healing consumables
exist, they become their own task with their own gate: deaths are
the binding constraint on items-per-energy, so a mid-run heal is
plausibly the single biggest lever available.
