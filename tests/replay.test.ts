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
    expect(exchanges(runs).length).toBe(214);
  });

  it("excludes the boon pickup that follows a kill", () => {
    // run-01-00-08 027→028 is the Heal boon landing (HP 15→31) while both
    // sides' lastMove still names the killing blow and the enemy id has not
    // changed. It is not an exchange. scripts/chargeTable.ts admitted it, which
    // is why its "all 16 odd deltas were plays from exactly 1" was wrong.
    //
    // Qualified by RUN. `label` alone is just `state-NNN→state-NNN` and collides
    // across captures — session 06 added a run whose 027→028 is a perfectly
    // legitimate exchange, and the unqualified assertion started failing on the
    // wrong pair. The phantom is a specific pair in a specific run, so the test
    // has to say which.
    const labels = exchanges(loadCorpus()).map((x) => `${x.run}/${x.label}`);
    expect(labels).not.toContain("run-2026-08-14-01-00-08/state-027.json→state-028.json");
    // And the collision is real, so assert the other one IS admitted — otherwise
    // this test could pass by excluding both.
    expect(labels).toContain("run-2026-08-14-03-26-57/state-027.json→state-028.json");
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
    // [session 09] Task 6's five-run live stage: 5 completed dungeon runs
    // (rooms reached: 3, 4, 2, 2, 3 — died every time, no full clear), several
    // through non-Safe-tier battles (no Safe tier offered — see
    // enemyTier.ts) and one clean run all the way through a Heal/UpgradeRock
    // pickup chain. The clean combat model matched EVERY exchange exactly
    // across ALL FIVE runs, 0 clean failures — extending session 08's "the
    // model held through one full live run" through an entire five-run
    // stage, a gear change mid-session, and non-Safe-tier battles for the
    // first time.
    expect(report.sideUpdates).toBe(428);
    expect(report.matched).toBeGreaterThanOrEqual(126);
  });
});
