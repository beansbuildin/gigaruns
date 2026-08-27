/**
 * tests/orchestrator/dungeonArmClosed.test.ts — CLAUDE.md rule 11, session 54.
 *
 * Rule 11 makes every dungeon run a 60-energy juiced entry needing explicit
 * per-run human approval, which an autonomous loop cannot give — so
 * `scripts/orchestrator.ts` must not be able to start one.
 *
 * [session 104] The standing ENTRY TIER moved Tier-3 -> Tier-1 (`index: 1`,
 * `inputItems: []`, no gold rings spent). Only the tier changed; the
 * approval requirement and the 3-run-unit charge did not.
 *
 * The specific bug this file exists to make impossible (session 24's incident,
 * one edit away from repeating): `orchestrator.ts`'s `resolvePotionLoadout`
 * gated on `config.potions` ALONE, while `liveRun.ts`'s `main()` gates on the
 * config block AND `--juiced`. The orchestrator also called `runOnce` with no
 * `juicedStartRun`. Making `forbiddenWoods.potions` permanent (rule 11) while
 * both were true would have loaded 3 Big Heal Juices into a plain 20-energy
 * run on the next invocation.
 *
 * These are SOURCE-level assertions on purpose. The invariant is about which
 * code paths EXIST, not about what one call returns, and a behavioural test
 * cannot see a path that is merely unreachable today.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { nextAction, type EnergyState, type ModeBudget } from "../../src/orchestrator/scheduler.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(REPO_ROOT, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(REPO_ROOT, rel)).isDirectory()) out.push(...tsFilesUnder(rel));
    else if (entry.endsWith(".ts")) out.push(rel);
  }
  return out;
}

const SOURCE_FILES = [...tsFilesUnder("scripts"), ...tsFilesUnder("src")];
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

/**
 * Comments are stripped before the "must not reference" checks, because
 * `orchestrator.ts`'s header DELIBERATELY names every deleted symbol — a
 * comment that keeps its reason survives being edited by someone in a hurry
 * (and a test that forbids naming the thing you deleted forces the reason
 * out of the file).
 */
const readCode = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("rule 11 — the potion/juiced invariant, stated over the whole source tree", () => {
  /**
   * Stated precisely, because the obvious phrasing is FALSE of a legitimate
   * path: `liveRun.ts --potions=N --resume-existing` deliberately builds a
   * potion policy without `--juiced`, because that run's consumables were
   * already committed server-side by whoever started it. What must never
   * exist again is a path that AUTO-DERIVES a loadout from the config
   * allowlist without requiring juiced.
   */
  it("only scripts/liveRun.ts ever constructs a potionPolicy", () => {
    const constructors = SOURCE_FILES.filter((f) => /potionPolicy(State)?\s*(=|:)\s*(\{|$)/m.test(read(f)) || /potionPolicy:\s*\{/.test(read(f)));
    expect(constructors).toEqual(["scripts/liveRun.ts"]);
  });

  it("liveRun.ts's auto-derive-from-config branch is gated on --juiced", () => {
    const src = read("scripts/liveRun.ts");
    // The allowlist read (`config.potions.maxPerRun` + the live balance) must
    // sit AFTER a `!args.juiced` early-out in the same if/else chain.
    const juicedGate = src.indexOf("} else if (!args.juiced) {");
    const allowlistRead = src.indexOf("config.potions.maxPerRun");
    expect(juicedGate).toBeGreaterThan(0);
    expect(allowlistRead).toBeGreaterThan(juicedGate);
  });

  it("orchestrator.ts contains no dungeon-run machinery at all", () => {
    const src = readCode("scripts/orchestrator.ts");
    for (const forbidden of ["resolvePotionLoadout", "potionPolicy", "startConsumables", "runOnce(", "dungeonBudgetSnapshot"]) {
      expect(src, `orchestrator.ts must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("orchestrator.ts's dungeon branch fails closed and names rule 11", () => {
    const src = read("scripts/orchestrator.ts");
    expect(src).toContain('throw new Error(`scheduler returned {kind: "dungeon"}');
    expect(src).toContain("rule 11");
    expect(src).toContain("scripts/liveRun.ts --juiced --juiced-index=1 --runs=1");
  });

  it("no operator-facing hint still recommends the retired Tier-3 entry", () => {
    // [session 104] The switch to Tier-1 is a policy the operator reads off a
    // printed command line, so a stale hint IS the bug — nothing in code
    // defaults the index (`--juiced-index` is required and never guessed), and
    // a human copying `--juiced-index=3` would spend seven gold rings that the
    // directive exists to conserve.
    //
    // `index` is the TIER, not an array position: `entryData` comes back
    // ordered tier 2, 1, 3 (SPEC §3c), so nothing here may be "fixed" by
    // reasoning about array offsets.
    for (const rel of SOURCE_FILES) {
      expect(read(rel), `${rel} still recommends the retired Tier-3 entry`).not.toContain("--juiced-index=3");
    }
  });

  it("orchestrator.ts does not take the dungeon-side locks liveRun.ts needs", () => {
    // Holding these for an 8-hour session would refuse every approved rule-11
    // run for its whole duration — and with the arm closed this process never
    // writes any of the three files.
    const src = read("scripts/orchestrator.ts");
    expect(src).toContain("guard-budget-fishing.json");
    expect(src).not.toContain("acquireGuardLock(DEFAULT_GUARD_STATE_PATH)");
    expect(src).not.toContain("acquireGuardLock(DEFAULT_OPPONENT_MODEL_PATH)");
    expect(src).not.toContain("acquireGuardLock(DEFAULT_PLAY_COUNTS_PATH)");
    expect(src).not.toContain("guard-budget.json");
    expect(src).not.toContain("opponent-model.json");
    expect(src).not.toContain("play-counts.json");
    // The FISHING lock is still taken — the arm that still runs.
    //
    // [session 59] Was pinned to the literal `FISHING_GUARD_STATE_PATH`. The
    // profile seam renamed that call site to a profile-resolved
    // `fishingGuardPath`, which broke the string match while the PROPERTY —
    // fishing lock taken, dungeon locks not — was untouched. Re-pinned on the
    // fishing FILE NAME instead of the identifier, so the next rename of a
    // variable does not read as the arm reopening. The three `not.toContain`
    // lines above now check file names too, for the same reason: an identifier
    // is a spelling, a file name is the thing that actually gets locked.
  });
});

describe("rule 11 — a closed dungeon arm must not stop fishing", () => {
  const energy = (value: number): EnergyState => ({ value, max: 420, regenPerHour: 18 });
  const fishing = (overrides: Partial<ModeBudget> = {}): ModeBudget => ({
    costPerAction: 5,
    dailyEnergyBudget: 100,
    energySpentToday: 0,
    maxActionsPerSession: 20,
    actionsToday: 0,
    ...overrides,
  });

  it("fishes when the dungeon arm is null and fishing has budget", () => {
    expect(nextAction(energy(200), null, fishing())).toEqual({ kind: "fishing" });
  });

  it("does NOT return done while fishing still has budget, even at zero real energy", () => {
    // The obvious way this change goes wrong: a null dungeon arm short-
    // circuiting to `done` and silently ending every fishing session.
    const decision = nextAction(energy(0), null, fishing());
    expect(decision.kind).toBe("sleep");
    if (decision.kind === "sleep") expect(decision.targetEnergy).toBe(5);
  });

  it("never sleeps waiting for dungeon energy it will never spend", () => {
    // With a real dungeon budget this would target 60 (or 20); with the arm
    // closed the only target that can appear is fishing's own cost.
    const decision = nextAction(energy(1), null, fishing({ costPerAction: 5 }));
    if (decision.kind === "sleep") expect(decision.targetEnergy).toBe(5);
    else expect.fail(`expected sleep, got ${decision.kind}`);
  });

  it("returns done only once fishing itself is exhausted", () => {
    const decision = nextAction(energy(200), null, fishing({ actionsToday: 20 }));
    expect(decision.kind).toBe("done");
  });
});
