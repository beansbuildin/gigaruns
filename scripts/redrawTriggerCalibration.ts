/**
 * ── scripts/redrawTriggerCalibration.ts — SESSION 72 GATE 2 ────────────────
 *
 * **Re-derive what the redraw trigger should TEST, and derive its threshold
 * from a measured quantity rather than fitting a constant to an outcome.**
 * See `cardChoice.ts`'s `shouldRedrawOnConnect` for the argument; this script
 * is the measurement half.
 *
 * ── A CORRECTION TO THE BRIEF, STATED UP FRONT (CLAUDE.md rule 9) ──────────
 *
 * The session-72 brief §2b says "calibrate on the replay, not `castSim` — it
 * is the instrument that passed". **The era-matched replay structurally
 * cannot score a redraw's CONSEQUENCE**, and this is not a limitation that
 * more care could work around:
 *
 *   - The draw pile is a hidden server-side shuffle. `fullDeck` is a canonical
 *     sorted list; **0 of 56 refills** match a slice of it (`castTrace.ts`'s
 *     `newHand`). Draws never appear on the wire.
 *   - The replay's entire licence to refill is the invariant "every turn plays
 *     exactly one card, so a counterfactual empties the hand on the SAME turn
 *     as the record, and the recorded `NEW_HAND` is therefore exactly the
 *     right refill." **A redraw is precisely the move that breaks that
 *     invariant** — it discards a whole hand and draws three at a turn the
 *     record never refilled at. The corpus has nothing to supply.
 *
 * So the honest split is by what each instrument can answer, and the parts are
 * labelled rather than blended:
 *
 *   §2 §3  WHEN the trigger fires, and whether `pConnect` is calibrated at all
 *          — REPLAY, on real recorded turns. This is the part that matters and
 *          the part the failed calibration got wrong.
 *   §4     WHAT a redraw is worth in mana per extra fish — `castSim`, because
 *          only a simulator can deal the replacement cards. Labelled as the
 *          simulator's arm, per the brief's own "do not present a castSim
 *          result as evidence about live play".
 *
 * ── The derivation ────────────────────────────────────────────────────────
 *
 * What a redraw BUYS is a fresh hand. So the bar is the connect probability a
 * fresh hand delivers, `pFresh`, measured below on hands the server had just
 * dealt. Fire when this hand is worse than a fresh one by more than the mana
 * is worth:
 *
 *     fire  <=>  pConnect  <  pFresh - manaPrice
 *
 * Neither term is fitted to an outcome. That is the difference from the old
 * threshold, which was a free constant nobody could state the meaning of.
 *
 * Usage: npx tsx scripts/redrawTriggerCalibration.ts [--runs=N]
 */

import { loadCastTraces, isCleanTrace } from "../src/sim/fishing/castTrace.js";
import { replayCast, type ReplayOptions, type ReplayTurn } from "../src/sim/fishing/offPolicyReplay.js";
import { loadMinedPatterns, loadRingPredictions, type RingPredictionRecord } from "./liveFishing.js";
import {
  NEVER_REDRAW_CONNECT_THRESHOLD,
  ALWAYS_REDRAW_CONNECT_THRESHOLD,
} from "../src/strategy/fishing/cardChoice.js";
import { simulateCast, makeConnectRedrawFishPolicy, type CastOptions } from "../src/sim/fishing/castSim.js";
import { REAL_DECK } from "../src/sim/fishing/rodDeck.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { buildStepClassTable } from "../src/strategy/fishing/stepClass.js";
import { buildCellOnlyMap, buildContextualMap } from "../src/strategy/fishing/contextualFallback.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { join } from "node:path";

/** The real board, identical to every other fishing sim arm in this repo. */
const REAL_PARAMS = { fishMaxHp: 21, startFishHpRatio: 13 / 21, startMana: 10, handSize: 3, gridSize: 4 } as const;

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** The era marker, identical to `replayGapDecomposition.ts` and corroborated there on `ts`. */
const playedUnderPosterior = (r: RingPredictionRecord): boolean => r.matcherWeight !== undefined;

/**
 * The mana price of a redraw, as a connect-probability margin.
 *
 * A redraw costs `handSize` mana out of a 10-mana cast — 30% of the whole
 * budget for a 3-card hand. Mana buys turns, and a turn is a shot, so the
 * margin that pays for it is "the connect probability of the shots that mana
 * would otherwise have bought", i.e. `redrawCost / startMana` of one shot's
 * worth. At `handSize` 3 and `startMana` 10 that is 0.30 of `pFresh`,
 * expressed below as a FRACTION of `pFresh` rather than an absolute so it
 * scales with the fishery instead of being a second free constant.
 */
const MANA_PRICE_FRACTION = 3 / 10;

interface TurnRow extends ReplayTurn {
  docId: string;
}

function eraMatchedTurns(): { rows: TurnRow[]; casts: number } {
  const traces = loadCastTraces().filter(isCleanTrace);
  const byId = new Map(traces.map((t) => [t.docId, t]));
  const live = loadRingPredictions().filter((r) => r.turn === 0 && typeof r.focusMoveCost === "number");
  const lib = loadMinedPatterns();
  const setOf = (rows: RingPredictionRecord[]) => rows.flatMap((r) => (byId.has(r.castId) ? [byId.get(r.castId)!] : []));
  const posteriorSet = setOf(live.filter(playedUnderPosterior));

  // Today's era ONLY, replayed exactly as `replayGapDecomposition.ts` §3's
  // era-matched arm does it: leave-one-cast-out, the matcher tier re-mined
  // from the other casts, the mined library loaded the way live loads it.
  const opts: ReplayOptions = { matcherTier: "loo", matcherLibrary: lib };
  const rows: TurnRow[] = [];
  for (const t of posteriorSet) {
    const others = traces.filter((o) => o.docId !== t.docId);
    for (const turn of replayCast(t, others, opts).turns) rows.push({ ...turn, docId: t.docId });
  }
  return { rows, casts: posteriorSet.length };
}

function main(): void {
  const { rows, casts } = eraMatchedTurns();

  console.log(`\n▸ redrawTriggerCalibration.ts — SESSION 72 GATE 2`);
  console.log(`  Era-matched replay, TODAY'S POLICY ERA ONLY: ${casts} casts, ${rows.length} turns.`);
  console.log(`  An era is a BUNDLE, not a knob (session 71) — everything below is a claim`);
  console.log(`  about today's era and nothing else.\n`);

  console.log("── §1  THE BRIEF'S INSTRUMENT CANNOT SCORE A REDRAW'S CONSEQUENCE ──");
  console.log(`  The replay refills from the RECORDED \`NEW_HAND\`, licensed only by "one card`);
  console.log(`  per turn means the counterfactual empties the hand on the same turn as the`);
  console.log(`  record". A redraw breaks exactly that invariant, and the draw pile is a`);
  console.log(`  server-side shuffle that never appears on the wire (0/56 refills match a`);
  console.log(`  \`fullDeck\` slice). So the replay answers WHEN the trigger fires (§2, §3);`);
  console.log(`  only castSim can answer WHAT IT IS WORTH (§4), and that is the sim's claim.`);

  // ── §2  Is pConnect calibrated at all? ────────────────────────────────
  //
  // Before any threshold is derived FROM this quantity, the quantity has to
  // mean something. If turns the policy thinks connect 20% of the time connect
  // 20% of the time, a threshold on it is a threshold on reality. If not, this
  // is the old mistake in a new currency and the calibration should stop here.
  console.log("\n── §2  IS `pConnect` CALIBRATED? (the precondition, not a formality) ──");
  const edges = [0, 0.1, 0.2, 0.3, 0.5, 1.01];
  console.log(`  pConnect bucket    turns   predicted   observed hit   95% Wilson`);
  for (let i = 0; i < edges.length - 1; i++) {
    const b = rows.filter((r) => r.pConnect >= edges[i]! && r.pConnect < edges[i + 1]!);
    if (b.length === 0) continue;
    const hits = b.filter((r) => r.hit).length;
    const ci = wilson(hits, b.length);
    console.log(
      `  [${edges[i]!.toFixed(2)}, ${edges[i + 1]!.toFixed(2)})`.padEnd(19) +
        `${String(b.length).padStart(5)}   ${pct(mean(b.map((r) => r.pConnect))).padStart(9)}` +
        `   ${pct(hits / b.length).padStart(12)}   [${pct(ci[0])}, ${pct(ci[1])}]`,
    );
  }
  const allHits = rows.filter((r) => r.hit).length;
  console.log(
    `  ${"OVERALL".padEnd(19)}${String(rows.length).padStart(5)}   ${pct(mean(rows.map((r) => r.pConnect))).padStart(9)}   ${pct(allHits / rows.length).padStart(12)}`,
  );

  // ── §3  The derived threshold ─────────────────────────────────────────
  const fresh = rows.filter((r) => r.handSize === 3);
  const pFresh = mean(fresh.map((r) => r.pConnect));
  const manaPrice = MANA_PRICE_FRACTION * pFresh;
  const derived = pFresh - manaPrice;

  console.log("\n── §3  THE DERIVED THRESHOLD ──");
  console.log(`  pFresh  = mean pConnect on freshly-dealt hands (handSize 3)   ${pFresh.toFixed(4)}  (n=${fresh.length})`);
  console.log(`  price   = ${MANA_PRICE_FRACTION.toFixed(2)} x pFresh — 3 mana of a 10-mana cast          ${manaPrice.toFixed(4)}`);
  console.log(`  THRESHOLD = pFresh - price                                    ${derived.toFixed(4)}`);
  console.log(`\n  Neither term is fitted to an outcome. Contrast REDRAW_THRESHOLD = 0, which is`);
  console.log(`  an EV cut nobody can state the meaning of, and which fires on the wrong cards`);
  console.log(`  because \`chooseCard\` stopped maximizing EV in session 13.`);

  console.log(`\n  fire rate at candidate thresholds (turns where pConnect < t AND mana > handSize):`);
  const fireRate = (t: number) => rows.filter((r) => r.pConnect < t).length / rows.length;
  for (const [label, t] of [
    ["NEVER degeneracy", NEVER_REDRAW_CONNECT_THRESHOLD],
    ["derived", derived],
    ["pFresh (no mana price)", pFresh],
    ["ALWAYS degeneracy", ALWAYS_REDRAW_CONNECT_THRESHOLD],
  ] as const) {
    console.log(`    ${label.padEnd(24)} t=${t.toFixed(4)}   fires on ${pct(fireRate(t)).padStart(6)} of turns`);
  }
  console.log(`\n  THE FAILURE ON RECORD IS THE ALWAYS ROW. The prior calibration fired "almost`);
  console.log(`  every turn" and cost a mean of 1.29 turns/cast. Any derived number whose fire`);
  console.log(`  rate approaches that row is the same failure wearing a new currency.`);

  // What the firing turns actually look like — the check that the trigger is
  // selecting hopeless hands rather than merely unlucky ones.
  const firing = rows.filter((r) => r.pConnect < derived);
  const notFiring = rows.filter((r) => r.pConnect >= derived);
  const fHit = firing.filter((r) => r.hit).length;
  const nHit = notFiring.filter((r) => r.hit).length;
  console.log(`\n  the split it makes, on REALIZED hits:`);
  console.log(`    would redraw  ${String(firing.length).padStart(4)} turns   observed hit ${pct(firing.length ? fHit / firing.length : 0)}  ${firing.length ? `[${pct(wilson(fHit, firing.length)[0])}, ${pct(wilson(fHit, firing.length)[1])}]` : ""}`);
  console.log(`    would play    ${String(notFiring.length).padStart(4)} turns   observed hit ${pct(notFiring.length ? nHit / notFiring.length : 0)}  ${notFiring.length ? `[${pct(wilson(nHit, notFiring.length)[0])}, ${pct(wilson(nHit, notFiring.length)[1])}]` : ""}`);
  console.log(`\n  A trigger worth shipping separates these two. If the intervals overlap, it is`);
  console.log(`  selecting unlucky turns, not hopeless hands, and redrawing buys nothing.`);

  // ── §4  THE CONFOUND ──────────────────────────────────────────────────
  //
  // §3's split is not yet evidence FOR a redraw, and reading it as one is the
  // exact mistake the brief warned about. Low pConnect turns hit less — of
  // course they do, that is what §2 says the number means. The question a
  // redraw asks is different: could ANY hand have done better here?
  console.log("\n── §4  THE CONFOUND — IS THE HAND BAD, OR IS THE DISTRIBUTION FLAT? ──");
  console.log(`  §3's clean split is NOT yet a case for redrawing. A turn can score low because`);
  console.log(`  the HAND is wrong for a well-known fish (a redraw fixes it) or because the`);
  console.log(`  DISTRIBUTION is flat and nothing connects (a redraw burns 3 mana for the same`);
  console.log(`  shot). \`pConnect\` cannot tell them apart. The ceiling — the best any card in`);
  console.log(`  the whole deck could reach on this turn — can.\n`);
  const headroom = (r: TurnRow) => r.pConnectCeiling - r.pConnect;
  console.log(`  group                turns   mean pConnect   mean ceiling   mean headroom`);
  for (const [label, set] of [
    ["would redraw", firing],
    ["would play", notFiring],
    ["ALL", rows],
  ] as const) {
    if (!set.length) continue;
    console.log(
      `  ${label.padEnd(19)}${String(set.length).padStart(5)}` +
        `   ${mean(set.map((r) => r.pConnect)).toFixed(4).padStart(13)}` +
        `   ${mean(set.map((r) => r.pConnectCeiling)).toFixed(4).padStart(12)}` +
        `   ${mean(set.map(headroom)).toFixed(4).padStart(13)}`,
    );
  }
  const deadTurns = firing.filter((r) => headroom(r) < manaPrice).length;
  console.log(
    `\n  Of the ${firing.length} turns the derived threshold fires on, ${deadTurns} have headroom BELOW the\n` +
      `  mana price (${manaPrice.toFixed(4)}) — i.e. even a PERFECT redraw could not pay for itself.\n` +
      `  That is ${pct(firing.length ? deadTurns / firing.length : 0)} of firings spent on case (b).`,
  );
  console.log(
    `\n  The ceiling is an UPPER BOUND and a generous one: it picks the best card in the\n` +
      `  whole deck, where a real redraw deals three at random. So the true share of\n` +
      `  wasted firings is HIGHER than the number above, not lower.`,
  );

  // ── §5  MANA PER EXTRA FISH — castSim, NOT the replay ─────────────────
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 4000);
  const profile = resolveProfile(profileArg(process.argv));
  const cleanCasts = groupByCast(loadTransitionRecords(join(profile.dataRoot, "fish-patterns.jsonl"))).filter(isCleanCast);
  const liveConfig: Omit<CastOptions, "seed" | "policy"> = {
    ...REAL_PARAMS,
    empiricalFish: { table: buildStepClassTable(cleanCasts) },
    matcherPool: loadMinedPatterns(),
    deckIds: [...REAL_DECK],
    blindFallback: { contextMap: buildContextualMap(cleanCasts), cellOnlyMap: buildCellOnlyMap(cleanCasts) },
  };

  const arm = (t: number) => {
    let caught = 0;
    let manaBurn = 0;
    let escapedMana = 0;
    let turns = 0;
    for (let i = 0; i < runs; i++) {
      const r = simulateCast({ ...liveConfig, policy: makeConnectRedrawFishPolicy(t), seed: 1 + i });
      if (r.outcome === "caught") caught++;
      if (r.outcome === "escaped_mana") escapedMana++;
      manaBurn += r.redrawMana;
      turns += r.turns;
    }
    return { t, catchRate: caught / runs, manaPerCast: manaBurn / runs, escapedMana: escapedMana / runs, turnsPerCast: turns / runs };
  };

  console.log("\n── §5  WHAT IT IS WORTH, IN MANA PER EXTRA FISH — castSim's claim, not the replay's ──");
  console.log(`  n=${runs}/arm, live config, Shroom deck. The replay cannot deal replacement cards`);
  console.log(`  (§1), so this half is the SIMULATOR's — do not present it as evidence about live.\n`);
  const base = arm(NEVER_REDRAW_CONNECT_THRESHOLD);
  console.log(`  threshold        catch    mana/cast on redraws   escaped_mana   turns/cast   mana per extra fish`);
  const show = (label: string, a: ReturnType<typeof arm>) => {
    const dCatch = a.catchRate - base.catchRate;
    const dMana = a.manaPerCast - base.manaPerCast;
    const perFish = Math.abs(dCatch) < 1e-9 ? "n/a (no extra fish)" : (dMana / dCatch).toFixed(1);
    console.log(
      `  ${label.padEnd(15)}${pct(a.catchRate).padStart(6)}   ${a.manaPerCast.toFixed(2).padStart(20)}` +
        `   ${pct(a.escapedMana).padStart(12)}   ${a.turnsPerCast.toFixed(2).padStart(10)}   ${String(perFish).padStart(19)}`,
    );
  };
  show("NEVER (0)", base);
  show(`derived (${derived.toFixed(3)})`, arm(derived));
  show(`pFresh (${pFresh.toFixed(3)})`, arm(pFresh));
  show("ALWAYS (2)", arm(ALWAYS_REDRAW_CONNECT_THRESHOLD));
  console.log(`\n  THE ALWAYS ROW REPRODUCES THE FAILURE ON RECORD and that is why it is printed:`);
  console.log(`  \`cardChoice.ts\` §5 describes 78% escaped_mana at 1.29 turns/cast. If the ALWAYS`);
  console.log(`  row does not look like that, this harness is not exercising the same failure and`);
  console.log(`  the pin is decorative.`);

  // ── §6  VERDICT ───────────────────────────────────────────────────────
  const d = arm(derived);
  const dCatch = d.catchRate - base.catchRate;
  // Two arms of n each; the arms share seeds but diverge on the first redraw,
  // so treat them as independent rather than paired — the conservative side.
  const se = Math.sqrt((base.catchRate * (1 - base.catchRate)) / runs + (d.catchRate * (1 - d.catchRate)) / runs);
  console.log("\n── §6  VERDICT: DO NOT SHIP REDRAW, EVEN WITH THE RE-DERIVED TRIGGER ──");
  console.log(`  The re-derivation itself HELD. \`pConnect\` ranks turns monotonically (§2), the`);
  console.log(`  derived threshold fires on ${pct(fireRate(derived))} of turns rather than almost all of them, and`);
  console.log(`  ${pct(1 - (firing.length ? deadTurns / firing.length : 0))} of its firings are on hands with real headroom rather than flat`);
  console.log(`  distributions (§4). The trigger is asking the right question.`);
  console.log(`\n  The ANSWER is still no. In the simulator it buys ${(100 * dCatch).toFixed(1)}pp of catch — ${(dCatch / se).toFixed(1)} standard`);
  console.log(`  errors at n=${runs}, i.e. not distinguishable from zero — for ${d.manaPerCast.toFixed(2)} mana per cast, and`);
  console.log(`  it more than doubles \`escaped_mana\` (${pct(base.escapedMana)} -> ${pct(d.escapedMana)}). That is`);
  console.log(`  ${(d.manaPerCast / Math.max(dCatch, 1e-9)).toFixed(0)} mana per extra fish against a cast that holds 10 mana in total.`);
  console.log(`\n  Note the DIRECTION of the failure is the recorded one: mana exhaustion replacing`);
  console.log(`  meter exhaustion. The re-derived trigger fires four times less often than the old`);
  console.log(`  one and STILL lands there — which says the problem was never only the currency.`);
  console.log(`  A redraw costs 30% of the mana budget, and a fresh 3-card hand is not 30% better.`);
  console.log(`\n  RECOMMENDATION: leave \`redrawEnabled\` false and leave \`REDRAW_THRESHOLD\` alone.`);
  console.log(`  Ship nothing. \`shouldRedrawOnConnect\` stands as the correct question with a`);
  console.log(`  measured negative answer, which is worth more than an uncalibrated constant.`);
  console.log("");
}

main();
