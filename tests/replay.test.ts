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
    expect(exchanges(runs).length).toBe(414); // +28 live [2026-08-16/17]: the takeover run (resumed and completed via liveRun.ts, STATE.md session 17) — rooms 1-3 cleared, died room 4, both configured potions fired correctly on a run the bot didn't itself start
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
    // [session 11] Three more retuned-config live runs (rooms reached: 4, 3,
    // 2 — died every time), a gear re-spec (see enemies.ts's PLAYER doc), and
    // the corpus's first-ever non-Safe-tier room-4 battle (Withering buff,
    // see tests/enemies.test.ts). The clean model matched EVERY exchange
    // again — 0 clean failures, still holding through 8 live dungeon runs
    // total.
    // [session 12] Two more live runs (died rooms 3, 4 — Task 6's live
    // capability exercised again, not this session's focus). 0 clean
    // failures again, now 10 live dungeon runs total.
    // [session 13] One more live run (Task 12 Stage A's use_item probe,
    // §2 — not this session's focus either), stopped by an HTTP 500 on a
    // combat move that a live re-check confirmed did NOT apply (DECISIONS
    // 2026-08-15). Clean model still matched every exchange, 0 clean
    // failures, now 11 live dungeon runs total.
    // [session 14] Resumed that same stuck run (brief §4, first action this
    // session) — it survived room 3 at HP 1/36, picked up CorrosiveMagic
    // (now modelled, see boons.ts), cleared into room 4, and died there. A
    // second, fresh run carried Task 12 Stage B's `--probe-consumables`
    // capture (brief §3): `consumables: [131]` on `start_run` decremented
    // the account's Big Heal Juice balance immediately, before any combat —
    // see DECISIONS.md. That run died room 2. Clean model matched every
    // exchange across both, 0 clean failures, now 13 confirmed deaths /
    // death-room histogram 0/4/4/5 (scripts/deathRooms.ts).
    // [session 16] Task 12 Stage B's live potion-timing policy, TWO runs:
    // first `start_run` with `consumables: [131, 131]`, `use_item` fired
    // mid-combat via the sim-chosen threshold (0.5). First use (index 0)
    // healed 16/36 -> 36/36 with NO exchange resolved (enemy HP/ARM/model
    // observation count all unchanged) — confirms `use_item` costs no
    // combat turn. Second use at the SAME index 0 was rejected ("Item not
    // found in index"); `index: 1` then succeeded (4/36 -> 24/36) — `index`
    // addresses a position in the committed loadout, not the item id (see
    // `usePotionLive`'s doc comment, liveRun.ts). Run resumed and played to
    // a room-4 death. A SECOND run confirmed the resulting code fix
    // end-to-end, with no manual intervention: both potions fired correctly
    // (index 0 then 1) purely through `scripts/liveRun.ts`'s own policy,
    // healing 12/36->32/36 then 18/36->36/36; died room 3. Clean model
    // matched every exchange across both, 0 clean failures, now 15
    // confirmed deaths.
    // [live, 2026-08-16/17] The takeover run (resumed and completed via
    // liveRun.ts, STATE.md session 17): rooms 1-3 cleared, died room 4, both
    // configured Big Heal Juice potions fired correctly at HP thresholds on
    // a run the bot resumed rather than started — confirms the potion policy's
    // remaining/used state, seeded fresh in main(), is safe to assume even on
    // a resumed run. Clean model matched every exchange again, 0 clean
    // failures, now 16 confirmed deaths.
    expect(report.sideUpdates).toBe(828);
    expect(report.matched).toBeGreaterThanOrEqual(126);
  });
});
