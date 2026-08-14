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
import { MOVES, type Combatant, type MoveKey } from "./types.js";

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
}

export interface WireRun {
  DUNGEON_ID_CID: number;
  players: WireSide[];
  activeEnemyBuff?: unknown;
  enemyStartingBuff?: unknown;
  perpetualBuffs?: unknown[];
  rewardPathPhase?: boolean;
  enemyPathPhase?: boolean;
  lootPhase?: boolean;
}

export interface CorpusState {
  /** e.g. `run-2026-08-14-01-00-08/state-023.json` */
  label: string;
  run: WireRun;
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
    data?: { run?: WireRun | null } | null;
  };
  const run = parsed.data?.run;
  // `/game/dungeon/state` returns a body with no `run` once a run has ended.
  if (!run?.players || run.players.length < 2) return null;
  return { label: `${name}/${file}`, run };
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
        label: `${before.label.split("/").pop()}→${after.label.split("/").pop()}`,
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
  };
}
