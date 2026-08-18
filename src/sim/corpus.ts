/**
 * src/sim/corpus.ts — read recorded `/game/dungeon/state` responses off disk
 * and adapt them into the sim's types.
 *
 * The ONLY place that knows the wire shape. Read-only, no network. Every
 * analysis script and replay test goes through this so the pair-walking rules
 * below are stated once instead of re-derived (and re-broken) per script.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { probeCombatant, probeRun, type CoverageProbe, type Reason } from "./coverage.js";
import { MOVES, ROLLED, type Combatant, type MoveKey } from "./types.js";

export const CORPUS_DIR = "fixtures/dungeon-runs";

interface WireMove {
  startingATK: number;
  startingDEF: number;
  currentATK: number;
  currentDEF: number;
  currentCharges: number;
  maxCharges: number;
}

interface WirePool {
  current: number;
  starting: number;
  currentMax: number;
  startingMax: number;
}

export interface WireSide extends CoverageProbe {
  id: string;
  rock: WireMove;
  paper: WireMove;
  scissor: WireMove;
  health: WirePool;
  shield: WirePool;
  lastMove: string;
  thisPlayerWin: boolean;
  otherPlayerWin: boolean;
  pickedBoons?: WireBoon[];
}

/** One entry of `rewardPathOptions[]`. Only the fields the sim reads. */
export interface WireBoon {
  boonTypeString: string;
  /** The APPLIED value, already multiplied by `basicBoonMultiplier`. */
  selectedVal1: number;
  selectedVal2: number;
  val1Min?: number;
  val1Max?: number;
}

export interface WireRewardOption {
  index: number;
  boon: WireBoon;
}

export interface WireRun {
  DUNGEON_ID_CID: number;
  players: WireSide[];
  activeEnemyBuff?: unknown;
  enemyStartingBuff?: unknown;
  perpetualBuffs?: unknown[];
  rewardPathPhase?: boolean;
  rewardPathOptions?: WireRewardOption[];
  enemyPathPhase?: boolean;
  lootPhase?: boolean;
}

/**
 * The `data.entity` object present on dungeon POST responses — separate from
 * `data.run` (combat state). [session 30] Sourced fields for run-visibility
 * reporting: `IS_JUICED_CID` (per-run juiced flag), `ROOM_NUM_CID` (current
 * room), `COMPLETE_CID` (whether the CURRENT room's fight is complete — not
 * observed to mean "whole dungeon cleared" since a floor-4-room-4 clear has
 * never happened live; see `dungeonReport.ts` for how this is used).
 */
export interface WireEntity {
  /**
   * [session 30] NOT the per-run "Juiced mode" flag — checked against the
   * full corpus and found `true` on all 47 attempts, including pre-session-
   * 08 captures that predate the Juiced RUN MODE's very existence. This is
   * the ACCOUNT-level purchased buff (DECISIONS 2026-08-17, session 23:
   * `isPlayerJuiced`, "more energy, more ROM output, 4x Hard Cores... nothing
   * to do with a specific run"), just mirrored onto the entity object. Kept
   * here, typed but unused by the report, so a future reader doesn't
   * rediscover the same trap. Use `WANTS_JUICED_MODE_CID` for the per-run flag.
   */
  IS_JUICED_CID?: boolean;
  /** [session 30] The per-run "Juiced mode" selection (3x energy/reward) — confirmed stable within an attempt (all 47 corpus attempts, no mixed values) and varying across attempts (45 false / 2 true), unlike `IS_JUICED_CID`. */
  WANTS_JUICED_MODE_CID?: boolean;
  ROOM_NUM_CID?: number;
  COMPLETE_CID?: boolean;
}

/**
 * One `{id, amount}` entry from a response's top-level `gameItemBalanceChanges`
 * — sibling to `data`, not inside it. [session 30] Confirmed live sources:
 * item 845 ("Hard Core") credited on `message: "Reward chosen"`; item 846
 * ("Dendren Remnant" — the wire NAME_CID; the user calls this "Dendren Root"
 * in conversation, a naming mismatch worth carrying forward, not resolving by
 * guessing) credited on a `"Move Used"` response that lands a kill. See
 * `fixtures/dungeon-runs/run-2026-08-15-15-38-09/state-{054,079,110}.json`.
 */
export interface WireItemBalanceChange {
  id: number;
  amount: number;
}

export interface CorpusState {
  /** e.g. `run-2026-08-14-01-00-08/state-023.json` */
  label: string;
  run: WireRun;
  /** [session 30] `null` when this response carried no `data.entity` (e.g. a plain `/game/dungeon/state` GET). */
  entity: WireEntity | null;
  /** [session 30] `[]` when this response carried no top-level `gameItemBalanceChanges`. */
  gameItemBalanceChanges: WireItemBalanceChange[];
}

export interface CorpusRun {
  name: string;
  states: CorpusState[];
}

function stateFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^state-\d+\.json$/.test(f))
    .sort();
}

function readState(dir: string, file: string, name: string): CorpusState | null {
  const parsed = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
    data?: { run?: WireRun | null; entity?: WireEntity | null } | null;
    gameItemBalanceChanges?: WireItemBalanceChange[] | null;
  };
  const run = parsed.data?.run;
  // `/game/dungeon/state` returns a body with no `run` once a run has ended.
  if (!run?.players || run.players.length < 2) return null;
  return {
    label: `${name}/${file}`,
    run,
    entity: parsed.data?.entity ?? null,
    gameItemBalanceChanges: parsed.gameItemBalanceChanges ?? [],
  };
}

/**
 * Every capture directory, each a self-contained sequence of states.
 *
 * `fixtures/dungeon-runs/state-NNN.json`            -> the flat session-02 run
 * `fixtures/dungeon-runs/run-<stamp>/state-NNN.json` -> one watcher session each
 *
 * A watcher *session* can still span several dungeon attempts; `pairs()` splits
 * those on DUNGEON_ID_CID.
 */
export function loadCorpus(root: string = CORPUS_DIR): CorpusRun[] {
  const runs: CorpusRun[] = [];
  if (!existsSync(root)) return runs;

  const flat = stateFiles(root);
  if (flat.length) {
    const states = flat
      .map((f) => readState(root, f, "session-02"))
      .filter((s): s is CorpusState => s !== null);
    if (states.length) runs.push({ name: "session-02", states });
  }

  for (const entry of readdirSync(root).sort()) {
    const dir = join(root, entry);
    // `raw/` holds unredacted dumps and is gitignored; never read it here.
    if (!statSync(dir).isDirectory() || entry === "raw") continue;
    const states = stateFiles(dir)
      .map((f) => readState(dir, f, entry))
      .filter((s): s is CorpusState => s !== null);
    if (states.length) runs.push({ name: entry, states });
  }
  return runs;
}

export interface Exchange {
  run: string;
  label: string;
  before: CorpusState;
  after: CorpusState;
  myMove: MoveKey;
  foeMove: MoveKey;
  /** Unmodelled mechanics present on either side, before or after. */
  reasons: Reason[];
}

/**
 * `${beforeFile}→${afterFile}` — the label half of an exchange's identity
 * (file names carry their `.json` suffix, matching `CorpusState.label`'s
 * tail after the run-directory prefix is stripped).
 */
export function exchangeLabel(beforeFile: string, afterFile: string): string {
  return `${beforeFile}→${afterFile}`;
}

/**
 * `${run}::${label}` — the full per-exchange identity, qualified by run
 * (DECISIONS 2026-08-15: a label alone is not unique across runs). Shared by
 * corpus bootstrap (`opponentModelPersistence.ts`) and live observation
 * (`scripts/liveRun.ts`) so the two can never drift into computing this
 * differently — [session 36] the gap that caused CODEXAUDIT #1's live-observe
 * double-count: the live side never marked this same identity into the
 * persisted ledger before restart re-imported it from its own fixture.
 */
export function exchangeIdentity(run: string, label: string): string {
  return `${run}::${label}`;
}

const isMoveKey = (s: string): s is MoveKey => (MOVES as readonly string[]).includes(s);

/**
 * Consecutive state pairs that represent an actual combat exchange.
 *
 * Three filters, each earned by a bug that predated it:
 *
 *  1. DUNGEON_ID_CID must match. One watcher session can span several dungeon
 *     attempts, and the boundary between two attempts is not an exchange.
 *  2. Both sides' `lastMove` must name a move. `lastMove` persists through the
 *     reward/enemy path phases that follow a kill, so a naive pair-walk replays
 *     the killing blow once per phase state and predicts a corpse taking damage.
 *     A room transition also swaps in a fresh enemy whose `lastMove` is "".
 *  3. Both sides must be ALIVE in the `before` state, and no reward/enemy path
 *     phase may be active on it. [session 04] Without this, the boon pickup
 *     that follows a kill is admitted as an exchange: `lastMove` still names
 *     the killing blow on both sides, the enemy id has not changed yet, and a
 *     Heal boon moves the player's HP, so the "something moved" test passes.
 *     `scripts/chargeTable.ts` had this bug and it is the sole source of its
 *     two `2 -> 2 (delta 0)` played moves — which is why its claim that all 16
 *     odd deltas were plays from exactly 1 charge does not hold.
 *  4. Something must have actually moved (HP, armor, or a charge), or the pair
 *     is two polls of an idle state.
 */
export function exchanges(runs: CorpusRun[]): Exchange[] {
  const out: Exchange[] = [];

  for (const { name, states } of runs) {
    for (let i = 1; i < states.length; i++) {
      const before = states[i - 1]!;
      const after = states[i]!;
      if (before.run.DUNGEON_ID_CID !== after.run.DUNGEON_ID_CID) continue;

      const [bMe, bFoe] = before.run.players as [WireSide, WireSide];
      const [aMe, aFoe] = after.run.players as [WireSide, WireSide];
      if (bFoe.id !== aFoe.id) continue; // room transition, not an exchange

      // Nothing after a kill is an exchange. Read the phase flags directly
      // rather than inferring the state machine (SPEC §3d).
      if (bMe.health.current <= 0 || bFoe.health.current <= 0) continue;
      if (before.run.rewardPathPhase === true || before.run.enemyPathPhase === true) continue;

      const myMove = aMe.lastMove;
      const foeMove = aFoe.lastMove;
      if (!isMoveKey(myMove) || !isMoveKey(foeMove)) continue;

      const moved =
        bMe.health.current !== aMe.health.current ||
        bMe.shield.current !== aMe.shield.current ||
        bFoe.health.current !== aFoe.health.current ||
        bFoe.shield.current !== aFoe.shield.current ||
        MOVES.some(
          (m) =>
            bMe[m].currentCharges !== aMe[m].currentCharges ||
            bFoe[m].currentCharges !== aFoe[m].currentCharges,
        );
      if (!moved) continue;

      const reasons = new Set<Reason>([
        ...probeRun(before.run),
        ...probeRun(after.run),
        ...probeCombatant(bMe),
        ...probeCombatant(bFoe),
        ...probeCombatant(aMe),
        ...probeCombatant(aFoe),
      ]);

      out.push({
        run: name,
        label: exchangeLabel(before.label.split("/").pop()!, after.label.split("/").pop()!),
        before,
        after,
        myMove,
        foeMove,
        reasons: [...reasons],
      });
    }
  }
  return out;
}

export interface BoonPickup {
  run: string;
  label: string;
  before: CorpusState;
  after: CorpusState;
  /** The options that were on the table, from `before`. */
  offered: WireBoon[];
  /** The one that got added to `pickedBoons` — the last entry in `after`. */
  picked: WireBoon;
  /** 1-based room the offer was made in, i.e. the room just cleared. */
  room: number;
}

/**
 * Consecutive state pairs that bracket a boon pickup: a `rewardPathPhase` state
 * followed by one where `pickedBoons` has grown by exactly one.
 *
 * The same DUNGEON_ID_CID split as `exchanges()` applies. The "grown by exactly
 * one" condition is what makes each pair attributable — if a pair ever adds two
 * boons at once, the delta cannot be assigned and this refuses to return it
 * rather than splitting the difference.
 *
 * `room` is derived from the enemy present in `before`, via its position in
 * ROOM_ENEMIES — the enemy has not been swapped out yet during the reward
 * phase, so the offer belongs to the room just cleared.
 */
export function boonPickups(runs: CorpusRun[], roomOf: (enemyId: string) => number): BoonPickup[] {
  const out: BoonPickup[] = [];

  for (const { name, states } of runs) {
    for (let i = 1; i < states.length; i++) {
      const before = states[i - 1]!;
      const after = states[i]!;
      if (before.run.DUNGEON_ID_CID !== after.run.DUNGEON_ID_CID) continue;
      if (before.run.rewardPathPhase !== true) continue;

      const bBoons = before.run.players[0]?.pickedBoons ?? [];
      const aBoons = after.run.players[0]?.pickedBoons ?? [];
      if (aBoons.length !== bBoons.length + 1) continue;

      const picked = aBoons[aBoons.length - 1]!;
      const room = roomOf(before.run.players[1]!.id);
      if (room <= 0) continue;

      out.push({
        run: name,
        label: `${before.label.split("/").pop()}→${after.label.split("/").pop()}`,
        before,
        after,
        offered: (before.run.rewardPathOptions ?? []).map((o) => o.boon),
        picked,
        room,
      });
    }
  }
  return out;
}

function toMoves(s: WireSide): Combatant["moves"] {
  const one = (w: WireMove) => ({
    atk: w.currentATK,
    def: w.currentDEF,
    charges: w.currentCharges,
    maxCharges: w.maxCharges,
  });
  return { rock: one(s.rock), paper: one(s.paper), scissor: one(s.scissor) };
}

export function toCombatant(s: WireSide): Combatant {
  return {
    id: s.id,
    hp: s.health.current,
    hpMax: s.health.currentMax,
    armor: s.shield.current,
    armorMax: s.shield.currentMax,
    moves: toMoves(s),
    // Always `.current`. `.starting` is 0 even when `current` is 2 (enemy 65),
    // so a reader written against `starting` reports a clean corpus and is
    // wrong — the same trap `probeCombatant` documents.
    rolled: Object.fromEntries(
      ROLLED.map((k) => [k, (s as unknown as Record<string, { current?: number }>)[k]?.current ?? 0]),
    ) as Combatant["rolled"],
  };
}
