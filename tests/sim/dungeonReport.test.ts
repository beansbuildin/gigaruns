/**
 * tests/sim/dungeonReport.test.ts — [session 30] run-visibility reporting,
 * dungeon half. `CorpusState.run` is irrelevant to `summarizeDungeonAttempt`
 * (it only reads `entity`/`gameItemBalanceChanges`, and takes `room`/
 * `playerDied` directly) — fixtures below cast a stub for it rather than
 * building a full combat state, same minimal-fixture convention
 * `tests/sim/fishingCorpus.test.ts` uses for its synthetic docs.
 */

import { describe, expect, it } from "vitest";

import type { CorpusState, WireRun } from "../../src/sim/corpus.js";
import {
  buildDungeonMarkdown,
  summarizeDungeonAttempt,
  ITEM_HARD_CORE,
  ITEM_DENDREN_REMNANT,
  type DungeonAttemptInput,
} from "../../src/sim/dungeonReport.js";

const STUB_RUN = {} as WireRun;

function state(opts: {
  entity?: CorpusState["entity"];
  gameItemBalanceChanges?: CorpusState["gameItemBalanceChanges"];
}): CorpusState {
  return {
    label: "test/state-000.json",
    run: STUB_RUN,
    entity: opts.entity ?? null,
    gameItemBalanceChanges: opts.gameItemBalanceChanges ?? [],
  };
}

describe("summarizeDungeonAttempt — a death in a known room", () => {
  it("produces the right outcome, reward totals, juiced flag and energy", () => {
    const attempt: DungeonAttemptInput = {
      cid: 111,
      dirs: ["run-test"],
      room: 3,
      playerDied: true,
      states: [
        state({ entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 1, COMPLETE_CID: false } }),
        state({
          entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 2, COMPLETE_CID: false },
          gameItemBalanceChanges: [{ id: ITEM_HARD_CORE, amount: 56 }],
        }),
        state({
          entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 3, COMPLETE_CID: false },
          gameItemBalanceChanges: [{ id: ITEM_DENDREN_REMNANT, amount: 5 }],
        }),
      ],
    };

    const record = summarizeDungeonAttempt(attempt, 20);
    expect(record.outcome).toEqual({ kind: "death", room: 3 });
    expect(record.juiced).toBe(false);
    expect(record.hardCoreEarned).toBe(56);
    expect(record.dendrenRemnantEarned).toBe(5);
    expect(record.energySpent).toBe(20);
  });

  it("charges 3x energy and reports juiced when WANTS_JUICED_MODE_CID is true — NOT the always-on IS_JUICED_CID (session 30 correction)", () => {
    const attempt: DungeonAttemptInput = {
      cid: 222,
      dirs: ["run-test"],
      room: 2,
      playerDied: true,
      states: [
        // IS_JUICED_CID true (the account buff, always on) but WANTS_JUICED_MODE_CID false — must NOT count as juiced.
        state({ entity: { IS_JUICED_CID: true, WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 1, COMPLETE_CID: false } }),
      ],
    };
    expect(summarizeDungeonAttempt(attempt, 20).juiced).toBe(false);
    expect(summarizeDungeonAttempt(attempt, 20).energySpent).toBe(20);

    const juicedAttempt: DungeonAttemptInput = {
      ...attempt,
      cid: 223,
      states: [state({ entity: { IS_JUICED_CID: true, WANTS_JUICED_MODE_CID: true, ROOM_NUM_CID: 1, COMPLETE_CID: false } })],
    };
    expect(summarizeDungeonAttempt(juicedAttempt, 20).juiced).toBe(true);
    expect(summarizeDungeonAttempt(juicedAttempt, 20).energySpent).toBe(60);
  });
});

describe("summarizeDungeonAttempt — a CLEARED run (fabricated, never observed live)", () => {
  it("renders as CLEARED instead of crashing on an unhandled case", () => {
    const attempt: DungeonAttemptInput = {
      cid: 333,
      dirs: ["run-test"],
      room: 16,
      playerDied: false,
      states: [state({ entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 16, COMPLETE_CID: true } })],
    };
    const record = summarizeDungeonAttempt(attempt, 20);
    expect(record.outcome).toEqual({ kind: "cleared" });

    const markdown = buildDungeonMarkdown([record], { generatedAt: "TEST" });
    expect(markdown).toContain("CLEARED");
    expect(markdown).toContain("1 cleared");
  });

  it("does NOT report cleared merely for reaching room 16 without COMPLETE_CID — the room isn't finished yet", () => {
    const attempt: DungeonAttemptInput = {
      cid: 334,
      dirs: ["run-test"],
      room: 16,
      playerDied: false,
      states: [state({ entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 16, COMPLETE_CID: false } })],
    };
    expect(summarizeDungeonAttempt(attempt, 20).outcome).toEqual({ kind: "incomplete", lastRoom: 16 });
  });
});

describe("summarizeDungeonAttempt — an incomplete/stopped capture", () => {
  it("reports incomplete with the last known room when the player neither died nor cleared", () => {
    const attempt: DungeonAttemptInput = {
      cid: 444,
      dirs: ["run-test"],
      room: 2,
      playerDied: false,
      states: [state({ entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 2, COMPLETE_CID: false } })],
    };
    expect(summarizeDungeonAttempt(attempt, 20).outcome).toEqual({ kind: "incomplete", lastRoom: 2 });
  });
});

describe("buildDungeonMarkdown", () => {
  it("renders a death-room histogram line and a per-run table row for each record", () => {
    const records = [
      summarizeDungeonAttempt(
        { cid: 1, dirs: ["a"], room: 4, playerDied: true, states: [state({ entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 4, COMPLETE_CID: false } })] },
        20,
      ),
      summarizeDungeonAttempt(
        { cid: 2, dirs: ["b"], room: 4, playerDied: true, states: [state({ entity: { WANTS_JUICED_MODE_CID: false, ROOM_NUM_CID: 4, COMPLETE_CID: false } })] },
        20,
      ),
    ];
    const markdown = buildDungeonMarkdown(records, { generatedAt: "TEST" });
    expect(markdown).toContain("- room 4: ██ 2");
    expect(markdown).toContain("| 1 | death @ room 4 |");
    expect(markdown).toContain("| 2 | death @ room 4 |");
    expect(markdown).toContain('"Dendren Remnant"');
  });
});
