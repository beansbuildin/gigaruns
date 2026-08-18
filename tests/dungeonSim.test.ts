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

/** Boon types with `contaminates: []` in BOON_MODELS — Heal, UpgradeRock, UpgradeScissor (session 09), AddMaxArmor (session 11). */
// [session 43] UpgradePaper joined — its own first pair came from a room-4
// pickup (this session's second bot-initiated juiced Tier-3 run), but the
// corpus already had eight unpicked room-1 UpgradePaper offers, now
// retroactively clean too (same mechanic as AddMaxArmor, session 11).
const CLEAN_BOON_TYPES = new Set(["Heal", "UpgradeRock", "UpgradeScissor", "AddMaxArmor", "UpgradePaper"]);

describe("fail-closed accounting", () => {
  // [session 09, LIVE] Both tests below used to assert a blanket "any battle/
  // run past room 1 is unscorable" — true through session 08's corpus, no
  // longer universally true. Live play captured pickup pairs for Heal AND
  // two `moveDelta` boons (UpgradeRock, UpgradeScissor — see BOON_MODELS,
  // `contaminates: []`), so a run CAN clear room 1 clean now, if and only if
  // every boon it picked along the way was one of these three types. Both
  // tests are restated as that conditional rather than dropped, so a
  // regression that scores a battle past room 1 for any OTHER reason still
  // fails loudly.
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
          for (const b of r.boons) expect(CLEAN_BOON_TYPES.has(b.type), `seed ${seed}: ${b.type}`).toBe(true);
        } else {
          expect(r.reasons.length, `seed ${seed} cleared a room but scored clean`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("flags every ROOM-1 boon EXCEPT the four clean types — Wall 1 has holes, not a collapse", () => {
    // Deliberately scoped to room 1. An earlier draft asserted this for EVERY
    // boon and failed on Heal at room 2 — correctly, because Heal really is
    // clean. That was the boon model working, not a hole in it: the wall was
    // that no *room-1* offer had ever contained a boon like Heal, so the run
    // was already unscorable by the time a clean one was on the table.
    //
    // [session 09, LIVE] That's no longer universally true. Live play
    // captured room-1 pickup pairs for Heal AND two `moveDelta` boons
    // (UpgradeRock, UpgradeScissor — `contaminates: []`, boons.ts). A run
    // that lands on any of these three at room 1 stays scorable into
    // room 2+, which is exactly why `deepestScorableRoom` moved 1 -> 4
    // (MAX_OBSERVED_ROOM) this session (see "the Task 4 gate" below). Every
    // OTHER room-1 boon type still contaminates.
    //
    // [session 11] AddMaxArmor joined CLEAN_BOON_TYPES — its own first pair
    // came from a room-2 pickup, but the corpus ALREADY had an unpicked
    // room-1 AddMaxArmor offer (session 06), which is now retroactively
    // clean too. `seenCleanPick` below counts all four types, not room-1
    // discoveries specifically.
    let seenRoomOne = 0;
    let seenCleanPick = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateRun({ ...base, policy: randomPolicy, seed });
      for (const b of r.boons.filter((x) => x.room === 1)) {
        seenRoomOne++;
        if (CLEAN_BOON_TYPES.has(b.type)) {
          expect(b.reasons.length, `${b.type} at room 1 should be clean`).toBe(0);
          seenCleanPick++;
        } else {
          expect(b.reasons.length, `${b.type} at room 1 came back clean`).toBeGreaterThan(0);
        }
      }
    }
    expect(seenRoomOne, "no run ever cleared room 1").toBeGreaterThan(0);
    expect(seenCleanPick, "no clean type was ever picked at room 1 across 200 seeds").toBeGreaterThan(0);
  });

  it("[session 42] a Safe-tier walk clears rooms 1-5 and halts at room 6 (NO_TIER_CAPTURE, not DEPTH_BEYOND_CORPUS)", () => {
    // always-Sword against always-Shield loses every exchange, so force the
    // clears with a policy that beats the opponent outright every time.
    // Room 3 (enemy 65) HAD never been captured at Safe tier through session
    // 07 — session 08 closed that gap live (the bot's own play, not a
    // supervised human capture). Rooms 1-5 now each have a Safe-tier capture.
    // [session 42] Room 6 (Enemy Room 68) is a NEW capture this session, but
    // it was NOT offered at Safe tier live (`enemyPathOptions[]` offered
    // {Dangerous, Dangerous, Risky}, no tier 0 at all — see enemies.ts's
    // room-6 entry) — so `MAX_OBSERVED_ROOM` grew to 7 (room 6 and 7 both
    // now captured) while the default Safe-tier walk's own wall moved from
    // "genuinely unexplored depth" back to "known room, wrong tier" at room
    // 6 specifically. This is the SAME NO_TIER_CAPTURE wall shape session
    // 08 closed for room 3, reappearing one room deeper — not a regression,
    // a real capture gap this run didn't happen to fill.
    const r = simulateRun({
      policy: fixedPolicy("paper"),
      opponent: fixedPolicy("rock"), // Shield beats Sword, every exchange
      chargesAreHardLimit: false,
      seed: 1,
      maxRooms: MAX_OBSERVED_ROOM + 3,
    });
    expect(r.reasons).toContain("NO_TIER_CAPTURE");
    expect(r.reasons).not.toContain("DEPTH_BEYOND_CORPUS");
    expect(r.outcome).toBe("halted");
    expect(r.roomsCleared).toBe(5);
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
    // [session 09, LIVE] 1000 -> 1108 and deepestScorableRoom 1 -> 4
    // (MAX_OBSERVED_ROOM, the corpus's absolute depth ceiling): Wall 1's
    // three holes (Heal AND two `moveDelta` boons, all `contaminates: []` —
    // see "flags every ROOM-1 boon EXCEPT the four clean types" above) let
    // SOME runs stay scorable well past room 1, not just the guaranteed-one-
    // per-run room-1 battle.
    // [session 11] 1108 -> 1120 — AddMaxArmor joined CLEAN_BOON_TYPES (a
    // fourth clean type), opening slightly more scorable paths at this same
    // seed. deepestScorableRoom stays 4 — still MAX_OBSERVED_ROOM, a boon
    // becoming clean doesn't raise the corpus's depth ceiling.
    // [session 12] 1120 -> 1094 — two more live runs added 5 room-1/2/3
    // offers to OBSERVED_OFFERS (no new clean types), which reshuffles which
    // random boon draws a run gets at this same seed; a boon-offer-table
    // change moving `scored` in either direction is expected, not a
    // regression — see the corpus-total-drift note in tests/replay.test.ts.
    // [session 13] 1094 -> 1097 — one more live run added 2 room-1/2 offers
    // (no new clean types) plus PLAYER.hpMax 34->36 (src/sim/enemies.ts),
    // same reshuffling, not a regression.
    // [session 14] 1097 -> 1099 -> 1087 — two more live runs this session
    // (brief §4's resumed run: new room-3 CorrosiveMagic offer, now modelled
    // as `{kind:"latent"}`, contaminates STATUS_EFFECT; brief §3's Stage B
    // probe run: new room-1 ArmorDepletedWeak offer, unmodelled). Neither is
    // a new clean type — both reshuffle which random draws land scorable at
    // this same seed, same drift as every prior session.
    // [session 16] 1087 -> 1083 -> 1126 — two live runs (Task 12 Stage B's
    // potion-timing runs) added five new offers total (first run — room 1:
    // CorrosiveMagic/BurningTenacity/AddLifestealMagic; room 2:
    // UpgradeScissor/AddIntuition/AddMaxArmor; room 3: AddLuck/AddEvasion/
    // SecondWind. Second run — room 1: UpgradeScissor/AddMaxArmor/AddBlock;
    // room 2: AddBlock/AddIntuition/AddMaxArmor). No new clean type — same
    // reshuffling, not a regression.
    // [live, 2026-08-16/17] 1126 -> 1108 — the takeover run added three new
    // offers (room 1: VulnerableBlock/CorrosiveShield/AddBlock; room 2:
    // UpgradeScissor/AddTenacity/AddBlock; room 3: AddVulnerableShield/
    // AddLuck/AddBlock). No new clean type — same reshuffling, not a
    // regression. `deepestScorableRoom` also moved 4 -> 3 for the first time
    // through this reshuffling: it is the deepest room with a SCORED battle
    // in THIS seeded 1000-run sample (dungeonSim.ts), capped by but distinct
    // from `MAX_OBSERVED_ROOM` (enemies.ts, still 4 — untouched, since it
    // comes from ROOM_ENEMIES, not OBSERVED_OFFERS). Growing the room-1/2/3
    // option pools shifted which random boon each simulated run draws at
    // this seed; the low-probability tail of "stay scorable all the way to
    // a room-4 battle" happened to fall out of the sample this time. Not a
    // regression in the model — same class of drift as `scored` above, just
    // the first time it has touched this particular number.
    // [live, session 19] 1108 -> 1127 — the orchestrator smoke test's real
    // run added one new room-1 offer (AddTenacity/AddBlock/AddBurnShield,
    // all rolled-stat-contaminated or unmodelled). No new clean type, same
    // reshuffling-not-regression pattern; `deepestScorableRoom` unchanged at 3.
    // [session 20] 1127 -> 1159 — the potion-orchestrator-wiring smoke
    // test's two runs added 7 more offers (no new clean type). This is the
    // 10th time in a row this exact number has moved from ordinary corpus
    // growth reshuffling the random draws, never from a real bug — so it's
    // now a RANGE, not a bumped literal (DECISIONS 2026-08-15/16/17,
    // session-20 brief §3's "recurring bookkeeping tax"). The band covers
    // every value seen across 10 sessions (1083-1159) with margin on both
    // sides; a real regression (scoring breaking, collapsing toward 0 or up
    // near `battleCoverage.total`) still fails loudly.
    expect(s.battleCoverage.scored).toBeGreaterThan(800);
    expect(s.battleCoverage.scored).toBeLessThan(1400);
    // [session 20] 3 -> 4 — same reshuffling as `scored` above, from the
    // same new offers. This has bounced non-monotonically for sessions now
    // (1 -> 4 -> 3 -> 4, per this describe block's own history above), so a
    // floor alone doesn't fit; bounded instead by the two real invariants
    // that actually hold: at least 1 (Wall 1 guarantees a scorable room-1
    // battle) and never past `MAX_OBSERVED_ROOM` (can't score deeper than
    // the corpus has ever been captured).
    expect(s.deepestScorableRoom).toBeGreaterThanOrEqual(1);
    expect(s.deepestScorableRoom).toBeLessThanOrEqual(MAX_OBSERVED_ROOM);
  });

  it("reports a battle win rate in a believable range for random vs random", () => {
    // Not a strategy claim — a sanity check that the sim is not degenerate.
    // [session 23] Upper bound 0.8 -> 0.9: PLAYER's real gear re-spec'd this
    // session (enemies.ts's PLAYER doc — scissor ATK/DEF 12/8 -> 18/13, a
    // genuinely stronger move against these enemies), pushing even a random
    // policy's measured rate to ~0.82. A real stat change, not a sim bug —
    // margin added the same way the two bands above this one already were.
    expect(s.scoredBattleWinRate).toBeGreaterThan(0.3);
    expect(s.scoredBattleWinRate).toBeLessThan(0.9);
  });

  it("[session 11] a scored clear is possible by construction but landed at 0 in this seeded batch", () => {
    // [session 05-08] This used to pin scoredWinRate at exactly 0: clearing a
    // room fired a boon, and every boon fired BOON_UNMODELLED or
    // ROLLED_STATS, so a scored run was BY CONSTRUCTION a room-1 death.
    // [session 09] That construction argument stopped holding once three boon
    // types went clean (Heal, UpgradeRock, UpgradeScissor) — 0.32% of scored
    // runs, at this exact seed, threaded clean picks through every room they
    // passed while also winning every battle.
    // [session 11] AddMaxArmor joining CLEAN_BOON_TYPES changed WHICH runs at
    // this seed stay scored (1108 -> 1120 scored battles, previous test) —
    // and at this specific seed, the re-shuffled set of scored runs no longer
    // includes any full clear: 0/1120. Still possible by construction (the
    // same reasoning as session 09 applies: a run threading only clean picks
    // while winning every battle stays scored to a clear) — just not observed
    // in this one N=1000, seed=1 draw. A future session finding this at 0
    // again is not itself informative; finding it LARGE without a deliberate
    // change would be.
    // [session 12] Back to nonzero at this same seed: two more live runs'
    // worth of new OBSERVED_OFFERS reshuffled which runs stay scored (1120 ->
    // 1094 scored battles, previous test), and this reshuffle happens to
    // include 2 full clean clears out of 251 scored runs (2/251). Neither the
    // session-11 zero nor this session's nonzero is itself informative about
    // the strategy — both are boon-offer-table artifacts at a fixed seed, per
    // the note on the previous test.
    // [session 14] Back to 0/255 — two more live runs' worth of new offers
    // (CorrosiveMagic, ArmorDepletedWeak) reshuffled the scored set again
    // (1099 -> 1087 scored battles, previous test). Same non-finding as
    // session 11: possible by construction, just not drawn at this seed.
    expect(s.scoredWinRate).toBeCloseTo(0);
  });
});

describe("potion timing (Task 12 Stage B)", () => {
  it("does nothing when no potions are configured — exact regression match", () => {
    const withoutOpt = simulateRun({ ...base, policy: randomPolicy, seed: 3 });
    const withEmptyPlan = simulateRun({
      ...base,
      policy: randomPolicy,
      seed: 3,
      potions: { heals: [], threshold: 0.9 },
    });
    expect(withEmptyPlan).toEqual(withoutOpt);
  });

  it("fires a heal mid-battle once HP crosses the threshold, and never overheals past hpMax", () => {
    // Threshold 0.99 fires on essentially the first exchange that costs any
    // HP at all, so a long enough run should show at least one use with
    // hpAfter <= hpMax at the moment it fired.
    let sawUse = false;
    for (let seed = 1; seed <= 30 && !sawUse; seed++) {
      const r = simulateRun({
        ...base,
        policy: randomPolicy,
        seed,
        potions: { heals: [20, 20, 20], threshold: 0.99 },
      });
      for (const u of r.potionsUsed) {
        sawUse = true;
        expect(u.hpAfter).toBeLessThanOrEqual(u.hpBefore + 20);
        expect(u.hpAfter).toBeGreaterThan(u.hpBefore); // 0.99 threshold means it never fires at full HP
      }
    }
    expect(sawUse, "no potion ever fired across 30 seeds at threshold 0.99").toBe(true);
  });

  it("consumes potions in order and never uses more than the loadout size across a whole run", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = simulateRun({
        ...base,
        policy: randomPolicy,
        seed,
        potions: { heals: [20, 20, 20], threshold: 0.5 },
      });
      expect(r.potionsUsed.length).toBeLessThanOrEqual(3);
    }
  });

  it("stays deterministic with a potion plan configured", () => {
    const opts = {
      ...base,
      policy: randomPolicy,
      potions: { heals: [20, 20, 20], threshold: 0.5 },
    };
    const a = simulateRun({ ...opts, seed: 11 });
    const b = simulateRun({ ...opts, seed: 11 });
    expect(a).toEqual(b);
  });

  it("a generous loadout/threshold raises mean rooms cleared over the 0-potion baseline", () => {
    const baseline = simulate(1500, { ...base, policy: randomPolicy }, 1);
    const withPotions = simulate(
      1500,
      { ...base, policy: randomPolicy, potions: { heals: [20, 20, 20], threshold: 0.5 } },
      1,
    );
    expect(withPotions.meanRoomsCleared).toBeGreaterThan(baseline.meanRoomsCleared);
    expect(withPotions.meanPotionsUsed).toBeGreaterThan(0);
  });
});
