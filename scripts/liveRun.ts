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
import { basename, join } from "node:path";

import { GigaverseClient } from "../src/api/client.js";
import type { DungeonAction, DungeonActionRequest, DungeonActionResponse, DungeonState } from "../src/api/schemas.js";
import { TokenExpiredError, UnexpectedResponseError, serverErrorDetail } from "../src/api/errors.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip } from "../src/orchestrator/guards.js";
import { AttemptTelemetry } from "../src/orchestrator/attemptTelemetry.js";
import { acquireGuardLock, loadGuardBudget, saveGuardBudget, todayKey } from "../src/orchestrator/guardPersistence.js";
import { reconcileEnergyAccounting, describeEnergyAccounting } from "../src/orchestrator/energyAccounting.js";
import { ensureEnergyFor, clientEnergyPreflightDeps, EnergyPreflightError, type ClaimOrder } from "../src/orchestrator/energyPreflight.js";

/**
 * [session 52 §1a] Bound on the ascending claim loop. 15 is well above the 3
 * claims session 52's live 53-energy deficit actually needed and well below
 * anything that would turn a preflight into a request storm. Only applied when
 * `--claim-order=ascending` is passed; a descending pass is unbounded, exactly
 * as it has been since session 47.
 */
const ASCENDING_MAX_CLAIMS = 15;
import { regenerateRunReports } from "./regenerateReports.js";
import { toCombatant, exchangeIdentity, exchangeLabel, type WireRun, type WireSide, type WireBoon } from "../src/sim/corpus.js";
import { MOVES, type BattleState, type MoveKey } from "../src/sim/types.js";
import { BOON_MODELS, type BoonOption } from "../src/sim/boons.js";
import { decide, formatDecision, type Decision } from "../src/strategy/decide.js";
import { LIVE_CONFIG, type StrategyConfig } from "../src/strategy/config.js";
import { OpponentModel, modelKey } from "../src/strategy/opponentModel.js";
import {
  loadOpponentModel,
  bootstrapFromCorpus,
  saveOpponentModelAtomically,
  DEFAULT_OPPONENT_MODEL_PATH,
} from "../src/orchestrator/opponentModelPersistence.js";
import { loadPlayCounts, savePlayCounts, deletePlayCounts, DEFAULT_PLAY_COUNTS_PATH } from "../src/orchestrator/playCountsPersistence.js";
import { PerpetualOnlyOfferError, pickTierForRoom, tierRuleFor } from "../src/strategy/enemyTier.js";
import { isPerpetualBuff } from "../src/sim/enemyBuffs.js";
import { MAX_ROOM, SAFE_TIER } from "../src/sim/enemies.js";
import { pickBoon } from "../src/strategy/loot.js";
import {
  chooseCaptureBoon,
  DEFAULT_CAPTURE_ROOMS,
  DEFAULT_CAPTURE_TARGETS,
  type BoonCaptureConfig,
} from "../src/strategy/boonCapture.js";
import {
  choosePriorityBoon,
  chooseOrbFallback,
  DEFAULT_BOON_PRIORITY,
  lifestealSightings,
  type BoonPriorityConfig,
} from "../src/strategy/boonPriority.js";
import { shouldUsePotion, DEFAULT_POTION_THRESHOLD } from "../src/strategy/potions.js";
import { createShutdownSignal, installProcessSigintHandler, type ShutdownSignal } from "../src/orchestrator/shutdown.js";
import { redactNoobToken } from "../src/api/redact.js";

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
 * [session 53, brief §0c] Minimum ms since the LAST RESPONSE before a
 * path-selection POST goes out.
 *
 * `reward_*`/`path_*` send `actionToken: ""` (the DevTools-confirmed
 * session-08 shape). The server holds exactly one outstanding action token
 * and rejects any POST whose token does not equal it — hence the doubled
 * space in `Invalid action token  != N`, which is `""` interpolated into
 * `Invalid action token {sent} != {outstanding}`. Combat moves carry the
 * matching numeric token and pass immediately; `start_run` also sends `""`
 * and always succeeds because no token is outstanding yet (the control case).
 *
 * Measured by `scripts/rejectionAudit.ts` over all ten run logs, on LOCAL
 * timestamps, gap since the preceding SUCCESSFUL response:
 *
 *   empty-token, rejected   n= 66   0.90 - 1.54 s   (median 1.28)
 *   empty-token, accepted   n= 66   3.40 - 4.92 s   (median 4.07)
 *   numeric-token           n=224   0.90 - 1.79 s   (median 1.36, 0 failures)
 *
 * Zero overlap — the threshold sits in (1.54, 3.40). 4000ms lands inside the
 * band every one of those 66 successes came from.
 *
 * NOTE FOR THE NEXT READER, because this is the easy mistake: the session-53
 * brief proposed 3600ms as a `minGapMs`, i.e. a REQUEST-to-REQUEST gap. That
 * is a different clock. `RateLimiter` stamps `lastCallAt` before dispatch, so
 * request-gap minus one response latency (0.72 - 1.78 s, median 1.45) is the
 * response gap — 3600ms request-to-request leaves only ~1.8 s since the
 * response in the worst case, i.e. INSIDE the reject band. The override is
 * deliberately expressed on the response clock, which is the clock the
 * measurement and the mechanism both live on.
 *
 * CLAUDE.md §2 is not in play: nothing about the envelope changes. The
 * confirmed shape is sent exactly as captured, just later.
 */
export const EMPTY_TOKEN_MIN_GAP_SINCE_RESPONSE_MS = 4000;

/**
 * Actions that send `actionToken: ""` and therefore need the longer gap
 * above. `start_run` is deliberately EXCLUDED — it is the control case (no
 * token is ever outstanding at that moment, 4/4 accepted first try), and
 * delaying it would slow every entry for nothing.
 */
export function pacingForAction(action: DungeonAction): { minGapSinceResponseMs?: number } | undefined {
  const emptyToken =
    (REWARD_ACTIONS as readonly string[]).includes(action) || (PATH_ACTIONS as readonly string[]).includes(action);
  return emptyToken ? { minGapSinceResponseMs: EMPTY_TOKEN_MIN_GAP_SINCE_RESPONSE_MS } : undefined;
}

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

/** The shape `enemyPathOptions[]` is read at, live. `enemyBuff` is required by rule 8's Perpetual clause. */
export interface EnemyPathOption {
  tier: number;
  index: number;
  enemyBuff?: unknown;
  rolledEnemyStats?: Record<string, number>;
}

/**
 * [session 09; re-pointed at rule 8's new direction in session 57] Re-locates
 * the intended tier option by identity — "whichever position the tier rule
 * picks out of the offer as it stands RIGHT NOW" — rather than trusting the
 * array position captured at decision time. The rule doesn't target a specific
 * tier number, so re-deriving from fresh state on every retry attempt is
 * exactly correct, not an approximation.
 *
 * **This must route through `pickTierForRoom`, not re-implement it.** Before
 * session 57 it held its own inline "lowest tier" scan, which was equivalent
 * to the rule at the time. Under rule 8 it would not be: an inline max-tier
 * scan would skip the Perpetual filter and the final-room exception, so a
 * retry could land on a card the decision path had deliberately refused.
 * `room`/`maxRoom` are threaded through for the same reason.
 *
 * Returns `null` only on a genuinely empty offer, which halts the run rather
 * than guessing. `PerpetualOnlyOfferError` propagates — an offer that turned
 * all-perpetual between attempts is a new surprise and fails closed.
 */
export function locateChosenTierOption(
  run: WireRun,
  room: number | null | undefined,
  maxRoom: number | null | undefined,
): number | null {
  const r = run as WireRun & { enemyPathOptions?: EnemyPathOption[] };
  const options = r.enemyPathOptions ?? [];
  if (options.length === 0) return null;
  return options.indexOf(pickTierForRoom(options, room, maxRoom));
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

/**
 * [session 42, Task 14] A juiced `start_run` uses a THIRD envelope shape,
 * matching neither `buildEnvelope` nor `buildPathSelectionEnvelope` exactly —
 * confirmed via a live DevTools capture of the real request the browser sent
 * when the user manually started a Tier-3 juiced Forbidden Woods run
 * (DECISIONS.md 2026-08-18, out-of-band):
 *
 * ```json
 * {"action":"start_run","actionToken":"","dungeonId":5,
 *  "data":{"consumables":[131,131,131],"itemId":0,"expectedAmount":0,
 *          "index":3,"isJuiced":true,"gearInstanceIds":[],"devBoons":[]}}
 * ```
 *
 * Like `buildPathSelectionEnvelope`, `actionToken` is an empty string and
 * `data` carries the full 7-field shape. Unlike it, `dungeonId` is the run's
 * REAL dungeon id, not hardcoded `0` — this capture is the first evidence
 * that `buildPathSelectionEnvelope`'s own header comment ("combat/start_run
 * always use the numeric-actionToken/3-field shape") does not hold for a
 * juiced start.
 *
 * Left open, on purpose (this capture alone can't distinguish the two): is
 * the empty-string-actionToken/7-field shape required *because* the run is
 * juiced, or would it also be required for an ordinary `start_run`? Treat
 * this shape as ground truth for juiced starts only until a reason to
 * believe otherwise turns up.
 */
export function buildJuicedStartRunEnvelope(dungeonId: number, index: number, consumables: number[] = []): DungeonActionRequest {
  return {
    action: "start_run",
    dungeonId,
    actionToken: "",
    data: { consumables, isJuiced: true, index, itemId: 0, expectedAmount: 0, gearInstanceIds: [], devBoons: [] },
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
  s = s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
  // [session 54] See src/api/redact.ts — shared so this rule cannot hold in
  // five of six writers.
  return redactNoobToken(s);
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

  /**
   * [session 36, CODEXAUDIT #1 fix] Returns the exact file name this write
   * just used (e.g. `state-023.json`) — the same tail `src/sim/corpus.ts`'s
   * `CorpusState.label` carries once this fixture is later read back off
   * disk. Callers that need to name the exchange they just observed (the
   * live-observe call site below) build it from this return value plus
   * `runName`, via `exchangeLabel`/`exchangeIdentity` — the SAME derivation
   * `opponentModelPersistence.ts`'s corpus bootstrap uses, so the two can
   * never compute a different identity for the same exchange.
   */
  write(body: unknown): string {
    const tag = String(this.n).padStart(3, "0");
    const text = JSON.stringify(body, null, 2);
    const fileName = `state-${tag}.json`;
    writeFileSync(join(this.raw, fileName), text);
    writeFileSync(join(this.out, fileName), redact(text, this.address, this.redactSecrets));
    this.n++;
    return fileName;
  }

  get dir(): string {
    return this.out;
  }

  /** The run-directory name `loadCorpus()` will later read as `CorpusRun.name` — the `run` half of this fixture's exchange identities. */
  get runName(): string {
    return basename(this.out);
  }
}

// ---------------------------------------------------------------------------
// Structured JSONL logging — SPEC §7.
// ---------------------------------------------------------------------------

export class RunLog {
  private readonly path: string;
  constructor(dir: string = "logs") {
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, `run-${stamp()}.jsonl`);
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
  /**
   * [session 53, brief §1] Optional first-attempt failure counter, shared
   * across every run in one invocation so the summary covers the whole
   * session rather than the last run. Omitted in tests that do not assert
   * on it — recording is always `telemetry?.record(...)`.
   */
  attemptTelemetry?: AttemptTelemetry;
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
   * [session 42, Task 14] When set, a genuinely new `start_run` uses
   * `buildJuicedStartRunEnvelope` (real `dungeonId`, empty-string
   * `actionToken`, 7-field `data`, `isJuiced: true`) instead of the ordinary
   * `buildEnvelope` — see that function's doc comment for the captured
   * evidence. `index` is the wire field the capture calls `index`; `main()`
   * refuses to default it (CLAUDE.md §2 — no guessing at an unconfirmed
   * tier/index mapping). `undefined` (the default) preserves the existing
   * `buildEnvelope` path exactly, unchanged for every ordinary run.
   */
  juicedStartRun?: { index: number };
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
   * [session 54, brief §3] QUESTIONS.md §23 — juiced runs under-report energy
   * spend by exactly 1, three runs running (`observedDelta` 59 vs
   * `committedDelta` 60, same direction every time). Regen has the right sign
   * but is ~0.6 over a two-minute run and would not land on exactly -1 thrice.
   *
   * This reads the pool immediately BEFORE and immediately AFTER the
   * `start_run` POST with nothing else in flight, which splits the two
   * candidate explanations apart:
   *
   *  - a tight `-59` says the CHARGE is 59, not the accounting, and the 3x
   *    multiplier is the suspect (59 = 20x3 - 1 has an obvious shape);
   *  - a tight `-60` says something INSIDE the run credits 1 back — a loot
   *    effect, a boon, a regen tick landing in the window — which is a
   *    different investigation entirely.
   *
   * Two GETs, zero energy, so it is safe to leave armed on every run. Rule 11
   * removed the plain-20-energy comparison arm the original test design
   * wanted; this is the shape that still discriminates without one.
   *
   * `undefined` (every test, every existing caller) skips the probe entirely.
   */
  energyProbe?: () => Promise<number>;
  /**
   * Task 10: graceful SIGINT. Checked once per turn, right after confirming
   * the run isn't already over and BEFORE deciding/sending the next action
   * — so a signal received mid-network-call never aborts an in-flight
   * action, it only skips the *next* one. `undefined` (the default, e.g.
   * every existing caller/test) means "never asked to stop," identical to
   * today's behavior.
   */
  shutdownSignal?: ShutdownSignal;
  /**
   * CODEXIMPROVE #1 (session 32): where `saveOpponentModelAtomically`
   * persists `model` after every observed enemy move, plus the corpus-
   * bootstrap dedup set to persist alongside it. `undefined` (the default,
   * every existing test) preserves the previous in-memory-only behavior
   * exactly — same opt-in shape as `guardStatePath`, and for the same
   * reason: tests exercising `runOnce` must never write the real
   * `data/opponent-model.json` (CLAUDE.md working-style, test isolation).
   */
  opponentModelPersistence?: { path: string; bootstrapImportedIds: Set<string> };
  /**
   * CODEXIMPROVE #5 (session 35): where `savePlayCounts`/`loadPlayCounts`
   * persist this run's move distribution, keyed by `DUNGEON_ID_CID`, so a
   * process restart mid-run doesn't forget it before `loot.ts`'s
   * `"upgrade"` case gets to rank against it. `undefined` (the default,
   * every existing test) preserves the previous in-memory-only-and-zeroed
   * behavior exactly — same opt-in shape as `opponentModelPersistence`, and
   * for the same reason: tests exercising `runOnce` must never write the
   * real `data/play-counts.json`.
   */
  playCountsPersistence?: { path: string };
  /**
   * [session 55, brief §3] The deliberate suboptimal boon pick that buys a
   * pickup pair for an unmodelled boon — see `src/strategy/boonCapture.ts`
   * for why the ranker can never do this on its own, and why CLAUDE.md
   * rule 8 does not apply to a boon choice.
   *
   * `undefined` (the default, every existing caller and test) means the
   * override never runs — identical to the previous behaviour. `main()` only
   * populates it when BOTH `config/bot.json`'s `forbiddenWoods.boonCapture`
   * block exists with `enabled: true` AND `--boon-capture` is passed, the
   * same two-condition shape as the potion gate (see that gate's history:
   * a config block ALONE auto-derived a loadout in session 24 and consumed a
   * user's limited item on a run they had not authorized).
   *
   * `captures` is shared across every run of one invocation so the summary
   * covers the whole session; the ONE-TARGET-PER-RUN limit is enforced by a
   * `runOnce`-local flag, not by this array, so a `--runs=2` invocation can
   * legitimately capture twice — once per run.
   */
  boonCapture?: {
    config: BoonCaptureConfig;
    captures: Array<{ type: string; room: number; beforeTag: string; afterTag: string }>;
  };
  /**
   * [session 56] The user's boon-selection directive as a total order above
   * the scorer — `src/strategy/boonPriority.ts`.
   *
   * **Unlike `boonCapture`, this is ON by default in live play and needs no
   * gate.** The two are not comparable: `boonCapture` knowingly costs run
   * quality to buy a measurement, which is why it needs two conditions before
   * it may fire. This is the user's own instruction about how they want their
   * account played, it spends nothing, and it is reversible by editing a list.
   * A gate here would only mean the directive silently not applying on the run
   * the user asked for it on.
   *
   * `undefined` resolves to `DEFAULT_BOON_PRIORITY` (the shipped rooms-1..8
   * window). Pass `null` to run the unmodified `rankBoons` path — the sim's
   * default arm, and what a test measuring the old behaviour wants.
   */
  boonPriority?: BoonPriorityConfig | null;
  /**
   * [session 56] The dungeon's last room, for the user's final-room
   * no-modifiers exception. Defaults to `MAX_ROOM` — Forbidden Woods'
   * server-published `maxRoom` of 16, via `config/discovered.json`. It is a
   * PER-DUNGEON field (Void Dungeon publishes 17), so it is a parameter rather
   * than a literal even though this script only ever plays dungeon 5.
   */
  maxRoom?: number;
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
  telemetry?: AttemptTelemetry,
): Promise<DungeonActionResponse | null> {
  let run = initialRun;
  let attemptNumber = 0;
  let firstAttemptFailed = false;
  /**
   * [session 53, brief §1] Recorded on EVERY exit path, including the ones
   * that throw — a class whose failures all end the run would otherwise never
   * appear in the summary at all.
   */
  const settle = (actionClass: string) => telemetry?.record(actionClass, firstAttemptFailed);
  for (;;) {
    const index = locate(run);
    if (index === null) {
      log.write({ event: "intended_option_missing", reason });
      throw new GuardTrip(`${reason}: intended option no longer present in live offer`, {});
    }

    const body = buildBody(index);
    attemptNumber++;
    log.write({ event: "post", body });
    try {
      const resp = await client.postDungeonAction(body, pacingForAction(body.action));
      guards.recordActionResult(true);
      log.write({ event: "post_response", resp });
      settle(body.action);
      return resp;
    } catch (e) {
      if (attemptNumber === 1) firstAttemptFailed = true;
      if (e instanceof TokenExpiredError) {
        settle(body.action);
        throw e;
      }
      // [session 47, brief §1e] `.message` is only "Unexpected response from
      // <path>: HTTP <status>" — the server's own text lives in `.body`. See
      // `serverErrorDetail`'s doc comment for the fishing-side incident that
      // established this; the same omission was here.
      log.write({ event: "post_attempt_failed", reason, ...serverErrorDetail(e) });

      const fresh = await client.getDungeonState();
      const freshRun = fresh ? (fresh.data.run as unknown as WireRun) : null;
      const pending = freshRun ? isPending(freshRun) : false;
      if (!pending) {
        // Applied despite the error response (or the run moved on for some
        // other reason) — never retry an action that already landed.
        log.write({ event: "action_applied_despite_error" });
        guards.recordActionResult(true);
        settle(body.action);
        return null;
      }
      try {
        guards.recordActionResult(false); // throws GuardTrip once the configured limit is hit
      } catch (tripped) {
        settle(body.action);
        throw tripped;
      }
      run = freshRun!; // re-derive `index` against this freshly-fetched offer next loop
    }
  }
}

/** Below this own-HP fraction counts as "already going badly" for the use_item probe (session-13 brief §2). */
const PROBE_HP_FRACTION = 0.34;

/**
 * [session 42, Task 14] A Juiced Forbidden Woods run costs 3x the energy and
 * consumes 3x the daily run-count units of an ordinary run — SPEC.md's
 * Juiced run-mode section, user-confirmed (2026-08-17, session 23) against
 * the real `dayProgressEntities` counter moving 3→6 after one juiced start.
 * Not sourced from `config/discovered.json` — no `juicedEnergyCost` field
 * exists there; `juicedMultiplier: 1` in that file does NOT represent this
 * and must not be read as either multiplier (SPEC.md's own correction).
 */
const JUICED_COST_MULTIPLIER = 3;

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
  // [session 35, CODEXIMPROVE #5] Loaded once the run's real DUNGEON_ID_CID
  // is known (first iteration of the loop below) and mutated in place —
  // `null` until then, since a fresh `getDungeonState()` read is what
  // reveals the identity to load against. See playCountsPersistence.ts.
  let playCountsRunId: number | null = null;
  // Set right after the use_item probe's own resync (below) — that resync
  // legitimately re-reads a state that hasn't changed (the whole point of a
  // probe that didn't apply), and without this the stall guard would trip on
  // its own follow-up read, mistaking "we just looked twice" for "the run is
  // stuck".
  let skipNextStateCheck = false;
  // [session 55] Limit 2 of `boonCapture.ts`'s three limits — ONE target per
  // run. Deliberately runOnce-local rather than on `deps`: two picks in one
  // run compound the run-quality cost and buy no extra information about
  // either boon, but a second RUN capturing a second target is exactly the
  // intended path to modelling all five.
  let boonCapturedThisRun = false;

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
    const estimatedCost = deps.juicedStartRun ? config.energyCostPerRun * JUICED_COST_MULTIPLIER : config.energyCostPerRun;
    const runUnits = deps.juicedStartRun ? JUICED_COST_MULTIPLIER : 1;
    guards.assertCanStartRun(estimatedCost, runUnits); // simulate the real gate — dry-run's whole purpose
    await assertDungeonCapNotExhausted(client, config, guards, log, guardStatePath);
    log.write({ event: "dry_run_start_run_intended", dungeonId: config.dungeonId, juiced: Boolean(deps.juicedStartRun) });
    console.log(`  [dry-run] would POST start_run (dungeonId ${config.dungeonId}${deps.juicedStartRun ? ", juiced" : ""})`);
    console.log(`  · no active run — nothing further to decide against, stopping.`);
    return;
  } else {
    const estimatedCost = deps.juicedStartRun ? config.energyCostPerRun * JUICED_COST_MULTIPLIER : config.energyCostPerRun;
    const runUnits = deps.juicedStartRun ? JUICED_COST_MULTIPLIER : 1;
    guards.assertCanStartRun(estimatedCost, runUnits);
    await assertDungeonCapNotExhausted(client, config, guards, log, guardStatePath);
    const body = deps.juicedStartRun
      ? buildJuicedStartRunEnvelope(config.dungeonId, deps.juicedStartRun.index, deps.startConsumables ?? [])
      : buildEnvelope("start_run", config.dungeonId, client.getActionToken(), 0, deps.startConsumables);
    // [session 54, brief §3] See `LiveRunDeps.energyProbe`. Read as close to
    // the POST as possible with nothing else in flight — a read placed before
    // the guard/cap checks above would have those requests' latency inside the
    // window and stop being tight.
    const energyBefore = deps.energyProbe ? await deps.energyProbe() : null;
    log.write({ event: "post", body });
    let resp;
    try {
      resp = await client.postDungeonAction(body);
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      // [session 47, brief §1e] The dungeon twin of session 46's fishing
      // incident: a `start_run` rejection is the ONE place the server tells
      // you WHY (daily cap, run already active, energy floor), and this line
      // threw that away. It is also the exact call whose fishing counterpart
      // spent two sessions being misdiagnosed from the doc state.
      fail(guards, log, "start_run rejected", serverErrorDetail(e));
    }
    guards.recordActionResult(true);
    guards.recordRunStarted(runUnits);
    // [session 31, CODEXREVIEW #8] Committed spend, recorded the moment
    // start_run succeeds — independent of whatever the account balance does
    // afterward (in-run regen, an external ROM claim). This is now the
    // guard's ledger of record; the before/after read in `main()` is a
    // diagnostic only. See src/orchestrator/energyAccounting.ts. `estimatedCost`
    // here is the same juiced-aware figure used for the pre-spend gate above
    // — the live before/after energy read in `main()` remains the diagnostic
    // ground truth per CLAUDE.md §1, this is only the guard's own ledger.
    guards.recordEnergySpent(estimatedCost);
    saveGuardBudget(guards.spentEnergy, guards.runCount, guardStatePath); // [session 09] persist immediately — see guardPersistence.ts
    log.write({ event: "post_response", resp });
    fixtures.write(resp);
    console.log(`  ✓ start_run sent — actionToken now ${client.getActionToken()}`);
    if (deps.energyProbe && energyBefore !== null) {
      const energyAfter = await deps.energyProbe();
      const tightDelta = energyAfter - energyBefore;
      // Reported against `estimatedCost` (the juiced-aware figure the guard
      // committed), so the line reads as a verdict rather than two numbers.
      log.write({
        event: "start_run_energy_probe",
        energyBefore,
        energyAfter,
        tightDelta,
        estimatedCost,
        matchesCommitted: tightDelta === -estimatedCost,
      });
      console.log(
        `  ▸ §23 tight energy probe: ${energyBefore} -> ${energyAfter} (delta ${tightDelta}) against a committed ${estimatedCost}` +
          (tightDelta === -estimatedCost
            ? ` — MATCHES. The charge is right, so any run-level drift is credited back DURING the run.`
            : ` — MISMATCH by ${tightDelta + estimatedCost}. The CHARGE itself differs from what the guard commits.`),
      );
    }
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
      // [session 35, CODEXIMPROVE #5] Per-run state, not a running total —
      // delete rather than let it go stale for whatever attempt starts next.
      if (deps.playCountsPersistence && playCountsRunId !== null) deletePlayCounts(deps.playCountsPersistence.path);
      return;
    }
    // [session 36, CODEXAUDIT #1 fix] Captured so a combat POST later this
    // SAME iteration can name the exchange it just observed (`beforeTag` is
    // reassigned fresh every loop iteration, before any combat branch is
    // reached — a probe/potion detour always `continue`s back here first, so
    // it is never stale when a combat POST actually uses it).
    const beforeTag = fixtures.write(state);

    const run = state.data.run as unknown as WireRun;
    const roomNum = (state.data.entity as { ROOM_NUM_CID?: number } | undefined)?.ROOM_NUM_CID ?? 0;
    // [session 57] Server-published, via config/discovered.json's
    // `forbiddenWoods.maxRoom` — verified live by scripts/checkMaxRoom.ts.
    // `MAX_ROOM` remains only as the last-resort literal for a caller that
    // built a config without it; rule 8's final-room clause is keyed on the
    // SERVER's number, and it is PER DUNGEON (Void Dungeon publishes 17).
    const maxRoom = deps.maxRoom ?? config.maxRoom ?? MAX_ROOM;
    const phase = classifyPhase(run);

    // [session 35, CODEXIMPROVE #5] First time this run's real identity is
    // known — load its persisted move distribution (a resume recovers
    // exactly what was logged earlier in this SAME run; a genuinely
    // different run's leftover, or nothing on disk, both start at zero, see
    // playCountsPersistence.ts's loadPlayCounts).
    if (deps.playCountsPersistence && playCountsRunId === null) {
      playCountsRunId = run.DUNGEON_ID_CID;
      const persisted = loadPlayCounts(playCountsRunId, deps.playCountsPersistence.path);
      playCounts.rock = persisted.rock;
      playCounts.paper = persisted.paper;
      playCounts.scissor = persisted.scissor;
    }

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
      // [session 35, CODEXIMPROVE #5] Win, death, or flee all land here —
      // delete rather than let it go stale for whatever attempt starts next.
      if (deps.playCountsPersistence && playCountsRunId !== null) deletePlayCounts(deps.playCountsPersistence.path);
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
        resp = await client.postDungeonAction(body, pacingForAction(body.action));
        deps.attemptTelemetry?.record(body.action, false);
      } catch (e) {
        // [session 53, brief §1] Recorded BEFORE rethrowing: a combat move has
        // no retry loop, so its only first attempt is also its last, and the
        // class would otherwise be absent from the summary of a run it ended.
        deps.attemptTelemetry?.record(body.action, true);
        if (e instanceof TokenExpiredError) throw e; // JWT rejected — never retry, SPEC §6.
        fail(guards, log, "dungeon action rejected", { action: d.move, ...serverErrorDetail(e) });
      }
      guards.recordActionResult(true);
      log.write({ event: "post_response", resp });
      const afterTag = fixtures.write(resp);

      const afterRun = resp!.data.run as unknown as WireRun | undefined;
      if (afterRun) {
        const foeAfter = afterRun.players[1] as WireSide;
        const foeMove = foeAfter.lastMove;
        if ((MOVES as readonly string[]).includes(foeMove)) {
          // [session 36, CODEXAUDIT #1 fix] Same identity a later restart's
          // `bootstrapFromCorpus()` will compute for this same fixture pair
          // (exchangeIdentity/exchangeLabel, shared with
          // opponentModelPersistence.ts) — marked into the SAME
          // `bootstrapImportedIds` ledger that gets persisted below, so that
          // restart finds it already present and skips re-importing it.
          // Before this fix, the live path never marked this set at all, so
          // every live observation was silently re-imported (double-counted)
          // on the next restart's bootstrap pass.
          const exchangeId = deps.opponentModelPersistence
            ? exchangeIdentity(fixtures.runName, exchangeLabel(beforeTag, afterTag))
            : null;
          const alreadyObserved = exchangeId !== null && deps.opponentModelPersistence!.bootstrapImportedIds.has(exchangeId);
          if (!alreadyObserved) {
            model.observe(modelKey(foeWire.id, roomNum), foeMove as MoveKey, prevFoeMove);
          }
          prevFoeMove = foeMove as MoveKey;
          playCounts[d.move]++;
          // [session 32, CODEXIMPROVE #1] Persist immediately, same
          // discipline as guards.recordEnergySpent -> saveGuardBudget: a
          // crash mid-run loses at most this one observation, never
          // previously-learned evidence.
          if (deps.opponentModelPersistence && exchangeId !== null && !alreadyObserved) {
            deps.opponentModelPersistence.bootstrapImportedIds.add(exchangeId);
            saveOpponentModelAtomically(model, deps.opponentModelPersistence.bootstrapImportedIds, deps.opponentModelPersistence.path);
          }
          // [session 35, CODEXIMPROVE #5] Same "persist immediately" rule,
          // applied to the move distribution loot.ts's "upgrade" case ranks
          // against.
          if (deps.playCountsPersistence && playCountsRunId !== null) {
            savePlayCounts(playCountsRunId, playCounts, deps.playCountsPersistence.path);
          }
        }
      }
      continue;
    }

    if (phase === "enemyPath") {
      // `enemyBuff` is REQUIRED here, not decorative: rule 8 takes the highest
      // tier among NON-PERPETUAL options, so an offer read without it would
      // silently take a card the user directive forbids. See enemyTier.ts.
      const r = run as WireRun & { enemyPathOptions?: EnemyPathOption[] };
      const options = r.enemyPathOptions ?? [];
      const rule = tierRuleFor(roomNum, maxRoom);
      let chosen: EnemyPathOption;
      try {
        // [session 57] Rule 8 as of 2026-08-20: HIGHEST tier among
        // non-Perpetual options, except at the dungeon's final room, where the
        // no-modifiers exception takes the lowest instead. An empty offer, or
        // an offer that is entirely perpetual, throws — both fail closed.
        chosen = pickTierForRoom(options, roomNum, maxRoom);
      } catch (e) {
        const event =
          e instanceof PerpetualOnlyOfferError ? "all_perpetual_enemy_path_options" : "empty_enemy_path_options";
        log.write({ event, error: (e as Error).message, options });
        console.log(`  ✗ ${(e as Error).message}`);
        throw e;
      }
      const safeOffered = options.some((o) => o.tier === SAFE_TIER);
      const posn = options.indexOf(chosen); // array position — what selectEnemyPathByIndex needs, NOT the wire's own .index field
      const topTierOffered = Math.max(...options.map((o) => o.tier));
      if (rule === "highest") {
        console.log(
          `  ▸ enemy path: rule 8 — taking the HIGHEST offered tier ${chosen.tier} of ${topTierOffered}` +
            `${chosen.tier === SAFE_TIER ? " (Safe — it was the only tier offered)" : ""}`,
        );
      } else if (rule === "final-room") {
        console.log(
          `  ▸ enemy path: FINAL ROOM (room ${roomNum} of maxRoom ${maxRoom}) — rule 8's no-modifiers ` +
            `exception, taking tier ${chosen.tier} of ${topTierOffered}. No upgrades follow the boss.`,
        );
      } else {
        // Loud on purpose: this is the shape in which the flip goes silently
        // inert. See tierRuleFor's doc comment.
        console.log(
          `  ⚠ enemy path: room (${roomNum}) or maxRoom (${maxRoom}) UNREADABLE — falling back to the ` +
            `conservative no-modifiers rule and taking tier ${chosen.tier} of ${topTierOffered}. ` +
            `If this repeats every room, rule 8's highest-tier clause is NOT firing — check ROOM_NUM_CID.`,
        );
      }
      // [session 57] The Perpetual clause now CHANGES THE TIER rather than
      // breaking a within-tier tie, so it is reported against the tier it cost.
      // Session 56 measured this shape at 47 of 134 offers (35%).
      const perpetualCostATier = rule === "highest" && chosen.tier < topTierOffered;
      const perpetualAvoided = options.some(
        (o) => o.tier === chosen.tier && isPerpetualBuff(o.enemyBuff) && options.indexOf(o) < posn,
      );
      if (perpetualCostATier) {
        console.log(
          `  ▸ perpetual filtered (user directive 2026-08-20): every option at tier ${topTierOffered} ` +
            `carried a "perpetual_" buff, so the highest ELIGIBLE tier is ${chosen.tier}.`,
        );
      } else if (perpetualAvoided) {
        console.log(
          `  ▸ perpetual avoided (user directive 2026-08-20): skipped a "perpetual_" card at the ` +
            `same tier ${chosen.tier} in favour of a clean one. Tier unchanged.`,
        );
      }
      log.write({
        event: "tier_choice",
        rule,
        chosen,
        position: posn,
        options,
        safeOffered,
        topTierOffered,
        perpetualCostATier,
        perpetualAvoided,
        perpetualOffered: options.some((o) => isPerpetualBuff(o.enemyBuff)),
      });

      if (dryRun) {
        console.log(`  [dry-run] would POST ${selectEnemyPathByIndex(posn)} (data.index 0 — see buildPathSelectionEnvelope)`);
        return;
      }
      // Index is re-derived by identity — "whichever position the tier rule
      // picks right now" — on every attempt, including this first one, never
      // resent from `posn` captured above, per
      // postWithVerifiedRetry's doc comment (session-09 brief §1). data.index
      // in the POST body is 0 regardless of position — confirmed live, see
      // buildPathSelectionEnvelope.
      const resp = await postWithVerifiedRetry(
        client,
        guards,
        log,
        run,
        (freshRun) => locateChosenTierOption(freshRun, roomNum, maxRoom),
        (index) => buildPathSelectionEnvelope(selectEnemyPathByIndex(index), 0),
        (freshRun) => classifyPhase(freshRun) === "enemyPath",
        "enemy path selection rejected",
        deps.attemptTelemetry,
      );
      if (resp) fixtures.write(resp);
      continue;
    }

    if (phase === "rewardPath") {
      const r = run as WireRun & {
        rewardPathOptions?: Array<{ index: number; boon: WireBoon; gigusOrbAmount?: number }>;
      };
      const options = r.rewardPathOptions ?? [];
      const player = toCombatant(meWire);
      const mapped = options.map((o, i) => ({ wireIndex: i, option: wireBoonToOption(o.boon) }));
      const rankedOption = pickBoon(
        player,
        mapped.map((m) => m.option),
        roomNum,
        { playCounts },
      );
      // [session 56, brief §2] The user's directive, layered ABOVE the scorer
      // rather than weighted into it: most of what the directive names is
      // unmodelled, and `rankBoons` has no model to weight (see
      // boonPriority.ts's header). `null` means the offer held nothing on the
      // list and the ranked pick stands unchanged.
      const priorityConfig = deps.boonPriority === null ? null : (deps.boonPriority ?? DEFAULT_BOON_PRIORITY);
      // [session 57, brief §2] The Hard Core payout, per option, parallel to
      // `offered` by index. It differs across the three options in 136 of 138
      // recorded offers, and the bot ignored it for 56 sessions. Read here and
      // used ONLY to break a tie within one priority rank — see boonPriority.ts.
      const orbs = options.map((o) => (o as { gigusOrbAmount?: number }).gigusOrbAmount);
      const priority = priorityConfig
        ? choosePriorityBoon({
            player,
            offered: mapped.map((m) => m.option),
            room: roomNum,
            config: priorityConfig,
            rankOptions: { playCounts },
            orbs,
          })
        : null;
      // [session 58, brief §1] Policy C, the WIDE orb reading — shipped after a
      // pre-registered depth experiment (`scripts/orbDepthExperiment.ts`, n=8000
      // paired) put C's cost at -0.002 rooms, 95% CI [-0.018, +0.014], against a
      // 0.15-room ship bar; it buys +6.3 Hard Core per run for no measurable
      // depth. It runs ONLY where `choosePriorityBoon` returned null, i.e. where
      // no priority family was on offer at all, so it still cannot override a
      // higher-priority boon — the session-57 directive's one hard constraint.
      const orbFallback = priorityConfig && !priority
        ? chooseOrbFallback({
            player,
            offered: mapped.map((m) => m.option),
            room: roomNum,
            config: priorityConfig,
            rankOptions: { playCounts },
            orbs,
          })
        : null;
      // [session 55, brief §3] The capture override, if one is armed and this
      // offer holds an unmodelled target. `null` on every ordinary run and on
      // ~82% of room-1 offers even when armed — see boonCapture.ts's measured
      // rate. `isModelled` is injected there so the module stays pure and its
      // tests need no fixture; here it is the real `BOON_MODELS`, so a target
      // that has since been modelled retires itself.
      const capture = deps.boonCapture
        ? chooseCaptureBoon({
            offered: mapped.map((m) => m.option),
            room: roomNum,
            config: deps.boonCapture.config,
            alreadyCaptured: boonCapturedThisRun,
            isModelled: (type) => Boolean(BOON_MODELS[type]),
          })
        : null;
      // Precedence: capture > priority > ranked. `boonCapture` is OFF by
      // default and requires an explicit `--boon-capture`, so arming it IS the
      // choice to pay run quality for a measurement on that run; it therefore
      // wins. The overlap between the two layers is small and MEASURED — 1 of
      // boonCapture's 5 targets (`VulnerableBlock`) is a priority family
      // member — which is why both layers exist rather than one replacing the
      // other. See boonPriority.ts's precedence section.
      // Precedence, widened at the tail only: capture > priority > ORB FALLBACK
      // > ranked. The fallback slots in below priority by construction (it is
      // only computed when priority is null), so nothing above it moved.
      const chosenOption = capture
        ? capture.option
        : priority
          ? priority.option
          : (orbFallback?.option ?? rankedOption);
      const chosenEntry = mapped.find((m) => m.option === chosenOption)!;
      const chosenIndex = chosenEntry.wireIndex;
      if (capture) {
        console.log(
          `  ▸ reward: BOON-CAPTURE override — taking "${chosenOption.type}" (index ${chosenIndex}) ` +
            `instead of ranked "${rankedOption.type}". ${capture.reason}`,
        );
      } else if (priority) {
        const note =
          priority.option.type === rankedOption.type
            ? "(the ranker agreed)"
            : `instead of ranked "${rankedOption.type}"`;
        console.log(
          `  ▸ reward: BOON-PRIORITY ${priority.priority} (${priority.label}) — taking ` +
            `"${chosenOption.type}" (index ${chosenIndex}) ${note}.`,
        );
      } else if (orbFallback) {
        const note =
          orbFallback.option.type === rankedOption.type
            ? "(the ranker agreed)"
            : `instead of ranked "${rankedOption.type}"`;
        console.log(
          `  ▸ reward: ORB FALLBACK — no priority family on offer; taking ` +
            `"${chosenOption.type}" (index ${chosenIndex}) for ${orbFallback.orbs} Hard Core ` +
            `out of [${orbs.join(", ")}] ${note}.`,
        );
      } else {
        console.log(`  ▸ reward: picking "${chosenOption.type}" (index ${chosenIndex})`);
      }
      log.write({
        event: "boon_choice",
        chosen: chosenOption,
        chosenIndex,
        options,
        ...(capture ? { capture: { overrodeRanked: rankedOption.type, reason: capture.reason } } : {}),
        ...(priority
          ? {
              priority: {
                rank: priority.priority,
                label: priority.label,
                overrodeRanked: priority.option.type === rankedOption.type ? null : rankedOption.type,
                reason: priority.reason,
                // [session 57] The orb tie-break's live record: what it took,
                // what was on the table, and whether it actually decided.
                orbTieBreak: priority.orbTieBreak,
                orbsTaken: priority.orbs,
                orbsOffered: orbs,
              },
            }
          : {}),
        ...(orbFallback
          ? {
              orbFallback: {
                overrodeRanked: orbFallback.option.type === rankedOption.type ? null : rankedOption.type,
                reason: orbFallback.reason,
                // False means every option paid the same and `rankBoons` decided
                // exactly as it always did — recorded so the log never claims a
                // decision the payout did not make.
                narrowed: orbFallback.narrowed,
                orbsTaken: orbFallback.orbs,
                orbsOffered: orbs,
              },
            }
          : {}),
      });
      // A directive whose whole point is "take it if you ever see it" deserves
      // a record of every time it was seen — BurnMastery appears once in the
      // entire 135-offer corpus, so this line firing at all is news.
      if (priority?.orbTieBreak) {
        console.log(
          `  ▸ orb tie-break (user directive 2026-08-20): options tied at priority ${priority.priority}, ` +
            `took the ${priority.orbs} Hard Core payout out of [${orbs.join(", ")}].`,
        );
      }
      if (priority?.burnMastery) {
        log.write({ event: "boon_priority_burnmastery", room: roomNum, chosen: chosenOption, options });
        console.log(`  ▸ BurnMastery was on offer at room ${roomNum} and was taken (priority 1).`);
      }
      // The `AddLifestealSword` edge — logged whether the demotion applied or
      // not, so the room-8 boundary has a record either way. Computed from the
      // OFFER, not from `priority.conflictedTypes`, because the interesting
      // case includes the one where no priority match fired at all (an offer
      // of lifesteal plus two unlisted types returns null, and a sighting
      // recorded only on the matched path would silently miss it).
      const sightings = priorityConfig
        ? lifestealSightings(mapped.map((m) => m.option), roomNum, priorityConfig)
        : [];
      if (sightings.length > 0) {
        log.write({
          event: "boon_priority_conflict",
          room: roomNum,
          earlyGameMaxRoom: priorityConfig?.earlyGameMaxRoom ?? null,
          sightings,
          chosen: chosenOption,
        });
      }

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
        deps.attemptTelemetry,
      );
      const afterTag = resp ? fixtures.write(resp) : null;
      // [session 55] The whole point of the override: a pick that does not
      // produce a usable pair costs run quality and buys nothing. `beforeTag`
      // is the offer state written at the top of this same loop iteration;
      // `afterTag` is the server's response to the pick. Recorded as ONE log
      // event so the pair is read off a single line rather than reconstructed
      // by hunting adjacent fixture numbers — and only when BOTH halves
      // exist, so a failed write can never be reported as a capture.
      if (capture && deps.boonCapture && afterTag) {
        deps.boonCapture.captures.push({
          type: chosenOption.type,
          room: roomNum,
          beforeTag,
          afterTag,
        });
        boonCapturedThisRun = true;
        log.write({
          event: "boon_capture_pair",
          type: chosenOption.type,
          room: roomNum,
          selected: { val1: chosenOption.val1, val2: chosenOption.val2 },
          beforeTag,
          afterTag,
          runName: fixtures.runName,
        });
        console.log(`  ▸ boon-capture PAIR recorded: ${fixtures.runName} ${beforeTag} → ${afterTag}`);
      }
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

export function parseArgs(argv: string[]) {
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
  // [session 47, brief §1a] Opt OUT of the ROM-claim preflight — see the
  // identical flag in scripts/liveFishing.ts.
  const noRomClaim = argv.includes("--no-rom-claim");
  // [session 52 §1a] Default `descending` — the shipped session-47 order.
  // Omitting the flag must leave the preflight byte-for-byte what it was.
  const claimOrderArg = argv.find((a) => a.startsWith("--claim-order="));
  const claimOrderRaw = claimOrderArg?.split("=")[1];
  if (claimOrderRaw !== undefined && claimOrderRaw !== "ascending" && claimOrderRaw !== "descending") {
    throw new Error(`--claim-order=${claimOrderRaw} is not a valid order — pass "ascending" or "descending".`);
  }
  const claimOrder: ClaimOrder = claimOrderRaw ?? "descending";
  // [session 42, Task 14] `--juiced` only takes effect on a genuinely new
  // start_run (never a resume — a resumed run's juiced status was already
  // decided by whoever originally started it, see runOnce's "existing"
  // branch). `--juiced-index=N` is required alongside it and NOT defaulted
  // to the one confirmed live value (3) — TASKS.md Task 14 states plainly
  // that "index == tier" is not yet confirmed in general, so guessing it
  // here would be exactly the class of mistake CLAUDE.md §2 forbids.
  const juiced = argv.includes("--juiced");
  // [session 55, brief §3] Half of the two-condition gate on the boon-capture
  // override. The other half is `config/bot.json`'s
  // `forbiddenWoods.boonCapture.enabled`. Neither alone arms it.
  const boonCaptureFlag = argv.includes("--boon-capture");
  const juicedIndexArg = argv.find((a) => a.startsWith("--juiced-index="));
  const juicedIndex = juicedIndexArg ? Number(juicedIndexArg.split("=")[1]) : undefined;
  if (juiced && juicedIndex === undefined) {
    throw new Error(
      `--juiced was passed but --juiced-index=N was not — the loop refuses to guess which tier/offering index to ` +
        `send. The one confirmed live value is index 3 (a Tier-3 pick, DECISIONS.md 2026-08-18) but "index == tier" ` +
        `in general is NOT yet confirmed (TASKS.md Task 14) — pass the index explicitly.`,
    );
  }
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
    noRomClaim,
    claimOrder,
    juiced,
    juicedIndex,
    boonCaptureFlag,
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
  // [session 32, CODEXIMPROVE #1] Same one-writer-per-file discipline,
  // reused rather than reinvented, against the opponent-model file's own
  // path — see opponentModelPersistence.ts's header.
  process.once("exit", acquireGuardLock(DEFAULT_OPPONENT_MODEL_PATH));
  // [session 35, CODEXIMPROVE #5] Same one-writer-per-file discipline against
  // the play-counts file's own path — see playCountsPersistence.ts's header.
  process.once("exit", acquireGuardLock(DEFAULT_PLAY_COUNTS_PATH));
  const playCountsPersistence = { path: DEFAULT_PLAY_COUNTS_PATH };
  // [session 09] Seed from today's already-spent energy/runs so the budget
  // holds across separate process invocations, not just within one — see
  // guardPersistence.ts.
  const seed = loadGuardBudget();
  if (seed.energySpent > 0 || seed.runsStarted > 0) {
    console.log(`  · resuming today's budget: ${seed.energySpent} energy / ${seed.runsStarted} runs already spent`);
  }
  /**
   * [session 53, brief §1] One counter for the whole invocation — both runs
   * of a `--runs=2` share it, so the summary reports the session's rate
   * rather than the last run's.
   */
  const attemptTelemetry = new AttemptTelemetry();

  const guards = new GuardState(
    {
      dailyEnergyBudget: config.dailyEnergyBudget,
      maxRunsPerSession: config.maxRunsPerSession,
      maxConsecutiveActionFailures: config.maxConsecutiveActionFailures,
    },
    seed,
  );
  // [session 32, CODEXIMPROVE #1] Persist and bootstrap the opponent model
  // across restarts — previously a blank model every launch, discarding
  // exactly the evidence that matters most in deeper, sparser rooms. See
  // opponentModelPersistence.ts's header.
  const { model, bootstrapImportedIds } = loadOpponentModel(DEFAULT_OPPONENT_MODEL_PATH);
  const { imported } = bootstrapFromCorpus(model, bootstrapImportedIds);
  if (imported > 0) {
    console.log(`  · opponent model: bootstrapped ${imported} new exchange(s) from the fixture corpus (${bootstrapImportedIds.size} total imported)`);
    saveOpponentModelAtomically(model, bootstrapImportedIds, DEFAULT_OPPONENT_MODEL_PATH);
  }
  const opponentModelPersistence = { path: DEFAULT_OPPONENT_MODEL_PATH, bootstrapImportedIds };
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
  if (args.juiced) {
    console.log(`  · --juiced: next genuinely new start_run will send isJuiced:true, index ${args.juicedIndex}.`);
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
  //
  // [session 42, Task 14] The AUTO-detect-from-config branch below is now
  // gated behind `args.juiced` — session 24's incident (DECISIONS.md
  // 2026-08-17) was exactly this branch applying unconditionally to a plain
  // run because there was no juiced-vs-plain distinction in code yet. The
  // user's directive from that incident is unconditional: "non-juiced runs
  // must NEVER use potions." An explicit `--potions=N` still works (it's
  // also what a `--resume-existing` of an already-juiced run needs — that
  // run's potions were committed by whoever started it, not by this gate),
  // but the automatic default-to-configured-allowlist behavior no longer
  // fires for a plain new start_run.
  let potionItemId = config.potions?.allowedItemId;
  let potionCount = args.potionCount;
  if (potionCount === undefined) {
    if (!config.potions) {
      potionCount = 0;
      console.log(
        `  · potions: NOT configured (config/bot.json's forbiddenWoods.potions is absent) -> loading 0. This is the safe default, not a bug.`,
      );
    } else if (!args.juiced) {
      potionCount = 0;
      console.log(
        `  · potions: config/bot.json has forbiddenWoods.potions configured, but --juiced was not passed -> loading 0. ` +
          `[Task 14] Potions auto-load only for a genuinely new JUICED start_run now (session 24 directive: "non-juiced ` +
          `runs must NEVER use potions"). Pass --potions=N explicitly to override (e.g. resuming an already-juiced run), ` +
          `or pass --juiced to start a new one.`,
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

  // [session 55, brief §3] The boon-capture override, armed only when BOTH
  // the config block says `enabled: true` AND `--boon-capture` was typed.
  // Two conditions, exactly like the potion gate above and for the same
  // reason — session 24 shipped a one-condition gate on the block next door
  // and it consumed a user's limited item on an unauthorized run. Everything
  // this override does is announced here and again in the run summary,
  // because a deliberately suboptimal pick that happens silently is
  // indistinguishable from a bug.
  // [session 56] The directive's one knob. No gate — see boonPriority.ts and
  // config/bot.json's `_boonPriorityComment` for why this differs from the
  // two-condition boon-capture gate right below it.
  const boonPriority: BoonPriorityConfig = {
    ...DEFAULT_BOON_PRIORITY,
    ...(config.boonPriority ?? {}),
  };
  const orbRule = boonPriority.orbRule ?? "tie-break";
  console.log(
    `  · boon-priority: ON (user directive 2026-08-20) — BurnMastery > AddMaxArmor > AddMaxHealth > ` +
      `Sword family > Vulnerable family; lifesteal demoted in rooms 1..${boonPriority.earlyGameMaxRoom}.`,
  );
  // [session 58] Printed at startup because it is the one boon knob that can be
  // flipped from config, and a run's boon log is unreadable without knowing
  // which rule produced it.
  console.log(
    orbRule === "wide"
      ? `  · orb rule: WIDE (session 58) — where NO priority family is offered, the richest Hard Core payout wins ` +
        `and rankBoons breaks payout ties. Shipped on a pre-registered depth test: -0.002 rooms, 95% CI ` +
        `[-0.018, +0.014] at n=8000, vs a 0.15-room bar; +6.3 orbs/run. Never overrides a priority family.`
      : `  · orb rule: TIE-BREAK (session 57) — the payout only separates options already tied at the best ` +
        `priority rank. This is the pre-session-58 rule; config/bot.json has it pinned.`,
  );

  const captureCfg = config.boonCapture;
  let boonCapture: LiveRunDeps["boonCapture"];
  if (args.boonCaptureFlag && !captureCfg?.enabled) {
    throw new Error(
      `--boon-capture was passed but config/bot.json's forbiddenWoods.boonCapture is ` +
        `${captureCfg ? "present with enabled: false" : "absent"} — the loop refuses to trade run quality on a flag ` +
        `alone. Both conditions are required (see src/strategy/boonCapture.ts).`,
    );
  }
  if (captureCfg?.enabled && !args.boonCaptureFlag) {
    console.log(
      `  · boon-capture: config enables it but --boon-capture was NOT passed -> OFF. This is the safe default, not a bug.`,
    );
  }
  if (captureCfg?.enabled && args.boonCaptureFlag) {
    const cfg: BoonCaptureConfig = {
      enabled: true,
      targets: captureCfg.targets ?? DEFAULT_CAPTURE_TARGETS,
      rooms: captureCfg.rooms ?? DEFAULT_CAPTURE_ROOMS,
    };
    boonCapture = { config: cfg, captures: [] };
    const live = cfg.targets.filter((t) => !BOON_MODELS[t]);
    console.log(
      `  · boon-capture: ARMED, rooms ${cfg.rooms.join("/")}, targets ${cfg.targets.join(", ")}` +
        (live.length === cfg.targets.length ? "" : ` (still unmodelled: ${live.join(", ") || "NONE — every target already has a pair"})`) +
        `. This DELIBERATELY takes a worse boon, at most once per run, to record a pickup pair.`,
    );
  }

  // [session 45, TASKS.md Task 10] Graceful SIGINT, wired into this
  // direct-CLI entry point's own `main()`. `runOnce` has accepted a
  // `shutdownSignal` since Task 10 (it is checked once per turn, before the
  // next move is chosen — see `deps.shutdownSignal?.requested` in `runOnce`),
  // but only `scripts/orchestrator.ts` ever constructed and installed one, so
  // `kill -INT` on a `npx tsx scripts/liveRun.ts` process fell through to
  // Node's default immediate termination instead of the documented "stop
  // before the next move" path. Session 44 found this on the fishing side and
  // confirmed the identical gap here; this closes both. A second press
  // force-exits, same as the orchestrator.
  const shutdownSignal = createShutdownSignal();
  const uninstallSigint = installProcessSigintHandler(shutdownSignal);

  const targetRuns = args.dryRun || args.stage2 ? 1 : args.runs;

  // [session 47, brief §1a] Energy preflight — same module and same rationale
  // as scripts/liveFishing.ts's; see src/orchestrator/energyPreflight.ts. A
  // juiced start costs 3x, so the batch's real cost is priced off the same
  // JUICED_COST_MULTIPLIER the guard charges. A resume spends no energy at
  // all, so `--resume-existing` skips the preflight rather than demanding a
  // pool it will not touch.
  if (!args.stage2 && !args.resumeExisting && !args.noRomClaim) {
    const perRun = args.juiced ? config.energyCostPerRun * JUICED_COST_MULTIPLIER : config.energyCostPerRun;
    // [session 51 §5] `--dry-run` used to skip this block entirely, so the
    // preflight — wired in session 47 and never once exercised against the
    // live API in the eight sessions since — was the ONE step a dry run could
    // not vouch for. It now runs read-only: every read, every verdict, no
    // claim.
    // [session 52 §1a] `--claim-order` defaults to `descending` — the shipped
    // session-47 posture, unchanged when the flag is absent. `ascending` is
    // for a FIRST live exercise of the claim path: it walks the loop several
    // times instead of once, and it risks the smallest ROM in the bank rather
    // than the largest. Bounded at ASCENDING_MAX_CLAIMS so a tiny-ROM bank
    // can't turn one preflight into fifty requests; the bound's fallback
    // claims the largest remaining ROM, which is what descending would have
    // done anyway.
    const preflight = await ensureEnergyFor(
      targetRuns * perRun,
      clientEnergyPreflightDeps(client, me.address, (line) => console.log(line)),
      {
        readOnly: args.dryRun,
        order: args.claimOrder,
        ...(args.claimOrder === "ascending" ? { maxClaims: ASCENDING_MAX_CLAIMS } : {}),
      },
    );
    log.write({ event: "energy_preflight", dryRun: args.dryRun, ...preflight });
    // [session 54, brief §4] `claim_audit` only fires when something was
    // claimed, so the overflow condition was invisible on every run whose
    // pool already covered the batch — which is most of them. The WARN
    // itself is emitted by `ensureEnergyFor`; this makes it greppable in the
    // run log independently of whether a claim happened.
    if (preflight.overflowReachable === true) {
      log.write({ event: "overflow_reachable", maxSnapshot: preflight.maxSnapshot, headroom: preflight.headroom });
    }
    // [session 52 §1c] The claim path's whole value is that it is now
    // measurable. A snapshot is a read-time estimate; `poolAfter - poolBefore`
    // is the measured truth, and the gap between them is the signal. Small
    // POSITIVE drift is expected and confirms the snapshot is live (session 20
    // saw romId 689 credit +12 against a snapshot of 11 — accrual between read
    // and claim). A NEGATIVE gap, or a claim crediting zero, is the failure
    // mode this exercise exists to catch, and it is invisible if only the
    // total is reported.
    if (preflight.claimedDocIds.length > 0) {
      const measured = preflight.poolAfter - preflight.poolBefore;
      const drift = measured - preflight.claimedSnapshotTotal;
      console.log(
        `  ▸ claim audit: ${preflight.claimedDocIds.length} claim(s) ${preflight.claimOrder}, snapshot total ` +
          `${preflight.claimedSnapshotTotal}, measured pool delta ${measured >= 0 ? "+" : ""}${measured} ` +
          `(drift ${drift >= 0 ? "+" : ""}${drift})` +
          (preflight.fallbackClaimDocId ? ` [largest-remaining fallback: ${preflight.fallbackClaimDocId}]` : ""),
      );
      if (drift < 0) {
        console.log(`  ⚠ NEGATIVE drift — the pool moved LESS than the claimed snapshots. Do not treat this claim as clean.`);
      }
      // Per-ROM attribution: re-read the bank and report each claimed ROM's
      // post-claim `energyCollectable`. A claimed ROM should read ~0; anything
      // else means the claim moved less than the ROM held.
      const after = await client.getRomsPlayer(me.address);
      const post = new Map(after.entities.map((e) => [e.docId, e.factoryStats.energyCollectable]));
      for (const c of preflight.claims) {
        const remaining = post.get(c.docId);
        console.log(
          `    · ${c.docId}: snapshot ${c.snapshot} -> post-claim energyCollectable ${remaining ?? "?"}` +
            (c.fallback ? " [fallback]" : "") +
            (remaining !== undefined && remaining > c.snapshot * 0.5 ? "  ⚠ still holds most of its snapshot" : ""),
        );
      }
      log.write({
        event: "claim_audit",
        measuredDelta: measured,
        snapshotTotal: preflight.claimedSnapshotTotal,
        drift,
        // [session 53, brief §3] Closes the untested "overflow past the cap is
        // non-wasting" comment BY CONSTRUCTION when `maxSnapshot < headroom`:
        // no single claim this path can make is capable of reaching the cap,
        // so switching the default to descending cannot trip it by accident.
        maxSnapshot: preflight.maxSnapshot,
        headroom: preflight.headroom,
        // [session 54, brief §4] Read off the preflight result rather than
        // recomputed here — see `EnsureEnergyResult.overflowReachable`.
        overflowReachable: preflight.overflowReachable,
        perRom: preflight.claims.map((c) => ({ ...c, postClaimCollectable: post.get(c.docId) ?? null })),
      });
    }
  } else if (args.noRomClaim) {
    console.log(`  · --no-rom-claim: skipping the energy preflight; the pool is used exactly as-is.`);
  }

  for (let i = 0; i < targetRuns; i++) {
    if (shutdownSignal.requested) {
      console.log(`\n▸ stopped by SIGINT before run ${i + 1}/${targetRuns}.`);
      break;
    }
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
          // [session 42, Task 14] `args.juiced &&` is the structural
          // enforcement point for "never load potions into a plain run" —
          // regardless of how `potionCount`/`potionItemId` got set (explicit
          // `--potions=N` or, once `--juiced` gates it above, config
          // auto-detect), a genuinely new start_run only carries them into
          // `data.consumables` when this invocation is actually starting a
          // juiced run. A `--resume-existing` invocation never reaches this
          // branch at all (see runOnce's "existing" branch), so resuming an
          // already-juiced run's own committed potions is unaffected.
          startConsumables:
            args.probeConsumablesItemId !== undefined
              ? [args.probeConsumablesItemId]
              : args.juiced && potionCount > 0 && potionItemId
                ? Array(potionCount).fill(potionItemId)
                : undefined,
          juicedStartRun: args.juiced ? { index: args.juicedIndex! } : undefined,
          boonCapture,
          boonPriority,
          // [session 54, brief §3] QUESTIONS.md §23 — two GETs, zero energy,
          // armed on every real run. Skipped on a dry run, which never POSTs
          // start_run and so has nothing to bracket.
          energyProbe: args.dryRun ? undefined : () => currentEnergy(client, me.address),
          potionPolicy: potionPolicyState,
          opponentModelPersistence,
          playCountsPersistence,
          shutdownSignal,
          attemptTelemetry,
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
    if (runError) {
      // [session 53, brief §1] The failure path is exactly where the
      // first-attempt rates matter most, and it is the path that skips the
      // end-of-invocation summary below.
      console.log(attemptTelemetry.format());
      throw runError;
    }
    if (args.stage2) break;
  }

  uninstallSigint();

  console.log(`\n▸ done. energy spent (guard-tracked) ${guards.spentEnergy}, runs ${guards.runCount}`);
  if (boonCapture) {
    // Reported on EVERY armed invocation, including the zero case — "armed and
    // never fired" is the ~82%-of-room-1-offers outcome and must not read as
    // "was never on". See boonCapture.ts's measured rate.
    console.log(
      boonCapture.captures.length === 0
        ? `▸ boon-capture: ARMED, 0 pairs recorded (no targeted offer appeared in a permitted room — the common case).`
        : `▸ boon-capture: ${boonCapture.captures.length} pair(s) recorded — ` +
          boonCapture.captures
            .map((c) => `${c.type} room ${c.room} (${c.beforeTag} → ${c.afterTag})`)
            .join("; ") +
          `. Model these in src/sim/boons.ts before the next armed run.`,
    );
  }
  console.log(attemptTelemetry.format());
  console.log(`▸ log: ${log.filePath}`);
  console.log(`▸ fixtures: ${fixtures.dir}\n`);

  // [session 31] Standalone invocations (Task 6) now regenerate the
  // committed run-visibility reports too, same as orchestrator.ts's
  // end-of-session rollup — see regenerateReports.ts.
  regenerateRunReports(config);
}

const isMain = process.argv[1] && process.argv[1].endsWith("liveRun.ts");
if (isMain) {
  main().catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    if (e instanceof GuardTrip) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof EnergyPreflightError) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof UnexpectedResponseError) console.error(`  status ${e.status}  path ${e.path}\n  body: ${e.body}`);
    process.exit(1);
  });
}
