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
 *   - The enemy-path / reward-path / loot selection action is NOT confirmed.
 *     SPEC §2 lists `loot_one`…`loot_four` as the only index-selecting
 *     actions, so `selectByIndex()` below sends `loot_<n>` for whichever
 *     phase is offering a choice, `data.index` set to the 0-based index
 *     too. This is a **hypothesis**, not a known fact — flagged inline, and
 *     the guard's fail-closed-on-failure behavior means a wrong guess halts
 *     the run rather than corrupting it. Confirm or correct this the moment
 *     a real response comes back, same discipline as `DungeonActionResponseSchema`.
 *
 * Fixtures land in `fixtures/dungeon-runs/run-<stamp>/`, same shape as
 * `scripts/watch.ts` (raw/ unredacted + redacted top-level), so live play
 * grows the corpus automatically — session-08 brief §4.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { GigaverseClient } from "../src/api/client.js";
import type { DungeonAction, DungeonActionRequest, DungeonState } from "../src/api/schemas.js";
import { TokenExpiredError, UnexpectedResponseError } from "../src/api/errors.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip } from "../src/orchestrator/guards.js";
import { toCombatant, type WireRun, type WireSide, type WireBoon } from "../src/sim/corpus.js";
import { MOVES, type BattleState, type MoveKey } from "../src/sim/types.js";
import type { BoonOption } from "../src/sim/boons.js";
import { decide, formatDecision, type Decision } from "../src/strategy/decide.js";
import { LIVE_CONFIG, type StrategyConfig } from "../src/strategy/config.js";
import { OpponentModel, modelKey } from "../src/strategy/opponentModel.js";
import { pickSafeTier, UnsafeTierError } from "../src/strategy/enemyTier.js";
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

const LOOT_ACTIONS: readonly DungeonAction[] = ["loot_one", "loot_two", "loot_three", "loot_four"];

/**
 * [INFERRED, not confirmed — see file header] Maps a 0-based choice index
 * into a `loot_<n>` action. Throws on index >= 4 — the corpus has never
 * shown an offer with more than 3 options, so a 4th would itself be a
 * surprise worth stopping on rather than silently dropping.
 */
export function selectByIndex(index: number): DungeonAction {
  const action = LOOT_ACTIONS[index];
  if (!action) throw new Error(`selectByIndex(${index}) — no loot_* action for an index this large`);
  return action;
}

/** `rewardPathOptions[].boon` -> the sim's BoonOption shape (src/sim/boons.ts). */
export function wireBoonToOption(w: WireBoon): BoonOption {
  return { type: w.boonTypeString, val1: w.selectedVal1, val2: w.selectedVal2 };
}

export function buildEnvelope(
  action: DungeonAction,
  dungeonId: number,
  actionToken: number,
  index = 0,
): DungeonActionRequest {
  return { action, dungeonId, actionToken, data: { consumables: [], isJuiced: false, index } };
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
}

/** Records `false` on guards and re-throws — the shared shape of every failure path. */
function fail(guards: GuardState, log: RunLog, reason: string, detail?: Record<string, unknown>): never {
  guards.recordActionResult(false);
  log.write({ event: "action_failed", reason, detail });
  throw new GuardTrip(reason, detail);
}

/**
 * One dungeon run, start to finish. Returns when the run ends (win, death, or
 * flee) or a guard trips. In `--dry-run`, never calls `postDungeonAction` —
 * it polls state and logs every decision it WOULD have sent.
 */
export async function runOnce(deps: LiveRunDeps, opts: { stage2Only?: boolean } = {}): Promise<void> {
  const { client, config, guards, model, strategyConfig, fixtures, log, dryRun } = deps;

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
        chosen = pickSafeTier(options);
      } catch (e) {
        if (e instanceof UnsafeTierError) {
          log.write({ event: "unsafe_tier_halt", error: e.message, options });
          console.log(`  ✗ ${e.message}`);
        }
        throw e;
      }
      console.log(`  ▸ enemy path: choosing Safe tier, index ${chosen.index}`);
      log.write({ event: "tier_choice", chosen, options });

      if (dryRun) {
        console.log(`  [dry-run] would POST ${selectByIndex(chosen.index)} (index ${chosen.index})`);
        return;
      }
      const body = buildEnvelope(selectByIndex(chosen.index), config.dungeonId, client.getActionToken(), chosen.index);
      log.write({ event: "post", body });
      let resp;
      try {
        resp = await client.postDungeonAction(body);
      } catch (e) {
        if (e instanceof TokenExpiredError) throw e;
        fail(guards, log, "enemy path selection rejected", { chosen, error: (e as Error).message });
      }
      guards.recordActionResult(true);
      log.write({ event: "post_response", resp });
      fixtures.write(resp);
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
        console.log(`  [dry-run] would POST ${selectByIndex(chosenIndex)} (index ${chosenIndex})`);
        return;
      }
      const body = buildEnvelope(selectByIndex(chosenIndex), config.dungeonId, client.getActionToken(), chosenIndex);
      log.write({ event: "post", body });
      let resp;
      try {
        resp = await client.postDungeonAction(body);
      } catch (e) {
        if (e instanceof TokenExpiredError) throw e;
        fail(guards, log, "reward selection rejected", { chosenIndex, error: (e as Error).message });
      }
      guards.recordActionResult(true);
      log.write({ event: "post_response", resp });
      fixtures.write(resp);
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
  const guards = new GuardState({
    dailyEnergyBudget: config.dailyEnergyBudget,
    maxRunsPerSession: config.maxRunsPerSession,
    maxConsecutiveActionFailures: config.maxConsecutiveActionFailures,
  });
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
    await runOnce(
      { client, config, guards, model, strategyConfig: LIVE_CONFIG, fixtures, log, dryRun: args.dryRun },
      { stage2Only: args.stage2 },
    );
    if (before !== null) {
      // Regen runs concurrently (SPEC: ~18/hr, more if juiced), so a real
      // spend can be masked by a few seconds of regen on a short action —
      // clamp at 0 rather than ever recording a negative spend.
      const after = await currentEnergy(client, me.address);
      const delta = Math.max(0, before - after);
      guards.recordEnergySpent(delta);
      log.write({ event: "energy_accounting", before, after, delta });
      console.log(`  ▸ energy: ${before} -> ${after}  (spent ${delta})`);
    }
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
