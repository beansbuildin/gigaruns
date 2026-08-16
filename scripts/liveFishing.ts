/**
 * scripts/liveFishing.ts — Task 9, staged like scripts/liveRun.ts:
 *
 *   npx tsx scripts/liveFishing.ts --dry-run     # one decision, log it, POST nothing
 *   npx tsx scripts/liveFishing.ts --casts=1     # one full cast
 *   npx tsx scripts/liveFishing.ts --casts=5     # five casts
 *
 * **What's CONFIRMED vs INFERRED**, CLAUDE.md §2 ("never invent an
 * endpoint"):
 *  - `start_run`/`play_cards` on `POST /api/fishing/action` — CONFIRMED,
 *    SPEC-fishing.md §2.
 *  - `data.hand` holds card **ids**, and the request's `data.cards: [i]` is
 *    the hand-relative **index** played, not an id — CONFIRMED, re-derived
 *    directly against `fixtures/fishing-casts/cast.json` (`hand[i]` equals
 *    the id that lands in `discard[]` that same turn, all 5 real plays).
 *  - **Redraw is UNCONFIRMED** (SPEC-fishing.md §7: "genuinely uncaptured,
 *    wire shape stays [VERIFY] until a live cast produces one"). This loop
 *    never sends one. `shouldRedraw` firing is logged, not acted on — the
 *    loop always plays the best affordable card instead of guessing at an
 *    action name.
 *  - **A catch's terminal shape is UNCONFIRMED** — never observed in the
 *    one real capture (SPEC-fishing.md §0). The full raw response is always
 *    fixture-written, so the first real live catch settles what "logged
 *    with rarity" (TASKS.md Task 9's gate) actually looks like on the wire.
 *
 * **`focusMeter` genuinely constrains focus movement — [CONFIRMED live,
 * session 13].** The one prior capture (`fixtures/fishing-casts/cast.json`)
 * never moved the meter off 3/3, leaving the spend rule `[VERIFY]`
 * (SPEC-fishing.md §4). This project's first-ever live cast moved it 3/3 →
 * 3/3 → 2/3 → 1/3 across three focus moves of Manhattan distance 0/1/1, then
 * a 4th move of distance 2 was REJECTED (HTTP 400) with only 1 meter left —
 * four clean data points, the cost is Manhattan distance, and it does not
 * regenerate within a cast. `cardChoice.ts`'s `chooseCard`/`bestFocusForCard`
 * take an optional `FocusBudget` to respect this; this script always passes
 * one, built from `doc.data.focusPoint`/`focusMeter`. The sim
 * (`src/sim/fishing/castSim.ts`) does **not** model this yet — its 92.4%
 * catch-rate figure assumes unconstrained focus movement every turn, so it's
 * an optimistic ceiling relative to what real Dendren actually allows.
 *
 * The matcher's candidate pool starts **EMPTY every cast**, deliberately —
 * `src/sim/fishing/patterns.ts`'s library is a synthetic stand-in built for
 * Task 8's gate, explicitly NOT a claim about real Dendren (SPEC.md §5).
 * Every turn therefore runs through `emptyFallback`, seeded from whatever
 * `data/fish-patterns.jsonl` has accumulated so far (empty on this
 * project's first-ever live cast) — SPEC.md §5's "the bot gets sharper the
 * longer it runs" starts genuinely from zero here, not from borrowed
 * synthetic structure. Task 11's `mineFishPatterns.ts` is what eventually
 * promotes real recurring cycles out of this log into named candidates.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { GigaverseClient } from "../src/api/client.js";
import { TokenExpiredError, UnexpectedResponseError } from "../src/api/errors.js";
import type { FishingActionRequest, FishingActionResponse, FishingGameDoc } from "../src/api/fishing.js";
import { loadBotConfig, type BotConfig } from "../src/orchestrator/config.js";
import { GuardState, GuardTrip } from "../src/orchestrator/guards.js";
import { loadGuardBudget, saveGuardBudget, todayKey } from "../src/orchestrator/guardPersistence.js";
import { chooseCard, shouldRedraw, type FishingCardLike, type FocusBudget } from "../src/strategy/fishing/cardChoice.js";
import {
  emptyFallback,
  initMatcher,
  observe,
  predictDistribution,
  type MatcherState,
} from "../src/strategy/fishing/matcher.js";
import { cellKey, type Cell } from "../src/sim/fishing/geometry.js";
import { REDRAW_THRESHOLD } from "../src/sim/fishing/castSim.js";

// ---------------------------------------------------------------------------
// Pure(ish) helpers — no network, unit-testable directly.
// ---------------------------------------------------------------------------

/** `deckCardData` entries carry everything `FishingCardLike` needs, keyed by id. */
export function cardsById(deckCardData: FishingGameDoc["data"]["deckCardData"]): Map<number, FishingCardLike> {
  const m = new Map<number, FishingCardLike>();
  for (const c of deckCardData) {
    m.set(c.id, {
      id: c.id,
      manaCost: c.manaCost,
      hitZones: c.hitZones,
      critZones: c.critZones,
      hitEffects: c.hitEffects,
      missEffects: c.missEffects,
      critEffects: c.critEffects,
    });
  }
  return m;
}

/** `doc.data.hand` holds card ids (confirmed — see this file's header); resolve each against `deckCardData`. */
export function buildHand(doc: FishingGameDoc): FishingCardLike[] {
  const byId = cardsById(doc.data.deckCardData);
  return doc.data.hand.map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`hand card id ${id} not found in deckCardData — a wire assumption just broke`);
    return c;
  });
}

export function fishCell(doc: FishingGameDoc): Cell {
  const [x, y] = doc.data.fishPosition;
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error(`doc.data.fishPosition malformed: ${JSON.stringify(doc.data.fishPosition)}`);
  }
  return { x, y };
}

/**
 * **[CONFIRMED session 13, live]** `focusPoint`/`focusMeter` off the doc,
 * as a `FocusBudget` for `chooseCard` — see `cardChoice.ts`'s `FocusBudget`
 * doc comment for the discovery (Manhattan-distance cost, no regen observed
 * within a cast). Without this, `chooseCard` searches the WHOLE grid every
 * turn and the live server rejects a move it can't afford (HTTP 400) —
 * confirmed the hard way, turn 4 of this project's first-ever live cast.
 */
export function focusBudget(doc: FishingGameDoc): FocusBudget {
  const [x, y] = doc.data.focusPoint;
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error(`doc.data.focusPoint malformed: ${JSON.stringify(doc.data.focusPoint)}`);
  }
  return { current: { x, y }, remaining: doc.data.focusMeter };
}

export function buildFishingEnvelope(
  action: "start_run" | "play_cards",
  actionToken: string,
  data: Partial<FishingActionRequest["data"]>,
): FishingActionRequest {
  return {
    action,
    actionToken,
    data: {
      cards: data.cards ?? [],
      nodeId: data.nodeId ?? "",
      focusPoint: data.focusPoint ?? [],
      itemId: data.itemId ?? 0,
      slotIndex: data.slotIndex ?? 0,
      tierId: data.tierId ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// data/fish-patterns.jsonl — the transition log SPEC.md §5 asks for "from
// the very first cast", read back in as `emptyFallback`'s empirical source.
// ---------------------------------------------------------------------------

export const DEFAULT_TRANSITIONS_PATH = join("data", "fish-patterns.jsonl");

export interface TransitionRecord {
  ts: string;
  castId: string;
  turn: number;
  from: [number, number];
  to: [number, number];
  gridSize: number;
}

/** Builds the `emptyFallback` empirical map from every transition ever logged, across all casts — malformed lines are skipped, never fatal. */
export function loadTransitionLog(path: string = DEFAULT_TRANSITIONS_PATH): Map<string, Cell[]> {
  const map = new Map<string, Cell[]>();
  if (!existsSync(path)) return map;
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as TransitionRecord;
      const from: Cell = { x: rec.from[0], y: rec.from[1] };
      const to: Cell = { x: rec.to[0], y: rec.to[1] };
      const key = cellKey(from);
      const arr = map.get(key) ?? [];
      arr.push(to);
      map.set(key, arr);
    } catch {
      // one bad line shouldn't lose the whole log
    }
  }
  return map;
}

export function appendTransition(rec: TransitionRecord, path: string = DEFAULT_TRANSITIONS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rec) + "\n", { flag: "a" });
}

// ---------------------------------------------------------------------------
// Fixture writing — same shape as scripts/liveRun.ts's FixtureWriter.
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
    this.out = join("fixtures", "fishing-casts", "live", `cast-${stamp()}`);
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

class RunLog {
  private readonly path: string;
  constructor() {
    mkdirSync("logs", { recursive: true });
    this.path = join("logs", `fishing-${stamp()}.jsonl`);
  }
  write(entry: Record<string, unknown>): void {
    writeFileSync(this.path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n", { flag: "a" });
  }
  get filePath(): string {
    return this.path;
  }
}

// ---------------------------------------------------------------------------
// The live cast loop.
// ---------------------------------------------------------------------------

export interface LiveFishingDeps {
  client: GigaverseClient;
  config: BotConfig;
  guards: GuardState;
  fixtures: FixtureWriter;
  log: RunLog;
  address: string;
  dryRun: boolean;
  transitionsPath?: string;
  guardStatePath?: string;
}

export type CastOutcome = "dry_run" | "caught" | "escaped" | "turn_cap";

export interface CastRunResult {
  outcome: CastOutcome;
  turns: number;
}

/** Safety cap only — SPEC.md §5 names no real max-turns figure; this exists solely to guard against an infinite-loop bug, not to model the game. */
const MAX_TURNS = 60;

export async function runOneCast(deps: LiveFishingDeps): Promise<CastRunResult> {
  const { client, config, guards, fixtures, log, address, dryRun } = deps;
  const transitionsPath = deps.transitionsPath ?? DEFAULT_TRANSITIONS_PATH;

  if (!config.dendren) {
    throw new Error(
      "config/bot.json and config/discovered.json need a `dendren` block before fishing can run — Task 7's discovery.",
    );
  }
  const dendren = config.dendren;

  const existing = await client.getFishingState(address);
  let doc: FishingGameDoc;

  if (existing.gameState && !existing.gameState.COMPLETE_CID) {
    console.log(`  · active cast already in progress — resuming rather than starting a new one`);
    log.write({ event: "resuming_existing_cast", docId: existing.gameState.docId });
    doc = existing.gameState;
  } else if (dryRun) {
    guards.assertCanStartRun(dendren.energyCostPerCast);
    log.write({ event: "dry_run_start_run_intended", nodeId: dendren.nodeId, tierId: dendren.tierId });
    console.log(`  [dry-run] would POST start_run (nodeId ${dendren.nodeId}, tierId ${dendren.tierId})`);
    console.log(`  · no active cast — nothing further to decide against, stopping.`);
    return { outcome: "dry_run", turns: 0 };
  } else {
    guards.assertCanStartRun(dendren.energyCostPerCast);
    const body = buildFishingEnvelope("start_run", client.getFishingActionToken(), {
      nodeId: dendren.nodeId,
      tierId: dendren.tierId,
    });
    log.write({ event: "post", body });
    let resp: FishingActionResponse;
    try {
      resp = await client.postFishingAction(body);
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      guards.recordActionResult(false);
      log.write({ event: "action_failed", reason: "start_run rejected", error: (e as Error).message });
      throw new GuardTrip("fishing start_run rejected", { error: (e as Error).message });
    }
    guards.recordActionResult(true);
    guards.recordRunStarted();
    saveGuardBudget(guards.spentEnergy, guards.runCount, deps.guardStatePath);
    log.write({ event: "post_response", resp });
    fixtures.write(resp);
    doc = resp.data.doc;
    console.log(`  ✓ start_run sent — fishing actionToken now ${client.getFishingActionToken()}`);
  }

  const castId = doc.docId;
  const gridSize = doc.data.gridSize;
  let matcher: MatcherState = initMatcher([], fishCell(doc));
  const transitionLog = loadTransitionLog(transitionsPath);

  let turn = 0;
  while (turn < MAX_TURNS) {
    if (doc.COMPLETE_CID) break;

    const hand = buildHand(doc);
    const mana = doc.data.playerHp;
    const fishHp = doc.data.fishHp;
    const dist =
      matcher.candidates.length > 0
        ? predictDistribution(matcher)
        : emptyFallback(matcher.history[matcher.history.length - 1]!, transitionLog, gridSize);

    const best = chooseCard(hand, mana, dist, gridSize, 1, fishHp, focusBudget(doc));
    if (best && shouldRedraw(best, hand.length, mana, REDRAW_THRESHOLD)) {
      log.write({ event: "redraw_indicated_not_sent", turn, reason: "redraw action unconfirmed, SPEC-fishing.md §7" });
    }
    if (!best) {
      log.write({ event: "no_affordable_card", turn, hand, mana });
      console.log(`  ✗ no affordable card in hand (mana ${mana}) — halting per CLAUDE.md §5.`);
      throw new GuardTrip("fishing: no affordable card in hand", { hand, mana });
    }

    console.log(
      `  ▸ turn ${turn}: card ${best.card.id} @ focus [${best.focus.x},${best.focus.y}]` +
        ` (P_hit ${(best.pHit + best.pCrit).toFixed(2)}, ev ${best.ev.toFixed(1)}${best.lethal ? ", LETHAL" : ""})`,
    );
    log.write({
      event: "decision",
      turn,
      cardId: best.card.id,
      handIndex: best.handIndex,
      focus: best.focus,
      pHit: best.pHit,
      pCrit: best.pCrit,
      ev: best.ev,
      lethal: best.lethal,
    });

    if (dryRun) {
      console.log(`  [dry-run] would POST play_cards`);
      return { outcome: "dry_run", turns: turn };
    }

    const body = buildFishingEnvelope("play_cards", client.getFishingActionToken(), {
      cards: [best.handIndex],
      focusPoint: [best.focus.x, best.focus.y],
    });
    log.write({ event: "post", body });
    let resp: FishingActionResponse;
    try {
      resp = await client.postFishingAction(body);
    } catch (e) {
      if (e instanceof TokenExpiredError) throw e;
      guards.recordActionResult(false);
      log.write({ event: "action_failed", reason: "play_cards rejected", error: (e as Error).message });
      throw new GuardTrip("fishing play_cards rejected", { error: (e as Error).message });
    }
    guards.recordActionResult(true);
    log.write({ event: "post_response", resp });
    fixtures.write(resp);

    const newDoc = resp.data.doc;
    const fromCell = matcher.history[matcher.history.length - 1]!;
    const toCell = fishCell(newDoc);

    const transitionRec: TransitionRecord = {
      ts: new Date().toISOString(),
      castId,
      turn,
      from: [fromCell.x, fromCell.y],
      to: [toCell.x, toCell.y],
      gridSize,
    };
    appendTransition(transitionRec, transitionsPath);
    const arr = transitionLog.get(cellKey(fromCell)) ?? [];
    arr.push(toCell);
    transitionLog.set(cellKey(fromCell), arr); // later turns in THIS cast benefit too, not just future casts

    matcher = observe(matcher, toCell);
    doc = newDoc;
    turn++;

    const stateKey = JSON.stringify({ turn, fishHp: doc.data.fishHp, mana: doc.data.playerHp, hand: doc.data.hand });
    guards.checkStateProgress(stateKey);
  }

  const outcome: CastOutcome = !doc.COMPLETE_CID ? "turn_cap" : doc.SUCCESS_CID ? "caught" : "escaped";
  log.write({ event: "cast_over", outcome, turns: turn, success: doc.SUCCESS_CID ?? null, complete: doc.COMPLETE_CID });
  console.log(`  ▸ cast over: ${outcome} after ${turn} turns${doc.SUCCESS_CID ? " — CAUGHT!" : ""}`);
  if (doc.SUCCESS_CID) {
    console.log(`  ★ first-ever live catch this session — full response fixture-written (rarity/reward shape was [VERIFY], SPEC-fishing.md §0/§7).`);
  }
  return { outcome, turns: turn };
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const status = argv.includes("--status");
  const castsArg = argv.find((a) => a.startsWith("--casts="));
  const casts = castsArg ? Number(castsArg.split("=")[1]) : 1;
  return { dryRun, status, casts };
}

/**
 * [session 15, brief §5] Mirrors scripts/liveRun.ts's `--status` — local
 * state only (`config/bot.json`/`config/discovered.json` +
 * `data/guard-budget-fishing.json`), no network call.
 */
function printStatus(config: BotConfig): void {
  console.log(`\n▸ liveFishing.ts --status (${todayKey()})\n`);
  if (!config.dendren) {
    console.log(`  fishing: no dendren block in config — Task 7 not configured\n`);
    return;
  }
  const seed = loadGuardBudget(FISHING_GUARD_STATE_PATH);
  const castsRemaining = Math.max(0, config.dendren.maxCastsPerSession - seed.runsStarted);
  const energyRemaining = Math.max(0, config.dendren.dailyEnergyBudget - seed.energySpent);
  console.log(`  fishing casts:   ${seed.runsStarted}/${config.dendren.maxCastsPerSession} used  ->  ${castsRemaining} remaining`);
  console.log(`  fishing energy:  ${seed.energySpent}/${config.dendren.dailyEnergyBudget} used  ->  ${energyRemaining} remaining\n`);
}

async function currentEnergy(client: GigaverseClient, address: string): Promise<number> {
  const energy = await client.getEnergy(address);
  const value = energy.entities[0]?.parsedData?.energyValue;
  if (typeof value !== "number") {
    throw new Error("GET /offchain/player/energy — entities[0].parsedData.energyValue missing or not a number");
  }
  return value;
}

const FISHING_GUARD_STATE_PATH = join("data", "guard-budget-fishing.json");

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.status) {
    printStatus(loadBotConfig());
    return;
  }

  console.log(`\n▸ liveFishing.ts — ${args.dryRun ? "dry-run" : `${args.casts} cast(s)`}\n`);

  const config = loadBotConfig();
  if (!config.dendren) {
    console.error(`✗ config/bot.json or config/discovered.json has no dendren block — run Task 7's discovery first.`);
    process.exit(1);
  }
  const client = new GigaverseClient();

  const seed = loadGuardBudget(FISHING_GUARD_STATE_PATH);
  if (seed.energySpent > 0 || seed.runsStarted > 0) {
    console.log(`  · resuming today's fishing budget: ${seed.energySpent} energy / ${seed.runsStarted} casts already spent`);
  }
  const guards = new GuardState(
    {
      dailyEnergyBudget: config.dendren.dailyEnergyBudget,
      maxRunsPerSession: config.dendren.maxCastsPerSession,
      maxConsecutiveActionFailures: config.maxConsecutiveActionFailures,
    },
    seed,
  );
  const log = new RunLog();

  const me = await client.getMe();
  const fixtures = new FixtureWriter(me.address, client.maskedJwt().split("...")[0]!);
  console.log(`  account <USER>`);

  const targetCasts = args.dryRun ? 1 : args.casts;
  for (let i = 0; i < targetCasts; i++) {
    console.log(`\n▸ cast ${i + 1}/${targetCasts}`);
    const before = args.dryRun ? null : await currentEnergy(client, me.address);
    let castError: unknown = null;
    let result: CastRunResult | null = null;
    try {
      result = await runOneCast({
        client,
        config,
        guards,
        fixtures,
        log,
        address: me.address,
        dryRun: args.dryRun,
        guardStatePath: FISHING_GUARD_STATE_PATH,
      });
    } catch (e) {
      castError = e;
    }
    if (before !== null) {
      const after = await currentEnergy(client, me.address);
      const delta = Math.max(0, before - after);
      try {
        guards.recordEnergySpent(delta);
      } finally {
        saveGuardBudget(guards.spentEnergy, guards.runCount, FISHING_GUARD_STATE_PATH);
      }
      log.write({ event: "energy_accounting", before, after, delta });
      console.log(`  ▸ energy: ${before} -> ${after}  (spent ${delta})`);
    }
    if (castError) throw castError;
    if (result?.outcome === "dry_run") break;
  }

  console.log(`\n▸ done. energy spent (guard-tracked) ${guards.spentEnergy}, casts ${guards.runCount}`);
  console.log(`▸ log: ${log.filePath}`);
  console.log(`▸ fixtures: ${fixtures.dir}`);
  console.log(`▸ transitions: ${DEFAULT_TRANSITIONS_PATH}\n`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("liveFishing.ts");
if (isMain) {
  main().catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    if (e instanceof GuardTrip) console.error(`  detail: ${JSON.stringify(e.detail)}`);
    if (e instanceof UnexpectedResponseError) console.error(`  status ${e.status}  path ${e.path}\n  body: ${e.body}`);
    process.exit(1);
  });
}
