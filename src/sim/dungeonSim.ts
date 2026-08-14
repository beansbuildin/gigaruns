/**
 * src/sim/dungeonSim.ts — synthetic dungeon runs against a pluggable opponent.
 *
 * Pure apart from the seeded RNG. No network, no disk.
 *
 * The contract that makes this trustworthy (session-04 brief §4): the sim never
 * approximates a mechanic it does not understand and never hardcodes one to
 * zero. The moment a run touches something outside the clean exchange model it
 * is marked UNSCORABLE with a reason code and is excluded from the win rate.
 * Coverage is reported alongside every result, and any claim about win rate
 * must state the coverage next to it.
 */

import { legalMoves, resolveExchange, enterRoom } from "./combat.js";
import { CoverageReport, type Reason } from "./coverage.js";
import { MAX_OBSERVED_ROOM, PLAYER, ROOM_ENEMIES } from "./enemies.js";
import { makeRng, type Rng } from "./rng.js";
import { cloneCombatant, isDead, MOVES, type BattleState, type MoveKey } from "./types.js";

/** A move chooser. Strategy modules plug in here; none may touch the network. */
export interface Policy {
  name: string;
  pick(state: BattleState, legal: MoveKey[], rng: Rng): MoveKey;
}

export const randomPolicy: Policy = {
  name: "random",
  pick: (_s, legal, rng) => rng.pick(legal),
};

export const fixedPolicy = (move: MoveKey): Policy => ({
  name: `always-${move}`,
  // Falls back to any legal move when the fixed one is locked, so the baseline
  // is a real strategy rather than a run that stalls out on charges.
  pick: (_s, legal, _r) => (legal.includes(move) ? move : legal[0]!),
});

export interface SimOptions {
  /** Our move chooser. */
  policy: Policy;
  /** The opponent's. `randomPolicy` for the Task 4 gate. */
  opponent: Policy;
  seed: number;
  /** Rooms to attempt. Defaults to the deepest the corpus can vouch for. */
  maxRooms?: number;
  /**
   * Room to start at, for isolating a single matchup. Defaults to 1. Starting
   * deeper skips the rooms before it entirely — the player arrives at full
   * pools, which is NOT what a real run looks like, so results from a deep
   * start describe the matchup, not the run.
   */
  startRoom?: number;
  /** SPEC §4a / DECISIONS 2026-08-15. */
  chargesAreHardLimit: boolean;
  /**
   * Hard stop on exchanges per battle. A battle where neither side can break
   * the other's armor never terminates — that is the §1 threshold case, and it
   * is a real outcome, not a hang.
   */
  maxExchangesPerBattle?: number;
}

export type RunOutcome = "cleared" | "died" | "stalled" | "halted";

export interface BattleRecord {
  room: number;
  enemyId: string;
  exchanges: number;
  won: boolean;
  /** Empty means this battle is inside the clean model. */
  reasons: Reason[];
  hpAfter: number;
  armorAfter: number;
}

export interface RunResult {
  outcome: RunOutcome;
  roomsCleared: number;
  exchanges: number;
  hp: number;
  battles: BattleRecord[];
  /** Empty means the whole run is inside the clean model. */
  reasons: Reason[];
}

const DEFAULT_MAX_EXCHANGES = 60;

/**
 * One battle. Returns the terminal state and everything observed on the way.
 */
function fightBattle(
  start: BattleState,
  opts: SimOptions,
  rng: Rng,
  carried: Reason[],
): { state: BattleState; record: BattleRecord; stalled: boolean; halted: boolean } {
  const limit = opts.maxExchangesPerBattle ?? DEFAULT_MAX_EXCHANGES;
  const reasons = new Set<Reason>(carried);
  let state = start;
  let count = 0;
  let halted = false;

  while (!isDead(state.me) && !isDead(state.foe) && count < limit) {
    const mine = legalMoves(state.me, opts.chargesAreHardLimit);
    const theirs = legalMoves(state.foe, opts.chargesAreHardLimit);
    // Under a hard limit both sides can in principle lock every move at once.
    // Nothing in the corpus shows what the server does then, so stop rather
    // than invent a rule.
    if (mine.length === 0 || theirs.length === 0) {
      reasons.add("CHARGES_ALL_LOCKED");
      halted = true;
      break;
    }
    const myMove = opts.policy.pick(state, mine, rng);
    const foeMove = opts.opponent.pick({ me: state.foe, foe: state.me, room: state.room }, theirs, rng);
    state = resolveExchange(state, myMove, foeMove).state;
    count++;
  }

  return {
    state,
    halted,
    stalled: !halted && count >= limit && !isDead(state.me) && !isDead(state.foe),
    record: {
      room: state.room,
      enemyId: state.foe.id,
      exchanges: count,
      won: isDead(state.foe) && !isDead(state.me),
      reasons: [...reasons],
      hpAfter: state.me.hp,
      armorAfter: state.me.armor,
    },
  };
}

export function simulateRun(opts: SimOptions): RunResult {
  const rng = makeRng(opts.seed);
  const maxRooms = opts.maxRooms ?? MAX_OBSERVED_ROOM;
  const runReasons = new Set<Reason>();
  const battles: BattleRecord[] = [];

  let player = cloneCombatant(PLAYER);
  let roomsCleared = 0;
  let exchanges = 0;
  let outcome: RunOutcome = "cleared";

  for (let room = opts.startRoom ?? 1; room <= maxRooms; room++) {
    const profile = ROOM_ENEMIES[room - 1];
    if (!profile) {
      // Past room 4 we have no enemy to fight and no scaling rule worth
      // guessing at. The run stops here and says why.
      runReasons.add("DEPTH_BEYOND_CORPUS");
      outcome = "halted";
      break;
    }
    for (const r of profile.unmodelled) runReasons.add(r);

    // The player carries HP, armor and charges into the room UNCHANGED.
    // [CORRECTED session 04] Session 03's "armor refills at every room
    // transition" came from three boundaries where the player was already at
    // the armor cap; the one informative boundary crossed at 4/15 and stayed.
    const battle = fightBattle(
      enterRoom(player, profile.enemy, room),
      opts,
      rng,
      [...runReasons],
    );
    exchanges += battle.record.exchanges;
    battles.push(battle.record);
    player = battle.state.me;

    if (battle.halted) {
      runReasons.add("CHARGES_ALL_LOCKED");
      outcome = "halted";
      break;
    }
    if (battle.stalled) {
      // Neither side could finish the other. Not a hang — see §1's threshold
      // case, where a move's ATK sits under the opponent's armor restore rate
      // and deals zero net progress forever.
      outcome = "stalled";
      break;
    }
    if (!battle.record.won) {
      outcome = "died";
      break;
    }

    roomsCleared++;

    // A cleared room fires `rewardPathPhase` and the player takes a boon. Boon
    // effects on stats are not modelled, so everything from here on is outside
    // the clean model. This is the hard wall in the corpus: room 1 is clean in
    // every capture, and every contaminant enters at the first reward phase.
    if (room < maxRooms) runReasons.add("BOON_TAKEN");
  }

  return {
    outcome,
    roomsCleared,
    exchanges,
    hp: player.hp,
    battles,
    reasons: [...runReasons],
  };
}

export interface SimSummary {
  runs: number;
  /** Coverage over whole runs. A run is scored only if it touched nothing unmodelled. */
  runCoverage: CoverageReport;
  /** Coverage over individual battles — the finer-grained, more useful unit. */
  battleCoverage: CoverageReport;
  /** Wins among SCORED runs only. `null` when nothing was scorable. */
  scoredWinRate: number | null;
  /** Battle win rate among SCORED battles only. `null` when none were scorable. */
  scoredBattleWinRate: number | null;
  scoredBattlesWon: number;
  /** Deepest room any *scorable* battle reached — the number that should climb. */
  deepestScorableRoom: number;
  outcomes: Record<RunOutcome, number>;
  meanRoomsCleared: number;
}

export function simulate(runs: number, opts: Omit<SimOptions, "seed">, seed = 1): SimSummary {
  const runCoverage = new CoverageReport();
  const battleCoverage = new CoverageReport();
  const outcomes: Record<RunOutcome, number> = { cleared: 0, died: 0, stalled: 0, halted: 0 };

  let scoredWins = 0;
  let scoredBattlesWon = 0;
  let deepestScorableRoom = 0;
  let totalRooms = 0;

  for (let i = 0; i < runs; i++) {
    const r = simulateRun({ ...opts, seed: seed + i });
    outcomes[r.outcome]++;
    totalRooms += r.roomsCleared;

    runCoverage.record(r.reasons);
    if (r.reasons.length === 0 && r.outcome === "cleared") scoredWins++;

    for (const b of r.battles) {
      battleCoverage.record(b.reasons);
      if (b.reasons.length === 0) {
        if (b.won) scoredBattlesWon++;
        deepestScorableRoom = Math.max(deepestScorableRoom, b.room);
      }
    }
  }

  return {
    runs,
    runCoverage,
    battleCoverage,
    scoredWinRate: runCoverage.scored === 0 ? null : scoredWins / runCoverage.scored,
    scoredBattleWinRate:
      battleCoverage.scored === 0 ? null : scoredBattlesWon / battleCoverage.scored,
    scoredBattlesWon,
    deepestScorableRoom,
    outcomes,
    meanRoomsCleared: runs === 0 ? 0 : totalRooms / runs,
  };
}

const pct = (x: number | null): string => (x === null ? "n/a (nothing scorable)" : `${(x * 100).toFixed(1)}%`);

export function formatSummary(s: SimSummary, opts: { policy: string; opponent: string }): string {
  const lines: string[] = [];
  lines.push(`${s.runs} runs — ${opts.policy} vs ${opts.opponent}`);
  lines.push("");
  lines.push("RUN COVERAGE");
  lines.push(`  ${s.runCoverage.format("runs").split("\n").join("\n  ")}`);
  lines.push("");
  lines.push("BATTLE COVERAGE");
  lines.push(`  ${s.battleCoverage.format("battles").split("\n").join("\n  ")}`);
  lines.push("");
  lines.push("RESULTS ON THE SCORED SUBSET ONLY");
  lines.push(`  run win rate (full clear):  ${pct(s.scoredWinRate)}`);
  if (s.scoredWinRate === 0 && s.runCoverage.scored > 0) {
    // Say this out loud rather than letting a 0.0% read as a strategy result.
    lines.push(
      `      ^ 0 BY CONSTRUCTION, not by strategy: clearing a room fires a boon,`,
    );
    lines.push(
      `        so every run that survives room 1 is unscorable. A scored run is`,
    );
    lines.push(
      `        exactly a room-1 death. The battle line below is the real number.`,
    );
  }
  lines.push(
    `  battle win rate:            ${pct(s.scoredBattleWinRate)}` +
      `  (${s.scoredBattlesWon}/${s.battleCoverage.scored})`,
  );
  lines.push(`  deepest scorable room:      ${s.deepestScorableRoom}`);
  lines.push("");
  lines.push("ALL RUNS (including unscorable — for shape only, not for claims)");
  lines.push(
    `  cleared ${s.outcomes.cleared}  died ${s.outcomes.died}` +
      `  stalled ${s.outcomes.stalled}  halted ${s.outcomes.halted}`,
  );
  lines.push(`  mean rooms cleared: ${s.meanRoomsCleared.toFixed(2)}`);
  return lines.join("\n");
}

export { MOVES };
