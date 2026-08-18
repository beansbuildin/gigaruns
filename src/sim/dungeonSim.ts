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

import { applyBoon, offersForRoom, type BoonOffer, type BoonOption } from "./boons.js";
import { legalMoves, resolveExchange, enterRoom, type ExchangeResult } from "./combat.js";
import { CoverageReport, type Reason } from "./coverage.js";
import { lookupEnemy, MAX_OBSERVED_ROOM, PLAYER, SAFE_TIER } from "./enemies.js";
import { makeRng, type Rng } from "./rng.js";
import { anyRolled, cloneCombatant, isDead, MOVES, type BattleState, type Combatant, type MoveKey } from "./types.js";

/**
 * A move chooser, and — since Task 4.5 — a boon chooser.
 *
 * Strategy modules plug in here; none may touch the network. `pickBoon` is
 * optional so the Task 4 baselines keep working unchanged; the default takes
 * the first option, which is a real choice rather than a random one and keeps
 * the baselines deterministic.
 */
export interface Policy {
  name: string;
  pick(state: BattleState, legal: MoveKey[], rng: Rng): MoveKey;
  pickBoon?(player: Combatant, offered: BoonOption[], room: number, rng: Rng): BoonOption;
  /**
   * Called before the first exchange of each battle. A stateful policy resets
   * per-battle memory here — notably the enemy's previous move, which must not
   * cross a room boundary.
   */
  onBattleStart?(state: BattleState): void;
  /**
   * Called after every resolved exchange, with what both sides actually played.
   *
   * This is how an opponent model learns inside the sim, and it grants the
   * policy nothing it would not have live: the wire state carries `lastMove` for
   * both sides on every poll, so a real bot observes exactly this. It is called
   * for the acting policy only — an opponent policy is scenery, not a learner.
   */
  observe?(result: ExchangeResult, room: number): void;
}

export const randomPolicy: Policy = {
  name: "random",
  pick: (_s, legal, rng) => rng.pick(legal),
  pickBoon: (_p, offered, _room, rng) => rng.pick(offered),
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
  /**
   * Override the reward offers for a room. Defaults to `offersForRoom`, i.e.
   * only what the corpus recorded.
   *
   * This exists for ONE purpose: the counterfactual in `scripts/sim.ts` that
   * asks "if a clean boon were ever offered at room 1, how deep could the sim
   * then score?" — which separates "is the boon model correct" from "does the
   * corpus offer a clean boon". Anything it produces is a HYPOTHETICAL and must
   * be labelled as one. Never use it to generate a reported result.
   */
  offers?: (room: number) => BoonOffer[];
  /**
   * Enemy tier fought at every room. Defaults to SAFE_TIER — CLAUDE.md's hard
   * rule (DECISIONS 2026-08-16): the loot table is identical across tiers, so
   * anything else is pure added risk with zero reward. Exists as an override
   * ONLY for diagnostics that need a specific captured instance regardless of
   * tier (e.g. the §1 threshold check in scripts/sim.ts, which tests a
   * tier-invariant DEF stat) — never for a reported win rate, which must
   * describe what live play would actually fight.
   */
  enemyTier?: number;
  /**
   * Override the player's starting stats. Defaults to `PLAYER` (the current
   * live-confirmed gear loadout, `src/sim/enemies.ts`).
   *
   * Originally for exactly ONE purpose, `scripts/gearSweep.ts`'s
   * counterfactual — "which single-stat gear upgrade is worth the most rooms
   * cleared" — a question about progression choices, not about current play.
   * [session 35, CODEXIMPROVE #5] `scripts/boonRankingCheck.ts` reuses it for
   * a second, structurally identical question: what a short continuation
   * looks like after `applyBoon()` moves the player's stats. A result
   * produced with this override is a HYPOTHETICAL starting state and must be
   * labelled as one; never use it to report the live win rate.
   */
  player?: Combatant;
  /**
   * Task 12 Stage B: a loadout of potions used at a real HP threshold,
   * instead of `scripts/potionSweep.ts`'s original all-committed-at-room-1
   * model. Applying the heal is modelled as free — no exchange consumed, no
   * charges affected — CONFIRMED live, session 16: two live runs (4/4 real
   * `use_item` calls) left the enemy's HP/ARM and the opponent model's
   * observation count unchanged, i.e. a potion is a free action, not a
   * substitute move. See DECISIONS.md 2026-08-16.
   */
  potions?: PotionPlan;
}

export interface PotionPlan {
  /** Heal amounts, consumed in array order. E.g. [20, 20, 20] for 3 Big Heal Juice. */
  heals: number[];
  /** Use the next potion the instant own HP fraction drops to/at-or-below this, checked once before each exchange. */
  threshold: number;
}

export interface PotionUse {
  room: number;
  heal: number;
  hpBefore: number;
  hpAfter: number;
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
  potionsUsed: PotionUse[];
}

export interface BoonRecord {
  room: number;
  type: string;
  /** Empty means the boon is modelled AND drags nothing unmodelled in. */
  reasons: Reason[];
}

export interface RunResult {
  outcome: RunOutcome;
  roomsCleared: number;
  exchanges: number;
  hp: number;
  battles: BattleRecord[];
  boons: BoonRecord[];
  /** Empty means the whole run is inside the clean model. */
  reasons: Reason[];
  potionsUsed: PotionUse[];
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
  potionsRemaining: number[],
): { state: BattleState; record: BattleRecord; stalled: boolean; halted: boolean } {
  const limit = opts.maxExchangesPerBattle ?? DEFAULT_MAX_EXCHANGES;
  const reasons = new Set<Reason>(carried);
  let state = start;
  let count = 0;
  let halted = false;
  const potionsUsed: PotionUse[] = [];

  opts.policy.onBattleStart?.(state);

  while (!isDead(state.me) && !isDead(state.foe) && count < limit) {
    // Checked before every exchange, so a heal taken mid-battle can still
    // change that exchange's outcome — see PotionPlan's doc comment on the
    // "free" assumption this rests on.
    if (opts.potions && potionsRemaining.length > 0 && state.me.hp / state.me.hpMax <= opts.potions.threshold) {
      const heal = potionsRemaining.shift()!;
      const hpBefore = state.me.hp;
      const hpAfter = Math.min(state.me.hpMax, hpBefore + heal);
      state = { ...state, me: { ...state.me, hp: hpAfter } };
      potionsUsed.push({ room: state.room, heal, hpBefore, hpAfter });
    }

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
    const result = resolveExchange(state, myMove, foeMove);
    // Observe AFTER resolution, so a learning policy sees exactly what a live
    // bot sees: the state that carries both sides' `lastMove`.
    opts.policy.observe?.(result, state.room);
    state = result.state;
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
      potionsUsed,
    },
  };
}

export function simulateRun(opts: SimOptions): RunResult {
  const rng = makeRng(opts.seed);
  const maxRooms = opts.maxRooms ?? MAX_OBSERVED_ROOM;
  const runReasons = new Set<Reason>();
  const battles: BattleRecord[] = [];

  let player = cloneCombatant(opts.player ?? PLAYER);
  let roomsCleared = 0;
  let exchanges = 0;
  let outcome: RunOutcome = "cleared";
  const boons: BoonRecord[] = [];
  const potionsUsed: PotionUse[] = [];
  // Cloned once per run — a fresh loadout every simulateRun call, mutated
  // in place (via .shift()) by fightBattle as potions are consumed across
  // rooms within THIS run only.
  const potionsRemaining = [...(opts.potions?.heals ?? [])];

  const tier = opts.enemyTier ?? SAFE_TIER;

  for (let room = opts.startRoom ?? 1; room <= maxRooms; room++) {
    const profile = lookupEnemy(room, tier);
    if (!profile) {
      // Two distinct failure shapes, both fail-closed rather than guessed:
      // past MAX_OBSERVED_ROOM the corpus has no enemy at ANY tier; at or
      // below it, the room is known but not at the tier this run required
      // (room 3 today, under the default Safe tier — see enemies.ts).
      runReasons.add(room > MAX_OBSERVED_ROOM ? "DEPTH_BEYOND_CORPUS" : "NO_TIER_CAPTURE");
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
      potionsRemaining,
    );
    exchanges += battle.record.exchanges;
    battles.push(battle.record);
    potionsUsed.push(...battle.record.potionsUsed);
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

    // A cleared room fires `rewardPathPhase` and the player MUST take a boon —
    // there is no decline option in any recorded offer. [Task 4.5]
    //
    // Boons are now applied as real state deltas (src/sim/boons.ts) rather than
    // blanket-flagged, but that does NOT make them free: a boon can be modelled
    // exactly at pickup and still drag in a mechanic combat.ts cannot evaluate.
    // Both rolled-stat boons do precisely that, which is why this still ends
    // the clean stretch of nearly every run.
    if (room < maxRooms) {
      const offers = (opts.offers ?? offersForRoom)(room);
      if (offers.length === 0) {
        // We know the room was cleared and we do not know what was offered.
        // Skipping the boon entirely would model a run that cannot happen.
        runReasons.add("BOON_OFFER_UNKNOWN");
        continue;
      }
      const offer = rng.pick(offers);
      const chosen = opts.policy.pickBoon
        ? opts.policy.pickBoon(player, offer.options, room, rng)
        : offer.options[0]!;
      const applied = applyBoon(player, chosen);
      player = applied.player;
      boons.push({ room, type: chosen.type, reasons: applied.reasons });
      for (const r of applied.reasons) runReasons.add(r);
      // A boon that granted a rolled stat leaves the player permanently outside
      // the clean model, so assert it rather than trusting the reason list.
      if (anyRolled(player.rolled)) runReasons.add("ROLLED_STATS");
    }
  }

  return {
    outcome,
    roomsCleared,
    exchanges,
    hp: player.hp,
    battles,
    boons,
    reasons: [...runReasons],
    potionsUsed,
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
  /** Coverage over boon pickups — how often a taken boon kept the run clean. */
  boonCoverage: CoverageReport;
  /** Every boon type actually taken, and whether it cost coverage. */
  boonsTaken: Map<string, { n: number; clean: number }>;
  /**
   * Mean rooms cleared with a 95% CI half-width, for the restated Task 5 gate.
   * Normal approximation over `runs` independent runs.
   */
  roomsClearedCi95: number;
  /**
   * Scored battles per room, so a result can be quoted at the depth it was
   * measured at rather than pooled. The Task 5 gate reads room 1 off this;
   * nothing about the shape is room-1-specific, so it keeps working as
   * coverage climbs. [session 06]
   */
  battlesByRoom: Map<number, RoomStats>;
  /** Task 12 Stage B: mean potions consumed per run, over ALL runs (not just scored) — a potion fires whether or not the run stayed clean. */
  meanPotionsUsed: number;
}

/** Scored battles at one room depth, with a binomial CI on the win rate. */
export interface RoomStats {
  room: number;
  scored: number;
  unscorable: number;
  won: number;
  /** Wins / scored. `null` when nothing at this depth was scorable. */
  winRate: number | null;
  /**
   * 95% CI half-width on `winRate`, normal approximation. `null` when there is
   * no rate. Two policies whose intervals do not overlap are separated at 95%
   * — which is the Task 5 gate, rather than a margin someone picked.
   */
  ci95: number | null;
}

function roomStats(room: number, scored: number, unscorable: number, won: number): RoomStats {
  const winRate = scored === 0 ? null : won / scored;
  return {
    room,
    scored,
    unscorable,
    won,
    winRate,
    ci95: winRate === null || scored < 2 ? null : 1.96 * Math.sqrt((winRate * (1 - winRate)) / scored),
  };
}

export function simulate(runs: number, opts: Omit<SimOptions, "seed">, seed = 1): SimSummary {
  const runCoverage = new CoverageReport();
  const battleCoverage = new CoverageReport();
  const boonCoverage = new CoverageReport();
  const boonsTaken = new Map<string, { n: number; clean: number }>();
  const outcomes: Record<RunOutcome, number> = { cleared: 0, died: 0, stalled: 0, halted: 0 };

  const perRoom = new Map<number, { scored: number; unscorable: number; won: number }>();
  let scoredWins = 0;
  let scoredBattlesWon = 0;
  let deepestScorableRoom = 0;
  let totalRooms = 0;
  let sumSqRooms = 0;
  let totalPotionsUsed = 0;

  for (let i = 0; i < runs; i++) {
    const r = simulateRun({ ...opts, seed: seed + i });
    outcomes[r.outcome]++;
    totalRooms += r.roomsCleared;
    sumSqRooms += r.roomsCleared * r.roomsCleared;
    totalPotionsUsed += r.potionsUsed.length;

    runCoverage.record(r.reasons);
    if (r.reasons.length === 0 && r.outcome === "cleared") scoredWins++;

    for (const b of r.battles) {
      battleCoverage.record(b.reasons);
      const tally = perRoom.get(b.room) ?? { scored: 0, unscorable: 0, won: 0 };
      if (b.reasons.length === 0) {
        tally.scored++;
        if (b.won) {
          tally.won++;
          scoredBattlesWon++;
        }
        deepestScorableRoom = Math.max(deepestScorableRoom, b.room);
      } else {
        tally.unscorable++;
      }
      perRoom.set(b.room, tally);
    }

    for (const b of r.boons) {
      boonCoverage.record(b.reasons);
      const t = boonsTaken.get(b.type) ?? { n: 0, clean: 0 };
      t.n++;
      if (b.reasons.length === 0) t.clean++;
      boonsTaken.set(b.type, t);
    }
  }

  const mean = runs === 0 ? 0 : totalRooms / runs;
  // Sample variance, then the 95% half-width of the mean. Reported so the
  // Task 5 gate can be a confidence interval rather than a number I picked.
  const variance = runs < 2 ? 0 : Math.max(0, sumSqRooms / runs - mean * mean) * (runs / (runs - 1));
  const roomsClearedCi95 = runs < 2 ? 0 : 1.96 * Math.sqrt(variance / runs);

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
    meanRoomsCleared: mean,
    boonCoverage,
    boonsTaken,
    roomsClearedCi95,
    meanPotionsUsed: runs === 0 ? 0 : totalPotionsUsed / runs,
    battlesByRoom: new Map(
      [...perRoom.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([room, t]) => [room, roomStats(room, t.scored, t.unscorable, t.won)]),
    ),
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
  lines.push("  battle win rate by room (scored only):");
  for (const st of s.battlesByRoom.values()) {
    lines.push(
      `    room ${st.room}: ` +
        (st.winRate === null
          ? `nothing scorable (${st.unscorable} unscorable)`
          : `${(st.winRate * 100).toFixed(1)}% ± ${((st.ci95 ?? 0) * 100).toFixed(1)}` +
            `  (${st.won}/${st.scored} scored, ${st.unscorable} unscorable)`),
    );
  }
  lines.push("");
  lines.push("BOONS TAKEN");
  if (s.boonCoverage.total === 0) {
    lines.push("  none — no run cleared a room");
  } else {
    lines.push(`  ${s.boonCoverage.format("pickups").split("\n").join("\n  ")}`);
    for (const [type, t] of [...s.boonsTaken].sort((a, b) => b[1].n - a[1].n)) {
      lines.push(
        `    ${type.padEnd(20)} taken ${String(t.n).padStart(5)}` +
          `   kept the run clean: ${t.clean}`,
      );
    }
  }
  lines.push("");
  lines.push("ALL RUNS (including unscorable — for shape only, not for claims)");
  lines.push(
    `  cleared ${s.outcomes.cleared}  died ${s.outcomes.died}` +
      `  stalled ${s.outcomes.stalled}  halted ${s.outcomes.halted}`,
  );
  lines.push(
    `  mean rooms cleared: ${s.meanRoomsCleared.toFixed(3)} ± ${s.roomsClearedCi95.toFixed(3)} (95% CI)`,
  );
  return lines.join("\n");
}

export { MOVES };
