/**
 * tests/orchestrator/opponentModelPersistence.test.ts — CODEXIMPROVE #1
 * (session 32).
 *
 * Same isolation discipline as `guardPersistence.test.ts`: a fresh
 * `mkdtempSync` dir + explicit path param per test, never the real
 * `data/opponent-model.json`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  bootstrapFromCorpus,
  loadOpponentModel,
  OpponentModelPersistenceError,
  OPPONENT_MODEL_SCHEMA_VERSION,
  saveOpponentModelAtomically,
} from "../../src/orchestrator/opponentModelPersistence.js";
import { loadCorpus } from "../../src/sim/corpus.js";
import { noRolled } from "../../src/sim/types.js";
import { OpponentModel } from "../../src/strategy/opponentModel.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gigaruns-opponent-model-test-"));
  path = join(dir, "opponent-model.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadOpponentModel", () => {
  it("returns a fresh blank model and empty bootstrap set when nothing is on disk yet", () => {
    const { model, bootstrapImportedIds } = loadOpponentModel(path);
    expect(model.observations("enemy1|room1")).toBe(0);
    expect(bootstrapImportedIds.size).toBe(0);
  });

  // CLAUDE.md §5 — fail CLOSED, not open. A corrupted record of learned
  // evidence silently forgotten is worse than no record, because it gets
  // trusted — same bug class CODEXREVIEW #2 fixed for guard-budget
  // persistence (guardPersistence.test.ts, "throws ... on corrupt JSON").
  it("throws OpponentModelPersistenceError on corrupt JSON in an EXISTING file — does not silently reset to a blank model", () => {
    writeFileSync(path, "{not valid json");
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });

  it("throws OpponentModelPersistenceError on a file that parses but doesn't match the expected shape", () => {
    writeFileSync(path, JSON.stringify({ totally: "wrong shape" }));
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });

  it("throws OpponentModelPersistenceError on a schemaVersion mismatch — rejected, not silently misread", () => {
    writeFileSync(
      path,
      JSON.stringify({ schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION + 1, keys: {}, bootstrapImportedIds: [] }),
    );
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });

  // [session 37, CODEXAUDIT #6] A real observation count can never be
  // negative or fractional — `observe()` only ever increments by 1. A
  // persisted file carrying either is corruption, not an unusual-but-valid
  // count, and must fail closed the same way a bad schemaVersion does.
  const zeroKey = { total: { rock: 0, paper: 0, scissor: 0 }, transitions: { rock: { rock: 0, paper: 0, scissor: 0 }, paper: { rock: 0, paper: 0, scissor: 0 }, scissor: { rock: 0, paper: 0, scissor: 0 } } };

  it("throws OpponentModelPersistenceError on a negative count", () => {
    const keys = { "enemy1|room1": { ...zeroKey, total: { rock: -1, paper: 0, scissor: 0 } } };
    writeFileSync(path, JSON.stringify({ schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION, keys, bootstrapImportedIds: [] }));
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });

  it("throws OpponentModelPersistenceError on a fractional count", () => {
    const keys = { "enemy1|room1": { ...zeroKey, total: { rock: 1.5, paper: 0, scissor: 0 } } };
    writeFileSync(path, JSON.stringify({ schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION, keys, bootstrapImportedIds: [] }));
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });

  // A transition FROM move X can only be recorded on a turn where X was
  // ALSO the move played, so a row's sum can never exceed X's own marginal
  // count — structurally impossible under `observe()`'s own accounting.
  it("throws OpponentModelPersistenceError when a transition row's sum exceeds its marginal predecessor count", () => {
    const keys = {
      "enemy1|room1": {
        total: { rock: 1, paper: 0, scissor: 0 }, // "rock" was only ever played once...
        transitions: {
          rock: { rock: 0, paper: 5, scissor: 0 }, // ...but 5 transitions are claimed FROM it
          paper: { rock: 0, paper: 0, scissor: 0 },
          scissor: { rock: 0, paper: 0, scissor: 0 },
        },
      },
    };
    writeFileSync(path, JSON.stringify({ schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION, keys, bootstrapImportedIds: [] }));
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });

  it("accepts a transition row whose sum is exactly equal to its marginal predecessor count (boundary, not corruption)", () => {
    const keys = {
      "enemy1|room1": {
        total: { rock: 5, paper: 0, scissor: 0 },
        transitions: {
          rock: { rock: 0, paper: 5, scissor: 0 }, // every rock play transitioned onward — legitimate if none was the battle's last move
          paper: { rock: 0, paper: 0, scissor: 0 },
          scissor: { rock: 0, paper: 0, scissor: 0 },
        },
      },
    };
    writeFileSync(path, JSON.stringify({ schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION, keys, bootstrapImportedIds: [] }));
    expect(() => loadOpponentModel(path)).not.toThrow();
  });
});

describe("saveOpponentModelAtomically", () => {
  it("round-trips through loadOpponentModel", () => {
    const model = new OpponentModel();
    model.observe("enemy1|room1", "rock", null);
    model.observe("enemy1|room1", "paper", "rock");
    const ids = new Set(["run-a::state-001.json→state-002.json"]);

    saveOpponentModelAtomically(model, ids, path);

    const loaded = loadOpponentModel(path);
    expect(loaded.model.toJSON()).toEqual(model.toJSON());
    expect(loaded.bootstrapImportedIds).toEqual(ids);
  });

  it("creates the parent directory if it doesn't exist", () => {
    const nested = join(dir, "nested", "opponent-model.json");
    saveOpponentModelAtomically(new OpponentModel(), new Set(), nested);
    expect(existsSync(nested)).toBe(true);
  });

  // [CODEXIMPROVE #1, requirement 3] Atomic write: no sibling temp file
  // should ever be left behind by a clean save, same discipline as
  // guardPersistence.ts's saveGuardBudget.
  it("writes through a temp file and renames it into place — no temp file survives a clean save", () => {
    saveOpponentModelAtomically(new OpponentModel(), new Set(), path);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ schemaVersion: OPPONENT_MODEL_SCHEMA_VERSION });
  });
});

// [CODEXIMPROVE #1, requirement 6] The specific regression this task asked
// for by name: the model must survive a restart, and a corrupt file must
// fail closed rather than silently reset to blank.
describe("restart and corrupt-model regressions", () => {
  it("a model's predictions survive a simulated process restart", () => {
    const before = new OpponentModel();
    // Clear the 30-observation floor so `predict()` returns a real
    // (non-uniform-below-floor) read worth comparing.
    for (let i = 0; i < 40; i++) before.observe("enemy63|room1", "rock", null);
    for (let i = 0; i < 5; i++) before.observe("enemy63|room1", "paper", null);

    saveOpponentModelAtomically(before, new Set(), path);

    // "Restart" — a fresh process would construct nothing but call
    // loadOpponentModel, exactly like this.
    const { model: after } = loadOpponentModel(path);

    const move = { atk: 1, def: 0, charges: 3, maxCharges: 3 };
    const foe = { id: "enemy63", hp: 10, hpMax: 10, armor: 0, armorMax: 0, moves: { rock: move, paper: move, scissor: move }, rolled: noRolled() };
    const beforePrediction = before.predict(foe, 1, { chargesAreHardLimit: true });
    const afterPrediction = after.predict(foe, 1, { chargesAreHardLimit: true });
    expect(afterPrediction).toEqual(beforePrediction);
    expect(afterPrediction.confidence).toBe("high"); // proves this isn't a vacuous below-floor comparison
  });

  it("a corrupt file on disk fails closed on the next 'process start' rather than silently returning a blank model", () => {
    // A legitimate prior save...
    const model = new OpponentModel();
    model.observe("enemy63|room1", "rock", null);
    saveOpponentModelAtomically(model, new Set(), path);
    // ...then the file gets corrupted on disk (truncated write, bad edit, etc).
    writeFileSync(path, readFileSync(path, "utf8").slice(0, -5));
    expect(() => loadOpponentModel(path)).toThrow(OpponentModelPersistenceError);
  });
});

describe("bootstrapFromCorpus", () => {
  it("imports at least one clean exchange from the real fixture corpus", () => {
    const model = new OpponentModel();
    const ids = new Set<string>();
    const { imported } = bootstrapFromCorpus(model, ids, loadCorpus());
    expect(imported).toBeGreaterThan(0);
    expect(ids.size).toBe(imported);
  });

  it("is idempotent — a second call against the same corpus imports nothing new", () => {
    const model = new OpponentModel();
    const ids = new Set<string>();
    const first = bootstrapFromCorpus(model, ids, loadCorpus());
    const totalAfterFirst = [...ids].length;
    const second = bootstrapFromCorpus(model, ids, loadCorpus());
    expect(first.imported).toBeGreaterThan(0);
    expect(second.imported).toBe(0);
    expect(ids.size).toBe(totalAfterFirst); // no growth, no double count
  });

  it("survives a restart — reloading persisted bootstrapImportedIds prevents re-importing the same fixtures", () => {
    const model1 = new OpponentModel();
    const ids1 = new Set<string>();
    const { imported: firstImport } = bootstrapFromCorpus(model1, ids1, loadCorpus());
    saveOpponentModelAtomically(model1, ids1, path);

    // "Restart": fresh process, loads what was persisted, bootstraps again.
    const { model: model2, bootstrapImportedIds: ids2 } = loadOpponentModel(path);
    const { imported: secondImport } = bootstrapFromCorpus(model2, ids2, loadCorpus());

    expect(firstImport).toBeGreaterThan(0);
    expect(secondImport).toBe(0); // already-imported identities are skipped, not re-counted
    expect(model2.toJSON()).toEqual(model1.toJSON()); // no double-observation drift either
  });
});
