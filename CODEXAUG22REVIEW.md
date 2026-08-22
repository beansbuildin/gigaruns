# Codex August 22 Review

**Reviewed commit:** `489c9892de745ae7444c37f0a972d630fad55763`  
**Review date:** 2026-08-22  
**Purpose:** Implementation handoff to Opus following a read-only architectural, correctness, security, and performance review.

## Executive summary

The repository is unusually well-instrumented and disciplined about failing closed, persisted budgets, captured evidence, and distinguishing live facts from simulator assumptions. The current suite is green and the recent assertion-coverage/CI work looks correct.

The two most important remaining issues are:

1. Live write operations do not share one safe transaction/reconciliation protocol. Some actions re-read authoritative state after an error, while starts, combat moves, and fishing card plays do not. The HTTP layer also retries non-idempotent POSTs after a delay approximately equal to the action-token lifetime.
2. Rule 8 deliberately selects modified enemies, but the live dungeon decision engine evaluates nearly all of those fights with a clean combat model that ignores rolled stats and all mechanics except corrode.

For fishing, the best plausible unexploited long-term lever is permanent deck-composition-aware card selection. Redraw increases simulated catch percentage, but its current mana price is poor and the disabled live branch is not behaviorally consistent with the corrected simulator.

For dungeon progression, mechanics modeling should come before another utility-weight sweep. Once the Rule 8 mechanics are represented, potion timing and move-policy ablations should be rerun against the corrected model.

## Implementation order

Recommended sequence:

1. Centralize non-idempotent action reconciliation and remove blind POST retries.
2. Add request deadlines and route ambiguous POST timeouts through reconciliation.
3. Extend dungeon exchange resolution for Rule 8 mechanics.
4. Recalibrate potion timing against the corrected Rule 8 model.
5. Build and evaluate permanent deck-composition-aware fishing loot selection.
6. Reconcile the live redraw branch with the simulator, but keep it disabled unless its resource economics improve and a live-policy gate is approved.
7. Apply the lower-priority CI, runtime declaration, action pinning, and capture-storage improvements.

## High-priority findings

### H1. Live writes do not share safe transaction/reconciliation semantics

**Files and relevant lines**

- `src/api/client.ts:190-217`
- `scripts/liveRun.ts:729-797`
- `scripts/liveRun.ts:1013-1037`
- `scripts/liveRun.ts:1217-1233`
- `scripts/liveFishing.ts:1594-1633`
- `scripts/liveFishing.ts:2395-2408`

**Issue**

`GigaverseClient.raw()` retries every HTTP 429, including POSTs, after a five-second delay using the same body and action token. The client itself documents an approximately five-second token window. Independently, dungeon/fishing starts and combat/card actions immediately fail on network or response errors without checking authoritative state, even though `postWithVerifiedRetry()` exists because the API has demonstrably applied writes despite returning errors.

Current behavior is inconsistent by action class:

- Reward and path selections reconcile after errors.
- Dungeon and fishing `start_run` do not.
- Dungeon combat moves do not.
- Fishing `play_cards`, redraw, oil use, and loot do not use one shared transaction abstraction.

**Potential impact**

- A `start_run` may be applied while the persisted energy/run ledger remains uncommitted.
- A run or cast may be abandoned with an unknown token state.
- A delayed POST retry may resend an expired token.
- A future caller may accidentally retry an applied action because correctness depends on remembering which helper to use.

**Smallest clean fix**

Do not automatically retry non-idempotent requests in the HTTP layer:

```ts
if (res.status === 429 && init?.method !== "GET") {
  return { status: res.status, text }; // action caller reconciles state
}
```

Create one action transaction helper that returns an explicit outcome such as `applied`, `not_applied`, or `unknown`:

```ts
const before = await readAuthoritativeState();
try {
  const response = await post();
  commitSpendOnce();
  return { outcome: "applied", response };
} catch (error) {
  const after = await readAuthoritativeState();
  if (transitionOccurred(before, after)) {
    commitSpendOnce();
    return { outcome: "applied", response: null };
  }
  if (stateProvesPending(before, after)) {
    return { outcome: "not_applied", error };
  }
  return { outcome: "unknown", error };
}
```

If an action applied but the next token is unknown, accounting should still be committed exactly once, followed by a fail-closed stop or an explicitly proven recovery path.

**Acceptance checks**

- A POST is never automatically replayed by `raw()`.
- Every irreversible action class passes through the same transaction result type.
- Tests cover applied-despite-error, definitely-pending, unreadable state, network timeout, 429, and exact-once guard accounting.
- No error path can apply a run/cast without updating the persisted ledger.

### H2. Rule 8 fights are evaluated with a combat model that declares them unscorable

**Files and relevant lines**

- `src/sim/types.ts:28-38`
- `src/sim/coverage.ts:145-194`
- `scripts/liveRun.ts:148-164`
- `src/sim/combat.ts:190-235`
- `src/strategy/decide.ts:177-204`

**Issue**

The coverage layer records that 617 of 622 non-Safe paths contain rolled stats that make them unscorable. Live lookahead still evaluates these states with the clean deterministic exchange model:

- `evasion`, `block`, `lck`, `tenacity`, and `intuition` are retained but never read by combat resolution.
- Only corrode is modeled from enemy buffs.
- Weak, Vulnerable, Burn, Regen, lifesteal, and other active/status effects are ignored in future plies.
- `decide()` consequently assigns precise EVs to states that the coverage system considers unsupported.

Recent Rule 8 responses contain these rolled stats and statuses, so this is an active modeling gap rather than theoretical dead code.

**Potential impact**

- Move rankings may be wrong in the exact higher-tier fights intended to improve rewards.
- Search can prefer a line whose apparent survival/damage result disappears when a proc or status is applied.
- Potion and utility sweeps performed on the clean model do not validate the live Rule 8 policy.
- The room-9 versus historical room-10 result is too small to establish causation, but the model defect exists independently of that comparison.

**Smallest clean fix**

Represent an exchange as probability-weighted branches rather than one deterministic state:

```ts
interface ExchangeBranch {
  p: number;
  state: BattleState;
}

function resolveExchangeBranches(
  state: BattleState,
  myMove: MoveKey,
  foeMove: MoveKey,
): ExchangeBranch[] {
  // Base RPS result.
  // Apply deterministic active-buff and status mechanics.
  // Split into proc/no-proc branches for rolled stats.
}
```

`decide()` should integrate these branches into both expected value and worst-case scoring.

Recommended implementation order:

1. Weak, Vulnerable, Regen, lifesteal, and Burn.
2. Block and evasion.
3. Tenacity, intuition, and luck after exact semantics are confirmed.

Until all mechanics are covered, live decision logs should report the specific unmodeled reasons instead of presenting the result as a fully supported EV.

**Acceptance checks**

- Every supported status/buff has positive and negative exchange tests.
- Coverage reasons disappear only when the corresponding mechanic is genuinely modeled.
- Existing clean/corrode replay accuracy does not regress.
- Rule 8 captured exchanges receive calibrated probability or outcome checks before the model is used for policy changes.

## Medium-priority findings

### M1. Requests have no deadline and can hold the global mutex indefinitely

**File:** `src/api/client.ts:190-217`

**Issue and impact**

`fetch()` has no abort signal. A stalled connection retains the only request mutex indefinitely, preventing reconciliation, shutdown at a later action boundary, and all further progress. On a POST, a timeout is an ambiguous write rather than proof that nothing applied.

**Smallest fix**

```ts
const res = await fetch(`${this.base}${path}`, {
  ...init,
  signal: AbortSignal.timeout(10_000),
  headers,
});
```

Route an abort during POST through H1's reconciliation protocol. GETs may be retried under a bounded policy.

### M2. Potion timing was optimized against the pre-Rule-8 model

**Files and relevant lines**

- `src/strategy/potions.ts:13-15`
- `scripts/liveRun.ts:1201-1214`
- `scripts/potionTimingSweep.ts:50-72`

**Issue**

The fixed `hp / hpMax <= 0.5` trigger was correctly swept against the clean simulator, but that simulator does not represent the statuses and proc damage now encountered under Rule 8. Recent live runs crossed from above the threshold to as low as 3/40 HP before the next potion check.

**Potential impact**

A free potion may be used only after a dangerous hit instead of before a credible lethal transition. Raising the global threshold without a better model could also waste limited potions, so this should not be solved by changing `0.5` blindly.

**Smallest fix after H2**

```ts
return potionsRemaining > 0 &&
  (hp / hpMax <= threshold || hp <= credibleNextExchangeHpDamage);
```

Use projected HP damage after armor, not raw enemy ATK. Re-sweep the rule on Rule 8 branches and compare rooms cleared, death room, and potions consumed.

### M3. Permanent fishing deck additions use a placeholder objective

**Files and relevant lines**

- `src/strategy/fishing/cardChoice.ts:665-684`
- `scripts/liveFishing.ts:1243-1261`

**Issue**

`chooseNewCard()` selects maximum raw damage-per-mana. It ignores existing deck composition, hit/crit geometry, miss penalties, redundant coverage, draw probability, and future hand quality. The source comment explicitly states that it has not been simulation-validated.

**Potential impact**

Each selection permanently changes every future cast. A locally efficient card can reduce whole-deck catch rate by duplicating existing coverage or increasing poor hands.

**Smallest clean fix**

Expand the numeric `fullDeck` through the static card catalog, insert each offered card, and run paired Monte Carlo simulations using identical fish trajectories and seeds:

```ts
const chosen = maxBy(offers, offer =>
  simulateDeck([...fullDeck, offer.id], pairedSeeds).catchRate,
);
```

Cache results by normalized deck composition. Do not run a large simulation inside the action-token-sensitive live loop; precompute or use a small lookup generated offline.

### M4. The disabled live redraw branch disagrees with the corrected simulator

**Files and relevant lines**

- `src/strategy/fishing/cardChoice.ts:759-775`
- `scripts/liveFishing.ts:2296-2362`
- `src/sim/fishing/castSim.ts:654-659`

**Issue**

The simulator now correctly records redraw as a fish observation and a turn. The disabled live branch still:

- Calls obsolete EV-based `shouldRedraw()` instead of `shouldRedrawOnConnect()`.
- Does not pass the moved cell to the matcher.
- Does not increment `turn`.

Enabling `redrawEnabled` would therefore desynchronize the movement model and turn guard.

**Measured context**

The corrected simulation reports:

- Never redraw: 24.9% catch.
- Derived trigger: 32.5% catch.
- Fresh-hand threshold: 40.1% catch.
- Derived trigger cost: approximately 43.9 extra mana per additional fish.
- Fresh-hand threshold cost: approximately 29.9 extra mana per additional fish.

Keeping redraw disabled is currently correct because its resource price is poor and a simulator result alone is insufficient authorization for live policy.

**Smallest consistency fix**

```ts
const toCell = fishCell(redrawResp.data.doc);
matcher = observe(matcher, toCell);
doc = redrawResp.data.doc;
turn++;
```

Then use `shouldRedrawOnConnect()` with the derived threshold. Keep the feature disabled until it passes shadow evaluation and an explicit live-policy gate.

## Low-priority findings

### L1. CI runs all 1,443 tests twice

**Files:** `.github/workflows/ci.yml:69-76`, `scripts/assertionCoverage.ts:68-72`

The normal Vitest step runs the suite, then assertion coverage starts the entire suite again. Use the assertion-aware run as the sole test step, or attach the assertion collector to the standard configuration through an environment flag.

### L2. The advertised Node engine includes unsupported versions

**Files:** `package.json:7-9`, `.github/workflows/ci.yml:53-57`, `package-lock.json:496`

The package says `>=20`, while Vite requires `^20.19.0 || >=22.12.0`. A user on Node 20.0-20.18 satisfies the project declaration but may not be able to run the toolchain.

```json
"engines": {
  "node": "^20.19.0 || >=22.12.0"
}
```

### L3. GitHub Actions use mutable major-version tags

**File:** `.github/workflows/ci.yml:51-55`

`actions/checkout@v5` and `actions/setup-node@v5` are mutable tags. Existing read-only permissions limit impact, but pinning reviewed commit SHAs provides stronger supply-chain integrity. Retain a version comment beside each SHA for readability.

### L4. Live responses are synchronously stored up to three times

**Files and relevant lines**

- `scripts/liveRun.ts:479-485`
- `scripts/liveRun.ts:509-510`
- `scripts/liveRun.ts:1231-1233`
- `scripts/liveFishing.ts:1094-1099`
- `scripts/liveFishing.ts:2406-2408`

A response is often serialized into the JSONL log, a raw fixture, and a redacted fixture. The reviewed workspace contained approximately 157 MB of fixtures and 15 MB of logs.

Keep the raw/redacted fixture pair, but log only the fixture tag, action, status, room/turn, and important deltas. Extract the duplicated `FixtureWriter`/`RunLog` implementations into a shared capture module so future redaction or durability fixes cannot drift between dungeon and fishing.

## Autofisher assessment

The recorded aggregate is 36 catches from 128 casts, or 28.1%, but it combines multiple policy eras and should not be treated as one stationary baseline.

Recommended priority:

1. Permanent deck-composition-aware loot selection.
2. Preserve and further validate the armed `nextPosition` tripwire/mixture, which currently looks clean.
3. Correct the live redraw implementation for consistency, but keep it disabled on current economics.
4. Do not prioritize the documented `pConnect` +9.38 percentage-point optimism unless a new level-sensitive live consumer appears. Existing level gates almost never fire and rank-based consumers are less affected by a roughly uniform bias.
5. Keep the suspended focus-policy work suspended until the harness reproduces live opening focus spend; optimizing against a policy model that under-spends focus by roughly half is not reliable.

## Dungeon assessment

The recent Rule 8 deaths at rooms 6, 7, 9, and 8 do not provide enough evidence to conclude that Rule 8 itself reduced progression relative to the historical room-10 record, especially because equipment changed before the fourth run.

The most defensible progression sequence is:

1. Model the modified-enemy mechanics selected by Rule 8.
2. Replay captured exchanges and validate branch probabilities/effects.
3. Re-run potion timing against the corrected model.
4. Re-run move-depth, ambiguity, charge-reserve, and boon-policy ablations only after the simulator can score the relevant fights.

The Rule 8 tier selector, independent tier audit, final-room exception, and Perpetual filtering look clean and should not be reverted based on the current small outcome sample.

## Modules that look clean

No critical or reliable issue was found in these reviewed areas:

- Session 77's assertion-count instrumentation and repaired dungeon test.
- Guard-state atomic persistence, rollover key, and process lock.
- Rule 8 tier choice and independent in-loop audit.
- `nextPosition` arming threshold, mixture weight, and first-miss disarm tripwire.
- Current decision to keep redraw disabled.
- Current decision not to ship focus-budget or oil-conservation policies whose evaluation gates failed.
- Credential redaction for committed fixtures and the sanitized published history.

## Validation baseline

The following read-only validation completed successfully at the reviewed commit:

- `npm test`: 87 test files, 1,443 tests passed.
- `npm run typecheck`: passed.
- `npm run test:assertions`: 1,443 tests counted, zero vacuous tests.
- `git diff --check`: passed.
- Worktree was clean after review.

## Context that would materially improve implementation

The following direct evidence would reduce guesswork, if available:

- Authoritative mechanics or captures for evasion, block, luck, tenacity, and intuition.
- Exchange-level captures isolating Weak, Vulnerable, Burn, Regen, and lifesteal.
- A complete fishing card catalog mapping card IDs to zones/effects for deck simulation.
- Confirmation of draw/shuffle behavior when `fullDeck` grows beyond the currently observed sizes.

These inputs are helpful but do not block H1, M1, the Node/CI fixes, or construction of the deck-evaluation harness.
