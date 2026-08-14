/**
 * tests/replay.test.ts — the combat model against every recorded exchange.
 *
 * This is the test that would catch a wrong model, so it asserts the split that
 * matters: exchanges inside the clean model must match EXACTLY, and the known
 * misses must all be on exchanges coverage has already marked unscorable. A
 * mismatch on a clean exchange is a real bug and fails loudly.
 */

import { describe, expect, it } from "vitest";

import { exchanges, loadCorpus } from "../src/sim/corpus.js";
import { replayCorpus } from "../src/sim/replay.js";

const report = replayCorpus();

describe("corpus", () => {
  it("loads the recorded captures", () => {
    const runs = loadCorpus();
    expect(runs.length).toBeGreaterThanOrEqual(4);
    expect(exchanges(runs).length).toBe(66);
  });

  it("excludes the boon pickup that follows a kill", () => {
    // run-01-00-08 027→028 is the Heal boon landing (HP 15→31) while both
    // sides' lastMove still names the killing blow and the enemy id has not
    // changed. It is not an exchange. scripts/chargeTable.ts admitted it, which
    // is why its "all 16 odd deltas were plays from exactly 1" was wrong.
    const labels = exchanges(loadCorpus()).map((x) => x.label);
    expect(labels).not.toContain("state-027.json→state-028.json");
  });

  it("never treats a room transition as an exchange", () => {
    for (const x of exchanges(loadCorpus())) {
      expect(x.before.run.players[1]!.id).toBe(x.after.run.players[1]!.id);
    }
  });
});

describe("combat model vs recordings", () => {
  it("predicts every CLEAN exchange exactly", () => {
    const failures = report.cleanFailures.map(
      (f) =>
        `${f.run} ${f.label} ${f.myMove}/${f.foeMove}: ` +
        f.sides
          .filter((s) => !s.ok)
          .map(
            (s) =>
              `${s.who} predicted HP ${s.predictedHp} ARM ${s.predictedArmor}, ` +
              `actual HP ${s.actualHp} ARM ${s.actualArmor}`,
          )
          .join("; "),
    );
    expect(failures).toEqual([]);
  });

  it("has a clean subset worth trusting", () => {
    // If coverage ever collapses to zero this test says so, rather than the
    // suite passing vacuously on an empty set.
    expect(report.coverage.scored).toBeGreaterThan(20);
  });

  it("attributes every mismatch to an unmodelled mechanic", () => {
    for (const f of report.unscorableFailures) {
      expect(f.reasons.length).toBeGreaterThan(0);
    }
    expect(report.matched + report.unscorableFailures.length * 2).toBeGreaterThanOrEqual(
      report.sideUpdates - 6,
    );
  });

  it("reports the headline numbers", () => {
    // Not an assertion so much as a record of where the model stands.
    expect(report.sideUpdates).toBe(132);
    expect(report.matched).toBeGreaterThanOrEqual(126);
  });
});
