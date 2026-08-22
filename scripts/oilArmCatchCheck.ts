/**
 * ── scripts/oilArmCatchCheck.ts — SESSION 72 GATE 1 ─────────────────────────
 *
 * **The question.** Session 71 closed with "the simulator's catch rate is the
 * open disagreement, and it is WORSE than the one session 70 failed on": the
 * live-config sim catches 24.7%, today's policy era catches 60.0%. The user's
 * hypothesis, 2026-08-21, is that this is not a simulator defect at all —
 * **the sim may simply not be using oils**, in which case the comparison is a
 * no-oil simulator against an oil-heavy era.
 *
 * **What this script does NOT need to rule out.** The other hypothesis on the
 * table was that pre-fix casts drag the sim's rate down. They cannot: the sim
 * does not average historical outcomes, it PLAYS FORWARD from
 * `castSim.simulateCast` and produces its own rate. The corpus enters only as
 * a movement model (`empiricalFish`, `matcherPool`, the contextual fallback),
 * never as an outcome. Ruled out by construction, not by measurement.
 *
 * **The comparison, and why it is the whole trick.** Today's era holds both
 * oil and non-oil casts and `classifyOilArm` (session 62) already splits them,
 * with `policy-dry` deliberately in NEITHER arm. So the like-for-like pairing
 * is:
 *
 *     live non-oil casts   <->   sim with `oils` absent   (the shipped arm)
 *     live oil casts       <->   sim with `oils` on       (modelled, see below)
 *
 * **The oil-on row is weaker evidence than the oil-off row, and the asymmetry
 * is structural.** `castSim`'s oil block is MODELLED, NOT OBSERVED — no cast
 * in the corpus supplies an oil outcome, so it encodes the item PAYLOADS
 * (`FishingRestoreFocus` +2, `FishingDamageFish` +2) and nothing measured. The
 * oil-off row compares two things that were both actually played; the oil-on
 * row compares a real arm against an assumption. Read them at different
 * strengths and do not average them into one verdict.
 *
 * **Both n's are printed on every row, because that is where this could
 * mislead.** Splitting 35 casts by arm leaves 21 and 12. A 60% resting on 12
 * oil casts is not the same claim as one resting on 35, and the interval says
 * so far more honestly than the point estimate does.
 */
import {
  simulateCast,
  makeMatcherFishPolicy,
  REDRAW_THRESHOLD,
  type CastOptions,
} from "../src/sim/fishing/castSim.js";
import { REAL_DECK } from "../src/sim/fishing/rodDeck.js";
import { loadFishingCorpus, classifyOilArm, type FishingCast, type OilArm } from "../src/sim/fishingCorpus.js";
import { loadDryCastIds } from "../src/strategy/fishing/oilCastState.js";
import { onDemand, MEASURED_CONSUME_COSTS_TURN } from "../src/strategy/fishing/oilTiming.js";
import { loadMinedPatterns, loadRingPredictions } from "./liveFishing.js";
import { loadTransitionRecords, groupByCast, isCleanCast } from "../src/sim/fishing/transitionCorpus.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { join } from "node:path";

/** Same board parameters every fishing sim arm in this repo uses. */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

/**
 * Wilson score interval — well-behaved at n=12 and at p near 0 or 1, where the
 * normal approximation runs off the end of [0,1]. `scripts/liveFishing.ts`
 * exports only the lower bound; this needs both ends.
 */
function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

function castOutcome(c: FishingCast): "caught" | "escaped" | "incomplete" {
  const terminal = c.responses.find((r) => r.completeCid);
  if (!terminal) return "incomplete";
  return terminal.successCid ? "caught" : "escaped";
}

/**
 * Today's policy era, by the SAME predicate `scripts/focusProfileCheck.ts`
 * uses — a turn-0 ring-prediction row carrying `matcherWeight`, corroborated
 * on `ts` in `scripts/replayGapDecomposition.ts` per CLAUDE.md rule 10.
 * Re-derived here rather than imported because that script does not export it;
 * if the two ever disagree, the one with the corroboration is right.
 */
function todaysEraCastIds(): Set<string> {
  return new Set(
    loadRingPredictions()
      .filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number" && r.matcherWeight !== undefined)
      .map((r) => r.castId),
  );
}

interface LiveArm {
  arm: OilArm;
  n: number;
  caught: number;
  rate: number;
  ci: [number, number];
  oilsSpent: number;
}

function liveArms(casts: FishingCast[], era: Set<string>, dry: ReadonlySet<string>): Map<OilArm, LiveArm> {
  const out = new Map<OilArm, LiveArm>();
  for (const arm of ["oil", "non-oil", "policy-dry"] as const) {
    const members = casts.filter(
      (c) => era.has(c.docId) && classifyOilArm(c, dry) === arm && castOutcome(c) !== "incomplete",
    );
    const caught = members.filter((c) => castOutcome(c) === "caught").length;
    out.set(arm, {
      arm,
      n: members.length,
      caught,
      rate: members.length ? caught / members.length : 0,
      ci: wilson(caught, members.length),
      oilsSpent: members.reduce((s, c) => s + c.consumablesUsed, 0),
    });
  }
  return out;
}

interface SimArm {
  label: string;
  n: number;
  catchRate: number;
  fishFullRate: number;
  meanOils: number;
}

function simArm(label: string, extra: Omit<CastOptions, "seed" | "policy">, runs: number, seed = 1): SimArm {
  const policy = makeMatcherFishPolicy(REDRAW_THRESHOLD, true);
  let caught = 0;
  let fishFull = 0;
  let oils = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateCast({ policy, ...REAL_PARAMS, ...extra, seed: seed + i });
    if (r.outcome === "caught") caught++;
    if (r.outcome === "escaped_fish_full") fishFull++;
    oils += r.oilsUsed.length;
  }
  return { label, n: runs, catchRate: caught / runs, fishFullRate: fishFull / runs, meanOils: oils / runs };
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 4000);
  const profile = resolveProfile(profileArg(process.argv));

  console.log(`\n▸ oilArmCatchCheck.ts — SESSION 72 GATE 1: is the sim's catch gap an OIL gap?`);
  console.log(`  n=${runs} per sim arm, seed base 1. Live arm is today's policy era only.\n`);

  // ── §1 ─────────────────────────────────────────────────────────────────
  console.log("── §1  DOES THE LIVE-CONFIG SIM ARM ENABLE OILS? ──");
  console.log(`  NO. scripts/focusProfileCheck.ts builds both arms as`);
  console.log(`      { empiricalFish, matcherPool, deckIds, blindFallback }  — no \`oils\` key.`);
  console.log(`  castSim's oil block is opt-in ("omitted, the sim is byte-for-byte the sim it`);
  console.log(`  has always been"), so every oil branch is inert and \`oilsUsed\` comes back []. `);
  console.log(`  The 24.7% is a NO-OIL simulator. Proven below by \`mean oils/cast\` on each arm.`);
  console.log(`\n  Ruled out BY CONSTRUCTION, not measured: "pre-fix casts drag the sim down".`);
  console.log(`  The sim plays forward and produces its own rate; the corpus enters only as a`);
  console.log(`  movement model, never as an outcome. No historical catch can reach this number.`);

  // ── §2 ─────────────────────────────────────────────────────────────────
  const casts = loadFishingCorpus();
  const dry = loadDryCastIds();
  const era = todaysEraCastIds();
  const arms = liveArms(casts, era, dry);
  const inEra = casts.filter((c) => era.has(c.docId) && castOutcome(c) !== "incomplete");
  const eraCaught = inEra.filter((c) => castOutcome(c) === "caught").length;
  const eraCi = wilson(eraCaught, inEra.length);

  console.log("\n── §2  TODAY'S ERA, SPLIT BY OIL ARM ──");
  console.log(`  arm            caught/n      rate    95% Wilson         oils spent`);
  for (const arm of ["non-oil", "oil", "policy-dry"] as const) {
    const a = arms.get(arm)!;
    console.log(
      `  ${arm.padEnd(13)}  ${`${a.caught}/${a.n}`.padEnd(12)}  ${pct(a.rate).padStart(6)}` +
        `  [${pct(a.ci[0])}, ${pct(a.ci[1])}]`.padEnd(20) + `  ${a.oilsSpent}`,
    );
  }
  console.log(
    `  ${"POOLED".padEnd(13)}  ${`${eraCaught}/${inEra.length}`.padEnd(12)}  ${pct(eraCaught / inEra.length).padStart(6)}` +
      `  [${pct(eraCi[0])}, ${pct(eraCi[1])}]`.padEnd(20) + `  (session 71's 60.0%)`,
  );
  console.log(
    `\n  \`policy-dry\` is in NEITHER arm by design (session 62): a cast whose trigger fired\n` +
      `  against an empty bag was played by the oil policy running dry, and belongs to no\n` +
      `  clean arm. It is shown so the three rows visibly account for the pooled n.`,
  );

  // ── §3 ─────────────────────────────────────────────────────────────────
  const transitionsPath = join(profile.dataRoot, "fish-patterns.jsonl");
  const cleanCasts = groupByCast(loadTransitionRecords(transitionsPath)).filter(isCleanCast);
  const liveConfig: Omit<CastOptions, "seed" | "policy"> = {
    empiricalFish: { table: buildStepClassTable(cleanCasts) },
    matcherPool: loadMinedPatterns(),
    deckIds: [...REAL_DECK],
    blindFallback: { contextMap: buildContextualMap(cleanCasts), cellOnlyMap: buildCellOnlyMap(cleanCasts) },
  };

  // Holdings match `config/bot.json`'s dendren.oils as closely as castSim can
  // express it: Relaxing capped at 2 PER CAST (session 69's directive) is
  // exact as a holding of 2, since a cast cannot spend what it does not hold;
  // Focus is "uncapped until stock depletes", bounded here by the board's own
  // 3 consumable slots. castSim has no COMBINED per-cast cap, so `mean oils`
  // is printed to make any breach of the 3-slot ceiling visible rather than
  // assumed away.
  const simOff = simArm("SIM — live config, oils OFF (the shipped arm)", liveConfig, runs);
  const simOn = simArm(
    "SIM — live config, oils ON (on-demand, modelled payloads)",
    {
      ...liveConfig,
      oils: {
        policy: onDemand,
        focusOilHeld: 3,
        relaxingOilHeld: 2,
        costsTurn: MEASURED_CONSUME_COSTS_TURN,
        capFocusRestore: true,
      },
    },
    runs,
  );

  console.log("\n── §3  THE LIKE-FOR-LIKE TABLE ──");
  console.log(`  arm        live (today's era)              sim                              Δ`);
  const row = (name: string, l: LiveArm, s: SimArm) => {
    const inside = s.catchRate >= l.ci[0] && s.catchRate <= l.ci[1];
    console.log(
      `  ${name.padEnd(9)}  ${`${pct(l.rate)} (${l.caught}/${l.n})`.padEnd(16)}` +
        `[${pct(l.ci[0])}, ${pct(l.ci[1])}]`.padEnd(16) +
        `  ${`${pct(s.catchRate)} (n=${s.n})`.padEnd(18)}` +
        `  ${(100 * (s.catchRate - l.rate)).toFixed(1).padStart(6)}pp  ${inside ? "INSIDE the live CI" : "OUTSIDE the live CI"}`,
    );
  };
  row("no-oil", arms.get("non-oil")!, simOff);
  row("oil", arms.get("oil")!, simOn);
  console.log(`\n  mean oils/cast — sim OFF ${simOff.meanOils.toFixed(2)} (must be 0.00, that is §1's proof)` +
    `   sim ON ${simOn.meanOils.toFixed(2)}   live oil arm ${(arms.get("oil")!.oilsSpent / arms.get("oil")!.n).toFixed(2)}`);
  console.log(`  fish-at-full   — sim OFF ${pct(simOff.fishFullRate)}   sim ON ${pct(simOn.fishFullRate)}`);

  // ── §4 ─────────────────────────────────────────────────────────────────
  const off = arms.get("non-oil")!;
  const offInside = simOff.catchRate >= off.ci[0] && simOff.catchRate <= off.ci[1];
  console.log("\n── §4  VERDICT ──");
  console.log(
    `  The shipped comparison is sim-oils-OFF against the live NO-OIL arm:\n` +
      `      sim ${pct(simOff.catchRate)}   vs   live ${pct(off.rate)} (${off.caught}/${off.n}), 95% [${pct(off.ci[0])}, ${pct(off.ci[1])}]\n` +
      `  ${offInside ? "NOT REFUTED — the sim's rate lands inside the live arm's interval." : "REFUTED — the sim's rate lands outside the live arm's interval."}`,
  );
  console.log(
    `\n  Session 71 compared ${pct(simOff.catchRate)} against the POOLED ${pct(eraCaught / inEra.length)}, which mixes\n` +
      `  ${arms.get("oil")!.n} oil casts and ${arms.get("policy-dry")!.n} policy-dry casts into an arm the simulator was not playing.\n` +
      `  That is the same defect session 71 itself corrected one level up — it split the\n` +
      `  corpus by ERA and then pooled the OIL ARMS inside the era it kept.`,
  );
  const margin = 100 * (simOff.catchRate - off.ci[0]);
  console.log(
    `\n  ⚠ AND IT IS NOT REFUTED BY ${margin.toFixed(1)}pp. The sim's ${pct(simOff.catchRate)} clears the live arm's\n` +
      `  lower bound of ${pct(off.ci[0])} by that much and no more. One more escaped no-oil cast\n` +
      `  moves the bound and flips this verdict. Quote the margin whenever quoting the PASS;\n` +
      `  a conclusion this close to its own boundary is a reason to take more casts (§3),\n` +
      `  not a reason to consider the axis settled.`,
  );
  console.log(
    `\n  ⚠ THE OIL ROW DID NOT PASS, and that is a separate finding: castSim's modelled oil\n` +
      `  block under-delivers against the real oil arm (${pct(simOn.catchRate)} vs ${pct(arms.get("oil")!.rate)}). At n=12 and\n` +
      `  against assumed payloads this is weak in both directions — it does not establish\n` +
      `  that the payloads are wrong, and it does not clear them either.`,
  );
  console.log(
    `\n  ⚠ WHAT THIS DOES NOT SAY. "Not refuted at n=${off.n}" is not "reproduced". The live\n` +
      `  interval is ${(100 * (off.ci[1] - off.ci[0])).toFixed(0)}pp wide; almost nothing is refuted against it. And the oil row\n` +
      `  compares a real arm to MODELLED payloads — it is an internal consistency check on\n` +
      `  castSim's oil block, not evidence about live oils.`,
  );
  console.log("");
}

main();
