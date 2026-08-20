/**
 * tests/discoveredShipsClean.test.ts — session 60.
 *
 * `config/discovered.json` came off `.gitignore` this session so that it ships:
 * Forbidden Woods is dungeon 5 and `maxRoom` 16 for everyone, and making each
 * new user re-run `probe.ts` to rediscover facts that cannot differ between
 * them is pure friction.
 *
 * **It was not safe to ship as it stood, and that is the point of this file.**
 * The file carried a `roms` block holding `knownRomIds` and a 37-entry
 * enumeration of the author's ROM NFTs — the same identifier class session 54
 * spent 2,726 fixture files removing. Shipping it whole would have re-imported
 * that class into the one config file every user is told to keep. The ids moved
 * to the profile's `romsPath` (`data/roms.json`, gitignored); the game-global
 * knowledge stayed.
 *
 * So this is a test about what a file may CONTAIN, in the same spirit as
 * `tests/clientSurface.test.ts` (what may exist) and
 * `tests/noHardcodedPaths.test.ts` (what may be named). The split is only worth
 * anything if it cannot silently come undone — the natural way for it to come
 * undone is a future probe script writing its whole response back into this
 * file, which is exactly what created the block in the first place.
 *
 * Reads two real repo files and writes nothing.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const DISCOVERED = "config/discovered.json";

/** Every scalar in the file, with its dotted path, so failures name the key. */
function scalars(node: unknown, path: string[] = []): Array<{ path: string; value: unknown }> {
  if (node === null || typeof node !== "object") return [{ path: path.join("."), value: node }];
  if (Array.isArray(node)) return node.flatMap((v, i) => scalars(v, [...path, String(i)]));
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => scalars(v, [...path, k]));
}

describe("config/discovered.json is safe to ship", () => {
  const raw = readFileSync(DISCOVERED, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  it("still carries the game-global facts that are the reason to ship it", () => {
    // If the scrub ever overshoots, this fails before the identifier checks do.
    const fw = parsed.forbiddenWoods as Record<string, unknown>;
    expect(fw.id).toBe(5);
    expect(fw.maxRoom).toBe(16);
    expect(fw.maxRunsPerDay).toBe(12);
    expect((parsed.dendren as Record<string, unknown>).pondId).toBe(2);
    // The ROM knowledge is game-global and must survive the split.
    const roms = parsed.roms as Record<string, unknown>;
    expect(roms.endpoint).toBe("POST /api/roms/factory-claim");
    expect(roms.requestShape).toBeDefined();
    expect(roms.amountFieldBehavior).toBeDefined();
  });

  it("carries no wallet address or long hex identifier", () => {
    expect(raw.match(/0x[0-9a-fA-F]{20,}/g) ?? []).toEqual([]);
  });

  it("carries none of the account's ROM token ids", () => {
    // The ids are stored as SHA-256 HASHES, and that is the whole point of this
    // block rather than an affectation. `tests/` ships. Writing the four
    // `knownRomIds` plus an enumeration docId as literals here would put the
    // exact five identifiers this split exists to remove into the shipped tree
    // — the check would be guarding the front door while holding the back one
    // open. Reading them from `data/roms.json` instead does not work either:
    // that file is gitignored, so in a fresh clone there is nothing to compare
    // against and the test passes vacuously.
    //
    // So: hash every short integer that appears anywhere in the file and see if
    // any of them is one of the known ids. Ships no id, catches every id, and
    // fails vacuously-open on nothing.
    const KNOWN_ID_HASHES = new Set([
      "f9b4948c344be99703db911d175226b420ddeefd8636929468fbb0fb68ea4694",
      "642c2a0918053df94003e4ea155e30e8bb2aa21b3de45c4797dc146a3fa7ec12",
      "b4a9c08c7e840429f7052b8376845c6f0f03895b369913d4feca19413b27358a",
      "fc4fb94d36f45aa9d13358022455e55db4b6f0eb536a1b2897c90dfd3df9eb9b",
      "6bacb4f243d3b09e9baac7b6f7823282fc16f339e11cf939998d048d1eff4c08",
    ]);
    const offenders = [...new Set(raw.match(/\b\d{3,6}\b/g) ?? [])].filter((n) =>
      KNOWN_ID_HASHES.has(createHash("sha256").update(n).digest("hex")),
    );
    expect(offenders, `a known ROM token id is back in ${DISCOVERED}`).toEqual([]);
  });

  it("has no `roms.knownRomIds` or `roms.allRoms` key, whatever they might hold", () => {
    const roms = parsed.roms as Record<string, unknown>;
    expect(roms).not.toHaveProperty("knownRomIds");
    expect(roms).not.toHaveProperty("allRoms");
    expect(roms).not.toHaveProperty("allRomsSumEnergyCollectable");
  });

  it("carries no bare id list anywhere — the shape the enumeration would return as", () => {
    // A long array of id-ish strings/numbers under a key naming ids. The game's
    // own `inputItems`/`inputAmounts` are short item-id arrays and game-global,
    // so the trigger is length plus an id-ish key, not either alone.
    const offenders: string[] = [];
    const walk = (node: unknown, path: string[]): void => {
      if (node === null || typeof node !== "object") return;
      if (Array.isArray(node)) {
        const key = path[path.length - 1] ?? "";
        if (node.length >= 10 && /id|rom|token|owner|wallet/i.test(key)) offenders.push(path.join("."));
        node.forEach((v, i) => walk(v, [...path, String(i)]));
        return;
      }
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, [...path, k]);
    };
    walk(parsed, []);
    expect(offenders).toEqual([]);
  });

  it("mentions no romId in prose either — the scrub covered the strings, not just the keys", () => {
    // `endpointConfidence` and `cooldown` used to read "romId 2097". Prose is
    // where an identifier hides from a key-shaped check.
    const prose = scalars(parsed)
      .filter((s) => typeof s.value === "string")
      .filter((s) => /romId\s*\d/i.test(s.value as string));
    expect(prose.map((s) => s.path)).toEqual([]);
  });
});

describe("the per-account half stays out of the repo", () => {
  it("data/roms.json is gitignored, so the ids cannot be committed", () => {
    // Asserted against the real `.gitignore` text rather than by shelling out,
    // to keep the test hermetic. `tests/profile.test.ts` already exercises
    // `git check-ignore` for the `profiles/` tree.
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toMatch(/^data\/$/m);
  });

  it("and if it exists locally, it is the file that holds them", () => {
    // Skipped in a fresh clone, which is correct — there is nothing to check.
    if (!existsSync("data/roms.json")) return;
    const roms = JSON.parse(readFileSync("data/roms.json", "utf8")) as Record<string, unknown>;
    expect(Array.isArray(roms.allRoms)).toBe(true);
    expect(Array.isArray(roms.knownRomIds)).toBe(true);
  });
});
