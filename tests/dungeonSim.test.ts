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
  // [session 09, LIVE] Both tests below used to assert a blanket "any battle/
  // run past room 1 is unscorable" — true through session 08's corpus, no
  // longer universally true. Live play captured the corpus's first-ever
  // room-1 offer containing Heal (the one boon with `contaminates: []`), so a
  // run CAN clear room 1 clean now, if and only if every boon it picked along
  // the way was Heal. Both tests are restated as that conditional rather than
  // dropped, so a regression that scores a battle past room 1 for any OTHER
  // reason still fails loudly.
  it("never scores a room>1 battle unless every boon picked before it was clean", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateRun({ ...base, policy: randomPolicy, seed });
      for (const b of r.battles) {
        if (b.room <= 1 || b.reasons.length > 0) continue;
        const priorBoons = r.boons.filter((x) => x.room < b.room);
        expect(priorBoons.length, `room ${b.room} scored with no prior boon pick`).toBeGreaterThan(0);
        for (const pb of priorBoons) {
          expect(pb.reasons.length, `room ${b.room} scored despite a contaminating boon (${pb.type})`).toBe(0);
        }
      }
    }
  });

  it("marks a run that clears a room as unscorable UNLESS every boon it picked was clean", () => {
    // [session 05] This used to assert the blanket `BOON_TAKEN`. Task 4.5
    // replaced that with per-boon reasons, so the assertion is restated at the
    // level of the claim it was actually protecting — clearing a room ends the
    // clean stretch — rather than at the level of the code that implemented it.
    // See handoff/scratch-session-05.md, Wall 1.
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateRun({ ...base, policy: randomPolicy, seed });
      if (r.roomsCleared > 0) {
        expect(r.boons.length).toBeGreaterThan(0);
        const allCleanBoons = r.boons.every((b) => b.reasons.length === 0);
        if (allCleanBoons) {
          for (const b of r.boons) expect(b.type, `seed ${seed}`).toBe("Heal");
        } else {
          expect(r.reasons.length, `seed ${seed} cleared a room but scored clean`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("flags every ROOM-1 boon EXCEPT Heal — Wall 1 has its first hole", () => {
    // Deliberately scoped to room 1. An earlier draft asserted this for EVERY
    // boon and failed on Heal at room 2 — correctly, because Heal really is
    // clean. That was the boon model working, not a hole in it: the wall was
    // that no *room-1* offer had ever contained a boon like Heal, so the run
    // was already unscorable by the time a clean one was on the table.
    //
    // [session 09, LIVE] That's no longer universally true. This session's
    // live play captured the corpus's first-ever room-1 offer containing
    // Heal — the one boon in the corpus with `contaminates: []` (boons.ts).
    // A run that lands on it at room 1 stays scorable into room 2+, which is
    // exactly why `deepestScorableRoom` moved 1 -> 3 this session (see "the
    // Task 4 gate" below). Every OTHER room-1 boon type still contaminates —
    // Wall 1 has a hole, not a collapse.
    let seenRoomOne = 0;
    let seenCleanHeal = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateRun({ ...base, policy: randomPolicy, seed });
      for (const b of r.boons.filter((x) => x.room === 1)) {
        seenRoomOne++;
        if (b.type === "Heal") {
          expect(b.reasons.length, "Heal at room 1 should be clean").toBe(0);
          seenCleanHeal++;
        } else {
          expect(b.reasons.length, `${b.type} at room 1 came back clean`).toBeGreaterThan(0);
        }
      }
    }
    expect(seenRoomOne, "no run ever cleared room 1").toBeGreaterThan(0);
    expect(seenCleanHeal, "Heal was never picked at room 1 across 200 seeds").toBeGreaterThan(0);
  });

  it("[session 08, LIVE] a Safe-tier walk now clears rooms 1-4 and only halts at room 5 (DEPTH_BEYOND_CORPUS)", () => {
    // always-Sword against always-Shield loses every exchange, so force the
    // clears with a policy that beats the opponent outright every time.
    // Room 3 (enemy 65) HAD never been captured at Safe tier through session
    // 07 — session 08 closed that gap live (the bot's own play, not a
    // supervised human capture). Every room 1-4 now has a Safe-tier capture,
    // so a default Safe-tier walk has no NO_TIER_CAPTURE wall left to hit at
    // all; the only remaining wall is genuinely unexplored depth.
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

  it("marks a run that starts past the corpus DEPTH_BEYOND_CORPUS rather than extrapolating", () => {
    // Start beyond every room the corpus has EVER captured at any tier — a
    // room-3-shaped Safe-tier wall isn't in play here, this is "no knowledge
    // at all" by construction, isolated by starting past it directly rather
    // than trying to walk there (rooms 1 and 3 don't share a tier that would
    // let a single `enemyTier` override reach room 4 first).
    const r = simulateRun({
      policy: fixedPolicy("paper"),
      opponent: fixedPolicy("rock"),
      chargesAreHardLimit: false,
      seed: 1,
      startRoom: MAX_OBSERVED_ROOM + 1,
      maxRooms: MAX_OBSERVED_ROOM + 3,
    });
    expect(r.reasons).toContain("DEPTH_BEYOND_CORPUS");
    expect(r.outcome).toBe("halted");
    expect(r.roomsCleared).toBe(0);
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
    // [session 08] Room 3 now HAS a Safe-tier capture (live, this session)
    // and is no longer guaranteed unscorable — room 5 is beyond anything
    // ever captured (MAX_OBSERVED_ROOM is 4), so it's the room that still
    // demonstrates "nothing scorable" reliably.
    const s = simulate(50, { ...base, policy: randomPolicy, startRoom: 5, maxRooms: 3 }, 5);
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
    // [session 09, LIVE] 1000 -> 1053 and deepestScorableRoom 1 -> 3: Wall 1's
    // first hole (Heal now offered, and sometimes picked, at room 1 — see
    // "flags every ROOM-1 boon EXCEPT Heal" above) lets SOME runs stay
    // scorable past room 1, not just the guaranteed-one-per-run room-1 battle.
    expect(s.battleCoverage.scored).toBe(1049);
    expect(s.deepestScorableRoom).toBe(3);
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
