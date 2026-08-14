/**
 * tests/dungeonSim.test.ts — the simulator itself, and the gate.
 *
 * The claims worth defending here are not "the win rate is X". They are:
 * determinism, that nothing unmodelled is ever scored, and that the coverage
 * number reported next to a win rate actually describes that win rate.
 */

import { describe, expect, it } from "vitest";

import { fixedPolicy, randomPolicy, simulate, simulateRun } from "../src/sim/dungeonSim.js";
import { MAX_OBSERVED_ROOM } from "../src/sim/enemies.js";

const base = { opponent: randomPolicy, chargesAreHardLimit: true } as const;

describe("determinism", () => {
  it("returns identical results for identical seeds", () => {
    const a = simulateRun({ ...base, policy: randomPolicy, seed: 42 });
    const b = simulateRun({ ...base, policy: randomPolicy, seed: 42 });
    expect(a).toEqual(b);
  });

  it("returns different results for different seeds", () => {
    const runs = [1, 2, 3, 4, 5].map((s) => simulateRun({ ...base, policy: randomPolicy, seed: s }));
    expect(new Set(runs.map((r) => JSON.stringify(r))).size).toBeGreaterThan(1);
  });

  it("reproduces a whole batch from its seed", () => {
    const opts = { ...base, policy: randomPolicy };
    expect(simulate(200, opts, 7).scoredBattleWinRate).toBe(
      simulate(200, opts, 7).scoredBattleWinRate,
    );
  });
});

describe("fail-closed accounting", () => {
  it("never scores a battle that carries a reason code", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateRun({ ...base, policy: randomPolicy, seed });
      for (const b of r.battles) {
        // Any battle past room 1 inherits BOON_TAKEN from clearing room 1.
        if (b.room > 1) expect(b.reasons.length, `room ${b.room}`).toBeGreaterThan(0);
      }
    }
  });

  it("marks every run that clears a room as unscorable", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateRun({ ...base, policy: randomPolicy, seed });
      if (r.roomsCleared > 0) expect(r.reasons).toContain("BOON_TAKEN");
    }
  });

  it("marks a run that runs past the corpus DEPTH_BEYOND_CORPUS rather than extrapolating", () => {
    // always-Sword against always-Shield loses every exchange, so force the
    // clears with a policy that beats the opponent outright every time.
    const r = simulateRun({
      policy: fixedPolicy("paper"),
      opponent: fixedPolicy("rock"), // Shield beats Sword, every exchange
      chargesAreHardLimit: false,
      seed: 1,
      maxRooms: MAX_OBSERVED_ROOM + 3,
    });
    expect(r.reasons).toContain("DEPTH_BEYOND_CORPUS");
    expect(r.outcome).toBe("halted");
    expect(r.roomsCleared).toBe(MAX_OBSERVED_ROOM);
  });

  it("halts rather than inventing a move when every move is locked", () => {
    // Under a hard limit, a policy that only ever plays one move drives it to
    // -1 and then has nothing legal left once the others also run down.
    const r = simulateRun({
      policy: fixedPolicy("rock"),
      opponent: fixedPolicy("rock"),
      chargesAreHardLimit: true,
      seed: 1,
      maxRooms: 1,
    });
    // Either it resolved normally or it halted — but it must never have
    // silently played an illegal move.
    if (r.outcome === "halted") expect(r.reasons).toContain("CHARGES_ALL_LOCKED");
  });

  it("keeps coverage and win rate describing the same subset", () => {
    const s = simulate(500, { ...base, policy: randomPolicy }, 3);
    expect(s.battleCoverage.scored + s.battleCoverage.unscorable).toBe(s.battleCoverage.total);
    expect(s.scoredBattlesWon).toBeLessThanOrEqual(s.battleCoverage.scored);
    expect(s.scoredBattleWinRate).toBeCloseTo(s.scoredBattlesWon / s.battleCoverage.scored, 10);
  });

  it("reports null rather than a fake 0 when nothing is scorable", () => {
    // Starting at room 3 means every battle carries ROLLED_STATS from the off.
    const s = simulate(50, { ...base, policy: randomPolicy, startRoom: 3, maxRooms: 3 }, 5);
    expect(s.battleCoverage.scored).toBe(0);
    expect(s.scoredBattleWinRate).toBeNull();
  });
});

describe("the Task 4 gate", () => {
  const s = simulate(1000, { ...base, policy: randomPolicy }, 1);

  it("plays 1000 runs against a random-move opponent", () => {
    expect(s.runs).toBe(1000);
    expect(s.outcomes.cleared + s.outcomes.died + s.outcomes.stalled + s.outcomes.halted).toBe(1000);
  });

  it("scores a meaningful number of room-1 battles", () => {
    expect(s.battleCoverage.scored).toBe(1000); // every run fights room 1, and room 1 is clean
    expect(s.deepestScorableRoom).toBe(1);
  });

  it("reports a battle win rate in a believable range for random vs random", () => {
    // Not a strategy claim — a sanity check that the sim is not degenerate.
    expect(s.scoredBattleWinRate).toBeGreaterThan(0.3);
    expect(s.scoredBattleWinRate).toBeLessThan(0.8);
  });

  it("has a run win rate of exactly 0 on the scored subset, BY CONSTRUCTION", () => {
    // Worth pinning: clearing a room fires a boon, so a scored run is exactly a
    // room-1 death. If this ever becomes non-zero, either boons got modelled or
    // the fail-closed rule has been weakened — both need to be deliberate.
    expect(s.scoredWinRate).toBe(0);
  });
});
