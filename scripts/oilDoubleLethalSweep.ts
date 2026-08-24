/**
 * scripts/oilDoubleLethalSweep.ts — [session 89 §6] score the DOUBLE-LETHAL
 * band trigger beside the roster, under the same paired-seed harness
 * `handoff/OIL-POLICY.md` and `handoff/OIL-CONSERVE.md` both quote.
 *
 * ## Why a new script rather than an edit
 *
 * Same reason session 67 gave for `oilConserveSweep.ts`: `oilTimingSweep.ts`'s
 * table is quoted verbatim as the evidence for the SHIPPED policy, and editing
 * its headline would silently restate a settled recommendation. Same `runArm`,
 * same seeds, same control — new arm, new file.
 *
 * ## ⚠ THE ONE HARNESS CHANGE, and it is not optional
 *
 * Every prior sweep runs `held = 1`. A trigger whose entire condition is
 * "hold at least two Relaxing Oils" is IDENTICALLY INERT at `held = 1`, so a
 * comparison at the old stock would report a null that means nothing. This
 * script runs `held = 2` and reports `on-demand` at the SAME stock as the
 * comparison, rather than against the published `held = 1` numbers — a
 * cross-stock delta would be measuring the stock, not the trigger.
 *
 * ## §0a APPLIES, VERBATIM
 *
 * `handoff/OIL-POLICY.md` §0a suspends `castSim`'s bare default arm for this
 * fishery: sim catch ~70% against a real 27.6%, meter-out 1.0% against 64.2%.
 * Every figure below is measured on that arm. They ORDER the options and
 * authorize none of them, and nothing here is shipped —
 * `scripts/liveFishing.ts` still calls `onDemandTriggers`.
 */

import { runArm, pairedDelta } from "./oilTimingSweep.js";
import { simulateCast, matcherFishPolicy } from "../src/sim/fishing/castSim.js";
import { REAL_DECK } from "../src/sim/fishing/rodDeck.js";
import {
  PAYLOAD_OIL_EFFECTS,
  MEASURED_CONSUME_COSTS_TURN,
  MEASURED_RELAXING_OILS_PER_EXTRA_FISH,
  MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  NEVER_FIRES_THRESHOLD,
  ALWAYS_FIRES_THRESHOLD,
  bestKillProbability,
  doubleLethal,
  doubleLethalTriggers,
  neverOil,
  onDemand,
  conserving,
  type OilDecisionState,
  type OilTimingPolicy,
} from "../src/strategy/fishing/oilTiming.js";

const RUNS = Number(process.env.RUNS ?? 8000);
const HELD = 2;
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}pp`;

console.log(`
══════════════════════════════════════════════════════════════════════════════
  THE DOUBLE-LETHAL BAND — derived, NOT shipped
  n=${RUNS}/arm, paired seeds, costsTurn=${MEASURED_CONSUME_COSTS_TURN},
  effect amount=${PAYLOAD_OIL_EFFECTS.fishDamage}, relaxingOilHeld=focusOilHeld=${HELD}
══════════════════════════════════════════════════════════════════════════════

⚠ OIL-POLICY.md §0a: "this simulator does not reproduce the fishery — sim catch
  ~70% against a real 27.6%, meter-out 1.0% against 64.2%". Every catch figure
  below is measured on that suspended arm. It orders the options; it authorizes
  none of them.
`);

// ── §1  the band's own incidence ───────────────────────────────────────────
// How often all three conditions co-occur. A trigger that never fires is inert,
// and an inert arm's null delta is not evidence about the rule.
let turnsSeen = 0;
let inBand = 0;
let inBandWithStock = 0;
let fires = 0;
let certainInBand = 0;
const killProbsInBand: number[] = [];

for (let i = 0; i < RUNS; i++) {
  simulateCast({
    policy: matcherFishPolicy,
    deckIds: [...REAL_DECK],
    seed: 1 + i,
    oils: {
      policy: {
        name: "probe",
        thesis: "instrumented on-demand — decides exactly as on-demand, and records the band.",
        decide: (s: OilDecisionState, e) => {
          turnsSeen++;
          const band = s.fishHp > e.fishDamage && s.fishHp <= 2 * e.fishDamage;
          if (band) {
            inBand++;
            if (s.relaxingOilHeld >= 2) {
              inBandWithStock++;
              const p = bestKillProbability(s);
              killProbsInBand.push(p);
              if (p >= RECOMMENDED_NECESSITY_THRESHOLDS.relaxing) certainInBand++;
            }
          }
          const d = doubleLethalTriggers(s, e);
          if (d.filter((k) => k === "relaxing").length >= 2) fires++;
          // Decide as ON-DEMAND, so the probe does not change the trajectory it
          // is measuring. This is the whole point of instrumenting separately.
          return onDemand.decide(s, e);
        },
      } as OilTimingPolicy,
      costsTurn: MEASURED_CONSUME_COSTS_TURN,
      effects: PAYLOAD_OIL_EFFECTS,
      focusOilHeld: HELD,
      relaxingOilHeld: HELD,
    },
  });
}

console.log("── §1  HOW OFTEN THE BAND ARISES (measured on-policy, under on-demand) ──\n");
console.log(`  decision points                          ${turnsSeen}`);
console.log(`  in band (fishDamage < fishHp <= 2x)      ${inBand}  (${pct(inBand / turnsSeen)} of decisions)`);
console.log(`  ... and holding >= 2 Relaxing            ${inBandWithStock}  (${pct(inBandWithStock / turnsSeen)})`);
console.log(`  ... and NOT already certain of the kill  ${fires}  (${pct(fires / turnsSeen)})  <- the trigger's true rate`);
console.log(`  band turns where the bot WAS certain     ${certainInBand}  (${inBandWithStock > 0 ? pct(certainInBand / inBandWithStock) : "n/a"} of band-with-stock)`);

// The degeneracy check the brief asks for by name: is the cutoff of 1 doing any
// work, or does it always/never fire?
const exactly0 = killProbsInBand.filter((p) => p === 0).length;
const exactly1 = killProbsInBand.filter((p) => p === 1).length;
const between = killProbsInBand.length - exactly0 - exactly1;
console.log(`\n  bestKillProbability at band turns:  ${pct(exactly0 / killProbsInBand.length)} exactly 0, ` +
  `${pct(exactly1 / killProbsInBand.length)} exactly 1, ${pct(between / killProbsInBand.length)} between`);
console.log(`  DEGENERACY CHECK — the cutoff is doing work iff both tails are non-empty:`);
console.log(`    fires at threshold ${RECOMMENDED_NECESSITY_THRESHOLDS.relaxing}: ${fires} of ${inBandWithStock} band-with-stock turns`);
console.log(`    ${fires === 0 ? "⚠ NEVER FIRES — degenerate" : fires === inBandWithStock ? "⚠ ALWAYS FIRES — the cutoff is inert, this is an unconditional band rule" : "the cutoff separates: neither degenerate tail"}`);

// ── §2  the paired sweep ───────────────────────────────────────────────────
console.log("\n── §2  PAIRED SWEEP, vs `never` (control) and vs `on-demand` (what SHIPS) ──\n");

const arms: OilTimingPolicy[] = [
  neverOil,
  onDemand,
  conserving,
  doubleLethal(RECOMMENDED_NECESSITY_THRESHOLDS.relaxing),
  // The two degenerate configurations, so the middle value is shown to be a
  // choice between behaviours rather than a number asserted on its own.
  doubleLethal(NEVER_FIRES_THRESHOLD),
  doubleLethal(ALWAYS_FIRES_THRESHOLD),
];

const results = arms.map((p) => ({
  policy: p,
  ...runArm(RUNS, p, MEASURED_CONSUME_COSTS_TURN, PAYLOAD_OIL_EFFECTS.fishDamage, 1, HELD),
}));
const control = results[0]!;
const onDemandArm = results[1]!;

console.log("  policy                          catch     Δ vs never      Δ vs on-demand    oils   casts   oils/extra fish");
for (const r of results) {
  const s = r.summary;
  const dNever = pairedDelta(s.policy, r.caughtBySeed, control.caughtBySeed);
  const dOnDemand = pairedDelta(s.policy, r.caughtBySeed, onDemandArm.caughtBySeed);
  const extra = (s.caught - control.summary.caught);
  const perFish = extra > 0 ? (s.oilsSpent / extra).toFixed(2) : s.oilsSpent === 0 ? "—" : "∞";
  console.log(
    `  ${s.policy.padEnd(30)} ${pct(s.catchRate).padStart(7)}  ` +
      `${pp(dNever.deltaCatchRate).padStart(9)}       ${pp(dOnDemand.deltaCatchRate).padStart(9)}     ` +
      `${String(s.oilsSpent).padStart(6)} ${String(s.castsUsingOil).padStart(6)}   ${perFish.padStart(8)}`,
  );
}

// ── §3  the marginal price, which is the number that decides it ────────────
console.log("\n── §3  THE MARGINAL PRICE OF THE SECOND OIL ──\n");
const dl = results[3]!;
const marginalOils = dl.summary.oilsSpent - onDemandArm.summary.oilsSpent;
const marginalFish = dl.summary.caught - onDemandArm.summary.caught;
const dOnDemand = pairedDelta(dl.summary.policy, dl.caughtBySeed, onDemandArm.caughtBySeed);
console.log(`  extra oils spent vs on-demand            ${marginalOils}`);
console.log(`  extra fish caught vs on-demand           ${marginalFish}`);
console.log(`  paired Δ catch                           ${pp(dOnDemand.deltaCatchRate)}  95% CI [${pp(dOnDemand.lo)}, ${pp(dOnDemand.hi)}]  discordant ${dOnDemand.discordant}`);
console.log(
  `  MARGINAL oils per extra fish             ${marginalFish > 0 ? (marginalOils / marginalFish).toFixed(2) : marginalOils === 0 ? "— (spends nothing extra)" : "∞ (spends and wins nothing)"}`,
);
console.log(`
  THE BAR. The corpus prices the shipped Relaxing trigger at
  ~${MEASURED_RELAXING_OILS_PER_EXTRA_FISH} oils per extra fish, 95% interval
  [${MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL[0]}, ${MEASURED_RELAXING_OILS_PER_EXTRA_FISH_INTERVAL[1]}].
  A DOUBLE spend commits two oils to one fish, so to be worth taking it must
  clear roughly TWICE that bar per fish saved — i.e. a marginal cost at or below
  ~${MEASURED_RELAXING_OILS_PER_EXTRA_FISH * 2} oils per extra fish, and ideally
  well inside it. A marginal figure above that is the trigger paying more per
  fish than the policy it extends.
`);
