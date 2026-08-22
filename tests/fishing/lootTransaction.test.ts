/**
 * tests/fishing/lootTransaction.test.ts — [session 79 §3] the loot pick under
 * the transaction protocol.
 *
 * Session 78 routed every write whose failure could move a DAILY LEDGER and
 * left fishing's four in-cast writes unrouted. `loot` is the one of the four
 * that was worth routing, and not for the ledger reason — no ledger moves
 * here. It is the only in-cast write that is BOTH irreversible and
 * recoverable:
 *
 *   - irreversible, because it grows `fullDeck` permanently and an unresolved
 *     offer strands the account (every later `start_run` fails with "Player is
 *     already in a game" — session 17, QUESTIONS.md §10);
 *   - recoverable, because it is the LAST action of a cast, so the
 *     action-token chain a mid-cast failure desyncs (session 65, cast
 *     13019682) no longer matters.
 *
 * The behaviour that changed: an APPLIED-but-lost loot used to throw
 * `GuardTrip("fishing loot rejected")` — telling the caller the account was
 * stranded when the pick had landed and it was fine. All three outcomes are
 * pinned below, because the dangerous one is silent.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runOneCast } from "../../scripts/liveFishing.js";
import { fakeDoc } from "../helpers/fishingDoc.js";
import { makeLiveFishingDeps } from "../helpers/liveFishingDeps.js";
import { GuardState } from "../../src/orchestrator/guards.js";
import type { BotConfig } from "../../src/orchestrator/config.js";
import type { GigaverseClient } from "../../src/api/client.js";

const CONFIG: BotConfig = {
  dungeonId: 5,
  energyCostPerRun: 20,
  maxRoom: 16,
  maxRunsPerDayGame: 12,
  dailyEnergyBudget: 240,
  maxRunsPerSession: 12,
  maxConsecutiveActionFailures: 3,
  dendren: { nodeId: "5", tierId: 1, energyCostPerCast: 12, maxCastsPerDayGame: 20, dailyEnergyBudget: 240, maxCastsPerSession: 20 },
};

/** A caught, complete cast with an UNRESOLVED three-card offer — the stranding state. */
function strandedDoc(extra: Record<string, unknown> = {}) {
  return fakeDoc({
    docId: "77777777",
    complete: true,
    success: true,
    extraData: {
      cardsToAdd: [
        { id: 25, manaCost: 1, hitZones: [1, 2, 3], critZones: [], hitEffects: [{ type: "FISH_HP", amount: 5 }], critEffects: [], missEffects: [], rarity: 4 },
        { id: 17, manaCost: 1, hitZones: [4, 5, 6], critZones: [], hitEffects: [{ type: "FISH_HP", amount: 3 }], critEffects: [], missEffects: [], rarity: 1 },
      ],
      cardChosenId: null,
      fullDeck: [1, 2, 3],
      ...extra,
    },
  });
}

/** The same cast AFTER the pick landed — `cardChosenId` set and the deck grown. */
function resolvedDoc() {
  return strandedDoc({ cardChosenId: 25, fullDeck: [1, 2, 3, 25] });
}

let dir: string;
let events: Record<string, unknown>[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gigaruns-loot-tx-"));
  events = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/**
 * Every I/O path isolated (CLAUDE.md working style — a test must never write a
 * real data path; this bug class has shipped four times).
 */
function deps(client: GigaverseClient) {
  return makeLiveFishingDeps({
    client,
    config: CONFIG,
    guards: new GuardState({ dailyEnergyBudget: 240, maxRunsPerSession: 20, maxConsecutiveActionFailures: 3 }),
    log: { write: (e: Record<string, unknown>) => events.push(e), filePath: "test.jsonl" } as never,
    transitionsPath: join(dir, "fish-patterns.jsonl"),
    guardStatePath: join(dir, "guard-budget-fishing.json"),
    nextPositionLogPath: join(dir, "nextPositionValidation.jsonl"),
    ringPredictionLogPath: join(dir, "ringPrediction.jsonl"),
    oilCastStatePath: join(dir, "oil-cast-states.jsonl"),
    nextPositionArmStatePath: join(dir, "nextPositionOverrideDisarm.json"),
    logsDir: join(dir, "logs"),
  });
}

/**
 * A client whose `loot` POST always fails, and whose `GET /fishing/state`
 * returns `stateAfterLoot` once the loot has been attempted.
 *
 * `start_run` fails too, deliberately: this file is about what happens to the
 * LOOT, and letting the run continue would drag a whole cast's machinery into
 * an assertion about one write. The start_run rejection is the marker that
 * says "loot recovery returned rather than throwing".
 */
function makeClient(opts: { stateAfterLoot: unknown | (() => never) }): { client: GigaverseClient; posted: string[] } {
  const posted: string[] = [];
  let lootAttempted = false;
  const client = {
    getFishingActionToken: () => "tok",
    getFishingState: async () => {
      if (!lootAttempted) return { gameState: strandedDoc() };
      if (typeof opts.stateAfterLoot === "function") (opts.stateAfterLoot as () => never)();
      return { gameState: opts.stateAfterLoot };
    },
    postFishingAction: async (body: { action: string }) => {
      posted.push(body.action);
      if (body.action === "loot") {
        lootAttempted = true;
        throw new Error("HTTP 500 — loot blew up");
      }
      throw new Error("HTTP 500 — start_run blew up");
    },
  } as unknown as GigaverseClient;
  return { client, posted };
}

describe("loot — APPLIED despite the error (the outcome that used to be reported as a stranded account)", () => {
  it("does not throw for the loot, logs the reconciliation, and lets the run continue", async () => {
    const { client, posted } = makeClient({ stateAfterLoot: resolvedDoc() });

    // start_run's own rejection is what surfaces — i.e. the loot did NOT throw.
    await expect(runOneCast(deps(client))).rejects.toThrow(/start_run rejected/);

    expect(posted).toEqual(["loot", "start_run"]);
    const reconciled = events.find((e) => e.event === "loot_applied_response_lost");
    expect(reconciled).toBeDefined();
    expect(reconciled!.cardChosenId).toBe(25);
    expect(reconciled!.fullDeck).toBe(4);
    // The pre-session-79 behaviour, which must not come back.
    expect(events.some((e) => e.reason === "loot rejected")).toBe(false);
  });
});

describe("loot — PROVABLY not applied", () => {
  it("throws the rejection, because the account really is left stranded", async () => {
    const { client, posted } = makeClient({ stateAfterLoot: strandedDoc() });

    await expect(runOneCast(deps(client))).rejects.toThrow(/loot rejected/);

    expect(posted).toEqual(["loot"]);
    expect(events.some((e) => e.reason === "loot rejected")).toBe(true);
    expect(events.some((e) => e.event === "loot_applied_response_lost")).toBe(false);
  });
});

describe("loot — UNKNOWN, which must fail closed and never guess", () => {
  it("throws an UNKNOWN-specific trip when the server cannot be re-read", async () => {
    const { client, posted } = makeClient({
      stateAfterLoot: (() => {
        throw new Error("HTTP 503 — state unreadable");
      }) as unknown as () => never,
    });

    // CLAUDE.md rule 5 / rule 13: neither proven, so a human reads the ledger.
    await expect(runOneCast(deps(client))).rejects.toThrow(/loot outcome UNKNOWN/);

    expect(posted).toEqual(["loot"]);
    const unknown = events.find((e) => e.event === "loot_outcome_unknown");
    expect(unknown).toBeDefined();
    // The report has to say WHY the server was unreadable, not just that it was.
    expect(JSON.stringify(unknown)).toMatch(/503/);
  });

  it("a doc for a DIFFERENT cast proves nothing either way", async () => {
    // Neither predicate accepts it: same-cast identity is what makes
    // `cardChosenId` and `fullDeck` mean anything at all.
    const { client } = makeClient({ stateAfterLoot: fakeDoc({ docId: "88888888", complete: true, success: true }) });
    await expect(runOneCast(deps(client))).rejects.toThrow(/loot outcome UNKNOWN/);
  });
});
