/**
 * scripts/liveRun.ts — Task 6, staged per session-08 brief §5. The first
 * script in this repo that can send a dungeon action.
 *
 *   npx tsx scripts/liveRun.ts --dry-run     # stage 1: decide, log, POST nothing
 *   npx tsx scripts/liveRun.ts --stage2      # stage 2: exactly one start_run POST, then halt
 *   npx tsx scripts/liveRun.ts --runs=1      # stage 3: one full run
 *   npx tsx scripts/liveRun.ts --runs=5      # stage 4: five runs
 *
 * Every stage after --dry-run requires config/bot.json + config/discovered.json
 * (loadBotConfig fails closed if either is missing) and a live JWT.
 *
 * **What's CONFIRMED vs INFERRED in the action layer**, so the next reader
 * doesn't mistake one for the other (CLAUDE.md §2, "never invent an
 * endpoint"):
 *   - `start_run`, `rock`, `paper`, `scissor` — CONFIRMED, SPEC §2.
 *   - `reward_one`/`reward_three` (reward-path pick) — CONFIRMED live
 *     2026-08-14, session 08 Task 6 stage 3: `loot_one` (the original
 *     hypothesis, matching SPEC §2's only documented index-selecting
 *     actions) was rejected HTTP 409; the user captured the real client
 *     sending `reward_one` for the same pick via DevTools, and this client's
 *     own `postWithVerifiedRetry()` later landed a successful
 *     `reward_three` (`AddBlock`, room 4). `reward_two`/`four` inferred by
 *     the same naming pattern, not individually confirmed. `data.index`
 *     matches the option's array position for this family.
 *   - `path_two` (enemy-tier pick) — CONFIRMED live 2026-08-14, same
 *     session: `enemy_one`/`enemy_two`/`enemy_three` (a hypothesis on the
 *     `reward_*` pattern) failed 3/3 live, including one HTTP 400 on an
 *     otherwise identical retry — a strong signal of a wrong name, not
 *     flakiness. The user then captured the real client sending `path_two`
 *     for the same pick via DevTools. `path_one`/`path_three` inferred by
 *     the same pattern, not individually confirmed. **`data.index` is `0`
 *     for this family regardless of the option's array position** — the
 *     captured `path_two` picked `enemyPathOptions[1]` but sent
 *     `data.index: 0`, unlike `reward_*`. One sample; reproduced literally,
 *     not extrapolated further. The guard's fail-closed-on-failure behavior
 *     means a wrong guess halts the run rather than corrupting it — this is
 *     exactly how `enemy_*` was caught.
 *
 * Fixtures land in `fixtures/dungeon-runs/run-<stamp>/`, same shape as
 * `scripts/watch.ts` (raw/ unredacted + redacted top-level), so live play
 * grows the corpus automatically — session-08 brief §4.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { GigaverseClient } from "../src/api/client.js";
import type { DungeonAction, DungeonActionRequest, DungeonActionResponse, DungeonState } from "../src/api/schemas.js";
import { TokenExpiredError, UnexpectedResponseError } from "../src/api/errors.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip } from "../src/orchestrator/guards.js";
import { loadGuardBudget, saveGuardBudget } from "../src/orchestrator/guardPersistence.js";
import { toCombatant, type WireRun, type WireSide, type WireBoon } from "../src/sim/corpus.js";
import { MOVES, type BattleState, type MoveKey } from "../src/sim/types.js";
import type { BoonOption } from "../src/sim/boons.js";
import { decide, formatDecision, type Decision } from "../src/strategy/decide.js";
import { LIVE_CONFIG, type StrategyConfig } from "../src/strategy/config.js";
import { OpponentModel, modelKey } from "../src/strategy/opponentModel.js";
import { pickLowestTier } from "../src/strategy/enemyTier.js";
import { SAFE_TIER } from "../src/sim/enemies.js";
import { pickBoon } from "../src/strategy/loot.js";

// ---------------------------------------------------------------------------
// Pure decision helpers — no network, unit-testable directly.
// ---------------------------------------------------------------------------

export type Phase = "combat" | "enemyPath" | "rewardPath" | "loot" | "over";

/** Reads the phase flags directly rather than inferring a state machine — same rule as corpus.ts's exchanges(). */
export function classifyPhase(run: WireRun | null | undefined): Phase {
  if (!run) return "over";
  const r = run as WireRun & { enemyPathPhase?: boolean; rewardPathPhase?: boolean; lootPhase?: boolean };
  if (r.enemyPathPhase) return "enemyPath";
  if (r.rewardPathPhase) return "rewardPath";
  if (r.lootPhase) return "loot";
  const [me, foe] = run.players;
  if (!me || !foe || me.health.current <= 0 || foe.health.current <= 0) return "over";
  return "combat";
}

export function buildBattleState(run: WireRun, roomNum: number): BattleState {
  const [me, foe] = run.players as [WireSide, WireSide];
  return { me: toCombatant(me), foe: toCombatant(foe), room: roomNum };
}

export function moveToAction(m: MoveKey): DungeonAction {
  return m; // MoveKey ("rock"|"paper"|"scissor") IS the wire action name — SPEC §2.
}

/**
 * Every key `scripts/fieldFrequency.ts` has ever seen on a player/enemy side,
 * across all 230 corpus observations (session-08 brief addendum §7, check 1
 * — see SPEC §4e). Used only to detect a NEW key live; nothing here treats
 * this list as exhaustive or authoritative.
 */
export const KNOWN_SIDE_KEYS: ReadonlySet<string> = new Set([
  "_id",
  "activeEffects",
  "battleArmorReduction",
  "block",
  "evasion",
  "focusBuffs",
  "gearBoons",
  "health",
  "id",
  "intuition",
  "lastMove",
  "lck",
  "otherPlayerWin",
  "paper",
  "pickedBoons",
  "rock",
  "scissor",
  "shield",
  "statusEffects",
  "tenacity",
  "thisPlayerWin",
  "triggeredBoons",
]);

/**
 * Check 2 of the addendum §7 `intuition` plan: "add detection to the live
 * loop... log the full raw state whenever an unexpected key appears. At
 * machine speed this resolves within a session or two on its own." Generic
 * over any mechanic, not just intuition — any new key is worth a look.
 */
export function unknownSideKeys(side: Record<string, unknown>): string[] {
  return Object.keys(side).filter((k) => !KNOWN_SIDE_KEYS.has(k));
}

const REWARD_ACTIONS: readonly DungeonAction[] = ["reward_one", "reward_two", "reward_three", "reward_four"];
const PATH_ACTIONS: readonly DungeonAction[] = ["path_one", "path_two", "path_three"];

/**
 * `reward_<n>` for a reward-path pick — CONFIRMED live 2026-08-14 (session
 * 08, Task 6 stage 3: `loot_one` was rejected HTTP 409, the user captured
 * the real client sending `reward_one` for the same pick via DevTools;
 * `reward_three` separately confirmed by this client's own successful
 * `AddBlock` pick, room 4). Throws on index >= 4 — the corpus has never
 * shown an offer with more than 3 options, so a 4th would itself be a
 * surprise worth stopping on.
 */
export function selectRewardByIndex(index: number): DungeonAction {
  const action = REWARD_ACTIONS[index];
  if (!action) throw new Error(`selectRewardByIndex(${index}) — no reward_* action for an index this large`);
  return action;
}

/**
 * `path_<n>` for the enemy-tier pick — CONFIRMED live 2026-08-14 (session
 * 08: `enemy_two` failed 3/3 live, including one HTTP 400 on an otherwise
 * identical retry; the user captured the real client sending `path_two` for
 * the same pick). `path_one`/`path_three` inferred by the same pattern, not
 * individually confirmed.
 */
export function selectEnemyPathByIndex(index: number): DungeonAction {
  const action = PATH_ACTIONS[index];
  if (!action) throw new Error(`selectEnemyPathByIndex(${index}) — no path_* action for an index this large`);
  return action;
}

/** `rewardPathOptions[].boon` -> the sim's BoonOption shape (src/sim/boons.ts). */
export function wireBoonToOption(w: WireBoon): BoonOption {
  return { type: w.boonTypeString, val1: w.selectedVal1, val2: w.selectedVal2 };
}

/** Value equality for a boon option — never reference equality, since a re-fetched offer builds fresh objects. */
function boonOptionsEqual(a: BoonOption, b: BoonOption): boolean {
  return a.type === b.type && a.val1 === b.val1 && a.val2 === b.val2;
}

/**
 * [session 09] Re-locates the INTENDED reward by identity (type + applied
 * values), never by the array position captured at decision time. Session
 * 08's `postWithVerifiedRetry` re-checked whether the pick was still pending
 * before retrying, but retried by resending the original `data.index` — if a
 * retry landed after the offer itself changed underneath it, that index
 * could now point at a different boon, and the fixture would record the
 * INTENDED boon rather than the one actually applied (session-09 brief §1).
 * Returns `null` if the intended boon is no longer present, so the caller
 * halts instead of guessing.
 */
export function locateRewardOption(run: WireRun, chosen: BoonOption): number | null {
  const r = run as WireRun & { rewardPathOptions?: Array<{ index: number; boon: WireBoon }> };
  const options = r.rewardPathOptions ?? [];
  const i = options.findIndex((o) => boonOptionsEqual(wireBoonToOption(o.boon), chosen));
  return i === -1 ? null : i;
}

/**
 * [session 09] Re-locates the intended tier option by identity — "whichever
 * position currently holds the LOWEST tier offered" — rather than trusting
 * the array position captured at decision time. Under the generalized
 * lowest-tier rule (CLAUDE.md §8, `pickLowestTier`) this is dynamic by
 * design: the rule doesn't target a specific tier number, it targets
 * "whatever's lowest right now," so re-deriving from fresh state on every
 * retry attempt is exactly correct, not an approximation. Returns `null`
 * only on a genuinely empty offer, which halts the run rather than guessing.
 */
export function locateLowestTierOption(run: WireRun): number | null {
  const r = run as WireRun & { enemyPathOptions?: Array<{ tier: number; index: number }> };
  const options = r.enemyPathOptions ?? [];
  if (options.length === 0) return null;
  let bestIdx = 0;
  for (let i = 1; i < options.length; i++) {
    if (options[i]!.tier < options[bestIdx]!.tier) bestIdx = i;
  }
  return bestIdx;
}

export function buildEnvelope(
  action: DungeonAction,
  dungeonId: number,
  actionToken: number,
  index = 0,
): DungeonActionRequest {
  return { action, dungeonId, actionToken, data: { consumables: [], isJuiced: false, index } };
}

/**
 * [session 08, live] Path-selection actions (reward/enemy-tier picks) use a
 * DIFFERENT envelope convention than combat/start_run, confirmed live via
 * DevTools: `dungeonId: 0` (not the run's real dungeon id), `actionToken: ""`
 * (an empty STRING, not a number), and four extra `data` fields the combat
 * envelope never sends. Matched exactly rather than guessed at, since a
 * subtly-wrong envelope is exactly the kind of thing that produces another
 * confusing rejection.
 *
 * `index` is the caller's responsibility to get right per action family —
 * they are NOT the same convention. `reward_<n>` wants `data.index` equal to
 * the option's array position (confirmed: this client's own successful
 * `reward_three`/`AddBlock` pick sent `index: 2`). `path_<n>` wants `0`
 * regardless of position (confirmed: the captured `path_two` — picking
 * `enemyPathOptions[1]` — sent `index: 0`, not `1`). Callers pass what's
 * right for their family; this function does not guess.
 */
export function buildPathSelectionEnvelope(action: DungeonAction, index: number): DungeonActionRequest {
  return {
    action,
    dungeonId: 0,
    actionToken: "",
    data: { consumables: [], isJuiced: false, index, itemId: 0, expectedAmount: 0, gearInstanceIds: [], devBoons: [] },
  };
}

// ---------------------------------------------------------------------------
// Fixture writing — same shape as scripts/watch.ts, minus the poll-noise hash
// gate (every state here is one WE caused, not a 2.5s poll).
// ---------------------------------------------------------------------------

function redact(raw: string, address: string, jwt: string): string {
  let s = raw;
  for (const form of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (form) s = s.split(form).join("0xUSER");
  }
  if (jwt) s = s.split(jwt).join("<JWT>");
  return s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
}

function stamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

class FixtureWriter {
  private n = 0;
  private readonly out: string;
  private readonly raw: string;

  constructor(
    private readonly address: string,
    private readonly jwt: string,
  ) {
    this.out = join("fixtures", "dungeon-runs", `run-${stamp()}`);
    this.raw = join(this.out, "raw");
    mkdirSync(this.raw, { recursive: true });
  }

  write(body: unknown): void {
    const tag = String(this.n).padStart(3, "0");
    const text = JSON.stringify(body, null, 2);
    writeFileSync(join(this.raw, `state-${tag}.json`), text);
    writeFileSync(join(this.out, `state-${tag}.json`), redact(text, this.address, this.jwt));
    this.n++;
  }

  get dir(): string {
    return this.out;
  }
}

// ---------------------------------------------------------------------------
// Structured JSONL logging — SPEC §7.
// ---------------------------------------------------------------------------

class RunLog {
  private readonly path: string;
  constructor() {
    mkdirSync("logs", { recursive: true });
    this.path = join("logs", `run-${stamp()}.jsonl`);
  }
  write(entry: Record<string, unknown>): void {
    writeFileSync(this.path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n", { flag: "a" });
  }
  get filePath(): string {
    return this.path;
  }
}

// ---------------------------------------------------------------------------
// The live loop.
// ---------------------------------------------------------------------------

export interface LiveRunDeps {
  client: GigaverseClient;
  config: BotConfig;
  guards: GuardState;
  model: OpponentModel;
  strategyConfig: StrategyConfig;
  fixtures: FixtureWriter;
  log: RunLog;
  dryRun: boolean;
  /**
   * Where `saveGuardBudget` persists after every guard mutation. Defaults to
   * `DEFAULT_GUARD_STATE_PATH` (`data/guard-budget.json`) in `main()`.
   * Injectable so tests exercising `runOnce` against a mocked client never
   * write to the real project `data/` dir — session 09 found exactly this
   * happening (a test run left a stale `runsStarted: 1` seed on disk that a
   * later real `--dry-run` invocation then reported back as "already
   * spent").
   */
  guardStatePath?: string;
}

/** Records `false` on guards and re-throws — the shared shape of every failure path. */
function fail(guards: GuardState, log: RunLog, reason: string, detail?: Record<string, unknown>): never {
  guards.recordActionResult(false);
  log.write({ event: "action_failed", reason, detail });
  throw new GuardTrip(reason, detail);
}

/**
 * POST an action, retrying ONLY after re-verifying it genuinely didn't
 * apply. [session 08, live] `reward_one` returned HTTP 500 twice on an
 * otherwise byte-identical request — once where the pick had silently
 * applied server-side anyway (`pickedBoons` had grown despite the error),
 * once where it hadn't. Blindly retrying risks double-applying a pick;
 * blindly giving up on the first 500 means every transient server error
 * needs a human to unblock it. This checks live state after every failure
 * and only retries while `isPending` says the action truly never landed.
 *
 * [session 09] `reward_*`/`path_*` address their option by ARRAY POSITION,
 * and session 08's version resent the position captured at decision time on
 * every retry. That's a stale-index bug waiting to happen: if the offer
 * itself changed between the failed attempt and a retry, a resent index
 * could land on a DIFFERENT option than intended, and the fixture would
 * record the option we MEANT to pick, not the one the server actually
 * applied — silently poisoning `BOON_MODELS` (session-09 brief §1). Fixed by
 * re-deriving the index from the freshly-fetched state on every attempt,
 * including the first: `locate` finds the intended option by STABLE IDENTITY
 * (a boon's type+values, or "whichever position is tier 0"), never by
 * position. If identity lookup fails — the intended option is genuinely gone
 * — this halts via GuardTrip rather than ever picking whatever now sits at
 * the old position.
 *
 * Relies on `guards.recordActionResult(false)` to throw once
 * `maxConsecutiveActionFailures` (config/bot.json) is reached — that's the
 * single source of truth for the retry ceiling, not a separate constant
 * here. `TokenExpiredError` is never retried, per SPEC §6.
 */
export async function postWithVerifiedRetry(
  client: GigaverseClient,
  guards: GuardState,
  log: RunLog,
  initialRun: WireRun,
  locate: (run: WireRun) => number | null,
  buildBody: (index: number) => DungeonActionRequest,
  isPending: (run: WireRun) => boolean,
  reason: string,
): Promise<DungeonActionResponse | null> {
  let run = initialRun;
  for (;;) {
    const index = locate(run);
    if (index === null) {
      log.write({ event: "intended_option_missing", reason });
      throw new GuardTrip(`${reason}: intended option no longer present in live offer`, {});
    }
    const body = buildBody(index);
    log.write({ event: "post", body });
    try {
      const resp = await client.postDungeonAction(body);
      guards.recordActionResult(true);
      log.write({ event: "post_response", resp });
      return resp;
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      log.write({ event: "post_attempt_failed", reason, error: (e as Error).message });

      const fresh = await client.getDungeonState();
      const freshRun = fresh ? (fresh.data.run as unknown as WireRun) : null;
      const pending = freshRun ? isPending(freshRun) : false;
      if (!pending) {
        // Applied despite the error response (or the run moved on for some
        // other reason) — never retry an action that already landed.
        log.write({ event: "action_applied_despite_error" });
        guards.recordActionResult(true);
        return null;
      }
      guards.recordActionResult(false); // throws GuardTrip once the configured limit is hit
      run = freshRun!; // re-derive `index` against this freshly-fetched offer next loop
    }
  }
}

/**
 * One dungeon run, start to finish. Returns when the run ends (win, death, or
 * flee) or a guard trips. In `--dry-run`, never calls `postDungeonAction` —
 * it polls state and logs every decision it WOULD have sent.
 */
export async function runOnce(deps: LiveRunDeps, opts: { stage2Only?: boolean } = {}): Promise<void> {
  const { client, config, guards, model, strategyConfig, fixtures, log, dryRun, guardStatePath } = deps;

  let prevFoeMove: MoveKey | null = null;
  let lastFoeId: string | null = null;
  const playCounts: Record<MoveKey, number> = { rock: 0, paper: 0, scissor: 0 };

  guards.assertCanStartRun(config.energyCostPerRun);

  // Check BEFORE deciding to start_run — CLAUDE.md §1, don't assume. A prior
  // stage (or a prior crashed process) can leave a run active; sending
  // start_run on top of one is rejected by the server (HTTP 400, "Error
  // starting dungeon" — confirmed live, session 08 stage 3's first attempt)
  // rather than silently resetting or stacking runs.
  const existing = await client.getDungeonState();

  if (existing) {
    const room = existing.data.entity?.ROOM_NUM_CID ?? "?";
    console.log(`  · active run already exists at room ${room} — resuming rather than starting a new one`);
    log.write({ event: "resuming_existing_run", room });
    if (opts.stage2Only) {
      console.log(`  ▸ stage 2 has nothing to send (a run is already active) — halting without a POST.`);
      return;
    }
  } else if (dryRun) {
    log.write({ event: "dry_run_start_run_intended", dungeonId: config.dungeonId });
    console.log(`  [dry-run] would POST start_run (dungeonId ${config.dungeonId})`);
    console.log(`  · no active run — nothing further to decide against, stopping.`);
    return;
  } else {
    const body = buildEnvelope("start_run", config.dungeonId, client.getActionToken());
    log.write({ event: "post", body });
    let resp;
    try {
      resp = await client.postDungeonAction(body);
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      fail(guards, log, "start_run rejected", { error: (e as Error).message });
    }
    guards.recordActionResult(true);
    guards.recordRunStarted();
    saveGuardBudget(guards.spentEnergy, guards.runCount, guardStatePath); // [session 09] persist immediately — see guardPersistence.ts
    log.write({ event: "post_response", resp });
    fixtures.write(resp);
    console.log(`  ✓ start_run sent — actionToken now ${client.getActionToken()}`);
    if (opts.stage2Only) {
      console.log(`  ▸ stage 2: exactly one POST, halting unconditionally per session-08 brief §5.`);
      return;
    }
  }

  for (;;) {
    let state: DungeonState | null;
    try {
      state = await client.getDungeonState();
    } catch (e) {
      if (e instanceof UnexpectedResponseError) {
        log.write({ event: "unexpected_response", status: e.status, path: e.path, body: e.body });
      }
      throw e;
    }
    if (!state) {
      log.write({ event: "run_ended_or_absent" });
      console.log(`  · no active run — stopping.`);
      return;
    }
    fixtures.write(state);

    const run = state.data.run as unknown as WireRun;
    const roomNum = (state.data.entity as { ROOM_NUM_CID?: number } | undefined)?.ROOM_NUM_CID ?? 0;
    const phase = classifyPhase(run);

    const stateKey = JSON.stringify({ run: run, room: roomNum, phase });
    try {
      guards.checkStateProgress(stateKey);
    } catch (e) {
      log.write({ event: "guard_trip", error: (e as Error).message });
      throw e;
    }

    const [meWire, foeWire] = run.players as [WireSide, WireSide];
    if (foeWire.id !== lastFoeId) {
      prevFoeMove = null; // fresh entity — no predecessor move (SPEC §4a).
      lastFoeId = foeWire.id;
    }

    // Addendum §7 check 2: at machine speed this should resolve `intuition`
    // (and anything else unmodelled) within a session or two on its own.
    for (const [label, wire] of [
      ["me", meWire],
      ["foe", foeWire],
    ] as const) {
      const unknown = unknownSideKeys(wire as unknown as Record<string, unknown>);
      if (unknown.length > 0) {
        log.write({ event: "unknown_side_key", side: label, keys: unknown, raw: wire });
        console.log(`  ★ unknown key(s) on ${label}: ${unknown.join(", ")} — full state logged`);
      }
    }

    if (phase === "over") {
      log.write({ event: "run_over", room: roomNum });
      console.log(`  ▸ run over at room ${roomNum}.`);
      return;
    }

    if (phase === "combat") {
      const battle = buildBattleState(run, roomNum);
      const d: Decision = decide(battle, model, strategyConfig, prevFoeMove);
      console.log(formatDecision(battle, d));
      log.write({ event: "decision", room: roomNum, move: d.move, ev: d.table });

      if (dryRun) {
        console.log(`  [dry-run] would POST ${d.move}`);
        return; // one decision is enough to prove stage 1 works; don't loop forever on a live read.
      }

      const body = buildEnvelope(moveToAction(d.move), config.dungeonId, client.getActionToken());
      log.write({ event: "post", body });
      let resp;
      try {
        resp = await client.postDungeonAction(body);
      } catch (e) {
        if (e instanceof TokenExpiredError) throw e; // JWT rejected — never retry, SPEC §6.
        fail(guards, log, "dungeon action rejected", { action: d.move, error: (e as Error).message });
      }
      guards.recordActionResult(true);
      log.write({ event: "post_response", resp });
      fixtures.write(resp);

      const afterRun = resp!.data.run as unknown as WireRun | undefined;
      if (afterRun) {
        const foeAfter = afterRun.players[1] as WireSide;
        const foeMove = foeAfter.lastMove;
        if ((MOVES as readonly string[]).includes(foeMove)) {
          model.observe(modelKey(foeWire.id, roomNum), foeMove as MoveKey, prevFoeMove);
          prevFoeMove = foeMove as MoveKey;
          playCounts[d.move]++;
        }
      }
      continue;
    }

    if (phase === "enemyPath") {
      const r = run as WireRun & { enemyPathOptions?: Array<{ tier: number; index: number }> };
      const options = r.enemyPathOptions ?? [];
      let chosen: { tier: number; index: number };
      try {
        chosen = pickLowestTier(options);
      } catch (e) {
        // Only an empty offer throws here now (see enemyTier.ts) — a
        // genuinely new kind of surprise, unlike "no Safe tier" (session 09,
        // no longer treated as an error — see below).
        log.write({ event: "empty_enemy_path_options", error: (e as Error).message, options });
        console.log(`  ✗ ${(e as Error).message}`);
        throw e;
      }
      const safeOffered = options.some((o) => o.tier === SAFE_TIER);
      const posn = options.indexOf(chosen); // array position — what selectEnemyPathByIndex needs, NOT the wire's own .index field
      console.log(
        `  ▸ enemy path: choosing lowest offered tier ${chosen.tier}${chosen.tier === SAFE_TIER ? " (Safe)" : " — NOT Safe, none was offered (session-09: expected, not a bug)"}`,
      );
      log.write({ event: "tier_choice", chosen, position: posn, options, safeOffered });

      if (dryRun) {
        console.log(`  [dry-run] would POST ${selectEnemyPathByIndex(posn)} (data.index 0 — see buildPathSelectionEnvelope)`);
        return;
      }
      // Index is re-derived by identity — "whichever position currently
      // holds the lowest tier" — on every attempt, including this first
      // one, never resent from `posn` captured above, per
      // postWithVerifiedRetry's doc comment (session-09 brief §1). data.index
      // in the POST body is 0 regardless of position — confirmed live, see
      // buildPathSelectionEnvelope.
      const resp = await postWithVerifiedRetry(
        client,
        guards,
        log,
        run,
        (freshRun) => locateLowestTierOption(freshRun),
        (index) => buildPathSelectionEnvelope(selectEnemyPathByIndex(index), 0),
        (freshRun) => classifyPhase(freshRun) === "enemyPath",
        "enemy path selection rejected",
      );
      if (resp) fixtures.write(resp);
      continue;
    }

    if (phase === "rewardPath") {
      const r = run as WireRun & {
        rewardPathOptions?: Array<{ index: number; boon: WireBoon }>;
      };
      const options = r.rewardPathOptions ?? [];
      const player = toCombatant(meWire);
      const mapped = options.map((o, i) => ({ wireIndex: i, option: wireBoonToOption(o.boon) }));
      const chosenOption = pickBoon(
        player,
        mapped.map((m) => m.option),
        roomNum,
        { playCounts },
      );
      const chosenEntry = mapped.find((m) => m.option === chosenOption)!;
      const chosenIndex = chosenEntry.wireIndex;
      console.log(`  ▸ reward: picking "${chosenOption.type}" (index ${chosenIndex})`);
      log.write({ event: "boon_choice", chosen: chosenOption, chosenIndex, options });

      if (dryRun) {
        console.log(`  [dry-run] would POST ${selectRewardByIndex(chosenIndex)} (index ${chosenIndex})`);
        return;
      }
      // Index is re-derived by identity (boon type + applied values) on
      // every attempt, including this first one — never resent from
      // `chosenIndex` captured above, per postWithVerifiedRetry's doc
      // comment (session-09 brief §1): a retry after the offer changed must
      // not silently pick whatever now sits at the old position.
      const resp = await postWithVerifiedRetry(
        client,
        guards,
        log,
        run,
        (freshRun) => locateRewardOption(freshRun, chosenOption),
        (index) => buildPathSelectionEnvelope(selectRewardByIndex(index), index),
        (freshRun) => classifyPhase(freshRun) === "rewardPath",
        "reward selection rejected",
      );
      if (resp) fixtures.write(resp);
      continue;
    }

    // phase === "loot" — never observed populated in the corpus (DECISIONS
    // 2026-08-14: lootOptions/lootPhase are not the reward surface). Log and
    // halt rather than guess at it live.
    log.write({ event: "unexpected_loot_phase", run });
    console.log(`  ✗ lootPhase active and unhandled — halting per CLAUDE.md §5 (unexpected state).`);
    throw new GuardTrip("unhandled lootPhase", {});
  }
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const stage2 = argv.includes("--stage2");
  const runsArg = argv.find((a) => a.startsWith("--runs="));
  const runs = runsArg ? Number(runsArg.split("=")[1]) : 1;
  return { dryRun, stage2, runs };
}

/**
 * Observed energy, never assumed — CLAUDE.md §1. `guards.recordEnergySpent()`
 * needs the real before/after delta, not `config.energyCostPerRun`, which is
 * only used as a pre-spend ESTIMATE by `assertCanStartRun`.
 */
async function currentEnergy(client: GigaverseClient, address: string): Promise<number> {
  const energy = await client.getEnergy(address);
  const value = energy.entities[0]?.parsedData?.energyValue;
  if (typeof value !== "number") {
    throw new Error("GET /offchain/player/energy — entities[0].parsedData.energyValue missing or not a number");
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`\n▸ liveRun.ts — ${args.dryRun ? "STAGE 1 dry-run" : args.stage2 ? "STAGE 2 single POST" : `${args.runs} run(s)`}\n`);

  const config = loadBotConfig();
  const client = new GigaverseClient();
  // [session 09] Seed from today's already-spent energy/runs so the budget
  // holds across separate process invocations, not just within one — see
  // guardPersistence.ts.
  const seed = loadGuardBudget();
  if (seed.energySpent > 0 || seed.runsStarted > 0) {
    console.log(`  · resuming today's budget: ${seed.energySpent} energy / ${seed.runsStarted} runs already spent`);
  }
  const guards = new GuardState(
    {
      dailyEnergyBudget: config.dailyEnergyBudget,
      maxRunsPerSession: config.maxRunsPerSession,
      maxConsecutiveActionFailures: config.maxConsecutiveActionFailures,
    },
    seed,
  );
  const model = new OpponentModel();
  const log = new RunLog();

  const me = await client.getMe();
  const account = await client.getAccount(me.address);
  const fixtures = new FixtureWriter(me.address, client.maskedJwt().split("...")[0]!);
  console.log(`  account <USER> noobId ${account.noob?.docId ? "<NOOB>" : "(none)"}`);

  const targetRuns = args.dryRun || args.stage2 ? 1 : args.runs;
  for (let i = 0; i < targetRuns; i++) {
    console.log(`\n▸ run ${i + 1}/${targetRuns}`);
    const before = args.dryRun ? null : await currentEnergy(client, me.address);
    // [session 09, LIVE] `runOnce` can throw mid-run (a guard trip is exactly
    // what it's FOR — see the no-Safe-tier halt this session). The energy
    // accounting below used to sit after an unguarded `await runOnce(...)`,
    // so a thrown run skipped it entirely: real energy had already been
    // spent (start_run), but the persisted budget never recorded it. Caught
    // here so accounting always runs, then re-thrown so the process still
    // exits non-zero exactly as before — CLAUDE.md §5's fail-closed behavior
    // is unchanged, only the bookkeeping around it.
    let runError: unknown = null;
    try {
      await runOnce(
        { client, config, guards, model, strategyConfig: LIVE_CONFIG, fixtures, log, dryRun: args.dryRun },
        { stage2Only: args.stage2 },
      );
    } catch (e) {
      runError = e;
    }
    if (before !== null) {
      // Regen runs concurrently (SPEC: ~18/hr, more if juiced), so a real
      // spend can be masked by a few seconds of regen on a short action —
      // clamp at 0 rather than ever recording a negative spend.
      const after = await currentEnergy(client, me.address);
      const delta = Math.max(0, before - after);
      try {
        guards.recordEnergySpent(delta);
      } finally {
        // Persist even if this throws (budget exceeded) — `energySpent` is
        // already mutated by the time the check runs (guards.ts), and the
        // energy was genuinely spent in-game either way. Under-persisting a
        // failed call would let a process restart forget real spend and
        // re-attempt past the budget.
        saveGuardBudget(guards.spentEnergy, guards.runCount);
      }
      log.write({ event: "energy_accounting", before, after, delta });
      console.log(`  ▸ energy: ${before} -> ${after}  (spent ${delta})`);
    }
    if (runError) throw runError;
    if (args.stage2) break;
  }

  console.log(`\n▸ done. energy spent (guard-tracked) ${guards.spentEnergy}, runs ${guards.runCount}`);
  console.log(`▸ log: ${log.filePath}`);
  console.log(`▸ fixtures: ${fixtures.dir}\n`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("liveRun.ts");
if (isMain) {
  main().catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    if (e instanceof GuardTrip) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof UnexpectedResponseError) console.error(`  status ${e.status}  path ${e.path}\n  body: ${e.body}`);
    process.exit(1);
  });
}
