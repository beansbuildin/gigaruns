/**
 * tests/fishing/pConnectConsumers.test.ts — [session 73, brief §1a / GATE 2]
 *
 * **The classified inventory of everything that reads a connect probability,
 * and the ratchet that stops it growing silently.**
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * `pConnect` (= `pHit + pCrit`, the model's belief that the played card's zones
 * will contain the fish) is MONOTONE BUT MISCALIBRATED: session 72 found it
 * predicting 50.0% against 39.8% observed, and `scripts/pConnectBiasDecomposition.ts`
 * re-measures it at 49.7% against 40.3% on the grown corpus. The ordering is
 * right; the LEVEL is wrong by roughly +9pp.
 *
 * That distinction is the whole reason for this file:
 *
 *  - **RANK** consumers are fine. An argmax over cards or placements is
 *    unchanged by an optimism that moves every candidate the same way.
 *  - **LEVEL** consumers are not. Any comparison against a constant — a
 *    threshold, a certainty test, an expected value quoted as a probability —
 *    inherits the bias directly, and a +9pp optimism means the gate fires at
 *    the wrong place.
 *
 * So if a correction is ever fitted, THIS LIST says where it may be applied.
 * Correcting the estimator at source moves the rank-based sites too, where it
 * was doing no harm; correcting only the level-based sites is the targeted
 * option. Neither is chosen here — brief §1c forbids shipping a correction in
 * the session that diagnoses one, and nothing in this file changes behaviour.
 *
 * ── What the ratchet actually enforces ────────────────────────────────────
 *
 * Following `tests/noHardcodedPaths.test.ts`: allowlist by FILE, ratchet by
 * COUNT, and assert the level-based expressions by their own text.
 *
 *  1. A connect-probability read in a file not on the list FAILS. That is the
 *     "new unclassified consumer" case the gate names.
 *  2. A file's site count changing FAILS. A new read inside an already-listed
 *     file is just as unclassified as one in a new file.
 *  3. Every named LEVEL-BASED expression must still literally appear, so the
 *     list cannot rot into a description of code that no longer exists.
 *
 * Keying on counts rather than on each line's text is deliberate: a reformat
 * should not fail a test about consumers. If a count moves, add the new site
 * to the notes below with its class and bump the number — the number is a
 * record, not a target.
 *
 * Reads source text. Writes nothing.
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The connect-probability surface. `pHit`/`pCrit`/`pAnyHit` are the raw parts,
 * `pConnect` their sum, and `bestConnectProbability*`/`bestKillProbability` the
 * two named quantities the oil gates derive from them.
 *
 * `ev` is deliberately NOT scanned even though it is a linear function of
 * `pHit`/`pCrit`. It is a different quantity in different units (fishHp
 * damage), read by a great deal of reporting, and expanding the scan to it
 * would bury the eight sites that matter. Its ONE level-based consumer,
 * `shouldRedraw`'s `ev < redrawThreshold`, is named below by hand instead.
 */
const PATTERNS = ["pHit", "pCrit", "pAnyHit", "pConnect", "bestConnectProbability", "bestKillProbability"];

const grepArgs = PATTERNS.map((p) => `-e ${JSON.stringify(p)}`).join(" ");

/**
 * `src/` plus the live fishing loop. `scripts/liveFishing.ts` is scanned
 * because it IS the live consumer — leaving it out would classify the library
 * and miss the thing that runs. Analysis scripts are out of scope: they report
 * these numbers and decide nothing.
 */
const SCAN_ROOTS = "src scripts/liveFishing.ts";

interface Site {
  file: string;
  text: string;
}

function scan(): Site[] {
  const out = execSync(`grep -rn --include='*.ts' ${grepArgs} ${SCAN_ROOTS} || true`, { encoding: "utf8" });
  const seen = new Set<string>();
  const sites: Site[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [file, , ...rest] = line.split(":");
    const text = rest.join(":").trim().replace(/\s+/g, " ");
    // Doc blocks and comments name these constantly and correctly.
    if (text.startsWith("*") || text.startsWith("//") || text.startsWith("/*")) continue;
    const key = `${file}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sites.push({ file: file!, text });
  }
  return sites;
}

interface FileEntry {
  /** Distinct code lines mentioning the surface. A ratchet, not a target. */
  sites: number;
  /** What this file does with the quantity, in the rank/level vocabulary. */
  note: string;
}

const CLASSIFIED = new Map<string, FileEntry>([
  [
    "src/strategy/fishing/cardChoice.ts",
    {
      sites: 18,
      note:
        "THE PRODUCER, and both classes at once. `evaluateCardAtFocus` computes pHit/pCrit; " +
        "`ev`, `score`, `evPerMana` and `isPreferred` consume them as RANK (argmax over cards " +
        "and placements — a uniform optimism cancels). `isLethal` and `shouldRedrawOnConnect` " +
        "consume them as LEVEL. See LEVEL_SITES.",
    },
  ],
  [
    "src/strategy/fishing/oilTiming.ts",
    {
      sites: 8,
      note:
        "LEVEL throughout, and LIVE. `killProbabilityWith`/`bestKillProbability` and " +
        "`bestConnectProbabilityFromFrozenCell` fold pHit/pCrit into a single probability that " +
        "`meetsThreshold` then compares against a derived constant. The `Math.max` inside " +
        "`bestConnectProbabilityFromFrozenCell` is a rank, but its RESULT is used as a level, " +
        "which is what the classification follows.",
    },
  ],
  [
    "src/strategy/fishing/oilShadow.ts",
    {
      sites: 10,
      note:
        "REPORT, with two LEVEL certainty checks. The record fields are diagnostics written on " +
        "every firing; the `>= 1` tests raise shadow flags and take no action. A proven live " +
        "no-op (0 of 9 Relaxing firings held), so the bias reaches nothing that plays.",
    },
  ],
  [
    "src/strategy/fishing/oilBatch.ts",
    { sites: 1, note: "REPORT — one assertion message naming `bestKillProbability`. Reads no value." },
  ],
  [
    "src/sim/fishing/offPolicyReplay.ts",
    {
      sites: 5,
      note:
        "REPORT — `ReplayTurn.pConnect`, `pConnectCeiling` and `ReplayTurnDiagnostic.pConnect` are " +
        "carried out for analysis. The replay's own decisions go through `chooseCard`, so this " +
        "file consumes nothing it does not also hand straight to a script.",
    },
  ],
  [
    "scripts/liveFishing.ts",
    {
      sites: 10,
      note:
        "REPORT — every site is a log field or a console line (`pHitPredicted`, the `P_hit x.xx` " +
        "shot line, the shadow's `bestConnect`/`bestKill` strings). The live loop reads no " +
        "connect probability to decide anything; its decisions come from `chooseCard` and " +
        "`oilTiming`, both classified above.",
    },
  ],
]);

/**
 * **The level-based sites, named individually — the gate's actual deliverable.**
 *
 * Each is an expression comparing a connect probability (or a value linear in
 * one) against a constant. These are the ONLY places a +9pp optimism changes an
 * outcome, and the only places a correction would belong.
 */
const LEVEL_SITES: { file: string; contains: string; live: boolean; why: string }[] = [
  {
    file: "src/strategy/fishing/cardChoice.ts",
    contains: "if (pAnyHit < 0.999999) return false;",
    live: true,
    why:
      "`isLethal`'s certainty test, and the most consequential live level consumer in the repo. " +
      "A `lethal` placement is exempt from the focus spend constraint (`bestFocusForCard`: 'A " +
      "LETHAL placement is never blocked') and short-circuits the oil gates, so an optimistic " +
      "p=1 claim buys an override. It sits at the very top of the range, which is exactly where " +
      "the reliability table is worst: the [0.50, 1.01) bucket predicts 72.2% and observes 60.3%.",
  },
  {
    file: "src/strategy/fishing/cardChoice.ts",
    contains: "return pConnect < connectThreshold && mana > redrawCost;",
    live: false,
    why:
      "`shouldRedrawOnConnect`. NOT LIVE — `redrawEnabled` is false and redraw is a closed dead " +
      "end (session 72: 263 mana per extra fish). Listed because the threshold was DERIVED from " +
      "`pFresh`, a mean of this same biased quantity, so the derivation inherits the bias even " +
      "though nothing acts on it.",
  },
  {
    file: "src/strategy/fishing/cardChoice.ts",
    contains: "return bestEv < redrawThreshold && mana > redrawCost;",
    live: false,
    why:
      "`shouldRedraw`, the one `ev`-level consumer, included by hand because `ev` is linear in " +
      "pHit/pCrit and therefore carries the optimism into a threshold comparison. Fires in the " +
      "live loop but is LOGGED, NOT ACTED ON, and `REDRAW_THRESHOLD` is 0.",
  },
  {
    file: "src/strategy/fishing/oilTiming.ts",
    contains: "meetsThreshold(bestConnectProbabilityFromFrozenCell(d), t.focus)",
    live: true,
    why:
      "The FOCUS OIL necessity gate — the site the session-73 brief named. The gate skips the " +
      "oil when it believes it can connect without one, so an optimistic input makes it " +
      "UNDER-FIRE: it declines an oil it needed. Live, and level-based.",
  },
  {
    file: "src/strategy/fishing/oilTiming.ts",
    contains: "meetsThreshold(bestKillProbability(d), t.relaxing)",
    live: true,
    why:
      "The RELAXING OIL necessity gate. Same shape, same direction, one step further derived: " +
      "`killProbabilityWith` keeps only the pHit/pCrit mass whose damage would finish the fish, " +
      "so it is a connect probability with a lethality filter over it.",
  },
  {
    file: "src/strategy/fishing/oilShadow.ts",
    contains: '(r.bestConnectProbability ?? 0) >= 1',
    live: true,
    why:
      "`shadow_fired_with_certain_connect` — a certainty check at the same p=1 boundary as " +
      "`isLethal`. Raises a diagnostic flag and takes no action, so the bias is visible here " +
      "rather than costly.",
  },
  {
    file: "src/strategy/fishing/oilShadow.ts",
    contains: '(r.bestKillProbability ?? 0) >= 1',
    live: true,
    why: "`shadow_fired_with_certain_kill` — the Relaxing counterpart of the row above.",
  },
];

describe("the pConnect consumer inventory — nothing reads it unclassified", () => {
  const sites = scan();

  it("every file reading a connect probability is a classified one", () => {
    const unknown = [...new Set(sites.map((s) => s.file))].filter((f) => !CLASSIFIED.has(f)).sort();
    expect(
      unknown,
      "a NEW pConnect consumer appeared in an unclassified file — classify it rank-based or " +
        "level-based in tests/fishing/pConnectConsumers.test.ts before shipping it",
    ).toEqual([]);
  });

  it.each([...CLASSIFIED.keys()])("%s has exactly its recorded number of sites", (file) => {
    const found = sites.filter((s) => s.file === file).length;
    expect(
      found,
      `${file}: the connect-probability read count moved. A new read is a new consumer and needs ` +
        `a class. ${CLASSIFIED.get(file)!.note}`,
    ).toBe(CLASSIFIED.get(file)!.sites);
  });

  it("no classified file has gone quiet, so the list cannot rot", () => {
    const live = new Set(sites.map((s) => s.file));
    const stale = [...CLASSIFIED.keys()].filter((f) => !live.has(f));
    expect(stale, `classified files with nothing left to classify: ${stale.join(", ")}`).toEqual([]);
  });
});

describe("the level-based sites — the only ones a miscalibrated level can reach", () => {
  it.each(LEVEL_SITES.map((s) => [`${s.file} :: ${s.contains}`, s] as const))("%s still exists", (_label, site) => {
    expect(
      readFileSync(site.file, "utf8").replace(/\s+/g, " "),
      `named level-based consumer has moved or gone: ${site.why}`,
    ).toContain(site.contains.replace(/\s+/g, " "));
  });

  it("the live level-based set is exactly the four gates it should be", () => {
    // Named as a set, not a count, so a site moving between live and not-live
    // is a loud change. These four are where a fitted correction would apply
    // and nowhere else — which is the whole point of the inventory.
    expect(LEVEL_SITES.filter((s) => s.live).map((s) => s.contains).sort()).toEqual(
      [
        "if (pAnyHit < 0.999999) return false;",
        "meetsThreshold(bestConnectProbabilityFromFrozenCell(d), t.focus)",
        "meetsThreshold(bestKillProbability(d), t.relaxing)",
        "(r.bestConnectProbability ?? 0) >= 1",
        "(r.bestKillProbability ?? 0) >= 1",
      ].sort(),
    );
  });
});
