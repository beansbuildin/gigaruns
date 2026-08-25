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
      sites: 20,
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
      sites: 9,
      note:
        "LEVEL throughout. `killProbabilityWith`/`bestKillProbability` and " +
        "`bestConnectProbabilityFromFrozenCell` fold pHit/pCrit into a single probability that " +
        "`meetsThreshold` then compares against a derived constant. The `Math.max` inside " +
        "`bestConnectProbabilityFromFrozenCell` is a rank, but its RESULT is used as a level, " +
        "which is what the classification follows. [session 89] 8 -> 9: the ninth is " +
        "`doubleLethalTriggers`, which is derived-not-shipped, so this file is no longer LIVE " +
        "throughout — see the entry for it below.",
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
      sites: 11,
      note:
        "REPORT — every site is a log field or a console line (`pHitPredicted`, the `P_hit x.xx` " +
        "shot line, the shadow's `bestConnect`/`bestKill` strings, and [session 90] the " +
        "`oil_trigger_threw` console line). This file still reads no connect probability to " +
        "DECIDE anything — its decisions come from `chooseCard` and `oilTiming`, both classified " +
        "above. What changed in session 90 is upstream of this count and is recorded on the " +
        "`oilTiming.ts` double-lethal row: that gate is now LIVE, so a connect probability now " +
        "reaches real oil stock through `oilTiming`, not through a read in this file.",
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
      "It does not decline an action, it GRANTS AN OVERRIDE, along five paths counted in session " +
      "74 §2: exemption from `spendConstraint.maxMoveCost`; dominance over any non-lethal " +
      "candidate in `bestFocusForCard`; skipping the `moveEvThreshold` stay-put comparison; " +
      "`chooseCard` picking among lethal options only; and `offPolicyReplay` skipping the " +
      "coverage re-ranking. An optimistic p=1 claim buys all five, and it sits at the very top " +
      "of the range, which is exactly where the reliability table is worst: the [0.50, 1.01) " +
      "bucket predicts 72.2% and observes 60.3%. " +
      "CORRECTION (session 74): this note used to say a lethal claim also 'short-circuits the " +
      "oil gates'. IT DOES NOT — `isLethal` has ONE call site, the shipped trigger " +
      "`onDemandTriggers` is `fishHp <= fishDamage` with no estimator input at all, and the " +
      "derived necessity gates read their own functions. Card-play lethality and oil lethality " +
      "were conflated, and the error propagated from here into STATE.md and the session-74 brief.",
  },
  {
    file: "src/strategy/fishing/cardChoice.ts",
    contains: "return pConnect < connectThreshold && mana > redrawCost;",
    live: false,
    why:
      "`shouldRedrawOnConnect`. NOT LIVE — `redrawEnabled` is false and redraw is a closed dead " +
      "end. [session 89, QUESTIONS §28 ANSWERED] The REASON is `no validated trigger + two unpaid " +
      "correctness gaps` (liveFishing.ts:2471 and :1526); the older price — session 75's " +
      "re-derivation of 43.9 mana per extra fish against a cast holding 10, correcting session " +
      "72's 263 which was computed on a sim redraw that neither burned a turn nor observed the " +
      "fish — is retained as a MEASUREMENT and retired as a justification. Listed because the " +
      "threshold was DERIVED from " +
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
    contains: "meetsThreshold(bestConnectProbabilityFromFrozenCell(s), t.focus)",
    live: true,
    why:
      "The FOCUS OIL necessity gate — the site the session-73 brief named. The gate skips the " +
      "oil when it believes it can connect without one, so an optimistic input makes it " +
      "UNDER-FIRE: it declines an oil it needed. Live, and level-based.",
  },
  {
    file: "src/strategy/fishing/oilTiming.ts",
    contains: "meetsThreshold(bestKillProbability(s), t.relaxing)",
    live: true,
    why:
      "The RELAXING OIL necessity gate. Same shape, same direction, one step further derived: " +
      "`killProbabilityWith` keeps only the pHit/pCrit mass whose damage would finish the fish, " +
      "so it is a connect probability with a lethality filter over it.",
  },
  {
    file: "src/strategy/fishing/oilTiming.ts",
    contains: "if (meetsThreshold(bestKillProbability(s), relaxingThreshold)) return base;",
    live: true,
    why:
      "[session 97 §1b] ⚠ THE COMPARISON CHANGED FROM A BARE `>=` TO `meetsThreshold`, AND THAT IS A " +
      "FIX, NOT A RENAME. This line read `bestKillProbability(s) >= relaxingThreshold` from session 89 " +
      "until session 97 while the necessity gate two entries up — same quantity, same constant — went " +
      "epsilon-tolerant in session 68. At a threshold of exactly 1 a certain kill arrives as " +
      "0.9999999999999999 whenever the summation order does not cancel (session 68 observed exactly " +
      "that), so the bare form read certainty as uncertainty and spent TWO oils on a turn the bot was " +
      "already sure of. " +
      "[session 89, WENT LIVE session 90] The DOUBLE-LETHAL band gate. Same level-based read as " +
      "the relaxing necessity gate above and the same constant, applied in the band where one oil " +
      "cannot finish the fish but two can. **This entry was `live: false` for exactly one session.** " +
      "`scripts/liveFishing.ts` now calls `doubleLethalTriggers` on the user's explicit override " +
      "(`QUESTIONS.md` §30) — and `handoff/OIL-DOUBLE-LETHAL.md` still recommends AGAINST it " +
      "(140.9 oils per extra fish against a bar of ~12), which is a fact about the trade, not " +
      "about the wiring. What this inventory cares about is narrower and now sharper: a " +
      "miscalibrated connect probability can reach REAL OIL STOCK through this line, which was " +
      "not true yesterday.",
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

  it("the live level-based set is exactly the gates it should be", () => {
    // Named as a set, not a count, so a site moving between live and not-live
    // is a loud change. These are where a fitted correction would apply and
    // nowhere else — which is the whole point of the inventory.
    //
    // **[session 90] This set GREW, and the growth is the record.** The
    // double-lethal band gate sat here as `live: false` for exactly one
    // session; the user's override (`QUESTIONS.md` §30) wired it, and this
    // assertion is the thing that made that a visible change rather than a
    // quiet one. It fired on the wiring commit, which is what it is for.
    expect(LEVEL_SITES.filter((s) => s.live).map((s) => s.contains).sort()).toEqual(
      [
        "if (pAnyHit < 0.999999) return false;",
        "meetsThreshold(bestConnectProbabilityFromFrozenCell(s), t.focus)",
        "meetsThreshold(bestKillProbability(s), t.relaxing)",
        "if (meetsThreshold(bestKillProbability(s), relaxingThreshold)) return base;",
        "(r.bestConnectProbability ?? 0) >= 1",
        "(r.bestKillProbability ?? 0) >= 1",
      ].sort(),
    );
  });
});
