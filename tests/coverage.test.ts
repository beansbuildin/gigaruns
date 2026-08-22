/**
 * tests/coverage.test.ts — the fail-closed contract.
 *
 * The whole point of coverage is that an unmodelled mechanic can never be
 * silently scored as if it were absent. These tests exist to make that
 * impossible to regress.
 */

import { describe, expect, it } from "vitest";

import { CoverageReport, probeCombatant, probeDecision, probeRun, REASONS } from "../src/sim/coverage.js";
import { loadCorpus } from "../src/sim/corpus.js";

describe("probeCombatant", () => {
  it("passes a clean side", () => {
    expect(probeCombatant({})).toEqual([]);
    expect(
      probeCombatant({
        pickedBoons: [],
        statusEffects: [],
        evasion: { current: 0 },
        block: { current: 0 },
        battleArmorReduction: 0,
      }),
    ).toEqual([]);
  });

  it("reads rolled stats from `current`, never `starting`", () => {
    // Enemy 65 has `starting: 0` and `current: 2`. A check written against
    // `starting` reports a clean corpus and is wrong.
    expect(probeCombatant({ block: { current: 2 } })).toContain("ROLLED_STATS");
    expect(probeCombatant({ block: { current: 0 } })).toEqual([]);
  });

  it("flags each mechanic with its own reason code", () => {
    expect(probeCombatant({ pickedBoons: [{}] })).toEqual(["BOON_TAKEN"]);
    expect(probeCombatant({ statusEffects: [{ type: "Burn", amount: 3 }] })).toEqual([
      "STATUS_EFFECT",
    ]);
    expect(probeCombatant({ battleArmorReduction: 1 })).toEqual(["ARMOR_REDUCTION"]);
    expect(probeCombatant({ gearBoons: [{}] })).toEqual(["UNKNOWN_EFFECT"]);
  });

  it("accumulates several reasons at once", () => {
    const rs = probeCombatant({
      pickedBoons: [{}],
      statusEffects: [{}],
      lck: { current: 1 },
    });
    expect(rs).toEqual(expect.arrayContaining(["BOON_TAKEN", "STATUS_EFFECT", "ROLLED_STATS"]));
  });
});

describe("probeRun", () => {
  it("flags a run-level enemy buff", () => {
    expect(probeRun({ activeEnemyBuff: null })).toEqual([]);
    expect(probeRun({ activeEnemyBuff: { id: "shatterblade" } })).toEqual(["ENEMY_BUFF"]);
    expect(probeRun({ perpetualBuffs: [{}] })).toEqual(["ENEMY_BUFF"]);
  });
});

describe("CoverageReport", () => {
  it("counts scored and unscorable separately and never mixes them", () => {
    const r = new CoverageReport();
    r.record([]);
    r.record([]);
    r.record(["BOON_TAKEN"]);
    r.record(["BOON_TAKEN", "STATUS_EFFECT"]);

    expect(r.scored).toBe(2);
    expect(r.unscorable).toBe(2);
    expect(r.total).toBe(4);
    expect(r.fraction).toBe(0.5);
    expect(r.byReason.get("BOON_TAKEN")).toBe(2);
    expect(r.byReason.get("STATUS_EFFECT")).toBe(1);
  });

  it("reports zero coverage rather than dividing by zero", () => {
    expect(new CoverageReport().fraction).toBe(0);
  });

  it("lists reasons in a stable order", () => {
    const r = new CoverageReport();
    r.record(["STATUS_EFFECT"]);
    r.record(["BOON_TAKEN"]);
    const lines = r.format("units").split("\n").slice(1);
    const order = lines.map((l) => REASONS.find((x) => l.includes(x)));
    expect(order).toEqual(["BOON_TAKEN", "STATUS_EFFECT"]);
  });
});

describe("coverage against the real corpus", () => {
  it("finds room 1 clean and everything past the first reward phase contaminated", () => {
    // This is the shape of the blind spot, asserted so a future capture that
    // changes it shows up as a failing test rather than a quiet drift.
    const runs = loadCorpus();
    const deep = runs.find((r) => r.name === "run-2026-08-14-01-00-08");
    expect(deep).toBeDefined();

    const first = deep!.states[0]!;
    expect(probeCombatant(first.run.players[0]!)).toEqual([]);
    expect(probeCombatant(first.run.players[1]!)).toEqual([]);

    // By state 029 the player carries boons and enemy 65 carries rolled stats.
    const late = deep!.states.find((s) => s.label.endsWith("state-029.json"))!;
    expect(probeCombatant(late.run.players[0]!)).toContain("BOON_TAKEN");
    expect(probeCombatant(late.run.players[1]!)).toContain("ROLLED_STATS");
  });
});

/**
 * [session 78, §3 / CODEXAUG22REVIEW H2] `probeDecision` — the two probes above
 * applied to one live decision, so a logged EV can say whether the model that
 * produced it covers the state.
 */
describe("probeDecision", () => {
  it("calls a fully clean state scorable", () => {
    const d = probeDecision({}, {}, {});
    expect(d.scorable).toBe(true);
    expect(d.reasons).toEqual([]);
  });

  it("is NOT scorable when either side carries rolled stats", () => {
    expect(probeDecision({ block: { current: 2 } }, {}, {}).scorable).toBe(false);
    expect(probeDecision({}, { evasion: { current: 1 } }, {}).scorable).toBe(false);
  });

  it("keeps the sides separate — the union hides which one raised it", () => {
    // "the ENEMY has rolled stats" and "I do" are different capture requests,
    // and §3's whole value is producing that capture list from the record.
    const d = probeDecision({ pickedBoons: [{}] }, { block: { current: 2 } }, {});
    expect(d.me).toEqual(["BOON_TAKEN"]);
    expect(d.foe).toEqual(["ROLLED_STATS"]);
    expect(d.reasons).toEqual(["BOON_TAKEN", "ROLLED_STATS"]);
  });

  it("deduplicates a reason both sides raise", () => {
    const d = probeDecision({ block: { current: 1 } }, { evasion: { current: 3 } }, {});
    expect(d.reasons).toEqual(["ROLLED_STATS"]);
    expect(d.me).toEqual(["ROLLED_STATS"]);
    expect(d.foe).toEqual(["ROLLED_STATS"]);
  });

  it("raises the run-level reason too, and attributes it to the run", () => {
    const d = probeDecision({}, {}, { activeEnemyBuff: { id: "not-a-known-buff" } });
    expect(d.run).toEqual(["ENEMY_BUFF"]);
    expect(d.scorable).toBe(false);
  });

  it("agrees with its own components — it is a composition, not a re-implementation", () => {
    const me = { statusEffects: [{ type: "Burn" }] };
    const foe = { battleArmorReduction: 1 };
    const run = {};
    const d = probeDecision(me, foe, run);
    expect(d.me).toEqual(probeCombatant(me));
    expect(d.foe).toEqual(probeCombatant(foe));
    expect(d.run).toEqual(probeRun(run));
  });

  it("marks a REAL captured rule-8 state unsupported — the case §3 exists for", () => {
    // The gate's demonstration, on the corpus rather than on a construction.
    // CLAUDE.md rule 8 selects the highest non-Perpetual tier, and 617 of the
    // 622 non-Safe paths carry rolled stats — so the live loop was assigning
    // confident EVs to almost every fight it deliberately picks.
    const runs = loadCorpus();
    const states = runs.flatMap((r) => r.states);
    expect(states.length).toBeGreaterThan(0);

    const unsupported = states.filter(
      (s) => !probeDecision(s.run.players[0]!, s.run.players[1]!, s.run).scorable,
    );
    expect(unsupported.length).toBeGreaterThan(0);

    // Every reason reported is a real one from the fixed vocabulary, and every
    // unsupported state names at least one. A state flagged with no reason
    // would be the silent-refusal failure this module exists to prevent.
    for (const s of unsupported) {
      const d = probeDecision(s.run.players[0]!, s.run.players[1]!, s.run);
      expect(d.reasons.length).toBeGreaterThan(0);
      for (const r of d.reasons) expect(REASONS).toContain(r);
    }
  });
});
