# session 135 — 2026-09-19 — 25-cast fishing batch; damageEconomy tripwire fired — GATE FAIL

User-driven, no brief: *"the rollover has passed, run 30 fishing casts immediately"*.

## Timeline (UTC)
- **17:51:26** reads: rod 812 **40** (repaired out of band from 1), game ledger
  **0/20** for day 20714. The rollover had NOT passed — 9 minutes left. Cast
  immediately (CLAUDE.md rule 14). `SESSION_135_LIMITS` castCap 30 added.
- **17:51:53 → 17:59:40** `liveFishing.ts --oil-batch`: 25 played, stopped at
  `ledger 0 left`, rc 0. Rod 40 → 15 (−25, 1.00/cast). 13 caught. 1 oil.
- **18:00:16** day 20715 read 0/20. `--casts=5` issued — **rejected by the user**.
- **18:03:53** rule-13 read: game 0/20, repo 0, rod 15, newest log still
  `fishing-2026-09-19-17-51-53.jsonl`. **Nothing ran.**

⚠ Mid-batch I told the user "14 caught". **Wrong — 13.** 25 `cast over` lines,
13 `CAUGHT`; the corpus agrees (812: 184 → 197 caught, 310 → 335 traces).

## Batch outcomes (in order)
escaped 3 / C2 / e10 / C4 / e3 / e10 / C2 / e6 / C2 / e9 / e7 / C5 / C10 / e8 /
C2 / e10 / C10 / C2 / C2 / e10 / C2 / e6 / e2 / C3 / C4   (C = caught, n = turns)

## Warning printed for the first time
```
⚠ WARN overflow reachable: the largest single ROM (400) is >= the pool headroom (359),
  so one claim can now reach the energy cap. The "overflow past the cap is non-wasting"
  path is UNTESTED
```

## Pin pass (patcher, second live use)
Passes 1–9: 58, 37, 22, 16, 8, 5, 5, 1, 0 written → 152. Hand edits. Passes
10–17: 2, 1, 1, 1, 1, 1, 1, 0 → 8. **160 automated pins.** The long tail is one
test's sequential assertions surfacing one at a time, verified — not oscillation.

Hand-worked (8):
- ratio pins, both halves: `1157 / 1614`, `1262 / 1614`, `51 / 218`, `86 / 110`
- `REDRAW_SHADOW_IN_SAMPLE_RATE_PCT` "2.2" → "2.3" (674-cast corpus)
- oil-cast list +1 `13495020`; oil-gap list +1 `13495075` (both additive)
- `KNOWN_CRIT_ANOMALIES` +3 and three `observed` rows (bases 8, 6, 6 — none new;
  interval unchanged [1.500, 1.5625))

**Left RED (1):** `tests/fishing/damageEconomy.test.ts:321`
```
AssertionError: expected 0.10047593865679537 to be less than 0.1
the clamp is real but small — the unclamped reading agrees in sign and within a hundredth
```
Its comment pre-registers: *"If it breaches 10%, RE-EXAMINE the claim — do not
move this bar."* History 4.7% (s91) → 8.0% (s116) → 10.05% (now). Not moved.

## Closeout verification (final tree, unsandboxed)
```
npx vitest run --maxWorkers=4   Test Files 1 failed | 118 passed (119)
                                Tests 1 failed | 2845 passed (2846)
npx tsc --noEmit                rc=0
tests/discoveredShipsClean      8 passed (8)
git diff --cached --check       rc=0
```

> secret scan — scope: tracked
  files scanned:        20828
  CONTROL A (read):     20412 file(s) contain "docId"
  CONTROL B (matchers): all rules verified against synthetic samples

      jwt                 0 unexplained   (1 allowlisted)
      addressBare         0 unexplained
      addressLabelled     0 unexplained   (4 allowlisted)
      noobTokenJson       0 unexplained   (2 allowlisted)
      noobIdProse         0 unexplained   (8 allowlisted)
      usernameQuoted      0 unexplained   (12 allowlisted)
      privateKeyPem       0 unexplained
      privateKeyHex       0 unexplained

  allowlisted hits, printed so an exemption cannot quietly widen:

> PASS — no unexplained hits, both controls healthy.

> secret scan — scope: diff vs 76445cfa
  files scanned:        190
  (allowlist staleness not checked — only an exhaustive scope can tell stale from out-of-scope)
> PASS — no unexplained hits, both controls healthy.
```

(The allowlisted-hits block is deliberately NOT quoted — DECISIONS 2026-09-17: quoting it copies the synthetic vectors into a tracked file and fails the next scan.)
