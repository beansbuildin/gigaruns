/**
 * scripts/eraCatchRate.ts — [session 97 §2b] **LIVE catch rate, segmented by
 * `castEra`.** The load-bearing check behind "is the autofisher broken", and
 * it had never been run.
 *
 * ## Why this script exists
 *
 * The user read session 96's batch — 3 caught of 10 — and reported the catch
 * rate as "DOWN to 30%" from "~60% on previous sessions", with the autofisher
 * "garage now". That is a serious claim and it deserves a measurement rather
 * than a reassurance.
 *
 * `src/sim/fishing/castEra.ts` has classified every cast into `preOil` /
 * `oilSupplied` / `focusDry` since session 92, and QUESTIONS.md §32 reports
 * BUDGET-ZERO rate by era. **Nothing has ever reported CATCH rate by era**, so
 * the one segmentation that could explain a real drop mechanically has never
 * been looked at.
 *
 * The mechanical hypothesis this tests, stated before the numbers so it cannot
 * be fitted to them: the focus meter never regenerates within a cast
 * (CONFIRMED session 13), the only live-approved top-up was Focus Oil, and
 * Focus Oil was withdrawn in session 93 (§35, RELAXING-OIL-ONLY). If
 * `focusDry` casts catch materially less than `oilSupplied` ones, that is a
 * **live-confirmed mechanical consequence of a deliberate policy change**, not
 * a regression in the bot.
 *
 * ## Instrument discipline
 *
 * Everything here is the LIVE corpus. No `castSim` number appears in this
 * script's output, by construction — `handoff/OIL-POLICY.md` §0a suspends that
 * instrument for this fishery and §2's brief restates the prohibition. The
 * catch outcome is read the same way `scripts/oilArmCatchCheck.ts` reads it
 * (`castOutcome`, off the terminal response's `successCid`), reused rather
 * than re-derived so the two scripts cannot disagree about what a catch is.
 *
 * Wilson intervals throughout, and **n on every row** — the whole point is
 * that 3/10 and 199/199 are not the same kind of claim, and a point estimate
 * hides that while an interval says it.
 *
 * Usage: npx tsx scripts/eraCatchRate.ts
 */
import { loadFishingCorpus, type FishingCast } from "../src/sim/fishingCorpus.js";
import { eraOf, loadCastCreatedAt, ERAS, type Era } from "../src/sim/fishing/castEra.js";

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

/**
 * Wilson score interval. Well-behaved at n=10 and at p near 0 or 1, where the
 * normal approximation is not — which is the entire reason a 3/10 batch needs
 * one at all.
 */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}

/**
 * Exact Clopper–Pearson interval, for the one number the user actually asked
 * about. §2c of the brief asks specifically for the EXACT binomial interval on
 * 3/10 rather than an approximation, and at n=10 the difference is not
 * cosmetic.
 *
 * Implemented through the Beta quantile via a continued-fraction incomplete
 * beta, rather than pulled from a dependency, because this repo has none for
 * it and one function is cheaper than one package.
 */
export function clopperPearson(k: number, n: number, alpha = 0.05): [number, number] {
  const lo = k === 0 ? 0 : betaQuantile(alpha / 2, k, n - k + 1);
  const hi = k === n ? 1 : betaQuantile(1 - alpha / 2, k + 1, n - k);
  return [lo, hi];
}

/** Inverse regularised incomplete beta by bisection — exact enough at 1e-10 and obviously correct. */
function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (regularisedIncompleteBeta(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j]! / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function regularisedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  // Lentz's continued fraction.
  let f = 1;
  let c = 1;
  let d = 0;
  for (let i = 0; i <= 300; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0) numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else numerator = -(((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-12) break;
  }
  return (front * (f - 1)) / a;
}

/**
 * A cast's outcome, read exactly as `scripts/oilArmCatchCheck.ts` reads it.
 *
 * `incomplete` is its own bucket and NOT an escape: a cast whose process was
 * killed mid-play has no terminal state, and folding it into `escaped` would
 * bias every rate below downward by however many times a run was interrupted.
 */
export function castOutcome(c: FishingCast): "caught" | "escaped" | "incomplete" {
  const terminal = c.responses.filter((r) => r.completeCid).at(-1);
  if (terminal === undefined) return "incomplete";
  return terminal.successCid ? "caught" : "escaped";
}

interface Row {
  label: string;
  caught: number;
  n: number;
  oils: number;
}

function row(label: string, casts: readonly FishingCast[]): Row {
  const scored = casts.filter((c) => castOutcome(c) !== "incomplete");
  return {
    label,
    caught: scored.filter((c) => castOutcome(c) === "caught").length,
    n: scored.length,
    oils: scored.reduce((s, c) => s + c.consumablesUsed, 0),
  };
}

function printRows(rows: readonly Row[]): void {
  console.log(`  ${"segment".padEnd(22)} ${"caught/n".padEnd(11)} ${"rate".padStart(6)}  ${"95% Wilson".padEnd(18)} oils  oils/cast`);
  for (const r of rows) {
    const [lo, hi] = wilson(r.caught, r.n);
    console.log(
      `  ${r.label.padEnd(22)} ${`${r.caught}/${r.n}`.padEnd(11)} ${pct(r.n ? r.caught / r.n : 0).padStart(6)}` +
        `  ${`[${pct(lo)}, ${pct(hi)}]`.padEnd(18)} ${String(r.oils).padStart(4)}  ${(r.n ? r.oils / r.n : 0).toFixed(2)}`,
    );
  }
}

function main(): void {
  const casts = loadFishingCorpus();
  const created = loadCastCreatedAt();

  console.log("\n▸ eraCatchRate.ts — SESSION 97 §2b: LIVE catch rate by era");
  console.log("  LIVE CORPUS ONLY. No `castSim` quantity appears below (OIL-POLICY.md §0a).\n");

  console.log("── §1  CATCH RATE BY ERA ──");
  const byEra = new Map<Era, FishingCast[]>(ERAS.map((e) => [e, []]));
  for (const c of casts) byEra.get(eraOf(c.docId, created))!.push(c);
  const eraRows = ERAS.map((e) => row(e, byEra.get(e)!));
  printRows([...eraRows, row("ALL", casts)]);

  const dry = eraRows.find((r) => r.label === "focusDry")!;
  const supplied = eraRows.find((r) => r.label === "oilSupplied")!;
  const pre = eraRows.find((r) => r.label === "preOil")!;
  const dryRate = dry.caught / dry.n;
  const suppliedRate = supplied.caught / supplied.n;
  const [dLo, dHi] = wilson(dry.caught, dry.n);
  const [sLo, sHi] = wilson(supplied.caught, supplied.n);
  const overlap = dLo <= sHi && sLo <= dHi;

  console.log(`\n── §2  THE MECHANICAL HYPOTHESIS: does \`focusDry\` catch LESS? ──`);
  console.log(
    `  focusDry ${pct(dryRate)} vs oilSupplied ${pct(suppliedRate)} — ` +
      `${(100 * (dryRate - suppliedRate)).toFixed(1)}pp, intervals ${overlap ? "OVERLAP" : "are DISJOINT"}.`,
  );
  console.log(
    overlap
      ? `  ⇒ NOT SUPPORTED at this n. The era split does NOT explain a catch-rate drop:\n` +
          `    the two intervals overlap, so the corpus cannot distinguish these rates.`
      : `  ⇒ SUPPORTED. The withdrawal of Focus Oil is a live-confirmed mechanical\n` +
          `    explanation, not a bot regression.`,
  );
  console.log(`  preOil ${pct(pre.caught / pre.n)} (n=${pre.n}) is shown for completeness; it predates the oil policy entirely.`);

  console.log(`\n── §3  SESSION 96'S BATCH IN CONTEXT (§2c) ──`);
  const [cpLo, cpHi] = clopperPearson(3, 10);
  console.log(`  session 96: 3/10 = 30.0%   EXACT binomial 95% CI [${pct(cpLo)}, ${pct(cpHi)}]`);
  const baselines: [string, number][] = [
    ["bare-arm real (§0a)", 0.276],
    ["live-config pooled", 0.283],
    ["dead-era-excluded", 0.259],
    ["all-time corpus", (casts.filter((c) => castOutcome(c) === "caught").length) / casts.filter((c) => castOutcome(c) !== "incomplete").length],
    ["focusDry era", dryRate],
  ];
  for (const [name, v] of baselines) {
    const inside = v >= cpLo && v <= cpHi;
    console.log(`    ${name.padEnd(22)} ${pct(v).padStart(6)}  ${inside ? "INSIDE the 3/10 interval" : "OUTSIDE the 3/10 interval"}`);
  }

  console.log(`\n── §4  LIVE OILS PER CAST — the RETIRED §2c tripwire's own denominator (§1c) ──`);
  console.log(`  The tripwire WAS pre-registered against "the sim's ~0.70 oils/cast"`);
  console.log(`  (scripts/liveFishing.ts). That is a SWEEP number, i.e. \`castSim\`. Live:`);
  printRows([row("focusDry (today)", byEra.get("focusDry")!), row("ALL", casts)]);

  // ── §5 ── ⚠ THE §2c TRIPWIRE IS RETIRED. This is the diagnosis that retired
  // it, kept as the record of WHY — not a proposal, and not an instrument.
  //
  // [session 98 §B] Session 97 wrote this block as a RE-REGISTRATION: here is
  // the live rate the tripwire should have used, so re-register it against
  // that. **The user declined** (2026-08-25, QUESTIONS.md §44) and retired the
  // tripwire outright instead, on the reasoning that retiring a broken
  // instrument and proposing a new one are two different decisions. The
  // evaluation site in `scripts/liveFishing.ts` is gone and
  // `src/strategy/fishing/oilBatch.ts` carries the tombstone at the constant.
  //
  // Nothing below is operational. It computes: how surprising is >= 9 clean
  // (zero-oil) casts in 10, under the sim's assumed rate versus the live one?
  // Keep it readable — a future reader asking "why did this stop existing"
  // should land on these two numbers.
  const cleanRate = (cs: readonly FishingCast[]) => {
    const scored = cs.filter((c) => castOutcome(c) !== "incomplete");
    // `oilEra` is a BOOLEAN (`consumablesUsed > 0 || slotsUsed.some(...)`),
    // not a count — `=== 0` silently never matches and reports every cast as
    // oiled. The oil COUNT lives on `consumablesUsed`.
    return { clean: scored.filter((c) => !c.oilEra).length, n: scored.length };
  };
  const binom = (k: number, n: number, p: number) => {
    let lg = 0;
    for (let i = 1; i <= n; i++) lg += Math.log(i);
    const lchoose = (a: number) => {
      let x = lg;
      for (let i = 1; i <= a; i++) x -= Math.log(i);
      for (let i = 1; i <= n - a; i++) x -= Math.log(i);
      return x;
    };
    let acc = 0;
    for (let i = k; i <= n; i++) acc += Math.exp(lchoose(i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
    return acc;
  };

  console.log(`\n── §5  THE §2c TRIPWIRE — RETIRED 2026-08-25, AND WHY (§1c) ──`);
  console.log(`  ⚠ RETIRED OUTRIGHT by user directive, QUESTIONS.md §44 — not re-registered`);
  console.log(`    against the live rate below. That was offered and declined. Nothing here`);
  console.log(`    is evaluated by any live script; this is the record of the diagnosis.`);
  const dryClean = cleanRate(byEra.get("focusDry")!);
  const allClean = cleanRate(casts);
  console.log(`  live CLEAN-cast rate   focusDry ${dryClean.clean}/${dryClean.n} = ${pct(dryClean.clean / dryClean.n)}` +
    `   all-time ${allClean.clean}/${allClean.n} = ${pct(allClean.clean / allClean.n)}`);
  const pSim = Math.exp(-0.70); // the model's own implied P(clean) at ~0.70 oils/cast
  const pDry = dryClean.clean / dryClean.n;
  console.log(`\n  P(>= 9 clean of 10):`);
  console.log(`    under the sim's ~0.70 oils/cast   P(clean)=${pct(pSim)}   =>  ${(100 * binom(9, 10, pSim)).toFixed(2)}%  (~1 in ${Math.round(1 / binom(9, 10, pSim))})`);
  console.log(`    under the LIVE focusDry rate      P(clean)=${pct(pDry)}   =>  ${(100 * binom(9, 10, pDry)).toFixed(1)}%  (~1 in ${Math.round(1 / binom(9, 10, pDry))})`);
  console.log(
    `\n  ⇒ The tripwire fired because its THRESHOLD was derived from \`castSim\`, not\n` +
      `    because live play diverged from anything measured. Session 96's 9-of-10 is\n` +
      `    an ordinary outcome at the live rate. That is what retired it.`,
  );
  console.log(
    `\n  AND THE NECESSITY GATE WAS NOT THE CAUSE — AT THE THRESHOLD IT HAD THEN.\n` +
      `  \`scripts/liveGateFiringRates.ts\` measured the Relaxing gate holding 0 of 18\n` +
      `  replayed evaluations and 0 of 24 live observations AT A THRESHOLD OF 1, so a\n` +
      `  gated oils/cast was IDENTICAL to an ungated one over every cast in this\n` +
      `  corpus. QUESTIONS.md §39 asked whether the tripwire and the gate are "the\n` +
      `  same finding wearing two names": they are NOT. They shared a CAUSE (both\n` +
      `  numbers came from \`castSim\`), not a mechanism.\n` +
      `\n  ⚠ [session 98 §A] THAT NO LONGER DESCRIBES THE SHIPPED GATE. The user lowered\n` +
      `  the Relaxing threshold to 0.85 (QUESTIONS.md §43) and the same instrument now\n` +
      `  reports 9 of 24 held — so from the NEXT batch onward the oils/cast above is\n` +
      `  no longer a gate-independent quantity, and a clean-cast rate measured after\n` +
      `  2026-08-25 is not comparable to one measured before it. Segment on it.`,
  );
}

main();
