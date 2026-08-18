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
import { acquireGuardLock, loadGuardBudget, saveGuardBudget, todayKey } from "../src/orchestrator/guardPersistence.js";
import { reconcileEnergyAccounting, describeEnergyAccounting } from "../src/orchestrator/energyAccounting.js";
import { toCombatant, type WireRun, type WireSide, type WireBoon } from "../src/sim/corpus.js";
import { MOVES, type BattleState, type MoveKey } from "../src/sim/types.js";
import type { BoonOption } from "../src/sim/boons.js";
import { decide, formatDecision, type Decision } from "../src/strategy/decide.js";
import { LIVE_CONFIG, type StrategyConfig } from "../src/strategy/config.js";
import { OpponentModel, modelKey } from "../src/strategy/opponentModel.js";
import { pickLowestTier } from "../src/strategy/enemyTier.js";
import { SAFE_TIER } from "../src/sim/enemies.js";
import { pickBoon } from "../src/strategy/loot.js";
import { shouldUsePotion, DEFAULT_POTION_THRESHOLD } from "../src/strategy/potions.js";
import type { ShutdownSignal } from "../src/orchestrator/shutdown.js";

/**
 * Hard cap, DECISIONS.md 2026-08-15 (session 11): potions are a
 * pre-committed loadout of at most 3 per dungeon attempt.
 */
export const MAX_POTIONS_PER_RUN = 3;

/**
 * [session 23] Thrown when `runOnce` finds an active run it didn't start
 * itself and no `--resume-existing` confirmation was given. Deliberately NOT
 * a `GuardTrip` — this isn't an anomalous game state, it's the process
 * correctly refusing to guess at something it cannot see (a resumed run's
 * consumables/juiced status). No action was sent, so no guard/energy
 * accounting applies.
 */
export class ResumeConfirmationRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeConfirmationRequired";
  }
}

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
  consumables: number[] = [],
): DungeonActionRequest {
  return { action, dungeonId, actionToken, data: { consumables, isJuiced: false, index } };
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

/**
 * [session 28, CODEXREVIEW #7] `redactSecrets` removes the FULL jwt — see
 * `GigaverseClient.redactSecrets`'s doc comment. Callers pass that method
 * bound to a real client; nothing here ever sees or stores the raw token.
 */
function redact(raw: string, address: string, redactSecrets: (text: string) => string): string {
  let s = raw;
  for (const form of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (form) s = s.split(form).join("0xUSER");
  }
  s = redactSecrets(s);
  return s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
}

function stamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

export class FixtureWriter {
  private n = 0;
  private readonly out: string;
  private readonly raw: string;

  constructor(
    private readonly address: string,
    private readonly redactSecrets: (text: string) => string,
    root: string = join("fixtures", "dungeon-runs"),
  ) {
    this.out = join(root, `run-${stamp()}`);
    this.raw = join(this.out, "raw");
    mkdirSync(this.raw, { recursive: true });
  }

  write(body: unknown): void {
    const tag = String(this.n).padStart(3, "0");
    const text = JSON.stringify(body, null, 2);
    writeFileSync(join(this.raw, `state-${tag}.json`), text);
    writeFileSync(join(this.out, `state-${tag}.json`), redact(text, this.address, this.redactSecrets));
    this.n++;
  }

  get dir(): string {
    return this.out;
  }
}

// ---------------------------------------------------------------------------
// Structured JSONL logging — SPEC §7.
// ---------------------------------------------------------------------------

export class RunLog {
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
   * Task 12 Stage A (session-13 brief §2): `consumables` is always sent
   * empty right now, so `use_item` costs nothing to confirm — no item in
   * the loadout to consume, so a 200 would be surprising and a 400/404/405
   * is pure information. Fires AT MOST ONCE across the whole process
   * (shared `fired` flag across every run in this invocation, not per-run),
   * late in a room that's already going badly (own HP fraction low), never
   * in `--dry-run`.
   */
  probeUseItem?: { fired: boolean };
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
  /**
   * Task 12 Stage B (session-14 brief §3): `consumables` on `start_run` is
   * otherwise always sent empty (`[]`) — this is the one-shot override that
   * puts a REAL item id in the loadout to observe what the field actually
   * takes (item id / slot index / object) and how `GET /game/dungeon/state`
   * reports it back. Only affects the `start_run` POST, never combat/
   * reward/path actions, which always send `[]` regardless. `undefined`
   * (the default) preserves the existing always-empty behavior exactly.
   */
  startConsumables?: number[];
  /**
   * Task 12 Stage B live half: fires a REAL `use_item` (not the itemId-0
   * probe above) once own HP fraction crosses `threshold`, per
   * `src/strategy/potions.ts`'s `shouldUsePotion` — the same rule
   * `scripts/potionTimingSweep.ts` found best among the thresholds it swept.
   * `remaining`/`used` are mutated in place across the whole process
   * (matching `probeUseItem`'s `{ fired: boolean }` convention), since they
   * track the REAL loadout committed at `start_run`, not a per-run reset.
   * `used` doubles as the next `use_item` request's `index` — see
   * `usePotionLive`'s doc comment for why that's load-bearing, not cosmetic.
   */
  potionPolicy?: { itemId: number; threshold: number; remaining: number; used: number };
  /**
   * Task 10: graceful SIGINT. Checked once per turn, right after confirming
   * the run isn't already over and BEFORE deciding/sending the next action
   * — so a signal received mid-network-call never aborts an in-flight
   * action, it only skips the *next* one. `undefined` (the default, e.g.
   * every existing caller/test) means "never asked to stop," identical to
   * today's behavior.
   */
  shutdownSignal?: ShutdownSignal;
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

/** Below this own-HP fraction counts as "already going badly" for the use_item probe (session-13 brief §2). */
const PROBE_HP_FRACTION = 0.34;

/**
 * Task 12 Stage A confirmation probe (session-13 brief §2). Sends exactly
 * one `use_item` with `itemId: 0` on an empty `consumables` loadout —
 * CLAUDE.md §4/§7's "confirm only on a run already lost" is honoured by the
 * caller's HP-fraction gate, not by anything in here. Never touches
 * `guards.recordActionResult` — a 400 here is the EXPECTED, informative
 * outcome, not a failure the 3-strikes guard should count against. Always
 * re-syncs state afterward via `getDungeonState()` regardless of outcome,
 * since a 400 might still be an "action name is right, argument is wrong"
 * response that mutated nothing, or (per the established `reward_*`/`path_*`
 * precedent) an error that doesn't reliably mean nothing happened.
 */
export async function probeUseItem(
  client: GigaverseClient,
  config: BotConfig,
  log: RunLog,
  fixtures: FixtureWriter,
): Promise<void> {
  const envelope = buildEnvelope("use_item", config.dungeonId, client.getActionToken(), 0);
  const body: DungeonActionRequest = { ...envelope, data: { ...envelope.data, itemId: 0 } };
  console.log(`  ★ Task 12 Stage A probe: sending use_item (empty loadout, itemId 0) — expect 400/404/405, informative either way`);
  log.write({ event: "use_item_probe_post", body });
  try {
    const resp = await client.postDungeonAction(body);
    log.write({ event: "use_item_probe_response", status: 200, resp });
    fixtures.write({ probe: "use_item", request: body, status: 200, response: resp });
    console.log(`  ★ use_item probe: HTTP 200 — UNEXPECTED with an empty loadout. Full response logged.`);
  } catch (e) {
    if (e instanceof TokenExpiredError) throw e;
    if (e instanceof UnexpectedResponseError) {
      log.write({ event: "use_item_probe_response", status: e.status, body: e.body });
      let parsedBody: unknown = e.body;
      try {
        parsedBody = JSON.parse(e.body);
      } catch {
        // not JSON — keep the raw text
      }
      fixtures.write({ probe: "use_item", request: body, status: e.status, response: parsedBody });
      console.log(`  ★ use_item probe: HTTP ${e.status} — ${e.body.slice(0, 300)}`);
    } else {
      log.write({ event: "use_item_probe_error", error: (e as Error).message });
      console.log(`  ★ use_item probe: request failed — ${(e as Error).message}`);
    }
  }
}

/**
 * Task 12 Stage B live half: fire one REAL `use_item` against a real
 * loadout item, and re-sync state afterward regardless of outcome (same
 * "an error doesn't reliably mean nothing happened" discipline as
 * `postWithVerifiedRetry` and `probeUseItem` above). Unlike `probeUseItem`,
 * a non-200 here IS a real failure — there's a genuine item at `itemId`,
 * so `guards.recordActionResult` is fed here, not skipped.
 *
 * [2026-08-16, session 16, LIVE] `index` addresses a POSITION in the run's
 * committed `consumables` loadout array, NOT a stable itemId lookup — the
 * first use of two identical Big Heal Juice (itemId 131) succeeded at
 * `index: 0`; the SECOND, sent with the same `index: 0`, failed HTTP 400
 * "Item not found in index"; `index: 1` then succeeded, healing 4/36 ->
 * 24/36. `usedCount` is the caller's running count of how many potions from
 * THIS loadout have already been consumed, i.e. the next index to send —
 * see `scripts/probeUseItemIndex1.ts` for the raw capture.
 */
export async function usePotionLive(
  client: GigaverseClient,
  config: BotConfig,
  guards: GuardState,
  log: RunLog,
  fixtures: FixtureWriter,
  itemId: number,
  usedCount: number,
): Promise<void> {
  const envelope = buildEnvelope("use_item", config.dungeonId, client.getActionToken(), usedCount);
  const body: DungeonActionRequest = { ...envelope, data: { ...envelope.data, itemId } };
  console.log(`  ★ Task 12 Stage B: using potion (itemId ${itemId}, index ${usedCount})`);
  log.write({ event: "use_item_post", body });
  try {
    const resp = await client.postDungeonAction(body);
    guards.recordActionResult(true);
    log.write({ event: "use_item_response", status: 200, resp });
    fixtures.write(resp);
    console.log(`  ✓ use_item: HTTP 200`);
  } catch (e) {
    if (e instanceof TokenExpiredError) throw e;
    if (e instanceof UnexpectedResponseError) {
      log.write({ event: "use_item_response", status: e.status, body: e.body });
      console.log(`  ✗ use_item: HTTP ${e.status} — ${e.body.slice(0, 300)}`);
    } else {
      log.write({ event: "use_item_error", error: (e as Error).message });
      console.log(`  ✗ use_item: request failed — ${(e as Error).message}`);
    }
    fail(guards, log, "use_item rejected", { itemId });
  }
}

/**
 * One dungeon run, start to finish. Returns when the run ends (win, death, or
 * flee) or a guard trips. In `--dry-run`, never calls `postDungeonAction` —
 * it polls state and logs every decision it WOULD have sent.
 */
export async function runOnce(deps: LiveRunDeps, opts: { stage2Only?: boolean; requireResumeConfirmation?: boolean; resumeExisting?: boolean } = {}): Promise<void> {
  const { client, config, guards, model, strategyConfig, fixtures, log, dryRun, guardStatePath } = deps;

  let prevFoeMove: MoveKey | null = null;
  let lastFoeId: string | null = null;
  const playCounts: Record<MoveKey, number> = { rock: 0, paper: 0, scissor: 0 };
  // Set right after the use_item probe's own resync (below) — that resync
  // legitimately re-reads a state that hasn't changed (the whole point of a
  // probe that didn't apply), and without this the stall guard would trip on
  // its own follow-up read, mistaking "we just looked twice" for "the run is
  // stuck".
  let skipNextStateCheck = false;

  // Check BEFORE deciding to start_run — CLAUDE.md §1, don't assume. A prior
  // stage (or a prior crashed process) can leave a run active; sending
  // start_run on top of one is rejected by the server (HTTP 400, "Error
  // starting dungeon" — confirmed live, session 08 stage 3's first attempt)
  // rather than silently resetting or stacking runs.
  const existing = await client.getDungeonState();

  if (existing) {
    // [session 09, LIVE] `assertCanStartRun` deliberately does NOT run in
    // this branch — resuming an already-active run costs no new run slot and
    // must never be blocked by the session cap. This used to be a real
    // ordering bug: the check ran unconditionally at the top of this
    // function, before this branch even existed to skip it. Invisible
    // through session 08 because guard state never persisted across process
    // invocations, so the cap never actually bound. Session 09's persistence
    // fix made it bind for the first time, and it immediately stranded a run
    // at room 2 (HP 2/32, mid-combat) that had started under the cap but
    // then couldn't be resumed once a later run pushed the count to the cap.
    const room = existing.data.entity?.ROOM_NUM_CID ?? "?";

    // [session 23] A run this invocation didn't itself start is exactly what
    // stranded the user's manually-started juiced Tier-3 run: it got silently
    // resumed and auto-played to a room-2 death by the ordinary EV-engine
    // policy, burning a real entry (7 crafting items, 3x Big Heal Juice
    // pre-loaded via the "dungeon sack") on a decision the user never made.
    // The state read here CANNOT tell us if a resumed run is juiced or has
    // potions committed — `isJuiced`/`consumables` never appear on any state
    // read, only (maybe) on the original start_run this process didn't send.
    // Given that blindness, the only safe default is to refuse and ask,
    // not guess. `opts.requireResumeConfirmation` is set by `main()` only on
    // the FIRST iteration of a `--runs=N` loop — a run still active between
    // iterations of the SAME invocation was started by this same process and
    // needs no re-confirmation.
    if (opts.requireResumeConfirmation && !opts.resumeExisting) {
      const hp = existing.data.run?.players?.[0]?.health?.current ?? "?";
      const hpMax = existing.data.run?.players?.[0]?.health?.currentMax ?? "?";
      const message =
        `An active run already exists (room ${room}, own HP ${hp}/${hpMax}) that this process didn't start. ` +
        `Its consumables/juiced status is NOT visible from here — resuming it blind is exactly what burned a ` +
        `real juiced entry in session 23. Re-run with --resume-existing only after confirming (from you, or by ` +
        `checking what you actually started) that it's safe for the bot to auto-play this run to completion.`;
      if (dryRun) {
        console.log(`  ⚠ [dry-run] a REAL invocation would REFUSE here without --resume-existing: ${message}`);
      } else {
        throw new ResumeConfirmationRequired(message);
      }
    }

    console.log(`  · active run already exists at room ${room} — resuming rather than starting a new one`);
    log.write({ event: "resuming_existing_run", room });
    if (opts.stage2Only) {
      console.log(`  ▸ stage 2 has nothing to send (a run is already active) — halting without a POST.`);
      return;
    }
  } else if (dryRun) {
    guards.assertCanStartRun(config.energyCostPerRun); // simulate the real gate — dry-run's whole purpose
    await assertDungeonCapNotExhausted(client, config, guards, log, guardStatePath);
    log.write({ event: "dry_run_start_run_intended", dungeonId: config.dungeonId });
    console.log(`  [dry-run] would POST start_run (dungeonId ${config.dungeonId})`);
    console.log(`  · no active run — nothing further to decide against, stopping.`);
    return;
  } else {
    guards.assertCanStartRun(config.energyCostPerRun);
    await assertDungeonCapNotExhausted(client, config, guards, log, guardStatePath);
    const body = buildEnvelope("start_run", config.dungeonId, client.getActionToken(), 0, deps.startConsumables);
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
    // [session 31, CODEXREVIEW #8] Committed spend, recorded the moment
    // start_run succeeds — independent of whatever the account balance does
    // afterward (in-run regen, an external ROM claim). This is now the
    // guard's ledger of record; the before/after read in `main()` is a
    // diagnostic only. See src/orchestrator/energyAccounting.ts.
    guards.recordEnergySpent(config.energyCostPerRun);
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
    if (skipNextStateCheck) {
      skipNextStateCheck = false;
    } else {
      try {
        guards.checkStateProgress(stateKey);
      } catch (e) {
        log.write({ event: "guard_trip", error: (e as Error).message });
        throw e;
      }
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

    if (deps.shutdownSignal?.requested) {
      log.write({ event: "shutdown_requested", room: roomNum, phase });
      console.log(`  ▸ SIGINT — stopping before the next action (turn boundary), run left active at room ${roomNum}.`);
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

      if (deps.probeUseItem && !deps.probeUseItem.fired && battle.me.hp / battle.me.hpMax <= PROBE_HP_FRACTION) {
        deps.probeUseItem.fired = true; // exactly once per process, win or lose — never retried
        await probeUseItem(client, config, log, fixtures);
        // The top of the loop re-fetches state next iteration anyway — no
        // need for a second manual read here. A probe that didn't apply
        // means that next read is genuinely IDENTICAL to this one, so the
        // stall guard is told in advance not to mistake that for the run
        // being stuck (see `skipNextStateCheck`'s own comment).
        skipNextStateCheck = true;
        continue;
      }

      if (
        deps.potionPolicy &&
        shouldUsePotion(battle.me.hp, battle.me.hpMax, deps.potionPolicy.remaining, deps.potionPolicy.threshold)
      ) {
        const p = deps.potionPolicy;
        await usePotionLive(client, config, guards, log, fixtures, p.itemId, p.used);
        p.remaining--;
        p.used++;
        // Re-fetching state next iteration will show us EMPIRICALLY whether
        // use_item consumed a turn: if the enemy's lastMove/charges advanced
        // despite us sending no rock/paper/scissor this iteration, it did.
        // Deliberately not assumed either way — Task 12 Stage B's open
        // question, answered by observation rather than modelled here.
        continue;
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
  const status = argv.includes("--status");
  const probeUseItemFlag = argv.includes("--probe-use-item");
  const runsArg = argv.find((a) => a.startsWith("--runs="));
  const runs = runsArg ? Number(runsArg.split("=")[1]) : 1;
  // Task 12 Stage B (session-14 brief §3): one-shot `consumables` field-shape
  // probe. `--probe-consumables=131` sends `start_run` with `consumables:
  // [131]` (Big Heal Juice) instead of the always-empty default, on the
  // NEXT genuinely new start_run only (never on a resumed run).
  const probeConsumablesArg = argv.find((a) => a.startsWith("--probe-consumables="));
  const probeConsumablesItemId = probeConsumablesArg ? Number(probeConsumablesArg.split("=")[1]) : undefined;
  // Task 12 Stage B policy (live half): `--potions=3` loads 3 real Big Heal
  // Juice into `consumables` at start_run AND fires `use_item` mid-combat at
  // `--potion-threshold` (default: potionTimingSweep.ts's best threshold).
  // Independent of `--probe-consumables`/`--probe-use-item` above — those
  // are the one-shot Stage A/field-shape probes; this is the real policy.
  const potionsArg = argv.find((a) => a.startsWith("--potions="));
  const potionCount = potionsArg ? Number(potionsArg.split("=")[1]) : undefined;
  const thresholdArg = argv.find((a) => a.startsWith("--potion-threshold="));
  const potionThreshold = thresholdArg ? Number(thresholdArg.split("=")[1]) : DEFAULT_POTION_THRESHOLD;
  // [session 24] `potionPolicy.used` (the next `use_item` index to send) is
  // process-local and always starts at 0 — correct for a run this same
  // invocation started, WRONG when resuming a run whose committed
  // consumables were already partly used by an earlier, separate invocation
  // (the server's per-slot indexing doesn't reset; index 0 stays consumed).
  // `--potions-used=N` seeds the real count so the resumed run's next
  // `use_item` targets the correct still-available slot instead of
  // re-guessing index 0 and getting HTTP 400 "Item not found in index".
  const potionsUsedArg = argv.find((a) => a.startsWith("--potions-used="));
  const potionsUsed = potionsUsedArg ? Number(potionsUsedArg.split("=")[1]) : 0;
  // [session 23] Required before this process will touch a run it didn't
  // itself start this invocation — see the runOnce comment at the "existing"
  // branch for why. Absence is fail-closed (refuse), not fail-open.
  const resumeExisting = argv.includes("--resume-existing");
  return {
    dryRun,
    stage2,
    status,
    runs,
    probeUseItemFlag,
    probeConsumablesItemId,
    potionCount,
    potionThreshold,
    potionsUsed,
    resumeExisting,
  };
}

/**
 * [session 15, brief §5] Prints today's remaining dungeon budget purely from
 * local state (`config/bot.json` + `config/discovered.json` +
 * `data/guard-budget.json`) — no network call, no dry-run POST. Answers
 * session-14 brief's open question 3: both date-keyed guards were already at
 * cap at the START of session 14, discovered only after investigation time
 * was spent. `main()` exits immediately after this, before constructing a
 * `GigaverseClient` at all.
 */
export function printStatus(config: BotConfig): void {
  const seed = loadGuardBudget();
  const runsRemaining = Math.max(0, config.maxRunsPerSession - seed.runsStarted);
  const energyRemaining = Math.max(0, config.dailyEnergyBudget - seed.energySpent);
  console.log(`\n▸ liveRun.ts --status (${todayKey()})\n`);
  console.log(`  dungeon runs:    ${seed.runsStarted}/${config.maxRunsPerSession} used  ->  ${runsRemaining} remaining`);
  console.log(`  dungeon energy:  ${seed.energySpent}/${config.dailyEnergyBudget} used  ->  ${energyRemaining} remaining`);
  if (config.dendren) {
    const fseed = loadGuardBudget(FISHING_GUARD_STATE_PATH);
    const castsRemaining = Math.max(0, config.dendren.maxCastsPerSession - fseed.runsStarted);
    const fenergyRemaining = Math.max(0, config.dendren.dailyEnergyBudget - fseed.energySpent);
    console.log(`  fishing casts:   ${fseed.runsStarted}/${config.dendren.maxCastsPerSession} used  ->  ${castsRemaining} remaining`);
    console.log(`  fishing energy:  ${fseed.energySpent}/${config.dendren.dailyEnergyBudget} used  ->  ${fenergyRemaining} remaining`);
  } else {
    console.log(`  fishing:         no dendren block in config — Task 7 not configured`);
  }
  console.log();
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

/** Matches scripts/liveFishing.ts's own constant — kept as a literal duplicate rather than a shared import, same footing as this file's other path constants. */
const FISHING_GUARD_STATE_PATH = join("data", "guard-budget-fishing.json");

/**
 * Session 23: pulls the REAL server-side runs-used-today count for a dungeon
 * out of `GET /game/dungeon/today`, rather than trusting the local
 * guard-budget file. Returns `null` if the server has no day-progress row
 * yet (genuinely zero runs today). Pure/testable — takes the already-fetched
 * response, not a client.
 */
export function findRealRunsToday(today: { dayProgressEntities?: { docId: string; UINT256_CID: number }[] }, dungeonId: number): number | null {
  const row = today.dayProgressEntities?.find((e) => e.docId.endsWith(`#Dungeon#${dungeonId}`));
  return row ? row.UINT256_CID : null;
}

/**
 * [session 29, CODEXREVIEW #6] Checked right before a genuinely NEW
 * start_run — never on a resume, which costs no new run slot and must never
 * be blocked here — so an already-exhausted real server cap is caught
 * before attempting and eating a rejection, rather than after. The
 * authoritative server count wins over local guard tracking (CLAUDE.md §1).
 * `null` (no day-progress row yet for this dungeon) is a legitimate
 * "genuinely zero runs today" reading and does not block. On a confirmed
 * exhausted cap, marks the local guard exhausted for the rest of the
 * persisted day too (`GuardState.recordServerCapReached`) so a LATER
 * invocation this same day fails closed locally without a further network
 * round-trip.
 */
async function assertDungeonCapNotExhausted(
  client: GigaverseClient,
  config: BotConfig,
  guards: GuardState,
  log: RunLog,
  guardStatePath?: string,
): Promise<void> {
  const today = await client.getDungeonToday();
  const realRunsToday = findRealRunsToday(today, config.dungeonId);
  if (realRunsToday !== null && realRunsToday >= config.maxRunsPerSession) {
    guards.recordServerCapReached();
    saveGuardBudget(guards.spentEnergy, guards.runCount, guardStatePath);
    log.write({ event: "server_cap_reached", mode: "dungeon", realRunsToday, cap: config.maxRunsPerSession });
    throw new GuardTrip("session run cap reached", {
      source: "server GET /game/dungeon/today",
      realRunsToday,
      cap: config.maxRunsPerSession,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.status) {
    printStatus(loadBotConfig());
    return;
  }

  console.log(`\n▸ liveRun.ts — ${args.dryRun ? "STAGE 1 dry-run" : args.stage2 ? "STAGE 2 single POST" : `${args.runs} run(s)`}\n`);

  const config = loadBotConfig();
  const client = new GigaverseClient();
  // [session 28, CODEXREVIEW #2] One live writer per guard-state file for
  // the whole process lifetime — held until the process exits (see
  // guardPersistence.ts's acquireGuardLock doc comment for why a lock
  // scoped to a single transaction wouldn't actually close the race here).
  process.once("exit", acquireGuardLock());
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
  const fixtures = new FixtureWriter(me.address, (text) => client.redactSecrets(text));
  console.log(`  account <USER> noobId ${account.noob?.docId ? "<NOOB>" : "(none)"}`);

  // [session 23] The local guard file only sees runs THIS bot started — a
  // user-started manual run (juiced or not) is invisible to it. Checked here,
  // every real invocation, so drift is caught before it compounds across a
  // whole batch rather than discovered after the fact.
  const dungeonToday = await client.getDungeonToday();
  const realRunsToday = findRealRunsToday(dungeonToday, config.dungeonId);
  if (realRunsToday !== null) {
    const driftNote = realRunsToday !== seed.runsStarted ? `  ⚠ DRIFT from bot-tracked ${seed.runsStarted} — likely manual play outside this bot` : "  (matches bot-tracked count)";
    console.log(`  · real server runs today: ${realRunsToday}/${config.maxRunsPerSession}${driftNote}`);
    if (realRunsToday >= config.maxRunsPerSession) {
      console.log(`  · real server cap already reached today — any start_run will be rejected server-side.`);
    }
  }

  if (args.probeUseItemFlag) {
    console.log(`  · --probe-use-item: will send one use_item probe the first time own HP drops to ≤${Math.round(PROBE_HP_FRACTION * 100)}%.`);
  }
  const probeUseItemState = args.probeUseItemFlag ? { fired: false } : undefined;
  if (args.probeConsumablesItemId !== undefined) {
    console.log(`  · --probe-consumables=${args.probeConsumablesItemId}: next genuinely new start_run will send consumables: [${args.probeConsumablesItemId}].`);
  }
  // Session 17: potions default ON, but ONLY within an explicit user-set
  // allowlist (config.potions, config/bot.json's forbiddenWoods.potions) —
  // NOT by auto-detecting whatever heal item happens to sit in inventory.
  // User directive this session, direct quote: "verify before doing runs
  // which potions (juices) you are allowed to take into the dungeon.
  // Otherwise you might burn through my supply of Big Heal Juice without
  // my intent." Absent that config block, the loop uses NO potions at all,
  // regardless of balance — silence is not authorization. `--potions=N` is
  // still a manual override (a human typing the flag IS the intent) but
  // stays pinned to the config-allowed item; it cannot smuggle in a
  // different item id.
  let potionItemId = config.potions?.allowedItemId;
  let potionCount = args.potionCount;
  if (potionCount === undefined) {
    if (!config.potions) {
      potionCount = 0;
      console.log(
        `  · potions: NOT configured (config/bot.json's forbiddenWoods.potions is absent) -> loading 0. This is the safe default, not a bug.`,
      );
    } else {
      const balances = await client.getItemsBalances();
      const balance = balances.entities.find((e) => e.ID_CID === String(config.potions!.allowedItemId))?.BALANCE_CID ?? 0;
      potionCount = Math.min(config.potions.maxPerRun, MAX_POTIONS_PER_RUN, balance);
      console.log(
        `  · potions: config authorizes up to ${config.potions.maxPerRun}x itemId ${config.potions.allowedItemId}` +
          ` (hard cap ${MAX_POTIONS_PER_RUN}); ${balance} in stock -> loading ${potionCount}. Pass --potions=N to override.`,
      );
    }
  } else if (potionCount > 0 && !potionItemId) {
    throw new Error(
      `--potions=${potionCount} was passed but config/bot.json has no forbiddenWoods.potions.allowedItemId set — ` +
        `the loop refuses to guess which item to load. Add that block first.`,
    );
  }
  const potionPolicyState =
    potionCount > 0 && potionItemId
      ? { itemId: potionItemId, threshold: args.potionThreshold, remaining: potionCount, used: args.potionsUsed }
      : undefined;
  if (potionPolicyState) {
    console.log(
      `  · next genuinely new start_run will load ${potionCount}x itemId ${potionItemId}` +
        `, used at own HP ≤${Math.round(args.potionThreshold * 100)}%.` +
        (args.potionsUsed > 0 ? ` Resuming with ${args.potionsUsed} already used this run — next use_item targets index ${args.potionsUsed}.` : ""),
    );
  }

  const targetRuns = args.dryRun || args.stage2 ? 1 : args.runs;
  for (let i = 0; i < targetRuns; i++) {
    console.log(`\n▸ run ${i + 1}/${targetRuns}`);
    const before = args.dryRun ? null : await currentEnergy(client, me.address);
    // [session 31, CODEXREVIEW #8] Captured before `runOnce` so the diff
    // against `guards.spentEnergy` afterward isolates exactly what THIS
    // iteration committed (0 on a resume — no new start_run sent).
    const committedBefore = guards.spentEnergy;
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
        {
          client,
          config,
          guards,
          model,
          strategyConfig: LIVE_CONFIG,
          fixtures,
          log,
          dryRun: args.dryRun,
          probeUseItem: probeUseItemState,
          startConsumables:
            args.probeConsumablesItemId !== undefined
              ? [args.probeConsumablesItemId]
              : potionCount > 0 && potionItemId
                ? Array(potionCount).fill(potionItemId)
                : undefined,
          potionPolicy: potionPolicyState,
        },
        { stage2Only: args.stage2, requireResumeConfirmation: i === 0, resumeExisting: args.resumeExisting },
      );
    } catch (e) {
      runError = e;
    }
    if (before !== null) {
      // [session 31, CODEXREVIEW #8] Diagnostic only — the guard was already
      // enforced off the COMMITTED spend inside `runOnce` (recorded and
      // persisted the moment start_run succeeded, before this line runs).
      // This before/after read can no longer mask a real spend: it's not
      // fed back into the guard, only reconciled against what the guard
      // already recorded, so drift is visible in logs rather than silently
      // absorbed.
      const after = await currentEnergy(client, me.address);
      const committedDelta = guards.spentEnergy - committedBefore;
      const report = reconcileEnergyAccounting(before, after, committedDelta);
      log.write({ event: "energy_accounting", ...report });
      console.log(describeEnergyAccounting(report));
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
