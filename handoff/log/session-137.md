# Session 137 — 2026-09-22 → 2026-09-25 — fishing ×3 days, Focus Oil re-allowed

See `handoff/STATE.md` for the summary table. This log holds the detail.

## §0 The un-recapped session 136
Git status at open showed ~600 staged files that session 135's commit did not contain: fixtures `cast-2026-09-21-15-5x…` (26 casts, 15 caught by log tally), `SESSION_136_LIMITS` in `oilBatch.ts` (castCap 20, "rod 812 read 50 at 15:53Z"), `liveFishing.ts` wiring it plus `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` 2.3 → 2.2, and a pin pass over ~12 test files at a 700-cast corpus. No log, no STATE, no DECISIONS entry. It was not noticed until recap — this session's batches ran under its limits the whole time. Committed as-is, then re-pinned.

## §1 Day 20718 (2026-09-23 ~04:51–05:05Z)
- `checkFishingCaps` 0/20; dry-run: rod 812 = 24.
- `--oil-batch`: 20 played, halt `cast_cap`, day charged 18, rod 24 → 4. Ledger read 18/20; second `--oil-batch`: 2 played, both caught, halt `ledger_exhausted`, rod → 2. Ledger 20/20.
- 11 caught / 22 played. Held Focus 0 / Relaxing 0 all day. Focus triggers logged as `oil_trigger_policy_withdrawn` (36 events), Relaxing as NONE HELD → casts flagged OIL-POLICY-DRY.

## §2 Day 20719 (2026-09-24 ~05:38–05:56Z) — "oils restocked and rod repaired"
- Ledger 0/20, rod 40. `--oil-batch` 20 played, charged 19, halt `cast_cap`, rod 40 → 20; follow-up 1 cast (escaped), rod → 19. Ledger 20/20.
- 9 caught / 21 played. Held Focus 0 / Relaxing 70 → 68. The user's "restock" was Relaxing only at that point.

## §3 The oil-timing investigation (user: "test oil timing")
Recent per-UTC-date catch rates from logs: 60/33/41/40/45/64/60/48/52/58/50/43% (09-10 → 09-24).

Loss decomposition (`data/run-reports/fishing-loss-decomposition.jsonl`):
```
last 43:  caught 20 / escaped(full HP) 14 / mana out 9
last 150: caught 80 / escaped(full HP) 47 / mana out 23
last 400: caught 214 / escaped(full HP) 143 / mana out 43
last 400 by everFocusZero: caught&!zero 128, caught&zero 86, lost&!zero 60, lost&zero 126
```
"Escaped at full HP" = misses healed the meter to max (SPEC-fishing FISH_ESCAPED).

Focus-withheld split, days 20718–20719 (casts with ≥1 `oil_trigger_policy_withdrawn`):
```
wanted focus / caught 2    wanted focus / escaped 17
no focus want / caught 18  no focus want / escaped 6
```

`oilArmCatchCheck.ts`:
```
no-oil  live 45.7% (231/505) [41.4, 50.1]   sim 29.6%  -16.1pp OUTSIDE
oil     live 96.2% (127/132) [91.4, 98.4]   sim 62.3%  -33.9pp OUTSIDE
```

`oilTimingSweep.ts --runs=8000` (costsTurn=false, amount 2): never 84.35%, start 88.00% (16000 oils), on-demand 93.73% (5502), lethal-relaxing-only 86.08% (1999), focus-when-empty-only 93.14% (3389), conserve(r=0.85,f=1) 93.80% (3686). Amount 1 and 3 rank the same way, winner flips between conserve and on-demand. `oilConserveSweep` / `oilDoubleLethalSweep`: double-lethal marginal 140.9 oils/extra fish; conserve thresholds flat. **§0a: the no-oil arm is 84% vs live ~46%; ordering only.**

Conclusion given to the user: the live bot was running the weak half of the policy (Relaxing only); the fix is identity (allow 942 + stock), not timing.

## §4 Config change (user: "yes allow focus oils again I restocked them")
- `config/bot.json` `dendren.oils.allowedItemIds` → `[937, 942]`, a one-line textual edit (a first attempt via JSON.stringify re-escaped the whole file and was reverted). Dated note appended to `_oilsComment`; its day numbers were first written wrong (20715-20716) and corrected to 20718-20719 before commit.
- Two tests pinned the withdrawal (`oilPolicy.test.ts:246`, `oilDoubleLethalDisabled.test.ts:177`); updated to assert 942 allowed and a funded Focus spend passes `mayConsumeOil`. `oilFocusWithdrawn.test.ts` still passes (it builds its own config).
- Full-suite A/B with and without the config edit: identical failure sets except those two tests.

## §5 Day 20720 (2026-09-25 ~03:18–03:31Z)
- First attempt was interrupted by an app quit during the tool-permission prompt. Rule-13 read: ledger 0/20, repo 0, newest log `02-41-14` = dry-run only. Nothing ran.
- `--oil-batch`: 20 played, **18 caught**, charged 15, 13 × 942 + 2 × 937, rod 19 → **0**. Held Focus 24 → 11.
- Rod halt; user repaired (rod 44). First `--oil-batch`: `start_run` HTTP 400 `Write conflict during plan execution and yielding is disabled … Please retry`; `action_not_applied`; ledger 15/20. Retry: 6 played, 4 caught, 3 × 942 + 2 × 937, halt `ledger_exhausted`, rod 44 → 38, ledger 20/20. Held Focus 54 → 51 (user restocked between batches).
- Day: 22/26 caught. Long casts (≥6 turns) went 3/4, each using 2–3 Focus.

## §6 Recap pin pass
- Suite before: 70 failed / 2776 passed. Categories: castEra 17, redrawCounterfactual 17, oilReachability 9, matcherHeadroom 7, damageEconomy 5, movePath 3, stateFields 3, zoneTemplate 3, fishingCorpus 2, redrawShadowAnalysis 2, deckShuffle 1, fishMaxHp 1.
- DEAD END: first `--write` loop passed `$F` unquoted in zsh → one argv → 0 failures reported. Caught because it contradicted the dry run.
- Real loop: passes wrote 60/41/22/15/8/5/5/1 = 157 pins; converged at 15 refusals (listed in STATE What's broken with values).
- New crit anomalies (stateFields:373), verbatim from the assertion diff:
```
13547166 t1: card 84 predicted Δ-6, actual Δ-9 (11->2/18)
13547196 t1: card 28 predicted Δ-6, actual Δ-9 (18->9/28)
13562111 t4: card 89 predicted Δ-4, actual Δ-6 (24->18/30)
13573580 t3: card 81 predicted Δ-6, actual Δ-7 (7->0/25)   <- clamped at 0, ratio unreadable
13573585 t1: card 89 predicted Δ-4, actual Δ-6 (17->11/27)
13573585 t2: card 88 predicted Δ-8, actual Δ-11 (11->0/27) <- clamped
13573595 t2: card 88 predicted Δ-8, actual Δ-12 (19->7/25)
13573605 t2: card 22 predicted Δ-4, actual Δ-6 (12->6/25)
13573625 t1: card 89 predicted Δ-4, actual Δ-6 (9->3/15)
13573645 t1: card 30 predicted Δ-6, actual Δ-9 (19->10/30)
13573649 t3: card 86 predicted Δ-6, actual Δ-9 (19->10/21)
13573708 t3: card 87 predicted Δ-6, actual Δ-9 (12->3/20)
13573715 t9: card 87 predicted Δ-6, actual Δ-9 (13->4/26)
13573717 t3: card 18 predicted Δ-5, actual Δ-8 (10->2/20)
```
All `hit=true crit=false`; unclamped ones sit at 1.5× (8→12 is exactly 1.5; 5→8 is 1.6, inside the standing [1.500, 1.5625) only if rounding is half-up on 7.5 → 8 — check). 11 of 14 are day 20720.
- movePath violations: cast 13547151 t4 path [3,2,6], t5 path [5,1,2], `allUnitSteps` true, `endpointMatches` true, `lengthMatches` false.

## §7 Secret scan
`npx tsx scripts/secretScan.ts` → `scope: tracked`, `files scanned: 21441`, `PASS — no unexplained hits, both controls healthy.` (Allowlisted synthetic hits in tests/api/redact.test.ts and tests/capture.test.ts, not reproduced here per the session-134 lesson.)
