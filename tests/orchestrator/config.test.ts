/**
 * tests/orchestrator/config.test.ts — loadBotConfig, against temp fixtures.
 *
 * Deliberately does NOT read the real config/discovered.json — that file is
 * gitignored (generated locally by `npm run probe`) and won't exist on a
 * fresh clone or in CI, so a test that depended on it would pass on this
 * machine and fail everywhere else.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadBotConfig, MissingConfigError } from "../../src/orchestrator/config.js";

let dir: string;
let botPath: string;
let discoveredPath: string;

const validBot = {
  forbiddenWoods: { dailyEnergyBudget: 60, maxRunsPerSession: 3 },
  guards: { maxConsecutiveActionFailures: 3 },
};

const validDiscovered = {
  forbiddenWoods: { id: 5, energyCost: 20, maxRoom: 16, maxRunsPerDay: 12 },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gigaruns-config-test-"));
  botPath = join(dir, "bot.json");
  discoveredPath = join(dir, "discovered.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadBotConfig", () => {
  it("merges bot.json (user-editable) and discovered.json (generated) into one config", () => {
    writeFileSync(botPath, JSON.stringify(validBot));
    writeFileSync(discoveredPath, JSON.stringify(validDiscovered));

    expect(loadBotConfig(botPath, discoveredPath)).toEqual({
      dungeonId: 5,
      energyCostPerRun: 20,
      maxRoom: 16,
      maxRunsPerDayGame: 12,
      dailyEnergyBudget: 60,
      maxRunsPerSession: 3,
      maxConsecutiveActionFailures: 3,
    });
  });

  it("fails closed with MissingConfigError when bot.json is absent", () => {
    writeFileSync(discoveredPath, JSON.stringify(validDiscovered));
    expect(() => loadBotConfig(botPath, discoveredPath)).toThrow(MissingConfigError);
  });

  it("fails closed with MissingConfigError when discovered.json is absent — never falls back to a guessed number", () => {
    writeFileSync(botPath, JSON.stringify(validBot));
    expect(() => loadBotConfig(botPath, discoveredPath)).toThrow(MissingConfigError);
  });

  it("throws on a bot.json that doesn't match the schema, rather than reading partial data", () => {
    writeFileSync(botPath, JSON.stringify({ forbiddenWoods: { dailyEnergyBudget: "sixty" } }));
    writeFileSync(discoveredPath, JSON.stringify(validDiscovered));
    expect(() => loadBotConfig(botPath, discoveredPath)).toThrow();
  });
});
